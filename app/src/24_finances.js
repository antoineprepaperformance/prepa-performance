/* ===== Gestion de l'activité en ligne : factures numérotées, ventes encaissées, déclaration URSSAF (espace coach) =====
   Micro-entreprise : le chiffre d'affaires est ce qui est encaissé (montant payé par le client, avant la commission Stripe),
   déclaré chaque mois avant la fin du mois suivant. Factures : numérotation continue (AAAA-NNNN), jamais modifiées ni
   supprimées (une erreur ou un remboursement se corrige par un avoir) ; une note est obligatoire dès 25 € pour un
   particulier (arrêté du 3 octobre 1983). Les autres encaissements (séances, clubs, stages) restent dans le classeur de pilotage. */
const FIN_DEF = { taux: 26.1, cfp: 0.2, vl: 0, auto: true };
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function finParams(p) { const x = { ...FIN_DEF, ...(p || {}) }; const n = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d); return { ...x, taux: n(x.taux, FIN_DEF.taux), cfp: n(x.cfp, FIN_DEF.cfp), vl: n(x.vl, 0) }; }
function finRate(p) { const f = finParams(p); return (f.taux + f.cfp + f.vl) / 100; }
function moisNom(ym) { const [y, m] = String(ym).split("-").map(Number); return MOIS_LONG[m - 1] + " " + y; }
function moisSuivantFin(ym) { const [y, m] = String(ym).split("-").map(Number); return isoOf(new Date(y, m + 1, 0)); } // dernier jour du mois suivant
function ymOf(iso) { return String(iso || "").slice(0, 7); }
function eurF(v) { return (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }

/* ---- ce que rapporte une commande : la vente encaissée, puis les remboursements ---- */
function orderPaid(o) {
  if (!o || o.kind === "code") return null;
  const amount = Number(o.paidAmount ?? o.price) || 0;
  const paid = o.kind === "renouvellement" || !!o.paymentId || !!o.activatedAt;
  if (!paid || amount <= 0) return null;
  const ts = String(o.paidAt || o.activatedAt || o.at || "");
  const moyen = o.payMethod || (o.kind === "manuel" ? "à préciser" : "Carte bancaire (Stripe)");
  return { date: ts.slice(0, 10), ts, amount, moyen };
}
function orderRefund(o) {
  if (!o) return null;
  const w = o.withdrawal && o.withdrawal.refundedAt && Number(o.withdrawal.refund) > 0 ? { date: String(o.withdrawal.refundedAt).slice(0, 10), ts: String(o.withdrawal.refundedAt), amount: Number(o.withdrawal.refund), why: "rétractation (part du service non fournie)" } : null;
  const c = o.cancel && o.cancel.refundedAt && Number(o.cancel.refund) > 0 ? { date: String(o.cancel.refundedAt).slice(0, 10), ts: String(o.cancel.refundedAt) + "T23:59", amount: Number(o.cancel.refund), why: "résiliation (période non utilisée)" } : null;
  return w || c;
}
function orderPeriod(o) {
  const from = String(o.contStart || o.start || o.at || "").slice(0, 10);
  if (o.kind === "renouvellement" && o.untilMs) return { du: o.fromMs ? isoOf(new Date(o.fromMs)) : from, au: isoOf(new Date(o.untilMs - 1)) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  if (o.offer === "lite") {
    if (o.kind === "code" || !o.period) return null;
    return { du: from, au: isoOf(new Date(addPeriodMs(msOfISO(from), o.period) - 1)) };
  }
  const w = Number(o.weeks);
  if (!w) return null;
  if (isLongW(w)) return { du: from, au: isoOf(new Date(addPeriodMs(msOfISO(from), "mois", monthsOfW(w)) - 1)) };
  return { du: from, au: addDays(from, w * 7 - 1) };
}
function orderLabel(o) {
  if (o.offer === "lite") return (o.nutri ? "Forfait Lite + Nutrition" : "Forfait Lite") + " — " + (o.period === "an" ? "annuel" : "mensuel") + (o.mode === "abo" ? ", abonnement" : ", paiement d'avance") + (o.kind === "renouvellement" ? " (renouvellement)" : "");
  return "Accompagnement en ligne, formule " + offerName(o.offer) + " — " + durName(o.weeks) + (PB[o.programId] ? ", programme " + PB[o.programId].n : "") + (o.ext ? " (prolongation)" : "");
}
/* toutes les lignes d'encaissement (ventes positives, remboursements négatifs) */
function salesLines(orderSets, names) {
  const out = [];
  Object.entries(orderSets || {}).forEach(([cid, orders]) => {
    Object.values(orders || {}).filter(Boolean).forEach((o) => {
      const p = orderPaid(o);
      if (p) out.push({ cid, o, kind: "vente", date: p.date, ts: p.ts, amount: p.amount, moyen: p.moyen, client: names[cid] || {}, num: o.facture && o.facture.num });
      const r = p && orderRefund(o);
      if (r) out.push({ cid, o, kind: "remboursement", date: r.date, ts: r.ts, amount: -r.amount, moyen: p.moyen, why: r.why, client: names[cid] || {}, num: o.avoir && o.avoir.num });
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.ts.localeCompare(b.ts) || String(a.o.id).localeCompare(String(b.o.id)) || (a.kind === "vente" ? -1 : 1));
}

/* ---- facture (ou avoir) : instantané figé au moment de l'émission ---- */
function factureSnapshot(line, num, settings) {
  const L = legalInfo(settings), o = line.o;
  const vente = line.kind === "vente";
  return {
    num, kind: vente ? "facture" : "avoir", date: todayISO(), at: nowISO(), cid: line.cid, orderId: o.id,
    client: { name: line.client.name || "", email: line.client.email || "" },
    designation: vente ? orderLabel(o) : "Remboursement — " + line.why + " — " + orderLabel(o),
    periode: vente ? orderPeriod(o) : null, montant: Math.round(Math.abs(line.amount) * 100) / 100,
    payeLe: line.date, moyen: line.moyen, ref: vente ? null : (o.facture && o.facture.num) || null, commande: { id: o.id, date: String(o.at || "").slice(0, 10) },
    vendeur: { editeur: L.editeur, marque: L.marque, statut: L.statut, siret: L.siret, adresse: L.adresse, email: L.email, tva: L.tva, numTva: L.numTva },
  };
}
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function factureHtml(f) {
  const v = f.vendeur || {}, av = f.kind === "avoir";
  const tva = v.tva === "assujetti" ? "TVA comprise" + (v.numTva ? " — n° de TVA " + v.numTva : "") : "TVA non applicable, article 293 B du CGI";
  const per = f.periode ? "du " + fmtDY(f.periode.du) + " au " + fmtDY(f.periode.au) : "—";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${av ? "Avoir" : "Facture"} ${esc(f.num)}</title>
<style>body{font:14px/1.5 Helvetica,Arial,sans-serif;color:#111;background:#fff;max-width:760px;margin:24px auto;padding:0 20px}h1{font-size:24px;margin:0 0 4px;letter-spacing:.02em}
.top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;border-bottom:3px solid #b8932a;padding-bottom:14px;margin-bottom:18px}.brand{font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.muted{color:#555}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left;vertical-align:top}th{background:#f4efe1;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
td.n,th.n{text-align:right;white-space:nowrap}.tot{margin-left:auto;width:320px}.tot td{border:0;padding:4px 6px}.tot tr.big td{font-weight:800;font-size:16px;border-top:2px solid #111}.box{border:1px solid #ddd;border-radius:8px;padding:10px 12px}
.foot{margin-top:24px;font-size:12px;color:#555}@media print{body{margin:0}}</style></head><body>
<div class="top"><div><div class="brand">${esc(v.marque || "Antoine Prépa Performance")}</div><div>${esc(v.editeur)} EI — ${esc(v.statut)}</div><div class="muted">${esc(v.adresse)}</div>
<div class="muted">SIRET ${esc(v.siret || "—")} · ${esc(v.email)}</div></div>
<div style="text-align:right"><h1>${av ? "AVOIR" : "FACTURE"} N° ${esc(f.num)}</h1><div>Date : ${fmtDY(f.date)}</div>${av && f.ref ? `<div>Sur la facture n° ${esc(f.ref)}</div>` : ""}</div></div>
<div class="box"><b>Client</b><br>${esc(f.client.name || "—")}${f.client.email ? "<br><span class='muted'>" + esc(f.client.email) + "</span>" : ""}</div>
<table><thead><tr><th>Désignation</th><th>Période</th><th class="n">Qté</th><th class="n">Prix unitaire</th><th class="n">Montant</th></tr></thead>
<tbody><tr><td>${esc(f.designation)}<div class="muted">Prestation exécutée en ligne (application Antoine Prépa Performance) · commande ${esc(f.commande && f.commande.id)} du ${f.commande && f.commande.date ? fmtDY(f.commande.date) : "—"}</div></td><td>${per}</td><td class="n">1</td><td class="n">${av ? "−" : ""}${eurF(f.montant)}</td><td class="n">${av ? "−" : ""}${eurF(f.montant)}</td></tr></tbody></table>
<table class="tot"><tr><td>Total HT</td><td class="n">${av ? "−" : ""}${eurF(f.montant)}</td></tr><tr><td colspan="2" class="muted">${tva}</td></tr><tr class="big"><td>Total TTC</td><td class="n">${av ? "−" : ""}${eurF(f.montant)}</td></tr></table>
<p>${av ? "Remboursé le " + fmtDY(f.payeLe) + " (" + esc(f.moyen) + ")." : "Facture acquittée : payée le " + fmtDY(f.payeLe) + " (" + esc(f.moyen) + ")."}</p>
<div class="foot">${esc(v.editeur)} EI — ${esc(v.marque)} · ${esc(v.adresse)} · SIRET ${esc(v.siret || "—")}. Conditions générales de vente acceptées lors de la commande. Document établi en deux exemplaires, dont un remis au client.</div>
</body></html>`;
}
async function saveBlobText(name, text, mime) {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  try {
    const dl = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null;
    if (dl) { await dl.save({ filename: name, data: blob }); return true; }
  } catch (e) {}
  try { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); return true; } catch (e) { return false; }
}
function saveFacture(f) { return saveBlobText((f.kind === "avoir" ? "Avoir-" : "Facture-") + f.num + ".html", factureHtml(f), "text/html"); }

/* ---- commandes de tous les clients (écoute en direct) ---- */
function useAllOrders(db, cids) {
  const [sets, setSets] = useState({});
  const key = cids.slice().sort().join(",");
  useEffect(() => {
    if (!db) return undefined;
    const us = [];
    cids.forEach((cid) => {
      try { us.push(db.collection("clients/" + cid + "/orders").onSnapshot((s) => { const o = {}; s.docs.forEach((d) => { o[d.id] = d.data(); }); setSets((x) => ({ ...x, [cid]: o })); }, () => setSets((x) => ({ ...x, [cid]: x[cid] || {} })))); } catch (e) {}
    });
    return () => us.forEach((u) => { try { u(); } catch (e) {} });
  }, [db, key]);
  return sets;
}
/* numérotation : suite continue par année, à partir du compteur et du registre (le plus grand des deux) */
function nextSeq(reg, year) {
  const c = reg.compteur && Number(reg.compteur.annee) === year ? Number(reg.compteur.dernier) || 0 : 0;
  const m = Object.values(reg).filter((f) => f && f.num && String(f.num).startsWith(year + "-")).reduce((a, f) => Math.max(a, Number(String(f.num).split("-")[1]) || 0), 0);
  return Math.max(c, m) + 1;
}
function pendingInvoices(lines, reg) {
  const done = new Set([...Object.values(reg).filter((f) => f && f.orderId).map((f) => f.cid + "/" + f.orderId + "/" + f.kind), ...Object.keys(_issued)]);
  return lines.filter((l) => !done.has(l.cid + "/" + l.o.id + "/" + (l.kind === "vente" ? "facture" : "avoir")) || !l.num);
}
let _invBusy = false;
const _issued = {}; // factures émises pendant cette session (le registre peut mettre un instant à se mettre à jour)
const _lastSeq = {};
async function issueInvoices(db, lines, reg, settings) {
  if (_invBusy) return { n: 0 };
  _invBusy = true;
  try {
    const regByKey = { ..._issued };
    Object.values(reg).forEach((f) => { if (f && f.orderId) regByKey[f.cid + "/" + f.orderId + "/" + f.kind] = f; });
    const year = Number(todayISO().slice(0, 4));
    let seq = Math.max(nextSeq(reg, year), (_lastSeq[year] || 0) + 1), n = 0;
    const cur = {}; // commande à jour, si la même commande a une facture puis un avoir
    for (const l of lines) {
      const kind = l.kind === "vente" ? "facture" : "avoir";
      const k = l.cid + "/" + l.o.id + "/" + kind, ok = l.cid + "/" + l.o.id;
      const base = cur[ok] || l.o;
      let f = regByKey[k];
      if (!f) {
        if (kind === "avoir" && !(base.facture && base.facture.num) && !regByKey[ok + "/facture"]) continue; // l'avoir suit sa facture
        const num = year + "-" + String(seq).padStart(4, "0");
        f = factureSnapshot({ ...l, o: base }, num, settings);
        if (kind === "avoir") f.ref = f.ref || (regByKey[ok + "/facture"] || {}).num || null;
        await dbSet(db, "factures/" + num, f);
        _issued[k] = f; regByKey[k] = f; _lastSeq[year] = seq;
        await dbSet(db, "factures/compteur", { annee: year, dernier: seq, at: nowISO() });
        seq++; n++;
      }
      /* copie dans la commande du client : il télécharge sa facture depuis « Mes commandes » */
      if (!(base[kind] && base[kind].num === f.num)) { const next = { ...base, [kind]: f }; await dbSet(db, "clients/" + l.cid + "/orders/" + l.o.id, next); cur[ok] = next; }
    }
    return { n };
  } finally { _invBusy = false; }
}
/* le secrétaire : factures établies d'elles-mêmes à l'ouverture de l'espace coach (si les mentions légales sont remplies) */
function useAutoInvoices(db, rows, settings) {
  const real = rows.filter((r) => !r.demo);
  const sets = useAllOrders(db, real.map((r) => r.cid));
  const reg = useCol(db, "factures");
  const names = Object.fromEntries(real.map((r) => [r.cid, { name: (r.profile && r.profile.name) || "", email: (r.profile && r.profile.email) || "" }]));
  const lines = salesLines(sets, names);
  const params = finParams(reg.items.parametres);
  const legalOk = !!(legalInfo(settings).siret && legalInfo(settings).adresse);
  const pend = reg.ready ? pendingInvoices(lines, reg.items) : [];
  const sig = pend.map((l) => l.cid + l.o.id + l.kind).join("|");
  useEffect(() => {
    if (!db || !reg.ready || !legalOk || params.auto === false || !pend.length || !settings) return;
    issueInvoices(db, pend, reg.items, settings).catch((e) => console.warn("Factures automatiques", e && e.code));
  }, [db, reg.ready, legalOk, params.auto, sig]);
  return { lines, reg, params, pend, legalOk, names };
}

/* ---- déclaration du mois : le chiffre d'affaires du mois précédent, à déclarer avant la fin du mois ---- */
function declDue(params) {
  const now = todayISO(), cur = ymOf(now);
  const [y, m] = cur.split("-").map(Number);
  const prev = isoOf(new Date(y, m - 2, 1)).slice(0, 7);
  const done = (params.declarations || {})[prev];
  return { mois: prev, avant: moisSuivantFin(prev), done };
}
function FinAlert({ fin, go }) {
  if (!fin || !fin.reg.ready) return null;
  const d = declDue(fin.params);
  if (d.done) return null;
  const ca = fin.lines.filter((l) => ymOf(l.date) === d.mois).reduce((s, l) => s + l.amount, 0);
  return html`<div className="alert gold"><div><b>URSSAF : déclare ton chiffre d'affaires de ${moisNom(d.mois)} avant le ${fmtDY(d.avant)}</b>
    <p>Ventes de l'application : ${eurF(ca)}, à additionner à tes autres encaissements du mois (séances, clubs, stages) notés dans ton classeur de pilotage.</p></div>
    <${Btn} small onClick=${() => go("finances")}>Voir</${Btn}></div>`;
}

function FinancesView({ db, fin, settings, rows }) {
  const toast = useToast();
  const [year, setYear] = useState(Number(todayISO().slice(0, 4)));
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pf, setPf] = useState(() => fin.params);
  useEffect(() => { setPf(fin.params); }, [JSON.stringify(fin.reg.items.parametres || {})]);
  const rate = finRate(fin.params);
  const d = declDue(fin.params);
  const lines = fin.lines;
  const ofYear = lines.filter((l) => l.date.startsWith(year + "-"));
  const months = Array.from({ length: 12 }, (_, i) => { const ym = year + "-" + String(i + 1).padStart(2, "0"); const ls = ofYear.filter((l) => ymOf(l.date) === ym); const ventes = ls.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0); const remb = ls.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0); return { ym, ventes, remb, net: ventes - remb, n: ls.filter((l) => l.amount > 0).length }; });
  const tot = months.reduce((s, m) => ({ ventes: s.ventes + m.ventes, remb: s.remb + m.remb, net: s.net + m.net }), { ventes: 0, remb: 0, net: 0 });
  const caPrev = lines.filter((l) => ymOf(l.date) === d.mois).reduce((s, l) => s + l.amount, 0);
  const factures = Object.values(fin.reg.items).filter((f) => f && f.num).sort((a, b) => String(b.num).localeCompare(String(a.num)));
  const years = [...new Set([Number(todayISO().slice(0, 4)), ...lines.map((l) => Number(l.date.slice(0, 4)))])].filter(Boolean).sort();
  const saveParams = async (patch) => {
    try { await dbSet(db, "factures/parametres", { ...(fin.reg.items.parametres || {}), ...patch, at: nowISO() }); toast("Enregistré.", "ok"); }
    catch (e) { toast("Enregistrement impossible" + errWhy(e, true), "bad"); }
  };
  const issue = async () => {
    if (!fin.legalOk) { toast("Complète d'abord ton SIRET et ton adresse dans Offres & réglages : ils figurent sur chaque facture.", "warn"); return; }
    setBusy(true);
    try { const r = await issueInvoices(db, fin.pend, fin.reg.items, settings); toast(r.n ? plural(r.n, "facture établie", "factures établies") + "." : "Tout est à jour.", "ok"); }
    catch (e) { toast("Factures impossibles" + errWhy(e, true), "bad"); } finally { setBusy(false); }
  };
  const csvCell = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const num2 = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");
  const exportRecettes = () => {
    const head = ["Date d'encaissement", "N° de facture ou d'avoir", "Client", "Nature de la prestation", "Montant encaissé (€)", "Mode de paiement", "N° de commande", "Remarque"];
    const rowsCsv = ofYear.map((l) => [l.date, l.num || "à établir", l.client.name || "", l.kind === "vente" ? orderLabel(l.o) : "Remboursement — " + l.why, num2(l.amount), l.moyen, l.o.id, l.kind === "vente" ? "" : "Avoir sur la facture " + ((l.o.facture && l.o.facture.num) || "")]);
    saveBlobText("livre-des-recettes-application-" + year + ".csv", "﻿" + [head, ...rowsCsv].map((r) => r.map(csvCell).join(";")).join("\r\n"), "text/csv");
  };
  const exportFactures = () => {
    const head = ["N°", "Type", "Date d'émission", "Client", "Désignation", "Montant (€)", "Payé ou remboursé le", "Mode de paiement", "Commande", "Facture d'origine"];
    const fs0 = factures.filter((f) => String(f.num).startsWith(year + "-")).sort((a, b) => String(a.num).localeCompare(String(b.num)));
    const rowsCsv = fs0.map((f) => [f.num, f.kind, f.date, f.client.name, f.designation, num2(f.kind === "avoir" ? -f.montant : f.montant), f.payeLe, f.moyen, f.orderId, f.ref || ""]);
    saveBlobText("registre-des-factures-" + year + ".csv", "﻿" + [head, ...rowsCsv].map((r) => r.map(csvCell).join(";")).join("\r\n"), "text/csv");
  };
  return html`<div className="stack">
    <header className="page-h"><div><h1>Finances</h1><p className="muted small">Ventes de l'application, factures et déclaration URSSAF. Tes autres encaissements (séances, clubs, stages) se notent dans ton classeur de pilotage, qui additionne tout pour l'URSSAF, la TVA et le plafond de la micro-entreprise.</p></div></header>
    ${!fin.legalOk ? html`<div className="alert warn"><div><b>SIRET et adresse à compléter</b><p>Ils figurent sur chaque facture (avec la mention EI) : remplis-les dans Offres & réglages › Informations légales. Les factures s'établissent ensuite toutes seules.</p></div></div>` : null}
    <${Card} title=${"Déclaration URSSAF : " + moisNom(d.mois)} sub=${"À déclarer sur autoentrepreneur.urssaf.fr avant le " + fmtDY(d.avant) + (d.done ? " · déclarée le " + fmtDY(d.done) : "")}>
      <div className="stats4">
        <${Stat} n=${eurF(caPrev)} label="Ventes de l'application" sub="montant payé par les clients, avant la commission Stripe" />
        <${Stat} n=${eurF(caPrev * rate)} label="Cotisations estimées" sub=${fmtN(rate * 100, 1) + " % du chiffre d'affaires"} />
        <${Stat} n=${eurF(caPrev * (1 - rate))} label="Reste après cotisations" />
        <${Stat} n=${fmtDY(d.avant)} label="Date limite" tone=${d.done ? "" : "bad"} />
      </div>
      <p className="muted small">Déclare le total du mois : ces ventes, plus tes autres encaissements de ${moisNom(d.mois)} (classeur de pilotage, feuille Recettes). Les remboursements du mois sont déjà déduits ici.</p>
      <div className="btnrow">${d.done ? html`<${Btn} small kind="ghost" onClick=${() => saveParams({ declarations: { ...(fin.params.declarations || {}), [d.mois]: null } })}>Annuler « déclarée »</${Btn}>` : html`<${Btn} small onClick=${() => saveParams({ declarations: { ...(fin.params.declarations || {}), [d.mois]: todayISO() } })}>J'ai déclaré et payé</${Btn}>`}</div>
    </${Card}>
    <${Card} title=${"Ventes de l'application en " + year} action=${years.length > 1 ? html`<${Seg} options=${years.map((y) => ({ v: y, n: String(y) }))} value=${year} onChange=${setYear} />` : null}>
      <div className="tscroll"><table className="ptable fin-table"><thead><tr><th>Mois</th><th>Ventes</th><th>Remboursements</th><th>Chiffre d'affaires</th><th>Cotisations estimées</th><th>À déclarer avant le</th></tr></thead>
        <tbody>${months.map((m) => html`<tr key=${m.ym}><th>${moisNom(m.ym)}</th><td>${m.ventes ? eurF(m.ventes) : "—"}</td><td>${m.remb ? "−" + eurF(m.remb) : "—"}</td><td><b>${m.net ? eurF(m.net) : "—"}</b></td><td>${m.net ? eurF(m.net * rate) : "—"}</td><td>${fmtDY(moisSuivantFin(m.ym))}${(fin.params.declarations || {})[m.ym] ? " ✓" : ""}</td></tr>`)}
          <tr className="fin-tot"><th>Total</th><td>${eurF(tot.ventes)}</td><td>${tot.remb ? "−" + eurF(tot.remb) : "—"}</td><td><b>${eurF(tot.net)}</b></td><td>${eurF(tot.net * rate)}</td><td></td></tr></tbody></table></div>
      <p className="muted small">Seuils de la micro-entreprise (sur tout ton chiffre d'affaires de l'année, appli comprise) : franchise de TVA 37 500 € (seuil majoré 41 250 €), plafond 83 600 €. L'appli en représente ${fmtN(tot.net / 37500 * 100, 0)} % du seuil de TVA.</p>
      <div className="btnrow"><${Btn} small kind="ghost" onClick=${exportRecettes}>Livre des recettes ${year} (CSV)</${Btn}><${Btn} small kind="ghost" onClick=${exportFactures}>Registre des factures ${year} (CSV)</${Btn}></div>
      <p className="muted small">Le livre des recettes se colle dans ton classeur de pilotage, feuille « Ventes appli ». À garder 10 ans, comme les factures.</p>
    </${Card}>
    <${Card} title="Factures et avoirs" sub="Numérotées dans l'ordre (AAAA-NNNN), jamais modifiées ni supprimées : un remboursement se fait par un avoir. Le client récupère la sienne dans « Mes commandes ».">
      ${fin.pend.length ? html`<div className="alert gold"><div><b>${plural(fin.pend.length, "vente ou remboursement", "ventes ou remboursements")} sans facture</b><p>${fin.params.auto === false ? "Établis-les maintenant." : fin.legalOk ? "Elles s'établissent toutes seules ; tu peux aussi lancer maintenant." : "Complète d'abord ton SIRET et ton adresse."}</p></div><${Btn} small onClick=${issue} disabled=${busy}>Établir les factures</${Btn}></div>` : html`<p className="small ok-t">Toutes les ventes ont leur facture.</p>`}
      ${factures.length ? html`<div className="tscroll"><table className="ptable fin-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Montant</th><th></th></tr></thead>
        <tbody>${factures.slice(0, 60).map((f) => html`<tr key=${f.num}><th>${f.kind === "avoir" ? "Avoir " : ""}${f.num}</th><td>${fmtDY(f.date)}</td><td>${f.client.name}</td><td>${f.kind === "avoir" ? "−" : ""}${eurF(f.montant)}</td>
          <td><button type="button" className="linkbtn" onClick=${() => setView(f)}>Voir</button> · <button type="button" className="linkbtn" onClick=${() => saveFacture(f)}>Télécharger</button></td></tr>`)}</tbody></table></div>`
        : html`<p className="muted small">Aucune facture pour l'instant.</p>`}
    </${Card}>
    <${Card} title="Taux et réglages" sub="Micro-entreprise, prestations de services libérales (BNC, Sécurité sociale des indépendants). Vérifie tes options sur autoentrepreneur.urssaf.fr › Mon compte.">
      <div className="row2"><${Field} label="Cotisations sociales (%)" id="fin-taux" hint="26,1 % depuis le 1er janvier 2026 (décret n° 2024-484)."><input id="fin-taux" inputMode="decimal" value=${pf.taux} onChange=${(e) => setPf({ ...pf, taux: e.target.value.replace(",", ".") })} /></${Field}>
        <${Field} label="Formation professionnelle (%)" id="fin-cfp" hint="0,2 % pour une activité libérale."><input id="fin-cfp" inputMode="decimal" value=${pf.cfp} onChange=${(e) => setPf({ ...pf, cfp: e.target.value.replace(",", ".") })} /></${Field}></div>
      <div className="row2"><${Field} label="Versement libératoire de l'impôt"><${Seg} options=${[{ v: 0, n: "Non" }, { v: 2.2, n: "Oui (2,2 %)" }]} value=${Number(pf.vl) || 0} onChange=${(v) => setPf({ ...pf, vl: v })} /></${Field}>
        <${Field} label="Factures"><${Seg} options=${[{ v: true, n: "Automatiques" }, { v: false, n: "Sur demande" }]} value=${pf.auto !== false} onChange=${(v) => setPf({ ...pf, auto: v })} /></${Field}></div>
      <div className="actions"><${Btn} onClick=${() => saveParams({ taux: Number(pf.taux) || FIN_DEF.taux, cfp: Number(pf.cfp) || 0, vl: Number(pf.vl) || 0, auto: pf.auto !== false })}>Enregistrer</${Btn}></div>
    </${Card}>
    <${Modal} open=${!!view} wide title=${view ? (view.kind === "avoir" ? "Avoir " : "Facture ") + view.num : ""} onClose=${() => setView(null)}>
      ${view ? html`<div className="stack"><iframe className="fin-frame" title="Aperçu" srcDoc=${factureHtml(view)}></iframe><div className="btnrow"><${Btn} onClick=${() => saveFacture(view)}>Télécharger</${Btn}></div>
        <p className="muted small">Ouvre le fichier téléchargé puis Imprimer › Enregistrer en PDF si tu veux un PDF.</p></div>` : null}</${Modal}>
  </div>`;
}
