# Antoine Prépa Performance · site et application

Préparation physique en ligne par Antoine Limousi : page d'accueil publique, comptes clients, espace coach, programmes de 1 à 3 mois adaptés au profil (Reprise, Sportif, Performance, Haut niveau), séances guidées et dosées, bilans hebdomadaires, tests, nutrition, carte athlète évolutive et badges. L'accès aux programmes est payant (Stripe) ou offert par un code d'essai.

- **Mettre en ligne** : suis [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md) (environ 1 heure, gratuit hors frais Stripe).
- **Juridique** : [CONFORMITE.md](CONFORMITE.md) liste ce qui est intégré et ce qu'il te reste à faire (carte pro, assurance, médiateur…).
- **Le site publié** est dans `docs/` (servi par GitHub Pages). Le seul fichier à remplir à la main est `docs/config.js`.
- **Les règles de sécurité** de la base sont dans `firestore.rules` (à coller dans la console Firebase).
- **Le relais de paiement** (facultatif) est dans `relais/worker.js` (Cloudflare Workers, gratuit).
- **Les sources** sont dans `app/` : c'est là que Claude fait les modifications, puis reconstruit `docs/`.

## Fonctionnement de l'accès

1. Le client crée son compte, répond au questionnaire (niveau, objectif, santé) : l'application lui recommande un profil et un programme.
2. Il choisit son programme, sa formule et sa durée (4, 8 ou 12 semaines), accepte les CGV et commande.
3. Il paie par lien Stripe. L'accès s'ouvre soit quand tu confirmes le paiement (mode manuel), soit tout seul grâce au relais (mode automatique).
4. Ou bien il saisit un code offert (ou ouvre ton lien `…/?code=XXXX`) : l'accès s'ouvre aussitôt, pour la durée et le programme prévus par le code.
5. Sans paiement ni code valide, aucune séance n'est accessible. À la fin de la période, les séances se verrouillent et il peut prolonger ou passer au cycle suivant.

Les codes se créent dans l'espace coach, onglet **Codes** (durée, programme imposé ou libre, nombre d'utilisations, date limite).

## Organisation

```
docs/                 site publié (ne pas modifier à la main, sauf config.js)
  index.html          l'application complète
  config.js           clés Firebase, e-mail du coach, mentions légales
  sw.js, manifest     installation sur l'écran d'accueil, mode hors ligne
  vendor/, fonts/     bibliothèques et polices hébergées sur le site (aucun appel à un CDN)
relais/worker.js      relais Stripe → Firebase (facultatif)
app/
  src/                code de l'application (partagé avec la version Claude)
    12_niveau.js      profils, recommandation, dosage des séances (%1RM, RIR, tempo, VMA, affûtage)
    13_acces.js       commandes, paiements, codes, rétractation, CGV et mentions légales
  src/site/           spécifique au site : Firebase, page d'accueil, connexion
  content_*.py        programmes, exercices, profils, tests, questionnaire santé, formules
  build_site.py       reconstruit docs/
  build.py            reconstruit la version Claude (avec coach IA)
  relay/              tests du relais
  test/, e2e_*.py     tests automatiques (navigateur, comptes simulés, base simulée)
firestore.rules       règles de sécurité Firestore
```

## Pour Claude (modifications futures)

```bash
cd app
python3 build_site.py            # reconstruit ../docs (garde docs/config.js)
python3 build_site.py --test     # version de test : site_test/ (base simulée + émulateur Auth)
python3 build.py                 # version Claude : dist/index.html (+ test/index.html)
```

Tests :

- `python3 unit_niveau.py` : profils, recommandations, dosages, accès (sans navigateur).
- `node relay/test_worker.mjs` : signature Stripe, montants, écriture Firebase du relais.
- Site : lancer l'émulateur Auth (`firebase emulators:start --only auth --project demo-prepa`), servir `app/site_test` sur `127.0.0.1:8123`, puis `python3 e2e_site.py`, `e2e_site2.py`, `e2e_pay.py` et `e2e_pwa.py`.
- Version Claude : `python3 e2e.py`, `e2e_nutri.py`, `e2e_claude_acces.py`, `vis.py`.

Les bibliothèques nécessaires aux tests se récupèrent avec `app/vendor/LISEZMOI.md`.
