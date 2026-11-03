/* ===== Mon suivi sur mesure : matériel disponible et modules (musculation, cardio, nutrition) =====
   Le client choisit son matériel et ce qu'il veut dans son suivi, au même prix.
   - profile.materiel : liste d'identifiants (MATERIEL) ; absent = ancien comportement (salle, ou version maison du programme).
   - profile.modules : { muscu, cardio, nutrition } ; absent = tout.
   Le programme est adapté à l'affichage (persoProg) : rien n'est réécrit dans le plan, le coach garde la main. */
const MATERIEL = CONTENT.MATERIEL || [], MAT_PRESETS = CONTENT.MAT_PRESETS || [], EQREQ = CONTENT.EQREQ || {}, MATSUB = CONTENT.MATSUB || {}, MATFB = CONTENT.MATFB || {};
const MATB = Object.fromEntries(MATERIEL.map((m) => [m.id, m]));
const MODULES = [
  { id: "muscu", n: "Musculation et renforcement", d: "Force, puissance, vitesse, gainage." },
  { id: "cardio", n: "Cardio et endurance", d: "Course, intervalles, conditionnement." },
  { id: "nutrition", n: "Nutrition", d: "Repères du jour, repas, recettes." },
];
/* la salle complète couvre tout le matériel, sauf l'espace dehors et le traîneau */
const MAT_HORS_SALLE = ["terrain", "traineau"];
/* charges légères ou lourdes : gain de muscle comparable près de l'échec, force maximale meilleure avec du lourd (J Strength Cond Res 2017;31(12):3508-23) */
const MAT_REF = "Schoenfeld et al., 2017";

function matOf(p) { return p && Array.isArray(p.materiel) ? p.materiel.filter((x) => MATB[x]) : null; }
function modsOf(p) {
  const m = p && p.modules;
  if (!m || typeof m !== "object") return null;
  return { muscu: m.muscu !== false, cardio: m.cardio !== false, nutrition: m.nutrition !== false };
}
/* lieu du plan déduit du matériel : « maison » seulement pour un programme qui a une version maison */
function matLieu(prog, p) { const mat = matOf(p); return mat ? (prog && prog.maison && !mat.includes("salle") ? "maison" : "salle") : null; }
function modsAll(m) { return !m || (m.muscu && m.cardio && m.nutrition); }
function trainOn(m) { return !m || m.muscu || m.cardio; }
/* nutrition affichée : formule qui l'inclut et module choisi */
function nutriOn(plan, p) { const m = modsOf(p); return nutriOk(plan) && (!m || m.nutrition); }

/* ---------- matériel ---------- */
function matHas(mat, x) { return mat.includes(x) || (mat.includes("salle") && !MAT_HORS_SALLE.includes(x)); }
function reqOf(ex) { return ex && EQREQ[ex.eq] !== undefined ? EQREQ[ex.eq] : ""; }
function reqOk(rq, mat) { return !rq || rq.split("|").some((alt) => alt.split("+").filter(Boolean).every((x) => matHas(mat, x))); }
function exFeasible(ex, mat) { return !mat || !ex || ex.custom || reqOk(reqOf(ex), mat); }
function isPull(ex) { return /tirage|rowing|traction|face pull|curl/i.test(ex.n || ""); }
/* exercice à faire avec ce matériel : remplaçants du préparateur, variante, puis secours au poids du corps */
function matSwap(id, mat) {
  const ex = EXB[id];
  if (!mat || !ex || exFeasible(ex, mat)) return id;
  const seen = new Set([id]);
  const tryIt = (c) => { if (!c || seen.has(c) || !EXB[c]) return false; seen.add(c); return exFeasible(EXB[c], mat); };
  for (const c of MATSUB[id] || []) if (tryIt(c)) return c;
  let cur = ex.alt;
  for (let k = 0; k < 3 && cur; k++) { if (tryIt(cur)) return cur; cur = EXB[cur] && EXB[cur].alt; }
  const fb = MATFB[ex.c === "Haut du corps" && isPull(ex) ? "Haut du corps/tirage" : ex.c];
  return fb && EXB[fb] ? fb : id;
}
const MAT_LOURD = { F3: 1, F5: 1, F8: 1, H8: 1 };
/* élément de séance adapté : l'exercice, et la dose quand la charge manque */
function matItem(it, prog) {
  const mat = prog && prog.mat;
  if (!mat || !it || !it.e) return it;
  const to = matSwap(it.e, mat);
  if (to === it.e) return it;
  const from = EXB[it.e] || {}, ex = EXB[to] || {};
  const rq = reqOf(ex), libre = !rq || rq === "terrain";
  const out = { ...it, e: to, matFrom: it.e };
  delete out.adjNote; /* une consigne de charge visait l'exercice remplacé */
  if (libre && T[it.t] && T[it.t].load) out.bw = true; /* sans charge : pas de kilos à noter */
  if (!it.w && libre && MAT_LOURD[it.t]) { out.t = "H12"; delete out.r; out.matNote = "Sans charge : descente en 3 secondes, dernière série à 1 ou 2 répétitions de l'échec."; }
  else if (!it.w && libre && it.t === "P") { out.t = ex.c === "Pliométrie" ? "PL" : "H12"; delete out.r; }
  else if (!it.w && (it.t === "F3" || it.t === "F5") && !/barre|salle/.test(rq)) { out.t = "H8"; delete out.r; out.matNote = "Charge plus légère : plus de répétitions, pour le même effort."; }
  if (!it.w && it.t === "S" && to === "montees_genoux") { out.w = T.S.sets.map((n) => n + " × 10 s · vitesse maximale · récup 1 min 30"); out.matNote = "Sans espace pour sprinter : sur place, le plus vite possible."; }
  if ((from.c === "Course" || from.c === "Conditionnement") && (to === "velo_intervalles" || to === "rameur")) out.matNote = "Sur machine : mêmes durées d'effort et même essoufflement qu'en courant.";
  return out;
}

/* ---------- modules : séances de musculation, de cardio ---------- */
const MOD_CARDIO = new Set(["Course", "Conditionnement"]);
const MOD_MUSCU = new Set(["Bas du corps", "Haut du corps", "Chaîne postérieure", "Haltérophilie", "Pliométrie", "Force", "Vitesse", "Agilité"]);
function itemKind(it) { const c = (EXB[it.e] || {}).c; return MOD_CARDIO.has(c) ? "cardio" : MOD_MUSCU.has(c) ? "muscu" : "neutre"; }
function sessionKind(s) {
  let c = 0, m = 0;
  (s.items || []).forEach((it) => { const k = itemKind(it); if (k === "cardio") c++; else if (k === "muscu") m++; });
  return c > 0 && c >= m ? "cardio" : "muscu";
}
function modSession(s, mods) {
  if (!mods || (mods.muscu && mods.cardio)) return s;
  if (!mods.muscu && !mods.cardio) return null;
  const items = s.items || [];
  const kind = sessionKind(s);
  if (mods.muscu) {
    if (kind === "cardio") return null;
    const kept = items.filter((it) => itemKind(it) !== "cardio");
    return kept.length === items.length || kept.length < 2 ? s : { ...s, items: kept, modCut: "cardio" };
  }
  const course = items.some((it) => (EXB[it.e] || {}).c === "Course");
  if (kind !== "cardio" && !course) return null;
  const kept = items.filter((it) => itemKind(it) !== "muscu");
  return kept.length === items.length ? s : { ...s, items: kept, modCut: "muscu" };
}
/* programme vu par le client : séances selon ses modules, matériel pour les remplacements */
function persoProg(prog, p) {
  if (!prog) return prog;
  const mat = matOf(p), mods = modsOf(p);
  if (!mat && !mods) return prog;
  const out = { ...prog, mat: mat || null, mods: mods || null };
  if (mods && !(mods.muscu && mods.cardio)) out.blocks = (prog.blocks || []).map((b) => ({ ...b, sessions: (b.sessions || []).map((s) => modSession(s, mods)).filter(Boolean) }));
  return out;
}
const MODS_LABEL = { mcn: "Musculation, cardio et nutrition", mc: "Musculation et cardio", mn: "Musculation et nutrition", cn: "Cardio et nutrition", m: "Musculation seulement", c: "Cardio seulement", n: "Nutrition seulement" };
function modsLabel(m) { if (!m) return MODS_LABEL.mcn; return MODS_LABEL[(m.muscu ? "m" : "") + (m.cardio ? "c" : "") + (m.nutrition ? "n" : "")] || "—"; }
function matLabel(mat) {
  if (!mat) return "Non précisé";
  const pr = MAT_PRESETS.find((x) => x.m.length === mat.length && x.m.every((k) => mat.includes(k)));
  if (pr) return pr.n;
  const l = mat.map((k) => MATB[k].n);
  return l.length ? l.join(", ") : "Aucun matériel";
}

/* ---------- vérifications avant de choisir (onboarding, profil) ---------- */
function persoChecks(progId, mat, mods, lib) {
  const pr = progOf(progId, lib || {});
  if (!pr) return [];
  const out = [];
  const pp = persoProg(pr, { materiel: mat || undefined, modules: mods || undefined });
  const perW = (pp.blocks || []).map((b) => (b.sessions || []).length);
  const minW = perW.length ? Math.min(...perW) : 0, maxW = perW.length ? Math.max(...perW) : 0;
  if (mods && !trainOn(mods)) out.push({ t: "info", n: "Nutrition seule : pas de séance d'entraînement. Ton objectif sert à régler tes repères de nutrition." });
  else if (mods && !minW) out.push({ t: "bad", n: "Ce programme n'a pas de séance de " + (mods.muscu ? "musculation" : "cardio") + " : choisis un autre programme ou ajoute " + (mods.muscu ? "le cardio" : "la musculation") + "." });
  else if (mods && !(mods.muscu && mods.cardio)) out.push({ t: minW <= 1 ? "warn" : "ok", n: "Avec ton choix : " + (minW === maxW ? plural(minW, "séance") : minW + " à " + maxW + " séances") + " par semaine" + (minW <= 1 ? ". Pour plus de séances, prends un programme plus orienté " + (mods.muscu ? "musculation" : "cardio (Course à pied)") + "." : ".") });
  if (mat && trainOn(mods)) {
    const ids = new Set(); (pp.blocks || []).forEach((b) => (b.sessions || []).forEach((s) => (s.items || []).forEach((it) => ids.add(it.e))));
    const all = [...ids].filter((id) => EXB[id]);
    const n = all.filter((id) => matSwap(id, mat) !== id).length;
    if (n) out.push({ t: "info", n: "Exercices remplacés par un équivalent faisable avec ton matériel : " + n + " sur " + all.length + "." });
    else if (all.length) out.push({ t: "ok", n: "Tout le programme se fait avec ton matériel." });
    const runs = all.some((id) => EXB[id].c === "Course" || EXB[id].c === "Vitesse");
    if (runs && !matHas(mat, "terrain")) out.push({ t: "warn", n: "Ce programme demande de courir ou de sprinter : sans espace dehors, les séances passent sur machine ou sur place, ce qui est moins efficace." });
    const lourd = ["force", "masse"].includes(pr.id);
    if (lourd && !matHas(mat, "barre")) out.push({ t: "warn", n: (pr.id === "force" ? "Sans barre, la force maximale progresse moins vite : les séries plus longues font gagner du muscle, mais moins de force maximale" : "Sans barre, la prise de muscle reste possible : des séries menées près de l'échec avec des charges légères donnent un gain comparable") + " (" + MAT_REF + ")." });
  }
  return out;
}

/* ---------- composants ---------- */
function MaterielPicker({ value, onChange, idp }) {
  const mat = value || [];
  const has = (k) => mat.includes(k);
  const salle = has("salle");
  const toggle = (k) => onChange(has(k) ? mat.filter((x) => x !== k) : [...mat, k]);
  const preset = MAT_PRESETS.find((x) => x.m.length === mat.length && x.m.every((k) => mat.includes(k)));
  const shown = MATERIEL.filter((m) => m.id === "salle" || !salle || MAT_HORS_SALLE.includes(m.id));
  return html`<div className="mat-pick">
    <div className="seg" role="radiogroup" aria-label="Où t'entraînes-tu ?">${MAT_PRESETS.map((x) => html`<button key=${x.id} type="button" role="radio" aria-checked=${preset && preset.id === x.id} className=${preset && preset.id === x.id ? "on" : ""} onClick=${() => onChange(x.m.slice())}>${x.n}</button>`)}</div>
    <p className="field-h">Coche ce que tu as vraiment sous la main : un exercice impossible est remplacé par un équivalent.</p>
    <div className="chips mat-chips">${shown.map((m) => html`<button key=${m.id} id=${(idp || "mat") + "-" + m.id} type="button" className=${"chipbtn" + (has(m.id) ? " on" : "")} aria-pressed=${has(m.id)} title=${m.d || null} onClick=${() => toggle(m.id)}>${has(m.id) ? "✓ " : ""}${m.n}</button>`)}</div>
    ${salle ? html`<p className="muted small">Salle complète : barres, haltères, machines et poulies sont comptés. Ajoute le terrain dehors et le traîneau si tu y as accès.</p>` : null}
  </div>`;
}
function ModulesPicker({ value, onChange, nutriLocked, idp }) {
  const m = value || { muscu: true, cardio: true, nutrition: true };
  const set = (k) => { const n = { ...m, [k]: !m[k] }; if (n.muscu || n.cardio || n.nutrition) onChange(n); };
  return html`<div className="mod-pick">${MODULES.map((x) => {
    const lock = x.id === "nutrition" && nutriLocked;
    const on = !!m[x.id] && !lock;
    return html`<button key=${x.id} id=${(idp || "mod") + "-" + x.id} type="button" className=${"modcard" + (on ? " on" : "")} aria-pressed=${on} disabled=${lock} onClick=${() => set(x.id)}>
      <b>${on ? "✓ " : ""}${x.n}</b><span>${lock ? "Non incluse dans ta formule actuelle." : x.d}</span></button>`;
  })}</div>`;
}
/* éditeur du profil : le client (ou Antoine) change son matériel et son suivi */
function PersoEditor({ data, src, plan, onDone, lib }) {
  const toast = useToast();
  const p = data.profile || {};
  const [mat, setMat] = useState(() => matOf(p) || (plan && plan.equipment === "maison" ? ["terrain"] : ["salle", "terrain"]));
  const [mods, setMods] = useState(() => modsOf(p) || { muscu: true, cardio: true, nutrition: true });
  const [busy, setBusy] = useState(false);
  const pid = plan ? plan.programId : p.request && p.request.programId;
  const checks = persoChecks(pid, mat, mods, lib);
  const nLock = !!(plan && !nutriOk(plan));
  const empty = !trainOn(mods) && (!mods.nutrition || nLock);
  const blocked = empty || checks.some((c) => c.t === "bad");
  const save = async () => {
    setBusy(true);
    try { await src.setProfile({ ...p, materiel: mat, modules: mods, persoAt: nowISO() }); toast("Ton suivi est mis à jour.", "ok"); onDone && onDone(); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="form">
    <div className="field"><span className="field-l">Ce que tu veux dans ton suivi</span><${ModulesPicker} value=${mods} onChange=${setMods} nutriLocked=${nLock} idp="pe-mod" />
      <span className="field-h">Même prix : tu choisis seulement ce que tu fais. Au moins un choix.</span></div>
    ${trainOn(mods) ? html`<div className="field"><span className="field-l">Mon matériel</span><${MaterielPicker} value=${mat} onChange=${setMat} idp="pe-mat" /></div>` : null}
    ${empty ? html`<p className="small warn-t">Choisis au moins la musculation ou le cardio : la nutrition n'est pas incluse dans ta formule actuelle.</p>` : html`<${FitChecks} checks=${checks} />`}
    <div className="actions"><${Btn} block onClick=${save} disabled=${busy || blocked}>Enregistrer</${Btn}></div></div>`;
}
/* résumé sur le profil du client et dans l'espace coach */
function PersoCard({ data, src, plan, lib, coachView }) {
  const [edit, setEdit] = useState(false);
  const p = data.profile || {};
  const mat = matOf(p), mods = modsOf(p);
  return html`<${Card} title=${coachView ? "Suivi choisi par le client" : "Mon suivi sur mesure"} sub=${coachView ? null : "Ton matériel et ce que tu veux travailler : le programme s'adapte."}
    action=${src && src.setProfile ? html`<${Btn} small kind="ghost" onClick=${() => setEdit(true)}>Modifier</${Btn}>` : null}>
    <dl className="dl"><dt>Suivi</dt><dd>${modsLabel(mods)}</dd>
      ${trainOn(mods) ? html`<dt>Matériel</dt><dd>${mat ? matLabel(mat) : plan && plan.equipment === "maison" ? "Maison (version maison du programme)" : "Salle de sport"}</dd>` : null}</dl>
    ${!coachView && !mat ? html`<p className="muted small">Indique ton matériel : les exercices que tu ne peux pas faire seront remplacés par un équivalent.</p>` : null}
    <${Modal} open=${edit} title=${coachView ? "Suivi du client" : "Mon suivi sur mesure"} onClose=${() => setEdit(false)}>${edit ? html`<${PersoEditor} data=${data} src=${src} plan=${plan} lib=${lib} onDone=${() => setEdit(false)} />` : null}</${Modal}>
  </${Card}>`;
}
/* ligne du contexte du coach IA */
function persoLine(p) {
  const mat = matOf(p), mods = modsOf(p);
  const L = [];
  if (mods && !modsAll(mods)) L.push("Suivi choisi par le client : " + modsLabel(mods).toLowerCase() + (trainOn(mods) ? "" : " (aucune séance d'entraînement, ne pas en proposer sauf demande)"));
  if (mat) L.push("Matériel disponible : " + (mat.length ? mat.map((k) => MATB[k].n).join(", ") : "aucun (poids du corps)") + ". Ne propose que des exercices faisables avec ce matériel.");
  return L.join(" · ");
}
