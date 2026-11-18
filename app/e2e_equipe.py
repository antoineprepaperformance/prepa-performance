"""Version Claude : offre Club côté coach (src/38_equipe.js). Import d'un classeur de saison FICTIF
(fixture_saison.py : le vrai classeur d'Antoine ne va jamais dans ce dépôt public) lu dans le navigateur,
rangé dans la base (modeles/), prénoms cochés ; nouveau club recalé sur ses jours et son jour de match,
à la même période de la saison ; codes joueurs et entraîneur ; rattachement d'un client depuis sa fiche.
Vérifie surtout ce qui ne doit PAS arriver : plus aucune saison dans le code du site, pas de prénom ni
d'adversaire chez un autre club, pas de séance inventée."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
sys.path.insert(0, HERE)
import fixture_saison
PORT = 8821
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/equipe"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
XLSX = OUT + "/saison_fictive.xlsx"
NB = fixture_saison.ecrire(XLSX)
errs, fails, oks = [], [], []
TODAY = datetime.date.today()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:500]))


async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(300)


async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False


async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")
async def mdb_prefix(page, prefix): return await page.evaluate(f"(() => {{ const d = JSON.parse(localStorage.getItem('__mockdb') || '{{}}'); return Object.keys(d).filter((k) => k.startsWith({json.dumps(prefix)})).map((k) => d[k]); }})()")
async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


def wd(iso): return datetime.date.fromisoformat(iso).weekday()


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(900)
            ok(await co.evaluate("typeof CONTENT.EQUIPES") == "undefined", "plus aucune saison d'équipe dans le code du site (dépôt public)")

            # ---------- import du classeur ----------
            await btn(co, "Clubs", exact=True)
            ok(await has(co, "Importe d'abord ton classeur de saison"), "écran Clubs, onglet Clubs : invitation à importer le classeur")
            await co.get_by_role("radio", name="Modèles de saison").click(); await co.wait_for_timeout(300)
            await btn(co, "Importer un classeur")
            await co.set_input_files("#eq-file", XLSX); await co.wait_for_timeout(1500)
            ok(await has(co, f"{NB} séances lues du"), f"classeur lu dans le navigateur : {NB} séances", await co.inner_text("main"))
            ok(await has(co, "1 onglet vide ignoré"), "onglet daté laissé vide : ignoré et signalé")
            ok(await co.locator("label.chipbtn", has_text="Zébulon").count() == 1, "mots rares proposés comme prénoms possibles")
            await co.locator("label.chipbtn", has_text="Zébulon").locator("input").check()
            await co.fill("#eq-nom", "Club Modèle Test")
            await co.screenshot(path=f"{OUT}/01_import.png", full_page=True)
            await btn(co, "Enregistrer le modèle"); await co.wait_for_timeout(800)
            ms = await mdb_prefix(co, "modeles/")
            m = ms[0] if ms else {}
            ok(len(ms) == 1 and len(m.get("seances", [])) == NB and m.get("noms") == ["Zébulon"] and m.get("du") == "2025-07-07" and m.get("vides") == ["Vendredi 03 Juillet 2026"],
               "modèle rangé dans la base : séances, prénom coché, dates", {k: (v if k != "seances" else len(v)) for k, v in m.items()})
            s0 = (m.get("seances") or [{}])[0]
            ok(s0.get("theme") == "volume" and s0.get("debut") == "18h30" and s0.get("min") == 60 and [a["n"] for a in s0.get("acts", [])] == ["ECHAUFFEMENT", "Fitness Game", "Physique"],
               "séance lue comme dans le classeur : thème, horaire, durée, blocs", s0)
            ok(await has(co, "Ton modèle :") and await has(co, "Cycle 1") and await has(co, "c'est ce découpage qu'un club achète"), "le modèle s'ouvre par cycles (ce qu'un club achète)")

            # ---------- les cycles (offre club) : lus dans les phases du classeur ----------
            cyc = await co.evaluate("""(m) => { const cs = eqCycles(m);
              return { n: cs.length, total: cs.reduce((t, c) => t + c.seances.length, 0), ordre: cs.flatMap((c) => c.seances.map((s) => s.d)).join("|") === m.seances.map((s) => s.d).join("|"),
                       maxSem: Math.max(...cs.map((c) => c.nSem)), melange: cs.filter((c) => new Set(c.seances.map((s) => eqSem(s).ph)).size > 1).length,
                       t: cs.map((c) => [c.titre, c.sous, c.nSem, c.seances.length]) }; }""", m)
            ok(cyc["total"] == NB and cyc["ordre"], "les cycles reprennent toutes les séances, dans l'ordre, sans perte ni doublon", cyc)
            ok(cyc["maxSem"] <= 6 and cyc["melange"] == 0, "aucun cycle ne dépasse 6 semaines ni ne mélange présaison et saison", cyc["t"][:4])
            ok(cyc["t"][0][:2] == ["Cycle 1", "Présaison · semaines 1 à 6"] and cyc["t"][1][:2] == ["Cycle 2", "Présaison · semaines 7 à 8"] and cyc["t"][3][:2] == ["Cycle 4", "Saison · semaines 15 à 20"],
               "cycles nommés et situés : la présaison coupée à sa fin, puis la saison par 6 semaines", cyc["t"][:4])

            # ---------- nouveau club : un cycle, posé sur ses jours et son match, à sa date de début ----------
            await btn(co, "Créer un club avec ce modèle")
            await co.fill("#cl-nom", "Club Test")
            await co.get_by_role("radio", name="Un cycle").click(); await co.select_option("#cl-cycle", "4")
            await co.fill("#cl-places", "20")
            for j in ["Mardi", "Jeudi", "Lundi", "Mercredi"]:
                await co.get_by_role("button", name=j, exact=True).click(); await co.wait_for_timeout(100)
            await co.fill("#cl-heure", "19h30"); await co.select_option("#cl-match", "5")
            await co.fill("#cl-du", "2026-11-02"); await co.wait_for_timeout(300)
            await co.fill("#cl-dem", "Équipe réserve, terrain synthétique le mercredi")
            ok(await has(co, "12 séances sur 18 du modèle, en 6 semaines"), "aperçu : le cycle 4 (6 semaines × 3 séances) sur 2 jours par semaine = 12 séances", await co.inner_text("main"))
            await co.screenshot(path=f"{OUT}/02_nouveau_club.png", full_page=True)
            await btn(co, "Créer le club et ses codes"); await co.wait_for_timeout(1000)
            cs = await mdb_prefix(co, "clubs/")
            c = cs[0] if cs else {}
            S = c.get("seances", [])
            ok(len(cs) == 1 and len(S) == 12 and all(wd(s["d"]) in (0, 2) for s in S) and S[0]["d"] == "2026-11-02" and S[-1]["d"] == "2026-12-09" and all(s["debut"] == "19h30" for s in S),
               "club : 12 séances, seulement les lundis et mercredis, à 19h30, du 2 novembre au 9 décembre", [(s["d"], s.get("debut")) for s in S])
            ok(all(s.get("cycle") == 4 for s in S) and all("2025-10-13" <= s.get("modele", "") <= "2025-11-23" for s in S),
               "le club reçoit le cycle acheté, et rien d'autre", sorted({s.get("modele") for s in S})[:3])
            mer = [s for s in S if wd(s["d"]) == 2]; lun = [s for s in S if wd(s["d"]) == 0]
            ok(all(wd(s["modele"]) == 3 for s in mer) and all(wd(s["modele"]) == 1 for s in lun),
               "match le samedi : le mercredi (J-3) reçoit la séance du jeudi (J-3 avant le match du dimanche), le lundi celle du mardi (J-5)", [(s["d"], s["modele"]) for s in S])
            ok([s["modele"] for s in S] == sorted(s["modele"] for s in S), "les semaines du cycle restent dans leur ordre")
            txt = json.dumps(S, ensure_ascii=False)
            ok("Zébulon" not in txt and "un joueur" in txt and "Adversaire" not in txt and "Match" not in txt and S[0]["phase"] == "Saison - Semaine 15",
               "autre club : prénom coché, journée et adversaire retirés", S[0]["phase"])
            ok(len(S) == len({s["d"] for s in S}), "aucune séance en double, aucune inventée")
            cj = await mdb(co, "codes/" + ((c.get("codes") or {}).get("joueurs") or "x")) or {}
            ce = await mdb(co, "codes/" + ((c.get("codes") or {}).get("entraineur") or "x")) or {}
            ok(cj.get("kind") == "offert" and cj.get("offer") == "auto" and cj.get("weeks") == 6 and cj.get("max") == 20 and cj.get("club") == c.get("id") and cj.get("role") == "joueur",
               "code joueurs : Autonomie pour les 6 semaines du cycle, 20 places achetées, rattaché au club", cj)
            ok(ce.get("max") == 3 and ce.get("role") == "entraineur" and ce.get("club") == c.get("id") and ce.get("weeks") == 6, "code entraîneur : 3 places", ce)
            ok(c.get("offre") == "cycle" and c.get("cycle") == 4 and c.get("places") == 20 and c.get("demandes") == "Équipe réserve, terrain synthétique le mercredi" and c.get("match") == 5 and c.get("weeks") == 6,
               "achat et demandes du club gardés dans sa fiche", {k: c.get(k) for k in ["offre", "cycle", "places", "demandes", "match", "weeks", "jours"]})
            ok(await has(co, "Accès du club") and await has(co, cj.get("code", "???")) and await has(co, "Cycle 4 · 20 accès joueurs"), "fiche du club : ce qu'il a acheté et ses codes à partager")
            cyc_club = await co.evaluate("(c) => eqCycles(c).map((x) => [x.titre, x.sous, x.seances.length])", c)
            ok(cyc_club == [["Cycle 4", "Saison · semaines 15 à 20", 12]], "la saison du club garde le numéro du cycle acheté", cyc_club)
            await co.screenshot(path=f"{OUT}/03_club.png", full_page=True)

            # ---------- recalage : la saison à partir d'un cycle, et une date de début en milieu de semaine ----------
            rr = await co.evaluate("""(m) => { const base = { jours: [0, 2], match: 5, heure: '19h30', anon: true };
              const sai = eqRecaler(m, { ...base, du: '2026-11-02', offre: 'saison', cycle: 4 });
              const mer = eqRecaler(m, { ...base, du: '2026-11-04', offre: 'cycle', cycle: 4 });
              return { premier: sai.seances[0].modele, cyc: sai.seances[0].cycle, sems: sai.sems, n: sai.seances.length, mer: [mer.seances[0].d, mer.seances.length] }; }""", m)
            ok(rr["cyc"] == 4 and "2025-10-13" <= rr["premier"] <= "2025-10-19", "saison complète à partir du cycle 4 : elle commence à la première semaine de ce cycle", rr)
            ok(rr["mer"] == ["2026-11-09", 12], "début un mercredi : on part du lundi suivant, aucune séance du cycle perdue", rr["mer"])

            # ---------- son propre club : la saison complète, rien n'est retiré, pas d'accès joueurs ----------
            await btn(co, "‹ Retour")
            if await co.get_by_role("radio", name="Clubs").count(): await co.get_by_role("radio", name="Clubs").first.click(); await co.wait_for_timeout(300)
            await btn(co, "Nouveau club")
            await co.fill("#cl-nom", "Mon club"); await co.uncheck("label.chk input"); await co.fill("#cl-places", "0"); await co.fill("#cl-du", "2026-07-06")
            await btn(co, "Créer le club et ses codes"); await co.wait_for_timeout(1000)
            mien = [x for x in await mdb_prefix(co, "clubs/") if x.get("n") == "Mon club"]
            mc = mien[0] if mien else {}
            ok(mien and "Zébulon" in json.dumps(mc.get("seances"), ensure_ascii=False) and "Adversaire Imaginaire" in json.dumps(mc.get("seances"), ensure_ascii=False) and all(wd(s["d"]) in (1, 3) for s in mc["seances"]),
               "son propre club : notes et titres intacts, jours par défaut (mardi, jeudi)")
            ok(mc.get("offre") == "saison" and mc.get("weeks") == len({s["phase"].split(" - Match")[0] for s in m["seances"]}) and (mc.get("codes") or {}).get("joueurs") is None and (mc.get("codes") or {}).get("entraineur"),
               "saison complète : toutes les semaines du modèle ; sans accès joueurs, seul le code entraîneur est créé", {k: mc.get(k) for k in ("offre", "weeks", "codes")})
            ce2 = await mdb(co, "codes/" + ((mc.get("codes") or {}).get("entraineur") or "x")) or {}
            ok(ce2.get("weeks") == 52, "saison complète : codes de 12 mois", ce2.get("weeks"))

            # ---------- rattachement d'un client depuis sa fiche ----------
            await mdb_set(co, "clients/u_eq1", {"name": "Jo Joueur", "sportId": "rugby", "sex": "H", "height": 182, "weight": 88, "birthYear": 2000})
            await mdb_set(co, "plans/u_eq1", {"programId": "vitesse", "offer": "auto", "weeks": 4, "start": TODAY.isoformat(), "equipment": "salle", "status": "active", "niveau": "sportif",
                                               "extra": [], "message": "", "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            await co.reload(); await co.wait_for_timeout(1600)
            await btn(co, "Clients", exact=True)
            await co.locator("table.ctable tbody tr", has_text="Jo Joueur").click(); await co.wait_for_timeout(700)
            await co.get_by_role("radio", name="Sport & terrain").click(); await co.wait_for_timeout(600)
            carte = co.locator(".card", has_text="Si ce client joue dans un club")
            await carte.first.get_by_role("radio", name="Club Test").click(); await co.wait_for_timeout(900)
            prof = await mdb(co, "clients/u_eq1") or {}
            cl = [x for x in await mdb_prefix(co, "clubs/") if x.get("n") == "Club Test"][0]
            ok(prof.get("club") == cl["id"] and prof.get("clubRole") == "joueur" and (cl.get("membres") or {}).get("u_eq1") == "joueur", "rattachement : profil et membres du club (règle de lecture)", [prof.get("club"), cl.get("membres")])
            await carte.first.get_by_role("radio", name="Entraîneur").click(); await co.wait_for_timeout(800)
            cl = [x for x in await mdb_prefix(co, "clubs/") if x.get("n") == "Club Test"][0]
            ok((await mdb(co, "clients/u_eq1") or {}).get("clubRole") == "entraineur" and cl["membres"].get("u_eq1") == "entraineur", "rôle entraîneur enregistré")
            await co.screenshot(path=f"{OUT}/04_rattachement.png", full_page=True)

            # ---------- libellés vus par les joueurs et l'entraîneur : traduits (le contenu du classeur reste en français) ----------
            for lang, attendu in (("en", {"Ta séance d'équipe, ce soir": "Your team session, tonight", "Voir le détail": "See the details", "Ta saison d'équipe": "Your team season",
                                          "Ouvrir la saison": "Open the season", "Lancer la séance au minuteur": "Start the session on the timer", "Match : Saturday": "Match: Saturday", "Présaison · W2": "Pre-season · W2"}),
                                  ("es", {"Ta séance d'équipe, ce soir": "Tu sesión de equipo, esta noche", "Voir le détail": "Ver el detalle", "Ta saison d'équipe": "Tu temporada de equipo",
                                          "Ouvrir la saison": "Abrir la temporada", "Lancer la séance au minuteur": "Iniciar la sesión con el temporizador", "Match : Sábado": "Partido: Sábado", "Présaison · S2": "Pretemporada · S2"})):
                lp = await A.new_page(); hook(lp, "langue-" + lang)
                await lp.goto(URL + f"?lang={lang}"); await lp.wait_for_timeout(1000)
                got = await lp.evaluate("(ks) => { const o = {}; ks.forEach((k) => { o[k] = tr(k); }); return o; }", list(attendu))
                ok(got == attendu, f"libellés de l'équipe traduits en {lang}", got)
                # jours et semaines déjà dans la langue de la personne, avant toute traduction
                sub = await lp.evaluate("[eqClubSub({ jours: [0, 2], heure: '19h30', match: 5, du: '2026-11-02', au: '2026-11-25' }), eqPhaseCourte({ phase: 'Présaison - Semaine 2' })]")
                ok(sub[0].startswith({"en": "Monday · Wednesday · 19h30 · Match : Saturday", "es": "Lunes · Miércoles · 19h30 · Match : Sábado"}[lang]) and sub[1] == {"en": "Présaison · W2", "es": "Présaison · S2"}[lang],
                   f"jours de la semaine et lettre de semaine en {lang}", sub)
                await lp.close()
            await b.close()
    finally:
        srv.terminate()


asyncio.run(run())
print(f"\n{len(oks)} OK, {len(fails)} échecs")
for e in errs[:12]: print("  console:", e)
sys.exit(1 if fails or any("pageerror" in e for e in errs) else 0)
