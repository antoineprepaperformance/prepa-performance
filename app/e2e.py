"""Parcours complet : coach + client synchronisé + client sans compte (mock claude.use)."""
import asyncio, subprocess, sys, time, os, datetime
from playwright.async_api import async_playwright
PORT = 8765
OUT = "/home/claude/app/shots/e2e"
os.makedirs(OUT, exist_ok=True)
URL = f"http://localhost:{PORT}/index.html"
errs = []
n = [0]

def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))

async def shot(page, name, full=True):
    n[0] += 1
    await page.wait_for_timeout(250)
    await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)

async def btn(page, text, exact=False, nth=0):
    loc = page.get_by_role("button", name=text, exact=exact)
    await loc.nth(nth).click()
    await page.wait_for_timeout(200)

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd="/home/claude/app/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
            coach = await A.new_page(); hook(coach, "coach")
            await coach.goto(URL + "?as=owner"); await coach.wait_for_timeout(700)
            # --- Programmes : voir, dupliquer, modifier
            await btn(coach, "Programmes", exact=True)
            await shot(coach, "coach_programmes")
            await coach.locator("button", has_text="Perte de poids").first.click(); await coach.wait_for_timeout(300)
            await shot(coach, "coach_prog_view")
            await btn(coach, "Dupliquer pour personnaliser"); await coach.wait_for_timeout(400)
            await shot(coach, "coach_prog_dup")
            await btn(coach, "Enregistrer le programme"); await coach.wait_for_timeout(400)
            await btn(coach, "Créer une séance"); await coach.wait_for_timeout(300)
            await shot(coach, "coach_session_new")
            ins = coach.locator("input").first
            await btn(coach, "Enregistrer", exact=True); await coach.wait_for_timeout(400)
            await shot(coach, "coach_programmes_after")
            # --- Exercices
            await btn(coach, "Exercices", exact=True)
            await coach.locator("button.exitem").first.click(); await coach.wait_for_timeout(200)
            await coach.fill("#xe-v", "https://www.youtube.com/watch?v=demo")
            await coach.fill("#xe-no", "Pieds largeur de hanches, je veux voir la descente contrôlée.")
            await shot(coach, "coach_exo_edit", full=False)
            await coach.locator(".modal").get_by_role("button", name="Enregistrer", exact=True).click(); await coach.wait_for_timeout(300)
            await shot(coach, "coach_exos")
            # --- Réglages
            await btn(coach, "Offres & réglages", exact=True)
            await coach.fill("#st-p", "06 12 34 56 78"); await coach.fill("#st-e", "antoine.prepa@example.com"); await coach.fill("#st-i", "@antoineprepaperf")
            await shot(coach, "coach_settings")
            await coach.get_by_role("button", name="Enregistrer", exact=True).first.click(); await coach.wait_for_timeout(300)
            # --- Aperçu client
            await btn(coach, "Aperçu côté client")
            await shot(coach, "preview_client")
            await coach.get_by_role("button", name="Revenir à l'espace coach").click(); await coach.wait_for_timeout(300)

            # --- Client synchronisé (même contexte = même base simulée)
            cl = await A.new_page(); hook(cl, "c1")
            await cl.set_viewport_size({"width": 390, "height": 844})
            await cl.goto(URL + "?as=c1"); await cl.wait_for_timeout(700)
            await shot(cl, "c1_onboard0")
            await btn(cl, "Commencer mon inscription")
            await cl.fill("#ob-name", "Julie Martin"); await cl.fill("#ob-by", "1995"); await cl.fill("#ob-h", "178"); await cl.fill("#ob-w", "75"); await cl.fill("#ob-email", "julie@example.com"); await cl.fill("#ob-sport", "Handball")
            await btn(cl, "Continuer")
            await cl.get_by_role("radio", name="Régional", exact=True).click(); await cl.get_by_role("radio", name="6 mois à 2 ans").click()
            await shot(cl, "c1_niveau")
            await btn(cl, "Continuer")
            await cl.locator("button.pcard", has_text="Perte de poids").click()
            await shot(cl, "c1_objectif")
            await btn(cl, "Continuer")
            for i in range(await cl.locator(".yn").count()):
                await cl.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await shot(cl, "c1_sante")
            await btn(cl, "Continuer")
            await cl.check("#ob-consent")
            await shot(cl, "c1_recap")
            await btn(cl, "Continuer vers mon accès"); await cl.wait_for_timeout(600)
            await shot(cl, "c1_waiting")

            # --- Coach valide avec un départ il y a 9 jours (semaine 2)
            await coach.bring_to_front(); await coach.wait_for_timeout(500)
            await btn(coach, "Tableau de bord", exact=True)
            await shot(coach, "coach_dash_newreq")
            await coach.locator("ul.alerts button", has_text="Julie").first.click(); await coach.wait_for_timeout(400)
            start = (datetime.date.today() - datetime.timedelta(days=9)).isoformat()
            await coach.fill("#pe-start", start)
            await coach.fill("#pe-msg", "Bienvenue Julie ! Vise 3 séances par semaine et 8 000 pas par jour.")
            await shot(coach, "coach_plan_validate")
            await btn(coach, "Valider et activer"); await coach.wait_for_timeout(500)

            # --- Client : séance, bilan, tests
            await cl.bring_to_front(); await cl.wait_for_timeout(700)
            await shot(cl, "c1_today")
            await cl.locator("button.next").click(); await cl.wait_for_timeout(300)
            kg = cl.locator(".sets input[id^=kg-]")
            for i in range(min(await kg.count(), 6)):
                await kg.nth(i).fill(str(30 + 2 * i))
            dones = cl.locator("button.donebtn")
            for i in range(await dones.count()):
                await dones.nth(i).click()
            await cl.locator("#rpe button", has_text="7").first.click()
            await shot(cl, "c1_player")
            await btn(cl, "Enregistrer la séance"); await cl.wait_for_timeout(500)
            # séance de la semaine 1 aussi, via l'onglet Programme
            await cl.locator("nav.tabbar button", has_text="Programme").click()
            await cl.locator(".weeks button", has_text="S1").first.click()
            await cl.locator("button.srow").first.click(); await cl.wait_for_timeout(300)
            kg = cl.locator(".sets input[id^=kg-]")
            for i in range(min(await kg.count(), 6)):
                await kg.nth(i).fill(str(26 + 2 * i))
            await cl.locator("#rpe button", has_text="6").first.click()
            await btn(cl, "Enregistrer la séance"); await cl.wait_for_timeout(400)
            await shot(cl, "c1_programme")
            await cl.locator("nav.tabbar button", has_text="Bilan").click(); await cl.wait_for_timeout(300)
            await shot(cl, "c1_bilan_form")
            if await cl.locator("#ck-poids").count(): await cl.fill("#ck-poids", "72,4")
            if await cl.locator("#ck-taille").count(): await cl.fill("#ck-taille", "81")
            for k, v in [("sommeil", "4"), ("energie", "3"), ("stress", "2"), ("courbatures", "3"), ("nutrition", "4")]:
                loc = cl.locator(f"#ck-{k} button", has_text=v)
                if await loc.count(): await loc.first.click()
            if await cl.locator("#ck-question").count(): await cl.fill("#ck-question", "Je peux remplacer le rameur par le vélo ?")
            await btn(cl, "Envoyer mon bilan"); await cl.wait_for_timeout(500)
            await cl.locator("nav.tabbar button", has_text="Progrès").click(); await cl.wait_for_timeout(300)
            await btn(cl, "Saisir", exact=True)
            inputs = cl.locator(".modal input")
            for i in range(await inputs.count()):
                await inputs.nth(i).fill(str(10 + i))
            await shot(cl, "c1_tests_form", full=False)
            await btn(cl, "Enregistrer les tests"); await cl.wait_for_timeout(400)
            await shot(cl, "c1_progres")
            await cl.get_by_role("button", name="Mon profil").click()
            await shot(cl, "c1_profil")

            # --- Coach : fiche client, réponse au bilan
            await coach.bring_to_front(); await coach.wait_for_timeout(500)
            await coach.get_by_role("radio", name="Vue d'ensemble").click(); await coach.wait_for_timeout(300)
            await shot(coach, "coach_client_vue")
            await coach.get_by_role("radio", name="Bilans").click(); await coach.wait_for_timeout(200)
            await coach.locator(".chipbtn").first.click()
            await btn(coach, "Envoyer la réponse"); await coach.wait_for_timeout(400)
            await shot(coach, "coach_client_bilans")
            await coach.get_by_role("radio", name="Séances").click(); await coach.wait_for_timeout(200)
            await shot(coach, "coach_client_seances")
            await coach.get_by_role("radio", name="Tests").click(); await coach.wait_for_timeout(200)
            await shot(coach, "coach_client_tests")
            await btn(coach, "Tableau de bord", exact=True)
            await shot(coach, "coach_dash_after")
            await cl.bring_to_front(); await cl.wait_for_timeout(500)
            await cl.locator("nav.tabbar button", has_text="Aujourd'hui").click()
            await shot(cl, "c1_today_reply")

            # --- Client sans compte (autre appareil, accès lecture seule)
            B = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="light")
            lc = await B.new_page(); hook(lc, "local")
            await lc.goto(URL + "?as=c2&ro=1"); await lc.wait_for_timeout(700)
            await btn(lc, "Commencer mon inscription")
            await lc.fill("#ob-name", "Tom Durand"); await lc.fill("#ob-by", "1995"); await lc.fill("#ob-h", "178"); await lc.fill("#ob-w", "75")
            await btn(lc, "Continuer")
            await lc.get_by_role("radio", name="Loisir ou départemental").click(); await lc.get_by_role("radio", name="Moins de 6 mois").click()
            await btn(lc, "Continuer")
            await lc.locator("button.pcard", has_text="Retour à la course").click()
            await btn(lc, "Continuer")
            for i in range(await lc.locator(".yn").count()):
                await lc.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            boxes = lc.locator("input[id^=pr-]")
            for i in range(await boxes.count()):
                await boxes.nth(i).check()
            try:
                await lc.get_by_role("radio", name="Gauche").click(timeout=3000)
            except Exception as e:
                await shot(lc, "FAIL_local_sante"); raise
            await shot(lc, "local_sante")
            await btn(lc, "Continuer"); await lc.check("#ob-consent")
            await btn(lc, "Continuer vers mon accès"); await lc.wait_for_timeout(600)
            await btn(lc, "Afficher le texte")
            pkg = await lc.locator("textarea.code").first.input_value()
            await shot(lc, "local_waiting")
            print("package length", len(pkg), pkg[:12])
            # coach importe
            await coach.bring_to_front()
            await btn(coach, "Importer un envoi")
            await coach.fill("#imp", pkg)
            await btn(coach, "Importer", exact=True); await coach.wait_for_timeout(600)
            await shot(coach, "coach_imported")
            await coach.get_by_role("radio", name="Plan").click(); await coach.wait_for_timeout(200)
            await coach.fill("#pe-start", (datetime.date.today() - datetime.timedelta(days=2)).isoformat())
            await btn(coach, "Valider et activer"); await coach.wait_for_timeout(400)
            await btn(coach, "Afficher le texte")
            code = await coach.locator("#acc").input_value()
            print("code length", len(code), code[:12])
            await shot(coach, "coach_access_code")
            # client applique le code
            await lc.bring_to_front()
            await lc.fill("#code", code)
            await btn(lc, "Activer mon programme"); await lc.wait_for_timeout(500)
            await shot(lc, "local_today")
            await lc.locator("button.next").click(); await lc.wait_for_timeout(300)
            await lc.locator("#rpe button", has_text="5").first.click()
            await lc.locator("#douleur button", has_text="2").first.click()
            await lc.fill("#zone", "mollet gauche")
            await btn(lc, "Enregistrer la séance"); await lc.wait_for_timeout(400)
            await lc.get_by_role("button", name="Mon profil").click()
            await btn(lc, "Afficher le texte")
            pkg2 = await lc.locator("textarea.code").first.input_value()
            await shot(lc, "local_profil")
            await coach.bring_to_front()
            await btn(coach, "Tableau de bord", exact=True)
            await btn(coach, "Importer un envoi")
            await coach.fill("#imp", pkg2)
            await btn(coach, "Importer", exact=True); await coach.wait_for_timeout(600)
            await coach.get_by_role("radio", name="Séances").click(); await coach.wait_for_timeout(200)
            await shot(coach, "coach_local_seances")
            await coach.get_by_role("radio", name="Notes").click(); await coach.wait_for_timeout(200)
            await coach.fill("#del-c", "supprimer")
            await shot(coach, "coach_delete")
            await btn(coach, "Supprimer définitivement"); await coach.wait_for_timeout(800)
            await btn(coach, "Tableau de bord", exact=True)
            await shot(coach, "coach_dash_final")
            print("rows after delete:", await coach.locator("table.ctable tbody tr").count())
            # mobile coach + light
            C = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="light")
            cm = await C.new_page(); hook(cm, "coach-mobile")
            await cm.goto(URL + "?as=owner"); await cm.wait_for_timeout(700)
            await shot(cm, "coach_mobile_light")
            await b.close()
    finally:
        srv.terminate()
    print("\n".join(errs[:60]) or "no console errors")

asyncio.run(run())
