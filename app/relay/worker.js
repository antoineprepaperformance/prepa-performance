/* Relais de paiement — Antoine Prépa Performance
   Cloudflare Worker gratuit : reçoit la confirmation de paiement de Stripe (webhook signé),
   vérifie le montant, puis enregistre le paiement dans Firebase. Le site du client active
   alors l'accès tout seul (les règles Firestore vérifient tout une seconde fois).

   Variables à créer dans Cloudflare (Settings › Variables and Secrets) :
     STRIPE_WEBHOOK_SECRET  secret de signature du webhook Stripe (whsec_…)
     FIREBASE_API_KEY       la même clé que dans docs/config.js
     FIREBASE_PROJECT_ID    l'identifiant du projet Firebase
     RELAIS_EMAIL           e-mail du compte « relais » créé dans Firebase › Authentication
     RELAIS_PASSWORD        son mot de passe
     STRIPE_SECRET_KEY      (facultatif) clé Stripe restreinte « Abonnements : écriture » : la résiliation
                            d'un abonnement Lite depuis l'application arrête alors aussitôt les prélèvements
     SITE_ORIGIN            (facultatif) adresse du site, ex. https://ton-pseudo.github.io (sinon tout site)
   Événements Stripe à cocher : checkout.session.completed, checkout.session.async_payment_succeeded,
   invoice.paid, customer.subscription.updated, customer.subscription.deleted.
   Aucune donnée bancaire ne passe par ce relais : seulement le montant, l'e-mail et la référence de commande. */

const DEFAULT_PRICES = { essentiel: [49, 95, 135], suivi: [99, 189, 269], hybride: [139, 265, 375] };
const DEFAULT_LITE = { mois: 9.9, an: 89 };
const DURATIONS = [4, 8, 12];
const TOLERANCE_S = 300;

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (path.endsWith("/resilier")) return resilier(request, env);
    if (request.method !== "POST") return new Response("Relais de paiement actif.", { status: 200 });
    const body = await request.text();
    const ok = await verifyStripe(body, request.headers.get("stripe-signature") || "", env.STRIPE_WEBHOOK_SECRET || "");
    if (!ok) return new Response("Signature invalide", { status: 400 });
    let event;
    try { event = JSON.parse(body); } catch (e) { return new Response("JSON invalide", { status: 400 }); }
    try {
      const r = await handle(event, env);
      return new Response(r, { status: 200 });
    } catch (e) {
      // 500 : Stripe renverra l'événement plus tard (jusqu'à 3 jours)
      return new Response("Erreur : " + (e && e.message ? e.message : "inconnue"), { status: 500 });
    }
  },
};

async function handle(event, env) {
  const t = event.type;
  if (t === "checkout.session.completed" || t === "checkout.session.async_payment_succeeded") return checkout(event, env);
  if (t === "invoice.paid" || t === "invoice.payment_succeeded") return renewal(event, env);
  if (t === "customer.subscription.updated" || t === "customer.subscription.deleted") return subChanged(event, env);
  return "ignoré : " + t;
}
async function checkout(event, env) {
  const s = event.data && event.data.object;
  if (!s || s.object !== "checkout.session") return "ignoré : pas une session";
  if (s.payment_status !== "paid") return "en attente de paiement";
  const parts = String(s.client_reference_id || "").split("__");
  const [uid, offer, weeksS, orderId] = parts;
  if (offer === "lite") return liteCheckout(event, env, s, uid, weeksS, orderId);
  const weeks = Number(weeksS);
  if (!/^[A-Za-z0-9]{6,128}$/.test(uid || "") || !DEFAULT_PRICES[offer] || !DURATIONS.includes(weeks)) return "ignoré : référence client absente ou invalide";
  const prices = await readPrices(env);
  const idx = DURATIONS.indexOf(weeks);
  const expected = Math.round(Number((prices[offer] || DEFAULT_PRICES[offer])[idx]) * 100);
  const amount = Number(s.amount_total) || 0;
  const currency = String(s.currency || "").toLowerCase();
  const amountOk = currency === "eur" && expected > 0 && amount >= expected;
  const token = await relayToken(env);
  const doc = {
    uid, offer, weeks, orderId: /^[A-Za-z0-9]{4,40}$/.test(orderId || "") ? orderId : "",
    amount, expected, currency, email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
    ok: amountOk, used: false, at: new Date().toISOString(), session: s.id, live: !!event.livemode, event: event.id,
  };
  const res = await createDoc(env, token, "payments", s.id, doc);
  return res === "exists" ? "déjà enregistré" : amountOk ? "paiement enregistré" : "paiement enregistré, montant à vérifier";
}

/* ---------- forfait Lite : première souscription ou paiement d'avance ---------- */
async function liteCheckout(event, env, s, uid, kindS, orderId) {
  const m = /^(mois|an)-(abo|avance)$/.exec(kindS || "");
  if (!/^[A-Za-z0-9]{6,128}$/.test(uid || "") || !m) return "ignoré : référence client absente ou invalide";
  const period = m[1], mode = m[2];
  const sub = mode === "abo" ? String(s.subscription || "") : "";
  if (mode === "abo" && !/^sub_[A-Za-z0-9]{6,}$/.test(sub)) return "ignoré : abonnement absent";
  const lite = await readLite(env);
  const expected = Math.round(Number(lite[period]) * 100);
  const amount = Number(s.amount_total) || 0;
  const currency = String(s.currency || "").toLowerCase();
  const ok = currency === "eur" && expected > 0 && amount >= expected;
  const oid = /^[A-Za-z0-9]{4,40}$/.test(orderId || "") ? orderId : "";
  const token = await relayToken(env);
  const at = new Date().toISOString();
  if (mode === "abo" && !(await getDoc(env, token, "subs/" + sub))) await setDoc(env, token, "subs/" + sub, { uid, period, orderId: oid, status: "active", cancelAt: 0, customer: String(s.customer || ""), at, live: !!event.livemode });
  const doc = { uid, offer: "lite", period, mode, sub, weeks: 0, orderId: oid, amount, expected, currency, email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
    ok, used: false, at, session: s.id, live: !!event.livemode, event: event.id };
  const res = await createDoc(env, token, "payments", s.id, doc);
  return res === "exists" ? "déjà enregistré" : ok ? "paiement Lite enregistré" : "paiement Lite enregistré, montant à vérifier";
}
/* ---------- renouvellement d'un abonnement : la facture payée repousse la date de fin d'accès ---------- */
function subOfInvoice(inv) {
  const l0 = ((inv.lines && inv.lines.data) || [])[0] || {};
  return String(inv.subscription || (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription)
    || (l0.parent && l0.parent.subscription_item_details && l0.parent.subscription_item_details.subscription) || l0.subscription || "");
}
async function renewal(event, env) {
  const inv = event.data && event.data.object;
  if (!inv || inv.object !== "invoice") return "ignoré : pas une facture";
  if (inv.billing_reason !== "subscription_cycle") return "ignoré : facture " + (inv.billing_reason || "hors abonnement");
  if (inv.status && inv.status !== "paid") return "facture non payée";
  const sub = subOfInvoice(inv);
  if (!/^sub_[A-Za-z0-9]{6,}$/.test(sub)) return "ignoré : abonnement absent";
  const token = await relayToken(env);
  const sd = await getDoc(env, token, "subs/" + sub);
  if (!sd || !sd.uid) return "ignoré : abonnement inconnu";
  const lines = (inv.lines && inv.lines.data) || [];
  const endS = Math.max(0, ...lines.map((l) => Number(l.period && l.period.end) || 0));
  if (!endS) return "ignoré : période absente";
  const lite = await readLite(env);
  const expected = Math.round(Number(lite[sd.period] || 0) * 100);
  const amount = Number(inv.amount_paid) || 0;
  const currency = String(inv.currency || "").toLowerCase();
  const ok = currency === "eur" && expected > 0 && amount >= expected;
  const doc = { uid: sd.uid, offer: "lite", period: sd.period, mode: "abo", sub, renewal: true, untilMs: endS * 1000, weeks: 0, orderId: sd.orderId || "", amount, expected, currency,
    email: inv.customer_email || "", ok, used: false, at: new Date().toISOString(), invoice: inv.id, live: !!event.livemode, event: event.id };
  const res = await createDoc(env, token, "payments", inv.id, doc);
  return res === "exists" ? "déjà enregistré" : ok ? "renouvellement enregistré" : "renouvellement enregistré, montant à vérifier";
}
/* ---------- abonnement résilié ou modifié (depuis l'application, le portail client ou le tableau de bord Stripe) ---------- */
async function subChanged(event, env) {
  const so = event.data && event.data.object;
  if (!so || so.object !== "subscription" || !/^sub_[A-Za-z0-9]{6,}$/.test(so.id || "")) return "ignoré : pas un abonnement";
  const token = await relayToken(env);
  const sd = await getDoc(env, token, "subs/" + so.id);
  if (!sd) return "ignoré : abonnement inconnu";
  const itemEnd = Math.max(0, ...(((so.items && so.items.data) || []).map((i) => Number(i.current_period_end) || 0)));
  const periodEnd = Number(so.current_period_end) || itemEnd;
  const cancelAt = so.cancel_at ? so.cancel_at * 1000 : so.cancel_at_period_end && periodEnd ? periodEnd * 1000 : 0;
  await setDoc(env, token, "subs/" + so.id, { ...sd, status: String(so.status || ""), cancelAt, endedAt: so.ended_at ? so.ended_at * 1000 : 0, updatedAt: new Date().toISOString() });
  return "abonnement mis à jour : " + so.status;
}
/* ---------- résiliation demandée depuis l'application (articles L215-1-1 et D215-1 du code de la consommation) ---------- */
function cors(env) {
  return { "access-control-allow-origin": env.SITE_ORIGIN || "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "content-type": "application/json" };
}
async function resilier(request, env) {
  const H = cors(env);
  const out = (status, o) => new Response(JSON.stringify(o), { status, headers: H });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return out(405, { ok: false });
  let b;
  try { b = await request.json(); } catch (e) { return out(400, { ok: false, why: "json" }); }
  const sub = String((b && b.sub) || ""), idToken = String((b && b.idToken) || "");
  if (!/^sub_[A-Za-z0-9]{6,}$/.test(sub) || idToken.length < 20) return out(400, { ok: false, why: "requete" });
  try {
    const lk = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_API_KEY), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
    const lj = lk.ok ? await lk.json() : {};
    const uid = lj.users && lj.users[0] && lj.users[0].localId;
    if (!uid) return out(401, { ok: false, why: "connexion" });
    const token = await relayToken(env);
    const sd = await getDoc(env, token, "subs/" + sub);
    if (!sd || sd.uid !== uid) return out(403, { ok: false, why: "abonnement" });
    if (!env.STRIPE_SECRET_KEY) return out(501, { ok: false, why: "cle_stripe" });
    const now = !!b.immediate;
    const r = await fetch("https://api.stripe.com/v1/subscriptions/" + sub, now
      ? { method: "DELETE", headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY } }
      : { method: "POST", headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY, "content-type": "application/x-www-form-urlencoded" }, body: "cancel_at_period_end=true" });
    if (!r.ok) return out(502, { ok: false, why: "stripe" });
    const j = await r.json();
    const cancelAt = j.cancel_at ? j.cancel_at * 1000 : now ? Date.now() : 0;
    await setDoc(env, token, "subs/" + sub, { ...sd, status: String(j.status || ""), cancelAt, by: "client", updatedAt: new Date().toISOString() });
    return out(200, { ok: true, status: j.status, cancelAt });
  } catch (e) { return out(500, { ok: false, why: "erreur" }); }
}

/* ---------- Stripe : vérification de signature (HMAC-SHA256 de « t.corps ») ---------- */
async function verifyStripe(body, header, secret, nowS) {
  if (!secret || !header) return false;
  let t = null; const v1 = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === "t") t = v; else if (k === "v1") v1.push(v);
  }
  if (!t || !v1.length) return false;
  const now = nowS || Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + body)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return v1.some((s) => timingSafeEqual(s, hex));
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- Firebase ---------- */
const FS = (env) => "https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/";
async function readPrices(env) {
  try {
    const r = await fetch(FS(env) + "settings/app");
    if (!r.ok) return DEFAULT_PRICES;
    const j = await r.json();
    const offers = j.fields && j.fields.offers && j.fields.offers.mapValue && j.fields.offers.mapValue.fields;
    if (!offers) return DEFAULT_PRICES;
    const out = {};
    for (const [k, v] of Object.entries(offers)) {
      const vals = (v.arrayValue && v.arrayValue.values) || [];
      out[k] = vals.map((x) => Number(x.integerValue ?? x.doubleValue ?? 0));
    }
    return { ...DEFAULT_PRICES, ...out };
  } catch (e) { return DEFAULT_PRICES; }
}
async function readLite(env) {
  try {
    const r = await fetch(FS(env) + "settings/app");
    if (!r.ok) return DEFAULT_LITE;
    const j = await r.json();
    const f = j.fields && j.fields.lite && j.fields.lite.mapValue && j.fields.lite.mapValue.fields;
    if (!f) return DEFAULT_LITE;
    const n = (x) => (x ? Number(x.integerValue ?? x.doubleValue ?? x.stringValue ?? 0) : 0);
    return { mois: n(f.mois) || DEFAULT_LITE.mois, an: n(f.an) || DEFAULT_LITE.an };
  } catch (e) { return DEFAULT_LITE; }
}
function fromFs(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  return null;
}
async function getDoc(env, token, path) {
  const r = await fetch(FS(env) + path, { headers: { authorization: "Bearer " + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("lecture refusée par Firebase (" + r.status + ")");
  const j = await r.json();
  return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, fromFs(v)]));
}
async function setDoc(env, token, path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fsValue(v)]));
  const r = await fetch(FS(env) + path, { method: "PATCH", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error("écriture refusée par Firebase (" + r.status + ") : vérifie RELAIS_UID dans les règles");
  return "ok";
}
async function relayToken(env) {
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + encodeURIComponent(env.FIREBASE_API_KEY), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: env.RELAIS_EMAIL, password: env.RELAIS_PASSWORD, returnSecureToken: true }),
  });
  if (!r.ok) throw new Error("connexion du relais à Firebase refusée (" + r.status + ")");
  const j = await r.json();
  return j.idToken;
}
function fsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}
async function createDoc(env, token, col, id, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fsValue(v)]));
  const r = await fetch(FS(env) + col + "?documentId=" + encodeURIComponent(id), {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify({ fields }),
  });
  if (r.status === 409) return "exists";
  if (!r.ok) throw new Error("écriture refusée par Firebase (" + r.status + ") : vérifie RELAIS_UID dans les règles");
  return "ok";
}
