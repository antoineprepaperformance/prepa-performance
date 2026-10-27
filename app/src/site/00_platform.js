/* ===== Version site : remplace claude.use() par Firebase (Auth + Firestore) ===== */
(function () {
  var C = window.SITE_CONFIG || {};
  var fb = C.firebase || {};
  var configured = !!(fb.apiKey && fb.projectId && !/A_REMPLIR/.test(fb.apiKey + fb.projectId));
  var auth = null, fs = null, err = null, persistent = false;
  if (configured && window.firebase) {
    try {
      firebase.initializeApp(fb);
      auth = firebase.auth();
      try { auth.languageCode = typeof LANG === "string" ? LANG : "fr"; } catch (e) {}
      if (C.emulators && C.emulators.auth) auth.useEmulator(C.emulators.auth, { disableWarnings: true });
      if (C.authPersistence === "session") { try { auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); } catch (e) {} }
      fs = firebase.firestore();
      if (C.emulators && C.emulators.firestoreHost) fs.useEmulator(C.emulators.firestoreHost, C.emulators.firestorePort || 8080);
      /* cache hors ligne (séances notées à la salle sans réseau, envoyées au retour du réseau) ; pas sur Safari ni sur iPhone/iPad :
         leur base locale (IndexedDB) se coupe après une mise en veille et bloque alors tous les enregistrements jusqu'au rechargement */
      var ua = navigator.userAgent || "";
      var webkit = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android|Firefox|FxiOS/.test(ua));
      persistent = C.offline === true || (C.offline !== false && !webkit);
      if (persistent && typeof fs.enablePersistence === "function") { try { fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {} }
    } catch (e) { err = e; configured = false; }
  }
  var coachEmails = (C.coachEmails || []).map(function (e) { return String(e).trim().toLowerCase(); }).filter(Boolean);
  function isCoachEmail(u) { return !!u && coachEmails.indexOf(String(u.email || "").toLowerCase()) >= 0; }
  function isCoach(u) { return isCoachEmail(u) && !!u.emailVerified; }
  var userNs = {
    isOwner: async function () { return isCoach(auth && auth.currentUser); },
    canEdit: async function () { return isCoach(auth && auth.currentUser); },
    can: async function () { return null; },
    id: async function () { return auth && auth.currentUser ? auth.currentUser.uid : null; },
    me: async function () { var u = auth && auth.currentUser; return { id: u ? u.uid : null, name: u && u.displayName || "", email: u && u.email || null, isOwner: isCoach(u), canEdit: isCoach(u), avatarUrl: "", color: "#c9a227" }; },
    profiles: async function () { return {}; },
  };
  var dlNs = {
    save: async function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: /\.json$/.test(o.filename) ? "application/json" : "application/octet-stream" });
      var u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = o.filename || "fichier"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
      return { ok: true };
    },
  };
  window.IS_SITE = true;
  window.__ZXING_URL = "vendor/zxing.min.js";
  window.SITE = {
    configured: configured, error: err, auth: auth, fs: fs, config: C, isCoach: isCoach, isCoachEmail: isCoachEmail, persistent: persistent,
    signOut: async function () {
      try { if (auth) await auth.signOut(); } catch (e) {}
      /* appareil partagé : on efface le cache local de la base */
      try { if (fs && typeof fs.terminate === "function") { await fs.terminate(); if (typeof fs.clearPersistence === "function") await fs.clearPersistence(); } } catch (e) {}
      location.reload();
    },
  };
  window.claude = {
    use: async function (n) {
      if (n === "db") return fs && auth && auth.currentUser ? fs : null;
      if (n === "user") return auth ? userNs : null;
      if (n === "downloads") return dlNs;
      if (n === "sample") return typeof window.__siteSample === "function" ? window.__siteSample() : null; // coach IA par le relais, s'il est installé
      return null;
    },
  };
  // installation (PWA)
  window.__installPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__installPrompt = e; window.dispatchEvent(new Event("install-ready")); });
  if ("serviceWorker" in navigator && !C.emulators && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
