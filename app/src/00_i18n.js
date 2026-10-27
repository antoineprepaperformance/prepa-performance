/* ===== Langues : français (langue d'origine), anglais, espagnol =====
   L'application est écrite en français. Pour une autre langue, chaque texte affiché est remplacé, au moment où il apparaît,
   par sa traduction (dictionnaire i18n/en.json, i18n/es.json, fait à partir des textes extraits par tools/i18n_extract.mjs).
   Les textes composés (« Semaine » + n + « sur » + m) sont reconnus par motifs « Semaine {} sur {} ».
   Rien n'est traduit dans les champs de saisie ni dans ce que les personnes écrivent (messages, notes). */
const LANGS = [{ id: "fr", n: "Français" }, { id: "en", n: "English" }, { id: "es", n: "Español" }];
const LANG = (() => {
  let l = null;
  try { const q = new URLSearchParams(location.search).get("lang"); if (q) { l = q; try { localStorage.setItem("lang", q); } catch (e) {} } } catch (e) {}
  if (!l) { try { l = localStorage.getItem("lang"); } catch (e) {} }
  return LANGS.some((x) => x.id === l) ? l : "fr";
})();
const LOCALE = { fr: "fr-FR", en: "en-GB", es: "es-ES" }[LANG];
/* lettre des semaines (S1 en français et en espagnol, W1 en anglais) */
const WK = LANG === "en" ? "W" : "S";
/* langue proposée d'après le navigateur, si la personne n'a encore rien choisi */
function langSuggest() {
  try { if (localStorage.getItem("lang") || localStorage.getItem("lang_vu") || navigator.webdriver) return null; } catch (e) { return null; }
  const n = String((navigator.languages && navigator.languages[0]) || navigator.language || "").slice(0, 2).toLowerCase();
  return n === "en" || n === "es" ? n : null;
}
function setLang(l) {
  if (!LANGS.some((x) => x.id === l)) return;
  let stored = false;
  try { localStorage.setItem("lang", l); stored = localStorage.getItem("lang") === l; } catch (e) {}
  try { const u = new URL(location.href); u.searchParams.delete("lang"); if (!stored) u.searchParams.set("lang", l); location.replace(u.toString()); } catch (e) { location.reload(); }
}

let I18N = null;
const I18N_NORM = (s) => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
/* textes qui ne diffèrent que par leurs nombres (« 2 × 12/jambe » quand le profil retire une série) : clé où chaque nombre devient # */
const I18N_NUM = (s) => s.replace(/\d+/g, "#");
const I18N_NUMS = (s) => s.match(/\d+/g) || [];
function i18nCompile(dict) {
  const exact = new Map(), buckets = new Map(), loose = [], nums = new Map();
  for (const [k, t] of Object.entries(dict || {})) {
    if (typeof t !== "string" || !t) continue;
    if (!/\{#?\}/.test(k)) {
      exact.set(k, t);
      const nk = I18N_NUMS(k);
      if (nk.length && I18N_NUMS(t).length === nk.length && !/^[\d\s.,:/×x%-]*$/.test(k)) {
        /* plusieurs traductions pour la même forme (« 1 mois » / « 2 mois ») : on garde celle des nombres à 1 et celle des autres */
        const key = I18N_NUM(k), ones = nk.map((x) => x === "1").join(), list = nums.get(key) || [];
        if (!list.some((x) => x.ones === ones)) list.push({ t, ones });
        nums.set(key, list);
      }
      continue;
    }
    /* {} : n'importe quel morceau (sans franchir « · » ni « — ») ; {#} : un nombre */
    const parts = k.split(/(\{#?\})/);
    const re = new RegExp("^" + parts.map((p) => p === "{}" ? "((?:(?! · | — ).)*?)" : p === "{#}" ? "(\\d[\\d\\s.,/\u00a0\u202f]*)" : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("") + "$");
    const lits = parts.filter((p) => !/^\{#?\}$/.test(p));
    const head = parts[0].slice(0, 3).toLowerCase();
    const p = { re, t, n: parts.length - lits.length, words: /[A-Za-zÀ-ÿœ]/.test(lits.join("")) };
    if (head.length === 3) { if (!buckets.has(head)) buckets.set(head, []); buckets.get(head).push(p); } else loose.push(p);
  }
  for (const list of buckets.values()) list.sort((a, b) => b.re.source.length - a.re.source.length);
  loose.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exact, buckets, loose, nums };
}
function i18nCore(s, depth) {
  if (!I18N || !s) return null;
  const e = I18N.exact.get(s);
  if (e !== undefined) return e;
  /* même texte en début de phrase (majuscule, point final) : « Garder son poids… » pour « garder son poids… » */
  if (depth === 0 && /^[A-ZÀ-Ý]/.test(s)) {
    const b = s.replace(/\.$/, ""), low = b.charAt(0).toLowerCase() + b.slice(1), e2 = I18N.exact.get(low);
    if (e2 !== undefined) return e2.charAt(0).toUpperCase() + e2.slice(1) + (b !== s ? "." : "");
  }
  /* nom repris en minuscules dans une phrase (« prochaine séance : renforcement 1 ») */
  if (/^[a-zà-ÿ]/.test(s)) {
    const e3 = I18N.exact.get(s.charAt(0).toUpperCase() + s.slice(1));
    if (e3 !== undefined) return e3.charAt(0).toLowerCase() + e3.slice(1);
  }
  if (!/[A-Za-zÀ-ÿœ]/.test(s)) return null;
  const cands = [...(I18N.buckets.get(s.slice(0, 3).toLowerCase()) || []), ...I18N.loose];
  let partial = null;
  for (const p of cands) {
    const m = p.re.exec(s);
    if (!m) continue;
    let i = 0, hit = p.words, miss = false;
    const r = p.t.replace(/\{(\d*|#)\}/g, (_, d) => { if (d === "#") d = ""; const v = m[(d === "" ? i++ : Number(d)) + 1]; if (v === undefined) return ""; const tv = depth < 3 && v ? i18nCore(I18N_NORM(v), depth + 1) : null; if (tv === null || tv === undefined) { if (/[A-Za-zÀ-ÖØ-öø-ÿœ]/.test(v)) miss = true; return v; } hit = true; return tv; });
    /* motif sans mot à lui (« {} ({}) ») : utile seulement si un morceau a été traduit ; gardé en dernier recours
       s'il laisse un morceau en français (« 1 × 5/côté (levier court) » se traduit mieux d'après « 2 × 5/côté (levier court) ») */
    if (hit && (p.words || !miss)) return r;
    if (hit && partial === null) partial = r;
  }
  /* même texte avec d'autres nombres */
  if (/\d/.test(s)) {
    const list = I18N.nums.get(I18N_NUM(s));
    if (list) {
      const v = I18N_NUMS(s), ones = v.map((x) => x === "1").join();
      /* singulier et pluriel : une forme avec les mêmes « 1 » (sinon « 1 months »), ou une autre si les nombres
         qui diffèrent ne sont pas suivis d'un mot (« 1 × 6/côté » d'après « 3 × 6/côté ») ou d'une unité (« 1 s ») */
      const freeOnes = (o) => { let j = 0, ok = true; s.replace(/\d+/g, (d, at) => { const one = o[j++] === "true", rest = s.slice(at + d.length); if ((d === "1") !== one && /^\s?[A-Za-zÀ-ÖØ-öø-ÿœ]/.test(rest) && !/^\s?(s|min|h|kg|g|km|m|cm|mm|kcal|L)(?![A-Za-zÀ-ÖØ-öø-ÿœ])/.test(rest)) ok = false; return d; }); return ok; };
      const nm = list.find((x) => x.ones === ones) || list.find((x) => freeOnes(x.ones.split(",")));
      if (nm) { let i = 0; return nm.t.replace(/\d+/g, () => v[i++]); }
    }
  }
  if (partial !== null) return partial;
  /* morceau qui commence par un séparateur (« · maison ») */
  const lead = /^([·—–] )(.+)$/.exec(s);
  if (lead && depth < 3) { const t = i18nCore(lead[2], depth + 1); if (t !== null && t !== undefined) return lead[1] + t; }
  /* texte fait de morceaux séparés par « · », « — » ou « : » */
  if (depth < 2) {
    const parts = s.split(/( · | — | – | : |\. )/);
    if (parts.length > 1) {
      let any = false;
      const out = parts.map((x, i) => {
        if (/^( · | — | – | : |\. )$/.test(x)) return x === " : " && LANG !== "fr" ? ": " : x;
        const y = I18N_NORM(x); if (!y) return x;
        let t = i18nCore(y, depth + 1);
        /* morceau connu seulement avec ses deux-points devant (« : tes charges… ») */
        if ((t === null || t === undefined) && parts[i - 1] === " : ") { const t2 = i18nCore(": " + y, depth + 1); if (t2 !== null && t2 !== undefined) t = t2.replace(/^\s*:\s*/, ""); }
        if (t !== null && t !== undefined) { any = true; return t; }
        return x;
      });
      if (any) return out.join("");
    }
    /* liste « A, B, C » : seulement si chaque élément est connu */
    if (s.includes(", ")) {
      const items = s.split(", ");
      const tt = items.map((x) => i18nCore(I18N_NORM(x), depth + 1));
      if (tt.every((x) => x !== null && x !== undefined)) return tt.join(", ");
    }
  }
  return null;
}
/* traduction d'un texte (pour le code : synthèse vocale, titres…) */
function tr(s) { if (LANG === "fr" || !I18N || s === null || s === undefined) return s; const raw = String(s); const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/); const t = i18nCore(I18N_NORM(m[2]), 0); return t === null || t === undefined ? raw : m[1] + t + m[3]; }

/* ---------- traduction de la page, au fil de l'affichage ---------- */
const I18N_ATTRS = ["placeholder", "title", "aria-label", "alt"];
const I18N_DONE = new WeakMap(), I18N_ADONE = new WeakMap();
const I18N_SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
function i18nSkip(el) { return !el || I18N_SKIP.has(el.nodeName) || (el.closest && el.closest("[data-notr],.notr,[contenteditable]")); }
function i18nText(n) {
  const v = n.nodeValue;
  if (!v || I18N_DONE.get(n) === v) return;
  if (i18nSkip(n.parentNode)) return;
  const t = tr(v);
  I18N_DONE.set(n, t);
  if (t !== v) n.nodeValue = t;
}
function i18nAttrs(el) {
  if (!el || !el.closest || el.closest("[data-notr],.notr")) return;
  let done = I18N_ADONE.get(el);
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const v = el.getAttribute(a);
    if (done && done[a] === v) continue;
    const t = tr(v);
    if (!done) { done = {}; I18N_ADONE.set(el, done); }
    done[a] = t;
    if (t !== v) el.setAttribute(a, t);
  }
}
function i18nWalk(root) {
  if (root.nodeType === 3) { i18nText(root); return; }
  if (root.nodeType !== 1 || i18nSkip(root)) return;
  i18nAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
  let n = w.nextNode();
  while (n) { if (n.nodeType === 3) i18nText(n); else i18nAttrs(n); n = w.nextNode(); }
}
function i18nStart() {
  if (LANG === "fr" || !I18N || typeof MutationObserver === "undefined") return;
  i18nWalk(document.body);
  if (document.title) document.title = tr(document.title);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") i18nText(m.target);
      else if (m.type === "attributes") i18nAttrs(m.target);
      else m.addedNodes.forEach((x) => i18nWalk(x));
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}
/* dictionnaire : intégré à la page (version Claude) ou fichier i18n_xx.json (site) */
const I18N_READY = (async () => {
  try { document.documentElement.lang = LANG; } catch (e) {}
  if (LANG === "fr") return;
  let d = null;
  const el = document.getElementById("i18n-" + LANG);
  if (el) { try { d = JSON.parse(el.textContent); } catch (e) { d = null; } }
  if (!d && typeof fetch === "function") {
    try { const ctl = typeof AbortController === "function" ? new AbortController() : null; const to = setTimeout(() => ctl && ctl.abort(), 6000); const r = await fetch("i18n_" + LANG + ".json", ctl ? { signal: ctl.signal } : {}); clearTimeout(to); if (r.ok) d = await r.json(); } catch (e) { d = null; }
  }
  if (d) I18N = i18nCompile(d);
})();
