/* Configuration du site : à remplir une seule fois (voir MISE_EN_LIGNE.md, étape 3).
   Ces valeurs ne sont pas secrètes : la sécurité vient des règles Firestore. */
window.SITE_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCwjA5nsxXDo98K5oDcfVipGBqXu4-1V6Q",
    authDomain: "prepa-performance.firebaseapp.com",
    projectId: "prepa-performance",
    storageBucket: "prepa-performance.firebasestorage.app",
    messagingSenderId: "182693003527",
    appId: "1:182693003527:web:0bc9df5cbaf3a7bc5105a2"
  },
  /* adresse(s) e-mail qui ouvrent l'espace coach : la même que dans les règles Firestore */
  coachEmails: ["antoine.limousi@gmail.com"],
  /* mentions légales affichées en bas de la page d'accueil */
  legal: {
    editeur: "Antoine Limousi",
    marque: "Antoine Prépa Performance",
    statut: "Entrepreneur individuel (micro-entreprise)"
  }
  /* SIRET, adresse, carte professionnelle, médiateur… : à remplir dans l'espace coach (Offres & réglages › Informations légales) */
};
