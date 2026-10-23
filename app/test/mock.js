(function () {
  const KEY = "__mockdb";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  let store = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(store));
  const listeners = new Set();
  const notify = () => { store = load(); listeners.forEach((l) => l()); };
  window.addEventListener("storage", (e) => { if (e.key === KEY) notify(); });
  const params = new URLSearchParams(location.search);
  const as = params.get("as") || "owner";
  const ro = params.get("ro") === "1";
  const nodb = params.get("nodb") === "1";
  const uid = as === "owner" ? "u_owner" : "u_" + as;
  const cp = (o) => JSON.parse(JSON.stringify(o));
  function canRead(path) {
    if (as === "owner") return true;
    const seg = path.split("/");
    if (["clients", "plans", "replies"].includes(seg[0])) return seg[1] === uid;
    if (seg[0] === "coachnotes" || seg[0] === "codes") return false;
    return true;
  }
  function canWrite(path) {
    if (as === "owner") return true;
    if (ro) return false;
    const seg = path.split("/");
    return (seg[0] === "clients" && seg[1] === uid) || seg[0] === "products";
  }
  function docSnap(path) { const d = canRead(path) ? store[path] : undefined; return { id: path.split("/").pop(), exists: !!d, data: () => (d ? cp(d) : undefined), metadata: { fromCache: false, hasPendingWrites: false } }; }
  function colDocs(path) { const n = path.split("/").length; return Object.keys(store).filter((k) => k.startsWith(path + "/") && k.split("/").length === n + 1 && canRead(k)).sort().map(docSnap); }
  function err(code) { return Object.assign(new Error(code), { code }); }
  function write(path, fn) { if (!canWrite(path)) return Promise.reject(err("invalid_argument")); store = load(); fn(); save(); setTimeout(notify, 0); return Promise.resolve(); }
  function docRef(path) {
    if (path.split("/").length % 2) throw new TypeError("doc path parity: " + path);
    return { id: path.split("/").pop(), path,
      get: async () => docSnap(path),
      set: (v) => write(path, () => { store[path] = cp(v); }),
      update: (v) => write(path, () => { if (!store[path]) throw err("invalid_argument"); store[path] = { ...store[path], ...cp(v) }; }),
      delete: () => write(path, () => { delete store[path]; }),
      onSnapshot: (next) => { const f = () => next(docSnap(path)); listeners.add(f); setTimeout(f, 5); return () => listeners.delete(f); },
      collection: (p) => colRef(path + "/" + p) };
  }
  function colRef(path) {
    if (path.split("/").length % 2 === 0) throw new TypeError("collection path parity: " + path);
    const q = { path, doc: (id) => docRef(path + "/" + (id || Math.random().toString(36).slice(2))),
      add: async (v) => { const r = docRef(path + "/" + Math.random().toString(36).slice(2)); await r.set(v); return r; },
      where: () => q, orderBy: () => q, limit: () => q,
      get: async () => { const docs = colDocs(path); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; },
      onSnapshot: (next) => { const f = () => { const docs = colDocs(path); next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }); }; listeners.add(f); setTimeout(f, 5); return () => listeners.delete(f); } };
    return q;
  }
  const db = { doc: docRef, collection: colRef };
  const user = { isOwner: async () => as === "owner", canEdit: async () => as === "owner", can: async () => null, id: async () => uid,
    me: async () => ({ id: uid, name: "", email: null, isOwner: as === "owner", canEdit: as === "owner", avatarUrl: "", color: "#888" }), profiles: async () => ({}) };
  const downloads = { save: async (o) => { window.__lastDownload = o; return { ok: true }; } };
  window.__ZXING_URL = "vendor/zxing.min.js";
  const nosample = params.get("nosample") === "1";
  const notools = params.get("notools") === "1";
  function mkSample() {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const sig = () => ({ signal: new AbortController().signal });
    async function run(input, opts) {
      opts = opts || {};
      const all = typeof input === "string" ? input : input.map((t) => t.content).join("\n\n");
      const last = typeof input === "string" ? input : input[input.length - 1].content;
      window.__prompts = (window.__prompts || []).concat([{ all, tools: (opts.tools || []).map((t) => t.name), images: opts.images ? opts.images.length || 1 : 0 }]);
      await delay(120);
      let text;
      if (/Tâche : analyse_photo_repas/.test(all)) text = JSON.stringify({ titre: "Poulet, riz et brocolis", items: [{ n: "Blanc de poulet", g: 150, kcal: 165, p: 35, c: 0, f: 3 }, { n: "Riz basmati cuit", g: 180, kcal: 230, p: 5, c: 50, f: 1 }, { n: "Brocolis", g: 120, kcal: 40, p: 3, c: 5, f: 0.5 }, { n: "Huile d'olive", g: 10, kcal: 90, p: 0, c: 0, f: 10 }], confiance: "moyenne", verdict: "bon", commentaire: "Repas complet et riche en protéines, parfait pour ta cible.", conseil: "Ajoute un fruit si tu as encore faim." });
      else if (/Tâche : estimation_repas_texte/.test(all)) text = JSON.stringify({ titre: "Œufs brouillés et pain complet", items: [{ n: "Œufs brouillés", g: 110, kcal: 170, p: 13, c: 1, f: 12 }, { n: "Pain complet", g: 60, kcal: 150, p: 6, c: 26, f: 2 }], confiance: "bonne", verdict: "bon", commentaire: "Bon petit-déjeuner protéiné.", conseil: "" });
      else if (/Tâche : analyse_produit/.test(all)) text = JSON.stringify({ produit: "Skyr nature", marque: "Marque test", ean: null, lisible: true, estime: false, pour100: { kcal: 64, p: 11, c: 4, f: 0.2, sucres: 4, fibres: 0, sel: 0.1 }, portion_g: 150, nutriscore: "A", verdict: "bon", commentaire: "Excellente source de protéines pour ta collation.", alternative: null });
      else if (/Analyse la technique d'un client/.test(all)) text = JSON.stringify({ resume: "Bonne profondeur, le buste reste solide. Le genou part un peu vers l'intérieur à la remontée.", points: [{ point: "Genoux dans l'axe des pieds", ok: false, conseil: "Pousse les genoux vers l'extérieur en remontant." }, { point: "Dos neutre", ok: true, conseil: "Garde ce gainage." }], priorite: "Genoux dans l'axe des pieds.", securite: "" });
      else if (/Propose UNE recette simple pour un sportif/.test(all)) text = JSON.stringify({ n: "Bol poulet, riz et courgettes", temps: 20, ingredients: [{ nom: "blanc de poulet", g: 150 }, { nom: "riz basmati", g: 80 }, { nom: "courgette", g: 200 }, { nom: "huile d'olive", g: 10 }], etapes: ["Cuire le riz.", "Saisir le poulet en dés.", "Ajouter les courgettes en rondelles."], astuce: "Double les quantités pour le lendemain.", kcal: 620, p: 45, c: 70, f: 15 });
      else if (/Tâche : brouillon_reponse/.test(all)) text = "Belle semaine : tes séances sont faites et ton énergie remonte. Pour le vélo à la place du rameur, aucun souci : garde la même intensité.";
      else if (/Tâche : bilan_hebdo/.test(all)) {
        const t = (opts.tools || []).find((x) => x.name === "ajuster_nutrition");
        let r = "";
        if (t) { try { r = await t.execute({ kcal: 1200, proteines_g: 140, pas: 9000, raison: "Poids stable deux semaines" }, sig()); } catch (e) { r = "Error: " + e.message; } }
        text = "Bonne semaine de reprise.\n\nAjustement : " + r + "\n\nAntoine lira aussi ton bilan.";
      } else {
        if (/terrain/i.test(last)) {
          const t = (opts.tools || []).find((x) => x.name === "conseiller_seance_terrain");
          let r = "";
          if (t) { try { r = await t.execute({ seance: "r_malcolm", message: "Mercredi, à la place de la séance C", semaines: 1, raison: "Travail des efforts répétés avant le match" }, sig()); } catch (e) { r = "Error: " + e.message; } }
          text = "Cette semaine, fais les Malcolms : 3 séries de 6, départ toutes les 25 s.\n\n" + r;
        } else if (/genou/i.test(last)) {
          const ts = opts.tools || []; const out = [];
          const rep = ts.find((x) => x.name === "remplacer_exercice"), sg = ts.find((x) => x.name === "signaler_coach");
          if (rep) { try { out.push(await rep.execute({ exercice_actuel: "squat_goblet", nouvel_exercice: "pont_fessier", seance: "toutes", raison: "Gêne au genou signalée" }, sig())); } catch (e) { out.push("Error: " + e.message); } }
          if (sg) out.push(await sg.execute({ message: "Gêne au genou signalée dans le chat", urgence: "normale" }, sig()));
          text = "Je remplace le goblet squat par le pont fessier cette semaine.\n\n" + out.join(" ");
        } else text = "Ce soir, vise une assiette avec des protéines, des légumes et un féculent.";
      }
      if (opts.onText) { const h = text.slice(0, Math.ceil(text.length / 2)); opts.onText({ text: h, delta: h }); await delay(60); opts.onText({ text, delta: text.slice(h.length) }); }
      return { text, truncated: false, modelTierApplied: opts.modelTier || "default" };
    }
    const sample = (input, opts) => run(input, opts);
    sample.json = async (input, opts) => JSON.parse((await run(input, opts)).text);
    sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 20000000, mediaTypes: ["image/jpeg", "image/png"] }, ...(notools ? {} : { tools: { maxCount: 10 } }) });
    return sample;
  }
  const sampleFn = nosample ? null : mkSample();
  window.claude = { use: async (n) => { await new Promise((r) => setTimeout(r, 15)); if (nodb && n === "db") return null; return n === "db" ? db : n === "user" ? user : n === "downloads" ? downloads : n === "sample" ? sampleFn : null; } };
})();
