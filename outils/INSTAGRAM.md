# Robot Instagram : mode d'emploi

Chaque semaine, l'agence prépare tes posts et ouvre une pull request « Instagram · semaine du … ». Elle ajoute les images et le planning dans `docs/reseaux/AAAA-MM-JJ/`.
**Tu la regardes, puis tu la fusionnes : c'est ta validation.** Ensuite le robot publie chaque post et chaque carrousel à l'heure prévue.
Si tu ne fusionnes pas, rien ne part.

- **Les stories restent à toi.** L'API de Meta n'ajoute ni musique ni sticker (sondage, quiz). Les stories sont dans le même dossier, avec le jour et l'heure. Tu les publies depuis Instagram avec ta musique (environ 1 minute chacune).
- **Ce qui est publié** est noté dans `docs/reseaux/publie.json`. Le robot ne publie jamais deux fois la même chose.
- **Une publication en retard de plus de 36 h n'est plus publiée** : par exemple si tu fusionnes trop tard. Tu choisis alors de la publier à la main ou de la laisser.
- **En cas d'échec**, le robot ouvre une issue dans ce dépôt, et GitHub te prévient par e-mail.
- Pour arrêter le robot : onglet Actions › Instagram › « Disable workflow ».
- C'est gratuit : l'API Instagram de Meta est gratuite et GitHub Actions est inclus pour les dépôts publics.

## À faire une fois (environ 20 minutes)

Les écrans de Meta changent souvent : si un bouton a un autre nom, cherche le plus proche.

1. **Compte Instagram professionnel.** Dans Instagram : Paramètres › Type de compte et outils › Passer à un compte professionnel › Créateur.
2. **Compte développeur Meta.** Va sur developers.facebook.com, connecte-toi avec Facebook et accepte les conditions.
3. **Créer l'application.** Clique sur « Créer une app ». Choisis le cas d'usage « Gérer les messages et le contenu sur Instagram » (Instagram API) et nomme-la « Prépa Performance ». Elle peut rester en mode développement, car elle ne publie que sur ton compte.
4. **Le jeton.** Dans l'application, ouvre Instagram › « Configuration de l'API avec la connexion Instagram ». Dans « Générer des tokens d'accès », ajoute ton compte Instagram, connecte-toi et autorise la publication. Clique ensuite sur « Générer un token » et copie-le.
   - Si Meta demande d'ajouter le compte comme testeur : va dans Rôles de l'app › Testeurs Instagram. Ensuite, dans Instagram, accepte l'invitation (Paramètres › Apps et sites web).
5. **Le ranger dans GitHub, jamais ailleurs.** Dans ce dépôt, va dans Settings › Secrets and variables › Actions › New repository secret.
   - Nom : `INSTAGRAM_JETON`.
   - Valeur : le jeton.
   - Ne le colle nulle part ailleurs : ni dans un fichier, ni dans un message, ni dans une issue.
6. **Facultatif, pour ne plus y penser.** Le jeton Instagram dure 60 jours. Le robot le renouvelle tous les lundis s'il a le droit de réécrire le secret :
   - va sur github.com › Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate new token ;
   - choisis le dépôt `prepa-performance` seulement, la permission « Secrets : Read and write » et une durée d'un an ;
   - range-le comme à l'étape 5 sous le nom `JETON_GITHUB`.
   Sans lui, le robot t'ouvre une issue quand le jeton expire, et tu refais l'étape 4.
7. **Essai.** Onglet Actions › Instagram › Run workflow. Le robot publie seulement ce qui est à l'heure : s'il n'y a rien, il écrit « Rien à publier maintenant ».

## Pour l'agence

- Format de `planning.json` : `{"semaine", "publications": [{"id", "quand": "AAAA-MM-JJTHH:MM" (heure de Paris), "type": "post" | "carrousel" | "story", "images": [...], "auto": true | false, "legende"}]}`.
- Images en **JPEG**, aux formats 1080 × 1350 (post, carrousel de 2 à 10 images) ou 1080 × 1920 (story).
- Une story est toujours `"auto": false` (musique et stickers).
- Test : `python3 app/unit_instagram.py`. Il vérifie les formats, les limites d'Instagram et l'absence de compétition nommée.
