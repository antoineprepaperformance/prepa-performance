"""Version Claude : grille du 17 novembre 2026. Lancement en un clic (essai gratuit de 7 jours ESSAI7, code pionniers
PIONNIERS), commande Autonomie avec le code de réduction (prix réduit, « au lieu de », utilisation comptée à l'activation
par le coach), Autonomie sans coach IA (ni bouton, ni messagerie), consigne du Suivi appliquée tout de suite par le coach IA."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8791
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/grille"; os.makedirs(OUT, exist_ok=True)
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
async def mdb_prefix(page, prefix): return await page.evaluate(f"(() => {{ const d = JSON.parse(localStorage.getItem('__mockdb') || '{{}}'); return Object.keys(d).filter((k) => k.startsWith({json.dumps(prefix)})).map((k) => d[k]); }})()")
async def onboard(c, name):
    await btn(c, "Commencer mon inscription")
    await c.fill("#ob-name", name); await c.fill("#ob-by", "1994"); await c.fill("#ob-h", "178"); await c.fill("#ob-w", "76"); await c.fill("#ob-sport", "Fitness")
    await btn(c, "Continuer")
    await c.get_by_role("radio", name="Loisir ou départemental", exact=True).click(); await c.get_by_role("radio", name="6 mois à 2 ans", exact=True).click()
    await btn(c, "Continuer")
    await c.locator("button.pcard", has_text="Remise en forme").click(); await btn(c, "Continuer")
    for i in range(await c.locator(".yn").count()):
        await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    await btn(c, "Continuer"); await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(700)

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)

            # ---------- lancement : essai de 7 jours et code pionniers, en un clic ----------
            await btn(co, "Codes & essais", exact=True)
            lan = co.locator(".card", has_text="Lancement")
            ok(await lan.count() == 1, "carte Lancement dans Codes & essais")
            await lan.get_by_role("button", name="Mettre l'essai en ligne").click(); await co.wait_for_timeout(600)
            e7 = await mdb(co, "codes/ESSAI7") or {}
            st = await mdb(co, "settings/app") or {}
            ok(e7.get("kind") == "essai" and e7.get("offer") == "ia" and e7.get("weeks") == 1 and e7.get("max", 0) >= 1000 and e7.get("active") is True, "essai : code public ESSAI7, Autonomie + coach IA, 1 semaine", e7)
            ok(st.get("essai") == {"on": True, "code": "ESSAI7"}, "essai : annoncé dans les réglages (bouton de la page d'accueil)", st.get("essai"))
            await co.locator(".card", has_text="Lancement").get_by_role("button", name="Créer le code pionniers").click(); await co.wait_for_timeout(600)
            pi = await mdb(co, "codes/PIONNIERS") or {}
            ok(pi.get("kind") == "promo" and pi.get("pct") == 20 and pi.get("max") == 20 and pi.get("expiresMs") and not pi.get("offer"), "code pionniers : −20 %, 20 utilisations, date limite, toutes formules", pi)
            ok(await has(co, "Réduction de 20 % sur une première commande"), "liste des codes : réduction décrite")
            await shot(co, "lancement")
            # code de réduction sur mesure : le formulaire cache formule, durée et programme
            await co.locator(".card", has_text="Créer un code").get_by_role("radio", name="Réduction").click(); await co.wait_for_timeout(200)
            ok(await co.locator("#cd-pct").count() == 1 and await co.locator("#cd-prog").count() == 0, "code de réduction : pourcentage, sans formule ni programme")
            await co.fill("#cd-pct", "15"); await co.fill("#cd-code", "AMIS-23456"); await btn(co, "Créer le code", scope=".card:has-text('Créer un code')"); await co.wait_for_timeout(400)
            am = await mdb(co, "codes/AMIS-23456") or {}
            ok(am.get("kind") == "promo" and am.get("pct") == 15, "code de réduction créé à la main", am)

            # ---------- client : Autonomie 1 mois (code offert ; la commande avec réduction se teste sur le site, e2e_tarifs) ----------
            await co.locator(".card", has_text="Créer un code").get_by_role("radio", name="Offert").click()
            await co.locator(".card", has_text="Créer un code").get_by_role("radio", name="Autonomie", exact=True).click()
            await co.locator(".card", has_text="Créer un code").get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "AUTO-23456"); await btn(co, "Créer le code", scope=".card:has-text('Créer un code')"); await co.wait_for_timeout(400)
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=g1"); await c.wait_for_timeout(700)
            await onboard(c, "Hugo Autonome")
            ok(await c.get_by_role("radio", name="Essentiel").count() == 0 and await c.get_by_role("radio", name="Lite", exact=True).count() == 0, "commande : ni Essentiel ni Lite en vente")
            await c.get_by_role("radio", name="Autonomie", exact=True).first.click(); await c.wait_for_timeout(300)
            await c.get_by_role("radio", name="1 mois", exact=False).first.click(); await c.wait_for_timeout(200)
            ok(await has(c, "Commander avec obligation de paiement · 12,90 €"), "Autonomie 1 mois : 12,90 €, au centime")
            await shot(c, "commande_autonomie", full=True)
            await c.fill("#pu-code", "AUTO-23456"); await btn(c, "Appliquer", exact=True); await c.wait_for_timeout(300)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            plan = await mdb(co, "plans/u_g1") or {}
            ok(plan.get("offer") == "auto" and plan.get("status") == "active", "accès Autonomie actif", plan)

            # ---------- version Claude : un code de réduction envoyé comme un code n'ouvre aucun accès ----------
            e = await A.new_page(); hook(e, "promo"); await e.set_viewport_size({"width": 390, "height": 844})
            await e.goto(URL + "?as=g3"); await e.wait_for_timeout(700)
            await onboard(e, "Paul Promo")
            await e.fill("#pu-code", "PIONNIERS"); await btn(e, "Appliquer", exact=True); await e.wait_for_timeout(300)
            await e.fill("#pu-start", TODAY.isoformat()); await e.check("#pu-cgv"); await btn(e, "Envoyer mon code à Antoine"); await e.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            ok(not (await mdb(co, "plans/u_g3")), "code pionniers envoyé comme un code : aucun accès offert ouvert")
            await e.close()

            # ---------- Autonomie : pas de coach IA, pas de messagerie ----------
            await c.bring_to_front(); await c.goto(URL + "?as=g1"); await c.wait_for_timeout(1200)
            ok(await c.get_by_role("button", name="Coach IA").count() == 0, "Autonomie : pas de bouton coach IA")
            await c.get_by_role("button", name="Mon profil").click(); await c.wait_for_timeout(400)
            await c.get_by_role("button", name="Écrire à Antoine").first.click(); await c.wait_for_timeout(400)
            ok(await has(c, "n'est pas incluse dans la formule Autonomie."), "Autonomie : messagerie fermée")
            st = await c.evaluate("(() => [promoPrice(12.9, 20), promoPrice(849, 20), promoPrice(89, 0), codeState({ kind: 'promo', pct: 20, max: 20, uses: 1, usedBy: { u_g1: 'x' }, active: true }, 'u_g1').ok, codeState({ kind: 'promo', pct: 20, max: 1, uses: 1, usedBy: {}, active: true }, 'u_x').ok])()")
            ok(st == [10.32, 679.2, 89, False, False], "réduction : prix au centime ; une fois par client ; plus valable une fois les utilisations épuisées", st)

            # ---------- Suivi : consigne d'Antoine appliquée tout de suite ----------
            await co.bring_to_front(); await btn(co, "Codes & essais", exact=True)
            await co.locator(".card", has_text="Créer un code").get_by_role("radio", name="Offert").click()
            await co.locator(".card", has_text="Créer un code").get_by_role("radio", name="Suivi", exact=True).click()
            await co.locator(".card", has_text="Créer un code").get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "SUIVI-23456"); await btn(co, "Créer le code", scope=".card:has-text('Créer un code')"); await co.wait_for_timeout(400)
            d = await A.new_page(); hook(d, "suivi"); await d.set_viewport_size({"width": 390, "height": 844})
            await d.goto(URL + "?as=g2"); await d.wait_for_timeout(700)
            await onboard(d, "Sarah Suivi")
            await d.fill("#pu-code", "SUIVI-23456"); await btn(d, "Appliquer", exact=True); await d.wait_for_timeout(300)
            await d.fill("#pu-start", TODAY.isoformat()); await d.check("#pu-cgv"); await btn(d, "Envoyer mon code à Antoine"); await d.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            p2 = await mdb(co, "plans/u_g2") or {}
            ok(p2.get("offer") == "suivi2" and p2.get("status") == "active", "accès Suivi actif", p2)
            await btn(co, "Clients", exact=True); await co.wait_for_timeout(400)
            await co.locator("table.ctable tbody tr", has_text="Sarah").click(); await co.wait_for_timeout(600)
            await co.get_by_role("radio", name="Coach IA", exact=True).click(); await co.wait_for_timeout(500)
            ok(await has(co, "Ta consigne pour ce client"), "fiche : consigne pour le coach IA")
            await co.fill("#ai-note", "Moins de volume jambes cette semaine : genou sensible.")
            n0 = len(await co.evaluate("window.__prompts || []"))
            await btn(co, "Appliquer maintenant"); await co.wait_for_timeout(1500)
            prs = await co.evaluate("window.__prompts || []")
            last = prs[-1] if len(prs) > n0 else {}
            ok("Tâche : consigne_coach" in (last.get("all") or "") and "genou sensible" in (last.get("all") or "") and "remplacer_exercice" in (last.get("tools") or []), "Appliquer maintenant : le coach IA reçoit la consigne et ses outils", {k: (v if k != "all" else v[-300:]) for k, v in last.items()} if last else None)
            p2 = await mdb(co, "plans/u_g2") or {}
            ok(p2.get("aiNote") == "Moins de volume jambes cette semaine : genou sensible.", "consigne enregistrée dans le plan", p2.get("aiNote"))
            ok(await has(co, "Consigne appliquée"), "compte rendu du coach IA affiché")
            await shot(co, "consigne_appliquee", full=True)

            # ---------- conditions de vente ----------
            await c.bring_to_front(); await c.goto(URL + "?as=g1"); await c.wait_for_timeout(1000)
            await btn(c, "Mon profil"); await c.wait_for_timeout(300)
            link = c.get_by_role("button", name="Conditions de vente")
            if await link.count(): await link.first.click(); await c.wait_for_timeout(400)
            t = await c.inner_text("body")
            ok("Version du 17 novembre 2026" in t or "17 novembre 2026" in t, "CGV : nouvelle version")
            ok("6. Codes d'essai, codes offerts et codes de réduction" in t and "L'essai gratuit de 7 jours" in t, "CGV : essai et codes de réduction décrits")
            ok("Autonomie (tous les programmes" in t and "Lite et Lite + Nutrition) gardent jusqu'à leur terme" in t, "CGV : Autonomie décrite, formules retirées protégées")
            await b.close()
    finally:
        srv.terminate()

asyncio.run(run())
print(f"\n{len(oks)} OK, {len(fails)} échecs")
for e in errs[:12]: print("  console:", e)
sys.exit(1 if fails or any("pageerror" in e for e in errs) else 0)
