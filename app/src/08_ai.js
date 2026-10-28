/* ===== Coach IA : accès à Claude, contexte du client, ajustements ===== */
let _aiP = null;
function getAI() {
  if (!_aiP) _aiP = (async () => {
    let s = null, images = false, tools = false, maxImages = 0;
    try { s = window.claude && typeof window.claude.use === "function" ? await window.claude.use("sample") : null; } catch (e) { s = null; }
    if (s) {
      try { const l = await s.limits(); images = !!(l && l.images); maxImages = images ? l.images.maxCount || 1 : 0; tools = !!(l && l.tools); } catch (e) {}
    }
    return { sample: s ? aiWrap(s) : null, images, tools, maxImages };
  })();
  return _aiP;
}
function useAI() {
  const [st, setSt] = useState({ ready: false, sample: null, images: false, tools: false, maxImages: 0 });
  useEffect(() => { let a = true; getAI().then((x) => { if (a) setSt({ ...x, ready: true }); }); return () => { a = false; }; }, []);
  return st;
}
/* ---------- limites d'utilisation du coach IA par jour, selon la formule (réglables par le coach) ----------
   Une « question » = une demande du client (message, repas, étiquette, vidéo, recette) ; une « photo » = une demande avec image.
   L'analyse automatique du bilan de la semaine ne compte pas. Le coach n'a pas de limite. Sur le site, le relais applique
   aussi ces limites (avec 2 demandes de marge pour les analyses de bilan). */
const AI_QUOTA_DEF = { ia: { q: 10, ph: 3 }, essentiel: { q: 10, ph: 3 }, suivi: { q: 20, ph: 5 }, surmesure: { q: 30, ph: 8 }, hybride: { q: 10, ph: 3 } };
const AI_QUOTA_MAX = 200;
function aiQuota(settings, offer) {
  if (!offer || offer === "lite") return { q: 0, ph: 0 };
  const d = AI_QUOTA_DEF[offer] || AI_QUOTA_DEF.essentiel;
  const s = (settings && settings.ai && settings.ai.quota && settings.ai.quota[offer]) || {};
  const n = (v, def) => { const x = Math.round(Number(v)); return Number.isFinite(x) && v !== "" && v !== null && v !== undefined ? clamp(x, 0, AI_QUOTA_MAX) : def; };
  return { q: n(s.q, d.q), ph: n(s.ph, d.ph) };
}
/* langue du client : l'IA lui répond dans sa langue (les consignes restent en français) */
const LANG_NAME = { fr: "français", en: "anglais (English)", es: "espagnol (español)" };
function aiLang(extra) { return LANG === "fr" ? "" : "Langue : le client utilise l'application en " + LANG_NAME[LANG] + ". Écris tout ce que le client lira uniquement en " + LANG_NAME[LANG] + " (registre familier, comme un coach), même si ces consignes sont en français." + (extra ? " " + extra : ""); }
/* texte des limites d'une formule, pour la page d'accueil, la commande et les conditions */
function aiLimitTxt(settings, offer) { const q = aiQuota(settings, offer); return q.q ? "Coach IA : jusqu'à " + plural(q.q, "question") + " et " + plural(q.ph, "photo") + " par jour." : ""; }
let _aiq = null; /* { lim: {q, ph}, name, used(): {q, ph}, add(photo) } — posé par l'espace client */
function aiQuotaSet(c) { _aiq = c; }
function aiQuotaErr(kind) {
  const q = _aiq, e = new Error("quota");
  e.code = kind === "ph" ? "quota_photos_jour" : "quota_jour";
  e.msg = q ? (kind === "ph" ? "Tu as utilisé tes " + plural(q.lim.ph, "photo") + " analysées par le coach IA aujourd'hui" : "Tu as utilisé tes " + plural(q.lim.q, "question") + " au coach IA aujourd'hui") + (q.name ? " (formule " + q.name + ")" : "") + ". Reviens demain : le compteur repart à zéro à minuit." : "";
  return e;
}
function aiQuotaMsg(aiq, kind) { return (kind === "ph" ? "Tu as utilisé tes " + plural(aiq.lim.ph, "photo") + " analysées par le coach IA aujourd'hui" : "Tu as utilisé tes " + plural(aiq.lim.q, "question") + " au coach IA aujourd'hui") + ". Reviens demain : le compteur repart à zéro à minuit."; }
function aiLeft() { if (!_aiq) return null; const u = _aiq.used(); return { q: Math.max(0, _aiq.lim.q - u.q), ph: Math.max(0, _aiq.lim.ph - u.ph), lim: _aiq.lim }; }
function aiWrap(s) {
  const gate = async (input, opts, fn) => {
    const o = { ...(opts || {}) }; const sys = !!o.system; delete o.system;
    const q = sys ? null : _aiq;
    const photo = !!(o.images && (o.images instanceof Blob || o.images.length));
    if (q) { const u = q.used(); if (u.q >= q.lim.q) throw aiQuotaErr("q"); if (photo && u.ph >= q.lim.ph) throw aiQuotaErr("ph"); }
    const r = await fn(input, o);
    if (q) { try { await q.add(photo); } catch (e) {} }
    return r;
  };
  const w = (input, opts) => gate(input, opts, (i, o) => s(i, o));
  w.json = (input, opts) => gate(input, opts, (i, o) => s.json(i, o));
  w.limits = (...a) => s.limits(...a);
  return w;
}
/* compteur du jour du client : document clients/{id}/aiuse/{jour} */
function useAIQuota(data, src, settings, plan, off) {
  const day = todayISO();
  const lim = aiQuota(settings, plan && plan.offer);
  const cur = (data && data.aiuse && data.aiuse[day]) || {};
  const used = { q: Number(cur.q) || 0, ph: Number(cur.ph) || 0 };
  useEffect(() => {
    if (off || !src || !plan) { aiQuotaSet(null); return; }
    aiQuotaSet({ lim, name: offerName(plan.offer), used: () => { const c = (src.get().aiuse || {})[todayISO()] || {}; return { q: Number(c.q) || 0, ph: Number(c.ph) || 0 }; },
      add: async (photo) => { const d = todayISO(); const c = (src.get().aiuse || {})[d] || {}; await src.saveAiUse(d, { d, q: (Number(c.q) || 0) + 1, ph: (Number(c.ph) || 0) + (photo ? 1 : 0), at: nowISO() }); } });
    return () => aiQuotaSet(null);
  }, [off, src, plan && plan.offer, lim.q, lim.ph]);
  return { lim, used, left: { q: Math.max(0, lim.q - used.q), ph: Math.max(0, lim.ph - used.ph) } };
}
const AI_ERR = {
  not_granted: "Tu n'as pas autorisé l'application à utiliser Claude. Tu peux l'activer depuis le menu Autorisations de la page.",
  sampling_disabled: "Le coach IA n'est pas disponible pour ton compte Claude.",
  rate_limited: "Trop de demandes pour le moment, ou limite d'utilisation de ton compte Claude atteinte. Réessaie un peu plus tard.",
  session_expired: "Reconnecte-toi à Claude, puis réessaie.",
  image_rejected: "Photo refusée : essaie une autre photo (JPEG ou PNG).",
  images_unavailable: "L'envoi de photos n'est pas disponible ici.",
  tools_unavailable: "Les ajustements automatiques ne sont pas disponibles ici.",
  refused: "Demande refusée : reformule ta question.",
  invalid_json: "Réponse illisible : réessaie.",
  empty_completion: "Pas de réponse : reformule ta demande.",
  prompt_too_large: "Demande trop longue : raccourcis-la.",
  quota_jour: "Tu as atteint la limite du jour de ta formule pour le coach IA. Reviens demain : le compteur repart à zéro à minuit.",
  quota_photos_jour: "Tu as atteint la limite de photos du jour de ta formule. Reviens demain : le compteur repart à zéro à minuit.",
  upstream_error: "Service momentanément indisponible : réessaie dans un instant.",
};
/* site : l'IA passe par le relais du coach (pas par un compte Claude) */
const AI_ERR_SITE = {
  sampling_disabled: "Le coach IA n'est pas disponible avec ta formule actuelle.",
  rate_limited: "Le coach IA a atteint sa limite gratuite pour aujourd'hui : réessaie demain.",
  session_expired: "Reconnecte-toi, puis réessaie.",
};
function aiErr(e) { if (e && e.code === "cancelled") return ""; if (e && e.msg) return e.msg; return (window.IS_SITE && AI_ERR_SITE[e && e.code]) || AI_ERR[e && e.code] || AI_ERR.upstream_error; }
const AI_HIDE = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];

const DEFAULT_AI_RULES = [
  "Pas de régime strict : 80 % d'aliments simples et peu transformés, 20 % de plaisir sans culpabilité.",
  "Des protéines à chaque repas, des légumes à au moins deux repas par jour, de l'eau en priorité.",
  "Progression des charges uniquement si la technique est propre et l'intensité demandée (RIR) respectée.",
  "En cas de doute sur une douleur : on allège et on me prévient.",
  "Encourage, félicite les efforts réels, reste honnête quand la régularité baisse.",
].join("\n");
function aiConf(settings, data) {
  const s = (settings && settings.ai) || (data && data.coachAi) || {};
  const al = s.allow || {};
  return { on: s.on !== false, rules: s.rules != null && String(s.rules).trim() ? String(s.rules) : DEFAULT_AI_RULES,
    allow: { nutri: al.nutri !== false, subst: al.subst !== false, charge: al.charge !== false } };
}

/* ---------- ajustements actifs ---------- */
function activeAdj(data, kind) { return Object.entries(data.ai || {}).map(([id, a]) => ({ id, ...a })).filter((a) => a && a.status !== "annule" && (!kind || a.kind === kind)).sort((a, b) => String(a.at).localeCompare(String(b.at))); }
function adjItems(entry, data, prog) {
  const subs = activeAdj(data, "subst"), charges = activeAdj(data, "charge");
  const base = typeof sportItems === "function" ? sportItems(entry, data, prog) : entry.s.items;
  return base.map((it) => {
    let out = it;
    subs.forEach((s) => { if (out.e === s.from && entry.w >= (s.fromW || 1) && (!s.sid || s.sid === "*" || s.sid === entry.sid)) out = { ...out, e: s.to, adj: "Remplacé par le coach IA" + (s.reason ? " : " + s.reason : "") }; });
    charges.forEach((c) => { if (out.e === c.e && entry.w >= (c.fromW || 1) && entry.w <= (c.toW || 99)) out = { ...out, adjNote: c.text }; });
    return out;
  });
}
function adjLabel(a) {
  const nm = (id) => (EXB[id] ? EXB[id].n : id);
  if (a.kind === "nutri") return "Cibles nutrition : " + (a.after ? fmtN(a.after.kcal, 0) + " kcal · protéines " + fmtN(a.after.p, 0) + " g" + (a.after.steps ? " · " + fmtN(a.after.steps, 0) + " pas" : "") : "");
  if (a.kind === "subst") return "Remplacement : " + nm(a.from) + " → " + nm(a.to) + (a.sid && a.sid !== "*" ? " (séance " + a.sid + ")" : "") + ", dès la semaine " + a.fromW;
  if (a.kind === "charge") return "Consigne de charge : " + nm(a.e) + " — " + a.text + " (S" + a.fromW + (a.toW && a.toW !== a.fromW ? " à S" + a.toW : "") + ")";
  if (a.kind === "note") return "Mot pour la semaine " + a.fromW + " : " + a.text;
  if (a.kind === "terrain") return "Séance terrain conseillée (S" + a.fromW + (a.toW && a.toW !== a.fromW ? " à S" + a.toW : "") + ") : " + (typeof DRB !== "undefined" && DRB[a.drill] ? DRB[a.drill].n : a.drill) + (a.text ? " — " + a.text : "");
  if (a.kind === "alerte") return (a.urgence === "haute" ? "Alerte : " : "Signalement : ") + a.text;
  return a.kind;
}

/* ---------- contexte : toutes les données du client, lues au moment de la demande ---------- */
function clientContext({ data, plan, prog, stats, lib }) {
  const L = [];
  const now = new Date();
  const p = data.profile || {};
  const np = data.nutri && data.nutri.plan;
  const age = p.birthYear ? now.getFullYear() - p.birthYear : (np && np.age) || null;
  L.push("CONTEXTE DU CLIENT — données lues à l'instant (" + JOURS[now.getDay()] + " " + fmtDY(todayISO()) + ", " + pad(now.getHours()) + " h " + pad(now.getMinutes()) + ")");
  L.push("Client : " + ((p.name || "").split(" ")[0] || "client") + (age ? " · " + age + " ans" : "") + (np && np.sex ? " · " + (np.sex === "F" ? "femme" : "homme") : "") + (p.sport ? " · sport : " + p.sport : "") + (p.level ? " · niveau " + p.level : "") + " · profil " + nivName(effNiveau(plan, p)) + (plan && plan.medicalHold ? " (avis médical en attente : rester en mode Reprise)" : "") + (plan && plan.compDate ? " · compétition le " + plan.compDate : "") + (p.side ? " · côté blessé : " + p.side : ""));
  if (typeof bodyLine === "function" && bodyLine(p)) L.push("Morphologie déclarée : " + bodyLine(p) + (p.weightAt ? " (poids du " + fmtD(p.weightAt) + ")" : "") + ".");
  if (typeof recLines === "function" && recLines(p.records).length) L.push("Records déclarés (" + fmtD(p.recordsAt || p.createdAt) + ") : " + recLines(p.records).join(" ; ") + ".");
  if (p.screeningFlag && typeof screeningLines === "function") L.push("Questionnaire santé, réponses « oui » : " + screeningLines(p).join(" ; ") + ". Reste prudent et renvoie vers le médecin pour tout ce qui touche à ces points.");
  const spo = typeof sportOf === "function" ? sportOf(p) : null;
  if (spo) {
    L.push("Sport : " + sportLabel(p) + " · qualités clés : " + spo.focus + (p.sportAdapt === false ? " · adaptation au sport désactivée par le client" : " · séances adaptées au sport (exercices spécifiques en salle, séances terrain du sport)"));
    L.push("Séances terrain de son sport (identifiant : nom, type, dose pour son profil) : " + drillsFor(spo).map((d) => d.id + " : " + d.n + ", " + d.type + ", " + drillDose(d, effNiveau(plan, p)).t).join(" ; "));
    const tdone = Object.values(data.libres || {}).filter((l) => l && l.kind === "terrain").sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
    if (tdone.length) L.push("Dernières séances terrain : " + tdone.map((l) => fmtD(l.d) + " « " + l.n + " » effort " + l.rpe + "/10" + (l.res ? ", résultat " + fmtRes(l.res.t, l.res.v) : "")).join(" ; "));
  } else if (p.sport) L.push("Sport déclaré mais non reconnu dans la liste : « " + p.sport + " ».");
  const ps = stats && stats.ps;
  if (plan && prog && ps) {
    const b = blockOf(prog, Math.max(1, ps.week));
    L.push("Programme : " + prog.n + " · " + durName(plan.weeks) + " · formule " + offerName(plan.offer) + " · lieu : " + (plan.equipment === "maison" ? "maison" : "salle") +
      (ps.phase === "en_cours" ? " · semaine " + ps.week + "/" + ps.weeks + " (bloc " + ps.block + " « " + b.n + " »" + (ps.wib === 4 ? ", semaine d'allègement puis tests" : "") + ", jour " + ps.day + "/7)" : ps.phase === "avant" ? " · démarre dans " + ps.daysToStart + " j" : " · programme terminé"));
    if (plan.message) L.push("Message actuel d'Antoine au client : " + plan.message);
    const w = ps.phase === "en_cours" ? ps.week : ps.phase === "fini" ? plan.weeks : 1;
    const ses = weekSessions(prog, plan, w, lib);
    L.push("Séances de la semaine " + w + " (faites " + (stats.doneByWeek[w] || 0) + "/" + ses.length + ") :");
    ses.forEach((e) => {
      const items = adjItems(e, data, prog);
      const dn = data.logs[e.key];
      L.push("  " + e.sid + " « " + e.s.t + " »" + (dn ? " ✓ faite le " + fmtD(dn.date) : " à faire") + " : " + items.map((it) => it.e + " (" + (EXB[it.e] ? EXB[it.e].n : it.e) + ", " + doseOf(it, ps.wib || 1).text + ")" + (it.adjNote ? " [consigne IA : " + it.adjNote + "]" : "")).join(" ; "));
    });
    if (stats.adherence !== null) L.push("Régularité depuis le début : " + Math.round(stats.adherence * 100) + " % des séances prévues.");
  } else L.push("Programme : pas encore actif.");
  const logs = (stats ? stats.logs : []).slice(0, 6);
  if (logs.length) {
    L.push("Dernières séances :");
    logs.forEach((l) => {
      const best = (l.items || []).filter((it) => it.sets && it.sets.some((s) => num(s.kg))).slice(0, 3).map((it) => {
        const top = it.sets.reduce((m, s) => (num(s.kg) > num(m.kg) ? s : m), it.sets[0]);
        return (EXB[it.e] ? EXB[it.e].n : it.e) + " " + top.kg + " kg × " + top.reps;
      });
      L.push("  " + fmtD(l.date) + " · S" + l.w + " « " + l.title + " » · effort " + (l.rpe ?? "?") + "/10 · " + (l.duree || "?") + " min · douleur " + (l.douleur || 0) + "/10" + (l.zone ? " (" + l.zone + ")" : "") + (best.length ? " · " + best.join(", ") : "") + (l.comment ? " · commentaire : « " + String(l.comment).slice(0, 160) + " »" : ""));
    });
  }
  const ck = Object.values(data.checkins || {}).filter(Boolean).sort((a, b) => b.w - a.w).slice(0, 3);
  if (ck.length) {
    L.push("Derniers bilans hebdomadaires :");
    ck.forEach((c) => {
      const parts = [];
      if (num(c.poids) !== null) parts.push("poids " + fmtN(num(c.poids)) + " kg");
      if (num(c.taille) !== null) parts.push("tour de taille " + fmtN(num(c.taille)) + " cm");
      ["sommeil", "energie", "stress", "courbatures", "nutrition"].forEach((k) => { if (c[k]) parts.push(k + " " + c[k] + "/5"); });
      if (c.douleur) parts.push("douleur " + c.douleur + "/10" + (c.zone ? " (" + c.zone + ")" : ""));
      if (num(c.pas) !== null) parts.push(fmtN(num(c.pas), 0) + " pas/j");
      ["victoire", "difficulte", "question"].forEach((k) => { if (c[k]) parts.push(k + " : « " + String(c[k]).slice(0, 160) + " »"); });
      const r = data.replies && data.replies["w" + c.w];
      L.push("  S" + c.w + " : " + parts.join(" · ") + (r ? " — réponse d'Antoine : « " + String(r.text).slice(0, 200) + " »" : " — pas encore de réponse d'Antoine"));
    });
  }
  if (prog) {
    const pts = testPoints(plan || { weeks: 12 }).filter((x) => data.tests["t" + x]);
    if (pts.length) {
      const first = data.tests["t" + pts[0]].values, last = data.tests["t" + pts[pts.length - 1]].values;
      const tl = prog.tests.filter((t) => first[t] !== undefined || last[t] !== undefined).map((t) => {
        const f = (v) => (v && typeof v === "object" ? (v.v ?? ((v.g ?? "?") + "/" + (v.d ?? "?"))) : v);
        return TESTS[t].n + " " + f(first[t]) + (pts.length > 1 ? " → " + f(last[t]) : "") + " " + TESTS[t].u;
      });
      L.push("Tests (" + pts.map((x) => (x ? "S" + x : "départ")).join(", ") + ") : " + tl.join(" ; "));
    }
  }
  if (np) {
    if (np.mode === "equilibre") L.push("Nutrition : mode « équilibre » (aucun chiffre de calories ni de poids).");
    else {
      const t = np.targets || {};
      L.push("Objectif nutrition : " + nutriGoalText(np) + " · cibles du jour : " + fmtN(t.kcal, 0) + " kcal, protéines " + fmtN(t.p, 0) + " g, glucides " + fmtN(t.c, 0) + " g, lipides " + fmtN(t.f, 0) + " g, " + fmtN(t.steps, 0) + " pas, eau " + fmtN(t.water, 1) + " L · dépense estimée " + fmtN(np.tdee, 0) + " kcal · plancher de sécurité " + fmtN(np.floor, 0) + " kcal" + (np.prefs ? " · préférences : " + np.prefs : ""));
      const enT = dayEnergy(data, np, todayISO()), en7 = energyAvg(data, np, 7);
      if ((enT && (enT.total || enT.steps !== null)) || en7) L.push("Dépense mesurée : aujourd'hui " + (enT && enT.total ? fmtN(enT.total, 0) + " kcal (" + (enT.src === "montre" ? "calories actives de la montre" : "d'après les pas et séances") + ")" + (enT.bonus ? ", bonus d'activité +" + fmtN(enT.bonus, 0) + " kcal sur la cible du jour" : "") : "pas encore de donnée") + (enT && enT.steps !== null ? ", " + fmtN(enT.steps, 0) + " pas" : "") + (en7 ? " · moyenne sur " + en7.n + " jours : " + fmtN(en7.total, 0) + " kcal" + (en7.steps !== null ? " et " + fmtN(en7.steps, 0) + " pas par jour" : "") : "") + " · dépense prévue par le plan " + fmtN(np.tdee, 0) + " kcal. Si la moyenne mesurée s'écarte durablement du plan, propose d'ajuster les cibles (les montres se trompent souvent de 20 % ou plus).");
      const exp = expectedWeight(np, todayISO());
      const lastW = lastWeight(data);
      if (exp !== null) L.push("Poids attendu aujourd'hui selon le plan : " + fmtN(exp) + " kg" + (lastW ? " · dernier poids noté : " + fmtN(lastW.v) + " kg (" + fmtD(lastW.d) + ")" : ""));
    }
    const today = todayISO();
    const day = data.food[today];
    const tot = dayTotals(day);
    if (day && (day.meals || []).length) L.push("Aujourd'hui, repas notés : " + day.meals.map((m) => slotName(m.slot) + " « " + m.title + " »" + (np.mode !== "equilibre" ? " " + fmtN(m.kcal, 0) + " kcal / P " + fmtN(m.p, 0) + " g" : "")).join(" ; ") + (np.mode !== "equilibre" ? " — total " + fmtN(tot.kcal, 0) + " kcal, P " + fmtN(tot.p, 0) + " g, G " + fmtN(tot.c, 0) + " g, L " + fmtN(tot.f, 0) + " g" : ""));
    else L.push("Aujourd'hui : aucun repas noté pour l'instant.");
    { const hy = hydraTarget(data, np, today), st = np.mode !== "equilibre" ? sweatTest(data) : null;
      L.push("Hydratation aujourd'hui : " + fmtN(waterOf(data, today), 2) + " L bus sur un objectif de " + fmtN(hy.total, 1) + " L (base " + fmtN(hy.base, 1) + " L" + (hy.extra ? " + " + fmtN(hy.extra, 1) + " L pour " + hy.mins + " min d'entraînement" : "") + ")" + (st ? " · débit de sueur mesuré le " + fmtD(st.d) + " : " + fmtN(num(st.taux), 1) + " L par heure, perte " + fmtN(num(st.perte), 1) + " % du poids" : "")); }
    const wk = Array.from({ length: 7 }, (_, i) => addDays(today, -i - 1)).map((d) => ({ d, t: dayTotals(data.food[d]), n: ((data.food[d] || {}).meals || []).length })).filter((x) => x.n);
    if (wk.length && np.mode !== "equilibre") L.push("7 jours précédents : " + wk.length + " jours notés · moyenne " + fmtN(wk.reduce((s, x) => s + x.t.kcal, 0) / wk.length, 0) + " kcal et " + fmtN(wk.reduce((s, x) => s + x.t.p, 0) / wk.length, 0) + " g de protéines par jour noté.");
  } else L.push("Nutrition : pas encore d'objectif défini (onglet Nutrition).");
  const adj = activeAdj(data).filter((a) => a.kind !== "alerte").slice(-8);
  if (adj.length) L.push("Ajustements déjà faits par le coach IA : " + adj.map((a) => fmtD(a.at) + " " + adjLabel(a) + (a.reason ? " (raison : " + a.reason + ")" : "")).join(" ; "));
  return L.join("\n");
}
function exerciseCatalog() {
  const by = {};
  EXLIB.forEach((e) => { (by[e.c] = by[e.c] || []).push(e.id + " (" + e.n + ")"); });
  return "Exercices disponibles (identifiant et nom) :\n" + Object.entries(by).map(([c, l]) => c + " : " + l.join(", ")).join("\n");
}
function aiRules(conf, data, plan, ai) {
  const np = data.nutri && data.nutri.plan;
  const floor = np && np.floor ? fmtN(np.floor, 0) : "1 200 (femme) ou 1 500 (homme)";
  const canDo = [];
  if (ai.tools) {
    if (conf.allow.nutri) canDo.push("ajuster ses cibles nutritionnelles (ajuster_nutrition)");
    if (conf.allow.subst) canDo.push("remplacer un exercice (remplacer_exercice)");
    if (conf.allow.charge) canDo.push("donner une consigne de charge (adapter_charge) ou un mot pour la semaine (note_seance)");
  }
  return [
    "Tu es « Coach IA », l'assistant d'Antoine Limousi, préparateur physique (Antoine Prépa Performance, Bordeaux), intégré à l'application de suivi de ses clients. Tu réponds directement au client, en " + (LANG === "fr" ? "français" : LANG_NAME[LANG]) + ", en le tutoyant, de façon chaleureuse, concrète et brève (4 à 10 lignes en général ; une liste ou un menu seulement si c'est demandé). Pas de titres Markdown.",
    ...(LANG === "fr" ? [] : [aiLang()]),
    ...(plan && offerAuto(plan.offer) ? ["Formule Coach IA : c'est toi qui conduis son programme au quotidien ; Antoine ne répond pas personnellement à ses bilans ni à ses messages. Fais toi-même les ajustements utiles dans tes limites, et préviens Antoine (signaler_coach) pour toute douleur, tout malaise ou toute question médicale."] : []),
    "",
    "Méthode à chaque réponse :",
    "1. Relis le contexte ci-dessous (séances, charges, douleurs, bilans, tests, repas, objectif) et appuie ta réponse sur ces données, en citant les chiffres utiles.",
    canDo.length ? "2. Si les données ou la demande du client justifient un changement, tu peux " + canDo.join(", ") + ". Fais au plus deux ajustements à la fois, toujours avec une raison tirée des données, puis explique au client ce que tu as changé." : "2. Tu ne peux rien modifier toi-même : propose les changements utiles et préviens Antoine avec signaler_coach si c'est important.",
    "3. Si la question dépasse ton rôle ou si la situation est préoccupante, préviens Antoine avec signaler_coach" + (ai.tools ? "" : " (indique au client d'en parler à Antoine)") + ".",
    "4. Adapte toujours tes conseils au sport et au poste du client : exercices spécifiques de la bibliothèque, séances terrain de son sport (avec distances, récupérations et dose de son profil), calendrier de compétition. Pour une séance terrain, propose une séance de la liste fournie" + (ai.tools && conf.allow.charge ? " et affiche-la avec conseiller_seance_terrain" : "") + ".",
    "",
    "Règles de sécurité, non négociables :",
    "- Douleur à 4/10 ou plus, douleur qui augmente, gonflement, douleur dans la poitrine, malaise ou essoufflement anormal : conseille d'arrêter l'exercice en cause, remplace-le ou allège, préviens Antoine (urgence haute) et conseille de consulter un médecin ou un kiné si ça persiste plus de 48 h. Jamais de diagnostic.",
    "- Nutrition : jamais moins de " + floor + " kcal par jour, déficit de 25 % au maximum, perte de 1 % du poids par semaine au maximum, protéines entre 1,2 et 2,4 g par kg. Pas de jeûne prolongé, pas de suppression d'un groupe d'aliments, jamais de « compensation » (sauter un repas ou faire du sport pour « éliminer » un écart).",
    "- Compléments : seulement protéine en poudre ou créatine si c'est pertinent, rien d'autre ; avis médical si un traitement est en cours.",
    "- Maladie (diabète, cœur, reins, digestion…), grossesse, allaitement, allergie sévère ou traitement : reste général, renvoie vers le médecin ou un diététicien et préviens Antoine.",
    "- Si le client exprime un rapport difficile à la nourriture ou à son corps (peur de manger, forte culpabilité, crises, vomissements, restriction sévère) ou une détresse : aucun chiffre, réponds avec bienveillance, encourage-le à en parler à son médecin et préviens Antoine.",
    "- Tu ne changes jamais la formule, la durée, le prix ni le programme choisi : c'est le rôle d'Antoine.",
    "- Les calories des repas sont des estimations ; si tu ne sais pas, dis-le." + (ai.tools && !(np && np.mode === "equilibre") ? " Pour les valeurs nutritionnelles d'un aliment, cherche-les avec valeurs_aliment (table Ciqual de l'ANSES) plutôt que de mémoire, et précise que ce sont celles de l'ANSES." : ""),
    np && np.mode === "equilibre" ? "- Ce client est en mode « équilibre » : ne parle jamais de calories, de macros, de pesée ni d'objectif de poids." : "",
    "",
    "Consignes d'Antoine (prioritaires sur tes habitudes, jamais sur les règles de sécurité) :",
    conf.rules,
    plan && plan.aiNote ? "Consigne d'Antoine pour ce client : " + plan.aiNote : "",
  ].filter((x) => x !== "").join("\n");
}

/* ---------- outils d'ajustement offerts à Claude ---------- */
function makeTools({ data, src, plan, prog, stats, conf, onEvent }) {
  const ps = stats && stats.ps;
  const curW = ps ? (ps.phase === "en_cours" ? ps.week : ps.phase === "avant" ? 1 : plan.weeks) : 1;
  const np = data.nutri && data.nutri.plan;
  const ev = (label) => { try { onEvent && onEvent(label); } catch (e) {} };
  const save = async (a) => { const id = rid("ia_"); const doc = { ...a, at: nowISO(), by: "ia", seen: false, status: "active" }; await src.saveAdjust(id, doc); ev(adjLabel(doc)); return doc; };
  const reason = (x) => String(x || "").slice(0, 240);
  const blockIds = () => { if (!prog) return []; const b = blockOf(prog, curW); const ids = new Set(); b.sessions.forEach((s) => adjItems({ s, w: curW, sid: s.id }, data, prog).forEach((it) => ids.add(it.e))); return [...ids]; };
  const tools = [];
  tools.push({ name: "signaler_coach", description: "Prévient Antoine (le coach humain) avec un message court : douleur, question médicale, demande hors de ton rôle, baisse de motivation, changement à valider. Renvoie une confirmation.",
    inputSchema: { type: "object", properties: { message: { type: "string", description: "Ce qu'Antoine doit savoir, en une ou deux phrases" }, urgence: { type: "string", enum: ["normale", "haute"] } }, required: ["message"] },
    async execute(i) { const m = String(i.message || "").trim(); if (!m) throw new Error("message vide"); await save({ kind: "alerte", text: m.slice(0, 400), urgence: i.urgence === "haute" ? "haute" : "normale" }); return "Antoine est prévenu."; } });
  if (!(np && np.mode === "equilibre")) tools.push({ name: "valeurs_aliment", description: "Cherche les valeurs nutritionnelles officielles d'un aliment dans la table Ciqual de l'ANSES : énergie, protéines, glucides, lipides, sucres, fibres et sel pour 100 g, et pour la quantité demandée. Renvoie les aliments les plus proches.",
    inputSchema: { type: "object", properties: { aliment: { type: "string", description: "Nom de l'aliment, ex. « riz basmati cuit », « filet de poulet grillé »" }, grammes: { type: "number", description: "Quantité en grammes (facultatif)" } }, required: ["aliment"] },
    async execute(i) {
      const t = await ciqLoad();
      if (!t) throw new Error("Table de l'ANSES indisponible pour le moment.");
      const q = String(i.aliment || "").trim(); if (!q) throw new Error("aliment vide");
      let res = ciqSearch(q, 4);
      if (!res.length) { const b = ciqBest(q); if (b) res = [b]; }
      if (!res.length) { const w = ciqToks(q)[0]; res = w ? ciqSearch(w, 4) : []; }
      if (!res.length) return "Aucun aliment proche dans la " + ciqLabel(t) + ".";
      const g = num(i.grammes);
      const f1 = (v, d) => (v === null || v === undefined ? "?" : fmtN(v, d));
      return "Source : " + ciqLabel(t) + ".\n" + res.map((r) => "« " + r.nom + " » pour 100 g : " + f1(r.kcal, 0) + " kcal, protéines " + f1(r.p, 1) + " g, glucides " + f1(r.c, 1) + " g (dont sucres " + f1(r.s, 1) + " g), lipides " + f1(r.f, 1) + " g, fibres " + f1(r.fi, 1) + " g, sel " + f1(r.sel, 2) + " g" +
        (g ? " ; pour " + fmtN(g, 0) + " g : " + fmtN(r.kcal * g / 100, 0) + " kcal, protéines " + fmtN((r.p || 0) * g / 100, 1) + " g, glucides " + fmtN((r.c || 0) * g / 100, 1) + " g, lipides " + fmtN((r.f || 0) * g / 100, 1) + " g" : "")).join("\n");
    } });
  if (conf.allow.nutri) tools.push({ name: "ajuster_nutrition", description: "Modifie les cibles nutritionnelles quotidiennes du client. Les valeurs hors des limites de sécurité sont corrigées automatiquement. Renvoie les valeurs réellement appliquées.",
    inputSchema: { type: "object", properties: { kcal: { type: "number" }, proteines_g: { type: "number" }, glucides_g: { type: "number" }, lipides_g: { type: "number" }, pas: { type: "number", description: "Objectif de pas par jour" }, raison: { type: "string", description: "La donnée qui justifie le changement" } }, required: ["raison"] },
    async execute(i) {
      if (!np) throw new Error("Le client n'a pas encore défini son objectif nutrition : invite-le à le faire dans l'onglet Nutrition.");
      if (np.mode === "equilibre") throw new Error("Client en mode équilibre : pas de cibles chiffrées.");
      const r = safeTargets(np, { kcal: num(i.kcal), p: num(i.proteines_g), c: num(i.glucides_g), f: num(i.lipides_g), steps: num(i.pas) });
      const before = { ...np.targets };
      const next = { ...np, targets: { ...np.targets, ...r.t }, history: [...(np.history || []), { at: nowISO(), by: "ia", before, after: r.t, reason: reason(i.raison) }].slice(-30), updatedAt: nowISO() };
      await src.saveNutri(next);
      await save({ kind: "nutri", before, after: r.t, reason: reason(i.raison) });
      return "Appliqué : " + fmtN(r.t.kcal, 0) + " kcal, protéines " + fmtN(r.t.p, 0) + " g, glucides " + fmtN(r.t.c, 0) + " g, lipides " + fmtN(r.t.f, 0) + " g, " + fmtN(r.t.steps, 0) + " pas." + (r.notes.length ? " Corrigé pour la sécurité : " + r.notes.join(" ; ") + "." : "");
    } });
  if (conf.allow.subst && prog) tools.push({ name: "remplacer_exercice", description: "Remplace un exercice du programme par un autre exercice de la bibliothèque, à partir de la semaine en cours (douleur, matériel manquant, technique, spécificité du sport). Renvoie une confirmation ou la liste des exercices du bloc si l'identifiant est faux.",
    inputSchema: { type: "object", properties: { exercice_actuel: { type: "string", description: "Identifiant de l'exercice à remplacer" }, nouvel_exercice: { type: "string", description: "Identifiant du nouvel exercice (liste fournie)" }, seance: { type: "string", enum: ["A", "B", "C", "toutes"] }, raison: { type: "string" } }, required: ["exercice_actuel", "nouvel_exercice", "raison"] },
    async execute(i) {
      const from = String(i.exercice_actuel || "").trim(), to = String(i.nouvel_exercice || "").trim();
      const ids = blockIds();
      if (!ids.includes(from)) throw new Error("Exercice absent du bloc en cours. Exercices du bloc : " + ids.join(", "));
      if (!EXB[to]) throw new Error("Identifiant inconnu : " + to + ". Choisis dans la liste des exercices disponibles.");
      if (from === to) throw new Error("Même exercice.");
      const sid = ["A", "B", "C"].includes(String(i.seance)) ? String(i.seance) : "*";
      await save({ kind: "subst", from, to, sid, fromW: curW, reason: reason(i.raison) });
      return "Remplacé : " + EXB[from].n + " → " + EXB[to].n + (sid !== "*" ? " (séance " + sid + ")" : " (toutes les séances)") + " dès la semaine " + curW + ".";
    } });
  if (conf.allow.charge && prog) {
    tools.push({ name: "adapter_charge", description: "Ajoute une consigne courte sur un exercice pour 1 à 4 semaines (par exemple « −10 % de charge », « RIR 3 », « amplitude réduite sans douleur »). Elle s'affiche dans la séance du client.",
      inputSchema: { type: "object", properties: { exercice: { type: "string", description: "Identifiant de l'exercice" }, consigne: { type: "string", description: "80 caractères maximum" }, semaines: { type: "number", description: "1 à 4" }, raison: { type: "string" } }, required: ["exercice", "consigne", "raison"] },
      async execute(i) {
        const e = String(i.exercice || "").trim(); const ids = blockIds();
        if (!ids.includes(e)) throw new Error("Exercice absent du bloc en cours. Exercices du bloc : " + ids.join(", "));
        const n = clamp(Math.round(num(i.semaines) || 1), 1, 4);
        const text = String(i.consigne || "").trim().slice(0, 80); if (!text) throw new Error("consigne vide");
        await save({ kind: "charge", e, text, fromW: curW, toW: curW + n - 1, reason: reason(i.raison) });
        return "Consigne ajoutée sur " + EXB[e].n + " pour " + plural(n, "semaine") + ".";
      } });
    if (typeof DRB !== "undefined") tools.push({ name: "conseiller_seance_terrain", description: "Conseille au client une séance terrain de son sport (schéma, distances, minuteur), affichée sur son écran Aujourd'hui pendant 1 à 4 semaines. Utilise un identifiant de la liste des séances terrain du contexte.",
      inputSchema: { type: "object", properties: { seance: { type: "string", description: "Identifiant de la séance terrain (ex. r_malcolm)" }, message: { type: "string", description: "Quand et comment la faire, 160 caractères maximum" }, semaines: { type: "number", description: "1 à 4" }, raison: { type: "string" } }, required: ["seance", "raison"] },
      async execute(i) {
        const id = String(i.seance || "").trim(); const d = DRB[id];
        const spo = sportOf(data.profile);
        if (!d) throw new Error("Identifiant inconnu. Séances disponibles : " + (spo ? spo.drills.join(", ") : Object.keys(DRB).join(", ")));
        const n = clamp(Math.round(num(i.semaines) || 1), 1, 4);
        await save({ kind: "terrain", drill: id, text: String(i.message || "").trim().slice(0, 160), fromW: curW, toW: curW + n - 1, reason: reason(i.raison) });
        return "Séance « " + d.n + " » conseillée pour " + plural(n, "semaine") + ".";
      } });
    tools.push({ name: "note_seance", description: "Affiche un mot du coach IA sur l'écran d'accueil du client pendant la semaine en cours (priorité de la semaine, rappel d'échauffement, conseil de récupération).",
      inputSchema: { type: "object", properties: { texte: { type: "string", description: "200 caractères maximum" }, raison: { type: "string" } }, required: ["texte"] },
      async execute(i) { const t = String(i.texte || "").trim().slice(0, 200); if (!t) throw new Error("texte vide"); await save({ kind: "note", text: t, fromW: curW, toW: curW, reason: reason(i.raison) }); return "Mot affiché pour la semaine " + curW + "."; } });
  }
  return tools;
}

/* ---------- conversation ---------- */
function chatMsgs(data) {
  return Object.keys(data.chat || {}).sort().flatMap((k) => ((data.chat[k] || {}).msgs || [])).sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
async function pushChat(src, data, msg, ensure) {
  const m = msg.at.slice(0, 7);
  const cur = ((data.chat && data.chat[m]) || { msgs: [] }).msgs || [];
  const key = (x) => x.r + "|" + x.at;
  const seen = new Set(cur.map(key));
  const add = [...(ensure || []).filter((x) => x && x.at && x.at.slice(0, 7) === m && !seen.has(key(x))), msg].filter((x) => !seen.has(key(x)));
  const msgs = [...cur, ...add].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-200);
  await src.saveChat(m, { msgs, updatedAt: nowISO() });
}
const QUICK_Q = ["Que manger ce soir avec ce qu'il me reste ?", "Comment s'est passée ma semaine ?", "J'ai une gêne au genou, que faire ?", "Un petit-déjeuner riche en protéines", "Quoi manger avant et après ma séance ?", "Je mange au restaurant ce soir, que choisir ?"];

function CoachChat({ data, src, plan, prog, stats, lib, settings, aiq, onClose }) {
  const ai = useAI();
  const toast = useToast();
  const conf = aiConf(settings, data);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null); // {text, ev:[]}
  const [err, setErr] = useState("");
  const ctlRef = useRef(null);
  const endRef = useRef(null);
  const msgs = chatMsgs(data);
  useEffect(() => { try { endRef.current && endRef.current.scrollIntoView({ block: "end" }); } catch (e) {} }, [msgs.length, live && live.text]);
  useEffect(() => () => { try { ctlRef.current && ctlRef.current.abort(); } catch (e) {} }, []);
  const send = async (q) => {
    const text = String(q ?? txt).trim();
    if (!text || busy || !ai.sample) return;
    if (aiq && aiq.left.q <= 0) { setErr(aiQuotaMsg(aiq, "q")); return; }
    setTxt(""); setErr(""); setBusy(true);
    const userMsg = { r: "u", t: text.slice(0, 2000), at: nowISO() };
    const before = src.get();
    const hist = chatMsgs(before).slice(-12).filter((m) => m.t && m.t.trim()).map((m) => ({ role: m.r === "u" ? "user" : "assistant", content: m.t }));
    try { await pushChat(src, before, userMsg); } catch (e) {}
    const dataNow = src.get();
    const events = [];
    setLive({ text: "", ev: [] });
    const ctl = new AbortController(); ctlRef.current = ctl;
    const head = aiRules(conf, dataNow, plan, ai) + "\n\n" + clientContext({ data: dataNow, plan, prog, stats: computeStats(dataNow, plan, prog, lib, todayISO()), lib }) + (ai.tools && conf.allow.subst ? "\n\n" + exerciseCatalog() : "") + "\n\nTâche : conversation. Réponds au dernier message du client.";
    const turns = [{ role: "user", content: head }, ...hist, { role: "user", content: text }];
    const tools = ai.tools ? makeTools({ data: dataNow, src, plan, prog, stats: computeStats(dataNow, plan, prog, lib, todayISO()), conf, onEvent: (l) => { events.push(l); setLive((x) => ({ ...(x || { text: "" }), ev: [...events] })); } }) : undefined;
    try {
      const r = await ai.sample(turns, { cache: false, signal: ctl.signal, tools, onText: ({ text: t }) => setLive((x) => ({ ...(x || {}), text: t, ev: [...events] })) });
      await pushChat(src, src.get(), { r: "a", t: r.text, at: nowISO(), ev: events.length ? events : undefined }, [userMsg]);
    } catch (e) {
      const keep = e && e.text;
      if (keep) { try { await pushChat(src, src.get(), { r: "a", t: keep, at: nowISO(), ev: events.length ? events : undefined, cut: true }, [userMsg]); } catch (x) {} }
      const m = aiErr(e); if (m) setErr(m);
    } finally { setLive(null); setBusy(false); ctlRef.current = null; }
  };
  const first = ((data.profile && data.profile.name) || "").split(" ")[0];
  return html`<div className="chat">
    <header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Retour">‹</button>
      <div><div className="eyebrow">Intelligence artificielle · disponible à toute heure</div><h2>Coach IA</h2></div></header>
    <p className="muted small">Tu échanges avec une intelligence artificielle (${AI_WHO}), pas avec Antoine. Ses réponses sont des repères d'entraînement, pas des avis médicaux ; Antoine voit vos échanges.</p>
    ${!ai.ready ? html`<p className="muted">Connexion…</p>` : !ai.sample || !conf.on ? html`<${Card} title="Coach IA indisponible"><p className="small">${!conf.on ? "Ton coach a désactivé le coach IA pour le moment." : "Le coach IA a besoin que l'application soit ouverte depuis ton compte Claude (même gratuit). Ouvre le lien reçu en étant connecté, puis reviens ici."}</p></${Card}>` : html`
    <div className="msgs" aria-live="polite">
      <div className="msg a"><p>${"Salut" + (first ? " " + first : "") + " ! Je suis le coach IA d'Antoine. Je connais ton programme, tes séances, tes bilans et tes repas : pose-moi tes questions sur l'entraînement, la récupération ou la nutrition. Je peux aussi ajuster ton programme, et Antoine voit tout ce que je change."}</p></div>
      ${msgs.slice(-40).map((m, i) => html`<div key=${i} className=${"msg " + (m.r === "u" ? "u" : "a") + (m.kind === "bilan" ? " bilan" : "")}>
        ${m.kind === "bilan" ? html`<div className="eyebrow">Analyse de ta semaine ${m.w || ""}</div>` : null}
        ${String(m.t).split(/\n{2,}/).map((para, k) => html`<p key=${k} data-notr="1">${para}</p>`)}
        ${m.ev && m.ev.length ? html`<div className="evs">${m.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}</div>`)}
      ${live ? html`<div className="msg a">${live.text ? String(live.text).split(/\n{2,}/).map((para, k) => html`<p key=${k}>${para}</p>`) : html`<p className="muted">Je regarde ton dossier…</p>`}
        ${live.ev && live.ev.length ? html`<div className="evs">${live.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}</div>` : null}
      <div ref=${endRef}></div>
    </div>
    ${err ? html`<p className="small warn-t">${err}</p>` : null}
    ${aiq ? html`<p className=${"small " + (aiq.left.q ? "muted" : "warn-t")} id="ai-left">${aiq.left.q ? "Questions au coach IA aujourd'hui : " + aiq.used.q + " sur " + aiq.lim.q + " (formule " + offerName(plan && plan.offer) + ")." : aiQuotaMsg(aiq, "q")}</p>` : null}
    ${!busy && msgs.length < 2 ? html`<div className="btnrow">${QUICK_Q.map((q) => html`<button key=${q} type="button" className="chipbtn" onClick=${() => send(q)}>${q}</button>`)}</div>` : null}
    <div className="composer">
      <textarea id="chat-in" rows="2" value=${txt} placeholder="Écris ta question…" onChange=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} disabled=${busy}></textarea>
      ${busy ? html`<${Btn} kind="ghost" onClick=${() => ctlRef.current && ctlRef.current.abort()}>Stop</${Btn}>` : html`<${Btn} onClick=${() => send()} disabled=${!txt.trim()}>Envoyer</${Btn}>`}
    </div>
    <p className="muted small">Le coach IA peut se tromper. Il ne remplace ni un médecin ni un diététicien. Antoine lit vos échanges.</p>`}
  </div>`;
}

/* ---------- analyse automatique du bilan hebdomadaire ---------- */
async function weeklyReview({ ai, src, plan, prog, lib, settings, w, onText, onEvent, signal }) {
  const data = src.get();
  const conf = aiConf(settings, data);
  const stats = computeStats(data, plan, prog, lib, todayISO());
  const events = [];
  const tools = ai.tools ? makeTools({ data, src, plan, prog, stats, conf, onEvent: (l) => { events.push(l); onEvent && onEvent([...events]); } }) : undefined;
  const prompt = aiRules(conf, data, plan, ai) + "\n\n" + clientContext({ data, plan, prog, stats, lib }) + (ai.tools && conf.allow.subst ? "\n\n" + exerciseCatalog() : "") +
    "\n\nTâche : bilan_hebdo. Le client vient d'envoyer son bilan de la semaine " + w + ". Analyse sa semaine (régularité, effort, charges, douleur, sommeil, énergie, poids et repas s'ils sont notés) en la comparant aux semaines précédentes. Applique si besoin un ou deux ajustements. Écris ensuite au client un message de 5 à 8 lignes : ce qui va bien (chiffres à l'appui), ce qui est à surveiller, ce que tu as ajusté et pourquoi, et sa priorité pour la semaine prochaine. Précise qu'Antoine lira aussi son bilan.";
  const r = await ai.sample(prompt, { cache: false, signal, tools, onText, system: true });
  await pushChat(src, src.get(), { r: "a", t: r.text, at: nowISO(), kind: "bilan", w, ev: events.length ? events : undefined });
  return { text: r.text, events };
}

/* ---------- brouillon de réponse pour le coach ---------- */
async function draftReply({ ai, data, plan, prog, lib, c, settings }) {
  const stats = computeStats(data, plan, prog, lib, todayISO());
  const conf = aiConf(settings, data);
  const prompt = "Tu aides Antoine Limousi, préparateur physique, à répondre au bilan hebdomadaire d'un de ses clients en ligne.\n\nSes consignes habituelles :\n" + conf.rules + "\n\n" + clientContext({ data, plan, prog, stats, lib }) +
    "\n\nBilan à traiter : semaine " + c.w + ".\n\nTâche : brouillon_reponse. Rédige le brouillon de la réponse d'Antoine, à la première personne, en tutoyant le client : 3 à 6 lignes, ton direct et encourageant, un retour précis sur les chiffres de la semaine, la réponse à sa question s'il en a posé une, et un conseil concret pour la semaine suivante. Pas de formule d'introduction générique, pas de signature. Si une douleur ou un signal médical apparaît, recommande d'alléger et de consulter si ça persiste.";
  const r = await ai.sample(prompt, { cache: false });
  return r.text.trim();
}

/* ---------- clients étrangers : l'IA traduit pour Antoine (il relit avant d'envoyer) ----------
   Côté coach seulement : rien n'est décompté des limites du client. */
const LANG_FR = { fr: "français", en: "anglais", es: "espagnol" };
function langFr(l) { return LANG_FR[l] || l || "français"; }
async function aiTranslate(ai, text, to) {
  const r = await ai.sample("Tâche : traduction. Traduis le texte placé entre les balises <texte> en " + langFr(to) + ", fidèlement : même sens, même ton, tutoiement gardé, mêmes retours à la ligne, sans rien ajouter ni commenter. Réponds uniquement avec la traduction.\n<texte>\n" + text + "\n</texte>", { cache: false, system: true });
  return String((r && r.text) || "").replace(/^\s*<texte>\s*/, "").replace(/\s*<\/texte>\s*$/, "").trim();
}
/* « Traduire en français » sous un texte écrit par un client étranger */
function TrLink({ text }) {
  const ai = useAI();
  const toast = useToast();
  const [t, setT] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!ai.sample || !String(text || "").trim()) return null;
  const go = async () => { setBusy(true); try { setT(await aiTranslate(ai, String(text), "fr")); } catch (e) { const m = aiErr(e); if (m) toast(m, "warn"); } finally { setBusy(false); } };
  return t ? html`<p className="small trad" data-notr="1"><b>Traduction (IA) :</b> ${t}</p>` : html`<button type="button" className="linkbtn small trbtn" onClick=${go} disabled=${busy}>${busy ? "Traduction…" : "Traduire en français"}</button>`;
}
/* « Traduire en anglais avant d'envoyer » sous la zone de réponse d'Antoine */
function TrSend({ text, setText, to, id }) {
  const ai = useAI();
  const toast = useToast();
  const [orig, setOrig] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!String(text || "").trim()) setOrig(""); }, [text]);
  if (!ai.sample || !to || to === "fr") return null;
  const go = async () => {
    const t = String(text || "").trim(); if (!t) return;
    setBusy(true);
    try { const x = await aiTranslate(ai, t, to); if (x) { setOrig(t); setText(x); } } catch (e) { const m = aiErr(e); if (m) toast(m, "warn"); } finally { setBusy(false); }
  };
  return html`<div className="trsend small"><button type="button" className="linkbtn" id=${id || null} onClick=${go} disabled=${busy || !String(text || "").trim()}>${busy ? "Traduction…" : "✦ Traduire en " + langFr(to) + " avant d'envoyer"}</button>
    <span className="muted"> Le client lit l'application en ${langFr(to)}.</span>${orig ? html`<span className="muted" data-notr="1"> Ton texte d'origine : « ${orig} »</span>` : null}</div>`;
}
