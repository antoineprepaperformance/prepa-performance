/* Base Firestore simulée pour les tests du site (l'émulateur Firestore n'est pas téléchargeable ici).
   - API « compat » utilisée par l'application : doc/collection/where/get/set/update/delete/onSnapshot/batch, FieldValue.increment, chemins pointés
   - stockage partagé entre onglets via localStorage (+ événement storage)
   - contraintes Firestore : pas d'undefined, pas de tableaux imbriqués, 1 Mio par document, identifiants valides
   - règles de sécurité : copie fidèle de firestore.rules (état avant / après pour les écritures groupées)
   - compteurs de lectures/écritures (quota gratuit : 50 000 lectures et 20 000 écritures par jour) */
(function () {
  var KEY = "fakefs_v1";
  var stats = (window.__fsStats = { reads: 0, writes: 0, denied: [], errors: [] });
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; e.name = "FirebaseError"; return e; }
  function later(f) { return new Promise(function (res, rej) { setTimeout(function () { try { res(f()); } catch (e) { rej(e); } }, 8 + Math.random() * 12); }); }
  function coachList() { return (window.__RULES_EMAILS || (window.SITE_CONFIG || {}).coachEmails || []).map(function (x) { return String(x).toLowerCase(); }); }
  function user() { try { return firebase.auth().currentUser; } catch (e) { return null; } }
  function plain(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function same(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
  function changedKeys(a, b) { a = a || {}; b = b || {}; var ks = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (!same(a[k], b[k])) ks[k] = 1; }); return Object.keys(ks); }
  function getf(o, k, d) { return o && o[k] !== undefined ? o[k] : d; }
  /* ---- règles (miroir de firestore.rules) ---- */
  var OFFERS = ["essentiel", "suivi", "hybride", "lite"], NIVS = ["reprise", "sportif", "perf", "elite"];
  var PLAN_KEYS = ["programId", "offer", "weeks", "start", "equipment", "status", "niveau", "medicalHold", "compDate", "message", "extra", "validatedAt", "cycle", "source", "grantWeeks", "updatedAt", "reviewedAt", "aiNote", "startMs", "untilMs", "until", "lite"];
  var DAY = 86400000;
  function nowMs() { return Date.now() + (window.__CLOCK_SKEW || 0); }
  function perMax(per) { return per === "an" ? 367 * DAY : 32 * DAY; }
  function liteShapeOk(p) { return p.offer === "lite" && p.lite && typeof p.lite === "object" && isInt(p.startMs) && isInt(p.untilMs) && typeof p.until === "string" && p.grantWeeks === 0 && p.weeks === 12 && p.untilMs > p.startMs; }
  function liteNewOk(p, maxMs, prev) { return p.untilMs - p.startMs <= maxMs && p.startMs >= nowMs() - 2 * DAY && p.startMs <= nowMs() + 61 * DAY && ((!prev && p.cycle === 1) || (!!prev && p.cycle === getf(prev, "cycle", 1) + 1)); }
  function liteExtOk(p, maxMs, d) { return !!d && getf(d, "offer", "") === "lite" && d.untilMs > nowMs() && p.programId === d.programId && p.startMs === d.startMs && p.start === d.start && p.untilMs > d.untilMs && p.untilMs - d.untilMs <= maxMs && p.cycle === getf(d, "cycle", 1); }
  function liteCycleOk(p, d) {
    if (!d || getf(d, "offer", "") !== "lite" || d.status !== "active" || !(d.untilMs > nowMs())) return false;
    var allowedK = ["programId", "weeks", "start", "niveau", "equipment", "compDate", "extra", "message", "cycle", "updatedAt"];
    return changedKeys(d, p).every(function (k) { return allowedK.indexOf(k) >= 0; }) && p.cycle === getf(d, "cycle", 1) + 1 && p.weeks === 12;
  }
  function isInt(x) { return typeof x === "number" && Math.floor(x) === x; }
  function planKeysOk(p) {
    return Object.keys(p).every(function (k) { return PLAN_KEYS.indexOf(k) >= 0; }) && p.status === "active" && typeof p.programId === "string" && OFFERS.indexOf(p.offer) >= 0
      && isInt(p.weeks) && p.weeks >= 1 && p.weeks <= 12 && isInt(p.grantWeeks) && typeof p.start === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(p.start)
      && NIVS.indexOf(p.niveau) >= 0 && isInt(p.cycle);
  }
  function weeksOk(p, g, prev) {
    if (!prev) return p.weeks === g && p.cycle === 1;
    var pc = getf(prev, "cycle", 1);
    if (p.weeks === g && p.cycle === pc + 1) return true;
    return p.weeks === prev.weeks + g && p.cycle === pc && p.programId === prev.programId && p.start >= prev.start;
  }
  function planGrantOk(cid, p, B, A) {
    if (!planKeysOk(p)) return false;
    var prev = B["plans/" + cid], s = p.source;
    if (prev && liteCycleOk(p, prev)) return true;
    if (!s || typeof s !== "object") return false;
    if (p.offer === "lite") {
      if (s.kind === "code") {
        var cb = B["codes/" + s.id], ca = A["codes/" + s.id];
        if (!cb || !ca) return false;
        var mx = cb.weeks * 7 * DAY + 2 * 3600000;
        return !(cid in (cb.usedBy || {})) && (cid in (ca.usedBy || {})) && cb.offer === "lite" && liteShapeOk(p) && p.lite.mode === "code" && (cb.programId == null || p.programId === cb.programId)
          && (liteNewOk(p, mx, prev) || liteExtOk(p, mx, prev));
      }
      if (s.kind === "paiement") {
        var lb = B["payments/" + s.id], la = A["payments/" + s.id];
        if (!lb || !la || lb.uid !== cid || lb.ok !== true || lb.used !== false || la.used !== true || lb.offer !== "lite") return false;
        if (lb.renewal === true) return !!prev && getf(prev, "offer", "") === "lite" && prev.lite && prev.lite.sub === lb.sub
          && changedKeys(prev, p).every(function (k) { return ["untilMs", "until", "source", "updatedAt"].indexOf(k) >= 0; }) && p.untilMs === lb.untilMs && p.untilMs > prev.untilMs;
        return liteShapeOk(p) && p.lite.period === lb.period && p.lite.mode === lb.mode && (lb.mode !== "abo" || p.lite.sub === lb.sub)
          && (liteNewOk(p, perMax(lb.period), prev) || liteExtOk(p, perMax(lb.period), prev));
      }
      return false;
    }
    if (s.kind === "code") {
      var b = B["codes/" + s.id], a = A["codes/" + s.id];
      if (!b || !a) return false;
      return !(cid in (b.usedBy || {})) && (cid in (a.usedBy || {})) && p.offer === b.offer && p.grantWeeks === b.weeks && (b.programId == null || p.programId === b.programId) && weeksOk(p, b.weeks, prev);
    }
    if (s.kind === "paiement") {
      var pb = B["payments/" + s.id], pa = A["payments/" + s.id];
      if (!pb || !pa) return false;
      return pb.uid === cid && pb.ok === true && pb.used === false && pa.used === true && p.offer === pb.offer && p.grantWeeks === pb.weeks && weeksOk(p, pb.weeks, prev);
    }
    return false;
  }
  function allowed(op, path, data, existed, B, A, filters) {
    var u = user(), seg = path.split("/");
    var signed = !!u;
    var coach = signed && u.emailVerified === true && coachList().indexOf(String(u.email || "").toLowerCase()) >= 0;
    var self = function (cid) { return signed && !!cid && u.uid === cid; };
    var read = op === "get" || op === "list";
    B = B || {}; A = A || {};
    switch (seg[0]) {
      case "settings": return read ? true : coach;
      case "library": case "exercises": return read ? signed : coach;
      case "products":
        if (read) return signed;
        if (op === "write" && !existed) return signed && /^[0-9]{8,14}$/.test(seg[1] || "") && data && Object.keys(data).length <= 20;
        return coach;
      case "codes":
        if (op === "get") return signed;
        if (op === "list") return coach;
        if (!existed || data === null) return coach;
        if (coach) return true;
        if (!signed) return false;
        var d = B[path], n = data, uid = u.uid;
        if (!changedKeys(d, n).every(function (k) { return k === "uses" || k === "usedBy"; })) return false;
        if (d.active !== true) return false;
        if (d.expiresMs != null && Date.now() >= d.expiresMs) return false;
        if ((d.usedBy || {})[uid]) return false;
        if (n.uses !== (d.uses || 0) + 1 || n.uses > d.max) return false;
        var uk = changedKeys(d.usedBy || {}, n.usedBy || {});
        if (!(uk.length === 1 && uk[0] === uid)) return false;
        var pl = A["plans/" + uid];
        return !!(pl && pl.source && pl.source.id === seg[1]);
      case "payments":
        if (op === "list") return coach || (signed && (filters || []).some(function (f) { return f[0] === "uid" && f[1] === "==" && f[2] === u.uid; }));
        if (op === "get") return coach || (signed && B[path] && B[path].uid === u.uid);
        if (!existed) return signed && u.uid === window.__RELAY_UID && data && data.used === false;
        if (data === null) return coach;
        if (coach) return true;
        var pd = B[path];
        if (!(signed && pd.uid === u.uid && pd.used === false && pd.ok === true)) return false;
        if (!changedKeys(pd, data).every(function (k) { return k === "used" || k === "usedAt"; }) || data.used !== true) return false;
        var pp = A["plans/" + u.uid];
        return !!(pp && pp.source && pp.source.id === seg[1]);
      case "clients": return coach || self(seg[1]);
      case "plans":
        if (read) return coach || self(seg[1]);
        if (coach) return true;
        return self(seg[1]) && data !== null && planGrantOk(seg[1], data, B, A);
      case "subs":
        if (read) return coach || (signed && u.uid === window.__RELAY_UID) || (signed && B[path] && B[path].uid === u.uid);
        if (data === null) return coach;
        return signed && u.uid === window.__RELAY_UID && data && typeof data.uid === "string";
      case "resiliations":
        if (read || data === null) return coach;
        if (existed) return coach;
        var rk = Object.keys(data || {});
        return /^r[a-z0-9]{6,20}$/.test(seg[1] || "") && rk.every(function (k) { return ["at", "name", "email", "ref", "msg", "done"].indexOf(k) >= 0; })
          && typeof data.name === "string" && data.name.length >= 2 && data.name.length <= 100 && typeof data.email === "string" && data.email.length <= 200 && /^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(data.email)
          && typeof data.ref === "string" && data.ref.length <= 60 && typeof data.msg === "string" && data.msg.length <= 500 && typeof data.at === "string" && data.at.length <= 40 && data.done === false;
      case "replies": return read ? (coach || self(seg[1])) : coach;
      case "coachnotes": return coach;
      default: return false;
    }
  }
  function check(op, path, data, existed, B, A, filters) {
    if (!allowed(op, path, data, existed, B, A, filters)) {
      var u = user();
      stats.denied.push(op + " " + path + " (" + (u ? u.email : "anonyme") + ")");
      throw err("permission-denied", "Missing or insufficient permissions.");
    }
  }
  /* ---- validation des données ---- */
  function validate(v, where, inArray) {
    if (v === undefined) throw err("invalid-argument", "Function setDoc() called with invalid data. Unsupported field value: undefined (" + where + ")");
    if (typeof v === "function") throw err("invalid-argument", "Unsupported field value: function (" + where + ")");
    if (v && v.__inc !== undefined) return;
    if (Array.isArray(v)) {
      if (inArray) throw err("invalid-argument", "Nested arrays are not supported (" + where + ")");
      v.forEach(function (x, i) { validate(x, where + "[" + i + "]", true); });
      return;
    }
    if (v && typeof v === "object") {
      Object.keys(v).forEach(function (k) {
        if (!k) throw err("invalid-argument", "Empty field name (" + where + ")");
        if (/^__.*__$/.test(k)) throw err("invalid-argument", "Reserved field name " + k + " (" + where + ")");
        validate(v[k], where + "." + k, false);
      });
    }
  }
  function validPath(path, kind) {
    var seg = path.split("/");
    if (seg.some(function (s) { return !s || s === "." || s === ".." || /^__.*__$/.test(s); })) throw err("invalid-argument", "Invalid path " + path);
    if (kind === "doc" && seg.length % 2) throw err("invalid-argument", "Invalid document reference. Document references must have an even number of segments, but " + path + " has " + seg.length);
    if (kind === "col" && !(seg.length % 2)) throw err("invalid-argument", "Invalid collection reference " + path);
  }
  function applyUpdate(cur, data) {
    var out = plain(cur);
    Object.keys(data).forEach(function (k) {
      var parts = k.split("."), o = out;
      for (var i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== "object") o[parts[i]] = {}; o = o[parts[i]]; }
      var last = parts[parts.length - 1], v = data[k];
      if (v && v.__inc !== undefined) o[last] = (Number(o[last]) || 0) + v.__inc; else o[last] = plain(v);
    });
    return out;
  }
  /* ---- écritures (une ou plusieurs, atomiques) ---- */
  function commit(ops) {
    var B = load(), A = plain(B);
    ops.forEach(function (op) {
      if (op.kind === "set") A[op.path] = op.merge && A[op.path] ? Object.assign({}, A[op.path], plain(op.data)) : plain(op.data);
      else if (op.kind === "update") { if (A[op.path] === undefined) throw err("not-found", "No document to update: " + op.path); A[op.path] = applyUpdate(A[op.path], op.data); }
      else delete A[op.path];
    });
    ops.forEach(function (op) {
      var after = A[op.path] === undefined ? null : A[op.path];
      check("write", op.path, after, B[op.path] !== undefined, B, A);
      if (after) { var size = JSON.stringify(after).length; if (size > 1048487) throw err("invalid-argument", "Document " + op.path + " too large (" + size + " bytes)"); }
    });
    save(A); stats.writes += ops.length; notify();
  }
  /* ---- écouteurs ---- */
  var listeners = [];
  function notify() { listeners.slice().forEach(function (l) { l.run(); }); }
  window.addEventListener("storage", function (e) { if (e.key === KEY) notify(); });
  function DocSnap(path, data) { this.id = path.split("/").pop(); this.ref = new DocRef(path); this._d = data; this.metadata = { hasPendingWrites: false, fromCache: false }; }
  Object.defineProperty(DocSnap.prototype, "exists", { get: function () { return this._d !== undefined; } });
  DocSnap.prototype.data = function () { return this._d === undefined ? undefined : plain(this._d); };
  DocSnap.prototype.get = function (f) { return this._d ? this._d[f] : undefined; };
  function QuerySnap(docs) { this.docs = docs; this.size = docs.length; this.empty = !docs.length; }
  QuerySnap.prototype.forEach = function (f) { this.docs.forEach(f); };
  function subscribe(compute, next, error) {
    var l = { last: null, dead: false };
    l.run = function () {
      if (l.dead) return;
      setTimeout(function () {
        if (l.dead) return;
        var r;
        try { r = compute(); } catch (e) { l.dead = true; var i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); if (error) error(e); else stats.errors.push(String(e.message)); return; }
        var sig = JSON.stringify(r.sig);
        if (sig === l.last) return;
        l.last = sig; stats.reads += Math.max(1, r.n);
        try { next(r.snap); } catch (e) { stats.errors.push("listener: " + e.message); console.error(e); }
      }, 5);
    };
    listeners.push(l); l.run();
    return function () { l.dead = true; var i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
  }
  /* ---- références ---- */
  function DocRef(path) { validPath(path, "doc"); this.path = path; this.id = path.split("/").pop(); }
  DocRef.prototype.collection = function (c) { return new ColRef(this.path + "/" + c); };
  DocRef.prototype._snap = function () { var all = load(); check("get", this.path, null, all[this.path] !== undefined, all, all); return new DocSnap(this.path, all[this.path]); };
  DocRef.prototype.get = function () { var me = this; return later(function () { var s = me._snap(); stats.reads++; return s; }); };
  DocRef.prototype.set = function (data, opts) { var me = this; validate(data, me.path, false); if (window.__FS_HANG) return new Promise(function () {}); if (window.__FS_BROKEN) return Promise.reject(err("internal", "FIRESTORE INTERNAL ASSERTION FAILED: IndexedDB transaction failed: Connection to Indexed Database server lost.")); return later(function () { commit([{ kind: "set", path: me.path, data: data, merge: !!(opts && opts.merge) }]); }); };
  DocRef.prototype.update = function (data) { var me = this; validate(data, me.path, false); return later(function () { commit([{ kind: "update", path: me.path, data: data }]); }); };
  DocRef.prototype.delete = function () { var me = this; return later(function () { commit([{ kind: "delete", path: me.path }]); }); };
  DocRef.prototype.onSnapshot = function (next, error) {
    var me = this;
    if (typeof next === "object" && next) { error = next.error; next = next.next; }
    return subscribe(function () { var s = me._snap(); return { snap: s, sig: [s._d === undefined ? null : s._d], n: 1 }; }, next, error);
  };
  function Query(path, filters, lim) { this.path = path; this._f = filters || []; this._lim = lim || 0; }
  Query.prototype.where = function (field, op, value) { return new Query(this.path, this._f.concat([[field, op, value]]), this._lim); };
  Query.prototype.orderBy = function () { return this; };
  Query.prototype.limit = function (n) { return new Query(this.path, this._f, n); };
  Query.prototype._run = function () {
    var all = load();
    check("list", this.path, null, true, all, all, this._f);
    var pre = this.path + "/", depth = this.path.split("/").length + 1, out = [];
    Object.keys(all).forEach(function (k) { if (k.indexOf(pre) === 0 && k.split("/").length === depth) out.push(k); });
    var f = this._f;
    out = out.filter(function (k) {
      return f.every(function (w) {
        var v = all[k][w[0]];
        if (v === undefined) return false;
        switch (w[1]) { case "==": return v === w[2]; case ">=": return v >= w[2]; case ">": return v > w[2]; case "<=": return v <= w[2]; case "<": return v < w[2]; case "in": return w[2].indexOf(v) >= 0; default: throw err("invalid-argument", "op " + w[1]); }
      });
    });
    var ineq = f.filter(function (w) { return /[<>]/.test(w[1]); })[0];
    out.sort(function (a, b) {
      if (ineq) { var x = all[a][ineq[0]], y = all[b][ineq[0]]; if (x < y) return -1; if (x > y) return 1; }
      return a < b ? -1 : a > b ? 1 : 0;
    });
    if (this._lim) out = out.slice(0, this._lim);
    var docs = out.map(function (k) { return new DocSnap(k, all[k]); });
    return { snap: new QuerySnap(docs), sig: out.map(function (k) { return [k, all[k]]; }), n: docs.length };
  };
  Query.prototype.get = function () { var me = this; return later(function () { var r = me._run(); stats.reads += Math.max(1, r.n); return r.snap; }); };
  Query.prototype.onSnapshot = function (next, error) {
    var me = this;
    if (typeof next === "object" && next) { error = next.error; next = next.next; }
    return subscribe(function () { return me._run(); }, next, error);
  };
  function ColRef(path) { validPath(path, "col"); Query.call(this, path); this.id = path.split("/").pop(); }
  ColRef.prototype = Object.create(Query.prototype);
  ColRef.prototype.doc = function (id) { return new DocRef(this.path + "/" + (id || Math.random().toString(36).slice(2, 12) + Date.now().toString(36))); };
  ColRef.prototype.add = function (data) { var r = this.doc(); return r.set(data).then(function () { return r; }); };
  function Batch() { this.ops = []; this.done = false; }
  Batch.prototype.set = function (ref, data, opts) { validate(data, ref.path, false); this.ops.push({ kind: "set", path: ref.path, data: data, merge: !!(opts && opts.merge) }); return this; };
  Batch.prototype.update = function (ref, data) { validate(data, ref.path, false); this.ops.push({ kind: "update", path: ref.path, data: data }); return this; };
  Batch.prototype.delete = function (ref) { this.ops.push({ kind: "delete", path: ref.path }); return this; };
  Batch.prototype.commit = function () { var me = this; if (me.done) return Promise.reject(err("failed-precondition", "batch already committed")); me.done = true; return later(function () { commit(me.ops); }); };
  var DB = {
    doc: function (p) { return new DocRef(p); },
    collection: function (p) { return new ColRef(p); },
    batch: function () { return new Batch(); },
    settings: function () {}, useEmulator: function () {},
    enablePersistence: function () { return Promise.resolve(); },
    terminate: function () { return Promise.resolve(); }, clearPersistence: function () { return Promise.resolve(); },
  };
  firebase.firestore = function () { return DB; };
  firebase.firestore.FieldValue = { increment: function (n) { return { __inc: n }; } };
  window.__fakefs = {
    load: load, save: save, reset: function () { localStorage.removeItem(KEY); }, allowed: allowed,
    /* écriture « serveur » (simule le relais de paiement authentifié) en passant par les règles avec l'identité du relais */
    relayCreate: function (path, data) { var B = load(); if (B[path]) return "exists"; var A = plain(B); A[path] = plain(data); var u = { uid: window.__RELAY_UID };
      var seg = path.split("/"); if (seg[0] !== "payments" || data.used !== false || !u.uid) return "denied"; save(A); notify(); return "ok"; },
    relaySet: function (path, data) { var B = load(); var seg = path.split("/"); if (seg[0] !== "subs" || !window.__RELAY_UID || typeof data.uid !== "string") return "denied"; B[path] = plain(data); save(B); notify(); return "ok"; },
  };
})();
