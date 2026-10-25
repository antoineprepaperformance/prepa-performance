"""Site, côté coach : programmes perso, exercices, fiche manuelle, aperçu, sauvegarde, suppression, deux clients isolés."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/site2"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"

def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label)
async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False, nth=0, scope=None):
    root = page.locator(scope) if scope else page
    await root.get_by_role("button", name=text, exact=exact).nth(nth).click(); await page.wait_for_timeout(250)
async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
def emu(path, method="GET"):
    req = urllib.request.Request(EMU + path, method=method, headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        b = r.read(); return json.loads(b) if b else {}

async def signup(page, email):
    await page.goto(URL)
    await btn(page, "Créer mon compte", exact=True)
    await page.fill("#au-e", email); await page.fill("#au-p", PW)
    await page.locator(".modal").get_by_role("button", name="Créer mon compte").click()
    await page.wait_for_timeout(1200)

async def client_request(page, name, prog):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-by", "1995"); await page.fill("#ob-h", "178"); await page.fill("#ob-w", "75"); await btn(page, "Continuer")
    await page.get_by_role("radio", name="Régional", exact=True).click(); await page.get_by_role("radio", name="6 mois à 2 ans").click()
    await btn(page, "Continuer")
    await page.locator("button.pcard", has_text=prog).click(); await btn(page, "Continuer")
    for i in range(await page.locator(".yn").count()):
        await page.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    boxes = page.locator("input[id^=pr-]")
    for i in range(await boxes.count()): await boxes.nth(i).check()
    if await page.get_by_role("radio", name="Gauche").count(): await page.get_by_role("radio", name="Gauche").click()
    await btn(page, "Continuer"); await page.check("#ob-consent"); await btn(page, "Continuer vers mon accès"); await page.wait_for_timeout(600)

async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="light", accept_downloads=True)
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse")
        ok(await has(co, "Bonjour", 8000), "coach connecté")
        ok(await has(co, "Ton site est prêt à recevoir des inscriptions"), "tableau de bord vide : mode d'emploi du site")
        ok(await co.locator("#site-url").count() + await co.get_by_role("button", name="Copier l'adresse du site").count() > 0, "adresse du site à copier")
        await shot(co, "coach_vide_clair")
        # programmes perso
        await btn(co, "Programmes", exact=True)
        await co.locator("button", has_text="Perte de poids").first.click(); await co.wait_for_timeout(300)
        await btn(co, "Dupliquer pour personnaliser"); await co.wait_for_timeout(400)
        await btn(co, "Enregistrer le programme"); await co.wait_for_timeout(500)
        lib = await co.evaluate("Object.keys(window.__fakefs.load()).filter(k => k.startsWith('library/'))")
        ok(len(lib) == 1, "programme perso enregistré dans la base")
        await btn(co, "Créer une séance"); await co.wait_for_timeout(300)
        await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(500)
        lib = await co.evaluate("Object.keys(window.__fakefs.load()).filter(k => k.startsWith('library/'))")
        ok(len(lib) == 2, "séance perso enregistrée")
        await btn(co, "Exercices", exact=True)
        await co.locator("button.exitem").first.click(); await co.wait_for_timeout(200)
        await co.fill("#xe-no", "Descente contrôlée, 3 secondes.")
        await co.locator(".modal").get_by_role("button", name="Enregistrer", exact=True).click(); await co.wait_for_timeout(400)
        ex = await co.evaluate("Object.keys(window.__fakefs.load()).filter(k => k.startsWith('exercises/'))")
        ok(len(ex) == 1, "consigne d'exercice enregistrée")
        # fiche manuelle
        await btn(co, "Tableau de bord", exact=True)
        await btn(co, "Ajouter un client")
        ok(await has(co, "Fiche pour un client que tu suis sans compte"), "ajout manuel : texte adapté au site")
        await co.fill("#ac-n", "Paul Présentiel")
        await co.locator(".modal").get_by_role("button", name="Créer le client").click(); await co.wait_for_timeout(600)
        ok(await has(co, "Fiche client créée"), "fiche manuelle créée")
        # aperçu
        await btn(co, "Tableau de bord", exact=True)
        await btn(co, "Aperçu côté client")
        ok(await has(co, "Aperçu de l'espace client"), "aperçu côté client")
        await btn(co, "Revenir à l'espace coach")
        # deux clients
        c1 = await A.new_page(); hook(c1, "c1"); await c1.set_viewport_size({"width": 390, "height": 844})
        await signup(c1, "un@test.fr"); await client_request(c1, "Inès Un", "Prise de muscle")
        c2 = await A.new_page(); hook(c2, "c2"); await c2.set_viewport_size({"width": 390, "height": 844})
        await signup(c2, "deux@test.fr"); await client_request(c2, "Tom Deux", "Retour à la course")
        uid1 = await c1.evaluate("firebase.auth().currentUser.uid")
        cross = await c2.evaluate(f"(async () => {{ try {{ await firebase.firestore().doc('clients/{uid1}').get(); return 'ok'; }} catch (e) {{ return e.code; }} }})()")
        ok(cross == "permission-denied", "client 2 ne peut pas lire le dossier du client 1")
        cross2 = await c2.evaluate(f"(async () => {{ try {{ await firebase.firestore().doc('clients/{uid1}/logs/x').set({{a:1}}); return 'ok'; }} catch (e) {{ return e.code; }} }})()")
        ok(cross2 == "permission-denied", "client 2 ne peut pas écrire chez le client 1")
        # le client voit le programme perso du coach ? (lecture library autorisée)
        libr = await c1.evaluate("(async () => { try { const s = await firebase.firestore().collection('library').get(); return s.size; } catch (e) { return e.code; } })()")
        ok(libr == 2, "les clients lisent la bibliothèque du coach")
        await co.bring_to_front(); await co.wait_for_timeout(600)
        await btn(co, "Clients", exact=True)
        rows = await co.locator("table.ctable tbody tr").count()
        ok(rows == 3, "coach : 3 clients listés (2 comptes + 1 fiche) [%d]" % rows)
        await shot(co, "coach_clients")
        # sauvegarde
        await btn(co, "Offres & réglages", exact=True)
        ok(await has(co, "Mon compte"), "réglages : carte Mon compte")
        async with co.expect_download(timeout=10000) as dl:
            await btn(co, "Télécharger une sauvegarde")
        d = await dl.value; path = await d.path()
        data = json.loads(open(path).read())
        ok(len(data["clients"]) == 3 and len(data["library"]) == 2, "sauvegarde complète téléchargée (%s)" % d.suggested_filename)
        # suppression d'un client
        await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Tom Deux").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Notes").click(); await co.wait_for_timeout(200)
        await co.fill("#del-c", "supprimer")
        await btn(co, "Supprimer définitivement"); await co.wait_for_timeout(1200)
        uid2 = await c2.evaluate("firebase.auth().currentUser.uid")
        left = await co.evaluate(f"Object.keys(window.__fakefs.load()).filter(k => k.includes('{uid2}'))")
        ok(left == [], "suppression : plus aucune donnée du client " + json.dumps(left))
        # le client supprimé retombe sur l'inscription
        await c2.bring_to_front(); await c2.reload(); await c2.wait_for_timeout(1500)
        ok(await has(c2, "Commencer mon inscription", 6000), "client supprimé : peut se réinscrire")
        await co.bring_to_front()
        await co.set_viewport_size({"width": 390, "height": 844}); await co.wait_for_timeout(300)
        ov = await co.evaluate("Math.max(0, document.documentElement.scrollWidth - window.innerWidth)")
        ok(ov == 0, "coach téléphone clair : pas de défilement horizontal")
        sh = await co.evaluate("document.querySelector('.side').getBoundingClientRect().height")
        ok(sh < 160, "coach téléphone : en-tête compact (%d px)" % sh)
        await shot(co, "coach_tel_clair", full=False)
        await btn(co, "Offres & réglages", exact=True)
        await shot(co, "coach_tel_reglages")
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
