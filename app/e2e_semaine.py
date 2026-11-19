"""Repartition de la semaine (profile.semaine : src/27_materiel.js, src/01_core.js, src/04_client.js) :
le client choisit combien de jours il s'entraine ET quel jour porte quelle seance, et sa page du jour suit
cette repartition (seance du jour, jour de repos, seance a rattraper).

Verifie surtout ce qui ne doit PAS arriver : descendre sous le nombre de seances propres du programme,
perdre une seance deja cochee quand la grille change, et ecraser les jours d'un programme importe (seances
calees par le coach)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8857
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/semaine"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()
JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
AUJ = JOURS[TODAY.weekday()]


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def dans(a, b):
    return (a or "").lower() in (b or "").lower()


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 900}, color_scheme="dark")
            cl = await A.new_page(); hook(cl, "client")
            await cl.goto(URL + "?as=p1"); await cl.evaluate("localStorage.removeItem('__mockdb')")
            lundi = (TODAY - datetime.timedelta(days=TODAY.weekday())).isoformat()
            await mdb_set(cl, "clients/u_p1", {"name": "Léa Semaine", "sportId": "rugby", "sex": "F", "height": 170, "weight": 65, "birthYear": 1998})
            await mdb_set(cl, "plans/u_p1", {"programId": "masse", "offer": "suivi2", "weeks": 12, "start": lundi, "equipment": "salle", "status": "active",
                                              "niveau": "sportif", "extra": [], "message": "", "cycle": 1,
                                              "validatedAt": "2026-11-01T00:00:00.000Z", "reviewedAt": "2026-11-01T00:00:00.000Z"})
            await cl.reload(); await cl.wait_for_timeout(1500)

            # ---------- la logique, avant toute grille ----------
            base = await cl.evaluate("""() => {
              const prog = PB.masse, plan = { programId: "masse", weeks: 12, niveau: "sportif" };
              const s = weekSessions(prog, plan, 1, {});
              return { n: s.length, jours: s.map((x) => x.jour || null), cles: s.map((x) => x.key), nat: natFreq(prog) };
            }""")
            ok(base["n"] == 3 and all(j is None for j in base["jours"]), "sans répartition choisie : la semaine reste une liste de séances, sans jour", base)
            ok(base["nat"] == 3, "le programme a 3 séances propres par semaine", base["nat"])

            # ---------- la grille par defaut et ses bornes ----------
            g = await cl.evaluate("""() => ({
              trois: semaineDefaut(PB.masse, 3), cinq: semaineDefaut(PB.masse, 5), sept: semaineDefaut(PB.masse, 7),
              compte: semaineCount(semaineDefaut(PB.masse, 5)), txt: semaineTxt(semaineDefaut(PB.masse, 3)),
              lu: semaineOf({ semaine: ["A", null, "B", null, "C", null, null] }), refus: semaineOf({ semaine: [1, 2] }),
              rythme: rythmeOf({ semaine: ["A", "A", null, "B", null, "C", null] }),
            })""")
            ok(g["trois"] == ["A", None, "B", None, "C", None, None], "3 jours : lundi, mercredi, vendredi, espacés", g["trois"])
            ok(g["cinq"] == ["A", "B", "C", None, "A", "B", None] and g["compte"] == 5, "5 jours : les séances reviennent en boucle, sans jamais 3 jours d'affilée en fin de semaine", g["cinq"])
            ok(g["sept"][6] is not None and g["sept"].count(None) == 0, "7 jours : tous les jours occupés", g["sept"])
            ok(g["txt"] == "Lundi A · Mercredi B · Vendredi C", "résumé lisible de la répartition (jours en entier : un jour abrégé ne se traduit pas sans risque)", g["txt"])
            ok(g["lu"] is not None and g["refus"] is None, "une grille mal formée est ignorée plutôt que de casser l'affichage", {"lu": g["lu"], "refus": g["refus"]})
            ok(g["rythme"] == 4, "le rythme découle de la grille : 4 jours occupés = 4 séances par semaine", g["rythme"])

            # ---------- la semaine suit la grille, et les clefs ne changent pas ----------
            suit = await cl.evaluate("""() => {
              const prog = { ...PB.masse, semaine: ["A", "A", null, "B", null, "C", null] };
              const s = weekSessions(prog, { programId: "masse", weeks: 12, niveau: "sportif" }, 3, {});
              return { n: s.length, jours: s.map((x) => x.jour), sids: s.map((x) => x.sid), cles: s.map((x) => x.key) };
            }""")
            ok(suit["n"] == 4 and suit["jours"] == [1, 2, 4, 6] and suit["sids"] == ["A", "A", "B", "C"],
               "chaque jour choisi reçoit la séance qu'on y a placée, dans l'ordre de la semaine", suit)
            ok(suit["cles"] == ["w3-A", "w3-Ar1", "w3-B", "w3-C"],
               "les clefs restent celles d'avant : une séance déjà cochée reste reconnue", suit["cles"])

            # ---------- un programme aux seances calees garde SES jours ----------
            cale = await cl.evaluate("""() => {
              const prog = { id: "x", blocks: [{ n: "B1", focus: "f", sessions: [
                { id: "A", wib: 1, t: "Séance de la semaine 1", focus: "", lieu: "salle", wu: "", items: [] },
                { id: "B", wib: 2, t: "Séance de la semaine 2", focus: "", lieu: "salle", wu: "", items: [] }] }],
                semaine: ["A", "A", "A", "A", "A", "A", "A"] };
              const s = weekSessions(prog, { programId: "x", weeks: 12, niveau: "sportif" }, 1, {});
              return { n: s.length, sids: s.map((x) => x.sid), jours: s.map((x) => x.jour || null) };
            }""")
            ok(cale["n"] == 1 and cale["sids"] == ["A"] and cale["jours"] == [None],
               "programme importé (séances calées par le coach) : la grille du client ne l'écrase pas", cale)

            # ---------- le client choisit, dans son profil ----------
            await cl.get_by_role("button", name="Mon profil").first.click(); await cl.wait_for_timeout(700)
            await cl.get_by_role("button", name="Modifier").first.click(); await cl.wait_for_timeout(700)
            t = await cl.inner_text(".modal")
            ok(dans("Jours d'entraînement par semaine", t) and dans("Ma répartition dans la semaine", t),
               "le profil propose le nombre de jours ET la répartition", t[:300])
            await cl.locator("#pe-ry-5").click(); await cl.wait_for_timeout(400)
            vals = [await cl.locator(f"#pe-sem-{i}").input_value() for i in range(7)]
            ok(vals == ["A", "B", "C", "", "A", "B", ""], "choisir 5 jours répartit tout de suite les séances sur la semaine", vals)
            await cl.select_option("#pe-sem-3", "C"); await cl.wait_for_timeout(300)
            txt = await cl.inner_text(".modal")
            ok(dans("6 jours d'entraînement", txt), "placer une séance un jour de plus met le compte à jour", txt[txt.find("jour"):][:120])
            await cl.select_option("#pe-sem-3", ""); await cl.wait_for_timeout(200)
            await cl.screenshot(path=f"{OUT}/01_repartition.png", full_page=True)
            await cl.locator(".modal").get_by_role("button", name="Enregistrer").click(); await cl.wait_for_timeout(1200)
            prof = await cl.evaluate("() => JSON.parse(localStorage.getItem('__mockdb') || '{}')['clients/u_p1']")
            ok(prof.get("semaine") == ["A", "B", "C", None, "A", "B", None] and prof.get("rythme") == 5,
               "la répartition est enregistrée dans le profil, avec son nombre de jours", {k: prof.get(k) for k in ("semaine", "rythme")})
            p2 = await cl.inner_text("body")
            ok(dans("Lundi A · Mardi B · Mercredi C · Vendredi A · Samedi B", p2), "le profil affiche la répartition choisie", p2[:400])

            # ---------- la page du jour suit la repartition ----------
            await cl.locator("nav.tabbar button", has_text="Aujourd'hui").first.click(); await cl.wait_for_timeout(1200)
            j = await cl.inner_text("body")
            attendu = ["A", "B", "C", None, "A", "B", None][TODAY.weekday()]
            if attendu:
                ok(dans("aujourd'hui :", j), f"jour d'entraînement ({AUJ}) : la séance du jour est annoncée", j[:300])
            else:
                ok(dans("repos aujourd'hui", j), f"jour de repos ({AUJ}) : l'application le dit, et annonce la prochaine séance", j[:300])
            ok(dans("Lundi A · Mardi B · Mercredi C", j), "la semaine affiche la répartition en sous-titre", j[j.find("Semaine"):j.find("Semaine") + 200])
            ok(dans("Lundi", j) and dans("Mardi", j), "chaque séance de la semaine porte son jour", j[:600])
            await cl.screenshot(path=f"{OUT}/02_page_du_jour.png", full_page=True)

            # ---------- une seance deja cochee reste cochee apres un changement de grille ----------
            await mdb_set(cl, "clients/u_p1/logs/w1-A", {"date": lundi, "done": ["sq"], "rpe": 7, "at": lundi + "T18:00:00.000Z"})
            await mdb_set(cl, "clients/u_p1", {"semaine": ["A", None, "B", None, "C", "A", None], "rythme": 4})
            await cl.reload(); await cl.wait_for_timeout(1500)
            faite = await cl.evaluate("""() => {
              const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
              const prog = persoProg(PB.masse, db['clients/u_p1']);
              const s = weekSessions(prog, db['plans/u_p1'], 1, {});
              return { cles: s.map((x) => x.key), faite: !!db['clients/u_p1/logs/' + s[0].key] };
            }""")
            ok(faite["faite"], "après un changement de répartition, la séance déjà faite est toujours reconnue", faite)

            # ---------- le chemin court : « Mes jours » depuis la page du jour ----------
            # Antoine n'a pas trouve le reglage dans son profil : il doit s'ouvrir la ou on voit sa semaine.
            await cl.evaluate("localStorage.removeItem('__mockdb')")
            await mdb_set(cl, "clients/u_p1", {"name": "Léa Semaine", "sportId": "rugby", "sex": "F", "height": 170, "weight": 65, "birthYear": 1998})
            await mdb_set(cl, "plans/u_p1", {"programId": "masse", "offer": "suivi2", "weeks": 12, "start": lundi, "equipment": "salle", "status": "active",
                                              "niveau": "sportif", "extra": [], "message": "", "cycle": 1,
                                              "validatedAt": "2026-11-01T00:00:00.000Z", "reviewedAt": "2026-11-01T00:00:00.000Z"})
            await cl.reload(); await cl.wait_for_timeout(1600)
            inv = await cl.inner_text("body")
            ok(dans("Choisis tes jours", inv) and await cl.get_by_role("button", name="Choisir mes jours").count() == 1,
               "sans répartition : la carte de la semaine invite à choisir ses jours, avec le bouton", inv[:200])
            await cl.get_by_role("button", name="Choisir mes jours").first.click(); await cl.wait_for_timeout(700)
            f = await cl.locator(".modal").inner_text()
            ok(dans("Mes jours d'entraînement", f) and dans("Combien de séances par semaine", f) and dans("Quel jour, quelle séance", f),
               "la fenêtre ne demande que ça : combien de séances, et quel jour", f[:220])
            await cl.locator("#sj-ry-4").click(); await cl.wait_for_timeout(300)
            await cl.select_option("#sj-sem-5", "C"); await cl.wait_for_timeout(300)
            await cl.locator(".modal").get_by_role("button", name="Enregistrer mes jours").click(); await cl.wait_for_timeout(1200)
            pr = await cl.evaluate("() => JSON.parse(localStorage.getItem('__mockdb') || '{}')['clients/u_p1']")
            ok(pr.get("semaine") == ["A", "B", None, "C", "A", "C", None] and pr.get("rythme") == 5,
               "deux gestes suffisent : 4 séances réparties, plus une le samedi", {k: pr.get(k) for k in ("semaine", "rythme")})
            ap = await cl.inner_text("body")
            ok(dans("Lundi A · Mardi B · Jeudi C · Vendredi A · Samedi C", ap) and await cl.get_by_role("button", name="Mes jours", exact=True).count() == 1,
               "la semaine affiche la nouvelle répartition, et le bouton devient « Mes jours »", ap[:300])
            await cl.screenshot(path=f"{OUT}/03_mes_jours.png", full_page=True)

            # ---------- la version large de la page du jour ----------
            # Lecon du 19 novembre : la page a deux rendus (telephone et large). Une « const » declaree
            # apres le retour de la version large n'existe pas encore quand il s'execute (zone morte) :
            # le reglage marchait au telephone et cassait l'apercu du coach. On verifie donc les deux.
            large = await A.new_page(); hook(large, "large")
            await large.set_viewport_size({"width": 1280, "height": 900})
            await large.goto(URL + "?as=p1"); await large.wait_for_timeout(1600)
            lt = await large.inner_text("body")
            ok("problème d'affichage" not in lt.lower(), "page du jour en version large : elle s'affiche", lt[:200])
            ok(await large.get_by_role("button", name="Mes jours", exact=True).count() >= 1, "le bouton « Mes jours » est là aussi en version large")
            await large.get_by_role("button", name="Mes jours", exact=True).first.click(); await large.wait_for_timeout(700)
            ok(await large.locator(".modal").count() == 1, "la fenêtre s'ouvre en version large")
            await large.close()

            # ---------- les textes de la repartition, traduits ----------
            for lang, att in (("en", {"Ma répartition dans la semaine": "My week layout", "Lundi": "Monday", "Répartir automatiquement": "Spread automatically",
                                      "5 jours d'entraînement par semaine.": "5 training days per week.", "Léa, repos aujourd'hui": "Léa, rest day today",
                                      "Léa, aujourd'hui : bas du corps + poussée": "Léa, today: lower body + push", "3 séances à rattraper.": "3 sessions to catch up."}),
                              ("es", {"Ma répartition dans la semaine": "Mi reparto en la semana", "Jeudi": "Jueves", "à rattraper": "por recuperar",
                                      "1 jour d'entraînement par semaine.": "1 día de entrenamiento por semana."})):
                lp = await A.new_page(); hook(lp, "langue-" + lang)
                await lp.goto(URL + f"?as=p1&lang={lang}"); await lp.wait_for_timeout(1600)
                got = await lp.evaluate("(ks) => { const o = {}; ks.forEach((k) => { o[k] = tr(k); }); return o; }", list(att))
                manque = {k: v for k, v in got.items() if v != att[k]}
                ok(not manque, f"les textes de la répartition sont traduits en {lang}, motifs compris", manque)
                await lp.close()

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
