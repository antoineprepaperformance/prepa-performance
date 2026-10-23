// Tests du relais : signature Stripe, montants, idempotence, format Firestore (Node 18+, fetch simulé)
import worker from "./worker.js";
import { createHmac } from "node:crypto";
const env = { STRIPE_WEBHOOK_SECRET: "whsec_test_secret_123", FIREBASE_API_KEY: "AIza-test", FIREBASE_PROJECT_ID: "prepa-test", RELAIS_EMAIL: "relais@prepa.test", RELAIS_PASSWORD: "pw" };
const store = {}; const calls = [];
let settingsDoc = { fields: { offers: { mapValue: { fields: { suivi: { arrayValue: { values: [{ integerValue: "149" }, { integerValue: "189" }, { integerValue: "269" }] } } } } } } };
globalThis.fetch = async (url, opts = {}) => {
  calls.push([opts.method || "GET", url]);
  if (url.includes("accounts:signInWithPassword")) {
    const b = JSON.parse(opts.body);
    if (b.email === env.RELAIS_EMAIL && b.password === env.RELAIS_PASSWORD && url.includes("key=AIza-test")) return new Response(JSON.stringify({ idToken: "tok123" }), { status: 200 });
    return new Response("{}", { status: 400 });
  }
  if (url.endsWith("/documents/settings/app")) return settingsDoc ? new Response(JSON.stringify(settingsDoc), { status: 200 }) : new Response("{}", { status: 404 });
  const m = url.match(/documents\/payments\?documentId=(.+)$/);
  if (m && opts.method === "POST") {
    if (opts.headers.authorization !== "Bearer tok123") return new Response("{}", { status: 403 });
    const id = decodeURIComponent(m[1]);
    if (store[id]) return new Response("{}", { status: 409 });
    store[id] = JSON.parse(opts.body).fields; return new Response("{}", { status: 200 });
  }
  return new Response("not found", { status: 404 });
};
const sign = (body, secret = env.STRIPE_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) => "t=" + t + ",v1=" + createHmac("sha256", secret).update(t + "." + body).digest("hex");
const ev = (o) => JSON.stringify({ id: "evt_" + Math.random().toString(36).slice(2), type: "checkout.session.completed", livemode: false, data: { object: { object: "checkout.session", id: "cs_test_" + Math.random().toString(36).slice(2), payment_status: "paid", currency: "eur", amount_total: 14900, client_reference_id: "AbC123uidXYZ__suivi__4__oabc123", customer_details: { email: "julie@test.fr" }, ...o } } });
const post = async (body, sig) => worker.fetch(new Request("https://relais.example/", { method: "POST", body, headers: sig === null ? {} : { "stripe-signature": sig ?? sign(body) } }), env);
let pass = 0, fail = 0; const ok = (c, n) => { (c ? pass++ : fail++); console.log((c ? "  OK  " : "  FAIL ") + n); };
// 1. paiement valide
let b = ev({}); let r = await post(b); let id = JSON.parse(b).data.object.id;
ok(r.status === 200 && store[id] && store[id].ok.booleanValue === true && store[id].weeks.integerValue === "4" && store[id].uid.stringValue === "AbC123uidXYZ" && store[id].orderId.stringValue === "oabc123" && store[id].used.booleanValue === false, "paiement valide enregistré (prix lu dans les réglages : 149 €) → " + (await r.text()));
ok(store[id] && store[id].amount.integerValue === "14900" && store[id].expected.integerValue === "14900", "montants en centimes au format Firestore (integerValue)");
// 2. même événement renvoyé par Stripe
r = await post(b); ok(r.status === 200 && (await r.text()) === "déjà enregistré", "événement rejoué : pas de doublon");
// 3. mauvaise signature / pas de signature / signature trop ancienne
r = await post(ev({}), sign("autre", env.STRIPE_WEBHOOK_SECRET)); ok(r.status === 400, "signature d'un autre contenu refusée");
r = await post(ev({}), sign("x", "whsec_mauvais")); ok(r.status === 400, "mauvais secret refusé");
r = await post(ev({}), null); ok(r.status === 400, "sans signature refusé");
b = ev({}); r = await post(b, sign(b, env.STRIPE_WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 900)); ok(r.status === 400, "signature de plus de 5 min refusée (rejeu)");
// 4. montant insuffisant (client qui a payé l'Essentiel 1 mois en se faisant passer pour Suivi)
b = ev({ amount_total: 4900 }); id = JSON.parse(b).data.object.id; r = await post(b);
ok(r.status === 200 && store[id] && store[id].ok.booleanValue === false, "montant trop faible : enregistré mais non valable (à vérifier par le coach)");
b = ev({ currency: "usd" }); id = JSON.parse(b).data.object.id; r = await post(b); ok(store[id] && store[id].ok.booleanValue === false, "autre devise : non valable");
// 5. paiement pas encore encaissé, autre événement, référence invalide
b = ev({ payment_status: "unpaid" }); id = JSON.parse(b).data.object.id; r = await post(b); ok(r.status === 200 && !store[id], "paiement non encaissé : ignoré");
b = JSON.stringify({ id: "evt_x", type: "charge.refunded", data: { object: {} } }); r = await post(b); ok(r.status === 200 && (await r.text()).startsWith("ignoré"), "autre type d'événement ignoré");
b = ev({ client_reference_id: "n'importe/quoi" }); id = JSON.parse(b).data.object.id; r = await post(b); ok(r.status === 200 && !store[id], "référence invalide : ignorée");
b = ev({ client_reference_id: "AbC123uidXYZ__suivi__3__o1" }); id = JSON.parse(b).data.object.id; r = await post(b); ok(!store[id], "durée hors grille : ignorée");
// 6. réglages illisibles : prix par défaut
settingsDoc = null; b = ev({ client_reference_id: "AbC123uidXYZ__essentiel__8__o9a8b7", amount_total: 9500 }); id = JSON.parse(b).data.object.id; r = await post(b);
ok(store[id] && store[id].ok.booleanValue === true && store[id].expected.integerValue === "9500", "réglages absents : prix par défaut (95 €)");
// 7. paiement différé (SEPA) confirmé plus tard
b = JSON.stringify({ ...JSON.parse(ev({})), type: "checkout.session.async_payment_succeeded" }); id = JSON.parse(b).data.object.id; r = await post(b); ok(store[id], "paiement différé confirmé : enregistré");
// 8. mauvais identifiants du relais → 500 (Stripe réessaiera)
const env2 = { ...env, RELAIS_PASSWORD: "faux" }; b = ev({});
r = await worker.fetch(new Request("https://relais.example/", { method: "POST", body: b, headers: { "stripe-signature": sign(b) } }), env2); ok(r.status === 500, "identifiants du relais faux : erreur 500, Stripe réessaiera");
r = await worker.fetch(new Request("https://relais.example/", { method: "GET" }), env); ok(r.status === 200, "page de test du relais (GET)");
console.log(pass + " OK, " + fail + " échecs");
process.exit(fail ? 1 : 0);
