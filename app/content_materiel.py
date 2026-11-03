# -*- coding: utf-8 -*-
"""Matériel disponible : ce que le client coche, et ce que demande chaque exercice.

MATERIEL : le matériel proposé au client (« salle » = salle de sport complète, tout est disponible).
EQ_REQ : pour chaque texte « eq » d'un exercice (content_exercises.py, content_sports.py), le matériel nécessaire.
  ""          : rien de spécial (poids du corps, sol, mur, chaise, plots, partenaire…)
  "a+b"       : a ET b
  "a+b|c"     : (a ET b) OU c
Un exercice impossible avec le matériel du client est remplacé par sa variante (alt), puis par un exercice
au poids du corps de la même catégorie (src/27_materiel.js).
"""

MATERIEL = [
    {"id": "salle", "n": "Salle de sport complète", "d": "Machines, poulies, barres, haltères : tout est possible."},
    {"id": "barre", "n": "Barre et disques", "d": "Avec un cadre ou des supports de squat."},
    {"id": "halteres", "n": "Haltères"},
    {"id": "kettlebell", "n": "Kettlebell"},
    {"id": "banc", "n": "Banc de musculation"},
    {"id": "traction", "n": "Barre de traction"},
    {"id": "elastique", "n": "Élastiques"},
    {"id": "box", "n": "Box ou plateforme stable (30 à 60 cm)"},
    {"id": "medecine_ball", "n": "Médecine-ball"},
    {"id": "velo_rameur", "n": "Machine de cardio", "d": "Tapis de course, vélo, rameur ou elliptique."},
    {"id": "traineau", "n": "Traîneau ou prowler"},
    {"id": "terrain", "n": "Terrain, piste, parc ou côte", "d": "Un espace dehors pour courir et sprinter."},
]
MAT_PRESETS = [
    {"id": "salle", "n": "Salle de sport", "m": ["salle", "terrain"]},
    {"id": "maison_rien", "n": "Maison, sans matériel", "m": ["terrain"]},
    {"id": "maison_equipee", "n": "Maison équipée", "m": ["halteres", "kettlebell", "elastique", "traction", "banc", "terrain"]},
]

EQ_REQ = {
    # rien de spécial
    "Aucun": "", "Assis": "", "Poids du corps": "", "Sol": "", "Tapis": "", "Mur": "", "Mur ou appui": "", "Chaise stable": "",
    "Marche": "", "Sol ou coussin": "", "Corde": "", "Rouleau": "", "Serviette ou disques glissants": "", "Main ou élastique": "",
    "Partenaire ou point d'ancrage": "", "Plots": "", "5 plots": "", "6 plots": "", "5 balles ou plots": "", "Bases ou plots": "",
    "Échelle ou lignes au sol": "", "Mini-haies ou cônes": "", "Box ou chaise": "", "Box ou marche": "", "Banc ou table": "",
    "Haltères ou poids du corps": "", "Barre de traction ou sol": "", "Sol ou banc incliné": "", "Barres parallèles ou banc": "",
    "Marche + haltère": "halteres|kettlebell",
    # extérieur et terrains
    "Extérieur": "terrain", "Terrain": "terrain", "Terrain + cônes": "terrain", "Terrain + partenaire": "terrain", "Lignes du terrain": "terrain",
    "Terrain de basket": "terrain", "Terrain de foot": "terrain", "Terrain de hand": "terrain", "Piste ou extérieur": "terrain", "Côte": "terrain",
    "Plots, bouclier facultatif": "terrain", "Filet": "terrain", "Mini-haies": "terrain",
    # matériel
    "Barre": "barre", "Barre + coin": "barre", "Barre + élastique": "traction+elastique", "Barre légère ou haltères": "barre|halteres",
    "Barre ou haltères": "barre|halteres", "Barre et cadre de squat": "barre", "Barre et banc incliné": "barre+banc", "Banc + barre": "barre+banc",
    "Barre en landmine, poignée en V": "barre", "Trap bar (barre hexagonale)": "salle", "Roulette ou barre": "barre|salle",
    "Barre de traction": "traction", "Barre à poignées parallèles": "traction", "Barre de traction, 2 serviettes": "traction",
    "Barre basse ou sangles": "barre",
    "Haltère": "halteres", "Haltère léger": "", "Haltères": "halteres", "Haltère ou kettlebell": "halteres|kettlebell",
    "Haltères ou kettlebells": "halteres|kettlebell", "Haltères ou élastique": "halteres|elastique", "Kettlebell": "kettlebell",
    "Banc": "banc", "Haltère + banc ou chaise": "halteres", "Banc + haltères": "banc+halteres", "Banc incliné + haltères": "banc+halteres", "Banc et box": "banc+box",
    "Box": "box", "Box 30 cm": "box",
    "Élastique": "elastique", "Élastique épais": "elastique", "Élastique ou poulie": "elastique", "Mini-bande": "elastique",
    "Poulie ou élastique": "elastique", "Poulie, haltère ou élastique": "halteres|elastique",
    "Machine": "salle", "Machine cardio": "velo_rameur", "Vélo ou rameur": "velo_rameur",
    "Médecine-ball": "medecine_ball", "Médecine-ball 2-4 kg": "medecine_ball", "Médecine-ball 4 à 6 kg": "medecine_ball", "Médecine-ball 6 kg": "medecine_ball",
    "Traîneau (prowler)": "traineau", "Traîneau ou élastique": "traineau|elastique", "Luge à roues ou traîneau": "traineau",
    "Mur, partenaire ou traîneau": "",
}

# remplaçants choisis par le préparateur : même geste et même effet d'entraînement, du plus proche au plus simple.
# Le premier faisable avec le matériel du client est retenu ; sinon la variante (alt), puis le secours par catégorie.
MAT_SUBST = {
    # bas du corps : on garde le geste (squat, fente), en unilatéral quand la charge manque
    "squat_barre": ["squat_goblet", "split_squat", "squat_unipodal_box", "fente_arriere"],
    "squat_avant": ["squat_goblet", "split_squat", "squat_unipodal_box", "fente_arriere"],
    "squat_goblet": ["split_squat", "fente_arriere"],
    "presse": ["squat_goblet", "split_squat", "fente_arriere"],
    "split_squat": ["fente_arriere"],
    "squat_unipodal_box": ["step_up", "fente_arriere"],
    "mollets": ["mollets_unipodal"],
    # chaîne postérieure : charnière de hanche, puis ischios et fessiers au poids du corps
    "sdt": ["trap_bar", "sdt_kb", "sdt_roumain", "sdt_jambe", "pont_unipodal"],
    "sdt_sumo": ["sdt_kb", "sdt_roumain", "pont_unipodal"],
    "trap_bar": ["sdt", "sdt_kb", "sdt_roumain", "sdt_jambe", "pont_unipodal"],
    "sdt_roumain": ["sdt_jambe", "sdt_kb", "leg_curl_glisse"],
    "sdt_jambe": ["sdt_roumain", "leg_curl_glisse", "pont_unipodal"],
    "sdt_kb": ["sdt_roumain", "sdt_jambe", "pont_unipodal"],
    "good_morning": ["sdt_roumain", "sdt_jambe", "leg_curl_glisse"],
    "hip_thrust": ["pont_unipodal", "pont_fessier"],
    "kb_swing": ["saut_longueur", "cmj"],
    # poussée
    "dc_barre": ["dc_halteres", "floor_press", "pompes_pieds", "pompes"],
    "dc_halteres": ["dc_barre", "floor_press", "pompes_pieds", "pompes"],
    "dc_incline": ["dc_incline_barre", "pompes_pieds", "pompes"],
    "dc_incline_barre": ["dc_incline", "pompes_pieds", "pompes"],
    "floor_press": ["dc_halteres", "pompes"],
    "pompes_pieds": ["pompes"],
    "dm": ["dm_halteres", "landmine_press", "pompes_pieds", "pompes"],
    "dm_halteres": ["dm", "landmine_press", "pompes_pieds", "pompes"],
    "landmine_press": ["dm_halteres", "pompes_pieds", "pompes"],
    "jete_pousse": ["dm_halteres", "lancer_medball_dessus", "pompes_plio"],
    "jerk": ["jete_pousse", "dm_halteres", "lancer_medball_dessus", "pompes_plio"],
    "extension_triceps": ["dips_chaise"],
    "elevations_laterales": ["y_t_w"],
    # tirage
    "tractions": ["tractions_assist", "rowing_inverse", "tirage_elastique", "y_t_w"],
    "tractions_assist": ["tirage_elastique", "rowing_inverse", "tractions", "y_t_w"],
    "tractions_neutre": ["tractions", "rowing_inverse", "tirage_elastique", "y_t_w"],
    "tractions_serviette": ["tractions", "rowing_inverse", "tirage_elastique", "y_t_w"],
    "tirage_vertical": ["tractions_assist", "tractions", "tirage_elastique", "rowing_inverse", "y_t_w"],
    "rowing_barre": ["rowing_haltere", "rowing_inverse", "tirage_elastique", "y_t_w"],
    "rowing_pendlay": ["rowing_barre", "rowing_haltere", "rowing_inverse", "tirage_elastique", "y_t_w"],
    "rowing_tbar": ["rowing_barre", "rowing_haltere", "rowing_inverse", "tirage_elastique", "y_t_w"],
    "rowing_haltere": ["rowing_barre", "rowing_inverse", "tirage_elastique", "y_t_w"],
    "rowing_inverse": ["tirage_elastique", "rowing_haltere", "y_t_w"],
    "tirage_elastique": ["rowing_haltere", "rowing_inverse", "y_t_w"],
    "face_pull": ["y_t_w"],
    "curl": ["tirage_elastique", "rowing_inverse", "y_t_w"],
    # tronc
    "pallof": ["planche_laterale"],
    "portage_valise": ["planche_laterale"],
    "farmer_walk": ["portage_valise", "planche_epaules"],
    "rollout": ["planche_epaules", "planche"],
    # haltérophilie : triple extension explosive, puis saut
    "epaule_suspension": ["epaule_haltere", "kb_swing", "cmj"],
    "arrache_suspension": ["arrache_haltere", "kb_swing", "cmj"],
    "tirage_epaule": ["epaule_haltere", "kb_swing", "cmj"],
    "mi_cuisse": ["kb_swing", "epaule_haltere", "cmj"],
    "epaule_haltere": ["epaule_suspension", "kb_swing", "cmj"],
    "arrache_haltere": ["arrache_suspension", "kb_swing", "cmj"],
    "trap_bar_dyn": ["squat_saute_barre", "kb_swing", "squat_saute"],
    "squat_saute_barre": ["squat_saute", "cmj"],
    # pliométrie
    "box_jump": ["cmj"], "box_jump_assis": ["box_jump", "cmj"], "drop_jump": ["pogo"],
    "med_ball_lancer": ["pompes_plio", "pompes"], "med_ball_rotation": ["pallof", "planche_laterale"],
    "mb_arriere": ["kb_swing", "saut_longueur", "cmj"], "mb_melee": ["med_ball_lancer", "pompes_plio"],
    "lancer_medball_dessus": ["pompes_plio"], "sauts_haies": ["pogo"], "bonds": ["fentes_sautees"], "saut_longueur": ["cmj"],
    "attaques_repetees": ["cmj"],
    # vitesse et appuis sans terrain : ce qui reste possible sur place
    "sprint_resiste": ["montees", "acc_10", "montees_genoux"], "depart_pousse": ["sprint_resiste", "acc_10", "montees_genoux"],
    "gammes": ["montees_genoux"], "acc_10": ["montees_genoux"], "acc_20": ["montees_genoux"], "sprint_30": ["montees_genoux"],
    "sprint_lance": ["montees_genoux"], "depart_3appuis": ["montees_genoux"], "montees": ["montees_genoux"],
    "cod_505": ["echelle"], "decel": ["echelle"], "reactif": ["echelle"], "shuffle": ["echelle"], "contres_filet": ["echelle"],
    "pas_defensifs_elastique": ["shuffle", "echelle"],
    # cardio : sur machine quand on ne peut pas courir dehors, et dehors quand il n'y a pas de machine
    "velo_intervalles": ["intermittent_3030", "burpees"], "rameur": ["marche_rapide", "marche_place"], "marche_rapide": ["rameur", "marche_place"],
    "intermittent_1515": ["velo_intervalles", "burpees"], "intermittent_3030": ["velo_intervalles", "burpees"], "navette": ["velo_intervalles", "burpees"],
    "rsa": ["velo_intervalles", "montees_genoux"], "malcolm": ["velo_intervalles", "burpees"], "rhie": ["velo_intervalles", "burpees"],
    "box_to_box": ["velo_intervalles", "burpees"], "contre_attaque": ["velo_intervalles", "burpees"], "seventeens": ["velo_intervalles", "burpees"], "suicides": ["velo_intervalles", "burpees"],
    "circuit_kb": ["thruster", "burpees"], "thruster": ["burpees"], "poussee_traineau": ["fente_marchee"],
    "footing_ef": ["rameur", "marche_place"], "sortie_longue": ["rameur", "marche_place"], "marche_course": ["rameur", "marche_place"],
    "fractionne_court": ["velo_intervalles", "montees_genoux"], "fractionne_long": ["velo_intervalles", "montees_genoux"], "tempo": ["velo_intervalles", "rameur"],
    "lignes_droites": ["velo_intervalles", "montees_genoux"], "cotes_longues": ["velo_intervalles", "rameur"],
    # prévention
    "copenhague": ["fente_laterale"], "rotateurs": ["y_t_w"], "rotateurs_90": ["y_t_w"], "spanish_squat": ["chaise"], "flexion_hanche_elastique": ["montees_genoux"],
}

# exercice de secours au poids du corps, par catégorie (et par geste pour le haut du corps)
MAT_FALLBACK = {
    "Bas du corps": "squat_pdc", "Chaîne postérieure": "pont_fessier", "Haut du corps": "pompes", "Haut du corps/tirage": "superman",
    "Tronc": "planche", "Haltérophilie": "squat_saute", "Pliométrie": "squat_saute", "Vitesse": "montees_genoux", "Agilité": "montees_genoux",
    "Conditionnement": "burpees", "Course": "marche_place", "Prévention": "y_t_w", "Force": "chaise",
}

MATERIEL_CONTENT = {"MATERIEL": MATERIEL, "MAT_PRESETS": MAT_PRESETS, "EQREQ": EQ_REQ, "MATSUB": MAT_SUBST, "MATFB": MAT_FALLBACK}


def _verifie():
    """Le build s'arrête si un exercice a un matériel non classé ou si un remplaçant n'existe pas."""
    from content_exercises import LIB
    from content_sports import EX_SPORT
    tous = LIB + EX_SPORT
    ids = {e["id"] for e in tous}
    manque = sorted({e["eq"] for e in tous if e["eq"] not in EQ_REQ})
    assert not manque, "Matériel à classer dans EQ_REQ (content_materiel.py) : %s" % manque
    inconnus = [v for k, vs in MAT_SUBST.items() for v in [k] + vs if v not in ids] + [v for v in MAT_FALLBACK.values() if v not in ids]
    assert not inconnus, "Exercices inconnus dans MAT_SUBST ou MAT_FALLBACK : %s" % inconnus


_verifie()
