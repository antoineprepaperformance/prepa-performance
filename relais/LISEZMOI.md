# Relais de paiement automatique (facultatif)

`worker.js` est un petit programme gratuit à coller dans Cloudflare Workers (offre gratuite : 100 000 requêtes par jour).
Stripe l'appelle après chaque paiement ; il vérifie la signature de Stripe et le montant, puis enregistre le paiement dans Firebase.
Le client voit alors son accès s'ouvrir tout seul, sans que tu aies à confirmer.

Pour le forfait Lite, il enregistre aussi chaque prélèvement d'abonnement (la date de fin d'accès avance toute seule), suit les annulations faites dans Stripe et, avec une clé Stripe restreinte, arrête aussitôt les prélèvements quand un client résilie dans l'application (adresse `…/resilier`).

Il sert aussi au **coach IA gratuit du site** (adresse `…/ia`) : il vérifie que la personne est connectée et qu'elle a une formule en cours (ou que c'est toi), limite les demandes par client et par jour, puis fait répondre l'IA gratuite de Cloudflare (Workers AI, modèle Gemma 4). 0 € : au-delà de l'allocation gratuite du jour, l'IA répond « limite atteinte » jusqu'au lendemain. Installation : étape 9 de MISE_EN_LIGNE.md (liaison Workers AI `AI`, liaison KV `QUOTA` recommandée).

Il reçoit enfin les **pas, calories actives, FC au repos, VFC et poids** envoyés par le téléphone des clients (adresses `…/sante/…`) : Raccourci de l'iPhone (app Santé) ou application Android « Health Connect Webhook », chacun vers un lien personnel secret. Les valeurs attendent au plus 14 jours dans le stockage KV, jusqu'à ce que l'application du client les récupère ; elles sont effacées quand le client arrête l'envoi ou quand tu supprimes sa fiche. Installation : étape 10 de MISE_EN_LIGNE.md (liaison KV `QUOTA` obligatoire pour cette fonction).

Sans relais, tout fonctionne aussi : tu confirmes chaque paiement d'un clic dans la fiche du client (mode « manuel »), sans coach IA sur le site.

Installation pas à pas : étape 6 de [MISE_EN_LIGNE.md](../MISE_EN_LIGNE.md).

Secrets à créer dans Cloudflare : `STRIPE_WEBHOOK_SECRET`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `RELAIS_EMAIL`, `RELAIS_PASSWORD`, et pour la résiliation automatique `STRIPE_SECRET_KEY` (clé restreinte « Subscriptions : écriture ») et `SITE_ORIGIN` (adresse de ton site).

Événements Stripe à cocher : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`.

Aucune donnée bancaire ne passe par le relais : seulement le montant, l'e-mail et la référence de commande.
Les tests automatiques du relais sont dans `app/relay/test_worker.mjs`, `app/relay/test_ia.mjs` et `app/relay/test_sante.mjs` (`node app/relay/test_worker.mjs`, etc.).
