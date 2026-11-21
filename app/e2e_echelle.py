"""Echelle des tests sur la carte athlete (src/10_card.js, cardEchelle) : chaque test montre les paliers
reellement connus — bon niveau, haut niveau au poste quand une etude le donne, record du monde — avec
l'ecart qui reste jusqu'au suivant.

Verifie surtout ce qui ne doit PAS arriver : un palier invente quand la donnee n'existe pas (sport ou poste
sans etude), un palier « record du monde » sans sa source nommee, et un ordre de paliers incoherent."""
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
              db['clients/u_p1/tests/t0'] = { at: l + 'T10:00:00.000Z', values: { sprint10: 1.95, sprint30: 4.3, t5km: 18 } };
              localStorage.setItem('__mockdb', JSON.stringify(db)); }""", [lundi])
            await cl.reload(); await cl.wait_for_timeout(1600)

            # ---------- la logique des paliers ----------
            e = await cl.evaluate("""() => {
              const f = (tid, val, sport, poste) => { const x = cardEchelle(tid, val, "H", 80, sport, poste); return x && { b: x.barreaux.map((y) => [y.k, y.v, !!y.src]), suiv: x.suivant && x.suivant.k, att: x.atteints, pct: x.pct }; };
              return { tq: f("sprint10", 1.95, "rugby", "trois-quarts"), avant: f("sprint10", 1.95, "rugby", "avant"),
                       sansPoste: f("sprint10", 1.95, "rugby", null), autreSport: f("sprint10", 1.95, "tennis", "simple"),
                       rapide: f("sprint10", 1.70, "rugby", "trois-quarts"), fond: f("t5km", 18, "rugby", "trois-quarts") };
            }""")
            ok([x[0] for x in e["tq"]["b"]] == ["bon", "poste", "monde"],
               "trois-quarts : trois paliers, du plus accessible au record du monde", e["tq"]["b"])
            ok(e["tq"]["b"][1][1] == 1.77 and e["tq"]["b"][2][1] == 1.74 and e["tq"]["b"][2][2],
               "le palier du poste vient de l'étude (1,77 s) et le record du monde garde sa source", e["tq"]["b"])
            av = dict(zip([x[0] for x in e["avant"]["b"]], [x[1] for x in e["avant"]["b"]]))
            ok(av.get("poste") == 1.85 and [x[0] for x in e["avant"]["b"]] == ["poste", "bon", "monde"],
               "un avant a son propre palier (1,85 s), classé avant le bon niveau général : un avant international est plus lourd, donc moins rapide", e["avant"]["b"])
            ok([x[0] for x in e["sansPoste"]["b"]] == ["bon", "monde"] and [x[0] for x in e["autreSport"]["b"]] == ["bon", "monde"],
               "aucun palier inventé : sans poste connu, ou pour un sport sans étude, il n'y a que bon niveau et record du monde",
               {"sansPoste": e["sansPoste"]["b"], "autreSport": e["autreSport"]["b"]})
            ok(e["tq"]["suiv"] == "bon" and e["tq"]["att"] == [], "à 1,95 s : le prochain palier est le bon niveau, aucun atteint", e["tq"])
            ok(e["rapide"]["att"] == ["bon", "poste", "monde"] and e["rapide"]["suiv"] is None and e["rapide"]["pct"] >= 100,
               "à 1,70 s, plus rapide que le record du monde sur 10 m : tous les paliers sont atteints et l'échelle le dit", e["rapide"])
            ok(e["fond"] and [x[0] for x in e["fond"]["b"]] == ["bon", "monde"] and e["fond"]["pct"] > 0,
               "un test d'endurance a son échelle aussi, sans palier de poste inventé", e["fond"])

            # ---------- a l'ecran ----------
            await cl.locator('button[aria-label="Mon profil"]').first.click(); await cl.wait_for_timeout(1500)
            t = await cl.inner_text("body")
            ok(dans("Bon niveau", t) and dans("Haut niveau", t) and dans("Record du monde", t),
               "la carte montre les paliers nommés", t[t.find("Sprint 10 m"):t.find("Sprint 10 m") + 300])
            ok(dans("Prochain palier", t) and dans("il te reste", t), "elle dit ce qu'il reste pour le palier suivant", t[t.find("Prochain palier"):t.find("Prochain palier") + 160])
            ok(await cl.locator(".echelle").count() >= 2 and await cl.locator(".ech-l li").count() >= 4,
               "une échelle par test, avec ses paliers", {"echelles": await cl.locator(".echelle").count(), "paliers": await cl.locator(".ech-l li").count()})
            await cl.screenshot(path=f"{OUT}/01_echelle.png", full_page=True)

            # ---------- les traductions ----------
            for lang, att in (("en", {"Bon niveau": "Good level", "Record du monde": "World record"}),
                              ("es", {"Bon niveau": "Buen nivel", "Record du monde": "Récord del mundo"})):
                lp = await A.new_page(); hook(lp, "langue-" + lang)
                await lp.goto(URL + f"?as=p1&lang={lang}"); await lp.wait_for_timeout(1500)
                got = await lp.evaluate("(ks) => { const o = {}; ks.forEach((k) => { o[k] = tr(k); }); return o; }", list(att))
                ok(got == att, f"les paliers sont traduits en {lang}", got)
                await lp.close()

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
