/* ===== Version site : coach IA gratuit par le relais du coach (Cloudflare Workers AI, modèle Gemma) =====
   Même interface que claude.use("sample") de la version Claude : sample(), sample.json(), sample.limits().
   Le relais vérifie le compte et la formule avant chaque demande et partage l'allocation gratuite du jour. */
(function () {
  var promise = null;
  function err(code, message, text) { var e = new Error(message || code); e.code = code; if (text) e.text = text; return e; }
  function okUrl(u) { return /^https:\/\/[a-z0-9.-]+/i.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(u); }
  async function getJSON(url, ms) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var t = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, ms || 6000);
    try { var r = await fetch(url, { signal: ctl ? ctl.signal : undefined }); return r.ok ? await r.json() : null; }
    finally { clearTimeout(t); }
  }
  /* image → JPEG en base64, côté le plus long ramené à 1092 px (moins de jetons, même lecture) */
  async function toB64(blob) {
    if (!blob || !/^image\//.test(blob.type || "image/")) throw err("image_rejected");
    var url = URL.createObjectURL(blob);
    try {
      var img = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(err("image_rejected")); }; i.src = url; });
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 1092 / Math.max(w, h, 1));
      var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.82).split(",")[1];
    } finally { URL.revokeObjectURL(url); }
  }
  function norm(input) {
    var list = typeof input === "string" ? [{ role: "user", content: input }] : Array.isArray(input) ? input : [];
    var out = [];
    list.forEach(function (m) {
      if (!m || (m.role !== "user" && m.role !== "assistant")) return;
      var t = String(m.content == null ? "" : m.content);
      if (!t.trim()) return;
      var last = out[out.length - 1];
      if (last && last.role === m.role) last.content += "\n\n" + t; else out.push({ role: m.role, content: t });
    });
    while (out.length && out[0].role !== "user") out.shift();
    if (!out.length || out[out.length - 1].role !== "user") throw err("invalid_request", "Le dernier message doit venir de la personne.");
    return out;
  }
  function parseJSON(t) {
    t = String(t || "").trim();
    try { return JSON.parse(t); } catch (e) {}
    var f = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (f) { try { return JSON.parse(f[1].trim()); } catch (e) {} }
    var a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    return undefined;
  }
  function make(relay) {
    async function post(body, signal) {
      var S = window.SITE, u = S && S.auth && S.auth.currentUser;
      if (!u) throw err("session_expired");
      var tok = await u.getIdToken();
      var r;
      try { r = await fetch(relay + "/ia", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify(body), signal: signal }); }
      catch (e) { if (signal && signal.aborted) throw err("cancelled"); throw err("upstream_error", "réseau"); }
      var j = {};
      try { j = await r.json(); } catch (e) {}
      if (r.ok && j && j.ok) return j;
      var c = (j && j.code) || "";
      throw err(c === "quota" || c === "quota_photos" || c === "surcharge" || c === "limite_gratuite" ? "rate_limited" : c === "formule" || c === "ia_desactivee" ? "sampling_disabled"
        : c === "connexion" ? "session_expired" : c === "trop_long" ? "prompt_too_large" : c === "image" ? "image_rejected" : "upstream_error", c);
    }
    async function run(input, opts, json) {
      opts = opts || {};
      var signal = opts.signal;
      if (signal && signal.aborted) throw err("cancelled");
      var msgs = norm(input).map(function (m) { return { role: m.role, content: m.content }; });
      var files = opts.images ? (opts.images instanceof Blob ? [opts.images] : Array.prototype.slice.call(opts.images)) : [];
      if (files.length > 3) throw err("image_rejected");
      if (files.length) {
        var blocks = [];
        for (var i = 0; i < files.length; i++) blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await toB64(files[i]) } });
        var lastU = msgs[msgs.length - 1];
        lastU.content = blocks.concat([{ type: "text", text: lastU.content }]);
      }
      var tools = (opts.tools || []).filter(function (t) { return t && t.name && typeof t.execute === "function"; });
      var apiTools = tools.map(function (t) { return { name: t.name, description: t.description || "", input_schema: t.inputSchema || { type: "object", properties: {} } }; });
      var system = "Tu travailles dans l'application de préparation physique d'Antoine Prépa Performance. Réponds en français et suis exactement les consignes de la demande."
        + (json ? " Ta réponse finale sera lue par un programme : réponds uniquement avec la valeur JSON demandée, sans texte autour." : "");
      var text = "", finalText = "", stop = "";
      for (var round = 1; ; round++) {
        var last = round >= 6;
        var body = { system: system, messages: msgs, max_tokens: 2000 };
        if (apiTools.length) { body.tools = apiTools; if (last) body.tool_choice = { type: "none" }; }
        var r = await post(body, signal);
        if (signal && signal.aborted) throw err("cancelled", "", text);
        var content = r.content || [];
        var t = content.filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join("");
        finalText = t;
        if (t) { text = text ? text + "\n\n" + t : t; if (opts.onText) { try { opts.onText({ text: text, delta: t }); } catch (e) {} } }
        stop = r.stop_reason || "";
        if (stop === "refusal") throw err("refused", "", text);
        if (stop === "tool_use" && !last) {
          msgs.push({ role: "assistant", content: content });
          var results = [];
          var uses = content.filter(function (c) { return c.type === "tool_use"; });
          for (var k = 0; k < uses.length; k++) {
            var c = uses[k], tool = tools.find(function (x) { return x.name === c.name; }), out, bad = false;
            try { if (tool) out = await tool.execute(c.input || {}, { signal: signal }); else { out = "Outil inconnu."; bad = true; } }
            catch (e) { out = "Erreur : " + ((e && e.message) || e); bad = true; }
            if (signal && signal.aborted) throw err("cancelled", "", text);
            var res = { type: "tool_result", tool_use_id: c.id, content: typeof out === "string" ? out : JSON.stringify(out === undefined ? null : out) };
            if (bad) res.is_error = true;
            results.push(res);
          }
          msgs.push({ role: "user", content: results });
          continue;
        }
        break;
      }
      if (!text.trim()) throw err("empty_completion");
      if (json) { var v = parseJSON(finalText || text); if (v === undefined) throw err("invalid_json", "", text); return v; }
      return { text: text, truncated: stop === "max_tokens" };
    }
    var sample = function (input, opts) { return run(input, opts, false); };
    sample.json = function (input, opts) { return run(input, opts, true); };
    sample.limits = async function () { return { inputBytes: 400000, images: { maxCount: 3, maxBytes: 15 * 1024 * 1024, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] }, tools: true }; };
    return sample;
  }
  async function ready() {
    var S = window.SITE;
    if (!S || !S.fs || !S.auth || !S.auth.currentUser) return null;
    var relay = "";
    try { var d = await S.fs.doc("settings/app").get(); var s = d.exists ? d.data() : {}; relay = String((s && s.pay && s.pay.relay) || "").trim().replace(/\/+$/, ""); } catch (e) {}
    if (!relay || !okUrl(relay)) return null;
    try { var j = await getJSON(relay + "/ia/etat", 6000); if (!j || !j.ia) return null; } catch (e) { return null; }
    return make(relay);
  }
  /* appelé par claude.use("sample") du site ; on réessaie si le premier essai a eu lieu avant la connexion */
  window.__siteSample = function () {
    if (!promise) promise = ready().then(function (s) { if (!s) promise = null; return s; });
    return promise;
  };
  window.__siteIaState = async function (relay) {
    relay = String(relay || "").trim().replace(/\/+$/, "");
    if (!relay) return { state: "absent" };
    if (!okUrl(relay)) return { state: "adresse" };
    try { var j = await getJSON(relay + "/ia/etat", 6000); return !j ? { state: "injoignable" } : j.ia ? { state: "actif", quota: !!j.quota } : { state: "cle" }; }
    catch (e) { return { state: "injoignable" }; }
  };
})();
