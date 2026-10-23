# -*- coding: utf-8 -*-
"""Construit la version site internet (GitHub Pages + Firebase).

    python3 build_site.py            -> ../repo/docs/  (site à publier)
    python3 build_site.py --test     -> site_test/     (tests : émulateur Auth + base simulée)

Le dossier docs/ est autonome : il contient la page, les bibliothèques, les polices,
les icônes, le manifeste et le service worker (mode hors ligne / installation).
"""
import hashlib, json, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
TEST = "--test" in sys.argv
REPO = ROOT.parent if (ROOT.parent / "MISE_EN_LIGNE.md").exists() else ROOT.parent / "repo"   # dépôt GitHub : app/ (sources) et docs/ (site)
OUT = (ROOT / "site_test") if TEST else (REPO / "docs")
sys.path.insert(0, str(ROOT))
from content_exercises import LIB
from content_programs import PROGRAMS, T, TESTS, CHECKIN, SCREENING, OFFERS
from content_niveaux import NIVEAU_CONTENT
from content_extras import EXTRAS_CONTENT
from content_recettes import RECETTES_CONTENT

content = {"version": 1, "T": T, "E": LIB, "P": PROGRAMS, "TESTS": TESTS, "CHECKIN": CHECKIN, "SCREENING": SCREENING, "OFFERS": OFFERS, **NIVEAU_CONTENT, **EXTRAS_CONTENT, **RECETTES_CONTENT}
cjson = json.dumps(content, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
ORDER = ["site/00_platform.js", "01_core.js", "02_data.js", "03_ui.js", "04_client.js", "05_coach.js", "06_library.js",
         "08_ai.js", "09_nutrition.js", "10_card.js", "12_niveau.js", "13_acces.js", "14_motion.js", "15_moves.js", "16_video.js", "17_extras.js", "18_sante.js", "19_recettes.js", "site/11_site.js", "07_main.js"]
js = "\n".join((SRC / f).read_text() for f in ORDER)
assert "</script" not in js
css = (SRC / "styles.css").read_text()

# ---------- bibliothèques (copiées depuis vendor/ si présent, sinon conservées dans docs/vendor) ----------
V = ROOT / "vendor"
VENDOR = {
    "react.production.min.js": V / "react-18.3.1/package/umd/react.production.min.js",
    "react-dom.production.min.js": V / "react-dom-18.3.1/package/umd/react-dom.production.min.js",
    "htm.umd.js": V / "htm-3.1.1/package/dist/htm.umd.js",
    "firebase-app-compat.js": V / "firebase-12.19.0/package/firebase-app-compat.js",
    "firebase-auth-compat.js": V / "firebase-12.19.0/package/firebase-auth-compat.js",
    "firebase-firestore-compat.js": V / "firebase-12.19.0/package/firebase-firestore-compat.js",
    "zxing.min.js": V / "zxing-0.21.3/package/umd/index.min.js",
}
FONTS = {
    "barlow-400.woff2": V / "fs-barlow/package/files/barlow-latin-400-normal.woff2",
    "barlow-500.woff2": V / "fs-barlow/package/files/barlow-latin-500-normal.woff2",
    "barlow-600.woff2": V / "fs-barlow/package/files/barlow-latin-600-normal.woff2",
    "barlow-700.woff2": V / "fs-barlow/package/files/barlow-latin-700-normal.woff2",
    "barlow-condensed-600.woff2": V / "fs-barlow-condensed/package/files/barlow-condensed-latin-600-normal.woff2",
    "barlow-condensed-700.woff2": V / "fs-barlow-condensed/package/files/barlow-condensed-latin-700-normal.woff2",
}
OUT.mkdir(parents=True, exist_ok=True)
for sub in ["vendor", "fonts", "icons"]:
    (OUT / sub).mkdir(exist_ok=True)
PUB = REPO / "docs"   # copie publiée : sert de réserve quand app/vendor/ est vide
for sub, table in [("vendor", VENDOR), ("fonts", FONTS)]:
    for name, src in table.items():
        if not src.exists():
            src = PUB / sub / name
        if src.exists() and src.resolve() != (OUT / sub / name).resolve():
            shutil.copy(src, OUT / sub / name)
        assert (OUT / sub / name).exists(), name
lic = V / "fs-barlow/package/LICENSE"
if lic.exists() and not TEST:
    shutil.copy(lic, OUT / "fonts" / "LICENSE-OFL.txt")

FONT_CSS = "".join(
    "@font-face{font-family:\"%s\";font-style:normal;font-weight:%s;font-display:swap;src:url(fonts/%s) format(\"woff2\")}\n" % (fam, w, f)
    for fam, w, f in [("Barlow", 400, "barlow-400.woff2"), ("Barlow", 500, "barlow-500.woff2"), ("Barlow", 600, "barlow-600.woff2"),
                      ("Barlow", 700, "barlow-700.woff2"), ("Barlow Condensed", 600, "barlow-condensed-600.woff2"), ("Barlow Condensed", 700, "barlow-condensed-700.woff2")])
BASE_CSS = ":root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;min-height:100vh}img{max-width:100%}[hidden]{display:none!important}\n"

# ---------- icônes ----------
LOGO = ('<rect x="4" y="9.5" width="40" height="3" rx="1.5"/><rect x="7" y="4" width="4.5" height="14" rx="1.2"/><rect x="12.5" y="6" width="3" height="10" rx="1"/>'
        '<rect x="36.5" y="4" width="4.5" height="14" rx="1.2"/><rect x="32.5" y="6" width="3" height="10" rx="1"/>'
        '<polyline points="11,33 24,23 37,33" fill="none" stroke="#d4ad3f" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '<polyline points="11,43 24,33 37,43" fill="none" stroke="#d4ad3f" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>')
def icon_svg(scale, radius):
    off = (48 - 48 * scale) / 2
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="%s" fill="#0d0d0c"/>'
            '<g transform="translate(%.2f %.2f) scale(%.3f)" fill="#d4ad3f">%s</g></svg>') % (radius, off, off, scale, LOGO)
(OUT / "icons" / "favicon.svg").write_text(icon_svg(0.8, 10))
def render_pngs():
    targets = [("icon-192.png", 192, 0.72, 0), ("icon-512.png", 512, 0.72, 0), ("icon-maskable-512.png", 512, 0.56, 0), ("apple-touch-icon.png", 180, 0.68, 0)]
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        assert all((OUT / "icons" / t[0]).exists() for t in targets), "icônes absentes et Playwright indisponible"
        return
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, size, scale, rad in targets:
            pg = b.new_page(viewport={"width": size, "height": size})
            pg.set_content('<html><body style="margin:0;background:#0d0d0c">' + icon_svg(scale, rad).replace("<svg ", '<svg width="%d" height="%d" ' % (size, size)) + "</body></html>")
            pg.screenshot(path=str(OUT / "icons" / name), omit_background=False)
            pg.close()
        b.close()
render_pngs()

# ---------- configuration (jamais écrasée si elle existe déjà) ----------
CONFIG_TEMPLATE = """/* Configuration du site : à remplir une seule fois (voir MISE_EN_LIGNE.md, étape 3).
   Ces valeurs ne sont pas secrètes : la sécurité vient des règles Firestore. */
window.SITE_CONFIG = {
  firebase: {
    apiKey: "A_REMPLIR",
    authDomain: "A_REMPLIR.firebaseapp.com",
    projectId: "A_REMPLIR",
    storageBucket: "A_REMPLIR.firebasestorage.app",
    messagingSenderId: "A_REMPLIR",
    appId: "A_REMPLIR"
  },
  /* adresse(s) e-mail qui ouvrent l'espace coach : la même que dans les règles Firestore */
  coachEmails: ["ton-email@exemple.fr"],
  /* mentions légales affichées en bas de la page d'accueil */
  legal: {
    editeur: "Antoine Limousi",
    marque: "Antoine Prépa Performance",
    statut: "Entrepreneur individuel (micro-entreprise)"
  }
  /* SIRET, adresse, carte professionnelle, médiateur… : à remplir dans l'espace coach (Offres & réglages › Informations légales) */
};
"""
TEST_CONFIG = """window.SITE_CONFIG = {
  firebase: { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-prepa", appId: "demo-app" },
  coachEmails: ["coach@test.fr"],
  emulators: { auth: "http://127.0.0.1:9099" },
  authPersistence: "session",
  offline: false,
  legal: { editeur: "Antoine Limousi", siret: "123 456 789 00012", adresse: "Bordeaux", email: "contact@test.fr" }
};
"""
cfg = OUT / "config.js"
if TEST:
    cfg.write_text(TEST_CONFIG)
elif not cfg.exists():
    cfg.write_text(CONFIG_TEMPLATE)

# ---------- page ----------
libs = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "vendor/htm.umd.js",
        "vendor/firebase-app-compat.js", "vendor/firebase-auth-compat.js"]
libs += ["fakefs.js"] if TEST else ["vendor/firebase-firestore-compat.js"]
libs += ["config.js"]
DESC = "Programmes de préparation physique en ligne par Antoine Limousi, préparateur physique à Bordeaux : perte de poids, muscle, force, vitesse, sports collectifs, course, retour de blessure. Séances guidées, bilans et suivi chaque semaine."
build_id = hashlib.sha1((js + css + cjson).encode()).hexdigest()[:10]
page = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Antoine Prépa Performance · Préparation physique en ligne</title>
<meta name="description" content="%(desc)s">
<meta name="theme-color" content="#0d0d0c">
<meta name="color-scheme" content="dark light">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Prépa Perf">
<meta property="og:type" content="website">
<meta property="og:title" content="Antoine Prépa Performance">
<meta property="og:description" content="%(desc)s">
<meta name="app-build" content="%(build)s">
<link rel="preload" href="fonts/barlow-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/barlow-condensed-700.woff2" as="font" type="font/woff2" crossorigin>
<style>
%(fonts)s%(base)s%(css)s
</style>
</head>
<body>
<div id="root"><noscript><p style="padding:24px;font-family:sans-serif">Active JavaScript pour utiliser l'application.</p></noscript></div>
<script id="app-content" type="application/json">%(content)s</script>
%(libs)s<script>
%(js)s
</script>
</body>
</html>
""" % {"desc": DESC, "build": build_id, "fonts": FONT_CSS, "base": BASE_CSS, "css": css, "content": cjson,
       "libs": "".join('<script src="%s"></script>\n' % u for u in libs), "js": js}
(OUT / "index.html").write_text(page)

# ---------- manifeste (installation sur l'écran d'accueil) ----------
manifest = {
    "name": "Antoine Prépa Performance", "short_name": "Prépa Perf", "lang": "fr", "dir": "ltr",
    "description": "Ton programme, tes séances et tes progrès au même endroit.",
    "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait",
    "background_color": "#0d0d0c", "theme_color": "#0d0d0c", "categories": ["health", "fitness", "sports"],
    "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
              {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
              {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
}
(OUT / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

# ---------- service worker : page toujours à jour en ligne, utilisable hors ligne ----------
core = ["./", "index.html", "config.js", "manifest.webmanifest", "icons/favicon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png"]
core += ["vendor/" + n for n in VENDOR if n != "zxing.min.js"] + ["fonts/" + n for n in FONTS]
SW = """/* service worker — version %(build)s */
const V = "prepa-%(build)s";
const CORE = %(core)s;
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return; /* Firebase, Open Food Facts : toujours le réseau */
  const fresh = r.mode === "navigate" || /\\/(index\\.html|config\\.js)?$/.test(u.pathname);
  if (fresh) {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r).then((m) => m || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })));
});
""" % {"build": build_id, "core": json.dumps(core)}
(OUT / "sw.js").write_text(SW)
(OUT / ".nojekyll").write_text("")
(OUT / "404.html").write_text("""<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Antoine Prépa Performance</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0d0c;color:#f2eee6;font-family:sans-serif;text-align:center">
<p>Page introuvable.<br><a id="home" href="/" style="color:#d4ad3f">Retour à l'accueil</a></p>
<script>(function () { var s = location.pathname.split("/")[1]; var home = /github\\.io$/.test(location.hostname) && s ? "/" + s + "/" : "/";
document.getElementById("home").href = home; if (location.pathname !== home) location.replace(home); })();</script></body></html>""")

# ---------- règles Firestore (à coller dans la console Firebase) ----------
RULES = """rules_version = '2';
// Règles de sécurité Firestore — Antoine Prépa Performance
// 1. Remplace ton-email@exemple.fr par ton adresse de coach (en minuscules), comme dans docs/config.js.
// 2. Si tu installes le relais de paiement automatique, remplace RELAIS_UID par l'UID du compte du relais (voir MISE_EN_LIGNE.md).
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isCoach() {
      return signedIn() && request.auth.token.email_verified == true
        && request.auth.token.email.lower() in ['ton-email@exemple.fr'];
    }
    function isSelf(cid) { return signedIn() && request.auth.uid == cid; }
    function isRelay() { return signedIn() && request.auth.uid == 'RELAIS_UID'; }
    function planAfter() { return getAfter(/databases/$(database)/documents/plans/$(request.auth.uid)); }

    // ---- accès au programme : créé par le coach, ou par le client avec un code ou un paiement valide ----
    function planKeysOk(p) {
      return p.keys().hasOnly(['programId', 'offer', 'weeks', 'start', 'equipment', 'status', 'niveau', 'medicalHold', 'compDate', 'message', 'extra',
          'validatedAt', 'cycle', 'source', 'grantWeeks', 'updatedAt', 'reviewedAt', 'aiNote', 'startMs', 'untilMs', 'until', 'lite'])
        && p.status == 'active' && p.programId is string && p.offer in ['essentiel', 'suivi', 'hybride', 'lite']
        && p.weeks is int && p.weeks >= 1 && p.weeks <= 12 && p.grantWeeks is int
        && p.start is string && p.start.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && p.niveau in ['reprise', 'sportif', 'perf', 'elite'] && p.cycle is int;
    }
    function weeksOk(p, g) {
      return (resource == null && p.weeks == g && p.cycle == 1)
        || (resource != null && p.weeks == g && p.cycle == resource.data.get('cycle', 1) + 1)
        || (resource != null && p.weeks == resource.data.weeks + g && p.cycle == resource.data.get('cycle', 1)
            && p.programId == resource.data.programId && p.start >= resource.data.start);
    }
    function codeGrant(code, cid, p) {
      let before = get(/databases/$(database)/documents/codes/$(code)).data;
      let after = getAfter(/databases/$(database)/documents/codes/$(code)).data;
      return !(cid in before.usedBy) && (cid in after.usedBy)
        && p.offer == before.offer && p.grantWeeks == before.weeks
        && (before.programId == null || p.programId == before.programId) && weeksOk(p, before.weeks);
    }
    function payGrant(pid, cid, p) {
      let before = get(/databases/$(database)/documents/payments/$(pid)).data;
      let after = getAfter(/databases/$(database)/documents/payments/$(pid)).data;
      return before.uid == cid && before.ok == true && before.used == false && after.used == true
        && p.offer == before.offer && p.grantWeeks == before.weeks && weeksOk(p, before.weeks);
    }
    // ---- forfait Lite : accès daté (startMs → untilMs), mensuel ou annuel, abonnement ou paiement d'avance ----
    function dayMs() { return 86400000; }
    function nowMs() { return request.time.toMillis(); }
    function perMax(per) { return per == 'an' ? 367 * 86400000 : 32 * 86400000; }
    function liteShapeOk(p) {
      return p.offer == 'lite' && p.lite is map && p.startMs is int && p.untilMs is int && p.until is string
        && p.grantWeeks == 0 && p.weeks == 12 && p.untilMs > p.startMs;
    }
    function liteNewOk(p, maxMs) {
      return p.untilMs - p.startMs <= maxMs && p.startMs >= nowMs() - 2 * dayMs() && p.startMs <= nowMs() + 61 * dayMs()
        && ((resource == null && p.cycle == 1) || (resource != null && p.cycle == resource.data.get('cycle', 1) + 1));
    }
    function liteExtOk(p, maxMs) {
      let d = resource.data;
      return d.get('offer', '') == 'lite' && d.untilMs > nowMs() && p.programId == d.programId && p.startMs == d.startMs && p.start == d.start
        && p.untilMs > d.untilMs && p.untilMs - d.untilMs <= maxMs && p.cycle == d.get('cycle', 1);
    }
    function litePayGrant(pid, cid, p) {
      let before = get(/databases/$(database)/documents/payments/$(pid)).data;
      let after = getAfter(/databases/$(database)/documents/payments/$(pid)).data;
      return before.uid == cid && before.ok == true && before.used == false && after.used == true
        && before.offer == 'lite' && before.get('renewal', false) == false && liteShapeOk(p)
        && p.lite.period == before.period && p.lite.mode == before.mode && (before.mode != 'abo' || p.lite.sub == before.sub)
        && (liteNewOk(p, perMax(before.period)) || (resource != null && liteExtOk(p, perMax(before.period))));
    }
    // renouvellement d'abonnement confirmé par le relais : seule la date de fin avance, à la date payée
    function liteRenew(pid, cid, p) {
      let before = get(/databases/$(database)/documents/payments/$(pid)).data;
      let after = getAfter(/databases/$(database)/documents/payments/$(pid)).data;
      return resource != null && before.uid == cid && before.ok == true && before.used == false && after.used == true
        && before.offer == 'lite' && before.renewal == true && resource.data.get('offer', '') == 'lite' && resource.data.lite.sub == before.sub
        && p.diff(resource.data).affectedKeys().hasOnly(['untilMs', 'until', 'source', 'updatedAt'])
        && p.untilMs == before.untilMs && p.untilMs > resource.data.untilMs;
    }
    function liteCodeGrant(code, cid, p) {
      let before = get(/databases/$(database)/documents/codes/$(code)).data;
      let after = getAfter(/databases/$(database)/documents/codes/$(code)).data;
      return !(cid in before.usedBy) && (cid in after.usedBy) && before.offer == 'lite' && liteShapeOk(p) && p.lite.mode == 'code'
        && (before.programId == null || p.programId == before.programId)
        && (liteNewOk(p, before.weeks * 7 * dayMs() + 2 * 3600000) || (resource != null && liteExtOk(p, before.weeks * 7 * dayMs() + 2 * 3600000)));
    }
    // programme suivant choisi par le client pendant son accès Lite (accès, paiement et avis médical inchangés)
    function liteCycle() {
      let p = request.resource.data;
      let d = resource.data;
      return d.get('offer', '') == 'lite' && d.status == 'active' && d.untilMs > nowMs()
        && p.diff(d).affectedKeys().hasOnly(['programId', 'weeks', 'start', 'niveau', 'equipment', 'compDate', 'extra', 'message', 'cycle', 'updatedAt'])
        && p.cycle == d.get('cycle', 1) + 1 && p.weeks == 12;
    }
    function grantOk(cid) {
      let p = request.resource.data;
      return planKeysOk(p) && (
        (p.offer != 'lite' && ((p.source.kind == 'code' && codeGrant(p.source.id, cid, p)) || (p.source.kind == 'paiement' && payGrant(p.source.id, cid, p))))
        || (p.offer == 'lite' && ((p.source.kind == 'code' && liteCodeGrant(p.source.id, cid, p))
          || (p.source.kind == 'paiement' && (litePayGrant(p.source.id, cid, p) || liteRenew(p.source.id, cid, p)))))
        || (resource != null && liteCycle()));
    }
    // ---- utilisation d'un code : +1 utilisation, une seule fois par personne, dans la même écriture que l'accès ----
    function redeemOk(code) {
      let d = resource.data;
      let n = request.resource.data;
      let uid = request.auth.uid;
      return n.diff(d).affectedKeys().hasOnly(['uses', 'usedBy'])
        && d.active == true && (d.expiresMs == null || request.time.toMillis() < d.expiresMs)
        && !(uid in d.usedBy) && n.uses == d.uses + 1 && n.uses <= d.max
        && n.usedBy.diff(d.usedBy).affectedKeys().hasOnly([uid]) && (uid in n.usedBy)
        && planAfter().data.source.id == code;
    }
    // ---- paiement confirmé par le relais : utilisable une fois, par le client concerné ----
    function payUseOk(pid) {
      return resource.data.uid == request.auth.uid && resource.data.used == false && resource.data.ok == true
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used', 'usedAt'])
        && request.resource.data.used == true && planAfter().data.source.id == pid;
    }

    // prix, coordonnées, informations légales : lus par la page d'accueil publique
    match /settings/{doc} {
      allow read: if true;
      allow write: if isCoach();
    }
    // programmes et exercices perso du coach
    match /library/{doc} {
      allow read: if signedIn();
      allow write: if isCoach();
    }
    match /exercises/{doc} {
      allow read: if signedIn();
      allow write: if isCoach();
    }
    // produits scannés (code-barres) partagés entre clients : ajout libre, modification par le coach
    match /products/{ean} {
      allow read: if signedIn();
      allow create: if signedIn() && ean.matches('^[0-9]{8,14}$') && request.resource.data.size() <= 20;
      allow update, delete: if isCoach();
    }
    // codes d'essai et codes offerts : connaître le code permet de le lire, seul le coach les liste et les crée
    match /codes/{code} {
      allow get: if signedIn();
      allow list, create, delete: if isCoach();
      allow update: if isCoach() || (signedIn() && redeemOk(code));
    }
    // abonnements Stripe (forfait Lite) : correspondance abonnement → client, tenue par le relais
    match /subs/{sid} {
      allow read: if isCoach() || isRelay() || (signedIn() && resource.data.uid == request.auth.uid);
      allow create, update: if isRelay() && request.resource.data.uid is string;
      allow delete: if isCoach();
    }
    // résiliation sans connexion (article L215-1-1) : envoi libre et limité, lecture et suivi par le coach
    match /resiliations/{rid} {
      allow create: if rid.matches('^r[a-z0-9]{6,20}$')
        && request.resource.data.keys().hasOnly(['at', 'name', 'email', 'ref', 'msg', 'done'])
        && request.resource.data.name is string && request.resource.data.name.size() >= 2 && request.resource.data.name.size() <= 100
        && request.resource.data.email is string && request.resource.data.email.size() <= 200 && request.resource.data.email.matches('^[^@ ]+@[^@ ]+[.][^@ ]+$')
        && request.resource.data.ref is string && request.resource.data.ref.size() <= 60
        && request.resource.data.msg is string && request.resource.data.msg.size() <= 500
        && request.resource.data.at is string && request.resource.data.at.size() <= 40 && request.resource.data.done == false;
      allow read, update, delete: if isCoach();
    }
    // paiements confirmés par le relais Stripe
    match /payments/{pid} {
      allow read: if isCoach() || (signedIn() && resource.data.uid == request.auth.uid);
      allow create: if isRelay() && request.resource.data.used == false && request.resource.data.uid is string;
      allow update: if isCoach() || (signedIn() && payUseOk(pid));
      allow delete: if isCoach();
    }
    // dossier du client (profil, séances, bilans, tests, repas, commandes) : lui seul et le coach
    match /clients/{cid} {
      allow read, write: if isCoach() || isSelf(cid);
      match /{sub}/{doc} {
        allow read, write: if isCoach() || isSelf(cid);
      }
    }
    // plan : écrit par le coach, ou par le client avec un code ou un paiement valide (jamais supprimé par le client)
    match /plans/{cid} {
      allow read: if isCoach() || isSelf(cid);
      allow write: if isCoach();
      allow create, update: if isSelf(cid) && grantOk(cid);
    }
    // réponses aux bilans : écrites par le coach, lues par le client concerné
    match /replies/{cid} {
      allow read: if isCoach() || isSelf(cid);
      allow write: if isCoach();
    }
    // notes privées du coach
    match /coachnotes/{cid} {
      allow read, write: if isCoach();
    }
  }
}
"""
if not TEST:
    import re
    emails = re.findall(r'["\']([^"\'\s]+@[^"\'\s]+)["\']', (re.search(r"coachEmails\s*:\s*\[([^\]]*)\]", cfg.read_text()) or [None, ""])[1])
    emails = [e.lower() for e in emails] or ["ton-email@exemple.fr"]
    (OUT.parent / "firestore.rules").write_text(RULES.replace("['ton-email@exemple.fr']", "[" + ", ".join("'%s'" % e for e in emails) + "]"))
else:
    shutil.copy(ROOT / "test" / "fakefs.js", OUT / "fakefs.js")
    for f in ["photo_barcode.jpg", "photo_repas.jpg", "photo_etiquette.jpg"]:
        shutil.copy(ROOT / "test" / f, OUT / f)
size = len(page.encode()) // 1024
print(("TEST " if TEST else "") + "site ->", OUT, "| index.html", size, "Ko | build", build_id)
