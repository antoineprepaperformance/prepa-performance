"""Parcours nutrition + coach IA (mock de claude.use("sample"))."""
import asyncio, subprocess, sys, time, os, datetime
from playwright.async_api import async_playwright
PORT = 8765
OUT = "/home/claude/app/shots/nutri"
os.makedirs(OUT, exist_ok=True)
URL = f"http://localhost:{PORT}/index.html"
T = "/home/claude/app/test/"
errs, n = [], [0]
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300)
    await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False, nth=0):
    await page.get_by_role("button", name=text, exact=exact).nth(nth).click(); await page.wait_for_timeout(250)
async def check(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd="/home/claude/app/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
            coach = await A.new_page(); hook(coach, "coach")
            await coach.goto(URL + "?as=owner"); await coach.wait_for_timeout(700)
            await btn(coach, "Offres & réglages", exact=True)
            await shot(coach, "coach_settings_ai")
            await coach.get_by_role("button", name="Enregistrer", exact=True).first.click(); await coach.wait_for_timeout(300)
            # client
            cl = await A.new_page(); hook(cl, "c1"); await cl.set_viewport_size({"width": 390, "height": 844})
            await cl.goto(URL + "?as=c1"); await cl.wait_for_timeout(700)
            await btn(cl, "Commencer mon inscription"); await cl.fill("#ob-name", "Marc Petit"); await cl.fill("#ob-by", "1995"); await cl.fill("#ob-h", "178"); await cl.fill("#ob-w", "75"); await btn(cl, "Continuer")
            await cl.get_by_role("radio", name="Pas de compétition").click(); await cl.get_by_role("radio", name="6 mois à 2 ans").click(); await btn(cl, "Continuer")
            await cl.locator("button.pcard", has_text="Perte de poids").click(); await btn(cl, "Continuer")
            for i in range(await cl.locator(".yn").count()): await cl.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await btn(cl, "Continuer"); await cl.check("#ob-consent"); await btn(cl, "Continuer vers mon accès"); await cl.wait_for_timeout(500)
            await coach.bring_to_front(); await btn(coach, "Tableau de bord", exact=True)
            await coach.locator("ul.alerts button", has_text="Marc").first.click(); await coach.wait_for_timeout(300)
            await coach.fill("#pe-start", (datetime.date.today() - datetime.timedelta(days=9)).isoformat())
            await btn(coach, "Valider et activer"); await coach.wait_for_timeout(400)
            # nutrition : objectif
            await cl.bring_to_front(); await cl.wait_for_timeout(600)
            await shot(cl, "c1_today")
            await cl.locator("nav.tabbar button", has_text="Nutrition").click(); await cl.wait_for_timeout(300)
            await cl.get_by_role("radio", name="Homme").click()
            await cl.fill("#nu-a", "30"); await cl.fill("#nu-h", "180"); await cl.fill("#nu-w", "100")
            await cl.fill("#nu-d", "10"); await cl.get_by_role("radio", name="4", exact=True).click()
            await shot(cl, "c1_objectif_4mois")
            txt = await cl.locator(".card", has_text="Ton plan").inner_text()
            await check("kcal par jour" in txt, "plan calculé : " + " ".join(txt.split()[:14]))
            await cl.get_by_role("radio", name="1", exact=True).click(); await cl.wait_for_timeout(200)
            await check(await cl.locator("text=Objectif trop rapide").count() > 0, "1 mois signalé trop rapide")
            await shot(cl, "c1_objectif_1mois")
            await btn(cl, "Appliquer"); await cl.wait_for_timeout(200)
            await btn(cl, "Enregistrer mon objectif"); await cl.wait_for_timeout(400)
            # photo du repas
            await cl.locator("button.addbtn", has_text="Photo du repas").click()
            await cl.set_input_files("#meal-photo", T + "photo_repas.jpg"); await cl.wait_for_timeout(300)
            await btn(cl, "Analyser la photo"); await cl.wait_for_timeout(600)
            await shot(cl, "c1_photo_result", full=False)
            await cl.locator(".it-g input").nth(1).fill("250"); await cl.wait_for_timeout(100)
            await btn(cl, "Ajouter au journal"); await cl.wait_for_timeout(400)
            # scan code-barres
            await cl.locator("button.addbtn", has_text="Scanner").click()
            await cl.set_input_files("#scan-bc", T + "photo_barcode.jpg"); await cl.wait_for_timeout(2500)
            body = await cl.locator(".modal").inner_text()
            await check("3017620422003" in body, "code-barres décodé : " + ("3017620422003" if "3017620422003" in body else body[:120].replace("\n", " ")))
            await shot(cl, "c1_scan_need_label", full=False)
            if await cl.locator("#scan-lab").count():
                await cl.set_input_files("#scan-lab", T + "photo_etiquette.jpg"); await cl.wait_for_timeout(600)
            await shot(cl, "c1_scan_result", full=False)
            await cl.fill("#scan-g", "150"); await btn(cl, "Ajouter au journal"); await cl.wait_for_timeout(300)
            # deuxième scan du même produit : reconnu sans IA
            nprompts = await cl.evaluate("(window.__prompts||[]).length")
            await cl.locator("button.addbtn", has_text="Scanner").click()
            await cl.set_input_files("#scan-bc", T + "photo_barcode.jpg"); await cl.wait_for_timeout(1500)
            body = await cl.locator(".modal").inner_text()
            await check("Reconnu grâce au code-barres" in body and nprompts == await cl.evaluate("(window.__prompts||[]).length"), "produit reconnu sans appel IA")
            await btn(cl, "Ajouter au journal"); await cl.wait_for_timeout(300)
            # description
            await cl.locator("button.addbtn", has_text="Décrire").click()
            await cl.fill("#meal-txt", "2 œufs brouillés et 2 tranches de pain complet"); await btn(cl, "Estimer"); await cl.wait_for_timeout(500)
            await btn(cl, "Ajouter au journal"); await cl.wait_for_timeout(400)
            await shot(cl, "c1_journal")
            # chat : douleur au genou -> remplacement + signalement
            await cl.locator("button.tab-ia").click(); await cl.wait_for_timeout(300)
            await shot(cl, "c1_chat_empty")
            await cl.fill("#chat-in", "J'ai une gêne au genou sur les squats"); await btn(cl, "Envoyer"); await cl.wait_for_timeout(1200)
            chat = await cl.locator(".chat").inner_text()
            await check("Remplacement : Goblet squat → Pont fessier" in chat, "remplacement appliqué par l'outil")
            last = await cl.evaluate("window.__prompts[window.__prompts.length-1]")
            await check("CONTEXTE DU CLIENT" in last["all"] and "Objectif nutrition" in last["all"] and "remplacer_exercice" in last["tools"], "contexte complet + outils envoyés")
            await check("Blanc de poulet" in last["all"] or "Poulet, riz" in last["all"], "repas du jour dans le contexte")
            await shot(cl, "c1_chat_reply")
            await cl.locator("button.back").click(); await cl.wait_for_timeout(300)
            await cl.locator("nav.tabbar button", has_text="Programme").click(); await cl.wait_for_timeout(200)
            await cl.locator(".weeks button", has_text="S2").first.click()
            await cl.locator("button.srow").first.click(); await cl.wait_for_timeout(300)
            pl = await cl.locator(".player").inner_text()
            await check("Pont fessier" in pl and "Remplacé par le coach IA" in pl, "séance A affiche le remplacement")
            await shot(cl, "c1_player_subst", full=False)
            await cl.locator("button.back").click()
            # bilan -> analyse IA avec ajustement nutrition borné
            await cl.locator("nav.tabbar button", has_text="Bilan").click(); await cl.wait_for_timeout(300)
            await cl.fill("#ck-poids", "99,2") if await cl.locator("#ck-poids").count() else None
            await btn(cl, "Envoyer mon bilan"); await cl.wait_for_timeout(1500)
            rv = await cl.locator(".coachmsg.ai").first.inner_text()
            await check("relevées" in rv or "relevé" in rv, "ajustement 1200 kcal corrigé par les garde-fous : " + rv.replace("\n", " ")[:160])
            await shot(cl, "c1_bilan_ai")
            await cl.locator("nav.tabbar button", has_text="Aujourd'hui").click(); await cl.wait_for_timeout(300)
            await shot(cl, "c1_today_after")
            # coach
            await coach.bring_to_front(); await btn(coach, "Tableau de bord", exact=True); await coach.wait_for_timeout(400)
            dash = await coach.locator("ul.alerts").inner_text()
            await check("ajustement" in dash.lower() or "IA" in dash, "alerte IA au tableau de bord : " + dash.replace("\n", " | ")[:200])
            await shot(coach, "coach_dash")
            await coach.locator("ul.alerts button", has_text="IA").first.click(); await coach.wait_for_timeout(400)
            await shot(coach, "coach_client_ia")
            await coach.get_by_role("radio", name="Nutrition").click(); await coach.wait_for_timeout(300)
            await shot(coach, "coach_client_nutri")
            await coach.get_by_role("radio", name="Bilans").click(); await coach.wait_for_timeout(200)
            await btn(coach, "Rédiger avec l'IA"); await coach.wait_for_timeout(500)
            draft = await coach.locator("textarea[id^=rep-]").first.input_value()
            await check(len(draft) > 30, "brouillon IA : " + draft[:60])
            await shot(coach, "coach_bilan_draft")
            # annulation d'un ajustement
            await coach.get_by_role("radio", name="Coach IA").click(); await coach.wait_for_timeout(200)
            await coach.locator(".adjs li", has_text="Remplacement").get_by_role("button", name="Annuler").click(); await coach.wait_for_timeout(500)
            await cl.bring_to_front(); await cl.locator("nav.tabbar button", has_text="Programme").click(); await cl.wait_for_timeout(300)
            await cl.locator(".weeks button", has_text="S2").first.click(); await cl.locator("button.srow").first.click(); await cl.wait_for_timeout(300)
            pl = await cl.locator(".player").inner_text()
            await check("Goblet squat" in pl and "Remplacé par le coach IA" not in pl, "annulation par le coach rétablit l'exercice")
            await cl.locator("button.back").click()
            # sans IA
            B = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="light")
            ns = await B.new_page(); hook(ns, "nosample")
            await ns.goto(URL + "?as=owner&nosample=1"); await ns.wait_for_timeout(700)
            await ns.get_by_role("button", name="Aperçu côté client").first.click(); await ns.wait_for_timeout(300)
            await check(await ns.locator("button.tab-ia").count() == 0, "pas de bouton Coach IA sans Claude")
            await ns.locator("nav.tabbar button", has_text="Nutrition").click(); await ns.wait_for_timeout(300)
            await shot(ns, "nosample_nutrition")
            # aperçu coach : Sophie
            await coach.bring_to_front(); await coach.set_viewport_size({"width": 390, "height": 844})
            await coach.get_by_role("button", name="Aperçu côté client").first.click(); await coach.wait_for_timeout(300)
            await coach.get_by_role("button", name="Autre exemple").click(); await coach.wait_for_timeout(300)
            await shot(coach, "preview_sophie_today")
            await coach.locator("nav.tabbar button", has_text="Nutrition").click(); await coach.wait_for_timeout(300)
            await shot(coach, "preview_sophie_nutri")
            await coach.get_by_role("radio", name="Mon objectif").click(); await coach.wait_for_timeout(300)
            await shot(coach, "preview_sophie_objectif")
            await b.close()
    finally:
        srv.terminate()
    print("\n".join(errs[:40]) or "no console errors")
asyncio.run(run())
