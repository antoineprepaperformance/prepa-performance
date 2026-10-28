"""Personnalisation et thèmes de saison (version Claude, mock) : apparence (thème, couleur, taille du texte) enregistrée
sur le compte et réappliquée, blocs de la page du jour, consignes simples ou détaillées selon le profil, « À faire aujourd'hui »,
événements (Noël, Pâques, compétitions), défi et badge, réglages du coach, bandeau de la page d'accueil du site."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, subprocess, sys, time, os, json, datetime, re, urllib.request
from playwright.async_api import async_playwright
PORT = 8771
OUT = HERE + "/shots/perso"; os.makedirs(OUT, exist_ok=True)
URL = f"http://localhost:{PORT}/index.html"
SITE = "http://127.0.0.1:8123/index.html"
TODAY = datetime.date.today()
errs, res = [], {"ok": 0, "ko": 0}
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))
async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def attrs(page):
    return await page.evaluate("(() => { const e = document.documentElement; return { theme: e.getAttribute('data-theme'), accent: e.getAttribute('data-accent'), fs: e.getAttribute('data-fs'), event: e.getAttribute('data-event') }; })()")
async def blocks(page): return await page.evaluate("[...document.querySelectorAll('.today .tb')].map((e) => e.dataset.block)")

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.clear()"); await co.reload(); await co.wait_for_timeout(800)

            # ---------- calendrier des événements (fonctions pures) ----------
            r = await co.evaluate("""() => { const id = (d, s) => { const e = saisonActive(d, s); return e ? e.ev.id + "|" + e.key : null; };
              return { paques27: easterOf(2027), paques28: easterOf(2028), hal: id("2026-10-28"), nov: id("2026-11-15"), avent: id("2026-12-10"), an: id("2027-01-02"),
                hand: id("2027-01-20"), tournoi: id("2027-02-20"), pq: id("2027-03-20"), cdm: id("2027-10-15"), halcdm: id("2027-10-25"),
                off: id("2026-12-10", { saisons: { off: { noel: true } } }), up: saisonUpcoming("2026-10-28", 13).map((e) => e.ev.id),
                cnt: saisonCount(saisonActive("2026-12-10"), "2026-12-10"), jour: saisonCount(saisonActive("2027-10-15"), "2027-11-13") }; }""")
            ok(r["paques27"] == "2027-03-28" and r["paques28"] == "2028-04-16", "date de Pâques calculée (2027 : 28 mars, 2028 : 16 avril)", r)
            ok(r["hal"] == "halloween|halloween-2026" and r["nov"] is None and r["avent"] == "noel|noel-2026" and r["an"] == "nouvelan|nouvelan-2026", "fêtes : Halloween, rien mi-novembre, Avent, Nouvel an (édition qui commence fin 2026)", r)
            ok(r["hand"].startswith("hand27") and r["tournoi"].startswith("tournoi27") and r["pq"].startswith("paques") and r["cdm"].startswith("cdm27"), "compétitions de 2027 (handball, rugby d'hiver, rugby mondial) et Pâques", r)
            interdits = ["Six Nations", "Top 14", "Tour de France", "Grande Boucle", "Coupe du monde", "Coupe d'Europe", "Champions Cup", "Mondial", "Mondiaux", "Bleus", "équipe de France",
                         "Allemagne", "Australie", "Pékin", "Édimbourg", "Lyon", "Stade de France", "Grand Chelem", "Bouclier", "Brennus", "maillot jaune"]
            txt = await co.evaluate("JSON.stringify(SAISONS.filter((e) => e.kind === 'sport'))")
            vus = [w for w in interdits if w in txt]  # majuscules comprises : « mondial » reste un mot courant
            ok(not vus, "compétitions annoncées sans nom officiel, équipe, pays ni ville", vus)
            ok(r["halcdm"].startswith("cdm27"), "deux événements en même temps : la compétition passe avant Halloween", r)
            ok(r["off"] is None, "événement coupé par le coach : plus de thème", r)
            ok(r["up"][:4] == ["halloween", "noel", "nouvelan", "hand27"] and "tournoi27" in r["up"] and "cdm27" in r["up"] and r["up"].count("halloween") == 2, "à venir sur 13 mois, dans l'ordre des dates", r["up"])
            ok(r["cnt"] == "J-15 avant Noël" and r["jour"] == "C'est le jour J", "compte à rebours (J-15 avant Noël, jour J)", r)

            # ---------- consignes simples (fonctions pures) ----------
            r = await co.evaluate("""() => [doseSimple({ sets: 3, reps: 10, int: "RIR 2-3", rest: "75 s" }), doseSimple({ sets: 1, reps: "8 / côté", int: "RIR 1" }),
              doseSimple({ sets: 4, reps: "5", int: "RIR 0" }), doseSimple({ sets: 0, text: "30 min footing" }), doseSimple({ sets: 5, reps: "1 min rapide" })]""")
            ok(r[0] == {"main": "3 séries de 10", "chips": ["garde 2 à 3 répétitions en réserve", "repos 75 s"]}, "dose simple : 3 séries de 10, réserve, repos", r[0])
            ok(r[1]["main"] == "1 série de 8 par côté" and r[1]["chips"] == ["garde 1 répétition en réserve"], "dose simple : 1 série par côté", r[1])
            ok(r[2]["chips"] == ["va jusqu'au bout de la série"] and r[3]["main"] == "30 min footing" and r[4]["main"] == "5 × 1 min rapide", "dose simple : RIR 0, dose écrite à la main gardée telle quelle", r)

            # ---------- aperçu du coach : athlète expert, puis débutante ----------
            await co.goto(URL + "?as=owner&saison=2026-12-10"); await co.wait_for_timeout(900)
            await btn(co, "Aperçu côté client"); await co.wait_for_timeout(900)
            ban = co.locator("section.saison")
            ok(await ban.count() == 1 and "Le défi de l'Avent" in await ban.inner_text() and "j-15 avant noël" in (await ban.inner_text()).lower(), "aperçu : bandeau de Noël avec compte à rebours", await ban.inner_text() if await ban.count() else "")
            ok((await attrs(co))["event"] == "noel" and await co.locator(".saison-deco").count() == 1, "aperçu : couleurs et décorations de Noël")
            await ban.get_by_role("button", name="Voir le défi").click(); await co.wait_for_timeout(300)
            ok(await co.locator(".modal .avent .av-d").count() == 24 and await co.locator(".modal .av-d.today").count() == 1, "défi de l'Avent : calendrier de 24 cases, aujourd'hui repéré")
            await co.keyboard.press("Escape"); await co.wait_for_timeout(200)
            await ban.get_by_role("button", name="J'ai bougé aujourd'hui").click(); await co.wait_for_timeout(300)
            ok(await co.get_by_text("Aperçu : la case n'est pas enregistrée.").count() >= 1, "aperçu : la case n'est pas enregistrée")
            await co.locator("button.next").first.click(); await co.wait_for_timeout(700)
            t = await co.inner_text("main") if await co.locator("main").count() else await co.inner_text("body")
            ok(await co.get_by_role("button", name="Comprendre les consignes").count() == 1 and "RAMP" in t, "athlète expert : vocabulaire technique et lien vers le glossaire", t[:300])
            await btn(co, "Comprendre les consignes"); await co.wait_for_timeout(300)
            g = await co.locator(".modal").inner_text()
            ok("RIR 2" in g and "VMA" in g and "Tempo 3-0-X-0" in g, "glossaire des consignes", g[:200])
            await co.keyboard.press("Escape"); await co.wait_for_timeout(200)
            await co.screenshot(path=f"{OUT}/01_seance_expert.png")
            # athlète confirmé qui préfère les mots simples : une seule question sur la forme du jour
            await co.get_by_role("button", name="Retour").first.click(); await co.wait_for_timeout(400)
            await co.get_by_role("button", name="Mon profil").click(); await co.wait_for_timeout(400)
            await co.locator("#ap-lang").get_by_role("radio", name="Simple").click(); await co.wait_for_timeout(300)
            await co.locator("nav.tabbar button", has_text="Aujourd'hui").click(); await co.wait_for_timeout(400)
            await co.locator("button.next").first.click(); await co.wait_for_timeout(700)
            t = await co.inner_text("body")
            ok("Comment tu te sens aujourd'hui ?" in t and await co.get_by_role("button", name="Comprendre les consignes").count() == 0, "athlète en mode simple : une seule question sur la forme du jour", t[:400])
            await btn(co, "Autre exemple"); await co.wait_for_timeout(900)
            if await co.locator("button.next").count(): await co.locator("button.next").first.click(); await co.wait_for_timeout(700)
            t = await co.inner_text("body")
            ok(await co.get_by_role("button", name="Comprendre les consignes").count() == 0 and re.search(r"\d séries? de \d", t) and "RIR" not in t, "débutante : consignes en mots simples (séries, repos), sans RIR", t[:500])
            ok("Échauffement RAMP" not in t and " UA" not in t, "débutante : ni « RAMP » ni charge en UA", t[:300])
            await co.screenshot(path=f"{OUT}/02_seance_simple.png")
            await btn(co, "Revenir à l'espace coach"); await co.wait_for_timeout(500)

            # ---------- réglages du coach : couper un événement, message personnalisé ----------
            await btn(co, "Offres & réglages", exact=True); await co.wait_for_timeout(400)
            card = co.locator(".card", has_text="Thèmes et défis de saison")
            ok(await card.count() == 1 and await card.locator(".saisons-l li").count() >= 6, "coach : liste des événements à venir", await card.locator(".saisons-l li").count())
            await card.locator("li", has_text="Halloween").first.get_by_role("button", name="Message").click(); await co.wait_for_timeout(200)
            await co.fill("#sa-msg", "Séance spéciale citrouille samedi !"); await btn(co, "OK", exact=True)
            await card.get_by_role("switch", name="Activer : Noël").click()
            await btn(co, "Enregistrer les thèmes"); await co.wait_for_timeout(400)
            s = (await mdb(co, "settings/app") or {}).get("saisons") or {}
            ok(s.get("off") == {"noel": True} and s.get("msg", {}).get("halloween") == "Séance spéciale citrouille samedi !", "coach : Noël coupé et message d'Halloween enregistrés", s)

            # ---------- client débutant ----------
            await btn(co, "Codes & essais", exact=True)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "PERSO-TEST234"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(700)
            await btn(c, "Commencer mon inscription"); await c.fill("#ob-name", "Julie Reprise"); await c.fill("#ob-by", "1985"); await c.fill("#ob-h", "165"); await c.fill("#ob-w", "68"); await btn(c, "Continuer")
            await c.get_by_role("radio", name="Pas de compétition").click(); await c.get_by_role("radio", name="Moins de 6 mois").click(); await btn(c, "Continuer")
            await c.locator("button.pcard", has_text="Perte de poids").click(); await btn(c, "Continuer")
            for i in range(await c.locator(".yn").count()): await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await btn(c, "Continuer"); await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(600)
            await c.fill("#pu-code", "PERSO-TEST234"); await btn(c, "Appliquer", exact=True)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await c.bring_to_front(); await c.goto(URL + "?as=p1&saison=2026-10-25"); await c.wait_for_timeout(1300)
            ok(await c.locator("button.next").count() >= 1, "client : programme actif")
            lm = await c.evaluate("langMode(null, JSON.parse(localStorage.getItem('__mockdb'))['clients/u_p1'])")
            ok(lm == "simple", "débutante en remise en forme : consignes simples par défaut", lm)
            todo = c.locator("section.todo")
            ok(await todo.count() == 1 and "À faire aujourd'hui" in await todo.inner_text(), "page du jour : « À faire aujourd'hui »", await todo.inner_text() if await todo.count() else "")
            ban = c.locator("section.saison")
            bt = await ban.inner_text() if await ban.count() else ""
            ok("Séance spéciale citrouille samedi !" in bt and "Défi des citrouilles" in bt, "Halloween : message du coach et défi des citrouilles", bt)
            ok((await attrs(c))["event"] == "orange", "Halloween : couleur orange")
            await c.screenshot(path=f"{OUT}/03_jour_halloween.png", full_page=True)
            await c.goto(URL + "?as=p1&saison=2026-12-10"); await c.wait_for_timeout(1200)
            ok(await c.locator("section.saison").count() == 0 and (await attrs(c))["event"] is None, "Noël coupé par le coach : ni bandeau ni couleurs")
            # le coach le remet
            await co.bring_to_front(); await btn(co, "Offres & réglages", exact=True); await co.wait_for_timeout(400)
            card = co.locator(".card", has_text="Thèmes et défis de saison")
            await card.get_by_role("switch", name="Activer : Noël").click(); await btn(co, "Enregistrer les thèmes"); await co.wait_for_timeout(400)
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1300)
            ban = c.locator("section.saison")
            ok(await ban.count() == 1 and "0 / 20 jours" in await ban.inner_text(), "Noël remis : défi de l'Avent à 0 / 20", await ban.inner_text() if await ban.count() else "")
            await ban.get_by_role("button", name="J'ai bougé aujourd'hui").click(); await c.wait_for_timeout(500)
            prof = await mdb(c, "clients/u_p1") or {}
            ok((prof.get("defis") or {}).get("noel-2026", {}).get("days") == ["2026-12-10"], "case cochée : journée enregistrée pour le défi", prof.get("defis"))
            ok("1 / 20 jours" in await ban.inner_text() and await ban.get_by_text("✓ Aujourd'hui compte").count() == 1, "défi : 1 / 20, aujourd'hui compte", await ban.inner_text())
            # défi réussi : 20 jours → badge
            days = [f"2026-12-{d:02d}" for d in range(1, 21)]  # 20 jours, comptés jusqu'au 22 décembre
            await c.evaluate("(days) => { const db = JSON.parse(localStorage.getItem('__mockdb')); const p = db['clients/u_p1']; p.defis = { 'noel-2026': { days, ev: 'noel' } }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", days)
            await c.goto(URL + "?as=p1&saison=2026-12-22"); await c.wait_for_timeout(1500)
            prof = await mdb(c, "clients/u_p1") or {}
            ok((prof.get("defis") or {}).get("noel-2026", {}).get("done") == "2026-12-22" and "débloqué" in await c.locator("section.saison").inner_text(), "défi réussi : enregistré une fois, badge débloqué", prof.get("defis"))
            bb = await c.evaluate("badgesOf ? JSON.stringify(saisonBadges(JSON.parse(localStorage.getItem('__mockdb'))['clients/u_p1'])) : ''")
            ok("Étoile de l'Avent" in bb, "badge « Étoile de l'Avent » ajouté aux badges", bb)

            # ---------- apparence ----------
            await c.get_by_role("button", name="Mon profil").click(); await c.wait_for_timeout(500)
            ap = c.locator(".card", has_text="Apparence et affichage")
            ok(await ap.count() == 1, "profil : carte « Apparence et affichage »")
            await ap.locator("#ap-theme").get_by_role("radio", name="Clair").click(); await c.wait_for_timeout(250)
            await ap.get_by_role("radio", name="Vert", exact=True).click(); await c.wait_for_timeout(250)
            await ap.locator("#ap-fs").get_by_role("radio", name="Grand", exact=True).click(); await c.wait_for_timeout(400)
            a = await attrs(c)
            ok(a["theme"] == "light" and a["accent"] == "vert" and a["fs"] == "1", "thème clair, couleur verte, texte grand appliqués", a)
            prof = await mdb(c, "clients/u_p1") or {}
            pr = prof.get("prefs") or {}
            ok(pr.get("theme") == "clair" and pr.get("accent") == "vert" and pr.get("fs") == 1, "réglages enregistrés sur le compte", pr)
            await ap.locator("#ap-lang").get_by_role("radio", name="Détaillé").click(); await c.wait_for_timeout(300)
            lm = await c.evaluate("langMode(null, JSON.parse(localStorage.getItem('__mockdb'))['clients/u_p1'])")
            ok(lm == "expert", "consignes détaillées choisies par la cliente", lm)
            await ap.get_by_role("switch", name="Afficher : Ma régularité").click(); await c.wait_for_timeout(250)
            for _ in range(2): await ap.get_by_role("button", name="Monter : Messages et conseils").click(); await c.wait_for_timeout(300)
            await c.screenshot(path=f"{OUT}/04_apparence.png", full_page=True)
            # nouvelle ouverture : réglages repris avant même le chargement des données
            c2 = await A.new_page(); hook(c2, "client2"); await c2.set_viewport_size({"width": 390, "height": 844})
            await c2.goto(URL + "?as=p1&saison=2026-12-10"); await c2.wait_for_timeout(300)
            a = await attrs(c2)
            ok(a["theme"] == "light" and a["accent"] == "vert" and a["fs"] == "1", "réouverture : réglages réappliqués tout de suite", a)
            await c2.wait_for_timeout(1200)
            bl = await blocks(c2)
            ok("stats" not in bl and bl.index("coach") < bl.index("todo") if "coach" in bl and "todo" in bl else "stats" not in bl, "page du jour : bloc masqué et ordre choisi", bl)
            ok((await attrs(c2))["accent"] == "vert" and (await attrs(c2))["event"] == "noel", "la couleur choisie garde la priorité sur celle de l'événement", await attrs(c2))
            await c2.screenshot(path=f"{OUT}/05_jour_clair_vert.png", full_page=True)
            await c2.close()
            # couper les thèmes de saison
            await ap.get_by_role("switch", name="Thèmes et défis de saison").click(); await c.wait_for_timeout(300)
            await c.locator("nav.tabbar button", has_text="Aujourd'hui").click(); await c.wait_for_timeout(500)
            ok(await c.locator("section.saison").count() == 0 and (await attrs(c))["event"] is None, "thèmes de saison coupés par la cliente")

            # ---------- page d'accueil du site ----------
            try: urllib.request.urlopen(SITE, timeout=3); site_up = True
            except Exception: site_up = False
            if site_up:
                s = await b.new_page(); hook(s, "site")
                await s.goto(SITE + "?saison=2026-12-10"); await s.wait_for_timeout(1500)
                rb = s.locator("section.l-saison")
                ok(await rb.count() == 1 and "en ce moment" in (await rb.inner_text()).lower() and "Le défi de l'Avent" in await rb.inner_text(), "site : bandeau de l'événement sur la page d'accueil", await rb.inner_text() if await rb.count() else "")
                await rb.get_by_role("button", name="Je relève le défi").click(); await s.wait_for_timeout(500)
                ok(await s.locator("input[type=email]").count() >= 1, "site : « Je relève le défi » ouvre l'inscription")
                await s.goto(SITE + "?saison=2026-11-15"); await s.wait_for_timeout(1200)
                ok(await s.locator("section.l-saison").count() == 0, "site : aucun bandeau hors événement")
                await s.goto(SITE + "?saison=2027-02-20"); await s.wait_for_timeout(1200)
                ok(await s.locator("section.l-saison").count() == 0, "site : jamais de compétition sportive sur la page publique (Tournoi)")
                await s.goto(SITE + "?saison=2027-10-25"); await s.wait_for_timeout(1200)
                rb = s.locator("section.l-saison")
                ok(await rb.count() == 1 and "citrouilles" in await rb.inner_text() and "Coupe du monde" not in await rb.inner_text(), "site : pendant la Coupe du monde, seule la fête (Halloween) apparaît", await rb.inner_text() if await rb.count() else "")
                await s.close()
            else:
                print("  (site de test non démarré : bandeau de la page d'accueil non vérifié)")
            await b.close()
    finally:
        srv.terminate()
    bad = [e for e in errs if "pageerror" in e or "error:" in e]
    ok(not bad, "aucune erreur dans la console", bad[:5])
    print(f"{res['ok']} OK, {res['ko']} échecs")
    sys.exit(1 if res["ko"] else 0)

asyncio.run(run())
