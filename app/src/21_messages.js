/* ===== Messagerie coach ↔ client et contacts directs ===== */
const MSG_ICON = "M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5";
const CAM_ICON = "M4 8h3.5l2-2.5h5l2 2.5H20v11H4zM12 16.5a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z";
function msgId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function msgConf(settings) { const m = (settings && settings.msg) || {}; return { on: m.on !== false, lite: m.lite === true }; }
/* Lite et Coach IA : messagerie fermée sauf si le coach l'ouvre (réglage « lite ») */
/* messagerie ouverte pour ce client ? (réglage du coach ; Lite seulement si le coach l'a ouverte) */
function msgOpen(settings, plan) { const c = msgConf(settings); return c.on && !(plan && (plan.offer === "lite" || offerAuto(plan.offer)) && !c.lite); }
function msgList(data) { return Object.entries((data && data.messages) || {}).map(([id, m]) => ({ id, ...m })).filter((m) => m && m.at).sort((a, b) => String(a.at).localeCompare(String(b.at))); }
function msgUnreadClient(data) { const seen = (data && data.msgseen && data.msgseen.at) || ""; return msgList(data).filter((m) => m.from === "coach" && String(m.at) > seen).length; }
function msgUnreadCoach(profile, seen) { const at = profile && profile.sum && profile.sum.msgAt; return !!at && (!seen || String(at) > String(seen)); }
function msgTime(at) {
  const d = new Date(at); if (isNaN(d)) return "";
  const hm = d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  const day = isoOf(d) === todayISO() ? "" : d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" }) + " · ";
  return day + hm;
}
/* pastille de l'application installée (iPhone, Android, ordinateur) */
function useAppBadge(n) {
  useEffect(() => { try { if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {}); else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {}); } catch (e) {} }, [n]);
}
/* contact : uniquement par écrit (messagerie de l'application, et Instagram en message pour les visiteurs) — pas d'appel */
function igLink(h) { const v = String(h || "").trim(); if (!v) return ""; if (/^https?:\/\//.test(v)) return v; return "https://instagram.com/" + v.replace(/^@/, "").replace(/[^\w.]/g, ""); }
function contactItems(coach) {
  const c = coach || {};
  return c.instagram ? [{ k: "ig", n: "Message Instagram", href: igLink(c.instagram) }] : [];
}
function ContactLinks({ coach, small }) {
  const items = contactItems(coach);
  if (!items.length) return null;
  return html`<div className=${"contact-links" + (small ? " sm" : "")}>${items.map((x) => html`<a key=${x.k} className=${"btn ghost sm cl-" + x.k} href=${x.href} target="_blank" rel="noopener">${x.n}</a>`)}</div>`;
}
/* photo jointe : réduite pour tenir dans un document de la base (moins de 240 Ko) */
async function msgPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let side = 1100, q = 0.72, out = "";
    for (let k = 0; k < 6; k++) {
      const s = Math.min(1, side / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * s)); c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL("image/jpeg", q);
      if (out.length <= 240000) return out;
      side = Math.round(side * 0.8); q = Math.max(0.5, q - 0.06);
    }
    return out.length <= 240000 ? out : "";
  } finally { URL.revokeObjectURL(url); }
}
/* fil de discussion (côté client ou côté coach) */
function MessageThread({ data, src, me, other, onSeen, demo, lang }) {
  const foreign = me === "coach" && lang && lang !== "fr";
  const toast = useToast();
  const [txt, setTxt] = useState("");
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const list = msgList(data);
  const lastOther = list.filter((m) => m.from !== me).slice(-1)[0];
  useEffect(() => { try { endRef.current && endRef.current.scrollIntoView({ block: "end" }); } catch (e) {} }, [list.length]);
  useEffect(() => { if (lastOther && onSeen) onSeen(lastOther.at); }, [lastOther && lastOther.at]);
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { const d = await msgPhoto(f); if (!d) { toast("Photo trop lourde : essaie une autre photo.", "warn"); return; } setImg(d); } catch (x) { toast("Photo illisible : essaie une autre photo (JPEG ou PNG).", "warn"); }
  };
  const send = async () => {
    const t = txt.trim().slice(0, 2000);
    if (!t && !img) return;
    if (demo) { toast("Les exemples ne sont pas enregistrés.", "warn"); return; }
    setBusy(true);
    const id = msgId();
    try { await src.sendMessage(id, { from: me, text: t, ...(img ? { img } : {}), at: nowISO() }); setTxt(""); setImg(""); }
    catch (e) { toast("Message non envoyé" + errWhy(e, me === "coach"), "bad"); }
    finally { setBusy(false); }
  };
  return html`<div className="mthread">
    <div className="msgs" aria-live="polite">
      ${list.length ? null : html`<p className="muted small center">${me === "client" ? "Écris ton premier message à " + other + " : une question sur une séance, une douleur, ton organisation…" : "Aucun message pour l'instant."}</p>`}
      ${list.map((m) => html`<div key=${m.id} className=${"msg " + (m.from === me ? "u" : "a")}>
        ${m.img ? html`<button type="button" className="msg-img" onClick=${() => setZoom(m.img)} aria-label="Agrandir la photo"><img src=${m.img} alt="Photo envoyée" /></button>` : null}
        ${m.text ? String(m.text).split(/\n{2,}/).map((para, k) => html`<p key=${k} data-notr="1">${para}</p>`) : null}
        ${foreign && m.text && m.from !== me ? html`<${TrLink} text=${m.text} />` : null}
        <span className="msg-t">${m.from === me ? "Toi" : other} · ${msgTime(m.at)}</span></div>`)}
      <div ref=${endRef}></div>
    </div>
    ${img ? html`<div className="msg-prev"><img src=${img} alt="Photo à envoyer" /><button type="button" className="linkbtn" onClick=${() => setImg("")}>Retirer la photo</button></div>` : null}
    ${foreign ? html`<${TrSend} text=${txt} setText=${setTxt} to=${lang} id="msg-trad" />` : null}
    <div className="composer">
      <input ref=${fileRef} type="file" accept="image/*" className="sr-only" id=${"msg-file-" + me} onChange=${pick} />
      <button type="button" className="msgbtn msg-photo" aria-label="Joindre une photo" title="Joindre une photo" onClick=${() => fileRef.current && fileRef.current.click()} disabled=${busy}><${Icon} d=${CAM_ICON} /></button>
      <textarea id=${"msg-in-" + me} rows="2" value=${txt} maxLength="2000" placeholder=${me === "client" ? "Écris à " + other + "…" : "Ta réponse…"} onChange=${(e) => setTxt(e.target.value)}
        onKeyDown=${(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); send(); } }} disabled=${busy}></textarea>
      <${Btn} onClick=${send} disabled=${busy || (!txt.trim() && !img)}>${busy ? "Envoi…" : "Envoyer"}</${Btn}>
    </div>
    <${Modal} open=${!!zoom} wide title="Photo" onClose=${() => setZoom(null)}>${zoom ? html`<img className="msg-zoom" src=${zoom} alt="Photo" />` : null}</${Modal}>
  </div>`;
}
/* écran Messages du client */
function MessagesScreen({ data, src, settings, plan, coach, onClose, demo }) {
  const name = (coach && coach.name) || COACH_NAME_DEFAULT;
  const open = msgOpen(settings, plan) && src && typeof src.sendMessage === "function" && src.mode !== "local";
  const legal = (settings && settings.legal) || {};
  const seenRef = useRef("");
  const onSeen = (at) => { const cur = (data.msgseen && data.msgseen.at) || ""; if (demo || !at || at <= cur || seenRef.current >= at) return; seenRef.current = at; src.setMsgSeen(at).catch(() => {}); };
  return html`<div className="chat msgscreen">
    <header className="p-top"><button type="button" className="back" onClick=${onClose} aria-label="Retour">‹</button>
      <div><div className="eyebrow">Messagerie privée</div><h2>${name}</h2></div></header>
    ${open ? html`<p className="muted small">${name} te répond dès que possible, en général dans la journée. Pour une urgence médicale, appelle le 15 ou le 112.</p>
      <${MessageThread} data=${data} src=${src} me="client" other=${name} onSeen=${onSeen} demo=${demo} />`
      : html`<${Card} title="Messagerie"><p className="small">${(plan && plan.offer === "lite" ? "La messagerie avec " + name + " n'est pas incluse dans le forfait Lite." : plan && offerAuto(plan.offer) ? "La messagerie avec " + name + " n'est pas incluse dans la formule Coach IA : pose tes questions au coach IA." : "La messagerie n'est pas disponible pour le moment.") + (legal.email ? " Pour une question sur ton abonnement ou ton accès : " + legal.email + "." : "")}</p></${Card}>`}
  </div>`;
}
/* bouton d'en-tête du client (avec le nombre de messages non lus) */
function MsgButton({ n, onClick }) {
  return html`<button type="button" className="msgbtn" aria-label=${n ? n + " message" + (n > 1 ? "s" : "") + " non lu" + (n > 1 ? "s" : "") : "Messages"} onClick=${onClick}>
    <${Icon} d=${MSG_ICON} />${n ? html`<span className="msgbtn-n">${n > 9 ? "9+" : n}</span>` : null}</button>`;
}
/* boîte de réception du coach */
function CoachInbox({ rows, seen, openClient }) {
  const list = rows.filter((r) => !r.demo).map((r) => ({ r, at: (r.profile.sum && r.profile.sum.msgAt) || "", unread: msgUnreadCoach(r.profile, seen[r.cid]) }))
    .filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const others = rows.filter((r) => !r.demo && !(r.profile.sum && r.profile.sum.msgAt)).sort((a, b) => String((a.profile.name || "")).localeCompare(String(b.profile.name || "")));
  return html`<div className="stack">
    <header className="page-h"><div><h1>Messages</h1><p className="muted">Tes échanges avec tes clients, dans l'application. Ils voient ta réponse dès qu'ils l'ouvrent.</p></div></header>
    ${list.length ? html`<div className="slist">${list.map(({ r, at, unread }) => html`<button key=${r.cid} type="button" className=${"srow inbox-row" + (unread ? " unread" : "")} onClick=${() => openClient(r.cid, "messages")}>
      <span className="srow-id"><${Avatar} profile=${r.profile} size=${34} /></span>
      <span className="srow-t"><b>${r.profile.name || "Client"}${unread ? html` <${Pill} tone="gold">Nouveau</${Pill}>` : null}</b><span className="muted small">${(r.profile.sum && r.profile.sum.msgText) || ""}</span></span>
      <span className="srow-s small muted">${msgTime(at)}</span></button>`)}</div>` : html`<${Empty} title="Aucun message reçu" text="Quand un client t'écrit depuis son application, la conversation apparaît ici." />`}
    ${others.length ? html`<${Card} title="Écrire à un client"><div className="chips">${others.map((r) => html`<button key=${r.cid} type="button" className="chipbtn" onClick=${() => openClient(r.cid, "messages")}>${r.profile.name || "Client"}</button>`)}</div></${Card}>` : null}
  </div>`;
}
/* fil côté coach, dans la fiche du client */
function CoachMessages({ data, src, cid, seenAt, db, demo, name }) {
  const onSeen = (at) => {
    if (demo || !db || !at || (seenAt && String(seenAt) >= String(at))) return;
    try { db.doc("coachnotes/_inbox").get().then((s) => { const cur = (s.exists && s.data()) || {}; const seen = { ...(cur.seen || {}) }; if (seen[cid] && String(seen[cid]) >= String(at)) return; seen[cid] = at; return dbSet(db, "coachnotes/_inbox", { ...cur, seen }); }).catch(() => {}); } catch (e) {}
  };
  return html`<div className="stack">
    <p className="muted small">${(name || "Ton client")} voit tes messages dans son application (bouton en haut à droite). Pas de notification sur son téléphone : il les découvre à sa prochaine ouverture.</p>
    <${MessageThread} data=${data} src=${src} me="coach" other=${name || "Client"} onSeen=${onSeen} demo=${demo} lang=${data.profile && data.profile.lang} />
  </div>`;
}
