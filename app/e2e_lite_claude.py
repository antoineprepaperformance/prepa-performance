"""Version Claude : forfait Lite (lien Stripe dans un nouvel onglet, activation par le coach), coach IA absent,
prolongation manuelle, programme suivant choisi par le client et appliqué par l'espace coach, résiliation."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8769
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/lite_claude"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
TODAY = datetime.date.today()
DAY = 86400000
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:500]))
async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)
async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def mset(page, path, patch): await page.evaluate(f"(() => {{ const s = JSON.parse(localStorage.getItem('__mockdb') || '{{}}'); s[{json.dumps(path)}] = {{ ...s[{json.dumps(path)}], ...{json.dumps(patch)} }}; localStorage.setItem('__mockdb', JSON.stringify(s)); }})()")
async def onboard(page, name, sport, compet, xp, prog):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-sport", sport); await page.fill("#ob-by", "1995")
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
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="light", accept_downloads=True)
            await A.route("https://buy.stripe.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<h1>Stripe (simulé)</h1>"))
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)
            await btn(co, "Offres & réglages", exact=True)
            ok(await co.locator("#pay-relay").count() == 0, "version Claude : pas d'adresse de relais")
            await co.fill("#lt-m", "12"); await co.fill("#pl-lite-mois_abo", "https://buy.stripe.com/test_lite_mois_abo")
            await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(400)
            st = await mdb(co, "settings/app")
            ok(st and st["lite"]["mois"] == 12 and st["pay"]["links"]["lite_mois_abo"].endswith("mois_abo"), "prix Lite modifiable (12 € / mois)", st and st.get("lite"))
            # client : Lite mensuel en abonnement
            c1 = await A.new_page(); hook(c1, "c1"); await c1.set_viewport_size({"width": 390, "height": 844})
            await c1.goto(URL + "?as=lite1"); await c1.wait_for_timeout(700)
            await onboard(c1, "Lina Lite", "Fitness", "Loisir ou départemental", "6 mois à 2 ans", "Remise en forme")
            await c1.get_by_role("radio", name="Lite", exact=True).click()
            ok(await has(c1, "S'abonner avec obligation de paiement · 12 € / mois"), "prix réglé par le coach affiché (12 € / mois)")
            await c1.check("#pu-cgv"); await c1.check("#pu-early")
            async with A.expect_page(timeout=6000) as np:
                await btn(c1, "S'abonner avec obligation de paiement")
            sp = await np.value; await sp.wait_for_load_state()
            ok("test_lite_mois_abo" in sp.url and "client_reference_id=u_lite1__lite__mois-abo__" in sp.url, "Stripe ouvert dans un nouvel onglet (référence mois-abo)", sp.url)
            await sp.close()
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1000)
            ok(await has(co, "Paiement Stripe à vérifier · 12 €"), "coach : paiement Lite à vérifier")
            await co.locator("ul.alerts button", has_text="Lina").first.click(); await co.wait_for_timeout(500)
            await btn(co, "Paiement reçu · activer"); await co.wait_for_timeout(700)
            plan = await mdb(co, "plans/u_lite1")
            ok(plan and plan["offer"] == "lite" and plan["lite"]["mode"] == "abo" and 28 <= (plan["untilMs"] - plan["startMs"]) / DAY <= 31.1, "coach : accès Lite d'un mois activé", plan)
            ok(await has(co, "Lite jusqu'au"), "coach : statut « Lite jusqu'au »")
            await c1.bring_to_front(); await c1.wait_for_timeout(1000)
            ok(await has(c1, "prochaine séance", 6000) and await has(c1, "Formule Lite · accès jusqu'au"), "client : programme ouvert, date de fin d'accès")
            ok(await c1.locator(".tab-ia").count() == 0, "Lite : pas de coach IA dans la barre")
            await c1.get_by_role("button", name="Bilan").last.click(); await c1.wait_for_timeout(300)
            ok(await has(c1, "ils ne reçoivent pas de réponse personnelle"), "bilans Lite : pas de réponse personnelle annoncée")
            await shot(c1, "lite_bilan")
            # prolongation manuelle par le coach
            await co.bring_to_front(); await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
            u0 = plan["untilMs"]
            await btn(co, "Prolonger d'un mois"); await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(600)
            plan = await mdb(co, "plans/u_lite1")
            ok(28 <= (plan["untilMs"] - u0) / DAY <= 31.1 and plan["lite"]["mode"] == "abo", "coach : prolongation d'un mois")
            await shot(co, "coach_plan_lite")
            # programme fini : le client choisit la suite, l'espace coach l'applique
            await mset(co, "plans/u_lite1", {"start": (TODAY - datetime.timedelta(weeks=13)).isoformat()})
            await c1.bring_to_front(); await c1.reload(); await c1.wait_for_timeout(1200)
            ok(await has(c1, "Choisir mon prochain programme"), "client : choix du programme suivant")
            await c1.select_option("#nc-prog", "force"); await btn(c1, "Démarrer ce programme"); await c1.wait_for_timeout(800)
            prof = await mdb(c1, "clients/u_lite1")
            pl_now = await mdb(c1, "plans/u_lite1")
            ok(((prof.get("nextCycle") or {}).get("programId") == "force" or pl_now["programId"] == "force"), "version Claude : choix envoyé au coach (appliqué dès que son espace est ouvert)", prof and prof.get("nextCycle"))
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1800)
            plan2 = await mdb(co, "plans/u_lite1")
            ok(plan2["programId"] == "force" and plan2["cycle"] == plan["cycle"] + 1 and plan2["untilMs"] == plan["untilMs"], "espace coach : programme suivant appliqué, accès inchangé", [plan2["programId"], plan2["cycle"]])
            await c1.bring_to_front(); await c1.reload(); await c1.wait_for_timeout(1200)
            ok(await has(c1, "Semaine 1 sur 12", 5000) or await has(c1, "commence dans", 1000), "client : nouveau programme affiché")
            # résiliation
            await c1.get_by_role("button", name="Mon profil").click(); await c1.wait_for_timeout(300)
            await btn(c1, "Résilier mon abonnement")
            ok(await c1.get_by_role("button", name="Continuer", exact=True).is_disabled(), "résiliation : e-mail demandé pour l'accusé de réception")
            await c1.fill("#rs-e", "lina@test.fr"); await btn(c1, "Continuer", exact=True)
            await btn(c1, "Confirmer la résiliation"); await c1.wait_for_timeout(800)
            ack = await c1.evaluate("(async () => { const d = window.__lastDownload; return d ? (d.filename + '\\n' + await d.data.text()) : ''; })()")
            ok("ACCUSÉ DE RÉCEPTION DE RÉSILIATION" in ack, "version Claude : accusé de résiliation téléchargé")
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1000)
            ok(await has(co, "Résiliation : arrêter l'abonnement dans Stripe"), "coach : résiliation à reporter dans Stripe")
            await b.close()
    finally:
        srv.terminate()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
