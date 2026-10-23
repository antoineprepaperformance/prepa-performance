/* ===== Espace client ===== */
const CLIENT_TABS = [
  { id: "today", n: "Aujourd'hui", i: "M4 12h16M12 4v16" },
  { id: "programme", n: "Programme", i: "M4 6h16M4 12h16M4 18h10" },
  { id: "bilan", n: "Bilan", i: "M5 4h14v16H5zM8 9h8M8 13h8M8 17h5" },
  { id: "nutrition", n: "Nutrition", i: "M12 8c-1.2-2.2-3.4-3-5.4-2.2C3.8 7 3.6 11 5.4 14.6 6.6 17 8.4 19 10 19c.9 0 1.3-.4 2-.4s1.1.4 2 .4c1.6 0 3.4-2 4.6-4.4 1.8-3.6 1.6-7.6-1.2-8.8C15.4 5 13.2 5.8 12 8zM12 8c0-2 .8-3.6 2.6-4.4" },
  { id: "progres", n: "Progrès", i: "M4 19l5-6 4 3 7-9" },
];
const PROFILE_ICON = "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1.5-4 5-5 8-5s6.5 1 8 5";
function Icon({ d }) { return html`<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d=${d} style=${{ fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}></path></svg>`; }

const CONSENT_SITE = "J'accepte que mes données d'entraînement et de santé (questionnaire santé, douleurs, poids, tests, repas) soient enregistrées pour le suivi de mon programme par Antoine Limousi. Je peux retirer mon accord et demander leur suppression à tout moment. Je sais que ces conseils ne remplacent pas un avis médical.";
function offerName(id) { const o = OFFERS.find((x) => x.id === id); return o ? o.n : "—"; }
function durName(w) { const d = DURS.find((x) => x.w === Number(w)); return d ? d.n : (w ? plural(Number(w), "semaine") : "—"); }
function offerPrice(settings, offer, weeks) {
  const o = (settings && settings.offers && settings.offers[offer]) || (OFFERS.find((x) => x.id === offer) || {}).prix;
  const i = DURS.findIndex((d) => d.w === Number(weeks));
  return o && i >= 0 ? o[i] : null;
}

/* ---------- racine client : choisit la source ---------- */
function ClientRoot({ db, uid, settings, lib, exo }) {
  const [st, setSt] = useState({ phase: "detect" });
  const toast = useToast();
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = window.IS_SITE ? null : lsGet(LS_KEY);
      if (db && uid) {
        try {
          const snap = await db.doc("clients/" + uid).get();
          if (!alive) return;
          if (snap.exists) { setSt({ phase: "app", src: dbSource(db, uid) }); return; }
        } catch (e) {
          /* lecture refusée : sur claude.ai on bascule sur l'appareil ; sur le site on affiche l'erreur */
          if (window.IS_SITE) { if (alive) setSt({ phase: "error", msg: e && e.code === "unavailable" ? "Pas de connexion internet." : "Lecture de ton espace impossible." }); return; }
        }
      }
      if (!alive) return;
      if (local && local.profile) { setSt({ phase: "app", src: localSource() }); return; }
      setSt({ phase: "onboard", canDb: !!(db && uid) });
    })();
    return () => { alive = false; };
  }, [db, uid]);
  useEffect(() => () => { if (st.src) st.src.close(); }, [st.src]);

  async function submit(profile) {
    if (st.canDb) {
      try {
        await db.doc("clients/" + uid).set(clone(profile));
        setSt({ phase: "app", src: dbSource(db, uid) });
        return;
      } catch (e) {
        if (window.IS_SITE) throw new Error("vérifie ta connexion internet et réessaie");
        toast("Mode sans compte : tes données restent sur ce téléphone. Envoie ta demande à ton coach ci-dessous.", "warn");
      }
    }
    if (window.IS_SITE) throw new Error("connexion au serveur impossible");
    const ls = localSource({ ...emptyData(), cid: null });
    await ls.setProfile(profile);
    setSt({ phase: "app", src: ls });
  }
  function applyAccessCode(text) {
    const code = readCode(text);
    const ls = localSource({ ...emptyData(), cid: code.cid });
    ls.applyCode(code);
    setSt({ phase: "app", src: ls });
  }
  if (st.phase === "detect") return html`<${Splash} text="Chargement de ton espace…" />`;
  if (st.phase === "error") return html`<div className="splash"><${Logo} size=${56} /><p>${st.msg}</p><div className="btnrow"><${Btn} onClick=${() => location.reload()}>Réessayer</${Btn}><${SignOutLink} /></div></div>`;
  if (st.phase === "onboard") return html`<${Onboarding} settings=${settings} onSubmit=${submit} onCode=${applyAccessCode} />`;
  return html`<${ClientApp} src=${st.src} settings=${settings} lib=${lib} exo=${exo} db=${db} uid=${uid} />`;
}

function Splash({ text }) { return html`<div className="splash"><${Logo} size=${64} /><p>${text}</p></div>`; }

/* ---------- application client ---------- */
function ClientApp({ src, settings, lib, exo, demo, onExit, onSwitch, db, uid }) {
  const data = useSource(src);
  const ai = useAI();
  const [renew, setRenew] = useState(false);
  usePaymentWatcher(demo ? null : db, uid, demo ? null : src);
  const [tab, setTab] = useState("today");
  const [open, setOpen] = useState(null); // séance ouverte {key}
  const [testOpen, setTestOpen] = useState(null);
  const [chat, setChat] = useState(false);
  const wide = useWide();
  const today = todayISO();
  const libAll = useMemo(() => ({ ...(lib || {}), ...(data.lib || {}) }), [lib, data.lib]);
  const exoAll = useMemo(() => ({ ...(exo || {}), ...(data.exo || {}) }), [exo, data.exo]);
  const plan = data.plan && data.plan.status !== "pending" ? data.plan : null;
  const prog = plan ? progOf(plan.programId, libAll) : null;
  const stats = useMemo(() => computeStats(data, plan, prog, libAll, today), [data, plan, prog, libAll, today]);
  const profile = data.profile || {};
  const coach = (settings && settings.coach) || data.coach || null;
  const scrollTop = () => { try { window.scrollTo(0, 0); } catch (e) {} };
  useEffect(scrollTop, [tab, open, chat]);
  const conf = aiConf(settings, data);
  const showAI = conf.on && ai.ready && !!ai.sample;

  if (!data.ready) return html`<${Splash} text="Synchronisation…" />`;
  const banner = demo ? html`<div className="demo-bar"><span>Aperçu de l'espace client avec un exemple</span><span className="btnrow">${onSwitch ? html`<button type="button" className="linkbtn" onClick=${onSwitch}>Autre exemple</button>` : null}${onExit ? html`<button type="button" className="linkbtn" onClick=${onExit}>Revenir à l'espace coach</button>` : null}</span></div>` : null;

  const access = demo ? "actif" : accessOf(data);
  if (src.mode === "local" && (!plan || !prog || ["archived"].includes(plan.status))) {
    return html`<div className="client">${banner}<${Waiting} data=${data} src=${src} settings=${settings} lib=${libAll} coach=${coach} /></div>`;
  }
  if (!plan || !prog || access === "aucun" || access === "retracte" || plan.status === "archived") {
    return html`<div className="client">${banner}<${AccessScreen} data=${data} src=${src} settings=${settings} db=${db} uid=${uid} lib=${libAll} coach=${coach} state=${access} /></div>`;
  }
  const locked = access !== "actif";
  const openSession = (e) => { if (locked) { setRenew(true); return; } setOpen({ key: e.key, w: e.w }); };
  const renewModal = html`<${Modal} open=${renew} wide title=${access === "pause" ? "Suivi en pause" : "Prolonger ou changer de programme"} onClose=${() => setRenew(false)}>
    ${renew ? (access === "pause" ? html`<p className="small">Ton suivi est en pause : contacte ${coach && coach.name || COACH_NAME_DEFAULT} pour le reprendre.</p>` : html`<${Purchase} data=${data} src=${src} settings=${settings} db=${db} uid=${uid} lib=${libAll} mode="renew" onDone=${() => setRenew(false)} />`) : null}</${Modal}>`;
  if (chat) return html`<div className="client">${banner}<${CoachChat} data=${data} src=${src} plan=${plan} prog=${prog} stats=${stats} lib=${libAll} settings=${settings} onClose=${() => setChat(false)} /></div>`;
  if (open) {
    const ps = stats.ps;
    const w = open.w;
    const entry0 = weekSessions(prog, plan, w, libAll).find((x) => x.key === open.key);
    const entry = entry0 ? { ...entry0, s: { ...entry0.s, items: adjItems(entry0, data) } } : null;
    if (entry) return html`<div className="client">${banner}<${SessionPlayer} entry=${entry} prog=${prog} plan=${plan} exo=${exoAll} data=${data} src=${src}
      onClose=${() => setOpen(null)} isCurrent=${ps && ps.week === w} /></div>`;
  }
  return html`<div className=${"client has-nav" + (wide ? " wide" : "")}>
    ${banner}
    <header className="c-top"><${Brand} sub=${prog.n} /><div className="btnrow">${data.saveFailed ? html`<${Pill} tone="bad">Non sauvegardé</${Pill}>` : null}
      <button type="button" className=${"avbtn" + (tab === "profil" ? " on" : "")} aria-label="Mon profil" onClick=${() => setTab("profil")}><${Avatar} profile=${profile} photo=${data.media && data.media.photo && data.media.photo.data} size=${38} /></button></div></header>
    <main className="c-main">
      ${tab === "today" ? html`<${Today} data=${data} plan=${plan} prog=${prog} stats=${stats} lib=${libAll} src=${src} profile=${profile} coach=${coach}
          go=${setTab} openSession=${openSession} openTests=${(w) => setTestOpen(w)} openChat=${showAI ? () => setChat(true) : null} wide=${wide} onRenew=${demo ? null : () => setRenew(true)} access=${access} />` : null}
      ${tab === "programme" ? html`<${ClientProgram} data=${data} plan=${plan} prog=${prog} stats=${stats} lib=${libAll} exo=${exoAll}
          openSession=${openSession} locked=${locked} />` : null}
      ${tab === "bilan" ? html`<${Bilans} data=${data} plan=${plan} prog=${prog} stats=${stats} src=${src} lib=${libAll} settings=${settings} ai=${showAI ? ai : null} openChat=${showAI ? () => setChat(true) : null} />` : null}
      ${tab === "nutrition" ? html`<${NutritionTab} data=${data} src=${src} plan=${plan} prog=${prog} settings=${settings} db=${db} />` : null}
      ${tab === "progres" ? html`<${Progress} data=${data} plan=${plan} prog=${prog} stats=${stats} openTests=${(w) => setTestOpen(w)} />` : null}
      ${tab === "profil" ? html`<${ClientProfile} data=${data} plan=${plan} prog=${prog} src=${src} settings=${settings} coach=${coach} lib=${libAll} />` : null}
    </main>
    ${renewModal}
    <nav className=${"tabbar" + (showAI ? " six" : "")} aria-label="Navigation">
      ${CLIENT_TABS.map((t, i) => [showAI && i === 2 ? html`<button key="ia" type="button" className="tab-ia" onClick=${() => setChat(true)}><span className="tab-ia-i">✦</span><span>Coach IA</span></button>` : null,
        html`<button key=${t.id} type="button" className=${tab === t.id ? "on" : ""} aria-current=${tab === t.id ? "page" : undefined} onClick=${() => setTab(t.id)}>
        <${Icon} d=${t.i} /><span>${t.n}</span></button>`])}
    </nav>
    <${Modal} open=${testOpen !== null} title="Mes tests" onClose=${() => setTestOpen(null)}>
      ${testOpen !== null ? html`<${TestsForm} prog=${prog} plan=${plan} data=${data} src=${src} point=${testOpen} onDone=${() => setTestOpen(null)} />` : null}
    </${Modal}>
  </div>`;
}

/* ---------- Aujourd'hui ---------- */
function AINotes({ data, w, openChat }) {
  const notes = activeAdj(data, "note").filter((a) => w >= (a.fromW || 0) && w <= (a.toW || 99));
  const rev = chatMsgs(data).filter((m) => m.kind === "bilan").slice(-1)[0];
  const fresh = rev && diffDays(String(rev.at).slice(0, 10), todayISO()) <= 7 ? rev : null;
  if (!notes.length && !fresh) return null;
  return html`<div className="coachmsg ai"><span className="ai-dot">✦</span><div><div className="eyebrow">Coach IA</div>
    ${notes.map((n) => html`<p key=${n.id}>${n.text}</p>`)}
    ${fresh ? html`<p className="small">${String(fresh.t).split(/\n/)[0].slice(0, 220)}${String(fresh.t).split(/\n/)[0].length > 220 ? "…" : ""}</p>` : null}
    ${openChat ? html`<button type="button" className="linkbtn" onClick=${openChat}>${fresh ? "Lire l'analyse de ma semaine" : "Poser une question"}</button>` : null}</div></div>`;
}
function useWide() {
  const q = "(min-width: 900px)";
  const get = () => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
  const [w, setW] = useState(get);
  useEffect(() => { let m; try { m = window.matchMedia(q); const f = () => setW(m.matches); m.addEventListener ? m.addEventListener("change", f) : m.addListener(f); return () => { m.removeEventListener ? m.removeEventListener("change", f) : m.removeListener(f); }; } catch (e) { return undefined; } }, []);
  return w;
}
function Today({ data, plan, prog, stats, lib, src, profile, coach, go, openSession, openTests, openChat, wide, onRenew, access }) {
  const ps = stats.ps;
  const name = (profile.name || "").split(" ")[0];
  const hold = plan.medicalHold ? html`<div className="alert warn"><div><b>Avis médical en attente</b><p>Ton questionnaire santé demande l'avis de ton médecin : tes séances restent en mode Reprise jusqu'à ce que ${coach && coach.name || COACH_NAME_DEFAULT} enregistre cet avis.</p></div></div>` : null;
  if (ps.phase === "avant") {
    const w1 = weekSessions(prog, plan, 1, lib);
    return html`<div className="stack">
      <div className="hero"><div className="eyebrow">Départ le ${JOURS[parseISO(plan.start).getDay()]} ${fmtD(plan.start)}</div>
        <h1>Bonjour ${name || ""}, ton programme commence dans ${plural(ps.daysToStart, "jour")}.</h1>
        <p className="muted">${prog.n} · ${durName(plan.weeks)} · formule ${offerName(plan.offer)}</p></div>
      ${!data.tests.t0 ? html`<${Card} title="Fais tes tests de départ" sub="Ils serviront de point de comparaison toutes les 4 semaines."><${Btn} onClick=${() => openTests(0)}>Saisir mes tests</${Btn}></${Card}>` : null}
      ${prog.prereq ? html`<${Prereq} prog=${prog} />` : null}
      <${Card} title="Ta première semaine">${w1.map((e) => html`<${SessionRow} key=${e.key} e=${e} log=${data.logs[e.key]} onOpen=${() => openSession(e)} />`)}</${Card}>
      ${plan.message ? html`<${CoachMsg} text=${plan.message} coach=${coach} />` : null}
    </div>`;
  }
  if (ps.phase === "fini") {
    return html`<div className="stack">
      <div className="hero"><div className="eyebrow">Programme terminé le ${fmtD(ps.end)}</div>
        <h1>Bravo ${name || ""} : ${plural(stats.logs.filter((l) => l.kind !== "presentiel").length, "séance")} réalisées.</h1>
        <p className="muted">Regarde tes progrès, puis contacte ${coach && coach.name || COACH_NAME_DEFAULT} pour la suite de ton accompagnement.</p></div>
      <div className="btnrow">${onRenew ? html`<${Btn} onClick=${onRenew}>Prolonger ou choisir la suite</${Btn}>` : null}<${Btn} kind="ghost" onClick=${() => go("progres")}>Voir mes progrès</${Btn}></div>
      <p className="muted small">Les séances de cette période ne sont plus accessibles ; ton historique, tes bilans, tes tests et ta carte restent consultables.</p>
      ${!data.tests["t" + plan.weeks] ? html`<${Card} title="Tests de fin de programme"><${Btn} kind="ghost" onClick=${() => openTests(plan.weeks)}>Saisir mes tests finaux</${Btn}></${Card}>` : null}
    </div>`;
  }
  const w = ps.week;
  const sessions = weekSessions(prog, plan, w, lib);
  const next = sessions.find((e) => !e.opt && !data.logs[e.key]) || sessions.find((e) => e.opt && !data.logs[e.key]);
  const block = blockOf(prog, w);
  const left = diffDays(todayISO(), ps.end);
  const ck = data.checkins["w" + w];
  const prevMissing = w > 1 && !data.checkins["w" + (w - 1)];
  const testPoint = ps.wib === 4 ? w : null;
  const testDue = testPoint && !data.tests["t" + testPoint];
  const replies = Object.entries(data.replies || {}).map(([k, v]) => ({ w: Number(k.slice(1)), ...v })).sort((a, b) => b.w - a.w);
  const lastReply = replies[0];
  const hero = html`<div className="hero">
      <div className="eyebrow">Semaine ${w} sur ${ps.weeks} · Bloc ${ps.block} — ${block.n}</div>
      <h1>${next ? (name ? name + ", " : "") + "prochaine séance : " + next.s.t.toLowerCase() : "Toutes les séances de la semaine sont faites."}</h1>
      <${Bar} value=${(w - 1 + ps.day / 7) / ps.weeks} />
      <p className="muted small">${ps.wib === 4 ? "Semaine d'allègement : charges plus légères, puis tests." : block.focus}</p>
    </div>`;
  const ring = html`<div className="today-grid">
      <${Ring} value=${stats.plannedThisWeek ? stats.doneThisWeek / stats.plannedThisWeek : 0} label=${stats.doneThisWeek + "/" + stats.plannedThisWeek} sub="séances" size=${118} />
      <div className="stack-s">
        <${Stat} n=${stats.adherence === null ? "—" : Math.round(stats.adherence * 100) + " %"} label="Régularité" sub="séances faites / prévues" />
        <${Stat} n=${stats.logs.filter((l) => l.kind !== "presentiel").length} label="Séances au total" />
      </div>
    </div>`;
  const nextB = html`${next ? html`<button type="button" className="next" onClick=${() => openSession(next)}>
      <div><div className="eyebrow">Séance ${next.extra ? "supplémentaire" : next.sid}${next.opt ? " · optionnelle" : ""}${next.s.lieu ? " · " + next.s.lieu : ""}</div>
        <div className="next-t">${next.s.t}</div><div className="muted small">${next.s.focus || ""} · ${plural(next.s.items.length, "exercice")}</div></div>
      <span className="next-go">Commencer</span></button>` : null}`;
  const alerts = html`${testDue ? html`<div className="alert gold"><div><b>Semaine de tests</b><p>Fais tes tests en fin de semaine et note tes résultats.</p></div><${Btn} small onClick=${() => openTests(testPoint)}>Saisir</${Btn}></div>` : null}
    ${prevMissing ? html`<div className="alert warn"><div><b>Bilan de la semaine ${w - 1} en attente</b><p>Deux minutes pour dire à ton coach comment ça s'est passé.</p></div><${Btn} small onClick=${() => go("bilan")}>Remplir</${Btn}></div>` : null}
    ${!ck && (ps.day >= 6 || !next) ? html`<div className="alert gold"><div><b>Bilan de la semaine ${w}</b><p>À remplir en fin de semaine.</p></div><${Btn} small onClick=${() => go("bilan")}>Remplir</${Btn}></div>` : null}
    ${left <= 7 && onRenew ? html`<div className="alert gold"><div><b>Ton accès se termine le ${fmtD(ps.end)}</b><p>Prolonge maintenant pour enchaîner sans coupure.</p></div><${Btn} small onClick=${onRenew}>Prolonger</${Btn}></div>` : null}
    ${hold}`;
  const ainotes = html`<${AINotes} data=${data} w=${w} openChat=${openChat} />`;
  const cardMini = html`<${CardPanel} data=${data} plan=${plan} prog=${prog} lib=${lib} compact=${true} onOpen=${() => go("profil")} />`;
  const nutri = html`<${NutriToday} data=${data} go=${go} />`;
  const habits = prog.habits && prog.habits.length ? html`<${Habits} prog=${prog} data=${data} src=${src} block=${ps.block} />` : null;
  const msgs = html`${plan.message ? html`<${CoachMsg} text=${plan.message} coach=${coach} />` : null}
    ${lastReply ? html`<${CoachMsg} text=${lastReply.text} coach=${coach} title=${"Réponse à ton bilan de la semaine " + lastReply.w} />` : null}`;
  const week = html`<${Card} title=${"Semaine " + w}>${sessions.map((e) => html`<${SessionRow} key=${e.key} e=${e} log=${data.logs[e.key]} onOpen=${() => openSession(e)} />`)}</${Card}>`;
  if (wide) return html`<div className="stack">${hero}<div className="cols2"><div className="stack">${nextB}${alerts}${week}${msgs}</div><div className="stack">${ring}${cardMini}${ainotes}${nutri}${habits}</div></div></div>`;
  return html`<div className="stack">${hero}${ring}${nextB}${alerts}${ainotes}${cardMini}${nutri}${habits}${msgs}${week}</div>`;
}
function CoachMsg({ text, coach, title }) {
  return html`<div className="coachmsg"><${Logo} size=${26} /><div><div className="eyebrow">${title || "Message de " + (coach && coach.name || COACH_NAME_DEFAULT)}</div><p>${text}</p></div></div>`;
}
function Prereq({ prog }) {
  return html`<${Card} title="Avant de commencer" sub="Les critères à remplir avant la reprise de la course.">
    <ul className="checks">${prog.prereq.map((p, i) => html`<li key=${i}>${p}</li>`)}</ul>
    <p className="muted small">Règle de la douleur : au plus 3/10 pendant l'effort, et retour à la normale le lendemain. Sinon, reviens à l'étape précédente et préviens ton coach.</p>
  </${Card}>`;
}
function SessionRow({ e, log, onOpen, locked }) {
  return html`<button type="button" className=${"srow" + (log ? " done" : "") + (locked && !log ? " lock" : "")} onClick=${onOpen}>
    <span className="srow-id">${e.extra ? "+" : e.sid}</span>
    <span className="srow-t"><b>${e.s.t}${e.opt ? html` <${Pill}>optionnelle</${Pill}>` : null}</b><span className="muted small">${log ? "Faite le " + fmtD(log.date) + (log.rpe !== undefined && log.rpe !== null ? " · effort " + log.rpe + "/10" : "") : (e.s.focus || "") + (e.s.lieu ? " · " + e.s.lieu : "")}</span></span>
    <span className=${"srow-s" + (log ? " ok" : "")}>${log ? "✓" : locked ? "🔒" : "›"}</span>
  </button>`;
}

/* ---------- Habitudes ---------- */
function Habits({ prog, data, src, block }) {
  const today = todayISO();
  const m = today.slice(0, 7);
  const doc = data.habits[m] || { days: {} };
  const done = (doc.days && doc.days[today]) || [];
  const [busy, setBusy] = useState(false);
  const toggle = async (i) => {
    if (busy) return;
    setBusy(true);
    const set = new Set(done); set.has(i) ? set.delete(i) : set.add(i);
    const next = { ...doc, days: { ...(doc.days || {}), [today]: [...set].sort() } };
    try { await src.saveHabits(m, next); } finally { setBusy(false); }
  };
  const last7 = Array.from({ length: 7 }, (_, k) => addDays(today, k - 6));
  const score = (d) => { const mm = d.slice(0, 7); const dd = data.habits[mm] && data.habits[mm].days && data.habits[mm].days[d]; return dd ? dd.length / prog.habits.length : 0; };
  return html`<${Card} title="Mes habitudes du jour" sub=${prog.habit_note ? prog.habit_note[Math.min(block, prog.habit_note.length) - 1] : null}>
    <div className="habits">${prog.habits.map((h, i) => html`<button key=${i} type="button" className=${"habit" + (done.includes(i) ? " on" : "")} aria-pressed=${done.includes(i)} onClick=${() => toggle(i)}>
      <span className="hb-box">${done.includes(i) ? "✓" : ""}</span><span>${h}</span></button>`)}</div>
    <div className="week-dots">${last7.map((d) => html`<div key=${d} className="wd"><span className="wd-d" style=${{ opacity: 0.25 + 0.75 * score(d) }}></span><small>${JOURS[parseISO(d).getDay()].slice(0, 1).toUpperCase()}</small></div>`)}</div>
  </${Card}>`;
}

/* ---------- Programme ---------- */
function ClientProgram({ data, plan, prog, stats, lib, openSession, locked }) {
  const ps = stats.ps;
  const [w, setW] = useState(ps.phase === "en_cours" ? ps.week : ps.phase === "fini" ? plan.weeks : 1);
  const block = blockOf(prog, w);
  const sessions = weekSessions(prog, plan, w, lib);
  const weeks = Array.from({ length: plan.weeks }, (_, i) => i + 1);
  return html`<div className="stack">
    <div className="hero"><div className="eyebrow">${prog.n}</div><h1>${durName(plan.weeks)} · ${fmtD(plan.start)} → ${fmtD(ps.end)}</h1>
      <p className="muted small">${prog.desc}</p></div>
    <div className="weeks" role="tablist" aria-label="Semaines">${weeks.map((k) => {
      const pl = stats.plannedByWeek[k] || 0, dn = stats.doneByWeek[k] || 0;
      return html`<button key=${k} type="button" role="tab" aria-selected=${k === w} className=${"wk" + (k === w ? " on" : "") + (ps.week === k && ps.phase === "en_cours" ? " now" : "") + (dn >= pl && pl ? " full" : "")} onClick=${() => setW(k)}>
        <span>S${k}</span><small>${dn}/${pl}</small></button>`;
    })}</div>
    <${Card} title=${"Bloc " + Math.ceil(w / 4) + " — " + block.n} sub=${block.focus}>
      ${((w - 1) % 4) + 1 === 4 ? html`<p className="note">Semaine ${w} : allègement (moins de séries, charges plus légères) puis tests de fin de bloc.</p>` : null}
      ${sessions.map((e) => html`<${SessionRow} key=${e.key} e=${e} log=${data.logs[e.key]} locked=${locked} onOpen=${() => openSession(e)} />`)}
    </${Card}>
    <${Card} title=${"Mon profil : " + nivName(effNiveau(plan, data.profile))} sub=${(NIVB[effNiveau(plan, data.profile)] || {}).short}>
      <ul className="small">${((NIVB[effNiveau(plan, data.profile)] || {}).what || []).map((x, k) => html`<li key=${k}>${x}</li>`)}</ul>
      ${nivRank(effNiveau(plan, data.profile)) >= 2 ? html`<details><summary>La science des profils Performance et Haut niveau</summary><p className="small">${CONTENT.NIVSCI}</p><ol className="refs">${(CONTENT.NIVREFS || []).map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></details>` : null}</${Card}>
    <${Card} title="La méthode" sub="Pourquoi ce programme fonctionne"><p className="small">${prog.science}</p>
      <details><summary>Références scientifiques</summary><ol className="refs">${(prog.refs || []).map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></details>
      <details><summary>Comprendre les consignes</summary><ul className="small">
        <li><b>4 × 5</b> : 4 séries de 5 répétitions.</li>
        <li><b>RIR 2</b> : arrête la série quand il te reste environ 2 répétitions en réserve. RIR 4 = très facile, RIR 0 = échec.</li>
        <li><b>Récup</b> : temps de repos entre deux séries.</li>
        <li><b>Tempo 3-0-X-0</b> : descente en 3 s, pas de pause, montée explosive (X), pas de pause en haut.</li>
        <li><b>% du maximum</b> : charge rapportée à ton maximum estimé à partir de tes séances (formule d'Epley) ou de tes tests.</li>
        <li><b>Effort ressenti</b> : note de 0 (repos) à 10 (maximal) donnée 15 à 30 min après la séance.</li>
        <li><b>Semaine 4, 8 et 12</b> : allègement pour récupérer, puis tests.</li></ul></details>
    </${Card}>
  </div>`;
}

/* ---------- Lecteur de séance ---------- */
function prevSets(data, e, excludeKey) {
  const logs = Object.values(data.logs || {}).filter((l) => l && l.key !== excludeKey).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  for (const l of logs) { const it = (l.items || []).find((x) => x.e === e && x.sets && x.sets.some((s) => num(s.kg) !== null)); if (it) return { sets: it.sets, date: l.date }; }
  return null;
}
function SessionPlayer({ entry, prog, plan, exo, data, src, onClose, isCurrent }) {
  const toast = useToast();
  const wib = ((entry.w - 1) % 4) + 1;
  const existing = data.logs[entry.key];
  const niv = effNiveau(plan, data.profile);
  const detailed = nivRank(niv) >= 2;
  const items = useMemo(() => [...entry.s.items, ...preventionFor(entry, prog, plan, niv, data.profile && data.profile.sport)], [entry.key, niv]);
  const [ready, setReady] = useState(existing && existing.readiness ? existing.readiness.values : null);
  const rd = detailed ? readinessOf(ready, data) : null;
  const taper = detailed ? taperFor(plan, entry.w) : null;
  const ctx = useMemo(() => ({ niveau: niv, block: Math.ceil(entry.w / 4), e1rm: (e) => e1rmFor(e, data), vma: vmaOf(data), t5k: t5kOf(data), taper, ready: rd }), [niv, entry.key, rd && rd.lvl, !!taper]);
  const doses = useMemo(() => items.map((it) => doseFor(it, wib, ctx)), [items, ctx]);
  const [vals, setVals] = useState(() => items.map((it, i) => {
    const d = doseFor(it, wib, { niveau: niv, block: Math.ceil(entry.w / 4) });
    const ex = existing && existing.items && existing.items[i];
    if (d.load) {
      const prev = prevSets(data, it.e, entry.key);
      const n = Math.max(1, d.sets || 1);
      const target = parseInt(String(d.reps), 10) || "";
      return { e: it.e, sets: Array.from({ length: Math.max(n, ex && ex.sets ? ex.sets.length : 0) }, (_, k) => ex && ex.sets && ex.sets[k] ? { ...ex.sets[k] } : { kg: prev && prev.sets[Math.min(k, prev.sets.length - 1)] ? prev.sets[Math.min(k, prev.sets.length - 1)].kg : "", reps: target }), prev };
    }
    return { e: it.e, done: ex ? !!ex.done : false };
  }));
  /* la forme du jour ou l'affûtage changent le nombre de séries : on ajuste les lignes sans perdre la saisie */
  useEffect(() => {
    if (existing) return;
    setVals((vs) => vs.map((v, i) => {
      if (!v.sets) return v;
      const n = Math.max(1, doses[i].sets || 1);
      if (v.sets.length === n) return v;
      const filled = v.sets.filter((s) => s.kg !== "" && s.kg !== null && s.kg !== undefined && !(v.prev && v.prev.sets.some((p) => p.kg === s.kg))).length;
      if (v.sets.length > n) return { ...v, sets: v.sets.slice(0, Math.max(n, filled)) };
      const last = v.sets[v.sets.length - 1] || { kg: "", reps: "" };
      return { ...v, sets: [...v.sets, ...Array.from({ length: n - v.sets.length }, () => ({ ...last }))] };
    }));
  }, [doses]);
  const [rpe, setRpe] = useState(existing ? existing.rpe : null);
  const [duree, setDuree] = useState(existing ? existing.duree : 60);
  const [douleur, setDouleur] = useState(existing ? existing.douleur || 0 : 0);
  const [zone, setZone] = useState(existing ? existing.zone || "" : "");
  const [comment, setComment] = useState(existing ? existing.comment || "" : "");
  const [date, setDate] = useState(existing ? existing.date : (isCurrent ? todayISO() : addDays(plan.start, (entry.w - 1) * 7)));
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const upd = (i, f) => setVals((v) => v.map((x, k) => (k === i ? f(clone(x)) : x)));
  const save = async () => {
    if (rpe === null || rpe === undefined) { toast("Indique ton effort ressenti (0 à 10) avant d'enregistrer.", "warn"); return; }
    setBusy(true);
    const log = { key: entry.key, w: entry.w, sid: entry.sid, date, title: entry.s.t, items: vals.map((v, i) => ({ e: v.e, done: v.sets ? true : !!v.done, sets: v.sets ? v.sets.map((s) => ({ kg: num(s.kg), reps: num(s.reps) })) : undefined, prev: items[i] && items[i].prev ? true : undefined })),
      rpe, duree: num(duree) || 0, load: (rpe || 0) * (num(duree) || 0), douleur, zone: douleur > 0 ? zone : "", comment, savedAt: nowISO(), niveau: niv,
      readiness: rd ? { values: ready, score: rd.score, lvl: rd.lvl } : undefined, opt: entry.opt ? true : undefined };
    try { await src.saveLog(entry.key, log); toast("Séance enregistrée.", "ok"); onClose(); }
    catch (e) { toast("Enregistrement impossible. Réessaie dans un instant.", "bad"); }
    finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { await src.deleteLog(entry.key); toast("Séance supprimée.", "ok"); onClose(); } finally { setBusy(false); } };
  const wu = warmupFor(entry, prog, plan, niv);
  const nPrev = items.filter((x) => x.prev).length;
  return html`<div className="player">
    <header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Retour">‹</button>
      <div><div className="eyebrow">Semaine ${entry.w} · séance ${entry.extra ? "supplémentaire" : entry.sid}${entry.opt ? " (optionnelle)" : ""}${entry.s.lieu ? " · " + entry.s.lieu : ""} · profil ${nivName(niv)}</div><h2>${entry.s.t}</h2></div></header>
    ${entry.s.focus ? html`<p className="muted">${entry.s.focus}</p>` : null}
    ${plan.medicalHold ? html`<div className="alert warn"><div><b>Mode Reprise</b><p>En attendant l'avis de ton médecin, les charges et les intensités sont réduites.</p></div></div>` : null}
    ${taper ? html`<div className="alert gold"><div><b>Affûtage</b><p>${taper.n}</p></div></div>` : null}
    ${detailed ? html`<${ReadinessCheck} value=${ready} onChange=${setReady} data=${data} />` : null}
    ${wu ? html`<div className="wu"><b>${detailed ? "Échauffement RAMP" : "Échauffement"}</b><p>${wu}</p></div>` : null}
    <ol className="exlist">${items.map((it, i) => {
      const ex = exOf(it.e, plan.equipment, prog, exo);
      const d = doses[i];
      const v = vals[i];
      return html`<li key=${i} className=${"exc" + (it.prev ? " prev" : "")}>
        ${it.prev && (i === 0 || !items[i - 1].prev) ? html`<div className="eyebrow prev-h">Prévention · ${plural(nPrev, "exercice")} adapté${nPrev > 1 ? "s" : ""} à ton sport</div>` : null}
        <div className="exc-h"><span className="exc-n">${i + 1}</span><div className="exc-t"><b>${ex.n}</b>${ex.subst ? html` <${Pill} tone="gold">version maison</${Pill}>` : null}
          <div className="dose">${d.text}</div>${(d.lines || []).length ? html`<ul className="dose-l">${d.lines.map((l, k) => html`<li key=${k}>${l}</li>`)}</ul>` : null}
          ${it.n ? html`<div className="muted small">${it.n}</div>` : null}${ex.cnote ? html`<div className="muted small">${ex.cnote}</div>` : null}
          ${it.adj ? html`<div className="ai-note">✦ ${it.adj}</div>` : null}${it.adjNote ? html`<div className="ai-note">✦ Consigne du coach IA : ${it.adjNote}</div>` : null}</div></div>
        <details className="cues"><summary>Consignes${ex.video ? " et vidéo" : ""}</summary>
          <ul>${(ex.cues || []).map((c, k) => html`<li key=${k}>${c}</li>`)}</ul>
          ${ex.reg || ex.prog ? html`<p className="small muted">${ex.reg ? "Plus facile : " + ex.reg + ". " : ""}${ex.prog ? "Plus difficile : " + ex.prog + "." : ""}</p>` : null}
          ${ex.video ? html`<a href=${ex.video} target="_blank" rel="noopener">Voir la démonstration</a>` : null}
        </details>
        ${v && v.sets ? html`<div className="sets">
          <div className="sets-h"><span>Série</span><span>Charge (kg)</span><span>Rép.</span></div>
          ${v.sets.map((s, k) => html`<div className="set" key=${k}><span className="set-n">${k + 1}</span>
            <input id=${"kg-" + i + "-" + k} inputMode="decimal" aria-label=${"Charge série " + (k + 1)} value=${s.kg ?? ""} placeholder=${d.kg ? fmtN(d.kg[0], 1) : ""} onChange=${(e) => upd(i, (x) => { x.sets[k].kg = e.target.value; return x; })} />
            <input id=${"rp-" + i + "-" + k} inputMode="numeric" aria-label=${"Répétitions série " + (k + 1)} value=${s.reps ?? ""} onChange=${(e) => upd(i, (x) => { x.sets[k].reps = e.target.value; return x; })} /></div>`)}
          <div className="sets-f">${v.prev ? html`<span className="muted small">Dernière fois (${fmtD(v.prev.date)}) : ${v.prev.sets.map((s) => (s.kg ?? "—") + " kg × " + (s.reps ?? "—")).join(" · ")}</span>` : html`<span className="muted small">Note la charge utilisée à chaque série.</span>`}
            <button type="button" className="linkbtn" onClick=${() => upd(i, (x) => { x.sets.push({ ...(x.sets[x.sets.length - 1] || { kg: "", reps: "" }) }); return x; })}>+ série</button></div>
        </div>` : v ? html`<button type="button" className=${"donebtn" + (v.done ? " on" : "")} aria-pressed=${!!v.done} onClick=${() => upd(i, (x) => { x.done = !x.done; return x; })}>${v.done ? "✓ Fait" : "Marquer comme fait"}</button>` : null}
      </li>`;
    })}</ol>
    <section className="card finish">
      <h3>Fin de séance</h3>
      <${Field} label="Effort ressenti (0 à 10)" hint=${rpe !== null && rpe !== undefined ? RPE_LABELS[rpe] : "0 = repos, 10 = maximal"}><${Scale} id="rpe" min=${0} max=${10} value=${rpe} onChange=${setRpe} /></${Field}>
      <div className="row2">
        <${Field} label="Durée (minutes)" id="duree"><input id="duree" inputMode="numeric" value=${duree} onChange=${(e) => setDuree(e.target.value)} /></${Field}>
        <${Field} label="Date" id="date"><input id="date" type="date" value=${date} onChange=${(e) => setDate(e.target.value)} /></${Field}>
      </div>
      ${detailed ? html`<p className="muted small">Charge de la séance (effort × durée, Foster 2001) : ${rpe !== null && rpe !== undefined ? fmtN(rpe * (num(duree) || 0), 0) + " UA" : "—"}.</p>` : null}
      <${Field} label="Douleur pendant ou après (0 à 10)" hint="Au-dessus de 3 : allège et préviens ton coach."><${Scale} id="douleur" min=${0} max=${10} value=${douleur} onChange=${setDouleur} /></${Field}>
      ${douleur > 0 ? html`<${Field} label="Où ?" id="zone"><input id="zone" value=${zone} onChange=${(e) => setZone(e.target.value)} placeholder="Ex. genou gauche" /></${Field}>` : null}
      <${Field} label="Commentaire (facultatif)" id="comment"><textarea id="comment" rows="3" value=${comment} onChange=${(e) => setComment(e.target.value)}></textarea></${Field}>
      <div className="actions"><${Btn} block onClick=${save} disabled=${busy}>${existing ? "Mettre à jour la séance" : "Enregistrer la séance"}</${Btn}></div>
      ${existing ? html`<div className="actions">${confirmDel ? html`<span className="small">Supprimer cette séance ?</span><${Btn} kind="danger" small onClick=${del} disabled=${busy}>Oui, supprimer</${Btn}><${Btn} kind="quiet" small onClick=${() => setConfirmDel(false)}>Annuler</${Btn}>`
        : html`<button type="button" className="linkbtn" onClick=${() => setConfirmDel(true)}>Supprimer cette séance</button>`}</div>` : null}
    </section>
  </div>`;
}

/* ---------- Bilans hebdomadaires ---------- */
function Bilans({ data, plan, prog, stats, src, lib, settings, ai, openChat }) {
  const ps = stats.ps;
  const maxW = ps.phase === "en_cours" ? ps.week : ps.phase === "fini" ? plan.weeks : 0;
  const firstMissing = (() => { for (let w = 1; w <= maxW; w++) if (!data.checkins["w" + w]) return w; return maxW; })();
  const [w, setW] = useState(firstMissing || 1);
  const list = Object.values(data.checkins || {}).filter(Boolean).sort((a, b) => b.w - a.w);
  const [rev, setRev] = useState(null);
  const [sent, setSent] = useState(null);
  const ctl = useRef(null);
  useEffect(() => () => { try { ctl.current && ctl.current.abort(); } catch (e) {} }, []);
  const review = async (wk) => {
    if (!ai || !ai.sample) return;
    const c = new AbortController(); ctl.current = c;
    setRev({ w: wk, text: "", ev: [], busy: true, err: "" });
    try {
      const r = await weeklyReview({ ai, src, plan, prog, lib, settings, w: wk, signal: c.signal, onText: ({ text }) => setRev((x) => ({ ...x, text })), onEvent: (ev) => setRev((x) => ({ ...x, ev })) });
      setRev((x) => ({ ...x, text: r.text, ev: r.events, busy: false }));
    } catch (e) { setRev((x) => ({ ...x, busy: false, err: aiErr(e), text: (e && e.text) || x.text })); }
  };
  const lastRev = chatMsgs(data).filter((m) => m.kind === "bilan" && m.w === w).slice(-1)[0];
  if (!maxW) return html`<div className="stack"><${Empty} title="Pas encore de bilan" text="Ton premier bilan sera à remplir à la fin de ta première semaine." /></div>`;
  return html`<div className="stack">
    <div className="hero"><div className="eyebrow">Bilan hebdomadaire</div><h1>Deux minutes pour faire le point avec ton coach.</h1></div>
    <div className="weeks">${Array.from({ length: maxW }, (_, i) => i + 1).map((k) => html`<button key=${k} type="button" className=${"wk" + (k === w ? " on" : "") + (data.checkins["w" + k] ? " full" : "")} onClick=${() => setW(k)}><span>S${k}</span><small>${data.checkins["w" + k] ? "✓" : "à faire"}</small></button>`)}</div>
    <${CheckinForm} key=${"ck" + w} w=${w} prog=${prog} existing=${data.checkins["w" + w]} reply=${data.replies["w" + w]} src=${src} onSaved=${(wk) => { setSent(wk); if (ai) review(wk); }} />
    ${sent === w ? html`<${Card} title="Ta carte athlète cette semaine" sub="Mise à jour avec ton bilan"><${CardEvo} data=${data} plan=${plan} prog=${prog} lib=${lib} /></${Card}>` : null}
    ${rev && rev.w === w ? html`<div className="coachmsg ai"><span className="ai-dot">✦</span><div className="stack-s"><div className="eyebrow">Analyse de ta semaine par le coach IA</div>
        ${rev.text ? String(rev.text).split(/\n{2,}/).map((p, k) => html`<p key=${k}>${p}</p>`) : html`<p className="muted">Le coach IA relit ta semaine (séances, charges, bilan, repas)…</p>`}
        ${rev.ev && rev.ev.length ? html`<div className="evs">${rev.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}
        ${rev.err ? html`<p className="small warn-t">${rev.err}</p>` : null}
        <div className="btnrow">${rev.busy ? html`<${Btn} small kind="quiet" onClick=${() => ctl.current && ctl.current.abort()}>Stop</${Btn}>` : openChat ? html`<${Btn} small kind="ghost" onClick=${openChat}>Répondre au coach IA</${Btn}>` : null}</div></div></div>`
      : lastRev ? html`<div className="coachmsg ai"><span className="ai-dot">✦</span><div className="stack-s"><div className="eyebrow">Analyse du coach IA · semaine ${w}</div>
        ${String(lastRev.t).split(/\n{2,}/).map((p, k) => html`<p key=${k}>${p}</p>`)}
        ${lastRev.ev && lastRev.ev.length ? html`<div className="evs">${lastRev.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}</div></div>`
      : ai && data.checkins["w" + w] ? html`<div className="right"><${Btn} small kind="ghost" onClick=${() => review(w)}>Faire analyser ma semaine par le coach IA</${Btn}></div>` : null}
    ${list.length ? html`<${Card} title="Historique">${list.map((c) => html`<div key=${c.w} className="hist"><div className="hist-h"><b>Semaine ${c.w}</b><span className="muted small">${fmtD(c.at)}</span></div>
      <div className="chips">${num(c.poids) !== null ? html`<${Pill}>${fmtN(num(c.poids))} kg</${Pill}>` : null}${c.sommeil ? html`<${Pill}>Sommeil ${c.sommeil}/5</${Pill}>` : null}${c.energie ? html`<${Pill}>Énergie ${c.energie}/5</${Pill}>` : null}${c.douleur ? html`<${Pill} tone=${c.douleur >= 4 ? "bad" : "warn"}>Douleur ${c.douleur}/10</${Pill}>` : null}</div>
      ${data.replies["w" + c.w] ? html`<div className="reply"><b>Réponse :</b> ${data.replies["w" + c.w].text}</div>` : null}</div>`)}</${Card}>` : null}
  </div>`;
}
function CheckinForm({ w, prog, existing, reply, src, onSaved }) {
  const toast = useToast();
  const fields = CHECKIN.filter((f) => !(f.k === "pas" && !(prog.habits || []).length) && !(f.k === "nutrition" && !(prog.habits || []).length));
  const [v, setV] = useState(() => ({ ...(existing || {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const save = async () => {
    setBusy(true);
    const out = { ...v, w, at: (existing && existing.at) || nowISO(), editedAt: existing ? nowISO() : undefined };
    ["poids", "taille", "pas"].forEach((k) => { if (out[k] !== undefined) out[k] = num(out[k]); });
    Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    let ok = false;
    try { await src.saveCheckin(w, out); ok = true; toast("Bilan envoyé.", "ok"); } catch (e) { toast("Envoi impossible. Réessaie dans un instant.", "bad"); } finally { setBusy(false); }
    if (ok && onSaved && !existing) onSaved(w);
  };
  return html`<${Card} title=${"Semaine " + w} sub=${existing ? "Envoyé le " + fmtD(existing.at) + " · tu peux le modifier" : "Réponds à ce qui te concerne"}>
    ${reply ? html`<div className="reply"><b>Réponse de ton coach :</b> ${reply.text}</div>` : null}
    <div className="form">${fields.map((f) => {
      if (f.k === "zone" && !(v.douleur > 0)) return null;
      if (f.type === "scale") return html`<${Field} key=${f.k} label=${f.n}><${Scale} id=${"ck-" + f.k} min=${f.min} max=${f.max} value=${v[f.k] ?? null} onChange=${(x) => set(f.k, x)} lo=${f.lo} hi=${f.hi} /></${Field}>`;
      if (f.type === "num") return html`<${Field} key=${f.k} label=${f.n + (f.u ? " (" + f.u + ")" : "")} id=${"ck-" + f.k}><input id=${"ck-" + f.k} inputMode="decimal" value=${v[f.k] ?? ""} onChange=${(e) => set(f.k, e.target.value)} /></${Field}>`;
      return html`<${Field} key=${f.k} label=${f.n} id=${"ck-" + f.k}><textarea id=${"ck-" + f.k} rows="2" value=${v[f.k] ?? ""} onChange=${(e) => set(f.k, e.target.value)}></textarea></${Field}>`;
    })}</div>
    <div className="actions"><${Btn} block onClick=${save} disabled=${busy}>${existing ? "Mettre à jour mon bilan" : "Envoyer mon bilan"}</${Btn}></div>
  </${Card}>`;
}

/* ---------- Tests ---------- */
function testPoints(plan) { const pts = [0]; for (let w = 4; w <= (plan ? plan.weeks : 12); w += 4) pts.push(w); return pts; }
function TestsForm({ prog, plan, data, src, point, onDone }) {
  const toast = useToast();
  const pts = testPoints(plan);
  const [p, setP] = useState(pts.includes(point) ? point : 0);
  const existing = data.tests["t" + p];
  const [vals, setVals] = useState(() => clone(existing ? existing.values : {}) || {});
  useEffect(() => { const ex = data.tests["t" + p]; setVals(clone(ex ? ex.values : {}) || {}); }, [p]);
  const side = data.profile && data.profile.side;
  const set = (k, x) => setVals((o) => ({ ...o, [k]: x }));
  const save = async () => {
    const out = {};
    prog.tests.forEach((tid) => {
      const t = TESTS[tid]; const v = vals[tid];
      if (v === undefined || v === null || v === "") return;
      if (t.type === "pair") { const g = num(v.g), d = num(v.d); if (g !== null || d !== null) out[tid] = { g, d }; }
      else if (t.type === "e1rm") { const kg = num(v.kg), reps = num(v.reps); const e = epley(kg, reps); if (e) out[tid] = { kg, reps, v: e }; }
      else { const n = num(v); if (n !== null) out[tid] = n; }
    });
    try { await src.saveTest("t" + p, { w: p, at: nowISO(), values: out }); toast("Tests enregistrés.", "ok"); onDone && onDone(); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  return html`<div className="form">
    <${Seg} options=${pts.map((x) => ({ v: x, n: x === 0 ? "Départ" : "S" + x }))} value=${p} onChange=${setP} />
    ${prog.tests.map((tid) => {
      const t = TESTS[tid]; const v = vals[tid];
      if (!t) return null;
      if (t.type === "pair") return html`<${Field} key=${tid} label=${t.n + " (" + t.u + ")"} hint=${t.help}><div className="row2">
        <input id=${"t-" + tid + "-g"} inputMode="decimal" placeholder="Gauche" aria-label="Gauche" value=${(v && v.g) ?? ""} onChange=${(e) => set(tid, { ...(v || {}), g: e.target.value })} />
        <input id=${"t-" + tid + "-d"} inputMode="decimal" placeholder="Droite" aria-label="Droite" value=${(v && v.d) ?? ""} onChange=${(e) => set(tid, { ...(v || {}), d: e.target.value })} /></div>
        ${v && lsi({ g: num(v.g), d: num(v.d) }, side) ? html`<span className="small">Indice de symétrie : <b>${lsi({ g: num(v.g), d: num(v.d) }, side)} %</b> (objectif ≥ 90 %)</span>` : null}</${Field}>`;
      if (t.type === "e1rm") return html`<${Field} key=${tid} label=${t.n} hint=${t.help}><div className="row2">
        <input id=${"t-" + tid + "-kg"} inputMode="decimal" placeholder="Charge (kg)" aria-label="Charge" value=${(v && v.kg) ?? ""} onChange=${(e) => set(tid, { ...(v || {}), kg: e.target.value })} />
        <input id=${"t-" + tid + "-r"} inputMode="numeric" placeholder="Répétitions" aria-label="Répétitions" value=${(v && v.reps) ?? ""} onChange=${(e) => set(tid, { ...(v || {}), reps: e.target.value })} /></div>
        ${v && epley(num(v.kg), num(v.reps)) ? html`<span className="small">Maximum estimé : <b>${fmtN(epley(num(v.kg), num(v.reps)))} kg</b></span>` : null}</${Field}>`;
      return html`<${Field} key=${tid} label=${t.n + " (" + t.u + ")"} hint=${t.help} id=${"t-" + tid}><input id=${"t-" + tid} inputMode="decimal" value=${v ?? ""} onChange=${(e) => set(tid, e.target.value)} />
        ${tid === "vma" && num(v) ? html`<span className="small">VMA estimée : <b>${fmtN(num(v) / 100)} km/h</b></span>` : null}</${Field}>`;
    })}
    <div className="actions"><${Btn} block onClick=${save}>Enregistrer les tests</${Btn}></div>
  </div>`;
}
function TestsTable({ prog, plan, data }) {
  const pts = testPoints(plan).filter((p) => data.tests["t" + p]);
  const side = data.profile && data.profile.side;
  if (!pts.length) return html`<p className="muted small">Aucun test enregistré pour l'instant.</p>`;
  return html`<div className="tscroll"><table className="ttable">
    <thead><tr><th>Test</th>${pts.map((p) => html`<th key=${p}>${p === 0 ? "Départ" : "S" + p}</th>`)}<th>Évolution</th></tr></thead>
    <tbody>${prog.tests.map((tid) => {
      const t = TESTS[tid]; if (!t) return null;
      const vals = pts.map((p) => testValue(tid, data.tests["t" + p].values[tid], side));
      const better = testBetter(prog, tid);
      const cell = (v) => v === null ? "—" : t.type === "pair" ? (fmtN(v.g) + " / " + fmtN(v.d) + (lsi(v, side) ? " · " + lsi(v, side) + " %" : "")) : fmtN(v, 2);
      const firstI = vals.findIndex((v) => v !== null);
      let lastI = -1; vals.forEach((v, i) => { if (v !== null) lastI = i; });
      let evo = null;
      if (firstI >= 0 && lastI > firstI) {
        if (t.type === "pair") { const a = lsi(vals[firstI], side), b = lsi(vals[lastI], side); evo = a && b ? html`<${Delta} a=${a} b=${b} better="high" unit="%" digits=${0} />` : null; }
        else evo = html`<${Delta} a=${vals[firstI]} b=${vals[lastI]} better=${better} unit=${t.u} />`;
      }
      return html`<tr key=${tid}><th>${t.n}<small>${t.u}</small></th>${vals.map((v, i) => html`<td key=${i}>${cell(v)}</td>`)}<td>${evo || "—"}</td></tr>`;
    })}</tbody></table></div>`;
}

/* ---------- Progrès ---------- */
function Progress({ data, plan, prog, stats, openTests }) {
  const ps = stats.ps;
  const weeksUpTo = ps.phase === "fini" ? plan.weeks : Math.max(1, ps.week);
  const adh = Array.from({ length: weeksUpTo }, (_, i) => { const w = i + 1; return { x: "S" + w, y: stats.doneByWeek[w] || 0, note: "prévu " + (stats.plannedByWeek[w] || 0), muted: w === ps.week && ps.phase === "en_cours" }; });
  const load = Array.from({ length: weeksUpTo }, (_, i) => { const w = i + 1; return { x: "S" + w, y: stats.loadByWeek[w] || 0, muted: w === ps.week && ps.phase === "en_cours" }; });
  const tp = testPoints(plan);
  const nextPoint = tp.find((p) => !data.tests["t" + p]);
  return html`<div className="stack">
    <div className="hero"><div className="eyebrow">Mes progrès</div><h1>${stats.logs.filter((l) => l.kind !== "presentiel").length} séances · ${stats.adherence === null ? "régularité calculée dès la semaine 2" : Math.round(stats.adherence * 100) + " % de régularité"}</h1></div>
    <${Card} title="Mes tests" sub="Départ puis toutes les 4 semaines" action=${html`<${Btn} small kind="ghost" onClick=${() => openTests(nextPoint ?? 0)}>Saisir</${Btn}>`}>
      <${TestsTable} prog=${prog} plan=${plan} data=${data} /></${Card}>
    ${stats.weights.length ? html`<${Card} title="Poids"><${LineChart} points=${stats.weights} unit="kg" /></${Card}>` : null}
    ${stats.waists.length ? html`<${Card} title="Tour de taille"><${LineChart} points=${stats.waists} unit="cm" /></${Card}>` : null}
    <${Card} title="Séances par semaine" sub="La semaine en cours est en clair"><${BarChart} data=${adh} unit="séances" /></${Card}>
    <${Card} title="Charge d'entraînement" sub="Effort ressenti × durée, par semaine"><${BarChart} data=${load} unit="UA" /></${Card}>
    ${stats.liftSeries.map((s) => html`<${Card} key=${s.e} title=${(EXB[s.e] ? EXB[s.e].n : s.e) + " — maximum estimé"}><${LineChart} points=${s.points} unit="kg" /></${Card}>`)}
  </div>`;
}

/* ---------- Profil ---------- */
function ClientProfile({ data, plan, prog, src, settings, coach, lib }) {
  const [edit, setEdit] = useState(false);
  const [legal, setLegal] = useState(null);
  const toast = useToast();
  const p = data.profile || {};
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState(false);
  const apply = () => { try { src.applyCode(readCode(code)); setCode(""); toast("Programme mis à jour.", "ok"); } catch (e) { toast(e.message, "bad"); } };
  return html`<div className="stack">
    <div className="prof-h"><button type="button" className="avbtn big" aria-label="Changer ma photo ou mon avatar" onClick=${() => setEdit(true)}><${Avatar} profile=${p} photo=${data.media && data.media.photo && data.media.photo.data} size=${72} ring=${true} /><span className="av-edit">✎</span></button>
      <div><div className="eyebrow">Mon profil</div><h1>${p.name || "Mon espace"}</h1>
      <p className="muted">${prog ? prog.n : ""} · formule ${offerName(plan && plan.offer)} · ${durName(plan && plan.weeks)}</p>
      <button type="button" className="linkbtn" onClick=${() => setEdit(true)}>Changer ma photo ou mon avatar</button></div></div>
    <div className="cols2 prof"><${Card} title="Ma carte athlète" sub="Elle évolue avec tes séances, tes bilans et tes tests"><${CardPanel} data=${data} plan=${plan} prog=${prog} lib=${lib} /></${Card}>
      <${Badges} data=${data} plan=${plan} prog=${prog} lib=${lib} /></div>
    <${Modal} open=${edit} title="Ma photo et mon avatar" onClose=${() => setEdit(false)}>${edit ? html`<${AvatarPicker} data=${data} src=${src} onDone=${() => setEdit(false)} />` : null}</${Modal}>
    <${Card} title="Mon programme"><dl className="dl">
      <dt>Début</dt><dd>${fmtDY(plan && plan.start)}</dd><dt>Fin</dt><dd>${plan ? fmtDY(addDays(plan.start, plan.weeks * 7 - 1)) : "—"}</dd>
      <dt>Lieu</dt><dd>${plan && plan.equipment === "maison" ? "À la maison" : "En salle / sur terrain"}</dd>
      <dt>Profil</dt><dd>${nivName(effNiveau(plan, p))}${plan && plan.medicalHold ? " (Reprise en attendant l'avis médical)" : ""}</dd>
      ${plan && plan.compDate ? html`<dt>Compétition</dt><dd>${fmtDY(plan.compDate)}</dd>` : null}
      ${p.sport ? html`<dt>Sport</dt><dd>${p.sport}</dd>` : null}</dl></${Card}>
    <${OrdersCard} data=${data} src=${src} settings=${settings} />
    ${coach && (coach.phone || coach.email) ? html`<${Card} title=${"Contacter " + (coach.name || COACH_NAME_DEFAULT)}>
      ${coach.phone ? html`<div className="contact"><span>${coach.phone}</span><${CopyBtn} text=${coach.phone} /></div>` : null}
      ${coach.email ? html`<div className="contact"><span>${coach.email}</span><${CopyBtn} text=${coach.email} /></div>` : null}
      ${coach.instagram ? html`<div className="contact"><span>${coach.instagram}</span></div>` : null}</${Card}>` : null}
    ${window.IS_SITE ? html`<${Card} title="Mon compte"><${SignOutLink} /></${Card}>` : null}
    ${src.mode === "local" ? html`<${Card} title="Mes données sont sur cet appareil" sub="Envoie-les régulièrement à ton coach, par exemple après chaque bilan.">
      <${CopyBox} id="pkg" text=${src.package()} label="Copier mes données pour mon coach" />
      <p className="muted small">Colle le texte copié dans un message (SMS, WhatsApp, e-mail) à ton coach. Il sert aussi de sauvegarde si tu changes de téléphone.</p>
      <${Field} label="Nouveau code d'accès reçu de ton coach" id="newcode"><textarea id="newcode" rows="3" value=${code} onChange=${(e) => setCode(e.target.value)} placeholder="APPCODE1…"></textarea></${Field}>
      <${Btn} kind="ghost" onClick=${apply} disabled=${!code.trim()}>Appliquer le code</${Btn}>
      <div className="actions">${confirm ? html`<span className="small">Effacer toutes tes données de cet appareil ?</span><${Btn} kind="danger" small onClick=${() => src.reset()}>Effacer</${Btn}><${Btn} kind="quiet" small onClick=${() => setConfirm(false)}>Annuler</${Btn}>`
        : html`<button type="button" className="linkbtn" onClick=${() => setConfirm(true)}>Effacer mes données de cet appareil</button>`}</div>
    </${Card}>` : src.mode === "db" ? html`<${Card} title="Synchronisé"><p className="small">Tes séances, bilans et tests sont enregistrés en ligne et visibles par ton coach.</p></${Card}>` : null}
    <${Card} title="Informations légales"><div className="btnrow">
      <button type="button" className="linkbtn" onClick=${() => setLegal("cgv")}>Conditions de vente</button>
      <button type="button" className="linkbtn" onClick=${() => setLegal("confidentialite")}>Confidentialité</button>
      <button type="button" className="linkbtn" onClick=${() => setLegal("mentions")}>Mentions légales</button></div></${Card}>
    <${Modal} open=${!!legal} wide title=${{ cgv: "Conditions générales de vente", confidentialite: "Politique de confidentialité", mentions: "Mentions légales" }[legal] || ""} onClose=${() => setLegal(null)}>${legal ? html`<${LegalDoc} kind=${legal} settings=${settings} />` : null}</${Modal}>
    <${Card} title="Confidentialité"><p className="small">${window.IS_SITE ? "Tes données (y compris de santé) servent uniquement au suivi de ton entraînement par ton coach. Elles sont hébergées par Google Firebase (serveurs en Europe) et visibles uniquement par toi et par Antoine. Tu peux demander la suppression de tes données à tout moment. Les conseils de l'application ne remplacent pas un avis médical : en cas de douleur inhabituelle, arrête et consulte." : html`Tes données (y compris de santé) servent uniquement au suivi de ton entraînement par ton coach. Quand tu utilises le coach IA, ton dossier et tes photos de repas sont envoyés à Claude (Anthropic) pour l'analyse : les photos ne sont pas conservées par l'application, tes échanges avec le coach IA sont visibles par Antoine. Tu peux demander la suppression de tes données à tout moment. Les conseils de l'application ne remplacent pas un avis médical : en cas de douleur inhabituelle, arrête et consulte.`}</p></${Card}>
  </div>`;
}
function CopyBtn({ text }) {
  const toast = useToast();
  return html`<button type="button" className="linkbtn" onClick=${() => { try { navigator.clipboard.writeText(text).then(() => toast("Copié.", "ok"), () => toast("Sélectionne le texte pour le copier.", "warn")); } catch (e) { toast("Sélectionne le texte pour le copier.", "warn"); } }}>Copier</button>`;
}

/* ---------- En attente de validation ---------- */
function Waiting({ data, src, settings, lib, coach }) {
  const toast = useToast();
  const p = data.profile || {};
  const req = p.request || {};
  const prog = progOf(req.programId, lib);
  const [code, setCode] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const plan = data.plan;
  const status = plan && plan.status;
  const apply = () => { try { src.applyCode(readCode(code)); toast("Programme activé.", "ok"); } catch (e) { toast(e.message, "bad"); } };
  const fakePlan = { weeks: req.weeks || 12, start: req.start || nextMonday() };
  return html`<div className="stack">
    <header className="c-top"><${Brand} sub="Mon suivi" /></header>
    <div className="hero"><div className="eyebrow">${status === "archived" ? "Suivi terminé" : "Demande envoyée"}</div>
      <h1>${status === "archived" ? "Ton suivi est clôturé." : "Bonjour " + ((p.name || "").split(" ")[0] || "") + ", " + (coach && coach.name || COACH_NAME_DEFAULT) + " prépare ton programme."}</h1>
      <p className="muted">${prog ? prog.n : "Programme"} · formule ${offerName(req.offer)} · ${durName(req.weeks)} · départ souhaité le ${fmtD(req.start)}</p></div>
    ${src.mode === "local" ? html`<${Card} title="1. Envoie ta demande à ton coach" sub="Copie le texte et colle-le dans un message (SMS, WhatsApp ou e-mail).">
        <${CopyBox} id="req" text=${src.package()} label="Copier ma demande" /></${Card}>
      <${Card} title="2. Colle ton code d'accès" sub="Ton coach te répond avec un code qui active ton programme.">
        <${Field} label="Code d'accès" id="code"><textarea id="code" rows="3" value=${code} onChange=${(e) => setCode(e.target.value)} placeholder="APPCODE1…"></textarea></${Field}>
        <${Btn} onClick=${apply} disabled=${!code.trim()}>Activer mon programme</${Btn}></${Card}>`
      : html`<${Card} title="Et maintenant ?"><p className="small">Ton coach valide ta demande, généralement sous 24 h. Ton programme apparaîtra ici automatiquement.</p></${Card}>`}
    ${prog ? html`<${Card} title="Pendant ce temps : tes tests de départ" sub="Ils servent de point de comparaison.">
      <${Btn} kind="ghost" onClick=${() => setTestOpen(true)}>${data.tests.t0 ? "Modifier mes tests" : "Saisir mes tests"}</${Btn}></${Card}>` : null}
    ${prog && prog.prereq ? html`<${Prereq} prog=${prog} />` : null}
    ${prog ? html`<${Card} title="Ton programme" sub=${prog.short}><p className="small">${prog.desc}</p>
      <ul className="blocks">${prog.blocks.slice(0, Math.ceil((req.weeks || 12) / 4)).map((b, i) => html`<li key=${i}><b>Bloc ${i + 1} — ${b.n}</b><span className="muted small">${b.focus}</span></li>`)}</ul></${Card}>` : null}
    ${window.IS_SITE ? html`<${SignOutLink} />` : null}
    <${Modal} open=${testOpen} title="Mes tests de départ" onClose=${() => setTestOpen(false)}>
      ${testOpen && prog ? html`<${TestsForm} prog=${prog} plan=${fakePlan} data=${data} src=${src} point=${0} onDone=${() => setTestOpen(false)} />` : null}
    </${Modal}>
  </div>`;
}

/* ---------- Inscription ---------- */
function Onboarding({ settings, onSubmit, onCode }) {
  const toast = useToast();
  const au = window.IS_SITE && window.SITE.auth ? window.SITE.auth.currentUser : null;
  const pendingCode = (() => { try { return normCode(localStorage.getItem("pending_code") || ""); } catch (e) { return ""; } })();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: (au && au.displayName) || "", email: (au && au.email) || "", phone: "", birthYear: "", sport: "", answers: { compet: null, xp: null, freq: 3 },
    programId: "", niveau: "", screening: SCREENING.map(() => null), prereq: [], side: "", consent: false, parentName: "", parentEmail: "", parentOk: false });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const setA = (k, v) => setF((o) => ({ ...o, answers: { ...o.answers, [k]: v } }));
  const prog = PB[f.programId];
  const age = f.birthYear ? new Date().getFullYear() - Number(f.birthYear) : null;
  const minor = age !== null && age < 18;
  const flag = f.screening.some((x) => x === true);
  const rec = recommendNiveau(f.answers, age, flag);
  const niveau = f.niveau || rec.id;
  const cat = sportCat(f.sport);
  const recProgs = PROG_FOR_SPORT[cat] || [];
  const prereqOk = !prog || !prog.prereq || f.prereq.length === prog.prereq.length;
  const checks = prog ? assessPlan({ programId: f.programId, niveau, ans: f.answers, sport: f.sport, age, equipment: "salle", screeningFlag: flag, prereqOk }) : [];
  const steps = ["Bienvenue", "Toi", "Niveau", "Objectif", "Santé", "Validation"];
  const mailOk = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
  const can = () => {
    if (step === 1) return f.name.trim().length > 1 && (!f.birthYear || (Number(f.birthYear) > 1900 && Number(f.birthYear) <= new Date().getFullYear() - 8));
    if (step === 2) return f.answers.compet !== null && f.answers.xp !== null;
    if (step === 3) return !!f.programId;
    if (step === 4) return f.screening.every((x) => x !== null) && prereqOk && (!minor || (f.parentName.trim().length > 1 && mailOk(f.parentEmail)));
    if (step === 5) return f.consent && (!minor || f.parentOk);
    return true;
  };
  const submit = async () => {
    setBusy(true);
    const consentTxt = window.IS_SITE ? CONSENT_SITE : "Accord pour l'enregistrement des données d'entraînement et de santé à des fins de suivi, et pour leur analyse par le coach IA (Claude, Anthropic) lors de son utilisation.";
    const profile = { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), birthYear: num(f.birthYear), sport: f.sport.trim(),
      level: { reprise: "Débutant", sportif: "Intermédiaire", perf: "Confirmé", elite: "Confirmé" }[niveau] || "Intermédiaire",
      side: f.side || "", prereq: f.prereq, request: { programId: f.programId, niveau, answers: f.answers, offer: "suivi", weeks: 4, equipment: "salle", start: nextMonday(), code: pendingCode || null },
      screening: f.screening, screeningFlag: flag, consent: { at: nowISO(), text: consentTxt, v: window.IS_SITE ? "site2" : 3 },
      parent: minor ? { name: f.parentName.trim(), email: f.parentEmail.trim(), at: nowISO(), ok: true } : null, createdAt: nowISO() };
    try { await onSubmit(profile); } catch (e) { toast("Inscription impossible : " + (e.message || "réessaie."), "bad"); } finally { setBusy(false); }
  };
  const opts = (k) => (NIVQ[k] ? NIVQ[k].o : []).map(([v, n]) => ({ v, n }));
  return html`<div className="client onboard">
    <header className="c-top"><${Brand} sub="Suivi en ligne" /></header>
    ${step > 0 ? html`<div className="steps">${steps.slice(1).map((s, i) => html`<span key=${s} className=${i + 1 <= step ? "on" : ""}>${s}</span>`)}</div>` : null}
    ${step === 0 ? html`<div className="stack">
      <div className="hero big"><div className="eyebrow">Préparation physique en ligne</div>
        <h1>Ton programme, tes séances et tes progrès au même endroit.</h1>
        <p className="muted">8 programmes construits par Antoine Limousi, préparateur physique (UBB Sevens, Girondins de Bordeaux, CREPS de Bordeaux), adaptés à ton niveau : de la reprise au haut niveau.</p></div>
      ${pendingCode ? html`<div className="alert okb"><div><b>Code ${pendingCode} enregistré</b><p>Il sera appliqué à la dernière étape.</p></div></div>` : null}
      <${Btn} block onClick=${() => setStep(1)}>Commencer mon inscription</${Btn}>
      ${window.IS_SITE ? html`<${SignOutLink} />` : html`<${Card} title="Tu as reçu un code d'accès ?" sub="Colle-le ici pour ouvrir directement ton programme.">
        <${Field} label="Code d'accès" id="code0"><textarea id="code0" rows="3" value=${code} onChange=${(e) => setCode(e.target.value)} placeholder="APPCODE1…"></textarea></${Field}>
        <${Btn} kind="ghost" disabled=${!code.trim()} onClick=${() => { try { onCode(code); } catch (e) { toast(e.message, "bad"); } }}>Ouvrir mon programme</${Btn}></${Card}>`}
    </div>` : null}
    ${step === 1 ? html`<div className="stack form">
      <h2>Faisons connaissance</h2>
      <${Field} label="Prénom et nom" id="ob-name"><input id="ob-name" value=${f.name} onChange=${(e) => set("name", e.target.value)} autoComplete="name" /></${Field}>
      <div className="row2"><${Field} label="E-mail" id="ob-email"><input id="ob-email" type="email" value=${f.email} onChange=${(e) => set("email", e.target.value)} autoComplete="email" /></${Field}>
        <${Field} label="Téléphone" id="ob-phone"><input id="ob-phone" type="tel" value=${f.phone} onChange=${(e) => set("phone", e.target.value)} autoComplete="tel" /></${Field}></div>
      <div className="row2"><${Field} label="Année de naissance" id="ob-by"><input id="ob-by" inputMode="numeric" value=${f.birthYear} onChange=${(e) => set("birthYear", e.target.value.replace(/\D/g, "").slice(0, 4))} /></${Field}>
        <${Field} label="Sport pratiqué" id="ob-sport" hint=${f.sport ? "Reconnu : " + SPORT_LABEL[cat] : null}><input id="ob-sport" value=${f.sport} onChange=${(e) => set("sport", e.target.value)} placeholder="Rugby, course, aucun…" /></${Field}></div>
    </div>` : null}
    ${step === 2 ? html`<div className="stack form"><h2>Ton niveau</h2>
      <p className="muted small">Ces réponses règlent la précision de tes séances : charges, tempo, récupération, prévention.</p>
      <${Field} label=${NIVQ.compet ? NIVQ.compet.n : "Niveau"}><${Seg} id="nq-compet" options=${opts("compet")} value=${f.answers.compet} onChange=${(v) => setA("compet", v)} /></${Field}>
      <${Field} label=${NIVQ.xp ? NIVQ.xp.n : "Expérience"}><${Seg} id="nq-xp" options=${opts("xp")} value=${f.answers.xp} onChange=${(v) => setA("xp", v)} /></${Field}>
      <${Field} label=${NIVQ.freq ? NIVQ.freq.n : "Séances"}><${Seg} id="nq-freq" options=${opts("freq")} value=${f.answers.freq} onChange=${(v) => setA("freq", v)} /></${Field}>
      ${f.answers.compet !== null && f.answers.xp !== null ? html`<div className="field"><span className="field-l">Ton profil</span><${NiveauCards} value=${niveau} onChange=${(v) => set("niveau", v)} recommended=${rec.id} />
        <span className="field-h">${rec.why.join(" ")}${f.niveau && nivRank(f.niveau) > nivRank(rec.id) ? " Tu as choisi un profil plus exigeant que conseillé : ton coach le vérifiera." : ""}</span></div>` : null}
    </div>` : null}
    ${step === 3 ? html`<div className="stack"><h2>Ton objectif</h2>
      ${recProgs.length && cat !== "aucun" ? html`<p className="muted small">Conseillés pour un ${SPORT_LABEL[cat]} : ${recProgs.slice(0, 2).map((x) => PB[x].n).join(", ")}.</p>` : null}
      <div className="pgrid">${PROGS.map((x) => html`<button key=${x.id} type="button" className=${"pcard" + (f.programId === x.id ? " on" : "")} aria-pressed=${f.programId === x.id} onClick=${() => set("programId", x.id)}>
        <b>${x.n}</b><span>${x.short}</span><small>${x.lieu}</small>${recProgs.slice(0, 2).includes(x.id) ? html`<${Pill} tone="gold">Conseillé</${Pill}>` : null}</button>`)}</div>
      ${prog ? html`<${Card} title=${prog.n}><p className="small">${prog.desc}</p><${FitChecks} checks=${checks} /></${Card}>` : null}</div>` : null}
    ${step === 4 ? html`<div className="stack form"><h2>Ta santé</h2>
      <p className="muted small">Réponds honnêtement : un « oui » ne t'empêche pas de t'entraîner, mais il faudra l'avis de ton médecin avant les séances intenses.</p>
      ${SCREENING.map((q, i) => html`<div key=${i} className="yn"><span>${q}</span><${Seg} options=${[{ v: false, n: "Non" }, { v: true, n: "Oui" }]} value=${f.screening[i]} onChange=${(v) => set("screening", f.screening.map((x, k) => (k === i ? v : x)))} /></div>`)}
      ${flag ? html`<div className="alert warn"><div><b>Avis médical recommandé</b><p>Consulte ton médecin avant de commencer et montre-lui ton programme. En attendant, tes séances restent en mode Reprise et ton coach en est informé.</p></div></div>` : null}
      ${prog && prog.prereq ? html`<${Card} title="Critères de reprise de la course" sub="Coche chaque critère rempli.">
        ${prog.prereq.map((c, i) => html`<label key=${i} className="chk"><input type="checkbox" id=${"pr-" + i} checked=${f.prereq.includes(i)} onChange=${(e) => set("prereq", e.target.checked ? [...f.prereq, i] : f.prereq.filter((x) => x !== i))} /><span>${c}</span></label>`)}
        <${Field} label="Jambe blessée"><${Seg} options=${[{ v: "gauche", n: "Gauche" }, { v: "droite", n: "Droite" }, { v: "", n: "Aucune / autre" }]} value=${f.side} onChange=${(v) => set("side", v)} /></${Field}>
        ${f.prereq.length < prog.prereq.length ? html`<p className="small">Tous les critères doivent être remplis avant de commencer ce programme. Sinon, poursuis ta rééducation avec ton kiné.</p>` : null}
      </${Card}>` : null}
      ${minor ? html`<${Card} title="Moins de 18 ans" sub="L'inscription se fait avec un parent ou un tuteur légal.">
        <div className="row2"><${Field} label="Nom du parent ou tuteur" id="ob-pn"><input id="ob-pn" value=${f.parentName} onChange=${(e) => set("parentName", e.target.value)} /></${Field}>
          <${Field} label="E-mail du parent" id="ob-pe"><input id="ob-pe" type="email" value=${f.parentEmail} onChange=${(e) => set("parentEmail", e.target.value)} /></${Field}></div>
        <p className="muted small">Pas de test de charge maximale avant 18 ans : les charges sont guidées par les répétitions en réserve.</p></${Card}>` : null}
    </div>` : null}
    ${step === 5 ? html`<div className="stack form"><h2>Validation</h2>
      <${Card}><dl className="dl"><dt>Programme</dt><dd>${prog ? prog.n : "—"}</dd><dt>Profil</dt><dd>${nivName(niveau)}</dd><dt>Sport</dt><dd>${f.sport || "—"}</dd></dl>
        <p className="muted small">À l'étape suivante : formule, durée, date de début et paiement${pendingCode ? " (ou ton code " + pendingCode + ")" : " ou code d'essai"}.</p></${Card}>
      <label className="chk"><input id="ob-consent" type="checkbox" checked=${f.consent} onChange=${(e) => set("consent", e.target.checked)} /><span>${window.IS_SITE ? CONSENT_SITE : "J'accepte que mes données d'entraînement et de santé soient enregistrées pour le suivi de mon programme par Antoine Limousi, et analysées par le coach IA (Claude, d'Anthropic) quand je l'utilise. Je peux retirer mon accord et demander leur suppression à tout moment. Je sais que ces conseils ne remplacent pas un avis médical."}</span></label>
      ${minor ? html`<label className="chk"><input id="ob-parent" type="checkbox" checked=${f.parentOk} onChange=${(e) => set("parentOk", e.target.checked)} /><span>Je suis ${f.parentName || "le parent ou tuteur légal"} et j'autorise l'inscription de ${f.name || "mon enfant"} ainsi que le traitement de ses données d'entraînement et de santé pour son suivi.</span></label>` : null}
    </div>` : null}
    ${step > 0 ? html`<div className="navbtns">
      <${Btn} kind="quiet" onClick=${() => setStep(step - 1)}>Retour</${Btn}>
      ${step < 5 ? html`<${Btn} onClick=${() => setStep(step + 1)} disabled=${!can()}>Continuer</${Btn}>` : html`<${Btn} onClick=${submit} disabled=${!can() || busy}>"Continuer vers mon accès"</${Btn}>`}
    </div>` : null}
  </div>`;
}
