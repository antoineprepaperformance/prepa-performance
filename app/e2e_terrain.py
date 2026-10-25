"""Version Claude : sport et séances terrain — choix du sport et du poste, séances adaptées (spécifique salle, remplacements terrain),
écran Séances terrain (schéma animé, dose par profil, minuteur, chrono du Bronco), tests du sport, conseil du coach et du coach IA."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8772
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/terrain"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
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
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def mkeys(page, prefix): return await page.evaluate(f"Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{{}}')).filter(k => k.startsWith({json.dumps(prefix)}))")
async def back(page):
    await page.locator(".p-top .back").first.click(); await page.wait_for_timeout(350)

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            await A.add_init_script("window.__TIMER_SPEED = 40;")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)
            await btn(co, "Codes & essais", exact=True)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="3 mois").click()
            await co.fill("#cd-code", "SUIVI-RUGBY2345"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)

            # ---------- inscription : sport, niveau, poste ----------
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=t1"); await c.wait_for_timeout(700)
            await btn(c, "Commencer mon inscription")
            await c.fill("#ob-name", "Thomas Rugby"); await c.fill("#ob-h", "178"); await c.fill("#ob-w", "75"); await c.fill("#ob-by", "1998")
            await c.fill("#ob-sport", "rugby à 7")
            ok(await has(c, "Reconnu : Rugby à 7"), "sport tapé reconnu (rugby à 7)")
            ok(await c.locator(".spchip").count() >= 20, "grille des sports (" + str(await c.locator(".spchip").count()) + ")")
            await c.locator(".spchip", has_text="Rugby à XV").click(); await c.wait_for_timeout(200)
            ok(await c.input_value("#ob-sport") == "Rugby à XV" and await has(c, "Reconnu : Rugby à XV"), "choix du sport dans la grille")
            await shot(c, "inscription_sport")
            await btn(c, "Continuer")
            ok(await has(c, "Ton niveau de pratique en rugby à xv"), "niveau de pratique propre au sport")
            await c.get_by_role("radio", name="National", exact=True).click(); await c.get_by_role("radio", name="Plus de 2 ans", exact=True).click()
            ok(await c.get_by_role("radio", name="Avant", exact=True).count() == 1, "choix du poste (avant / trois-quarts)")
            await c.get_by_role("radio", name="Avant", exact=True).click()
            await shot(c, "inscription_poste")
            await btn(c, "Continuer")
            await c.locator("button.pcard", has_text="Prépa sports collectifs").click(); await btn(c, "Continuer")
            for i in range(await c.locator(".yn").count()):
                await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await btn(c, "Continuer")
            ok(await has(c, "Rugby à XV · Avant"), "récapitulatif : sport et poste")
            await c.check("#ob-consent")
            ok(await c.get_by_role("button", name="Continuer vers mon accès", exact=True).count() == 1, "bouton sans guillemets parasites")
            await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(700)
            prof = await mdb(c, "clients/u_t1")
            ok(prof and prof.get("sportId") == "rugby" and prof.get("poste") == "avant" and prof.get("sportAdapt") is True, "profil : sportId, poste, adaptation", prof and {k: prof.get(k) for k in ("sport", "sportId", "poste", "sportAdapt")})
            await c.fill("#pu-code", "SUIVI-RUGBY2345"); await btn(c, "Appliquer", exact=True)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            ok(await has(c, "prochaine séance", 6000), "programme actif")

            # ---------- écran Aujourd'hui ----------
            ok(await c.locator(".tweek").count() == 1, "carte « Séance terrain de la semaine »")
            tw = await c.locator(".tweek").inner_text()
            ok("Bronco" in tw or "Malcolm" in tw or "Efforts" in tw, "séance terrain de rugby proposée", tw[:200])
            await shot(c, "aujourdhui_terrain")

            # ---------- séances adaptées ----------
            await c.locator("nav.tabbar button", has_text="Programme").click(); await c.wait_for_timeout(400)
            ok(await has(c, "Adapté à ton sport : Rugby à XV · Avant"), "programme : carte d'adaptation au sport")
            await c.locator(".srow", has_text="Force").first.click(); await c.wait_for_timeout(600)
            txt = await c.locator(".player").inner_text()
            ok("spécifique rugby à xv" in txt.lower(), "séance A : bloc « Spécifique rugby »")
            ok("Isométrie du cou" in txt and "Poussée de traîneau lourd" in txt and "Poussée isométrique de mêlée" in txt, "exercices spécifiques : cou, traîneau, mêlée (avant)")
            ok("Nordic" in txt or "nordique" in txt.lower(), "exercices du programme conservés")
            await shot(c, "seance_A_specifique")
            await back(c)
            await c.locator(".srow", has_text="Conditionnement").first.click(); await c.wait_for_timeout(600)
            txt = await c.locator(".player").inner_text()
            ok("Bronco cassé" in txt and "version rugby à xv : remplace « " in txt.lower(), "séance C : 15-15 remplacé par le Bronco cassé")
            ok(await c.locator(".exc-drill").count() == 1, "vignette schéma terrain dans la séance")
            await c.locator(".exc-drill").first.click(); await c.wait_for_timeout(500)
            ok(await c.locator(".modal .ts-svg").count() == 1 and await has(c, "Pour ton profil Performance"), "fiche terrain depuis la séance (schéma + dose du profil)")
            await shot(c, "seance_C_bronco", full=False)
            await c.keyboard.press("Escape"); await c.wait_for_timeout(200)
            await back(c)

            # ---------- écran Séances terrain ----------
            await c.locator("nav.tabbar button", has_text="Aujourd").click(); await c.wait_for_timeout(400)
            await c.locator(".xteaser").get_by_role("button", name="Terrain", exact=True).click(); await c.wait_for_timeout(500)
            ok(await has(c, "Séances terrain") and await c.locator(".tcard").count() >= 10, "écran terrain : séances du rugby (" + str(await c.locator(".tcard").count()) + ")")
            await shot(c, "ecran_terrain")
            await c.locator(".tcard", has_text="Malcolms").click(); await c.wait_for_timeout(600)
            ok(await has(c, "3 séries de 6 Malcolms"), "dose Malcolms pour le profil Performance")
            ok(await has(c, "Avants : c'est ta séance clé"), "conseil propre au poste (avant)")
            svg = c.locator(".ts-svg").first
            a1 = await svg.screenshot(); await c.wait_for_timeout(800); a2 = await svg.screenshot()
            ok(a1 != a2, "schéma animé (le coureur bouge)")
            ok(await c.locator(".ts-svg text", has_text="20 m").count() >= 1 and await c.locator(".ts-num").count() == 3, "distances et étapes numérotées sur le schéma")
            await shot(c, "fiche_malcolm")
            await btn(c, "Lancer le minuteur"); await c.wait_for_timeout(300)
            ok(await has(c, "Séance terrain") and await c.locator(".tm-anim .ts-svg").count() == 1, "minuteur avec le schéma")
            await btn(c, "Démarrer"); await c.wait_for_timeout(2500)
            await shot(c, "minuteur_malcolm", full=False)
            for _ in range(80):
                if await c.get_by_text("Ton ressenti").count(): break
                await c.wait_for_timeout(500)
            ok(await c.get_by_text("Ton ressenti").count() == 1, "fin du minuteur")
            await c.locator("#fx-rpe button", has_text="8").first.click(); await btn(c, "Enregistrer", exact=True); await c.wait_for_timeout(600)
            ks = await mkeys(c, "clients/u_t1/libres/")
            docs = [await mdb(c, k) for k in ks]
            ok(any(d and d.get("kind") == "terrain" and d.get("sid") == "r_malcolm" and d.get("rpe") == 8 for d in docs), "séance terrain enregistrée (charge comptée)")
            # chrono du Bronco
            await c.locator(".tcard", has_text="Test Bronco").click(); await c.wait_for_timeout(500)
            await btn(c, "Chronométrer"); await c.wait_for_timeout(300)
            await btn(c, "Départ"); await c.wait_for_timeout(1500)
            for _ in range(5): await btn(c, "Tour", exact=True); await c.wait_for_timeout(200)
            await btn(c, "Stop"); await c.wait_for_timeout(300)
            ok(await has(c, "Tours : 5"), "chrono : 5 tours comptés")
            await shot(c, "chrono_bronco", full=False)
            await c.get_by_role("button", name="Enregistrer").first.click(); await c.wait_for_timeout(400)
            ok(await has(c, "résultat :"), "écran de fin avec le résultat")
            await c.locator("#fx-rpe button", has_text="9").first.click(); await btn(c, "Enregistrer", exact=True); await c.wait_for_timeout(600)
            ks = await mkeys(c, "clients/u_t1/libres/")
            docs = [await mdb(c, k) for k in ks]
            br = [d for d in docs if d and d.get("res") and d["res"].get("t") == "bronco"]
            ok(br and br[0]["res"]["v"] > 40, "chrono du Bronco enregistré", br)
            ok(await has(c, "Mes records terrain"), "records terrain affichés")
            await back(c)
            # tests : le Bronco fait partie des tests du programme
            await c.locator("nav.tabbar button", has_text="Progrès").click(); await c.wait_for_timeout(400)
            await c.get_by_role("button", name="Saisir").first.click(); await c.wait_for_timeout(400)
            ok(await c.locator("#t-bronco").count() == 1, "test Bronco ajouté aux tests du programme")
            ok(await has(c, "Meilleur chrono terrain"), "tests : rappel du chrono terrain")
            await c.locator(".modal").get_by_role("button", name="Utiliser").click(); await c.wait_for_timeout(200)
            ok((await c.input_value("#t-bronco")) == str(br[0]["res"]["v"]) if br else False, "chrono repris dans le test")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(200)

            # ---------- profil : changer de sport ----------
            await c.locator(".avbtn").first.click(); await c.wait_for_timeout(400)
            ok(await has(c, "Mon sport") and await has(c, "Rugby à XV · Avant"), "profil : carte Mon sport")
            await c.locator(".card", has_text="Mon sport").get_by_role("button", name="Modifier").click(); await c.wait_for_timeout(300)
            await c.locator(".modal .spchip", has_text="Basket-ball").click(); await c.wait_for_timeout(200)
            await c.locator(".modal").get_by_role("radio", name="Intérieur").click()
            await c.locator(".modal").get_by_role("button", name="Enregistrer").click(); await c.wait_for_timeout(500)
            prof = await mdb(c, "clients/u_t1")
            ok(prof.get("sportId") == "basket" and prof.get("poste") == "interieur", "sport changé pour le basket (poste intérieur)")
            await c.locator("nav.tabbar button", has_text="Programme").click(); await c.wait_for_timeout(400)
            await c.locator(".srow", has_text="Force").first.click(); await c.wait_for_timeout(500)
            txt = await c.locator(".player").inner_text()
            ok("spécifique basket-ball" in txt.lower() and "Isométrie du cou" not in txt, "séances recalculées pour le basket")
            await back(c)
            await c.locator(".avbtn").first.click(); await c.wait_for_timeout(300)
            await c.locator(".card", has_text="Mon sport").get_by_role("button", name="Modifier").click(); await c.wait_for_timeout(300)
            await c.locator(".modal .spchip", has_text="Rugby à XV").click(); await c.locator(".modal").get_by_role("radio", name="Avant").click()
            await c.locator(".modal").get_by_role("radio", name="Non").click()
            await c.locator(".modal").get_by_role("button", name="Enregistrer").click(); await c.wait_for_timeout(400)
            await c.locator("nav.tabbar button", has_text="Programme").click(); await c.wait_for_timeout(400)
            await c.locator(".srow", has_text="Conditionnement").first.click(); await c.wait_for_timeout(500)
            txt = await c.locator(".player").inner_text()
            ok("Bronco cassé" not in txt and "Intermittent 15-15" in txt, "adaptation désactivée : séances d'origine")
            await back(c)
            await c.locator(".avbtn").first.click(); await c.wait_for_timeout(300)
            await c.locator(".card", has_text="Mon sport").get_by_role("button", name="Modifier").click(); await c.wait_for_timeout(300)
            await c.locator(".modal").get_by_role("radio", name="Oui").click()
            await c.locator(".modal").get_by_role("button", name="Enregistrer").click(); await c.wait_for_timeout(400)

            # ---------- coach : sport du client, conseil d'une séance ----------
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            ok(await co.get_by_text("Rugby à XV · Avant").count() >= 1, "coach : sport et poste dans la liste des clients")
            await co.get_by_text("Thomas Rugby").first.click(); await co.wait_for_timeout(800)
            await co.get_by_role("radio", name="Sport & terrain").click(); await co.wait_for_timeout(400)
            h3 = [await has(co, "Rugby à XV · Avant"), await has(co, "Séances terrain réalisées"), await co.locator(".hist", has_text="Malcolms").count() >= 1 and await co.locator(".hist", has_text="Test Bronco").count() >= 1]
            ok(all(h3), "coach : onglet Sport & terrain avec l'historique", [h3, (await co.locator("main").inner_text())[:1500]])
            await co.select_option("#ct-drill", "r_rhie"); await co.get_by_role("radio", name="2 semaines").click()
            await co.fill("#ct-msg", "Jeudi, avec un bouclier si possible")
            await btn(co, "Conseiller cette séance"); await co.wait_for_timeout(500)
            ok(await has(co, "Efforts répétés (sprints et plaquages) · toi"), "coach : conseil enregistré")
            await shot(co, "coach_terrain")
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            tw = await c.locator(".tweek").inner_text()
            ok("conseillée par antoine" in tw.lower() and "Efforts répétés" in tw and "bouclier" in tw, "client : séance conseillée par Antoine", tw[:200])
            # bibliothèque du coach
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(900)
            await btn(co, "Programmes", exact=True)
            ok(await has(co, "Séances terrain par sport"), "bibliothèque : séances terrain par sport")
            await co.select_option("#tl-sport", "bob"); await co.wait_for_timeout(300)
            ok(await has(co, "Départs poussés"), "bibliothèque : séances du bobsleigh")
            await co.locator(".tcard", has_text="Départs poussés").click(); await co.wait_for_timeout(400)
            ok(await co.locator(".modal .ts-svg").count() == 1, "bibliothèque : fiche avec schéma")
            await shot(co, "biblio_bob", full=False)
            await co.keyboard.press("Escape")

            # ---------- coach IA ----------
            await c.bring_to_front()
            await c.locator("nav.tabbar .tab-ia").click(); await c.wait_for_timeout(500)
            await c.fill("textarea", "Quelle séance terrain cette semaine ?"); await c.keyboard.press("Enter"); await c.wait_for_timeout(300)
            if not await c.get_by_text("Malcolms : 3 séries").count():
                await c.get_by_role("button", name="Envoyer").first.click()
            await c.wait_for_timeout(1500)
            pr = await c.evaluate("(window.__prompts || []).slice(-1)[0]")
            ok(pr and "Sport : Rugby à XV · Avant" in pr["all"] and "r_malcolm : Malcolms" in pr["all"], "contexte IA : sport, poste et séances terrain")
            ok(pr and "conseiller_seance_terrain" in pr["tools"], "outil conseiller_seance_terrain proposé à l'IA")
            ok(await has(c, "Séance « Malcolms » conseillée"), "coach IA : séance conseillée")
            await back(c)
            await c.wait_for_timeout(400)
            tw = await c.locator(".tweek").inner_text()
            ok("conseillée par le coach ia" in tw.lower() and "Malcolms" in tw, "client : conseil du coach IA sur l'accueil", tw[:200])
            await shot(c, "accueil_conseil_ia")
            # clair
            L = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="light")
            lp = await L.new_page(); hook(lp, "clair")
            await lp.goto(URL + "?as=owner"); await lp.wait_for_timeout(800)
            await btn(lp, "Programmes", exact=True); await lp.locator(".tcard").first.click(); await lp.wait_for_timeout(500)
            await shot(lp, "fiche_clair", full=False)
            await b.close()
    finally:
        srv.terminate()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
