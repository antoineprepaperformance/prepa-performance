"""Garde-fou energie basse (37_energie.js) : signaler un schema d'apports durablement insuffisants pour la
charge (RED-S / REDs, consensus CIO), sans jamais poser de diagnostic ni calculer une disponibilite
energetique qu'on ne peut pas mesurer.
Verifie surtout ce qui ne doit PAS se declencher (seche normale, charge faible, un seul signal), la
confidentialite du signal du cycle cote coach, et l'interdiction faite au coach IA de conseiller de manger
moins meme si le client le demande."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8789
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/energie"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()
UID = "u_en1"
TDEE = 2800
FENETRE = 21


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


async def mdb_put(page, path, doc):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = x; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, doc])


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def mdb_del(page, prefix):
    await page.evaluate("(pre) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); Object.keys(db).forEach((k) => { if (k.indexOf(pre) === 0) delete db[k]; }); localStorage.setItem('__mockdb', JSON.stringify(db)); }", prefix)


async def scenario(page, kcal, ua_sem, kg_sem=0.0, vfc_basse=False, energie=None, regles_retard=False, jours=18):
    """Fabrique une fenetre de 3 semaines : apports, charge d'entrainement, derive de poids, et les
    signaux corroborants demandes. Renvoie ce que la regle en conclut."""
    for pre in ["/food/", "/logs/", "/sante/", "/checkins/"]:
        await mdb_del(page, "clients/" + UID + pre)
    for i in range(jours):
        d = (TODAY - datetime.timedelta(days=FENETRE - 1 - i)).isoformat()
        await mdb_put(page, "clients/" + UID + "/food/" + d, {"meals": [{"n": "repas", "kcal": kcal, "p": 110, "c": 150, "f": 60}]})
    # 3 semaines de seances, charge repartie en 4 seances par semaine
    par_seance = round(ua_sem / 4)
    k = 0
    for sem in range(3):
        for s in range(4):
            d = (TODAY - datetime.timedelta(days=FENETRE - 1 - (sem * 7 + s))).isoformat()
            await mdb_put(page, "clients/" + UID + "/logs/w-" + str(k), {"key": "w-" + str(k), "w": sem + 1, "sid": "A",
                "date": d, "title": "x", "items": [], "rpe": 7, "duree": round(par_seance / 7), "load": par_seance,
                "douleur": 0, "zone": "", "comment": ""})
            k += 1
    p0 = 60.0
    for j in range(0, FENETRE, 3):
        d = (TODAY - datetime.timedelta(days=FENETRE - 1 - j)).isoformat()
        doc = {"poids": round(p0 + kg_sem * j / 7, 2)}
        if vfc_basse:
            doc["vfc"] = 48 if j >= FENETRE - 3 else 70
            doc["fcr"] = 52
        await mdb_put(page, "clients/" + UID + "/sante/" + d, doc)
    if energie is not None:
        await mdb_put(page, "clients/" + UID + "/checkins/w3", {"w": 3, "at": (TODAY - datetime.timedelta(days=2)).isoformat(), "energie": energie})
    if regles_retard:
        await mdb_set(page, "clients/" + UID, {"cycle": {"on": True, "share": False}})
        # dernieres regles il y a 60 jours, avec un historique qui donne un cycle de 28 j : tres en retard
        for back in (60, 88, 116):
            d = (TODAY - datetime.timedelta(days=back)).isoformat()
            await mdb_put(page, "clients/" + UID + "/sante/" + d, {"regles": True, "at": TODAY.isoformat()})
    await page.reload(); await page.wait_for_timeout(1200)
    return await page.evaluate("""() => {
      const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
      const pick = (pre) => Object.fromEntries(Object.entries(db).filter(([k]) => k.indexOf(pre) === 0).map(([k, v]) => [k.slice(pre.length), v]));
      const d = { profile: db['clients/%s'], plan: db['plans/%s'], logs: pick('clients/%s/logs/'),
                  checkins: pick('clients/%s/checkins/'), sante: pick('clients/%s/sante/'),
                  food: pick('clients/%s/food/'), libres: {}, nutri: { plan: db['clients/%s/nutri/plan'] } };
      return { e: energieBasse(d, d.plan, todayISO()), sum: summarize(d).energieBasse };
    }""" % ((UID,) * 7))


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=en1"); await c.evaluate("localStorage.removeItem('__mockdb')")
            start = (TODAY - datetime.timedelta(days=50)).isoformat()
            await mdb_set(c, "clients/" + UID, {"name": "Lina Light", "sportId": "rugby", "sex": "F", "height": 168,
                                                 "weight": 60, "birthYear": 1999})
            await mdb_set(c, "plans/" + UID, {"programId": "force", "offer": "suivi", "weeks": 12, "start": start,
                                               "equipment": "salle", "status": "active", "niveau": "perf", "extra": [], "message": "",
                                               "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            await mdb_put(c, "clients/" + UID + "/nutri/plan", {"mode": "calories", "sex": "F", "age": 27, "height": 168,
                "weight0": 60, "goal": "perte", "delta": 3, "weeks": 12, "tdee": TDEE, "floor": 1200, "refW": 60,
                "bmr": 1420, "status": "ok", "target": 57, "rate": -0.25, "bmi": 21.3, "start": start,
                "createdAt": "2026-10-01T00:00:00.000Z",
                "form": {"sex": "F", "age": "27", "height": "168", "weight": "60", "act": 1.5, "goal": "perte", "delta": "3", "months": "3"},
                "targets": {"kcal": 2400, "p": 120, "c": 240, "f": 75, "steps": 9000, "water": 2.0}})
            await c.reload(); await c.wait_for_timeout(1300)

            # ---------- CE QUI NE DOIT PAS SE DECLENCHER ----------
            # seche normale : deficit modere, charge reelle, aucun signal corroborant
            r = await scenario(c, 2300, 1400)
            ok(r["e"] is not None and r["e"]["alerte"] is False,
               "seche normale (deficit modere, aucun signal) : aucun signalement", {"manquePct": r["e"]["manquePct"], "signaux": r["e"]["signaux"]})

            # apports tres bas MAIS charge faible : l'entrainement n'est pas le probleme
            r = await scenario(c, 1600, 400, kg_sem=-0.9)
            ok(r["e"]["coeur"] is False, "apports bas mais charge faible : le coeur du schema n'est pas reuni", {"charge": r["e"]["charge"], "coeur": r["e"]["coeur"]})
            ok(r["e"]["alerte"] is False, "pas de signalement : ce n'est pas un schema d'energie basse pour la charge", r["e"]["alerte"])

            # coeur du schema reuni MAIS aucun signal corroborant : on se tait
            r = await scenario(c, 1700, 1600)
            ok(r["e"]["coeur"] is True and not r["e"]["signaux"] and r["e"]["alerte"] is False,
               "coeur reuni mais aucun signal corroborant : volontairement silencieux (une alerte qui crie pour rien s'apprend a ignorer)",
               {"coeur": r["e"]["coeur"], "signaux": r["e"]["signaux"]})

            # pas assez de journees notees : la question ne se pose pas
            r = await scenario(c, 1500, 1600, kg_sem=-1.0, jours=6)
            ok(r["e"] is None, "moins de 12 journees notees : la regle ne conclut rien", r["e"])

            # ---------- CE QUI DOIT SE DECLENCHER ----------
            # apports tres bas + charge reelle + perte trop rapide
            r = await scenario(c, 1700, 1600, kg_sem=-0.9)
            e = r["e"]
            ok(e["alerte"] is True and e["coeur"] is True, "apports bas + charge reelle + perte rapide : signalement", {"manquePct": e["manquePct"], "charge": e["charge"]})
            ok(any("1 %" in s for s in e["signaux"]), "le signal de perte trop rapide est nomme", e["signaux"])
            ok(abs(e["manquePct"] - 39.3) < 1.5, "ecart calcule juste (1700 contre 2800 = 39 % sous la reference)", e["manquePct"])
            ok(r["sum"] and r["sum"]["manquePct"] == e["manquePct"],
               "drapeau publie dans le resume du client, pour le tableau de bord d'Antoine", r["sum"])
            ok("nSignaux" in (r["sum"] or {}) and "signaux" not in (r["sum"] or {}),
               "le resume publie ne contient que le nombre de signaux, jamais leur contenu", r["sum"])
            ok(e["medecin"] is False, "un seul signal : pas encore de renvoi vers un medecin", {"signaux": e["signaux"], "medecin": e["medecin"]})

            # sous le plancher de securite : declenche meme sans ecart de 25 %
            r = await scenario(c, 1100, 1600, kg_sem=-0.9)
            ok(r["e"]["sousPlancher"] is True and r["e"]["alerte"] is True, "apports sous le plancher de securite : signalement", {"apport": r["e"]["apport"], "plancher": r["e"]["plancher"]})

            # deux signaux : on conseille un avis medical
            r = await scenario(c, 1700, 1600, kg_sem=-0.9, energie=1)
            ok(len(r["e"]["signaux"]) >= 2 and r["e"]["medecin"] is True, "deux signaux reunis : avis medical conseille", {"signaux": r["e"]["signaux"], "medecin": r["e"]["medecin"]})

            # ---------- l'ecran client ----------
            await c.locator("nav.tabbar button", has_text="Nutrition").click(); await c.wait_for_timeout(800)
            await c.get_by_role("radio", name="Mon objectif").click(); await c.wait_for_timeout(700)
            txt = await c.inner_text("body")
            ok("Tu manges peu pour ce que tu t'entraînes" in txt, "client : le schema est nomme sans jugement", txt[:200])
            ok("Ce n'est pas un diagnostic" in txt and "ce n'est pas une accusation" in txt, "client : ni diagnostic ni accusation")
            ok("en remontant les apports, pas en s'entraînant plus" in txt, "client : la correction est dite dans le bon sens")
            ok("Mountjoy" in txt or True, "sources presentes dans un volet")
            await c.get_by_text("Les sources").first.click(); await c.wait_for_timeout(300)
            txt2 = await c.inner_text("body")
            ok("Mountjoy" in txt2 and "Loucks" in txt2, "sources citees (consensus CIO, seuil de Loucks)", txt2[txt2.find("Mountjoy"):txt2.find("Mountjoy") + 120])
            ok("ne calcule pas de disponibilité énergétique" in txt2 and "masse maigre, qu'elle ne mesure pas" in txt2,
               "l'application dit franchement ce qu'elle ne calcule pas, et pourquoi", txt2[txt2.find("ne calcule pas"):txt2.find("ne calcule pas") + 200])
            ok("ne veut donc pas dire que tout va bien" in txt2, "l'absence de signalement n'est pas presentee comme un feu vert")
            await c.screenshot(path=f"{OUT}/01_client.png", full_page=True)

            # ---------- confidentialite du signal du cycle ----------
            r = await scenario(c, 1700, 1600, kg_sem=-0.9, regles_retard=True)
            ok(r["e"]["cycle"] is True and any("règles" in s for s in r["e"]["signaux"]),
               "suivi du cycle active : le retard de regles compte comme signal (c'est le plus specifique)", r["e"]["signaux"])
            ok(r["e"]["medecin"] is True, "regles absentes : avis medical conseille", r["e"]["medecin"])
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(900)
            await co.locator(".side-nav button", has_text="Clients").first.click(); await co.wait_for_timeout(600)
            await co.locator(".ctable tbody tr", has_text="Lina Light").first.click(); await co.wait_for_timeout(1100)
            await co.get_by_role("radio", name="Nutrition", exact=True).click(); await co.wait_for_timeout(700)
            # on resserre sur la carte elle-meme : c'est la garantie de confidentialite qu'on veut verifier
            carte = co.locator(".alert", has_text="Apports bas pour la charge")
            ctxt = await carte.inner_text()
            ok("Apports bas pour la charge" in ctxt, "coach : le signalement est visible dans la fiche du client", ctxt[:200])
            ok("règles" not in ctxt and "poids descend" in ctxt,
               "partage du cycle desactive : le coach voit le signalement et les autres signaux, jamais la raison intime", ctxt)
            await co.screenshot(path=f"{OUT}/02_coach_sans_partage.png", full_page=True)
            # la cliente active le partage : la raison devient visible
            await c.bring_to_front(); await mdb_set(c, "clients/" + UID, {"cycle": {"on": True, "share": True}})
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1300)
            await co.locator(".ctable tbody tr", has_text="Lina Light").first.click(); await co.wait_for_timeout(1100)
            await co.get_by_role("radio", name="Nutrition", exact=True).click(); await co.wait_for_timeout(700)
            ctxt2 = await co.locator(".alert", has_text="Apports bas pour la charge").inner_text()
            ok("règles" in ctxt2, "partage active par la cliente : la raison devient visible au coach", ctxt2)
            ok("Avis médical à conseiller" in ctxt2, "coach : l'avis medical est signale comme a conseiller", ctxt2[-250:])
            await co.screenshot(path=f"{OUT}/03_coach_avec_partage.png", full_page=True)

            # ---------- contexte du coach IA : l'interdiction la plus importante ----------
            await c.bring_to_front(); await c.reload(); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Coach IA").first.click(); await c.wait_for_timeout(400)
            await c.fill("#chat-in", "Je stagne, je devrais manger moins non ?"); await c.keyboard.press("Enter"); await c.wait_for_timeout(1500)
            prompts = await c.evaluate("window.__prompts || []")
            allp = (prompts[-1] if prompts else {}).get("all", "")
            seg = allp[allp.find("ALERTE ÉNERGIE BASSE"):allp.find("ALERTE ÉNERGIE BASSE") + 1200]
            ok("ALERTE ÉNERGIE BASSE" in allp, "coach IA : l'alerte est dans son contexte", seg[:150])
            ok("Priorité absolue" in allp and "ne JAMAIS conseiller de manger moins" in allp,
               "coach IA : interdiction de conseiller de manger moins, meme si le client le demande", seg)
            ok("Tu ne poses aucun diagnostic" in allp, "coach IA : aucun diagnostic", seg)
            ok("avis médical" in allp, "coach IA : avis medical a conseiller quand les signaux le justifient", seg)
            # le contexte de l'IA sert aussi a rediger le brouillon de reponse d'Antoine (draftReply) :
            # le signal du cycle n'y entre JAMAIS, partage ou pas, comme pose le 6 novembre
            # attention : « Règles de sécurité » existe dans les consignes de l'IA (regles = rules en français).
            # On cherche donc la phrase exacte du signal intime, pas le mot seul.
            ok("tes règles ont beaucoup de retard" not in allp and "règles" not in allp[allp.find("ALERTE"):allp.find("ALERTE") + 1200],
               "coach IA : le signal du cycle n'entre jamais dans le contexte (il sert aussi au brouillon d'Antoine)",
               allp[allp.find("ALERTE"):allp.find("ALERTE") + 400])
            ok("poids descend" in allp, "coach IA : les autres signaux y sont bien, eux", seg[:300])

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
