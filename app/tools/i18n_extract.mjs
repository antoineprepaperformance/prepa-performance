// Extraction des textes visibles de l'application (version client et site), pour la traduction anglaise et espagnole.
// Usage : node tools/i18n_extract.mjs            -> écrit i18n/_textes.json (toutes les clés, avec leur contexte)
//         node tools/i18n_extract.mjs --manque    -> liste les clés sans traduction dans i18n/en.json ou i18n/es.json
// Les textes sont repérés dans le code (gabarits html`…`, chaînes, concaténations « a » + x + « b » → motif « a{}b »)
// et dans content.json. L'espace coach (Antoine travaille en français) et les consignes envoyées à l'IA sont ignorés.
import fs from "fs";
import crypto from "crypto";
import path from "path";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(APP, "src");
/* 05_coach.js et 06_library.js : espace coach uniquement (en français) */
const COACH_FILES = new Set(["05_coach.js", "06_library.js", "24_finances.js"]);
const FILES = [...fs.readdirSync(SRC).filter((f) => f.endsWith(".js") && !COACH_FILES.has(f)).sort().map((f) => path.join(SRC, f)),
  ...fs.readdirSync(path.join(SRC, "site")).filter((f) => f.endsWith(".js")).sort().map((f) => path.join(SRC, "site", f))];

/* fonctions et constantes jamais vues par un client : espace coach, consignes de l'IA */
const SKIP_FN = new Set(["PlanEditor", "CodesView", "Library", "SettingsView", "CoachRulesAlert", "rulesForCoach", "DEFAULT_AI_RULES", "clientContext",
  "exerciseCatalog", "aiRules", "draftReply", "mealPrompt", "productPrompt", "weeklyReview", "TerrainLibrary", "ProfileFacts", "SiteIaStatus", "DbTestCard",
  "SiteAccessHowto", "makeTools", "recipePrompt", "videoPrompt", "COACH_NAV", "rowInfo", "accessCode", "importPackage", "deleteClient", "LiteNotice",
  "liteNoticeMail", "OwnerDash", "ClientsView", "ClientDetail", "ClientOverview", "AddClient", "DemoBar", "InboxView", "SignOutLink", "CoachMsg",
  "QUOTA_DOC", "IA_REGLES", "aiLang", "LANG_NAME", "aiTranslate", "TrLink", "TrSend", "LANG_FR", "langFr", "LEGAL_TR_NOTE", "siteSystemPrompt"]);
const SKIP_CALL = /^(console\.\w+|localStorage\.\w+|sessionStorage\.\w+|document\.(getElementById|querySelector|querySelectorAll|createElement)|\w+\.addEventListener|\w+\.removeEventListener|fetch|require|new RegExp|RegExp|\w*\.?collection|\w*\.?doc|dbSet|dbDel|dbWrite|qwrite|lsGet|lsSet|lsDel|setItem|getItem|removeItem|ciqLoad|matchMedia|new CustomEvent|CustomEvent|new Error|Error|postMessage|importScripts|caches\.open|navigator\.\w+|JSON\.parse|parseISO|Date\.parse|new Date|Intl\.\w+)$/;
const SKIP_PROP = new Set(["className", "id", "key", "type", "inputMode", "autoComplete", "rel", "target", "href", "src", "role", "viewBox", "fill", "stroke",
  "kind", "code", "k", "v", "icon", "mode", "status", "period", "offer", "lmode", "model", "modelTier", "description", "inputSchema", "name", "tone", "anim",
  "cat", "lieu_id", "sport", "sportId", "poste", "unit", "u", "path", "url", "file", "ext", "media_type", "tag", "cls", "event", "via", "channel"]);
const SKIP_ATTR = new Set(["className", "id", "key", "type", "href", "src", "rel", "target", "role", "viewBox", "fill", "stroke", "strokeWidth", "inputMode",
  "autoComplete", "htmlFor", "name", "style", "tone", "kind", "size", "rows", "maxLength", "accept", "capture", "x", "y", "width", "height", "cx", "cy", "r", "points",
  "transform", "textAnchor", "fontSize", "fontWeight", "offset", "stopColor", "dx", "dy", "preserveAspectRatio", "xmlns", "method", "pattern", "min", "max", "step",
  "value", "x1", "x2", "y1", "y2", "rx", "ry", "strokeDasharray", "strokeLinecap", "strokeLinejoin", "opacity", "fillOpacity", "gradientTransform", "lang", "dir",
  "aria-hidden", "aria-live", "tabIndex", "download", "loading", "decoding", "colSpan", "rowSpan", "scope", "list", "form", "enterKeyHint", "spellCheck", "wrap", "idp"]);

export function norm(s) { return String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim(); }
/* texte destiné à être lu (et non identifiant, classe, adresse, code) */
export function isText(s0) {
  const s = norm(s0).replace(/\{\}/g, " ").trim();
  if (s.length < 2 || !/[A-Za-zÀ-ÿœŒ]{2}/.test(s)) return false;
  if (/^(https?:|mailto:|tel:|data:|blob:|www\.|\.\/|\/)/i.test(s) || /\.(js|css|png|jpe?g|svg|json|html|webmanifest)$/i.test(s)) return false;
  if (/[{}<>]|=>|&&|\|\||function\s*\(|\$\{/.test(s)) return false;
  if ((/^[#.@]/.test(s) && !/^\. [A-ZÀ-Ýa-zà-ÿ]/.test(s)) || /^[a-z]+(-[a-z0-9]+)+$/.test(s) || /^[a-z]+_[a-z0-9_]+$/.test(s)) return false;
  if (/^[\w-]+\/[\w\-/{}]*$/.test(s)) return false;                                  /* chemins clients/… */
  if (/^[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/.test(s)) return false;                      /* tracés SVG */
  if (/\((min|max)-(width|height)/.test(s) || /^[a-z0-9-]+( [a-z0-9-]+)*$/.test(s) && /-/.test(s)) return false;  /* classes CSS, requêtes média */
  if (/^(rgba?|hsla?|var|calc|url|translate|rotate|scale)\(/.test(s) || /^\d/.test(s) && !/[A-Za-zÀ-ÿ]{3}/.test(s)) return false;
  if (/(et al\.|doi:|\b(19|20)\d\d;\s*\d|J Strength|Med Sci Sports|Sports Med\.|https?:\/\/)/.test(s)) return false;  /* références d'études : gardées telles quelles */
  if (!/\s/.test(s)) {
    if (/[À-ÿœŒ]/.test(s)) return true;
    if (/^[A-ZÀ-Ý][a-zà-ÿœ']+[.!?…:]?$/.test(s)) return true;
    if (/^[A-Z][a-z]+[A-Z]/.test(s) || /^[a-z]/.test(s)) return false;
    return /^[A-Z]{2,}[a-z]*$/.test(s) ? false : /[a-z]{3}/.test(s);
  }
  return true;
}

const keys = new Map();
function add(k0, kind, ctx, where, force) {
  const k = norm(k0);
  if (!k || (!force && !isText(k))) return;
  const e = keys.get(k);
  if (e) { e.n++; return; }
  keys.set(k, { h: crypto.createHash("sha1").update(k).digest("hex").slice(0, 10), k, kind, ctx: ctx && ctx !== k ? norm(ctx).slice(0, 400) : undefined, where, n: 1 });
}

/* gabarit htm : textes entre les balises et valeurs d'attributs fixes */
function htmTemplate(quasis, where) {
  const M = "\u0001";
  const S = quasis.map((q) => q.value.cooked ?? q.value.raw).join(M);
  const ctx = S.replace(/\u0001/g, "{}").replace(/\s+/g, " ").slice(0, 400);
  let i = 0, text = "";
  const flushText = () => { if (text) text.split(M).forEach((p) => add(p, "text", ctx, where)); text = ""; };
  while (i < S.length) {
    const ch = S[i];
    if (ch === "<") {
      flushText();
      if (S.startsWith("<!--", i)) { const e = S.indexOf("-->", i); i = e < 0 ? S.length : e + 3; continue; }
      i++;
      /* nom de balise */
      while (i < S.length && !/[\s>/]/.test(S[i])) i++;
      /* attributs */
      while (i < S.length && S[i] !== ">") {
        if (/\s|\//.test(S[i])) { i++; continue; }
        let name = "";
        while (i < S.length && !/[\s=>/]/.test(S[i])) name += S[i++];
        if (S[i] === "=") {
          i++;
          const q = S[i];
          if (q === '"' || q === "'") {
            const e = S.indexOf(q, i + 1);
            const val = S.slice(i + 1, e < 0 ? S.length : e);
            i = e < 0 ? S.length : e + 1;
            if (!SKIP_ATTR.has(name.replace(/\u0001/g, "")) && !/^data-/.test(name) && !val.includes(M)) add(val, "attr", ctx, where);
          } else { while (i < S.length && !/[\s>]/.test(S[i])) i++; }
        }
      }
      i++;
    } else { text += ch; i++; }
  }
  flushText();
}

function calleeName(c) {
  if (!c) return "";
  if (c.type === "Identifier") return c.name;
  if (c.type === "MemberExpression") return (calleeName(c.object) ? calleeName(c.object) + "." : "") + (c.property.name || "");
  return "";
}
function enclosingSkipped(anc) {
  for (const a of anc) {
    if ((a.type === "FunctionDeclaration" || a.type === "FunctionExpression") && a.id && SKIP_FN.has(a.id.name)) return true;
    if (a.type === "VariableDeclarator" && a.id && a.id.name && SKIP_FN.has(a.id.name)) return true;
    if (a.type === "FunctionDeclaration" && a.id && /^Coach(?!Chat$)/.test(a.id.name)) return true;
  }
  return false;
}
function skipContext(node, anc) {
  if (enclosingSkipped(anc)) return true;
  const p = anc[anc.length - 2];
  if (!p) return false;
  if ((p.type === "CallExpression" || p.type === "NewExpression") && p.arguments.includes(node)) {
    const n = (p.type === "NewExpression" ? "new " : "") + calleeName(p.callee);
    if (SKIP_CALL.test(n) || SKIP_CALL.test(calleeName(p.callee))) return true;
  }
  if (p.type === "Property" && p.value === node) { const k = p.key.name || p.key.value; if (SKIP_PROP.has(k)) return true; }
  if (p.type === "Property" && p.key === node) return true;
  if (p.type === "MemberExpression" && p.property === node) return true;
  if (p.type === "BinaryExpression" && ["===", "!==", "==", "!=", "in"].includes(p.operator)) return true;
  if (p.type === "SwitchCase" && p.test === node) return true;
  if (p.type === "ImportDeclaration") return true;
  return false;
}

for (const file of FILES) {
  const code = fs.readFileSync(file, "utf8");
  const rel = path.relative(APP, file);
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", locations: true, allowReturnOutsideFunction: true }); }
  catch (e) { console.error("Analyse impossible : " + rel + " : " + e.message); process.exitCode = 1; continue; }
  const consumed = new Set();
  walk.fullAncestor(ast, (node, st, anc) => {
    const where = rel + ":" + (node.loc ? node.loc.start.line : 0);
    if (node.type === "TaggedTemplateExpression") {
      const tag = calleeName(node.tag);
      node.quasi.quasis.forEach((q) => consumed.add(q));
      consumed.add(node.quasi);
      if ((tag === "html" || tag === "_html") && !enclosingSkipped(anc)) htmTemplate(node.quasi.quasis, where);
      return;
    }
    if (node.type === "TemplateLiteral" && !consumed.has(node)) {
      if (skipContext(node, anc)) return;
      const pat = node.quasis.map((q) => q.value.cooked ?? q.value.raw).join("{}");
      add(pat, node.expressions.length ? "pattern" : "string", null, where);
      return;
    }
    if (node.type === "BinaryExpression" && node.operator === "+") {
      const p = anc[anc.length - 2];
      if (p && p.type === "BinaryExpression" && p.operator === "+") return;
      const ops = [];
      (function flat(n) { if (n.type === "BinaryExpression" && n.operator === "+") { flat(n.left); flat(n.right); } else ops.push(n); })(node);
      if (!ops.some((o) => o.type === "Literal" && typeof o.value === "string")) return;
      ops.forEach((o) => { if (o.type === "Literal") consumed.add(o); });
      if (skipContext(node, anc)) return;
      let pat = "";
      ops.forEach((o) => { if (o.type === "Literal" && typeof o.value === "string") pat += o.value; else if (!pat.endsWith("{}")) pat += "{}"; });  /* un nombre (« i + 1 ») est une valeur comme une autre */
      add(pat, ops.every((o) => o.type === "Literal") ? "string" : "pattern", null, where);
      return;
    }
    if (node.type === "Literal" && typeof node.value === "string" && !consumed.has(node)) {
      if (skipContext(node, anc)) return;
      add(node.value, "string", null, where);
    }
  });
}

/* contenu : programmes, exercices, recettes, séances terrain, conseils… */
const content = JSON.parse(fs.readFileSync(path.join(APP, "content.json"), "utf8"));
const SKIP_CKEY = new Set(["id", "anim", "url", "img", "src", "video", "yt", "ciq", "code", "CIQ", "version", "ref", "refs", "k", "type", "cat", "lieu_id", "SPORTKEYS", "CHECK_OF"]);
(function walkC(o, keyName, where) {
  if (typeof o === "string") { if (!SKIP_CKEY.has(keyName)) add(o, "content", null, where); return; }
  if (Array.isArray(o)) { o.forEach((x) => walkC(x, keyName, where)); return; }
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "CIQ" || k === "FOODS_CIQ") continue; walkC(v, k, where || "content:" + k); }
})(content, "", "");

/* textes composés pendant l'exécution, introuvables dans le code (abréviations de la carte, « et » entre deux noms, variante
   d'un texte) : liste tenue à la main dans i18n/_extra.json */
const EXTRA = path.join(APP, "i18n", "_extra.json");
if (fs.existsSync(EXTRA)) JSON.parse(fs.readFileSync(EXTRA, "utf8")).forEach((s) => add(s, "extra", null, "i18n/_extra.json", true));

const out = [...keys.values()].sort((a, b) => a.where.localeCompare(b.where, "fr", { numeric: true }));
const I18N = path.join(APP, "i18n");
fs.mkdirSync(I18N, { recursive: true });
if (process.argv.includes("--manque")) {
  let total = 0;
  for (const L of ["en", "es"]) {
    const f = path.join(I18N, L + ".json");
    const d = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
    const miss = out.filter((e) => !(e.h in d));
    total += miss.length;
    console.log(L + " : " + miss.length + " texte(s) sans traduction sur " + out.length);
    miss.slice(0, 40).forEach((e) => console.log("   " + JSON.stringify(e.k) + "   (" + e.where + ")"));
  }
  process.exit(total ? 1 : 0);
} else {
  fs.writeFileSync(path.join(I18N, "_textes.json"), JSON.stringify(out, null, 1));
  const chars = out.reduce((s, e) => s + e.k.length, 0);
  console.log(out.length + " textes, " + chars + " caractères -> i18n/_textes.json");
}
