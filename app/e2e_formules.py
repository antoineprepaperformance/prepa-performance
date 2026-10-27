"""Version Claude : formules (Coach IA ajoutée, Hybride retirée de la vente), limites du coach IA par formule et par jour
(réglées par le coach, compteur visible, photos), formule Coach IA conduite par l'IA (pas d'alerte « vérifier le plan »
ni « bilan à lire » pour Antoine, messagerie fermée, analyse du bilan qui ne compte pas), conditions de vente."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8773
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/formules"; os.makedirs(OUT, exist_ok=True)
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
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)

            # ---------- réglages : formules et limites ----------
            await btn(co, "Offres & réglages", exact=True)
            ok(await co.locator("#pr-ia0").count() == 1 and await co.locator("#pr-hybride0").count() == 0, "grille des prix : Coach IA présente, Hybride retirée")
            ok(await co.input_value("#pr-ia0") == "25" and await co.input_value("#pr-essentiel0") == "49", "Coach IA moins chère que les formules avec Antoine (25 € contre 49 €)")
            ok(await co.input_value("#aiq-ia") == "10" and await co.input_value("#aiph-ia") == "3" and await co.input_value("#aiq-suivi") == "20", "limites par défaut : 10 questions et 3 photos (Coach IA), 20 (Suivi)")
            await co.fill("#aiq-ia", "2"); await co.fill("#aiph-ia", "1")
            await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(600)
            st = await mdb(co, "settings/app") or {}
            ok(((st.get("ai") or {}).get("quota") or {}).get("ia") == {"q": 2, "ph": 1}, "limites enregistrées dans les réglages", (st.get("ai") or {}).get("quota"))
            await co.locator("#aiq-ia").scroll_into_view_if_needed(); await shot(co, "reglages_limites")
            await btn(co, "Codes & essais", exact=True)
            seg = await co.locator(".card", has_text="Créer un code").locator("[role=radio]").all_inner_texts()
            ok("Coach IA" in seg and "Hybride" not in seg, "codes : formule Coach IA proposée, Hybride absente", seg)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Coach IA", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "COACHIA-23456"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)

            # ---------- client Coach IA ----------
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=f1"); await c.wait_for_timeout(700)
            await btn(c, "Commencer mon inscription")
            await c.fill("#ob-name", "Inès Exemple"); await c.fill("#ob-by", "1996"); await c.fill("#ob-h", "168"); await c.fill("#ob-w", "61"); await c.fill("#ob-sport", "Fitness")
            await btn(c, "Continuer")
            await c.get_by_role("radio", name="Loisir ou départemental", exact=True).click(); await c.get_by_role("radio", name="6 mois à 2 ans", exact=True).click()
            await btn(c, "Continuer")
            await c.locator("button.pcard", has_text="Remise en forme").click(); await btn(c, "Continuer")
            for i in range(await c.locator(".yn").count()):
                await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await btn(c, "Continuer"); await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(700)
            await c.get_by_role("radio", name="Coach IA", exact=True).first.click(); await c.wait_for_timeout(300)
            ok(await has(c, "Coach IA : jusqu'à 2 questions et 1 photo par jour.") and await c.get_by_role("radio", name="Hybride").count() == 0, "commande : formule Coach IA avec ses limites du jour, plus de Hybride")
            await shot(c, "commande_coach_ia", full=True)
            await c.fill("#pu-code", "COACHIA-23456"); await btn(c, "Appliquer", exact=True); await c.wait_for_timeout(300)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            plan = await mdb(c, "plans/u_f1") or {}
            ok(plan.get("offer") == "ia" and plan.get("status") == "active", "accès Coach IA actif", plan)

            # ---------- coach : pas d'alerte « vérifier le plan » ----------
            await co.bring_to_front(); await btn(co, "Tableau de bord", exact=True); await co.wait_for_timeout(500)
            row = co.locator("tr", has_text="Inès Exemple")
            t = (await co.inner_text("body"))
            ok("Inès Exemple" in t and not any(("Inès" in l and "vérifier le plan" in l) for l in t.split("\n")), "coach : pas d'alerte « vérifier le plan » pour un client Coach IA")

            # ---------- coach IA : limites du jour ----------
            await c.bring_to_front()
            await c.get_by_role("button", name="Coach IA").first.click(); await c.wait_for_timeout(500)
            ok(await has(c, "Questions au coach IA aujourd'hui : 0 sur 2 (formule Coach IA)."), "compteur visible : 0 sur 2")
            for q in ["Que manger ce soir ?", "Et demain matin ?"]:
                await c.fill("#chat-in", q); await c.keyboard.press("Enter"); await c.wait_for_timeout(900)
            use = await mdb(c, f"clients/u_f1/aiuse/{TODAY.isoformat()}") or {}
            ok(use.get("q") == 2 and use.get("ph") == 0, "2 questions comptées", use)
            n0 = len(await c.evaluate("window.__prompts || []"))
            await c.fill("#chat-in", "Une troisième ?"); await c.keyboard.press("Enter"); await c.wait_for_timeout(700)
            n1 = len(await c.evaluate("window.__prompts || []"))
            ok(n1 == n0 and await has(c, "Tu as utilisé tes 2 questions au coach IA aujourd'hui"), "3e question bloquée avant d'appeler l'IA, message clair")
            await shot(c, "chat_limite")

            # ---------- photo de repas : 1 par jour ----------
            await c.goto(URL + "?as=f1"); await c.wait_for_timeout(1000)
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(400)
            await c.get_by_role("radio", name="Femme").click(); await c.get_by_role("radio", name="Garder mon poids").click()
            await btn(c, "Enregistrer mon objectif"); await c.wait_for_timeout(600)
            await c.evaluate(f"(() => {{ const db = JSON.parse(localStorage.getItem('__mockdb') || '{{}}'); db['clients/u_f1/aiuse/{TODAY.isoformat()}'] = {{ d: '{TODAY.isoformat()}', q: 0, ph: 0 }}; localStorage.setItem('__mockdb', JSON.stringify(db)); }})()")
            await c.reload(); await c.wait_for_timeout(1000); await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(400)
            await c.locator("button.addbtn", has_text="Photo du repas").click(); await c.wait_for_timeout(300)
            await c.set_input_files("#meal-photo", HERE + "/test/photo_repas.jpg"); await btn(c, "Analyser la photo"); await c.wait_for_timeout(1500)
            ok(await c.locator(".modal .it-src").count() >= 1, "1re photo analysée")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
            use = await mdb(c, f"clients/u_f1/aiuse/{TODAY.isoformat()}") or {}
            ok(use.get("ph") == 1 and use.get("q") == 1, "photo comptée (1 question, 1 photo)", use)
            await c.locator("button.addbtn", has_text="Photo du repas").click(); await c.wait_for_timeout(300)
            await c.set_input_files("#meal-photo", HERE + "/test/photo_repas.jpg"); await btn(c, "Analyser la photo"); await c.wait_for_timeout(1200)
            ok(await has(c, "Tu as utilisé tes 1 photo analysées") or await has(c, "photo analysées par le coach IA aujourd'hui"), "2e photo refusée : limite de photos du jour")
            await shot(c, "photo_limite")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)

            # ---------- bilan : analysé par l'IA, ne compte pas ----------
            await c.evaluate(f"(() => {{ const db = JSON.parse(localStorage.getItem('__mockdb') || '{{}}'); const p = db['plans/u_f1']; p.start = '{(TODAY - datetime.timedelta(days=8)).isoformat()}'; localStorage.setItem('__mockdb', JSON.stringify(db)); }})()")
            await c.goto(URL + "?as=f1"); await c.wait_for_timeout(1000)
            await c.get_by_role("button", name="Bilan").first.click(); await c.wait_for_timeout(500)
            ok(await has(c, "Deux minutes pour faire le point avec ton coach IA.") and await has(c, "Formule Coach IA : ton bilan est analysé par le coach IA"), "bilan : formule Coach IA expliquée (pas de réponse personnelle)")
            await shot(c, "bilan_ia", full=True)

            # ---------- messagerie fermée pour Coach IA ----------
            await c.goto(URL + "?as=f1"); await c.wait_for_timeout(1000)
            await c.get_by_role("button", name="Mon profil").click(); await c.wait_for_timeout(400)
            await c.get_by_role("button", name="Écrire à Antoine").first.click(); await c.wait_for_timeout(400)
            ok(await has(c, "n'est pas incluse dans la formule Coach IA : pose tes questions au coach IA."), "Coach IA : messagerie fermée par défaut, le client est orienté vers le coach IA")

            # ---------- conditions de vente ----------
            await co.bring_to_front(); await btn(co, "Offres & réglages", exact=True); await co.wait_for_timeout(300)
            cgv = await co.evaluate("document.body.innerText")
            await co.goto(URL + "?as=f1"); await co.wait_for_timeout(1000)
            await btn(co, "Mon profil"); await co.wait_for_timeout(300)
            link = co.get_by_role("button", name="Conditions de vente")
            if await link.count(): await link.first.click(); await co.wait_for_timeout(400)
            t = await co.inner_text("body")
            ok("Coach IA (programme conduit par une intelligence artificielle" in t and "Coach IA : 2 questions et 1 photo" in t and "Hybride" not in t, "CGV : formule Coach IA décrite avec ses limites, Hybride retirée", t[t.find("2. Services"):t.find("2. Services") + 300] if "2. Services" in t else t[:300])
            await b.close()
    finally:
        srv.terminate()
    real = [e for e in errs if "favicon" not in e]
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    if real: print("ERREURS CONSOLE :\n" + "\n".join(real[:20]))
    sys.exit(1 if fails or real else 0)
asyncio.run(run())
