/* ===== Saison d'équipe : mener la séance, l'archiver, et la montrer aux joueurs qui sont clients =====
   Demande d'Antoine (16 novembre 2026) : intégrer la programmation de son club (CM Floirac Rugby,
   saison 2025-2026, 102 séances) « avec les timings des séances », au format de l'application.

   Ce que c'est, et ce que ce n'est pas. Le classeur d'Antoine décrit des séances d'ÉQUIPE : un horaire
   (18h30), une durée (55 à 65 min le plus souvent), et une suite d'activités minutées — échauffement, jeu
   de fitness, rugby collectif, physique. Ce n'est pas un programme individuel : on ne le transforme donc
   pas en programme à cocher, et on ne l'invente pas non plus. On le garde tel qu'il est écrit, et on y
   ajoute ce que l'application sait faire : le dérouler au minuteur, et le montrer au joueur.

   Le contenu vient de content_equipe.py, fichier GÉNÉRÉ par tools/saison_equipe.py depuis le classeur.
   On ne le modifie jamais à la main : à la saison suivante, Antoine relance l'outil.

   Quatre usages, une seule structure :
   1. mener la séance sur le terrain (minuteur qui enchaîne les activités et leurs durées) ;
   2. consulter la saison passée (archive, filtrable par phase et par thème) ;
   3. pour un joueur du club qui est aussi client, voir sa séance d'équipe du jour dans l'application ;
   4. les thèmes (Modéré, Intense, Vitesse, Volume) disent la charge de la soirée : c'est ce qui permet au
      coach de ne pas empiler une séance individuelle lourde le même jour.

   Ce qui n'est PAS fait, volontairement : la séance d'équipe n'est pas comptée automatiquement dans la
   charge hebdomadaire du joueur. Elle n'est pas enregistrée par lui (il ne la coche pas), donc la compter
   reviendrait à inventer un effort qu'on n'a pas mesuré. Le joueur peut l'enregistrer lui-même comme une
   séance en plus s'il le souhaite, et c'est elle qui comptera alors. */
const EQ = CONTENT.EQUIPES || [];
const EQ_THEMES = {
  modere: { n: "Modéré", t: "", d: "Charge contenue : technique, collectif réduit, peu de déplacement." },
  intense: { n: "Intense", t: "bad", d: "Grosse soirée : jeu de fitness, collectif total, forte sollicitation." },
  vitesse: { n: "Vitesse", t: "gold", d: "Qualité : vitesse, réactivité, appuis. Volume court, récupération longue." },
  volume: { n: "Volume", t: "okb", d: "Volume de travail élevé, intensité contenue. Typique de la présaison." },
};
function eqTheme(s) { return (s && EQ_THEMES[s.theme]) || null; }
function eqSaisons() { return EQ; }
function eqSaison(id) { return EQ.find((e) => e.id === id) || null; }
/* l'équipe d'un client : renseignée par Antoine dans la fiche du client (profil.equipe) */
function eqOf(p) { return p && p.equipe ? eqSaison(p.equipe) : null; }
function eqSeanceAt(sai, d) { return sai ? (sai.seances || []).find((s) => s.d === d) || null : null; }
/* prochaine séance à venir (ou celle du jour) */
function eqProchaine(sai, today) {
  const d = today || todayISO();
  return sai ? (sai.seances || []).find((s) => s.d >= d) || null : null;
}
/* phases du classeur : « Présaison - Semaine 2 », « Saison - Semaine 14 - Match J-4 ISSOIRE » */
function eqPhaseCourte(s) {
  const p = String((s && s.phase) || "");
  const m = p.match(/^(Pr[ée]saison|Saison)\s*-\s*Semaine\s*(\d+)/i);
  return m ? (m[1].toLowerCase().startsWith("pr") ? "Présaison" : "Saison") + " · S" + m[2] : p.split(" - ")[0] || "";
}
function eqMatch(s) { const m = String((s && s.phase) || "").match(/Match\s+(J-\d+)\s*(.*)$/i); return m ? { j: m[1], adv: (m[2] || "").trim() } : null; }
/* le minuteur de l'application attend une suite d'étapes : une par activité, sa durée telle qu'écrite */
function eqSeq(s) {
  const acts = (s && s.acts || []).filter((a) => a.min > 0);
  return acts.map((a, i) => ({ kind: "work", secs: a.min * 60, n: a.n, label: "Activité " + (i + 1) + " sur " + acts.length }));
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
        ${l.note ? html`<span className="muted small">${l.note}</span>` : null}</span></li>`)}</ul>` : html`<p className="muted small">Pas de détail noté pour ce bloc.</p>`}
    </${Card}>`)}
    ${coachView ? html`<p className="muted small">Séance de la saison ${s.n}. Reprise telle qu'elle est écrite dans ton classeur : pour la modifier, change le classeur et relance <code>tools/saison_equipe.py</code>.</p>` : null}
  </div>`;
}

/* ---------- écran coach : toute la saison, filtrable ---------- */
function EquipeScreen() {
  const [sid, setSid] = useState(EQ.length ? EQ[0].id : null);
  const [phase, setPhase] = useState("toutes");
  const [theme, setTheme] = useState("tous");
  const [sel, setSel] = useState(null);
  const [play, setPlay] = useState(null);
  const sai = eqSaison(sid);
  if (!sai) return html`<${Empty} title="Aucune saison d'équipe" text="Lance tools/saison_equipe.py sur ton classeur de saison pour l'ajouter." />`;
  if (play) return html`<${TimerPlayer} title=${play.n + " · " + fmtD(play.d)} seq=${eqSeq(play)} kind="equipe" onClose=${() => setPlay(null)} onFinish=${() => setPlay(null)} />`;
  if (sel) return html`<${EqSeance} s=${sel} coachView=${true} onStart=${(s) => setPlay(s)} onClose=${() => setSel(null)} />`;
  const liste = (sai.seances || []).filter((s) => (phase === "toutes" || eqPhaseCourte(s).startsWith(phase === "pre" ? "Présaison" : "Saison")) && (theme === "tous" || s.theme === theme));
  /* groupées par mois : une saison se lit par blocs, pas en liste de 102 lignes */
  const mois = [];
  liste.forEach((s) => {
    const k = s.d.slice(0, 7);
    const g = mois.find((x) => x.k === k) || (mois.push({ k, items: [] }), mois[mois.length - 1]);
    g.items.push(s);
  });
  const today = todayISO();
  const proch = eqProchaine(sai, today);
  return html`<div className="stack">
    <header className="page-h"><div><div className="eyebrow">Saison d'équipe</div><h1>${sai.n}</h1>
      <p className="muted small">${plural(sai.seances.length, "séance")} du ${fmtD(sai.du)} au ${fmtD(sai.au)}. Reprises de ton classeur, telles qu'elles sont écrites.</p></div></header>
    ${proch ? html`<${Card} title=${proch.d === today ? "La séance de ce soir" : "Prochaine séance"} sub=${fmtDY(proch.d) + (proch.debut ? " · " + proch.debut : "")}
      action=${html`<${Btn} small onClick=${() => setSel(proch)}>Ouvrir</${Btn}>`}>
      <p className="small">${(proch.acts || []).map((a) => a.n).join(" · ")}</p>
      ${eqTheme(proch) ? html`<p className="muted small">${eqTheme(proch).n} — ${eqTheme(proch).d}</p>` : null}</${Card}>` : null}
    <div className="tabs-scroll"><${Seg} options=${[{ v: "toutes", n: "Toute la saison" }, { v: "pre", n: "Présaison" }, { v: "sai", n: "Saison" }]} value=${phase} onChange=${setPhase} /></div>
    <div className="tabs-scroll"><${Seg} options=${[{ v: "tous", n: "Tous les thèmes" }, ...Object.entries(EQ_THEMES).map(([v, t]) => ({ v, n: t.n }))]} value=${theme} onChange=${setTheme} /></div>
    <p className="muted small">${plural(liste.length, "séance")} ${liste.length === sai.seances.length ? "en tout" : "dans ce filtre"}.</p>
    ${mois.map((g) => html`<${Card} key=${g.k} title=${fmtMois(g.k)} sub=${plural(g.items.length, "séance")}>
      <ul className="rlist">${g.items.map((s) => { const th = eqTheme(s), mt = eqMatch(s); return html`<li key=${s.d}>
        <button type="button" className="linkbtn" onClick=${() => setSel(s)}><b>${fmtD(s.d)}</b> <span className="muted small">${(s.acts || []).map((a) => a.n).slice(0, 2).join(" · ")}${s.min ? " · " + s.min + " min" : ""}</span></button>
        <span className="chips">${th ? html`<${Pill} tone=${th.t}>${th.n}</${Pill}>` : null}${mt ? html`<${Pill} tone="gold">${mt.j}</${Pill}>` : null}</span></li>`; })}</ul>
    </${Card}>`)}
  </div>`;
}
/* « 2025-07 » → « Juillet 2025 » */
function fmtMois(k) {
  const [y, m] = String(k).split("-");
  const noms = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const n = noms[Math.max(0, Math.min(11, Number(m) - 1))] || "";
  return n.charAt(0).toUpperCase() + n.slice(1) + " " + y;
}

/* ---------- côté joueur : sa séance d'équipe du jour ---------- */
function EqJoueurCard({ data, go }) {
  const sai = eqOf(data.profile);
  const [ouvert, setOuvert] = useState(false);
  if (!sai) return null;
  const today = todayISO();
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
/* réglage dans la fiche client, côté coach : rattacher un joueur à une saison d'équipe */
function EqClientCard({ data, src }) {
  const toast = useToast();
  const p = data.profile || {};
  const [busy, setBusy] = useState(false);
  if (!EQ.length) return null;
  const set = async (v) => {
    setBusy(true);
    try { await src.setProfile({ ...p, equipe: v || null }); toast(v ? "Joueur rattaché à l'équipe." : "Rattachement retiré.", "ok"); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title="Séances d'équipe" sub="Si ce client joue dans un club dont tu as la programmation">
    <div className=${busy ? "form dim" : "form"}>
      <${Field} label="Son équipe" hint="Il verra sa séance d'équipe du jour dans l'application, avec son horaire et son déroulé.">
        <${Seg} id="eq-club" options=${[{ v: "", n: "Aucune" }, ...EQ.map((e) => ({ v: e.id, n: e.n }))]} value=${p.equipe || ""} onChange=${set} /></${Field}>
      <p className="muted small">La séance d'équipe n'entre pas automatiquement dans sa charge hebdomadaire : il ne la coche pas, donc la compter reviendrait à inventer un effort qu'on n'a pas mesuré. S'il l'enregistre en séance en plus, c'est celle-là qui compte.</p>
    </div></${Card}>`;
}
