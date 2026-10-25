// Tests du coach IA gratuit du relais (Workers AI) : connexion, droit d'accès, quotas, conversion des messages et des outils, limite gratuite
import worker from "./worker.js";
const env0 = { FIREBASE_API_KEY: "AIza-test", FIREBASE_PROJECT_ID: "prepa-test", SITE_ORIGIN: "https://antoine.github.io" };
const kv = { m: {}, async get(k) { return this.m[k] ?? null; }, async put(k, v) { this.m[k] = v; } };
let aiCalls = [], aiMode = "ok";
const AI = { async run(model, input) {
  aiCalls.push({ model, input });
  if (aiMode === "limite") throw new Error("4006: you have used up your daily free allocation of 10,000 neurons");
  if (aiMode === "outil") return { choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "adapter_charge", arguments: "{\"exercice\":\"squat\",\"consigne\":\"-10 %\"}" } }] } }] };
  return { choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "<think>réflexion</think>Bonjour Julie" } }], usage: { prompt_tokens: 10, completion_tokens: 3 } };
} };
const env = { ...env0, AI, QUOTA: kv, IA_PAR_JOUR: "3", IA_PHOTOS_PAR_JOUR: "1" };
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const TOK = { julie: "jeton-valide-de-julie-0123456789", lite: "jeton-valide-du-client-lite-0001", ancien: "jeton-valide-client-termine-0001", coach: "jeton-valide-du-coach-antoine-01" };
const UID = { [TOK.julie]: "uidJulie123", [TOK.lite]: "uidLite123", [TOK.ancien]: "uidAncien123", [TOK.coach]: "uidCoach123" };
const PLANS = {
  uidJulie123: { status: { stringValue: "active" }, offer: { stringValue: "suivi" }, start: { stringValue: day(-10) }, weeks: { integerValue: "8" } },
  uidLite123: { status: { stringValue: "active" }, offer: { stringValue: "lite" }, start: { stringValue: day(-10) }, weeks: { integerValue: "12" } },
  uidAncien123: { status: { stringValue: "active" }, offer: { stringValue: "essentiel" }, start: { stringValue: day(-100) }, weeks: { integerValue: "4" } },
};
let aiOn = true;
globalThis.fetch = async (url, opts = {}) => {
  const auth = (opts.headers && (opts.headers.authorization || opts.headers.Authorization)) || "";
  if (url.includes("accounts:lookup")) {
    const t = JSON.parse(opts.body).idToken;
    return UID[t] ? new Response(JSON.stringify({ users: [{ localId: UID[t], email: "x@test.fr", emailVerified: true }] }), { status: 200 }) : new Response("{}", { status: 400 });
  }
  if (url.endsWith("/documents/settings/app")) return new Response(JSON.stringify({ fields: { ai: { mapValue: { fields: { on: { booleanValue: aiOn } } } } } }), { status: 200 });
  const pm = url.match(/documents\/plans\/([^?]+)$/);
  if (pm) {
    const uid = decodeURIComponent(pm[1]); const t = auth.replace("Bearer ", "");
    if (UID[t] !== uid) return new Response("{}", { status: 403 });
    return PLANS[uid] ? new Response(JSON.stringify({ fields: PLANS[uid] }), { status: 200 }) : new Response("{}", { status: 404 });
  }
  if (url.includes("/documents/codes?pageSize=1")) return auth === "Bearer " + TOK.coach ? new Response(JSON.stringify({ documents: [] }), { status: 200 }) : new Response("{}", { status: 403 });
  return new Response("not found", { status: 404 });
};
let pass = 0, fail = 0; const ok = (c, n) => { (c ? pass++ : fail++); console.log((c ? "  OK  " : "  FAIL ") + n); };
const call = (tok, body, e = env, method = "POST") => worker.fetch(new Request("https://relais.example/ia", { method, body: method === "POST" ? JSON.stringify(body) : undefined, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) } }), e);
const msg = (t) => ({ messages: [{ role: "user", content: t }], max_tokens: 900 });
const img = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/4AAQSkZJRgABAQ" } };

let r = await worker.fetch(new Request("https://relais.example/ia/etat"), env0); let j = await r.json();
ok(r.status === 200 && j.ia === false, "état : coach IA non installé sans liaison Workers AI");
r = await worker.fetch(new Request("https://relais.example/ia/etat"), env); j = await r.json();
ok(j.ia === true && j.quota === true && r.headers.get("access-control-allow-origin") === "https://antoine.github.io", "état : installé, quotas actifs, CORS limité au site");
r = await call(TOK.julie, msg("Salut"), env0); ok(r.status === 503 && (await r.json()).code === "ia_non_installee", "sans Workers AI : 503");
r = await call(null, msg("Salut")); ok(r.status === 401, "sans connexion : refusé");
r = await call("jeton-faux-00000000000000000000", msg("Salut")); ok(r.status === 401 && aiCalls.length === 0, "jeton invalide : refusé, IA jamais appelée");
r = await call(TOK.julie, { ...msg("Ma séance ?"), tools: [{ name: "adapter_charge", description: "x", input_schema: { type: "object", properties: {} } }, { name: "web search!", description: "y" }], tool_choice: { type: "auto" }, model: "claude-opus-5-5", max_tokens: 99999, system: "Consigne" });
j = await r.json(); const a0 = aiCalls[0];
ok(r.status === 200 && j.ok && j.content[0].text === "Bonjour Julie" && j.stop_reason === "end_turn", "client Suivi en cours : réponse (réflexion interne retirée)");
ok(a0 && a0.model === "@cf/google/gemma-4-26b-a4b-it" && a0.input.max_completion_tokens === 4000 && a0.input.chat_template_kwargs.enable_thinking === false && a0.input.messages[0].role === "system" && a0.input.messages[0].content === "Consigne", "modèle gratuit imposé (Gemma 4), longueur plafonnée, réflexion coupée (économise l'allocation)");
ok(a0 && a0.input.tools.length === 1 && a0.input.tools[0].type === "function" && a0.input.tools[0].function.name === "adapter_charge" && a0.input.tool_choice === "auto", "seuls les outils de la page passent, au format Workers AI");
r = await call(TOK.lite, msg("Salut")); ok(r.status === 403 && (await r.json()).code === "formule", "client Lite : pas de coach IA (comme dans l'application)");
r = await call(TOK.ancien, msg("Salut")); ok(r.status === 403, "formule terminée : refusé");
r = await call(TOK.coach, msg("Rédige ma réponse")); ok(r.status === 200, "coach (sans formule) : autorisé");
r = await call(TOK.julie, { messages: [{ role: "user", content: [img, { type: "text", text: "Mon repas" }] }] }); const im = aiCalls[aiCalls.length - 1].input.messages[0].content;
ok(r.status === 200 && im[0].type === "image_url" && im[0].image_url.url.startsWith("data:image/jpeg;base64,/9j/") && im[1].text === "Mon repas", "photo de repas transmise (image en data URL)");
r = await call(TOK.julie, { messages: [{ role: "user", content: [img, { type: "text", text: "Encore" }] }] }); ok(r.status === 429 && (await r.json()).code === "quota_photos", "quota de photos du jour atteint");
r = await call(TOK.julie, msg("3e")); ok(r.status === 429 && (await r.json()).code === "quota", "quota de demandes du jour atteint (3)");
r = await call(TOK.coach, msg("Coach")); ok(r.status === 200, "le coach n'a pas de quota");
r = await call(TOK.coach, { messages: [{ role: "user", content: [{ type: "image", source: { type: "url", url: "https://x" } }, { type: "text", text: "a" }] }] }); ok(r.status === 400 && (await r.json()).code === "image", "image par lien refusée (base64 uniquement)");
r = await call(TOK.coach, { messages: [{ role: "system", content: "x" }] }); ok(r.status === 400, "rôle inconnu refusé");
aiOn = false; r = await call(TOK.coach, msg("x")); ok(r.status === 403 && (await r.json()).code === "ia_desactivee", "coach IA désactivé dans les réglages : refusé"); aiOn = true;
aiMode = "outil"; r = await call(TOK.coach, { messages: [{ role: "user", content: "Allège" }, { role: "assistant", content: [{ type: "text", text: "Je regarde." }, { type: "tool_use", id: "call_0", name: "adapter_charge", input: { a: 1 } }] }, { role: "user", content: [{ type: "tool_result", tool_use_id: "call_0", content: "Fait" }] }], tools: [{ name: "adapter_charge", description: "x" }] });
j = await r.json(); const a2 = aiCalls[aiCalls.length - 1].input.messages;
ok(j.stop_reason === "tool_use" && j.content[0].type === "tool_use" && j.content[0].name === "adapter_charge" && j.content[0].input.consigne === "-10 %", "appel d'outil renvoyé à la page au format attendu");
ok(a2[1].role === "assistant" && a2[1].tool_calls[0].function.arguments === "{\"a\":1}" && a2[2].role === "tool" && a2[2].tool_call_id === "call_0" && a2[2].content === "Fait", "historique des outils converti (assistant + tool)");
aiMode = "limite"; r = await call(TOK.coach, msg("x")); ok(r.status === 429 && (await r.json()).code === "limite_gratuite", "allocation gratuite du jour épuisée : refus clair, rien de facturé"); aiMode = "ok";
r = await worker.fetch(new Request("https://relais.example/ia", { method: "OPTIONS" }), env); ok(r.status === 204 && r.headers.get("access-control-allow-headers").includes("authorization"), "pré-vérification CORS (en-tête authorization)");
// stockage KV saturé (limite gratuite d'écritures du jour) : le coach IA répond quand même
{ const kvPlein = { async get() { return null; }, async put() { throw new Error("KV put() limit exceeded for the day"); } };
  const r = await call(TOK.coach, msg("Bonjour"), { ...env, QUOTA: kvPlein }); ok(r.status === 200, "stockage plein : le coach IA répond quand même"); }
console.log(pass + " OK, " + fail + " échecs");
process.exit(fail ? 1 : 0);
