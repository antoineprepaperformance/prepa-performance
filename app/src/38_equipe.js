/* ===== Saisons d'équipe et offre Club =====
   Demande d'Antoine (16 et 17 novembre 2026) : intégrer la programmation de son club (son classeur Excel de
   saison, avec les timings des séances), puis la vendre à des clubs qui n'ont pas de préparateur physique :
   « on récupère le dossier Excel que j'ai fait, qu'on adaptera en fonction des jours et de la demande des
   clubs. Il faudra que ça soit géré en autonomie. »

   Ce que c'est. Le classeur décrit des séances d'ÉQUIPE : un horaire, une durée, une suite d'activités
   minutées (échauffement, jeu de fitness, rugby collectif, physique). On ne le transforme pas en programme
   individuel et on ne l'invente pas : on le garde tel qu'il est écrit, on le déroule au minuteur, on le
   montre aux joueurs, et on le recale sur le calendrier de chaque club.

   PRIVÉ. Le dépôt et le site sont publics : la saison ne vit plus dans le code (content_equipe.py retiré le
   17 novembre). Antoine importe son classeur dans son espace coach : il est lu dans le navigateur et rangé
   dans « modeles/{id} » (lu par lui seul). Chaque club reçoit sa saison recalée dans « clubs/{id} », lue par
   Antoine et par les membres du club : ceux qui ont utilisé l'un de ses codes, ou qu'Antoine y a rattachés.

   Recalage (eqRecaler). Pour chaque semaine du club : la semaine du modèle à la même période de la saison
   (un club qui démarre en novembre reçoit les séances de novembre, pas la présaison) ; pour chaque jour
   d'entraînement du club, la séance de cette semaine dont la place avant le match est la plus proche (la
   séance de veille de match reste la veille du match). Pas de séance inventée : un jour sans séance
   correspondante reste vide. Pour un autre club que celui du classeur, les prénoms cochés à l'import et les
   noms des adversaires sont retirés.

   Ce qui n'est PAS fait, volontairement : la séance d'équipe n'est pas comptée automatiquement dans la
   charge hebdomadaire du joueur (il ne la coche pas : la compter reviendrait à inventer un effort qu'on n'a
   pas mesuré). S'il l'enregistre en séance en plus, c'est celle-là qui compte. */
const EQ_THEMES = {
  modere: { n: "Modéré", t: "", d: "Charge contenue : technique, collectif réduit, peu de déplacement." },
  intense: { n: "Intense", t: "bad", d: "Grosse soirée : jeu de fitness, collectif total, forte sollicitation." },
  vitesse: { n: "Vitesse", t: "gold", d: "Qualité : vitesse, réactivité, appuis. Volume court, récupération longue." },
  volume: { n: "Volume", t: "okb", d: "Volume de travail élevé, intensité contenue. Typique de la présaison." },
};
const EQ_JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const EQ_DUREES = [{ w: 4, n: "1 mois" }, { w: 12, n: "3 mois" }, { w: 26, n: "6 mois" }, { w: 52, n: "12 mois" }];
const EQ_MAX_JOUEURS = 30, EQ_MAX_ENTRAINEURS = 3;
/* offre Club (grille du 17 novembre 2026) : par équipe, 1, 3, 6 et 12 mois, sur devis */
const CLUB_PRIX = [299, 799, 1499, 2849];
function eqTheme(s) { return (s && EQ_THEMES[s.theme]) || null; }
function eqSeanceAt(sai, d) { return sai ? (sai.seances || []).find((s) => s.d === d) || null : null; }
/* prochaine séance à venir (ou celle du jour) */
function eqProchaine(sai, today) {
  const d = today || todayISO();
  return sai ? (sai.seances || []).find((s) => s.d >= d) || null : null;
}
/* phases du classeur : « Présaison - Semaine 2 », « Saison - Semaine 14 - Match J-4 ISSOIRE » (J-4 = 4e journée) */
function eqPhaseCourte(s) {
  const p = String((s && s.phase) || "");
  const m = p.match(/^(Pr[ée]saison|Saison)\s*-\s*Semaine\s*(\d+)/i);
  return m ? (m[1].toLowerCase().startsWith("pr") ? "Présaison" : "Saison") + " · " + WK + m[2] : p.split(" - ")[0] || "";
}
function eqMatch(s) { const m = String((s && s.phase) || "").match(/Match\s+(J-\d+)\s*(.*)$/i); return m ? { j: m[1], adv: (m[2] || "").trim() } : null; }
/* le minuteur de l'application attend une suite d'étapes : une par activité, sa durée telle qu'écrite */
function eqSeq(s) {
  const acts = (s && s.acts || []).filter((a) => a.min > 0);
  return acts.map((a, i) => ({ kind: "work", secs: a.min * 60, n: a.n, label: "Activité " + (i + 1) + " sur " + acts.length }));
}
/* « 2025-07 » → « Novembre 2025 » (dans la langue de la personne) */
function fmtMois(k) {
  const [y, m] = String(k).split("-");
  let n = "";
  try { n = new Date(Number(y), Math.max(0, Math.min(11, Number(m) - 1)), 1).toLocaleDateString(LOCALE, { month: "long" }); } catch (e) {}
  return n.charAt(0).toUpperCase() + n.slice(1) + " " + y;
}

/* ---------- lecture d'un classeur .xlsx dans le navigateur (aucune bibliothèque, rien n'est envoyé) ----------
   Un .xlsx est une archive ZIP de fichiers XML : on lit son répertoire central, puis on décompresse les
   seuls fichiers utiles (classeur, feuilles, textes partagés) avec le DecompressionStream du navigateur. */
function xlsxDir(buf) {
  const dv = new DataView(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).");
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const out = {}, dec = new TextDecoder();
  for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const method = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    out[dec.decode(new Uint8Array(buf, p + 46, nl))] = { method, comp, off };
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function xlsxText(buf, ent) {
  if (!ent) return "";
  const dv = new DataView(buf);
  const start = ent.off + 30 + dv.getUint16(ent.off + 26, true) + dv.getUint16(ent.off + 28, true);
  const data = new Uint8Array(buf, start, ent.comp);
  if (ent.method === 0) return new TextDecoder().decode(data);
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(s).text();
}
function xmlDoc(t) { return new DOMParser().parseFromString(t || "<x/>", "application/xml"); }
function xmlAll(node, tag) { return Array.from(node.getElementsByTagNameNS("*", tag)); }
function xlsxColRow(ref) {
  const m = String(ref || "").match(/^([A-Z]+)(\d+)$/);
  if (!m) return [0, 0];
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return [c - 1, Number(m[2]) - 1];
}
/* toutes les feuilles : [{ name, grid }] (grille de textes, lignes × colonnes) */
async function xlsxSheets(buf) {
  const dir = xlsxDir(buf);
  const shared = xmlAll(xmlDoc(await xlsxText(buf, dir["xl/sharedStrings.xml"])), "si").map((si) => xmlAll(si, "t").map((t) => t.textContent).join(""));
  const rels = {};
  xmlAll(xmlDoc(await xlsxText(buf, dir["xl/_rels/workbook.xml.rels"])), "Relationship").forEach((r) => { rels[r.getAttribute("Id")] = r.getAttribute("Target"); });
  const RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const out = [];
  for (const sh of xmlAll(xmlDoc(await xlsxText(buf, dir["xl/workbook.xml"])), "sheet")) {
    const target = String(rels[sh.getAttributeNS(RNS, "id") || sh.getAttribute("r:id")] || "").replace(/^\//, "");
    const part = target.startsWith("xl/") ? target : "xl/" + target;
    const cells = {};
    let h = 0, w = 0;
    xmlAll(xmlDoc(await xlsxText(buf, dir[part])), "c").forEach((c) => {
      const [x, y] = xlsxColRow(c.getAttribute("r"));
      const t = c.getAttribute("t"), v = xmlAll(c, "v")[0];
      let s = "";
      if (t === "s" && v) s = shared[Number(v.textContent)] || "";
      else if (t === "inlineStr") s = xmlAll(c, "t").map((n) => n.textContent).join("");
      else if (v) s = v.textContent || "";
      s = s.replace(/\s+/g, " ").trim();
      if (s) { cells[y + ":" + x] = s; h = Math.max(h, y + 1); w = Math.max(w, x + 1); }
    });
    const grid = [];
    for (let r = 0; r < h; r++) { const row = []; for (let k = 0; k < w; k++) row.push(cells[r + ":" + k] || ""); grid.push(row); }
    out.push({ name: sh.getAttribute("name") || "", grid });
  }
  return out;
}

/* ---------- du classeur aux séances (même lecture que l'ancien outil tools/saison_equipe.py) ---------- */
const EQ_MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
const EQ_THEME_IDS = { MODERE: "modere", MODEREE: "modere", "MODERE++": "modere", INTENSE: "intense", INTENSITE: "intense", VITESSE: "vitesse", VOLUME: "volume", "VOLUME --": "volume" };
function eqSansAccent(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
/* « Jeudi 03 Juillet 2025 » → « 2025-07-03 » ; null si la feuille n'est pas une séance datée (CALENDRIER…) */
function eqDateFeuille(t) {
  const m = String(t || "").match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/);
  const mo = m && EQ_MOIS[eqSansAccent(m[2]).toLowerCase()];
  return mo ? m[3] + "-" + String(mo).padStart(2, "0") + "-" + String(Number(m[1])).padStart(2, "0") : null;
}
function eqMinutes(t) { const m = String(t || "").match(/(\d+)/); return m ? Number(m[1]) : 0; }
function eqLireSeance(nom, g) {
  const cell = (r, c) => (g[r] && g[r][c]) || "";
  const phase = cell(0, 0).replace(/^Plan d'entra[îi]nement\s*-\s*/i, "").trim();
  let theme = "", debut = "";
  for (let r = 0; r < Math.min(6, g.length); r++) {
    g[r].forEach((v, c) => {
      const mt = v.match(/TH[EÈ]ME\s*:?\s*(.+)/i);
      if (mt) theme = mt[1].trim();
      if (v.trim().toLowerCase().startsWith("début")) debut = g[r].slice(c + 1, c + 4).find((x) => /\d/.test(x)) || "";
    });
  }
  const acts = [];
  let cur = null;
  g.forEach((r) => {
    const a = (r[0] || "").trim();
    if (/^Activit[ée]\s*\d+/i.test(a)) { cur = { n: "", min: 0, l: [] }; acts.push(cur); }
    if (!cur) return;
    if (/^dur[ée]e?\s*:?$/i.test(a) && r.length > 1) cur.min = eqMinutes(r[1]);
    const d = (r[2] || "").trim();
    if (!d || d.toUpperCase() === "DESCRIPTION") return;
    /* le titre du bloc est sa PREMIÈRE ligne, quelle que soit sa casse (« ECHAUFFEMENT », « Fitness Game ») */
    if (!cur.n) { cur.n = d; return; }
    const rep = (r[3] || "").trim();
    const dur = [6, 4, 5].map((i) => r[i] || "").find((x) => /\d/.test(x)) || "";
    const note = (r[8] || "").trim();
    const ligne = { d };
    if (rep && rep.toUpperCase() !== "DESCRIPTION") ligne.x = rep;
    if (dur) ligne.t = dur;
    if (note && note.toUpperCase() !== "NOTES") ligne.note = note.slice(0, 300);
    cur.l.push(ligne);
  });
  const ok = acts.filter((a) => a.n || a.l.length).map((a) => ({ ...a, n: a.n || "Activité" }));
  return { n: nom.trim(), phase, theme: EQ_THEME_IDS[eqSansAccent(theme).toUpperCase().trim()] || "", themeTxt: theme, debut, min: ok.reduce((t, a) => t + a.min, 0), acts: ok };
}
/* feuilles → { seances (triées par date), vides (onglets datés sans contenu), feuilles (noms vus) } */
function eqLireClasseur(sheets) {
  const seances = [], vides = [];
  sheets.forEach((sh) => {
    const d = eqDateFeuille(sh.name);
    if (!d) return;
    const s = eqLireSeance(sh.name, sh.grid);
    if (!s.acts.length) { vides.push(sh.name); return; }
    seances.push({ ...s, d });
  });
  seances.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { seances, vides, feuilles: sheets.map((s) => s.name) };
}
/* mots rares écrits avec une majuscule au milieu d'une phrase (« 80 m pour Paul ») : les candidats « prénom » à cocher à l'import ;
   en début de cellule ou après un point, la majuscule ne dit rien (« Gainage », « Récup ») */
const EQ_PAS_NOMS = new Set([...Object.keys(EQ_MOIS), "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "match", "j"]);
function eqMotsRares(seances) {
  const compte = {};
  (seances || []).forEach((s) => {
    /* la phase (« Match J-8 » et l'adversaire) n'est pas lue : pour un autre club, elle est réécrite en entier */
    const textes = [...s.acts.map((a) => a.n), ...s.acts.flatMap((a) => a.l.flatMap((l) => [l.d, l.note || ""]))];
    textes.forEach((t) => {
      const txt = String(t || "");
      for (const m of txt.matchAll(/[A-ZÉÈÀÂÎÔÛ][a-zéèàâîôûïçö'’-]+/g)) {
        const avant = txt.slice(0, m.index), pre = avant.trimEnd();
        if (/[A-Za-zÀ-ÿ0-9]$/.test(avant) || !pre || /[.:!?\-–(]$/.test(pre)) continue;
        const w = m[0].replace(/['’-]+$/, "");
        if (w.length < 2 || EQ_PAS_NOMS.has(eqSansAccent(w).toLowerCase())) continue;
        compte[w] = (compte[w] || 0) + 1;
      }
    });
  });
  return Object.keys(compte).filter((m) => compte[m] <= 4).sort((a, b) => a.localeCompare(b, "fr"));
}
/* retire des noms : « 80 m pour Paul, Jean et Marc » → « 80 m pour certains joueurs » */
function eqSansNoms(txt, noms) {
  if (!txt || !noms || !noms.length) return txt;
  const esc = noms.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const p = "(?<![A-Za-zÀ-ÿ])(?:" + esc + ")(?![A-Za-zÀ-ÿ])";
  return String(txt).replace(new RegExp(p + "(?:\\s*(?:,|et)\\s*" + p + ")*", "gi"), (m) => ((m.match(new RegExp(p, "gi")) || []).length > 1 ? "certains joueurs" : "un joueur"));
}

/* ---------- recalage d'une saison modèle sur le calendrier d'un club ---------- */
function eqLundi(iso) { const d = parseISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d); }
function eqEcart(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function eqJourSem(iso) { return (parseISO(iso).getDay() + 6) % 7; }   // 0 = lundi … 6 = dimanche
/* jours avant le match (le jour du match lui-même compte pour 7 : une séance le jour du match est la plus éloignée du suivant) */
function eqAvantMatch(jour, match) { return ((match - jour + 7) % 7) || 7; }
/* semaine du modèle à la même période de la saison qu'une semaine du club : son lundi, ramené à l'année du modèle, tombe
   dans la semaine du modèle la plus proche (2 novembre 2026 → semaine du 3 novembre 2025) ; -1 hors saison (trêve d'été) */
function eqSemaineModele(m, lundi, nbSem) {
  const m0 = eqLundi(m.du), y = Number(String(m.du).slice(0, 4)), md = String(lundi).slice(4);
  for (const yy of [y, y + 1, y - 1]) {
    const w = Math.round(eqEcart(m0, yy + (md === "-02-29" ? "-02-28" : md)) / 7);
    if (w >= 0 && w < nbSem) return w;
  }
  return -1;
}
/* m : modèle { du, seances, noms } ; c : { du, jours[], heure, match, weeks, anon } → séances datées du club.
   Chaque semaine du club reprend la semaine du modèle à la même date : un club qui démarre en novembre a les séances de
   novembre ; sur 12 mois, la trêve reste une trêve et la présaison revient en juillet. Aucune séance n'est inventée. */
function eqRecaler(m, c) {
  const m0 = eqLundi(m.du), parSem = {};
  (m.seances || []).forEach((s) => { const w = Math.floor(eqEcart(m0, s.d) / 7); (parSem[w] = parSem[w] || []).push(s); });
  const nbSem = Math.max(0, ...Object.keys(parSem).map(Number)) + 1;
  const c0 = eqLundi(c.du);
  const jours = [...new Set((c.jours || []).map(Number))].filter((j) => j >= 0 && j <= 6);
  const match = Number.isInteger(Number(c.match)) ? Number(c.match) : 6;
  /* le modèle joue le dimanche ; on sert d'abord le jour le plus proche du match (la veille reste la veille) ;
     à égalité, la séance la plus tôt dans la semaine du modèle (la plus chargée) va au jour le plus éloigné du match */
  const ordre = [...jours].sort((a, b) => eqAvantMatch(a, match) - eqAvantMatch(b, match));
  const noms = c.anon ? (m.noms || []) : [];
  const net = (t) => eqSansNoms(t, noms);
  const out = [];
  for (let k = 0; k < (Number(c.weeks) || 4); k++) {
    const mw = eqSemaineModele(m, addDays(c0, k * 7), nbSem);
    if (mw < 0) continue;
    const libres = [...(parSem[mw] || [])].sort((a, b) => (a.d < b.d ? -1 : 1));
    ordre.forEach((j) => {
      const d = addDays(c0, k * 7 + j);
      if (d < c.du || !libres.length) return;
      const cible = eqAvantMatch(j, match);
      let best = 0;
      libres.forEach((s, i) => { if (Math.abs(eqAvantMatch(eqJourSem(s.d), 6) - cible) < Math.abs(eqAvantMatch(eqJourSem(libres[best].d), 6) - cible)) best = i; });
      const s = libres.splice(best, 1)[0];
      const pm = String(s.phase || "").match(/^(Pr[ée]saison|Saison)/i);
      const phase = (pm ? (pm[1].toLowerCase().startsWith("pr") ? "Présaison" : "Saison") : "Saison") + " - Semaine " + (k + 1);
      out.push({ ...s, d, n: EQ_JOURS[j] + " " + fmtD(d), phase: c.anon ? phase : s.phase, debut: c.heure || s.debut, modele: s.d,
        acts: (s.acts || []).map((a) => ({ ...a, n: net(a.n), l: (a.l || []).map((l) => ({ ...l, d: net(l.d), ...(l.note ? { note: net(l.note) } : {}) })) })) });
    });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return out;
}

/* ---------- une séance : sa timeline, telle qu'Antoine l'a écrite ---------- */
function EqSeance({ s, onStart, onClose, coachView }) {
  if (!s) return null;
  const th = eqTheme(s), mt = eqMatch(s);
  return html`<div className="stack">
    ${onClose ? html`<button type="button" className="linkbtn back-l" onClick=${onClose}>${coachView ? "‹ Toute la saison" : "‹ Retour"}</button>` : null}
    <header className="page-h"><div><div className="eyebrow">${eqPhaseCourte(s)}${s.debut ? " · " + s.debut : ""}${s.min ? " · " + plural(s.min, "minute") : ""}</div>
      <h1 className="who"><span>${fmtDY(s.d)}</span></h1>
      <div className="chips">${th ? html`<${Pill} tone=${th.t}>${th.n}</${Pill}>` : null}${mt ? html`<${Pill} tone="gold">Match ${mt.j}${mt.adv ? " · " + mt.adv : ""}</${Pill}>` : null}</div></div></header>
    ${th ? html`<p className="muted small">${th.d}</p>` : null}
    ${onStart && eqSeq(s).length ? html`<div className="btnrow"><${Btn} onClick=${() => onStart(s)}>Lancer la séance au minuteur</${Btn}></div>` : null}
    ${(s.acts || []).map((a, i) => html`<${Card} key=${i} title=${a.n} sub=${a.min ? plural(a.min, "minute") : null}>
      ${(a.l || []).length ? html`<ul className="rlist">${a.l.map((l, k) => html`<li key=${k}><span><b>${l.d}</b>${l.x || l.t ? html` <span className="muted small">${[l.x, l.t].filter(Boolean).join(" · ")}</span>` : null}
${l.note ? html`<br /><span className="muted small">${l.note}</span>` : null}</span></li>`)}</ul>` : html`<p className="muted small">Pas de détail noté pour ce bloc.</p>`}
    </${Card}>`)}
    ${coachView ? html`<p className="muted small">Reprise telle qu'elle est écrite dans ton classeur : pour la modifier, change le classeur et importe-le à nouveau (Équipe › Importer un classeur).</p>` : null}
  </div>`;
}

/* ---------- une saison : groupée par mois, filtrable, chaque séance s'ouvre et se lance au minuteur ---------- */
function EqSaisonView({ sai, titre, sub, coachView, onBack, extra }) {
  const [phase, setPhase] = useState("toutes");
  const [theme, setTheme] = useState("tous");
  const [sel, setSel] = useState(null);
  const [play, setPlay] = useState(null);
  if (play) return html`<${TimerPlayer} title=${fmtDY(play.d) + (play.debut ? " · " + play.debut : "")} seq=${eqSeq(play)} kind="equipe" onClose=${() => setPlay(null)} onFinish=${() => setPlay(null)} />`;
  if (sel) return html`<${EqSeance} s=${sel} coachView=${coachView} onStart=${(s) => setPlay(s)} onClose=${() => setSel(null)} />`;
  const all = (sai && sai.seances) || [];
  const liste = all.filter((s) => (phase === "toutes" || eqPhaseCourte(s).startsWith(phase === "pre" ? "Présaison" : "Saison")) && (theme === "tous" || s.theme === theme));
  /* groupées par mois : une saison se lit par blocs, pas en liste de cent lignes */
  const mois = [];
  liste.forEach((s) => {
    const k = s.d.slice(0, 7);
    const g = mois.find((x) => x.k === k) || (mois.push({ k, items: [] }), mois[mois.length - 1]);
    g.items.push(s);
  });
  const today = todayISO();
  const proch = eqProchaine(sai, today);
  return html`<div className="stack">
    ${onBack ? html`<button type="button" className="linkbtn back-l" onClick=${onBack}>‹ Retour</button>` : null}
    <header className="page-h"><div><div className="eyebrow">Saison d'équipe</div><h1>${titre}</h1>${sub ? html`<p className="muted small">${sub}</p>` : null}</div></header>
    ${extra || null}
    ${proch ? html`<${Card} title=${proch.d === today ? "La séance de ce soir" : "Prochaine séance"} sub=${fmtDY(proch.d) + (proch.debut ? " · " + proch.debut : "")}
      action=${html`<${Btn} small onClick=${() => setSel(proch)}>Ouvrir</${Btn}>`}>
      <p className="small">${(proch.acts || []).map((a) => a.n).join(" · ")}</p>
      ${eqTheme(proch) ? html`<p className="muted small">${eqTheme(proch).n} — ${eqTheme(proch).d}</p>` : null}</${Card}>` : all.length ? html`<p className="muted small">La saison est terminée : toutes ses séances restent consultables.</p>` : null}
    <div className="tabs-scroll"><${Seg} options=${[{ v: "toutes", n: "Toute la saison" }, { v: "pre", n: "Présaison" }, { v: "sai", n: "Saison" }]} value=${phase} onChange=${setPhase} /></div>
    <div className="tabs-scroll"><${Seg} options=${[{ v: "tous", n: "Tous les thèmes" }, ...Object.entries(EQ_THEMES).map(([v, t]) => ({ v, n: t.n }))]} value=${theme} onChange=${setTheme} /></div>
    <p className="muted small">${plural(liste.length, "séance")} ${liste.length === all.length ? "en tout" : "dans ce filtre"}.</p>
    ${mois.map((g) => html`<${Card} key=${g.k} title=${fmtMois(g.k)} sub=${plural(g.items.length, "séance")}>
      <ul className="rlist">${g.items.map((s) => { const th = eqTheme(s), mt = eqMatch(s); return html`<li key=${s.d}>
        <button type="button" className="linkbtn" onClick=${() => setSel(s)}><b>${fmtD(s.d)}</b> <span className="muted small">${(s.acts || []).map((a) => a.n).slice(0, 2).join(" · ")}${s.min ? " · " + s.min + " min" : ""}</span></button>
        <span className="chips">${th ? html`<${Pill} tone=${th.t}>${th.n}</${Pill}>` : null}${mt ? html`<${Pill} tone="gold">${mt.j}</${Pill}>` : null}</span></li>`; })}</ul>
    </${Card}>`)}
  </div>`;
}

/* ---------- espace coach : modèles de saison et clubs ---------- */
function eqId(prefix) { return prefix + genCode("").replace(/[^A-Z0-9]/g, "").toLowerCase().slice(0, 10); }
/* « Lundi · Mercredi · 19h30 · Match : Samedi · du 2 nov. au 25 nov. » : des morceaux séparés par « · », traduits un à un */
function eqJourNom(j) { const n = JOURS[(Number(j) + 1) % 7] || ""; return n.charAt(0).toUpperCase() + n.slice(1); }   // 0 = lundi, dans la langue de la personne
function eqClubSub(c) {
  return [...(c.jours || []).map(eqJourNom), c.heure || null, "Match : " + eqJourNom(c.match ?? 6), "du " + fmtD(c.du) + " au " + fmtD(c.au)].filter(Boolean).join(" · ");
}
function EquipeScreen({ db }) {
  const toast = useToast();
  const modeles = useCol(db, "modeles");
  const clubs = useCol(db, "clubs");
  const codes = useCol(db, "codes");
  const [vue, setVue] = useState(null);       // { kind: "modele" | "club", id } | { kind: "import" } | { kind: "nouveau" }
  const [busy, setBusy] = useState(false);
  if (!db) return html`<${Empty} title="Saisons d'équipe" text="Les saisons d'équipe et les clubs sont rangés dans ta base : ouvre ton espace coach sur le site." />`;
  const M = modeles.items, C = clubs.items;
  if (vue && vue.kind === "import") return html`<${EqImport} db=${db} onDone=${(id) => setVue(id ? { kind: "modele", id } : null)} />`;
  if (vue && vue.kind === "nouveau") return html`<${EqNouveauClub} db=${db} modeles=${M} modeleId=${vue.modele} club=${vue.id ? C[vue.id] : null} onDone=${(id) => setVue(id ? { kind: "club", id } : null)} />`;
  if (vue && vue.kind === "modele" && M[vue.id]) {
    const m = M[vue.id];
    return html`<${EqSaisonView} sai=${m} titre=${m.n} coachView=${true} onBack=${() => setVue(null)}
      sub=${"Ton modèle : " + plural((m.seances || []).length, "séance") + " du " + fmtD(m.du) + " au " + fmtD(m.au) + ". Privé : rangé dans ta base, lu par toi seul."}
      extra=${html`<${Card} title="Prénoms retirés pour les autres clubs" sub=${(m.noms || []).length ? (m.noms || []).join(", ") : "Aucun : coche-les en important à nouveau ton classeur."}>
        <div className="btnrow"><${Btn} small kind="ghost" onClick=${() => setVue({ kind: "nouveau", modele: m.id })}>Créer un club avec ce modèle</${Btn}></div></${Card}>`} />`;
  }
  if (vue && vue.kind === "club" && C[vue.id]) {
    const c = C[vue.id];
    const cj = (c.codes && codes.items[c.codes.joueurs]) || null, ce = (c.codes && codes.items[c.codes.entraineur]) || null;
    const copier = async (t) => { try { await navigator.clipboard.writeText(t); toast("Copié.", "ok"); } catch (e) { toast(t, "ok"); } };
    const supprimer = async () => {
      if (!confirm("Supprimer le club « " + c.n + " » ? Ses joueurs gardent leur accès jusqu'à son terme, mais ne verront plus les séances d'équipe.")) return;
      setBusy(true);
      try {
        for (const k of ["joueurs", "entraineur"]) { const x = c.codes && codes.items[c.codes[k]]; if (x) await dbSet(db, "codes/" + x.code, { ...x, active: false }); }
        await dbDel(db, "clubs/" + c.id); setVue(null); toast("Club supprimé.", "ok");
      } catch (e) { toast("Suppression impossible" + errWhy(e, true), "bad"); } finally { setBusy(false); }
    };
    return html`<${EqSaisonView} sai=${c} titre=${c.n} coachView=${true} onBack=${() => setVue(null)} sub=${eqClubSub(c)}
      extra=${html`<${Card} title="Accès du club" sub=${"Chaque code ouvre la formule Autonomie (sans coach IA) pour " + (EQ_DUREES.find((d) => d.w === Number(c.weeks)) || { n: c.weeks + " semaines" }).n + " et rattache au club."}>
        <ul className="rlist">${[["Joueurs", cj, EQ_MAX_JOUEURS], ["Entraîneur", ce, EQ_MAX_ENTRAINEURS]].map(([n, x, mx]) => html`<li key=${n}><span><b>${n} : ${x ? x.code : "—"}</b>${" "}
          <span className="muted small">· ${x ? (Number(x.uses) || 0) + " place" + ((Number(x.uses) || 0) > 1 ? "s" : "") + " prise" + ((Number(x.uses) || 0) > 1 ? "s" : "") + " sur " + (Number(x.max) || mx) + (x.active === false ? " · désactivé" : "") : "code introuvable"}</span></span>
          ${x ? html`<span className="btnrow"><${Btn} small kind="ghost" onClick=${() => copier(x.code)}>Copier le code</${Btn}>${window.IS_SITE ? html`<${Btn} small kind="ghost" onClick=${() => copier(codeLink(x.code))}>Copier le lien</${Btn}>` : null}</span>` : null}</li>`)}</ul>
        <p className="muted small">Les joueurs voient leur séance d'équipe du jour ; l'entraîneur voit toute la saison et lance chaque séance au minuteur. Tout se passe par écrit, dans l'application.</p>
        ${c.demandes ? html`<p className="small"><b>Demandes du club :</b> ${c.demandes}</p>` : null}
        <div className="btnrow"><${Btn} small kind="ghost" onClick=${() => setVue({ kind: "nouveau", id: c.id })} disabled=${busy}>Changer les jours ou les dates</${Btn}><${Btn} small kind="quiet" onClick=${supprimer} disabled=${busy}>Supprimer le club</${Btn}></div>
      </${Card}>`} />`;
  }
  const lm = Object.values(M).sort((a, b) => String(b.importedAt || "").localeCompare(String(a.importedAt || "")));
  const lc = Object.values(C).sort((a, b) => String(a.n).localeCompare(String(b.n), "fr"));
  return html`<div className="stack">
    <header className="page-h"><div><div className="eyebrow">Équipe et clubs</div><h1>Saisons d'équipe</h1>
      <p className="muted small">Importe ton classeur de saison : il devient ton modèle. Pour chaque club, l'application recale tes séances sur ses jours d'entraînement et son jour de match, puis crée ses codes d'accès. Tout est privé : rien n'est publié dans le code du site.</p></div></header>
    <${Card} title="Clubs" sub=${lc.length ? plural(lc.length, "club") : "Aucun club pour l'instant"} action=${lm.length ? html`<${Btn} small onClick=${() => setVue({ kind: "nouveau" })}>Nouveau club</${Btn}>` : null}>
      ${lc.length ? html`<ul className="rlist">${lc.map((c) => html`<li key=${c.id}><button type="button" className="linkbtn" onClick=${() => setVue({ kind: "club", id: c.id })}><b>${c.n}</b></button>
        <span className="muted small">${eqClubSub(c)} · ${plural((c.seances || []).length, "séance")}</span></li>`)}</ul>`
        : html`<p className="muted small">${lm.length ? "Crée ton premier club : nom, jours d'entraînement, heure, jour de match, date de début et durée." : "Importe d'abord ton classeur de saison."}</p>`}
    </${Card}>
    <${Card} title="Tes modèles de saison" sub=${lm.length ? plural(lm.length, "modèle") : "Aucun modèle"} action=${html`<${Btn} small kind=${lm.length ? "ghost" : undefined} onClick=${() => setVue({ kind: "import" })}>Importer un classeur</${Btn}>`}>
      ${lm.length ? html`<ul className="rlist">${lm.map((m) => html`<li key=${m.id}><button type="button" className="linkbtn" onClick=${() => setVue({ kind: "modele", id: m.id })}><b>${m.n}</b></button>
        <span className="muted small">${plural((m.seances || []).length, "séance")} du ${fmtD(m.du)} au ${fmtD(m.au)}</span></li>`)}</ul>`
        : html`<p className="muted small">Ton classeur Excel, une feuille par séance (nommée comme « Jeudi 03 Juillet 2025 »), tel que tu l'utilises avec ton club.</p>`}
    </${Card}>
  </div>`;
}

/* import d'un classeur : lecture, mots rares à cocher comme prénoms, enregistrement privé */
function EqImport({ db, onDone }) {
  const toast = useToast();
  const [st, setSt] = useState(null);        // { file, seances, vides, rares }
  const [f, setF] = useState({ n: "", sport: "rugby", noms: {}, autres: "" });
  const [busy, setBusy] = useState(false);
  const lire = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const r = eqLireClasseur(await xlsxSheets(await file.arrayBuffer()));
      if (!r.seances.length) { toast("Aucune séance datée dans ce classeur. Une feuille par séance, nommée comme « Jeudi 03 Juillet 2025 ». Feuilles vues : " + (r.feuilles.join(", ") || "aucune"), "bad"); return; }
      setSt({ file: file.name, ...r, rares: eqMotsRares(r.seances) });
      setF((x) => ({ ...x, n: x.n || file.name.replace(/\.xlsx$/i, "").replace(/[_-]+/g, " ").trim() }));
    } catch (err) { toast("Lecture impossible : " + (err && err.message ? err.message : "fichier illisible"), "bad"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!st || !f.n.trim()) return;
    setBusy(true);
    try {
      const id = eqId("m");
      await dbSet(db, "modeles/" + id, { id, n: f.n.trim(), sport: f.sport.trim() || "rugby", du: st.seances[0].d, au: st.seances[st.seances.length - 1].d, seances: st.seances,
        vides: st.vides, noms: [...new Set([...Object.keys(f.noms).filter((k) => f.noms[k]), ...f.autres.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x.length > 1)])], fichier: st.file, importedAt: nowISO() });
      toast(plural(st.seances.length, "séance") + " importée" + (st.seances.length > 1 ? "s" : "") + ".", "ok");
      onDone(id);
    } catch (e) { toast("Enregistrement impossible" + errWhy(e, true), "bad"); } finally { setBusy(false); }
  };
  return html`<div className="stack">
    <button type="button" className="linkbtn back-l" onClick=${() => onDone(null)}>‹ Retour</button>
    <header className="page-h"><div><div className="eyebrow">Saisons d'équipe</div><h1>Importer un classeur</h1>
      <p className="muted small">Le fichier est lu dans ton navigateur ; seules les séances sont enregistrées, dans ta base, lues par toi seul.</p></div></header>
    <${Card} title="Ton classeur (.xlsx)"><div className=${busy ? "form dim" : "form"}>
      <input id="eq-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange=${lire} disabled=${busy} />
      ${st ? html`<p className="small ok-t">${plural(st.seances.length, "séance") + " lue" + (st.seances.length > 1 ? "s" : "") + " du " + fmtD(st.seances[0].d) + " au " + fmtD(st.seances[st.seances.length - 1].d)}${st.vides.length ? " · " + plural(st.vides.length, "onglet vide ignoré", "onglets vides ignorés") + " (" + st.vides.join(", ") + ")" : ""}.</p>` : null}
    </div></${Card}>
    ${st ? html`<${Card} title="Ton modèle"><div className="form">
      <div className="row2"><${Field} label="Nom (ton club)" id="eq-nom"><input id="eq-nom" value=${f.n} onChange=${(e) => setF({ ...f, n: e.target.value })} /></${Field}>
        <${Field} label="Sport" id="eq-sport"><input id="eq-sport" value=${f.sport} onChange=${(e) => setF({ ...f, sport: e.target.value })} /></${Field}></div>
      <${Field} label="Prénoms à retirer pour les autres clubs" hint="Les mots rares écrits avec une majuscule au milieu d'une phrase : coche les prénoms de tes joueurs. Ils restent dans ton modèle, mais n'apparaîtront chez aucun autre club (les adversaires, dans le titre des séances, sont retirés d'office).">
        <div className="chips">${st.rares.map((w) => html`<label key=${w} className="chipbtn"><input type="checkbox" checked=${!!f.noms[w]} onChange=${(e) => setF({ ...f, noms: { ...f.noms, [w]: e.target.checked } })} /> ${w}</label>`)}</div></${Field}>
      <${Field} label="Autres prénoms ou surnoms" id="eq-autres" hint="Ceux que la liste n'a pas proposés, séparés par des virgules."><input id="eq-autres" value=${f.autres} placeholder="Paul, Jojo" onChange=${(e) => setF({ ...f, autres: e.target.value })} /></${Field}>
      <div className="actions"><${Btn} onClick=${save} disabled=${busy || !f.n.trim()}>Enregistrer le modèle</${Btn}></div>
    </div></${Card}>` : null}
  </div>`;
}

/* nouveau club (ou changement de jours / dates) : recalage, codes joueurs et entraîneur */
function EqNouveauClub({ db, modeles, modeleId, club, onDone }) {
  const toast = useToast();
  const lm = Object.values(modeles || {});
  const m1 = (modeleId && modeles[modeleId]) || lm[0];
  const [f, setF] = useState(() => club ? { n: club.n, sport: club.sport || "", modele: club.modele, jours: club.jours || [], heure: club.heure || "", match: Number(club.match ?? 6), du: club.du, weeks: Number(club.weeks) || 52, demandes: club.demandes || "", anon: club.anon !== false }
    : { n: "", sport: (m1 && m1.sport) || "rugby", modele: m1 ? m1.id : "", jours: [1, 3], heure: "19h00", match: 6, du: todayISO(), weeks: 52, demandes: "", anon: true });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = modeles[f.modele];
  const apercu = m && f.jours.length ? eqRecaler(m, f) : [];
  const save = async () => {
    if (!m || !f.n.trim() || !f.jours.length || !f.du) return;
    if (!apercu.length) { toast("Aucune séance à cette période du modèle : change la date de début.", "warn"); return; }
    setBusy(true);
    try {
      const id = club ? club.id : eqId("c");
      const au = apercu[apercu.length - 1].d;
      const fin = parseISO(addDays(f.du, Number(f.weeks) * 7)).setHours(23, 59, 59, 999);
      let cds = club && club.codes;
      if (!cds) {
        const mk = async (prefix, role, max) => {
          const code = genCode(prefix);
          await dbSet(db, "codes/" + code, { code, kind: "offert", offer: "auto", weeks: Number(f.weeks), programId: null, max, uses: 0, usedBy: {}, active: true, expiresMs: fin,
            note: "Club " + f.n.trim() + " · " + (role === "entraineur" ? "entraîneur" : "joueurs"), club: id, role, createdAt: nowISO() });
          return code;
        };
        cds = { joueurs: await mk("CLUB", "joueur", EQ_MAX_JOUEURS), entraineur: await mk("ENTR", "entraineur", EQ_MAX_ENTRAINEURS) };
      }
      await dbSet(db, "clubs/" + id, { ...(club || {}), id, n: f.n.trim(), sport: f.sport.trim(), modele: m.id, jours: [...f.jours].sort(), heure: f.heure.trim(), match: Number(f.match), du: f.du, au,
        weeks: Number(f.weeks), demandes: f.demandes.trim(), anon: !!f.anon, seances: apercu, codes: cds, membres: (club && club.membres) || {}, updatedAt: nowISO(), createdAt: (club && club.createdAt) || nowISO() });
      toast(club ? "Saison du club recalée." : "Club créé : ses codes sont prêts.", "ok");
      onDone(id);
    } catch (e) { toast("Enregistrement impossible" + errWhy(e, true), "bad"); } finally { setBusy(false); }
  };
  if (!lm.length) return html`<${Empty} title="Aucun modèle" text="Importe d'abord ton classeur de saison." />`;
  return html`<div className="stack">
    <button type="button" className="linkbtn back-l" onClick=${() => onDone(club ? club.id : null)}>‹ Retour</button>
    <header className="page-h"><div><div className="eyebrow">Offre Club</div><h1>${club ? "Recaler la saison de " + club.n : "Nouveau club"}</h1>
      <p className="muted small">Tes séances sont recalées sur les jours du club, à la même période de la saison que dans ton classeur, la séance la plus proche du match restant la plus proche de son match.</p></div></header>
    <${Card} title="Le club"><div className=${busy ? "form dim" : "form"}>
      <div className="row2"><${Field} label="Nom du club" id="cl-nom"><input id="cl-nom" value=${f.n} onChange=${(e) => set("n", e.target.value)} /></${Field}>
        <${Field} label="Sport" id="cl-sport"><input id="cl-sport" value=${f.sport} onChange=${(e) => set("sport", e.target.value)} /></${Field}></div>
      ${lm.length > 1 ? html`<${Field} label="Modèle"><${Seg} options=${lm.map((x) => ({ v: x.id, n: x.n }))} value=${f.modele} onChange=${(v) => set("modele", v)} /></${Field}>` : null}
      <${Field} label="Jours d'entraînement"><div className="chips">${EQ_JOURS.map((n, j) => html`<button key=${j} type="button" className=${"chipbtn" + (f.jours.includes(j) ? " on" : "")} aria-pressed=${f.jours.includes(j)}
        onClick=${() => set("jours", f.jours.includes(j) ? f.jours.filter((x) => x !== j) : [...f.jours, j])}>${n}</button>`)}</div></${Field}>
      <div className="row2"><${Field} label="Heure de début" id="cl-heure"><input id="cl-heure" value=${f.heure} placeholder="19h00" onChange=${(e) => set("heure", e.target.value)} /></${Field}>
        <${Field} label="Jour de match" id="cl-match"><select id="cl-match" value=${f.match} onChange=${(e) => set("match", Number(e.target.value))}>${EQ_JOURS.map((n, j) => html`<option key=${j} value=${j}>${n}</option>`)}</select></${Field}></div>
      <div className="row2"><${Field} label="Début" id="cl-du"><input id="cl-du" type="date" value=${f.du} onChange=${(e) => set("du", e.target.value)} /></${Field}>
        <${Field} label="Durée"><${Seg} options=${EQ_DUREES.map((d) => ({ v: d.w, n: d.n }))} value=${Number(f.weeks)} onChange=${(v) => set("weeks", Number(v))} /></${Field}></div>
      <${Field} label="Demandes du club" id="cl-dem" hint="Ce qu'ils t'ont demandé (niveau, priorités, contraintes de terrain) : gardé dans la fiche du club."><textarea id="cl-dem" rows="2" value=${f.demandes} onChange=${(e) => set("demandes", e.target.value)}></textarea></${Field}>
      <label className="chk"><input type="checkbox" checked=${f.anon} onChange=${(e) => set("anon", e.target.checked)} /><span>Autre club que celui du classeur : retirer les prénoms cochés à l'import et les noms des adversaires</span></label>
      <p className=${apercu.length ? "small ok-t" : "small warn-t"}>${apercu.length ? plural(apercu.length, "séance") + " du " + fmtD(apercu[0].d) + " au " + fmtD(apercu[apercu.length - 1].d) + (m ? " (à partir de ta séance du " + fmtDY(apercu[0].modele) + ")" : "") + "." : "Choisis au moins un jour d'entraînement et une date de début."}</p>
      <div className="actions"><${Btn} onClick=${save} disabled=${busy || !f.n.trim() || !apercu.length}>${club ? "Recaler la saison" : "Créer le club et ses codes"}</${Btn}></div>
    </div></${Card}>
  </div>`;
}

/* ---------- côté joueur : sa séance d'équipe du jour ; côté entraîneur : toute la saison ---------- */
function EqJoueurCard({ data, go, db }) {
  const p = data.profile || {};
  const club = useDocData(p.club ? db : null, "clubs/" + (p.club || "x"));
  const [ouvert, setOuvert] = useState(false);
  const sai = club.data;
  if (!p.club || !sai) return null;
  const today = todayISO();
  if (p.clubRole === "entraineur") {
    if (ouvert) return html`<${EqSaisonView} sai=${sai} titre=${sai.n} sub=${eqClubSub(sai)} onBack=${() => setOuvert(false)} />`;
    const x = eqSeanceAt(sai, today) || eqProchaine(sai, today);
    return html`<${Card} title="Ta saison d'équipe" sub=${sai.n + " · " + plural((sai.seances || []).length, "séance")}
      action=${html`<${Btn} small onClick=${() => setOuvert(true)}>Ouvrir la saison</${Btn}>`}>
      ${x ? html`<p className="small"><b>${x.d === today ? "Ce soir" : fmtDY(x.d)}${x.debut ? " · " + x.debut : ""}</b> : ${(x.acts || []).map((a) => a.n).join(" · ")}</p>` : html`<p className="muted small">La saison est terminée : toutes ses séances restent consultables.</p>`}
      <p className="muted small">Ouvre une séance pour la lancer au minuteur sur le terrain : les activités s'enchaînent avec leurs durées.</p></${Card}>`;
  }
  const s = eqSeanceAt(sai, today) || null;
  const proch = s ? null : eqProchaine(sai, today);
  if (!s && !proch) return null;
  const x = s || proch;
  const th = eqTheme(x);
  if (ouvert) return html`<${Card} title="Ta séance d'équipe"><${EqSeance} s=${x} onClose=${() => setOuvert(false)} /></${Card}>`;
  return html`<${Card} title=${s ? "Ta séance d'équipe, ce soir" : "Ta prochaine séance d'équipe"}
    sub=${sai.n + " · " + fmtDY(x.d) + (x.debut ? " · " + x.debut : "") + (x.min ? " · " + plural(x.min, "minute") : "")}
    action=${html`<${Btn} small kind="ghost" onClick=${() => setOuvert(true)}>Voir le détail</${Btn}>`}>
    <p className="small">${(x.acts || []).map((a) => a.n).join(" · ")}</p>
    ${th ? html`<p className="muted small"><b>${th.n}.</b> ${th.d}</p>` : null}
    <p className="muted small">Cette séance est celle de ton club : elle n'est pas comptée dans ta charge de la semaine tant que tu ne l'enregistres pas toi-même, en séance en plus.</p>
  </${Card}>`;
}
/* réglage dans la fiche client, côté coach : rattacher un joueur (ou l'entraîneur) à un club */
function EqClientCard({ data, src, db, cid }) {
  const toast = useToast();
  const p = data.profile || {};
  const clubs = useCol(db, "clubs");
  const [busy, setBusy] = useState(false);
  const lc = Object.values(clubs.items);
  if (!db || !lc.length) return null;
  const set = async (v, role) => {
    setBusy(true);
    try {
      const prev = p.club && clubs.items[p.club];
      if (prev && prev.id !== v && cid) { const mb = { ...(prev.membres || {}) }; delete mb[cid]; await dbSet(db, "clubs/" + prev.id, { ...prev, membres: mb }); }
      const nx = v && clubs.items[v];
      if (nx && cid) await dbSet(db, "clubs/" + v, { ...nx, membres: { ...(nx.membres || {}), [cid]: role || "joueur" } });
      await src.setProfile({ ...p, club: v || null, clubRole: v ? role || p.clubRole || "joueur" : null });
      toast(v ? "Rattaché au club." : "Rattachement retiré.", "ok");
    } catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title="Club" sub="Si ce client joue dans un club dont tu fais la programmation">
    <div className=${busy ? "form dim" : "form"}>
      <${Field} label="Son club" hint="Il verra sa séance d'équipe du jour dans l'application, avec son horaire et son déroulé.">
        <${Seg} id="eq-club" options=${[{ v: "", n: "Aucun" }, ...lc.map((c) => ({ v: c.id, n: c.n }))]} value=${p.club || ""} onChange=${(v) => set(v, p.clubRole)} /></${Field}>
      ${p.club ? html`<${Field} label="Rôle"><${Seg} options=${[{ v: "joueur", n: "Joueur" }, { v: "entraineur", n: "Entraîneur" }]} value=${p.clubRole || "joueur"} onChange=${(v) => set(p.club, v)} /></${Field}>` : null}
      <p className="muted small">La séance d'équipe n'entre pas automatiquement dans sa charge hebdomadaire : il ne la coche pas, donc la compter reviendrait à inventer un effort qu'on n'a pas mesuré. S'il l'enregistre en séance en plus, c'est celle-là qui compte.</p>
    </div></${Card}>`;
}
