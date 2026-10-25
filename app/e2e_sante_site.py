"""Site : envoi automatique depuis le téléphone (Raccourci iPhone ou Health Connect Webhook) par le relais du coach
(relais simulé), récupération dans le dossier, dépense du jour en nutrition, table Ciqual chargée depuis ciqual.json,
précision du questionnaire santé et records avec les règles Firestore réelles."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, re, urllib.request
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8123/index.html"
EMU = "http://127.0.0.1:9099"
RELAY = "https://relais-test.example.workers.dev"
RACC = "https://www.icloud.com/shortcuts/0a1b2c3d4e5f60718293a4b5c6d7e8f9"
IPHONE = "Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1' }); window.__openUrl = (u) => { window.__opened = (window.__opened || []).concat([u]); };"
OUT = HERE + "/shots/sante_site"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
PW = "motdepasse123"
TODAY = datetime.date.today()
YDAY = TODAY - datetime.timedelta(days=1)
calls = []
STATE = {"cle": None, "t": "2026-10-24T19:00:00.000Z"}
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
async def signup(page, email):
    await page.goto(URL)
    await btn(page, "Créer mon compte", exact=True)
    await page.fill("#au-e", email); await page.fill("#au-p", PW)
    await page.locator(".modal").get_by_role("button", name="Créer mon compte").click()
    await page.wait_for_timeout(1200)
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization, x-cle", "access-control-allow-methods": "GET, POST, OPTIONS", "content-type": "application/json"}
async def relay(route):
    req = route.request
    if req.method == "OPTIONS": await route.fulfill(status=204, headers=CORS); return
    u = req.url.split("?")[0]
    calls.append({"url": u, "auth": req.headers.get("authorization", ""), "method": req.method, "body": req.post_data})
    def out(o, st=200): return route.fulfill(status=st, headers=CORS, body=json.dumps(o))
    if u.endswith("/ia/etat"): await out({"ok": True, "ia": False, "quota": True}); return
    if u.endswith("/sante/etat"): await out({"ok": True, "sante": True}); return
    if not req.headers.get("authorization", "").startswith("Bearer ") or len(req.headers.get("authorization", "")) < 40: await out({"ok": False, "code": "connexion"}, 401); return
    if u.endswith("/sante/cle"):
        b = json.loads(req.post_data or "{}")
        if not STATE["cle"] or b.get("nouvelle"): STATE["cle"] = ("CleSecrete" if not STATE["cle"] else "CleNouvelle") + "0123456789abcd"
        await out({"ok": True, "cle": STATE["cle"], "url": RELAY + "/sante/in?k=" + STATE["cle"]}); return
    if u.endswith("/sante/out"):
        await out({"ok": True, "t": STATE["t"], "jours": {TODAY.isoformat(): {"pas": 14500, "kcal": 980, "kcalTot": 2900, "sommeil": 7.4, "fcr": 51, "vfc": 66, "poids": 77.2, "src": "android", "t": STATE["t"]},
                                                           YDAY.isoformat(): {"pas": 9000, "kcal": 600, "src": "android", "t": STATE["t"]}}}); return
    if u.endswith("/sante/revoquer"): STATE["cle"] = None; await out({"ok": True}); return
    if u.endswith("/sante/effacer"): await out({"ok": True}); return
    await out({"ok": False, "code": "inconnu"}, 404)

async def run():
    emu("/emulator/v1/projects/demo-prepa/accounts", "DELETE")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
        await A.route(RELAY + "/**", relay)
        ciq_req = []
        A.on("request", lambda r: ciq_req.append(r.url) if r.url.endswith("ciqual.json") else None)
        co = await A.new_page(); hook(co, "coach")
        await co.goto(URL); await co.evaluate("window.__fakefs.reset()")
        await signup(co, "coach@test.fr")
        link = [c for c in emu("/emulator/v1/projects/demo-prepa/oobCodes")["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
        urllib.request.urlopen(link).read()
        await btn(co, "J'ai confirmé mon adresse"); await co.wait_for_timeout(800)
        await btn(co, "Offres & réglages", exact=True)
        await co.fill("#st-p", "06 12 34 56 78"); await co.fill("#st-e", "antoine@test.fr"); await co.fill("#pay-relay", RELAY)
        await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(900)
        ok(await has(co, "Envoi automatique prêt : ton relais a son stockage."), "coach : relais avec stockage reconnu (carte Montres et téléphones)")
        await co.fill("#sante-rac", "https://www.icloud.com/shortcuts/pasbon"); await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(400)
        ok(await has(co, "Lien du raccourci invalide"), "coach : lien de raccourci invalide refusé")
        await co.fill("#sante-rac", RACC); await co.get_by_role("button", name="Enregistrer", exact=True).first.click(); await co.wait_for_timeout(700)
        st = await db(co, "settings/app") or {}
        ok((st.get("sante") or {}).get("raccourci") == RACC, "coach : lien du raccourci iPhone tout prêt enregistré")
        await co.locator("#sante-rac").scroll_into_view_if_needed(); await shot(co, "coach_reglages_montres")
        await btn(co, "Codes & essais", exact=True)
        await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
        await co.fill("#cd-code", "SANTE-SITE5678"); await btn(co, "Créer le code"); await co.wait_for_timeout(400)

        c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
        await signup(c, "max@test.fr")
        await btn(c, "Commencer mon inscription")
        await c.fill("#ob-name", "Max Site"); await c.fill("#ob-by", "1991"); await c.fill("#ob-h", "181"); await c.fill("#ob-w", "78"); await c.get_by_role("radio", name="Football").click()
        await btn(c, "Continuer")
        await c.get_by_role("radio", name="Régional", exact=True).click(); await c.get_by_role("radio", name="Plus de 2 ans", exact=True).click()
        ok(await c.locator("#rec-yoyo").count() == 1 and await c.locator("#rec-vma").count() == 1, "football : Yo-Yo et VMA proposés en records")
        await c.fill("#rec-vma", "17"); await c.fill("#rec-squat", "110"); await c.fill("#rec-squat-r", "5")
        await btn(c, "Continuer")
        await c.locator("button.pcard").first.click(); await btn(c, "Continuer")
        for i in range(await c.locator(".yn").count()):
            await c.locator(".yn").nth(i).get_by_role("radio", name="Oui" if i == 4 else "Non").click()
        ok(not await c.get_by_role("button", name="Continuer", exact=True).is_enabled(), "« oui » au traitement : précision obligatoire")
        await c.fill("#ob-sd-4", "Ventoline en cas de besoin (asthme d'effort)")
        await btn(c, "Continuer"); await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(900)
        uid = await c.evaluate("firebase.auth().currentUser.uid")
        prof = await db(c, "clients/" + uid) or {}
        ok(prof.get("height") == 181 and prof.get("weight") == 78 and (prof.get("records") or {}).get("vma") == {"v": 17} and (prof.get("screeningDetails") or [""] * 7)[4].startswith("Ventoline"), "site : profil, records et précision enregistrés (règles réelles)", prof)
        await c.fill("#pu-code", "SANTE-SITE5678"); await btn(c, "Appliquer", exact=True); await c.wait_for_timeout(500)
        await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Activer mon accès offert"); await c.wait_for_timeout(1500)
        ok(await has(c, "prochaine séance", 8000), "site : accès actif")

        # ---------- santé : envoi automatique ----------
        await c.get_by_role("button", name="Progrès").first.click(); await c.wait_for_timeout(400)
        await c.locator("button.nutri-mini", has_text="Ma santé du jour").click(); await c.wait_for_timeout(600)
        card = c.locator(".card", has_text="Connecter ma montre ou mon téléphone")
        ok(await card.get_by_role("button", name="Créer mon lien personnel").count() == 1, "relais avec stockage : envoi automatique proposé")
        await card.get_by_role("button", name="Créer mon lien personnel").click(); await c.wait_for_timeout(900)
        txt = await card.inner_text()
        ok(await c.locator("#sante-url").inner_text() == RELAY + "/sante/in?k=CleSecrete0123456789abcd" and await card.get_by_role("button", name="Copier mon lien").count() == 1, "lien personnel affiché, avec bouton Copier")
        prof = await db(c, "clients/" + uid) or {}
        ok((prof.get("santeSync") or {}).get("on") is True, "profil : envoi automatique activé")
        ok("Installer le raccourci" in txt and "colle ton lien" in txt and "Exécuter immédiatement" in txt and "Est ouverte" in txt, "iPhone : raccourci tout prêt à installer, automatisation à l'ouverture d'une app")
        await shot(c, "sante_iphone", full=True)
        await card.get_by_role("radio", name="Android").click(); await c.wait_for_timeout(300)
        txt = await card.inner_text()
        ok("Health Connect Webhook" in txt and "Health Connect" in txt and "8 h et 21 h" in txt, "Android : Health Connect Webhook expliqué")
        await shot(c, "sante_android", full=True)
        await card.get_by_role("button", name="Synchroniser maintenant").click(); await c.wait_for_timeout(1200)
        s = await db(c, f"clients/{uid}/sante/{TODAY.isoformat()}") or {}
        sy = await db(c, f"clients/{uid}/sante/{YDAY.isoformat()}") or {}
        ok(s.get("pas") == 14500 and s.get("kcal") == 980 and s.get("kcalTot") == 2900 and s.get("fcr") == 51 and s.get("src") == "android" and s.get("syncT") == STATE["t"] and sy.get("pas") == 9000, "synchroniser : valeurs du téléphone rangées dans le dossier (aujourd'hui et hier)", s)
        ok(await has(c, re.compile("Reçu :|Déjà à jour")), "synchroniser : confirmation")
        auths = [x for x in calls if "/sante/out" in x["url"]]
        ok(auths and auths[-1]["auth"].startswith("Bearer ey"), "récupération avec le jeton de connexion du client")
        # deuxième récupération : rien de nouveau, rien n'est réécrit
        await c.evaluate(f"window.__fakefs.load()['clients/{uid}/sante/{TODAY.isoformat()}'].pas")
        await card.get_by_role("button", name="Synchroniser maintenant").click(); await c.wait_for_timeout(900)
        ok(await has(c, "Déjà à jour"), "deuxième synchronisation : rien de nouveau")
        # correction à la main conservée tant que le téléphone n'envoie rien de nouveau
        await c.fill("#sa-pas", "15000"); await c.locator(".card", has_text="Ma journée").get_by_role("button", name="Enregistrer").click(); await c.wait_for_timeout(600)
        await c.evaluate("localStorage.setItem('sante_pull', '0')"); await c.reload(); await c.wait_for_timeout(2500)
        s = await db(c, f"clients/{uid}/sante/{TODAY.isoformat()}") or {}
        ok(s.get("pas") == 15000, "correction à la main gardée (pas de nouvel envoi du téléphone)", s)
        STATE["t"] = "2026-10-24T21:00:00.000Z"
        await c.evaluate("localStorage.setItem('sante_pull', '0')"); await c.reload(); await c.wait_for_timeout(2500)
        s = await db(c, f"clients/{uid}/sante/{TODAY.isoformat()}") or {}
        ok(s.get("pas") == 14500 and s.get("syncT") == STATE["t"], "nouvel envoi du téléphone : récupéré tout seul à l'ouverture", s)
        # la suite côté client se fait comme sur un iPhone
        await c.add_init_script(IPHONE); await c.reload(); await c.wait_for_timeout(1500)

        # ---------- nutrition : dépense du jour avec les données du téléphone ----------
        await c.get_by_role("button", name="Nutrition").first.click(); await c.wait_for_timeout(500)
        ok(await c.input_value("#nu-h") == "181", "objectif : taille reprise du profil")
        await c.get_by_role("radio", name="Homme").click(); await c.get_by_role("radio", name="Garder mon poids").click()
        await btn(c, "Enregistrer mon objectif"); await c.wait_for_timeout(800)
        ec = c.locator(".card", has_text="Ma dépense du jour")
        t = await ec.inner_text()
        ok("Calories actives de ta montre" in t and "980" in t and "14" in t, "dépense du jour : calories actives et pas du téléphone", t)
        ok(await has(c, "Bonus d'activité"), "bonus d'activité calculé avec les données du téléphone")
        ok(await ec.get_by_role("button", name="Envoyer depuis mon iPhone").count() == 1, "iPhone : bouton « Envoyer depuis mon iPhone » dans la dépense du jour")
        await shot(c, "nutrition_site", full=True)
        # table Ciqual chargée depuis le site
        await c.locator("button.addbtn", has_text="Saisir").click(); await c.wait_for_timeout(300)
        await c.fill("#fd-q", "lentille corail"); await c.wait_for_timeout(1200)
        ok(await c.locator(".sugg button", has_text="Lentille corail").count() >= 1 and any(u.endswith("/ciqual.json") for u in ciq_req), "site : table Ciqual chargée depuis ciqual.json et recherche active")
        await c.keyboard.press("Escape"); await c.wait_for_timeout(300)

        # ---------- arrêt ----------
        await c.get_by_role("button", name="Progrès").first.click(); await c.wait_for_timeout(400)
        await c.locator("button.nutri-mini", has_text="Ma santé du jour").click(); await c.wait_for_timeout(600)
        card = c.locator(".card", has_text="Connecter ma montre ou mon téléphone")
        ok(await has(c, "Dernière réception"), "date de la dernière réception affichée")
        inst = card.get_by_role("link", name="Installer le raccourci")
        ok(await inst.count() == 1 and await inst.get_attribute("href") == RACC and "Horloge" in await card.inner_text() and "verrouillé" in await card.inner_text(), "iPhone : raccourci tout prêt du coach, déclenché à l'ouverture d'une app (Santé protégée quand l'iPhone est verrouillé)")
        await shot(c, "sante_iphone_pret", full=True)
        n0 = len([x for x in calls if "/sante/out" in x["url"]])
        await card.get_by_role("button", name="Envoyer depuis mon iPhone").click(); await c.wait_for_timeout(300)
        opened = await c.evaluate("window.__opened || []")
        ok(opened == ["shortcuts://run-shortcut?name=Sant%C3%A9%20Antoine"], "iPhone : le bouton lance le raccourci « Santé Antoine »", opened)
        await c.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await c.wait_for_timeout(900)
        ok(len([x for x in calls if "/sante/out" in x["url"]]) > n0, "retour dans l'application : valeurs récupérées tout de suite")
        await card.get_by_role("button", name="Arrêter").click(); await c.wait_for_timeout(800)
        prof = await db(c, "clients/" + uid) or {}
        ok((prof.get("santeSync") or {}).get("on") is False and any("/sante/revoquer" in x["url"] for x in calls), "arrêter : lien supprimé au relais, envoi automatique coupé")

        # ---------- coach : précision et santé ----------
        await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
        await co.get_by_text("Max Site").first.click(); await co.wait_for_timeout(800)
        ok(await has(co, "Ventoline en cas de besoin"), "coach : précision du questionnaire santé")
        await co.get_by_role("radio", name="Santé", exact=True).click(); await co.wait_for_timeout(500)
        ok(await has(co, "Calories actives") and await has(co, "android"), "coach : calories actives et source Android dans la santé du client")
        await shot(co, "coach_sante", full=True)
        # ---------- coach : suppression du client, valeurs en attente au relais effacées aussi ----------
        await co.get_by_role("radio", name="Notes", exact=True).click(); await co.wait_for_timeout(400)
        await co.fill("#del-c", "SUPPRIMER"); await co.get_by_role("button", name="Supprimer définitivement").click(); await co.wait_for_timeout(1500)
        ef = [x for x in calls if x["url"].endswith("/sante/effacer")]
        ok(ef and json.loads(ef[-1]["body"] or "{}").get("uid") == uid and ef[-1]["auth"].startswith("Bearer ey"), "coach : suppression du client → effacement au relais (avec son jeton de coach)")
        await b.close()
    real = [e for e in errs if "favicon" not in e]
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    if real: print("ERREURS CONSOLE :\n" + "\n".join(real[:20]))
    raise SystemExit(1 if fails or real else 0)
asyncio.run(run())
