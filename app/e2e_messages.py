"""Version Claude : messagerie coach ↔ client (texte + photo, non-lus des deux côtés, boîte de réception), boutons de contact,
réglages (messagerie désactivée, forfait Lite)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8775
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/messages"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
TODAY = datetime.date.today()
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
async def mkeys(page, prefix): return await page.evaluate(f"Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{{}}')).filter(k => k.startsWith({json.dumps(prefix)}))")
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def onboard(page, name, prog="Remise en forme"):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-h", "178"); await page.fill("#ob-w", "75"); await page.fill("#ob-by", "1995"); await page.fill("#ob-sport", "Fitness")
    await btn(page, "Continuer")
    await page.get_by_role("radio", name="Loisir ou départemental", exact=True).click(); await page.get_by_role("radio", name="6 mois à 2 ans", exact=True).click()
    await btn(page, "Continuer")
    await page.locator("button.pcard", has_text=prog).click(); await btn(page, "Continuer")
    for i in range(await page.locator(".yn").count()):
        await page.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    await btn(page, "Continuer"); await page.check("#ob-consent")
    await btn(page, "Continuer vers mon accès"); await page.wait_for_timeout(700)

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)
            ok(await co.locator(".side-nav button", has_text="Messages").count() == 1, "coach : entrée Messages dans le menu")
            await btn(co, "Offres & réglages", exact=True)
            await co.fill("#st-p", "06 12 34 56 78"); await co.fill("#st-e", "antoine@test.fr"); await co.fill("#st-i", "@antoine.prepa")
            ok(await has(co, "Messagerie avec tes clients"), "réglages : carte Messagerie")
            await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(400)
            await btn(co, "Codes & essais", exact=True)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "SUIVI-MSG23456"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)

            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=m1"); await c.wait_for_timeout(700)
            await onboard(c, "Léo Message")
            ok(await c.locator(".msgbtn").count() == 1, "avant l'achat : bouton Messages sur l'écran d'accès")
            await c.fill("#pu-code", "SUIVI-MSG23456"); await btn(c, "Appliquer", exact=True)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(400)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            ok(await has(c, "prochaine séance", 6000), "programme actif")
            ok(await c.locator("header.c-top .msgbtn").count() == 1, "client : bouton Messages dans l'en-tête")
            await c.locator(".msgbtn").click(); await c.wait_for_timeout(500)
            ok(await has(c, "Messagerie privée") and await has(c, "Écris ton premier message"), "écran Messages")
            ok(await c.locator("a[href^='tel:'], a[href*='wa.me'], a[href^='mailto:']").count() == 0 and "06 12 34 56 78" not in await c.inner_text("body"), "aucun appel, WhatsApp ni e-mail : contact par écrit seulement")
            await c.fill("#msg-in-client", "Bonjour Antoine, j'ai une gêne au genou sur les fentes. Je continue ?")
            await btn(c, "Envoyer", exact=True); await c.wait_for_timeout(500)
            await c.set_input_files("#msg-file-client", HERE + "/test/photo_repas.jpg"); await c.wait_for_timeout(800)
            ok(await c.locator(".msg-prev img").count() == 1, "photo jointe : aperçu avant envoi")
            await c.fill("#msg-in-client", "Et voilà mon repas d'hier soir")
            await btn(c, "Envoyer", exact=True); await c.wait_for_timeout(600)
            ks = await mkeys(c, "clients/u_m1/messages/")
            docs = [await mdb(c, k) for k in ks]
            img = [d for d in docs if d and d.get("img")]
            ok(len(docs) == 2 and all(d["from"] == "client" for d in docs) and img and len(img[0]["img"]) < 245000, "2 messages enregistrés (photo réduite : %d Ko)" % (len(img[0]["img"]) // 1024 if img else 0))
            prof = await mdb(c, "clients/u_m1")
            ok(prof and prof["sum"].get("msgAt") and "repas" in prof["sum"].get("msgText", ""), "résumé du client : dernier message pour le coach", prof and prof.get("sum"))
            await shot(c, "client_messages")
            await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(300)
            # coach : non-lu, boîte de réception, réponse
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            ok(await co.locator(".side-nav .nav-n").inner_text() == "1", "coach : 1 non lu dans le menu")
            ok(await has(co, "1 message non lu"), "tableau de bord : alerte message non lu")
            await co.locator(".msg-alert").get_by_role("button", name="Lire").click(); await co.wait_for_timeout(500)
            ok(await co.locator(".inbox-row.unread", has_text="Léo Message").count() == 1 and await has(co, "Et voilà mon repas"), "boîte de réception : conversation non lue avec aperçu")
            await shot(co, "coach_inbox")
            await co.locator(".inbox-row", has_text="Léo Message").click(); await co.wait_for_timeout(1000)
            ok(await co.get_by_role("radio", name="Messages (nouveau)").count() + await co.get_by_role("radio", name="Messages").count() >= 1 and await has(co, "gêne au genou") and await co.locator(".msg-img img").count() == 1, "fiche client, onglet Messages : texte et photo")
            await co.wait_for_timeout(800)
            ok(await co.locator(".side-nav .nav-n").count() == 0, "coach : non-lu effacé après lecture")
            ok((await mdb(co, "coachnotes/_inbox") or {}).get("seen", {}).get("u_m1"), "lecture du coach mémorisée")
            await co.fill("#msg-in-coach", "Allège les fentes cette semaine (amplitude réduite) et garde la douleur sous 3/10. On en reparle après ta séance.")
            await btn(co, "Envoyer", exact=True); await co.wait_for_timeout(500)
            await shot(co, "coach_thread")
            # client : réponse non lue
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1500)
            ok(await c.locator(".msgbtn-n").inner_text() == "1", "client : 1 réponse non lue sur le bouton")
            await c.locator(".msgbtn").click(); await c.wait_for_timeout(700)
            ok(await has(c, "Allège les fentes"), "client : réponse du coach affichée")
            await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(600)
            ok(await c.locator(".msgbtn-n").count() == 0, "client : non-lu effacé après lecture")
            # profil : « Écrire à Antoine », sans téléphone
            await c.locator(".avbtn").first.click(); await c.wait_for_timeout(400)
            ok(await c.locator(".card", has_text="Contacter").get_by_role("button", name="Écrire à Antoine").count() == 1 and "06 12 34 56 78" not in await c.inner_text("body"), "profil : bouton Écrire à Antoine, numéro non affiché")
            await c.locator(".card", has_text="Contacter").get_by_role("button", name="Écrire à Antoine").click(); await c.wait_for_timeout(400)
            ok(await has(c, "Messagerie privée"), "profil : ouvre la messagerie")
            await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(300)
            # messagerie désactivée par le coach
            await co.bring_to_front(); await btn(co, "Offres & réglages", exact=True)
            await co.locator(".card", has_text="Messagerie avec tes clients").get_by_role("radio", name="Désactivée").click()
            await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(400)
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            await c.locator(".msgbtn").click(); await c.wait_for_timeout(500)
            ok(await has(c, "La messagerie n'est pas disponible") and await c.locator("#msg-in-client").count() == 0 and await c.locator("a[href^='tel:']").count() == 0, "messagerie désactivée : message clair, sans numéro")
            await b.close()
    finally:
        srv.terminate()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
