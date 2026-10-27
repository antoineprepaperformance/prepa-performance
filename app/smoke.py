import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, subprocess, sys, time, os
from playwright.async_api import async_playwright
PORT = 8765
OUT = HERE + "/shots"
os.makedirs(OUT, exist_ok=True)

async def main(urls, mobile=False, scheme="dark"):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1280, "height": 900}, color_scheme=scheme, device_scale_factor=1)
            page = await ctx.new_page()
            errs = []
            page.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
            for name, q in urls:
                await page.goto(f"http://localhost:{PORT}/index.html{q}")
                await page.wait_for_timeout(900)
                await page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
            print("\n".join(errs[:40]) or "no console errors")
            await b.close()
    finally:
        srv.terminate()

if __name__ == "__main__":
    asyncio.run(main([("owner_dash", "?as=owner")]))
