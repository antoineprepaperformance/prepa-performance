# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main pour la repartition de la semaine (19 novembre 2026), quand Node n'est
pas disponible. Meme mecanisme que i18n_main.py : voir ce fichier pour le detail. A lancer depuis app/ :
python3 tools/i18n_semaine.py

Deux formes : des textes simples, et des MOTIFS ({} un morceau quelconque, {#} un nombre) pour les phrases
composees a l'execution. Un motif ne franchit ni « · » ni « — » : c'est pourquoi l'affichage decoupe les
resumes jour par jour au lieu d'une seule chaine.
"""
import hashlib, json, pathlib, re

# (francais, anglais, espagnol, motif ?)
T = [
 # ---- le choix, dans le profil du client ----
 ("Ma répartition dans la semaine", "My week layout", "Mi reparto en la semana", False),
 ("Tu places chaque séance sur le jour qui t'arrange. Ta page du jour suit cette répartition ; une séance non faite reste à rattraper, rien n'est perdu.",
  "You put each session on the day that suits you. Your daily page follows this layout; a session you have not done stays to be caught up, nothing is lost.",
  "Colocas cada sesión en el día que te convenga. Tu página del día sigue este reparto; una sesión no hecha queda por recuperar, no se pierde nada.", False),
 ("Répartir automatiquement", "Spread automatically", "Repartir automáticamente", False),
 ("Répartition", "Layout", "Reparto", False),
 ("{#} jours d'entraînement par semaine.", "{#} training days per week.", "{#} días de entrenamiento por semana.", True),
 ("{#} jour d'entraînement par semaine.", "{#} training day per week.", "{#} día de entrenamiento por semana.", True),
 ("Une séance revient {#} fois dans la semaine.", "One session comes back {#} times in the week.", "Una sesión se repite {#} veces en la semana.", True),
 ("Tu ne peux pas descendre en dessous de {#} jours : en dessous, une de tes séances ne passerait pas.",
  "You cannot go below {#} days: below that, one of your sessions would not fit in the week.",
  "No puedes bajar de {#} días: por debajo, una de tus sesiones no entraría en la semana.", True),
 # ---- les jours (en entier : un jour abrege comme « Mar » voudrait dire mars en anglais) ----
 ("Lundi", "Monday", "Lunes", False),
 ("Mardi", "Tuesday", "Martes", False),
 ("Mercredi", "Wednesday", "Miércoles", False),
 ("Jeudi", "Thursday", "Jueves", False),
 ("Vendredi", "Friday", "Viernes", False),
 ("Samedi", "Saturday", "Sábado", False),
 ("Dimanche", "Sunday", "Domingo", False),
 # ---- la page du jour ----
 ("{}repos aujourd'hui", "{}rest day today", "{}hoy toca descanso", True),
 ("{}aujourd'hui : {}", "{}today: {}", "{}hoy: {}", True),
 ("{}à rattraper : {}", "{}to catch up: {}", "{}por recuperar: {}", True),
 ("{#} séances à rattraper.", "{#} sessions to catch up.", "{#} sesiones por recuperar.", True),
 ("{#} séance à rattraper.", "{#} session to catch up.", "{#} sesión por recuperar.", True),
 ("Rien n'est perdu : tu les retrouves dans ta semaine.", "Nothing is lost: you will find them in your week.", "No se pierde nada: las encuentras en tu semana.", False),
 ("Prochaine séance :", "Next session:", "Próxima sesión:", False),
 ("à rattraper", "to catch up", "por recuperar", False),
]


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[  ]", " ", str(s))).strip()


def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]


I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add, upd, souci = 0, 0, 0
for fr, t_en, t_es, motif in T:
    k = norm(fr)
    hh = h(k)
    # autant de trous et de nombres de chaque cote, sinon le motif ne se rejoue pas
    for pat in (r"\{\}", r"\{#\}"):
        a, b, c = (len(re.findall(pat, x)) for x in (k, t_en, t_es))
        if a != b or a != c:
            print(f"ATTENTION trous {pat} ({a} fr, {b} en, {c} es) : {k[:60]}"); souci += 1
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-semaine", "n": 1}); add += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es

(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} textes traites | {add} ajoutes a _textes.json | {upd} traductions ecrites" + (f" | {souci} a revoir" if souci else ""))

# ---- deuxieme lot (19 novembre, apres retour d'Antoine : le reglage etait introuvable) ----
T2 = [
 ("Mes jours", "My days", "Mis días", False),
 ("Choisir mes jours", "Choose my days", "Elegir mis días", False),
 ("Mes jours d'entraînement", "My training days", "Mis días de entrenamiento", False),
 ("Combien de séances par semaine", "How many sessions per week", "Cuántas sesiones por semana", False),
 ("Quel jour, quelle séance", "Which day, which session", "Qué día, qué sesión", False),
 ("Enregistrer mes jours", "Save my days", "Guardar mis días", False),
 ("Tes jours sont enregistrés.", "Your days are saved.", "Tus días están guardados.", False),
 ("Choisis tes jours : tu places chaque séance sur le jour qui t'arrange.",
  "Choose your days: you put each session on the day that suits you.",
  "Elige tus días: colocas cada sesión en el día que te convenga.", False),
 ("Ta page du jour suit ces jours. Une séance non faite reste à rattraper, rien n'est perdu.",
  "Your daily page follows these days. A session you have not done stays to be caught up, nothing is lost.",
  "Tu página del día sigue estos días. Una sesión no hecha queda por recuperar, no se pierde nada.", False),
]
add2, upd2 = 0, 0
for fr, t_en, t_es, motif in T2:
    k = norm(fr); hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-semaine", "n": 1}); add2 += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd2 += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"second lot : {len(T2)} textes | {add2} ajoutes | {upd2} ecrits")

# ---- troisieme lot (21 novembre : « je n'arrive pas a changer mon programme depuis mon profil ») ----
T3 = [
 ("Ce que tu travailles, ton matériel et tes jours d'entraînement : tout se change ici.",
  "What you train, your equipment and your training days: everything is changed here.",
  "Lo que trabajas, tu material y tus días de entrenamiento: todo se cambia aquí.", False),
 ("Ce que je travaille", "What I train", "Lo que trabajo", False),
 ("Mes jours", "My days", "Mis días", False),
 ("{#} séances par semaine, à placer sur les jours que tu veux", "{#} sessions per week, to put on the days you want", "{#} sesiones por semana, para colocar en los días que quieras", True),
 ("{#} séance par semaine, à placer sur les jours que tu veux", "{#} session per week, to put on the days you want", "{#} sesión por semana, para colocar en los días que quieras", True),
 ("« Modifier » ouvre les trois : musculation, cardio et nutrition (tu peux n'en garder qu'une), ton matériel, et le jour de chaque séance.",
  "« Modifier » opens all three: strength, cardio and nutrition (you may keep only one), your equipment, and the day of each session.",
  "« Modificar » abre las tres: musculación, cardio y nutrición (puedes quedarte con una sola), tu material y el día de cada sesión.", False),
]
add3, upd3 = 0, 0
for fr, t_en, t_es, motif in T3:
    k = norm(fr); hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-semaine", "n": 1}); add3 += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd3 += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"troisieme lot : {len(T3)} textes | {add3} ajoutes | {upd3} ecrits")
