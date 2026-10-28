/* ===== Antoine Prépa Performance — noyau ===== */
const { useState, useEffect, useMemo, useRef, useCallback, Fragment } = React;
const _html = htm.bind(React.createElement);
/* plusieurs racines -> fragment (évite les avertissements de clés) */
const html = (s, ...v) => { const r = _html(s, ...v); return Array.isArray(r) ? React.createElement(Fragment, null, ...r) : r; };

const CONTENT = JSON.parse(document.getElementById("app-content").textContent);
const T = CONTENT.T, EXLIB = CONTENT.E, PROGS = CONTENT.P, TESTS = CONTENT.TESTS,
  CHECKIN = CONTENT.CHECKIN, SCREENING = CONTENT.SCREENING, OFFERS_ALL = CONTENT.OFFERS, OFFERS = OFFERS_ALL.filter((o) => !o.retired);
const EXB = Object.fromEntries(EXLIB.map((e) => [e.id, e]));
const PB = Object.fromEntries(PROGS.map((p) => [p.id, p]));
const CATS = [...new Set(EXLIB.map((e) => e.c))];
/* durées en vente (en semaines) : 1, 3, 6 et 12 mois ; « 2 mois » ne se vend plus (commandes passées avant le 28 octobre 2026) */
const DURS = [{ w: 4, n: "1 mois" }, { w: 12, n: "3 mois" }, { w: 26, n: "6 mois" }, { w: 52, n: "12 mois" }];
const DURS_OLD = [{ w: 8, n: "2 mois" }];
function monthsOfW(w) { return { 4: 1, 8: 2, 12: 3, 26: 6, 52: 12 }[Number(w)] || Math.max(1, Math.round(Number(w) / 4.33)); }
function isLongW(w) { return Number(w) >= 26; }
const COACH_NAME_DEFAULT = "Antoine";

/* ---------- dates (locales, format AAAA-MM-JJ) ---------- */
const pad = (n) => String(n).padStart(2, "0");
function isoOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function todayISO() { return isoOf(new Date()); }
function parseISO(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d); }
function diffDays(a, b) {
  const A = parseISO(a), B = parseISO(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
}
const MOIS = { fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."] }[typeof LANG === "string" ? LANG : "fr"];
const JOURS = { fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] }[typeof LANG === "string" ? LANG : "fr"];
function fmtD(s) { if (!s) return "—"; const d = parseISO(s.slice(0, 10)); return d.getDate() + " " + MOIS[d.getMonth()]; }
function fmtDY(s) { if (!s) return "—"; const d = parseISO(s.slice(0, 10)); return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); }
function nextMonday() { const d = new Date(); const k = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + k); return isoOf(d); }
function nowISO() { return new Date().toISOString(); }

/* ---------- divers ---------- */
function rid(prefix) { return (prefix || "") + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function num(v) { if (v === "" || v === null || v === undefined) return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; }
function fmtN(v, d) { if (v === null || v === undefined || !Number.isFinite(v)) return "—"; return v.toLocaleString(typeof LOCALE === "string" ? LOCALE : "fr-FR", { maximumFractionDigits: d ?? 1 }); }
function eur(v) { return fmtN(v, 0) + " €"; }
function b64enc(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
function b64dec(s) { return JSON.parse(decodeURIComponent(escape(atob(s.trim())))); }
/* nom de l'IA affiché aux clients : Claude dans l'application Claude, Gemma (exécutée par Cloudflare, gratuite) sur le site */
const AI_WHO = typeof window !== "undefined" && window.IS_SITE ? "Gemma, de Google, exécutée par Cloudflare" : "Claude, d'Anthropic";
function clone(o) { return JSON.parse(JSON.stringify(o ?? null)); }
function epley(kg, reps) { if (!kg || !reps || reps > 12) return null; return Math.round(kg * (1 + reps / 30) * 10) / 10; }
function plural(n, s, p) { return n + " " + (n > 1 ? (p || s + "s") : s); }

/* ---------- programmes ---------- */
function progOf(programId, lib) {
  if (!programId) return null;
  if (PB[programId]) return PB[programId];
  const d = lib && lib[programId];
  return d && d.kind === "program" ? d : null;
}
function planState(plan, today) {
  if (!plan || !plan.start || !plan.weeks) return null;
  const t = today || todayISO();
  const d = diffDays(plan.start, t);
  const weeks = plan.weeks;
  const end = addDays(plan.start, weeks * 7 - 1);
  if (d < 0) return { phase: "avant", week: 0, weeks, block: 1, wib: 1, daysToStart: -d, end, day: 0 };
  const week = Math.floor(d / 7) + 1;
  if (week > weeks) return { phase: "fini", week: weeks, weeks, block: Math.ceil(weeks / 4), wib: 4, end, day: 7 };
  return { phase: "en_cours", week, weeks, block: Math.ceil(week / 4), wib: ((week - 1) % 4) + 1, end, day: (d % 7) + 1 };
}
function blockOf(prog, w) { if (!prog) return null; const i = Math.min(Math.ceil(w / 4), prog.blocks.length) - 1; return prog.blocks[Math.max(0, i)]; }
function weekSessions(prog, plan, w, lib) {
  const b = blockOf(prog, w);
  if (!b) return [];
  const out = b.sessions.map((s) => ({ key: "w" + w + "-" + s.id, w, sid: s.id, s, extra: false }));
  (plan && plan.extra || []).filter((x) => Number(x.w) === w).forEach((x, i) => {
    const s = lib && lib[x.sid];
    if (s && s.kind === "session") out.push({ key: "w" + w + "-X" + x.sid, w, sid: "X" + x.sid, s: { ...s, id: "+" }, extra: true });
  });
  /* séance D optionnelle du profil Haut niveau */
  if (plan && plan.niveau === "elite" && !plan.medicalHold && typeof sessionD === "function" && PB[prog.id]) {
    const d = sessionD(prog, plan);
    if (d) out.push({ key: "w" + w + "-D", w, sid: "D", s: d, extra: false, opt: true });
  }
  return out;
}
function plannedCount(prog, plan, w, lib) { return weekSessions(prog, plan, w, lib).filter((x) => !x.opt).length; }
function doseOf(it, wib) {
  const i = clamp((wib || 1) - 1, 0, 3);
  if (it.w) return { text: it.w[i] || "", load: false, sets: 0 };
  const t = T[it.t] || T.C;
  const reps = it.r || t.reps[i];
  const parts = [t.sets[i] + " × " + reps];
  if (t.int[i]) parts.push(t.int[i]);
  if (t.rest) parts.push("récup " + t.rest);
  return { sets: t.sets[i], reps, int: t.int[i], rest: t.rest, load: !!t.load, text: parts.join(" · ") };
}
function exOf(id, equipment, prog, exo) {
  const custom = exo && exo[id] && exo[id].custom ? exo[id] : null;
  let base = custom || EXB[id] || { id, n: id, c: "Autre", eq: "", cues: [] };
  let subst = false;
  if (equipment === "maison" && prog && prog.maison && base.alt && EXB[base.alt]) { base = EXB[base.alt]; subst = true; }
  const ov = exo && exo[base.id];
  return { ...base, video: ov && ov.video || base.video || "", cnote: ov && ov.note || "", subst };
}
function testBetter(prog, tid) { return (prog && prog.better && prog.better[tid]) || (TESTS[tid] && TESTS[tid].b) || "high"; }
function testValue(tid, v, side) {
  if (v === null || v === undefined) return null;
  const t = TESTS[tid];
  if (!t) return null;
  if (t.type === "pair") {
    const g = num(v.g), d = num(v.d);
    if (g === null && d === null) return null;
    return { g, d };
  }
  if (t.type === "e1rm") return num(v.v ?? epley(num(v.kg), num(v.reps)));
  return num(v);
}
function lsi(pair, side) {
  if (!pair || pair.g === null || pair.d === null || !pair.g || !pair.d) return null;
  if (side === "gauche") return Math.round((pair.g / pair.d) * 100);
  if (side === "droite") return Math.round((pair.d / pair.g) * 100);
  return Math.round((Math.min(pair.g, pair.d) / Math.max(pair.g, pair.d)) * 100);
}
const RPE_LABELS = ["Repos", "Très très facile", "Facile", "Modéré", "Un peu dur", "Dur", "Dur +", "Très dur", "Très dur +", "Presque maximal", "Maximal"];

/* ---------- statistiques d'un client ---------- */
function computeStats(data, plan, prog, lib, today) {
  const ps = planState(plan, today);
  const logs = Object.values(data.logs || {}).filter(Boolean);
  const doneByWeek = {}, loadByWeek = {};
  logs.forEach((l) => {
    const w = Number(l.w) || 0;
    if (l.kind === "presentiel") { loadByWeek[w] = (loadByWeek[w] || 0) + (l.load || 0); return; }
    doneByWeek[w] = (doneByWeek[w] || 0) + 1;
    loadByWeek[w] = (loadByWeek[w] || 0) + (l.load || 0);
  });
  if (plan && plan.start) {
    [...Object.values(data.libres || {}), ...Object.values(data.activites || {})].filter(Boolean).forEach((x) => {
      const d = diffDays(plan.start, x.d || String(x.at || "").slice(0, 10));
      if (d < 0 || !Number.isFinite(d)) return;
      const w = Math.floor(d / 7) + 1;
      if (w > plan.weeks) return;
      loadByWeek[w] = (loadByWeek[w] || 0) + (Number(x.load) || 0);
    });
  }
  const plannedByWeek = {};
  if (prog && plan) for (let w = 1; w <= plan.weeks; w++) plannedByWeek[w] = plannedCount(prog, plan, w, lib);
  let adherence = null;
  if (ps && ps.week > 1) {
    let pl = 0, dn = 0;
    for (let w = 1; w < ps.week; w++) { pl += plannedByWeek[w] || 0; dn += Math.min(doneByWeek[w] || 0, plannedByWeek[w] || 0); }
    adherence = pl ? dn / pl : null;
  }
  const sorted = logs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const checkins = Object.values(data.checkins || {}).filter(Boolean).sort((a, b) => a.w - b.w);
  const weights = checkins.filter((c) => num(c.poids) !== null).map((c) => ({ x: WK + c.w, y: num(c.poids) }));
  const waists = checkins.filter((c) => num(c.taille) !== null).map((c) => ({ x: WK + c.w, y: num(c.taille) }));
  // 1RM estimés
  const lifts = {};
  logs.forEach((l) => (l.items || []).forEach((it) => {
    let best = null;
    (it.sets || []).forEach((s) => { const v = epley(num(s.kg), num(s.reps)); if (v && (!best || v > best)) best = v; });
    if (!best) return;
    lifts[it.e] = lifts[it.e] || {};
    const w = Number(l.w) || 0;
    lifts[it.e][w] = Math.max(lifts[it.e][w] || 0, best);
  }));
  const liftSeries = Object.entries(lifts).map(([e, byW]) => ({ e, points: Object.keys(byW).map(Number).sort((a, b) => a - b).map((w) => ({ x: WK + w, y: byW[w] })) }))
    .filter((s) => s.points.length >= 2).sort((a, b) => b.points.length - a.points.length).slice(0, 4);
  const thisWeek = ps && ps.phase === "en_cours" ? ps.week : null;
  return { ps, logs: sorted, doneByWeek, plannedByWeek, loadByWeek, adherence, checkins, weights, waists, liftSeries, thisWeek,
    doneThisWeek: thisWeek ? (doneByWeek[thisWeek] || 0) : 0, plannedThisWeek: thisWeek ? (plannedByWeek[thisWeek] || 0) : 0 };
}
/* dernier message du client, pour la boîte de réception du coach */
function msgSummary(data) {
  const last = Object.values(data.messages || {}).filter((m) => m && m.from === "client").sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  return last ? { msgAt: last.at, msgText: String(last.text || (last.img ? "Photo" : "")).slice(0, 140) } : {};
}
function summarize(data) {
  const logs = Object.values(data.logs || {}).filter(Boolean);
  const sorted = logs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const weeksDone = {};
  logs.forEach((l) => { if (l.kind !== "presentiel") weeksDone[l.w] = (weeksDone[l.w] || 0) + 1; });
  const ch = Object.values(data.checkins || {}).filter(Boolean).sort((a, b) => b.w - a.w);
  const last = sorted[0];
  const lastC = ch[0];
  const recentPain = Math.max(0, ...sorted.slice(0, 3).map((l) => Number(l.douleur) || 0), lastC ? Number(lastC.douleur) || 0 : 0);
  return {
    nLogs: logs.length, lastLogAt: last ? last.date : null, lastLogTitle: last ? last.title : null, weeksDone,
    lastPain: recentPain, lastCheckinW: lastC ? lastC.w : null, lastCheckinAt: lastC ? lastC.at : null,
    lastWeight: lastC && num(lastC.poids) !== null ? num(lastC.poids) : null,
    lastQuestion: lastC && lastC.question ? String(lastC.question).slice(0, 200) : "",
    aiPending: Object.values(data.ai || {}).filter((x) => x && !x.seen && x.status !== "annule").length,
    aiAlert: Object.values(data.ai || {}).some((x) => x && x.kind === "alerte" && !x.seen && x.status !== "annule" && x.urgence === "haute"),
    videoPending: Object.values(data.videos || {}).filter((v) => v && v.toCoach && !v.reply).length,
    ...msgSummary(data),
    updatedAt: nowISO(),
  };
}
