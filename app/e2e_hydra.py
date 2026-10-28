"""Hydratation : objectif d'eau, suivi du jour, test de sueur, contexte du coach IA, anglais (version Claude, mock)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, subprocess, sys, time, os, datetime, re
from playwright.async_api import async_playwright
PORT = 8767
OUT = HERE + "/shots/hydra"
os.makedirs(OUT, exist_ok=True)
URL = f"http://localhost:{PORT}/index.html"
errs, res = [], {"ok": 0, "ko": 0}
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + str(extra)[:300]))
async def btn(page, text, exact=False, nth=0):
    await page.get_by_role("button", name=text, exact=exact).nth(nth).click(); await page.wait_for_timeout(250)
async def card(page, title):
    return " ".join((await page.locator(".card", has_text=title).first.inner_text()).split())

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
            coach = await A.new_page(); hook(coach, "coach")
            await coach.goto(URL + "?as=owner"); await coach.wait_for_timeout(700)
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
            # objectif nutrition : 100 kg, perte
            await cl.bring_to_front(); await cl.wait_for_timeout(600)
            await cl.locator("nav.tabbar button", has_text="Nutrition").click(); await cl.wait_for_timeout(300)
            await cl.get_by_role("radio", name="Homme").click()
            await cl.fill("#nu-a", "30"); await cl.fill("#nu-h", "180"); await cl.fill("#nu-w", "100")
            await cl.fill("#nu-d", "10"); await cl.get_by_role("radio", name="4", exact=True).click()
            await btn(cl, "Enregistrer mon objectif"); await cl.wait_for_timeout(500)
            t = await card(cl, "Hydratation")
            ok("Hydratation" in t and "0 L sur 2,5 L" in t, "carte Hydratation : 0 L sur 2,5 L (33 mL par kg, dernier poids noté 75 kg)", t)
            ok("Base : 2,5 L (33 mL par kg)" in t, "base expliquée", t)
            await btn(cl, "+ 500 mL"); await btn(cl, "+ 500 mL"); await btn(cl, "+ 250 mL"); await cl.wait_for_timeout(300)
            t = await card(cl, "Hydratation")
            ok("1,25 L sur 2,5 L" in t and "encore 1,3 L" in t, "+ 500, + 500, + 250 mL : 1,25 L, encore 1,3 L", t)
            await btn(cl, "− 250 mL"); await cl.wait_for_timeout(300)
            t = await card(cl, "Hydratation")
            ok(re.search(r"\b1 L sur", t) is not None, "− 250 mL : 1 L", t)
            await cl.locator(".card", has_text="Hydratation").get_by_role("button", name="Saisir", exact=True).click(); await cl.wait_for_timeout(200)
            await cl.fill("#hy-edit", "1,8"); await cl.locator(".card", has_text="Hydratation").get_by_role("button", name="Enregistrer", exact=True).click(); await cl.wait_for_timeout(300)
            t = await card(cl, "Hydratation")
            ok("1,8 L" in t, "saisie du total : 1,8 L", t)
            ok("1,3 kg de plus en 12 semaines" in (await cl.locator(".card", has_text="Hydratation").first.text_content()), "conseil perte de poids (Parretti 2015)")
            ok("Sawka MN" in (await cl.locator(".card", has_text="Hydratation").first.text_content()), "références scientifiques")
            # test de sueur
            await cl.locator("summary", has_text="Mesurer ma perte en sueur").click(); await cl.wait_for_timeout(200)
            await cl.fill("#sw-avant", "80"); await cl.fill("#sw-apres", "79"); await cl.fill("#sw-bu", "0,5"); await cl.fill("#sw-min", "60"); await cl.wait_for_timeout(200)
            t = await card(cl, "Hydratation")
            ok("Tu perds environ 1,5 L de sueur par heure" in t and "1,3 % de ton poids" in t and "sous le seuil de 2 %" in t and "bois environ 1,5 L" in t, "test de sueur : 1,5 L par heure, 1,3 % du poids, 1,5 L à reboire", t)
            await btn(cl, "Enregistrer le test"); await cl.wait_for_timeout(400)
            t = await card(cl, "Hydratation")
            ok("dernier test : 1,5 L par heure" in t, "test de sueur enregistré", t)
            await cl.screenshot(path=OUT + "/hydra_fr.png", full_page=True)
            # calculs (séance du jour, débit mesuré, mode équilibre)
            r = await cl.evaluate("""() => { const d = todayISO(); const np = { sex: "H", weight0: 80, goal: "maintien" };
              const a = hydraTarget({ logs: { x: { date: d, duree: 60 } }, sante: {}, nutri: { plan: np } }, np, d);
              const b = hydraTarget({ logs: { x: { date: d, duree: 90 } }, sante: { [d]: { sueur: { taux: 1.2 } } }, nutri: { plan: np } }, np, d);
              const c = hydraTarget({ logs: { x: { date: d, duree: 60 } }, sante: { [d]: { sueur: { taux: 1.2 } } }, nutri: { plan: { ...np, mode: "equilibre" } } }, { ...np, mode: "equilibre" }, d);
              const e = hydraTarget({ logs: { x: { date: d, duree: 240 } }, sante: { [d]: { sueur: { taux: 2.5 } } } }, np, d);
              return [a.base, a.extra, b.extra, b.measured, c.base, c.extra, c.measured, e.extra]; }""")
            ok(r[:2] == [2.6, 0.5], "séance de 60 min sans test : + 0,5 L", r)
            ok(r[2] == 1.8 and r[3] is True, "séance de 90 min, débit mesuré 1,2 L/h : + 1,8 L", r)
            ok(r[4] == 2.0 and r[5] == 0.5 and r[6] is False, "mode équilibre : repère sans le poids, sans test de sueur", r)
            ok(r[7] == 2.5, "supplément plafonné à 2,5 L", r)
            # écran Aujourd'hui, santé, coach IA
            await cl.locator("nav.tabbar button").first.click(); await cl.wait_for_timeout(400)
            ok(await cl.locator("button.nutri-mini", has_text="Eau : 1,8 / 2,5 L").count() > 0, "Aujourd'hui : eau 1,8 / 2,5 L")
            src = await cl.evaluate("() => clientContext.toString().includes('Hydratation aujourd')")
            ok(src, "contexte du coach IA : hydratation du jour")
            # anglais
            await cl.goto(URL + "?as=c1&lang=en"); await cl.wait_for_timeout(900)
            await cl.locator("nav.tabbar button").nth(1).click(); await cl.wait_for_timeout(200)
            await cl.locator("nav.tabbar button", has_text="Nutrition").click(); await cl.wait_for_timeout(400)
            t = " ".join((await cl.locator(".card", has_text="Hydration").first.inner_text()).split())
            ok("Hydration" in t and "+ 500 mL" in t and "a bottle" in t and "Base: 2.5 L (33 mL per kg)" in t and "undo" in t and "last test: 1.5 L per hour" in t and "corriger" not in t, "anglais : carte traduite", t)
            await cl.screenshot(path=OUT + "/hydra_en.png", full_page=True)
            await cl.goto(URL + "?as=c1&lang=fr"); await cl.wait_for_timeout(500)
            await b.close()
    finally:
        srv.terminate()
    print(f"\n{res['ok']} OK, {res['ko']} échecs")
    print("\n".join(errs[:20]) or "aucune erreur console")
    sys.exit(1 if res["ko"] or errs else 0)

asyncio.run(run())
