# -*- coding: utf-8 -*-
"""Rassemble les traductions préparées par lots (i18n/work/bNN.json : {empreinte: [anglais, espagnol]})
dans i18n/en.json et i18n/es.json, après vérification (empreinte connue, mêmes {} que le français)."""
import json, pathlib, re, sys
R = pathlib.Path(__file__).resolve().parent.parent / "i18n"
textes = {e["h"]: e for e in json.loads((R / "_textes.json").read_text(encoding="utf-8"))}
out = {"en": {}, "es": {}}
for l in out:
    p = R / (l + ".json")
    if p.exists():
        out[l] = json.loads(p.read_text(encoding="utf-8"))
err = 0
def ph(s): return len(re.findall(r"\{[\d#]*\}", s))
for f in sorted((R / "work").glob("b*.json")):
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        print("JSON", f.name, e); err += 1; continue
    for h, v in d.items():
        if h not in textes:
            continue  # texte retiré ou modifié depuis : sa traduction n'est plus utilisée
        k = textes[h]["k"]
        if not (isinstance(v, list) and len(v) == 2 and all(isinstance(x, str) and x.strip() for x in v)):
            print("forme", f.name, h); err += 1; continue
        for l, t in zip(["en", "es"], v):
            if ph(t) != ph(k):
                print("motif", f.name, h, l, repr(k), repr(t)); err += 1; continue
            out[l][h] = t
for l, d in out.items():
    d = {h: t for h, t in d.items() if h in textes}
    out[l] = d
    (R / (l + ".json")).write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=0), encoding="utf-8")
print("en", len(out["en"]), "es", len(out["es"]), "sur", len(textes), "erreurs", err)
sys.exit(1 if err else 0)
