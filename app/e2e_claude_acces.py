"""Version Claude : profil de niveau, commande, code activé par l'espace coach, paiement confirmé par le coach (base simulée claude.use)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8768
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/claude_acces"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:400]))
async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)
async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def onboard(page, name, sport, compet, xp, prog):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-sport", sport); await page.fill("#ob-by", "1997")
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
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="light")
            await A.route("https://buy.stripe.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<h1>Stripe (simulé)</h1>"))
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)
            await btn(co, "Codes & essais", exact=True)
            ok(not await has(co, "Copier le lien", 600), "version Claude : pas de lien d'offre (le client saisit le code)")
            await co.get_by_role("radio", name="1 semaine").click(); await btn(co, "Créer le code"); await co.wait_for_timeout(400)
            code = (await co.locator(".codeitem .mono").first.inner_text()).strip()
            ok(code.startswith("ESSAI-"), "code créé : " + code)
            await btn(co, "Offres & réglages", exact=True)
            ok(await co.get_by_role("radio", name="Automatique (relais installé)").count() == 0, "version Claude : pas de mode automatique (pas de relais)")
            await co.fill("#pl-suivi4", "https://buy.stripe.com/test_suivi1")
            await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(400)
            # client 1 : code
            c1 = await A.new_page(); hook(c1, "c1"); await c1.set_viewport_size({"width": 390, "height": 844})
            await c1.goto(URL + "?as=k1"); await c1.wait_for_timeout(700)
            await onboard(c1, "Kevin Code", "Rugby", "National", "Plus de 2 ans", "Vitesse & explosivité")
            ok(await has(c1, "active ton accès"), "client : écran d'accès après l'inscription")
            await c1.fill("#pu-code", code); await btn(c1, "Appliquer", exact=True); await c1.wait_for_timeout(300)
            ok(await has(c1, "vérifié par Antoine"), "code noté, vérifié par le coach")
            await c1.fill("#pu-start", __import__("datetime").date.today().isoformat())
            await c1.check("#pu-cgv"); await btn(c1, "Envoyer mon code à Antoine"); await c1.wait_for_timeout(700)
            ok(await has(c1, "Code en attente d'activation", 1500) or await has(c1, "prochaine séance", 1500), "client : code en attente (ou déjà activé si l'espace coach est ouvert)")
            await shot(c1, "code_en_attente")
            await co.bring_to_front(); await btn(co, "Tableau de bord", exact=True); await co.wait_for_timeout(1500)
            plan = await mdb(co, "plans/u_k1")
            cdoc = await mdb(co, "codes/" + code)
            ok(plan and plan["source"]["kind"] == "code" and plan["weeks"] == 1 and plan["niveau"] == "perf", "espace coach : code vérifié et accès activé automatiquement", plan)
            ok(cdoc and cdoc["uses"] == 1 and "u_k1" in cdoc["usedBy"], "code compté comme utilisé")
            await c1.bring_to_front(); await c1.wait_for_timeout(800)
            ok(await has(c1, "prochaine séance", 6000) or await has(c1, "commence dans", 1000), "client : programme ouvert")
            await c1.locator("button.next").click(); await c1.wait_for_timeout(400)
            ok(await has(c1, "Contrôle de forme") and await has(c1, "Échauffement RAMP"), "version Claude : séance Performance détaillée")
            await shot(c1, "seance_perf")
            # client 2 : même code → épuisé (vérifié côté coach)
            c2 = await A.new_page(); hook(c2, "c2"); await c2.set_viewport_size({"width": 390, "height": 844})
            await c2.goto(URL + "?as=k2"); await c2.wait_for_timeout(700)
            await onboard(c2, "Kim Retard", "Basket", "Régional", "6 mois à 2 ans", "Prépa sports collectifs")
            await c2.fill("#pu-code", code); await btn(c2, "Appliquer", exact=True); await c2.check("#pu-cgv"); await btn(c2, "Envoyer mon code à Antoine"); await c2.wait_for_timeout(600)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            ok(not await mdb(co, "plans/u_k2"), "code épuisé : pas d'activation")
            ok(await has(co, "Code " + code + " à activer"), "coach : le code épuisé reste à traiter")
            # client 3 : paiement Stripe (nouvel onglet) puis confirmation par le coach
            c3 = await A.new_page(); hook(c3, "c3"); await c3.set_viewport_size({"width": 390, "height": 844})
            await c3.goto(URL + "?as=k3"); await c3.wait_for_timeout(700)
            await onboard(c3, "Paul Payeur", "Football", "Régional", "6 mois à 2 ans", "Prépa sports collectifs")
            await c3.fill("#pu-start", __import__("datetime").date.today().isoformat())
            await c3.check("#pu-cgv"); await c3.check("#pu-early")
            async with A.expect_page(timeout=6000) as np:
                await btn(c3, "Commander avec obligation de paiement")
            sp = await np.value
            await sp.wait_for_load_state()
            ok("buy.stripe.com/test_suivi1" in sp.url and "client_reference_id=u_k3__suivi__4__" in sp.url, "page Stripe ouverte dans un nouvel onglet avec la référence", sp.url)
            await sp.close(); await c3.wait_for_timeout(500)
            ok(await has(c3, "Commande en attente de paiement") and await has(c3, "Reprendre le paiement"), "client : commande en attente, paiement reprenable")
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1000)
            ok(await has(co, "Paiement Stripe à vérifier · 99 €"), "coach : paiement à vérifier dans Stripe")
            await co.locator("ul.alerts button", has_text="Paul").first.click(); await co.wait_for_timeout(500)
            await btn(co, "Paiement reçu · activer"); await co.wait_for_timeout(600)
            await shot(co, "coach_commandes")
            plan = await mdb(co, "plans/u_k3")
            ok(plan and plan["status"] == "active" and plan["source"]["kind"] == "coach", "coach : accès activé après vérification du paiement", plan)
            await c3.bring_to_front(); await c3.wait_for_timeout(800)
            ok(await has(c3, "prochaine séance", 6000), "client : programme ouvert après confirmation")
            await c3.get_by_role("button", name="Mon profil").click(); await c3.wait_for_timeout(300)
            ok(await c3.get_by_role("button", name="Renoncer au contrat ici").count() == 1, "version Claude : rétractation en ligne disponible")
            await btn(c3, "Conditions de vente"); await c3.wait_for_timeout(300)
            ok(await has(c3, "Anthropic") or await has(c3, "Droit de rétractation"), "version Claude : documents légaux")
            await b.close()
    finally:
        srv.terminate()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
