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
  const sm = url.match(/documents\/subs\/([^?]+)$/);
  if (sm) {
    if (opts.headers && opts.headers.authorization !== "Bearer tok123") return new Response("{}", { status: 403 });
    const id = decodeURIComponent(sm[1]);
    if ((opts.method || "GET") === "GET") return subs[id] ? new Response(JSON.stringify({ fields: subs[id] }), { status: 200 }) : new Response("{}", { status: 404 });
    if (opts.method === "PATCH") { subs[id] = JSON.parse(opts.body).fields; return new Response("{}", { status: 200 }); }
  }
  if (url.includes("accounts:lookup")) {
    const b = JSON.parse(opts.body);
    return b.idToken === "jeton-valide-de-julie-0123456789" ? new Response(JSON.stringify({ users: [{ localId: "AbC123uidXYZ" }] }), { status: 200 }) : new Response("{}", { status: 400 });
  }
  const st = url.match(/api\.stripe\.com\/v1\/subscriptions\/(sub_[A-Za-z0-9]+)$/);
  if (st) {
    stripeCalls.push([opts.method, st[1], opts.body || ""]);
    if (opts.headers.authorization !== "Bearer rk_test_abc") return new Response("{}", { status: 401 });
    return new Response(JSON.stringify(opts.method === "DELETE" ? { id: st[1], status: "canceled", cancel_at: null } : { id: st[1], status: "active", cancel_at: 1795000000, cancel_at_period_end: true }), { status: 200 });
  }
  return new Response("not found", { status: 404 });
};
const subs = {}; const stripeCalls = [];
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
// 9. forfait Lite : abonnement mensuel (première souscription), renouvellement, résiliation
settingsDoc = { fields: { lite: { mapValue: { fields: { mois: { doubleValue: 9.9 }, an: { integerValue: "89" } } } } } };
b = ev({ client_reference_id: "AbC123uidXYZ__lite__mois-abo__oLite01", amount_total: 990, mode: "subscription", subscription: "sub_TEST123abc", customer: "cus_1" }); id = JSON.parse(b).data.object.id; r = await post(b);
ok(store[id] && store[id].offer.stringValue === "lite" && store[id].period.stringValue === "mois" && store[id].mode.stringValue === "abo" && store[id].sub.stringValue === "sub_TEST123abc" && store[id].ok.booleanValue === true && store[id].expected.integerValue === "990", "Lite mensuel en abonnement : paiement enregistré (9,90 €)");
ok(subs.sub_TEST123abc && subs.sub_TEST123abc.uid.stringValue === "AbC123uidXYZ" && subs.sub_TEST123abc.period.stringValue === "mois" && subs.sub_TEST123abc.orderId.stringValue === "oLite01", "abonnement relié au client (subs)");
b = ev({ client_reference_id: "AbC123uidXYZ__lite__an-avance__oLite02", amount_total: 8900 }); id = JSON.parse(b).data.object.id; r = await post(b);
ok(store[id] && store[id].mode.stringValue === "avance" && store[id].period.stringValue === "an" && store[id].ok.booleanValue === true && store[id].sub.stringValue === "", "Lite annuel en paiement d'avance (89 €)");
b = ev({ client_reference_id: "AbC123uidXYZ__lite__an-avance__oLite03", amount_total: 990 }); id = JSON.parse(b).data.object.id; r = await post(b);
ok(store[id] && store[id].ok.booleanValue === false, "Lite annuel payé au prix mensuel : non valable");
b = ev({ client_reference_id: "AbC123uidXYZ__lite__semaine-abo__o1" }); id = JSON.parse(b).data.object.id; r = await post(b); ok(!store[id], "Lite : durée inconnue ignorée");
b = ev({ client_reference_id: "AbC123uidXYZ__lite__mois-abo__o1", amount_total: 990 }); id = JSON.parse(b).data.object.id; r = await post(b); ok(!store[id], "Lite abonnement sans identifiant d'abonnement : ignoré");
const inv = (o) => JSON.stringify({ id: "evt_" + Math.random().toString(36).slice(2), type: "invoice.paid", livemode: false, data: { object: { object: "invoice", id: "in_" + Math.random().toString(36).slice(2), status: "paid", billing_reason: "subscription_cycle", currency: "eur", amount_paid: 990,
  parent: { subscription_details: { subscription: "sub_TEST123abc" } }, lines: { data: [{ period: { start: 1790000000, end: 1792600000 } }] }, ...o } } });
b = inv({}); id = JSON.parse(b).data.object.id; r = await post(b);
ok(store[id] && store[id].renewal.booleanValue === true && store[id].untilMs.integerValue === String(1792600000 * 1000) && store[id].uid.stringValue === "AbC123uidXYZ" && store[id].ok.booleanValue === true, "renouvellement (API récente : parent.subscription_details) → nouvelle date de fin");
b = inv({ parent: null, subscription: "sub_TEST123abc", amount_paid: 500 }); id = JSON.parse(b).data.object.id; r = await post(b);
ok(store[id] && store[id].ok.booleanValue === false, "renouvellement (ancienne API : invoice.subscription) payé trop bas : non valable");
b = inv({ billing_reason: "subscription_create" }); id = JSON.parse(b).data.object.id; r = await post(b); ok(!store[id], "première facture de l'abonnement ignorée (déjà comptée par la session)");
b = inv({ parent: { subscription_details: { subscription: "sub_INCONNU999" } } }); id = JSON.parse(b).data.object.id; r = await post(b); ok(!store[id] && (await r.text()).includes("inconnu"), "abonnement inconnu ignoré");
b = JSON.stringify({ id: "evt_s1", type: "customer.subscription.updated", data: { object: { object: "subscription", id: "sub_TEST123abc", status: "active", cancel_at_period_end: true, cancel_at: null, items: { data: [{ current_period_end: 1795000000 }] } } } }); r = await post(b);
ok(subs.sub_TEST123abc.cancelAt.integerValue === String(1795000000 * 1000) && subs.sub_TEST123abc.uid.stringValue === "AbC123uidXYZ", "résiliation faite dans Stripe : date de fin notée (champ des articles)");
// résiliation depuis l'application
const res = (body, e = env, method = "POST") => worker.fetch(new Request("https://relais.example/resilier", { method, body: method === "POST" ? JSON.stringify(body) : undefined, headers: { "content-type": "application/json" } }), e);
r = await res({ idToken: "jeton-valide-de-julie-0123456789", sub: "sub_TEST123abc" }); ok(r.status === 501 && stripeCalls.length === 0, "sans clé Stripe : 501, résiliation à faire par le coach");
const envK = { ...env, STRIPE_SECRET_KEY: "rk_test_abc", SITE_ORIGIN: "https://antoine.github.io" };
r = await res({ idToken: "jeton-faux-000000000000000000000", sub: "sub_TEST123abc" }, envK); ok(r.status === 401 && stripeCalls.length === 0, "jeton de connexion invalide refusé");
subs.sub_AUTRE12345 = { uid: { stringValue: "QuelquUnDautre" }, period: { stringValue: "mois" } };
r = await res({ idToken: "jeton-valide-de-julie-0123456789", sub: "sub_AUTRE12345" }, envK); ok(r.status === 403 && stripeCalls.length === 0, "abonnement d'un autre client refusé");
r = await res({ idToken: "jeton-valide-de-julie-0123456789", sub: "sub_TEST123abc" }, envK); let j = await r.json();
ok(r.status === 200 && j.ok && stripeCalls[0][0] === "POST" && stripeCalls[0][2] === "cancel_at_period_end=true" && r.headers.get("access-control-allow-origin") === "https://antoine.github.io", "résiliation en fin de période dans Stripe (CORS limité au site)");
r = await res({ idToken: "jeton-valide-de-julie-0123456789", sub: "sub_TEST123abc", immediate: true }, envK); j = await r.json();
ok(r.status === 200 && j.status === "canceled" && stripeCalls[1][0] === "DELETE" && subs.sub_TEST123abc.status.stringValue === "canceled", "résiliation immédiate (reconduction non annoncée)");
r = await res(null, envK, "OPTIONS"); ok(r.status === 204 && r.headers.get("access-control-allow-methods").includes("POST"), "pré-vérification CORS");
console.log(pass + " OK, " + fail + " échecs");
process.exit(fail ? 1 : 0);
