/* ===== Composants d'interface ===== */
function Logo({ size }) {
  const s = size || 34;
  return html`<svg width=${s} height=${s} viewBox="0 0 48 48" aria-hidden="true" className="logo">
    <rect x="4" y="9.5" width="40" height="3" rx="1.5" style=${{ fill: "var(--gold)" }}></rect>
    <rect x="7" y="4" width="4.5" height="14" rx="1.2" style=${{ fill: "var(--gold)" }}></rect>
    <rect x="12.5" y="6" width="3" height="10" rx="1" style=${{ fill: "var(--gold)" }}></rect>
    <rect x="36.5" y="4" width="4.5" height="14" rx="1.2" style=${{ fill: "var(--gold)" }}></rect>
    <rect x="32.5" y="6" width="3" height="10" rx="1" style=${{ fill: "var(--gold)" }}></rect>
    <polyline points="11,33 24,23 37,33" style=${{ fill: "none", stroke: "var(--gold)", strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }}></polyline>
    <polyline points="11,43 24,33 37,43" style=${{ fill: "none", stroke: "var(--gold)", strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round", opacity: 0.55 }}></polyline>
  </svg>`;
}
function Brand({ sub }) {
  return html`<div className="brand"><${Logo} size=${30} /><div><div className="brand-n">Antoine Prépa Performance</div>${sub ? html`<div className="brand-s">${sub}</div>` : null}</div></div>`;
}
function Btn({ kind, small, onClick, children, disabled, type, title, block }) {
  return html`<button type=${type || "button"} title=${title} className=${"btn " + (kind || "primary") + (small ? " sm" : "") + (block ? " block" : "")} onClick=${onClick} disabled=${disabled}>${children}</button>`;
}
function Pill({ tone, children }) { return html`<span className=${"pill " + (tone || "muted")}>${children}</span>`; }
function Card({ title, action, children, className, sub }) {
  return html`<section className=${"card " + (className || "")}>
    ${title || action ? html`<header className="card-h"><div><h3>${title}</h3>${sub ? html`<p className="muted small">${sub}</p>` : null}</div>${action || null}</header>` : null}
    ${children}
  </section>`;
}
function Field({ label, hint, children, id }) {
  const gid = React.useId();
  /* un <label> sans cible associerait son texte au premier bouton (Seg, Scale) : on utilise alors un groupe */
  if (id) return html`<label className="field" htmlFor=${id}><span className="field-l">${label}</span>${children}${hint ? html`<span className="field-h">${hint}</span>` : null}</label>`;
  return html`<div className="field" role="group" aria-labelledby=${gid}><span className="field-l" id=${gid}>${label}</span>${children}${hint ? html`<span className="field-h">${hint}</span>` : null}</div>`;
}
function Seg({ options, value, onChange, id }) {
  return html`<div className="seg" role="radiogroup" id=${id}>${options.map((o) => html`<button type="button" key=${String(o.v)} role="radio" aria-checked=${value === o.v}
    className=${value === o.v ? "on" : ""} onClick=${() => onChange(o.v)}>${o.n}</button>`)}</div>`;
}
function Scale({ min, max, value, onChange, lo, hi, id }) {
  const vals = []; for (let i = min; i <= max; i++) vals.push(i);
  return html`<div className="scale" id=${id}>
    <div className="scale-b">${vals.map((v) => html`<button type="button" key=${v} className=${value === v ? "on" : ""} aria-pressed=${value === v} onClick=${() => onChange(v)}>${v}</button>`)}</div>
    ${lo || hi ? html`<div className="scale-l"><span>${lo}</span><span>${hi}</span></div>` : null}
  </div>`;
}
function Empty({ title, text, children }) {
  return html`<div className="empty"><${Logo} size=${40} /><h3>${title}</h3>${text ? html`<p>${text}</p>` : null}${children}</div>`;
}
function Modal({ open, title, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  if (!open) return null;
  return html`<div className="modal-bg" onClick=${(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
    <div className=${"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label=${title}>
      <header className="modal-h"><h3>${title}</h3><button type="button" className="x" onClick=${onClose} aria-label="Fermer">×</button></header>
      <div className="modal-b">${children}</div>
    </div>
  </div>`;
}
const ToastCtx = React.createContext(() => {});
function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone) => {
    const id = rid();
    setItems([{ id, text, tone }]); /* un seul message à la fois */
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), tone === "bad" || tone === "warn" ? 4500 : 2600);
  }, []);
  return html`<${ToastCtx.Provider} value=${push}>${children}<div className="toasts" aria-live="polite">${items.map((i) => html`<div key=${i.id} className=${"toast " + (i.tone || "")}>${i.text}</div>`)}</div></${ToastCtx.Provider}>`;
}
const useToast = () => React.useContext(ToastCtx);

function CopyBox({ text, label, id }) {
  const toast = useToast();
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(text).then(() => toast("Copié. Colle-le dans un message.", "ok"), () => { setShown(true); setTimeout(() => ref.current && ref.current.select(), 30); });
    } catch (e) { setShown(true); setTimeout(() => ref.current && ref.current.select(), 30); }
  };
  return html`<div className="copybox">
    <${Btn} onClick=${copy}>${label || "Copier"}</${Btn}>
    <button type="button" className="linkbtn" onClick=${() => { setShown(!shown); setTimeout(() => ref.current && ref.current.select(), 30); }}>${shown ? "Masquer le texte" : "Afficher le texte"}</button>
    ${shown ? html`<textarea id=${id || "copy-" + label} ref=${ref} readOnly className="code" value=${text} onFocus=${(e) => e.target.select()}></textarea>` : null}
  </div>`;
}

function useWidth(ref, fallback) {
  const [w, setW] = useState(fallback || 320);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const set = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    set();
    let ro = null;
    try { ro = new ResizeObserver(set); ro.observe(el); } catch (e) { window.addEventListener("resize", set); }
    return () => { try { ro && ro.disconnect(); } catch (e) {} window.removeEventListener("resize", set); };
  }, []);
  return w;
}

function niceTicks(min, max, n) {
  const span = max - min || 1;
  const step0 = span / (n || 3);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v * 1000) / 1000);
  return t;
}

function LineChart({ points, unit, height, digits, zeroBased }) {
  const ref = useRef(null);
  const W = useWidth(ref);
  const H = height || 170;
  const [hover, setHover] = useState(null);
  const gid = useMemo(() => rid("g"), []);
  const has = points && points.length > 0;
  let body = null, label = null;
  if (has) {
    const ys = points.map((p) => p.y);
    let mn = Math.min(...ys), mx = Math.max(...ys);
    if (zeroBased) mn = Math.min(0, mn);
    if (mn === mx) { mn -= 1; mx += 1; }
    const ticks = niceTicks(mn, mx, 3);
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const L = 40, R = 14, Tp = 16, B = 24;
    const x = (i) => points.length === 1 ? (L + (W - L - R) / 2) : L + (i * (W - L - R)) / (points.length - 1);
    const y = (v) => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo || 1));
    const d = points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.y).toFixed(1)).join(" ");
    const area = d + " L" + x(points.length - 1).toFixed(1) + " " + (H - B) + " L" + x(0).toFixed(1) + " " + (H - B) + " Z";
    const every = Math.ceil(points.length / Math.max(2, Math.floor((W - L - R) / 46)));
    const last = points.length - 1;
    const hi2 = hover !== null && hover < points.length ? hover : null;
    const onMove = (cx, el) => {
      const r = el.getBoundingClientRect();
      const px = cx - r.left;
      let best = 0, bd = 1e9;
      points.forEach((p, i) => { const dd = Math.abs(x(i) - px); if (dd < bd) { bd = dd; best = i; } });
      setHover(best);
    };
    body = html`<svg width=${W} height=${H} onMouseMove=${(e) => onMove(e.clientX, e.currentTarget)} onMouseLeave=${() => setHover(null)}
      onTouchStart=${(e) => e.touches[0] && onMove(e.touches[0].clientX, e.currentTarget)} role="img" aria-label=${"Courbe : " + points.map((p) => p.x + " " + fmtN(p.y, digits)).join(", ")}>
      <defs><linearGradient id=${gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style=${{ stopColor: "var(--gold)", stopOpacity: 0.28 }}></stop><stop offset="1" style=${{ stopColor: "var(--gold)", stopOpacity: 0 }}></stop></linearGradient></defs>
      ${ticks.map((t) => html`<g key=${"t" + t}><line x1=${L} x2=${W - R} y1=${y(t)} y2=${y(t)} style=${{ stroke: "var(--grid)", strokeWidth: 1 }}></line>
        <text x=${L - 6} y=${y(t) + 4} textAnchor="end" className="ax">${fmtN(t, digits ?? 1)}</text></g>`)}
      ${points.map((p, i) => (i % every === 0 || i === last) ? html`<text key=${"x" + i} x=${x(i)} y=${H - 6} textAnchor="middle" className="ax">${p.x}</text>` : null)}
      <path d=${area} style=${{ fill: "url(#" + gid + ")" }}></path>
      <path d=${d} style=${{ fill: "none", stroke: "var(--gold)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }}></path>
      ${hi2 !== null ? html`<line x1=${x(hi2)} x2=${x(hi2)} y1=${Tp} y2=${H - B} style=${{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" }}></line>` : null}
      ${points.map((p, i) => html`<circle key=${"c" + i} cx=${x(i)} cy=${y(p.y)} r=${i === last || i === hi2 ? 5 : 3.2} style=${{ fill: i === last ? "var(--gold)" : "var(--surface)", stroke: "var(--gold)", strokeWidth: 2 }}></circle>`)}
    </svg>`;
    const hv = hi2 !== null ? points[hi2] : points[last];
    label = html`<div className="chart-val"><b>${fmtN(hv.y, digits)} ${unit || ""}</b> · ${hv.x}</div>`;
  }
  return html`<div ref=${ref} className="chart">${has ? html`${body}${label}` : html`<div className="chart-empty">Pas encore de données</div>`}</div>`;
}

function BarChart({ data, unit, height, target, digits, fmt }) {
  const ref = useRef(null);
  const W = useWidth(ref);
  const H = height || 150;
  const [hover, setHover] = useState(null);
  if (!data || !data.length) return html`<div ref=${ref} className="chart"><div className="chart-empty">Pas encore de données</div></div>`;
  const mx = Math.max(target || 0, ...data.map((d) => d.y), 1);
  const ticks = niceTicks(0, mx, 3);
  const hi = ticks[ticks.length - 1];
  const L = 36, R = 8, Tp = 10, B = 22;
  const bw = (W - L - R) / data.length;
  const y = (v) => Tp + (H - Tp - B) * (1 - v / (hi || 1));
  const every = Math.ceil(data.length / Math.max(2, Math.floor((W - L - R) / 30)));
  const hv = hover !== null ? data[hover] : null;
  return html`<div ref=${ref} className="chart">
    <svg width=${W} height=${H} role="img" aria-label=${"Barres : " + data.map((d) => d.x + " " + fmtN(d.y, digits)).join(", ")} onMouseLeave=${() => setHover(null)}>
      ${ticks.map((t) => html`<g key=${"t" + t}><line x1=${L} x2=${W - R} y1=${y(t)} y2=${y(t)} style=${{ stroke: "var(--grid)", strokeWidth: 1 }}></line>
        <text x=${L - 6} y=${y(t) + 4} textAnchor="end" className="ax">${fmt ? fmt(t) : fmtN(t, 0)}</text></g>`)}
      ${data.map((d, i) => {
        const h = Math.max(0, (H - B) - y(d.y));
        const bx = L + i * bw + 2, w = Math.max(2, bw - 4);
        return html`<g key=${"b" + i} onMouseEnter=${() => setHover(i)} onTouchStart=${() => setHover(i)}>
          <rect x=${L + i * bw} y=${Tp} width=${bw} height=${H - Tp - B} style=${{ fill: "transparent" }}></rect>
          ${h > 0 ? html`<path d=${"M" + bx + " " + (H - B) + " V" + (H - B - h + Math.min(4, h)) + " Q" + bx + " " + (H - B - h) + " " + (bx + Math.min(4, w / 2)) + " " + (H - B - h) + " H" + (bx + w - Math.min(4, w / 2)) + " Q" + (bx + w) + " " + (H - B - h) + " " + (bx + w) + " " + (H - B - h + Math.min(4, h)) + " V" + (H - B) + " Z"}
            style=${{ fill: d.muted ? "var(--gold-soft)" : "var(--gold)", opacity: hover === null || hover === i ? 1 : 0.55 }}></path>` : null}
          ${(i % every === 0 || i === data.length - 1) ? html`<text x=${L + i * bw + bw / 2} y=${H - 6} textAnchor="middle" className="ax">${d.x}</text>` : null}
        </g>`;
      })}
      ${target ? html`<line x1=${L} x2=${W - R} y1=${y(target)} y2=${y(target)} style=${{ stroke: "var(--fg)", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.5 }}></line>` : null}
      <line x1=${L} x2=${W - R} y1=${H - B} y2=${H - B} style=${{ stroke: "var(--line)", strokeWidth: 1 }}></line>
    </svg>
    <div className="chart-val">${hv ? html`<b>${fmt ? fmt(hv.y) : fmtN(hv.y, digits)} ${unit || ""}</b> · ${hv.x}${hv.note ? " · " + hv.note : ""}` : html`<span className="muted">Survole ou touche une barre</span>`}</div>
  </div>`;
}

function Ring({ value, size, label, sub }) {
  const s = size || 120, r = s / 2 - 9, c = 2 * Math.PI * r;
  const v = value === null || value === undefined ? null : clamp(value, 0, 1);
  return html`<div className="ring" style=${{ width: s + "px" }}>
    <svg width=${s} height=${s} viewBox=${"0 0 " + s + " " + s} role="img" aria-label=${(label || "") + " " + (sub || "")}>
      <circle cx=${s / 2} cy=${s / 2} r=${r} style=${{ fill: "none", stroke: "var(--track)", strokeWidth: 9 }}></circle>
      ${v !== null ? html`<circle cx=${s / 2} cy=${s / 2} r=${r} transform=${"rotate(-90 " + s / 2 + " " + s / 2 + ")"} style=${{ fill: "none", stroke: "var(--gold)", strokeWidth: 9, strokeLinecap: "round", strokeDasharray: c, strokeDashoffset: c * (1 - v) }}></circle>` : null}
    </svg>
    <div className="ring-t"><b>${label}</b>${sub ? html`<span>${sub}</span>` : null}</div>
  </div>`;
}
function Bar({ value, tone }) { return html`<div className="pbar"><div className=${"pbar-f " + (tone || "")} style=${{ width: clamp((value || 0) * 100, 0, 100) + "%" }}></div></div>`; }
function Stat({ n, label, sub, tone }) { return html`<div className=${"stat " + (tone || "")}><div className="stat-n">${n}</div><div className="stat-l">${label}</div>${sub ? html`<div className="stat-s">${sub}</div>` : null}</div>`; }
function Delta({ a, b, better, unit, digits }) {
  if (a === null || b === null || a === undefined || b === undefined) return null;
  const d = b - a;
  if (Math.abs(d) < 1e-9) return html`<span className="delta">=</span>`;
  const good = better === "low" ? d < 0 : better === "high" ? d > 0 : null;
  const pct = a ? Math.round((d / Math.abs(a)) * 1000) / 10 : null;
  return html`<span className=${"delta " + (good === true ? "up" : good === false ? "down" : "")}>${d > 0 ? "+" : "−"}${fmtN(Math.abs(d), digits ?? 2)} ${unit || ""}${pct !== null ? html` <small>(${d > 0 ? "+" : "−"}${fmtN(Math.abs(pct), 1)} %)</small>` : null}</span>`;
}
/* ---------- version site : installation et déconnexion (sans effet sur claude.ai) ---------- */
function InstallButton({ small }) {
  const [ev, setEv] = useState(window.__installPrompt);
  const [ios, setIos] = useState(false);
  useEffect(() => { const f = () => setEv(window.__installPrompt); window.addEventListener("install-ready", f); return () => window.removeEventListener("install-ready", f); }, []);
  const standalone = (() => { try { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone; } catch (e) { return false; } })();
  if (standalone) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  if (ev) return html`<${Btn} kind="ghost" small=${small} onClick=${async () => { try { ev.prompt(); await ev.userChoice; } catch (e) {} window.__installPrompt = null; setEv(null); }}>Installer l'application</${Btn}>`;
  if (isIOS) return html`<div className="stack-s"><${Btn} kind="ghost" small=${small} onClick=${() => setIos(!ios)}>Installer sur l'iPhone</${Btn}>${ios ? html`<p className="small">Dans Safari : touche <b>Partager</b> (le carré avec une flèche), puis <b>Sur l'écran d'accueil</b>.</p>` : null}</div>`;
  return null;
}
function SignOutLink() {
  if (!window.IS_SITE) return null;
  const u = window.SITE.auth && window.SITE.auth.currentUser;
  return html`<div className="stack-s"><span className="muted small">${u ? "Connecté : " + u.email : ""}</span><div className="btnrow"><${InstallButton} small=${true} /><${Btn} kind="quiet" small onClick=${() => window.SITE.signOut()}>Se déconnecter</${Btn}></div></div>`;
}
