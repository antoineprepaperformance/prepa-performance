/* ===== Accès payant, codes d'offre, commandes, rétractation, documents légaux ===== */
const CGV_VERSION = "2026-10-22";
const TRIAL_DURS = [{ w: 1, n: "1 semaine" }, { w: 2, n: "2 semaines" }];
const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function normCode(s) { return String(s || "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "").slice(0, 24); }
function genCode(prefix) { let r = ""; const a = new Uint32Array(7); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 7; i++) a[i] = Math.floor(Math.random() * 1e9); } for (let i = 0; i < 7; i++) r += CODE_ALPHA[a[i] % CODE_ALPHA.length]; return normCode((prefix || "ESSAI") + "-" + r); }
function codeLink(code) { try { const u = location.origin + location.pathname.replace(/index\.html$/, ""); return u + "?code=" + encodeURIComponent(code); } catch (e) { return ""; } }
function codeState(c, uid) {
  if (!c) return { ok: false, why: "Code inconnu. Vérifie l'orthographe." };
  if (c.active === false) return { ok: false, why: "Ce code n'est plus actif." };
  if (c.expiresMs && Date.now() > c.expiresMs) return { ok: false, why: "Ce code a expiré le " + fmtDY(isoOf(new Date(c.expiresMs))) + "." };
  if (uid && c.usedBy && c.usedBy[uid]) return { ok: false, why: "Tu as déjà utilisé ce code." };
  if ((Number(c.uses) || 0) >= (Number(c.max) || 1)) return { ok: false, why: "Ce code a atteint son nombre d'utilisations." };
  return { ok: true };
}
function codeSummary(c) { return (c.kind === "essai" ? "Essai" : "Offert") + " · " + offerName(c.offer) + " · " + durName(c.weeks) + (c.programId && PB[c.programId] ? " · " + PB[c.programId].n : ""); }
function eur2(v) { return (Number(v) || 0).toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2, maximumFractionDigits: 2 }) + " €"; }
function priceOf(settings, offer, weeks) { const p = offerPrice(settings, offer, weeks); return p === null || p === undefined ? null : Number(p); }
function payLinkOf(settings, offer, weeks) {
  const l = settings && settings.pay && settings.pay.links && settings.pay.links[offer + "_" + weeks];
  return l && /^https:\/\//.test(l) ? l.trim() : null;
}
function payMode(settings) { return (settings && settings.pay && settings.pay.mode) || "manuel"; }
function stripeUrl(link, uid, order, email) {
  const ref = [uid, order.offer, order.weeks, order.id].join("__").replace(/[^A-Za-z0-9_-]/g, "");
  return link + (link.includes("?") ? "&" : "?") + "client_reference_id=" + encodeURIComponent(ref) + (email ? "&prefilled_email=" + encodeURIComponent(email) : "");
}
function legalInfo(settings) {
  const c = (window.SITE_CONFIG && window.SITE_CONFIG.legal) || {};
  const s = (settings && settings.legal) || {};
  const pick = (k, d) => (s[k] !== undefined && s[k] !== "" ? s[k] : c[k] !== undefined && c[k] !== "" ? c[k] : d);
  return {
    editeur: pick("editeur", "Antoine Limousi"), marque: pick("marque", "Antoine Prépa Performance"), statut: pick("statut", "Entrepreneur individuel (micro-entreprise)"),
    siret: pick("siret", ""), adresse: pick("adresse", ""), telephone: pick("telephone", (settings && settings.coach && settings.coach.phone) || ""),
    email: pick("email", (settings && settings.coach && settings.coach.email) || ""), diplome: pick("diplome", ""), cartePro: pick("cartePro", ""),
    assurance: pick("assurance", ""), mediateur: pick("mediateur", ""), mediateurSite: pick("mediateurSite", ""), tva: pick("tva", "franchise"), numTva: pick("numTva", ""),
  };
}
function legalMissing(settings) {
  const L = legalInfo(settings);
  return [["siret", "SIRET"], ["adresse", "adresse"], ["email", "e-mail de contact"], ["telephone", "téléphone"], ["cartePro", "carte professionnelle d'éducateur sportif"], ["mediateur", "médiateur de la consommation"], ["assurance", "assurance responsabilité civile professionnelle"]]
    .filter(([k]) => !L[k]).map(([, n]) => n);
}
function tvaLine(settings) { const L = legalInfo(settings); return L.tva === "assujetti" ? "Prix TTC" + (L.numTva ? " (TVA " + L.numTva + ")" : "") : "Prix nets : TVA non applicable, article 293 B du CGI"; }

/* ---------- plan issu d'une commande ---------- */
function planEnd(plan) { return plan && plan.start && plan.weeks ? addDays(plan.start, plan.weeks * 7 - 1) : null; }
function canExtend(prev, programId, weeks) {
  return !!(prev && prev.status === "active" && prev.programId === programId && PB[programId] && Number(prev.weeks) + Number(weeks) <= 12);
}
function planFromOrder(prev, order, profile, source) {
  const g = Number(order.weeks);
  const base = { source: { kind: source.kind, id: source.id || "", orderId: order.id }, grantWeeks: g, updatedAt: nowISO(), offer: order.offer };
  if (order.ext && canExtend(prev, order.programId, g)) {
    const end = planEnd(prev);
    const cont = order.contStart || addDays(end, 1);
    const start = cont > addDays(end, 1) ? addDays(cont, -Number(prev.weeks) * 7) : prev.start;
    return { ...prev, ...base, weeks: Number(prev.weeks) + g, start: start < prev.start ? prev.start : start, cycle: cycOf(prev) };
  }
  return { programId: order.programId, offer: order.offer, weeks: g, start: order.start || todayISO(), equipment: order.equipment || "salle", status: "active",
    niveau: order.niveau || "sportif", medicalHold: !!(profile && profile.screeningFlag), compDate: order.compDate || null, message: "", extra: [],
    validatedAt: nowISO(), cycle: prev ? cycOf(prev) + 1 : 1, ...base };
}
function accessSummary(order) { return { lastOrder: clone(order), at: nowISO() }; }
/* activation par code (site : écriture groupée vérifiée par les règles) */
async function redeemCode(db, uid, code, order, prev, profile) {
  const plan = planFromOrder(prev, order, profile, { kind: "code", id: code });
  const now = nowISO();
  const done = { ...order, status: "active", activatedAt: now };
  const b = db.batch();
  b.update(db.doc("codes/" + code), { uses: firebase.firestore.FieldValue.increment(1), ["usedBy." + uid]: now });
  b.set(db.doc("plans/" + uid), clone(plan));
  b.set(db.doc("clients/" + uid + "/orders/" + order.id), clone(done));
  b.update(db.doc("clients/" + uid), { access: clone(accessSummary(done)) });
  await b.commit();
  return plan;
}
async function redeemPayment(db, uid, pid, pay, data) {
  const orders = Object.values((data && data.orders) || {});
  let order = (pay.orderId && data.orders && data.orders[pay.orderId]) || orders.filter((o) => o && o.kind === "paiement" && o.status === "en_attente").sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  const req = (data.profile && data.profile.request) || {};
  if (!order) order = { id: pay.orderId || rid("o"), at: nowISO(), kind: "paiement", offer: pay.offer, weeks: Number(pay.weeks), programId: req.programId, niveau: req.niveau, start: req.start, equipment: req.equipment, price: pay.amount / 100, status: "en_attente" };
  /* déjà activée par le coach (paiement vérifié à la main) : on ne crée pas un second accès */
  if (order.status === "active" || (data.plan && data.plan.source && data.plan.source.orderId === order.id)) return null;
  if (order.offer !== pay.offer || Number(order.weeks) !== Number(pay.weeks)) order = { ...order, offer: pay.offer, weeks: Number(pay.weeks) };
  const plan = planFromOrder(data.plan, order, data.profile, { kind: "paiement", id: pid });
  const now = nowISO();
  const done = { ...order, status: "active", paymentId: pid, paidAmount: pay.amount / 100, activatedAt: now };
  const b = db.batch();
  b.update(db.doc("payments/" + pid), { used: true, usedAt: now });
  b.set(db.doc("plans/" + uid), clone(plan));
  b.set(db.doc("clients/" + uid + "/orders/" + done.id), clone(done));
  b.update(db.doc("clients/" + uid), { access: clone(accessSummary(done)) });
  await b.commit();
  return plan;
}
/* surveille les paiements confirmés par le relais (site) */
function usePaymentWatcher(db, uid, src) {
  useEffect(() => {
    if (!window.IS_SITE || !db || !uid || !src) return undefined;
    let busy = false, u = null;
    try {
      u = db.collection("payments").where("uid", "==", uid).onSnapshot((s) => {
        s.docs.forEach(async (d) => {
          const p = d.data();
          if (!p || p.used || !p.ok || busy) return;
          busy = true;
          try { await redeemPayment(db, uid, d.id, p, src.get()); } catch (e) { console.warn("Activation du paiement impossible", e && e.code); } finally { busy = false; }
        });
      }, () => {});
    } catch (e) {}
    return () => { try { u && u(); } catch (e) {} };
  }, [db, uid, src]);
}
/* montant à rembourser après rétractation (prorata du service fourni, art. L221-25) */
function refundFor(order, plan, atISO) {
  const price = Number(order.paidAmount ?? order.price) || 0;
  if (!price) return 0;
  const at = String(atISO || nowISO()).slice(0, 10);
  const start = plan && plan.source && plan.source.orderId === order.id ? (order.ext ? addDays(planEnd(plan), -Number(order.weeks) * 7 + 1) : plan.start) : null;
  if (!start || at < start) return Math.round(price * 100) / 100;
  const used = diffDays(start, at) + 1, total = Number(order.weeks) * 7;
  return Math.round(price * Math.max(0, 1 - used / total) * 100) / 100;
}
function withdrawable(order) {
  return !!(order && (order.kind === "paiement" || order.kind === "manuel") && ["active", "payee", "en_attente"].includes(order.status) && !order.withdrawal && diffDays(String(order.at).slice(0, 10), todayISO()) <= 14);
}
function accessOf(data) {
  const plan = data.plan && data.plan.status !== "pending" ? data.plan : null;
  const o = plan && plan.source && plan.source.orderId && data.orders && data.orders[plan.source.orderId];
  if (o && o.withdrawal) return "retracte";
  if (!plan) return "aucun";
  if (plan.status === "paused") return "pause";
  if (plan.status === "archived") return "termine";
  const ps = planState(plan);
  return ps && ps.phase === "fini" ? "termine" : "actif";
}

/* ---------- commande (première fois ou renouvellement) ---------- */
function Purchase({ data, src, settings, db, uid, lib, mode, onDone }) {
  const toast = useToast();
  const p = data.profile || {};
  const req = p.request || {};
  const prev = data.plan && data.plan.status !== "pending" ? data.plan : null;
  const prevEnd = planEnd(prev);
  const age = ageOf(p);
  const minor = age !== null && age < 18;
  const rec = recommendNiveau(req.answers || {}, age, p.screeningFlag);
  const pending = (() => { try { return normCode(localStorage.getItem("pending_code") || ""); } catch (e) { return ""; } })();
  const [f, setF] = useState(() => ({ programId: (mode === "renew" && prev ? prev.programId : req.programId) || "", niveau: (prev && prev.niveau) || req.niveau || rec.id, offer: req.offer || (prev && prev.offer) || "suivi",
    weeks: Number(req.weeks) || 4, start: req.start && req.start >= todayISO() ? req.start : nextMonday(), equipment: req.equipment || (prev && prev.equipment) || "salle", compDate: req.compDate || "" }));
  const [code, setCode] = useState(req.code || pending || "");
  const [cst, setCst] = useState(null); // {ok, c, why}
  const [cgv, setCgv] = useState(false), [early, setEarly] = useState(false), [parent, setParent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState(null);
  const [sent, setSent] = useState(null);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const codeC = cst && cst.ok ? cst.c : null;
  const offer = codeC ? codeC.offer : f.offer;
  const weeks = codeC ? Number(codeC.weeks) : Number(f.weeks);
  const programId = codeC && codeC.programId ? codeC.programId : f.programId;
  const prog = PB[programId];
  const extOk = mode === "renew" && canExtend(prev, programId, weeks);
  const [ext, setExt] = useState(true);
  const isExt = extOk && ext;
  const isCode = !!codeC || !!(cst && cst.ok && cst.pendingCoach);
  const price = isCode ? 0 : priceOf(settings, offer, weeks);
  const link = isCode ? null : payLinkOf(settings, offer, weeks);
  const checks = assessPlan({ programId, niveau: f.niveau, ans: req.answers, sport: p.sport, age, equipment: f.equipment, screeningFlag: p.screeningFlag, prereqOk: !PB[programId] || !PB[programId].prereq || (p.prereq || []).length >= PB[programId].prereq.length, weeks, compDate: f.compDate, start: f.start });
  const blocking = checks.some((c) => c.t === "bad");
  useEffect(() => { if (code && !cst) check(code); }, []);
  async function check(c0) {
    const c = normCode(c0);
    if (!c) { setCst(null); return; }
    if (!window.IS_SITE || !db) { setCst({ ok: true, c: null, pendingCoach: true, code: c }); return; }
    try {
      const s = await db.doc("codes/" + c).get();
      const d = s.exists ? s.data() : null;
      const st = codeState(d, uid);
      setCst(st.ok ? { ok: true, c: { ...d, code: c } } : { ok: false, why: st.why });
    } catch (e) { setCst({ ok: false, why: "Vérification impossible : vérifie ta connexion." }); }
  }
  const startCont = isExt ? (prevEnd >= todayISO() ? addDays(prevEnd, 1) : f.start) : f.start;
  const mkOrder = (kind) => ({ id: rid("o"), at: nowISO(), kind, offer, weeks, programId, niveau: f.niveau, start: isExt ? prev.start : f.start, contStart: isExt ? startCont : null,
    ext: !!isExt, equipment: prog && prog.maison ? f.equipment : "salle", compDate: f.compDate || null, price: price || 0, currency: "EUR", status: "en_attente",
    code: codeC ? codeC.code : cst && cst.pendingCoach ? cst.code : null, cgv: { v: CGV_VERSION, at: nowISO() }, early: !!(early && price),
    parent: minor ? { ok: !!parent, name: (p.parent && p.parent.name) || "", email: (p.parent && p.parent.email) || "" } : null });
  const needEarly = !!price && startCont < addDays(todayISO(), 15);
  const ready = !!prog && cgv && (!minor || parent) && !blocking && (!needEarly || early);
  async function saveReq(order) {
    const next = { ...p, request: { ...req, programId, niveau: f.niveau, offer, weeks, start: f.start, equipment: order.equipment, compDate: f.compDate || null, code: order.code || null }, access: accessSummary(order) };
    await src.setProfile(next);
    await src.saveOrder(order.id, order);
  }
  async function go() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      if (codeC && window.IS_SITE && db) {
        /* « activation » : le client active lui-même ; l'espace coach n'y touche pas (évite une double activation) */
        const order = { ...mkOrder("code"), status: "activation" };
        await saveReq(order);
        try { await redeemCode(db, uid, codeC.code, order, prev, p); }
        catch (e) {
          const s = await db.doc("plans/" + uid).get().catch(() => null);
          const pl = s && s.exists ? s.data() : null;
          if (!(pl && pl.source && pl.source.orderId === order.id)) { await src.saveOrder(order.id, { ...order, status: "annulee" }).catch(() => {}); throw e; }
        }
        try { localStorage.removeItem("pending_code"); } catch (e) {}
        toast("Accès activé : bon entraînement !", "ok");
        onDone && onDone();
        return;
      }
      if (cst && cst.pendingCoach) {
        const order = mkOrder("code");
        await saveReq(order);
        setSent({ kind: "code" });
        return;
      }
      const order = mkOrder(link ? "paiement" : "manuel");
      await saveReq(order);
      if (link) {
        const url = stripeUrl(link, uid || data.cid || "client", order, p.email);
        if (window.IS_SITE) { window.location.href = url; return; }
        try { window.open(url, "_blank", "noopener"); } catch (e) {}
        setSent({ kind: "paiement", url });
      } else setSent({ kind: "manuel" });
    } catch (e) {
      toast(e && e.code === "permission-denied" ? "Activation refusée : ce code n'est plus valable." : "Commande impossible : vérifie ta connexion et réessaie.", "bad");
    } finally { setBusy(false); }
  }
  if (sent) return html`<div className="stack">
    <div className="alert okb"><div><b>${sent.kind === "code" ? "Code envoyé à ton coach" : "Commande enregistrée"}</b>
      <p>${sent.kind === "code" ? "Ton accès s'active dès qu'Antoine ouvre l'application (en général dans la journée)." : sent.kind === "paiement" ? "Termine ton paiement sur la page Stripe ouverte dans un nouvel onglet. Ton accès s'active dès qu'Antoine a vu ton paiement." : "Antoine te contacte pour le paiement et active ton accès dès réception."}</p></div></div>
    ${sent.url ? html`<a className="btn ghost" href=${sent.url} target="_blank" rel="noopener">Rouvrir la page de paiement</a>` : null}
    ${settings && settings.pay && settings.pay.info && sent.kind === "manuel" ? html`<${Card} title="Paiement"><p className="small">${settings.pay.info}</p></${Card}>` : null}
  </div>`;
  const durs = (codeC ? [] : DURS);
  return html`<div className="stack form">
    ${mode === "renew" ? html`<p className="muted small">${prev ? "Ton programme actuel : " + (PB[prev.programId] ? PB[prev.programId].n : "") + ", " + durName(prev.weeks) + (prevEnd ? ", fin le " + fmtD(prevEnd) : "") + "." : ""}</p>` : null}
    <${Field} label="Programme" id="pu-prog"><select id="pu-prog" value=${programId} disabled=${!!(codeC && codeC.programId)} onChange=${(e) => set("programId", e.target.value)}>
      <option value="">Choisir</option>${PROGS.map((x) => html`<option key=${x.id} value=${x.id}>${x.n}</option>`)}</select></${Field}>
    ${extOk ? html`<${Field} label="Suite"><${Seg} options=${[{ v: true, n: "Continuer (semaines " + (Number(prev.weeks) + 1) + " à " + (Number(prev.weeks) + weeks) + ")" }, { v: false, n: "Recommencer à la semaine 1" }]} value=${ext} onChange=${setExt} /></${Field}>` : null}
    <div className="field"><span className="field-l">Ton profil</span><${NiveauCards} value=${f.niveau} onChange=${(v) => set("niveau", v)} recommended=${rec.id} />
      ${rec.why.length ? html`<span className="field-h">${rec.why.join(" ")}</span>` : null}</div>
    ${codeC ? html`<div className="alert okb"><div><b>Code ${codeC.code}</b><p>${codeSummary(codeC)} : accès offert, rien à payer.</p></div><button type="button" className="linkbtn" onClick=${() => { setCst(null); setCode(""); }}>Retirer</button></div>` : html`
      <${Field} label="Formule"><${Seg} options=${OFFERS.map((o) => ({ v: o.id, n: o.n }))} value=${f.offer} onChange=${(v) => set("offer", v)} /></${Field}>
      <p className="muted small">${(OFFERS.find((o) => o.id === f.offer) || {}).desc || ""}</p>
      <${Field} label="Durée"><${Seg} options=${durs.filter((d) => !isExt || Number(prev.weeks) + d.w <= 12).map((d) => ({ v: d.w, n: d.n + " · " + eur(priceOf(settings, f.offer, d.w)) }))} value=${Number(f.weeks)} onChange=${(v) => set("weeks", v)} /></${Field}>`}
    ${!isExt || prevEnd < todayISO() ? html`<div className="row2"><${Field} label=${isExt ? "Reprise le" : "Début"} id="pu-start"><input id="pu-start" type="date" min=${todayISO()} value=${f.start} onChange=${(e) => set("start", e.target.value)} /></${Field}>
      ${prog && prog.maison ? html`<${Field} label="Lieu"><${Seg} options=${[{ v: "salle", n: "En salle" }, { v: "maison", n: "À la maison" }]} value=${f.equipment} onChange=${(v) => set("equipment", v)} /></${Field}>` : null}</div>` : null}
    ${nivRank(f.niveau) >= 2 ? html`<${Field} label="Prochaine compétition importante (facultatif)" id="pu-comp" hint="Pour programmer l'affûtage des deux semaines précédentes."><input id="pu-comp" type="date" value=${f.compDate} onChange=${(e) => set("compDate", e.target.value)} /></${Field}>` : null}
    <${Card} title="Vérification de ton plan"><${FitChecks} checks=${checks} /></${Card}>
    ${!codeC ? html`<div className="row-end"><${Field} label="Tu as un code d'essai ou un code offert ?" id="pu-code"><input id="pu-code" value=${code} onChange=${(e) => { setCode(e.target.value); setCst(null); }} placeholder="ESSAI-XXXXXXX" autoComplete="off" /></${Field}>
      <${Btn} kind="ghost" onClick=${() => check(code)} disabled=${!normCode(code)}>Appliquer</${Btn}></div>
      ${cst && !cst.ok ? html`<p className="small warn-t" role="alert">${cst.why}</p>` : null}
      ${cst && cst.pendingCoach ? html`<p className="small">Code ${cst.code} : il sera vérifié par Antoine à l'activation.</p>` : null}` : null}
    <${Card} title="Récapitulatif">
      <dl className="dl"><dt>Programme</dt><dd>${prog ? prog.n : "—"}</dd><dt>Profil</dt><dd>${nivName(f.niveau)}</dd><dt>Formule</dt><dd>${offerName(offer)}</dd>
        <dt>Durée</dt><dd>${durName(weeks)}${isExt ? " de plus (jusqu'à " + durName(Number(prev.weeks) + weeks) + " au total)" : ""}</dd>
        <dt>${isExt ? "Suite" : "Début"}</dt><dd>${fmtDY(startCont)}</dd><dt>Prix</dt><dd><b>${price === 0 ? "Offert" : price === null ? "—" : eur(price)}</b></dd></dl>
      <p className="muted small">${tvaLine(settings)}. Paiement unique, sans abonnement ni renouvellement automatique.${weeks ? " Accès du " + fmtD(startCont) + " au " + fmtD(addDays(startCont, weeks * 7 - 1)) + " inclus." : ""}</p></${Card}>
    <label className="chk"><input type="checkbox" id="pu-cgv" checked=${cgv} onChange=${(e) => setCgv(e.target.checked)} /><span>J'ai lu et j'accepte les <button type="button" className="linkbtn" onClick=${() => setLegal("cgv")}>conditions générales de vente</button> et la <button type="button" className="linkbtn" onClick=${() => setLegal("confidentialite")}>politique de confidentialité</button>.</span></label>
    ${needEarly ? html`<label className="chk"><input type="checkbox" id="pu-early" checked=${early} onChange=${(e) => setEarly(e.target.checked)} /><span>Je demande que mon accompagnement commence dès l'activation, avant la fin du délai de rétractation de 14 jours. Je sais que si je me rétracte, je paierai la part du service déjà fournie.</span></label>` : null}
    ${minor ? html`<label className="chk"><input type="checkbox" id="pu-parent" checked=${parent} onChange=${(e) => setParent(e.target.checked)} /><span>Je suis le parent ou le tuteur légal de ${p.name || "l'enfant"} et je passe cette commande pour lui.</span></label>` : null}
    ${blocking ? html`<p className="small warn-t">Corrige d'abord le point bloquant ci-dessus.</p>` : null}
    <${Btn} block onClick=${go} disabled=${!ready || busy || price === null}>${busy ? "Un instant…" : codeC ? "Activer mon accès offert" : cst && cst.pendingCoach ? "Envoyer mon code à Antoine" : "Commander avec obligation de paiement · " + eur(price)}</${Btn}>
    ${!codeC && !(cst && cst.pendingCoach) && price ? html`<p className="muted small center">${link ? "Paiement sécurisé par Stripe. Tes coordonnées bancaires ne passent jamais par ce site." : "Antoine te contacte pour le paiement (virement, carte ou espèces) puis active ton accès."}</p>` : null}
    <${Modal} open=${!!legal} wide title=${legal === "cgv" ? "Conditions générales de vente" : "Politique de confidentialité"} onClose=${() => setLegal(null)}>${legal ? html`<${LegalDoc} kind=${legal} settings=${settings} />` : null}</${Modal}>
  </div>`;
}

/* ---------- écran d'accès (pas encore de programme actif) ---------- */
function AccessScreen({ data, src, settings, db, uid, lib, coach, state }) {
  const p = data.profile || {};
  const req = p.request || {};
  const prog = progOf(req.programId, lib);
  const last = p.access && p.access.lastOrder;
  const [testOpen, setTestOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const back = (() => { try { return new URLSearchParams(location.search).get("paiement"); } catch (e) { return null; } })();
  const waitingPay = window.IS_SITE && back === "ok" && state !== "actif";
  const pendingOrder = last && last.status === "en_attente" && !edit;
  const fakePlan = { weeks: req.weeks || 12, start: req.start || nextMonday() };
  return html`<div className="stack">
    <header className="c-top"><${Brand} sub="Mon accès" /></header>
    <div className="hero"><div className="eyebrow">${state === "retracte" ? "Rétractation enregistrée" : state === "termine" ? "Programme terminé" : "Dernière étape"}</div>
      <h1>${state === "retracte" ? "Ta rétractation a bien été reçue." : state === "termine" ? "Choisis la suite de ton programme." : "Bonjour " + ((p.name || "").split(" ")[0] || "") + ", active ton accès."}</h1>
      <p className="muted">${prog ? prog.n + " · profil " + nivName(req.niveau) + " · formule " + offerName(req.offer) + " · " + durName(req.weeks) : "Choisis ton programme"}</p></div>
    ${state === "retracte" ? html`<${Card} title="Et maintenant ?"><p className="small">${coach && coach.name || COACH_NAME_DEFAULT} te rembourse sous 14 jours, au prorata du service déjà fourni, avec le moyen de paiement utilisé. Tu peux commander à nouveau quand tu veux.</p></${Card}>` : null}
    ${waitingPay ? html`<div className="alert gold"><div><b>Paiement reçu par Stripe</b><p>${payMode(settings) === "auto" ? "Activation en cours : ton programme s'affiche dans quelques secondes." : "Antoine confirme ton paiement et active ton accès (en général dans la journée)."}</p></div></div>` : null}
    ${pendingOrder && !waitingPay ? html`<div className="alert gold"><div><b>${last.kind === "code" ? "Code en attente d'activation" : last.kind === "paiement" ? "Commande en attente de paiement" : "Commande enregistrée"}</b>
      <p>${last.kind === "code" ? "Ton code " + (last.code || "") + " sera activé par Antoine dès qu'il ouvre son espace." : last.kind === "paiement" ? "Si tu as payé, ton accès s'active dès la confirmation. Sinon, reprends ton paiement." : "Antoine te contacte pour le paiement et active ton accès dès réception."} Commande du ${fmtD(last.at)} · ${last.kind === "code" ? "code " + (last.code || "") : eur(Number(last.price) || 0)}.</p>
      ${last.kind === "manuel" && settings && settings.pay && settings.pay.info ? html`<p>${settings.pay.info}</p>` : null}</div>
      <div className="btnrow">${last.kind === "paiement" && payLinkOf(settings, last.offer, last.weeks) ? html`<${Btn} small onClick=${() => { const u = stripeUrl(payLinkOf(settings, last.offer, last.weeks), uid || "client", last, p.email); if (window.IS_SITE) window.location.href = u; else window.open(u, "_blank", "noopener"); }}>Reprendre le paiement</${Btn}>` : null}
        <${Btn} small kind="ghost" onClick=${() => setEdit(true)}>Modifier ma commande</${Btn}></div></div>` : null}
    ${!pendingOrder || edit ? html`<${Card} title=${state === "termine" ? "Ma prochaine période" : "Ma commande"}><${Purchase} data=${data} src=${src} settings=${settings} db=${db} uid=${uid} lib=${lib} mode=${data.plan ? "renew" : "first"} onDone=${() => setEdit(false)} /></${Card}>` : null}
    ${prog && state !== "termine" ? html`<${Card} title="En attendant : tes tests de départ" sub="Ils servent de point de comparaison.">
      <${Btn} kind="ghost" onClick=${() => setTestOpen(true)}>${data.tests.t0 ? "Modifier mes tests" : "Saisir mes tests"}</${Btn}></${Card}>` : null}
    ${prog && prog.prereq ? html`<${Prereq} prog=${prog} />` : null}
    <${OrdersCard} data=${data} src=${src} settings=${settings} />
    ${window.IS_SITE ? html`<${SignOutLink} />` : null}
    <${Modal} open=${testOpen} title="Mes tests de départ" onClose=${() => setTestOpen(false)}>
      ${testOpen && prog ? html`<${TestsForm} prog=${prog} plan=${fakePlan} data=${data} src=${src} point=${0} onDone=${() => setTestOpen(false)} />` : null}
    </${Modal}>
  </div>`;
}

/* ---------- mes commandes et rétractation (art. L221-21 : « renoncer au contrat ici ») ---------- */
const ORDER_ST = { activation: ["gold", "Activation…"], en_attente: ["gold", "En attente"], payee: ["ok", "Payée"], active: ["ok", "Active"], retractee: ["warn", "Rétractée"], annulee: ["muted", "Annulée"] };
function orderText(o, settings, kind) {
  const L = legalInfo(settings);
  const lines = kind === "retractation" ? [
    "ACCUSÉ DE RÉCEPTION DE RÉTRACTATION", "", L.marque + " — " + L.editeur + (L.siret ? " — SIRET " + L.siret : ""), L.adresse, L.email, "",
    "Nous accusons réception de ta rétractation.", "Reçue le : " + new Date(o.withdrawal.at).toLocaleString("fr-FR"), "Consommateur : " + o.withdrawal.name, "E-mail : " + (o.withdrawal.email || "—"),
    "Contrat : commande " + o.id + " du " + fmtDY(String(o.at).slice(0, 10)) + " — " + (PB[o.programId] ? PB[o.programId].n : o.programId) + ", formule " + offerName(o.offer) + ", " + durName(o.weeks) + ", " + eur(Number(o.paidAmount ?? o.price) || 0),
    "", "Remboursement sous 14 jours avec le moyen de paiement utilisé, au prorata du service fourni jusqu'à ta rétractation (article L221-25 du code de la consommation)."]
    : ["RÉCAPITULATIF DE COMMANDE", "", L.marque + " — " + L.editeur + (L.siret ? " — SIRET " + L.siret : ""), L.adresse, L.email, "",
      "Commande : " + o.id + " du " + new Date(o.at).toLocaleString("fr-FR"), "Programme : " + (PB[o.programId] ? PB[o.programId].n : o.programId) + " — profil " + nivName(o.niveau),
      "Formule : " + offerName(o.offer) + " — " + durName(o.weeks) + " — début " + fmtDY(o.contStart || o.start), "Prix : " + (o.kind === "code" ? "offert (code " + o.code + ")" : eur(Number(o.price) || 0)) + " — " + tvaLine(settings),
      "Conditions générales de vente acceptées : version " + ((o.cgv && o.cgv.v) || CGV_VERSION) + " le " + (o.cgv ? new Date(o.cgv.at).toLocaleString("fr-FR") : "—"),
      o.early ? "Demande expresse de commencer avant la fin du délai de rétractation : oui." : "", "Droit de rétractation : 14 jours à compter de la commande, depuis « Mes commandes » (bouton « Renoncer au contrat ici »)."];
  return lines.filter((x) => x !== undefined).join("\n");
}
async function saveText(name, text) {
  try {
    const dl = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null;
    if (dl) { await dl.save({ filename: name, data: new Blob([text], { type: "text/plain;charset=utf-8" }) }); return true; }
  } catch (e) {}
  try { const u = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); return true; } catch (e) { return false; }
}
function OrdersCard({ data, src, settings }) {
  const toast = useToast();
  const orders = Object.values(data.orders || {}).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const p = data.profile || {};
  const [wd, setWd] = useState(null); // commande en cours de rétractation
  const [form, setForm] = useState({ name: p.name || "", email: p.email || "" });
  const [busy, setBusy] = useState(false);
  if (!orders.length) return null;
  const confirm = async () => {
    setBusy(true);
    try {
      const w = { at: nowISO(), name: form.name.trim(), email: form.email.trim(), refund: refundFor(wd, data.plan, nowISO()) };
      const o = { ...wd, status: "retractee", withdrawal: w };
      await src.saveOrder(o.id, o);
      await src.setProfile({ ...p, access: accessSummary(o) });
      setWd(null);
      toast("Rétractation reçue. L'accusé de réception est téléchargé.", "ok");
      saveText("accuse-retractation-" + o.id + ".txt", orderText(o, settings, "retractation"));
    } catch (e) { toast("Envoi impossible : réessaie.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title="Mes commandes">
    ${orders.map((o) => html`<div key=${o.id} className="order">
      <div className="meal-h"><b>${PB[o.programId] ? PB[o.programId].n : "Programme"} · ${durName(o.weeks)}</b><${Pill} tone=${(ORDER_ST[o.status] || ORDER_ST.en_attente)[0]}>${(ORDER_ST[o.status] || ORDER_ST.en_attente)[1]}</${Pill}></div>
      <p className="muted small">Commande du ${fmtDY(String(o.at).slice(0, 10))} · ${offerName(o.offer)} · ${o.kind === "code" ? "code " + (o.code || "") : eur(Number(o.paidAmount ?? o.price) || 0)}</p>
      ${o.withdrawal ? html`<p className="small">Rétractation reçue le ${new Date(o.withdrawal.at).toLocaleString("fr-FR")} · remboursement prévu : ${eur2(o.withdrawal.refund || 0)}${o.withdrawal.refundedAt ? " (effectué le " + fmtD(o.withdrawal.refundedAt) + ")" : ""}.
        <button type="button" className="linkbtn" onClick=${() => saveText("accuse-retractation-" + o.id + ".txt", orderText(o, settings, "retractation"))}>Accusé de réception</button></p>` : null}
      <div className="btnrow"><button type="button" className="linkbtn" onClick=${() => saveText("commande-" + o.id + ".txt", orderText(o, settings, "commande"))}>Télécharger le récapitulatif</button>
        ${withdrawable(o) && (!wd || wd.id !== o.id) ? html`<button type="button" className="linkbtn" onClick=${() => { setWd(o); setForm({ name: p.name || "", email: p.email || "" }); }}>Renoncer au contrat ici</button>` : null}</div>
      ${wd && wd.id === o.id ? html`<div className="card retract"><h3>Rétractation</h3>
        <p className="small">Tu peux te rétracter jusqu'au ${fmtDY(addDays(String(o.at).slice(0, 10), 14))} inclus. Remboursement estimé : ${eur2(refundFor(o, data.plan, nowISO()))} (prorata du service déjà fourni).</p>
        <${Field} label="Nom et prénom" id="rt-n"><input id="rt-n" value=${form.name} onChange=${(e) => setForm({ ...form, name: e.target.value })} /></${Field}>
        <${Field} label="Contrat concerné"><input value=${"Commande " + o.id + " du " + fmtD(String(o.at).slice(0, 10))} readOnly /></${Field}>
        <${Field} label="E-mail pour l'accusé de réception" id="rt-e"><input id="rt-e" type="email" value=${form.email} onChange=${(e) => setForm({ ...form, email: e.target.value })} /></${Field}>
        <div className="actions"><${Btn} kind="danger" onClick=${confirm} disabled=${busy || form.name.trim().length < 2}>Confirmer la rétractation</${Btn}><${Btn} kind="quiet" onClick=${() => setWd(null)}>Annuler</${Btn}></div></div>` : null}
    </div>`)}</${Card}>`;
}

/* ---------- documents légaux ---------- */
function LegalDoc({ kind, settings }) {
  const L = legalInfo(settings);
  const v = (x) => x || "[à compléter]";
  const contact = [L.email, L.telephone].filter(Boolean).join(" · ") || "[à compléter]";
  if (kind === "mentions") return html`<div className="legal small">
    <h3>Éditeur</h3><p>${L.marque} — ${L.editeur}, ${L.statut}.<br />SIRET : ${v(L.siret)}<br />Adresse : ${v(L.adresse)}<br />Contact : ${contact}<br />Directeur de la publication : ${L.editeur}.</p>
    <h3>Activité réglementée</h3><p>Éducateur sportif (article L212-1 du code du sport)${L.diplome ? ", titulaire de : " + L.diplome : ""}. Carte professionnelle n° ${v(L.cartePro)}.<br />Assurance responsabilité civile professionnelle : ${v(L.assurance)}.</p>
    <h3>TVA</h3><p>${L.tva === "assujetti" ? "Numéro de TVA intracommunautaire : " + v(L.numTva) + "." : "TVA non applicable, article 293 B du code général des impôts."}</p>
    <h3>Hébergement</h3><p>${window.IS_SITE ? "Site : GitHub Pages, GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. Données : Google Firebase, Google Ireland Ltd, Gordon House, Barrow Street, Dublin 4, Irlande." : "Application hébergée par Anthropic PBC, 548 Market Street, San Francisco, CA 94104, États-Unis (Claude)."}</p>
    <h3>Médiation de la consommation</h3><p>En cas de litige non résolu avec nous, tu peux saisir gratuitement le médiateur : ${v(L.mediateur)}${L.mediateurSite ? " (" + L.mediateurSite + ")" : ""}.</p>
    <h3>Propriété intellectuelle</h3><p>Programmes, textes, visuels et logo sont la propriété de ${L.editeur}. Toute reproduction ou diffusion sans autorisation est interdite.</p>
  </div>`;
  if (kind === "confidentialite") return html`<div className="legal small">
    <p>Version du ${fmtDY(CGV_VERSION)}. Responsable du traitement : ${L.editeur} (${L.marque}), ${v(L.adresse)}, ${contact}.</p>
    <h3>Données traitées et pourquoi</h3><ul>
      <li><b>Compte et contact</b> (nom, e-mail, téléphone, année de naissance, sport) : créer ton compte et te suivre. Base : exécution du contrat.</li>
      <li><b>Données de santé et d'entraînement</b> (questionnaire santé, douleurs, poids, mensurations, tests, séances, forme du jour, repas, photo de profil facultative) : adapter et suivre ton programme en sécurité. Base : ton consentement explicite (article 9.2.a du RGPD), que tu peux retirer à tout moment.</li>
      <li><b>Commandes et paiements</b> (formule, montant, date, statut ; jamais tes coordonnées bancaires, gérées par Stripe) : gérer ta commande, ta facture et une éventuelle rétractation. Base : contrat et obligations comptables.</li>
      <li><b>Codes d'essai</b> : vérifier qu'un code n'est utilisé qu'une fois par personne. Base : contrat.</li></ul>
    <h3>Qui y accède</h3><p>Uniquement toi et ${L.editeur}. Prestataires techniques : ${window.IS_SITE ? "Google Firebase (comptes et base de données, Europe pour la base ; comptes possiblement aux États-Unis), GitHub (hébergement des pages), Stripe (paiement), Cloudflare (relais de confirmation des paiements, s'il est activé), Open Food Facts (seul le code-barres scanné est envoyé)" : "Anthropic (hébergement de l'application et coach IA : ton dossier et tes photos de repas lui sont envoyés quand tu utilises le coach IA), Stripe (paiement)"}. Les transferts hors de l'Union européenne reposent sur le cadre de protection des données UE–États-Unis et des clauses contractuelles types. Aucune donnée n'est vendue ni utilisée pour de la publicité.</p>
    <h3>Combien de temps</h3><p>Pendant ton accompagnement, puis 3 ans après ton dernier contact pour le suivi commercial ; les données de santé sont supprimées 3 mois après la fin de ton dernier programme si tu ne reprends pas. Factures : 10 ans (obligation légale).</p>
    <h3>Mineurs</h3><p>Avant 15 ans, l'inscription demande l'accord conjoint de l'enfant et d'un titulaire de l'autorité parentale (article 45 de la loi Informatique et Libertés). Avant 18 ans, la commande est passée par un parent.</p>
    <h3>Tes droits</h3><p>Accès, rectification, effacement, limitation, portabilité, opposition, retrait du consentement et directives après décès : écris à ${v(L.email)}. Tu peux aussi saisir la CNIL (cnil.fr).</p>
    <h3>Traceurs</h3><p>Aucun cookie publicitaire ni outil de mesure d'audience. Le stockage local du navigateur sert uniquement à garder ta session et tes préférences : il est exempté de consentement.</p>
    ${window.IS_SITE ? null : html`<h3>Coach IA</h3><p>Le coach IA est une intelligence artificielle (Claude, d'Anthropic). Ses réponses sont des repères d'entraînement, pas des avis médicaux ; ${L.editeur} voit vos échanges et peut corriger ses ajustements.</p>`}
  </div>`;
  return html`<div className="legal small">
    <p>Version du ${fmtDY(CGV_VERSION)}, applicable à toute commande passée à compter de cette date.</p>
    <h3>1. Vendeur</h3><p>${L.marque} — ${L.editeur}, ${L.statut}, SIRET ${v(L.siret)}, ${v(L.adresse)}, ${contact}. Éducateur sportif, carte professionnelle n° ${v(L.cartePro)}.</p>
    <h3>2. Services</h3><p>Accès à un programme de préparation physique en ligne (8 programmes, profils Reprise, Sportif, Performance et Haut niveau) pour la durée choisie, avec le niveau de suivi de la formule : Essentiel (programme, bilan hebdomadaire, réponse courte), Suivi (réponse détaillée, ajustements, analyse vidéo d'un exercice par semaine), Hybride (en plus, 2 séances d'1 h par mois en présentiel en Bordeaux Métropole). Fonctionne sur un navigateur récent ou en application installée, avec une connexion internet pour la synchronisation.</p>
    <h3>3. Prix</h3><p>Prix indiqués en euros au moment de la commande. ${tvaLine(settings)}. Paiement unique : aucun abonnement, aucun renouvellement automatique.</p>
    <h3>4. Commande</h3><p>Tu choisis ton programme, ton profil, ta formule, ta durée et ta date de début, tu vérifies le récapitulatif, tu acceptes les présentes conditions puis tu valides avec le bouton « Commander avec obligation de paiement ». Le récapitulatif de commande est téléchargeable dans « Mes commandes » ; Stripe t'envoie un reçu par e-mail.</p>
    <h3>5. Paiement</h3><p>Paiement par carte via Stripe (paiement sécurisé, authentification forte), ou par un autre moyen convenu avec ${L.editeur}. L'accès s'active à la confirmation du paiement.</p>
    <h3>6. Codes d'essai et codes offerts</h3><p>Personnels, gratuits, utilisables une fois par personne dans la limite des conditions affichées (formule, durée, programme, date limite). Ils ne sont ni échangeables ni remboursables et ne se transforment jamais en commande payante sans nouvelle commande de ta part.</p>
    <h3>7. Durée de l'accès</h3><p>L'accès aux séances court de la date de début pendant la durée achetée. Ensuite, ton historique (séances, bilans, tests, carte athlète) reste consultable ; tu peux prolonger ou choisir un nouveau programme.</p>
    <h3>8. Droit de rétractation</h3><p>Tu disposes de 14 jours à compter de la commande pour te rétracter, sans motif, depuis « Mes commandes » (bouton « Renoncer au contrat ici »), ou par e-mail à ${v(L.email)} avec le formulaire ci-dessous. Un accusé de réception t'est remis aussitôt. Si tu as demandé que l'accompagnement commence avant la fin de ce délai, tu paies la part du service déjà fournie jusqu'à ta rétractation (article L221-25 du code de la consommation) ; le reste t'est remboursé sous 14 jours avec le moyen de paiement utilisé.</p>
    <p className="note">Formulaire de rétractation — À l'attention de ${L.editeur}, ${v(L.adresse)}, ${v(L.email)} : Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous. Commandé le : … Nom du consommateur : … Adresse du consommateur : … Signature (uniquement en cas d'envoi papier) : … Date : …</p>
    <h3>9. Santé et sécurité</h3><p>Le questionnaire santé est obligatoire avant de commencer. Une réponse « oui » impose l'avis de ton médecin : tes séances restent en mode Reprise jusqu'à ce que ${L.editeur} enregistre cet avis. Les programmes sont de l'entraînement physique, pas des soins : ils ne remplacent ni un avis médical ni une rééducation. En cas de douleur inhabituelle, arrête et consulte. Tu t'engages à donner des informations exactes et à respecter les consignes de charge et de douleur.</p>
    <h3>10. Mineurs</h3><p>Avant 18 ans, la commande est passée par un parent ou un tuteur légal ; avant 15 ans, son accord est aussi requis pour le traitement des données.</p>
    <h3>11. Garantie légale de conformité</h3><p>Le service numérique est garanti conforme pendant toute la durée de l'accès (articles L224-25-1 et suivants du code de la consommation). En cas de défaut, signale-le : il est corrigé dans un délai raisonnable, ou tu obtiens une réduction de prix ou la résolution du contrat.</p>
    <h3>12. Propriété intellectuelle</h3><p>Programmes et contenus sont réservés à ton usage personnel : pas de copie, de partage ni de revente.</p>
    <h3>13. Responsabilité</h3><p>${L.editeur} est assuré en responsabilité civile professionnelle (${v(L.assurance)}). Sa responsabilité ne couvre pas les dommages dus au non-respect des consignes, à une information de santé inexacte ou à une pratique hors programme.</p>
    <h3>14. Données personnelles</h3><p>Voir la politique de confidentialité.</p>
    <h3>15. Réclamations et médiation</h3><p>Écris d'abord à ${v(L.email)}. À défaut d'accord, tu peux saisir gratuitement le médiateur de la consommation : ${v(L.mediateur)}${L.mediateurSite ? " (" + L.mediateurSite + ")" : ""}.</p>
    <h3>16. Droit applicable</h3><p>Droit français. Si tu résides dans un autre pays, tu gardes la protection des règles impératives de ton pays de résidence. À défaut d'accord amiable, les tribunaux compétents sont ceux prévus par la loi.</p>
  </div>`;
}
