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
            await btn(co, "Équipe", exact=True)
            ok(await has(co, "Importe d'abord ton classeur de saison."), "écran Équipe : invitation à importer le classeur")
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
            ok(await has(co, "Ton modèle :"), "le modèle s'ouvre comme une saison (archive, minuteur)")

            # ---------- nouveau club : recalé sur ses jours, son match, la période de la saison ----------
            await btn(co, "Créer un club avec ce modèle")
            await co.fill("#cl-nom", "Club Test")
            for j in ["Mardi", "Jeudi", "Lundi", "Mercredi"]:
                await co.get_by_role("button", name=j, exact=True).click(); await co.wait_for_timeout(100)
            await co.fill("#cl-heure", "19h30"); await co.select_option("#cl-match", "5")
            await co.fill("#cl-du", "2026-11-02"); await co.get_by_role("radio", name="1 mois").click(); await co.wait_for_timeout(300)
            await co.fill("#cl-dem", "Équipe réserve, terrain synthétique le mercredi")
            ok(await has(co, "8 séances du 2 nov. au 25 nov.") or await has(co, "8 séances du"), "aperçu : 8 séances (4 semaines × 2 jours)", await co.inner_text("main"))
            await co.screenshot(path=f"{OUT}/02_nouveau_club.png", full_page=True)
            await btn(co, "Créer le club et ses codes"); await co.wait_for_timeout(1000)
            cs = await mdb_prefix(co, "clubs/")
            c = cs[0] if cs else {}
            S = c.get("seances", [])
            ok(len(cs) == 1 and len(S) == 8 and all(wd(s["d"]) in (0, 2) for s in S) and S[0]["d"] >= "2026-11-02" and all(s["debut"] == "19h30" for s in S),
               "club : séances seulement les lundis et mercredis, à 19h30, à partir du 2 novembre", [(s["d"], s.get("debut")) for s in S])
            ok(all(s.get("modele", "").startswith("2025-11") for s in S[:2]) and all("Saison - Semaine" in s["phase"] for s in S),
               "même période de la saison : un club qui démarre en novembre reçoit les séances de novembre, pas la présaison", [(s["d"], s.get("modele"), s["phase"]) for s in S[:4]])
            mer = [s for s in S if wd(s["d"]) == 2]; lun = [s for s in S if wd(s["d"]) == 0]
            ok(all(wd(s["modele"]) == 3 for s in mer) and all(wd(s["modele"]) == 1 for s in lun),
               "match le samedi : le mercredi (J-3) reçoit la séance du jeudi (J-3 avant le match du dimanche), le lundi celle du mardi (J-5)", [(s["d"], s["modele"]) for s in S])
            txt = json.dumps(S, ensure_ascii=False)
            ok("Zébulon" not in txt and "un joueur" in txt and "Adversaire" not in txt, "autre club : prénom coché et adversaire retirés")
            ok(len(S) == len({s["d"] for s in S}), "aucune séance en double, aucune inventée")
            cj = await mdb(co, "codes/" + (c.get("codes") or {}).get("joueurs", "x")) or {}
            ce = await mdb(co, "codes/" + (c.get("codes") or {}).get("entraineur", "x")) or {}
            ok(cj.get("kind") == "offert" and cj.get("offer") == "auto" and cj.get("weeks") == 4 and cj.get("max") == 30 and cj.get("club") == c.get("id") and cj.get("role") == "joueur",
               "code joueurs : Autonomie 1 mois, 30 places, rattaché au club", cj)
            ok(ce.get("max") == 3 and ce.get("role") == "entraineur" and ce.get("club") == c.get("id"), "code entraîneur : 3 places", ce)
            ok(c.get("demandes") == "Équipe réserve, terrain synthétique le mercredi" and c.get("match") == 5 and c.get("weeks") == 4, "demandes du club gardées dans sa fiche", {k: c.get(k) for k in ["demandes", "match", "weeks", "jours"]})
            ok(await has(co, "Accès du club") and await has(co, cj.get("code", "???")), "fiche du club : ses codes à partager")
            await co.screenshot(path=f"{OUT}/03_club.png", full_page=True)
            # son propre club : rien n'est retiré
            await btn(co, "‹ Retour"); await btn(co, "Nouveau club")
            await co.fill("#cl-nom", "Mon club"); await co.uncheck("label.chk input"); await co.fill("#cl-du", "2026-11-02")
            await btn(co, "Créer le club et ses codes"); await co.wait_for_timeout(1000)
            mien = [x for x in await mdb_prefix(co, "clubs/") if x.get("n") == "Mon club"]
            ok(mien and "Zébulon" in json.dumps(mien[0].get("seances"), ensure_ascii=False) and all(wd(s["d"]) in (1, 3) for s in mien[0]["seances"]),
               "son propre club : notes intactes, jours par défaut (mardi, jeudi)")
            ms_ = [x["d"] for x in (mien[0]["seances"] if mien else [])]
            ok(any(d.startswith("2027-07") for d in ms_) and not any("2027-06-27" <= d <= "2027-07-04" for d in ms_) and max(ms_ or ["0"]) <= "2027-11-01",
               "12 mois : la trêve d'été reste une trêve, la présaison revient en juillet, rien après le terme", [min(ms_ or [""]), max(ms_ or [""]), len(ms_)])

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
