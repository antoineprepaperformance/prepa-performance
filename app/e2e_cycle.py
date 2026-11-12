"""Suivi du cycle menstruel (32_cycle.js) : se débloque si la cliente l'active elle-même (profil Femme),
phase du jour estimée à partir du dernier début de règles noté, partage avec le coach réglable à part,
désactivé par défaut."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8779
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/cycle"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)


async def mdb(page, path):
    return await page.evaluate("(p) => JSON.parse(localStorage.getItem('__mockdb') || '{}')[p]", path)


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=cyc1"); await c.evaluate("localStorage.removeItem('__mockdb')")
            # ---------- cliente, programme déjà en cours (seedé directement, hors onboarding) ; un début de
            # règles noté il y a 14 jours, pour un cycle de 28 j : aujourd'hui tombe en fenêtre ovulatoire ----------
            start15 = (TODAY - datetime.timedelta(days=14)).isoformat()
            await mdb_set(c, "clients/u_cyc1", {"name": "Claire Cycle", "sportId": "rugby", "sex": "F", "height": 170, "weight": 65, "birthYear": 1998})
            await mdb_set(c, "plans/u_cyc1", {"programId": "vitesse", "offer": "suivi", "weeks": 12, "start": start15, "equipment": "salle",
                                               "status": "active", "niveau": "sportif", "extra": [], "message": "", "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            await c.reload(); await c.wait_for_timeout(1200)
            await c.get_by_text("Ma santé du jour").first.click(); await c.wait_for_timeout(500)
            ok(await c.get_by_text("Suivi du cycle").count() == 1, "profil Femme : carte d'activation du suivi du cycle visible")

            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(800)
            await co.locator(".side-nav button", has_text="Clients").first.click(); await co.wait_for_timeout(500)
            await co.locator(".ctable tbody tr", has_text="Claire Cycle").first.click(); await co.wait_for_timeout(900)
            await co.get_by_role("radio", name="Santé", exact=True).click(); await co.wait_for_timeout(400)
            ok(not await co.get_by_text("Son cycle").count(), "suivi pas encore activé : rien côté coach")

            # ---------- activation puis saisie du début de règles d'il y a 14 jours (correction d'un jour passé) ----------
            await c.bring_to_front()
            await btn(c, "Activer le suivi")
            prof = await mdb(c, "clients/u_cyc1") or {}
            ok((prof.get("cycle") or {}).get("on") is True and (prof.get("cycle") or {}).get("share") is False, "profil : suivi activé, partage désactivé par défaut", prof.get("cycle"))
            await c.evaluate("(d) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); const k = 'clients/u_cyc1/sante/' + d; db[k] = { ...(db[k] || {}), regles: true, at: new Date().toISOString() }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", start15)
            await c.reload(); await c.wait_for_timeout(1200)
            await c.get_by_text("Ma santé du jour").first.click(); await c.wait_for_timeout(500)
            txt = await c.inner_text("body")
            ok("Fenêtre ovulatoire" in txt and "jour 15 sur 28" in txt, "14 jours après le début des règles (cycle de 28 j, par défaut) : fenêtre ovulatoire estimée", txt[txt.find("Mon cycle"):txt.find("Mon cycle") + 300] if "Mon cycle" in txt else txt[:300])
            ok("laxité ligamentaire" in txt and "technique" in txt, "fenêtre ovulatoire : repère de vigilance technique affiché, pas une interdiction ni un gabarit de charge")
            await c.get_by_text("Les sources, et pourquoi pas de règle automatique de charge").click(); await c.wait_for_timeout(200)
            txt2 = await c.inner_text("body")
            ok("Dos'Santos" in txt2 and "Meigni" in txt2 and "Herzberg" in txt2, "sources citées (3 références scientifiques)")
            await c.screenshot(path=f"{OUT}/01_ovulation.png", full_page=True)

            # ---------- un nouveau début de règles aujourd'hui (14 j après le précédent) : redevient le
            # repère le plus récent, et la durée moyenne se recalcule sur ces deux débuts réels (14 j), pas
            # sur la valeur par défaut (28 j) ----------
            await btn(c, "Mes règles ont commencé aujourd'hui")
            txt3 = await c.inner_text("body")
            seg3 = txt3[txt3.find("Mon cycle"):txt3.find("Mon cycle") + 200] if "Mon cycle" in txt3 else ""
            ok("jour 1 sur 14" in seg3 and "Fenêtre ovulatoire" not in seg3, "nouveau début de règles aujourd'hui : redevient jour 1, durée moyenne recalculée sur l'historique réel (14 j)", seg3)

            # ---------- partage avec le coach : désactivé par défaut, réglable, jamais une date brute transmise ----------
            await c.locator("#cy-share").click(); await c.wait_for_timeout(500)
            prof2 = await mdb(c, "clients/u_cyc1") or {}
            ok((prof2.get("cycle") or {}).get("share") is True, "partage activé par la cliente (profil mis à jour)", prof2.get("cycle"))
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await co.locator(".ctable tbody tr", has_text="Claire Cycle").first.click(); await co.wait_for_timeout(900)
            await co.get_by_role("radio", name="Santé", exact=True).click(); await co.wait_for_timeout(400)
            ctxt = await co.inner_text("body")
            seg = ctxt[ctxt.find("Son cycle"):ctxt.find("Son cycle") + 200] if "Son cycle" in ctxt else ""
            ok("Son cycle" in ctxt and "Règles" in seg and start15 not in ctxt, "partagé : le coach voit la phase du jour, jamais une date de règles brute", seg)
            await co.screenshot(path=f"{OUT}/02_coach_partage.png", full_page=True)

            await c.bring_to_front(); await c.locator("#cy-share").click(); await c.wait_for_timeout(500)
            prof3 = await mdb(c, "clients/u_cyc1") or {}
            ok((prof3.get("cycle") or {}).get("share") is False, "partage retiré par la cliente (profil mis à jour)", prof3.get("cycle"))
            await co.bring_to_front(); await co.reload(); await co.wait_for_timeout(1200)
            await co.locator(".ctable tbody tr", has_text="Claire Cycle").first.click(); await co.wait_for_timeout(900)
            await co.get_by_role("radio", name="Santé", exact=True).click(); await co.wait_for_timeout(400)
            ok(not await co.get_by_text("Son cycle").count(), "partage retiré : plus rien côté coach")

            # ---------- effacement des dates notées (RGPD art. 17) : un droit non testé n'est pas garanti ----------
            await c.bring_to_front()
            avant = await c.evaluate("() => Object.entries(JSON.parse(localStorage.getItem('__mockdb') || '{}')).filter(([k, v]) => k.indexOf('clients/u_cyc1/sante/') === 0 && v && v.regles).length")
            ok(avant >= 2, "des dates de règles sont bien enregistrées avant l'effacement", avant)
            # désactiver le suivi ne doit PAS détruire l'historique : une désactivation par erreur ne coûte rien
            await btn(c, "Désactiver le suivi")
            garde = await c.evaluate("() => Object.entries(JSON.parse(localStorage.getItem('__mockdb') || '{}')).filter(([k, v]) => k.indexOf('clients/u_cyc1/sante/') === 0 && v && v.regles).length")
            ok(garde == avant, "désactiver le suivi arrête l'estimation sans détruire les dates déjà notées", {"avant": avant, "apres": garde})
            # puis l'effacement explicite, confirmé, les supprime vraiment
            await btn(c, "Activer le suivi"); await c.wait_for_timeout(400)
            await btn(c, "Effacer mes dates notées")
            ok(await c.get_by_text("C'est définitif.").count() == 1, "l'effacement demande une confirmation avant d'agir")
            await btn(c, "Effacer définitivement"); await c.wait_for_timeout(700)
            apres = await c.evaluate("() => Object.entries(JSON.parse(localStorage.getItem('__mockdb') || '{}')).filter(([k, v]) => k.indexOf('clients/u_cyc1/sante/') === 0 && v && v.regles).length")
            ok(apres == 0, "effacement confirmé : plus aucune date de règles dans la santé du jour", {"restantes": apres})
            reste = await c.evaluate("() => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); const k = Object.keys(db).find((x) => x.indexOf('clients/u_cyc1/sante/') === 0); return k ? Object.keys(db[k]) : []; }")
            ok("regles" not in reste, "seul le champ des règles est retiré, le reste de la santé du jour est conservé", reste)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
