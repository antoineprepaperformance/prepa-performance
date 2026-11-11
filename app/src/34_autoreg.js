/* ===== Autorégulation quotidienne : la charge s'ajuste seule, selon une règle écrite, pas selon l'humeur d'une IA =====
   Demande d'Antoine : « il faudrait qu'il y ait la possibilité de s'entraîner tous les jours et que la charge
   d'entraînement soit adaptée et ajustée en fonction par le coach IA directement. Comme ça, je n'ai même pas
   besoin de toucher au programme. » Donc : ça s'applique tout seul, sans validation de sa part.

   Ce qui est promis, et ce qui ne l'est pas. Le comparatif des applications concurrentes a montré que la
   littérature soutient l'autorégulation par le ressenti et les séances réellement terminées (effet groupé 0,64,
   IC 95 % 0,43-0,85, I² = 0 % — Zhang et al. 2021), mais qu'aucune étude ne montre l'autorégulation battre
   décisivement une périodisation fixe bien conçue — et les programmes d'Antoine *sont* une périodisation fixe
   bien conçue. La promesse honnête n'est donc pas « tu progresseras plus vite », c'est « tu peux t'entraîner
   tous les jours sans que ce soit plat ni imprudent, et sans que le coach touche au programme ». C'est une
   promesse de faisabilité et de sécurité, et elle est écrite comme telle dans les textes affichés au client.

   Trois choix de construction, tous volontaires :
   1. La décision est **déterministe**, écrite ici en code lisible — jamais déléguée à un modèle de langage.
      Le coach IA sert à l'expliquer au client et à répondre à ses questions, pas à décider. C'est la seule
      architecture auditable : Antoine peut relire la règle, et chaque ajustement dit pourquoi il a eu lieu.
   2. Chaque ajustement est **borné** par des limites qu'Antoine règle une fois (défaut : +10 % / −15 %,
      asymétrique à dessein — se tromper en allégeant coûte une séance, se tromper en chargeant coûte une
      blessure).
   3. Les signaux de montre (FC au repos, VFC, nuit courte) ne peuvent **que faire baisser**, jamais monter :
      aucune méta-analyse de pilotage par VFC n'existe en musculation, donc ce signal est traité comme inconnu
      et non comme fiable. Un frein, pas un accélérateur.

   Deux jeux de signaux selon le profil, parce que la base de preuves ne couvre pas tout le monde :
   - **Profil Performance / Haut niveau** : effort ressenti de la dernière séance du même type (RPE 0-10, déjà
     demandé en fin de séance), séance terminée ou non, douleur. Le RPE est fiable chez qui s'entraîne depuis
     longtemps.
   - **Profil Reprise / Sportif** : un débutant ne sait pas coter un RPE — lui demander « 7 ou 8 ? » produit du
     bruit, pas un signal (la base de preuves RPE est faite d'athlètes, 151 hommes pour 15 femmes). On s'appuie
     donc sur ce qui est observable sans expertise : répétitions réellement faites contre répétitions prescrites,
     séances terminées sur 7 jours, courbatures et sommeil.

   Rien de nouveau à saisir par le client : tous les signaux viennent de données déjà enregistrées (séances,
   effort de fin de séance, douleur, bilans, santé du jour). Désactivé par défaut, réglable par Antoine. */
const AUTOREG_DEF = { on: false, up: 10, down: 15 };
const AUTOREG_REFS = [
  "Zhang X, Li H, Bi S, Luo Y, Cao Y, Zhang G. Auto-regulation method vs. fixed-loading method in maximum strength training for athletes: a systematic review and meta-analysis. Front Physiol. 2021;12:651112. — effet groupé 0,64 (IC 95 % 0,43-0,85 ; P < 0,001 ; I² = 0 %) en faveur de l'autorégulation contre des charges fixes, sur 8 études et 166 participants (151 hommes, 15 femmes).",
  "Greig L, Stephens Hemingway BH, Aspe RR, Cooper K, Comfort P, Swinton PA. Autoregulation in resistance training: addressing the inconsistencies. Sports Med. 2020;50(11):1873-1887. — revue conceptuelle : vocabulaire et cadre de l'autorégulation, pas une méta-analyse. Utile pour nommer ce qu'on fait ici, sans en tirer de chiffre d'efficacité.",
  "Mann JB, Thyfault JP, Ivey PA, Sayers SP. The effect of autoregulatory progressive resistance exercise vs. linear periodization on strength improvement in college athletes. J Strength Cond Res. 2010;24(7):1718-1723. — APRE : la charge suivante est fixée par le nombre de répétitions atteint sur une série repère ; c'est la règle dont s'inspire l'ajustement ci-dessous.",
  "Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109-115. — charge de séance = effort ressenti × durée (déjà utilisée dans l'application).",
  "Zourdos MC, Klemp A, Dolan C, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res. 2016;30(1):267-275. — échelle RPE fondée sur les répétitions en réserve : fiable chez l'entraîné, bien moins chez le débutant.",
  "À l'inverse — Autoregulation does not provide additional benefits to a mixed session periodized resistance training program in trained men. 2024. — un essai contrôlé ne trouve aucun bénéfice supplémentaire : la littérature est orientée, pas unanime. C'est pourquoi rien ici ne promet de meilleurs résultats.",
];
/* bornes réglées par le coach ; asymétriques par défaut (voir l'en-tête) */
function autoregOf(plan) {
  const a = (plan && plan.autoreg) || {};
  const cl = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 25 ? Number(v) : d);
  return { on: a.on === true, up: cl(a.up, AUTOREG_DEF.up), down: cl(a.down, AUTOREG_DEF.down) };
}
function autoregOn(plan) { return autoregOf(plan).on; }

/* ---------- lecture des signaux déjà enregistrés ---------- */
/* dernière séance terminée du même type, hors celle qu'on est en train d'ouvrir */
function lastSameSession(data, sid, exceptKey) {
  return Object.entries(data.logs || {}).map(([k, l]) => ({ key: k, ...l }))
    .filter((l) => l && l.sid === sid && l.key !== exceptKey && l.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}
/* répétitions réellement faites contre répétitions prescrites, sur les exercices chargés de la séance :
   la dose prescrite à l'époque est recalculée depuis le programme (rien de nouveau n'est stocké) */
function repsKept(log, prog, lib) {
  if (!log || !log.items || !prog) return null;
  const b = blockOf(prog, Math.max(1, Number(log.w) || 1));
  const s = b && b.sessions.find((x) => x.id === log.sid);
  if (!s) return null;
  const wib = ((Math.max(1, Number(log.w) || 1) - 1) % 4) + 1;
  let pres = 0, fait = 0;
  s.items.forEach((it, i) => {
    const li = log.items[i];
    if (!li || !li.sets || li.e !== it.e) return;
    const d = doseOf(it, wib);
    const rr = rangeOf(d.reps);
    if (!rr || !d.sets) return;
    pres += d.sets * rr[0];
    li.sets.forEach((st) => { const r = num(st.reps); if (r !== null) fait += r; });
  });
  return pres > 0 ? { pres, fait, ratio: fait / pres } : null;
}
/* séances terminées sur les 7 derniers jours, contre prévues sur la même période */
function doneLast7(data, prog, plan, lib, today) {
  const from = addDays(today, -6);
  const done = Object.values(data.logs || {}).filter((l) => l && l.date && l.date >= from && l.date <= today && l.kind !== "presentiel" && !l.opt).length;
  const ps = typeof planState === "function" ? planState(plan, today) : null;
  const prevu = ps && ps.phase === "en_cours" && prog ? plannedCount(prog, plan, ps.week, lib) : null;
  return { done, prevu };
}
/* courbatures du dernier bilan (échelle 1 à 5, 5 = très fortes) */
function lastCourbatures(data) {
  const c = Object.values(data.checkins || {}).filter(Boolean).sort((a, b) => (Number(b.w) || 0) - (Number(a.w) || 0))[0];
  return c ? num(c.courbatures) : null;
}

/* ---------- la règle ---------- */
/* Renvoie toujours une décision explicable : { dir, pct, why[], voie, freins[] }.
   dir : -1 alléger, 0 inchangé, +1 charger. pct : ampleur en %, déjà bornée par les limites du coach.
   « why » est écrit pour être lu par le client et par Antoine, pas pour être parsé. */
function autoDecision(data, plan, prog, lib, entry, today) {
  const lim = autoregOf(plan);
  const out = { dir: 0, pct: 0, why: [], voie: null, freins: [], on: lim.on, lim };
  if (!lim.on || !prog || !entry || entry.extra || entry.opt) return out;
  const niv = effNiveau(plan, data.profile);
  const rang = nivRank(niv);
  const expert = rang >= 2;
  out.voie = expert ? "ressenti" : "debutant";
  const last = lastSameSession(data, entry.sid, entry.key);
  /* frein des signaux de montre : peut seulement faire baisser (voir l'en-tête) */
  const f = typeof santeFlag === "function" ? santeFlag(data, today) : null;
  const freinMontre = f && f.lvl !== "ok" ? f : null;
  if (freinMontre) out.freins.push((f.notes || []).join(", "));
  /* douleur de la dernière séance du même type */
  const douleur = last && num(last.douleur) !== null ? num(last.douleur) : null;
  if (douleur !== null && douleur >= 4) out.freins.push("douleur " + douleur + "/10 notée la dernière fois");

  let monte = false, baisse = false;
  if (!last) {
    out.why.push("Première séance de ce type : charge du programme, sans ajustement. L'ajustement commence dès que tu en auras fait une.");
    return out;
  }
  if (expert) {
    /* voie ressenti (RPE de fin de séance, déjà demandé) : la cible est « dur mais pas maximal ».
       Au-dessous de 6, il reste de la marge ; à partir de 9,5, la séance était au-delà de la cible. */
    const rpe = num(last.rpe);
    const fini = (last.items || []).every((it) => it.done !== false);
    if (rpe === null) out.why.push("Effort ressenti non noté la dernière fois : pas d'ajustement possible, charge du programme.");
    else if (rpe <= 6 && fini) { monte = true; out.why.push("Dernière séance de ce type notée " + fmtN(rpe, 0) + "/10 et terminée en entier : il te restait de la marge."); }
    else if (rpe >= 9.5 || !fini) { baisse = true; out.why.push(rpe >= 9.5 ? "Dernière séance de ce type notée " + fmtN(rpe, 0) + "/10 : au-delà de la cible, on redescend." : "Dernière séance de ce type non terminée en entier : on redescend pour la finir."); }
    else out.why.push("Dernière séance de ce type notée " + fmtN(rpe, 0) + "/10 : pile dans la cible, on garde la charge du programme.");
  } else {
    /* voie débutant : rien qui demande de savoir coter un effort */
    const rk = repsKept(last, prog, lib);
    const d7 = doneLast7(data, prog, plan, lib, today);
    const crb = lastCourbatures(data);
    const assidu = d7.prevu === null || d7.done >= d7.prevu;
    const fraisPret = crb === null || crb <= 3;
    if (!rk) out.why.push("Pas encore assez de répétitions notées sur ce type de séance : charge du programme.");
    else if (rk.ratio >= 1 && assidu && fraisPret) { monte = true; out.why.push("La dernière fois tu as fait toutes tes répétitions (" + rk.fait + " sur " + rk.pres + " prévues)" + (d7.prevu !== null ? ", et tes " + plural(d7.prevu, "séance") + " de la semaine" : "") + " : c'est le moment de charger un peu."); }
    else if (rk.ratio < 0.8) { baisse = true; out.why.push("La dernière fois tu as fait " + rk.fait + " répétitions sur " + rk.pres + " prévues : la charge était trop lourde, on redescend."); }
    else if (crb !== null && crb >= 4) { baisse = true; out.why.push("Courbatures fortes notées à ton dernier bilan : on allège le temps que ça passe."); }
    else if (d7.prevu !== null && d7.done < d7.prevu) out.why.push(plural(d7.done, "séance") + " sur " + d7.prevu + " cette semaine : on garde la charge du programme le temps de rattraper le rythme, sans charger davantage.");
    else out.why.push("Tes répétitions sont presque toutes faites : on garde la charge du programme encore une séance.");
  }
  /* le frein ne peut que faire baisser, ou empêcher de monter — jamais l'inverse */
  if (freinMontre && freinMontre.lvl === "leger") { baisse = true; monte = false; out.why.push("Tes mesures du matin sont nettement sous ta moyenne (" + out.freins[0] + ") : on allège aujourd'hui."); }
  else if (freinMontre && monte) { monte = false; out.why.push("Tes mesures du matin sont un peu sous ta moyenne (" + out.freins[0] + ") : on ne charge pas aujourd'hui, on garde la charge du programme."); }
  if (douleur !== null && douleur >= 4) { baisse = true; monte = false; }
  out.dir = baisse ? -1 : monte ? 1 : 0;
  out.pct = out.dir > 0 ? lim.up : out.dir < 0 ? lim.down : 0;
  return out;
}
/* texte court affiché en tête de séance */
function autoLigne(a) {
  if (!a || !a.on) return "";
  return a.dir > 0 ? "Charge montée de " + a.pct + " % aujourd'hui" : a.dir < 0 ? "Charge allégée de " + a.pct + " % aujourd'hui" : "Charge du programme, inchangée aujourd'hui";
}

/* ---------- jours en plus : s'entraîner tous les jours sans empiler les séances dures ----------
   Le réglage « rythme » reprend les séances en boucle (A, B, C, A, B, C…). Jusqu'ici la reprise portait la
   même dose que l'originale : s'entraîner 6 jours donnait deux fois des séances dures, ce qui n'est pas
   programmer, c'est répéter. Une reprise devient donc un jour complémentaire : charge réduite, une série de
   moins sur la force et la puissance, et c'est dit au client pour qu'il ne le prenne pas pour un bug. */
const AUTOREG_REP_DOWN = 20;
function repNote(rep) {
  if (!rep || rep < 2) return null;
  return { pct: AUTOREG_REP_DOWN, txt: "Jour complémentaire : cette séance revient une " + (rep === 2 ? "deuxième" : rep === 3 ? "troisième" : rep + "e") + " fois cette semaine parce que tu t'entraînes plus de jours que le programme n'a de séances. Elle est volontairement plus légère (−" + AUTOREG_REP_DOWN + " % de charge, une série de moins sur la force) : enchaîner deux fois la même séance dure dans la semaine fatigue sans faire progresser davantage." };
}

/* ---------- ce qui est affiché ---------- */
/* carte en tête de séance : ce qui a changé, et pourquoi, en clair */
function AutoregNote({ a, rep }) {
  const rn = repNote(rep);
  if ((!a || !a.on) && !rn) return null;
  const tone = a && a.dir < 0 ? "gold" : a && a.dir > 0 ? "okb" : "";
  return html`${a && a.on ? html`<div className=${"alert " + tone}><div><b>${autoLigne(a)}</b>
    ${a.why.map((w, i) => html`<p className="small" key=${i}>${w}</p>`)}
    ${a.dir !== 0 ? html`<p className="muted small">Ajustement automatique, dans les limites réglées par Antoine (+${a.lim.up} % / −${a.lim.down} % au maximum). Il ne remplace pas ton programme : il ajuste la charge du jour.</p>` : null}
  </div></div>` : null}
  ${rn ? html`<div className="alert"><div><b>Séance allégée (jour en plus)</b><p className="small">${rn.txt}</p></div></div>` : null}`;
}
/* réglage côté coach, par client */
function AutoregSettings({ data, src, plan }) {
  const toast = useToast();
  const a = autoregOf(plan);
  const [on, setOn] = useState(a.on);
  const [up, setUp] = useState(String(a.up));
  const [down, setDown] = useState(String(a.down));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await src.setPlan({ ...plan, autoreg: { on, up: clamp(num(up) ?? AUTOREG_DEF.up, 0, 25), down: clamp(num(down) ?? AUTOREG_DEF.down, 0, 25) } }); toast("Autorégulation enregistrée.", "ok"); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title="Autorégulation de la charge" sub="La charge du jour s'ajuste seule, selon une règle écrite, dans les limites que tu fixes">
    <div className=${busy ? "form dim" : "form"}>
      <label className="chk"><input type="checkbox" id="ar-on" checked=${on} onChange=${(e) => setOn(e.target.checked)} /><span>Ajuster automatiquement la charge de ce client</span></label>
      ${on ? html`<div className="row2">
        <${Field} label="Hausse maximale (%)" id="ar-up" hint="Quand la dernière séance du même type a laissé de la marge"><input id="ar-up" inputMode="numeric" value=${up} onChange=${(e) => setUp(e.target.value)} /></${Field}>
        <${Field} label="Baisse maximale (%)" id="ar-down" hint="Quand la séance était trop dure, mal terminée, ou que les signaux du matin sont bas"><input id="ar-down" inputMode="numeric" value=${down} onChange=${(e) => setDown(e.target.value)} /></${Field}>
      </div>` : null}
      <p className="muted small">Signaux utilisés selon le profil : effort ressenti de fin de séance et séance terminée ou non (Performance, Haut niveau) ; répétitions faites contre prescrites, séances de la semaine et courbatures (Reprise, Sportif), parce qu'un débutant ne sait pas coter un effort. Les signaux de montre (FC au repos, VFC, nuit courte) ne peuvent que faire baisser la charge, jamais la monter.</p>
      <p className="muted small">Ce que ça apporte : le client peut s'entraîner tous les jours sans que la charge soit plate ni imprudente, sans que tu touches au programme. Ce n'est pas une promesse de meilleurs résultats : aucune étude ne montre l'autorégulation battre décisivement une périodisation fixe bien conçue, et tes programmes en sont une.</p>
      <details><summary>Les sources</summary><ol className="refs">${AUTOREG_REFS.map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></details>
      <div className="btnrow"><${Btn} onClick=${save} disabled=${busy}>Enregistrer</${Btn}></div>
    </div></${Card}>`;
}
