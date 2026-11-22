"""Echelle des tests sur la carte athlete (src/10_card.js, cardEchelle) : chaque test montre les paliers
reellement connus — bon niveau, repere du poste quand une etude le donne, record du monde — avec l'ecart
qui reste jusqu'au suivant.

Verifie surtout ce qui ne doit PAS arriver : un palier invente quand la donnee n'existe pas (sport ou poste
sans etude), un palier « record du monde » sans sa source nommee, un ordre de paliers incoherent, et un
palier tire d'une etude qui ne mesure PAS comme le test du client (les sprints au portique : voir la regle
dans content_cartes.py). Les reperes de charge, eux, sont mesures comme le test (3 a 5 repetitions, maximum
estime) : ils doivent etre la, ramenes au poids du client."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8883
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/echelle"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()
LUNDI = (TODAY - datetime.timedelta(days=TODAY.weekday())).isoformat()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def dans(a, b): return (a or "").lower() in (b or "").lower()


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 1000}, color_scheme="dark")
            cl = await A.new_page(); hook(cl, "client")
            await cl.goto(URL + "?as=p1"); await cl.evaluate("localStorage.removeItem('__mockdb')")
            lundi = (TODAY - datetime.timedelta(days=TODAY.weekday())).isoformat()
            await cl.evaluate("""([l]) => { const db = {};
              db['clients/u_p1'] = { name: 'Antoine', sportId: 'rugby', poste: 'trois-quarts', sex: 'H', height: 178, weight: 80, birthYear: 1995 };
              db['plans/u_p1'] = { programId: 'vitesse', offer: 'suivi2', weeks: 12, start: l, equipment: 'salle', status: 'active', niveau: 'perf', extra: [], message: '', cycle: 1, validatedAt: '2026-11-01T00:00:00.000Z', reviewedAt: '2026-11-01T00:00:00.000Z' };
              db['clients/u_p1/tests/t0'] = { at: l + 'T10:00:00.000Z', values: { sprint10: 1.95, sprint30: 4.3, t5km: 18, e1rm_squat: { kg: 150, reps: 3 }, e1rm_dc: { kg: 90, reps: 3 } } };
              localStorage.setItem('__mockdb', JSON.stringify(db)); }""", [lundi])
            await cl.reload(); await cl.wait_for_timeout(1600)

            # ---------- la logique des paliers ----------
            e = await cl.evaluate("""() => {
              const f = (tid, val, sport, poste) => { const x = cardEchelle(tid, val, "H", 80, sport, poste); return x && { b: x.barreaux.map((y) => [y.k, Math.round(y.v * 100) / 100, y.n, !!y.src]), suiv: x.suivant && x.suivant.k, att: x.atteints, pct: x.pct }; };
              return { sprintTq: f("sprint10", 1.95, "rugby", "trois-quarts"), squatTq: f("e1rm_squat", 150, "rugby", "trois-quarts"),
                       squatAv: f("e1rm_squat", 150, "rugby", "avant"), dcTq: f("e1rm_dc", 90, "rugby", "trois-quarts"),
                       sansPoste: f("e1rm_squat", 150, "rugby", null), autreSport: f("e1rm_squat", 150, "tennis", "simple"),
                       fort: f("e1rm_squat", 300, "rugby", "trois-quarts"), fond: f("t5km", 18, "rugby", "trois-quarts") };
            }""")
            k = lambda x: [y[0] for y in x["b"]]
            v = lambda x: dict((y[0], y[1]) for y in x["b"])
            n = lambda x: dict((y[0], y[2]) for y in x["b"])
            ok(k(e["sprintTq"]) == ["bon", "monde"],
               "sprint 10 m : aucun palier de poste, les études chronomètrent au portique et pas comme le test du client (Haugen 2012)", e["sprintTq"]["b"])
            ok(k(e["squatTq"]) == ["bon", "poste", "monde"] and abs(v(e["squatTq"])["poste"] - 189.84) < 0.5 and v(e["squatTq"])["monde"] > 290,
               "squat : le repère du poste est ramené au poids du client (202 kg pour 88 kg → 190 kg pour 80 kg)", e["squatTq"]["b"])
            ok(n(e["squatTq"])["poste"] == "Moyenne des internationaux · Trois-quarts",
               "le palier dit ce qu'est le chiffre, et porte le nom lisible du poste (pas son identifiant)", n(e["squatTq"]))
            ok(abs(v(e["squatAv"])["poste"] - 199.99) < 0.5 and v(e["squatAv"])["poste"] > v(e["squatTq"])["poste"],
               "un avant a son propre repère, plus haut que celui d'un trois-quarts", {"avant": v(e["squatAv"]), "tq": v(e["squatTq"])})
            ok(k(e["dcTq"]) == ["poste", "bon", "monde"] and abs(v(e["dcTq"])["poste"] - 92.25) < 0.5,
               "développé couché : la moyenne des internationaux passe sous le bon niveau général, l'échelle le montre au lieu de le cacher", e["dcTq"]["b"])
            ok(k(e["sansPoste"]) == ["bon", "monde"] and k(e["autreSport"]) == ["bon", "monde"],
               "aucun palier inventé : sans poste connu, ou pour un sport sans étude, il n'y a que bon niveau et record du monde",
               {"sansPoste": e["sansPoste"]["b"], "autreSport": e["autreSport"]["b"]})
            ok(e["squatTq"]["suiv"] == "bon" and e["squatTq"]["att"] == [], "à 150 kg pour 80 kg : le prochain palier est le bon niveau, aucun atteint", e["squatTq"])
            ok(e["fort"]["att"] == ["bon", "poste", "monde"] and e["fort"]["suiv"] is None and e["fort"]["pct"] >= 100,
               "à 300 kg, au-delà du record ramené à son poids : tous les paliers sont atteints et l'échelle le dit", e["fort"])
            ok(e["fond"] and k(e["fond"]) == ["bon", "monde"] and e["fond"]["pct"] > 0,
               "un test d'endurance a son échelle aussi, sans palier de poste inventé", e["fond"])

            # ---------- a l'ecran ----------
            await cl.locator('button[aria-label="Mon profil"]').first.click(); await cl.wait_for_timeout(1500)
            # au debut, la comparaison aux records est repliee (toi contre toi d'abord) : il faut l'ouvrir
            det = cl.locator('summary', has_text="comparaison avec les records du monde")
            if await det.count():
                await det.first.click(); await cl.wait_for_timeout(500)
            t = await cl.inner_text("body")
            ok(dans("Bon niveau", t) and dans("Moyenne des internationaux", t) and dans("Record du monde", t),
               "la carte montre les paliers nommés", t[t.find("Squat"):t.find("Squat") + 320])
            ok(dans("Prochain palier", t) and dans("il te reste", t), "elle dit ce qu'il reste pour le palier suivant", t[t.find("Prochain palier"):t.find("Prochain palier") + 160])
            ok(await cl.locator(".jauge").count() >= 2 and await cl.locator(".jg-l li").count() >= 4,
               "une échelle par test, avec ses paliers", {"echelles": await cl.locator(".jauge").count(), "paliers": await cl.locator(".jg-l li").count()})
            # la regle elle-meme : la position du client, les reperes, et sa photo dessus
            jg = await cl.evaluate("""() => {
              const b = document.querySelector(".jg-bar"); if (!b) return null;
              const moi = b.querySelector(".jg-moi"), fill = b.querySelector(".jg-fill"), ticks = [...b.querySelectorAll(".jg-t")];
              return { moi: moi && moi.style.left, fill: fill && fill.style.width, ticks: ticks.map((t) => t.style.left),
                       atteints: ticks.filter((t) => t.classList.contains("on")).length, photo: !!(moi && moi.querySelector(".avatar")) };
            }""")
            ok(jg and jg["moi"] and jg["moi"] == jg["fill"], "la règle place le client au même endroit que la barre remplie", jg)
            ok(jg and len(jg["ticks"]) >= 2 and all(0 <= float(t.replace("%", "")) <= 100 for t in jg["ticks"]),
               "chaque palier est placé sur la règle, entre 0 et 100 %", jg and jg["ticks"])
            ok(jg and jg["photo"], "la photo (ou l'avatar) du client est posée sur la règle, pas celle d'un athlète connu", jg)
            await cl.screenshot(path=f"{OUT}/01_echelle.png", full_page=True)

            # ---------- avant le premier test : les paliers visibles quand meme ----------
            # Antoine : « je ne vois pas de changement sur mon profil » — sans aucun test, il n'y avait
            # rien a comparer, donc rien a voir. Il y a maintenant ce qu'il y a a viser.
            vide = await A.new_page(); hook(vide, "sans-test")
            await vide.goto(URL + "?as=p1"); await vide.evaluate("localStorage.clear()")
            await vide.evaluate("""([l]) => { const db = {};
              db['clients/u_p1'] = { name: 'Antoine', sportId: 'rugby', poste: 'trois-quarts', sex: 'H', height: 180, weight: 80, birthYear: 1995 };
              db['plans/u_p1'] = { programId: 'prepa', offer: 'suivi2', weeks: 12, start: l, equipment: 'salle', status: 'active', niveau: 'perf', extra: [], message: '', cycle: 1, validatedAt: '2026-11-01T00:00:00.000Z', reviewedAt: '2026-11-01T00:00:00.000Z' };
              localStorage.setItem('__mockdb', JSON.stringify(db)); }""", [LUNDI])
            await vide.reload(); await vide.wait_for_timeout(1500)
            await vide.locator('button[aria-label="Mon profil"]').first.click(); await vide.wait_for_timeout(1400)
            tv = await vide.inner_text("body")
            ok(dans("Pas encore de test", tv) and dans("à viser dans ton sport", tv),
               "sans aucun test : la carte dit ce qu'il y a à viser au lieu de rester vide", tv[:200])
            ok(dans("Usain Bolt", tv), "le palier du record porte le nom de son détenteur, pris dans la source déjà vérifiée", tv[tv.find("Record du monde"):][:120])
            ok(dans("pas encore mesuré", tv) and dans("Moyenne des internationaux · Trois-quarts", tv) and dans("190 kg", tv),
               "le repère de son poste est montré avant le premier test, déjà ramené à son poids", tv[tv.find("Pas encore de test"):][:300])
            ok(await vide.locator(".jg-moi").count() == 0,
               "aucun marqueur « toi » tant qu'il n'y a pas de mesure : on ne prête aucune valeur au client")
            await vide.screenshot(path=f"{OUT}/02_avant_test.png", full_page=True)
            await vide.close()

            # ---------- les traductions ----------
            for lang, att in (("en", {"Bon niveau": "Good level", "Record du monde": "World record", "Moyenne des internationaux": "International average"}),
                              ("es", {"Bon niveau": "Buen nivel", "Record du monde": "Récord del mundo", "Moyenne des internationaux": "Media de los internacionales"})):
                lp = await A.new_page(); hook(lp, "langue-" + lang)
                await lp.goto(URL + f"?as=p1&lang={lang}"); await lp.wait_for_timeout(1500)
                got = await lp.evaluate("(ks) => { const o = {}; ks.forEach((k) => { o[k] = tr(k); }); return o; }", list(att))
                ok(got == att, f"les paliers sont traduits en {lang}", got)
                # le palier compose (« Moyenne des internationaux · Trois-quarts ») passe par un motif :
                # c'est la partie fragile du mecanisme, le poste etant traduit a part.
                comp = await lp.evaluate("() => tr('Moyenne des internationaux · Trois-quarts')")
                ok(comp.startswith(att["Moyenne des internationaux"] + " · ") and comp != "Moyenne des internationaux · Trois-quarts",
                   f"le palier avec le poste est traduit en {lang} (motif)", comp)
                await lp.close()

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
