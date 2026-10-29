/* ===== Livre de recettes : recette de la semaine, goûts, portions adaptées, liste de courses, recettes IA ===== */
const ING = CONTENT.ING || {}, RECETTES = CONTENT.RECETTES || [], RECSCI = CONTENT.RECSCI || {}, RECSAISON = CONTENT.RECSAISON || {};
/* saisons des fruits et légumes (Manger Bouger) : P printemps (mars-mai), E été, A automne, H hiver (décembre-février) */
const SAISON_MOIS = { P: [3, 4, 5], E: [6, 7, 8], A: [9, 10, 11], H: [12, 1, 2] };
const SAISON_N = { P: "printemps", E: "été", A: "automne", H: "hiver" };
function seasonOf(d) { const m = Number(String(d || todayISO()).slice(5, 7)); return Object.keys(SAISON_MOIS).find((k) => SAISON_MOIS[k].includes(m)) || "A"; }
function recSeasonDate() { return typeof saisonDate === "function" ? saisonDate() : todayISO(); }
/* true : de saison ; false : un légume ou un fruit principal (30 g et plus) n'est pas de saison ; null : sans produit de saison */
function recSeason(r, s) {
  const main = recIng(r).filter((x) => x.g >= 30 && RECSAISON[x.k]);
  if (!main.length) return null;
  return main.every((x) => RECSAISON[x.k].includes(s));
}
/* l'événement du moment (fêtes, grandes compétitions), sauf si le client ou Antoine l'a coupé */
function recEvent(data, settings) {
  if (typeof saisonActive !== "function" || (typeof prefsOf === "function" && prefsOf(data && data.profile).saison === false)) return null;
  return saisonActive(recSeasonDate(), settings);
}
/* recette de l'événement : pendant toute la fête ; pour une grande compétition, seulement la dernière semaine (avant la finale) */
function recTheme(r, ed) {
  if (!ed || !r.theme) return false;
  if (r.theme.includes(ed.ev.id)) return true;
  if (ed.ev.kind !== "sport" || !r.theme.includes("sport")) return false;
  const d = diffDays(ed.date || recSeasonDate(), ed.main);
  return d >= 0 && d <= 6;
}
const REC_CAT = [{ v: "tout", n: "Tout" }, { v: "matin", n: "Petit-déjeuner" }, { v: "midi", n: "Déjeuner" }, { v: "soir", n: "Dîner" }, { v: "collation", n: "Collation" }];
const REC_SHARE = { matin: 0.25, midi: 0.35, soir: 0.3, collation: 0.12 };
const REC_SLOT = { matin: "matin", midi: "midi", soir: "soir", collation: "collation" };
const REGIMES = [{ v: "omnivore", n: "Je mange de tout" }, { v: "sans_porc", n: "Sans porc" }, { v: "pescetarien", n: "Pescétarien" }, { v: "vegetarien", n: "Végétarien" }, { v: "vegan", n: "Végétalien" }];
const EVITE = [["poisson", "Poisson"], ["fruits_de_mer", "Fruits de mer"], ["viande_rouge", "Viande rouge"], ["oeufs", "Œufs"], ["laitier", "Produits laitiers"], ["gluten", "Gluten"], ["fruits_coque", "Fruits à coque"], ["arachide", "Arachide"], ["soja", "Soja"], ["champignons", "Champignons"], ["epice", "Épicé"]];
const AIME = [["volaille", "Volaille"], ["boeuf", "Bœuf"], ["poisson", "Poisson"], ["oeufs", "Œufs"], ["legumineuses", "Légumineuses"], ["tofu", "Tofu"], ["pates", "Pâtes"], ["riz", "Riz"], ["pdt", "Pommes de terre"], ["fromage", "Fromage"], ["fruits", "Fruits"]];
const RAYONS = ["fruits et légumes", "boucherie", "poissonnerie", "frais", "boulangerie", "épicerie", "surgelés"];
function recIng(r) { return r.ing.map(([k, g]) => ({ k, g, d: ING[k] })).filter((x) => x.d); }
function recMacros(r, f) { const k = f || 1; return recIng(r).reduce((s, x) => ({ kcal: s.kcal + (x.d[1] * x.g * k) / 100, p: s.p + (x.d[2] * x.g * k) / 100, c: s.c + (x.d[3] * x.g * k) / 100, f: s.f + (x.d[4] * x.g * k) / 100 }), { kcal: 0, p: 0, c: 0, f: 0 }); }
function recFam(r) { const s = new Set(); recIng(r).forEach((x) => (x.d[6] || []).forEach((t) => s.add(t))); (r.tags || []).forEach((t) => s.add(t)); return s; }
function regimeOk(fam, regime) {
  if (regime === "vegan") return !["viande", "poisson", "fruits_de_mer", "oeufs", "laitier", "miel"].some((x) => fam.has(x));
  if (regime === "vegetarien") return !["viande", "poisson", "fruits_de_mer"].some((x) => fam.has(x));
  if (regime === "pescetarien") return !fam.has("viande");
  if (regime === "sans_porc") return !fam.has("porc");
  return true;
}
function recPrefs(data) { return { regime: "omnivore", evite: [], aime: [], fav: [], ...(((data.recettes || {}).prefs) || {}) }; }
function recAllowed(r, pr) { const fam = recFam(r); return regimeOk(fam, pr.regime) && !(pr.evite || []).some((x) => fam.has(x)); }
/* portion adaptée à l'objectif : part du repas dans la journée (pas en mode équilibre) */
function recFactor(r, np) {
  if (!np || np.mode === "equilibre" || !np.targets || !np.targets.kcal) return 1;
  const k = recMacros(r).kcal; if (!k) return 1;
  const f = (np.targets.kcal * (REC_SHARE[r.cat] || 0.3)) / k;
  return Math.round(clamp(f, 0.6, 1.8) * 20) / 20;
}
function recScore(r, pr, np) {
  const fam = recFam(r), m = recMacros(r);
  let s = (pr.aime || []).filter((x) => fam.has(x)).length * 2 + ((pr.fav || []).includes(r.id) ? 3 : 0);
  const goal = np && np.goal;
  if (goal === "perte") s += (m.p * 4) / Math.max(1, m.kcal) * 10;
  else if (goal === "prise") s += m.kcal / 200;
  return s;
}
function isoWeek(d) { const t = parseISO(d); const day = (t.getDay() + 6) % 7; t.setDate(t.getDate() - day + 3); const first = new Date(t.getFullYear(), 0, 4); return t.getFullYear() * 100 + 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getDay() + 6) % 7)) / 7); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
function weekRecipe(data, np, cid, settings) { return weekRecipeEd(data, np, cid, recEvent(data, settings)).r; }
/* recette de la semaine avec un événement déjà connu : celle de l'événement, sinon une recette de saison */
function weekRecipeEd(data, np, cid, ed) {
  const pr = recPrefs(data);
  const th = ed ? RECETTES.find((r) => recTheme(r, ed) && recAllowed(r, pr)) : null;
  return th ? { r: th, th: true } : { r: seasonRecipe(data, np, cid), th: false };
}
function seasonRecipe(data, np, cid) {
  const pr = recPrefs(data);
  const s = seasonOf(recSeasonDate());
  const rank = (r) => ({ true: 2, null: 1, false: 0 })[String(recSeason(r, s))];
  const pool = RECETTES.filter((r) => (r.cat === "midi" || r.cat === "soir") && recAllowed(r, pr) && recSeason(r, s) !== false)
    .sort((a, b) => rank(b) - rank(a) || recScore(b, pr, np) - recScore(a, pr, np)).slice(0, 8);
  if (!pool.length) return null;
  return pool[hashStr(String(cid || (data.profile && data.profile.name) || "") + isoWeek(todayISO())) % pool.length];
}
function gRound(g) { return g >= 20 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g)); }
function mealFromRecipe(r, f, slot) {
  const items = recIng(r).filter((x) => x.d[1] > 0).map((x) => mkItem({ n: x.d[0], g: gRound(x.g * f), kcal: (x.d[1] * x.g * f) / 100, p: (x.d[2] * x.g * f) / 100, c: (x.d[3] * x.g * f) / 100, f: (x.d[4] * x.g * f) / 100 }));
  const t = sumItems(items);
  return { id: rid("m"), slot: slot || REC_SLOT[r.cat] || slotNow(), at: nowISO(), src: "recette", title: r.n, items, kcal: t.kcal, p: t.p, c: t.c, f: t.f, verdict: "bon", comment: "" };
}
function shopText(lines) { return lines.map((g) => g.rayon.toUpperCase() + "\n" + g.items.map((x) => "- " + x.n + (x.g ? " : " + (x.g >= 1000 ? fmtN(x.g / 1000, 1) + " kg" : x.g + " g") : "")).join("\n")).join("\n\n"); }

/* pictogrammes des repas : soleil (matin), assiette et couverts (midi), lune (soir), pomme (collation) */
const REC_ICO = {
  matin: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  midi: "M13 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12M13 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M3 3v6a2 2 0 0 0 2 2v10M5 3v5M21 3c-1.5 1-2 3-2 6h2v12",
  soir: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  collation: "M12 7c-2-2-7-1.5-7 4c0 4 3 9 5 9c1 0 1.3-.6 2-.6s1 .6 2 .6c2 0 5-5 5-9c0-5.5-5-6-7-4zM12 7c0-2 1-4 3-4",
};
function RecipeCard({ r, np, eq, fav, onOpen, week, ed }) {
  const f = recFactor(r, np), m = recMacros(r, f);
  const sea = recSeason(r, seasonOf(recSeasonDate())) === true, th = recTheme(r, ed);
  return html`<button type="button" className=${"rcard" + (week ? " week" : "")} onClick=${onOpen}>
    <span className=${"rc-ico " + r.cat} aria-hidden="true"><${Icon} d=${REC_ICO[r.cat] || REC_ICO.midi} /></span>
    <span className="rc-t">${week ? html`<span className="eyebrow">${th ? "La recette du moment · " + ed.ev.n : "Recette de la semaine"}</span>` : null}<b>${r.n}${fav ? " ★" : ""}</b>
      ${sea || (th && !week) ? html`<span className="rc-tags">${th && !week ? html`<${Pill} tone="gold">${ed.ev.n}</${Pill}>` : null}${sea ? html`<${Pill} tone="ok">De saison</${Pill}>` : null}</span>` : null}
      <span className="muted small">${r.temps} min${eq ? "" : " · " + fmtN(m.kcal, 0) + " kcal · " + fmtN(m.p, 0) + " g de protéines"}${r.batch ? " · à préparer d'avance" : ""}${r.kind === "ia" ? " · créée par le coach IA" : ""}</span></span></button>`;
}
function RecipeView({ r, np, eq, data, src, onAddMeal, onClose }) {
  const toast = useToast();
  const pr = recPrefs(data);
  const f0 = recFactor(r, np);
  const [f, setF] = useState(f0);
  const [n, setN] = useState(r.batch ? 3 : 1);
  const [slot, setSlot] = useState(REC_SLOT[r.cat] || "midi");
  const m = recMacros(r, f);
  const fav = (pr.fav || []).includes(r.id);
  const setPrefs = async (x) => { try { await src.saveRecette("prefs", { ...pr, ...x }); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  const addList = async () => {
    const li = ((data.recettes || {}).liste) || { items: [], checks: {} };
    try { await src.saveRecette("liste", { ...li, items: [...(li.items || []).filter((x) => x.rid !== r.id), { rid: r.id, f, n }], at: nowISO() }); toast("Ajouté à ta liste de courses.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  return html`<div className="stack">
    <div className="chips"><${Pill} tone="gold">${r.temps} min</${Pill}>${r.batch ? html`<${Pill}>à préparer d'avance</${Pill}>` : null}${(r.tags || []).includes("avant_effort") ? html`<${Pill}>avant l'effort</${Pill}>` : null}${(r.tags || []).includes("apres_effort") ? html`<${Pill}>récupération</${Pill}>` : null}</div>
    ${eq ? html`<p className="small">Une assiette équilibrée : sers-toi selon ta faim.</p>` : html`<div className="rmacros"><div><b>${fmtN(m.kcal, 0)}</b><span>kcal</span></div><div><b>${fmtN(m.p, 0)} g</b><span>protéines</span></div><div><b>${fmtN(m.c, 0)} g</b><span>glucides</span></div><div><b>${fmtN(m.f, 0)} g</b><span>lipides</span></div></div>
      ${np && np.targets ? html`<p className="muted small">Portion ${f === 1 ? "standard" : "adaptée à ton objectif (×" + fmtN(f, 2) + ")"} : environ ${Math.round((REC_SHARE[r.cat] || 0.3) * 100)} % de tes ${fmtN(np.targets.kcal, 0)} kcal du jour.
        <button type="button" className="linkbtn" onClick=${() => setF(f === 1 ? f0 : 1)}>${f === 1 ? "Adapter à mon objectif" : "Portion standard"}</button></p>` : null}`}
    ${r.batch ? html`<${Field} label="Nombre de portions à préparer"><${Seg} options=${[1, 2, 3, 4].map((x) => ({ v: x, n: String(x) }))} value=${n} onChange=${setN} /></${Field}>` : null}
    <${Card} title="Ingrédients" sub=${n > 1 ? "Pour " + n + " portions" : "Pour 1 portion"}>
      <ul className="ring">${recIng(r).map((x) => html`<li key=${x.k}><span>${x.d[0]}</span><b>${x.d[1] === 0 && x.g <= 3 ? "" : gRound(x.g * f * n) + " g"}</b></li>`)}</ul>
      <p className="muted small">Poids crus. Vérifie la composition de tes produits (allergènes).</p></${Card}>
    <${Card} title="Préparation"><ol className="small rsteps">${r.etapes.map((e, k) => html`<li key=${k}>${e}</li>`)}</ol>${r.astuce ? html`<p className="note">${r.astuce}</p>` : null}</${Card}>
    <div className="row-end"><${Field} label="Repas" id="rc-slot"><select id="rc-slot" value=${slot} onChange=${(e) => setSlot(e.target.value)}>${SLOTS.map((s) => html`<option key=${s.id} value=${s.id}>${s.n}</option>`)}</select></${Field}>
      <${Btn} onClick=${() => { onAddMeal(mealFromRecipe(r, f, slot)); onClose && onClose(); }}>Ajouter à mon journal</${Btn}></div>
    <div className="btnrow"><${Btn} kind="ghost" small onClick=${addList}>Ajouter à ma liste de courses</${Btn}>
      <${Btn} kind="ghost" small onClick=${() => setPrefs({ fav: fav ? pr.fav.filter((x) => x !== r.id) : [...(pr.fav || []), r.id] })}>${fav ? "Retirer des favoris" : "Mettre en favori"}</${Btn}>
      ${r.kind === "ia" ? html`<${Btn} kind="quiet" small onClick=${async () => { await src.saveRecette(r.id, null); onClose && onClose(); }}>Supprimer</${Btn}>` : null}</div>
    ${r.kind === "ia" && r.estimated ? html`<p className="muted small">Valeurs estimées par le coach IA pour les ingrédients absents de la table : elles peuvent varier de ±20 %.</p>` : null}
  </div>`;
}
function TastesForm({ data, src, onDone }) {
  const toast = useToast();
  const pr = recPrefs(data);
  const [f, setF] = useState({ regime: pr.regime, evite: pr.evite || [], aime: pr.aime || [] });
  const tog = (k, v) => setF((o) => ({ ...o, [k]: o[k].includes(v) ? o[k].filter((x) => x !== v) : [...o[k], v] }));
  const save = async () => { try { await src.saveRecette("prefs", { ...pr, ...f, at: nowISO() }); toast("Goûts enregistrés.", "ok"); onDone(); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  return html`<div className="form">
    <${Field} label="Mon alimentation"><select id="rc-reg" value=${f.regime} onChange=${(e) => setF({ ...f, regime: e.target.value })}>${REGIMES.map((x) => html`<option key=${x.v} value=${x.v}>${x.n}</option>`)}</select></${Field}>
    <div className="field"><span className="field-l">J'évite</span><div className="chips" role="group" aria-label="J'évite">${EVITE.map(([k, n]) => html`<button key=${k} type="button" className=${"chipbtn" + (f.evite.includes(k) ? " on" : "")} aria-pressed=${f.evite.includes(k)} onClick=${() => tog("evite", k)}>${n}</button>`)}</div></div>
    <div className="field"><span className="field-l">J'aime</span><div className="chips" role="group" aria-label="J'aime">${AIME.map(([k, n]) => html`<button key=${k} type="button" className=${"chipbtn" + (f.aime.includes(k) ? " on" : "")} aria-pressed=${f.aime.includes(k)} onClick=${() => tog("aime", k)}>${n}</button>`)}</div></div>
    <p className="muted small">Pour une allergie ou une intolérance, vérifie toujours les étiquettes : ce filtre ne remplace pas un avis médical.</p>
    <${Btn} onClick=${save}>Enregistrer mes goûts</${Btn}></div>`;
}
function ShopList({ data, src, all }) {
  const toast = useToast();
  const li = ((data.recettes || {}).liste) || { items: [], checks: {} };
  const byId = Object.fromEntries(all.map((r) => [r.id, r]));
  const agg = {};
  (li.items || []).forEach((it) => { const r = byId[it.rid]; if (!r) return; recIng(r).forEach((x) => { if (x.d[1] === 0 && x.g <= 3) { agg[x.k] = agg[x.k] || { g: 0 }; return; } agg[x.k] = { g: ((agg[x.k] && agg[x.k].g) || 0) + x.g * (it.f || 1) * (it.n || 1) }; }); });
  const groups = RAYONS.map((rayon) => ({ rayon, items: Object.entries(agg).filter(([k]) => ING[k][5] === rayon).map(([k, v]) => ({ k, n: ING[k][0], g: v.g ? gRound(v.g) : 0 })) })).filter((g) => g.items.length);
  const save = (x) => src.saveRecette("liste", { ...li, ...x, at: nowISO() }).catch(() => toast("Enregistrement impossible.", "bad"));
  if (!(li.items || []).length) return html`<${Empty} title="Liste de courses vide" text="Ouvre une recette et choisis « Ajouter à ma liste de courses »." />`;
  return html`<div className="stack">
    <${Card} title="Recettes de la liste">${li.items.map((it) => byId[it.rid] ? html`<div key=${it.rid} className="hist"><div className="hist-h"><b>${byId[it.rid].n}</b><span className="muted small">${it.n > 1 ? it.n + " portions" : "1 portion"}</span></div>
      <button type="button" className="linkbtn" onClick=${() => save({ items: li.items.filter((x) => x.rid !== it.rid) })}>Retirer</button></div>` : null)}</${Card}>
    ${groups.map((g) => html`<${Card} key=${g.rayon} title=${g.rayon.replace(/^./, (c) => c.toUpperCase())}>${g.items.map((x) => html`<label key=${x.k} className="chk shop"><input type="checkbox" checked=${!!(li.checks || {})[x.k]} onChange=${(e) => save({ checks: { ...(li.checks || {}), [x.k]: e.target.checked } })} /><span>${x.n}${x.g ? html` <b>${x.g >= 1000 ? fmtN(x.g / 1000, 1) + " kg" : x.g + " g"}</b>` : null}</span></label>`)}</${Card}>`)}
    <div className="btnrow"><${Btn} kind="ghost" small onClick=${() => { try { navigator.clipboard.writeText(shopText(groups)).then(() => toast("Liste copiée.", "ok"), () => toast("Copie impossible ici : utilise le téléchargement.", "warn")); } catch (e) { toast("Copie impossible ici.", "warn"); } }}>Copier la liste</${Btn}>
      <${Btn} kind="ghost" small onClick=${() => saveText("liste-de-courses.txt", shopText(groups))}>Télécharger</${Btn}>
      <${Btn} kind="quiet" small onClick=${() => save({ items: [], checks: {} })}>Vider la liste</${Btn}></div>
  </div>`;
}
/* recette créée par le coach IA (version Claude) */
function matchIng(name) { const t = normTxt(name); let best = null; for (const [k, d] of Object.entries(ING)) { const n = normTxt(d[0]).replace(/\(.*\)/, "").trim(); const head = n.split(" ")[0]; if (t.includes(n) || (head.length > 3 && t.includes(head))) { if (!best || n.length > best.n.length) best = { k, n }; } } return best ? best.k : null; }
function AIRecipe({ data, np, ai, src, onDone }) {
  const toast = useToast();
  const pr = recPrefs(data);
  const [f, setF] = useState({ cat: "soir", temps: 20, frigo: "", envie: "" });
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const target = np && np.targets && np.mode !== "equilibre" ? Math.round(np.targets.kcal * (REC_SHARE[f.cat] || 0.3)) : null;
    const prompt = ["Tu es le coach nutrition (intelligence artificielle) d'Antoine Limousi, préparateur physique. Propose UNE recette simple pour un sportif, en français.",
      "Repas : " + (REC_CAT.find((x) => x.v === f.cat) || {}).n + ". Temps maximum : " + f.temps + " minutes.",
      target ? "Vise environ " + target + " kcal et au moins " + Math.round(np.targets.p * (REC_SHARE[f.cat] || 0.3)) + " g de protéines pour la portion." : "Portion normale, sans chiffres de calories (mode équilibre).",
      "Régime : " + (REGIMES.find((x) => x.v === pr.regime) || {}).n + ". À éviter absolument : " + ((pr.evite || []).map((k) => (EVITE.find((x) => x[0] === k) || [k, k])[1]).join(", ") || "rien") + ". Aime : " + ((pr.aime || []).map((k) => (AIME.find((x) => x[0] === k) || [k, k])[1]).join(", ") || "—") + ".",
      f.frigo ? "Ingrédients disponibles : " + f.frigo + "." : "", f.envie ? "Envie : " + f.envie + "." : "",
      "Aliments simples, peu transformés. Pas de compléments alimentaires. Poids en grammes, crus.",
      aiLang("« n », « etapes » et « astuce » sont dans cette langue ; garde le « nom » de chaque ingrédient en français (il sert à retrouver ses valeurs nutritionnelles)."),
      'Réponds en JSON strict : {"n": "nom", "temps": 20, "ingredients": [{"nom": "...", "g": 120}], "etapes": ["..."], "astuce": "une phrase", "kcal": 600, "p": 40, "c": 60, "f": 18}.'].filter(Boolean).join("\n");
    try {
      const j = await ai.sample.json(prompt, { modelTier: "default" });
      const ing = []; let unknownG = 0, totalG = 0; const extra = [];
      (j.ingredients || []).slice(0, 14).forEach((x) => { const g = num(x.g) || 0; totalG += g; const k = matchIng(x.nom || ""); if (k) ing.push([k, g]); else { unknownG += g; extra.push(x.nom + (g ? " (" + g + " g)" : "")); } });
      const id = rid("r");
      const r = { id, kind: "ia", n: String(j.n || "Recette du coach IA").slice(0, 80), cat: f.cat, temps: num(j.temps) || f.temps, ing, etapes: (j.etapes || []).slice(0, 8).map(String), tags: [], portions: 1, astuce: (j.astuce ? String(j.astuce) + " " : "") + (extra.length ? "Aussi : " + extra.join(", ") + "." : ""), estimated: unknownG > totalG * 0.3, at: nowISO() };
      if (!r.ing.length) throw new Error("vide");
      await src.saveRecette(id, r); toast("Recette ajoutée à ton livre.", "ok"); onDone(r);
    } catch (e) { toast(e && e.message === "vide" ? "Recette inutilisable : réessaie." : aiErr(e) || "Réessaie.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="form">
    <${Field} label="Pour quel repas ?"><${Seg} options=${REC_CAT.filter((x) => x.v !== "tout")} value=${f.cat} onChange=${(v) => setF({ ...f, cat: v })} /></${Field}>
    <${Field} label="Temps maximum"><${Seg} options=${[10, 20, 30, 45].map((x) => ({ v: x, n: x + " min" }))} value=${f.temps} onChange=${(v) => setF({ ...f, temps: v })} /></${Field}>
    <${Field} label="Ce que tu as dans le frigo (facultatif)" id="ai-frigo"><input id="ai-frigo" value=${f.frigo} onChange=${(e) => setF({ ...f, frigo: e.target.value })} placeholder="Ex. poulet, courgettes, riz, feta" /></${Field}>
    <${Field} label="Une envie ? (facultatif)" id="ai-envie"><input id="ai-envie" value=${f.envie} onChange=${(e) => setF({ ...f, envie: e.target.value })} placeholder="Ex. quelque chose d'épicé, un plat chaud" /></${Field}>
    <p className="muted small">Le coach IA est une intelligence artificielle : il tient compte de ton objectif et de tes goûts. Les valeurs sont recalculées avec la table des aliments quand c'est possible.</p>
    <${Btn} onClick=${go} disabled=${busy}>${busy ? "Le coach IA cuisine… (10 à 40 s)" : "Créer ma recette"}</${Btn}></div>`;
}
function RecipesTab({ data, src, np, ai, cid, onAddMeal, settings }) {
  const eq = np && np.mode === "equilibre";
  const pr = recPrefs(data);
  const [cat, setCat] = useState("tout");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(null); // rapide | batch | fav
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null); // gouts | liste | ia
  const mine = Object.values(data.recettes || {}).filter((r) => r && r.kind === "ia");
  const all = [...mine, ...RECETTES];
  const allowed = all.filter((r) => recAllowed(r, pr));
  const hidden = all.length - allowed.length;
  const sNow = seasonOf(recSeasonDate()), ed = recEvent(data, settings);
  const list = allowed.filter((r) => (cat === "tout" || r.cat === cat) && (!q || normTxt(r.n + " " + recIng(r).map((x) => x.d[0]).join(" ")).includes(normTxt(q))) && (only !== "rapide" || r.temps <= 15) && (only !== "batch" || r.batch) && (only !== "fav" || (pr.fav || []).includes(r.id)) && (only !== "saison" || recSeason(r, sNow) === true || recTheme(r, ed)))
    .sort((a, b) => recScore(b, pr, np) - recScore(a, pr, np));
  const wk = weekRecipe(data, np, cid, settings);
  const nList = ((((data.recettes || {}).liste) || {}).items || []).length;
  return html`<div className="stack">
    ${wk ? html`<${RecipeCard} r=${wk} np=${np} eq=${eq} week=${true} ed=${ed} onOpen=${() => setSel(wk)} />` : null}
    <div className="btnrow"><${Btn} small kind="ghost" onClick=${() => setModal("gouts")}>Mes goûts</${Btn}><${Btn} small kind="ghost" onClick=${() => setModal("liste")}>Liste de courses${nList ? " (" + nList + ")" : ""}</${Btn}>
      ${ai && ai.sample ? html`<${Btn} small onClick=${() => setModal("ia")}>Créer une recette avec l'IA</${Btn}>` : null}</div>
    <div className="tabs-scroll"><${Seg} options=${REC_CAT} value=${cat} onChange=${setCat} /></div>
    <div className="filters"><input id="rc-q" className="search" placeholder="Rechercher un plat ou un ingrédient" value=${q} onChange=${(e) => setQ(e.target.value)} />
      <div className="chips">${[["saison", "De saison"], ["rapide", "15 min ou moins"], ["batch", "À préparer d'avance"], ["fav", "Favoris"]].map(([k, n]) => html`<button key=${k} type="button" className=${"chipbtn" + (only === k ? " on" : "")} aria-pressed=${only === k} onClick=${() => setOnly(only === k ? null : k)}>${n}</button>`)}</div></div>
    ${hidden ? html`<p className="muted small">${plural(hidden, "recette masquée", "recettes masquées")} selon tes goûts.</p>` : null}
    ${only === "saison" ? html`<p className="muted small">Fruits et légumes de ${SAISON_N[sNow]}, d'après le calendrier Manger Bouger (Santé publique France).</p>` : null}
    <div className="rgrid">${list.map((r) => html`<${RecipeCard} key=${r.id} r=${r} np=${np} eq=${eq} ed=${ed} fav=${(pr.fav || []).includes(r.id)} onOpen=${() => setSel(r)} />`)}</div>
    ${!list.length ? html`<${Empty} title="Aucune recette" text="Change de filtre ou ajuste tes goûts." />` : null}
    <details className="small"><summary>Comment les recettes sont construites</summary><p>${RECSCI.text}</p><ol className="refs">${(RECSCI.refs || []).map((x, k) => html`<li key=${k}>${x}</li>`)}</ol></details>
    <${Modal} open=${!!sel} wide title=${sel ? sel.n : ""} onClose=${() => setSel(null)}>${sel ? html`<${RecipeView} r=${sel} np=${np} eq=${eq} data=${data} src=${src} onAddMeal=${onAddMeal} onClose=${() => setSel(null)} />` : null}</${Modal}>
    <${Modal} open=${!!modal} wide title=${{ gouts: "Mes goûts", liste: "Ma liste de courses", ia: "Créer une recette avec le coach IA" }[modal] || ""} onClose=${() => setModal(null)}>
      ${modal === "gouts" ? html`<${TastesForm} data=${data} src=${src} onDone=${() => setModal(null)} />` : null}
      ${modal === "liste" ? html`<${ShopList} data=${data} src=${src} all=${all} />` : null}
      ${modal === "ia" ? html`<${AIRecipe} data=${data} np=${np} ai=${ai} src=${src} onDone=${(r) => { setModal(null); setSel(r); }} />` : null}</${Modal}>
  </div>`;
}
