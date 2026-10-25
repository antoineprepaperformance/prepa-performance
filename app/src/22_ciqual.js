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
  useEffect(() => { let on = true; if (!_ciq) ciqLoad().then((x) => { if (on && x) setT(x); }); return () => { on = false; }; }, []);
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
