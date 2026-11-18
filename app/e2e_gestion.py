"""Gestion des clients et des clubs cote coach (src/05_coach.js, src/38_equipe.js) : ajouter un client,
le supprimer depuis la liste (mode « Gerer »), voir a quel club il est rattache ; ecran Clubs a deux onglets
avec, pour chaque club, ses places prises et ses clients.

Verifie surtout ce qui ne doit PAS arriver : pas de suppression sans taper SUPPRIMER, pas de suppression
d'un exemple, et rien qui reste dans la base apres la suppression (droit a l'effacement)."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8853
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/gestion"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def dans(a, b):
    """Sans tenir compte de la casse : .eyebrow, .btn et les en-tetes de tableau passent en MAJUSCULES."""
    return (a or "").lower() in (b or "").lower()


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def mdb_keys(page, prefix):
    return await page.evaluate("(p) => Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{}')).filter((k) => k.indexOf(p) === 0)", prefix)


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.evaluate("localStorage.removeItem('__mockdb')")

            # ---------- deux vrais clients, dont un rattache a un club ----------
            start = (TODAY - datetime.timedelta(days=14)).isoformat()
            plan = {"programId": "vitesse", "offer": "suivi2", "weeks": 12, "start": start, "equipment": "salle",
                    "status": "active", "niveau": "sportif", "extra": [], "message": "", "cycle": 1,
                    "validatedAt": "2026-11-01T00:00:00.000Z", "reviewedAt": "2026-11-01T00:00:00.000Z"}
            await mdb_set(co, "clients/u_g1", {"name": "Paul Aîné", "sportId": "rugby", "sex": "H", "height": 182, "weight": 88, "birthYear": 2000, "club": "cl_test", "clubRole": "joueur"})
            await mdb_set(co, "plans/u_g1", plan)
            await mdb_set(co, "clients/u_g2", {"name": "Marie Cadette", "sportId": "foot", "sex": "F", "height": 168, "weight": 60, "birthYear": 2002})
            await mdb_set(co, "plans/u_g2", plan)
            await mdb_set(co, "clients/u_g1/logs/2026-11-10", {"done": ["sq"], "at": "2026-11-10T18:00:00.000Z"})
            await mdb_set(co, "clients/u_g1/tests/t0", {"values": {"sprint10": 1.9}, "at": "2026-11-01T10:00:00.000Z"})
            await mdb_set(co, "coachnotes/u_g1", {"text": "Note privée de test", "at": "2026-11-10T10:00:00.000Z"})
            await mdb_set(co, "clubs/cl_test", {"id": "cl_test", "n": "US Gestion", "n_modele": "Modèle test", "offre": "cycle", "cycle": 2, "places": 20,
                                                "jours": [1, 3], "heure": "19h30", "match": 5, "du": "2026-11-02", "au": "2026-12-13", "weeks": 6,
                                                "seances": [{"d": "2026-11-03", "phase": "Saison - Semaine 7", "theme": "intense", "debut": "19h30", "min": 60,
                                                             "acts": [{"n": "ECHAUFFEMENT", "min": 15, "l": [{"d": "Gammes"}]}]}],
                                                "codes": {"joueurs": "CLUBJ1", "entraineur": "CLUBE1"}, "membres": {"u_g1": "joueur"}})
            await mdb_set(co, "codes/CLUBJ1", {"code": "CLUBJ1", "kind": "offert", "offer": "auto", "weeks": 12, "max": 20, "uses": 3, "usedBy": {}, "active": True, "club": "cl_test", "role": "joueur"})
            await mdb_set(co, "codes/CLUBE1", {"code": "CLUBE1", "kind": "offert", "offer": "auto", "weeks": 12, "max": 3, "uses": 1, "usedBy": {}, "active": True, "club": "cl_test", "role": "entraineur"})
            await co.reload(); await co.wait_for_timeout(1500)

            # ---------- la liste des clients ----------
            await co.get_by_role("button", name="Clients", exact=True).first.click(); await co.wait_for_timeout(800)
            t = await co.inner_text("body")
            ok(dans("Ajouter un client", t), "liste des clients : le bouton « Ajouter un client » est là, en haut")
            ok(dans("2 clients", t), "le nombre de vrais clients est affiché (les exemples comptés à part)", t[:300])
            ok(dans("US Gestion", t), "le club d'un client se voit depuis la liste, sans ouvrir sa fiche", t[:400])
            ok(await co.locator("table.ctable thead th", has_text="Gérer").count() == 0, "aucune colonne de suppression tant qu'on n'est pas en mode Gérer")
            await co.screenshot(path=f"{OUT}/01_liste.png", full_page=True)

            # ---------- ajouter un client ----------
            await co.get_by_role("button", name="Ajouter un client").first.click(); await co.wait_for_timeout(600)
            ok(await co.locator(".modal").count() == 1, "« Ajouter un client » ouvre bien un formulaire", await co.inner_text("body"))
            await co.keyboard.press("Escape"); await co.wait_for_timeout(300)

            # ---------- mode Gerer : supprimer un client ----------
            await co.get_by_role("button", name="Gérer", exact=True).click(); await co.wait_for_timeout(500)
            g = await co.inner_text("body")
            ok(await co.locator("table.ctable thead th", has_text="Gérer").count() == 1 and dans("mode Gérer", g), "mode Gérer : la colonne apparaît et l'écran dit à quoi elle sert")
            ok(await co.locator("table.ctable tbody").get_by_role("button", name="Supprimer").count() == 2,
               "un bouton Supprimer par vrai client, et aucun sur un exemple", await co.locator("table.ctable tbody").get_by_role("button", name="Supprimer").count())
            # les exemples ne s'affichent plus des qu'il y a de vrais clients : on les redemande pour verifier
            # qu'ils n'offrent pas de suppression (elle ne menerait a rien : ils ne sont pas enregistres)
            await co.locator(".side-nav button", has_text="Tableau de bord").first.click(); await co.wait_for_timeout(700)
            if await co.get_by_role("button", name="Afficher les exemples").count():
                await co.get_by_role("button", name="Afficher les exemples").first.click(); await co.wait_for_timeout(600)
            await co.locator(".side-nav button", has_text="Clients").first.click(); await co.wait_for_timeout(700)
            await co.get_by_role("button", name="Gérer", exact=True).click(); await co.wait_for_timeout(500)
            n_demo = await co.locator("table.ctable tbody td", has_text="exemple").count()
            n_sup = await co.locator("table.ctable tbody").get_by_role("button", name="Supprimer").count()
            ok(n_demo >= 1 and n_sup == 2, "exemples affichés : « exemple » à la place du bouton, et toujours un bouton par vrai client", {"exemples": n_demo, "boutons": n_sup})
            await co.locator("table.ctable tbody tr", has_text="Marie Cadette").get_by_role("button", name="Supprimer").click(); await co.wait_for_timeout(600)
            m = await co.locator(".modal").inner_text()
            ok(dans("Marie Cadette", m) and dans("Action définitive", m) and dans("compte de connexion", m),
               "la fenêtre dit ce qui sera effacé, que c'est définitif, et ce qui ne l'est pas (le compte de connexion)", m[:300])
            btn = co.locator(".modal").get_by_role("button", name="Supprimer définitivement")
            ok(await btn.is_disabled(), "le bouton reste inactif tant que SUPPRIMER n'est pas tapé")
            await co.fill(".modal input#del-c-u_g2", "n'importe quoi"); await co.wait_for_timeout(200)
            ok(await btn.is_disabled(), "un autre mot ne débloque pas la suppression")
            await co.fill(".modal input#del-c-u_g2", "supprimer"); await co.wait_for_timeout(200)
            ok(not await btn.is_disabled(), "le mot SUPPRIMER débloque le bouton (la casse n'a pas d'importance)")
            await co.screenshot(path=f"{OUT}/02_suppression.png", full_page=True)
            await btn.click(); await co.wait_for_timeout(1200)
            reste = await mdb_keys(co, "clients/u_g2")
            ok(not reste and not await mdb_keys(co, "plans/u_g2"), "le client supprimé ne laisse rien dans la base", [reste, await mdb_keys(co, "plans/u_g2")])
            t2 = await co.inner_text("body")
            ok(not dans("Marie Cadette", t2) and dans("1 client", t2), "la liste se met à jour : un client en moins", t2[:250])

            # ---------- l'autre client et ses traces restent ----------
            ok(await mdb_keys(co, "clients/u_g1/") and await mdb_keys(co, "coachnotes/u_g1"),
               "supprimer un client ne touche pas les autres", await mdb_keys(co, "clients/u_g1/"))

            # ---------- ecran Clubs : deux onglets ----------
            await co.locator(".side-nav button", has_text="Clubs").first.click(); await co.wait_for_timeout(900)
            c = await co.inner_text("body")
            ok(dans("Clubs (1)", c) and dans("Modèles de saison", c), "écran Clubs : deux onglets, et le nombre de clubs", c[:400])
            ok(dans("US Gestion", c) and dans("3 places prises sur 20", c), "chaque club dit ce qu'il a acheté et combien de places sont prises", c[:600])
            ok(dans("1 client rattaché", c) and dans("Paul", c), "le club montre ses clients rattachés, sans ouvrir leurs fiches", c[:600])
            await co.screenshot(path=f"{OUT}/03_clubs.png", full_page=True)
            await co.get_by_role("radio", name="Modèles de saison").click(); await co.wait_for_timeout(500)
            c2 = await co.inner_text("body")
            ok(dans("Importer un classeur", c2) and not dans("US Gestion", c2), "l'onglet des modèles ne mélange plus les clubs et les classeurs", c2[:400])

            # ---------- la fiche d'un club : ses clients, et le lien vers la fiche ----------
            await co.get_by_role("radio", name="Clubs").first.click(); await co.wait_for_timeout(400)
            await co.get_by_role("button", name="US Gestion").first.click(); await co.wait_for_timeout(900)
            d = await co.inner_text("body")
            ok(dans("Ses clients", d) and dans("Paul Aîné", d) and dans("Joueur", d), "fiche du club : la carte « Ses clients » avec le rôle de chacun", d[:700])
            ok(dans("ne reçoit aucune donnée de ses joueurs", d), "il est rappelé que le club ne reçoit aucune donnée de ses joueurs")
            await co.get_by_role("button", name="Paul Aîné").first.click(); await co.wait_for_timeout(1200)
            f = await co.inner_text("body")
            ok(dans("Paul Aîné", f) and (dans("Vue d'ensemble", f) or dans("Sport & terrain", f)), "un clic sur un joueur ouvre sa fiche client", f[:300])
            await co.screenshot(path=f"{OUT}/04_fiche_club.png", full_page=True)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
