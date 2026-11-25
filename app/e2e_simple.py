"""Application plus simple pour un debutant (src/25_perso.js, src/04_client.js) : page du jour reduite a
l'essentiel tant que le client debute, un bouton qui ramene tout, le choix « L'essentiel / Tout » dans les
reglages, et un sommaire « Mes reglages » en haut du profil qui mene a chaque carte.

Verifie surtout ce qui ne doit PAS arriver : rien de perdu (les blocs ecartes reviennent en un bouton), le
message du coach et la nutrition jamais masques, et aucun reglage deja choisi par le client ecrase."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8899
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/simple"; os.makedirs(OUT, exist_ok=True)
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


BASE = """([l, logs, prefs, sport]) => {
  const db = {};
  db['clients/u_p1'] = { name: 'Nouveau', sex: 'H', height: 180, weight: 80, birthYear: 1995, ...(sport ? { sportId: sport, sportAdapt: true } : {}), ...(prefs ? { prefs } : {}) };
  db['plans/u_p1'] = { programId: 'masse', offer: 'suivi2', weeks: 12, start: l, equipment: 'salle', status: 'active', niveau: 'reprise', extra: [], message: 'Bienvenue, on commence doucement.', cycle: 1, validatedAt: '2026-11-01T00:00:00.000Z', reviewedAt: '2026-11-01T00:00:00.000Z' };
  for (let i = 0; i < logs; i++) db['clients/u_p1/logs/w1-s' + i] = { date: l, done: ['sq'], at: l + 'T18:00:00.000Z' };
  localStorage.setItem('__mockdb', JSON.stringify(db));
}"""


async def charge(pg, logs=0, prefs=None, tout=False, sport="rugby"):
    await pg.evaluate("localStorage.clear()")
    await pg.evaluate(BASE, [LUNDI, logs, prefs, sport])
    if tout: await pg.evaluate("localStorage.setItem('today_tout', '1')")
    await pg.reload(); await pg.wait_for_timeout(1600)


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 900}, color_scheme="dark")
            cl = await A.new_page(); hook(cl, "client")
            await cl.goto(URL + "?as=p1")

            # ---------- un debutant : page courte ----------
            await charge(cl, logs=0)
            t = await cl.inner_text("body")
            ok(dans("Semaine 1", t) and dans("À faire aujourd'hui", t), "débutant : sa séance et sa semaine sont là", t[:200])
            ok(dans("Bienvenue, on commence doucement", t), "le message du coach n'est jamais masqué", t[:300])
            ok(not dans("Ma carte athlète", t) and not dans("Article", t) and not dans("Séances en plus", t),
               "les blocs qui peuvent attendre ne sont pas affichés d'emblée", [x for x in ("Ma carte athlète", "Article", "Séances en plus") if dans(x, t)])
            ok(await cl.locator(".part-b").count() == 1,
               "le partenaire d'Antoine fait partie de l'essentiel : c'est un choix commercial assumé, visible dès le premier jour")
            ok(await cl.locator(".tweek").count() == 1,
               "mais sa séance terrain reste : c'est la seule porte vers l'écran terrain, la masquer rendait son sport inatteignable")
            await charge(cl, logs=0, sport=None)
            ok(await cl.locator(".tweek").count() == 0 and dans("Affichage simplifié", await cl.inner_text("body")),
               "sans sport choisi, pas de séance terrain : la page reste courte")
            await charge(cl, logs=0)
            ok(dans("Affichage simplifié", t) and await cl.get_by_role("button", name="Afficher tout ce que l'application sait faire").count() == 1,
               "l'écran dit qu'il est simplifié et comment tout voir")
            await cl.screenshot(path=f"{OUT}/01_debutant.png", full_page=True)

            # ---------- un bouton ramene tout, et le choix reste ----------
            await cl.get_by_role("button", name="Afficher tout ce que l'application sait faire").first.click(); await cl.wait_for_timeout(900)
            t2 = await cl.inner_text("body")
            ok(dans("Ma carte athlète", t2) and dans("Article", t2), "le bouton ramène tout : rien n'était perdu", t2[:200])
            ok(await cl.get_by_role("button", name="Revenir à l'affichage simple").count() == 1, "et on peut revenir en arrière")
            await cl.reload(); await cl.wait_for_timeout(1500)
            ok(dans("Ma carte athlète", await cl.inner_text("body")), "le choix « tout voir » tient après rechargement", None)
            await cl.screenshot(path=f"{OUT}/02_tout.png", full_page=True)

            # ---------- un client qui s'entraine depuis un moment : plus rien d'impose ----------
            await charge(cl, logs=5)
            t3 = await cl.inner_text("body")
            ok(dans("Ma carte athlète", t3) and not dans("Affichage simplifié", t3),
               "après 5 séances, la page complète s'affiche sans bandeau : on n'impose plus rien", t3[:200])

            # ---------- un client qui a deja choisi son affichage : on n'y touche pas ----------
            await charge(cl, logs=0, prefs={"blocks": {"off": ["nutri"], "order": []}})
            t4 = await cl.inner_text("body")
            ok(dans("Ma carte athlète", t4) and not dans("Affichage simplifié", t4),
               "un client qui a déjà réglé son affichage garde son choix, même débutant", t4[:200])

            # ---------- le choix dans les reglages ----------
            await charge(cl, logs=0)
            await cl.locator('button[aria-label="Mon profil"]').first.click(); await cl.wait_for_timeout(1300)
            prof = await cl.inner_text("body")
            ok(dans("Ce que je veux voir sur ma page du jour", prof) and dans("L'essentiel", prof) and dans("Choisir bloc par bloc", prof),
               "réglages : le choix « L'essentiel / Tout », le détail replié", prof[prof.find("Ce que je veux voir"):][:200])

            # ---------- le sommaire des reglages ----------
            som = cl.locator("section.card", has_text="Mes réglages").first
            st = await som.inner_text()
            ok(dans("Tout ce que tu peux changer", st) and dans("Mon programme", st) and dans("Mes mesures", st) and dans("Mes commandes", st),
               "le profil commence par un sommaire de tout ce qui se change", st[:300])
            await cl.get_by_role("button", name="Mes mesures").first.click(); await cl.wait_for_timeout(900)
            vis = await cl.evaluate("""() => { const e = document.getElementById("rg-mesures"); if (!e) return null; const r = e.getBoundingClientRect(); return r.top > -60 && r.top < window.innerHeight; }""")
            ok(vis is True, "toucher une ligne du sommaire amène sur la bonne carte", vis)
            ancres = await cl.evaluate("() => ['rg-programme','rg-objectifs','rg-sport','rg-mesures','rg-langue','rg-affichage','rg-commandes'].filter((i) => !!document.getElementById(i))")
            ok(len(ancres) == 7, "chaque ligne du sommaire a sa carte", ancres)
            await cl.screenshot(path=f"{OUT}/03_sommaire.png", full_page=True)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
