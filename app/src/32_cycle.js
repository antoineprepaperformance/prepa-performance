/* ===== Suivi du cycle menstruel =====
   Se débloque si la cliente l'active elle-même (profil « Femme », réglage à part : toutes les femmes ne
   veulent pas forcément ce suivi). Un seul geste au quotidien : « mes règles ont commencé aujourd'hui »
   (data.sante[jour].regles) ; la phase du jour est ensuite estimée à partir de l'historique, rien d'autre à
   saisir. Partage avec le coach réglable séparément, désactivé par défaut (plus sensible que le reste de la
   santé au quotidien).

   Estimation calendaire seulement (aucune mesure de température ni de LH) : phase lutéale relativement fixe
   (~14 jours, durée de vie du corps jaune), c'est la phase folliculaire qui varie d'une femme et d'un cycle à
   l'autre — l'ovulation est donc estimée à partir de la FIN du cycle (durée − 14 jours), pas de son milieu.

   Message de prévention, pas une règle de charge automatique : la science ne permet pas aujourd'hui de dire
   « plus de force ici, décharge là » de façon fiable selon la phase (preuves jugées très faibles, variation
   individuelle énorme) — voir CYCLE_SCIENCE ci-dessous. Seul repère gardé : une vigilance technique pendant la
   fenêtre ovulatoire, où certaines études (qualité faible) associent une laxité ligamentaire plus grande à un
   risque un peu plus élevé de blessure au ligament croisé antérieur. */
const CYCLE_LUTEAL = 14, CYCLE_DEFAULT_LEN = 28, CYCLE_FLOW_DEFAULT = 5;
const CYCLE_SCIENCE = "Les études sur le lien entre cycle menstruel et performance ou blessure restent peu nombreuses, de qualité souvent faible, et montrent une grande variation d'une femme à l'autre. Aucune ne permet de recommander une règle d'entraînement (plus de force ici, décharge là) selon la phase : c'est un repère de vigilance, pas une prescription.";
const CYCLE_REFS = [
  "Dos'Santos T, Stebbings GK, Morse C, Shashidharan M, Daniels KAJ, Sanderson A. Effects of the menstrual cycle phase on anterior cruciate ligament neuromuscular and biomechanical injury risk surrogates in eumenorrheic and naturally menstruating women: a systematic review. PLoS One. 2023;18(1):e0280800. — qualité des preuves jugée « très faible », grande variation individuelle, appelle à la prudence avant d'adapter la préparation physique sur cette seule base.",
  "Meignié A, Duclos M, Carling C, Orhant E, Provost P, Toussaint JF, Antero J. The effects of menstrual cycle phase on elite athlete performance: a critical and systematic review. Front Physiol. 2021;12:654585. — « des recommandations fondées sur des preuves pour individualiser l'entraînement selon la phase du cycle ne sont pas disponibles actuellement » ; ruptures du ligament croisé antérieur plus fréquentes autour de l'ovulation chez des handballeuses.",
  "Herzberg SD et al. The Effect of Menstrual Cycle and Contraceptives on ACL Injuries and Laxity: A Systematic Review and Meta-analysis. Orthop J Sports Med. 2017. — risque de rupture du ligament croisé antérieur un peu plus élevé en phase pré-ovulatoire et ovulatoire, phase lutéale la moins associée aux blessures ; preuves jugées de force globalement faible.",
];
const CYCLE_PHASES = {
  regles: { n: "Règles", court: "Règles", note: "Écoute ton niveau d'énergie : certaines femmes se sentent très bien, d'autres moins. Adapte au ressenti du jour, comme toujours." },
  folliculaire: { n: "Phase folliculaire", court: "Folliculaire", note: "Entre les règles et l'ovulation. Aucune étude solide ne justifie de pousser plus fort ici qu'à un autre moment du cycle." },
  ovulation: { n: "Fenêtre ovulatoire", court: "Ovulation", note: "Certaines études (preuves faibles) associent cette période à une laxité ligamentaire un peu plus grande et à un risque un peu plus élevé de blessure au ligament croisé antérieur. Pas de quoi s'arrêter : plutôt un repère pour soigner la technique en réception et en changement d'appui cette semaine." },
  luteale: { n: "Phase lutéale", court: "Lutéale", note: "Après l'ovulation, jusqu'aux prochaines règles. Phase la moins associée au risque de ligament croisé dans plusieurs études, sans certitude non plus." },
};
function cycleOn(p) { return !!(p && p.cycle && p.cycle.on); }
function cycleShared(p) { return cycleOn(p) && !!(p.cycle && p.cycle.share); }
function cycleStarts(data) { return Object.entries(data.sante || {}).filter(([, v]) => v && v.regles).map(([d]) => d).sort(); }
function cycleLenAvg(starts) {
  if (starts.length < 2) return CYCLE_DEFAULT_LEN;
  const diffs = [];
  /* 10 à 60 j entre deux débuts de règles : écarte seulement une saisie clairement erronée (doublon le même
     jour, cycle manqué non noté), pas un cycle court ou long mais réel (21 à 35 j est la plage usuelle, mais
     certaines femmes sont régulièrement hors de cette plage) */
  for (let i = 1; i < starts.length; i++) { const d = diffDays(starts[i - 1], starts[i]); if (d >= 10 && d <= 60) diffs.push(d); }
  if (!diffs.length) return CYCLE_DEFAULT_LEN;
  return Math.round(avgOf(diffs.slice(-6)));
}
/* jour 1 = jour des règles ; retard de plus d'une semaine sur la durée habituelle : estimation trop
   incertaine pour afficher une phase (plutôt que de deviner une phase probablement fausse) */
function cycleState(data, today) {
  const starts = cycleStarts(data);
  if (!starts.length) return null;
  const t = today || todayISO();
  const last = starts[starts.length - 1];
  const len = cycleLenAvg(starts);
  const day = diffDays(last, t) + 1;
  if (day < 1) return null;
  const late = day > len + 7;
  const ovu = Math.max(CYCLE_FLOW_DEFAULT + 1, len - CYCLE_LUTEAL);
  const flow = Math.min(CYCLE_FLOW_DEFAULT, ovu - 2);
  const phase = late ? null : day <= flow ? "regles" : day < ovu - 2 ? "folliculaire" : day <= ovu + 1 ? "ovulation" : "luteale";
  const cycles = Math.max(1, Math.ceil(day / len));
  return { day, len, late, phase, starts: starts.length, nextStart: addDays(last, len * cycles), last };
}
/* carte : réglage (si pas encore activé) ou suivi du jour (si activé) */
function CycleCard({ data, src, coachView }) {
  const toast = useToast();
  const p = data.profile || {};
  if (p.sex !== "F") return null;
  const [busy, setBusy] = useState(false);
  if (coachView) {
    if (!cycleShared(p)) return null;
    const st = cycleState(data);
    return html`<${Card} title="Son cycle" sub="Partagé avec toi par la cliente">
      ${st && st.phase ? html`<p className="small"><b>${CYCLE_PHASES[st.phase].n}</b> · jour ${st.day} sur ${st.len} environ</p><p className="small muted">${CYCLE_PHASES[st.phase].note}</p>`
        : st ? html`<p className="small muted">Retard sur la durée habituelle (${st.len} j) : phase non estimée.</p>` : html`<p className="small muted">Pas encore de début de règles noté.</p>`}
    </${Card}>`;
  }
  const on = cycleOn(p);
  const setCycle = async (patch) => {
    setBusy(true);
    try { await src.setProfile({ ...p, cycle: { on: true, share: false, ...(p.cycle || {}), ...patch } }); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  if (!on) return html`<${Card} title="Suivi du cycle" sub="Facultatif">
    <p className="small">Sais où tu en es dans ton cycle (règles, ovulation…), et un repère de vigilance pendant la fenêtre ovulatoire — voir plus bas, sources à l'appui. Un seul geste au quotidien : indiquer le jour où tes règles commencent.</p>
    <div className="actions"><${Btn} onClick=${() => setCycle({ on: true })} disabled=${busy}>Activer le suivi</${Btn}></div>
  </${Card}>`;
  const st = cycleState(data);
  const today = todayISO();
  const startedToday = !!(data.sante && data.sante[today] && data.sante[today].regles);
  const logToday = async () => {
    setBusy(true);
    try { const cur = (data.sante && data.sante[today]) || {}; await src.saveSante(today, { ...cur, regles: true, at: nowISO() }); toast("Noté.", "ok"); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title="Mon cycle" sub=${st ? (st.phase ? CYCLE_PHASES[st.phase].n + " · jour " + st.day + " sur " + st.len + " environ" : "Retard sur ta durée habituelle (" + st.len + " j) : phase non estimée") : "Indique le jour où tes dernières règles ont commencé"}>
    ${st && st.phase ? html`<p className="small">${CYCLE_PHASES[st.phase].note}</p>` : null}
    ${st ? html`<p className="muted small">${st.starts < 2 ? "Durée de cycle par défaut (28 j) tant qu'un deuxième début de règles n'est pas noté." : "Durée moyenne sur tes derniers cycles : " + st.len + " j."} Prochaines règles estimées vers le ${fmtD(st.nextStart)}.</p>` : null}
    <div className="actions"><${Btn} onClick=${logToday} disabled=${busy || startedToday}>${startedToday ? "Déjà noté aujourd'hui" : "Mes règles ont commencé aujourd'hui"}</${Btn}></div>
    <details><summary>Les sources, et pourquoi pas de règle automatique de charge</summary>
      <p className="small">${CYCLE_SCIENCE}</p>
      <ol className="refs">${CYCLE_REFS.map((r, i) => html`<li key=${i}>${r}</li>`)}</ol>
    </details>
    <label className="chk"><input type="checkbox" id="cy-share" checked=${!!(p.cycle && p.cycle.share)} onChange=${(e) => setCycle({ share: e.target.checked })} disabled=${busy} /><span>Partager la phase du jour avec ${COACH_NAME_DEFAULT}</span></label>
    <p className="field-h">Désactivé par défaut : plus sensible que le reste de tes données santé. ${COACH_NAME_DEFAULT} ne verra jamais tes dates de règles, seulement la phase estimée du jour si tu partages.</p>
    <button type="button" className="linkbtn" onClick=${() => setCycle({ on: false, share: false })} disabled=${busy}>Désactiver le suivi</button>
  </${Card}>`;
}
