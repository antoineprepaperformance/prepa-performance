/* Configuration du site : à remplir une seule fois (voir MISE_EN_LIGNE.md, étape 3).
   Ces valeurs ne sont pas secrètes : la sécurité vient des règles Firestore. */
window.SITE_CONFIG = {
  firebase: {
    apiKey: "A_REMPLIR",
    authDomain: "A_REMPLIR.firebaseapp.com",
    projectId: "A_REMPLIR",
    storageBucket: "A_REMPLIR.firebasestorage.app",
    messagingSenderId: "A_REMPLIR",
    appId: "A_REMPLIR"
  },
  /* adresse(s) e-mail qui ouvrent l'espace coach : la même que dans les règles Firestore */
  coachEmails: ["ton-email@exemple.fr"],
  /* mentions légales affichées en bas de la page d'accueil */
  legal: {
    editeur: "Antoine Limousi",
    marque: "Antoine Prépa Performance",
    statut: "Entrepreneur individuel (micro-entreprise)"
  }
  /* SIRET, adresse, carte professionnelle, médiateur… : à remplir dans l'espace coach (Offres & réglages › Informations légales) */
};
