/* ===== Deux axes d'objectifs indépendants : l'entraînement et la composition corporelle =====
   Jusqu'ici un seul choix (le programme) servait d'objectif, en mélangeant deux choses différentes :
   un style d'entraînement (force, vitesse, sports collectifs, course…) et une direction de composition
   corporelle (perdre du gras, garder son poids, prendre du muscle). On les sépare : le programme reste
   l'axe entraînement, profil.corps devient l'axe composition corporelle, choisi à part.
   Aucun client existant n'a besoin d'être migré : sans profil.corps, l'axe est déduit du programme comme
   le formulaire de nutrition le faisait déjà (masse → prise, perte → perte, sinon maintien).

   Intérêt réel : quand les deux axes tirent en sens opposés (gagner en force ET perdre du gras, soit la
   « recomposition corporelle »), on le dit honnêtement avec ses conditions, au lieu de laisser croire que
   tout est compatible. Ce que disent les sources :
   - la recomposition est réelle, mais d'ampleur modeste ;
   - elle est largement documentée chez qui débute, reprend, ou part avec plus de masse grasse ;
   - la fenêtre est étroite chez l'athlète entraîné et déjà sec, où enchaîner les phases rend souvent plus ;
   - condition présente dans toutes les sources : protéines élevées (1,6 à 2,4 g/kg/j) et déficit modéré.
   Bonilla et al., Frontiers in Nutrition 2024 ; Barakat et al., Strength Cond J 2020 ; Longland et al.,
   Am J Clin Nutr 2016 (2,4 contre 1,2 g/kg/j en déficit : masse maigre gagnée et plus de gras perdu).
   Le profil est estimé d'après l'expérience déclarée et le rapport taille/poids : ce n'est pas une mesure
   de masse grasse, et c'est dit au client tel quel. */
const CORPS = [
  { v: "perte", n: "Perdre du gras", court: "perdre du gras" },
  { v: "maintien", n: "Garder mon poids", court: "garder son poids" },
  { v: "prise", n: "Prendre du muscle", court: "prendre du muscle" },
];
const RECOMP_PROT = [1.6, 2.4];
/* programmes dont l'entraînement pousse vers la force, la masse ou la puissance : c'est avec « perdre du
   gras » que le compromis se pose vraiment (les autres combinaisons ne sont pas annoncées comme un conflit,
   faute de preuves solides à citer) */
const CORPS_FORCE_PROGS = ["force", "masse", "vitesse", "prepa"];
const RECOMP_REFS = [
  "Bonilla DA, et al. Body recomposition: a narrative review and practical recommendations. Front Nutr. 2024. — recomposition réelle mais d'ampleur modeste, conditions de protéines et de déficit.",
  "Barakat C, Pearson J, Escalante G, Campbell B, De Souza EO. Body recomposition: can trained individuals build muscle and lose fat at the same time? Strength Cond J. 2020;42(5):7-21. — plus accessible chez le débutant, la reprise et les masses grasses plus élevées ; fenêtre étroite chez l'athlète entraîné et sec.",
  "Longland TM, Oikawa SY, Mitchell CJ, Devries MC, Phillips SM. Higher compared with lower dietary protein during an energy deficit combined with intense exercise promotes greater lean mass gain and fat mass loss. Am J Clin Nutr. 2016;103(3):738-746. — 2,4 contre 1,2 g/kg/j en déficit de 40 % : masse maigre gagnée et davantage de gras perdu.",
];
function corpsDefault(programId) { return programId === "masse" ? "prise" : programId === "perte" ? "perte" : "maintien"; }
function corpsOf(p, programId) {
  const v = p && p.corps;
  return v === "perte" || v === "maintien" || v === "prise" ? v : corpsDefault(programId);
}
function corpsName(v) { const c = CORPS.find((x) => x.v === v); return c ? c.n : ""; }
function corpsCourt(v) { const c = CORPS.find((x) => x.v === v); return c ? c.court : ""; }
/* fenêtre de recomposition estimée : large chez qui débute, reprend, ou part avec plus de masse grasse ;
   étroite chez qui est entraîné et déjà sec. Entrées disponibles seulement : expérience déclarée (profil et
   réponse « expérience en musculation ») et IMC — jamais une mesure de masse grasse, d'où la prudence. */
function recompFenetre(p, plan) {
  const rang = nivRank(effNiveau(plan, p));
  const xp = p && p.request && p.request.answers ? num(p.request.answers.xp) : null;
  const h = num(p && p.height), w = num(p && p.weight);
  const imc = h && w ? w / ((h / 100) * (h / 100)) : null;
  const debutant = rang <= 1 || (xp !== null && xp <= 1);
  const marge = imc !== null && imc >= 25;
  if (debutant || marge) return "large";
  return imc !== null && imc < 23 ? "etroite" : "moyenne";
}
/* l'état des deux axes et, s'il y a compromis, ce qu'on en dit */
function objectifs(p, plan, programId, lib) {
  const pid = programId || (plan && plan.programId) || (p && p.request && p.request.programId) || null;
  const prog = pid ? progOf(pid, lib || null) : null;
  const corps = corpsOf(p, pid);
  const recomp = corps === "perte" && CORPS_FORCE_PROGS.includes(pid);
  const fenetre = recomp ? recompFenetre(p, plan) : null;
  return {
    corps, corpsNom: corpsName(corps), programId: pid, programNom: prog ? prog.n : null,
    recomp, fenetre,
    prot: RECOMP_PROT,
    /* protéines visées en recomposition : moitié haute de la plage des études, le déficit étant le moment
       où l'apport protéique compte le plus (Longland 2016) */
    protCible: recomp ? 2 : null,
  };
}
/* une ligne lisible pour le coach et pour le contexte du coach IA */
function objLigne(o) {
  if (!o) return "";
  return (o.programNom ? "entraînement « " + o.programNom + " »" : "entraînement non choisi") + " · composition corporelle : " + corpsCourt(o.corps)
    + (o.recomp ? " · recomposition visée (fenêtre estimée " + o.fenetre + ", protéines visées " + fmtN(o.protCible, 1) + " g/kg/j)" : "");
}
/* texte affiché au client (et au coach) quand les deux axes tirent en sens opposés */
function recompTexte(o) {
  if (!o || !o.recomp) return null;
  const base = "Gagner en force et perdre du gras en même temps, c'est ce qu'on appelle la recomposition corporelle. C'est réel, mais d'ampleur modeste : les deux avancent plus lentement que si tu n'en visais qu'un.";
  const selon = o.fenetre === "large"
    ? "D'après ton profil, tu es dans le cas le plus favorable : c'est surtout documenté chez les personnes qui débutent, qui reprennent, ou qui partent avec plus de masse grasse."
    : o.fenetre === "etroite"
      ? "D'après ton profil (entraîné et déjà sec), la fenêtre est étroite : enchaîner les deux phases — d'abord l'une, puis l'autre — rend souvent plus que viser les deux à la fois. À voir avec Antoine."
      : "D'après ton profil, c'est jouable sans être acquis : on regarde les chiffres au bout de quelques semaines avant de trancher.";
  const cond = "Condition présente dans toutes les études : des protéines élevées (" + fmtN(RECOMP_PROT[0], 1) + " à " + fmtN(RECOMP_PROT[1], 1) + " g par kg de poids et par jour) et un déficit modéré, pas extrême.";
  const mesure = "Comment on jugera : tes charges et tes tests, ton tour de taille et ton tour de hanches — pas la balance. En recomposition le poids bouge peu, c'est normal et ça ne veut pas dire que rien ne se passe.";
  const proxy = "Estimé d'après ton expérience déclarée et ton rapport taille/poids, pas d'après une mesure de masse grasse.";
  return { base, selon, cond, mesure, proxy };
}
/* choix des deux axes : utilisé à l'inscription et dans le profil */
function ObjectifsPicker({ corps, onCorps, idp }) {
  return html`<${Field} label="Ta composition corporelle" hint="Indépendant de ton entraînement : tu peux viser la force et perdre du gras en même temps. Si les deux tirent en sens opposés, on te le dit franchement.">
    <${Seg} id=${(idp || "obj") + "-corps"} options=${CORPS.map((c) => ({ v: c.v, n: c.n }))} value=${corps} onChange=${onCorps} /></${Field}>`;
}
/* avertissement de compromis : affiché partout où les deux axes sont visibles ensemble */
function RecompNote({ o, coachView }) {
  const t = recompTexte(o);
  if (!t) return null;
  return html`<div className=${"alert " + (o.fenetre === "etroite" ? "gold" : "okb")}>
    <div><b>${o.fenetre === "etroite" ? "Deux objectifs qui tirent en sens opposés" : "Deux objectifs à la fois : c'est jouable"}</b>
      <p>${t.base} ${coachView ? "" : t.selon}</p>
      <p className="small">${t.cond} ${t.mesure}</p>
      <p className="muted small">${t.proxy}</p>
      <details><summary>Les sources</summary><ol className="refs">${RECOMP_REFS.map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></details>
    </div></div>`;
}
/* Comment juger une recomposition : le poids ne sert pas de juge, donc on va chercher les deux mesures
   déjà suivies ailleurs dans l'application — les circonférences (tests « Tour de taille » et « Tour de
   hanches ») et les charges (séries de maximum estimé calculées depuis les séances). Rien de nouveau à
   saisir : on relit ce qui existe et on le dit en clair, pour éviter qu'un poids stable passe pour un échec. */
function testSerie(data, key) {
  return Object.values((data && data.tests) || {}).filter((t) => t && t.values && num(t.values[key]) !== null)
    .sort((a, b) => (Number(a.w) || 0) - (Number(b.w) || 0)).map((t) => ({ w: Number(t.w) || 0, v: num(t.values[key]) }));
}
/* delta entre la première et la dernière valeur, seulement si on a deux points espacés */
function deltaSerie(s) { return s.length >= 2 ? s[s.length - 1].v - s[0].v : null; }
function recompSignaux(data, stats) {
  const taille = testSerie(data, "taille"), hanches = testSerie(data, "hanches");
  const dT = deltaSerie(taille), dH = deltaSerie(hanches);
  const force = (stats && stats.liftSeries) || [];
  const dF = force.length ? force.map((s) => ({ e: s.e, d: s.points[s.points.length - 1].y - s.points[0].y })) : [];
  const dP = stats && stats.weights && stats.weights.length >= 2 ? stats.weights[stats.weights.length - 1].y - stats.weights[0].y : null;
  const circOk = (dT !== null && dT <= -1) || (dH !== null && dH <= -1);
  const forceOk = dF.length ? dF.some((x) => x.d > 0) : null;
  const assez = (dT !== null || dH !== null) && dF.length > 0;
  return { taille: dT, hanches: dH, force: dF, poids: dP, circOk, forceOk, assez };
}
function RecompMesures({ data, stats, coachView }) {
  const s = recompSignaux(data, stats);
  const kg = (v) => (v > 0 ? "+" : "") + fmtN(v, 1);
  const verdict = !s.assez
    ? { t: "", n: "Pas encore de quoi juger", p: "Il faut au moins deux mesures de tour de taille ou de hanches (onglet Tests) et deux séances avec les charges notées sur un même exercice." }
    : s.circOk && s.forceOk ? { t: "okb", n: "La recomposition se passe bien", p: "Les circonférences baissent et les charges montent : c'est exactement le signal attendu, même si le poids bouge peu." }
      : s.circOk ? { t: "gold", n: "Le gras baisse, la force stagne", p: "Soit le déficit est trop marqué, soit les protéines sont trop basses. Remonter l'un ou l'autre avant de continuer." }
        : s.forceOk ? { t: "gold", n: "La force monte, les circonférences non", p: "L'entraînement prend, le déficit n'y est pas. Revoir les apports avant de toucher au programme." }
          : { t: "bad", n: "Ni l'un ni l'autre ne bouge", p: "Après quelques semaines sans mouvement sur les deux, viser un seul objectif à la fois rend généralement plus." };
  return html`<${Card} title="Recomposition : où on en est" sub="Les circonférences et les charges, pas la balance">
    <div className="kvs">
      <div className="kv"><span>Tour de taille</span><b className=${s.taille !== null && s.taille <= -1 ? "ok-t" : ""}>${s.taille === null ? "—" : kg(s.taille) + " cm"}</b></div>
      <div className="kv"><span>Tour de hanches</span><b className=${s.hanches !== null && s.hanches <= -1 ? "ok-t" : ""}>${s.hanches === null ? "—" : kg(s.hanches) + " cm"}</b></div>
      ${s.force.map((x) => html`<div className="kv" key=${x.e}><span>${EXB[x.e] ? EXB[x.e].n : x.e}</span><b className=${x.d > 0 ? "ok-t" : ""}>${kg(x.d)} kg</b></div>`)}
      <div className="kv"><span>Poids</span><b className="muted">${s.poids === null ? "—" : kg(s.poids) + " kg"}</b></div>
    </div>
    <div className=${"alert " + verdict.t}><div><b>${verdict.n}</b><p className="small">${verdict.p}</p></div></div>
    <p className="muted small">Le poids est affiché pour information : en recomposition il bouge peu, ce n'est pas un échec.${coachView ? " Mesures prises depuis les tests du client et ses charges notées." : ""}</p>
  </${Card}>`;
}
/* vue d'ensemble côté coach : les deux axes du client, l'avertissement s'il y a compromis, et le suivi
   des mesures qui comptent. Sans compromis on reste sur une ligne, pour ne pas alourdir la page. */
function CoachObjectifs({ data, plan, stats, lib }) {
  const p = data.profile || {};
  const o = objectifs(p, plan, plan && plan.programId, lib);
  const np = data.nutri && data.nutri.plan;
  const diverge = np && np.goal && np.goal !== o.corps;
  return html`<${Card} title="Objectifs du client" sub="Entraînement et composition corporelle, choisis séparément">
    <div className="kvs"><div className="kv"><span>Entraînement</span><b>${o.programNom || "—"}</b></div>
      <div className="kv"><span>Composition corporelle</span><b>${o.corpsNom}${p.corpsAt ? "" : " *"}</b></div>
      ${o.recomp ? html`<div className="kv"><span>Fenêtre estimée</span><b className=${o.fenetre === "etroite" ? "warn-t" : "ok-t"}>${o.fenetre}</b></div>` : null}
      ${o.recomp ? html`<div className="kv"><span>Protéines visées</span><b>${fmtN(o.protCible, 1)} g/kg/j</b></div>` : null}</div>
    ${p.corpsAt ? null : html`<p className="muted small">* déduit du programme : le client n'a pas encore choisi cet axe lui-même.</p>`}
    ${diverge ? html`<div className="alert gold"><div><b>Nutrition et objectif ne disent pas la même chose</b>
      <p className="small">Ses repères de nutrition sont réglés sur « ${corpsCourt(np.goal)} » alors que son objectif de composition corporelle est « ${corpsCourt(o.corps)} ». À aligner avec lui.</p></div></div>` : null}
    <${RecompNote} o=${o} coachView=${true} />
    ${o.recomp ? html`<${RecompMesures} data=${data} stats=${stats} coachView=${true} />` : null}
  </${Card}>`;
}
/* carte du profil client : les deux axes, modifiables, avec l'avertissement s'il y a lieu */
function ObjectifsCard({ data, src, plan }) {
  const toast = useToast();
  const p = data.profile || {};
  const o = objectifs(p, plan, plan && plan.programId);
  const [busy, setBusy] = useState(false);
  const setCorps = async (v) => {
    setBusy(true);
    try { await src.setProfile({ ...p, corps: v, corpsAt: todayISO() }); toast("Objectif enregistré.", "ok"); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title="Mes objectifs" sub="Deux choix séparés : ce que tu travailles, et où tu veux emmener ton poids">
    <p className="small"><b>Entraînement :</b> ${o.programNom || "pas encore de programme"}${o.programNom ? html` <span className="muted">(choisi avec Antoine)</span>` : null}</p>
    <div className=${busy ? "form dim" : "form"}><${ObjectifsPicker} corps=${o.corps} onCorps=${setCorps} idp="pf-obj" /></div>
    <${RecompNote} o=${o} />
    <p className="muted small">Ta composition corporelle règle tes repères de nutrition. Ton entraînement, c'est le programme : parles-en à Antoine pour le changer.</p>
  </${Card}>`;
}
