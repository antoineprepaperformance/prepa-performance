/* ===== Import PDF → programme structuré =====
   Le coach dépose un PDF (28_pdf.js) : ici, à la demande, son texte est lu dans le navigateur (pdf.js, chargé
   comme React, sans rien installer) puis mis en forme par l'IA du coach (même mécanisme gratuit que le Coach
   IA, sur son propre compte Claude, ou le relais du site) en un brouillon de « Programme perso » — avec cases
   à cocher, séances bi-quotidiennes comprises (jour + moment). Le coach relit et corrige dans l'éditeur
   habituel (06_library.js) avant d'enregistrer : l'IA peut se tromper sur un exercice ou une charge.
   Deux structures bien différentes selon les coachs (vérifié sur deux programmes réels d'Antoine) :
   - semaine type qui se répète plusieurs semaines avec une charge qui monte (périodisation classique, son
     style habituel) : une seule petite réponse suffit (les séances, chacune avec sa dose semaine par semaine) ;
   - programme bespoke où chaque semaine (voire chaque jour) a un contenu vraiment différent : une réponse par
     semaine, qui se replie automatiquement en une réponse par page de cette semaine si elle est trop dense
     pour le relais utilisé (certains limitent la longueur d'une réponse de l'IA). */
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
/* une réponse de l'IA trop longue pour le relais arrive tronquée (JSON invalide) : on découpe alors plus finement
   plutôt que d'abandonner. Les autres échecs (quota, IA refusée…) ne se résolvent pas en réessayant plus petit. */
function importSplittable(e) { return !!e && (e.code === "invalid_json" || e.code === "prompt_too_large"); }
function splitByPageMarkers(text) {
  return String(text || "").split(/\[page \d+\]\n/).map((s) => s.trim()).filter(Boolean);
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
const IMPORT_SESSION_SHAPE = `{"id":"identifiant court et unique (ex. lun-am)","t":"titre de la séance","focus":"objectif court (vide si non précisé)","lieu":"lieu si précisé, sinon vide",
  "wu":"échauffement si décrit, sinon vide","day":0,"moment":"matin",
  "items":[{"e":"identifiant d'exercice","free":"dose exacte telle qu'écrite","w":["dose semaine 1","dose semaine 2","dose semaine 3","dose semaine 4"],"n":"consigne courte si le document en donne une, sinon omets ce champ"}]}
"day" : jour de la semaine, 0 = lundi … 6 = dimanche, déduit des dates ou jours mentionnés ; omets ce champ si non déterminable.
"moment" : seulement quand DEUX séances d'entraînement distinctes ont lieu le même jour (ex. "matin" et "soir") ; omets-le sinon.
Pour chaque exercice, choisis l'une de ces deux formes de dose selon ce que dit le document (jamais les deux, jamais de gabarit interne) :
- "free" : texte EXACT de la prescription telle qu'écrite (ex. "3 x 2 reps · 80 % RM squat · récup 20''") — la forme la plus courante.
- "w" : tableau de 4 textes au plus, un par semaine réelle de progression (ex. "4 x 5 · 75 %" puis "5 x 4 · 80 %"…) — seulement si LA MÊME séance se répète sur plusieurs semaines avec une charge qui monte et que le document donne bien une valeur par semaine pour cet exercice ; une valeur manquante se laisse vide ("").
Pour "e", choisis l'identifiant le plus proche dans cette liste [id, nom, catégorie] si un exercice correspond vraiment à ce que fait l'athlète ; sinon invente un identifiant court en minuscules avec des underscores, proche du nom français de l'exercice.`;
const IMPORT_META_PROMPT = `Tâche : import_programme_meta. Tu reçois le texte extrait d'un programme d'entraînement en PDF, écrit par un préparateur physique pour un ou des athlètes.

Deux structures possibles, à bien distinguer avant de répondre :
1. Semaine type qui se répète (périodisation classique) : les mêmes jours et les mêmes séances reviennent sur plusieurs semaines, avec une charge qui monte puis redescend (ex. « Semaine type · 4 semaines », un tableau hebdomadaire, une progression en % par semaine). Décris alors les séances DIRECTEMENT dans "sessions" ci-dessous, une seule fois chacune, avec leur dose semaine par semaine ("w") — jamais la même séance répétée plusieurs fois.
2. Programme bespoke : chaque semaine (voire chaque jour) a un contenu vraiment différent, sans répétition. Laisse alors "sessions" vide et remplis "weeks" : chaque semaine sera relue séparément dans un deuxième temps.

Réponds uniquement avec un objet JSON (sans texte autour, sans balises de code), de cette forme exacte :
{"n":"nom du programme","short":"accroche courte (une phrase)","desc":"description courte (une à deux phrases)",
 "lieu":"Salle, Extérieur, ou autre lieu principal selon le document",
 "repeating": true si cas 1 ci-dessus, false si cas 2,
 "blockName":"nom de la semaine type (cas 1 seulement, ex. 'Semaine type')","blockFocus":"objectif général (cas 1 seulement)",
 "sessions":[${IMPORT_SESSION_SHAPE} (cas 1 seulement ; tableau vide si cas 2)],
 "weeks":[{"n":"nom de cette semaine (ex. intitulé exact trouvé dans le document)","focus":"objectif de cette semaine en une phrase",
   "marker":"copie EXACTE d'une courte phrase ou d'un titre du document qui marque le début de cette semaine"}] (cas 2 seulement ; tableau vide si cas 1),
 "refsMarker":"copie exacte du titre de la section des références scientifiques si le document en a une (sinon omets ce champ)",
 "refs":["au plus 6 références scientifiques complètes trouvées dans le document, chacune en 200 caractères au plus (sinon tableau vide)"],
 "science":"un paragraphe de 400 caractères au plus résumant la logique scientifique si le document l'explique, sinon chaîne vide"}
Dans "weeks" (cas 2), une entrée par semaine réelle du document, dans l'ordre. "marker" doit être une sous-chaîne EXACTE du texte fourni (copiée mot pour mot, avec les mêmes espaces et accents), assez longue pour être unique (8 à 15 mots), jamais résumée ni reformulée. S'il n'y a qu'une seule semaine, un seul élément dans "weeks" suffit.

Liste d'exercices existants [id, nom, catégorie] pour choisir un identifiant si un exercice correspond vraiment (cas 1 seulement, ignore cette liste si cas 2) : `;
async function importMeta(text, exList, sample) { return sample.json(IMPORT_META_PROMPT + JSON.stringify(exList) + "\n\nTexte du document :\n" + text, { cache: false }); }
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
function importWeekPrompt(weekMeta, text, exList) {
  return `Tâche : import_programme_semaine. Tu structures UNE semaine (ou une partie d'une semaine) d'un programme d'entraînement pour l'application d'un préparateur physique. Transforme le texte ci-dessous en séances avec exercices, fidèlement, sans rien inventer ni arrondir les chiffres. Ignore les lignes qui ne décrivent pas une séance d'entraînement (repas, trajets, logistique) : garde-les tout au plus comme contexte bref dans "focus", jamais comme exercice.
Réponds uniquement avec un objet JSON (sans texte autour, sans balises de code), de cette forme exacte :
{"sessions":[${IMPORT_SESSION_SHAPE}]}

Nom de cette semaine : ` + (weekMeta.n || "") + `
Liste d'exercices existants [id, nom, catégorie] pour choisir un identifiant si un exercice correspond vraiment : ` + JSON.stringify(exList) + `

Texte :
` + text;
}
/* une semaine entière d'un coup, et seulement si la réponse est trop longue pour le relais (JSON tronqué),
   une page (= un jour, en pratique) à la fois — jamais le choix inverse, pour rester rapide dans le cas courant */
async function importWeekSessions(weekMeta, text, exList, sample) {
  try {
    const r = await sample.json(importWeekPrompt(weekMeta, text, exList), { cache: false });
    return r && Array.isArray(r.sessions) ? r.sessions : [];
  } catch (e) {
    if (!importSplittable(e)) throw e;
    const pages = splitByPageMarkers(text);
    if (pages.length <= 1) throw e;
    const out = [];
    for (const p of pages) {
      try { const r = await sample.json(importWeekPrompt(weekMeta, p, exList), { cache: false }); if (r && Array.isArray(r.sessions)) out.push(...r.sessions); }
      catch (e2) { /* une page illisible : les autres restent, plutôt que de tout perdre */ }
    }
    return out;
  }
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
/* semaines distinctes (programme bespoke) regroupées par blocs de 4 (comme les programmes construits) : chaque
   séance d'un bloc de plusieurs semaines porte le numéro de sa semaine (wib), pour n'apparaître que la sienne */
function blocksFromWeeks(weeks) {
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
  return blocks;
}
function sanitizeImportedProgram(meta, blocks) {
  const m = meta && typeof meta === "object" ? meta : {};
  const refs = Array.isArray(m.refs) ? m.refs.filter((x) => typeof x === "string" && x.trim()).slice(0, 10).map((x) => x.trim().slice(0, 300)) : [];
  return {
    kind: "program", id: rid("c_"), isNew: true, fromPdf: true,
    n: (typeof m.n === "string" && m.n.trim() ? m.n.trim() : "Programme importé").slice(0, 80),
    short: typeof m.short === "string" ? m.short.trim().slice(0, 140) : "",
    desc: typeof m.desc === "string" ? m.desc.trim().slice(0, 400) : "",
    lieu: typeof m.lieu === "string" && m.lieu.trim() ? m.lieu.trim().slice(0, 40) : "Salle",
    maison: false, tests: [], better: {}, habits: [], refs,
    science: typeof m.science === "string" ? m.science.trim().slice(0, 1200) : "",
    blocks: blocks && blocks.length ? blocks : [{ n: "Bloc 1", focus: "", sessions: [] }],
  };
}
async function importProgramFromText(text, exo, sample, onProgress) {
  onProgress && onProgress(1, 2);
  const exList = exerciseListForAI(exo);
  const meta = await importMeta(text, exList, sample);
  if (meta && meta.repeating && Array.isArray(meta.sessions) && meta.sessions.length) {
    onProgress && onProgress(2, 2);
    const sessions = meta.sessions.map((raw, k) => sanitizeImportedSession(raw, "s" + (k + 1)));
    return sanitizeImportedProgram(meta, [{ n: (meta.blockName || "Bloc 1").slice(0, 120), focus: String(meta.blockFocus || "").slice(0, 200), sessions }]);
  }
  const slices = sliceWeeks(text, meta).slice(0, PDFIMPORT_MAXWEEKS);
  const weeks = [];
  for (let i = 0; i < slices.length; i++) {
    onProgress && onProgress(i + 2, slices.length + 1);
    const sessions = await importWeekSessions(slices[i].meta, slices[i].text, exList, sample);
    weeks.push({ n: slices[i].meta && slices[i].meta.n, focus: slices[i].meta && slices[i].meta.focus, sessions });
  }
  return sanitizeImportedProgram(meta, blocksFromWeeks(weeks));
}
