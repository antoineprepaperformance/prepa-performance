/* ===== Planning visuel de la semaine : une suggestion de jours, pas un jour imposé =====
   Les séances de la semaine (déjà construites par weekSessions, boucle comprise si profil.rythme) sont
   réparties le plus régulièrement possible sur les 7 jours réels de cette semaine du plan (spreadDays,
   01_core.js) ; le jour de départ du plan n'est pas forcément un lundi, chaque jour garde son vrai nom.
   Séances calées (s.day, programme importé d'un PDF) : affichées sur leur jour exact plutôt que réparties,
   un jour pouvant alors montrer deux séances (s.moment « matin »/« soir », ex. poussée puis musculation). */
function weekPlanning(prog, plan, w, lib, logs) {
  const sessions = weekSessions(prog, plan, w, lib).filter((x) => !x.opt);
  const weekStart = addDays(plan.start, (w - 1) * 7);
  const pinned = sessions.some((x) => x.s.day !== undefined && x.s.day !== null);
  /* séances calées (s.day, 0 = lundi) : ancrées sur le vrai lundi de la semaine civile de weekStart, pas sur
     weekStart lui-même (le début du plan n'est pas forcément un lundi) — sinon « lundi » pourrait tomber un
     autre jour. Les séances réparties automatiquement gardent weekStart, inchangé. */
  const base = pinned ? addDays(weekStart, -((parseISO(weekStart).getDay() + 6) % 7)) : weekStart;
  const today = todayISO();
  const byOffset = {};
  if (pinned) {
    sessions.forEach((e) => {
      const o = e.s.day !== undefined && e.s.day !== null ? clamp(Math.round(e.s.day), 0, 6) : 0;
      (byOffset[o] = byOffset[o] || []).push(e);
    });
  } else {
    spreadDays(sessions.length).forEach((o, i) => { byOffset[o] = [sessions[i]]; });
  }
  return Array.from({ length: 7 }, (_, o) => {
    const date = addDays(base, o);
    const es = byOffset[o] || [];
    return { date, today: date === today, es, pinned };
  });
}
/* coachView : lecture seule, sur la fiche du client (sa semaine à lui, pas la sienne) */
function WeekPlanning({ prog, plan, w, lib, logs, onOpen, coachView }) {
  const days = useMemo(() => weekPlanning(prog, plan, w, lib, logs), [prog, plan, w, lib, logs]);
  if (!days.some((d) => d.es.length)) return null;
  const sub = days.some((d) => d.pinned) ? "Les jours prévus pour cette semaine" : "Une suggestion de jours : tu peux décaler, l'important est de faire tes séances";
  return html`<${Card} title=${coachView ? "Sa semaine" : "Ma semaine"} sub=${sub}>
    <div className="wplan">${days.map((d) => html`<div key=${d.date} className=${"wp-d" + (d.today ? " now" : "") + (!d.es.length ? " rest" : "")}>
      <small>${JOURS[parseISO(d.date).getDay()].slice(0, 3)}</small><b>${parseISO(d.date).getDate()}</b>
      ${d.es.length ? d.es.map((e) => { const done = !!(logs && logs[e.key]); return html`<button key=${e.key} type="button" className=${"wp-e" + (done ? " done" : " on")}
          disabled=${coachView} onClick=${() => !coachView && onOpen(e)}>${(done ? "✓ " : "") + e.s.t + (e.s.moment === "matin" ? " (matin)" : e.s.moment === "soir" ? " (soir)" : "") + (e.rep > 1 ? " (" + e.rep + ")" : "")}</button>`; })
        : html`<span className="wp-rest">Repos</span>`}
    </div>`)}</div>
  </${Card}>`;
}
