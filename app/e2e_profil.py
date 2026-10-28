"""Version Claude : inscription avec taille, poids, âge et records (adaptés au sport), précision obligatoire des « oui »
du questionnaire santé, records utilisés pour les charges et le test de départ, profil sportif modifiable, dépense
énergétique du jour (pas, calories actives, bonus d'activité), valeurs de la table Ciqual de l'ANSES (recherche,
repas en photo, coach IA)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8771
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/profil"; os.makedirs(OUT, exist_ok=True)
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
async def enabled(page, text):
    return await page.get_by_role("button", name=text, exact=True).first.is_enabled()
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)
            await btn(co, "Codes & essais", exact=True)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "PROFIL-TEST234"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)

            # ---------- inscription : taille, poids, âge obligatoires ----------
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(700)
            await btn(c, "Commencer mon inscription")
            await c.fill("#ob-name", "Paul Rugby"); await c.get_by_role("radio", name="Rugby à XV").click()
            ok(not await enabled(c, "Continuer"), "étape 1 : impossible de continuer sans âge, taille et poids")
            await c.fill("#ob-by", "1993"); await c.fill("#ob-h", "17"); await c.fill("#ob-w", "92")
            ok(not await enabled(c, "Continuer") and await has(c, "Taille en centimètres"), "taille invalide : message et bouton bloqué")
            await c.fill("#ob-h", "182")
            age = TODAY.year - 1993
            ok(await enabled(c, "Continuer") and await has(c, f"{age} ans"), "étape 1 complète : âge calculé (" + str(age) + " ans)")
            await shot(c, "inscription_toi")
            await btn(c, "Continuer")
            # ---------- records adaptés au sport ----------
            await c.get_by_role("radio", name="National", exact=True).click(); await c.get_by_role("radio", name="Plus de 2 ans", exact=True).click()
            ok(await c.locator("#rec-squat").count() == 1 and await c.locator("#rec-bronco").count() == 1 and await c.locator("#rec-epaule").count() == 1 and await c.locator("#rec-vma").count() == 0,
               "records proposés selon le sport (rugby : squat, épaulé, Bronco ; pas de VMA)")
            await c.fill("#rec-squat", "140"); await c.fill("#rec-squat-r", "3")
            ok(await has(c, "maximum estimé 154 kg"), "squat 140 kg × 3 : maximum estimé affiché (Epley)")
            await c.fill("#rec-dc", "100"); await c.fill("#rec-bronco", "4:45"); await c.fill("#rec-sprint30", "4,2")
            await c.locator("#rec-add").click(); await c.fill("#rec-autre-0", "Développé incliné"); await c.fill("#rec-autre-v-0", "80 kg × 6")
            await shot(c, "inscription_records", full=True)
            await btn(c, "Continuer")
            await c.locator("button.pcard", has_text="Force & haltérophilie").click(); await btn(c, "Continuer")
            for i in range(await c.locator(".yn").count()):
                await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await btn(c, "Continuer")
            txt = await c.inner_text("body")
            ok("182 cm" in txt and "92 kg" in txt and f"{age} ans" in txt and "5 performances notées" in txt, "validation : récapitulatif âge, taille, poids et records")
            await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(700)
            await c.fill("#pu-code", "PROFIL-TEST234"); await btn(c, "Appliquer", exact=True)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)
            prof = await mdb(c, "clients/u_p1") or {}
            ok(prof.get("height") == 182 and prof.get("weight") == 92 and prof.get("birthYear") == 1993 and prof.get("weightAt") == TODAY.isoformat(), "profil : taille, poids, année enregistrés", prof)
            rec = prof.get("records") or {}
            ok(rec.get("squat") == {"kg": 140, "reps": 3} and rec.get("dc") == {"kg": 100, "reps": 1} and rec.get("bronco") == {"v": "4:45"} and rec.get("sprint30") == {"v": 4.2} and rec.get("autres") == [{"n": "Développé incliné", "v": "80 kg × 6"}], "records enregistrés proprement", rec)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1500)
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1200)
            ok(await has(c, "prochaine séance", 6000), "client : programme actif")

            # ---------- records utilisés : test de départ pré-rempli, charges ----------
            await c.get_by_role("button", name="Progrès").first.click(); await c.wait_for_timeout(400)
            await c.locator(".card", has_text="Mes tests").get_by_role("button", name="Saisir").click(); await c.wait_for_timeout(500)
            ok(await has(c, "Tes records notés à l'inscription sont repris") and await c.input_value("#t-e1rm_squat-kg") == "140" and await c.input_value("#t-e1rm_squat-r") == "3", "test de départ pré-rempli avec les records (squat 140 × 3)")
            await shot(c, "tests_preremplis")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(1200)
            await c.locator("button.next").first.click(); await c.wait_for_timeout(700)
            body = await c.inner_text("body")
            ok("record déclaré" in body, "séance : charges en % du maximum calculées sur le record déclaré", body[:600])
            await shot(c, "seance_charge_record")
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(1000)

            # ---------- profil sportif modifiable ----------
            await c.get_by_role("button", name="Mon profil").click(); await c.wait_for_timeout(400)
            card = c.locator(".card", has_text="Mon profil sportif")
            ok(await card.count() == 1 and "182 cm" in await card.inner_text() and "Squat (barre sur le dos) : 140 kg × 3 (maximum estimé 154 kg)" in await card.inner_text(), "profil : carte « Mon profil sportif » avec records")
            await card.get_by_role("button", name="Modifier").click(); await c.wait_for_timeout(300)
            await c.fill("#pr-w", "90"); await c.fill("#rec-sdt", "180"); await c.fill("#rec-sdt-r", "2")
            await btn(c, "Enregistrer", exact=True, scope=".modal"); await c.wait_for_timeout(500)
            prof = await mdb(c, "clients/u_p1") or {}
            ok(prof.get("weight") == 90 and (prof.get("records") or {}).get("sdt") == {"kg": 180, "reps": 2} and (prof.get("records") or {}).get("squat") == {"kg": 140, "reps": 3}, "profil modifié : poids et nouveau record, anciens records gardés")
            await shot(c, "profil_sportif")

            # ---------- nutrition : pré-remplissage, dépense du jour, bonus ----------
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(400)
            ok(await c.input_value("#nu-h") == "182" and await c.input_value("#nu-w") == "90" and await c.input_value("#nu-a") == str(age), "objectif nutrition : âge, taille et poids repris du profil")
            await c.get_by_role("radio", name="Homme").click(); await c.get_by_role("radio", name="Garder mon poids").click()
            ok(await has(c, "Dépense énergétique journalière"), "objectif : dépense énergétique journalière détaillée")
            await btn(c, "Enregistrer mon objectif"); await c.wait_for_timeout(600)
            np_ = await mdb(c, "clients/u_p1/nutri/plan") or {}
            base = (np_.get("targets") or {}).get("kcal")
            ec = c.locator(".card", has_text="Ma dépense du jour")
            ok(await ec.count() == 1 and "kcal prévues" in await ec.inner_text(), "journal : carte « Ma dépense du jour » (prévue tant qu'il n'y a pas de donnée)")
            await ec.get_by_role("button", name="Saisir").click(); await c.fill("#en-pas", "16000"); await c.fill("#en-kcal", "1100")
            await ec.get_by_role("button", name="Enregistrer").click(); await c.wait_for_timeout(600)
            s = await mdb(c, "clients/u_p1/sante/" + TODAY.isoformat()) or {}
            ok(s.get("pas") == 16000 and s.get("kcal") == 1100, "pas et calories actives enregistrés dans la santé du jour", s)
            t = await c.inner_text("body")
            exp_total = round((np_["bmr"] + 1100) / 0.9)
            bonus = min(400, max(0, round(0.5 * (exp_total - round(np_["tdee"])) / 10) * 10))
            ok(bonus > 0 and f"Bonus d'activité : +{bonus:,}".replace(",", " ") in t.replace(" ", " ") or f"+{bonus} kcal" in t.replace(" ", "").replace(" ", ""), "bonus d'activité affiché (+" + str(bonus) + " kcal)", t[:400])
            ring = await c.locator(".today-grid").inner_text()
            ok(str(base + bonus) in ring.replace(" ", "").replace(" ", "").replace(" ", ""), "cible du jour augmentée du bonus (" + str(base) + " + " + str(bonus) + ")", ring)
            await shot(c, "nutrition_depense", full=True)

            # ---------- table Ciqual : recherche et changement d'aliment ----------
            await c.locator("button.addbtn", has_text="Saisir").click(); await c.wait_for_timeout(300)
            await c.fill("#fd-q", "riz basm"); await c.wait_for_timeout(400)
            sug = c.locator(".sugg button", has_text="Riz basmati, cuit, sans sel ajouté")
            st = await sug.first.inner_text() if await sug.count() else ""
            ok("assiette moyenne" in st and "222 kcal" in st, "recherche dans la table de l'ANSES (riz basmati cuit : 1 assiette moyenne ≈ 150 g = 222 kcal)", st)
            await sug.first.click(); await c.wait_for_timeout(300)
            w = c.locator(".modal .it-wrap").first
            await w.locator(".it-u").select_option(label="g"); await w.locator(".it-gin").fill("100"); await c.wait_for_timeout(200)
            ok(await c.locator(".it-src", has_text="ANSES").count() == 1, "aliment ajouté avec sa source ANSES")
            await c.locator(".it-meta").get_by_role("button", name="changer").first.click(); await c.fill("#ciq-sw", "quinoa cuit"); await c.wait_for_timeout(300)
            await c.locator(".ciq-swap .sugg button", has_text="Quinoa").first.click(); await c.wait_for_timeout(300)
            itn = await c.locator(".modal .tot-line").first.inner_text()
            ok("Quinoa" in await c.locator(".it-name").first.inner_text() and "149 kcal" in itn, "changer l'aliment : quinoa (149 kcal pour 100 g) à la place du riz", itn)
            await shot(c, "ciqual_saisie")
            await btn(c, "Ajouter au journal"); await c.wait_for_timeout(500)
            food = await mdb(c, "clients/u_p1/food/" + TODAY.isoformat()) or {}
            it = ((food.get("meals") or [{}])[-1].get("items") or [{}])[0]
            ok(it.get("ciq") == 9341 and it.get("kcal") == 149, "repas enregistré avec le code Ciqual de l'aliment", it)

            # ---------- photo de repas : valeurs de l'ANSES ----------
            await c.locator("button.addbtn", has_text="Photo du repas").click(); await c.wait_for_timeout(300)
            await c.set_input_files("#meal-photo", HERE + "/test/photo_repas.jpg"); await btn(c, "Analyser la photo"); await c.wait_for_timeout(1500)
            tags = await c.locator(".modal .it-src").all_inner_texts()
            ok(tags.count("ANSES") >= 4 and "estimé" in tags, "photo : aliments reconnus avec les valeurs de l'ANSES, l'inconnu reste estimé", tags)
            ok(await has(c, "table Ciqual 2025 de l'ANSES"), "photo : source des valeurs indiquée")
            await shot(c, "ciqual_photo")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)

            # ---------- coach IA : outil valeurs_aliment ----------
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(1000)
            await c.get_by_role("button", name="Coach IA").first.click(); await c.wait_for_timeout(400)
            await c.fill("#chat-in", "Combien de calories dans 150 g de riz basmati cuit ?"); await c.keyboard.press("Enter"); await c.wait_for_timeout(1500)
            prompts = await c.evaluate("window.__prompts || []")
            last = prompts[-1] if prompts else {}
            ok("valeurs_aliment" in (last.get("tools") or []) and "Morphologie déclarée : " + str(age) + " ans · 182 cm · 90 kg" in last.get("all", "") and "Records déclarés" in last.get("all", "") and "Dépense mesurée" in last.get("all", ""), "coach IA : outil ANSES, morphologie, records et dépense dans son contexte")
            ok(await has(c, "222 kcal") and await has(c, "Source : table Ciqual 2025"), "coach IA : valeurs officielles de l'ANSES pour 150 g (222 kcal)")
            await shot(c, "coach_ia_ciqual")

            # ---------- côté coach : profil sportif, dépense, interrupteur du bonus ----------
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await co.get_by_text("Paul Rugby").first.click(); await co.wait_for_timeout(600)
            t = await co.inner_text("body")
            ok("Profil sportif" in t and "182 cm" in t and "Squat (barre sur le dos) : 140 kg × 3" in t and "Développé incliné : 80 kg × 6" in t, "coach : profil sportif et records du client", t[:1500])
            await co.get_by_role("radio", name="Nutrition", exact=True).click()
            await co.wait_for_timeout(500)
            ce = co.locator(".card", has_text="Dépense et activité")
            ok(await ce.count() == 1 and "bonus +" in await ce.inner_text(), "coach : dépense du jour et bonus du client")
            await shot(co, "coach_depense", full=True)
            await co.uncheck("#cn-bonus"); await co.wait_for_timeout(600)
            np2 = await mdb(co, "clients/u_p1/nutri/plan") or {}
            ok(np2.get("actBonus") is False, "coach : bonus d'activité désactivé pour ce client")
            await c.bring_to_front(); await c.goto(URL + "?as=p1"); await c.wait_for_timeout(1000); await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(600)
            ok("Bonus d'activité" not in await c.inner_text("body"), "client : plus de bonus quand le coach l'a désactivé")

            # ---------- santé du jour : calories actives ----------
            await c.get_by_role("button", name="Progrès").first.click(); await c.wait_for_timeout(400)
            await c.locator("button.nutri-mini", has_text="Ma santé du jour").click(); await c.wait_for_timeout(500)
            ok(await c.input_value("#sa-kcal") == "1100" and await c.input_value("#sa-pas") == "16000", "santé du jour : calories actives et pas repris")
            ok(await has(c, "kcal=[Énergie active]"), "version Claude : le Raccourci iPhone envoie aussi les calories actives")
            await shot(c, "sante_jour", full=True)

            # ---------- questionnaire santé : précision obligatoire ----------
            d = await A.new_page(); hook(d, "client2"); await d.set_viewport_size({"width": 390, "height": 844})
            await d.goto(URL + "?as=p2"); await d.wait_for_timeout(700)
            await btn(d, "Commencer mon inscription")
            await d.fill("#ob-name", "Léa Genou"); await d.fill("#ob-by", "2000"); await d.fill("#ob-h", "168"); await d.fill("#ob-w", "60"); await d.fill("#ob-sport", "Course à pied")
            await btn(d, "Continuer")
            await d.get_by_role("radio", name="Régional", exact=True).click(); await d.get_by_role("radio", name="6 mois à 2 ans", exact=True).click()
            ok(await d.locator("#rec-vma").count() == 1 and await d.locator("#rec-t5km").count() == 1, "course à pied : VMA et 5 km proposés")
            await d.fill("#rec-vma", "16,5"); await d.fill("#rec-t5km", "19:30")
            await btn(d, "Continuer")
            await d.locator("button.pcard").first.click(); await btn(d, "Continuer")
            for i in range(await d.locator(".yn").count()):
                await d.locator(".yn").nth(i).get_by_role("radio", name="Oui" if i == 5 else "Non").click()
            ok(await d.locator("#ob-sd-5").count() == 1 and not await enabled(d, "Continuer") and await has(d, "Où ? Depuis quand ?"), "« oui » : précision demandée, inscription bloquée tant qu'elle est vide")
            await d.fill("#ob-sd-5", "Tendinite rotulienne genou droit depuis 2 mois, suivie par un kiné")
            ok(await enabled(d, "Continuer"), "précision remplie : on peut continuer")
            await shot(d, "questionnaire_precision", full=True)
            await btn(d, "Continuer"); await d.check("#ob-consent"); await btn(d, "Continuer vers mon accès"); await d.wait_for_timeout(700)
            p2 = await mdb(d, "clients/u_p2") or {}
            ok((p2.get("screeningDetails") or [""] * 7)[5].startswith("Tendinite rotulienne") and p2.get("screeningFlag") is True and (p2.get("records") or {}).get("vma") == {"v": 16.5} and (p2.get("records") or {}).get("t5km") == {"v": "19:30"}, "précision et records course enregistrés", p2)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await co.get_by_text("Léa Genou").first.click(); await co.wait_for_timeout(600)
            ok(await has(co, "Tendinite rotulienne genou droit"), "coach : la précision du « oui » est visible")
            await shot(co, "coach_precision")
            await b.close()
    finally:
        srv.terminate()
    real = [e for e in errs if "favicon" not in e]
    print("\n%d OK, %d échecs" % (len(oks), len(fails)))
    if real: print("ERREURS CONSOLE :\n" + "\n".join(real[:20]))
    sys.exit(1 if fails or real else 0)
asyncio.run(run())
