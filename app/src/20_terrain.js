/* ===== Sports et séances terrain : choix du sport, adaptation des séances, schémas animés ===== */
const SPORTS = CONTENT.SPORTS || [], DRILLS = CONTENT.DRILLS || [], SREFS = CONTENT.SREFS || {};
const SPB = Object.fromEntries(SPORTS.map((s) => [s.id, s]));
const DRB = Object.fromEntries(DRILLS.map((d) => [d.id, d]));
const DTYPES = ["Vitesse", "Endurance", "Agilité", "Puissance", "Technique", "Test"];

/* ---------- sport de l'athlète ---------- */
function sportNorm(s) { return " " + normTxt2(s).replace(/[^a-z0-9]+/g, " ").trim() + " "; }
function sportIdOf(text) {
  const s = sportNorm(text);
  if (!s.trim()) return null;
  let best = null, bl = 0;
  SPORTS.forEach((sp) => [sp.n, ...(sp.keys || [])].forEach((k) => { const kk = sportNorm(k); if (kk.trim() && s.includes(kk) && kk.length > bl) { best = sp.id; bl = kk.length; } }));
  return best;
}
function sportOf(p) { const id = p && p.sportId && SPB[p.sportId] ? p.sportId : sportIdOf(p && p.sport); return id ? SPB[id] : null; }
function posteName(sp, poste) { const x = sp && (sp.postes || []).find((q) => q[0] === poste); return x ? x[1] : ""; }
/* nom du sport en minuscules dans une phrase, sigles conservés (XV, MMA, VTT, JJB) */
function spLow(n) { return String(n || "").split(/(\s+)/).map((w) => (/^[A-Z0-9]{2,}$/.test(w.replace(/[^A-Za-z0-9]/g, "")) ? w : w.toLowerCase())).join(""); }
function sportLabel(p) { const sp = sportOf(p); if (!sp) return (p && p.sport) || ""; const po = posteName(sp, p.poste); return sp.n + (po ? " · " + po : ""); }
function drillsFor(sp) { return sp ? (sp.drills || []).map((id) => DRB[id]).filter(Boolean) : []; }
/* fiches « Technique » (skills) : consultées ou conseillées, jamais tirées au sort pour la séance de la semaine */
function skillsFor(sp) { return sp ? (sp.skills || []).map((id) => DRB[id]).filter(Boolean) : []; }
const CONTACT_N = { aucun: "Sans contact", toucher: "Toucher", bouclier: "Contact au bouclier", bags: "Contact sur tackle bag", reel: "Contact réel contrôlé" };
function contactHard(d) { return !!(d && d.contact && !["aucun", "toucher"].includes(d.contact)); }
function sportAdaptOn(p) { return !!sportOf(p) && !(p && p.sportAdapt === false); }

/* ---------- adaptation des séances du programme au sport ---------- */
function isTerrainSession(s) { const l = String((s && s.lieu) || ""); return /terrain|ext[ée]rieur|piste|c[ôo]te/i.test(l) && !/salle/i.test(l); }
function sportItems(entry, data, prog) {
  const items = (entry && entry.s && entry.s.items) || [];
  const p = data && data.profile;
  const plan = data && data.plan;
  const sp = sportOf(p);
  if (!sp || (p && p.sportAdapt === false) || !entry || entry.extra || entry.opt) return items;
  const pid = (prog && prog.id) || (plan && plan.programId);
  if (pid === "retour") return items;
  const swapped = items.map((it) => { const sw = (sp.swap || {})[it.e]; return sw && EXB[sw.e] ? { e: sw.e, w: sw.w, n: it.n, sport: sp.id, from: it.e } : it; });
  if (isTerrainSession(entry.s)) return swapped;
  /* exercices spécifiques : répartis sur les séances en salle du bloc */
  const b = prog ? blockOf(prog, entry.w) : null;
  const salle = b ? b.sessions.filter((s) => !isTerrainSession(s)).map((s) => s.id) : ["A", "B", "C"];
  const k = Math.max(0, salle.indexOf(entry.sid));
  const blk = clamp(Math.ceil(entry.w / 4), 1, 3);
  const list = (sp.spec || []).filter((x) => EXB[x[0]]);
  const pick = salle.length <= 1 ? list : list.filter((x, i) => i % salle.length === k % Math.max(1, Math.min(salle.length, list.length)));
  const ps = sp.poste_spec && p && p.poste && sp.poste_spec[p.poste];
  const all = [...(k === 0 && ps && EXB[ps[0]] ? [ps] : []), ...pick];
  const have = new Set(swapped.map((x) => x.e));
  const extra = all.filter((x) => !have.has(x[0])).map((x) => ({ e: x[0], w: x[blk], spec: true, sport: sp.id }));
  return [...swapped, ...extra];
}
/* programme enrichi des tests du sport */
function sportProg(prog, profile) {
  const sp = sportOf(profile);
  if (!prog || !sp || !(sp.tests || []).length) return prog;
  const add = sp.tests.filter((t) => TESTS[t] && !prog.tests.includes(t));
  return add.length ? { ...prog, tests: [...prog.tests, ...add] } : prog;
}
/* séance terrain conseillée cette semaine : conseil d'Antoine ou du coach IA, sinon rotation */
function terrainAdvice(data, w) { return activeAdj(data, "terrain").filter((a) => DRB[a.drill] && w >= (a.fromW || 0) && w <= (a.toW || 99)).slice(-1)[0] || null; }
function terrainOfWeek(data, w, wib) {
  const sp = sportOf(data && data.profile);
  const adv = terrainAdvice(data, w);
  if (adv) return { d: DRB[adv.drill], adv };
  const ds = drillsFor(sp);
  if (!ds.length) return null;
  if (wib === 4) { const t = ds.find((x) => x.type === "Test" && x.test); if (t) return { d: t }; }
  const pool = ds.filter((x) => x.type !== "Test");
  return pool.length ? { d: pool[(Math.max(1, w) - 1) % pool.length] } : null;
}

/* ---------- dose, allure et minuteur ---------- */
function drillDose(d, niveau) { const n = d && d.dose ? (d.dose[niveau] || d.dose.sportif) : null; return n || {}; }
function drillPace(d, niveau, data) {
  if (!d || !d.pace) return null;
  const v = vmaOf(data);
  const pct = (d.pace.pct || {})[niveau] || (d.pace.pct || {}).sportif || 100;
  if (!v) return { pct, need: true };
  const ms = (v * pct) / 100 / 3.6;
  if (d.pace.dist) return { pct, vma: v, secs: Math.round(d.pace.dist / ms), perKm: Math.round(1000 / ms) };
  if (d.pace.secs) return { pct, vma: v, m: Math.round(ms * d.pace.secs) };
  return { pct, vma: v, perKm: Math.round(1000 / ms) };
}
function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + " min " + String(s % 60).padStart(2, "0") + " s"; }
function seqDrill(d, niveau, data) {
  const x = drillDose(d, niveau);
  if (!x.r || x.m) return null;
  const pc = drillPace(d, niveau, data);
  const w = pc && pc.secs ? pc.secs : x.w;
  const sc = d.sc || null;
  const seq = [{ kind: "prep", secs: 10, n: x.lab || d.n, sc, label: "Prépare-toi" }];
  for (let s = 1; s <= (x.s || 1); s++) {
    for (let r = 1; r <= x.r; r++) {
      seq.push({ kind: "work", secs: w, n: x.lab || d.n, sc, round: s, rep: r, reps: x.r, sets: x.s || 1,
        label: "Répétition " + r + "/" + x.r + ((x.s || 1) > 1 ? " · série " + s + "/" + x.s : "") + (!x.p ? " · départ toutes les " + w + " s" : "") });
      const lastRep = r === x.r, lastSet = s === (x.s || 1);
      if (!lastRep && x.p) seq.push({ kind: "rest", secs: x.p, n: x.lab || d.n, sc, label: "Récupère", round: s });
      if (lastRep && !lastSet) seq.push({ kind: "rest", secs: x.sp || 120, n: x.lab || d.n, sc, label: "Fin de la série " + s, round: s });
    }
  }
  return seq;
}
function drillMinutes(d, niveau, data) { const q = seqDrill(d, niveau, data); return q ? Math.round(seqSecs(q) / 60) : null; }

/* ---------- schéma : géométrie et animation ---------- */
const TS_SPEED = { sprint: 7, jog: 3.2, back: 3, lat: 2.6, walk: 1.7, ball: 12 };
const TS_PAUSE = { down: 0.8, jump: 0.45, hit: 0.35, turn: 0.12 };
const TS_KIND = { sprint: "Sprint / course rapide", jog: "Course lente, trot", back: "Course arrière", lat: "Pas chassés, déplacement latéral", walk: "Marche, récupération", ball: "Passe ou trajet du ballon" };
function tsLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function tsAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === pts.length - 1) { const t = l ? clamp(d / l, 0, 1) : 1; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])]; }
    d -= l;
  }
  return [pts[0][0], pts[0][1], 0];
}
function tsTimeline(sc) {
  const by = {};
  (sc.p || []).forEach((p, i) => { const r = p.r || 0; (by[r] = by[r] || []).push({ ...p, i, L: tsLen(p.p || []) }); });
  let T = 0;
  const runners = Object.entries(by).map(([r, ps]) => {
    let t = 0;
    const segs = ps.map((p) => { const dur = p.L / (TS_SPEED[p.k] || 4); const s = { ...p, t0: t, t1: t + dur, t2: t + dur + (p.w || 0) + (TS_PAUSE[p.e] || 0) }; t = s.t2; return s; });
    T = Math.max(T, t);
    return { r: Number(r), segs };
  });
  const k = T ? clamp(T, 3.5, 10) / T : 1;
  runners.forEach((ru) => ru.segs.forEach((s) => { s.t0 *= k; s.t1 *= k; s.t2 *= k; }));
  return { runners, T: T * k + 1.2 };
}
function tsRunnerAt(ru, t) {
  const s = ru.segs.find((x) => t < x.t2) || ru.segs[ru.segs.length - 1];
  if (!s) return null;
  const f = t <= s.t0 ? 0 : s.t1 > s.t0 ? clamp((t - s.t0) / (s.t1 - s.t0), 0, 1) : 1;
  const pos = tsAt(s.p, s.L * f);
  return { x: pos[0], y: pos[1], seg: s.i, down: f >= 1 && s.e === "down" && t < s.t2 };
}

/* ---------- fonds de terrain ---------- */
function tsField(f, v, u, fs, compact) {
  const [x0, y0, x1, y1] = v;
  const W = x1 - x0, H = y1 - y0;
  const sw = { strokeWidth: 0.9 * u };
  const sd = { strokeWidth: 0.9 * u, strokeDasharray: 3 * u + " " + 2.5 * u };
  const L = (a, b, c, d, dash, k) => html`<line key=${k || a + "-" + b + "-" + c + "-" + d} x1=${a} y1=${b} x2=${c} y2=${d} className="ts-l" style=${dash ? sd : sw} />`;
  const R = (x, y, w, h, cls, k) => html`<rect key=${k || "r" + x + "-" + y + "-" + w} x=${x} y=${y} width=${w} height=${h} className=${cls} />`;
  const Rl = (x, y, w, h, k) => html`<rect key=${k || "rl" + x + "-" + y + "-" + w} x=${x} y=${y} width=${w} height=${h} className="ts-l" style=${{ ...sw, fill: "none" }} />`;
  const P = (d, k, dash, cls) => html`<path key=${k} d=${d} className=${cls || "ts-l"} style=${{ ...(dash ? sd : sw), fill: cls ? undefined : "none" }} />`;
  const lab = (x, t) => (compact || x < x0 || x > x1 ? null : html`<text key=${"lab" + x + t} x=${x} y=${y0 + fs * 1.05} className="ts-fl" style=${{ fontSize: fs * 0.78 }} textAnchor="middle">${t}</text>`);
  const big = R(x0 - W, y0 - H, W * 3, H * 3, "ts-surr", "surr");
  const stripes = (a, b, top, bot, step) => { const out = []; for (let x = a, i = 0; x < b; x += step, i++) if (i % 2) out.push(R(x, top, Math.min(step, b - x), bot - top, "ts-stripe", "st" + x)); return out; };
  if (f === "rugby") return html`<g>${big}${R(-10, 0, 120, 70, "ts-grass", "g")}${stripes(0, 100, 0, 70, 10)}${R(-10, 0, 10, 70, "ts-grass2", "ig1")}${R(100, 0, 10, 70, "ts-grass2", "ig2")}
    ${[-10, 0, 22, 50, 78, 100, 110].map((x) => L(x, 0, x, 70))}${[40, 60].map((x) => L(x, 0, x, 70, true))}${L(-10, 0, 110, 0)}${L(-10, 70, 110, 70)}
    ${[5, 65].map((y) => L(0, y, 100, y, true))}${[15, 55].flatMap((y) => [5, 22, 40, 50, 60, 78, 95].map((x) => L(x - 1, y, x + 1, y, false, "m" + x + y)))}
    ${[0, 100].map((x) => html`<g key=${"po" + x}><line x1=${x} y1=${32.2} x2=${x} y2=${37.8} className="ts-post" style=${{ strokeWidth: 2.2 * u }} /></g>`)}
    ${lab(0, "En-but")}${lab(22, "22 m")}${lab(40, "10 m")}${lab(50, "Milieu")}${lab(60, "10 m")}${lab(78, "22 m")}${lab(100, "En-but")}</g>`;
  if (f === "foot") {
    const half = (m) => { const X = (x) => (m ? 105 - x : x);
      return [Rl(m ? 105 - 16.5 : 0, 13.84, 16.5, 40.32, "pa" + m), Rl(m ? 105 - 5.5 : 0, 24.84, 5.5, 18.32, "ga" + m),
        html`<circle key=${"ps" + m} cx=${X(11)} cy=${34} r=${0.35} className="ts-dot" />`,
        P("M" + X(16.5) + " " + (34 - 7.31) + " A 9.15 9.15 0 0 " + (m ? 0 : 1) + " " + X(16.5) + " " + (34 + 7.31), "arc" + m),
        R(m ? 105 : -2, 30.34, 2, 7.32, "ts-goal", "gl" + m)]; };
    return html`<g>${big}${R(0, 0, 105, 68, "ts-grass", "g")}${stripes(0, 105, 0, 68, 10.5)}${Rl(0, 0, 105, 68, "o")}${L(52.5, 0, 52.5, 68)}
      <circle cx=${52.5} cy=${34} r=${9.15} className="ts-l" style=${{ ...sw, fill: "none" }} />${half(0)}${half(1)}
      ${lab(16.5, "Surface")}${lab(52.5, "Milieu")}${lab(88.5, "Surface")}</g>`;
  }
  if (f === "hand") {
    const zone = (m, r, dash) => { const X = (x) => (m ? 40 - x : x); const sweep = m ? 0 : 1;
      return P("M" + X(0) + " " + (8.5 - r) + " A " + r + " " + r + " 0 0 " + sweep + " " + X(r) + " 8.5 L " + X(r) + " 11.5 A " + r + " " + r + " 0 0 " + sweep + " " + X(0) + " " + (11.5 + r), "z" + m + r, dash); };
    return html`<g>${big}<defs><clipPath id="ts-hand-clip"><rect x="0" y="0" width="40" height="20" /></clipPath></defs>${R(0, 0, 40, 20, "ts-court", "c")}
      <g clipPath="url(#ts-hand-clip)">${R(0, 0, 40, 20, "ts-court", "c2")}${zone(0, 6)}${zone(1, 6)}${zone(0, 9, true)}${zone(1, 9, true)}</g>
      ${Rl(0, 0, 40, 20, "o")}${L(20, 0, 20, 20)}${L(7, 9.5, 7, 10.5)}${L(33, 9.5, 33, 10.5)}${R(-1, 8.5, 1, 3, "ts-goal", "g1")}${R(40, 8.5, 1, 3, "ts-goal", "g2")}
      ${lab(6, "6 m")}${lab(9, "9 m")}${lab(20, "Milieu")}${lab(31, "9 m")}${lab(34, "6 m")}</g>`;
  }
  if (f === "basket") {
    const side = (m) => { const X = (x) => (m ? 28 - x : x); const hx = X(1.575);
      return [Rl(m ? 28 - 5.8 : 0, 5.05, 5.8, 4.9, "k" + m), html`<circle key=${"ft" + m} cx=${X(5.8)} cy=${7.5} r=${1.8} className="ts-l" style=${{ ...sw, fill: "none" }} />`,
        L(X(0), 0.9, X(2.99), 0.9, false, "c1" + m), L(X(0), 14.1, X(2.99), 14.1, false, "c2" + m),
        P("M " + X(2.99) + " 0.9 A 6.75 6.75 0 0 " + (m ? 0 : 1) + " " + X(2.99) + " 14.1", "tp" + m),
        html`<circle key=${"h" + m} cx=${hx} cy=${7.5} r=${0.3} className="ts-l" style=${{ ...sw, fill: "none" }} />`, L(X(1.2), 6.6, X(1.2), 8.4, false, "bb" + m)]; };
    return html`<g>${big}${R(0, 0, 28, 15, "ts-court", "c")}${Rl(0, 0, 28, 15, "o")}${L(14, 0, 14, 15)}<circle cx=${14} cy=${7.5} r=${1.8} className="ts-l" style=${{ ...sw, fill: "none" }} />${side(0)}${side(1)}
      ${lab(5.8, "LF")}${lab(14, "Milieu")}${lab(22.2, "LF")}</g>`;
  }
  if (f === "volley") return html`<g>${big}${R(-3, -3, 24, 15, "ts-court2", "fz")}${R(0, 0, 18, 9, "ts-court", "c")}${Rl(0, 0, 18, 9, "o")}${L(6, 0, 6, 9)}${L(12, 0, 12, 9)}
    <line x1=${9} y1=${-1} x2=${9} y2=${10} className="ts-net" style=${{ strokeWidth: 2.4 * u }} />${lab(9, "Filet")}${lab(12, "3 m")}${lab(6, "3 m")}</g>`;
  if (f === "tennis") return html`<g>${big}${R(-4, -3.5, 31.77, 17.97, "ts-court2", "fz")}${R(0, 0, 23.77, 10.97, "ts-court", "c")}${Rl(0, 0, 23.77, 10.97, "o")}${L(0, 1.37, 23.77, 1.37)}${L(0, 9.6, 23.77, 9.6)}
    ${L(5.485, 1.37, 5.485, 9.6)}${L(18.285, 1.37, 18.285, 9.6)}${L(5.485, 5.485, 18.285, 5.485)}${L(0, 5.485, 0.3, 5.485)}${L(23.47, 5.485, 23.77, 5.485)}
    <line x1=${11.885} y1=${-0.914} x2=${11.885} y2=${11.884} className="ts-net" style=${{ strokeWidth: 2.2 * u }} />${lab(11.885, "Filet")}${lab(18.285, "Service")}${lab(23.77, "Fond")}</g>`;
  if (f === "padel") return html`<g>${big}${R(0, 0, 20, 10, "ts-court", "c")}${Rl(0, 0, 20, 10, "o")}${L(3.05, 0, 3.05, 10)}${L(16.95, 0, 16.95, 10)}${L(3.05, 5, 16.95, 5)}
    ${[0, 20].map((x) => html`<line key=${"w" + x} x1=${x} y1=${0} x2=${x} y2=${10} className="ts-wall" style=${{ strokeWidth: 3 * u }} />`)}
    ${[[0, 0, 4, 0], [16, 0, 20, 0], [0, 10, 4, 10], [16, 10, 20, 10]].map((a, i) => html`<line key=${"sw" + i} x1=${a[0]} y1=${a[1]} x2=${a[2]} y2=${a[3]} className="ts-wall" style=${{ strokeWidth: 3 * u }} />`)}
    <line x1=${10} y1=${-0.4} x2=${10} y2=${10.4} className="ts-net" style=${{ strokeWidth: 2.2 * u }} />${lab(10, "Filet")}${lab(16.95, "Service")}${lab(20, "Vitre")}</g>`;
  if (f === "bad") return html`<g>${big}${R(0, 0, 13.4, 6.1, "ts-court", "c")}${Rl(0, 0, 13.4, 6.1, "o")}${L(0, 0.46, 13.4, 0.46)}${L(0, 5.64, 13.4, 5.64)}${L(4.72, 0, 4.72, 6.1)}${L(8.68, 0, 8.68, 6.1)}
    ${L(0.76, 0, 0.76, 6.1)}${L(12.64, 0, 12.64, 6.1)}${L(0, 3.05, 4.72, 3.05)}${L(8.68, 3.05, 13.4, 3.05)}
    <line x1=${6.7} y1=${-0.3} x2=${6.7} y2=${6.4} className="ts-net" style=${{ strokeWidth: 2.2 * u }} />${lab(6.7, "Filet")}${lab(12.64, "Fond")}</g>`;
  if (f === "piste") {
    const lines = []; for (let i = 0; i <= 8; i++) lines.push(L(x0 - 5, 0.2 + i * 1.22, x1 + 5, 0.2 + i * 1.22, false, "ln" + i));
    const ticks = []; for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) ticks.push(html`<g key=${"tk" + x}><line x1=${x} y1=${0.2} x2=${x} y2=${9.96} className="ts-l" style=${{ strokeWidth: 0.6 * u, opacity: 0.5 }} />${compact ? null : html`<text x=${x} y=${y1 - fs * 0.3} className="ts-fl" style=${{ fontSize: fs * 0.72 }} textAnchor="middle">${x} m</text>`}</g>`);
    return html`<g>${big}${R(x0 - 5, -1, W + 10, H + 2, "ts-grass", "g")}${R(x0 - 5, 0.2, W + 10, 9.76, "ts-track", "t")}${lines}${ticks}</g>`;
  }
  if (f === "pelouse") {
    const g = []; for (let x = Math.floor(x0 / 5) * 5; x <= x1; x += 5) g.push(L(x, y0 - 5, x, y1 + 5, false, "gx" + x)); for (let y = Math.floor(y0 / 5) * 5; y <= y1; y += 5) g.push(L(x0 - 5, y, x1 + 5, y, false, "gy" + y));
    return html`<g>${R(x0 - W, y0 - H, W * 3, H * 3, "ts-grass", "g")}<g className="ts-grid">${g}</g></g>`;
  }
  if (f === "baseball") {
    const home = [0, 40], first = [19.4, 20.6], second = [0, 1.2], third = [-19.4, 20.6];
    const dirt = [[0, 44], [24, 20.6], [0, -3.6], [-24, 20.6]].map((q) => q.join(" ")).join(" L ");
    return html`<g>${R(x0 - W, y0 - H, W * 3, H * 3, "ts-grass", "g")}<path d=${"M " + dirt + " Z"} className="ts-dirt" />
      <path d=${"M " + [home, first, second, third].map((q) => q.join(" ")).join(" L ") + " Z"} className="ts-grass2" />
      ${L(0, 40, 40, 0)}${L(0, 40, -40, 0)}<circle cx=${0} cy=${21.56} r=${2.7} className="ts-dirt" /><circle cx=${0} cy=${21.56} r=${0.5} className="ts-dot" /></g>`;
  }
  if (f === "bassin") {
    const ropes = []; for (let i = 1; i < 5; i++) ropes.push(html`<line key=${"rp" + i} x1=${0} y1=${i * 2.5} x2=${25} y2=${i * 2.5} className="ts-rope" style=${{ strokeWidth: 1.4 * u, strokeDasharray: 1.2 * u + " " + 1.2 * u }} />`);
    return html`<g>${big}${R(-1.5, -1, 28, 14.5, "ts-deck", "d")}${R(0, 0, 25, 12.5, "ts-water", "w")}${ropes}
      ${[0, 25].map((x) => html`<line key=${"wl" + x} x1=${x} y1=${0} x2=${x} y2=${12.5} className="ts-wall" style=${{ strokeWidth: 3 * u }} />`)}${lab(12.5, "25 m")}</g>`;
  }
  if (f === "ring") return html`<g>${big}${R(-0.6, -0.6, 7.2, 7.2, "ts-mat2", "m2")}${R(0, 0, 6, 6, "ts-mat", "m")}${[0, 0.25, 0.5].map((o) => html`<rect key=${"rope" + o} x=${-o} y=${-o} width=${6 + 2 * o} height=${6 + 2 * o} className="ts-rope" style=${{ strokeWidth: 1.2 * u, fill: "none" }} />`)}
    ${[[0, 0], [6, 0], [0, 6], [6, 6]].map((q, i) => html`<circle key=${"cp" + i} cx=${q[0]} cy=${q[1]} r=${0.25} className="ts-dot" />`)}</g>`;
  if (f === "bob") return html`<g>${R(x0 - W, y0 - H, W * 3, H * 3, "ts-deck", "d")}${R(x0 - 5, 1, W + 10, 6, "ts-ice", "i")}${L(x0 - 5, 2.4, x1 + 5, 2.4)}${L(x0 - 5, 5.6, x1 + 5, 5.6)}
    ${R(-2.5, 1, 2.5, 6, "ts-block", "b")}</g>`;
  if (f === "cote") return null;
  return html`<g>${R(x0 - W, y0 - H, W * 3, H * 3, "ts-grass", "g")}</g>`;
}
/* côte vue de profil : le sol passe sous le premier trajet */
function tsSlope(sc, u, fs, compact) {
  const p = (sc.p || [])[0];
  if (!p) return null;
  const a = p.p[0], b = p.p[p.p.length - 1];
  const k = (b[1] - a[1]) / (b[0] - a[0] || 1);
  const [x0, y0, x1, y1] = sc.v;
  const gy = (x) => a[1] + 2.4 + k * (x - a[0]);
  return html`<g><rect x=${x0 - 50} y=${y0 - 50} width=${x1 - x0 + 100} height=${y1 - y0 + 100} className="ts-sky" />
    <path d=${"M " + (x0 - 5) + " " + gy(x0 - 5) + " L " + (x1 + 5) + " " + gy(x1 + 5) + " L " + (x1 + 5) + " " + (y1 + 20) + " L " + (x0 - 5) + " " + (y1 + 20) + " Z"} className="ts-ground" />
    <line x1=${x0 - 5} y1=${gy(x0 - 5)} x2=${x1 + 5} y2=${gy(x1 + 5)} className="ts-l" style=${{ strokeWidth: 1.2 * u }} />
    ${compact ? null : html`<text x=${x1 - fs * 0.6} y=${y1 - fs * 0.4} className="ts-fl" style=${{ fontSize: fs * 0.8 }} textAnchor="end">Pente de 5 à 10 % (dessin exagéré)</text>`}</g>`;
}

/* ---------- objets ---------- */
function tsObj(o, i, fs, u, compact) {
  const [x, y, k, t] = o;
  const s = fs * 0.55;
  const lab = !compact && t ? html`<text x=${x} y=${y + s * 2.2} className="ts-ol" style=${{ fontSize: fs * 0.78 }} textAnchor="middle">${t}</text>` : null;
  let g = null;
  if (k === "c") g = html`<path d=${"M " + (x - s * 0.7) + " " + (y + s * 0.55) + " L " + x + " " + (y - s * 0.85) + " L " + (x + s * 0.7) + " " + (y + s * 0.55) + " Z"} className="ts-cone" style=${{ strokeWidth: 0.6 * u }} />`;
  else if (k === "start") g = html`<g><line x1=${x} y1=${y + s * 0.8} x2=${x} y2=${y - s * 1.1} className="ts-flagp" style=${{ strokeWidth: 1.2 * u }} /><path d=${"M " + x + " " + (y - s * 1.1) + " L " + (x + s * 1.1) + " " + (y - s * 0.75) + " L " + x + " " + (y - s * 0.4) + " Z"} className="ts-flag" /></g>`;
  else if (k === "x") g = html`<g className="ts-x" style=${{ strokeWidth: 1.6 * u }}><line x1=${x - s * 0.6} y1=${y - s * 0.6} x2=${x + s * 0.6} y2=${y + s * 0.6} /><line x1=${x - s * 0.6} y1=${y + s * 0.6} x2=${x + s * 0.6} y2=${y - s * 0.6} /></g>`;
  else if (k === "pa" || k === "pb") g = html`<circle cx=${x} cy=${y} r=${s * 0.75} className=${k === "pa" ? "ts-pa" : "ts-pb"} style=${{ strokeWidth: 0.8 * u }} />`;
  else if (k === "ball") g = html`<circle cx=${x} cy=${y} r=${s * 0.42} className="ts-ball" style=${{ strokeWidth: 0.7 * u }} />`;
  else if (k === "sled") g = html`<g><rect x=${x - s * 1.2} y=${y - s * 0.7} width=${s * 2.4} height=${s * 1.4} rx=${s * 0.3} className="ts-sled" style=${{ strokeWidth: 0.7 * u }} /><line x1=${x + s * 1.2} y1=${y} x2=${x + s * 2} y2=${y} className="ts-sled" style=${{ strokeWidth: 1.2 * u }} /></g>`;
  else if (k === "wk") g = html`<line x1=${x} y1=${y - s * 0.9} x2=${x} y2=${y + s * 0.9} className="ts-wk" style=${{ strokeWidth: 1.8 * u }} />`;
  else if (k === "base") g = html`<rect x=${x - s * 0.6} y=${y - s * 0.6} width=${s * 1.2} height=${s * 1.2} transform=${"rotate(45 " + x + " " + y + ")"} className="ts-base" style=${{ strokeWidth: 0.6 * u }} />`;
  else if (k === "goal") g = html`<rect x=${x - s * 0.3} y=${y - s * 1.6} width=${s * 0.6} height=${s * 3.2} className="ts-goal" />`;
  else if (k === "shield") g = html`<rect x=${x - s * 0.45} y=${y - s * 0.9} width=${s * 0.9} height=${s * 1.8} rx=${s * 0.35} className="ts-shield" style=${{ strokeWidth: 0.7 * u }} />`;
  return html`<g key=${"o" + i}>${g}${lab}</g>`;
}
function tsEnd(e, x, y, a, fs, u, k) {
  const s = fs * 0.5;
  if (e === "down") return html`<g key=${k} className="ts-x" style=${{ strokeWidth: 1.5 * u }}><line x1=${x - s * 0.5} y1=${y - s * 0.5} x2=${x + s * 0.5} y2=${y + s * 0.5} /><line x1=${x - s * 0.5} y1=${y + s * 0.5} x2=${x + s * 0.5} y2=${y - s * 0.5} /></g>`;
  if (e === "jump") return html`<path key=${k} d=${"M " + (x - s * 0.6) + " " + (y - s * 0.2) + " L " + x + " " + (y - s * 1.1) + " L " + (x + s * 0.6) + " " + (y - s * 0.2)} className="ts-mk" style=${{ strokeWidth: 1.5 * u, fill: "none" }} />`;
  if (e === "hit") return html`<g key=${k} className="ts-mk" style=${{ strokeWidth: 1.3 * u }}>${[0, 60, 120].map((d) => { const r = (d * Math.PI) / 180; return html`<line key=${d} x1=${x - Math.cos(r) * s * 0.6} y1=${y - Math.sin(r) * s * 0.6} x2=${x + Math.cos(r) * s * 0.6} y2=${y + Math.sin(r) * s * 0.6} />`; })}</g>`;
  if (e === "turn") return html`<circle key=${k} cx=${x} cy=${y} r=${s * 0.35} className="ts-turn" style=${{ strokeWidth: 1.1 * u }} />`;
  return null;
}
function tsArrow(pts, cls, sz, k) {
  if (!pts || pts.length < 2) return null;
  const b = pts[pts.length - 1], a = pts[pts.length - 2];
  const an = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const p1 = [b[0] - Math.cos(an - 0.45) * sz, b[1] - Math.sin(an - 0.45) * sz], p2 = [b[0] - Math.cos(an + 0.45) * sz, b[1] - Math.sin(an + 0.45) * sz];
  return html`<path key=${k} d=${"M " + b.join(" ") + " L " + p1.join(" ") + " L " + p2.join(" ") + " Z"} className=${cls + " ts-ah"} />`;
}
function tsLabelPos(pts, lp, lo, fs) {
  const L = tsLen(pts);
  const [x, y, a] = tsAt(pts, L * (lp ?? 0.5));
  let nx = -Math.sin(a), ny = Math.cos(a);
  if (ny < -1e-6 || (Math.abs(ny) < 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }   /* toujours vers le bas (ou la droite) */
  const side = lo || -1, off = fs * 0.95;
  const vert = Math.abs(ny) < 0.35;
  return [x + nx * off * side * (vert ? 1.6 : 1), y + ny * off * side + fs * 0.3, vert ? (side * nx > 0 ? "start" : "end") : "middle"];
}

/* ---------- schéma animé ---------- */
function TerrainSchema({ sc, title, compact, autoplay, legend }) {
  const tl = useMemo(() => (sc ? tsTimeline(sc) : null), [sc]);
  const reduce = useMemo(() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }, []);
  const [play, setPlay] = useState(autoplay !== false && !reduce);
  const [slow, setSlow] = useState(false);
  const [time, setTime] = useState(0);
  const [vis, setVis] = useState(true);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((es) => setVis(es.some((e) => e.isIntersecting)), { threshold: 0.05 });
    io.observe(ref.current); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!tl || !play || !vis) return undefined;
    let raf, last = performance.now();
    const tick = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; setTime((x) => (x + dt * (slow ? 0.5 : 1)) % tl.T); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tl, play, vis, slow]);
  if (!sc || !tl) return null;
  const [x0, y0, x1, y1] = sc.v;
  const W = x1 - x0, H = y1 - y0;
  const u = W / 300;
  const fs = clamp(Math.max(W, H * 0.8) * 0.032, 0.18, 5);
  const tall = H > W * 0.72;
  const cid = useMemo(() => "tsc" + Math.random().toString(36).slice(2, 8), []);
  const numAt = useMemo(() => { const seen = []; return (sc.p || []).map((p) => { if (!p.n) return null; const q = p.p[0]; const near = seen.some((z) => Math.hypot(z[0] - q[0], z[1] - q[1]) < fs * 1.3); seen.push(q); return near ? tsAt(p.p, tsLen(p.p) * 0.38) : q; }); }, [sc, fs]);
  const run = tl.runners.map((ru) => ({ ru, at: tsRunnerAt(ru, play || time > 0 ? time : tl.T) }));
  const active = new Set(run.map((r) => (r.at ? r.at.seg : -1)));
  const doneUpTo = (i, r) => { const ru = tl.runners.find((q) => q.r === r); const s = ru && ru.segs.find((q) => q.i === i); return !(play || time > 0) || (s && time >= s.t0); };
  const kinds = [...new Set((sc.p || []).map((p) => p.k))];
  const stroke = (k) => ({ sprint: 2.6, jog: 2, back: 2.4, lat: 2.4, walk: 1.8, ball: 1.5 }[k] || 2) * u;
  const dash = (k) => ({ jog: [5, 3.5], back: [1.4, 3], lat: [6, 2.5, 1.5, 2.5], walk: [1.2, 3.2], ball: [3, 2.5] }[k] || null);
  const aria = (title || "Schéma de la séance") + ". " + (sc.p || []).filter((p) => p.l).map((p, i) => (p.n || i + 1) + " : " + TS_KIND[p.k].split(",")[0].toLowerCase() + (p.l ? ", " + p.l : "")).join(" ; ");
  return html`<div className=${"ts" + (compact ? " compact" : "")} ref=${ref}>
    <div className=${"ts-stage ts-f-" + sc.f}><svg viewBox=${x0 + " " + y0 + " " + W + " " + H} className="ts-svg" role="img" aria-label=${aria} preserveAspectRatio="xMidYMid meet" style=${tall ? { maxWidth: compact ? Math.round(110 * W / H) + "px" : "min(100%, " + Math.round(420 * W / H) + "px)", margin: "0 auto" } : null}>
      <defs><clipPath id=${cid}><rect x=${x0} y=${y0} width=${W} height=${H} /></clipPath></defs><g clipPath=${"url(#" + cid + ")"}>
      ${sc.f === "cote" ? tsSlope(sc, u, fs, compact) : tsField(sc.f, sc.v, u, fs, compact)}
      ${(sc.z || []).map((z, i) => html`<g key=${"z" + i}><rect x=${z[0]} y=${z[1]} width=${z[2]} height=${z[3]} className="ts-zone" style=${{ strokeWidth: 0.8 * u, strokeDasharray: 3 * u + " " + 2 * u }} />
        ${z[4] && !compact ? html`<text x=${z[0] + z[2] / 2} y=${z[1] + z[3] - fs * 0.4} className="ts-zl" style=${{ fontSize: fs * 0.8 }} textAnchor="middle">${z[4]}</text>` : null}</g>`)}
      ${(sc.p || []).map((p, i) => {
        const on = doneUpTo(i, p.r || 0);
        const cls = "ts-p ts-" + p.k + (active.has(i) && (play || time > 0) ? " cur" : "") + (on ? "" : " later");
        const d = "M " + p.p.map((q) => q[0] + " " + q[1]).join(" L ");
        const ds = dash(p.k);
        const last = p.p[p.p.length - 1];
        const lpos = p.l && !compact ? tsLabelPos(p.p, p.lp, p.lo, fs) : null;
        const npos = p.n && !compact ? numAt[i] : null;
        return html`<g key=${"p" + i} className=${on ? "" : "ts-later"}>
          <path d=${d} className=${cls} style=${{ strokeWidth: stroke(p.k), strokeDasharray: ds ? ds.map((x) => x * u).join(" ") : undefined, fill: "none" }} />
          ${tsArrow(p.p, "ts-" + p.k, fs * 0.6, "a" + i)}
          ${p.e ? tsEnd(p.e, last[0], last[1], 0, fs, u, "e" + i) : null}
          ${npos ? html`<g><circle cx=${npos[0]} cy=${npos[1]} r=${fs * 0.55} className="ts-num" /><text x=${npos[0]} y=${npos[1] + fs * 0.24} className="ts-numt" style=${{ fontSize: fs * 0.66 }} textAnchor="middle">${p.n}</text></g>` : null}
          ${lpos ? html`<text x=${lpos[0]} y=${lpos[1]} className="ts-pl" style=${{ fontSize: fs * 0.82 }} textAnchor=${lpos[2]}>${p.l}</text>` : null}
        </g>`;
      })}
      ${(sc.o || []).map((o, i) => tsObj(o, i, fs, u, compact))}
      ${!compact ? (sc.t || []).map((t, i) => html`<text key=${"t" + i} x=${t[0]} y=${t[1]} className="ts-tx" style=${{ fontSize: fs * 0.8 }} textAnchor="middle">${t[2]}</text>`) : null}
      ${play || time > 0 ? run.map(({ ru, at }) => (at ? html`<g key=${"ru" + ru.r}><circle cx=${at.x} cy=${at.y} r=${fs * (at.down ? 0.75 : 0.6)} className=${"ts-run" + (ru.r ? " r2" : "") + (at.down ? " down" : "")} style=${{ strokeWidth: 0.9 * u }} /></g>` : null)) : null}
    </g></svg></div>
    ${compact ? null : html`<div className="ts-ctl">
      <button type="button" className="mv-b" onClick=${() => setPlay(!play)} aria-label=${play ? "Mettre en pause le schéma" : "Animer le schéma"}>${play ? "Pause" : "Lecture"}</button>
      <button type="button" className=${"mv-b" + (slow ? " on" : "")} aria-pressed=${slow} onClick=${() => setSlow(!slow)}>Ralenti</button>
      ${legend !== false ? html`<ul className="ts-leg">${kinds.map((k) => html`<li key=${k}><svg viewBox="0 0 24 6" aria-hidden="true"><line x1="1" y1="3" x2="23" y2="3" className=${"ts-p ts-" + k} style=${{ strokeWidth: 2, strokeDasharray: dash(k) ? dash(k).map((x) => x * 0.8).join(" ") : undefined }} /></svg>${TS_KIND[k]}</li>`)}</ul>` : null}
    </div>`}
  </div>`;
}

/* ---------- profil d'intensité (séances sans plan de terrain) ---------- */
function IntensityChart({ d, niveau, data, compact }) {
  const seq = useMemo(() => seqDrill(d, niveau, data), [d && d.id, niveau, data]);
  const [t, setT] = useState(0);
  const reduce = useMemo(() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }, []);
  const total = seq ? seq.slice(1).reduce((s, x) => s + x.secs, 0) : 0;
  useEffect(() => {
    if (!seq || compact || reduce) return undefined;
    let raf, last = performance.now();
    const tick = (now) => { const dt = (now - last) / 1000; last = now; setT((x) => (x + dt / 8) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [seq, compact, reduce]);
  if (!seq) return null;
  const Wd = 300, Hd = 100, base = 96;
  let x = 0;
  const z = d.z || 4;
  const bars = seq.slice(1).map((s, i) => { const w = (s.secs / total) * Wd; const h = ((s.kind === "work" ? z : 1) / 5) * 88; const r = { i, x, w, h, work: s.kind === "work" }; x += w; return r; });
  const x0 = t * Wd;
  const dz = drillDose(d, niveau);
  return html`<div className=${"ic" + (compact ? " compact" : "")}><svg viewBox=${"0 0 " + Wd + " " + Hd} className="ic-svg" preserveAspectRatio="none" role="img" aria-label=${"Profil de la séance : " + (dz.t || "") + ", " + minLabel(total)}>
    ${[1, 2, 3, 4, 5].map((k) => html`<line key=${k} x1=${0} x2=${Wd} y1=${base - (k / 5) * 88} y2=${base - (k / 5) * 88} className="ic-grid" vectorEffect="non-scaling-stroke" />`)}
    ${bars.map((b) => html`<rect key=${b.i} x=${b.x + 0.25} y=${base - b.h} width=${Math.max(0.5, b.w - 0.5)} height=${b.h} className=${b.work ? "ic-w" : "ic-r"} />`)}
    <line x1=${0} x2=${Wd} y1=${base} y2=${base} className="ic-axis" vectorEffect="non-scaling-stroke" />
    ${compact || reduce ? null : html`<line x1=${x0} x2=${x0} y1=${2} y2=${base} className="ic-cur" vectorEffect="non-scaling-stroke" />`}
  </svg>${compact ? null : html`<div className="ic-cap"><span>0</span><span><b className="ic-kw">Effort</b> ${dz.lab || ""} · <b className="ic-kr">Récupération</b></span><span>${minLabel(total)}</span></div>`}</div>`;
}
function DrillVisual({ d, niveau, data, compact, autoplay }) {
  if (d.sc) return html`<${TerrainSchema} sc=${d.sc} title=${d.n} compact=${compact} autoplay=${autoplay} />`;
  return html`<${IntensityChart} d=${d} niveau=${niveau} data=${data} compact=${compact} />`;
}

/* ---------- fiche d'une séance terrain ---------- */
function refList2(keys) { return html`<ol className="refs">${(keys || []).map((k) => SREFS[k] ? html`<li key=${k}>${SREFS[k]}</li>` : null)}</ol>`; }
function terrainBest(data, test) {
  const xs = Object.values((data && data.libres) || {}).filter((l) => l && l.res && l.res.t === test && num(l.res.v) !== null);
  if (!xs.length) return null;
  const low = !TESTS[test] || TESTS[test].b !== "high";
  return xs.reduce((m, l) => (!m || (low ? l.res.v < m.v : l.res.v > m.v) ? { v: l.res.v, d: l.d } : m), null);
}
function fmtRes(test, v) { if (v === null || v === undefined) return "—"; if (test === "bronco") return mmss(v); const t = TESTS[test]; return fmtN(v, 2) + " " + (t ? t.u : ""); }
function DrillSheet({ d, niveau, data, profile, onStart, onChrono, onResult, locked, coach }) {
  const x = drillDose(d, niveau);
  const pc = drillPace(d, niveau, data);
  const mins = drillMinutes(d, niveau, data);
  const sp = sportOf(profile);
  const posteNote = d.poste && profile && profile.poste ? d.poste[profile.poste] : null;
  const best = d.test ? terrainBest(data, d.test) : null;
  const canTimer = !!x.r && !x.m;
  const age = profile ? ageOf(profile) : null;
  const minor = !coach && ((age !== null && age < 18) || !!(profile && profile.parent));
  return html`<div className="stack">
    <p className="muted">${d.but}</p>
    <div className="chips"><${Pill} tone="gold">${d.type}</${Pill}><${Pill}>${d.mat}</${Pill}>${d.contact ? html`<${Pill} tone=${contactHard(d) ? "warn" : "muted"}>${CONTACT_N[d.contact] || d.contact}</${Pill}>` : null}${d.pub ? html`<${Pill}>${d.pub}</${Pill}>` : null}${mins ? html`<${Pill}>${minLabel(mins * 60)} + échauffement</${Pill}>` : null}</div>
    <${DrillVisual} d=${d} niveau=${niveau} data=${data} />
    <div className="alert gold"><div><b>${coach ? "Dose pour le profil " : "Pour ton profil "}${nivName(niveau)}</b><p>${x.t}${x.m === "chr" ? " · " + plural(x.n || 1, "essai") + " chronométré" + ((x.n || 1) > 1 ? "s" : "") : ""}</p>
      ${pc && pc.need ? html`<p className="small">${coach ? "Distances et allures calculées à partir de la VMA du client (test demi-Cooper)." : "Fais ton test de VMA (demi-Cooper) pour obtenir tes distances et tes allures exactes."}</p>` : null}
      ${pc && pc.m ? html`<p className="small">${coach ? "VMA du client" : "Avec ta VMA de"} ${fmtN(pc.vma, 1)} km/h, à ${pc.pct} % : place les plots à <b>${pc.m} m</b>.</p>` : null}
      ${pc && pc.perKm ? html`<p className="small">${coach ? "VMA du client" : "Avec ta VMA de"} ${fmtN(pc.vma, 1)} km/h, à ${pc.pct} % : allure de <b>${mmss(pc.perKm)} au km</b>${pc.secs ? ", soit " + mmss(pc.secs) + " par répétition" : ""}.</p>` : null}</div></div>
    ${posteNote ? html`<div className="alert okb"><div><b>${posteName(sp, profile.poste)}</b><p>${posteNote}</p></div></div>` : null}
    ${d.warn ? html`<div className="alert warn"><div><b>${minor && contactHard(d) ? "Seulement avec ton club" : "Sécurité"}</b><p>${minor && contactHard(d) ? "Tu as moins de 18 ans : fais cet exercice uniquement à l'entraînement de ton club, avec ton éducateur. Seul, garde la version sans contact (approche et placement, arrêt avant l'impact)." : d.warn}</p></div></div>` : null}
    ${d.obj ? html`<${Card} title="Objectifs"><ul className="small obj-l"><li><b>Physique :</b> ${d.obj.ph}</li><li><b>Technique :</b> ${d.obj.te}</li><li><b>Match :</b> ${d.obj.ma}</li></ul></${Card}>` : null}
    ${best ? html`<p className="small">${coach ? "Meilleur résultat" : "Ton meilleur résultat"} : <b>${fmtRes(d.test, best.v)}</b> (${fmtD(best.d)}).</p>` : null}
    ${d.org ? html`<${Card} title="Organisation"><p className="small">${d.org}</p></${Card}>` : null}
    <${Card} title=${d.skill ? "Consignes" : "Déroulé"}><ol className="steps-l">${d.steps.map((s, k) => html`<li key=${k}>${s}</li>`)}</ol></${Card}>
    <${Card} title=${d.skill ? "Points clés" : "Consignes"}><ul className="small">${d.cues.map((s, k) => html`<li key=${k}>${s}</li>`)}</ul></${Card}>
    ${d.var && d.var.length ? html`<${Card} title="Variantes et progression"><ul className="small">${d.var.map((s, k) => html`<li key=${k}>${s}</li>`)}</ul></${Card}>` : null}
    <${Card} title="Pourquoi ça marche"><p className="small">${d.science}</p>${refList2(d.refs)}</${Card}>
    <p className="muted small">Échauffe-toi 15 minutes avant (footing, gammes, 3 accélérations progressives). Arrête si une douleur dépasse 3 sur 10 ou en cas de malaise.${niveau === "reprise" ? " En profil Reprise, reste à 80-85 % de ton maximum." : ""}</p>
    ${onStart || onChrono || onResult ? html`<div className="actions sticky-go">
      ${canTimer && onStart ? html`<${Btn} block onClick=${onStart}>${locked ? "Accès réservé aux abonnés" : "Lancer le minuteur"}</${Btn}>` : null}
      ${x.m === "chr" && onChrono ? html`<${Btn} block onClick=${onChrono}>${locked ? "Accès réservé aux abonnés" : "Chronométrer"}</${Btn}>` : null}
      ${d.test && x.m !== "chr" && onChrono && canTimer ? html`<${Btn} kind="ghost" onClick=${onChrono}>Chronométrer un essai</${Btn}>` : null}
      ${x.m === "test" && onResult ? html`<${Btn} block onClick=${onResult}>${locked ? "Accès réservé aux abonnés" : "Noter mon résultat"}</${Btn}>` : null}</div>` : null}
  </div>`;
}

/* ---------- chronomètre (tests, Bronco) ---------- */
function Chrono({ d, tries, laps, onDone, onClose }) {
  const [run, setRun] = useState(false);
  const [t, setT] = useState(0);
  const [res, setRes] = useState([]);
  const [lp, setLp] = useState([]);
  const st = useRef({ start: 0, base: 0 });
  const speed = window.__TIMER_SPEED || 1;
  useEffect(() => {
    if (!run) return undefined;
    st.current.start = performance.now();
    const id = setInterval(() => setT(st.current.base + ((performance.now() - st.current.start) / 1000) * speed), 50);
    return () => clearInterval(id);
  }, [run]);
  const startStop = () => {
    if (run) { const v = Math.round(t * 100) / 100; st.current.base = 0; setRun(false); setRes([...res, v]); setT(v); try { beep(1200, 0.25); } catch (e) {} }
    else { st.current.base = 0; setT(0); setLp([]); setRun(true); try { beep(990, 0.2); } catch (e) {} }
  };
  const lap = () => { if (run) setLp([...lp, Math.round(t * 10) / 10]); };
  const low = !d.test || !TESTS[d.test] || TESTS[d.test].b !== "high";
  const best = res.length ? (low ? Math.min(...res) : Math.max(...res)) : null;
  const n = tries || 1;
  const shown = d.test === "bronco" || t >= 60 ? mmss(t).replace(" min ", ":").replace(" s", "") : fmtN(t, 2) + " s";
  return html`<div className="player timer">
    <header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Quitter">‹</button><div><div className="eyebrow">Chronomètre</div><h2>${d.n}</h2></div></header>
    <section className="tm-main work"><div className="tm-k">${run ? "En cours" : res.length ? "Essai " + res.length + " enregistré" : "Prêt"}</div>
      <div className="tm-clock" id="chr-clock">${shown}</div>
      ${laps ? html`<p className="tm-next">Tours : <b>${lp.length}</b> / ${laps}${lp.length ? " · dernier à " + mmss(lp[lp.length - 1]) : ""}</p>` : null}
      <div className="tm-anim"><${DrillVisual} d=${d} niveau="sportif" data=${{}} compact=${true} autoplay=${run} /></div></section>
    <div className="tm-ctl">${laps ? html`<${Btn} kind="ghost" small onClick=${lap} disabled=${!run}>Tour</${Btn}>` : html`<span></span>`}
      <${Btn} onClick=${startStop}>${run ? "Stop" : res.length ? "Nouvel essai" : "Départ"}</${Btn}><span></span></div>
    ${res.length ? html`<${Card} title="Mes essais"><ol className="small">${res.map((v, i) => html`<li key=${i}>${fmtRes(d.test, v)}${v === best ? " · meilleur" : ""}</li>`)}</ol>
      <div className="actions"><${Btn} block onClick=${() => onDone({ best, tries: res })} disabled=${run}>Enregistrer ${res.length >= n ? "" : "(" + res.length + "/" + n + ")"}</${Btn}></div></${Card}>` : html`<p className="muted small center">${n > 1 ? plural(n, "essai") + ", 2 min de récupération entre chaque. " : ""}Démarre au signal, arrête à l'arrivée.</p>`}
  </div>`;
}
/* résultat d'un test fait avec la bande-son officielle */
function ResultForm({ d, onDone, onClose }) {
  const [v, setV] = useState("");
  const t = TESTS[d.test] || { n: d.n, u: "" };
  return html`<div className="player"><header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Retour">‹</button><div><div className="eyebrow">Mon résultat</div><h2>${d.n}</h2></div></header>
    <${Card}><${Field} label=${t.n + " (" + t.u + ")"} hint=${t.help} id="tr-res"><input id="tr-res" inputMode="decimal" value=${v} onChange=${(e) => setV(e.target.value)} /></${Field}>
      <div className="actions"><${Btn} block disabled=${num(v) === null} onClick=${() => onDone({ best: num(v) })}>Continuer</${Btn}></div></${Card}></div>`;
}

/* ---------- écran Séances terrain ---------- */
function TerrainScreen({ data, plan, src, onClose, locked, onLocked, open0 }) {
  const profile = data.profile || {};
  const niveau = effNiveau(plan, profile);
  const mine = sportOf(profile);
  const [sid, setSid] = useState((open0 && DRB[open0] && !(mine && mine.drills.includes(open0)) ? (DRB[open0].sports || [])[0] : null) || (mine && mine.id) || "");
  const [type, setType] = useState("tout");
  const [sel, setSel] = useState(open0 && DRB[open0] ? DRB[open0] : null);
  const [play, setPlay] = useState(null);
  const [chrono, setChrono] = useState(null);
  const [result, setResult] = useState(null);
  const [fin, setFin] = useState(null);
  const sp = SPB[sid] || null;
  useEffect(() => { try { window.scrollTo(0, 0); } catch (e) {} }, [sel, play, fin, chrono, result]);
  const done = Object.values(data.libres || {}).filter((l) => l && l.kind === "terrain").sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const guard = (f) => () => { if (locked) { onLocked && onLocked(); return; } f(); };
  if (fin) return html`<div className="player"><${FreeFinish} ...${fin} src=${src} niveau=${niveau} onDone=${() => { setFin(null); setPlay(null); setChrono(null); setResult(null); setSel(null); }} /></div>`;
  if (play) return html`<${TimerPlayer} title=${play.d.n} seq=${play.seq} kind="terrain" onClose=${() => setPlay(null)} onFinish=${(r) => setFin({ title: play.d.n, kind: "terrain", sid: play.d.id, ...r })} />`;
  if (chrono) return html`<${Chrono} d=${chrono} tries=${drillDose(chrono, niveau).n || (chrono.test === "bronco" ? 1 : 3)} laps=${chrono.test === "bronco" ? (niveau === "reprise" ? 3 : 5) : 0} onClose=${() => setChrono(null)}
    onDone=${(r) => setFin({ title: chrono.n, kind: "terrain", sid: chrono.id, secs: Math.max(60, (r.best || 0) + 600), res: chrono.test ? { t: chrono.test, v: r.best, tries: r.tries } : undefined })} />`;
  if (result) return html`<${ResultForm} d=${result} onClose=${() => setResult(null)} onDone=${(r) => setFin({ title: result.n, kind: "terrain", sid: result.id, secs: 1200, res: { t: result.test, v: r.best } })} />`;
  if (sel) return html`<div className="player">
    <header className="p-top"><button type="button" className="back" onClick=${() => setSel(null)} aria-label="Retour">‹</button>
      <div><div className="eyebrow">Séance terrain${sp ? " · " + sp.n : ""}</div><h2>${sel.n}</h2></div></header>
    <${DrillSheet} d=${sel} niveau=${niveau} data=${data} profile=${profile} locked=${locked}
      onStart=${guard(() => setPlay({ d: sel, seq: seqDrill(sel, niveau, data) }))} onChrono=${guard(() => setChrono(sel))} onResult=${guard(() => setResult(sel))} /></div>`;
  const all = [...drillsFor(sp), ...skillsFor(sp)];
  const types = DTYPES.filter((t) => all.some((d) => d.type === t));
  const list = all.filter((d) => type === "tout" || d.type === type);
  const tests = [...new Set(all.filter((d) => d.test).map((d) => d.test))].map((t) => ({ t, b: terrainBest(data, t) })).filter((x) => x.b);
  return html`<div className="player">
    <header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Retour">‹</button>
      <div><div className="eyebrow">Séances terrain</div><h2>${sp ? sp.n : "Choisis un sport"}</h2></div></header>
    <${Field} label="Sport" id="tr-sport"><select id="tr-sport" value=${sid} onChange=${(e) => { setSid(e.target.value); setType("tout"); }}>
      <option value="">— Choisir —</option>${SPORTS.filter((s) => (s.drills || []).length || (s.skills || []).length).map((s) => html`<option key=${s.id} value=${s.id}>${s.n}${mine && mine.id === s.id ? " (mon sport)" : ""}</option>`)}</select></${Field}>
    ${sp ? html`<p className="muted small">${sp.focus} Séances adaptées à ton profil ${nivName(niveau)}${profile.poste && sp.id === (mine && mine.id) ? " et à ton poste (" + posteName(sp, profile.poste) + ")" : ""}.</p>
      ${types.length > 1 ? html`<div className="tabs-scroll"><${Seg} options=${[{ v: "tout", n: "Tout" }, ...types.map((t) => ({ v: t, n: t }))]} value=${type} onChange=${setType} /></div>` : null}
      <div className="xgrid">${list.map((d) => { const m = drillMinutes(d, niveau, data);
        return html`<button key=${d.id} type="button" className="xcard tcard" onClick=${() => setSel(d)}>
          <div className="xc-anim tc-vis"><${DrillVisual} d=${d} niveau=${niveau} data=${data} compact=${true} autoplay=${false} /></div>
          <div className="xc-t"><b>${d.n}</b><span className="muted small">${d.type}${m ? " · " + minLabel(m * 60) : ""}</span></div></button>`; })}</div>
      ${tests.length ? html`<${Card} title="Mes records terrain">${tests.map((x) => html`<div key=${x.t} className="kv"><span>${TESTS[x.t] ? TESTS[x.t].n : x.t}</span><b>${fmtRes(x.t, x.b.v)}</b></div>`)}</${Card}>` : null}`
      : html`<${Empty} title="Choisis ton sport" text="Les séances terrain sont construites pour chaque sport : rugby, football, handball, basket, tennis, bobsleigh, course…" />`}
    ${done.length ? html`<${Card} title="Mes dernières séances terrain">${done.slice(0, 6).map((l) => html`<div key=${l.id} className="hist"><div className="hist-h"><b>${l.n}</b><span className="muted small">${fmtD(l.d)}</span></div>
      <span className="muted small">${l.duree} min · effort ${l.rpe}/10${l.res ? " · " + fmtRes(l.res.t, l.res.v) : ""}</span></div>`)}</${Card}>` : null}
  </div>`;
}

/* ---------- carte « Séance terrain de la semaine » (écran Aujourd'hui) ---------- */
function TerrainWeek({ data, plan, w, wib, open }) {
  const x = terrainOfWeek(data, w, wib);
  if (!x) return null;
  const niveau = effNiveau(plan, data.profile);
  const m = drillMinutes(x.d, niveau, data);
  const who = x.adv ? (x.adv.by === "coach" ? "Conseillée par Antoine" : "Conseillée par le coach IA") : "Séance terrain de la semaine";
  return html`<section className="card tweek"><div className="tw-vis"><${DrillVisual} d=${x.d} niveau=${niveau} data=${data} compact=${true} autoplay=${false} /></div>
    <div className="tw-t"><div className="eyebrow">${who}</div><b>${x.d.n}</b><span className="muted small">${x.d.type}${m ? " · " + minLabel(m * 60) : ""} · ${drillDose(x.d, niveau).t}</span>
      ${x.adv && x.adv.text ? html`<p className="small">${x.adv.text}</p>` : null}
      <div className="btnrow"><${Btn} small onClick=${() => open(x.d.id)}>Voir la séance</${Btn}><${Btn} small kind="ghost" onClick=${() => open(true)}>Toutes les séances</${Btn}></div></div></section>`;
}

/* ---------- choix du sport et du poste ---------- */
function SportChips({ value, onPick }) {
  return html`<div className="spchips" role="radiogroup" aria-label="Sports">${SPORTS.map((s) => html`<button key=${s.id} type="button" role="radio" aria-checked=${value === s.id} className=${"spchip" + (value === s.id ? " on" : "")} onClick=${() => onPick(s)}>${s.n}</button>`)}</div>`;
}
function SportEditor({ data, src, onDone }) {
  const toast = useToast();
  const p = data.profile || {};
  const cur = sportOf(p);
  const [txt, setTxt] = useState(p.sport || "");
  const [id, setId] = useState(cur ? cur.id : "");
  const [poste, setPoste] = useState(p.poste || "");
  const [adapt, setAdapt] = useState(p.sportAdapt !== false);
  const [busy, setBusy] = useState(false);
  const sp = SPB[id];
  const save = async () => {
    setBusy(true);
    try { await src.setProfile({ ...p, sport: txt.trim() || (sp ? sp.n : ""), sportId: id || null, poste: sp && (sp.postes || []).some((q) => q[0] === poste) ? poste : "", sportAdapt: adapt }); toast("Sport enregistré.", "ok"); onDone && onDone(); }
    catch (e) { toast("Enregistrement impossible.", "bad"); } finally { setBusy(false); }
  };
  return html`<div className="form">
    <${Field} label="Mon sport" id="se-sport" hint=${sp ? "Reconnu : " + sp.n : txt.trim() ? "Sport non reconnu : choisis le plus proche ci-dessous." : null}><input id="se-sport" value=${txt} onChange=${(e) => { setTxt(e.target.value); const g = sportIdOf(e.target.value); setId(g || ""); }} placeholder="Rugby, football, tennis…" /></${Field}>
    <${SportChips} value=${id} onPick=${(s) => { setId(s.id); setTxt(s.n); setPoste(""); }} />
    ${sp && (sp.postes || []).length ? html`<${Field} label="Mon poste"><${Seg} id="se-poste" options=${[...sp.postes.map((q) => ({ v: q[0], n: q[1] })), { v: "", n: "Sans préciser" }]} value=${poste} onChange=${setPoste} /></${Field}>` : null}
    ${sp ? html`<${Field} label="Adapter mes séances à mon sport" hint="Exercices spécifiques en salle et séances terrain de ton sport à la place des séances génériques."><${Seg} id="se-adapt" options=${[{ v: true, n: "Oui" }, { v: false, n: "Non" }]} value=${adapt} onChange=${setAdapt} /></${Field}>` : null}
    <div className="actions"><${Btn} block onClick=${save} disabled=${busy}>Enregistrer</${Btn}></div></div>`;
}
/* résumé du sport sur le profil */
function SportCard({ data, src, plan }) {
  const [edit, setEdit] = useState(false);
  const p = data.profile || {};
  const sp = sportOf(p);
  const n = drillsFor(sp).length;
  return html`<${Card} title="Mon sport" action=${src ? html`<${Btn} small kind="ghost" onClick=${() => setEdit(true)}>${sp ? "Modifier" : "Choisir"}</${Btn}>` : null}>
    ${sp ? html`<dl className="dl"><dt>Sport</dt><dd>${sportLabel(p)}</dd><dt>Niveau</dt><dd>${nivName(effNiveau(plan, p))}</dd>
      <dt>Adaptation</dt><dd>${p.sportAdapt === false ? "désactivée" : "exercices spécifiques et " + plural(n, "séance terrain", "séances terrain")}</dd></dl>
      <p className="muted small">${sp.focus}</p>` : html`<p className="small">${p.sport ? "« " + p.sport + " » n'est pas encore reconnu : choisis le sport le plus proche pour recevoir tes séances terrain." : "Indique ton sport pour adapter tes séances et recevoir des séances terrain."}</p>`}
    <${Modal} open=${edit} title="Mon sport" onClose=${() => setEdit(false)}>${edit ? html`<${SportEditor} data=${data} src=${src} onDone=${() => setEdit(false)} />` : null}</${Modal}>
  </${Card}>`;
}

/* ---------- espace coach : sport et séances terrain d'un client ---------- */
function CoachTerrain({ data, src, plan, prog }) {
  const toast = useToast();
  const p = data.profile || {};
  const sp = sportOf(p);
  const niveau = effNiveau(plan, p);
  const ps = plan ? planState(plan, todayISO()) : null;
  const curW = ps ? (ps.phase === "en_cours" ? ps.week : ps.phase === "avant" ? 1 : plan.weeks) : 1;
  const [drill, setDrill] = useState(sp && sp.drills[0] ? sp.drills[0] : "");
  const [txt, setTxt] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const advs = activeAdj(data, "terrain").slice().reverse();
  const done = Object.values(data.libres || {}).filter((l) => l && l.kind === "terrain").sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const send = async () => {
    if (!DRB[drill]) return;
    setBusy(true);
    try { await src.saveAdjust(rid("co_"), { kind: "terrain", drill, text: txt.trim().slice(0, 240), fromW: curW, toW: curW + weeks - 1, at: nowISO(), by: "coach", seen: true, status: "active" }); setTxt(""); toast("Séance conseillée au client.", "ok"); }
    catch (e) { toast("Enregistrement impossible" + errWhy(e, true), "bad"); } finally { setBusy(false); }
  };
  const cancel = async (a) => { try { const { id, ...rest } = a; await src.saveAdjust(id, { ...rest, status: "annule", seen: true }); } catch (e) { toast("Annulation impossible" + errWhy(e, true), "bad"); } };
  const options = sp ? [...drillsFor(sp), ...skillsFor(sp)] : DRILLS;
  return html`<div className="stack">
    <${Card} title="Sport du client"><dl className="dl"><dt>Sport</dt><dd>${sp ? sportLabel(p) : (p.sport || "non renseigné") + (p.sport ? " (non reconnu)" : "")}</dd><dt>Profil</dt><dd>${nivName(niveau)}</dd>
      <dt>Adaptation</dt><dd>${!sp ? "aucune" : p.sportAdapt === false ? "désactivée par le client" : "active : exercices spécifiques en salle, séances terrain du sport"}</dd></dl>
      ${sp ? html`<p className="muted small">${sp.focus}</p>` : null}
      <details><summary>Modifier le sport ou le poste du client</summary><${SportEditor} data=${data} src=${src} /></details></${Card}>
    <${Card} title="Conseiller une séance terrain" sub="Elle s'affiche sur l'écran Aujourd'hui du client.">
      <${Field} label="Séance" id="ct-drill"><select id="ct-drill" value=${drill} onChange=${(e) => setDrill(e.target.value)}>${options.map((d) => html`<option key=${d.id} value=${d.id}>${d.n} · ${d.type}</option>`)}</select></${Field}>
      <${Field} label="Pendant"><${Seg} options=${[1, 2, 4].map((k) => ({ v: k, n: plural(k, "semaine") }))} value=${weeks} onChange=${setWeeks} /></${Field}>
      <${Field} label="Message (facultatif)" id="ct-msg"><textarea id="ct-msg" rows="2" value=${txt} onChange=${(e) => setTxt(e.target.value)} placeholder="Ex. : fais-la le mercredi, à la place de la séance C"></textarea></${Field}>
      <div className="btnrow"><${Btn} onClick=${send} disabled=${busy || !DRB[drill]}>Conseiller cette séance</${Btn}>${DRB[drill] ? html`<${Btn} kind="ghost" onClick=${() => setView(DRB[drill])}>Voir la fiche</${Btn}>` : null}</div>
      ${advs.length ? html`<ul className="small">${advs.map((a) => html`<li key=${a.id}>${WK}${a.fromW}${a.toW > a.fromW ? " → " + WK + a.toW : ""} · ${DRB[a.drill] ? DRB[a.drill].n : a.drill} · ${a.by === "coach" ? "toi" : "coach IA"}${a.text ? " · « " + a.text + " »" : ""} <button type="button" className="linkbtn" onClick=${() => cancel(a)}>Retirer</button></li>`)}</ul>` : null}</${Card}>
    <${Card} title="Séances terrain réalisées">${done.length ? done.slice(0, 12).map((l) => html`<div key=${l.id} className="hist"><div className="hist-h"><b>${l.n}</b><span className="muted small">${fmtD(l.d)}</span></div>
      <span className="muted small">${l.duree} min · effort ${l.rpe}/10${l.load ? " · " + fmtN(l.load, 0) + " UA" : ""}${l.res ? " · " + fmtRes(l.res.t, l.res.v) : ""}${l.comment ? " · « " + l.comment + " »" : ""}</span></div>`) : html`<p className="muted small">Aucune séance terrain enregistrée pour l'instant.</p>`}</${Card}>
    <${Modal} open=${!!view} wide title=${view ? view.n : ""} onClose=${() => setView(null)}>${view ? html`<${DrillSheet} d=${view} niveau=${niveau} data=${data} profile=${p} coach=${true} />` : null}</${Modal}>
  </div>`;
}
/* bibliothèque du coach : toutes les séances terrain */
function TerrainLibrary() {
  const [sid, setSid] = useState(SPORTS[0] ? SPORTS[0].id : "");
  const [niv, setNiv] = useState("sportif");
  const [view, setView] = useState(null);
  const sp = SPB[sid];
  return html`<div className="stack">
    <p className="muted small">${DRILLS.filter((d) => !d.skill).length} séances terrain et ${DRILLS.filter((d) => d.skill).length} fiches technique pour ${SPORTS.length} sports. Chaque client voit celles de son sport, adaptées à son profil ; tu peux en conseiller une depuis sa fiche (onglet Sport & terrain). Les fiches technique ne sont jamais proposées d'office dans la séance de la semaine.</p>
    <div className="row2"><${Field} label="Sport" id="tl-sport"><select id="tl-sport" value=${sid} onChange=${(e) => setSid(e.target.value)}>${SPORTS.map((s) => html`<option key=${s.id} value=${s.id}>${s.n}</option>`)}</select></${Field}>
      <${Field} label="Profil"><${Seg} options=${NIV.map((n) => ({ v: n.id, n: n.n }))} value=${niv} onChange=${setNiv} /></${Field}></div>
    ${sp ? html`<p className="small"><b>Qualités clés :</b> ${sp.focus}</p>${(sp.spec || []).length ? html`<p className="small"><b>Exercices spécifiques ajoutés en salle :</b> ${sp.spec.map((x) => (EXB[x[0]] ? EXB[x[0]].n : x[0])).join(", ")}.</p>` : null}
      ${Object.keys(sp.swap || {}).length ? html`<p className="small"><b>Remplacements dans les séances terrain :</b> ${Object.entries(sp.swap).map(([a, b]) => (EXB[a] ? EXB[a].n : a) + " → " + (EXB[b.e] ? EXB[b.e].n : b.e)).join(" ; ")}.</p>` : null}` : null}
    <div className="xgrid">${[...drillsFor(sp), ...skillsFor(sp)].map((d) => html`<button key=${d.id} type="button" className="xcard tcard" onClick=${() => setView(d)}><div className="xc-anim tc-vis"><${DrillVisual} d=${d} niveau=${niv} data=${{}} compact=${true} autoplay=${false} /></div>
      <div className="xc-t"><b>${d.n}</b><span className="muted small">${d.type} · ${drillDose(d, niv).t}</span></div></button>`)}</div>
    <${Modal} open=${!!view} wide title=${view ? view.n : ""} onClose=${() => setView(null)}>${view ? html`<${DrillSheet} d=${view} niveau=${niv} data=${{}} profile=${{}} coach=${true} />` : null}</${Modal}>
  </div>`;
}
/* texte de l'adaptation (écran Programme) */
function sportAdaptText(sp, p) {
  if (!sp) return "";
  const nm = (id) => (EXB[id] ? EXB[id].n : id);
  const spec = (sp.spec || []).map((x) => nm(x[0]));
  const ps = sp.poste_spec && p && p.poste && sp.poste_spec[p.poste];
  if (ps) spec.unshift(nm(ps[0]));
  const sw = Object.entries(sp.swap || {}).map(([a, b]) => "« " + nm(a) + " » devient « " + nm(b.e) + " »");
  return (spec.length ? "En salle, tes séances gagnent " + plural(spec.length, "exercice spécifique", "exercices spécifiques") + " : " + spec.join(", ") + ". " : "") +
    (sw.length ? "Sur le terrain : " + sw.join(", ") + ". " : "") + plural(drillsFor(sp).length, "séance terrain", "séances terrain") + " de ton sport t'attendent dans « Séances en plus ».";
}
