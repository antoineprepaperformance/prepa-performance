"""Site : messagerie coach ↔ client avec Firebase (règles réelles, Auth émulé), bouton Me contacter de la page d'accueil,
coach IA et photo des repas par le relais (Claude simulé au niveau du relais)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, urllib.request
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
RELAY = "https://relais-test.example.workers.dev"
OUT = HERE + "/shots/messages_site"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
TODAY = datetime.date.today()
calls = []
MEAL = {"titre": "Poulet, riz et brocolis", "items": [{"n": "Blanc de poulet", "g": 150, "kcal": 165, "p": 35, "c": 0, "f": 3}, {"n": "Riz basmati cuit", "g": 180, "kcal": 230, "p": 5, "c": 50, "f": 1}],
        "confiance": "moyenne", "verdict": "bon", "commentaire": "Repas complet et riche en protéines.", "conseil": "Ajoute un fruit si tu as encore faim."}
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
def emu(path, method="GET"):
    req = urllib.request.Request(EMU + path, method=method, headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        b = r.read(); return json.loads(b) if b else {}
async def db(page, path): return await page.evaluate(f"window.__fakefs.load()[{json.dumps(path)}]")
async def keys(page, prefix): return await page.evaluate(f"Object.keys(window.__fakefs.load()).filter(k => k.startsWith({json.dumps(prefix)}))")
async def signup(page, email):
    await page.goto(URL)
    await btn(page, "Créer mon compte", exact=True)
    await page.fill("#au-e", email); await page.fill("#au-p", PW)
    await page.locator(".modal").get_by_role("button", name="Créer mon compte").click()
    await page.wait_for_timeout(1200)
async def onboard(page, name):
    await btn(page, "Commencer mon inscription")
    await page.fill("#ob-name", name); await page.fill("#ob-h", "178"); await page.fill("#ob-w", "75"); await page.fill("#ob-by", "1994"); await page.fill("#ob-sport", "Fitness")
    await btn(page, "Continuer")
    await page.get_by_role("radio", name="Loisir ou départemental", exact=True).click(); await page.get_by_role("radio", name="6 mois à 2 ans", exact=True).click()
    await btn(page, "Continuer")
    await page.locator("button.pcard", has_text="Remise en forme").click(); await btn(page, "Continuer")
    for i in range(await page.locator(".yn").count()):
        await page.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    await btn(page, "Continuer"); await page.check("#ob-consent")
    await btn(page, "Continuer vers mon accès"); await page.wait_for_timeout(800)
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET, POST, OPTIONS", "content-type": "application/json"}
async def relay(route):
    req = route.request
    if req.method == "OPTIONS": await route.fulfill(status=204, headers=CORS); return
    if req.url.endswith("/ia/etat"): await route.fulfill(status=200, headers=CORS, body=json.dumps({"ok": True, "ia": True, "quota": True})); return
    if req.url.endswith("/sante/etat"): await route.fulfill(status=200, headers=CORS, body=json.dumps({"ok": True, "sante": True})); return
    b = json.loads(req.post_data or "{}")
    calls.append({"auth": req.headers.get("authorization", ""), "body": b})
    msgs = b.get("messages", [])
    last = msgs[-1] if msgs else {}
    lc = last.get("content")
    blocks = lc if isinstance(lc, list) else [{"type": "text", "text": lc or ""}]
    texts = " ".join(x.get("text", "") for x in blocks if x.get("type") == "text")
    has_img = any(x.get("type") == "image" for x in blocks)
    is_result = any(x.get("type") == "tool_result" for x in blocks)
    if has_img and "analyse_photo_repas" in texts: out = {"content": [{"type": "text", "text": json.dumps(MEAL, ensure_ascii=False)}], "stop_reason": "end_turn"}
    elif is_result and any(x.get("is_error") and "Exercices du bloc : " in str(x.get("content")) for x in blocks):
        first = [x for x in blocks if x.get("is_error")][0]["content"].split("Exercices du bloc : ")[1].split(",")[0].strip()
        out = {"content": [{"type": "tool_use", "id": "toolu_test2", "name": "remplacer_exercice", "input": {"exercice_actuel": first, "nouvel_exercice": "pont_fessier", "seance": "toutes", "raison": "Gêne au genou signalée"}}], "stop_reason": "tool_use"}
    elif is_result: out = {"content": [{"type": "text", "text": "C'est fait : je remplace l'exercice par le pont fessier cette semaine, et Antoine est prévenu."}], "stop_reason": "end_turn"}
    elif "genou" in texts and b.get("tools"):
        names = [t["name"] for t in b["tools"]]
        out = {"content": [{"type": "text", "text": "Je regarde ton programme."}, {"type": "tool_use", "id": "toolu_test1", "name": "remplacer_exercice", "input": {"exercice_actuel": "squat_goblet", "nouvel_exercice": "pont_fessier", "seance": "toutes", "raison": "Gêne au genou signalée"}}] if "remplacer_exercice" in names else [{"type": "text", "text": "Allège."}], "stop_reason": "tool_use" if "remplacer_exercice" in names else "end_turn"}
    else: out = {"content": [{"type": "text", "text": "Ce soir, vise une assiette avec des protéines, des légumes et un féculent."}], "stop_reason": "end_turn"}
    await route.fulfill(status=200, headers=CORS, body=json.dumps({"ok": True, **out}))

async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # visiteur : bouton « Me contacter » de la page d'accueil
        V = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
        await A.add_init_script("window.__TIMER_SPEED = 40;")
        await A.route(RELAY + "/**", relay)
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse"); await co.wait_for_timeout(800)
        await btn(co, "Offres & réglages", exact=True)
        ok(await has(co, "Pas encore installé sur le site"), "réglages : coach IA pas encore installé")
        await co.fill("#st-p", "06 12 34 56 78"); await co.fill("#st-e", "antoine@test.fr")
        await co.fill("#pay-relay", RELAY)
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(700)
        await co.locator(".alert", has_text="État sur le site").get_by_role("button", name="Revérifier").click(); await co.wait_for_timeout(800)
        ok(await has(co, "Actif sur le site") and await has(co, "Gratuit : tes clients"), "réglages : coach IA gratuit actif (relais avec Workers AI)")
        await shot(co, "reglages_ia")
        await btn(co, "Codes & essais", exact=True)
        await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
        await co.fill("#cd-code", "SUIVI-SITE56789"); await btn(co, "Créer le code"); await co.wait_for_timeout(400)

        v = await A.new_page(); hook(v, "visiteur"); await v.set_viewport_size({"width": 390, "height": 844})  # même base simulée, onglet non connecté
        await v.goto(URL); await v.wait_for_timeout(1500)
        await v.locator(".l-hero").get_by_role("button", name="Me contacter").click(); await v.wait_for_timeout(400)
        ok(await v.locator(".modal").get_by_role("button", name="Créer mon compte et t'écrire").count() == 1 and await v.locator("a[href^='tel:'], a[href*='wa.me'], a[href^='mailto:']").count() == 0 and "06 12 34 56 78" not in await v.inner_text("body"), "page d'accueil : Me contacter mène à la messagerie (aucun appel ni numéro)")
        await shot(v, "accueil_contact")
        await v.locator(".modal").get_by_role("button", name="Créer mon compte et t'écrire").click(); await v.wait_for_timeout(400)
        ok(await v.locator("#au-e").count() == 1, "le bouton ouvre la création de compte")

        c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
        await signup(c, "nina@test.fr"); await onboard(c, "Nina Site")
        uid = await c.evaluate("firebase.auth().currentUser.uid")
        await c.fill("#pu-code", "SUIVI-SITE56789"); await btn(c, "Appliquer", exact=True); await c.wait_for_timeout(500)
        await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Activer mon accès offert"); await c.wait_for_timeout(1500)
        ok(await has(c, "prochaine séance", 8000), "site : accès Suivi par code")
        # messagerie
        await c.locator("header.c-top .msgbtn").click(); await c.wait_for_timeout(500)
        await c.fill("#msg-in-client", "Bonjour, je peux décaler ma séance B à dimanche ?")
        await btn(c, "Envoyer", exact=True); await c.wait_for_timeout(900)
        await c.set_input_files("#msg-file-client", HERE + "/test/photo_repas.jpg"); await c.wait_for_timeout(800)
        await btn(c, "Envoyer", exact=True); await c.wait_for_timeout(900)
        mk = await keys(c, f"clients/{uid}/messages/")
        ok(len(mk) == 2, "site : 2 messages enregistrés dans Firestore (règles acceptées)")
        prof = await db(c, f"clients/{uid}")
        ok(prof and prof["sum"].get("msgAt"), "site : résumé du client mis à jour")
        await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(300)
        await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1800)
        ok(await co.locator(".side-nav .nav-n").count() == 1, "site coach : message non lu dans le menu")
        await co.locator(".side-nav button", has_text="Messages").click(); await co.wait_for_timeout(400); await co.locator(".inbox-row", has_text="Nina Site").click(); await co.wait_for_timeout(1200)
        ok(await has(co, "décaler ma séance B") and await co.locator(".msg-img img").count() == 1, "site coach : message et photo")
        await co.fill("#msg-in-coach", "Oui, sans problème : garde 48 h entre B et C.")
        await btn(co, "Envoyer", exact=True); await co.wait_for_timeout(900)
        ok(bool((await db(co, "coachnotes/_inbox") or {}).get("seen", {}).get(uid)), "site coach : lecture mémorisée (règles acceptées)")
        await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1800)
        ok(await c.locator(".msgbtn-n").count() == 1, "site client : réponse non lue")
        await c.locator(".msgbtn").click(); await c.wait_for_timeout(800)
        ok(await has(c, "garde 48 h entre B et C"), "site client : réponse du coach")
        await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(600)
        ok(bool(await db(c, f"clients/{uid}/msgstate/seen")), "site client : lecture mémorisée")
        # coach IA sur le site, par le relais
        ok(await c.locator("nav.tabbar .tab-ia").count() == 1, "site : bouton Coach IA dans la barre (relais actif)")
        await c.locator("nav.tabbar .tab-ia").click(); await c.wait_for_timeout(600)
        ok(await has(c, "intelligence artificielle (Gemma, de Google, exécutée par Cloudflare)"), "site : le client sait quelle IA lui répond (règlement IA)")
        await c.fill("#chat-in", "J'ai mal au genou sur le goblet squat"); await c.keyboard.press("Enter")
        for _ in range(30):
            if await c.get_by_text("pont fessier cette semaine").count(): break
            await c.wait_for_timeout(300)
        ok(await has(c, "pont fessier cette semaine", 2000), "site : réponse du coach IA après un outil (remplacement)")
        aik = await keys(c, f"clients/{uid}/ai/")
        adj = [await db(c, k) for k in aik]
        ok(any(a and a.get("kind") == "subst" for a in adj), "site : ajustement appliqué par l'outil dans Firestore", adj)
        ok(calls and all(x["auth"].startswith("Bearer ") and len(x["auth"]) > 100 for x in calls), "jeton Firebase envoyé au relais")
        ok(any(any(blk.get("type") == "tool_result" for blk in (m.get("content") if isinstance(m.get("content"), list) else [])) for x in calls for m in x["body"]["messages"]), "résultat de l'outil renvoyé à Claude")
        ok(all("model" not in x["body"] for x in calls), "le site ne choisit pas le modèle (imposé par le relais)")
        await shot(c, "coach_ia_site")
        print("    taille des demandes IA (caractères) :", [len(json.dumps(x["body"], ensure_ascii=False)) for x in calls])
        await c.locator(".p-top .back").first.click(); await c.wait_for_timeout(400)
        # photo du repas
        await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(500)
        await c.get_by_role("radio", name="Femme").click()
        await c.fill("#nu-a", "31"); await c.fill("#nu-h", "168"); await c.fill("#nu-w", "64")
        await btn(c, "Enregistrer mon objectif"); await c.wait_for_timeout(600)
        ok(await c.locator("button.addbtn", has_text="Photo du repas").count() == 1, "site : bouton Photo du repas")
        await c.locator("button.addbtn", has_text="Photo du repas").click()
        await c.set_input_files("#meal-photo", HERE + "/test/photo_repas.jpg"); await c.wait_for_timeout(300)
        await btn(c, "Analyser la photo"); await c.wait_for_timeout(1500)
        ok(await has(c, "Poulet, riz et brocolis", 4000), "site : photo du repas analysée")
        img_call = [x for x in calls if any(blk.get("type") == "image" for m in x["body"]["messages"] if isinstance(m.get("content"), list) for blk in m["content"])]
        ok(img_call and img_call[-1]["body"]["messages"][-1]["content"][0]["source"]["media_type"] == "image/jpeg" and len(img_call[-1]["body"]["messages"][-1]["content"][0]["source"]["data"]) < 600000, "photo envoyée réduite en JPEG")
        await shot(c, "photo_repas_site")
        await btn(c, "Ajouter au journal"); await c.wait_for_timeout(700)
        fk = await keys(c, f"clients/{uid}/food/")
        ok(len(fk) == 1, "site : repas ajouté au journal")
        st = [await c.evaluate("window.__fsStats.errors"), await co.evaluate("window.__fsStats.errors")]
        den = [await c.evaluate("window.__fsStats.denied"), await co.evaluate("window.__fsStats.denied")]
        ok(not any(st) and not any(den), "aucune erreur ni écriture refusée", [st, den])
        await b.close()
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    for f in fails: print("ÉCHEC :", f)
    print("\n".join(errs[:60]) or "aucune erreur console")
asyncio.run(run())
