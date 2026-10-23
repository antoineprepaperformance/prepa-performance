/* ===== Bibliothèque : programmes, séances, exercices, réglages ===== */
function Library({ lib, db, open, edit }) {
  const custom = Object.entries(lib || {}).filter(([, d]) => d.kind === "program");
  const sessions = Object.entries(lib || {}).filter(([, d]) => d.kind === "session");
  const newSession = () => edit({ id: rid("s_"), kind: "session", t: "Nouvelle séance", focus: "", lieu: "Salle", wu: WU_DEFAULT, items: [{ e: "squat_goblet", t: "H12" }], isNew: true });
  const newProgram = () => edit({ id: rid("c_"), kind: "program", n: "Nouveau programme", short: "", desc: "", lieu: "Salle", maison: false, tests: ["poids"], better: {}, habits: [], refs: [],
    blocks: [{ n: "Bloc 1", focus: "", sessions: ["A", "B", "C"].map((id) => ({ id, t: "Séance " + id, focus: "", lieu: "Salle", wu: WU_DEFAULT, items: [] })) }], isNew: true });
  return html`<div className="stack">
    <header className="page-h"><div><h1>Programmes</h1><p className="muted">8 programmes standard en 3 blocs de 4 semaines, plus tes créations.</p></div>
      <div className="btnrow"><${Btn} onClick=${newSession}>Créer une séance</${Btn}><${Btn} kind="ghost" onClick=${newProgram}>Créer un programme</${Btn}></div></header>
    <h2 className="sec">Programmes standard</h2>
    <div className="pgrid wide">${PROGS.map((p) => html`<button key=${p.id} type="button" className="pcard" onClick=${() => open(p)}>
      <b>${p.n}</b><span>${p.short}</span><small>${p.lieu} · ${p.blocks.map((b) => b.n).join(" › ")}</small></button>`)}</div>
    <h2 className="sec">Mes programmes</h2>
    ${custom.length ? html`<div className="pgrid wide">${custom.map(([id, d]) => html`<button key=${id} type="button" className="pcard mine" onClick=${() => open({ ...d, id })}>
      <b>${d.n}</b><span>${d.short || "Programme personnalisé"}</span><small>${plural(d.blocks.length, "bloc")} · ${d.blocks.reduce((s, b) => s + b.sessions.length, 0)} séances</small></button>`)}</div>`
      : html`<p className="muted small">Duplique un programme standard pour l'adapter, ou crée le tien.</p>`}
    <h2 className="sec">Mes séances</h2>
    ${sessions.length ? html`<div className="slist">${sessions.map(([id, s]) => html`<button key=${id} type="button" className="srow" onClick=${() => edit({ ...s, id })}>
      <span className="srow-id">+</span><span className="srow-t"><b>${s.t}</b><span className="muted small">${s.focus || ""} · ${plural((s.items || []).length, "exercice")}</span></span><span className="srow-s">›</span></button>`)}</div>`
      : html`<p className="muted small">Une séance perso peut être ajoutée au plan de n'importe quel client, sur la semaine de ton choix.</p>`}
  </div>`;
}
const WU_DEFAULT = "10 min : 5 min de cardio léger, mobilité des hanches et des chevilles, puis 2 séries progressives du premier exercice.";

function ProgramViewer({ prog, lib, exo, db, onBack, edit }) {
  const toast = useToast();
  const [b, setB] = useState(0);
  const [wib, setWib] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const isCustom = !PB[prog.id];
  const block = prog.blocks[b];
  const dup = () => edit({ ...clone(prog), id: rid("c_"), kind: "program", n: prog.n + " (perso)", isNew: true, from: prog.id });
  const del = async () => { try { await dbDel(db, "library/" + prog.id); toast("Programme supprimé.", "ok"); onBack(); } catch (e) { toast("Suppression impossible.", "bad"); } };
  return html`<div className="stack">
    <button type="button" className="linkbtn back-l" onClick=${onBack}>‹ Programmes</button>
    <header className="page-h"><div><div className="eyebrow">${prog.lieu}${isCustom ? " · personnalisé" : ""}</div><h1>${prog.n}</h1><p className="muted">${prog.desc}</p></div>
      <div className="btnrow">${isCustom ? html`<${Btn} onClick=${() => edit(prog)}>Modifier</${Btn}>` : null}<${Btn} kind="ghost" onClick=${dup}>Dupliquer pour personnaliser</${Btn}></div></header>
    <div className="row-wrap"><${Seg} options=${prog.blocks.map((x, i) => ({ v: i, n: "Bloc " + (i + 1) + " · " + x.n }))} value=${b} onChange=${setB} />
      <${Seg} options=${[1, 2, 3, 4].map((x) => ({ v: x, n: "Semaine " + (b * 4 + x) }))} value=${wib} onChange=${setWib} /></div>
    <p className="muted">${block.focus}${wib === 4 ? " · Semaine d'allègement et tests." : ""}</p>
    <div className="grid3">${block.sessions.map((s) => html`<${Card} key=${s.id} title=${s.id + " · " + s.t} sub=${(s.focus || "") + (s.lieu ? " · " + s.lieu : "")}>
      <ol className="plist">${s.items.map((it, i) => { const ex = exOf(it.e, "salle", prog, exo); return html`<li key=${i}><b>${ex.n}</b><span>${doseOf(it, wib).text}</span>${it.n ? html`<small>${it.n}</small>` : null}</li>`; })}</ol>
    </${Card}>`)}</div>
    <${Card} title="Tests du programme"><div className="chips">${(prog.tests || []).map((t) => html`<${Pill} key=${t}>${TESTS[t] ? TESTS[t].n : t}</${Pill}>`)}</div></${Card}>
    ${prog.science ? html`<${Card} title="Base scientifique"><p className="small">${prog.science}</p><ol className="refs">${(prog.refs || []).map((r, i) => html`<li key=${i}>${r}</li>`)}</ol></${Card}>` : null}
    ${isCustom ? html`<div className="actions">${confirm ? html`<span className="small">Supprimer ce programme ? Les clients qui l'utilisent n'auront plus de séances.</span><${Btn} kind="danger" small onClick=${del}>Supprimer</${Btn}><${Btn} kind="quiet" small onClick=${() => setConfirm(false)}>Annuler</${Btn}>`
      : html`<button type="button" className="linkbtn" onClick=${() => setConfirm(true)}>Supprimer ce programme</button>`}</div>` : null}
  </div>`;
}

/* ---------- Éditeur de programme ou de séance ---------- */
function DocEditor({ doc, db, lib, exo, onDone }) {
  const toast = useToast();
  const [d, setD] = useState(() => { const c = clone(doc); delete c.isNew; return c; });
  const [confirm, setConfirm] = useState(false);
  const save = async () => {
    if (!db) { toast("Ouvre l'application depuis claude.ai pour enregistrer.", "warn"); return; }
    const out = clone(d); delete out.id;
    out.updatedAt = nowISO();
    try { await dbSet(db, "library/" + d.id, out); toast("Enregistré.", "ok"); onDone(); } catch (e) { toast("Enregistrement impossible : " + (e && e.code === "quota_exceeded" ? "espace plein." : "réessaie."), "bad"); }
  };
  const del = async () => { try { await dbDel(db, "library/" + d.id); toast("Supprimé.", "ok"); onDone(); } catch (e) { toast("Suppression impossible.", "bad"); } };
  const exists = !!(lib && lib[d.id]);
  if (d.kind === "session") return html`<div className="stack">
    <button type="button" className="linkbtn back-l" onClick=${onDone}>‹ Programmes</button>
    <header className="page-h"><div><div className="eyebrow">Séance perso</div><h1>${d.t || "Séance"}</h1></div><div className="btnrow"><${Btn} onClick=${save}>Enregistrer</${Btn}></div></header>
    <${SessionEditor} s=${d} onChange=${(s) => setD({ ...d, ...s })} exo=${exo} />
    <div className="actions"><${Btn} onClick=${save}>Enregistrer</${Btn}>${exists ? (confirm ? html`<${Btn} kind="danger" small onClick=${del}>Confirmer la suppression</${Btn}>` : html`<button type="button" className="linkbtn" onClick=${() => setConfirm(true)}>Supprimer</button>`) : null}</div>
  </div>`;
  const setBlock = (i, b) => setD({ ...d, blocks: d.blocks.map((x, k) => (k === i ? b : x)) });
  return html`<div className="stack">
    <button type="button" className="linkbtn back-l" onClick=${onDone}>‹ Programmes</button>
    <header className="page-h"><div><div className="eyebrow">Programme perso${d.from && PB[d.from] ? " · basé sur " + PB[d.from].n : ""}</div><h1>${d.n || "Programme"}</h1></div><div className="btnrow"><${Btn} onClick=${save}>Enregistrer</${Btn}></div></header>
    <${Card} title="Informations"><div className="form">
      <${Field} label="Nom" id="pe-n"><input id="pe-n" value=${d.n} onChange=${(e) => setD({ ...d, n: e.target.value })} /></${Field}>
      <${Field} label="Accroche" id="pe-s"><input id="pe-s" value=${d.short || ""} onChange=${(e) => setD({ ...d, short: e.target.value })} /></${Field}>
      <${Field} label="Description" id="pe-d"><textarea id="pe-d" rows="3" value=${d.desc || ""} onChange=${(e) => setD({ ...d, desc: e.target.value })}></textarea></${Field}>
      <div className="row2"><${Field} label="Lieu" id="pe-l"><input id="pe-l" value=${d.lieu || ""} onChange=${(e) => setD({ ...d, lieu: e.target.value })} /></${Field}>
        <${Field} label="Version maison"><${Seg} options=${[{ v: true, n: "Oui" }, { v: false, n: "Non" }]} value=${!!d.maison} onChange=${(v) => setD({ ...d, maison: v })} /></${Field}></div>
      <${Field} label="Tests"><div className="chips">${Object.entries(TESTS).map(([k, t]) => html`<button key=${k} type="button" className=${"chipbtn" + ((d.tests || []).includes(k) ? " on" : "")} aria-pressed=${(d.tests || []).includes(k)}
        onClick=${() => setD({ ...d, tests: (d.tests || []).includes(k) ? d.tests.filter((x) => x !== k) : [...(d.tests || []), k] })}>${t.n}</button>`)}</div></${Field}>
      <${Field} label="Habitudes quotidiennes (une par ligne)" id="pe-h"><textarea id="pe-h" rows="3" value=${(d.habits || []).join("\n")} onChange=${(e) => setD({ ...d, habits: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}></textarea></${Field}>
    </div></${Card}>
    ${d.blocks.map((b, i) => html`<${Card} key=${i} title=${"Bloc " + (i + 1) + " · semaines " + (i * 4 + 1) + " à " + (i * 4 + 4)}
      action=${d.blocks.length > 1 ? html`<button type="button" className="linkbtn" onClick=${() => setD({ ...d, blocks: d.blocks.filter((_, k) => k !== i) })}>Retirer le bloc</button>` : null}>
      <div className="form"><div className="row2"><${Field} label="Nom du bloc" id=${"b-n-" + i}><input id=${"b-n-" + i} value=${b.n} onChange=${(e) => setBlock(i, { ...b, n: e.target.value })} /></${Field}>
        <${Field} label="Objectif du bloc" id=${"b-f-" + i}><input id=${"b-f-" + i} value=${b.focus || ""} onChange=${(e) => setBlock(i, { ...b, focus: e.target.value })} /></${Field}></div></div>
      ${b.sessions.map((s, k) => html`<details key=${k} className="sess-ed" open=${k === 0 && i === 0}><summary><b>Séance ${s.id}</b> · ${s.t} <span className="muted small">${plural(s.items.length, "exercice")}</span></summary>
        <${SessionEditor} s=${s} exo=${exo} onChange=${(ns) => setBlock(i, { ...b, sessions: b.sessions.map((x, j) => (j === k ? { ...x, ...ns } : x)) })} />
        ${b.sessions.length > 1 ? html`<button type="button" className="linkbtn" onClick=${() => setBlock(i, { ...b, sessions: b.sessions.filter((_, j) => j !== k) })}>Retirer la séance ${s.id}</button>` : null}
      </details>`)}
      ${b.sessions.length < 6 ? html`<${Btn} kind="ghost" small onClick=${() => setBlock(i, { ...b, sessions: [...b.sessions, { id: "ABCDEF"[b.sessions.length], t: "Séance " + "ABCDEF"[b.sessions.length], focus: "", lieu: "Salle", wu: WU_DEFAULT, items: [] }] })}>Ajouter une séance</${Btn}>` : null}
    </${Card}>`)}
    ${d.blocks.length < 3 ? html`<${Btn} kind="ghost" onClick=${() => setD({ ...d, blocks: [...d.blocks, clone(d.blocks[d.blocks.length - 1])].map((x, i) => (i === d.blocks.length ? { ...x, n: "Bloc " + (i + 1) } : x)) })}>Ajouter un bloc (copie du précédent)</${Btn}>` : null}
    <div className="actions"><${Btn} onClick=${save}>Enregistrer le programme</${Btn}>${exists ? (confirm ? html`<${Btn} kind="danger" small onClick=${del}>Confirmer la suppression</${Btn}>` : html`<button type="button" className="linkbtn" onClick=${() => setConfirm(true)}>Supprimer</button>`) : null}</div>
  </div>`;
}
function exerciseOptions(exo) {
  const custom = Object.values(exo || {}).filter((x) => x && x.custom);
  const all = [...EXLIB, ...custom];
  const cats = [...new Set(all.map((e) => e.c))];
  return cats.map((c) => ({ c, items: all.filter((e) => e.c === c).sort((a, b) => a.n.localeCompare(b.n)) }));
}
function SessionEditor({ s, onChange, exo }) {
  const opts = useMemo(() => exerciseOptions(exo), [exo]);
  const setItem = (i, it) => onChange({ items: s.items.map((x, k) => (k === i ? it : x)) });
  const move = (i, d) => { const a = s.items.slice(); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange({ items: a }); };
  const uid = useMemo(() => rid("se"), []);
  return html`<div className="form sess">
    <div className="row2"><${Field} label="Titre" id=${uid + "t"}><input id=${uid + "t"} value=${s.t || ""} onChange=${(e) => onChange({ t: e.target.value })} /></${Field}>
      <${Field} label="Lieu" id=${uid + "l"}><input id=${uid + "l"} value=${s.lieu || ""} onChange=${(e) => onChange({ lieu: e.target.value })} /></${Field}></div>
    <${Field} label="Objectif de la séance" id=${uid + "f"}><input id=${uid + "f"} value=${s.focus || ""} onChange=${(e) => onChange({ focus: e.target.value })} /></${Field}>
    <${Field} label="Échauffement" id=${uid + "w"}><textarea id=${uid + "w"} rows="2" value=${s.wu || ""} onChange=${(e) => onChange({ wu: e.target.value })}></textarea></${Field}>
    <div className="items">${s.items.map((it, i) => {
      const mode = it.w ? "libre" : (it.t || "H12");
      return html`<div className="item" key=${i}>
        <div className="item-h"><span className="exc-n">${i + 1}</span>
          <select id=${uid + "e" + i} aria-label="Exercice" value=${it.e} onChange=${(e) => setItem(i, { ...it, e: e.target.value })}>${opts.map((g) => html`<optgroup key=${g.c} label=${g.c}>${g.items.map((x) => html`<option key=${x.id} value=${x.id}>${x.n}</option>`)}</optgroup>`)}</select>
          <div className="item-btns"><button type="button" onClick=${() => move(i, -1)} aria-label="Monter">↑</button><button type="button" onClick=${() => move(i, 1)} aria-label="Descendre">↓</button>
            <button type="button" onClick=${() => onChange({ items: s.items.filter((_, k) => k !== i) })} aria-label="Retirer">×</button></div></div>
        <div className="row2"><select id=${uid + "m" + i} aria-label="Dose" value=${mode} onChange=${(e) => { const v = e.target.value; if (v === "libre") { const w = [1, 2, 3, 4].map((x) => doseOf(it, x).text); setItem(i, { e: it.e, w, n: it.n }); } else setItem(i, { e: it.e, t: v, r: it.r, n: it.n }); }}>
            ${Object.entries(T).map(([k, t]) => html`<option key=${k} value=${k}>${t.label} (${t.sets[0]}×${t.reps[0]} → ${t.sets[2]}×${t.reps[2]})</option>`)}<option value="libre">Dose libre semaine par semaine</option></select>
          ${it.w ? null : html`<input id=${uid + "r" + i} aria-label="Répétitions imposées" placeholder="Répétitions imposées (ex. 8/jambe)" value=${it.r || ""} onChange=${(e) => setItem(i, { ...it, r: e.target.value || undefined })} />`}</div>
        ${it.w ? html`<div className="row4">${[0, 1, 2, 3].map((k) => html`<input key=${k} id=${uid + "w" + i + k} aria-label=${"Semaine " + (k + 1)} placeholder=${"S" + (k + 1)} value=${it.w[k] || ""} onChange=${(e) => setItem(i, { ...it, w: it.w.map((x, j) => (j === k ? e.target.value : x)) })} />`)}</div>`
          : html`<p className="muted small">Semaines 1 à 4 : ${[1, 2, 3, 4].map((x) => doseOf(it, x).text.split(" · ")[0]).join(" → ")}</p>`}
        <input id=${uid + "n" + i} aria-label="Note" placeholder="Note pour le client (facultatif)" value=${it.n || ""} onChange=${(e) => setItem(i, { ...it, n: e.target.value || undefined })} />
      </div>`;
    })}</div>
    <${Btn} kind="ghost" small onClick=${() => onChange({ items: [...s.items, { e: "squat_goblet", t: "H12" }] })}>Ajouter un exercice</${Btn}>
  </div>`;
}

/* ---------- Exercices ---------- */
function ExercisesView({ exo, db }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Toutes");
  const [sel, setSel] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const custom = Object.values(exo || {}).filter((x) => x && x.custom);
  const all = [...EXLIB, ...custom];
  const cats = ["Toutes", ...new Set(all.map((e) => e.c))];
  const list = all.filter((e) => (cat === "Toutes" || e.c === cat) && (!q || (e.n + " " + e.eq).toLowerCase().includes(q.toLowerCase())));
  const nVideo = all.filter((e) => exo && exo[e.id] && exo[e.id].video).length;
  return html`<div className="stack">
    <header className="page-h"><div><h1>Exercices</h1><p className="muted">${all.length} exercices · ${nVideo} avec ta vidéo. Ajoute tes liens de démonstration (YouTube, Instagram) : tes clients les voient dans leurs séances.</p></div>
      <div className="btnrow"><${Btn} onClick=${() => setNewOpen(true)}>Nouvel exercice</${Btn}></div></header>
    <div className="filters"><input id="q-ex" className="search" placeholder="Rechercher" value=${q} onChange=${(e) => setQ(e.target.value)} />
      <select id="cat-ex" value=${cat} onChange=${(e) => setCat(e.target.value)}>${cats.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}</select></div>
    <div className="exgrid">${list.map((e) => html`<button key=${e.id} type="button" className="exitem" onClick=${() => setSel(e)}>
      ${hasMotion(e.id, e) ? html`<span className="exi-anim"><${MoveAnim} id=${e.id} ex=${e} compact=${true} autoplay=${false} /></span>` : null}<b>${e.n}</b><span className="muted small">${e.c} · ${e.eq}</span>${exo && exo[e.id] && exo[e.id].video ? html`<${Pill} tone="gold">vidéo</${Pill}>` : null}${e.custom ? html`<${Pill}>perso</${Pill}>` : null}</button>`)}</div>
    <${Modal} open=${!!sel} title=${sel ? sel.n : ""} onClose=${() => setSel(null)}>${sel ? html`<${ExerciseEdit} e=${sel} ov=${exo && exo[sel.id]} db=${db} onDone=${() => setSel(null)} />` : null}</${Modal}>
    <${Modal} open=${newOpen} title="Nouvel exercice" onClose=${() => setNewOpen(false)}>${newOpen ? html`<${ExerciseEdit} e=${{ id: rid("x_"), n: "", c: "Bas du corps", eq: "", cues: [], custom: true, isNew: true }} db=${db} onDone=${() => setNewOpen(false)} />` : null}</${Modal}>
  </div>`;
}
function ExerciseEdit({ e, ov, db, onDone }) {
  const toast = useToast();
  const isCustom = !!e.custom;
  const [f, setF] = useState({ n: e.n, c: e.c, eq: e.eq, cues: (e.cues || []).join("\n"), video: (ov && ov.video) || e.video || "", note: (ov && ov.note) || "", anim: e.anim || "" });
  const save = async () => {
    if (!db) { toast("Ouvre l'application depuis claude.ai pour enregistrer.", "warn"); return; }
    if (f.video && !/^https:\/\//.test(f.video.trim())) { toast("Le lien de la vidéo doit commencer par https://", "warn"); return; }
    const out = isCustom ? { custom: true, id: e.id, n: f.n.trim() || "Exercice", c: f.c, eq: f.eq, cues: f.cues.split("\n").map((x) => x.trim()).filter(Boolean), video: f.video.trim(), note: f.note.trim(), anim: f.anim || null }
      : { video: f.video.trim(), note: f.note.trim() };
    try { await dbSet(db, "exercises/" + e.id, out); toast("Exercice enregistré.", "ok"); onDone(); } catch (err) { toast("Enregistrement impossible.", "bad"); }
  };
  return html`<div className="form">
    ${hasMotion(e.id, { ...e, anim: f.anim }) ? html`<${MoveAnim} key=${f.anim || e.id} id=${e.id} ex=${{ ...e, anim: f.anim || e.anim }} />` : null}
    ${isCustom ? html`<${Field} label="Animation" id="xe-an" hint="Le mouvement montré à tes clients pour cet exercice."><select id="xe-an" value=${f.anim} onChange=${(x) => setF({ ...f, anim: x.target.value })}>
      <option value="">Aucune</option>${Object.keys(MOVES).sort((a, b) => (MOVES[a].n || a).localeCompare(MOVES[b].n || b)).map((k) => html`<option key=${k} value=${k}>${MOVES[k].n || k}</option>`)}</select></${Field}>` : null}
    ${isCustom ? html`<${Field} label="Nom" id="xe-n"><input id="xe-n" value=${f.n} onChange=${(x) => setF({ ...f, n: x.target.value })} /></${Field}>
      <div className="row2"><${Field} label="Catégorie" id="xe-c"><select id="xe-c" value=${f.c} onChange=${(x) => setF({ ...f, c: x.target.value })}>${CATS.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}</select></${Field}>
        <${Field} label="Matériel" id="xe-eq"><input id="xe-eq" value=${f.eq} onChange=${(x) => setF({ ...f, eq: x.target.value })} /></${Field}></div>
      <${Field} label="Consignes (une par ligne)" id="xe-cu"><textarea id="xe-cu" rows="4" value=${f.cues} onChange=${(x) => setF({ ...f, cues: x.target.value })}></textarea></${Field}>`
      : html`<p className="muted small">${e.c} · ${e.eq}</p><ul className="small">${(e.cues || []).map((c, i) => html`<li key=${i}>${c}</li>`)}</ul>
        ${e.reg || e.prog ? html`<p className="small muted">${e.reg ? "Plus facile : " + e.reg + ". " : ""}${e.prog ? "Plus difficile : " + e.prog + "." : ""}</p>` : null}
        ${e.alt && EXB[e.alt] ? html`<p className="small">Version maison : <b>${EXB[e.alt].n}</b></p>` : null}`}
    <${Field} label="Lien de ta vidéo de démonstration" id="xe-v" hint="YouTube, Instagram, Google Drive… Le lien s'ouvre dans un nouvel onglet."><input id="xe-v" type="url" value=${f.video} onChange=${(x) => setF({ ...f, video: x.target.value })} placeholder="https://" /></${Field}>
    <${Field} label="Ta note (visible par les clients)" id="xe-no"><input id="xe-no" value=${f.note} onChange=${(x) => setF({ ...f, note: x.target.value })} placeholder="Ex. garde les talons au sol" /></${Field}>
    <${Btn} onClick=${save}>Enregistrer</${Btn}>
  </div>`;
}

/* ---------- Réglages ---------- */
function SettingsView({ settings, db, dl, rows }) {
  const toast = useToast();
  const s0 = settings || {};
  const [coach, setCoach] = useState({ name: COACH_NAME_DEFAULT, phone: "", email: "", instagram: "", ...(s0.coach || {}) });
  const [offers, setOffers] = useState(() => Object.fromEntries(OFFERS.map((o) => [o.id, ((s0.offers && s0.offers[o.id]) || o.prix).slice()])));
  const [busy, setBusy] = useState(false);
  const aiInit = () => { const c = aiConf(s0, null); return { on: c.on, rules: c.rules, allow: { ...c.allow } }; };
  const [aiS, setAiS] = useState(aiInit);
  const payInit = () => ({ mode: "manuel", info: "", links: {}, ...(s0.pay || {}) });
  const [pay, setPay] = useState(payInit);
  const legInit = () => ({ ...legalInfo({}), ...(s0.legal || {}) });
  const liteInit = () => ({ on: true, mois: LITE.prix.mois, an: LITE.prix.an, portail: "", ...(s0.lite || {}) });
  const [lite, setLite] = useState(liteInit);
  const [vid, setVid] = useState((s0.video && s0.video.coach) || "suivi");
  const [leg, setLeg] = useState(legInit);
  useEffect(() => { if (settings) { setCoach({ name: COACH_NAME_DEFAULT, phone: "", email: "", instagram: "", ...(settings.coach || {}) }); if (settings.offers) setOffers({ ...offers, ...settings.offers }); setAiS(aiInit()); setPay(payInit()); setLeg(legInit()); setLite(liteInit()); setVid((settings.video && settings.video.coach) || "suivi"); } }, [settings && settings.updatedAt]);
  const badLinks = Object.entries(pay.links || {}).filter(([, v]) => v && !/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com|[a-z0-9.-]+)\//.test(v.trim()));
  const badUrl = [pay.relay, lite.portail].some((v) => v && !/^https:\/\/[a-z0-9.-]+/i.test(String(v).trim()));
  const LITE_LINKS = [["mois_abo", "Mensuel · abonnement"], ["an_abo", "Annuel · abonnement"], ["mois_avance", "Mensuel · paiement d'avance"], ["an_avance", "Annuel · paiement d'avance"]];
  const setLink = (k, v) => setPay({ ...pay, links: { ...(pay.links || {}), [k]: v } });
  const save = async () => {
    if (!db) { toast("Ouvre l'application depuis claude.ai pour enregistrer.", "warn"); return; }
    if (badLinks.length) { toast("Lien de paiement invalide : il doit commencer par https://", "warn"); return; }
    if (badUrl) { toast("Adresse invalide : elle doit commencer par https://", "warn"); return; }
    const links = Object.fromEntries(Object.entries(pay.links || {}).map(([k, v]) => [k, String(v || "").trim()]).filter(([, v]) => v));
    try { await dbSet(db, "settings/app", { ...(settings || {}), video: { coach: vid }, coach, offers: Object.fromEntries(Object.entries(offers).map(([k, v]) => [k, v.map((x) => num(x) || 0)])), ai: { on: aiS.on, rules: aiS.rules.trim(), allow: aiS.allow },
      pay: { mode: pay.mode, info: String(pay.info || "").trim(), links, relay: String(pay.relay || "").trim() }, lite: { on: lite.on !== false, mois: num(lite.mois) || LITE.prix.mois, an: num(lite.an) || LITE.prix.an, portail: String(lite.portail || "").trim() }, legal: Object.fromEntries(Object.entries(leg).map(([k, v]) => [k, String(v || "").trim()])), updatedAt: nowISO() }); toast("Réglages enregistrés.", "ok"); }
    catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  const lf = (k, n, ph, hint) => html`<${Field} label=${n} id=${"lg-" + k} hint=${hint}><input id=${"lg-" + k} value=${leg[k] || ""} placeholder=${ph || ""} onChange=${(e) => setLeg({ ...leg, [k]: e.target.value })} /></${Field}>`;
  const siteBase = (() => { try { return location.origin + location.pathname.replace(/index\.html$/, ""); } catch (e) { return ""; } })();
  const exportAll = async () => {
    if (!db || !dl) { toast("La sauvegarde n'est pas disponible dans cette vue.", "warn"); return; }
    setBusy(true);
    try {
      const out = { exportedAt: nowISO(), clients: {} };
      for (const r of rows.filter((x) => !x.demo)) {
        const base = "clients/" + r.cid;
        const sub = {};
        for (const k of ["logs", "checkins", "tests", "habits", "food", "nutri", "ai", "chat", "media", "orders"]) { const snap = await db.collection(base + "/" + k).get(); sub[k] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])); }
        out.clients[r.cid] = { profile: r.profile, plan: r.plan, replies: r.replies, ...sub };
      }
      const lib = await db.collection("library").get(); out.library = Object.fromEntries(lib.docs.map((d) => [d.id, d.data()]));
      const ex = await db.collection("exercises").get(); out.exercises = Object.fromEntries(ex.docs.map((d) => [d.id, d.data()]));
      await dl.save({ filename: "sauvegarde-suivi-" + todayISO() + ".json", data: JSON.stringify(out, null, 2) });
    } catch (e) { toast("Sauvegarde annulée ou impossible.", "warn"); } finally { setBusy(false); }
  };
  return html`<div className="stack">
    <header className="page-h"><div><h1>Offres & réglages</h1></div><div className="btnrow"><${Btn} onClick=${save}>Enregistrer</${Btn}></div></header>
    <${Card} title="Tes coordonnées" sub="Affichées à tes clients dans leur profil"><div className="form">
      <div className="row2"><${Field} label="Prénom affiché" id="st-n"><input id="st-n" value=${coach.name} onChange=${(e) => setCoach({ ...coach, name: e.target.value })} /></${Field}>
        <${Field} label="Instagram" id="st-i"><input id="st-i" value=${coach.instagram} onChange=${(e) => setCoach({ ...coach, instagram: e.target.value })} placeholder="@antoine-prepa-performance" /></${Field}></div>
      <div className="row2"><${Field} label="Téléphone" id="st-p"><input id="st-p" value=${coach.phone} onChange=${(e) => setCoach({ ...coach, phone: e.target.value })} /></${Field}>
        <${Field} label="E-mail" id="st-e"><input id="st-e" value=${coach.email} onChange=${(e) => setCoach({ ...coach, email: e.target.value })} /></${Field}></div></div></${Card}>
    <${Card} title="Paiement en ligne" sub="Le client n'a accès au programme qu'après paiement, ou avec un code que tu lui donnes">
      <div className="form">
        <${Field} label="Activation après paiement"><${Seg} options=${[{ v: "manuel", n: "Je confirme moi-même" }, ...(window.IS_SITE ? [{ v: "auto", n: "Automatique (relais installé)" }] : [])]} value=${pay.mode} onChange=${(v) => setPay({ ...pay, mode: v })} /></${Field}>
        <p className="muted small">${pay.mode === "auto" ? "Le relais de paiement confirme chaque paiement Stripe et le site active l'accès tout seul, en quelques secondes." : "Chaque commande apparaît dans « À traiter » : vérifie le paiement dans Stripe puis clique sur « Paiement reçu · activer »."}</p>
        <div className="tscroll"><table className="ptable linktable"><thead><tr><th>Lien Stripe</th>${DURS.map((d) => html`<th key=${d.w}>${d.n}</th>`)}</tr></thead>
          <tbody>${OFFERS.map((o) => html`<tr key=${o.id}><th>${o.n}</th>${DURS.map((d) => html`<td key=${d.w}><input id=${"pl-" + o.id + d.w} aria-label=${"Lien " + o.n + " " + d.n} placeholder="https://buy.stripe.com/…" value=${(pay.links || {})[o.id + "_" + d.w] || ""} onChange=${(e) => setPay({ ...pay, links: { ...(pay.links || {}), [o.id + "_" + d.w]: e.target.value } })} /></td>`)}</tr>`)}</tbody></table></div>
        ${badLinks.length ? html`<p className="small warn-t">Un lien doit commencer par https://</p>` : null}
        <p className="muted small">Dans Stripe, crée un lien de paiement par formule et par durée, au prix de la grille ci-dessous. Dans « Après le paiement », choisis « Rediriger vers votre site » : <span className="mono">${siteBase}?paiement=ok&session_id={CHECKOUT_SESSION_ID}</span>. Sans lien, le client commande et tu encaisses à ta façon.</p>
        ${window.IS_SITE ? html`<${Field} label="Adresse du relais (facultatif)" id="pay-relay" hint="Avec la clé Stripe du relais, la résiliation d'un abonnement Lite arrête aussitôt les prélèvements (voir MISE_EN_LIGNE.md)."><input id="pay-relay" value=${pay.relay || ""} placeholder="https://relais-paiement.ton-compte.workers.dev" onChange=${(e) => setPay({ ...pay, relay: e.target.value })} /></${Field}>` : null}
        <${Field} label="Consignes de paiement sans lien Stripe (facultatif)" id="pay-info"><textarea id="pay-info" rows="2" value=${pay.info || ""} onChange=${(e) => setPay({ ...pay, info: e.target.value })} placeholder="Ex. Je t'envoie un lien de paiement ou un RIB par e-mail sous 24 h."></textarea></${Field}>
      </div></${Card}>
    <${Card} title="Correction vidéo" sub="Le client filme son mouvement, garde 3 images et te les envoie avec ses repères">
      <${Field} label="Envoi à toi possible pour"><${Seg} options=${[{ v: "suivi", n: "Formule Suivi" }, { v: "toutes", n: "Essentiel, Suivi et Hybride" }]} value=${vid} onChange=${setVid} /></${Field}>
      <p className="muted small">Le forfait Lite garde la fiche animée et l'autocontrôle vidéo, sans envoi au coach.</p></${Card}>
    <${Card} title="Forfait Lite" sub=${"En autonomie : programmes, séances flash, récup, recettes et santé au quotidien, sans réponse aux bilans" + (window.IS_SITE ? " et sans correction vidéo par toi" : ", sans correction vidéo par toi et sans coach IA")}>
      <div className="form">
        <${Field} label="Proposé à l'inscription"><${Seg} options=${[{ v: true, n: "Oui" }, { v: false, n: "Non" }]} value=${lite.on !== false} onChange=${(v) => setLite({ ...lite, on: v })} /></${Field}>
        <div className="row2"><${Field} label="Prix mensuel (€)" id="lt-m"><input id="lt-m" inputMode="decimal" value=${lite.mois} onChange=${(e) => setLite({ ...lite, mois: e.target.value })} /></${Field}>
          <${Field} label="Prix annuel (€)" id="lt-a"><input id="lt-a" inputMode="decimal" value=${lite.an} onChange=${(e) => setLite({ ...lite, an: e.target.value })} /></${Field}></div>
        <div className="tscroll"><table className="ptable linktable"><thead><tr><th>Lien Stripe Lite</th><th>Lien</th></tr></thead>
          <tbody>${LITE_LINKS.map(([k, n]) => html`<tr key=${k}><th>${n}</th><td><input id=${"pl-lite-" + k} aria-label=${"Lien Lite " + n} placeholder="https://buy.stripe.com/…" value=${(pay.links || {})["lite_" + k] || ""} onChange=${(e) => setLink("lite_" + k, e.target.value)} /></td></tr>`)}</tbody></table></div>
        <p className="muted small">Abonnement : dans Stripe, crée un produit « Lite » avec un prix récurrent (mensuel et annuel) puis un lien de paiement pour chacun. Paiement d'avance : un prix unique. Même redirection après paiement que ci-dessus.</p>
        <${Field} label="Portail client Stripe (facultatif)" id="lt-portail" hint="Lien de connexion du portail client Stripe : le client y gère sa carte et ses factures."><input id="lt-portail" value=${lite.portail || ""} placeholder="https://billing.stripe.com/p/login/…" onChange=${(e) => setLite({ ...lite, portail: e.target.value })} /></${Field}>
        ${badUrl ? html`<p className="small warn-t">Une adresse doit commencer par https://</p>` : null}
      </div></${Card}>
    <${Card} title="Informations légales" sub="Obligatoires pour vendre en ligne : elles alimentent les conditions de vente, la confidentialité et les mentions légales">
      <div className="form">
        <div className="row2">${lf("editeur", "Nom de l'entrepreneur")}${lf("marque", "Nom commercial")}</div>
        <div className="row2">${lf("statut", "Statut", "Entrepreneur individuel (micro-entreprise)")}${lf("siret", "SIRET", "123 456 789 00012")}</div>
        ${lf("adresse", "Adresse professionnelle", "Rue, code postal, ville")}
        <div className="row2">${lf("email", "E-mail de contact")}${lf("telephone", "Téléphone")}</div>
        <div className="row2">${lf("diplome", "Diplôme d'éducateur sportif", "Ex. Licence STAPS Entraînement sportif")}${lf("cartePro", "N° de carte professionnelle", "", "Obligatoire pour encadrer contre rémunération, y compris en ligne (code du sport, art. L212-1 et L212-11)")}</div>
        ${lf("assurance", "Assurance responsabilité civile professionnelle", "Assureur, n° de contrat, couverture géographique")}
        <div className="row2">${lf("mediateur", "Médiateur de la consommation", "Nom et adresse du médiateur", "Obligatoire pour vendre à des particuliers (code de la consommation, art. L612-1)")}${lf("mediateurSite", "Site du médiateur", "https://…")}</div>
        <div className="row2"><${Field} label="TVA"><${Seg} options=${[{ v: "franchise", n: "Franchise (non applicable)" }, { v: "assujetti", n: "Assujetti" }]} value=${leg.tva || "franchise"} onChange=${(v) => setLeg({ ...leg, tva: v })} /></${Field}>
          ${leg.tva === "assujetti" ? lf("numTva", "N° de TVA intracommunautaire") : html`<span></span>`}</div>
        ${legalMissing({ legal: leg, coach }).length ? html`<p className="small warn-t">À compléter : ${legalMissing({ legal: leg, coach }).join(", ")}.</p>` : html`<p className="small ok-t">Informations légales complètes.</p>`}
      </div></${Card}>
    <${Card} title="Prix des formules" sub="Affichés lors de l'inscription · 2 mois ≈ −5 %, 3 mois ≈ −10 %">
      <div className="tscroll"><table className="ptable"><thead><tr><th>Formule</th>${DURS.map((d) => html`<th key=${d.w}>${d.n}</th>`)}</tr></thead>
        <tbody>${OFFERS.map((o) => html`<tr key=${o.id}><th>${o.n}<small>${o.desc}</small></th>${DURS.map((d, i) => html`<td key=${d.w}><input id=${"pr-" + o.id + i} inputMode="numeric" aria-label=${o.n + " " + d.n} value=${offers[o.id][i]} onChange=${(e) => setOffers({ ...offers, [o.id]: offers[o.id].map((x, k) => (k === i ? e.target.value : x)) })} /></td>`)}</tr>`)}</tbody></table></div></${Card}>
    ${window.IS_SITE ? null : html`<${Card} title="Coach IA" sub="Répond seul aux questions de tes clients, analyse chaque bilan et ajuste le programme dans des limites de sécurité. L'IA tourne sur le compte Claude du client : rien à payer de ton côté.">
      <div className="form">
        <${Field} label="État"><${Seg} options=${[{ v: true, n: "Activé" }, { v: false, n: "Désactivé" }]} value=${aiS.on} onChange=${(v) => setAiS({ ...aiS, on: v })} /></${Field}>
        <div className="field"><span className="field-l">Ce que le coach IA peut modifier seul</span>
          ${[["nutri", "Les cibles nutritionnelles (calories, macros, pas)"], ["subst", "Remplacer un exercice (douleur, matériel, spécificité du sport)"], ["charge", "Donner une consigne de charge ou un mot pour la semaine"]].map(([k, n]) => html`<label key=${k} className="chk"><input type="checkbox" id=${"ai-" + k} checked=${aiS.allow[k]} onChange=${(e) => setAiS({ ...aiS, allow: { ...aiS.allow, [k]: e.target.checked } })} /><span>${n}</span></label>`)}
          <span className="field-h">Sinon, il propose le changement et te le signale. Chaque ajustement apparaît dans « À traiter » ; tu peux l'annuler depuis la fiche du client.</span></div>
        <${Field} label="Tes consignes (lues par l'IA à chaque réponse)" id="ai-rules" hint="Ta philosophie, tes règles, ce que tu ne veux jamais voir conseillé. Les règles de sécurité restent prioritaires."><textarea id="ai-rules" rows="7" value=${aiS.rules} onChange=${(e) => setAiS({ ...aiS, rules: e.target.value })}></textarea></${Field}>
        <div className="actions"><button type="button" className="linkbtn" onClick=${() => setAiS({ ...aiS, rules: DEFAULT_AI_RULES })}>Rétablir les consignes par défaut</button></div>
      </div></${Card}>`}
    ${window.IS_SITE ? html`<${Card} title="Donner accès à tes clients"><${SiteAccessHowto} /></${Card}>` : html`<${Card} title="Donner accès à tes clients">
      <ol className="howto">
        <li><b>Avec synchronisation :</b> menu Partager de la page › inviter le client par e-mail avec le droit de modification. Il ouvre le lien, crée son compte Claude gratuit et s'inscrit. Ses données privées ne sont visibles que par lui et par toi.</li>
        <li><b>Sans compte :</b> « Ajouter un client » puis envoie-lui le lien de la page et son code d'accès (onglet Plan). Il t'envoie ses données sous forme de texte, que tu importes.</li>
        <li>Les deux modes ne se mélangent pas sur un même lien : si tu partages la page par lien public, les clients invités par e-mail passent eux aussi en mode « sans compte ».</li>
      </ol></${Card}>`}
    ${window.IS_SITE ? html`<${Card} title="Mon compte"><${SignOutLink} /></${Card}>` : null}
    <${Card} title="Sauvegarde" sub="Télécharge toutes les données (clients, séances, bilans, tests, programmes perso)">
      <${Btn} kind="ghost" onClick=${exportAll} disabled=${busy}>${busy ? "Préparation…" : "Télécharger une sauvegarde"}</${Btn}></${Card}>
  </div>`;
}
