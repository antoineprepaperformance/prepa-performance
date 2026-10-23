# Conformité juridique — Antoine Prépa Performance

Point fait le 22 octobre 2026 sur le droit français et européen (avec ce qui change si tu as des clients hors de France). Je ne suis pas avocat : ce document te dit ce qui est déjà en place dans le site et l'application, et ce qu'il te reste à faire. Fais relire tes conditions de vente par un professionnel (avocat, CCI, ta fédération) avant d'ouvrir les ventes.

---

## 1. Ce qui est déjà intégré

| Obligation | Texte | Dans le site et l'application |
|---|---|---|
| Informer avant la commande : services, prix, durée, identité du vendeur | Code de la consommation, L111-1 et L221-5 | Récapitulatif avant paiement, conditions générales de vente (CGV), mentions légales |
| Bouton de commande sans ambiguïté | L221-14 | « Commander avec obligation de paiement · 99 € » |
| Acceptation des CGV, avec preuve | — | Case obligatoire, version et heure enregistrées dans chaque commande |
| Confirmation sur support durable | L221-13 | Récapitulatif téléchargeable dans « Mes commandes » + reçu Stripe par e-mail |
| Droit de rétractation de 14 jours | L221-18 | Expliqué dans les CGV, compté à partir de la commande |
| Accompagnement commencé pendant le délai | L221-25 | Case « Je demande que mon accompagnement commence dès l'activation… » ; remboursement calculé au prorata |
| Rétractation en ligne en deux clics (depuis le 19 juin 2026) | L221-21 modifié (ordonnance n° 2026-2) | « Renoncer au contrat ici » puis « Confirmer la rétractation », accusé de réception horodaté téléchargé aussitôt, alerte de remboursement chez toi |
| Formulaire type de rétractation | R221-1 et annexe | Dans les CGV |
| Pas d'abonnement caché | L215-1 et suivants (non concernés) | Paiement unique, aucun renouvellement automatique, écrit partout |
| Garantie légale de conformité des services numériques | L224-25-1 et suivants | Dans les CGV |
| Médiateur de la consommation affiché | L612-1, L616-1 | Champ dans tes réglages, repris dans les CGV et les mentions légales |
| Mentions légales | Loi pour la confiance dans l'économie numérique (LCEN) | Éditeur, SIRET, contact, carte professionnelle, assurance, hébergeurs |
| Mention TVA en franchise | Code général des impôts, art. 293 B | « Prix nets : TVA non applicable, article 293 B du CGI » (modifiable si tu deviens assujetti) |
| Données de santé : consentement explicite et séparé | RGPD, art. 9.2.a | Case dédiée à l'inscription, distincte des CGV, retirable |
| Information sur les données | RGPD, art. 13 | Politique de confidentialité : finalités, bases légales, prestataires, transferts, durées, droits, CNIL |
| Mineurs | RGPD art. 8 et loi Informatique et Libertés art. 45 (15 ans) ; capacité à contracter | Coordonnées et accord d'un parent avant 18 ans, commande passée par le parent, pas de test de charge maximale, profil plafonné |
| Droit à l'effacement | RGPD, art. 17 | Suppression complète d'un client depuis sa fiche |
| Sécurité des données | RGPD, art. 32 | Chaque client ne lit que son dossier ; un accès ne s'ouvre qu'avec un paiement vérifié (signature Stripe + montant) ou un code valide à usage unique ; testé |
| Traceurs | Lignes directrices CNIL | Aucun cookie publicitaire ni de mesure d'audience : pas de bandeau nécessaire |
| Paiement | DSP2, PCI-DSS | Stripe (authentification forte) ; aucune donnée bancaire ne passe par ton site |
| Santé et sécurité | Code du sport, obligation de sécurité | Questionnaire santé ; un « oui » bloque les séances intenses (mode Reprise) jusqu'à ce que tu enregistres l'avis médical ; règle de la douleur ; « ne remplace pas un avis médical » |
| Pas d'exercice illégal | Code de la santé publique (diététicien L4371-1, kinésithérapeute) | Aucun titre protégé employé ; « poursuis ta rééducation avec ton kiné » ; nutrition présentée comme des repères |
| Intelligence artificielle (version Claude) | Règlement européen sur l'IA, art. 50 (depuis le 2 août 2026) | « Tu échanges avec une intelligence artificielle (Claude, d'Anthropic), pas avec Antoine » dans le coach IA et la confidentialité |
| Accessibilité numérique | Directive (UE) 2019/882 | Les microentreprises de services (moins de 10 salariés et 2 M€ de chiffre d'affaires ou de bilan) en sont exemptées ; le site reste lisible au clavier et en grand texte |
| Hébergement de données de santé (HDS) | Code de la santé publique, L1111-8 | Non exigé pour du coaching sportif hors parcours de soins (voir point 2.9) |

---

## 2. Ce qu'il te reste à faire

1. **Carte professionnelle d'éducateur sportif à jour.** Encadrer contre rémunération, y compris en ligne, demande un diplôme reconnu et la carte (code du sport, L212-1 et L212-11). Le ministère l'a confirmé pour le coaching en ligne. Renseigne son numéro dans tes réglages.
2. **Assurance responsabilité civile professionnelle** qui couvre explicitement le coaching à distance et tes clients hors de France (Monaco, etc.). Renseigne l'assureur et la couverture dans tes réglages.
3. **Médiateur de la consommation.** Adhère à un médiateur référencé (liste sur economie.gouv.fr, comptes quelques dizaines d'euros par an) et renseigne son nom et son site. Sans médiateur, une amende administrative est possible.
4. **Fais relire les CGV.** Le modèle intégré suit le code de la consommation, mais une relecture adaptée à ta situation reste indispensable.
5. **Factures.** Une note est obligatoire pour toute prestation de 25 € ou plus à un particulier : numérotation continue, mentions légales, « TVA non applicable, art. 293 B du CGI ». Utilise ton outil de facturation ou l'option de facture de Stripe, et tiens ton livre des recettes.
6. **TVA.** Vérifie chaque année les seuils de franchise sur impots.gouv.fr. Si tu vends à des particuliers d'autres pays de l'UE plus de 10 000 € par an de services en ligne automatisés (l'offre Essentiel peut en faire partie), la TVA de leur pays s'applique (guichet unique OSS). Monaco suit la TVA française.
7. **Registre des traitements** (RGPD, art. 30). Obligatoire même pour une petite activité, car tu traites des données de santé. Modèle ci-dessous ; la CNIL en propose un aussi.
8. **Firebase.** Dans Paramètres du projet › Confidentialité, accepte les conditions de traitement des données. Garde la base en Europe (étape 1.8 du guide).
9. **Recovery Lab IMCS.** N'utilise pas ce site pour les patients suivis sur prescription médicale ou dans le parcours de soins de la clinique : là, un hébergeur certifié HDS serait obligatoire. Pour le coaching sportif, il ne l'est pas.
10. **Communication et Instagram.** Pas de résultat chiffré garanti (« −10 kg en 1 mois ») : c'est une pratique commerciale trompeuse (L121-2). Pour les photos avant/après ou les témoignages, garde l'accord écrit du client.
11. **Clients hors de France.** Le RGPD s'applique à toutes tes données. Un consommateur d'un autre pays garde les règles protectrices de son pays (les CGV le disent). Évite de cibler activement des pays hors UE sans vérifier leurs règles (Suisse, Royaume-Uni, États-Unis).
12. **Conserve les preuves** : commandes (version des CGV, heure), accusés de rétractation, remboursements. Pièces comptables : 10 ans.

---

## 3. Modèle de registre des traitements

| Traitement | Finalité | Base légale | Personnes | Données | Destinataires | Hors UE | Durée | Sécurité |
|---|---|---|---|---|---|---|---|---|
| Suivi des clients | Programmes, séances, bilans, nutrition | Contrat ; consentement explicite pour la santé | Clients (et parents des mineurs) | Identité, contact, sport, questionnaire santé, douleurs, poids, tests, repas, photo facultative | Antoine ; Google Firebase (hébergement) ; GitHub (pages) | Oui : comptes Firebase, encadré (cadre UE–États-Unis, clauses types) | Accompagnement + 3 mois (santé), 3 ans (contact) | Accès limité par compte, règles de sécurité, chiffrement en transit |
| Commandes et paiements | Vente, facturation, rétractation | Contrat ; obligation légale | Clients | Commande, montant, statut, e-mail | Antoine ; Stripe ; Cloudflare (relais, si activé) | Oui, encadré | 10 ans (comptabilité) | Paiement chez Stripe, signature vérifiée |
| Codes d'essai | Offres gratuites | Contrat | Bénéficiaires | Code, date d'utilisation | Antoine | Non | Durée du code + 1 an | Code à usage unique |
| Coach IA (version Claude) | Réponses et ajustements | Consentement | Clients | Dossier du client, photos de repas | Anthropic | Oui, encadré | Durée de l'accompagnement | Visible par Antoine, ajustements annulables |

---

## Sources

- [Économie.gouv.fr — Vente à distance et droit de rétractation](https://www.economie.gouv.fr/particuliers/vente-distance-droit-retractation)
- [Cabinet Cholez-Pagotto — Bouton de rétractation obligatoire depuis le 19 juin 2026](https://cholez-pagotto.fr/blog/bouton-de-retractation-obligation-vente-en-ligne-19-juin-2026)
- [Assemblée nationale — Question sur le coaching sportif en ligne (carte professionnelle)](https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE714.pdf)
- [INC — Médiation de la consommation et fin de la plateforme européenne RLL](https://www.inc-conso.fr/content/reglement-en-ligne-des-litiges-de-consommation-leurope-ferme-sa-plateforme-mais-des)
- [Agence Scroll — Hébergement HDS et applications de suivi sportif](https://agence-scroll.com/blog/hebergement-hds-application-sante-obligations)
- [Mondaq — Règlement IA : obligations de transparence en vigueur](https://www.mondaq.com/uk/compliance/1826042/not-delayed-not-deferred-eu-ai-act-transparency-obligations-are-now-in-force)
- [Données personnelles — Accessibilité numérique et microentreprises](https://www.donneespersonnelles.fr/accessibilite-numerique-entreprises)
- [Stripe — Paramètres d'URL des liens de paiement](https://docs.stripe.com/payment-links/url-parameters)
- [Stripe — Après un paiement par lien (redirection, reçus, remboursements)](https://docs.stripe.com/payment-links/post-payment)
