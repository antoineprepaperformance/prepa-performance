# -*- coding: utf-8 -*-
"""Traduction du palier franchi sur l'echelle de la carte (22 novembre 2026).
A lancer depuis app/ : python3 tools/i18n_franchi.py

La date elle-meme est deja dans la langue du client (toLocaleDateString avec LOCALE) : seule la phrase
qui l'entoure se traduit, en motif.
"""
import hashlib, json, pathlib, re

T = [
 ("franchi le {}", "cleared on {}", "superado el {}", True),
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
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-franchi", "n": 1}); add += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} texte traite | {add} ajoute | {upd} ecrit" + (f" | {souci} a revoir" if souci else ""))
