/* ===== Nutrition : objectif, journal, photo de repas, scan de produit ===== */
const SLOTS = [{ id: "matin", n: "Petit-déjeuner" }, { id: "midi", n: "Déjeuner" }, { id: "collation", n: "Collation" }, { id: "soir", n: "Dîner" }];
function slotName(id) { const s = SLOTS.find((x) => x.id === id); return s ? s.n : "Repas"; }
function slotNow() { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? "matin" : h < 15 ? "midi" : h < 18.5 ? "collation" : "soir"; }
const ACT = [
  { v: 1.2, n: "Sédentaire", d: "Travail assis, moins de 5 000 pas par jour" },
  { v: 1.35, n: "Peu active", d: "5 000 à 7 500 pas par jour" },
  { v: 1.5, n: "Active", d: "7 500 à 10 000 pas ou métier debout" },
  { v: 1.65, n: "Très active", d: "Métier physique ou plus de 10 000 pas" },
];
const NUTRI_REFS = [
  "Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.",
  "Hall KD, Sacks G, Chandramohan D, et al. Quantification of the effect of energy imbalance on bodyweight. Lancet. 2011;378(9793):826-837.",
  "Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.",
  "Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.",
  "Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports. 2019;7(7):154.",
  "Burke LE, Wang J, Sevick MA. Self-monitoring in weight loss: a systematic review of the literature. J Am Diet Assoc. 2011;111(1):92-102.",
  "Anses. " + ((CONTENT.CIQ && CONTENT.CIQ.v) || "2025") + ". Table de composition nutritionnelle des aliments Ciqual. https://ciqual.anses.fr",
  "Westerterp KR. Diet induced thermogenesis. Nutr Metab (Lond). 2004;1(1):5.",
  "Ainsworth BE, Haskell WL, Herrmann SD, et al. 2011 Compendium of Physical Activities: a second update of codes and MET values. Med Sci Sports Exerc. 2011;43(8):1575-1581.",
  "Fuller D, Colwell E, Low J, et al. Reliability and validity of commercially available wearable devices for measuring steps, energy expenditure, and heart rate: systematic review. JMIR Mhealth Uhealth. 2020;8(9):e18694.",
  "Amoutzopoulos B, Page P, Roberts C, et al. Portion size estimation in dietary assessment: a systematic review of existing tools, their strengths and limitations. Nutr Rev. 2020;78(11):885-900.",
  "Règlement (CE) n° 589/2008 de la Commission du 23 juin 2008 (normes de commercialisation des œufs), article 4 : catégories de poids (M : 53 à 63 g).",
];
const VERDICT = { bon: { n: "Bon choix", t: "ok" }, correct: { n: "Correct", t: "gold" }, a_ameliorer: { n: "À améliorer", t: "warn" }, occasionnel: { n: "Occasionnel", t: "gold" }, a_limiter: { n: "À limiter", t: "warn" } };
const r10 = (v) => Math.round(v / 10) * 10;

/* ---------- calcul de l'objectif ---------- */
function nutriCalc(f, sessions) {
  const w = num(f.weight), h = num(f.height), a = num(f.age);
  if (!w || !h || !a || w < 30 || w > 300 || h < 120 || h > 230 || a < 14 || a > 100) return { error: "Renseigne ton âge, ta taille (cm) et ton poids (kg)." };
  const sex = f.sex === "F" ? "F" : "H";
  const hm = h / 100;
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === "F" ? -161 : 5);
  const act = num(f.act) || 1.35;
  const train = (sessions ?? 3) * 4 * w / 7; // ≈ 4 MET nets pendant 1 h par séance
  const tdee = bmr * act + train;
  const floor = sex === "F" ? 1200 : 1500;
  const bmi = w / (hm * hm);
  const refW = Math.min(w, 25 * hm * hm);
  const goal = f.goal || "maintien";
  const delta = goal === "maintien" ? 0 : Math.abs(num(f.delta) || 0);
  const weeks = clamp(num(f.weeks) || 12, 2, 52);
  let kcal = tdee, status = "ok", msg = "", target = w, suggestWeeks = null, weeksReal = null;
  if (goal === "perte" && delta > 0) {
    target = w - delta;
    const minW = Math.ceil(18.5 * hm * hm * 10) / 10;
    if (target < minW) return { error: "Ce poids visé est trop bas pour ta taille (indice de masse corporelle sous 18,5). Vise au plus " + fmtN(w - minW, 1) + " kg de perte." };
    const need = delta * 7700 / (weeks * 7);
    const cap = Math.max(0, Math.min(0.25 * tdee, 1000, tdee - floor));
    const ratePct = delta / weeks / w;
    status = need <= 0.2 * tdee && ratePct <= 0.0075 ? "ok" : need <= cap && ratePct <= 0.01 ? "ambitieux" : "rapide";
    kcal = Math.max(floor, tdee - Math.min(need, cap));
    const realDef = tdee - kcal;
    weeksReal = realDef > 0 ? delta * 7700 / (realDef * 7) : null;
    if (status === "rapide") suggestWeeks = Math.ceil(Math.max(delta * 7700 / (Math.max(1, Math.min(0.2 * tdee, cap)) * 7), delta / (0.0075 * w)));
  } else if (goal === "prise" && delta > 0) {
    target = w + delta;
    const need = delta * 7700 / (weeks * 7);
    const cap = Math.min(0.15 * tdee, 500);
    const ratePct = delta / weeks / w;
    status = ratePct <= 0.0035 ? "ok" : ratePct <= 0.005 ? "ambitieux" : "rapide";
    kcal = tdee + Math.min(need, cap);
    weeksReal = delta * 7700 / (Math.min(need, cap) * 7);
    if (status === "rapide") suggestWeeks = Math.ceil(delta / (0.0035 * w));
  }
  kcal = r10(Math.max(floor, kcal));
  const p = Math.round(refW * (goal === "maintien" ? 1.6 : 1.8));
  const fat = Math.round(Math.max(0.8 * refW, (kcal * 0.28) / 9));
  const c = Math.max(0, Math.round((kcal - p * 4 - fat * 9) / 4));
  const base = { 1.2: 4000, 1.35: 6000, 1.5: 8500, 1.65: 11000 }[act] || 6000;
  const steps = r10(goal === "perte" ? Math.min(12000, Math.max(7000, base + 2000)) : Math.max(6000, base)) ;
  const water = clamp(Math.round(w * 0.033 * 10) / 10, 1.5, 3.5);
  const rate = goal === "maintien" ? 0 : (goal === "perte" ? -1 : 1) * Math.abs(kcal - tdee) * 7 / 7700; // kg par semaine
  return { sex, bmr: Math.round(bmr), tdee: Math.round(tdee), floor, bmi, refW: Math.round(refW * 10) / 10, target: Math.round(target * 10) / 10, status, msg, suggestWeeks, weeksReal,
    rate: Math.round(rate * 100) / 100, targets: { kcal, p, c, f: fat, steps, water } };
}
function safeTargets(np, req) {
  const notes = [];
  const t0 = np.targets || {};
  const refW = np.refW || np.weight0 || 70;
  const kMin = Math.ceil(Math.max(np.floor || 1500, (np.tdee || 2000) * 0.75) / 10) * 10, kMax = Math.floor((np.tdee || 2000) * 1.2 / 10) * 10;
  let kcal = req.kcal ?? t0.kcal;
  if (kcal < kMin) { notes.push("calories relevées à " + fmtN(kMin, 0) + " kcal (minimum de sécurité)"); kcal = kMin; }
  if (kcal > kMax) { notes.push("calories ramenées à " + fmtN(kMax, 0) + " kcal"); kcal = kMax; }
  kcal = r10(kcal);
  let p = req.p ?? t0.p; const pMin = Math.round(1.2 * refW), pMax = Math.round(2.4 * refW);
  if (p < pMin) { notes.push("protéines relevées à " + pMin + " g"); p = pMin; }
  if (p > pMax) { notes.push("protéines ramenées à " + pMax + " g"); p = pMax; }
  let f = req.f ?? t0.f; const fMin = Math.round(0.6 * refW);
  if (f < fMin) { notes.push("lipides relevés à " + fMin + " g"); f = fMin; }
  let c = req.c ?? Math.round((kcal - p * 4 - f * 9) / 4);
  const sum = p * 4 + f * 9 + c * 4;
  if (Math.abs(sum - kcal) > 60) { c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4)); notes.push("glucides recalculés pour respecter les calories"); }
  if (c < 50) { f = Math.max(fMin, Math.round((kcal - p * 4 - 50 * 4) / 9)); c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4)); notes.push("répartition corrigée pour garder au moins 50 g de glucides"); }
  let steps = req.steps ?? t0.steps ?? 7000;
  steps = r10(clamp(steps, 3000, 15000));
  return { t: { kcal, p: Math.round(p), c: Math.round(c), f: Math.round(f), steps, water: t0.water }, notes };
}
/* ---------- dépense énergétique du jour ----------
   métabolisme de base (Mifflin-St Jeor) + calories actives de la montre ou du téléphone (sinon : pas, séances et activités
   notées, en MET nets d'après Ainsworth 2011) ; l'effet thermique des repas compte pour environ 10 % (Westerterp, 2004).
   Les montres se trompent souvent de 20 % ou plus sur la dépense (Fuller, 2020) : seule la moitié du surplus d'activité
   s'ajoute à la cible du jour, au plus 400 kcal, et jamais de baisse. */
const TEF = 0.1;
const MET_ACT = { course: 8, "vélo": 6, natation: 6, marche: 2.5, match: 7, autre: 5 };
function npWeight(data, np) { const lw = lastWeight(data); return (lw && lw.v) || (np && np.weight0) || 70; }
function dayEnergy(data, np, d) {
  if (!np || np.mode === "equilibre" || !num(np.bmr) || !num(np.tdee)) return null;
  const s = (data.sante && data.sante[d]) || {};
  const w = npWeight(data, np);
  const steps = num(s.pas), kAct = num(s.kcal), kTot = num(s.kcalTot);
  let act = null, src = null;
  if (kAct !== null) { act = kAct; src = "montre"; }
  else if (kTot !== null && kTot > np.bmr) { act = kTot - np.bmr; src = "montre"; }
  else if (steps !== null) {
    act = steps * 0.0004 * w; src = "pas";
    Object.values(data.logs || {}).forEach((l) => { if (l && l.date === d) act += 4 * w * (clamp(num(l.duree) || 60, 10, 240) / 60); });
    Object.values(data.activites || {}).forEach((a) => { if (a && a.d === d) act += (MET_ACT[a.type] || 5) * w * (clamp(num(a.duree) || 0, 0, 600) / 60); });
  }
  const planned = Math.round(np.tdee);
  if (act === null) return { steps, act: null, src: null, total: null, planned, bonus: 0, bmr: np.bmr };
  const total = (np.bmr + act) / (1 - TEF);
  const bonus = np.actBonus === false ? 0 : clamp(r10(0.5 * (total - planned)), 0, 400);
  return { steps, act: Math.round(act), src, total: Math.round(total), planned, bonus, bmr: np.bmr };
}
/* cibles du jour : le bonus d'activité s'ajoute en glucides */
function dayTargets(np, en) { const t = (np && np.targets) || {}; const b = (en && en.bonus) || 0; return b ? { ...t, kcal: t.kcal + b, c: (t.c || 0) + Math.round(b / 4) } : t; }
function energyAvg(data, np, n) {
  const xs = Array.from({ length: n }, (_, i) => dayEnergy(data, np, addDays(todayISO(), -i - 1))).filter((e) => e && e.total);
  if (!xs.length) return null;
  const st = xs.filter((e) => e.steps !== null);
  return { n: xs.length, total: Math.round(xs.reduce((s, e) => s + e.total, 0) / xs.length), montre: xs.filter((e) => e.src === "montre").length, steps: st.length ? Math.round(st.reduce((s, e) => s + e.steps, 0) / st.length) : null };
}
function nutriGoalText(np) {
  if (!np) return "";
  if (np.goal === "maintien") return "garder son poids et ses performances";
  const verb = np.goal === "perte" ? "perdre " : "prendre ";
  return verb + fmtN(np.delta, 1) + " kg en " + plural(np.weeks, "semaine") + " (de " + fmtN(np.weight0, 1) + " à " + fmtN(np.target, 1) + " kg), départ le " + fmtD(np.start);
}
function expectedWeight(np, date) {
  if (!np || np.mode === "equilibre" || !np.start || !np.weight0 || np.goal === "maintien") return null;
  const d = Math.max(0, diffDays(np.start, date));
  const v = np.weight0 + (np.rate || 0) * d / 7;
  return np.goal === "perte" ? Math.max(np.target, v) : Math.min(np.target, v);
}
/* poids noté dans le profil (inscription ou « Mon profil sportif ») */
function profWeight(data) { const p = data && data.profile; return p && num(p.weight) ? { d: String(p.weightAt || p.createdAt || "").slice(0, 10), v: num(p.weight) } : null; }
function lastWeight(data) {
  const pts = [];
  const pw = profWeight(data); if (pw && pw.d) pts.push(pw);
  Object.values(data.checkins || {}).forEach((c) => { if (c && num(c.poids) !== null) pts.push({ d: String(c.at || "").slice(0, 10), v: num(c.poids) }); });
  Object.values(data.tests || {}).forEach((t) => { if (t && t.values && num(t.values.poids) !== null) pts.push({ d: String(t.at || "").slice(0, 10), v: num(t.values.poids) }); });
  pts.sort((a, b) => a.d.localeCompare(b.d));
  return pts.length ? pts[pts.length - 1] : null;
}
function weightPoints(data) {
  const pts = [];
  const pw = profWeight(data); if (pw && pw.d) pts.push(pw);
  Object.values(data.checkins || {}).forEach((c) => { if (c && num(c.poids) !== null) pts.push({ d: String(c.at || "").slice(0, 10), v: num(c.poids) }); });
  Object.values(data.tests || {}).forEach((t) => { if (t && t.values && num(t.values.poids) !== null) pts.push({ d: String(t.at || "").slice(0, 10), v: num(t.values.poids) }); });
  const by = {}; pts.forEach((p) => { if (p.d) by[p.d] = p.v; });
  return Object.entries(by).map(([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d));
}

/* ---------- repas ---------- */
function mkItem(x) {
  const g = Math.max(0, num(x.g) || 0);
  const it = { n: String(x.n || "Aliment").slice(0, 80), g, kcal: Math.max(0, num(x.kcal) || 0), p: Math.max(0, num(x.p) || 0), c: Math.max(0, num(x.c) || 0), f: Math.max(0, num(x.f) || 0) };
  it.k100 = g ? { kcal: it.kcal / g * 100, p: it.p / g * 100, c: it.c / g * 100, f: it.f / g * 100 } : null;
  return it;
}
function scaleItem(it, g) {
  const gg = Math.max(0, num(g) || 0);
  if (!it.k100) return { ...it, g: gg };
  return { ...it, g: gg, kcal: it.k100.kcal * gg / 100, p: it.k100.p * gg / 100, c: it.k100.c * gg / 100, f: it.k100.f * gg / 100 };
}
function sumItems(items) { return (items || []).reduce((s, x) => ({ kcal: s.kcal + (x.kcal || 0), p: s.p + (x.p || 0), c: s.c + (x.c || 0), f: s.f + (x.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 }); }
function dayTotals(day) { return sumItems((day && day.meals) || []); }
function dayVerdict(np, tot, nMeals, isToday) {
  if (!np || np.mode === "equilibre" || !np.targets) return null;
  if (!nMeals) return { t: "muted", n: "Rien de noté pour l'instant", d: "Ajoute ton premier repas : une photo suffit." };
  const r = tot.kcal / (np.targets.kcal || 1);
  const h = new Date().getHours();
  const pOk = tot.p >= 0.9 * (np.targets.p || 0);
  if (r < 0.6 && (!isToday || h >= 19)) return { t: "warn", n: "Journée très légère", d: "Tu as peu mangé : un vrai repas ou une collation protéinée t'aidera à récupérer et à garder ton muscle." };
  if (r <= 1.1 && r >= 0.9) return { t: "ok", n: "Dans ta cible", d: pOk ? "Calories et protéines au rendez-vous : parfait." : "Calories dans la cible ; ajoute une source de protéines pour atteindre ton objectif." };
  if (r > 1.25) return { t: "warn", n: "Au-dessus de ta cible", d: "Une journée ne change rien : regarde ce qui a fait monter (boissons, sauces, grignotage) et garde ton rythme habituel demain." };
  if (r > 1.1) return { t: "gold", n: "Un peu au-dessus", d: "Rien de grave : garde ton rythme habituel demain." };
  return { t: "muted", n: "Journée en cours", d: "Il te reste environ " + fmtN(Math.max(0, np.targets.kcal - tot.kcal), 0) + " kcal et " + fmtN(Math.max(0, np.targets.p - tot.p), 0) + " g de protéines." };
}
function nutriShort(np, tot) {
  if (!np) return "Le client n'a pas encore défini d'objectif nutrition.";
  if (np.mode === "equilibre") return "Mode « équilibre » : ne donne aucun chiffre de calories, de macros ni de poids ; parle d'assiette équilibrée.";
  const t = np.targets;
  return "Objectif : " + nutriGoalText(np) + ". Cibles du jour : " + fmtN(t.kcal, 0) + " kcal, protéines " + fmtN(t.p, 0) + " g, glucides " + fmtN(t.c, 0) + " g, lipides " + fmtN(t.f, 0) + " g. Déjà consommé aujourd'hui : " + fmtN(tot.kcal, 0) + " kcal, protéines " + fmtN(tot.p, 0) + " g." + (np.prefs ? " Préférences : " + np.prefs + "." : "");
}

/* ---------- code-barres ---------- */
const ZXING_URL = window.__ZXING_URL || "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
let _zx = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!_zx) _zx = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = ZXING_URL; s.async = true;
    s.onload = () => (window.ZXing ? res(window.ZXing) : rej(new Error("zxing")));
    s.onerror = () => { _zx = null; rej(new Error("zxing")); };
    document.head.appendChild(s);
  });
  return _zx;
}
async function fileToCanvas(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
    c.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
function rotCanvas(c) { const r = document.createElement("canvas"); r.width = c.height; r.height = c.width; const x = r.getContext("2d", { willReadFrequently: true }); x.translate(r.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0); return r; }
function normEan(s) { const d = String(s || "").replace(/\D/g, ""); if (d.length === 12) return "0" + d; return d.length === 8 || d.length === 13 ? d : null; }
async function decodeBarcode(file) {
  let canvas;
  try { canvas = await fileToCanvas(file, 1600); } catch (e) { return null; }
  try {
    if ("BarcodeDetector" in window) {
      const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      const r = await det.detect(canvas);
      if (r && r[0] && r[0].rawValue) { const e = normEan(r[0].rawValue); if (e) return e; }
    }
  } catch (e) {}
  try {
    const Z = await loadZXing();
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader(); reader.setHints(hints);
    for (const cv of [canvas, rotCanvas(canvas)]) {
      try { const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv))); const r = reader.decode(bmp); const e = r && normEan(r.getText()); if (e) return e; } catch (e) {}
    }
  } catch (e) {}
  return null;
}
const PROD_KEY = "app_products_v1";
/* aliments courants : [nom, kcal, protéines, glucides, lipides pour 100 g (ou 100 ml), portion habituelle en g, code Ciqual]
   valeurs de la table Ciqual de l'ANSES (content_nutri.py), relues dans la table à son chargement */
const FOODS = CONTENT.FOODS || [];
function normTxt(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function foodItem(fd, g) { const q = g || fd[5]; const it = mkItem({ n: fd[0].replace(/\s*\(.*\)$/, ""), g: q, kcal: fd[1] * q / 100, p: fd[2] * q / 100, c: fd[3] * q / 100, f: fd[4] * q / 100 }); return fd[6] ? { ...it, ciq: fd[6] } : it; }
/* ---------- plats types (portion habituelle, valeurs de la table Ciqual) ---------- */
const PLATS = CONTENT.PLATS || [];
const PLAT_CATS = [{ v: "idees", n: "Idées pour ce repas" }, { v: "matin", n: "Petit-déjeuner" }, { v: "sport", n: "Assiettes du sportif" }, { v: "plat", n: "Plats du quotidien" }, { v: "pouce", n: "Sur le pouce" }, { v: "collation", n: "Collations" }];
const PLAT_SLOT = { matin: ["matin"], collation: ["collation"], midi: ["sport", "plat", "pouce"], soir: ["sport", "plat", "pouce"] };
const SLOT_SHARE = { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 };
function platItems(p) { return (p.i || []).map((fd) => foodItem(fd)); }
function platTot(p) { return sumItems(platItems(p)); }
/* idées pour ce repas : les plats du moment de la journée qui se rapprochent le plus de la part de calories qu'il reste
   pour ce repas, avec assez de protéines */
function platIdeas(slot, np, tot, n) {
  const pool = PLATS.filter((p) => (PLAT_SLOT[slot] || []).includes(p.cat));
  if (!np || np.mode === "equilibre" || !np.targets) return { list: pool.slice(0, n), ideal: null };
  const t = np.targets, i0 = Math.max(0, SLOTS.findIndex((s) => s.id === slot));
  const share = SLOT_SHARE[slot] || 0.3, rest = SLOTS.slice(i0).reduce((s, x) => s + (SLOT_SHARE[x.id] || 0), 0) || share;
  /* jamais plus de 1,25 fois la part habituelle de ce repas, même s'il reste beaucoup de calories */
  const ideal = clamp(Math.min(Math.max(0, (t.kcal || 0) - tot.kcal) * share / rest, (t.kcal || 0) * share * 1.25), 120, 1500);
  const pIdeal = Math.max(8, ((t.p || 0) - tot.p) * share / rest);
  /* la restauration rapide passe après les assiettes faites maison à valeurs égales */
  const sc = pool.map((p) => { const x = platTot(p); return { p, s: Math.abs(x.kcal - ideal) / ideal + 0.6 * Math.max(0, (pIdeal - x.p) / pIdeal) + (p.cat === "pouce" ? 0.2 : 0) }; });
  sc.sort((a, b) => a.s - b.s);
  return { list: sc.slice(0, n).map((x) => x.p), ideal: Math.round(ideal / 10) * 10 };
}
function PlatPicker({ slot, np, tot, onPick }) {
  const eq = !np || np.mode === "equilibre";
  const [cat, setCat] = useState("idees");
  useCiqual();
  const id = platIdeas(slot, np, tot, 6);
  const list = cat === "idees" ? id.list : PLATS.filter((p) => p.cat === cat);
  return html`<div className="stack-s plats">
    <div className="field-l">Plats types</div>
    <div className="tabs-scroll"><${Seg} options=${PLAT_CATS} value=${cat} onChange=${setCat} /></div>
    ${cat === "idees" && id.ideal ? html`<p className="muted small">Pour ce repas, vise environ <b>${fmtN(id.ideal, 0)} kcal</b> : voici les plats qui s'en rapprochent le plus.</p>` : null}
    <div className="sugg plat-list">${list.map((p) => { const x = platTot(p); return html`<button key=${p.n} type="button" onClick=${() => onPick(p)}><b>${p.n}</b>
      <span className="muted small">${eq ? (p.i || []).map((fd) => fd[0].replace(/\s*\(.*\)$/, "")).join(" · ") : fmtN(x.kcal, 0) + " kcal · P " + fmtN(x.p, 0) + " g · G " + fmtN(x.c, 0) + " g · L " + fmtN(x.f, 0) + " g"}</span></button>`; })}</div>
    <p className="muted small">${eq ? "Touche un plat pour l'ajouter, puis ajuste les quantités." : "Portion habituelle ; touche un plat pour l'ajouter, puis ajuste les grammes de chaque élément. Valeurs de la table Ciqual de l'ANSES."}</p>
  </div>`;
}
function FoodPicker({ onPick, eq }) {
  const t = useCiqual();
  const [q, setQ] = useState("");
  const qq = q.trim();
  const chunks = qq.length >= 2 ? quickChunks(qq).map(quickParse1) : [];
  const one = chunks.length === 1 ? chunks[0] : null;
  /* une phrase avec des quantités ou plusieurs aliments : « 2 tranches de brioche, un œuf et du beurre de cacahuète » */
  const phrase = chunks.length > 1 || !!(one && (one.q !== null || one.unit.length || one.size.length));
  const got = phrase ? chunks.map((c) => ({ c, it: quickItem(c) })) : [];
  const items = got.map((x) => x.it).filter(Boolean);
  const sq = one ? one.food.join(" ") : "", nq = ciqNorm(sq);
  const qf = sq.length >= 2 ? quickFood(one.food) : null;
  const cur = sq.length >= 2 ? (qf && qf.fd ? [qf.fd] : []).concat(FOODS.filter((f) => ciqNorm(f[0]).includes(nq) && !(qf && qf.fd === f))).slice(0, 5) : [];
  const codes = new Set(cur.map((f) => f[6]).filter(Boolean));
  const more = t && sq.length >= 2 ? (qf && qf.r ? [qf.r] : []).concat(ciqSearch(sq, 10).filter((r) => !(qf && qf.r === r))).filter((r) => !codes.has(r.code)).slice(0, 6) : [];
  const pick = (f) => { onPick(quickMake(f, one && phrase ? one : { q: null, gUnit: 0, unit: [], size: [] })); setQ(""); };
  const hint = (f) => { const it = quickMake(f, one && phrase ? one : { q: null, gUnit: 0, unit: [], size: [] }); return eq ? qtyText(it) : qtyText(it) + " ≈ " + fmtN(it.g, 0) + " " + pUnit(itemPortions(it)) + " · " + fmtN(it.kcal, 0) + " kcal"; };
  return html`<div className="stack-s"><${Field} label="Ajouter des aliments" id="fd-q" hint="Tape un aliment, ou tout ton repas avec les quantités : « 2 tranches de pain, 1 œuf, 1 c. à soupe de beurre de cacahuète »"><input id="fd-q" value=${q} onChange=${(e) => setQ(e.target.value)} placeholder="Ex. 2 tranches de brioche, un œuf…" autoComplete="off" /></${Field}>
    ${phrase && got.length ? html`<div className="quick" aria-live="polite"><div className="field-l">J'ai compris :</div>
      ${got.map((x, i) => x.it ? html`<div key=${i} className="quick-r"><span><b>${qtyText(x.it)}</b> ${x.it.n}</span>${eq ? null : html`<span className="muted small">${fmtN(x.it.g, 0)} ${pUnit(itemPortions(x.it))} · ${fmtN(x.it.kcal, 0)} kcal</span>`}</div>`
        : html`<div key=${i} className="quick-r miss"><span>« ${x.c.raw} »</span><span className="small">${t || !window.IS_SITE ? "pas trouvé : écris-le autrement" : "recherche…"}</span></div>`)}
      ${items.length ? html`<${Btn} small onClick=${() => { onPick(items); setQ(""); }}>${items.length > 1 ? "Ajouter ces " + items.length + " aliments" : "Ajouter cet aliment"}</${Btn}>` : null}
      <p className="muted small">Tu pourras changer chaque quantité juste après.</p></div>` : null}
    ${!phrase || chunks.length === 1 ? (cur.length || more.length ? html`<div className="sugg">${cur.map((f) => html`<button key=${f[0]} type="button" onClick=${() => pick({ fd: f })}><b>${f[0]}</b><span className="muted small pl">${hint({ fd: f })}</span></button>`)}
      ${more.map((r) => html`<button key=${"c" + r.code} type="button" onClick=${() => pick({ r })}><b>${r.nom}</b><span className="muted small pl">${hint({ r })}</span></button>`)}</div>`
      : sq.length >= 2 && !phrase ? html`<p className="muted small">${t || !window.IS_SITE ? "Pas trouvé dans la table de l'ANSES : essaie un autre mot, ou saisis-le plus bas." : "Recherche dans la table de l'ANSES…"}</p>` : null) : null}</div>`;
}
const VERDICT_NS = { A: "bon", B: "bon", C: "correct", D: "occasionnel", E: "a_limiter" };
/* Open Food Facts (base collaborative, licence ODbL) : uniquement sur le site, où le réseau est ouvert */
async function offLookup(ean) {
  if (!window.IS_SITE || !ean || typeof fetch !== "function") return null;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(ean) + ".json?fields=product_name,product_name_fr,brands,nutriments,nutriscore_grade,serving_quantity", { signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.status !== 1 || !j.product) return null;
    const pr = j.product, nu = pr.nutriments || {};
    const g = (k) => num(nu[k + "_100g"]);
    let kcal = g("energy-kcal"); if (kcal === null && g("energy") !== null) kcal = Math.round(g("energy") / 4.184);
    if (kcal === null) return null;
    const ns = String(pr.nutriscore_grade || "").toUpperCase();
    const nsOk = /^[A-E]$/.test(ns) ? ns : null;
    return { ean, n: String(pr.product_name_fr || pr.product_name || "Produit").slice(0, 80), brand: String(pr.brands || "").split(",")[0].trim().slice(0, 60),
      per100: { kcal, p: g("proteins"), c: g("carbohydrates"), f: g("fat"), sucres: g("sugars"), fibres: g("fiber"), sel: g("salt") }, ok: true, estime: false, lisible: true,
      portion: Math.round(num(pr.serving_quantity) || 100), nutriscore: nsOk, verdict: nsOk ? VERDICT_NS[nsOk] : null, comment: "", alt: "", at: nowISO(), source: "off" };
  } catch (e) { return null; } finally { clearTimeout(tm); }
}
function ProductForm({ ean, eq, onSave }) {
  const [m, setM] = useState({ n: "", brand: "", kcal: "", p: "", c: "", f: "", portion: "" });
  const set = (k, v) => setM((o) => ({ ...o, [k]: v }));
  const ok = m.n.trim().length > 1 && (eq || num(m.kcal) !== null);
  const save = () => onSave({ ean: ean || null, n: m.n.trim().slice(0, 80), brand: m.brand.trim().slice(0, 60), per100: { kcal: eq ? null : num(m.kcal), p: num(m.p), c: num(m.c), f: num(m.f), sucres: null, fibres: null, sel: null },
    ok: !eq, estime: false, lisible: true, portion: num(m.portion) || 100, nutriscore: null, verdict: null, comment: "", alt: "", at: nowISO(), source: "manuel" });
  return html`<div className="form">
    <div className="row2"><${Field} label="Produit" id="pf-n"><input id="pf-n" value=${m.n} onChange=${(e) => set("n", e.target.value)} placeholder="Ex. Skyr nature" /></${Field}>
      <${Field} label="Marque (facultatif)" id="pf-b"><input id="pf-b" value=${m.brand} onChange=${(e) => set("brand", e.target.value)} /></${Field}></div>
    ${eq ? null : html`<p className="muted small">Recopie le tableau nutritionnel du paquet, colonne « pour 100 g ».</p>
    <div className="row4"><${Field} label="kcal / 100 g" id="pf-k"><input id="pf-k" inputMode="decimal" value=${m.kcal} onChange=${(e) => set("kcal", e.target.value)} /></${Field}>
      <${Field} label="Protéines" id="pf-p"><input id="pf-p" inputMode="decimal" value=${m.p} onChange=${(e) => set("p", e.target.value)} /></${Field}>
      <${Field} label="Glucides" id="pf-c"><input id="pf-c" inputMode="decimal" value=${m.c} onChange=${(e) => set("c", e.target.value)} /></${Field}>
      <${Field} label="Lipides" id="pf-f"><input id="pf-f" inputMode="decimal" value=${m.f} onChange=${(e) => set("f", e.target.value)} /></${Field}></div>
    <${Field} label="Portion habituelle (g)" id="pf-po"><input id="pf-po" inputMode="decimal" value=${m.portion} onChange=${(e) => set("portion", e.target.value)} placeholder="100" /></${Field}>`}
    <${Btn} onClick=${save} disabled=${!ok}>Valider le produit</${Btn}>
    ${ean && !eq ? html`<p className="muted small">Le produit sera reconnu directement au prochain scan, par toi comme par les autres clients.</p>` : null}
  </div>`;
}
async function findProduct(db, ean) {
  if (!ean) return null;
  const loc = lsGet(PROD_KEY) || {};
  if (loc[ean]) return loc[ean];
  if (db) { try { const s = await db.doc("products/" + ean).get(); if (s.exists) { const p = s.data(); lsSet(PROD_KEY, { ...loc, [ean]: p }); return p; } } catch (e) {} }
  return null;
}
async function rememberProduct(db, ean, p) {
  if (!ean) return;
  const loc = lsGet(PROD_KEY) || {};
  lsSet(PROD_KEY, { ...loc, [ean]: p });
  if (db) { try { await db.doc("products/" + ean).set(clone(p)); } catch (e) {} }
}

/* ---------- petits composants ---------- */
function PhotoPick({ id, label, onFile, kind }) {
  const ref = useRef(null);
  return html`<div className="pick"><input ref=${ref} id=${id} type="file" accept="image/*" hidden onChange=${(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onFile(f); }} />
    <${Btn} kind=${kind || "primary"} block onClick=${() => ref.current && ref.current.click()}>${label}</${Btn}></div>`;
}
function useObjectURL(file) {
  const [u, setU] = useState(null);
  useEffect(() => { if (!file) { setU(null); return; } const x = URL.createObjectURL(file); setU(x); return () => URL.revokeObjectURL(x); }, [file]);
  return u;
}
function MacroBars({ tot, t }) {
  const rows = [["Protéines", tot.p, t.p], ["Glucides", tot.c, t.c], ["Lipides", tot.f, t.f]];
  return html`<div className="macros">${rows.map(([n, v, g]) => html`<div key=${n} className="macro"><div className="macro-h"><span>${n}</span><b>${fmtN(v, 0)} / ${fmtN(g, 0)} g</b></div><${Bar} value=${g ? v / g : 0} tone=${g && v > g * 1.15 ? "over" : ""} /></div>`)}</div>`;
}
function MealEditor({ draft, setDraft, eq }) {
  const [sw, setSw] = useState(null);
  const tot = sumItems(draft.items);
  const upd = (i, it) => setDraft({ ...draft, items: draft.items.map((x, k) => (k === i ? it : x)) });
  const del = (i) => { setSw(null); setDraft({ ...draft, items: draft.items.filter((_, k) => k !== i) }); };
  const swap = (i, r) => { setSw(null); setDraft({ ...draft, items: draft.items.map((x, k) => (k === i ? ciqRowItem(r, x.g || 100, r.nom) : x)) }); };
  const v = VERDICT[draft.verdict];
  return html`<div className="stack-s">
    <div className="meal-h"><b>${draft.title || "Repas"}</b>${v ? html`<${Pill} tone=${v.t}>${v.n}</${Pill}>` : null}${draft.conf && !eq ? html`<span className="muted small">quantités estimées ${draft.conf === "bonne" ? "avec une bonne confiance" : draft.conf === "faible" ? "avec une faible confiance" : "avec une confiance moyenne"}</span>` : null}</div>
    ${draft.items.length ? html`<div className="items-n">${draft.items.map((x, i) => html`<div key=${i} className="it-wrap"><div className="it-n">
      <span className="it-name">${x.n}${eq ? null : html`<span className="it-meta">${x.ciq ? html`<span className="it-src" title=${x.ciqN || "Table Ciqual de l'ANSES"}>ANSES</span>` : x.est ? html`<span className="it-src est" title="Aliment absent de la table : valeurs estimées par le coach IA">estimé</span>` : null}<button type="button" className="linkbtn sm" onClick=${() => setSw(sw === i ? null : i)}>changer</button></span>`}</span>
      <button type="button" className="x sm" aria-label=${"Retirer " + x.n} onClick=${() => del(i)}>×</button></div>
      ${eq ? null : html`<${PortionRow} x=${x} onChange=${(it) => upd(i, it)} />`}
      ${sw === i ? html`<${CiqSwap} item=${x} onPick=${(r) => swap(i, r)} onCancel=${() => setSw(null)} />` : null}</div>`)}</div>` : html`<p className="muted small">Aucun aliment reconnu.</p>`}
    ${eq ? null : html`<div className="tot-line"><b>${fmtN(tot.kcal, 0)} kcal</b><span>P ${fmtN(tot.p, 0)} g · G ${fmtN(tot.c, 0)} g · L ${fmtN(tot.f, 0)} g</span></div>`}
    ${draft.comment ? html`<p className="small">${draft.comment}</p>` : null}
    ${draft.advice ? html`<p className="small note">${draft.advice}</p>` : null}
  </div>`;
}
/* quantité d'une ligne : nombre × portion parlante (tranche, œuf moyen…), ou grammes pour qui pèse */
function PortionRow({ x, onChange }) {
  const o = itemPortions(x), v = portionView(x, o), u = pUnit(o), d = o[0];
  const q0 = d && !d.raw && x.g > 0 ? Math.round(x.g / d.g * 2) / 2 : 0;
  const unit = (k) => { const p = o[k]; onChange(setPortion(x, p.raw ? Math.round(x.g) : v.p.raw ? Math.max(0.5, Math.round(x.g / p.g * 2) / 2 || 1) : v.q, p)); };
  return html`<div className="it-q">
    ${v.p.raw ? html`<input className="it-gin" inputMode="decimal" aria-label=${"Quantité en " + u + " : " + x.n} value=${Math.round(x.g)} onChange=${(e) => onChange(setPortion(x, e.target.value, v.p))} />`
      : html`<select className="it-cnt" aria-label=${"Nombre : " + x.n} value=${String(v.q)} onChange=${(e) => onChange(setPortion(x, e.target.value, v.p))}>${qtyList(v.q).map((n) => html`<option key=${n} value=${String(n)}>${qFmt(n)}</option>`)}</select><span className="it-x">×</span>`}
    <select className=${v.p.raw ? "it-u raw" : "it-u"} aria-label=${"Portion : " + x.n} value=${String(o.indexOf(v.p))} onChange=${(e) => unit(+e.target.value)}>${o.map((p, k) => html`<option key=${k} value=${String(k)}>${p.raw ? p.l : p.l + " · " + fmtN(p.g, 0) + " " + u}</option>`)}</select>
    <span className="it-eq">${v.p.raw ? (q0 >= 0.5 && q0 <= 6 ? "≈ " + qFmt(q0) + " × " + d.l + " · " : "") : "= " + fmtN(x.g, 0) + " " + u + " · "}${fmtN(x.kcal, 0)} kcal</span>
  </div>`;
}
function SlotPick({ value, onChange }) { return html`<${Field} label="Moment"><${Seg} options=${SLOTS.map((s) => ({ v: s.id, n: s.n }))} value=${value} onChange=${onChange} /></${Field}>`; }
function parseMeal(j, src, eq) {
  /* quantités estimées par le coach IA ; valeurs nutritionnelles relues dans la table Ciqual de l'ANSES */
  const items = Array.isArray(j && j.items) ? j.items.map((x) => (eq ? mkItem(x) : ciqFix(mkItem(x), x && x.ciqual))).filter((x) => x.n) : [];
  return { title: String((j && j.titre) || (items[0] && items[0].n) || "Repas").slice(0, 80), items, verdict: j && j.verdict, comment: j && j.commentaire ? String(j.commentaire).slice(0, 400) : "", advice: j && j.conseil ? String(j.conseil).slice(0, 300) : "", conf: j && j.confiance, src };
}
function mealPrompt(kind, np, tot, slot, note) {
  const eq = np && np.mode === "equilibre";
  const head = kind === "photo"
    ? "Tâche : analyse_photo_repas. Tu es le coach nutrition de l'application d'Antoine Prépa Performance. La photo montre un repas du client (" + slotName(slot).toLowerCase() + ")."
    : "Tâche : estimation_repas_texte. Tu es le coach nutrition de l'application d'Antoine Prépa Performance. Le client décrit son repas (" + slotName(slot).toLowerCase() + ") : « " + note + " ».";
  const how = kind === "photo" ? "Identifie chaque aliment ou boisson visible et estime sa quantité en grammes (ou ml) avec les repères habituels (assiette de 26 cm, cuillère à soupe ≈ 15 g, verre ≈ 200 ml) ; compte l'huile ou la sauce visibles. Si la photo ne montre pas de nourriture, renvoie une liste vide et explique-le dans « commentaire »." : "Estime chaque aliment et sa quantité en grammes avec des portions habituelles en France si elles ne sont pas précisées.";
  const fmt = eq
    ? '{"titre": "Poulet, riz et brocolis", "items": [{"n": "Riz"}], "verdict": "bon" | "correct" | "a_ameliorer", "commentaire": "1 à 2 phrases sur l\'équilibre de l\'assiette, sans aucun chiffre", "conseil": "une suggestion concrète"}'
    : '{"titre": "Poulet, riz et brocolis", "items": [{"n": "Riz basmati cuit", "ciqual": "Riz basmati, cuit", "g": 180, "kcal": 266, "p": 5, "c": 59, "f": 1}], "confiance": "faible" | "moyenne" | "bonne", "verdict": "bon" | "correct" | "a_ameliorer", "commentaire": "1 à 2 phrases, tutoiement, par rapport à ses cibles du jour", "conseil": "une suggestion concrète pour ce repas ou le suivant"}';
  const ciq = eq ? "" : "Pour chaque aliment, donne dans « ciqual » son nom tel qu'il est écrit dans la table Ciqual de l'ANSES : l'aliment d'abord, puis l'état ou la cuisson (ex. « Poulet, filet sans peau, grillé/poêlé », « Riz basmati, cuit », « Huile d'olive vierge extra », « Haricot vert, cuit »). L'application y lit les valeurs officielles ; tes valeurs ne servent que si l'aliment est absent de la table.";
  return [head, nutriShort(np, tot), kind === "photo" && note ? "Précision du client : " + note : "", how, ciq, aiLang("Les champs « n », « titre », « commentaire » et « conseil » sont dans cette langue ; « ciqual » reste le nom français de la table de l'ANSES."), eq ? "Ne donne aucun chiffre de calories ou de macros." : "Les valeurs nutritionnelles sont celles de la quantité estimée (pas pour 100 g).", "Réponds uniquement avec un objet JSON de cette forme : " + fmt].filter(Boolean).join("\n");
}

/* ---------- ajout d'un repas : photo, description, saisie ---------- */
function AddMeal({ mode, np, tot, ai, onAdd, onClose }) {
  const toast = useToast();
  const eq = np && np.mode === "equilibre";
  const [slot, setSlot] = useState(slotNow());
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [man, setMan] = useState({ n: "", kcal: "", p: "", c: "", f: "" });
  const [fdraft, setFdraft] = useState({ title: "", items: [], src: "manuel" });
  const [plats, setPlats] = useState(false);
  const ctl = useRef(null);
  const url = useObjectURL(file);
  useEffect(() => () => { try { ctl.current && ctl.current.abort(); } catch (e) {} }, []);
  const analyze = async () => {
    if (!ai.sample) return;
    setBusy(true); setErr(""); setDraft(null);
    const c = new AbortController(); ctl.current = c;
    try {
      const tbl = eq ? null : ciqLoad();
      const j = mode === "photo"
        ? await ai.sample.json(mealPrompt("photo", np, tot, slot, note.trim()), { images: [file], signal: c.signal })
        : await ai.sample.json(mealPrompt("texte", np, tot, slot, note.trim()), { modelTier: "quick", signal: c.signal });
      if (tbl) { try { await tbl; } catch (e) {} }
      setDraft(parseMeal(j, mode, eq));
    } catch (e) { const m = aiErr(e); if (m) setErr(m); } finally { setBusy(false); }
  };
  const add = async () => {
    let meal;
    if (mode === "manuel") {
      const extra = man.kcal || man.p || man.c || man.f || (!fdraft.items.length && man.n.trim()) ? [mkItem({ n: man.n.trim() || "Repas", g: 0, kcal: man.kcal, p: man.p, c: man.c, f: man.f })] : [];
      const items = [...fdraft.items, ...extra];
      meal = { title: man.n.trim() || fdraft.items.slice(0, 3).map((x) => x.n).join(", ") || "Repas", items, src: "manuel" };
    } else meal = draft;
    if (!meal || !meal.items.length) { toast("Rien à ajouter.", "warn"); return; }
    const tt = sumItems(meal.items);
    await onAdd({ id: rid("m"), slot, at: nowISO(), src: meal.src || mode, title: meal.title, items: meal.items.map(({ k100, ...x }) => ({ ...x, kcal: Math.round(x.kcal), p: Math.round(x.p * 10) / 10, c: Math.round(x.c * 10) / 10, f: Math.round(x.f * 10) / 10, g: Math.round(x.g) })),
      kcal: Math.round(tt.kcal), p: Math.round(tt.p), c: Math.round(tt.c), f: Math.round(tt.f), verdict: meal.verdict || null, comment: meal.comment || "" });
    onClose();
  };
  return html`<div className="form">
    <${SlotPick} value=${slot} onChange=${setSlot} />
    ${mode === "photo" ? html`${url ? html`<img className="prev" src=${url} alt="Photo du repas" />` : null}
      <${PhotoPick} id="meal-photo" label=${file ? "Changer de photo" : "Prendre ou choisir une photo"} kind=${file ? "ghost" : "primary"} onFile=${(f) => { setFile(f); setDraft(null); }} />
      ${file ? html`<${Field} label="Précision (facultatif)" id="meal-note"><input id="meal-note" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder="Ex. une cuillère d'huile d'olive, sauce à part" /></${Field}>
        ${!draft ? html`<${Btn} onClick=${analyze} disabled=${busy}>${busy ? "Analyse en cours…" : "Analyser la photo"}</${Btn}>` : null}` : null}` : null}
    ${mode === "texte" ? html`<${Field} label="Ce que tu as mangé" id="meal-txt"><textarea id="meal-txt" rows="3" value=${note} onChange=${(e) => setNote(e.target.value)} placeholder="Ex. 2 œufs brouillés, 2 tranches de pain complet, un yaourt grec et un café"></textarea></${Field}>
      ${!draft ? html`<${Btn} onClick=${analyze} disabled=${busy || note.trim().length < 3}>${busy ? "Estimation…" : "Estimer"}</${Btn}>` : null}` : null}
    ${mode === "manuel" ? html`<${FoodPicker} eq=${eq} onPick=${(it) => setFdraft({ ...fdraft, items: [...fdraft.items, ...[].concat(it)] })} />
      ${fdraft.items.length && !plats ? html`<button type="button" className="linkbtn" onClick=${() => setPlats(true)}>+ Ajouter un plat type</button>` : html`<${PlatPicker} slot=${slot} np=${np} tot=${tot} onPick=${(p) => { setFdraft({ ...fdraft, items: [...fdraft.items, ...platItems(p)] }); if (!man.n.trim() && !fdraft.items.length) setMan({ ...man, n: p.n }); setPlats(false); }} />`}
      ${fdraft.items.length ? html`<${Card}><${MealEditor} draft=${{ ...fdraft, title: man.n.trim() || "Mon repas" }} setDraft=${(d) => setFdraft({ ...fdraft, items: d.items })} eq=${eq} /></${Card}>` : null}
      <${Field} label=${fdraft.items.length ? "Nom du repas (facultatif)" : "Repas"} id="mn-n"><input id="mn-n" value=${man.n} onChange=${(e) => setMan({ ...man, n: e.target.value })} placeholder="Ex. Salade de pâtes" /></${Field}>
      ${eq ? null : html`${fdraft.items.length ? html`<p className="muted small">Autre chose à ajouter ? Indique ses valeurs ci-dessous (facultatif).</p>` : null}<div className="row4"><${Field} label="kcal" id="mn-k"><input id="mn-k" inputMode="numeric" value=${man.kcal} onChange=${(e) => setMan({ ...man, kcal: e.target.value })} /></${Field}>
        <${Field} label="Protéines (g)" id="mn-p"><input id="mn-p" inputMode="decimal" value=${man.p} onChange=${(e) => setMan({ ...man, p: e.target.value })} /></${Field}>
        <${Field} label="Glucides (g)" id="mn-c"><input id="mn-c" inputMode="decimal" value=${man.c} onChange=${(e) => setMan({ ...man, c: e.target.value })} /></${Field}>
        <${Field} label="Lipides (g)" id="mn-f"><input id="mn-f" inputMode="decimal" value=${man.f} onChange=${(e) => setMan({ ...man, f: e.target.value })} /></${Field}></div>`}` : null}
    ${busy ? html`<div className="actions"><span className="muted small">Le coach IA regarde ${mode === "photo" ? "ta photo" : "ton repas"}… (10 à 40 s)</span><${Btn} kind="quiet" small onClick=${() => ctl.current && ctl.current.abort()}>Stop</${Btn}></div>` : null}
    ${err ? html`<p className="small warn-t">${err}</p>` : null}
    ${draft ? html`<${Card}><${MealEditor} draft=${draft} setDraft=${setDraft} eq=${eq} /></${Card}>
      <p className="muted small">${eq ? "" : "Valeurs nutritionnelles de la " + ciqLabel() + " pour les aliments marqués ANSES ; les quantités sont estimées" + (mode === "photo" ? " à partir de la photo (compte ±20 à 30 %)" : "") + " : corrige-les si besoin."}</p>` : null}
    ${mode === "manuel" && !eq ? html`<p className="muted small">Valeurs de la ${ciqLabel()}. Les portions (tranche, œuf moyen, cuillère à soupe…) sont des repères moyens : choisis « g » si tu pèses. Pour un produit emballé, scanne son code-barres.</p>` : null}
    ${draft || mode === "manuel" ? html`<div className="actions"><${Btn} onClick=${add} disabled=${mode === "manuel" && !man.n.trim() && !man.kcal && !fdraft.items.length}>Ajouter au journal</${Btn}>${draft ? html`<${Btn} kind="quiet" onClick=${analyze} disabled=${busy}>Relancer l'analyse</${Btn}>` : null}</div>` : null}
  </div>`;
}

/* ---------- scan d'un produit ---------- */
function productPrompt(np, tot, ean, n) {
  return ["Tâche : analyse_produit. " + (n > 1 ? "Les photos montrent" : "La photo montre") + " un produit alimentaire emballé (face avant, tableau des valeurs nutritionnelles ou code-barres)." + (ean ? " Code-barres lu : " + ean + "." : ""),
    "Lis les valeurs pour 100 g (ou 100 ml) sur le tableau nutritionnel. Si le tableau n'est pas visible ou pas lisible, mets \"lisible\": false ; donne alors des valeurs typiques avec \"estime\": true seulement si tu reconnais le produit avec certitude, sinon mets les valeurs à null.",
    nutriShort(np, tot), aiLang("Les champs « commentaire » et « alternative » sont dans cette langue."),
    'Réponds uniquement avec un objet JSON de cette forme : {"produit": "Skyr nature", "marque": "…", "ean": "les chiffres du code-barres s\'ils sont lisibles, sinon null", "lisible": true, "estime": false, "pour100": {"kcal": 64, "p": 11, "c": 4, "f": 0.2, "sucres": 4, "fibres": 0, "sel": 0.1}, "portion_g": 150, "nutriscore": "A", "verdict": "bon" | "occasionnel" | "a_limiter", "commentaire": "1 à 2 phrases pour ce client", "alternative": "une alternative plus intéressante si utile, sinon null"}'].filter(Boolean).join("\n");
}
function parseProduct(j, ean) {
  const p1 = (j && j.pour100) || {};
  const per = { kcal: num(p1.kcal), p: num(p1.p), c: num(p1.c), f: num(p1.f), sucres: num(p1.sucres), fibres: num(p1.fibres), sel: num(p1.sel) };
  return { ean: normEan(ean || (j && j.ean)) || null, n: String((j && j.produit) || "Produit").slice(0, 80), brand: j && j.marque ? String(j.marque).slice(0, 60) : "", per100: per,
    ok: per.kcal !== null, estime: !!(j && j.estime), lisible: !!(j && j.lisible), portion: num(j && j.portion_g) || 100, nutriscore: j && /^[A-E]$/.test(String(j.nutriscore || "")) ? j.nutriscore : null,
    verdict: j && j.verdict, comment: j && j.commentaire ? String(j.commentaire).slice(0, 300) : "", alt: j && j.alternative ? String(j.alternative).slice(0, 200) : "", at: nowISO() };
}
function ScanProduct({ np, tot, ai, db, onAdd, onClose }) {
  const toast = useToast();
  const eq = np && np.mode === "equilibre";
  const [st, setSt] = useState({ phase: "pick", ean: null, files: [], prod: null, err: "" });
  const [g, setG] = useState("");
  const [slot, setSlot] = useState(slotNow());
  const [typed, setTyped] = useState("");
  const [manual, setManual] = useState(false);
  const ctl = useRef(null);
  useEffect(() => () => { try { ctl.current && ctl.current.abort(); } catch (e) {} }, []);
  const showResult = (prod, ean, files) => { setG(String(Math.round(prod.portion || 100))); setManual(false); setSt({ phase: "result", ean, files: files || [], prod, err: "" }); };
  const lookup = async (ean, files) => {
    const known = await findProduct(db, ean);
    if (known) { showResult({ ...known, fromCache: true }, ean, files); return; }
    if (window.IS_SITE) {
      setSt({ phase: "lookup", ean, files: files || [], prod: null, err: "" });
      const off = await offLookup(ean);
      if (off) { await rememberProduct(db, ean, off); showResult(off, ean, files); return; }
    }
    setManual(!ai.images);
    setSt({ phase: "need_label", ean, files: files || [], prod: null, err: "" });
  };
  const saveManual = async (prod) => {
    if (prod.ean && prod.ok) await rememberProduct(db, prod.ean, prod);
    showResult(prod, prod.ean, st.files);
  };
  const analyze = async (files, ean) => {
    if (!ai.sample || !ai.images) { setManual(true); setSt((s) => ({ ...s, phase: "need_label", files, ean })); return; }
    setSt((s) => ({ ...s, phase: "analyzing", files, ean, err: "" }));
    const c = new AbortController(); ctl.current = c;
    try {
      const j = await ai.sample.json(productPrompt(np, tot, ean, files.length), { images: files.slice(0, Math.max(1, ai.maxImages || 1)), signal: c.signal });
      const prod = parseProduct(j, ean);
      if (!prod.ok) { setSt((s) => ({ ...s, phase: "need_label", ean: prod.ean || ean, err: "Je ne vois pas le tableau des valeurs nutritionnelles." })); return; }
      if (prod.ean && !prod.estime) await rememberProduct(db, prod.ean, prod);
      setG(String(Math.round(prod.portion || 100)));
      setSt((s) => ({ ...s, phase: "result", prod, ean: prod.ean || ean }));
    } catch (e) { const m = aiErr(e); setSt((s) => ({ ...s, phase: m ? "error" : "pick", err: m })); }
  };
  const onBarcode = async (f) => {
    setSt({ phase: "decoding", ean: null, files: [f], prod: null, err: "" });
    const ean = await decodeBarcode(f);
    if (ean) await lookup(ean, [f]);
    else { setManual(false); setSt({ phase: ai.images ? "need_label" : "pick", ean: null, files: ai.images ? [f] : [], prod: null, err: ai.images ? "Code-barres non lu : approche-toi, évite les reflets, ou photographie directement l'étiquette." : "Code-barres non lu : approche-toi, évite les reflets, ou tape les chiffres sous le code-barres." }); }
  };
  const add = async () => {
    const p = st.prod; const q = num(g) || 0;
    if (!p || !q) { toast("Indique la quantité.", "warn"); return; }
    const it = { n: p.n + (p.brand ? " (" + p.brand + ")" : ""), g: q, kcal: Math.round((p.per100.kcal || 0) * q / 100), p: Math.round((p.per100.p || 0) * q) / 100, c: Math.round((p.per100.c || 0) * q) / 100, f: Math.round((p.per100.f || 0) * q) / 100 };
    await onAdd({ id: rid("m"), slot, at: nowISO(), src: "produit", ean: p.ean || null, title: p.n, items: [it], kcal: it.kcal, p: Math.round(it.p), c: Math.round(it.c), f: Math.round(it.f), verdict: p.verdict || null, comment: p.comment || "" });
    onClose();
  };
  const p = st.prod; const q = num(g) || 0;
  const typedEan = normEan(typed);
  const restart = () => { setManual(false); setTyped(""); setSt({ phase: "pick", ean: null, files: [], prod: null, err: "" }); };
  return html`<div className="form">
    ${st.phase === "pick" || st.phase === "error" ? html`<p className="small">Photographie le code-barres, bien à plat et net. Un produit déjà scanné par toi ou un autre client est reconnu tout de suite ; ${ai.images ? "sinon, le coach IA lit l'étiquette." : window.IS_SITE ? "sinon, il est cherché dans Open Food Facts, ou tu l'ajoutes en 20 secondes." : "sinon, tu l'ajoutes en 20 secondes."}</p>
      ${st.err && st.phase === "pick" ? html`<p className="small warn-t">${st.err}</p>` : null}
      <${PhotoPick} id="scan-bc" label="Photographier le code-barres" onFile=${onBarcode} />
      ${ai.images ? html`<${PhotoPick} id="scan-lab0" kind="ghost" label="Photographier directement l'étiquette" onFile=${(f) => analyze([f], null)} />` : null}
      <div className="row-end"><${Field} label="Ou tape les chiffres du code-barres" id="scan-typed"><input id="scan-typed" inputMode="numeric" value=${typed} onChange=${(e) => setTyped(e.target.value)} placeholder="13 chiffres" onKeyDown=${(e) => { if (e.key === "Enter" && typedEan) lookup(typedEan, []); }} /></${Field}>
        <${Btn} kind="ghost" onClick=${() => lookup(typedEan, [])} disabled=${!typedEan}>Chercher</${Btn}></div>` : null}
    ${st.phase === "decoding" ? html`<p className="muted">Lecture du code-barres…</p>` : null}
    ${st.phase === "lookup" ? html`<p className="muted">Recherche du produit ${st.ean}…</p>` : null}
    ${st.phase === "need_label" ? html`<div className="stack-s">${st.ean ? html`<p className="small">Code-barres <b>${st.ean}</b> : produit pas encore connu.</p>` : null}
      ${st.err ? html`<p className="small warn-t">${st.err}</p>` : null}
      ${ai.images && !manual ? html`<p className="small">Photographie maintenant le <b>tableau des valeurs nutritionnelles</b> (au dos du paquet). Le produit sera ensuite reconnu directement.</p>
        <${PhotoPick} id="scan-lab" label="Photographier l'étiquette" onFile=${(f) => analyze([...st.files.slice(0, 1), f], st.ean)} />
        <button type="button" className="linkbtn" onClick=${() => setManual(true)}>Saisir les valeurs à la main</button>` : null}
      ${manual ? html`<${Card} title="Ajouter ce produit"><${ProductForm} ean=${st.ean} eq=${eq} onSave=${saveManual} /></${Card}>` : null}
      <${Btn} kind="quiet" onClick=${restart}>Recommencer</${Btn}></div>` : null}
    ${st.phase === "analyzing" ? html`<div className="actions"><span className="muted small">Le coach IA lit l'étiquette… (10 à 40 s)</span><${Btn} kind="quiet" small onClick=${() => ctl.current && ctl.current.abort()}>Stop</${Btn}></div>` : null}
    ${st.phase === "error" && st.err ? html`<p className="small warn-t">${st.err}</p>` : null}
    ${st.phase === "result" && p ? html`<${Card}>
      <div className="meal-h"><b>${p.n}</b>${p.brand ? html`<span className="muted small">${p.brand}</span>` : null}${p.nutriscore ? html`<span className=${"ns ns-" + p.nutriscore}>Nutri-Score ${p.nutriscore}</span>` : null}${VERDICT[p.verdict] ? html`<${Pill} tone=${VERDICT[p.verdict].t}>${VERDICT[p.verdict].n}</${Pill}>` : null}</div>
      ${p.fromCache ? html`<p className="muted small">Reconnu grâce au code-barres ${p.ean}.</p>` : p.estime ? html`<p className="small warn-t">Valeurs typiques estimées : vérifie l'étiquette si possible.</p>` : null}
      ${p.source === "off" ? html`<p className="muted small">Données Open Food Facts (base collaborative, licence ODbL) : vérifie l'étiquette en cas de doute.</p>` : null}
      ${eq ? null : html`<div className="kvs">${[["Énergie", p.per100.kcal, "kcal"], ["Protéines", p.per100.p, "g"], ["Glucides", p.per100.c, "g"], ["dont sucres", p.per100.sucres, "g"], ["Lipides", p.per100.f, "g"], ["Fibres", p.per100.fibres, "g"], ["Sel", p.per100.sel, "g"]].filter((x) => x[1] !== null && x[1] !== undefined).map(([n, v, u]) => html`<div key=${n} className="kv"><span>${n} / 100 g</span><b>${fmtN(v, 1)} ${u}</b></div>`)}</div>`}
      ${p.comment ? html`<p className="small">${p.comment}</p>` : null}${p.alt ? html`<p className="small note">Alternative : ${p.alt}</p>` : null}
    </${Card}>
    <div className="row2"><${Field} label="Quantité mangée (g)" id="scan-g"><input id="scan-g" inputMode="decimal" value=${g} onChange=${(e) => setG(e.target.value)} /></${Field}>
      ${eq ? null : html`<div className="field"><span className="field-l">Pour cette quantité</span><div className="tot-line"><b>${fmtN((p.per100.kcal || 0) * q / 100, 0)} kcal</b><span>P ${fmtN((p.per100.p || 0) * q / 100, 0)} g · G ${fmtN((p.per100.c || 0) * q / 100, 0)} g · L ${fmtN((p.per100.f || 0) * q / 100, 0)} g</span></div></div>`}</div>
    <${SlotPick} value=${slot} onChange=${setSlot} />
    <div className="actions"><${Btn} onClick=${add} disabled=${!q}>Ajouter au journal</${Btn}><${Btn} kind="quiet" onClick=${restart}>Scanner un autre produit</${Btn}></div>` : null}
  </div>`;
}

/* ---------- objectif ---------- */
function NutriSetup({ data, plan, prog, onSave, onCancel }) {
  const p = data.profile || {};
  const np = data.nutri && data.nutri.plan;
  const lw = lastWeight(data);
  const [f, setF] = useState(() => np && np.form ? { ...np.form } : { sex: "", age: p.birthYear ? String(new Date().getFullYear() - p.birthYear) : "", height: p.height ? String(p.height) : "", weight: lw ? String(lw.v) : p.weight ? String(p.weight) : "", goal: prog && prog.id === "masse" ? "prise" : prog && prog.id === "perte" ? "perte" : "maintien", delta: "", months: "3", act: 1.35, prefs: "", preg: false, ted: false });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const weeks = Math.round(num(f.months) * 52 / 12) || 13;
  const age = num(f.age);
  const minor = age !== null && age < 18;
  const eqMode = minor || f.ted || (f.sex === "F" && f.preg && f.goal === "perte");
  const sessions = prog ? 3 : 0;
  const calc = f.sex && !eqMode ? nutriCalc({ ...f, weeks }, sessions) : null;
  const ok = !!f.sex && (eqMode || (calc && !calc.error)) && (f.goal === "maintien" || eqMode || num(f.delta) > 0);
  const save = () => {
    const form = { ...f };
    if (eqMode) { onSave({ mode: "equilibre", form: { ...form, ted: false, preg: false }, start: todayISO(), createdAt: nowISO(), prefs: f.prefs.trim(), reason: minor ? "mineur" : "" }); return; }
    onSave({ mode: "calories", form: { ...form, ted: false, preg: false }, sex: calc.sex, age, height: num(f.height), weight0: num(f.weight), goal: f.goal, delta: f.goal === "maintien" ? 0 : num(f.delta), weeks: f.goal === "maintien" ? weeks : Math.round(calc.weeksReal || weeks),
      target: calc.target, rate: calc.rate, tdee: calc.tdee, bmr: calc.bmr, floor: calc.floor, refW: calc.refW, targets: calc.targets, status: calc.status, prefs: f.prefs.trim(), start: todayISO(), createdAt: (np && np.createdAt) || nowISO(), updatedAt: nowISO(),
      history: [...((np && np.history) || []), { at: nowISO(), by: "client", after: calc.targets, reason: "Nouvel objectif : " + (f.goal === "maintien" ? "maintien" : f.goal + " de " + f.delta + " kg en " + f.months + " mois") }].slice(-30) });
  };
  const st = calc && !calc.error ? { ok: ["ok", "Objectif réaliste"], ambitieux: ["gold", "Ambitieux mais faisable"], rapide: ["warn", "Trop rapide"] }[calc.status] : null;
  return html`<div className="stack">
    <${Card} title="Toi">
      <div className="form">
        <${Field} label="Sexe"><${Seg} options=${[{ v: "H", n: "Homme" }, { v: "F", n: "Femme" }]} value=${f.sex} onChange=${(v) => set("sex", v)} /></${Field}>
        <div className="row4"><${Field} label="Âge" id="nu-a"><input id="nu-a" inputMode="numeric" value=${f.age} onChange=${(e) => set("age", e.target.value)} /></${Field}>
          <${Field} label="Taille (cm)" id="nu-h"><input id="nu-h" inputMode="numeric" value=${f.height} onChange=${(e) => set("height", e.target.value)} /></${Field}>
          <${Field} label="Poids (kg)" id="nu-w"><input id="nu-w" inputMode="decimal" value=${f.weight} onChange=${(e) => set("weight", e.target.value)} /></${Field}></div>
        <${Field} label="Activité en dehors de tes séances" hint=${(ACT.find((x) => x.v === f.act) || {}).d}><${Seg} options=${ACT.map((x) => ({ v: x.v, n: x.n }))} value=${f.act} onChange=${(v) => set("act", v)} /></${Field}>
      </div></${Card}>
    <${Card} title="Ton objectif">
      <div className="form">
        <${Seg} options=${[{ v: "perte", n: "Perdre du poids" }, { v: "maintien", n: "Garder mon poids" }, { v: "prise", n: "Prendre du muscle" }]} value=${f.goal} onChange=${(v) => set("goal", v)} />
        ${f.goal !== "maintien" ? html`<div className="row2"><${Field} label=${f.goal === "perte" ? "Kilos à perdre" : "Kilos à prendre"} id="nu-d"><input id="nu-d" inputMode="decimal" value=${f.delta} onChange=${(e) => set("delta", e.target.value)} placeholder=${f.goal === "perte" ? "10" : "3"} /></${Field}>
          <${Field} label="En combien de mois ?"><${Seg} options=${["1", "2", "3", "4", "6", "9", "12"].map((m) => ({ v: m, n: m }))} value=${f.months} onChange=${(v) => set("months", v)} /></${Field}></div>` : null}
        <${Field} label="Préférences et aliments à éviter (facultatif)" id="nu-pr"><input id="nu-pr" value=${f.prefs} onChange=${(e) => set("prefs", e.target.value)} placeholder="Ex. végétarien, pas de porc, n'aime pas le poisson" /></${Field}>
        ${f.sex === "F" ? html`<label className="chk"><input type="checkbox" id="nu-preg" checked=${f.preg} onChange=${(e) => set("preg", e.target.checked)} /><span>Je suis enceinte ou j'allaite</span></label>` : null}
        <label className="chk"><input type="checkbox" id="nu-ted" checked=${f.ted} onChange=${(e) => set("ted", e.target.checked)} /><span>J'ai (ou j'ai eu) un trouble du comportement alimentaire, ou compter les calories me met mal à l'aise</span></label>
      </div></${Card}>
    ${eqMode ? html`<div className="alert gold"><div><b>Mode équilibre</b><p>${minor ? "Avant 18 ans, pas d'objectif chiffré : on construit de bonnes habitudes." : f.ted ? "Pas de chiffres ni de comptage : le coach t'aide à construire des repas équilibrés et réguliers. Si tu en ressens le besoin, parles-en aussi à ton médecin." : "Pendant la grossesse ou l'allaitement, pas d'objectif de perte de poids : demande conseil à ta sage-femme ou à ton médecin."} Tes repas restent analysés, sans calories.</p></div></div>` : null}
    ${calc && calc.error ? html`<p className="small warn-t">${calc.error}</p>` : null}
    ${calc && !calc.error && (f.goal === "maintien" || num(f.delta) > 0) ? html`<${Card} title="Ton plan" action=${st ? html`<${Pill} tone=${st[0]}>${st[1]}</${Pill}>` : null}>
      <div className="tiles">
        <div className="tile"><b>${fmtN(calc.targets.kcal, 0)}</b><span>kcal par jour</span></div>
        <div className="tile"><b>${fmtN(calc.targets.p, 0)} g</b><span>protéines</span></div>
        <div className="tile"><b>${fmtN(calc.targets.steps, 0)}</b><span>pas par jour</span></div>
        <div className="tile"><b>${sessions || "—"}</b><span>séances par semaine</span></div>
      </div>
      <p className="small">Dépense énergétique journalière : <b>${fmtN(calc.tdee, 0)} kcal</b> (métabolisme de base ${fmtN(calc.bmr, 0)} kcal + activité et séances ${fmtN(calc.tdee - calc.bmr, 0)} kcal).</p>
      <p className="small">Glucides ${fmtN(calc.targets.c, 0)} g · lipides ${fmtN(calc.targets.f, 0)} g · eau ${fmtN(calc.targets.water, 1)} L.</p>
      ${f.goal !== "maintien" ? html`<p className="small">Rythme : ${fmtN(Math.abs(calc.rate), 2)} kg par semaine → ${fmtN(calc.target, 1)} kg vers le ${fmtDY(addDays(todayISO(), Math.round((calc.weeksReal || weeks) * 7)))}.</p>` : null}
      ${calc.status === "rapide" ? html`<div className="alert warn"><div><b>Objectif trop rapide pour être tenu sans perdre de muscle</b><p>Je te propose ${plural(Math.ceil(calc.suggestWeeks / 4.33), "mois")} : même résultat, sans régime extrême.</p></div><${Btn} small onClick=${() => set("months", String(Math.min(12, Math.ceil(calc.suggestWeeks / 4.33))))}>Appliquer</${Btn}></div>` : null}
      ${calc.targets.kcal <= calc.floor ? html`<p className="small warn-t">Calories au plancher de sécurité (${fmtN(calc.floor, 0)} kcal) : l'objectif prendra plus de temps.</p>` : null}
    </${Card}>` : null}
    <div className="actions"><${Btn} onClick=${save} disabled=${!ok}>Enregistrer mon objectif</${Btn}>${onCancel ? html`<${Btn} kind="quiet" onClick=${onCancel}>Annuler</${Btn}>` : null}</div>
  </div>`;
}
function TrajChart({ np, pts }) {
  const ref = useRef(null);
  const W = useWidth(ref);
  const H = 180;
  if (!np || np.mode === "equilibre" || np.goal === "maintien") return null;
  const total = Math.max(14, Math.round(np.weeks * 7));
  const xs = (d) => diffDays(np.start, d);
  const data = pts.filter((p) => xs(p.d) >= -14);
  const ys = [np.weight0, np.target, ...data.map((p) => p.v)];
  let mn = Math.min(...ys), mx = Math.max(...ys); if (mx - mn < 2) { mn -= 1; mx += 1; }
  const ticks = niceTicks(mn, mx, 3); const lo = ticks[0], hi = ticks[ticks.length - 1];
  const L = 40, R = 12, T = 12, B = 24;
  const x = (dd) => L + (W - L - R) * clamp((dd + 0) / total, 0, 1);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const today = xs(todayISO());
  return html`<div ref=${ref} className="chart"><svg width=${W} height=${H} role="img" aria-label=${"Trajectoire prévue de " + fmtN(np.weight0) + " à " + fmtN(np.target) + " kg"}>
    ${ticks.map((t) => html`<g key=${t}><line x1=${L} x2=${W - R} y1=${y(t)} y2=${y(t)} style=${{ stroke: "var(--grid)" }}></line><text x=${L - 6} y=${y(t) + 4} textAnchor="end" className="ax">${fmtN(t, 0)}</text></g>`)}
    <line x1=${x(0)} y1=${y(np.weight0)} x2=${x(total)} y2=${y(np.target)} style=${{ stroke: "var(--gold)", strokeWidth: 2, strokeDasharray: "6 5", opacity: 0.8 }}></line>
    ${today >= 0 && today <= total ? html`<line x1=${x(today)} x2=${x(today)} y1=${T} y2=${H - B} style=${{ stroke: "var(--muted)", strokeDasharray: "2 3" }}></line>` : null}
    ${data.map((p, i) => html`<circle key=${i} cx=${x(Math.max(0, xs(p.d)))} cy=${y(p.v)} r="4.5" style=${{ fill: "var(--gold)", stroke: "var(--surface)", strokeWidth: 2 }}></circle>`)}
    <text x=${L} y=${H - 6} className="ax">${fmtD(np.start)}</text><text x=${W - R} y=${H - 6} textAnchor="end" className="ax">${fmtD(addDays(np.start, total))}</text>
  </svg><div className="chart-val"><span className="muted">Pointillé : trajectoire prévue · points : tes pesées (bilans et tests)</span></div></div>`;
}
function NutriPlanView({ np, data, onEdit }) {
  const t = np.targets || {};
  const exp = expectedWeight(np, todayISO());
  const lw = lastWeight(data);
  const ia = (np.history || []).filter((h) => h.by === "ia").slice(-1)[0];
  return html`<div className="stack">
    ${np.mode === "equilibre" ? html`<${Card} title="Mode équilibre" sub="Pas de chiffres : des repas réguliers, variés et rassasiants">
      <ul className="checks"><li>3 repas par jour, une collation si tu as faim</li><li>À chaque repas : une source de protéines, des légumes, un féculent</li><li>L'eau comme boisson principale</li><li>Le plaisir fait partie de l'équilibre</li></ul></${Card}>` : html`
    <${Card} title="Mes cibles du jour" sub=${nutriGoalText(np)}>
      <div className="tiles"><div className="tile"><b>${fmtN(t.kcal, 0)}</b><span>kcal</span></div><div className="tile"><b>${fmtN(t.p, 0)} g</b><span>protéines</span></div>
        <div className="tile"><b>${fmtN(t.c, 0)} g</b><span>glucides</span></div><div className="tile"><b>${fmtN(t.f, 0)} g</b><span>lipides</span></div></div>
      <p className="small">${fmtN(t.steps, 0)} pas par jour · ${fmtN(t.water, 1)} L d'eau · 3 séances par semaine avec ton programme.</p>
      ${num(np.tdee) ? html`<p className="small">Dépense énergétique journalière estimée : <b>${fmtN(np.tdee, 0)} kcal</b>${num(np.bmr) ? " (métabolisme de base " + fmtN(np.bmr, 0) + " kcal + activité et séances " + fmtN(np.tdee - np.bmr, 0) + " kcal)" : ""}.${(() => { const a = energyAvg(data, np, 7); return a && a.n >= 3 ? " Mesurée sur les 7 derniers jours : " + fmtN(a.total, 0) + " kcal." : ""; })()}</p>` : null}
      ${ia ? html`<p className="small note">Ajusté par le coach IA le ${fmtD(ia.at)} : ${ia.reason}</p>` : null}</${Card}>
    ${np.goal !== "maintien" ? html`<${Card} title="Ma trajectoire" sub=${exp !== null ? "Prévu aujourd'hui : " + fmtN(exp) + " kg" + (lw ? " · dernière pesée : " + fmtN(lw.v) + " kg" : "") : null}><${TrajChart} np=${np} pts=${weightPoints(data)} /></${Card}>` : null}`}
    <${Card} title="La méthode" sub="Sur quoi reposent tes cibles">
      <p className="small">${np.mode === "equilibre" ? "Les repas réguliers et l'écoute de la faim comptent plus que les chiffres. Noter ses repas aide à prendre conscience de ses habitudes (Burke, 2011)." : "Dépense au repos estimée par l'équation de Mifflin-St Jeor (1990), multipliée par ton activité, plus tes séances. Déficit limité à 25 % et perte d'au plus 1 % du poids par semaine pour préserver le muscle (Helms, 2014) ; protéines autour de 1,6 à 1,8 g par kg (Morton, 2018). La perte réelle ralentit avec le temps (Hall, 2011) : le coach IA ajuste tes cibles selon tes pesées."} ${np.mode === "equilibre" ? "" : " Les jours où ta montre ou tes pas montrent que tu as bougé plus que prévu, la moitié du surplus s'ajoute à ta cible (les montres se trompent souvent de 20 % ou plus sur la dépense : Fuller, 2020) ; l'effet des repas compte pour environ 10 % de la dépense (Westerterp, 2004)."} Valeurs nutritionnelles des aliments : ${ciqLabel()}.</p>
      <details><summary>Références scientifiques</summary><ol className="refs">${NUTRI_REFS.map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></details></${Card}>
    <div className="actions"><${Btn} kind="ghost" onClick=${onEdit}>Modifier mon objectif</${Btn}></div>
    <p className="muted small">Ces repères ne remplacent pas un avis médical ou celui d'un diététicien, en particulier en cas de maladie ou de traitement.</p>
  </div>`;
}

/* ---------- ma dépense du jour ---------- */
function EnergyCard({ data, src, np, date }) {
  const toast = useToast();
  const en = dayEnergy(data, np, date);
  const cur = (data.sante && data.sante[date]) || {};
  const [f, setF] = useState(null);
  if (!en) return null;
  const isToday = date === todayISO();
  const stT = (np.targets && np.targets.steps) || 8000;
  const save = async () => {
    const pas = num(f.pas), kcal = num(f.kcal);
    if ((f.pas !== "" && (pas === null || pas < 0 || pas > 100000)) || (f.kcal !== "" && (kcal === null || kcal < 0 || kcal > 6000))) { toast("Valeur hors limites.", "warn"); return; }
    const out = { ...cur, at: nowISO(), src: cur.src && cur.src !== "manuel" && !String(cur.src).includes("manuel") ? cur.src + "+manuel" : cur.src || "manuel" };
    if (f.pas === "") delete out.pas; else out.pas = Math.round(pas);
    if (f.kcal === "") delete out.kcal; else out.kcal = Math.round(kcal);
    try { await src.saveSante(date, out); toast("Activité enregistrée.", "ok"); setF(null); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  const avg = isToday ? energyAvg(data, np, 7) : null;
  return html`<${Card} title=${isToday ? "Ma dépense du jour" : "Dépense de ce jour"} sub=${en.src === "montre" ? "Calories actives de ta montre ou de ton téléphone" : en.src === "pas" ? "Estimée d'après tes pas" + (en.act ? ", tes séances et tes activités" : "") : "Prévue dans ton plan"}
    action=${src && !f ? html`<${Btn} small kind="ghost" onClick=${() => setF({ pas: cur.pas ?? "", kcal: cur.kcal ?? "" })}>${en.src ? "Modifier" : "Saisir"}</${Btn}>` : null}>
    <div className="tiles">
      <div className="tile"><b>${fmtN(en.total ?? en.planned, 0)}</b><span>${en.total ? "kcal dépensées" : "kcal prévues"}</span></div>
      <div className="tile"><b>${en.act === null ? "—" : fmtN(en.act, 0)}</b><span>calories actives</span></div>
      <div className="tile"><b>${en.steps === null ? "—" : fmtN(en.steps, 0)}</b><span>pas · objectif ${fmtN(stT, 0)}</span></div>
      <div className="tile"><b>${fmtN(np.bmr, 0)}</b><span>métabolisme de base</span></div>
    </div>
    ${en.bonus > 0 ? html`<div className="alert okb"><div><b>Bonus d'activité : +${fmtN(en.bonus, 0)} kcal</b><p>Tu as bougé plus que prévu (${fmtN(en.total, 0)} kcal contre ${fmtN(en.planned, 0)} dans ton plan) : ta cible du jour passe à ${fmtN(dayTargets(np, en).kcal, 0)} kcal, en glucides surtout. La moitié seulement du surplus est ajoutée, car les montres surestiment souvent la dépense.</p></div></div>`
      : en.total ? html`<p className="small muted">${en.total >= en.planned ? "Dans ce que prévoit ton plan" : "Pour l'instant sous ce que prévoit ton plan (" + fmtN(en.planned, 0) + " kcal)"} : ta cible reste à ${fmtN(np.targets.kcal, 0)} kcal${isToday ? ". Elle augmente si tu bouges nettement plus que prévu." : "."}</p>`
      : html`<p className="small muted">Note tes pas ou tes calories actives, ou reçois-les automatiquement de ta montre (Ma santé du jour › Connecter ma montre) : ta dépense réelle s'affiche ici et ta cible s'ajuste les jours où tu bouges plus que prévu.</p>`}
    ${f ? html`<div className="row2"><${Field} label="Pas" id="en-pas"><input id="en-pas" inputMode="numeric" value=${f.pas} onChange=${(e) => setF({ ...f, pas: e.target.value })} /></${Field}>
      <${Field} label="Calories actives (kcal)" id="en-kcal" hint="« Énergie active » de ta montre ou de l'app Santé"><input id="en-kcal" inputMode="numeric" value=${f.kcal} onChange=${(e) => setF({ ...f, kcal: e.target.value })} /></${Field}></div>
      <div className="actions"><${Btn} small onClick=${save}>Enregistrer</${Btn}><${Btn} small kind="quiet" onClick=${() => setF(null)}>Annuler</${Btn}></div>` : null}
    ${isToday && !f && window.IS_SITE && typeof isIOS === "function" && isIOS() && data.profile && data.profile.santeSync && data.profile.santeSync.on ? html`<div className="btnrow"><${SendFromIphone} small /></div>` : null}
    ${avg && avg.n >= 3 ? html`<p className="small">Moyenne des 7 derniers jours : <b>${fmtN(avg.total, 0)} kcal</b> par jour${avg.steps !== null ? " · " + fmtN(avg.steps, 0) + " pas" : ""} (ton plan prévoit ${fmtN(en.planned, 0)} kcal).</p>` : null}
  </${Card}>`;
}

/* ---------- hydratation ----------
   Base : 33 mL par kg et par jour, entre 1,5 et 3,5 L (ordre de grandeur des apports de référence de l'EFSA, 2010 :
   2 L chez la femme, 2,5 L chez l'homme, dont environ 80 % par les boissons). Mode équilibre : repère sans le poids.
   Jours d'entraînement : + la sueur perdue pendant l'effort, au débit mesuré par le test de pesée, sinon 0,5 L par heure,
   car une perte de plus de 2 % du poids de corps dégrade la performance (ACSM, Sawka 2007). */
const HYDRA_REFS = [
  "EFSA Panel on Dietetic Products, Nutrition, and Allergies. Scientific opinion on dietary reference values for water. EFSA Journal. 2010;8(3):1459.",
  "Sawka MN, Burke LM, Eichner ER, Maughan RJ, Montain SJ, Stachenfeld NS. American College of Sports Medicine position stand. Exercise and fluid replacement. Med Sci Sports Exerc. 2007;39(2):377-390.",
  "Thomas DT, Erdman KA, Burke LM. American College of Sports Medicine joint position statement. Nutrition and athletic performance. Med Sci Sports Exerc. 2016;48(3):543-568.",
  "Shirreffs SM, Taylor AJ, Leiper JB, Maughan RJ. Post-exercise rehydration in man: effects of volume consumed and drink sodium content. Med Sci Sports Exerc. 1996;28(10):1260-1271.",
  "Armstrong LE, Maresh CM, Castellani JW, et al. Urinary indices of hydration status. Int J Sport Nutr. 1994;4(3):265-279.",
  "Parretti HM, Aveyard P, Blannin A, et al. Efficacy of water preloading before main meals as a strategy for weight loss in primary care patients with obesity: RCT. Obesity. 2015;23(9):1785-1791.",
];
const r2 = (v) => Math.round(v * 100) / 100;
/* minutes d'entraînement du jour : séances enregistrées et activités notées */
function hydraMinutes(data, d) {
  let m = 0;
  Object.values(data.logs || {}).forEach((l) => { if (l && l.date === d) m += clamp(num(l.duree) || 60, 10, 240); });
  Object.values(data.activites || {}).forEach((a) => { if (a && a.d === d) m += clamp(num(a.duree) || 0, 0, 600); });
  return Math.min(m, 600);
}
/* dernier test de sueur (moins de 6 mois) */
function sweatTest(data) {
  const ds = Object.keys(data.sante || {}).filter((d) => data.sante[d] && data.sante[d].sueur && num(data.sante[d].sueur.taux)).sort();
  const d = ds[ds.length - 1];
  return d && diffDays(d, todayISO()) <= 183 ? { d, ...data.sante[d].sueur } : null;
}
function hydraTarget(data, np, d) {
  const eq = !np || np.mode === "equilibre";
  const sex = (np && np.sex) || ((data.nutri && data.nutri.plan) || {}).sex;
  const w = eq ? null : npWeight(data, np);
  const base = w ? clamp(Math.round(w * 0.033 * 10) / 10, 1.5, 3.5) : sex === "F" ? 1.6 : 2.0;
  const mins = hydraMinutes(data, d || todayISO());
  const st = eq ? null : sweatTest(data);
  const rate = st ? clamp(num(st.taux), 0.2, 3) : 0.5;
  const extra = mins ? Math.round(Math.min(2.5, rate * mins / 60) * 10) / 10 : 0;
  return { base, extra, total: Math.round((base + extra) * 10) / 10, mins, rate, measured: !!st, w };
}
function waterOf(data, d) { const s = data.sante && data.sante[d]; return s ? num(s.eau) || 0 : 0; }
function SweatTest({ data, src, date, onDone }) {
  const toast = useToast();
  const mins0 = hydraMinutes(data, date);
  const [f, setF] = useState({ avant: "", apres: "", bu: "", min: mins0 ? String(mins0) : "60" });
  const a = num(f.avant), b = num(f.apres), bu = num(f.bu) || 0, mn = num(f.min);
  const ok = a !== null && b !== null && mn !== null && a >= 30 && a <= 300 && b >= 30 && b <= 300 && Math.abs(a - b) <= 5 && mn >= 15 && mn <= 300 && bu >= 0 && bu <= 5;
  const taux = ok ? (a - b + bu) / (mn / 60) : null;
  const perte = ok ? (a - b) / a * 100 : null;
  const valid = ok && taux >= 0.1 && taux <= 4;
  const save = async () => {
    if (!valid) { toast("Vérifie les valeurs : poids en kg, durée en minutes.", "warn"); return; }
    const cur = (src.get().sante || {})[date] || {};
    try { await src.saveSante(date, { ...cur, at: nowISO(), sueur: { avant: a, apres: b, bu: r2(bu), min: Math.round(mn), taux: r2(taux), perte: Math.round(perte * 10) / 10 } }); toast("Test de sueur enregistré : ton objectif d'eau des jours d'entraînement en tient compte.", "ok"); onDone(); }
    catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  return html`<div className="stack-s">
    <p className="small">Pèse-toi juste avant et juste après une séance habituelle, en sous-vêtements, après être allé aux toilettes et en t'essuyant bien. Note ce que tu as bu pendant.</p>
    <div className="row2"><${Field} label="Poids avant (kg)" id="sw-avant"><input id="sw-avant" inputMode="decimal" value=${f.avant} onChange=${(e) => setF({ ...f, avant: e.target.value })} /></${Field}>
      <${Field} label="Poids après (kg)" id="sw-apres"><input id="sw-apres" inputMode="decimal" value=${f.apres} onChange=${(e) => setF({ ...f, apres: e.target.value })} /></${Field}></div>
    <div className="row2"><${Field} label="Bu pendant la séance (L)" id="sw-bu"><input id="sw-bu" inputMode="decimal" placeholder="0" value=${f.bu} onChange=${(e) => setF({ ...f, bu: e.target.value })} /></${Field}>
      <${Field} label="Durée de la séance (min)" id="sw-min"><input id="sw-min" inputMode="numeric" value=${f.min} onChange=${(e) => setF({ ...f, min: e.target.value })} /></${Field}></div>
    ${valid ? html`<div className=${"alert " + (perte > 2 ? "warn" : "okb")}><div><b>Tu perds environ ${fmtN(taux, 1)} L de sueur par heure</b>
      <p>Perte pendant la séance : ${fmtN(perte, 1)} % de ton poids${perte > 2 ? ", au-dessus du seuil de 2 % où la performance baisse : bois davantage pendant l'effort" : ", sous le seuil de 2 % où la performance baisse"}.${a - b > 0 ? " Pour récupérer, bois environ " + fmtN(Math.round((a - b) * 1.5 * 10) / 10, 1) + " L dans les heures qui suivent (1,5 fois la perte), avec un repas ou une pincée de sel." : ""}</p></div></div>` : null}
    <div className="actions"><${Btn} small onClick=${save} disabled=${!valid}>Enregistrer le test</${Btn}><${Btn} small kind="quiet" onClick=${onDone}>Annuler</${Btn}></div>
  </div>`;
}
function HydraCard({ data, src, np, date }) {
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [sw, setSw] = useState(false);
  const eq = !np || np.mode === "equilibre";
  const h = hydraTarget(data, np, date);
  const drunk = waterOf(data, date);
  const isToday = date === todayISO();
  const st = eq ? null : sweatTest(data);
  const setWater = async (v) => {
    const cur = (src.get().sante || {})[date] || {};
    const out = { ...cur, at: nowISO(), src: cur.src && !String(cur.src).includes("manuel") ? cur.src + "+manuel" : cur.src || "manuel" };
    if (v <= 0) delete out.eau; else out.eau = r2(Math.min(10, v));
    try { await src.saveSante(date, out); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  const add = (ml) => setWater(waterOf(src.get(), date) + ml / 1000);
  const saveEdit = async () => { const v = num(edit); if (v === null || v < 0 || v > 10) { toast("Entre une quantité en litres, entre 0 et 10.", "warn"); return; } await setWater(v); setEdit(null); };
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 6)).map((d) => ({ x: JOURS[parseISO(d).getDay()].slice(0, 3) + ".", y: r2(waterOf(data, d)), muted: d === todayISO() }));
  const r = drunk / (h.total || 1);
  const left = Math.max(0, Math.round((h.total - drunk) * 10) / 10);
  return html`<${Card} title="Hydratation" sub=${isToday ? "Ce que tu as bu aujourd'hui (eau et boissons sans alcool)" : "Ce que tu as bu ce jour-là"}
    action=${src && edit === null ? html`<${Btn} small kind="ghost" onClick=${() => setEdit(drunk ? String(r2(drunk)).replace(".", ",") : "")}>Saisir</${Btn}>` : null}>
    <div className="hydra-h"><b className="hydra-v">${fmtN(drunk, 2)} L</b><span className="muted small">sur ${fmtN(h.total, 1)} L${r >= 1 ? " · objectif atteint" : isToday ? " · encore " + fmtN(left, 1) + " L" : ""}</span></div>
    <${Bar} value=${r} tone=${r >= 1 ? "ok" : ""} />
    ${edit === null ? html`<div className="hydra-btns">
      <button type="button" className="addbtn" onClick=${() => add(250)}><b>+ 250 mL</b><small>un verre</small></button>
      <button type="button" className="addbtn" onClick=${() => add(500)}><b>+ 500 mL</b><small>une bouteille</small></button>
      <button type="button" className="addbtn" onClick=${() => add(750)}><b>+ 750 mL</b><small>une gourde</small></button>
      <button type="button" className="addbtn" disabled=${drunk <= 0} onClick=${() => add(-250)}><b>− 250 mL</b><small>corriger</small></button></div>`
      : html`<div className="row2"><${Field} label="Total bu ce jour (L)" id="hy-edit"><input id="hy-edit" inputMode="decimal" value=${edit} onChange=${(e) => setEdit(e.target.value)} /></${Field}></div>
      <div className="actions"><${Btn} small onClick=${saveEdit}>Enregistrer</${Btn}><${Btn} small kind="quiet" onClick=${() => setEdit(null)}>Annuler</${Btn}></div>`}
    <p className="small muted">${eq ? "Repère du jour : " + fmtN(h.base, 1) + " L" : "Base : " + fmtN(h.base, 1) + " L (33 mL par kg)"}${h.extra ? " + " + fmtN(h.extra, 1) + " L pour " + plural(h.mins, "minute") + " d'entraînement (" + (h.measured ? "ton débit de sueur mesuré, " + fmtN(h.rate, 1) + " L par heure" : "0,5 L par heure d'effort") + ")" : isToday ? ". Les jours d'entraînement, l'objectif augmente dès que ta séance est enregistrée" : ""}.</p>
    <${BarChart} data=${last7} unit="L" digits=${1} target=${h.base} height=${120} />
    <details><summary>Bien boire selon ton objectif</summary><ul className="small">
      <li>Urines claires ou jaune pâle : tu es bien hydraté ; foncées : bois davantage (Armstrong, 1994).</li>
      ${eq ? null : html`<li>Avant l'entraînement : environ ${fmtN(Math.round((h.w || 70) * 6 / 50) * 50, 0)} mL dans les 4 heures qui précèdent (5 à 7 mL par kg, Thomas 2016).</li>`}
      <li>Pendant l'effort : bois régulièrement pour ne pas perdre plus de 2 % de ton poids, seuil où la performance baisse (Sawka, 2007).</li>
      <li>Après : 1,5 fois l'eau perdue, avec un repas ou un peu de sel pour la garder (Shirreffs, 1996).</li>
      ${np && np.goal === "perte" && !eq ? html`<li>Objectif perte de poids : un grand verre d'eau (500 mL) 30 minutes avant les deux repas principaux a aidé à perdre 1,3 kg de plus en 12 semaines (Parretti, 2015).</li>` : null}
    </ul></details>
    ${eq ? null : html`<details open=${sw}><summary onClick=${(e) => { e.preventDefault(); setSw(!sw); }}>Mesurer ma perte en sueur${st ? " · dernier test : " + fmtN(num(st.taux), 1) + " L par heure (" + fmtD(st.d) + ")" : ""}</summary>
      ${sw ? html`<${SweatTest} data=${data} src=${src} date=${date} onDone=${() => setSw(false)} />` : null}</details>`}
    <details><summary>Références scientifiques</summary><ol className="refs" data-notr>${HYDRA_REFS.map((x, i) => html`<li key=${i}>${x}</li>`)}</ol></details>
  </${Card}>`;
}

/* ---------- onglet Nutrition du client ---------- */
function NutritionTab({ data, src, plan, prog, settings, db, onUpgrade }) {
  const ai = useAI();
  const toast = useToast();
  const conf = aiConf(settings, data);
  const np = data.nutri && data.nutri.plan;
  const [sub, setSub] = useState(np ? "journal" : "objectif");
  const [edit, setEdit] = useState(!np);
  const [date, setDate] = useState(todayISO());
  const [modal, setModal] = useState(null);
  const day = data.food[date] || { meals: [] };
  const tot = dayTotals(day);
  const eq = np && np.mode === "equilibre";
  const isToday = date === todayISO();
  const en = np && !eq ? dayEnergy(data, np, date) : null;
  const tDay = np && !eq ? dayTargets(np, en) : null;
  const npDay = tDay && en && en.bonus ? { ...np, targets: tDay } : np;
  const v = dayVerdict(npDay, tot, (day.meals || []).length, isToday);
  const canAI = conf.on && ai.sample && !(plan && plan.offer === "lite");
  const addMeal = async (meal) => {
    const cur = src.get().food[date] || { meals: [] };
    try { await src.saveFood(date, { meals: [...(cur.meals || []), meal], updatedAt: nowISO() }); toast("Repas ajouté.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  const delMeal = async (id) => { const cur = src.get().food[date] || { meals: [] }; await src.saveFood(date, { meals: (cur.meals || []).filter((m) => m.id !== id), updatedAt: nowISO() }); };
  const saveNp = async (x) => { try { await src.saveNutri(x); setEdit(false); setSub("journal"); toast("Objectif enregistré.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 6)).map((d) => ({ x: JOURS[parseISO(d).getDay()].slice(0, 3) + ".", y: Math.round(dayTotals(data.food[d]).kcal), muted: d === todayISO() }));
  const bySlot = SLOTS.map((s) => ({ ...s, meals: (day.meals || []).filter((m) => m.slot === s.id) })).filter((s) => s.meals.length);
  /* forfait Lite sans l'option nutrition : on présente ce qu'elle apporte, l'eau reste suivie */
  if (!nutriOk(plan)) {
    const dif = Math.round((litePrice(settings, "mois", true) - litePrice(settings, "mois")) * 100) / 100;
    return html`<div className="stack">
      <div className="hero"><div className="eyebrow">Nutrition</div><h1>La nutrition est incluse dans le Lite + Nutrition.</h1></div>
      <${Card} title="Ce que l'option ajoute" sub=${dif > 0 ? "Pour " + eur2(dif) + " de plus par mois" : null}>
        <ul className="small"><li>Ton objectif calculé : calories, protéines, glucides, lipides et pas, ajustés à tes séances</li><li>Le journal des repas, avec des plats types et leurs macros</li><li>Le scan des produits par code-barres</li><li>Le livre de recettes, filtré selon ton objectif</li></ul>
        <p className="muted small">Repères issus des recommandations de l'ISSN pour les sportifs (Jäger et al., 2017, protéines 1,4 à 2 g par kg et par jour).</p>
        ${onUpgrade ? html`<div className="btnrow"><${Btn} small onClick=${onUpgrade}>Passer au Lite + Nutrition</${Btn}></div>` : null}</${Card}>
      <${HydraCard} data=${data} src=${src} np=${null} date=${todayISO()} />
    </div>`;
  }
  return html`<div className="stack">
    <div className="hero"><div className="eyebrow">Nutrition</div><h1>${np ? (eq ? "Des repas équilibrés, sans compter." : nutriGoalText(np).replace(/^./, (c) => c.toUpperCase()).replace(/, départ.*$/, "") + ".") : "Fixe ton objectif en 1 minute."}</h1></div>
    <div className="tabs-scroll"><${Seg} options=${np ? [{ v: "journal", n: "Mon journal" }, { v: "recettes", n: "Recettes" }, { v: "objectif", n: "Mon objectif" }] : [{ v: "objectif", n: "Mon objectif" }, { v: "recettes", n: "Recettes" }]} value=${sub} onChange=${(x) => { setSub(x); setEdit(false); }} /></div>
    ${sub === "recettes" ? html`<${RecipesTab} data=${data} src=${src} np=${np} ai=${canAI ? ai : null} cid=${src.cid} onAddMeal=${async (m) => { const d = todayISO(); const cur = src.get().food[d] || { meals: [] }; try { await src.saveFood(d, { meals: [...(cur.meals || []), m], updatedAt: nowISO() }); toast("Ajouté à ton journal d'aujourd'hui.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); } }} />` : null}
    ${sub === "objectif" && (edit || !np) ? html`<${NutriSetup} data=${data} plan=${plan} prog=${prog} onSave=${saveNp} onCancel=${np ? () => setEdit(false) : null} />` : null}
    ${sub === "objectif" && np && !edit ? html`<${NutriPlanView} np=${np} data=${data} onEdit=${() => setEdit(true)} />` : null}
    ${sub === "journal" && np ? html`
      <div className="daynav"><button type="button" className="x" aria-label="Jour précédent" onClick=${() => setDate(addDays(date, -1))}>‹</button>
        <b>${isToday ? "Aujourd'hui" : JOURS[parseISO(date).getDay()] + " " + fmtD(date)}</b>
        <button type="button" className="x" aria-label="Jour suivant" disabled=${isToday} onClick=${() => setDate(addDays(date, 1))}>›</button></div>
      ${eq ? null : html`<div className="today-grid"><${Ring} value=${tDay.kcal ? tot.kcal / tDay.kcal : 0} label=${fmtN(tot.kcal, 0)} sub=${"/ " + fmtN(tDay.kcal, 0) + " kcal"} size=${124} />
        <div className="stack-s" style=${{ flex: 1 }}><${MacroBars} tot=${tot} t=${tDay} />${en && en.bonus ? html`<span className="small ok-t">dont +${fmtN(en.bonus, 0)} kcal de bonus d'activité</span>` : null}</div></div>`}
      ${v ? html`<div className=${"alert " + (v.t === "warn" ? "warn" : v.t === "ok" ? "okb" : "")}><div><b>${v.n}</b><p>${v.d}</p></div></div>` : null}
      <div className="addrow">
        ${canAI && ai.images ? html`<button type="button" className="addbtn" onClick=${() => setModal("photo")}><span className="ab-i">📷</span><b>Photo du repas</b><small>calories estimées</small></button>` : null}
        <button type="button" className="addbtn" onClick=${() => setModal("scan")}><span className="ab-i">▥</span><b>Scanner un produit</b><small>code-barres</small></button>
        ${canAI ? html`<button type="button" className="addbtn" onClick=${() => setModal("texte")}><span className="ab-i">✎</span><b>Décrire</b><small>en une phrase</small></button>` : null}
        <button type="button" className="addbtn" onClick=${() => setModal("manuel")}><span className="ab-i">＋</span><b>Saisir</b><small>plats types, aliments</small></button>
      </div>
      ${!canAI && ai.ready && !window.IS_SITE ? html`<p className="muted small">${conf.on ? "Photo, description et lecture d'étiquette demandent d'ouvrir l'application connecté à ton compte Claude." : "Ton coach a désactivé le coach IA."}</p>` : null}
      ${bySlot.length ? bySlot.map((s) => html`<${Card} key=${s.id} title=${s.n} action=${eq ? null : html`<span className="muted small">${fmtN(sumItems(s.meals).kcal, 0)} kcal</span>`}>
        ${s.meals.map((m) => html`<div key=${m.id} className="meal">
          <div className="meal-h"><b>${m.title}</b>${VERDICT[m.verdict] ? html`<${Pill} tone=${VERDICT[m.verdict].t}>${VERDICT[m.verdict].n}</${Pill}>` : null}<button type="button" className="linkbtn" onClick=${() => delMeal(m.id)}>Supprimer</button></div>
          <p className="muted small">${(m.items || []).map((x) => x.n + (eq || !x.g ? "" : " " + Math.round(x.g) + " g")).join(" · ")}${eq ? "" : " — " + fmtN(m.kcal, 0) + " kcal · P " + fmtN(m.p, 0) + " g"}</p>
          ${m.comment ? html`<p className="small">${m.comment}</p>` : null}</div>`)}</${Card}>`) : html`<${Empty} title="Aucun repas noté" text=${canAI ? "Prends ton repas en photo, scanne un produit ou décris-le." : "Scanne un produit ou ajoute tes aliments en quelques secondes."} />`}
      <${HydraCard} data=${data} src=${src} np=${np} date=${date} />
      ${eq ? null : html`<${EnergyCard} data=${data} src=${src} np=${np} date=${date} />`}
      ${eq ? null : html`<${Card} title="7 derniers jours" sub="Calories notées par jour ; le trait indique ta cible"><${BarChart} data=${last7} unit="kcal" target=${np.targets.kcal} /></${Card}>`}
    ` : null}
    <${Modal} open=${!!modal} title=${{ photo: "Photo du repas", scan: "Scanner un produit", texte: "Décrire un repas", manuel: "Saisir un repas" }[modal] || ""} onClose=${() => setModal(null)}>
      ${modal === "scan" ? html`<${ScanProduct} np=${np} tot=${tot} ai=${canAI ? ai : { ...ai, sample: null, images: false }} db=${db} onAdd=${addMeal} onClose=${() => setModal(null)} />` : null}
      ${modal && modal !== "scan" ? html`<${AddMeal} mode=${modal} np=${np} tot=${tot} ai=${ai} onAdd=${addMeal} onClose=${() => setModal(null)} />` : null}
    </${Modal}>
  </div>`;
}
/* résumé sur l'écran Aujourd'hui */
function NutriToday({ data, go }) {
  const np = data.nutri && data.nutri.plan;
  if (!np) return html`<button type="button" className="srow" onClick=${() => go("nutrition")}><span className="srow-id">🍽</span><span className="srow-t"><b>Fixe ton objectif nutrition</b><span className="muted small">Calories, protéines et pas calculés pour toi en 1 minute</span></span><span className="srow-s">›</span></button>`;
  const tot = dayTotals(data.food[todayISO()]);
  const n = ((data.food[todayISO()] || {}).meals || []).length;
  const en = np.mode === "equilibre" ? null : dayEnergy(data, np, todayISO());
  const tD = np.mode === "equilibre" ? np.targets : dayTargets(np, en);
  return html`<button type="button" className="nutri-mini" onClick=${() => go("nutrition")}>
    <div className="nm-h"><b>Nutrition du jour</b><span className="muted small">${plural(n, "repas", "repas")} noté${n > 1 ? "s" : ""}</span></div>
    ${typeof weekRecipe === "function" && weekRecipe(data, np) ? html`<span className="small">Recette de la semaine : <b>${weekRecipe(data, np).n}</b></span>` : null}
    <span className="small">Eau : ${fmtN(waterOf(data, todayISO()), 1)} / ${fmtN(hydraTarget(data, np, todayISO()).total, 1)} L</span>
    ${np.mode === "equilibre" ? html`<span className="small">Ajoute tes repas pour un retour sur l'équilibre de ton assiette.</span>` : html`<${Bar} value=${tot.kcal / (tD.kcal || 1)} /><span className="small">${fmtN(tot.kcal, 0)} / ${fmtN(tD.kcal, 0)} kcal${en && en.bonus ? " (+" + fmtN(en.bonus, 0) + " activité)" : ""} · protéines ${fmtN(tot.p, 0)} / ${fmtN(np.targets.p, 0)} g${en && en.total ? " · dépense " + fmtN(en.total, 0) + " kcal" : ""}</span>`}
  </button>`;
}

/* ---------- côté coach ---------- */
function CoachNutrition({ data, src }) {
  const toast = useToast();
  const np = data.nutri && data.nutri.plan;
  const [f, setF] = useState(null);
  if (!np) return html`<${Empty} title="Pas encore d'objectif nutrition" text="Le client le définit dans son onglet Nutrition." />`;
  const eq = np.mode === "equilibre";
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayISO(), i - 13));
  const series = days.map((d) => ({ x: fmtD(d).replace(/\s.*/, ""), y: Math.round(dayTotals(data.food[d]).kcal), note: plural(((data.food[d] || {}).meals || []).length, "repas", "repas") }));
  const logged = days.slice(-7).filter((d) => ((data.food[d] || {}).meals || []).length);
  const avg = (k) => logged.length ? logged.reduce((s, d) => s + dayTotals(data.food[d])[k], 0) / logged.length : null;
  const recent = days.slice().reverse().filter((d) => ((data.food[d] || {}).meals || []).length).slice(0, 3);
  const saveT = async () => {
    const r = safeTargets(np, { kcal: num(f.kcal), p: num(f.p), c: num(f.c), f: num(f.f), steps: num(f.steps) });
    try { await src.saveNutri({ ...np, targets: { ...np.targets, ...r.t }, history: [...(np.history || []), { at: nowISO(), by: "coach", before: np.targets, after: r.t, reason: "Modifié par Antoine" }].slice(-30), updatedAt: nowISO() });
      toast(r.notes.length ? "Enregistré (corrigé : " + r.notes.join(", ") + ")." : "Cibles enregistrées.", "ok"); setF(null); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  return html`<div className="stack">
    <div className="stats4">
      <${Stat} n=${eq ? "Équilibre" : fmtN(np.targets.kcal, 0)} label=${eq ? "Mode sans chiffres" : "kcal cible"} sub=${eq ? null : "P " + np.targets.p + " · G " + np.targets.c + " · L " + np.targets.f + " g"} />
      <${Stat} n=${logged.length + "/7"} label="Jours notés" sub="7 derniers jours" />
      <${Stat} n=${eq || avg("kcal") === null ? "—" : fmtN(avg("kcal"), 0)} label="kcal moyennes" sub="jours notés" />
      <${Stat} n=${eq || avg("p") === null ? "—" : fmtN(avg("p"), 0) + " g"} label="Protéines moyennes" sub=${eq ? null : "cible " + np.targets.p + " g"} />
    </div>
    <${Card} title="Objectif" sub=${eq ? "Mode équilibre : aucun chiffre affiché au client" : nutriGoalText(np) + " · statut : " + ({ ok: "réaliste", ambitieux: "ambitieux", rapide: "trop rapide, plan ralenti" }[np.status] || "—")}>
      ${eq ? null : html`<p className="small">Dépense estimée ${fmtN(np.tdee, 0)} kcal · plancher ${fmtN(np.floor, 0)} kcal · ${fmtN(np.targets.steps, 0)} pas · eau ${fmtN(np.targets.water, 1)} L${np.prefs ? " · préférences : " + np.prefs : ""}</p>
        ${f ? html`<div className="row4">${[["kcal", "kcal"], ["p", "Protéines"], ["c", "Glucides"], ["f", "Lipides"]].map(([k, n]) => html`<${Field} key=${k} label=${n} id=${"cn-" + k}><input id=${"cn-" + k} inputMode="numeric" value=${f[k]} onChange=${(e) => setF({ ...f, [k]: e.target.value })} /></${Field}>`)}</div>
          <${Field} label="Pas par jour" id="cn-s"><input id="cn-s" inputMode="numeric" value=${f.steps} onChange=${(e) => setF({ ...f, steps: e.target.value })} /></${Field}>
          <div className="actions"><${Btn} onClick=${saveT}>Enregistrer les cibles</${Btn}><${Btn} kind="quiet" onClick=${() => setF(null)}>Annuler</${Btn}></div>`
        : html`<div className="actions"><${Btn} kind="ghost" small onClick=${() => setF({ ...np.targets })}>Modifier les cibles</${Btn}></div>`}`}
      ${(np.history || []).length ? html`<details><summary>Historique des changements</summary><ul className="small">${np.history.slice().reverse().map((h, i) => html`<li key=${i}>${fmtD(h.at)} · ${h.by === "ia" ? "coach IA" : h.by === "coach" ? "toi" : "client"} : ${h.after ? fmtN(h.after.kcal, 0) + " kcal, P " + fmtN(h.after.p, 0) + " g" : ""} ${h.reason ? "— " + h.reason : ""}</li>`)}</ul></details>` : null}
    </${Card}>
    ${eq ? null : html`<${CoachEnergy} data=${data} src=${src} np=${np} />`}
    ${eq ? null : html`<${Card} title="14 derniers jours"><${BarChart} data=${series} unit="kcal" target=${np.targets.kcal} /></${Card}>`}
    ${recent.map((d) => html`<${Card} key=${d} title=${JOURS[parseISO(d).getDay()] + " " + fmtD(d)} action=${eq ? null : html`<span className="muted small">${fmtN(dayTotals(data.food[d]).kcal, 0)} kcal · P ${fmtN(dayTotals(data.food[d]).p, 0)} g</span>`}>
      <ul className="loglist">${(data.food[d].meals || []).map((m) => html`<li key=${m.id}><b>${slotName(m.slot)}</b> · ${m.title}${eq ? "" : " · " + fmtN(m.kcal, 0) + " kcal"}${m.src ? html` <small className="muted">(${{ photo: "photo", produit: "scan", texte: "description", manuel: "saisie" }[m.src] || m.src})</small>` : null}</li>`)}</ul></${Card}>`)}
  </div>`;
}
/* côté coach : dépense mesurée, pas et bonus d'activité du client */
function CoachEnergy({ data, src, np }) {
  const toast = useToast();
  const today = dayEnergy(data, np, todayISO());
  const a7 = energyAvg(data, np, 7);
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayISO(), i - 13));
  const series = days.map((d) => { const e = dayEnergy(data, np, d); return { x: fmtD(d).replace(/\s.*/, ""), y: (e && e.total) || 0, note: e && e.src ? (e.src === "montre" ? "montre" : "d'après les pas") : "pas de donnée" }; });
  const has = series.some((x) => x.y);
  const [bon, setBon] = useState(np.actBonus !== false);
  useEffect(() => { setBon(np.actBonus !== false); }, [np.actBonus]);
  const toggle = async (on) => { setBon(on); try { await src.saveNutri({ ...np, actBonus: on, updatedAt: nowISO() }); toast(on ? "Bonus d'activité activé." : "Bonus d'activité désactivé.", "ok"); } catch (e) { setBon(!on); toast("Enregistrement impossible.", "bad"); } };
  return html`<${Card} title="Dépense et activité" sub="Calories actives et pas envoyés par la montre ou le téléphone du client, ou notés à la main">
    <div className="kvs">
      <div className="kv"><span>Dépense prévue (plan)</span><b>${fmtN(np.tdee, 0)} kcal</b></div>
      <div className="kv"><span>Aujourd'hui</span><b>${today && today.total ? fmtN(today.total, 0) + " kcal" + (today.bonus ? " · bonus +" + fmtN(today.bonus, 0) : "") : "—"}</b></div>
      <div className="kv"><span>Moyenne 7 jours</span><b>${a7 ? fmtN(a7.total, 0) + " kcal (" + a7.n + " j" + (a7.montre ? ", dont " + a7.montre + " avec montre" : "") + ")" : "—"}</b></div>
      <div className="kv"><span>Pas moyens 7 jours</span><b>${a7 && a7.steps !== null ? fmtN(a7.steps, 0) : "—"}</b></div>
    </div>
    ${has ? html`<${BarChart} data=${series} unit="kcal" target=${np.tdee} />` : html`<p className="muted small">Pas encore de pas ni de calories actives : le client peut les noter ou les envoyer depuis sa montre (Ma santé du jour › Connecter ma montre).</p>`}
    <label className="chk"><input type="checkbox" id="cn-bonus" checked=${bon} onChange=${(e) => toggle(e.target.checked)} /><span>Bonus d'activité : ajouter à sa cible du jour la moitié de ce qu'il dépense en plus de son plan (400 kcal au plus)</span></label>
  </${Card}>`;
}
function CoachAI({ data, src, plan }) {
  const toast = useToast();
  const [note, setNote] = useState((plan && plan.aiNote) || "");
  useEffect(() => { setNote((plan && plan.aiNote) || ""); }, [plan && plan.aiNote]);
  const adj = Object.entries(data.ai || {}).map(([id, a]) => ({ id, ...a })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const msgs = chatMsgs(data).slice(-60);
  const mark = async (a, patch) => { const { id, ...rest } = a; try { await src.saveAdjust(id, { ...rest, ...patch }); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  const cancel = async (a) => {
    await mark(a, { status: "annule", seen: true, cancelledAt: nowISO() });
    if (a.kind === "nutri" && a.before && data.nutri && data.nutri.plan) {
      const np = data.nutri.plan;
      await src.saveNutri({ ...np, targets: { ...np.targets, ...a.before }, history: [...(np.history || []), { at: nowISO(), by: "coach", after: a.before, reason: "Ajustement IA annulé par Antoine" }].slice(-30) });
    }
    toast("Ajustement annulé.", "ok");
  };
  const saveNote = async () => { if (!plan) return; try { await src.setPlan({ ...plan, aiNote: note.trim() }); toast("Consigne enregistrée.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  const pending = adj.filter((a) => !a.seen && a.status !== "annule");
  return html`<div className="stack">
    <${Card} title="Ajustements et signalements du coach IA" sub="Appliqués tout de suite au programme du client ; tu peux les annuler" action=${pending.length ? html`<${Btn} small kind="ghost" onClick=${async () => { for (const a of pending) await mark(a, { seen: true }); }}>Tout marquer comme vu</${Btn}>` : null}>
      ${adj.length ? html`<ul className="adjs">${adj.map((a) => html`<li key=${a.id} className=${a.status === "annule" ? "off" : ""}>
        <div className="adj-h">${a.kind === "alerte" ? html`<${Pill} tone=${a.urgence === "haute" ? "bad" : "warn"}>${a.urgence === "haute" ? "Alerte" : "Signalement"}</${Pill}>` : html`<${Pill} tone="gold">${{ nutri: "Nutrition", subst: "Exercice", charge: "Charge", note: "Mot" }[a.kind] || a.kind}</${Pill}>`}
          <span className="muted small">${fmtD(a.at)}</span>${a.status === "annule" ? html`<${Pill}>annulé</${Pill}>` : !a.seen ? html`<${Pill} tone="gold">à vérifier</${Pill}>` : null}</div>
        <p className="small"><b>${adjLabel(a)}</b>${a.reason ? html`<br /><span className="muted">Raison : ${a.reason}</span>` : null}</p>
        ${a.status !== "annule" ? html`<div className="btnrow">${!a.seen ? html`<${Btn} small kind="ghost" onClick=${() => mark(a, { seen: true })}>${a.kind === "alerte" ? "Traité" : "Valider"}</${Btn}>` : null}${a.kind !== "alerte" ? html`<${Btn} small kind="quiet" onClick=${() => cancel(a)}>Annuler</${Btn}>` : null}</div>` : null}
      </li>`)}</ul>` : html`<p className="muted small">Aucun ajustement pour l'instant.</p>`}
    </${Card}>
    <${Card} title="Consigne pour le coach IA" sub="Lue à chaque réponse pour ce client (ex. « pas de sauts jusqu'à nouvel ordre », « vise 2 000 kcal max »)">
      <textarea id="ai-note" rows="3" value=${note} onChange=${(e) => setNote(e.target.value)} disabled=${!plan}></textarea>
      <div className="actions"><${Btn} onClick=${saveNote} disabled=${!plan}>Enregistrer</${Btn}>${!plan ? html`<span className="muted small">Valide d'abord le plan du client.</span>` : null}</div></${Card}>
    <${Card} title="Conversations avec le coach IA" sub=${msgs.length ? plural(msgs.length, "message") + " récents" : null}>
      ${msgs.length ? html`<div className="msgs ro">${msgs.map((m, i) => html`<div key=${i} className=${"msg " + (m.r === "u" ? "u" : "a")}><div className="muted small">${m.r === "u" ? "Client" : m.kind === "bilan" ? "Coach IA · analyse du bilan S" + (m.w || "") : "Coach IA"} · ${fmtD(m.at)} ${String(m.at).slice(11, 16)}</div>
        ${String(m.t).split(/\n{2,}/).map((p, k) => html`<p key=${k}>${p}</p>`)}${m.ev && m.ev.length ? html`<div className="evs">${m.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}</div>`)}</div>` : html`<p className="muted small">Aucune conversation.</p>`}
    </${Card}>
  </div>`;
}
