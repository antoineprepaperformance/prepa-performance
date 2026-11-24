# -*- coding: utf-8 -*-
"""Carte athlète : notes absolues des tests, comparées au record du monde connu.
Chaque test a trois repères : débutant (note 40), haut niveau (note 90) et record du monde (note 99) ;
entre deux repères la note est proportionnelle. « low » = plus petit est meilleur (temps).
Les charges sont ramenées au poids de corps de l'athlète par une échelle allométrique (exposant 0,67, Jaric 2002) :
référence = barre du record × (poids de l'athlète / poids de la catégorie du record) ** 0,67.
Les repères débutant et haut niveau sont des estimations du préparateur (réglables ici) ; le record est sourcé.

« sport » : repère propre à un sport, au poste du client (profil.sportId / profil.poste) ou à tout le sport
(clé « * »), quand une étude le permet. Valeur : un nombre, ou pour un test de charge le couple
[barre de l'étude, poids de corps moyen de l'étude], ramené au poids du client par la même échelle
allométrique. Troisième élément facultatif : le nom du palier (sinon « Haut niveau »).
Sans repère de sport, le repère générique s'applique. Le record du monde (99) ne change jamais.

RÈGLE : un repère ne se met sur l'échelle que s'il est mesuré DE LA MÊME FAÇON que le test du client.
Les repères de sprint par poste ont été retirés pour cette raison : les études chronomètrent au portique
avec un départ 0,5 m derrière la cellule, et Haugen, Tønnessen et Seiler (2012) mesurent 0,17 à 0,69 s
d'écart selon la méthode de départ et de déclenchement (par rapport à un départ bloc au pistolet) —
plus que tout l'écart entre un joueur de club et le record du monde sur 10 m ; un avant d'académie « à 1,85 s » apparaissait
donc presque au niveau du record du monde (1,74 s), ce qui est faux et rendait la règle illisible (deux
paliers superposés). Les tests de charge, eux, se mesurent partout de la même façon (3 à 5 répétitions,
maximum estimé par formule) : les repères par poste y sont valables."""

CARD_REFS = {
    "sprint10": {"a": "vit", "dir": "low", "u": "s", "H": [2.30, 1.82, 1.74], "F": [2.60, 2.02, 1.91],
                 "nom": {"H": ["Usain Bolt", ""], "F": ["Florence Griffith-Joyner", "estimé"]}, "wr": {"H": "1,74 s : les 10 premiers mètres d'Usain Bolt pendant le record du monde du 100 m (9 s 58, Berlin 2009), temps de réaction retiré",
                        "F": "1,91 s : estimé d'après le record du monde féminin du 100 m (10 s 49, Florence Griffith-Joyner, 1988)"}},
    "sprint30": {"a": "vit", "dir": "low", "u": "s", "H": [5.20, 4.05, 3.63], "F": [5.90, 4.50, 3.98],
                 "nom": {"H": ["Usain Bolt", ""], "F": ["Florence Griffith-Joyner", "estimé"]}, "wr": {"H": "3,63 s : les 30 premiers mètres d'Usain Bolt pendant le record du monde du 100 m (9 s 58, Berlin 2009), temps de réaction retiré",
                        "F": "3,98 s : estimé d'après le record du monde féminin du 100 m (10 s 49, Florence Griffith-Joyner, 1988)"}},
    "longueur": {"a": "vit", "dir": "high", "u": "cm", "H": [170, 300, 373], "F": [130, 245, 298],
                 "nom": {"H": ["Byron Jones", ""], "F": ["", "estimé, aucun record officiel"]}, "wr": {"H": "3,73 m : Byron Jones (2015), meilleure marque connue ; record officiel 3,71 m (Arne Tvervaag, 1968)",
                        "F": "2,98 m : aucun record féminin officiel, repère estimé à 80 % du record masculin"}},
    "vma": {"a": "end", "dir": "high", "u": "m", "H": [1200, 1900, 2468], "F": [1000, 1650, 2222],
            "nom": {"H": ["Jakob Ingebrigtsen", "allure de son record du 3 000 m"], "F": ["Wang Junxia", "allure de son record du 3 000 m"]}, "wr": {"H": "2 468 m : 6 minutes à l'allure du record du monde du 3 000 m (7 min 17 s 55, Jakob Ingebrigtsen, 2024)",
                   "F": "2 222 m : 6 minutes à l'allure du record du monde du 3 000 m (8 min 06 s 11, Wang Junxia, 1993)"}},
    "t5km": {"a": "end", "dir": "low", "u": "min", "H": [32, 15, 12.589], "F": [36, 17, 13.968],
             "nom": {"H": ["Joshua Cheptegei", ""], "F": ["Beatrice Chebet", ""]}, "wr": {"H": "12 min 35 s 36 : Joshua Cheptegei (2020)", "F": "13 min 58 s 06 : Beatrice Chebet (2025)"}},
    "e1rm_squat": {"a": "for", "dir": "high", "u": "kg", "lift": {"H": [302.5, 83], "F": [197.5, 63]}, "frac": [0.22, 0.55, 1],
                   "nom": {"H": ["Joseph Borenstein", ""], "F": ["Alba Boström", ""]}, "wr": {"H": "302,5 kg : squat de Joseph Borenstein lors du record du monde du total en 83 kg (890 kg, championnats du monde IPF classique 2025)",
                          "F": "197,5 kg : squat d'Alba Boström lors du record du monde du total en 63 kg (565 kg, championnats du monde IPF classique 2025)"},
                   "sport": {"rugby": {"avant": {"H": [[233.33, 100.7], "233 kg pour 101 kg de poids de corps : moyenne des avants de l'équipe nationale du Portugal (Vaz et coll., 2014), mesurée comme ce test (3 à 5 répétitions, maximum estimé) et ramenée à ton poids", "Moyenne des internationaux"]},
                                       "trois-quarts": {"H": [[202.36, 88.0], "202 kg pour 88 kg de poids de corps : moyenne des trois-quarts de l'équipe nationale du Portugal (Vaz et coll., 2014), mesurée comme ce test (3 à 5 répétitions, maximum estimé) et ramenée à ton poids", "Moyenne des internationaux"]}}}},
    "e1rm_dc": {"a": "for", "dir": "high", "u": "kg", "lift": {"H": [215, 83], "F": [140, 63]}, "frac": [0.22, 0.55, 1],
                "nom": {"H": ["Joseph Borenstein", ""], "F": ["Alba Boström", ""]}, "wr": {"H": "215 kg : record du monde du développé couché en 83 kg (Joseph Borenstein, IPF classique 2025)",
                       "F": "140 kg : développé couché d'Alba Boström lors du record du monde du total en 63 kg (IPF classique 2025)"},
                "sport": {"rugby": {"avant": {"H": [[109.45, 100.7], "109 kg pour 101 kg de poids de corps : moyenne des avants de l'équipe nationale du Portugal (Vaz et coll., 2014), mesurée comme ce test et ramenée à ton poids", "Moyenne des internationaux"]},
                                    "trois-quarts": {"H": [[98.33, 88.0], "98 kg pour 88 kg de poids de corps : moyenne des trois-quarts de l'équipe nationale du Portugal (Vaz et coll., 2014), mesurée comme ce test et ramenée à ton poids", "Moyenne des internationaux"]}}}},
    "e1rm_sdt": {"a": "for", "dir": "high", "u": "kg", "lift": {"H": [372.5, 83], "F": [227.5, 63]}, "frac": [0.22, 0.55, 1],
                 "nom": {"H": ["Joseph Borenstein", ""], "F": ["Alba Boström", ""]}, "wr": {"H": "372,5 kg : soulevé de terre de Joseph Borenstein lors du record du monde du total en 83 kg (IPF classique 2025)",
                        "F": "227,5 kg : soulevé de terre d'Alba Boström lors du record du monde du total en 63 kg (IPF classique 2025)"}},
}
CARD_REFS_SCI = ("Comparer une charge entre athlètes de poids différents se fait avec une échelle allométrique (force proportionnelle au poids de corps "
                 "à la puissance 0,67 ; Jaric, 2002). Records : World Athletics (100 m, 3 000 m, 5 000 m), Helene et Yamashita (temps de passage du 9 s 58), IPF (championnats du monde classique 2025). "
                 "Un repère par poste n'est affiché que si l'étude le mesure comme le test de l'appli : c'est le cas des charges (3 à 5 répétitions, maximum estimé), pas des sprints au portique.")
CARD_REFS_REFS = ["Jaric S. Muscle strength testing: use of normalisation for body size. Sports Med. 2002;32(10):615-631.",
                  "Helene O, Yamashita MT. The force, power and energy of the 100 meter sprint. arXiv:0911.1952 (temps de passage de Berlin 2009).",
                  "World Athletics : records du monde du 100 m, du 3 000 m et du 5 000 m (hommes et femmes).",
                  "IPF World Classic Powerlifting Championships 2025 : résultats et records du monde (83 kg hommes, 63 kg femmes).",
                  "Vaz L, Morais T, Rocha H, James N. Fitness profiles of elite Portuguese rugby union players. J Hum Kinet. 2014;41:235-244 "
                  "(avants n = 24 : 100,7 kg, squat 233,3 kg, développé couché 109,5 kg ; trois-quarts n = 22 : 88,0 kg, squat 202,4 kg, développé couché 98,3 kg ; maximum estimé à partir de 3 à 5 répétitions).",
                  "Haugen TA, Tønnessen E, Seiler SK. The difference is in the start: impact of timing and start procedure on sprint running performance. "
                  "J Strength Cond Res. 2012;26(2):473-479 (un départ arrêté derrière la cellule donne des temps 0,17 à 0,69 s plus rapides qu'un départ bloc au pistolet : "
                  "c'est pourquoi aucun repère de sprint tiré d'une étude au portique n'est posé sur la règle)."]
for _k, _r in CARD_REFS.items():
    assert _r["dir"] in ("low", "high") and _r["a"] in ("vit", "for", "end"), _k
    for _s in ("H", "F"):
        a = _r.get(_s) or _r["frac"]
        assert (a[0] > a[1] > a[2]) if _r["dir"] == "low" else (a[0] < a[1] < a[2]), (_k, _s)
    for _sport, _postes in _r.get("sport", {}).items():
        for _poste, _sexvals in _postes.items():
            for _s, _e in _sexvals.items():
                _v = _e[0]
                assert len(_e) >= 2 and _e[1], (_k, _sport, _poste, _s, "source manquante")
                if _r.get("lift"):
                    _kg, _bm = _v                       # barre de l'étude, poids de corps moyen de l'étude
                    _wr, _cls = _r["lift"][_s]
                    _f = _kg / (_wr * (_bm / _cls) ** 0.67)   # le repère, en fraction du record ramené à ce poids
                    assert _r["frac"][0] < _f < 1, (_k, _sport, _poste, _s, round(_f, 3))
                else:
                    a0, _a1, a2 = _r[_s]
                    ok = (a0 > _v > a2) if _r["dir"] == "low" else (a0 < _v < a2)
                    assert ok, (_k, _sport, _poste, _s, _v)
CARTES_CONTENT = {"CARDREF": CARD_REFS, "CARDREFSCI": {"text": CARD_REFS_SCI, "refs": CARD_REFS_REFS}}
