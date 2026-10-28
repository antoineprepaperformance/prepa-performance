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
   Aucune donnée bancaire ne passe par ce relais : seulement le montant, l'e-mail et la référence de commande.

   Coach IA sur le site (facultatif, gratuit) : adresse « …/ia ». Le relais vérifie que la personne est connectée et
   qu'elle est le coach ou un client avec une formule en cours (hors Lite), puis fait répondre un modèle d'IA ouvert
   (Gemma 4 de Google, licence Apache 2.0) exécuté par Cloudflare Workers AI : 10 000 « neurones » gratuits par jour
   sur l'offre Workers Free. Au-delà, l'IA répond « limite du jour atteinte » : rien n'est jamais facturé sans
   passer à une offre payante.
     Liaison Workers AI « AI » (Settings › Bindings › Add › Workers AI)
     FIREBASE_API_KEY, FIREBASE_PROJECT_ID, SITE_ORIGIN : comme ci-dessus
     IA_MODELE              (facultatif) modèle, par défaut @cf/google/gemma-4-26b-a4b-it (vision et outils)
     Limites par client et par jour : celles de chaque formule, réglées dans l'application (Offres & réglages › Coach IA),
     comptées avec le stockage KV « QUOTA ». Plafonds facultatifs pour tous : IA_PAR_JOUR (questions) et IA_PHOTOS_PAR_JOUR.
   Liaison KV « QUOTA » (facultative, recommandée) : partage équitablement l'allocation gratuite entre les clients.

   Données de la montre ou du téléphone (facultatif, gratuit) : adresses « …/sante/… ». Chaque client crée dans l'application
   un lien personnel secret ; le Raccourci de son iPhone (app Santé) ou l'application Android « Health Connect Webhook »
   y envoie ses pas, calories actives, sommeil, FC au repos, VFC et poids. Les valeurs attendent dans le stockage KV
   (14 derniers jours au plus) jusqu'à ce que l'application du client les récupère et les range dans son dossier.
     Liaison KV « QUOTA » (la même que ci-dessus) ou « SANTE » : obligatoire pour cette fonction.
     SANTE_ENVOIS_PAR_JOUR  (facultatif) envois acceptés par client et par jour, par défaut 36.
     SANTE_ECART_MIN        (facultatif) minutes entre deux envois du Raccourci iPhone pour un même jour, par défaut 15. */

/* grille en vigueur : prix par formule et par durée en semaines (1, 3, 6 et 12 mois) ; réglage « tarifs » de l'espace coach */
const DEFAULT_TARIFS = { ia: { 4: 29, 12: 79, 26: 149, 52: 279 }, essentiel: { 4: 59, 12: 159, 26: 299, 52: 569 }, suivi: { 4: 119, 12: 319, 26: 599, 52: 1139 }, surmesure: { 4: 199, 12: 539, 26: 999, 52: 1899 } };
/* ancienne grille (1, 2 et 3 mois) : seulement pour les liens de 2 mois encore actifs et l'ancienne formule Hybride */
const LEGACY_PRICES = { ia: [25, 47, 67], essentiel: [49, 95, 135], suivi: [99, 189, 269], hybride: [139, 265, 375] };
const LEGACY_W = [4, 8, 12];
const DEFAULT_LITE = { mois: 9.9, an: 89, nmois: 14.9, nan: 129 };
const DURATIONS = [4, 12, 26, 52];
function expectedPrice(p, offer, weeks) {
  const t = p.tarifs[offer];
  if (t && DURATIONS.includes(weeks) && Number(t[weeks]) > 0) return Number(t[weeks]);
  const old = p.offers[offer] || LEGACY_PRICES[offer], i = LEGACY_W.indexOf(weeks);
  return old && i >= 0 && Number(old[i]) > 0 ? Number(old[i]) : 0;
}
const TOLERANCE_S = 300;

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (path.endsWith("/resilier")) return resilier(request, env);
    if (/\/sante\/(etat|cle|in|out|revoquer|effacer)$/.test(path)) return sante(request, env, path.split("/").pop());
    if (path.endsWith("/ia/etat")) return iaEtat(request, env);
    if (path.endsWith("/ia")) return ia(request, env);
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
  if (!/^[A-Za-z0-9]{6,128}$/.test(uid || "") || !(DEFAULT_TARIFS[offer] || LEGACY_PRICES[offer]) || !(DURATIONS.includes(weeks) || LEGACY_W.includes(weeks))) return "ignoré : référence client absente ou invalide";
  const prices = await readPrices(env);
  const expected = Math.round(expectedPrice(prices, offer, weeks) * 100);
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
  const m = /^(mois|an)-(abo|avance)(-n)?$/.exec(kindS || "");
  if (!/^[A-Za-z0-9]{6,128}$/.test(uid || "") || !m) return "ignoré : référence client absente ou invalide";
  const period = m[1], mode = m[2], nutri = !!m[3]; // « -n » : Lite + Nutrition
  const sub = mode === "abo" ? String(s.subscription || "") : "";
  if (mode === "abo" && !/^sub_[A-Za-z0-9]{6,}$/.test(sub)) return "ignoré : abonnement absent";
  const lite = await readLite(env);
  const expected = Math.round(Number(lite[(nutri ? "n" : "") + period]) * 100);
  const amount = Number(s.amount_total) || 0;
  const currency = String(s.currency || "").toLowerCase();
  const ok = currency === "eur" && expected > 0 && amount >= expected;
  const oid = /^[A-Za-z0-9]{4,40}$/.test(orderId || "") ? orderId : "";
  const token = await relayToken(env);
  const at = new Date().toISOString();
  if (mode === "abo" && !(await getDoc(env, token, "subs/" + sub))) await setDoc(env, token, "subs/" + sub, { uid, period, nutri, orderId: oid, status: "active", cancelAt: 0, customer: String(s.customer || ""), at, live: !!event.livemode });
  const doc = { uid, offer: "lite", period, mode, nutri, sub, weeks: 0, orderId: oid, amount, expected, currency, email: (s.customer_details && s.customer_details.email) || s.customer_email || "",
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
  const expected = Math.round(Number(lite[(sd.nutri ? "n" : "") + sd.period] || 0) * 100);
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

/* ---------- coach IA du site : Claude (API Anthropic) derrière une vérification du compte ---------- */
const IA_MODELE = "@cf/google/gemma-4-26b-a4b-it";
const IA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
function corsIa(env) {
  return { "access-control-allow-origin": env.SITE_ORIGIN || "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization", "content-type": "application/json" };
}
async function iaEtat(request, env) {
  const H = corsIa(env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  return new Response(JSON.stringify({ ok: true, ia: !!(env.AI && typeof env.AI.run === "function"), quota: !!env.QUOTA }), { status: 200, headers: H });
}
function dayKey() { return new Date().toISOString().slice(0, 10); }
/* formule en cours (hors Lite) d'après le document plans/{uid}, lu avec le jeton du client lui-même : renvoie son identifiant */
function planActif(fields, now) {
  if (!fields) return null;
  const g = (k) => fromFs(fields[k]);
  const offer = String(g("offer") || "");
  if (g("status") !== "active" || !["ia", "essentiel", "suivi", "surmesure", "hybride"].includes(offer)) return null;
  /* formules de 6 et 12 mois : accès daté (startMs → untilMs) */
  const untilMs = Number(g("untilMs")) || 0;
  if (untilMs) { const startMs = Number(g("startMs")) || 0; return now >= startMs - 31 * 86400000 && now <= untilMs + 86400000 ? offer : null; }
  const start = String(g("start") || ""), weeks = Number(g("weeks")) || 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || weeks < 1) return null;
  const t0 = Date.parse(start + "T00:00:00Z");
  return now >= t0 - 31 * 86400000 && now <= t0 + (weeks * 7 + 7) * 86400000 ? offer : null;
}
/* limites du coach IA par formule et par jour : réglées par le coach (settings/app › ai › quota), sinon par défaut.
   Le relais accepte 2 demandes de plus que la limite affichée au client, pour l'analyse automatique du bilan de la semaine. */
const IA_QUOTA_DEF = { ia: { q: 10, ph: 3 }, essentiel: { q: 10, ph: 3 }, suivi: { q: 20, ph: 5 }, surmesure: { q: 30, ph: 8 }, hybride: { q: 10, ph: 3 } };
function iaLimites(aiFields, offer) {
  const d = IA_QUOTA_DEF[offer] || IA_QUOTA_DEF.essentiel;
  const qm = aiFields && aiFields.quota && aiFields.quota.mapValue && aiFields.quota.mapValue.fields;
  const o = qm && qm[offer] && qm[offer].mapValue && qm[offer].mapValue.fields;
  const n = (v, def) => { const x = Number(fromFs(v)); return Number.isFinite(x) && v ? Math.max(0, Math.min(200, Math.round(x))) : def; };
  return { q: o ? n(o.q, d.q) : d.q, ph: o ? n(o.ph, d.ph) : d.ph };
}
/* une « question » : la dernière demande du client n'est pas la suite d'un outil (résultat d'outil renvoyé à l'IA) */
function estQuestion(corps) {
  const last = corps.messages[corps.messages.length - 1];
  return !(last && last.role === "user" && last.content.some((c) => c.type === "tool_result"));
}
/* nettoie la demande : seuls les messages, images et outils de la page passent, avec des limites */
function iaCorps(b) {
  if (!b || !Array.isArray(b.messages) || !b.messages.length || b.messages.length > 60) return { err: "messages" };
  let images = 0;
  const block = (c) => {
    if (!c || typeof c !== "object") return null;
    if (c.type === "text") return typeof c.text === "string" && c.text.length ? { type: "text", text: c.text.slice(0, 120000) } : null;
    if (c.type === "image") {
      const src = c.source || {};
      if (src.type !== "base64" || !IA_TYPES.includes(src.media_type) || typeof src.data !== "string" || src.data.length > 1400000) return { bad: 1 };
      images++; return { type: "image", source: { type: "base64", media_type: src.media_type, data: src.data } };
    }
    if (c.type === "tool_use") return { type: "tool_use", id: String(c.id || ""), name: String(c.name || "").slice(0, 64), input: c.input && typeof c.input === "object" ? c.input : {} };
    if (c.type === "tool_result") return { type: "tool_result", tool_use_id: String(c.tool_use_id || ""), content: String(c.content == null ? "" : c.content).slice(0, 20000), ...(c.is_error ? { is_error: true } : {}) };
    return null;
  };
  const messages = [];
  for (const m of b.messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return { err: "messages" };
    const content = typeof m.content === "string" ? [{ type: "text", text: m.content.slice(0, 120000) }] : Array.isArray(m.content) ? m.content.map(block).filter(Boolean) : [];
    if (content.some((c) => c.bad)) return { err: "image" };
    if (!content.length) return { err: "messages" };
    messages.push({ role: m.role, content });
  }
  if (images > 6) return { err: "image" };
  const tools = Array.isArray(b.tools) ? b.tools.slice(0, 12).map((t) => ({ name: String(t.name || "").slice(0, 64), description: String(t.description || "").slice(0, 2000), input_schema: t.input_schema && typeof t.input_schema === "object" ? t.input_schema : { type: "object", properties: {} } })).filter((t) => /^[a-zA-Z0-9_-]{1,64}$/.test(t.name)) : [];
  const out = { messages, max_tokens: Math.max(64, Math.min(4000, Number(b.max_tokens) || 1500)), images };
  if (typeof b.system === "string" && b.system) out.system = b.system.slice(0, 8000);
  if (tools.length) { out.tools = tools; if (b.tool_choice && ["auto", "none", "any"].includes(b.tool_choice.type)) out.tool_choice = { type: b.tool_choice.type }; }
  return out;
}
/* format des messages : celui de la page (blocs texte, image, outil) ⇄ celui de Workers AI (compatible OpenAI) */
function versOpenAI(c) {
  const msgs = [];
  if (c.system) msgs.push({ role: "system", content: c.system });
  for (const m of c.messages) {
    if (m.role === "assistant") {
      const text = m.content.filter((x) => x.type === "text").map((x) => x.text).join("\n");
      const calls = m.content.filter((x) => x.type === "tool_use").map((x) => ({ id: x.id, type: "function", function: { name: x.name, arguments: JSON.stringify(x.input || {}) } }));
      msgs.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    for (const r of m.content.filter((x) => x.type === "tool_result")) msgs.push({ role: "tool", tool_call_id: r.tool_use_id, content: (r.is_error ? "Erreur : " : "") + r.content });
    const parts = m.content.filter((x) => x.type === "text" || x.type === "image").map((x) => (x.type === "text" ? { type: "text", text: x.text } : { type: "image_url", image_url: { url: "data:" + x.source.media_type + ";base64," + x.source.data } }));
    if (parts.length) msgs.push({ role: "user", content: parts.every((x) => x.type === "text") ? parts.map((x) => x.text).join("\n\n") : parts });
  }
  const req = { messages: msgs, max_completion_tokens: c.max_tokens, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } };
  if (c.tools) { req.tools = c.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })); req.tool_choice = c.tool_choice ? (c.tool_choice.type === "any" ? "required" : c.tool_choice.type) : "auto"; }
  return req;
}
function depuisOpenAI(j) {
  const ch = j && Array.isArray(j.choices) ? j.choices[0] || {} : null;
  const msg = ch ? ch.message || {} : { content: j && j.response, tool_calls: j && j.tool_calls };
  let text = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((x) => x.text || "").join("") : "";
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\|channel\|?>thought[\s\S]*?<\|?channel\|>/g, "").trim();
  const content = [];
  if (text) content.push({ type: "text", text });
  (msg.tool_calls || []).forEach((t, i) => {
    const f = t.function || t;
    let input = f.arguments;
    if (typeof input === "string") { try { input = JSON.parse(input); } catch (e) { input = {}; } }
    content.push({ type: "tool_use", id: t.id || "appel_" + i, name: f.name, input: input && typeof input === "object" ? input : {} });
  });
  const fr = ch ? ch.finish_reason : (msg.tool_calls && msg.tool_calls.length ? "tool_calls" : "stop");
  const stop = content.some((x) => x.type === "tool_use") ? "tool_use" : fr === "length" ? "max_tokens" : fr === "content_filter" ? "refusal" : "end_turn";
  return { content, stop_reason: stop };
}
async function quota(env, key, max) {
  if (!env.QUOTA) return true;
  /* si le stockage ne répond pas (limite gratuite d'écritures du jour atteinte), on laisse passer : l'IA garde sa propre limite */
  try {
    const n = Number(await env.QUOTA.get(key)) || 0;
    if (n >= max) return false;
    await env.QUOTA.put(key, String(n + 1), { expirationTtl: 2 * 86400 });
  } catch (e) { return true; }
  return true;
}
async function ia(request, env) {
  const H = corsIa(env);
  const out = (status, o) => new Response(JSON.stringify(o), { status, headers: H });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (request.method !== "POST") return out(405, { ok: false, code: "methode" });
  if (!env.AI || typeof env.AI.run !== "function") return out(503, { ok: false, code: "ia_non_installee" });
  const idToken = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (idToken.length < 20) return out(401, { ok: false, code: "connexion" });
  const raw = await request.text();
  if (raw.length > 6000000) return out(413, { ok: false, code: "trop_long" });
  let b;
  try { b = JSON.parse(raw); } catch (e) { return out(400, { ok: false, code: "json" }); }
  const corps = iaCorps(b);
  if (corps.err) return out(400, { ok: false, code: corps.err });
  try {
    const lk = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_API_KEY), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
    const lj = lk.ok ? await lk.json() : {};
    const u = lj.users && lj.users[0];
    if (!u || !u.localId) return out(401, { ok: false, code: "connexion" });
    /* coach IA désactivé par le coach dans ses réglages ; limites par formule */
    const st = await fetch(FS(env) + "settings/app");
    let aiF = null;
    if (st.ok) {
      const sj = await st.json();
      aiF = (sj.fields && sj.fields.ai && sj.fields.ai.mapValue && sj.fields.ai.mapValue.fields) || null;
      const on = aiF && aiF.on;
      if (on && on.booleanValue === false) return out(403, { ok: false, code: "ia_desactivee" });
    }
    /* droit d'accès : client avec une formule en cours (hors Lite), sinon le coach (seul à pouvoir lister les codes) */
    const auth = { authorization: "Bearer " + idToken };
    let coach = false;
    const pl = await fetch(FS(env) + "plans/" + encodeURIComponent(u.localId), { headers: auth });
    const offre = pl.ok ? planActif((await pl.json()).fields, Date.now()) : null;
    if (!offre) {
      const cl = await fetch(FS(env) + "codes?pageSize=1", { headers: auth });
      coach = cl.ok;
      if (!coach) return out(403, { ok: false, code: "formule" });
    }
    if (!coach && estQuestion(corps)) {
      const d = dayKey(), lim = iaLimites(aiF, offre);
      /* IA_PAR_JOUR / IA_PHOTOS_PAR_JOUR (facultatifs) : plafonds pour tous les clients, quels que soient les réglages */
      const capQ = Number(env.IA_PAR_JOUR) || 1000, capPh = Number(env.IA_PHOTOS_PAR_JOUR) || 1000;
      if (!(await quota(env, "ia:" + u.localId + ":" + d, Math.min(lim.q + 2, capQ)))) return out(429, { ok: false, code: "quota" });
      if (corps.images && !(await quota(env, "photo:" + u.localId + ":" + d, Math.min(lim.ph, capPh)))) return out(429, { ok: false, code: "quota_photos" });
    }
    let j;
    try { j = await env.AI.run(env.IA_MODELE || IA_MODELE, versOpenAI(corps)); }
    catch (e) {
      const m = String((e && e.message) || e);
      const code = /neuron|allocation|quota|limit|429|4006/i.test(m) ? "limite_gratuite" : /too long|context|token/i.test(m) ? "trop_long" : "erreur_ia";
      return out(code === "limite_gratuite" ? 429 : 502, { ok: false, code });
    }
    return out(200, { ok: true, ...depuisOpenAI(j), usage: (j && j.usage) || null });
  } catch (e) { return out(500, { ok: false, code: "erreur" }); }
}

/* ---------- données santé envoyées par la montre ou le téléphone ---------- */
const SANTE_LIM = { pas: [0, 100000], kcal: [0, 6000], kcalTot: [500, 12000], sommeil: [0, 16], fcr: [25, 130], vfc: [5, 300], poids: [25, 300] };
const SANTE_JOURS = 14;
function kvSante(env) { return env.SANTE || env.QUOTA || null; }
function corsSante(env) {
  return { "access-control-allow-origin": env.SITE_ORIGIN || "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization, x-cle", "content-type": "application/json" };
}
async function uidOf(request, env) {
  const idToken = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (idToken.length < 20 || !env.FIREBASE_API_KEY) return null;
  const lk = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_API_KEY), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
  const lj = lk.ok ? await lk.json() : {};
  const u = lj.users && lj.users[0];
  return u && u.localId ? u.localId : null;
}
function newKey() {
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  const ch = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(a, (x) => ch[x % ch.length]).join("");
}
/* jour local (France) d'un instant ; une heure écrite avec son décalage local garde son jour */
function jourDe(t) {
  if (typeof t !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(t)) return null;
  if (/[+-]\d{2}:?\d{2}$/.test(t) && !/[+-]00:?00$/.test(t)) return t.slice(0, 10);
  const ms = Date.parse(t); if (!Number.isFinite(ms)) return null;
  return parisDay(ms);
}
function parisDay(ms) {
  try { return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); }
  catch (e) { return new Date(ms + 3600000).toISOString().slice(0, 10); }
}
/* nombre écrit n'importe comment : 8450, « 8 450 pas », « 7,5 h », « 520 kcal », ou une liste de valeurs */
function nombre(v, somme) {
  if (Array.isArray(v)) { const xs = v.map((x) => nombre(x, somme)).filter((x) => x !== null); return xs.length ? (somme ? xs.reduce((a, b) => a + b, 0) : xs[xs.length - 1]) : null; }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v && typeof v === "object") return nombre(v.value ?? v.valeur ?? v.qty ?? v.count ?? v.v, somme);
  const t = String(v ?? "").replace(/[  \s]/g, "").replace(",", ".");
  const h = t.match(/^(\d+(?:\.\d+)?)h(?:(\d+)(?:min|mn)?)?$/i);
  if (h) return Number(h[1]) + (h[2] ? Number(h[2]) / 60 : 0);
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
function borne(k, v) { if (v === null || v === undefined || !Number.isFinite(v)) return null; const [a, b] = SANTE_LIM[k]; return v >= a && v <= b ? (k === "pas" || k === "kcal" || k === "kcalTot" ? Math.round(v) : Math.round(v * 100) / 100) : null; }
/* envoi simple (Raccourci iPhone ou autre application) : une journée, des clés connues */
const ALIAS = { pas: ["pas", "steps", "step_count"], kcal: ["kcal", "calories_actives", "active_calories", "active_energy", "energie_active"], kcalTot: ["kcalTot", "total_calories", "calories_totales"],
  repos: ["repos", "resting_energy", "basal_energy", "energie_repos"], sommeil: ["sommeil", "sleep", "sleep_hours"], fcr: ["fcr", "resting_heart_rate", "fc_repos"], vfc: ["vfc", "hrv", "heart_rate_variability"], poids: ["poids", "weight"] };
function lireSimple(b) {
  const out = {};
  for (const [k, names] of Object.entries(ALIAS)) {
    const n = names.find((x) => b[x] !== undefined && !(Array.isArray(b[x]) && b[x].length && typeof b[x][0] === "object" && (b[x][0].start_time || b[x][0].time || b[x][0].session_end_time)));
    if (n === undefined) continue;
    let v = nombre(b[n], k === "pas" || k === "kcal" || k === "kcalTot" || k === "repos");
    if (k === "sommeil" && v !== null && v > 16 && v <= 1440) v = v / 60;
    out[k] = v;
  }
  if (out.repos !== undefined && out.repos !== null && out.kcal !== undefined && out.kcal !== null && (out.kcalTot === undefined || out.kcalTot === null)) out.kcalTot = out.repos + out.kcal;
  delete out.repos;
  const r = {};
  for (const [k, v] of Object.entries(out)) { const x = borne(k, v); if (x !== null) r[k] = x; }
  return r;
}
/* format « Health Connect Webhook » (Android) : listes d'enregistrements, rangées par jour et sans doublon */
function lireHC(b, jours, now) {
  const touche = new Set();
  const put = (d, type, key, val, mode) => {
    if (!d || val === null || !Number.isFinite(val)) return;
    const j = (jours[d] = jours[d] || {}); const m = (j._m = j._m || {}); const t = (m[type] = m[type] || {});
    if (Object.keys(t).length >= 1500 && !(key in t)) return;
    t[key] = mode === "last" ? [val, key] : val;
    touche.add(d);
  };
  const id = (r, k) => (r && r.metadata && r.metadata.id) || r[k] || "";
  (b.steps || []).forEach((r) => put(jourDe(r.start_time), "pas", id(r, "start_time"), nombre(r.count)));
  (b.active_calories || []).forEach((r) => put(jourDe(r.start_time), "kcal", id(r, "start_time"), nombre(r.calories)));
  (b.total_calories || []).forEach((r) => put(jourDe(r.start_time), "kcalTot", id(r, "start_time"), nombre(r.calories)));
  (b.sleep || []).forEach((r) => {
    const awake = (r.stages || []).filter((s) => /awake|out_of_bed|eveil/i.test(String(s.stage))).reduce((a, s) => a + (Number(s.duration_seconds) || 0), 0);
    const sec = (Number(r.duration_seconds) || 0) - awake;
    put(jourDe(r.session_end_time || r.end_time), "sommeil", id(r, "session_end_time"), sec > 0 ? sec / 3600 : null);
  });
  (b.resting_heart_rate || []).forEach((r) => put(jourDe(r.time), "fcr", r.time || id(r, "time"), nombre(r.bpm), "last"));
  (b.heart_rate_variability || []).forEach((r) => put(jourDe(r.time), "vfc", id(r, "time"), nombre(r.avg ?? r.rmssd_millis)));
  (b.weight || []).forEach((r) => put(jourDe(r.time), "poids", r.time || id(r, "time"), nombre(r.kilograms), "last"));
  for (const d of touche) {
    const m = jours[d]._m, j = jours[d];
    const sum = (o) => Object.values(o).reduce((a, x) => a + x, 0);
    const mean = (o) => { const v = Object.values(o); return v.length ? sum(o) / v.length : null; };
    const last = (o) => { const v = Object.values(o).sort((a, b) => String(a[1]).localeCompare(String(b[1]))); return v.length ? v[v.length - 1][0] : null; };
    const max = (o) => { const v = Object.values(o); return v.length ? Math.max(...v) : null; };
    const calc = { pas: m.pas && sum(m.pas), kcal: m.kcal && sum(m.kcal), kcalTot: m.kcalTot && sum(m.kcalTot), sommeil: m.sommeil && max(m.sommeil), fcr: m.fcr && last(m.fcr), vfc: m.vfc && mean(m.vfc), poids: m.poids && last(m.poids) };
    for (const [k, v] of Object.entries(calc)) { if (v === undefined || v === null) continue; const x = borne(k, v); if (x !== null) j[k] = x; else delete j[k]; }
    j.src = "android"; j.t = now;
  }
  return [...touche];
}
function estHC(b) { return ["steps", "active_calories", "total_calories", "sleep", "resting_heart_rate", "heart_rate_variability", "weight"].some((k) => Array.isArray(b[k]) && b[k].length && typeof b[k][0] === "object"); }
async function sante(request, env, act) {
  const H = corsSante(env);
  const out = (status, o) => new Response(JSON.stringify(o), { status, headers: H });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const kv = kvSante(env);
  if (act === "etat") return out(200, { ok: true, sante: !!kv });
  if (!kv) return out(503, { ok: false, code: "kv" });
  try {
    if (act === "in") {
      if (request.method !== "POST") return out(405, { ok: false, code: "methode" });
      const url = new URL(request.url);
      const cle = String(url.searchParams.get("k") || request.headers.get("x-cle") || "").trim();
      if (!/^[A-Za-z0-9]{20,64}$/.test(cle)) return out(401, { ok: false, code: "cle" });
      const uid = await kv.get("sk:" + cle);
      if (!uid) return out(401, { ok: false, code: "cle" });
      const raw = await request.text();
      if (raw.length > 1000000) return out(413, { ok: false, code: "trop_long" });
      let b; try { b = JSON.parse(raw || "{}"); } catch (e) { return out(400, { ok: false, code: "json" }); }
      if (Array.isArray(b)) b = { liste: b };
      if (!b || typeof b !== "object") return out(400, { ok: false, code: "json" });
      const box = JSON.parse((await kv.get("sin:" + uid)) || "{}");
      const now = new Date().toISOString(), today = parisDay(Date.now());
      const n = box.n && box.n.d === today ? box.n.c : 0;
      if (n >= (Number(env.SANTE_ENVOIS_PAR_JOUR) || 36)) return out(429, { ok: false, code: "limite_jour" });
      const jours = box.jours || {};
      let touches = [];
      if (estHC(b)) touches = lireHC(b, jours, now);
      else {
        const vals = lireSimple(b);
        const d = /^\d{4}-\d{2}-\d{2}$/.test(String(b.d || b.date || "")) ? String(b.d || b.date) : today;
        /* le Raccourci renvoie les totaux du jour à chaque fois : un envoi toutes les 15 minutes suffit (écritures gratuites limitées) */
        const em = Number(env.SANTE_ECART_MIN), prev = jours[d], ecart = (env.SANTE_ECART_MIN !== undefined && env.SANTE_ECART_MIN !== "" && Number.isFinite(em) ? em : 15) * 60000;
        if (Object.keys(vals).length && prev && prev.src === "iphone" && Date.now() - Date.parse(prev.t || 0) < ecart) return out(200, { ok: true, jours: [], note: "deja_recu" });
        if (Object.keys(vals).length) { jours[d] = { ...(jours[d] || {}), ...vals, src: "iphone", t: now }; touches = [d]; }
      }
      if (!touches.length) return out(200, { ok: true, jours: [], note: "aucune valeur reconnue" });
      const garde = Object.keys(jours).sort().slice(-SANTE_JOURS);
      const next = { jours: Object.fromEntries(garde.map((d) => [d, jours[d]])), t: now, n: { d: today, c: n + 1 } };
      await kv.put("sin:" + uid, JSON.stringify(next), { expirationTtl: 30 * 86400 });
      return out(200, { ok: true, jours: touches.filter((d) => garde.includes(d)) });
    }
    const uid = await uidOf(request, env);
    if (!uid) return out(401, { ok: false, code: "connexion" });
    if (act === "cle") {
      if (request.method !== "POST") return out(405, { ok: false, code: "methode" });
      let b = {}; try { b = JSON.parse((await request.text()) || "{}"); } catch (e) { b = {}; }
      let cle = await kv.get("su:" + uid);
      if (!cle || b.nouvelle) {
        if (cle) await kv.delete("sk:" + cle);
        cle = newKey();
        await kv.put("sk:" + cle, uid);
        await kv.put("su:" + uid, cle);
      }
      const base = request.url.replace(/\/sante\/cle(\?.*)?$/, "");
      return out(200, { ok: true, cle, url: base + "/sante/in?k=" + cle });
    }
    if (act === "out") {
      const box = JSON.parse((await kv.get("sin:" + uid)) || "{}");
      const jours = {};
      Object.entries(box.jours || {}).forEach(([d, j]) => { const { _m, ...v } = j || {}; jours[d] = v; });
      return out(200, { ok: true, t: box.t || null, jours });
    }
    /* le coach supprime un client : son lien et ses valeurs en attente sont effacés aussi (droit à l'effacement) */
    if (act === "effacer") {
      if (request.method !== "POST") return out(405, { ok: false, code: "methode" });
      const auth = { authorization: request.headers.get("authorization") || "" };
      const cl = await fetch(FS(env) + "codes?pageSize=1", { headers: auth });
      if (!cl.ok) return out(403, { ok: false, code: "coach" });
      let b = {}; try { b = JSON.parse((await request.text()) || "{}"); } catch (e) { b = {}; }
      const cible = String(b.uid || "");
      if (!/^[A-Za-z0-9_-]{6,128}$/.test(cible)) return out(400, { ok: false, code: "uid" });
      const cle = await kv.get("su:" + cible);
      if (cle) await kv.delete("sk:" + cle);
      await kv.delete("su:" + cible);
      await kv.delete("sin:" + cible);
      return out(200, { ok: true });
    }
    if (act === "revoquer") {
      if (request.method !== "POST") return out(405, { ok: false, code: "methode" });
      const cle = await kv.get("su:" + uid);
      if (cle) await kv.delete("sk:" + cle);
      await kv.delete("su:" + uid);
      await kv.delete("sin:" + uid);
      return out(200, { ok: true });
    }
    return out(404, { ok: false, code: "inconnu" });
  } catch (e) { return out(500, { ok: false, code: "erreur" }); }
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
/* prix réglés par le coach : « tarifs » (grille en vigueur) et « offers » (ancienne grille) */
async function readPrices(env) {
  const out = { tarifs: { ...DEFAULT_TARIFS }, offers: {} };
  try {
    const r = await fetch(FS(env) + "settings/app");
    if (!r.ok) return out;
    const j = await r.json();
    const num = (x) => Number(x && (x.integerValue ?? x.doubleValue ?? x.stringValue) || 0);
    const t = j.fields && j.fields.tarifs && j.fields.tarifs.mapValue && j.fields.tarifs.mapValue.fields;
    for (const [k, v] of Object.entries(t || {})) {
      const f = (v.mapValue && v.mapValue.fields) || {};
      out.tarifs[k] = { ...(DEFAULT_TARIFS[k] || {}) };
      for (const w of DURATIONS) if (num(f[String(w)]) > 0) out.tarifs[k][w] = num(f[String(w)]);
    }
    const o = j.fields && j.fields.offers && j.fields.offers.mapValue && j.fields.offers.mapValue.fields;
    for (const [k, v] of Object.entries(o || {})) out.offers[k] = ((v.arrayValue && v.arrayValue.values) || []).map(num);
    return out;
  } catch (e) { return out; }
}
async function readLite(env) {
  try {
    const r = await fetch(FS(env) + "settings/app");
    if (!r.ok) return DEFAULT_LITE;
    const j = await r.json();
    const f = j.fields && j.fields.lite && j.fields.lite.mapValue && j.fields.lite.mapValue.fields;
    if (!f) return DEFAULT_LITE;
    const n = (x) => (x ? Number(x.integerValue ?? x.doubleValue ?? x.stringValue ?? 0) : 0);
    return { mois: n(f.mois) || DEFAULT_LITE.mois, an: n(f.an) || DEFAULT_LITE.an, nmois: n(f.nmois) || DEFAULT_LITE.nmois, nan: n(f.nan) || DEFAULT_LITE.nan };
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
