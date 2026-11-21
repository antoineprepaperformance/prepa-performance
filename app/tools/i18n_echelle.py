# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main pour l'echelle des tests de la carte athlete (21 novembre 2026).
Meme mecanisme que i18n_main.py. A lancer depuis app/ : python3 tools/i18n_echelle.py

Le nom du palier « Haut niveau · trois-quarts » est compose a l'execution : il est decoupe par la CSS en
deux noeuds (« Haut niveau » existe deja, le poste aussi), donc rien a traduire de plus pour lui.
"""
import hashlib, json, pathlib, re

T = [
 ("Bon niveau", "Good level", "Buen nivel", False),
 ("Record du monde", "World record", "Récord del mundo", False),
 ("Tous les paliers connus sont atteints.", "Every known step is reached.", "Todos los niveles conocidos están alcanzados.", False),
 ("Prochain palier : bon niveau — il te reste {} (tu en es à {#} %).",
  "Next step: good level — {} to go (you are at {#} %).",
  "Siguiente nivel: buen nivel — te faltan {} (estás al {#} %).", True),
 ("Prochain palier : record du monde — il te reste {} (tu en es à {#} %).",
  "Next step: world record — {} to go (you are at {#} %).",
  "Siguiente nivel: récord del mundo — te faltan {} (estás al {#} %).", True),
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
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-echelle", "n": 1}); add += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} textes traites | {add} ajoutes | {upd} ecrits" + (f" | {souci} a revoir" if souci else ""))

# ---- avant le premier test (21 novembre, soir) ----
T2 = [
 ("pas encore mesuré", "not measured yet", "aún sin medir", False),
 ("Pas encore de test : voilà ce qu'il y a à viser dans ton sport, et à ton poste. Fais-en un et tu te situeras tout de suite.",
  "No test yet: here is what there is to aim for in your sport, and in your position. Do one and you will know where you stand right away.",
  "Aún sin test: esto es lo que hay que buscar en tu deporte y en tu puesto. Haz uno y sabrás dónde estás al momento.", False),
]
add2, upd2 = 0, 0
for fr, t_en, t_es, motif in T2:
    k = norm(fr); hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-echelle", "n": 1}); add2 += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd2 += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"second lot : {len(T2)} textes | {add2} ajoutes | {upd2} ecrits")
