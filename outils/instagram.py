"""Robot Instagram d'Antoine Prépa Performance.

Publie sur Instagram, à l'heure prévue, les posts d'une semaine **validée par Antoine** (validée = la pull request
qui ajoute `docs/reseaux/AAAA-MM-JJ/` a été fusionnée). Seules les publications marquées `"auto": true` partent ;
les stories avec musique ou sticker restent à publier par Antoine (l'API de Meta n'ajoute ni musique ni sticker).

API officielle « Instagram API with Instagram Login » (gratuite) : les images doivent être des JPEG en ligne,
ici sur le site GitHub Pages (`docs/reseaux/`). Jeton dans le secret GitHub INSTAGRAM_JETON (jamais dans le dépôt).
Ce qui est publié est noté dans docs/reseaux/publie.json pour ne jamais publier deux fois.

Lancement : python3 outils/instagram.py            (publie ce qui est à l'heure)
            python3 outils/instagram.py --essai    (montre ce qui partirait, sans rien publier)
"""
import datetime as dt, json, os, pathlib, sys, time, urllib.error, urllib.parse, urllib.request
from zoneinfo import ZoneInfo

RACINE = pathlib.Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "docs" / "reseaux"
ETAT = DOSSIER / "publie.json"
PARIS = ZoneInfo("Europe/Paris")
VERSION = os.environ.get("INSTAGRAM_VERSION", "v25.0")
API = f"https://graph.instagram.com/{VERSION}"
RETARD_MAX = dt.timedelta(hours=36)   # une publication en retard de plus de 36 h n'est plus publiée (Antoine décide)


def lire_etat():
    if ETAT.exists():
        return json.loads(ETAT.read_text(encoding="utf-8"))
    return {"publie": {}, "erreurs": {}}


def ecrire_etat(etat):
    ETAT.write_text(json.dumps(etat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def plannings():
    for f in sorted(DOSSIER.glob("*/planning.json")):
        yield f.parent, json.loads(f.read_text(encoding="utf-8"))


def a_publier(publications, etat, maintenant):
    """Les publications automatiques dont l'heure est passée depuis moins de RETARD_MAX et pas encore publiées."""
    out = []
    for p in publications:
        if not p.get("auto") or p["id"] in etat["publie"]:
            continue
        quand = dt.datetime.fromisoformat(p["quand"]).replace(tzinfo=PARIS)
        if quand <= maintenant < quand + RETARD_MAX:
            out.append(p)
    return out


def adresse_site():
    if os.environ.get("SITE_URL"):
        return os.environ["SITE_URL"].rstrip("/") + "/"
    cname = RACINE / "docs" / "CNAME"
    if cname.exists() and cname.read_text().strip():
        return "https://" + cname.read_text().strip() + "/"
    proprio, depot = os.environ.get("GITHUB_REPOSITORY", "antoineprepaperformance/prepa-performance").split("/")
    return f"https://{proprio.lower()}.github.io/{depot}/"


def appel(methode, chemin, jeton, **params):
    url = chemin if chemin.startswith("http") else f"{API}/{chemin}"
    donnees = None
    if methode == "GET":
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    else:
        donnees = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=donnees, method=methode, headers={"Authorization": f"Bearer {jeton}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        corps = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"Instagram a refusé ({e.code}) : {corps}") from None


def attendre(conteneur, jeton):
    for _ in range(20):   # jusqu'à 5 minutes
        s = appel("GET", conteneur, jeton, fields="status_code").get("status_code")
        if s == "FINISHED":
            return
        if s in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram n'a pas pu préparer l'image (état {s}).")
        time.sleep(15)
    raise RuntimeError("Instagram met trop de temps à préparer l'image.")


def verifier_en_ligne(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "robot-instagram"})
    with urllib.request.urlopen(req, timeout=30) as r:
        if r.status != 200 or "jpeg" not in r.headers.get("Content-Type", ""):
            raise RuntimeError(f"Image introuvable ou pas en JPEG : {url}")


def publier(p, dossier, jeton, compte):
    base = adresse_site() + f"reseaux/{dossier.name}/"
    urls = [base + urllib.parse.quote(i) for i in p["images"]]
    for u in urls:
        verifier_en_ligne(u)
    legende = p.get("legende", "")
    if p["type"] == "carrousel":
        enfants = []
        for u in urls:
            c = appel("POST", f"{compte}/media", jeton, image_url=u, is_carousel_item="true")["id"]
            attendre(c, jeton)
            enfants.append(c)
        cont = appel("POST", f"{compte}/media", jeton, media_type="CAROUSEL", children=",".join(enfants), caption=legende)["id"]
    elif p["type"] == "story":
        cont = appel("POST", f"{compte}/media", jeton, image_url=urls[0], media_type="STORIES")["id"]
    else:
        cont = appel("POST", f"{compte}/media", jeton, image_url=urls[0], caption=legende)["id"]
    attendre(cont, jeton)
    return appel("POST", f"{compte}/media_publish", jeton, creation_id=cont)["id"]


def main():
    essai = "--essai" in sys.argv
    jeton = os.environ.get("INSTAGRAM_JETON", "")
    maintenant = dt.datetime.now(PARIS)
    etat = lire_etat()
    prevus = [(d, p) for d, pl in plannings() for p in a_publier(pl["publications"], etat, maintenant)]
    if not prevus:
        print("Rien à publier maintenant.")
        return 0
    if essai or not jeton:
        for d, p in prevus:
            print(f"À publier : {p['id']} ({p['type']}, {len(p['images'])} image(s))")
        if not jeton and not essai:
            print("Pas de jeton INSTAGRAM_JETON : rien n'est publié (voir outils/INSTAGRAM.md).")
        return 0
    compte = appel("GET", "me", jeton, fields="user_id,username")
    ig = compte.get("user_id") or compte["id"]
    echecs = 0
    for d, p in prevus:
        try:
            media = publier(p, d, jeton, ig)
            etat["publie"][p["id"]] = {"media": media, "le": maintenant.isoformat(timespec="minutes")}
            etat["erreurs"].pop(p["id"], None)
            print(f"Publié : {p['id']} sur @{compte.get('username', '?')}")
        except Exception as e:   # on continue avec les suivantes, l'erreur est notée
            echecs += 1
            etat["erreurs"][p["id"]] = str(e)[:300]
            print(f"Échec : {p['id']} : {e}")
        ecrire_etat(etat)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
