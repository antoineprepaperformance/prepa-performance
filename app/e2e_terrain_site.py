"""Site : sport et séances terrain avec Firebase (Auth émulé + base fakefs aux règles réelles) — choix du sport et du poste,
séances adaptées, minuteur d'une séance terrain enregistrée, conseil d'Antoine, pas de mention du coach IA."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, urllib.request
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/terrain_site"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
TODAY = datetime.date.today()
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
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
async def back(page):
    await page.locator(".p-top .back").first.click(); await page.wait_for_timeout(350)

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
        await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="3 mois").click()
        await co.fill("#cd-code", "SUIVI-FOOT23456"); await btn(co, "Créer le code"); await co.wait_for_timeout(400)

        # ---------- inscription : sport choisi dans la grille, niveau, poste ----------
        c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
        await signup(c, "lucas@test.fr")
        await btn(c, "Commencer mon inscription")
        await c.fill("#ob-name", "Lucas Foot"); await c.fill("#ob-by", "2001")
        ok(await c.locator(".spchip").count() >= 20, "site : grille des sports")
        await c.locator(".spchip", has_text="Football").click(); await c.wait_for_timeout(200)
        ok(await has(c, "Reconnu : Football"), "site : sport reconnu")
        await btn(c, "Continuer")
        ok(await has(c, "Ton niveau de pratique en football"), "site : niveau de pratique propre au sport")
        await c.get_by_role("radio", name="Régional", exact=True).click(); await c.get_by_role("radio", name="Plus de 2 ans", exact=True).click()
        await c.get_by_role("radio", name="Milieu", exact=True).click()
        await btn(c, "Continuer")
        await c.locator("button.pcard", has_text="Prépa sports collectifs").click(); await btn(c, "Continuer")
        for i in range(await c.locator(".yn").count()):
            await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
        await btn(c, "Continuer")
        ok(await has(c, "Football · Milieu"), "site : récapitulatif sport et poste")
        await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(900)
        uid = await c.evaluate("firebase.auth().currentUser.uid")
        prof = await db(c, f"clients/{uid}")
        ok(prof and prof.get("sportId") == "foot" and prof.get("poste") == "milieu", "site : profil enregistré (sportId, poste)", prof and {k: prof.get(k) for k in ("sport", "sportId", "poste", "sportAdapt")})
        await c.fill("#pu-code", "SUIVI-FOOT23456"); await btn(c, "Appliquer", exact=True); await c.wait_for_timeout(500)
        await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Activer mon accès offert"); await c.wait_for_timeout(1500)
        ok(await has(c, "prochaine séance", 8000), "site : accès Suivi par code")

        # ---------- Aujourd'hui et séances adaptées ----------
        ok(await c.locator(".tweek").count() == 1, "site : carte « Séance terrain de la semaine »")
        tw = await c.locator(".tweek").inner_text()
        ok(" IA" not in tw, "site : pas de mention du coach IA sur la carte", tw[:200])
        await shot(c, "aujourdhui")
        await c.locator("nav.tabbar button", has_text="Programme").click(); await c.wait_for_timeout(400)
        ok(await has(c, "Adapté à ton sport : Football · Milieu"), "site : carte d'adaptation au sport")
        await c.locator(".srow", has_text="Force").first.click(); await c.wait_for_timeout(600)
        txt = await c.locator(".player").inner_text()
        ok("spécifique football" in txt.lower(), "site : exercices spécifiques au football dans la séance")
        await back(c)

        # ---------- séance terrain au minuteur ----------
        await c.locator("nav.tabbar button", has_text="Aujourd").click(); await c.wait_for_timeout(400)
        await c.locator(".xteaser").get_by_role("button", name="Terrain", exact=True).click(); await c.wait_for_timeout(500)
        ok(await c.locator(".tcard").count() >= 10, "site : séances terrain du football (" + str(await c.locator(".tcard").count()) + ")")
        page_txt = await c.locator("main").inner_text() if await c.locator("main").count() else await c.inner_text("body")
        ok("coach IA" not in page_txt, "site : écran terrain sans coach IA")
        await c.locator(".tcard", has_text="Box to box").click(); await c.wait_for_timeout(600)
        ok(await c.locator(".ts-svg").count() >= 1, "site : schéma de la séance")
        await shot(c, "fiche_box", full=False)
        await btn(c, "Lancer le minuteur"); await btn(c, "Démarrer")
        for _ in range(120):
            if await c.get_by_text("Ton ressenti").count(): break
            await c.wait_for_timeout(500)
        await c.locator("#fx-rpe button", has_text="7").first.click(); await btn(c, "Enregistrer", exact=True); await c.wait_for_timeout(900)
        lk = await keys(c, f"clients/{uid}/libres/")
        docs = [await db(c, k) for k in lk]
        ok(any(d and d.get("kind") == "terrain" and d.get("rpe") == 7 for d in docs), "site : séance terrain enregistrée dans Firestore", docs)
        await back(c)

        # ---------- coach : sport du client et conseil ----------
        await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1800)
        ok(await co.get_by_text("Football · Milieu").count() >= 1, "site coach : sport et poste dans la liste")
        await co.get_by_text("Lucas Foot").first.click(); await co.wait_for_timeout(900)
        await co.get_by_role("radio", name="Sport & terrain").click(); await co.wait_for_timeout(400)
        ok(await co.locator(".hist", has_text="Box to box").count() >= 1, "site coach : séance réalisée visible")
        await co.select_option("#ct-drill", "f_ssg"); await co.get_by_role("radio", name="1 semaine").click()
        await co.fill("#ct-msg", "Samedi matin avec tes coéquipiers")
        await btn(co, "Conseiller cette séance"); await co.wait_for_timeout(800)
        ak = await keys(co, f"clients/{uid}/ai/")
        adocs = [await db(co, k) for k in ak]
        ok(any(d and d.get("kind") == "terrain" and d.get("drill") == "f_ssg" for d in adocs), "site coach : conseil enregistré", adocs)
        await shot(co, "coach_terrain")
        await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1800)
        tw = await c.locator(".tweek").inner_text()
        ok("conseillée par antoine" in tw.lower() and "Samedi matin" in tw, "site : séance conseillée par Antoine sur l'accueil", tw[:200])
        await shot(c, "accueil_conseil")
        st = [await c.evaluate("window.__fsStats.errors"), await co.evaluate("window.__fsStats.errors")]
        den = [await c.evaluate("window.__fsStats.denied"), await co.evaluate("window.__fsStats.denied")]
        ok(not any(st) and not any(den), "site : aucune erreur ni écriture refusée", [st, den])
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
