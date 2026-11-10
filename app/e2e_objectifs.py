"""Deux axes d'objectifs indépendants (33_objectifs.js) : le programme reste l'axe entraînement,
profil.corps devient l'axe composition corporelle, choisi à part. Quand les deux tirent en sens opposés
(force + perte de gras = recomposition) on l'annonce avec ses conditions, les protéines montent à
2 g/kg/j et le succès se juge sur les circonférences et les charges, pas sur le poids.
Vérifie aussi qu'un client existant sans profil.corps continue de marcher (axe déduit du programme)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8781
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/objectifs"; os.makedirs(OUT, exist_ok=True)
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


async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)


async def mdb(page, path):
    return await page.evaluate("(p) => JSON.parse(localStorage.getItem('__mockdb') || '{}')[p]", path)


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def seed(page, uid, prof, plan):
    await mdb_set(page, "clients/" + uid, prof)
    await mdb_set(page, "plans/" + uid, {"offer": "suivi", "weeks": 12, "equipment": "salle", "status": "active",
                                          "niveau": "sportif", "extra": [], "message": "",
                                          "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z", **plan})


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=obj1"); await c.evaluate("localStorage.removeItem('__mockdb')")

            # ---------- inscription : les deux axes sont deux questions séparées ----------
            start = (TODAY - datetime.timedelta(days=28 * 2)).isoformat()
            await c.wait_for_timeout(900)
            txt = await c.inner_text("body")
            ok("Mon suivi" in txt or "Commencer" in txt or "Antoine" in txt, "application chargée")

            # client existant SANS profil.corps : l'axe doit être déduit du programme, sans migration
            await seed(c, "u_obj1", {"name": "Leo Legacy", "sportId": "rugby", "sex": "H", "height": 178, "weight": 92, "birthYear": 1996},
                       {"programId": "masse", "start": start})
            await c.reload(); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Mon profil").click(); await c.wait_for_timeout(600)
            ptxt = await c.inner_text("body")
            ok("Mes objectifs" in ptxt, "profil : carte « Mes objectifs » affichée")
            coch = await c.locator("#pf-obj-corps").get_by_role("radio", name="Prendre du muscle").get_attribute("aria-checked")
            ok(coch == "true" and "Prise de muscle" in ptxt,
               "client existant sans profil.corps : axe deduit du programme (masse -> prendre du muscle), rien a migrer", {"aria-checked": coch})
            ok("recomposition" not in ptxt.lower(), "masse + prendre du muscle : aucun compromis annoncé (les deux axes vont dans le même sens)")
            await c.screenshot(path=f"{OUT}/01_profil_deduit.png", full_page=True)

            # ---------- le client change d'axe : force + perdre du gras = compromis annoncé ----------
            await seed(c, "u_obj1", {}, {"programId": "force"})
            await c.reload(); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Mon profil").click(); await c.wait_for_timeout(600)
            await c.locator("#pf-obj-corps").get_by_role("radio", name="Perdre du gras").click(); await c.wait_for_timeout(700)
            prof = await mdb(c, "clients/u_obj1") or {}
            ok(prof.get("corps") == "perte" and prof.get("corpsAt") == TODAY.isoformat(),
               "axe composition corporelle enregistré dans le profil, avec sa date", {"corps": prof.get("corps"), "corpsAt": prof.get("corpsAt")})
            rtxt = await c.inner_text("body")
            ok("recomposition corporelle" in rtxt, "force + perdre du gras : la recomposition est nommée et expliquée")
            ok("plus lentement" in rtxt, "compromis annoncé franchement : les deux avancent plus lentement qu'un seul")
            # IMC 92/1,78² ≈ 29 → fenêtre large
            ok("cas le plus favorable" in rtxt, "fenêtre estimée d'après le profil (IMC ≈ 29 → la plus favorable)", rtxt[:400])
            ok("1,6" in rtxt and "2,4" in rtxt, "condition citée : protéines élevées (1,6 à 2,4 g/kg/j)")
            ok("pas la balance" in rtxt, "mesure du succès annoncée : charges, tests et circonférences, pas la balance")
            ok("pas d'après une mesure de masse grasse" in rtxt, "honnêteté de l'estimation : dit que ce n'est pas une mesure de masse grasse")
            await c.get_by_text("Les sources").first.click(); await c.wait_for_timeout(200)
            stxt = await c.inner_text("body")
            ok("Bonilla" in stxt and "Barakat" in stxt and "Longland" in stxt, "sources citées (3 références scientifiques)")
            await c.screenshot(path=f"{OUT}/02_recomposition.png", full_page=True)

            # ---------- nutrition : l'objectif est pré-réglé sur l'axe du profil, protéines à 2 g/kg ----------
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(900)
            gch = await c.get_by_role("radio", name="Perdre du poids").get_attribute("aria-checked")
            ok(gch == "true", "nutrition : objectif pre-regle sur l'axe du profil, sans que le client le ressaisisse", {"aria-checked": gch})
            ntxt0 = await c.inner_text("body")
            ok("c'est un axe a part".replace("a part", "\u00e0 part") in ntxt0,
               "nutrition : l'entrainement est rappele comme un axe separe, non modifiable ici", ntxt0[:200])
            await c.get_by_role("radio", name="Homme").click()
            await c.fill("#nu-a", "30"); await c.fill("#nu-h", "178"); await c.fill("#nu-w", "92")
            await c.fill("#nu-d", "8"); await c.get_by_role("radio", name="4", exact=True).click(); await c.wait_for_timeout(400)
            ntxt = await c.locator(".card", has_text="Ton plan").inner_text()
            # poids de reference plafonne a un IMC de 25 : min(92 ; 25 x 1,78**2) = 79,2 kg -> 2 g/kg = 158 g
            ok("158 g" in ntxt, "recomposition : proteines portees a 2 g/kg/j (Longland 2016), soit 158 g pour un poids de reference de 79,2 kg", " ".join(ntxt.split())[:260])
            rec = await c.locator(".card", has_text="Ton objectif").inner_text()
            ok("recomposition corporelle" in rec, "nutrition : le compromis est rappele la ou les calories sont fixees")
            await c.screenshot(path=f"{OUT}/03_nutrition.png", full_page=True)

            # ---------- un athlète entraîné et sec : fenêtre étroite, autre message ----------
            d = await A.new_page(); hook(d, "sec")
            await d.goto(URL + "?as=obj2"); await d.wait_for_timeout(600)
            await seed(d, "u_obj2", {"name": "Sarah Seche", "sportId": "rugby", "sex": "F", "height": 172, "weight": 62,
                                      "birthYear": 1997, "corps": "perte", "corpsAt": TODAY.isoformat()},
                       {"programId": "force", "start": start, "niveau": "elite"})
            await d.reload(); await d.wait_for_timeout(1300)
            await d.get_by_role("button", name="Mon profil").click(); await d.wait_for_timeout(600)
            etxt = await d.inner_text("body")
            ok("fenêtre est étroite" in etxt and "Antoine" in etxt,
               "athlète entraînée et sèche (IMC 21, niveau élite) : fenêtre étroite, enchaîner les phases conseillé", etxt[:400])
            ok("tirent en sens opposés" in etxt, "titre adapté à la fenêtre étroite")
            await d.screenshot(path=f"{OUT}/04_fenetre_etroite.png", full_page=True)

            # ---------- suivi de la recomposition : jugé sur circonférences + charges, pas sur le poids ----------
            await c.bring_to_front()
            await c.evaluate("""() => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
              db['clients/u_obj1/tests/t0'] = { w: 0, at: '2026-09-01', values: { taille: 98, hanches: 106, poids: 92 } };
              db['clients/u_obj1/tests/t4'] = { w: 4, at: '2026-10-01', values: { taille: 94.5, hanches: 103, poids: 91 } };
              localStorage.setItem('__mockdb', JSON.stringify(db)); }""")
            # deux séances avec les charges notées sur le même exercice : la force monte
            await c.evaluate("""() => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
              db['clients/u_obj1/logs/2026-09-02'] = { date: '2026-09-02', w: 1, s: 0, kind: 'seance', rpe: 7, min: 60,
                items: [{ e: 'squat', sets: [{ kg: 100, reps: 5 }] }] };
              db['clients/u_obj1/logs/2026-10-02'] = { date: '2026-10-02', w: 5, s: 0, kind: 'seance', rpe: 7, min: 60,
                items: [{ e: 'squat', sets: [{ kg: 112, reps: 5 }] }] };
              localStorage.setItem('__mockdb', JSON.stringify(db)); }""")
            await c.reload(); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Progrès").first.click(); await c.wait_for_timeout(800)
            gtxt = await c.inner_text("body")
            ok("Recomposition : où on en est" in gtxt, "progrès : carte de suivi de la recomposition affichée", gtxt[:300])
            ok("-3,5 cm" in gtxt and "-3 cm" in gtxt, "tour de taille et tour de hanches relus depuis les tests déjà saisis", gtxt[gtxt.find("Recomposition"):gtxt.find("Recomposition") + 400])
            ok("se passe bien" in gtxt, "verdict : circonférences en baisse + charges en hausse = le signal attendu")
            ok("ce n'est pas un échec" in gtxt, "le poids est affiché pour information, pas comme un juge", gtxt[gtxt.find("Recomposition"):gtxt.find("Recomposition") + 600])
            await c.screenshot(path=f"{OUT}/05_suivi_recomposition.png", full_page=True)

            # ---------- côté coach : les deux axes, la fenêtre et le suivi ----------
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(900)
            await co.locator(".side-nav button", has_text="Clients").first.click(); await co.wait_for_timeout(600)
            await co.locator(".ctable tbody tr", has_text="Leo Legacy").first.click(); await co.wait_for_timeout(1100)
            ctxt = await co.inner_text("body")
            ok("Objectifs du client" in ctxt, "coach : carte « Objectifs du client » dans la vue d'ensemble", ctxt[:300])
            seg = ctxt[ctxt.find("Objectifs du client"):ctxt.find("Objectifs du client") + 500]
            ok("Perdre du gras" in seg and "large" in seg and "2 g/kg/j" in seg,
               "coach : les deux axes, la fenêtre estimée et les protéines visées", seg)
            ok("se passe bien" in ctxt, "coach : même verdict de suivi que le client")
            await co.screenshot(path=f"{OUT}/06_coach.png", full_page=True)

            # ---------- divergence nutrition / objectif : signalée au coach ----------
            await co.evaluate("""() => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
              db['clients/u_obj1/nutri/plan'] = { ...(db['clients/u_obj1/nutri/plan'] || {}), mode: 'calories', goal: 'prise', target: 3000, sex: 'H' };
              localStorage.setItem('__mockdb', JSON.stringify(db)); }""")
            await co.reload(); await co.wait_for_timeout(1200)
            await co.locator(".ctable tbody tr", has_text="Leo Legacy").first.click(); await co.wait_for_timeout(1100)
            dtxt = await co.inner_text("body")
            ok("ne disent pas la même chose" in dtxt, "coach : nutrition réglée sur un autre objectif que l'axe du client = signalé", dtxt[dtxt.find("Objectifs du client"):dtxt.find("Objectifs du client") + 600])

            # ---------- contexte du coach IA : les deux axes, et la consigne de ne rien promettre ----------
            await c.bring_to_front()
            await c.get_by_role("button", name="Coach IA").first.click(); await c.wait_for_timeout(400)
            await c.fill("#chat-in", "Je peux gagner en force et perdre du gras en même temps ?"); await c.keyboard.press("Enter"); await c.wait_for_timeout(1500)
            prompts = await c.evaluate("window.__prompts || []")
            allp = (prompts[-1] if prompts else {}).get("all", "")
            ok("Objectifs (deux axes séparés)" in allp and "composition corporelle : perdre du gras" in allp,
               "coach IA : les deux axes du client sont dans son contexte", allp[allp.find("Objectifs (deux axes"):allp.find("Objectifs (deux axes") + 200])
            ok("Recomposition visée" in allp and "Ne jamais promettre" in allp and "pas sur le poids" in allp,
               "coach IA : consigne de dire le compromis et de juger sur charges, tests et circonférences",
               allp[allp.find("Recomposition visée"):allp.find("Recomposition visée") + 400])

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
