# -*- coding: utf-8 -*-
"""Programmes standardisés — Antoine Prépa Performance.
Chaque programme : 3 blocs de 4 semaines (4 = allègement + tests), 3 séances / semaine.
Item : e = exercice, t = modèle de dose, r = répétitions imposées, w = dose explicite S1..S4, n = note.
"""

T = {
    "F8":  {"label": "Force — base", "sets": [3, 3, 4, 2], "reps": ["8", "8", "6", "8"], "int": ["RIR 3", "RIR 2", "RIR 2", "RIR 4"], "rest": "2 min", "load": True},
    "F5":  {"label": "Force", "sets": [3, 4, 5, 2], "reps": ["5", "5", "4", "5"], "int": ["RIR 3", "RIR 2", "RIR 1-2", "RIR 4"], "rest": "2-3 min", "load": True},
    "F3":  {"label": "Force maximale", "sets": [4, 5, 5, 2], "reps": ["3", "3", "2", "3"], "int": ["RIR 2", "RIR 2", "RIR 1", "RIR 4"], "rest": "3 min", "load": True},
    "H12": {"label": "Hypertrophie 10-12", "sets": [3, 3, 4, 2], "reps": ["10-12", "10-12", "8-10", "10"], "int": ["RIR 3", "RIR 2", "RIR 1", "RIR 4"], "rest": "90 s", "load": True},
    "H8":  {"label": "Hypertrophie 8-10", "sets": [3, 4, 4, 2], "reps": ["8-10", "8-10", "6-8", "8"], "int": ["RIR 2", "RIR 2", "RIR 1", "RIR 4"], "rest": "2 min", "load": True},
    "H15": {"label": "Endurance musculaire", "sets": [2, 3, 3, 2], "reps": ["12-15", "12-15", "12-15", "12"], "int": ["RIR 3", "RIR 2", "RIR 1", "RIR 4"], "rest": "60 s", "load": True},
    "P":   {"label": "Puissance", "sets": [3, 4, 4, 2], "reps": ["3", "3", "3", "3"], "int": ["explosif", "explosif", "explosif", "léger et rapide"], "rest": "2 min", "load": True},
    "PL":  {"label": "Pliométrie", "sets": [3, 3, 4, 2], "reps": ["5", "5", "5", "5"], "int": ["qualité max", "qualité max", "qualité max", "qualité max"], "rest": "90 s", "load": False},
    "S":   {"label": "Sprint", "sets": [4, 5, 6, 3], "reps": ["20 m", "20 m", "20 m", "20 m"], "int": ["vitesse max", "vitesse max", "vitesse max", "vitesse max"], "rest": "2-3 min", "load": False},
    "C":   {"label": "Gainage / circuit", "sets": [2, 3, 3, 2], "reps": ["30 s", "30 s", "30 s", "30 s"], "int": ["contrôlé", "contrôlé", "contrôlé", "contrôlé"], "rest": "45 s", "load": False},
    "M":   {"label": "Mobilité", "sets": [1, 1, 1, 1], "reps": ["8-10", "8-10", "8-10", "8-10"], "int": ["", "", "", ""], "rest": "", "load": False},
}

WU_SALLE = "10 min : 5 min de cardio léger, mobilité hanches et chevilles (90/90, genou au mur, world's greatest stretch), puis 2 séries progressives du premier exercice."
WU_TERRAIN = "15 min : 5 min de footing, gammes athlétiques, 3 accélérations progressives sur 30 m."
WU_MAISON = "8 min : marche sur place, rotations d'épaules et de hanches, 10 squats au poids du corps, 10 ponts fessiers."
WU_RUN = "10 min de footing très facile puis 4 gammes athlétiques (montées de genoux, talons-fesses)."
WU_RETOUR = "10 min : vélo ou marche rapide, mobilité de cheville, 2 × 10 ponts fessiers, 2 × 30 s d'équilibre unipodal."

def S(id, t, focus, lieu, wu, items):
    return {"id": id, "t": t, "focus": focus, "lieu": lieu, "wu": wu, "items": items}

def I(e, t=None, r=None, w=None, n=None):
    d = {"e": e}
    if t: d["t"] = t
    if r: d["r"] = r
    if w: d["w"] = w
    if n: d["n"] = n
    return d

TESTS = {
    "poids": {"n": "Poids", "u": "kg", "b": "info", "type": "num"},
    "taille": {"n": "Tour de taille", "u": "cm", "b": "low", "type": "num", "help": "Au niveau du nombril, debout, en fin d'expiration."},
    "hanches": {"n": "Tour de hanches", "u": "cm", "b": "low", "type": "num", "help": "Au point le plus large des fessiers."},
    "bras": {"n": "Tour de bras", "u": "cm", "b": "high", "type": "num", "help": "Bras contracté, au plus large du biceps."},
    "cuisse": {"n": "Tour de cuisse", "u": "cm", "b": "high", "type": "num", "help": "15 cm au-dessus de la rotule, debout."},
    "pompes": {"n": "Pompes (maximum)", "u": "rép.", "b": "high", "type": "num", "help": "Sans pause, poitrine à un poing du sol. Sur les genoux si besoin : toujours de la même façon."},
    "planche": {"n": "Gainage planche (maximum)", "u": "s", "b": "high", "type": "num", "help": "Arrêt dès que le bassin descend ou monte."},
    "assis_debout": {"n": "Assis-debout en 30 s", "u": "rép.", "b": "high", "type": "num", "help": "Chaise de 43 cm environ, bras croisés : nombre de levers complets en 30 s."},
    "fc_repos": {"n": "Fréquence cardiaque au repos", "u": "bpm", "b": "low", "type": "num", "help": "Le matin au réveil, allongé, sur 1 minute."},
    "sprint10": {"n": "Sprint 10 m", "u": "s", "b": "low", "type": "num", "help": "Départ arrêté pied avant sur la ligne. Meilleur de 3 essais, chronométré ou filmé (MySprint)."},
    "sprint30": {"n": "Sprint 30 m", "u": "s", "b": "low", "type": "num", "help": "Meilleur de 2 essais, 3 min de récupération."},
    "cmj": {"n": "Détente verticale (CMJ)", "u": "cm", "b": "high", "type": "num", "help": "Mains sur les hanches, meilleur de 3 sauts (application My Jump ou toise)."},
    "longueur": {"n": "Saut en longueur sans élan", "u": "cm", "b": "high", "type": "num", "help": "Meilleur de 3 essais, mesuré aux talons."},
    "navette": {"n": "Test navette 20 m (Luc Léger)", "u": "palier", "b": "high", "type": "num", "help": "Dernier palier complété avec une bande-son officielle."},
    "e1rm_squat": {"n": "Squat — maximum estimé", "u": "kg", "b": "high", "type": "e1rm", "help": "Charge lourde levée 3 à 5 fois proprement (RIR 1). Le maximum est estimé (formule d'Epley)."},
    "e1rm_sdt": {"n": "Soulevé de terre — maximum estimé", "u": "kg", "b": "high", "type": "e1rm", "help": "Charge lourde levée 3 à 5 fois proprement (RIR 1)."},
    "e1rm_dc": {"n": "Développé couché — maximum estimé", "u": "kg", "b": "high", "type": "e1rm", "help": "Charge lourde levée 3 à 5 fois proprement (RIR 1), avec un pareur."},
    "e1rm_epaule": {"n": "Épaulé en suspension — maximum estimé", "u": "kg", "b": "high", "type": "e1rm", "help": "Charge levée 2 à 3 fois avec une technique propre."},
    "vma": {"n": "Demi-Cooper (6 minutes)", "u": "m", "b": "high", "type": "num", "help": "Distance maximale en 6 min sur piste. VMA (km/h) = distance / 100."},
    "t5km": {"n": "Temps sur 5 km", "u": "min", "b": "low", "type": "num", "help": "En minutes décimales (24 min 30 s = 24,5)."},
    "hop": {"n": "Saut unipodal en distance", "u": "cm", "b": "high", "type": "pair", "help": "Meilleur de 3 sauts par jambe, réception tenue 2 s. Indice de symétrie = jambe blessée / jambe saine."},
    "su_squat": {"n": "Squats unipodaux sur box en 30 s", "u": "rép.", "b": "high", "type": "pair", "help": "Box à hauteur de genou, chaque jambe."},
    "course_continue": {"n": "Course continue sans douleur", "u": "min", "b": "high", "type": "num", "help": "Durée maximale courue en restant à 3/10 de douleur au plus."},
    "douleur": {"n": "Douleur maximale à l'effort", "u": "/10", "b": "low", "type": "num", "help": "0 = aucune, 10 = maximale."},
}

P = []

# =====================================================================
# 1. PERTE DE POIDS & RECOMPOSITION
# =====================================================================
P.append({
    "id": "perte", "n": "Perte de poids & recomposition", "short": "Perdre du gras, garder le muscle",
    "desc": "Pour les adultes qui veulent perdre de la masse grasse durablement tout en conservant, voire en développant, leur masse musculaire. Associe musculation, intervalles courts et objectif de pas quotidien.",
    "lieu": "Salle ou maison", "maison": True,
    "tests": ["poids", "taille", "hanches", "pompes", "planche"], "better": {"poids": "low"},
    "habits": ["Objectif de pas du bloc atteint", "Protéines à chaque repas", "Légumes à au moins 2 repas", "1,5 L d'eau", "7 h de sommeil"],
    "habit_note": ["Objectif : 7 000 pas par jour", "Objectif : 8 500 pas par jour", "Objectif : 10 000 pas par jour"],
    "refs": ["Donnelly JE et al. Appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults. Med Sci Sports Exerc. 2009;41(2):459-471.",
             "Wewege M et al. The effects of high-intensity interval training vs. moderate-intensity continuous training on body composition in overweight and obese adults: a systematic review and meta-analysis. Obes Rev. 2017;18(6):635-646.",
             "Willis LH et al. Effects of aerobic and/or resistance training on body mass and fat mass in overweight or obese adults. J Appl Physiol. 2012;113(12):1831-1837.",
             "Paluch AE et al. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health. 2022;7(3):e219-e228."],
    "science": "L'activité physique seule produit une perte de poids modeste en dessous de 150 min par semaine et plus nette au-delà de 225 à 250 min (Donnelly, 2009). La musculation protège la masse maigre pendant la perte de poids (Willis, 2012), et les intervalles courts donnent des résultats comparables au cardio continu en moins de temps (Wewege, 2017). Les pas quotidiens complètent les séances (Paluch, 2022).",
    "blocks": [
        {"n": "Fondation", "focus": "Apprendre les mouvements, installer la régularité et le volume de marche.", "sessions": [
            S("A", "Full body force", "Les grands mouvements + intervalles courts", "Salle", WU_SALLE, [
                I("squat_goblet", "H12"), I("pompes", "H12", n="Pompes inclinées si besoin"), I("sdt_roumain", "H12"),
                I("rowing_haltere", "H12", r="10-12/bras"), I("planche", "C", r="30 s"),
                I("velo_intervalles", w=["6 × 30 s vite / 60 s facile", "8 × 30 s / 60 s", "10 × 30 s / 60 s", "5 × 30 s / 60 s"])]),
            S("B", "Cardio & gainage", "Endurance douce et tronc", "Salle ou extérieur", WU_MAISON, [
                I("rameur", w=["20 min (effort 5/10)", "25 min (5/10)", "30 min (5/10)", "20 min (4/10)"]),
                I("dead_bug", "C", r="8/côté"), I("planche_laterale", "C", r="20 s/côté"), I("bird_dog", "C", r="8/côté"),
                I("mob_hanche", "M"), I("etirement_flechisseurs", "M", r="30 s/côté")]),
            S("C", "Full body métabolique", "Musculation en enchaînement", "Salle", WU_SALLE, [
                I("fente_arriere", "H12", r="10/jambe"), I("dm_halteres", "H12"), I("pont_fessier", "H15"),
                I("tirage_vertical", "H12"), I("farmer_walk", "C", r="30 m"),
                I("circuit_kb", w=["3 tours, 30 s de repos entre les tours", "4 tours", "5 tours", "3 tours"])]),
        ]},
        {"n": "Développement", "focus": "Charges plus lourdes et intervalles plus denses.", "sessions": [
            S("A", "Force + intervalles", "Charges plus lourdes", "Salle", WU_SALLE, [
                I("squat_barre", "H8"), I("dc_halteres", "H8"), I("hip_thrust", "H8"), I("rowing_barre", "H8"),
                I("pallof", "C", r="10/côté"),
                I("velo_intervalles", w=["8 × 30 s vite / 45 s", "10 × 30 s / 45 s", "12 × 30 s / 45 s", "6 × 30 s / 45 s"])]),
            S("B", "Endurance", "Cardio plus long", "Salle ou extérieur", WU_MAISON, [
                I("rameur", w=["30 min (5/10)", "35 min (5/10)", "40 min (5/10)", "25 min (4/10)"]),
                I("hollow", "C", r="20 s"), I("portage_valise", "C", r="20 m/bras"), I("mob_thoracique", "M")]),
            S("C", "Full body + finisher", "Volume et dépense", "Salle", WU_SALLE, [
                I("split_squat", "H12", r="10/jambe"), I("tractions_assist", "H8"), I("kb_swing", "C", r="15"),
                I("pompes", "H12"), I("burpees", w=["5 × 30 s / 30 s", "6 × 30 s / 30 s", "8 × 30 s / 30 s", "4 × 30 s / 30 s"])]),
        ]},
        {"n": "Intensification", "focus": "Intensité maximale tolérée et autonomie.", "sessions": [
            S("A", "Force lourde", "Garder le muscle en déficit", "Salle", WU_SALLE, [
                I("sdt", "F8"), I("squat_barre", "H8"), I("dc_halteres", "H8"), I("rowing_haltere", "H8", r="8-10/bras"),
                I("rollout", "C", r="8"),
                I("velo_intervalles", w=["10 × 20 s très vite / 40 s", "12 × 20 s / 40 s", "14 × 20 s / 40 s", "6 × 20 s / 40 s"])]),
            S("B", "Intervalles longs", "Capacité aérobie", "Salle ou extérieur", WU_MAISON, [
                I("rameur", w=["4 × 4 min (7/10) / 3 min facile", "5 × 4 min / 3 min", "6 × 4 min / 3 min", "3 × 4 min / 3 min"]),
                I("planche_laterale", "C", r="30 s/côté"), I("dead_bug", "C", r="10/côté"), I("respiration", "M", r="3 min")]),
            S("C", "Complexe métabolique", "Tout le corps, rythme élevé", "Salle", WU_SALLE, [
                I("fente_marchee", "H12", r="10/jambe"), I("dm", "H8"), I("hip_thrust", "H8"), I("tractions", "H8", n="Assistées si besoin"),
                I("farmer_walk", "C", r="40 m"),
                I("corde", w=["8 × 30 s / 30 s", "10 × 30 s / 30 s", "12 × 30 s / 30 s", "6 × 30 s / 30 s"])]),
        ]},
    ]})

# =====================================================================
# 2. PRISE DE MUSCLE
# =====================================================================
P.append({
    "id": "masse", "n": "Prise de muscle", "short": "Hypertrophie, 3 séances full body",
    "desc": "Pour gagner du muscle avec 3 séances par semaine : chaque groupe musculaire travaillé deux fois par semaine, volume progressif et effort mesuré en répétitions en réserve (RIR).",
    "lieu": "Salle", "maison": False,
    "tests": ["poids", "bras", "cuisse", "taille", "e1rm_squat", "e1rm_dc"], "better": {"poids": "high", "taille": "info"},
    "habits": ["Protéines à chaque repas", "3 repas + 1 collation", "7 h de sommeil"],
    "refs": ["Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073-1082.",
             "Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2016;46(11):1689-1697.",
             "Morton RW et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.",
             "Helms ER et al. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42-49."],
    "science": "La prise de muscle augmente avec le nombre de séries hebdomadaires par muscle (Schoenfeld, 2017) et une fréquence de deux fois par semaine fait mieux qu'une seule (Schoenfeld, 2016). Un apport en protéines d'environ 1,6 g/kg/jour maximise les gains (Morton, 2018). L'effort est piloté par les répétitions en réserve (Helms, 2016).",
    "blocks": [
        {"n": "Accumulation", "focus": "Volume modéré, technique et connexion musculaire.", "sessions": [
            S("A", "Bas du corps + poussée", "Quadriceps, pectoraux, épaules", "Salle", WU_SALLE, [
                I("squat_barre", "H12"), I("dc_halteres", "H12"), I("sdt_roumain", "H12"), I("dm_halteres", "H12"),
                I("extension_triceps", "H15"), I("mollets", "H15")]),
            S("B", "Tirage + chaîne postérieure", "Dos, fessiers, bras", "Salle", WU_SALLE, [
                I("tractions_assist", "H8"), I("rowing_haltere", "H12", r="10-12/bras"), I("hip_thrust", "H12"),
                I("elevations_laterales", "H15"), I("curl", "H12"), I("releve_jambes", "C", r="10")]),
            S("C", "Full body", "Tout le corps, angles différents", "Salle", WU_SALLE, [
                I("presse", "H12"), I("dc_incline", "H12"), I("fente_arriere", "H12", r="10/jambe"), I("tirage_vertical", "H12"),
                I("face_pull", "H15"), I("planche", "C", r="40 s")]),
        ]},
        {"n": "Volume", "focus": "Plus de séries, charges plus lourdes, nouveaux exercices.", "sessions": [
            S("A", "Bas du corps + poussée", "Charges plus lourdes", "Salle", WU_SALLE, [
                I("squat_avant", "H8"), I("dc_barre", "H8"), I("sdt_jambe", "H12", r="8-10/jambe"), I("dm", "H8"),
                I("dips", "H12"), I("mollets_unipodal", "H15")]),
            S("B", "Tirage + chaîne postérieure", "Dos épais, ischios", "Salle", WU_SALLE, [
                I("tractions", "H8"), I("rowing_barre", "H8"), I("sdt", "H8", r="6-8"), I("elevations_laterales", "H15"),
                I("curl", "H12"), I("pallof", "C", r="10/côté")]),
            S("C", "Full body", "Unilatéral et finitions", "Salle", WU_SALLE, [
                I("split_squat", "H12", r="10/jambe"), I("dc_incline", "H8"), I("hip_thrust", "H8"), I("tirage_vertical", "H12"),
                I("face_pull", "H15"), I("rollout", "C", r="8")]),
        ]},
        {"n": "Intensification", "focus": "Charges lourdes sur les exercices de base, volume maintenu.", "sessions": [
            S("A", "Force + hypertrophie bas", "Squat lourd", "Salle", WU_SALLE, [
                I("squat_barre", "F5"), I("dc_barre", "H8"), I("sdt_roumain", "H8"), I("landmine_press", "H12", r="10/bras"),
                I("extension_triceps", "H12"), I("mollets", "H15")]),
            S("B", "Force + hypertrophie dos", "Soulevé de terre lourd", "Salle", WU_SALLE, [
                I("sdt", "F5"), I("tractions", "H8", n="Lestées si plus de 10 répétitions"), I("rowing_haltere", "H8", r="8-10/bras"),
                I("elevations_laterales", "H15"), I("curl", "H12"), I("hollow", "C", r="30 s")]),
            S("C", "Full body volume", "Pompe musculaire", "Salle", WU_SALLE, [
                I("presse", "H12"), I("dc_halteres", "H8"), I("fente_marchee", "H12", r="10/jambe"), I("rowing_inverse", "H12"),
                I("face_pull", "H15"), I("releve_jambes", "C", r="12")]),
        ]},
    ]})

# =====================================================================
# 3. FORCE & HALTÉROPHILIE
# =====================================================================
P.append({
    "id": "force", "n": "Force & haltérophilie", "short": "Devenir plus fort et plus explosif",
    "desc": "Pour les sportifs et pratiquants confirmés qui veulent augmenter leur force maximale et leur puissance avec les mouvements de base et les dérivés d'haltérophilie (épaulé, arraché, tirages).",
    "lieu": "Salle avec barre et disques", "maison": False,
    "tests": ["e1rm_squat", "e1rm_sdt", "e1rm_dc", "e1rm_epaule", "cmj"], "better": {},
    "habits": [],
    "refs": ["Suchomel TJ, Nimphius S, Bellon CR, Stone MH. The importance of muscular strength: training considerations. Sports Med. 2018;48(4):765-785.",
             "Suchomel TJ, Comfort P, Stone MH. Weightlifting pulling derivatives: rationale for implementation and application. Sports Med. 2015;45(6):823-839.",
             "Helms ER et al. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42-49."],
    "science": "Une force maximale élevée améliore la puissance, la vitesse et réduit le risque de blessure (Suchomel, 2018). Les dérivés d'haltérophilie en suspension et les tirages développent la production de force rapide avec un apprentissage technique réduit (Suchomel, 2015). Le programme suit une progression base → force → force maximale.",
    "blocks": [
        {"n": "Technique & base", "focus": "Volume de force, apprentissage des dérivés d'haltérophilie.", "sessions": [
            S("A", "Épaulé + squat", "Triple extension et squat", "Salle", WU_SALLE, [
                I("epaule_suspension", "P", n="Charge légère, priorité à la technique"), I("squat_barre", "F8"), I("dc_barre", "F8"),
                I("rowing_barre", "H8"), I("planche", "C", r="40 s")]),
            S("B", "Tirage + soulevé", "Chaîne postérieure", "Salle", WU_SALLE, [
                I("mi_cuisse", "P"), I("sdt_roumain", "F8"), I("dm", "F8"), I("tractions_assist", "H8"), I("pallof", "C", r="10/côté")]),
            S("C", "Arraché + squat avant", "Vitesse et stabilité", "Salle", WU_SALLE, [
                I("arrache_suspension", "P", n="Charge légère"), I("squat_avant", "F8"), I("split_squat", "H8", r="8/jambe"),
                I("face_pull", "H15"), I("portage_valise", "C", r="20 m/bras")]),
        ]},
        {"n": "Force", "focus": "Charges lourdes en séries de 4 à 5, dérivés plus chargés.", "sessions": [
            S("A", "Épaulé + squat lourd", "Force du bas du corps", "Salle", WU_SALLE, [
                I("epaule_suspension", "P"), I("squat_barre", "F5"), I("dc_barre", "F5"), I("rowing_barre", "H8"), I("rollout", "C", r="8")]),
            S("B", "Tirage + soulevé lourd", "Force de la chaîne postérieure", "Salle", WU_SALLE, [
                I("tirage_epaule", "P"), I("sdt", "F5"), I("jete_pousse", "P"), I("tractions", "H8"), I("pallof", "C", r="12/côté")]),
            S("C", "Arraché + squat avant", "Puissance et prévention", "Salle", WU_SALLE, [
                I("arrache_suspension", "P"), I("squat_avant", "F5"), I("dm", "F5"), I("sdt_jambe", "H8", r="8/jambe"),
                I("nordic", "C", r="5"), I("farmer_walk", "C", r="30 m")]),
        ]},
        {"n": "Force maximale & puissance", "focus": "Séries courtes très lourdes et transfert vers la vitesse.", "sessions": [
            S("A", "Épaulé + squat maximal", "Force maximale", "Salle", WU_SALLE, [
                I("epaule_suspension", "P", r="2"), I("squat_barre", "F3"), I("dc_barre", "F3"), I("squat_saute_barre", "PL", r="5"),
                I("hollow", "C", r="30 s")]),
            S("B", "Tirage + soulevé maximal", "Force maximale", "Salle", WU_SALLE, [
                I("tirage_epaule", "P", r="2"), I("sdt", "F3"), I("jerk", "P", r="2"), I("tractions", "F5", n="Lestées"),
                I("copenhague", "C", r="20 s/côté")]),
            S("C", "Arraché + transfert", "Puissance", "Salle", WU_SALLE, [
                I("arrache_suspension", "P", r="2"), I("squat_avant", "F5"), I("dm", "F5"), I("box_jump", "PL", r="4"),
                I("nordic", "C", r="4"), I("portage_valise", "C", r="30 m/bras")]),
        ]},
    ]})

# =====================================================================
# 4. VITESSE & EXPLOSIVITÉ
# =====================================================================
P.append({
    "id": "vitesse", "n": "Vitesse & explosivité", "short": "Accélérer plus fort, courir plus vite",
    "desc": "Pour les sprinteurs et les joueurs de sports collectifs qui veulent gagner sur 10 et 30 m : deux séances de sprint sur terrain et une séance de force-puissance en salle par semaine.",
    "lieu": "Terrain ou piste + salle", "maison": False,
    "tests": ["sprint10", "sprint30", "cmj", "longueur"], "better": {},
    "habits": [],
    "refs": ["Rumpf MC, Lockie RG, Cronin JB, Jalilvand F. Effect of different sprint training methods on sprint performance over various distances: a brief review. J Strength Cond Res. 2016;30(6):1767-1785.",
             "Haugen T, Seiler S, Sandbakk Ø, Tønnessen E. The training and development of elite sprint performance: an integration of scientific and best practice literature. Sports Med Open. 2019;5:44.",
             "Petrakos G, Morin JB, Egan B. Resisted sled sprint training to improve sprint performance: a systematic review. Sports Med. 2016;46(3):381-400.",
             "van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med. 2019;53(21):1362-1370."],
    "science": "Les méthodes de sprint agissent sur des distances différentes : le sprint résisté et les départs améliorent surtout l'accélération, le sprint lancé la vitesse maximale (Rumpf, 2016 ; Petrakos, 2016). La qualité prime sur le volume, avec des récupérations complètes (Haugen, 2019). Le Nordic hamstring divise par deux le risque de blessure aux ischios (van Dyk, 2019).",
    "blocks": [
        {"n": "Mécanique & accélération", "focus": "Posture de course, départs et force de base.", "sessions": [
            S("A", "Accélération", "Départs et 20 premiers mètres", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("pogo", "PL", r="15"), I("depart_3appuis", "S", r="10 m"),
                I("acc_20", "S", r="20 m"), I("nordic", "C", r="5")]),
            S("B", "Force", "Force du bas du corps", "Salle", WU_SALLE, [
                I("squat_barre", "F8"), I("sdt_roumain", "H8"), I("split_squat", "H8", r="8/jambe"), I("mollets_unipodal", "H15"),
                I("planche_laterale", "C", r="30 s/côté")]),
            S("C", "Vitesse", "Mécanique de vitesse maximale", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("wicket", "S", r="30 m"), I("sprint_lance", "S", r="20 m d'élan + 10 m lancés"),
                I("bonds", "PL", r="6 bonds"), I("copenhague", "C", r="15 s/côté")]),
        ]},
        {"n": "Puissance", "focus": "Sprint résisté, sauts et dérivés d'haltérophilie.", "sessions": [
            S("A", "Accélération résistée", "Pousser fort", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("sprint_resiste", "S", r="15 m"), I("acc_10", "S", r="10 m"),
                I("box_jump", "PL", r="4"), I("nordic", "C", r="6")]),
            S("B", "Force-puissance", "Transfert de la force", "Salle", WU_SALLE, [
                I("epaule_suspension", "P"), I("squat_barre", "F5"), I("hip_thrust", "F5"), I("saut_longueur", "PL", r="3"),
                I("pallof", "C", r="10/côté")]),
            S("C", "Vitesse + côtes", "Vitesse et puissance", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("sprint_lance", "S", r="20 m d'élan + 20 m lancés"),
                I("montees", "S", r="30 m en côte"), I("sauts_haies", "PL", r="5 haies"), I("tibial", "C", r="15")]),
        ]},
        {"n": "Vitesse maximale", "focus": "Sprints complets, réactivité et affûtage avant les tests.", "sessions": [
            S("A", "Départs + 30 m", "Accélération complète", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("depart_3appuis", "S", r="10 m"), I("sprint_30", "S", r="30 m"),
                I("drop_jump", "PL", r="4"), I("nordic", "C", r="5")]),
            S("B", "Puissance", "Vitesse d'exécution", "Salle", WU_SALLE, [
                I("squat_saute_barre", "P", r="4"), I("mi_cuisse", "P"), I("sdt", "F5"), I("split_squat", "F5", r="5/jambe"),
                I("med_ball_lancer", "PL", r="5")]),
            S("C", "Vitesse maximale", "Vitesse lancée", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("sprint_lance", "S", r="30 m d'élan + 20 m lancés"),
                I("wicket", "S", r="40 m"), I("bonds", "PL", r="8 bonds"), I("copenhague", "C", r="20 s/côté")]),
        ]},
    ]})

# =====================================================================
# 5. PRÉPARATION SPORTS COLLECTIFS
# =====================================================================
P.append({
    "id": "prepa", "n": "Prépa sports collectifs", "short": "Rugby, football, handball, basket",
    "desc": "Pour l'intersaison et la pré-saison : force en salle, vitesse et changements de direction sur terrain, conditionnement intermittent et prévention des blessures (ischios, adducteurs, chevilles).",
    "lieu": "Salle + terrain", "maison": False,
    "tests": ["sprint10", "sprint30", "cmj", "navette", "e1rm_squat"], "better": {},
    "habits": [],
    "refs": ["Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med. 2016;50(5):273-280.",
             "Lauersen JB, Bertelsen DM, Andersen LB. The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials. Br J Sports Med. 2014;48(11):871-877.",
             "Soligard T et al. Comprehensive warm-up programme to prevent injuries in young female footballers: cluster randomised controlled trial. BMJ. 2008;337:a2469.",
             "van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries. Br J Sports Med. 2019;53(21):1362-1370."],
    "science": "Une charge d'entraînement élevée mais construite progressivement protège mieux qu'une charge faible ou des pics brutaux (Gabbett, 2016). Le renforcement musculaire est l'intervention de prévention la plus efficace (Lauersen, 2014), et un échauffement structuré réduit les blessures (Soligard, 2008). La charge est suivie par l'effort perçu de chaque séance.",
    "blocks": [
        {"n": "Fondation", "focus": "Force générale, mécanique de course, base aérobie intermittente.", "sessions": [
            S("A", "Force", "Force générale + prévention", "Salle", WU_SALLE, [
                I("squat_barre", "F8"), I("dc_barre", "F8"), I("sdt_roumain", "H8"), I("rowing_haltere", "H8", r="8-10/bras"),
                I("copenhague", "C", r="15 s/côté"), I("nordic", "C", r="5")]),
            S("B", "Vitesse & appuis", "Accélérer et freiner", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("acc_20", "S", r="20 m"),
                I("decel", w=["4 freinages après 10 m", "5 freinages", "6 freinages", "3 freinages"]), I("cod_505", "S", r="505 (2 par pied)"),
                I("equilibre", "C", r="30 s/jambe")]),
            S("C", "Conditionnement", "Capacité intermittente", "Terrain", WU_TERRAIN, [
                I("intermittent_1515", w=["2 × 6 min de 15-15 (récup 3 min)", "2 × 8 min", "3 × 7 min", "2 × 5 min"]),
                I("planche", "C", r="40 s"), I("planche_laterale", "C", r="25 s/côté"), I("mob_hanche", "M")]),
        ]},
        {"n": "Développement", "focus": "Puissance, réactivité et répétition des sprints.", "sessions": [
            S("A", "Force-puissance", "Explosivité", "Salle", WU_SALLE, [
                I("epaule_suspension", "P"), I("squat_avant", "F5"), I("dc_barre", "F5"), I("hip_thrust", "H8"),
                I("nordic", "C", r="6"), I("pallof", "C", r="10/côté")]),
            S("B", "Vitesse résistée & réactivité", "Duels et démarrages", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("sprint_resiste", "S", r="15 m"),
                I("reactif", w=["6 × 10 m sur signal", "8 × 10 m", "10 × 10 m", "5 × 10 m"]), I("saut_lateral", "PL", r="6/côté")]),
            S("C", "Répétition de sprints", "Tenir l'intensité du match", "Terrain", WU_TERRAIN, [
                I("rsa", w=["2 × 6 × 20 m (récup 20 s, 4 min entre séries)", "3 × 6 × 20 m", "3 × 8 × 20 m", "2 × 5 × 20 m"]),
                I("intermittent_3030", w=["8 × 30-30", "10 × 30-30", "12 × 30-30", "6 × 30-30"]), I("copenhague", "C", r="20 s/côté")]),
        ]},
        {"n": "Spécifique & affûtage", "focus": "Intensité de match, volume réduit, fraîcheur pour la reprise.", "sessions": [
            S("A", "Force maximale", "Force lourde, volume bas", "Salle", WU_SALLE, [
                I("epaule_suspension", "P", r="2"), I("squat_barre", "F3"), I("dc_barre", "F3"), I("box_jump", "PL", r="4"),
                I("nordic", "C", r="5")]),
            S("B", "Vitesse maximale & agilité", "Vitesse du match", "Terrain", WU_TERRAIN, [
                I("gammes", "M", r="2 × 20 m de chaque"), I("depart_3appuis", "S", r="10 m"),
                I("sprint_lance", "S", r="20 m d'élan + 10 m lancés"), I("cod_505", "S", r="505 (2 par pied)")]),
            S("C", "Conditionnement spécifique", "Efforts du match", "Terrain", WU_TERRAIN, [
                I("navette", w=["4 × 1 min de navettes 10-20 m / 1 min", "5 × 1 min / 1 min", "6 × 1 min / 1 min", "3 × 1 min / 1 min"]),
                I("rsa", w=["2 × 6 × 20 m", "2 × 8 × 20 m", "3 × 6 × 20 m", "1 × 6 × 20 m"]), I("worlds_greatest", "M", r="5/côté")]),
        ]},
    ]})

# =====================================================================
# 6. REMISE EN FORME & SANTÉ
# =====================================================================
P.append({
    "id": "forme", "n": "Remise en forme & santé", "short": "Reprendre le sport en douceur",
    "desc": "Pour les débutants ou les personnes qui reprennent après une longue pause : deux séances de renforcement et une séance d'endurance par semaine, faisables à la maison avec très peu de matériel.",
    "lieu": "Maison ou salle", "maison": True,
    "tests": ["poids", "taille", "assis_debout", "pompes", "planche", "fc_repos"], "better": {"poids": "info"},
    "habits": ["30 min de marche ou plus", "2 pauses actives dans la journée", "Légumes à au moins 2 repas", "1,5 L d'eau", "7 h de sommeil"],
    "refs": ["Bull FC et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020;54(24):1451-1462.",
             "Jones CJ, Rikli RE, Beam WC. A 30-s chair-stand test as a measure of lower body strength in community-residing older adults. Res Q Exerc Sport. 1999;70(2):113-119.",
             "Paluch AE et al. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health. 2022;7(3):e219-e228."],
    "science": "L'OMS recommande 150 à 300 minutes d'activité modérée par semaine et du renforcement musculaire au moins deux jours par semaine (Bull, 2020). Le programme atteint ces repères progressivement. Le test assis-debout en 30 secondes est une mesure simple et validée de la force des jambes (Jones, 1999).",
    "blocks": [
        {"n": "Reprise", "focus": "Réapprendre les mouvements de base sans douleur.", "sessions": [
            S("A", "Renforcement 1", "Jambes et poussée", "Maison", WU_MAISON, [
                I("squat_box", "H12", r="10-12"), I("pompes_inclinees", "H12"), I("pont_fessier", "H15"),
                I("tirage_elastique", "H12"), I("dead_bug", "C", r="6/côté"), I("mob_thoracique", "M", r="6/côté")]),
            S("B", "Endurance", "Marche active", "Extérieur", WU_MAISON, [
                I("marche_rapide", w=["30 min (effort 4/10)", "35 min", "40 min", "30 min"]),
                I("equilibre", "C", r="30 s/jambe"), I("mob_cheville", "M", r="10/côté")]),
            S("C", "Renforcement 2", "Jambes et tirage", "Maison", WU_MAISON, [
                I("step_up", "H12", r="8/jambe"), I("dm_halteres", "H12", n="Bouteilles d'eau si pas d'haltères"),
                I("bird_dog", "C", r="8/côté"), I("rowing_haltere", "H12", r="10/bras"), I("planche", "C", r="20 s")]),
        ]},
        {"n": "Progression", "focus": "Plus de charge et un peu d'intensité en endurance.", "sessions": [
            S("A", "Renforcement 1", "Plus de charge", "Maison", WU_MAISON, [
                I("squat_goblet", "H12"), I("pompes_inclinees", "H12", n="Support plus bas qu'au bloc 1"),
                I("sdt_roumain", "H12", n="Avec haltères ou kettlebell"), I("rowing_haltere", "H12", r="10/bras"),
                I("planche_laterale", "C", r="20 s/côté")]),
            S("B", "Endurance active", "Marche avec accélérations", "Extérieur", WU_MAISON, [
                I("marche_rapide", w=["35 min dont 5 × 1 min rapide", "40 min dont 6 × 1 min rapide", "45 min dont 8 × 1 min rapide", "30 min tranquille"]),
                I("mob_hanche", "M")]),
            S("C", "Renforcement 2", "Équilibre et gainage", "Maison", WU_MAISON, [
                I("fente_arriere", "H12", r="8/jambe"), I("dm_halteres", "H12"), I("pont_fessier", "H15", n="Unipodal si facile"),
                I("tirage_elastique", "H12"), I("farmer_walk", "C", r="30 m")]),
        ]},
        {"n": "Autonomie", "focus": "Séances plus complètes et habitudes installées.", "sessions": [
            S("A", "Renforcement 1", "Mouvements complets", "Maison ou salle", WU_MAISON, [
                I("squat_goblet", "H8"), I("pompes", "H12", n="Sur les genoux si besoin"), I("sdt_roumain", "H8"),
                I("rowing_haltere", "H8", r="8-10/bras"), I("pallof", "C", r="10/côté")]),
            S("B", "Endurance", "Cardio soutenu", "Extérieur", WU_MAISON, [
                I("marche_rapide", w=["40 min dont 6 × 1 min soutenu", "45 min dont 6 × 1 min", "45 min dont 8 × 1 min", "30 min tranquille"], n="Vélo ou natation possibles"),
                I("respiration", "M", r="3 min")]),
            S("C", "Renforcement 2", "Circuit final", "Maison ou salle", WU_MAISON, [
                I("split_squat", "H12", r="8/jambe"), I("dm_halteres", "H8"), I("hip_thrust", "H12", n="Pont fessier à la maison"),
                I("tirage_elastique", "H12"), I("portage_valise", "C", r="20 m/bras"),
                I("jumping_jacks", w=["3 × 30 s / 30 s", "4 × 30 s / 30 s", "5 × 30 s / 30 s", "3 × 30 s / 30 s"])]),
        ]},
    ]})

# =====================================================================
# 7. COURSE À PIED 5-10 KM
# =====================================================================
P.append({
    "id": "run", "n": "Course à pied 5-10 km", "short": "Courir plus vite sur 5 ou 10 km",
    "desc": "Pour les coureurs qui courent déjà 30 minutes sans s'arrêter et veulent progresser : une séance de qualité, une sortie longue et une séance de renforcement du coureur par semaine.",
    "lieu": "Extérieur ou piste + maison", "maison": True,
    "tests": ["vma", "t5km"], "better": {},
    "habits": [],
    "refs": ["Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform. 2010;5(3):276-291.",
             "Blagrove RC, Howatson G, Hayes PR. Effects of strength training on the physiological determinants of middle- and long-distance running performance: a systematic review. Sports Med. 2018;48(5):1117-1149.",
             "Lauersen JB, Bertelsen DM, Andersen LB. The effectiveness of exercise interventions to prevent sports injuries. Br J Sports Med. 2014;48(11):871-877."],
    "science": "Les coureurs qui progressent passent environ 80 % de leur temps à allure facile et 20 % à haute intensité (Seiler, 2010). Le renforcement musculaire améliore l'économie de course sans prise de masse gênante (Blagrove, 2018) et réduit le risque de blessure (Lauersen, 2014).",
    "blocks": [
        {"n": "Base aérobie", "focus": "Volume facile, premiers intervalles courts.", "sessions": [
            S("A", "Qualité : 30-30", "VMA courte", "Extérieur", WU_RUN, [
                I("fractionne_court", w=["8 × 30 s à 100 % VMA / 30 s trot", "10 × 30-30", "12 × 30-30", "6 × 30-30"]),
                I("lignes_droites", w=["4 lignes droites", "4 lignes droites", "5 lignes droites", "3 lignes droites"])]),
            S("B", "Sortie longue", "Endurance fondamentale", "Extérieur", WU_RUN, [
                I("sortie_longue", w=["45 min", "50 min", "55 min", "40 min"])]),
            S("C", "Renforcement du coureur", "Jambes, mollets, tronc", "Maison ou salle", WU_MAISON, [
                I("squat_goblet", "H12"), I("sdt_roumain", "H12"), I("mollets_unipodal", "H15"), I("step_up", "H12", r="10/jambe"),
                I("planche_laterale", "C", r="30 s/côté"), I("pogo", "PL", r="15")]),
        ]},
        {"n": "Seuil & VMA", "focus": "Fractionné plus long, sortie longue allongée.", "sessions": [
            S("A", "Qualité : 400 m", "VMA", "Piste ou extérieur", WU_RUN, [
                I("fractionne_court", w=["6 × 400 m à 95 % VMA / 1 min 30 trot", "8 × 400 m", "10 × 400 m", "5 × 400 m"])]),
            S("B", "Sortie longue", "Endurance + allure", "Extérieur", WU_RUN, [
                I("sortie_longue", w=["60 min", "65 min", "70 min dont 10 min allure 10 km", "50 min"])]),
            S("C", "Footing + renforcement", "Endurance et force", "Extérieur + maison", WU_RUN, [
                I("footing_ef", w=["30 min", "30 min", "35 min", "25 min"]), I("split_squat", "H8", r="8/jambe"),
                I("sdt_jambe", "H12", r="10/jambe"), I("mollets", "H15"), I("nordic", "C", r="5"), I("bonds", "PL", r="6 bonds")]),
        ]},
        {"n": "Spécifique 5-10 km", "focus": "Allure de course, affûtage et test final.", "sessions": [
            S("A", "Qualité : seuil", "Allure 10 km", "Extérieur", WU_RUN, [
                I("tempo", w=["3 × 8 min allure 10 km / 2 min", "3 × 10 min / 2 min", "4 × 8 min / 2 min", "2 × 8 min / 2 min"])]),
            S("B", "Qualité : allure 5 km", "Spécifique", "Piste ou extérieur", WU_RUN, [
                I("fractionne_long", w=["5 × 1000 m allure 5 km / 2 min", "6 × 1000 m / 2 min", "4 × 1500 m / 2 min 30", "Test 5 km chronométré"])]),
            S("C", "Sortie longue + renforcement", "Endurance et prévention", "Extérieur + maison", WU_RUN, [
                I("sortie_longue", w=["60 min", "70 min", "75 min", "45 min"]), I("squat_unipodal_box", "H8", r="8/jambe"),
                I("mollets_unipodal", "H15"), I("copenhague", "C", r="15 s/côté")]),
        ]},
    ]})

# =====================================================================
# 8. RETOUR À LA COURSE APRÈS BLESSURE
# =====================================================================
P.append({
    "id": "retour", "n": "Retour à la course après blessure", "short": "Reprendre la course en sécurité",
    "desc": "Pour les personnes qui ont terminé leur rééducation (ligament croisé, entorse, blessure musculaire…) et ont l'accord de leur médecin ou kiné pour reprendre la course. Renforcement unilatéral, progression marche-course et retour aux appuis.",
    "lieu": "Salle ou maison + extérieur", "maison": True,
    "tests": ["douleur", "course_continue", "hop", "su_squat"], "better": {},
    "habits": [],
    "prereq": ["Accord écrit du chirurgien, du médecin ou du kiné pour reprendre la course",
               "Marche normale, sans boiterie ni douleur",
               "Genou ou cheville sans gonflement après l'effort",
               "Amplitude articulaire complète ou quasi complète",
               "10 squats unipodaux contrôlés et 10 petits sauts sur place sans douleur"],
    "refs": ["Rambaud AJM, Ardern CL, Thoreux P, Regnaux JP, Edouard P. Criteria for return to running after anterior cruciate ligament reconstruction: a scoping review. Br J Sports Med. 2018;52(22):1437-1444.",
             "Grindem H et al. Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction: the Delaware-Oslo ACL cohort study. Br J Sports Med. 2016;50(13):804-808.",
             "Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy. Am J Sports Med. 2007;35(6):897-906."],
    "science": "La reprise de la course se décide sur des critères (force, absence de douleur et de gonflement, contrôle moteur) plutôt que sur une date seule (Rambaud, 2018). Atteindre des critères objectifs avant la reprise réduit fortement le risque de nouvelle blessure (Grindem, 2016). La douleur est surveillée avec une règle simple : au plus 3/10 pendant l'effort et retour à la normale le lendemain (Silbernagel, 2007).",
    "blocks": [
        {"n": "Réhabituation", "focus": "Marche-course progressive et force unilatérale.", "sessions": [
            S("A", "Course + force", "Première reprise", "Extérieur + salle", WU_RETOUR, [
                I("marche_course", w=["10 × (1 min course / 1 min marche)", "8 × (2 min / 1 min)", "6 × (3 min / 1 min)", "5 × (3 min / 1 min)"]),
                I("spanish_squat", "C", r="45 s"), I("squat_unipodal_box", "H12", r="8/jambe"), I("pont_fessier", "H15", n="Unipodal"),
                I("mollets_unipodal", "H15")]),
            S("B", "Contrôle & équilibre", "Stabilité de la jambe", "Salle ou maison", WU_RETOUR, [
                I("step_down", "H12", r="8/jambe"), I("sdt_jambe", "H12", r="8/jambe"), I("equilibre", "C", r="30 s/jambe"),
                I("pogo", "PL", r="10", n="Deux pieds, sans douleur"), I("planche_laterale", "C", r="20 s/côté")]),
            S("C", "Course + force", "Consolidation", "Extérieur + salle", WU_RETOUR, [
                I("marche_course", w=["10 × (1 min / 1 min)", "8 × (2 min / 1 min)", "6 × (3 min / 1 min)", "5 × (3 min / 1 min)"]),
                I("split_squat", "H12", r="8/jambe"), I("leg_curl_glisse", "H12"), I("tibial", "C", r="15")]),
        ]},
        {"n": "Course continue", "focus": "Supprimer la marche, premiers sauts unipodaux.", "sessions": [
            S("A", "Course + force", "Blocs de course plus longs", "Extérieur + salle", WU_RETOUR, [
                I("marche_course", w=["4 × (5 min / 1 min marche)", "3 × (8 min / 1 min)", "20 min continu", "15 min continu"]),
                I("squat_unipodal_box", "H8", r="8/jambe"), I("hip_thrust", "H12", n="Unipodal si possible"), I("mollets_unipodal", "H15")]),
            S("B", "Appuis & pliométrie basse", "Retrouver l'élasticité", "Salle ou terrain", WU_RETOUR, [
                I("pogo", "PL", r="15"), I("saut_unipodal", "PL", r="5/jambe", n="Sur place puis vers l'avant"),
                I("step_down", "H12", r="10/jambe"), I("nordic", "C", r="4", n="Amplitude réduite si besoin"), I("equilibre", "C", r="30 s/jambe")]),
            S("C", "Course + force", "Endurance de la jambe", "Extérieur + salle", WU_RETOUR, [
                I("marche_course", w=["4 × (5 min / 1 min)", "3 × (8 min / 1 min)", "20 min continu", "15 min continu"]),
                I("split_squat", "H8", r="8/jambe"), I("sdt_jambe", "H8", r="8/jambe"), I("copenhague", "C", r="15 s/côté")]),
        ]},
        {"n": "Retour aux appuis", "focus": "Course plus longue, accélérations et premiers changements de direction.", "sessions": [
            S("A", "Course + accélérations", "Retrouver de la vitesse", "Extérieur", WU_RETOUR, [
                I("footing_ef", w=["25 min continu", "30 min", "35 min", "30 min"]),
                I("lignes_droites", w=["4 lignes droites à 70 %", "5 à 75 %", "6 à 80 %", "4 à 70 %"]),
                I("squat_unipodal_box", "H8", r="6/jambe")]),
            S("B", "Appuis & changements de direction", "Pivots progressifs", "Terrain", WU_RETOUR, [
                I("shuffle", w=["4 × 10 m aller-retour à 60 %", "5 × 10 m à 70 %", "6 × 10 m à 80 %", "4 × 10 m à 70 %"]),
                I("decel", w=["4 freinages à 60 %", "5 à 70 %", "6 à 80 %", "4 à 70 %"]), I("saut_unipodal", "PL", r="6/jambe"),
                I("saut_lateral", "PL", r="5/côté")]),
            S("C", "Course + force", "Volume et force", "Extérieur + salle", WU_RETOUR, [
                I("footing_ef", w=["30 min", "35 min", "40 min", "30 min"]), I("split_squat", "F8", r="6-8/jambe"),
                I("nordic", "C", r="5"), I("mollets_unipodal", "H15")]),
        ]},
    ]})

PROGRAMS = P

CHECKIN = [
    {"k": "poids", "n": "Poids", "u": "kg", "type": "num", "opt": True},
    {"k": "taille", "n": "Tour de taille", "u": "cm", "type": "num", "opt": True},
    {"k": "sommeil", "n": "Qualité du sommeil", "type": "scale", "min": 1, "max": 5, "lo": "Très mauvais", "hi": "Excellent"},
    {"k": "energie", "n": "Énergie", "type": "scale", "min": 1, "max": 5, "lo": "À plat", "hi": "En pleine forme"},
    {"k": "stress", "n": "Stress", "type": "scale", "min": 1, "max": 5, "lo": "Aucun", "hi": "Très élevé"},
    {"k": "courbatures", "n": "Courbatures", "type": "scale", "min": 1, "max": 5, "lo": "Aucune", "hi": "Très fortes"},
    {"k": "nutrition", "n": "Respect de tes habitudes alimentaires", "type": "scale", "min": 1, "max": 5, "lo": "Pas du tout", "hi": "Parfaitement"},
    {"k": "douleur", "n": "Douleur", "type": "scale", "min": 0, "max": 10, "lo": "Aucune", "hi": "Maximale"},
    {"k": "zone", "n": "Où as-tu mal ?", "type": "text", "opt": True},
    {"k": "pas", "n": "Pas par jour (moyenne)", "type": "num", "opt": True},
    {"k": "victoire", "n": "Ta réussite de la semaine", "type": "text", "opt": True},
    {"k": "difficulte", "n": "Ce qui a été difficile", "type": "text", "opt": True},
    {"k": "question", "n": "Ta question pour Antoine", "type": "text", "opt": True},
]

SCREENING = [
    "Un médecin t'a-t-il déjà dit que tu avais un problème cardiaque ou de tension artérielle ?",
    "Ressens-tu des douleurs dans la poitrine au repos ou pendant un effort ?",
    "As-tu déjà perdu connaissance ou eu des vertiges importants pendant ou après un effort ?",
    "As-tu une maladie chronique (diabète, asthme, autre) qui peut être influencée par l'activité physique ?",
    "Prends-tu un traitement médical régulier ?",
    "As-tu une douleur ou une blessure (os, articulation, muscle) qui pourrait s'aggraver avec l'exercice ?",
    "As-tu été opéré(e) au cours des 12 derniers mois ou es-tu enceinte ?",
]

# Formules (par ordre de prix). « prix » : 1, 3, 6 et 12 mois (grille du 28 octobre 2026, voir l'étude des prix).
# « retired » : plus en vente, gardée pour les commandes déjà passées (ses prix restent ceux de l'ancienne grille : 1, 2, 3 mois).
OFFERS = [
    {"id": "ia", "n": "Coach IA", "desc": "Programme standardisé et nutrition, conduits par le coach IA (une intelligence artificielle) : il répond à tes questions, estime tes repas en photo, analyse ton bilan chaque semaine et ajuste ton programme dans des limites de sécurité. Sans réponse personnelle d'Antoine.", "prix": [29, 79, 149, 279], "auto": True},
    {"id": "essentiel", "n": "Essentiel", "desc": "Coach IA + une réponse courte d'Antoine à ton bilan chaque semaine (sous 48 h ouvrées) et la messagerie avec Antoine.", "prix": [59, 159, 299, 569]},
    {"id": "suivi", "n": "Suivi", "desc": "Essentiel + réponse détaillée d'Antoine à chaque bilan (sous 24 h ouvrées), ajustements de ton programme et de tes cibles nutrition, correction vidéo d'un exercice par semaine.", "prix": [119, 319, 599, 1139], "top": True},
    {"id": "surmesure", "n": "Sur mesure", "desc": "Suivi + un programme écrit par Antoine pour ton sport, ton poste et ton calendrier de compétition, réécrit à chaque bloc ; deux corrections vidéo par semaine ; réponses en priorité. Tout se passe par écrit.", "prix": [199, 539, 999, 1899], "places": 5},
    {"id": "hybride", "n": "Hybride", "desc": "Essentiel + 2 séances d'1 h par mois en présentiel avec Antoine (Bordeaux Métropole) : technique, tests et corrections sur place.", "prix": [139, 265, 375], "retired": True},
]
