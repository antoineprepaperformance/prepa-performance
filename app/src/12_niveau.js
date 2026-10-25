/* ===== Profils de niveau : recommandation, cohérence, dose détaillée ===== */
const NIV = CONTENT.NIV || [];
const NIVB = Object.fromEntries(NIV.map((n) => [n.id, n]));
const NIVQ = CONTENT.NIVQ || {};
const NIV_ORDER = ["reprise", "sportif", "perf", "elite"];
const nivRank = (id) => Math.max(0, NIV_ORDER.indexOf(id));
const nivName = (id) => (NIVB[id] || NIVB.sportif || { n: "Sportif" }).n;
function normTxt2(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

/* ---------- sport ---------- */
const SPORT_ORDER = ["lancer", "collectif", "course", "sprint", "force", "combat", "glisse", "velo"];
function sportCat(sport) {
  const s = " " + normTxt2(sport) + " ";
  if (!s.trim()) return "aucun";
  if (/\b(aucun|rien|non|pas de sport)\b/.test(s)) return "aucun";
  const sid = typeof sportIdOf === "function" ? sportIdOf(sport) : null;
  if (sid && SPB[sid] && SPB[sid].fam) return SPB[sid].fam;
  const K = CONTENT.SPORTKEYS || {};
  for (const c of SPORT_ORDER) if ((K[c] || []).some((k) => s.includes(k))) return c;
  return "autre";
}
const SPORT_LABEL = { lancer: "sport de lancer ou de raquette", collectif: "sport collectif", course: "course à pied", sprint: "sport de vitesse", force: "sport de force", combat: "sport de combat", glisse: "sport de glisse", velo: "cyclisme", autre: "ton sport", aucun: "sans sport particulier" };
/* programmes conseillés selon le sport (du plus au moins adapté) */
const PROG_FOR_SPORT = {
  collectif: ["prepa", "vitesse", "force", "masse"], lancer: ["prepa", "force", "vitesse", "masse"], course: ["run", "forme", "perte"],
  sprint: ["vitesse", "force", "prepa"], force: ["force", "masse"], combat: ["prepa", "force", "vitesse"], glisse: ["prepa", "force", "vitesse"],
  velo: ["force", "forme", "perte"], autre: ["prepa", "forme", "force"], aucun: ["forme", "perte", "masse"],
};

function ageOf(p) { const y = num(p && p.birthYear); return y ? new Date().getFullYear() - y : null; }

/* ---------- profil recommandé ---------- */
function recommendNiveau(ans, age, screeningFlag) {
  const c = Number(ans && ans.compet), x = Number(ans && ans.xp);
  const why = [];
  let id = "sportif";
  if (!Number.isFinite(c) || !Number.isFinite(x)) return { id, why: ["Réponds aux questions pour un profil sur mesure."] };
  if (x === 0 || (c === 0 && x <= 1)) { id = "reprise"; why.push(x === 0 ? "Peu ou pas d'expérience en musculation : on construit d'abord la technique." : "Pas de compétition et moins de 6 mois de musculation."); }
  else if (c >= 4 && x >= 3) { id = "elite"; why.push("Niveau élite et plus de 2 ans de musculation."); }
  else if (c >= 4) { id = "perf"; why.push("Niveau élite, mais expérience en musculation plus récente : profil Performance pour sécuriser la technique."); }
  else if (c >= 2 && x >= 2) { id = "perf"; why.push("Compétition régionale ou nationale et au moins 6 mois de musculation."); }
  else if (c >= 2) { id = "sportif"; why.push("Bon niveau sportif, mais moins de 6 mois de musculation : profil Sportif pour commencer."); }
  else { id = "sportif"; why.push("Pratique régulière, loisir ou départementale."); }
  if (age !== null && age < 16 && nivRank(id) > nivRank("sportif")) { id = "sportif"; why.push("Moins de 16 ans : pas de charges maximales, profil Sportif."); }
  else if (age !== null && age < 18 && id === "elite") { id = "perf"; why.push("Moins de 18 ans : profil Performance au plus."); }
  if (screeningFlag) why.push("Questionnaire santé : tes séances restent en mode Reprise jusqu'à l'avis de ton médecin.");
  return { id, why };
}
/* profil réellement appliqué aux séances */
function effNiveau(plan, profile) {
  const n = (plan && plan.niveau) || (profile && profile.request && profile.request.niveau) || "sportif";
  if (plan && plan.medicalHold) return "reprise";
  return NIVB[n] ? n : "sportif";
}

/* ---------- cohérence objectif / profil / sport ---------- */
function assessPlan({ programId, niveau, ans, sport, age, equipment, screeningFlag, prereqOk, weeks, compDate, start }) {
  const out = [];
  const prog = PB[programId];
  if (!prog) return out;
  const cat = sportCat(sport);
  const rec = PROG_FOR_SPORT[cat] || [];
  const r = nivRank(niveau);
  const push = (t, n) => out.push({ t, n });
  if (rec[0] === programId) push("ok", "Programme le plus adapté à un " + SPORT_LABEL[cat] + ".");
  else if (rec.includes(programId)) push("ok", "Programme adapté à un " + SPORT_LABEL[cat] + ".");
  else if (cat !== "aucun" && cat !== "autre" && rec.length) push("info", "Pour un " + SPORT_LABEL[cat] + ", « " + PB[rec[0]].n + " » est souvent plus spécifique. Ton choix reste possible.");
  if (programId === "forme" && r >= nivRank("perf")) push("warn", "« Remise en forme » est peu exigeant pour ton niveau : « " + PB[rec[0] && rec[0] !== "forme" ? rec[0] : "prepa"].n + " » te fera davantage progresser.");
  if ((programId === "force" || programId === "vitesse") && niveau === "reprise") push("warn", "Programme technique et intense : en profil Reprise, les charges et les sprints sont allégés. La formule Hybride permet d'apprendre les mouvements avec Antoine.");
  if (programId === "force" && Number(ans && ans.xp) <= 1) push("warn", "Les mouvements d'haltérophilie demandent un apprentissage : commence léger, filme-toi et envoie la vidéo à ton coach.");
  if (programId === "masse" && cat === "course") push("info", "La prise de muscle peut alourdir ta foulée : idéale hors saison de course.");
  if (programId === "retour" && !prereqOk) push("bad", "Les critères de reprise de la course ne sont pas tous remplis : poursuis ta rééducation avec ton kiné avant ce programme.");
  if (programId === "retour" && prereqOk) push("ok", "Critères de reprise remplis : reprise progressive guidée par la douleur (3/10 au plus).");
  if (equipment === "maison" && prog && !prog.maison) push("bad", "Ce programme demande une salle : choisis « En salle » ou un programme avec version maison.");
  const f = Number(ans && ans.freq);
  if (f === 2) push("warn", "3 séances prévues par semaine : avec 2 séances, fais A et C en priorité.");
  if (f >= 4 && niveau === "elite" && CONTENT.SESDFOR && CONTENT.SESDFOR[programId]) push("ok", "Séance D optionnelle ajoutée (vitesse et robustesse).");
  if (age !== null && age < 18) push("info", "Moins de 18 ans : pas de test de charge maximale, charges guidées par les répétitions en réserve.");
  if (screeningFlag) push("warn", "Questionnaire santé : demande l'avis de ton médecin. En attendant, séances en mode Reprise.");
  if (compDate && start && weeks) {
    const end = addDays(start, weeks * 7 - 1);
    if (compDate >= start && compDate <= end) push("ok", "Compétition le " + fmtD(compDate) + " : affûtage prévu les 2 semaines avant (volume réduit, intensité gardée).");
  }
  if (r >= nivRank("perf")) push("ok", "Profil " + nivName(niveau) + " : charges en % de ton maximum, tempo, récupération et prévention détaillés.");
  return out;
}

/* ---------- maximum estimé d'un exercice ---------- */
const TEST_FOR_EX = { squat_barre: "e1rm_squat", sdt: "e1rm_sdt", dc_barre: "e1rm_dc", epaule_suspension: "e1rm_epaule" };
function e1rmFor(e, data) {
  let best = null;
  const logs = Object.values((data && data.logs) || {}).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 24);
  for (const l of logs) {
    const it = (l.items || []).find((x) => x.e === e && x.sets);
    if (!it) continue;
    /* séries arrêtées vers 2 répétitions en réserve : on les ajoute pour estimer le maximum (Epley) */
    for (const s of it.sets) { const r = num(s.reps); const v = r ? epley(num(s.kg), Math.min(12, r + 2)) : null; if (v && (!best || v > best.v)) best = { v, date: l.date, src: "séance" }; }
    if (best) break;
  }
  const tid = TEST_FOR_EX[e];
  if (tid && data && data.tests) {
    const pts = Object.values(data.tests).filter((t) => t && t.values && t.values[tid]).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    if (pts[0]) { const v = testValue(tid, pts[0].values[tid]); if (v && (!best || String(pts[0].at).slice(0, 10) >= String(best.date))) best = { v, date: String(pts[0].at).slice(0, 10), src: "test" }; }
  }
  /* sans séance ni test : le record déclaré à l'inscription (18 ans et plus) */
  if (!best && data && typeof recE1rm === "function") best = recE1rm(data.profile, e);
  return best;
}
function vmaOf(data) {
  const pts = Object.values((data && data.tests) || {}).filter((t) => t && t.values && num(t.values.vma)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (pts[0]) return num(pts[0].values.vma) / 100;
  const r = typeof recForTest === "function" ? recForTest(data && data.profile, "vma") : null;
  return r ? r / 100 : null;
}
function t5kOf(data) {
  const pts = Object.values((data && data.tests) || {}).filter((t) => t && t.values && num(t.values.t5km)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (pts[0]) return num(pts[0].values.t5km);
  return typeof recForTest === "function" ? recForTest(data && data.profile, "t5km") : null;
}
function cmjBase(data) {
  const pts = Object.values((data && data.tests) || {}).filter((t) => t && t.values && num(t.values.cmj)).map((t) => num(t.values.cmj));
  const r = typeof recForTest === "function" ? recForTest(data && data.profile, "cmj") : null;
  if (r) pts.push(r);
  return pts.length ? Math.max(...pts) : null;
}

/* ---------- conversions ---------- */
const RTF_PCT = { 1: 100, 2: 95, 3: 93, 4: 90, 5: 87, 6: 85, 7: 83, 8: 80, 9: 77, 10: 75, 11: 73, 12: 71, 13: 69, 14: 67, 15: 65, 16: 63, 17: 61, 18: 60, 19: 59, 20: 58 };
const pctRtf = (n) => RTF_PCT[clamp(Math.round(n), 1, 20)];
function rangeOf(s) { const m = String(s || "").match(/(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?/); if (!m) return null; const a = num(m[1]), b = m[2] ? num(m[2]) : a; return [Math.min(a, b), Math.max(a, b)]; }
function rirOf(int) { const m = String(int || "").match(/RIR\s*(\d+)(?:\s*-\s*(\d+))?/); if (!m) return null; return [Number(m[1]), Number(m[2] || m[1])]; }
function fmtRir(r) { return "RIR " + (r[0] === r[1] ? r[0] : r[0] + "-" + r[1]); }
function pctTxt(p) { return p[0] === p[1] ? p[0] + " %" : p[0] + " à " + p[1] + " %"; }
function roundLoad(kg) { const st = kg >= 20 ? 2.5 : 1; return Math.round(kg / st) * st; }
function paceTxt(kmh) { if (!kmh) return ""; const s = Math.round(3600 / kmh); return Math.floor(s / 60) + "'" + String(s % 60).padStart(2, "0") + "\" /km"; }
function timeTxt(sec) { sec = Math.round(sec); return sec >= 60 ? Math.floor(sec / 60) + " min " + String(sec % 60).padStart(2, "0") + " s" : sec + " s"; }

/* ---------- contrôle de forme (Performance, Haut niveau) ---------- */
const READY_ITEMS = [["sommeil", "Sommeil de la nuit", "Très mauvais", "Excellent"], ["fatigue", "Énergie", "Épuisé", "En pleine forme"], ["courbatures", "Courbatures", "Très fortes", "Aucune"], ["stress", "Stress", "Très stressé", "Détendu"], ["moral", "Envie de t'entraîner", "Aucune", "Très forte"]];
function readinessOf(r, data) {
  if (!r) return null;
  const vals = READY_ITEMS.map(([k]) => num(r[k])).filter((x) => x !== null);
  if (vals.length < READY_ITEMS.length) return null;
  const score = vals.reduce((s, v) => s + v, 0) / vals.length;
  const base = cmjBase(data);
  const cmj = num(r.cmj);
  const ratio = base && cmj ? cmj / base : null;
  let lvl = "ok";
  if (score < 2.5 || (ratio !== null && ratio < 0.9)) lvl = "leger";
  else if (score < 3.5 || (ratio !== null && ratio < 0.95)) lvl = "prudence";
  /* montre ou saisie du matin : FC au repos, VFC, nuit courte (Plews 2013, Buchheit 2014) */
  const w = typeof santeFlag === "function" && data ? santeFlag(data) : null;
  if (w && w.lvl === "leger" && lvl !== "leger") lvl = "leger";
  else if (w && w.lvl === "prudence" && lvl === "ok") lvl = "prudence";
  const txt = { ok: "Feu vert : séance prévue, intensité normale.", prudence: "Prudence : une série de moins sur la force et la puissance, intensité gardée.", leger: "Séance allégée : une série de moins partout, 2 répétitions en réserve de plus, sauts et sprints à 80-90 %." }[lvl];
  return { score: Math.round(score * 10) / 10, ratio, lvl, txt, watch: w && w.notes.length ? w.notes : null };
}

/* ---------- affûtage ---------- */
function taperFor(plan, w) {
  const cd = plan && plan.compDate;
  if (!cd || !plan.start) return null;
  const ws = addDays(plan.start, (w - 1) * 7), we = addDays(ws, 6);
  const d = diffDays(we, cd);
  if (cd < ws) return null;
  if (cd <= we) return { f: 0.5, n: "Semaine de compétition (" + fmtD(cd) + ") : volume réduit de moitié, intensité gardée, rien de nouveau." };
  if (d <= 7) return { f: 0.6, n: "Affûtage : compétition le " + fmtD(cd) + ", volume réduit de 40 %, intensité gardée." };
  return null;
}

/* ---------- dose détaillée d'un exercice ---------- */
const TEMPO = { F8: "3-0-X-0", F5: "2-0-X-0", F3: "2-0-X-0", H12: "3-0-1-0", H8: "3-0-1-0", H15: "2-0-1-0" };
const REST_P = { F3: "3 à 4 min", F5: "3 min", F8: "2 min à 2 min 30", H8: "2 min", H12: "75 à 90 s", H15: "60 s", P: "2 à 3 min, récupération complète", PL: "90 s", S: "complète : 1 min par tranche de 10 m, au moins 2 min", C: "45 s", M: "" };
const VLOSS = { F3: "10 %", F5: "15 %", F8: "20 %", H8: "25 %", H12: "30 %", H15: "30 %", P: "10 %" };
const P_PCT = { 1: [70, 75], 2: [75, 80], 3: [80, 85] };
function doseFor(it, wib, ctx) {
  const c = ctx || {};
  const niv = c.niveau || "sportif";
  const r = nivRank(niv);
  const i = clamp((wib || 1) - 1, 0, 3);
  const base = doseOf(it, wib);
  const lines = [];
  const taper = c.taper, ready = c.ready;
  /* dose écrite à la main (course, intervalles…) */
  if (it.w || !it.t) {
    let text = base.text;
    if (niv === "reprise" && /vite|%|allure|max/i.test(text)) lines.push("Profil Reprise : reste à une intensité où tu peux encore parler par phrases courtes.");
    if (r >= 2) {
      const vma = c.vma;
      const m = text.match(/(\d+)\s*%\s*VMA/i);
      if (m && vma) {
        const sp = vma * Number(m[1]) / 100;
        let add = Number(m[1]) + " % de ta VMA (" + fmtN(vma, 1) + " km/h) = " + fmtN(sp, 1) + " km/h, soit " + paceTxt(sp);
        const md = text.match(/(\d+)\s*m\b/);
        const ms = text.match(/(\d+)\s*s\b/);
        if (md) add += " → " + timeTxt(Number(md[1]) / (sp / 3.6)) + " par " + md[1] + " m";
        else if (ms) add += " → environ " + Math.round(sp / 3.6 * Number(ms[1])) + " m en " + ms[1] + " s";
        lines.push(add + ".");
      } else if (/allure 5 km/i.test(text) && c.t5k) {
        const kmh = 5 / (c.t5k / 60);
        const md = text.match(/(\d+)\s*m\b/);
        lines.push("Allure 5 km = " + paceTxt(kmh) + (md ? " → " + timeTxt(Number(md[1]) / (kmh / 3.6)) + " par " + md[1] + " m" : "") + ".");
      } else if ((it.e === "footing_ef" || it.e === "sortie_longue") && vma) {
        lines.push("Endurance fondamentale : 65 à 75 % de ta VMA, soit " + paceTxt(vma * 0.75) + " à " + paceTxt(vma * 0.65) + ".");
      } else if (/% VMA|allure/i.test(text) && !vma) lines.push("Fais le test demi-Cooper pour obtenir tes allures exactes.");
    }
    if (taper && /×/.test(text)) lines.push("Affûtage : fais " + (taper.f <= 0.5 ? "la moitié" : "60 %") + " des répétitions, à la même intensité.");
    if (ready && ready.lvl === "leger" && /vite|%|max|allure/i.test(text)) lines.push("Forme basse : intensité à 80-90 % aujourd'hui.");
    return { ...base, lines, text };
  }
  const t = T[it.t] || T.C;
  let sets = t.sets[i];
  let reps = it.r || t.reps[i];
  let int = t.int[i];
  let rest = t.rest;
  const loadT = !!t.load;
  const main = /^F|^P$/.test(it.t);
  let rir = rirOf(int);
  /* profil */
  if (niv === "reprise") {
    if (loadT || it.t === "PL" || it.t === "S") sets = Math.max(2, sets - 1);
    if (rir) { rir = [rir[0] + 1, rir[1] + 1]; int = fmtRir(rir); }
    if (it.t === "P") int = "technique : barre à vide ou très légère";
    if (it.t === "PL") int = "petits sauts, réception silencieuse";
    if (it.t === "S") int = "progressif, 80 à 90 % de ta vitesse";
  }
  if (niv === "elite" && main && (i === 1 || i === 2)) sets += 1;
  /* forme du jour */
  if (ready && ready.lvl === "prudence" && main) sets = Math.max(1, sets - 1);
  if (ready && ready.lvl === "leger") {
    sets = Math.max(1, sets - 1);
    if (rir) { rir = [rir[0] + 2, rir[1] + 2]; int = fmtRir(rir); }
    if (it.t === "S" || it.t === "PL") int = "80 à 90 % : pas de record aujourd'hui";
  }
  /* affûtage */
  if (taper && it.t !== "M" && it.t !== "C") sets = Math.max(1, Math.round(sets * taper.f));
  if (r >= 2 && REST_P[it.t]) rest = REST_P[it.t];
  const parts = [sets + " × " + reps];
  if (int) parts.push(int);
  if (rest) parts.push("récup " + rest);
  /* précision Performance / Haut niveau */
  let pct = null, kg = null;
  if (r >= 2 && loadT) {
    const rr = rangeOf(reps);
    if (it.t === "P") pct = (i === 3 ? [60, 65] : P_PCT[clamp(c.block || 1, 1, 3)]);
    else if (rr && rir) pct = [pctRtf(rr[1] + rir[1]), pctRtf(rr[0] + rir[0])];
    if (pct) {
      let e1 = c.e1rm && c.e1rm(it.e);
      if (it.t === "P" && e1 && e1.src !== "test" && !(e1.src === "record déclaré" && e1.reps <= 3)) e1 = null; /* l'estimation par répétitions ne vaut pas pour les mouvements explosifs */
      if (e1 && e1.v) {
        kg = [roundLoad(e1.v * pct[0] / 100), roundLoad(e1.v * pct[1] / 100)];
        lines.push("Charge : " + pctTxt(pct) + " de ton maximum estimé (" + fmtN(e1.v, 1) + " kg, " + e1.src + " du " + fmtD(e1.date) + ") ≈ " + fmtN(kg[0], 1) + (kg[1] !== kg[0] ? " à " + fmtN(kg[1], 1) : "") + " kg.");
      } else lines.push("Charge : " + pctTxt(pct) + " de ton maximum" + (it.t === "P" ? (TEST_FOR_EX[it.e] ? " : fais le test de maximum pour le calcul en kg." : " : une charge que tu montes vite et proprement à chaque répétition.") : ". Note tes charges : le calcul en kg apparaît dès la prochaine séance."));
    }
    if (TEMPO[it.t]) lines.push("Tempo " + TEMPO[it.t] + " : descente " + TEMPO[it.t].split("-")[0] + " s, " + (TEMPO[it.t].split("-")[2] === "X" ? "montée explosive" : "montée en 1 s") + ".");
    if (it.t === "P") lines.push("Chaque répétition à vitesse maximale, réception gainée ; repose la barre entre les répétitions si la technique se dégrade.");
  }
  if (r >= 2 && it.t === "PL") lines.push((sets * (rangeOf(reps) || [5])[0]) + " contacts au total : temps au sol le plus court possible, qualité avant quantité.");
  if (r >= 2 && it.t === "S") {
    const d = rangeOf(reps);
    if (d && /m/.test(String(reps))) lines.push("Volume : " + sets + " × " + reps + " = " + (sets * d[0]) + " m de sprint. Arrête la série si le chrono se dégrade nettement.");
  }
  if (niv === "elite") {
    if (VLOSS[it.t] && loadT) lines.push("Capteur ou vidéo : arrête la série dès que la vitesse chute de plus de " + VLOSS[it.t] + " par rapport à la première répétition.");
    if ((it.t === "F3" || it.t === "P") && (i === 1 || i === 2)) lines.push("En grappes : répétitions par 1 ou 2, 15 à 20 s de pause, jusqu'au total de la série.");
    if (it.t === "S") lines.push("Chronomètre chaque répétition (cellules ou vidéo) et note ton meilleur temps.");
  }
  if (taper && it.t !== "M" && it.t !== "C") lines.push("Affûtage : séries réduites, même charge et même vitesse.");
  return { sets, reps, int, rest, load: loadT, text: parts.join(" · "), lines, pct, kg };
}

/* ---------- échauffement et prévention de la séance ---------- */
function warmupFor(entry, prog, plan, niv) {
  if (nivRank(niv) < 2 || !entry || !entry.s) return entry && entry.s ? entry.s.wu : "";
  const R = CONTENT.RAMP || {};
  if (entry.s.wu && R[entry.s.wu]) return R[entry.s.wu];
  if (prog && prog.id === "retour") return entry.s.wu;
  if (prog && prog.id === "run") return R.course;
  const items = entry.s.items || [];
  if (items.some((x) => x.t === "S")) return R.terrain;
  if (plan && plan.equipment === "maison") return R.maison;
  return R.salle;
}
function preventionFor(entry, prog, plan, niv, sport) {
  if (nivRank(niv) < 2 || !entry || entry.extra || entry.opt || (prog && prog.id === "retour")) return [];
  if (niv === "perf" && entry.sid === "B") return [];
  const cat = sportCat(sport);
  const fam = (CONTENT.PREVSPORT || {})[cat === "aucun" ? "autre" : cat] || [];
  const have = new Set((entry.s.items || []).map((x) => x.e));
  const b = clamp(Math.ceil(entry.w / 4), 1, 3);
  return fam.map((f) => (CONTENT.PREV || {})[f]).filter(Boolean).filter(([e]) => !have.has(e)).map(([e, b1, b2, b3]) => ({ e, w: [b1, b2, b3][b - 1], prev: true }));
}
function sessionD(prog, plan) {
  const k = CONTENT.SESDFOR && prog && CONTENT.SESDFOR[prog.id];
  const d = k && CONTENT.SESD && CONTENT.SESD[k];
  return d ? { ...d, wu: d.wu } : null;
}

/* ---------- composants ---------- */
function FitChecks({ checks }) {
  if (!checks || !checks.length) return null;
  const ic = { ok: "✓", info: "i", warn: "!", bad: "✕" };
  return html`<ul className="fit">${checks.map((c, i) => html`<li key=${i} className=${"fit-" + c.t}><span className="fit-i" aria-hidden="true">${ic[c.t]}</span><span>${c.n}</span></li>`)}</ul>`;
}
function NiveauCards({ value, onChange, recommended }) {
  return html`<div className="nivs" role="radiogroup" aria-label="Profil">${NIV.map((n) => html`<button key=${n.id} type="button" role="radio" aria-checked=${value === n.id} className=${"niv" + (value === n.id ? " on" : "")} onClick=${() => onChange(n.id)}>
    <span className="niv-h"><b>${n.n}</b>${recommended === n.id ? html`<${Pill} tone="gold">Conseillé</${Pill}>` : null}</span>
    <span className="small">${n.short}</span>
    ${value === n.id ? html`<ul className="small niv-l">${n.what.map((w, k) => html`<li key=${k}>${w}</li>`)}</ul>` : null}</button>`)}</div>`;
}
function ReadinessCheck({ value, onChange, data }) {
  const v = value || {};
  /* sommeil pré-rempli depuis la nuit enregistrée (montre ou saisie) */
  const sl = typeof santeVal === "function" ? santeVal(data, todayISO(), "sommeil") : null;
  useEffect(() => { if (sl !== null && v.sommeil === undefined) onChange({ ...v, sommeil: sleepScore(sl) }); }, [sl]);
  const res = readinessOf(v, data);
  const base = cmjBase(data);
  return html`<div className="ready card">
    <div className="card-h"><div><h3>Contrôle de forme</h3><p className="muted small">30 secondes avant l'échauffement : la séance s'ajuste à ta forme du jour.</p></div></div>
    ${READY_ITEMS.map(([k, n, lo, hi]) => html`<${Field} key=${k} label=${n}><${Scale} id=${"rd-" + k} min=${1} max=${5} value=${num(v[k])} lo=${lo} hi=${hi} onChange=${(x) => onChange({ ...v, [k]: x })} /></${Field}>`)}
    <${Field} label="Détente verticale du jour (facultatif, cm)" id="rd-cmj" hint=${base ? "Ton meilleur test : " + fmtN(base, 1) + " cm" : "Fais 3 sauts mains sur les hanches et note le meilleur."}><input id="rd-cmj" inputMode="decimal" value=${v.cmj || ""} onChange=${(e) => onChange({ ...v, cmj: e.target.value })} /></${Field}>
    ${res ? html`<div className=${"alert " + (res.lvl === "ok" ? "okb" : res.lvl === "prudence" ? "gold" : "warn")}><div><b>Forme ${fmtN(res.score, 1)}/5${res.ratio ? " · détente " + Math.round(res.ratio * 100) + " %" : ""}</b><p>${res.txt}</p>${res.watch ? html`<p className="small">Ta montre : ${res.watch.join(" · ")}.</p>` : null}</div></div>` : null}
    ${sl !== null ? html`<p className="muted small">Sommeil pré-rempli depuis ta nuit enregistrée (${fmtN(sl, 1)} h).</p>` : null}
  </div>`;
}
