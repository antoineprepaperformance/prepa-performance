/* ===== Profil sportif : taille, poids, âge et records déclarés =====
   Les records sont facultatifs. Ceux qui correspondent à un test de l'application servent tout de suite :
   charges en % du maximum (à partir de 18 ans), allures à partir de la VMA et du 5 km, test de départ pré-rempli. */
const RECORDS = CONTENT.RECORDS || {}, REC_BASE = CONTENT.RECBASE || [], REC_SPORT = CONTENT.RECSPORT || {}, SCREEN_HINTS = CONTENT.SCREENHINTS || [];
const BODY_LIM = { height: [120, 230], weight: [30, 250] };
function bodyOk(k, v) { const n = num(v); return n !== null && n >= BODY_LIM[k][0] && n <= BODY_LIM[k][1]; }
/* « 22:30 », « 22.5 », « 1:45:10 », « 3 min 45 » → minutes */
function parseTemps(s) {
  const t = String(s ?? "").trim().replace(",", ".").toLowerCase();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  let m = t.match(/^(\d+)\s*(?:min|mn|')\s*(\d{1,2})?\s*(?:s|"|sec)?$/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  m = t.match(/^(\d+)\s*[:h]\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?$/);
  if (!m) return null;
  return m[3] !== undefined ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60 : Number(m[1]) + Number(m[2]) / 60;
}
function fmtTemps(min) {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  const s = Math.round(min * 60), h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? h + ":" + pad(mm) : String(mm)) + ":" + pad(ss);
}
/* maximum d'une charge levée « reps » fois : la charge elle-même pour 1 répétition, sinon Epley */
function recMax(kg, reps) { const k = num(kg), r = num(reps) || 1; if (!k || k <= 0) return null; return r <= 1 ? k : epley(k, r); }
function recKeys(sportId, minor) {
  const ks = [...REC_BASE, ...(REC_SPORT[sportId || ""] || REC_SPORT[""] || [])].filter((k, i, a) => RECORDS[k] && a.indexOf(k) === i);
  return minor ? ks.filter((k) => RECORDS[k].type !== "kg") : ks;
}
/* valeur utile d'un record : maximum en kg, nombre, ou minutes */
function recVal(k, r) {
  const d = RECORDS[k]; if (!d || !r) return null;
  if (d.type === "kg") return recMax(r.kg, r.reps);
  if (d.type === "temps") return parseTemps(r.v);
  const n = num(r.v); return n !== null && n > 0 ? n : null;
}
function recText(k, r) {
  const d = RECORDS[k]; if (!d || !r) return "";
  if (d.type === "kg") { const m = recMax(r.kg, r.reps); return fmtN(num(r.kg), 1) + " kg" + (num(r.reps) > 1 ? " × " + num(r.reps) + " (maximum estimé " + fmtN(m, 1) + " kg)" : ""); }
  if (d.type === "temps") return fmtTemps(parseTemps(r.v));
  return fmtN(num(r.v), 2) + " " + (d.u || "");
}
/* nettoie la saisie : seules les valeurs plausibles sont gardées */
function recClean(v) {
  const out = {};
  Object.entries(v || {}).forEach(([k, r]) => {
    if (k === "autres") return;
    const d = RECORDS[k]; if (!d || !r) return;
    if (d.type === "kg") { const kg = num(r.kg), reps = Math.round(num(r.reps) || 1); if (kg > 0 && kg < 500 && reps >= 1 && reps <= 12) out[k] = { kg, reps }; }
    else if (d.type === "temps") { const m = parseTemps(r.v); if (m && m > 0 && m < 600) out[k] = { v: fmtTemps(m) }; }
    else { const n = num(r.v); if (n !== null && n > 0 && n < 100000) out[k] = { v: n }; }
  });
  const autres = ((v && v.autres) || []).map((x) => ({ n: String(x.n || "").trim().slice(0, 60), v: String(x.v || "").trim().slice(0, 60) })).filter((x) => x.n && x.v).slice(0, 8);
  if (autres.length) out.autres = autres;
  return out;
}
function recCount(rec) { return Object.keys(rec || {}).filter((k) => k !== "autres").length + ((rec && rec.autres) || []).length; }
function recLines(rec) {
  const L = Object.keys(rec || {}).filter((k) => k !== "autres" && RECORDS[k]).map((k) => RECORDS[k].n + " : " + recText(k, rec[k]));
  ((rec && rec.autres) || []).forEach((x) => L.push(x.n + " : " + x.v));
  return L;
}
/* record déclaré correspondant à un test de l'application, au format du test */
function recForTest(p, tid) {
  const rec = (p && p.records) || {};
  const k = Object.keys(RECORDS).find((x) => RECORDS[x].test === tid && rec[x]);
  if (!k) return null;
  const d = RECORDS[k], v = recVal(k, rec[k]);
  if (v === null) return null;
  if (d.type === "kg") return { kg: num(rec[k].kg), reps: num(rec[k].reps) || 1, v };
  if (d.type === "temps") return d.sec ? Math.round(v * 60) : Math.round(v * 100) / 100;
  return d.k ? Math.round(v * d.k) : v;
}
/* maximum déclaré pour un exercice de la bibliothèque (18 ans et plus) */
function recE1rm(p, e) {
  const age = ageOf(p);
  if (!p || !p.records || (age !== null && age < 18)) return null;
  const tid = TEST_FOR_EX[e]; if (!tid) return null;
  const t = recForTest(p, tid); if (!t || !t.v) return null;
  return { v: t.v, date: String(p.recordsAt || p.createdAt || todayISO()).slice(0, 10), src: "record déclaré", reps: t.reps };
}

/* ---------- saisie des records ---------- */
function RecordsEditor({ value, onChange, sportId, minor }) {
  const v = value || {};
  const keys = recKeys(sportId, minor);
  const set = (k, patch) => onChange({ ...v, [k]: { ...(v[k] || {}), ...patch } });
  const autres = v.autres || [];
  const setA = (i, patch) => onChange({ ...v, autres: autres.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return html`<div className="recs">
    ${keys.map((k) => {
      const d = RECORDS[k], r = v[k] || {};
      const m = d.type === "kg" && num(r.reps) > 1 ? recMax(r.kg, r.reps) : null;
      return html`<div key=${k} className="rec-row"><label className="rec-n" htmlFor=${"rec-" + k}>${d.n}</label>
        ${d.type === "kg" ? html`<div className="rec-in"><input id=${"rec-" + k} inputMode="decimal" placeholder="kg" aria-label=${d.n + " : charge en kg"} value=${r.kg ?? ""} onChange=${(e) => set(k, { kg: e.target.value })} />
          <span className="muted small">×</span><input id=${"rec-" + k + "-r"} inputMode="numeric" placeholder="1" aria-label=${d.n + " : répétitions"} value=${r.reps ?? ""} onChange=${(e) => set(k, { reps: e.target.value.replace(/\D/g, "").slice(0, 2) })} /><span className="muted small">rép.</span></div>`
        : html`<div className="rec-in"><input id=${"rec-" + k} inputMode=${d.type === "temps" ? "text" : "decimal"} placeholder=${d.type === "temps" ? "min:s" : ""} aria-label=${d.n} value=${r.v ?? ""} onChange=${(e) => set(k, { v: e.target.value })} /><span className="muted small">${d.type === "temps" ? "" : d.u}</span></div>`}
        ${m ? html`<span className="rec-h small muted">maximum estimé ${fmtN(m, 1)} kg</span>` : null}</div>`;
    })}
    ${autres.map((x, i) => html`<div key=${"a" + i} className="rec-row rec-other"><input id=${"rec-autre-" + i} placeholder="Discipline (ex. développé incliné, 400 m)" aria-label="Autre discipline" value=${x.n} onChange=${(e) => setA(i, { n: e.target.value })} />
      <div className="rec-in"><input id=${"rec-autre-v-" + i} placeholder="Performance (ex. 80 kg × 5, 52 s)" aria-label="Performance" value=${x.v} onChange=${(e) => setA(i, { v: e.target.value })} />
      <button type="button" className="x sm" aria-label="Retirer cette performance" onClick=${() => onChange({ ...v, autres: autres.filter((_, j) => j !== i) })}>×</button></div></div>`)}
    ${autres.length < 8 ? html`<button type="button" className="linkbtn" id="rec-add" onClick=${() => onChange({ ...v, autres: [...autres, { n: "", v: "" }] })}>+ Ajouter une autre performance</button>` : null}
  </div>`;
}
function RecordsView({ p, empty }) {
  const L = recLines(p && p.records);
  if (!L.length) return empty ? html`<p className="muted small">${empty}</p>` : null;
  return html`<ul className="small rec-list">${L.map((l, i) => html`<li key=${i}>${l}</li>`)}</ul>`;
}
function bodyLine(p) {
  if (!p) return "";
  const age = ageOf(p);
  return [age !== null ? age + " ans" : null, num(p.height) ? fmtN(num(p.height), 0) + " cm" : null, num(p.weight) ? fmtN(num(p.weight), 1) + " kg" : null].filter(Boolean).join(" · ");
}
/* questionnaire santé : les « oui » avec leur précision */
function screeningLines(p) {
  return ((p && p.screening) || []).map((x, i) => (x ? SCREENING[i] + (p.screeningDetails && p.screeningDetails[i] ? " — « " + p.screeningDetails[i] + " »" : "") : null)).filter(Boolean);
}

/* fiche côté coach : âge, taille, poids et records */
function ProfileFacts({ p }) {
  return html`<div className="stack-s"><p className="small"><b>${bodyLine(p) || "Âge, taille et poids non renseignés"}</b>${p && p.weightAt ? html` <span className="muted">(poids du ${fmtD(p.weightAt)})</span>` : null}</p>
    <${RecordsView} p=${p} empty="Aucun record déclaré." /></div>`;
}

/* ---------- profil du client : mensurations et records, modifiables ---------- */
function BodyRecordsCard({ data, src }) {
  const toast = useToast();
  const p = data.profile || {};
  const [f, setF] = useState(null);
  const age = ageOf(p);
  const open = () => setF({ height: p.height ?? "", weight: p.weight ?? "", birthYear: p.birthYear ?? "", records: clone(p.records || {}) || {} });
  const yOk = (y) => { const n = num(y); return n && n > 1900 && n <= new Date().getFullYear() - 8; };
  const save = async () => {
    if (!bodyOk("height", f.height) || !bodyOk("weight", f.weight) || !yOk(f.birthYear)) { toast("Vérifie ta taille (cm), ton poids (kg) et ton année de naissance.", "warn"); return; }
    try { await src.setProfile({ ...p, height: num(f.height), weight: num(f.weight), weightAt: num(f.weight) !== num(p.weight) ? todayISO() : (p.weightAt || null), birthYear: num(f.birthYear), records: recClean(f.records), recordsAt: todayISO() }); toast("Profil enregistré.", "ok"); setF(null); }
    catch (e) { toast("Enregistrement impossible.", "bad"); }
  };
  return html`<${Card} title="Mon profil sportif" sub="Taille, poids, âge et records : ton programme s'en sert pour tes charges et tes allures" action=${src ? html`<${Btn} small kind="ghost" onClick=${open}>Modifier</${Btn}>` : null}>
    <p className="small">${bodyLine(p) || "Taille, poids et âge à compléter."}</p>
    <${RecordsView} p=${p} empty="Aucun record noté pour l'instant." />
    <${Modal} open=${!!f} title="Mon profil sportif" onClose=${() => setF(null)}>${f ? html`<div className="form">
      <div className="row4"><${Field} label="Taille (cm)" id="pr-h"><input id="pr-h" inputMode="numeric" value=${f.height} onChange=${(e) => setF({ ...f, height: e.target.value })} /></${Field}>
        <${Field} label="Poids (kg)" id="pr-w"><input id="pr-w" inputMode="decimal" value=${f.weight} onChange=${(e) => setF({ ...f, weight: e.target.value })} /></${Field}>
        <${Field} label="Année de naissance" id="pr-y"><input id="pr-y" inputMode="numeric" value=${f.birthYear} onChange=${(e) => setF({ ...f, birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></${Field}></div>
      <div className="field"><span className="field-l">Mes records</span><span className="field-h">Remplis seulement ce que tu connais. Une charge levée plusieurs fois suffit : le maximum est estimé (formule d'Epley).</span></div>
      <${RecordsEditor} value=${f.records} onChange=${(r) => setF({ ...f, records: r })} sportId=${p.sportId} minor=${age !== null && age < 18} />
      <div className="actions"><${Btn} onClick=${save}>Enregistrer</${Btn}><${Btn} kind="quiet" onClick=${() => setF(null)}>Annuler</${Btn}></div></div>` : null}</${Modal}>
  </${Card}>`;
}
