/* ===== Accès payant, codes d'offre, commandes, rétractation, documents légaux ===== */
const CGV_VERSION = "2026-10-28";
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
function codeSummary(c) { return (c.kind === "essai" ? "Essai" : "Offert") + " · " + offerName(c.offer) + (c.offer === "lite" && c.nutri ? " + Nutrition" : "") + " · " + durName(c.weeks) + (c.offer === "lite" ? " d'accès" : "") + (c.programId && PB[c.programId] ? " · " + PB[c.programId].n : ""); }
function eur2(v) { return (Number(v) || 0).toLocaleString(LOCALE, { minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2, maximumFractionDigits: 2 }) + " €"; }
function priceOf(settings, offer, weeks) { const p = offerPrice(settings, offer, weeks); return p === null || p === undefined ? null : Number(p); }
function payLinkOf(settings, offer, weeks) {
  if (offer === "lite") { const l = settings && settings.pay && settings.pay.links && settings.pay.links["lite_" + weeks]; return l && /^https:\/\//.test(l) ? l.trim() : null; } // weeks = "mois_abo", "an_avance_n"…
  const l = settings && settings.pay && settings.pay.links && settings.pay.links[offer + "_" + weeks];
  return l && /^https:\/\//.test(l) ? l.trim() : null;
}
function payMode(settings) { return (settings && settings.pay && settings.pay.mode) || "manuel"; }
function stripeUrl(link, uid, order, email) {
  const ref = [uid, order.offer, order.offer === "lite" ? order.period + "-" + order.mode + (order.nutri ? "-n" : "") : order.weeks, order.id].join("__").replace(/[^A-Za-z0-9_-]/g, "");
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

/* ---------- forfait Lite : mensuel ou annuel, abonnement ou paiement d'avance ---------- */
const LITE = CONTENT.LITE || { id: "lite", n: "Lite", prix: { mois: 9.9, an: 89 }, desc: "" };
const LITE_PER = [{ v: "mois", n: "Mensuel" }, { v: "an", n: "Annuel" }];
const LITE_MODE = [{ v: "abo", n: "Abonnement" }, { v: "avance", n: "Paiement d'avance" }];
function liteDesc() { const d = LITE.desc || ""; return window.IS_SITE ? d.replace(", sans correction vidéo par Antoine et sans coach IA.", " et sans correction vidéo par Antoine.") : d; }
/* Lite + Nutrition : mêmes réglages préfixés par « n » (nmois, nan) */
function litePrice(settings, period, nutri) { const k = (nutri ? "n" : "") + period; const s = settings && settings.lite && settings.lite[k]; const v = s !== undefined && s !== null && s !== "" ? Number(s) : (nutri ? LITE.prixN || { mois: 14.9, an: 129 } : LITE.prix)[period]; return Number.isFinite(v) ? v : null; }
/* nutrition : incluse partout sauf dans le Lite simple ; les abonnés Lite d'avant le 28 octobre 2026 la gardent */
const LITE_NUTRI_FROM = "2026-10-27T23:00"; // 28 octobre 2026 à 0 h, heure de Paris (validatedAt est en UTC) ; même seuil dans les règles Firestore (liteNewOk)
function nutriOk(plan) { if (!plan || plan.offer !== "lite") return true; return !!(plan.lite && plan.lite.nutri) || String(plan.validatedAt || "") < LITE_NUTRI_FROM; }
function liteOn(settings) { return !(settings && settings.lite && settings.lite.on === false); }
function liteLabel(x) { const l = (x && (x.lite || x)) || {}; if (l.mode === "code" || x.kind === "code") return "Lite offert" + (x.weeks ? " · " + durName(x.weeks) : ""); return "Lite " + (l.nutri ? "+ Nutrition " : "") + (l.period === "an" ? "annuel" : "mensuel") + (l.mode === "abo" ? " (abonnement)" : " (paiement d'avance)"); }
function litePer(period) { return period === "an" ? "an" : "mois"; }
function orderLink(settings, o) { return o.offer === "lite" ? payLinkOf(settings, "lite", o.period + "_" + o.mode + (o.nutri ? "_n" : "")) : payLinkOf(settings, o.offer, o.weeks); }
const LITE_GRACE = 3 * 86400000; // délai de prélèvement d'un renouvellement (Stripe retente un paiement refusé)
function liteCancelOf(data, plan) { const o = plan && plan.source && data && data.orders && data.orders[plan.source.orderId]; return o && o.cancel ? o.cancel : null; }
function liteEndMs(plan, data) {
  if (!plan || !plan.untilMs) return 0;
  const c = liteCancelOf(data, plan);
  if (c && c.immediate && c.effectMs) return Math.min(plan.untilMs, c.effectMs);
  return plan.untilMs + (plan.lite && plan.lite.mode === "abo" && !c ? LITE_GRACE : 0);
}
function durOf(o) { return o && o.offer === "lite" ? liteLabel(o) : durName(o && o.weeks); }
function msOfISO(iso) { const d = parseISO(iso); d.setHours(0, 0, 0, 0); return d.getTime(); }
function addPeriodMs(ms, period, n) {
  const d = new Date(ms); const k = (period === "an" ? 12 : 1) * (n || 1);
  const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + k);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last));
  return d.getTime();
}
function liteEnd(plan) { return plan && plan.untilMs ? isoOf(new Date(plan.untilMs - 1)) : null; }
function planDur(plan) { return plan && plan.offer === "lite" ? "Lite jusqu'au " + fmtD(liteEnd(plan)) : plan && plan.untilMs ? "jusqu'au " + fmtD(liteEnd(plan)) : durName(plan && plan.weeks); }
/* formules accompagnées sur 6 ou 12 mois (et leurs prolongations) : accès daté comme le Lite (startMs → untilMs), programme de 12 semaines qui s'enchaîne */
function datedPlan(plan) { return !!(plan && plan.offer !== "lite" && plan.untilMs); }
function datedActive(plan) { return !!(datedPlan(plan) && plan.status === "active" && Date.now() < plan.untilMs); }
function progWeeks(programId) { const pr = PB[programId]; return pr ? Math.min(12, pr.blocks.length * 4) : 12; }
function liteActive(plan, data) { return !!(plan && plan.offer === "lite" && plan.untilMs && plan.status === "active" && Date.now() < liteEndMs(plan, data)); }
/* renouvellement annuel tacite : information écrite 1 à 3 mois avant l'échéance (article L215-1) */
function liteNoticeDue(plan) { if (!plan || plan.offer !== "lite" || !plan.lite || plan.lite.mode !== "abo" || plan.lite.period !== "an" || !plan.untilMs) return false; const left = (plan.untilMs - Date.now()) / 86400000; return left <= 90 && left >= 0 && !(plan.lite.noticeFor === plan.untilMs); }

/* ---------- plan issu d'une commande ---------- */
function planEnd(plan) { return plan && plan.start && plan.weeks ? addDays(plan.start, plan.weeks * 7 - 1) : null; }
function canExtend(prev, programId, weeks) {
  return !!(prev && prev.status === "active" && prev.programId === programId && PB[programId] && Number(prev.weeks) + Number(weeks) <= 12);
}
function planFromOrder(prev, order, profile, source) {
  if (order.offer === "lite") return litePlanFromOrder(prev, order, profile, source);
  const g = Number(order.weeks);
  if (isLongW(g) || (order.ext && datedActive(prev) && DURS.some((d) => d.w === g))) return datedPlanFromOrder(prev, order, profile, source);
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
function litePlanFromOrder(prev, order, profile, source) {
  const base = { source: { kind: source.kind, id: source.id || "", orderId: order.id }, grantWeeks: 0, updatedAt: nowISO(), offer: "lite" };
  const mode = order.kind === "code" ? "code" : order.mode || "avance";
  const lite = { mode, period: mode === "code" ? null : order.period || "mois", sub: (source.pay && source.pay.sub) || null, nutri: !!order.nutri };
  /* paiement d'avance alors que l'accès Lite court encore : on prolonge la date de fin, sans toucher au programme */
  if (prev && prev.offer === "lite" && liteActive(prev) && order.ext && prev.programId === order.programId) {
    const untilMs = mode === "code" ? prev.untilMs + Number(order.weeks) * 7 * 86400000 : addPeriodMs(prev.untilMs, lite.period);
    return { ...prev, ...base, lite: { ...(prev.lite || {}), ...lite, sub: lite.sub || (prev.lite && prev.lite.sub) || null }, untilMs, until: isoOf(new Date(untilMs - 1)), cycle: cycOf(prev) };
  }
  const start = mode === "abo" ? todayISO() : order.start || todayISO();
  const startMs = msOfISO(start);
  const untilMs = mode === "code" ? startMs + Number(order.weeks) * 7 * 86400000 : addPeriodMs(startMs, lite.period);
  return { programId: order.programId, offer: "lite", weeks: progWeeks(order.programId), start, startMs, untilMs, until: isoOf(new Date(untilMs - 1)), lite, equipment: order.equipment || "salle", status: "active",
    niveau: order.niveau || "sportif", medicalHold: !!(profile && profile.screeningFlag), compDate: order.compDate || null, message: "", extra: [], validatedAt: nowISO(), cycle: prev ? cycOf(prev) + 1 : 1, ...base };
}
/* commande sur 6 ou 12 mois, ou prolongation d'un accès daté :
   1. même formule et même programme, accès en cours : la date de fin avance du nombre de mois payés ;
   2. accompagnement de 1 ou 3 mois en cours, même programme : on garde le programme, l'accès daté part de sa fin ;
   3. sinon : nouveau départ à la date choisie. */
function convOk(prev, programId) { return !!(prev && prev.offer !== "lite" && !prev.untilMs && prev.status === "active" && prev.programId === programId && PB[programId] && planEnd(prev) >= todayISO()); }
function datedPlanFromOrder(prev, order, profile, source) {
  const g = Number(order.weeks), n = monthsOfW(g);
  const base = { source: { kind: source.kind, id: source.id || "", orderId: order.id }, grantWeeks: g, updatedAt: nowISO(), offer: order.offer };
  const fin = (untilMs) => ({ untilMs, until: isoOf(new Date(untilMs - 1)) });
  if (order.ext && datedActive(prev) && prev.offer === order.offer && prev.programId === order.programId)
    return { ...prev, ...base, ...fin(addPeriodMs(prev.untilMs, "mois", n)), cycle: cycOf(prev) };
  if (order.ext && convOk(prev, order.programId)) {
    const startMs = msOfISO(todayISO());
    return { ...prev, ...base, weeks: progWeeks(prev.programId), startMs, ...fin(addPeriodMs(Math.max(msOfISO(addDays(planEnd(prev), 1)), startMs), "mois", n)), cycle: cycOf(prev) };
  }
  const start = order.start || todayISO(), startMs = msOfISO(start);
  return { programId: order.programId, offer: order.offer, weeks: progWeeks(order.programId), start, startMs, ...fin(addPeriodMs(startMs, "mois", n)), equipment: order.equipment || "salle", status: "active",
    niveau: order.niveau || "sportif", medicalHold: !!(profile && profile.screeningFlag), compDate: order.compDate || null, message: "", extra: [],
    validatedAt: nowISO(), cycle: prev ? cycOf(prev) + 1 : 1, ...base };
}
/* fin prévue d'une commande (affichage) */
function orderUntilMs(prev, order) {
  const g = Number(order.weeks), n = monthsOfW(g);
  if (order.ext && datedActive(prev)) return addPeriodMs(prev.untilMs, "mois", n);
  if (order.ext && convOk(prev, order.programId)) return addPeriodMs(Math.max(msOfISO(addDays(planEnd(prev), 1)), msOfISO(todayISO())), "mois", n);
  return addPeriodMs(msOfISO(order.start || todayISO()), "mois", n);
}
/* Lite et accès daté : le client choisit lui-même son programme suivant tant que son accès court (Sur mesure : Antoine l'écrit) */
function liteNextCycle(prev, f) {
  return { ...prev, programId: f.programId, weeks: progWeeks(f.programId), start: f.start, niveau: f.niveau || prev.niveau, equipment: f.equipment || prev.equipment, compDate: f.compDate || null, extra: [], message: "", cycle: cycOf(prev) + 1, updatedAt: nowISO() };
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
  if (pay.offer === "lite" && pay.renewal) {
    const prev = data.plan;
    if (!prev || prev.offer !== "lite" || !prev.lite || prev.lite.sub !== pay.sub) return null;
    const now = nowISO();
    const plan = { ...prev, untilMs: pay.untilMs, until: isoOf(new Date(pay.untilMs - 1)), source: { kind: "paiement", id: pid, orderId: (prev.source && prev.source.orderId) || "" }, updatedAt: now };
    const rec = { id: "r" + pid.slice(-10).replace(/[^A-Za-z0-9]/g, ""), at: now, kind: "renouvellement", offer: "lite", period: pay.period, mode: "abo", programId: prev.programId, niveau: prev.niveau, price: (pay.amount || 0) / 100, paidAmount: (pay.amount || 0) / 100, status: "active", paymentId: pid, activatedAt: now, untilMs: pay.untilMs, fromMs: prev.untilMs,
      noticed: pay.period === "an" ? !!(prev.lite && prev.lite.noticeFor === prev.untilMs) : null, parent: prev.source && prev.source.orderId ? prev.source.orderId : null };
    const b = db.batch();
    b.update(db.doc("payments/" + pid), { used: true, usedAt: now });
    b.set(db.doc("plans/" + uid), clone(plan));
    b.set(db.doc("clients/" + uid + "/orders/" + rec.id), clone(rec));
    await b.commit();
    return plan;
  }
  const orders = Object.values((data && data.orders) || {});
  let order = (pay.orderId && data.orders && data.orders[pay.orderId]) || orders.filter((o) => o && o.kind === "paiement" && o.status === "en_attente").sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  const req = (data.profile && data.profile.request) || {};
  if (!order) order = { id: pay.orderId || rid("o"), at: nowISO(), kind: "paiement", offer: pay.offer, weeks: Number(pay.weeks), programId: req.programId, niveau: req.niveau, start: req.start, equipment: req.equipment, price: pay.amount / 100, status: "en_attente" };
  /* paiement sans commande retrouvée pendant un accès daté de la même formule : on le prolonge plutôt que de le remplacer */
  if (!order.ext && pay.offer !== "lite" && datedActive(data.plan) && data.plan.offer === pay.offer && DURS.some((d) => d.w === Number(pay.weeks)) && !orders.some((o) => o && o.id === order.id))
    order = { ...order, ext: true, programId: data.plan.programId, start: data.plan.start };
  /* déjà activée par le coach (paiement vérifié à la main) : on ne crée pas un second accès */
  if (order.status === "active" || (data.plan && data.plan.source && data.plan.source.orderId === order.id)) return null;
  if (pay.offer === "lite") { if (order.offer !== "lite" || order.period !== pay.period || order.mode !== pay.mode) order = { ...order, offer: "lite", period: pay.period, mode: pay.mode }; }
  else if (order.offer !== pay.offer || Number(order.weeks) !== Number(pay.weeks)) order = { ...order, offer: pay.offer, weeks: Number(pay.weeks) };
  const plan = planFromOrder(data.plan, order, data.profile, { kind: "paiement", id: pid, pay });
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
  if (order.offer === "lite") {
    const own = plan && plan.source && plan.source.orderId === order.id && plan.startMs && plan.untilMs;
    if (!own) return Math.round(price * 100) / 100;
    const nowMs = msOfISO(at) + 86400000, tot = plan.untilMs - plan.startMs;
    if (nowMs <= plan.startMs) return Math.round(price * 100) / 100;
    return Math.round(price * Math.max(0, Math.min(1, (plan.untilMs - nowMs) / tot)) * 100) / 100;
  }
  if (isLongW(order.weeks) || (plan && plan.untilMs && plan.source && plan.source.orderId === order.id)) {
    const own = plan && plan.source && plan.source.orderId === order.id && plan.startMs && plan.untilMs;
    if (!own) return Math.round(price * 100) / 100;
    const fromMs = order.ext ? addPeriodMs(plan.untilMs, "mois", -monthsOfW(order.weeks)) : plan.startMs;
    const nowMs = msOfISO(at) + 86400000;
    if (nowMs <= fromMs) return Math.round(price * 100) / 100;
    return Math.round(price * Math.max(0, Math.min(1, (plan.untilMs - nowMs) / (plan.untilMs - fromMs))) * 100) / 100;
  }
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
  if (plan.offer === "lite" || plan.untilMs) return Date.now() < liteEndMs(plan, data) ? "actif" : "termine";
  const ps = planState(plan);
  return ps && ps.phase === "fini" ? "termine" : "actif";
}

/* ---------- commande (première fois ou renouvellement) ---------- */
function litePriceTxt(settings, period, mode, nutri) { const v = litePrice(settings, period, nutri); return v === null ? "—" : eur2(v) + (mode === "abo" ? (period === "an" ? " / an" : " / mois") : period === "an" ? " (1 an)" : " (1 mois)"); }
function liteTerms(period, mode, price, fromISO, toISO) {
  if (mode === "abo" && period === "an") return "Abonnement annuel à reconduction tacite : " + eur2(price) + " prélevés chaque année à la date anniversaire. Tu reçois un rappel écrit 1 à 3 mois avant chaque échéance pour pouvoir t'y opposer. Résiliation en quelques clics dans « Mes commandes » : elle prend effet à la fin de l'année payée.";
  if (mode === "abo") return "Abonnement mensuel sans durée minimale : " + eur2(price) + " prélevés chaque mois à la date anniversaire, jusqu'à résiliation. Résiliation à tout moment en quelques clics dans « Mes commandes » : elle prend effet à la fin du mois déjà payé.";
  return "Paiement unique, sans abonnement ni renouvellement automatique. Accès du " + fmtD(fromISO) + " au " + fmtD(toISO) + " inclus.";
}
/* clause de sortie des formules de 6 et 12 mois (reprise dans les conditions de vente) */
const LONG_EXIT = "En cas de blessure ou de contre-indication médicale attestée par un certificat, ton accompagnement est mis en pause (et prolongé d'autant) ou remboursé au prorata de la période restante, à ton choix.";
function Purchase({ data, src, settings, db, uid, lib, mode, onDone }) {
  const toast = useToast();
  const p = data.profile || {};
  const req = p.request || {};
  const prev = data.plan && data.plan.status !== "pending" ? data.plan : null;
  const prevEnd = prev && prev.untilMs ? liteEnd(prev) : planEnd(prev);
  const age = ageOf(p);
  const minor = age !== null && age < 18;
  const rec = recommendNiveau(req.answers || {}, age, p.screeningFlag);
  const pending = (() => { try { return normCode(localStorage.getItem("pending_code") || ""); } catch (e) { return ""; } })();
  const lOn = liteOn(settings);
  /* abonnement Lite en cours (non résilié) : pas de second achat Lite, il se renouvelle tout seul */
  const aboOn = mode === "renew" && prev && prev.offer === "lite" && prev.lite && prev.lite.mode === "abo" && liteActive(prev, data) && !liteCancelOf(data, prev);
  /* Sur mesure : places limitées ; un client déjà en Sur mesure peut toujours prolonger */
  const smOpen = !(settings && settings.surmesure && settings.surmesure.on === false) || (prev && prev.offer === "surmesure");
  const offers0 = [...OFFERS.filter((o) => o.id !== "surmesure" || smOpen).map((o) => ({ v: o.id, n: o.n })), ...(lOn && !aboOn ? [{ v: "lite", n: "Lite" }] : [])];
  const [f, setF] = useState(() => {
    let of = req.offer || (prev && prev.offer) || "suivi";
    if (!offers0.some((o) => o.v === of)) of = "suivi";
    return { programId: (mode === "renew" && prev ? prev.programId : req.programId) || "", niveau: (prev && prev.niveau) || req.niveau || rec.id, offer: of,
      weeks: DURS.some((d) => d.w === Number(req.weeks)) ? Number(req.weeks) : 4, nutri: !!(req.nutri || (prev && prev.lite && prev.lite.nutri)), start: req.start && req.start >= todayISO() ? req.start : nextMonday(), equipment: req.equipment || (prev && prev.equipment) || "salle", compDate: req.compDate || "",
      period: req.period || (prev && prev.lite && prev.lite.period) || "mois", lmode: req.lmode || (prev && prev.lite && prev.lite.mode !== "code" && prev.lite.mode) || "abo" };
  });
  const [code, setCode] = useState(req.code || pending || "");
  const [cst, setCst] = useState(null); // {ok, c, why}
  const [cgv, setCgv] = useState(false), [early, setEarly] = useState(false), [parent, setParent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState(null);
  const [sent, setSent] = useState(null);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const codeC = cst && cst.ok ? cst.c : null;
  const offer = codeC ? codeC.offer : f.offer;
  const isLite = offer === "lite";
  const lPer = litePer(f.period), lMode = f.lmode === "avance" ? "avance" : "abo";
  const weeks = codeC ? Number(codeC.weeks) : isLite ? 0 : Number(f.weeks);
  const programId = codeC && codeC.programId ? codeC.programId : f.programId;
  const prog = PB[programId];
  const nutri = isLite && (codeC ? !!codeC.nutri : !!f.nutri);
  const long = !isLite && isLongW(weeks);
  const progW = isLite || long ? progWeeks(programId) : weeks;
  /* prolongation : même programme, sans recommencer */
  const liteExtOk = isLite && mode === "renew" && liteActive(prev, data) && prev.programId === programId && (!!codeC || lMode === "avance") && !!(prev.lite && prev.lite.nutri) === nutri;
  /* accès daté en cours (6 ou 12 mois) : toute commande de la même formule et du même programme le prolonge */
  const dExt = !isLite && mode === "renew" && datedActive(prev) && prev.offer === offer && prev.programId === programId && DURS.some((d) => d.w === weeks);
  /* 1 ou 3 mois en cours, passage à 6 ou 12 mois : on garde le programme */
  const cExt = !isLite && long && mode === "renew" && convOk(prev, programId);
  const extOk = isLite ? liteExtOk : dExt || cExt || (!long && mode === "renew" && !datedPlan(prev) && canExtend(prev, programId, weeks));
  const [ext, setExt] = useState(true);
  const isExt = dExt || (extOk && ext);
  const dated = !isLite && (long || (isExt && (dExt || cExt)));
  const isCode = !!codeC || !!(cst && cst.pendingCoach);
  const price = isCode ? 0 : isLite ? litePrice(settings, lPer, nutri) : priceOf(settings, offer, weeks);
  const link = isCode ? null : isLite ? payLinkOf(settings, "lite", lPer + "_" + lMode + (nutri ? "_n" : "")) : payLinkOf(settings, offer, weeks);
  const checks = assessPlan({ programId, niveau: f.niveau, ans: req.answers, sport: p.sport, age, equipment: f.equipment, screeningFlag: p.screeningFlag, prereqOk: !PB[programId] || !PB[programId].prereq || (p.prereq || []).length >= PB[programId].prereq.length, weeks: progW, compDate: f.compDate, start: f.start });
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
  /* dates : Lite en abonnement démarre au paiement ; prolongation Lite à la suite de l'accès en cours */
  const startCont = isLite ? (isExt ? isoOf(new Date(prev.untilMs)) : lMode === "abo" && !codeC ? todayISO() : f.start)
    : isExt ? (dExt ? isoOf(new Date(prev.untilMs)) : prevEnd >= todayISO() ? addDays(prevEnd, 1) : f.start) : f.start;
  const liteToMs = isLite ? (codeC ? (isExt ? prev.untilMs : msOfISO(startCont)) + weeks * 7 * 86400000 : addPeriodMs(isExt ? prev.untilMs : msOfISO(startCont), lPer)) : 0;
  const endISO = isLite ? isoOf(new Date(liteToMs - 1)) : dated ? isoOf(new Date(orderUntilMs(prev, { weeks, ext: isExt, start: f.start, programId }) - 1)) : weeks ? addDays(startCont, weeks * 7 - 1) : null;
  const mkOrder = (kind) => ({ id: rid("o"), at: nowISO(), kind, offer, weeks: isLite && !codeC ? null : weeks, period: isLite && !codeC ? lPer : null, mode: isLite && !codeC ? lMode : null,
    ...(nutri ? { nutri: true } : {}), programId, niveau: f.niveau, start: isExt ? prev.start : isLite ? startCont : f.start, contStart: isExt ? startCont : null,
    ext: !!isExt, equipment: prog && prog.maison ? f.equipment : "salle", compDate: f.compDate || null, price: price || 0, currency: "EUR", status: "en_attente",
    code: codeC ? codeC.code : cst && cst.pendingCoach ? cst.code : null, cgv: { v: CGV_VERSION, at: nowISO() }, early: !!(early && price),
    parent: minor ? { ok: !!parent, name: (p.parent && p.parent.name) || "", email: (p.parent && p.parent.email) || "" } : null });
  const needEarly = !!price && startCont < addDays(todayISO(), 15);
  const startOk = isLite ? isExt || (lMode === "abo" && !codeC) || (f.start >= todayISO() && f.start <= addDays(todayISO(), 60)) : !dated || isExt || (f.start >= todayISO() && f.start <= addDays(todayISO(), 60));
  const replaces = !isLite && mode === "renew" && datedActive(prev) && !dExt;
  /* Lite en cours remplacé (nouveau départ ou passage au Lite + Nutrition) : on le dit avant la commande */
  const liteReplaces = isLite && mode === "renew" && !aboOn && liteActive(prev, data) && !isExt && !(prev.lite && prev.lite.mode === "abo" && !liteCancelOf(data, prev));
  const ready = !!prog && cgv && (!minor || parent) && !blocking && (!needEarly || early) && startOk && !(isLite && aboOn);
  async function saveReq(order) {
    const next = { ...p, request: { ...req, programId, niveau: f.niveau, offer, weeks: isLite ? req.weeks || 4 : weeks, period: isLite ? lPer : req.period || null, lmode: isLite ? lMode : req.lmode || null, nutri: isLite ? nutri : req.nutri || false, start: f.start, equipment: order.equipment, compDate: f.compDate || null, code: order.code || null }, access: accessSummary(order) };
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
  const lp = (per) => litePrice(settings, per, nutri);
  const save = lp("mois") && lp("an") ? Math.round((1 - lp("an") / (lp("mois") * 12)) * 100) : 0;
  const btnTxt = busy ? "Un instant…" : codeC ? "Activer mon accès offert" : cst && cst.pendingCoach ? "Envoyer mon code à Antoine"
    : isLite && lMode === "abo" ? "S'abonner avec obligation de paiement · " + litePriceTxt(settings, lPer, "abo", nutri) : "Commander avec obligation de paiement · " + (isLite ? eur2(price) : eur(price));
  return html`<div className="stack form">
    ${mode === "renew" ? html`<p className="muted small">${prev ? "Ton programme actuel : " + (PB[prev.programId] ? PB[prev.programId].n : "") + ", " + (prev.offer === "lite" ? "formule Lite, accès jusqu'au " + fmtDY(prevEnd) : prev.untilMs ? "formule " + offerName(prev.offer) + ", accès jusqu'au " + fmtDY(prevEnd) : durName(prev.weeks) + (prevEnd ? ", fin le " + fmtDY(prevEnd) : "")) + "." : ""}</p>` : null}
    ${aboOn ? html`<div className="alert okb"><div><b>Ton abonnement Lite est actif</b><p>Il se renouvelle tout seul : rien à racheter. Pour changer de programme quand le tien est terminé, utilise « Choisir mon prochain programme ». Pour passer à une formule avec suivi, résilie d'abord ton abonnement dans « Mes commandes » (sinon il continue d'être prélevé).</p></div></div>` : null}
    <${Field} label="Programme" id="pu-prog"><select id="pu-prog" value=${programId} disabled=${!!(codeC && codeC.programId)} onChange=${(e) => set("programId", e.target.value)}>
      <option value="">Choisir</option>${PROGS.map((x) => html`<option key=${x.id} value=${x.id}>${x.n}</option>`)}</select></${Field}>
    ${extOk && !dExt ? html`<${Field} label="Suite"><${Seg} options=${isLite ? [{ v: true, n: "Prolonger mon accès (même programme)" }, { v: false, n: "Nouveau départ en semaine 1" }] : cExt ? [{ v: true, n: "Continuer mon programme en cours" }, { v: false, n: "Recommencer à la semaine 1" }] : [{ v: true, n: "Continuer (semaines " + (Number(prev.weeks) + 1) + " à " + (Number(prev.weeks) + weeks) + ")" }, { v: false, n: "Recommencer à la semaine 1" }]} value=${ext} onChange=${setExt} /></${Field}>` : null}
    ${dExt ? html`<p className="small">Ton accès en cours est prolongé : ton programme continue, sans recommencer.</p>` : null}
    ${liteReplaces ? html`<div className="alert warn"><div><b>Ton accès Lite actuel court jusqu'au ${fmtDY(prevEnd)}</b><p>Cette commande le remplace dès son début. Pour ajouter la nutrition sans perdre de jours, écris plutôt à Antoine : il ajoute l'option au prorata.</p></div></div>` : null}
    ${replaces ? html`<div className="alert warn"><div><b>Ton accompagnement actuel court jusqu'au ${fmtDY(prevEnd)}</b><p>Une commande avec une autre formule ou un autre programme le remplace dès son début. Pour changer de programme, utilise plutôt « Choisir mon prochain programme » à la fin du tien ; pour changer de formule sans rien perdre, écris à Antoine : il ajuste ton accès au prorata.</p></div></div>` : null}
    <div className="field"><span className="field-l">Ton profil</span><${NiveauCards} value=${f.niveau} onChange=${(v) => set("niveau", v)} recommended=${rec.id} />
      ${rec.why.length ? html`<span className="field-h">${rec.why.join(" ")}</span>` : null}</div>
    ${codeC ? html`<div className="alert okb"><div><b>Code ${codeC.code}</b><p>${codeSummary(codeC)} : accès offert, rien à payer.</p></div><button type="button" className="linkbtn" onClick=${() => { setCst(null); setCode(""); }}>Retirer</button></div>` : html`
      <${Field} label="Formule"><${Seg} options=${offers0} value=${f.offer} onChange=${(v) => set("offer", v)} /></${Field}>
      <p className="muted small">${isLite ? (nutri ? LITE.descN : liteDesc()) : html`${(OFFERS.find((o) => o.id === f.offer) || {}).desc || ""} ${aiLimitTxt(settings, f.offer)}`}</p>
      ${isLite ? html`
        <${Field} label="Contenu"><${Seg} options=${[{ v: false, n: "Lite · " + eur2(litePrice(settings, "mois")) + " / mois" }, { v: true, n: "Lite + Nutrition · " + eur2(litePrice(settings, "mois", true)) + " / mois" }]} value=${!!f.nutri} onChange=${(v) => set("nutri", v)} /></${Field}>
        <${Field} label="Durée"><${Seg} options=${[{ v: "mois", n: "Mensuel · " + eur2(lp("mois")) }, { v: "an", n: "Annuel · " + eur2(lp("an")) + (save > 0 ? " (−" + save + " %)" : "") }]} value=${lPer} onChange=${(v) => set("period", v)} /></${Field}>
        <${Field} label="Paiement"><${Seg} options=${[{ v: "abo", n: "Abonnement (renouvellement automatique)" }, { v: "avance", n: "Paiement d'avance (sans renouvellement)" }]} value=${lMode} onChange=${(v) => set("lmode", v)} /></${Field}>`
      : html`<${Field} label="Durée"><${Seg} options=${durs.filter((d) => !isExt || datedActive(prev) || isLongW(d.w) || Number(prev.weeks) + d.w <= 12).map((d) => ({ v: d.w, n: d.n + " · " + eur(priceOf(settings, f.offer, d.w)) }))} value=${Number(f.weeks)} onChange=${(v) => set("weeks", v)} /></${Field}>
        ${long ? html`<p className="small muted">${"Soit " + eur(Math.round(priceOf(settings, f.offer, weeks) / monthsOfW(weeks))) + " par mois, payés en une fois. Ton programme de 12 semaines s'enchaîne avec le suivant jusqu'à la fin de ton accès."}</p>` : null}`}`}
    ${isLite && !isExt && lMode === "abo" && !codeC ? html`<p className="small muted">Ton accès commence dès le paiement.</p>` : null}
    ${(isLite ? !isExt && (lMode === "avance" || codeC) : !isExt || prevEnd < todayISO()) ? html`<div className="row2"><${Field} label=${isExt ? "Reprise le" : "Début"} id="pu-start" hint=${isLite || dated ? "Au plus tard dans 60 jours." : null}><input id="pu-start" type="date" min=${todayISO()} max=${isLite || dated ? addDays(todayISO(), 60) : undefined} value=${f.start} onChange=${(e) => set("start", e.target.value)} /></${Field}>
      ${prog && prog.maison ? html`<${Field} label="Lieu"><${Seg} options=${[{ v: "salle", n: "En salle" }, { v: "maison", n: "À la maison" }]} value=${f.equipment} onChange=${(v) => set("equipment", v)} /></${Field}>` : null}</div>` : null}
    ${!startOk ? html`<p className="small warn-t">Choisis une date de début entre aujourd'hui et dans 60 jours.</p>` : null}
    ${nivRank(f.niveau) >= 2 ? html`<${Field} label="Prochaine compétition importante (facultatif)" id="pu-comp" hint="Pour programmer l'affûtage des deux semaines précédentes."><input id="pu-comp" type="date" value=${f.compDate} onChange=${(e) => set("compDate", e.target.value)} /></${Field}>` : null}
    <${Card} title="Vérification de ton plan"><${FitChecks} checks=${checks} /></${Card}>
    ${!codeC ? html`<div className="row-end"><${Field} label="Tu as un code d'essai ou un code offert ?" id="pu-code"><input id="pu-code" value=${code} onChange=${(e) => { setCode(e.target.value); setCst(null); }} placeholder="ESSAI-XXXXXXX" autoComplete="off" /></${Field}>
      <${Btn} kind="ghost" onClick=${() => check(code)} disabled=${!normCode(code)}>Appliquer</${Btn}></div>
      ${cst && !cst.ok ? html`<p className="small warn-t" role="alert">${cst.why}</p>` : null}
      ${cst && cst.pendingCoach ? html`<p className="small">Code ${cst.code} : il sera vérifié par Antoine à l'activation.</p>` : null}` : null}
    <${Card} title="Récapitulatif">
      <dl className="dl"><dt>Programme</dt><dd>${prog ? prog.n : "—"}</dd><dt>Profil</dt><dd>${nivName(f.niveau)}</dd><dt>Formule</dt><dd>${offerName(offer)}</dd>
        ${isLite ? html`<dt>Accès</dt><dd>${codeC ? durName(weeks) + " offert" : (lPer === "an" ? "Annuel" : "Mensuel") + " · " + (lMode === "abo" ? "abonnement" : "paiement d'avance")}${isExt ? " de plus" : ""}${nutri ? " · avec nutrition" : ""}</dd>`
          : html`<dt>Durée</dt><dd>${durName(weeks)}${isExt ? (dated ? " de plus" : " de plus (jusqu'à " + durName(Number(prev.weeks) + weeks) + " au total)") : ""}</dd>`}
        <dt>${isExt ? "Suite" : "Début"}</dt><dd>${fmtDY(startCont)}</dd>${(isLite && !(lMode === "abo" && !codeC)) || dated ? html`<dt>Fin de l'accès</dt><dd>${fmtDY(endISO)}</dd>` : null}
        <dt>Prix</dt><dd><b>${price === 0 ? "Offert" : price === null ? "—" : isLite ? litePriceTxt(settings, lPer, lMode, nutri) : eur(price)}</b></dd></dl>
      <p className="muted small">${tvaLine(settings)}. ${isLite && !codeC ? liteTerms(lPer, lMode, price, startCont, endISO) : "Paiement unique, sans abonnement ni renouvellement automatique." + (endISO ? " Accès du " + fmtD(startCont) + " au " + fmtD(endISO) + " inclus." : "")}${long ? " " + LONG_EXIT : ""}</p></${Card}>
    <label className="chk"><input type="checkbox" id="pu-cgv" checked=${cgv} onChange=${(e) => setCgv(e.target.checked)} /><span>J'ai lu et j'accepte les <button type="button" className="linkbtn" onClick=${() => setLegal("cgv")}>conditions générales de vente</button> et la <button type="button" className="linkbtn" onClick=${() => setLegal("confidentialite")}>politique de confidentialité</button>.</span></label>
    ${needEarly ? html`<label className="chk"><input type="checkbox" id="pu-early" checked=${early} onChange=${(e) => setEarly(e.target.checked)} /><span>Je demande que mon ${isLite ? "accès" : "accompagnement"} commence dès l'activation, avant la fin du délai de rétractation de 14 jours. Je sais que si je me rétracte, je paierai la part du service déjà fournie.</span></label>` : null}
    ${minor ? html`<label className="chk"><input type="checkbox" id="pu-parent" checked=${parent} onChange=${(e) => setParent(e.target.checked)} /><span>Je suis le parent ou le tuteur légal de ${p.name || "l'enfant"} et je passe cette commande pour lui.</span></label>` : null}
    ${blocking ? html`<p className="small warn-t">Corrige d'abord le point bloquant ci-dessus.</p>` : null}
    <${Btn} block onClick=${go} disabled=${!ready || busy || price === null}>${btnTxt}</${Btn}>
    ${!codeC && !(cst && cst.pendingCoach) && price ? html`<p className="muted small center">${link ? "Paiement sécurisé par Stripe. Tes coordonnées bancaires ne passent jamais par ce site." : isLite && lMode === "abo" ? "Antoine te contacte pour mettre en place le prélèvement, puis active ton accès." : "Antoine te contacte pour le paiement (virement, carte ou espèces) puis active ton accès."}</p>` : null}
    <${Modal} open=${!!legal} wide title=${legal === "cgv" ? "Conditions générales de vente" : "Politique de confidentialité"} onClose=${() => setLegal(null)}>${legal ? html`<${LegalDoc} kind=${legal} settings=${settings} />` : null}</${Modal}>
  </div>`;
}

/* ---------- écran d'accès (pas encore de programme actif) ---------- */
function AccessScreen({ data, src, settings, db, uid, lib, coach, state, onMessages, unread }) {
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
    <header className="c-top"><${Brand} sub="Mon accès" />${onMessages ? html`<div className="btnrow"><${MsgButton} n=${unread || 0} onClick=${onMessages} /></div>` : null}</header>
    <div className="hero"><div className="eyebrow">${state === "retracte" ? "Rétractation enregistrée" : state === "termine" ? "Programme terminé" : "Dernière étape"}</div>
      <h1>${state === "retracte" ? "Ta rétractation a bien été reçue." : state === "termine" ? "Choisis la suite de ton programme." : "Bonjour " + ((p.name || "").split(" ")[0] || "") + ", active ton accès."}</h1>
      <p className="muted">${prog ? prog.n + " · profil " + nivName(req.niveau) + " · formule " + offerName(req.offer) + " · " + durOf({ offer: req.offer, weeks: req.weeks, period: req.period, mode: req.lmode }) : "Choisis ton programme"}</p></div>
    ${state === "retracte" ? html`<${Card} title="Et maintenant ?"><p className="small">${coach && coach.name || COACH_NAME_DEFAULT} te rembourse sous 14 jours, au prorata du service déjà fourni, avec le moyen de paiement utilisé. Tu peux commander à nouveau quand tu veux.</p></${Card}>` : null}
    ${waitingPay ? html`<div className="alert gold"><div><b>Paiement reçu par Stripe</b><p>${payMode(settings) === "auto" ? "Activation en cours : ton programme s'affiche dans quelques secondes." : "Antoine confirme ton paiement et active ton accès (en général dans la journée)."}</p></div></div>` : null}
    ${pendingOrder && !waitingPay ? html`<div className="alert gold"><div><b>${last.kind === "code" ? "Code en attente d'activation" : last.kind === "paiement" ? "Commande en attente de paiement" : "Commande enregistrée"}</b>
      <p>${last.kind === "code" ? "Ton code " + (last.code || "") + " sera activé par Antoine dès qu'il ouvre son espace." : last.kind === "paiement" ? "Si tu as payé, ton accès s'active dès la confirmation. Sinon, reprends ton paiement." : "Antoine te contacte pour le paiement et active ton accès dès réception."} Commande du ${fmtD(last.at)} · ${last.kind === "code" ? "code " + (last.code || "") : last.offer === "lite" ? litePriceTxt(settings, last.period, last.mode) : eur(Number(last.price) || 0)}.</p>
      ${last.kind === "manuel" && settings && settings.pay && settings.pay.info ? html`<p>${settings.pay.info}</p>` : null}</div>
      <div className="btnrow">${last.kind === "paiement" && orderLink(settings, last) ? html`<${Btn} small onClick=${() => { const u = stripeUrl(orderLink(settings, last), uid || "client", last, p.email); if (window.IS_SITE) window.location.href = u; else window.open(u, "_blank", "noopener"); }}>Reprendre le paiement</${Btn}>` : null}
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
const ORDER_ST = { activation: ["gold", "Activation…"], en_attente: ["gold", "En attente"], payee: ["ok", "Payée"], active: ["ok", "Active"], retractee: ["warn", "Rétractée"], annulee: ["muted", "Annulée"], resiliee: ["muted", "Résiliée"] };
function orderSt(o) { return o.cancel ? (o.cancel.effectMs && Date.now() >= o.cancel.effectMs ? ORDER_ST.resiliee : ["warn", "Résiliation enregistrée"]) : ORDER_ST[o.status] || ORDER_ST.en_attente; }
function orderText(o, settings, kind) {
  const L = legalInfo(settings);
  const lines = kind === "retractation" ? [
    "ACCUSÉ DE RÉCEPTION DE RÉTRACTATION", "", L.marque + " — " + L.editeur + (L.siret ? " — SIRET " + L.siret : ""), L.adresse, L.email, "",
    "Nous accusons réception de ta rétractation.", "Reçue le : " + new Date(o.withdrawal.at).toLocaleString("fr-FR"), "Consommateur : " + o.withdrawal.name, "E-mail : " + (o.withdrawal.email || "—"),
    "Contrat : commande " + o.id + " du " + fmtDY(String(o.at).slice(0, 10)) + " — " + (PB[o.programId] ? PB[o.programId].n : o.programId) + ", formule " + offerName(o.offer) + ", " + durOf(o) + ", " + eur2(Number(o.paidAmount ?? o.price) || 0),
    o.offer === "lite" && o.mode === "abo" ? "L'abonnement est arrêté : aucun nouveau prélèvement." : undefined,
    "", "Remboursement sous 14 jours avec le moyen de paiement utilisé, au prorata du service fourni jusqu'à ta rétractation (article L221-25 du code de la consommation)."]
    : ["RÉCAPITULATIF DE COMMANDE", "", L.marque + " — " + L.editeur + (L.siret ? " — SIRET " + L.siret : ""), L.adresse, L.email, "",
      "Commande : " + o.id + " du " + new Date(o.at).toLocaleString("fr-FR"), "Programme : " + (PB[o.programId] ? PB[o.programId].n : o.programId) + " — profil " + nivName(o.niveau),
      "Formule : " + offerName(o.offer) + " — " + durOf(o) + " — début " + fmtDY(o.contStart || o.start), "Prix : " + (o.kind === "code" ? "offert (code " + o.code + ")" : o.offer === "lite" ? litePriceTxt(settings, o.period, o.mode, !!o.nutri) : eur(Number(o.price) || 0)) + " — " + tvaLine(settings),
      o.offer === "lite" && o.mode === "abo" ? "Abonnement : " + liteTerms(o.period, "abo", Number(o.price) || 0) : undefined,
      "Conditions générales de vente acceptées : version " + ((o.cgv && o.cgv.v) || CGV_VERSION) + " le " + (o.cgv ? new Date(o.cgv.at).toLocaleString("fr-FR") : "—"),
      o.early ? "Demande expresse de commencer avant la fin du délai de rétractation : oui." : "", "Droit de rétractation : 14 jours à compter de la commande, depuis « Mes commandes » (bouton « Renoncer au contrat ici »)."];
  return lines.filter((x) => x !== undefined).join("\n");
}
function cancelText(o, settings) {
  const L = legalInfo(settings), c = o.cancel;
  return ["ACCUSÉ DE RÉCEPTION DE RÉSILIATION", "", L.marque + " — " + L.editeur + (L.siret ? " — SIRET " + L.siret : ""), L.adresse, L.email, "",
    "Nous confirmons la réception de ta résiliation.", "Notification reçue le : " + new Date(c.at).toLocaleString("fr-FR"), "Consommateur : " + c.name, "E-mail : " + (c.email || "—"),
    "Contrat : commande " + o.id + " du " + fmtDY(String(o.at).slice(0, 10)) + " — abonnement " + liteLabel(o) + ", " + litePriceTxt(settings, o.period, "abo", !!o.nutri),
    "Fin du contrat : " + (c.immediate ? "immédiate, le " + fmtDY(isoOf(new Date(c.effectMs))) : "le " + fmtDY(isoOf(new Date(c.effectMs - 1))) + " au soir, à la fin de la période déjà payée"),
    "Effets : aucun nouveau prélèvement ; ton accès Lite reste ouvert jusqu'à la fin du contrat ; ton historique (séances, bilans, tests, carte athlète) reste consultable.",
    c.refund > 0 ? "Remboursement : " + eur2(c.refund) + " (part non utilisée depuis la dernière reconduction), sous 30 jours avec le moyen de paiement utilisé (article L215-1 du code de la consommation)." : undefined,
  ].filter((x) => x !== undefined).join("\n");
}
/* abonnement Lite : arrêt automatique dans Stripe par le relais (s'il est installé avec sa clé Stripe) */
async function relayCancel(settings, sub, immediate) {
  const url = settings && settings.pay && settings.pay.relay;
  if (!window.IS_SITE || !url || !/^https:\/\//.test(url) || !sub) return "manuel";
  try {
    const u = firebase.auth().currentUser;
    const idToken = u ? await u.getIdToken() : "";
    const r = await fetch(url.replace(/\/+$/, "") + "/resilier", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken, sub, immediate: !!immediate }) });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? "ok" : "manuel";
  } catch (e) { return "manuel"; }
}
/* résiliation : fin de la période payée ; après une reconduction annuelle non annoncée (art. L215-1), à tout moment avec remboursement du reste */
function cancelOptions(o, plan, data) {
  const own = plan && plan.offer === "lite" && plan.source && plan.source.orderId === o.id && plan.untilMs;
  const endMs = own ? plan.untilMs : msOfISO(todayISO()) + 86400000;
  const ren = Object.values((data && data.orders) || {}).filter((x) => x && x.kind === "renouvellement" && x.parent === o.id).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  const canNow = !!(own && ren && ren.period === "an" && ren.noticed === false && ren.untilMs === plan.untilMs && Date.now() < plan.untilMs);
  const nowMs = Date.now();
  const refundNow = canNow ? Math.round((Number(ren.paidAmount) || 0) * Math.max(0, (plan.untilMs - nowMs) / (plan.untilMs - ren.fromMs)) * 100) / 100 : 0;
  return { endMs, canNow, refundNow };
}
function cancellable(o, plan) {
  return !!(o && o.offer === "lite" && o.mode === "abo" && o.status === "active" && !o.cancel && !o.withdrawal && plan && plan.source && plan.source.orderId === o.id && Date.now() < plan.untilMs + LITE_GRACE);
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
  const plan = data.plan;
  const [wd, setWd] = useState(null); // commande en cours de rétractation
  const [rs, setRs] = useState(null); // abonnement en cours de résiliation {o, step}
  const [form, setForm] = useState({ name: p.name || "", email: p.email || "", now: false });
  const [busy, setBusy] = useState(false);
  if (!orders.length) return null;
  const sub = plan && plan.lite && plan.lite.sub;
  const confirm = async () => {
    setBusy(true);
    try {
      const w = { at: nowISO(), name: form.name.trim(), email: form.email.trim(), refund: refundFor(wd, data.plan, nowISO()) };
      let o = { ...wd, status: "retractee", withdrawal: w };
      /* abonnement : la rétractation arrête aussi les prélèvements */
      if (wd.offer === "lite" && wd.mode === "abo") o = { ...o, cancel: { at: w.at, name: w.name, email: w.email, effectMs: Date.now(), immediate: true, refund: 0, stripe: await relayCancel(settings, sub, true) } };
      await src.saveOrder(o.id, o);
      await src.setProfile({ ...p, access: accessSummary(o) });
      setWd(null);
      toast("Rétractation reçue. L'accusé de réception est téléchargé.", "ok");
      saveText("accuse-retractation-" + o.id + ".txt", orderText(o, settings, "retractation"));
    } catch (e) { toast("Envoi impossible : réessaie.", "bad"); } finally { setBusy(false); }
  };
  const resilier = async () => {
    const o = rs.o, opt = cancelOptions(o, plan, data), now = !!(form.now && opt.canNow);
    setBusy(true);
    try {
      const c = { at: nowISO(), name: form.name.trim(), email: form.email.trim(), effectMs: now ? Date.now() : opt.endMs, immediate: now, refund: now ? opt.refundNow : 0, stripe: "en_cours" };
      let done = { ...o, cancel: c };
      await src.saveOrder(o.id, done);
      const st = await relayCancel(settings, sub, now);
      done = { ...done, cancel: { ...c, stripe: st } };
      await src.saveOrder(o.id, done);
      await src.setProfile({ ...p, access: accessSummary(done) });
      setRs({ o: done, step: 3 });
      saveText("accuse-resiliation-" + o.id + ".txt", cancelText(done, settings));
    } catch (e) { toast("Envoi impossible : vérifie ta connexion et réessaie.", "bad"); } finally { setBusy(false); }
  };
  const portal = settings && settings.lite && /^https:\/\//.test(settings.lite.portail || "") ? settings.lite.portail : null;
  return html`<${Card} title="Mes commandes">
    ${orders.map((o) => { const st = orderSt(o); const isRen = o.kind === "renouvellement"; return html`<div key=${o.id} className="order">
      <div className="meal-h"><b>${isRen ? "Renouvellement · " + durOf(o) : (PB[o.programId] ? PB[o.programId].n : "Programme") + " · " + durOf(o)}</b><${Pill} tone=${st[0]}>${st[1]}</${Pill}></div>
      <p className="muted small">${isRen ? "Prélèvement du " + fmtDY(String(o.at).slice(0, 10)) + " · " + eur2(o.paidAmount || 0) + " · accès jusqu'au " + fmtD(isoOf(new Date(o.untilMs - 1))) : "Commande du " + fmtDY(String(o.at).slice(0, 10)) + " · " + offerName(o.offer) + " · " + (o.kind === "code" ? "code " + (o.code || "") : o.offer === "lite" ? litePriceTxt(settings, o.period, o.mode) : eur(Number(o.paidAmount ?? o.price) || 0))}</p>
      ${o.offer === "lite" && o.mode === "abo" && o.status === "active" && !o.cancel && plan && plan.source && plan.source.orderId === o.id ? html`<p className="small">Abonnement en cours : prochain prélèvement le ${fmtDY(isoOf(new Date(plan.untilMs)))}.${portal ? html` <a href=${portal} target="_blank" rel="noopener">Gérer ma carte et mes factures</a>` : null}</p>` : null}
      ${o.cancel && !o.withdrawal ? html`<p className="small">Résiliation reçue le ${new Date(o.cancel.at).toLocaleString(LOCALE)} · fin du contrat ${o.cancel.immediate ? "immédiate" : "le " + fmtD(isoOf(new Date(o.cancel.effectMs - 1))) + " au soir"}${o.cancel.refund > 0 ? " · remboursement prévu : " + eur2(o.cancel.refund) : ""}.
        <button type="button" className="linkbtn" onClick=${() => saveText("accuse-resiliation-" + o.id + ".txt", cancelText(o, settings))}>Accusé de réception</button></p>` : null}
      ${o.withdrawal ? html`<p className="small">Rétractation reçue le ${new Date(o.withdrawal.at).toLocaleString(LOCALE)} · remboursement prévu : ${eur2(o.withdrawal.refund || 0)}${o.withdrawal.refundedAt ? " (effectué le " + fmtD(o.withdrawal.refundedAt) + ")" : ""}.
        <button type="button" className="linkbtn" onClick=${() => saveText("accuse-retractation-" + o.id + ".txt", orderText(o, settings, "retractation"))}>Accusé de réception</button></p>` : null}
      <div className="btnrow">${o.facture ? html`<button type="button" className="linkbtn" onClick=${() => saveFacture(o.facture)}>Télécharger ma facture</button>` : null}${o.avoir ? html`<button type="button" className="linkbtn" onClick=${() => saveFacture(o.avoir)}>Télécharger l'avoir</button>` : null}${!isRen ? html`<button type="button" className="linkbtn" onClick=${() => saveText("commande-" + o.id + ".txt", orderText(o, settings, "commande"))}>Télécharger le récapitulatif</button>` : null}
        ${cancellable(o, plan) && (!rs || rs.o.id !== o.id) ? html`<button type="button" className="linkbtn" onClick=${() => { setRs({ o, step: 1 }); setWd(null); setForm({ name: p.name || "", email: p.email || "", now: false }); }}>Résilier mon abonnement</button>` : null}
        ${withdrawable(o) && (!wd || wd.id !== o.id) ? html`<button type="button" className="linkbtn" onClick=${() => { setWd(o); setRs(null); setForm({ name: p.name || "", email: p.email || "", now: false }); }}>Renoncer au contrat ici</button>` : null}</div>
      ${rs && rs.o.id === o.id ? (() => { const opt = cancelOptions(o, plan, data); const endTxt = fmtDY(isoOf(new Date(opt.endMs - 1)));
        return rs.step === 3 ? html`<div className="alert okb" role="status"><div><b>Résiliation enregistrée</b><p>Nous avons bien reçu ta résiliation le ${new Date(rs.o.cancel.at).toLocaleString(LOCALE)}. Fin du contrat : ${rs.o.cancel.immediate ? "aujourd'hui" : endTxt + " au soir"}. Aucun nouveau prélèvement. L'accusé de réception est téléchargé.</p>
            ${rs.o.cancel.stripe !== "ok" ? html`<p className="small">Antoine arrête aussi ton abonnement dans Stripe et te le confirme par e-mail.${portal ? html` Tu peux vérifier sur <a href=${portal} target="_blank" rel="noopener">ton espace de paiement</a>.` : null}</p>` : null}
            <button type="button" className="linkbtn" onClick=${() => setRs(null)}>Fermer</button></div></div>`
        : html`<div className="card retract"><h3>Résilier mon abonnement</h3>
          ${rs.step === 1 ? html`<p className="small">Contrat : abonnement ${liteLabel(o)}, commande ${o.id} du ${fmtDY(String(o.at).slice(0, 10))}.</p>
            <${Field} label="Nom et prénom" id="rs-n"><input id="rs-n" value=${form.name} onChange=${(e) => setForm({ ...form, name: e.target.value })} /></${Field}>
            <${Field} label="E-mail pour l'accusé de réception" id="rs-e" hint="Obligatoire : la confirmation de ta résiliation t'est adressée à cette adresse."><input id="rs-e" type="email" value=${form.email} onChange=${(e) => setForm({ ...form, email: e.target.value })} /></${Field}>
            ${opt.canNow ? html`<${Field} label="Fin du contrat"><${Seg} options=${[{ v: false, n: "À la fin de la période payée (" + endTxt + ")" }, { v: true, n: "Tout de suite, remboursement de " + eur2(opt.refundNow) }]} value=${form.now} onChange=${(v) => setForm({ ...form, now: v })} /></${Field}>
              <p className="muted small">Tu n'as pas reçu l'information prévue avant la dernière reconduction : tu peux arrêter tout de suite et être remboursé du reste de l'année (article L215-1 du code de la consommation).</p>` : html`<p className="small">Fin du contrat : ${endTxt} au soir, à la fin de la période déjà payée. Aucun nouveau prélèvement ; ton accès reste ouvert jusque-là.</p>`}
            <div className="actions"><${Btn} onClick=${() => setRs({ ...rs, step: 2 })} disabled=${form.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.email.trim())}>Continuer</${Btn}><${Btn} kind="quiet" onClick=${() => setRs(null)}>Annuler</${Btn}></div>`
          : html`<dl className="dl"><dt>Nom</dt><dd>${form.name}</dd><dt>E-mail</dt><dd>${form.email}</dd><dt>Contrat</dt><dd>Abonnement ${liteLabel(o)} · ${o.id}</dd>
              <dt>Fin du contrat</dt><dd>${form.now && opt.canNow ? "Aujourd'hui (remboursement " + eur2(opt.refundNow) + ")" : endTxt + " au soir"}</dd></dl>
            <div className="actions"><${Btn} kind="danger" onClick=${resilier} disabled=${busy}>${busy ? "Envoi…" : "Confirmer la résiliation"}</${Btn}><${Btn} kind="quiet" onClick=${() => setRs({ ...rs, step: 1 })}>Modifier</${Btn}></div>`}</div>`; })() : null}
      ${wd && wd.id === o.id ? html`<div className="card retract"><h3>Rétractation</h3>
        <p className="small">Tu peux te rétracter jusqu'au ${fmtDY(addDays(String(o.at).slice(0, 10), 14))} inclus. Remboursement estimé : ${eur2(refundFor(o, data.plan, nowISO()))} (prorata du service déjà fourni).${o.offer === "lite" && o.mode === "abo" ? " Ton abonnement est arrêté en même temps." : ""}</p>
        <${Field} label="Nom et prénom" id="rt-n"><input id="rt-n" value=${form.name} onChange=${(e) => setForm({ ...form, name: e.target.value })} /></${Field}>
        <${Field} label="Contrat concerné"><input value=${"Commande " + o.id + " du " + fmtD(String(o.at).slice(0, 10))} readOnly /></${Field}>
        <${Field} label="E-mail pour l'accusé de réception" id="rt-e"><input id="rt-e" type="email" value=${form.email} onChange=${(e) => setForm({ ...form, email: e.target.value })} /></${Field}>
        <div className="actions"><${Btn} kind="danger" onClick=${confirm} disabled=${busy || form.name.trim().length < 2}>Confirmer la rétractation</${Btn}><${Btn} kind="quiet" onClick=${() => setWd(null)}>Annuler</${Btn}></div></div>` : null}
    </div>`; })}</${Card}>`;
}

/* ---------- abonnement Lite annuel : information avant reconduction (article L215-1) ---------- */
function liteNoticeText(plan, data, settings) {
  const L = legalInfo(settings), p = (data && data.profile) || {};
  const due = isoOf(new Date(plan.untilMs)), limit = isoOf(new Date(plan.untilMs - 86400000));
  return ["Ton abonnement Lite annuel sera reconduit le " + fmtDY(due), "",
    "Bonjour " + ((p.name || "").split(" ")[0] || "") + ",", "",
    "Ton abonnement Lite annuel (" + L.marque + ") arrive à échéance. Sans démarche de ta part, il sera reconduit tacitement pour un an le " + fmtDY(due) + ", au prix de " + eur2(litePrice(settings, "an", !!(plan.lite && plan.lite.nutri))) + ".", "",
    "┌─────────────────────────────────────────────┐",
    "  DATE LIMITE DE NON-RECONDUCTION : " + fmtDY(limit),
    "└─────────────────────────────────────────────┘", "",
    "Tu peux refuser cette reconduction gratuitement, sans justification, jusqu'à cette date : dans l'application, Profil › Mes commandes › « Résilier mon abonnement » (ou réponds simplement à cet e-mail). Ton accès reste ouvert jusqu'au " + fmtDY(isoOf(new Date(plan.untilMs - 1))) + " inclus.", "",
    "Information délivrée en application de l'article L215-1 du code de la consommation.", "",
    L.editeur + " — " + L.marque + (L.email ? " — " + L.email : "")].join("\n");
}
function LiteNotice({ plan, data, settings, src, demo }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const txt = liteNoticeText(plan, data, settings);
  const p = data.profile || {};
  const lines = txt.split("\n");
  const mail = "mailto:" + encodeURIComponent(p.email || "") + "?subject=" + encodeURIComponent(lines[0]) + "&body=" + encodeURIComponent(lines.slice(2).join("\n"));
  const sent = async () => {
    if (demo) { toast("Exemple : rien n'est enregistré.", "warn"); return; }
    setBusy(true);
    try { await src.setPlan({ ...plan, lite: { ...(plan.lite || {}), noticeFor: plan.untilMs, noticeAt: nowISO() }, updatedAt: nowISO() }); toast("Information de reconduction notée.", "ok"); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="alert warn"><div><b>Reconduction le ${fmtD(isoOf(new Date(plan.untilMs)))} : informe ${p.name || "le client"}</b>
    <p>La loi impose un e-mail dédié (ou une lettre nominative) envoyé 1 à 3 mois avant l'échéance, avec la date limite de non-reconduction dans un encadré. Sans cette information, le client peut résilier à tout moment après la reconduction et être remboursé du reste de l'année.</p>
    <div className="btnrow"><a className="btn primary sm" href=${mail}>Préparer l'e-mail</a><${Btn} small kind="ghost" onClick=${sent} disabled=${busy}>E-mail envoyé</${Btn}></div>
    <details className="small"><summary>Voir le message</summary><pre className="msgpre">${txt}</pre><${CopyBtn} text=${txt} /></details></div></div>`;
}

/* ---------- documents légaux ---------- */
/* hors français : rappel que seule la version française des textes juridiques fait foi */
const LEGAL_TR_NOTE = { en: "Translation provided for information only: only the French version is legally binding.", es: "Traducción facilitada a título informativo: solo la versión francesa tiene valor jurídico." };
function LegalDoc(props) {
  if (LANG === "fr") return html`<${LegalDocFr} ...${props} />`;
  return html`<div><p className="legal-note small" data-notr="1" lang=${LANG}>${LEGAL_TR_NOTE[LANG]}</p><${LegalDocFr} ...${props} /></div>`;
}
function LegalDocFr({ kind, settings }) {
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
      <li><b>Compte et contact</b> (nom, e-mail, téléphone, année de naissance, sport et poste) : créer ton compte, te suivre et adapter tes séances à ton sport. Base : exécution du contrat.</li>
      <li><b>Données de santé et d'entraînement</b> (questionnaire santé et précisions de tes réponses « oui », douleurs, taille, poids, mensurations, records et performances que tu déclares, tests, séances en salle et sur le terrain avec leurs chronos, forme du jour, repas, photo de profil facultative) : adapter et suivre ton programme en sécurité. Base : ton consentement explicite (article 9.2.a du RGPD), que tu peux retirer à tout moment.</li>
      <li><b>Santé au quotidien et montre connectée</b> (facultatif : sommeil, pas, calories actives et dépense totale, fréquence cardiaque au repos, variabilité cardiaque, poids, énergie, eau bue, test de sueur : poids avant et après une séance, boisson et durée ; résumé des activités importées : date, sport, durée, distance, fréquence cardiaque moyenne, effort ressenti) : repérer la fatigue, doser l'entraînement et ajuster tes apports à ta dépense réelle. Tu choisis ce que tu envoies (saisie, raccourci iPhone, application Android ou fichier exporté) et tu peux arrêter l'envoi automatique à tout moment : l'application ne se connecte pas à ton compte Apple Santé, Health Connect ou à celui de ta montre, et ne garde pas le tracé GPS. Base : ton consentement explicite.</li>
      <li><b>Vidéos d'exercice</b> : la vidéo reste sur ton appareil ; seules les images que tu gardes (3 au maximum, réduites) et tes repères sont enregistrés, pour la correction de ta technique. Base : ton consentement.</li>
      <li><b>Goûts et régime alimentaire</b> (aliments évités ou aimés, végétarien, sans gluten…) : te proposer des recettes adaptées. Base : exécution du contrat ; une allergie ou intolérance que tu indiques est traitée avec ton consentement explicite.</li>
      <li><b>Commandes, abonnements et paiements</b> (formule, montant, date, statut, identifiant d'abonnement Stripe, rétractation ou résiliation ; jamais tes coordonnées bancaires, gérées par Stripe) : gérer ta commande, tes prélèvements, ta facture, une rétractation ou une résiliation. Base : contrat et obligations comptables.</li>
      <li><b>Messages</b> échangés avec ${L.editeur} dans l'application (texte et photos que tu choisis d'envoyer) : répondre à tes questions et te suivre. Base : exécution du contrat ; une information de santé que tu y écris est traitée avec ton consentement explicite.</li>
      <li><b>Codes d'essai</b> : vérifier qu'un code n'est utilisé qu'une fois par personne. Base : contrat.</li>
      <li><b>Certificat médical</b> que tu envoies pour suspendre ou résilier une formule de 6 ou 12 mois (article 7 ter des conditions de vente) : traiter ta demande, puis il est supprimé une fois la demande traitée. Base : ton consentement explicite.</li></ul>
    <h3>Qui y accède</h3><p>Uniquement toi et ${L.editeur}. Prestataires techniques : ${window.IS_SITE ? "Google Firebase (comptes et base de données, Europe pour la base ; comptes possiblement aux États-Unis), GitHub (hébergement des pages), Stripe (paiement et abonnements), Cloudflare (relais de confirmation des paiements et des résiliations ; si tu actives l'envoi automatique depuis ton téléphone, tes valeurs du jour y attendent que ton application les récupère, au plus 14 jours, et sont effacées quand tu arrêtes l'envoi ; et coach IA s'il est activé : quand tu l'utilises, ton dossier, tes photos de repas et les images de tes vidéos sont traités par un modèle Gemma exécuté par Cloudflare Workers AI, qui ne les conserve pas après la réponse et ne les utilise pas pour entraîner de modèles), Open Food Facts (seul le code-barres scanné est envoyé)" : "Anthropic (hébergement de l'application et coach IA : ton dossier, tes photos de repas et les images de tes vidéos lui sont envoyés quand tu utilises le coach IA), Stripe (paiement et abonnements)"}. Les transferts hors de l'Union européenne reposent sur le cadre de protection des données UE–États-Unis et des clauses contractuelles types. Aucune donnée n'est vendue ni utilisée pour de la publicité.</p>
    <h3>Combien de temps</h3><p>Pendant ton accompagnement, puis 3 ans après ton dernier contact pour le suivi commercial ; les données de santé sont supprimées 3 mois après la fin de ton dernier programme si tu ne reprends pas. Factures : 10 ans (obligation légale).</p>
    <h3>Mineurs</h3><p>Avant 15 ans, l'inscription demande l'accord conjoint de l'enfant et d'un titulaire de l'autorité parentale (article 45 de la loi Informatique et Libertés). Avant 18 ans, la commande est passée par un parent.</p>
    <h3>Tes droits</h3><p>Accès, rectification, effacement, limitation, portabilité, opposition, retrait du consentement et directives après décès : écris à ${v(L.email)}. Tu peux aussi saisir la CNIL (cnil.fr).</p>
    <h3>Traceurs</h3><p>Aucun cookie publicitaire ni outil de mesure d'audience. Le stockage local du navigateur sert uniquement à garder ta session et tes préférences : il est exempté de consentement.</p>
    ${html`<h3>Coach IA</h3><p>${window.IS_SITE ? "S'il est activé, l" : "L"}e coach IA est une intelligence artificielle (${AI_WHO}). Ses réponses sont des repères d'entraînement, pas des avis médicaux ; ${L.editeur} voit vos échanges et peut corriger ses ajustements.</p>`}
  </div>`;
  return html`<div className="legal small">
    <p>Version du ${fmtDY(CGV_VERSION)}, applicable à toute commande passée à compter de cette date.</p>
    <h3>1. Vendeur</h3><p>${L.marque} — ${L.editeur}, ${L.statut}, SIRET ${v(L.siret)}, ${v(L.adresse)}, ${contact}. Éducateur sportif, carte professionnelle n° ${v(L.cartePro)}.</p>
    <h3>2. Services</h3><p>Accès à un programme de préparation physique en ligne (8 programmes, profils Reprise, Sportif, Performance et Haut niveau), avec l'adaptation des séances au sport et au poste, les séances terrain, une messagerie dans l'application pour écrire à ${L.editeur} (formules Essentiel, Suivi et Sur mesure ; Lite et Coach IA si ${L.editeur} l'a ouverte, sans délai de réponse garanti), les séances flash, les séances de récupération, les recettes et la santé au quotidien, et le niveau de suivi de la formule : Coach IA (programme et nutrition conduits par une intelligence artificielle : réponses aux questions, estimation des repas, analyse du bilan hebdomadaire et ajustements automatiques du programme dans des limites de sécurité, sans réponse personnelle de ${L.editeur}, qui reste prévenu en cas de douleur ou d'alerte), Essentiel (Coach IA, plus une réponse courte de ${L.editeur} à chaque bilan hebdomadaire sous 48 heures ouvrées et la messagerie), Suivi (Essentiel, plus une réponse détaillée à chaque bilan sous 24 heures ouvrées, l'ajustement du programme et des cibles nutritionnelles et la correction vidéo d'un exercice par semaine), Sur mesure (Suivi, plus un programme écrit par ${L.editeur} pour le sport, le poste et le calendrier de compétition du client, réécrit à chaque bloc, deux corrections vidéo par semaine et des réponses en priorité ; nombre de places limité), Lite (en autonomie : tous les programmes et contenus d'entraînement, sans nutrition, sans réponse personnelle aux bilans, sans correction vidéo par ${L.editeur} et sans coach IA) et Lite + Nutrition (Lite, plus l'objectif nutritionnel calculé, le journal des repas, les plats types, le scan des produits et le livre de recettes). Les jours ouvrés s'entendent du lundi au vendredi, hors jours fériés et congés annoncés dans l'application ; tout le suivi se fait par écrit, dans l'application. Le coach IA s'utilise dans une limite par jour propre à la formule : ${listeNoms(OFFERS.map((o) => { const q = aiQuota(settings, o.id); return o.n + " : " + plural(q.q, "question") + " et " + plural(q.ph, "photo"); }))} ; le compteur repart à zéro chaque jour à minuit, et l'analyse du bilan hebdomadaire ne compte pas. Ses réponses sont générées automatiquement et peuvent comporter des erreurs : ce sont des repères d'entraînement, pas des avis médicaux. Fonctionne sur un navigateur récent ou en application installée, avec une connexion internet pour la synchronisation.</p>
    <h3>3. Prix</h3><p>Prix indiqués en euros au moment de la commande. ${tvaLine(settings)}. Formules ${listeNoms(OFFERS.map((o) => o.n))} : paiement unique pour 1, 3, 6 ou 12 mois, sans abonnement ni renouvellement automatique. Forfait Lite : ${eur2(litePrice(settings, "mois"))} par mois ou ${eur2(litePrice(settings, "an"))} par an ; Lite + Nutrition : ${eur2(litePrice(settings, "mois", true))} par mois ou ${eur2(litePrice(settings, "an", true))} par an ; au choix en abonnement ou en paiement d'avance (article 7 bis).</p>
    <h3>4. Commande</h3><p>Tu choisis ton programme, ton profil, ta formule, ta durée et ta date de début, tu vérifies le récapitulatif, tu acceptes les présentes conditions puis tu valides avec le bouton « Commander avec obligation de paiement » (abonnement Lite : « S'abonner avec obligation de paiement »). Le récapitulatif de commande est téléchargeable dans « Mes commandes » ; Stripe t'envoie un reçu par e-mail à chaque paiement.</p>
    <h3>5. Paiement</h3><p>Paiement par carte via Stripe (paiement sécurisé, authentification forte), ou par un autre moyen convenu avec ${L.editeur}. L'accès s'active à la confirmation du paiement.</p>
    <h3>6. Codes d'essai et codes offerts</h3><p>Personnels, gratuits, utilisables une fois par personne dans la limite des conditions affichées (formule, durée, programme, date limite). Ils ne sont ni échangeables ni remboursables et ne se transforment jamais en commande payante sans nouvelle commande de ta part.</p>
    <h3>7. Durée de l'accès</h3><p>L'accès aux séances court de la date de début pendant la durée achetée. Ensuite, ton historique (séances, bilans, tests, carte athlète) reste consultable ; tu peux prolonger ou choisir un nouveau programme.</p>
    <p><b>Formules de 6 et 12 mois</b> : l'accès court de la date de début à la date de fin indiquée dans le récapitulatif. Les programmes de 12 semaines s'enchaînent pendant cette période : en Coach IA, Essentiel et Suivi, tu choisis ton programme suivant (${L.editeur} peut l'ajuster) ; en Sur mesure, ${L.editeur} l'écrit. Une nouvelle commande de la même formule et du même programme pendant un accès en cours le prolonge d'autant. Les corrections vidéo par ${L.editeur} se comptent sur 7 jours glissants : une en Suivi (et en Essentiel si ${L.editeur} l'a ouverte), deux en Sur mesure.</p>
    <h3>7 ter. Blessure ou contre-indication médicale (formules de 6 et 12 mois)</h3><p>Si une blessure ou une contre-indication médicale, attestée par un certificat médical, t'empêche de t'entraîner, tu peux demander par écrit (messagerie de l'application ou e-mail à ${v(L.email)}), à ton choix : la suspension de ton accompagnement, la date de fin étant repoussée de la durée de l'arrêt ; ou la résiliation, avec le remboursement de la période restante au prorata, sous 14 jours, avec le moyen de paiement utilisé. Le certificat sert uniquement à traiter ta demande.</p>
    <h3>7 bis. Forfait Lite</h3><p><b>Paiement d'avance</b> : un mois ou un an d'accès, payé en une fois, sans renouvellement automatique ; l'accès commence à la date choisie (au plus tard 60 jours après la commande) et peut être prolongé avant son terme.</p>
    <p><b>Abonnement mensuel</b> : contrat sans durée minimale, prélevé chaque mois à la date anniversaire de la souscription jusqu'à résiliation. Tu peux le résilier à tout moment ; la résiliation prend effet à la fin du mois déjà payé.</p>
    <p><b>Abonnement annuel</b> : contrat d'un an reconduit tacitement pour un an à chaque échéance, au prix en vigueur à la reconduction. Tu es informé par écrit, par e-mail dédié, au plus tôt trois mois et au plus tard un mois avant l'échéance, de la possibilité de ne pas reconduire le contrat, avec la date limite de non-reconduction. Tu peux le résilier à tout moment ; la résiliation prend effet à la fin de l'année en cours, sauf dans le cas prévu au deuxième alinéa de l'article L215-1 reproduit ci-dessous.</p>
    <p><b>Résiliation</b> : gratuite, en quelques clics, depuis « Mes commandes » (bouton « Résilier mon abonnement ») ${window.IS_SITE ? "ou depuis le lien « Résilier votre contrat » en bas de la page d'accueil du site, " : ""}ou par e-mail à ${v(L.email)}. Un accusé de réception indiquant la date de fin du contrat et ses effets t'est remis aussitôt. Tant que l'accès court, tu choisis toi-même ton programme suivant quand le tien est terminé. Un prélèvement refusé est représenté par Stripe pendant quelques jours ; sans paiement, l'abonnement s'arrête.</p>
    <p className="note">Reproduction des articles L215-1 à L215-3 et L241-3 du code de la consommation (article L215-4) :<br />
      <b>Article L215-1.</b> Pour les contrats de prestations de services conclus pour une durée déterminée avec une clause de reconduction tacite, le professionnel prestataire de services informe le consommateur par écrit, par lettre nominative ou courrier électronique dédiés, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat qu'il a conclu avec une clause de reconduction tacite. Cette information, délivrée dans des termes clairs et compréhensibles, mentionne, dans un encadré apparent, la date limite de non-reconduction.
      Lorsque cette information ne lui a pas été adressée conformément aux dispositions du premier alinéa, le consommateur peut mettre gratuitement un terme au contrat, à tout moment à compter de la date de reconduction.
      Les avances effectuées après la dernière date de reconduction ou, s'agissant des contrats à durée indéterminée, après la date de transformation du contrat initial à durée déterminée, sont dans ce cas remboursées dans un délai de trente jours à compter de la date de résiliation, déduction faite des sommes correspondant, jusqu'à celle-ci, à l'exécution du contrat.
      Les dispositions du présent article s'appliquent sans préjudice de celles qui soumettent légalement certains contrats à des règles particulières en ce qui concerne l'information du consommateur.
      Par exception au premier alinéa du présent article, pour les contrats de fourniture de service de télévision au sens de l'article 2 de la loi n° 86-1067 du 30 septembre 1986 relative à la liberté de communication et pour les contrats de fourniture de services de médias audiovisuels à la demande, le consommateur peut mettre gratuitement un terme au contrat, à tout moment à compter de la première reconduction, dès lors qu'il change de domicile ou que son foyer fiscal évolue.<br />
      <b>Article L215-2.</b> Les dispositions du présent chapitre, à l'exception de l'article L. 215-1-1, ne sont pas applicables aux exploitants des services d'eau potable et d'assainissement.<br />
      <b>Article L215-3.</b> Les dispositions du présent chapitre sont également applicables aux contrats conclus entre des professionnels et des non-professionnels.<br />
      <b>Article L241-3.</b> Lorsque le professionnel n'a pas procédé au remboursement dans les conditions prévues à l'article L. 215-1, les sommes dues sont productives d'intérêts au taux légal.</p>
    <h3>8. Droit de rétractation</h3><p>Tu disposes de 14 jours à compter de la commande pour te rétracter, sans motif, depuis « Mes commandes » (bouton « Renoncer au contrat ici »), ou par e-mail à ${v(L.email)} avec le formulaire ci-dessous. Un accusé de réception t'est remis aussitôt. Si tu as demandé que l'accompagnement commence avant la fin de ce délai, tu paies la part du service déjà fournie jusqu'à ta rétractation (article L221-25 du code de la consommation) ; le reste t'est remboursé sous 14 jours avec le moyen de paiement utilisé. Pour un abonnement, le délai court à compter de la souscription ; la rétractation arrête aussi les prélèvements. Les prélèvements suivants d'un abonnement en cours n'ouvrent pas de nouveau délai.</p>
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

/* ---------- forfait Lite : le client choisit son programme suivant tant que son accès court ---------- */
function LiteNextCycle({ data, src, db, uid, plan, onDone }) {
  const toast = useToast();
  const p = data.profile || {};
  const req = p.request || {};
  const age = ageOf(p);
  const rec = recommendNiveau(req.answers || {}, age, p.screeningFlag);
  const endISO = liteEnd(plan);
  const maxStart = [addDays(todayISO(), 28), endISO].sort()[0];
  const [f, setF] = useState(() => ({ programId: "", niveau: plan.niveau || rec.id, start: nextMonday() <= maxStart ? nextMonday() : todayISO(), equipment: plan.equipment || "salle", compDate: "" }));
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(!!(p.nextCycle && p.nextCycle.cycle === cycOf(plan) + 1));
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const prog = PB[f.programId];
  const checks = assessPlan({ programId: f.programId, niveau: f.niveau, ans: req.answers, sport: p.sport, age, equipment: f.equipment, screeningFlag: p.screeningFlag, prereqOk: !prog || !prog.prereq || (p.prereq || []).length >= prog.prereq.length, weeks: progWeeks(f.programId), compDate: f.compDate, start: f.start });
  const ok = !!prog && f.start >= todayISO() && f.start <= maxStart && !checks.some((c) => c.t === "bad");
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const nf = { programId: f.programId, niveau: f.niveau, start: f.start, equipment: prog.maison ? f.equipment : "salle", compDate: f.compDate || null };
    const next = liteNextCycle(plan, nf);
    try {
      if (window.IS_SITE && db && uid) await db.doc("plans/" + uid).set(clone(next));
      else await src.setPlan(next);
      toast("C'est parti : " + prog.n + " à partir du " + fmtDY(f.start) + ".", "ok");
      onDone && onDone();
    } catch (e) {
      /* écriture refusée (version sans règles client) : Antoine l'applique à l'ouverture de son espace */
      try { await src.setProfile({ ...p, nextCycle: { ...nf, cycle: cycOf(plan) + 1, at: nowISO() } }); setAsked(true); toast("Choix envoyé à Antoine : il s'applique à l'ouverture de son espace.", "ok"); }
      catch (e2) { toast("Enregistrement impossible : vérifie ta connexion.", "bad"); }
    } finally { setBusy(false); }
  };
  if (asked) return html`<div className="alert gold"><div><b>Programme suivant choisi</b><p>${PB[(p.nextCycle || {}).programId] ? PB[p.nextCycle.programId].n : "Ton choix"} à partir du ${fmtD((p.nextCycle || {}).start)} : il s'affiche dès qu'Antoine ouvre son espace.</p></div></div>`;
  return html`<div className="stack form">
    ${plan.offer === "lite" ? html`<p className="small">Ton accès Lite court jusqu'au ${fmtDY(endISO)} : choisis ton prochain programme de ${progWeeks(f.programId || plan.programId)} semaines. Ton historique reste consultable.</p>`
      : html`<p className="small">Ton accompagnement court jusqu'au ${fmtDY(endISO)} : choisis ton prochain programme de ${progWeeks(f.programId || plan.programId)} semaines. Antoine le voit et l'ajuste si besoin. Ton historique reste consultable.</p>`}
    <${Field} label="Programme" id="nc-prog"><select id="nc-prog" value=${f.programId} onChange=${(e) => set("programId", e.target.value)}><option value="">Choisir</option>${PROGS.map((x) => html`<option key=${x.id} value=${x.id}>${x.n}${x.id === plan.programId ? " (à nouveau)" : ""}</option>`)}</select></${Field}>
    <div className="field"><span className="field-l">Ton profil</span><${NiveauCards} value=${f.niveau} onChange=${(v) => set("niveau", v)} recommended=${rec.id} /></div>
    <div className="row2"><${Field} label="Début" id="nc-start" hint=${"Au plus tard le " + fmtDY(maxStart) + "."}><input id="nc-start" type="date" min=${todayISO()} max=${maxStart} value=${f.start} onChange=${(e) => set("start", e.target.value)} /></${Field}>
      ${prog && prog.maison ? html`<${Field} label="Lieu"><${Seg} options=${[{ v: "salle", n: "En salle" }, { v: "maison", n: "À la maison" }]} value=${f.equipment} onChange=${(v) => set("equipment", v)} /></${Field}>` : null}</div>
    ${nivRank(f.niveau) >= 2 ? html`<${Field} label="Prochaine compétition importante (facultatif)" id="nc-comp"><input id="nc-comp" type="date" value=${f.compDate} onChange=${(e) => set("compDate", e.target.value)} /></${Field}>` : null}
    ${prog ? html`<${Card} title="Vérification"><${FitChecks} checks=${checks} /></${Card}>` : null}
    <${Btn} block onClick=${go} disabled=${!ok || busy}>${busy ? "Un instant…" : "Démarrer ce programme"}</${Btn}>
  </div>`;
}
/* abonnement annuel : rappel dans l'application en plus de l'e-mail du coach */
function LiteBanner({ plan, data, onRenew, go }) {
  if (!plan || !plan.untilMs) return null;
  if (plan.offer !== "lite") {
    const left = Math.ceil((plan.untilMs - Date.now()) / 86400000), end = fmtD(liteEnd(plan));
    if (left <= 0) return html`<div className="alert warn"><div><b>Ton accompagnement s'est terminé le ${end}</b><p>Tes séances sont en pause ; ton historique, tes bilans et tes tests restent consultables. Reprends quand tu veux.</p></div>${onRenew ? html`<${Btn} small onClick=${onRenew}>Reprendre</${Btn}>` : null}</div>`;
    if (left <= 14) return html`<div className="alert gold"><div><b>Ton accompagnement se termine le ${end}</b><p>Paiement d'avance sans renouvellement automatique. Prolonge pour continuer sans coupure.</p></div>${onRenew ? html`<${Btn} small onClick=${onRenew}>Prolonger</${Btn}>` : null}</div>`;
    return null;
  }
  const c = liteCancelOf(data, plan), mode = plan.lite && plan.lite.mode;
  const left = Math.ceil((plan.untilMs - Date.now()) / 86400000);
  const end = fmtD(liteEnd(plan));
  if (Date.now() >= liteEndMs(plan, data)) return html`<div className="alert warn"><div><b>Ton accès Lite s'est terminé le ${end}</b><p>Tes séances sont en pause ; ton historique, tes bilans et tes tests restent consultables. Reprends quand tu veux.</p></div>${onRenew ? html`<${Btn} small onClick=${onRenew}>Reprendre</${Btn}>` : null}</div>`;
  if (mode === "abo" && !c && plan.lite.period === "an" && left <= 90 && left >= 0)
    return html`<div className="alert gold"><div><b>Reconduction de ton abonnement annuel le ${fmtD(isoOf(new Date(plan.untilMs)))}</b><p>Il sera reconduit pour un an. Pour l'arrêter, résilie-le d'ici là dans Profil › Mes commandes (gratuit, en quelques clics).</p></div>${go ? html`<${Btn} small kind="ghost" onClick=${() => go("profil")}>Mes commandes</${Btn}>` : null}</div>`;
  if ((mode !== "abo" || c) && left <= 7 && left >= 0)
    return html`<div className="alert gold"><div><b>Ton accès Lite se termine le ${end}</b><p>${c ? "Ton abonnement est résilié." : "Paiement d'avance sans renouvellement automatique."} Prolonge pour continuer sans coupure.</p></div>${onRenew ? html`<${Btn} small onClick=${onRenew}>Prolonger</${Btn}>` : null}</div>`;
  return null;
}
