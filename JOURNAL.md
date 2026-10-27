# Journal des mises à jour

Une entrée par mise à jour : la date, ce qui change, pourquoi, et les sources. C'est la mémoire d'un passage de Claude à l'autre :
on y lit ce qui a déjà été fait et ce qui a été écarté.

## 27 octobre 2026 · formule Coach IA, limites du coach IA, anglais et espagnol

- Formule Hybride retirée de la vente (les commandes passées restent lisibles). Nouvelle formule **Coach IA** (25 € / 47 € / 67 € pour 1, 2, 3 mois) : programme conduit par le coach IA (réponses, repas en photo, analyse du bilan, ajustements dans des limites de sécurité), sans réponse personnelle d'Antoine, qui reste prévenu en cas de douleur. Les formules où Antoine répond restent plus chères (Essentiel 49 €, Suivi 99 €).
- Limite d'utilisation du coach IA par jour et par formule (par défaut 10 questions et 3 photos ; Suivi 20 et 5), réglable par Antoine ; compteur visible par le client ; le relais l'applique aussi (2 demandes de marge pour l'analyse du bilan, qui ne compte pas).
- Langues : le site et l'application en anglais et en espagnol (choix FR / EN / ES, proposé automatiquement selon la langue du navigateur) ; le coach IA répond dans la langue du client ; Antoine voit la langue de chaque client et un bouton traduit les messages dans les deux sens. Textes juridiques traduits pour information, seule la version française fait foi.
- Documents mis à jour : guide du suivi en ligne (formule Coach IA, limites, langues), kit client (case Coach IA), bibliothèque Excel (offres et simulateur). Tests de durée d'accès rendus insensibles au changement d'heure (un an d'accès = 364,96 jours quand l'heure d'été tombe dans l'année).
- Écarté : passer à un abonnement Claude plus élevé pour un coach IA « illimité » (l'abonnement Claude d'Antoine ne sert pas aux clients du site) ; Workers AI payant (pas de plafond de dépense) tant qu'Antoine ne l'a pas décidé.

## 25 octobre 2026 · mise à jour automatique chaque semaine

- Chaque mardi vers 12 h 45 (juste après le renouvellement du quota Claude de la semaine ; le premier passage, prévu le lundi matin, avait été bloqué par ce quota), une session de Claude relit le dépôt, les idées d'Antoine et ce journal, corrige ce qui ne va pas, ajoute du contenu utile, lance toute la batterie de tests et propose la mise à jour dans une pull request. Antoine la valide d'un clic ; l'adresse du site ne change pas.
- Règles de travail dans `CLAUDE.md` ; tests en une commande : `bash app/tests.sh`.

## 24 octobre 2026 · profil sportif, dépense du jour, montres, valeurs de l'ANSES

- Inscription : année de naissance, taille et poids obligatoires ; records facultatifs adaptés au sport (charges en % du maximum, allures, test de départ pré-rempli) ; « Mon profil sportif » dans le profil.
- Questionnaire santé : chaque « oui » doit être précisé ; la précision est visible par le coach et lue par le coach IA.
- Nutrition : dépense énergétique journalière (Mifflin-St Jeor 1990) et carte « Ma dépense du jour » (calories actives ou pas, effet thermique des repas : Westerterp 2004, MET : Ainsworth 2011) ; bonus d'activité limité à la moitié du surplus, 400 kcal au plus (montres imprécises sur la dépense : Fuller 2020).
- Montres et téléphones : envoi automatique par le relais (Raccourci iPhone, Health Connect Webhook sur Android), lien personnel révocable, valeurs gardées 14 jours au plus au relais.
- Valeurs nutritionnelles de la table Ciqual 2025 de l'ANSES partout ; robot mensuel `.github/workflows/ciqual.yml`.
- Écarté : lecture directe d'Apple Santé ou de Health Connect par le site (impossible pour un site internet) ; automatisation iPhone à heure fixe (Santé est verrouillée quand l'iPhone l'est).

## 24 octobre 2026 · coach IA gratuit sur le site, messagerie

- Coach IA du site par Cloudflare Workers AI (Gemma 4, gratuit) ; messagerie coach ↔ client dans l'application, contact uniquement par écrit.
- Écarté : API Claude (payante), offre gratuite de Gemini (interdite pour des utilisateurs dans l'Espace économique européen).
