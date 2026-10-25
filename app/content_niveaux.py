# -*- coding: utf-8 -*-
"""Profils de niveau — Antoine Prépa Performance.
Le profil ne change pas les exercices du programme : il change la dose et le niveau de précision
de chaque consigne (charge en % du maximum et en kg, tempo, récupération, vitesse, prévention,
contrôle de forme, affûtage avant compétition)."""

NIVEAUX = [
    {"id": "reprise", "n": "Reprise", "short": "Débutant ou retour après une longue pause",
     "who": "Moins de 6 mois de musculation, pas de compétition, ou reprise après plus de 3 mois d'arrêt.",
     "what": ["Une série de moins sur les exercices de musculation", "Une répétition en réserve de plus (RIR + 1)",
              "Sauts et sprints en version douce (80 à 90 % de ton maximum)", "Priorité à la technique : arrête la série dès qu'une répétition se dégrade"]},
    {"id": "sportif", "n": "Sportif", "short": "Pratique régulière, loisir ou compétition départementale",
     "who": "Entraînement régulier depuis plus de 6 mois, compétition loisir ou départementale.",
     "what": ["Le programme tel qu'Antoine l'a construit", "Effort piloté par les répétitions en réserve (RIR)", "Charges notées à chaque séance pour progresser"]},
    {"id": "perf", "n": "Performance", "short": "Compétiteur régional ou national",
     "who": "Compétition régionale ou nationale, au moins 6 mois de musculation régulière.",
     "what": ["Charge cible en % de ton maximum, convertie en kg dès que ton maximum est connu", "Tempo et récupération exacts pour chaque exercice",
              "Échauffement RAMP détaillé et potentialisation avant les efforts rapides", "Bloc de prévention adapté à ton sport",
              "Contrôle de forme avant chaque séance, avec ajustement automatique", "Allures calculées depuis ta VMA (course)", "Affûtage la semaine de ta compétition"]},
    {"id": "elite", "n": "Haut niveau", "short": "Élite, professionnel, pôle espoir, centre de formation",
     "who": "Niveau national élite, international, professionnel ou structure de haut niveau, avec au moins 2 ans de musculation.",
     "what": ["Tout le profil Performance", "Seuil de perte de vitesse par série (capteur ou vidéo)", "Séries en grappes (clusters) sur les charges lourdes",
              "Une série de plus en semaines 2 et 3 sur la force et la puissance", "Séance D optionnelle : vitesse et robustesse", "Contrôle du chrono à chaque sprint"]},
]

NIV_QUESTIONS = {
    "compet": {"n": "Ton niveau de pratique", "o": [[0, "Pas de compétition"], [1, "Loisir ou départemental"], [2, "Régional"], [3, "National"], [4, "Élite, pro ou international"]]},
    "xp": {"n": "Ton expérience en musculation", "o": [[0, "Jamais ou presque"], [1, "Moins de 6 mois"], [2, "6 mois à 2 ans"], [3, "Plus de 2 ans"]]},
    "freq": {"n": "Séances possibles par semaine, en plus de ton sport", "o": [[2, "2"], [3, "3"], [4, "4 ou plus"]]},
}

NIV_SCIENCE = ("L'effort est piloté par les répétitions en réserve (Zourdos, 2016 ; Helms, 2016) et converti en pourcentage du maximum avec la relation "
               "répétitions–charge de la NSCA (Haff & Triplett, 2016). Au profil Haut niveau, la série s'arrête quand la vitesse de la barre chute de plus de 20 % : "
               "même gain de force avec moins de fatigue qu'à 40 % (Pareja-Blanco, 2017), et les séries en grappes maintiennent la puissance sur les charges lourdes (Tufano, 2017). "
               "L'échauffement suit la méthode RAMP (Jeffreys, 2007) et les efforts rapides sont précédés d'une potentialisation (Seitz & Haff, 2016). "
               "La prévention repose sur des protocoles validés : Nordic (moitié moins de blessures des ischios, van Dyk, 2019), Copenhague (−41 % de problèmes d'adducteurs, Harøy, 2019) "
               "et renforcement des rotateurs pour les sports de lancer (Andersson, 2017). Le contrôle de forme utilise un questionnaire de bien-être (McLean, 2010) et la détente verticale "
               "(Claudino, 2017). La semaine de compétition, le volume baisse de 40 à 60 % en gardant l'intensité (Bosquet, 2007). Les allures de course sont calculées depuis la VMA (Billat, 2001).")

NIV_REFS = [
    "Zourdos MC et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res. 2016;30(1):267-275.",
    "Helms ER et al. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42-49.",
    "Haff GG, Triplett NT (dir.). Essentials of Strength Training and Conditioning. 4e éd. Human Kinetics / NSCA; 2016.",
    "Pareja-Blanco F et al. Effects of velocity loss during resistance training on athletic performance, strength gains and muscle adaptations. Scand J Med Sci Sports. 2017;27(7):724-735.",
    "Tufano JJ, Brown LE, Haff GG. Theoretical and practical aspects of different cluster set structures: a systematic review. J Strength Cond Res. 2017;31(3):848-867.",
    "Jeffreys I. Warm-up revisited: the RAMP method of optimizing warm-ups. Professional Strength and Conditioning. 2007;(6):12-18.",
    "Seitz LB, Haff GG. Factors modulating post-activation potentiation of jump, sprint, throw, and upper-body ballistic performances: a systematic review with meta-analysis. Sports Med. 2016;46(2):231-240.",
    "van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med. 2019;53(21):1362-1370.",
    "Harøy J et al. The Adductor Strengthening Programme prevents groin problems among male football players: a cluster-randomised controlled trial. Br J Sports Med. 2019;53(3):150-157.",
    "Andersson SH et al. Preventing overuse shoulder injuries among throwing athletes: a cluster-randomised controlled trial in 660 elite handball players. Br J Sports Med. 2017;51(14):1073-1080.",
    "McLean BD et al. Neuromuscular, endocrine, and perceptual fatigue responses during different length between-match microcycles in professional rugby league players. Int J Sports Physiol Perform. 2010;5(3):367-383.",
    "Claudino JG et al. The countermovement jump to monitor neuromuscular status: a meta-analysis. J Sci Med Sport. 2017;20(4):397-402.",
    "Bosquet L, Montpetit J, Arvisais D, Mujika I. Effects of tapering on performance: a meta-analysis. Med Sci Sports Exerc. 2007;39(8):1358-1365.",
    "Billat LV. Interval training for performance: a scientific and empirical practice. Sports Med. 2001;31(1):13-31.",
    "Haugen T, Seiler S, Sandbakk Ø, Tønnessen E. The training and development of elite sprint performance: an integration of scientific and best practice literature. Sports Med Open. 2019;5(1):44.",
]

# Échauffements RAMP détaillés (profils Performance et Haut niveau)
RAMP = {
    "salle": "RAMP 12-15 min. Raise : 4 min de rameur ou de vélo en accélérant. Activate & Mobilise : 90/90 hanches × 5/côté, fente avec rotation × 5/côté, pont fessier × 10, écarté à l'élastique × 15, dead bug × 6/côté. Potentiate : 3 × 3 sauts verticaux, puis montée en charge sur le premier exercice : barre à vide × 5, 40 % × 5, 60 % × 3, 75 % × 2, 85 % × 1 avant les séries de travail.",
    "terrain": "RAMP 15-20 min. Raise : 400 m de footing, 2 × 20 m de pas chassés et de course arrière. Activate & Mobilise : fentes marchées avec rotation, A-skip, B-skip, jambes tendues, talons-fesses (2 × 20 m chacun), 10 pogos. Potentiate : 3 accélérations sur 30 m à 70, 80 puis 90 %, et 2 départs sur 10 m à 95 % avant la première série.",
    "course": "15 min. 10 min de footing facile, gammes (montées de genoux, talons-fesses, foulées bondissantes, 2 × 20 m de chaque), puis 3 lignes droites progressives de 80 m, récupération en marchant.",
    "maison": "RAMP 10 min. Raise : 2 min de montées de genoux sur place. Activate & Mobilise : 90/90 hanches × 5/côté, fente avec rotation × 5/côté, pont fessier × 15, bird dog × 6/côté. Potentiate : 2 × 5 squats sautés légers avant le premier exercice.",
}

# Prévention par famille de sport : [exercice, doses du bloc 1, du bloc 2, du bloc 3] (semaines 1 à 4 de chaque bloc)
PREV = {
    "ischios": ["nordic", ["2 × 4", "2 × 5", "3 × 5", "2 × 4"], ["3 × 5", "3 × 6", "3 × 6", "2 × 5"], ["3 × 6", "3 × 8", "3 × 8", "2 × 5"]],
    "adducteurs": ["copenhague", ["2 × 5/côté (levier court)", "2 × 6/côté", "3 × 6/côté", "2 × 5/côté"], ["2 × 8/côté", "3 × 8/côté", "3 × 8/côté", "2 × 6/côté"], ["3 × 8/côté", "3 × 10/côté", "3 × 10/côté", "2 × 6/côté"]],
    "epaule": ["rotateurs", ["2 × 12/bras", "3 × 12/bras", "3 × 12/bras", "2 × 10/bras"], ["3 × 12/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"], ["3 × 15/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"]],
    "omoplate": ["y_t_w", ["2 × 6 de chaque", "2 × 8 de chaque", "3 × 8 de chaque", "2 × 6 de chaque"], ["3 × 8 de chaque", "3 × 8 de chaque", "3 × 10 de chaque", "2 × 8 de chaque"], ["3 × 10 de chaque", "3 × 10 de chaque", "3 × 10 de chaque", "2 × 8 de chaque"]],
    "mollet": ["mollets_unipodal", ["3 × 30 s isométrique genou fléchi", "3 × 40 s", "4 × 40 s", "2 × 30 s"], ["3 × 12/jambe lent", "3 × 15/jambe", "4 × 15/jambe", "2 × 12/jambe"], ["4 × 12/jambe lesté", "4 × 15/jambe lesté", "4 × 15/jambe lesté", "2 × 12/jambe"]],
    "tibial": ["tibial", ["2 × 15", "2 × 20", "3 × 20", "2 × 15"], ["3 × 20", "3 × 20", "3 × 25", "2 × 15"], ["3 × 25", "3 × 25", "3 × 25", "2 × 20"]],
    "genou": ["spanish_squat", ["3 × 30 s isométrique", "4 × 30 s", "4 × 45 s", "3 × 30 s"], ["4 × 45 s", "5 × 45 s", "5 × 45 s", "3 × 30 s"], ["5 × 45 s", "5 × 45 s", "5 × 45 s", "3 × 30 s"]],
    "controle": ["step_down", ["2 × 8/jambe", "3 × 8/jambe", "3 × 10/jambe", "2 × 8/jambe"], ["3 × 10/jambe", "3 × 10/jambe", "3 × 12/jambe", "2 × 8/jambe"], ["3 × 12/jambe", "3 × 12/jambe", "3 × 12/jambe", "2 × 10/jambe"]],
}
PREV_BY_SPORT = {
    "collectif": ["ischios", "adducteurs"], "lancer": ["epaule", "omoplate"], "course": ["mollet", "tibial"], "sprint": ["ischios", "mollet"],
    "force": ["omoplate", "adducteurs"], "combat": ["epaule", "adducteurs"], "glisse": ["ischios", "controle"], "velo": ["genou", "controle"],
    "autre": ["ischios", "epaule"],
}
# mots-clés (sans accents, en minuscules) pour reconnaître le sport
SPORT_KEYS = {
    "lancer": ["handball", "hand-ball", "volley", "baseball", "softball", "tennis", "padel", "badminton", "natation", "water-polo", "waterpolo", "javelot", "escalade", "golf"],
    "collectif": ["rugby", "foot", "soccer", "futsal", "basket", "hockey", "ultimate", "hand", "frdr"],
    "course": ["course", "running", "trail", "marathon", "10 km", "5 km", "semi", "triathlon", "cross", "demi-fond", "fond"],
    "sprint": ["sprint", "athle", "bob", "skeleton", "haies", "saut", "decathlon", "heptathlon", "lancer de poids"],
    "force": ["halterophilie", "haltero", "powerlifting", "force athletique", "crossfit", "hyrox", "strongman", "musculation", "bodybuilding"],
    "combat": ["boxe", "mma", "judo", "lutte", "karate", "taekwondo", "jjb", "jiu", "kick", "muay", "escrime"],
    "glisse": ["ski", "snowboard", "surf", "skate"],
    "velo": ["velo", "cyclisme", "vtt", "bmx", "cycl"],
}
# Séance D optionnelle (profil Haut niveau) : [id, titre, focus, lieu, échauffement, items(e, t, r, w)]
SESSION_D = {
    "terrain": {"id": "D", "t": "Vitesse & robustesse", "focus": "Optionnelle : vitesse maximale en petit volume et prévention", "lieu": "Terrain", "wu": "terrain",
                "items": [{"e": "gammes", "t": "M", "r": "2 × 20 m de chaque"}, {"e": "sprint_lance", "t": "S", "r": "20 m d'élan + 10 m lancés"},
                          {"e": "pogo", "t": "PL"}, {"e": "nordic", "w": ["2 × 4", "2 × 5", "3 × 5", "2 × 4"]}, {"e": "copenhague", "w": ["2 × 6/côté", "2 × 8/côté", "3 × 8/côté", "2 × 6/côté"]},
                          {"e": "mob_hanche", "t": "M"}]},
    "course": {"id": "D", "t": "Footing & pieds", "focus": "Optionnelle : volume facile et robustesse du pied", "lieu": "Extérieur", "wu": "course",
               "items": [{"e": "footing_ef", "w": ["30 min très facile", "35 min", "40 min", "25 min"]}, {"e": "lignes_droites", "w": ["6 × 80 m", "8 × 80 m", "8 × 80 m", "4 × 80 m"]},
                         {"e": "tibial", "w": ["2 × 20", "3 × 20", "3 × 25", "2 × 15"]}, {"e": "mollets_unipodal", "w": ["3 × 15/jambe", "3 × 15/jambe", "4 × 15/jambe", "2 × 12/jambe"]}]},
    "salle": {"id": "D", "t": "Technique & robustesse", "focus": "Optionnelle : technique légère et prévention", "lieu": "Salle", "wu": "salle",
              "items": [{"e": "tirage_epaule", "t": "P", "n": "Charge légère : vitesse et placement"}, {"e": "y_t_w", "w": ["2 × 8 de chaque", "3 × 8", "3 × 10", "2 × 8"]},
                        {"e": "copenhague", "w": ["2 × 6/côté", "2 × 8/côté", "3 × 8/côté", "2 × 6/côté"]}, {"e": "mob_thoracique", "t": "M"}, {"e": "respiration", "t": "M", "r": "3 min"}]},
}
SESSION_D_FOR = {"vitesse": "terrain", "prepa": "terrain", "force": "salle", "run": "course"}

# ---------- records et performances déclarés à l'inscription (facultatifs) ----------
# type « kg » : charge × répétitions (maximum estimé par la formule d'Epley) ; « num » : un nombre ; « temps » : minutes:secondes.
# test : test de l'application auquel le record correspond (pré-rempli au test de départ, utilisé pour les charges et allures).
RECORDS = {
    "squat": {"n": "Squat (barre sur le dos)", "type": "kg", "test": "e1rm_squat"},
    "dc": {"n": "Développé couché", "type": "kg", "test": "e1rm_dc"},
    "sdt": {"n": "Soulevé de terre", "type": "kg", "test": "e1rm_sdt"},
    "epaule": {"n": "Épaulé (power clean ou en suspension)", "type": "kg", "test": "e1rm_epaule"},
    "arrache": {"n": "Arraché", "type": "kg"},
    "militaire": {"n": "Développé militaire", "type": "kg"},
    "tractions": {"n": "Tractions (maximum d'affilée)", "type": "num", "u": "rép."},
    "pompes": {"n": "Pompes (maximum d'affilée)", "type": "num", "u": "rép.", "test": "pompes"},
    "sprint10": {"n": "Sprint 10 m", "type": "num", "u": "s", "test": "sprint10"},
    "sprint30": {"n": "Sprint 30 m", "type": "num", "u": "s", "test": "sprint30"},
    "cmj": {"n": "Détente verticale (CMJ)", "type": "num", "u": "cm", "test": "cmj"},
    "longueur": {"n": "Saut en longueur sans élan", "type": "num", "u": "cm", "test": "longueur"},
    "vma": {"n": "VMA", "type": "num", "u": "km/h", "test": "vma", "k": 100},
    "t5km": {"n": "5 km", "type": "temps", "test": "t5km"},
    "t10km": {"n": "10 km", "type": "temps"},
    "semi": {"n": "Semi-marathon", "type": "temps"},
    "bronco": {"n": "Bronco (1 200 m)", "type": "temps", "test": "bronco", "sec": True},
    "yoyo": {"n": "Yo-Yo intermittent niveau 1", "type": "num", "u": "m", "test": "yoyo"},
    "ift": {"n": "30-15 IFT (VIFT)", "type": "num", "u": "km/h", "test": "ift"},
    "ttest": {"n": "T-test (agilité)", "type": "num", "u": "s", "test": "ttest"},
    "t505": {"n": "Test 505", "type": "num", "u": "s", "test": "t505"},
    "home1b": {"n": "Home → 1re base", "type": "num", "u": "s", "test": "home1b"},
    "ftp": {"n": "FTP vélo (puissance seuil)", "type": "num", "u": "W"},
    "n100": {"n": "100 m nage libre", "type": "temps"},
    "row2k": {"n": "2 000 m rameur", "type": "temps"},
}
REC_BASE = ["squat", "dc", "sdt", "tractions", "pompes"]
REC_SPORT = {
    "rugby": ["epaule", "sprint10", "sprint30", "cmj", "bronco"], "rugby7": ["epaule", "sprint10", "sprint30", "cmj", "bronco"],
    "foot": ["sprint10", "sprint30", "cmj", "vma", "yoyo"], "hand": ["sprint10", "cmj", "ttest", "yoyo"], "basket": ["sprint10", "cmj", "ttest"],
    "volley": ["cmj", "sprint10", "ttest"], "tennis": ["sprint10", "cmj", "t505"], "padel": ["sprint10", "cmj", "t505"], "badminton": ["sprint10", "cmj", "t505"],
    "baseball": ["epaule", "sprint10", "cmj", "home1b"], "hockey": ["sprint10", "cmj", "yoyo"], "bob": ["epaule", "sprint10", "sprint30", "cmj", "longueur"],
    "sprint": ["epaule", "sprint10", "sprint30", "cmj", "longueur"], "course": ["vma", "t5km", "t10km", "semi"], "trail": ["vma", "t10km", "semi"],
    "triathlon": ["vma", "t10km", "ftp", "n100"], "cyclisme": ["ftp", "vma"], "natation": ["n100"], "boxe": ["epaule", "cmj", "sprint10"],
    "lutte": ["epaule", "cmj", "sprint10"], "ski": ["cmj", "longueur", "vma"], "crossfit": ["epaule", "arrache", "militaire", "row2k"],
    "force": ["epaule", "arrache", "militaire"], "": ["cmj", "vma", "t5km"],
}
# questionnaire santé : ce qu'on demande de préciser après un « oui » (même ordre que SCREENING)
SCREEN_HINTS = [
    "Lequel ? Depuis quand ? Es-tu suivi(e) par un médecin, as-tu un traitement ?",
    "Quand : au repos, à l'effort ? Depuis quand ? As-tu consulté ?",
    "Quand et dans quelles circonstances ? Combien de fois ? As-tu consulté ?",
    "Laquelle ? Est-elle stabilisée et suivie par un médecin ?",
    "Quel traitement, et pour quoi ?",
    "Où ? Depuis quand ? Est-ce suivi par un kiné ou un médecin ?",
    "Quelle opération et quand ? Ou : terme de la grossesse et accord de ta sage-femme ou de ton médecin.",
]

NIVEAU_CONTENT = {"NIV": NIVEAUX, "NIVQ": NIV_QUESTIONS, "NIVSCI": NIV_SCIENCE, "NIVREFS": NIV_REFS, "RAMP": RAMP, "PREV": PREV,
                  "PREVSPORT": PREV_BY_SPORT, "SPORTKEYS": SPORT_KEYS, "SESD": SESSION_D, "SESDFOR": SESSION_D_FOR,
                  "RECORDS": RECORDS, "RECBASE": REC_BASE, "RECSPORT": REC_SPORT, "SCREENHINTS": SCREEN_HINTS}
