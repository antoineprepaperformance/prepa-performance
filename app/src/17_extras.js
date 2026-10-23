/* ===== Séances en plus : flash à la maison, récupération et bien-être (lecteur minuté) ===== */
const RECUP = CONTENT.RECUP || [], FLASH = CONTENT.FLASH || [], XREFS = CONTENT.XREFS || {};
const FMT_N = { circuit: "Circuit", tabata: "Tabata", emom: "EMOM", amrap: "AMRAP" };
const MAT_N = { aucun: "Sans matériel", "haltères": "Haltères", kettlebell: "Kettlebell", "élastique": "Élastique" };
function exName(id) { return (EXB[id] && EXB[id].n) || id; }
function round5(x) { return Math.max(10, Math.round(x / 5) * 5); }
/* adapte une séance flash au profil : Reprise plus doux, Haut niveau un tour de plus */
function flashAdapt(f, niveau) {
  const r = nivRank(niveau || "sportif");
  const out = { ...f, items: f.items.map((it) => ({ ...it, use: r === 0 && it.alt ? it.alt : it.e })) };
  if (f.fmt === "circuit" || f.fmt === "tabata") {
    if (r === 0) { out.work = f.fmt === "tabata" ? f.work : round5(f.work * 0.75); out.rest = f.fmt === "tabata" ? f.rest : round5(f.rest * 1.5); out.rounds = Math.max(1, f.rounds - (f.fmt === "tabata" ? 2 : 1)); }
    if (r >= 3) out.rounds = f.rounds + (f.fmt === "tabata" ? 0 : 1);
  }
  out.adapted = r === 0 ? "Version Reprise : moins de tours, plus de récupération, exercices sans impact." : r >= 3 ? "Version Haut niveau : un tour de plus." : "";
  return out;
}
function seqFlash(f) {
  const seq = [{ kind: "prep", secs: 10, e: f.items[0].use, label: "Prépare-toi" }];
  const work = (it, secs, round) => (it.side ? [{ kind: "work", secs: Math.round(secs / 2), e: it.use, anim: it.anim, label: "Côté droit", round }, { kind: "work", secs: Math.round(secs / 2), e: it.use, anim: it.anim, label: "Côté gauche", round }] : [{ kind: "work", secs, e: it.use, anim: it.anim, label: "", round }]);
  if (f.fmt === "circuit") {
    for (let r = 1; r <= f.rounds; r++) f.items.forEach((it, i) => {
      seq.push(...work(it, f.work, r));
      const lastItem = i === f.items.length - 1, lastRound = r === f.rounds;
      if (!(lastItem && lastRound)) seq.push({ kind: "rest", secs: lastItem && f.restRound ? f.restRound : f.rest, e: lastItem ? f.items[0].use : f.items[i + 1].use, anim: lastItem ? f.items[0].anim : f.items[i + 1].anim, label: lastItem ? "Fin du tour " + r : "Récupère", round: r });
    });
  } else if (f.fmt === "tabata") {
    f.items.forEach((it, b) => {
      for (let r = 1; r <= f.rounds; r++) { seq.push({ kind: "work", secs: f.work, e: it.use, anim: it.anim, label: "Série " + r + " sur " + f.rounds, round: r }); if (r < f.rounds) seq.push({ kind: "rest", secs: f.rest, e: it.use, anim: it.anim, label: "Récupère", round: r }); }
      if (b < f.items.length - 1) seq.push({ kind: "rest", secs: f.restRound || 60, e: f.items[b + 1].use, anim: f.items[b + 1].anim, label: "Bloc suivant" });
    });
  } else if (f.fmt === "emom") {
    for (let r = 1; r <= f.rounds; r++) f.items.forEach((it) => seq.push({ kind: "emom", secs: 60, e: it.use, anim: it.anim, reps: it.reps, label: "Minute " + ((r - 1) * f.items.length + f.items.indexOf(it) + 1), round: r }));
  } else seq.push({ kind: "amrap", secs: f.secs || 600, e: f.items[0].use, items: f.items, label: "Le plus de tours possible" });
  return seq;
}
function seqRecup(r) {
  const seq = [{ kind: "prep", secs: 8, e: r.steps[0].e, label: "Installe-toi" }];
  r.steps.forEach((st, i) => {
    if (st.side) { seq.push({ kind: "hold", secs: st.s, e: st.e, label: "Côté droit", breath: st.breath }, { kind: "switch", secs: 5, e: st.e, label: "Change de côté" }, { kind: "hold", secs: st.s, e: st.e, label: "Côté gauche", breath: st.breath }); }
    else seq.push({ kind: "hold", secs: st.s, e: st.e, label: st.n || "", breath: st.breath });
    if (i < r.steps.length - 1) seq.push({ kind: "switch", secs: 6, e: r.steps[i + 1].e, label: "Ensuite" });
  });
  return seq;
}
function seqSecs(seq) { return seq.reduce((s, x) => s + x.secs, 0); }
function fmtClock(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function minLabel(secs) { return Math.max(1, Math.round(secs / 60)) + " min"; }

/* ---------- son et voix ---------- */
let _ac = null;
function beep(freq, dur) {
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.frequency.value = freq || 880; o.type = "sine"; g.gain.value = 0.08;
    o.connect(g); g.connect(_ac.destination); o.start(); o.stop(_ac.currentTime + (dur || 0.12));
  } catch (e) {}
}
function say(text) { try { if (!window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR"; u.rate = 1.05; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) {} }

/* ---------- lecteur minuté ---------- */
function TimerPlayer({ title, seq, kind, onFinish, onClose }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(seq[0].secs);
  const [run, setRun] = useState(false);
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState(false);
  const [rounds, setRounds] = useState(0);
  const st = useRef({ i: 0, left: seq[0].secs, last: 0, elapsed: 0 });
  const wake = useRef(null);
  const speed = window.__TIMER_SPEED || 1;
  const cur = seq[i], next = seq[i + 1];
  const announce = (k) => { const s = seq[k]; if (!s) return; if (voice) say((s.kind === "rest" || s.kind === "switch" ? "Récupère. Ensuite : " : "") + exName(s.e) + (s.label && s.kind !== "rest" ? ", " + s.label : "")); if (sound) beep(s.kind === "work" || s.kind === "hold" || s.kind === "emom" ? 990 : 660, 0.18); };
  useEffect(() => {
    if (!run) { try { wake.current && wake.current.release(); } catch (e) {} wake.current = null; return undefined; }
    try { navigator.wakeLock && navigator.wakeLock.request("screen").then((w) => { wake.current = w; }, () => {}); } catch (e) {}
    st.current.last = performance.now();
    const t = setInterval(() => {
      const now = performance.now(), dt = ((now - st.current.last) / 1000) * speed; st.current.last = now;
      st.current.elapsed += dt;
      let l = st.current.left - dt;
      const prevCeil = Math.ceil(st.current.left);
      if (sound && Math.ceil(l) < prevCeil && Math.ceil(l) <= 3 && Math.ceil(l) >= 1) beep(740, 0.08);
      if (l <= 0) {
        const k = st.current.i + 1;
        if (k >= seq.length) { clearInterval(t); setRun(false); setLeft(0); if (sound) beep(1200, 0.4); onFinish({ secs: st.current.elapsed / speed, rounds }); return; }
        st.current.i = k; l = seq[k].secs + l; setI(k); announce(k);
      }
      st.current.left = l; setLeft(l);
    }, 100);
    return () => clearInterval(t);
  }, [run, sound, voice, rounds]);
  useEffect(() => () => { try { wake.current && wake.current.release(); } catch (e) {} try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} }, []);
  const jump = (k) => { if (k < 0 || k >= seq.length) return; st.current.i = k; st.current.left = seq[k].secs; setI(k); setLeft(seq[k].secs); announce(k); };
  const start = () => { if (!run && i === 0 && left === seq[0].secs) announce(0); setRun(!run); };
  const total = seqSecs(seq), done = seq.slice(0, i).reduce((s, x) => s + x.secs, 0) + (cur.secs - left);
  const showE = cur.kind === "rest" || cur.kind === "switch" || cur.kind === "prep" ? (cur.e || (next && next.e)) : cur.e;
  const anim = cur.anim || (next && (cur.kind === "rest" || cur.kind === "switch") ? next.anim : null);
  const ex = EXB[showE] || null;
  const tone = cur.kind === "work" || cur.kind === "emom" || cur.kind === "amrap" ? "work" : cur.kind === "hold" ? "hold" : "rest";
  const breath = cur.breath ? (Math.floor((cur.secs - left) / cur.breath[0]) % 2 === 0 ? "Inspire" : "Expire") : null;
  return html`<div className="player timer">
    <header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Quitter">‹</button>
      <div><div className="eyebrow">${kind === "recup" ? "Récup et bien-être" : "Séance flash"} · ${fmtClock(total - done)} restant</div><h2>${title}</h2></div></header>
    <div className="tm-bar"><span style=${{ width: Math.min(100, (100 * done) / total) + "%" }}></span></div>
    <section className=${"tm-main " + tone}>
      <div className="tm-k">${{ prep: "Prépare-toi", work: "Effort", rest: "Récupère", hold: "Tiens", switch: cur.label === "Change de côté" ? "Change de côté" : "Ensuite", emom: "Cette minute", amrap: "AMRAP" }[cur.kind]}${cur.round && FLASH.length ? " · tour " + cur.round : ""}</div>
      <div className="tm-clock" aria-live="off">${fmtClock(left)}</div>
      ${breath ? html`<div className=${"tm-breath " + (breath === "Inspire" ? "in" : "out")}><span></span><b>${breath}</b></div>` : null}
      <div className="tm-ex"><b>${exName(showE)}</b>${cur.reps ? html` <span className="tm-reps">${cur.reps} rép.</span>` : null}${cur.label && !["rest", "switch", "prep"].includes(cur.kind) ? html`<span className="muted small"> · ${cur.label}</span>` : null}</div>
      ${cur.kind === "amrap" ? html`<ul className="tm-amrap">${cur.items.map((it, k) => html`<li key=${k}><b>${it.reps}</b> ${exName(it.use)}</li>`)}</ul>
        <div className="btnrow center"><${Btn} kind="ghost" onClick=${() => setRounds(rounds + 1)}>+1 tour</${Btn}><span className="tm-rounds">${plural(rounds, "tour")}</span></div>` : null}
      <div className="tm-anim"><${MoveAnim} key=${(anim || showE) + "-" + i} id=${anim || showE} ex=${ex} compact=${true} /></div>
      ${ex && ex.cues && ex.cues[0] ? html`<p className="muted small center">${ex.cues[0]}</p>` : null}
      ${next ? html`<p className="tm-next">Ensuite : <b>${next.kind === "rest" || next.kind === "switch" ? (next.label === "Change de côté" ? "change de côté" : "récupération " + next.secs + " s") : exName(next.e)}</b></p>` : html`<p className="tm-next">Dernier effort !</p>`}
    </section>
    <div className="tm-ctl">
      <${Btn} kind="ghost" small onClick=${() => jump(i - 1)} disabled=${i === 0}>Précédent</${Btn}>
      <${Btn} onClick=${start}>${run ? "Pause" : i === 0 && left === seq[0].secs ? "Démarrer" : "Reprendre"}</${Btn}>
      <${Btn} kind="ghost" small onClick=${() => (i === seq.length - 1 ? (setRun(false), onFinish({ secs: st.current.elapsed / speed, rounds })) : jump(i + 1))}>Suivant</${Btn}>
    </div>
    <div className="btnrow center"><label className="chk inline"><input type="checkbox" checked=${sound} onChange=${(e) => setSound(e.target.checked)} /><span>Bips</span></label>
      <label className="chk inline"><input type="checkbox" checked=${voice} onChange=${(e) => setVoice(e.target.checked)} /><span>Voix</span></label>
      <button type="button" className="linkbtn" onClick=${() => { setRun(false); onFinish({ secs: st.current.elapsed / speed, rounds, early: true }); }}>Terminer maintenant</button></div>
  </div>`;
}

/* ---------- fin de séance libre ---------- */
function FreeFinish({ title, kind, sid, secs, rounds, early, src, niveau, onDone }) {
  const toast = useToast();
  const [rpe, setRpe] = useState(kind === "recup" ? 2 : null);
  const [duree, setDuree] = useState(Math.max(1, Math.round((secs || 0) / 60)));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (rpe === null) { toast("Indique ton effort ressenti (0 à 10).", "warn"); return; }
    setBusy(true);
    const id = rid("l");
    try { await src.saveLibre(id, { id, d: todayISO(), at: nowISO(), kind, sid, n: title, duree: num(duree) || 0, rpe, load: rpe * (num(duree) || 0), rounds: rounds || undefined, comment: comment.trim() || undefined, niveau, early: early || undefined }); toast("Séance enregistrée.", "ok"); onDone(); }
    catch (e) { toast("Enregistrement impossible. Réessaie.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="stack">
    <div className="hero"><div className="eyebrow">${early ? "Séance arrêtée" : "Séance terminée"}</div><h1>${early ? "C'est noté, chaque minute compte." : "Bravo, séance bouclée !"}</h1>
      <p className="muted">${title}${rounds ? " · " + plural(rounds, "tour") : ""}</p></div>
    <${Card} title="Ton ressenti">
      <${Field} label="Effort ressenti (0 à 10)" hint=${rpe !== null ? RPE_LABELS[rpe] : "0 = repos, 10 = maximal"}><${Scale} id="fx-rpe" min=${0} max=${10} value=${rpe} onChange=${setRpe} /></${Field}>
      <div className="row2"><${Field} label="Durée (minutes)" id="fx-duree"><input id="fx-duree" inputMode="numeric" value=${duree} onChange=${(e) => setDuree(e.target.value)} /></${Field}></div>
      <${Field} label="Commentaire (facultatif)" id="fx-com"><textarea id="fx-com" rows="2" value=${comment} onChange=${(e) => setComment(e.target.value)}></textarea></${Field}>
      <p className="muted small">La charge (effort × durée) s'ajoute à celle de ta semaine (Foster, 2001).</p>
      <div className="actions"><${Btn} block onClick=${save} disabled=${busy}>Enregistrer</${Btn}><${Btn} kind="quiet" onClick=${onDone}>Ne pas enregistrer</${Btn}></div></${Card}>
  </div>`;
}

/* ---------- catalogue ---------- */
function refList(keys) { return html`<ol className="refs">${(keys || []).map((k) => XREFS[k] ? html`<li key=${k}>${XREFS[k]}</li>` : null)}</ol>`; }
function ExtrasScreen({ data, plan, src, tab0, onClose, locked, onLocked }) {
  const [tab, setTab] = useState(tab0 || "flash");
  const [mat, setMat] = useState("tout");
  const [sel, setSel] = useState(null); // {kind, s}
  const [play, setPlay] = useState(null); // {kind, s, seq}
  const [fin, setFin] = useState(null);
  const niveau = effNiveau(plan, data.profile);
  const libres = Object.values(data.libres || {}).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  useEffect(() => { try { window.scrollTo(0, 0); } catch (e) {} }, [sel, play, fin, tab]);
  if (fin) return html`<div className="player"><${FreeFinish} ...${fin} src=${src} niveau=${niveau} onDone=${() => { setFin(null); setPlay(null); setSel(null); }} /></div>`;
  if (play) return html`<${TimerPlayer} title=${play.s.n} seq=${play.seq} kind=${play.kind} onClose=${() => setPlay(null)} onFinish=${(r) => setFin({ title: play.s.n, kind: play.kind, sid: play.s.id, ...r })} />`;
  if (sel) {
    const s = sel.kind === "flash" ? flashAdapt(sel.s, niveau) : sel.s;
    const seq = sel.kind === "flash" ? seqFlash(s) : seqRecup(s);
    const go = () => { if (locked) { onLocked(); return; } setPlay({ kind: sel.kind, s, seq }); };
    return html`<div className="player">
      <header className="p-top"><button type="button" className="back" onClick=${() => setSel(null)} aria-label="Retour">‹</button>
        <div><div className="eyebrow">${sel.kind === "flash" ? FMT_N[s.fmt] + " · " + (MAT_N[s.mat] || s.mat) + " · " + s.obj : s.type + " · " + s.mat}</div><h2>${s.n}</h2></div></header>
      <p className="muted">${s.desc}${s.quand ? " " + s.quand + "." : ""}</p>
      <div className="chips"><${Pill} tone="gold">${minLabel(seqSecs(seq))}</${Pill}>${sel.kind === "flash" && s.fmt !== "amrap" && s.fmt !== "emom" ? html`<${Pill}>${s.rounds} ${s.fmt === "tabata" ? "séries par bloc" : "tours"} · ${s.work} s / ${s.rest} s</${Pill}>` : null}${s.fmt === "emom" ? html`<${Pill}>${s.rounds * s.items.length} minutes</${Pill}>` : null}</div>
      ${s.adapted ? html`<div className="alert gold"><div><b>Adaptée à ton profil ${nivName(niveau)}</b><p>${s.adapted}</p></div></div>` : null}
      <ol className="xlist">${(sel.kind === "flash" ? s.items.map((it) => ({ e: it.use, anim: it.anim, d: it.reps ? it.reps + " rép." : s.fmt === "tabata" ? s.rounds + " × " + s.work + " s" : s.work ? s.work + " s" + (it.side ? " (moitié par côté)" : "") : "" })) : s.steps.map((st) => ({ e: st.e, d: st.s + " s" + (st.side ? " par côté" : "") })))
        .map((x, k) => html`<li key=${k}><div className="xl-anim"><${MoveAnim} id=${x.anim || x.e} ex=${EXB[x.e]} compact=${true} autoplay=${false} /></div><div><b>${exName(x.e)}</b><span className="muted small">${x.d}</span>${EXB[x.e] && EXB[x.e].cues ? html`<span className="small">${EXB[x.e].cues[0]}</span>` : null}</div></li>`)}</ol>
      ${s.science ? html`<${Card} title="Pourquoi ça marche"><p className="small">${s.science}</p>${refList(s.refs)}</${Card}>` : html`<${Card} title="Pourquoi ça marche"><p className="small">${sel.kind === "flash" ? "Des séances courtes et intenses améliorent la condition physique et la santé cardiométabolique, pour beaucoup moins de temps qu'une séance longue (Gillen, 2016). Au poids du corps ou avec des charges légères, travailler près de l'échec construit aussi du muscle (Schoenfeld, 2017)." : ""}</p>${refList(s.refs)}</${Card}>`}
      <p className="muted small">Arrête si une douleur dépasse 3 sur 10 ou en cas de malaise. ${sel.kind === "recup" ? "Étire sans à-coups, jusqu'à une tension supportable, jamais une douleur." : "Échauffe-toi 3 à 5 minutes si tu pars à froid."}</p>
      <div className="actions sticky-go"><${Btn} block onClick=${go}>${locked ? "Accès réservé aux abonnés" : "Commencer la séance"}</${Btn}></div>
    </div>`;
  }
  const flash = FLASH.filter((f) => mat === "tout" || (mat === "aucun" ? !["haltères", "kettlebell", "élastique"].includes(f.mat) : f.mat === mat));
  return html`<div className="player">
    <header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Retour">‹</button>
      <div><div className="eyebrow">Séances en plus</div><h2>${tab === "flash" ? "Séances flash à la maison" : "Récup et bien-être"}</h2></div></header>
    <${Seg} options=${[{ v: "flash", n: "Flash à la maison" }, { v: "recup", n: "Récup et bien-être" }]} value=${tab} onChange=${setTab} />
    ${tab === "flash" ? html`<div className="tabs-scroll"><${Seg} options=${[{ v: "tout", n: "Tout" }, { v: "aucun", n: "Sans matériel" }, { v: "haltères", n: "Haltères" }, { v: "kettlebell", n: "Kettlebell" }, { v: "élastique", n: "Élastique" }]} value=${mat} onChange=${setMat} /></div>
      <p className="muted small">Adaptées à ton profil ${nivName(niveau)}. En plus de ton programme, ou à la place d'une séance si tu n'as que quelques minutes.</p>` : html`<p className="muted small">Étirements, yoga, mobilité, rouleau de massage et respiration. Guidées pas à pas avec un minuteur.</p>`}
    <div className="xgrid">${(tab === "flash" ? flash : RECUP).map((s) => {
      const seq = tab === "flash" ? seqFlash(flashAdapt(s, niveau)) : seqRecup(s);
      const first = tab === "flash" ? s.items[0] : s.steps[0];
      return html`<button key=${s.id} type="button" className="xcard" onClick=${() => setSel({ kind: tab, s })}>
        <div className="xc-anim"><${MoveAnim} id=${first.anim || first.e} ex=${EXB[first.e]} compact=${true} autoplay=${false} /></div>
        <div className="xc-t"><b>${s.n}</b><span className="muted small">${minLabel(seqSecs(seq))} · ${tab === "flash" ? FMT_N[s.fmt] + " · " + (MAT_N[s.mat] || s.mat) : s.type}</span></div></button>`;
    })}</div>
    ${libres.length ? html`<${Card} title="Mes dernières séances en plus">${libres.slice(0, 6).map((l) => html`<div key=${l.id} className="hist"><div className="hist-h"><b>${l.n}</b><span className="muted small">${fmtD(l.d)}</span></div>
      <span className="muted small">${l.duree} min · effort ${l.rpe}/10${l.rounds ? " · " + plural(l.rounds, "tour") : ""}</span></div>`)}</${Card}>` : null}
  </div>`;
}
/* raccourci sur l'écran Aujourd'hui */
function ExtrasTeaser({ open }) {
  return html`<div className="xteaser"><div><b>Séances en plus</b><span className="muted small">Flash à la maison en 10 à 20 min, récup, yoga et respiration</span></div>
    <div className="btnrow"><${Btn} small kind="ghost" onClick=${() => open("flash")}>Flash</${Btn}><${Btn} small kind="ghost" onClick=${() => open("recup")}>Récup</${Btn}></div></div>`;
}
