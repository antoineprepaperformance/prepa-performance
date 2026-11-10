# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main, quand Node (donc tools/i18n_extract.mjs) n'est pas disponible.

A lancer depuis app/ :  python3 tools/i18n_main.py

Meme calcul d'empreinte que l'extracteur : sha1(texte normalise)[:10], ou la normalisation remplace les
espaces insecables par des espaces et replie les blancs (identique a I18N_NORM dans src/00_i18n.js).
Verifie avant usage sur les entrees existantes de _textes.json : les empreintes se reproduisent a 100 %.

Ce script ecrit dans i18n/en.json et i18n/es.json ({empreinte : traduction}) et ajoute au besoin l'entree
correspondante dans i18n/_textes.json. Ce dernier fichier est GENERE par l'extracteur : les entrees
ajoutees ici ne sont qu'un pont. Comme i18n_build.py associe traduction et texte par empreinte, les
traductions survivent a une regeneration et se raccrochent d'elles-memes — rien a refaire.

Comment obtenir des clefs FIABLES : ne pas extraire les chaines des sources avec une expression
reguliere (ca ramasse des fragments de JavaScript). Charger l'application en francais dans un navigateur
et collecter les noeuds de texte visibles de l'ecran concerne : ce sont exactement les clefs que tr()
recevra. Voir la demarche dans l'entree du 10 novembre 2026 du JOURNAL.

Ce qui ne se traduit jamais : les references bibliographiques, et le contenu redige (article de la
semaine) marque data-notr dans le balisage.

{} dans une clef = un morceau quelconque (motif), traduit recursivement s'il a sa propre traduction.
"""
import hashlib, json, pathlib, re

T = [
 # ---- inscription : les deux axes ----
 ("Tes objectifs", "literal", "Your goals", "Tus objetivos"),
 ("1. Ton entraînement", "literal", "1. Your training", "1. Tu entrenamiento"),
 ("2. Ta composition corporelle", "literal", "2. Your body composition", "2. Tu composición corporal"),
 ("Ce que tu travailles. Un seul programme à la fois : il dure 12 semaines.", "literal",
  "What you work on. One programme at a time: it lasts 12 weeks.",
  "Lo que trabajas. Un solo programa a la vez: dura 12 semanas."),
 ("Ta composition corporelle", "literal", "Your body composition", "Tu composición corporal"),
 ("Perdre du gras", "literal", "Lose fat", "Perder grasa"),
 ("Indépendant de ton entraînement : tu peux viser la force et perdre du gras en même temps. Si les deux tirent en sens opposés, on te le dit franchement.", "literal",
  "Independent from your training: you can aim for strength and lose fat at the same time. If the two pull in opposite directions, we tell you straight.",
  "Independiente de tu entrenamiento: puedes buscar fuerza y perder grasa a la vez. Si ambos tiran en sentidos opuestos, te lo decimos claramente."),
 # ---- profil : carte « Mes objectifs » ----
 ("Mes objectifs", "literal", "My goals", "Mis objetivos"),
 ("Deux choix séparés : ce que tu travailles, et où tu veux emmener ton poids", "literal",
  "Two separate choices: what you work on, and where you want to take your weight",
  "Dos elecciones separadas: lo que trabajas y hacia dónde quieres llevar tu peso"),
 ("Entraînement :", "literal", "Training:", "Entrenamiento:"),
 ("(choisi avec Antoine)", "literal", "(chosen with Antoine)", "(elegido con Antoine)"),
 ("Ta composition corporelle règle tes repères de nutrition. Ton entraînement, c'est le programme : parles-en à Antoine pour le changer.", "literal",
  "Your body composition sets your nutrition targets. Your training is the programme: talk to Antoine to change it.",
  "Tu composición corporal fija tus objetivos de nutrición. Tu entrenamiento es el programa: háblalo con Antoine para cambiarlo."),
 # ---- note de compromis (recomposition) ----
 ("Deux objectifs à la fois : c'est jouable", "literal",
  "Two goals at once: it's doable", "Dos objetivos a la vez: es viable"),
 ("Deux objectifs qui tirent en sens opposés", "literal",
  "Two goals pulling in opposite directions", "Dos objetivos que tiran en sentidos opuestos"),
 ("Gagner en force et perdre du gras en même temps, c'est ce qu'on appelle la recomposition corporelle. C'est réel, mais d'ampleur modeste : les deux avancent plus lentement que si tu n'en visais qu'un.", "literal",
  "Gaining strength and losing fat at the same time is what's called body recomposition. It is real, but modest in scale: both progress more slowly than if you aimed for only one.",
  "Ganar fuerza y perder grasa a la vez es lo que se llama recomposición corporal. Es real, pero de magnitud modesta: ambos avanzan más despacio que si buscaras solo uno."),
 ("D'après ton profil, tu es dans le cas le plus favorable : c'est surtout documenté chez les personnes qui débutent, qui reprennent, ou qui partent avec plus de masse grasse.", "literal",
  "Based on your profile, you are in the most favourable case: it is mainly documented in people who are starting out, coming back, or starting with more body fat.",
  "Según tu perfil, estás en el caso más favorable: está documentado sobre todo en personas que empiezan, que retoman, o que parten con más masa grasa."),
 ("D'après ton profil (entraîné et déjà sec), la fenêtre est étroite : enchaîner les deux phases — d'abord l'une, puis l'autre — rend souvent plus que viser les deux à la fois. À voir avec Antoine.", "literal",
  "Based on your profile (trained and already lean), the window is narrow: running the two phases one after the other — first one, then the other — often pays off more than aiming for both at once. To discuss with Antoine.",
  "Según tu perfil (entrenado y ya definido), la ventana es estrecha: encadenar las dos fases — primero una, luego la otra — suele rendir más que buscar las dos a la vez. A ver con Antoine."),
 ("D'après ton profil, c'est jouable sans être acquis : on regarde les chiffres au bout de quelques semaines avant de trancher.", "literal",
  "Based on your profile, it is doable without being a given: we look at the numbers after a few weeks before deciding.",
  "Según tu perfil, es viable sin estar garantizado: miramos las cifras al cabo de unas semanas antes de decidir."),
 ("Condition présente dans toutes les études : des protéines élevées (1,6 à 2,4 g par kg de poids et par jour) et un déficit modéré, pas extrême.", "literal",
  "A condition present in every study: high protein (1.6 to 2.4 g per kg of body weight per day) and a moderate deficit, not an extreme one.",
  "Condición presente en todos los estudios: proteínas altas (1,6 a 2,4 g por kg de peso y por día) y un déficit moderado, no extremo."),
 ("Comment on jugera : tes charges et tes tests, ton tour de taille et ton tour de hanches — pas la balance. En recomposition le poids bouge peu, c'est normal et ça ne veut pas dire que rien ne se passe.", "literal",
  "How we will judge it: your loads and your tests, your waist and your hip measurements — not the scale. In recomposition, weight barely moves; that is normal and does not mean nothing is happening.",
  "Cómo lo juzgaremos: tus cargas y tus pruebas, tu cintura y tu cadera — no la balanza. En recomposición el peso se mueve poco; es normal y no significa que no pase nada."),
 ("Estimé d'après ton expérience déclarée et ton rapport taille/poids, pas d'après une mesure de masse grasse.", "literal",
  "Estimated from your declared experience and your height-to-weight ratio, not from a body-fat measurement.",
  "Estimado a partir de tu experiencia declarada y tu relación altura/peso, no de una medición de masa grasa."),
 ("Les sources", "literal", "Sources", "Las fuentes"),
 # ---- suivi de recomposition (page Progrès et vue coach) ----
 ("Recomposition : où on en est", "literal",
  "Recomposition: where you stand", "Recomposición: dónde estamos"),
 ("Les circonférences et les charges, pas la balance", "literal",
  "Circumferences and loads, not the scale", "Las circunferencias y las cargas, no la balanza"),
 ("Pas encore de quoi juger", "literal", "Not enough to judge yet", "Aún no hay con qué juzgar"),
 ("Il faut au moins deux mesures de tour de taille ou de hanches (onglet Tests) et deux séances avec les charges notées sur un même exercice.", "literal",
  "You need at least two waist or hip measurements (Tests tab) and two sessions with loads recorded for the same exercise.",
  "Hacen falta al menos dos medidas de cintura o cadera (pestaña Pruebas) y dos sesiones con las cargas anotadas en un mismo ejercicio."),
 ("La recomposition se passe bien", "literal",
  "Recomposition is going well", "La recomposición va bien"),
 ("Les circonférences baissent et les charges montent : c'est exactement le signal attendu, même si le poids bouge peu.", "literal",
  "Circumferences are going down and loads are going up: that is exactly the expected signal, even if weight barely moves.",
  "Las circunferencias bajan y las cargas suben: es exactamente la señal esperada, aunque el peso se mueva poco."),
 ("Le gras baisse, la force stagne", "literal",
  "Fat is going down, strength is flat", "La grasa baja, la fuerza se estanca"),
 ("Soit le déficit est trop marqué, soit les protéines sont trop basses. Remonter l'un ou l'autre avant de continuer.", "literal",
  "Either the deficit is too steep, or protein is too low. Raise one or the other before carrying on.",
  "O el déficit es demasiado marcado, o las proteínas son demasiado bajas. Subir uno u otro antes de seguir."),
 ("La force monte, les circonférences non", "literal",
  "Strength is going up, circumferences are not", "La fuerza sube, las circunferencias no"),
 ("L'entraînement prend, le déficit n'y est pas. Revoir les apports avant de toucher au programme.", "literal",
  "Training is working, the deficit is not there. Review intake before touching the programme.",
  "El entrenamiento funciona, el déficit no está. Revisar la ingesta antes de tocar el programa."),
 ("Ni l'un ni l'autre ne bouge", "literal",
  "Neither one is moving", "Ni uno ni otro se mueve"),
 ("Après quelques semaines sans mouvement sur les deux, viser un seul objectif à la fois rend généralement plus.", "literal",
  "After a few weeks with no movement on either, aiming for one goal at a time generally pays off more.",
  "Tras unas semanas sin movimiento en ninguno, buscar un solo objetivo a la vez suele rendir más."),
 ("Tour de taille", "literal", "Waist", "Cintura"),
 ("Tour de hanches", "literal", "Hips", "Cadera"),
 # ---- premiers jours ----
 ("Tes débuts :", "literal", "Your start:", "Tus comienzos:"),
 ("Mes tests : mes progrès", "literal", "My tests: my progress", "Mis pruebas: mis progresos"),
 ("premier résultat, c'est ton point de départ", "literal",
  "first result, this is your starting point", "primer resultado, es tu punto de partida"),
 ("en progrès", "literal", "improving", "mejorando"),
 ("départ", "literal", "start", "inicio"),
 ("C'est la comparaison qui compte quand on démarre : toi contre toi, pas toi contre un champion du monde.", "literal",
  "That is the comparison that matters when starting out: you against you, not you against a world champion.",
  "Esa es la comparación que cuenta al empezar: tú contra ti, no tú contra un campeón del mundo."),
 ("Refais ces tests dans 4 semaines : tu te compareras à toi-même, c'est le seul repère utile au début.", "literal",
  "Redo these tests in 4 weeks: you will compare yourself to yourself, the only useful benchmark at the start.",
  "Repite estas pruebas en 4 semanas: te compararás contigo mismo, el único referente útil al principio."),
 ("Voir aussi la comparaison avec les records du monde", "literal",
  "Also see the comparison with world records", "Ver también la comparación con los récords del mundo"),
 ("Ces pourcentages servent de repère aux athlètes confirmés. Au début ils sont forcément bas pour tout le monde : ce n'est pas une note sur toi.", "literal",
  "These percentages are a benchmark for experienced athletes. At the start they are necessarily low for everyone: this is not a grade on you.",
  "Estos porcentajes sirven de referencia a atletas consolidados. Al principio son necesariamente bajos para todos: no es una nota sobre ti."),
 # ---- motifs (valeur interpolee) ----
 ("Ton entraînement, c'est « {} » : c'est un axe à part, il ne change pas ici", "pattern",
  "Your training is “{}”: that is a separate axis, it does not change here",
  "Tu entrenamiento es «{}»: es un eje aparte, no cambia aquí"),
 ("L'objectif de cette première semaine est simple : {}. Pas plus. C'est le seul cap qui compte pour l'instant, le reste suivra tout seul.", "pattern",
  "The goal for this first week is simple: {}. No more. It is the only target that matters for now, the rest will follow on its own.",
  "El objetivo de esta primera semana es simple: {}. Nada más. Es la única meta que cuenta por ahora, lo demás vendrá solo."),
 ("Encore {} cette semaine et ton démarrage est réussi.", "pattern",
  "{} more this week and your start is a success.",
  "{} más esta semana y tu arranque es un éxito."),
 ("Il te reste {}.", "pattern", "You have {} left.", "Te quedan {}."),
]

def norm(s):
    s = re.sub(r"[  ]", " ", str(s))
    return re.sub(r"\s+", " ", s).strip()

def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]

I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add_t, upd = 0, 0
for k_raw, kind, t_en, t_es in T:
    k = norm(k_raw)
    hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": kind, "where": "src/i18n-main", "n": 1}); add_t += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es

# on reproduit exactement le format d'origine de chaque fichier, pour que le diff ne montre que les ajouts
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} textes traites | {add_t} ajoutes a _textes.json | {upd} traductions ecrites")
