"""Site : grille 2026 — formules sur 1, 3, 6 et 12 mois, accès daté (achat de 12 mois, prolongation, passage de 1 à 6 mois),
Sur mesure (places, code offert, programme à écrire), Lite + Nutrition (lien, activation, nutrition ouverte ; Lite simple : nutrition
fermée), limites vidéo, quotas IA et fraudes refusées par les règles."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, urllib.parse, urllib.request
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/tarifs"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
TODAY = datetime.date.today()
DAY = 86400000

def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text and "Activation du paiement" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:700]))
async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False, nth=0):
    await page.get_by_role("button", name=text, exact=exact).nth(nth).click(); await page.wait_for_timeout(250)
async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
def emu(path, method="GET"):
    req = urllib.request.Request(EMU + path, method=method, headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        b = r.read(); return json.loads(b) if b else {}
async def ev(page, js): return await page.evaluate(js)
async def db(page, path): return await page.evaluate(f"window.__fakefs.load()[{json.dumps(path)}]")
async def signup(page, email):
    await page.goto(URL)
    await btn(page, "Créer mon compte", exact=True)
    await page.fill("#au-e", email); await page.fill("#au-p", PW)
    await page.locator(".modal").get_by_role("button", name="Créer mon compte").click()
    await page.wait_for_timeout(1200)
async def onboard(page, name, sport, compet, xp, prog, by="1994"):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-h", "178"); await page.fill("#ob-w", "75"); await page.fill("#ob-sport", sport); await page.fill("#ob-by", by)
    await btn(page, "Continuer")
    await page.get_by_role("radio", name=compet, exact=True).click(); await page.get_by_role("radio", name=xp, exact=True).click()
    await btn(page, "Continuer")
    await page.locator("button.pcard", has_text=prog).click(); await btn(page, "Continuer")
    for i in range(await page.locator(".yn").count()):
        await page.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    await btn(page, "Continuer")
    await page.check("#ob-consent")
    await btn(page, "Continuer vers mon accès"); await page.wait_for_timeout(800)
async def uid_of(page): return await page.evaluate("firebase.auth().currentUser.uid")
def iso(d): return d.isoformat()
def now_iso(): return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

async def checkout(page, stripe_urls, label="Commander avec obligation de paiement"):
    await page.check("#pu-cgv")
    if await page.locator("#pu-early").count(): await page.check("#pu-early")
    async with page.expect_navigation(url="**buy.stripe.com**", timeout=8000):
        await page.get_by_role("button", name=label).first.click()
    q = urllib.parse.parse_qs(urllib.parse.urlparse(stripe_urls[-1]).query)
    return q.get("client_reference_id", [""])[0].split("__"), stripe_urls[-1]

async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark", accept_downloads=True)
        stripe_urls = []
        async def stripe_route(route):
            stripe_urls.append(route.request.url)
            await route.fulfill(status=200, content_type="text/html", body="<html><body><h1>Stripe (simulé)</h1></body></html>")
        await A.route("https://buy.stripe.com/**", stripe_route)
        await A.add_init_script("window.__RELAY_UID = 'relais-test';")
        relay_pay = lambda pg, pid, d: ev(pg, f"window.__fakefs.relayCreate('payments/{pid}', {json.dumps(d)})")

        # ---------- coach : grille 1, 3, 6, 12 mois, liens Stripe, Lite + Nutrition, places Sur mesure ----------
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse")
        ok(await has(co, "Bonjour", 8000), "coach connecté")
        await btn(co, "Offres & réglages", exact=True)
        grid = {k: await co.input_value("#pr-" + k) for k in ["ia0", "ia3", "essentiel0", "essentiel3", "suivi1", "suivi2", "surmesure0", "surmesure3"]}
        ok(grid == {"ia0": "29", "ia3": "279", "essentiel0": "59", "essentiel3": "569", "suivi1": "319", "suivi2": "599", "surmesure0": "199", "surmesure3": "1899"}, "grille par défaut : 4 formules × 1, 3, 6, 12 mois", grid)
        ok(await co.locator("#pl-surmesure52").count() == 1 and await co.locator("#pl-essentiel8").count() == 0, "liens Stripe : 16 liens (plus de lien 2 mois)")
        ok(await co.input_value("#lt-nm") == "14.9" and await co.input_value("#lt-na") == "129", "Lite + Nutrition : 14,90 € / mois, 129 € / an par défaut")
        await co.get_by_role("radio", name="Automatique (relais installé)").click()
        links = {"essentiel52": "test_ess52", "essentiel4": "test_ess4", "suivi4": "test_suivi4", "suivi26": "test_suivi26", "surmesure4": "test_sm4"}
        for k, v in links.items(): await co.fill("#pl-" + k, "https://buy.stripe.com/" + v)
        await co.fill("#pl-lite-mois_avance", "https://buy.stripe.com/test_lite_mois_avance")
        await co.fill("#pl-liten-mois_avance", "https://buy.stripe.com/test_liten_mois_avance")
        await co.fill("#sm-places", "3")
        await co.fill("#pr-suivi0", "125")
        for k, v in [("siret", "123 456 789 00012"), ("adresse", "12 rue du Stade, 33270 Floirac"), ("email", "contact@antoine-prepa.fr"), ("telephone", "06 12 34 56 78"),
                     ("cartePro", "03312ED0123"), ("assurance", "Assureur Test, contrat 123"), ("mediateur", "Médiateur Test, 1 rue de Paris")]:
            await co.fill("#lg-" + k, v)
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(600)
        st = await db(co, "settings/app")
        ok(st and st["tarifs"]["essentiel"]["52"] == 569 and st["tarifs"]["suivi"]["4"] == 125 and st["surmesure"] == {"on": True, "places": 3} and st["lite"]["nmois"] == 14.9 and st["pay"]["links"]["lite_mois_avance_n"].endswith("test_liten_mois_avance") and "offers" not in st,
           "réglages : grille « tarifs », places Sur mesure, prix et lien Lite + Nutrition", st and [st.get("tarifs"), st.get("surmesure"), st.get("lite")])
        await co.fill("#pr-suivi0", "119"); await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(500)
        await shot(co, "coach_grille")
        # code offert : Sur mesure 6 mois
        await btn(co, "Codes & essais", exact=True)
        await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Sur mesure", exact=True).click(); await co.get_by_role("radio", name="6 mois").click()
        await co.fill("#cd-code", "SURMESURE-6M234"); await btn(co, "Créer le code"); await co.wait_for_timeout(400)
        ok(await has(co, "Offert · Sur mesure · 6 mois"), "code Sur mesure 6 mois créé")
        await co.get_by_role("radio", name="Lite", exact=True).click(); await co.get_by_role("radio", name="Lite + Nutrition").click(); await co.get_by_role("radio", name="1 mois").click()
        await co.fill("#cd-code", "LITEN-1M2345"); await btn(co, "Créer le code"); await co.wait_for_timeout(400)
        cd = await db(co, "codes/LITEN-1M2345")
        ok(cd and cd["nutri"] is True and cd["offer"] == "lite" and await has(co, "Offert · Lite + Nutrition · 1 mois"), "code Lite + Nutrition créé", cd)

        # ---------- page d'accueil ----------
        V = await b.new_context(viewport={"width": 390, "height": 844}); await V.add_init_script("window.__RELAY_UID = 'relais-test';")
        vis = await V.new_page(); hook(vis, "visiteur")
        await vis.goto(URL); await vis.wait_for_timeout(800)
        # même base côté serveur : les réglages du coach (autre navigateur) arrivent sur la page d'accueil
        await ev(vis, "(d => { const s = window.__fakefs.load(); s['settings/app'] = d; window.__fakefs.save(s); })(" + json.dumps(await db(co, "settings/app")) + ")")
        await vis.reload(); await vis.wait_for_timeout(1500)
        ok(await has(vis, "3 places seulement") and await has(vis, "soit 47 €/mois") and await has(vis, "Recommandé") and await has(vis, "+ Nutrition · par mois"), "accueil : places Sur mesure, prix mensuel des 12 mois, Lite + Nutrition")
        await vis.locator(".l-offers").scroll_into_view_if_needed(); await shot(vis, "accueil_formules")
        await vis.goto(URL + "?v=2#cgv"); await vis.wait_for_timeout(1500)
        ok(await has(vis, "7 ter. Blessure ou contre-indication médicale") and await has(vis, "Sur mesure (Suivi, plus un programme écrit par"), "CGV : clause blessure des 6 et 12 mois, contenu de chaque formule")

        # ---------- client E : Essentiel 12 mois ----------
        ce = await A.new_page(); hook(ce, "E"); await ce.set_viewport_size({"width": 390, "height": 844})
        await signup(ce, "emma@test.fr"); await onboard(ce, "Emma Annee", "Handball", "Régional", "6 mois à 2 ans", "Prépa sports collectifs")
        uE = await uid_of(ce)
        await ce.get_by_role("radio", name="Essentiel", exact=True).click(); await ce.get_by_role("radio", name="12 mois").click(); await ce.wait_for_timeout(200)
        ok(await has(ce, "Soit 47 € par mois, payés en une fois") and await has(ce, "Fin de l'accès") and await has(ce, "En cas de blessure ou de contre-indication médicale"), "commande 12 mois : prix mensuel, date de fin et clause blessure")
        await ce.fill("#pu-start", iso(TODAY))
        await shot(ce, "commande_12mois")
        ref, url = await checkout(ce, stripe_urls)
        ok(ref[0] == uE and ref[1] == "essentiel" and ref[2] == "52" and "test_ess52" in url, "Stripe : lien Essentiel 12 mois, référence 52 semaines", ref)
        oE = ref[3]
        await relay_pay(co, "cs_E1", {"uid": uE, "offer": "essentiel", "weeks": 52, "orderId": oE, "amount": 56900, "expected": 56900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await ce.goto(URL + "?paiement=ok&session_id=cs_E1")
        ok(await has(ce, "prochaine séance", 10000), "paiement : accès de 12 mois activé")
        pE = await db(ce, f"plans/{uE}")
        span = pE and (pE["untilMs"] - pE["startMs"]) / DAY
        ok(pE and pE["offer"] == "essentiel" and pE["weeks"] == 12 and pE["grantWeeks"] == 52 and 364.9 <= span <= 366.1 and pE["start"] == iso(TODAY) and "lite" not in pE, "plan daté : programme de 12 semaines, accès d'un an", pE)
        ok(await has(ce, "accès jusqu'au"), "aujourd'hui : fin de l'accès affichée")
        fraud = await ev(ce, """(async () => { const db = firebase.firestore(); const me = firebase.auth().currentUser.uid; const r = {};
          const t = async (k, f) => { try { await f(); r[k] = 'ok'; } catch (e) { r[k] = e.code; } };
          const pl = (await db.doc('plans/' + me).get()).data();
          await t('allonger_acces', () => db.doc('plans/' + me).update({ untilMs: pl.untilMs + 365 * 86400000 }));
          await t('passer_en_sur_mesure', () => db.doc('plans/' + me).update({ offer: 'surmesure' }));
          await t('reutiliser_paiement', async () => { const b = db.batch(); b.update(db.doc('payments/cs_E1'), { used: true, usedAt: 'x' }); b.set(db.doc('plans/' + me), { ...pl, untilMs: pl.untilMs + 300 * 86400000 }); await b.commit(); });
          return r; })()""")
        ok(fraud == {"allonger_acces": "permission-denied", "passer_en_sur_mesure": "permission-denied", "reutiliser_paiement": "permission-denied"}, "règles : accès daté non modifiable, paiement non réutilisable", fraud)
        # paiement d'un mois transformé en accès d'un an : refusé
        await relay_pay(co, "cs_E_triche", {"uid": uE, "offer": "essentiel", "weeks": 4, "orderId": "otriche1", "amount": 5900, "expected": 5900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        trick = await ev(ce, """(async () => { const db = firebase.firestore(); const me = firebase.auth().currentUser.uid;
          const pl = (await db.doc('plans/' + me).get()).data();
          try { const b = db.batch(); b.update(db.doc('payments/cs_E_triche'), { used: true, usedAt: 'x' });
            b.set(db.doc('plans/' + me), { ...pl, untilMs: pl.untilMs + 200 * 86400000, grantWeeks: 4, source: { kind: 'paiement', id: 'cs_E_triche', orderId: 'otriche1' } }); await b.commit(); return 'ok'; }
          catch (e) { return e.code; } })()""")
        await ce.wait_for_timeout(2500)
        pE2 = await db(ce, f"plans/{uE}")
        add = pE2 and (pE2["untilMs"] - pE["untilMs"]) / DAY
        ok(trick == "permission-denied", "règles : 1 mois payé ne donne pas 200 jours", trick)
        ok(pE2 and 27.9 <= add <= 31.1 and pE2["startMs"] == pE["startMs"] and pE2["programId"] == pE["programId"] and pE2["cycle"] == pE["cycle"], "paiement d'un mois sans commande : l'accès daté est prolongé d'un mois, programme inchangé", [add, pE2 and pE2.get("source")])
        vc = await ev(ce, """[videoCoachOk({}, { offer: 'essentiel' }), videoCoachOk({ video: { coach: 'toutes' } }, { offer: 'essentiel' }), videoCoachOk({}, { offer: 'surmesure' }), videoCoachOk({}, { offer: 'ia', status: 'active' }),
          videoWeekMax({ offer: 'suivi' }), videoWeekMax({ offer: 'surmesure' }), videoWeekSent({ videos: { a: { toCoach: true, at: new Date().toISOString() }, b: { toCoach: true, at: new Date(Date.now() - 8 * 86400000).toISOString() }, c: { toCoach: false, at: new Date().toISOString() } } }).length,
          aiQuota({}, 'surmesure').q, aiQuota({}, 'surmesure').ph]""")
        ok(vc == [False, True, True, False, 1, 2, 1, 30, 8], "vidéo : Suivi et Sur mesure (Essentiel si ouvert), 1 puis 2 par semaine glissante ; IA Sur mesure 30 questions et 8 photos", vc)

        # ---------- client S : Suivi 1 mois puis passage à 6 mois (programme conservé) ----------
        cs = await A.new_page(); hook(cs, "S"); await cs.set_viewport_size({"width": 390, "height": 844})
        await signup(cs, "sacha@test.fr"); await onboard(cs, "Sacha Suivi", "Rugby", "Régional", "6 mois à 2 ans", "Prépa sports collectifs")
        uS = await uid_of(cs)
        await cs.get_by_role("radio", name="Suivi", exact=True).click(); await cs.get_by_role("radio", name="1 mois").click()
        ok(await has(cs, "Commander avec obligation de paiement · 119 €"), "Suivi 1 mois : 119 €")
        await cs.fill("#pu-start", iso(TODAY))
        ref, url = await checkout(cs, stripe_urls)
        ok(ref[1] == "suivi" and ref[2] == "4" and "test_suivi4" in url, "Stripe : Suivi 1 mois", ref)
        await relay_pay(co, "cs_S1", {"uid": uS, "offer": "suivi", "weeks": 4, "orderId": ref[3], "amount": 11900, "expected": 11900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cs.goto(URL + "?paiement=ok&session_id=cs_S1")
        ok(await has(cs, "prochaine séance", 10000), "Suivi 1 mois activé")
        pS = await db(cs, f"plans/{uS}")
        ok(pS and pS["weeks"] == 4 and "untilMs" not in pS, "plan court : 4 semaines, sans accès daté", pS)
        # le coach avance le début de 3 semaines : la fin approche, le client prolonge
        await co.bring_to_front(); await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Sacha").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
        await co.fill("#pe-start", iso(TODAY - datetime.timedelta(days=21)))
        await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(700)
        await cs.bring_to_front(); await cs.reload(); await cs.wait_for_timeout(1500)
        ok(await has(cs, "Ton accès se termine le"), "client : fin d'accès annoncée")
        await cs.locator(".alert", has_text="Ton accès se termine le").get_by_role("button", name="Prolonger").click(); await cs.wait_for_timeout(500)
        await cs.get_by_role("radio", name="6 mois").click(); await cs.wait_for_timeout(200)
        ok(await has(cs, "Continuer mon programme en cours") and await has(cs, "Fin de l'accès"), "passage à 6 mois : le programme continue, date de fin affichée")
        await shot(cs, "passage_6mois")
        ref, url = await checkout(cs, stripe_urls)
        ok(ref[2] == "26" and "test_suivi26" in url, "Stripe : Suivi 6 mois", ref)
        od = await db(co, f"clients/{uS}/orders/{ref[3]}")
        ok(od and od["ext"] is True and od["weeks"] == 26, "commande de prolongation enregistrée", od)
        await relay_pay(co, "cs_S2", {"uid": uS, "offer": "suivi", "weeks": 26, "orderId": ref[3], "amount": 59900, "expected": 59900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cs.goto(URL + "?paiement=ok&session_id=cs_S2"); await cs.wait_for_timeout(2500)
        pS2 = await db(cs, f"plans/{uS}")
        endShort = datetime.datetime.combine(TODAY + datetime.timedelta(days=7), datetime.time()).timestamp() * 1000
        months = pS2 and (pS2["untilMs"] - endShort) / DAY
        ok(pS2 and pS2["start"] == iso(TODAY - datetime.timedelta(days=21)) and pS2["programId"] == pS["programId"] and pS2["weeks"] == 12 and pS2["grantWeeks"] == 26 and pS2["cycle"] == pS["cycle"] and 180 <= months <= 185,
           "plan converti : même programme et même début, accès de 6 mois après la fin du mois payé", [pS2 and {k: pS2.get(k) for k in ["start", "weeks", "grantWeeks", "cycle"]}, months])
        ok(await has(cs, "accès jusqu'au"), "client : accès daté affiché")

        # ---------- client M : Sur mesure 6 mois offert par code ----------
        cm = await A.new_page(); hook(cm, "M"); await cm.set_viewport_size({"width": 390, "height": 844})
        await signup(cm, "mael@test.fr"); await onboard(cm, "Mael Mesure", "Football", "National", "Plus de 2 ans", "Prépa sports collectifs")
        uM = await uid_of(cm)
        await cm.fill("#pu-code", "SURMESURE-6M234"); await btn(cm, "Appliquer", exact=True); await cm.wait_for_timeout(600)
        await cm.check("#pu-cgv"); await btn(cm, "Activer mon accès offert"); await cm.wait_for_timeout(1800)
        pM = await db(cm, f"plans/{uM}")
        spanM = pM and (pM["untilMs"] - pM["startMs"]) / DAY
        ok(pM and pM["offer"] == "surmesure" and pM["grantWeeks"] == 26 and pM["source"]["kind"] == "code" and 180 <= spanM <= 185, "code Sur mesure 6 mois : accès daté de 6 mois", pM)
        await co.bring_to_front(); await btn(co, "Tableau de bord", exact=True)
        ok(await has(co, "Sur mesure : programme du cycle 1 à écrire", 6000), "coach : programme Sur mesure à écrire")
        await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Mael").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
        ok(await co.locator("#pe-until").count() == 1, "coach : date de fin de l'accès modifiable")
        await co.check("#pe-custom"); await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(700)
        pM2 = await db(co, f"plans/{uM}")
        ok(pM2["customCycle"] == pM2.get("cycle", 1) and pM2["untilMs"] == pM["untilMs"] and pM2["grantWeeks"] == 26, "coach : programme Sur mesure noté, accès inchangé", pM2)
        await btn(co, "Tableau de bord", exact=True)
        ok(not await has(co, "Sur mesure : programme du cycle 1 à écrire", 1500), "alerte Sur mesure levée")
        await shot(co, "coach_tableau")

        # ---------- client N : Lite + Nutrition ; client L : Lite simple ----------
        cn = await A.new_page(); hook(cn, "N"); await cn.set_viewport_size({"width": 390, "height": 844})
        await signup(cn, "nina@test.fr"); await onboard(cn, "Nina Nutri", "Fitness", "Loisir ou départemental", "6 mois à 2 ans", "Remise en forme")
        uN = await uid_of(cn)
        await cn.get_by_role("radio", name="Lite", exact=True).click(); await cn.wait_for_timeout(200)
        await cn.get_by_role("radio", name="Lite + Nutrition").click(); await cn.get_by_role("radio", name="Paiement d'avance (sans renouvellement)").click()
        ok(await has(cn, "Lite + la nutrition : objectif calculé") and await has(cn, "Commander avec obligation de paiement · 14,90 €"), "Lite + Nutrition : contenu et prix")
        await cn.fill("#pu-start", iso(TODAY))
        ref, url = await checkout(cn, stripe_urls)
        ok(ref[1] == "lite" and ref[2] == "mois-avance-n" and "test_liten_mois_avance" in url, "Stripe : lien Lite + Nutrition, référence mois-avance-n", ref)
        await relay_pay(co, "cs_N1", {"uid": uN, "offer": "lite", "period": "mois", "mode": "avance", "nutri": True, "sub": "", "weeks": 0, "orderId": ref[3], "amount": 1490, "expected": 1490, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cn.goto(URL + "?paiement=ok&session_id=cs_N1"); await cn.wait_for_timeout(2500)
        pN = await db(cn, f"plans/{uN}")
        ok(pN and pN["offer"] == "lite" and pN["lite"]["nutri"] is True, "Lite + Nutrition activé", pN and pN.get("lite"))
        await cn.get_by_role("button", name="Nutrition").first.click(); await cn.wait_for_timeout(500)
        ok(await has(cn, "Fixe ton objectif en 1 minute") and not await has(cn, "La nutrition est incluse dans le Lite + Nutrition", 800), "Lite + Nutrition : onglet nutrition ouvert")

        cl = await A.new_page(); hook(cl, "L"); await cl.set_viewport_size({"width": 390, "height": 844})
        await signup(cl, "lou@test.fr"); await onboard(cl, "Lou Lite", "Fitness", "Loisir ou départemental", "6 mois à 2 ans", "Remise en forme")
        uL = await uid_of(cl)
        await cl.get_by_role("radio", name="Lite", exact=True).click(); await cl.wait_for_timeout(200)
        await cl.get_by_role("radio", name="Paiement d'avance (sans renouvellement)").click()
        ok(await has(cl, "Sans nutrition, sans réponse d'Antoine") and await has(cl, "Commander avec obligation de paiement · 9,90 €"), "Lite simple : sans nutrition, 9,90 €")
        await cl.fill("#pu-start", iso(TODAY))
        ref, url = await checkout(cl, stripe_urls)
        ok(ref[2] == "mois-avance" and "test_lite_mois_avance" in url, "Stripe : Lite simple", ref)
        await relay_pay(co, "cs_L1", {"uid": uL, "offer": "lite", "period": "mois", "mode": "avance", "sub": "", "weeks": 0, "orderId": ref[3], "amount": 990, "expected": 990, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cl.goto(URL + "?paiement=ok&session_id=cs_L1"); await cl.wait_for_timeout(2500)
        pL = await db(cl, f"plans/{uL}")
        ok(pL and pL["offer"] == "lite" and pL["lite"].get("nutri") is False, "Lite simple activé (sans l'option)", pL and pL.get("lite"))
        # paiement du Lite simple réclamé avec la nutrition : refusé par les règles (évalué sans écrire)
        forged = await ev(cl, """(() => { const me = firebase.auth().currentUser.uid; const B = window.__fakefs.load(); const s = Date.now(); const prev = B['plans/' + me];
          B['payments/cs_L0'] = { uid: me, offer: 'lite', period: 'mois', mode: 'avance', sub: '', weeks: 0, orderId: 'oautreL', amount: 990, expected: 990, currency: 'eur', ok: true, used: false, at: 'x' };
          const A = JSON.parse(JSON.stringify(B)); A['payments/cs_L0'] = { ...B['payments/cs_L0'], used: true, usedAt: 'x' };
          const pl = { programId: prev.programId, offer: 'lite', weeks: 12, start: new Date().toISOString().slice(0, 10), startMs: s, untilMs: s + 30 * 86400000, until: '2099-01-01', lite: { mode: 'avance', period: 'mois', sub: null, nutri: true },
            equipment: 'salle', status: 'active', niveau: 'sportif', cycle: (prev.cycle || 1) + 1, grantWeeks: 0, validatedAt: new Date().toISOString(), source: { kind: 'paiement', id: 'cs_L0', orderId: 'oautreL' } };
          A['plans/' + me] = pl; const avec = window.__fakefs.allowed('write', 'plans/' + me, pl, true, B, A);
          const pl2 = { ...pl, lite: { ...pl.lite, nutri: false } }; A['plans/' + me] = pl2; const sans = window.__fakefs.allowed('write', 'plans/' + me, pl2, true, B, A);
          const pl3 = { ...pl2, validatedAt: '2026-01-01T00:00:00.000Z' }; A['plans/' + me] = pl3; const antidate = window.__fakefs.allowed('write', 'plans/' + me, pl3, true, B, A);
          return [avec, sans, antidate]; })()""")
        ok(forged == [False, True, False], "règles : Lite payé sans l'option ne s'active pas avec la nutrition ni antidaté", forged)
        await cl.get_by_role("button", name="Nutrition").first.click(); await cl.wait_for_timeout(500)
        ok(await has(cl, "La nutrition est incluse dans le Lite + Nutrition") and await has(cl, "Pour 5 € de plus par mois") and await has(cl, "Passer au Lite + Nutrition"), "Lite simple : nutrition présentée, pas ouverte")
        ok(await has(cl, "Hydratation"), "Lite simple : suivi de l'eau conservé")
        await shot(cl, "lite_sans_nutrition")
        fr = await ev(cl, """(async () => { const db = firebase.firestore(); const me = firebase.auth().currentUser.uid; const r = {};
          const t = async (k, f) => { try { await f(); r[k] = 'ok'; } catch (e) { r[k] = e.code; } };
          await t('activer_nutrition', () => db.doc('plans/' + me).update({ 'lite.nutri': true }));
          await t('antidater', () => db.doc('plans/' + me).update({ validatedAt: '2025-01-01T00:00:00.000Z' }));
          return r; })()""")
        ok(fr == {"activer_nutrition": "permission-denied", "antidater": "permission-denied"}, "règles : option nutrition et date d'accès non modifiables par le client", fr)
        await btn(cl, "Passer au Lite + Nutrition"); await cl.wait_for_timeout(400)
        await cl.locator(".modal").get_by_role("radio", name="Lite + Nutrition").click(); await cl.wait_for_timeout(200)
        ok(await has(cl, "Ton accès Lite actuel court jusqu'au") and await has(cl, "il ajoute l'option au prorata"), "passage au Lite + Nutrition : le client sait que son accès en cours est remplacé")
        await shot(cl, "passage_lite_nutrition")
        old = await ev(cl, "[nutriOk({ offer: 'lite', lite: {}, validatedAt: '2026-09-01T10:00:00Z' }), nutriOk({ offer: 'lite', lite: {}, validatedAt: new Date().toISOString() }), nutriOk({ offer: 'suivi' })]")
        ok(old == [True, False, True], "Lite d'avant la nouvelle grille : nutrition conservée", old)

        st = [await ev(pg, "window.__fsStats.errors") for pg in [co, ce, cs, cm, cn, cl]]
        ok(not any(st), "aucune erreur de base de données", st)
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
