// Tests de la boîte aux lettres santé du relais : lien personnel, envoi du Raccourci iPhone, envoi Health Connect Webhook (Android),
// doublons, limites, récupération par l'application, révocation.
import worker from "./worker.js";
const kv = { m: {}, async get(k) { return this.m[k] ?? null; }, async put(k, v) { this.m[k] = String(v); }, async delete(k) { delete this.m[k]; } };
const env = { FIREBASE_API_KEY: "AIza-test", FIREBASE_PROJECT_ID: "prepa-test", SITE_ORIGIN: "https://antoine.github.io", QUOTA: kv, SANTE_ENVOIS_PAR_JOUR: "6" };
const TOK = { julie: "jeton-valide-de-julie-0123456789", marc: "jeton-valide-de-marc-01234567890" };
const UID = { [TOK.julie]: "uidJulie123", [TOK.marc]: "uidMarc456", "jeton-du-coach-antoine-0123456789": "uidCoach789" };
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).includes("accounts:lookup")) {
    const t = JSON.parse(opts.body).idToken;
    return UID[t] ? new Response(JSON.stringify({ users: [{ localId: UID[t] }] }), { status: 200 }) : new Response("{}", { status: 400 });
  }
  if (String(url).includes("/documents/codes?pageSize=1")) return ((opts.headers || {}).authorization || "") === "Bearer jeton-du-coach-antoine-0123456789" ? new Response("{}", { status: 200 }) : new Response("{}", { status: 403 });
  return new Response("not found", { status: 404 });
};
let pass = 0, fail = 0; const ok = (c, n) => { (c ? pass++ : fail++); console.log((c ? "  OK  " : "  FAIL ") + n); };
const R = (path, { method = "GET", tok, body, headers = {} } = {}, e = env) => worker.fetch(new Request("https://relais.example/sante/" + path, { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}), ...headers } }), e);
const today = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

let r = await R("etat"); let j = await r.json();
ok(r.status === 200 && j.sante === true && r.headers.get("access-control-allow-origin") === "https://antoine.github.io", "état : stockage KV présent, CORS limité au site");
r = await R("etat", {}, { ...env, QUOTA: undefined }); j = await r.json(); ok(j.sante === false, "état : sans KV, la fonction est signalée absente");
r = await R("cle", { method: "POST", tok: TOK.julie }, { ...env, QUOTA: undefined }); ok(r.status === 503, "sans KV : 503");
r = await R("cle", { method: "POST" }); ok(r.status === 401, "lien personnel : connexion obligatoire");
r = await R("cle", { method: "POST", tok: TOK.julie }); j = await r.json();
const cle = j.cle;
ok(r.status === 200 && /^[A-Za-z0-9]{24}$/.test(cle) && j.url === "https://relais.example/sante/in?k=" + cle && kv.m["sk:" + cle] === "uidJulie123", "lien personnel créé (clé secrète de 24 caractères)");
r = await R("cle", { method: "POST", tok: TOK.julie }); j = await r.json(); ok(j.cle === cle, "même lien si on le redemande");

// envoi du Raccourci iPhone : valeurs écrites avec leurs unités, listes, sommeil en minutes
r = await R("in?k=" + cle, { method: "POST", body: { pas: "8 450 pas", kcal: ["320 kcal", "205,5 kcal"], sommeil: "445", fcr: "52 bpm", vfc: 61.4, poids: "72,4 kg", inconnu: 3 } });
j = await r.json(); ok(r.status === 200 && j.jours[0] === today, "Raccourci iPhone : envoi accepté pour aujourd'hui");
let box = JSON.parse(kv.m["sin:uidJulie123"]); let d = box.jours[today];
ok(d.pas === 8450 && d.kcal === 526 && Math.abs(d.sommeil - 7.42) < 0.01 && d.fcr === 52 && d.vfc === 61.4 && d.poids === 72.4 && d.src === "iphone", "valeurs lues malgré les unités (pas, calories additionnées, sommeil en minutes → heures)");
// un deuxième envoi du même jour moins de 15 minutes après : rien n'est réécrit (écritures gratuites limitées)
r = await R("in?k=" + cle, { method: "POST", body: { pas: 9000 } }); j = await r.json();
ok(r.status === 200 && j.note === "deja_recu" && JSON.parse(kv.m["sin:uidJulie123"]).jours[today].pas === 8450, "Raccourci renvoyé moins de 15 min après : accepté sans écriture");
box = JSON.parse(kv.m["sin:uidJulie123"]); box.jours[today].t = new Date(Date.now() - 20 * 60000).toISOString(); kv.m["sin:uidJulie123"] = JSON.stringify(box);
r = await R("in?k=" + cle, { method: "POST", body: { pas: "9 120" } }); j = await r.json();
ok(r.status === 200 && j.jours[0] === today && JSON.parse(kv.m["sin:uidJulie123"]).jours[today].pas === 9120 && JSON.parse(kv.m["sin:uidJulie123"]).jours[today].fcr === 52, "20 min plus tard : nouveaux totaux du jour enregistrés, le reste gardé");
r = await R("in?k=" + cle, { method: "POST", body: { d: "2026-10-20", pas: 250000, fcr: 10, kcal: 400, energie_repos: "1 600" } });
box = JSON.parse(kv.m["sin:uidJulie123"]); d = box.jours["2026-10-20"];
ok(d && d.pas === undefined && d.fcr === undefined && d.kcal === 400 && d.kcalTot === 2000, "valeurs impossibles écartées ; énergie au repos + active = dépense totale ; date choisie respectée");
r = await R("in?k=" + "Z".repeat(24), { method: "POST", body: { pas: 100 } }); ok(r.status === 401, "clé inconnue refusée");
r = await R("in", { method: "POST", body: { pas: 100 } }); ok(r.status === 401, "sans clé : refusé");
r = await R("in?k=" + cle, { method: "POST", body: "pas du json" }); ok(r.status === 400, "JSON invalide refusé");
r = await R("in?k=" + cle, { method: "POST", body: { rien: 1 } }); j = await r.json(); ok(r.status === 200 && j.jours.length === 0, "rien de reconnu : accepté sans rien écrire");

// Health Connect Webhook (Android) : marc, heures locales et UTC, doublons et renvois
r = await R("cle", { method: "POST", tok: TOK.marc }); const cle2 = (await r.json()).cle;
const hc1 = { timestamp: "2026-10-23T21:00:00+02:00", app_version: "1.9.30", timezone: "Europe/Paris",
  steps: [{ count: 3000, start_time: "2026-10-23T08:00:00+02:00", end_time: "2026-10-23T09:00:00+02:00", metadata: { id: "s1" } }, { count: 4500, start_time: "2026-10-23T17:00:00+02:00", end_time: "2026-10-23T18:00:00+02:00", metadata: { id: "s2" } }],
  active_calories: [{ calories: 210.4, start_time: "2026-10-23T08:00:00+02:00", end_time: "2026-10-23T09:00:00+02:00" }, { calories: 300, start_time: "2026-10-23T17:00:00+02:00", end_time: "2026-10-23T18:00:00+02:00" }],
  sleep: [{ session_end_time: "2026-10-23T07:05:00+02:00", duration_seconds: 28800, stages: [{ stage: "STAGE_TYPE_AWAKE", duration_seconds: 1800 }, { stage: "STAGE_TYPE_DEEP", duration_seconds: 5400 }] }],
  resting_heart_rate: [{ bpm: 55, time: "2026-10-23T06:00:00+02:00" }, { bpm: 53, time: "2026-10-23T07:00:00+02:00" }],
  heart_rate_variability: [{ rmssd_millis: 60, time: "2026-10-23T03:00:00+02:00" }, { time: "2026-10-23T04:00:00+02:00", avg: 70, min: 60, max: 80, rmssd_millis: 70 }],
  weight: [{ kilograms: 81.3, time: "2026-10-23T07:10:00+02:00" }] };
r = await R("in?k=" + cle2, { method: "POST", body: hc1 }); j = await r.json();
box = JSON.parse(kv.m["sin:uidMarc456"]); d = box.jours["2026-10-23"];
ok(r.status === 200 && j.jours.includes("2026-10-23") && d.pas === 7500 && d.kcal === 510 && d.sommeil === 7.5 && d.fcr === 53 && d.vfc === 65 && d.poids === 81.3 && d.src === "android", "Health Connect : pas et calories additionnés, sommeil sans les éveils, dernière FC au repos, VFC moyenne, poids");
// renvoi du même enregistrement modifié + un nouveau : pas de double comptage
const hc2 = { timestamp: "2026-10-23T22:30:00+02:00", app_version: "1.9.30", steps: [{ count: 4700, start_time: "2026-10-23T17:00:00+02:00", end_time: "2026-10-23T18:00:00+02:00", metadata: { id: "s2" } }, { count: 1000, start_time: "2026-10-23T21:00:00+02:00", end_time: "2026-10-23T22:00:00+02:00", metadata: { id: "s3" } }] };
r = await R("in?k=" + cle2, { method: "POST", body: hc2 });
box = JSON.parse(kv.m["sin:uidMarc456"]); d = box.jours["2026-10-23"];
ok(d.pas === 8700 && d.kcal === 510, "renvoi d'un enregistrement modifié : remplacé, pas compté deux fois");
// heures en UTC : rangées au jour de Paris (23 h 30 UTC = le lendemain en France)
r = await R("in?k=" + cle2, { method: "POST", body: { timestamp: "x", total_calories: [{ calories: 2650, start_time: "2026-10-22T22:30:00Z", end_time: "2026-10-23T22:00:00Z" }] } });
box = JSON.parse(kv.m["sin:uidMarc456"]); ok(box.jours["2026-10-23"].kcalTot === 2650, "heure UTC rangée au bon jour (Paris)");
// limite d'envois par jour
for (let i = 0; i < 4; i++) r = await R("in?k=" + cle2, { method: "POST", body: { d: "2026-10-0" + (i + 1), pas: 1000 + i } });
r = await R("in?k=" + cle2, { method: "POST", body: { d: "2026-10-09", pas: 99 } }); ok(r.status === 429 && (await r.json()).code === "limite_jour", "trop d'envois dans la journée : refus (rien n'est perdu côté Android, renvoyé au suivant)");
// 14 jours gardés au plus
for (let i = 0; i < 16; i++) { kv.m["sin:uidJulie123"] = JSON.stringify({ ...JSON.parse(kv.m["sin:uidJulie123"]), n: { d: "x", c: 0 } }); await R("in?k=" + cle, { method: "POST", body: { d: "2026-09-" + String(i + 1).padStart(2, "0"), pas: 5000 + i } }); }
box = JSON.parse(kv.m["sin:uidJulie123"]); ok(Object.keys(box.jours).length === 14 && !box.jours["2026-09-01"], "14 derniers jours gardés au plus");

// récupération par l'application
r = await R("out"); ok(r.status === 401, "récupération : connexion obligatoire");
r = await R("out", { tok: TOK.marc }); j = await r.json();
ok(r.status === 200 && j.jours["2026-10-23"].pas === 8700 && j.jours["2026-10-23"]._m === undefined && j.t, "récupération : valeurs du client seulement, sans le détail interne");
r = await R("out", { tok: TOK.julie }); j = await r.json(); ok(!j.jours["2026-10-23"], "chaque client ne voit que ses données");
// nouveau lien : l'ancien ne marche plus
r = await R("cle", { method: "POST", tok: TOK.julie, body: { nouvelle: true } }); const cle3 = (await r.json()).cle;
r = await R("in?k=" + cle, { method: "POST", body: { pas: 1 } }); let r2 = await R("in?k=" + cle3, { method: "POST", body: { pas: 1 } });
ok(cle3 !== cle && r.status === 401 && r2.status === 200, "nouveau lien : l'ancien est désactivé");
r = await R("revoquer", { method: "POST", tok: TOK.julie }); r2 = await R("in?k=" + cle3, { method: "POST", body: { pas: 1 } });
ok(r.status === 200 && r2.status === 401 && !kv.m["sin:uidJulie123"] && !kv.m["su:uidJulie123"], "arrêt de l'envoi automatique : lien supprimé et données en attente effacées");
r = await worker.fetch(new Request("https://relais.example/sante/in", { method: "OPTIONS" }), env); ok(r.status === 204 && r.headers.get("access-control-allow-headers").includes("x-cle"), "pré-vérification CORS");
// la clé peut aussi passer par l'en-tête x-cle (Health Connect Webhook : en-tête personnalisé)
r = await R("cle", { method: "POST", tok: TOK.julie }); const cle4 = (await r.json()).cle;
r = await R("in", { method: "POST", body: { pas: 4321 }, headers: { "x-cle": cle4 } }); ok(r.status === 200, "clé dans l'en-tête x-cle acceptée");
// le coach supprime un client : lien et valeurs en attente effacés au relais
r = await R("effacer", { method: "POST", tok: TOK.julie, body: { uid: "uidMarc456" } }); ok(r.status === 403 && kv.m["sin:uidMarc456"], "effacer : réservé au coach");
r = await R("effacer", { method: "POST", tok: "jeton-du-coach-antoine-0123456789", body: { uid: "uidMarc456" } });
r2 = await R("in?k=" + cle2, { method: "POST", body: { pas: 1 } });
ok(r.status === 200 && !kv.m["sin:uidMarc456"] && !kv.m["su:uidMarc456"] && r2.status === 401, "effacer (coach) : lien du client désactivé et ses valeurs supprimées");
// le paiement et le coach IA ne sont pas touchés
r = await worker.fetch(new Request("https://relais.example/"), env); ok(r.status === 200 && (await r.text()).includes("Relais"), "page d'accueil du relais inchangée");
console.log(pass + " OK, " + fail + " échecs");
process.exit(fail ? 1 : 0);
