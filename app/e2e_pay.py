"""Site : paiement Stripe (relais simulé), confirmation manuelle, rétractation, codes (programme imposé, épuisé),
fin d'accès, prolongation et nouveau cycle, tentatives de fraude."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, urllib.parse, urllib.request
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/pay"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
TODAY = datetime.date.today()

def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text and "Activation du paiement" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:500]))
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
async def onboard(page, name, sport, compet, xp, prog, by="1996"):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-sport", sport); await page.fill("#ob-by", by)
    await btn(page, "Continuer")
    await page.get_by_role("radio", name=compet, exact=True).click(); await page.get_by_role("radio", name=xp, exact=True).click()
    await btn(page, "Continuer")
    await page.locator("button.pcard", has_text=prog).click(); await btn(page, "Continuer")
    for i in range(await page.locator(".yn").count()):
        await page.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    if await page.locator("#ob-pn").count():
        await page.fill("#ob-pn", "Parent Test"); await page.fill("#ob-pe", "parent@test.fr")
    await btn(page, "Continuer")
    await page.check("#ob-consent")
    if await page.locator("#ob-parent").count(): await page.check("#ob-parent")
    await btn(page, "Continuer vers mon accès"); await page.wait_for_timeout(800)
async def uid_of(page): return await page.evaluate("firebase.auth().currentUser.uid")

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
        # ---------- coach : réglages de paiement et informations légales ----------
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse")
        ok(await has(co, "Bonjour", 8000), "coach connecté")
        await btn(co, "Offres & réglages", exact=True)
        await co.get_by_role("radio", name="Automatique (relais installé)").click()
        await co.fill("#pl-suivi4", "https://buy.stripe.com/test_suivi1")
        await co.fill("#pl-essentiel4", "ftp://faux")
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(300)
        ok(await has(co, "Lien de paiement invalide"), "lien de paiement non https refusé")
        await co.fill("#pl-essentiel4", "")
        for k, v in [("siret", "123 456 789 00012"), ("adresse", "12 rue du Stade, 33270 Floirac"), ("email", "contact@antoine-prepa.fr"), ("telephone", "06 12 34 56 78"),
                     ("diplome", "Licence STAPS Entraînement sportif"), ("cartePro", "03312ED0123"), ("assurance", "Assureur Test, contrat 123, monde entier"), ("mediateur", "Médiateur Test, 1 rue de Paris")]:
            await co.fill("#lg-" + k, v)
        ok(await has(co, "Informations légales complètes"), "informations légales complètes")
        await shot(co, "coach_reglages_paiement")
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(500)
        st = await db(co, "settings/app")
        ok(st and st["pay"]["mode"] == "auto" and st["pay"]["links"] == {"suivi_4": "https://buy.stripe.com/test_suivi1"} and st["legal"]["cartePro"] == "03312ED0123", "réglages de paiement enregistrés", st and st.get("pay"))
        await btn(co, "Tableau de bord", exact=True)
        ok(not await has(co, "Informations légales à compléter", 800), "plus de rappel légal une fois complété")
        # codes : un offert avec programme imposé, un pour prolonger
        await btn(co, "Codes & essais", exact=True)
        await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="1 mois").click()
        await co.select_option("#cd-prog", "force"); await co.fill("#cd-note", "Partenariat club")
        await btn(co, "Créer le code"); await co.wait_for_timeout(400)
        code_force = (await co.locator(".codeitem .mono").first.inner_text()).strip()
        ok(code_force.startswith("OFFERT-") and await has(co, "1 mois · Force & haltérophilie"), "code offert avec programme imposé : " + code_force)
        await co.fill("#cd-code", "PROLONGE-ABC2345"); await co.get_by_role("radio", name="1 mois").click(); await co.select_option("#cd-prog", "force")
        await btn(co, "Créer le code"); await co.wait_for_timeout(400)
        await co.fill("#cd-code", "NOUVEAU-XYZ7788"); await co.get_by_role("radio", name="2 semaines").click(); await co.select_option("#cd-prog", "")
        await btn(co, "Créer le code"); await co.wait_for_timeout(400)
        ok(await co.locator(".codeitem").count() == 3, "3 codes listés")
        await co.fill("#cd-code", "PROLONGE-ABC2345"); await btn(co, "Créer le code")
        ok(await has(co, "Ce code existe déjà"), "code en double refusé")
        await co.get_by_role("button", name="Copier le lien").first.click(); await co.wait_for_timeout(200)
        ok(True, "lien d'offre copiable")

        # ---------- client B : paiement Stripe + relais ----------
        cb = await A.new_page(); hook(cb, "B"); await cb.set_viewport_size({"width": 390, "height": 844})
        await signup(cb, "bastien@test.fr"); await onboard(cb, "Bastien Payeur", "Rugby", "Régional", "6 mois à 2 ans", "Prépa sports collectifs")
        uB = await uid_of(cb)
        ok(await has(cb, "Commander avec obligation de paiement · 99 €"), "prix du lien : Suivi 1 mois 99 €")
        await cb.fill("#pu-start", TODAY.isoformat())
        await cb.check("#pu-cgv")
        ok(await cb.get_by_role("button", name="Commander avec obligation de paiement").first.is_disabled(), "début immédiat : la demande expresse (art. L221-25) est obligatoire")
        await cb.check("#pu-early")
        await shot(cb, "commande_payante")
        async with cb.expect_navigation(url="**buy.stripe.com**", timeout=8000):
            await cb.get_by_role("button", name="Commander avec obligation de paiement").first.click()
        q = urllib.parse.parse_qs(urllib.parse.urlparse(stripe_urls[-1]).query)
        ref = q.get("client_reference_id", [""])[0].split("__")
        ok(ref[0] == uB and ref[1] == "suivi" and ref[2] == "4" and len(ref) == 4 and q.get("prefilled_email") == ["bastien@test.fr"], "redirection Stripe avec la référence de commande", ref)
        orderB = ref[3]
        od = await db(co, f"clients/{uB}/orders/{orderB}")
        ok(od and od["status"] == "en_attente" and od["early"] is True and od["cgv"]["v"] and od["price"] == 99, "commande enregistrée avant paiement (CGV, demande expresse)", od)
        # le relais (Cloudflare) écrit le paiement confirmé par Stripe
        r = await ev(co, f"window.__fakefs.relayCreate('payments/cs_test_B1', {{ uid: '{uB}', offer: 'suivi', weeks: 4, orderId: '{orderB}', amount: 9900, expected: 9900, currency: 'eur', email: 'bastien@test.fr', ok: true, used: false, at: new Date().toISOString(), session: 'cs_test_B1', live: false }})")
        ok(r == "ok", "relais : paiement enregistré")
        await cb.goto(URL + "?paiement=ok&session_id=cs_test_B1")
        ok(await has(cb, "prochaine séance", 10000), "retour de Stripe : accès activé automatiquement")
        plan = await db(cb, f"plans/{uB}"); pay = await db(cb, "payments/cs_test_B1"); od = await db(cb, f"clients/{uB}/orders/{orderB}")
        ok(plan and plan["source"] == {"kind": "paiement", "id": "cs_test_B1", "orderId": orderB} and plan["weeks"] == 4 and pay["used"] is True and od["status"] == "active" and od["paidAmount"] == 99, "paiement utilisé une fois, commande active", [plan and plan.get("source"), pay and pay.get("used"), od and od.get("status")])
        fraud = await ev(cb, """(async () => { const db = firebase.firestore(); const me = firebase.auth().currentUser.uid; const r = {};
          const t = async (k, f) => { try { await f(); r[k] = 'ok'; } catch (e) { r[k] = e.code; } };
          await t('reutiliser_paiement', async () => { const b = db.batch(); b.update(db.doc('payments/cs_test_B1'), { used: true, usedAt: 'x' }); b.set(db.doc('plans/' + me), { programId: 'force', offer: 'suivi', weeks: 4, start: '2026-12-01', equipment: 'salle', status: 'active', niveau: 'perf', cycle: 2, grantWeeks: 4, source: { kind: 'paiement', id: 'cs_test_B1', orderId: 'z' } }); await b.commit(); });
          await t('allonger_sans_payer', () => db.doc('plans/' + me).update({ weeks: 12 }));
          await t('remettre_paiement_neuf', () => db.doc('payments/cs_test_B1').update({ used: false }));
          await t('lire_paiements_des_autres', () => db.collection('payments').get());
          return r; })()""")
        ok(fraud == {"reutiliser_paiement": "permission-denied", "allonger_sans_payer": "permission-denied", "remettre_paiement_neuf": "permission-denied", "lire_paiements_des_autres": "permission-denied"}, "règles : paiement non réutilisable, accès non modifiable", fraud)
        # montant insuffisant signalé par le relais : pas d'activation
        r = await ev(co, f"window.__fakefs.relayCreate('payments/cs_test_B2', {{ uid: '{uB}', offer: 'suivi', weeks: 4, orderId: 'oautre', amount: 4900, expected: 9900, currency: 'eur', ok: false, used: false, at: new Date().toISOString() }})")
        await cb.wait_for_timeout(1500)
        pay2 = await db(cb, "payments/cs_test_B2")
        ok(pay2 and pay2["used"] is False, "paiement au montant insuffisant : jamais activé")
        # ---------- rétractation ----------
        await cb.get_by_role("button", name="Mon profil").click(); await cb.wait_for_timeout(300)
        ok(await has(cb, "Mes commandes"), "profil : mes commandes")
        async with cb.expect_download(timeout=8000) as dl0:
            await cb.get_by_role("button", name="Télécharger le récapitulatif").first.click()
        recap = open(await (await dl0.value).path(), encoding="utf-8").read()
        ok("RÉCAPITULATIF DE COMMANDE" in recap and "123 456 789 00012" in recap and "Renoncer au contrat ici" in recap and "293 B" in recap, "récapitulatif de commande complet (support durable)")
        await btn(cb, "Renoncer au contrat ici")
        ok(await has(cb, "Remboursement estimé"), "formulaire de rétractation avec remboursement au prorata")
        await shot(cb, "retractation")
        async with cb.expect_download(timeout=8000) as dl1:
            await btn(cb, "Confirmer la rétractation")
        ack = open(await (await dl1.value).path(), encoding="utf-8").read()
        ok("ACCUSÉ DE RÉCEPTION" in ack and "Bastien Payeur" in ack and orderB in ack, "accusé de réception horodaté téléchargé")
        od = await db(cb, f"clients/{uB}/orders/{orderB}")
        ok(od and od["status"] == "retractee" and od["withdrawal"]["refund"] > 90, "rétractation enregistrée (remboursement ≈ " + str(od and od["withdrawal"]["refund"]) + " €)")
        ok(await has(cb, "Ta rétractation a bien été reçue", 6000), "client : accès coupé, message de rétractation")
        await co.bring_to_front(); await btn(co, "Tableau de bord", exact=True)
        ok(await has(co, "Rétractation : rembourser", 6000), "coach : alerte de remboursement")
        await co.locator("ul.alerts button", has_text="Bastien").first.click(); await co.wait_for_timeout(500)
        await btn(co, "Remboursement effectué · clôturer l'accès"); await co.wait_for_timeout(600)
        plan = await db(co, f"plans/{uB}"); od = await db(co, f"clients/{uB}/orders/{orderB}")
        ok(plan["status"] == "archived" and od["withdrawal"].get("refundedAt"), "coach : remboursement noté, accès clôturé")

        # ---------- client C : commande sans paiement en ligne, confirmée par le coach ----------
        await btn(co, "Offres & réglages", exact=True)
        await co.get_by_role("radio", name="Je confirme moi-même").click(); await co.fill("#pl-suivi4", "")
        await co.fill("#pay-info", "Je t'envoie un lien de paiement par e-mail sous 24 h.")
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(500)
        cc = await A.new_page(); hook(cc, "C"); await cc.set_viewport_size({"width": 390, "height": 844})
        await signup(cc, "chloe@test.fr"); await onboard(cc, "Chloé Manuel", "Course", "Loisir ou départemental", "Moins de 6 mois", "Course à pied 5-10 km")
        uC = await uid_of(cc)
        await cc.check("#pu-cgv"); await cc.check("#pu-early")
        await btn(cc, "Commander avec obligation de paiement"); await cc.wait_for_timeout(700)
        ok(await has(cc, "Commande enregistrée") and await has(cc, "lien de paiement par e-mail"), "commande sans lien : consignes du coach")
        ok(await cc.locator("nav.tabbar").count() == 0, "pas d'accès avant confirmation du paiement")
        await co.bring_to_front(); await btn(co, "Tableau de bord", exact=True)
        ok(await has(co, "Commande à encaisser", 6000), "coach : commande à encaisser")
        await co.locator("ul.alerts button", has_text="Chloé").first.click(); await co.wait_for_timeout(500)
        await btn(co, "Paiement reçu · activer"); await co.wait_for_timeout(600)
        await cc.bring_to_front()
        ok(await has(cc, "Ton programme commence", 8000) or await has(cc, "prochaine séance", 2000), "client : accès ouvert après confirmation du coach")

        # ---------- client D : code offert (programme imposé), fin d'accès, prolongation, nouveau cycle ----------
        cd = await A.new_page(); hook(cd, "D"); await cd.set_viewport_size({"width": 390, "height": 844})
        await signup(cd, "dylan@test.fr"); await onboard(cd, "Dylan Code", "Haltérophilie", "National", "Plus de 2 ans", "Prise de muscle")
        uD = await uid_of(cd)
        await cd.fill("#pu-code", code_force); await btn(cd, "Appliquer", exact=True); await cd.wait_for_timeout(500)
        ok(await cd.locator("#pu-prog").is_disabled() and await cd.input_value("#pu-prog") == "force", "code à programme imposé : Force & haltérophilie")
        await cd.fill("#pu-start", TODAY.isoformat()); await cd.check("#pu-cgv")
        await btn(cd, "Activer mon accès offert"); await cd.wait_for_timeout(1200)
        plan = await db(cd, f"plans/{uD}")
        ok(plan and plan["programId"] == "force" and plan["weeks"] == 4 and plan["offer"] == "suivi", "accès Force 1 mois activé", plan)
        # une séance du cycle 1
        await cd.locator("button.next").click(); await cd.wait_for_timeout(300)
        await cd.locator("#rpe button", has_text="6").first.click()
        await btn(cd, "Enregistrer la séance"); await cd.wait_for_timeout(600)
        # client E : même code (1 utilisation) → refusé
        ce = await A.new_page(); hook(ce, "E"); await ce.set_viewport_size({"width": 390, "height": 844})
        await signup(ce, "emma@test.fr"); await onboard(ce, "Emma Retard", "Tennis", "Régional", "Plus de 2 ans", "Force & haltérophilie")
        await ce.fill("#pu-code", code_force); await btn(ce, "Appliquer", exact=True); await ce.wait_for_timeout(600)
        ok(await has(ce, "atteint son nombre d'utilisations"), "code épuisé : refusé pour un autre client")
        await ce.fill("#pu-code", "INCONNU-123"); await btn(ce, "Appliquer", exact=True); await ce.wait_for_timeout(500)
        ok(await has(ce, "Code inconnu"), "code inconnu : refusé")
        # mineur : commande par un parent
        cm = await A.new_page(); hook(cm, "M"); await cm.set_viewport_size({"width": 390, "height": 844})
        await signup(cm, "minot@test.fr"); await onboard(cm, "Léo Junior", "Football", "Régional", "6 mois à 2 ans", "Vitesse & explosivité", by=str(TODAY.year - 15))
        prof = await db(cm, f"clients/{await uid_of(cm)}")
        ok(prof and prof["parent"]["email"] == "parent@test.fr" and prof["request"]["niveau"] == "sportif", "mineur : parent enregistré, profil plafonné à Sportif", prof and prof.get("parent"))
        await cm.check("#pu-cgv"); await cm.check("#pu-early") if await cm.locator("#pu-early").count() else None
        ok(await cm.get_by_role("button", name="Commander avec obligation de paiement").first.is_disabled() and await cm.locator("#pu-parent").count() == 1, "mineur : commande bloquée sans l'accord du parent")
        # fin d'accès : le coach recule la date de début
        await co.bring_to_front(); await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Dylan").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
        await co.fill("#pe-start", (TODAY - datetime.timedelta(days=40)).isoformat())
        await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(500)
        await cd.bring_to_front(); await cd.wait_for_timeout(800)
        ok(await has(cd, "Programme terminé", 6000) and await has(cd, "ne sont plus accessibles"), "fin de période : séances verrouillées, historique conservé")
        await shot(cd, "acces_termine")
        await cd.locator("nav.tabbar button", has_text="Programme").click(); await cd.wait_for_timeout(300)
        await cd.locator("button.srow").nth(1).click(); await cd.wait_for_timeout(400)
        ok(await has(cd, "Prolonger ou changer de programme"), "séance verrouillée : proposition de prolonger")
        await cd.fill(".modal #pu-code", "PROLONGE-ABC2345"); await cd.locator(".modal").get_by_role("button", name="Appliquer", exact=True).click(); await cd.wait_for_timeout(500)
        ok(await has(cd, "Continuer (semaines 5 à 8)"), "prolongation proposée : semaines 5 à 8")
        await cd.fill(".modal #pu-start", TODAY.isoformat())
        await cd.check(".modal #pu-cgv")
        await cd.locator(".modal").get_by_role("button", name="Activer mon accès offert").click(); await cd.wait_for_timeout(1200)
        plan = await db(cd, f"plans/{uD}")
        ok(plan and plan["weeks"] == 8 and plan["cycle"] == 1 and plan["start"] == (TODAY - datetime.timedelta(days=28)).isoformat(), "prolongation : 8 semaines, la semaine 5 commence aujourd'hui", plan and [plan["weeks"], plan["start"], plan["cycle"]])
        await shot(cd, "apres_prolongation")
        await cd.locator("nav.tabbar button", has_text="Aujourd'hui").click(timeout=5000); await cd.wait_for_timeout(300)
        ok(await has(cd, "Semaine 5 sur 8", 6000), "client : reprise en semaine 5")
        # nouveau cycle avec un autre code (programme libre), « recommencer à la semaine 1 »
        await co.bring_to_front(); await co.fill("#pe-start", (TODAY - datetime.timedelta(days=70)).isoformat())
        await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(500)
        await cd.bring_to_front(); await cd.wait_for_timeout(800)
        await btn(cd, "Prolonger ou choisir la suite")
        await cd.fill(".modal #pu-code", "NOUVEAU-XYZ7788"); await cd.locator(".modal").get_by_role("button", name="Appliquer", exact=True).click(); await cd.wait_for_timeout(500)
        await cd.select_option(".modal #pu-prog", "vitesse")
        await cd.fill(".modal #pu-start", TODAY.isoformat()); await cd.check(".modal #pu-cgv")
        await cd.locator(".modal").get_by_role("button", name="Activer mon accès offert").click(); await cd.wait_for_timeout(1200)
        plan = await db(cd, f"plans/{uD}")
        logs = await ev(cd, f"Object.keys(window.__fakefs.load()).filter(k => k.startsWith('clients/{uD}/logs/'))")
        ok(plan and plan["cycle"] == 2 and plan["programId"] == "vitesse" and plan["weeks"] == 2, "nouveau programme : cycle 2", plan and [plan["cycle"], plan["programId"], plan["weeks"]])
        ok(await has(cd, "Semaine 1 sur 2", 6000) and await cd.locator("button.srow.done").count() == 0 and len(logs) == 1, "cycle 2 : semaine 1 vierge, séance du cycle 1 conservée", logs)
        await shot(cd, "nouveau_cycle")
        st = [await ev(pg, "window.__fsStats.errors") for pg in [co, cb, cc, cd]]
        ok(not any(st), "aucune erreur de base de données", st)
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
