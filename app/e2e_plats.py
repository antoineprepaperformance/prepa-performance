"""Plats types dans « Saisir un repas » : idées selon le reste du jour, catégories, ajout au journal, anglais (version Claude, mock)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, subprocess, sys, time, os, datetime, re
from playwright.async_api import async_playwright
PORT = 8768
OUT = HERE + "/shots/plats"
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
            b_ = await p.chromium.launch()
            A = await b_.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
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
            await cl.locator("button.addbtn", has_text="Saisir").click(); await cl.wait_for_timeout(300)
            m = cl.locator(".modal")
            await cl.fill("#fd-q", "riz basm"); await cl.wait_for_timeout(400)
            ok(await m.locator(".sugg button", has_text="Riz basmati, cuit, sans sel ajouté").count() == 1, "recherche dans la table de l'ANSES à côté des plats types")
            await cl.fill("#fd-q", ""); await cl.wait_for_timeout(200)
            t = " ".join((await m.inner_text()).split())
            ok("Plats types" in t and "Idées pour ce repas" in t, "saisie : plats types et idées pour ce repas", t[:200])
            n_ideas = await m.locator(".plat-list button").count()
            ok(1 <= n_ideas <= 6, "idées : 1 à 6 plats proposés", n_ideas)
            ok("vise environ" in t, "idées : calories visées pour ce repas", t[:300])
            r = await cl.evaluate("""() => { const np = { targets: { kcal: 2400, p: 160, c: 250, f: 70 } };
              const a = platIdeas("matin", np, { kcal: 0, p: 0 }, 6), b = platIdeas("collation", np, { kcal: 2300, p: 150 }, 6), c = platIdeas("midi", np, { kcal: 600, p: 30 }, 6);
              const tot = (p) => Math.round(platTot(p).kcal);
              return { a: a.list.every((p) => p.cat === "matin"), b: b.list.every((p) => p.cat === "collation"), bIdeal: b.ideal, c: c.list.every((p) => ["sport", "plat", "pouce"].includes(p.cat)), cIdeal: c.ideal, cFirst: tot(c.list[0]), n: PLATS.length,
                poulet: tot(PLATS.find((p) => p.n === "Poulet, riz et brocolis")) }; }""")
            ok(r["a"] and r["b"] and r["c"], "idées selon le moment : petit-déjeuner, collation, repas", r)
            ok(r["n"] >= 50, "plus de 50 plats types", r["n"])
            ok(r["cIdeal"] == 840 and abs(r["cFirst"] - 840) < 250, "déjeuner (1 800 kcal restantes) : part de 840 kcal, premier plat proche", r)
            ok(r["bIdeal"] == 120, "collation en fin de journée : idées légères", r)
            ok(r["poulet"] == 656, "poulet, riz, brocolis : 656 kcal (table Ciqual)", r["poulet"])
            await m.get_by_role("radio", name="Assiettes du sportif").click(); await cl.wait_for_timeout(200)
            b = m.locator(".plat-list button", has_text="Poulet, riz et brocolis")
            bt = " ".join((await b.inner_text()).split())
            ok("656 kcal · P 56 g · G 69 g · L 15 g" in bt, "catégorie Assiettes du sportif : macros affichées", bt)
            await b.click(); await cl.wait_for_timeout(300)
            t = " ".join((await m.inner_text()).split())
            ok("Riz blanc cuit" in t and "Brocolis cuits" in t and await cl.input_value("#mn-n") == "Poulet, riz et brocolis", "plat ajouté : éléments modifiables et nom du repas", t[:300])
            ok(await m.get_by_role("button", name="+ Ajouter un plat type").count() == 1, "lien pour ajouter un autre plat type")
            await m.get_by_role("button", name="Ajouter au journal").click(); await cl.wait_for_timeout(500)
            t = " ".join((await cl.locator("main, body").first.inner_text()).split())
            ok("Poulet, riz et brocolis" in t and "656 kcal" in t, "repas ajouté au journal (656 kcal)", t[:200])
            await cl.screenshot(path=OUT + "/journal.png", full_page=True)
            await cl.locator("button.addbtn", has_text="Saisir").click(); await cl.wait_for_timeout(300)
            await cl.locator(".modal").screenshot(path=OUT + "/saisie.png")
            await cl.keyboard.press("Escape"); await cl.wait_for_timeout(200)
            # anglais
            await cl.goto(URL + "?as=c1&lang=en"); await cl.wait_for_timeout(900)
            await cl.locator("nav.tabbar button", has_text="Nutrition").click(); await cl.wait_for_timeout(400)
            await cl.locator("button.addbtn", has_text="Enter").click(); await cl.wait_for_timeout(300)
            m = cl.locator(".modal")
            await m.get_by_role("radio", name="Athlete plates").click(); await cl.wait_for_timeout(200)
            t = " ".join((await m.inner_text()).split())
            ok("Typical dishes" in t and "Chicken, rice and broccoli" in t and "656 kcal · P 56 g · C 69 g · F 15 g" in t, "anglais : plats types traduits", t[:300])
            await cl.goto(URL + "?as=c1&lang=fr"); await cl.wait_for_timeout(500)
            await b_.close()
    finally:
        srv.terminate()
    print(f"\n{res['ok']} OK, {res['ko']} échecs")
    print("\n".join(errs[:20]) or "aucune erreur console")
    sys.exit(1 if res["ko"] or errs else 0)

asyncio.run(run())
