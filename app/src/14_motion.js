/* ===== Animations des mouvements : silhouette 2D (profil ou face), cinématique directe et inverse ===== */
/* Repère : x vers l'avant (profil) ou vers la droite (face), y vers le haut, sol en y = 0, unités ≈ mètres.
   Membres (angles) : depuis la verticale basse, positif vers l'avant (0 = pendant, 90 = horizontal devant, 180 = au-dessus, -90 = horizontal derrière).
   Tronc et tête : depuis la verticale haute, positif vers l'avant (0 = debout, 90 = penché à l'horizontale, -90 = couché sur le dos tête en arrière).
   Cibles : [x, y] dans le monde ; { tf: [avant, haut] } dans le repère du tronc depuis l'épaule ; { rel: "hip"|"sh"|"head"|"a1"|"a2"|"k1"|"k2", d: [dx, dy] }. */
const MOT_L = { th: 0.43, sh: 0.43, tr: 0.52, nk: 0.17, hr: 0.1, ua: 0.3, fa: 0.27, hipW: 0.1, shW: 0.19 };
const MOT_RAD = Math.PI / 180;
function mvDown(a) { return [Math.sin(a * MOT_RAD), -Math.cos(a * MOT_RAD)]; }
function mvUp(a) { return [Math.sin(a * MOT_RAD), Math.cos(a * MOT_RAD)]; }
function mvAdd(p, v, k) { return [p[0] + v[0] * (k ?? 1), p[1] + v[1] * (k ?? 1)]; }
function mvAngleDown(v) { return Math.atan2(v[0], -v[1]) / MOT_RAD; }
function mvIK(root, target, a, b, bend) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.hypot(dx, dy) || 1e-6;
  const dm = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, d));
  const ux = dx / d, uy = dy / d;
  const al = Math.acos(Math.max(-1, Math.min(1, (a * a + dm * dm - b * b) / (2 * a * dm)))) * (bend >= 0 ? 1 : -1);
  const c = Math.cos(al), s = Math.sin(al);
  return [root[0] + a * (ux * c - uy * s), root[1] + a * (ux * s + uy * c)];
}
function mvLerp(a, b, t) { return a + (b - a) * t; }
function mvEase(t, kind) { if (kind === "lin") return t; if (kind === "in") return t * t; if (kind === "out") return 1 - (1 - t) * (1 - t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
const MV_STAND = { hip: [0, 0.935], t: 0, hd: null, cb: 0, L1: [0.02, 0.08], L2: [-0.02, 0.08], A1: { ua: 4, fa: 8 }, A2: { ua: -4, fa: 4 }, F1: 0, F2: 0, kb1: 1, kb2: 1, eb1: -1, eb2: -1 };

function mvIsTarget(s) { return Array.isArray(s) || !!(s && (s.tf || s.rel)); }
function mvSolve(P, view) {
  const front = view === "front";
  const t = P.t || 0;
  const hip = P.hip;
  const up = mvUp(t), fw = [up[1], -up[0]];           // repère du tronc (fw : vers l'avant / la droite)
  const sh = mvAdd(hip, up, MOT_L.tr);
  const hd = P.hd === null || P.hd === undefined ? t * 0.85 : P.hd;
  const head = mvAdd(sh, mvUp(hd), MOT_L.nk);
  const latH = (side) => (front ? mvAdd(hip, fw, side * MOT_L.hipW) : hip);
  const latS = (side) => (front ? mvAdd(sh, fw, side * MOT_L.shW) : sh);
  const J = { hip, sh, head, hd, t, cb: P.cb || 0, legs: [], arms: [] };
  const pt = (spec, side) => {
    if (Array.isArray(spec)) return spec;
    if (spec.tf) { const b = front ? latS(side) : sh; return [b[0] + fw[0] * spec.tf[0] + up[0] * spec.tf[1], b[1] + fw[1] * spec.tf[0] + up[1] * spec.tf[1]]; }
    const base = { hip, sh, head, a1: J.legs[0] && J.legs[0].ank, a2: J.legs[1] && J.legs[1].ank, k1: J.legs[0] && J.legs[0].knee, k2: J.legs[1] && J.legs[1].knee }[spec.rel] || hip;
    return [base[0] + (spec.d ? spec.d[0] : 0), base[1] + (spec.d ? spec.d[1] : 0)];
  };
  const fkDir = (a, side) => (front ? [side * Math.sin(a * MOT_RAD), -Math.cos(a * MOT_RAD)] : mvDown(a));
  [1, 2].forEach((i) => {
    const side = i === 1 ? 1 : -1;
    const hj = latH(side);
    const spec = P["L" + i];
    let knee, ank;
    if (mvIsTarget(spec)) { ank = pt(spec, side); knee = mvIK(hj, ank, MOT_L.th, MOT_L.sh, front ? side * (P["kb" + i] ?? 1) : (P["kb" + i] ?? 1)); }
    else { knee = mvAdd(hj, fkDir(spec.th || 0, side), MOT_L.th); ank = mvAdd(knee, fkDir(spec.sh || 0, side), MOT_L.sh); }
    const F = P["F" + i] || 0;
    let toe, heel;
    if (front) { toe = [ank[0] + side * 0.07, ank[1] - 0.065]; heel = [ank[0] - side * 0.01, ank[1] - 0.075]; }
    else { const c = Math.cos(F * MOT_RAD), s = Math.sin(F * MOT_RAD); toe = [ank[0] + 0.16 * c - 0.075 * s, ank[1] - 0.16 * s - 0.075 * c]; heel = [ank[0] - 0.05 * c - 0.075 * s, ank[1] + 0.05 * s - 0.075 * c]; }
    J.legs.push({ hip: hj, knee, ank, toe, heel });
  });
  [1, 2].forEach((i) => {
    const side = i === 1 ? 1 : -1;
    const sj = latS(side);
    const a = P["A" + i] || {};
    let elb, wr;
    if (mvIsTarget(a)) { wr = pt(a, side); elb = mvIK(sj, wr, MOT_L.ua, MOT_L.fa, front ? side * (P["eb" + i] ?? -1) : (P["eb" + i] ?? -1)); }
    else {
      const off = a.rel ? -t : 0;
      const ua = (a.ua || 0) + off * (front ? 0 : 1), fa = (a.fa !== undefined ? a.fa : a.ua || 0) + off * (front ? 0 : 1);
      elb = mvAdd(sj, fkDir(ua, side), MOT_L.ua); wr = mvAdd(elb, fkDir(fa, side), MOT_L.fa);
    }
    J.arms.push({ sh: sj, elb, wr });
  });
  return J;
}
function mvToFK(P, view, i, kind) {
  const J = mvSolve(P, view);
  const front = view === "front", side = i === 1 ? 1 : -1;
  const ang = (v) => (front ? Math.atan2(side * v[0], -v[1]) / MOT_RAD : mvAngleDown(v));
  if (kind === "L") { const l = J.legs[i - 1]; return { th: ang([l.knee[0] - l.hip[0], l.knee[1] - l.hip[1]]), sh: ang([l.ank[0] - l.knee[0], l.ank[1] - l.knee[1]]) }; }
  const a = J.arms[i - 1]; return { ua: ang([a.elb[0] - a.sh[0], a.elb[1] - a.sh[1]]), fa: ang([a.wr[0] - a.elb[0], a.wr[1] - a.elb[1]]) };
}
function mvFK(P, spec, view, i, kind) {
  if (mvIsTarget(spec)) return mvToFK(P, view, i, kind);
  if (kind === "A" && spec && spec.rel && view !== "front") return { ua: (spec.ua || 0) - (P.t || 0), fa: (spec.fa !== undefined ? spec.fa : spec.ua || 0) - (P.t || 0) };
  return spec || {};
}
function mvMix(A, B, t, view) {
  const o = {};
  for (const key of Object.keys(B)) {
    const a = A[key], b = B[key];
    if (key === "hd") { const ha = a === null || a === undefined ? (A.t || 0) * 0.85 : a, hb = b === null || b === undefined ? (B.t || 0) * 0.85 : b; o.hd = mvLerp(ha, hb, t); continue; }
    if (typeof b === "number" && typeof a === "number") { o[key] = mvLerp(a, b, t); continue; }
    if (/^[LA][12]$/.test(key)) {
      const kind = key[0], i = Number(key[1]);
      if (Array.isArray(a) && Array.isArray(b)) { o[key] = [mvLerp(a[0], b[0], t), mvLerp(a[1], b[1], t)]; continue; }
      if (a && b && a.tf && b.tf) { o[key] = { tf: [mvLerp(a.tf[0], b.tf[0], t), mvLerp(a.tf[1], b.tf[1], t)] }; continue; }
      if (a && b && a.rel && b.rel && a.rel === b.rel && a.d && b.d) { o[key] = { rel: a.rel, d: [mvLerp(a.d[0], b.d[0], t), mvLerp(a.d[1], b.d[1], t)] }; continue; }
      const fa = mvFK(A, a, view, i, kind), fb = mvFK(B, b, view, i, kind);
      const ks = kind === "L" ? ["th", "sh"] : ["ua", "fa"];
      const mix = (x, y) => { let d = y - x; if (d > 180) d -= 360; if (d < -180) d += 360; return x + d * t; };
      o[key] = Object.fromEntries(ks.map((x) => [x, mix(fa[x] || 0, fb[x] || 0)]));
      continue;
    }
    if (Array.isArray(b) && Array.isArray(a)) { o[key] = [mvLerp(a[0], b[0], t), mvLerp(a[1], b[1], t)]; continue; }
    o[key] = t < 0.5 ? a : b;
  }
  return o;
}
function mvAt(M, time) {
  const keys = M.keysFull, total = M.total;
  let tt = ((time % total) + total) % total;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const prev = keys[(i - 1 + keys.length) % keys.length];
    if (tt <= k.d || i === keys.length - 1) {
      const u = k.d ? Math.min(1, tt / k.d) : 1;
      return { pose: mvMix(prev, k, mvEase(u, k.ease), M.view), lab: k.lab || "", i };
    }
    tt -= k.d;
  }
  return { pose: keys[0], lab: keys[0].lab || "", i: 0 };
}
function mvAttach(at, J) {
  if (Array.isArray(at)) return at;
  if (at && at.rel) { const b = mvAttach(at.rel, J); return b ? [b[0] + (at.d ? at.d[0] : 0), b[1] + (at.d ? at.d[1] : 0)] : null; }
  const u = [J.sh[0] - J.hip[0], J.sh[1] - J.hip[1]], n = Math.hypot(u[0], u[1]) || 1, uu = [u[0] / n, u[1] / n], ff = [uu[1], -uu[0]];
  switch (at) {
    case "h1": return J.arms[0].wr;
    case "h2": return J.arms[1].wr;
    case "hands": return [(J.arms[0].wr[0] + J.arms[1].wr[0]) / 2, (J.arms[0].wr[1] + J.arms[1].wr[1]) / 2];
    case "back": return [J.sh[0] - 0.07 * ff[0] + 0.03 * uu[0], J.sh[1] - 0.07 * ff[1] + 0.03 * uu[1]];
    case "front": return [J.sh[0] + 0.09 * ff[0] + 0.02 * uu[0], J.sh[1] + 0.09 * ff[1] + 0.02 * uu[1]];
    case "hip": return J.hip;
    case "lap": return [J.hip[0] + 0.12 * ff[0] + 0.05 * uu[0], J.hip[1] + 0.12 * ff[1] + 0.05 * uu[1]];
    case "sh": return J.sh;
    case "head": return J.head;
    case "a1": return J.legs[0].ank;
    case "a2": return J.legs[1].ank;
    case "k1": return J.legs[0].knee;
    case "k2": return J.legs[1].knee;
    case "t1": return J.legs[0].toe;
    default: return null;
  }
}
function mvPropBox(p, J) {
  if (["bench", "box", "step", "seat", "wall", "mat", "rail"].includes(p.k)) return [p.x, p.y || 0, p.x + p.w, (p.y || 0) + p.h];
  if (p.k === "poly") { const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if (p.k === "pullbar") return [p.x - 0.2, p.y - 0.02, p.x + 0.2, p.y + 0.02];
  if (p.k === "hurdle" || p.k === "cone") return [p.x - 0.12, 0, p.x + 0.12, p.h || 0.25];
  if (p.k === "wheel") return [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r];
  if (p.k === "band" || p.k === "bar") { const a = mvAttach(p.from, J), b = mvAttach(p.to || p.at, J); return a && b ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] : null; }
  const c = mvAttach(p.at, J);
  if (!c) return null;
  const r = p.r || (p.k === "plate" ? 0.225 : p.k === "kb" ? 0.21 : 0.1);
  return [c[0] - r + (p.dx || 0), c[1] - r + (p.dy || 0), c[0] + r + (p.dx || 0), c[1] + r + (p.dy || 0)];
}
function mvPrep(M) {
  if (!M || M._ready) return M;
  const keysFull = M.keys.map((k) => ({ ...MV_STAND, ...(M.base || {}), ...k }));
  const total = keysFull.reduce((s, k) => s + (k.d || 0), 0) || 1;
  const M2 = { ...M, keysFull, total, _ready: true };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const grow = (p, r) => { if (!p) return; x0 = Math.min(x0, p[0] - (r || 0)); x1 = Math.max(x1, p[0] + (r || 0)); y0 = Math.min(y0, p[1] - (r || 0)); y1 = Math.max(y1, p[1] + (r || 0)); };
  for (let s = 0; s <= 48; s++) {
    const { pose } = mvAt(M2, (total * s) / 48);
    const J = mvSolve(pose, M.view);
    grow(mvHeadC(J), MOT_L.hr + 0.02); grow(J.sh, 0.05); grow(J.hip, 0.06);
    J.legs.forEach((l) => { grow(l.knee, 0.04); grow(l.ank); grow(l.toe, 0.02); grow(l.heel, 0.02); });
    J.arms.forEach((a) => { grow(a.elb, 0.03); grow(a.wr, 0.04); });
    (M.props || []).forEach((p) => { const b = mvPropBox(p, J); if (b) { grow([b[0], b[1]]); grow([b[2], b[3]]); } });
  }
  if (M.ground !== false) y0 = Math.min(y0, -0.02);
  const w = x1 - x0, h = y1 - y0, pad = 0.1 + 0.04 * Math.max(w, h);
  /* cadre au format 4:3 minimum pour des vignettes régulières */
  let bx0 = x0 - pad, bx1 = x1 + pad, by0 = y0 - pad * 0.4, by1 = y1 + pad;
  const W = bx1 - bx0, H = by1 - by0;
  if (W / H < 1.1) { const add = (1.1 * H - W) / 2; bx0 -= add; bx1 += add; }
  else if (W / H > 1.9) { const add = (W / 1.9 - H); by1 += add; }
  M2.box = [bx0, by0, bx1, by1];
  return M2;
}
function mvHeadC(J) { const v = [J.head[0] - J.sh[0], J.head[1] - J.sh[1]], n = Math.hypot(v[0], v[1]) || 1; return [J.head[0] + (v[0] / n) * 0.075, J.head[1] + (v[1] / n) * 0.075]; }

/* ---------- dessin ---------- */
function mvLine(a, b, cls, w) { return html`<line x1=${a[0]} y1=${-a[1]} x2=${b[0]} y2=${-b[1]} className=${cls} style=${{ strokeWidth: w }} />`; }
function mvTrunkPath(J) {
  const a = J.hip, b = J.sh, cb = J.cb || 0;
  if (!cb) return "M" + a[0] + " " + -a[1] + " L" + b[0] + " " + -b[1];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], u = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(u[0], u[1]) || 1;
  const nb = [-u[1] / n, u[0] / n]; // normale côté dos (gauche du sens hanche→épaule)
  const c = [m[0] + nb[0] * cb * 2, m[1] + nb[1] * cb * 2];
  return "M" + a[0] + " " + -a[1] + " Q" + c[0] + " " + -c[1] + " " + b[0] + " " + -b[1];
}
function MoveFigure({ M, time, trail }) {
  const { pose } = mvAt(M, time);
  const J = mvSolve(pose, M.view);
  const front = M.view === "front";
  const props = M.props || [];
  const drawProp = (p, k) => {
    if (["bench", "box", "step", "seat", "wall"].includes(p.k)) return html`<rect key=${k} x=${p.x} y=${-((p.y || 0) + p.h)} width=${p.w} height=${p.h} rx=${0.015} className="mv-prop" />`;
    if (p.k === "rail") return html`<rect key=${k} x=${p.x} y=${-((p.y || 0) + p.h)} width=${p.w} height=${p.h} rx=${0.01} className="mv-eqf" />`;
    if (p.k === "mat") return html`<rect key=${k} x=${p.x} y=${-p.h} width=${p.w} height=${p.h} rx=${0.01} className="mv-mat" />`;
    if (p.k === "poly") return html`<path key=${k} d=${"M" + p.pts.map((q) => q[0] + " " + -q[1]).join(" L") + "Z"} className="mv-prop" />`;
    if (p.k === "pullbar") return html`<line key=${k} x1=${p.x - 0.2} y1=${-p.y} x2=${p.x + 0.2} y2=${-p.y} className="mv-eq" style=${{ strokeWidth: 0.04 }} />`;
    if (p.k === "hurdle") return html`<path key=${k} d=${"M" + (p.x - 0.1) + " 0 L" + (p.x - 0.1) + " " + -(p.h || 0.25) + " L" + (p.x + 0.1) + " " + -(p.h || 0.25) + " L" + (p.x + 0.1) + " 0"} className="mv-eq" style=${{ strokeWidth: 0.025, fill: "none" }} />`;
    if (p.k === "cone") return html`<path key=${k} d=${"M" + (p.x - 0.09) + " 0 L" + p.x + " " + -(p.h || 0.25) + " L" + (p.x + 0.09) + " 0Z"} className="mv-eqf" />`;
    if (p.k === "wheel") return html`<circle key=${k} cx=${p.x} cy=${-p.y} r=${p.r} className="mv-wheel" />`;
    if (p.k === "band" || p.k === "bar") { const a = mvAttach(p.from, J), b = mvAttach(p.to || p.at, J); return a && b ? html`<line key=${k} x1=${a[0]} y1=${-a[1]} x2=${b[0]} y2=${-b[1]} className=${p.k === "bar" ? "mv-eq" : "mv-band"} style=${p.k === "bar" ? { strokeWidth: 0.035 } : null} />` : null; }
    const c0 = mvAttach(p.at, J);
    if (!c0) return null;
    const c = [c0[0] + (p.dx || 0), c0[1] + (p.dy || 0)];
    if (p.k === "plate") return html`<g key=${k}><circle cx=${c[0]} cy=${-c[1]} r=${p.r || 0.225} className="mv-plate" /><circle cx=${c[0]} cy=${-c[1]} r=${0.028} className="mv-eqf" /></g>`;
    if (p.k === "db") return html`<g key=${k}><rect x=${c[0] - 0.1} y=${-c[1] - 0.04} width=${0.2} height=${0.08} rx=${0.03} className="mv-eqf" /></g>`;
    if (p.k === "kb") return html`<g key=${k}><circle cx=${c[0]} cy=${-(c[1] - 0.12)} r=${0.085} className="mv-eqf" /><path d=${"M" + (c[0] - 0.045) + " " + -(c[1] - 0.06) + " Q" + c[0] + " " + -(c[1] + 0.05) + " " + (c[0] + 0.045) + " " + -(c[1] - 0.06)} className="mv-eq" style=${{ strokeWidth: 0.022, fill: "none" }} /></g>`;
    if (p.k === "ball" || p.k === "roller") return html`<circle key=${k} cx=${c[0]} cy=${-c[1]} r=${p.r || (p.k === "ball" ? 0.12 : 0.075)} className="mv-eqf" />`;
    return null;
  };
  const leg = (l, cls) => html`<g className=${cls}>${mvLine(l.hip, l.knee, "mv-limb", 0.085)}${mvLine(l.knee, l.ank, "mv-limb", 0.07)}${mvLine(l.heel, l.toe, "mv-limb", 0.05)}${mvLine(l.ank, [(l.heel[0] + l.toe[0]) / 2, (l.heel[1] + l.toe[1]) / 2], "mv-limb", 0.055)}</g>`;
  const arm = (a, cls) => html`<g className=${cls}>${mvLine(a.sh, a.elb, "mv-limb", 0.065)}${mvLine(a.elb, a.wr, "mv-limb", 0.055)}<circle cx=${a.wr[0]} cy=${-a.wr[1]} r=${0.034} className="mv-hand" /></g>`;
  const hc = mvHeadC(J);
  const torso = front
    ? html`<path d=${"M" + J.legs[0].hip[0] + " " + -J.legs[0].hip[1] + " L" + J.arms[0].sh[0] + " " + -J.arms[0].sh[1] + " L" + J.arms[1].sh[0] + " " + -J.arms[1].sh[1] + " L" + J.legs[1].hip[0] + " " + -J.legs[1].hip[1] + "Z"} className="mv-torso" />`
    : html`<path d=${mvTrunkPath(J)} className="mv-limb mv-trunk" style=${{ strokeWidth: 0.13, fill: "none" }} />`;
  const [x0, y0, x1, y1] = M.box;
  return html`<svg viewBox=${x0 + " " + -y1 + " " + (x1 - x0) + " " + (y1 - y0)} className="mv-svg" role="img" aria-label=${M.n || "Animation du mouvement"}>
    ${M.ground !== false ? html`<line x1=${x0} y1=${0} x2=${x1} y2=${0} className="mv-ground" />` : null}
    ${props.filter((p) => !p.front).map(drawProp)}
    ${trail ? html`<path d=${trail} className="mv-trail" />` : null}
    ${front ? null : html`${leg(J.legs[1], "mv-far")}${arm(J.arms[1], "mv-far")}`}
    ${front ? html`${leg(J.legs[1], "mv-near")}${arm(J.arms[1], "mv-near")}` : null}
    ${torso}
    ${mvLine(J.sh, J.head, "mv-limb", 0.06)}
    <circle cx=${hc[0]} cy=${-hc[1]} r=${MOT_L.hr} className="mv-head" />
    ${leg(J.legs[0], "mv-near")}
    ${arm(J.arms[0], "mv-near")}
    ${props.filter((p) => p.front).map(drawProp)}
  </svg>`;
}
function mvTrail(M, at) {
  const pts = [];
  for (let s = 0; s <= 60; s++) { const { pose } = mvAt(M, (M.total * s) / 60); const c = mvAttach(at, mvSolve(pose, M.view)); if (c) pts.push(c); }
  return pts.length ? "M" + pts.map((p) => p[0].toFixed(3) + " " + (-p[1]).toFixed(3)).join(" L") : "";
}
function MoveAnim({ id, ex, size, autoplay, compact, showLab, onReady }) {
  const M0 = useMemo(() => motionFor(id, ex), [id, ex && ex.id]);
  const reduce = useMemo(() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }, []);
  const [play, setPlay] = useState(autoplay !== false && !reduce);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [vis, setVis] = useState(true);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((es) => setVis(es.some((e) => e.isIntersecting)), { threshold: 0.05 });
    io.observe(ref.current); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!M0 || !play || !vis) return undefined;
    let raf, last = performance.now();
    const tick = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; setTime((x) => x + dt * speed); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [M0, play, vis, speed]);
  const trail = useMemo(() => (M0 && M0.trail ? mvTrail(M0, M0.trail) : null), [M0]);
  if (!M0) return null;
  const { lab } = mvAt(M0, time);
  const stepKey = () => { const ks = M0.keysFull; let acc = 0; const cur = ((time % M0.total) + M0.total) % M0.total; for (let k = 0; k < ks.length; k++) { acc += ks[k].d; if (acc > cur + 1e-3) { setTime(acc); return; } } setTime(0); };
  return html`<div className=${"mv" + (compact ? " compact" : "")} ref=${ref} style=${size ? { maxWidth: size } : null}>
    <div className="mv-stage"><${MoveFigure} M=${M0} time=${time} trail=${trail} />
      ${showLab !== false && lab && !compact ? html`<span className="mv-lab">${lab}</span>` : null}</div>
    ${compact ? null : html`<div className="mv-ctl">
      <button type="button" className="mv-b" onClick=${() => setPlay(!play)} aria-label=${play ? "Mettre en pause" : "Lancer l'animation"}>${play ? "Pause" : "Lecture"}</button>
      <button type="button" className="mv-b" onClick=${() => { setPlay(false); stepKey(); }} aria-label="Position suivante">Position suivante</button>
      <button type="button" className=${"mv-b" + (speed < 1 ? " on" : "")} aria-pressed=${speed < 1} onClick=${() => setSpeed(speed < 1 ? 1 : 0.5)}>Ralenti</button></div>`}
    ${!compact && M0.note ? html`<p className="mv-note">${M0.note}</p>` : null}
  </div>`;
}
