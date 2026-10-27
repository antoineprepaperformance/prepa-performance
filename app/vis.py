"""Captures visuelles rapides (aperçu client et espace coach) en mobile et grand écran."""
import asyncio, subprocess, sys, time
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
from playwright.async_api import async_playwright
OUT = HERE + "/shots/card"
errs = []
async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765"], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for name, vp, scheme in [("m", {"width": 390, "height": 844}, "dark"), ("d", {"width": 1366, "height": 900}, "dark"), ("ml", {"width": 390, "height": 844}, "light")]:
                c = await b.new_context(viewport=vp, color_scheme=scheme)
                pg = await c.new_page()
                pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error", "warning") and "Failed to load" not in m.text else None)
                pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
                await pg.goto("http://localhost:8765/index.html?as=owner"); await pg.wait_for_timeout(900)
                if name == "d":
                    await pg.locator("ul.alerts button", has_text="Lucas").first.click(); await pg.wait_for_timeout(500)
                    await pg.get_by_role("radio", name="Vue d'ensemble").click(); await pg.wait_for_timeout(400)
                    await pg.screenshot(path=f"{OUT}/{name}_coach_vue.png", full_page=True)
                    await pg.get_by_role("button", name="Tableau de bord", exact=True).click(); await pg.wait_for_timeout(300)
                    await pg.screenshot(path=f"{OUT}/{name}_coach_dash.png")
                await pg.get_by_role("button", name="Aperçu côté client").first.click(); await pg.wait_for_timeout(500)
                await pg.screenshot(path=f"{OUT}/{name}_today.png", full_page=True)
                await pg.get_by_role("button", name="Mon profil").click(); await pg.wait_for_timeout(500)
                await pg.screenshot(path=f"{OUT}/{name}_profil.png", full_page=True)
                if name == "m":
                    await pg.get_by_role("button", name="Changer ma photo ou mon avatar").first.click(); await pg.wait_for_timeout(300)
                    await pg.screenshot(path=f"{OUT}/{name}_avatar.png")
                    await pg.locator(".av-opt").nth(3).click(); await pg.locator(".av-col").nth(4).click()
                    await pg.set_input_files("#av-photo", HERE + "/test/photo_repas.jpg"); await pg.wait_for_timeout(600)
                    await pg.screenshot(path=f"{OUT}/{name}_avatar_photo.png")
                    await pg.get_by_role("button", name="Enregistrer", exact=True).click(); await pg.wait_for_timeout(500)
                    await pg.screenshot(path=f"{OUT}/{name}_profil_photo.png", full_page=True)
                    await pg.locator("nav.tabbar button", has_text="Bilan").click(); await pg.wait_for_timeout(300)
                    await pg.screenshot(path=f"{OUT}/{name}_bilan.png", full_page=True)
                if name == "d":
                    await pg.locator("nav.tabbar button", has_text="Nutrition").click(); await pg.wait_for_timeout(400)
                    await pg.screenshot(path=f"{OUT}/{name}_nutrition.png", full_page=True)
                    await pg.locator("nav.tabbar button", has_text="Progrès").click(); await pg.wait_for_timeout(400)
                    await pg.screenshot(path=f"{OUT}/{name}_progres.png", full_page=True)
                await c.close()
            await b.close()
    finally: srv.terminate()
    print("\n".join(errs[:30]) or "no console errors")
asyncio.run(run())
