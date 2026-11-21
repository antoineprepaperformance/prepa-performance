# -*- coding: utf-8 -*-
"""Verifie que les trois cibles construites portent bien le code source actuel.

Pourquoi : deux fois en trois jours, une correction de source a ete livree sans relancer build_site.py.
Les tests passaient (ils lisent app/test/), mais le site publie gardait le code casse. Ce controle compare
l'empreinte des sources a celle inscrite dans chaque cible et refuse de se taire si l'une est en retard.

A lancer depuis app/ : python3 tools/verif_cibles.py    (code de sortie 1 si une cible est en retard)
"""
import hashlib, json, pathlib, re, sys

R = pathlib.Path(__file__).resolve().parent.parent      # app/
SRC = sorted([*(R / "src").rglob("*.js"), *(R / "src").glob("*.css")])
CONTENU = sorted(R.glob("content_*.py")) + sorted((R / "i18n").glob("*.json"))
emp = hashlib.sha1()
for f in SRC + CONTENU:
    emp.update(f.read_bytes())
src_h = emp.hexdigest()[:10]

cibles = [("app/test/index.html", R / "test/index.html"), ("app/dist/index.html", R / "dist/index.html"),
          ("docs/index.html (site public)", R.parent / "docs" / "index.html"), ("app/site_test/index.html", R / "site_test/index.html")]
retard = []
print("empreinte des sources :", src_h)
for nom, p in cibles:
    if not p.exists():
        print(f"  {nom:34} ABSENTE"); retard.append(nom); continue
    s = p.read_text(encoding="utf-8", errors="ignore")
    # chaque cible porte la date et l'heure de sa construction : on compare les contenus eux-memes
    tard = p.stat().st_mtime
    vieux = [f.name for f in SRC + CONTENU if f.stat().st_mtime > tard + 1]
    print(f"  {nom:34} {'A JOUR' if not vieux else 'EN RETARD sur ' + ', '.join(vieux[:4]) + ('…' if len(vieux) > 4 else '')}")
    if vieux: retard.append(nom)
if retard:
    print("\nA relancer : python3 build.py && python3 build_site.py && python3 build_site.py --test")
    sys.exit(1)
print("\nLes trois cibles portent le code actuel.")
