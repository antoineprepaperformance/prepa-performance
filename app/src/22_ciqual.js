/* ===== Valeurs nutritionnelles officielles : table Ciqual de l'ANSES =====
   Application Claude : table intégrée à la page. Site : fichier ciqual.json, remis à jour chaque mois par le robot
   GitHub du dépôt quand l'ANSES publie une nouvelle version. Les aliments courants et les ingrédients des recettes
   portent leur code Ciqual : leurs valeurs sont relues dans la table dès qu'elle est chargée. */
const CIQ_INFO = CONTENT.CIQ || { v: "", date: "", src: "" };
let _ciq = null, _ciqP = null;
const CIQ_STOP = new Set("de du des la le les l d au aux a en et avec sans pour ou un une sur type par ex".split(" "));
function ciqNorm(s) { return String(s || "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
/* mots sans accents, sans mots outils, au singulier (sauf « pâtes », à ne pas confondre avec « pâté ») */
function ciqToks(s) { return (ciqNorm(s).match(/[a-z0-9]+/g) || []).filter((w) => !CIQ_STOP.has(w)).map((w) => (w.length > 3 && w !== "pates" ? w.replace(/(s|x)$/, "") : w)); }
function ciqParse(j) {
  if (!j || !Array.isArray(j.f) || j.f.length < 1000) return null;
  const G = j.groupes || [];
  const rows = j.f.map((r) => ({ code: r[0], nom: String(r[1] || ""), grp: G[r[2]] || "", kcal: r[3], p: r[4], c: r[5], f: r[6], s: r[7], fi: r[8], sel: r[9] }));
  const by = {};
  rows.forEach((r) => { r.t = ciqToks(r.nom); r.moy = /aliment moyen/i.test(r.nom); by[r.code] = r; });
  return { v: String(j.v || ""), date: String(j.date || ""), src: String(j.src || ""), rows, by };
}
/* les aliments courants et les ingrédients des recettes reprennent les valeurs de la table chargée */
function ciqApply(t) {
  const set = (d, i, r) => { d[i] = r.kcal; d[i + 1] = r.p || 0; d[i + 2] = r.c || 0; d[i + 3] = r.f || 0; };
  (typeof FOODS !== "undefined" ? FOODS : []).forEach((fd) => { const r = fd[6] && t.by[fd[6]]; if (r && r.kcal !== null && r.kcal !== undefined) set(fd, 1, r); });
  (typeof PLATS !== "undefined" ? PLATS : []).forEach((p) => (p.i || []).forEach((fd) => { const r = fd[6] && t.by[fd[6]]; if (r && r.kcal !== null && r.kcal !== undefined) set(fd, 1, r); }));
  if (typeof ING !== "undefined") Object.values(ING).forEach((d) => { const r = d && d[7] && t.by[d[7]]; if (r && r.kcal !== null && r.kcal !== undefined) set(d, 1, r); });
}
function ciqLoad() {
  if (_ciq) return Promise.resolve(_ciq);
  if (!_ciqP) _ciqP = (async () => {
    let j = null;
    const el = typeof document !== "undefined" && document.getElementById("ciqual-data");
    if (el) { try { j = JSON.parse(el.textContent); } catch (e) { j = null; } }
    if (!j && window.IS_SITE && typeof fetch === "function") {
      try { const r = await fetch("ciqual.json", { cache: "no-cache" }); if (r.ok) j = await r.json(); } catch (e) { j = null; }
    }
    const t = ciqParse(j);
    if (!t) { _ciqP = null; return null; }
    _ciq = t; ciqApply(t);
    return t;
  })();
  return _ciqP;
}
function useCiqual() {
  const [t, setT] = useState(_ciq);
  /* la table peut avoir été chargée entre le premier rendu et cet effet (par un autre composant affiché en même temps) */
  useEffect(() => { let on = true; if (_ciq) { if (t !== _ciq) setT(_ciq); } else ciqLoad().then((x) => { if (on && x) setT(x); }); return () => { on = false; }; }, []);
  return t;
}
function ciqLabel(t) {
  const x = t || _ciq || CIQ_INFO;
  return "table Ciqual " + (x.v || "") + " de l'ANSES" + (x.date ? " (version du " + fmtDY(x.date) + ")" : "");
}
/* recherche : tous les mots tapés doivent se retrouver (le dernier peut être le début d'un mot) */
function ciqSearch(q, n) {
  const t = _ciq; if (!t) return [];
  const qt = ciqToks(q); if (!qt.length) return [];
  const last = qt.length - 1;
  const out = [];
  for (const r of t.rows) {
    if (r.kcal === null || r.kcal === undefined) continue;
    let hit = 0;
    for (let i = 0; i < qt.length; i++) { const q1 = qt[i]; if (r.t.some((w) => w === q1 || (i === last && q1.length >= 2 && w.startsWith(q1)))) hit++; else break; }
    if (hit < qt.length) continue;
    const head = r.t[0] === qt[0] || (qt.length === 1 && r.t[0] && r.t[0].startsWith(qt[0]));
    out.push([(head ? 1 : 0) + 1 / (1 + 0.25 * Math.max(0, r.t.length - qt.length)) + (r.moy ? 0.15 : 0), r]);
  }
  out.sort((a, b) => b[0] - a[0] || a[1].nom.length - b[1].nom.length);
  return out.slice(0, n || 8).map((x) => x[1]);
}
/* aliment le plus proche d'un nom donné par le coach IA : le premier mot (l'aliment) doit correspondre */
function ciqBest(name) {
  const t = _ciq; if (!t || !name) return null;
  const qt = ciqToks(name); if (!qt.length) return null;
  let best = null;
  for (const r of t.rows) {
    /* l'aliment est le premier mot du nom Ciqual, ou le deuxième (« Boeuf, steak haché », « Poulet, filet ») */
    const head = r.t[0] === qt[0] ? 0.5 : r.t[1] === qt[0] ? 0 : -1;
    if (r.kcal === null || r.kcal === undefined || head < 0) continue;
    let hit = 0; qt.forEach((q1) => { if (r.t.includes(q1)) hit++; });
    const cover = hit / qt.length;
    const sc = cover * 2 + head + 1 / (1 + 0.25 * Math.max(0, r.t.length - hit - (r.moy ? 2 : 0))) + (r.moy ? 0.1 : 0);
    if (!best || sc > best.sc) best = { sc, r, cover, hit };
  }
  if (!best || (best.cover < 1 && !(best.cover >= 0.66 && best.hit >= 2))) return null;
  return best.r;
}
/* aliment courant reconnu dans un nom : mêmes mots (exact), ou tous ses mots présents dans le nom ;
   « cuit » ou « cru » peuvent manquer */
function foodByName(name, exact) {
  const cook = /^(cuit|cuite|cru|crue)$/;
  const qa = ciqToks(name).filter((w) => !cook.test(w)); if (!qa.length) return null;
  const qt = new Set(qa);
  let best = null;
  (typeof FOODS !== "undefined" ? FOODS : []).forEach((fd) => {
    const ft = ciqToks(String(fd[0]).replace(/\(.*\)/, "")).filter((w) => !cook.test(w));
    if (!ft.length || !ft.every((w) => qt.has(w)) || (exact && ft.length !== qt.size)) return;
    if (!best || ft.length > best.n) best = { fd, n: ft.length };
  });
  return best ? best.fd : null;
}
function ciqRowItem(r, g, name) { return { ...mkItem({ n: name || r.nom, g, kcal: r.kcal * g / 100, p: (r.p || 0) * g / 100, c: (r.c || 0) * g / 100, f: (r.f || 0) * g / 100 }), ciq: r.code, ciqN: r.nom }; }
/* repas estimé par le coach IA : valeurs remplacées par celles de l'ANSES quand l'aliment est reconnu */
function ciqFix(it, hint) {
  if (!_ciq || !it || !(it.g > 0)) return it;
  const byFood = (fd) => (fd && fd[6] && _ciq.by[fd[6]]) || null;
  const r = byFood(foodByName(hint, true)) || ciqBest(hint) || byFood(foodByName(it.n, true)) || ciqBest(it.n) || byFood(foodByName(hint)) || byFood(foodByName(it.n));
  return r ? ciqRowItem(r, it.g, it.n) : { ...it, est: true };
}
/* changer l'aliment d'une ligne (quantité gardée) */
function CiqSwap({ item, onPick, onCancel }) {
  const t = useCiqual();
  const [q, setQ] = useState(item ? String(item.n || "").replace(/\(.*\)/, "").trim() : "");
  const res = t && q.trim().length >= 2 ? ciqSearch(q, 6) : [];
  return html`<div className="ciq-swap">
    <${Field} label="Chercher dans la table de l'ANSES" id="ciq-sw"><input id="ciq-sw" value=${q} onChange=${(e) => setQ(e.target.value)} autoComplete="off" /></${Field}>
    ${!t ? html`<p className="muted small">Chargement de la table…</p>` : res.length ? html`<div className="sugg">${res.map((r) => html`<button key=${r.code} type="button" onClick=${() => onPick(r)}><b>${r.nom}</b><span className="muted small">${fmtN(r.kcal, 0)} kcal / 100 g</span></button>`)}</div>` : q.trim().length >= 2 ? html`<p className="muted small">Aucun aliment trouvé : essaie un autre mot.</p>` : null}
    <button type="button" className="linkbtn" onClick=${onCancel}>Annuler</button></div>`;
}

/* ===== Portions « parlantes » (tranche, œuf moyen, cuillère à soupe…) : repères de content_nutri.py (MESURES) =====
   Une ligne de repas garde son poids (g) ; « q » × « u » (nombre × portion, « ug » grammes par portion) ne sert qu'à l'affichage.
   Pourquoi : sans balance, on estime mal les grammes ; les repères ménagers et les photos de portions aident
   (Amoutzopoulos et al., Nutr Rev 2020). */
const MESURES = (CONTENT.MESURES || []).map((m) => ({ grp: m.k.indexOf("grp:") === 0, re: new RegExp(m.k.replace(/grp:/g, "")), o: m.o, ml: !!m.ml }));
const PORTION_DEF = [["portion moyenne", 150], ["petite portion", 80], ["grosse portion", 250]];
function portionsOf(name, grp, defG) {
  const nn = ciqNorm(String(name || "").replace(/\s*\(.*\)\s*$/, "")), gg = ciqNorm(grp || "");
  const m = MESURES.find((x) => !x.grp && x.re.test(nn)) || (gg ? MESURES.find((x) => x.grp && x.re.test(gg)) : null);
  let o = m ? m.o : PORTION_DEF;
  if (!m && defG > 0 && !o.some((x) => x[1] === defG)) o = [["portion habituelle", defG]].concat(o);
  return o.map(([l, g]) => ({ l, g })).concat([{ l: m && m.ml ? "ml" : "g", g: 1, raw: true }]);
}
function itemPortions(it) {
  const r = it && it.ciq && _ciq ? _ciq.by[it.ciq] : null;
  const fd = !r && typeof FOODS !== "undefined" ? FOODS.find((f) => f[0].replace(/\s*\(.*\)$/, "") === it.n) : null;
  const o = portionsOf(it.ciqN || (fd ? fd[0] : it.n), r ? r.grp : "", fd ? fd[5] : 0);
  if (it.u && it.ug > 1 && !o.some((x) => x.l === it.u)) o.splice(o.length - 1, 0, { l: it.u, g: it.ug });
  return o;
}
function qFmt(q) { const w = Math.floor(q + 1e-9); if (Math.abs(q - w - 0.5) < 1e-6) return w ? w + "½" : "½"; return Math.abs(q - Math.round(q)) < 1e-6 ? String(Math.round(q)) : fmtN(q, 2); }
function pUnit(o) { return o[o.length - 1].l; }
/* nombre × portion qui décrit le mieux le poids d'une ligne (sinon les grammes) */
function portionView(it, opts) {
  const o = opts || itemPortions(it), raw = o[o.length - 1];
  if (it.u === raw.l) return { q: it.g, p: raw };
  if (it.u) { const p = o.find((x) => x.l === it.u && !x.raw); if (p && it.q > 0) return { q: it.q, p }; }
  let best = null;
  o.forEach((p, i) => {
    if (p.raw || !(it.g > 0)) return;
    const q = Math.round(it.g / p.g * 2) / 2; if (q < 0.5) return;
    if (q > 6 || (q > 2 && q % 1)) return;
    const err = Math.abs(q * p.g - it.g) / it.g, s = err + (i ? 0.02 : 0) + Math.max(0, q - 3) * 0.05 + (q % 1 ? 0.05 : 0);
    if (err <= 0.1 && (!best || s < best.s)) best = { s, q, p };
  });
  return best ? { q: best.q, p: best.p } : { q: Math.round(it.g), p: raw };
}
function setPortion(it, q, p) {
  const n = Math.max(0, num(q) || 0), g = p.raw ? n : n * p.g;
  return { ...scaleItem(it, g), q: n, u: p.l, ug: p.raw ? 1 : p.g };
}
function qtyText(it, o) { const v = portionView(it, o); return v.p.raw ? fmtN(v.q, 0) + " " + v.p.l : qFmt(v.q) + " × " + v.p.l; }
const QTYS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12];
function qtyList(q) { return QTYS.includes(q) ? QTYS : QTYS.concat([q]).sort((a, b) => a - b); }

/* ----- saisie en une phrase : « 2 parts de brioche, beurre de cacahuète et un œuf » ----- */
const Q_WORDS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, quinze: 15, vingt: 20, demi: 0.5, demie: 0.5, quelques: 3, plusieurs: 3 };
const Q_FRAC = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
const U_CANON = { cuilleree: "cuillere", scoop: "dose", mesurette: "dose", bout: "morceau", unite: "piece", gobelet: "verre", mug: "tasse", moitie: "demi" };
const U_WORDS = new Set("tranche part portion morceau pot bol verre tasse assiette poignee carre rondelle boite canette barre boule noisette pincee dose sachet paquet piece cuillere cuillersoupe cuillercafe rangee plaquette brique bouteille pinte louche quart demi".split(" "));
const S_WORDS = { petit: "petit", petite: "petit", gro: "gros", gros: "gros", grosse: "gros", grand: "gros", grande: "gros", moyen: "moyen", moyenne: "moyen", fin: "fin", fine: "fin", epai: "gros", epaisse: "gros" };
const GEN_U = { cuillersoupe: ["cuillère à soupe", 15], cuillercafe: ["cuillère à café", 5], cuillere: ["cuillère à soupe", 15], verre: ["verre", 200], bol: ["bol", 250], tasse: ["tasse", 150], poignee: ["poignée", 30], pot: ["pot", 125], tranche: ["tranche", 30], assiette: ["assiette moyenne", 150], pincee: ["pincée", 0.5], dose: ["dose (1 scoop)", 30] };
const F_ALIAS = { coca: "cola", pepsi: "cola", nutella: "pate a tartiner" };
function spoons(s) {
  return s.replace(/\b(?:c\.?\s*a\.?\s*s|cas|cs|c\.\s*s)\b\.?/g, " cuillersoupe ").replace(/\b(?:c\.?\s*a\.?\s*c|cac|cc|c\.\s*c)\b\.?/g, " cuillercafe ")
    .replace(/\b(?:grandes?|grosses?)\s+cuilleree?s?\b/g, " cuillersoupe ").replace(/\bpetites?\s+cuilleree?s?\b/g, " cuillercafe ")
    .replace(/\bcuilleree?s?\s+(?:a|de)\s+soupe\b/g, " cuillersoupe ").replace(/\bcuilleree?s?\s+(?:a|de)\s+cafe\b/g, " cuillercafe ");
}
function uToks(s) { return ciqToks(spoons(ciqNorm(s))).map((w) => S_WORDS[w] || U_CANON[w] || w); }
function quickChunks(text) {
  const s = ciqNorm(text).replace(/(\d),(\d)/g, "$1.$2").replace(/\b(\d+|un|une)\s+et\s+demie?\b/g, (m, a) => String((Q_WORDS[a] || num(a)) + 0.5));
  return s.split(/\s*(?:[,;\n+&]|\bet\b|\bavec\b|\bpuis\b|\bsur\b|\bdans\b)\s*/).map((c) => c.trim()).filter((c) => c.length >= 2);
}
function quickParse1(raw) {
  let s = spoons(raw).replace(/^(?:un peu d(?:e\b|')|environ\b|du\b|de la\b|de l'|des\b|de\b|d'|le\b|la\b|les\b|l')\s*/, ""), q = null, gUnit = 0, m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*/))) { q = m[2] ? num(m[1]) / num(m[2]) : num(m[1]); s = s.slice(m[0].length); }
  else if ((m = s.match(/^([½¼¾])\s*/))) { q = Q_FRAC[m[1]]; s = s.slice(m[0].length); }
  else if ((m = s.match(/^(?:un|une)\s+demie?\b\s*/))) { q = 0.5; s = s.slice(m[0].length); }
  else if ((m = s.match(/^([a-z]+)\b\s*/)) && Q_WORDS[m[1]] !== undefined && s.length > m[0].length) { q = Q_WORDS[m[1]]; s = s.slice(m[0].length); }
  if (q !== null && (m = s.match(/^(kg|g|gr|grammes?|ml|cl|l|litres?)\b\.?\s*/))) { gUnit = m[1] === "kg" || /^l/.test(m[1]) ? 1000 : m[1] === "cl" ? 10 : 1; s = s.slice(m[0].length); }
  const all = ciqToks(s).map((w) => U_CANON[w] || w);
  const unit = [], size = [];
  let i = 0;
  while (i < all.length - 1) {
    if (S_WORDS[all[i]]) size.push(S_WORDS[all[i]]); else if (U_WORDS.has(all[i])) unit.push(all[i]); else break;
    i++;
  }
  const food = all.slice(i).map((w) => F_ALIAS[w] || w).join(" ").split(" ");
  return { raw, q, gUnit, unit, size, food, all: all.filter((w) => !S_WORDS[w]).map((w) => F_ALIAS[w] || w).join(" ").split(" ") };
}
/* aliment d'une phrase : aliment courant le plus proche, sinon la table de l'ANSES */
function quickFood(toks) {
  const cook = /^(cuit|cuite|cru|crue)$/;
  const qa = (toks || []).filter((w) => w && !cook.test(w)); if (!qa.length) return null;
  const wantsRaw = toks.some((w) => /^crue?s?$/.test(w));
  let best = null;
  (typeof FOODS !== "undefined" ? FOODS : []).forEach((fd) => {
    if (wantsRaw && /cuit/.test(ciqNorm(fd[0]))) return;
    const ft = new Set(ciqToks(String(fd[0]).replace(/\([^()]*\d[^()]*\)/g, "")).filter((w) => !cook.test(w)));
    /* « céréales » : les céréales du petit-déjeuner plutôt que la barre de céréales (le premier mot compte) */
    if (ft.size && qa.every((w) => ft.has(w))) { const extra = ft.size - qa.length + (ft.values().next().value !== qa[0] ? 5 : 0); if (!best || extra < best.extra) best = { fd, extra }; }
  });
  if (best) return { fd: best.fd };
  const q = toks.join(" "), q0 = toks[0];
  /* un aliment prêt à manger : viande, poisson, pâtes… cuits, et pas en poudre, sauf si la phrase le dit */
  const odd = /poudre|deshydrat|lyophilis|soluble|concentre|\bfeuille|moulu|en grains?\b/;
  const raw = (x) => /\bcrue?s?\b|\bsec\b|seche/.test(ciqNorm(x.nom)) && /viande|poisson|mollusque|oeuf|pates, riz|legumineuse|pommes de terre/.test(ciqNorm(x.grp || ""));
  const ok = (x) => x && (odd.test(q) || !odd.test(ciqNorm(x.nom))) && (/\bcru|\bsec/.test(q) || !raw(x));
  let r = _ciq ? ciqBest(q) : null;
  /* « glace vanille » : une glace (aliment moyen) plutôt qu'un dessert qui en contient */
  if (r && r.t[0] !== q0 && r.t[1] === q0) { const m = _ciq.rows.find((x) => x.moy && x.t[0] === q0 && x.kcal !== null && x.kcal !== undefined); if (m) r = m; }
  if (r && !ok(r)) r = ciqSearch(q, 25).find(ok) || r;
  if (r) return { r };
  /* « gaufre au sucre » : l'aliment est le premier mot */
  const r1 = _ciq && toks.length > 1 ? ciqBest(q0) : null; if (r1 && ok(r1)) return { r: r1 };
  const fd = foodByName(q); if (fd && ciqToks(fd[0])[0] === q0) return { fd };
  const r2 = _ciq ? ciqSearch(q, 1)[0] : null;
  return r2 ? { r: r2 } : null;
}
function foodOpts(f) { const r = f.r || (f.fd[6] && _ciq ? _ciq.by[f.fd[6]] : null); return portionsOf(f.fd ? f.fd[0] : f.r.nom, r ? r.grp : "", f.fd ? f.fd[5] : 0); }
/* portion désignée par les mots de la phrase (« tranche », « grosse »…) parmi celles de l'aliment */
function quickPortion(o, unit, size) {
  let best = null, bs = 0;
  o.forEach((p) => {
    if (p.raw) return;
    const lt = uToks(p.l);
    if (unit.length && !unit.some((u) => lt.includes(u))) return;
    const s = unit.filter((u) => lt.includes(u)).length * 2 + size.filter((z) => lt.includes(z)).length - lt.length * 0.01;
    if (s > bs) { bs = s; best = p; }
  });
  return best;
}
function quickMake(f, ch) {
  const o = foodOpts(f);
  let p = null, n = ch.q === null ? 1 : ch.q;
  if (ch.gUnit) { p = o[o.length - 1]; n = (ch.q || 0) * ch.gUnit; }
  else if (ch.unit.length || ch.size.length) p = quickPortion(o, ch.unit, ch.size) || (ch.unit.length && GEN_U[ch.unit[0]] ? { l: GEN_U[ch.unit[0]][0], g: GEN_U[ch.unit[0]][1] } : null);
  /* « 1/2 avocat », « ½ baguette » : la moitié de l'aliment entier */
  if (!p && ch.q !== null && ch.q < 1) p = o.find((x) => /\bentiere?\b/.test(ciqNorm(x.l))) || null;
  p = p || o[0];
  const g = p.raw ? n : n * p.g;
  const it = f.fd ? foodItem(f.fd, g || 1) : ciqRowItem(f.r, g || 1, f.r.nom);
  return setPortion(it, n, p);
}
function quickItem(ch) {
  let f = quickFood(ch.food);
  /* « barre de céréales », « café au lait » : si le mot de mesure ne correspond à aucune portion, la phrase entière est l'aliment */
  if (ch.unit.length && (!f || !quickPortion(foodOpts(f), ch.unit, ch.size))) { const w = quickFood(ch.all); if (w) f = w; }
  return f ? quickMake(f, ch) : null;
}
