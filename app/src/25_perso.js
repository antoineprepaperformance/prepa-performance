/* ===== Personnalisation (apparence, page du jour) et langage adapté au profil =====
   Les réglages sont dans profile.prefs : ils suivent le client sur tous ses appareils.
   theme : auto | sombre | clair · accent : or | bleu | vert | rouge | violet | argent · fs : 0 | 1 | 2 (taille du texte)
   lang : auto | simple | expert · saison : thèmes et défis de saison (oui par défaut) · blocks : { order: [], off: [] } */
const ACCENTS = [{ id: "or", n: "Or", c: "#d4ad3f" }, { id: "bleu", n: "Bleu", c: "#4a9be0" }, { id: "vert", n: "Vert", c: "#47b780" },
  { id: "rouge", n: "Rouge", c: "#e8625a" }, { id: "violet", n: "Violet", c: "#9b7ae8" }, { id: "argent", n: "Argent", c: "#d9d4ca" }];
const FONT_SIZES = [{ v: 0, n: "Normal" }, { v: 1, n: "Grand" }, { v: 2, n: "Très grand" }];
const THEMES = [{ v: "auto", n: "Automatique" }, { v: "sombre", n: "Sombre" }, { v: "clair", n: "Clair" }];
const LANG_MODES = [{ v: "auto", n: "Selon mon profil" }, { v: "simple", n: "Simple" }, { v: "expert", n: "Détaillé" }];
const TODAY_BLOCKS = [
  { id: "todo", n: "À faire aujourd'hui" }, { id: "stats", n: "Ma régularité" }, { id: "coach", n: "Messages et conseils" },
  { id: "nutri", n: "Nutrition et santé" }, { id: "habits", n: "Mes habitudes" }, { id: "terrain", n: "Séance terrain de la semaine" },
  { id: "extras", n: "Séances en plus" }, { id: "carte", n: "Ma carte athlète" }, { id: "week", n: "Les séances de la semaine" }];
const PREFS_LS = "ui_prefs_v1";

function prefsOf(profile) { return { theme: "auto", accent: "or", fs: 0, lang: "auto", saison: true, ...((profile && profile.prefs) || {}) }; }
/* langage : Performance et Haut niveau gardent le vocabulaire du préparateur ; les autres profils ont des consignes en mots simples */
function langMode(plan, profile) {
  const p = prefsOf(profile);
  if (p.lang === "simple" || p.lang === "expert") return p.lang;
  return nivRank(effNiveau(plan, profile)) >= 2 ? "expert" : "simple";
}
function blocksOf(prefs) {
  const b = (prefs && prefs.blocks) || {};
  const ids = TODAY_BLOCKS.map((x) => x.id);
  const order = [...(b.order || []).filter((id) => ids.includes(id)), ...ids.filter((id) => !(b.order || []).includes(id))];
  const off = new Set(b.off || []);
  return order.map((id) => ({ id, on: !off.has(id) }));
}
/* appliqué sur la racine de la page : thème, couleur, taille du texte (et gardé sur l'appareil pour l'ouverture suivante) */
function applyUiPrefs(p) {
  try {
    const r = document.documentElement;
    if (p && p.theme === "sombre") r.setAttribute("data-theme", "dark"); else if (p && p.theme === "clair") r.setAttribute("data-theme", "light"); else r.removeAttribute("data-theme");
    if (p && p.accent && p.accent !== "or" && ACCENTS.some((a) => a.id === p.accent)) r.setAttribute("data-accent", p.accent); else r.removeAttribute("data-accent");
    if (p && Number(p.fs) > 0) r.setAttribute("data-fs", String(Math.min(2, Number(p.fs)))); else r.removeAttribute("data-fs");
  } catch (e) {}
}
function usePrefsApply(profile, on) {
  const p = prefsOf(profile);
  const key = [p.theme, p.accent, p.fs].join("|");
  useEffect(() => {
    if (!on) return undefined;
    applyUiPrefs(p);
    try { localStorage.setItem(PREFS_LS, JSON.stringify({ theme: p.theme, accent: p.accent, fs: p.fs })); } catch (e) {}
    return () => applyUiPrefs(null);
  }, [key, on]);
}
/* au démarrage, avant la synchronisation : mêmes réglages que la dernière fois sur cet appareil */
function applyUiPrefsEarly() { try { const j = JSON.parse(localStorage.getItem(PREFS_LS) || "null"); if (j) applyUiPrefs(j); } catch (e) {} }

/* ---------- réglages : Apparence et affichage ---------- */
function AppearanceCard({ data, src, plan }) {
  const toast = useToast();
  const profile = data.profile || {};
  const p = prefsOf(profile);
  const can = !!(src && src.setProfile);
  const save = async (patch) => {
    const next = { ...p, ...patch };
    applyUiPrefs(next);
    if (!can) return;
    try { await src.setProfile({ ...profile, prefs: next }); } catch (e) { toast("Réglage non enregistré. Réessaie dans un instant.", "bad"); }
  };
  const blocks = blocksOf(p);
  const move = (i, d) => { const o = blocks.map((b) => b.id); const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; save({ blocks: { order: o, off: blocks.filter((b) => !b.on).map((b) => b.id) } }); };
  const toggle = (id) => { const off = new Set(blocks.filter((b) => !b.on).map((b) => b.id)); off.has(id) ? off.delete(id) : off.add(id); save({ blocks: { order: blocks.map((b) => b.id), off: [...off] } }); };
  const resolved = langMode(plan, profile);
  return html`<${Card} title="Apparence et affichage" sub="Enregistré sur ton compte : tu retrouves tes réglages sur tous tes appareils.">
    <div className="appear">
      <${Field} label="Thème"><${Seg} id="ap-theme" options=${THEMES.map((t) => ({ v: t.v, n: t.n }))} value=${p.theme} onChange=${(v) => save({ theme: v })} /></${Field}>
      <div className="field"><span className="field-l" id="ap-acc-l">Couleur</span>
        <div className="swatches" role="radiogroup" aria-labelledby="ap-acc-l">${ACCENTS.map((a) => html`<button key=${a.id} type="button" role="radio" aria-checked=${p.accent === a.id} aria-label=${a.n} title=${a.n}
          className=${"swatch" + (p.accent === a.id ? " on" : "")} style=${{ background: a.c }} onClick=${() => save({ accent: a.id })}></button>`)}</div></div>
      <${Field} label="Taille du texte"><${Seg} id="ap-fs" options=${FONT_SIZES.map((f) => ({ v: String(f.v), n: f.n }))} value=${String(p.fs || 0)} onChange=${(v) => save({ fs: Number(v) })} /></${Field}>
      <${Field} label="Consignes des séances" hint=${resolved === "simple" ? "Consignes en mots simples : séries, repos, effort à garder en réserve." : "Vocabulaire du préparateur : RIR, tempo, % du maximum, échauffement RAMP."}>
        <${Seg} id="ap-lang" options=${LANG_MODES.map((l) => ({ v: l.v, n: l.n }))} value=${p.lang} onChange=${(v) => save({ lang: v })} /></${Field}>
      <div className="field"><span className="field-l">Ma page du jour</span><span className="field-h">La séance du jour reste toujours en haut. Affiche, masque ou déplace le reste.</span>
        <ul className="blocks-l">${blocks.map((b, i) => {
          const def = TODAY_BLOCKS.find((x) => x.id === b.id);
          return html`<li key=${b.id} className=${b.on ? "" : "off"}>
            <span className="bl-n">${def.n}</span>
            <span className="bl-mv"><button type="button" className="x sm" aria-label=${"Monter : " + def.n} disabled=${i === 0} onClick=${() => move(i, -1)}>↑</button><button type="button" className="x sm" aria-label=${"Descendre : " + def.n} disabled=${i === blocks.length - 1} onClick=${() => move(i, 1)}>↓</button></span>
            <button type="button" role="switch" aria-checked=${b.on} aria-label=${"Afficher : " + def.n} className=${"tgl" + (b.on ? " on" : "")} onClick=${() => toggle(b.id)}><span></span></button></li>`;
        })}</ul></div>
      <div className="field"><div className="tgl-row"><span><span className="field-l">Thèmes et défis de saison</span><span className="field-h">Noël, Pâques, grandes compétitions : couleurs de l'événement et un défi à relever.</span></span>
        <button type="button" role="switch" aria-checked=${p.saison !== false} aria-label="Thèmes et défis de saison" className=${"tgl" + (p.saison !== false ? " on" : "")} onClick=${() => save({ saison: p.saison === false })}><span></span></button></div></div>
    </div>
  </${Card}>`;
}

/* ---------- page du jour : ce qu'il reste à faire aujourd'hui ---------- */
function TodoCard({ items }) {
  if (!items.length) return null;
  const done = items.filter((x) => x.ok).length;
  return html`<section className="card todo" aria-label="À faire aujourd'hui">
    <div className="card-h"><h3>À faire aujourd'hui</h3><span className="muted small">${done} / ${items.length}</span></div>
    <ul className="todo-l">${items.map((x) => html`<li key=${x.k} className=${x.ok ? "ok" : ""}>
      <span className="todo-c" aria-hidden="true">${x.ok ? "✓" : ""}</span>
      <span className="todo-t"><b>${x.n}</b>${x.sub ? html`<span className="muted small">${x.sub}</span>` : null}</span>
      ${x.ok ? html`<span className="sr-only">fait</span>` : x.act ? html`<${Btn} small kind=${x.primary ? "primary" : "ghost"} onClick=${x.act}>${x.btn}</${Btn}>` : null}</li>`)}</ul>
  </section>`;
}

/* ---------- consignes en mots simples ---------- */
function rirWords(a, b) {
  if (a !== b) return "garde " + a + " à " + b + " répétitions en réserve";
  return a === 1 ? "garde 1 répétition en réserve" : a === 0 ? "va jusqu'au bout de la série" : "garde " + a + " répétitions en réserve";
}
function simpleInt(s) {
  const m = String(s || "").match(/^RIR\s*(\d+)(?:\s*-\s*(\d+))?$/);
  return m ? rirWords(Number(m[1]), Number(m[2] || m[1])) : String(s || "");
}
/* dose d'un exercice : « 3 × 10 · RIR 2-3 · récup 75 à 90 s » devient « 3 séries de 10 » + deux repères */
function doseSimple(d) {
  if (!d) return { main: "", chips: [] };
  if (!d.sets) return { main: d.text || "", chips: [] };          /* dose écrite à la main (« 30 min », « 5 × 1 min rapide »…) */
  const reps = String(d.reps === undefined || d.reps === null ? "" : d.reps).trim();
  const side = /\s*\/\s*côté$/.test(reps), r = reps.replace(/\s*\/\s*côté$/, "");
  const plain = /^\d+(\s*(-|à)\s*\d+)?$/.test(r);
  let main;
  if (!reps) main = d.sets > 1 ? d.sets + " séries" : "1 série";
  else if (plain && side) main = d.sets > 1 ? d.sets + " séries de " + r + " par côté" : "1 série de " + r + " par côté";
  else if (plain) main = d.sets > 1 ? d.sets + " séries de " + r : "1 série de " + r;
  else main = d.sets + " × " + reps;
  const chips = [];
  if (d.int) chips.push(simpleInt(d.int));
  if (d.rest) chips.push("repos " + d.rest);
  return { main, chips };
}
const GLOSSAIRE = [
  ["4 × 5", "4 séries de 5 répétitions."],
  ["RIR 2", "arrête la série quand il te reste environ 2 répétitions en réserve. RIR 4 = très facile, RIR 0 = échec."],
  ["Récup", "temps de repos entre deux séries."],
  ["Tempo 3-0-X-0", "descente en 3 s, pas de pause, montée explosive (X), pas de pause en haut."],
  ["% du maximum", "charge rapportée à ton maximum estimé à partir de tes séances (formule d'Epley) ou de tes tests."],
  ["VMA", "vitesse maximale aérobie : la vitesse de course que tu tiens environ 6 minutes, mesurée par le test demi-Cooper."],
  ["RAMP", "échauffement en 4 temps : s'activer (Raise), mobiliser (Activate & Mobilise), puis préparer l'effort maximal (Potentiate)."],
  ["Effort ressenti", "note de 0 (repos) à 10 (maximal) donnée 15 à 30 min après la séance."],
];
function Glossaire() {
  return html`<dl className="gloss">${GLOSSAIRE.map(([t, d]) => html`<div key=${t}><dt>${t}</dt><dd>${d}</dd></div>`)}</dl>`;
}
/* contrôle de forme en une question (profils Performance et Haut niveau en langage simple) :
   une seule note de récupération perçue, reportée sur les 5 critères (Laurent et al. 2011) */
function QuickReady({ value, onChange, data }) {
  const [full, setFull] = useState(false);
  const v = value || {};
  const one = READY_ITEMS.every(([k]) => num(v[k]) !== null && num(v[k]) === num(v.sommeil)) ? num(v.sommeil) : null;
  const res = readinessOf(v, data);
  if (full) return html`<div className="stack-s"><${ReadinessCheck} value=${value} onChange=${onChange} data=${data} /><button type="button" className="linkbtn" onClick=${() => setFull(false)}>Revenir à une seule question</button></div>`;
  return html`<div className="ready card">
    <div className="card-h"><div><h3>Comment tu te sens aujourd'hui ?</h3><p className="muted small">La séance s'ajuste à ta forme du jour.</p></div></div>
    <${Scale} id="rd-one" min=${1} max=${5} value=${one} lo="Pas en forme" hi="Au top" onChange=${(x) => onChange({ ...v, ...Object.fromEntries(READY_ITEMS.map(([k]) => [k, x])) })} />
    ${res ? html`<div className=${"alert " + (res.lvl === "ok" ? "okb" : res.lvl === "prudence" ? "gold" : "warn")}><div><b>${res.lvl === "ok" ? "Feu vert" : res.lvl === "prudence" ? "Prudence" : "Séance allégée"}</b><p>${res.txt}</p></div></div>` : null}
    <button type="button" className="linkbtn" onClick=${() => setFull(true)}>Détailler (5 questions et détente)</button>
  </div>`;
}
