/* ===== Planning visuel de la semaine : une suggestion de jours, pas un jour imposé =====
   Les séances de la semaine (déjà construites par weekSessions, boucle comprise si profil.rythme) sont
   réparties le plus régulièrement possible sur les 7 jours réels de cette semaine du plan (spreadDays,
   01_core.js) ; le jour de départ du plan n'est pas forcément un lundi, chaque jour garde son vrai nom. */
function weekPlanning(prog, plan, w, lib, logs) {
  const sessions = weekSessions(prog, plan, w, lib).filter((x) => !x.opt);
  const offsets = spreadDays(sessions.length);
  const weekStart = addDays(plan.start, (w - 1) * 7);
  const byOffset = {};
  offsets.forEach((o, i) => { byOffset[o] = sessions[i]; });
  const today = todayISO();
  return Array.from({ length: 7 }, (_, o) => {
    const date = addDays(weekStart, o);
    const e = byOffset[o] || null;
    return { date, today: date === today, e, done: !!(e && logs && logs[e.key]) };
  });
}
function WeekPlanning({ prog, plan, w, lib, logs, onOpen }) {
  const days = useMemo(() => weekPlanning(prog, plan, w, lib, logs), [prog, plan, w, lib, logs]);
  if (!days.some((d) => d.e)) return null;
  return html`<${Card} title="Ma semaine" sub="Une suggestion de jours : tu peux décaler, l'important est de faire tes séances">
    <div className="wplan">${days.map((d) => html`<button key=${d.date} type="button"
        className=${"wp-d" + (d.today ? " now" : "") + (d.e ? (d.done ? " done" : " on") : " rest")}
        disabled=${!d.e} onClick=${() => d.e && onOpen(d.e)}>
      <small>${JOURS[parseISO(d.date).getDay()].slice(0, 3)}</small><b>${parseISO(d.date).getDate()}</b>
      <span>${d.e ? (d.done ? "✓ " : "") + d.e.s.t + (d.e.rep > 1 ? " (" + d.e.rep + ")" : "") : "Repos"}</span>
    </button>`)}</div>
  </${Card}>`;
}
