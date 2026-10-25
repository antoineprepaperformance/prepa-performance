# -*- coding: utf-8 -*-
"""Valeurs nutritionnelles : table Ciqual de l'ANSES (data/ciqual.json, produite par tools/ciqual.py).

- FOODS : aliments courants proposés en premier dans la saisie d'un repas, avec leur portion habituelle.
  Chaque ligne : [nom affiché, code Ciqual ou None, portion en g, valeurs de secours pour 100 g (kcal, P, G, L)].
  Les valeurs viennent de la table Ciqual ; les valeurs de secours ne servent qu'aux produits absents de la table
  (skyr, whey, lait de coco allégé : valeurs moyennes d'étiquettes).
- ING_CIQUAL : code Ciqual de chaque ingrédient des recettes (content_recettes.ING), à l'état cru quand il est pesé cru.
À l'import, les valeurs de FOODS et des ingrédients sont recalculées depuis la table : l'application les recharge
aussi au démarrage depuis ciqual.json (mis à jour chaque mois sur le site par le robot GitHub)."""
import json, pathlib
from content_recettes import ING

ROOT = pathlib.Path(__file__).parent
CIQ = json.loads((ROOT / "data" / "ciqual.json").read_text(encoding="utf-8"))
BY = {f[0]: f for f in CIQ["f"]}

FOODS_SRC = [
    ["Riz blanc cuit", 9104, 150], ["Riz complet cuit", 9103, 150], ["Pâtes cuites", 9811, 200], ["Pâtes complètes cuites", 9871, 200],
    ["Semoule cuite", 9683, 150], ["Quinoa cuit", 9341, 150], ["Pommes de terre à l'eau", 4003, 200], ["Patate douce cuite", 4102, 200],
    ["Frites", 4032, 150], ["Pain (baguette)", 7001, 50], ["Pain complet", 7110, 50], ["Flocons d'avoine", 32140, 50],
    ["Lentilles cuites", 20360, 150], ["Pois chiches cuits", 20507, 150], ["Haricots rouges cuits", 20503, 150], ["Céréales du petit-déjeuner", 32003, 40], ["Muesli", 32004, 50],
    ["Blanc de poulet cuit", 36018, 150], ["Escalope de dinde cuite", 36306, 130], ["Steak haché 5 % cuit", 6251, 100], ["Steak haché 15 % cuit", 6255, 100],
    ["Bœuf (rumsteck) cuit", 6207, 150], ["Saumon cuit", 25996, 120], ["Thon au naturel", 26039, 100], ["Cabillaud cuit", 25997, 150], ["Sardines à l'huile égouttées", 26034, 80],
    ["Œuf (1 œuf ≈ 55 g)", 22000, 55], ["Jambon blanc (1 tranche ≈ 40 g)", 28900, 40], ["Tofu nature", 20904, 100], ["Whey (poudre)", None, 30, [380, 78, 7, 5]],
    ["Fromage blanc 0 %", 19644, 100], ["Fromage blanc 3 %", 19646, 100], ["Skyr nature", None, 150, [64, 11, 4, 0.2]], ["Yaourt nature", 19593, 125], ["Yaourt à la grecque", 19860, 150],
    ["Lait demi-écrémé", 19033, 250], ["Emmental", 12115, 30], ["Mozzarella", 19590, 60],
    ["Brocolis cuits", 20351, 150], ["Haricots verts cuits", 20030, 150], ["Courgettes cuites", 20021, 150], ["Carottes", 20009, 100], ["Tomates", 20276, 120],
    ["Salade verte", 25604, 50], ["Légumes poêlés", 20262, 200], ["Banane", 13005, 120], ["Pomme", 13039, 150], ["Orange", 13034, 150],
    ["Fruits rouges", 13997, 125], ["Avocat (½ ≈ 80 g)", 13004, 80], ["Dattes", 13011, 30],
    ["Huile d'olive (1 c. à soupe ≈ 10 g)", 17270, 10], ["Beurre", 16400, 10], ["Beurre de cacahuète", 15202, 20], ["Amandes", 15000, 30], ["Noix", 15005, 30],
    ["Chocolat noir 70 %", 31074, 20], ["Confiture", 31083, 20], ["Miel", 31008, 15], ["Sucre", 31016, 5],
    ["Pizza margherita", 25404, 300], ["Sandwich jambon-beurre", 25517, 250], ["Burger classique", 25413, 220], ["Lasagnes", 25081, 300],
    ["Croissant", 7603, 60], ["Pain au chocolat", 7730, 70], ["Barre de céréales", 31113, 25], ["Chips", 4004, 30],
    ["Jus d'orange", 2070, 200], ["Soda type cola", 18018, 330], ["Bière", 5001, 250], ["Vin rouge", 5214, 125],
]

ING_CIQUAL = {
    "poulet": 36017, "dinde": 36304, "boeuf5": 6250, "jambon": 28900, "saumon": 26036, "cabillaud": 26043, "thon": 26039, "crevettes": 10086,
    "oeuf": 22000, "fromage_blanc": 19644, "yaourt_grec": 19860, "lait": 19033, "feta": 12066, "mozzarella": 19590, "parmesan": 12120,
    "emmental": 12118, "beurre": 16400, "tofu": 20904, "boisson_soja": 18900, "lentilles": 20359, "pois_chiches": 20532, "haricots_rouges": 20524,
    "avoine": 32140, "riz": 9100, "pates": 9810, "pates_completes": 9870, "quinoa": 9340, "patate_douce": 4101, "pdt": 4008, "pain_complet": 7110,
    "galette": 7815, "banane": 13005, "pomme": 13039, "fruits_rouges": 13997, "dattes": 13011, "citron": 13009, "brocoli": 20057, "epinards": 20059,
    "courgette": 20020, "poivron": 20041, "tomate": 20276, "carotte": 20009, "oignon": 20034, "champignons": 20056, "haricots_verts": 20061,
    "concombre": 20019, "salade": 25604, "avocat": 13004, "mais": 20066, "sauce_tomate": 20260, "huile_olive": 17270, "amandes": 15000,
    "noix": 15005, "beurre_cacahuete": 15202, "chia": 15047, "miel": 31008, "cacao": 18100, "sauce_soja": 11104, "pesto": 11179,
    "epices": 11081, "curry": 11005, "ail": 11000,
}


def vals(code):
    """(kcal, protéines, glucides, lipides) pour 100 g depuis la table ; None si le code ou l'énergie manquent."""
    f = BY.get(code)
    if not f or f[3] is None:
        return None
    return [f[3], f[4] or 0, f[5] or 0, f[6] or 0]


FOODS = []
for row in FOODS_SRC:
    name, code, portion = row[0], row[1], row[2]
    v = vals(code) if code else None
    if code and not v:
        raise SystemExit("Code Ciqual introuvable ou sans énergie : %s (%s)" % (code, name))
    FOODS.append([name] + (v or row[3]) + [portion, code])

for k, code in ING_CIQUAL.items():
    if k not in ING:
        raise SystemExit("Ingrédient inconnu : " + k)
    v = vals(code)
    if not v:
        raise SystemExit("Code Ciqual introuvable ou sans énergie : %s (%s)" % (code, k))
    d = ING[k]
    d[1:5] = v
    if len(d) == 7:
        d.append(code)
    else:
        d[7] = code

NUTRI_CONTENT = {"FOODS": FOODS, "CIQ": {"v": CIQ["v"], "date": CIQ["date"], "src": CIQ["src"], "n": len(CIQ["f"])}}
