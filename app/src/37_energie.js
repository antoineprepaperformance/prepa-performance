/* ===== Garde-fou énergie basse : signaler un schéma, jamais poser un diagnostic =====
   Dernier différenciateur du Bloc C du comparatif, et le seul qui ait un motif clinique sérieux : le
   déficit énergétique relatif dans le sport (RED-S, renommé REDs par le consensus 2023 du CIO). Manger
   durablement trop peu pour la charge d'entraînement produit des conséquences réelles — perte de densité
   osseuse, troubles du cycle, baisse de performance, blessures à répétition, troubles de l'humeur — et
   aucune application grand public comparée n'en avertit. L'application d'Antoine a déjà tous les signaux
   nécessaires : apports notés, charge d'entraînement en sRPE, poids, FC au repos et VFC, sommeil, et le
   cycle pour les clientes qui l'ont activé.

   CE QUE CE FICHIER NE FAIT PAS, ET POURQUOI C'EST LE POINT LE PLUS IMPORTANT :
   - Il ne calcule PAS la disponibilité énergétique. La vraie mesure est en kcal par kg de masse maigre et
     par jour (seuil de référence autour de 30 kcal/kg MM/j, Loucks & Thuma 2003), or l'application ne
     mesure pas la masse maigre — et on a explicitement refusé de l'estimer à partir de l'IMC dans
     33_objectifs.js. Sortir un chiffre de disponibilité énergétique en le dérivant d'une estimation de
     masse grasse serait inventer une précision qui n'existe pas, sur un sujet médical. On s'en tient donc
     aux données réellement mesurées : l'écart entre ce qui est noté et ce que le plan demande, la charge,
     et les signaux corroborants.
   - Il ne pose AUCUN diagnostic et n'affiche aucun score de risque. Les outils d'évaluation du CIO sont
     destinés à des cliniciens. Ici on nomme un schéma observé, on dit ce qu'il peut entraîner, et on
     renvoie vers Antoine et, pour les signaux les plus spécifiques, vers un médecin.
   - Il ne se déclenche pas sur un déficit normal et assorti : une sèche de 3 semaines bien menée n'est pas
     un signal. Il faut le cœur du schéma (apports durablement très bas ET charge d'entraînement réelle) ET
     au moins un signal corroborant. C'est volontairement conservateur : une alerte qui crie pour rien est
     une alerte qu'on apprend à ignorer, et c'est pire que pas d'alerte.

   SIGNAL LE PLUS SPÉCIFIQUE, ET SA CONFIDENTIALITÉ : la disparition des règles est le marqueur clinique le
   plus parlant du lot. Il n'est utilisé que si la cliente a activé le suivi du cycle, et il n'est montré au
   coach que si elle a aussi activé le partage — exactement les deux réglages séparés posés le 6 novembre.
   Sans partage, Antoine voit le signalement sans en voir la raison intime.

   Sources : consensus 2023 du CIO sur les REDs (Mountjoy et al., Br J Sports Med 2023;57(17):1073-1097) et
   sa version 2018 (RED-S, 2018;52(11):687-697) ; seuil de disponibilité énergétique de Loucks & Thuma
   (J Clin Endocrinol Metab 2003;88(1):297-311) ; position de l'ACSM sur la triade de l'athlète féminine
   (Nattiv et al., Med Sci Sports Exerc 2007;39(10):1867-1882). */
const ENER_FENETRE = 21;          /* jours regardés en arrière, comme le recalibrage */
const ENER_NOTES_MIN = 12;        /* journées de repas notées : il en faut plus que pour le recalibrage */
const ENER_MANQUE_PCT = 0.25;     /* apports sous la référence de plus de 25 % = cœur du schéma */
const ENER_CHARGE_MIN = 900;      /* UA par semaine : en dessous, l'entraînement n'est pas le problème */
const ENER_PERTE_SEM = 0.01;      /* perte de plus de 1 % du poids par semaine = trop rapide, durablement */
const ENER_REFS = [
  "Mountjoy M, Ackerman KE, Bailey DM, et al. 2023 International Olympic Committee's (IOC) consensus statement on Relative Energy Deficiency in Sport (REDs). Br J Sports Med. 2023;57(17):1073-1097. — conséquences d'un apport durablement insuffisant pour la charge : santé osseuse, fonction endocrinienne, performance, risque de blessure.",
  "Mountjoy M, Sundgot-Borgen JK, Burke LM, et al. IOC consensus statement on relative energy deficiency in sport (RED-S): 2018 update. Br J Sports Med. 2018;52(11):687-697.",
  "Loucks AB, Thuma JR. Luteinizing hormone pulsatility is disrupted at a threshold of energy availability in regularly menstruating women. J Clin Endocrinol Metab. 2003;88(1):297-311. — seuil de référence autour de 30 kcal par kg de masse maigre et par jour ; cette mesure demande la masse maigre, que l'application ne mesure pas : elle n'est donc pas calculée ici.",
  "Nattiv A, Loucks AB, Manore MM, et al. American College of Sports Medicine position stand. The female athlete triad. Med Sci Sports Exerc. 2007;39(10):1867-1882.",
];
/* charge moyenne par semaine sur la fenêtre, depuis les séances déjà enregistrées (effort × durée, Foster) */
function chargeFenetre(data, today, jours) {
  const from = addDays(today, -(jours - 1));
  let ua = 0;
  Object.values(data.logs || {}).forEach((l) => { if (l && l.date >= from && l.date <= today) ua += num(l.load) || 0; });
  Object.values(data.libres || {}).forEach((l) => { if (l && l.d >= from && l.d <= today) ua += num(l.load) || 0; });
  return Math.round(ua / (jours / 7));
}
/* Le schéma, ou rien. Renvoie null si la question ne se pose pas (pas de plan chiffré, mode équilibre,
   pas assez de journées notées) : l'absence de signalement ne veut jamais dire « tout va bien », et c'est
   écrit dans la carte. */
function energieBasse(data, plan, today) {
  const np = data && data.nutri && data.nutri.plan;
  if (!np || np.mode === "equilibre" || !np.targets || !np.tdee) return null;
  const d = today || todayISO();
  const jours = apportsFenetre(data, d, ENER_FENETRE);
  if (jours.length < ENER_NOTES_MIN) return null;
  const apport = jours.reduce((s, x) => s + x.kcal, 0) / jours.length;
  const ref = np.tdee;
  const manque = 1 - apport / ref;
  const charge = chargeFenetre(data, d, ENER_FENETRE);
  /* cœur du schéma : apports très en dessous de la référence ET entraînement réel en face */
  const coeur = manque >= ENER_MANQUE_PCT && charge >= ENER_CHARGE_MIN;
  const sousPlancher = apport < (num(np.floor) || 0);
  /* signaux corroborants : aucun ne déclenche seul, chacun rend le schéma plus net */
  const signaux = [];
  const pts = poidsFenetre(data, d, ENER_FENETRE);
  const pente = pts.length >= 3 ? penteKgJour(pts) : null;
  const w = pts.length ? pts[pts.length - 1].y : num(np.weight0);
  if (pente !== null && w && -pente * 7 / w >= ENER_PERTE_SEM) signaux.push("ton poids descend de plus de 1 % par semaine, c'est plus rapide que ce que ton plan prévoit");
  const f = typeof santeFlag === "function" ? santeFlag(data, d) : null;
  if (f && f.lvl !== "ok" && (f.notes || []).length) signaux.push("tes mesures du matin sont sous ta moyenne (" + f.notes.join(", ") + ")");
  const ck = Object.values(data.checkins || {}).filter(Boolean).sort((a, b) => (Number(b.w) || 0) - (Number(a.w) || 0))[0];
  if (ck && num(ck.energie) !== null && num(ck.energie) <= 2) signaux.push("tu as noté une énergie basse à ton dernier bilan");
  /* signal le plus spécifique, et le plus intime : règles en retard marqué ou absentes. Seulement si la
     cliente a activé le suivi du cycle elle-même (32_cycle.js). */
  let cycle = false;
  if (typeof cycleOn === "function" && cycleOn(data.profile) && typeof cycleState === "function") {
    const cs = cycleState(data, d);
    if (cs && cs.late) { cycle = true; signaux.push("tes règles ont beaucoup de retard, ou sont absentes"); }
  }
  const alerte = (coeur || sousPlancher) && signaux.length > 0;
  return { alerte, coeur, sousPlancher, apport: Math.round(apport), ref: Math.round(ref), manquePct: Math.round(manque * 1000) / 10,
    charge, joursNotes: jours.length, signaux, cycle, plancher: num(np.floor) || null,
    /* ce qui justifie de parler d'un médecin, et pas seulement d'Antoine */
    medecin: cycle || signaux.length >= 2 };
}
/* carte client : calme, factuelle, et qui dit quoi faire */
function EnergieCard({ data, plan, coachView, partage }) {
  const e = energieBasse(data, plan, todayISO());
  if (!e || !e.alerte) return null;
  /* côté coach, le motif intime n'est montré que si la cliente a activé le partage (32_cycle.js) */
  const sig = coachView && e.cycle && !partage ? e.signaux.filter((s) => !s.includes("règles")) : e.signaux;
  return html`<div className="alert warn"><div>
    <b>${coachView ? "Apports bas pour la charge : à aborder avec le client" : "Tu manges peu pour ce que tu t'entraînes"}</b>
    <p className="small">${coachView ? "Sur les 3 dernières semaines" : "Sur tes 3 dernières semaines"} : ${fmtN(e.apport, 0)} kcal par jour en moyenne sur ${plural(e.joursNotes, "journée notée", "journées notées")}, soit ${fmtN(e.manquePct, 0)} % sous ${coachView ? "sa" : "ta"} dépense de référence (${fmtN(e.ref, 0)} kcal), avec ${fmtN(e.charge, 0)} UA d'entraînement par semaine${e.sousPlancher ? ", et sous le plancher de sécurité de " + fmtN(e.plancher, 0) + " kcal" : ""}.</p>
    ${sig.length ? html`<p className="small">${coachView ? "Et en même temps :" : "Et en même temps :"}</p><ul className="small rec-list">${sig.map((s, i) => html`<li key=${i}>${s}</li>`)}</ul>` : null}
    <p className="small">${coachView
      ? "Ce n'est pas un diagnostic : c'est un schéma d'apports durablement insuffisants pour la charge, celui que le consensus du CIO sur les REDs associe à une baisse de performance, à des troubles du cycle, à une santé osseuse dégradée et à des blessures à répétition. La priorité est de remonter les apports avant de toucher au programme."
      : "Ce n'est pas un diagnostic, et ce n'est pas une accusation : c'est un schéma que les préparateurs connaissent bien. Manger durablement trop peu pour sa charge d'entraînement fait baisser les performances au lieu de les améliorer, fatigue les os, dérègle les hormones et augmente les blessures. La bonne nouvelle, c'est que ça se corrige en remontant les apports, pas en s'entraînant plus."}</p>
    <p className="small"><b>${coachView ? "À faire :" : "Ce qu'il faut faire :"}</b> ${coachView
      ? "remonter les apports vers la dépense de référence, alléger la charge le temps que ça remonte, et orienter vers un médecin ou un diététicien si les signaux persistent."
      : "remonte tes apports vers ta dépense de référence et parles-en à Antoine avant de continuer sur ce rythme. Il ajustera la charge."}</p>
    ${e.medecin ? html`<p className="small"><b>${coachView ? "Avis médical à conseiller" : "Et vois un médecin"}</b> : ${coachView
      /* ne jamais énumérer d'exemple de signal ici : la cliente peut avoir signalé son cycle sans avoir
         autorisé Antoine à le voir, et un exemple en dur le lui apprendrait quand même (32_cycle.js) */
      ? "les signaux réunis ci-dessus justifient un avis médical, pas seulement un ajustement de plan."
      : "des règles absentes, une fatigue qui ne passe pas ou des blessures qui reviennent méritent un avis médical. Ce n'est pas grave en soi, mais ça ne se règle pas uniquement avec l'application."}</p>` : null}
    <details><summary>Les sources</summary><ol className="refs">${ENER_REFS.map((r, i) => html`<li key=${i}>${r}</li>`)}</ol>
      <p className="muted small">L'application ne calcule pas de disponibilité énergétique : la vraie mesure demande la masse maigre, qu'elle ne mesure pas. Elle compare seulement ${coachView ? "ses" : "tes"} apports notés à ${coachView ? "sa" : "ta"} dépense de référence, ${coachView ? "sa" : "ta"} charge et ${coachView ? "ses" : "tes"} autres signaux. Un signalement absent ne veut donc pas dire que tout va bien.</p></details>
  </div></div>`;
}
/* alerte du tableau de bord : calculée sur le résumé publié, sans détail intime */
function energieAlerte(data, plan, today) {
  const e = energieBasse(data, plan, today);
  if (!e || !e.alerte) return null;
  return { tone: "bad", n: "Apports bas pour la charge (" + fmtN(e.manquePct, 0) + " % sous la référence)", k: "nutrition" };
}
