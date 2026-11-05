"""Suivi sur mesure (version Claude, mock) : matériel disponible et modules (musculation, cardio, nutrition) choisis
à l'inscription et dans le profil ; exercices remplacés par un équivalent faisable, dose adaptée quand la charge manque ;
séances filtrées selon les modules ; onglets Programme et Nutrition masqués quand ils ne servent pas ; espace coach ;
sujet des messages (santé et rétractation en tête de la boîte d'Antoine)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, subprocess, sys, time, os, json, datetime
from playwright.async_api import async_playwright
PORT = 8776
OUT = HERE + "/shots/materiel"; os.makedirs(OUT, exist_ok=True)
URL = f"http://localhost:{PORT}/index.html"
TODAY = datetime.date.today()
errs, res = [], {"ok": 0, "ko": 0}
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:500]))
async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)
async def enabled(page, text): return await page.get_by_role("button", name=text, exact=True).first.is_enabled()
async def has(page, text, timeout=1500):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def tabs(page): return await page.evaluate("[...document.querySelectorAll('nav.tabbar > button:not(.tab-ia)')].map((b) => b.innerText.trim())")

async def onboard(c, name, prog, mods_off=(), preset=None, code=None):
    await btn(c, "Commencer mon inscription"); await c.fill("#ob-name", name); await c.fill("#ob-by", "1992"); await c.fill("#ob-h", "176"); await c.fill("#ob-w", "74"); await btn(c, "Continuer")
    await c.get_by_role("radio", name="Pas de compétition").click(); await c.get_by_role("radio", name="6 mois à 2 ans", exact=True).click(); await btn(c, "Continuer")
    for m in mods_off: await c.locator("#ob-mod-" + m).click()
    await c.locator("button.pcard", has_text=prog).click(); await c.wait_for_timeout(150)
    if preset: await c.get_by_role("radio", name=preset, exact=True).click(); await c.wait_for_timeout(150)

async def finish(c, code):
    await btn(c, "Continuer")
    for i in range(await c.locator(".yn").count()): await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
    await btn(c, "Continuer"); await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(600)
    await c.fill("#pu-code", code); await btn(c, "Appliquer", exact=True)
    await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860})
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.clear()"); await co.reload(); await co.wait_for_timeout(800)

            # ---------- fonctions pures ----------
            r = await co.evaluate("""() => {
              const sw = (id, mat) => matSwap(id, mat);
              const P = ["perte", "masse", "force", "vitesse", "prepa", "forme", "run", "retour"];
              const n = (pid, mods) => persoProg(PB[pid], { modules: mods }).blocks.map((b) => b.sessions.map((s) => s.id).join(""));
              const M = { muscu: true, cardio: false, nutrition: true }, C = { muscu: false, cardio: true, nutrition: true };
              const allFeasible = P.every((pid) => PB[pid].blocks.every((b) => b.sessions.every((s) => s.items.every((it) => { const to = matSwap(it.e, []); return exFeasible(EXB[to], []) || EXB[to].c === "Vitesse" || EXB[to].c === "Course" || EXB[to].c === "Agilité" || EXB[to].c === "Conditionnement"; }))));
              return {
                rien: [sw("squat_barre", ["terrain"]), sw("sdt", ["terrain"]), sw("dc_barre", ["terrain"]), sw("tractions", ["terrain"]), sw("dm", ["terrain"])],
                halt: [sw("squat_barre", ["halteres"]), sw("tractions", ["elastique"]), sw("rowing_barre", ["halteres"]), sw("epaule_suspension", ["halteres"])],
                salle: [sw("trap_bar", ["salle"]), sw("presse", ["salle"]), sw("poussee_traineau", ["salle"]), sw("sprint_30", ["salle"]), sw("sprint_30", ["salle", "terrain"])],
                course: [sw("footing_ef", ["velo_rameur"]), sw("velo_intervalles", ["terrain"])],
                it: matItem({ e: "squat_barre", t: "F5", r: "5" }, { mat: ["terrain"] }), it2: matItem({ e: "squat_barre", t: "F5" }, { mat: ["halteres"] }),
                it3: matItem({ e: "sprint_30", t: "S" }, { mat: [] }), it4: matItem({ e: "squat_goblet", t: "H12", adjNote: "x" }, { mat: ["salle"] }),
                dose: doseFor(matItem({ e: "hip_thrust", t: "H8" }, { mat: [] }), 1, { niveau: "perf" }).load,
                muscu: P.map((pid) => n(pid, M).join("|")), cardio: P.map((pid) => n(pid, C).join("|")),
                cutC: persoProg(PB.perte, { modules: M }).blocks[0].sessions[0], allFeasible,
                legacy: persoProg(PB.perte, {}) === PB.perte, maison: exOf("squat_barre", "maison", persoProg(PB.perte, { materiel: ["halteres"] })).subst,
                lbl: [modsLabel({ muscu: false, cardio: true, nutrition: true }), modsLabel(null), matLabel(["terrain"]), matLabel([])],
                bad: persoChecks("masse", ["terrain"], C).map((c) => c.t), nut: persoChecks("masse", null, { muscu: false, cardio: false, nutrition: true }).map((c) => c.t),
                force: persoChecks("force", ["halteres", "terrain"], null).map((c) => c.n).join(" "), vit: persoChecks("vitesse", ["salle"], null).map((c) => c.t),
                ai: persoLine({ materiel: ["halteres", "terrain"], modules: M }) };
            }""")
            ok(r["rien"] == ["fente_arriere", "pont_unipodal", "pompes", "y_t_w", "pompes"], "sans matériel : squat → fente arrière, soulevé de terre → pont unipodal, développés → pompes, tractions → Y-T-W", r["rien"])
            ok(r["halt"] == ["squat_goblet", "tirage_elastique", "rowing_haltere", "epaule_haltere"], "haltères ou élastique : goblet squat, tirage élastique, rowing haltère sur chaise, épaulé haltère", r["halt"])
            ok(r["salle"] == ["trap_bar", "presse", "fente_marchee", "montees_genoux", "sprint_30"], "salle complète : tout sauf le traîneau et le terrain dehors", r["salle"])
            ok(r["course"] == ["rameur", "intermittent_3030"], "cardio : footing sur machine sans dehors, intervalles dehors sans machine", r["course"])
            ok(r["it"]["e"] == "fente_arriere" and r["it"]["t"] == "H12" and "r" not in r["it"] and r["it"]["bw"] and r["it"]["matFrom"] == "squat_barre" and "descente en 3 secondes" in r["it"]["matNote"], "dose : force au poids du corps → 10-12 répétitions lentes, sans kilos", r["it"])
            ok(r["it2"]["t"] == "H8" and not r["it2"].get("bw"), "dose : force à l'haltère → 8-10 répétitions, charge notée", r["it2"])
            ok(r["it3"]["e"] == "montees_genoux" and r["it3"]["w"][0].startswith("4 × 10 s"), "sprint sans espace : sur place, 10 s par effort", r["it3"])
            ok(r["it4"] == {"e": "squat_goblet", "t": "H12", "adjNote": "x"}, "exercice faisable : inchangé", r["it4"])
            ok(r["dose"] is False, "exercice au poids du corps : pas de charge à saisir")
            ok(r["muscu"] == ["AC|AC|AC", "ABC|ABC|ABC", "ABC|ABC|ABC", "ABC|ABC|ABC", "AB|AB|AB", "AC|AC|AC", "C|C|C", "ABC|ABC|BC"], "musculation seule : séances de cardio retirées", r["muscu"])
            ok(r["cardio"] == ["B|B|B", "||", "||", "||", "C|C|C", "B|B|B", "AB|ABC|ABC", "AC|AC|AC"], "cardio seul : séances de cardio et parties course gardées", r["cardio"])
            ok(r["cutC"]["modCut"] == "cardio" and not any(x["e"] in ("velo_intervalles", "circuit_kb", "burpees") for x in r["cutC"]["items"]), "musculation seule : le finisher cardio est retiré de la séance", r["cutC"])
            ok(r["allFeasible"], "sans aucun matériel : chaque exercice de force a un remplaçant faisable")
            ok(r["legacy"] and r["maison"] is False, "sans choix : programme inchangé ; avec matériel indiqué : plus de « version maison » en double")
            ok(r["lbl"] == ["Cardio et nutrition", "Musculation, cardio et nutrition", "Maison, sans matériel", "Aucun matériel"], "libellés du suivi et du matériel", r["lbl"])
            ok(r["bad"][0] == "bad" and r["nut"][0] == "info" and "Schoenfeld et al., 2017" in r["force"] and "warn" in r["vit"], "vérifications : programme sans cardio bloqué, nutrition seule, force sans barre (étude citée), vitesse sans dehors", r)
            ok("Matériel disponible : Haltères, Terrain" in r["ai"] and "musculation et nutrition" in r["ai"], "coach IA : matériel et suivi dans le contexte", r["ai"])

            # ---------- codes d'essai ----------
            await btn(co, "Codes & essais", exact=True)
            for code in ("MAT-TEST234", "MAT-TEST567"):
                await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
                await co.fill("#cd-code", code); await btn(co, "Créer le code"); await co.wait_for_timeout(300)

            # ---------- inscription : cardio et nutrition, sans matériel ----------
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(700)
            await onboard(c, "Inès Cardio", "Prise de muscle", mods_off=("muscu",), preset="Maison, sans matériel")
            txt = await c.inner_text("main") if await c.locator("main").count() else await c.inner_text("body")
            ok(await c.locator(".mod-pick .modcard").count() == 3 and await c.locator(".mat-pick").count() == 1, "étape objectif : choix du suivi et du matériel")
            ok(not await enabled(c, "Continuer") and await has(c, "n'a pas de séance de cardio"), "prise de muscle en cardio seul : bloqué avec explication")
            await c.locator("button.pcard", has_text="Course à pied").click(); await c.wait_for_timeout(200)
            ok(await enabled(c, "Continuer") and await has(c, "Avec ton choix : 2 à 3 séances par semaine"), "course à pied en cardio seul : 2 à 3 séances par semaine")
            await c.screenshot(path=f"{OUT}/01_inscription_objectif.png", full_page=True)
            await c.locator("#ob-mod-nutrition").click(); await c.locator("#ob-mod-cardio").click(); await c.wait_for_timeout(150)
            ok(await c.locator("#ob-mod-cardio").get_attribute("aria-pressed") == "true", "au moins un choix : le dernier module ne se décoche pas")
            await c.locator("#ob-mod-nutrition").click(); await c.wait_for_timeout(150)
            await finish(c, "MAT-TEST234")
            prof = await mdb(c, "clients/u_p1") or {}
            ok(prof.get("materiel") == ["terrain"] and prof.get("modules") == {"muscu": False, "cardio": True, "nutrition": True} and (prof.get("request") or {}).get("equipment") == "maison",
               "profil : matériel, modules et lieu « maison » enregistrés", {k: prof.get(k) for k in ("materiel", "modules", "request")})
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1300)
            ok(await c.locator("button.next").count() == 1, "client : programme actif")
            ok(await tabs(c) == ["Aujourd'hui", "Programme", "Bilan", "Nutrition", "Progrès"], "onglets : tous (cardio et nutrition)", await tabs(c))
            await c.locator("nav.tabbar button", has_text="Programme").click(); await c.wait_for_timeout(400)
            rows = await c.locator(".srow").count()
            ok(rows == 2, "course à pied, cardio seul, bloc 1 : 2 séances (le renforcement est retiré)", rows)

            # ---------- profil : nutrition seule, puis sans nutrition ----------
            await c.get_by_role("button", name="Mon profil").first.click(); await c.wait_for_timeout(400)
            card = c.locator("section.card", has_text="Mon suivi sur mesure")
            ok(await card.count() == 1 and "Cardio et nutrition" in await card.inner_text() and "Maison, sans matériel" in await card.inner_text(), "profil : carte « Mon suivi sur mesure »", await card.inner_text() if await card.count() else "")
            await card.get_by_role("button", name="Modifier").click(); await c.wait_for_timeout(300)
            await c.locator("#pe-mod-cardio").click(); await c.wait_for_timeout(150)
            ok(await c.locator("#pe-mat-salle").count() == 0 and await has(c, "Nutrition seule"), "nutrition seule : plus de choix de matériel, explication")
            await btn(c, "Enregistrer"); await c.wait_for_timeout(600)
            ok(await tabs(c) == ["Aujourd'hui", "Bilan", "Nutrition", "Progrès"], "nutrition seule : pas d'onglet Programme", await tabs(c))
            await c.locator("nav.tabbar button", has_text="Aujourd'hui").click(); await c.wait_for_timeout(500)
            h1 = await c.locator(".hero h1").first.inner_text()
            ok("suivi nutrition" in h1.lower() and await c.locator("button.next").count() == 0 and await c.locator(".today [data-block=stats] .ring, .today .ring").count() == 0, "nutrition seule : page du jour sans séance ni anneau", h1)
            await c.screenshot(path=f"{OUT}/02_nutrition_seule.png", full_page=True)
            await c.get_by_role("button", name="Mon profil").first.click(); await c.wait_for_timeout(400)
            await c.locator("section.card", has_text="Mon suivi sur mesure").get_by_role("button", name="Modifier").click(); await c.wait_for_timeout(300)
            await c.locator("#pe-mod-muscu").click(); await c.locator("#pe-mod-cardio").click(); await c.locator("#pe-mod-nutrition").click(); await c.wait_for_timeout(150)
            await c.locator("#pe-mat-halteres").click(); await c.locator("#pe-mat-elastique").click(); await c.wait_for_timeout(150)
            await btn(c, "Enregistrer"); await c.wait_for_timeout(600)
            prof = await mdb(c, "clients/u_p1") or {}
            ok(prof.get("modules") == {"muscu": True, "cardio": True, "nutrition": False} and sorted(prof.get("materiel") or []) == ["elastique", "halteres", "terrain"], "profil : nouveau choix enregistré", {k: prof.get(k) for k in ("materiel", "modules")})
            ok(await tabs(c) == ["Aujourd'hui", "Programme", "Bilan", "Progrès"], "sans nutrition : pas d'onglet Nutrition", await tabs(c))
            await c.locator("nav.tabbar button", has_text="Aujourd'hui").click(); await c.wait_for_timeout(500)
            ok(not await has(c, "Fixe ton objectif nutrition", 500) and not await has(c, "Note tes repas", 300), "sans nutrition : ni bloc ni tâche nutrition sur la page du jour")

            # ---------- séance adaptée au matériel ----------
            c2 = await A.new_page(); hook(c2, "client2"); await c2.set_viewport_size({"width": 390, "height": 844})
            await c2.goto(URL + "?as=p2"); await c2.wait_for_timeout(700)
            await onboard(c2, "Tom Garage", "Prise de muscle", mods_off=(), preset="Maison, sans matériel")
            await finish(c2, "MAT-TEST567")
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await c2.bring_to_front(); await c2.reload(); await c2.wait_for_timeout(1300)
            await c2.locator("button.next").click(); await c2.wait_for_timeout(700)
            notes = await c2.evaluate("[...document.querySelectorAll('.sport-note')].map((e) => e.innerText)")
            pills = await c2.locator(".exc .pill", has_text="adapté à ton matériel").count()
            ok(pills >= 3 and any("Ton matériel : remplace « Squat arrière à la barre »" in n for n in notes), "séance : exercices remplacés, avec l'exercice d'origine", notes)
            ok(await c2.locator(".exc", has_text="Fente arrière").locator(".sets").count() == 0, "fente arrière au poids du corps : pas de kilos à noter")
            await c2.screenshot(path=f"{OUT}/03_seance_sans_materiel.png", full_page=True)
            await btn(c2, "Retour")

            # ---------- messages : sujet ----------
            await c2.locator("header.c-top .msgbtn").click(); await c2.wait_for_timeout(500)
            ok(await c2.locator(".msg-suj .chipbtn").count() == 7, "messagerie : 7 sujets proposés")
            await c2.locator("#msg-suj-sante").click(); await c2.wait_for_timeout(150)
            ok(await has(c2, "Dis où tu as mal"), "sujet Santé : consignes (où, depuis quand, sur 10, urgences)")
            await c2.fill("#msg-in-client", "Douleur à l'épaule gauche depuis hier, 4 sur 10."); await btn(c2, "Envoyer", exact=True); await c2.wait_for_timeout(500)
            await c.bring_to_front(); await c.locator("header.c-top .msgbtn").click(); await c.wait_for_timeout(400)
            await c.locator("#msg-suj-tarifs").click(); await c.fill("#msg-in-client", "Combien coûte le suivi sur 6 mois ?"); await btn(c, "Envoyer", exact=True); await c.wait_for_timeout(500)
            msgs = await c2.evaluate("Object.entries(JSON.parse(localStorage.getItem('__mockdb'))).filter(([k]) => k.startsWith('clients/u_p2/messages/')).map(([k, v]) => v)")
            ok(len(msgs) == 1 and msgs[0].get("sujet") == "sante", "message enregistré avec son sujet", msgs)
            ok(((await mdb(c2, "clients/u_p2") or {}).get("sum") or {}).get("msgSujet") == "sante", "résumé du client : sujet du dernier message (pour la boîte d'Antoine)")
            await c2.bring_to_front()
            ok(await c2.locator(".msg .msg-s.hot", has_text="Santé").count() == 1, "fil : sujet affiché sur le message")

            # ---------- rythme : s'entraîner plus de jours (séances reprises en boucle) + planning visuel ----------
            await c2.reload(); await c2.wait_for_timeout(1200)
            await c2.get_by_role("button", name="Mon profil").first.click(); await c2.wait_for_timeout(400)
            await c2.locator("section.card", has_text="Mon suivi sur mesure").get_by_role("button", name="Modifier").click(); await c2.wait_for_timeout(300)
            ok(await c2.locator('.seg[aria-label="Jours d\'entraînement par semaine"] button').count() == 5, "rythme : de 3 (naturel) à 7 jours proposés")
            await c2.locator("#pe-ry-7").click(); await c2.wait_for_timeout(150)
            await btn(c2, "Enregistrer"); await c2.wait_for_timeout(600)
            ok((await mdb(c2, "clients/u_p2") or {}).get("rythme") == 7, "profil : rythme enregistré (7 jours)")
            await c2.locator("nav.tabbar button", has_text="Programme").click(); await c2.wait_for_timeout(500)
            ok(await c2.locator(".srow").count() == 7, "programme : 7 séances cette semaine (A, B, C reprises en boucle)", await c2.locator(".srow").count())
            cells, rest = await c2.locator(".wp-d").count(), await c2.locator(".wp-d.rest").count()
            ok(cells == 7 and rest == 0, "ma semaine : 7 jours d'entraînement affichés, aucun jour de repos", {"cells": cells, "rest": rest})
            await c2.locator(".wp-d").first.screenshot(path=f"{OUT}/05_planning_jour.png")
            await c2.locator(".wplan").screenshot(path=f"{OUT}/05_planning_semaine.png")

            # ---------- rythme ramené au naturel : rien n'est forcé en dessous du minimum du programme ----------
            await c2.get_by_role("button", name="Mon profil").first.click(); await c2.wait_for_timeout(400)
            await c2.locator("section.card", has_text="Mon suivi sur mesure").get_by_role("button", name="Modifier").click(); await c2.wait_for_timeout(300)
            await c2.locator("#pe-ry-3").click(); await c2.wait_for_timeout(150)
            await btn(c2, "Enregistrer"); await c2.wait_for_timeout(600)
            ok((await mdb(c2, "clients/u_p2") or {}).get("rythme") is None, "rythme égal au naturel : rien n'est enregistré (comportement par défaut)")
            await c2.locator("nav.tabbar button", has_text="Programme").click(); await c2.wait_for_timeout(500)
            ok(await c2.locator(".srow").count() == 3, "retour à 3 séances naturelles", await c2.locator(".srow").count())

            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await co.locator(".side-nav button", has_text="Messages").click(); await co.wait_for_timeout(600)
            rows = await co.evaluate("[...document.querySelectorAll('.inbox-row')].map((e) => e.innerText.replace(/\\s+/g, ' '))")
            ok(len(rows) == 2 and "Tom Garage" in rows[0] and "Santé" in rows[0] and "Tarifs et offres" in rows[1], "boîte d'Antoine : santé en tête, sujets affichés", rows)
            await co.get_by_role("radio", name="Tarifs et offres (1)").click(); await co.wait_for_timeout(300)
            rows = await co.evaluate("[...document.querySelectorAll('.inbox-row')].map((e) => e.innerText.replace(/\\s+/g, ' '))")
            ok(len(rows) == 1 and "Inès Cardio" in rows[0], "boîte d'Antoine : filtre par sujet", rows)
            await co.screenshot(path=f"{OUT}/04_boite_coach.png", full_page=True)

            # ---------- espace coach : fiche client ----------
            await co.get_by_role("radio", name="Tous (2)").click(); await co.wait_for_timeout(200)
            await co.locator(".inbox-row", has_text="Inès Cardio").click(); await co.wait_for_timeout(900)
            ok(await co.locator("header.page-h .pill", has_text="Musculation et cardio").count() == 1, "fiche client : suivi choisi en en-tête")
            await co.get_by_role("radio", name="Sport & terrain").click(); await co.wait_for_timeout(400)
            card = co.locator("section.card", has_text="Suivi choisi par le client")
            ok(await card.count() == 1 and "Haltères" in await card.inner_text(), "coach : suivi et matériel du client", await card.inner_text() if await card.count() else "")

            # ---------- espace coach : planning de la semaine du client (onglet Séances) ----------
            await co.get_by_role("button", name="Tous les clients", exact=False).click(); await co.wait_for_timeout(500)
            await co.locator(".ctable tbody tr, .inbox-row", has_text="Tom Garage").first.click(); await co.wait_for_timeout(700)
            await co.get_by_role("radio", name="Séances", exact=True).click(); await co.wait_for_timeout(400)
            cells = await co.locator(".wp-d").count()
            ok(cells == 7 and await has(co, "Sa semaine"), "coach : planning de la semaine du client (lecture seule)", cells)
            ok(await co.locator(".wp-e").first.is_disabled(), "coach : planning en lecture seule, pas de clic pour ouvrir la séance")
            await co.screenshot(path=f"{OUT}/06_coach_planning.png", full_page=True)
            await b.close()
    finally:
        srv.terminate()
    bad = [e for e in errs if "pageerror" in e or "error:" in e]
    ok(not bad, "aucune erreur dans la console", bad[:5])
    print(f"{res['ok']} OK, {res['ko']} échecs")
    sys.exit(1 if res["ko"] else 0)

if __name__ == "__main__": asyncio.run(run())
