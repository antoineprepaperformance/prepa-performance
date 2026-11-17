"""Offre club (content_programs.CLUB, src/13_acces.js, src/site/11_site.js, src/05_coach.js) : la saison
d'equipe vendue a un club, par saison ou par cycle, avec sa grille de prix publique, sa demande de devis et
ses regles de vente entre professionnels.

Tourne sans emulateur Firebase (page d'accueil + fausse base) : la partie coach, qui demande une connexion,
n'est verifiee que si l'emulateur d'authentification repond (c'est le cas sur le robot du dimanche).
Verifie surtout ce qui ne doit PAS arriver : aucune donnee de joueur dans une demande de devis, aucun
document forge accepte, et la lecture des demandes fermee au public."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, json, os, subprocess, sys, time, urllib.error, urllib.request
from playwright.async_api import async_playwright
PORT = 8833
URL = f"http://127.0.0.1:{PORT}/index.html"
EMU = "http://127.0.0.1:9099"
OUT = HERE + "/shots/club"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0, "skip": 0}


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def esp(t):
    """Les prix sont ecrits par toLocaleString : l'espace avant € est une espace insecable fine (U+202F).
    On la ramene a une espace normale avant toute comparaison, sinon « 590 € » ne se trouve jamais."""
    return (t or "").replace("\u202f", " ").replace("\u00a0", " ").replace("\u2009", " ")


def dans(aiguille, botte):
    """Sans tenir compte de la casse : .eyebrow, .btn et .l-badge sont mis en MAJUSCULES par la CSS."""
    return esp(aiguille).lower() in esp(botte).lower()


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


def passe(msg):
    res["skip"] += 1
    print("  —   " + msg + " (ignoré : émulateur d'authentification absent)")


def emu_up():
    try:
        urllib.request.urlopen(EMU + "/", timeout=2).read(); return True
    except Exception:
        return False


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/site_test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 1000}, color_scheme="dark", accept_downloads=True)
            pub = await A.new_page(); hook(pub, "site")
            await pub.goto(URL); await pub.wait_for_timeout(2500)
            await pub.evaluate("window.__fakefs.reset()")

            # ---------- la grille de prix ----------
            prix = await pub.evaluate("""() => ({ c: CONTENT.CLUB, saison: clubPrice(null, "saison"), cycle: clubPrice(null, "cycle"),
              joueur: clubPrice(null, "joueur"), minJ: clubMinJ(null), on: clubOn(null),
              regle: clubPrice({ club: { saison: 777 } }, "saison"), semCycle: CONTENT.CLUB.semCycle })""")
            ok(prix["saison"] == 590 and prix["cycle"] == 149 and prix["joueur"] == 25 and prix["minJ"] == 15,
               "grille club : 590 € la saison, 149 € le cycle, 25 € par joueur, 15 joueurs minimum", {k: prix[k] for k in ("saison", "cycle", "joueur", "minJ")})
            ok(prix["cycle"] < prix["saison"] and prix["joueur"] < prix["cycle"], "la grille est cohérente : un cycle coûte moins que la saison, un joueur moins qu'un cycle", prix)
            ok(prix["semCycle"] == 6 and prix["on"] is True, "un cycle fait 6 semaines et l'offre est proposée par défaut", prix)
            ok(prix["regle"] == 777, "Antoine peut changer un prix dans ses réglages (settings.club)", prix["regle"])

            # ---------- la section « Pour les clubs » de la page d'accueil ----------
            t = esp(await pub.inner_text("body"))
            ok(dans("Pour les clubs", t), "page d'accueil : la section club existe", t[:200])
            ok("590 €" in t and "149 €" in t and "25 €" in t, "les trois prix sont affichés publiquement", [x for x in ("590 €", "149 €", "25 €") if x not in t])
            ok(dans("cycles de 6 semaines", t) and dans("minuteur", t), "ce que le club achète est dit : la saison découpée en cycles, déroulable au minuteur", t[t.find("Pour les clubs"):t.find("Pour les clubs") + 500])
            ok(dans("TVA non applicable", t) and dans("devis, virement et facture", t) and dans("article 2 bis", t),
               "les conditions de la vente entre professionnels sont annoncées", t[t.find("Pour les clubs"):t.find("Pour les clubs") + 900])
            ok(dans("responsable de l'encadrement", t), "ce que le club garde à sa charge est écrit avant l'achat")
            await pub.evaluate("document.querySelector('#clubs').scrollIntoView()")
            await pub.screenshot(path=f"{OUT}/01_section_club.png", full_page=True)

            # ---------- la demande de devis ----------
            await pub.locator("#clubs").get_by_role("button", name="Demander un devis").click(); await pub.wait_for_timeout(600)
            ok(await pub.locator(".modal").count() == 1, "le bouton ouvre le formulaire de demande de devis")
            await pub.fill("#cd-c", "US Test Rugby")
            await pub.fill("#cd-s", "Rugby, Fédérale 3")
            await pub.fill("#cd-j", "28")
            await pub.fill("#cd-n", "Paul Entraîneur")
            await pub.fill("#cd-e", "paul@ustestrugby.fr")
            await pub.fill("#cd-t", "0600000000")
            await pub.fill("#cd-m", "Reprise en juillet, 3 séances par semaine.")
            await pub.locator(".modal").get_by_role("radio", name="Saison + accès joueurs").click(); await pub.wait_for_timeout(200)
            await pub.locator(".modal").get_by_role("button", name="Demander un devis").click(); await pub.wait_for_timeout(900)
            m = esp(await pub.locator(".modal").inner_text())
            ok(dans("Demande reçue", m) and dans("48 h", m) and dans("Rien n'est engagé", m), "demande envoyée : accusé affiché, et rien d'engagé", m[:300])
            dem = await pub.evaluate("() => Object.entries(window.__fakefs.load()).filter(([k]) => k.indexOf('demandes_club/') === 0).map(([k, v]) => ({ k, v }))")
            ok(len(dem) == 1, "une demande, une seule, est enregistrée", len(dem))
            d = dem[0]["v"] if dem else {}
            ok(d.get("club") == "US Test Rugby" and d.get("joueurs") == 28 and d.get("offre") == "joueurs" and d.get("email") == "paul@ustestrugby.fr" and d.get("done") is False,
               "la demande contient ce que le club a écrit, et rien d'autre", d)
            ok(sorted(d.keys()) == sorted(["at", "club", "sport", "joueurs", "name", "email", "tel", "offre", "msg", "done"]),
               "aucun champ en trop : pas de donnée de joueur, pas de champ technique", sorted(d.keys()))
            await pub.screenshot(path=f"{OUT}/02_devis_envoye.png", full_page=True)

            # le recapitulatif telecharge : ce que le club garde pour son bureau
            async with pub.expect_download(timeout=6000) as dl:
                await pub.get_by_role("button", name="Télécharger le récapitulatif").click()
            d2 = await dl.value
            chemin = await d2.path()
            rec = esp(pathlib.Path(chemin).read_text(encoding="utf-8")) if chemin else ""
            ok(d2.suggested_filename == "demande-devis-club.txt" and dans("US Test Rugby", rec) and dans("590 €", rec) and dans("Devis ferme à venir", rec),
               "le club peut télécharger le récapitulatif de sa demande, avec les prix affichés ce jour-là", [d2.suggested_filename, rec[:200]])

            # ---------- ce que les regles doivent refuser ----------
            essais = await pub.evaluate("""async () => {
              const fs = firebase.firestore();
              const bon = { at: new Date().toISOString(), club: "Club X", sport: "Rugby", joueurs: 20, name: "Jean Test", email: "j@x.fr", tel: "", offre: "saison", msg: "", done: false };
              const essai = async (id, d) => { try { await fs.doc("demandes_club/" + id).set(d); return "accepte"; } catch (e) { return e.code || "refuse"; } };
              const out = {};
              out.champEnTrop = await essai("cbad111111", { ...bon, admin: true });
              out.offreInconnue = await essai("cbad222222", { ...bon, offre: "gratuit" });
              out.joueursHorsBornes = await essai("cbad333333", { ...bon, joueurs: 5000 });
              out.dejaTraitee = await essai("cbad444444", { ...bon, done: true });
              out.messageEnorme = await essai("cbad555555", { ...bon, msg: "x".repeat(900) });
              out.idInvalide = await essai("zzz", bon);
              out.lecturePublique = await (async () => { try { await fs.collection("demandes_club").get(); return "accepte"; } catch (e) { return e.code || "refuse"; } })();
              return out;
            }""")
            ok(all(v != "accepte" for v in essais.values()), "règles : champ en trop, offre inconnue, effectif absurde, demande déjà traitée, message énorme, identifiant invalide et lecture publique — tout est refusé", essais)
            apres = await pub.evaluate("() => Object.keys(window.__fakefs.load()).filter((k) => k.indexOf('demandes_club/') === 0).length")
            ok(apres == 1, "aucun document forgé n'est entré dans la base", apres)

            # ---------- les conditions de vente et la confidentialite ----------
            await pub.locator(".modal").get_by_role("button", name="Fermer").first.click() if await pub.locator(".modal").get_by_role("button", name="Fermer").count() else await pub.keyboard.press("Escape")
            await pub.wait_for_timeout(400)
            await pub.get_by_role("button", name="Conditions de vente").first.click(); await pub.wait_for_timeout(700)
            cgv = esp(await pub.locator(".modal").inner_text())
            ok(dans("2 bis. Offre club", cgv), "conditions de vente : l'article 2 bis existe", cgv[:200])
            ok(dans("réservé aux consommateurs, ne s'applique pas", cgv), "le droit de rétractation de 14 jours est écarté, et la raison est dite")
            ok(dans("40 €", cgv) and dans("L441-10", cgv), "pénalités de retard et indemnité de 40 € : mentions obligatoires entre professionnels")
            ok(dans("ni revendue", cgv) or dans("ne peut être ni revendue", cgv), "le droit d'usage limite la programmation aux équipes du club")
            ok("590 €" in cgv and "149 €" in cgv, "les prix club figurent dans l'article Prix", cgv[cgv.find("3. Prix"):cgv.find("3. Prix") + 600])
            await pub.locator(".modal").get_by_role("radio", name="Confidentialité").click(); await pub.wait_for_timeout(500)
            conf = esp(await pub.locator(".modal").inner_text())
            ok(dans("Demande de devis d'un club", conf), "politique de confidentialité : le traitement de la demande de devis est décrit", conf[:200])
            ok(dans("ne concernent pas les joueurs", conf) and dans("3 ans après le dernier contact", conf), "elle dit ce qui n'est pas collecté et combien de temps c'est gardé")
            await pub.screenshot(path=f"{OUT}/03_cgv_club.png", full_page=True)

            # ---------- l'offre et ses conditions, traduites ----------
            # Un club étranger ne commandera peut-être jamais, mais un visiteur anglophone ne doit pas tomber
            # sur une moitié de page en français — et surtout pas sur des conditions de vente à moitié traduites.
            for lang, att in (("en", {"Pour les clubs": "For clubs", "2 bis. Offre club": "2 bis. Club offer", "Demander un devis": "Request a quotation"}),
                              ("es", {"Pour les clubs": "Para los clubes", "2 bis. Offre club": "2 bis. Oferta club", "Demander un devis": "Pedir un presupuesto"})):
                lp = await A.new_page(); hook(lp, "langue-" + lang)
                await lp.goto(URL + f"?lang={lang}"); await lp.wait_for_timeout(2000)
                got = await lp.evaluate("(ks) => { const o = {}; ks.forEach((k) => { o[k] = tr(k); }); return o; }", list(att))
                longs = await lp.evaluate("""() => {
                  const c = clubCgvTxt(null), f = clubConfidTxt();
                  return { pro: tr(c.pro) !== c.pro, prix: tr(c.prix) !== c.prix, offre: tr(c.offre) !== c.offre, confid: tr(f) !== f };
                }""")
                ok(got == att, f"section club et article 2 bis traduits en {lang}", got)
                ok(all(longs.values()), f"les paragraphes juridiques de l'offre club sont traduits en {lang}", longs)
                await lp.close()

            # ---------- cote coach : seulement si l'emulateur repond ----------
            if not emu_up():
                for m in ("réglages du coach : la carte « Offre club »", "tableau de bord : la demande de devis et son chiffrage", "demande marquée traitée"):
                    passe(m)
            else:
                import urllib.parse  # noqa: F401
                co = await A.new_page(); hook(co, "coach")
                await co.goto(URL); await co.wait_for_timeout(1500)
                await co.get_by_role("button", name="Créer mon compte", exact=True).first.click(); await co.wait_for_timeout(400)
                await co.fill("#au-e", "coach@test.fr"); await co.fill("#au-p", "motdepasse123")
                await co.locator(".modal").get_by_role("button", name="Créer mon compte").click(); await co.wait_for_timeout(1500)
                try:
                    codes = json.loads(urllib.request.urlopen(urllib.request.Request(EMU + "/emulator/v1/projects/demo-prepa/oobCodes", headers={"Authorization": "Bearer owner"})).read())
                    link = [c for c in codes["oobCodes"] if c["email"] == "coach@test.fr"][-1]["oobLink"]
                    urllib.request.urlopen(link).read()
                    await co.get_by_role("button", name="J'ai confirmé mon adresse").click(); await co.wait_for_timeout(2500)
                except Exception as e:
                    errs.append(f"[coach] connexion impossible : {e}")
                await co.get_by_role("button", name="Offres & réglages", exact=True).click(); await co.wait_for_timeout(900)
                v = [await co.input_value("#cb-s"), await co.input_value("#cb-c"), await co.input_value("#cb-j"), await co.input_value("#cb-mj")]
                ok(v == ["590", "149", "25", "15"], "réglages du coach : la carte « Offre club » affiche la grille par défaut", v)
                await co.get_by_role("button", name="Tableau de bord", exact=True).click(); await co.wait_for_timeout(1200)
                tb = esp(await co.inner_text("body"))
                ok(dans("US Test Rugby", tb) and dans("1 290 €", tb.replace(" ", " ").replace(" ", " ")),
                   "tableau de bord : la demande apparaît avec son chiffrage (590 € + 28 joueurs × 25 €)", tb[:400])
                await co.get_by_role("button", name="Traitée").first.click(); await co.wait_for_timeout(900)
                tb2 = esp(await co.inner_text("body"))
                ok(not dans("US Test Rugby", tb2), "une demande marquée traitée disparaît du tableau de bord", tb2[:200])
                await co.screenshot(path=f"{OUT}/04_coach_demande.png", full_page=True)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs" + (f", {res['skip']} ignorés" if res["skip"] else ""))
    finally:
        srv.terminate()
    if res["ko"]:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
