# Relais de paiement automatique (facultatif)

`worker.js` est un petit programme gratuit à coller dans Cloudflare Workers (offre gratuite : 100 000 requêtes par jour).
Stripe l'appelle après chaque paiement ; il vérifie la signature de Stripe et le montant, puis enregistre le paiement dans Firebase.
Le client voit alors son accès s'ouvrir tout seul, sans que tu aies à confirmer.

Sans relais, tout fonctionne aussi : tu confirmes chaque paiement d'un clic dans la fiche du client (mode « manuel »).

Installation pas à pas : étape 6 de [MISE_EN_LIGNE.md](../MISE_EN_LIGNE.md).

Secrets à créer dans Cloudflare : `STRIPE_WEBHOOK_SECRET`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `RELAIS_EMAIL`, `RELAIS_PASSWORD`.

Aucune donnée bancaire ne passe par le relais : seulement le montant, l'e-mail et la référence de commande.
Les tests automatiques du relais sont dans `app/relay/test_worker.mjs` (`node app/relay/test_worker.mjs`).
