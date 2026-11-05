/* ===== Import PDF → programme structuré =====
   Le coach dépose un PDF (28_pdf.js) : ici, à la demande, son texte est lu dans le navigateur (pdf.js, chargé
   comme React, sans rien installer) puis mis en forme par l'IA du coach (même mécanisme gratuit que le Coach
   IA, sur son propre compte Claude, ou le relais du site) en un brouillon de « Programme perso » — avec cases
   à cocher, séances bi-quotidiennes comprises (jour + moment). Le coach relit et corrige dans l'éditeur
   habituel (06_library.js) avant d'enregistrer : l'IA peut se tromper sur un exercice ou une charge.
   Une semaine à la fois (pas tout le document en un seul appel) : certains relais limitent la longueur d'une
   réponse, et une semaine à la fois reste fiable quelle que soit la longueur du programme. */
function pdfjsReady() { return typeof window !== "undefined" && !!window.pdfjsLib; }
if (pdfjsReady()) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
const PDFIMPORT_MAXCHARS = 60000, PDFIMPORT_MAXWEEKS = 16;
async function extractPdfText(blob) {
  if (!pdfjsReady()) throw Object.assign(new Error("pdfjs"), { code: "pdfjs_absent" });
  const buf = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 60); i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim());
  }
  const text = pages.map((t, i) => "[page " + (i + 1) + "]\n" + t).join("\n\n");
  return text.slice(0, PDFIMPORT_MAXCHARS);
}
function importErrText(e) {
  if (e && e.code === "pdfjs_absent") return "La lecture de PDF n'a pas pu se charger (vérifie ta connexion) : réessaie dans un instant.";
  if (e && e.code === "no_text") return "Ce PDF ne contient pas de texte lisible (probablement des pages scannées en image) : transformation impossible, saisis le programme à la main.";
  return "Transformation impossible : " + aiErr(e);
}
function exerciseListForAI(exo) {
  const custom = Object.values(exo || {}).filter((x) => x && x.custom).map((e) => [e.id, e.n, e.c]);
  return [...EXLIB.map((e) => [e.id, e.n, e.c]), ...custom];
}
const IMPORT_META_PROMPT = `Tâche : import_programme_meta. Tu reçois le texte extrait d'un programme d'entraînement en PDF, écrit par un préparateur physique pour un ou des athlètes. Identifie sa structure générale, sans entrer dans le détail des séances.
Réponds uniquement avec un objet JSON (sans texte autour, sans balises de code), de cette forme exacte :
{"n":"nom du programme","short":"accroche courte (une phrase)","desc":"description courte (une à deux phrases)",
 "lieu":"Salle, Extérieur, ou autre lieu principal selon le document",
 "weeks":[{"n":"nom de cette semaine (ex. intitulé exact trouvé dans le document)","focus":"objectif de cette semaine en une phrase",
   "marker":"copie EXACTE d'une courte phrase ou d'un titre du document qui marque le début de cette semaine"}],
 "refsMarker":"copie exacte du titre de la section des références scientifiques si le document en a une (sinon omets ce champ)",
 "refs":["au plus 6 références scientifiques complètes trouvées dans le document, chacune en 200 caractères au plus (sinon tableau vide)"],
 "science":"un paragraphe de 400 caractères au plus résumant la logique scientifique si le document l'explique, sinon chaîne vide"}
Une entrée de "weeks" par semaine réelle du document, dans l'ordre. "marker" doit être une sous-chaîne EXACTE du texte fourni (copiée mot pour mot, avec les mêmes espaces et accents), assez longue pour être unique (8 à 15 mots), jamais résumée ni reformulée. S'il n'y a qu'une seule semaine, un seul élément dans "weeks" suffit.

Texte du document :
`;
async function importMeta(text, sample) { return sample.json(IMPORT_META_PROMPT + text, { cache: false }); }
function sliceWeeks(text, meta) {
  const weeks = Array.isArray(meta.weeks) && meta.weeks.length ? meta.weeks : [{ n: "Semaine 1", focus: "" }];
  if (weeks.length === 1) return [{ meta: weeks[0], text }];
  const idxs = weeks.map((w) => (w && typeof w.marker === "string" && w.marker.trim() ? text.indexOf(w.marker.trim()) : -1));
  const refsIdx = meta.refsMarker && typeof meta.refsMarker === "string" ? text.indexOf(meta.refsMarker.trim()) : -1;
  return weeks.map((w, i) => {
    const start = idxs[i] >= 0 ? idxs[i] : 0;
    let end = text.length;
    for (let j = i + 1; j < idxs.length; j++) if (idxs[j] >= 0) { end = idxs[j]; break; }
    if (refsIdx >= 0 && refsIdx > start && refsIdx < end) end = refsIdx;
    return { meta: w, text: end > start ? text.slice(start, end) : text };
  });
}
const IMPORT_DOSE_HELP = `Pour la dose de chaque exercice, choisis l'une de ces deux formes selon ce que dit le document (n'utilise jamais de gabarit interne, ce texte vient d'un document extérieur) :
- "free" : texte EXACT de la prescription telle qu'écrite (ex. "3 x 2 reps · 80 % RM squat · récup 20''") — à utiliser dans presque tous les cas.
- "w" : tableau de 4 textes (progression sur 4 semaines) — seulement si le document donne lui-même 4 valeurs progressives distinctes pour 4 semaines successives de ce même exercice.`;
function importWeekPrompt(weekMeta, text, exList) {
  return `Tâche : import_programme_semaine. Tu structures UNE semaine d'un programme d'entraînement pour l'application d'un préparateur physique. Transforme le texte ci-dessous en séances avec exercices, fidèlement, sans rien inventer ni arrondir les chiffres.
Réponds uniquement avec un objet JSON (sans texte autour, sans balises de code), de cette forme exacte :
{"sessions":[{"id":"identifiant court et unique (ex. lun-am)","t":"titre de la séance","focus":"objectif court (vide si non précisé)","lieu":"lieu si précisé, sinon vide",
  "wu":"échauffement si décrit, sinon vide","day":0,"moment":"matin",
  "items":[{"e":"identifiant d'exercice","free":"dose exacte telle qu'écrite","n":"consigne courte si le document en donne une, sinon omets ce champ"}]}]}
"day" : jour de la semaine, 0 = lundi … 6 = dimanche, déduit des dates ou jours mentionnés ; omets ce champ si non déterminable.
"moment" : seulement quand DEUX séances d'entraînement distinctes ont lieu le même jour (ex. "matin" et "soir") ; omets-le sinon.
Ignore les lignes qui ne décrivent pas une séance d'entraînement (repas, trajets, logistique) : garde-les tout au plus comme contexte bref dans "focus", jamais comme exercice.
` + IMPORT_DOSE_HELP + `
Pour "e", choisis l'identifiant le plus proche dans cette liste [id, nom, catégorie] si un exercice correspond vraiment à ce que fait l'athlète ; sinon invente un identifiant court en minuscules avec des underscores, proche du nom français de l'exercice : ` + JSON.stringify(exList) + `

Nom de cette semaine : ` + (weekMeta.n || "") + `
Texte de cette semaine :
` + text;
}
function slugId(s) {
  /* retire les diacritiques combinants (plage Unicode U+0300-U+036F) par code, pour éviter tout risque
     de corruption des caractères accentués eux-mêmes dans le fichier source */
  const lo = String.fromCharCode(768), hi = String.fromCharCode(879);
  const noAccents = String(s || "").toLowerCase().normalize("NFD").replace(new RegExp("[" + lo + "-" + hi + "]", "g"), "");
  return noAccents.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "exercice";
}
function sanitizeImportedItem(raw, idx) {
  const it = raw && typeof raw === "object" ? raw : {};
  const out = { e: typeof it.e === "string" && it.e.trim() ? slugId(it.e) : "exercice_" + (idx + 1) };
  if (Array.isArray(it.w) && it.w.some((x) => String(x || "").trim())) out.w = [0, 1, 2, 3].map((k) => String(it.w[k] || "").trim().slice(0, 100));
  else out.free = typeof it.free === "string" ? it.free.trim().slice(0, 140) : "";
  if (typeof it.n === "string" && it.n.trim()) out.n = it.n.trim().slice(0, 200);
  return out;
}
function sanitizeImportedSession(raw, fallbackId) {
  const s = raw && typeof raw === "object" ? raw : {};
  const out = {
    id: (typeof s.id === "string" && s.id.trim() ? slugId(s.id.trim()).slice(0, 24) : fallbackId) || fallbackId,
    t: typeof s.t === "string" && s.t.trim() ? s.t.trim().slice(0, 80) : "Séance",
    focus: typeof s.focus === "string" ? s.focus.trim().slice(0, 200) : "",
    lieu: typeof s.lieu === "string" ? s.lieu.trim().slice(0, 40) : "",
    wu: typeof s.wu === "string" ? s.wu.trim().slice(0, 400) : "",
    items: Array.isArray(s.items) ? s.items.slice(0, 20).map(sanitizeImportedItem) : [],
  };
  const day = Math.round(Number(s.day));
  if (Number.isInteger(day) && day >= 0 && day <= 6) { out.day = day; if (s.moment === "matin" || s.moment === "soir") out.moment = s.moment; }
  return out;
}
function sanitizeImportedProgram(meta, weeks) {
  const m = meta && typeof meta === "object" ? meta : {};
  const ws = (Array.isArray(weeks) ? weeks : []).slice(0, PDFIMPORT_MAXWEEKS);
  const blocks = [];
  for (let i = 0; i < ws.length; i += 4) {
    const grp = ws.slice(i, i + 4);
    const sessions = [];
    grp.forEach((wk, j) => {
      (wk.sessions || []).forEach((raw, k) => {
        const s = sanitizeImportedSession(raw, "s" + (i + j + 1) + "_" + (k + 1));
        if (grp.length > 1) { s.id += "-s" + (j + 1); s.wib = j + 1; }
        sessions.push(s);
      });
    });
    blocks.push({ n: grp.map((wk) => wk.n).filter(Boolean).join(" · ").slice(0, 120) || ("Bloc " + (blocks.length + 1)), focus: String(grp[0].focus || "").slice(0, 200), sessions });
  }
  const refs = Array.isArray(m.refs) ? m.refs.filter((x) => typeof x === "string" && x.trim()).slice(0, 10).map((x) => x.trim().slice(0, 300)) : [];
  return {
    kind: "program", id: rid("c_"), isNew: true, fromPdf: true,
    n: (typeof m.n === "string" && m.n.trim() ? m.n.trim() : "Programme importé").slice(0, 80),
    short: typeof m.short === "string" ? m.short.trim().slice(0, 140) : "",
    desc: typeof m.desc === "string" ? m.desc.trim().slice(0, 400) : "",
    lieu: typeof m.lieu === "string" && m.lieu.trim() ? m.lieu.trim().slice(0, 40) : "Salle",
    maison: false, tests: [], better: {}, habits: [], refs,
    science: typeof m.science === "string" ? m.science.trim().slice(0, 1200) : "",
    blocks: blocks.length ? blocks : [{ n: "Bloc 1", focus: "", sessions: [] }],
  };
}
async function importProgramFromText(text, exo, sample, onProgress) {
  onProgress && onProgress(1, 2);
  const meta = await importMeta(text, sample);
  const slices = sliceWeeks(text, meta).slice(0, PDFIMPORT_MAXWEEKS);
  const exList = exerciseListForAI(exo);
  const weeks = [];
  for (let i = 0; i < slices.length; i++) {
    onProgress && onProgress(i + 2, slices.length + 1);
    const r = await sample.json(importWeekPrompt(slices[i].meta, slices[i].text, exList), { cache: false });
    weeks.push({ n: slices[i].meta && slices[i].meta.n, focus: slices[i].meta && slices[i].meta.focus, sessions: r && Array.isArray(r.sessions) ? r.sessions : [] });
  }
  return sanitizeImportedProgram(meta, weeks);
}
