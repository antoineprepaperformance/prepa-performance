/* ===== Thèmes de saison et grands événements sportifs, avec un défi à chaque fois =====
   Fêtes : dates fixes chaque année (Pâques calculée). Compétitions : dates officielles vérifiées, à compléter chaque année
   (CLAUDE.md : la mise à jour hebdomadaire ajoute les prochaines). Jamais de logo ni d'emblème officiel : noms seulement.
   Défis : « seances » = séances enregistrées (programme et séances en plus) ; « jours » = jours où le client a bougé
   (séance, séance en plus, activité importée, 8 000 pas ou case cochée). Progression gardée dans profile.defis[clé]. */
const SAISON_ICONS = {
  citrouille: "M12 7c-4.4 0-8 2.9-8 6.5S7.6 20 12 20s8-2.9 8-6.5S16.4 7 12 7zM12 7V4.5M12 4.5c1-.9 2.3-1.2 3.5-1M9 7.5c-1.2 1.6-1.5 3.8-1.5 6s.3 4.4 1.5 6M15 7.5c1.2 1.6 1.5 3.8 1.5 6s-.3 4.4-1.5 6",
  flocon: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2M4.2 7.5l2.7.7M4.2 7.5l.7 2.7M19.8 16.5l-2.7-.7M19.8 16.5l-.7-2.7M4.2 16.5l.7-2.7M4.2 16.5l2.7-.7M19.8 7.5l-2.7.7M19.8 7.5l-.7 2.7",
  etoile: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  oeuf: "M12 3c-3.6 0-6.5 5.4-6.5 10.2C5.5 17.4 8.4 21 12 21s6.5-3.6 6.5-7.8C18.5 8.4 15.6 3 12 3zM6 12.5l2.5-1.5 2 1.5 2-1.5 2 1.5 2.5-1.5",
  feuille: "M5 19C5 10 10 5 20 4c0 10-5 15-14 15M5 19l9-9",
  ovale: "M4.5 19.5c-2-2-1.5-7.3 2.6-11.4S16.5 3.5 18.5 5.5s1.5 7.3-2.6 11.4S6.5 21.5 4.5 19.5zM8.5 15.5l7-7M10 12l2 2M12 10l2 2",
  ballon: "M12 3a9 9 0 100 18 9 9 0 000-18zM3.5 10.5c3 1 5.5 3.5 6.5 10M20.5 10.5c-3 1-5.5 3.5-6.5 10M7 4.5c2.5 2 7.5 2 10 0",
  roue: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 12V3M12 12l7.8 4.5M12 12l-7.8 4.5M12 12l7.8-4.5M12 12l-7.8-4.5M12 12v9",
  chrono: "M12 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM12 13.5V9.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5",
  coupe: "M7 4h10v4a5 5 0 01-10 0V4zM7 6H4.5a2.5 2.5 0 002.5 3.5M17 6h2.5A2.5 2.5 0 0117 9.5M12 13v4M8.5 20h7M10 17h4v3h-4z",
};
/* m-j : mois-jour répétés chaque année ; from/to datés : une seule édition. countTo : fin du décompte du défi (sinon fin de la période) */
const SAISONS = [
  /* grandes compétitions (prioritaires sur les fêtes quand elles se chevauchent) */
  { id: "hand27", kind: "sport", from: "2027-01-13", to: "2027-01-31", main: "2027-01-31", n: "Mondial de handball", court: "la finale du Mondial de handball", icon: "ballon", deco: "ballon", accent: "bleu",
    t: "Mondial de handball", x: "Du 13 au 31 janvier en Allemagne. Mets-toi au rythme des handballeurs : sauts, sprints, changements de direction.",
    defi: { type: "seances", target: 6, n: "Défi explosivité", d: "6 séances pendant le Mondial, du 13 au 31 janvier." }, badge: "Main de fer" },
  { id: "tournoi27", kind: "sport", from: "2027-02-05", to: "2027-03-13", main: "2027-03-13", n: "Tournoi des Six Nations", court: "la dernière journée du Tournoi", icon: "ovale", deco: "ovale", accent: "bleu",
    t: "Tournoi des Six Nations", x: "5 journées de rugby du 5 février au 13 mars : deux séances par semaine pendant tout le Tournoi.",
    defi: { type: "seances", target: 10, n: "Défi du Tournoi", d: "10 séances pendant le Tournoi : deux par semaine jusqu'à la dernière journée, le 13 mars." }, badge: "Grand Chelem" },
  { id: "europe27", kind: "sport", from: "2027-05-08", to: "2027-05-22", main: "2027-05-22", n: "Finale de la Coupe d'Europe de rugby", court: "la finale de la Coupe d'Europe", icon: "coupe", deco: "ovale",
    t: "Finale de la Coupe d'Europe à Lyon", x: "Le 22 mai, la finale de la Coupe d'Europe de rugby se joue à Lyon.",
    defi: { type: "seances", target: 4, n: "Défi des phases finales", d: "4 séances dans les deux semaines avant la finale." }, badge: "Champion d'Europe" },
  { id: "top1427", kind: "sport", from: "2027-06-11", to: "2027-06-26", main: "2027-06-26", n: "Phases finales du Top 14", court: "la finale du Top 14", icon: "ovale", deco: "ovale",
    t: "Phases finales du Top 14", x: "Demi-finales à Bordeaux, finale le 26 juin au Stade de France.",
    defi: { type: "seances", target: 4, n: "Défi du Bouclier", d: "4 séances entre les barrages et la finale du 26 juin." }, badge: "Bouclier" },
  { id: "tour27", kind: "sport", from: "2027-07-02", to: "2027-07-25", main: "2027-07-25", n: "Tour de France", court: "l'arrivée du Tour à Paris", icon: "roue", deco: "roue", accent: "argent",
    t: "Tour de France", x: "21 étapes d'Édimbourg à Paris, du 2 au 25 juillet.",
    defi: { type: "jours", target: 15, n: "Défi des 21 étapes", d: "Bouge au moins 30 minutes 15 jours sur 24 : séance, vélo, course, 8 000 pas ou case cochée." }, badge: "Maillot de l'effort" },
  { id: "athle27", kind: "sport", from: "2027-09-11", to: "2027-09-19", main: "2027-09-19", n: "Mondiaux d'athlétisme", court: "la fin des Mondiaux d'athlétisme", icon: "chrono", deco: "chrono",
    t: "Mondiaux d'athlétisme", x: "Du 11 au 19 septembre à Pékin : place à la vitesse.",
    defi: { type: "seances", target: 3, n: "Défi sprint", d: "3 séances de vitesse ou de puissance pendant les Mondiaux." }, badge: "Pointes d'or" },
  { id: "cdm27", kind: "sport", from: "2027-10-01", to: "2027-11-13", main: "2027-11-13", n: "Coupe du monde de rugby", court: "la finale de la Coupe du monde", icon: "ovale", deco: "ovale", accent: "bleu",
    t: "Coupe du monde de rugby", x: "Du 1er octobre au 13 novembre en Australie : six semaines de rugby, six semaines de défi.",
    defi: { type: "seances", target: 12, n: "Défi de la Coupe du monde", d: "12 séances en 6 semaines : deux par semaine jusqu'à la finale du 13 novembre." }, badge: "Mondialiste" },
  /* fêtes et moments de l'année */
  { id: "nouvelan", kind: "fete", md: ["12-27", "01-07"], main: "01-01", n: "Nouvel an", court: "le Nouvel an", icon: "etoile", deco: "etoile",
    t: "Bonne année", x: "Une nouvelle année commence : on la lance en force.",
    defi: { type: "seances", target: 3, n: "Démarrage en trombe", d: "3 séances entre le 27 décembre et le 7 janvier." }, badge: "Départ lancé" },
  { id: "paques", kind: "fete", easter: [-14, 1], n: "Pâques", court: "Pâques", icon: "oeuf", deco: "oeuf", accent: "vert",
    t: "La chasse aux œufs", x: "Chaque séance te rapporte un œuf : trouve-les tous avant le lundi de Pâques.",
    defi: { type: "seances", target: 5, n: "Chasse aux œufs", d: "5 séances dans les deux semaines avant le lundi de Pâques." }, badge: "Œuf en or" },
  { id: "rentree", kind: "fete", md: ["08-25", "09-10"], main: "09-01", n: "Rentrée", court: "la rentrée", icon: "feuille", deco: "feuille",
    t: "C'est la rentrée", x: "Le bon moment pour reprendre un rythme régulier.",
    defi: { type: "seances", target: 5, n: "Défi de la rentrée", d: "5 séances entre le 25 août et le 10 septembre." }, badge: "Bonne rentrée" },
  { id: "halloween", kind: "fete", md: ["10-17", "10-31"], main: "10-31", n: "Halloween", court: "Halloween", icon: "citrouille", deco: "citrouille", accent: "orange",
    t: "Le défi des citrouilles", x: "Fais peur à tes courbatures avant le 31 octobre.",
    defi: { type: "seances", target: 4, n: "Défi des citrouilles", d: "4 séances entre le 17 et le 31 octobre." }, badge: "Citrouille d'or" },
  { id: "noel", kind: "fete", md: ["12-01", "12-26"], main: "12-25", countTo: "12-24", n: "Noël", court: "Noël", icon: "flocon", deco: "flocon", accent: "noel",
    t: "Le défi de l'Avent", x: "Une case par jour jusqu'au 24 décembre : chaque jour où tu bouges compte.",
    defi: { type: "jours", target: 20, n: "Défi de l'Avent", d: "Bouge au moins 10 minutes 20 jours sur 24 : séance, séance flash, récup, marche ou case cochée." }, badge: "Étoile de l'Avent" },
];
/* dimanche de Pâques (algorithme de Meeus, calendrier grégorien) */
function easterOf(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return y + "-" + String(mo).padStart(2, "0") + "-" + String(da).padStart(2, "0");
}
/* éditions d'un événement autour d'une année : {ev, key, from, to, main, countTo} */
function saisonEditions(ev, year) {
  if (ev.from) return [{ ev, key: ev.id, from: ev.from, to: ev.to, main: ev.main || ev.to, countTo: ev.to }];
  const out = [];
  for (const y of [year - 1, year, year + 1]) {
    if (ev.easter) { const e = easterOf(y); out.push({ ev, key: ev.id + "-" + y, from: addDays(e, ev.easter[0]), to: addDays(e, ev.easter[1]), main: e, countTo: addDays(e, ev.easter[1]) }); continue; }
    const [a, b] = ev.md, cross = b < a;                   /* période à cheval sur deux années (Nouvel an) */
    const from = y + "-" + a, to = (cross ? y + 1 : y) + "-" + b;
    const mainY = ev.main && cross && ev.main < a ? y + 1 : y;
    out.push({ ev, key: ev.id + "-" + y, from, to, main: ev.main ? mainY + "-" + ev.main : to, countTo: ev.countTo ? y + "-" + ev.countTo : to });
  }
  return out;
}
function saisonDate() {
  try { const q = new URLSearchParams(location.search).get("saison"); if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q; } catch (e) {}
  try { const s = sessionStorage.getItem("saison_preview"); if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch (e) {}
  return todayISO();
}
function saisonConf(settings) { return { off: {}, msg: {}, ...((settings && settings.saisons) || {}) }; }
/* l'événement en cours à une date (le premier de la liste l'emporte), sauf ceux désactivés par le coach ;
   kind = "fete" pour ne garder que les fêtes (page d'accueil publique) */
function saisonActive(date, settings, kind) {
  const conf = saisonConf(settings), y = Number(date.slice(0, 4));
  for (const ev of SAISONS) {
    if (conf.off[ev.id] || (kind && ev.kind !== kind)) continue;
    const ed = saisonEditions(ev, y).find((x) => x.from <= date && date <= x.to);
    if (ed) return { ...ed, msg: conf.msg[ev.id] || "" };
  }
  return null;
}
/* les prochaines éditions (écran du coach) */
function saisonUpcoming(date, months) {
  const end = addDays(date, Math.round((months || 12) * 30.5)), y = Number(date.slice(0, 4));
  const all = [];
  SAISONS.forEach((ev) => saisonEditions(ev, y).forEach((ed) => { if (ed.to >= date && ed.from <= end) all.push(ed); }));
  return all.sort((a, b) => a.from.localeCompare(b.from));
}
/* jours où le client a bougé, et séances enregistrées, entre deux dates */
function activityDates(data, profile, key, from, to) {
  const days = new Set(), n = { seances: 0 };
  const inR = (d) => d && d >= from && d <= to;
  Object.values(data.logs || {}).forEach((l) => { if (l && inR(l.date)) { days.add(l.date); n.seances++; } });
  Object.values(data.libres || {}).forEach((l) => { if (l && inR(l.d)) { days.add(l.d); n.seances++; } });
  Object.values(data.activites || {}).forEach((a) => { const d = a && (a.d || String(a.at || "").slice(0, 10)); if (inR(d)) days.add(d); });
  Object.values(data.sante || {}).forEach((s) => { if (s && inR(s.d) && num(s.pas) !== null && num(s.pas) >= 8000) days.add(s.d); });
  const df = ((profile && profile.defis) || {})[key];
  ((df && df.days) || []).forEach((d) => { if (inR(d)) days.add(d); });
  return { days, seances: n.seances };
}
function defiProgress(ed, data, profile, today) {
  const end = [ed.countTo, today].sort()[0];
  const a = activityDates(data, profile, ed.key, ed.from, end);
  const n = ed.ev.defi.type === "jours" ? a.days.size : a.seances;
  return { n, target: ed.ev.defi.target, done: n >= ed.ev.defi.target, days: a.days, todayDone: a.days.has(today), counting: today <= ed.countTo };
}
function saisonCount(ed, date) {
  const d = diffDays(date, ed.main);
  if (d > 0) return "J-" + d + " avant " + ed.ev.court;
  if (d === 0) return ed.ev.kind === "sport" ? "C'est le jour J" : "C'est aujourd'hui";
  return ed.ev.kind === "sport" ? "La compétition est terminée" : "Bonnes fêtes";
}
function useSaison(settings, profile, on) {
  const date = saisonDate();
  const ed = useMemo(() => saisonActive(date, settings), [date, settings && settings.saisons]);
  const show = !!(on && ed && prefsOf(profile).saison !== false);
  useEffect(() => {
    if (!show) return undefined;
    try { document.documentElement.setAttribute("data-event", ed.ev.accent || "neutre"); } catch (e) {}
    return () => { try { document.documentElement.removeAttribute("data-event"); } catch (e) {} };
  }, [show, ed && ed.key]);
  return show ? { ...ed, date } : null;
}
function SaisonIcon({ k, size }) {
  return html`<svg width=${size || 26} height=${size || 26} viewBox="0 0 24 24" aria-hidden="true"><path d=${SAISON_ICONS[k] || SAISON_ICONS.etoile} style=${{ fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}></path></svg>`;
}
/* petites décorations qui flottent en haut de l'écran (immobiles si le téléphone demande moins d'animations) */
function SaisonDeco({ ed }) {
  if (!ed) return null;
  const spots = [[6, 8, 0.9], [22, 3, 0.6], [41, 10, 0.75], [63, 4, 0.55], [80, 9, 0.85], [93, 2, 0.6], [14, 18, 0.5], [72, 17, 0.5]];
  return html`<div className=${"saison-deco d-" + ed.ev.deco} aria-hidden="true">${spots.map(([x, y, s], i) => html`<span key=${i} style=${{ left: x + "%", top: y + "px", transform: "scale(" + s + ")", animationDelay: (i * 0.7) + "s" }}><${SaisonIcon} k=${ed.ev.deco} size=${22} /></span>`)}</div>`;
}
/* bandeau de la page du jour : l'événement, le compte à rebours, le défi */
function SaisonBanner({ ed, data, src, demo }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const profile = data.profile || {};
  const today = ed.date;
  const pr = defiProgress(ed, data, profile, today);
  const df = (profile.defis || {})[ed.key] || {};
  const can = !demo && src && src.setProfile;
  /* défi réussi : enregistré une fois (badge) */
  useEffect(() => {
    if (!pr.done || df.done || !can) return;
    src.setProfile({ ...profile, defis: { ...(profile.defis || {}), [ed.key]: { ...df, done: today, ev: ed.ev.id } } }).then(() => toast("Défi réussi : badge « " + ed.ev.badge + " » débloqué !", "ok")).catch(() => {});
  }, [pr.done, !!df.done]);
  const tick = async () => {
    if (!can) { toast("Aperçu : la case n'est pas enregistrée.", "warn"); return; }
    const days = [...new Set([...(df.days || []), today])].sort();
    try { await src.setProfile({ ...profile, defis: { ...(profile.defis || {}), [ed.key]: { ...df, days, ev: ed.ev.id } } }); toast("Journée comptée pour le défi.", "ok"); }
    catch (e) { toast("Enregistrement impossible. Réessaie dans un instant.", "bad"); }
  };
  const isJours = ed.ev.defi.type === "jours";
  const unit = isJours ? (pr.target > 1 ? "jours" : "jour") : (pr.target > 1 ? "séances" : "séance");
  return html`<section className=${"saison s-" + ed.ev.id} aria-label=${ed.ev.n}>
    <div className="saison-h"><span className="saison-i"><${SaisonIcon} k=${ed.ev.icon} size=${30} /></span>
      <div><div className="eyebrow">${saisonCount(ed, today)}</div><h3>${ed.ev.t}</h3></div></div>
    <p>${ed.msg || ed.ev.x}</p>
    <div className="saison-d"><div className="saison-dh"><b>${ed.ev.defi.n}</b><span>${pr.n} / ${pr.target} ${unit}</span></div>
      <${Bar} value=${pr.n / pr.target} />
      <p className="small">${pr.done ? "Défi réussi : badge « " + ed.ev.badge + " » débloqué. Bravo !" : ed.ev.defi.d}</p></div>
    <div className="btnrow">
      ${isJours && pr.counting && !pr.todayDone && !pr.done ? html`<${Btn} small onClick=${tick}>J'ai bougé aujourd'hui</${Btn}>` : null}
      ${isJours && pr.todayDone && !pr.done ? html`<span className="saison-ok">✓ Aujourd'hui compte</span>` : null}
      <${Btn} small kind="ghost" onClick=${() => setOpen(true)}>Voir le défi</${Btn}></div>
    <${Modal} open=${open} title=${ed.ev.defi.n} onClose=${() => setOpen(false)}>${open ? html`<${DefiDetail} ed=${ed} pr=${pr} />` : null}</${Modal}>
  </section>`;
}
function DefiDetail({ ed, pr }) {
  const days = [];
  if (ed.ev.defi.type === "jours") for (let d = ed.from; d <= ed.countTo; d = addDays(d, 1)) days.push(d);
  return html`<div className="stack">
    <p>${ed.ev.defi.d}</p>
    <p className="small muted">Du ${fmtD(ed.from)} au ${fmtD(ed.countTo)} · objectif ${pr.target} · ${pr.done ? "réussi" : "encore " + Math.max(0, pr.target - pr.n)}</p>
    ${days.length ? html`<div className="avent">${days.map((d) => html`<span key=${d} className=${"av-d" + (pr.days.has(d) ? " on" : "") + (d === ed.date ? " today" : "")}><b>${Number(d.slice(8))}</b></span>`)}</div>` : html`<div className="eggs">${Array.from({ length: pr.target }, (_, i) => html`<span key=${i} className=${"egg" + (i < pr.n ? " on" : "")}><${SaisonIcon} k=${ed.ev.icon} size=${26} /></span>`)}</div>`}
    <p className="small muted">Comptent : tes séances du programme et tes séances en plus${ed.ev.defi.type === "jours" ? ", tes activités importées, les jours à 8 000 pas et les cases cochées" : ""}. À la fin, un badge rejoint ta carte athlète.</p>
  </div>`;
}
/* badges des défis réussis (ajoutés à « Mes badges ») */
function saisonBadges(profile) {
  return Object.entries((profile && profile.defis) || {}).filter(([, v]) => v && v.done).map(([k, v]) => {
    const ev = SAISONS.find((e) => e.id === v.ev || k.indexOf(e.id) === 0);
    return ev ? { k: "defi-" + k, i: "etoile", n: ev.badge, d: ev.defi.n + " (" + String(v.done).slice(0, 4) + ")", ok: true, saison: true } : null;
  }).filter(Boolean);
}
/* page d'accueil du site : la fête du moment, pour donner envie de rejoindre le défi.
   Jamais les compétitions sportives sur cette page publique : s'en servir pour vendre, c'est exploiter l'événement de
   l'organisateur (code du sport, art. L333-1 ; tribunal judiciaire de Paris, 6 janvier 2026, FFR c. Royaltiz). Dans
   l'application, elles restent une information (dates publiques) pour les clients déjà inscrits (Cass. com., 20 mai 2014, n° 13-12102). */
function SaisonRibbon({ settings, onJoin }) {
  const date = saisonDate();
  const ed = saisonActive(date, settings, "fete");
  useEffect(() => {
    if (!ed) return undefined;
    try { document.documentElement.setAttribute("data-event", ed.ev.accent || "neutre"); } catch (e) {}
    return () => { try { document.documentElement.removeAttribute("data-event"); } catch (e) {} };
  }, [ed && ed.key]);
  if (!ed) return null;
  return html`<section className=${"saison l-saison s-" + ed.ev.id} aria-label=${ed.ev.n}>
    <div className="saison-h"><span className="saison-i"><${SaisonIcon} k=${ed.ev.icon} size=${30} /></span>
      <div><div className="eyebrow">En ce moment · ${saisonCount(ed, date)}</div><h3>${ed.ev.t}</h3></div></div>
    <p>${ed.msg || ed.ev.x} <b>${ed.ev.defi.n}</b> : ${ed.ev.defi.d}</p>
    ${onJoin ? html`<div className="btnrow"><${Btn} small onClick=${onJoin}>Je relève le défi</${Btn}></div>` : null}
  </section>`;
}
