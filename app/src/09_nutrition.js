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
function lastWeight(data) {
  const pts = [];
  Object.values(data.checkins || {}).forEach((c) => { if (c && num(c.poids) !== null) pts.push({ d: String(c.at || "").slice(0, 10), v: num(c.poids) }); });
  Object.values(data.tests || {}).forEach((t) => { if (t && t.values && num(t.values.poids) !== null) pts.push({ d: String(t.at || "").slice(0, 10), v: num(t.values.poids) }); });
  pts.sort((a, b) => a.d.localeCompare(b.d));
  return pts.length ? pts[pts.length - 1] : null;
}
function weightPoints(data) {
  const pts = [];
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
/* aliments courants : valeurs moyennes indicatives pour 100 g (ou 100 ml) — [nom, kcal, protéines, glucides, lipides, portion habituelle en g] */
const FOODS = [
  ["Riz blanc cuit", 130, 2.7, 28, 0.3, 150], ["Riz complet cuit", 120, 2.7, 25, 1, 150], ["Pâtes cuites", 145, 5, 29, 0.9, 200], ["Pâtes complètes cuites", 135, 5.5, 26, 1, 200],
  ["Semoule cuite", 112, 3.8, 23, 0.2, 150], ["Quinoa cuit", 120, 4.4, 21, 1.9, 150], ["Pommes de terre à l'eau", 80, 2, 17, 0.1, 200], ["Patate douce cuite", 90, 2, 21, 0.2, 200],
  ["Frites", 290, 3.4, 36, 15, 150], ["Pain (baguette)", 270, 9, 56, 1.3, 50], ["Pain complet", 245, 9, 45, 2.5, 50], ["Flocons d'avoine", 370, 13, 58, 7, 50],
  ["Lentilles cuites", 116, 9, 13, 0.4, 150], ["Pois chiches cuits", 150, 8.5, 20, 2.6, 150], ["Haricots rouges cuits", 115, 8.5, 15, 0.5, 150], ["Céréales du petit-déjeuner", 375, 7, 84, 1, 40], ["Muesli", 370, 10, 60, 8, 50],
  ["Blanc de poulet cuit", 150, 30, 0, 3, 150], ["Escalope de dinde cuite", 135, 29, 0, 2, 130], ["Steak haché 5 % cuit", 165, 26, 0, 7, 100], ["Steak haché 15 % cuit", 230, 24, 0, 15, 100],
  ["Bœuf (rumsteck) cuit", 165, 28, 0, 6, 150], ["Saumon cuit", 200, 22, 0, 12.5, 120], ["Thon au naturel", 115, 26, 0, 1, 100], ["Cabillaud cuit", 100, 22, 0, 1, 150], ["Sardines à l'huile égouttées", 210, 24, 0, 12.5, 80],
  ["Œuf (1 œuf ≈ 55 g)", 140, 12.5, 0.5, 10, 55], ["Jambon blanc (1 tranche ≈ 40 g)", 115, 21, 1, 3, 40], ["Tofu nature", 120, 13, 1.5, 7, 100], ["Whey (poudre)", 380, 78, 7, 5, 30],
  ["Fromage blanc 0 %", 47, 7.5, 4, 0.2, 100], ["Fromage blanc 3 %", 73, 7, 4, 3.2, 100], ["Skyr nature", 64, 11, 4, 0.2, 150], ["Yaourt nature", 60, 4, 5, 2.5, 125], ["Yaourt à la grecque", 117, 5, 4, 9, 150],
  ["Lait demi-écrémé", 46, 3.3, 4.8, 1.6, 250], ["Emmental", 380, 28, 0, 30, 30], ["Mozzarella", 250, 18, 1, 19, 60],
  ["Brocolis cuits", 35, 2.8, 4, 0.4, 150], ["Haricots verts cuits", 30, 1.8, 4.5, 0.2, 150], ["Courgettes cuites", 17, 1.2, 2, 0.3, 150], ["Carottes", 36, 0.8, 7, 0.2, 100], ["Tomates", 18, 0.9, 3, 0.2, 120],
  ["Salade verte", 15, 1.3, 1.7, 0.2, 50], ["Légumes poêlés", 50, 2, 6, 2, 200], ["Banane", 90, 1.1, 20, 0.3, 120], ["Pomme", 52, 0.3, 12, 0.2, 150], ["Orange", 47, 0.9, 9, 0.1, 150],
  ["Fruits rouges", 45, 1, 8, 0.4, 125], ["Avocat (½ ≈ 80 g)", 160, 2, 2, 15, 80], ["Dattes", 280, 2.5, 66, 0.4, 30],
  ["Huile d'olive (1 c. à soupe ≈ 10 g)", 900, 0, 0, 100, 10], ["Beurre", 740, 0.7, 0.6, 82, 10], ["Beurre de cacahuète", 600, 25, 15, 50, 20], ["Amandes", 600, 21, 8, 52, 30], ["Noix", 690, 15, 7, 65, 30],
  ["Chocolat noir 70 %", 580, 8, 33, 43, 20], ["Confiture", 250, 0.4, 60, 0.1, 20], ["Miel", 320, 0.3, 80, 0, 15], ["Sucre", 400, 0, 100, 0, 5],
  ["Pizza margherita", 250, 11, 30, 9, 300], ["Sandwich jambon-beurre", 260, 12, 33, 9, 250], ["Burger classique", 260, 13, 26, 11, 220], ["Lasagnes", 140, 8, 12, 7, 300],
  ["Croissant", 410, 8, 45, 21, 60], ["Pain au chocolat", 420, 8, 45, 23, 70], ["Barre de céréales", 400, 6, 65, 12, 25], ["Chips", 540, 6, 50, 34, 30],
  ["Jus d'orange", 45, 0.7, 10, 0.1, 200], ["Soda type cola", 42, 0, 10.6, 0, 330], ["Bière", 43, 0.4, 3.5, 0, 250], ["Vin rouge", 85, 0.1, 2.6, 0, 125],
];
function normTxt(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function foodItem(fd, g) { const q = g || fd[5]; return mkItem({ n: fd[0].replace(/\s*\(.*\)$/, ""), g: q, kcal: fd[1] * q / 100, p: fd[2] * q / 100, c: fd[3] * q / 100, f: fd[4] * q / 100 }); }
function FoodPicker({ onPick }) {
  const [q, setQ] = useState("");
  const t = normTxt(q.trim());
  const sugg = t.length >= 2 ? FOODS.filter((f) => normTxt(f[0]).includes(t)).slice(0, 6) : [];
  return html`<div className="stack-s"><${Field} label="Ajouter un aliment courant" id="fd-q"><input id="fd-q" value=${q} onChange=${(e) => setQ(e.target.value)} placeholder="Ex. riz, poulet, banane…" autoComplete="off" /></${Field}>
    ${sugg.length ? html`<div className="sugg">${sugg.map((f) => html`<button key=${f[0]} type="button" onClick=${() => { onPick(foodItem(f)); setQ(""); }}><b>${f[0]}</b><span className="muted small">${f[5]} g</span></button>`)}</div>`
      : t.length >= 2 ? html`<p className="muted small">Pas dans la liste : saisis-le plus bas.</p>` : null}</div>`;
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
  const tot = sumItems(draft.items);
  const upd = (i, g) => setDraft({ ...draft, items: draft.items.map((x, k) => (k === i ? scaleItem(x, g) : x)) });
  const del = (i) => setDraft({ ...draft, items: draft.items.filter((_, k) => k !== i) });
  const v = VERDICT[draft.verdict];
  return html`<div className="stack-s">
    <div className="meal-h"><b>${draft.title || "Repas"}</b>${v ? html`<${Pill} tone=${v.t}>${v.n}</${Pill}>` : null}${draft.conf && !eq ? html`<span className="muted small">estimation ${draft.conf}</span>` : null}</div>
    ${draft.items.length ? html`<div className="items-n">${draft.items.map((x, i) => html`<div key=${i} className="it-n">
      <span className="it-name">${x.n}</span>
      ${eq ? null : html`<label className="it-g"><input inputMode="decimal" aria-label=${"Quantité " + x.n} value=${Math.round(x.g)} onChange=${(e) => upd(i, e.target.value)} /><span>g</span></label><span className="it-k">${fmtN(x.kcal, 0)} kcal</span>`}
      <button type="button" className="x sm" aria-label=${"Retirer " + x.n} onClick=${() => del(i)}>×</button></div>`)}</div>` : html`<p className="muted small">Aucun aliment reconnu.</p>`}
    ${eq ? null : html`<div className="tot-line"><b>${fmtN(tot.kcal, 0)} kcal</b><span>P ${fmtN(tot.p, 0)} g · G ${fmtN(tot.c, 0)} g · L ${fmtN(tot.f, 0)} g</span></div>`}
    ${draft.comment ? html`<p className="small">${draft.comment}</p>` : null}
    ${draft.advice ? html`<p className="small note">${draft.advice}</p>` : null}
  </div>`;
}
function SlotPick({ value, onChange }) { return html`<${Field} label="Moment"><${Seg} options=${SLOTS.map((s) => ({ v: s.id, n: s.n }))} value=${value} onChange=${onChange} /></${Field}>`; }
function parseMeal(j, src) {
  const items = Array.isArray(j && j.items) ? j.items.map(mkItem).filter((x) => x.n) : [];
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
    : '{"titre": "Poulet, riz et brocolis", "items": [{"n": "Riz basmati cuit", "g": 180, "kcal": 230, "p": 5, "c": 50, "f": 1}], "confiance": "faible" | "moyenne" | "bonne", "verdict": "bon" | "correct" | "a_ameliorer", "commentaire": "1 à 2 phrases, tutoiement, par rapport à ses cibles du jour", "conseil": "une suggestion concrète pour ce repas ou le suivant"}';
  return [head, nutriShort(np, tot), kind === "photo" && note ? "Précision du client : " + note : "", how, eq ? "Ne donne aucun chiffre de calories ou de macros." : "Les valeurs nutritionnelles sont celles de la quantité estimée (pas pour 100 g).", "Réponds uniquement avec un objet JSON de cette forme : " + fmt].filter(Boolean).join("\n");
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
  const ctl = useRef(null);
  const url = useObjectURL(file);
  useEffect(() => () => { try { ctl.current && ctl.current.abort(); } catch (e) {} }, []);
  const analyze = async () => {
    if (!ai.sample) return;
    setBusy(true); setErr(""); setDraft(null);
    const c = new AbortController(); ctl.current = c;
    try {
      const j = mode === "photo"
        ? await ai.sample.json(mealPrompt("photo", np, tot, slot, note.trim()), { images: [file], signal: c.signal })
        : await ai.sample.json(mealPrompt("texte", np, tot, slot, note.trim()), { modelTier: "quick", signal: c.signal });
      setDraft(parseMeal(j, mode));
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
    ${mode === "manuel" ? html`<${FoodPicker} onPick=${(it) => setFdraft({ ...fdraft, items: [...fdraft.items, it] })} />
      ${fdraft.items.length ? html`<${Card}><${MealEditor} draft=${{ ...fdraft, title: man.n.trim() || "Mon repas" }} setDraft=${(d) => setFdraft({ ...fdraft, items: d.items })} eq=${eq} /></${Card}>` : null}
      <${Field} label=${fdraft.items.length ? "Nom du repas (facultatif)" : "Repas"} id="mn-n"><input id="mn-n" value=${man.n} onChange=${(e) => setMan({ ...man, n: e.target.value })} placeholder="Ex. Salade de pâtes" /></${Field}>
      ${eq ? null : html`${fdraft.items.length ? html`<p className="muted small">Autre chose à ajouter ? Indique ses valeurs ci-dessous (facultatif).</p>` : null}<div className="row4"><${Field} label="kcal" id="mn-k"><input id="mn-k" inputMode="numeric" value=${man.kcal} onChange=${(e) => setMan({ ...man, kcal: e.target.value })} /></${Field}>
        <${Field} label="Protéines (g)" id="mn-p"><input id="mn-p" inputMode="decimal" value=${man.p} onChange=${(e) => setMan({ ...man, p: e.target.value })} /></${Field}>
        <${Field} label="Glucides (g)" id="mn-c"><input id="mn-c" inputMode="decimal" value=${man.c} onChange=${(e) => setMan({ ...man, c: e.target.value })} /></${Field}>
        <${Field} label="Lipides (g)" id="mn-f"><input id="mn-f" inputMode="decimal" value=${man.f} onChange=${(e) => setMan({ ...man, f: e.target.value })} /></${Field}></div>`}` : null}
    ${busy ? html`<div className="actions"><span className="muted small">Le coach IA regarde ${mode === "photo" ? "ta photo" : "ton repas"}… (10 à 40 s)</span><${Btn} kind="quiet" small onClick=${() => ctl.current && ctl.current.abort()}>Stop</${Btn}></div>` : null}
    ${err ? html`<p className="small warn-t">${err}</p>` : null}
    ${draft ? html`<${Card}><${MealEditor} draft=${draft} setDraft=${setDraft} eq=${eq} /></${Card}>
      <p className="muted small">${eq ? "" : "Estimation à partir de la photo : compte ±20 à 30 %. Corrige les quantités si besoin."}</p>` : null}
    ${mode === "manuel" && !eq ? html`<p className="muted small">Aliments courants : valeurs moyennes indicatives. Pour un produit emballé, scanne son code-barres.</p>` : null}
    ${draft || mode === "manuel" ? html`<div className="actions"><${Btn} onClick=${add} disabled=${mode === "manuel" && !man.n.trim() && !man.kcal && !fdraft.items.length}>Ajouter au journal</${Btn}>${draft ? html`<${Btn} kind="quiet" onClick=${analyze} disabled=${busy}>Relancer l'analyse</${Btn}>` : null}</div>` : null}
  </div>`;
}

/* ---------- scan d'un produit ---------- */
function productPrompt(np, tot, ean, n) {
  return ["Tâche : analyse_produit. " + (n > 1 ? "Les photos montrent" : "La photo montre") + " un produit alimentaire emballé (face avant, tableau des valeurs nutritionnelles ou code-barres)." + (ean ? " Code-barres lu : " + ean + "." : ""),
    "Lis les valeurs pour 100 g (ou 100 ml) sur le tableau nutritionnel. Si le tableau n'est pas visible ou pas lisible, mets \"lisible\": false ; donne alors des valeurs typiques avec \"estime\": true seulement si tu reconnais le produit avec certitude, sinon mets les valeurs à null.",
    nutriShort(np, tot),
    'Réponds uniquement avec un objet JSON de cette forme : {"produit": "Skyr nature", "marque": "…", "ean": "les chiffres du code-barres s\'ils sont lisibles, sinon null", "lisible": true, "estime": false, "pour100": {"kcal": 64, "p": 11, "c": 4, "f": 0.2, "sucres": 4, "fibres": 0, "sel": 0.1}, "portion_g": 150, "nutriscore": "A", "verdict": "bon" | "occasionnel" | "a_limiter", "commentaire": "1 à 2 phrases pour ce client", "alternative": "une alternative plus intéressante si utile, sinon null"}'].join("\n");
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
  const [f, setF] = useState(() => np && np.form ? { ...np.form } : { sex: "", age: p.birthYear ? String(new Date().getFullYear() - p.birthYear) : "", height: "", weight: lw ? String(lw.v) : "", goal: prog && prog.id === "masse" ? "prise" : prog && prog.id === "perte" ? "perte" : "maintien", delta: "", months: "3", act: 1.35, prefs: "", preg: false, ted: false });
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
      <p className="small">Glucides ${fmtN(calc.targets.c, 0)} g · lipides ${fmtN(calc.targets.f, 0)} g · eau ${fmtN(calc.targets.water, 1)} L · dépense estimée ${fmtN(calc.tdee, 0)} kcal par jour.</p>
      ${f.goal !== "maintien" ? html`<p className="small">Rythme : ${fmtN(Math.abs(calc.rate), 2)} kg par semaine → ${fmtN(calc.target, 1)} kg vers le ${fmtD(addDays(todayISO(), Math.round((calc.weeksReal || weeks) * 7)))}.</p>` : null}
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
      ${ia ? html`<p className="small note">Ajusté par le coach IA le ${fmtD(ia.at)} : ${ia.reason}</p>` : null}</${Card}>
    ${np.goal !== "maintien" ? html`<${Card} title="Ma trajectoire" sub=${exp !== null ? "Prévu aujourd'hui : " + fmtN(exp) + " kg" + (lw ? " · dernière pesée : " + fmtN(lw.v) + " kg" : "") : null}><${TrajChart} np=${np} pts=${weightPoints(data)} /></${Card}>` : null}`}
    <${Card} title="La méthode" sub="Sur quoi reposent tes cibles">
      <p className="small">${np.mode === "equilibre" ? "Les repas réguliers et l'écoute de la faim comptent plus que les chiffres. Noter ses repas aide à prendre conscience de ses habitudes (Burke, 2011)." : "Dépense au repos estimée par l'équation de Mifflin-St Jeor (1990), multipliée par ton activité, plus tes séances. Déficit limité à 25 % et perte d'au plus 1 % du poids par semaine pour préserver le muscle (Helms, 2014) ; protéines autour de 1,6 à 1,8 g par kg (Morton, 2018). La perte réelle ralentit avec le temps (Hall, 2011) : le coach IA ajuste tes cibles selon tes pesées."}</p>
      <details><summary>Références scientifiques</summary><ol className="refs">${NUTRI_REFS.map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></details></${Card}>
    <div className="actions"><${Btn} kind="ghost" onClick=${onEdit}>Modifier mon objectif</${Btn}></div>
    <p className="muted small">Ces repères ne remplacent pas un avis médical ou celui d'un diététicien, en particulier en cas de maladie ou de traitement.</p>
  </div>`;
}

/* ---------- onglet Nutrition du client ---------- */
function NutritionTab({ data, src, plan, prog, settings, db }) {
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
  const v = dayVerdict(np, tot, (day.meals || []).length, isToday);
  const canAI = conf.on && ai.sample;
  const addMeal = async (meal) => {
    const cur = src.get().food[date] || { meals: [] };
    try { await src.saveFood(date, { meals: [...(cur.meals || []), meal], updatedAt: nowISO() }); toast("Repas ajouté.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  const delMeal = async (id) => { const cur = src.get().food[date] || { meals: [] }; await src.saveFood(date, { meals: (cur.meals || []).filter((m) => m.id !== id), updatedAt: nowISO() }); };
  const saveNp = async (x) => { try { await src.saveNutri(x); setEdit(false); setSub("journal"); toast("Objectif enregistré.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 6)).map((d) => ({ x: JOURS[parseISO(d).getDay()].slice(0, 3) + ".", y: Math.round(dayTotals(data.food[d]).kcal), muted: d === todayISO() }));
  const bySlot = SLOTS.map((s) => ({ ...s, meals: (day.meals || []).filter((m) => m.slot === s.id) })).filter((s) => s.meals.length);
  return html`<div className="stack">
    <div className="hero"><div className="eyebrow">Nutrition</div><h1>${np ? (eq ? "Des repas équilibrés, sans compter." : nutriGoalText(np).replace(/^./, (c) => c.toUpperCase()).replace(/, départ.*$/, "") + ".") : "Fixe ton objectif en 1 minute."}</h1></div>
    ${np ? html`<div className="tabs-scroll"><${Seg} options=${[{ v: "journal", n: "Mon journal" }, { v: "objectif", n: "Mon objectif" }]} value=${sub} onChange=${(x) => { setSub(x); setEdit(false); }} /></div>` : null}
    ${sub === "objectif" && (edit || !np) ? html`<${NutriSetup} data=${data} plan=${plan} prog=${prog} onSave=${saveNp} onCancel=${np ? () => setEdit(false) : null} />` : null}
    ${sub === "objectif" && np && !edit ? html`<${NutriPlanView} np=${np} data=${data} onEdit=${() => setEdit(true)} />` : null}
    ${sub === "journal" && np ? html`
      <div className="daynav"><button type="button" className="x" aria-label="Jour précédent" onClick=${() => setDate(addDays(date, -1))}>‹</button>
        <b>${isToday ? "Aujourd'hui" : JOURS[parseISO(date).getDay()] + " " + fmtD(date)}</b>
        <button type="button" className="x" aria-label="Jour suivant" disabled=${isToday} onClick=${() => setDate(addDays(date, 1))}>›</button></div>
      ${eq ? null : html`<div className="today-grid"><${Ring} value=${np.targets.kcal ? tot.kcal / np.targets.kcal : 0} label=${fmtN(tot.kcal, 0)} sub=${"/ " + fmtN(np.targets.kcal, 0) + " kcal"} size=${124} />
        <div className="stack-s" style=${{ flex: 1 }}><${MacroBars} tot=${tot} t=${np.targets} /></div></div>`}
      ${v ? html`<div className=${"alert " + (v.t === "warn" ? "warn" : v.t === "ok" ? "okb" : "")}><div><b>${v.n}</b><p>${v.d}</p></div></div>` : null}
      <div className="addrow">
        ${canAI && ai.images ? html`<button type="button" className="addbtn" onClick=${() => setModal("photo")}><span className="ab-i">📷</span><b>Photo du repas</b><small>calories estimées</small></button>` : null}
        <button type="button" className="addbtn" onClick=${() => setModal("scan")}><span className="ab-i">▥</span><b>Scanner un produit</b><small>code-barres</small></button>
        ${canAI ? html`<button type="button" className="addbtn" onClick=${() => setModal("texte")}><span className="ab-i">✎</span><b>Décrire</b><small>en une phrase</small></button>` : null}
        <button type="button" className="addbtn" onClick=${() => setModal("manuel")}><span className="ab-i">＋</span><b>Saisir</b><small>à la main</small></button>
      </div>
      ${!canAI && ai.ready && !window.IS_SITE ? html`<p className="muted small">${conf.on ? "Photo, description et lecture d'étiquette demandent d'ouvrir l'application connecté à ton compte Claude." : "Ton coach a désactivé le coach IA."}</p>` : null}
      ${bySlot.length ? bySlot.map((s) => html`<${Card} key=${s.id} title=${s.n} action=${eq ? null : html`<span className="muted small">${fmtN(sumItems(s.meals).kcal, 0)} kcal</span>`}>
        ${s.meals.map((m) => html`<div key=${m.id} className="meal">
          <div className="meal-h"><b>${m.title}</b>${VERDICT[m.verdict] ? html`<${Pill} tone=${VERDICT[m.verdict].t}>${VERDICT[m.verdict].n}</${Pill}>` : null}<button type="button" className="linkbtn" onClick=${() => delMeal(m.id)}>Supprimer</button></div>
          <p className="muted small">${(m.items || []).map((x) => x.n + (eq || !x.g ? "" : " " + Math.round(x.g) + " g")).join(" · ")}${eq ? "" : " — " + fmtN(m.kcal, 0) + " kcal · P " + fmtN(m.p, 0) + " g"}</p>
          ${m.comment ? html`<p className="small">${m.comment}</p>` : null}</div>`)}</${Card}>`) : html`<${Empty} title="Aucun repas noté" text=${canAI ? "Prends ton repas en photo, scanne un produit ou décris-le." : "Scanne un produit ou ajoute tes aliments en quelques secondes."} />`}
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
  return html`<button type="button" className="nutri-mini" onClick=${() => go("nutrition")}>
    <div className="nm-h"><b>Nutrition du jour</b><span className="muted small">${plural(n, "repas", "repas")} noté${n > 1 ? "s" : ""}</span></div>
    ${np.mode === "equilibre" ? html`<span className="small">Ajoute tes repas pour un retour sur l'équilibre de ton assiette.</span>` : html`<${Bar} value=${tot.kcal / (np.targets.kcal || 1)} /><span className="small">${fmtN(tot.kcal, 0)} / ${fmtN(np.targets.kcal, 0)} kcal · protéines ${fmtN(tot.p, 0)} / ${fmtN(np.targets.p, 0)} g</span>`}
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
    ${eq ? null : html`<${Card} title="14 derniers jours"><${BarChart} data=${series} unit="kcal" target=${np.targets.kcal} /></${Card}>`}
    ${recent.map((d) => html`<${Card} key=${d} title=${JOURS[parseISO(d).getDay()] + " " + fmtD(d)} action=${eq ? null : html`<span className="muted small">${fmtN(dayTotals(data.food[d]).kcal, 0)} kcal · P ${fmtN(dayTotals(data.food[d]).p, 0)} g</span>`}>
      <ul className="loglist">${(data.food[d].meals || []).map((m) => html`<li key=${m.id}><b>${slotName(m.slot)}</b> · ${m.title}${eq ? "" : " · " + fmtN(m.kcal, 0) + " kcal"}${m.src ? html` <small className="muted">(${{ photo: "photo", produit: "scan", texte: "description", manuel: "saisie" }[m.src] || m.src})</small>` : null}</li>`)}</ul></${Card}>`)}
  </div>`;
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
