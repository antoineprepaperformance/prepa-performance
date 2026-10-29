# -*- coding: utf-8 -*-
"""Sports : choix du sport et du poste, exercices spécifiques en salle, séances terrain avec schéma.

Schéma « sc » (mètres, y vers le bas) :
  f  : fond (rugby, foot, hand, basket, volley, tennis, padel, bad, piste, pelouse, baseball, bassin, cote, ring, bob)
  v  : zone affichée [x0, y0, x1, y1]
  o  : objets [x, y, type, texte] — c plot, x au sol, pa/pb joueurs, ball, sled, wk mini-haie, base, goal, shield, start, jump, hit
  p  : trajets dans l'ordre : k (sprint, jog, back, lat, walk, ball), p (points), l (texte), lp (position du texte 0-1),
       lo (côté du texte, 1 ou -1), n (numéro d'étape), e (fin : down, jump, turn, hit), w (pause en s), r (coureur 0/1)
  z  : zones [x, y, largeur, hauteur, texte]
  t  : textes libres [x, y, texte]
Dose par profil : {"t": texte, "s": séries, "r": répétitions, "w": effort (s), "p": récup (s), "sp": entre séries (s), "lab": étiquette}.
Sans minuteur : "m": "test" (résultat à noter) ; "chr" : nombre d'essais chronométrés.
"""

REFS = {
    "buchheit13a": "Buchheit M, Laursen PB. High-intensity interval training, solutions to the programming puzzle. Part I: cardiopulmonary emphasis. Sports Med. 2013;43(5):313-338.",
    "buchheit13b": "Buchheit M, Laursen PB. High-intensity interval training, solutions to the programming puzzle. Part II: anaerobic energy, neuromuscular load and practical applications. Sports Med. 2013;43(10):927-954.",
    "buchheit08": "Buchheit M. The 30-15 intermittent fitness test: accuracy for individualizing interval training of young intermittent sport players. J Strength Cond Res. 2008;22(2):365-374.",
    "bishop11": "Bishop D, Girard O, Mendez-Villanueva A. Repeated-sprint ability – part II: recommendations for training. Sports Med. 2011;41(9):741-756.",
    "austin11": "Austin D, Gabbett T, Jenkins D. Repeated high-intensity exercise in professional rugby union. J Sports Sci. 2011;29(10):1105-1112.",
    "sella21": "Sella FS, Hébert-Losier K, Beaven CM, McMaster DT, Harvey M, Gill ND. Performance in the 1.2 km shuttle run test reflects fitness capacities in rugby players. J Aust Strength Cond. 2021;29(5).",
    "naish13": "Naish R, Burnett A, Burrows S, Andrews W, Appleby B. Can a specific neck strengthening program decrease cervical spine injuries in a men's professional rugby union team? A retrospective analysis. J Sports Sci Med. 2013;12(3):542-550.",
    "bangsbo08": "Bangsbo J, Iaia FM, Krustrup P. The Yo-Yo intermittent recovery test: a useful tool for evaluation of physical performance in intermittent sports. Sports Med. 2008;38(1):37-51.",
    "hillhaas11": "Hill-Haas SV, Dawson B, Impellizzeri FM, Coutts AJ. Physiology of small-sided games training in football: a systematic review. Sports Med. 2011;41(3):199-220.",
    "stolen05": "Stølen T, Chamari K, Castagna C, Wisløff U. Physiology of soccer: an update. Sports Med. 2005;35(6):501-536.",
    "dossantos18": "Dos'Santos T, Thomas C, Comfort P, Jones PA. The effect of angle and velocity on change of direction biomechanics: an angle-velocity trade-off. Sports Med. 2018;48(10):2235-2253.",
    "sheppard06": "Sheppard JM, Young WB. Agility literature review: classifications, training and testing. J Sports Sci. 2006;24(9):919-932.",
    "haugen19": "Haugen T, Seiler S, Sandbakk Ø, Tønnessen E. The training and development of elite sprint performance: an integration of scientific and best practice literature. Sports Med Open. 2019;5(1):44.",
    "petrakos16": "Petrakos G, Morin JB, Egan B. Resisted sled sprint training to improve sprint performance: a systematic review. Sports Med. 2016;46(5):381-400.",
    "pauole00": "Pauole K, Madole K, Garhammer J, Lacourse M, Rozenek R. Reliability and validity of the T-test as a measure of agility, leg power, and leg speed in college-aged men and women. J Strength Cond Res. 2000;14(4):443-450.",
    "karcher14": "Karcher C, Buchheit M. On-court demands of elite handball, with special reference to playing positions. Sports Med. 2014;44(6):797-814.",
    "stojanovic18": "Stojanović E, Stojiljković N, Scanlan AT, Dalbo VJ, Berkelmans DM, Milanović Z. The activity demands and physiological responses encountered during basketball match-play: a systematic review. Sports Med. 2018;48(1):111-135.",
    "sheppard09": "Sheppard JM, Gabbett TJ, Stanganelli LC. An analysis of playing positions in elite men's volleyball: considerations for competition demands and physiologic characteristics. J Strength Cond Res. 2009;23(6):1858-1866.",
    "kovacs07": "Kovacs MS. Tennis physiology: training the competitive athlete. Sports Med. 2007;37(3):189-198.",
    "fernandez09": "Fernandez-Fernandez J, Sanz-Rivas D, Mendez-Villanueva A. A review of the activity profile and physiological demands of tennis match play. Strength Cond J. 2009;31(4):15-26.",
    "phomsoupha15": "Phomsoupha M, Laffaye G. The science of badminton: game characteristics, anthropometry, physiology, visual fitness and biomechanics. Sports Med. 2015;45(4):473-495.",
    "seiler10": "Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform. 2010;5(3):276-291.",
    "barnes15": "Barnes KR, Kilding AE. Strategies to improve running economy. Sports Med. 2015;45(1):37-56.",
    "vernillo17": "Vernillo G, Giandolini M, Edwards WB, et al. Biomechanics and physiology of uphill and downhill running. Sports Med. 2017;47(4):615-629.",
    "chaabene15": "Chaabène H, Tabben M, Mkaouer B, et al. Amateur boxing: physical and physiological attributes. Sports Med. 2015;45(3):337-352.",
    "hydren13": "Hydren JR, Volek JS, Maresh CM, Comstock BA, Kraemer WJ. Review of strength and conditioning for alpine ski racing. Strength Cond J. 2013;35(1):10-28.",
    "ronnestad16": "Rønnestad BR, Hansen J. Optimizing interval training at power output associated with peak oxygen uptake in well-trained cyclists. J Strength Cond Res. 2016;30(4):999-1006.",
    "gabbett16": "Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med. 2016;50(5):273-280.",
    "andersson17": "Andersson SH, Bahr R, Clarsen B, Myklebust G. Preventing overuse shoulder injuries among throwing athletes: a cluster-randomised controlled trial in 660 elite handball players. Br J Sports Med. 2017;51(14):1073-1080.",
}

# ---------------------------------------------------------------------------------------------
# Exercices spécifiques (salle) et exercices « séance terrain » qui remplacent les génériques
# ---------------------------------------------------------------------------------------------
EX_SPORT = []
def ex(id, n, c, eq, cues, anim=None, alt=None, reg=None, prog=None, drill=None):
    d = {"id": id, "n": n, "c": c, "eq": eq, "cues": cues, "alt": alt, "reg": reg, "prog": prog}
    if anim: d["anim"] = anim
    if drill: d["drill"] = drill
    EX_SPORT.append(d)

ex("cou_iso", "Isométrie du cou (4 directions)", "Prévention", "Main ou élastique",
   ["Debout ou assis, tête neutre, regard droit devant", "Pousse la tête contre ta main sans bouger : devant, derrière, à gauche, à droite", "Monte progressivement jusqu'à 70-80 % de ta force, sans à-coup, et respire"],
   anim="neck_iso", reg="Pression légère, 5 s par direction", prog="Avec un partenaire ou un élastique")
ex("poussee_traineau", "Poussée de traîneau lourd", "Conditionnement", "Traîneau (prowler)",
   ["Bras tendus ou fléchis, corps penché à 45°", "Pousse avec des appuis courts et puissants sous les hanches", "Dos plat, regard vers le sol devant toi"],
   anim="sprint_resist", alt="fente_marchee", reg="Traîneau plus léger", prog="Charge plus lourde, 10 m")
ex("melee_iso", "Poussée isométrique de mêlée", "Force", "Mur, partenaire ou traîneau",
   ["Position de mêlée : hanches sous les épaules, dos plat, tête haute", "Pousse fort pendant 6 à 8 s sans bouger", "Appuis larges, pointes de pied dans le sol"],
   anim="sprint_resist", reg="Contre un mur, 50 % de la force", prog="Contre un partenaire ou un traîneau bloqué")
ex("flexion_hanche_elastique", "Montée de genou à l'élastique", "Prévention", "Élastique",
   ["Élastique autour du pied, debout sur l'autre jambe", "Monte le genou vite jusqu'à la hanche, redescends lentement", "Bassin stable, buste droit"],
   anim="balance", reg="Sans élastique", prog="Élastique plus fort, tempo plus rapide")
ex("lancer_medball_dessus", "Lancer de médecine-ball au-dessus de la tête", "Pliométrie", "Médecine-ball 2-4 kg",
   ["Ballon derrière la tête, bras tendus", "Lance vers le sol ou vers un mur le plus fort possible", "Engage tout le corps : jambes, tronc puis bras"],
   anim="mb_slam", reg="Ballon de 1-2 kg", prog="Lancer d'une main, en appui avant")
ex("pas_defensifs_elastique", "Pas chassés défensifs à la mini-bande", "Agilité", "Mini-bande",
   ["Bande au-dessus des genoux, position basse de défense", "Pas chassés rapides sans croiser les pieds", "Genoux dans l'axe, buste droit"],
   anim="shuffle", reg="Sans bande", prog="Bande plus forte, sur signal")
ex("saut_attaque", "Saut d'attaque (élan 3 pas)", "Pliométrie", "Aucun",
   ["Élan de 3 pas : gauche, droite-gauche rapides (droitier)", "Bras en arrière sur l'avant-dernier appui, puis lancés vers le haut", "Réception sur deux pieds, genoux souples"],
   anim="cmj", reg="Saut sans élan", prog="Avec un ballon à frapper")
ex("rotateurs_90", "Rotation externe d'épaule à 90° (élastique)", "Prévention", "Élastique",
   ["Bras à l'horizontale, coude plié à 90°", "Tourne l'avant-bras vers le haut sans bouger le coude", "Reviens lentement en 3 secondes"],
   anim="ext_rot", reg="Coude contre le corps", prog="Élastique plus fort, en appui sur une jambe")
ex("poignet", "Flexion-extension du poignet", "Prévention", "Haltère léger",
   ["Avant-bras posé sur la cuisse, poignet dans le vide", "Monte et descends lentement la main", "Paume vers le haut puis vers le bas"],
   anim="curl", reg="Sans charge", prog="Charge plus lourde, descente lente")
# exercices « séance terrain » : la fiche affiche le schéma de la séance
ex("bronco_casse", "Bronco cassé (20-40-60 m)", "Conditionnement", "Plots", ["1 tour de 240 m par minute", "Pose le pied derrière chaque ligne avant de repartir", "Récupère en marchant"], drill="r_bronco_casse")
ex("malcolm", "Malcolms (relevés + sprints)", "Conditionnement", "Lignes du terrain", ["Départ ventre au sol", "Plaque-toi au sol à chaque ligne et relève-toi vite", "15 s par Malcolm"], drill="r_malcolm")
ex("rhie", "Efforts répétés (sprints + plaquages)", "Conditionnement", "Plots, bouclier facultatif", ["Sprint, au sol, relevé, repli, sprint", "Départ toutes les 25 à 35 s", "Qualité des relevés jusqu'au bout"], drill="r_rhie")
ex("box_to_box", "Box to box (72 m)", "Conditionnement", "Terrain de foot", ["Surface à surface en 12 à 16 s", "Retour en trottinant", "Garde la même vitesse jusqu'à la dernière"], drill="f_b2b")
ex("contre_attaque", "Contre-attaque et repli défensif", "Conditionnement", "Terrain de hand", ["Sprint jusqu'aux 6 m adverses", "Repli en sprint jusqu'à tes 9 m", "Glisse sur la ligne des 9 m"], drill="h_ca")
ex("seventeens", "Seventeens (17 largeurs)", "Conditionnement", "Terrain de basket", ["17 largeurs de terrain en moins de 65 s", "Touche la ligne de touche à chaque fois", "Récupère 2 à 3 min"], drill="b_17")
ex("suicides", "Suicides (lignes)", "Conditionnement", "Terrain de basket", ["Lancer franc, milieu, lancer franc opposé, fond", "Retour à la ligne de fond à chaque fois", "Touche chaque ligne avec la main"], drill="b_suicide")
ex("attaques_repetees", "Attaques répétées (élan + saut)", "Pliométrie", "Filet", ["Élan 3 pas, saut d'attaque", "Retour en position de défense", "Une attaque toutes les 12 s"], drill="v_att")
ex("contres_filet", "Contres le long du filet", "Agilité", "Filet", ["Pas chassés vers le poste 4, contre", "Poste 3, contre ; poste 2, contre", "Mains hautes, pas de contact avec le filet"], drill="v_block")
ex("araignee_tennis", "Araignée (5 balles)", "Agilité", "5 balles ou plots", ["Départ au centre de la ligne de fond", "Ramène chaque balle au centre", "Freine en position basse"], drill="t_araignee")
ex("echanges_tennis", "Échanges simulés (10 s / 20 s)", "Conditionnement", "Plots", ["Déplacements latéraux et frappe simulée", "10 s d'effort comme un point", "20 s de récupération"], drill="t_echanges")
ex("araignee_padel", "Araignée de padel", "Agilité", "5 plots", ["Départ au centre du terrain", "Touche chaque plot et reviens au centre", "Pas d'ajustement courts"], drill="p_araignee")
ex("filet_padel", "Montée au filet et repli sur lob", "Agilité", "Plots", ["Montée rapide en 3-4 appuis", "Volée simulée, repli en pas chassés", "Recentre-toi entre chaque répétition"], drill="p_filet")
ex("six_points", "Déplacements 6 points", "Agilité", "6 plots", ["Départ au centre", "Fente vers l'avant, pas chassés sur les côtés, pas croisés vers le fond", "Retour au centre à chaque fois"], drill="bd_6pts")
ex("home_first", "Home → 1re base (27,4 m)", "Vitesse", "Bases ou plots", ["Swing simulé puis sprint", "Cours à travers la base sans freiner", "Récupère 90 s"], drill="bb_home1b")
ex("vol_base", "Vol de base (1re → 2e)", "Vitesse", "Bases ou plots", ["Avance de 3-4 m depuis la 1re base", "Départ croisé au signal", "Glisse ou freine à la 2e"], drill="bb_vol")
ex("depart_pousse", "Départs poussés (bob)", "Vitesse", "Luge à roues ou traîneau", ["Corps penché, bras tendus sur la poignée", "Appuis puissants et rapides", "Lâche à la ligne et termine en sprint"], drill="bo_push")
ex("cotes_longues", "Côtes longues (3 min)", "Course", "Côte", ["Allure soutenue mais régulière", "Petits pas, bras actifs", "Redescends en trottinant"], drill="tr_cotes")
ex("sprawl_sprint", "Sprawls + sprints", "Conditionnement", "Plots", ["Sprawl : jambes en arrière, hanches au sol", "Relève-toi et sprinte 10 m", "Reviens en marchant"], drill="k_sprawl")
ex("slalom_sauts", "Slalom en sauts latéraux", "Pliométrie", "5 plots", ["Saute d'un plot à l'autre comme un virage de ski", "Réception sur une jambe, genou dans l'axe", "Enchaîne sans pause"], drill="sk_slalom")

# ---------------------------------------------------------------------------------------------
# Séances terrain
# ---------------------------------------------------------------------------------------------
def I(s, r, w, p=0, sp=0, lab="", t=""):
    return {"t": t, "s": s, "r": r, "w": w, "p": p, "sp": sp, "lab": lab}
def T(t, m="test", n=1):
    return {"t": t, "m": m, "n": n}

DRILLS = []
def D(id, n, sports, typ, mat, but, steps, cues, dose, science, refs, sc=None, test=None, pace=None, poste=None, z=4, dur=None, warn=None,
      obj=None, org=None, var=None, contact=None, pub=None, skill=None):
    """Fiche « skill » (format des fiches terrain d'Antoine) : obj = objectifs {ph, te, ma}, org = organisation,
    var = variantes et progression, contact = aucun | toucher | bouclier | bags | reel, pub = public, skill = True
    (bibliothèque Technique : jamais tirée au sort pour la séance terrain de la semaine)."""
    d = {"id": id, "n": n, "sports": sports, "type": typ, "mat": mat, "but": but, "steps": steps, "cues": cues, "dose": dose,
         "science": science, "refs": refs, "z": z}
    for k, v in (("sc", sc), ("test", test), ("pace", pace), ("poste", poste), ("dur", dur), ("warn", warn),
                 ("obj", obj), ("org", org), ("var", var), ("contact", contact), ("pub", pub), ("skill", skill)):
        if v is not None: d[k] = v
    DRILLS.append(d)

COLL = ["rugby", "rugby7", "foot", "hand", "basket", "hockey"]
RAQ = ["tennis", "padel", "badminton"]

# ---------- séances communes ----------
D("g_rsa", "Répétition de sprints", COLL + ["volley"], "Vitesse", "2 plots, chrono",
  "Répéter des sprints courts en gardant la vitesse : l'effort typique des temps forts du match.",
  ["Pose 2 plots à 20 m (30 m en version Haut niveau).", "Sprinte à fond jusqu'au plot, freine, puis reviens en marchant.", "Repars au bip suivant : le départ suit le chrono, pas ta récupération.", "Récupère 4 minutes en marchant entre les séries."],
  ["Départ en position de match (debout, de profil ou après un relevé)", "Vise la même vitesse au dernier sprint qu'au premier", "Arrête la série si ta vitesse s'effondre (plus de 10 % plus lent)"],
  {"reprise": I(2, 4, 30, 0, 240, "Sprint 20 m à 90 %, retour en marchant", "2 séries de 4 sprints de 20 m à 90 %, départ toutes les 30 s"),
   "sportif": I(2, 6, 25, 0, 240, "Sprint 20 m, retour en marchant", "2 séries de 6 sprints de 20 m, départ toutes les 25 s"),
   "perf": I(3, 6, 20, 0, 240, "Sprint 20 m, retour en marchant", "3 séries de 6 sprints de 20 m, départ toutes les 20 s"),
   "elite": I(3, 6, 25, 0, 240, "Sprint 30 m, retour en marchant", "3 séries de 6 sprints de 30 m, départ toutes les 25 s")},
  "Des sprints de 20 à 30 m répétés avec moins de 30 secondes de récupération améliorent la capacité à répéter les sprints, à condition de garder une intensité maximale (Bishop, 2011).",
  ["bishop11", "gabbett16"],
  sc={"f": "pelouse", "v": [-4, -3.5, 36, 10], "o": [[0, 3.2, "c", "Départ"], [20, 3.2, "c", "20 m"], [30, 3.2, "c", "30 m (élite)"]],
      "p": [{"k": "sprint", "p": [[0, 1], [20, 1]], "l": "Sprint 20 m", "n": 1}, {"k": "walk", "p": [[20, 6], [0, 6]], "l": "Retour en marchant", "lo": 1, "n": 2}]}, z=5)

D("g_1515", "Intermittent 15-15", COLL + RAQ + ["volley", "boxe", "lutte"], "Endurance", "2 plots, chrono",
  "Développer ta puissance aérobie pour répéter les efforts sans t'essouffler.",
  ["Pose 2 plots à la distance indiquée (calculée avec ta VMA si tu l'as testée).", "Cours 15 s pour atteindre l'autre plot, arrête-toi 15 s.", "Repars dans l'autre sens au bip.", "3 minutes de récupération en marchant entre les blocs."],
  ["Allure régulière : tu dois arriver au plot pile au bip", "Trop facile : recule le plot de 2 m ; trop dur : avance-le", "Respire profondément pendant les 15 s d'arrêt"],
  {"reprise": I(2, 10, 15, 15, 180, "15 s de course à 85 % de ta VMA", "2 blocs de 5 min de 15-15 à 85 % de ta VMA, 3 min entre"),
   "sportif": I(2, 12, 15, 15, 180, "15 s de course à 90 % de ta VMA", "2 blocs de 6 min de 15-15 à 90 % de ta VMA"),
   "perf": I(2, 16, 15, 15, 180, "15 s de course à 95 % de ta VMA", "2 blocs de 8 min de 15-15 à 95 % de ta VMA"),
   "elite": I(3, 16, 15, 15, 180, "15 s de course à 100 % de ta VMA", "3 blocs de 8 min de 15-15 à 100 % de ta VMA")},
  "Les intervalles courts de 15 secondes à 90-100 % de la vitesse maximale aérobie sollicitent fortement le cœur avec une fatigue musculaire limitée : c'est un format de référence pour les sports collectifs (Buchheit et Laursen, 2013).",
  ["buchheit13a", "buchheit08"],
  sc={"f": "pelouse", "v": [-5, -6, 69, 16], "o": [[0, 5, "c", "A"], [63, 5, "c", "B"]],
      "p": [{"k": "sprint", "p": [[0, 2], [63, 2]], "l": "15 s de course", "n": 1, "w": 1.2}, {"k": "sprint", "p": [[63, 8], [0, 8]], "l": "15 s d'arrêt, puis retour en 15 s", "lo": 1, "n": 2}],
      "t": [[31.5, 14.6, "Distance A-B = ta VMA (km/h) × 4,2 × le % indiqué"]]},
  pace={"secs": 15, "pct": {"reprise": 85, "sportif": 90, "perf": 95, "elite": 100}}, z=4)

D("g_505", "Test 505 (changement de direction)", COLL + RAQ + ["ski", "baseball"], "Agilité", "4 plots, chrono ou téléphone",
  "Freiner et repartir à 180° le plus vite possible, sur chaque pied.",
  ["Pose un plot de départ, deux plots « chrono » à 10 m et une ligne de demi-tour à 15 m.", "Prends 10 m d'élan, passe la porte chrono, fais demi-tour sur la ligne des 15 m.", "Le chrono s'arrête quand tu repasses la porte (5 m aller, 5 m retour).", "Fais chaque pied d'appui pour comparer gauche et droite."],
  ["Abaisse ton centre de gravité dans les 2 derniers appuis", "Pied d'appui à plat, genou dans l'axe, jamais vers l'intérieur", "Pousse fort et regarde déjà la ligne d'arrivée"],
  {"reprise": I(1, 4, 10, 110, 0, "505 à 80 %, change de pied à chaque essai", "4 essais à 80 % (2 par pied), 2 min de récupération"),
   "sportif": I(1, 6, 10, 110, 0, "505 à fond, change de pied", "6 essais (3 par pied), 2 min de récupération"),
   "perf": I(1, 6, 10, 110, 0, "505 chronométré, change de pied", "6 essais chronométrés (3 par pied), 2 min de récupération"),
   "elite": I(1, 8, 10, 110, 0, "505 chronométré, change de pied", "8 essais chronométrés (4 par pied), 2 min de récupération")},
  "Plus l'angle est grand, plus il faut freiner : apprendre à décélérer avec des appuis bas et alignés rend les changements de direction plus rapides et moins risqués pour le genou (Dos'Santos, 2018).",
  ["dossantos18", "sheppard06"],
  sc={"f": "pelouse", "v": [-3, -2.5, 18.5, 10.5], "o": [[0, 3, "start", "Départ"], [10, 1, "c", "Chrono"], [10, 7, "c", ""], [15, 1, "c", "15 m"], [15, 7, "c", ""]],
      "p": [{"k": "sprint", "p": [[0, 3.2], [15, 3.2]], "l": "10 m d'élan + 5 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[15, 4.6], [10, 4.6]], "l": "5 m chrono", "lo": 1, "n": 2}, {"k": "jog", "p": [[10, 4.6], [4, 4.6]], "l": "", "lp": 0.6}],
      "t": [[12.5, 9.2, "Demi-tour sur la ligne des 15 m"]]},
  test="t505", z=5)

D("g_acc", "Accélérations et départs variés", COLL + ["baseball", "bob", "sprint", "boxe", "lutte"], "Vitesse", "Plots",
  "Gagner les premiers mètres : réagir et accélérer depuis les positions du match.",
  ["Trace 3 couloirs de 15 m.", "Départs variés : debout de profil, allongé ventre au sol, de dos, en 3 appuis.", "Accélère à fond sur 15 m, puis freine progressivement.", "Reviens en marchant : récupération complète entre chaque départ."],
  ["Buste penché vers l'avant sur les 5 premiers mètres", "Appuis puissants sous les hanches, bras qui poussent fort", "Pas de sprint fatigué : la qualité prime sur le nombre"],
  {"reprise": I(1, 6, 10, 80, 0, "Accélération 10 m à 85 %", "6 accélérations de 10 m à 85 %, 1 min 30 de récupération"),
   "sportif": I(1, 8, 10, 80, 0, "Départ varié + 15 m", "8 départs variés sur 15 m, 1 min 30 de récupération"),
   "perf": I(2, 5, 10, 80, 240, "Départ varié + 15 m", "2 séries de 5 départs sur 15 m, 4 min entre les séries"),
   "elite": I(3, 5, 10, 110, 240, "Départ varié + 20 m", "3 séries de 5 départs sur 20 m, 2 min de récupération")},
  "Des sprints courts répétés avec une récupération complète, à intensité maximale, sont la base du développement de l'accélération (Haugen, 2019).",
  ["haugen19", "petrakos16"],
  sc={"f": "pelouse", "v": [-5, -2, 21, 12], "o": [[0, 1, "x", "Allongé"], [0, 5, "start", "De dos"], [0, 9, "start", "3 appuis"], [15, 1, "c", ""], [15, 5, "c", "15 m"], [15, 9, "c", ""]],
      "p": [{"k": "sprint", "p": [[0, 1], [15, 1]], "l": "15 m", "n": 1, "w": 0.5}, {"k": "sprint", "p": [[0, 5], [15, 5]], "l": "15 m", "n": 2, "w": 0.5}, {"k": "sprint", "p": [[0, 9], [15, 9]], "l": "15 m", "n": 3}]}, z=5)

D("g_vmax", "Vitesse maximale (sprint lancé)", ["rugby", "rugby7", "foot", "sprint", "bob", "baseball", "hockey"], "Vitesse", "4 plots, chrono",
  "Atteindre et tenir ta vitesse maximale avec une foulée relâchée.",
  ["Plots à 0, 20, 40 et 60 m.", "Accélère progressivement sur les 20 premiers mètres.", "Cours à vitesse maximale entre 20 et 40 m (zone chronométrée).", "Relâche et freine progressivement jusqu'à 60 m, puis reviens en marchant."],
  ["Grand, hanches hautes, regard à l'horizon", "Appuis sous le bassin, talon qui remonte vite sous la fesse", "Visage et épaules relâchés : vitesse sans crispation"],
  {"reprise": I(1, 3, 10, 170, 0, "20 m d'élan + 10 m vite à 90 %", "3 sprints lancés (20 m d'élan + 10 m à 90 %), 3 min de récupération"),
   "sportif": I(1, 4, 10, 170, 0, "20 m d'élan + 15 m vite", "4 sprints lancés (20 m + 15 m), 3 min de récupération"),
   "perf": I(1, 5, 10, 200, 0, "20 m d'élan + 20 m lancés", "5 sprints lancés (20 m + 20 m), 3 min 30 de récupération"),
   "elite": I(1, 6, 10, 230, 0, "25 m d'élan + 20 m lancés", "6 sprints lancés (25 m + 20 m), 4 min de récupération")},
  "La vitesse maximale se développe avec des sprints à plus de 95 % de l'intensité, peu nombreux et entrecoupés de longues récupérations (Haugen, 2019). Courir régulièrement à vitesse maximale prépare aussi les ischios aux sprints du match.",
  ["haugen19"],
  sc={"f": "piste", "v": [-4, -6, 64, 15], "o": [[0, 7, "c", "0"], [20, 7, "c", "20 m"], [40, 7, "c", "40 m"], [60, 7, "c", "60 m"]],
      "p": [{"k": "jog", "p": [[0, 4.3], [20, 4.3]], "l": "Élan progressif", "n": 1}, {"k": "sprint", "p": [[20, 4.3], [40, 4.3]], "l": "Vitesse max", "n": 2}, {"k": "walk", "p": [[40, 4.3], [60, 4.3]], "l": "Freine", "n": 3}],
      "z": [[20, 0.2, 20, 9.4, "Zone chrono"]]}, z=5)

D("g_ift", "Test 30-15 IFT", COLL + ["volley"] + RAQ, "Test", "3 lignes à 20 m, bande-son du test",
  "Mesurer ta vitesse intermittente (VIFT) pour régler tes séances de fractionné.",
  ["Trace 3 lignes : 0, 20 et 40 m, avec une zone de 3 m à chaque ligne.", "Lance la bande-son officielle du test (application 30-15 IFT).", "Cours 30 s en aller-retour sur 40 m en suivant les bips, marche 15 s.", "La vitesse augmente de 0,5 km/h toutes les 45 s : note la dernière vitesse tenue."],
  ["Sois dans la zone de 3 m à chaque bip", "Le test s'arrête au 3e retard consécutif", "Note ta VIFT : elle sert à calculer tes fractionnés (95 % de la VIFT, par exemple)"],
  {"reprise": T("En profil Reprise, remplace le test par 2 blocs de 15-15 à allure modérée."), "sportif": T("1 test, après un échauffement de 15 min"),
   "perf": T("1 test toutes les 6 à 8 semaines"), "elite": T("1 test en début de préparation, puis toutes les 6 semaines")},
  "La VIFT mesurée au 30-15 intègre la vitesse, la capacité à changer de direction et la récupération : elle individualise mieux le fractionné des sports collectifs que la VMA (Buchheit, 2008).",
  ["buchheit08", "buchheit13a"],
  sc={"f": "pelouse", "v": [-4, -4, 44, 13], "o": [[0, 4, "c", "0"], [20, 4, "c", "20 m"], [40, 4, "c", "40 m"]],
      "z": [[-1.5, -1, 3, 10, ""], [18.5, -1, 3, 10, ""], [38.5, -1, 3, 10, ""]],
      "p": [{"k": "sprint", "p": [[0, 1], [40, 1]], "l": "Aller 40 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[40, 7], [0, 7]], "l": "Retour au bip", "lo": 1, "n": 2}],
      "t": [[20, 11.8, "30 s de course · 15 s de marche · +0,5 km/h par palier"]]},
  test="ift", z=5)

D("g_ttest", "T-test (agilité)", ["basket", "hand", "volley", "hockey"] + RAQ, "Test", "4 plots, chrono",
  "Mesurer ta vitesse de déplacement : avant, latéral et arrière.",
  ["Plot A au départ, plot B à 9,14 m devant, plots C et D à 4,57 m de chaque côté de B.", "Sprinte de A à B et touche le plot.", "Pas chassés vers C (touche), puis vers D (9,14 m), puis retour à B.", "Course arrière jusqu'à A : le chrono s'arrête."],
  ["Ne croise jamais les pieds en pas chassés", "Touche chaque plot avec la main", "Meilleur de 3 essais, 2 min de récupération"],
  {"reprise": T("2 essais à 80 % pour apprendre le parcours", "chr", 2), "sportif": T("3 essais chronométrés", "chr", 3), "perf": T("3 essais chronométrés", "chr", 3), "elite": T("3 essais chronométrés", "chr", 3)},
  "Le T-test est fiable et reflète la puissance des jambes et la vitesse de déplacement dans plusieurs directions (Pauole, 2000).",
  ["pauole00", "sheppard06"],
  sc={"f": "pelouse", "v": [-3, 2.5, 13.5, 17.5], "o": [[0, 10, "c", "A"], [9.14, 10, "c", "B"], [9.14, 5.43, "c", "C"], [9.14, 14.57, "c", "D"]],
      "p": [{"k": "sprint", "p": [[0, 10.3], [8.8, 10.3]], "l": "9,14 m", "lo": 1, "n": 1}, {"k": "lat", "p": [[9.5, 10], [9.5, 5.43]], "l": "4,57 m", "n": 2, "lo": 1},
            {"k": "lat", "p": [[10.1, 5.43], [10.1, 14.57]], "l": "9,14 m", "n": 3, "lo": 1, "lp": 0.7}, {"k": "lat", "p": [[9.5, 14.57], [9.5, 10]], "n": 4}, {"k": "back", "p": [[8.8, 9.6], [0, 9.6]], "l": "Course arrière", "lo": -1, "n": 5}]},
  test="ttest", z=5)

D("g_reactif", "Agilité réactive (miroir à deux)", COLL + RAQ + ["boxe", "lutte"], "Agilité", "4 plots, un partenaire",
  "Réagir à un adversaire, pas à un parcours appris : c'est l'agilité du match.",
  ["Délimite un couloir de 5 m de large avec 2 plots de chaque côté.", "L'attaquant (or) se déplace librement de gauche à droite, le défenseur (blanc) le suit en miroir.", "Au bout de 3 à 5 s, l'attaquant sprinte vers une porte : le défenseur doit la fermer avant lui.", "Inversez les rôles à chaque répétition."],
  ["Défenseur : appuis actifs, centre de gravité bas", "Regarde les hanches de l'attaquant, pas ses épaules", "Effort de 5 s maximum, récupération complète"],
  {"reprise": I(1, 6, 5, 25, 0, "Miroir 5 s", "6 répétitions de 5 s, 25 s de récupération"),
   "sportif": I(2, 6, 5, 25, 120, "Miroir 5 s", "2 séries de 6 répétitions"),
   "perf": I(3, 6, 5, 25, 120, "Miroir + sprint", "3 séries de 6 répétitions avec sprint final"),
   "elite": I(3, 8, 5, 25, 120, "Miroir + sprint", "3 séries de 8 répétitions avec sprint final")},
  "L'agilité dépend autant de la lecture de l'adversaire que de la vitesse de changement de direction : les exercices réactifs l'entraînent mieux qu'un parcours fixe (Sheppard et Young, 2006).",
  ["sheppard06"],
  sc={"f": "pelouse", "v": [-2, -3, 12, 9], "o": [[0, -1, "c", ""], [5, -1, "c", ""], [0, 7, "c", ""], [5, 7, "c", ""], [2.5, 0.8, "pa", "Attaquant"], [2.5, 5.2, "pb", "Défenseur"]],
      "z": [[8.6, -1.6, 2.2, 9.2, "Porte"]],
      "p": [{"k": "lat", "p": [[2.5, 0.8], [0.9, 0.55], [4.1, 1.05], [2.2, 0.6]], "r": 0, "l": "Feintes", "lp": 0.5}, {"k": "sprint", "p": [[2.2, 0.6], [9.6, 0.8]], "r": 0, "l": "Sprint vers la porte", "lp": 0.7},
            {"k": "lat", "p": [[2.5, 5.2], [0.9, 5.45], [4.1, 4.95], [2.2, 5.4]], "r": 1, "l": "Miroir", "lo": 1, "lp": 0.5}, {"k": "sprint", "p": [[2.2, 5.4], [9.3, 2.0]], "r": 1, "l": "Ferme la porte", "lo": 1, "lp": 0.65}]}, z=5)

# ---------- rugby ----------
D("r_bronco", "Test Bronco (1 200 m)", ["rugby", "rugby7"], "Test", "4 plots, chrono",
  "Le test de référence du rugby : 5 tours de 20-40-60 m sans s'arrêter.",
  ["Plots sur la ligne d'en-but (départ), à 20, 40 et 60 m.", "Un tour : aller-retour au plot des 20 m, puis des 40 m, puis des 60 m (240 m).", "Enchaîne 5 tours sans t'arrêter : 1 200 m.", "Le chrono s'arrête quand tu franchis la ligne de départ à la fin du 5e tour."],
  ["Pose le pied derrière chaque plot avant de repartir", "Pars vite mais pas à fond : régularité des tours", "Repères souvent cités chez les professionnels : avants 4 min 50 à 5 min 10, trois-quarts 4 min 20 à 4 min 45. Compare-toi d'abord à toi-même"],
  {"reprise": T("Pas de test complet en Reprise : fais 3 tours (720 m) à allure contrôlée", "chr", 1), "sportif": T("1 essai de 5 tours, à fond", "chr", 1),
   "perf": T("1 essai de 5 tours, toutes les 4 à 6 semaines", "chr", 1), "elite": T("1 essai de 5 tours, toutes les 4 semaines en préparation", "chr", 1)},
  "Le temps au Bronco est fortement lié aux résultats des tests navette et Yo-Yo chez les rugbymen : c'est un bon indicateur de leur condition physique (Sella, 2021).",
  ["sella21", "bangsbo08"],
  sc={"f": "rugby", "v": [-6, 21, 66, 48], "o": [[0, 43.5, "start", "Départ"], [20.8, 26.2, "c", ""], [40.8, 32.7, "c", ""], [60.8, 39.2, "c", ""]],
      "p": [{"k": "sprint", "p": [[0, 25.5], [20, 25.5]], "l": "20 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[20, 27], [0, 27]]},
            {"k": "sprint", "p": [[0, 32], [40, 32]], "l": "40 m", "n": 2, "e": "turn"}, {"k": "sprint", "p": [[40, 33.5], [0, 33.5]]},
            {"k": "sprint", "p": [[0, 38.5], [60, 38.5]], "l": "60 m", "n": 3, "e": "turn"}, {"k": "sprint", "p": [[60, 40], [0, 40]]}],
      "t": [[34, 46.4, "1 tour = 240 m · 5 tours sans arrêt = 1 200 m"]]},
  test="bronco", poste={"avant": "Avants : vise d'abord la régularité des 5 tours, puis passe sous les 5 min 30.", "trois-quarts": "Trois-quarts : ton objectif est de descendre progressivement vers les 4 min 45."}, z=5)

D("r_bronco_casse", "Bronco cassé (1 tour par minute)", ["rugby", "rugby7"], "Endurance", "4 plots, chrono",
  "Le Bronco découpé en tours : même parcours, avec une récupération après chaque tour.",
  ["Même parcours que le Bronco : 20, 40 et 60 m aller-retour depuis la ligne d'en-but.", "Au bip, fais un tour complet (240 m).", "Récupère en marchant jusqu'au bip suivant.", "Haut niveau : 2 séries, 2 minutes entre les séries."],
  ["Le tour doit prendre 50 à 55 s : ce qui reste de la minute, c'est ta récupération", "Pied derrière chaque ligne", "Les derniers tours au même temps que les premiers"],
  {"reprise": I(1, 3, 60, 90, 0, "1 tour de 240 m", "3 tours, 1 min d'effort et 1 min 30 de récupération"),
   "sportif": I(1, 4, 60, 60, 0, "1 tour de 240 m", "4 tours, 1 min d'effort et 1 min de récupération"),
   "perf": I(1, 5, 60, 60, 0, "1 tour de 240 m", "5 tours, 1 min / 1 min (10 min)"),
   "elite": I(2, 5, 55, 45, 120, "1 tour de 240 m", "2 séries de 5 tours, 55 s d'effort et 45 s de récupération")},
  "Des intervalles de 50 à 60 secondes à haute intensité, entrecoupés d'une récupération équivalente, améliorent la puissance aérobie et la tolérance à l'effort lactique (Buchheit et Laursen, 2013).",
  ["buchheit13b", "sella21"],
  sc={"f": "rugby", "v": [-6, 21, 66, 48], "o": [[0, 43.5, "start", "Départ"], [20.8, 26.2, "c", ""], [40.8, 32.7, "c", ""], [60.8, 39.2, "c", ""]],
      "p": [{"k": "sprint", "p": [[0, 25.5], [20, 25.5]], "l": "20 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[20, 27], [0, 27]]},
            {"k": "sprint", "p": [[0, 32], [40, 32]], "l": "40 m", "n": 2, "e": "turn"}, {"k": "sprint", "p": [[40, 33.5], [0, 33.5]]},
            {"k": "sprint", "p": [[0, 38.5], [60, 38.5]], "l": "60 m", "n": 3, "e": "turn"}, {"k": "sprint", "p": [[60, 40], [0, 40]], "w": 1.5}],
      "t": [[34, 46.4, "1 tour de 240 m par minute · récupère le reste de la minute"]]}, z=4)

D("r_malcolm", "Malcolms", ["rugby", "rugby7"], "Endurance", "Les lignes du terrain",
  "Sprints courts et relevés du sol : l'enchaînement plaquage, relevé, replacement.",
  ["Départ allongé ventre au sol sur la ligne médiane.", "Relève-toi, sprinte jusqu'à la ligne des 10 m, plaque-toi au sol.", "Relève-toi, sprinte jusqu'à l'autre ligne des 10 m (20 m), au sol.", "Relève-toi et sprinte jusqu'à la ligne médiane, au sol : c'est 1 Malcolm (40 m, 3 relevés)."],
  ["Poitrine au sol à chaque fois, relevé explosif", "Cible : 15 s par Malcolm, départ toutes les 25 s", "Variante : pars en course arrière vers la première ligne, comme un repli défensif"],
  {"reprise": I(2, 4, 30, 0, 180, "1 Malcolm (cible 18 s)", "2 séries de 4 Malcolms, départ toutes les 30 s, 3 min entre"),
   "sportif": I(2, 6, 25, 0, 180, "1 Malcolm (cible 15 s)", "2 séries de 6 Malcolms, départ toutes les 25 s"),
   "perf": I(3, 6, 25, 0, 150, "1 Malcolm (cible 15 s)", "3 séries de 6 Malcolms, départ toutes les 25 s"),
   "elite": I(4, 6, 25, 0, 120, "1 Malcolm (cible 14 s)", "4 séries de 6 Malcolms, départ toutes les 25 s, 2 min entre")},
  "En match, les rugbymen enchaînent des séquences d'efforts intenses (sprints, plaquages, relevés) avec moins de 21 secondes de récupération : s'y préparer à l'entraînement est spécifique (Austin, 2011).",
  ["austin11", "buchheit13b"],
  sc={"f": "rugby", "v": [33, 24, 67, 46], "o": [[50, 29, "x", ""]],
      "p": [{"k": "sprint", "p": [[50, 29], [60, 29]], "l": "10 m", "n": 1, "e": "down", "w": 0.6}, {"k": "sprint", "p": [[60, 34], [40, 34]], "l": "20 m", "n": 2, "e": "down", "w": 0.6},
            {"k": "sprint", "p": [[40, 39], [50, 39]], "l": "10 m", "n": 3, "e": "down", "w": 0.8}],
      "t": [[50, 44.6, "Départ ventre au sol · 40 m, 3 relevés · cible 15 s"]]},
  poste={"avant": "Avants : c'est ta séance clé. Ajoute un plaquage sur bouclier au 2e relevé si tu as un partenaire.", "trois-quarts": "Trois-quarts : pars en course arrière sur le premier segment pour imiter le repli."}, z=5)

D("r_rhie", "Efforts répétés (sprints et plaquages)", ["rugby"], "Endurance", "4 plots, bouclier facultatif",
  "Reproduire les séquences les plus dures du match : sprint, plaquage, relevé, repli, sprint.",
  ["Plots à 0, 10, 20 et 35 m.", "Sprint 10 m, plaque-toi au sol (ou plaque un bouclier), relève-toi.", "Sprint 10 m, au sol, relève-toi, repli de 5 m en course arrière.", "Sprint final de 15 m. Récupère en marchant jusqu'au départ suivant."],
  ["Relevés explosifs : poitrine au sol, mains sous les épaules", "Le dernier sprint est le plus important", "Avec un partenaire : plaquage sur bouclier au 2e plot, épaule basse"],
  {"reprise": I(2, 4, 35, 0, 180, "1 séquence (sans contact)", "2 séries de 4 séquences, départ toutes les 35 s"),
   "sportif": I(2, 5, 30, 0, 180, "1 séquence", "2 séries de 5 séquences, départ toutes les 30 s"),
   "perf": I(3, 5, 30, 0, 180, "1 séquence", "3 séries de 5 séquences, départ toutes les 30 s"),
   "elite": I(3, 6, 25, 0, 180, "1 séquence (plaquage sur bouclier)", "3 séries de 6 séquences, départ toutes les 25 s")},
  "Les séquences d'au moins 3 efforts intenses séparés de moins de 21 secondes sont les moments les plus exigeants du match ; avants et trois-quarts n'en vivent pas les mêmes (Austin, 2011).",
  ["austin11", "bishop11"],
  sc={"f": "rugby", "v": [-4, 26, 40, 46], "o": [[0, 33, "start", "Départ"], [10, 32.4, "x", "Au sol"], [20, 32.4, "shield", "Plaquage"], [35, 41, "c", "Arrivée"]],
      "p": [{"k": "sprint", "p": [[0, 31], [10, 31]], "l": "10 m", "n": 1, "e": "down", "w": 0.6}, {"k": "sprint", "p": [[10, 31], [20, 31]], "l": "10 m", "n": 2, "e": "down", "w": 0.6},
            {"k": "back", "p": [[20, 37], [15, 37]], "l": "Repli 5 m", "lo": -1, "n": 3}, {"k": "sprint", "p": [[15, 39.5], [35, 39.5]], "l": "Sprint final", "lo": 1, "n": 4}]},
  poste={"avant": "Avants : plaque un bouclier au 2e plot et ajoute un 3e relevé avant le sprint final.", "trois-quarts": "Trois-quarts : allonge le sprint final à 25 m."}, z=5)

D("r_defense", "Montée défensive réactive", ["rugby", "rugby7"], "Agilité", "5 plots, un partenaire",
  "Monter vite en ligne, se placer face à l'attaquant, glisser et se replier.",
  ["Aligne-toi sur une ligne de 3 plots (ta ligne de défense).", "Au signal, monte vite sur 7 m vers l'attaquant.", "Freine, glisse en pas chassés du côté que le partenaire annonce.", "Replie-toi en course arrière sur 5 m."],
  ["Montée rapide puis freinage en appuis courts (« hachés »)", "Épaules face à l'attaquant, hanches basses", "Effort de 6 s, récupération complète"],
  {"reprise": I(2, 5, 20, 0, 120, "Montée + glisse + repli", "2 séries de 5, départ toutes les 20 s"),
   "sportif": I(3, 5, 20, 0, 120, "Montée + glisse + repli", "3 séries de 5"),
   "perf": I(3, 6, 20, 0, 120, "Montée + glisse + repli", "3 séries de 6, côté annoncé au dernier moment"),
   "elite": I(4, 6, 20, 0, 120, "Montée + glisse + repli", "4 séries de 6, signal visuel du partenaire")},
  "Réagir à un signal entraîne mieux l'agilité du match qu'un parcours prévu à l'avance (Sheppard et Young, 2006).",
  ["sheppard06", "dossantos18"],
  sc={"f": "rugby", "v": [36, 24, 58, 46], "o": [[40, 28, "c", ""], [40, 35, "c", "Ligne de défense"], [40, 42, "c", ""], [51, 35, "pa", "Attaquant"]],
      "p": [{"k": "sprint", "p": [[40.5, 35], [47, 35]], "l": "Montée 7 m", "n": 1}, {"k": "lat", "p": [[47, 35], [47, 40]], "l": "Glisse", "n": 2, "lo": 1}, {"k": "back", "p": [[47, 40.5], [42, 40.5]], "l": "Repli 5 m", "n": 3, "lo": 1}]}, z=5)

# ---------- football ----------
D("f_yoyo", "Test Yo-Yo intermittent (niveau 1)", ["foot", "hand", "basket", "hockey"], "Test", "3 plots, bande-son du test",
  "Le test de référence du football : 2 × 20 m au bip, 10 s de récupération active.",
  ["Plots à 0 et 20 m, et un plot de récupération 5 m derrière le départ.", "Lance la bande-son officielle (application Yo-Yo IR1).", "Aller-retour de 2 × 20 m au rythme des bips, puis 10 s de trot autour du plot de récupération.", "Note la distance totale au 2e retard."],
  ["Pied derrière la ligne à chaque bip", "Récupération active : trottine, ne t'arrête pas", "Résultat en mètres"],
  {"reprise": T("En profil Reprise, remplace le test par un 15-15 modéré."), "sportif": T("1 test, après 15 min d'échauffement"), "perf": T("1 test toutes les 6 à 8 semaines"), "elite": T("1 test en début de préparation, puis toutes les 6 semaines")},
  "Le Yo-Yo IR1 évalue la capacité à répéter des efforts intenses ; il est lié à la distance courue à haute intensité en match (Bangsbo, 2008).",
  ["bangsbo08", "stolen05"],
  sc={"f": "pelouse", "v": [-9, -3.5, 24, 10], "o": [[-5, 3.2, "c", "Récup"], [0, 3.2, "c", "Départ"], [20, 3.2, "c", "20 m"]],
      "p": [{"k": "sprint", "p": [[0, 1], [20, 1]], "l": "20 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[20, 6], [0, 6]], "l": "20 m", "lo": 1, "n": 2}, {"k": "jog", "p": [[0, 6], [-5, 6], [-5, 1], [0, 1]], "l": "10 s de trot", "lo": 1, "lp": 0.12, "n": 3}]},
  test="yoyo", z=5)

D("f_b2b", "Box to box", ["foot"], "Endurance", "Terrain de foot ou 2 plots à 72 m",
  "Courir d'une surface de réparation à l'autre, comme les transitions du match.",
  ["Départ sur la ligne de la surface de réparation.", "Cours jusqu'à la ligne de la surface opposée (72 m) en 12 à 16 s.", "Reviens en trottinant jusqu'au départ suivant.", "Garde le même temps sur toutes les répétitions."],
  ["Allure forte mais contrôlée : 80 à 90 % de ta vitesse", "Retour en trottinant, pas en marchant", "Gardien : remplace par 6 séries de pas chassés + détente latérale"],
  {"reprise": I(1, 5, 75, 0, 0, "72 m en 16 s, retour en trottinant", "5 box to box, départ toutes les 75 s"),
   "sportif": I(1, 6, 60, 0, 0, "72 m en 14 s, retour en trottinant", "6 box to box, départ toutes les 60 s"),
   "perf": I(2, 6, 60, 0, 180, "72 m en 13 s, retour en trottinant", "2 séries de 6, départ toutes les 60 s, 3 min entre"),
   "elite": I(2, 8, 60, 0, 180, "72 m en 12 s, retour en trottinant", "2 séries de 8, départ toutes les 60 s")},
  "Les footballeurs couvrent l'essentiel de leurs efforts intenses en transitions ; les intervalles longs à haute intensité développent la puissance aérobie qui les soutient (Stølen, 2005).",
  ["stolen05", "buchheit13a"],
  sc={"f": "foot", "v": [-3, 14, 108, 56], "o": [[16.5, 34, "start", "Départ"], [88.5, 34, "c", "Arrivée"]],
      "p": [{"k": "sprint", "p": [[16.5, 32], [88.5, 32]], "l": "72 m en 12 à 16 s", "n": 1, "w": 0.6}, {"k": "jog", "p": [[88.5, 37], [16.5, 37]], "l": "Retour en trottinant", "lo": 1, "n": 2}]},
  poste={"gardien": "Gardien : remplace par 6 séries de 4 pas chassés + détente latérale, 30 s de récupération.", "milieu": "Milieu : tu es le plus sollicité en transitions, vise le haut de la fourchette."}, z=4)

D("f_ssg", "Jeux réduits 4 contre 4", ["foot", "hand", "basket", "hockey"], "Endurance", "8 joueurs, 2 petits buts, chasubles",
  "Travailler le cardio avec le ballon : intensité de match et décisions.",
  ["Terrain de 30 × 20 m, deux petits buts.", "4 contre 4, touches au pied, pas de gardien.", "Le coach relance un ballon dès qu'il sort.", "Encouragements permanents : l'intensité doit rester haute."],
  ["Plus le terrain est petit et moins il y a de joueurs, plus c'est intense", "Récupère en marchant entre les jeux", "Se joue avec ton équipe : sinon, fais un 15-15"],
  {"reprise": I(1, 3, 180, 120, 0, "Jeu 3 min", "3 jeux de 3 min, 2 min de récupération"),
   "sportif": I(1, 4, 240, 120, 0, "Jeu 4 min", "4 jeux de 4 min, 2 min de récupération"),
   "perf": I(1, 5, 240, 120, 0, "Jeu 4 min", "5 jeux de 4 min, 2 min de récupération"),
   "elite": I(1, 6, 240, 90, 0, "Jeu 4 min", "6 jeux de 4 min, 1 min 30 de récupération")},
  "Les jeux réduits amènent la fréquence cardiaque aussi haut que le fractionné ; on règle l'intensité avec la taille du terrain et le nombre de joueurs (Hill-Haas, 2011).",
  ["hillhaas11"],
  sc={"f": "foot", "v": [33, 19, 72, 49], "z": [[37.5, 24, 30, 20, "30 × 20 m"]],
      "o": [[37.5, 34, "goal", ""], [67.5, 34, "goal", ""], [42, 28, "pa", ""], [45, 39, "pa", ""], [52, 31, "pa", ""], [58, 37, "pa", ""], [48, 27, "pb", ""], [50, 40, "pb", ""], [57, 29, "pb", ""], [62, 35, "pb", ""], [52, 31, "ball", ""]],
      "p": [{"k": "ball", "p": [[52, 31], [45, 39]], "n": 1}, {"k": "ball", "p": [[45, 39], [58, 37]], "n": 2}, {"k": "ball", "p": [[58, 37], [67.5, 34]], "l": "But", "n": 3}]}, z=4)

# ---------- handball ----------
D("h_ca", "Contre-attaque et repli", ["hand"], "Endurance", "Terrain de hand",
  "Sprinter en contre-attaque, puis revenir défendre aussi vite.",
  ["Départ sur ta ligne des 6 m.", "Sprint en contre-attaque jusqu'aux 6 m adverses (28 m), tir simulé.", "Repli en sprint jusqu'à ta ligne des 9 m.", "Glisse en pas chassés sur la ligne des 9 m, puis récupère jusqu'au départ suivant."],
  ["Sprint en regardant par-dessus l'épaule (passe imaginaire)", "Repli : premiers appuis explosifs", "Pas chassés bas, sans croiser"],
  {"reprise": I(2, 4, 35, 0, 180, "Contre-attaque + repli", "2 séries de 4, départ toutes les 35 s"),
   "sportif": I(2, 5, 30, 0, 180, "Contre-attaque + repli", "2 séries de 5, départ toutes les 30 s"),
   "perf": I(3, 5, 30, 0, 150, "Contre-attaque + repli", "3 séries de 5"),
   "elite": I(3, 6, 30, 0, 150, "Contre-attaque + repli", "3 séries de 6")},
  "En handball, les ailiers et arrières font le plus de sprints, souvent lors des contre-attaques et des replis : le travail doit tenir compte du poste (Karcher et Buchheit, 2014).",
  ["karcher14", "bishop11"],
  sc={"f": "hand", "v": [-2, -2, 42, 22], "o": [[6, 10, "start", "Départ"]],
      "p": [{"k": "sprint", "p": [[6, 9], [34, 9]], "l": "Contre-attaque 28 m", "n": 1, "e": "hit", "w": 0.5}, {"k": "sprint", "p": [[34, 11], [9, 11]], "l": "Repli 25 m", "lo": 1, "n": 2}, {"k": "lat", "p": [[9, 11], [9, 4]], "l": "Glisse", "lo": 1, "n": 3}]},
  poste={"ailier": "Ailier : contre-attaque le long de la ligne de touche, sprint de 35 m.", "pivot": "Pivot : remplace la glisse par 3 duels d'appuis de 2 s contre un partenaire.", "gardien": "Gardien : fais plutôt le T-test et des détentes latérales."}, z=5)

D("h_def", "Défense 6-9 m", ["hand"], "Agilité", "5 plots",
  "Monter sur le tireur et se replier sur sa zone : le travail du défenseur.",
  ["Plots sur la ligne des 6 m (3) et des 9 m (2), en quinconce.", "Monte vers le plot des 9 m, bras hauts.", "Recule en pas chassés vers le plot suivant des 6 m.", "Enchaîne les 4 segments, en zigzag."],
  ["Montée : 2-3 appuis rapides, bras levés", "Recul : pas chassés bas, regard vers l'avant", "Effort de 20 s, puis 40 s de récupération"],
  {"reprise": I(1, 6, 15, 45, 0, "Zigzag 6-9 m", "6 répétitions de 15 s, 45 s de récupération"),
   "sportif": I(2, 6, 20, 40, 120, "Zigzag 6-9 m", "2 séries de 6 × 20 s"),
   "perf": I(2, 8, 20, 40, 120, "Zigzag 6-9 m", "2 séries de 8 × 20 s"),
   "elite": I(3, 8, 20, 40, 120, "Zigzag 6-9 m", "3 séries de 8 × 20 s")},
  "Les défenseurs enchaînent des déplacements courts, des duels et des changements de direction ; leur préparation doit les reproduire (Karcher et Buchheit, 2014).",
  ["karcher14", "dossantos18"],
  sc={"f": "hand", "v": [-1, -1, 14, 21], "o": [[6, 4, "c", ""], [9, 7, "c", ""], [6, 10, "c", ""], [9, 13, "c", ""], [6, 16, "c", ""]],
      "p": [{"k": "sprint", "p": [[6, 4], [9, 7]], "l": "Monte", "n": 1}, {"k": "back", "p": [[9, 7], [6, 10]], "l": "Recule", "lo": 1, "n": 2}, {"k": "sprint", "p": [[6, 10], [9, 13]], "n": 3}, {"k": "back", "p": [[9, 13], [6, 16]], "n": 4}],
      "t": [[3.2, 18.8, "Zone 6 m"], [11.8, 2, "9 m"]]}, z=4)

# ---------- basket ----------
D("b_17", "Seventeens (17 largeurs)", ["basket"], "Endurance", "Terrain de basket",
  "17 largeurs de terrain en moins d'une minute : le grand classique du basket.",
  ["Départ sur une ligne de touche.", "Traverse la largeur du terrain (15 m), touche la ligne avec le pied.", "Fais 17 largeurs (255 m) le plus vite possible.", "Récupère 2 à 3 minutes, puis recommence."],
  ["Cible : moins de 65 s (moins de 60 s pour le haut niveau)", "Appuis bas et courts avant chaque ligne", "Alterne le pied qui touche la ligne"],
  {"reprise": I(1, 2, 60, 180, 0, "12 largeurs", "2 × 12 largeurs, 3 min de récupération"),
   "sportif": I(1, 3, 65, 150, 0, "17 largeurs (cible 65 s)", "3 × 17 largeurs, 2 min 30 de récupération"),
   "perf": I(1, 4, 62, 150, 0, "17 largeurs (cible 62 s)", "4 × 17 largeurs, 2 min 30 de récupération"),
   "elite": I(1, 5, 60, 120, 0, "17 largeurs (cible 60 s)", "5 × 17 largeurs, 2 min de récupération")},
  "Le basket alterne des efforts brefs très intenses et des changements de direction constants (Stojanović, 2018) : les navettes courtes répétées en reproduisent les exigences.",
  ["stojanovic18", "buchheit13b"],
  sc={"f": "basket", "v": [8, -1.5, 20, 16.5], "o": [[13, 0, "start", ""], [15, 15, "c", ""]],
      "p": [{"k": "sprint", "p": [[13, 0.3], [13, 14.7]], "l": "15 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[15, 14.7], [15, 0.3]], "l": "15 m", "lo": 1, "n": 2, "e": "turn"}],
      "t": [[17.6, 7.5, "× 17"]]}, z=5)

D("b_suicide", "Suicides (lignes)", ["basket"], "Endurance", "Terrain de basket",
  "Aller-retour à chaque ligne du terrain, de plus en plus loin.",
  ["Départ sur la ligne de fond.", "Aller-retour à la ligne de lancer franc (5,8 m), puis à la ligne médiane (14 m).", "Puis à la ligne de lancer franc opposée (22,2 m) et à la ligne de fond opposée (28 m).", "Total : 140 m. Touche chaque ligne avec la main."],
  ["Cible : 32 à 35 s", "Abaisse-toi en 2 appuis avant chaque ligne", "Récupération de 1 min 30 environ"],
  {"reprise": I(1, 3, 40, 80, 0, "Suicide 140 m", "3 suicides, départ toutes les 2 min"),
   "sportif": I(1, 4, 35, 85, 0, "Suicide 140 m (cible 35 s)", "4 suicides, départ toutes les 2 min"),
   "perf": I(1, 5, 34, 86, 0, "Suicide 140 m (cible 34 s)", "5 suicides, départ toutes les 2 min"),
   "elite": I(2, 4, 32, 88, 180, "Suicide 140 m (cible 32 s)", "2 séries de 4 suicides, 3 min entre")},
  "Les joueurs de basket changent de direction ou d'allure toutes les 2 à 3 secondes en match ; les navettes avec freinages répétés en reproduisent la charge (Stojanović, 2018).",
  ["stojanovic18", "dossantos18"],
  sc={"f": "basket", "v": [-1.5, -1, 29.5, 13], "o": [[0, 7.5, "start", ""], [5.8, 1.6, "c", "LF"], [14, 1.6, "c", "Milieu"], [22.2, 1.6, "c", "LF"], [28, 1.6, "c", "Fond"]],
      "p": [{"k": "sprint", "p": [[0, 3], [5.8, 3]], "l": "5,8 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[5.8, 3.8], [0, 3.8]]}, {"k": "sprint", "p": [[0, 5.4], [14, 5.4]], "l": "14 m", "n": 2, "e": "turn"}, {"k": "sprint", "p": [[14, 6.2], [0, 6.2]]},
            {"k": "sprint", "p": [[0, 7.8], [22.2, 7.8]], "l": "22,2 m", "n": 3, "e": "turn"}, {"k": "sprint", "p": [[22.2, 8.6], [0, 8.6]]}, {"k": "sprint", "p": [[0, 10.2], [28, 10.2]], "l": "28 m", "n": 4, "e": "turn"}, {"k": "sprint", "p": [[28, 11], [0, 11]]}]}, z=5)

D("b_box", "Défense en boîte (raquette)", ["basket"], "Agilité", "4 plots",
  "Glissés défensifs, sprint et course arrière autour de la raquette.",
  ["Départ au coin de la raquette, sur la ligne de fond.", "Glisse en pas chassés le long de la ligne de fond (4,9 m).", "Sprinte jusqu'à la ligne de lancer franc (5,8 m).", "Glisse le long de la ligne de lancer franc, puis course arrière jusqu'au départ."],
  ["Position basse, mains actives", "Ne croise pas les pieds en pas chassés", "15 s d'effort, puis 45 s de récupération"],
  {"reprise": I(1, 6, 15, 45, 0, "1 tour de raquette", "6 tours, 45 s de récupération"),
   "sportif": I(2, 6, 15, 45, 120, "1 tour de raquette", "2 séries de 6 tours"),
   "perf": I(2, 8, 15, 45, 120, "1 tour de raquette", "2 séries de 8 tours"),
   "elite": I(3, 8, 15, 45, 120, "1 tour de raquette", "3 séries de 8 tours")},
  "Les déplacements latéraux et arrière représentent une part importante de l'activité du basketteur, surtout en défense (Stojanović, 2018).",
  ["stojanovic18", "pauole00"],
  sc={"f": "basket", "v": [-1.2, 3, 8.5, 12], "o": [[0, 5.05, "c", "Départ"], [0, 9.95, "c", ""], [5.8, 9.95, "c", ""], [5.8, 5.05, "c", ""]],
      "p": [{"k": "lat", "p": [[0.4, 5.05], [0.4, 9.95]], "l": "Glisse", "n": 1, "lo": 1}, {"k": "sprint", "p": [[0.4, 9.6], [5.8, 9.6]], "l": "Sprint", "n": 2, "lo": 1}, {"k": "lat", "p": [[5.4, 9.95], [5.4, 5.05]], "l": "Glisse", "n": 3, "lo": 1}, {"k": "back", "p": [[5.8, 5.4], [0, 5.4]], "l": "Course arrière", "n": 4}]}, z=5)

# ---------- volley ----------
D("v_att", "Attaques répétées", ["volley"], "Puissance", "Filet ou ligne au sol",
  "Enchaîner élan, saut d'attaque et retour en défense, comme en match.",
  ["Départ en zone de défense (poste 4, 3 m derrière la ligne d'attaque).", "Élan de 3 pas et saut d'attaque près du filet.", "Réception sur deux pieds, puis retour en trottinant à ta position.", "Une attaque toutes les 12 s environ."],
  ["Dernier appui large et rapide, bras lancés vers le haut", "Réception souple, genoux dans l'axe", "Arrête si la hauteur de saut baisse nettement"],
  {"reprise": I(2, 4, 15, 0, 150, "Élan + saut + retour", "2 séries de 4 attaques"),
   "sportif": I(3, 5, 12, 0, 120, "Élan + saut + retour", "3 séries de 5 attaques"),
   "perf": I(4, 6, 12, 0, 120, "Élan + saut + retour", "4 séries de 6 attaques"),
   "elite": I(5, 6, 12, 0, 120, "Élan + saut + retour", "5 séries de 6 attaques")},
  "Les attaquants et centraux sautent le plus en match ; la qualité du saut avec élan distingue les meilleurs joueurs (Sheppard, 2009).",
  ["sheppard09"],
  sc={"f": "volley", "v": [7.5, -1.5, 20, 10.5], "o": [[15, 6, "start", ""]],
      "p": [{"k": "sprint", "p": [[15, 6], [13, 5.2], [11.6, 4.5], [10.3, 4]], "l": "Élan 3 pas", "n": 1, "e": "jump", "w": 0.6}, {"k": "jog", "p": [[10.6, 5.4], [15, 7.6]], "l": "Retour en défense", "lo": 1, "n": 2}]}, z=5)

D("v_block", "Contres le long du filet", ["volley"], "Agilité", "Filet",
  "Se déplacer le long du filet et contrer sur les 3 postes.",
  ["Départ au centre du filet (poste 3), mains à hauteur des épaules.", "Pas chassés vers le poste 4 (3 m), contre.", "Retour au poste 3, contre ; puis poste 2, contre.", "Récupère 30 s entre chaque série de 3 contres."],
  ["Pas chassés ou pas croisés rapides, épaules face au filet", "Mains qui passent au-dessus du filet, sans le toucher", "Réception équilibrée avant de repartir"],
  {"reprise": I(1, 5, 10, 40, 0, "3 contres (4-3-2)", "5 séries de 3 contres, 40 s de récupération"),
   "sportif": I(1, 8, 10, 30, 0, "3 contres (4-3-2)", "8 séries de 3 contres"),
   "perf": I(2, 8, 10, 30, 120, "3 contres (4-3-2)", "2 × 8 séries de 3 contres"),
   "elite": I(3, 8, 10, 30, 120, "3 contres (4-3-2)", "3 × 8 séries de 3 contres")},
  "Les centraux réalisent le plus de sauts de contre en match (Sheppard, 2009) : répéter le déplacement et le saut améliore leur endurance de saut.",
  ["sheppard09"],
  sc={"f": "volley", "v": [6.5, -1.5, 14, 10.5], "o": [[9.6, 4.5, "start", "Poste 3"], [9.6, 1.5, "c", "Poste 4"], [9.6, 7.5, "c", "Poste 2"]],
      "p": [{"k": "lat", "p": [[9.8, 4.5], [9.8, 1.5]], "l": "3 m", "n": 1, "e": "jump", "w": 0.5, "lo": 1}, {"k": "lat", "p": [[10.2, 1.5], [10.2, 4.5]], "n": 2, "e": "jump", "w": 0.5}, {"k": "lat", "p": [[9.8, 4.5], [9.8, 7.5]], "l": "3 m", "n": 3, "e": "jump", "lo": 1}]}, z=5)

# ---------- raquettes ----------
D("t_araignee", "Araignée (5 balles)", ["tennis"], "Agilité", "5 balles ou plots, chrono",
  "Couvrir le terrain et revenir au centre après chaque frappe.",
  ["Pose 5 balles : les deux coins de la ligne de fond, les deux coins du carré de service et le T.", "Départ au centre de la ligne de fond.", "Va chercher chaque balle et ramène-la au centre, dans l'ordre.", "Récupère 1 minute entre les répétitions."],
  ["Pas d'ajustement courts avant de ramasser la balle", "Freinage en position basse, comme pour frapper", "Cible : 15 à 18 s pour les 5 balles"],
  {"reprise": I(1, 3, 20, 90, 0, "Araignée 5 balles", "3 araignées, 1 min 30 de récupération"),
   "sportif": I(1, 4, 20, 60, 0, "Araignée 5 balles", "4 araignées, 1 min de récupération"),
   "perf": I(1, 6, 18, 60, 0, "Araignée 5 balles (cible 17 s)", "6 araignées, 1 min de récupération"),
   "elite": I(2, 5, 17, 60, 180, "Araignée 5 balles (cible 16 s)", "2 séries de 5 araignées, 3 min entre")},
  "Un point de tennis dure en moyenne 5 à 10 secondes, avec 4 à 5 changements de direction : les déplacements courts et explosifs sont décisifs (Kovacs, 2007).",
  ["kovacs07", "fernandez09"],
  sc={"f": "tennis", "v": [11, -1.2, 25.6, 12.2], "o": [[23.77, 5.485, "start", "Centre"], [23.77, 1.37, "ball", ""], [18.285, 1.37, "ball", ""], [18.285, 5.485, "ball", "T"], [18.285, 9.6, "ball", ""], [23.77, 9.6, "ball", ""]],
      "p": [{"k": "lat", "p": [[23.5, 5.2], [23.5, 1.6]], "n": 1}, {"k": "jog", "p": [[23.3, 1.6], [23.3, 5.2]]}, {"k": "sprint", "p": [[23.4, 5.3], [18.5, 1.6]], "n": 2}, {"k": "back", "p": [[18.9, 1.9], [23.2, 5.1]]},
            {"k": "sprint", "p": [[23.4, 5.485], [18.6, 5.485]], "n": 3, "l": "5,5 m"}, {"k": "back", "p": [[18.6, 5.8], [23.4, 5.8]]}, {"k": "sprint", "p": [[23.4, 5.9], [18.5, 9.4]], "n": 4}, {"k": "back", "p": [[18.9, 9.1], [23.2, 6.0]]},
            {"k": "lat", "p": [[23.5, 6.1], [23.5, 9.4]], "n": 5}, {"k": "jog", "p": [[23.3, 9.4], [23.3, 5.8]]}]}, z=5)

D("t_echanges", "Échanges simulés (10 s / 20 s)", ["tennis"], "Endurance", "2 plots, raquette",
  "Reproduire le rythme d'un match : un point de 10 s, 20 s entre les points.",
  ["Pose 2 plots à 4 m l'un de l'autre sur la ligne de fond.", "Déplace-toi d'un plot à l'autre en pas chassés, frappe simulée à chaque plot.", "10 s d'effort comme un point, puis 20 s de récupération.", "90 s entre les séries, comme un changement de côté."],
  ["Replace-toi au centre après chaque frappe (pas de recentrage)", "Frappe simulée complète : appuis, rotation, accompagnement", "Respire et relâche pendant les 20 s"],
  {"reprise": I(2, 6, 8, 22, 120, "Point de 8 s", "2 séries de 6 points"),
   "sportif": I(2, 8, 10, 20, 90, "Point de 10 s", "2 séries de 8 points"),
   "perf": I(3, 8, 10, 20, 90, "Point de 10 s", "3 séries de 8 points"),
   "elite": I(3, 10, 10, 20, 90, "Point de 10 s", "3 séries de 10 points")},
  "En match, les points de 5 à 10 s alternent avec 20 s de récupération et 90 s aux changements de côté (Kovacs, 2007 ; Fernandez-Fernandez, 2009).",
  ["kovacs07", "fernandez09"],
  sc={"f": "tennis", "v": [11, -1.2, 25.6, 12.2], "o": [[24.2, 3.485, "c", ""], [24.2, 7.485, "c", ""]],
      "p": [{"k": "lat", "p": [[23.3, 5.485], [23.3, 3.6]], "e": "hit", "n": 1, "w": 0.3}, {"k": "lat", "p": [[23.3, 3.6], [23.3, 7.4]], "e": "hit", "n": 2, "w": 0.3, "l": "4 m", "lo": -1}, {"k": "lat", "p": [[23.3, 7.4], [23.3, 5.485]]}]}, z=4)

D("p_araignee", "Araignée de padel", ["padel"], "Agilité", "5 plots",
  "Toucher les zones clés du terrain et revenir au centre.",
  ["Plots : les deux coins du fond (contre les vitres), les deux côtés à hauteur de la ligne de service, le centre du filet.", "Départ au centre de ta moitié de terrain.", "Touche chaque plot et reviens au centre à chaque fois.", "1 minute de récupération entre les répétitions."],
  ["Pas d'ajustement courts près des vitres", "Recentre-toi en pas chassés", "Cible : 15 à 18 s"],
  {"reprise": I(1, 3, 20, 90, 0, "Araignée 5 plots", "3 répétitions, 1 min 30 de récupération"),
   "sportif": I(1, 4, 20, 60, 0, "Araignée 5 plots", "4 répétitions, 1 min de récupération"),
   "perf": I(1, 6, 18, 60, 0, "Araignée 5 plots", "6 répétitions"),
   "elite": I(2, 5, 17, 60, 180, "Araignée 5 plots", "2 séries de 5")},
  "Comme au tennis, les échanges reposent sur des déplacements courts, explosifs et répétés avec des changements de direction (Fernandez-Fernandez, 2009).",
  ["fernandez09", "dossantos18"],
  sc={"f": "padel", "v": [9, -1, 21, 11], "o": [[15.5, 5, "start", ""], [19.2, 0.9, "c", ""], [19.2, 9.1, "c", ""], [16.95, 0.6, "c", ""], [16.95, 9.4, "c", ""], [10.8, 5, "c", "Filet"]],
      "p": [{"k": "back", "p": [[15.7, 4.8], [19, 1.1]], "n": 1}, {"k": "sprint", "p": [[19, 1.3], [15.8, 4.7]]}, {"k": "lat", "p": [[15.6, 4.6], [16.95, 0.9]], "n": 2}, {"k": "lat", "p": [[16.7, 0.9], [15.4, 4.6]]},
            {"k": "sprint", "p": [[15.3, 5], [11.1, 5]], "n": 3}, {"k": "back", "p": [[11.1, 5.3], [15.3, 5.3]]}, {"k": "lat", "p": [[15.6, 5.4], [16.95, 9.1]], "n": 4}, {"k": "lat", "p": [[16.7, 9.1], [15.4, 5.5]]},
            {"k": "back", "p": [[15.7, 5.6], [19, 8.9]], "n": 5}, {"k": "sprint", "p": [[19, 8.7], [15.8, 5.4]]}]}, z=5)

D("p_filet", "Montée au filet et repli sur lob", ["padel"], "Agilité", "3 plots",
  "Le geste roi du padel : monter au filet, puis reculer vite sur le lob.",
  ["Départ au fond du terrain, près de la vitre.", "Monte au filet en 3-4 appuis, volée simulée.", "Repli en course arrière et pas chassés sur 5 m (lob adverse).", "Recentre-toi : 10 s d'effort, 20 s de récupération."],
  ["Split-step (petit sursaut) au moment de la volée adverse", "Repli : ne tourne pas le dos, pas chassés croisés", "Frappe simulée à chaque arrêt"],
  {"reprise": I(2, 6, 8, 22, 120, "Montée + repli", "2 séries de 6"),
   "sportif": I(2, 8, 10, 20, 90, "Montée + repli", "2 séries de 8"),
   "perf": I(3, 8, 10, 20, 90, "Montée + repli", "3 séries de 8"),
   "elite": I(3, 10, 10, 20, 90, "Montée + repli", "3 séries de 10")},
  "Les sports de raquette alternent des efforts de quelques secondes et des pauses courtes : les séries 10 s / 20 s en reproduisent le rythme (Fernandez-Fernandez, 2009).",
  ["fernandez09"],
  sc={"f": "padel", "v": [9, -1, 21, 11], "o": [[18, 5.5, "start", "Fond"]],
      "p": [{"k": "sprint", "p": [[18, 5.5], [12, 4.2]], "l": "Montée 6 m", "n": 1, "e": "hit", "w": 0.4}, {"k": "back", "p": [[12.2, 4.6], [16.8, 6.6]], "l": "Repli sur lob", "lo": 1, "n": 2, "e": "hit", "w": 0.3}, {"k": "lat", "p": [[16.8, 6.6], [17.8, 5.6]], "n": 3}]}, z=5)

D("bd_6pts", "Déplacements 6 points", ["badminton"], "Agilité", "6 plots ou volants",
  "Couvrir les 6 coins du terrain depuis la base centrale.",
  ["Plots aux 2 coins avant, aux 2 côtés au milieu, aux 2 coins du fond.", "Départ à la base, au centre du demi-terrain.", "Va vers chaque plot (fente avant, pas chassés sur les côtés, pas croisés vers le fond) et reviens à la base.", "15 s d'effort, 15 s de récupération."],
  ["Fente avant : talon d'abord, genou au-dessus du pied", "Retour à la base à chaque fois, en pas chassés", "Raquette en main pour garder la posture"],
  {"reprise": I(2, 6, 10, 20, 120, "6 points (10 s)", "2 séries de 6 × 10 s"),
   "sportif": I(3, 6, 15, 15, 120, "6 points (15 s)", "3 séries de 6 × 15 s"),
   "perf": I(3, 8, 15, 15, 120, "6 points (15 s)", "3 séries de 8 × 15 s"),
   "elite": I(4, 8, 15, 15, 120, "6 points (15 s)", "4 séries de 8 × 15 s")},
  "Le badminton enchaîne des échanges de quelques secondes avec de nombreuses fentes et changements de direction ; le travail de déplacement en reproduit les exigences (Phomsoupha et Laffaye, 2015).",
  ["phomsoupha15"],
  sc={"f": "bad", "v": [6, -0.8, 14.2, 6.9], "o": [[10.2, 3.05, "start", "Base"], [7.5, 0.6, "c", ""], [7.5, 5.5, "c", ""], [10.2, 0.4, "c", ""], [10.2, 5.7, "c", ""], [12.8, 0.6, "c", ""], [12.8, 5.5, "c", ""]],
      "p": [{"k": "sprint", "p": [[10.0, 2.9], [7.7, 0.8]], "n": 1}, {"k": "back", "p": [[7.9, 1.0], [10.0, 2.8]]}, {"k": "lat", "p": [[10.2, 2.7], [10.2, 0.6]], "n": 2}, {"k": "lat", "p": [[10.4, 0.6], [10.4, 2.8]]},
            {"k": "back", "p": [[10.4, 2.9], [12.6, 0.8]], "n": 3}, {"k": "sprint", "p": [[12.4, 1.0], [10.4, 2.9]]}, {"k": "back", "p": [[10.4, 3.2], [12.6, 5.3]], "n": 4}, {"k": "sprint", "p": [[12.4, 5.1], [10.4, 3.2]]},
            {"k": "lat", "p": [[10.2, 3.4], [10.2, 5.5]], "n": 5}, {"k": "lat", "p": [[10.0, 5.5], [10.0, 3.4]]}, {"k": "sprint", "p": [[10.0, 3.2], [7.7, 5.3]], "n": 6}, {"k": "back", "p": [[7.9, 5.1], [10.0, 3.3]]}]}, z=5)

# ---------- baseball ----------
D("bb_home1b", "Home → 1re base", ["baseball"], "Vitesse", "Bases ou plots, chrono",
  "Sortir de la boîte du frappeur et courir à travers la 1re base.",
  ["Départ dans la boîte du frappeur, en position de frappe.", "Swing simulé, puis sprint vers la 1re base (27,4 m).", "Cours à travers la base sans freiner, puis décélère sur 5 m le long de la ligne.", "Reviens en marchant : 90 s de récupération."],
  ["Premier pas croisé vers la 1re base", "Regarde la base, pas la balle", "Chronomètre du contact au pied sur la base"],
  {"reprise": I(1, 5, 8, 82, 0, "Home → 1re à 85 %", "5 sprints à 85 %, 1 min 30 de récupération"),
   "sportif": I(1, 6, 8, 82, 0, "Home → 1re", "6 sprints, 1 min 30 de récupération"),
   "perf": I(1, 8, 8, 82, 0, "Home → 1re chronométré", "8 sprints, 1 min 30 de récupération"),
   "elite": I(2, 6, 8, 82, 180, "Home → 1re chronométré", "2 séries de 6, 3 min entre")},
  "Au baseball, les sprints de 27 m entre les bases sont courts et maximaux : ils se travaillent comme une accélération, avec une récupération complète (Haugen, 2019).",
  ["haugen19", "petrakos16"],
  sc={"f": "baseball", "v": [-24, -3, 26, 45], "o": [[0, 40, "base", "Marbre"], [19.4, 20.6, "base", "1re"], [0, 1.2, "base", "2e"], [-19.4, 20.6, "base", "3e"]],
      "p": [{"k": "sprint", "p": [[0.8, 39.2], [19.4, 20.6]], "l": "27,4 m", "n": 1}, {"k": "jog", "p": [[19.4, 20.6], [22.9, 17.1]], "l": "Décélère", "n": 2}]},
  test="home1b", z=5)

D("bb_extra", "1re → 3e en arrondi", ["baseball"], "Vitesse", "Bases ou plots",
  "Prendre le virage à la 2e base sans perdre de vitesse.",
  ["Départ à la 1re base.", "Sprint vers la 2e en ouvrant légèrement ta course vers l'extérieur.", "Touche le coin intérieur de la 2e base et file vers la 3e.", "Total : environ 55 m. Récupère 2 min en marchant."],
  ["Arrondi commencé 4-5 m avant la base", "Penche le corps vers l'intérieur du virage", "Pied gauche sur le coin intérieur de la base"],
  {"reprise": I(1, 3, 10, 110, 0, "1re → 3e à 85 %", "3 courses à 85 %"),
   "sportif": I(1, 4, 10, 110, 0, "1re → 3e", "4 courses, 2 min de récupération"),
   "perf": I(1, 5, 10, 110, 0, "1re → 3e", "5 courses"),
   "elite": I(1, 6, 10, 110, 0, "1re → 3e", "6 courses")},
  "Les sprints en courbe demandent de la force et une technique propres : on les travaille à vitesse élevée, avec une récupération complète (Haugen, 2019).",
  ["haugen19"],
  sc={"f": "baseball", "v": [-24, -3, 26, 45], "o": [[0, 40, "base", "Marbre"], [19.4, 20.6, "base", "1re"], [0, 1.2, "base", "2e"], [-19.4, 20.6, "base", "3e"]],
      "p": [{"k": "sprint", "p": [[19.4, 20.6], [12, 11.5], [5, 4], [0, 1.2], [-6, 5.5], [-19.4, 20.6]], "l": "≈ 55 m en arrondi", "lp": 0.3, "n": 1}]}, z=5)

D("bb_vol", "Vol de base", ["baseball"], "Vitesse", "Bases ou plots",
  "Réagir au mouvement du lanceur et voler la 2e base.",
  ["Prends ton avance : 3-4 m depuis la 1re base, en position basse.", "Au signal (mouvement du lanceur), pas croisé et sprint vers la 2e.", "Glisse ou freine à la base.", "Reviens en marchant : 1 min 30 de récupération."],
  ["Premier pas croisé, sans se relever", "Regard vers la base", "Le partenaire varie le moment du signal"],
  {"reprise": I(1, 4, 6, 84, 0, "Vol de base à 85 %", "4 départs à 85 %"),
   "sportif": I(1, 6, 6, 84, 0, "Vol de base", "6 départs, 1 min 30 de récupération"),
   "perf": I(1, 8, 6, 84, 0, "Vol de base sur signal", "8 départs"),
   "elite": I(2, 6, 6, 84, 180, "Vol de base sur signal", "2 séries de 6")},
  "La réaction à un signal puis l'accélération sur 20-25 m se travaillent à intensité maximale avec une récupération complète (Haugen, 2019 ; Sheppard et Young, 2006).",
  ["haugen19", "sheppard06"],
  sc={"f": "baseball", "v": [-24, -3, 26, 45], "o": [[0, 40, "base", "Marbre"], [19.4, 20.6, "base", "1re"], [0, 1.2, "base", "2e"], [-19.4, 20.6, "base", "3e"], [16.6, 17.8, "pa", "Avance"]],
      "p": [{"k": "sprint", "p": [[16.6, 17.8], [0.6, 1.8]], "l": "≈ 23 m", "n": 1, "e": "down"}]}, z=5)

# ---------- bobsleigh, sprint ----------
D("bo_push", "Départs poussés", ["bob"], "Vitesse", "Luge à roues, traîneau lesté ou partenaire",
  "Pousser fort dès le premier appui, comme au départ du bob.",
  ["Mains sur la poignée de la luge à roues (ou d'un traîneau lesté), corps penché.", "Pousse sur la distance indiquée en appuis puissants.", "Lâche à la ligne et termine en sprint sur 5 m.", "Récupération complète : 3 à 4 minutes."],
  ["Corps incliné, poussée vers l'avant (pas vers le haut)", "Appuis rapides sous les hanches", "Pilote ou freineur : travaille aussi le saut dans le bob si tu as la piste"],
  {"reprise": I(1, 3, 6, 234, 0, "Poussée 15 m à 80 %", "3 poussées de 15 m à 80 %"),
   "sportif": I(1, 4, 6, 234, 0, "Poussée 20 m", "4 poussées de 20 m"),
   "perf": I(1, 6, 6, 234, 0, "Poussée 25 m", "6 poussées de 25 m"),
   "elite": I(2, 4, 6, 234, 300, "Poussée 30 m", "2 séries de 4 poussées de 30 m, 5 min entre")},
  "Le sprint résisté améliore surtout la phase d'accélération, celle qui compte au départ (Petrakos, 2016) ; la récupération complète garde une intensité maximale (Haugen, 2019).",
  ["petrakos16", "haugen19"],
  sc={"f": "bob", "v": [-3, -2, 40, 10], "o": [[0, 4, "start", "Départ"], [1.5, 4, "sled", ""], [25, 4, "c", "Lâcher"], [30, 4, "c", ""]],
      "p": [{"k": "sprint", "p": [[1.5, 3], [25, 3]], "l": "Poussée 15 à 30 m", "n": 1}, {"k": "sprint", "p": [[25, 3], [30, 3]], "l": "Sprint", "n": 2}]}, z=5)

D("x_cote", "Sprints en côte", ["bob", "sprint", "rugby", "rugby7", "foot", "course", "trail"], "Vitesse", "Côte de 5 à 10 %",
  "Accélérer contre la pente : force et puissance de poussée sans charge.",
  ["Trouve une côte régulière de 5 à 10 %.", "Sprinte sur la distance indiquée en poussant fort.", "Redescends en marchant : c'est ta récupération.", "Arrête dès que la vitesse diminue nettement."],
  ["Buste penché vers l'avant, poussée complète de la jambe d'appui", "Bras puissants, coudes à 90°", "Pente trop forte : la foulée se casse, choisis plus doux"],
  {"reprise": I(1, 4, 8, 112, 0, "Côte 15 m", "4 sprints de 15 m"),
   "sportif": I(1, 6, 8, 112, 0, "Côte 20 m", "6 sprints de 20 m"),
   "perf": I(1, 8, 8, 112, 0, "Côte 20 m", "8 sprints de 20 m"),
   "elite": I(2, 5, 10, 170, 240, "Côte 30 m", "2 séries de 5 sprints de 30 m")},
  "Les sprints en côte et les sprints résistés sollicitent davantage la poussée horizontale et améliorent l'accélération (Petrakos, 2016 ; Haugen, 2019).",
  ["petrakos16", "haugen19"],
  sc={"f": "cote", "v": [-3, -1, 34, 10], "o": [[0, 8, "start", "Départ"], [20, 4, "c", "20 m"]],
      "p": [{"k": "sprint", "p": [[0, 7.2], [20, 3.2]], "l": "Sprint 20 m", "n": 1}, {"k": "walk", "p": [[20, 4.6], [0, 8.6]], "l": "Redescends en marchant", "lo": 1, "n": 2}]}, z=5)

D("s_wickets", "Mini-haies espacées (wickets)", ["sprint", "rugby7", "foot"], "Vitesse", "8 mini-haies ou lattes",
  "Courir haut et rapide en gardant une foulée régulière.",
  ["Pose 8 mini-haies (15 cm) espacées de 1,6 à 2 m (à adapter à ta taille).", "Prends 15 m d'élan progressif.", "Cours au-dessus des haies, genou haut, appui sous le bassin.", "Récupère 3 minutes en marchant."],
  ["Hanches hautes, pas de « chaise »", "Appui actif, griffé sous le corps", "Espacement : 1,6 m pour débuter, jusqu'à 2 m"],
  {"reprise": I(1, 3, 8, 172, 0, "8 haies à 1,6 m", "3 passages, espacement 1,6 m"),
   "sportif": I(1, 4, 8, 172, 0, "8 haies à 1,7-1,8 m", "4 passages"),
   "perf": I(1, 5, 8, 172, 0, "8 haies à 1,8-1,9 m", "5 passages"),
   "elite": I(1, 6, 8, 232, 0, "8 haies à 1,9-2 m", "6 passages, 4 min de récupération")},
  "Les exercices de rythme comme les wickets aident à transférer la technique de sprint à vitesse élevée ; ils complètent le sprint maximal (Haugen, 2019).",
  ["haugen19"],
  sc={"f": "piste", "v": [-3, -4, 37, 13], "o": [[0, 6, "start", "Élan"]] + [[15.9 + i * 1.8, 3.6, "wk", ""] for i in range(8)],
      "p": [{"k": "jog", "p": [[0, 3.6], [14, 3.6]], "l": "15 m d'élan", "n": 1}, {"k": "sprint", "p": [[14, 3.6], [29.6, 3.6]], "l": "8 haies · 1,6 à 2 m", "n": 2}, {"k": "walk", "p": [[29.6, 3.6], [35, 3.6]]}]}, z=5)

# ---------- course, trail ----------
D("c_3030", "VMA courte 30-30", ["course", "trail", "triathlon"], "Endurance", "Piste ou chemin plat",
  "Courir 30 s vite, 30 s en trottinant : le fractionné de base pour progresser.",
  ["15 min d'échauffement en footing facile, puis 3 lignes droites.", "30 s à l'allure indiquée, puis 30 s de trot.", "3 minutes de trot entre les séries.", "10 min de retour au calme."],
  ["Allure régulière : la dernière répétition aussi vite que la première", "Trot actif pendant la récupération", "Sans VMA connue : allure que tu tiendrais 6 minutes"],
  {"reprise": I(1, 8, 30, 30, 0, "30 s à 95 % VMA", "8 × 30-30 à 95 % de ta VMA"),
   "sportif": I(2, 8, 30, 30, 180, "30 s à 100 % VMA", "2 × 8 × 30-30 à 100 % de ta VMA"),
   "perf": I(2, 10, 30, 30, 180, "30 s à 100 % VMA", "2 × 10 × 30-30"),
   "elite": I(3, 10, 30, 30, 180, "30 s à 105 % VMA", "3 × 10 × 30-30 à 105 %")},
  "Les intervalles courts autour de la VMA accumulent du temps proche de la consommation maximale d'oxygène, ce qui fait progresser l'endurance (Buchheit et Laursen, 2013).",
  ["buchheit13a", "seiler10"], pace={"secs": 30, "pct": {"reprise": 95, "sportif": 100, "perf": 100, "elite": 105}}, z=5)

D("c_1000", "Fractionné long 1 000 m", ["course", "triathlon", "crossfit"], "Endurance", "Piste ou parcours mesuré",
  "Tenir ton allure de 10 km sur des répétitions de 1 000 m.",
  ["15 min d'échauffement en footing, gammes et 3 accélérations.", "1 000 m à l'allure indiquée.", "2 min de trot entre les répétitions.", "10 min de retour au calme."],
  ["Allure calculée avec ta VMA (90 % environ)", "Appuie sur « Suivant » dès que tu as fini ton 1 000 m", "Dernière répétition au même temps que la première"],
  {"reprise": I(1, 3, 330, 120, 0, "1 000 m allure 10 km", "3 × 1 000 m, 2 min de trot"),
   "sportif": I(1, 4, 300, 120, 0, "1 000 m allure 10 km", "4 × 1 000 m, 2 min de trot"),
   "perf": I(1, 5, 270, 120, 0, "1 000 m allure 10 km", "5 × 1 000 m, 2 min de trot"),
   "elite": I(1, 6, 240, 90, 0, "1 000 m allure 10 km", "6 × 1 000 m, 1 min 30 de trot")},
  "Les intervalles longs à allure soutenue complètent le travail facile qui doit rester majoritaire : environ 80 % du volume à faible intensité chez les coureurs d'endurance (Seiler, 2010).",
  ["seiler10", "buchheit13a"], pace={"dist": 1000, "pct": {"reprise": 85, "sportif": 88, "perf": 90, "elite": 92}}, z=4)

D("c_seuil", "Seuil (allure semi-marathon)", ["course", "trail", "triathlon", "cyclisme"], "Endurance", "Parcours plat",
  "Repousser le moment où tu t'essouffles, à une allure confortablement difficile.",
  ["15 min d'échauffement facile.", "Blocs à l'allure du seuil : tu peux dire quelques mots, pas une phrase.", "2 min de trot entre les blocs.", "10 min de retour au calme."],
  ["Effort 7 sur 10, respiration rapide mais contrôlée", "Régulier : pas de départ trop rapide", "Vélo : 85 à 90 % de ta puissance au seuil"],
  {"reprise": I(1, 2, 360, 120, 0, "6 min au seuil", "2 × 6 min au seuil"),
   "sportif": I(1, 3, 480, 120, 0, "8 min au seuil", "3 × 8 min au seuil"),
   "perf": I(1, 3, 600, 120, 0, "10 min au seuil", "3 × 10 min au seuil"),
   "elite": I(1, 4, 600, 120, 0, "10 min au seuil", "4 × 10 min au seuil")},
  "Le travail au seuil est un complément efficace du volume facile ; trop de séances intenses fatiguent sans faire plus progresser (Seiler, 2010).",
  ["seiler10"], pace={"secs": 0, "pct": {"reprise": 82, "sportif": 85, "perf": 86, "elite": 87}}, z=3)

D("c_cotes", "Côtes courtes 30 s", ["course", "trail"], "Puissance", "Côte de 6 à 8 %",
  "Gagner en force et en économie de course sans aller en salle.",
  ["Échauffement de 15 min, dont 5 min de gammes.", "Monte la côte 30 s en poussant fort (effort 8 sur 10).", "Redescends en trottinant : c'est ta récupération.", "Retour au calme de 10 min."],
  ["Petits pas rapides, genou haut", "Buste légèrement penché, regard devant", "Garde la même distance à chaque montée"],
  {"reprise": I(1, 6, 30, 90, 0, "Côte 30 s", "6 côtes de 30 s"),
   "sportif": I(1, 8, 30, 90, 0, "Côte 30 s", "8 côtes de 30 s"),
   "perf": I(1, 10, 30, 90, 0, "Côte 30 s", "10 côtes de 30 s"),
   "elite": I(2, 8, 30, 90, 240, "Côte 30 s", "2 séries de 8 côtes")},
  "Le travail en côte et la pliométrie font partie des stratégies qui améliorent l'économie de course, c'est-à-dire le coût énergétique à une vitesse donnée (Barnes et Kilding, 2015).",
  ["barnes15", "vernillo17"],
  sc={"f": "cote", "v": [-3, -1, 52, 12], "o": [[0, 10, "start", "Bas de la côte"], [42, 3, "c", "≈ 30 s"]],
      "p": [{"k": "sprint", "p": [[0, 9.2], [42, 2.2]], "l": "30 s en poussant fort", "n": 1}, {"k": "jog", "p": [[42, 3.8], [0, 10.8]], "l": "Redescends en trottinant", "lo": 1, "n": 2}]}, z=4)

D("tr_cotes", "Côtes longues 3 min", ["trail"], "Endurance", "Côte longue (ou escaliers)",
  "Monter longtemps à allure soutenue, comme sur une course de trail.",
  ["Échauffement de 15 min.", "Monte 3 min à allure soutenue (effort 7 sur 10).", "Redescends en trottinant (3 min), pas trop vite.", "Marche active si la pente est forte : c'est aussi du trail."],
  ["Petits pas, cadence rapide", "Pente forte : mains sur les cuisses, marche puissante", "Descente souple, bruit des appuis minimal"],
  {"reprise": I(1, 3, 180, 180, 0, "3 min de montée", "3 montées de 3 min"),
   "sportif": I(1, 4, 180, 180, 0, "3 min de montée", "4 montées de 3 min"),
   "perf": I(1, 5, 180, 180, 0, "3 min de montée", "5 montées de 3 min"),
   "elite": I(1, 6, 240, 240, 0, "4 min de montée", "6 montées de 4 min")},
  "La montée et la descente sollicitent les muscles différemment : la descente, surtout excentrique, demande une préparation spécifique pour limiter les dégâts musculaires (Vernillo, 2017).",
  ["vernillo17", "seiler10"],
  sc={"f": "cote", "v": [-3, -1, 52, 12], "o": [[0, 10, "start", "Départ"], [45, 2, "c", "3 min"]],
      "p": [{"k": "jog", "p": [[0, 9.2], [45, 1.2]], "l": "3 min à allure soutenue", "n": 1}, {"k": "walk", "p": [[45, 2.8], [0, 10.8]], "l": "Descente en trottinant", "lo": 1, "n": 2}]}, z=4)

D("tr_desc", "Descentes techniques", ["trail"], "Technique", "Descente de 8 à 15 %",
  "Préparer tes cuisses aux descentes et gagner en confiance.",
  ["Échauffement de 15 min.", "Descends 45 à 60 s à allure contrôlée, appuis rapides.", "Remonte en marchant : c'est ta récupération.", "Commence sur un chemin facile, puis plus technique."],
  ["Buste légèrement en avant, regard 3 à 4 m devant", "Petits pas, pieds sous le bassin", "Bras écartés pour l'équilibre"],
  {"reprise": I(1, 4, 45, 135, 0, "Descente 45 s", "4 descentes de 45 s"),
   "sportif": I(1, 6, 60, 150, 0, "Descente 1 min", "6 descentes d'1 min"),
   "perf": I(1, 8, 60, 150, 0, "Descente 1 min", "8 descentes d'1 min"),
   "elite": I(1, 10, 60, 150, 0, "Descente 1 min", "10 descentes d'1 min")},
  "La course en descente provoque plus de courbatures et de dégâts musculaires que la montée ; s'y exposer progressivement protège pour les courses suivantes (Vernillo, 2017).",
  ["vernillo17"],
  sc={"f": "cote", "v": [-3, -1, 52, 12], "o": [[45, 2, "start", "Haut"], [0, 10, "c", "Bas"]],
      "p": [{"k": "sprint", "p": [[45, 1.2], [0, 9.2]], "l": "Descente contrôlée", "n": 1}, {"k": "walk", "p": [[0, 10.8], [45, 2.8]], "l": "Remonte en marchant", "lo": 1, "n": 2}]}, z=3)

# ---------- combat ----------
D("k_rounds", "Rounds de déplacements", ["boxe"], "Endurance", "Ring, tatami ou 4 plots (carré de 5 m)",
  "Tenir des rounds complets en restant mobile et précis.",
  ["Délimite un carré de 5 m.", "Shadow boxing en déplacement : avancer, reculer, pas de côté, pivots.", "Accélère 10 s au signal toutes les 30 s.", "1 minute de récupération entre les rounds."],
  ["Garde haute, menton rentré", "Appuis légers sur l'avant du pied", "Respiration à chaque frappe"],
  {"reprise": I(1, 3, 120, 60, 0, "Round de 2 min", "3 rounds de 2 min"),
   "sportif": I(1, 4, 180, 60, 0, "Round de 3 min", "4 rounds de 3 min"),
   "perf": I(1, 5, 180, 60, 0, "Round de 3 min", "5 rounds de 3 min"),
   "elite": I(1, 6, 180, 60, 0, "Round de 3 min", "6 rounds de 3 min")},
  "La boxe amateur demande à la fois une forte capacité aérobie et des efforts anaérobies répétés ; les rounds d'entraînement en reproduisent la structure (Chaabène, 2015).",
  ["chaabene15"],
  sc={"f": "ring", "v": [-1, -1, 7, 7], "o": [[3, 3, "pa", ""]],
      "p": [{"k": "sprint", "p": [[3, 3], [4.4, 3]], "l": "Avance", "n": 1}, {"k": "back", "p": [[4.4, 3.4], [2.4, 3.4]], "l": "Recule", "lo": 1, "n": 2}, {"k": "lat", "p": [[2.4, 3.4], [2.4, 1.6]], "l": "Pas de côté", "n": 3}, {"k": "lat", "p": [[2.4, 1.6], [3.6, 1.2], [4.4, 2.0]], "l": "Pivot", "n": 4}]}, z=4)

D("k_2040", "Intermittent 20 s / 40 s", ["boxe", "lutte"], "Puissance", "Sac de frappe ou partenaire",
  "Répéter des accélérations maximales, comme les échanges d'un combat.",
  ["Échauffement de 10 min.", "20 s à fond : enchaînements au sac, ou attaques sur un partenaire.", "40 s de récupération active (marche, garde).", "2 min entre les séries."],
  ["Vitesse et précision d'abord", "Arrête la série si la technique se dégrade", "Lutte et judo : entrées de projection ou sprawls à la place du sac"],
  {"reprise": I(1, 6, 15, 45, 0, "15 s à fond", "6 × 15 s / 45 s"),
   "sportif": I(2, 6, 20, 40, 120, "20 s à fond", "2 × 6 × 20 s / 40 s"),
   "perf": I(2, 8, 20, 40, 120, "20 s à fond", "2 × 8 × 20 s / 40 s"),
   "elite": I(3, 8, 20, 40, 120, "20 s à fond", "3 × 8 × 20 s / 40 s")},
  "Les combats alternent des actions très intenses de quelques secondes et des phases plus calmes : l'intermittent court en développe la tolérance (Chaabène, 2015 ; Buchheit et Laursen, 2013).",
  ["chaabene15", "buchheit13b"], z=5)

D("k_sprawl", "Sprawls et sprints", ["lutte", "boxe"], "Puissance", "2 plots",
  "Se jeter au sol pour défendre, se relever et accélérer.",
  ["Plots à 0 et 10 m.", "Sprawl : jambes lancées en arrière, hanches au sol.", "Relève-toi et sprinte 10 m.", "Reviens en marchant jusqu'au départ suivant (toutes les 20 s)."],
  ["Hanches au sol, poitrine haute", "Relevé explosif, sans poser les genoux", "Sprint en position basse"],
  {"reprise": I(1, 6, 20, 0, 0, "Sprawl + 10 m", "6 répétitions, départ toutes les 20 s"),
   "sportif": I(2, 6, 20, 0, 120, "Sprawl + 10 m", "2 séries de 6"),
   "perf": I(2, 8, 20, 0, 120, "Sprawl + 10 m", "2 séries de 8"),
   "elite": I(3, 8, 20, 0, 120, "Sprawl + 10 m", "3 séries de 8")},
  "Enchaîner relevés et sprints courts reproduit les efforts répétés des sports de combat (Chaabène, 2015).",
  ["chaabene15", "bishop11"],
  sc={"f": "pelouse", "v": [-3, -1.5, 14, 7], "o": [[0, 2.5, "x", "Sprawl"], [10, 2.5, "c", "10 m"]],
      "p": [{"k": "sprint", "p": [[0, 2], [10, 2]], "l": "Sprint 10 m", "n": 1}, {"k": "walk", "p": [[10, 4], [0, 4]], "l": "Retour en marchant", "lo": 1, "n": 2, "e": "down"}]}, z=5)

# ---------- ski ----------
D("sk_slalom", "Slalom en sauts latéraux", ["ski"], "Puissance", "5 plots",
  "Reproduire les appuis d'un virage : impulsion latérale et réception sur une jambe.",
  ["Pose 5 plots en zigzag : 3 m vers l'avant, 2 m sur le côté.", "Saute d'un plot à l'autre sur une jambe, comme un virage.", "Réception stable, genou dans l'axe, puis impulsion suivante.", "Marche jusqu'au départ : c'est ta récupération."],
  ["Genou au-dessus du pied à la réception", "Hanches basses, buste stable", "Plus vite, mais jamais au détriment de la réception"],
  {"reprise": I(1, 6, 15, 45, 0, "Slalom 5 plots", "6 passages, 45 s de récupération"),
   "sportif": I(2, 6, 20, 40, 120, "Slalom 5 plots", "2 séries de 6"),
   "perf": I(2, 8, 20, 40, 120, "Slalom 5 plots", "2 séries de 8"),
   "elite": I(3, 8, 20, 40, 120, "Slalom 5 plots", "3 séries de 8")},
  "Le ski alpin demande force excentrique, puissance latérale et stabilité du genou ; les sauts latéraux et le travail unipodal en font partie (Hydren, 2013).",
  ["hydren13"],
  sc={"f": "pelouse", "v": [-2, -2, 16, 6], "o": [[0, 0, "c", ""], [3, 4, "c", ""], [6, 0, "c", ""], [9, 4, "c", ""], [12, 0, "c", ""]],
      "p": [{"k": "lat", "p": [[0, 0.4], [3, 3.6]], "e": "jump", "n": 1, "w": 0.3}, {"k": "lat", "p": [[3, 3.6], [6, 0.4]], "e": "jump", "w": 0.3}, {"k": "lat", "p": [[6, 0.4], [9, 3.6]], "e": "jump", "w": 0.3}, {"k": "lat", "p": [[9, 3.6], [12, 0.4]], "e": "jump"}],
      "t": [[6, 5.4, "3 m vers l'avant · 2 m sur le côté"]]}, z=5)

D("sk_endur", "Endurance de sauts latéraux", ["ski"], "Endurance", "Une ligne au sol",
  "Tenir l'effort d'une manche : 40 s de sauts latéraux continus.",
  ["Sauts latéraux pieds joints au-dessus d'une ligne (ou d'un banc bas).", "Rythme régulier pendant tout l'effort.", "Récupération active entre les répétitions.", "Termine par 5 min d'étirements des hanches."],
  ["Genoux fléchis, appuis légers", "Buste face à la pente imaginaire", "Rythme constant, pas de sprint final"],
  {"reprise": I(1, 4, 30, 90, 0, "30 s de sauts", "4 × 30 s"),
   "sportif": I(1, 6, 40, 80, 0, "40 s de sauts", "6 × 40 s"),
   "perf": I(1, 8, 40, 80, 0, "40 s de sauts", "8 × 40 s"),
   "elite": I(2, 6, 45, 75, 180, "45 s de sauts", "2 séries de 6 × 45 s")},
  "Une manche de ski dure de 45 à 120 s : l'endurance de puissance des jambes y est déterminante (Hydren, 2013).",
  ["hydren13"], z=4)

# ---------- vélo, natation, hyrox ----------
D("cy_3015", "Intervalles 30/15 (vélo)", ["cyclisme", "triathlon"], "Endurance", "Vélo ou home trainer",
  "Le format court qui fait progresser la puissance des cyclistes entraînés.",
  ["15 min d'échauffement progressif.", "30 s très fort (effort 9 sur 10), 15 s de pédalage facile.", "3 min de récupération entre les séries.", "10 min de retour au calme."],
  ["Cadence élevée pendant les 30 s", "Puissance régulière d'une répétition à l'autre", "Home trainer : plus sûr que sur la route"],
  {"reprise": I(1, 10, 30, 15, 0, "30 s fort", "1 série de 10 × 30/15"),
   "sportif": I(2, 10, 30, 15, 180, "30 s fort", "2 séries de 10 × 30/15"),
   "perf": I(3, 13, 30, 15, 180, "30 s fort", "3 séries de 13 × 30/15"),
   "elite": I(3, 13, 30, 15, 180, "30 s très fort", "3 séries de 13 × 30/15")},
  "Chez des cyclistes entraînés, des séries de 30 s d'effort et 15 s de récupération ont davantage amélioré la puissance que des intervalles longs de 5 min (Rønnestad et Hansen, 2016).",
  ["ronnestad16", "seiler10"], z=5)

D("cy_sprint", "Sprints courts (vélo)", ["cyclisme", "triathlon"], "Puissance", "Vélo ou home trainer",
  "Développer ta puissance maximale avec des sprints de 10 s.",
  ["15 min d'échauffement.", "10 s de sprint maximal, départ lancé.", "Récupère 3 min en pédalant très facilement.", "Retour au calme de 10 min."],
  ["Debout sur les pédales pour lancer, puis assis", "Braquet assez dur pour ne pas mouliner", "Récupération complète : la qualité prime"],
  {"reprise": I(1, 4, 8, 172, 0, "8 s de sprint", "4 sprints de 8 s"),
   "sportif": I(1, 6, 10, 170, 0, "10 s de sprint", "6 sprints de 10 s"),
   "perf": I(1, 8, 10, 170, 0, "10 s de sprint", "8 sprints de 10 s"),
   "elite": I(2, 6, 12, 168, 300, "12 s de sprint", "2 séries de 6 sprints de 12 s")},
  "Les sprints très courts avec une longue récupération sollicitent surtout la puissance neuromusculaire, avec peu de fatigue (Buchheit et Laursen, 2013).",
  ["buchheit13b"], z=5)

D("n_100", "Série aérobie 100 m (natation)", ["natation", "triathlon"], "Endurance", "Bassin de 25 m",
  "Le travail d'endurance de base du nageur.",
  ["Échauffement de 300 m varié.", "100 m (4 longueurs) à allure soutenue, toujours la même.", "15 à 20 s de récupération au mur.", "200 m de retour au calme."],
  ["Allure régulière : note ton temps sur chaque 100 m", "Appuie sur « Suivant » à l'arrivée", "Respiration régulière, coulée après chaque virage"],
  {"reprise": I(1, 6, 120, 20, 0, "100 m soutenu", "6 × 100 m, 20 s de récupération"),
   "sportif": I(1, 8, 110, 20, 0, "100 m soutenu", "8 × 100 m"),
   "perf": I(1, 10, 95, 15, 0, "100 m soutenu", "10 × 100 m, 15 s de récupération"),
   "elite": I(1, 12, 85, 15, 0, "100 m soutenu", "12 × 100 m")},
  "Comme pour les autres sports d'endurance, la majorité du volume se fait à intensité modérée, complétée par quelques séances plus intenses (Seiler, 2010).",
  ["seiler10"],
  sc={"f": "bassin", "v": [-1.5, -1, 26.5, 13.5], "o": [[0, 6.25, "start", "Mur"]],
      "p": [{"k": "sprint", "p": [[0, 5.6], [25, 5.6]], "l": "25 m", "n": 1, "e": "turn"}, {"k": "sprint", "p": [[25, 6.9], [0, 6.9]], "l": "× 4 longueurs", "lo": 1, "n": 2, "e": "turn"}]}, z=3)

D("n_25", "Sprints 25 m (natation)", ["natation", "triathlon"], "Vitesse", "Bassin de 25 m",
  "Nager vite avec une technique propre.",
  ["Échauffement de 400 m varié.", "25 m à vitesse maximale, départ du mur.", "Récupère 40 à 45 s en nageant tranquillement ou au mur.", "200 m de retour au calme."],
  ["Coulée puissante après la poussée", "Fréquence de bras élevée, amplitude gardée", "Stop si la technique se dégrade"],
  {"reprise": I(1, 6, 25, 45, 0, "25 m vite", "6 × 25 m"),
   "sportif": I(1, 8, 20, 40, 0, "25 m vite", "8 × 25 m"),
   "perf": I(2, 6, 18, 42, 180, "25 m vite", "2 séries de 6 × 25 m"),
   "elite": I(2, 8, 15, 45, 180, "25 m à fond", "2 séries de 8 × 25 m")},
  "Les efforts très courts et maximaux avec une récupération suffisante développent la vitesse sans fatigue excessive (Buchheit et Laursen, 2013).",
  ["buchheit13b"],
  sc={"f": "bassin", "v": [-1.5, -1, 26.5, 13.5], "o": [[0, 6.25, "start", "Mur"]],
      "p": [{"k": "sprint", "p": [[0, 6.25], [25, 6.25]], "l": "25 m à fond", "n": 1}]}, z=5)

D("hy_sim", "Simulation Hyrox", ["crossfit"], "Endurance", "Piste ou boucle de 1 km, traîneau ou haltères",
  "Enchaîner course et atelier sans perdre ton allure.",
  ["Échauffement de 10 min.", "1 km de course à allure de course, puis un atelier.", "Ateliers au choix : 20 fentes marchées lestées, 50 m de poussée de traîneau, 30 wall balls, 500 m de rameur.", "2 min de récupération entre les blocs."],
  ["Course régulière, pas de sprint à la sortie de l'atelier", "Atelier : rythme que tu peux tenir sans t'arrêter", "Appuie sur « Suivant » à la fin de chaque bloc"],
  {"reprise": I(1, 3, 480, 120, 0, "1 km + 1 atelier", "3 blocs course + atelier"),
   "sportif": I(1, 4, 450, 120, 0, "1 km + 1 atelier", "4 blocs"),
   "perf": I(1, 5, 420, 120, 0, "1 km + 1 atelier", "5 blocs"),
   "elite": I(1, 6, 390, 90, 0, "1 km + 1 atelier", "6 blocs, 1 min 30 de récupération")},
  "Une charge élevée mais construite progressivement protège mieux des blessures que des pics brutaux (Gabbett, 2016) : augmente le nombre de blocs semaine après semaine.",
  ["gabbett16", "seiler10"], z=4)

# ---------------------------------------------------------------------------------------------
# Sports
# ---------------------------------------------------------------------------------------------
B = lambda a, b, c: [a, b, c]
SPORTS = [
    {"id": "rugby", "n": "Rugby à XV", "fam": "collectif", "keys": ["rugby", "xv", "frdr", "rugby a xv", "rugby union"],
     "postes": [["avant", "Avant"], ["trois-quarts", "Trois-quarts"]],
     "focus": "Force et puissance, vitesse sur 10-30 m, efforts répétés (sprints, plaquages, relevés), cou et épaules solides.",
     "drills": ["r_bronco", "r_bronco_casse", "r_malcolm", "r_rhie", "r_defense", "g_rsa", "g_acc", "g_vmax", "x_cote", "g_1515", "g_ift", "g_505"],
     "spec": [["cou_iso", ["2 × 10 s/direction", "3 × 10 s", "3 × 12 s", "2 × 10 s"], ["3 × 12 s", "3 × 15 s", "4 × 15 s", "2 × 10 s"], ["3 × 15 s", "4 × 15 s", "4 × 15 s", "2 × 12 s"]],
              ["poussee_traineau", ["4 × 10 m lourd", "5 × 10 m", "5 × 15 m", "3 × 10 m"], ["5 × 15 m", "6 × 15 m", "6 × 15 m", "3 × 15 m"], ["4 × 10 m très lourd", "5 × 10 m", "5 × 10 m", "3 × 10 m"]]],
     "poste_spec": {"avant": ["melee_iso", ["3 × 6 s", "4 × 6 s", "4 × 8 s", "2 × 6 s"], ["4 × 8 s", "5 × 8 s", "5 × 8 s", "3 × 6 s"], ["5 × 6 s", "5 × 8 s", "5 × 8 s", "3 × 6 s"]],
                    "trois-quarts": ["flexion_hanche_elastique", ["2 × 10/jambe", "3 × 10/jambe", "3 × 12/jambe", "2 × 10/jambe"], ["3 × 12/jambe", "3 × 12/jambe", "3 × 15/jambe", "2 × 10/jambe"], ["3 × 12/jambe rapide", "3 × 15/jambe", "3 × 15/jambe", "2 × 10/jambe"]]},
     "swap": {"intermittent_1515": {"e": "bronco_casse", "w": ["4 tours (1 min / 1 min)", "5 tours", "2 × 4 tours (3 min entre)", "3 tours"]},
              "navette": {"e": "malcolm", "w": ["2 × 6 (départ toutes les 25 s)", "3 × 6", "4 × 6", "2 × 5"]},
              "rsa": {"e": "rhie", "w": ["2 × 5 (départ toutes les 30 s)", "3 × 5", "3 × 6", "2 × 4"]}},
     "tests": ["bronco"], "refs": ["austin11", "naish13"],
     "sci": "Un programme de renforcement isométrique du cou a été associé à beaucoup moins de blessures cervicales en match chez des rugbymen professionnels (Naish, 2013). Les séquences sprint-plaquage-relevé sont les moments les plus durs du match (Austin, 2011)."},
    {"id": "rugby7", "n": "Rugby à 7", "fam": "collectif", "keys": ["rugby a 7", "rugby 7", "sevens", "seven", "7s", "rugby a sept"],
     "postes": [["avant", "Avant"], ["trois-quarts", "Trois-quarts"]],
     "focus": "Vitesse maximale, répétition de sprints, puissance aérobie très élevée, plaquages et relevés.",
     "drills": ["r_bronco", "r_bronco_casse", "r_malcolm", "g_vmax", "g_rsa", "s_wickets", "x_cote", "r_defense", "g_1515", "g_ift"],
     "spec": [["flexion_hanche_elastique", ["2 × 10/jambe", "3 × 10/jambe", "3 × 12/jambe", "2 × 10/jambe"], ["3 × 12/jambe", "3 × 12/jambe", "3 × 15/jambe", "2 × 10/jambe"], ["3 × 12/jambe rapide", "3 × 15/jambe", "3 × 15/jambe", "2 × 10/jambe"]],
              ["cou_iso", ["2 × 10 s/direction", "3 × 10 s", "3 × 12 s", "2 × 10 s"], ["3 × 12 s", "3 × 15 s", "4 × 15 s", "2 × 10 s"], ["3 × 15 s", "4 × 15 s", "4 × 15 s", "2 × 12 s"]]],
     "swap": {"intermittent_1515": {"e": "bronco_casse", "w": ["4 tours (1 min / 1 min)", "5 tours", "2 × 4 tours (3 min entre)", "3 tours"]},
              "navette": {"e": "malcolm", "w": ["2 × 6 (départ toutes les 25 s)", "3 × 6", "4 × 6", "2 × 5"]}},
     "tests": ["bronco"], "refs": ["haugen19", "austin11"],
     "sci": "Au rugby à 7, la vitesse maximale et la capacité à répéter les sprints font la différence ; elles se travaillent à intensité maximale avec des récupérations adaptées (Haugen, 2019 ; Bishop, 2011)."},
    {"id": "foot", "n": "Football", "fam": "collectif", "keys": ["foot", "football", "soccer", "futsal"],
     "postes": [["gardien", "Gardien"], ["defenseur", "Défenseur"], ["milieu", "Milieu"], ["attaquant", "Attaquant"]],
     "focus": "Endurance intermittente, répétition de sprints, changements de direction, adducteurs et ischios solides.",
     "drills": ["f_b2b", "f_ssg", "f_yoyo", "g_rsa", "g_1515", "g_505", "g_acc", "g_vmax", "g_reactif", "s_wickets", "x_cote"],
     "spec": [["flexion_hanche_elastique", ["2 × 10/jambe", "3 × 10/jambe", "3 × 12/jambe", "2 × 10/jambe"], ["3 × 12/jambe", "3 × 12/jambe", "3 × 15/jambe", "2 × 10/jambe"], ["3 × 12/jambe rapide", "3 × 15/jambe", "3 × 15/jambe", "2 × 10/jambe"]],
              ["saut_lateral", ["3 × 5/côté tenus 2 s", "3 × 6/côté", "3 × 6/côté", "2 × 5/côté"], ["3 × 6/côté rapides", "4 × 6/côté", "4 × 6/côté", "2 × 5/côté"], ["4 × 6/côté", "4 × 8/côté", "4 × 8/côté", "2 × 5/côté"]]],
     "swap": {"navette": {"e": "box_to_box", "w": ["6 box to box (départ toutes les 60 s)", "8 box to box", "2 × 6 (3 min entre)", "5 box to box"]}},
     "tests": ["yoyo"], "refs": ["stolen05", "hillhaas11"],
     "sci": "Le football alterne marche, course et sprints : l'endurance intermittente et la répétition de sprints sont les qualités clés (Stølen, 2005). Les jeux réduits travaillent le cardio avec le ballon (Hill-Haas, 2011)."},
    {"id": "hand", "n": "Handball", "fam": "lancer", "keys": ["handball", "hand-ball", "hand ball", "hand"],
     "postes": [["gardien", "Gardien"], ["ailier", "Ailier"], ["arriere", "Arrière / demi-centre"], ["pivot", "Pivot"]],
     "focus": "Sprints en contre-attaque, duels, changements de direction, épaule du lanceur protégée.",
     "drills": ["h_ca", "h_def", "g_rsa", "g_505", "g_ttest", "g_reactif", "g_1515", "f_yoyo", "f_ssg", "g_acc"],
     "spec": [["lancer_medball_dessus", ["3 × 6", "3 × 8", "4 × 8", "2 × 6"], ["4 × 6 lourd", "4 × 8", "5 × 6", "2 × 6"], ["4 × 5 explosif", "5 × 5", "5 × 5", "2 × 5"]],
              ["rotateurs_90", ["2 × 12/bras", "3 × 12/bras", "3 × 15/bras", "2 × 10/bras"], ["3 × 12/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"], ["3 × 15/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"]]],
     "swap": {"navette": {"e": "contre_attaque", "w": ["2 × 5 (départ toutes les 30 s)", "3 × 5", "3 × 6", "2 × 4"]}},
     "tests": ["ttest", "yoyo"], "refs": ["karcher14", "andersson17"],
     "sci": "Les exigences du handball dépendent beaucoup du poste (Karcher et Buchheit, 2014) ; un programme d'épaule (rotateurs, omoplates, mobilité) a réduit de 28 % les problèmes d'épaule chez les handballeurs (Andersson, 2017)."},
    {"id": "basket", "n": "Basket-ball", "fam": "collectif", "keys": ["basket", "basketball", "basket-ball"],
     "postes": [["meneur", "Meneur / arrière"], ["ailier", "Ailier"], ["interieur", "Intérieur"]],
     "focus": "Sauts répétés, déplacements défensifs, changements de direction constants, réceptions solides.",
     "drills": ["b_17", "b_suicide", "b_box", "g_ttest", "g_505", "g_reactif", "g_rsa", "f_ssg", "g_1515"],
     "spec": [["saut_unipodal", ["3 × 4/jambe tenus 2 s", "3 × 5/jambe", "3 × 6/jambe", "2 × 4/jambe"], ["3 × 5/jambe rapides", "4 × 5/jambe", "4 × 6/jambe", "2 × 4/jambe"], ["4 × 5/jambe", "4 × 6/jambe", "4 × 6/jambe", "2 × 4/jambe"]],
              ["pas_defensifs_elastique", ["2 × 10 m aller-retour", "3 × 10 m", "3 × 15 m", "2 × 10 m"], ["3 × 15 m", "3 × 15 m", "4 × 15 m", "2 × 10 m"], ["3 × 15 m sur signal", "4 × 15 m", "4 × 15 m", "2 × 10 m"]]],
     "swap": {"navette": {"e": "seventeens", "w": ["2 × 17 largeurs (3 min entre)", "3 × 17", "4 × 17", "2 × 17"]},
              "rsa": {"e": "suicides", "w": ["4 suicides (départ toutes les 2 min)", "5 suicides", "6 suicides", "3 suicides"]}},
     "tests": ["ttest"], "refs": ["stojanovic18"],
     "sci": "Le basketteur change d'activité toutes les 2 à 3 secondes et enchaîne sauts, sprints et déplacements latéraux (Stojanović, 2018)."},
    {"id": "volley", "n": "Volley-ball", "fam": "lancer", "keys": ["volley", "volleyball", "volley-ball", "beach"],
     "postes": [["passeur", "Passeur"], ["attaquant", "Attaquant / réceptionneur"], ["central", "Central"], ["libero", "Libéro"]],
     "focus": "Détente avec élan, répétition des sauts, épaule d'attaque, déplacements courts.",
     "drills": ["v_att", "v_block", "g_ttest", "g_reactif", "g_rsa", "g_1515", "g_ift"],
     "spec": [["rotateurs_90", ["2 × 12/bras", "3 × 12/bras", "3 × 15/bras", "2 × 10/bras"], ["3 × 12/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"], ["3 × 15/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"]],
              ["lancer_medball_dessus", ["3 × 6", "3 × 8", "4 × 8", "2 × 6"], ["4 × 6 lourd", "4 × 8", "5 × 6", "2 × 6"], ["4 × 5 explosif", "5 × 5", "5 × 5", "2 × 5"]]],
     "swap": {"navette": {"e": "attaques_repetees", "w": ["3 × 5 attaques (2 min entre)", "4 × 5", "4 × 6", "2 × 5"]},
              "reactif": {"e": "contres_filet", "w": ["6 séries de 3 contres", "8 séries", "10 séries", "5 séries"]}},
     "tests": ["ttest"], "refs": ["sheppard09"],
     "sci": "Les centraux et les attaquants sautent le plus en match, et la hauteur de saut avec élan distingue les meilleurs joueurs (Sheppard, 2009)."},
    {"id": "tennis", "n": "Tennis", "fam": "lancer", "keys": ["tennis"],
     "focus": "Déplacements courts et explosifs, freinages, rotation du tronc, épaule et poignet solides.",
     "drills": ["t_araignee", "t_echanges", "g_505", "g_reactif", "g_ttest", "g_1515"],
     "spec": [["med_ball_rotation", ["3 × 6/côté", "3 × 8/côté", "4 × 8/côté", "2 × 6/côté"], ["4 × 6/côté lourd", "4 × 8/côté", "4 × 8/côté", "2 × 6/côté"], ["4 × 5/côté explosif", "5 × 5/côté", "5 × 5/côté", "2 × 5/côté"]],
              ["poignet", ["2 × 15", "3 × 15", "3 × 15", "2 × 12"], ["3 × 15", "3 × 20", "3 × 20", "2 × 15"], ["3 × 15 lent", "3 × 20", "3 × 20", "2 × 15"]]],
     "swap": {"navette": {"e": "araignee_tennis", "w": ["4 araignées (1 min de récup)", "5 araignées", "6 araignées", "3 araignées"]},
              "rsa": {"e": "echanges_tennis", "w": ["2 × 8 × 10 s / 20 s", "3 × 8", "3 × 10", "2 × 6"]}},
     "tests": ["ttest", "t505"], "refs": ["kovacs07", "fernandez09"],
     "sci": "Un point de tennis dure 5 à 10 secondes, avec 4 à 5 changements de direction et 20 secondes de récupération (Kovacs, 2007 ; Fernandez-Fernandez, 2009)."},
    {"id": "padel", "n": "Padel", "fam": "lancer", "keys": ["padel", "paddle"],
     "focus": "Montées au filet et replis sur lob, déplacements courts, rotation du tronc, épaule et poignet.",
     "drills": ["p_filet", "p_araignee", "g_505", "g_reactif", "g_1515"],
     "spec": [["med_ball_rotation", ["3 × 6/côté", "3 × 8/côté", "4 × 8/côté", "2 × 6/côté"], ["4 × 6/côté lourd", "4 × 8/côté", "4 × 8/côté", "2 × 6/côté"], ["4 × 5/côté explosif", "5 × 5/côté", "5 × 5/côté", "2 × 5/côté"]],
              ["poignet", ["2 × 15", "3 × 15", "3 × 15", "2 × 12"], ["3 × 15", "3 × 20", "3 × 20", "2 × 15"], ["3 × 15 lent", "3 × 20", "3 × 20", "2 × 15"]]],
     "swap": {"navette": {"e": "araignee_padel", "w": ["4 araignées (1 min de récup)", "5 araignées", "6 araignées", "3 araignées"]},
              "rsa": {"e": "filet_padel", "w": ["2 × 8 × 10 s / 20 s", "3 × 8", "3 × 10", "2 × 6"]}},
     "tests": ["t505"], "refs": ["fernandez09"],
     "sci": "Comme au tennis, les échanges reposent sur des efforts de quelques secondes et des changements de direction répétés (Fernandez-Fernandez, 2009)."},
    {"id": "badminton", "n": "Badminton", "fam": "lancer", "keys": ["badminton", "bad"],
     "focus": "Fentes répétées, déplacements vers les 6 coins, explosivité et poignet.",
     "drills": ["bd_6pts", "g_505", "g_reactif", "g_1515", "g_ttest"],
     "spec": [["fente_laterale", ["2 × 8/côté", "3 × 8/côté", "3 × 10/côté", "2 × 8/côté"], ["3 × 10/côté", "3 × 10/côté lesté", "3 × 12/côté", "2 × 8/côté"], ["3 × 8/côté explosif", "3 × 10/côté", "3 × 10/côté", "2 × 8/côté"]],
              ["poignet", ["2 × 15", "3 × 15", "3 × 15", "2 × 12"], ["3 × 15", "3 × 20", "3 × 20", "2 × 15"], ["3 × 15 lent", "3 × 20", "3 × 20", "2 × 15"]]],
     "swap": {"navette": {"e": "six_points", "w": ["3 × 6 × 15 s / 15 s", "3 × 8", "4 × 8", "2 × 6"]}},
     "tests": ["t505"], "refs": ["phomsoupha15"],
     "sci": "Le badminton enchaîne des échanges très courts avec de nombreuses fentes et changements de direction (Phomsoupha et Laffaye, 2015)."},
    {"id": "baseball", "n": "Baseball / softball", "fam": "lancer", "keys": ["baseball", "softball", "base-ball"],
     "postes": [["lanceur", "Lanceur"], ["receveur", "Receveur"], ["champ", "Joueur de champ"]],
     "focus": "Accélération sur 27 m, rotation du tronc, épaule du lanceur protégée, premiers pas latéraux.",
     "drills": ["bb_home1b", "bb_extra", "bb_vol", "g_acc", "g_505", "g_vmax"],
     "spec": [["rotateurs_90", ["2 × 12/bras", "3 × 12/bras", "3 × 15/bras", "2 × 10/bras"], ["3 × 12/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"], ["3 × 15/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"]],
              ["med_ball_rotation", ["3 × 6/côté", "3 × 8/côté", "4 × 8/côté", "2 × 6/côté"], ["4 × 6/côté lourd", "4 × 8/côté", "4 × 8/côté", "2 × 6/côté"], ["4 × 5/côté explosif", "5 × 5/côté", "5 × 5/côté", "2 × 5/côté"]]],
     "swap": {"acc_20": {"e": "home_first", "w": ["5 sprints (1 min 30 de récup)", "6 sprints", "8 sprints", "4 sprints"]}, "rsa": {"e": "vol_base", "w": ["6 départs (1 min 30 de récup)", "8 départs", "2 × 6", "5 départs"]}},
     "tests": ["home1b"], "refs": ["haugen19", "andersson17"],
     "sci": "Les sprints entre les bases sont courts et maximaux, à travailler avec une récupération complète (Haugen, 2019). Le renforcement de l'épaule protège les lanceurs (Andersson, 2017)."},
    {"id": "hockey", "n": "Hockey", "fam": "collectif", "keys": ["hockey"],
     "focus": "Répétition de sprints, appuis latéraux, puissance des hanches et adducteurs.",
     "drills": ["g_rsa", "g_1515", "g_505", "g_acc", "g_vmax", "g_ttest", "f_yoyo", "f_ssg"],
     "spec": [["saut_lateral", ["3 × 5/côté tenus 2 s", "3 × 6/côté", "3 × 6/côté", "2 × 5/côté"], ["3 × 6/côté rapides", "4 × 6/côté", "4 × 6/côté", "2 × 5/côté"], ["4 × 6/côté", "4 × 8/côté", "4 × 8/côté", "2 × 5/côté"]],
              ["pas_defensifs_elastique", ["2 × 10 m aller-retour", "3 × 10 m", "3 × 15 m", "2 × 10 m"], ["3 × 15 m", "3 × 15 m", "4 × 15 m", "2 × 10 m"], ["3 × 15 m sur signal", "4 × 15 m", "4 × 15 m", "2 × 10 m"]]],
     "swap": {}, "tests": ["yoyo"], "refs": ["bishop11"],
     "sci": "Le hockey alterne des présences courtes et très intenses : la répétition de sprints est déterminante (Bishop, 2011)."},
    {"id": "bob", "n": "Bobsleigh / skeleton", "fam": "sprint", "keys": ["bob", "bobsleigh", "skeleton", "luge"],
     "postes": [["pilote", "Pilote"], ["pousseur", "Pousseur / freineur"]],
     "focus": "Puissance de poussée, accélération sur 30 m, force maximale des jambes.",
     "drills": ["bo_push", "g_acc", "g_vmax", "x_cote", "s_wickets"],
     "spec": [["poussee_traineau", ["4 × 10 m lourd", "5 × 10 m", "5 × 15 m", "3 × 10 m"], ["5 × 15 m", "6 × 15 m", "6 × 15 m", "3 × 15 m"], ["4 × 10 m très lourd", "5 × 10 m", "5 × 10 m", "3 × 10 m"]],
              ["saut_longueur", ["3 × 4", "3 × 5", "4 × 5", "2 × 4"], ["4 × 4", "4 × 5", "5 × 5", "2 × 4"], ["4 × 3 enchaînés", "5 × 3", "5 × 3", "2 × 3"]]],
     "swap": {"sprint_resiste": {"e": "depart_pousse", "w": ["4 poussées de 20 m", "5 poussées de 20 m", "6 poussées de 25 m", "3 poussées de 20 m"]}},
     "tests": [], "refs": ["petrakos16", "haugen19"],
     "sci": "Le sprint résisté améliore surtout la phase d'accélération (Petrakos, 2016), celle qui décide du temps de poussée."},
    {"id": "sprint", "n": "Athlétisme (sprint, sauts)", "fam": "sprint", "keys": ["sprint", "athle", "athletisme", "haies", "saut", "decathlon", "heptathlon", "100 m", "200 m", "400 m"],
     "focus": "Accélération, vitesse maximale, rigidité du pied, ischios et fléchisseurs de hanche.",
     "drills": ["g_acc", "g_vmax", "s_wickets", "x_cote"],
     "spec": [["flexion_hanche_elastique", ["2 × 10/jambe", "3 × 10/jambe", "3 × 12/jambe", "2 × 10/jambe"], ["3 × 12/jambe", "3 × 12/jambe", "3 × 15/jambe", "2 × 10/jambe"], ["3 × 12/jambe rapide", "3 × 15/jambe", "3 × 15/jambe", "2 × 10/jambe"]],
              ["pogo", ["3 × 10", "3 × 15", "3 × 20", "2 × 10"], ["3 × 15", "4 × 15", "4 × 20", "2 × 10"], ["4 × 15", "4 × 20", "4 × 20", "2 × 10"]]],
     "swap": {}, "tests": [], "refs": ["haugen19"],
     "sci": "La vitesse se développe avec des sprints maximaux, peu nombreux, et des récupérations longues (Haugen, 2019)."},
    {"id": "course", "n": "Course à pied (route)", "fam": "course", "keys": ["course", "running", "marathon", "10 km", "5 km", "semi", "cross", "demi-fond", "fond", "jogging"],
     "focus": "Volume facile majoritaire, fractionné court et long, côtes, force des mollets et des hanches.",
     "drills": ["c_3030", "c_1000", "c_seuil", "c_cotes", "x_cote"],
     "spec": [["step_up", ["3 × 8/jambe", "3 × 10/jambe", "3 × 10/jambe lesté", "2 × 8/jambe"], ["3 × 8/jambe lesté", "3 × 10/jambe", "4 × 8/jambe", "2 × 8/jambe"], ["3 × 6/jambe lourd", "4 × 6/jambe", "4 × 6/jambe", "2 × 6/jambe"]],
              ["sdt_jambe", ["2 × 8/jambe", "3 × 8/jambe", "3 × 10/jambe", "2 × 8/jambe"], ["3 × 8/jambe lesté", "3 × 10/jambe", "3 × 10/jambe", "2 × 8/jambe"], ["3 × 6/jambe lourd", "3 × 8/jambe", "3 × 8/jambe", "2 × 6/jambe"]]],
     "swap": {}, "tests": [], "refs": ["seiler10", "barnes15"],
     "sci": "Environ 80 % du volume à faible intensité et quelques séances intenses : c'est la répartition des coureurs qui progressent (Seiler, 2010). La force et les côtes améliorent l'économie de course (Barnes et Kilding, 2015)."},
    {"id": "trail", "n": "Trail", "fam": "course", "keys": ["trail", "ultra", "montagne", "skyrace"],
     "focus": "Montées longues, descentes techniques, force excentrique des cuisses, chevilles solides.",
     "drills": ["tr_cotes", "tr_desc", "c_cotes", "c_seuil", "c_3030"],
     "spec": [["step_down", ["2 × 8/jambe", "3 × 8/jambe", "3 × 10/jambe", "2 × 8/jambe"], ["3 × 10/jambe lent", "3 × 10/jambe lesté", "3 × 12/jambe", "2 × 8/jambe"], ["3 × 10/jambe lesté", "3 × 12/jambe", "3 × 12/jambe", "2 × 8/jambe"]],
              ["step_up", ["3 × 8/jambe", "3 × 10/jambe", "3 × 10/jambe lesté", "2 × 8/jambe"], ["3 × 8/jambe lesté", "3 × 10/jambe", "4 × 8/jambe", "2 × 8/jambe"], ["3 × 6/jambe lourd", "4 × 6/jambe", "4 × 6/jambe", "2 × 6/jambe"]]],
     "swap": {"fractionne_long": {"e": "cotes_longues", "w": ["4 montées de 3 min", "5 montées", "5 montées de 4 min", "Test : 5 km vallonné chronométré"]}},
     "tests": [], "refs": ["vernillo17"],
     "sci": "La descente, surtout excentrique, abîme davantage les muscles que la montée : il faut s'y préparer progressivement (Vernillo, 2017)."},
    {"id": "triathlon", "n": "Triathlon", "fam": "course", "keys": ["triathlon", "duathlon", "ironman", "swimrun"],
     "focus": "Endurance dans les trois disciplines, fractionné ciblé, gainage et épaules.",
     "drills": ["c_3030", "c_1000", "c_seuil", "cy_3015", "cy_sprint", "n_100", "n_25"],
     "spec": [["sdt_jambe", ["2 × 8/jambe", "3 × 8/jambe", "3 × 10/jambe", "2 × 8/jambe"], ["3 × 8/jambe lesté", "3 × 10/jambe", "3 × 10/jambe", "2 × 8/jambe"], ["3 × 6/jambe lourd", "3 × 8/jambe", "3 × 8/jambe", "2 × 6/jambe"]],
              ["rotateurs_90", ["2 × 12/bras", "3 × 12/bras", "3 × 15/bras", "2 × 10/bras"], ["3 × 12/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"], ["3 × 15/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"]]],
     "swap": {}, "tests": [], "refs": ["seiler10"],
     "sci": "Comme dans tous les sports d'endurance, la majorité du volume se fait à faible intensité, avec 1 à 2 séances intenses par semaine (Seiler, 2010)."},
    {"id": "cyclisme", "n": "Cyclisme / VTT", "fam": "velo", "keys": ["velo", "cyclisme", "vtt", "bmx", "cycl", "gravel"],
     "focus": "Puissance au seuil, intervalles courts, force des jambes et gainage.",
     "drills": ["cy_3015", "cy_sprint", "c_seuil"],
     "spec": [["split_squat", ["3 × 8/jambe", "3 × 10/jambe", "3 × 10/jambe", "2 × 8/jambe"], ["3 × 8/jambe lourd", "4 × 8/jambe", "4 × 8/jambe", "2 × 8/jambe"], ["4 × 6/jambe lourd", "4 × 6/jambe", "4 × 6/jambe", "2 × 6/jambe"]],
              ["planche_laterale", ["2 × 25 s/côté", "3 × 30 s/côté", "3 × 30 s/côté", "2 × 25 s/côté"], ["3 × 35 s/côté", "3 × 40 s/côté", "3 × 40 s/côté", "2 × 30 s/côté"], ["3 × 40 s/côté", "3 × 45 s/côté", "3 × 45 s/côté", "2 × 30 s/côté"]]],
     "swap": {}, "tests": [], "refs": ["ronnestad16", "seiler10"],
     "sci": "Chez les cyclistes entraînés, les séries de 30 s / 15 s ont plus amélioré la puissance que les intervalles longs (Rønnestad et Hansen, 2016)."},
    {"id": "natation", "n": "Natation", "fam": "lancer", "keys": ["natation", "nage", "water-polo", "waterpolo", "piscine"],
     "focus": "Endurance aérobie, vitesse sur 25 m, épaules protégées, gainage.",
     "drills": ["n_100", "n_25"],
     "spec": [["rotateurs_90", ["2 × 12/bras", "3 × 12/bras", "3 × 15/bras", "2 × 10/bras"], ["3 × 12/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"], ["3 × 15/bras", "3 × 15/bras", "3 × 15/bras", "2 × 12/bras"]],
              ["tirage_vertical", ["3 × 10", "3 × 12", "3 × 12", "2 × 10"], ["3 × 8 lourd", "4 × 8", "4 × 8", "2 × 8"], ["4 × 6 lourd", "4 × 6", "4 × 6", "2 × 6"]]],
     "swap": {}, "tests": [], "refs": ["seiler10", "andersson17"],
     "sci": "Le volume aérobie reste la base de la performance en endurance (Seiler, 2010) ; le renforcement des rotateurs protège les épaules des sports de bras (Andersson, 2017)."},
    {"id": "boxe", "n": "Boxe, kick, MMA", "fam": "combat", "keys": ["boxe", "mma", "kick", "muay", "savate", "karate", "taekwondo", "escrime"],
     "focus": "Rounds aérobies, accélérations répétées, puissance des frappes, cou et épaules.",
     "drills": ["k_rounds", "k_2040", "k_sprawl", "g_reactif", "g_1515", "g_acc"],
     "spec": [["med_ball_lancer", ["3 × 6", "3 × 8", "4 × 8", "2 × 6"], ["4 × 6 lourd", "4 × 8", "5 × 6", "2 × 6"], ["4 × 5 explosif", "5 × 5", "5 × 5", "2 × 5"]],
              ["cou_iso", ["2 × 10 s/direction", "3 × 10 s", "3 × 12 s", "2 × 10 s"], ["3 × 12 s", "3 × 15 s", "4 × 15 s", "2 × 10 s"], ["3 × 15 s", "4 × 15 s", "4 × 15 s", "2 × 12 s"]]],
     "swap": {"navette": {"e": "sprawl_sprint", "w": ["2 × 6 (départ toutes les 20 s)", "2 × 8", "3 × 8", "2 × 5"]}},
     "tests": [], "refs": ["chaabene15"],
     "sci": "La boxe demande à la fois une forte capacité aérobie et des efforts anaérobies très intenses (Chaabène, 2015)."},
    {"id": "lutte", "n": "Judo, lutte, JJB", "fam": "combat", "keys": ["judo", "lutte", "jjb", "jiu", "grappling", "sambo"],
     "focus": "Force de préhension, cou, efforts intermittents, relevés et sprawls.",
     "drills": ["k_sprawl", "k_2040", "g_reactif", "g_acc", "g_1515"],
     "spec": [["cou_iso", ["2 × 10 s/direction", "3 × 10 s", "3 × 12 s", "2 × 10 s"], ["3 × 12 s", "3 × 15 s", "4 × 15 s", "2 × 10 s"], ["3 × 15 s", "4 × 15 s", "4 × 15 s", "2 × 12 s"]],
              ["farmer_walk", ["3 × 20 m", "3 × 30 m", "4 × 30 m", "2 × 20 m"], ["3 × 30 m lourd", "4 × 30 m", "4 × 30 m", "2 × 20 m"], ["4 × 20 m très lourd", "4 × 30 m", "4 × 30 m", "2 × 20 m"]]],
     "swap": {"navette": {"e": "sprawl_sprint", "w": ["2 × 6 (départ toutes les 20 s)", "2 × 8", "3 × 8", "2 × 5"]}},
     "tests": [], "refs": ["chaabene15"],
     "sci": "Les sports de combat alternent des actions très intenses et des phases de contrôle : l'intermittent et les relevés en reproduisent la charge (Chaabène, 2015)."},
    {"id": "ski", "n": "Ski alpin, snowboard", "fam": "glisse", "keys": ["ski", "snowboard", "snow", "freeride", "surf", "skate"],
     "focus": "Force excentrique des cuisses, puissance latérale, stabilité du genou, endurance de 1 à 2 min.",
     "drills": ["sk_slalom", "sk_endur", "g_505", "x_cote"],
     "spec": [["saut_lateral", ["3 × 5/côté tenus 2 s", "3 × 6/côté", "3 × 6/côté", "2 × 5/côté"], ["3 × 6/côté rapides", "4 × 6/côté", "4 × 6/côté", "2 × 5/côté"], ["4 × 6/côté", "4 × 8/côté", "4 × 8/côté", "2 × 5/côté"]],
              ["chaise", ["3 × 30 s", "3 × 40 s", "3 × 45 s", "2 × 30 s"], ["3 × 45 s", "3 × 60 s", "4 × 60 s", "2 × 45 s"], ["3 × 60 s lesté", "4 × 60 s", "4 × 60 s", "2 × 45 s"]]],
     "swap": {"reactif": {"e": "slalom_sauts", "w": ["2 × 6 passages", "2 × 8", "3 × 8", "2 × 5"]}},
     "tests": [], "refs": ["hydren13"],
     "sci": "Le ski alpin demande force excentrique, puissance latérale et endurance sur des manches de 45 à 120 s (Hydren, 2013)."},
    {"id": "crossfit", "n": "CrossFit, Hyrox", "fam": "force", "keys": ["crossfit", "hyrox", "functional", "cross training"],
     "focus": "Force, endurance de course entre les ateliers, gainage et prise de main.",
     "drills": ["hy_sim", "c_1000", "g_1515"],
     "spec": [["poussee_traineau", ["4 × 10 m lourd", "5 × 10 m", "5 × 15 m", "3 × 10 m"], ["5 × 15 m", "6 × 15 m", "6 × 15 m", "3 × 15 m"], ["4 × 10 m très lourd", "5 × 10 m", "5 × 10 m", "3 × 10 m"]],
              ["farmer_walk", ["3 × 20 m", "3 × 30 m", "4 × 30 m", "2 × 20 m"], ["3 × 30 m lourd", "4 × 30 m", "4 × 30 m", "2 × 20 m"], ["4 × 20 m très lourd", "4 × 30 m", "4 × 30 m", "2 × 20 m"]]],
     "swap": {}, "tests": [], "refs": ["gabbett16"],
     "sci": "Monter la charge progressivement, semaine après semaine, protège mieux qu'un pic brutal (Gabbett, 2016)."},
    {"id": "force", "n": "Haltérophilie, force athlétique", "fam": "force", "keys": ["halterophilie", "haltero", "powerlifting", "force athletique", "strongman", "musculation", "bodybuilding"],
     "focus": "Force maximale, technique des mouvements, mobilité et récupération.",
     "drills": ["g_acc"], "spec": [], "swap": {}, "tests": [], "refs": ["haugen19"],
     "sci": "Quelques sprints courts complètent bien l'entraînement de force : ils entretiennent la vitesse sans fatigue (Haugen, 2019)."},
]

# tests propres aux sports (ajoutés aux tests du programme)
TESTS_SPORT = {
    "bronco": {"n": "Bronco (1 200 m)", "u": "s", "b": "low", "type": "num", "help": "5 tours de 20-40-60 m sans arrêt. Temps total en secondes (5 min 12 s = 312)."},
    "ift": {"n": "Test 30-15 IFT (VIFT)", "u": "km/h", "b": "high", "type": "num", "help": "Dernière vitesse tenue, avec la bande-son officielle."},
    "yoyo": {"n": "Yo-Yo intermittent niveau 1", "u": "m", "b": "high", "type": "num", "help": "Distance totale au 2e retard, avec la bande-son officielle."},
    "ttest": {"n": "T-test (agilité)", "u": "s", "b": "low", "type": "num", "help": "Meilleur de 3 essais, chronométré au centième."},
    "t505": {"n": "Test 505", "u": "s", "b": "low", "type": "num", "help": "Meilleur temps sur 5 m aller-retour, pied d'appui le plus lent."},
    "home1b": {"n": "Home → 1re base", "u": "s", "b": "low", "type": "num", "help": "Du contact (ou du swing) au pied sur la 1re base. Meilleur de 3."},
}

# ---------------------------------------------------------------------------------------------
# Skills (bibliothèque « Technique ») : format des fiches terrain d'Antoine
# objectifs physique / technique / match, organisation, consignes numérotées (mêmes numéros que
# le schéma), points clés, variantes. Jamais tirées au sort pour la séance terrain de la semaine :
# le client les ouvre lui-même, ou Antoine les conseille depuis sa fiche.
# ---------------------------------------------------------------------------------------------
REFS.update({
    "hendricks10": "Hendricks S, Lambert M. Tackling in rugby: coaching strategies for effective technique and injury prevention. Int J Sports Sci Coach. 2010;5(1):117-135.",
    "hendricks18": "Hendricks S, van Niekerk T, Sin DW, et al. Technical determinants of tackle and ruck performance in International rugby union. J Sports Sci. 2018;36(5):522-528.",
    "tucker17": "Tucker R, Raftery M, Kemp S, et al. Risk factors for head injury events in professional rugby union: a video analysis of 464 head injury events to inform proposed injury prevention strategies. Br J Sports Med. 2017;51(15):1152-1157.",
    "hislop17": "Hislop MD, Stokes KA, Williams S, et al. Reducing musculoskeletal injury and concussion risk in schoolboy rugby players with a pre-activity movement control exercise programme: a cluster randomised controlled trial. Br J Sports Med. 2017;51(15):1140-1146.",
    "burger20": "Burger N, Lambert M, Hendricks S. Lay of the land: narrative synthesis of tackle research in rugby union and rugby sevens. BMJ Open Sport Exerc Med. 2020;6(1):e000645.",
    "gabbett08": "Gabbett TJ. Influence of fatigue on tackling technique in rugby league players. J Strength Cond Res. 2008;22(2):625-632.",
    "pavely09": "Pavely S, Adams RD, Di Francesco T, Larkham S, Maher CG. Execution and outcome differences between passes to the left and right made by first-grade rugby union players. Phys Ther Sport. 2009;10(4):136-141.",
    "wheeler10": "Wheeler KW, Sayers MGL. Modification of agility running technique in reaction to a defender in rugby union. J Sports Sci Med. 2010;9(3):445-451.",
    "wr_tackle": "World Rugby. Tackle Ready : programme de technique du plaquage (suivi, préparation, contact, accélération, finition). World Rugby Passport, 2020.",
})

CONTACT_WARN = ("Contact : avec un coach ou en club, et un partenaire qui tient le bouclier. Jamais seul. Contact réel contrôlé "
                "seulement en début de semaine (J-5 ou J-4), jamais à J-2 ou J-1, jamais en reprise de blessure. "
                "Plaque à la taille ou plus bas : c'est la règle des compétitions amateurs en France et la plus sûre partout.")

D("sk_chute", "Savoir tomber et se relever", ["rugby", "rugby7"], "Technique", "Tapis ou herbe souple",
  "Encaisser une chute ou un plaquage sans se blesser, puis se relever vite dans le jeu.",
  ["Chute avant amortie : à genoux, laisse-toi tomber vers l'avant et amortis avec les avant-bras, menton rentré.",
   "Roulade sur l'épaule : de la position à genoux, roule en diagonale de l'épaule à la hanche opposée, puis relève-toi.",
   "Chute sur le côté : accroupi, bascule sur le côté, frappe le sol avec l'avant-bras, garde la tête décollée.",
   "Relevé en un appui : du sol, reviens debout et fais 5 m d'appuis vifs."],
  ["Menton rentré, tête jamais en premier au sol", "On roule sur l'épaule et le dos, pas sur la nuque", "Relevé en moins de 2 s, premier appui explosif"],
  {"reprise": I(2, 4, 10, 20, 90, "1 chute + relevé, à vitesse lente", "2 séries de 4 chutes lentes (avant, épaule, côté, relevé)"),
   "sportif": I(3, 4, 10, 20, 90, "1 chute + relevé", "3 séries de 4 chutes (une de chaque)"),
   "perf": I(3, 6, 10, 15, 90, "1 chute + relevé + 5 m", "3 séries de 6, côté annoncé par le partenaire"),
   "elite": I(3, 6, 8, 12, 90, "Chute au signal + relevé + 5 m", "3 séries de 6, chute au signal, relevé et sprint 5 m")},
  "Un échauffement de 20 minutes qui inclut l'équilibre, les chutes et le renforcement du cou a réduit les blessures et les commotions chez des rugbymen scolaires, à condition d'être fait au moins 3 fois par semaine (Hislop, 2017). World Rugby place « savoir tomber » au début de sa progression du plaquage.",
  ["hislop17", "wr_tackle"],
  sc={"f": "rugby", "v": [14, 26, 36, 44], "o": [[17, 35, "start", "Départ"], [24, 35, "x", "Chute"], [28, 35, "x", "Roulade"], [33, 35, "c", "5 m"]],
      "p": [{"k": "walk", "p": [[17, 35], [24, 35]], "l": "Chute avant", "n": 1, "e": "down", "w": 0.8}, {"k": "walk", "p": [[24, 35], [28, 35]], "l": "Roulade", "lo": -1, "n": 2, "e": "down", "w": 0.8},
            {"k": "sprint", "p": [[28, 37.5], [33, 37.5]], "l": "Relevé + 5 m", "lo": 1, "n": 4}]},
  obj={"ph": "Gainage et contrôle du corps au sol", "te": "Chutes amorties, roulade sur l'épaule, relevé rapide", "ma": "Encaisser un plaquage sans se blesser et rejouer tout de suite"},
  org="Bande d'herbe de 15 m ou tapis. Seul ou à deux : le partenaire annonce le côté de la chute.",
  var=["Chute au signal sonore", "Chute en marchant, puis en trottinant", "Relevé et sprint vers le plot annoncé (prise d'information)"],
  contact="aucun", pub="Tous", skill=True, z=4)

D("sk_cou", "Cou solide à deux (4 directions)", ["rugby", "rugby7"], "Technique", "Un partenaire",
  "Renforcer le cou dans les 4 directions pour encaisser les contacts.",
  ["À quatre pattes, dos plat, regard au sol. Le partenaire pose la main sur ton front.",
   "Pousse contre sa main sans bouger la tête : il résiste à la même force (10 à 20 s).",
   "Recommence main sur l'arrière de la tête, puis sur chaque côté.",
   "Inversez les rôles."],
  ["La tête ne bouge pas : c'est une poussée sans mouvement", "Monte en force sur 3 s, garde, relâche sur 3 s", "Jamais de secousse : le partenaire suit ta force"],
  {"reprise": I(1, 4, 10, 20, 60, "10 s par direction, effort moyen", "1 tour : 10 s par direction à effort moyen"),
   "sportif": I(2, 4, 15, 15, 60, "15 s par direction", "2 tours : 15 s par direction"),
   "perf": I(2, 4, 20, 15, 60, "20 s par direction", "2 tours : 20 s par direction, effort fort"),
   "elite": I(3, 4, 20, 15, 60, "20 s par direction", "3 tours : 20 s par direction, effort fort")},
  "Un programme de renforcement isométrique du cou a été associé à beaucoup moins de blessures cervicales en match chez des rugbymen professionnels (Naish, 2013) ; le travail du cou fait partie de l'échauffement Activate qui a réduit les commotions chez les jeunes joueurs (Hislop, 2017).",
  ["naish13", "hislop17"],
  sc={"f": "rugby", "v": [18, 28, 34, 42], "o": [[23, 35, "pa", "Joueur"], [27, 35, "pb", "Partenaire"]],
      "t": [[25, 31, "Avant · arrière · gauche · droite"], [25, 39.5, "10-20 s chacune"]]},
  obj={"ph": "Force isométrique des muscles du cou", "te": "Gainage cervical, tête alignée", "ma": "Mieux encaisser plaquages, rucks et mêlées"},
  org="Par deux, sur l'herbe ou un tapis. Fin d'échauffement ou de séance, 5 minutes.",
  var=["Debout contre le partenaire", "Avec un élastique fixé derrière", "Version piliers : à la fin de la séance de musculation"],
  contact="aucun", pub="Tous", skill=True, z=3)

D("sk_plaq_genoux", "Plaquage à genoux (technique)", ["rugby", "rugby7"], "Technique", "Un partenaire, tapis",
  "Installer le bon placement de la tête et de l'épaule à vitesse nulle, avant tout plaquage en mouvement.",
  ["Face à face à genoux, à 1 m l'un de l'autre. Le porteur tient le ballon.",
   "Place ta tête sur le côté du porteur, joue contre sa hanche, jamais devant lui.",
   "Contact avec l'épaule, à la taille. Les deux bras entourent et serrent (« comme un maillot »).",
   "Termine au sol sur le côté, tête protégée, puis relève-toi."],
  ["Tête sur le côté, yeux ouverts, menton haut : on ne plaque jamais tête baissée", "Épaule à la taille, bras qui serrent ensemble", "Lent et précis : la qualité avant la vitesse"],
  {"reprise": I(1, 6, 6, 20, 90, "Placement sans contact, arrêt à 10 cm", "Sans contact : 6 placements tête et épaule, arrêt avant le contact"),
   "sportif": I(2, 6, 6, 20, 90, "1 plaquage à genoux par côté", "2 séries de 6 (3 par côté), puis inversez"),
   "perf": I(3, 6, 6, 15, 90, "1 plaquage à genoux", "3 séries de 6, côté annoncé au dernier moment"),
   "elite": I(3, 8, 6, 15, 90, "1 plaquage à genoux", "3 séries de 8, porteur qui bouge un peu les hanches")},
  "Chez les professionnels, le plaqueur est blessé à la tête bien plus souvent quand sa tête percute celle ou la hanche du porteur, ou quand il plaque trop droit ; placer la tête sur le côté et plaquer plus bas réduit ce risque (Tucker, 2017). La technique s'apprend par étapes, du statique vers la vitesse (Hendricks et Lambert, 2010).",
  ["tucker17", "hendricks10", "wr_tackle"],
  sc={"f": "rugby", "v": [15, 29, 35, 42], "o": [[20, 35, "pa", "Plaqueur à genoux"], [28, 35, "pb", "Porteur à genoux"]],
      "p": [{"k": "walk", "p": [[20.8, 35], [27, 35]], "l": "Épaule à la taille", "lo": -1, "n": 3, "e": "hit", "w": 0.6}, {"k": "walk", "p": [[27, 35.3], [27.6, 38.8]], "l": "Au sol", "lo": 1, "lp": 0.7, "n": 4, "e": "down"}],
      "t": [[24, 31, "Tête sur le côté du porteur"]]},
  obj={"ph": "Gainage et force des bras au contact", "te": "Tête du bon côté, épaule à la taille, bras qui serrent", "ma": "Un plaquage sûr et efficace qui stoppe le porteur"},
  org="Par deux sur un tapis ou une herbe souple. On inverse les rôles après chaque série.",
  var=["Porteur qui part en avant à 2 km/h", "Plaquage sur les deux côtés en alternance", "Passage debout : fiche « Approche du plaquage »"],
  contact="reel", pub="Tous", skill=True, warn=CONTACT_WARN, z=4)

D("sk_plaq_marche", "Approche du plaquage : marche puis trottinement", ["rugby", "rugby7"], "Technique", "2 plots, bouclier, un partenaire",
  "Apprendre les 3 temps avant l'impact : suivre le porteur, se préparer, puis contacter et pousser.",
  ["Couloir de 10 m. Le partenaire avance avec le bouclier, en marchant.",
   "Suivre : tu avances face à lui, en restant à l'intérieur de son épaule.",
   "Se préparer : à 2 m, raccourcis les appuis, baisse les hanches, dos plat, tête haute.",
   "Contact épaule sur le bouclier, tête sur le côté, bras qui serrent, jambes actives sur 2 m."],
  ["Petits pas rapides avant le contact (« hachés »)", "Hanches basses, poitrine en avant, yeux sur les hanches du porteur", "Les jambes continuent de pousser après le contact"],
  {"reprise": I(2, 5, 8, 22, 90, "Approche sans contact, arrêt à 1 m", "Sans contact : 2 séries de 5 approches, arrêt à 1 m du bouclier"),
   "sportif": I(2, 6, 8, 22, 120, "Approche en marchant + contact bouclier", "2 séries de 6, porteur en marchant"),
   "perf": I(3, 6, 8, 22, 120, "Approche en trottinant + contact bouclier", "3 séries de 6, porteur en trottinant"),
   "elite": I(3, 8, 8, 20, 120, "Trottinement + changement de côté + contact", "3 séries de 8, porteur qui change de côté")},
  "World Rugby découpe le plaquage en 5 temps (suivre, se préparer, contacter, accélérer, finir) et les entraîne du plus lent au plus rapide. Les plaqueurs qui continuent de pousser avec les jambes après le contact laissent moins passer le porteur et ses passes après contact (Hendricks, 2018).",
  ["wr_tackle", "hendricks18", "hendricks10"],
  sc={"f": "rugby", "v": [12, 29, 38, 41], "o": [[15, 35, "start", "Plaqueur"], [33, 35, "shield", "Bouclier tenu"]],
      "p": [{"k": "jog", "p": [[15, 35], [25, 35]], "l": "Suivre", "lo": -1, "n": 2}, {"k": "walk", "p": [[25, 35], [31.6, 35]], "l": "Se préparer", "lo": 1, "lp": 0.4, "n": 3},
            {"k": "walk", "p": [[31.6, 35], [32.6, 35]], "l": "Contact, jambes 2 m", "lo": -1, "lp": 0.0, "e": "hit", "w": 0.6}]},
  obj={"ph": "Freinage, abaissement du centre de gravité", "te": "Les 3 temps avant l'impact : suivre, se préparer, contacter", "ma": "Arriver au contact en équilibre plutôt que lancé et droit"},
  org="Couloir 10 m × 5 m, 2 plots, un bouclier. Le partenaire tient le bouclier, on inverse à chaque série.",
  var=["Porteur qui change de côté au dernier moment", "Plaqueur qui part du sol (relevé puis approche)", "Deux plaquages enchaînés à 5 m d'écart"],
  contact="bouclier", pub="Tous", skill=True, warn=CONTACT_WARN, z=4)

D("sk_plaq_face", "Plaquage de face, jambes actives", ["rugby", "rugby7"], "Technique", "Bouclier, 3 plots, un partenaire",
  "Gagner le contact de face : épaule à la taille, et des jambes qui ramènent le porteur en arrière.",
  ["Départ à 7 m du porteur qui tient le bouclier contre lui.",
   "Avance vite, puis raccourcis les appuis à 2 m.",
   "Contact épaule à la taille, tête sur le côté, bras qui serrent.",
   "Jambes actives : repousse le porteur 2 m en arrière, puis reviens au plot de départ en course arrière."],
  ["Aucun freinage brusque au dernier moment : on arrive en équilibre", "Pousser vers le haut et l'avant, jamais vers le bas sur la tête", "La qualité du plaquage passe avant la vitesse"],
  {"reprise": I(2, 5, 8, 22, 120, "Approche et placement, arrêt à 1 m", "Sans contact : 2 séries de 5 approches et placements"),
   "sportif": I(2, 5, 8, 30, 150, "1 plaquage bouclier + 2 m de poussée", "2 séries de 5, départ toutes les 30 s"),
   "perf": I(3, 5, 8, 30, 150, "1 plaquage bouclier + 2 m de poussée", "3 séries de 5, départ toutes les 30 s"),
   "elite": I(3, 6, 8, 25, 150, "1 plaquage + relevé + sprint 5 m", "3 séries de 6 : plaquage, relevé, sprint 5 m")},
  "En matchs internationaux comme en deuxième division anglaise, les plaquages de face à l'épaule et les jambes actives du plaqueur limitent les franchissements et les passes après contact (Hendricks, 2018). La fatigue dégrade la technique de plaquage : on arrête la série quand la qualité baisse (Gabbett, 2008).",
  ["hendricks18", "gabbett08", "tucker17"],
  sc={"f": "rugby", "v": [12, 29, 38, 42], "o": [[15, 34, "start", "Départ"], [28, 34, "shield", "Bouclier tenu"]],
      "p": [{"k": "sprint", "p": [[15, 34], [23, 34]], "l": "7 m", "lo": -1, "n": 1}, {"k": "walk", "p": [[23, 34], [27.3, 34]], "n": 2, "e": "hit", "w": 0.4},
            {"k": "walk", "p": [[27.3, 34], [30, 34]], "l": "Contact, jambes 2 m", "lo": -1, "lp": 0.3}, {"k": "back", "p": [[30, 38.5], [15, 38.5]], "l": "Retour", "lo": 1, "n": 4}]},
  obj={"ph": "Puissance des jambes au contact", "te": "Épaule à la taille, tête sur le côté, jambes actives", "ma": "Gagner la collision et ralentir le ballon adverse"},
  org="Couloir 10 m × 5 m. Binôme : A plaque, B tient le bouclier ; on inverse à chaque série.",
  var=["Porteur qui avance au trot", "Relevé et sprint vers le plot annoncé (bout RHIE)", "Plaquage à deux : le second arrive sur le ballon"],
  contact="bouclier", pub="Tous", skill=True, warn=CONTACT_WARN, z=5,
  poste={"avant": "Avants : enchaîne avec un déblayage sur un tackle bag à 5 m.", "trois-quarts": "Trois-quarts : départ à 12 m pour arriver plus vite au contact."})

D("sk_plaq_cote", "Plaquage de côté (couverture)", ["rugby", "rugby7"], "Technique", "Bouclier ou tackle bag, 3 plots, un partenaire",
  "Rattraper un porteur qui passe sur le côté : angle de course, tête derrière, bras qui descendent.",
  ["Le porteur part en diagonale avec le bouclier, à vitesse de jogging.",
   "Coupe sa course en diagonale pour arriver sur son côté, pas dans son dos.",
   "Tête derrière ses fesses, joue contre sa hanche, épaule sur la cuisse.",
   "Les bras serrent et glissent vers les genoux, puis tu le fais tomber sur le côté."],
  ["Tête toujours derrière le porteur, jamais devant sa hanche", "Coupe l'angle : vise l'endroit où il va, pas où il est", "Serre et descends les bras jusqu'aux genoux"],
  {"reprise": I(2, 4, 8, 25, 120, "Course d'angle, arrêt à 1 m", "Sans contact : 2 séries de 4 courses d'angle par côté"),
   "sportif": I(2, 6, 8, 30, 150, "1 plaquage de côté (alterner gauche et droite)", "2 séries de 6, côtés alternés"),
   "perf": I(3, 6, 8, 30, 150, "1 plaquage de côté", "3 séries de 6, porteur plus rapide"),
   "elite": I(3, 6, 8, 25, 150, "Couverture + plaquage + relevé", "3 séries de 6 : couverture 15 m, plaquage, relevé")},
  "Le risque de commotion du plaqueur est le plus élevé quand sa tête passe devant la hanche ou le genou du porteur ; la tête doit rester derrière (Tucker, 2017). Les études de terrain recommandent d'entraîner chaque type de plaquage (de face, de côté, de dos) séparément (Burger, 2020).",
  ["tucker17", "burger20", "wr_tackle"],
  sc={"f": "rugby", "v": [12, 22, 40, 48], "o": [[15, 27, "start", "Plaqueur"], [20, 44, "pb", "Porteur"]],
      "p": [{"k": "jog", "p": [[20, 44], [33, 31]], "r": 1, "l": "Porteur", "lo": 1, "lp": 0.35}, {"k": "sprint", "p": [[15, 27], [32, 29.6]], "l": "Angle de course", "lo": -1, "n": 2, "e": "hit", "w": 0.4},
            {"k": "walk", "p": [[32, 29.6], [34.5, 32.5]], "n": 4, "e": "down"}],
      "t": [[35.5, 26.5, "Tête derrière"]]},
  obj={"ph": "Vitesse de couverture et freinage", "te": "Angle de course, tête derrière, bras qui descendent", "ma": "Arrêter un porteur lancé sur l'aile"},
  org="Zone 20 m × 15 m. Le porteur tient un bouclier ou un tackle bag contre lui. Gauche puis droite.",
  var=["Porteur qui accélère au dernier moment", "Départ du sol (relevé puis couverture)", "Plaquage de dos sur tackle bag pour les arrières"],
  contact="bouclier", pub="Tous", skill=True, warn=CONTACT_WARN, z=5,
  poste={"trois-quarts": "Trois-quarts et 3e ligne : allonge la couverture à 20 m.", "avant": "Avants : couverture courte (10 m), porteur au trot."})

D("sk_porteur", "Porteur au contact : jambes actives et ballon placé", ["rugby", "rugby7"], "Technique", "Bouclier, ballon, un partenaire",
  "Garder le ballon au contact : rester bas, pousser avec les jambes, tomber sur le côté et placer le ballon loin.",
  ["Départ à 5 m du partenaire qui tient le bouclier.",
   "Avance ballon contre la poitrine, à deux mains, hanches basses avant le contact.",
   "Au contact, épaule devant, petits pas : continue de pousser 2 m.",
   "Tombe sur le côté, dos vers l'adversaire, et place le ballon loin derrière toi, bras tendus."],
  ["Hanches plus basses que celles du défenseur", "Le ballon reste protégé jusqu'au sol", "Placement actif : bras tendus, le plus loin possible vers ton camp"],
  {"reprise": I(2, 5, 6, 24, 90, "Chute sur le côté + placement, sans contact", "Sans contact : 2 séries de 5 chutes sur le côté et placements"),
   "sportif": I(2, 6, 8, 25, 120, "1 contact bouclier + placement", "2 séries de 6"),
   "perf": I(3, 6, 8, 25, 120, "1 contact bouclier + placement", "3 séries de 6, tenant qui résiste plus"),
   "elite": I(3, 6, 8, 22, 120, "Contact + placement + relevé", "3 séries de 6 : contact, placement, relevé et soutien")},
  "Au niveau international, les porteurs qui placent activement le ballon gardent plus souvent la possession, et ceux qui tombent sur le côté aussi ; les jambes actives du porteur favorisent les franchissements (Hendricks, 2018).",
  ["hendricks18", "hendricks10"],
  sc={"f": "rugby", "v": [12, 29, 36, 42], "o": [[15, 35, "start", "Porteur"], [27, 35, "shield", "Bouclier tenu"], [22.2, 38.6, "ball", "Ballon placé"]],
      "p": [{"k": "jog", "p": [[15, 35], [24, 35]], "l": "Ballon protégé", "lo": -1, "n": 2}, {"k": "walk", "p": [[24, 35], [26.3, 35]], "n": 3, "e": "hit", "w": 0.4},
            {"k": "walk", "p": [[26, 35.6], [24, 38.2]], "n": 4, "e": "down"}]},
  obj={"ph": "Force et gainage au contact", "te": "Hanches basses, protection et placement du ballon", "ma": "Garder la possession et accélérer le ruck"},
  org="Couloir 10 m. Binôme : un porteur, un tenant de bouclier. On inverse à chaque série.",
  var=["Deuxième joueur qui arrive en soutien pour déblayer", "Contact face à deux tenants", "Prise d'information : le coach annonce le côté de la chute"],
  contact="bouclier", pub="Tous", skill=True, warn=CONTACT_WARN, z=4)

D("sk_deblayage", "Déblayage sur tackle bag", ["rugby", "rugby7"], "Technique", "2 tackle bags, 2 ballons, des tenants",
  "Nettoyer le ballon : arriver bas, épaule sous le bag, et pousser au-delà du ballon.",
  ["Deux bags espacés de 6 m, un ballon posé au sol devant chacun.",
   "Sprint 5 m vers le bag 1, abaisse-toi avant le contact.",
   "Épaule sous le bag, dos plat, tête haute : pousse 2 m au-delà du ballon.",
   "Relève-toi, sprint vers le bag 2 et recommence."],
  ["Hanches sous les épaules, dos plat, tête haute", "Pieds actifs au-delà du ballon : ne finis pas au sol", "Sortie rapide vers la cible suivante"],
  {"reprise": I(2, 4, 12, 45, 150, "Déblayage sans impact (poussée lente)", "Sans impact : 2 séries de 4, poussée lente contre le bag tenu"),
   "sportif": I(2, 4, 15, 45, 180, "2 déblayages + sprints", "2 séries de 4 (bag 1 puis bag 2)"),
   "perf": I(3, 4, 15, 45, 180, "2 déblayages + sprints", "3 séries de 4, tenants qui résistent"),
   "elite": I(3, 4, 18, 45, 180, "3 déblayages + sprints", "3 séries de 4 avec un 3e bag (bloc de 15-20 s)")},
  "Au ruck, la position basse et les pieds actifs du joueur qui déblaie conditionnent l'efficacité comme la sécurité ; ces gestes s'entraînent d'abord contre un bag avant le contact réel (Hendricks et Lambert, 2010 ; Burger, 2020).",
  ["hendricks10", "burger20", "austin11"],
  sc={"f": "rugby", "v": [14, 26, 40, 44], "o": [[17, 31, "start", "Départ"], [23, 31, "shield", "Bag 1"], [22.2, 29.9, "ball", ""], [29, 37, "shield", "Bag 2"], [28.2, 35.9, "ball", ""], [36, 37, "c", "Fin"]],
      "p": [{"k": "sprint", "p": [[17, 31], [22.5, 31]], "l": "5 m", "n": 2, "e": "hit", "w": 0.5}, {"k": "walk", "p": [[22.5, 31], [24.5, 31]], "l": "2 m", "lo": -1, "n": 3},
            {"k": "sprint", "p": [[24.5, 32], [28.5, 37]], "l": "Bag 2", "lo": 1, "n": 4, "e": "hit", "w": 0.5}, {"k": "sprint", "p": [[30, 37], [36, 37]], "l": "Sortie", "lo": 1}]},
  obj={"ph": "Force-puissance répétée en posture basse", "te": "Déblayage : hanches basses, dos plat, pieds actifs", "ma": "Enchaîner les rucks sur des temps de jeu successifs"},
  org="Zone 25 m × 15 m, bags en zigzag à 5-6 m, un tenant par bag. Groupes de 3 ou 4 : un travaille, les autres tiennent, rotation.",
  var=["Déblayage à deux : le premier arrivé s'engage", "Tenant qui résiste activement", "Plaquage au bouclier avant le bag 1"],
  contact="bags", pub="Avants et 3e ligne", skill=True, warn=CONTACT_WARN, z=5,
  poste={"avant": "Avants : version complète avec 3 bags.", "trois-quarts": "Trois-quarts : 2 bags et un sprint final de 15 m."})

D("sk_releve", "Relevé et replacement défensif", ["rugby", "rugby7"], "Technique", "4 plots",
  "Après un plaquage, revenir debout et se replacer en ligne le plus vite possible.",
  ["Allongé sur le ventre au plot de départ (comme après un plaquage).",
   "Au signal, relève-toi en moins de 2 s.",
   "Recule en course arrière ou latérale jusqu'à la ligne de défense (5 m).",
   "Remonte 5 m vers l'attaque, puis reviens en marchant."],
  ["Relevé en moins de 2 s : mains sous les épaules, un pied devant", "Regarde le jeu pendant le replacement, pas tes pieds", "Remontée agressive, appuis courts à l'arrivée"],
  {"reprise": I(2, 4, 8, 22, 120, "Relevé + replacement à 70 %", "2 séries de 4 à 70 %"),
   "sportif": I(3, 5, 8, 22, 120, "Relevé + replacement + remontée", "3 séries de 5, départ toutes les 30 s"),
   "perf": I(3, 6, 8, 22, 120, "Relevé + replacement + remontée", "3 séries de 6, côté annoncé pendant le relevé"),
   "elite": I(4, 6, 8, 17, 120, "Relevé + replacement + remontée", "4 séries de 6, départ toutes les 25 s")},
  "Les séquences d'au moins 3 efforts intenses enchaînés, dont des relevés après plaquage, sont les plus exigeantes du match (Austin, 2011). Réagir à un signal entraîne mieux l'agilité de match qu'un parcours appris (Sheppard et Young, 2006).",
  ["austin11", "sheppard06"],
  sc={"f": "rugby", "v": [16, 26, 36, 44], "o": [[20, 35, "x", "Au sol"], [25, 30, "c", "Ligne"], [25, 40, "c", "de défense"], [30, 35, "c", "Remontée"]],
      "p": [{"k": "walk", "p": [[20, 35], [20.2, 35]], "l": "Relevé", "n": 2, "w": 0.6}, {"k": "lat", "p": [[20.5, 35], [25, 32]], "l": "Replacement", "lo": -1, "n": 3},
            {"k": "sprint", "p": [[25, 32], [30, 35]], "l": "Remontée 5 m", "lo": 1, "n": 4}]},
  obj={"ph": "Ré-accélération après un passage au sol", "te": "Relevé rapide, course arrière et latérale", "ma": "Être en ligne avant que l'adversaire ne relance"},
  org="Zone 15 m × 10 m, 4 plots. Seul ou avec un partenaire qui donne le signal et le côté.",
  var=["Signal visuel (main levée) plutôt que sonore", "Deux relevés dans le même bout", "Plaquage au bouclier avant le relevé (avec un coach)"],
  contact="aucun", pub="Tous", skill=True, z=4)

D("sk_passe", "Passe vissée des deux côtés", ["rugby", "rugby7"], "Technique", "Un ballon, un partenaire ou un mur",
  "Rendre la passe aussi précise du côté faible que du côté fort.",
  ["À 5 m du partenaire, de profil, mains en cible.",
   "Ballon tenu à deux mains, pieds dans l'axe de la passe.",
   "Passe en tournant le buste, poussée de la main arrière, doigts qui finissent vers la cible.",
   "10 passes du côté fort, 10 du côté faible, puis recule à 8 m, puis 10 m."],
  ["Les mains de ton partenaire sont la cible : vise-les", "Pousse de la main arrière, finis les doigts vers la cible", "Deux fois plus de passes du côté faible"],
  {"reprise": I(2, 20, 2, 3, 60, "Passes à 5 m", "2 séries de 20 passes à 5 m (moitié de chaque côté)"),
   "sportif": I(3, 20, 2, 3, 60, "Passes à 5 puis 8 m", "3 séries de 20 passes, 5 puis 8 m"),
   "perf": I(3, 20, 2, 3, 60, "Passes à 8 puis 10 m", "3 séries de 20 passes, 8 puis 10 m"),
   "elite": I(4, 20, 2, 3, 60, "Passes à 10-12 m", "4 séries de 20 passes, 10 à 12 m, ballon reçu en mouvement")},
  "Chez des joueurs de première division, les passes du côté non préféré partaient bien plus souvent en avant (57 % contre 15 %) et allaient moins loin : le côté faible doit être travaillé en priorité (Pavely, 2009).",
  ["pavely09"],
  sc={"f": "rugby", "v": [16, 28, 36, 42], "o": [[20, 35, "pa", "Passeur"], [30, 35, "pb", "Cible"]],
      "p": [{"k": "ball", "p": [[20.8, 34.6], [29.2, 34.6]], "l": "5 à 10 m", "n": 3}],
      "t": [[25, 39.5, "Côté fort · côté faible × 2"]]},
  obj={"ph": "Rotation du tronc et des hanches", "te": "Passe vissée, précision des deux côtés", "ma": "Faire vivre le ballon vite et loin, sans en-avant"},
  org="Par deux, 5 à 12 m d'écart. Seul : contre un mur, cible tracée à hauteur de poitrine.",
  var=["Passe après une réception en course", "Passe sous pression : un défenseur à 3 m", "Passe longue (15 m) pour les demis et les trois-quarts"],
  contact="aucun", pub="Tous", skill=True, z=3,
  poste={"trois-quarts": "Trois-quarts : finis par 2 séries à 12-15 m.", "avant": "Avants : passes courtes (3-5 m) après un pas de contact."})

D("sk_passe_course", "Passes en course à trois", ["rugby", "rugby7"], "Technique", "4 plots, un ballon, 3 joueurs",
  "Recevoir, fixer et passer en courant droit, sur toute la largeur d'un couloir.",
  ["Couloir de 20 m, trois joueurs alignés en escalier, 5 m entre chacun.",
   "Le premier part, mains en cible du receveur suivant.",
   "Reçois le ballon mains en avant, cours droit, et passe avant d'avoir fait 2 appuis.",
   "Fin du couloir : on repart dans l'autre sens."],
  ["Mains tendues vers le passeur avant de recevoir", "Cours droit : ne dérive pas vers le receveur", "Passe dans la course, sans freiner"],
  {"reprise": I(2, 4, 12, 30, 90, "1 aller en trottinant", "2 séries de 4 allers en trottinant"),
   "sportif": I(3, 4, 10, 30, 120, "1 aller à 70 %", "3 séries de 4 allers à 70 %"),
   "perf": I(3, 6, 8, 25, 120, "1 aller à 85 %", "3 séries de 6 allers à 85 %"),
   "elite": I(4, 6, 7, 23, 120, "1 aller à 90 %", "4 séries de 6 allers à 90 %, passes sautées")},
  "Les passes du côté faible sont plus souvent en avant : alterner les sens du couloir fait travailler les deux côtés (Pavely, 2009). La vitesse de course doit rester celle du match pour que le geste tienne en compétition.",
  ["pavely09"],
  sc={"f": "rugby", "v": [18, 22, 46, 40], "o": [[22, 26, "pa", "1"], [24, 31, "pa", "2"], [26, 36, "pa", "3"], [42, 26, "c", ""], [42, 36, "c", "20 m"]],
      "p": [{"k": "jog", "p": [[22, 26], [30, 26]], "l": "Course droite", "lo": -1, "n": 2}, {"k": "ball", "p": [[30, 26], [32, 31]], "n": 3}, {"k": "jog", "p": [[24, 31], [32, 31]], "r": 1},
            {"k": "ball", "p": [[34, 31], [36, 36]], "l": "Passe", "lo": 1}]},
  obj={"ph": "Vitesse de course et coordination", "te": "Réception mains en avant, passe dans la course", "ma": "Attaquer la ligne en gardant la vitesse"},
  org="Couloir 20 m × 15 m, 4 plots. Groupes de 3, un ballon. Allers alternés vers la gauche et vers la droite.",
  var=["Passe sautée (du 1 au 3)", "Un défenseur passif qui oblige à fixer", "Après la passe, le passeur fait le tour pour redevenir receveur (en boucle)"],
  contact="aucun", pub="Tous", skill=True, z=4)

D("sk_evitement", "Appuis d'évitement face à un défenseur", ["rugby", "rugby7"], "Technique", "4 plots, un partenaire",
  "Battre un défenseur sur un pas : fixer, puis crochet ou cadrage débordement.",
  ["Couloir de 10 m de large. Le défenseur attend à 10 m, au milieu.",
   "Avance droit sur lui pour le fixer.",
   "À 2 m, pose un appui fort à l'extérieur (crochet) ou accélère sur l'extérieur (cadrage).",
   "Passe-le et sprinte 5 m jusqu'à la ligne. Le défenseur touche à deux mains."],
  ["Va droit sur lui : un défenseur fixé ne peut plus glisser", "Appui large et bas pour le crochet, buste qui ne penche pas", "Change de vitesse juste après l'appui"],
  {"reprise": I(2, 4, 4, 26, 90, "1 évitement à 70 %, défenseur passif", "2 séries de 4 à 70 %, défenseur passif"),
   "sportif": I(3, 5, 4, 26, 120, "1 évitement, défenseur semi-actif", "3 séries de 5, défenseur semi-actif"),
   "perf": I(3, 6, 4, 26, 120, "1 duel au toucher", "3 séries de 6, défenseur actif au toucher"),
   "elite": I(4, 6, 4, 21, 120, "1 duel au toucher", "4 séries de 6, couloir réduit à 8 m")},
  "Face à un défenseur, les joueurs de rugby modifient leur course : appui plus large et moins de vitesse juste avant le changement de direction. Ce geste s'entraîne en réaction à un vrai défenseur, pas sur un parcours appris (Wheeler et Sayers, 2010 ; Sheppard et Young, 2006).",
  ["wheeler10", "sheppard06"],
  sc={"f": "rugby", "v": [16, 24, 42, 46], "o": [[20, 35, "start", "Porteur"], [30, 35, "pb", "Défenseur"], [37, 30, "c", ""], [37, 40, "c", "Ligne"]],
      "p": [{"k": "jog", "p": [[20, 35], [28, 35]], "l": "Fixe", "n": 2}, {"k": "sprint", "p": [[28, 35], [29, 39], [37, 39]], "l": "Crochet + 5 m", "lo": 1, "n": 3}]},
  obj={"ph": "Freinage et ré-accélération sur un appui", "te": "Fixer, crochet, cadrage débordement", "ma": "Gagner le duel et franchir la ligne"},
  org="Couloir 10 m × 15 m, 4 plots. Par deux : attaquant et défenseur, on inverse à chaque série.",
  var=["Défenseur qui part de côté (angle fermé)", "Deux défenseurs décalés", "Avec un soutien : crochet ou passe selon le défenseur"],
  contact="toucher", pub="Tous", skill=True, z=4,
  poste={"trois-quarts": "Trois-quarts : couloir de 12 m, départ lancé.", "avant": "Avants : couloir de 6 m, fixe puis passe ou percussion au bouclier (avec un coach)."})

D("sk_1c1", "Duel 1 contre 1 en couloir (toucher)", ["rugby", "rugby7"], "Technique", "4 plots, un ballon, un partenaire",
  "Lire le défenseur et choisir : le battre au pied, ou fixer et changer de rythme.",
  ["Couloir de 8 m de large sur 15 m. Attaquant et défenseur face à face à 10 m.",
   "Le défenseur monte : l'attaquant le lit (épaules, appuis) et attaque son point faible.",
   "Toucher à deux mains = plaqué. Ligne franchie = essai.",
   "On inverse les rôles à chaque duel."],
  ["Attaquant : vitesse avant le défenseur, appui décisif à 2 m", "Défenseur : monte vite, freine en appuis courts, épaules face au porteur", "Un point pour chaque duel gagné : compte les scores"],
  {"reprise": I(2, 4, 5, 25, 120, "1 duel à 70 %", "2 séries de 4 duels à 70 %"),
   "sportif": I(3, 4, 5, 25, 150, "1 duel", "3 séries de 4 duels (2 attaques, 2 défenses)"),
   "perf": I(3, 6, 5, 25, 150, "1 duel", "3 séries de 6 duels"),
   "elite": I(4, 6, 5, 20, 150, "1 duel, couloir de 6 m", "4 séries de 6 duels, couloir réduit à 6 m")},
  "Le duel en réaction à un vrai adversaire développe à la fois la prise d'information et l'agilité (Sheppard et Young, 2006) ; face au défenseur, l'attaquant adapte la largeur de ses appuis (Wheeler et Sayers, 2010).",
  ["sheppard06", "wheeler10"],
  sc={"f": "rugby", "v": [16, 24, 42, 46], "o": [[19, 31, "c", ""], [19, 39, "c", ""], [37, 31, "c", ""], [37, 39, "c", "15 m"], [20, 35, "pa", "Attaquant"], [31, 36, "pb", "Défenseur"]],
      "p": [{"k": "sprint", "p": [[20, 35], [26.5, 35], [28, 31.8], [37, 31.8]], "l": "Lit et attaque", "lo": -1, "lp": 0.75, "n": 2}, {"k": "sprint", "p": [[31, 36], [29, 36]], "r": 1}]},
  obj={"ph": "Vitesse et agilité en réaction", "te": "Lecture du défenseur, appuis décisifs", "ma": "Gagner les duels en un contre un"},
  org="Couloir 8 m × 15 m, 4 plots, un ballon. Par deux, rôles inversés à chaque duel.",
  var=["Le défenseur part de côté ou de dos", "2 contre 1 : fixer et passer", "Toucher à une main pour les plus jeunes"],
  contact="toucher", pub="Tous", skill=True, z=4)

for _sid in ("rugby", "rugby7"):
    _sp = next(x for x in SPORTS if x["id"] == _sid)
    _sp["skills"] = [d["id"] for d in DRILLS if d.get("skill") and _sid in d["sports"]]

SPORTS_CONTENT = {"SPORTS": SPORTS, "DRILLS": DRILLS, "SREFS": REFS}

# ---------- vérifications ----------
DRB_SKILL = lambda i: any(d["id"] == i and d.get("skill") for d in DRILLS)
_ids = {d["id"] for d in DRILLS}
assert len(_ids) == len(DRILLS), "identifiant de séance terrain en double"
for s in SPORTS:
    for d in s["drills"]:
        assert d in _ids, (s["id"], d)
for d in DRILLS:
    for r in d["refs"]:
        assert r in REFS, (d["id"], r)
    for s in d["sports"]:
        assert any(x["id"] == s for x in SPORTS), (d["id"], s)
    assert set(d["dose"]) == {"reprise", "sportif", "perf", "elite"}, d["id"]
for e in EX_SPORT:
    if e.get("drill"): assert e["drill"] in _ids, e["id"]
for s in SPORTS:
    for d in s.get("skills", []):
        assert d in _ids and DRB_SKILL(d), (s["id"], d)
for d in DRILLS:
    if d.get("skill"):
        assert d["contact"] in ("aucun", "toucher", "bouclier", "bags", "reel") and d.get("obj") and d.get("org") and d.get("var") and d.get("sc"), d["id"]
        assert d["contact"] in ("aucun", "toucher") or d.get("warn"), ("contact sans avertissement", d["id"])
        assert all(d["id"] not in s["drills"] for s in SPORTS), ("skill dans la rotation de la semaine", d["id"])
