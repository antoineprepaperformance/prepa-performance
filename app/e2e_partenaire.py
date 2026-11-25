"""Partenariat commercial (NutriPure) : la carte du client, le lien d'affiliation et surtout la mention
obligatoire.

Un lien remunere presente sans annonce claire du partenariat est une pratique commerciale trompeuse par
omission (code de la consommation, art. L121-1 ; loi du 9 juin 2023 sur l'influence commerciale). La
regle est donc dans le code : sans mention, rien ne s'affiche. Ce test verifie qu'on ne peut pas la
contourner, et qu'aucun complement alimentaire n'est mis en avant a un mineur."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8903
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/partenaire"; os.makedirs(OUT, exist_ok=True)
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


BASE = """([l, an, part]) => { const db = {};
  db['clients/u_p1'] = { name: 'Antoine', sex: 'H', height: 180, weight: 80, birthYear: an };
  db['plans/u_p1'] = { programId: 'masse', offer: 'suivi2', weeks: 12, start: l, equipment: 'salle', status: 'active', niveau: 'perf', extra: ['nutri'], message: '', cycle: 1, validatedAt: '2026-11-01T00:00:00.000Z', reviewedAt: '2026-11-01T00:00:00.000Z' };
  if (part) db['settings/app'] = { partenaire: part, updatedAt: '2026-11-25T00:00:00.000Z' };
  localStorage.setItem('__mockdb', JSON.stringify(db)); }"""


async def nutri(pg, an=1995, part=None):
    await pg.evaluate("localStorage.clear()")
    await pg.evaluate(BASE, [LUNDI, an, part])
    await pg.reload(); await pg.wait_for_timeout(1500)
    await pg.locator("nav.tabbar button", has_text="Nutrition").click(); await pg.wait_for_timeout(1100)
    return await pg.inner_text("body")


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 1000}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=p1")

            # ---------- la carte, pour un client majeur ----------
            t = await nutri(c)
            ok(dans("NutriPure", t) and dans("LIMOUSI", t) and dans("10 % sur ta première commande", t),
               "la carte montre la marque, le code et la remise", t[t.find("partenaire"):][:200])
            ok(dans("Partenariat commercial", t) and dans("commission", t) and dans("ton prix ne change pas", t),
               "la mention de partenariat est affichée au même endroit que l'offre (L121-1)", t[t.find("Partenariat commercial"):][:200])
            ok(dans("ne remplace pas une alimentation construite", t),
               "la réserve santé est affichée : un complément ne remplace pas l'alimentation")
            a = c.locator('a[href*="nutripure"]').first
            href, rel = await a.get_attribute("href"), await a.get_attribute("rel")
            ok("s=LIMOUSI" in (href or ""), "le lien porte le code d'affiliation d'Antoine", href)
            ok("sponsored" in (rel or "") and "noopener" in (rel or ""),
               "le lien est marqué « sponsored » (lien rémunéré) et « noopener »", rel)
            await c.locator(".card", has_text="NutriPure").first.screenshot(path=f"{OUT}/01_carte.png")

            # ---------- la page du jour : la ou ca doit se voir ----------
            await c.locator("nav.tabbar button", has_text="Aujourd").click(); await c.wait_for_timeout(900)
            tj = await c.inner_text("body")
            ok(await c.locator(".part-b").count() == 1 and dans("NutriPure", tj) and dans("LIMOUSI", tj),
               "page du jour : le bandeau du partenaire est là, avec le code", tj[:200])
            ok(dans("Partenariat commercial", tj),
               "et la mention de partenariat l'accompagne aussi sur la page du jour")
            blocs = await c.evaluate("() => [...document.querySelectorAll('.today .tb')].map((x) => x.dataset.block)")
            ok(blocs[:2] == ["todo", "partenaire"] if len(blocs) > 1 else False,
               "il est en deuxième position, juste sous la séance du jour", blocs)
            await c.screenshot(path=f"{OUT}/02_page_du_jour.png", full_page=False)

            # ---------- un mineur ne voit rien ----------
            tm = await nutri(c, an=TODAY.year - 15)
            ok(not dans("NutriPure", tm) and not dans("LIMOUSI", tm),
               "aucun complément alimentaire mis en avant à un client mineur", tm[:160])
            await c.locator("nav.tabbar button", has_text="Aujourd").click(); await c.wait_for_timeout(900)
            ok(await c.locator(".part-b").count() == 0,
               "ni sur sa page du jour : le bandeau ne s'affiche pas non plus")

            # ---------- sans mention, rien ne s'affiche ----------
            sans = await nutri(c, part={"on": True, "nom": "NutriPure", "url": "https://exemple.fr/?s=X", "code": "X", "remise": 10, "mention": "", "quoi": "x"})
            ok(not dans("NutriPure", sans),
               "mention vidée : le partenariat disparaît au lieu d'être affiché sans son annonce", sans[:160])
            ok(await c.locator('a[href*="exemple.fr"]').count() == 0,
               "et le lien rémunéré n'est pas présent non plus")

            # ---------- le coach peut couper ----------
            off = await nutri(c, part={"on": False, "nom": "NutriPure", "url": "https://exemple.fr/?s=X", "code": "X", "remise": 10, "mention": "Partenariat commercial.", "quoi": "x"})
            ok(not dans("NutriPure", off), "partenariat masqué dans les réglages : rien n'est affiché", off[:160])

            # ---------- le coach peut changer la marque et le code ----------
            autre = await nutri(c, part={"on": True, "nom": "AutreMarque", "url": "https://autre.fr/?s=ABC", "code": "ABC123", "remise": 15, "mention": "Partenariat commercial : commission.", "quoi": "Autre chose."})
            ok(dans("AutreMarque", autre) and dans("ABC123", autre) and dans("15 % sur ta première commande", autre),
               "marque, code et remise viennent des réglages du coach, pas du code", autre[autre.find("partenaire"):][:200])

            # ---------- les traductions ----------
            for lang, att in (("en", "Commercial partnership"), ("es", "Colaboración comercial")):
                lp = await A.new_page(); hook(lp, "langue-" + lang)
                await lp.goto(URL + f"?as=p1&lang={lang}"); await lp.wait_for_timeout(1500)
                got = await lp.evaluate("(k) => tr(k)", "Partenariat commercial : Antoine touche une commission sur les commandes passées avec ce lien. Ton prix ne change pas.")
                ok(got.startswith(att), f"la mention de partenariat est traduite en {lang}", got[:80])
                await lp.close()

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
