# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main pour le lot basket du 16 novembre 2026 (3 fiches Technique), quand Node
n'est pas disponible. Meme mecanisme que i18n_main.py : voir ce fichier pour le detail. A lancer depuis app/ :
python3 tools/i18n_basket.py
"""
import hashlib, json, pathlib, re

T = [
 ("Tir en suspension (élan et lâcher)", "Jump shot (approach and release)", "Tiro en suspensión (impulso y soltada)"),
 ("Fermer sur le tireur (close-out)", "Closing out on the shooter (close-out)", "Cerrar sobre el tirador (close-out)"),
 ("Changement de direction en dribble (crossover)", "Change of direction dribble (crossover)", "Cambio de dirección en el bote (crossover)"),
 ("Ballons, un panier", "Balls, a hoop", "Balones, una canasta"),
 ("Un ballon", "A ball", "Un balón"),
 ("Tirer juste après une passe, avec un petit saut d'arrêt et un lâcher qui part des jambes.",
  "Shoot right after a pass, with a small jump stop and a release that starts from the legs.",
  "Tirar justo después de un pase, con una pequeña parada en salto y una soltada que parte de las piernas."),
 ("Fermer vite sur un tireur sans lui laisser le temps ni l'espace de tirer, sans sauter dans ses jambes.",
  "Close out fast on a shooter without giving them time or space to shoot, without jumping into their legs.",
  "Cerrar rápido sobre un tirador sin darle tiempo ni espacio para tirar, sin saltarle encima de las piernas."),
 ("Changer de main et de direction assez vite pour éliminer un défenseur, ballon protégé.",
  "Change hands and direction fast enough to beat a defender, ball protected.",
  "Cambiar de mano y de dirección lo bastante rápido para superar a un defensor, con el balón protegido."),
 ("Départ à 4-5 m du panier, ballon chez le passeur.",
  "Start 4-5 m from the hoop, ball with the teammate.", "Salida a 4-5 m de la canasta, balón con el compañero."),
 ("Passe reçue avec un petit saut d'arrêt : les deux pieds se posent presque ensemble, genoux fléchis, ballon déjà remonté vers le visage.",
  "Catch the pass with a small jump stop: both feet land almost together, knees bent, ball already raised to face height.",
  "Recibe el pase con una pequeña parada en salto: los dos pies tocan el suelo casi a la vez, rodillas flexionadas, balón ya subido hacia la cara."),
 ("Extension des jambes puis du bras : coude sous le ballon, aligné avec le cercle ; le poignet retombe sur la balle au lâcher, doigts qui pointent vers le cercle.",
  "Extend the legs then the arm: elbow under the ball, aligned with the rim; the wrist snaps down on release, fingers pointing at the rim.",
  "Extensión de las piernas y después del brazo: codo bajo el balón, alineado con el aro; la muñeca cae sobre el balón al soltarlo, dedos apuntando al aro."),
 ("Retombée équilibrée sur les mêmes appuis, prêt à repartir en rebond offensif.",
  "Land balanced on the same feet, ready to crash the offensive boards.",
  "Caída equilibrada sobre los mismos apoyos, listo para ir al rebote ofensivo."),
 ("Départ en position d'aide, près de la raquette, genoux fléchis, mains actives.",
  "Start in a help position, near the paint, knees bent, hands active.",
  "Salida en posición de ayuda, cerca de la zona, rodillas flexionadas, manos activas."),
 ("Sprinte vers le tireur sur les trois premiers quarts de la distance.",
  "Sprint towards the shooter for the first three-quarters of the distance.",
  "Esprinta hacia el tirador en los primeros tres cuartos de la distancia."),
 ("Ralentis en petits pas chassés sur le dernier mètre : jamais à pleine vitesse jusqu'au bout.",
  "Slow down into short shuffle steps for the last metre: never at full speed all the way.",
  "Frena con pasos cortos laterales en el último metro: nunca a máxima velocidad hasta el final."),
 ("Arrivée en position basse : une main haute du côté du ballon, l'autre basse et active, pied extérieur légèrement avancé pour couper la ligne vers la ligne de fond.",
  "Arrive in a low stance: one hand high on the ball side, the other low and active, outside foot slightly forward to cut off the baseline.",
  "Llegada en posición baja: una mano arriba del lado del balón, la otra baja y activa, pie exterior ligeramente adelantado para cortar la línea hacia la línea de fondo."),
 ("Dribble face à un défenseur, à 2-3 m, genoux fléchis, ballon dans la main extérieure.",
  "Dribble facing a defender, 2-3 m away, knees bent, ball in the outside hand.",
  "Bote frente a un defensor, a 2-3 m, rodillas flexionadas, balón en la mano exterior."),
 ("Pousse un dribble fort et bas vers un côté pour faire avancer le défenseur de ce côté (feinte de départ).",
  "Push a strong, low dribble to one side to draw the defender that way (the setup fake).",
  "Da un bote fuerte y bajo hacia un lado para que el defensor avance de ese lado (amago de salida)."),
 ("Change de main devant toi, dribble bas et rapide de l'autre côté : le premier pas part EN MÊME TEMPS que le changement de main, pas après.",
  "Change hands in front of you, low and fast dribble to the other side: the first step fires AT THE SAME TIME as the hand change, not after.",
  "Cambia de mano delante de ti, bote bajo y rápido hacia el otro lado: el primer paso sale AL MISMO TIEMPO que el cambio de mano, no después."),
 ("Accélère sur 2-3 appuis pour prendre l'avantage, ballon protégé par le corps.",
  "Accelerate for 2-3 steps to take the advantage, ball shielded by your body.",
  "Acelera en 2-3 apoyos para tomar la ventaja, balón protegido por el cuerpo."),
 ("Les deux pieds se posent presque ensemble, pas une course qui continue",
  "Both feet land almost together, not a run that keeps going",
  "Los dos pies tocan el suelo casi a la vez, no es una carrera que continúa"),
 ("Le coude est sous le ballon, jamais écarté sur le côté",
  "The elbow stays under the ball, never flared out to the side",
  "El codo queda bajo el balón, nunca abierto hacia el lado"),
 ("Le poignet retombe après le lâcher : les doigts pointent vers le cercle",
  "The wrist snaps down after release: fingers point at the rim",
  "La muñeca cae después de soltar el balón: los dedos apuntan al aro"),
 ("Ralentis avant d'arriver : à pleine vitesse jusqu'au bout, tu voles au-dessus du tireur ou tu glisses",
  "Slow down before you arrive: at full speed all the way, you'll fly past the shooter or slip",
  "Frena antes de llegar: a máxima velocidad hasta el final, vuelas por encima del tirador o resbalas"),
 ("Une seule main levée, l'autre reste basse et active",
  "Only one hand up, the other stays low and active",
  "Solo una mano levantada, la otra se queda baja y activa"),
 ("Pied extérieur avancé pour couper la ligne de dribble",
  "Outside foot forward to cut off the dribble lane",
  "Pie exterior adelantado para cortar la línea de bote"),
 ("Dribble bas, sous le genou, pendant le changement : plus dur à intercepter",
  "Keep the dribble low, under the knee, during the change: harder to steal",
  "Bote bajo, por debajo de la rodilla, durante el cambio: más difícil de robar"),
 ("Le premier pas part en même temps que le changement de main",
  "The first step fires at the same time as the hand change",
  "El primer paso sale al mismo tiempo que el cambio de mano"),
 ("Épaule et pied avancent du même côté que la nouvelle direction",
  "Shoulder and foot lead on the same side as the new direction",
  "Hombro y pie avanzan del mismo lado que la nueva dirección"),
 ("1 tir à 70 %, petit saut", "1 shot at 70%, small jump", "1 tiro al 70 %, pequeño salto"),
 ("1 tir en suspension", "1 jump shot", "1 tiro en suspensión"),
 ("1 tir en suspension, 2 touches au plus", "1 jump shot, 2 touches at most", "1 tiro en suspensión, 2 toques como máximo"),
 ("1 tir en suspension sous pression", "1 jump shot under pressure", "1 tiro en suspensión bajo presión"),
 ("1 close-out, trot puis pas chassés", "1 close-out, jog then shuffle steps", "1 close-out, trote y después pasos laterales"),
 ("1 close-out", "1 close-out", "1 close-out"),
 ("1 close-out, côté annoncé tard", "1 close-out, side called late", "1 close-out, lado anunciado tarde"),
 ("Close-out + contre un premier dribble", "Close-out + contest a first dribble", "Close-out + contestar un primer bote"),
 ("1 crossover lent + accélération courte", "1 slow crossover + short acceleration", "1 crossover lento + aceleración corta"),
 ("1 crossover", "1 crossover", "1 crossover"),
 ("1 crossover rapide", "1 fast crossover", "1 crossover rápido"),
 ("Crossover + finition au panier", "Crossover + finish at the rim", "Crossover + finalización en la canasta"),
 ("2 séries de 5 tirs à 70 %, petit saut", "2 sets of 5 shots at 70%, small jump", "2 series de 5 tiros al 70 %, pequeño salto"),
 ("3 séries de 6 tirs, change de côté à chaque série", "3 sets of 6 shots, switch sides each set", "3 series de 6 tiros, cambia de lado en cada serie"),
 ("3 séries de 8 tirs, passe suivie du tir en 2 touches au plus", "3 sets of 8 shots, pass followed by the shot in 2 touches at most", "3 series de 8 tiros, pase seguido del tiro en 2 toques como máximo"),
 ("4 séries de 8 tirs, un défenseur passif lève un bras au moment du tir", "4 sets of 8 shots, a passive defender raises an arm at the moment of the shot", "4 series de 8 tiros, un defensor pasivo levanta un brazo en el momento del tiro"),
 ("2 séries de 5, départ au trot", "2 sets of 5, starting at a jog", "2 series de 5, salida al trote"),
 ("3 séries de 6, départ au sprint court", "3 sets of 6, starting with a short sprint", "3 series de 6, salida con un esprint corto"),
 ("3 séries de 8, côté du tireur annoncé au dernier moment", "3 sets of 8, shooter's side called at the last moment", "3 series de 8, lado del tirador anunciado en el último momento"),
 ("4 séries de 8, le tireur part en dribble une fois sur deux : contrôle sans faute", "4 sets of 8, the shooter drives on the dribble every other time: control it without fouling", "4 series de 8, el tirador se va en bote una de cada dos veces: contrólalo sin falta"),
 ("2 séries de 6, défenseur passif ou plot", "2 sets of 6, passive defender or a cone", "2 series de 6, defensor pasivo o un cono"),
 ("3 séries de 6, côtés alternés", "3 sets of 6, alternating sides", "3 series de 6, lados alternos"),
 ("3 séries de 8, défenseur réagit au changement", "3 sets of 8, defender really reacts to the change", "3 series de 8, el defensor reacciona de verdad al cambio"),
 ("4 séries de 8, terminées par un tir ou un lay-up après l'élimination", "4 sets of 8, finished with a shot or a lay-up after beating the defender", "4 series de 8, terminadas con un tiro o una bandeja tras superar al defensor"),
 ("Le tir en suspension part d'abord des membres inférieurs : l'extension des chevilles, des genoux et des hanches précède celle du bras, qui n'ajuste que la trajectoire (Struzik, Pietraszewski et Zawadzki, 2014).",
  "The jump shot starts from the lower body: ankle, knee and hip extension come before the arm, which only fine-tunes the trajectory (Struzik, Pietraszewski and Zawadzki, 2014).",
  "El tiro en suspensión empieza por el tren inferior: la extensión de tobillos, rodillas y caderas precede a la del brazo, que solo ajusta la trayectoria (Struzik, Pietraszewski y Zawadzki, 2014)."),
 ("Les déplacements défensifs — sprinter puis ralentir pour fermer sur un tireur — font partie des efforts les plus fréquents du basketteur, avec les sauts et les sprints (Stojanović, 2018).",
  "Defensive movement — sprinting then slowing down to close out on a shooter — is among the most frequent efforts in basketball, alongside jumps and sprints (Stojanović, 2018).",
  "Los desplazamientos defensivos —esprintar y después frenar para cerrar sobre un tirador— están entre los esfuerzos más frecuentes del baloncestista, junto con los saltos y los esprints (Stojanović, 2018)."),
 ("Changer de direction vite demande un appui extérieur puissant et un angle de course ajusté à la vitesse : plus l'angle est serré, plus il faut ralentir avant pour rester efficace (Dos'Santos, Thomas, Comfort et Jones, 2018).",
  "Changing direction quickly needs a powerful outside push-off and a running angle matched to speed: the sharper the angle, the more you need to slow down beforehand to stay effective (Dos'Santos, Thomas, Comfort and Jones, 2018).",
  "Cambiar de dirección rápido exige un apoyo exterior potente y un ángulo de carrera ajustado a la velocidad: cuanto más cerrado es el ángulo, más hay que frenar antes para seguir siendo eficaz (Dos'Santos, Thomas, Comfort y Jones, 2018)."),
 ("Détente et coordination jambes-bras", "Jumping power and leg-arm coordination", "Fuerza de salto y coordinación piernas-brazo"),
 ("Petit saut d'arrêt, montée du ballon, extension et lâcher, retombée équilibrée",
  "Jump stop, raising the ball, extension and release, balanced landing",
  "Parada en salto, subida del balón, extensión y soltada, caída equilibrada"),
 ("Tirer vite et juste après une passe, sans perdre l'équilibre",
  "Shoot fast and accurately right after a pass, without losing balance",
  "Tirar rápido y con precisión justo después de un pase, sin perder el equilibrio"),
 ("Vitesse de déplacement puis freinage contrôlé", "Movement speed then controlled braking", "Velocidad de desplazamiento y después frenada controlada"),
 ("Sprint, ralenti en pas chassés, position basse à l'arrivée",
  "Sprint, slow down into shuffle steps, low stance on arrival",
  "Esprint, frenada en pasos laterales, posición baja a la llegada"),
 ("Empêcher le tir sans se faire éliminer en sautant", "Prevent the shot without getting beaten by jumping", "Impedir el tiro sin dejarse superar saltando"),
 ("Vitesse du premier pas et gainage", "First-step speed and core strength", "Velocidad del primer paso y fuerza del core"),
 ("Feinte, changement de main bas, premier pas explosif", "Fake, low hand change, explosive first step", "Amago, cambio de mano bajo, primer paso explosivo"),
 ("Éliminer un défenseur en un dribble pour attaquer le panier", "Beat a defender in one dribble to attack the hoop", "Superar a un defensor en un bote para atacar la canasta"),
 ("À 4-5 m du panier, face au cercle. Un passeur te fait la passe (ou un sac de ballons si tu es seul) ; change de côté à chaque série.",
  "4-5 m from the hoop, facing the rim. A teammate passes you the ball (or a bag of balls if you're alone); switch sides each set.",
  "A 4-5 m de la canasta, de cara al aro. Un compañero te hace el pase (o una bolsa de balones si estás solo); cambia de lado en cada serie."),
 ("Départ en aide près de la raquette, un partenaire fait office de tireur à 4-6 m ; on tourne après chaque série.",
  "Start in help position near the paint, a partner acts as the shooter 4-6 m away; rotate after each set.",
  "Salida en ayuda cerca de la zona, un compañero hace de tirador a 4-6 m; rotad después de cada serie."),
 ("2-3 m face à un défenseur (ou un plot pour travailler seul) ; alterne les côtés à chaque série.",
  "2-3 m facing a defender (or a cone to work alone); alternate sides each set.",
  "A 2-3 m frente a un defensor (o un cono para trabajar solo); alterna los lados en cada serie."),
 ("Tir après un dribble plutôt qu'une passe", "Shot off the dribble rather than a pass", "Tiro tras un bote en lugar de un pase"),
 ("Tir sous la pression d'un défenseur passif qui lève un bras", "Shot under pressure from a passive defender raising an arm", "Tiro bajo presión de un defensor pasivo que levanta un brazo"),
 ("Tir à 3 points pour les joueurs confirmés", "3-point shot for confirmed players", "Tiro de 3 puntos para jugadores avanzados"),
 ("Distance de départ plus longue", "Longer starting distance", "Mayor distancia de salida"),
 ("Le tireur peut partir en dribble à la réception", "The shooter can drive on the dribble after the catch", "El tirador puede irse en bote al recibir"),
 ("Deux close-out d'affilée (aide puis rotation)", "Two close-outs in a row (help then rotation)", "Dos close-out seguidos (ayuda y después rotación)"),
 ("Crossover entre les jambes plutôt que devant", "Between-the-legs crossover instead of in front", "Crossover entre las piernas en lugar de por delante"),
 ("Défenseur qui réagit vraiment (pas seulement passif)", "A defender who really reacts (not just passive)", "Un defensor que reacciona de verdad (no solo pasivo)"),
 ("Crossover suivi d'un tir ou d'une passe", "Crossover followed by a shot or a pass", "Crossover seguido de un tiro o un pase"),
 ("Réception + petit saut", "Catch + small jump", "Recepción + pequeño salto"),
 ("Départ (aide)", "Start (help)", "Salida (ayuda)"),
 ("Tireur", "Shooter", "Tirador"),
 ("Petits pas, mains hautes", "Shuffle steps, hands up", "Pasos cortos, manos arriba"),
 ("Feinte (dribble fort)", "Fake (hard dribble)", "Amago (bote fuerte)"),
 ("Change de main, accélère", "Change hands, accelerate", "Cambia de mano, acelera"),
]

def norm(s):
    s = re.sub(r"[  ]", " ", str(s))
    return re.sub(r"\s+", " ", s).strip()

def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]

I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add_t, upd = 0, 0
for k_raw, t_en, t_es in T:
    k = norm(k_raw)
    hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "literal", "where": "src/i18n-basket", "n": 1}); add_t += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es

(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} textes traites | {add_t} ajoutes a _textes.json | {upd} traductions ecrites")
