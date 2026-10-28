# Journal des mises à jour

Une entrée par mise à jour : la date, ce qui change, pourquoi, et les sources. C'est la mémoire d'un passage de Claude à l'autre :
on y lit ce qui a déjà été fait et ce qui a été écarté.

## 28 octobre 2026 (soir) · lisibilité, personnalisation, thèmes et défis de saison

- **Plus lisible et plus aéré** (site et application) : texte de base à 16 px, petits textes à 13-14 px au lieu de 11-12, boutons d'au moins 40 à 46 px de haut, plus d'espace entre les cartes, barre d'onglets plus lisible. Rien n'est déplacé : les mêmes onglets, aux mêmes places.
- **Le langage suit le profil** : athlète confirmé (niveau 2 et plus) = vocabulaire du préparateur (RIR, tempo, % du maximum, échauffement RAMP, charge en UA) avec un lien « Comprendre les consignes » (glossaire) ; remise en forme et débutants = mots simples (« 3 séries de 10 », « garde 2 répétitions en réserve », « repos 75 s »), une seule question sur la forme du jour (échelle 1 à 5 inspirée du Perceived Recovery Status, Laurent et al. 2011) au lieu des 5 questions et de la détente. Chaque client peut forcer « Simple » ou « Détaillé » dans Mon profil.
- **Page du jour** : nouvelle carte « À faire aujourd'hui » (séance, bilan, tests de fin de bloc, repas, habitudes) qui remplace les alertes éparpillées ; chaque client affiche, masque et range les autres blocs.
- **Apparence** (Mon profil › Apparence et affichage, enregistrée sur le compte, reprise sur tous les appareils) : thème automatique, sombre ou clair ; 6 couleurs (or par défaut, bleu, vert, rouge, violet, argent) ; texte normal, grand ou très grand.
- **Thèmes et défis de saison**, automatiques aux bonnes dates : Halloween, Noël (calendrier de l'Avent), Nouvel an, Pâques (date calculée), rentrée, et les grandes compétitions de 2027 aux dates officielles (handball en janvier, rugby international en février-mars, finale européenne de rugby des clubs en mai, phases finales du championnat de France de rugby en juin, grande course cycliste de juillet, championnats du monde d'athlétisme en septembre, rugby mondial en octobre-novembre). À la demande d'Antoine, elles sont annoncées **sans leur nom officiel, sans équipe, sans pays ni ville** : « une grande compétition de rugby arrive, du … au … ». Couleurs de l'événement, petites décorations (immobiles si le téléphone demande moins d'animations), compte à rebours et **un défi à chaque fois** (séances ou jours actifs comptés automatiquement), avec un badge sur la carte athlète. Jamais de logo, d'image ni de nom officiel d'une compétition : seulement ce qu'elle est et ses dates. Antoine coupe un événement, change son message ou en voit l'aperçu dans Offres & réglages.
- **Droit** : la page d'accueil publique ne montre que les fêtes. Utiliser une compétition pour vendre peut porter atteinte au droit d'exploitation de l'organisateur (code du sport, art. L333-1 ; tribunal judiciaire de Paris, 6 janvier 2026, FFR c. Royaltiz, publications commerciales calées sur le Tournoi). Dans l'application, pour les clients déjà inscrits, l'annonce d'une grande compétition et de ses dates publiques, sans son nom, reste une information (Cass. com., 20 mai 2014, n° 13-12102, Fiat). Pas d'allusion à une équipe nationale.
- Dates vérifiées sur les sites des organisateurs et fédérations (octobre 2026) ; les éditions 2028 et suivantes sont à ajouter dans `app/src/26_saisons.js` (voir CLAUDE.md, règle 12). Test ajouté : `e2e_perso.py`.
- Écarté : réorganiser la barre d'onglets (onglet « Moi ») ; les habitudes et les tests en dépendent, et rien ne pressait.

## 28 octobre 2026 (après-midi) · nutrition : portions parlantes et saisie en une phrase

- « Saisir un repas » : chaque aliment se compte en portions du quotidien (2 × tranche, 1 × œuf moyen, 1 × cuillère à soupe, 1 × bol…) au lieu de « pour 100 g ». Le poids et les calories s'affichent à côté, et « g » (ou « ml ») reste au choix pour qui pèse.
- On peut taper tout son repas d'un coup : « deux parts de brioche, beurre de cacahuète et un œuf » donne 2 parts de brioche (90 g), 1 cuillère à soupe de beurre de cacahuète (15 g) et 1 œuf moyen (50 g), sans passer par le coach IA. Reconnaît les nombres en lettres, ½, « c. à s. », « g », « cl », les tailles (petit, gros) et plusieurs aliments séparés par des virgules, « et », « avec », « sur »…
- Les repas estimés par le coach IA, les plats types et les produits déjà saisis s'affichent aussi en portions quand ça tombe juste (sinon en grammes, avec l'équivalent : « ≈ 1½ × assiette moyenne »).
- Repères dans `content_nutri.py` (MESURES) : poids mangés moyens, arrondis ; œufs selon les catégories de poids du règlement (CE) n° 589/2008. Le poids enregistré reste en grammes : rien ne change pour les repas déjà notés ni pour les cibles.
- Sources : Amoutzopoulos B et al., Portion size estimation in dietary assessment: a systematic review of existing tools, Nutr Rev 2020;78(11):885-900 (on estime mal les grammes sans balance ; les repères ménagers aident) ; règlement (CE) n° 589/2008, art. 4. Valeurs nutritionnelles inchangées : table Ciqual de l'ANSES.

## 28 octobre 2026 · finances, factures et secrétariat

- Espace coach, nouvel onglet **Finances** : factures numérotées automatiquement à chaque paiement (AAAA-NNNN, mention EI, SIRET, période, « TVA non applicable, art. 293 B du CGI », acquittée), avoir sur la facture d'origine à chaque remboursement, registre jamais modifié ni supprimé (règle Firestore `factures`). Le client télécharge sa facture et son avoir dans « Mes commandes ». Paiement direct : le moyen (virement, espèces…) se choisit à l'activation.
- Ventes de l'application par mois (ventes, remboursements, chiffre d'affaires, cotisations estimées 26,1 % + 0,2 %, versement libératoire en option), rappel de la déclaration URSSAF mensuelle sur le tableau de bord jusqu'au clic « J'ai déclaré et payé », export CSV du livre des recettes et du registre des factures (Excel français).
- Classeur de pilotage : taux 2026 corrigé (26,1 %, décret n° 2024-484), déclaration mensuelle, feuille « Ventes appli » additionnée au tableau de bord, déclarations URSSAF mensuelles avec statut, **Échéancier** (URSSAF, CFE, impôts, facturation électronique, renouvellements) et **Routine** du secrétaire.
- Sources : URSSAF et décret n° 2024-484 (taux), arrêté du 3 octobre 1983 (note dès 25 €), loi du 14 février 2022 (mention EI), calendrier de la facturation électronique (réception 1er septembre 2026, émission et e-reporting des micro-entreprises 1er septembre 2027). Test ajouté : `e2e_factures.py`.

## 28 octobre 2026 · nouvelle grille : 1, 3, 6 et 12 mois, Sur mesure, Lite + Nutrition

- Après une étude du marché français (coachs en ligne, applications, salles ; étude jointe dans l'espace de travail d'Antoine), grille revue pour gagner plus sans prendre plus de temps : **Coach IA** 29 / 79 / 149 / 279 €, **Essentiel** 59 / 159 / 299 / 569 €, **Suivi** 119 / 319 / 599 / 1 139 € (mise en avant « Recommandé »), nouvelle formule **Sur mesure** 199 / 539 / 999 / 1 899 € (programme écrit par Antoine pour le sport, le poste et le calendrier, réécrit à chaque bloc, 2 corrections vidéo par semaine, réponses en priorité, **places limitées**, 5 par défaut, réglables, « Complète » quand c'est plein). Pour 1, 3, 6 et 12 mois ; « 2 mois » n'est plus vendu (les commandes passées restent valables).
- **6 et 12 mois** : accès daté (début → fin) comme le Lite ; les programmes de 12 semaines s'enchaînent (le client choisit le suivant, Antoine l'écrit en Sur mesure) ; une commande de la même formule et du même programme prolonge l'accès ; un client en 1 ou 3 mois qui passe à 6 ou 12 mois garde son programme. Clause blessure ou contre-indication médicale avec certificat : pause ou remboursement au prorata, au choix du client (CGV article 7 ter, recommandation n° 87-03 de la Commission des clauses abusives). Règles Firestore : durée payée bornée (32, 93, 186 ou 367 jours), aucun allongement sans paiement ou code.
- **Lite** (9,90 € / 89 €) sans la nutrition ; **Lite + Nutrition** (14,90 € / 129 €) l'ajoute (objectif, journal, plats types, scan, recettes). Les accès Lite d'avant le 28 octobre 2026 gardent la nutrition. Onglet Nutrition du Lite simple : présentation de l'option (Jäger 2017 cité), suivi de l'eau conservé.
- Corrections vidéo par Antoine comptées sur 7 jours glissants (1 en Suivi, 2 en Sur mesure) ; coach IA Sur mesure : 30 questions et 8 photos par jour. Délais de réponse « sous 48 h / 24 h ouvrées » définis dans les CGV.
- Espace coach : grille des prix 4 × 4, 16 liens Stripe (+ 8 liens Lite), places Sur mesure, option nutrition des Lite, codes de 6 et 12 mois et Lite + Nutrition, accès daté modifiable (date de fin, prolonger d'un mois ou d'un an), alerte « programme Sur mesure à écrire », revenu mensuel des 6 et 12 mois. Relais : nouvelle grille (« tarifs »), anciens prix acceptés seulement pour les liens 2 mois, Lite + Nutrition (référence « -n »).
- Documents : guide (parties 1, 2.4, 3 et 7.8), kit client (cases de durée), bibliothèque Excel (feuille Offres 4 × 4, Lite + Nutrition), MISE_EN_LIGNE (16 liens, désactiver les anciens), CONFORMITE. Test ajouté : `e2e_tarifs.py`.
- Écarté pour l'instant (étape 2) : abonnements mensuels des formules suivies avec frais de démarrage, ventes à l'unité.

## 27 octobre 2026 (soir) · plats types

- Nutrition › Saisir : **54 plats types** en portion habituelle (petit-déjeuner, assiettes du sportif, plats du quotidien, sur le pouce, collations), valeurs de la table Ciqual de l'ANSES (plats composés de la table, ou assiette d'aliments ; relues dans la table chargée comme les aliments courants : `content_nutri.py`, PLATS).
- « Idées pour ce repas » : 6 plats du moment de la journée les plus proches des calories à viser pour ce repas (reste du jour réparti selon les repas restants, au plus 1,25 fois la part habituelle du repas), avec assez de protéines ; la restauration rapide passe après le fait maison. En mode équilibre : noms seulement, sans chiffres.

## 27 octobre 2026 (soir) · hydratation

- Nutrition › Mon journal : carte **Hydratation**. Objectif d'eau du jour = base de 33 mL par kg (1,5 à 3,5 L ; repère de 1,6 ou 2 L sans le poids en mode équilibre, d'après les apports de référence de l'EFSA 2010) + la sueur des séances et activités notées ce jour-là (débit mesuré par le test de pesée, sinon 0,5 L par heure ; au plus 2,5 L de plus). Boutons + 250, + 500, + 750, − 250 mL, saisie du total, 7 derniers jours. Même donnée que « Eau bue » de Ma santé du jour (et du raccourci iPhone).
- Test de sueur (pas en mode équilibre) : poids avant et après, boisson, durée → débit en L par heure, perte en % du poids (seuil de 2 %, Sawka 2007), quantité à reboire (1,5 fois la perte, Shirreffs 1996).
- Conseils : couleur des urines (Armstrong 1994), avant la séance 5 à 7 mL par kg (Thomas 2016), objectif perte de poids : 500 mL avant les repas principaux (Parretti 2015). Résumé sur l'écran Aujourd'hui ; le coach IA voit l'eau du jour et le débit de sueur. Politique de confidentialité et registre complétés (eau bue, test de sueur).

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
