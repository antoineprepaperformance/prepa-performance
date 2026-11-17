"""Saison d'equipe (content_equipe.py genere par tools/saison_equipe.py, src/38_equipe.js) :
la programmation du club d'Antoine (CM Floirac Rugby, 102 seances) reprise telle qu'elle est ecrite,
consultable et filtrable cote coach, derоulable au minuteur, et visible par un joueur qui est aussi client.
Verifie surtout ce qui ne doit PAS arriver : la seance d'equipe n'entre pas dans la charge du joueur,
et rien n'apparait pour un client qui n'est rattache a aucune equipe."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8821
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/equipe"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs = []
res = {"ok": 0, "ko": 0}
TODAY = datetime.date.today()


def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))


def dans(aiguille, botte):
    """Cherche sans tenir compte de la casse : .eyebrow et .btn sont mis en MAJUSCULES par la CSS,
    et inner_text renvoie le texte rendu, pas le texte source."""
    return aiguille.lower() in (botte or "").lower()


def ok(cond, msg, extra=""):
    res["ok" if cond else "ko"] += 1
    print(("  OK  " if cond else "  FAIL ") + msg + ("" if cond else "  " + json.dumps(extra, ensure_ascii=False, default=str)[:400]))


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(1200)

            # ---------- le contenu genere : la saison complete ----------
            info = await co.evaluate("""() => {
              const e = (CONTENT.EQUIPES || [])[0]; if (!e) return null;
              const s = e.seances || [];
              const themes = {}; s.forEach((x) => { themes[x.theme || "(sans)"] = (themes[x.theme || "(sans)"] || 0) + 1; });
              const sansActs = s.filter((x) => !(x.acts || []).length).length;
              const sansTitre = s.filter((x) => (x.acts || []).some((a) => !a.n)).length;
              const durees = s.map((x) => x.min).filter(Boolean);
              return { id: e.id, n: e.n, sport: e.sport, du: e.du, au: e.au, nb: s.length, themes, sansActs, sansTitre,
                       dureeMin: Math.min(...durees), dureeMax: Math.max(...durees),
                       debuts: [...new Set(s.map((x) => x.debut).filter(Boolean))].slice(0, 3),
                       seqEx: eqSeq(s[0]).map((q) => [q.n, q.secs]) };
            }""")
            ok(info and info["nb"] == 99, "les 99 séances remplies de la saison sont dans le contenu", info and info["nb"])
            ok(info["id"] == "cmfloirac" and info["sport"] == "rugby" and info["du"] == "2025-07-03" and info["au"] == "2026-06-05",
               "saison identifiée : CM Floirac Rugby, du 3 juillet 2025 au 5 juin 2026", {k: info[k] for k in ("id", "sport", "du", "au")})
            ok(info["sansActs"] == 0 and info["sansTitre"] == 0, "chaque séance a ses activités, chaque activité a son titre", {"sansActs": info["sansActs"], "sansTitre": info["sansTitre"]})
            ok(info["themes"].get("modere") == 35 and info["themes"].get("intense") == 30 and info["themes"].get("vitesse") == 24 and info["themes"].get("volume") == 10,
               "les quatre thèmes d'Antoine sont repris avec leurs comptes", info["themes"])
            ok("(sans)" not in info["themes"], "toutes les séances importées ont un thème : les 3 onglets vides du classeur ne sont pas importés", info["themes"])
            ok(info["debuts"] and "18h30" in info["debuts"], "l'horaire de début est repris", info["debuts"])
            ok(20 <= info["dureeMin"] and info["dureeMax"] <= 150, "les durées sont plausibles", {"min": info["dureeMin"], "max": info["dureeMax"]})
            ok(all(isinstance(x[1], int) and x[1] > 0 for x in info["seqEx"]), "le minuteur reçoit une étape par activité, en secondes", info["seqEx"])

            # ---------- aucun nom de joueur dans le contenu publie ----------
            # Le classeur d'Antoine nomme des joueurs dans ses notes (« 80 m pour X, Y, Z »). Le depot et le
            # site sont PUBLICS et ces joueurs n'ont rien signe : le convertisseur remplace les noms (liste
            # tenue hors du depot, a cote du classeur). On verifie ici la trace du remplacement, et surtout
            # l'absence de la FORME d'une liste de noms — sans ecrire aucun nom dans ce fichier, qui est public.
            noms = await co.evaluate("""() => {
              const e = (CONTENT.EQUIPES || [])[0] || {};
              const txts = [];
              (e.seances || []).forEach((s) => { txts.push(s.phase || "");
                (s.acts || []).forEach((a) => { txts.push(a.n || ""); (a.l || []).forEach((l) => txts.push(l.d || "", l.note || "", l.x || "", l.t || "")); }); });
              const blob = txts.join(" || ");
              /* « pour Xxx, Yyy » ou « Xxx et Yyy » : la forme d'une enumeration de prenoms */
              const listes = blob.match(/[A-ZÀ-Þ][a-zà-ÿ]{2,}\\s*(?:,|\\bet\\b)\\s*[A-ZÀ-Þ][a-zà-ÿ]{2,}/g) || [];
              return { anonymises: (blob.match(/certains joueurs|un joueur/g) || []).length, listes: listes.slice(0, 5) };
            }""")
            ok(noms["anonymises"] >= 5, "les notes nominatives du classeur ont été remplacées par un libellé générique", noms["anonymises"])
            ok(not noms["listes"], "aucune énumération de prénoms ne subsiste dans le contenu publié", noms["listes"])

            # ---------- ecran coach : la saison, filtrable ----------
            await co.locator(".side-nav button", has_text="Équipe").first.click(); await co.wait_for_timeout(800)
            txt = await co.inner_text("body")
            ok(dans("CM Floirac Rugby", txt) and dans("99 séances", txt), "écran Équipe : la saison et son nombre de séances", txt[:300])
            ok(dans("Juillet 2025", txt) or dans("Novembre 2025", txt), "séances groupées par mois", txt[:400])
            await co.get_by_role("radio", name="Présaison").click(); await co.wait_for_timeout(500)
            t2 = await co.inner_text("body")
            ok(dans("Juillet 2025", t2) and not dans("Mars 2026", t2), "filtre Présaison : ne garde que les mois de présaison", t2[:300])
            await co.get_by_role("radio", name="Toute la saison").click(); await co.wait_for_timeout(400)
            await co.get_by_role("radio", name="Intense").click(); await co.wait_for_timeout(500)
            n_int = await co.evaluate("() => (document.body.innerText.match(/séances? dans ce filtre/) || []).length")
            t3 = await co.inner_text("body")
            ok(dans("30 séances dans ce filtre", t3), "filtre par thème : 30 séances Intense", t3[t3.find("séances"):t3.find("séances") + 80])
            await co.screenshot(path=f"{OUT}/01_saison.png", full_page=True)

            # ---------- une seance : son deroule tel qu'ecrit ----------
            await co.get_by_role("radio", name="Tous les thèmes").click(); await co.wait_for_timeout(400)
            await co.get_by_role("button", name="3 juil.").first.click(); await co.wait_for_timeout(700)
            d = await co.inner_text("body")
            ok(dans("Présaison · S1", d) and dans("18h30", d), "séance ouverte : phase et horaire", d[:300])
            ok(dans("ECHAUFFEMENT", d) and dans("Jeu PP", d), "activités et lignes de détail reprises du classeur", d[:600])
            ok("Touché retour ligne" in d or "touché retour ligne" in d, "les notes d'Antoine sont conservées")
            ok(dans("Lancer la séance au minuteur", d), "la séance peut être déroulée au minuteur")
            await co.screenshot(path=f"{OUT}/02_seance.png", full_page=True)

            # ---------- le minuteur enchaine les activites ----------
            await co.get_by_role("button", name="Lancer la séance au minuteur").click(); await co.wait_for_timeout(900)
            tm = await co.inner_text("body")
            ok("Activité 1 sur" in tm or await co.locator(".tm-clock").count() == 1, "minuteur lancé sur la première activité", tm[:250])
            await co.screenshot(path=f"{OUT}/03_minuteur.png", full_page=True)

            # ---------- cote joueur : rien tant qu'il n'est rattache a aucune equipe ----------
            cl = await A.new_page(); hook(cl, "joueur"); await cl.set_viewport_size({"width": 390, "height": 844})
            await cl.goto(URL + "?as=eq1"); await cl.evaluate("localStorage.removeItem('__mockdb')")
            start = (TODAY - datetime.timedelta(days=14)).isoformat()
            await mdb_set(cl, "clients/u_eq1", {"name": "Jo Joueur", "sportId": "rugby", "poste": "trois-quarts", "sex": "H", "height": 182, "weight": 88, "birthYear": 2000})
            await mdb_set(cl, "plans/u_eq1", {"programId": "vitesse", "offer": "suivi", "weeks": 12, "start": start, "equipment": "salle",
                                               "status": "active", "niveau": "sportif", "extra": [], "message": "",
                                               "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            await cl.reload(); await cl.wait_for_timeout(1400)
            j0 = await cl.inner_text("body")
            ok("séance d'équipe" not in j0.lower(), "client non rattaché : aucune séance d'équipe affichée", j0[:200])

            # ---------- rattachement par le coach ----------
            # La saison du classeur (2025-2026) est TERMINÉE : elle s'est finie le 5 juin 2026. Un joueur
            # rattaché ne doit donc rien voir aujourd'hui — et c'est le bon comportement, pas un bug. On
            # vérifie les deux : la logique de date sur des dates explicites, et l'absence d'affichage.
            await mdb_set(cl, "clients/u_eq1", {"equipe": "cmfloirac"})
            await cl.reload(); await cl.wait_for_timeout(1400)
            logique = await cl.evaluate("""() => {
              const sai = eqSaison('cmfloirac');
              const dedans = eqSeanceAt(sai, '2025-11-04');           // une date de la saison
              const prochDedans = eqProchaine(sai, '2025-11-03');     // la suivante, vue depuis la veille
              const apres = eqProchaine(sai, '2026-09-01');           // après la fin de saison
              return { rattache: !!eqOf({ equipe: 'cmfloirac' }), sansEquipe: !!eqOf({}),
                       dedans: dedans ? [dedans.d, dedans.theme] : null,
                       prochDedans: prochDedans ? prochDedans.d : null, apres };
            }""")
            ok(logique["rattache"] and not logique["sansEquipe"], "un client n'est relié à une saison que si son profil le dit", logique)
            ok(logique["dedans"] and logique["dedans"][0] == "2025-11-04", "séance retrouvée à une date de la saison", logique["dedans"])
            ok(logique["prochDedans"] == "2025-11-04", "la prochaine séance est bien la suivante, pas une passée", logique["prochDedans"])
            ok(logique["apres"] is None, "après la fin de saison : plus aucune séance à venir", logique["apres"])
            j1 = await cl.inner_text("body")
            ok("séance d'équipe" not in j1.lower(),
               "saison terminée : rien n'est affiché au joueur — correct, et pas un oubli", j1[:200])
            await cl.screenshot(path=f"{OUT}/04_joueur.png", full_page=True)

            # ---------- ce que le joueur voit est traduit ----------
            # Le contenu du classeur reste en francais (programmation d'un club francais), mais les libelles
            # de SA carte doivent etre traduits : un client anglophone ne doit pas tomber sur un ecran a moitie
            # francais. Verifie par la vraie fonction de traduction de l'application, sur la page construite.
            for lang, attendu in (("en", {"Ta séance d'équipe, ce soir": "Your team session, tonight", "Voir le détail": "See the details", "55 minutes": "55 minutes"}),
                                  ("es", {"Ta séance d'équipe, ce soir": "Tu sesión de equipo, esta noche", "Voir le détail": "Ver el detalle", "55 minutes": "55 minutos"})):
                lp = await A.new_page(); hook(lp, "langue-" + lang)
                await lp.goto(URL + f"?as=eq1&lang={lang}"); await lp.wait_for_timeout(1000)
                got = await lp.evaluate("(ks) => { const o = {}; ks.forEach((k) => { o[k] = tr(k); }); return o; }", list(attendu))
                ok(got == attendu, f"carte du joueur traduite en {lang}", got)
                await lp.close()

            # ---------- la charge du joueur n'a pas bouge ----------
            charge = await cl.evaluate("""() => Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{}')).filter((k) => k.indexOf('clients/u_eq1/logs/') === 0).length""")
            ok(charge == 0, "aucune séance n'a été créée automatiquement dans son historique", charge)

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
