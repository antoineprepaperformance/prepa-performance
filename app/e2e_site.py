"""Parcours complet de la version site : accueil, comptes (émulateur Firebase Auth), coach, client,
synchronisation en direct entre onglets, nutrition sans IA (Open Food Facts simulé), sécurité des données."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, sys, urllib.request
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/site"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
CLIENT, COACH, PW = "julie.martin@test.fr", "coach@test.fr", "motdepasse123"

def hook(page, tag):
    def onc(m):
        if m.type in ("error", "warning") and "Failed to load resource" not in m.text and "Download the React DevTools" not in m.text:
            errs.append(f"[{tag}] {m.type}: {m.text[:300]}")
    page.on("console", onc)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))

def ok(cond, label, info=None):
    (oks if cond else fails).append(label)
    print(("  OK  " if cond else "  FAIL ") + label + ("" if cond or info is None else "  " + json.dumps(info, ensure_ascii=False)[:400]))

async def shot(page, name, full=True):
    n[0] += 1
    await page.wait_for_timeout(300)
    await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)

async def btn(page, text, exact=False, nth=0, scope=None):
    root = page.locator(scope) if scope else page
    await root.get_by_role("button", name=text, exact=exact).nth(nth).click()
    await page.wait_for_timeout(250)

async def has(page, text, timeout=4000):
    try:
        await page.get_by_text(text).first.wait_for(timeout=timeout)
        return True
    except Exception:
        return False

def emu(path, method="GET"):
    req = urllib.request.Request(EMU + path, method=method, headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        body = r.read()
        return json.loads(body) if body else {}

async def overflow(page):
    return await page.evaluate("Math.max(0, document.documentElement.scrollWidth - window.innerWidth)")

async def fs(page, js):
    return await page.evaluate(js)

OFF = {"status": 1, "product": {"product_name_fr": "Nutella", "brands": "Ferrero", "nutriscore_grade": "e", "serving_quantity": 15,
       "nutriments": {"energy-kcal_100g": 539, "proteins_100g": 6.3, "carbohydrates_100g": 57.5, "fat_100g": 30.9, "sugars_100g": 56.3, "salt_100g": 0.107}}}

async def off_route(route):
    if "3017620422003" in route.request.url:
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(OFF), headers={"Access-Control-Allow-Origin": "*"})
    else:
        await route.fulfill(status=404, content_type="application/json", body=json.dumps({"status": 0, "status_verbose": "product not found"}), headers={"Access-Control-Allow-Origin": "*"})

async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
        await A.route("https://world.openfoodfacts.org/**", off_route)
        # ---------- accueil ----------
        home = await A.new_page(); hook(home, "home")
        await home.goto(URL); await home.evaluate("window.__fakefs.reset()"); await home.reload()
        ok(await has(home, "Comment ça marche"), "accueil : section « Comment ça marche »")
        ok(await home.locator(".l-sec .pcard").count() == 8, "accueil : 8 programmes")
        ok(await home.locator(".l-offer").count() == 4 and await home.locator(".l-offer.lite").count() == 1, "accueil : 3 formules + forfait Lite")
        ok(await home.locator(".l-card svg").count() >= 1, "accueil : carte athlète d'exemple")
        ok(await overflow(home) == 0, "accueil ordinateur : pas de défilement horizontal")
        await shot(home, "accueil_ordinateur")
        await home.set_viewport_size({"width": 820, "height": 1180}); await home.wait_for_timeout(300)
        ok(await overflow(home) == 0, "accueil tablette : pas de défilement horizontal")
        await shot(home, "accueil_tablette")
        await home.set_viewport_size({"width": 1280, "height": 860})
        await home.get_by_role("button", name="Mentions légales", exact=True).click()
        ok(await has(home, "123 456 789 00012"), "mentions légales : SIRET de la configuration")
        ok(await has(home, "Carte professionnelle"), "mentions légales : carte professionnelle d'éducateur sportif")
        await shot(home, "mentions", full=False)
        await home.locator(".modal").get_by_role("radio", name="Conditions de vente").click(); await home.wait_for_timeout(200)
        ok(await has(home, "Renoncer au contrat ici") and await has(home, "Commander avec obligation de paiement") and await has(home, "L221-25"), "CGV : rétractation en ligne, bouton de commande, exécution anticipée")
        await home.locator(".modal").get_by_role("radio", name="Confidentialité").click(); await home.wait_for_timeout(200)
        ok(await has(home, "article 9.2.a") and await has(home, "article 45"), "confidentialité : santé (RGPD art. 9) et mineurs")
        await home.keyboard.press("Escape"); await home.wait_for_timeout(200)
        await home.goto(URL + "?r=1#cgv"); await home.wait_for_timeout(800)
        ok(await home.locator(".modal").count() == 1 and await has(home, "Droit de rétractation"), "lien direct vers les CGV (#cgv)")
        await home.close()

        # ---------- inscription du client (téléphone) ----------
        cl = await A.new_page(); hook(cl, "client")
        await cl.set_viewport_size({"width": 390, "height": 844})
        await cl.goto(URL)
        await shot(cl, "accueil_telephone")
        ok(await overflow(cl) == 0, "accueil téléphone : pas de défilement horizontal")
        await btn(cl, "Créer mon compte", exact=True)
        await shot(cl, "inscription_modale", full=False)
        await cl.fill("#au-e", CLIENT); await cl.fill("#au-p", "123")
        ok(await cl.locator(".modal").get_by_role("button", name="Créer mon compte").is_disabled(), "mot de passe trop court : bouton désactivé")
        await cl.fill("#au-p", PW)
        await cl.locator(".modal").get_by_role("button", name="Créer mon compte").click()
        ok(await has(cl, "Commencer mon inscription", 8000), "compte créé : inscription au programme")
        await btn(cl, "Commencer mon inscription")
        ok(await cl.input_value("#ob-email") == CLIENT, "e-mail du compte pré-rempli")
        await cl.fill("#ob-name", "Julie Martin"); await cl.fill("#ob-h", "178"); await cl.fill("#ob-w", "75"); await cl.fill("#ob-sport", "Handball"); await cl.fill("#ob-by", "1994")
        await btn(cl, "Continuer")
        await cl.get_by_role("radio", name="National", exact=True).click(); await cl.get_by_role("radio", name="Plus de 2 ans").click()
        await cl.wait_for_timeout(200)
        ok(await cl.locator(".niv.on", has_text="Performance").count() == 1 and await cl.locator(".niv", has_text="Conseillé").count() == 1, "niveau : profil Performance conseillé et sélectionné")
        await shot(cl, "inscription_niveau")
        await btn(cl, "Continuer")
        ok(await cl.locator("button.pcard", has_text="Conseillé").count() == 2, "objectif : 2 programmes conseillés pour le handball")
        await cl.locator("button.pcard", has_text="Prépa sports collectifs").click(); await cl.wait_for_timeout(200)
        ok(await cl.locator(".fit li").count() >= 2, "objectif : vérification de cohérence affichée")
        await shot(cl, "inscription_objectif")
        await btn(cl, "Continuer")
        for i in range(await cl.locator(".yn").count()):
            await cl.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
        await btn(cl, "Continuer")
        ok("coach IA (une intelligence artificielle : Gemma, de Google, exécutée par Cloudflare) quand je l'utilise" in await cl.locator("label.chk").inner_text(), "consentement du site : analyse par le coach IA seulement quand le client l'utilise")
        await cl.check("#ob-consent")
        await btn(cl, "Continuer vers mon accès")
        ok(await has(cl, "active ton accès", 6000), "inscription terminée : écran d'accès (paiement ou code)")
        ok(await cl.locator("nav.tabbar").count() == 0 and await cl.locator("button.next").count() == 0, "sans paiement ni code : aucune séance accessible")
        ok(await cl.get_by_role("button", name="Commander avec obligation de paiement").first.is_disabled(), "bouton de commande bloqué tant que les CGV ne sont pas acceptées")
        await shot(cl, "client_acces")
        uid = await fs(cl, "firebase.auth().currentUser.uid")
        doc = await fs(cl, f"window.__fakefs.load()['clients/{uid}']")
        ok(doc and doc.get("consent", {}).get("v") == "site2" and doc.get("request", {}).get("niveau") == "perf", "dossier client enregistré (consentement, profil Performance)")
        # sécurité côté client
        sec = await fs(cl, """(async () => { const db = firebase.firestore(); const r = {}; const me = firebase.auth().currentUser.uid;
          const t = async (k, f) => { try { await f(); r[k] = 'ok'; } catch (e) { r[k] = e.code; } };
          await t('autre_client', () => db.doc('clients/quelquun').get());
          await t('liste_clients', () => db.collection('clients').get());
          await t('ecrire_plan', () => db.doc('plans/' + me).set({ status: 'active' }));
          await t('plan_sans_droit', () => db.doc('plans/' + me).set({ programId: 'prepa', offer: 'suivi', weeks: 12, start: '2026-10-26', equipment: 'salle', status: 'active', niveau: 'perf', cycle: 1, grantWeeks: 12, source: { kind: 'code', id: 'INVENTE', orderId: 'x' } }));
          await t('faux_paiement', () => db.doc('payments/cs_faux').set({ uid: me, offer: 'suivi', weeks: 12, ok: true, used: false, amount: 26900 }));
          await t('liste_codes', () => db.collection('codes').get());
          await t('code_inconnu', () => db.doc('codes/INVENTE').get());
          await t('ecrire_reglages', () => db.doc('settings/app').set({ x: 1 }));
          await t('lire_reglages', () => db.doc('settings/app').get());
          await t('lire_son_plan', () => db.doc('plans/' + me).get());
          await t('notes_coach', () => db.doc('coachnotes/' + me).get());
          await t('produit_id_invalide', () => db.doc('products/abc').set({ n: 'x' }));
          return r; })()""")
        ok(sec == {"autre_client": "permission-denied", "liste_clients": "permission-denied", "ecrire_plan": "permission-denied", "plan_sans_droit": "permission-denied",
                   "faux_paiement": "permission-denied", "liste_codes": "permission-denied", "code_inconnu": "ok", "ecrire_reglages": "permission-denied",
                   "lire_reglages": "ok", "lire_son_plan": "ok", "notes_coach": "permission-denied", "produit_id_invalide": "permission-denied"}, "règles : le client ne voit que ses données et ne peut pas s'offrir un accès " + json.dumps(sec))

        # ---------- coach : compte, vérification de l'adresse, code d'essai ----------
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL)
        await btn(co, "Commencer", exact=True)
        await co.fill("#au-e", COACH); await co.fill("#au-p", PW)
        await co.locator(".modal").get_by_role("button", name="Créer mon compte").click()
        ok(await has(co, "Confirme ton adresse e-mail", 8000), "coach : vérification de l'adresse demandée")
        await shot(co, "coach_verification", full=False)
        sec2 = await fs(co, "(async () => { try { await firebase.firestore().collection('clients').get(); return 'ok'; } catch (e) { return e.code; } })()")
        ok(sec2 == "permission-denied", "règles : adresse coach non vérifiée = aucun accès")
        await btn(co, "J'ai confirmé mon adresse")
        ok(await has(co, "pas encore confirmée"), "clic trop tôt : message d'attente")
        codes = emu("/emulator/v1/projects/demo-prepa/oobCodes").get("oobCodes", [])
        link = [c for c in codes if c.get("email") == COACH and c.get("requestType") == "VERIFY_EMAIL"][-1]["oobLink"]
        ok(not any(c.get("email") == CLIENT and c.get("requestType") == "VERIFY_EMAIL" for c in codes), "pas d'e-mail de vérification inutile pour les clients")
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse")
        ok(await has(co, "Bonjour", 8000), "coach : espace coach ouvert après vérification")
        ok(await has(co, "Informations légales à compléter"), "coach : rappel des informations légales")
        ok(await co.locator("table.ctable", has_text="Julie").count() == 1 and await has(co, "Sans accès"), "coach : le client inscrit apparaît, sans accès")
        await shot(co, "coach_tableau_de_bord")
        ok(await co.get_by_role("button", name="Importer un envoi").count() == 0, "site : pas d'import de texte")
        await btn(co, "Codes & essais", exact=True)
        await co.get_by_role("radio", name="2 semaines").click()
        await shot(co, "coach_codes")
        await btn(co, "Créer le code")
        code = (await co.locator(".codeitem .mono").first.inner_text()).strip()
        ok(code.startswith("ESSAI-") and await has(co, "Essai · Suivi · 2 semaines"), "code d'essai créé : " + code)
        cdoc = await fs(co, f"window.__fakefs.load()['codes/{code}']")
        ok(cdoc and cdoc["max"] == 1 and cdoc["uses"] == 0 and cdoc["programId"] is None, "code enregistré (1 utilisation, programme libre)")

        # ---------- client : activation avec le code ----------
        await cl.bring_to_front()
        await cl.fill("#pu-code", code.lower()); await btn(cl, "Appliquer", exact=True); await cl.wait_for_timeout(500)
        ok(await has(cl, "accès offert, rien à payer"), "code reconnu (saisi en minuscules)")
        await cl.fill("#pu-start", datetime.date.today().isoformat())
        ok(await cl.get_by_role("button", name="Activer mon accès offert").is_disabled(), "activation bloquée sans acceptation des CGV")
        await cl.check("#pu-cgv")
        await shot(cl, "client_code")
        await btn(cl, "Activer mon accès offert"); await cl.wait_for_timeout(1200)
        plan = await fs(cl, f"window.__fakefs.load()['plans/{uid}']")
        cdoc = await fs(cl, f"window.__fakefs.load()['codes/{code}']")
        ok(plan and plan["status"] == "active" and plan["source"]["kind"] == "code" and plan["weeks"] == 2 and plan["niveau"] == "perf" and plan["cycle"] == 1, "accès activé par le client, vérifié par les règles", plan)
        ok(cdoc and cdoc["uses"] == 1 and uid in cdoc["usedBy"], "code marqué comme utilisé")
        ok(await has(cl, "prochaine séance", 6000), "client : programme accessible tout de suite")
        reuse = await fs(cl, f"""(async () => {{ const db = firebase.firestore(); const me = firebase.auth().currentUser.uid; const b = db.batch();
          b.update(db.doc('codes/{code}'), {{ uses: firebase.firestore.FieldValue.increment(1), ['usedBy.' + me]: 'x' }});
          b.set(db.doc('plans/' + me), {{ programId: 'prepa', offer: 'suivi', weeks: 2, start: '2026-11-02', equipment: 'salle', status: 'active', niveau: 'perf', cycle: 2, grantWeeks: 2, source: {{ kind: 'code', id: '{code}', orderId: 'y' }} }});
          try {{ await b.commit(); return 'ok'; }} catch (e) {{ return e.code; }} }})()""")
        ok(reuse == "permission-denied", "règles : même code réutilisé = refusé")

        # ---------- coach : vérification du nouvel accès ----------
        await co.bring_to_front()
        await btn(co, "Tableau de bord", exact=True)
        ok(await has(co, "Nouvel accès (code) : vérifier le plan", 6000), "coach : alerte « nouvel accès à vérifier »")
        await co.locator("ul.alerts button", has_text="Julie").first.click(); await co.wait_for_timeout(500)
        tabs = await co.locator(".tabs-scroll .seg").inner_text()
        ok("Coach IA" not in tabs, "fiche client : pas d'onglet Coach IA sur le site")
        ok(await co.locator("#acc").count() == 0 and not await has(co, "Code d'accès du client", 800), "fiche client : pas de code d'accès")
        ok(await co.input_value("#pe-niv") == "perf" and await has(co, "Profil conseillé : Performance"), "fiche client : profil et réponses du client")
        ok(await has(co, "Commandes") and await has(co, "code " + code), "fiche client : commande par code visible")
        start = (datetime.date.today() - datetime.timedelta(days=9)).isoformat()
        await co.fill("#pe-start", start)
        await co.get_by_role("radio", name="3 mois").click()
        await co.fill("#pe-msg", "Bienvenue Julie ! Vise 3 séances par semaine.")
        await btn(co, "Enregistrer", exact=True); await co.wait_for_timeout(500)
        plan = await fs(co, f"window.__fakefs.load()['plans/{uid}']")
        ok(plan and plan.get("status") == "active" and plan.get("reviewedAt") and plan["weeks"] == 12, "coach : plan vérifié et ajusté (3 mois)")

        # ---------- client : mise à jour en direct, séances ----------
        await cl.bring_to_front()
        ok(await has(cl, "Bienvenue Julie", 8000), "client : programme affiché en direct après validation")
        ok(await cl.locator(".tab-ia").count() == 0, "client : pas de bouton Coach IA")
        ok(await overflow(cl) == 0, "client téléphone : pas de défilement horizontal")
        await shot(cl, "client_aujourdhui")
        await cl.locator("button.next").click(); await cl.wait_for_timeout(300)
        ok(await has(cl, "Contrôle de forme") and await has(cl, "Échauffement RAMP") and await cl.locator(".exc.prev").count() >= 1 and await has(cl, "Tempo"), "séance Performance : forme du jour, RAMP, tempo et prévention handball")
        for k in ["sommeil", "fatigue", "courbatures", "stress", "moral"]:
            await cl.locator(f"#rd-{k} button", has_text="2").first.click()
        ok(await has(cl, "Séance allégée"), "forme basse : séance allégée automatiquement")
        for k in ["sommeil", "fatigue", "courbatures", "stress", "moral"]:
            await cl.locator(f"#rd-{k} button", has_text="4").first.click()
        ok(await has(cl, "Feu vert"), "bonne forme : feu vert")
        await shot(cl, "seance_performance")
        kg = cl.locator(".sets input[id^=kg-]")
        for i in range(min(await kg.count(), 6)):
            await kg.nth(i).fill(str(30 + 2 * i))
        dones = cl.locator("button.donebtn")
        for i in range(await dones.count()):
            await dones.nth(i).click()
        await cl.locator("#rpe button", has_text="7").first.click()
        await btn(cl, "Enregistrer la séance"); await cl.wait_for_timeout(600)
        logs = await fs(cl, f"Object.keys(window.__fakefs.load()).filter(k => k.startsWith('clients/{uid}/logs/')).length")
        ok(logs == 1, "séance enregistrée")
        await cl.locator("nav.tabbar button", has_text="Bilan").click(); await cl.wait_for_timeout(300)
        if await cl.locator("#ck-poids").count(): await cl.fill("#ck-poids", "72,4")
        for k, v in [("sommeil", "4"), ("energie", "3"), ("stress", "2"), ("courbatures", "3"), ("nutrition", "4")]:
            loc = cl.locator(f"#ck-{k} button", has_text=v)
            if await loc.count(): await loc.first.click()
        if await cl.locator("#ck-question").count(): await cl.fill("#ck-question", "Je peux remplacer le rameur par le vélo ?")
        await btn(cl, "Envoyer mon bilan"); await cl.wait_for_timeout(700)
        await shot(cl, "client_bilan_envoye")
        ok(await cl.locator(".athcard, svg.athcard, .card-evo, .evo").count() >= 1 or await has(cl, "Ta carte", 1500), "bilan : résultat motivant (carte) affiché")

        # ---------- nutrition sans IA ----------
        await cl.locator("nav.tabbar button", has_text="Nutrition").click(); await cl.wait_for_timeout(300)
        await cl.get_by_role("radio", name="Homme").click()
        await cl.fill("#nu-a", "31"); await cl.fill("#nu-h", "178"); await cl.fill("#nu-w", "92")
        await cl.get_by_role("radio", name="Perdre du poids").click()
        await cl.fill("#nu-d", "8"); await cl.get_by_role("radio", name="4", exact=True).click()
        await shot(cl, "nutrition_objectif")
        await btn(cl, "Enregistrer mon objectif"); await cl.wait_for_timeout(500)
        ok(await cl.locator("button.addbtn", has_text="Photo du repas").count() == 0, "site : pas de photo de repas (IA)")
        await cl.locator("button.addbtn", has_text="Saisir").click(); await cl.wait_for_timeout(200)
        await cl.fill("#fd-q", "riz"); await cl.locator(".sugg button", has_text="Riz blanc cuit").click()
        await cl.fill("#fd-q", "poul"); await cl.locator(".sugg button", has_text="Blanc de poulet").click()
        await cl.locator(".modal .it-g input").first.fill("200")
        await shot(cl, "nutrition_saisie_aliments", full=False)
        await cl.locator(".modal").get_by_role("button", name="Ajouter au journal").click(); await cl.wait_for_timeout(500)
        today = datetime.date.today().isoformat()
        food = await fs(cl, f"window.__fakefs.load()['clients/{uid}/food/{today}']")
        meal = food and food["meals"][0]
        ok(meal and len(meal["items"]) == 2 and meal["kcal"] == 522 and meal["items"][0].get("ciq") == 9104, "repas saisi avec aliments courants (valeurs ANSES : riz 200 g + poulet 150 g = 522 kcal) " + str(meal and meal["kcal"]))
        # scan : code tapé -> Open Food Facts
        await cl.locator("button.addbtn", has_text="Scanner").click(); await cl.wait_for_timeout(200)
        await cl.fill("#scan-typed", "3017620422003"); await btn(cl, "Chercher", exact=True, scope=".modal")
        ok(await has(cl, "Open Food Facts", 6000) and await has(cl, "Nutella"), "scan : produit trouvé dans Open Food Facts")
        await shot(cl, "scan_openfoodfacts", full=False)
        await cl.locator(".modal").get_by_role("button", name="Ajouter au journal").click(); await cl.wait_for_timeout(500)
        prod = await fs(cl, "window.__fakefs.load()['products/3017620422003']")
        ok(prod and prod.get("source") == "off" and prod["per100"]["kcal"] == 539, "produit mémorisé pour tous les clients")
        # scan : photo du code-barres -> reconnu (cache)
        await cl.locator("button.addbtn", has_text="Scanner").click(); await cl.wait_for_timeout(200)
        await cl.set_input_files("#scan-bc", HERE + "/test/photo_barcode.jpg")
        ok(await has(cl, "Reconnu grâce au code-barres", 15000), "scan photo : code-barres lu et produit reconnu")
        await btn(cl, "Scanner un autre produit")
        # produit inconnu -> fiche manuelle
        await cl.fill("#scan-typed", "1234567890128"); await btn(cl, "Chercher", exact=True, scope=".modal")
        ok(await has(cl, "Ajouter ce produit", 6000), "produit inconnu : formulaire de saisie")
        await cl.fill("#pf-n", "Barre protéinée maison"); await cl.fill("#pf-k", "380"); await cl.fill("#pf-p", "30"); await cl.fill("#pf-c", "35"); await cl.fill("#pf-f", "12"); await cl.fill("#pf-po", "45")
        await shot(cl, "scan_saisie_produit", full=False)
        await btn(cl, "Valider le produit")
        await cl.locator(".modal").get_by_role("button", name="Ajouter au journal").click(); await cl.wait_for_timeout(500)
        food = await fs(cl, f"window.__fakefs.load()['clients/{uid}/food/{today}']")
        ok(food and len(food["meals"]) == 3 and food["meals"][2]["kcal"] == 171, "produit saisi ajouté (45 g = 171 kcal)")
        await shot(cl, "nutrition_journal")

        # ---------- profil : avatar, photo, carte ----------
        await cl.get_by_role("button", name="Mon profil").click(); await cl.wait_for_timeout(300)
        await cl.get_by_role("button", name="Changer ma photo ou mon avatar").first.click(); await cl.wait_for_timeout(200)
        await cl.locator(".av-opt").nth(3).click(); await cl.locator(".av-col").nth(2).click()
        await cl.locator(".modal").get_by_role("button", name="Enregistrer", exact=True).click(); await cl.wait_for_timeout(500)
        prof = await fs(cl, f"window.__fakefs.load()['clients/{uid}']")
        ok(prof.get("avatar", {}).get("kind") == "icon", "avatar enregistré")
        await cl.get_by_role("button", name="Changer ma photo ou mon avatar").first.click(); await cl.wait_for_timeout(200)
        await cl.set_input_files("#av-photo", HERE + "/test/photo_repas.jpg"); await cl.wait_for_timeout(900)
        await cl.locator(".modal").get_by_role("button", name="Enregistrer", exact=True).click(); await cl.wait_for_timeout(600)
        media = await fs(cl, f"JSON.stringify(window.__fakefs.load()['clients/{uid}/media/photo'] || null).length")
        ok(1000 < media < 200000, f"photo de profil enregistrée ({media // 1024} Ko)")
        ok(await has(cl, "Se déconnecter"), "profil : bouton de déconnexion")
        ok(await has(cl, "Mes commandes") and await cl.get_by_role("button", name="Renoncer au contrat ici").count() == 0, "profil : commandes listées, pas de rétractation pour un accès offert")
        try:
            async with cl.expect_download(timeout=8000) as dl:
                await cl.get_by_role("button", name="Télécharger ma carte").first.click()
            d = await dl.value
            path = await d.path()
            ok(d.suggested_filename.endswith(".png") and os.path.getsize(path) > 20000, "carte athlète téléchargée en image (%s, %d Ko)" % (d.suggested_filename, os.path.getsize(path) // 1024))
            import shutil; shutil.copy(path, OUT + "/carte_telechargee.png")
        except Exception as e:
            ok(False, "téléchargement de la carte : " + str(e)[:150])
        await shot(cl, "client_profil")

        # ---------- coach : suivi, réponse, réglages ----------
        await co.bring_to_front()
        await co.get_by_role("radio", name="Vue d'ensemble").click(); await co.wait_for_timeout(400)
        await shot(co, "coach_fiche_client")
        await co.get_by_role("radio", name="Bilans").click(); await co.wait_for_timeout(300)
        await co.locator(".chipbtn").first.click()
        await btn(co, "Envoyer la réponse"); await co.wait_for_timeout(500)
        rep = await fs(co, f"window.__fakefs.load()['replies/{uid}']")
        ok(rep and any(k.startswith("w") for k in rep), "réponse au bilan enregistrée")
        await co.get_by_role("radio", name="Nutrition").click(); await co.wait_for_timeout(300)
        ok(await has(co, "Nutella"), "coach : journal alimentaire du client visible")
        await shot(co, "coach_nutrition_client")
        await btn(co, "Offres & réglages", exact=True)
        ok(await has(co, "État sur le site : Pas encore installé sur le site", 3000), "réglages : carte Coach IA du site (relais pas encore installé)")
        await co.fill("#st-p", "06 12 34 56 78"); await co.fill("#pr-suivi0", "149")
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(500)
        st = await fs(co, "window.__fakefs.load()['settings/app']")
        ok(st and st["coach"]["phone"] == "06 12 34 56 78" and st["offers"]["suivi"][0] == 149, "réglages enregistrés")
        await shot(co, "coach_reglages")
        await btn(co, "Tableau de bord", exact=True)
        await shot(co, "coach_tableau_final")

        # ---------- client : réponse reçue, version ordinateur ----------
        await cl.bring_to_front()
        await cl.locator("nav.tabbar button", has_text="Aujourd'hui").click(); await cl.wait_for_timeout(400)
        await cl.set_viewport_size({"width": 1280, "height": 860}); await cl.wait_for_timeout(400)
        await shot(cl, "client_ordinateur")
        await cl.set_viewport_size({"width": 390, "height": 844}); await cl.wait_for_timeout(300)
        reads = await fs(cl, "window.__fsStats")
        print("  lectures/écritures client (session de test) :", reads["reads"], reads["writes"])

        # ---------- déconnexion, reconnexion, mot de passe oublié ----------
        await cl.get_by_role("button", name="Mon profil").click(); await cl.wait_for_timeout(200)
        await btn(cl, "Se déconnecter"); await cl.wait_for_timeout(1500)
        ok(await has(cl, "Comment ça marche", 6000), "déconnexion : retour à l'accueil")
        ok("06 12 34 56 78" not in await cl.inner_text("body") and await has(cl, "149"), "accueil : prix mis à jour par le coach, numéro de téléphone non affiché (contact par écrit)")
        await btn(cl, "Connexion", exact=True)
        await cl.fill("#au-e", CLIENT); await cl.fill("#au-p", "mauvais-mdp")
        await cl.locator(".modal").get_by_role("button", name="Me connecter").click()
        ok(await has(cl, "Mot de passe incorrect", 6000) or await has(cl, "E-mail ou mot de passe incorrect", 500), "mauvais mot de passe : message clair")
        await shot(cl, "connexion_erreur", full=False)
        await btn(cl, "Mot de passe oublié ?")
        await cl.locator(".modal").get_by_role("button", name="Recevoir le lien").click(); await cl.wait_for_timeout(800)
        codes = emu("/emulator/v1/projects/demo-prepa/oobCodes").get("oobCodes", [])
        ok(any(c.get("email") == CLIENT and c.get("requestType") == "PASSWORD_RESET" for c in codes), "mot de passe oublié : e-mail envoyé")
        await cl.fill("#au-p", PW)
        await cl.locator(".modal").get_by_role("button", name="Me connecter").click()
        ok(await has(cl, "Bienvenue Julie", 8000), "reconnexion : données retrouvées")

        # ---------- connexion Google (fenêtre de l'émulateur) ----------
        g = await A.new_page(); hook(g, "google")
        blocked = []
        g.on("requestfailed", lambda r: blocked.append(r.url) if "apis.google.com" in r.url else None)
        await g.goto(URL)
        await btn(g, "Commencer", exact=True)
        try:
            async with g.expect_popup(timeout=8000) as pop:
                await g.locator(".gbtn").click()
            pp = await pop.value
            await pp.wait_for_load_state()
            await pp.get_by_text("Add new account").click()
            await pp.locator("#email-input").fill("lucas.g@gmail.com")
            await pp.locator("#display-name-input").fill("Lucas Bernard")
            await pp.get_by_text("Sign in with Google.com").click()
            ok(await has(g, "Commencer mon inscription", 10000), "connexion Google : inscription ouverte")
            await btn(g, "Commencer mon inscription")
            ok(await g.input_value("#ob-name") == "Lucas Bernard", "connexion Google : nom pré-rempli")
        except Exception as e:
            if blocked:
                print("  SKIP connexion Google : apis.google.com inaccessible depuis cet environnement (fonctionne en ligne)")
            else:
                ok(False, "connexion Google : " + str(e)[:200])
                await shot(g, "FAIL_google")

        # ---------- site non configuré ----------
        nc = await b.new_context(viewport={"width": 390, "height": 844})
        await nc.route("**/config.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body='window.SITE_CONFIG={firebase:{apiKey:"A_REMPLIR",projectId:"A_REMPLIR"}};'))
        ncp = await nc.new_page(); hook(ncp, "non-configure")
        await ncp.goto(URL)
        ok(await has(ncp, "pas encore relié à Firebase"), "site non configuré : écran d'aide")
        await shot(ncp, "non_configure", full=False)
        # coach mobile, thème clair
        L = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="light")
        lp = await L.new_page(); hook(lp, "clair")
        await lp.goto(URL)
        await shot(lp, "accueil_telephone_clair")
        st2 = await fs(co, "window.__fsStats")
        print("  lectures/écritures coach :", st2["reads"], st2["writes"])
        allstats = [await fs(pg, "window.__fsStats.errors") for pg in [cl, co]]
        ok(not any(allstats), "aucune erreur de base de données " + json.dumps(allstats)[:300])
        await co.set_viewport_size({"width": 390, "height": 844}); await co.wait_for_timeout(300)
        ok(await overflow(co) == 0, "coach téléphone : pas de défilement horizontal (%d px)" % await overflow(co))
        await shot(co, "coach_telephone", full=False)
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:80]) or "aucune erreur console")

asyncio.run(run())
