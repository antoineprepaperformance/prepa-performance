// Aucun hook React apres un retour anticipe.
//
// Pourquoi : un composant qui sort tot (« if (ps.phase === "fini") return ... ») n'execute pas les hooks
// declares plus bas. Au rendu suivant React en compte moins qu'avant, et l'application entiere tombe sur
// « Un probleme d'affichage est survenu » (erreur React #300, « rendered fewer hooks than expected »).
// C'est arrive pour de vrai : le jour ou l'acces d'un client se terminait pendant qu'il avait sa page
// ouverte, « Today » basculait sur une branche courte declaree avant son useState.
//
// Regle : dans un composant (ou un hook maison), tous les hooks se declarent AVANT le premier return.
// Usage : node tools/verif_hooks.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as acorn from "acorn";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(APP, "src");
const FICHIERS = [...fs.readdirSync(SRC).filter((f) => f.endsWith(".js")).sort().map((f) => path.join(SRC, f)),
  ...fs.readdirSync(path.join(SRC, "site")).filter((f) => f.endsWith(".js")).sort().map((f) => path.join(SRC, "site", f))];
const EST_FN = (n) => n && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression");
const EST_HOOK = (n) => n.type === "CallExpression" && n.callee.type === "Identifier" && /^use[A-Z]/.test(n.callee.name);

/* parcourt le corps d'une fonction SANS entrer dans les fonctions imbriquees : seul ce niveau compte,
   car un return dans un callback (.map, useEffect…) ne sort pas du composant. */
function niveau(fn, visite) {
  const pile = Array.isArray(fn.body) ? [...fn.body] : [fn.body];
  while (pile.length) {
    const n = pile.shift();
    if (!n || typeof n.type !== "string") continue;
    visite(n);
    if (EST_FN(n)) continue;                       // on n'entre pas dans une fonction imbriquee
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) pile.push(...v.filter((x) => x && typeof x.type === "string"));
      else if (v && typeof v.type === "string") pile.push(v);
    }
  }
}

const soucis = [];
for (const f of FICHIERS) {
  const code = fs.readFileSync(f, "utf8");
  const lignes = code.split("\n");
  const ligneDe = (pos) => code.slice(0, pos).split("\n").length;
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", locations: false }); }
  catch (e) { console.log(`  (illisible : ${path.basename(f)} — ${e.message})`); continue; }
  const fns = [];
  (function trouve(n) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "FunctionDeclaration" && n.id) fns.push([n.id.name, n]);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(trouve);
      else if (v && typeof v.type === "string") trouve(v);
    }
  })(ast);
  for (const [nom, fn] of fns) {
    let premierRetour = null;
    const hooks = [];
    niveau(fn, (n) => {
      if (n.type === "ReturnStatement" && (premierRetour === null || n.start < premierRetour)) premierRetour = n.start;
      if (EST_HOOK(n)) hooks.push(n);
    });
    if (premierRetour === null) continue;
    const tardifs = hooks.filter((h) => h.start > premierRetour);
    if (tardifs.length) {
      const h = tardifs[0];
      soucis.push(`  ${path.basename(f)} · ${nom}() : retour ligne ${ligneDe(premierRetour)}, puis ${h.callee.name} ligne ${ligneDe(h.start)} → ${lignes[ligneDe(h.start) - 1].trim().slice(0, 70)}`);
    }
  }
}

if (!soucis.length) {
  console.log(`hooks : aucun hook apres un retour anticipe (${FICHIERS.length} fichiers)`);
  process.exit(0);
}
console.log("HOOKS APRES UN RETOUR ANTICIPE — l'application tombera sur « Un probleme d'affichage est survenu » :");
soucis.forEach((s) => console.log(s));
console.log("Remonte ces hooks avant le premier return du composant.");
process.exit(1);
