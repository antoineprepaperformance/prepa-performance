"""Version Claude : langues (français, anglais, espagnol). Le client choisit sa langue ; toute l'application s'affiche dans
cette langue (inscription, commande, séances, bilan, nutrition, progrès, profil, textes juridiques avec la mention « seule la
version française fait foi ») ; le coach IA reçoit la consigne de répondre dans la langue du client ; Antoine (en français) voit
la langue du client et peut traduire ses messages dans les deux sens. Repère aussi les textes restés en français."""
import pathlib
HERE = str(pathlib.Path(__file__).resolve().parent)
import asyncio, datetime, json, os, re, subprocess, sys, time
from playwright.async_api import async_playwright
PORT = 8774
URL = f"http://localhost:{PORT}/index.html"
OUT = HERE + "/shots/langues"; os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
errs, fails, oks = [], [], []
n = [0]
TODAY = datetime.date.today()
def hook(page, tag):
    page.on("console", lambda m: errs.append(f"[{tag}] {m.type}: {m.text[:300]}") if m.type in ("error", "warning") and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errs.append(f"[{tag}] pageerror: {e}"))
def ok(c, label, info=None):
    (oks if c else fails).append(label); print(("  OK  " if c else "  FAIL ") + label + ("" if c or info is None else "  " + json.dumps(info, ensure_ascii=False, default=str)[:900]))
async def shot(page, name, full=False):
    n[0] += 1; await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{n[0]:02d}_{name}.png", full_page=full)
async def btn(page, text, exact=False):
    await page.get_by_role("button", name=text, exact=exact).first.click(); await page.wait_for_timeout(250)
async def has(page, text, timeout=4000):
    try: await page.get_by_text(text).first.wait_for(timeout=timeout); return True
    except Exception: return False
async def mdb(page, path): return await page.evaluate(f"JSON.parse(localStorage.getItem('__mockdb') || '{{}}')[{json.dumps(path)}]")

# textes visibles restés en français (hors noms propres et textes écrits par les personnes)
FR_SCAN = r"""(lang) => {
  const ACC = /[éèêàùçœâîôûë]/i;
  const FR = lang === 'en' ? /(?<![\p{L}])(le|la|les|des|du|de|ton|tes|ta|mes|mon|et|pour|avec|sur|une|un|est|dans|pas|tu|ou|au|aux|ce|cette)(?![\p{L}])/iu
                           : /(?<![\p{L}])(les|des|du|ton|tes|mon|et|pour|avec|sur|une|est|dans|ou|au|aux|cette|séance|séances|semaine|bilan)(?![\p{L}])/iu;
  const ALLOW = /^(Antoine Prépa Performance|ANTOINE PRÉPA PERFORMANCE|Bordeaux Métropole|Prépa Perf|Français|Rester en français|Inès.*|INÈS.*|Langue · Language · Idioma|.*Girondins de Bordeaux.*|Santé Antoine)$/;
  const out = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (t.length < 3 || ALLOW.test(t)) continue;
    const u = t.replace(/In[èÈ]s|IN[ÈE]S|et al\.|et seq\.|Prépa|PRÉPA|Métropole|Antoine Limousi|Mon\./g, '');
    const p = n.parentElement;
    if (!p || p.closest('[data-notr],.notr,script,style,textarea,code,pre,[aria-hidden=true]')) continue;
    if (!p.getClientRects().length) continue;
    if ((lang === 'en' && ACC.test(u)) || FR.test(u)) out.add(t.slice(0, 140));
  }
  document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach((el) => {
    if (el.closest('[data-notr]')) return;
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) {
      const v = el.getAttribute(a);
      const w = v ? v.replace(/In[èÈ]s|Mon\./g, '') : v; if (v && v.length > 2 && !ALLOW.test(v) && ((lang === 'en' && ACC.test(w)) || FR.test(w))) out.add('@' + a + ': ' + v.slice(0, 100));
    }
  });
  return [...out];
}"""
leftovers = {}
async def scan(page, lang, where):
    r = await page.evaluate(FR_SCAN, lang)
    for t in r: leftovers.setdefault(lang, {}).setdefault(t, where)
    return r

async def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=HERE + "/test", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            A = await b.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
            co = await A.new_page(); hook(co, "coach")
            await co.goto(URL + "?as=owner&lang=fr"); await co.evaluate("localStorage.removeItem('__mockdb')"); await co.reload(); await co.wait_for_timeout(800)
            # codes offerts pour les deux clients (Suivi : messagerie et réponse aux bilans)
            await btn(co, "Codes & essais", exact=True)
            for code in ["LANGUE-EN-1234", "LANGUE-ES-1234"]:
                await co.get_by_role("radio", name="Offert").click(); await co.get_by_role("radio", name="Suivi", exact=True).click(); await co.get_by_role("radio", name="1 mois").click()
                await co.fill("#cd-code", code); await btn(co, "Créer le code"); await co.wait_for_timeout(300)

            for lang, cid, code in [("en", "e1", "LANGUE-EN-1234"), ("es", "s1", "LANGUE-ES-1234")]:
                T = {"en": {"start": "Start signing up", "cont": "Continue", "lvl": "Recreational or local", "exp": "6 months to 2 years", "prog": "Fitness & health",
                            "no": "No", "toaccess": "Continue to my access", "plan": "Follow-up", "apply": "Apply", "send": "Send my code to Antoine", "today": "Today",
                            "programme": "Programme", "bilan": "Check-in", "nutri": "Nutrition", "progres": "Progress", "profil": "My profile", "female": "Female",
                            "keep": "Maintain my weight", "savegoal": "Save my goal", "cgv": "Terms of sale", "note": "only the French version is legally binding",
                            "ia": "AI Coach", "langue": "anglais", "write": "Write to Antoine", "first": "Write your first message to Antoine"},
                     "es": {"start": "Empezar mi registro", "cont": "Continuar", "lvl": "Ocio o local", "exp": "De 6 meses a 2 años", "prog": "Puesta en forma y salud",
                            "no": "No", "toaccess": "Continuar hacia mi acceso", "plan": "Seguimiento", "apply": "Aplicar", "send": "Enviar mi código a Antoine", "today": "Hoy",
                            "programme": "Programa", "bilan": "Balance", "nutri": "Nutrición", "progres": "Progreso", "profil": "Mi perfil", "female": "Mujer",
                            "keep": "Mantener mi peso", "savegoal": "Guardar mi objetivo", "cgv": "Condiciones de venta", "note": "solo la versión francesa tiene valor jurídico",
                            "ia": "Coach IA", "langue": "espagnol", "write": "Escribir a Antoine", "first": "Escribe tu primer mensaje a Antoine"}}[lang]
                c = await A.new_page(); hook(c, "client-" + lang); await c.set_viewport_size({"width": 390, "height": 844})
                await c.goto(URL + f"?as={cid}&lang={lang}"); await c.wait_for_timeout(900)
                ok(await c.evaluate("document.documentElement.lang") == lang, f"[{lang}] langue de la page")
                await shot(c, f"{lang}_accueil"); await scan(c, lang, "accueil")
                await btn(c, T["start"])
                await scan(c, lang, "inscription 1")
                await c.fill("#ob-name", "Inès Exemple"); await c.fill("#ob-by", "1996"); await c.fill("#ob-h", "168"); await c.fill("#ob-w", "61"); await c.fill("#ob-sport", "Fitness")
                await shot(c, f"{lang}_inscription", full=True)
                await btn(c, T["cont"])
                await scan(c, lang, "inscription niveau")
                await c.get_by_role("radio", name=T["lvl"], exact=True).click(); await c.get_by_role("radio", name=T["exp"], exact=True).click()
                await btn(c, T["cont"]); await scan(c, lang, "inscription objectif")
                await c.locator("button.pcard", has_text=T["prog"]).click(); await btn(c, T["cont"])
                await scan(c, lang, "inscription santé")
                for i in range(await c.locator(".yn").count()):
                    await c.locator(".yn").nth(i).get_by_role("radio", name=T["no"], exact=True).click()
                await btn(c, T["cont"]); await scan(c, lang, "inscription validation")
                await c.check("#ob-consent"); await btn(c, T["toaccess"]); await c.wait_for_timeout(700)
                await c.get_by_role("radio", name=T["plan"], exact=True).first.click(); await c.wait_for_timeout(300)
                await scan(c, lang, "commande"); await shot(c, f"{lang}_commande", full=True)
                await c.fill("#pu-code", code); await btn(c, T["apply"], exact=True); await c.wait_for_timeout(300)
                await c.fill("#pu-start", TODAY.isoformat()); await c.check("#pu-cgv"); await btn(c, T["send"]); await c.wait_for_timeout(500)
                await co.bring_to_front(); await co.goto(URL + "?as=owner&lang=fr"); await co.wait_for_timeout(1500)
                await c.bring_to_front(); await c.goto(URL + f"?as={cid}&lang={lang}"); await c.wait_for_timeout(1300)
                plan = await mdb(c, f"plans/u_{cid}") or {}
                ok(plan.get("offer") == "suivi" and plan.get("status") == "active", f"[{lang}] inscription et commande dans la langue choisie : accès actif", plan)
                prof = await mdb(c, f"clients/u_{cid}") or {}
                ok(prof.get("lang") == lang, f"[{lang}] langue enregistrée dans le profil (Antoine la voit)", prof.get("lang"))
                await scan(c, lang, "aujourd'hui"); await shot(c, f"{lang}_aujourdhui", full=True)
                for tab, name in [("programme", "programme"), ("bilan", "bilan"), ("progres", "progrès")]:
                    await c.locator("nav.tabbar button", has_text=T[tab]).first.click(); await c.wait_for_timeout(500)
                    await scan(c, lang, name); await shot(c, f"{lang}_{name}", full=True)
                await c.locator("nav.tabbar button", has_text=T["nutri"]).first.click(); await c.wait_for_timeout(400)
                await scan(c, lang, "nutrition objectif")
                await c.get_by_role("radio", name=T["female"]).click(); await c.get_by_role("radio", name=T["keep"]).click()
                await btn(c, T["savegoal"]); await c.wait_for_timeout(600)
                await scan(c, lang, "nutrition"); await shot(c, f"{lang}_nutrition", full=True)
                # séance
                await c.locator("nav.tabbar button", has_text=T["today"]).first.click(); await c.wait_for_timeout(400)
                nx = c.locator("button.next")
                if await nx.count():
                    await nx.first.click(); await c.wait_for_timeout(700)
                    await scan(c, lang, "séance"); await shot(c, f"{lang}_seance", full=True)
                    await c.locator("header.p-top button.back").first.click(); await c.wait_for_timeout(400)
                # coach IA : consigne de langue envoyée au modèle
                await c.get_by_role("button", name=T["ia"]).first.click(); await c.wait_for_timeout(500)
                await scan(c, lang, "coach IA")
                await c.fill("#chat-in", "Hello" if lang == "en" else "Hola"); await c.keyboard.press("Enter"); await c.wait_for_timeout(900)
                pr = await c.evaluate("(window.__prompts || []).slice(-1)[0]")
                ok(pr and ("le client utilise l'application en " + T["langue"]) in pr["all"] and "Écris tout ce que le client lira uniquement en " + T["langue"] in pr["all"],
                   f"[{lang}] le coach IA reçoit la consigne de répondre en {T['langue']}", (pr or {}).get("all", "")[:300])
                await shot(c, f"{lang}_coach_ia")
                await c.goto(URL + f"?as={cid}&lang={lang}"); await c.wait_for_timeout(1000)
                # profil et textes juridiques
                await c.get_by_role("button", name=T["profil"]).first.click(); await c.wait_for_timeout(500)
                await scan(c, lang, "profil"); await shot(c, f"{lang}_profil", full=True)
                await c.get_by_role("button", name=T["cgv"]).first.click(); await c.wait_for_timeout(500)
                ok(await has(c, T["note"]), f"[{lang}] textes juridiques : rappel que seule la version française fait foi")
                await scan(c, lang, "CGV"); await shot(c, f"{lang}_cgv")
                await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
                # message au coach
                await c.get_by_role("button", name=T["write"]).first.click(); await c.wait_for_timeout(400)
                ok(await has(c, T["first"]), f"[{lang}] messagerie dans la langue du client")
                await c.fill("#msg-in-client", "My knee hurts a bit after squats." if lang == "en" else "Me duele un poco la rodilla después de las sentadillas.")
                await c.keyboard.press("Enter"); await c.wait_for_timeout(600)
                await scan(c, lang, "messagerie")
                await c.close()

            # ---------- Antoine : langue du client, traduction des messages ----------
            await co.bring_to_front(); await co.goto(URL + "?as=owner&lang=fr"); await co.wait_for_timeout(1200)
            ok(await co.evaluate("document.documentElement.lang") == "fr", "espace coach en français")
            await btn(co, "Clients", exact=True); await co.wait_for_timeout(400)
            await co.get_by_text("Inès Exemple").first.click(); await co.wait_for_timeout(800)
            ok(await has(co, "Langue : anglais") or await has(co, "Langue : espagnol"), "Antoine voit la langue du client")
            await btn(co, "Messages", exact=False); await co.wait_for_timeout(500)
            await co.get_by_text("My knee hurts a bit after squats.").first.click(); await co.wait_for_timeout(800)
            ok(await has(co, "Langue : anglais"), "fiche du client anglophone : langue affichée")
            await shot(co, "coach_messages")
            tl = co.get_by_role("button", name="Traduire en français")
            ok(await tl.count() >= 1, "bouton « Traduire en français » sous le message du client étranger")
            if await tl.count():
                await tl.first.click(); await co.wait_for_timeout(500)
                ok(await has(co, "Traduction (IA) :"), "traduction affichée sous le message")
            await co.fill("#msg-in-coach", "Super semaine, continue comme ça.")
            ts = co.locator("#msg-trad")
            ok(await ts.count() == 1, "bouton « Traduire en … avant d'envoyer » dans la réponse d'Antoine")
            if await ts.count():
                await ts.click(); await co.wait_for_timeout(500)
                v = await co.input_value("#msg-in-coach")
                pr = await co.evaluate("(window.__prompts || []).slice(-1)[0]")
                ok(v in ("Great week, keep it up.", "Gran semana, sigue así.") and "Tâche : traduction" in pr["all"], "le texte d'Antoine est traduit dans la langue du client avant l'envoi", v)
                ok(await has(co, "Ton texte d'origine"), "le texte d'origine reste visible pour Antoine")
            await shot(co, "coach_traduction")
            await b.close()
    finally:
        srv.terminate()
    print("\nTextes restés en français :")
    for lang, d in leftovers.items():
        print(f"  [{lang}] {len(d)}")
        for t, w in list(d.items())[:120]: print(f"     {w:>22} | {t}")
    for lang in ("en", "es"):
        ok(len(leftovers.get(lang, {})) == 0, f"[{lang}] aucun texte resté en français dans les écrans parcourus", len(leftovers.get(lang, {})))
    print(f"\n{len(oks)} OK, {len(fails)} FAIL")
    real = [e for e in errs if "pageerror" in e or ("error" in e and "React" not in e and "favicon" not in e)]
    if real: print("Erreurs console :", *real[:15], sep="\n  ")
    if fails or real: sys.exit(1)
asyncio.run(run())
