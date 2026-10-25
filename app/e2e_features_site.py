"""Site : nouveautés côté base Firestore (règles et taille des documents) — correction vidéo envoyée au coach,
import iPhone par l'adresse du site, activité GPX, séance flash, recette ajoutée au journal."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, urllib.request
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
MEDIA = HERE + "/test/media"
OUT = HERE + "/shots/features_site"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
TODAY = datetime.date.today()
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:500]))
async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False, scope=None):
    root = page.locator(scope) if scope else page
    await root.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)
async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
def emu(path, method="GET"):
    req = urllib.request.Request(EMU + path, method=method, headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        b = r.read(); return json.loads(b) if b else {}
async def db(page, path): return await page.evaluate(f"window.__fakefs.load()[{json.dumps(path)}]")
async def keys(page, prefix): return await page.evaluate(f"Object.keys(window.__fakefs.load()).filter(k => k.startsWith({json.dumps(prefix)}))")
async def signup(page, email):
    await page.goto(URL)
    await btn(page, "Créer mon compte", exact=True)
    await page.fill("#au-e", email); await page.fill("#au-p", PW)
    await page.locator(".modal").get_by_role("button", name="Créer mon compte").click()
    await page.wait_for_timeout(1200)
async def onboard(page, name, sport, compet, xp, prog):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-h", "178"); await page.fill("#ob-w", "75"); await page.fill("#ob-sport", sport); await page.fill("#ob-by", "1993")
    await btn(page, "Continuer")
    await page.get_by_role("radio", name=compet, exact=True).click(); await page.get_by_role("radio", name=xp, exact=True).click()
    await btn(page, "Continuer")
    await page.locator("button.pcard", has_text=prog).click(); await btn(page, "Continuer")
    for i in range(await page.locator(".yn").count()):
        await page.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    await btn(page, "Continuer"); await page.check("#ob-consent")
    await btn(page, "Continuer vers mon accès"); await page.wait_for_timeout(800)

async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
        await A.add_init_script("window.__TIMER_SPEED = 40; window.__RELAY_UID = 'relais-test';")
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse"); await co.wait_for_timeout(800)
        await btn(co, "Codes & essais", exact=True)
        await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
        await co.fill("#cd-code", "SUIVI-SITE2345"); await btn(co, "Créer le code"); await co.wait_for_timeout(400)
        c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
        await signup(c, "ines@test.fr"); await onboard(c, "Inès Site", "Handball", "Régional", "Plus de 2 ans", "Force & haltérophilie")
        uid = await c.evaluate("firebase.auth().currentUser.uid")
        await c.fill("#pu-code", "SUIVI-SITE2345"); await btn(c, "Appliquer", exact=True); await c.wait_for_timeout(500)
        await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Activer mon accès offert"); await c.wait_for_timeout(1500)
        ok(await has(c, "prochaine séance", 8000), "site : accès Suivi par code")
        # correction vidéo envoyée au coach (document Firestore < 1 Mio)
        await c.locator("button.next").click(); await c.wait_for_timeout(500)
        await c.locator(".exc-anim").first.click(); await c.wait_for_timeout(400)
        await btn(c, "Me filmer et vérifier", scope=".modal"); await c.wait_for_timeout(400)
        await c.set_input_files("#vc-file", MEDIA + "/squat.webm"); await c.wait_for_timeout(1200)
        for k in range(3):
            for _ in range(12): await btn(c, "Image ›")
            await btn(c, "Garder cette image"); await c.wait_for_timeout(200)
        ok(await c.locator(".vc-frames figure").count() == 3, "3 images gardées")
        ok(await c.get_by_role("button", name="Analyse par le coach IA").count() == 0, "site : pas d'analyse IA (sans compte Claude)")
        await c.fill("#vc-link", "http://pas-securise.fr/video"); await btn(c, "Envoyer à Antoine"); await c.wait_for_timeout(300)
        ok(await has(c, "Le lien doit commencer par https://"), "lien de vidéo non https refusé")
        await c.fill("#vc-link", "https://drive.google.com/file/d/test/view"); await btn(c, "Envoyer à Antoine"); await c.wait_for_timeout(1200)
        ok(await has(c, "Vidéo envoyée"), "site : vidéo envoyée")
        vk = await keys(c, f"clients/{uid}/videos/")
        vd = await db(c, vk[0]) if vk else None
        size = len(json.dumps(vd)) if vd else 0
        ok(vd and len(vd["frames"]) == 3 and size < 400000 and vd["link"].startswith("https://drive"), "document vidéo : 3 images, %d Ko (limite Firestore 1 Mio)" % (size // 1024))
        await btn(c, "Fermer", exact=True); await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(400)
        await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
        ok(await has(co, "1 vidéo à corriger", 6000), "coach (site) : vidéo à corriger")
        # import iPhone par l'adresse du site
        await c.bring_to_front()
        await c.goto(URL + f"?sante=1&pas=11234&fcr=49&vfc=72&sommeil=7.5&poids=63.4"); await c.wait_for_timeout(2500)
        sd = await db(c, f"clients/{uid}/sante/{TODAY.isoformat()}")
        ok(sd and sd["pas"] == 11234 and sd["sommeil"] == 7.5 and sd["poids"] == 63.4 and sd["src"] == "iphone", "site : valeurs du Raccourci iPhone enregistrées", sd)
        ok(await has(c, "reçues de ton iPhone"), "message de confirmation de l'import")
        # mauvaise valeur ignorée
        await c.goto(URL + "?sante=1&fcr=400&pas=abc"); await c.wait_for_timeout(2000)
        sd2 = await db(c, f"clients/{uid}/sante/{TODAY.isoformat()}")
        ok(sd2.get("fcr") == 49 and sd2.get("pas") == 11234 and sd2.get("poids") == 63.4, "valeurs aberrantes ignorées, la journée n'est jamais écrasée (FC 400, pas « abc »)", sd2)
        ok(await has(c, "Aucune valeur valable reçue"), "message si le raccourci n'envoie rien de valable")
        # GPX
        await c.locator("button.nutri-mini", has_text="Ma santé du jour").click(); await c.wait_for_timeout(500)
        await btn(c, "Ajouter"); await c.locator("#act-file").set_input_files(MEDIA + "/sortie.gpx"); await c.wait_for_timeout(600)
        await c.locator("#act-rpe button", has_text="6").first.click(); await btn(c, "Ajouter l'activité"); await c.wait_for_timeout(800)
        ak = await keys(c, f"clients/{uid}/activites/")
        ok(len(ak) == 1, "site : activité GPX enregistrée")
        await shot(c, "sante_site")
        await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(300)
        # séance flash
        await btn(c, "Flash", exact=True); await c.locator(".xcard").first.click(); await btn(c, "Commencer la séance"); await btn(c, "Démarrer")
        for _ in range(80):
            if await c.get_by_text("Ton ressenti").count(): break
            await c.wait_for_timeout(500)
        await c.locator("#fx-rpe button", has_text="8").first.click(); await btn(c, "Enregistrer", exact=True); await c.wait_for_timeout(800)
        ok(len(await keys(c, f"clients/{uid}/libres/")) == 1, "site : séance flash enregistrée")
        await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(300)
        # recette au journal
        await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(400)
        await c.get_by_role("radio", name="Recettes").click(); await c.wait_for_timeout(400)
        await c.locator(".rgrid button").first.click(); await c.wait_for_timeout(400)
        ok(await has(c, "Ingrédients") and await has(c, "Préparation"), "fiche recette (ingrédients, préparation)")
        await shot(c, "recette_site", full=False)
        await btn(c, "Ajouter à ma liste de courses"); await c.wait_for_timeout(500)
        lst = await db(c, f"clients/{uid}/recettes/liste")
        ok(lst and len(lst.get("items", [])) >= 1, "site : liste de courses enregistrée")
        st = [await c.evaluate("window.__fsStats.errors"), await co.evaluate("window.__fsStats.errors")]
        den = await c.evaluate("window.__fsStats.denied")
        ok(not any(st) and not den, "aucune erreur ni écriture refusée", [st, den])
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
