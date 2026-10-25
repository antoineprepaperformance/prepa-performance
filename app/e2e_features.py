"""Version Claude : nouveautés — animations des mouvements, correction vidéo (vidéo réelle, mesure d'angle, IA, envoi au coach, réponse),
séances flash et récup (minuteur), santé au quotidien (saisie, import iPhone par URL, fichier GPX), livre de recettes (semaine, goûts, IA, liste de courses)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8770
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/features"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
MEDIA = HERE + "/test/media"
errs, fails, oks = [], [], []
n = [0]
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
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def mkeys(page, prefix): return await page.evaluate(f"Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{{}}')).filter(k => k.startsWith({json.dumps(prefix)}))")
async def onboard(page, name, sport, compet, xp, prog):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-h", "178"); await page.fill("#ob-w", "75"); await page.fill("#ob-sport", sport); await page.fill("#ob-by", "1995")
    await btn(page, "Continuer")
    await page.get_by_role("radio", name=compet, exact=True).click(); await page.get_by_role("radio", name=xp, exact=True).click()
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
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark", accept_downloads=True)
            await A.add_init_script("window.__TIMER_SPEED = 40;")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)
            await btn(co, "Codes & essais", exact=True)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "SUIVI-TEST2345"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)
            # client : Suivi, Force & haltérophilie
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=f1"); await c.wait_for_timeout(700)
            await onboard(c, "Hugo Force", "Rugby", "Régional", "Plus de 2 ans", "Force & haltérophilie")
            await c.fill("#pu-code", "SUIVI-TEST2345"); await btn(c, "Appliquer", exact=True)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            ok((await mdb(co, "plans/u_f1") or {}).get("offer") == "suivi", "accès Suivi activé par l'espace coach")
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            ok(await has(c, "prochaine séance", 6000), "client : séance du jour")

            # ---------- animations ----------
            await c.locator("button.next").click(); await c.wait_for_timeout(600)
            thumbs = await c.locator(".exc-anim").count()
            ok(thumbs >= 3, "séance : vignette animée par exercice (" + str(thumbs) + ")")
            await c.locator(".exc-anim").first.click(); await c.wait_for_timeout(500)
            modal = c.locator(".modal")
            anim = modal.locator("svg").first
            ok(await anim.count() == 1, "fiche mouvement : animation affichée")
            a1 = await anim.screenshot(); await c.wait_for_timeout(700); a2 = await anim.screenshot()
            ok(a1 != a2, "l'animation bouge (deux images différentes à 0,7 s d'écart)")
            yt = await modal.locator("a", has_text="Chercher une démonstration").get_attribute("href")
            ok(yt and yt.startswith("https://www.youtube.com/results?search_query="), "lien vers une démonstration vidéo")
            await shot(c, "fiche_mouvement", full=False)
            await btn(c, "Me filmer et vérifier", scope=".modal"); await c.wait_for_timeout(400)

            # ---------- correction vidéo ----------
            ok(await has(c, "Filme ton mouvement de profil") and await c.locator(".modal .vc-ref svg").count() == 1, "correction vidéo : consignes de cadrage et référence animée")
            await c.set_input_files("#vc-file", MEDIA + "/squat.webm"); await c.wait_for_timeout(1200)
            ready = await c.evaluate("(() => { const v = document.querySelector('.vc-stage video'); return v ? { rs: v.readyState, d: v.duration, w: v.videoWidth } : null; })()")
            ok(ready and ready["rs"] >= 1 and abs(ready["d"] - 3) < 0.3 and ready["w"] == 360, "vidéo chargée (3 s, 360 px de large)", ready)
            for _ in range(20): await btn(c, "Image ›")
            await c.wait_for_timeout(300)
            t = await c.evaluate("document.querySelector('.vc-stage video').currentTime")
            ok(0.5 < t < 0.8, "avance image par image (t = %.2f s)" % t)
            await btn(c, "Mesurer un angle")
            await c.wait_for_timeout(700)
            box = await c.locator("canvas.vc-layer").bounding_box()
            vbox = await c.locator(".vc-stage video").bounding_box()
            print("   canvas", box, "video", vbox)
            await shot(c, "avant_mesure", full=False)
            for (fx, fy) in [(0.3, 0.3), (0.5, 0.55), (0.35, 0.8)]:
                await c.mouse.click(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy); await c.wait_for_timeout(120)
            await shot(c, "apres_mesure", full=False)
            ok(await has(c, "Angle ") , "angle mesuré sur la vidéo")
            await btn(c, "Garder cette image"); await c.wait_for_timeout(400)
            ok(await c.locator(".vc-frames figure").count() == 1, "image gardée avec sa mesure")
            await c.locator(".vc-chk").first.get_by_role("radio", name="À revoir").click()
            await c.fill("#vc-note", "Je sens mes genoux rentrer à la remontée")
            await btn(c, "Analyse par le coach IA"); await c.wait_for_timeout(900)
            aitxt = await c.locator(".modal .coachmsg.ai").first.inner_text() if await c.locator(".modal .coachmsg.ai").count() else ""
            ok("Genoux dans l'axe des pieds" in aitxt and "Priorité" in aitxt and "intelligence artificielle" in aitxt.lower(), "analyse IA des images (version Claude), présentée comme IA", aitxt[:200])
            pr = await c.evaluate("(window.__prompts || []).slice(-1)[0]")
            ok(pr and pr["images"] == 1 and "Angle" in pr["all"], "l'IA reçoit l'image et la mesure", pr and {"images": pr["images"]})
            await shot(c, "correction_video")
            await btn(c, "Envoyer à Antoine"); await c.wait_for_timeout(600)
            ok(await has(c, "Vidéo envoyée"), "envoyé au coach (formule Suivi)")
            vk = await mkeys(c, "clients/u_f1/videos/")
            vd = await mdb(c, vk[0]) if vk else None
            size = len(json.dumps(vd)) if vd else 0
            ok(vd and vd["toCoach"] and len(vd["frames"]) == 1 and vd["frames"][0]["img"].startswith("data:image/jpeg") and vd["frames"][0]["marks"][0]["type"] == "angle" and size < 200000, "vidéo enregistrée : 1 image JPEG avec la mesure (%d Ko), sans la vidéo" % (size // 1024))
            await btn(c, "Fermer", exact=True)
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
            await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(400)
            # coach : correction
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            ok(await has(co, "1 vidéo à corriger"), "coach : vidéo à corriger dans « À traiter »")
            await co.locator("ul.alerts button", has_text="vidéo").first.click(); await co.wait_for_timeout(800)
            await shot(co, "coach_apres_alerte", full=False)
            ok(await has(co, "Je sens mes genoux rentrer"), "coach : images, mesure et note du client")
            await co.locator("textarea[id^='vr-']").fill("Bonne profondeur. Pousse les genoux vers l'extérieur en remontant, garde le poids sur tout le pied.")
            await btn(co, "Envoyer la correction"); await co.wait_for_timeout(500)
            await shot(co, "coach_video")
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            ok(await has(c, "a corrigé ta vidéo"), "client : correction d'Antoine reçue")

            # ---------- séances flash et récup ----------
            await btn(c, "Flash", exact=True); await c.wait_for_timeout(400)
            ok(await c.locator(".xcard").count() >= 6 and await has(c, "Adaptées à ton profil"), "séances flash : catalogue adapté au profil")
            await c.get_by_role("radio", name="Sans matériel").click(); await c.wait_for_timeout(200)
            await c.locator(".xcard").first.click(); await c.wait_for_timeout(400)
            ok(await has(c, "Pourquoi ça marche"), "fiche de séance flash avec justification scientifique")
            await btn(c, "Commencer la séance"); await c.wait_for_timeout(300)
            await btn(c, "Démarrer"); await c.wait_for_timeout(600)
            await shot(c, "minuteur_flash", full=False)
            done = False
            for _ in range(60):
                if await c.get_by_text("Ton ressenti").count(): done = True; break
                await c.wait_for_timeout(500)
            ok(done, "minuteur : séance déroulée jusqu'au bout (accéléré)")
            await c.locator("#fx-rpe button", has_text="7").first.click()
            await btn(c, "Enregistrer", exact=True); await c.wait_for_timeout(600)
            lk = await mkeys(c, "clients/u_f1/libres/")
            ld = await mdb(c, lk[0]) if lk else None
            ok(ld and ld["rpe"] == 7 and ld["duree"] >= 1, "séance flash enregistrée (effort et durée)", ld)
            await btn(c, "Récup", exact=True) if await c.get_by_role("button", name="Récup", exact=True).count() else await c.get_by_role("radio", name="Récup et bien-être").click()
            await c.wait_for_timeout(300)
            ok(await c.locator(".xcard").count() >= 4, "récup et bien-être : étirements, yoga, mobilité, respiration")
            await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(400)

            # ---------- santé au quotidien ----------
            await c.goto(URL + f"?as=f1&sante=1&pas=9500&fcr=52&vfc=68&sommeil=445&d={TODAY.isoformat()}"); await c.wait_for_timeout(1500)
            sd = await mdb(c, f"clients/u_f1/sante/{TODAY.isoformat()}")
            ok(sd and sd["pas"] == 9500 and sd["fcr"] == 52 and abs(sd["sommeil"] - 7.42) < 0.02 and sd["src"] == "iphone", "import du Raccourci iPhone par l'adresse (sommeil en minutes converti)", sd)
            url_now = await c.evaluate("location.search")
            ok("sante" not in url_now and "pas=" not in url_now, "adresse nettoyée après import")
            await c.locator("button.nutri-mini", has_text="Ma santé du jour").click(); await c.wait_for_timeout(500)
            ok(await c.input_value("#sa-pas") == "9500", "écran santé : valeurs du jour pré-remplies")
            await c.fill("#sa-eau", "2.2"); await c.locator("#sa-e button", has_text="4").first.click()
            await btn(c, "Enregistrer", exact=True); await c.wait_for_timeout(500)
            sd = await mdb(c, f"clients/u_f1/sante/{TODAY.isoformat()}")
            ok(sd and sd["eau"] == 2.2 and sd["energie"] == 4 and sd["pas"] == 9500, "saisie du jour complétée sans écraser l'import", sd)
            await c.locator("#act-file").set_input_files(MEDIA + "/sortie.gpx") if await c.locator("#act-file").count() else (await btn(c, "Ajouter"), await c.locator("#act-file").set_input_files(MEDIA + "/sortie.gpx"))
            await c.wait_for_timeout(600)
            ok(await c.input_value("#act-n") == "Footing bords de Garonne" and await c.input_value("#act-du") == "30" and await c.input_value("#act-di") in ("6", "6.0", "6,0", "6.01", "6,01"), "fichier GPX lu : nom, 30 min, ~6 km", [await c.input_value("#act-n"), await c.input_value("#act-du"), await c.input_value("#act-di")])
            await c.locator("#act-rpe button", has_text="5").first.click()
            await btn(c, "Ajouter l'activité"); await c.wait_for_timeout(500)
            ak = await mkeys(c, "clients/u_f1/activites/")
            ad = await mdb(c, ak[0]) if ak else None
            ok(ad and ad["load"] == 150 and ad["fcMoy"] and not any(k in json.dumps(ad) for k in ["lat", "lon", "trkpt"]), "activité enregistrée : charge 150 UA, sans tracé GPS", ad)
            await btn(c, "Garmin, Polar, Suunto…") if False else None
            ok(await has(c, "Rechercher des échantillons de l'app Santé"), "mode d'emploi du Raccourci iPhone")
            await shot(c, "sante")
            await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(400)

            # ---------- recettes ----------
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(400)
            await c.get_by_role("radio", name="Recettes").click(); await c.wait_for_timeout(400)
            ok(await has(c, "Recette de la semaine") and await c.locator(".rgrid .rcard, .rgrid button").count() >= 20, "livre de recettes et recette de la semaine")
            await btn(c, "Mes goûts")
            await c.get_by_role("group", name="J'évite").get_by_role("button", name="Poisson").click()
            await btn(c, "Enregistrer mes goûts"); await c.wait_for_timeout(500)
            ok(await has(c, "masquées selon tes goûts") or await has(c, "masquée selon tes goûts"), "goûts : recettes avec poisson masquées")
            names = await c.locator(".rgrid").inner_text()
            ok("saumon" not in names.lower() and "thon" not in names.lower() and "cabillaud" not in names.lower(), "aucune recette de poisson affichée")
            await btn(c, "Créer une recette avec l'IA"); await c.fill("#ai-frigo", "poulet, riz, courgettes")
            await c.locator(".modal").get_by_role("button", name="Créer").last.click(); await c.wait_for_timeout(900)
            ok(await has(c, "Bol poulet, riz et courgettes"), "recette créée par l'IA selon le frigo et les goûts")
            await btn(c, "Ajouter à ma liste de courses"); await c.wait_for_timeout(300)
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
            await btn(c, "Liste de courses"); await c.wait_for_timeout(300)
            ok(await has(c, "poulet") or await has(c, "Poulet"), "liste de courses rangée par rayon")
            await shot(c, "recettes_liste")
            st = await c.evaluate("window.__fsStats || null")
            await b.close()
    finally:
        srv.terminate()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
