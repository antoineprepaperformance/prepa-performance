"""Site : forfait Lite — abonnement mensuel et annuel (relais simulé), renouvellement, résiliation (in-app et publique),
information avant reconduction (L215-1), paiement d'avance, code Lite, programme suivant choisi par le client, fin d'accès, fraudes."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, urllib.parse, urllib.request
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/lite"
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
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:600]))
async def shot(page, name, full=True):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False, nth=0, scope=None):
    root = page.locator(scope) if scope else page
    await root.get_by_role("button", name=text, exact=exact).nth(nth).click(); await page.wait_for_timeout(250)
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

async def lite_checkout(page, stripe_urls, per, mode, start=None, early=True):
    await page.get_by_role("radio", name="Lite", exact=True).click(); await page.wait_for_timeout(200)
    await page.get_by_role("radio", name="Mensuel · 9,90 €" if per == "mois" else "Annuel · 89 € (−25 %)").click()
    await page.get_by_role("radio", name="Abonnement (renouvellement automatique)" if mode == "abo" else "Paiement d'avance (sans renouvellement)").click()
    if start: await page.fill("#pu-start", start)
    await page.check("#pu-cgv")
    if early and await page.locator("#pu-early").count(): await page.check("#pu-early")
    label = "S'abonner avec obligation de paiement" if mode == "abo" else "Commander avec obligation de paiement"
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
        relay_sub = lambda pg, sid, d: ev(pg, f"window.__fakefs.relaySet('subs/{sid}', {json.dumps(d)})")
        now_iso = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

        # ---------- coach : forfait Lite dans les réglages ----------
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse")
        ok(await has(co, "Bonjour", 8000), "coach connecté")
        await btn(co, "Offres & réglages", exact=True)
        ok(await co.input_value("#lt-m") == "9.9" and await co.input_value("#lt-a") == "89", "prix Lite par défaut : 9,90 € / mois, 89 € / an")
        await co.get_by_role("radio", name="Automatique (relais installé)").click()
        for k in ["mois_abo", "an_abo", "mois_avance", "an_avance"]: await co.fill("#pl-lite-" + k, "https://buy.stripe.com/test_lite_" + k)
        await co.fill("#lt-portail", "https://billing.stripe.com/p/login/test_portail")
        await co.fill("#pay-relay", "http://pas-https.example")
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(300)
        ok(await has(co, "Adresse invalide"), "adresse du relais non https refusée")
        await co.fill("#pay-relay", "")
        for k, v in [("siret", "123 456 789 00012"), ("adresse", "12 rue du Stade, 33270 Floirac"), ("email", "contact@antoine-prepa.fr"), ("telephone", "06 12 34 56 78"),
                     ("cartePro", "03312ED0123"), ("assurance", "Assureur Test, contrat 123"), ("mediateur", "Médiateur Test, 1 rue de Paris")]:
            await co.fill("#lg-" + k, v)
        await shot(co, "coach_reglages_lite")
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(500)
        st = await db(co, "settings/app")
        ok(st and st["lite"]["mois"] == 9.9 and st["lite"]["an"] == 89 and st["lite"]["portail"].startswith("https://billing") and st["pay"]["links"].get("lite_an_avance") == "https://buy.stripe.com/test_lite_an_avance" and st["video"]["coach"] == "suivi", "réglages Lite enregistrés (prix, 4 liens, portail, vidéo)", st and [st.get("lite"), st.get("pay")])
        # code Lite offert 2 semaines
        await btn(co, "Codes & essais", exact=True)
        await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Lite", exact=True).click(); await co.get_by_role("radio", name="2 semaines").click()
        await co.fill("#cd-code", "LITE-ESSAI2345"); await btn(co, "Créer le code"); await co.wait_for_timeout(400)
        ok(await has(co, "Offert · Lite · 2 semaines d'accès"), "code Lite créé (2 semaines d'accès)")

        # ---------- page d'accueil : carte Lite et lien de résiliation ----------
        V = await b.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True); await V.add_init_script("window.__RELAY_UID = 'relais-test';")
        vis = await V.new_page(); hook(vis, "visiteur")
        await vis.goto(URL); await vis.wait_for_timeout(1500)
        ok(await has(vis, "par mois") and await has(vis, "En abonnement (résiliable en quelques clics)"), "accueil : formule Lite avec ses prix")
        await vis.locator(".l-offer.lite").scroll_into_view_if_needed(); await shot(vis, "accueil_lite", full=False)

        # ---------- client L : Lite mensuel en abonnement ----------
        cl = await A.new_page(); hook(cl, "L"); await cl.set_viewport_size({"width": 390, "height": 844})
        await signup(cl, "lea@test.fr"); await onboard(cl, "Léa Lite", "Fitness", "Loisir ou départemental", "6 mois à 2 ans", "Remise en forme")
        uL = await uid_of(cl)
        await cl.get_by_role("radio", name="Lite", exact=True).click(); await cl.wait_for_timeout(200)
        ok(await has(cl, "Sans réponse d'Antoine à tes bilans") and await has(cl, "Ton accès commence dès le paiement"), "Lite : contenu de la formule et début au paiement")
        ok(await has(cl, "S'abonner avec obligation de paiement · 9,90 € / mois") and await has(cl, "Abonnement mensuel sans durée minimale"), "bouton d'abonnement et conditions affichées (L221-14)")
        await cl.check("#pu-cgv")
        ok(await cl.get_by_role("button", name="S'abonner avec obligation de paiement").first.is_disabled(), "abonnement immédiat : demande expresse obligatoire (L221-25)")
        await shot(cl, "commande_lite_abo")
        ref, url = await lite_checkout(cl, stripe_urls, "mois", "abo")
        ok(ref[0] == uL and ref[1] == "lite" and ref[2] == "mois-abo" and len(ref) == 4 and "test_lite_mois_abo" in url, "redirection Stripe : lien Lite mensuel, référence mois-abo", ref)
        oL = ref[3]
        od = await db(co, f"clients/{uL}/orders/{oL}")
        ok(od and od["offer"] == "lite" and od["period"] == "mois" and od["mode"] == "abo" and od["price"] == 9.9 and od["early"] is True and od["weeks"] is None, "commande Lite enregistrée", od)
        r1 = await relay_sub(co, "sub_LEA001", {"uid": uL, "period": "mois", "orderId": oL, "status": "active", "cancelAt": 0, "at": now_iso()})
        r2 = await relay_pay(co, "cs_lite_L1", {"uid": uL, "offer": "lite", "period": "mois", "mode": "abo", "sub": "sub_LEA001", "weeks": 0, "orderId": oL, "amount": 990, "expected": 990, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        ok(r1 == "ok" and r2 == "ok", "relais : abonnement et paiement enregistrés")
        await cl.goto(URL + "?paiement=ok&session_id=cs_lite_L1")
        ok(await has(cl, "prochaine séance", 10000), "retour de Stripe : accès Lite activé")
        plan = await db(cl, f"plans/{uL}")
        span = plan and (plan["untilMs"] - plan["startMs"]) / DAY
        ok(plan and plan["offer"] == "lite" and plan["lite"]["mode"] == "abo" and plan["lite"]["sub"] == "sub_LEA001" and plan["weeks"] == 12 and plan["grantWeeks"] == 0 and 27.9 <= span <= 31.1 and plan["start"] == iso(TODAY), "plan Lite : 12 semaines de programme, accès d'un mois", plan)
        ok(await has(cl, "accès jusqu'au"), "aujourd'hui : date de fin de l'accès affichée")
        await cl.get_by_role("button", name="Mon profil").click(); await cl.wait_for_timeout(400)
        ok(await has(cl, "abonnement mensuel, prochain prélèvement le") and await has(cl, "Gérer ma carte et mes factures"), "profil : abonnement en cours, lien vers le portail Stripe")
        fraud = await ev(cl, """(async () => { const db = firebase.firestore(); const me = firebase.auth().currentUser.uid; const r = {};
          const t = async (k, f) => { try { await f(); r[k] = 'ok'; } catch (e) { r[k] = e.code; } };
          const pl = (await db.doc('plans/' + me).get()).data();
          await t('allonger_acces', () => db.doc('plans/' + me).update({ untilMs: pl.untilMs + 365 * 86400000 }));
          await t('reutiliser_paiement', async () => { const b = db.batch(); b.update(db.doc('payments/cs_lite_L1'), { used: true, usedAt: 'x' }); b.set(db.doc('plans/' + me), { ...pl, untilMs: pl.untilMs + 30 * 86400000, cycle: pl.cycle + 1 }); await b.commit(); });
          await t('passer_en_suivi', () => db.doc('plans/' + me).update({ offer: 'suivi' }));
          await t('lire_abonnements', () => db.collection('subs').get());
          return r; })()""")
        ok(fraud == {"allonger_acces": "permission-denied", "reutiliser_paiement": "permission-denied", "passer_en_suivi": "permission-denied", "lire_abonnements": "permission-denied"}, "règles : accès Lite non modifiable, paiement non réutilisable", fraud)

        # renouvellement mensuel
        newUntil = plan["untilMs"] + 30 * DAY
        await relay_pay(co, "in_lite_L2", {"uid": uL, "offer": "lite", "period": "mois", "mode": "abo", "sub": "sub_LEA001", "renewal": True, "untilMs": newUntil, "weeks": 0, "orderId": oL, "amount": 990, "expected": 990, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cl.wait_for_timeout(2500)
        plan2 = await db(cl, f"plans/{uL}"); pay = await db(cl, "payments/in_lite_L2")
        rens = await ev(cl, f"Object.entries(window.__fakefs.load()).filter(([k, v]) => k.startsWith('clients/{uL}/orders/') && v.kind === 'renouvellement').map(([k, v]) => v)")
        ok(plan2["untilMs"] == newUntil and plan2["startMs"] == plan["startMs"] and plan2["programId"] == plan["programId"] and pay["used"] is True and len(rens) == 1 and rens[0]["parent"] == oL, "renouvellement : date de fin repoussée, programme inchangé, prélèvement listé", [plan2["untilMs"] - plan["untilMs"], pay and pay.get("used"), rens])
        # renouvellement d'un autre abonnement : refusé
        await relay_pay(co, "in_autre_1", {"uid": uL, "offer": "lite", "period": "an", "mode": "abo", "sub": "sub_AUTRE99", "renewal": True, "untilMs": newUntil + 365 * DAY, "weeks": 0, "amount": 8900, "expected": 8900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cl.wait_for_timeout(1500)
        forced = await ev(cl, """(async () => { const db = firebase.firestore(); const me = firebase.auth().currentUser.uid; const pl = (await db.doc('plans/' + me).get()).data();
          try { const b = db.batch(); b.update(db.doc('payments/in_autre_1'), { used: true, usedAt: 'x' }); b.set(db.doc('plans/' + me), { ...pl, untilMs: pl.untilMs + 365 * 86400000, until: 'x', source: { kind: 'paiement', id: 'in_autre_1', orderId: pl.source.orderId } }); await b.commit(); return 'ok'; } catch (e) { return e.code; } })()""")
        pa = await db(cl, "payments/in_autre_1")
        ok(pa["used"] is False and forced == "permission-denied", "renouvellement d'un autre abonnement : jamais appliqué", forced)
        await cl.reload(); await cl.wait_for_timeout(1200)
        await cl.get_by_role("button", name="Mon profil").click(); await cl.wait_for_timeout(400)
        ok(await has(cl, "Renouvellement · Lite mensuel (abonnement)"), "mes commandes : prélèvement mensuel affiché")
        # résiliation en 3 étapes
        await btn(cl, "Résilier mon abonnement")
        ok(await cl.input_value("#rs-n") == "Léa Lite" and await cl.input_value("#rs-e") == "lea@test.fr" and await has(cl, "à la fin de la période déjà payée"), "résiliation : identité pré-remplie, fin de période annoncée")
        await shot(cl, "resiliation_1")
        await btn(cl, "Continuer", exact=True)
        ok(await has(cl, "Confirmer la résiliation"), "résiliation : page récapitulative")
        async with cl.expect_download(timeout=8000) as dl:
            await btn(cl, "Confirmer la résiliation")
        ack = open(await (await dl.value).path(), encoding="utf-8").read()
        ok("ACCUSÉ DE RÉCEPTION DE RÉSILIATION" in ack and "Léa Lite" in ack and "Fin du contrat" in ack and "aucun nouveau prélèvement" in ack.lower(), "accusé de réception de résiliation (date et effets)")
        ok(await has(cl, "Résiliation enregistrée"), "résiliation confirmée à l'écran")
        await shot(cl, "resiliation_ok")
        od = await db(cl, f"clients/{uL}/orders/{oL}")
        ok(od["cancel"] and od["cancel"]["stripe"] == "manuel" and od["cancel"]["effectMs"] == newUntil and od["cancel"]["immediate"] is False, "résiliation enregistrée : effet à la fin de la période payée", od.get("cancel"))
        await co.bring_to_front(); await btn(co, "Tableau de bord", exact=True)
        ok(await has(co, "Résiliation : arrêter l'abonnement dans Stripe", 6000), "coach : alerte pour arrêter l'abonnement dans Stripe")
        await co.locator("ul.alerts button", has_text="Léa").first.click(); await co.wait_for_timeout(500)
        ok(await co.get_by_role("button", name="Abonnement arrêté dans Stripe").count() == 1, "coach : bouton pour noter l'arrêt dans Stripe")
        # le coach annule dans Stripe : le relais reçoit customer.subscription.updated et met à jour subs/
        await relay_sub(co, "sub_LEA001", {"uid": uL, "period": "mois", "orderId": oL, "status": "active", "cancelAt": newUntil, "at": now_iso()})
        await co.wait_for_timeout(1500)
        od = await db(co, f"clients/{uL}/orders/{oL}")
        ok(od["cancel"].get("stripe") == "ok", "arrêt confirmé par Stripe : alerte levée automatiquement", od.get("cancel"))
        await btn(co, "Tableau de bord", exact=True)
        ok(not await has(co, "Résiliation : arrêter l'abonnement dans Stripe", 1500), "plus d'alerte de résiliation à traiter")

        # ---------- client N : Lite annuel en abonnement, information avant reconduction ----------
        cn = await A.new_page(); hook(cn, "N"); await cn.set_viewport_size({"width": 390, "height": 844})
        await signup(cn, "nora@test.fr"); await onboard(cn, "Nora Annuel", "Course", "Loisir ou départemental", "Plus de 2 ans", "Course à pied 5-10 km")
        uN = await uid_of(cn)
        ref, url = await lite_checkout(cn, stripe_urls, "an", "abo")
        ok(ref[2] == "an-abo" and "test_lite_an_abo" in url, "Lite annuel : lien et référence an-abo")
        await relay_sub(co, "sub_NORA01", {"uid": uN, "period": "an", "orderId": ref[3], "status": "active", "cancelAt": 0, "at": now_iso()})
        await relay_pay(co, "cs_lite_N1", {"uid": uN, "offer": "lite", "period": "an", "mode": "abo", "sub": "sub_NORA01", "weeks": 0, "orderId": ref[3], "amount": 8900, "expected": 8900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cn.goto(URL + "?paiement=ok&session_id=cs_lite_N1"); await cn.wait_for_timeout(2500)
        pN = await db(cn, f"plans/{uN}")
        ok(pN and 364.95 <= (pN["untilMs"] - pN["startMs"]) / DAY <= 366.1, "accès annuel d'un an", pN and (pN["untilMs"] - pN["startMs"]) / DAY)  # 364,96 j quand le passage à l'heure d'été tombe dans l'année
        # le coach rapproche l'échéance (45 jours) : rappel L215-1
        await co.bring_to_front(); await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Nora").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
        due = TODAY + datetime.timedelta(days=45)
        await co.fill("#pe-until", iso(due - datetime.timedelta(days=1)))
        await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(700)
        ok(await has(co, "Reconduction annuelle le", 4000), "coach : alerte de reconduction annuelle à annoncer")
        ok(await has(co, "Reconduction le") and await has(co, "Préparer l'e-mail"), "coach : modèle d'e-mail d'information (encadré, date limite)")
        mail = await co.locator("a", has_text="Préparer l'e-mail").get_attribute("href")
        body = urllib.parse.unquote(mail)
        ok("DATE LIMITE DE NON-RECONDUCTION" in body and "L215-1" in body and "nora@test.fr" in body, "e-mail dédié : date limite dans un encadré, article cité")
        await shot(co, "coach_reconduction")
        await btn(co, "E-mail envoyé"); await co.wait_for_timeout(600)
        pN = await db(co, f"plans/{uN}")
        ok(pN["lite"].get("noticeFor") == pN["untilMs"], "information de reconduction notée sur le plan")
        await cn.bring_to_front(); await cn.reload(); await cn.wait_for_timeout(1500)
        ok(await has(cn, "Reconduction de ton abonnement annuel le"), "client : rappel de reconduction dans l'application")
        await relay_pay(co, "in_lite_N2", {"uid": uN, "offer": "lite", "period": "an", "mode": "abo", "sub": "sub_NORA01", "renewal": True, "untilMs": pN["untilMs"] + 365 * DAY, "weeks": 0, "amount": 8900, "expected": 8900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cn.wait_for_timeout(2500)
        await cn.get_by_role("button", name="Mon profil").click(); await cn.wait_for_timeout(400)
        await btn(cn, "Résilier mon abonnement")
        ok(await cn.get_by_role("radio", name="Tout de suite").count() == 0, "reconduction annoncée : résiliation à la fin de l'année payée")
        await btn(cn, "Annuler", exact=True)

        # ---------- client O : annuel reconduit SANS information → résiliation immédiate et remboursement ----------
        cO = await A.new_page(); hook(cO, "O"); await cO.set_viewport_size({"width": 390, "height": 844})
        await signup(cO, "olga@test.fr"); await onboard(cO, "Olga Oubli", "Natation", "Loisir ou départemental", "6 mois à 2 ans", "Remise en forme")
        uO = await uid_of(cO)
        ref, url = await lite_checkout(cO, stripe_urls, "an", "abo")
        await relay_sub(co, "sub_OLGA01", {"uid": uO, "period": "an", "orderId": ref[3], "status": "active", "cancelAt": 0, "at": now_iso()})
        await relay_pay(co, "cs_lite_O1", {"uid": uO, "offer": "lite", "period": "an", "mode": "abo", "sub": "sub_OLGA01", "weeks": 0, "orderId": ref[3], "amount": 8900, "expected": 8900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cO.goto(URL + "?paiement=ok&session_id=cs_lite_O1"); await cO.wait_for_timeout(2500)
        pO = await db(cO, f"plans/{uO}")
        # échéance passée de 10 jours sans information : le relais confirme la reconduction
        await ev(co, f"(async () => {{ const s = window.__fakefs.load(); s['plans/{uO}'].untilMs = Date.now() - 10 * 86400000 + 3600000; window.__fakefs.save(s); }})()")
        pO = await db(cO, f"plans/{uO}")
        await relay_pay(co, "in_lite_O2", {"uid": uO, "offer": "lite", "period": "an", "mode": "abo", "sub": "sub_OLGA01", "renewal": True, "untilMs": pO["untilMs"] + 365 * DAY, "weeks": 0, "amount": 8900, "expected": 8900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cO.reload(); await cO.wait_for_timeout(2500)
        ren = await ev(cO, f"Object.values(Object.fromEntries(Object.entries(window.__fakefs.load()).filter(([k]) => k.startsWith('clients/{uO}/orders/')))).find(o => o.kind === 'renouvellement')")
        ok(ren and ren["noticed"] is False, "reconduction sans information enregistrée (noticed = false)", ren)
        await cO.get_by_role("button", name="Mon profil").click(); await cO.wait_for_timeout(400)
        await btn(cO, "Résilier mon abonnement")
        ok(await has(cO, "Tu n'as pas reçu l'information prévue"), "résiliation à tout moment proposée (L215-1, 2e alinéa)")
        await cO.locator(".retract").get_by_role("radio").nth(1).click()
        await btn(cO, "Continuer", exact=True)
        async with cO.expect_download(timeout=8000) as dl:
            await btn(cO, "Confirmer la résiliation")
        ack = open(await (await dl.value).path(), encoding="utf-8").read()
        od = await ev(cO, f"Object.values(Object.fromEntries(Object.entries(window.__fakefs.load()).filter(([k]) => k.startsWith('clients/{uO}/orders/')))).find(o => o.cancel)")
        ok(od and od["cancel"]["immediate"] is True and 80 < od["cancel"]["refund"] < 89 and "Remboursement" in ack and "30 jours" in ack, "résiliation immédiate : remboursement du reste de l'année sous 30 jours", od and od.get("cancel"))
        await cO.get_by_role("button", name="Fermer").click()
        await cO.reload(); await cO.wait_for_timeout(1500)
        ok(await has(cO, "Ton accès Lite s'est terminé"), "accès arrêté immédiatement")
        await co.bring_to_front(); await btn(co, "Tableau de bord", exact=True)
        ok(await has(co, "Résiliation : rembourser", 6000), "coach : remboursement à faire signalé")

        # ---------- client P : Lite annuel en paiement d'avance, début différé ----------
        cp = await A.new_page(); hook(cp, "P"); await cp.set_viewport_size({"width": 390, "height": 844})
        await signup(cp, "paul@test.fr"); await onboard(cp, "Paul Avance", "Football", "Régional", "6 mois à 2 ans", "Vitesse & explosivité")
        uP = await uid_of(cp)
        await cp.get_by_role("radio", name="Lite", exact=True).click(); await cp.get_by_role("radio", name="Annuel · 89 € (−25 %)").click()
        await cp.get_by_role("radio", name="Paiement d'avance (sans renouvellement)").click()
        await cp.fill("#pu-start", iso(TODAY + datetime.timedelta(days=70)))
        await cp.check("#pu-cgv")
        ok(await has(cp, "entre aujourd'hui et dans 60 jours") and await cp.get_by_role("button", name="Commander avec obligation de paiement").first.is_disabled(), "paiement d'avance : début au plus tard dans 60 jours")
        ref, url = await lite_checkout(cp, stripe_urls, "an", "avance", start=iso(TODAY + datetime.timedelta(days=20)))
        ok(ref[2] == "an-avance" and "test_lite_an_avance" in url, "paiement d'avance annuel : lien et référence")
        await relay_pay(co, "cs_lite_P1", {"uid": uP, "offer": "lite", "period": "an", "mode": "avance", "sub": "", "weeks": 0, "orderId": ref[3], "amount": 8900, "expected": 8900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cp.goto(URL + "?paiement=ok&session_id=cs_lite_P1")
        ok(await has(cp, "ton programme commence dans 20 jours", 10000), "accès Lite d'avance : départ dans 20 jours")
        pP = await db(cp, f"plans/{uP}")
        ok(pP["lite"]["mode"] == "avance" and pP["start"] == iso(TODAY + datetime.timedelta(days=20)) and 364.95 <= (pP["untilMs"] - pP["startMs"]) / DAY <= 366.1, "paiement d'avance : un an à partir du départ choisi", pP)
        await cp.get_by_role("button", name="Mon profil").click(); await cp.wait_for_timeout(400)
        ok(await cp.get_by_role("button", name="Résilier mon abonnement").count() == 0 and await has(cp, "Lite annuel (paiement d'avance)"), "paiement d'avance : rien à résilier")

        # ---------- client K : code Lite, programme suivant choisi par le client, fin d'accès ----------
        ck = await A.new_page(); hook(ck, "K"); await ck.set_viewport_size({"width": 390, "height": 844})
        await signup(ck, "karim@test.fr"); await onboard(ck, "Karim Code", "Rugby", "Régional", "Plus de 2 ans", "Force & haltérophilie")
        uK = await uid_of(ck)
        await ck.fill("#pu-code", "LITE-ESSAI2345"); await btn(ck, "Appliquer", exact=True); await ck.wait_for_timeout(600)
        ok(await has(ck, "Lite · 2 semaines d'accès"), "code Lite reconnu")
        await ck.fill("#pu-start", iso(TODAY)); await ck.check("#pu-cgv")
        await btn(ck, "Activer mon accès offert"); await ck.wait_for_timeout(1500)
        pK = await db(ck, f"plans/{uK}")
        ok(pK and pK["offer"] == "lite" and pK["lite"]["mode"] == "code" and abs((pK["untilMs"] - pK["startMs"]) / DAY - 14) < 0.01 and pK["source"]["kind"] == "code", "code Lite : accès de 14 jours activé par le client", pK)
        # le programme est fini (départ il y a 13 semaines) mais l'accès court encore : le client choisit la suite
        await ev(co, f"(async () => {{ const s = window.__fakefs.load(); const p = s['plans/{uK}']; p.start = '{iso(TODAY - datetime.timedelta(weeks=13))}'; p.startMs = Date.now() - 91 * 86400000; p.untilMs = Date.now() + 20 * 86400000; window.__fakefs.save(s); }})()")
        await ck.reload(); await ck.wait_for_timeout(1500)
        pKb = await db(ck, f"plans/{uK}")
        ok(await has(ck, "Choisir mon prochain programme"), "programme terminé, accès en cours : choix du programme suivant")
        await shot(ck, "programme_suivant")
        await ck.select_option("#nc-prog", "vitesse"); await ck.wait_for_timeout(200)
        await btn(ck, "Démarrer ce programme"); await ck.wait_for_timeout(1200)
        pK2 = await db(ck, f"plans/{uK}")
        ok(pK2["programId"] == "vitesse" and pK2["cycle"] == pK["cycle"] + 1 and pK2["untilMs"] == pKb["untilMs"] and pK2["lite"] == pKb["lite"] and pK2["weeks"] == 12, "programme suivant enregistré par le client (cycle +1, accès inchangé)", [pK2["programId"], pK2["cycle"]])
        ok(await has(ck, "Semaine 1 sur 12", 6000) or await has(ck, "commence dans", 1000), "client : nouveau programme affiché")
        fr2 = await ev(ck, """(async () => { const db = firebase.firestore(); const me = firebase.auth().currentUser.uid; const r = {}; const pl = (await db.doc('plans/' + me).get()).data();
          const t = async (k, f) => { try { await f(); r[k] = 'ok'; } catch (e) { r[k] = e.code; } };
          await t('cycle_et_allonger', () => db.doc('plans/' + me).set({ ...pl, cycle: pl.cycle + 1, untilMs: pl.untilMs + 400 * 86400000 }));
          await t('cycle_sans_avis_medical', () => db.doc('plans/' + me).set({ ...pl, cycle: pl.cycle + 1, medicalHold: !pl.medicalHold, programId: 'force' }));
          return r; })()""")
        ok(fr2 == {"cycle_et_allonger": "permission-denied", "cycle_sans_avis_medical": "permission-denied"}, "règles : le choix du programme ne touche ni l'accès ni l'avis médical", fr2)
        # fin d'accès (le coach avance la date de fin)
        await co.bring_to_front(); await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Karim").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
        await co.fill("#pe-until", iso(TODAY - datetime.timedelta(days=1)))
        await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(700)
        await ck.bring_to_front(); await ck.wait_for_timeout(1200)
        ok(await has(ck, "Ton accès Lite s'est terminé", 6000), "fin de l'accès Lite : séances en pause, historique gardé")
        await ck.locator("button.next, button.srow").first.click(); await ck.wait_for_timeout(500)
        ok(await has(ck, "Prolonger ou changer de programme"), "séance verrouillée : proposition de reprendre")
        await shot(ck, "lite_termine")
        await ck.keyboard.press("Escape")

        # ---------- résiliation sans connexion (lien public) ----------
        pub = await V.new_page(); hook(pub, "public")
        await pub.goto(URL + "#resilier"); await pub.wait_for_timeout(1500)
        ok(await has(pub, "Pour un abonnement Lite"), "lien public « Résilier votre contrat » (#resilier)")
        await pub.fill("#pc-n", "Léa Lite"); await pub.fill("#pc-e", "lea@test.fr"); await pub.fill("#pc-r", oL)
        await btn(pub, "Continuer", exact=True)
        async with pub.expect_download(timeout=8000) as dl:
            await btn(pub, "Confirmer la résiliation")
        ack = open(await (await dl.value).path(), encoding="utf-8").read()
        ok("ACCUSÉ DE RÉCEPTION DE RÉSILIATION" in ack and oL in ack, "résiliation publique : accusé de réception immédiat")
        rs = await ev(pub, "Object.entries(window.__fakefs.load()).filter(([k]) => k.startsWith('resiliations/')).map(([k, v]) => v)")
        ok(len(rs) == 1 and rs[0]["email"] == "lea@test.fr" and rs[0]["done"] is False, "résiliation publique enregistrée", rs)
        bad = await ev(pub, """(async () => { try { await firebase.firestore().doc('resiliations/rbad12345').set({ at: 'x', name: 'Pirate', email: 'p@x.fr', ref: '', msg: '', done: false, admin: true }); return 'ok'; } catch (e) { return e.code; } })()""")
        rd = await ev(pub, """(async () => { try { await firebase.firestore().collection('resiliations').get(); return 'ok'; } catch (e) { return e.code; } })()""")
        ok(bad == "permission-denied" and rd == "permission-denied", "règles : champs limités, lecture réservée au coach", [bad, rd])
        # même base côté serveur : la demande publique (autre navigateur) arrive chez le coach
        pubdocs = await ev(pub, "Object.fromEntries(Object.entries(window.__fakefs.load()).filter(([k]) => k.startsWith('resiliations/')))")
        await ev(co, "(d => { const s = window.__fakefs.load(); Object.assign(s, d); window.__fakefs.save(s); window.dispatchEvent(new StorageEvent('storage', { key: 'fakefs_v1' })); })(" + json.dumps(pubdocs) + ")")
        await co.reload(); await co.wait_for_timeout(1500)
        await btn(co, "Tableau de bord", exact=True)
        ok(await has(co, "1 résiliation reçue depuis le site", 6000), "coach : résiliation publique à traiter")
        await shot(co, "coach_resiliation_publique")
        await co.get_by_role("button", name="Traitée").first.click(); await co.wait_for_timeout(600)
        rs = await ev(co, "Object.entries(window.__fakefs.load()).filter(([k]) => k.startsWith('resiliations/')).map(([k, v]) => v)")
        ok(rs[0]["done"] is True, "coach : résiliation publique traitée")
        # CGV : articles reproduits (L215-4)
        await vis.goto(URL + "?v=2#cgv"); await vis.wait_for_timeout(1800)
        ok(await has(vis, "Reproduction des articles L215-1 à L215-3 et L241-3") and await has(vis, "productives d'intérêts au taux légal") and await has(vis, "Abonnement annuel"), "CGV : forfait Lite et articles L215-1 à L215-3, L241-3 reproduits")
        st = [await ev(pg, "window.__fsStats.errors") for pg in [co, cl, cn, cO, cp, ck]]
        ok(not any(st), "aucune erreur de base de données", st)
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
