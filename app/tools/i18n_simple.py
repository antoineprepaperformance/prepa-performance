# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main pour l'affichage simplifie et le sommaire des reglages (21 novembre 2026).
A lancer depuis app/ : python3 tools/i18n_simple.py
"""
import hashlib, json, pathlib, re

T = [
 ("Afficher tout ce que l'application sait faire", "Show everything the app can do", "Mostrar todo lo que la aplicación sabe hacer"),
 ("Revenir à l'affichage simple", "Back to the simple view", "Volver a la vista sencilla"),
 ("Affichage simplifié : l'essentiel d'abord. Tout le reste est là, en un bouton.",
  "Simplified view: the essentials first. Everything else is one button away.",
  "Vista simplificada: lo esencial primero. Todo lo demás está a un botón."),
 ("Ce que je veux voir sur ma page du jour", "What I want on my daily page", "Lo que quiero ver en mi página del día"),
 ("L'essentiel", "The essentials", "Lo esencial"),
 ("Tout", "Everything", "Todo"),
 ("« L'essentiel » garde ta séance du jour, ta semaine, les messages de ton coach et la nutrition. « Tout » ajoute ta régularité, ta carte, tes habitudes, la séance terrain, les séances en plus et l'article.",
  "« The essentials » keeps your session of the day, your week, your coach's messages and nutrition. « Everything » adds your consistency, your card, your habits, the field session, the extra sessions and the article.",
  "« Lo esencial » mantiene tu sesión del día, tu semana, los mensajes de tu entrenador y la nutrición. « Todo » añade tu regularidad, tu carta, tus hábitos, la sesión de campo, las sesiones extra y el artículo."),
 ("Choisir bloc par bloc", "Choose block by block", "Elegir bloque por bloque"),
 ("Mes réglages", "My settings", "Mis ajustes"),
 ("Tout ce que tu peux changer, au même endroit. Touche une ligne pour y aller.",
  "Everything you can change, in one place. Tap a line to go there.",
  "Todo lo que puedes cambiar, en un mismo lugar. Toca una línea para ir allí."),
 ("Mes jours d'entraînement, ce que je travaille, mon matériel", "My training days, what I train, my equipment", "Mis días de entrenamiento, lo que trabajo, mi material"),
 ("Mes objectifs", "My goals", "Mis objetivos"),
 ("Ce que je cherche à obtenir", "What I am aiming for", "Lo que busco conseguir"),
 ("Mon sport et mon poste", "My sport and my position", "Mi deporte y mi puesto"),
 ("Pour adapter les séances terrain et les repères", "To adapt the field sessions and the benchmarks", "Para adaptar las sesiones de campo y los referentes"),
 ("Mes mesures", "My measurements", "Mis medidas"),
 ("Taille, poids, tours : pour calculer mes charges et ma progression", "Height, weight, girths: to work out my loads and my progress", "Altura, peso, perímetros: para calcular mis cargas y mi progreso"),
 ("La langue", "Language", "El idioma"),
 ("Français, anglais, espagnol", "French, English, Spanish", "Francés, inglés, español"),
 ("L'affichage", "The display", "La visualización"),
 ("L'essentiel ou tout, le thème, la taille du texte", "The essentials or everything, the theme, the text size", "Lo esencial o todo, el tema, el tamaño del texto"),
 ("Mes commandes", "My orders", "Mis pedidos"),
 ("Ma formule, mes factures, la résiliation", "My plan, my invoices, cancelling", "Mi fórmula, mis facturas, la baja"),
]


def norm(s): return re.sub(r"\s+", " ", re.sub(r"[  ]", " ", str(s))).strip()
def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]


I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add, upd = 0, 0
for fr, t_en, t_es in T:
    k = norm(fr); hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "string", "where": "src/i18n-simple", "n": 1}); add += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} textes traites | {add} ajoutes | {upd} ecrits")

# ---- un seul compte : l'espace athlete du coach (21 novembre, nuit) ----
T2 = [
 ("Mon espace athlète", "My athlete space", "Mi espacio de atleta"),
 ("Ton espace athlète", "Your athlete space", "Tu espacio de atleta"),
 ("Revenir à mon espace coach", "Back to my coach space", "Volver a mi espacio de entrenador"),
]
add2, upd2 = 0, 0
for fr, t_en, t_es in T2:
    k = norm(fr); hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "string", "where": "src/i18n-simple", "n": 1}); add2 += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd2 += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"second lot : {len(T2)} textes | {add2} ajoutes | {upd2} ecrits")
