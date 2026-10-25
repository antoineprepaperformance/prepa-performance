"""Site : règles Firestore qui ne reconnaissent pas le coach (adresse non remplacée ou règles non publiées) et base qui ne répond pas.
L'espace coach doit le dire clairement, donner les règles prêtes à coller, et se rétablir après correction."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/rules_site"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
async def shot(page, name, full=False):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False, scope=None):
    root = page.locator(scope) if scope else page
    await root.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)
async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
async def toast_text(page):
    await page.wait_for_timeout(600)
    return " | ".join(await page.locator(".toast").all_inner_texts())
def emu(path, method="GET"):
    req = urllib.request.Request(EMU + path, method=method, headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        b = r.read(); return json.loads(b) if b else {}

async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark", permissions=["clipboard-read", "clipboard-write"])
        # règles publiées avec l'adresse d'exemple : le coach n'est pas reconnu par la base
        await A.add_init_script("window.__RULES_EMAILS = ['ton-email@exemple.fr'];")
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await btn(co, "Créer mon compte", exact=True)
        await co.fill("#au-e", "coach@test.fr"); await co.fill("#au-p", PW)
        await co.locator(".modal").get_by_role("button", name="Créer mon compte").click(); await co.wait_for_timeout(1200)
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse"); await co.wait_for_timeout(800)
        ok(await has(co, "Ta base refuse ton accès coach", 8000), "alerte : la base refuse l'accès coach")
        ok(await has(co, "ne reconnaissent pas coach@test.fr"), "alerte : adresse du compte affichée")
        await shot(co, "alerte_regles")
        # les écritures échouent avec une raison claire
        await btn(co, "Codes & essais", exact=True)
        await co.fill("#cd-code", "ESSAI-REGLES234"); await btn(co, "Créer le code")
        t = await toast_text(co)
        ok("Création impossible" in t and "règles de sécurité Firestore" in t, "code refusé : la raison est donnée", t)
        await btn(co, "Offres & réglages", exact=True)
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click()
        t = await toast_text(co)
        ok("Enregistrement impossible" in t and "règles de sécurité Firestore" in t, "réglages refusés : la raison est donnée", t)
        await co.locator(".alert", has_text="Connexion à la base").get_by_role("button", name="Tester").click(); await co.wait_for_timeout(900)
        ok(await co.locator(".alert", has_text="Connexion à la base").get_by_text("Refusé", exact=True).count() == 1, "test de la base : refusé")
        # règles prêtes à coller, avec l'adresse du coach
        await co.locator(".rules-alert").get_by_role("button", name="Copier les règles prêtes").click(); await co.wait_for_timeout(400)
        clip = await co.evaluate("navigator.clipboard.readText()")
        ok("rules_version = '2'" in clip and "['coach@test.fr']" in clip and "ton-email@exemple.fr']" not in clip and "match /codes/{code}" in clip, "règles copiées avec l'adresse du coach", clip[:200])
        href = await co.locator(".rules-alert a").get_attribute("href")
        ok(href == "https://console.firebase.google.com/project/demo-prepa/firestore/databases/-default-/rules", "lien direct vers les règles du projet", href)
        # correction des règles puis « Revérifier »
        await co.evaluate("window.__RULES_EMAILS = null")
        await co.locator(".rules-alert").get_by_role("button", name="Revérifier").click(); await co.wait_for_timeout(2500)
        ok(await co.locator(".rules-alert").count() == 0, "alerte disparue après correction")
        await co.locator(".alert", has_text="Connexion à la base").get_by_role("button", name="Tester").click(); await co.wait_for_timeout(900)
        ok(await co.locator(".alert", has_text="Connexion à la base").get_by_text("OK", exact=True).count() == 1, "test de la base : OK")
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click()
        t = await toast_text(co)
        ok("Réglages enregistrés" in t, "réglages enregistrés", t)
        await btn(co, "Codes & essais", exact=True)
        await co.fill("#cd-code", "ESSAI-REGLES234"); await btn(co, "Créer le code"); await co.wait_for_timeout(500)
        ok(await co.evaluate("!!window.__fakefs.load()['codes/ESSAI-REGLES234']"), "code créé")
        # base qui ne répond pas : message au bout du délai
        await co.evaluate("window.__FS_HANG = true; window.__WRITE_TIMEOUT = 1500")
        await co.fill("#cd-code", "ESSAI-ATTENTE234"); await btn(co, "Créer le code"); await co.wait_for_timeout(1900)
        t = await toast_text(co)
        ok("la base ne répond pas" in t, "base injoignable : message clair", t)
        ok(await co.get_by_role("button", name="Créer le code").is_enabled(), "bouton de nouveau utilisable")
        await shot(co, "base_injoignable")
        # base locale du navigateur cassée (Safari après une mise en veille) : bandeau « Recharger la page »
        await co.evaluate("window.__FS_HANG = false; window.__FS_BROKEN = true")
        await co.fill("#cd-code", "ESSAI-CASSE2345"); await btn(co, "Créer le code"); await co.wait_for_timeout(600)
        t = await toast_text(co)
        ok("connexion à la base s'est interrompue" in t and "Recharge la page" in t, "base locale cassée : message clair", t)
        ok(await co.locator(".dbwatch").count() == 1 and await co.locator(".dbwatch").get_by_role("button", name="Recharger la page").count() == 1, "bandeau « Recharger la page »")
        await shot(co, "base_cassee")
        await co.evaluate("window.__FS_BROKEN = false")
        await co.locator(".dbwatch").get_by_role("button", name="Recharger la page").click(); await co.wait_for_timeout(2500)
        ok(await co.locator(".dbwatch").count() == 0 and await has(co, "Tableau de bord"), "après rechargement : espace coach normal")
        # hors ligne : l'écriture reste en file d'attente
        await co.evaluate("window.__RULES_EMAILS = null; window.__FS_HANG = true; window.__WRITE_TIMEOUT = 1200; window.__q = 0; addEventListener('db-queued', () => window.__q++)")
        await A.set_offline(True)
        await btn(co, "Codes & essais", exact=True)
        await co.fill("#cd-code", "ESSAI-HORSLIGNE2"); await btn(co, "Créer le code"); await co.wait_for_timeout(1700)
        t = await toast_text(co)
        ok(await co.evaluate("window.__q") == 1 and "créé" in t, "hors ligne : écriture gardée et envoyée plus tard", t)
        await A.set_offline(False)
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
