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

# Plats types proposés dans « Saisir un repas » : une portion habituelle, les valeurs de chaque élément viennent de
# la table Ciqual (plats composés de l'ANSES, ou assiette composée d'aliments). Catégories : matin (petit-déjeuner),
# sport (assiettes de sportif), plat (plats du quotidien), pouce (sur le pouce, restaurant), collation.
SKYR, WHEY = [64, 11, 4, 0.2], [380, 78, 7, 5]
HUILE = ["Huile d'olive", 17270, 10]
PLATS_SRC = [
    ["matin", "Porridge flocons d'avoine, lait et banane", [["Flocons d'avoine", 32140, 60], ["Lait demi-écrémé", 19033, 250], ["Banane", 13005, 120]]],
    ["matin", "Fromage blanc, muesli et fruits rouges", [["Fromage blanc 3 %", 19646, 200], ["Muesli", 32004, 40], ["Fruits rouges", 13997, 100]]],
    ["matin", "Omelette, pain complet et orange", [["Omelette nature (3 œufs)", 22500, 150], ["Pain complet", 7110, 60], ["Orange", 13034, 150]]],
    ["matin", "Tartines beurre-confiture et yaourt", [["Pain (baguette)", 7001, 80], ["Beurre", 16400, 10], ["Confiture", 31083, 30], ["Yaourt nature", 19593, 125]]],
    ["matin", "Pain complet, beurre de cacahuète et banane", [["Pain complet", 7110, 70], ["Beurre de cacahuète", 15202, 20], ["Banane", 13005, 120]]],
    ["matin", "Skyr, flocons d'avoine et miel", [["Skyr nature", None, 170, SKYR], ["Flocons d'avoine", 32140, 40], ["Miel", 31008, 15]]],
    ["matin", "Bol de céréales et lait", [["Céréales du petit-déjeuner", 32003, 50], ["Lait demi-écrémé", 19033, 250]]],
    ["matin", "Croissant et jus d'orange", [["Croissant", 7603, 60], ["Jus d'orange", 2070, 200]]],
    ["collation", "Skyr et pomme", [["Skyr nature", None, 150, SKYR], ["Pomme", 13039, 150]]],
    ["collation", "Banane et amandes", [["Banane", 13005, 120], ["Amandes", 15000, 25]]],
    ["collation", "Shaker whey au lait et banane", [["Whey (poudre)", None, 30, WHEY], ["Lait demi-écrémé", 19033, 250], ["Banane", 13005, 120]]],
    ["collation", "Yaourt à la grecque, miel et noix", [["Yaourt à la grecque", 19860, 150], ["Miel", 31008, 10], ["Noix", 15005, 20]]],
    ["collation", "Fromage blanc 0 % et dattes", [["Fromage blanc 0 %", 19644, 200], ["Dattes", 13011, 30]]],
    ["collation", "Barre de céréales et pomme", [["Barre de céréales", 31113, 25], ["Pomme", 13039, 150]]],
    ["sport", "Poulet, riz et brocolis", [["Blanc de poulet cuit", 36018, 150], ["Riz blanc cuit", 9104, 200], ["Brocolis cuits", 20351, 150], HUILE]],
    ["sport", "Saumon, patate douce et haricots verts", [["Saumon cuit", 25996, 130], ["Patate douce cuite", 4102, 250], ["Haricots verts cuits", 20030, 150]]],
    ["sport", "Steak haché 5 %, pâtes complètes et légumes", [["Steak haché 5 % cuit", 6251, 125], ["Pâtes complètes cuites", 9871, 200], ["Légumes poêlés", 20262, 150]]],
    ["sport", "Dinde, quinoa et courgettes", [["Escalope de dinde cuite", 36306, 130], ["Quinoa cuit", 9341, 180], ["Courgettes cuites", 20021, 150], HUILE]],
    ["sport", "Cabillaud, pommes de terre et carottes", [["Cabillaud cuit", 25997, 160], ["Pommes de terre à l'eau", 4003, 250], ["Carottes", 20009, 100], HUILE]],
    ["sport", "Bœuf, riz et haricots verts", [["Bœuf (rumsteck) cuit", 6207, 150], ["Riz blanc cuit", 9104, 200], ["Haricots verts cuits", 20030, 150]]],
    ["sport", "Pâtes au thon et à la tomate", [["Pâtes cuites", 9811, 220], ["Thon au naturel", 26039, 100], ["Coulis de tomate", 20260, 80], HUILE]],
    ["sport", "Bowl lentilles, riz complet et légumes (végétarien)", [["Lentilles cuites", 20360, 150], ["Riz complet cuit", 9103, 120], ["Légumes poêlés", 20262, 150], HUILE]],
    ["sport", "Tofu sauté, riz et légumes (végétarien)", [["Tofu nature", 20904, 150], ["Riz blanc cuit", 9104, 180], ["Légumes poêlés", 20262, 150], HUILE]],
    ["sport", "Omelette, pommes de terre et salade", [["Omelette nature (3 œufs)", 22500, 160], ["Pommes de terre à l'eau", 4003, 200], ["Salade verte", 25604, 50]]],
    ["plat", "Pâtes bolognaise", [["Pâtes bolognaise", 25085, 350]]],
    ["plat", "Pâtes carbonara", [["Pâtes carbonara", 25135, 350]]],
    ["plat", "Lasagnes à la viande", [["Lasagnes à la viande", 25081, 300]]],
    ["plat", "Couscous au poulet", [["Couscous au poulet", 25138, 400]]],
    ["plat", "Hachis parmentier", [["Hachis parmentier", 25009, 300]]],
    ["plat", "Chili con carne et riz", [["Chili con carne", 25111, 300], ["Riz blanc cuit", 9104, 150]]],
    ["plat", "Poulet au curry et riz", [["Poulet au curry", 25174, 250], ["Riz blanc cuit", 9104, 150]]],
    ["plat", "Blanquette de veau et riz", [["Blanquette de veau", 25001, 250], ["Riz blanc cuit", 9104, 150]]],
    ["plat", "Bœuf bourguignon et pommes de terre", [["Bœuf bourguignon", 25033, 300], ["Pommes de terre à l'eau", 4003, 200]]],
    ["plat", "Tajine de poulet", [["Tajine de poulet", 25204, 350]]],
    ["plat", "Paëlla", [["Paëlla", 25242, 350]]],
    ["plat", "Risotto aux légumes", [["Risotto aux légumes", 25187, 300]]],
    ["plat", "Steak et gratin dauphinois", [["Steak grillé", 6200, 150], ["Gratin dauphinois", 25056, 200]]],
    ["plat", "Quiche lorraine et salade", [["Quiche lorraine", 25405, 150], ["Salade verte", 25604, 50]]],
    ["plat", "Soupe de légumes et pain", [["Soupe de légumes", 25903, 400], ["Pain (baguette)", 7001, 50]]],
    ["pouce", "Pizza margherita", [["Pizza margherita", 25404, 300]]],
    ["pouce", "Pizza jambon fromage", [["Pizza jambon fromage", 25435, 300]]],
    ["pouce", "Burger et frites", [["Hamburger", 25413, 200], ["Frites", 4032, 120]]],
    ["pouce", "Kebab et frites", [["Kebab (pain pita, crudités)", 25428, 250], ["Frites", 4032, 120]]],
    ["pouce", "Sushis et makis (12 pièces)", [["Sushis et makis", 25456, 300]]],
    ["pouce", "Sandwich jambon-beurre", [["Sandwich jambon-beurre", 25517, 250]]],
    ["pouce", "Sandwich poulet crudités", [["Sandwich poulet crudités", 25476, 250]]],
    ["pouce", "Wrap poulet crudités", [["Wrap poulet crudités", 25647, 200]]],
    ["pouce", "Croque-monsieur et salade", [["Croque-monsieur", 25547, 200], ["Salade verte", 25604, 50]]],
    ["pouce", "Salade César au poulet", [["Salade César au poulet", 25628, 300]]],
    ["pouce", "Taboulé au poulet", [["Taboulé au poulet", 26269, 300]]],
    ["pouce", "Salade composée poulet et fromage", [["Salade composée poulet et fromage", 25669, 350]]],
    ["pouce", "Nouilles sautées asiatiques", [["Nouilles sautées", 9085, 350]]],
    ["pouce", "Fajitas au poulet", [["Fajitas au poulet", 25460, 300]]],
    ["pouce", "Burrito au bœuf", [["Burrito au bœuf", 25459, 300]]],
]
PLATS = []
for cat, name, items in PLATS_SRC:
    rows = []
    for it in items:
        label, code, g = it[0], it[1], it[2]
        v = vals(code) if code else None
        if code and not v:
            raise SystemExit("Code Ciqual introuvable ou sans énergie : %s (%s)" % (code, label))
        rows.append([label] + (v or it[3]) + [g, code])
    PLATS.append({"cat": cat, "n": name, "i": rows})

# Repères de portions « parlants » (tranche, œuf moyen, cuillère à soupe…) pour saisir un repas sans peser.
# Chaque règle : [motif sur le nom de l'aliment sans accents (ou « grp: » + motif sur le groupe Ciqual), portions,
# liquide (ml) ou non]. Première règle qui correspond = la bonne ; première portion = celle proposée d'office.
# Poids mangés (sans coquille, os ni peau), arrondis : repères moyens. Œufs : catégories de poids du règlement (CE)
# n° 589/2008 (M = 53 à 63 g avec coquille, soit ≈ 50 g mangés). Pourquoi des repères ménagers plutôt que des grammes :
# Amoutzopoulos et al., Nutr Rev 2020 (revue systématique des outils d'estimation des portions).
ASSIETTE = [["assiette moyenne", 150], ["petite assiette", 100], ["grosse assiette", 250], ["cuillère à soupe", 20]]
VIANDE = [["portion moyenne", 130], ["petite portion", 100], ["grosse portion", 200]]
POIGNEE = [["poignée", 30]]
CAS_CAC = [["cuillère à soupe", 15], ["cuillère à café", 5]]
VERRE = [["verre", 200], ["bol", 250], ["tasse", 150]]
MESURES_SRC = [
    [r"lait de coco|creme de coco", [["cuillère à soupe", 15], ["brique (20 cl)", 200]]],
    [r"beurre de cacahuete|pate d'arachide|puree d'(amande|noisette|cajou)|pate a tartiner|creme de marron", [["cuillère à soupe", 15], ["cuillère à café", 7], ["pour 1 tartine", 12]]],
    [r"^(beurre|margarine|matiere grasse)\b", [["noisette (pour 1 tartine)", 7], ["plaquette individuelle", 10], ["cuillère à soupe", 15]]],
    [r"^huile", [["cuillère à soupe", 10], ["cuillère à café", 4]]],
    [r"mayonnaise|ketchup|moutarde|vinaigrette|sauce (soja|barbecue|burger|samourai|bearnaise|blanche)|tartare", CAS_CAC],
    [r"^sauce|^coulis", [["cuillère à soupe", 15], ["portion (pour une assiette de pâtes)", 80]]],
    [r"pain de mie", [["tranche", 25], ["grande tranche", 40]]],
    [r"biscotte|pain grille|cracotte|pain suedois|craquotte", [["tranche", 9]]],
    [r"galette de (riz|mais|sarrasin souffle)", [["galette", 8]]],
    [r"pain au lait", [["pain au lait", 35]]],
    [r"brioche", [["tranche", 30], ["grosse tranche ou part", 45], ["briochette", 35]]],
    [r"croissant", [["croissant", 60], ["mini-croissant", 25]]],
    [r"pain au chocolat|chocolatine", [["pain au chocolat", 70], ["mini pain au chocolat", 25]]],
    [r"pain aux raisins|chausson|viennoiserie", [["pièce", 90]]],
    [r"^pain|baguette", [["tranche ou morceau", 40], ["quart de baguette", 60], ["demi-baguette", 125], ["baguette entière", 250]]],
    [r"pizza", [["pizza entière", 300], ["part (un quart)", 75], ["part (un huitième)", 40]]],
    [r"quiche", [["part", 150]]],
    [r"galette complete|galette de sarrasin", [["galette garnie", 220]]],
    [r"crepe", [["crêpe", 50]]],
    [r"croque", [["croque-monsieur", 180]]],
    [r"hamburger|burger|cheeseburger", [["burger", 200], ["petit burger (type cheeseburger)", 120]]],
    [r"kebab", [["kebab", 250]]], [r"wrap", [["wrap", 200]]], [r"tacos", [["tacos", 350]]], [r"burrito", [["burrito", 300]]], [r"fajita", [["fajita", 150]]],
    [r"hot.?dog", [["hot-dog", 150]]],
    [r"sandwich|panini", [["sandwich", 250], ["demi-sandwich", 125]]],
    [r"blanc d'oeuf", [["blanc d'œuf", 33]]],
    [r"jaune d'oeuf", [["jaune d'œuf", 17]]],
    [r"omelette", [["omelette de 2 œufs", 110], ["omelette de 3 œufs", 160]]],
    [r"^oeuf|oeufs? (dur|poche|au plat|brouille|mollet|coque)", [["œuf moyen", 50], ["petit œuf", 45], ["gros œuf", 60]]],
    [r"jambon cru|jambon sec|bayonne|serrano|parme|bresaola|viande des grisons", [["tranche fine", 15]]],
    [r"^jambon|jambon (blanc|cuit)|blanc de (dinde|poulet).*(tranche|preemballe)", [["tranche", 40]]],
    [r"saucisson|chorizo|salami|rosette", [["rondelle", 5], ["portion apéritif (10 rondelles)", 50]]],
    [r"lardon", [["cuillère à soupe", 15], ["petite barquette", 75]]],
    [r"bacon", [["tranche", 12]]],
    [r"knack|strasbourg|francfort", [["saucisse", 35]]],
    [r"merguez|chipolata", [["saucisse", 50]]],
    [r"saucisse", [["saucisse", 100]]],
    [r"nugget", [["nugget", 20]]],
    [r"hache.*\bcru", [["steak haché", 100], ["gros steak haché", 125]]],
    [r"steak hache|hache de boeuf|\bhache\b", [["steak haché (100 g cru)", 80], ["gros steak haché (125 g cru)", 100]]],
    [r"boulette", [["boulette", 25]]],
    [r"(poulet|dinde).*(filet|blanc|escalope)|(filet|blanc|escalope).*(poulet|dinde)|escalope", [["filet ou escalope", 120], ["demi-filet", 60]]],
    [r"cuisse|pilon", [["pilon", 70], ["cuisse entière", 150]]],
    [r"saumon fume|truite fumee", [["tranche", 25]]],
    [r"^thon.*(naturel|huile|appertise|conserve|egoutte)|^thon$", [["petite boîte égouttée", 100], ["cuillère à soupe", 15]]],
    [r"sardine", [["sardine", 25], ["boîte égouttée", 85]]],
    [r"surimi", [["bâtonnet", 15]]],
    [r"crevette", [["portion", 100], ["crevette", 8]]],
    [r"^(saumon|cabillaud|colin|merlu|lieu|truite|bar|dorade|poisson|thon|maquereau|sole|merlan)\b|\bpave\b|filet de poisson", [["pavé ou filet", 130], ["petite portion", 100]]],
    [r"^(boeuf|veau|porc|agneau|mouton|canard|lapin|cheval|poulet|dinde)\b|steak|entrecote|bavette|rumsteck|roti|cote de|cotelette|magret|filet mignon", VIANDE],
    [r"tofu|tempeh|seitan|steak vegetal|galette vegetale", [["portion", 100]]],
    [r"^lait\b|lait (demi|entier|ecreme)|boisson (au|a base de|vegetale)|boisson (soja|avoine|amande|riz)", VERRE + [["un nuage (dans un café)", 20]], True],
    [r"skyr", [["pot", 150], ["cuillère à soupe", 30]]],
    [r"petit.suisse", [["pot", 60]]],
    [r"fromage blanc|faisselle", [["pot individuel", 100], ["bol", 200], ["cuillère à soupe", 30]]],
    [r"yaourt.*grec|a la grecque", [["pot", 150], ["cuillère à soupe", 30]]],
    [r"yaourt|yogourt|yoghourt|lait fermente|kefir", [["pot", 125], ["cuillère à soupe", 30]]],
    [r"creme dessert|creme (brulee|caramel|aux oeufs)|flan|mousse au chocolat|riz au lait|semoule au lait|\bliegeois\b|panna cotta", [["pot", 100]]],
    [r"^creme\b(?! glacee| anglaise)|creme fraiche", [["cuillère à soupe", 15], ["petite brique (20 cl)", 200]]],
    [r"mozzarella", [["boule", 125], ["demi-boule", 60]]],
    [r"\brape\b", [["cuillère à soupe", 10], ["poignée", 30]]],
    [r"parmesan", [["cuillère à soupe (râpé)", 7], ["copeaux (portion)", 15]]],
    [r"fromage fondu|vache qui rit|portion fromagere", [["portion", 17]]],
    [r"camembert|brie|coulommiers|chevre|roquefort|comte|emmental|raclette|reblochon|cantal|tomme|feta|fromage", [["portion", 30], ["tranche", 20]]],
    [r"^barre.*prote|barre prote", [["barre", 50]]],
    [r"^barre|barre (cerealiere|de cereales|chocolatee)", [["barre", 25]]],
    [r"flocon|avoine", [["petit bol", 40], ["grand bol", 70], ["cuillère à soupe", 10]]],
    [r"muesli|granola|cereale.*(petit|dejeuner)|petales|corn flakes|cereales", [["bol", 40], ["grand bol", 60], ["cuillère à soupe", 10]]],
    [r"chips", [["petit paquet", 30], ["poignée", 15]]],
    [r"frite", [["portion moyenne", 120], ["petite portion", 80], ["grande portion", 180]]],
    [r"puree", [["assiette", 200], ["cuillère à soupe", 30]]],
    [r"pomme de terre|patate|pommes de terre", [["pomme de terre moyenne", 100], ["petite pomme de terre", 60], ["grosse pomme de terre", 200]]],
    [r"(riz|pates|semoule|quinoa|boulgour|ble|nouille|spaghetti|coquillette|macaroni|tagliatelle|penne|lentille|pois chiche|haricot (rouge|blanc|sec)|flageolet|polenta|couscous).*\b(cru|sec|seche)", [["portion (pesée crue)", 70], ["cuillère à soupe", 15]]],
    [r"^(riz|pates|semoule|quinoa|boulgour|ble|nouille|spaghetti|coquillette|macaroni|tagliatelle|penne|lentille|pois chiche|haricot rouge|haricots rouges|haricot blanc|flageolet|polenta)\b.*\bcuite?s?\b", ASSIETTE],
    [r"^pate (de|en)|^pate$|rillette|terrine|foie gras|tapenade|houmous|caviar d'aubergine", [["pour 1 tartine", 30], ["cuillère à soupe", 15]]],
    [r"soupe|potage|veloute|gaspacho", [["bol", 300], ["assiette creuse", 250]]],
    [r"tomate cerise", [["tomate cerise", 15]]],
    [r"^tomate", [["tomate moyenne", 120], ["tomate cerise", 15]]],
    [r"^carotte", [["carotte moyenne", 80], ["accompagnement", 150]]],
    [r"concombre", [["demi-concombre", 150]]],
    [r"salade verte|laitue|mache|roquette|mesclun|^salade$", [["bol", 50], ["poignée", 20]]],
    [r"avocat", [["demi-avocat", 80], ["avocat entier", 160]]],
    [r"^mais\b", [["cuillère à soupe", 20], ["petite boîte égouttée", 140]]],
    [r"haricot vert|brocoli|epinard|courgette|poelee|ratatouille|chou|poireau|aubergine|poivron|champignon|legume", [["accompagnement", 150], ["petite portion", 80], ["cuillère à soupe", 20]]],
    [r"^banane", [["banane moyenne", 120], ["petite banane", 90], ["grosse banane", 150]]],
    [r"^pomme", [["pomme moyenne", 150], ["petite pomme", 100], ["grosse pomme", 200]]],
    [r"^poire", [["poire moyenne", 150]]],
    [r"^orange", [["orange moyenne", 150]]],
    [r"clementine|mandarine", [["clémentine", 60]]],
    [r"^kiwi", [["kiwi", 75]]],
    [r"^peche|nectarine|brugnon", [["pêche moyenne", 130]]],
    [r"abricot sec|figue seche|pruneau", [["fruit sec", 8]]],
    [r"^abricot", [["abricot", 40]]],
    [r"^prune", [["prune", 35]]],
    [r"^fraise", [["bol", 150], ["fraise", 12]]],
    [r"framboise|myrtille|fruits rouges|mure|groseille|cassis", [["poignée", 50], ["bol", 125]]],
    [r"raisin sec|raisins secs", [["cuillère à soupe", 15], ["poignée", 30]]],
    [r"^raisin", [["grappe moyenne", 125], ["grain", 5]]],
    [r"datte", [["datte", 8]]],
    [r"ananas|melon|pasteque", [["tranche", 150]]],
    [r"mangue", [["demi-mangue", 150]]],
    [r"cerise", [["bol", 150], ["cerise", 7]]],
    [r"compote", [["pot ou gourde", 100]]],
    [r"^jus|nectar|smoothie", [["verre", 200], ["petite bouteille (25 cl)", 250]], True],
    [r"cajou", POIGNEE + [["noix de cajou", 1.5]]],
    [r"amande", POIGNEE + [["amande", 1.2]]],
    [r"^noix|cerneau", POIGNEE + [["noix (2 cerneaux)", 5]]],
    [r"noisette|pistache|cacahuete|arachide|fruits a coque|melange de noix", POIGNEE],
    [r"graine|chia|\blin\b|sesame", [["cuillère à soupe", 10], ["cuillère à café", 4]]],
    [r"^miel", [["cuillère à café", 7], ["cuillère à soupe", 20]]],
    [r"confiture|gelee|marmelade", [["cuillère à café", 7], ["cuillère à soupe", 20], ["pour 1 tartine", 15]]],
    [r"^sucre|sucre (blanc|roux|de canne|en poudre|en morceaux)|cassonade|vergeoise", [["morceau ou cuillère à café", 5], ["cuillère à soupe", 12]]],
    [r"sirop d'erable|sirop d'agave", [["cuillère à soupe", 20]]],
    [r"^sirop", [["dose pour un verre", 20]], True],
    [r"cacao.*poudre|poudre.*cacao|chocolat en poudre", [["cuillère à soupe", 8]]],
    [r"chocolat chaud|boisson.*cacao|lait chocolate", [["tasse", 250]], True],
    [r"^chocolat|chocolat (noir|au lait|blanc)|tablette de chocolat", [["carré", 5], ["rangée (4 carrés)", 20], ["tablette", 100]]],
    [r"bonbon|confiserie|guimauve", [["bonbon", 5]]],
    [r"cookie", [["cookie", 15]]],
    [r"madeleine", [["madeleine", 25]]],
    [r"muffin", [["muffin", 80]]],
    [r"brownie", [["carré", 50]]],
    [r"beignet|donut", [["beignet", 70]]],
    [r"gaufre", [["gaufre", 60]]],
    [r"biscuit|petit beurre|sable|galette bretonne|speculoos|gaufrette|palmier|boudoir", [["biscuit", 10]]],
    [r"gateau|cake|tarte|profiterole|tiramisu|pain d'epice|flan patissier|eclair|patisserie|fraisier|millefeuille|clafoutis", [["part", 100]]],
    [r"glace|sorbet|creme glacee", [["boule", 50], ["pot individuel", 100], ["cône ou bâtonnet", 70]]],
    [r"^eau\b", [["verre", 200], ["bouteille (50 cl)", 500]], True],
    [r"^cafe|^the\b|infusion|tisane|expresso|cappuccino", [["tasse", 150], ["expresso", 40], ["mug", 250]], True],
    [r"soda|cola|limonade|boisson gazeuse|ice tea|the glace|boisson energ|boisson aux fruits", [["canette (33 cl)", 330], ["verre", 200], ["bouteille (50 cl)", 500]], True],
    [r"biere", [["demi (25 cl)", 250], ["canette (33 cl)", 330], ["pinte (50 cl)", 500]], True],
    [r"cidre", [["verre", 200]], True],
    [r"^vin\b|champagne|vin (rouge|blanc|rose)", [["verre", 125]], True],
    [r"whisky|rhum|vodka|pastis|gin|cognac|liqueur|spiritueux", [["dose (4 cl)", 40]], True],
    [r"whey|proteine en poudre|poudre proteinee", [["dose (1 scoop)", 30]]],
    [r"tranche", [["tranche", 30]]],
    # par groupe de la table Ciqual quand le nom ne dit rien
    [r"grp:laits|grp:boissons|grp:eaux|grp:boisson", VERRE, True],
    [r"grp:fromages", [["portion", 30], ["tranche", 20]]],
    [r"grp:produits laitiers frais", [["pot", 125]]],
    [r"grp:oeufs", [["œuf moyen", 50]]],
    [r"grp:viandes|grp:poissons|grp:mollusques|grp:charcuteries|grp:produits a base de|grp:autres produits a base", VIANDE],
    [r"grp:fruits a coque", POIGNEE + [["cuillère à soupe", 10]]],
    [r"grp:fruits", [["fruit moyen ou portion", 100]]],
    [r"grp:legumes$|grp:salades", [["accompagnement", 150], ["petite portion", 80]]],
    [r"grp:pommes de terre", [["portion", 150]]],
    [r"grp:legumineuses|grp:pates, riz", ASSIETTE],
    [r"grp:pains", [["tranche ou morceau", 40]]],
    [r"grp:viennoiseries", [["pièce", 60]]],
    [r"grp:biscuits sucres", [["biscuit", 10]]],
    [r"grp:biscuits aperitifs", [["poignée", 15], ["petit paquet", 30]]],
    [r"grp:gateaux", [["part", 100]]],
    [r"grp:glaces|grp:sorbets|grp:desserts glaces", [["boule", 50]]],
    [r"grp:chocolats", [["carré", 5], ["barre", 25]]],
    [r"grp:confiseries", [["bonbon", 5]]],
    [r"grp:confitures|grp:sucres", [["cuillère à café", 7], ["cuillère à soupe", 20]]],
    [r"grp:beurres|grp:margarines|grp:huiles|grp:autres matieres|grp:cremes", [["cuillère à soupe", 10], ["cuillère à café", 4]]],
    [r"grp:sauces|grp:condiments|grp:aides culinaires", CAS_CAC],
    [r"grp:epices|grp:herbes|grp:sels", [["pincée", 0.5], ["cuillère à café", 3]]],
    [r"grp:soupes", [["bol", 300]]],
    [r"grp:sandwichs", [["sandwich", 250]]],
    [r"grp:pizzas", [["part", 120]]],
    [r"grp:plats composes|grp:feuilletees", [["assiette", 300], ["petite assiette", 200]]],
    [r"grp:cereales de petit|grp:barres", [["bol", 40]]],
]
MESURES = []
for row in MESURES_SRC:
    k, opts = row[0], row[1]
    ml = len(row) > 2 and row[2]
    assert opts and all(isinstance(g, (int, float)) and g > 0 for _, g in opts), k
    MESURES.append({"k": k, "o": [[l, g] for l, g in opts], **({"ml": True} if ml else {})})

NUTRI_CONTENT = {"FOODS": FOODS, "PLATS": PLATS, "MESURES": MESURES, "CIQ": {"v": CIQ["v"], "date": CIQ["date"], "src": CIQ["src"], "n": len(CIQ["f"])}}
