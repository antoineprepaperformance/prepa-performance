"""Contenu de la méthode d'Antoine (version Claude, mock) : fiches « Technique » rugby (format de ses fiches terrain,
contact et sécurité, jamais dans la séance de la semaine), exercices de salle animés, recettes de saison et recettes
des fêtes et des grandes compétitions."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, subprocess, sys, time, os, json, datetime
from playwright.async_api import async_playwright
PORT = 8772
OUT = HERE + "/shots/contenu"; os.makedirs(OUT, exist_ok=True)
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

NEW_EX = ["sdt_sumo", "trap_bar", "trap_bar_dyn", "good_morning", "floor_press", "dc_incline_barre", "rowing_pendlay", "rowing_tbar", "tractions_neutre",
          "tractions_serviette", "pompes_plio", "box_jump_assis", "mb_arriere", "mb_melee"]

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.clear()"); await co.reload(); await co.wait_for_timeout(800)

            # ---------- fiches technique (fonctions pures) ----------
            r = await co.evaluate("""() => {
              const sk = DRILLS.filter((d) => d.skill), rug = SPB.rugby;
              const weeks = []; for (let w = 1; w <= 60; w++) { const x = terrainOfWeek({ profile: { sportId: "rugby" } }, w, (w - 1) % 4 + 1); weeks.push(x && x.d.id); }
              return { n: sk.length, ids: sk.map((d) => d.id), inRug: skillsFor(rug).length, inWeek: weeks.filter((id) => sk.some((d) => d.id === id)).length,
                hardNoWarn: sk.filter((d) => contactHard(d) && !d.warn).map((d) => d.id), fiche: sk.filter((d) => !(d.obj && d.org && d.var && d.sc && d.steps.length >= 3 && d.cues.length >= 2)).map((d) => d.id),
                rugby7: skillsFor(SPB.rugby7).length, hard: sk.filter(contactHard).length }; }""")
            ok(r["n"] >= 13 and r["inRug"] == r["n"] and r["rugby7"] == r["n"], "13 fiches technique rugby (XV et 7)", r)
            ok(r["inWeek"] == 0, "jamais de fiche technique tirée au sort pour la séance terrain de la semaine (60 semaines)", r["inWeek"])
            ok(not r["hardNoWarn"] and r["hard"] >= 6, "chaque fiche avec contact porte son avertissement de sécurité", r)
            ok(not r["fiche"], "format des fiches d'Antoine : objectifs, organisation, consignes, points clés, variantes, schéma", r["fiche"])

            # ---------- exercices de salle animés ----------
            r = await co.evaluate("(ids) => ids.map((i) => [i, !!EXB[i], hasMotion(i, EXB[i]) && !!motionFor(i, EXB[i])])", NEW_EX)
            ok(all(x[1] and x[2] for x in r), "14 exercices de la méthode d'Antoine, chacun avec son animation", [x for x in r if not (x[1] and x[2])])

            # ---------- recettes de saison et des événements ----------
            r = await co.evaluate("""() => { const R = Object.fromEntries(RECETTES.map((x) => [x.id, x]));
              const ed = (d) => { const e = saisonActive(d); return e ? { ...e, date: d } : null; };
              const veg = { profile: {}, recettes: { prefs: { regime: "vegetarien" } } };
              return { veloute: [recSeason(R.veloute_potiron, "A"), recSeason(R.veloute_potiron, "P")], agneau: [recSeason(R.agneau_printemps, "A"), recSeason(R.agneau_printemps, "P")],
                fraises: [recSeason(R.fraises_skyr, "H"), recSeason(R.fraises_skyr, "E")], pates: recSeason(R.pates_match, "A"),
                hal: weekRecipeEd({ profile: {} }, null, "c1", ed("2026-10-25")).r.id, noel: weekRecipeEd({ profile: {} }, null, "c1", ed("2026-12-10")).r.id,
                paques: weekRecipeEd({ profile: {} }, null, "c1", ed("2027-03-20")).r.id, cdm_debut: weekRecipeEd({ profile: {} }, null, "c1", ed("2027-10-15")).th,
                cdm_fin: weekRecipeEd({ profile: {} }, null, "c1", ed("2027-11-10")).r.id, noel_veg: weekRecipeEd(veg, null, "c1", ed("2026-12-10")).r.id,
                nov: weekRecipeEd({ profile: {} }, null, "c1", null).th, saisons: Object.keys(CONTENT.RECSAISON).length }; }""")
            ok(r["veloute"] == [True, False] and r["agneau"] == [False, True] and r["fraises"] == [False, True] and r["pates"] is None, "saison des recettes (calendrier Manger Bouger)", r)
            ok(r["hal"] == "veloute_potiron" and r["noel"] == "dinde_chataignes" and r["paques"] == "agneau_printemps", "recette du moment : Halloween, Noël, Pâques", r)
            ok(r["cdm_debut"] is False and r["cdm_fin"] == "pates_match", "grande compétition : pâtes de veille de match seulement la dernière semaine", r)
            ok(r["noel_veg"] != "dinde_chataignes" and r["nov"] is False, "client végétarien : pas de dinde à Noël ; hors événement, recette de saison", r)

            # ---------- bibliothèque du coach ----------
            await btn(co, "Programmes", exact=True); await co.wait_for_timeout(400)
            await co.select_option("#tl-sport", "rugby"); await co.wait_for_timeout(300)
            t = await co.inner_text("body")
            ok("fiches technique" in t and "jamais proposées d'office" in t, "coach : bibliothèque avec les fiches technique")

            # ---------- client rugby ----------
            await btn(co, "Codes & essais", exact=True)
            await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
            await co.fill("#cd-code", "SKILL-TEST234"); await btn(co, "Créer le code"); await co.wait_for_timeout(300)
            c = await A.new_page(); hook(c, "client"); await c.set_viewport_size({"width": 390, "height": 844})
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(700)
            await btn(c, "Commencer mon inscription"); await c.fill("#ob-name", "Hugo Flanker"); await c.get_by_role("radio", name="Rugby à XV").click()
            await c.fill("#ob-by", "1998"); await c.fill("#ob-h", "184"); await c.fill("#ob-w", "95"); await btn(c, "Continuer")
            await c.get_by_role("radio", name="Régional", exact=True).click(); await c.get_by_role("radio", name="Plus de 2 ans", exact=True).click(); await btn(c, "Continuer")
            await c.locator("button.pcard").first.click(); await btn(c, "Continuer")
            for i in range(await c.locator(".yn").count()): await c.locator(".yn").nth(i).get_by_role("radio", name="Non").click()
            await btn(c, "Continuer"); await c.check("#ob-consent"); await btn(c, "Continuer vers mon accès"); await c.wait_for_timeout(600)
            await c.fill("#pu-code", "SKILL-TEST234"); await btn(c, "Appliquer", exact=True)
            await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, "Envoyer mon code à Antoine"); await c.wait_for_timeout(500)
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1000)
            await c.bring_to_front(); await c.goto(URL + "?as=p1&saison=2026-10-25"); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Terrain", exact=True).first.click(); await c.wait_for_timeout(500)
            tech = c.get_by_role("radio", name="Technique")
            ok(await tech.count() == 1, "écran terrain : onglet « Technique »")
            await tech.click(); await c.wait_for_timeout(300)
            n = await c.locator("button.tcard").count()
            ok(n >= 13, "écran terrain : les fiches technique du rugby", n)
            await c.locator("button.tcard", has_text="Plaquage de face").click(); await c.wait_for_timeout(600)
            t = await c.inner_text("body")
            ok("Contact au bouclier" in t and "Sécurité" in t and "Jamais seul" in t, "fiche : niveau de contact et consignes de sécurité", t[:300])
            ok(all(x in t for x in ("Objectifs", "Physique :", "Organisation", "Consignes", "Points clés", "Variantes et progression")), "fiche : objectifs, organisation, consignes, points clés, variantes")
            await c.screenshot(path=f"{OUT}/01_fiche_plaquage.png", full_page=True)
            # joueur mineur : uniquement avec son club
            await mdb_set(c, "clients/u_p1", {"birthYear": TODAY.year - 15})
            await c.goto(URL + "?as=p1"); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Terrain", exact=True).first.click(); await c.wait_for_timeout(500)
            await c.get_by_role("radio", name="Technique").click(); await c.wait_for_timeout(300)
            await c.locator("button.tcard", has_text="Déblayage").click(); await c.wait_for_timeout(600)
            t = await c.inner_text("body")
            ok("Seulement avec ton club" in t and "moins de 18 ans" in t, "joueur mineur : contact seulement à l'entraînement de son club")
            await c.get_by_role("button", name="Retour").first.click(); await c.wait_for_timeout(300)
            await c.locator("button.tcard", has_text="Passe vissée").click(); await c.wait_for_timeout(500)
            t = await c.inner_text("body")
            ok("Sans contact" in t and "Seulement avec ton club" not in t, "fiche sans contact : pas d'avertissement")
            await mdb_set(c, "clients/u_p1", {"birthYear": 1998})

            # ---------- recettes de saison côté client ----------
            await c.goto(URL + "?as=p1&saison=2026-10-25"); await c.wait_for_timeout(1300)
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(400)
            await c.get_by_role("radio", name="Recettes").first.click(); await c.wait_for_timeout(400)
            wk = c.locator(".rcard.week")
            wt = " ".join((await wk.inner_text()).split()) if await wk.count() else ""
            ok("halloween" in wt.lower() and "Velouté de potiron" in wt, "recette du moment pendant Halloween", wt)
            await c.locator("button.chipbtn", has_text="De saison").click(); await c.wait_for_timeout(300)
            names = await c.locator(".rgrid .rcard b").all_inner_texts()
            ok(any("Velouté de potiron" in x for x in names) and not any("Fraises" in x for x in names) and "Manger Bouger" in await c.inner_text("body"), "filtre « De saison » en automne (sans les fraises)", names[:12])
            await c.screenshot(path=f"{OUT}/02_recettes_saison.png")
            await c.goto(URL + "?as=p1&saison=2027-06-20"); await c.wait_for_timeout(1300)
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(400)
            await c.get_by_role("radio", name="Recettes").first.click(); await c.wait_for_timeout(400)
            await c.locator("button.chipbtn", has_text="De saison").click(); await c.wait_for_timeout(300)
            names = await c.locator(".rgrid .rcard b").all_inner_texts()
            ok(any("Fraises" in x for x in names) and not any("Clémentines" in x for x in names), "filtre « De saison » en été (fraises, pas de clémentines)", names[:12])
            await b.close()
    finally:
        srv.terminate()
    bad = [e for e in errs if "pageerror" in e or "error:" in e]
    ok(not bad, "aucune erreur dans la console", bad[:5])
    print(f"{res['ok']} OK, {res['ko']} échecs")
    sys.exit(1 if res["ko"] else 0)

asyncio.run(run())
