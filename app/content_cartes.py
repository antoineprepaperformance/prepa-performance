# -*- coding: utf-8 -*-
"""Carte athlète : notes absolues des tests, comparées au record du monde connu.
Chaque test a trois repères : débutant (note 40), haut niveau (note 90) et record du monde (note 99) ;
entre deux repères la note est proportionnelle. « low » = plus petit est meilleur (temps).
Les charges sont ramenées au poids de corps de l'athlète par une échelle allométrique (exposant 0,67, Jaric 2002) :
référence = barre du record × (poids de l'athlète / poids de la catégorie du record) ** 0,67.
Les repères débutant et haut niveau sont des estimations du préparateur (réglables ici) ; le record est sourcé.
« sport » : repère haut niveau spécifique à un sport et un poste (profil.sportId / profil.poste), quand une étude le permet ;
sans ça (sport non traité, ou sexe sans étude trouvée), le repère générique s'applique. Le record du monde (99) ne change jamais :
c'est le même plafond pour tout le monde."""

CARD_REFS = {
    "sprint10": {"a": "vit", "dir": "low", "u": "s", "H": [2.30, 1.82, 1.74], "F": [2.60, 2.02, 1.91],
                 "wr": {"H": "1,74 s : les 10 premiers mètres d'Usain Bolt pendant le record du monde du 100 m (9 s 58, Berlin 2009), temps de réaction retiré",
                        "F": "1,91 s : estimé d'après le record du monde féminin du 100 m (10 s 49, Florence Griffith-Joyner, 1988)"},
                 "sport": {"rugby": {"avant": {"H": [1.85, "1,85 s : moyenne des avants internationaux/académie élite (Wood, Coughlan et Delahunt, 2018)"]},
                                     "trois-quarts": {"H": [1.77, "1,77 s : moyenne des trois-quarts internationaux/académie élite (Wood, Coughlan et Delahunt, 2018)"]}},
                           "rugby7": {"avant": {"H": [1.85, "1,85 s : même repère que le rugby à XV, pas d'étude position par position propre au rugby à 7 (Wood, Coughlan et Delahunt, 2018)"]},
                                      "trois-quarts": {"H": [1.77, "1,77 s : même repère que le rugby à XV (Wood, Coughlan et Delahunt, 2018)"]}}}},
    "sprint30": {"a": "vit", "dir": "low", "u": "s", "H": [5.20, 4.05, 3.63], "F": [5.90, 4.50, 3.98],
                 "wr": {"H": "3,63 s : les 30 premiers mètres d'Usain Bolt pendant le record du monde du 100 m (9 s 58, Berlin 2009), temps de réaction retiré",
                        "F": "3,98 s : estimé d'après le record du monde féminin du 100 m (10 s 49, Florence Griffith-Joyner, 1988)"},
                 "sport": {"bob": {"pousseur": {"H": [4.00, "moins de 4 s aux 30 m : repère des pousseurs de haut niveau (Bobsleigh UK, critères d'athlètes)"]}}}},
    "longueur": {"a": "vit", "dir": "high", "u": "cm", "H": [170, 300, 373], "F": [130, 245, 298],
                 "wr": {"H": "3,73 m : Byron Jones (2015), meilleure marque connue ; record officiel 3,71 m (Arne Tvervaag, 1968)",
                        "F": "2,98 m : aucun record féminin officiel, repère estimé à 80 % du record masculin"}},
    "vma": {"a": "end", "dir": "high", "u": "m", "H": [1200, 1900, 2468], "F": [1000, 1650, 2222],
            "wr": {"H": "2 468 m : 6 minutes à l'allure du record du monde du 3 000 m (7 min 17 s 55, Jakob Ingebrigtsen, 2024)",
                   "F": "2 222 m : 6 minutes à l'allure du record du monde du 3 000 m (8 min 06 s 11, Wang Junxia, 1993)"}},
    "t5km": {"a": "end", "dir": "low", "u": "min", "H": [32, 15, 12.589], "F": [36, 17, 13.968],
             "wr": {"H": "12 min 35 s 36 : Joshua Cheptegei (2020)", "F": "13 min 58 s 06 : Beatrice Chebet (2025)"}},
    "e1rm_squat": {"a": "for", "dir": "high", "u": "kg", "lift": {"H": [302.5, 83], "F": [197.5, 63]}, "frac": [0.22, 0.55, 1],
                   "wr": {"H": "302,5 kg : squat de Joseph Borenstein lors du record du monde du total en 83 kg (890 kg, championnats du monde IPF classique 2025)",
                          "F": "197,5 kg : squat d'Alba Boström lors du record du monde du total en 63 kg (565 kg, championnats du monde IPF classique 2025)"}},
    "e1rm_dc": {"a": "for", "dir": "high", "u": "kg", "lift": {"H": [215, 83], "F": [140, 63]}, "frac": [0.22, 0.55, 1],
                "wr": {"H": "215 kg : record du monde du développé couché en 83 kg (Joseph Borenstein, IPF classique 2025)",
                       "F": "140 kg : développé couché d'Alba Boström lors du record du monde du total en 63 kg (IPF classique 2025)"}},
    "e1rm_sdt": {"a": "for", "dir": "high", "u": "kg", "lift": {"H": [372.5, 83], "F": [227.5, 63]}, "frac": [0.22, 0.55, 1],
                 "wr": {"H": "372,5 kg : soulevé de terre de Joseph Borenstein lors du record du monde du total en 83 kg (IPF classique 2025)",
                        "F": "227,5 kg : soulevé de terre d'Alba Boström lors du record du monde du total en 63 kg (IPF classique 2025)"}},
}
CARD_REFS_SCI = ("Comparer une charge entre athlètes de poids différents se fait avec une échelle allométrique (force proportionnelle au poids de corps "
                 "à la puissance 0,67 ; Jaric, 2002). Records : World Athletics (100 m, 3 000 m, 5 000 m), Helene et Yamashita (temps de passage du 9 s 58), IPF (championnats du monde classique 2025).")
CARD_REFS_REFS = ["Jaric S. Muscle strength testing: use of normalisation for body size. Sports Med. 2002;32(10):615-631.",
                  "Helene O, Yamashita MT. The force, power and energy of the 100 meter sprint. arXiv:0911.1952 (temps de passage de Berlin 2009).",
                  "World Athletics : records du monde du 100 m, du 3 000 m et du 5 000 m (hommes et femmes).",
                  "IPF World Classic Powerlifting Championships 2025 : résultats et records du monde (83 kg hommes, 63 kg femmes).",
                  "Wood DJ, Coughlan GF, Delahunt E. Fitness Profiles of Elite Adolescent Irish Rugby Union Players. J Strength Cond Res. 2018;32(1):105-112 "
                  "(sprint 10 m : avants 1,85 ± 0,07 s, trois-quarts 1,77 ± 0,06 s).",
                  "Bobsleigh UK. Bobsleigh Athlete Requirements (critères indicatifs des pousseurs : moins de 4 s aux 30 m, 200 kg au squat). bobsleigh.uk."]
for _k, _r in CARD_REFS.items():
    assert _r["dir"] in ("low", "high") and _r["a"] in ("vit", "for", "end"), _k
    for _s in ("H", "F"):
        a = _r.get(_s) or _r["frac"]
        assert (a[0] > a[1] > a[2]) if _r["dir"] == "low" else (a[0] < a[1] < a[2]), (_k, _s)
    for _sport, _postes in _r.get("sport", {}).items():
        for _poste, _sexvals in _postes.items():
            for _s, (_v, _src) in _sexvals.items():
                a0, _a1, a2 = _r[_s]
                ok = (a0 > _v > a2) if _r["dir"] == "low" else (a0 < _v < a2)
                assert ok, (_k, _sport, _poste, _s, _v)
CARTES_CONTENT = {"CARDREF": CARD_REFS, "CARDREFSCI": {"text": CARD_REFS_SCI, "refs": CARD_REFS_REFS}}
