"""Modifier un repas deja note (src/09_nutrition.js, MealEdit).

Avant, on ne pouvait que supprimer et tout ressaisir : une photo qui estime 120 g de riz au lieu de 200,
ou l'huile de cuisson oubliee, coutait tout le repas. On verifie ici qu'on peut corriger une quantite,
ajouter un aliment oublie, en retirer un, et que les totaux du jour suivent — sans perdre le repas ni
son identifiant."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8905
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/repas"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()
LUNDI = (TODAY - datetime.timedelta(days=TODAY.weekday())).isoformat()
J = TODAY.isoformat()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def dans(a, b): return (a or "").lower() in (b or "").lower()


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


BASE = """([l, j]) => { const db = {};
  db['clients/u_p1'] = { name: 'Antoine', sex: 'H', height: 180, weight: 80, birthYear: 1995 };
  db['clients/u_p1/nutri/plan'] = { mode: 'perte', targets: { kcal: 2400, p: 160, c: 250, f: 80 }, at: l, poids: 80, vitesse: 0.5 };
  db['plans/u_p1'] = { programId: 'masse', offer: 'suivi2', weeks: 12, start: l, equipment: 'salle', status: 'active', niveau: 'perf', extra: ['nutri'], message: '', cycle: 1, validatedAt: '2026-11-01T00:00:00.000Z', reviewedAt: '2026-11-01T00:00:00.000Z' };
  db['clients/u_p1/food/' + j] = { meals: [ { id: 'm1', slot: 'midi', at: j + 'T12:30:00.000Z', src: 'photo', title: 'Riz et poulet',
    items: [ { n: 'Riz blanc cuit', g: 120, kcal: 156, p: 3, c: 34, f: 0 }, { n: 'Blanc de poulet', g: 150, kcal: 165, p: 35, f: 2, c: 0 } ],
    kcal: 321, p: 38, c: 34, f: 2 } ], updatedAt: j + 'T12:31:00.000Z' };
  localStorage.setItem('__mockdb', JSON.stringify(db)); }"""


async def journal(pg):
    await pg.evaluate("localStorage.clear()")
    await pg.evaluate(BASE, [LUNDI, J])
    await pg.reload(); await pg.wait_for_timeout(1600)
    await pg.locator("nav.tabbar button", has_text="Nutrition").click(); await pg.wait_for_timeout(1300)


async def repasEnregistre(pg):
    return await pg.evaluate("() => { const db = JSON.parse(localStorage.getItem('__mockdb')); const k = Object.keys(db).find((x) => x.includes('/food/')); return db[k].meals[0]; }")


async def total(pg):
    return await pg.evaluate("() => { const b = document.querySelector('.modal .tot-line b'); return b ? b.innerText : ''; }")


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 1000}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=p1")

            # ---------- le repas se modifie, il ne se re-saisit plus ----------
            await journal(c)
            t = await c.inner_text("body")
            ok(dans("Riz et poulet", t) and await c.get_by_role("button", name="Modifier").count() == 1,
               "le repas noté porte un bouton « Modifier », à côté de « Supprimer »", t[t.find("Riz et poulet"):][:120])
            await c.get_by_role("button", name="Modifier").first.click(); await c.wait_for_timeout(900)
            tm = await c.inner_text(".modal")
            ok(dans("Riz blanc cuit", tm) and dans("Blanc de poulet", tm),
               "la fenêtre s'ouvre sur les aliments déjà enregistrés", tm[:160])
            ok(await c.locator(".modal #fd-q").count() == 1 and dans("plat type", tm),
               "on peut y ajouter un aliment ou un plat type, comme à la saisie")

            # ---------- corriger une quantite recalcule tout ----------
            av = await total(c)
            await c.locator(".modal .it-wrap", has_text="Riz blanc cuit").locator("select.it-cnt").select_option("2")
            await c.wait_for_timeout(700)
            ap = await total(c)
            ok(av and ap and av != ap and int(ap.split()[0]) > int(av.split()[0]),
               "changer une quantité recalcule les calories du repas", {"avant": av, "après": ap})
            await c.screenshot(path=f"{OUT}/01_modification.png", full_page=True)

            # ---------- ajouter l'aliment oublie ----------
            await c.fill(".modal #fd-q", "une cuillere a soupe d huile d olive"); await c.wait_for_timeout(1800)
            bt = c.locator(".modal").get_by_role("button", name="Ajouter cet aliment")
            if not await bt.count(): bt = c.locator(".modal").get_by_role("button", name="Ajouter ces 2 aliments")
            ok(await bt.count() > 0, "l'aliment cherché est proposé à l'ajout")
            if await bt.count(): await bt.first.click(); await c.wait_for_timeout(700)
            ap2 = await total(c)
            ok(ap2 and int(ap2.split()[0]) > int(ap.split()[0]), "l'ajout entre dans le total", {"avant": ap, "après": ap2})

            # ---------- enregistrer : meme repas, valeurs a jour ----------
            await c.get_by_role("button", name="Enregistrer les modifications").click(); await c.wait_for_timeout(1300)
            m = await repasEnregistre(c)
            riz = [i for i in m["items"] if "Riz" in i["n"]][0]
            ok(m["id"] == "m1" and m["at"].startswith(J),
               "c'est le même repas qui est modifié, pas un nouveau : identifiant et heure conservés", {"id": m["id"], "at": m["at"]})
            ok(riz["g"] > 120 and riz["kcal"] > 156 and len(m["items"]) == 3,
               "la quantité corrigée et l'aliment ajouté sont enregistrés", {"riz": riz, "aliments": len(m["items"])})
            ok(m["kcal"] == sum(i["kcal"] for i in m["items"]) and m["p"] == sum(i["p"] for i in m["items"]),
               "le total du repas est la somme de ses aliments, pas une valeur restée en arrière", {"repas": m["kcal"], "aliments": sum(i["kcal"] for i in m["items"])})
            ok(bool(m.get("editedAt")), "la date de modification est notée")
            tj = await c.inner_text("body")
            ok(dans(str(m["kcal"]), tj), "le journal du jour affiche le nouveau total", tj[tj.find("Riz et poulet") - 80:][:200])

            # ---------- retirer un aliment ----------
            await c.get_by_role("button", name="Modifier").first.click(); await c.wait_for_timeout(900)
            await c.locator(".modal .it-wrap", has_text="Blanc de poulet").locator("button.x").click(); await c.wait_for_timeout(500)
            await c.get_by_role("button", name="Enregistrer les modifications").click(); await c.wait_for_timeout(1300)
            m2 = await repasEnregistre(c)
            ok(len(m2["items"]) == 2 and not any("poulet" in i["n"].lower() for i in m2["items"]),
               "on peut retirer un aliment du repas", [i["n"] for i in m2["items"]])
            ok(m2["kcal"] < m["kcal"], "et le total redescend", {"avant": m["kcal"], "après": m2["kcal"]})

            # ---------- un repas vide ne s'enregistre pas ----------
            await c.get_by_role("button", name="Modifier").first.click(); await c.wait_for_timeout(900)
            for _ in range(2):
                n = await c.locator(".modal .it-wrap button.x").count()
                if not n: break
                await c.locator(".modal .it-wrap button.x").first.click(); await c.wait_for_timeout(400)
            ok(await c.locator(".modal .it-wrap").count() == 0, "tous les aliments peuvent être retirés dans la fenêtre")
            btn = c.locator(".modal").get_by_role("button", name="Enregistrer les modifications")
            ok(await btn.count() == 0 or await btn.first.is_disabled(),
               "mais un repas sans aucun aliment ne s'enregistre pas : il faut le supprimer, pas le vider")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(400)
            m3 = await repasEnregistre(c)
            ok(len(m3["items"]) == 2, "fenêtre fermée sans enregistrer : le repas est intact", [i["n"] for i in m3["items"]])

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
