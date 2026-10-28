"""Site : gestion — factures numérotées automatiquement (Stripe et paiement direct avec son moyen), facture téléchargée par le client,
avoir après rétractation, page Finances (ventes du mois, déclaration URSSAF, export du livre des recettes), registre protégé par les règles."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, urllib.parse, urllib.request
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/factures"
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

        # ---------- coach : mentions légales (elles figurent sur chaque facture), un lien Stripe ----------
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse")
        ok(await has(co, "Bonjour", 8000), "coach connecté")
        await btn(co, "Finances", exact=True)
        ok(await has(co, "Déclaration URSSAF") and await has(co, "Aucune facture pour l'instant"), "page Finances : déclaration du mois et registre vide")
        await btn(co, "Offres & réglages", exact=True)
        await co.get_by_role("radio", name="Automatique (relais installé)").click()
        await co.fill("#pl-suivi4", "https://buy.stripe.com/test_suivi4")
        for k, v in [("siret", "123 456 789 00012"), ("adresse", "12 rue du Stade, 33270 Floirac"), ("email", "contact@antoine-prepa.fr"), ("telephone", "06 12 34 56 78"),
                     ("cartePro", "03312ED0123"), ("assurance", "Assureur Test, contrat 123"), ("mediateur", "Médiateur Test, 1 rue de Paris")]:
            await co.fill("#lg-" + k, v)
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(600)
        Y = str(TODAY.year)

        # ---------- client B : Suivi 1 mois payé par Stripe ----------
        cb = await A.new_page(); hook(cb, "B"); await cb.set_viewport_size({"width": 390, "height": 844})
        await signup(cb, "bastien@test.fr"); await onboard(cb, "Bastien Facture", "Rugby", "Régional", "6 mois à 2 ans", "Prépa sports collectifs")
        uB = await uid_of(cb)
        await cb.get_by_role("radio", name="Suivi", exact=True).click(); await cb.get_by_role("radio", name="1 mois").click()
        await cb.fill("#pu-start", iso(TODAY))
        ref, url = await checkout(cb, stripe_urls)
        oB = ref[3]
        await relay_pay(co, "cs_B1", {"uid": uB, "offer": "suivi", "weeks": 4, "orderId": oB, "amount": 11900, "expected": 11900, "currency": "eur", "ok": True, "used": False, "at": now_iso()})
        await cb.goto(URL + "?paiement=ok&session_id=cs_B1")
        ok(await has(cb, "prochaine séance", 10000), "paiement Stripe : accès activé")

        # ---------- le coach ouvre son espace : la facture s'établit toute seule ----------
        await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(3000)
        f1 = await db(co, f"factures/{Y}-0001")
        odB = await db(co, f"clients/{uB}/orders/{oB}")
        ok(f1 and f1["kind"] == "facture" and f1["montant"] == 119 and f1["orderId"] == oB and f1["moyen"] == "Carte bancaire (Stripe)" and f1["client"]["name"] == "Bastien Facture" and f1["vendeur"]["siret"] == "123 456 789 00012"
           and f1["periode"]["du"] == iso(TODAY) and odB.get("facture", {}).get("num") == f"{Y}-0001", "facture n° 1 établie automatiquement (montant, moyen, période, vendeur), copiée dans la commande", f1)
        cpt = await db(co, "factures/compteur")
        ok(cpt and cpt["dernier"] == 1 and cpt["annee"] == TODAY.year, "compteur des factures à 1", cpt)
        # facture côté client
        await cb.bring_to_front(); await cb.get_by_role("button", name="Mon profil").click(); await cb.wait_for_timeout(500)
        async with cb.expect_download(timeout=8000) as dl:
            await cb.get_by_role("button", name="Télécharger ma facture").first.click()
        fh = open(await (await dl.value).path(), encoding="utf-8").read()
        ok(f"FACTURE N° {Y}-0001" in fh and "Antoine Limousi EI" in fh and "SIRET 123 456 789 00012" in fh and "TVA non applicable, article 293 B du CGI" in fh and "Facture acquittée" in fh and "Bastien Facture" in fh and "119,00" in fh and "formule Suivi" in fh,
           "client : facture téléchargée avec les mentions obligatoires (EI, SIRET, TVA, acquittée)")

        # ---------- client C : Essentiel payé en direct (espèces) ----------
        cc = await A.new_page(); hook(cc, "C"); await cc.set_viewport_size({"width": 390, "height": 844})
        await signup(cc, "chloe@test.fr"); await onboard(cc, "Chloe Especes", "Football", "Régional", "6 mois à 2 ans", "Prépa sports collectifs")
        uC = await uid_of(cc)
        await cc.get_by_role("radio", name="Essentiel", exact=True).click(); await cc.get_by_role("radio", name="1 mois").click()
        await cc.fill("#pu-start", iso(TODAY)); await cc.check("#pu-cgv")
        if await cc.locator("#pu-early").count(): await cc.check("#pu-early")
        await btn(cc, "Commander avec obligation de paiement"); await cc.wait_for_timeout(800)
        ok(await has(cc, "Commande enregistrée"), "commande en paiement direct enregistrée")
        await co.bring_to_front(); await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Chloe").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
        await co.get_by_label("Moyen de paiement reçu").select_option("Espèces")
        await btn(co, "Paiement reçu · activer"); await co.wait_for_timeout(3000)
        f2 = await db(co, f"factures/{Y}-0002")
        ok(f2 and f2["moyen"] == "Espèces" and f2["montant"] == 59 and f2["cid"] == uC, "paiement direct : facture n° 2 avec le moyen de paiement choisi", f2)

        # ---------- rétractation de B : avoir sur la facture n° 1 ----------
        await cb.bring_to_front()
        await btn(cb, "Renoncer au contrat ici")
        async with cb.expect_download(timeout=8000):
            await btn(cb, "Confirmer la rétractation")
        await cb.wait_for_timeout(800)
        await co.bring_to_front(); await btn(co, "Clients", exact=True)
        await co.locator("table.ctable tbody tr", has_text="Bastien").click(); await co.wait_for_timeout(400)
        await co.get_by_role("radio", name="Plan").click(); await co.wait_for_timeout(300)
        await btn(co, "Remboursement effectué · clôturer l'accès"); await co.wait_for_timeout(3000)
        odB = await db(co, f"clients/{uB}/orders/{oB}")
        f3 = await db(co, f"factures/{Y}-0003")
        ok(f3 and f3["kind"] == "avoir" and f3["ref"] == f"{Y}-0001" and abs(f3["montant"] - odB["withdrawal"]["refund"]) < 0.01 and odB.get("avoir", {}).get("num") == f"{Y}-0003" and odB.get("facture", {}).get("num") == f"{Y}-0001",
           "remboursement : avoir n° 3 sur la facture n° 1, la facture reste dans la commande", [f3, odB.get("withdrawal")])
        async with co.expect_download(timeout=8000) as dl:
            await co.get_by_role("button", name=f"Avoir {Y}-0003").click()
        ah = open(await (await dl.value).path(), encoding="utf-8").read()
        ok(f"AVOIR N° {Y}-0003" in ah and f"Sur la facture n° {Y}-0001" in ah and "Remboursé le" in ah, "avoir téléchargeable par le coach")

        # ---------- page Finances : mois en cours, déclaration, export ----------
        await btn(co, "Tableau de bord", exact=True); await co.wait_for_timeout(500)
        prev = (TODAY.replace(day=1) - datetime.timedelta(days=1))
        MO = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
        ok(await has(co, f"déclare ton chiffre d'affaires de {MO[prev.month - 1]} {prev.year}"), "tableau de bord : rappel de la déclaration URSSAF du mois précédent")
        await co.locator(".alert", has_text="URSSAF").get_by_role("button", name="Voir").click(); await co.wait_for_timeout(500)
        ok(await has(co, "Ventes de l'application en " + Y) and await has(co, "Toutes les ventes ont leur facture"), "page Finances : ventes de l'année, factures à jour")
        net = 119 + 59 - odB["withdrawal"]["refund"]
        row = co.locator("table.fin-table tbody tr", has_text=MO[TODAY.month - 1] + " " + Y).first
        txt = await row.inner_text()
        ok(f"{net:,.2f}".replace(",", " ").replace(".", ",") in txt.replace("\u202f", " ").replace("\xa0", " "), "mois en cours : ventes − remboursement = chiffre d'affaires", [txt, net])
        await shot(co, "finances")
        async with co.expect_download(timeout=8000) as dl:
            await co.get_by_role("button", name="Livre des recettes " + Y + " (CSV)").click()
        csv = open(await (await dl.value).path(), encoding="utf-8-sig").read()
        raw = open(await (await dl.value).path(), "rb").read()
        lines = csv.strip().splitlines()
        ok(lines[0].startswith("Date d'encaissement;N° de facture ou d'avoir;Client") and len(lines) == 4 and any(f"{Y}-0003" in l and ";-" in l for l in lines) and any("Espèces" in l for l in lines) and b"\r\n" in raw and [l.split(";")[1] for l in lines[1:]] == [f"{Y}-0001", f"{Y}-0002", f"{Y}-0003"], "export du livre des recettes : 2 ventes et 1 remboursement, au format Excel français", lines)
        await btn(co, "J'ai déclaré et payé"); await co.wait_for_timeout(600)
        prm = await db(co, "factures/parametres")
        ok(prm and prm["declarations"].get(prev.strftime("%Y-%m")) == iso(TODAY), "déclaration du mois notée", prm)
        await btn(co, "Tableau de bord", exact=True); await co.wait_for_timeout(500)
        ok(not await has(co, "déclare ton chiffre d'affaires de", 1200), "rappel URSSAF levé une fois la déclaration faite")

        # ---------- règles : registre lisible par le coach seul, jamais modifié ni supprimé ----------
        rc = await ev(cc, """(async () => { try { await firebase.firestore().collection('factures').get(); return 'ok'; } catch (e) { return e.code; } })()""")
        rco = await ev(co, f"""(async () => {{ const db = firebase.firestore(); const r = {{}};
          const t = async (k, f) => {{ try {{ await f(); r[k] = 'ok'; }} catch (e) {{ r[k] = e.code; }} }};
          await t('modifier', () => db.doc('factures/{Y}-0001').update({{ montant: 1 }}));
          await t('supprimer', () => db.doc('factures/{Y}-0001').delete());
          await t('compteur', () => db.doc('factures/compteur').update({{ note: 'x' }}));
          return r; }})()""")
        ok(rc == "permission-denied" and rco == {"modifier": "permission-denied", "supprimer": "permission-denied", "compteur": "ok"}, "règles : un client ne lit pas le registre ; une facture ne se modifie ni ne se supprime", [rc, rco])
        st = [await ev(pg, "window.__fsStats.errors") for pg in [co, cb, cc]]
        ok(not any(st), "aucune erreur de base de données", st)
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
