/* ===== Fiche mouvement et correction vidéo ===== */
const CHECKS = CONTENT.CHECKS || {}, CHECK_OF = CONTENT.CHECK_OF || {};
function motionKey(id, ex) { return (ex && ex.anim) || (typeof MOTION_FOR !== "undefined" && MOTION_FOR[id]) || id; }
function checksFor(id, ex) { const k = CHECK_OF[motionKey(id, ex)]; return (k && CHECKS[k]) || (ex && ex.cues) || []; }
function ytSearch(ex) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent((ex && ex.n ? ex.n : "") + " technique exercice"); }
/* la formule permet-elle l'envoi au coach ? Suivi par défaut ; réglable par le coach */
function videoCoachOk(settings, plan) {
  const who = (settings && settings.video && settings.video.coach) || "suivi";
  if (!plan || plan.offer === "lite") return false;
  return who === "toutes" || plan.offer === who || (who === "suivi" && plan.offer === "suivi");
}

/* ---------- fiche d'un exercice : animation, consignes, vidéo du coach, recherche ---------- */
function ExerciseSheet({ e, ex, onFilm }) {
  const id = e || (ex && ex.id);
  return html`<div className="stack">
    ${hasMotion(id, ex) ? html`<${MoveAnim} id=${id} ex=${ex} />` : html`<p className="muted small">Pas d'animation pour cet exercice.</p>`}
    <ul className="small">${((ex && ex.cues) || []).map((c, k) => html`<li key=${k}>${c}</li>`)}</ul>
    ${ex && (ex.reg || ex.prog) ? html`<p className="small muted">${ex.reg ? "Plus facile : " + ex.reg + ". " : ""}${ex.prog ? "Plus difficile : " + ex.prog + "." : ""}</p>` : null}
    ${ex && ex.cnote ? html`<p className="small"><b>Note d'Antoine :</b> ${ex.cnote}</p>` : null}
    <div className="btnrow">${ex && ex.video ? html`<a className="btn" href=${ex.video} target="_blank" rel="noopener">Voir la vidéo d'Antoine</a>` : null}
      <a className="btn ghost" href=${ytSearch(ex)} target="_blank" rel="noopener">Chercher une démonstration</a>
      ${onFilm ? html`<${Btn} kind="ghost" onClick=${onFilm}>Me filmer et vérifier</${Btn}>` : null}</div>
    ${ex && !ex.video ? html`<p className="muted small">La recherche ouvre YouTube dans un nouvel onglet : vérifie que la démonstration correspond aux consignes ci-dessus.</p>` : null}
  </div>`;
}

function dataUrlBlob(d) { const [h, b] = String(d).split(","); const bin = atob(b || ""); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: (h.match(/data:([^;]+)/) || [])[1] || "image/jpeg" }); }
/* ---------- outils de mesure ---------- */
function angleAt(a, b, c) { const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]]; const d = Math.hypot(...v1) * Math.hypot(...v2); if (!d) return null; return Math.round(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))) * 180 / Math.PI); }
function lineTilt(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; return Math.round(Math.abs(Math.atan2(dx, -dy) * 180 / Math.PI)); }
function drawMarks(ctx, w, h, marks, pending) {
  const px = (p) => [p[0] * w, p[1] * h];
  ctx.lineWidth = Math.max(2, w / 220); ctx.font = "600 " + Math.max(13, Math.round(w / 28)) + "px system-ui, sans-serif"; ctx.lineCap = "round";
  const dot = (p) => { const [x, y] = px(p); ctx.beginPath(); ctx.arc(x, y, Math.max(4, w / 90), 0, Math.PI * 2); ctx.fill(); };
  const label = (p, t) => { const [x, y] = px(p); const pad = 4, tw = ctx.measureText(t).width; ctx.fillStyle = "rgba(13,13,12,.78)"; ctx.fillRect(x + 8, y - 22, tw + pad * 2, 24); ctx.fillStyle = "#f2c94c"; ctx.fillText(t, x + 8 + pad, y - 4); };
  [...marks, ...(pending && pending.pts.length ? [pending] : [])].forEach((m) => {
    ctx.strokeStyle = "#f2c94c"; ctx.fillStyle = "#f2c94c";
    m.pts.forEach(dot);
    if (m.pts.length >= 2) { ctx.beginPath(); const p0 = px(m.pts[0]); ctx.moveTo(p0[0], p0[1]); m.pts.slice(1).forEach((p) => { const q = px(p); ctx.lineTo(q[0], q[1]); }); ctx.stroke(); }
    if (m.type === "line" && m.pts.length === 2) { const a = px(m.pts[0]); ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(242,201,76,.6)"; ctx.beginPath(); ctx.moveTo(a[0], a[1] - h * 0.25); ctx.lineTo(a[0], a[1] + h * 0.25); ctx.stroke(); ctx.setLineDash([]); label(m.pts[1], lineTilt(...m.pts) + "° / verticale"); }
    if (m.type === "angle" && m.pts.length === 3) label(m.pts[1], angleAt(...m.pts) + "°");
  });
}
function markText(m) { return m.type === "angle" ? "Angle " + angleAt(...m.pts) + "°" : "Inclinaison " + lineTilt(...m.pts) + "° par rapport à la verticale"; }

/* ---------- correction vidéo ---------- */
function VideoCheck({ e, ex, data, src, plan, settings, ai, onClose }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const url = useObjectURL(file);
  const vid = useRef(null), cv = useRef(null), box = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.5);
  const [t, setT] = useState(0), [dur, setDur] = useState(0);
  const [tool, setTool] = useState(null); // "angle" | "line"
  const [marks, setMarks] = useState([]);
  const [pending, setPending] = useState(null);
  const [frames, setFrames] = useState([]);
  const checks = checksFor(e, ex);
  const [ck, setCk] = useState({});
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiRes, setAiRes] = useState(null);
  const [saved, setSaved] = useState(null);
  const canCoach = videoCoachOk(settings, plan);
  const canAI = ai && ai.sample && ai.images && plan && plan.offer !== "lite";
  /* dessin de la couche de mesure au format de la vidéo */
  const redraw = useCallback(() => {
    const v = vid.current, c = cv.current; if (!v || !c) return;
    const r = v.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); c.style.width = r.width + "px"; c.style.height = r.height + "px";
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
    drawMarks(ctx, r.width, r.height, marks, pending);
  }, [marks, pending]);
  useEffect(() => { redraw(); }, [redraw, t, url]);
  useEffect(() => { const f = () => redraw(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, [redraw]);
  useEffect(() => { if (vid.current) vid.current.playbackRate = rate; }, [rate, url]);
  const showStage = () => { try { box.current && box.current.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} };
  const toggle = () => { const v = vid.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); } else v.pause(); };
  const step = (n) => { const v = vid.current; if (!v) return; v.pause(); v.currentTime = Math.max(0, Math.min((v.duration || 0), v.currentTime + n / 30)); };
  const tap = (ev) => {
    if (!tool) return;
    const r = cv.current.getBoundingClientRect();
    const p = [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
    const need = tool === "angle" ? 3 : 2;
    const cur = pending && pending.type === tool ? pending : { type: tool, pts: [] };
    const nx = { ...cur, pts: [...cur.pts, p] };
    if (nx.pts.length >= need) { setMarks((m) => [...m, nx]); setPending(null); setTool(null); } else setPending(nx);
  };
  const grab = () => {
    const v = vid.current; if (!v || !v.videoWidth) return;
    if (frames.length >= 3) { toast("3 images maximum : retire-en une pour en garder une autre.", "warn"); return; }
    const W = Math.min(560, v.videoWidth), H = Math.round(W * v.videoHeight / v.videoWidth);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.drawImage(v, 0, 0, W, H); drawMarks(x, W, H, marks, null);
    let img = ""; try { img = c.toDataURL("image/jpeg", 0.72); } catch (err) { toast("Image impossible à extraire de cette vidéo.", "bad"); return; }
    setFrames((f) => [...f, { img, t: Math.round(v.currentTime * 100) / 100, marks: marks.map((m) => ({ ...m, txt: markText(m) })) }]);
    setMarks([]); toast("Image gardée.", "ok");
  };
  const blobOf = async (d) => dataUrlBlob(d);
  const askAI = async () => {
    if (!canAI || !frames.length) return;
    setBusy(true); setAiRes({ busy: true });
    try {
      const imgs = await Promise.all(frames.slice(0, Math.max(1, ai.maxImages || 3)).map((f) => blobOf(f.img)));
      const prompt = ["Tu es le coach IA d'Antoine Limousi, préparateur physique (diplômé d'haltérophilie, réathlétisation). Analyse la technique d'un client sur " + frames.length + " image(s) extraite(s) de sa vidéo.",
        "Exercice : " + (ex ? ex.n : e) + ". Consignes de référence : " + (ex && ex.cues ? ex.cues.join(" ; ") : "—") + ".",
        "Points à vérifier : " + checks.join(" ; ") + ".",
        "Mesures faites par le client : " + (frames.flatMap((f) => f.marks.map((m) => "image à " + f.t + " s : " + m.txt)).join(" ; ") || "aucune") + ".",
        "Profil : " + nivName(effNiveau(plan, data.profile)) + ". Sport : " + ((data.profile && data.profile.sport) || "—") + ". Ressenti du client : " + (note || "—") + ".",
        "Réponds en JSON strict : {\"resume\": \"2 phrases\", \"points\": [{\"point\": \"...\", \"ok\": true|false, \"conseil\": \"1 phrase concrète\"}], \"priorite\": \"la correction n°1, une phrase\", \"securite\": \"vide ou une alerte si risque de blessure\"}.",
        "Reste prudent : une image ne montre pas tout le mouvement ; si l'angle de vue empêche de juger un point, dis-le. Pas de diagnostic médical. Tutoie le client, en français."].join("\n");
      const j = await ai.sample.json(prompt, { images: imgs, modelTier: "default" });
      setAiRes({ ...j, busy: false });
    } catch (err) { setAiRes({ busy: false, err: aiErr(err) }); } finally { setBusy(false); }
  };
  const save = async (toCoach) => {
    if (!frames.length) { toast("Garde au moins une image de ton mouvement.", "warn"); return; }
    if (link && !/^https:\/\//.test(link.trim())) { toast("Le lien doit commencer par https://", "warn"); return; }
    setBusy(true);
    const id = rid("v");
    const doc = { id, e, exName: ex ? ex.n : e, at: nowISO(), frames, checks: checks.map((c, k) => ({ c, v: ck[k] || null })), note: note.trim(), link: link.trim(), toCoach: !!toCoach, status: toCoach ? "envoyee" : "perso", ai: aiRes && !aiRes.err && !aiRes.busy ? aiRes : null, reply: null, w: planState(plan) ? planState(plan).week : null };
    try { await src.saveVideo(id, doc); setSaved(doc); toast(toCoach ? "Envoyé à Antoine." : "Enregistré dans tes vidéos.", "ok"); }
    catch (err) { toast(err && /size|large|exceed/i.test(String(err.message)) ? "Images trop lourdes : garde-en moins." : "Envoi impossible. Réessaie.", "bad"); }
    finally { setBusy(false); }
  };
  if (saved) return html`<div className="stack"><div className="alert okb"><div><b>${saved.toCoach ? "Vidéo envoyée" : "Analyse enregistrée"}</b>
    <p>${saved.toCoach ? "Antoine regarde tes images et te répond ici et dans « Mes vidéos »." : "Tu la retrouves dans « Mes vidéos » (onglet Progrès)."}</p></div></div>
    <${Btn} onClick=${onClose}>Fermer</${Btn}></div>`;
  return html`<div className="stack vcheck">
    ${!file ? html`<div className="stack-s">
      <p className="small">Filme ton mouvement <b>de profil</b>, à 2 ou 3 mètres, <b>tout le corps visible</b>, bien éclairé. La vidéo reste sur ton téléphone : seules les images que tu gardes sont envoyées.</p>
      <div className="vc-ref"><${MoveAnim} id=${e} ex=${ex} compact=${true} /></div>
      <div className="btnrow"><label className="btn" htmlFor="vc-cam">Filmer</label><label className="btn ghost" htmlFor="vc-file">Choisir une vidéo</label></div>
      <input id="vc-cam" className="hide-input" type="file" accept="video/*" capture="environment" onChange=${(ev) => ev.target.files[0] && setFile(ev.target.files[0])} />
      <input id="vc-file" className="hide-input" type="file" accept="video/*" onChange=${(ev) => ev.target.files[0] && setFile(ev.target.files[0])} />
    </div>` : html`
      <div className="vc-grid">
        <div className="vc-stage" ref=${box}>
          <video ref=${vid} src=${url} playsInline muted preload="auto" onLoadedMetadata=${(ev) => { setDur(ev.target.duration || 0); ev.target.playbackRate = rate; setTimeout(redraw, 50); }}
            onTimeUpdate=${(ev) => setT(ev.target.currentTime)} onPlay=${() => setPlaying(true)} onPause=${() => setPlaying(false)} onSeeked=${(ev) => setT(ev.target.currentTime)}></video>
          <canvas ref=${cv} className=${"vc-layer" + (tool ? " on" : "")} onClick=${tap} aria-label="Zone de mesure : touche les points"></canvas>
        </div>
        <div className="vc-side"><div className="eyebrow">Référence</div><${MoveAnim} id=${e} ex=${ex} compact=${true} /></div>
      </div>
      <input type="range" className="vc-seek" min="0" max=${dur || 0} step="0.01" value=${t} aria-label="Position dans la vidéo" onChange=${(ev) => { const v = vid.current; if (v) { v.pause(); v.currentTime = Number(ev.target.value); } }} />
      <div className="btnrow vc-ctl">
        <${Btn} small kind="ghost" onClick=${() => step(-1)}>‹ Image</${Btn}>
        <${Btn} small onClick=${toggle}>${playing ? "Pause" : "Lecture"}</${Btn}>
        <${Btn} small kind="ghost" onClick=${() => step(1)}>Image ›</${Btn}>
        <${Seg} options=${[{ v: 0.25, n: "×0,25" }, { v: 0.5, n: "×0,5" }, { v: 1, n: "×1" }]} value=${rate} onChange=${setRate} />
      </div>
      <div className="btnrow vc-tools">
        <${Btn} small kind=${tool === "angle" ? "" : "ghost"} onClick=${() => { setTool(tool === "angle" ? null : "angle"); setPending(null); if (tool !== "angle") showStage(); }}>Mesurer un angle</${Btn}>
        <${Btn} small kind=${tool === "line" ? "" : "ghost"} onClick=${() => { setTool(tool === "line" ? null : "line"); setPending(null); if (tool !== "line") showStage(); }}>Inclinaison</${Btn}>
        ${marks.length ? html`<${Btn} small kind="quiet" onClick=${() => { setMarks([]); setPending(null); }}>Effacer</${Btn}>` : null}
        <${Btn} small onClick=${grab}>Garder cette image</${Btn}>
      </div>
      ${tool ? html`<p className="small gold-t">${tool === "angle" ? "Touche 3 points : par exemple hanche, genou, cheville. L'angle s'affiche au point du milieu." : "Touche 2 points : par exemple hanche puis épaule pour l'inclinaison du buste."}</p>` : null}
      ${marks.length ? html`<p className="small">${marks.map(markText).join(" · ")}</p>` : null}
      ${frames.length ? html`<div className="vc-frames">${frames.map((f, k) => html`<figure key=${k}><img src=${f.img} alt=${"Image à " + f.t + " s"} /><figcaption>${f.t} s${f.marks.length ? " · " + f.marks.map((m) => m.txt).join(", ") : ""}</figcaption>
        <button type="button" className="linkbtn" onClick=${() => setFrames(frames.filter((_, j) => j !== k))}>Retirer</button></figure>`)}</div>` : html`<p className="muted small">Arrête la vidéo aux moments clés (départ, position basse, fin) et garde jusqu'à 3 images.</p>`}
      <${Card} title="Points à vérifier" sub="Compare avec l'animation de référence">
        ${checks.map((c, k) => html`<div key=${k} className="vc-chk"><span className="small">${c}</span><${Seg} options=${[{ v: "ok", n: "OK" }, { v: "revoir", n: "À revoir" }]} value=${ck[k] || null} onChange=${(v) => setCk({ ...ck, [k]: v })} /></div>`)}
      </${Card}>
      <${Field} label="Ton ressenti, ta question (facultatif)" id="vc-note"><textarea id="vc-note" rows="2" value=${note} onChange=${(ev) => setNote(ev.target.value)} placeholder="Ex. je sens mon dos s'arrondir en bas"></textarea></${Field}>
      ${canCoach ? html`<${Field} label="Lien vers la vidéo complète (facultatif)" id="vc-link" hint="Google Drive, iCloud, YouTube non répertoriée…"><input id="vc-link" type="url" value=${link} onChange=${(ev) => setLink(ev.target.value)} placeholder="https://" /></${Field}>` : null}
      ${canAI ? html`<div className="right"><${Btn} kind="ghost" small onClick=${askAI} disabled=${busy || !frames.length}>${aiRes && aiRes.busy ? "Analyse en cours…" : "Analyse par le coach IA"}</${Btn}></div>` : null}
      ${aiRes && !aiRes.busy ? (aiRes.err ? html`<p className="small warn-t">${aiRes.err}</p>` : html`<div className="coachmsg ai"><span className="ai-dot">✦</span><div className="stack-s"><div className="eyebrow">Coach IA (intelligence artificielle)</div>
        <p>${aiRes.resume}</p>${(aiRes.points || []).map((p, k) => html`<p key=${k} className="small">${p.ok ? "✓" : "△"} <b>${p.point}</b> : ${p.conseil}</p>`)}
        ${aiRes.priorite ? html`<p className="small"><b>Priorité :</b> ${aiRes.priorite}</p>` : null}${aiRes.securite ? html`<p className="small warn-t">${aiRes.securite}</p>` : null}
        <p className="muted small">Repères à partir de quelques images : Antoine peut compléter ou corriger.</p></div></div>`) : null}
      <div className="actions">
        ${canCoach ? html`<${Btn} onClick=${() => save(true)} disabled=${busy || !frames.length}>Envoyer à Antoine</${Btn}>` : null}
        <${Btn} kind=${canCoach ? "ghost" : ""} onClick=${() => save(false)} disabled=${busy || !frames.length}>Garder pour moi</${Btn}>
        <${Btn} kind="quiet" onClick=${() => { setFile(null); setFrames([]); setMarks([]); }}>Autre vidéo</${Btn}>
      </div>
      ${!canCoach && plan ? html`<p className="muted small">${plan.offer === "lite" ? "La correction par Antoine n'est pas incluse dans le forfait Lite." : "La correction vidéo par Antoine est incluse dans la formule Suivi."}</p>` : null}
    `}
  </div>`;
}

/* ---------- historique côté client ---------- */
function VideoList({ data, src, coach }) {
  const list = Object.values(data.videos || {}).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const [open, setOpen] = useState(null);
  if (!list.length) return null;
  return html`<${Card} title="Mes vidéos" sub="Images gardées, mesures et corrections">
    ${list.map((v) => html`<div key=${v.id} className="vitem">
      <button type="button" className="vitem-h" onClick=${() => setOpen(open === v.id ? null : v.id)} aria-expanded=${open === v.id}>
        ${v.frames && v.frames[0] ? html`<img src=${v.frames[0].img} alt="" />` : null}<span><b>${v.exName}</b><span className="muted small">${fmtD(v.at)} · ${v.reply ? "corrigée par " + ((coach && coach.name) || COACH_NAME_DEFAULT) : v.toCoach ? "envoyée, en attente" : "pour moi"}</span></span>
        ${v.reply && !v.seen ? html`<${Pill} tone="gold">nouveau</${Pill}>` : null}</button>
      ${open === v.id ? html`<${VideoDetail} v=${v} src=${src} mine=${true} />` : null}</div>`)}
  </${Card}>`;
}
function VideoDetail({ v, src, mine, coachMode }) {
  const toast = useToast();
  const [reply, setReply] = useState((v.reply && v.reply.text) || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (mine && v.reply && !v.seen) src.saveVideo(v.id, { ...v, seen: true }).catch(() => {}); }, [v.id]);
  const send = async () => {
    setBusy(true);
    try { await src.saveVideo(v.id, { ...v, reply: { text: reply.trim(), at: nowISO() }, status: "corrigee", seen: false }); toast("Correction envoyée.", "ok"); }
    catch (e) { toast("Envoi impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="stack-s vdetail">
    <div className="vc-frames">${(v.frames || []).map((f, k) => html`<figure key=${k}><a href=${f.img} target="_blank" rel="noopener"><img src=${f.img} alt=${"Image à " + f.t + " s"} /></a><figcaption>${f.t} s${f.marks && f.marks.length ? " · " + f.marks.map((m) => m.txt).join(", ") : ""}</figcaption></figure>`)}</div>
    ${(v.checks || []).some((c) => c.v) ? html`<ul className="small">${v.checks.filter((c) => c.v).map((c, k) => html`<li key=${k}>${c.v === "ok" ? "✓" : "△"} ${c.c}</li>`)}</ul>` : null}
    ${v.note ? html`<p className="small"><b>${coachMode ? "Le client" : "Ma note"} :</b> ${v.note}</p>` : null}
    ${v.link ? html`<p className="small"><a href=${v.link} target="_blank" rel="noopener">Voir la vidéo complète</a></p>` : null}
    ${v.ai ? html`<div className="coachmsg ai"><span className="ai-dot">✦</span><div className="stack-s"><div className="eyebrow">Coach IA</div><p className="small">${v.ai.resume}</p>${v.ai.priorite ? html`<p className="small"><b>Priorité :</b> ${v.ai.priorite}</p>` : null}</div></div>` : null}
    ${v.reply && !coachMode ? html`<div className="coachmsg"><${Logo} size=${24} /><div><div className="eyebrow">Correction d'Antoine · ${fmtD(v.reply.at)}</div><p>${v.reply.text}</p></div></div>` : null}
    ${coachMode && v.toCoach ? html`<${Field} label="Ta correction" id=${"vr-" + v.id}><textarea id=${"vr-" + v.id} rows="3" value=${reply} onChange=${(e) => setReply(e.target.value)} placeholder="Ce qui va bien, la correction prioritaire, un repère à sentir"></textarea></${Field}>
      <div className="actions"><${Btn} small onClick=${send} disabled=${busy || !reply.trim()}>${v.reply ? "Mettre à jour la correction" : "Envoyer la correction"}</${Btn}></div>` : null}
  </div>`;
}
/* fiche client côté coach */
function CoachVideos({ data, src }) {
  const list = Object.values(data.videos || {}).filter(Boolean).sort((a, b) => (a.toCoach && !a.reply ? -1 : 0) - (b.toCoach && !b.reply ? -1 : 0) || String(b.at).localeCompare(String(a.at)));
  const [open, setOpen] = useState(list[0] ? list[0].id : null);
  const firstId = list[0] ? list[0].id : null;
  /* les vidéos arrivent après le premier affichage : ouvre d'office la première à corriger */
  const did = useRef(false);
  useEffect(() => { if (!did.current && firstId) { did.current = true; if (!open) setOpen(firstId); } }, [firstId]);
  if (!list.length) return html`<${Empty} title="Aucune vidéo" text="Le client peut se filmer depuis chaque exercice de sa séance (« Me filmer et vérifier »)." />`;
  return html`<div className="stack">${list.map((v) => html`<${Card} key=${v.id} title=${v.exName + " · " + fmtD(v.at)} sub=${v.toCoach ? (v.reply ? "Corrigée le " + fmtD(v.reply.at) : "À corriger") : "Gardée par le client pour lui"}
      action=${html`<button type="button" className="linkbtn" onClick=${() => setOpen(open === v.id ? null : v.id)}>${open === v.id ? "Replier" : "Ouvrir"}</button>`}>
      ${open === v.id ? html`<${VideoDetail} v=${v} src=${src} coachMode=${true} />` : null}</${Card}>`)}</div>`;
}
