"""Tests unitaires : profils, cohérence, dosage, forme du jour, affûtage, commandes, codes, cycles (fonctions de l'application exécutées dans le navigateur)."""
import asyncio, json, pathlib, subprocess, sys, time
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
JS = r"""
(() => {
  const R = [];
  const ok = (c, n, info) => R.push([!!c, n, info === undefined ? "" : JSON.stringify(info)]);
  const rn = (c, x, a) => recommendNiveau({ compet: c, xp: x, freq: 3 }, a === undefined ? 30 : a, false).id;
  ok(rn(0, 0) === "reprise", "profil : débutant sans compétition → Reprise");
  ok(rn(1, 2) === "sportif", "profil : loisir, 1 an de muscu → Sportif");
  ok(rn(2, 1) === "sportif", "profil : régional mais < 6 mois de muscu → Sportif");
  ok(rn(3, 3) === "perf", "profil : national, > 2 ans → Performance");
  ok(rn(4, 3) === "elite", "profil : élite, > 2 ans → Haut niveau");
  ok(rn(4, 1) === "perf", "profil : élite mais muscu récente → Performance");
  ok(rn(4, 3, 15) === "sportif", "profil : 15 ans plafonné à Sportif", rn(4, 3, 15));
  ok(rn(4, 3, 17) === "perf", "profil : 17 ans plafonné à Performance");
  ok(effNiveau({ niveau: "elite", medicalHold: true }) === "reprise", "avis médical en attente → séances en Reprise");
  ok(sportCat("Rugby à XV") === "collectif" && sportCat("Handball") === "lancer" && sportCat("trail") === "course" && sportCat("Bobsleigh") === "sprint" && sportCat("aucun") === "aucun" && sportCat("Haltérophilie") === "force", "reconnaissance du sport");
  const has = (arr, t, re) => arr.some((c) => c.t === t && re.test(c.n));
  ok(has(assessPlan({ programId: "forme", niveau: "perf", ans: { freq: 3 }, sport: "rugby", age: 25 }), "warn", /peu exigeant/), "cohérence : Performance + Remise en forme → alerte");
  ok(has(assessPlan({ programId: "force", niveau: "reprise", ans: { freq: 3, xp: 0 }, sport: "", age: 25 }), "warn", /technique/), "cohérence : Reprise + Force → alerte");
  ok(has(assessPlan({ programId: "retour", niveau: "sportif", ans: {}, sport: "foot", age: 25, prereqOk: false }), "bad", /critères/), "cohérence : retour course sans critères → bloquant");
  ok(has(assessPlan({ programId: "masse", niveau: "sportif", ans: {}, sport: "", age: 25, equipment: "maison" }), "bad", /salle/), "cohérence : programme salle choisi à la maison → bloquant");
  ok(has(assessPlan({ programId: "prepa", niveau: "perf", ans: {}, sport: "rugby", age: 25 }), "ok", /plus adapté/), "cohérence : rugby + Prépa sports collectifs → le plus adapté");
  const h12 = { e: "squat_goblet", t: "H12" };
  let d = doseFor(h12, 1, { niveau: "reprise" });
  ok(d.sets === 2 && /RIR 4/.test(d.text), "Reprise : 1 série de moins et RIR + 1", d.text);
  d = doseFor(h12, 1, { niveau: "sportif" });
  ok(d.sets === 3 && /RIR 3/.test(d.text) && !d.lines.length, "Sportif : programme d'origine", d.text);
  const f5 = { e: "squat_barre", t: "F5" };
  d = doseFor(f5, 2, { niveau: "perf", block: 2, e1rm: () => ({ v: 100, date: "2026-10-01", src: "test" }) });
  ok(d.sets === 4 && d.pct[0] === 83 && d.kg[0] === 82.5 && /3 min/.test(d.text) && d.lines.some((l) => /Tempo 2-0-X-0/.test(l)), "Performance : 83 % de 100 kg = 82,5 kg, tempo et récup exacts", d.lines);
  d = doseFor(f5, 2, { niveau: "elite", block: 2, e1rm: () => null });
  ok(d.sets === 5 && d.lines.some((l) => /15 %/.test(l)), "Haut niveau : +1 série en semaine 2 et seuil de perte de vitesse", d.lines);
  d = doseFor({ e: "squat_barre", t: "F3" }, 3, { niveau: "elite", block: 3 });
  ok(d.lines.some((l) => /grappes/.test(l)), "Haut niveau : séries en grappes sur la force maximale");
  d = doseFor({ e: "squat_barre", t: "F3" }, 3, { niveau: "elite", block: 3, ready: { lvl: "leger" } });
  ok(d.sets === 5 && /RIR 3/.test(d.text), "forme basse : une série de moins et RIR + 2", d.text);
  d = doseFor({ e: "squat_barre", t: "F5" }, 3, { niveau: "perf", block: 1, taper: { f: 0.5, n: "" } });
  ok(d.sets === 3, "affûtage semaine de compétition : séries divisées par deux", d.sets);
  d = doseFor({ e: "epaule_suspension", t: "P" }, 2, { niveau: "perf", block: 2, e1rm: () => ({ v: 64, date: "2026-10-01", src: "séance" }) });
  ok(!d.kg && d.pct, "mouvement explosif : pas de kg tiré des séances (seulement d'un test)");
  d = doseFor({ e: "fractionne_court", w: ["8 × 400 m à 95 % VMA / 1 min 30 trot", "", "", ""] }, 1, { niveau: "perf", vma: 16 });
  ok(d.lines.some((l) => /15,2 km\/h/.test(l) && /3'57"/.test(l) && /1 min 35 s par 400 m/.test(l)), "course : allure et temps au 400 m depuis la VMA", d.lines);
  d = doseFor({ e: "footing_ef", w: ["30 min", "", "", ""] }, 1, { niveau: "elite", vma: 15 });
  ok(d.lines.some((l) => /Endurance fondamentale/.test(l)), "course : allure d'endurance fondamentale");
  d = doseFor({ e: "sprint_30", t: "S", r: "30 m" }, 2, { niveau: "perf" });
  ok(d.lines.some((l) => /150 m de sprint/.test(l)) && /1 min par tranche/.test(d.text), "sprint : volume total et récupération complète", d);
  const rd = (v) => readinessOf({ sommeil: v, fatigue: v, courbatures: v, stress: v, moral: v }, { tests: { t0: { at: "2026-01-01", values: { cmj: 40 } } } });
  ok(rd(4).lvl === "ok" && rd(3).lvl === "prudence" && rd(2).lvl === "leger", "contrôle de forme : feu vert / prudence / allégée");
  ok(readinessOf({ sommeil: 5, fatigue: 5, courbatures: 5, stress: 5, moral: 5, cmj: "34" }, { tests: { t0: { at: "2026-01-01", values: { cmj: 40 } } } }).lvl === "leger", "contrôle de forme : détente à 85 % → séance allégée");
  const pl = { start: "2026-01-05", weeks: 12, compDate: "2026-01-21" };
  ok(taperFor(pl, 3) && taperFor(pl, 3).f === 0.5 && taperFor(pl, 2) && taperFor(pl, 2).f === 0.6 && !taperFor(pl, 1) && !taperFor(pl, 4), "affûtage : semaine d'avant et semaine de compétition seulement");
  ok(preventionFor({ w: 1, sid: "A", s: { items: [] } }, PB.prepa, {}, "perf", "rugby").map((x) => x.e).join() === "nordic,copenhague", "prévention rugby : Nordic + Copenhague");
  ok(preventionFor({ w: 1, sid: "A", s: { items: [{ e: "nordic" }] } }, PB.prepa, {}, "perf", "rugby").map((x) => x.e).join() === "copenhague", "prévention : pas de doublon avec la séance");
  ok(preventionFor({ w: 1, sid: "A", s: { items: [] } }, PB.prepa, {}, "perf", "handball").map((x) => x.e).join() === "rotateurs,y_t_w", "prévention handball : épaules");
  ok(!preventionFor({ w: 1, sid: "A", s: { items: [] } }, PB.prepa, {}, "sportif", "rugby").length, "prévention : réservée aux profils Performance et Haut niveau");
  const pe = { programId: "vitesse", niveau: "elite", start: "2026-01-05", weeks: 12, status: "active" };
  ok(weekSessions(PB.vitesse, pe, 1, {}).some((e) => e.opt && e.sid === "D") && plannedCount(PB.vitesse, pe, 1, {}) === 3, "Haut niveau : séance D optionnelle, non comptée dans la régularité");
  ok(!weekSessions(PB.vitesse, { ...pe, medicalHold: true }, 1, {}).some((e) => e.opt), "pas de séance D en attendant l'avis médical");
  /* commandes */
  const o = { id: "o1", offer: "suivi", weeks: 4, programId: "vitesse", niveau: "perf", start: "2026-11-02", equipment: "salle" };
  let np = planFromOrder(null, o, { screeningFlag: true }, { kind: "code", id: "ESSAI-ABC" });
  ok(np.cycle === 1 && np.weeks === 4 && np.status === "active" && np.medicalHold === true && np.source.orderId === "o1" && np.grantWeeks === 4, "commande → plan (cycle 1, avis médical en attente)", np);
  const prev = { programId: "vitesse", offer: "suivi", weeks: 4, start: addDays(todayISO(), -20), status: "active", niveau: "perf", cycle: 1 };
  np = planFromOrder(prev, { ...o, ext: true, weeks: 4 }, {}, { kind: "paiement", id: "cs_1" });
  ok(np.weeks === 8 && np.start === prev.start && np.cycle === 1, "prolongation pendant l'accès : semaines ajoutées à la suite", np);
  const old = { ...prev, start: addDays(todayISO(), -60) };
  np = planFromOrder(old, { ...o, ext: true, weeks: 4, contStart: todayISO() }, {}, { kind: "paiement", id: "cs_2" });
  ok(np.weeks === 8 && np.start === addDays(todayISO(), -28) && np.start > old.start, "prolongation après une pause : la semaine 5 commence à la date choisie", np.start);
  np = planFromOrder(old, { ...o, programId: "force" }, {}, { kind: "paiement", id: "cs_3" });
  ok(np.cycle === 2 && np.weeks === 4 && np.programId === "force", "nouveau programme : nouveau cycle", np);
  ok(!canExtend(prev, "vitesse", 12) && canExtend(prev, "vitesse", 8), "prolongation limitée à 12 semaines");
  const ord = { id: "o9", at: "2026-10-01T10:00:00Z", price: 99, weeks: 4, kind: "paiement", status: "active" };
  ok(refundFor(ord, { start: "2026-10-01", weeks: 4, source: { orderId: "o9" } }, "2026-10-07T12:00:00Z") === 74.25, "rétractation au 7e jour : 74,25 € remboursés sur 99 €", refundFor(ord, { start: "2026-10-01", weeks: 4, source: { orderId: "o9" } }, "2026-10-07T12:00:00Z"));
  ok(refundFor(ord, { start: "2026-10-20", weeks: 4, source: { orderId: "o9" } }, "2026-10-07T12:00:00Z") === 99, "rétractation avant le début : remboursement total");
  ok(withdrawable({ ...ord, at: addDays(todayISO(), -14) + "T09:00:00Z" }) && !withdrawable({ ...ord, at: addDays(todayISO(), -15) + "T09:00:00Z" }) && !withdrawable({ ...ord, kind: "code", at: nowISO() }), "rétractation possible 14 jours, pas pour un code offert");
  ok(codeState({ active: true, uses: 0, max: 1, usedBy: {} }, "u1").ok, "code valide");
  ok(!codeState({ active: true, uses: 1, max: 1, usedBy: {} }, "u1").ok && !codeState({ active: false, uses: 0, max: 1 }, "u1").ok && !codeState({ active: true, uses: 0, max: 5, usedBy: { u1: "x" } }, "u1").ok && !codeState({ active: true, uses: 0, max: 1, expiresMs: Date.now() - 1000 }, "u1").ok, "code épuisé, désactivé, déjà utilisé ou expiré : refusé");
  ok(/^ESSAI-[A-HJ-NP-Z2-9]{7}$/.test(genCode("ESSAI")) && normCode(" essai-ab c ") === "ESSAI-ABC", "génération et saisie des codes");
  const u = stripeUrl("https://buy.stripe.com/test_123", "UID42", { offer: "suivi", weeks: 8, id: "oab12" }, "a@b.fr");
  ok(u === "https://buy.stripe.com/test_123?client_reference_id=UID42__suivi__8__oab12&prefilled_email=a%40b.fr", "lien Stripe avec référence de commande", u);
  /* cycles */
  const sc = scoped({ plan: { cycle: 2 }, logs: { "w1-A": { v: 1 }, "c2_w1-A": { v: 2 } }, checkins: { w1: 1, c2_w1: 2 }, tests: { t0: 1, c2_t0: 2 }, replies: { w1: 1 } });
  ok(sc.logs["w1-A"].v === 2 && Object.keys(sc.logs).length === 1 && sc.checkins.w1 === 2 && sc.tests.t0 === 2 && !sc.replies.w1, "nouveau cycle : semaine 1 vierge, historique conservé à part");
  const s1 = scoped({ plan: { cycle: 1 }, logs: { "w1-A": { v: 1 }, "c2_w1-A": { v: 2 } } });
  ok(s1.logs["w1-A"].v === 1 && Object.keys(s1.logs).length === 1, "cycle 1 : données d'origine");
  ok(legalMissing({ legal: { siret: "1", adresse: "a", email: "e", telephone: "t", cartePro: "c", mediateur: "m", assurance: "x" } }).length === 0 && legalMissing({}).length >= 5, "contrôle des informations légales");
  return R;
})()
"""
async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8767"], cwd=str(HERE / "test"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("http://localhost:8767/index.html?as=u_unit"); await pg.wait_for_timeout(800)
            res = await pg.evaluate(JS)
            await b.close()
    finally:
        srv.terminate()
    nf = 0
    for good, name, info in res:
        print(("  OK  " if good else "  FAIL ") + name + ("" if good else "  " + info[:400]))
        nf += 0 if good else 1
    print(f"{len(res) - nf} OK, {nf} échecs"); print("\n".join(errs) or "")
asyncio.run(run())
