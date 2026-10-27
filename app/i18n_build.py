# -*- coding: utf-8 -*-
"""Dictionnaires de traduction pour les deux versions : {texte français : traduction} par langue.
Sources : i18n/_textes.json (textes extraits par tools/i18n_extract.mjs, avec leur empreinte « h »)
et i18n/en.json, i18n/es.json ({empreinte : traduction})."""
import json, pathlib
I18N = pathlib.Path(__file__).parent / "i18n"
LANGS = ["en", "es"]


def dictionaries():
    out = {l: {} for l in LANGS}
    f = I18N / "_textes.json"
    if not f.exists():
        return out
    textes = json.loads(f.read_text(encoding="utf-8"))
    for l in LANGS:
        p = I18N / (l + ".json")
        tr = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
        for e in textes:
            t = tr.get(e["h"])
            if isinstance(t, str) and t.strip():
                out[l][e["k"]] = t
    return out
