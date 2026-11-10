/* ===== Les premiers jours : démarrer, et ne pas se faire comparer à un record du monde le jour 1 =====
   Deux manques identifiés par le comparatif des applications concurrentes, les deux chez le débutant, les
   deux petits à construire. Ce sont les seuls chantiers du comparatif dont l'effet porte sur le fait qu'un
   client reste ou parte, plutôt que sur la qualité de sa programmation.

   1. L'ACTIVATION DE LA PREMIÈRE SEMAINE. Le seul enseignement comportemental chiffré trouvé dans tout le
      secteur vient de Freeletics : les utilisateurs qui terminent **deux séances dans leur première semaine**
      restent nettement plus longtemps. À prendre pour ce que c'est — une étude de cas d'éditeur, pas un essai
      contrôlé, et c'est écrit tel quel dans les sources ci-dessous. En face, la première cause d'annulation
      déclarée dans un rapport 2026 est la perte de motivation (38 %), pas le prix ni le logiciel. L'alerte
      d'inactivité existante ne se déclenchait qu'à 7 jours : un client qui n'a rien touché depuis une semaine
      a souvent déjà arrêté dans sa tête. On raccourcit la mèche pour celui qui n'a JAMAIS rien fait.

      Ce qui est volontairement refusé ici : les séries de jours (« streaks »), les badges et les points. Le
      comparatif a trouvé ces mécaniques partout et leur appui chiffré nulle part, et le seul testeur ayant
      passé 21 jours dans une application à communauté la décrit comme « sous-utilisée ». On affiche donc un
      compteur honnête — deux séances, voilà où tu en es — et rien d'autre.

   2. LA CARTE ATHLÈTE POUR QUI DÉBUTE. La carte note chaque test face au record du monde : c'est un vrai
      différenciateur pour l'athlète d'Antoine, et c'est démoralisant pour un débutant qui lit « 15 % du
      record » à son premier test. Rien n'est caché (l'application ne ment pas sur les chiffres) : pour les
      profils Reprise et Sportif, on met en avant **ses progrès sur ses propres tests**, et la comparaison aux
      records passe dans un volet replié. Pour Performance et Haut niveau, rien ne change : à ce niveau, le
      pourcentage du record est une information utile. */
const DEMARRAGE_JOURS = 7;
const DEMARRAGE_CIBLE = 2;
/* nombre de jours sans aucune séance au tout début avant de prévenir Antoine ; bien plus court que
   l'alerte d'inactivité habituelle (7 jours), qui garde son rôle pour les clients déjà lancés */
const DEMARRAGE_RELANCE = 3;
const DEMARRAGE_REFS = [
  "Freeletics, étude de cas publiée par l'éditeur (via The Audiencers) : les utilisateurs qui terminent deux séances pendant leur première semaine restent nettement plus longtemps. Étude de cas commerciale, pas un essai contrôlé : c'est le seul repère comportemental chiffré trouvé dans le secteur, et il est cité comme tel.",
  "Fitness Refined, rapport 2026 sur les raisons d'abandon des applications de sport (communiqué via Barchart) : la perte de motivation ou l'abandon de l'objectif représente 38 % des résiliations déclarées, loin devant le prix. Seul le communiqué a pu être lu, pas la méthodologie.",
];
/* Première semaine d'un client qui n'a jamais rien fait dans l'application : on ne compte pas les clients
   qui enchaînent un deuxième programme (ils n'ont pas besoin qu'on leur souhaite la bienvenue). */
function demarrageState(data, plan, prog, lib, today) {
  const ps = planState(plan, today || todayISO());
  if (!ps || ps.phase !== "en_cours" || !plan.start) return null;
  const logs = Object.values(data.logs || {}).filter((l) => l && l.date);
  /* déjà des séances avant ce programme : ce n'est pas un début, c'est une suite */
  if (logs.some((l) => l.date < plan.start)) return null;
  const jour = diffDays(plan.start, today || todayISO()) + 1;
  if (jour < 1 || jour > DEMARRAGE_JOURS) return null;
  const faites = logs.filter((l) => l.date >= plan.start && l.kind !== "presentiel" && !l.opt).length;
  const prevu = prog ? plannedCount(prog, plan, 1, lib) : 0;
  /* la cible ne peut pas dépasser ce que la semaine propose réellement (suivi nutrition seule : rien à viser) */
  const cible = Math.min(DEMARRAGE_CIBLE, prevu);
  if (!cible) return null;
  return { jour, faites, cible, reste: Math.max(0, cible - faites), fini: faites >= cible,
    joursRestants: Math.max(0, DEMARRAGE_JOURS - jour + 1) };
}
/* carte affichée au client pendant ses 7 premiers jours */
function DemarrageCard({ d, next, openSession }) {
  if (!d) return null;
  if (d.fini) return html`<div className="alert okb"><div><b>Tes ${plural(d.cible, "première séance", "deux premières séances")} ${d.cible > 1 ? "sont faites" : "est faite"}</b>
    <p className="small">C'est le passage qui compte le plus : les gens qui font leurs deux premières séances dans la première semaine sont ceux qui tiennent sur la durée. La suite est plus facile.</p></div></div>`;
  return html`<div className="alert"><div><b>Tes débuts : ${d.faites} séance${d.faites > 1 ? "s" : ""} sur ${d.cible}</b>
    <p className="small">${d.faites === 0
      ? "L'objectif de cette première semaine est simple : " + plural(d.cible, "séance") + ". Pas plus. C'est le seul cap qui compte pour l'instant, le reste suivra tout seul."
      : "Encore " + plural(d.reste, "séance") + " cette semaine et ton démarrage est réussi."}</p>
    <p className="muted small">${d.joursRestants > 1 ? "Il te reste " + plural(d.joursRestants, "jour") + "." : "Dernier jour de ta première semaine."}</p></div>
    ${next && openSession ? html`<${Btn} small onClick=${() => openSession(next)}>Commencer</${Btn}>` : null}</div>`;
}
/* alerte côté coach : un client qui n'a jamais rien fait, prévenu bien plus tôt que l'inactivité habituelle */
function demarrageAlerte(plan, nLogs, today) {
  if (!plan || plan.status !== "active" || !plan.start) return null;
  if (nLogs > 0) return null;
  const j = diffDays(plan.start, today || todayISO()) + 1;
  if (j < DEMARRAGE_RELANCE || j > DEMARRAGE_JOURS + 7) return null;
  return { tone: j > DEMARRAGE_JOURS ? "bad" : "warn", n: "Jamais démarré (" + plural(j, "jour") + ") : relancer", k: "seances" };
}

/* ---------- carte athlète : mettre en avant ses propres progrès quand on débute ---------- */
/* delta entre le premier et le dernier résultat d'un test, dans le sens « mieux » du test */
function persoProgres(data, tid, prog) {
  const s = Object.values((data && data.tests) || {}).filter((t) => t && t.values && testValue(tid, t.values[tid]) !== null)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  if (s.length < 2) return null;
  const a = testValue(tid, s[0].values[tid]), b = testValue(tid, s[s.length - 1].values[tid]);
  if (a === null || b === null || !a) return null;
  const low = testBetter(prog, tid) === "low";
  const d = b - a;
  return { from: a, to: b, d, pct: Math.round((low ? -d : d) / Math.abs(a) * 1000) / 10, mieux: low ? d < 0 : d > 0 };
}
/* vrai pour les profils Reprise et Sportif : le pourcentage d'un record du monde ne leur apprend rien d'utile */
function cardDebutant(plan, profile) { return nivRank(effNiveau(plan, profile)) <= 1; }
