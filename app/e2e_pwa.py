"""Installation et hors ligne : manifeste, icônes, service worker (site publié, non configuré)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, json, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8124
async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=str(pathlib.Path(HERE).parent / ("docs" if (pathlib.Path(HERE).parent / "MISE_EN_LIGNE.md").exists() else "repo/docs")), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    res = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            c = await b.new_context(viewport={"width": 390, "height": 844})
            pg = await c.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await pg.goto(f"http://localhost:{PORT}/")
            await pg.wait_for_timeout(500)
            res.append(("écran d'installation affiché", await pg.get_by_text("pas encore relié à Firebase").count() > 0))
            man = await pg.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
            res.append(("manifeste valide (standalone, 3 icônes)", man["display"] == "standalone" and len(man["icons"]) == 3))
            for ic in man["icons"]:
                st = await pg.evaluate(f"fetch('{ic['src']}').then(r => r.status + ' ' + r.headers.get('content-type'))")
                res.append(("icône " + ic["src"], st.startswith("200 image/png")))
            await pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null || window.__swReady", timeout=10000) if False else None
            reg = await pg.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
            res.append(("service worker actif", reg))
            await pg.reload(); await pg.wait_for_timeout(800)
            await c.set_offline(True)
            await pg.reload(); await pg.wait_for_timeout(1200)
            res.append(("page ouverte hors ligne", await pg.get_by_text("pas encore relié à Firebase").count() > 0))
            fonts = await pg.evaluate("document.fonts.check('700 20px \"Barlow Condensed\"') && document.fonts.check('400 15px Barlow')")
            res.append(("polices locales chargées hors ligne", fonts))
            res.append(("aucune erreur JS", not [e for e in errs if "ERR_INTERNET_DISCONNECTED" not in e]))
            if errs: print(errs[:5])
            await b.close()
    finally:
        srv.terminate()
    for k, v in res: print(("  OK  " if v else "  FAIL ") + k)
    print(sum(1 for _, v in res if v), "/", len(res))
asyncio.run(run())
