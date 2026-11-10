"""Recalibrage de la depense (36_nutriadapt.js) : la cible de calories n'est plus figee a l'inscription,
elle est corrigee par la comptabilite d'energie (apports notes - variation de poids x 7700 / jours).
Verifie l'asymetrie volontaire (au-dessus de la reference = signal fiable, applique en entier ; en dessous =
repas probablement non notes, moitie seulement), les seuils de donnees, le plafond, le mode equilibre qui
coupe tout, et le fait que rien ne s'applique sans un geste du client."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8787
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/nutriadapt"; os.makedirs(OUT, exist_ok=True)
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


UID = "u_na1"
TDEE = 2600


async def histoire(page, kcal_jour, kg_par_sem, jours_notes=18, pesees=8, fenetre=21):
    """Fabrique une fenetre de 3 semaines : des repas notes a kcal_jour, et un poids qui derive
    lineairement de kg_par_sem. C'est l'entree exacte de la comptabilite d'energie."""
    await mdb_del(page, "clients/" + UID + "/food/")
    await mdb_del(page, "clients/" + UID + "/sante/")
    for i in range(jours_notes):
        d = (TODAY - datetime.timedelta(days=fenetre - 1 - i)).isoformat()
        await mdb_put(page, "clients/" + UID + "/food/" + d,
                      {"meals": [{"n": "repas", "kcal": kcal_jour, "p": 120, "c": 200, "f": 70}]})
    p0 = 80.0
    for k in range(pesees):
        j = round(k * (fenetre - 1) / (pesees - 1))
        d = (TODAY - datetime.timedelta(days=fenetre - 1 - j)).isoformat()
        await mdb_put(page, "clients/" + UID + "/sante/" + d, {"poids": round(p0 + kg_par_sem * j / 7, 2)})
    await page.reload(); await page.wait_for_timeout(1200)
    return await page.evaluate("""() => {
      const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
      const pick = (pre) => Object.fromEntries(Object.entries(db).filter(([k]) => k.indexOf(pre) === 0).map(([k, v]) => [k.slice(pre.length), v]));
      const d = { profile: db['clients/%s'], logs: {}, checkins: pick('clients/%s/checkins/'),
                  sante: pick('clients/%s/sante/'), food: pick('clients/%s/food/'),
                  nutri: { plan: db['clients/%s/nutri/plan'] } };
      const a = nutriAdapt(d, db['plans/%s'], todayISO());
      return { a, cible: a && a.pret ? nutriAdaptCible(d, db['plans/%s'], a) : null, texte: adaptTexte(a) };
    }""" % (UID, UID, UID, UID, UID, UID, UID))


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=na1"); await c.evaluate("localStorage.removeItem('__mockdb')")
            start = (TODAY - datetime.timedelta(days=40)).isoformat()
            await mdb_set(c, "clients/" + UID, {"name": "Marc Macro", "sex": "H", "height": 180, "weight": 80, "birthYear": 1990})
            await mdb_set(c, "plans/" + UID, {"programId": "force", "offer": "suivi", "weeks": 12, "start": start,
                                               "equipment": "salle", "status": "active", "niveau": "sportif", "extra": [], "message": "",
                                               "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            # plan nutrition deja calcule, depense de reference 2600 kcal, objectif perte
            await mdb_put(c, "clients/" + UID + "/nutri/plan", {"mode": "calories", "sex": "H", "age": 36, "height": 180,
                "weight0": 80, "goal": "perte", "delta": 5, "weeks": 12, "tdee": TDEE, "floor": 1500, "refW": 81,
                "bmr": 1780, "status": "ok", "target": 75, "rate": -0.36, "bmi": 24.7, "start": start, "createdAt": "2026-10-01T00:00:00.000Z",
                "form": {"sex": "H", "age": "36", "height": "180", "weight": "80", "act": 1.35, "goal": "perte", "delta": "5", "months": "3"},
                "targets": {"kcal": 2200, "p": 146, "c": 220, "f": 70, "steps": 9000, "water": 2.6}})
            await c.reload(); await c.wait_for_timeout(1300)

            # ---------- pas assez de donnees : on explique ce qui manque ----------
            r = await histoire(c, 2200, -0.5, jours_notes=4, pesees=2)
            ok(r["a"]["pret"] is False, "pas assez de donnees : aucun chiffre sorti", r["a"])
            ok(any("pesées" in m for m in r["a"]["manque"]) and any("journées de repas notées" in m for m in r["a"]["manque"]),
               "ce qui manque est dit precisement (pesees et journees notees)", r["a"]["manque"])
            ok("Pas encore de quoi recalculer" in r["texte"]["titre"], "titre honnete tant qu'on ne peut pas conclure", r["texte"]["titre"])

            # ---------- depense mesuree AU-DESSUS de la reference : signal fiable, applique en entier ----------
            # 2600 kcal notes, poids stable -> depense mesuree ~2600... on veut au-dessus : 2600 notes et -0,5 kg/sem
            # => 2600 + 0,5*7700/7 = 3150 kcal, soit +21 % de 2600
            r = await histoire(c, 2600, -0.5)
            a = r["a"]
            ok(a["pret"] is True and a["sens"] == "haut", "depense mesuree au-dessus de la reference", {"mesuree": a["mesuree"], "equation": a["equation"], "sens": a["sens"]})
            ok(abs(a["mesuree"] - 3150) <= 30, "comptabilite d'energie juste : 2600 notes et -0,5 kg/sem = ~3150 kcal de depense", a["mesuree"])
            ok(a["confiance"] == "forte" and abs(a["retenue"] - a["mesuree"]) <= 30,
               "sens fiable : l'ecart est applique en entier (le biais de sous-declaration pousse dans l'autre sens)", {"retenue": a["retenue"], "mesuree": a["mesuree"]})
            ok("Ce sens-là est fiable" in " ".join(r["texte"]["lignes"]), "le pourquoi de la confiance est dit au client", r["texte"]["lignes"])
            ok(r["cible"]["kcal"] > 2200, "la cible de calories monte", {"avant": 2200, "apres": r["cible"]["kcal"]})
            ok(r["cible"]["kcal"] <= 2200 * 1.2 + 1, "le pas est plafonne : jamais plus de 20 % d'un coup", r["cible"]["kcal"])
            # le deficit absolu doit etre conserve : c'est lui qui fixe la vitesse en kg/semaine, et le texte
            # affiche promet au client que sa vitesse ne change pas. Ici : 2600 - 2200 = 400 kcal de deficit,
            # donc la cible visee est 3150 - 400 = 2750, ramenee a 2640 par le pas maximal de 20 %.
            vise = a["retenue"] - (TDEE - 2200)
            ok(r["cible"]["kcal"] == min(round(2200 * 1.2 / 10) * 10, round(vise / 10) * 10),
               "deficit absolu conserve (la vitesse promise est bien tenue), puis pas maximal applique",
               {"vise": vise, "obtenu": r["cible"]["kcal"]})
            ok(abs((a["retenue"] - r["cible"]["kcal"]) - (TDEE - 2200)) <= 120,
               "le deficit reste du meme ordre qu'avant : le recalibrage ne change pas la vitesse en douce",
               {"deficit_avant": TDEE - 2200, "deficit_apres": a["retenue"] - r["cible"]["kcal"]})

            # ---------- depense mesuree EN DESSOUS : prudence, moitie de l'ecart seulement ----------
            # 2200 notes et poids stable -> depense mesuree 2200, soit -15 % de 2600
            r = await histoire(c, 2200, 0.0)
            a = r["a"]
            ok(a["sens"] == "bas" and a["confiance"] == "prudente", "depense mesuree en dessous : marquee comme prudente", {"sens": a["sens"], "confiance": a["confiance"]})
            demi = TDEE * (1 + (a["ecart"]) / 2)
            ok(abs(a["retenue"] - demi) <= 15, "seule la moitie de l'ecart est retenue dans ce sens", {"retenue": a["retenue"], "attendu": round(demi)})
            lignes = " ".join(r["texte"]["lignes"])
            ok("pas un métabolisme lent" in lignes and "ne sont pas notés" in lignes,
               "la cause la plus probable est nommee (repas non notes), pas un metabolisme lent", r["texte"]["lignes"])
            ok(r["cible"]["kcal"] < 2200, "la cible baisse, mais a moitie seulement", {"avant": 2200, "apres": r["cible"]["kcal"]})

            # ---------- ecart dans le bruit : on ne change rien ----------
            # 2600 notes, poids stable -> mesuree 2600 = reference, ecart 0
            r = await histoire(c, 2600, 0.0)
            ok(r["a"]["assez"] is False and r["cible"] is None, "ecart sous le seuil de bruit : aucune cible recalculee", {"ecart": r["a"]["ecartPct"], "cible": r["cible"]})
            ok("correspond à tes repères actuels" in r["texte"]["titre"], "c'est dit comme une confirmation, pas comme un probleme", r["texte"]["titre"])

            # ---------- ecart enorme : plafonne, et explique ----------
            # 1200 notes et +0,5 kg/sem -> mesuree = 1200 - 550 = 650 kcal, soit -75 %
            r = await histoire(c, 1200, 0.5)
            a = r["a"]
            ok(a["plafonne"] is True, "ecart brut enorme : signale comme plafonne", {"ecartPct": a["ecartPct"], "plafonne": a["plafonne"]})
            ok(a["retenue"] >= TDEE * 0.87, "plafond applique : la reference ne peut pas s'effondrer d'un coup", {"retenue": a["retenue"]})
            ok("vient presque toujours du journal" in " ".join(r["texte"]["lignes"]), "le plafond est explique au client", r["texte"]["lignes"])
            ok(r["cible"]["kcal"] >= 1500, "le plancher de securite est respecte", r["cible"]["kcal"])

            # ---------- l'ecran client : rien n'est applique sans un geste ----------
            r = await histoire(c, 2600, -0.5)
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(800)
            await c.get_by_role("radio", name="Mon objectif").click(); await c.wait_for_timeout(700)
            txt = await c.inner_text("body")
            ok("Ta dépense réelle" in txt, "page Nutrition : la carte de recalibrage est affichee", txt[:200])
            # .btn est en majuscules par la CSS : inner_text renvoie le texte rendu
            ok("Cible recalculée" in txt and "mettre à jour mes repères" in txt.lower(),
               "l'ecart et le geste sont proposes", txt[txt.find("Cible actuelle"):txt.find("Cible actuelle") + 300])
            av = await c.evaluate("JSON.parse(localStorage.getItem('__mockdb'))['clients/%s/nutri/plan'].targets.kcal" % UID)
            ok(av == 2200, "avant le clic : la cible du client n'a pas bouge", av)
            await c.screenshot(path=f"{OUT}/01_proposition.png", full_page=True)
            await c.get_by_role("button", name="Mettre à jour mes repères").click(); await c.wait_for_timeout(900)
            np2 = await c.evaluate("JSON.parse(localStorage.getItem('__mockdb'))['clients/%s/nutri/plan']" % UID)
            ok(np2["targets"]["kcal"] > 2200 and np2["tdeeSrc"] == "mesure" and np2["tdeeEq"] == TDEE,
               "apres le clic : cible mise a jour, depense marquee comme mesuree, equation de depart conservee",
               {"kcal": np2["targets"]["kcal"], "tdeeSrc": np2.get("tdeeSrc"), "tdeeEq": np2.get("tdeeEq")})
            txt2 = await c.inner_text("body")
            ok("Dernier recalibrage le" in txt2, "la date du recalibrage est tracee cote client", txt2[txt2.find("Dernier recalibrage"):txt2.find("Dernier recalibrage") + 150])
            await c.screenshot(path=f"{OUT}/02_applique.png", full_page=True)

            # ---------- mode equilibre : la fonction est entierement coupee ----------
            await mdb_put(c, "clients/" + UID + "/nutri/plan", {"mode": "equilibre", "start": start, "createdAt": "2026-10-01T00:00:00.000Z",
                                                                 "form": {"sex": "H"}, "reason": "ted"})
            await c.reload(); await c.wait_for_timeout(1300)
            vide = await c.evaluate("""() => {
              const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
              const pick = (pre) => Object.fromEntries(Object.entries(db).filter(([k]) => k.indexOf(pre) === 0).map(([k, v]) => [k.slice(pre.length), v]));
              return nutriAdapt({ profile: db['clients/%s'], logs: {}, checkins: {}, sante: pick('clients/%s/sante/'),
                                  food: pick('clients/%s/food/'), nutri: { plan: db['clients/%s/nutri/plan'] } }, db['plans/%s'], todayISO());
            }""" % (UID, UID, UID, UID, UID))
            ok(vide is None, "mode equilibre (mineur, grossesse, antecedent de TCA) : aucun recalibrage, aucune proposition", vide)
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(800)
            etxt = await c.inner_text("body")
            ok("Ta dépense réelle" not in etxt, "mode equilibre : la carte n'apparait pas du tout dans l'interface", etxt[:200])

            # ---------- cote coach ----------
            await mdb_put(c, "clients/" + UID + "/nutri/plan", {"mode": "calories", "sex": "H", "age": 36, "height": 180,
                "weight0": 80, "goal": "perte", "delta": 5, "weeks": 12, "tdee": TDEE, "floor": 1500, "refW": 81,
                "bmr": 1780, "status": "ok", "target": 75, "rate": -0.36, "bmi": 24.7, "start": start, "createdAt": "2026-10-01T00:00:00.000Z",
                "form": {"sex": "H", "age": "36", "height": "180", "weight": "80", "act": 1.35, "goal": "perte", "delta": "5", "months": "3"},
                "targets": {"kcal": 2200, "p": 146, "c": 220, "f": 70, "steps": 9000, "water": 2.6}})
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(900)
            await co.locator(".side-nav button", has_text="Clients").first.click(); await co.wait_for_timeout(600)
            await co.locator(".ctable tbody tr", has_text="Marc Macro").first.click(); await co.wait_for_timeout(1100)
            await co.get_by_role("radio", name="Nutrition", exact=True).click(); await co.wait_for_timeout(700)
            ctxt = await co.inner_text("body")
            ok("Dépense réelle du client" in ctxt, "coach : la depense reelle du client est visible", ctxt[:200])
            ok("mettre à jour mes repères" not in ctxt.lower(), "coach : il voit l'ecart mais ne clique pas a la place du client")
            await co.screenshot(path=f"{OUT}/03_coach.png", full_page=True)

            # ---------- contexte du coach IA ----------
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Coach IA").first.click(); await c.wait_for_timeout(400)
            await c.fill("#chat-in", "Pourquoi tu me proposes plus de calories ?"); await c.keyboard.press("Enter"); await c.wait_for_timeout(1500)
            prompts = await c.evaluate("window.__prompts || []")
            allp = (prompts[-1] if prompts else {}).get("all", "")
            seg = allp[allp.find("Recalibrage de la dépense"):allp.find("Recalibrage de la dépense") + 900]
            ok("Recalibrage de la dépense proposé au client" in allp, "coach IA : le recalibrage est dans son contexte", seg[:200])
            ok("tu ne donnes jamais ton propre chiffre de calories" in allp and "tu n'appliques rien" in allp,
               "coach IA : il explique, il ne decide pas et n'applique pas", seg)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
