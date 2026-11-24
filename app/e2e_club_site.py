"""Site : offre Club avec Firebase (Auth émulé + base fakefs aux règles de firestore.rules). Le coach importe un classeur
FICTIF (fixture_saison.py) et crée un club ; un joueur entre le code joueurs (Autonomie, rattaché au club, séance d'équipe
du jour sur son accueil) ; l'entraîneur entre le code entraîneur (toute la saison, minuteur). Règles : un inconnu ne lit
ni le club ni les modèles, même en écrivant le code du club dans son propre profil ; un joueur ne modifie pas son club."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, sys, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, HERE)
import fixture_saison
URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/club_site"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
XLSX = OUT + "/saison_fictive.xlsx"
NB = fixture_saison.ecrire(XLSX)
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
TODAY = datetime.date.today()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text and "permission" not in m.text.lower() else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:600]))


async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)


async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)


async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False


def emu(path, method="GET"):
    req = urllib.request.Request(EMU + path, method=method, headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        b = r.read(); return json.loads(b) if b else {}


async def db(page, path): return await page.evaluate(f"window.__fakefs.load()[{json.dumps(path)}]")
async def prefix(page, p): return await page.evaluate(f"(() => {{ const d = window.__fakefs.load(); return Object.keys(d).filter((k) => k.startsWith({json.dumps(p)})).map((k) => d[k]); }})()")


async def signup(page, email):
    await page.goto(URL)
    await btn(page, "Créer mon compte", exact=True)
    await page.fill("#au-e", email); await page.fill("#au-p", PW)
    await page.locator(".modal").get_by_role("button", name="Créer mon compte").click()
    await page.wait_for_timeout(1200)


async def inscription(page, email, nom, code):
    """Inscription complète, puis le code du club sur l'écran d'accès."""
    await signup(page, email)
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", nom); await page.fill("#ob-h", "180"); await page.fill("#ob-w", "84"); await page.fill("#ob-by", "1998")
    await page.locator(".spchip", has_text="Football").click(); await page.wait_for_timeout(200)
    await btn(page, "Continuer")
    await page.get_by_role("radio", name="Régional", exact=True).click(); await page.get_by_role("radio", name="Plus de 2 ans", exact=True).click()
    await page.get_by_role("radio", name="Milieu", exact=True).click()
    await btn(page, "Continuer")
    await page.locator("button.pcard", has_text="Prépa sports collectifs").click(); await btn(page, "Continuer")
    for i in range(await page.locator(".yn").count()):
        await page.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    await btn(page, "Continuer")
    await page.check("#ob-consent"); await btn(page, "Continuer vers mon accès"); await page.wait_for_timeout(900)
    await page.fill("#pu-code", code); await btn(page, "Appliquer", exact=True); await page.wait_for_timeout(600)
    await page.fill("#pu-start", TODAY.isoformat()); await page.check("#pu-cgv"); await btn(page, "Activer mon accès offert"); await page.wait_for_timeout(1800)
    return await page.evaluate("firebase.auth().currentUser.uid")


async def essai(page, js):
    """Lecture ou écriture tentée dans la page : « ok » ou le code d'erreur Firestore."""
    return await page.evaluate("async () => { try { " + js + "; return 'ok'; } catch (e) { return e.code || String(e.message); } }")


async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
        await A.add_init_script("window.__TIMER_SPEED = 40;")
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse"); await co.wait_for_timeout(800)

        # ---------- coach : import du classeur et nouveau club ----------
        await btn(co, "Clubs", exact=True)
        # l'import est passe dans l'onglet « Modeles de saison » de l'ecran Clubs
        await co.get_by_role("radio", name="Modèles de saison").click(); await co.wait_for_timeout(300)
        await btn(co, "Importer un classeur")
        await co.set_input_files("#eq-file", XLSX); await co.wait_for_timeout(1500)
        ok(await has(co, f"{NB} séances lues du"), f"site coach : classeur lu ({NB} séances)")
        await co.locator("label.chipbtn", has_text="Zébulon").locator("input").check()
        await co.fill("#eq-nom", "Club du classeur")
        await btn(co, "Enregistrer le modèle"); await co.wait_for_timeout(900)
        ms = await prefix(co, "modeles/")
        ok(len(ms) == 1 and len(ms[0].get("seances", [])) == NB and ms[0].get("noms") == ["Zébulon"], "site coach : modèle enregistré dans Firestore (modeles/)")
        await btn(co, "Créer un club avec ce modèle")
        await co.fill("#cl-nom", "Club Site"); await co.fill("#cl-heure", "19h30")
        await co.get_by_role("radio", name="Un cycle").click(); await co.select_option("#cl-cycle", "4"); await co.fill("#cl-places", "20"); await co.wait_for_timeout(300)
        await btn(co, "Créer le club et ses codes"); await co.wait_for_timeout(1200)
        cs = await prefix(co, "clubs/")
        club = cs[0] if cs else {}
        cid = club.get("id", "x"); cj = (club.get("codes") or {}).get("joueurs", ""); ce = (club.get("codes") or {}).get("entraineur", "")
        ok(len(cs) == 1 and len(club.get("seances", [])) == 12 and club.get("offre") == "cycle" and club.get("places") == 20 and cj.startswith("CLUB") and ce.startswith("ENTR"),
           "site coach : club (cycle 4, 20 places) et ses deux codes enregistrés", {k: club.get(k) for k in ("id", "codes", "du", "au", "offre", "places")})
        ok("Zébulon" not in json.dumps(club.get("seances"), ensure_ascii=False), "site coach : prénom retiré de la saison du club")
        await shot(co, "coach_club")
        ok(await co.get_by_role("button", name="Copier le lien").count() == 2, "site coach : lien d'accès à partager pour chaque code")

        # ---------- joueur : code joueurs ----------
        j = await A.new_page(); hook(j, "joueur"); await j.set_viewport_size({"width": 390, "height": 844})
        uj = await inscription(j, "joueur@test.fr", "Jo Joueur", cj)
        pl = await db(j, f"plans/{uj}") or {}
        prof = await db(j, f"clients/{uj}") or {}
        ok(pl.get("offer") == "auto" and pl.get("weeks") == 6, "site joueur : accès Autonomie pour les 6 semaines du cycle, par le code du club", {k: pl.get(k) for k in ("offer", "weeks", "status")})
        ok(prof.get("club") == cid and prof.get("clubCode") == cj and prof.get("clubRole") == "joueur", "site joueur : profil rattaché au club", {k: prof.get(k) for k in ("club", "clubCode", "clubRole")})
        code = await db(j, f"codes/{cj}") or {}
        ok(code.get("uses") == 1 and uj in (code.get("usedBy") or {}), "site joueur : une place du code utilisée")
        ok(await has(j, "séance d'équipe", 8000), "site joueur : sa séance d'équipe sur l'accueil", (await j.inner_text("body"))[:600])
        await btn(j, "Voir le détail")
        ok(await has(j, "Fitness Game") and await has(j, "19h30"), "site joueur : déroulé et horaire du club")
        await shot(j, "joueur_seance")
        await btn(j, "‹ Retour")
        await btn(j, "La saison du club"); await j.wait_for_timeout(500)
        ok(await has(j, "Cycle 4") and await has(j, "Saison · semaines 15 à 20"), "site joueur : la saison de son club, avec le cycle acheté")
        await j.locator("button.linkbtn", has_text="ECHAUFFEMENT").first.click(); await j.wait_for_timeout(400)
        await btn(j, "Lancer la séance au minuteur"); await j.wait_for_timeout(500)
        ok(await j.get_by_role("button", name="Démarrer").count() >= 1, "site joueur : n'importe quelle séance de la saison se lance au minuteur")
        await j.reload(); await j.wait_for_timeout(1500)
        ok(await essai(j, f"await firebase.firestore().doc('clubs/{cid}').get()") == "ok", "règles : le joueur lit la saison de son club")
        ok(await essai(j, f"await firebase.firestore().doc('clubs/{cid}').update({{ n: 'Pirate' }})") == "permission-denied", "règles : le joueur ne modifie pas son club")
        ok(await essai(j, "await firebase.firestore().collection('modeles').get()") == "permission-denied", "règles : le joueur ne lit pas les modèles d'Antoine")
        ok(await essai(j, "await firebase.firestore().collection('clubs').get()") == "permission-denied", "règles : le joueur ne liste pas les clubs")

        # ---------- entraîneur : code entraîneur ----------
        e = await A.new_page(); hook(e, "entraineur"); await e.set_viewport_size({"width": 390, "height": 844})
        ue = await inscription(e, "entraineur@test.fr", "Eva Entraîneuse", ce)
        ok(((await db(e, f"clients/{ue}")) or {}).get("clubRole") == "entraineur", "site entraîneur : rôle entraîneur")
        ok(await has(e, "Ta saison d'équipe", 8000), "site entraîneur : carte « Ta saison d'équipe »")
        await btn(e, "Ouvrir la saison"); await e.wait_for_timeout(500)
        ok(await has(e, "Cycle 4") and await e.get_by_role("radio", name="Par mois").count() == 1, "site entraîneur : toute la saison du club, par cycle ou par mois")
        await e.locator("button.linkbtn", has_text="ECHAUFFEMENT").first.click(); await e.wait_for_timeout(400)
        await btn(e, "Lancer la séance au minuteur"); await e.wait_for_timeout(500)
        ok(await e.get_by_role("button", name="Démarrer").count() >= 1, "site entraîneur : séance lancée au minuteur")
        await shot(e, "entraineur_minuteur")

        # ---------- inconnu : ni le club ni les modèles, même en trichant sur son profil ----------
        x = await A.new_page(); hook(x, "inconnu")
        await signup(x, "curieux@test.fr")
        ux = await x.evaluate("firebase.auth().currentUser.uid")
        ok(await essai(x, f"await firebase.firestore().doc('clubs/{cid}').get()") == "permission-denied", "règles : un inconnu ne lit pas la saison d'un club")
        r = await essai(x, f"await firebase.firestore().doc('clients/{ux}').set({{ name: 'Curieux', club: '{cid}', clubCode: '{cj}', clubRole: 'entraineur' }}, {{ merge: true }})")
        ok(r == "ok", "règles : il peut écrire ce qu'il veut dans son propre profil", r)
        ok(await essai(x, f"await firebase.firestore().doc('clubs/{cid}').get()") == "permission-denied", "règles : connaître le code ne suffit pas sans avoir pris une place")
        ok(await essai(x, f"await firebase.firestore().doc('modeles/{ms[0]['id'] if ms else 'x'}').get()") == "permission-denied", "règles : un inconnu ne lit pas les modèles")
        ok(await essai(x, f"await firebase.firestore().doc('clubs/{cid}').set({{ id: '{cid}', n: 'Pirate', membres: {{ '{ux}': 'joueur' }} }})") == "permission-denied", "règles : un inconnu ne s'ajoute pas aux membres")

        # ---------- coach : rattachement depuis la fiche, puis lecture par les membres ----------
        await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1800)
        await btn(co, "Clients", exact=True)
        await co.get_by_text("Jo Joueur").first.click(); await co.wait_for_timeout(900)
        await co.get_by_role("radio", name="Sport & terrain").click(); await co.wait_for_timeout(500)
        carte = co.locator(".card", has_text="Si ce client joue dans un club")
        ok(await carte.count() == 1 and await carte.first.get_by_role("radio", name="Club Site").get_attribute("aria-checked") == "true", "site coach : le club du joueur apparaît dans sa fiche")
        st = [await pg.evaluate("window.__fsStats.errors") for pg in (co, j, e)]
        den = [await pg.evaluate("window.__fsStats.denied") for pg in (co, e)]
        ok(not any(st) and not any(den), "site : aucune erreur ni lecture refusée pour le coach et les membres", [st, den])
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
    sys.exit(1 if fails or any("pageerror" in x for x in errs) else 0)


asyncio.run(run())
