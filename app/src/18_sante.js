/* ===== Santé au quotidien : sommeil, pas, FC au repos, VFC, poids, eau ; montres et fichiers d'activité ===== */
const TIPS = CONTENT.TIPS || [];
const SANTE_F = [
  { k: "sommeil", n: "Sommeil", u: "h", step: 0.25, min: 0, max: 16, hint: "Durée de la nuit dernière" },
  { k: "pas", n: "Pas", u: "", min: 0, max: 100000, hint: "Hier ou aujourd'hui" },
  { k: "fcr", n: "FC au repos", u: "bpm", min: 25, max: 130, hint: "Le matin au réveil ou valeur de ta montre" },
  { k: "vfc", n: "VFC", u: "ms", min: 5, max: 300, hint: "Variabilité de la fréquence cardiaque" },
  { k: "poids", n: "Poids", u: "kg", step: 0.1, min: 25, max: 300 },
  { k: "eau", n: "Eau bue", u: "L", step: 0.1, min: 0, max: 10 },
];
function santeDays(data, n, until) { const t = until || todayISO(); return Array.from({ length: n }, (_, i) => addDays(t, i - n + 1)); }
function santeVal(data, d, k) { const x = data.sante && data.sante[d]; return x ? num(x[k]) : null; }
function avgOf(vals) { const v = vals.filter((x) => x !== null && x !== undefined && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
/* référence personnelle : moyenne des 28 jours précédents (hors aujourd'hui), au moins 5 valeurs */
function santeBase(data, k, d) { const days = santeDays(data, 28, addDays(d || todayISO(), -1)); const v = days.map((x) => santeVal(data, x, k)).filter((x) => x !== null); return v.length >= 5 ? avgOf(v) : null; }
/* signal de forme à partir de la montre (Plews 2013, Buchheit 2014) */
function santeFlag(data, d) {
  const day = d || todayISO();
  const fcr = santeVal(data, day, "fcr"), vfc = santeVal(data, day, "vfc"), sl = santeVal(data, day, "sommeil");
  const bF = santeBase(data, "fcr", day), bV = santeBase(data, "vfc", day);
  const notes = []; let lvl = "ok";
  if (fcr !== null && bF !== null && fcr - bF >= 7) { lvl = "prudence"; notes.push("FC au repos " + Math.round(fcr) + " bpm, " + Math.round(fcr - bF) + " de plus que ta moyenne"); }
  if (vfc !== null && bV !== null && vfc < bV * 0.85) { lvl = vfc < bV * 0.75 ? "leger" : lvl === "leger" ? "leger" : "prudence"; notes.push("VFC " + Math.round(vfc) + " ms, " + Math.round((1 - vfc / bV) * 100) + " % sous ta moyenne"); }
  if (sl !== null && sl < 6) { if (lvl === "ok") lvl = "prudence"; notes.push("nuit courte (" + fmtN(sl, 1) + " h)"); }
  return { lvl, notes, fcr, vfc, sl, bF, bV };
}
function refShort(r) { if (!r) return ""; const a = String(r).split(/[ ,]/)[0]; const y = (String(r).match(/\b(19|20)\d{2}\b/) || [""])[0]; return a + (y ? ", " + y : ""); }
function sleepScore(h) { if (h === null || h === undefined) return null; return h >= 8 ? 5 : h >= 7 ? 4 : h >= 6 ? 3 : h >= 5 ? 2 : 1; }
function waterTarget(data) { const np = data.nutri && data.nutri.plan; return np && np.sex === "F" ? 2.0 : 2.5; }
function stepsTarget(data) { const np = data.nutri && data.nutri.plan; return (np && np.targets && np.targets.steps) || 8000; }
function tipOfDay(data) {
  const d7 = santeDays(data, 7);
  const sl = avgOf(d7.map((d) => santeVal(data, d, "sommeil"))), pas = avgOf(d7.map((d) => santeVal(data, d, "pas")));
  const f = santeFlag(data);
  let pool = TIPS;
  if (f.lvl !== "ok" && f.fcr !== null) pool = TIPS.filter((t) => t.k === "fcr" || t.k === "vfc");
  else if (sl !== null && sl < 7) pool = TIPS.filter((t) => t.k === "sommeil");
  else if (pas !== null && pas < 7000) pool = TIPS.filter((t) => t.k === "pas" || t.k === "activite");
  const day = Math.floor(Date.now() / 86400000);
  return pool.length ? pool[day % pool.length] : null;
}

/* ---------- import depuis le Raccourci iPhone (site) : ?sante=1&pas=…&fcr=… ---------- */
function santeFromUrl() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get("sante")) return null;
    const out = { d: /^\d{4}-\d{2}-\d{2}$/.test(q.get("d") || "") ? q.get("d") : todayISO(), src: "iphone" };
    SANTE_F.forEach((f) => {
      let v = num(q.get(f.k));
      /* sommeil reçu en minutes par certains raccourcis (ex. 445 → 7,42 h) */
      if (f.k === "sommeil" && v !== null && v > 16 && v <= 1440) v = v / 60;
      if (v !== null && v >= f.min && v <= f.max) out[f.k] = f.k === "pas" ? Math.round(v) : Math.round(v * 100) / 100;
    });
    return out;
  } catch (e) { return null; }
}
function useSanteImport(src, ready) {
  const toast = useToast();
  /* 1. dès l'ouverture : les valeurs de l'adresse sont mises de côté et l'adresse est nettoyée */
  useEffect(() => {
    const rec = santeFromUrl();
    if (!rec) return;
    try { localStorage.setItem("pending_sante", JSON.stringify(rec)); const u = new URL(location.href); ["sante", "d", ...SANTE_F.map((f) => f.k)].forEach((k) => u.searchParams.delete(k)); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {}
  }, []);
  /* 2. une fois le dossier chargé : fusion avec la journée déjà saisie (jamais d'écrasement) */
  useEffect(() => {
    if (!src || src.mode === "demo" || !ready) return;
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem("pending_sante") || "null"); } catch (e) { rec = null; }
    if (!rec || !rec.d) return;
    const vals = SANTE_F.filter((f) => rec[f.k] !== undefined);
    if (!vals.length) { try { localStorage.removeItem("pending_sante"); } catch (e) {} toast("Aucune valeur valable reçue de ton iPhone : vérifie ton raccourci.", "warn"); return; }
    const cur = (src.get().sante || {})[rec.d] || {};
    src.saveSante(rec.d, { ...cur, ...rec, at: nowISO() }).then(() => { try { localStorage.removeItem("pending_sante"); } catch (e) {} toast("Données santé du " + fmtD(rec.d) + " reçues de ton iPhone : " + vals.map((f) => f.n.toLowerCase()).join(", ") + ".", "ok"); }, () => {});
  }, [src, ready]);
}

/* ---------- fichiers d'activité (GPX, TCX) : on garde le résumé, jamais le tracé GPS ---------- */
function hav(a, b) { const R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
function byLocal(root, name) { return Array.from(root.getElementsByTagName("*")).filter((e) => e.localName === name); }
function firstLocal(root, name) { const all = root.getElementsByTagName("*"); for (let i = 0; i < all.length; i++) if (all[i].localName === name) return all[i]; return null; }
function typeOf(t) { t = normTxt(t || ""); return /run|course|trail|jog/.test(t) ? "course" : /bik|cycl|velo|ride/.test(t) ? "vélo" : /walk|marche|hik|rando/.test(t) ? "marche" : /swim|nat/.test(t) ? "natation" : t ? "autre" : "course"; }
function parseActivity(text, fname) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Fichier illisible.");
  const root = doc.documentElement;
  const hrs = [], eles = [];
  let dist = 0, t0 = null, t1 = null, name = "", type = "";
  if (root.localName === "gpx") {
    const pts = byLocal(root, "trkpt");
    if (!pts.length) throw new Error("Aucun point dans ce fichier GPX.");
    let prev = null;
    pts.forEach((p) => {
      const ll = [Number(p.getAttribute("lat")), Number(p.getAttribute("lon"))];
      if (prev && Number.isFinite(ll[0])) dist += hav(prev, ll);
      prev = ll;
      const e = firstLocal(p, "ele"); if (e) eles.push(Number(e.textContent));
      const tm = firstLocal(p, "time"); if (tm) { const ms = Date.parse(tm.textContent); if (Number.isFinite(ms)) { if (t0 === null) t0 = ms; t1 = ms; } }
      const h = firstLocal(p, "hr"); if (h) hrs.push(Number(h.textContent));
    });
    const n = firstLocal(root, "name"); name = n ? n.textContent.trim() : "";
    const ty = firstLocal(root, "type"); type = ty ? ty.textContent : "";
  } else if (root.localName === "TrainingCenterDatabase") {
    const act = firstLocal(root, "Activity"); type = act ? act.getAttribute("Sport") || "" : "";
    let secs = 0;
    byLocal(root, "Lap").forEach((lap) => { const ts = firstLocal(lap, "TotalTimeSeconds"); if (ts) secs += Number(ts.textContent) || 0; const dm = firstLocal(lap, "DistanceMeters"); if (dm && dm.parentNode === lap) dist += Number(dm.textContent) || 0; });
    byLocal(root, "Trackpoint").forEach((tp) => { const a = firstLocal(tp, "AltitudeMeters"); if (a) eles.push(Number(a.textContent)); const h = firstLocal(tp, "HeartRateBpm"); if (h) { const v = firstLocal(h, "Value"); if (v) hrs.push(Number(v.textContent)); } const tm = firstLocal(tp, "Time"); if (tm) { const ms = Date.parse(tm.textContent); if (Number.isFinite(ms)) { if (t0 === null) t0 = ms; t1 = ms; } } });
    if (secs && t0 !== null) t1 = t0 + secs * 1000;
    const id = firstLocal(root, "Id"); if (id && t0 === null) t0 = Date.parse(id.textContent);
  } else throw new Error("Format non reconnu : exporte ton activité en GPX ou TCX.");
  let gain = 0; for (let i = 1; i < eles.length; i++) { const d = eles[i] - eles[i - 1]; if (Number.isFinite(d) && d > 0.3) gain += d; }
  const hv = hrs.filter((x) => Number.isFinite(x) && x > 30 && x < 240);
  const duree = t0 !== null && t1 !== null ? Math.round((t1 - t0) / 60000) : null;
  const d = t0 !== null && Number.isFinite(t0) ? isoOf(new Date(t0)) : todayISO();
  return { d, n: name || ((fname || "Activité").replace(/\.[^.]+$/, "")), type: typeOf(type || name), duree, dist: dist ? Math.round(dist / 10) / 100 : null, deniv: gain ? Math.round(gain) : null,
    fcMoy: hv.length ? Math.round(avgOf(hv)) : null, fcMax: hv.length ? Math.max(...hv) : null };
}
function ActivityImport({ src, onDone }) {
  const toast = useToast();
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [rpe, setRpe] = useState(null);
  const [manual, setManual] = useState(false);
  const read = async (f) => {
    setErr(""); setA(null);
    if (/\.fit$/i.test(f.name)) { setErr("Les fichiers .fit ne sont pas lus ici : exporte l'activité en GPX ou TCX depuis Garmin Connect, Strava, Polar Flow, Suunto ou Coros."); return; }
    try { setA(parseActivity(await f.text(), f.name)); } catch (e) { setErr(e.message || "Fichier illisible."); }
  };
  const save = async () => {
    if (rpe === null) { toast("Indique l'effort ressenti.", "warn"); return; }
    const id = rid("a");
    const duree = num(a.duree) || 0;
    try { await src.saveActivite(id, { id, ...a, duree, dist: num(a.dist), rpe, load: rpe * duree, src: manual ? "manuel" : "fichier", at: nowISO() }); toast("Activité ajoutée.", "ok"); onDone && onDone(); }
    catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  return html`<div className="stack-s">
    ${!a ? html`<div className="btnrow"><label className="btn ghost" htmlFor="act-file">Importer un fichier GPX ou TCX</label><${Btn} kind="quiet" onClick=${() => { setManual(true); setA({ d: todayISO(), n: "Activité", type: "course", duree: 45, dist: null, deniv: null, fcMoy: null, fcMax: null }); }}>Saisir à la main</${Btn}></div>
      <input id="act-file" className="hide-input" type="file" accept=".gpx,.tcx,.fit,application/gpx+xml,application/xml,text/xml" onChange=${(e) => e.target.files[0] && read(e.target.files[0])} />
      ${err ? html`<p className="small warn-t" role="alert">${err}</p>` : null}` : html`
      <div className="row2"><${Field} label="Date" id="act-d"><input id="act-d" type="date" value=${a.d} onChange=${(e) => setA({ ...a, d: e.target.value })} /></${Field}>
        <${Field} label="Type" id="act-t"><select id="act-t" value=${a.type} onChange=${(e) => setA({ ...a, type: e.target.value })}>${["course", "vélo", "marche", "natation", "match", "autre"].map((t) => html`<option key=${t} value=${t}>${t}</option>`)}</select></${Field}></div>
      <${Field} label="Nom" id="act-n"><input id="act-n" value=${a.n} onChange=${(e) => setA({ ...a, n: e.target.value })} /></${Field}>
      <div className="row2"><${Field} label="Durée (min)" id="act-du"><input id="act-du" inputMode="numeric" value=${a.duree ?? ""} onChange=${(e) => setA({ ...a, duree: e.target.value })} /></${Field}>
        <${Field} label="Distance (km)" id="act-di"><input id="act-di" inputMode="decimal" value=${a.dist ?? ""} onChange=${(e) => setA({ ...a, dist: e.target.value })} /></${Field}></div>
      ${a.fcMoy || a.deniv ? html`<p className="small">${a.fcMoy ? "FC moyenne " + a.fcMoy + " bpm · max " + a.fcMax + " bpm" : ""}${a.fcMoy && a.deniv ? " · " : ""}${a.deniv ? "dénivelé +" + a.deniv + " m" : ""}</p>` : null}
      <${Field} label="Effort ressenti (0 à 10)" hint=${rpe !== null ? RPE_LABELS[rpe] : "Comment c'était, globalement ?"}><${Scale} id="act-rpe" min=${0} max=${10} value=${rpe} onChange=${setRpe} /></${Field}>
      ${!manual ? html`<p className="muted small">Seul le résumé est gardé (date, durée, distance, fréquence cardiaque, dénivelé) : ton tracé GPS n'est pas enregistré.</p>` : null}
      <div className="actions"><${Btn} onClick=${save}>Ajouter l'activité</${Btn}><${Btn} kind="quiet" onClick=${() => { setA(null); setManual(false); }}>Annuler</${Btn}></div>`}
  </div>`;
}

/* ---------- connecter sa montre ---------- */
function WatchHowto() {
  const [k, setK] = useState("iphone");
  const site = typeof siteUrl === "function" ? siteUrl() : "";
  return html`<div className="stack-s">
    <${Seg} options=${[{ v: "iphone", n: "iPhone et Apple Watch" }, { v: "android", n: "Android" }, { v: "montre", n: "Garmin, Polar, Suunto…" }]} value=${k} onChange=${setK} />
    ${k === "iphone" ? html`<div className="small stack-s">
      <p>Les données de l'app Santé ne sont pas accessibles à un site internet. Un Raccourci de ton iPhone les envoie en un geste : pas, sommeil, FC au repos, VFC et poids.</p>
      <ol className="steps-l">
        <li>Ouvre l'app <b>Raccourcis</b> › <b>+</b> › nomme le raccourci « Santé Antoine ».</li>
        <li>Ajoute l'action <b>Rechercher des échantillons de l'app Santé</b> : type <b>Pas</b>, date de début <b>aujourd'hui</b>, regroupés <b>par jour</b>. Fais de même pour <b>Fréquence cardiaque au repos</b>, <b>Variabilité de la fréquence cardiaque</b> et <b>Poids</b>, triés par date, <b>le plus récent</b>, limite 1.</li>
        <li>Ajoute l'action <b>URL</b> avec ce texte, en insérant chaque valeur trouvée à sa place :<br /><code className="mono">${(site || "https://ton-site/") + "?sante=1&pas=[Pas]&fcr=[FC repos]&vfc=[VFC]&poids=[Poids]&sommeil=[heures]"}</code></li>
        <li>Ajoute l'action <b>Ouvrir les URL</b>. Lance le raccourci : le site s'ouvre et enregistre tes valeurs du jour.</li>
        <li>Pour l'automatiser : onglet <b>Automatisation</b> › <b>Heure de la journée</b> › chaque matin, exécuter « Santé Antoine ».</li></ol>
      <p className="muted">Connecte-toi une fois au site dans Safari : c'est lui qui reçoit les données. Les noms des options peuvent changer légèrement selon ta version d'iOS. Sommeil : indique les heures (7.5) ou les minutes (450).</p></div>` : null}
    ${k === "android" ? html`<div className="small stack-s"><p>Health Connect et Google Fit ne sont pas accessibles depuis un site internet. Deux solutions :</p>
      <ul><li><b>Saisie rapide</b> : chaque matin, note sommeil, pas et FC au repos ci-dessus (20 secondes).</li><li><b>Fichier d'activité</b> : pour une course ou une sortie vélo, exporte-la en GPX ou TCX depuis l'app de ta montre et importe-la dans « Mes activités ».</li></ul></div>` : null}
    ${k === "montre" ? html`<div className="small stack-s"><p>Exporte chaque activité depuis l'app de ta montre, puis importe le fichier dans « Mes activités » :</p>
      <ul><li><b>Garmin Connect</b> (site web) : activité › roue dentée › Exporter au format GPX ou TCX.</li><li><b>Strava</b> (site web) : activité › … › Exporter le GPX.</li><li><b>Polar Flow, Suunto, Coros</b> : export GPX ou TCX depuis l'activité.</li></ul>
      <p className="muted">Durée, distance, fréquence cardiaque et dénivelé alimentent ta charge d'entraînement de la semaine.</p></div>` : null}
  </div>`;
}

/* ---------- écran Santé ---------- */
function SanteForm({ data, src, date }) {
  const toast = useToast();
  const cur = (data.sante && data.sante[date]) || {};
  const [v, setV] = useState(() => Object.fromEntries([...SANTE_F.map((f) => [f.k, cur[f.k] ?? ""]), ["qualite", cur.qualite ?? null], ["energie", cur.energie ?? null], ["stress", cur.stress ?? null]]));
  useEffect(() => { const c = (data.sante && data.sante[date]) || {}; setV(Object.fromEntries([...SANTE_F.map((f) => [f.k, c[f.k] ?? ""]), ["qualite", c.qualite ?? null], ["energie", c.energie ?? null], ["stress", c.stress ?? null]])); }, [date]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const out = { ...cur, at: nowISO(), src: cur.src && cur.src !== "manuel" ? cur.src + "+manuel" : "manuel" };
    for (const f of SANTE_F) { const n = num(v[f.k]); if (v[f.k] === "" || v[f.k] === null) { delete out[f.k]; continue; } if (n === null || n < f.min || n > f.max) { toast(f.n + " : valeur hors limites.", "warn"); return; } out[f.k] = f.k === "pas" ? Math.round(n) : n; }
    ["qualite", "energie", "stress"].forEach((k) => { if (v[k] !== null && v[k] !== undefined) out[k] = v[k]; });
    setBusy(true);
    try { await src.saveSante(date, out); toast("Enregistré.", "ok"); } catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="form">
    <div className="sgrid">${SANTE_F.map((f) => html`<${Field} key=${f.k} label=${f.n + (f.u ? " (" + f.u + ")" : "")} id=${"sa-" + f.k} hint=${f.hint}><input id=${"sa-" + f.k} inputMode="decimal" value=${v[f.k]} onChange=${(e) => setV({ ...v, [f.k]: e.target.value })} /></${Field}>`)}</div>
    <${Field} label="Qualité du sommeil"><${Scale} id="sa-q" min=${1} max=${5} value=${v.qualite} onChange=${(x) => setV({ ...v, qualite: x })} lo="Très mauvaise" hi="Excellente" /></${Field}>
    <${Field} label="Énergie"><${Scale} id="sa-e" min=${1} max=${5} value=${v.energie} onChange=${(x) => setV({ ...v, energie: x })} lo="Épuisé" hi="En pleine forme" /></${Field}>
    <${Field} label="Stress"><${Scale} id="sa-s" min=${1} max=${5} value=${v.stress} onChange=${(x) => setV({ ...v, stress: x })} lo="Très stressé" hi="Détendu" /></${Field}>
    <div className="actions"><${Btn} block onClick=${save} disabled=${busy}>Enregistrer</${Btn}></div>
    ${cur.src && cur.src.includes("iphone") ? html`<p className="muted small">Valeurs reçues de ton iPhone le ${fmtDY(String(cur.at).slice(0, 10))}.</p>` : null}
  </div>`;
}
function SanteScreen({ data, src, plan, onClose }) {
  const [date, setDate] = useState(todayISO());
  const [imp, setImp] = useState(false);
  const days14 = santeDays(data, 14);
  const flag = santeFlag(data);
  const tip = tipOfDay(data);
  const d7 = santeDays(data, 7);
  const m = (k) => avgOf(d7.map((d) => santeVal(data, d, k)));
  const bar = (k) => days14.map((d) => ({ x: fmtD(d).split(" ")[0], y: santeVal(data, d, k) || 0, muted: d === todayISO() }));
  const line = (k) => days14.map((d) => ({ x: fmtD(d).split(" ")[0], y: santeVal(data, d, k) })).filter((p) => p.y !== null);
  const acts = Object.values(data.activites || {}).filter(Boolean).sort((a, b) => String(b.d).localeCompare(String(a.d)));
  const tone = { ok: "okb", prudence: "gold", leger: "warn" }[flag.lvl];
  const hasWatch = flag.fcr !== null || flag.vfc !== null;
  const stat = (n, val, unit, target, okf) => html`<div className="sstat"><span className="muted small">${n}</span><b>${val === null ? "—" : fmtN(val, unit === "h" || unit === "L" ? 1 : 0)}${val === null ? "" : unit ? " " + unit : ""}</b>${target ? html`<span className=${"small " + (val !== null && okf(val) ? "ok-t" : "muted")}>${target}</span>` : null}</div>`;
  return html`<div className="player">
    <header className="p-top">${onClose ? html`<button type="button" className="back" onClick=${onClose} aria-label="Retour">‹</button>` : null}
      <div><div className="eyebrow">Santé au quotidien</div><h2>Sommeil, pas, cœur et hydratation</h2></div></header>
    ${hasWatch ? html`<div className=${"alert " + tone}><div><b>${flag.lvl === "ok" ? "Signaux du jour : feu vert" : flag.lvl === "prudence" ? "Signaux du jour : prudence" : "Signaux du jour : récupère"}</b>
      <p>${flag.notes.length ? flag.notes.join(" · ") + ". " : "FC au repos et VFC dans tes valeurs habituelles. "}${flag.lvl === "ok" ? "" : flag.lvl === "prudence" ? "Ta séance s'allège un peu si tu fais le contrôle de forme." : "Préfère une séance légère ou une récup aujourd'hui."}</p></div></div>` : null}
    <div className="sstats">
      ${stat("Sommeil, moyenne 7 j", m("sommeil"), "h", "objectif 7 à 9 h", (x) => x >= 7 && x <= 9.5)}
      ${stat("Pas, moyenne 7 j", m("pas"), "", "objectif " + fmtN(stepsTarget(data), 0), (x) => x >= stepsTarget(data))}
      ${stat("FC au repos, 7 j", m("fcr"), "bpm", flag.bF ? "habituelle " + fmtN(flag.bF, 0) : null, () => true)}
      ${stat("VFC, 7 j", m("vfc"), "ms", flag.bV ? "habituelle " + fmtN(flag.bV, 0) : null, () => true)}
      ${stat("Eau, moyenne 7 j", m("eau"), "L", "repère " + fmtN(waterTarget(data), 1) + " L", (x) => x >= waterTarget(data) * 0.9)}
    </div>
    <${Card} title="Ma journée" sub="Ou reçois tes valeurs automatiquement (voir « Connecter ma montre »)">
      <div className="daynav"><button type="button" className="x" aria-label="Jour précédent" onClick=${() => setDate(addDays(date, -1))}>‹</button><b>${date === todayISO() ? "Aujourd'hui" : JOURS[parseISO(date).getDay()] + " " + fmtD(date)}</b>
        <button type="button" className="x" aria-label="Jour suivant" disabled=${date === todayISO()} onClick=${() => setDate(addDays(date, 1))}>›</button></div>
      <${SanteForm} key=${date} data=${data} src=${src} date=${date} /></${Card}>
    ${tip ? html`<div className="coachmsg"><${Logo} size=${26} /><div><div className="eyebrow">Conseil du jour</div><p><b>${tip.t}.</b> ${tip.d}</p><p className="muted small">${(tip.refs || []).map((k) => refShort(XREFS[k])).join(" · ")}</p></div></div>` : null}
    ${line("sommeil").length >= 2 ? html`<${Card} title="Sommeil" sub="14 derniers jours, en heures"><${BarChart} data=${bar("sommeil")} unit="h" target=${8} /></${Card}>` : null}
    ${line("pas").length >= 2 ? html`<${Card} title="Pas"><${BarChart} data=${bar("pas")} unit="pas" target=${stepsTarget(data)} /></${Card}>` : null}
    ${line("fcr").length >= 2 ? html`<${Card} title="FC au repos" sub="Regarde la tendance, pas une valeur isolée"><${LineChart} points=${line("fcr")} unit="bpm" /></${Card}>` : null}
    ${line("vfc").length >= 2 ? html`<${Card} title="Variabilité de la fréquence cardiaque"><${LineChart} points=${line("vfc")} unit="ms" /></${Card}>` : null}
    <${Card} title="Mes activités" sub="Matchs, courses, sorties vélo : elles comptent dans ta charge de la semaine" action=${imp ? null : html`<${Btn} small kind="ghost" onClick=${() => setImp(true)}>Ajouter</${Btn}>`}>
      ${imp ? html`<${ActivityImport} src=${src} onDone=${() => setImp(false)} />` : null}
      ${acts.length ? acts.slice(0, 10).map((a) => html`<div key=${a.id} className="hist"><div className="hist-h"><b>${a.n}</b><span className="muted small">${fmtD(a.d)}</span></div>
        <span className="muted small">${a.type}${a.duree ? " · " + a.duree + " min" : ""}${a.dist ? " · " + fmtN(a.dist, 2) + " km" : ""}${a.fcMoy ? " · FC moy. " + a.fcMoy : ""}${a.deniv ? " · +" + a.deniv + " m" : ""}${a.rpe !== undefined ? " · effort " + a.rpe + "/10" : ""}</span>
        <button type="button" className="linkbtn" onClick=${() => src.saveActivite(a.id, null)}>Supprimer</button></div>`) : imp ? null : html`<p className="muted small">Aucune activité pour l'instant.</p>`}</${Card}>
    <${Card} title="Connecter ma montre"><${WatchHowto} /></${Card}>
    <p className="muted small">Ces repères ne remplacent pas un avis médical. Une FC au repos durablement élevée, des palpitations ou un malaise : consulte un médecin.</p>
  </div>`;
}
/* carte de l'écran Aujourd'hui */
function SanteMini({ data, open }) {
  const t = (data.sante && data.sante[todayISO()]) || {};
  const f = santeFlag(data);
  const any = SANTE_F.some((x) => num(t[x.k]) !== null);
  return html`<button type="button" className="nutri-mini" onClick=${open}>
    <div className="nm-h"><b>Ma santé du jour</b>${f.fcr !== null || f.vfc !== null ? html`<${Pill} tone=${{ ok: "ok", prudence: "gold", leger: "warn" }[f.lvl]}>${{ ok: "feu vert", prudence: "prudence", leger: "récupère" }[f.lvl]}</${Pill}>` : html`<span className="muted small">${any ? "à jour" : "à remplir"}</span>`}</div>
    <span className="small">${any ? [num(t.sommeil) !== null ? "Sommeil " + fmtN(num(t.sommeil), 1) + " h" : null, num(t.pas) !== null ? fmtN(num(t.pas), 0) + " pas" : null, num(t.fcr) !== null ? "FC repos " + num(t.fcr) : null, num(t.vfc) !== null ? "VFC " + num(t.vfc) + " ms" : null].filter(Boolean).join(" · ") : "Sommeil, pas, FC au repos : 20 secondes, ou automatique depuis ton iPhone"}</span>
  </button>`;
}
/* fiche client côté coach */
function CoachSante({ data }) {
  const days = santeDays(data, 14).reverse();
  const rows = days.filter((d) => data.sante && data.sante[d]);
  const f = santeFlag(data);
  const acts = Object.values(data.activites || {}).filter(Boolean).sort((a, b) => String(b.d).localeCompare(String(a.d)));
  if (!rows.length && !acts.length) return html`<${Empty} title="Pas encore de données santé" text="Le client les saisit dans « Ma santé du jour » ou les envoie depuis son iPhone." />`;
  return html`<div className="stack">
    ${f.fcr !== null || f.vfc !== null ? html`<div className=${"alert " + ({ ok: "okb", prudence: "gold", leger: "warn" }[f.lvl])}><div><b>Aujourd'hui : ${{ ok: "feu vert", prudence: "prudence", leger: "récupération conseillée" }[f.lvl]}</b><p>${f.notes.join(" · ") || "Valeurs habituelles."}</p></div></div>` : null}
    ${rows.length ? html`<${Card} title="14 derniers jours"><div className="tscroll"><table className="ttable"><thead><tr><th>Jour</th>${SANTE_F.map((x) => html`<th key=${x.k}>${x.n}</th>`)}<th>Énergie</th></tr></thead>
      <tbody>${rows.map((d) => { const x = data.sante[d]; return html`<tr key=${d}><th>${fmtD(d)}<small>${x.src || ""}</small></th>${SANTE_F.map((c) => html`<td key=${c.k}>${num(x[c.k]) === null ? "—" : fmtN(num(x[c.k]), c.k === "pas" ? 0 : 1)}</td>`)}<td>${x.energie ? x.energie + "/5" : "—"}</td></tr>`; })}</tbody></table></div></${Card}>` : null}
    ${acts.length ? html`<${Card} title="Activités importées">${acts.slice(0, 12).map((a) => html`<div key=${a.id} className="hist"><div className="hist-h"><b>${a.n}</b><span className="muted small">${fmtD(a.d)}</span></div>
      <span className="muted small">${a.type}${a.duree ? " · " + a.duree + " min" : ""}${a.dist ? " · " + fmtN(a.dist, 2) + " km" : ""}${a.fcMoy ? " · FC moy. " + a.fcMoy + " / max " + a.fcMax : ""}${a.deniv ? " · +" + a.deniv + " m" : ""} · effort ${a.rpe}/10 · ${fmtN(a.load, 0)} UA</span></div>`)}</${Card}>` : null}
  </div>`;
}
