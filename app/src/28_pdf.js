/* ===== Séances en PDF : le coach dépose un PDF (programme Sur mesure, séance écrite à part), le client l'ouvre depuis son programme =====
   Gratuit : le fichier est rangé dans la base (Firestore, offre Spark) en morceaux de 800 000 caractères, dans le dossier du client
   (clients/{id}/pdfs pour la liste, clients/{id}/pdfparts pour le contenu, lu seulement à l'ouverture). 3 Mo au plus par fichier. */
const PDF_MAX = 3 * 1024 * 1024, PDF_CHUNK = 800000;
function pdfList(data) { return Object.entries((data && data.pdfs) || {}).filter(([, m]) => m && m.n).map(([id, m]) => ({ id, ...m })).sort((a, b) => (Number(a.w) || 99) - (Number(b.w) || 99) || String(b.at).localeCompare(String(a.at))); }
function pdfBlob(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: "application/pdf" });
}
function fileB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, "")); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
}
function pdfWhen(m) { return (m.w ? WK + m.w : "Tout le cycle") + " · " + fmtD(m.at); }

/* côté client : liste des PDF, ouverture en deux temps (le fichier est chargé, puis un vrai lien s'ouvre : les téléphones bloquent les fenêtres ouvertes après un délai) */
function ClientPdfs({ data, src }) {
  const toast = useToast();
  const list = pdfList(data);
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(null);
  useEffect(() => () => Object.values(open).forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} }), []);
  if (!list.length || !src || !src.loadPdf) return null;
  const load = async (m) => {
    setBusy(m.id);
    try {
      const b64 = await src.loadPdf(m.id, m.parts || 1);
      if (!b64) throw new Error("vide");
      setOpen((o) => ({ ...o, [m.id]: URL.createObjectURL(pdfBlob(b64)) }));
    } catch (e) { toast("Ouverture impossible : vérifie ta connexion et réessaie.", "warn"); }
    setBusy(null);
  };
  const fname = (m) => String(m.n).replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60) + ".pdf";
  return html`<${Card} title="Mes séances écrites par Antoine" sub="Les PDF qu'il a préparés pour toi : ouvre-les ici, ou télécharge-les pour la salle">
    <ul className="rlist">${list.map((m) => html`<li key=${m.id}><span className="stack-s"><b>${m.n}</b><span className="small muted">${pdfWhen(m)}${m.note ? " · " + m.note : ""}</span></span>
      ${open[m.id] ? html`<span className="btnrow"><a className="btn primary sm" href=${open[m.id]} target="_blank" rel="noopener">Afficher</a><a className="btn ghost sm" href=${open[m.id]} download=${fname(m)}>Télécharger</a></span>`
        : html`<${Btn} small onClick=${() => load(m)} disabled=${busy === m.id}>${busy === m.id ? "Chargement…" : "Ouvrir"}</${Btn}>`}</li>`)}</ul>
  </${Card}>`;
}

/* côté coach : déposer, nommer, rattacher à une semaine, retirer */
function CoachPdfs({ data, src, plan }) {
  const toast = useToast();
  const list = pdfList(data);
  const [f, setF] = useState({ file: null, n: "", w: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(null);
  const [fk, setFk] = useState(0);
  const weeks = plan ? plan.weeks : 12;
  const pick = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) { toast("Choisis un fichier PDF.", "warn"); e.target.value = ""; return; }
    if (file.size > PDF_MAX) { toast("Fichier trop lourd : 3 Mo au plus (exporte-le en « taille réduite »).", "warn"); e.target.value = ""; return; }
    setF((o) => ({ ...o, file, n: o.n || file.name.replace(/\.pdf$/i, "") }));
  };
  const send = async () => {
    if (!f.file || !f.n.trim()) { toast("Choisis un PDF et donne-lui un titre.", "warn"); return; }
    setBusy(true);
    try {
      const b64 = await fileB64(f.file);
      const parts = []; for (let i = 0; i < b64.length; i += PDF_CHUNK) parts.push(b64.slice(i, i + PDF_CHUNK));
      const id = "p" + Date.now().toString(36);
      await src.savePdf(id, { n: f.n.trim().slice(0, 80), w: num(f.w) || null, note: f.note.trim().slice(0, 140), at: nowISO(), size: f.file.size, by: "coach" }, parts);
      toast("PDF envoyé : ton client le trouve dans son programme.", "ok");
      setF({ file: null, n: "", w: "", note: "" }); setFk((k) => k + 1);
    } catch (e) { toast("Envoi impossible (connexion, ou fichier trop lourd pour cette version).", "bad"); }
    setBusy(false);
  };
  const del = async (m) => {
    if (sure !== m.id) { setSure(m.id); return; }
    setSure(null);
    try { await src.deletePdf(m.id, m.parts || 1); toast("PDF retiré.", "ok"); } catch (e) { toast("Suppression impossible.", "bad"); }
  };
  return html`<div className="stack">
    <${Card} title="Envoyer une séance en PDF" sub=${"Idéal pour le Sur mesure : ton client l'ouvre d'un clic dans son programme. 3 Mo au plus, gratuit." + (plan && plan.offer !== "surmesure" ? " (Ce client n'est pas en Sur mesure : il le verra quand même.)" : "")}>
      <div className="form">
        <${Field} label="Fichier PDF" id="pdf-file"><input key=${fk} id="pdf-file" type="file" accept="application/pdf,.pdf" onChange=${pick} /></${Field}>
        <${Field} label="Titre" id="pdf-n"><input id="pdf-n" value=${f.n} maxLength="80" placeholder="Bloc 2 · semaine type, séance terrain…" onChange=${(e) => setF({ ...f, n: e.target.value })} /></${Field}>
        <div className="row2"><${Field} label="Semaine" id="pdf-w"><select id="pdf-w" value=${f.w} onChange=${(e) => setF({ ...f, w: e.target.value })}>
            <option value="">Tout le cycle</option>${Array.from({ length: weeks }, (_, i) => html`<option key=${i} value=${i + 1}>Semaine ${i + 1}</option>`)}</select></${Field}>
          <${Field} label="Petit mot (facultatif)" id="pdf-note"><input id="pdf-note" value=${f.note} maxLength="140" onChange=${(e) => setF({ ...f, note: e.target.value })} /></${Field}></div>
        <div className="actions"><${Btn} onClick=${send} disabled=${busy || !f.file}>${busy ? "Envoi…" : "Envoyer au client"}</${Btn}></div>
      </div>
    </${Card}>
    <${Card} title="PDF de ce client" sub=${list.length ? list.length + " fichier" + (list.length > 1 ? "s" : "") : "Aucun pour l'instant"}>
      ${list.length ? html`<ul className="rlist">${list.map((m) => html`<li key=${m.id}><span className="stack-s"><b>${m.n}</b><span className="small muted">${pdfWhen(m)} · ${fmtN((m.size || 0) / 1048576, 1)} Mo${m.note ? " · " + m.note : ""}</span></span>
        <${Btn} small kind="quiet" onClick=${() => del(m)}>${sure === m.id ? "Confirmer le retrait" : "Retirer"}</${Btn}></li>`)}</ul>` : html`<p className="small muted">Les PDF envoyés apparaissent ici et dans l'onglet Programme du client.</p>`}
    </${Card}>
  </div>`;
}
