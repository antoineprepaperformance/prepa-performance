/* ===== Coach IA : accès à Claude, contexte du client, ajustements ===== */
let _aiP = null;
function getAI() {
  if (!_aiP) _aiP = (async () => {
    let s = null, images = false, tools = false, maxImages = 0;
    try { s = window.claude && typeof window.claude.use === "function" ? await window.claude.use("sample") : null; } catch (e) { s = null; }
    if (s) {
      try { const l = await s.limits(); images = !!(l && l.images); maxImages = images ? l.images.maxCount || 1 : 0; tools = !!(l && l.tools); } catch (e) {}
    }
    return { sample: s, images, tools, maxImages };
  })();
  return _aiP;
}
function useAI() {
  const [st, setSt] = useState({ ready: false, sample: null, images: false, tools: false, maxImages: 0 });
  useEffect(() => { let a = true; getAI().then((x) => { if (a) setSt({ ...x, ready: true }); }); return () => { a = false; }; }, []);
  return st;
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
  upstream_error: "Service momentanément indisponible : réessaie dans un instant.",
};
function aiErr(e) { if (e && e.code === "cancelled") return ""; return AI_ERR[e && e.code] || AI_ERR.upstream_error; }
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
function adjItems(entry, data) {
  const subs = activeAdj(data, "subst"), charges = activeAdj(data, "charge");
  return entry.s.items.map((it) => {
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
      const items = adjItems(e, data);
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
      const exp = expectedWeight(np, todayISO());
      const lastW = lastWeight(data);
      if (exp !== null) L.push("Poids attendu aujourd'hui selon le plan : " + fmtN(exp) + " kg" + (lastW ? " · dernier poids noté : " + fmtN(lastW.v) + " kg (" + fmtD(lastW.d) + ")" : ""));
    }
    const today = todayISO();
    const day = data.food[today];
    const tot = dayTotals(day);
    if (day && (day.meals || []).length) L.push("Aujourd'hui, repas notés : " + day.meals.map((m) => slotName(m.slot) + " « " + m.title + " »" + (np.mode !== "equilibre" ? " " + fmtN(m.kcal, 0) + " kcal / P " + fmtN(m.p, 0) + " g" : "")).join(" ; ") + (np.mode !== "equilibre" ? " — total " + fmtN(tot.kcal, 0) + " kcal, P " + fmtN(tot.p, 0) + " g, G " + fmtN(tot.c, 0) + " g, L " + fmtN(tot.f, 0) + " g" : ""));
    else L.push("Aujourd'hui : aucun repas noté pour l'instant.");
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
    "Tu es « Coach IA », l'assistant d'Antoine Limousi, préparateur physique (Antoine Prépa Performance, Bordeaux), intégré à l'application de suivi de ses clients. Tu réponds directement au client, en français, en le tutoyant, de façon chaleureuse, concrète et brève (4 à 10 lignes en général ; une liste ou un menu seulement si c'est demandé). Pas de titres Markdown.",
    "",
    "Méthode à chaque réponse :",
    "1. Relis le contexte ci-dessous (séances, charges, douleurs, bilans, tests, repas, objectif) et appuie ta réponse sur ces données, en citant les chiffres utiles.",
    canDo.length ? "2. Si les données ou la demande du client justifient un changement, tu peux " + canDo.join(", ") + ". Fais au plus deux ajustements à la fois, toujours avec une raison tirée des données, puis explique au client ce que tu as changé." : "2. Tu ne peux rien modifier toi-même : propose les changements utiles et préviens Antoine avec signaler_coach si c'est important.",
    "3. Si la question dépasse ton rôle ou si la situation est préoccupante, préviens Antoine avec signaler_coach" + (ai.tools ? "" : " (indique au client d'en parler à Antoine)") + ".",
    "",
    "Règles de sécurité, non négociables :",
    "- Douleur à 4/10 ou plus, douleur qui augmente, gonflement, douleur dans la poitrine, malaise ou essoufflement anormal : conseille d'arrêter l'exercice en cause, remplace-le ou allège, préviens Antoine (urgence haute) et conseille de consulter un médecin ou un kiné si ça persiste plus de 48 h. Jamais de diagnostic.",
    "- Nutrition : jamais moins de " + floor + " kcal par jour, déficit de 25 % au maximum, perte de 1 % du poids par semaine au maximum, protéines entre 1,2 et 2,4 g par kg. Pas de jeûne prolongé, pas de suppression d'un groupe d'aliments, jamais de « compensation » (sauter un repas ou faire du sport pour « éliminer » un écart).",
    "- Compléments : seulement protéine en poudre ou créatine si c'est pertinent, rien d'autre ; avis médical si un traitement est en cours.",
    "- Maladie (diabète, cœur, reins, digestion…), grossesse, allaitement, allergie sévère ou traitement : reste général, renvoie vers le médecin ou un diététicien et préviens Antoine.",
    "- Si le client exprime un rapport difficile à la nourriture ou à son corps (peur de manger, forte culpabilité, crises, vomissements, restriction sévère) ou une détresse : aucun chiffre, réponds avec bienveillance, encourage-le à en parler à son médecin et préviens Antoine.",
    "- Tu ne changes jamais la formule, la durée, le prix ni le programme choisi : c'est le rôle d'Antoine.",
    "- Les calories des repas sont des estimations ; si tu ne sais pas, dis-le.",
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
  const blockIds = () => { if (!prog) return []; const b = blockOf(prog, curW); const ids = new Set(); b.sessions.forEach((s) => adjItems({ s, w: curW, sid: s.id }, data).forEach((it) => ids.add(it.e))); return [...ids]; };
  const tools = [];
  tools.push({ name: "signaler_coach", description: "Prévient Antoine (le coach humain) avec un message court : douleur, question médicale, demande hors de ton rôle, baisse de motivation, changement à valider. Renvoie une confirmation.",
    inputSchema: { type: "object", properties: { message: { type: "string", description: "Ce qu'Antoine doit savoir, en une ou deux phrases" }, urgence: { type: "string", enum: ["normale", "haute"] } }, required: ["message"] },
    async execute(i) { const m = String(i.message || "").trim(); if (!m) throw new Error("message vide"); await save({ kind: "alerte", text: m.slice(0, 400), urgence: i.urgence === "haute" ? "haute" : "normale" }); return "Antoine est prévenu."; } });
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

function CoachChat({ data, src, plan, prog, stats, lib, settings, onClose }) {
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
    <p className="muted small">Tu échanges avec une intelligence artificielle (Claude, d'Anthropic), pas avec Antoine. Ses réponses sont des repères d'entraînement, pas des avis médicaux ; Antoine voit vos échanges.</p>
    ${!ai.ready ? html`<p className="muted">Connexion…</p>` : !ai.sample || !conf.on ? html`<${Card} title="Coach IA indisponible"><p className="small">${!conf.on ? "Ton coach a désactivé le coach IA pour le moment." : "Le coach IA a besoin que l'application soit ouverte depuis ton compte Claude (même gratuit). Ouvre le lien reçu en étant connecté, puis reviens ici."}</p></${Card}>` : html`
    <div className="msgs" aria-live="polite">
      <div className="msg a"><p>${"Salut" + (first ? " " + first : "") + " ! Je suis le coach IA d'Antoine. Je connais ton programme, tes séances, tes bilans et tes repas : pose-moi tes questions sur l'entraînement, la récupération ou la nutrition. Je peux aussi ajuster ton programme, et Antoine voit tout ce que je change."}</p></div>
      ${msgs.slice(-40).map((m, i) => html`<div key=${i} className=${"msg " + (m.r === "u" ? "u" : "a") + (m.kind === "bilan" ? " bilan" : "")}>
        ${m.kind === "bilan" ? html`<div className="eyebrow">Analyse de ta semaine ${m.w || ""}</div>` : null}
        ${String(m.t).split(/\n{2,}/).map((para, k) => html`<p key=${k}>${para}</p>`)}
        ${m.ev && m.ev.length ? html`<div className="evs">${m.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}</div>`)}
      ${live ? html`<div className="msg a">${live.text ? String(live.text).split(/\n{2,}/).map((para, k) => html`<p key=${k}>${para}</p>`) : html`<p className="muted">Je regarde ton dossier…</p>`}
        ${live.ev && live.ev.length ? html`<div className="evs">${live.ev.map((x, k) => html`<span key=${k} className="ev">✓ ${x}</span>`)}</div>` : null}</div>` : null}
      <div ref=${endRef}></div>
    </div>
    ${err ? html`<p className="small warn-t">${err}</p>` : null}
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
  const r = await ai.sample(prompt, { cache: false, signal, tools, onText });
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
