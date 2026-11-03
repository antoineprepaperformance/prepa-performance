"""Séances en PDF (le coach dépose, le client ouvre depuis son programme) et carte athlète notée face aux records du monde
(version Claude, base simulée)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, subprocess, sys, time, os, json, datetime
from playwright.async_api import async_playwright
PORT = 8774
OUT = HERE + "/shots/pdf_carte"; os.makedirs(OUT, exist_ok=True)
URL = f"http://localhost:{PORT}/index.html"
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
async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])
# petit PDF valide (une page) + remplissage pour dépasser un morceau de 800 000 caractères
PDF = (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
       b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n") + b"%" + b"x" * 700000 + b"\n"
PDF_PATH = OUT + "/seance_test.pdf"

async def run():
    pathlib.Path(PDF_PATH).write_bytes(PDF)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.clear()"); await co.reload(); await co.wait_for_timeout(800)

            # ---------- notes face aux records du monde (fonctions pures) ----------
            r = await co.evaluate("""() => {
              const out = {
                s30: [refScore("sprint30", 3.63, "H").v, refScore("sprint30", 4.05, "H").v, refScore("sprint30", 5.2, "H").v, refScore("sprint30", 7, "H").v, refScore("sprint30", 3.5, "H").v],
                pct: refScore("sprint30", 4.2, "H").pct, f30: refScore("sprint30", 4.5, "F").v,
                squat83: refScore("e1rm_squat", 302.5, "H", 83).v, squat100: [refScore("e1rm_squat", 200, "H", 100).v, refScore("e1rm_squat", 200, "H", 70).v],
                nobw: refScore("e1rm_squat", 150, "H", null), t5: refScore("t5km", 12.589, "H").v, cmj: refScore("cmj", 50, "H"),
                abs: cardAbs({ profile: { weight: 90 }, tests: { a: { at: "2026-10-01", values: { sprint30: 4.4, e1rm_squat: { kg: 140, reps: 3 } } }, b: { at: "2026-10-29", values: { sprint30: 4.2 } } } }),
                avantGen: refScore("sprint10", 1.85, "H").v, avantSp: refScore("sprint10", 1.85, "H", null, "rugby", "avant").v,
                tqGen: refScore("sprint10", 1.77, "H").v, tqSp: refScore("sprint10", 1.77, "H", null, "rugby", "trois-quarts").v,
                rugby7Sp: refScore("sprint10", 1.85, "H", null, "rugby7", "avant").v,
                bobGen: refScore("sprint30", 4.0, "H").v, bobSp: refScore("sprint30", 4.0, "H", null, "bob", "pousseur").v,
                midGen: refScore("sprint30", 3.90, "H").v, midSp: refScore("sprint30", 3.90, "H", null, "bob", "pousseur").v,
                noPoste: refScore("sprint10", 1.85, "H", null, "rugby", null).v, autreSport: refScore("sprint10", 1.85, "H", null, "foot", "attaquant").v,
                pousseurCarte: cardAbs({ profile: { sportId: "bob", poste: "pousseur", weight: 90 }, tests: { a: { at: "2026-10-01", values: { sprint30: 4.0 } } } }),
              };
              // note générale : un test déjà noté face au record du monde ne doit pas être plombé par régularité/engagement
              // sans historique (profil tout juste inscrit, plan pas encore commencé : pl = 0, aucun bilan).
              try {
                const plan = { start: addDays(todayISO(), 14), weeks: 12 };
                const prog = PB.prepa;
                const noTest = cardStats({ profile: { weight: 90, level: "Confirmé" } }, plan, prog, {});
                const avecVit = cardStats({ profile: { weight: 90, level: "Confirmé" }, tests: { a: { at: todayISO(), values: { sprint30: 3.70 } } } }, plan, prog, {});
                out.noteSansRien = noTest.overall; out.tierSansRien = noTest.tier.k;
                out.noteAvecVitElite = avecVit.overall; out.tierAvecVitElite = avecVit.tier.k;
                out.regEngSansDonnee = noTest.attrs.filter((a) => (a.k === "reg" || a.k === "eng") && a.live).length;
              } catch (e) { out.noteErr = String(e); }
              return out;
            }""")
            ok(r["s30"][0] == 99 and r["s30"][1] == 90 and r["s30"][2] == 40 and r["s30"][3] >= 25 and r["s30"][4] == 99, "sprint 30 m : record du monde 99, haut niveau 90, débutant 40", r["s30"])
            ok(r["pct"] == 86 and r["f30"] == 90, "pourcentage du record ; repères féminins", [r["pct"], r["f30"]])
            ok(r["squat83"] == 99 and r["squat100"][1] > r["squat100"][0] and r["nobw"] is None, "charges ramenées au poids de corps (plus léger = meilleure note à charge égale)", r)
            ok(r["t5"] == 99 and r["cmj"] is None, "5 km : record du monde ; test sans record (CMJ) non noté", r)
            sc = {x["tid"]: x for x in r["abs"]["scores"]}
            ok(sc.get("sprint30", {}).get("val") == 4.2 and "e1rm_squat" in sc and r["abs"]["byAttr"].get("vit") and r["abs"]["sex"] == "H" and not r["abs"]["sexKnown"],
               "dernier résultat de chaque test, attributs vitesse et force", r["abs"])
            ok(r["avantSp"] == 90 and r["avantSp"] > r["avantGen"], "rugby avant : 1,85 s au 10 m vaut 90 (haut niveau du poste), plus que le repère générique", r)
            ok(r["tqSp"] == r["tqGen"], "rugby trois-quarts : repère du poste plus exigeant que le générique ici, donc sans effet — jamais de note plus basse qu'avec le repère générique", r)
            ok(r["rugby7Sp"] == r["avantSp"], "rugby à 7 : même repère que le rugby à XV pour les avants", r)
            ok(r["bobSp"] == r["bobGen"], "bobsleigh pousseur : repère déjà proche du générique (légèrement plus exigeant ici) : pas de note plus basse qu'avec le repère générique", r)
            ok(r["noPoste"] == r["avantGen"] and r["autreSport"] == r["avantGen"], "sans poste connu, ou sport sans repère dédié : repère générique", r)
            ok(r["midSp"] >= r["midGen"], "garde-fou : un repère sport plus exigeant ne fait jamais baisser la note sous le repère générique", r)
            ok("noteErr" not in r, "note générale : cardStats s'exécute sans erreur avec un plan pas encore commencé", r.get("noteErr"))
            ok(r.get("regEngSansDonnee") == 0, "avant le début du plan, régularité et engagement n'ont encore aucune donnée", r)
            ok(r.get("noteSansRien") == 65 and r.get("tierSansRien") == "argent", "sans aucune donnée, note neutre (profil Confirmé) et palier Argent", r)
            ok(r.get("noteAvecVitElite") == 78 and r.get("tierAvecVitElite") == "or",
               "un seul test déjà au niveau du record du monde (65 → 78) fait passer directement au palier Or, sans attendre un historique de régularité/engagement", r)
            ok(r["pousseurCarte"]["scores"][0]["spSrc"] is not None and "Bobsleigh UK" in r["pousseurCarte"]["scores"][0]["spSrc"],
               "carte d'un pousseur : la source du repère spécifique est bien remontée", r["pousseurCarte"])

            # ---------- client Sur mesure ----------
            await btn(co, "Codes & essais", exact=True)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Sur mesure", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "PDF-TEST2345"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(700)
            await btn(c, "Commencer mon inscription"); await c.fill("#ob-name", "Paul Pdf"); await c.get_by_role("radio", name="Rugby à XV").click()
            await c.fill("#ob-by", "1999"); await c.fill("#ob-h", "182"); await c.fill("#ob-w", "90"); await btn(c, "Continuer")
            await c.get_by_role("radio", name="Régional", exact=True).click(); await c.get_by_role("radio", name="Plus de 2 ans", exact=True).click(); await btn(c, "Continuer")
            await c.locator("button.pcard").first.click(); await btn(c, "Continuer")
            for i in range(await c.locator(".yn").count()): await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await btn(c, "Continuer"); await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(600)
            await c.fill("#pu-code", "PDF-TEST2345"); await btn(c, "Appliquer", exact=True)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)

            # ---------- coach : dépôt du PDF ----------
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1000)
            await co.locator(".side-nav button", has_text="Clients").first.click(); await co.wait_for_timeout(500)
            await co.locator(".ctable tbody tr", has_text="Paul Pdf").first.click(); await co.wait_for_timeout(900)
            await co.get_by_role("radio", name="Fichiers PDF").click(); await co.wait_for_timeout(300)
            await co.set_input_files("#pdf-file", PDF_PATH); await co.wait_for_timeout(200)
            ok(await co.input_value("#pdf-n") == "seance_test", "titre proposé d'après le nom du fichier")
            await co.fill("#pdf-n", "Bloc 1 · semaine type"); await co.select_option("#pdf-w", "1")
            await btn(co, "Envoyer au client"); await co.wait_for_timeout(1200)
            t = await co.inner_text("body")
            ok("Bloc 1 · semaine type" in t and "PDF de ce client" in t and "1 fichier" in t, "coach : PDF envoyé et listé", t[-500:])
            parts = await co.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{}')).filter((k) => k.includes('/pdfparts/')).length")
            ok(parts == 2, "fichier rangé en 2 morceaux (moins de 1 Mo chacun)", parts)
            await co.screenshot(path=f"{OUT}/01_coach_pdf.png")

            # ---------- client : ouverture depuis le programme ----------
            await c.bring_to_front(); await c.goto(URL + "?as=p1"); await c.wait_for_timeout(1300)
            await c.locator("nav.tabbar button", has_text="Programme").click(); await c.wait_for_timeout(500)
            card = c.locator(".card", has_text="Mes séances écrites par Antoine")
            ok(await card.count() == 1 and "Bloc 1 · semaine type" in await card.inner_text(), "client : carte des PDF dans le programme")
            await card.get_by_role("button", name="Ouvrir").click(); await c.wait_for_timeout(800)
            href = await card.get_by_role("link", name="Afficher").get_attribute("href")
            size = await c.evaluate("async (u) => { const r = await fetch(u); const b = await r.blob(); const t = await b.slice(0, 5).text(); return [b.size, b.type, t]; }", href)
            ok(size[0] == len(PDF) and size[1] == "application/pdf" and size[2] == "%PDF-", "le PDF rouvert est identique au fichier déposé", size)
            ok(await card.get_by_role("link", name="Télécharger").get_attribute("download") is not None, "bouton Télécharger")
            await c.screenshot(path=f"{OUT}/02_client_pdf.png")

            # ---------- coach : retrait ----------
            await co.bring_to_front()
            await co.get_by_role("button", name="Retirer").first.click(); await co.wait_for_timeout(200)
            await co.get_by_role("button", name="Confirmer le retrait").first.click(); await co.wait_for_timeout(800)
            parts = await co.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{}')).filter((k) => k.includes('/pdfparts/') || k.includes('/pdfs/')).length")
            ok(parts == 0 and "Aucun pour l'instant" in await co.inner_text("body"), "retrait en deux clics : liste et morceaux effacés", parts)

            # ---------- carte athlète côté client ----------
            await c.bring_to_front()
            await mdb_set(c, "clients/u_p1/tests/w1", {"w": 1, "at": TODAY.isoformat(), "values": {"sprint30": 4.3, "e1rm_squat": {"kg": 150, "reps": 3}, "vma": 1700}})
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Mon profil").first.click(); await c.wait_for_timeout(600)
            t = await c.inner_text("body")
            ok("tests face aux records du monde" in t.lower() and "du record" in t, "carte athlète : tests comparés aux records du monde", t[t.find("Encore"):t.find("Encore") + 600])
            ok("records masculins par défaut" in t, "sexe inconnu : comparaison masculine annoncée")
            await c.locator(".card", has_text="Ma carte athlète").first.screenshot(path=f"{OUT}/03_carte_records.png")
            await b.close()
    finally:
        srv.terminate()
    bad = [e for e in errs if "pageerror" in e or "error:" in e]
    ok(not bad, "aucune erreur dans la console", bad[:5])
    print(f"{res['ok']} OK, {res['ko']} échecs")
    sys.exit(1 if res["ko"] else 0)

asyncio.run(run())
