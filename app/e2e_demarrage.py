"""Les premiers jours (35_demarrage.js) : deux chantiers du comparatif, les deux chez le debutant.
1) Activation de la premiere semaine : un seul cap, deux seances dans les 7 premiers jours, et Antoine
   prevenu des le 3e jour si le client n'a JAMAIS rien fait (au lieu du 7e).
2) Carte athlete lisible pour qui debute : ses propres progres en avant, le pourcentage d'un record du
   monde dans un volet replie. Rien n'est cache, et rien ne change pour les profils confirmes."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8785
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/demarrage"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def mdb_put(page, path, doc):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = x; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, doc])


async def mdb_del(page, prefix):
    await page.evaluate("(pre) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); Object.keys(db).forEach((k) => { if (k.indexOf(pre) === 0) delete db[k]; }); localStorage.setItem('__mockdb', JSON.stringify(db)); }", prefix)


async def seed(page, uid, prof, plan):
    await mdb_set(page, "clients/" + uid, prof)
    await mdb_set(page, "plans/" + uid, {"offer": "suivi", "weeks": 12, "equipment": "salle", "status": "active",
                                          "extra": [], "message": "", "validatedAt": "2026-10-01T00:00:00.000Z",
                                          "reviewedAt": "2026-10-01T00:00:00.000Z", **plan})


async def resume(page, uid):
    """Le coach lit le resume publie par le client (profile.sum), ecrit normalement par saveLog. Comme on
    seede les seances directement dans la base simulee, on recalcule ce resume avec la vraie fonction de
    l'application, sinon le coach verrait des chiffres perimes."""
    await page.evaluate("""(uid) => {
      const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
      const pick = (pre) => Object.fromEntries(Object.entries(db).filter(([k]) => k.indexOf(pre) === 0).map(([k, v]) => [k.slice(pre.length), v]));
      const d = { profile: db['clients/' + uid], plan: db['plans/' + uid], logs: pick('clients/' + uid + '/logs/'),
                  checkins: pick('clients/' + uid + '/checkins/'), videos: {}, ai: {}, messages: {}, libres: {} };
      db['clients/' + uid] = { ...d.profile, sum: summarize(d) };
      localStorage.setItem('__mockdb', JSON.stringify(db));
    }""", uid)


async def seances(page, uid, n, start):
    """n seances faites depuis le depart du plan, sur les types reels du programme."""
    await mdb_del(page, "clients/" + uid + "/logs/")
    ids = await page.evaluate("""(pid) => { const p = progOf(pid, null); return p.blocks[0].sessions.map((s) => s.id); }""",
                              await page.evaluate("JSON.parse(localStorage.getItem('__mockdb'))['plans/" + uid + "'].programId"))
    for k in range(n):
        sid = ids[k % len(ids)]
        await mdb_put(page, "clients/" + uid + "/logs/w1-" + sid, {"key": "w1-" + sid, "w": 1, "sid": sid,
            "date": (datetime.date.fromisoformat(start) + datetime.timedelta(days=k)).isoformat(),
            "title": "x", "items": [], "rpe": 7, "duree": 50, "load": 350, "douleur": 0, "zone": "", "comment": ""})
    await resume(page, uid)


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=dm1"); await c.evaluate("localStorage.removeItem('__mockdb')")
            # debutante, programme demarre il y a 2 jours, rien de fait
            start = (TODAY - datetime.timedelta(days=2)).isoformat()
            await seed(c, "u_dm1", {"name": "Nina Neuve", "sex": "F", "height": 168, "weight": 64, "birthYear": 1997},
                      {"programId": "perte", "start": start, "niveau": "reprise"})
            await c.reload(); await c.wait_for_timeout(1400)
            txt = await c.inner_text("body")
            ok("Tes débuts : 0 séance sur 2" in txt, "jour 3, rien de fait : un seul cap affiche, deux seances", txt[:400])
            ok("Pas plus." in txt, "le cap est annonce comme le seul qui compte pour l'instant")
            ok("série" not in txt.lower().replace("séries", "") or "streak" not in txt.lower(), "aucune serie de jours ni badge : refuse volontairement")
            await c.screenshot(path=f"{OUT}/01_jour3_rien.png", full_page=True)

            # ---------- une seance faite : il en reste une ----------
            await seances(c, "u_dm1", 1, start)
            await c.reload(); await c.wait_for_timeout(1400)
            txt = await c.inner_text("body")
            ok("Tes débuts : 1 séance sur 2" in txt and "Encore 1 séance" in txt, "une seance faite : il en reste une, dit simplement", txt[:300])

            # ---------- les deux faites : le cap est passe ----------
            await seances(c, "u_dm1", 2, start)
            await c.reload(); await c.wait_for_timeout(1400)
            txt = await c.inner_text("body")
            ok("deux premières séances sont faites" in txt, "cap passe : message de reussite", txt[:300])
            ok("tiennent sur la durée" in txt, "le pourquoi est dit, sans promettre de resultats sportifs")
            await c.screenshot(path=f"{OUT}/02_cap_passe.png", full_page=True)

            # ---------- apres 7 jours : la carte disparait ----------
            old = (TODAY - datetime.timedelta(days=9)).isoformat()
            await mdb_set(c, "plans/u_dm1", {"start": old})
            await seances(c, "u_dm1", 2, old)
            await c.reload(); await c.wait_for_timeout(1400)
            txt = await c.inner_text("body")
            ok("Tes débuts" not in txt and "deux premières séances sont faites" not in txt,
               "au-dela de la premiere semaine : la carte de demarrage disparait", txt[:200])

            # ---------- un client qui enchaine un 2e programme n'est pas un debutant ----------
            await mdb_set(c, "plans/u_dm1", {"start": start})
            await seances(c, "u_dm1", 1, start)
            await mdb_put(c, "clients/u_dm1/logs/old-A", {"key": "old-A", "w": 1, "sid": "A",
                "date": (TODAY - datetime.timedelta(days=60)).isoformat(), "title": "x", "items": [],
                "rpe": 7, "duree": 50, "load": 350, "douleur": 0, "zone": "", "comment": ""})
            await c.reload(); await c.wait_for_timeout(1400)
            txt = await c.inner_text("body")
            ok("Tes débuts" not in txt, "client qui a deja des seances avant ce programme : pas de message de bienvenue", txt[:200])

            # ---------- cote coach : jamais demarre, alerte des le 3e jour ----------
            await mdb_del(c, "clients/u_dm1/logs/"); await resume(c, "u_dm1")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(900)
            ctxt = await co.locator(".card", has_text="À traiter").inner_text()
            ok("Jamais démarré (3 jours) : relancer" in ctxt, "coach : alerte des le 3e jour pour un client qui n'a jamais rien fait", ctxt[:400])
            ok("Aucune séance depuis" not in ctxt, "coach : l'alerte d'inactivite ne fait pas doublon avec celle-ci")
            await co.screenshot(path=f"{OUT}/03_coach_jamais_demarre.png", full_page=True)

            # une seance faite : l'alerte de demarrage tombe
            await seances(c, "u_dm1", 1, start)
            await co.reload(); await co.wait_for_timeout(1400)
            ctxt = await co.locator(".card", has_text="À traiter").inner_text()
            ok("Jamais démarré" not in ctxt, "coach : des qu'une seance est faite, l'alerte de demarrage disparait", ctxt[:300])

            # un client lance depuis longtemps garde l'alerte d'inactivite habituelle
            await mdb_set(c, "plans/u_dm1", {"start": (TODAY - datetime.timedelta(days=30)).isoformat()})
            await mdb_del(c, "clients/u_dm1/logs/")
            await mdb_put(c, "clients/u_dm1/logs/w1-A", {"key": "w1-A", "w": 1, "sid": "A",
                "date": (TODAY - datetime.timedelta(days=20)).isoformat(), "title": "x", "items": [],
                "rpe": 7, "duree": 50, "load": 350, "douleur": 0, "zone": "", "comment": ""})
            await resume(c, "u_dm1")
            await co.reload(); await co.wait_for_timeout(1400)
            ctxt = await co.locator(".card", has_text="À traiter").inner_text()
            ok("Aucune séance depuis 20 j" in ctxt and "Jamais démarré" not in ctxt,
               "client deja lance : l'alerte d'inactivite habituelle fonctionne toujours", ctxt[:400])

            # ---------- carte athlete : qui debute lit ses propres progres ----------
            await c.bring_to_front()
            await mdb_set(c, "plans/u_dm1", {"start": (TODAY - datetime.timedelta(days=60)).isoformat(), "niveau": "reprise"})
            await mdb_put(c, "clients/u_dm1/tests/t0", {"w": 0, "at": (TODAY - datetime.timedelta(days=60)).isoformat(),
                                                         "values": {"poids": 64, "sdt": 50, "sprint30": 6.2}})
            await mdb_put(c, "clients/u_dm1/tests/t4", {"w": 4, "at": (TODAY - datetime.timedelta(days=30)).isoformat(),
                                                         "values": {"poids": 62, "sdt": 60, "sprint30": 5.9}})
            await c.reload(); await c.wait_for_timeout(1400)
            await c.get_by_role("button", name="Mon profil").click(); await c.wait_for_timeout(900)
            txt = await c.inner_text("body")
            low = txt.lower()
            ok("mes tests : mes progrès" in low, "profil Reprise : la carte met en avant ses propres progres", txt[:300])
            ok("depuis ton premier test" in txt and "de mieux" in txt, "progres chiffres par rapport a son propre premier test", txt[low.find("mes tests"):low.find("mes tests") + 400])
            ok("toi contre toi, pas toi contre un champion du monde" in txt, "le choix de repere est explique au client")
            ok("% du record" not in txt, "le pourcentage du record du monde n'est pas affiche d'emblee a un debutant", txt[low.find("mes tests"):low.find("mes tests") + 500])
            # rien n'est cache : le volet existe et contient bien les records
            await c.get_by_text("Voir aussi la comparaison avec les records du monde").click(); await c.wait_for_timeout(300)
            txt2 = await c.inner_text("body")
            ok("% du record" in txt2, "rien n'est cache : le volet replie contient bien la comparaison aux records", txt2[txt2.find("Voir aussi"):txt2.find("Voir aussi") + 300])
            ok("ce n'est pas une note sur toi" in txt2, "le volet remet le pourcentage a sa place")
            await c.screenshot(path=f"{OUT}/04_carte_debutante.png", full_page=True)

            # ---------- un profil confirme garde la carte telle qu'elle etait ----------
            ce = await A.new_page(); hook(ce, "elite")
            await ce.goto(URL + "?as=dm2"); await ce.wait_for_timeout(600)
            await seed(ce, "u_dm2", {"name": "Eva Elite", "sportId": "rugby", "sex": "F", "height": 175, "weight": 72, "birthYear": 1996},
                      {"programId": "force", "start": (TODAY - datetime.timedelta(days=60)).isoformat(), "niveau": "elite"})
            await mdb_put(ce, "clients/u_dm2/tests/t0", {"w": 0, "at": (TODAY - datetime.timedelta(days=60)).isoformat(),
                                                          "values": {"poids": 72, "sdt": 120, "sprint30": 4.6}})
            await mdb_put(ce, "clients/u_dm2/tests/t4", {"w": 4, "at": (TODAY - datetime.timedelta(days=30)).isoformat(),
                                                          "values": {"poids": 72, "sdt": 130, "sprint30": 4.5}})
            await ce.reload(); await ce.wait_for_timeout(1400)
            await ce.get_by_role("button", name="Mon profil").click(); await ce.wait_for_timeout(900)
            etxt = await ce.inner_text("body")
            elow = etxt.lower()
            ok("mes tests face aux records du monde" in elow and "% du record" in etxt,
               "profil Haut niveau : la comparaison aux records reste en avant, rien ne change pour lui", etxt[elow.find("mes tests"):elow.find("mes tests") + 300])
            ok("mes tests : mes progrès" not in elow and "Voir aussi la comparaison" not in etxt,
               "profil Haut niveau : pas de bascule vers la vue debutant")
            await ce.screenshot(path=f"{OUT}/05_carte_elite.png", full_page=True)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
