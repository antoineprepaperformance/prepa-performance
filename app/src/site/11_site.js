/* ===== Version site : accueil public, connexion, installation ===== */
const AUTH_ERR = {
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/missing-password": "Indique ton mot de passe.",
  "auth/weak-password": "Mot de passe trop court : 6 caractères minimum.",
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse : connecte-toi.",
  "auth/user-not-found": "Aucun compte avec cette adresse.",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/invalid-login-credentials": "E-mail ou mot de passe incorrect.",
  "auth/too-many-requests": "Trop d'essais : réessaie dans quelques minutes.",
  "auth/network-request-failed": "Pas de connexion internet.",
  "auth/popup-closed-by-user": "Fenêtre fermée avant la fin de la connexion.",
  "auth/cancelled-popup-request": "Connexion annulée.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé dans Firebase (Authentication › Paramètres › Domaines autorisés).",
  "auth/operation-not-allowed": "Ce mode de connexion n'est pas activé dans Firebase.",
};
const authErr = (e) => AUTH_ERR[e && e.code] || "Connexion impossible : réessaie.";

function SiteRoot() {
  const S = window.SITE;
  const [st, setSt] = useState({ ready: !S.configured, user: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!S.configured) return undefined;
    try { S.auth.getRedirectResult().catch(() => {}); } catch (e) {}
    return S.auth.onAuthStateChanged((u) => setSt({ ready: true, user: u }));
  }, []);
  if (!S.configured) return html`<${SetupNeeded} />`;
  if (!st.ready) return html`<${Splash} text="Ouverture…" />`;
  if (!st.user) return html`<${Landing} />`;
  if (S.isCoachEmail(st.user) && !st.user.emailVerified) return html`<${VerifyEmail} user=${st.user} onDone=${() => setTick(tick + 1)} />`;
  return html`<${App} key=${st.user.uid + ":" + tick + ":" + st.user.emailVerified} />`;
}
function SetupNeeded() {
  return html`<div className="client onboard"><header className="c-top"><${Brand} sub="Installation" /></header>
    <div className="stack"><div className="hero"><div className="eyebrow">Presque prêt</div><h1>Le site n'est pas encore relié à Firebase.</h1>
      <p className="muted">Ouvre le fichier docs/config.js du dépôt et colle la configuration de ton projet Firebase, puis enregistre. Le guide MISE_EN_LIGNE.md détaille chaque étape.</p></div>
      ${window.SITE.error ? html`<p className="small warn-t">Erreur : ${String(window.SITE.error.message || window.SITE.error)}</p>` : null}</div></div>`;
}
function VerifyEmail({ user, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const check = async () => { setBusy(true); try { await user.reload(); await user.getIdToken(true); if (window.SITE.auth.currentUser.emailVerified) { toast("Adresse confirmée : bienvenue dans ton espace coach.", "ok"); onDone(); } else toast("Adresse pas encore confirmée : ouvre le lien reçu par e-mail.", "warn"); } catch (e) { toast(authErr(e), "bad"); } finally { setBusy(false); } };
  const resend = async () => { try { await user.sendEmailVerification(); toast("E-mail renvoyé.", "ok"); } catch (e) { toast(authErr(e), "bad"); } };
  return html`<div className="client onboard"><header className="c-top"><${Brand} sub="Espace coach" /></header>
    <div className="stack"><div className="hero"><div className="eyebrow">Sécurité</div><h1>Confirme ton adresse e-mail.</h1>
      <p className="muted">Un lien a été envoyé à ${user.email}. L'espace coach s'ouvre une fois l'adresse confirmée.</p></div>
      <div className="actions"><${Btn} onClick=${check} disabled=${busy}>J'ai confirmé mon adresse</${Btn}><${Btn} kind="ghost" onClick=${resend}>Renvoyer l'e-mail</${Btn}><${Btn} kind="quiet" onClick=${() => window.SITE.signOut()}>Se déconnecter</${Btn}></div></div></div>`;
}
function AuthPanel({ mode0, onClose }) {
  const toast = useToast();
  const A = window.SITE.auth;
  const [mode, setMode] = useState(mode0 || "signup");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try {
      if (mode === "signup") {
        const r = await A.createUserWithEmailAndPassword(email.trim(), pw);
        if (window.SITE.isCoachEmail(r.user)) { try { await r.user.sendEmailVerification(); } catch (e) {} }
      } else if (mode === "login") await A.signInWithEmailAndPassword(email.trim(), pw);
      else { await A.sendPasswordResetEmail(email.trim()); toast("E-mail de réinitialisation envoyé.", "ok"); setMode("login"); }
    } catch (e) { setErr(authErr(e)); } finally { setBusy(false); }
  };
  const google = async () => {
    setErr("");
    const p = new firebase.auth.GoogleAuthProvider();
    try { await A.signInWithPopup(p); }
    catch (e) {
      if (e && ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(e.code)) { try { await A.signInWithRedirect(p); } catch (x) { setErr(authErr(x)); } }
      else setErr(authErr(e));
    }
  };
  return html`<div className="form">
    <${Seg} options=${[{ v: "signup", n: "Créer mon compte" }, { v: "login", n: "Me connecter" }]} value=${mode === "reset" ? "login" : mode} onChange=${setMode} />
    <button type="button" className="gbtn" onClick=${google}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continuer avec Google</button>
    <div className="or"><span>ou par e-mail</span></div>
    <${Field} label="E-mail" id="au-e"><input id="au-e" type="email" autoComplete="email" value=${email} onChange=${(e) => setEmail(e.target.value)} /></${Field}>
    ${mode !== "reset" ? html`<${Field} label="Mot de passe" id="au-p" hint=${mode === "signup" ? "6 caractères minimum" : null}><input id="au-p" type="password" autoComplete=${mode === "signup" ? "new-password" : "current-password"} value=${pw} onChange=${(e) => setPw(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter") go(); }} /></${Field}>` : null}
    ${err ? html`<p className="small warn-t" role="alert">${err}</p>` : null}
    <${Btn} block onClick=${go} disabled=${busy || !email.trim() || (mode !== "reset" && pw.length < 6)}>${busy ? "Un instant…" : mode === "signup" ? "Créer mon compte" : mode === "login" ? "Me connecter" : "Recevoir le lien"}</${Btn}>
    ${mode === "login" ? html`<button type="button" className="linkbtn" onClick=${() => setMode("reset")}>Mot de passe oublié ?</button>` : null}
    ${mode === "reset" ? html`<button type="button" className="linkbtn" onClick=${() => setMode("login")}>Retour à la connexion</button>` : null}
    <p className="muted small">En créant ton compte, tu acceptes que tes données d'entraînement soient enregistrées pour ton suivi (voir la confidentialité en bas de page).</p>
  </div>`;
}
function LegalModal({ open, onClose, settings, kind0 }) {
  const [kind, setKind] = useState(kind0 || "cgv");
  useEffect(() => { if (open) setKind(kind0 || "cgv"); }, [open, kind0]);
  return html`<${Modal} open=${open} wide title="Informations légales" onClose=${onClose}>
    <div className="stack-s"><${Seg} options=${[{ v: "cgv", n: "Conditions de vente" }, { v: "confidentialite", n: "Confidentialité" }, { v: "mentions", n: "Mentions légales" }]} value=${kind} onChange=${setKind} />
      <${LegalDoc} kind=${kind} settings=${settings} /></div></${Modal}>`;
}
/* lien d'offre : ?code=XXXX est gardé jusqu'à la fin de l'inscription */
function pendingCodeFromUrl() {
  try {
    const q = new URLSearchParams(location.search);
    const c = normCode(q.get("code") || "");
    if (c) { localStorage.setItem("pending_code", c); q.delete("code"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); }
    return normCode(localStorage.getItem("pending_code") || "");
  } catch (e) { return ""; }
}
function Landing() {
  const [auth, setAuth] = useState(null);
  const hashLegal = () => { const h = (location.hash || "").replace("#", ""); return ["cgv", "confidentialite", "mentions"].includes(h) ? h : null; };
  const [legal, setLegal] = useState(hashLegal);
  const [pcode] = useState(pendingCodeFromUrl);
  const [settings, setSettings] = useState(null);
  useEffect(() => { let a = true; (async () => { try { const s = await window.SITE.fs.doc("settings/app").get(); if (a && s.exists) setSettings(s.data()); } catch (e) {} })(); return () => { a = false; }; }, []);
  const demo = useMemo(() => demoWorld().demo_lucas, []);
  const dprog = PB.vitesse;
  const offers = OFFERS.map((o) => ({ ...o, prix: (settings && settings.offers && settings.offers[o.id]) || o.prix }));
  const coach = (settings && settings.coach) || {};
  const steps = [["Choisis ton objectif", "8 programmes : perte de poids, muscle, force, vitesse, sports collectifs, remise en forme, course, retour après blessure."],
    ["Ton plan sur mesure", "Profil Reprise, Sportif, Performance ou Haut niveau : charges, tempo, récupération et prévention adaptés. Accès de 1 à 3 mois, payé une fois, sans abonnement."],
    ["Tes séances, guidées", "La dose de la semaine, les consignes, tes charges de la dernière fois. Un bilan de 2 minutes chaque dimanche."],
    ["Tes progrès, visibles", "Tests toutes les 4 semaines, courbes, nutrition, badges et ta carte athlète qui évolue."]];
  return html`<div className="landing">
    <header className="l-top"><${Brand} sub="Préparation physique en ligne" /><div className="btnrow"><${Btn} kind="quiet" small onClick=${() => setAuth("login")}>Connexion</${Btn}><span className="l-top-cta"><${Btn} small onClick=${() => setAuth("signup")}>Commencer</${Btn}></span></div></header>
    ${pcode ? html`<div className="alert okb"><div><b>Code ${pcode}</b><p>Crée ton compte : ton accès offert sera appliqué à la dernière étape.</p></div><${Btn} small onClick=${() => setAuth("signup")}>J'en profite</${Btn}></div>` : null}
    <section className="l-hero">
      <div className="stack">
        <div className="eyebrow">Antoine Limousi · préparateur physique</div>
        <h1>Ton programme, tes séances et tes progrès au même endroit.</h1>
        <p className="muted">Des programmes construits par un préparateur physique de haut niveau (UBB Sevens champion de France, Girondins de Bordeaux, CREPS de Bordeaux, bobsleigh), et un suivi chaque semaine, où que tu t'entraînes.</p>
        <div className="btnrow"><${Btn} onClick=${() => setAuth("signup")}>Créer mon compte</${Btn}><${Btn} kind="ghost" onClick=${() => setAuth("login")}>J'ai déjà un compte</${Btn}></div>
        <${InstallButton} />
      </div>
      <div className="l-card"><${AthleteCard} data=${demo} stats=${cardStats(demo, demo.plan, dprog, {})} size=${260} idp="l" /><p className="muted small center">Ta carte athlète évolue avec tes séances, tes bilans et tes tests.</p></div>
    </section>
    <section className="l-sec"><h2>Comment ça marche</h2><div className="l-steps">${steps.map(([t, d], i) => html`<div key=${i} className="l-step"><span className="l-n">${i + 1}</span><b>${t}</b><p className="small muted">${d}</p></div>`)}</div></section>
    <section className="l-sec"><h2>Les programmes</h2><div className="pgrid wide">${PROGS.map((p) => html`<div key=${p.id} className="pcard"><b>${p.n}</b><span>${p.short}</span><small>${p.lieu} · 12 semaines</small></div>`)}</div></section>
    <section className="l-sec"><h2>Les formules</h2><div className="l-offers">${offers.map((o) => html`<div key=${o.id} className="card l-offer"><h3>${o.n}</h3><p className="small">${o.desc}</p>
      <div className="l-prices">${DURS.map((d, i) => html`<div key=${d.w}><b>${eur(o.prix[i])}</b><small>${d.n}</small></div>`)}</div></div>`)}</div>
      <p className="muted small">${tvaLine(settings)}. Paiement unique, sans abonnement ni renouvellement automatique. Droit de rétractation de 14 jours (voir les conditions de vente).</p></section>
    <section className="l-sec l-cta"><h2>Prêt à commencer ?</h2><p className="muted">Crée ton compte, choisis ton objectif et ton profil : ton programme démarre dès ton paiement ou avec ton code d'essai.</p><${Btn} onClick=${() => setAuth("signup")}>Créer mon compte</${Btn}></section>
    <footer className="l-foot"><${Brand} sub="Bordeaux Métropole" />
      <div className="small muted">${[coach.phone, coach.email, coach.instagram].filter(Boolean).join(" · ")}</div>
      <div className="btnrow"><button type="button" className="linkbtn" onClick=${() => setLegal("cgv")}>Conditions de vente</button><button type="button" className="linkbtn" onClick=${() => setLegal("confidentialite")}>Confidentialité</button><button type="button" className="linkbtn" onClick=${() => setLegal("mentions")}>Mentions légales</button></div></footer>
    <${Modal} open=${!!auth} title=${auth === "login" ? "Connexion" : "Créer mon compte"} onClose=${() => setAuth(null)}>${auth ? html`<${AuthPanel} mode0=${auth} onClose=${() => setAuth(null)} />` : null}</${Modal}>
    <${LegalModal} open=${!!legal} kind0=${legal || "cgv"} settings=${settings} onClose=${() => { setLegal(null); try { if (location.hash) history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }} />
  </div>`;
}
