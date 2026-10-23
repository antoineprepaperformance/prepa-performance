# Mettre le site en ligne gratuitement

Compte 45 minutes à 1 heure, une seule fois (plus 20 minutes si tu installes le paiement automatique). L'hébergement est gratuit : GitHub Pages pour le site, Firebase (Google) pour les comptes et la base de données, Stripe pour encaisser (aucun abonnement, une commission par paiement).

À la fin, tu as :
- une adresse du type `https://ton-pseudo.github.io/prepa-performance/` à mettre dans ta bio Instagram ;
- un site qui marche sur téléphone et sur ordinateur, installable comme une application ;
- des clients qui choisissent leur programme, leur profil et leur durée, paient en ligne ou utilisent ton code d'essai, et n'ont accès aux séances que pendant la période achetée ;
- ton espace coach, protégé par ton adresse e-mail.

Avant d'ouvrir les ventes, lis aussi [CONFORMITE.md](CONFORMITE.md) : ce qu'il te reste à faire côté légal (carte professionnelle, assurance, médiateur…).

---

## Étape 1 · Créer le projet Firebase (10 min)

1. Va sur **console.firebase.google.com** et connecte-toi avec un compte Google.
2. **Créer un projet** › nom : `prepa-performance` › désactive Google Analytics (inutile ici) › **Créer le projet**.
3. Reste sur l'offre **Spark (sans frais)**. N'ajoute pas de carte bancaire.

### Comptes (Authentication)
4. Menu **Créer › Authentication › Commencer**.
5. Onglet **Mode de connexion** :
   - **Adresse e-mail/Mot de passe** › active le premier interrupteur seulement › Enregistrer ;
   - **Google** › Activer › choisis ton e-mail d'assistance › Enregistrer (facultatif mais pratique pour tes clients).
6. Onglet **Paramètres › Domaines autorisés** › **Ajouter un domaine** › `ton-pseudo.github.io` (ton pseudo GitHub de l'étape 2, en minuscules).

### Base de données (Firestore)
7. Menu **Créer › Firestore Database › Créer une base de données**.
8. Emplacement : **europe-west9 (Paris)** (ou `eur3`). Ce choix est définitif : prends bien un emplacement en Europe.
9. Démarrer en **mode production** › Créer.
10. Onglet **Règles** : efface tout, colle le contenu du fichier `firestore.rules` de ce dossier, puis remplace `ton-email@exemple.fr` par **ton adresse de coach, en minuscules**. Laisse `RELAIS_UID` tel quel pour l'instant (étape 6). Clique sur **Publier**.

### Les clés du site
11. Roue dentée › **Paramètres du projet** › en bas, **Vos applications** › icône **`</>`** (Web).
12. Surnom : `site` › ne coche pas Firebase Hosting › **Enregistrer l'application**.
13. Garde la page ouverte : elle affiche un bloc `firebaseConfig` avec `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`. Tu en as besoin à l'étape 3.

> Ces clés ne sont pas secrètes : elles servent juste à trouver ton projet. La protection vient des règles de l'étape 10 : un client ne voit que ses données et ne peut pas s'ouvrir un accès sans paiement ni code valide.

---

## Étape 2 · Publier le site sur GitHub (10 min)

1. Crée un compte sur **github.com** (gratuit). Ton pseudo fera partie de l'adresse du site.
2. En haut à droite **+ › New repository** :
   - nom : `prepa-performance` ;
   - **Public** (obligatoire pour GitHub Pages gratuit) ;
   - ne coche rien d'autre › **Create repository**.
3. Sur la page du dépôt vide, clique sur **uploading an existing file**.
4. Décompresse le fichier zip reçu, ouvre le dossier `prepa-performance`, sélectionne **tout son contenu** (`docs`, `app`, `relais`, `firestore.rules`, les fichiers `.md`…) et glisse-le dans la page. Attends la fin de l'envoi › **Commit changes**.
5. **Settings › Pages** :
   - Source : **Deploy from a branch** ;
   - Branch : **main**, dossier **/docs** › **Save**.
6. Après 1 à 2 minutes, l'adresse du site s'affiche en haut de cette page. En l'ouvrant, tu vois « Le site n'est pas encore relié à Firebase » : c'est normal.

---

## Étape 3 · Relier le site à Firebase (5 min)

1. Sur GitHub, ouvre `docs/config.js` › icône crayon (**Edit**).
2. Remplace chaque `A_REMPLIR` par la valeur correspondante de l'étape 1.13.
3. Dans `coachEmails`, remplace `ton-email@exemple.fr` par **la même adresse** que dans les règles.
4. **Commit changes**. Une minute plus tard, recharge le site : la page d'accueil apparaît.

Exemple :
```js
firebase: {
  apiKey: "AIzaSy...",
  authDomain: "prepa-performance.firebaseapp.com",
  projectId: "prepa-performance",
  storageBucket: "prepa-performance.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
},
coachEmails: ["antoine@exemple.fr"],
```

> L'adresse de `coachEmails` est visible par qui lit le code du site. Tu peux utiliser une adresse dédiée à ton activité.

---

## Étape 4 · Créer ton compte coach et remplir tes réglages (10 min)

Fais-le tout de suite, avant de partager l'adresse.

1. Sur le site : **Créer mon compte** › ton adresse de coach + un mot de passe.
2. Tu reçois un e-mail de confirmation : ouvre le lien.
3. Reviens sur le site › **J'ai confirmé mon adresse**. Ton espace coach s'ouvre.
4. **Offres & réglages** :
   - tes coordonnées et tes prix ;
   - **Informations légales** : SIRET, adresse, carte professionnelle, assurance, médiateur. Tant qu'il en manque, un rappel s'affiche sur ton tableau de bord ;
   - **Enregistrer**. Tout apparaît sur la page d'accueil, dans les conditions de vente et dans les mentions légales.

---

## Étape 5 · Encaisser avec Stripe (15 min)

Sans Stripe, tes clients passent commande et tu confirmes toi-même chaque paiement (virement, espèces…). Avec Stripe, ils paient par carte sur une page sécurisée.

1. Crée un compte sur **stripe.com** et complète la vérification de ton activité (SIRET, IBAN).
2. **Paramètres › Informations publiques** : nom de l'activité, e-mail d'assistance, et les liens `https://ton-pseudo.github.io/prepa-performance/#cgv` (conditions) et `…/#confidentialite` (confidentialité).
3. **Paramètres › E-mails clients** : active les reçus de paiement réussi.
4. **Liens de paiement › Nouveau** : un lien par formule et par durée, au prix de ta grille (exemple : « Suivi — 1 mois », 99 €, paiement unique).
   - **Après le paiement** › **Ne pas afficher de page de confirmation, rediriger les clients vers votre site** :
     `https://ton-pseudo.github.io/prepa-performance/?paiement=ok&session_id={CHECKOUT_SESSION_ID}`
5. Copie chaque lien (`https://buy.stripe.com/…`) dans ton espace coach : **Offres & réglages › Paiement en ligne**, case de la formule et de la durée › **Enregistrer**.

Dès qu'un client paie, sa commande apparaît dans « À traiter » : vérifie le paiement dans Stripe et clique sur **Paiement reçu · activer**. Pour que ce soit automatique, passe à l'étape 6.

> Si tu changes un prix dans l'application, change aussi le lien Stripe correspondant.

---

## Étape 6 · Activation automatique après paiement (facultatif, 20 min)

Un petit relais gratuit (Cloudflare Workers : 100 000 requêtes par jour sans frais) reçoit la confirmation de Stripe, vérifie la signature et le montant, puis enregistre le paiement : l'accès du client s'ouvre en quelques secondes.

1. **Compte du relais** : Firebase › Authentication › Utilisateurs › **Ajouter un utilisateur** : une adresse (par exemple `relais@ton-domaine.fr`, elle n'a pas besoin d'exister) et un long mot de passe. Copie l'**UID** affiché dans la liste.
2. **Règles** : Firestore › Règles › remplace `RELAIS_UID` par cet UID › **Publier**.
3. **Cloudflare** : crée un compte gratuit sur **dash.cloudflare.com** › **Workers & Pages › Créer › Worker** › nom `relais-paiement` › **Déployer**, puis **Modifier le code** › remplace tout par le contenu du fichier `relais/worker.js` › **Déployer**. Note l'adresse du relais (`https://relais-paiement.….workers.dev`).
4. **Stripe** › Développeurs › **Webhooks** › **Ajouter une destination** : l'adresse du relais, événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Copie le **secret de signature** (`whsec_…`).
5. **Cloudflare** › ton relais › **Settings › Variables and Secrets** › ajoute, en type **Secret** :
   `STRIPE_WEBHOOK_SECRET` (le `whsec_…`), `FIREBASE_API_KEY` et `FIREBASE_PROJECT_ID` (ceux de `config.js`), `RELAIS_EMAIL` et `RELAIS_PASSWORD` (le compte du point 1) › **Déployer**.
6. Espace coach › **Offres & réglages › Paiement en ligne** › **Automatique (relais installé)** › Enregistrer.
7. **Teste en mode test Stripe** avant d'ouvrir : crée un lien de test, colle-le dans la grille, paie avec la carte `4242 4242 4242 4242` (date future, n'importe quel code) et vérifie que l'accès s'ouvre. Remets ensuite tes vrais liens.

Si un montant ne correspond pas à ta grille (code promo Stripe, prix modifié d'un seul côté), le paiement n'ouvre pas l'accès : il apparaît dans « À traiter » pour que tu le confirmes.

---

## Étape 7 · Codes d'essai et accès offerts

Espace coach › **Codes & essais** : choisis le type (essai ou offert), la formule, la durée (1 semaine à 3 mois), le programme (imposé ou au choix du client), le nombre d'utilisations (1 pour une personne, 30 pour un groupe ou un club) et une date limite. Partage le **lien** (le code est appliqué tout seul après l'inscription) ou le **code**. Un code ne sert qu'une fois par personne et ne se transforme jamais en paiement.

---

## Étape 8 · L'installer comme une application

- **iPhone** : ouvre le site dans Safari › bouton **Partager** › **Sur l'écran d'accueil**.
- **Android** : Chrome affiche **Installer l'application** (ou menu ⋮ › Installer).
- **Ordinateur** : Chrome ou Edge › icône d'installation dans la barre d'adresse.

L'application s'ouvre en plein écran, avec ton logo. Les séances restent consultables sans réseau (salle en sous-sol) et se synchronisent au retour du réseau.

Teste enfin le parcours complet avec une autre adresse e-mail : inscription, profil, code d'essai, séance, bilan. Supprime ensuite ce client de test (fiche › Notes › Supprimer).

---

## Ce que tu peux faire ensuite

- **Changer les prix, les liens, les codes, tes programmes et exercices** : directement dans ton espace coach, sans toucher au code.
- **Faire évoluer le site avec Claude** : relie GitHub à Claude (claude.ai › Paramètres › Connecteurs › GitHub) et demande la modification. Claude met à jour le dossier `app/`, reconstruit `docs/` et l'envoie sur GitHub. Sans connexion, Claude te renvoie un zip à déposer de la même façon qu'à l'étape 2.
- **Nom de domaine perso** (ex. `antoineprepa.fr`, ~10 € par an) : Settings › Pages › Custom domain, puis ajoute ce domaine dans Firebase (étape 1.6) et dans la redirection Stripe (étape 5.4).

## Limites de l'offre gratuite

- Firebase Spark : 50 000 lectures et 20 000 écritures par jour. Un client qui ouvre l'application lit son dossier complet, soit environ 100 à 150 lectures : de quoi suivre environ 100 clients actifs. Au-delà, il faudra passer à l'offre Blaze (paiement à l'usage) ; tu le verras venir dans Firebase › Firestore › Utilisation.
- Stripe : pas d'abonnement, une commission sur chaque paiement (voir stripe.com/fr/pricing).
- Pas de coach IA sur le site (il demande un compte Claude). La version Claude de l'application garde le coach IA ; les deux versions ont des bases de données séparées.
- Sur le site, la nutrition fonctionne avec le scan de code-barres (base Open Food Facts), une liste d'aliments courants et la saisie manuelle, sans photo de repas.
- Le contenu des programmes est dans le code de la page : un client ne voit ses séances qu'après paiement ou code, mais une personne qui s'y connaît peut lire ce contenu en fouillant le code.

## En cas de souci

| Ce que tu vois | Solution |
|---|---|
| « Le site n'est pas encore relié à Firebase » | Vérifie `docs/config.js` (étape 3), puis recharge la page. |
| « Ce site n'est pas encore autorisé dans Firebase » | Ajoute ton domaine `ton-pseudo.github.io` (étape 1.6). |
| Espace coach qui ne s'ouvre pas | L'adresse doit être identique, en minuscules, dans `config.js` **et** dans les règles Firestore, et confirmée par e-mail. |
| « Lecture de ton espace impossible » | Les règles Firestore ne sont pas publiées (étape 1.10). |
| Le client a payé mais rien ne s'ouvre | Mode manuel : confirme dans « À traiter ». Mode automatique : Stripe › Webhooks › événements en échec ; vérifie les 5 secrets et `RELAIS_UID` dans les règles. |
| « Activation refusée : ce code n'est plus valable » | Code expiré, désactivé ou déjà utilisé : crée un nouveau code. |
| Le site affiche une ancienne version | Recharge la page une seconde fois : la nouvelle version s'installe en arrière-plan. |
| Un client se rétracte | Alerte dans « À traiter » avec le montant au prorata : rembourse dans Stripe (Paiements › ⋯ › Rembourser, montant partiel), puis **Remboursement effectué · clôturer l'accès**. |
| Supprimer définitivement le compte d'un client | Fiche du client › Notes › Supprimer, puis Firebase › Authentication › Utilisateurs › supprimer l'adresse. |
