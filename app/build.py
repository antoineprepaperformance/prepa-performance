# -*- coding: utf-8 -*-
"""Assemble l'application : dist/index.html (publication) et test/index.html (tests locaux)."""
import json, pathlib, sys
ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
sys.path.insert(0, str(ROOT))
from content_exercises import LIB
from content_programs import PROGRAMS, T, TESTS, CHECKIN, SCREENING, OFFERS
from content_niveaux import NIVEAU_CONTENT
from content_extras import EXTRAS_CONTENT
from content_recettes import RECETTES_CONTENT
from content_nutri import NUTRI_CONTENT, CIQ   # valeurs de la table Ciqual (ANSES) : aliments courants et ingrédients des recettes
from content_sports import SPORTS_CONTENT, EX_SPORT, TESTS_SPORT
LIB = LIB + EX_SPORT
TESTS = {**TESTS, **TESTS_SPORT}

content = {"version": 1, "T": T, "E": LIB, "P": PROGRAMS, "TESTS": TESTS, "CHECKIN": CHECKIN, "SCREENING": SCREENING, "OFFERS": OFFERS, **NIVEAU_CONTENT, **EXTRAS_CONTENT, **RECETTES_CONTENT, **SPORTS_CONTENT, **NUTRI_CONTENT}
cjson = json.dumps(content, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
ciqjson = json.dumps(CIQ, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
(ROOT / "content.json").write_text(json.dumps(content, ensure_ascii=False, indent=1))
from i18n_build import dictionaries
I18N = dictionaries()
i18njs = {l: json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") for l, d in I18N.items()}
js = "\n".join((SRC / f).read_text() for f in ["00_i18n.js", "01_core.js", "02_data.js", "03_ui.js", "04_client.js", "05_coach.js", "06_library.js", "08_ai.js", "09_nutrition.js", "10_card.js", "12_niveau.js", "13_acces.js", "14_motion.js", "15_moves.js", "16_video.js", "17_extras.js", "18_sante.js", "19_recettes.js", "20_terrain.js", "21_messages.js", "22_ciqual.js", "23_profil.js", "24_finances.js", "07_main.js"])
css = (SRC / "styles.css").read_text()
assert "</script" not in js

HEAD = """<title>Antoine Prépa Performance</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap">
"""
def page(libs):
    return (HEAD + "<style>\n" + css + "\n</style>\n<div id=\"root\"></div>\n"
            + "<script id=\"app-content\" type=\"application/json\">" + cjson + "</script>\n"
            + "<script id=\"ciqual-data\" type=\"application/json\">" + ciqjson + "</script>\n"
            + "".join("<script id=\"i18n-%s\" type=\"application/json\">%s</script>\n" % (l, d) for l, d in i18njs.items())
            + "".join('<script src="%s"></script>\n' % u for u in libs)
            + "<script>\n" + js + "\n</script>\n")

CDN = ["https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
       "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
       "https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"]
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "index.html").write_text(page(CDN))

t = ROOT / "test"; (t / "vendor").mkdir(parents=True, exist_ok=True)
import shutil
for src, dst in [("vendor/react-18.3.1/package/umd/react.development.js", "react.development.js"), ("vendor/react-dom-18.3.1/package/umd/react-dom.development.js", "react-dom.development.js"),
                 ("vendor/htm-3.1.1/package/dist/htm.umd.js", "htm.umd.js"), ("vendor/zxing-0.21.3/package/umd/index.min.js", "zxing.min.js")]:
    if (ROOT / src).exists():
        shutil.copy(ROOT / src, t / "vendor" / dst)  # sinon : voir vendor/LISEZMOI.md
# sans app/vendor/ (dépôt cloné tel quel) : on reprend les bibliothèques déjà publiées dans docs/vendor
PUB = (ROOT.parent / "docs" / "vendor") if (ROOT.parent / "MISE_EN_LIGNE.md").exists() else (ROOT.parent / "repo" / "docs" / "vendor")
DEV = (t / "vendor" / "react.development.js").exists()
if not DEV and PUB.exists():
    for f in ["react.production.min.js", "react-dom.production.min.js", "htm.umd.js", "zxing.min.js"]:
        if (PUB / f).exists() and not (t / "vendor" / f).exists():
            shutil.copy(PUB / f, t / "vendor" / f)
LOCAL = (["vendor/react.development.js", "vendor/react-dom.development.js", "vendor/htm.umd.js"] if DEV
         else ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "vendor/htm.umd.js"])
skeleton = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>'
            '<script src="mock.js"></script></head><body>')
(t / "index.html").write_text(skeleton + page(LOCAL) + "</body></html>")
print("dist", len((ROOT / "dist" / "index.html").read_text().encode()) // 1024, "Ko")
