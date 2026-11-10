"""Autoregulation quotidienne (34_autoreg.js) : la charge du jour s'ajuste seule selon une regle
deterministe et bornee, jamais selon le jugement libre d'une IA. Verifie les deux voies de signaux
(ressenti pour les profils entraines, repetitions faites / prescrites pour les debutants), le caractere
unidirectionnel du frein des signaux de montre (il ne peut que faire baisser), les bornes reglees par le
coach, et les jours en plus (seance repetee = jour complementaire allege, pas une 4e seance dure).
Desactive par defaut : rien ne doit changer pour un client dont le coach n'a rien active."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8783
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/autoreg"; os.makedirs(OUT, exist_ok=True)
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


async def mdb_set(page, path, patch):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = { ...(db[p] || {}), ...x }; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, patch])


async def mdb_put(page, path, doc):
    await page.evaluate("([p, x]) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); db[p] = x; localStorage.setItem('__mockdb', JSON.stringify(db)); }", [path, doc])


async def mdb_del(page, prefix):
    await page.evaluate("(pre) => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); Object.keys(db).forEach((k) => { if (k.indexOf(pre) === 0) delete db[k]; }); localStorage.setItem('__mockdb', JSON.stringify(db)); }", prefix)


async def dose_of(page, uid, sid, w=1):
    """Recalcule la dose affichee pour la seance demandee, en passant par le vrai code.
    On regarde l'exercice de force charge (type F*) : c'est celui qui porte une charge en kg."""
    return await page.evaluate("""([uid, sid, w]) => {
      const es = weekSessions(window.__PROG, window.__PLAN, w, null);
      const e = es.find((x) => x.sid === sid);
      if (!e) return null;
      const a = autoDecision(window.__DATA, window.__PLAN, window.__PROG, null, e, window.__TODAY);
      const ctx = { niveau: effNiveau(window.__PLAN, window.__DATA.profile), block: Math.ceil(w / 4),
                    e1rm: (x) => e1rmFor(x, window.__DATA), auto: a, rep: e.rep };
      const wib = ((w - 1) % 4) + 1;
      const i = Math.max(0, e.s.items.findIndex((it) => /^F/.test(it.t || "")));
      const d = doseFor(e.s.items[i], wib, ctx);
      return { dir: a.dir, pct: a.pct, why: a.why, on: a.on, voie: a.voie, kg: d.kg, sets: d.sets, lines: d.lines, ex: e.s.items[i].e };
    }""", [uid, sid, w])


async def session_main(page, sid, w=1):
    """L'exercice de force charge de la seance, et sa dose prescrite : de quoi fabriquer un historique credible."""
    return await page.evaluate("""([sid, w]) => {
      const b = blockOf(window.__PROG, w);
      const s = b.sessions.find((x) => x.id === sid);
      const i = Math.max(0, s.items.findIndex((it) => /^F/.test(it.t || "")));
      const d = doseOf(s.items[i], ((w - 1) % 4) + 1);
      return { i, e: s.items[i].e, sets: d.sets, reps: d.reps, ids: s.items.map((it) => it.e) };
    }""", [sid, w])


async def expose(page, uid):
    """Rend les donnees du client lisibles depuis la page, pour interroger la regle directement."""
    await page.evaluate("""(uid) => {
      const db = JSON.parse(localStorage.getItem('__mockdb') || '{}');
      const pick = (pre) => Object.fromEntries(Object.entries(db).filter(([k]) => k.indexOf(pre) === 0).map(([k, v]) => [k.slice(pre.length), v]));
      window.__PLAN = db['plans/' + uid];
      window.__DATA = { profile: db['clients/' + uid], logs: pick('clients/' + uid + '/logs/'),
                        checkins: pick('clients/' + uid + '/checkins/'), sante: pick('clients/' + uid + '/sante/'),
                        tests: pick('clients/' + uid + '/tests/'), ai: {}, libres: {}, nutri: {} };
      window.__PROG = persoProg(sportProg(progOf(window.__PLAN.programId, null), window.__DATA.profile), window.__DATA.profile);
      window.__TODAY = todayISO();
    }""", uid)


async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
            c = await A.new_page(); hook(c, "client")
            await c.goto(URL + "?as=ar1"); await c.evaluate("localStorage.removeItem('__mockdb')")
            start = (TODAY - datetime.timedelta(days=7)).isoformat()
            # athlete entraine (profil Haut niveau) : la voie « ressenti » s'applique
            await mdb_set(c, "clients/u_ar1", {"name": "Hugo Haut", "sportId": "rugby", "sex": "H", "height": 182, "weight": 95,
                                                "birthYear": 1996, "records": {"squat": {"kg": 140, "reps": 1}}})
            await mdb_set(c, "plans/u_ar1", {"programId": "force", "offer": "suivi", "weeks": 12, "start": start, "equipment": "salle",
                                              "status": "active", "niveau": "elite", "extra": [], "message": "",
                                              "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            await c.reload(); await c.wait_for_timeout(1300)
            await expose(c, "u_ar1")
            sid = await c.evaluate("weekSessions(window.__PROG, window.__PLAN, 1, null).filter((x) => !x.opt && !x.extra)[0].sid")
            ok(bool(sid), "programme « Force » charge, premiere seance identifiee", sid)

            main = await session_main(c, sid)
            ok(bool(main["e"]) and main["sets"], "exercice de force charge de la seance identifie, avec sa dose prescrite", main)

            async def seed_log(page, uid, sid, main, rpe, done=True, douleur=0, reps=None, days=3):
                """Historique d'une seance du meme type : c'est lui qui fixe aussi le maximum estime,
                donc la reference et les cas compares partagent exactement le meme historique."""
                await mdb_del(page, "clients/" + uid + "/logs/")
                r = reps if reps is not None else (int(str(main["reps"]).split("-")[0].strip()) if main["reps"] else 5)
                items = [{"e": e, "done": done, "sets": ([{"kg": 100, "reps": r} for _ in range(main["sets"] or 3)] if e == main["e"] else None)}
                         for e in main["ids"]]
                await mdb_put(page, "clients/" + uid + "/logs/" + sid + "-prev", {"key": sid + "-prev", "w": 1, "sid": sid,
                    "date": (TODAY - datetime.timedelta(days=days)).isoformat(), "title": "x", "items": items,
                    "rpe": rpe, "duree": 60, "load": rpe * 60, "douleur": douleur, "zone": "", "comment": ""})
                await page.reload(); await page.wait_for_timeout(1200); await expose(page, uid)
                return await dose_of(page, uid, sid)

            # ---------- desactive par defaut : aucun ajustement, et c'est la reference de charge ----------
            base = await seed_log(c, "u_ar1", sid, main, 5)   # un effort bas, qui ferait monter si c'etait actif
            ok(base["on"] is False and base["dir"] == 0, "desactive par defaut : aucun ajustement, meme avec un historique qui le justifierait", base)
            kg0 = base["kg"]
            ok(bool(kg0), "charge en kg calculee depuis le maximum estime (profil Haut niveau)", {"kg": kg0, "ex": base["ex"]})

            # ---------- le coach active l'autoregulation depuis sa fiche client ----------
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner"); await co.wait_for_timeout(900)
            await co.locator(".side-nav button", has_text="Clients").first.click(); await co.wait_for_timeout(600)
            await co.locator(".ctable tbody tr", has_text="Hugo Haut").first.click(); await co.wait_for_timeout(1100)
            await co.get_by_role("radio", name="Séances", exact=True).click(); await co.wait_for_timeout(500)
            ctxt = await co.inner_text("body")
            ok("Autorégulation de la charge" in ctxt, "coach : carte de reglage de l'autoregulation dans l'onglet Seances", ctxt[:200])
            ok("ne peuvent que faire baisser" in ctxt, "coach : il est ecrit que les signaux de montre ne peuvent que faire baisser")
            ok("pas une promesse de meilleurs résultats" in ctxt.replace("Ce n'est ", "pas ").replace("n'est pas une promesse", "pas une promesse") or "aucune étude ne montre" in ctxt,
               "coach : la promesse est annoncee comme de la faisabilite, pas de la performance", ctxt[ctxt.find("Autorégulation"):ctxt.find("Autorégulation") + 900])
            await co.locator("#ar-on").click(); await co.wait_for_timeout(300)
            await co.fill("#ar-up", "10"); await co.fill("#ar-down", "15")
            await btn(co, "Enregistrer"); await co.wait_for_timeout(500)
            pl = await co.evaluate("JSON.parse(localStorage.getItem('__mockdb'))['plans/u_ar1'].autoreg")
            ok(pl and pl.get("on") is True and pl.get("up") == 10 and pl.get("down") == 15, "coach : reglage enregistre avec ses bornes", pl)
            await co.screenshot(path=f"{OUT}/01_coach_reglage.png", full_page=True)

            # ---------- voie ressenti : premiere seance du type, rien a comparer ----------
            await c.bring_to_front(); await mdb_del(c, "clients/u_ar1/logs/")
            await c.reload(); await c.wait_for_timeout(1300); await expose(c, "u_ar1")
            d = await dose_of(c, "u_ar1", sid)
            ok(d["on"] is True and d["dir"] == 0 and "Première séance de ce type" in " ".join(d["why"]),
               "active mais aucune seance de ce type encore faite : charge du programme, et c'est dit", d["why"])
            ok(d["voie"] == "ressenti", "profil Haut niveau : voie « ressenti » (RPE) retenue", d["voie"])

            hugo = lambda **kw: seed_log(c, "u_ar1", sid, main, **kw)

            # effort bas et seance terminee : il restait de la marge -> on charge, borne a +10 %
            d = await hugo(rpe=5)
            ok(d["dir"] == 1 and d["pct"] == 10, "effort 5/10 et seance terminee : charge montee, bornee a +10 %", {"dir": d["dir"], "pct": d["pct"]})
            ok(d["kg"][0] > kg0[0], "la charge en kg affichee monte effectivement", {"avant": kg0, "apres": d["kg"]})
            ok(any("il te restait de la marge" in w for w in d["why"]), "raison dite en clair au client", d["why"])
            ok(any("Charge montée de 10 %" in l for l in d["lines"]), "la ligne de charge dit l'ajustement et le nouveau poids", d["lines"])

            # effort maximal : au-dela de la cible -> on redescend, borne a -15 %
            d = await hugo(rpe=10)
            ok(d["dir"] == -1 and d["pct"] == 15, "effort 10/10 : charge allegee, bornee a -15 %", {"dir": d["dir"], "pct": d["pct"]})
            ok(d["kg"][0] < kg0[0], "la charge en kg affichee baisse effectivement", {"avant": kg0, "apres": d["kg"]})

            # effort dans la cible : on ne touche a rien
            d = await hugo(rpe=8)
            ok(d["dir"] == 0 and any("pile dans la cible" in w for w in d["why"]), "effort 8/10 : pile dans la cible, charge du programme inchangee", d["why"])
            ok(d["kg"] == kg0, "charge identique a celle du programme", {"avant": kg0, "apres": d["kg"]})

            # seance non terminee : on redescend meme si l'effort etait modere
            d = await hugo(rpe=6, done=False)
            ok(d["dir"] == -1 and any("non terminée" in w for w in d["why"]), "seance non terminee en entier : on redescend pour la finir", d["why"])

            # douleur notee : frein, quel que soit l'effort
            d = await hugo(rpe=5, douleur=6)
            ok(d["dir"] == -1, "douleur 6/10 notee la derniere fois : frein, la charge ne monte pas malgre un effort bas", {"dir": d["dir"], "why": d["why"]})

            # ---------- frein des signaux de montre : unidirectionnel ----------
            # VFC de reference etablie sur 6 jours, puis une valeur basse aujourd'hui
            await hugo(rpe=5)  # situation qui voulait monter
            for i in range(1, 8):
                await mdb_put(c, "clients/u_ar1/sante/" + (TODAY - datetime.timedelta(days=i)).isoformat(), {"vfc": 70, "fcr": 50})
            await mdb_put(c, "clients/u_ar1/sante/" + TODAY.isoformat(), {"vfc": 58, "fcr": 50})  # 17 % sous la moyenne -> prudence
            await c.reload(); await c.wait_for_timeout(1200); await expose(c, "u_ar1")
            d = await dose_of(c, "u_ar1", sid)
            ok(d["dir"] == 0 and any("on ne charge pas aujourd'hui" in w for w in d["why"]),
               "VFC un peu basse : empeche de monter, sans faire baisser (frein, pas accelerateur)", d["why"])
            await mdb_put(c, "clients/u_ar1/sante/" + TODAY.isoformat(), {"vfc": 48, "fcr": 50})  # 31 % sous la moyenne -> leger
            await c.reload(); await c.wait_for_timeout(1200); await expose(c, "u_ar1")
            d = await dose_of(c, "u_ar1", sid)
            ok(d["dir"] == -1 and any("nettement sous ta moyenne" in w for w in d["why"]),
               "VFC nettement basse : fait baisser la charge, meme avec un effort bas la derniere fois", d["why"])
            await mdb_del(c, "clients/u_ar1/sante/")

            # ---------- voie debutant : pas de RPE dans la decision ----------
            cb = await A.new_page(); hook(cb, "debutant")
            await cb.goto(URL + "?as=ar2"); await cb.wait_for_timeout(600)
            await mdb_set(cb, "clients/u_ar2", {"name": "Dora Debut", "sex": "F", "height": 165, "weight": 70, "birthYear": 1995})
            await mdb_set(cb, "plans/u_ar2", {"programId": "force", "offer": "suivi", "weeks": 12, "start": start, "equipment": "salle",
                                               "status": "active", "niveau": "reprise", "extra": [], "message": "", "autoreg": {"on": True, "up": 10, "down": 15},
                                               "validatedAt": "2026-10-01T00:00:00.000Z", "reviewedAt": "2026-10-01T00:00:00.000Z"})
            await cb.reload(); await cb.wait_for_timeout(1300); await expose(cb, "u_ar2")
            sid2 = await cb.evaluate("weekSessions(window.__PROG, window.__PLAN, 1, null).filter((x) => !x.opt && !x.extra)[0].sid")

            main2 = await session_main(cb, sid2)
            rr = int(str(main2["reps"]).split("-")[0].strip()) if main2["reps"] else 5

            async def dora(reps_done, courb=None, assidue=False):
                """L'effort reste note a 9/10 dans tous les cas : il ne doit jamais entrer dans la decision ici.
                « assidue » ajoute les autres seances de la semaine : la regle refuse de charger quelqu'un qui
                n'a pas encore fait ses seances prevues, meme avec toutes ses repetitions."""
                if courb is not None:
                    await mdb_put(cb, "clients/u_ar2/checkins/w1", {"w": 1, "at": (TODAY - datetime.timedelta(days=2)).isoformat(), "courbatures": courb})
                else:
                    await mdb_del(cb, "clients/u_ar2/checkins/")
                d = await seed_log(cb, "u_ar2", sid2, main2, rpe=9, reps=reps_done)
                if not assidue:
                    return d
                others = await cb.evaluate("(me) => blockOf(window.__PROG, 1).sessions.map((s) => s.id).filter((x) => x !== me)", sid2)
                for k, osid in enumerate(others):
                    await mdb_put(cb, "clients/u_ar2/logs/" + osid + "-prev", {"key": osid + "-prev", "w": 1, "sid": osid,
                        "date": (TODAY - datetime.timedelta(days=4 + k)).isoformat(), "title": "x", "items": [],
                        "rpe": 7, "duree": 45, "load": 315, "douleur": 0, "zone": "", "comment": ""})
                await cb.reload(); await cb.wait_for_timeout(1200); await expose(cb, "u_ar2")
                return await dose_of(cb, "u_ar2", sid2)

            d = await dora(max(1, rr - 4))  # bien moins que les repetitions prescrites
            ok(d["voie"] == "debutant", "profil Reprise : voie « debutant » retenue, pas le RPE", d["voie"])
            ok(d["dir"] == -1 and any("répétitions sur" in w and "trop lourde" in w for w in d["why"]),
               "repetitions tres en dessous du prescrit : on redescend, sans jamais demander de coter un effort", d["why"])
            ok(not any("effort" in w.lower() and "/10" in w for w in d["why"]), "aucune mention d'un effort cote dans la decision debutant", d["why"])
            ok(any("charge plus légère" in l for l in d["lines"]), "consigne en mots simples, sans pourcentage d'un maximum inconnu", d["lines"])

            d = await dora(rr + 2, assidue=True)  # toutes les repetitions faites, et la semaine tenue
            ok(d["dir"] == 1 and any("toutes tes répétitions" in w for w in d["why"]),
               "toutes les repetitions faites et semaine tenue : on charge un peu, raison dite en mots simples", d["why"])
            ok(any("monte d'un cran" in l for l in d["lines"]), "consigne de hausse en mots simples", d["lines"])

            d = await dora(rr, courb=5)  # repetitions faites mais courbatures fortes
            ok(d["dir"] == -1 and any("Courbatures fortes" in w for w in d["why"]),
               "courbatures fortes au dernier bilan : on allege malgre les repetitions faites", d["why"])
            await cb.screenshot(path=f"{OUT}/02_debutant.png", full_page=True)

            # ---------- jours en plus : la seance repetee est un jour complementaire, pas une 4e seance dure ----------
            await c.bring_to_front()
            await mdb_del(c, "clients/u_ar1/sante/")
            # un effort dans la cible : la decision du jour est neutre, on isole l'effet du « jour en plus »
            await hugo(rpe=8)
            nat = await c.evaluate("blockOf(window.__PROG, 1).sessions.length")
            await mdb_set(c, "clients/u_ar1", {"rythme": nat + 1})
            await c.reload(); await c.wait_for_timeout(1300); await expose(c, "u_ar1")
            reps = await c.evaluate("weekSessions(window.__PROG, window.__PLAN, 1, null).filter((x) => x.rep > 1)")
            ok(len(reps) >= 1, f"rythme porte a {nat + 1} jours : au moins une seance revient en boucle", len(reps))
            dr = await c.evaluate("""() => {
              const e = weekSessions(window.__PROG, window.__PLAN, 1, null).filter((x) => x.rep > 1)[0];
              const a = autoDecision(window.__DATA, window.__PLAN, window.__PROG, null, e, window.__TODAY);
              const ctx = { niveau: effNiveau(window.__PLAN, window.__DATA.profile), block: 1, e1rm: (x) => e1rmFor(x, window.__DATA), auto: a, rep: e.rep };
              const i = Math.max(0, e.s.items.findIndex((it) => /^F/.test(it.t || "")));
              const d0 = doseFor(e.s.items[i], 1, { niveau: ctx.niveau, block: 1, e1rm: ctx.e1rm });
              const d1 = doseFor(e.s.items[i], 1, ctx);
              return { kg0: d0.kg, kg1: d1.kg, sets0: d0.sets, sets1: d1.sets, lines: d1.lines, note: repNote(e.rep) };
            }""")
            ok(dr["kg1"][0] < dr["kg0"][0] and dr["sets1"] <= dr["sets0"],
               "jour en plus : charge reduite et une serie de moins, au lieu de repeter la seance dure a l'identique", dr)
            ok("volontairement plus légère" in (dr["note"] or {}).get("txt", ""), "jour en plus : explique au client, pas un bug silencieux", dr["note"])

            # affichage dans le lecteur de seance
            await c.get_by_role("button", name="Aujourd'hui").first.click(); await c.wait_for_timeout(600)
            ptxt = await c.inner_text("body")
            ok("Charge" in ptxt or "séance" in ptxt.lower(), "page du jour accessible", ptxt[:120])
            await c.screenshot(path=f"{OUT}/03_jour.png", full_page=True)

            # ---------- contexte du coach IA : il explique, il ne decide pas ----------
            await mdb_del(c, "clients/u_ar1/logs/")
            await c.reload(); await c.wait_for_timeout(1300)
            await c.get_by_role("button", name="Coach IA").first.click(); await c.wait_for_timeout(400)
            await c.fill("#chat-in", "Pourquoi ma charge a baissé aujourd'hui ?"); await c.keyboard.press("Enter"); await c.wait_for_timeout(1500)
            prompts = await c.evaluate("window.__prompts || []")
            allp = (prompts[-1] if prompts else {}).get("all", "")
            ok("Autorégulation de la charge : activée" in allp and "+10 %" in allp and "15 %" in allp,
               "coach IA : l'autoregulation et ses bornes sont dans son contexte", allp[allp.find("Autorégulation"):allp.find("Autorégulation") + 200])
            ok("tu ne décides jamais de la charge toi-même" in allp and "Ne promets pas de meilleurs résultats" in allp,
               "coach IA : interdiction de decider la charge et de promettre de meilleurs resultats",
               allp[allp.find("Autorégulation"):allp.find("Autorégulation") + 900])

            ok(not errs, "aucune erreur dans la console", errs)
            print(f"\n{res['ok']} OK, {res['ko']} échecs")
    finally:
        srv.terminate()


if __name__ == "__main__":
    asyncio.run(run())
