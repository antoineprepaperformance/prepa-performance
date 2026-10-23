/* ===== Espace coach ===== */
const COACH_NAV = [
  { id: "dash", n: "Tableau de bord" }, { id: "clients", n: "Clients" }, { id: "programmes", n: "Programmes" },
  { id: "exos", n: "Exercices" }, { id: "codes", n: "Codes & essais" }, { id: "reglages", n: "Offres & réglages" },
];

function rowInfo(row, lib, today, settings) {
  const p = row.profile || {}, plan = row.plan, sum = p.sum || {};
  const req = p.request || {};
  const pid = plan ? plan.programId : req.programId;
  const prog = progOf(pid, lib);
  const ps = plan && plan.status !== "pending" ? planState(plan, today) : null;
  const alerts = [];
  let status = { tone: "muted", n: "—" };
  if (!plan || plan.status === "pending") { status = { tone: "gold", n: p.access && p.access.lastOrder ? "Commande en cours" : "Sans accès" }; if ((req.programId || p.manual) && !(p.access && p.access.lastOrder) && !window.IS_SITE) alerts.push({ tone: "gold", n: "Nouvelle demande à valider", k: "plan" }); }
  else if (plan.status === "archived") status = { tone: "muted", n: "Archivé" };
  else if (ps && ps.phase === "avant") status = { tone: "muted", n: "Démarre le " + fmtD(plan.start) };
  else if (ps && ps.phase === "en_cours") status = { tone: "ok", n: "Semaine " + ps.week + "/" + ps.weeks };
  else if (ps && ps.phase === "fini") status = { tone: "muted", n: "Terminé" };
  const lite = plan && plan.offer === "lite" && plan.status === "active";
  const lo0 = p.access && p.access.lastOrder;
  const liteOk = lite && Date.now() < liteEndMs(plan, lo0 && lo0.id ? { orders: { [lo0.id]: lo0 } } : null);
  if (lite) status = liteOk ? { tone: "ok", n: (ps && ps.phase === "en_cours" ? "S" + ps.week + "/" + ps.weeks + " · " : "") + "Lite jusqu'au " + fmtD(liteEnd(plan)) } : { tone: "muted", n: "Lite terminé" };
  if (p.screeningFlag && (!plan || plan.medicalHold !== false)) alerts.push({ tone: "warn", n: plan && plan.medicalHold ? "Avis médical à recevoir (séances en Reprise)" : "Questionnaire santé : avis médical", k: "plan" });
  const lo = p.access && p.access.lastOrder;
  const recentAuto = lo && lo.kind === "paiement" && payMode(settings) === "auto" && Date.now() - new Date(lo.at).getTime() < 15 * 60 * 1000;
  if (lo && lo.status === "en_attente" && !recentAuto && !(plan && plan.source && plan.source.orderId === lo.id)) alerts.push({ tone: "gold", n: lo.kind === "code" ? "Code " + (lo.code || "") + " à activer" : lo.kind === "paiement" ? "Paiement Stripe à vérifier · " + eur2(lo.price || 0) : "Commande à encaisser · " + eur2(lo.price || 0), k: "plan" });
  if (lo && lo.withdrawal && !lo.withdrawal.refundedAt) alerts.push({ tone: "bad", n: "Rétractation : rembourser " + eur2(lo.withdrawal.refund || 0), k: "plan" });
  if (lo && lo.cancel && lo.cancel.stripe !== "ok" && !lo.cancel.doneAt) alerts.push({ tone: "bad", n: "Résiliation : arrêter l'abonnement dans Stripe", k: "plan" });
  if (lo && lo.cancel && lo.cancel.refund > 0 && !lo.cancel.refundedAt) alerts.push({ tone: "bad", n: "Résiliation : rembourser " + eur2(lo.cancel.refund), k: "plan" });
  if (lite && liteNoticeDue(plan)) alerts.push({ tone: "warn", n: "Reconduction annuelle le " + fmtD(isoOf(new Date(plan.untilMs))) + " : envoyer l'information au client", k: "plan" });
  if (plan && plan.source && ["code", "paiement"].includes(plan.source.kind) && !plan.reviewedAt && plan.status === "active") alerts.push({ tone: "gold", n: "Nouvel accès (" + (plan.source.kind === "code" ? "code" : "paiement") + ") : vérifier le plan", k: "plan" });
  if ((sum.lastPain || 0) >= 4) alerts.push({ tone: "bad", n: "Douleur " + sum.lastPain + "/10", k: "seances" });
  if (sum.aiAlert) alerts.push({ tone: "bad", n: "Alerte du coach IA", k: "ia" });
  if ((sum.videoPending || 0) > 0) alerts.push({ tone: "gold", n: plural(sum.videoPending, "vidéo", "vidéos") + " à corriger", k: "videos" });
  if ((sum.aiPending || 0) > 0 && !sum.aiAlert) alerts.push({ tone: "gold", n: plural(sum.aiPending, "ajustement IA", "ajustements IA") + " à vérifier", k: "ia" });
  else if ((sum.aiPending || 0) > 1 && sum.aiAlert) alerts.push({ tone: "gold", n: plural(sum.aiPending - 1, "autre point IA", "autres points IA") + " à vérifier", k: "ia" });
  let adherence = null, weekDone = 0, weekPlanned = 0;
  if (ps && prog && plan.status !== "archived") {
    if (ps.phase === "en_cours") {
      const sinceStart = diffDays(plan.start, today);
      const last = sum.lastLogAt ? diffDays(sum.lastLogAt, today) : sinceStart;
      if (last >= 7) alerts.push({ tone: "warn", n: "Aucune séance depuis " + last + " j", k: "seances" });
      const left = diffDays(today, ps.end);
      if (left <= 7 && !lite) alerts.push({ tone: "gold", n: "Fin dans " + Math.max(0, left) + " j : proposer la suite", k: "plan" });
      weekPlanned = plannedCount(prog, plan, ps.week, lib);
      weekDone = (sum.weeksDone && sum.weeksDone[ps.week]) || 0;
      if (ps.week > 1) {
        let pl = 0, dn = 0;
        for (let w = 1; w < ps.week; w++) { const n = plannedCount(prog, plan, w, lib); pl += n; dn += Math.min(n, (sum.weeksDone && sum.weeksDone[w]) || 0); }
        adherence = pl ? dn / pl : null;
        if (adherence !== null && adherence < 0.6) alerts.push({ tone: "warn", n: "Régularité faible (" + Math.round(adherence * 100) + " %)", k: "vue" });
        if ((sum.lastCheckinW || 0) < ps.week - 1 && ps.day >= 2 && !lite) alerts.push({ tone: "muted", n: "Bilan S" + (ps.week - 1) + " non reçu : relancer", k: "bilans" });
      }
    }
    if (ps.phase === "fini" && !lite) alerts.push({ tone: "muted", n: "Programme terminé : renouveler ou archiver", k: "plan" });
  }
  if (sum.lastCheckinW && !lite && !(row.replies && row.replies["w" + sum.lastCheckinW])) alerts.push({ tone: "gold", n: "Bilan S" + sum.lastCheckinW + " à lire" + (sum.lastQuestion ? " · question" : ""), k: "bilans" });
  const price = plan && plan.status === "active" ? (lite ? litePrice(settings, (plan.lite && plan.lite.period) || "mois") : offerPrice(settings, plan.offer, plan.weeks)) : null;
  /* revenu mensuel moyen : prix ramené à 4 semaines (Lite annuel : prix / 12 ; accès offert : 0) */
  const mrr = !price ? 0 : lite ? (plan.lite && plan.lite.mode === "code" ? 0 : liteOk ? (plan.lite && plan.lite.period === "an" ? price / 12 : price) : 0) : price / (plan.weeks / 4);
  return { p, plan, prog, ps, sum, alerts, status, adherence, weekDone, weekPlanned, price, mrr, lite, liteOk };
}

function CoachApp({ db, settings, lib, exo, dl }) {
  const [view, setView] = useState("dash");
  const [sel, setSel] = useState(null);
  const [progSel, setProgSel] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [preview, setPreview] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const clients = useCol(db, "clients");
  const plans = useCol(db, "plans");
  const replies = useCol(db, "replies");
  const notes = useCol(db, "coachnotes");
  const codes = useCol(db, "codes");
  const today = todayISO();
  const realIds = Object.keys(clients.items);
  const [showDemo, setShowDemo] = useState(null);
  const demo = useMemo(() => demoWorld(), []);
  const demoOn = showDemo === null ? realIds.length === 0 : showDemo;
  const rows = useMemo(() => {
    const r = realIds.map((cid) => ({ cid, profile: clients.items[cid], plan: plans.items[cid] || null, replies: replies.items[cid] || {}, demo: false }));
    if (demoOn) Object.values(demo).forEach((d) => r.push({ cid: d.cid, profile: d.profile, plan: d.plan, replies: d.replies, demo: true }));
    return r.map((x) => ({ ...x, info: rowInfo(x, lib, today, settings) }));
  }, [clients.items, plans.items, replies.items, demoOn, lib, today, settings]);
  useAutoActivate(db, rows, codes);
  useLiteSync(db, rows);
  const go = (v) => { setView(v); setSel(null); setProgSel(null); setEditDoc(null); try { window.scrollTo(0, 0); } catch (e) {} };
  const openClient = (cid, tab) => { setSel({ cid, tab: tab || "vue" }); setView("client"); try { window.scrollTo(0, 0); } catch (e) {} };

  const previewSrc = useMemo(() => (preview ? memSource(demo[preview === true ? "demo_lucas" : preview], "demo") : null), [preview]);
  if (preview && previewSrc) {
    return html`<${ClientApp} key=${String(preview)} src=${previewSrc} settings=${settings} lib=${lib} exo=${exo} db=${null} demo=${true} onExit=${() => setPreview(false)}
      onSwitch=${() => setPreview(preview === "demo_sophie" ? "demo_lucas" : "demo_sophie")} />`;
  }
  const selRow = sel && rows.find((r) => r.cid === sel.cid);
  return html`<div className="coach">
    <aside className="side">
      <${Brand} sub="Espace coach" />
      <nav className="side-nav" aria-label="Navigation coach">${COACH_NAV.map((n) => html`<button key=${n.id} type="button" className=${view === n.id || (view === "client" && n.id === "clients") || (["prog", "edit"].includes(view) && n.id === "programmes") ? "on" : ""} onClick=${() => go(n.id)}>${n.n}</button>`)}</nav>
      <div className="side-f"><${Btn} kind="ghost" small onClick=${() => setPreview(true)}>Aperçu côté client</${Btn}>${window.IS_SITE ? html`<div className="side-out"><${SignOutLink} /></div>` : null}</div>
    </aside>
    <main className="c-content">
      ${!db ? html`<div className="alert warn"><div><b>Enregistrement indisponible ici</b><p>Ouvre l'application depuis claude.ai pour enregistrer tes clients et tes programmes. Les exemples restent consultables.</p></div></div>` : null}
      ${view === "dash" ? html`<${Dashboard} rows=${rows} demoOn=${demoOn} realCount=${realIds.length} setShowDemo=${setShowDemo} openClient=${openClient}
          onAdd=${() => setAddOpen(true)} onImport=${() => setImportOpen(true)} onPreview=${() => setPreview(true)} settings=${settings} db=${db} />` : null}
      ${view === "clients" ? html`<${ClientsList} rows=${rows} openClient=${openClient} onAdd=${() => setAddOpen(true)} onImport=${() => setImportOpen(true)} />` : null}
      ${view === "client" && selRow ? html`<${ClientDetail} key=${selRow.cid} row=${selRow} demoData=${selRow.demo ? demo[selRow.cid] : null} db=${db} lib=${lib} exo=${exo}
          settings=${settings} note=${notes.items[selRow.cid]} tab0=${sel.tab} onBack=${() => go("clients")} />` : null}
      ${view === "client" && !selRow ? html`<${Empty} title="Client introuvable"><${Btn} onClick=${() => go("clients")}>Retour aux clients</${Btn}></${Empty}>` : null}
      ${view === "programmes" ? html`<${Library} lib=${lib} db=${db} open=${(p) => { setProgSel(p); setView("prog"); }} edit=${(d) => { setEditDoc(d); setView("edit"); }} />` : null}
      ${view === "prog" && progSel ? html`<${ProgramViewer} prog=${progSel} lib=${lib} exo=${exo} db=${db} onBack=${() => go("programmes")} edit=${(d) => { setEditDoc(d); setView("edit"); }} />` : null}
      ${view === "edit" && editDoc ? html`<${DocEditor} doc=${editDoc} db=${db} lib=${lib} exo=${exo} onDone=${() => go("programmes")} />` : null}
      ${view === "exos" ? html`<${ExercisesView} exo=${exo} db=${db} />` : null}
      ${view === "codes" ? html`<${CodesView} db=${db} codes=${codes.items} rows=${rows} lib=${lib} />` : null}
      ${view === "reglages" ? html`<${SettingsView} settings=${settings} db=${db} dl=${dl} rows=${rows} />` : null}
    </main>
    <${Modal} open=${addOpen} title="Ajouter un client" onClose=${() => setAddOpen(false)}>${addOpen ? html`<${AddClient} db=${db} lib=${lib} settings=${settings} onDone=${(cid) => { setAddOpen(false); if (cid) openClient(cid, "plan"); }} />` : null}</${Modal}>
    <${Modal} open=${importOpen} title="Importer un envoi client" onClose=${() => setImportOpen(false)}>${importOpen ? html`<${ImportBox} db=${db} onDone=${(cid) => { setImportOpen(false); if (cid) openClient(cid, "vue"); }} />` : null}</${Modal}>
  </div>`;
}

/* résiliations envoyées depuis le formulaire public du site */
function PublicCancels({ db, rows, openClient }) {
  const toast = useToast();
  const [list, setList] = useState([]);
  useEffect(() => {
    let u = null;
    try { u = db.collection("resiliations").onSnapshot((s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => !x.done).sort((a, b) => String(a.at).localeCompare(String(b.at)))), () => {}); } catch (e) {}
    return () => { try { u && u(); } catch (e) {} };
  }, [db]);
  if (!list.length) return null;
  const byMail = (m) => rows.find((r) => !r.demo && String((r.profile && r.profile.email) || "").toLowerCase() === m);
  const done = async (x) => { try { await db.doc("resiliations/" + x.id).update({ done: true, doneAt: nowISO() }); toast("Résiliation traitée.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  return html`<div className="alert bad"><div><b>${plural(list.length, "résiliation reçue", "résiliations reçues")} depuis le site</b>
    ${list.map((x) => { const r = byMail(x.email); return html`<p key=${x.id}>${new Date(x.at).toLocaleString("fr-FR")} · ${x.name} · ${x.email}${x.ref ? " · commande " + x.ref : ""}${x.msg ? " · « " + x.msg + " »" : ""}
      ${r ? html` · <button type="button" className="linkbtn" onClick=${() => openClient(r.cid)}>Ouvrir la fiche</button>` : " · compte introuvable"} · <button type="button" className="linkbtn" onClick=${() => done(x)}>Traitée</button></p>`; })}
    <p className="small">À faire : arrêter l'abonnement dans Stripe (fin de période), puis confirmer par e-mail au client la date de fin et l'arrêt des prélèvements.</p></div></div>`;
}
/* ---------- Tableau de bord ---------- */
function Dashboard({ rows, demoOn, realCount, setShowDemo, openClient, onAdd, onImport, onPreview, settings, db }) {
  const active = rows.filter((r) => r.info.plan && r.info.plan.status === "active" && (r.info.lite ? r.info.liteOk : r.info.ps && r.info.ps.phase !== "fini"));
  const alerts = rows.flatMap((r) => r.info.alerts.map((a) => ({ ...a, r })));
  const order = { bad: 0, warn: 1, gold: 2, muted: 3 };
  alerts.sort((a, b) => order[a.tone] - order[b.tone]);
  const wkDone = active.reduce((s, r) => s + Math.min(r.info.weekDone, r.info.weekPlanned), 0), wkPl = active.reduce((s, r) => s + r.info.weekPlanned, 0);
  const mrr = active.reduce((s, r) => s + (r.info.mrr || 0), 0);
  const now = new Date();
  const name = (settings && settings.coach && settings.coach.name) || COACH_NAME_DEFAULT;
  return html`<div className="stack">
    <header className="page-h"><div><div className="eyebrow">${JOURS[now.getDay()]} ${fmtD(todayISO())}</div><h1>Bonjour ${name}</h1></div>
      <div className="btnrow"><${Btn} onClick=${onAdd}>Ajouter un client</${Btn}>${window.IS_SITE ? null : html`<${Btn} kind="ghost" onClick=${onImport}>Importer un envoi</${Btn}>`}</div></header>
    ${window.IS_SITE && db ? html`<${PublicCancels} db=${db} rows=${rows} openClient=${openClient} />` : null}
    ${legalMissing(settings).length ? html`<div className="alert warn"><div><b>Informations légales à compléter</b><p>${legalMissing(settings).join(", ")} : elles s'affichent dans tes conditions de vente et tes mentions légales.</p></div></div>` : null}
    ${demoOn ? html`<div className="alert gold"><div><b>${realCount ? "Exemples affichés" : "Exemples affichés en attendant tes premiers clients"}</b><p>Les clients marqués EXEMPLE ne sont pas enregistrés : ils montrent ce que tu verras.</p></div><${Btn} small kind="ghost" onClick=${() => setShowDemo(false)}>Masquer</${Btn}></div>`
      : html`<div className="right"><button type="button" className="linkbtn" onClick=${() => setShowDemo(true)}>Afficher les exemples</button></div>`}
    <div className="stats4">
      <${Stat} n=${active.length} label="Clients actifs" />
      <${Stat} n=${alerts.filter((a) => a.tone !== "muted").length} label="À traiter" tone=${alerts.some((a) => a.tone === "bad") ? "bad" : ""} />
      <${Stat} n=${wkPl ? wkDone + "/" + wkPl : "—"} label="Séances cette semaine" sub=${wkPl ? Math.round((wkDone / wkPl) * 100) + " % réalisées" : null} />
      <${Stat} n=${eur(mrr)} label="Revenu mensuel estimé" sub="formules actives" />
    </div>
    <${Card} title="À traiter" sub=${alerts.length ? plural(alerts.length, "point") : "Rien d'urgent"}>
      ${alerts.length ? html`<ul className="alerts">${alerts.slice(0, 14).map((a, i) => html`<li key=${i}><button type="button" onClick=${() => openClient(a.r.cid, ["plan", "bilans", "seances", "ia", "videos", "sante"].includes(a.k) ? a.k : "vue")}>
        <${Pill} tone=${a.tone}>${a.n}</${Pill}><b>${a.r.profile.name || "Client"}</b><span className="muted small">${a.r.info.prog ? a.r.info.prog.n : ""}</span></button></li>`)}</ul>`
        : html`<p className="muted small">Tous les bilans ont une réponse et aucun client n'a d'alerte.</p>`}
    </${Card}>
    <${Card} title="Clients" action=${html`<span className="muted small">${plural(rows.length, "client")}</span>`}><${ClientTable} rows=${rows} openClient=${openClient} /></${Card}>
    ${realCount === 0 && window.IS_SITE ? html`<${Card} title="Démarrer avec tes clients" sub="Ton site est prêt à recevoir des inscriptions"><${SiteAccessHowto} onPreview=${onPreview} /></${Card}>` : null}
    ${realCount === 0 && !window.IS_SITE ? html`<${Card} title="Démarrer avec tes clients" sub="Deux façons de donner accès à l'application">
      <ol className="howto">
        <li><b>Synchronisation automatique (conseillée).</b> Dans le menu Partager de cette page, invite le client par e-mail avec le droit de modification. Il crée un compte Claude gratuit, s'inscrit dans l'application et ses séances arrivent ici en direct.</li>
        <li><b>Sans compte.</b> Crée le client avec « Ajouter un client », copie son code d'accès et envoie-le-lui avec le lien de la page. Ses données restent sur son téléphone : il t'envoie ses données (un texte à copier) et tu les importes avec « Importer un envoi ».</li>
        <li>Pour voir l'expérience du client, ouvre l'<button type="button" className="linkbtn" onClick=${onPreview}>aperçu côté client</button>.</li>
      </ol></${Card}>` : null}
  </div>`;
}
function ClientTable({ rows, openClient }) {
  if (!rows.length) return html`<p className="muted small">Aucun client pour l'instant.</p>`;
  const sorted = rows.slice().sort((a, b) => (b.info.alerts.length - a.info.alerts.length) || String(a.profile.name).localeCompare(String(b.profile.name)));
  return html`<div className="tscroll"><table className="ctable">
    <thead><tr><th>Client</th><th>Programme</th><th>Avancement</th><th>Régularité</th><th>Dernière séance</th><th>Statut</th></tr></thead>
    <tbody>${sorted.map((r) => {
      const i = r.info;
      return html`<tr key=${r.cid} onClick=${() => openClient(r.cid)} tabIndex="0" onKeyDown=${(e) => e.key === "Enter" && openClient(r.cid)}>
        <th><span className="who"><${Avatar} profile=${r.profile} size=${30} /><span><b>${r.profile.name || "Client"}</b><span className="chips">${r.demo ? html`<${Pill}>EXEMPLE</${Pill}>` : null}${r.profile.local ? html`<${Pill}>sans compte</${Pill}>` : null}</span><small>${sportLabel(r.profile) || r.profile.sport || ""}</small></span></span></th>
        <td>${i.prog ? i.prog.n : "—"}<small>${i.plan ? offerName(i.plan.offer) + " · " + planDur(i.plan) : (i.p.request ? "demandé : " + (i.p.request.offer === "lite" ? "Lite" : durName(i.p.request.weeks)) : "")}</small></td>
        <td>${i.ps && i.ps.phase === "en_cours" ? html`<div className="mini"><${Bar} value=${i.ps.week / i.ps.weeks} /><small>S${i.ps.week}/${i.ps.weeks} · ${i.weekDone}/${i.weekPlanned} cette semaine</small></div>` : "—"}</td>
        <td>${i.adherence === null ? "—" : html`<span className=${i.adherence >= 0.8 ? "ok-t" : i.adherence >= 0.6 ? "warn-t" : "bad-t"}>${Math.round(i.adherence * 100)} %</span>`}</td>
        <td>${i.sum.lastLogAt ? fmtD(i.sum.lastLogAt) : "—"}</td>
        <td><${Pill} tone=${i.status.tone}>${i.status.n}</${Pill}>${i.alerts.filter((a) => a.tone === "bad" || a.tone === "warn").length ? html` <${Pill} tone="bad">${i.alerts.filter((a) => a.tone === "bad" || a.tone === "warn").length} alerte${i.alerts.filter((a) => a.tone === "bad" || a.tone === "warn").length > 1 ? "s" : ""}</${Pill}>` : null}</td>
      </tr>`;
    })}</tbody></table></div>`;
}
function ClientsList({ rows, openClient, onAdd, onImport }) {
  const [f, setF] = useState("tous");
  const [q, setQ] = useState("");
  const filt = rows.filter((r) => {
    const i = r.info;
    if (q && !String(r.profile.name || "").toLowerCase().includes(q.toLowerCase())) return false;
    if (f === "actifs") return i.plan && i.plan.status === "active" && i.ps && i.ps.phase !== "fini";
    if (f === "attente") return !i.plan || i.plan.status === "pending";
    if (f === "termines") return i.plan && (i.plan.status === "archived" || (i.ps && i.ps.phase === "fini"));
    return true;
  });
  return html`<div className="stack">
    <header className="page-h"><div><h1>Clients</h1></div><div className="btnrow"><${Btn} onClick=${onAdd}>Ajouter un client</${Btn}>${window.IS_SITE ? null : html`<${Btn} kind="ghost" onClick=${onImport}>Importer un envoi</${Btn}>`}</div></header>
    <div className="filters"><${Seg} options=${[{ v: "tous", n: "Tous" }, { v: "actifs", n: "Actifs" }, { v: "attente", n: "À valider" }, { v: "termines", n: "Terminés" }]} value=${f} onChange=${setF} />
      <input id="q-clients" className="search" placeholder="Rechercher un client" value=${q} onChange=${(e) => setQ(e.target.value)} /></div>
    <${Card}><${ClientTable} rows=${filt} openClient=${openClient} /></${Card}>
  </div>`;
}

/* ---------- Fiche client ---------- */
function ClientDetail({ row, demoData, db, lib, exo, settings, note, tab0, onBack }) {
  const src = useMemo(() => (demoData ? memSource(demoData, "demo") : db ? dbSource(db, row.cid) : null), [row.cid]);
  useEffect(() => () => { src && src.close && src.close(); }, [src]);
  const data = useSource(src);
  const [tab, setTab] = useState(tab0 || "vue");
  const today = todayISO();
  const plan = data.plan && data.plan.status !== "pending" ? data.plan : null;
  const prog = sportProg(progOf(plan ? plan.programId : (data.profile && data.profile.request && data.profile.request.programId), lib), data.profile);
  const stats = useMemo(() => computeStats(data, plan, prog, lib, today), [data, plan, prog, lib, today]);
  const p = data.profile || row.profile || {};
  const info = rowInfo({ profile: p, plan: data.plan, replies: data.replies }, lib, today, settings);
  const tabs = [{ v: "vue", n: "Vue d'ensemble" }, { v: "bilans", n: "Bilans" }, { v: "seances", n: "Séances" }, { v: "terrain", n: "Sport & terrain" }, { v: "tests", n: "Tests" }, { v: "videos", n: "Vidéos" + ((info.sum.videoPending || 0) ? " (" + info.sum.videoPending + ")" : "") }, { v: "nutrition", n: "Nutrition" }, { v: "sante", n: "Santé" }, { v: "ia", n: "Coach IA" + ((info.sum.aiPending || 0) ? " (" + info.sum.aiPending + ")" : "") }, { v: "plan", n: "Plan" }, { v: "notes", n: "Notes" }]
    .filter((t) => !(t.v === "ia" && window.IS_SITE && !row.demo && !Object.values(data.ai || {}).some((a) => a && a.by !== "coach")));
  if (!src) return html`<${Empty} title="Données indisponibles" text="Ouvre l'application depuis claude.ai." />`;
  return html`<div className="stack">
    <button type="button" className="linkbtn back-l" onClick=${onBack}>‹ Tous les clients</button>
    <header className="page-h"><div><div className="eyebrow">${prog ? prog.n : "Sans programme"}${plan ? " · " + offerName(plan.offer) + " · " + planDur(plan) : ""}</div>
      <h1 className="who"><${Avatar} profile=${p} photo=${data.media && data.media.photo && data.media.photo.data} size=${48} /><span>${p.name || "Client"}</span>${row.demo ? html`<${Pill}>EXEMPLE</${Pill}>` : null}</h1>
      <div className="chips"><${Pill} tone=${info.status.tone}>${info.status.n}</${Pill}>${info.alerts.map((a, i) => html`<${Pill} key=${i} tone=${a.tone}>${a.n}</${Pill}>`)}</div></div>
      <div className="contactcol">${p.email ? html`<div className="contact"><span>${p.email}</span><${CopyBtn} text=${p.email} /></div>` : null}${p.phone ? html`<div className="contact"><span>${p.phone}</span><${CopyBtn} text=${p.phone} /></div>` : null}</div></header>
    <div className="tabs-scroll"><${Seg} options=${tabs} value=${tab} onChange=${setTab} /></div>
    ${!data.ready ? html`<p className="muted">Chargement…</p>` : null}
    ${tab === "vue" ? html`<${ClientOverview} data=${data} plan=${plan} prog=${prog} stats=${stats} info=${info} lib=${lib} />` : null}
    ${tab === "bilans" ? html`<${CoachBilans} data=${data} src=${src} plan=${plan} prog=${prog} lib=${lib} settings=${settings} />` : null}
    ${tab === "nutrition" ? html`<${CoachNutrition} data=${data} src=${src} />` : null}
    ${tab === "ia" ? html`<${CoachAI} data=${data} src=${src} plan=${data.plan} />` : null}
    ${tab === "terrain" ? html`<${CoachTerrain} data=${data} src=${src} plan=${plan} prog=${prog} />` : null}
    ${tab === "seances" ? html`<${CoachLogs} data=${data} src=${src} plan=${plan} prog=${prog} exo=${exo} />` : null}
    ${tab === "tests" ? html`<${CoachTests} data=${data} src=${src} plan=${plan} prog=${prog} />` : null}
    ${tab === "videos" ? html`<${CoachVideos} data=${data} src=${src} />` : null}
    ${tab === "sante" ? html`<${CoachSante} data=${data} />` : null}
    ${tab === "plan" ? html`<${PlanEditor} data=${data} src=${src} lib=${lib} settings=${settings} cid=${row.cid} exo=${exo} demo=${row.demo} />` : null}
    ${tab === "notes" ? html`<${CoachNotes} db=${db} cid=${row.cid} note=${note} demo=${row.demo} name=${p.name} onDeleted=${onBack} />` : null}
  </div>`;
}
function ClientOverview({ data, plan, prog, stats, info, lib }) {
  if (!plan || !prog) return html`<${Card} title="Pas encore de programme actif"><p className="small">Valide la demande dans l'onglet Plan pour activer le programme.</p>
    ${data.profile && data.profile.request ? html`<dl className="dl"><dt>Demande</dt><dd>${progOf(data.profile.request.programId, {}) ? progOf(data.profile.request.programId, {}).n : "—"}</dd><dt>Formule</dt><dd>${offerName(data.profile.request.offer)} · ${durOf({ offer: data.profile.request.offer, weeks: data.profile.request.weeks, period: data.profile.request.period, mode: data.profile.request.lmode })}</dd><dt>Départ souhaité</dt><dd>${fmtDY(data.profile.request.start)}</dd>
      <dt>Questionnaire santé</dt><dd>${data.profile.screeningFlag ? "Au moins un « oui » : avis médical à demander" : "Rien à signaler"}</dd></dl>` : null}</${Card}>`;
  const ps = stats.ps;
  const upto = ps.phase === "fini" ? plan.weeks : Math.max(1, ps.week);
  const adh = Array.from({ length: upto }, (_, i) => ({ x: "S" + (i + 1), y: stats.doneByWeek[i + 1] || 0, note: "prévu " + (stats.plannedByWeek[i + 1] || 0), muted: i + 1 === ps.week && ps.phase === "en_cours" }));
  const load = Array.from({ length: upto }, (_, i) => ({ x: "S" + (i + 1), y: stats.loadByWeek[i + 1] || 0, muted: i + 1 === ps.week && ps.phase === "en_cours" }));
  const lastC = stats.checkins[stats.checkins.length - 1];
  return html`<div className="stack">
    <div className="stats4">
      <${Stat} n=${stats.adherence === null ? "—" : Math.round(stats.adherence * 100) + " %"} label="Régularité" sub="semaines terminées" tone=${stats.adherence !== null && stats.adherence < 0.6 ? "bad" : ""} />
      <${Stat} n=${stats.logs.filter((l) => l.kind !== "presentiel").length} label="Séances réalisées" sub=${ps.phase === "en_cours" ? stats.doneThisWeek + "/" + stats.plannedThisWeek + " cette semaine" : null} />
      <${Stat} n=${ps.phase === "en_cours" ? fmtN(stats.loadByWeek[ps.week] || 0, 0) : "—"} label="Charge cette semaine" sub="effort × minutes" />
      <${Stat} n=${lastC ? "S" + lastC.w : "—"} label="Dernier bilan" sub=${lastC ? fmtD(lastC.at) : null} />
    </div>
    <div className="grid2"><${Card} title="Carte athlète" sub="Ce que voit le client"><${CardEvo} data=${data} plan=${plan} prog=${prog} lib=${lib} /></${Card}>
      <${Badges} data=${data} plan=${plan} prog=${prog} lib=${lib} /></div>
    <div className="grid2">
      <${Card} title="Séances par semaine"><${BarChart} data=${adh} unit="séances" /></${Card}>
      <${Card} title="Charge d'entraînement" sub="Une hausse brutale d'une semaine à l'autre augmente le risque de blessure"><${BarChart} data=${load} unit="UA" /></${Card}>
      ${stats.weights.length ? html`<${Card} title="Poids"><${LineChart} points=${stats.weights} unit="kg" /></${Card}>` : null}
      ${stats.waists.length ? html`<${Card} title="Tour de taille"><${LineChart} points=${stats.waists} unit="cm" /></${Card}>` : null}
      ${stats.liftSeries.map((s) => html`<${Card} key=${s.e} title=${(EXB[s.e] ? EXB[s.e].n : s.e) + " — max. estimé"}><${LineChart} points=${s.points} unit="kg" /></${Card}>`)}
    </div>
    <${Card} title="Tests"><${TestsTable} prog=${prog} plan=${plan} data=${data} /></${Card}>
    ${lastC ? html`<${Card} title=${"Dernier bilan — semaine " + lastC.w}><${CheckinView} c=${lastC} /></${Card}>` : null}
  </div>`;
}
function CheckinView({ c }) {
  const sc = (k, n, inv) => c[k] !== undefined && c[k] !== null ? html`<div className="kv"><span>${n}</span><b className=${inv ? (c[k] >= 4 ? "bad-t" : "") : (c[k] <= 2 ? "warn-t" : "")}>${c[k]}/5</b></div>` : null;
  return html`<div className="ckv">
    <div className="kvs">${num(c.poids) !== null ? html`<div className="kv"><span>Poids</span><b>${fmtN(num(c.poids))} kg</b></div>` : null}
      ${num(c.taille) !== null ? html`<div className="kv"><span>Taille</span><b>${fmtN(num(c.taille))} cm</b></div>` : null}
      ${sc("sommeil", "Sommeil")}${sc("energie", "Énergie")}${sc("stress", "Stress", true)}${sc("courbatures", "Courbatures", true)}${sc("nutrition", "Nutrition")}
      ${c.douleur !== undefined && c.douleur !== null ? html`<div className="kv"><span>Douleur</span><b className=${c.douleur >= 4 ? "bad-t" : c.douleur >= 2 ? "warn-t" : ""}>${c.douleur}/10${c.zone ? " · " + c.zone : ""}</b></div>` : null}
      ${num(c.pas) !== null ? html`<div className="kv"><span>Pas / jour</span><b>${fmtN(num(c.pas), 0)}</b></div>` : null}</div>
    ${c.victoire ? html`<p><b>Réussite :</b> ${c.victoire}</p>` : null}${c.difficulte ? html`<p><b>Difficulté :</b> ${c.difficulte}</p>` : null}${c.question ? html`<p className="q"><b>Question :</b> ${c.question}</p>` : null}
  </div>`;
}
function CoachBilans({ data, src, plan, prog, lib, settings }) {
  const list = Object.values(data.checkins || {}).filter(Boolean).sort((a, b) => b.w - a.w);
  if (!list.length) return html`<${Empty} title="Aucun bilan reçu" text="Les bilans hebdomadaires du client apparaîtront ici." />`;
  return html`<div className="stack">${list.map((c) => html`<${BilanReply} key=${c.w} c=${c} reply=${data.replies["w" + c.w]} src=${src} data=${data} plan=${plan} prog=${prog} lib=${lib} settings=${settings} />`)}</div>`;
}
function BilanReply({ c, reply, src, data, plan, prog, lib, settings }) {
  const toast = useToast();
  const ai = useAI();
  const [t, setT] = useState(reply ? reply.text : "");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const iaRev = data ? chatMsgs(data).filter((m) => m.kind === "bilan" && m.w === c.w).slice(-1)[0] : null;
  const draft = async () => {
    setDrafting(true);
    try { const x = await draftReply({ ai, data, plan, prog, lib, c, settings }); setT(x); }
    catch (e) { const m = aiErr(e); if (m) toast(m, "warn"); } finally { setDrafting(false); }
  };
  useEffect(() => { setT(reply ? reply.text : ""); }, [reply && reply.text]);
  const send = async () => { setBusy(true); try { await src.setReply(c.w, t.trim()); toast("Réponse envoyée.", "ok"); } catch (e) { toast("Envoi impossible.", "bad"); } finally { setBusy(false); } };
  return html`<${Card} title=${"Semaine " + c.w} sub=${"Reçu le " + fmtD(c.at)} action=${reply ? html`<${Pill} tone="ok">Répondu</${Pill}>` : html`<${Pill} tone="gold">À lire</${Pill}>`}>
    <${CheckinView} c=${c} />
    ${iaRev ? html`<details><summary>Analyse déjà envoyée au client par le coach IA</summary><p className="small">${iaRev.t}</p>${iaRev.ev && iaRev.ev.length ? html`<div className="evs">${iaRev.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}</details>` : null}
    <${Field} label="Ta réponse" id=${"rep-" + c.w}><textarea id=${"rep-" + c.w} rows="3" value=${t} onChange=${(e) => setT(e.target.value)} placeholder="Félicite, ajuste, réponds à la question…"></textarea></${Field}>
    <div className="btnrow">${["Très bonne semaine, on continue comme ça.", "Allège les charges de 10 % cette semaine et surveille la douleur.", "Bravo pour ta régularité !"].map((q) => html`<button key=${q} type="button" className="chipbtn" onClick=${() => setT(t ? t + " " + q : q)}>${q}</button>`)}</div>
    <div className="actions"><${Btn} onClick=${send} disabled=${busy || !t.trim()}>${reply ? "Mettre à jour la réponse" : "Envoyer la réponse"}</${Btn}>
      ${ai.sample && data ? html`<${Btn} kind="ghost" onClick=${draft} disabled=${drafting}>${drafting ? "Rédaction…" : "✦ Rédiger avec l'IA"}</${Btn}>` : null}</div>
  </${Card}>`;
}
function CoachLogs({ data, src, plan, prog, exo }) {
  const toast = useToast();
  const logs = Object.values(data.logs || {}).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: todayISO(), title: "Séance en présentiel", rpe: 6, duree: 60, comment: "" });
  const add = async () => {
    const w = plan ? clamp(Math.floor(diffDays(plan.start, f.date) / 7) + 1, 1, plan.weeks) : 0;
    const key = "p_" + rid();
    try { await src.saveLog(key, { key, kind: "presentiel", w, date: f.date, title: f.title, rpe: f.rpe, duree: num(f.duree) || 0, load: f.rpe * (num(f.duree) || 0), comment: f.comment, items: [], douleur: 0 });
      toast("Séance ajoutée.", "ok"); setOpen(false); } catch (e) { toast("Ajout impossible.", "bad"); }
  };
  return html`<div className="stack">
    <div className="right"><${Btn} kind="ghost" small onClick=${() => setOpen(!open)}>${open ? "Fermer" : "Ajouter une séance en présentiel"}</${Btn}></div>
    ${open ? html`<${Card} title="Séance en présentiel"><div className="form">
      <div className="row2"><${Field} label="Date" id="pl-date"><input id="pl-date" type="date" value=${f.date} onChange=${(e) => setF({ ...f, date: e.target.value })} /></${Field}>
        <${Field} label="Durée (min)" id="pl-dur"><input id="pl-dur" inputMode="numeric" value=${f.duree} onChange=${(e) => setF({ ...f, duree: e.target.value })} /></${Field}></div>
      <${Field} label="Intitulé" id="pl-t"><input id="pl-t" value=${f.title} onChange=${(e) => setF({ ...f, title: e.target.value })} /></${Field}>
      <${Field} label="Effort ressenti"><${Scale} id="pl-rpe" min=${0} max=${10} value=${f.rpe} onChange=${(v) => setF({ ...f, rpe: v })} /></${Field}>
      <${Field} label="Notes" id="pl-c"><textarea id="pl-c" rows="2" value=${f.comment} onChange=${(e) => setF({ ...f, comment: e.target.value })}></textarea></${Field}>
      <${Btn} onClick=${add}>Ajouter</${Btn}></div></${Card}>` : null}
    ${(() => { const xs = [...Object.values(data.libres || {}), ...Object.values(data.activites || {}).map((a) => ({ ...a, n: a.n || "Activité importée", act: true }))].filter(Boolean).sort((a, b) => String(b.d).localeCompare(String(a.d)));
      return xs.length ? html`<${Card} title="Séances en plus et activités" sub="Flash, récup, montre ou fichier importé : comptées dans la charge de la semaine">${xs.slice(0, 12).map((x) => html`<div key=${x.id} className="hist"><div className="hist-h"><b>${x.n}</b><span className="muted small">${fmtD(x.d)}</span></div>
        <span className="muted small">${x.act ? (x.type || "activité") + (x.dist ? " · " + fmtN(x.dist, 1) + " km" : "") + (x.fcMoy ? " · FC moy. " + x.fcMoy : "") + " · " : (x.kind === "flash" ? "flash · " : x.kind === "terrain" ? "terrain · " : "récup · ")}${x.duree || 0} min${x.rpe !== undefined && x.rpe !== null ? " · effort " + x.rpe + "/10" : ""}${x.load ? " · " + fmtN(x.load, 0) + " UA" : ""}</span></div>`)}</${Card}>` : null; })()}
    ${logs.length ? logs.map((l) => html`<${Card} key=${l.key} title=${l.title || "Séance"} sub=${fmtDY(l.date) + " · semaine " + l.w + (l.kind === "presentiel" ? " · en présentiel" : "")}
      action=${html`<div className="chips">${l.rpe !== undefined ? html`<${Pill}>Effort ${l.rpe}/10</${Pill}>` : null}${l.duree ? html`<${Pill}>${l.duree} min</${Pill}>` : null}${l.douleur ? html`<${Pill} tone=${l.douleur >= 4 ? "bad" : "warn"}>Douleur ${l.douleur}/10${l.zone ? " · " + l.zone : ""}</${Pill}>` : null}</div>`}>
      ${(l.items || []).length ? html`<details><summary>${plural(l.items.length, "exercice")}</summary><ul className="loglist">${l.items.map((it, i) => {
        const ex = exOf(it.e, plan && plan.equipment, prog, exo);
        return html`<li key=${i}><b>${ex.n}</b> ${it.sets ? it.sets.map((s) => (s.kg ?? "—") + " kg × " + (s.reps ?? "—")).join(" · ") : it.done ? "fait" : "non fait"}</li>`;
      })}</ul></details>` : null}
      ${l.comment ? html`<p className="small"><b>Commentaire :</b> ${l.comment}</p>` : null}
    </${Card}>`) : html`<${Empty} title="Aucune séance enregistrée" />`}
  </div>`;
}
function CoachTests({ data, src, plan, prog }) {
  const [open, setOpen] = useState(false);
  if (!prog) return html`<${Empty} title="Pas de programme" text="Les tests dépendent du programme choisi." />`;
  return html`<div className="stack">
    <${Card} title="Résultats des tests" action=${html`<${Btn} small kind="ghost" onClick=${() => setOpen(true)}>Saisir des tests</${Btn}>`}><${TestsTable} prog=${prog} plan=${plan || { weeks: 12 }} data=${data} /></${Card}>
    ${prog.tests.map((tid) => {
      const t = TESTS[tid]; if (!t || t.type === "pair") return null;
      const pts = testPoints(plan || { weeks: 12 }).filter((p) => data.tests["t" + p] && testValue(tid, data.tests["t" + p].values[tid]) !== null)
        .map((p) => ({ x: p === 0 ? "Départ" : "S" + p, y: testValue(tid, data.tests["t" + p].values[tid]) }));
      return pts.length >= 2 ? html`<${Card} key=${tid} title=${t.n}><${LineChart} points=${pts} unit=${t.u} digits=${2} /></${Card}>` : null;
    })}
    <${Modal} open=${open} title="Saisir des tests" onClose=${() => setOpen(false)}>${open ? html`<${TestsForm} prog=${prog} plan=${plan || { weeks: 12 }} data=${data} src=${src} point=${0} onDone=${() => setOpen(false)} />` : null}</${Modal}>
  </div>`;
}
function CoachNotes({ db, cid, note, demo, name, onDeleted }) {
  const toast = useToast();
  const [t, setT] = useState(note ? note.text : "");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const erase = async () => {
    if (demo || !db) { toast("Les exemples ne sont pas enregistrés.", "warn"); return; }
    setBusy(true);
    try { await deleteClient(db, cid); toast("Données du client supprimées.", "ok"); onDeleted && onDeleted(); }
    catch (e) { toast("Suppression incomplète : réessaie.", "bad"); } finally { setBusy(false); }
  };
  useEffect(() => { setT(note ? note.text : ""); }, [note && note.text]);
  const save = async () => { if (demo || !db) { toast("Les exemples ne sont pas enregistrés.", "warn"); return; } try { await dbSet(db, "coachnotes/" + cid, { text: t, at: nowISO() }); toast("Notes enregistrées.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); } };
  return html`<${Card} title="Notes privées" sub="Visibles uniquement par toi">
    <textarea id="notes" rows="10" value=${t} onChange=${(e) => setT(e.target.value)} placeholder="Antécédents, objectifs, réglages de charges, paiements…"></textarea>
    <div className="actions"><${Btn} onClick=${save}>Enregistrer</${Btn}>${note ? html`<span className="muted small">Modifié le ${fmtD(note.at)}</span>` : null}</div></${Card}>
    <${Card} title="Supprimer ce client" sub="Droit à l'effacement : profil, séances, bilans, tests, plan, réponses et notes. Action définitive.">
      <${Field} label=${"Pour confirmer, tape SUPPRIMER"} id="del-c"><input id="del-c" value=${confirm} onChange=${(e) => setConfirm(e.target.value)} autoComplete="off" /></${Field}>
      <div className="actions"><${Btn} kind="danger" onClick=${erase} disabled=${busy || confirm.trim().toUpperCase() !== "SUPPRIMER"}>Supprimer définitivement${name ? " " + name : ""}</${Btn}></div></${Card}>`;
}

/* ---------- Plan d'un client ---------- */
function programOptions(lib) {
  const custom = Object.entries(lib || {}).filter(([, d]) => d.kind === "program").map(([id, d]) => ({ v: id, n: d.n + " (perso)" }));
  return [...PROGS.map((p) => ({ v: p.id, n: p.n })), ...custom];
}
function PlanEditor({ data, src, lib, settings, cid, exo, demo }) {
  const toast = useToast();
  const p = data.profile || {};
  const req = p.request || {};
  const init = () => data.plan ? clone(data.plan) : { programId: req.programId || "vitesse", offer: req.offer || "suivi", weeks: req.weeks || 12, start: req.start || nextMonday(), equipment: req.equipment || "salle", status: "pending", message: "", extra: [] };
  const [f, setF] = useState(init);
  useEffect(() => { setF(init()); }, [data.ready, data.plan && JSON.stringify(data.plan), JSON.stringify(req)]);
  const [addX, setAddX] = useState({ sid: "", w: 1 });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const prog = progOf(f.programId, lib);
  const sessions = Object.entries(lib || {}).filter(([, d]) => d.kind === "session");
  const maxWeeks = prog ? prog.blocks.length * 4 : 12;
  const isLite = f.offer === "lite";
  const untilISO = isLite ? (f.untilMs ? isoOf(new Date(f.untilMs - 1)) : isoOf(new Date(addPeriodMs(msOfISO(f.start || todayISO()), "mois") - 1))) : null;
  const setUntil = (iso) => setF((o) => ({ ...o, untilMs: msOfISO(iso) + 86400000, until: iso }));
  const extendLite = (per) => setF((o) => { const base = o.untilMs && o.untilMs > Date.now() ? o.untilMs : msOfISO(todayISO()); const u = addPeriodMs(base, per); return { ...o, untilMs: u, until: isoOf(new Date(u - 1)) }; });
  const save = async (status) => {
    let out = { ...f, weeks: Math.min(Number(f.weeks), maxWeeks), status: status || f.status, updatedAt: nowISO(), reviewedAt: nowISO(), niveau: f.niveau || "sportif", cycle: cycOf(f) };
    if (isLite) {
      const startMs = f.startMs || msOfISO(f.start || todayISO());
      const untilMs = f.untilMs || addPeriodMs(startMs, "mois");
      out = { ...out, weeks: maxWeeks, grantWeeks: 0, startMs, untilMs, until: isoOf(new Date(untilMs - 1)), lite: { mode: "manuel", period: "mois", sub: null, ...(f.lite || {}) } };
    } else { delete out.lite; delete out.startMs; delete out.untilMs; delete out.until; }
    if (status === "active" && !f.validatedAt) out.validatedAt = nowISO();
    try { await src.setPlan(out); toast(status === "active" ? "Programme activé." : "Plan enregistré.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  const coach = settings && settings.coach || null;
  const code = accessCode({ cid, profile: p, plan: { ...f, status: f.status === "pending" ? "active" : f.status }, lib, exo, coach, replies: data.replies, ai: settings && settings.ai, aiData: data.ai });
  const isLocal = p.local || p.manual;
  return html`<div className="stack">
    ${p.screeningFlag ? html`<div className="alert warn"><div><b>Questionnaire santé : au moins un « oui »</b><p>${(p.screening || []).map((x, i) => x ? SCREENING[i] : null).filter(Boolean).join(" · ")}</p></div></div>` : null}
    <${Card} title=${data.plan && data.plan.status !== "pending" ? "Plan du client" : "Valider la demande"} sub=${req.programId ? "Demande : " + (progOf(req.programId, lib) || {}).n + " · " + offerName(req.offer) + " · " + durName(req.weeks) : null}>
      <div className="form">
        <${Field} label="Programme" id="pe-prog"><select id="pe-prog" value=${f.programId} onChange=${(e) => set("programId", e.target.value)}>${programOptions(lib).map((o) => html`<option key=${o.v} value=${o.v}>${o.n}</option>`)}</select></${Field}>
        <div className="row2"><${Field} label="Formule"><${Seg} options=${[...OFFERS.map((o) => ({ v: o.id, n: o.n })), { v: "lite", n: "Lite" }]} value=${f.offer} onChange=${(v) => set("offer", v)} /></${Field}>
          ${isLite ? html`<${Field} label="Accès Lite jusqu'au (inclus)" id="pe-until"><input id="pe-until" type="date" value=${untilISO} onChange=${(e) => e.target.value && setUntil(e.target.value)} /></${Field}>`
            : html`<${Field} label="Durée"><${Seg} options=${DURS.filter((d) => d.w <= maxWeeks).map((d) => ({ v: d.w, n: d.n }))} value=${Number(f.weeks)} onChange=${(v) => set("weeks", v)} /></${Field}>`}</div>
        ${isLite ? html`<div className="btnrow"><${Btn} small kind="ghost" onClick=${() => extendLite("mois")}>Prolonger d'un mois</${Btn}><${Btn} small kind="ghost" onClick=${() => extendLite("an")}>Prolonger d'un an</${Btn}></div>
          <p className="muted small">${f.lite && f.lite.mode === "abo" ? "Abonnement Stripe : la date de fin avance toute seule à chaque prélèvement." : "Paiement encaissé à ta façon : prolonge l'accès à chaque paiement, puis enregistre."} Programme de ${maxWeeks} semaines ; le client choisit lui-même le suivant tant que son accès court.</p>
          ${data.plan && liteNoticeDue(data.plan) ? html`<${LiteNotice} plan=${data.plan} data=${data} settings=${settings} src=${src} demo=${demo} />` : null}` : null}
        <div className="row2"><${Field} label="Début (de préférence un lundi)" id="pe-start"><input id="pe-start" type="date" value=${f.start} onChange=${(e) => set("start", e.target.value)} /></${Field}>
          <${Field} label="Lieu"><${Seg} options=${[{ v: "salle", n: "Salle" }, { v: "maison", n: "Maison" }]} value=${f.equipment} onChange=${(v) => set("equipment", v)} /></${Field}></div>
        ${prog && !prog.maison && f.equipment === "maison" ? html`<p className="small warn-t">Ce programme n'a pas de version maison : les exercices resteront ceux de la salle.</p>` : null}
        <div className="row2"><${Field} label="Profil" id="pe-niv"><select id="pe-niv" value=${f.niveau || "sportif"} onChange=${(e) => set("niveau", e.target.value)}>${NIV.map((n) => html`<option key=${n.id} value=${n.id}>${n.n}</option>`)}</select></${Field}>
          <${Field} label="Compétition (affûtage)" id="pe-comp"><input id="pe-comp" type="date" value=${f.compDate || ""} onChange=${(e) => set("compDate", e.target.value || null)} /></${Field}></div>
        ${p.screeningFlag || f.medicalHold ? html`<label className="chk"><input type="checkbox" id="pe-med" checked=${f.medicalHold === false} onChange=${(e) => set("medicalHold", !e.target.checked)} /><span>Avis médical reçu : le client peut suivre son profil ${nivName(f.niveau || "sportif")} (sinon séances en mode Reprise).</span></label>` : null}
        ${req.answers ? html`<p className="muted small">Réponses du client : ${[["compet", "pratique"], ["xp", "musculation"], ["freq", "séances"]].map(([k, n]) => { const o = (NIVQ[k] && NIVQ[k].o || []).find((x) => x[0] === req.answers[k]); return n + " « " + (o ? o[1] : "—") + " »"; }).join(" · ")}. Profil conseillé : ${nivName(recommendNiveau(req.answers, ageOf(p), p.screeningFlag).id)}.</p>` : null}
        <${Field} label="Message affiché au client" id="pe-msg"><textarea id="pe-msg" rows="3" value=${f.message || ""} onChange=${(e) => set("message", e.target.value)} placeholder="Consigne de la semaine, encouragement…"></textarea></${Field}>
        <${Field} label="Statut"><${Seg} options=${[{ v: "pending", n: "En attente" }, { v: "active", n: "Actif" }, { v: "paused", n: "En pause" }, { v: "archived", n: "Archivé" }]} value=${f.status} onChange=${(v) => set("status", v)} /></${Field}>
        <p className="muted small">${isLite ? "Prix : " + litePriceTxt(settings, (f.lite && f.lite.period) || "mois", f.lite && f.lite.mode === "abo" ? "abo" : "avance") + " · accès jusqu'au " + fmtDY(untilISO) + " · programme en cours jusqu'au " + fmtDY(addDays(f.start, maxWeeks * 7 - 1)) : "Prix : " + eur(offerPrice(settings, f.offer, f.weeks)) + " · fin le " + fmtDY(addDays(f.start, Number(f.weeks) * 7 - 1))}</p>
      </div>
      <div className="actions">${f.status === "pending" ? html`<${Btn} onClick=${() => save("active")}>Valider et activer</${Btn}>` : null}<${Btn} kind=${f.status === "pending" ? "ghost" : "primary"} onClick=${() => save()}>Enregistrer</${Btn}></div>
    </${Card}>
    <${Card} title="Séances supplémentaires" sub="Tes séances perso ajoutées à une semaine précise">
      ${(f.extra || []).length ? html`<ul className="xlist">${f.extra.map((x, i) => html`<li key=${i}><span>Semaine ${x.w} · ${(lib[x.sid] && lib[x.sid].t) || "séance supprimée"}</span><button type="button" className="linkbtn" onClick=${() => set("extra", f.extra.filter((_, k) => k !== i))}>Retirer</button></li>`)}</ul>` : html`<p className="muted small">Aucune séance supplémentaire.</p>`}
      ${sessions.length ? html`<div className="row2"><select id="pe-xs" value=${addX.sid} onChange=${(e) => setAddX({ ...addX, sid: e.target.value })}><option value="">Choisir une séance perso</option>${sessions.map(([id, s]) => html`<option key=${id} value=${id}>${s.t}</option>`)}</select>
        <select id="pe-xw" value=${addX.w} onChange=${(e) => setAddX({ ...addX, w: Number(e.target.value) })}>${Array.from({ length: Number(f.weeks) }, (_, i) => html`<option key=${i} value=${i + 1}>Semaine ${i + 1}</option>`)}</select></div>
        <div className="actions"><${Btn} kind="ghost" small disabled=${!addX.sid} onClick=${() => { set("extra", [...(f.extra || []), { sid: addX.sid, w: addX.w }]); setAddX({ sid: "", w: addX.w }); }}>Ajouter puis enregistrer le plan</${Btn}></div>`
        : html`<p className="muted small">Crée d'abord une séance dans Programmes › Mes séances.</p>`}
    </${Card}>
    <${CoachOrders} data=${data} src=${src} cid=${cid} demo=${demo} settings=${settings} />
    ${data.plan ? html`<${Card} title="Nouveau cycle" sub="Pour enchaîner un nouveau programme : il repart à la semaine 1, l'historique du cycle actuel reste consultable."><${Btn} kind="ghost" small onClick=${() => set("cycle", cycOf(f) + 1)}>${cycOf(f) > cycOf(data.plan) ? "Cycle " + cycOf(f) + " prêt : choisis le programme et la date puis enregistre" : "Préparer le cycle " + (cycOf(data.plan) + 1)}</${Btn}></${Card}>` : null}
    ${!window.IS_SITE && (isLocal || demo) ? html`<${Card} title="Code d'accès du client" sub="Pour un client sans compte : envoie-lui ce code avec le lien de l'application. Renvoie-le après chaque modification du plan ou réponse aux bilans.">
      <${CopyBox} id="acc" text=${code} label="Copier le code d'accès" /></${Card}>` : null}
  </div>`;
}

function siteUrl() { try { return location.origin + location.pathname.replace(/index\.html$/, ""); } catch (e) { return ""; } }
function SiteAccessHowto({ onPreview }) {
  return html`<div className="stack-s"><ol className="howto">
    <li><b>Partage l'adresse de ton site</b> (bio Instagram, SMS, WhatsApp, carte de visite).</li>
    <li><b>Le client crée son compte</b> avec son e-mail ou Google, répond aux questions de niveau, choisit son programme, sa formule et sa durée.</li>
    <li><b>Il paie en ligne ou saisit ton code d'essai</b> : son accès s'ouvre pour la période choisie, sur téléphone comme sur ordinateur. Sans lien de paiement, tu confirmes toi-même la commande.</li>
    <li><b>Tu vérifies son plan</b> depuis « À traiter » (profil, avis médical, date de compétition).</li>
    <li>Ses séances, bilans, tests et repas arrivent ici en direct. Ses données ne sont visibles que par lui et par toi.</li>
    ${onPreview ? html`<li>Pour voir l'expérience du client, ouvre l'<button type="button" className="linkbtn" onClick=${onPreview}>aperçu côté client</button>.</li>` : null}
  </ol><${CopyBox} id="site-url" text=${siteUrl()} label="Copier l'adresse du site" /></div>`;
}

/* ---------- commandes d'un client (côté coach) ---------- */
function CoachOrders({ data, src, cid, demo, settings }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const orders = Object.values(data.orders || {}).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!orders.length) return null;
  const p = data.profile || {};
  const activate = async (o) => {
    if (demo) { toast("Exemple : rien n'est enregistré.", "warn"); return; }
    setBusy(true);
    try {
      const next = planFromOrder(data.plan, o, p, { kind: "coach", id: o.kind });
      await src.setPlan({ ...next, reviewedAt: nowISO() });
      const done = { ...o, status: "active", activatedAt: nowISO(), activatedBy: "coach" };
      await src.saveOrder(o.id, done);
      await src.setProfile({ ...p, access: accessSummary(done) });
      toast("Accès activé.", "ok");
    } catch (e) { toast("Activation impossible.", "bad"); } finally { setBusy(false); }
  };
  const patch = async (o, cancel, msg) => {
    if (demo) { toast("Exemple : rien n'est enregistré.", "warn"); return; }
    setBusy(true);
    try { const done = { ...o, cancel: { ...o.cancel, ...cancel } }; await src.saveOrder(o.id, done); await src.setProfile({ ...p, access: accessSummary(done) }); toast(msg, "ok"); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  const refunded = async (o) => {
    setBusy(true);
    try {
      const done = { ...o, withdrawal: { ...o.withdrawal, refundedAt: nowISO() } };
      await src.saveOrder(o.id, done);
      if (data.plan && data.plan.source && data.plan.source.orderId === o.id) await src.setPlan({ ...data.plan, status: "archived", updatedAt: nowISO() });
      await src.setProfile({ ...p, access: accessSummary(done) });
      toast("Remboursement noté, accès clôturé.", "ok");
    } catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<${Card} title="Commandes" sub="Paiements, codes et rétractations du client">
    ${orders.map((o) => html`<div key=${o.id} className="order">
      <div className="meal-h"><b>${o.kind === "renouvellement" ? "Renouvellement · " + durOf(o) + " · jusqu'au " + fmtD(isoOf(new Date(o.untilMs - 1))) : (PB[o.programId] ? PB[o.programId].n : "Programme") + " · " + (o.offer === "lite" ? durOf(o) : offerName(o.offer) + " · " + durName(o.weeks)) + (o.ext ? " (prolongation)" : "")}</b><${Pill} tone=${(ORDER_ST[o.status] || ORDER_ST.en_attente)[0]}>${(ORDER_ST[o.status] || ORDER_ST.en_attente)[1]}</${Pill}></div>
      <p className="muted small">${fmtDY(String(o.at).slice(0, 10))} · ${o.kind === "code" ? "code " + (o.code || "") : o.kind === "paiement" ? "Stripe · " + eur2(Number(o.paidAmount ?? o.price) || 0) + (o.paymentId ? " · " + o.paymentId.slice(0, 14) + "…" : "") : "hors ligne · " + eur2(Number(o.price) || 0)} · profil ${nivName(o.niveau)} · CGV ${o.cgv ? o.cgv.v : "—"}${o.early ? " · début anticipé demandé" : ""}${o.parent ? " · commande parent : " + (o.parent.name || "oui") : ""}</p>
      ${o.cancel ? html`<p className="small warn-t">Résiliation le ${new Date(o.cancel.at).toLocaleString("fr-FR")} par ${o.cancel.name} · effet ${o.cancel.immediate ? "immédiat" : "le " + fmtD(isoOf(new Date(o.cancel.effectMs - 1)))} · Stripe : ${o.cancel.stripe === "ok" ? "abonnement arrêté automatiquement" : o.cancel.doneAt ? "arrêté le " + fmtD(o.cancel.doneAt) : "à arrêter dans Stripe (Abonnements › Annuler" + (o.cancel.immediate ? " immédiatement" : " à la fin de la période") + ")"}${o.cancel.refund > 0 ? " · à rembourser : " + eur2(o.cancel.refund) + (o.cancel.refundedAt ? " (remboursé le " + fmtD(o.cancel.refundedAt) + ")" : "") : ""}</p>` : null}
      ${o.withdrawal ? html`<p className="small warn-t">Rétractation le ${new Date(o.withdrawal.at).toLocaleString("fr-FR")} par ${o.withdrawal.name} · à rembourser : ${eur2(o.withdrawal.refund || 0)} (prorata)${o.withdrawal.refundedAt ? " · remboursé le " + fmtD(o.withdrawal.refundedAt) : ""}</p>` : null}
      <div className="btnrow">
        ${o.status === "en_attente" && !o.withdrawal ? html`<${Btn} small onClick=${() => activate(o)} disabled=${busy}>${o.kind === "code" ? "Activer le code" : "Paiement reçu · activer"}</${Btn}>` : null}
        ${o.withdrawal && !o.withdrawal.refundedAt ? html`<${Btn} small kind="danger" onClick=${() => refunded(o)} disabled=${busy}>Remboursement effectué · clôturer l'accès</${Btn}>` : null}
        ${o.cancel && o.cancel.stripe !== "ok" && !o.cancel.doneAt ? html`<${Btn} small kind="danger" onClick=${() => patch(o, { doneAt: todayISO() }, "Arrêt de l'abonnement noté.")} disabled=${busy}>Abonnement arrêté dans Stripe</${Btn}>` : null}
        ${o.cancel && o.cancel.refund > 0 && !o.cancel.refundedAt ? html`<${Btn} small kind="ghost" onClick=${() => patch(o, { refundedAt: todayISO() }, "Remboursement noté.")} disabled=${busy}>Remboursement effectué</${Btn}>` : null}
      </div></div>`)}
    <p className="muted small">Stripe : rembourse depuis le tableau de bord Stripe (Paiements › Rembourser), au montant indiqué. Les codes sont vérifiés et activés automatiquement à l'ouverture de ton espace.</p>
  </${Card}>`;
}
/* activation automatique des codes envoyés par les clients (version Claude, ou si l'activation par le client a échoué) */
function useAutoActivate(db, rows, codes) {
  const doneRef = useRef({});
  useEffect(() => {
    if (!db || !codes.ready) return;
    rows.forEach(async (r) => {
      if (r.demo) return;
      const o = r.profile && r.profile.access && r.profile.access.lastOrder;
      if (!o || o.kind !== "code" || o.status !== "en_attente" || !o.code || doneRef.current[o.id]) return;
      if (r.plan && r.plan.source && r.plan.source.orderId === o.id) return;
      doneRef.current[o.id] = 1;
      const c = codes.items[normCode(o.code)];
      const st = codeState(c, r.cid);
      if (!st.ok) return;
      const order = { ...o, offer: c.offer, weeks: Number(c.weeks), programId: c.programId || o.programId };
      try {
        const now = nowISO();
        await dbSet(db, "codes/" + normCode(o.code), { ...c, uses: (Number(c.uses) || 0) + 1, usedBy: { ...(c.usedBy || {}), [r.cid]: now } });
        const next = planFromOrder(r.plan, order, r.profile, { kind: "code", id: normCode(o.code) });
        await dbSet(db, "plans/" + r.cid, next);
        const done = { ...order, status: "active", activatedAt: now, activatedBy: "coach-auto" };
        await dbSet(db, "clients/" + r.cid + "/orders/" + o.id, done);
        await qwrite("clients/" + r.cid, () => db.doc("clients/" + r.cid).update({ access: clone(accessSummary(done)) }));
      } catch (e) { doneRef.current[o.id] = 0; }
    });
  }, [db, rows, codes.ready, codes.items]);
}
/* forfait Lite côté coach : programme suivant choisi par le client (version sans règles client) et renouvellements Stripe pas encore appliqués */
function useLiteSync(db, rows) {
  const doneRef = useRef({});
  useEffect(() => {
    if (!db) return;
    rows.forEach(async (r) => {
      if (r.demo || !r.plan || r.plan.offer !== "lite") return;
      const nc = r.profile && r.profile.nextCycle;
      if (!nc || nc.cycle !== cycOf(r.plan) + 1 || doneRef.current["nc" + r.cid + nc.cycle]) return;
      doneRef.current["nc" + r.cid + nc.cycle] = 1;
      try {
        await dbSet(db, "plans/" + r.cid, liteNextCycle(r.plan, nc));
        await qwrite("clients/" + r.cid, () => db.doc("clients/" + r.cid).update({ nextCycle: null }));
      } catch (e) { doneRef.current["nc" + r.cid + nc.cycle] = 0; }
    });
  }, [db, rows]);
  useEffect(() => {
    if (!window.IS_SITE || !db) return undefined;
    let u = null;
    try {
      u = db.collection("payments").where("renewal", "==", true).onSnapshot((snap) => {
        snap.docs.forEach(async (d) => {
          const pay = d.data();
          if (!pay || pay.used || !pay.ok || doneRef.current["p" + d.id]) return;
          const r = rows.find((x) => x.cid === pay.uid);
          if (!r || !r.plan || r.plan.offer !== "lite" || !r.plan.lite || r.plan.lite.sub !== pay.sub || !(pay.untilMs > (r.plan.untilMs || 0))) return;
          doneRef.current["p" + d.id] = 1;
          try { await redeemPayment(db, r.cid, d.id, pay, { plan: r.plan, profile: r.profile, orders: {} }); } catch (e) { doneRef.current["p" + d.id] = 0; }
        });
      }, () => {});
    } catch (e) {}
    return () => { try { u && u(); } catch (e) {} };
  }, [db, rows]);
  /* abonnement arrêté dans Stripe (relais) : l'alerte « arrêter l'abonnement » disparaît d'elle-même */
  useEffect(() => {
    if (!window.IS_SITE || !db) return undefined;
    let u = null;
    try {
      u = db.collection("subs").onSnapshot((snap) => {
        const subs = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
        rows.forEach(async (r) => {
          const lo = r.profile && r.profile.access && r.profile.access.lastOrder;
          const sub = r.plan && r.plan.lite && r.plan.lite.sub;
          const sd = sub && subs[sub];
          if (!lo || !lo.cancel || lo.cancel.stripe === "ok" || lo.cancel.doneAt || !sd || !(sd.cancelAt > 0 || sd.status === "canceled") || doneRef.current["s" + lo.id]) return;
          doneRef.current["s" + lo.id] = 1;
          try {
            const done = { ...lo, cancel: { ...lo.cancel, stripe: "ok", stripeAt: nowISO() } };
            await dbSet(db, "clients/" + r.cid + "/orders/" + lo.id, done);
            await qwrite("clients/" + r.cid, () => db.doc("clients/" + r.cid).update({ access: clone(accessSummary(done)) }));
          } catch (e) { doneRef.current["s" + lo.id] = 0; }
        });
      }, () => {});
    } catch (e) {}
    return () => { try { u && u(); } catch (e) {} };
  }, [db, rows]);
}
/* ---------- codes d'essai et codes offerts ---------- */
function CodesView({ db, codes, rows, lib }) {
  const toast = useToast();
  const blank = () => ({ kind: "essai", offer: "suivi", weeks: 2, programId: "", max: 1, expires: "", note: "", code: genCode("ESSAI") });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const names = Object.fromEntries(rows.map((r) => [r.cid, r.profile && r.profile.name || "Client"]));
  const list = Object.values(codes || {}).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const create = async () => {
    if (!db) { toast("Enregistrement indisponible ici.", "warn"); return; }
    const code = normCode(f.code);
    if (code.length < 4) { toast("Code trop court (4 caractères minimum).", "warn"); return; }
    if (codes[code]) { toast("Ce code existe déjà.", "warn"); return; }
    setBusy(true);
    try {
      await dbSet(db, "codes/" + code, { code, kind: f.kind, offer: f.offer, weeks: Number(f.weeks), programId: f.programId || null, max: Math.max(1, Math.min(500, Number(f.max) || 1)), uses: 0, usedBy: {}, active: true,
        expiresMs: f.expires ? parseISO(f.expires).setHours(23, 59, 59, 999) : null, note: f.note.trim(), createdAt: nowISO() });
      toast("Code " + code + " créé.", "ok");
      setF({ ...blank(), kind: f.kind, code: genCode(f.kind === "essai" ? "ESSAI" : "OFFERT") });
    } catch (e) { toast("Création impossible.", "bad"); } finally { setBusy(false); }
  };
  const toggle = async (c) => { try { await dbSet(db, "codes/" + c.code, { ...c, active: c.active === false }); } catch (e) { toast("Modification impossible.", "bad"); } };
  const remove = async (c) => { try { await dbDel(db, "codes/" + c.code); toast("Code supprimé.", "ok"); } catch (e) { toast("Suppression impossible.", "bad"); } };
  const copy = (txt) => { try { navigator.clipboard.writeText(txt).then(() => toast("Copié.", "ok"), () => toast(txt, "ok")); } catch (e) { toast(txt, "ok"); } };
  return html`<div className="stack">
    <header className="page-h"><div><h1>Codes & essais</h1><p className="muted small">Offre un programme sans paiement : essai d'une semaine, joueurs d'un club, partenariat… Le client saisit le code (ou ouvre ton lien) à la dernière étape.</p></div></header>
    <${Card} title="Créer un code"><div className="form">
      <div className="row2"><${Field} label="Type"><${Seg} options=${[{ v: "essai", n: "Essai" }, { v: "offert", n: "Offert" }]} value=${f.kind} onChange=${(v) => { set("kind", v); set("code", genCode(v === "essai" ? "ESSAI" : "OFFERT")); }} /></${Field}>
        <${Field} label="Formule"><${Seg} options=${[...OFFERS.map((o) => ({ v: o.id, n: o.n })), { v: "lite", n: "Lite" }]} value=${f.offer} onChange=${(v) => set("offer", v)} /></${Field}></div>
      <${Field} label=${f.offer === "lite" ? "Durée d'accès Lite offerte" : "Durée offerte"}><${Seg} options=${[...TRIAL_DURS, ...DURS].map((d) => ({ v: d.w, n: d.n }))} value=${Number(f.weeks)} onChange=${(v) => set("weeks", v)} /></${Field}>
      <div className="row2"><${Field} label="Programme" id="cd-prog"><select id="cd-prog" value=${f.programId} onChange=${(e) => set("programId", e.target.value)}><option value="">Au choix du client</option>${PROGS.map((x) => html`<option key=${x.id} value=${x.id}>${x.n}</option>`)}</select></${Field}>
        <${Field} label="Nombre d'utilisations" id="cd-max" hint="1 pour une personne, plus pour un groupe ou un club"><input id="cd-max" inputMode="numeric" value=${f.max} onChange=${(e) => set("max", e.target.value.replace(/\D/g, ""))} /></${Field}></div>
      <div className="row2"><${Field} label="Valable jusqu'au (facultatif)" id="cd-exp"><input id="cd-exp" type="date" min=${todayISO()} value=${f.expires} onChange=${(e) => set("expires", e.target.value)} /></${Field}>
        <${Field} label="Code" id="cd-code" hint="Garde la partie aléatoire : un code trop simple se devine."><input id="cd-code" value=${f.code} onChange=${(e) => set("code", normCode(e.target.value))} /></${Field}></div>
      <${Field} label="Note pour toi (facultatif)" id="cd-note"><input id="cd-note" value=${f.note} onChange=${(e) => set("note", e.target.value)} placeholder="Ex. essai joueurs FRDR" /></${Field}>
      <${Btn} onClick=${create} disabled=${busy}>Créer le code</${Btn}></div></${Card}>
    <${Card} title="Mes codes" sub=${plural(list.length, "code")}>
      ${list.length ? html`<div className="codes">${list.map((c) => {
        const st = codeState(c, null);
        const used = Object.keys(c.usedBy || {});
        return html`<div key=${c.code} className="codeitem">
          <div className="meal-h"><b className="mono">${c.code}</b><${Pill} tone=${st.ok ? "ok" : "muted"}>${st.ok ? "Actif" : c.active === false ? "Désactivé" : c.expiresMs && Date.now() > c.expiresMs ? "Expiré" : "Épuisé"}</${Pill}></div>
          <p className="small">${codeSummary(c)} · ${c.uses || 0}/${c.max || 1} utilisation${(c.max || 1) > 1 ? "s" : ""}${c.expiresMs ? " · jusqu'au " + fmtD(isoOf(new Date(c.expiresMs))) : ""}${c.note ? " · " + c.note : ""}</p>
          ${used.length ? html`<p className="muted small">Utilisé par : ${used.map((u) => names[u] || "client supprimé").join(", ")}</p>` : null}
          <div className="btnrow">${window.IS_SITE ? html`<${Btn} small onClick=${() => copy(codeLink(c.code))}>Copier le lien</${Btn}>` : null}<${Btn} small kind="ghost" onClick=${() => copy(c.code)}>Copier le code</${Btn}>
            <${Btn} small kind="quiet" onClick=${() => toggle(c)}>${c.active === false ? "Réactiver" : "Désactiver"}</${Btn}>${!(c.uses > 0) ? html`<${Btn} small kind="quiet" onClick=${() => remove(c)}>Supprimer</${Btn}>` : null}</div>
        </div>`;
      })}</div>` : html`<p className="muted small">Aucun code pour l'instant.</p>`}
      ${!window.IS_SITE ? html`<p className="muted small">Ici, le client saisit le code à la dernière étape de son inscription ; il s'active dès que tu ouvres ton espace coach.</p>` : null}
    </${Card}>
  </div>`;
}

/* ---------- Ajout manuel & import ---------- */
function AddClient({ db, lib, settings, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", sport: "", programId: "vitesse", offer: "suivi", weeks: 12, start: nextMonday(), equipment: "salle" });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const create = async () => {
    if (!db) { toast("Ouvre l'application depuis claude.ai pour créer un client.", "warn"); return; }
    const cid = rid("m_");
    try {
      await dbSet(db, "clients/" + cid, { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), sport: f.sport.trim(), sportId: sportIdOf(f.sport) || null, manual: true, local: true, createdAt: nowISO(), consent: null, sum: summarize({}) });
      await dbSet(db, "plans/" + cid, { programId: f.programId, offer: f.offer, weeks: Number(f.weeks), start: f.start, equipment: f.equipment, status: "active", message: "", extra: [], validatedAt: nowISO() });
      toast(window.IS_SITE ? "Fiche client créée." : "Client créé. Copie son code d'accès dans l'onglet Plan.", "ok");
      onDone(cid);
    } catch (e) { toast("Création impossible.", "bad"); }
  };
  return html`<div className="form">
    <${Field} label="Prénom et nom" id="ac-n"><input id="ac-n" value=${f.name} onChange=${(e) => set("name", e.target.value)} /></${Field}>
    <div className="row2"><${Field} label="E-mail" id="ac-e"><input id="ac-e" value=${f.email} onChange=${(e) => set("email", e.target.value)} /></${Field}><${Field} label="Téléphone" id="ac-p"><input id="ac-p" value=${f.phone} onChange=${(e) => set("phone", e.target.value)} /></${Field}></div>
    <${Field} label="Sport" id="ac-s"><input id="ac-s" value=${f.sport} onChange=${(e) => set("sport", e.target.value)} /></${Field}>
    <${Field} label="Programme" id="ac-prog"><select id="ac-prog" value=${f.programId} onChange=${(e) => set("programId", e.target.value)}>${programOptions(lib).map((o) => html`<option key=${o.v} value=${o.v}>${o.n}</option>`)}</select></${Field}>
    <${Field} label="Formule"><${Seg} options=${OFFERS.map((o) => ({ v: o.id, n: o.n }))} value=${f.offer} onChange=${(v) => set("offer", v)} /></${Field}>
    <div className="row2"><${Field} label="Durée"><${Seg} options=${DURS.map((d) => ({ v: d.w, n: d.n }))} value=${Number(f.weeks)} onChange=${(v) => set("weeks", v)} /></${Field}>
      <${Field} label="Début" id="ac-d"><input id="ac-d" type="date" value=${f.start} onChange=${(e) => set("start", e.target.value)} /></${Field}></div>
    <${Field} label="Lieu"><${Seg} options=${[{ v: "salle", n: "Salle" }, { v: "maison", n: "Maison" }]} value=${f.equipment} onChange=${(v) => set("equipment", v)} /></${Field}>
    <p className="muted small">${window.IS_SITE ? "Fiche pour un client que tu suis sans compte (en présentiel par exemple) : tu y gardes son plan et tes notes. Un client qui crée son compte sur le site apparaît tout seul dans « À traiter »." : "Pour un client qui s'inscrit lui-même avec un compte, inutile de le créer ici : sa demande apparaîtra dans « À traiter »."}</p>
    <${Btn} onClick=${create} disabled=${f.name.trim().length < 2}>Créer le client</${Btn}>
  </div>`;
}
function ImportBox({ db, onDone }) {
  const toast = useToast();
  const [t, setT] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!db) { toast("Ouvre l'application depuis claude.ai pour importer.", "warn"); return; }
    setBusy(true);
    try { const r = await importPackage(db, t); toast("Importé : " + r.name + " (" + plural(r.counts.logs, "séance") + ", " + plural(r.counts.checkins, "bilan") + ").", "ok"); onDone(r.cid); }
    catch (e) { toast(e.message || "Import impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="form"><p className="small">Colle ici le texte envoyé par un client sans compte (il commence par « APP1. »). Ses séances, bilans et tests sont ajoutés à sa fiche ; une nouvelle demande crée sa fiche.</p>
    <textarea id="imp" rows="7" className="code" value=${t} onChange=${(e) => setT(e.target.value)} placeholder="APP1…"></textarea>
    <${Btn} onClick=${go} disabled=${busy || !t.trim()}>Importer</${Btn}></div>`;
}
