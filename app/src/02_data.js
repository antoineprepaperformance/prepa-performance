/* ===== Sources de données : base partagée, appareil, exemple ===== */
const LS_KEY = "app_local_v1";
function lsGet(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

function emitter() {
  const subs = new Set();
  return { on(f) { subs.add(f); return () => subs.delete(f); }, emit(v) { subs.forEach((f) => { try { f(v); } catch (e) { console.error(e); } }); } };
}
const _queues = {};
function qwrite(path, fn) {
  const prev = _queues[path] || Promise.resolve();
  const p = prev.catch(() => {}).then(() => dbWrite(path, fn));
  _queues[path] = p;
  return p;
}
/* ---------- cycles : un nouveau programme repart à la semaine 1 sans mélanger l'historique ---------- */
function cycOf(plan) { return Math.max(1, Number(plan && plan.cycle) || 1); }
function cpre(plan) { const c = cycOf(plan); return c > 1 ? "c" + c + "_" : ""; }
function scopeMap(m, pre) {
  const o = {};
  if (!m) return o;
  for (const [k, v] of Object.entries(m)) { if (pre) { if (k.startsWith(pre)) o[k.slice(pre.length)] = v; } else if (!/^c\d+_/.test(k)) o[k] = v; }
  return o;
}
function scoped(raw) {
  const pre = cpre(raw.plan);
  return { ...raw, logs: scopeMap(raw.logs, pre), checkins: scopeMap(raw.checkins, pre), tests: scopeMap(raw.tests, pre), replies: scopeMap(raw.replies, pre), cycle: cycOf(raw.plan),
    allLogs: raw.logs || {} };
}
function emptyData() { return { profile: null, plan: null, replies: {}, logs: {}, checkins: {}, tests: {}, habits: {}, food: {}, nutri: {}, ai: {}, chat: {}, media: {}, orders: {}, videos: {}, sante: {}, activites: {}, libres: {}, recettes: {}, messages: {}, msgseen: null, ready: false }; }

/* ---------- base partagée (capability db) ---------- */
function dbSource(db, cid) {
  let raw = emptyData();
  let data = scoped(raw);
  const em = emitter();
  const unsubs = [];
  const need = { profile: 1, plan: 1, replies: 1, logs: 1, checkins: 1, tests: 1, habits: 1, food: 1, nutri: 1, ai: 1, chat: 1, media: 1, orders: 1, videos: 1, sante: 1, activites: 1, libres: 1, recettes: 1, messages: 1, msgseen: 1 };
  const got = {};
  const push = (k, v) => { raw = { ...raw, [k]: v }; got[k] = 1; raw.ready = Object.keys(need).every((x) => got[x]); data = scoped(raw); em.emit(data); };
  const pre = () => cpre(raw.plan);
  const docSub = (path, k, map) => {
    try {
      unsubs.push(db.doc(path).onSnapshot((s) => push(k, map ? map(s.exists ? s.data() : null) : (s.exists ? s.data() : null)),
        () => push(k, map ? map(null) : null)));
    } catch (e) { push(k, null); }
  };
  const colSub = (path, k, query) => {
    try {
      const ref = query ? query(db.collection(path)) : db.collection(path);
      unsubs.push(ref.onSnapshot((s) => { const o = {}; s.docs.forEach((d) => { o[d.id] = d.data(); }); push(k, o); },
        () => push(k, {})));
    } catch (e) { push(k, {}); }
  };
  const base = "clients/" + cid;
  docSub(base, "profile");
  docSub("plans/" + cid, "plan");
  docSub("replies/" + cid, "replies", (d) => d || {});
  colSub(base + "/logs", "logs"); colSub(base + "/checkins", "checkins"); colSub(base + "/tests", "tests"); colSub(base + "/habits", "habits");
  colSub(base + "/food", "food", (q) => (q.where ? q.where("d", ">=", addDays(todayISO(), -60)) : q)); colSub(base + "/nutri", "nutri"); colSub(base + "/ai", "ai"); colSub(base + "/chat", "chat"); colSub(base + "/media", "media"); colSub(base + "/orders", "orders");
  colSub(base + "/videos", "videos"); colSub(base + "/sante", "sante", (q) => (q.where ? q.where("d", ">=", addDays(todayISO(), -120)) : q)); colSub(base + "/activites", "activites"); colSub(base + "/libres", "libres"); colSub(base + "/recettes", "recettes");
  /* messagerie avec le coach : une année de messages, et la date de dernière lecture côté client */
  colSub(base + "/messages", "messages", (q) => (q.where ? q.where("at", ">=", new Date(Date.now() - 365 * 86400000).toISOString()) : q));
  docSub(base + "/msgstate/seen", "msgseen");

  async function writeSummary(next) {
    const prof = next.profile || data.profile;
    if (!prof) return;
    const sum = summarize(next);
    await qwrite(base, () => db.doc(base).set({ ...clone(prof), sum }));
  }
  return {
    mode: "db", cid,
    get: () => data, on: (f) => em.on(f),
    close: () => unsubs.forEach((u) => { try { u(); } catch (e) {} }),
    async setProfile(p) { await qwrite(base, () => db.doc(base).set(clone(p))); },
    async saveLog(key, log, opts) {
      const k = pre() + key;
      await qwrite(base + "/logs/" + k, () => db.doc(base + "/logs/" + k).set(clone({ ...log, cycle: cycOf(raw.plan) })));
      if (!opts || !opts.noSummary) await writeSummary({ ...data, logs: { ...data.logs, [key]: log } });
    },
    async deleteLog(key) {
      const k = pre() + key;
      await qwrite(base + "/logs/" + k, () => db.doc(base + "/logs/" + k).delete());
      const logs = { ...data.logs }; delete logs[key];
      await writeSummary({ ...data, logs });
    },
    async saveCheckin(w, c, opts) {
      const k = pre() + "w" + w;
      await qwrite(base + "/checkins/" + k, () => db.doc(base + "/checkins/" + k).set(clone(c)));
      if (!opts || !opts.noSummary) await writeSummary({ ...data, checkins: { ...data.checkins, ["w" + w]: c } });
    },
    async saveTest(id, t) { const k = pre() + id; await qwrite(base + "/tests/" + k, () => db.doc(base + "/tests/" + k).set(clone(t))); },
    async saveOrder(id, o) { await qwrite(base + "/orders/" + id, () => db.doc(base + "/orders/" + id).set(clone(o))); },
    async saveHabits(month, h) { await qwrite(base + "/habits/" + month, () => db.doc(base + "/habits/" + month).set(clone(h))); },
    async setPlan(p) { await qwrite("plans/" + cid, () => db.doc("plans/" + cid).set(clone(p))); },
    async saveNutri(p) { await qwrite(base + "/nutri/plan", () => db.doc(base + "/nutri/plan").set(clone(p))); },
    async saveFood(date, doc) { await qwrite(base + "/food/" + date, () => db.doc(base + "/food/" + date).set(clone({ ...doc, d: date }))); },
    async saveMedia(id, doc) { await qwrite(base + "/media/" + id, () => (doc ? db.doc(base + "/media/" + id).set(clone(doc)) : db.doc(base + "/media/" + id).delete())); },
    async saveAdjust(id, a) {
      await qwrite(base + "/ai/" + id, () => db.doc(base + "/ai/" + id).set(clone(a)));
      await writeSummary({ ...data, ai: { ...data.ai, [id]: a } });
    },
    async saveChat(month, doc) { await qwrite(base + "/chat/" + month, () => db.doc(base + "/chat/" + month).set(clone(doc))); },
    async saveVideo(id, doc) { await qwrite(base + "/videos/" + id, () => (doc ? db.doc(base + "/videos/" + id).set(clone(doc)) : db.doc(base + "/videos/" + id).delete())); await writeSummary({ ...data, videos: { ...data.videos, [id]: doc || undefined } }); },
    async saveSante(date, doc) { await qwrite(base + "/sante/" + date, () => (doc ? db.doc(base + "/sante/" + date).set(clone({ ...doc, d: date })) : db.doc(base + "/sante/" + date).delete())); },
    async saveActivite(id, doc) { await qwrite(base + "/activites/" + id, () => (doc ? db.doc(base + "/activites/" + id).set(clone(doc)) : db.doc(base + "/activites/" + id).delete())); },
    async saveLibre(id, doc) { await qwrite(base + "/libres/" + id, () => (doc ? db.doc(base + "/libres/" + id).set(clone(doc)) : db.doc(base + "/libres/" + id).delete())); },
    async saveRecette(id, doc) { await qwrite(base + "/recettes/" + id, () => (doc ? db.doc(base + "/recettes/" + id).set(clone(doc)) : db.doc(base + "/recettes/" + id).delete())); },
    async setReply(w, text) {
      const next = { ...(raw.replies || {}), [pre() + "w" + w]: { text, at: nowISO() } };
      await qwrite("replies/" + cid, () => db.doc("replies/" + cid).set(next));
    },
    async refreshSummary() { await writeSummary(data); },
    /* messagerie : le message du client met à jour son résumé (le coach voit qu'il y a du nouveau) */
    async sendMessage(id, m) {
      await qwrite(base + "/messages/" + id, () => db.doc(base + "/messages/" + id).set(clone(m)));
      if (m.from === "client") await writeSummary({ ...data, messages: { ...(data.messages || {}), [id]: m } });
    },
    async setMsgSeen(at) { await qwrite(base + "/msgstate/seen", () => db.doc(base + "/msgstate/seen").set({ at })); },
  };
}

/* ---------- appareil (localStorage) ---------- */
function localSource(initial) {
  let store = initial || lsGet(LS_KEY) || null;
  let data = { ...emptyData(), ...(store || {}), ready: true };
  let view = scoped(data);
  const em = emitter();
  const persist = () => { const ok = lsSet(LS_KEY, { ...data, ready: undefined }); data = { ...data, saveFailed: !ok }; view = scoped(data); em.emit(view); };
  const set = (k, v) => { data = { ...data, [k]: v }; persist(); };
  const pre = () => cpre(data.plan);
  return {
    mode: "local", get cid() { return data.cid; },
    get: () => view, on: (f) => em.on(f), close: () => {},
    async setProfile(p) { set("profile", clone(p)); },
    async saveLog(key, log) { set("logs", { ...data.logs, [pre() + key]: clone({ ...log, cycle: cycOf(data.plan) }) }); },
    async deleteLog(key) { const l = { ...data.logs }; delete l[pre() + key]; set("logs", l); },
    async saveCheckin(w, c) { set("checkins", { ...data.checkins, [pre() + "w" + w]: clone(c) }); },
    async saveTest(id, t) { set("tests", { ...data.tests, [pre() + id]: clone(t) }); },
    async saveOrder(id, o) { set("orders", { ...(data.orders || {}), [id]: clone(o) }); },
    async saveHabits(m, h) { set("habits", { ...data.habits, [m]: clone(h) }); },
    async setPlan(p) { set("plan", clone(p)); },
    async saveNutri(p) { set("nutri", { ...data.nutri, plan: clone(p) }); },
    async saveFood(date, doc) { set("food", { ...data.food, [date]: clone(doc) }); },
    async saveMedia(id, doc) { const m = { ...data.media }; if (doc) m[id] = clone(doc); else delete m[id]; set("media", m); },
    async saveAdjust(id, a) { set("ai", { ...data.ai, [id]: clone(a) }); },
    async saveChat(month, doc) { set("chat", { ...data.chat, [month]: clone(doc) }); },
    async saveVideo(id, doc) { const m = { ...(data.videos || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; set("videos", m); },
    async saveSante(date, doc) { const m = { ...(data.sante || {}) }; if (doc) m[date] = clone({ ...doc, d: date }); else delete m[date]; set("sante", m); },
    async saveActivite(id, doc) { const m = { ...(data.activites || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; set("activites", m); },
    async saveLibre(id, doc) { const m = { ...(data.libres || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; set("libres", m); },
    async saveRecette(id, doc) { const m = { ...(data.recettes || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; set("recettes", m); },
    async setReply() {},
    applyCode(code) {
      data = { ...data, cid: code.cid || data.cid, plan: code.plan || data.plan, lib: { ...(data.lib || {}), ...(code.lib || {}) },
        exo: code.exo || data.exo || {}, coach: code.coach || data.coach || null, replies: { ...(data.replies || {}), ...(code.replies || {}) },
        coachAi: code.ai || data.coachAi || null, ai: { ...(data.ai || {}), ...(code.aiSeen ? Object.fromEntries(Object.entries(data.ai || {}).map(([k, v]) => [k, code.aiSeen[k] ? { ...v, ...code.aiSeen[k] } : v])) : {}) },
        profile: data.profile || { name: code.name || "", createdAt: nowISO() } };
      persist();
    },
    reset() { lsDel(LS_KEY); data = { ...emptyData(), ready: true }; view = scoped(data); em.emit(view); },
    package() {
      return "APP1." + b64enc({ v: 1, kind: "client", cid: data.cid || null, profile: data.profile, logs: data.logs, checkins: data.checkins,
        tests: data.tests, habits: data.habits, food: data.food, nutri: data.nutri, ai: data.ai, chat: data.chat, sante: data.sante, activites: data.activites, libres: data.libres, recettes: data.recettes, at: nowISO() });
    },
  };
}

/* ---------- exemple en mémoire ---------- */
function memSource(seed, mode) {
  let data = { ...emptyData(), ...clone(seed), ready: true };
  let view = scoped(data);
  const em = emitter();
  const emit = () => { view = scoped(data); em.emit(view); };
  const set = (k, v) => { data = { ...data, [k]: v }; emit(); };
  const pre = () => cpre(data.plan);
  return {
    mode: mode || "demo", cid: seed.cid,
    get: () => view, on: (f) => em.on(f), close: () => {},
    async setProfile(p) { set("profile", clone(p)); },
    async saveLog(key, log) { const logs = { ...data.logs, [pre() + key]: clone({ ...log, cycle: cycOf(data.plan) }) }; data = { ...data, logs }; data = { ...data, profile: { ...data.profile, sum: summarize(scoped(data)) } }; emit(); },
    async deleteLog(key) { const l = { ...data.logs }; delete l[pre() + key]; set("logs", l); },
    async saveCheckin(w, c) { const checkins = { ...data.checkins, [pre() + "w" + w]: clone(c) }; data = { ...data, checkins }; data = { ...data, profile: { ...data.profile, sum: summarize(scoped(data)) } }; emit(); },
    async saveTest(id, t) { set("tests", { ...data.tests, [pre() + id]: clone(t) }); },
    async saveOrder(id, o) { set("orders", { ...(data.orders || {}), [id]: clone(o) }); },
    async saveHabits(m, h) { set("habits", { ...data.habits, [m]: clone(h) }); },
    async setPlan(p) { set("plan", clone(p)); },
    async saveNutri(p) { set("nutri", { ...data.nutri, plan: clone(p) }); },
    async saveFood(date, doc) { set("food", { ...data.food, [date]: clone(doc) }); },
    async saveMedia(id, doc) { const m = { ...data.media }; if (doc) m[id] = clone(doc); else delete m[id]; set("media", m); },
    async saveAdjust(id, a) { const ai = { ...data.ai, [id]: clone(a) }; data = { ...data, ai }; data = { ...data, profile: { ...data.profile, sum: summarize(scoped(data)) } }; emit(); },
    async saveChat(month, doc) { set("chat", { ...data.chat, [month]: clone(doc) }); },
    async saveVideo(id, doc) { const m = { ...(data.videos || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; data = { ...data, videos: m }; data = { ...data, profile: { ...data.profile, sum: summarize(scoped(data)) } }; emit(); },
    async saveSante(date, doc) { const m = { ...(data.sante || {}) }; if (doc) m[date] = clone({ ...doc, d: date }); else delete m[date]; set("sante", m); },
    async saveActivite(id, doc) { const m = { ...(data.activites || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; set("activites", m); },
    async saveLibre(id, doc) { const m = { ...(data.libres || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; set("libres", m); },
    async saveRecette(id, doc) { const m = { ...(data.recettes || {}) }; if (doc) m[id] = clone(doc); else delete m[id]; set("recettes", m); },
    async setReply(w, text) { set("replies", { ...(data.replies || {}), [pre() + "w" + w]: { text, at: nowISO() } }); },
    async sendMessage(id, m) { const messages = { ...(data.messages || {}), [id]: clone(m) }; data = { ...data, messages }; data = { ...data, profile: { ...data.profile, sum: summarize(scoped(data)) } }; emit(); },
    async setMsgSeen(at) { set("msgseen", { at }); },
  };
}

function useSource(src) {
  const [data, setData] = useState(() => (src ? src.get() : emptyData()));
  useEffect(() => { if (!src) return; setData(src.get()); return src.on(setData); }, [src]);
  return data;
}

/* ---------- abonnements côté coach ---------- */
function useCol(db, path, rev) {
  const [state, setState] = useState({ items: {}, ready: !db, err: null });
  useEffect(() => {
    if (!db) return;
    let u = null;
    try {
      u = db.collection(path).onSnapshot((s) => { const o = {}; s.docs.forEach((d) => { o[d.id] = d.data(); }); setState({ items: o, ready: true, err: null }); },
        (e) => { if (dbBroken(e)) { try { window.dispatchEvent(new CustomEvent("db-broken", { detail: { code: String(e.code || "") } })); } catch (x) {} } setState((x) => ({ ...x, ready: true, err: (e && e.code) || "error" })); });
    } catch (e) { setState((x) => ({ ...x, ready: true, err: (e && e.code) || "error" })); }
    return () => { try { u && u(); } catch (e) {} };
  }, [db, path, rev]);
  return state;
}
function useDocData(db, path) {
  const [state, setState] = useState({ data: null, ready: !db });
  useEffect(() => {
    if (!db) return;
    let u = null;
    try { u = db.doc(path).onSnapshot((s) => setState({ data: s.exists ? s.data() : null, ready: true }), () => setState((x) => ({ ...x, ready: true }))); }
    catch (e) { setState((x) => ({ ...x, ready: true })); }
    return () => { try { u && u(); } catch (e) {} };
  }, [db, path]);
  return state;
}
/* une écriture non confirmée par le serveur au bout de 25 s est signalée (elle reste en file d'attente hors ligne) */
function withTimeout(p, ms) {
  let t = null;
  return Promise.race([Promise.resolve(p).finally(() => clearTimeout(t)), new Promise((_, rej) => { t = setTimeout(() => { const e = new Error("timeout"); e.code = "timeout"; rej(e); }, ms); })]);
}
/* base locale du navigateur cassée (Safari après une mise en veille, onglets multiples) : seul un rechargement la répare */
function dbBroken(e) {
  const c = String((e && e.code) || "").replace(/^firestore\//, ""), m = String((e && e.message) || "");
  return c === "internal" || c === "data-loss" || /IndexedDB|INTERNAL ASSERTION|persistence layer|client has already been terminated/i.test(m);
}
/* écriture du coach : délai de réponse, nouveau jeton puis nouvel essai si les règles refusent (adresse confirmée entre-temps) */
async function dbWrite(path, run) {
  const go = () => withTimeout(Promise.resolve().then(run), window.__WRITE_TIMEOUT || 25000);
  try { return await go(); }
  catch (e) {
    const c = String((e && e.code) || "").replace(/^firestore\//, "");
    const u = window.IS_SITE && window.SITE && window.SITE.auth && window.SITE.auth.currentUser;
    /* site hors ligne : l'écriture reste en file d'attente dans le navigateur et part au retour du réseau */
    if (c === "timeout" && window.IS_SITE && navigator.onLine === false) { try { window.dispatchEvent(new Event("db-queued")); } catch (x) {} return; }
    if (c === "permission-denied" && u) { try { await u.getIdToken(true); } catch (x) { throw e; } return await go(); }
    if (dbBroken(e)) { try { window.dispatchEvent(new CustomEvent("db-broken", { detail: { code: c, message: String((e && e.message) || "").slice(0, 200) } })); } catch (x) {} }
    throw e;
  }
}
async function dbSet(db, path, v) { return qwrite(path, () => db.doc(path).set(clone(v))); }
async function dbDel(db, path) { return qwrite(path, () => db.doc(path).delete()); }
/* raison lisible d'un échec d'écriture, à ajouter au message */
function errWhy(e, coach) {
  const c = String((e && e.code) || "").replace(/^firestore\//, "");
  const site = !!window.IS_SITE;
  if (c === "permission-denied") return site && coach ? " : refusé par les règles de sécurité Firestore (voir l'encadré rouge en haut de ton espace)." : " : accès refusé.";
  if (dbBroken(e)) return " : la connexion à la base s'est interrompue dans ce navigateur. Recharge la page (Cmd + R ou F5), puis réessaie.";
  if (c === "timeout" || c === "unavailable" || c === "deadline-exceeded")
    return site ? " : la base ne répond pas. Vérifie ta connexion internet (et qu'aucun bloqueur de contenu ne bloque firestore.googleapis.com), recharge la page, puis réessaie."
      : " : Claude n'a pas confirmé l'enregistrement. Recharge la page et ouvre l'application depuis claude.ai dans ton navigateur, puis réessaie.";
  if (c === "unauthenticated") return " : ta session a expiré, reconnecte-toi.";
  if (c === "quota_exceeded" || c === "resource-exhausted" || c === "resource_exhausted") return " : limite de la base atteinte, réessaie plus tard.";
  if (c === "not_granted" || c === "capability_disabled" || c === "capability_removed" || c === "revoked") return " : l'enregistrement n'est pas autorisé dans cette vue (ouvre l'application depuis claude.ai dans ton navigateur).";
  if (c === "invalid-argument" || c === "invalid_argument" || c === "transform_error") return " : donnée refusée par la base (" + ((e && e.message) || c).slice(0, 120) + ").";
  const m = String((e && e.message) || "").slice(0, 140);
  return c || m ? " (" + [c, m].filter(Boolean).join(" : ") + ")." : ".";
}
/* droit à l'effacement : supprime toutes les données d'un client */
async function deleteClient(db, cid) {
  const base = "clients/" + cid;
  for (const sub of ["logs", "checkins", "tests", "habits", "food", "nutri", "ai", "chat", "media", "orders", "videos", "sante", "activites", "libres", "recettes", "messages", "msgstate"]) {
    try { const s = await db.collection(base + "/" + sub).get(); for (const doc of s.docs) await dbDel(db, base + "/" + sub + "/" + doc.id); } catch (e) {}
  }
  for (const p of ["plans/" + cid, "replies/" + cid, "coachnotes/" + cid, base]) { try { await dbDel(db, p); } catch (e) {} }
}

/* ---------- import d'un envoi client (côté coach) ---------- */
async function importPackage(db, text) {
  const raw = String(text || "").trim();
  const m = raw.match(/APP1\.([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error("Ce texte ne contient pas d'envoi client. Il commence normalement par « APP1. ».");
  const pkg = b64dec(m[1]);
  if (!pkg || pkg.kind !== "client") throw new Error("Envoi illisible.");
  const cid = pkg.cid || rid("m_");
  const base = "clients/" + cid;
  const prev = await db.doc(base).get();
  const prof = { ...(prev.exists ? prev.data() : {}), ...(pkg.profile || {}), local: true };
  const all = { logs: pkg.logs || {}, checkins: pkg.checkins || {}, tests: pkg.tests || {}, habits: pkg.habits || {} };
  const extra = { food: pkg.food || {}, nutri: pkg.nutri || {}, ai: pkg.ai || {}, chat: pkg.chat || {}, sante: pkg.sante || {}, activites: pkg.activites || {}, libres: pkg.libres || {}, recettes: pkg.recettes || {} };
  for (const [k, v] of Object.entries(all.logs)) await dbSet(db, base + "/logs/" + k, v);
  for (const [k, v] of Object.entries(all.checkins)) await dbSet(db, base + "/checkins/" + k, v);
  for (const [k, v] of Object.entries(all.tests)) await dbSet(db, base + "/tests/" + k, v);
  for (const [k, v] of Object.entries(all.habits)) await dbSet(db, base + "/habits/" + k, v);
  for (const sub of ["food", "nutri", "chat", "sante", "activites", "libres", "recettes"]) for (const [k, v] of Object.entries(extra[sub])) if (v) await dbSet(db, base + "/" + sub + "/" + k, v);
  for (const [k, v] of Object.entries(extra.ai)) {
    if (!v) continue;
    let prev = null;
    try { const s = await db.doc(base + "/ai/" + k).get(); prev = s.exists ? s.data() : null; } catch (e) {}
    const merged = prev ? { ...v, seen: !!(prev.seen || v.seen), status: prev.status === "annule" ? "annule" : v.status } : v;
    extra.ai[k] = merged;
    await dbSet(db, base + "/ai/" + k, merged);
  }
  Object.assign(all, { ai: extra.ai });
  prof.sum = summarize(all);
  prof.importedAt = nowISO();
  await dbSet(db, base, prof);
  return { cid, name: prof.name || "Client", counts: Object.fromEntries(Object.entries(all).map(([k, v]) => [k, Object.keys(v).length])) };
}
function accessCode({ cid, profile, plan, lib, exo, coach, replies, ai, aiData }) {
  const libOut = {};
  if (plan && lib) {
    if (lib[plan.programId]) libOut[plan.programId] = lib[plan.programId];
    (plan.extra || []).forEach((x) => { if (lib[x.sid]) libOut[x.sid] = lib[x.sid]; });
  }
  const aiSeen = aiData ? Object.fromEntries(Object.entries(aiData).filter(([, a]) => a && (a.seen || a.status === "annule")).map(([k, a]) => [k, { seen: !!a.seen, status: a.status }])) : null;
  return "APPCODE1." + b64enc({ v: 1, kind: "code", cid, name: profile && profile.name || "", plan, lib: libOut, exo: exo || {}, coach, replies: replies || {}, ai: ai || null, aiSeen });
}
function readCode(text) {
  const m = String(text || "").trim().match(/APPCODE1\.([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error("Ce texte ne contient pas de code d'accès. Il commence par « APPCODE1. ».");
  const c = b64dec(m[1]);
  if (!c || c.kind !== "code") throw new Error("Code d'accès illisible.");
  return c;
}

/* ---------- monde d'exemple (aperçu, jamais enregistré) ---------- */
function demoWorld() {
  const today = todayISO();
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  function mkLogs(prog, plan, uptoWeek, skip, painLast, loadStart) {
    const logs = {};
    for (let w = 1; w <= uptoWeek; w++) {
      const ss = weekSessions(prog, plan, w, {});
      ss.forEach((x, i) => {
        if (skip.includes(x.key)) return;
        if (w === uptoWeek && i > 0) return;
        const wib = ((w - 1) % 4) + 1;
        const date = addDays(plan.start, (w - 1) * 7 + i * 2 + 1);
        if (diffDays(date, today) < 0) return;
        const items = x.s.items.map((it) => {
          const d = doseOf(it, wib);
          if (!d.load) return { e: it.e, done: true };
          const kgBase = (loadStart[it.e] || 20) * (1 + 0.025 * (w - 1));
          const reps = parseInt(String(d.reps), 10) || 8;
          return { e: it.e, done: true, sets: Array.from({ length: d.sets }, () => ({ kg: Math.round(kgBase / 2.5) * 2.5, reps })) };
        });
        const rpe = clamp(Math.round(5 + wib + rnd() * 1.5 - (wib === 4 ? 4 : 0)), 3, 9);
        const duree = 55 + Math.round(rnd() * 15);
        const douleur = w === uptoWeek && painLast ? painLast : Math.round(rnd() * 1.4);
        logs[x.key] = { key: x.key, w, sid: x.sid, date, title: x.s.t, items, rpe, duree, load: rpe * duree, douleur, zone: douleur >= 3 ? "Genou gauche" : "", comment: "" };
      });
    }
    return logs;
  }
  function mkCheckins(uptoWeek, start, f) {
    const o = {};
    for (let w = 1; w <= uptoWeek; w++) o["w" + w] = { w, at: addDays(start, w * 7 - 1) + "T19:00:00.000Z", ...f(w) };
    return o;
  }
  const W = {};
  const meal = (slot, title, items, verdict, comment, src) => {
    const its = items.map(([n, g, kcal, p, c, f]) => ({ n, g, kcal, p, c, f }));
    const t = its.reduce((s, x) => ({ kcal: s.kcal + x.kcal, p: s.p + x.p, c: s.c + x.c, f: s.f + x.f }), { kcal: 0, p: 0, c: 0, f: 0 });
    return { id: rid("m"), slot, at: nowISO(), src: src || "photo", title, items: its, kcal: t.kcal, p: t.p, c: t.c, f: t.f, verdict: verdict || "bon", comment: comment || "" };
  };
  const MEALS = {
    pdj: () => meal("matin", "Porridge, banane et skyr", [["Flocons d'avoine", 60, 225, 8, 36, 4], ["Lait demi-écrémé", 200, 92, 6.5, 9.6, 3.2], ["Banane", 110, 99, 1.2, 22, 0.3], ["Skyr nature", 150, 96, 16.5, 6, 0.3]], "bon", "Bon départ : des glucides pour l'énergie et des protéines.", "photo"),
    dej: () => meal("midi", "Poulet, riz et haricots verts", [["Blanc de poulet", 150, 165, 35, 0, 3], ["Riz basmati cuit", 180, 230, 5, 50, 1], ["Haricots verts", 150, 45, 3, 7, 0.3], ["Huile d'olive", 10, 90, 0, 0, 10]], "bon", "Assiette complète, idéale pour ta récupération.", "photo"),
    col: () => meal("collation", "Pomme et amandes", [["Pomme", 150, 78, 0.4, 18, 0.3], ["Amandes", 20, 120, 4, 2, 10]], "correct", "", "texte"),
    din: () => meal("soir", "Pâtes bolognaise", [["Pâtes cuites", 220, 330, 12, 66, 2], ["Sauce bolognaise", 150, 180, 12, 9, 10], ["Parmesan", 10, 40, 3.5, 0, 3]], "correct", "Ajoute des légumes à côté pour plus de volume.", "photo"),
    salade: () => meal("soir", "Salade de lentilles et œufs", [["Lentilles cuites", 200, 230, 18, 34, 1], ["Œufs durs", 100, 145, 12.5, 1, 10], ["Vinaigrette", 15, 75, 0, 0, 8]], "bon", "", "texte"),
  };
  const foodDays = (n, todayMeals, pick) => { const o = {}; for (let i = 1; i <= n; i++) o[addDays(today, -i)] = { meals: pick(i).map((k) => MEALS[k]()) }; o[today] = { meals: todayMeals.map((k) => MEALS[k]()) }; return o; };
  const mkNutri = (form, start, sessions) => { const c = nutriCalc(form, sessions); return { mode: "calories", form, sex: c.sex, age: num(form.age), height: num(form.height), weight0: num(form.weight), goal: form.goal, delta: num(form.delta) || 0, weeks: Math.round(c.weeksReal || form.weeks || 12), target: c.target, rate: c.rate, tdee: c.tdee, bmr: c.bmr, floor: c.floor, refW: c.refW, targets: c.targets, status: c.status, prefs: form.prefs || "", start, createdAt: start + "T09:00:00.000Z", history: [] }; };
  // 1. Lucas — vitesse, semaine 6
  {
    const start = addDays(today, -38), prog = PB.vitesse;
    const plan = { programId: "vitesse", offer: "suivi", weeks: 12, start, equipment: "salle", status: "active", niveau: "perf", cycle: 1, message: "Super régularité Lucas. Cette semaine on travaille le sprint résisté : pousse fort sur les 10 premiers mètres.", extra: [] };
    const logs = mkLogs(prog, plan, 6, ["w3-C"], 0, { squat_barre: 80, sdt_roumain: 60, split_squat: 16, mollets_unipodal: 10, epaule_suspension: 50, hip_thrust: 90 });
    const checkins = mkCheckins(5, start, (w) => ({ poids: 72.4 + (w % 2) * 0.3, sommeil: 3 + (w % 2), energie: 4, stress: 2, courbatures: w % 4 === 3 ? 4 : 2, nutrition: 4, douleur: w === 3 ? 2 : 0, victoire: w === 5 ? "Record sur le 20 m en séance !" : "", question: w === 5 ? "Je peux ajouter une séance de foot le samedi ?" : "" }));
    const replies = {}; [1, 2, 3, 4].forEach((w) => { replies["w" + w] = { text: "Très bien, on continue comme ça. Garde la même routine d'échauffement.", at: addDays(start, w * 7) + "T08:00:00.000Z" }; });
    const tests = { t0: { w: 0, at: start, values: { sprint10: 1.86, sprint30: 4.32, cmj: 41, longueur: 238 } }, t4: { w: 4, at: addDays(start, 27), values: { sprint10: 1.81, sprint30: 4.25, cmj: 43.5, longueur: 246 } } };
    const profile = { name: "Lucas M.", sport: "Rugby", level: "Confirmé", createdAt: addDays(start, -3), consent: { at: addDays(start, -3) }, demo: true,
      request: { programId: "vitesse", niveau: "perf", answers: { compet: 3, xp: 3, freq: 3 }, offer: "suivi", weeks: 12, start, equipment: "salle" } };
    const nutri = { plan: mkNutri({ sex: "H", age: "23", height: "180", weight: "72.4", goal: "maintien", act: 1.5, prefs: "" }, addDays(start, 2), 3) };
    const food = foodDays(5, ["pdj"], (i) => (i % 2 ? ["pdj", "dej", "col", "din"] : ["pdj", "dej", "salade"]));
    const ai = { ia_demo1: { kind: "charge", e: "epaule_suspension", text: "Garde 55 kg : priorité à la vitesse de barre", fromW: 6, toW: 6, reason: "Effort 8/10 à 55 kg en semaine 5 et sprint 10 m stable", at: addDays(today, -1) + "T20:10:00.000Z", by: "ia", seen: false, status: "active" } };
    const chat = { [today.slice(0, 7)]: { msgs: [
      { r: "u", t: "Je peux ajouter une séance de foot le samedi ?", at: addDays(today, -1) + "T20:05:00.000Z" },
      { r: "a", t: "Oui, à condition de garder ta séance C (vitesse maximale) au moins 48 h avant le match du samedi : décale-la au mercredi. Ta charge de la semaine passe d'environ 1 900 à 2 300 UA, soit +20 % : c'est acceptable, mais pas plus.\n\nSur l'épaulé, garde 55 kg cette semaine et vise la vitesse de barre : je l'ai noté dans ta séance B.", at: addDays(today, -1) + "T20:10:00.000Z", ev: ["Consigne de charge : Épaulé en suspension — garde 55 kg, priorité à la vitesse de barre (S6)"] }] } };
    const d = { cid: "demo_lucas", profile, plan, logs, checkins, tests, habits: {}, replies, nutri, food, ai, chat };
    d.profile.sum = summarize(d); W.demo_lucas = d;
  }
  // 2. Sophie — perte de poids, semaine 9
  {
    const start = addDays(today, -60), prog = PB.perte;
    const plan = { programId: "perte", offer: "essentiel", weeks: 12, start, equipment: "maison", status: "active", niveau: "reprise", cycle: 1, message: "", extra: [] };
    const logs = mkLogs(prog, plan, 9, ["w2-B", "w5-C", "w7-B"], 0, { squat_goblet: 12, sdt_roumain: 16, rowing_haltere: 10, dm_halteres: 6, split_squat: 8, pont_fessier: 0, fente_arriere: 6, hip_thrust: 30, dc_halteres: 8 });
    const checkins = mkCheckins(8, start, (w) => ({ poids: Math.round((78.4 - w * 0.45 + (w % 3 === 0 ? 0.3 : 0)) * 10) / 10, taille: Math.round((92 - w * 0.6) * 10) / 10, sommeil: 3, energie: 3 + (w > 4 ? 1 : 0), stress: 3, courbatures: 2, nutrition: w % 4 === 2 ? 2 : 4, douleur: 0, pas: 6500 + w * 350, victoire: w === 8 ? "J'ai remis mon jean d'avant !" : "" }));
    const replies = {}; for (let w = 1; w <= 8; w++) replies["w" + w] = { text: "Bravo pour ta constance.", at: addDays(start, w * 7) + "T08:00:00.000Z" };
    const tests = { t0: { w: 0, at: start, values: { poids: 78.4, taille: 92, hanches: 104, pompes: 4, planche: 35 } }, t4: { w: 4, at: addDays(start, 27), values: { poids: 76.6, taille: 89.5, hanches: 102, pompes: 8, planche: 55 } }, t8: { w: 8, at: addDays(start, 55), values: { poids: 75.0, taille: 87.2, hanches: 100.5, pompes: 12, planche: 75 } } };
    const habits = {}; const m = today.slice(0, 7); habits[m] = { days: {} };
    for (let i = 1; i <= 12; i++) { const d = addDays(today, -i); if (d.slice(0, 7) === m) habits[m].days[d] = [0, 1, 3, 4].filter(() => rnd() > 0.25); }
    const profile = { name: "Sophie D.", sport: "Remise en forme", level: "Débutant", createdAt: addDays(start, -2), consent: { at: addDays(start, -2) }, demo: true };
    const np = mkNutri({ sex: "F", age: "34", height: "165", weight: "78.4", goal: "perte", delta: "8", weeks: 17, act: 1.35, prefs: "Pas de poisson" }, start, 3);
    const adjAt = addDays(today, -15) + "T19:30:00.000Z";
    const after = safeTargets(np, { kcal: np.targets.kcal - 40, c: null, steps: np.targets.steps + 1000 }).t;
    np.history = [{ at: adjAt, by: "ia", before: np.targets, after, reason: "Poids stable deux semaines de suite malgré une bonne régularité" }]; np.targets = after;
    const nutri = { plan: np };
    const food = foodDays(6, ["pdj", "dej"], (i) => (i === 3 ? ["pdj", "din"] : ["pdj", "dej", "col", "salade"]));
    const ai = { ia_demo2: { kind: "nutri", before: np.history[0].before, after, reason: np.history[0].reason, at: adjAt, by: "ia", seen: true, status: "active" } };
    const chat = { [today.slice(0, 7)]: { msgs: [
      { r: "u", t: "Je mange au restaurant ce soir, qu'est-ce que je choisis ?", at: today + "T12:40:00.000Z" },
      { r: "a", t: "Il te reste environ 900 kcal ce soir : de quoi bien manger. Choisis une viande grillée ou une volaille avec des légumes, et le féculent à part pour doser. Entre l'entrée frite et le dessert, prends l'un ou l'autre selon ton envie.\n\nL'eau en priorité ; un verre de vin reste possible.", at: today + "T12:41:00.000Z" }] } };
    const d = { cid: "demo_sophie", profile, plan, logs, checkins, tests, habits, replies, nutri, food, ai, chat };
    d.profile.sum = summarize(d); W.demo_sophie = d;
  }
  // 3. Karim — retour à la course, semaine 3, douleur
  {
    const start = addDays(today, -16), prog = PB.retour;
    const plan = { programId: "retour", offer: "suivi", weeks: 8, start, equipment: "salle", status: "active", niveau: "sportif", cycle: 1, message: "Respecte bien la règle des 3/10 de douleur.", extra: [] };
    const logs = mkLogs(prog, plan, 3, [], 5, { squat_unipodal_box: 0, pont_fessier: 0, mollets_unipodal: 0, step_down: 0, sdt_jambe: 12, split_squat: 10, leg_curl_glisse: 0 });
    const checkins = mkCheckins(2, start, (w) => ({ sommeil: 4, energie: 3, stress: 2, courbatures: 3, nutrition: 3, douleur: w === 2 ? 3 : 2, zone: "Genou gauche" }));
    const replies = { w1: { text: "Bon démarrage, on garde le même volume.", at: addDays(start, 7) + "T08:00:00.000Z" } };
    const tests = { t0: { w: 0, at: start, values: { douleur: 2, course_continue: 5, hop: { g: 118, d: 142 }, su_squat: { g: 9, d: 14 } } } };
    const profile = { name: "Karim B.", sport: "Football", level: "Intermédiaire", side: "gauche", createdAt: addDays(start, -4), consent: { at: addDays(start, -4) }, demo: true };
    const ai = { ia_demo3: { kind: "alerte", urgence: "haute", text: "Douleur au genou gauche à 5/10 sur la séance d'hier : pogo jumps remplacés, avis du kiné conseillé si ça persiste 48 h.", at: addDays(today, -1) + "T21:00:00.000Z", by: "ia", seen: false, status: "active" },
      ia_demo4: { kind: "subst", from: "pogo", to: "mollets_unipodal", sid: "*", fromW: 3, reason: "Douleur 5/10 au genou gauche après les sauts", at: addDays(today, -1) + "T21:00:00.000Z", by: "ia", seen: false, status: "active" } };
    const d = { cid: "demo_karim", profile, plan, logs, checkins, tests, habits: {}, replies, ai };
    d.profile.sum = summarize(d); W.demo_karim = d;
  }
  // 4. Emma — demande en attente
  {
    const profile = { name: "Emma L.", sport: "Handball", level: "Intermédiaire", createdAt: addDays(today, -1), consent: { at: addDays(today, -1) }, demo: true,
      request: { programId: "masse", niveau: "sportif", answers: { compet: 1, xp: 2, freq: 3 }, offer: "suivi", weeks: 12, equipment: "salle", start: nextMonday() }, screening: SCREENING.map(() => false),
      access: { lastOrder: { id: "odemo1", at: nowISO(), kind: "paiement", offer: "suivi", weeks: 12, programId: "masse", niveau: "sportif", start: nextMonday(), price: 269, status: "en_attente", cgv: { v: CGV_VERSION, at: nowISO() }, early: true } } };
    const d = { cid: "demo_emma", profile, plan: null, logs: {}, checkins: {}, tests: {}, habits: {}, replies: {}, orders: { odemo1: clone(profile.access.lastOrder) } };
    d.profile.sum = summarize(d); W.demo_emma = d;
  }
  return W;
}
