"""Tests du robot Instagram (outils/instagram.py) et des semaines prêtes dans docs/reseaux/.

- choix de ce qui part : à l'heure, pas en avance, pas deux fois, pas après 36 h de retard, jamais si "auto" est faux ;
- appels à l'API (simulés) : post simple, carrousel dans l'ordre, légende jointe ;
- chaque semaine : images JPEG au bon format, légendes et hashtags dans les limites d'Instagram,
  aucune compétition nommée (code du sport, art. L333-1), aucune story automatique sans accord.
"""
import datetime as dt, json, pathlib, sys
from PIL import Image

RACINE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "outils"))
import instagram as ig  # noqa: E402

ok = ko = 0
def verif(cond, msg):
    global ok, ko
    if cond: ok += 1
    else: ko += 1; print("FAIL", msg)

P = ig.PARIS
pubs = [{"id": "a", "quand": "2026-11-10T18:30", "type": "post", "images": ["x.jpg"], "auto": True, "legende": "L"},
        {"id": "b", "quand": "2026-11-10T18:30", "type": "story", "images": ["y.jpg"], "auto": False}]
vide = {"publie": {}, "erreurs": {}}
verif(ig.a_publier(pubs, vide, dt.datetime(2026, 11, 10, 18, 29, tzinfo=P)) == [], "rien avant l'heure")
verif([p["id"] for p in ig.a_publier(pubs, vide, dt.datetime(2026, 11, 10, 18, 37, tzinfo=P))] == ["a"], "le post part à l'heure, pas la story manuelle")
verif(ig.a_publier(pubs, {"publie": {"a": {}}, "erreurs": {}}, dt.datetime(2026, 11, 10, 19, 7, tzinfo=P)) == [], "jamais deux fois")
verif(ig.a_publier(pubs, vide, dt.datetime(2026, 11, 12, 7, 0, tzinfo=P)) == [], "plus rien après 36 h de retard")

# appels simulés
appels = []
def faux(methode, chemin, jeton, **params):
    appels.append((methode, chemin, params))
    if chemin.endswith("/media"): return {"id": f"c{len(appels)}"}
    if chemin.endswith("/media_publish"): return {"id": "m1"}
    return {"status_code": "FINISHED"}
ig.appel = faux
ig.verifier_en_ligne = lambda u: None
d = pathlib.Path("/x/2026-11-09")
verif(ig.publier(pubs[0], d, "J", "42") == "m1", "post publié")
verif(appels[0][2].get("caption") == "L" and appels[0][2]["image_url"].endswith("/reseaux/2026-11-09/x.jpg"), "post : image en ligne et légende")
appels.clear()
car = {"id": "c", "type": "carrousel", "images": ["1.jpg", "2.jpg", "3.jpg"], "legende": "C"}
ig.publier(car, d, "J", "42")
items = [a for a in appels if a[2].get("is_carousel_item") == "true"]
verif([a[2]["image_url"][-5:] for a in items] == ["1.jpg", "2.jpg", "3.jpg"], "carrousel dans l'ordre")
cont = [a for a in appels if a[2].get("media_type") == "CAROUSEL"]
verif(len(cont) == 1 and cont[0][2]["caption"] == "C" and len(cont[0][2]["children"].split(",")) == 3, "conteneur du carrousel")

# semaines prêtes
INTERDITS = ["Six Nations", "Top 14", "Tour de France", "Grande Boucle", "Coupe du monde", "Coupe d'Europe", "Champions Cup",
             "Mondial", "Mondiaux", "Bleus", "équipe de France", "Grand Chelem", "Brennus", "maillot jaune", "JO ", "Jeux olympiques"]
TAILLES = {"post": (1080, 1350), "carrousel": (1080, 1350), "story": (1080, 1920)}
semaines = list(ig.plannings())
verif(len(semaines) >= 1, "au moins une semaine prête")
for dossier, pl in semaines:
    ids = [p["id"] for p in pl["publications"]]
    verif(len(ids) == len(set(ids)), f"{dossier.name} : identifiants uniques")
    for p in pl["publications"]:
        dt.datetime.fromisoformat(p["quand"])
        verif(p["type"] in TAILLES, f"{p['id']} : type connu")
        verif(not (p["type"] == "story" and p.get("auto")), f"{p['id']} : une story part à la main (musique, stickers)")
        n = len(p["images"])
        verif(n == 1 or (p["type"] == "carrousel" and 2 <= n <= 10), f"{p['id']} : nombre d'images")
        for f in p["images"]:
            fp = dossier / f
            verif(fp.exists() and fp.suffix == ".jpg", f"{p['id']} : {f} présent en JPEG")
            if fp.exists():
                im = Image.open(fp)
                verif(im.format == "JPEG" and im.size == TAILLES[p["type"]], f"{p['id']} : {f} au format {TAILLES[p['type']]}")
        leg = p.get("legende", "")
        verif(not p.get("auto") or leg, f"{p['id']} : légende présente")
        verif(len(leg) <= 2200 and leg.count("#") <= 30, f"{p['id']} : légende dans les limites d'Instagram")
        verif(not [w for w in INTERDITS if w in leg], f"{p['id']} : aucune compétition nommée")

print(f"{ok} OK, {ko} échecs")
sys.exit(1 if ko else 0)
