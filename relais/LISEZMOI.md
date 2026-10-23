# Relais de paiement automatique (facultatif)

`worker.js` est un petit programme gratuit à coller dans Cloudflare Workers (offre gratuite : 100 000 requêtes par jour).
Stripe l'appelle après chaque paiement ; il vérifie la signature de Stripe et le montant, puis enregistre le paiement dans Firebase.
Le client voit alors son accès s'ouvrir tout seul, sans que tu aies à confirmer.

Pour le forfait Lite, il enregistre aussi chaque prélèvement d'abonnement (la date de fin d'accès avance toute seule), suit les annulations faites dans Stripe et, avec une clé Stripe restreinte, arrête aussitôt les prélèvements quand un client résilie dans l'application (adresse `…/resilier`).

Sans relais, tout fonctionne aussi : tu confirmes chaque paiement d'un clic dans la fiche du client (mode « manuel »).

Installation pas à pas : étape 6 de [MISE_EN_LIGNE.md](../MISE_EN_LIGNE.md).

Secrets à créer dans Cloudflare : `STRIPE_WEBHOOK_SECRET`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `RELAIS_EMAIL`, `RELAIS_PASSWORD`, et pour la résiliation automatique `STRIPE_SECRET_KEY` (clé restreinte « Subscriptions : écriture ») et `SITE_ORIGIN` (adresse de ton site).

Événements Stripe à cocher : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`.

Aucune donnée bancaire ne passe par le relais : seulement le montant, l'e-mail et la référence de commande.
Les tests automatiques du relais sont dans `app/relay/test_worker.mjs` (`node app/relay/test_worker.mjs`).
