/* ===== Recalibrage de la dépense : ce que disent les chiffres du client, pas une équation figée =====
   Dernier chantier du Bloc B du comparatif. Jusqu'ici la cible de calories était calculée une fois à
   l'inscription (Mifflin-St Jeor × facteur d'activité + séances) puis gelée, alors que c'est justement la
   valeur qui dérive le plus : la dépense baisse quand le poids baisse, et l'adaptation métabolique en
   déficit s'ajoute à cette baisse mécanique (Trexler 2014). Résultat classique : un client qui stagne alors
   que « les calculs sont bons ».

   LE PRINCIPE, qui est de la simple comptabilité d'énergie : sur une fenêtre assez longue,
       dépense mesurée = apports notés − (variation de poids × 7700 / jours).
   Si le poids descend, la dépense est supérieure aux apports ; s'il monte, elle est inférieure. On compare
   cette dépense mesurée à celle de l'équation et on corrige la cible pour viser la vitesse voulue.

   LE PIÈGE, et c'est lui qui décide de toute la conception : les apports déclarés sont systématiquement
   sous-estimés (Livingstone & Black 2003). Comme « apports notés ≤ apports réels », la dépense mesurée est
   un PLANCHER, pas une vérité. D'où une asymétrie volontaire :
   - dépense mesurée AU-DESSUS de l'équation :信 signal fort, car le biais de sous-déclaration pousse dans
     l'autre sens. On applique la correction en entier.
   - dépense mesurée EN DESSOUS de l'équation : explication la plus probable = des repas non notés, pas un
     métabolisme lent. On n'applique que la moitié de l'écart, et on le dit franchement au client.
   C'est l'inverse d'une « IA qui optimise ton métabolisme » : c'est une correction prudente, expliquée, avec
   son incertitude affichée.

   CE QUI EST REFUSÉ ICI :
   - aucun recalibrage en mode équilibre (mineur, grossesse ou allaitement, antécédent de trouble du
     comportement alimentaire) : dans ce mode l'application ne donne aucun chiffre, et proposer de recalculer
     des calories y serait exactement le contraire de ce qui est voulu ;
   - rien n'est appliqué en silence : le client voit l'écart, la raison, et décide d'un geste. Changer les
     calories de quelqu'un sans le lui dire n'est pas acceptable, même avec un bon calcul derrière ;
   - rien n'est proposé sans assez de données : il faut une fenêtre longue, assez de jours notés et assez de
     pesées, sinon on explique ce qui manque au lieu de sortir un chiffre inventé.
   La règle des 7700 kcal par kilo est elle-même une approximation (Hall & Chow 2013) : suffisante sur
   quelques semaines, et c'est dit dans les sources. */
const ADAPT_FENETRE = 21;          /* jours regardés en arrière */
const ADAPT_JOURS_MIN = 14;        /* écart minimal entre la première et la dernière pesée */
const ADAPT_PESEES_MIN = 4;
const ADAPT_NOTES_MIN = 10;        /* jours avec des repas crédibles */
const ADAPT_COUV_MIN = 0.6;        /* part des jours de la fenêtre effectivement notés */
const ADAPT_KCAL_MIN = 500;        /* en dessous : la journée n'est pas « légère », elle n'est pas notée */
const ADAPT_ECART_MIN = 0.07;      /* en dessous de 7 % d'écart : dans le bruit, on ne touche à rien */
const ADAPT_ECART_MAX = 0.25;      /* au-delà : on plafonne et on explique */
const ADAPT_REFS = [
  "Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247. — l'équation utilisée au départ, et qui est seulement une estimation de population.",
  "Livingstone MB, Black AE. Markers of the validity of reported energy intake. J Nutr. 2003;133 Suppl 3:895S-920S. — les apports alimentaires déclarés sont systématiquement sous-estimés : la dépense calculée depuis un journal est donc un plancher, pas une vérité.",
  "Trexler ET, Smith-Ryan AE, Norton LE. Metabolic adaptation to weight loss: implications for the athlete. J Int Soc Sports Nutr. 2014;11:7. — la dépense baisse davantage que le seul effet du poids perdu : une cible figée à l'inscription dérive forcément.",
  "Hall KD, Chow CC. Why is the 3500 kcal per pound weight loss rule wrong? Int J Obes. 2013;37(12):1614. — la règle des 7700 kcal par kilo est une approximation ; acceptable sur quelques semaines, pas exacte.",
];
/* pente du poids en kg par jour, par régression linéaire sur tous les points de la fenêtre : moins sensible
   qu'un simple « premier contre dernier » aux variations d'eau et de glycogène d'un jour donné */
function penteKgJour(pts) {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num2 = 0, den = 0;
  pts.forEach((p) => { num2 += (p.x - mx) * (p.y - my); den += (p.x - mx) * (p.x - mx); });
  return den ? num2 / den : null;
}
/* pesées de la fenêtre : santé du jour (montre ou saisie) et bilans hebdomadaires, dédoublonnées par date */
function poidsFenetre(data, today, jours) {
  const from = addDays(today, -(jours - 1));
  const m = {};
  Object.entries((data && data.sante) || {}).forEach(([d, v]) => { const p = num(v && v.poids); if (p && d >= from && d <= today) m[d] = p; });
  Object.values((data && data.checkins) || {}).forEach((c) => { const p = num(c && c.poids); const d = c && c.at ? String(c.at).slice(0, 10) : null; if (p && d && d >= from && d <= today && !m[d]) m[d] = p; });
  return Object.keys(m).sort().map((d) => ({ d, x: diffDays(from, d), y: m[d] }));
}
/* apports notés de la fenêtre : on ne compte que les journées crédibles (voir ADAPT_KCAL_MIN) */
function apportsFenetre(data, today, jours) {
  const from = addDays(today, -(jours - 1));
  const j = [];
  Object.entries((data && data.food) || {}).forEach(([d, v]) => {
    if (d < from || d > today) return;
    const k = dayTotals(v).kcal;
    if (k >= ADAPT_KCAL_MIN) j.push({ d, kcal: k });
  });
  return j.sort((a, b) => a.d.localeCompare(b.d));
}
/* Tout le calcul, avec la raison du refus quand il n'y a pas de quoi conclure.
   Renvoie null si la fonction ne s'applique pas du tout (pas de plan chiffré). */
function nutriAdapt(data, plan, today) {
  const np = data && data.nutri && data.nutri.plan;
  /* mode équilibre : aucun chiffre n'est donné dans ce mode, on ne recalibre rien (voir l'en-tête) */
  if (!np || np.mode === "equilibre" || !np.targets || !np.tdee) return null;
  const d = today || todayISO();
  const pts = poidsFenetre(data, d, ADAPT_FENETRE);
  const jours = apportsFenetre(data, d, ADAPT_FENETRE);
  const span = pts.length >= 2 ? diffDays(pts[0].d, pts[pts.length - 1].d) : 0;
  const couv = jours.length / ADAPT_FENETRE;
  const manque = [];
  if (pts.length < ADAPT_PESEES_MIN) manque.push("au moins " + ADAPT_PESEES_MIN + " pesées sur les 3 dernières semaines (tu en as " + pts.length + ")");
  else if (span < ADAPT_JOURS_MIN) manque.push("des pesées espacées d'au moins " + ADAPT_JOURS_MIN + " jours (les tiennes couvrent " + plural(span, "jour") + ")");
  if (jours.length < ADAPT_NOTES_MIN) manque.push("au moins " + ADAPT_NOTES_MIN + " journées de repas notées (tu en as " + jours.length + ")");
  else if (couv < ADAPT_COUV_MIN) manque.push("des repas notés plus régulièrement : " + jours.length + " jours sur " + ADAPT_FENETRE + ", ce qui ne suffit pas pour une moyenne fiable");
  if (manque.length) return { pret: false, manque, pesees: pts.length, joursNotes: jours.length, span };
  const apport = jours.reduce((s, x) => s + x.kcal, 0) / jours.length;
  const pente = penteKgJour(pts);
  if (pente === null) return { pret: false, manque: ["des pesées à des dates différentes"], pesees: pts.length, joursNotes: jours.length, span };
  const mesuree = apport - pente * 7700;
  /* référence = la dépense actuellement utilisée pour ses cibles. Au premier recalibrage c'est celle de
     l'équation ; ensuite c'est la dernière mesure retenue, et le recalibrage devient itératif. On garde la
     valeur d'origine de l'équation à part (tdeeEq), pour pouvoir dire d'où on est parti. */
  const equation = np.tdee;
  const dejaMesure = np.tdeeSrc === "mesure";
  const brut = mesuree / equation - 1;
  /* asymétrie volontaire : au-dessus de l'équation le signal est fort (le biais de sous-déclaration pousse
     dans l'autre sens) ; en dessous, la cause la plus probable est que des repas manquent au journal */
  const plafonne = Math.abs(brut) > ADAPT_ECART_MAX;
  const borne = clamp(brut, -ADAPT_ECART_MAX, ADAPT_ECART_MAX);
  const retenu = borne > 0 ? borne : borne / 2;
  const retenue = Math.round(equation * (1 + retenu));
  const assez = Math.abs(brut) >= ADAPT_ECART_MIN;
  return { pret: true, apport: Math.round(apport), pente, penteSem: Math.round(pente * 7 * 100) / 100,
    mesuree: Math.round(mesuree), equation: Math.round(equation), ecart: brut, ecartPct: Math.round(brut * 1000) / 10,
    retenue, sens: borne > 0 ? "haut" : borne < 0 ? "bas" : "egal", plafonne, assez, dejaMesure,
    tdeeEq: np.tdeeEq || (dejaMesure ? null : Math.round(equation)),
    pesees: pts.length, joursNotes: jours.length, span, confiance: borne > 0 ? "forte" : "prudente" };
}
/* nouvelle cible de calories, en gardant l'objectif et la vitesse déjà choisis par le client :
   on refait tourner le même calcul, avec la dépense mesurée à la place de celle de l'équation */
function nutriAdaptCible(data, plan, a) {
  const np = data && data.nutri && data.nutri.plan;
  if (!np || !a || !a.pret || !a.assez) return null;
  const f = { ...(np.form || {}), weight: np.weight0, goal: np.goal, delta: np.delta, weeks: np.weeks, recomp: np.recomp };
  const base = nutriCalc(f, null);
  if (base.error) return null;
  /* On garde le DÉFICIT (ou le surplus) en valeur absolue, et on le reporte sur la dépense corrigée :
     nouvelle cible = dépense retenue − (dépense de référence − cible actuelle).
     C'est ce qui conserve réellement la vitesse choisie en kg par semaine, puisque c'est l'écart absolu
     entre dépense et apports qui la détermine. Mettre à l'échelle la cible proportionnellement (× 1,21 par
     exemple) aurait aussi agrandi le déficit de 21 %, donc accéléré la perte sans que le client l'ait
     demandé — alors que le texte affiché lui promet l'inverse.
     Puis plancher de sécurité et pas maximal, pour qu'un recalibrage ne fasse jamais un grand saut. */
  const cur = np.targets.kcal || base.targets.kcal;
  const ecartCible = a.equation - cur;           /* déficit si > 0, surplus si < 0 ; 0 en maintien */
  const brute = Math.round((a.retenue - ecartCible) / 10) * 10;
  const kcal = clamp(brute, Math.max(base.floor, Math.round(cur * 0.8 / 10) * 10), Math.round(cur * 1.2 / 10) * 10);
  const refW = np.refW || np.weight0 || 70;
  const p = Math.round(refW * (np.recomp && np.goal === "perte" ? 2 : np.goal === "maintien" ? 1.6 : 1.8));
  const fat = Math.round(Math.max(0.8 * refW, (kcal * 0.28) / 9));
  const c = Math.max(0, Math.round((kcal - p * 4 - fat * 9) / 4));
  return { ...np.targets, kcal, p, c, f: fat };
}
/* phrases affichées : une par idée, pour que le client comprenne d'où sort le chiffre */
function adaptTexte(a) {
  if (!a) return null;
  if (!a.pret) return { titre: "Pas encore de quoi recalculer ta dépense", lignes: ["Pour comparer ta dépense réelle à l'estimation de départ, il manque " + a.manque.join(", et ") + "."], ton: "" };
  const sens = a.sens === "haut" ? "plus haute" : "plus basse";
  const l = ["Sur les 3 dernières semaines : " + fmtN(a.apport, 0) + " kcal par jour en moyenne sur " + plural(a.joursNotes, "journée notée", "journées notées") + ", et "
    + (Math.abs(a.penteSem) < 0.05 ? "un poids stable" : (a.penteSem < 0 ? "−" : "+") + fmtN(Math.abs(a.penteSem), 2) + " kg par semaine") + " sur " + plural(a.pesees, "pesée") + "."];
  l.push("Ce que ça donne : une dépense d'environ " + fmtN(a.mesuree, 0) + " kcal par jour, contre " + fmtN(a.equation, 0) + (a.dejaMesure ? " actuellement utilisées pour tes repères" : " estimées au départ") + ", soit " + fmtN(Math.abs(a.ecartPct), 1) + " % " + sens + ".");
  if (!a.assez) return { titre: "Ta dépense correspond à tes repères actuels", lignes: l.concat(["L'écart est trop petit pour être autre chose que du bruit : on ne change rien."]), ton: "okb" };
  if (a.sens === "haut") l.push("Ce sens-là est fiable : comme on note toujours un peu moins que ce qu'on mange réellement, une dépense mesurée plus haute que prévu est un signal solide. On applique l'écart en entier.");
  else l.push("Prudence sur ce sens-là : l'explication la plus fréquente d'une dépense mesurée plus basse n'est pas un métabolisme lent, c'est que des aliments ne sont pas notés (huile de cuisson, boissons, grignotages). On n'applique donc que la moitié de l'écart.");
  if (a.plafonne) l.push("L'écart brut dépassait " + Math.round(ADAPT_ECART_MAX * 100) + " % : il a été ramené à cette limite, parce qu'un écart aussi grand vient presque toujours du journal, pas du métabolisme.");
  return { titre: "Ta dépense réelle est " + sens + " que tes repères actuels", lignes: l, ton: a.sens === "haut" ? "okb" : "gold" };
}
/* carte client : l'écart, la raison, et un geste pour mettre à jour ses repères */
function NutriAdaptCard({ data, src, plan, coachView }) {
  const toast = useToast();
  const a = nutriAdapt(data, plan, todayISO());
  const [busy, setBusy] = useState(false);
  if (!a) return null;
  const t = adaptTexte(a);
  const cible = nutriAdaptCible(data, plan, a);
  const np = data.nutri.plan;
  const appliquer = async () => {
    if (!cible) return;
    setBusy(true);
    try {
      await src.saveNutri({ ...np, targets: cible, tdee: a.retenue, tdeeSrc: "mesure", tdeeAt: todayISO(), tdeeEq: a.tdeeEq || np.tdeeEq || a.equation, updatedAt: nowISO() });
      toast("Tes repères sont à jour.", "ok");
    } catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title=${coachView ? "Dépense réelle du client" : "Ta dépense réelle"} sub="Calculée depuis tes repas notés et l'évolution de ton poids, pas depuis une formule">
    <div className=${"alert " + t.ton}><div><b>${t.titre}</b>${t.lignes.map((x, i) => html`<p className="small" key=${i}>${x}</p>`)}</div></div>
    ${a.pret && a.assez && cible ? html`<div className="kvs">
      <div className="kv"><span>Cible actuelle</span><b>${fmtN(np.targets.kcal, 0)} kcal</b></div>
      <div className="kv"><span>Cible recalculée</span><b className=${cible.kcal > np.targets.kcal ? "ok-t" : "warn-t"}>${fmtN(cible.kcal, 0)} kcal</b></div>
      <div className="kv"><span>Protéines</span><b>${fmtN(cible.p, 0)} g</b></div>
      <div className="kv"><span>Glucides</span><b>${fmtN(cible.c, 0)} g</b></div>
    </div>` : null}
    ${a.pret && a.assez && cible && !coachView ? html`<div className="btnrow"><${Btn} onClick=${appliquer} disabled=${busy}>Mettre à jour mes repères</${Btn}></div>
      <p className="muted small">Rien n'est changé avant que tu cliques : ce sont tes calories, c'est à toi de décider. Ton objectif et ta vitesse ne changent pas, seule la dépense de référence est corrigée.</p>` : null}
    ${np.tdeeSrc === "mesure" && np.tdeeAt ? html`<p className="muted small">Dernier recalibrage le ${fmtD(np.tdeeAt)} : dépense de référence ${fmtN(np.tdee, 0)} kcal (estimation de départ : ${fmtN(np.tdeeEq || 0, 0)} kcal).</p>` : null}
    <details><summary>Comment c'est calculé, et ses limites</summary>
      <p className="small">Dépense = apports notés − (variation de poids × 7700 / nombre de jours). C'est de la comptabilité d'énergie, pas une estimation de ton métabolisme : la qualité du résultat dépend entièrement de la régularité avec laquelle tu notes tes repas.</p>
      <ol className="refs">${ADAPT_REFS.map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></details>
  </${Card}>`;
}
