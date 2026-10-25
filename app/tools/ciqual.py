#!/usr/bin/env python3
"""Table Ciqual de l'ANSES (fichier CSV officiel, séparateur tabulation) -> ciqual.json compact pour l'application.

Usage : python3 ciqual.py <fichier.csv> <sortie.json> [version] [date]
Colonnes gardées pour 100 g : énergie (kcal, règlement UE 1169/2011), protéines (N x facteur de Jones), glucides,
lipides, sucres, fibres, sel. « - » (non mesuré) -> null ; « traces » -> 0 ; « < x » -> x / 2.
Énergie absente mais protéines, glucides et lipides connus : recalculée (4, 4, 9 kcal/g, fibres 2 kcal/g)."""
import csv, json, re, sys

COLS = {"kcal": "Energie, Règlement UE N° 1169 2011 (kcal 100 g)", "p": "Protéines, N x facteur de Jones (g 100 g)",
        "c": "Glucides (g 100 g)", "f": "Lipides (g 100 g)", "s": "Sucres (g 100 g)", "fi": "Fibres alimentaires (g 100 g)",
        "sel": "Sel chlorure de sodium (g 100 g)"}
ORDER = ["kcal", "p", "c", "f", "s", "fi", "sel"]


def val(x):
    x = (x or "").strip().replace(" ", " ")
    if x in ("", "-"):
        return None
    if x.lower().startswith("trace"):
        return 0
    m = re.match(r"^<\s*([0-9]+(?:[.,][0-9]+)?)$", x)
    if m:
        return round(float(m.group(1).replace(",", ".")) / 2, 3)
    try:
        return float(x.replace(",", ".").replace(" ", ""))
    except ValueError:
        return None


def rnd(v):
    if v is None:
        return None
    r = round(v, 1) if v >= 10 else round(v, 2)
    return int(r) if r == int(r) else r


def build(path, version="", date=""):
    rows = list(csv.reader(open(path, encoding="utf-8-sig"), delimiter="\t"))
    head = [" ".join(h.split()) for h in rows[0]]
    idx = {k: head.index(v) for k, v in COLS.items()}
    i_code, i_nom, i_grp, i_sg = head.index("alim_code"), head.index("alim_nom_fr"), head.index("alim_grp_nom_fr"), head.index("alim_ssgrp_nom_fr")
    groups, foods, seen = [], [], set()
    for r in rows[1:]:
        if len(r) < len(head) - 5 or not r[i_code].strip():
            continue
        code = int(r[i_code])
        if code in seen:
            continue
        seen.add(code)
        g = (r[i_sg] or r[i_grp] or "aliments moyens").strip()
        if g not in groups:
            groups.append(g)
        v = {k: val(r[idx[k]]) for k in ORDER}
        # énergie non mesurée : recalculée avec les coefficients du règlement UE 1169/2011 (4, 4, 9, 2 kcal/g)
        if v["kcal"] is None and None not in (v["p"], v["c"], v["f"]):
            v["kcal"] = 4 * v["p"] + 4 * v["c"] + 9 * v["f"] + 2 * (v["fi"] or 0)
        foods.append([code, " ".join(r[i_nom].split()), groups.index(g)] + [rnd(v[k]) for k in ORDER])
    if len(foods) < 2000 or not any(f[3] for f in foods):
        raise SystemExit("Table Ciqual inattendue : " + str(len(foods)) + " aliments")
    return {"v": version, "date": date, "src": "Anses. Table de composition nutritionnelle des aliments Ciqual " + version + ". https://ciqual.anses.fr",
            "cols": ["code", "nom", "groupe"] + ORDER, "groupes": groups, "f": foods}


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    m = re.search(r"CIQUAL(\d{4})_FR_(\d{4})_(\d{2})_(\d{2})", src)
    version = sys.argv[3] if len(sys.argv) > 3 else (m.group(1) if m else "")
    date = sys.argv[4] if len(sys.argv) > 4 else (m.group(2) + "-" + m.group(3) + "-" + m.group(4) if m else "")
    out = build(src, version, date)
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(out["f"]), "aliments,", len(out["groupes"]), "groupes ->", dst)
