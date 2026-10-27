# Antoine Prépa Performance · site et application

Préparation physique en ligne par Antoine Limousi : page d'accueil publique, comptes clients, espace coach, programmes de 1 à 3 mois adaptés au profil (Reprise, Sportif, Performance, Haut niveau), séances guidées et dosées avec chaque mouvement animé, adaptation au sport et au poste (exercices spécifiques en salle, 50 séances terrain pour 23 sports avec schémas animés, distances, minuteur et chrono), messagerie coach ↔ client et bouton de contact (par écrit, sans appel), coach IA gratuit sur le site par le relais (Cloudflare Workers AI, facultatif), correction vidéo, séances flash à la maison et récup/bien-être avec minuteur, santé au quotidien (pas, calories actives, sommeil, cœur et poids envoyés tout seuls par l'iPhone ou Android et leurs montres, fichiers GPX/TCX), livre de recettes, bilans hebdomadaires, tests, nutrition (valeurs de la table Ciqual de l'ANSES, tenue à jour par un robot GitHub ; dépense énergétique journalière mesurée), profil sportif (âge, taille, poids, records par discipline qui règlent les charges et les allures), carte athlète évolutive et badges, en **français, anglais ou espagnol** au choix du client (l'espace coach reste en français). L'accès est payant (Stripe : formules Coach IA, Essentiel, Suivi en paiement unique, forfait Lite au mois ou à l'année) ou offert par un code d'essai. Le coach IA a une limite d'utilisation par jour et par formule, réglable dans l'espace coach.

- **Mettre en ligne** : suis [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md) (environ 1 heure, gratuit hors frais Stripe).
- **Juridique** : [CONFORMITE.md](CONFORMITE.md) liste ce qui est intégré et ce qu'il te reste à faire (carte pro, assurance, médiateur…).
- **Le site publié** est dans `docs/` (servi par GitHub Pages). Le seul fichier à remplir à la main est `docs/config.js`.
- **Les règles de sécurité** de la base sont dans `firestore.rules` (à coller dans la console Firebase).
- **Le relais de paiement** (facultatif) est dans `relais/worker.js` (Cloudflare Workers, gratuit) : paiements, coach IA du site et envoi automatique des montres.
- **Le robot des valeurs nutritionnelles** est dans `outils/robot-ciqual.yml` (à installer dans `.github/workflows/`, étape 11 de MISE_EN_LIGNE.md).
- **Les sources** sont dans `app/` : c'est là que Claude fait les modifications, puis reconstruit `docs/`.
- **Mises à jour chaque semaine** : une tâche programmée de Claude propose chaque mardi une pull request (étape 12 de MISE_EN_LIGNE.md). Ses règles sont dans `CLAUDE.md`, l'historique dans `JOURNAL.md`, ses consignes dans `outils/TACHE_HEBDO.md`.

## Fonctionnement de l'accès

1. Le client crée son compte, répond au questionnaire (niveau, objectif, santé) : l'application lui recommande un profil et un programme.
2. Il choisit son programme, sa formule et sa durée (4, 8 ou 12 semaines), ou le forfait Lite (mensuel ou annuel, en abonnement ou en paiement d'avance), accepte les CGV et commande.
3. Il paie par lien Stripe. L'accès s'ouvre soit quand tu confirmes le paiement (mode manuel), soit tout seul grâce au relais (mode automatique).
4. Ou bien il saisit un code offert (ou ouvre ton lien `…/?code=XXXX`) : l'accès s'ouvre aussitôt, pour la durée et le programme prévus par le code.
5. Sans paiement ni code valide, aucune séance n'est accessible. À la fin de la période, les séances se verrouillent et il peut prolonger ou passer au cycle suivant.
6. Forfait Lite : chaque prélèvement repousse la date de fin ; quand un programme de 12 semaines se termine, le client choisit lui-même le suivant ; il résilie en 3 clics (« Mes commandes », ou `…/#resilier` sans connexion).

Les codes se créent dans l'espace coach, onglet **Codes** (durée, programme imposé ou libre, nombre d'utilisations, date limite).

## Organisation

```
docs/                 site publié (ne pas modifier à la main, sauf config.js)
  index.html          l'application complète
  config.js           clés Firebase, e-mail du coach, mentions légales
  i18n_en.json, i18n_es.json  traductions anglaise et espagnole (chargées seulement pour ces langues)
  ciqual.json         table Ciqual de l'ANSES (valeurs nutritionnelles), remise à jour chaque mois par le robot
  sw.js, manifest     installation sur l'écran d'accueil, mode hors ligne
  vendor/, fonts/     bibliothèques et polices hébergées sur le site (aucun appel à un CDN)
relais/worker.js      relais Stripe → Firebase, coach IA du site, réception des données des montres (facultatif)
outils/robot-ciqual.yml  robot GitHub de mise à jour de la table Ciqual (copie de .github/workflows/ciqual.yml)
app/
  src/                code de l'application (partagé avec la version Claude)
    12_niveau.js      profils, recommandation, dosage des séances (%1RM, RIR, tempo, VMA, affûtage)
    13_acces.js       commandes, paiements, codes, forfait Lite (abonnements, résiliation, reconduction), rétractation, CGV et mentions légales
    14_motion.js      moteur d'animation des mouvements (squelette 2D) ; 15_moves.js : les mouvements
    16_video.js       fiche mouvement, correction vidéo (images, angles, envoi au coach)
    17_extras.js      séances flash et récup avec minuteur ; 18_sante.js : santé au quotidien ; 19_recettes.js : recettes
    20_terrain.js     sport et poste du client, adaptation des séances, séances terrain (schémas animés, dose, minuteur, chrono)
    21_messages.js    messagerie coach ↔ client (texte, photo, non-lus), boutons de contact
    22_ciqual.js      table Ciqual de l'ANSES : recherche d'aliments, valeurs des repas estimés par l'IA
    23_profil.js      profil sportif : taille, poids, âge, records par discipline (charges, allures, tests)
  src/00_i18n.js      langues : choix FR / EN / ES, traduction de l'affichage au fil de l'eau
  src/site/           spécifique au site : Firebase, coach IA par le relais (01_ia.js), page d'accueil, connexion
  i18n/               _textes.json (textes extraits du code), en.json et es.json (traductions), _extra.json (textes composés), work/ (lots de traduction)
  tools/i18n_extract.mjs, tools/i18n_merge.py   extraction des textes et vérification des traductions (npm install --prefix tools)
  content_*.py        programmes, exercices, profils, tests, questionnaire santé, formules ; content_sports.py : sports et séances terrain ; content_nutri.py : aliments courants et table Ciqual
  tools/ciqual.py     convertit le fichier CSV Ciqual de l'ANSES en data/ciqual.json
  build_site.py       reconstruit docs/
  build.py            reconstruit la version Claude (avec coach IA)
  relay/              tests du relais
  test/, e2e_*.py     tests automatiques (navigateur, comptes simulés, base simulée)
firestore.rules       règles de sécurité Firestore
```

## Pour Claude (modifications futures)

Lis d'abord `CLAUDE.md` (règles) et `JOURNAL.md` (ce qui a déjà été fait). Tout tester en une commande : `bash app/tests.sh`.

```bash
cd app
python3 build_site.py            # reconstruit ../docs (garde docs/config.js)
python3 build_site.py --test     # version de test : site_test/ (base simulée + émulateur Auth)
python3 build.py                 # version Claude : dist/index.html (+ test/index.html)
```

Tests :

- `python3 unit_niveau.py` : profils, recommandations, dosages, accès (sans navigateur).
- `node relay/test_worker.mjs` : signature Stripe, montants, écriture Firebase du relais ; `node relay/test_ia.mjs` : coach IA du relais (connexion, formule, quotas) ; `node relay/test_sante.mjs` : données des montres (lien personnel, Raccourci iPhone, Health Connect, effacement).
- Site : lancer l'émulateur Auth (`firebase emulators:start --only auth --project demo-prepa`), servir `app/site_test` sur `127.0.0.1:8123`, puis `python3 e2e_site.py`, `e2e_site2.py`, `e2e_pay.py`, `e2e_lite.py`, `e2e_features_site.py`, `e2e_terrain_site.py`, `e2e_rules_site.py`, `e2e_messages_site.py`, `e2e_sante_site.py` et `e2e_pwa.py`.
- Version Claude : `python3 e2e.py`, `e2e_nutri.py`, `e2e_claude_acces.py`, `e2e_lite_claude.py`, `e2e_features.py`, `e2e_terrain.py`, `e2e_messages.py`, `e2e_profil.py`, `e2e_formules.py` (Coach IA, limites), `e2e_langues.py` (anglais, espagnol, textes restés en français), `vis.py`.
- Traductions complètes : `node tools/i18n_extract.mjs --manque` (aucune ligne attendue).

Les bibliothèques nécessaires aux tests se récupèrent avec `app/vendor/LISEZMOI.md`.
