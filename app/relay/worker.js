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
   Aucune donnée bancaire ne passe par ce relais : seulement le montant, l'e-mail et la référence de commande. */

const DEFAULT_PRICES = { essentiel: [49, 95, 135], suivi: [99, 189, 269], hybride: [139, 265, 375] };
const DURATIONS = [4, 8, 12];
const TOLERANCE_S = 300;

export default {
  async fetch(request, env) {
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
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return "ignoré : " + event.type;
  const s = event.data && event.data.object;
  if (!s || s.object !== "checkout.session") return "ignoré : pas une session";
  if (s.payment_status !== "paid") return "en attente de paiement";
  const parts = String(s.client_reference_id || "").split("__");
  const [uid, offer, weeksS, orderId] = parts;
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
