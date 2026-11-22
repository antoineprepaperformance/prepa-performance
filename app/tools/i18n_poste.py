# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main pour le repere du poste sur l'echelle (22 novembre 2026).
Meme mecanisme que i18n_echelle.py. A lancer depuis app/ : python3 tools/i18n_poste.py

Le palier ne s'appelle plus « Haut niveau » (qui est aussi le nom d'un profil, d'ou la confusion) mais
porte ce qu'est reellement le chiffre : « Moyenne des internationaux », suivi du nom lisible du poste.
Le nom du poste est deja traduit ailleurs : ici on traduit la phrase qui l'entoure, en motif.
"""
import hashlib, json, pathlib, re

T = [
 ("Moyenne des internationaux", "International average", "Media de los internacionales", False),
 ("Moyenne des internationaux · {}", "International average · {}", "Media de los internacionales · {}", True),
 ("Sur certains tests, un palier est calé sur ton sport et ton poste, pas seulement sur une moyenne générale.",
  "On some tests, one step is set on your sport and your position, not only on a general average.",
  "En algunos test, un nivel se ajusta a tu deporte y a tu puesto, no solo a una media general.", False),
 ("Prochain palier : moyenne des internationaux — il te reste {} (tu en es à {#} %).",
  "Next step: international average — {} to go (you are at {#} %).",
  "Siguiente nivel: media de los internacionales — te faltan {} (estás al {#} %).", True),
 ("Prochain palier : moyenne des internationaux · {} — il te reste {} (tu en es à {#} %).",
  "Next step: international average · {} — {} to go (you are at {#} %).",
  "Siguiente nivel: media de los internacionales · {} — te faltan {} (estás al {#} %).", True),
]


def norm(s): return re.sub(r"\s+", " ", re.sub(r"[  ]", " ", str(s))).strip()
def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]


I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add, upd, souci = 0, 0, 0
for fr, t_en, t_es, motif in T:
    k = norm(fr); hh = h(k)
    for pat in (r"\{\}", r"\{#\}"):
        a, b, c = (len(re.findall(pat, x)) for x in (k, t_en, t_es))
        if a != b or a != c:
            print(f"ATTENTION trous {pat} ({a} fr, {b} en, {c} es) : {k[:60]}"); souci += 1
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-poste", "n": 1}); add += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} textes traites | {add} ajoutes | {upd} ecrits" + (f" | {souci} a revoir" if souci else ""))

# ---- la phrase « méthode » du bloc scientifique de la carte (meme jour) ----
# L'ancienne version etait traduite : en lui ajoutant une phrase, on cree un texte neuf.
# On reprend donc la traduction existante, augmentee de la meme phrase.
T2 = [
 ("Comparer une charge entre athlètes de poids différents se fait avec une échelle allométrique (force proportionnelle au poids de corps "
  "à la puissance 0,67 ; Jaric, 2002). Records : World Athletics (100 m, 3 000 m, 5 000 m), Helene et Yamashita (temps de passage du 9 s 58), IPF (championnats du monde classique 2025). "
  "Un repère par poste n'est affiché que si l'étude le mesure comme le test de l'appli : c'est le cas des charges (3 à 5 répétitions, maximum estimé), pas des sprints au portique.",
  "Loads are compared between athletes of different body weights with allometric scaling (strength proportional to body weight to the power 0.67; Jaric, 2002). "
  "Records: World Athletics (100 m, 3,000 m, 5,000 m), Helene and Yamashita (split times of the 9.58), IPF (Classic World Championships 2025). "
  "A position benchmark is only shown when the study measures it the way the app's test does: that is the case for loads (3 to 5 reps, estimated maximum), not for gate-timed sprints.",
  "Para comparar cargas entre atletas de distinto peso se usa una escala alométrica (fuerza proporcional al peso corporal elevado a 0,67; Jaric, 2002). "
  "Récords: World Athletics (100 m, 3000 m, 5000 m), Helene y Yamashita (tiempos de paso del 9 s 58), IPF (Mundial clásico 2025). "
  "Una referencia por puesto solo se muestra si el estudio la mide como el test de la aplicación: es el caso de las cargas (3 a 5 repeticiones, máximo estimado), no de los sprints con fotocélulas.", False),
]
add2, upd2 = 0, 0
for fr, t_en, t_es, motif in T2:
    k = norm(fr); hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-poste", "n": 1}); add2 += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd2 += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"second lot : {len(T2)} texte | {add2} ajoute | {upd2} ecrit")
