/* ===== Avatar, photo de profil, carte athlète et badges ===== */
const AV_ICONS = {
  eclair: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  flamme: "M12 22c4 0 7-3 7-7 0-3-2-5-3-7-.5 2-1.5 3-3 3 1-3 0-6-3-9-.5 4-5 6-5 12 0 5 3 8 7 8z",
  haltere: "M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12",
  couronne: "M3 18h18M4 18l-1-11 5 4 4-7 4 7 5-4-1 11",
  cible: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01",
  etoile: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z",
  montagne: "M3 20l6-10 4 6 2-3 6 7H3zM14 8a2 2 0 100-4 2 2 0 000 4z",
  chrono: "M12 21a8 8 0 100-16 8 8 0 000 16zM12 9v4l3 2M10 2h4M12 2v3",
  ovale: "M5 19C2 16 3 9 8 5s11-3 13-1-1 8-5 12-9 5-11 3zM9 9l6 6M10 13l1-1M13 10l1-1",
  bouclier: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  vague: "M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
  coeur: "M12 20s-7-4.5-9-9c-1.5-3.5 1-7 4.5-7 2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 22.5 7.5 21 11c-2 4.5-9 9-9 9z",
};
const AV_COLORS = {
  or: ["#e9c45a", "#9c7414"], noir: ["#3a3530", "#0f0e0c"], bronze: ["#d39a62", "#7a4a22"], argent: ["#d9dde2", "#7d848c"],
  emeraude: ["#4fc48b", "#16603d"], azur: ["#5fa8ee", "#1d4e8a"], rubis: ["#ef6b6b", "#8a1f2a"], violet: ["#a98bf0", "#4b2f99"],
};
function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?"; }
function Avatar({ profile, photo, size, ring }) {
  const s = size || 44;
  const av = (profile && profile.avatar) || {};
  const gid = useMemo(() => rid("av"), []);
  const col = AV_COLORS[av.color] || AV_COLORS.or;
  const src = av.kind === "photo" ? (photo || av.thumb) : null;
  return html`<span className=${"avatar" + (ring ? " ring-g" : "")} style=${{ width: s + "px", height: s + "px" }} aria-hidden="true">
    ${src ? html`<img src=${src} alt="" />` : html`<svg viewBox="0 0 48 48" width=${s} height=${s}>
      <defs><linearGradient id=${gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style=${{ stopColor: col[0] }}></stop><stop offset="1" style=${{ stopColor: col[1] }}></stop></linearGradient></defs>
      <circle cx="24" cy="24" r="24" style=${{ fill: "url(#" + gid + ")" }}></circle>
      ${av.kind === "icon" && AV_ICONS[av.icon] ? html`<g transform="translate(12 12)"><path d=${AV_ICONS[av.icon]} style=${{ fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}></path></g>`
        : html`<text x="24" y="30" textAnchor="middle" style=${{ fill: "#fff", fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "18px" }}>${initials(profile && profile.name)}</text>`}
    </svg>`}
  </span>`;
}
async function photoToData(file, size, q) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2.6;
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, sx, Math.max(0, sy), side, side, 0, 0, size, size);
    return c.toDataURL("image/jpeg", q || 0.82);
  } finally { URL.revokeObjectURL(url); }
}
function AvatarPicker({ data, src, onDone }) {
  const toast = useToast();
  const p = data.profile || {};
  const av0 = p.avatar || { kind: "initials", color: "or" };
  const [av, setAv] = useState({ ...av0 });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const pick = async (f) => {
    try { setBusy(true); const big = await photoToData(f, 320, 0.82); const thumb = await photoToData(f, 72, 0.7); setPhoto(big); setAv({ ...av, kind: "photo", thumb }); }
    catch (e) { toast("Photo illisible : essaie une autre image.", "warn"); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      if (av.kind === "photo" && photo) await src.saveMedia("photo", { data: photo, at: nowISO() });
      if (av.kind !== "photo" && data.media && data.media.photo) await src.saveMedia("photo", null);
      await src.setProfile({ ...p, avatar: av.kind === "photo" ? { kind: "photo", thumb: av.thumb, color: av.color } : { kind: av.kind, icon: av.icon, color: av.color } });
      toast("Profil mis à jour.", "ok"); onDone && onDone();
    } catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  const prevProfile = { ...p, avatar: av };
  const curPhoto = photo || (data.media && data.media.photo && data.media.photo.data);
  return html`<div className="form">
    <div className="av-prev"><${Avatar} profile=${prevProfile} photo=${curPhoto} size=${96} ring=${true} /></div>
    <div className="field"><span className="field-l">Photo</span>
      <input ref=${ref} type="file" accept="image/*" hidden id="av-photo" onChange=${(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) pick(f); }} />
      <div className="btnrow"><${Btn} kind="ghost" small onClick=${() => ref.current && ref.current.click()} disabled=${busy}>${busy ? "Préparation…" : "Prendre ou choisir une photo"}</${Btn}>
        ${av.kind === "photo" ? html`<${Btn} kind="quiet" small onClick=${() => { setPhoto(null); setAv({ kind: "initials", color: av.color || "or" }); }}>Retirer la photo</${Btn}>` : null}</div>
      <span className="field-h">Recadrée en carré et compressée ; visible par toi et ton coach uniquement.</span></div>
    <div className="field"><span className="field-l">Ou un avatar</span>
      <div className="av-grid">
        <button type="button" className=${"av-opt" + (av.kind === "initials" ? " on" : "")} aria-label="Initiales" onClick=${() => setAv({ ...av, kind: "initials" })}><${Avatar} profile=${{ ...p, avatar: { kind: "initials", color: av.color } }} size=${40} /></button>
        ${Object.keys(AV_ICONS).map((k) => html`<button key=${k} type="button" className=${"av-opt" + (av.kind === "icon" && av.icon === k ? " on" : "")} aria-label=${"Avatar " + k} onClick=${() => setAv({ ...av, kind: "icon", icon: k })}><${Avatar} profile=${{ avatar: { kind: "icon", icon: k, color: av.color } }} size=${40} /></button>`)}
      </div></div>
    <div className="field"><span className="field-l">Couleur</span>
      <div className="av-cols">${Object.entries(AV_COLORS).map(([k, c]) => html`<button key=${k} type="button" className=${"av-col" + ((av.color || "or") === k ? " on" : "")} aria-label=${"Couleur " + k} style=${{ background: "linear-gradient(135deg," + c[0] + "," + c[1] + ")" }} onClick=${() => setAv({ ...av, color: k })}></button>`)}</div></div>
    <div className="actions"><${Btn} onClick=${save} disabled=${busy}>Enregistrer</${Btn}></div>
  </div>`;
}

/* ---------- carte athlète ---------- */
const CARD_ATTRS = [
  { k: "reg", n: "RÉG", l: "Régularité" }, { k: "eng", n: "ENG", l: "Engagement" }, { k: "for", n: "FOR", l: "Force" },
  { k: "vit", n: "VIT", l: "Vitesse" }, { k: "end", n: "END", l: "Endurance" }, { k: "phy", n: "PHY", l: "Physique" },
];
const CARD_W = {
  perte: { reg: 0.25, eng: 0.2, phy: 0.25, end: 0.15, for: 0.15, vit: 0 }, masse: { reg: 0.25, eng: 0.15, for: 0.3, phy: 0.2, end: 0.05, vit: 0.05 },
  force: { for: 0.4, vit: 0.15, reg: 0.25, eng: 0.1, phy: 0.05, end: 0.05 }, vitesse: { vit: 0.4, for: 0.2, reg: 0.25, eng: 0.1, end: 0.05, phy: 0 },
  prepa: { vit: 0.25, for: 0.2, end: 0.2, reg: 0.25, eng: 0.1, phy: 0 }, forme: { reg: 0.3, eng: 0.2, end: 0.2, for: 0.15, phy: 0.15, vit: 0 },
  run: { end: 0.4, reg: 0.25, eng: 0.15, vit: 0.1, for: 0.1, phy: 0 }, retour: { reg: 0.3, eng: 0.2, end: 0.2, for: 0.2, vit: 0.1, phy: 0 },
};
const CARD_POS = { perte: "AFFÛT", masse: "MUSCLE", force: "FORCE", vitesse: "SPRINT", prepa: "TERRAIN", forme: "FORME", run: "RUN", retour: "RETOUR" };
// test → attribut, coefficient (points par % de progrès)
const CARD_TESTS = {
  sprint10: ["vit", 6], sprint30: ["vit", 6], cmj: ["vit", 2], longueur: ["vit", 2], hop: ["vit", 1.5],
  e1rm_squat: ["for", 1.2], e1rm_sdt: ["for", 1.2], e1rm_dc: ["for", 1.2], e1rm_epaule: ["for", 1.2], pompes: ["for", 0.3], su_squat: ["for", 0.4], assis_debout: ["for", 0.6],
  vma: ["end", 2], t5km: ["end", 3], navette: ["end", 1], course_continue: ["end", 0.3], fc_repos: ["end", 2], planche: ["end", 0.3],
  poids: ["phy", 2], taille: ["phy", 3], hanches: ["phy", 3], bras: ["phy", 3], cuisse: ["phy", 3],
};
const TIERS = [{ min: 85, k: "elite", n: "Élite" }, { min: 75, k: "or", n: "Or" }, { min: 65, k: "argent", n: "Argent" }, { min: 0, k: "bronze", n: "Bronze" }];
function tierOf(v) { return TIERS.find((t) => v >= t.min); }
function weekEnd(plan, w) { return addDays(plan.start, w * 7 - 1); }
function cardStats(data, plan, prog, lib, cut) {
  // cut : date limite (incluse) pour rejouer la carte à une date passée
  const p = data.profile || {};
  const cutD = cut || todayISO();
  const lvl = { "Débutant": 0, "Intermédiaire": 5, "Confirmé": 10 }[p.level] || 3;
  const base = 55 + lvl;
  const v = {}, has = {};
  CARD_ATTRS.forEach((a) => { v[a.k] = base; });
  if (!plan || !prog) return { overall: base, tier: tierOf(base), attrs: CARD_ATTRS.map((a) => ({ ...a, v: base })), pos: "—" };
  const ps = planState(plan, cutD);
  const curW = ps.phase === "avant" ? 0 : ps.phase === "fini" ? plan.weeks : ps.week;
  const logs = Object.values(data.logs || {}).filter((l) => l && l.kind !== "presentiel" && String(l.date) <= cutD);
  // régularité : semaines terminées + semaine en cours au prorata
  let pl = 0, dn = 0;
  for (let w = 1; w <= curW; w++) {
    const n = plannedCount(prog, plan, w, lib);
    const done = logs.filter((l) => Number(l.w) === w).length;
    if (w < curW || ps.phase === "fini") { pl += n; dn += Math.min(n, done); }
    else { const exp = Math.max(done, Math.floor(n * ps.day / 7)); pl += exp; dn += Math.min(exp, done); }
  }
  if (pl > 0) { v.reg = clamp(Math.round(40 + 59 * dn / pl), 40, 99); has.reg = true; }
  // engagement : bilans, habitudes, journal
  const ck = Object.values(data.checkins || {}).filter((c) => c && c.w <= Math.max(0, curW));
  const parts = [];
  const weeksDue = ps.phase === "fini" ? plan.weeks : Math.max(0, curW - 1);
  if (weeksDue > 0) parts.push([Math.min(1, ck.filter((c) => c.w <= weeksDue).length / weeksDue), 0.6]);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(cutD, -i));
  if (prog.habits && prog.habits.length) { const sc = last14.map((d) => { const m = data.habits[d.slice(0, 7)]; const dd = m && m.days && m.days[d]; return dd ? dd.length / prog.habits.length : 0; }); parts.push([sc.reduce((a, b) => a + b, 0) / 14, 0.2]); }
  if (data.nutri && data.nutri.plan) parts.push([last14.filter((d) => ((data.food[d] || {}).meals || []).length).length / 14, 0.2]);
  if (parts.length) { const wsum = parts.reduce((s, x) => s + x[1], 0); v.eng = clamp(Math.round(40 + 59 * parts.reduce((s, x) => s + x[0] * x[1], 0) / wsum), 40, 99); has.eng = true; }
  // tests : progrès entre le départ et le dernier point
  const pts = Object.values(data.tests || {}).filter((t) => t && String(t.at).slice(0, 10) <= cutD).sort((a, b) => a.w - b.w);
  const gains = {};
  if (pts.length >= 2) {
    const first = pts[0].values || {}, last = pts[pts.length - 1].values || {};
    Object.keys(CARD_TESTS).forEach((tid) => {
      if (!prog.tests.includes(tid)) return;
      const a = testValue(tid, first[tid], p.side), b = testValue(tid, last[tid], p.side);
      if (a === null || b === null || a === undefined || b === undefined) return;
      let pct;
      if (TESTS[tid].type === "pair") { const la = lsi(a, p.side), lb = lsi(b, p.side); if (!la || !lb) return; pct = lb - la; }
      else { if (!a) return; pct = (b - a) / Math.abs(a) * 100; const better = testBetter(prog, tid); if (better === "low") pct = -pct; else if (better === "info") return; }
      const [attr, k] = CARD_TESTS[tid];
      (gains[attr] = gains[attr] || []).push(clamp(pct * k, -15, 30));
    });
  }
  // force : progrès des charges en séance si pas de test
  if (!gains.for) {
    const st = computeStats({ ...data, logs: Object.fromEntries(logs.map((l) => [l.key, l])) }, plan, prog, lib, cutD);
    const g = st.liftSeries.map((s) => { const a = s.points[0].y, b = s.points[s.points.length - 1].y; return a ? (b - a) / a * 100 : 0; });
    if (g.length) gains.for = [clamp(g.reduce((x, y) => x + y, 0) / g.length * 1.2, -15, 30)];
  }
  Object.entries(gains).forEach(([attr, arr]) => { v[attr] = clamp(Math.round(base + arr.reduce((a, b) => a + b, 0) / arr.length), 40, 99); has[attr] = true; });
  const W = CARD_W[prog.id] || CARD_W.forme;
  const bonus = Math.round(4 * Math.min(1, curW / (plan.weeks || 12)));
  const overall = clamp(Math.round(CARD_ATTRS.reduce((s, a) => s + (W[a.k] || 0) * v[a.k], 0) / (CARD_ATTRS.reduce((s, a) => s + (W[a.k] || 0), 0) || 1)) + bonus, 40, 99);
  return { overall, tier: tierOf(overall), attrs: CARD_ATTRS.map((a) => ({ ...a, v: v[a.k], live: !!has[a.k] })), pos: CARD_POS[prog.id] || "ATHLÈTE", week: curW };
}
function cardEvolution(data, plan, prog, lib) {
  const now = cardStats(data, plan, prog, lib);
  const ps = planState(plan, todayISO());
  const w = ps && ps.phase === "en_cours" ? ps.week : ps && ps.phase === "fini" ? plan.weeks + 1 : 0;
  const prev = w > 1 ? cardStats(data, plan, prog, lib, weekEnd(plan, w - 1)) : null;
  const d = prev ? now.overall - prev.overall : 0;
  return { now, prev, d, deltas: prev ? Object.fromEntries(now.attrs.map((a, i) => [a.k, a.v - prev.attrs[i].v])) : {} };
}
/* badges */
function badgesOf(data, plan, prog, lib) {
  const logs = Object.values(data.logs || {}).filter((l) => l && l.kind !== "presentiel").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const ps = plan ? planState(plan, todayISO()) : null;
  const curW = ps ? (ps.phase === "fini" ? plan.weeks + 1 : ps.week) : 0;
  const perfect = [];
  if (plan && prog) for (let w = 1; w < curW && w <= plan.weeks; w++) { const n = plannedCount(prog, plan, w, lib); const dn = logs.filter((l) => Number(l.w) === w && !/-D$/.test(String(l.key))).length; perfect.push(n && dn >= n); }
  let run = 0, best = 0; perfect.forEach((x) => { run = x ? run + 1 : 0; best = Math.max(best, run); });
  const ck = Object.values(data.checkins || {}).filter(Boolean);
  const tests = Object.values(data.tests || {}).filter(Boolean);
  const st = plan && prog ? computeStats(data, plan, prog, lib, todayISO()) : null;
  const rec = st && st.liftSeries.some((s) => s.points[s.points.length - 1].y > s.points[0].y);
  const np = data.nutri && data.nutri.plan;
  let nutriRun = 0;
  if (np && np.mode !== "equilibre" && np.targets) { for (let i = 1; i <= 30; i++) { const d = addDays(todayISO(), -i); const t = dayTotals(data.food[d]); const n = ((data.food[d] || {}).meals || []).length; if (n && Math.abs(t.kcal / np.targets.kcal - 1) <= 0.1) nutriRun++; else break; } }
  let habRun = 0;
  if (prog && prog.habits && prog.habits.length) { for (let i = 1; i <= 30; i++) { const d = addDays(todayISO(), -i); const m = data.habits[d.slice(0, 7)]; const dd = m && m.days && m.days[d]; if (dd && dd.length >= prog.habits.length) habRun++; else break; } }
  let improved = false;
  if (prog && tests.length >= 2) { const s = tests.sort((a, b) => a.w - b.w); const a = s[0].values || {}, b = s[s.length - 1].values || {}; improved = prog.tests.some((tid) => { const x = testValue(tid, a[tid]), y = testValue(tid, b[tid]); if (x === null || y === null || typeof x === "object") return false; const bt = testBetter(prog, tid); return bt === "low" ? y < x : bt === "high" ? y > x : false; }); }
  const blocks = plan ? Math.floor(Math.min(curW - 1, plan.weeks) / 4) : 0;
  return [
    { k: "debut", i: "eclair", n: "Premier pas", d: "Première séance enregistrée", ok: logs.length > 0 },
    { k: "tests", i: "cible", n: "Point de départ", d: "Tests de départ saisis", ok: !!(data.tests && data.tests.t0) },
    { k: "parfaite", i: "etoile", n: "Semaine parfaite", d: "Toutes les séances d'une semaine", ok: perfect.some(Boolean) },
    { k: "serie3", i: "flamme", n: "Série de 3", d: "3 semaines parfaites d'affilée", ok: best >= 3 },
    { k: "bilans", i: "bouclier", n: "Assidu", d: "4 bilans hebdomadaires envoyés", ok: ck.length >= 4 },
    { k: "record", i: "haltere", n: "Record", d: "Une charge record sur un exercice", ok: !!rec },
    { k: "progres", i: "montagne", n: "Progrès mesuré", d: "Un test amélioré depuis le départ", ok: improved },
    { k: "bloc", i: "chrono", n: "Bloc terminé", d: "Un bloc de 4 semaines bouclé", ok: blocks >= 1 },
    ...(np && np.mode !== "equilibre" ? [{ k: "nutri", i: "coeur", n: "Dans le mille", d: "5 jours d'affilée dans ta cible", ok: nutriRun >= 5 }] : []),
    ...(prog && prog.habits && prog.habits.length ? [{ k: "habitudes", i: "vague", n: "Routine", d: "7 jours avec toutes tes habitudes", ok: habRun >= 7 }] : []),
    { k: "fin", i: "couronne", n: "Finisseur", d: "Programme terminé", ok: !!(ps && ps.phase === "fini") },
  ];
}
function AthleteCard({ data, stats, evo, size, idp }) {
  const p = data.profile || {};
  const photo = data.media && data.media.photo && data.media.photo.data;
  const W = 300, H = 430;
  const t = stats.tier.k;
  const id = idp || "c";
  const pal = { bronze: ["#e6b98a", "#8c5a2e", "#3b2412"], argent: ["#f1f3f6", "#9aa3ad", "#2f343a"], or: ["#f6dd8a", "#c49a2c", "#3a2a06"], elite: ["#2b2722", "#0c0b09", "#e9c45a"] }[t];
  const txt = t === "elite" ? "#f6e3a1" : pal[2];
  const name = String(p.name || "Athlète").split(" ")[0].toUpperCase().slice(0, 14);
  const av = p.avatar || {};
  const col = AV_COLORS[av.color] || AV_COLORS.or;
  const shape = "M24 0 H276 L300 24 V380 Q300 400 282 410 L162 428 Q150 430 138 428 L18 410 Q0 400 0 380 V24 Z";
  const s = size || 300;
  return html`<svg className="acard" viewBox=${"0 0 " + W + " " + H} width=${s} height=${Math.round(s * H / W)} role="img" aria-label=${"Carte athlète : note " + stats.overall + ", niveau " + stats.tier.n} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id=${id + "bg"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor=${pal[0]}></stop><stop offset="1" stopColor=${pal[1]}></stop></linearGradient>
      <linearGradient id=${id + "sh"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.35"></stop><stop offset="0.5" stopColor="#fff" stopOpacity="0"></stop></linearGradient>
      <linearGradient id=${id + "av"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor=${col[0]}></stop><stop offset="1" stopColor=${col[1]}></stop></linearGradient>
      <clipPath id=${id + "cl"}><circle cx="186" cy="118" r="70"></circle></clipPath>
      <clipPath id=${id + "sp"}><path d=${shape}></path></clipPath>
    </defs>
    <path d=${shape} fill=${"url(#" + id + "bg)"}></path>
    <path d=${shape} fill=${"url(#" + id + "sh)"}></path>
    <path d=${shape} fill="none" stroke=${t === "elite" ? "#e9c45a" : "rgba(0,0,0,0.25)"} strokeWidth="3"></path>
    <g clipPath=${"url(#" + id + "sp)"}>${[0, 1, 2, 3, 4].map((i) => html`<line key=${i} x1=${-40 + i * 90} y1="430" x2=${80 + i * 90} y2="0" stroke=${t === "elite" ? "#e9c45a" : "#fff"} strokeOpacity="0.06" strokeWidth="18"></line>`)}</g>
    <text x="30" y="82" fill=${txt} style=${{ fontFamily: "Barlow Condensed, Arial Narrow, sans-serif", fontWeight: 700 }} fontSize="64">${stats.overall}</text>
    <text x="32" y="106" fill=${txt} style=${{ fontFamily: "Barlow Condensed, Arial Narrow, sans-serif", fontWeight: 700, letterSpacing: "1px" }} fontSize="19">${stats.pos}</text>
    <text x="32" y="130" fill=${txt} fillOpacity="0.8" style=${{ fontFamily: "Barlow, Arial, sans-serif", fontWeight: 600 }} fontSize="12">${tr(stats.tier.n).toUpperCase()}</text>
    ${evo && evo.d ? html`<text x="32" y="152" fill=${evo.d > 0 ? (t === "elite" ? "#7ee2a8" : "#145c34") : "#8a1f2a"} style=${{ fontFamily: "Barlow, Arial, sans-serif", fontWeight: 700 }} fontSize="14">${(evo.d > 0 ? "▲ +" : "▼ ") + evo.d}</text>` : null}
    <g transform="translate(34 172) scale(0.62)" stroke=${txt} fill="none" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
      <rect x="4" y="9.5" width="40" height="3" rx="1.5" fill=${txt} stroke="none"></rect><rect x="7" y="4" width="4.5" height="14" rx="1.2" fill=${txt} stroke="none"></rect><rect x="36.5" y="4" width="4.5" height="14" rx="1.2" fill=${txt} stroke="none"></rect>
      <polyline points="11,33 24,23 37,33"></polyline><polyline points="11,43 24,33 37,43" opacity="0.55"></polyline></g>
    <circle cx="186" cy="118" r="74" fill=${t === "elite" ? "#e9c45a" : "rgba(255,255,255,0.45)"}></circle>
    ${photo ? html`<image href=${photo} x="116" y="48" width="140" height="140" clipPath=${"url(#" + id + "cl)"} preserveAspectRatio="xMidYMid slice"></image>`
      : html`<g><circle cx="186" cy="118" r="70" fill=${"url(#" + id + "av)"}></circle>
        ${av.kind === "icon" && AV_ICONS[av.icon] ? html`<g transform="translate(150 82) scale(3)"><path d=${AV_ICONS[av.icon]} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path></g>`
          : html`<text x="186" y="136" textAnchor="middle" fill="#fff" style=${{ fontFamily: "Barlow Condensed, Arial Narrow, sans-serif", fontWeight: 700 }} fontSize="52">${initials(p.name)}</text>`}</g>`}
    <text x="150" y="232" textAnchor="middle" fill=${txt} style=${{ fontFamily: "Barlow Condensed, Arial Narrow, sans-serif", fontWeight: 700, letterSpacing: "1.5px" }} fontSize="30">${name}</text>
    <line x1="40" y1="246" x2="260" y2="246" stroke=${txt} strokeOpacity="0.35"></line>
    ${stats.attrs.map((a, i) => {
      const x = i % 2 === 0 ? 52 : 168, y = 282 + Math.floor(i / 2) * 36;
      const dl = evo && evo.deltas ? evo.deltas[a.k] : 0;
      return html`<g key=${a.k}><text x=${x} y=${y} fill=${txt} style=${{ fontFamily: "Barlow Condensed, Arial Narrow, sans-serif", fontWeight: 700 }} fontSize="26">${a.v}</text>
        <text x=${x + 38} y=${y} fill=${txt} fillOpacity=${a.live ? 1 : 0.6} style=${{ fontFamily: "Barlow Condensed, Arial Narrow, sans-serif", fontWeight: 600 }} fontSize="19">${a.n}</text>
        ${dl ? html`<text x=${x + 82} y=${y - 2} fill=${dl > 0 ? (t === "elite" ? "#7ee2a8" : "#145c34") : "#8a1f2a"} style=${{ fontFamily: "Barlow, Arial, sans-serif", fontWeight: 700 }} fontSize="12">${dl > 0 ? "+" + dl : dl}</text>` : null}</g>`;
    })}
    <line x1="150" y1="258" x2="150" y2="364" stroke=${txt} strokeOpacity="0.25"></line>
    <text x="150" y="394" textAnchor="middle" fill=${txt} fillOpacity="0.75" style=${{ fontFamily: "Barlow, Arial, sans-serif", fontWeight: 700, letterSpacing: "2px" }} fontSize="9.5">ANTOINE PRÉPA PERFORMANCE</text>
  </svg>`;
}
/* polices intégrées dans l'image exportée (sinon le navigateur utilise une police de secours) */
let _cardFonts = null;
async function cardFontCss() {
  if (_cardFonts !== null) return _cardFonts;
  const toData = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error("font"); const b = await r.blob(); return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }); };
  const list = [["Barlow Condensed", 700, "fonts/barlow-condensed-700.woff2"], ["Barlow Condensed", 600, "fonts/barlow-condensed-600.woff2"], ["Barlow", 600, "fonts/barlow-600.woff2"], ["Barlow", 700, "fonts/barlow-700.woff2"]];
  try {
    if (!window.IS_SITE) throw new Error("no local fonts");
    const parts = await Promise.all(list.map(async ([f, w, u]) => "@font-face{font-family:\"" + f + "\";font-weight:" + w + ";src:url(" + (await toData(u)) + ") format(\"woff2\")}"));
    _cardFonts = parts.join("");
  } catch (e) { _cardFonts = ""; }
  return _cardFonts;
}
async function cardToPng(svgEl, scale) {
  const css = await cardFontCss();
  let node = svgEl;
  if (css) { node = svgEl.cloneNode(true); const st = document.createElementNS("http://www.w3.org/2000/svg", "style"); st.textContent = css; node.insertBefore(st, node.firstChild); }
  const xml = new XMLSerializer().serializeToString(node);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const vb = svgEl.viewBox.baseVal; const sc = scale || 3;
  const pad = 40;
  const c = document.createElement("canvas"); c.width = (vb.width + pad * 2) * sc; c.height = (vb.height + pad * 2) * sc;
  const x = c.getContext("2d");
  x.fillStyle = "#0d0d0c"; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, pad * sc, pad * sc, vb.width * sc, vb.height * sc);
  return await new Promise((res) => c.toBlob(res, "image/png"));
}
function CardPanel({ data, plan, prog, lib, compact, onOpen }) {
  const toast = useToast();
  const ref = useRef(null);
  const [dl, setDl] = useState(null);
  useEffect(() => { let a = true; (async () => { try { const d = window.claude && window.claude.use ? await window.claude.use("downloads") : null; if (a) setDl(d); } catch (e) {} })(); return () => { a = false; }; }, []);
  const evo = useMemo(() => cardEvolution(data, plan, prog, lib), [data, plan, prog, lib]);
  const st = evo.now;
  const save = async () => {
    try {
      const svg = ref.current && ref.current.querySelector("svg");
      const blob = await cardToPng(svg, 3);
      const filename = "carte-" + initials((data.profile || {}).name).toLowerCase() + "-" + todayISO() + ".png";
      if (dl) await dl.save({ filename, data: blob });
      else { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
    } catch (e) { if (!(e && e.code === "declined")) toast("Export impossible dans cette vue.", "warn"); }
  };
  if (compact) return html`<button type="button" className="card-mini" onClick=${onOpen}>
    <div ref=${ref}><${AthleteCard} data=${data} stats=${st} evo=${evo} size=${86} idp="m" /></div>
    <div className="stack-s"><div className="eyebrow">Ma carte athlète</div><b className="cm-n">${st.overall} · ${st.tier.n}</b>
      <span className="small muted">${evo.d > 0 ? "+" + evo.d + " depuis la semaine dernière : continue !" : evo.d < 0 ? evo.d + " cette semaine : on se reprend." : "Fais tes séances et ton bilan pour la faire monter."}</span></div></button>`;
  const next = TIERS.slice().reverse().find((t) => t.min > st.overall);
  return html`<div className="stack">
    <div className="card-wrap" ref=${ref}><${AthleteCard} data=${data} stats=${st} evo=${evo} size=${300} idp="f" /></div>
    <p className="small center">${next ? "Encore " + plural(next.min - st.overall, "point") + " pour passer " + next.n + "." : "Niveau maximal atteint : garde-le !"} ${evo.d > 0 ? "Cette semaine : +" + evo.d + "." : ""}</p>
    <div className="btnrow center"><${Btn} kind="ghost" small onClick=${save}>Télécharger ma carte</${Btn}></div>
    <details><summary>Comment ma carte évolue</summary><ul className="small">
      <li><b>RÉG</b> : séances faites sur séances prévues.</li><li><b>ENG</b> : bilans envoyés, habitudes et repas notés.</li>
      <li><b>FOR, VIT, END, PHY</b> : tes progrès aux tests (force, vitesse, endurance, silhouette) depuis le départ ; sans test, tes charges en séance.</li>
      <li>La note générale pèse surtout les qualités de ton programme, avec un bonus de fidélité semaine après semaine.</li>
      <li>Bronze → Argent à 65 → Or à 75 → Élite à 85.</li></ul></details>
  </div>`;
}
function Badges({ data, plan, prog, lib }) {
  const b = badgesOf(data, plan, prog, lib);
  const n = b.filter((x) => x.ok).length;
  return html`<${Card} title="Mes badges" sub=${n + " sur " + b.length + " débloqués"}>
    <div className="badges">${b.map((x) => html`<div key=${x.k} className=${"badge" + (x.ok ? " ok" : "")} title=${x.d}>
      <span className="bd-i"><svg viewBox="0 0 24 24" width="22" height="22"><path d=${AV_ICONS[x.i]} style=${{ fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}></path></svg></span>
      <b>${x.n}</b><small>${x.d}</small></div>`)}</div></${Card}>`;
}
function CardEvo({ data, plan, prog, lib }) {
  const evo = useMemo(() => cardEvolution(data, plan, prog, lib), [data, plan, prog, lib]);
  const st = evo.now;
  const ch = st.attrs.filter((a) => (evo.deltas[a.k] || 0) !== 0);
  const next = TIERS.slice().reverse().find((t) => t.min > st.overall);
  const done = badgesOf(data, plan, prog, lib).filter((b) => b.ok);
  return html`<div className="evo">
    <div className="evo-c"><${AthleteCard} data=${data} stats=${st} evo=${evo} size=${150} idp="e" /></div>
    <div className="stack-s">
      <b className="cm-n">${evo.prev ? evo.prev.overall + " → " + st.overall : st.overall} · ${st.tier.n}</b>
      <p className="small">${evo.d > 0 ? "Bravo : +" + evo.d + " cette semaine, ton travail se voit." : evo.d < 0 ? "Petite baisse cette semaine : la régularité fait remonter la note très vite." : "Note stable : une séance de plus ou un test amélioré la fera monter."}</p>
      ${ch.length ? html`<div className="chips">${ch.map((a) => html`<${Pill} key=${a.k} tone=${evo.deltas[a.k] > 0 ? "ok" : "bad"}>${a.l} ${evo.deltas[a.k] > 0 ? "+" : ""}${evo.deltas[a.k]}</${Pill}>`)}</div>` : null}
      <p className="muted small">${next ? "Prochain niveau : " + next.n + " à " + next.min + "." : "Niveau Élite : bravo."} ${done.length ? plural(done.length, "badge") + " débloqué" + (done.length > 1 ? "s" : "") + "." : ""}</p>
    </div></div>`;
}
