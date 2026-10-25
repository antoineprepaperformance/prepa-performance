# -*- coding: utf-8 -*-
"""Bibliothèque d'exercices — Antoine Prépa Performance.
Chaque exercice : id, n (nom), c (catégorie), eq (matériel), cues (consignes), alt (variante maison), reg, prog.
"""

E = []
def ex(id, n, c, eq, cues, alt=None, reg=None, prog=None):
    E.append({"id": id, "n": n, "c": c, "eq": eq, "cues": cues, "alt": alt, "reg": reg, "prog": prog})

# ---------------- Bas du corps ----------------
ex("squat_barre", "Squat arrière à la barre", "Bas du corps", "Barre",
   ["Pieds largeur d'épaules, pointes légèrement ouvertes", "Descendre hanches et genoux ensemble, dos neutre", "Pousser le sol, genoux dans l'axe des pieds"],
   alt="squat_goblet", reg="Squat sur box", prog="Squat avant")
ex("squat_avant", "Squat avant à la barre", "Bas du corps", "Barre",
   ["Barre sur l'avant des épaules, coudes hauts", "Buste vertical pendant toute la descente", "Remonter en gardant les coudes devant"],
   alt="squat_goblet", reg="Goblet squat", prog="Squat avant avec pause")
ex("squat_goblet", "Goblet squat", "Bas du corps", "Haltère ou kettlebell",
   ["Charge tenue contre la poitrine", "Coudes entre les genoux en bas du mouvement", "Talons au sol, remonter fort"],
   reg="Squat sur box", prog="Squat avant à la barre")
ex("squat_pdc", "Squat au poids du corps", "Bas du corps", "Poids du corps",
   ["Bras devant pour l'équilibre", "Descendre au moins cuisses parallèles", "Remonter sans décoller les talons"],
   reg="Squat sur box", prog="Goblet squat")
ex("squat_box", "Squat sur box (ou chaise)", "Bas du corps", "Box ou chaise",
   ["S'asseoir doucement, sans se laisser tomber", "Toucher la box puis repartir", "Garder le dos droit"],
   prog="Squat au poids du corps")
ex("fente_arriere", "Fente arrière", "Bas du corps", "Haltères ou poids du corps",
   ["Grand pas en arrière, genou arrière proche du sol", "Poids sur la jambe avant", "Revenir en poussant sur le talon avant"],
   reg="Fente arrière avec appui", prog="Fentes marchées")
ex("fente_marchee", "Fentes marchées", "Bas du corps", "Haltères ou poids du corps",
   ["Pas longs et contrôlés", "Buste droit, gainage serré", "Genou avant au-dessus du pied"],
   reg="Fente arrière", prog="Fentes marchées lestées")
ex("split_squat", "Split squat bulgare", "Bas du corps", "Banc + haltères",
   ["Pied arrière posé sur un banc", "Descendre verticalement, buste légèrement penché", "Pousser sur toute la plante du pied avant"],
   reg="Fente arrière", prog="Split squat lesté à la barre")
ex("step_up", "Montée sur box (step-up)", "Bas du corps", "Box ou marche",
   ["Pied entier sur la box", "Monter avec la jambe d'appui, sans pousser avec l'autre", "Redescendre lentement"],
   reg="Box plus basse", prog="Step-up lesté")
ex("presse", "Presse à cuisses", "Bas du corps", "Machine",
   ["Pieds largeur de hanches au milieu du plateau", "Descendre sans décoller le bassin", "Ne pas verrouiller les genoux en haut"],
   alt="split_squat", prog="Presse unipodale")
ex("chaise", "Chaise contre le mur", "Bas du corps", "Mur",
   ["Dos plaqué au mur, cuisses parallèles au sol", "Genoux à 90°, au-dessus des chevilles", "Respirer calmement"],
   reg="Angle plus ouvert", prog="Chaise unipodale")
ex("mollets", "Extensions des mollets debout", "Bas du corps", "Marche + haltère",
   ["Avant du pied sur une marche", "Monter haut, pause 1 s", "Descendre lentement sous la marche"],
   prog="Mollets unipodal")
ex("mollets_unipodal", "Mollets unipodal sur marche", "Bas du corps", "Marche",
   ["Une seule jambe, appui léger de la main", "Amplitude complète", "Descente en 3 secondes"],
   reg="Mollets deux jambes", prog="Mollets unipodal lesté")
ex("squat_unipodal_box", "Squat unipodal sur box", "Bas du corps", "Box",
   ["S'asseoir sur la box sur une jambe", "Genou dans l'axe du pied, pas vers l'intérieur", "Remonter sans élan"],
   reg="Box plus haute", prog="Pistol squat")

# ---------------- Chaîne postérieure ----------------
ex("sdt", "Soulevé de terre", "Chaîne postérieure", "Barre",
   ["Barre au-dessus du milieu du pied", "Dos neutre, épaules au-dessus de la barre", "Pousser le sol et finir hanches en avant"],
   alt="sdt_kb", reg="Soulevé de terre kettlebell", prog="Soulevé de terre avec pause")
ex("sdt_kb", "Soulevé de terre kettlebell", "Chaîne postérieure", "Kettlebell",
   ["Kettlebell entre les pieds", "Hanches en arrière, dos neutre", "Se relever en serrant les fessiers"],
   prog="Soulevé de terre")
ex("sdt_roumain", "Soulevé de terre roumain", "Chaîne postérieure", "Barre ou haltères",
   ["Genoux légèrement fléchis et fixes", "Pousser les hanches en arrière, charge le long des cuisses", "Descendre jusqu'à l'étirement des ischios, dos neutre"],
   alt="sdt_jambe", reg="Avec haltères légers", prog="Soulevé de terre roumain avec pause")
ex("sdt_jambe", "Soulevé de terre roumain unipodal", "Chaîne postérieure", "Haltère ou kettlebell",
   ["Jambe libre tendue vers l'arrière", "Bassin parallèle au sol", "Revenir en serrant le fessier d'appui"],
   reg="Avec appui de la main", prog="Avec charge plus lourde")
ex("hip_thrust", "Hip thrust", "Chaîne postérieure", "Banc + barre",
   ["Haut du dos sur le banc, pieds à plat", "Monter les hanches jusqu'à l'alignement épaules-genoux", "Pause 1 s en haut, menton rentré"],
   alt="pont_fessier", reg="Pont fessier au sol", prog="Hip thrust unipodal")
ex("pont_fessier", "Pont fessier", "Chaîne postérieure", "Poids du corps",
   ["Talons proches des fesses", "Pousser dans les talons et monter les hanches", "Pause 2 s en haut"],
   prog="Pont fessier unipodal")
ex("nordic", "Nordic hamstring", "Prévention", "Partenaire ou point d'ancrage",
   ["Chevilles bloquées, corps aligné des genoux aux épaules", "Se laisser descendre le plus lentement possible", "Se rattraper avec les mains, remonter en poussant"],
   reg="Amplitude réduite ou élastique d'assistance", prog="Tenir plus longtemps en bas")
ex("leg_curl_glisse", "Leg curl glissé au sol", "Chaîne postérieure", "Serviette ou disques glissants",
   ["Pont fessier, talons sur la serviette", "Tendre les jambes lentement en gardant les hanches hautes", "Ramener les talons"],
   reg="Phase excentrique seule", prog="Unipodal")
ex("kb_swing", "Kettlebell swing", "Chaîne postérieure", "Kettlebell",
   ["Mouvement de charnière de hanche, pas un squat", "Projeter les hanches pour envoyer la kettlebell à hauteur d'épaules", "Bras relâchés, gainage serré en haut"],
   reg="Soulevé de terre kettlebell", prog="Swing à une main")

# ---------------- Haut du corps ----------------
ex("dc_barre", "Développé couché à la barre", "Haut du corps", "Banc + barre",
   ["Omoplates serrées, pieds au sol", "Descendre la barre au bas des pectoraux", "Pousser en gardant les coudes à 45°"],
   alt="pompes", reg="Développé couché haltères", prog="Développé couché avec pause")
ex("dc_halteres", "Développé couché aux haltères", "Haut du corps", "Banc + haltères",
   ["Haltères au-dessus des épaules", "Descendre lentement jusqu'à l'étirement", "Remonter en rapprochant les haltères"],
   alt="pompes", prog="Développé couché à la barre")
ex("dc_incline", "Développé incliné aux haltères", "Haut du corps", "Banc incliné + haltères",
   ["Banc à 30°", "Coudes légèrement rentrés", "Contrôler la descente en 2 secondes"],
   alt="pompes_pieds", prog="Plus lourd")
ex("pompes", "Pompes", "Haut du corps", "Poids du corps",
   ["Mains sous les épaules, corps gainé", "Poitrine proche du sol", "Pousser sans creuser le dos"],
   reg="Pompes inclinées", prog="Pompes pieds surélevés")
ex("pompes_inclinees", "Pompes inclinées (mains surélevées)", "Haut du corps", "Banc ou table",
   ["Mains sur un support stable", "Corps aligné de la tête aux talons", "Plus le support est bas, plus c'est dur"],
   prog="Pompes")
ex("pompes_pieds", "Pompes pieds surélevés", "Haut du corps", "Banc",
   ["Pieds sur un banc", "Gainage maximal", "Amplitude complète"],
   reg="Pompes", prog="Pompes lestées")
ex("dm", "Développé militaire debout", "Haut du corps", "Barre",
   ["Fessiers et abdos serrés", "Pousser la barre au-dessus de la tête, tête qui passe dessous", "Finir bras tendus, barre au-dessus des pieds"],
   alt="dm_halteres", reg="Développé épaules haltères assis", prog="Push press")
ex("dm_halteres", "Développé épaules aux haltères", "Haut du corps", "Haltères",
   ["Debout ou assis, dos neutre", "Pousser au-dessus de la tête sans cambrer", "Descendre jusqu'aux oreilles"],
   prog="Développé militaire à la barre")
ex("landmine_press", "Développé landmine à un bras", "Haut du corps", "Barre + coin",
   ["Pied opposé en avant", "Pousser vers le haut et l'avant", "Gainage anti-rotation"],
   alt="dm_halteres", prog="Plus lourd")
ex("tractions", "Tractions", "Haut du corps", "Barre de traction",
   ["Prise un peu plus large que les épaules", "Tirer les coudes vers les hanches", "Menton au-dessus de la barre, descente contrôlée"],
   alt="tirage_elastique", reg="Tractions assistées", prog="Tractions lestées")
ex("tractions_assist", "Tractions assistées (élastique)", "Haut du corps", "Barre + élastique",
   ["Élastique sous les genoux ou les pieds", "Même technique que les tractions", "Réduire l'assistance au fil des semaines"],
   alt="tirage_elastique", prog="Tractions")
ex("tirage_vertical", "Tirage vertical à la poulie", "Haut du corps", "Machine",
   ["Poitrine sortie", "Tirer la barre vers le haut des pectoraux", "Remonter lentement bras tendus"],
   alt="tirage_elastique", prog="Tractions")
ex("rowing_barre", "Rowing barre buste penché", "Haut du corps", "Barre",
   ["Buste à 45°, dos neutre", "Tirer la barre vers le nombril", "Serrer les omoplates en haut"],
   alt="rowing_haltere", prog="Plus lourd")
ex("rowing_haltere", "Rowing haltère un bras", "Haut du corps", "Banc + haltère",
   ["Main et genou sur le banc", "Tirer le coude vers la hanche", "Pas de rotation du buste"],
   prog="Plus lourd")
ex("rowing_inverse", "Rowing inversé", "Haut du corps", "Barre basse ou sangles",
   ["Corps gainé sous la barre", "Tirer la poitrine vers la barre", "Plus les pieds sont loin, plus c'est dur"],
   alt="tirage_elastique", prog="Pieds surélevés")
ex("tirage_elastique", "Tirage horizontal à l'élastique", "Haut du corps", "Élastique",
   ["Élastique fixé à hauteur de poitrine", "Tirer les coudes en arrière, omoplates serrées", "Revenir lentement"],
   prog="Rowing haltère")
ex("face_pull", "Face pull", "Haut du corps", "Poulie ou élastique",
   ["Corde à hauteur du visage", "Tirer vers le front en écartant les mains", "Finir pouces vers l'arrière"],
   prog="Plus de répétitions")
ex("dips", "Dips", "Haut du corps", "Barres parallèles ou banc",
   ["Épaules basses, loin des oreilles", "Descendre jusqu'à 90° aux coudes", "Pousser jusqu'à bras tendus"],
   reg="Dips sur banc", prog="Dips lestés")
ex("curl", "Curl biceps aux haltères", "Haut du corps", "Haltères",
   ["Coudes fixes le long du corps", "Monter sans balancer", "Descente en 2 secondes"],
   prog="Curl incliné")
ex("extension_triceps", "Extension des triceps", "Haut du corps", "Poulie, haltère ou élastique",
   ["Coudes fixes", "Tendre complètement les bras", "Revenir lentement"],
   prog="Plus lourd")
ex("elevations_laterales", "Élévations latérales", "Haut du corps", "Haltères ou élastique",
   ["Légère flexion des coudes", "Monter jusqu'à hauteur d'épaules", "Contrôler la descente"],
   prog="Plus de répétitions")

# ---------------- Tronc ----------------
ex("planche", "Gainage planche", "Tronc", "Poids du corps",
   ["Coudes sous les épaules", "Bassin aligné, ni creusé ni relevé", "Serrer fessiers et abdos"],
   reg="Sur les genoux", prog="Planche avec appui alterné")
ex("planche_laterale", "Gainage latéral", "Tronc", "Poids du corps",
   ["Coude sous l'épaule", "Corps aligné, hanches hautes", "Tenir sans tourner le buste"],
   reg="Genoux au sol", prog="Avec jambe levée")
ex("dead_bug", "Dead bug", "Tronc", "Poids du corps",
   ["Dos plaqué au sol", "Tendre bras et jambe opposés lentement", "Expirer à chaque extension"],
   prog="Avec élastique ou haltère")
ex("bird_dog", "Bird dog", "Tronc", "Poids du corps",
   ["À quatre pattes, dos plat", "Tendre bras et jambe opposés", "Pause 2 s, sans bouger le bassin"],
   prog="Avec élastique")
ex("pallof", "Pallof press (anti-rotation)", "Tronc", "Élastique ou poulie",
   ["Élastique sur le côté, à hauteur de poitrine", "Pousser les mains devant sans tourner", "Tenir 2 s bras tendus"],
   prog="Plus de tension")
ex("rollout", "Roulette abdominale (rollout)", "Tronc", "Roulette ou barre",
   ["À genoux, bassin rétroversé", "Avancer en gardant le dos plat", "Revenir avec les abdos, pas les bras"],
   alt="planche", reg="Amplitude réduite", prog="Debout")
ex("portage_valise", "Portage valise (une main)", "Tronc", "Haltère ou kettlebell",
   ["Charge lourde d'un seul côté", "Marcher droit, épaules à niveau", "Ne pas se pencher vers la charge"],
   prog="Plus lourd")
ex("farmer_walk", "Marche du fermier", "Tronc", "Haltères ou kettlebells",
   ["Une charge lourde dans chaque main", "Épaules basses, buste droit", "Petits pas rapides"],
   prog="Plus lourd ou plus long")
ex("hollow", "Hollow hold (gainage creux)", "Tronc", "Poids du corps",
   ["Bas du dos plaqué au sol", "Bras et jambes tendus, décollés du sol", "Plier les genoux pour faciliter"],
   prog="Hollow rocks")
ex("releve_jambes", "Relevés de jambes", "Tronc", "Barre de traction ou sol",
   ["Suspendu ou allongé, sans élan", "Monter les jambes en enroulant le bassin", "Descendre lentement"],
   reg="Genoux pliés", prog="Jambes tendues")

# ---------------- Haltérophilie ----------------
ex("epaule_suspension", "Épaulé en suspension (hang power clean)", "Haltérophilie", "Barre",
   ["Départ barre au-dessus des genoux, dos neutre", "Extension explosive hanches-genoux-chevilles", "Passer sous la barre et la recevoir sur les épaules, coudes hauts"],
   alt="epaule_haltere", reg="Tirage mi-cuisse", prog="Épaulé depuis le sol")
ex("arrache_suspension", "Arraché en suspension (hang power snatch)", "Haltérophilie", "Barre",
   ["Prise large, barre au-dessus des genoux", "Extension complète puis tirage haut", "Recevoir bras tendus au-dessus de la tête, gainage fort"],
   alt="arrache_haltere", reg="Tirage haut d'arraché", prog="Arraché depuis le sol")
ex("tirage_epaule", "Tirage d'épaulé", "Haltérophilie", "Barre",
   ["Départ du sol, dos neutre", "Accélérer la barre au passage des genoux", "Finir en extension complète, épaules haussées"],
   alt="kb_swing", prog="Plus lourd")
ex("mi_cuisse", "Tirage mi-cuisse", "Haltérophilie", "Barre",
   ["Départ barre au milieu des cuisses", "Extension la plus rapide possible", "Haussement d'épaules, bras relâchés"],
   alt="kb_swing", prog="Plus lourd")
ex("jete_pousse", "Push press", "Haltérophilie", "Barre",
   ["Légère flexion des jambes, buste vertical", "Pousser avec les jambes puis les bras", "Finir bras tendus au-dessus de la tête"],
   alt="dm_halteres", prog="Jeté poussé")
ex("jerk", "Jeté poussé (push jerk)", "Haltérophilie", "Barre",
   ["Flexion-extension rapide des jambes", "Passer sous la barre en refléchissant", "Se relever avec la barre bloquée"],
   alt="dm_halteres", reg="Push press", prog="Jeté fendu")
ex("epaule_haltere", "Épaulé haltère à un bras", "Haltérophilie", "Haltère",
   ["Haltère entre les jambes", "Extension explosive des hanches", "Recevoir l'haltère sur l'épaule"],
   prog="Épaulé en suspension à la barre")
ex("arrache_haltere", "Arraché haltère à un bras", "Haltérophilie", "Haltère",
   ["Haltère entre les jambes", "Extension explosive, tirer haut", "Recevoir bras tendu au-dessus de la tête"],
   prog="Arraché en suspension à la barre")
ex("squat_saute_barre", "Squat sauté chargé", "Haltérophilie", "Barre légère ou haltères",
   ["Charge légère (20 à 30 % du squat)", "Quart de squat puis saut maximal", "Réception amortie, repartir après stabilisation"],
   alt="cmj", prog="Plus lourd")

# ---------------- Pliométrie ----------------
ex("cmj", "Sauts verticaux (CMJ)", "Pliométrie", "Poids du corps",
   ["Descente rapide, bras en arrière", "Sauter le plus haut possible", "Réception silencieuse, genoux dans l'axe"],
   prog="Sauts sur box")
ex("box_jump", "Saut sur box", "Pliométrie", "Box",
   ["Saut explosif vers le haut", "Réception douce sur la box", "Redescendre en marchant"],
   alt="cmj", reg="Box plus basse", prog="Box plus haute")
ex("sauts_haies", "Sauts de haies enchaînés", "Pliométrie", "Mini-haies",
   ["Pieds joints, temps de contact court", "Genoux qui montent", "Rester gainé"],
   alt="pogo", reg="Haies plus basses", prog="Haies plus hautes")
ex("bonds", "Bondissements alternés", "Pliométrie", "Terrain",
   ["Bonds longs d'un pied sur l'autre", "Pousser fort derrière, genou devant haut", "Bras opposés actifs"],
   reg="Moins de bonds", prog="Distance plus longue")
ex("saut_longueur", "Saut en longueur sans élan", "Pliométrie", "Terrain",
   ["Pieds largeur de hanches", "Balancer les bras et sauter loin", "Réception stable, sans reculer"],
   prog="Enchaîné")
ex("drop_jump", "Drop jump (réactivité)", "Pliométrie", "Box 30 cm",
   ["Se laisser tomber de la box", "Contact au sol le plus court possible", "Rebondir le plus haut possible"],
   reg="Box plus basse", prog="Box plus haute")
ex("pogo", "Pogo jumps (sauts de chevilles)", "Pliométrie", "Poids du corps",
   ["Genoux presque tendus", "Rebonds rapides sur l'avant du pied", "Rythme régulier"],
   prog="Unipodal")
ex("saut_lateral", "Sauts latéraux (patineur)", "Pliométrie", "Poids du corps",
   ["Sauter latéralement d'une jambe à l'autre", "Réception stable 1 s", "Genou dans l'axe du pied"],
   prog="Enchaîné sans pause")
ex("med_ball_lancer", "Lancer de médecine-ball", "Pliométrie", "Médecine-ball",
   ["Contre un mur ou en extérieur", "Lancer explosif depuis la poitrine ou au-dessus de la tête", "Récupérer entre chaque lancer"],
   alt="pompes", prog="Plus lourd")
ex("med_ball_rotation", "Lancer rotatif de médecine-ball", "Pliométrie", "Médecine-ball",
   ["De profil au mur", "Rotation des hanches puis des épaules", "Lancer le plus fort possible"],
   alt="pallof", prog="Plus lourd")
ex("saut_unipodal", "Sauts unipodaux (hop)", "Pliométrie", "Poids du corps",
   ["Sauter et se réceptionner sur la même jambe", "Tenir la réception 2 s", "Genou dans l'axe, sans douleur"],
   reg="Sauts sur place", prog="Enchaînés")

# ---------------- Vitesse ----------------
ex("gammes", "Gammes athlétiques", "Vitesse", "Terrain",
   ["Montées de genoux, talons-fesses, A-skip, B-skip", "Sur l'avant du pied, buste grand", "Bras actifs, coudes à 90°"],
   prog="Plus rapide")
ex("acc_10", "Accélérations 10 m", "Vitesse", "Terrain",
   ["Départ debout, pied fort devant", "Buste penché, poussées longues", "Effort maximal, récupération complète"],
   prog="Départs variés")
ex("acc_20", "Accélérations 20 m", "Vitesse", "Terrain",
   ["Inclinaison du corps sur les 10 premiers mètres", "Se redresser progressivement", "Effort maximal"],
   prog="30 m")
ex("sprint_30", "Sprint 30 m", "Vitesse", "Terrain",
   ["Départ 3 appuis ou debout", "Accélérer puis rester relâché", "Récupération complète (2 à 3 min)"],
   prog="40 m")
ex("sprint_lance", "Sprint lancé", "Vitesse", "Terrain",
   ["Zone d'élan progressive", "Vitesse maximale sur la zone lancée", "Rester grand, foulée sous le bassin"],
   prog="Zone lancée plus longue")
ex("sprint_resiste", "Sprint résisté (traîneau ou élastique)", "Vitesse", "Traîneau ou élastique",
   ["Charge qui ralentit d'environ 10 à 20 %", "Inclinaison marquée, poussées puissantes", "Garder une technique de sprint"],
   alt="montees", prog="Charge un peu plus lourde")
ex("montees", "Sprints en côte", "Vitesse", "Côte",
   ["Pente modérée (5 à 10 %)", "Poussées longues, genoux hauts", "Redescendre en marchant"],
   prog="Côte plus longue")
ex("depart_3appuis", "Départs 3 appuis", "Vitesse", "Terrain",
   ["Main opposée au pied avant au sol", "Première poussée longue et basse", "Ne pas se redresser trop tôt"],
   prog="Départs sur signal")
ex("wicket", "Course sur mini-haies espacées (wickets)", "Vitesse", "Mini-haies ou cônes",
   ["Haies espacées de 1,6 à 2 m", "Genoux hauts, pied qui attaque sous le bassin", "Vitesse sous-maximale puis maximale"],
   prog="Espacement plus grand")

# ---------------- Agilité ----------------
ex("cod_505", "Test 505 (demi-tour)", "Agilité", "Terrain + cônes",
   ["Course lancée, demi-tour à 180° sur la ligne", "Abaisser le centre de gravité avant le virage", "Réaccélérer 5 m"],
   prog="Sur signal")
ex("decel", "Décélérations", "Agilité", "Terrain",
   ["Accélérer sur 10 m", "Freiner en 3 appuis, hanches basses", "Finir stable, sans dépasser la ligne"],
   prog="Freinage plus court")
ex("reactif", "Changements de direction réactifs", "Agilité", "Terrain + partenaire",
   ["Réagir au signal (voix, geste, couleur)", "Premier appui explosif", "Regard haut"],
   prog="Signaux plus complexes")
ex("echelle", "Échelle de rythme", "Agilité", "Échelle ou lignes au sol",
   ["Appuis rapides sur l'avant du pied", "Bras coordonnés", "Qualité avant vitesse"],
   prog="Combinaisons plus complexes")
ex("shuffle", "Pas chassés", "Agilité", "Terrain",
   ["Position athlétique, genoux fléchis", "Pieds qui ne se croisent pas", "Changer de sens au cône"],
   prog="Sur signal")

# ---------------- Conditionnement ----------------
ex("intermittent_1515", "Intermittent 15-15", "Conditionnement", "Terrain",
   ["15 s de course rapide / 15 s de récupération", "Allure : environ 100 % de la VMA", "Régulier sur tout le bloc"],
   prog="Plus de répétitions")
ex("intermittent_3030", "Intermittent 30-30", "Conditionnement", "Terrain",
   ["30 s de course / 30 s de récupération", "Allure : environ 95 % de la VMA", "Même distance à chaque répétition"],
   prog="Plus de répétitions")
ex("navette", "Courses navettes", "Conditionnement", "Terrain + cônes",
   ["Allers-retours avec demi-tours", "Toucher la ligne à chaque fois", "Garder la même vitesse jusqu'au bout"],
   prog="Distances plus longues")
ex("rsa", "Répétition de sprints (RSA)", "Conditionnement", "Terrain",
   ["Sprints courts à fond", "Récupération courte et active", "Noter si la vitesse baisse"],
   prog="Plus de séries")
ex("velo_intervalles", "Intervalles vélo ou rameur", "Conditionnement", "Vélo ou rameur",
   ["Effort intense (8/10) puis récupération facile", "Cadence élevée sur l'effort", "Respecter les temps de récupération"],
   alt="burpees", prog="Plus de répétitions")
ex("rameur", "Cardio continu (rameur, vélo, elliptique)", "Conditionnement", "Machine cardio",
   ["Allure où l'on peut encore parler", "Effort régulier", "Varier les machines selon l'envie"],
   alt="marche_rapide", prog="Plus long")
ex("marche_rapide", "Marche rapide", "Conditionnement", "Extérieur",
   ["Pas rapides, bras actifs", "Légèrement essoufflé mais capable de parler", "Choisir un parcours avec un peu de dénivelé"],
   prog="Marche en côte")
ex("burpees", "Burpees", "Conditionnement", "Poids du corps",
   ["Mains au sol, pieds en arrière", "Ramener les pieds et se relever", "Sauter si possible, sinon se relever"],
   reg="Sans saut ni pompe", prog="Avec pompe")
ex("corde", "Corde à sauter", "Conditionnement", "Corde",
   ["Petits sauts sur l'avant du pied", "Poignets qui tournent, coudes près du corps", "Rythme régulier"],
   alt="jumping_jacks", prog="Double sauts")
ex("jumping_jacks", "Jumping jacks", "Conditionnement", "Poids du corps",
   ["Écarter bras et jambes en sautant", "Rythme régulier", "Réception souple"],
   reg="Sans saut", prog="Plus rapide")
ex("circuit_kb", "Circuit kettlebell", "Conditionnement", "Kettlebell",
   ["10 swings + 10 goblet squats + 10 rowings par bras", "Enchaîner sans pause dans le tour", "Technique avant vitesse"],
   alt="burpees", prog="Kettlebell plus lourde")

# ---------------- Course ----------------
ex("footing_ef", "Footing en endurance fondamentale", "Course", "Extérieur",
   ["Allure facile : on peut tenir une conversation", "Environ 65 à 75 % de la VMA", "Sol souple si possible"],
   prog="Plus long")
ex("fractionne_court", "Fractionné court (VMA)", "Course", "Piste ou extérieur",
   ["Échauffement 15 min en endurance fondamentale", "Répétitions à allure VMA", "Récupération en trottinant"],
   prog="Plus de répétitions")
ex("fractionne_long", "Fractionné long (allure 5 km)", "Course", "Piste ou extérieur",
   ["Échauffement 15 min", "Répétitions à allure cible 5 km", "Récupération en trottinant"],
   prog="Répétitions plus longues")
ex("sortie_longue", "Sortie longue", "Course", "Extérieur",
   ["Allure endurance fondamentale", "Boire si plus de 60 min", "Finir en forme, pas épuisé"],
   prog="Plus long")
ex("marche_course", "Alternance marche / course", "Course", "Extérieur",
   ["Course très facile, sol plat et régulier", "Douleur au plus 3/10 pendant et le lendemain", "Revenir à l'étape précédente si la douleur augmente"],
   prog="Moins de marche")
ex("lignes_droites", "Lignes droites (accélérations progressives)", "Course", "Extérieur",
   ["80 à 100 m en accélérant progressivement", "Finir vite mais relâché", "Retour en marchant"],
   prog="Plus rapide")
ex("tempo", "Allure seuil (tempo)", "Course", "Extérieur",
   ["Allure 10 km ou un peu plus lente", "Respiration soutenue mais contrôlée", "Récupération 2 min en trottinant"],
   prog="Blocs plus longs")

# ---------------- Mobilité ----------------
ex("mob_hanche", "Mobilité des hanches (90/90)", "Mobilité", "Sol",
   ["Assis, jambes à 90° devant et derrière", "Basculer d'un côté à l'autre sans les mains", "Buste grand"],
   prog="Sans les mains")
ex("mob_cheville", "Mobilité de cheville (genou au mur)", "Mobilité", "Mur",
   ["Pied à quelques cm du mur", "Avancer le genou vers le mur sans décoller le talon", "Reculer le pied progressivement"],
   prog="Plus loin du mur")
ex("mob_thoracique", "Rotations thoraciques", "Mobilité", "Sol",
   ["À quatre pattes, main derrière la tête", "Ouvrir le coude vers le plafond", "Suivre le coude du regard"],
   prog="Plus d'amplitude")
ex("etirement_flechisseurs", "Étirement des fléchisseurs de hanche", "Mobilité", "Sol",
   ["Fente basse, genou arrière au sol", "Serrer le fessier arrière, bassin en arrière", "Tenir 30 s par côté"],
   prog="Bras levé")
ex("worlds_greatest", "World's greatest stretch", "Mobilité", "Sol",
   ["Fente avant, main au sol à l'intérieur du pied", "Rotation du buste bras vers le ciel", "Enchaîner des deux côtés"],
   prog="Plus lent")
ex("respiration", "Respiration diaphragmatique", "Mobilité", "Sol",
   ["Allongé, mains sur le ventre", "Inspirer 4 s par le nez, ventre qui gonfle", "Expirer 6 s"],
   prog="Plus long")

# ---------------- Prévention ----------------
ex("copenhague", "Gainage Copenhague (adducteurs)", "Prévention", "Banc",
   ["Gainage latéral, jambe du dessus sur le banc", "Hanches hautes, corps aligné", "Genou sur le banc pour faciliter"],
   reg="Genou sur le banc", prog="Pied sur le banc")
ex("tibial", "Relevés du tibial antérieur", "Prévention", "Mur",
   ["Dos au mur, talons à 30 cm", "Relever les pointes de pied", "Contrôler la descente"],
   prog="Avec charge")
ex("equilibre", "Équilibre unipodal", "Prévention", "Sol ou coussin",
   ["Sur une jambe, genou légèrement fléchi", "Bassin à niveau", "Fermer les yeux pour progresser"],
   prog="Sur coussin instable")
ex("rotateurs", "Rotation externe d'épaule (élastique)", "Prévention", "Élastique",
   ["Coude collé au corps, à 90°", "Tourner l'avant-bras vers l'extérieur", "Revenir lentement"],
   prog="Bras à 90° d'abduction")
ex("y_t_w", "Y-T-W (omoplates)", "Prévention", "Sol ou banc incliné",
   ["Allongé sur le ventre", "Former un Y, un T puis un W avec les bras", "Pouces vers le ciel, omoplates serrées"],
   prog="Avec petits disques")
ex("step_down", "Step down (descente contrôlée)", "Prévention", "Marche",
   ["Debout sur une marche, sur une jambe", "Descendre le talon de l'autre jambe vers le sol", "Genou dans l'axe du pied, sans s'écrouler"],
   reg="Marche plus basse", prog="Marche plus haute")
ex("spanish_squat", "Spanish squat (isométrie quadriceps)", "Prévention", "Élastique épais",
   ["Élastique derrière les genoux, fixé devant", "Descendre en gardant les tibias verticaux", "Tenir la position"],
   prog="Plus bas, plus long")

# ---------------- Récupération, étirements et yoga ----------------
ex("chien_tete_bas", "Chien tête en bas", "Récupération", "Tapis",
   ["Mains à plat largeur d'épaules, pousse le sol", "Hanches hautes, dos long", "Talons vers le sol sans forcer, genoux souples si besoin"],
   reg="Genoux fléchis", prog="Pédaler doucement des talons")
ex("posture_enfant", "Posture de l'enfant", "Récupération", "Tapis",
   ["Assis sur les talons, genoux écartés", "Front au sol, bras allongés devant", "Respire lentement dans le bas du dos"],
   reg="Coussin sous les fesses")
ex("cobra", "Cobra", "Récupération", "Tapis",
   ["Allongé sur le ventre, mains sous les épaules", "Pousse doucement pour ouvrir la poitrine", "Épaules basses, bassin au sol, sans douleur lombaire"],
   reg="Sur les avant-bras (sphinx)")
ex("chat_vache", "Chat-vache", "Récupération", "Tapis",
   ["À quatre pattes, mains sous les épaules", "Inspire : creuse le dos, regarde devant", "Expire : arrondis le dos, menton vers la poitrine"])
ex("pigeon", "Pigeon", "Récupération", "Tapis",
   ["Tibia avant en travers, jambe arrière allongée", "Bassin face au sol", "Penche-toi doucement au-dessus de la jambe avant"],
   reg="Coussin sous la hanche avant", prog="Buste au sol")
ex("ischios_assis", "Étirement des ischios assis", "Récupération", "Tapis",
   ["Assis, jambes tendues", "Penche-toi en gardant le dos long", "Avance un peu à chaque expiration, sans à-coups"],
   reg="Genoux légèrement fléchis")
ex("quadriceps_debout", "Étirement des quadriceps debout", "Récupération", "Mur ou appui",
   ["Debout sur une jambe, main sur un appui si besoin", "Talon vers la fesse, genoux serrés", "Bassin légèrement basculé vers l'avant"])
ex("mollets_mur", "Étirement des mollets au mur", "Récupération", "Mur",
   ["Mains au mur, jambe arrière tendue", "Talon arrière au sol", "Avance le bassin jusqu'à sentir l'étirement"],
   prog="Genou arrière fléchi pour le soléaire")
ex("papillon", "Papillon", "Récupération", "Tapis",
   ["Assis, plantes de pied jointes", "Dos droit, mains sur les pieds", "Laisse descendre les genoux sans appuyer"])
ex("genoux_poitrine", "Genoux à la poitrine", "Récupération", "Tapis",
   ["Allongé sur le dos", "Ramène les genoux et serre doucement", "Berce-toi lentement pour masser le bas du dos"])
ex("jambes_mur", "Jambes au mur", "Récupération", "Mur",
   ["Fesses contre le mur, jambes à la verticale", "Bras relâchés, respire lentement", "Idéal le soir ou après un match"])
ex("flexion_avant", "Flexion avant debout", "Récupération", "Sol",
   ["Pieds largeur de bassin, genoux souples", "Plie-toi depuis les hanches", "Laisse pendre la tête, déroule le dos pour remonter"])
ex("guerrier_2", "Guerrier II", "Récupération", "Tapis",
   ["Grand écart des pieds, pied avant tourné vers l'extérieur", "Genou avant au-dessus de la cheville", "Bras à l'horizontale, regard au-dessus de la main avant"])
ex("coherence", "Cohérence cardiaque", "Récupération", "Assis",
   ["Assis, dos droit, épaules relâchées", "Inspire 5 secondes par le nez", "Expire 5 secondes, 6 respirations par minute"])
ex("rouleau_mollets", "Rouleau de massage : mollets", "Récupération", "Rouleau",
   ["Mollets sur le rouleau, mains au sol derrière", "Soulève les fesses et roule du talon au genou", "Lentement, 30 à 60 s par zone, sans douleur vive"])
ex("rouleau_quadriceps", "Rouleau de massage : quadriceps", "Récupération", "Rouleau",
   ["Appui sur les avant-bras, rouleau sous les cuisses", "Roule de la hanche au-dessus du genou", "Gainage léger, respire"])
ex("rouleau_dos", "Rouleau de massage : haut du dos", "Récupération", "Rouleau",
   ["Rouleau sous les omoplates, mains derrière la tête", "Fesses légèrement décollées", "Roule le haut du dos, jamais les lombaires"])

# ---------------- Séances flash à la maison ----------------
ex("mountain_climbers", "Mountain climbers", "Conditionnement", "Poids du corps",
   ["Planche bras tendus, épaules au-dessus des mains", "Ramène les genoux vers la poitrine en alternance", "Bassin stable, rythme soutenu"],
   reg="Plus lent, un pied après l'autre", prog="Plus rapide")
ex("squat_saute", "Squat sauté", "Pliométrie", "Poids du corps",
   ["Descends en squat, bras en arrière", "Saute en poussant le sol", "Réception souple, genoux dans l'axe"],
   reg="Squat sans saut", prog="Squat sauté avec pause en bas")
ex("fentes_sautees", "Fentes sautées", "Pliométrie", "Poids du corps",
   ["Fente basse, buste droit", "Saute et change de jambe en l'air", "Réception contrôlée, genou arrière proche du sol"],
   reg="Fentes alternées sans saut")
ex("superman", "Superman", "Tronc", "Tapis",
   ["Allongé sur le ventre, bras devant", "Décolle bras, buste et jambes", "Regard vers le sol, tiens 2 secondes"],
   reg="Bras ou jambes seulement")
ex("crunch", "Crunch", "Tronc", "Tapis",
   ["Allongé, genoux pliés, mains derrière la tête", "Enroule le haut du dos sans tirer sur la nuque", "Redescends lentement"],
   prog="Pieds décollés")
ex("talons_fesses", "Talons-fesses", "Conditionnement", "Poids du corps",
   ["Course sur place", "Talons vers les fesses", "Appuis légers sur l'avant du pied"])
ex("montees_genoux", "Montées de genoux", "Conditionnement", "Poids du corps",
   ["Course sur place, genoux à hauteur de hanches", "Bras actifs", "Reste grand, appuis rapides"],
   reg="Marche genoux hauts")
ex("planche_epaules", "Planche, touchers d'épaule", "Tronc", "Poids du corps",
   ["Planche bras tendus, pieds écartés", "Touche l'épaule opposée en alternance", "Bassin immobile"],
   reg="Sur les genoux")
ex("pompes_genoux", "Pompes sur les genoux", "Haut du corps", "Poids du corps",
   ["Genoux au sol, corps aligné des genoux à la tête", "Descends la poitrine entre les mains", "Pousse le sol, coudes à 45°"],
   prog="Pompes")
ex("dips_chaise", "Dips sur une chaise", "Haut du corps", "Chaise stable",
   ["Mains sur le bord de la chaise, doigts vers l'avant", "Descends en pliant les coudes vers l'arrière", "Épaules basses, remonte en poussant"],
   reg="Genoux pliés", prog="Jambes tendues")
ex("thruster", "Thruster", "Conditionnement", "Haltères",
   ["Haltères aux épaules", "Squat complet", "Remonte et pousse au-dessus de la tête d'un seul mouvement"],
   reg="Sans charge")
ex("chenille", "Chenille (inchworm)", "Mobilité", "Poids du corps",
   ["Debout, plie-toi et pose les mains au sol", "Marche avec les mains jusqu'à la planche", "Reviens et redresse-toi"])
ex("fente_laterale", "Fente latérale", "Bas du corps", "Poids du corps",
   ["Pieds écartés, assieds-toi sur une jambe", "L'autre jambe reste tendue, pied à plat", "Pousse pour revenir au centre"],
   prog="Avec haltère")
ex("pont_unipodal", "Pont fessier unipodal", "Chaîne postérieure", "Poids du corps",
   ["Allongé, un pied au sol, l'autre jambe tendue", "Monte les hanches sans tourner le bassin", "Serre le fessier en haut"],
   reg="Pont fessier")
ex("marche_place", "Marche active sur place", "Conditionnement", "Poids du corps",
   ["Marche sur place en balançant les bras", "Monte un peu les genoux", "Respire calmement"])

LIB = E
