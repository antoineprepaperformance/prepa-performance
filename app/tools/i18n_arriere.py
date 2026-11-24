# -*- coding: utf-8 -*-
"""Applique les lots de traduction de l'arriere (24 novembre 2026).

L'arriere : environ 400 textes livres sans anglais ni espagnol, parce que le controle de completude
(node tools/i18n_extract.mjs --manque) ne pouvait pas tourner — node n'etait pas installe sur le Mac.

Les lots sont dans i18n/work/arriere_*.json : une liste d'objets {fr, en, es}. Les noms propres
(athletes, marques) se traduisent par eux-memes : c'est volontaire, un nom ne se traduit pas, et
l'identite explicite vaut mieux qu'une regle cachee dans l'extracteur.

A lancer depuis app/ : python3 tools/i18n_arriere.py
"""
import hashlib, json, pathlib, re, sys


def norm(s): return re.sub(r"\s+", " ", re.sub(r"[  ]", " ", str(s))).strip()
def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]


I18N = pathlib.Path("i18n")
WORK = I18N / "work"
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}

lots = sorted(WORK.glob("arriere_*.json"))
if not lots:
    print("aucun lot dans i18n/work/"); sys.exit(1)
add = upd = souci = 0
vus = set()
for lot in lots:
    for e in json.loads(lot.read_text(encoding="utf-8")):
        k = norm(e["fr"]); t_en, t_es = e["en"], e["es"]
        if k in vus:
            print(f"ATTENTION doublon ({lot.name}) : {k[:60]}"); souci += 1
        vus.add(k)
        for pat in (r"\{\}", r"\{#\}"):
            a, b, c = (len(re.findall(pat, x)) for x in (k, t_en, t_es))
            if a != b or a != c:
                print(f"ATTENTION trous {pat} ({a} fr, {b} en, {c} es) dans {lot.name} : {k[:60]}"); souci += 1
        hh = known[k]["h"] if k in known else h(k)
        if k not in known:
            textes.append({"h": hh, "k": k, "kind": "pattern" if ("{}" in k or "{#}" in k) else "string",
                           "where": "i18n/work/" + lot.name, "n": 1})
            known[k] = textes[-1]; add += 1
        if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
        en[hh] = t_en; es[hh] = t_es

(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(lots)} lot(s) | {len(vus)} textes | {add} ajoutes | {upd} ecrits" + (f" | {souci} a revoir" if souci else ""))
sys.exit(1 if souci else 0)
