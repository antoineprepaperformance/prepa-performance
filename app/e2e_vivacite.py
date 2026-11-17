"""Vivacite et changements de direction (content_sports.py, fiches g_freinage, sk_coupe, g_cod_angles,
g_cod_signal) : quatre fiches terrain fondees sur les etudes citees, ouvertes a tous les sports de
changement de direction et a eux seuls, avec une dose par profil, un schema, et des sources qui existent.
Verifie aussi qu'un client rugby les voit dans son ecran terrain et dans la bibliotheque Technique."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8815
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/vivacite"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()
IDS = ["g_freinage", "sk_coupe", "g_cod_angles", "g_cod_signal"]


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


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
            A = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=vv1"); await c.evaluate("localStorage.removeItem('__mockdb')")
            start = (TODAY - datetime.timedelta(days=14)).isoformat()
            await mdb_set(c, "clients/u_vv1", {"name": "Vic Vif", "sportId": "rugby", "poste": "trois-quarts", "sportAdapt": True, "sex": "H", "height": 180, "weight": 85, "birthYear": 1998})
            await mdb_set(c, "plans/u_vv1", {"programId": "vitesse", "offer": "suivi", "weeks": 12, "start": start, "equipment": "salle",
                                              "status": "active", "niveau": "perf", "extra": [], "message": "",
                                              "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            await c.reload(); await c.wait_for_timeout(1400)

            # ---------- contenu : les quatre fiches, leurs sports, leurs doses, leurs sources ----------
            info = await c.evaluate("""(ids) => ids.map((id) => {
              const d = DRILLS.find((x) => x.id === id); if (!d) return { id, absent: true };
              return { id, n: d.n, type: d.type, sports: d.sports, skill: !!d.skill,
                       profils: Object.keys(d.dose || {}), refsOk: (d.refs || []).length > 0 && d.refs.every((r) => !!SREFS[r]),
                       steps: (d.steps || []).length, cues: (d.cues || []).length, sc: !!d.sc,
                       fiche: !!(d.obj && d.org && d.var), test: d.test ? d.test.t : null };
            })""", IDS)
            byid = {x["id"]: x for x in info}
            ok(all(not x.get("absent") for x in info), "les quatre fiches vivacité sont dans le contenu", [x["id"] for x in info if x.get("absent")])
            ok(all(sorted(x["profils"]) == ["elite", "perf", "reprise", "sportif"] for x in info), "une dose pour chacun des quatre profils", {x["id"]: x["profils"] for x in info})
            ok(all(x["refsOk"] for x in info), "chaque fiche cite des sources qui existent dans la bibliographie", {x["id"]: x["refsOk"] for x in info})
            ok(all(x["steps"] >= 3 and x["cues"] >= 2 and x["sc"] for x in info), "étapes, consignes et schéma présents partout", {x["id"]: (x["steps"], x["cues"], x["sc"]) for x in info})
            sk = byid["sk_coupe"]
            ok(sk["skill"] and sk["fiche"] and sk["test"] == "t505", "la coupe à 45° est une fiche Technique complète (objectifs, organisation, variantes), reliée au test 505", sk)
            for s in ("rugby", "foot", "hand", "basket", "tennis", "ski", "baseball"):
                ok(all(s in x["sports"] for x in info), f"les fiches sont ouvertes au sport de changement de direction « {s} »", {x["id"]: s in x["sports"] for x in info})
            for s in ("course", "natation", "cyclisme", "triathlon"):
                ok(all(s not in x["sports"] for x in info), f"et fermées à un sport sans changement de direction (« {s} »)")
            ok("boxe" in byid["g_cod_signal"]["sports"] and "boxe" not in byid["g_cod_angles"]["sports"],
               "le signal réactif s'ouvre aux sports de combat (appuis au signal), pas le parcours planifié à plots")

            # ---------- sources verifiees : les cinq references exactes ----------
            refs = await c.evaluate("() => ['sheppard06','young15','paul16','nimphius16','dossantos18'].map((k) => SREFS[k] || '')")
            attendu = ["J Sports Sci. 2006;24(9):919-932", "Int J Sports Sci Coach. 2015;10(1):159-169", "Sports Med. 2016;46(3):421-442",
                       "J Strength Cond Res. 2016;30(11):3024-3032", "Sports Med. 2018;48(10):2235-2253"]
            ok(all(a in r for a, r in zip(attendu, refs)), "revue, année, volume et pages exacts pour les cinq études", refs)

            # ---------- dose par profil : la progression monte avec le niveau ----------
            doses = await c.evaluate("""() => ['reprise','sportif','perf','elite'].map((n) => drillDose(DRILLS.find((x) => x.id === 'g_freinage'), n))""")
            ok([d["s"] * d["r"] for d in doses] == sorted(d["s"] * d["r"] for d in doses) and doses[0]["s"] * doses[0]["r"] < doses[3]["s"] * doses[3]["r"],
               "freinage : le volume monte de Reprise à Haut niveau", [(d["s"], d["r"], d["t"]) for d in doses])

            # ---------- ecran terrain d'un client rugby : une fiche vivacité visible et son schéma rendu ----------
            await c.locator(".xteaser").get_by_role("button", name="Terrain", exact=True).click(); await c.wait_for_timeout(600)
            carte = c.locator(".tcard", has_text="Freiner avant de tourner")
            ok(await carte.count() == 1, "écran terrain : « Freiner avant de tourner » proposé à un rugbyman", await c.locator(".tcard").count())
            await carte.first.click(); await c.wait_for_timeout(600)
            txt = await c.inner_text("body")
            ok(await c.locator(".ts-svg").count() >= 1, "schéma dessiné (zone d'arrêt, sprint, retour)")
            ok("Zone d'arrêt" in txt and "Dos'Santos" in txt, "fiche ouverte : zone d'arrêt sur le schéma et source affichée", txt[:400])
            ok("3 séries de 6 freinages, élan de 15 m" in txt, "dose du profil Performance affichée", txt[txt.find("séries"):txt.find("séries") + 120])
            await c.screenshot(path=f"{OUT}/01_freinage.png", full_page=True)
            # la fiche est une page (pas une fenêtre) : on revient par le bouton « Retour »
            await c.get_by_role("button", name="Retour").first.click(); await c.wait_for_timeout(500)

            # ---------- bibliotheque Technique : la coupe à 45° y est, avec son schéma ----------
            coupe = c.locator(".tcard", has_text="La coupe à 45°")
            ok(await coupe.count() == 1, "fiche Technique « La coupe à 45° » visible pour le rugby", await c.locator(".tcard").count())
            await coupe.first.click(); await c.wait_for_timeout(600)
            txt3 = await c.inner_text("body")
            ok("Avant-dernier appui" in txt3 and "Nimphius" in txt3, "fiche de la coupe : consigne de l'appui et source du déficit de changement de direction", txt3[:400])
            ok("Coupe à 90°" in txt3, "variantes et progression affichées")
            await c.screenshot(path=f"{OUT}/02_coupe.png", full_page=True)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
