/* ===== Bibliothèque des mouvements animés ===== */
const MOVES = {};
const K = (d, lab, p, ease) => ({ d, lab, ease, ...(p || {}) });
const DB2 = [{ k: "db", at: "h1" }, { k: "db", at: "h2" }];
const MAT = (x, w) => ({ k: "mat", x: x ?? -1.1, w: w ?? 2.2, h: 0.02 });
const BOTH = (spec, extra) => ({ A1: spec, A2: Array.isArray(spec) ? [spec[0] - 0.02, spec[1]] : spec, ...(extra || {}) });
const LEGS = (a, b) => ({ L1: a, L2: b || [a[0] - 0.04, a[1]] });
const STAND = { hip: [0, 0.935], t: 2, hd: 0 };

/* ---------- squats ---------- */
function mvSquat(v) {
  const top = { ...STAND, ...LEGS([0.03, 0.08]) };
  const bot = { hip: [-0.21, 0.43], t: 40, hd: 22, ...LEGS([0.03, 0.08]) };
  let arms = {}, armsB = {}, props = [], trail = null;
  if (v === "back") { arms = { ...BOTH({ tf: [-0.08, 0.05] }), eb1: 1, eb2: 1 }; armsB = arms; props = [{ k: "plate", at: "back" }]; trail = "back"; }
  else if (v === "front") { arms = BOTH({ ua: 95, fa: -118, rel: true }); armsB = arms; props = [{ k: "plate", at: "front" }]; trail = "front"; Object.assign(bot, { hip: [-0.17, 0.42], t: 22, hd: 10 }); }
  else if (v === "goblet") { arms = BOTH({ tf: [0.2, -0.14] }); armsB = arms; props = [{ k: "kb", at: "hands", front: true }]; Object.assign(bot, { t: 30 }); }
  else if (v === "box") { arms = BOTH({ ua: 85, fa: 85 }); armsB = arms; props = [{ k: "box", x: -0.55, w: 0.42, h: 0.43 }]; Object.assign(bot, { hip: [-0.24, 0.5], t: 32 }); }
  else { arms = BOTH({ ua: 6, fa: 10 }); armsB = BOTH({ ua: 88, fa: 88 }); }
  return { n: "Squat", props, trail, keys: [K(0.6, "Départ", { ...top, ...arms }), K(1.5, "Descente contrôlée", { ...bot, ...armsB }), K(0.25, "En bas", { ...bot, ...armsB }), K(1.0, "Pousse le sol", { ...top, ...arms })],
    note: v === "box" ? "Touche la box sans t'y laisser tomber, puis repars." : "Genoux dans l'axe des pieds, talons au sol, dos neutre." };
}
MOVES.squat_back = mvSquat("back");
MOVES.squat_front = mvSquat("front");
MOVES.squat_goblet = mvSquat("goblet");
MOVES.squat_bw = mvSquat("bw");
MOVES.squat_box = mvSquat("box");
MOVES.wall_sit = { n: "Chaise contre le mur", props: [{ k: "wall", x: -0.62, w: 0.06, h: 1.7 }],
  keys: [K(2, "Tiens la position", { hip: [-0.43, 0.52], t: 0, hd: 0, ...LEGS([0.02, 0.08]), ...BOTH({ ua: 10, fa: 70 }) }), K(2, "Respire", { hip: [-0.43, 0.51], t: 0, hd: 0, ...LEGS([0.02, 0.08]), ...BOTH({ ua: 10, fa: 70 }) })],
  note: "Genoux à 90°, dos plaqué au mur, respire calmement." };
MOVES.spanish_squat = { n: "Spanish squat", props: [{ k: "band", from: [0.95, 0.5], to: "k1" }, { k: "band", from: [0.95, 0.5], to: "k2" }],
  keys: [K(0.8, "Départ", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH({ ua: 80, fa: 80 }) }), K(1.5, "Assieds-toi en arrière", { hip: [-0.43, 0.53], t: 18, ...LEGS([0.02, 0.08]), ...BOTH({ ua: 80, fa: 80 }) }), K(2.5, "Tiens, tibias verticaux", { hip: [-0.43, 0.52], t: 18, ...LEGS([0.02, 0.08]), ...BOTH({ ua: 80, fa: 80 }) }), K(1, "Remonte", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH({ ua: 80, fa: 80 }) })] };
MOVES.squat_jump = (() => {
  const a = { ...BOTH({ ua: -40, fa: -30 }) }, up = { ...BOTH({ ua: 160, fa: 170 }) };
  return { n: "Squat sauté", keys: [K(0.5, "Départ", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5 }) }), K(0.7, "Descends", { hip: [-0.17, 0.55], t: 35, ...LEGS([0.03, 0.08]), ...a }),
    K(0.3, "Explose", { hip: [0.02, 1.25], t: 0, ...LEGS([0.04, 0.37]), F1: 55, F2: 55, ...up }, "out"), K(0.3, "Réception souple", { hip: [-0.12, 0.7], t: 25, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 40, fa: 40 }) }, "in"), K(0.6, "", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5 }) })] };
})();
MOVES.squat_jump_bar = { ...MOVES.squat_jump, n: "Squat sauté chargé", props: [{ k: "plate", at: "back", r: 0.17 }],
  keys: MOVES.squat_jump.keys.map((k) => ({ ...k, ...BOTH({ tf: [-0.08, 0.05] }), eb1: 1, eb2: 1 })) };

/* ---------- fentes ---------- */
function mvLunge(kind, load) {
  const arms = load === "db" ? BOTH({ ua: 0, fa: 0 }) : BOTH({ ua: 10, fa: 60 });
  const props = load === "db" ? DB2 : [];
  const stand = { ...STAND, ...LEGS([0.02, 0.08]), ...arms };
  if (kind === "back") return { n: "Fente arrière", props, keys: [K(0.5, "Départ", stand), K(0.5, "Grand pas en arrière", { hip: [-0.18, 0.8], t: 4, L1: [0.02, 0.08], L2: [-0.45, 0.2], F2: 30, ...arms }),
    K(0.9, "Genou arrière vers le sol", { hip: [-0.36, 0.52], t: 6, L1: [0.02, 0.08], L2: [-0.86, 0.16], F2: 55, ...arms }), K(0.3, "", { hip: [-0.36, 0.52], t: 6, L1: [0.02, 0.08], L2: [-0.86, 0.16], F2: 55, ...arms }),
    K(0.9, "Pousse sur le talon avant", { hip: [-0.15, 0.82], t: 4, L1: [0.02, 0.08], L2: [-0.4, 0.2], F2: 20, ...arms }), K(0.4, "", stand)] };
  return { n: "Fente avant", props, keys: [K(0.5, "Départ", stand), K(0.5, "Grand pas en avant", { hip: [0.22, 0.82], t: 3, L1: [0.45, 0.2], L2: [-0.02, 0.08], F1: -10, ...arms }),
    K(0.8, "Descends", { hip: [0.42, 0.52], t: 5, L1: [0.84, 0.08], L2: [0.02, 0.16], F2: 55, ...arms }), K(0.3, "", { hip: [0.42, 0.52], t: 5, L1: [0.84, 0.08], L2: [0.02, 0.16], F2: 55, ...arms }),
    K(0.9, "Reviens", { hip: [0.2, 0.84], t: 3, L1: [0.42, 0.2], L2: [-0.02, 0.08], ...arms }), K(0.4, "", stand)] };
}
MOVES.lunge_back = mvLunge("back", "db");
MOVES.lunge_back_bw = mvLunge("back", "bw");
MOVES.lunge_fwd = mvLunge("fwd", "db");
MOVES.lunge_fwd_bw = mvLunge("fwd", "bw");
MOVES.split_squat = { n: "Split squat bulgare", props: [{ k: "bench", x: -1.15, w: 0.5, h: 0.45 }, ...DB2],
  keys: [K(0.6, "Pied arrière sur le banc", { hip: [-0.3, 0.88], t: 6, L1: [0.06, 0.08], L2: [-0.78, 0.53], F2: 150, kb2: 1, ...BOTH({ ua: 0, fa: 0 }) }),
    K(1.4, "Descends à la verticale", { hip: [-0.36, 0.5], t: 10, L1: [0.06, 0.08], L2: [-0.78, 0.53], F2: 150, ...BOTH({ ua: 0, fa: 0 }) }), K(0.3, "", { hip: [-0.36, 0.5], t: 10, L1: [0.06, 0.08], L2: [-0.78, 0.53], F2: 150, ...BOTH({ ua: 0, fa: 0 }) }),
    K(1, "Pousse sur le pied avant", { hip: [-0.3, 0.88], t: 6, L1: [0.06, 0.08], L2: [-0.78, 0.53], F2: 150, ...BOTH({ ua: 0, fa: 0 }) })] };
MOVES.step_up = { n: "Montée sur box", props: [{ k: "box", x: 0.12, w: 0.5, h: 0.42 }],
  keys: [K(0.6, "Pied sur la box", { hip: [-0.02, 0.88], t: 8, L1: [0.32, 0.5], L2: [-0.08, 0.08], ...BOTH({ ua: 10, fa: 30 }) }),
    K(1.1, "Pousse sur la jambe haute", { hip: [0.3, 1.34], t: 4, L1: [0.32, 0.5], L2: { th: 80, sh: 5 }, ...BOTH({ ua: -15, fa: 40 }) }), K(0.4, "Genou haut", { hip: [0.3, 1.34], t: 2, L1: [0.32, 0.5], L2: { th: 85, sh: 0 }, ...BOTH({ ua: -15, fa: 40 }) }),
    K(1.1, "Redescends lentement", { hip: [-0.02, 0.88], t: 8, L1: [0.32, 0.5], L2: [-0.08, 0.08], ...BOTH({ ua: 10, fa: 30 }) })] };
MOVES.step_down = { n: "Step down", props: [{ k: "box", x: -0.3, w: 0.5, h: 0.4 }],
  keys: [K(0.6, "Debout sur la marche", { hip: [-0.05, 1.33], t: 3, L1: [-0.05, 0.48], L2: { th: 15, sh: 5 }, ...BOTH({ ua: 70, fa: 70 }) }),
    K(1.8, "Descends en 3 secondes", { hip: [-0.2, 1.05], t: 22, L1: [-0.05, 0.48], L2: [0.4, 0.1], F2: -10, ...BOTH({ ua: 80, fa: 80 }) }), K(0.3, "Effleure le sol", { hip: [-0.2, 1.05], t: 22, L1: [-0.05, 0.48], L2: [0.4, 0.1], F2: -10, ...BOTH({ ua: 80, fa: 80 }) }),
    K(1, "Remonte", { hip: [-0.05, 1.33], t: 3, L1: [-0.05, 0.48], L2: { th: 15, sh: 5 }, ...BOTH({ ua: 70, fa: 70 }) })], note: "Genou dans l'axe du pied, bassin horizontal." };
MOVES.lateral_lunge = { n: "Fente latérale", view: "front",
  keys: [K(0.6, "Pieds écartés", { hip: [0, 0.9], t: 0, L1: [0.5, 0.08], L2: [-0.5, 0.08], ...BOTH({ ua: 20, fa: 60 }) }),
    K(1.2, "Assieds-toi sur une jambe", { hip: [0.32, 0.58], t: 8, L1: [0.55, 0.08], L2: [-0.5, 0.08], kb1: 1, ...BOTH({ ua: 30, fa: 70 }) }), K(0.3, "", { hip: [0.32, 0.58], t: 8, L1: [0.55, 0.08], L2: [-0.5, 0.08], ...BOTH({ ua: 30, fa: 70 }) }),
    K(1, "Reviens au centre", { hip: [0, 0.9], t: 0, L1: [0.5, 0.08], L2: [-0.5, 0.08], ...BOTH({ ua: 20, fa: 60 }) }),
    K(1.2, "Autre côté", { hip: [-0.32, 0.58], t: -8, L1: [0.5, 0.08], L2: [-0.55, 0.08], ...BOTH({ ua: 30, fa: 70 }) }), K(0.3, "", { hip: [-0.32, 0.58], t: -8, L1: [0.5, 0.08], L2: [-0.55, 0.08], ...BOTH({ ua: 30, fa: 70 }) }),
    K(1, "", { hip: [0, 0.9], t: 0, L1: [0.5, 0.08], L2: [-0.5, 0.08], ...BOTH({ ua: 20, fa: 60 }) })] };
MOVES.sl_squat_box = { n: "Squat unipodal sur box", props: [{ k: "box", x: -0.6, w: 0.42, h: 0.45 }],
  keys: [K(0.6, "Sur une jambe", { ...STAND, L1: [0.03, 0.08], L2: { th: 30, sh: 20 }, ...BOTH({ ua: 85, fa: 85 }) }),
    K(1.6, "Assieds-toi lentement", { hip: [-0.24, 0.52], t: 35, L1: [0.03, 0.08], L2: { th: 80, sh: 75 }, ...BOTH({ ua: 90, fa: 90 }) }), K(0.3, "", { hip: [-0.24, 0.52], t: 35, L1: [0.03, 0.08], L2: { th: 80, sh: 75 }, ...BOTH({ ua: 90, fa: 90 }) }),
    K(1.1, "Remonte sans élan", { ...STAND, L1: [0.03, 0.08], L2: { th: 30, sh: 20 }, ...BOTH({ ua: 85, fa: 85 }) })] };
MOVES.leg_press = { n: "Presse à cuisses", ground: true, props: [{ k: "poly", pts: [[-0.75, 0.2], [-0.1, 0.2], [-0.55, 0.9], [-0.75, 0.9]] }, { k: "bar", from: { rel: "a1", d: [0.05, 0.25] }, to: { rel: "a1", d: [0.25, -0.12] } }],
  keys: [K(0.6, "Jambes tendues", { hip: [-0.2, 0.32], t: -55, hd: -40, L1: [0.55, 0.92], L2: [0.52, 0.94], F1: -55, F2: -55, kb1: 1, kb2: 1, ...BOTH({ ua: 30, fa: 60 }) }),
    K(1.5, "Descends genoux vers la poitrine", { hip: [-0.2, 0.32], t: -55, hd: -40, L1: [0.22, 0.66], L2: [0.19, 0.68], F1: -55, F2: -55, ...BOTH({ ua: 30, fa: 60 }) }),
    K(1, "Pousse", { hip: [-0.2, 0.32], t: -55, hd: -40, L1: [0.55, 0.92], L2: [0.52, 0.94], F1: -55, F2: -55, ...BOTH({ ua: 30, fa: 60 }) })] };
MOVES.calf_raise = { n: "Extensions des mollets", props: [{ k: "step", x: -0.02, w: 0.32, h: 0.08 }, { k: "db", at: "h1" }],
  keys: [K(0.6, "Talons bas", { ...STAND, hip: [0, 1.0], ...LEGS([0.0, 0.14]), F1: -12, F2: -12, ...BOTH({ ua: 0, fa: 0 }) }), K(0.9, "Monte sur la pointe", { ...STAND, hip: [0, 1.13], ...LEGS([0.0, 0.27]), F1: 40, F2: 40, ...BOTH({ ua: 0, fa: 0 }) }),
    K(0.6, "Tiens 1 seconde", { ...STAND, hip: [0, 1.13], ...LEGS([0.0, 0.27]), F1: 40, F2: 40, ...BOTH({ ua: 0, fa: 0 }) }), K(1.4, "Redescends lentement", { ...STAND, hip: [0, 1.0], ...LEGS([0.0, 0.14]), F1: -12, F2: -12, ...BOTH({ ua: 0, fa: 0 }) })] };
MOVES.calf_single = { ...MOVES.calf_raise, n: "Mollets sur une jambe", props: [{ k: "step", x: -0.02, w: 0.32, h: 0.08 }], keys: MOVES.calf_raise.keys.map((k) => ({ ...k, L2: { th: 0, sh: -70 }, A2: { ua: 60, fa: 80 } })) };

/* ---------- chaîne postérieure ---------- */
MOVES.deadlift = { n: "Soulevé de terre", trail: "hands", props: [{ k: "plate", at: "hands" }],
  keys: [K(0.7, "Mise en place", { hip: [-0.32, 0.56], t: 64, hd: 45, ...LEGS([0.02, 0.08]), ...BOTH([0.1, 0.225]) }), K(1.6, "Pousse le sol, barre collée", { ...STAND, t: -2, ...LEGS([0.02, 0.08]), ...BOTH([0.05, 0.875]) }),
    K(0.5, "Debout, fessiers serrés", { ...STAND, t: -2, ...LEGS([0.02, 0.08]), ...BOTH([0.05, 0.875]) }), K(1.5, "Redescends en contrôlant", { hip: [-0.32, 0.56], t: 64, hd: 45, ...LEGS([0.02, 0.08]), ...BOTH([0.1, 0.225]) })] };
MOVES.deadlift_kb = { n: "Soulevé de terre kettlebell", props: [{ k: "kb", at: "hands" }],
  keys: [K(0.7, "Kettlebell entre les pieds", { hip: [-0.3, 0.6], t: 58, hd: 40, ...LEGS([0.02, 0.08]), ...BOTH([0.02, 0.33]) }), K(1.3, "Pousse le sol", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH([0.03, 0.86]) }),
    K(0.4, "", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH([0.03, 0.86]) }), K(1.3, "Hanches en arrière", { hip: [-0.3, 0.6], t: 58, hd: 40, ...LEGS([0.02, 0.08]), ...BOTH([0.02, 0.33]) })] };
MOVES.rdl = { n: "Soulevé de terre roumain", trail: "hands", props: [{ k: "plate", at: "hands" }],
  keys: [K(0.6, "Debout, barre aux cuisses", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH([0.05, 0.875]) }), K(1.8, "Hanches en arrière, dos plat", { hip: [-0.38, 0.81], t: 78, hd: 60, ...LEGS([0.02, 0.08]), ...BOTH([0.12, 0.34]) }),
    K(0.3, "Étirement des ischios", { hip: [-0.38, 0.81], t: 78, hd: 60, ...LEGS([0.02, 0.08]), ...BOTH([0.12, 0.34]) }), K(1.2, "Pousse les hanches devant", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH([0.05, 0.875]) })] };
MOVES.rdl_single = { n: "Soulevé de terre roumain unipodal", props: [{ k: "kb", at: "h1" }],
  keys: [K(0.6, "Sur une jambe", { ...STAND, L1: [0.02, 0.08], L2: { th: -8, sh: -15 }, ...BOTH({ ua: 0, fa: 0 }) }), K(1.8, "Bascule, jambe arrière tendue", { hip: [-0.22, 0.85], t: 82, hd: 70, L1: [0.02, 0.08], L2: { th: -82, sh: -82 }, F2: 90, ...BOTH({ ua: 0, fa: 0 }) }),
    K(0.3, "", { hip: [-0.22, 0.85], t: 82, hd: 70, L1: [0.02, 0.08], L2: { th: -82, sh: -82 }, F2: 90, ...BOTH({ ua: 0, fa: 0 }) }), K(1.2, "Reviens debout", { ...STAND, L1: [0.02, 0.08], L2: { th: -8, sh: -15 }, ...BOTH({ ua: 0, fa: 0 }) })] };
MOVES.good_morning = { n: "Good morning", props: [{ k: "plate", at: "back" }],
  keys: [K(0.6, "Barre sur le dos", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH({ tf: [-0.08, 0.05] }), eb1: 1, eb2: 1 }), K(1.6, "Bascule le buste", { hip: [-0.3, 0.86], t: 75, ...LEGS([0.02, 0.08]), ...BOTH({ tf: [-0.08, 0.05] }), eb1: 1, eb2: 1 }), K(1.1, "Remonte", { ...STAND, ...LEGS([0.02, 0.08]), ...BOTH({ tf: [-0.08, 0.05] }), eb1: 1, eb2: 1 })] };
MOVES.hip_thrust = { n: "Hip thrust", props: [{ k: "bench", x: -0.95, w: 0.55, h: 0.42 }, { k: "plate", at: "hip", dy: 0.13, r: 0.2 }],
  keys: [K(0.6, "Épaules sur le banc", { hip: [0.02, 0.24], t: -62, hd: -55, ...LEGS([0.5, 0.08]), kb1: 1, kb2: 1, ...BOTH({ rel: "hip", d: [0.12, 0.16] }) }), K(1, "Pousse les hanches", { hip: [0.08, 0.52], t: -90, hd: -70, ...LEGS([0.5, 0.08]), ...BOTH({ rel: "hip", d: [0.12, 0.14] }) }),
    K(0.8, "Serre les fessiers", { hip: [0.08, 0.53], t: -90, hd: -70, ...LEGS([0.5, 0.08]), ...BOTH({ rel: "hip", d: [0.12, 0.14] }) }), K(1.2, "Redescends", { hip: [0.02, 0.24], t: -62, hd: -55, ...LEGS([0.5, 0.08]), ...BOTH({ rel: "hip", d: [0.12, 0.16] }) })] };
function mvBridge(single) {
  const L2a = single ? { th: 130, sh: 120 } : [0.45, 0.08];
  const lie = { hip: [0, 0.11], t: -92, hd: -92, L1: [0.45, 0.08], L2: L2a, ...BOTH([-0.15, 0.03]), eb1: 1, eb2: 1 };
  const top = { hip: [0, 0.44], t: -128, hd: -105, L1: [0.45, 0.08], L2: single ? { th: 115, sh: 115 } : [0.45, 0.08], ...BOTH([-0.15, 0.03]), eb1: 1, eb2: 1 };
  return { n: single ? "Pont fessier unipodal" : "Pont fessier", props: [MAT()], keys: [K(0.6, "Allongé, pieds à plat", lie), K(1, "Monte les hanches", top), K(0.8, "Serre les fessiers", top), K(1.2, "Redescends vertèbre par vertèbre", lie)] };
}
MOVES.glute_bridge = mvBridge(false);
MOVES.glute_bridge_single = mvBridge(true);
MOVES.nordic = (() => {
  const P = (phi, arms) => ({ hip: [0.43 * Math.sin(phi * MOT_RAD), 0.07 + 0.43 * Math.cos(phi * MOT_RAD)], t: phi, hd: phi * 0.9, L1: { th: -phi, sh: -90 }, L2: { th: -phi, sh: -90 }, F1: 160, F2: 160, ...arms });
  const cross = BOTH({ ua: 25, fa: 150, rel: true });
  return { n: "Nordic hamstring", props: [MAT(-0.7, 1.9), { k: "box", x: -0.56, w: 0.16, h: 0.12 }],
    keys: [K(0.6, "À genoux, chevilles bloquées", P(0, cross)), K(3, "Descends le plus lentement possible", P(62, cross), "lin"), K(0.5, "Rattrape-toi avec les mains", P(72, BOTH({ ua: 85, fa: 90 }))), K(1.2, "Repousse et remonte", P(0, cross))] };
})();
MOVES.slider_curl = { n: "Leg curl glissé", props: [MAT()],
  keys: [K(0.6, "Pont, talons sur les serviettes", { hip: [0, 0.4], t: -122, hd: -100, ...LEGS([0.48, 0.08]), F1: -30, F2: -30, ...BOTH([-0.15, 0.03]), eb1: 1, eb2: 1 }),
    K(1.8, "Fais glisser les talons loin", { hip: [0, 0.2], t: -104, hd: -95, ...LEGS([0.85, 0.08]), F1: -30, F2: -30, ...BOTH([-0.15, 0.03]), eb1: 1, eb2: 1 }),
    K(1.1, "Ramène en gardant le bassin haut", { hip: [0, 0.4], t: -122, hd: -100, ...LEGS([0.48, 0.08]), F1: -30, F2: -30, ...BOTH([-0.15, 0.03]), eb1: 1, eb2: 1 })] };
MOVES.kb_swing = { n: "Kettlebell swing", trail: "hands", props: [{ k: "kb", at: "hands" }],
  keys: [K(0.5, "Hanches en arrière", { hip: [-0.27, 0.83], t: 68, hd: 50, ...LEGS([0.06, 0.08]), ...BOTH([-0.05, 0.5]) }, "out"), K(0.45, "Claque les hanches", { ...STAND, t: -4, ...LEGS([0.06, 0.08]), ...BOTH({ ua: 90, fa: 92 }) }, "out"),
    K(0.25, "", { ...STAND, t: -4, ...LEGS([0.06, 0.08]), ...BOTH({ ua: 90, fa: 92 }) }), K(0.5, "Laisse retomber entre les jambes", { hip: [-0.27, 0.83], t: 68, hd: 50, ...LEGS([0.06, 0.08]), ...BOTH([-0.05, 0.5]) }, "in")] };

/* ---------- haut du corps : poussées ---------- */
function mvBench(kind, load) {
  const incl = kind === "incline";
  const tB = incl ? -52 : -90, hipB = incl ? [0.05, 0.55] : [0.12, 0.5];
  const props = incl ? [{ k: "poly", pts: [[-0.25, 0.42], [0.25, 0.42], [-0.35, 0.95], [-0.55, 0.95]] }, { k: "bench", x: -0.05, w: 0.4, h: 0.42 }] : [{ k: "bench", x: -0.8, w: 1.25, h: 0.42 }];
  const shp = mvAdd(hipB, mvUp(tB), MOT_L.tr);
  const topH = incl ? [shp[0] + 0.12, shp[1] + 0.56] : [shp[0] + 0.03, shp[1] + 0.56];
  const botH = incl ? [shp[0] + 0.2, shp[1] + 0.12] : [shp[0] + 0.12, shp[1] + 0.14];
  const legs = { ...LEGS([0.55, 0.08]), kb1: 1, kb2: 1 };
  const p = { hip: hipB, t: tB, hd: tB, ...legs };
  return { n: incl ? "Développé incliné" : "Développé couché", trail: load === "bar" ? "hands" : null, props: [...props, ...(load === "bar" ? [{ k: "plate", at: "hands" }] : DB2)],
    keys: [K(0.6, "Bras tendus", { ...p, ...BOTH(topH), eb1: -1, eb2: -1 }), K(1.5, "Descends à la poitrine", { ...p, ...BOTH(botH), eb1: -1, eb2: -1 }), K(0.25, "", { ...p, ...BOTH(botH), eb1: -1, eb2: -1 }), K(1, "Pousse", { ...p, ...BOTH(topH), eb1: -1, eb2: -1 })] };
}
MOVES.bench_bar = mvBench("flat", "bar");
MOVES.bench_db = mvBench("flat", "db");
MOVES.bench_incline = mvBench("incline", "db");
function mvPushup(kind) {
  const handsY = kind === "incline" ? 0.47 : 0.03;
  const ank = kind === "decline" ? [-0.95, 0.52] : kind === "knees" ? null : [-0.95, 0.12];
  const props = [MAT()];
  if (kind === "incline") props.push({ k: "bench", x: 0.05, w: 0.55, h: 0.45 });
  if (kind === "decline") props.push({ k: "bench", x: -1.25, w: 0.5, h: 0.45 });
  const pose = (shY) => {
    if (kind === "knees") {
      const knee = [-0.35, 0.07];
      const ang = Math.asin(Math.min(0.99, (shY - knee[1]) / (MOT_L.th + MOT_L.tr)));
      const hip = [knee[0] + MOT_L.th * Math.cos(ang), knee[1] + MOT_L.th * Math.sin(ang)];
      const t = 90 - ang / MOT_RAD;
      return { hip, t, hd: t, L1: [-0.62, 0.36], L2: [-0.64, 0.38], kb1: 1, kb2: 1, F1: 150, F2: 150 };
    }
    const Lb = MOT_L.th + MOT_L.sh + MOT_L.tr;
    const ang = Math.asin(Math.max(-0.9, Math.min(0.95, (shY - ank[1]) / Lb)));
    const hip = [ank[0] + (MOT_L.th + MOT_L.sh) * Math.cos(ang), ank[1] + (MOT_L.th + MOT_L.sh) * Math.sin(ang)];
    const t = 90 - ang / MOT_RAD;
    return { hip, t, hd: t, L1: ank, L2: [ank[0] - 0.02, ank[1]], F1: 70, F2: 70 };
  };
  const hx = kind === "incline" ? 0.38 : kind === "knees" ? 0.2 : 0.33;
  const up = { ...pose(handsY + 0.6), ...BOTH([hx, handsY]), eb1: -1, eb2: -1 };
  const dn = { ...pose(handsY + 0.17), ...BOTH([hx, handsY]), eb1: -1, eb2: -1 };
  return { n: { incline: "Pompes inclinées", decline: "Pompes pieds surélevés", knees: "Pompes sur les genoux" }[kind] || "Pompes", props,
    keys: [K(0.5, "Gainage, bras tendus", up), K(1.3, "Descends la poitrine", dn), K(0.2, "", dn), K(0.9, "Pousse le sol", up)], note: "Corps aligné de la tête aux talons, coudes à 45°." };
}
MOVES.pushup = mvPushup("floor");
MOVES.pushup_incline = mvPushup("incline");
MOVES.pushup_decline = mvPushup("decline");
MOVES.pushup_knees = mvPushup("knees");
function mvPress(kind) {
  const top = [0.0, 2.04], rack = [0.13, 1.5];
  const st = { ...STAND, t: -2, ...LEGS([0.03, 0.08]) };
  const dip = { hip: [-0.06, 0.84], t: 2, ...LEGS([0.03, 0.08]) };
  const props = kind === "db" ? DB2 : [{ k: "plate", at: "hands" }];
  if (kind === "push_press") return { n: "Push press", trail: "hands", props, keys: [K(0.5, "Barre sur les épaules", { ...st, ...BOTH(rack) }), K(0.35, "Fléchis légèrement", { ...dip, ...BOTH([0.13, 1.4]) }), K(0.4, "Pousse avec les jambes", { ...st, hip: [0, 0.96], ...LEGS([0.03, 0.12]), F1: 25, F2: 25, ...BOTH([0.05, 1.8]) }, "out"),
    K(0.4, "Bras verrouillés", { ...st, ...BOTH(top) }), K(0.9, "Ramène sur les épaules", { ...st, ...BOTH(rack) })] };
  if (kind === "jerk") return { n: "Jeté poussé", trail: "hands", props, keys: [K(0.5, "Barre sur les épaules", { ...st, ...BOTH(rack) }), K(0.35, "Fléchis", { ...dip, ...BOTH([0.13, 1.4]) }), K(0.3, "Pousse", { ...st, hip: [0, 0.97], ...LEGS([0.03, 0.13]), F1: 28, F2: 28, ...BOTH([0.05, 1.75]) }, "out"),
    K(0.3, "Passe sous la barre", { hip: [-0.08, 0.8], t: 3, ...LEGS([0.03, 0.08]), ...BOTH([0.0, 1.88]) }), K(0.7, "Redresse-toi", { ...st, ...BOTH(top) }), K(0.9, "", { ...st, ...BOTH(rack) })] };
  return { n: "Développé militaire", trail: "hands", props, keys: [K(0.5, "Départ aux épaules", { ...st, ...BOTH(rack) }), K(1, "Pousse au-dessus de la tête", { ...st, ...BOTH(top) }), K(0.3, "Bras verrouillés", { ...st, ...BOTH(top) }), K(1.2, "Redescends", { ...st, ...BOTH(rack) })], note: "Gainage serré, la tête passe sous la barre." };
}
MOVES.ohp_bar = mvPress("bar");
MOVES.ohp_db = mvPress("db");
MOVES.push_press = mvPress("push_press");
MOVES.push_jerk = mvPress("jerk");
MOVES.landmine = { n: "Développé landmine", props: [{ k: "bar", from: [-1.0, 0.04], to: "h1" }],
  keys: [K(0.6, "Barre à l'épaule", { ...STAND, t: 8, L1: [0.25, 0.08], L2: [-0.3, 0.08], A1: [0.12, 1.42], eb1: -1, A2: { ua: 10, fa: 40 } }), K(1, "Pousse vers l'avant et le haut", { ...STAND, t: 12, L1: [0.25, 0.08], L2: [-0.3, 0.08], A1: [0.5, 1.88], A2: { ua: 10, fa: 40 } }), K(1.2, "Redescends", { ...STAND, t: 8, L1: [0.25, 0.08], L2: [-0.3, 0.08], A1: [0.12, 1.42], eb1: -1, A2: { ua: 10, fa: 40 } })] };
MOVES.dips = { n: "Dips", ground: true, props: [{ k: "rail", x: -0.05, w: 0.35, h: 0.04, y: 1.08 }, { k: "rail", x: 0.08, w: 0.04, h: 1.08 }],
  keys: [K(0.5, "Bras tendus", { hip: [-0.04, 1.17], t: 8, hd: 5, L1: { th: 15, sh: -55 }, L2: { th: 10, sh: -60 }, F1: 30, F2: 30, ...BOTH([0.1, 1.12]) }), K(1.4, "Descends, buste un peu penché", { hip: [-0.16, 0.86], t: 28, hd: 20, L1: { th: 15, sh: -55 }, L2: { th: 10, sh: -60 }, F1: 30, F2: 30, ...BOTH([0.1, 1.12]) }),
    K(1, "Pousse", { hip: [-0.04, 1.17], t: 8, hd: 5, L1: { th: 15, sh: -55 }, L2: { th: 10, sh: -60 }, F1: 30, F2: 30, ...BOTH([0.1, 1.12]) })] };
MOVES.bench_dips = { n: "Dips sur une chaise", props: [{ k: "bench", x: -0.65, w: 0.45, h: 0.45 }],
  keys: [K(0.5, "Mains sur le bord", { hip: [-0.12, 0.42], t: 0, hd: 0, ...LEGS([0.55, 0.08]), kb1: 1, kb2: 1, ...BOTH([-0.3, 0.47]), eb1: 1, eb2: 1 }), K(1.3, "Descends", { hip: [-0.12, 0.17], t: -3, hd: 0, ...LEGS([0.55, 0.08]), ...BOTH([-0.3, 0.47]), eb1: 1, eb2: 1 }), K(1, "Pousse", { hip: [-0.12, 0.42], t: 0, hd: 0, ...LEGS([0.55, 0.08]), ...BOTH([-0.3, 0.47]), eb1: 1, eb2: 1 })] };

/* ---------- haut du corps : tirages ---------- */
MOVES.pullup = { n: "Tractions", ground: false, props: [{ k: "pullbar", x: 0.05, y: 2.28 }],
  keys: [K(0.6, "Suspendu, bras tendus", { hip: [0.0, 1.2], t: 2, hd: 5, L1: { th: 8, sh: -25 }, L2: { th: 4, sh: -30 }, F1: 40, F2: 40, ...BOTH([0.05, 2.27]) }), K(1, "Tire les coudes vers les côtes", { hip: [0.0, 1.6], t: -6, hd: 0, L1: { th: 12, sh: -25 }, L2: { th: 8, sh: -30 }, F1: 40, F2: 40, ...BOTH([0.05, 2.27]) }),
    K(0.4, "Menton au-dessus de la barre", { hip: [0.0, 1.62], t: -6, hd: 0, L1: { th: 12, sh: -25 }, L2: { th: 8, sh: -30 }, F1: 40, F2: 40, ...BOTH([0.05, 2.27]) }), K(1.4, "Redescends en contrôlant", { hip: [0.0, 1.2], t: 2, hd: 5, L1: { th: 8, sh: -25 }, L2: { th: 4, sh: -30 }, F1: 40, F2: 40, ...BOTH([0.05, 2.27]) })] };
MOVES.pullup_band = { ...MOVES.pullup, n: "Tractions assistées", props: [{ k: "pullbar", x: 0.05, y: 2.28 }, { k: "band", from: [0.05, 2.27], to: "k1" }] };
MOVES.pulldown = { n: "Tirage vertical", props: [{ k: "seat", x: -0.3, w: 0.45, h: 0.45 }, { k: "band", from: [0.15, 2.4], to: "hands" }],
  keys: [K(0.6, "Bras tendus", { hip: [-0.1, 0.5], t: -8, hd: -5, ...LEGS([0.4, 0.08]), kb1: 1, kb2: 1, ...BOTH([0.12, 1.6]) }), K(1, "Tire vers le haut de la poitrine", { hip: [-0.1, 0.5], t: -15, hd: -10, ...LEGS([0.4, 0.08]), ...BOTH([0.08, 1.06]) }), K(1.3, "Remonte lentement", { hip: [-0.1, 0.5], t: -8, hd: -5, ...LEGS([0.4, 0.08]), ...BOTH([0.12, 1.6]) })] };
MOVES.row_bent = { n: "Rowing buste penché", props: [{ k: "plate", at: "hands" }],
  keys: [K(0.6, "Buste penché, dos plat", { hip: [-0.3, 0.82], t: 62, hd: 50, ...LEGS([0.03, 0.08]), ...BOTH([0.17, 0.5]) }), K(1, "Tire vers le nombril", { hip: [-0.3, 0.82], t: 62, hd: 50, ...LEGS([0.03, 0.08]), ...BOTH([-0.08, 0.83]) }),
    K(0.3, "Serre les omoplates", { hip: [-0.3, 0.82], t: 62, hd: 50, ...LEGS([0.03, 0.08]), ...BOTH([-0.08, 0.83]) }), K(1.2, "Redescends", { hip: [-0.3, 0.82], t: 62, hd: 50, ...LEGS([0.03, 0.08]), ...BOTH([0.17, 0.5]) })] };
MOVES.row_one = { n: "Rowing haltère un bras", props: [{ k: "bench", x: 0.25, w: 0.7, h: 0.5 }, { k: "db", at: "h1" }],
  keys: [K(0.6, "Main d'appui sur le banc", { hip: [-0.25, 0.86], t: 76, hd: 70, L1: [0.1, 0.08], L2: [-0.35, 0.08], A1: [0.22, 0.32], A2: [0.5, 0.52], eb2: -1 }), K(1, "Tire le coude vers la hanche", { hip: [-0.25, 0.86], t: 76, hd: 70, L1: [0.1, 0.08], L2: [-0.35, 0.08], A1: [-0.05, 0.76], A2: [0.5, 0.52] }),
    K(1.2, "Redescends", { hip: [-0.25, 0.86], t: 76, hd: 70, L1: [0.1, 0.08], L2: [-0.35, 0.08], A1: [0.22, 0.32], A2: [0.5, 0.52] })] };
MOVES.row_inverted = { n: "Rowing inversé", ground: true, props: [{ k: "rail", x: -0.2, w: 0.4, h: 0.04, y: 1.06 }],
  keys: [K(0.6, "Bras tendus, corps gainé", { hip: [0.45, 0.33], t: -71, hd: -70, ...LEGS([1.2, 0.08]), F1: -60, F2: -60, ...BOTH([0.0, 1.06]), eb1: -1, eb2: -1 }), K(1, "Tire la poitrine à la barre", { hip: [0.48, 0.56], t: -56, hd: -55, ...LEGS([1.2, 0.08]), F1: -60, F2: -60, ...BOTH([0.0, 1.06]), eb1: -1, eb2: -1 }),
    K(1.2, "Redescends", { hip: [0.45, 0.33], t: -71, hd: -70, ...LEGS([1.2, 0.08]), F1: -60, F2: -60, ...BOTH([0.0, 1.06]), eb1: -1, eb2: -1 })] };
MOVES.row_band = { n: "Tirage horizontal à l'élastique", props: [{ k: "band", from: [1.35, 1.12], to: "hands" }],
  keys: [K(0.6, "Bras tendus devant", { ...STAND, hip: [-0.04, 0.9], t: 3, ...LEGS([0.05, 0.08]), ...BOTH([0.55, 1.15]) }), K(1, "Coudes vers l'arrière", { ...STAND, hip: [-0.04, 0.9], t: 0, ...LEGS([0.05, 0.08]), ...BOTH([0.1, 1.12]) }),
    K(0.4, "Serre les omoplates", { ...STAND, hip: [-0.04, 0.9], t: 0, ...LEGS([0.05, 0.08]), ...BOTH([0.1, 1.12]) }), K(1.2, "Relâche lentement", { ...STAND, hip: [-0.04, 0.9], t: 3, ...LEGS([0.05, 0.08]), ...BOTH([0.55, 1.15]) })] };
MOVES.face_pull = { n: "Face pull", props: [{ k: "band", from: [1.35, 1.75], to: "hands" }],
  keys: [K(0.6, "Bras tendus vers le haut", { ...STAND, t: -2, ...LEGS([0.05, 0.08]), ...BOTH([0.52, 1.66]), eb1: 1, eb2: 1 }), K(1, "Tire vers le front, coudes hauts", { ...STAND, t: -3, ...LEGS([0.05, 0.08]), ...BOTH([0.16, 1.72]), eb1: 1, eb2: 1 }),
    K(0.4, "", { ...STAND, t: -3, ...LEGS([0.05, 0.08]), ...BOTH([0.16, 1.72]), eb1: 1, eb2: 1 }), K(1.1, "Relâche", { ...STAND, t: -2, ...LEGS([0.05, 0.08]), ...BOTH([0.52, 1.66]), eb1: 1, eb2: 1 })] };
MOVES.curl = { n: "Curl biceps", props: DB2,
  keys: [K(0.5, "Bras tendus", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: -3, fa: 2 }) }), K(1, "Fléchis sans bouger les coudes", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: -3, fa: 150 }) }), K(0.3, "", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: -3, fa: 150 }) }), K(1.3, "Redescends lentement", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: -3, fa: 2 }) })] };
MOVES.triceps = { n: "Extension des triceps", props: [{ k: "db", at: "hands" }],
  keys: [K(0.5, "Haltère derrière la tête", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 172, fa: -20 }) }), K(1, "Tends les bras", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 174, fa: 178 }) }), K(1.3, "Redescends", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 172, fa: -20 }) })] };
MOVES.lateral_raise = { n: "Élévations latérales", view: "front", props: DB2,
  keys: [K(0.5, "Bras le long du corps", { ...STAND, ...LEGS([0.14, 0.08], [-0.14, 0.08]), ...BOTH({ ua: 8, fa: 12 }) }), K(1, "Monte jusqu'aux épaules", { ...STAND, ...LEGS([0.14, 0.08], [-0.14, 0.08]), ...BOTH({ ua: 85, fa: 90 }) }), K(0.3, "", { ...STAND, ...LEGS([0.14, 0.08], [-0.14, 0.08]), ...BOTH({ ua: 85, fa: 90 }) }), K(1.3, "Redescends lentement", { ...STAND, ...LEGS([0.14, 0.08], [-0.14, 0.08]), ...BOTH({ ua: 8, fa: 12 }) })] };

/* ---------- aides : corps aligné entre deux points ---------- */
function mvLine2(ank, sh) {
  const len = Math.hypot(sh[0] - ank[0], sh[1] - ank[1]) || 1;
  const k = (MOT_L.th + MOT_L.sh) / (MOT_L.th + MOT_L.sh + MOT_L.tr);
  const hip = [ank[0] + (sh[0] - ank[0]) * k, ank[1] + (sh[1] - ank[1]) * k];
  return { hip, t: Math.atan2(sh[0] - hip[0], sh[1] - hip[1]) / MOT_RAD, len };
}
const PLANK_HI = (() => { const b = mvLine2([-0.95, 0.12], [0.3, 0.63]); return { ...b, hd: b.t, L1: [-0.95, 0.12], L2: [-0.97, 0.12], F1: 70, F2: 70, ...BOTH([0.32, 0.03]), eb1: -1, eb2: -1 }; })();
const PLANK_LO = (() => { const b = mvLine2([-1.05, 0.12], [0.24, 0.38]); return { ...b, hd: b.t, L1: [-1.05, 0.12], L2: [-1.07, 0.12], F1: 70, F2: 70, ...BOTH({ ua: 0, fa: 90 }) }; })();

/* ---------- tronc ---------- */
MOVES.plank = { n: "Gainage planche", props: [MAT()], keys: [K(2, "Inspire, gaine", PLANK_LO), K(2, "Expire, serre les fessiers", { ...PLANK_LO, hip: [PLANK_LO.hip[0], PLANK_LO.hip[1] + 0.012] })], note: "Corps aligné, ventre rentré, ne creuse pas le dos." };
MOVES.plank_taps = { n: "Planche, touchers d'épaule", props: [MAT()],
  keys: [K(0.5, "Planche bras tendus", PLANK_HI), K(0.45, "Main droite à l'épaule opposée", { ...PLANK_HI, A1: { rel: "sh", d: [0.02, -0.05] }, eb1: 1 }), K(0.45, "", PLANK_HI), K(0.45, "Main gauche", { ...PLANK_HI, A2: { rel: "sh", d: [0.0, -0.05] }, eb2: 1 }), K(0.45, "", PLANK_HI)] };
MOVES.side_plank = { n: "Gainage latéral", view: "front", props: [MAT()],
  keys: [K(1.2, "Hanches basses", { ...mvLine2([-1.0, 0.1], [0.28, 0.6]), hip: [-0.2, 0.25], L1: [-1.0, 0.1], L2: [-1.02, 0.2], kb1: 1, kb2: 1, A1: [0.32, 0.03], A2: { ua: 150, fa: 160 }, eb1: 1 }),
    K(1, "Monte les hanches", { ...mvLine2([-1.0, 0.1], [0.28, 0.6]), L1: [-1.0, 0.1], L2: [-1.02, 0.2], A1: [0.32, 0.03], A2: { ua: 175, fa: 178 }, eb1: 1 }), K(2, "Tiens, corps aligné", { ...mvLine2([-1.0, 0.1], [0.28, 0.6]), L1: [-1.0, 0.1], L2: [-1.02, 0.2], A1: [0.32, 0.03], A2: { ua: 175, fa: 178 }, eb1: 1 })] };
MOVES.copenhagen = { n: "Gainage Copenhague", view: "front", props: [MAT(), { k: "bench", x: -1.45, w: 0.5, h: 0.45 }],
  keys: [K(1, "Jambe du dessus sur le banc", { ...mvLine2([-1.1, 0.5], [0.25, 0.62]), hip: [-0.15, 0.3], L1: [-0.95, 0.08], L2: [-1.12, 0.52], kb1: 1, kb2: 1, A1: [0.28, 0.03], A2: { ua: 170, fa: 175 }, eb1: 1 }),
    K(1.2, "Monte : la jambe du dessous rejoint le banc", { ...mvLine2([-1.1, 0.5], [0.25, 0.62]), L1: [-1.1, 0.42], L2: [-1.12, 0.52], A1: [0.28, 0.03], A2: { ua: 170, fa: 175 }, eb1: 1 }),
    K(1.5, "Tiens", { ...mvLine2([-1.1, 0.5], [0.25, 0.62]), L1: [-1.1, 0.42], L2: [-1.12, 0.52], A1: [0.28, 0.03], A2: { ua: 170, fa: 175 }, eb1: 1 })] };
MOVES.dead_bug = { n: "Dead bug", props: [MAT()],
  keys: [K(0.6, "Bras au plafond, jambes à 90°", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: 178, sh: 90 }, L2: { th: 176, sh: 88 }, A1: { ua: 178, fa: 178 }, A2: { ua: 176, fa: 176 } }),
    K(1.2, "Allonge un bras et la jambe opposée", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: 100, sh: 96 }, L2: { th: 176, sh: 88 }, A1: { ua: 178, fa: 178 }, A2: { ua: -100, fa: -100 } }),
    K(0.8, "Reviens", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: 178, sh: 90 }, L2: { th: 176, sh: 88 }, A1: { ua: 178, fa: 178 }, A2: { ua: 176, fa: 176 } }),
    K(1.2, "Autre côté", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: 178, sh: 90 }, L2: { th: 100, sh: 96 }, A1: { ua: -100, fa: -100 }, A2: { ua: 176, fa: 176 } }),
    K(0.8, "", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: 178, sh: 90 }, L2: { th: 176, sh: 88 }, A1: { ua: 178, fa: 178 }, A2: { ua: 176, fa: 176 } })], note: "Le bas du dos reste collé au sol." };
const QUAD = { hip: [-0.1, 0.5], t: 90, hd: 80, L1: { th: 0, sh: -90 }, L2: { th: 2, sh: -88 }, F1: 170, F2: 170, ...BOTH([0.42, 0.03]) };
MOVES.bird_dog = { n: "Bird dog", props: [MAT()],
  keys: [K(0.6, "À quatre pattes", QUAD), K(1.2, "Allonge bras et jambe opposée", { ...QUAD, A2: { ua: 92, fa: 92 }, L1: { th: -88, sh: -88 }, F1: 100 }), K(1, "Tiens, bassin stable", { ...QUAD, A2: { ua: 92, fa: 92 }, L1: { th: -88, sh: -88 }, F1: 100 }), K(0.8, "Reviens", QUAD),
    K(1.2, "Autre côté", { ...QUAD, A1: { ua: 92, fa: 92 }, L2: { th: -88, sh: -88 }, F2: 100 }), K(1, "", { ...QUAD, A1: { ua: 92, fa: 92 }, L2: { th: -88, sh: -88 }, F2: 100 }), K(0.8, "", QUAD)] };
MOVES.cat_cow = { n: "Chat-vache", props: [MAT()],
  keys: [K(0.4, "À quatre pattes", QUAD), K(2, "Inspire : creuse le dos, regarde devant", { ...QUAD, cb: -0.05, hd: 55, hip: [-0.1, 0.49] }), K(2.2, "Expire : arrondis le dos", { ...QUAD, cb: 0.07, hd: 140, hip: [-0.1, 0.51] }), K(0.6, "", QUAD)] };
MOVES.thoracic_rot = { n: "Rotations thoraciques", props: [MAT()],
  keys: [K(0.6, "À quatre pattes", QUAD), K(1.4, "Ouvre le bras vers le plafond", { ...QUAD, A1: { ua: 178, fa: 178 }, hd: 20 }), K(0.6, "Suis ta main du regard", { ...QUAD, A1: { ua: 178, fa: 178 }, hd: 10 }), K(1.4, "Passe le bras dessous", { ...QUAD, A1: { ua: -60, fa: -80 }, hd: 120, hip: [-0.12, 0.46] }), K(0.6, "", QUAD)] };
MOVES.pallof = { n: "Pallof press", props: [{ k: "band", from: [0.05, 1.18], to: "hands" }],
  keys: [K(0.6, "Mains contre la poitrine", { hip: [-0.05, 0.88], t: 3, L1: [0.2, 0.08], L2: [-0.2, 0.08], ...BOTH([0.15, 1.2]) }), K(1, "Pousse devant, ne tourne pas", { hip: [-0.05, 0.88], t: 3, L1: [0.2, 0.08], L2: [-0.2, 0.08], ...BOTH([0.55, 1.2]) }), K(1.5, "Tiens 2 secondes", { hip: [-0.05, 0.88], t: 3, L1: [0.2, 0.08], L2: [-0.2, 0.08], ...BOTH([0.55, 1.2]) }), K(0.9, "Reviens", { hip: [-0.05, 0.88], t: 3, L1: [0.2, 0.08], L2: [-0.2, 0.08], ...BOTH([0.15, 1.2]) })] };
MOVES.rollout = { n: "Roulette abdominale", props: [MAT(), { k: "roller", at: "hands", dy: -0.08, r: 0.09 }],
  keys: [K(0.6, "À genoux, mains sur la roue", { hip: [-0.02, 0.5], t: 48, hd: 45, L1: { th: 0, sh: -90 }, L2: { th: 0, sh: -90 }, F1: 160, F2: 160, ...BOTH([0.38, 0.17]) }),
    K(1.8, "Roule devant, dos neutre", { hip: [0.18, 0.3], t: 82, hd: 80, L1: { th: -25, sh: -90 }, L2: { th: -25, sh: -90 }, F1: 160, F2: 160, ...BOTH([1.0, 0.17]) }),
    K(1.2, "Reviens en contractant les abdos", { hip: [-0.02, 0.5], t: 48, hd: 45, L1: { th: 0, sh: -90 }, L2: { th: 0, sh: -90 }, F1: 160, F2: 160, ...BOTH([0.38, 0.17]) })] };
MOVES.hollow = { n: "Hollow hold", props: [MAT()],
  keys: [K(2, "Épaules et jambes décollées", { hip: [0, 0.11], t: -76, hd: -70, cb: -0.03, L1: { th: 100, sh: 100 }, L2: { th: 99, sh: 99 }, A1: { ua: -112, fa: -112 }, A2: { ua: -110, fa: -110 }, F1: -10, F2: -10 }),
    K(2, "Respire sans décoller le bas du dos", { hip: [0, 0.11], t: -78, hd: -72, cb: -0.03, L1: { th: 98, sh: 98 }, L2: { th: 97, sh: 97 }, A1: { ua: -110, fa: -110 }, A2: { ua: -108, fa: -108 }, F1: -10, F2: -10 })] };
MOVES.crunch = { n: "Crunch", props: [MAT()],
  keys: [K(0.6, "Allongé, genoux pliés", { hip: [0, 0.11], t: -92, hd: -92, L1: [0.45, 0.08], L2: [0.43, 0.08], A1: { rel: "head", d: [-0.05, 0.0] }, A2: { rel: "head", d: [-0.07, 0.0] }, eb1: 1, eb2: 1 }),
    K(1, "Enroule le haut du dos", { hip: [0, 0.11], t: -58, hd: -45, cb: 0.05, L1: [0.45, 0.08], L2: [0.43, 0.08], A1: { rel: "head", d: [-0.05, 0.0] }, A2: { rel: "head", d: [-0.07, 0.0] }, eb1: 1, eb2: 1 }),
    K(1.2, "Redescends lentement", { hip: [0, 0.11], t: -92, hd: -92, L1: [0.45, 0.08], L2: [0.43, 0.08], A1: { rel: "head", d: [-0.05, 0.0] }, A2: { rel: "head", d: [-0.07, 0.0] }, eb1: 1, eb2: 1 })] };
MOVES.superman = { n: "Superman", props: [MAT()],
  keys: [K(0.6, "Allongé sur le ventre", { hip: [0, 0.1], t: 92, hd: 92, L1: { th: -92, sh: -92 }, L2: { th: -91, sh: -91 }, F1: 175, F2: 175, ...BOTH({ ua: 92, fa: 92 }) }),
    K(1, "Décolle bras, buste et jambes", { hip: [0, 0.1], t: 78, hd: 76, cb: -0.03, L1: { th: -103, sh: -103 }, L2: { th: -102, sh: -102 }, F1: 175, F2: 175, ...BOTH({ ua: 108, fa: 108 }) }),
    K(1.5, "Tiens, regarde le sol", { hip: [0, 0.1], t: 78, hd: 76, cb: -0.03, L1: { th: -103, sh: -103 }, L2: { th: -102, sh: -102 }, F1: 175, F2: 175, ...BOTH({ ua: 108, fa: 108 }) }),
    K(0.9, "Repose", { hip: [0, 0.1], t: 92, hd: 92, L1: { th: -92, sh: -92 }, L2: { th: -91, sh: -91 }, F1: 175, F2: 175, ...BOTH({ ua: 92, fa: 92 }) })] };
MOVES.hanging_raise = { n: "Relevés de jambes", ground: false, props: [{ k: "pullbar", x: 0.0, y: 2.28 }],
  keys: [K(0.6, "Suspendu", { hip: [0.0, 1.2], t: 0, hd: 0, ...LEGS({ th: 2, sh: 2 }, { th: 0, sh: 0 }), ...BOTH([0.0, 2.27]) }), K(1.1, "Monte les jambes sans balancer", { hip: [-0.04, 1.24], t: -6, hd: 0, cb: 0.03, L1: { th: 95, sh: 95 }, L2: { th: 93, sh: 93 }, ...BOTH([0.0, 2.27]) }),
    K(1.4, "Redescends lentement", { hip: [0.0, 1.2], t: 0, hd: 0, ...LEGS({ th: 2, sh: 2 }, { th: 0, sh: 0 }), ...BOTH([0.0, 2.27]) })] };
function mvWalk(load, speed) {
  const s = speed || 0.32;
  const arm = (k) => (load ? { ua: 0, fa: 0 } : { ua: 22 * k, fa: 22 * k + 18 });
  const ph = (a, b, sg) => ({ hip: [0, 0.92 + (sg ? 0.015 : 0)], t: 3, L1: a, L2: b, F1: a.th < 0 ? 25 : 0, F2: b.th < 0 ? 25 : 0, A1: arm(-Math.sign(a.th || 1)), A2: arm(-Math.sign(b.th || 1)) });
  return { n: load ? "Marche avec charge" : "Marche", props: load === 2 ? DB2 : load === 1 ? [{ k: "kb", at: "h1" }] : [],
    keys: [K(s, "", ph({ th: 22, sh: 12 }, { th: -18, sh: -30 }), "lin"), K(s, "", ph({ th: 0, sh: -4 }, { th: 18, sh: -35 }, 1), "lin"), K(s, "", ph({ th: -18, sh: -30 }, { th: 22, sh: 12 }), "lin"), K(s, "", ph({ th: 18, sh: -35 }, { th: 0, sh: -4 }, 1), "lin")] };
}
MOVES.walk = mvWalk(0);
MOVES.carry2 = mvWalk(2, 0.36);
MOVES.carry1 = { ...mvWalk(1, 0.36), n: "Portage valise" };
function mvRun(kind) {
  const sp = kind === "sprint" ? 0.14 : kind === "bound" ? 0.22 : 0.17;
  const amp = kind === "sprint" ? 1.25 : kind === "bound" ? 1.35 : 0.85;
  const lean = kind === "sprint" ? 14 : kind === "bound" ? 8 : 6;
  const k = (x) => x * amp;
  const armF = { ua: k(48), fa: k(48) + 75 }, armB = { ua: -k(42), fa: -k(42) + 85 };
  const ph = [
    { L1: { th: k(22), sh: 4 }, L2: { th: k(62), sh: -k(30) }, F1: -6, F2: 5, A1: armB, A2: armF, y: 0.895 },
    { L1: { th: 0, sh: -8 }, L2: { th: k(48), sh: -k(62) }, F1: 2, F2: 10, A1: { ua: -10, fa: 75 }, A2: { ua: 15, fa: 100 }, y: 0.91 },
    { L1: { th: -k(24), sh: -k(36) }, L2: { th: k(54), sh: k(6) }, F1: 42, F2: 0, A1: armF, A2: armB, y: 0.95 },
    { L1: { th: -k(8), sh: -k(95) }, L2: { th: k(32), sh: 6 }, F1: 25, F2: -5, A1: armF, A2: armB, y: kind === "bound" ? 1.04 : 0.975 },
  ];
  const mk = (p, swap) => ({ hip: [0, p.y], t: lean, hd: lean * 0.6, L1: swap ? p.L2 : p.L1, L2: swap ? p.L1 : p.L2, F1: swap ? p.F2 : p.F1, F2: swap ? p.F1 : p.F2, A1: swap ? p.A2 : p.A1, A2: swap ? p.A1 : p.A2 });
  const keys = [...ph.map((p) => K(sp, "", mk(p, false), "lin")), ...ph.map((p) => K(sp, "", mk(p, true), "lin"))];
  return { n: { sprint: "Sprint", bound: "Bondissements", run: "Course" }[kind] || "Course", keys, note: kind === "sprint" ? "Buste légèrement penché, appuis sous le bassin, bras actifs." : "Foulée relâchée, appuis légers sous le bassin." };
}
MOVES.run = mvRun("run");
MOVES.sprint = mvRun("sprint");
MOVES.bounds = mvRun("bound");
MOVES.sprint_resist = { ...MOVES.sprint, n: "Sprint résisté", props: [{ k: "band", from: [-1.2, 0.9], to: "hip" }] };
MOVES.hill = { ...MOVES.sprint, n: "Sprint en côte", props: [{ k: "poly", pts: [[-0.9, -0.02], [0.9, 0.0], [0.9, -0.02]] }] };
MOVES.start_3pt = { n: "Départ 3 appuis",
  keys: [K(0.8, "Position 3 appuis", { hip: [-0.3, 0.72], t: 62, hd: 55, L1: [0.15, 0.08], L2: [-0.55, 0.1], F2: 40, A1: [0.42, 0.03], A2: { ua: -60, fa: -40 }, eb1: -1 }),
    K(0.25, "Pousse fort", { hip: [0.05, 0.86], t: 45, hd: 35, L1: [0.15, 0.1], L2: { th: 60, sh: -30 }, F1: 35, A1: { ua: -50, fa: 40 }, A2: { ua: 60, fa: 130 } }, "out"),
    K(0.22, "Premiers appuis", { hip: [0.35, 0.88], t: 35, hd: 25, L1: { th: -30, sh: -40 }, L2: { th: 40, sh: 0 }, F1: 40, A1: { ua: 55, fa: 130 }, A2: { ua: -50, fa: 40 } }), K(0.9, "", { hip: [-0.3, 0.72], t: 62, hd: 55, L1: [0.15, 0.08], L2: [-0.55, 0.1], F2: 40, A1: [0.42, 0.03], A2: { ua: -60, fa: -40 }, eb1: -1 })] };
MOVES.a_skip = { n: "Montées de genoux",
  keys: [K(0.22, "Genou haut, pied armé", { hip: [0, 0.96], t: 2, L1: { th: 88, sh: -2 }, L2: [0.0, 0.14], F2: 30, F1: -15, A1: { ua: -40, fa: 50 }, A2: { ua: 50, fa: 130 } }), K(0.2, "Griffe le sol", { hip: [0, 0.93], t: 2, L1: [0.04, 0.1], L2: [0.0, 0.12], F1: 10, F2: 20, A1: { ua: 0, fa: 90 }, A2: { ua: 0, fa: 90 } }),
    K(0.22, "Autre genou", { hip: [0, 0.96], t: 2, L2: { th: 88, sh: -2 }, L1: [0.0, 0.14], F1: 30, F2: -15, A2: { ua: -40, fa: 50 }, A1: { ua: 50, fa: 130 } }), K(0.2, "", { hip: [0, 0.93], t: 2, L1: [0.0, 0.12], L2: [0.04, 0.1], F1: 20, F2: 10, A1: { ua: 0, fa: 90 }, A2: { ua: 0, fa: 90 } })] };
MOVES.butt_kicks = { n: "Talons-fesses",
  keys: [K(0.2, "Talon vers la fesse", { hip: [0, 0.95], t: 4, L1: { th: -8, sh: -165 }, L2: [0.0, 0.12], F2: 25, F1: 40, A1: { ua: -35, fa: 50 }, A2: { ua: 40, fa: 120 } }), K(0.18, "", { hip: [0, 0.93], t: 4, L1: [0.0, 0.11], L2: [0.0, 0.11], F1: 20, F2: 20, A1: { ua: 0, fa: 90 }, A2: { ua: 0, fa: 90 } }),
    K(0.2, "Autre jambe", { hip: [0, 0.95], t: 4, L2: { th: -8, sh: -165 }, L1: [0.0, 0.12], F1: 25, F2: 40, A2: { ua: -35, fa: 50 }, A1: { ua: 40, fa: 120 } }), K(0.18, "", { hip: [0, 0.93], t: 4, L1: [0.0, 0.11], L2: [0.0, 0.11], F1: 20, F2: 20, A1: { ua: 0, fa: 90 }, A2: { ua: 0, fa: 90 } })] };
MOVES.decel = { n: "Décélération",
  keys: [...mvRun("run").keys.slice(0, 4), K(0.35, "Freine : appuis larges, bassin bas", { hip: [-0.15, 0.68], t: 18, hd: 10, L1: [0.4, 0.08], L2: [-0.45, 0.1], F2: 35, A1: { ua: 40, fa: 80 }, A2: { ua: -20, fa: 60 } }, "out"), K(0.6, "Stabilise", { hip: [-0.15, 0.66], t: 20, hd: 10, L1: [0.4, 0.08], L2: [-0.45, 0.1], F2: 35, A1: { ua: 40, fa: 80 }, A2: { ua: -20, fa: 60 } })] };
MOVES.shuffle = { n: "Pas chassés", view: "front",
  keys: [K(0.25, "Appuis écartés, bassin bas", { hip: [0, 0.82], t: 0, L1: [0.32, 0.08], L2: [-0.32, 0.08], ...BOTH({ ua: 25, fa: 70 }) }), K(0.2, "Pousse sur le pied gauche", { hip: [0.12, 0.85], t: 0, L1: [0.46, 0.12], L2: [-0.12, 0.1], ...BOTH({ ua: 25, fa: 70 }) }),
    K(0.25, "", { hip: [0.25, 0.82], t: 0, L1: [0.57, 0.08], L2: [-0.07, 0.08], ...BOTH({ ua: 25, fa: 70 }) }), K(0.2, "Reviens", { hip: [0.12, 0.85], t: 0, L1: [0.4, 0.1], L2: [-0.18, 0.12], ...BOTH({ ua: 25, fa: 70 }) })] };
MOVES.skater = { n: "Sauts du patineur", view: "front",
  keys: [K(0.35, "Réception sur la jambe droite", { hip: [0.45, 0.78], t: 12, L1: [0.55, 0.08], L2: { th: -35, sh: -60 }, kb1: 1, A1: { ua: 35, fa: 50 }, A2: { ua: -40, fa: -10 } }), K(0.3, "Bondis sur le côté", { hip: [0, 1.0], t: 0, L1: [0.12, 0.3], L2: [-0.12, 0.3], A1: { ua: 30, fa: 40 }, A2: { ua: 30, fa: 40 } }, "out"),
    K(0.35, "Réception sur la gauche", { hip: [-0.45, 0.78], t: -12, L2: [-0.55, 0.08], L1: { th: -35, sh: -60 }, A2: { ua: 35, fa: 50 }, A1: { ua: -40, fa: -10 } }, "in"), K(0.3, "", { hip: [0, 1.0], t: 0, L1: [0.12, 0.3], L2: [-0.12, 0.3], A1: { ua: 30, fa: 40 }, A2: { ua: 30, fa: 40 } }, "out")] };

/* ---------- pliométrie ---------- */
MOVES.cmj = { n: "Saut vertical",
  keys: [K(0.5, "Debout", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.45, "Descente rapide, bras en arrière", { hip: [-0.15, 0.64], t: 38, hd: 25, ...LEGS([0.03, 0.08]), ...BOTH({ ua: -55, fa: -45 }) }),
    K(0.25, "Explose vers le haut", { hip: [0.02, 1.25], t: 0, hd: 0, ...LEGS([0.03, 0.4]), F1: 55, F2: 55, ...BOTH({ ua: 165, fa: 170 }) }, "out"), K(0.3, "Réception amortie", { hip: [-0.12, 0.72], t: 25, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 45, fa: 50 }) }, "in"), K(0.5, "", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5, fa: 10 }) })] };
MOVES.box_jump = { n: "Saut sur box", props: [{ k: "box", x: 0.35, w: 0.55, h: 0.5 }],
  keys: [K(0.5, "Face à la box", { ...STAND, ...LEGS([0.0, 0.08]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.45, "Bras en arrière", { hip: [-0.17, 0.62], t: 40, ...LEGS([0.0, 0.08]), ...BOTH({ ua: -55, fa: -45 }) }),
    K(0.28, "Saute, genoux hauts", { hip: [0.32, 1.25], t: 10, ...LEGS([0.5, 0.75]), kb1: 1, kb2: 1, ...BOTH({ ua: 150, fa: 160 }) }, "out"), K(0.25, "Réception douce", { hip: [0.45, 1.02], t: 30, ...LEGS([0.62, 0.58]), ...BOTH({ ua: 70, fa: 70 }) }, "in"),
    K(0.5, "Debout sur la box", { hip: [0.62, 1.43], t: 2, ...LEGS([0.62, 0.58]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.7, "Redescends en marchant", { ...STAND, ...LEGS([0.0, 0.08]), ...BOTH({ ua: 5, fa: 10 }) })] };
MOVES.broad_jump = { n: "Saut en longueur sans élan",
  keys: [K(0.5, "Pieds parallèles", { hip: [-0.6, 0.935], t: 2, ...LEGS([-0.6, 0.08]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.45, "Charge les hanches", { hip: [-0.78, 0.62], t: 45, ...LEGS([-0.6, 0.08]), ...BOTH({ ua: -60, fa: -50 }) }),
    K(0.35, "Projette-toi vers l'avant", { hip: [0.0, 1.05], t: 25, L1: { th: 60, sh: 20 }, L2: { th: 55, sh: 15 }, ...BOTH({ ua: 130, fa: 140 }) }, "lin"), K(0.3, "Réception, genoux fléchis", { hip: [0.45, 0.6], t: 38, ...LEGS([0.65, 0.08]), ...BOTH({ ua: 70, fa: 70 }) }, "in"), K(0.6, "Tiens la réception", { hip: [0.6, 0.9], t: 6, ...LEGS([0.65, 0.08]), ...BOTH({ ua: 10, fa: 20 }) })] };
MOVES.pogo = { n: "Pogo jumps",
  keys: [K(0.18, "Contact bref, chevilles raides", { ...STAND, hip: [0, 0.94], ...LEGS([0.02, 0.09]), F1: 15, F2: 15, ...BOTH({ ua: 15, fa: 80 }) }, "out"), K(0.18, "Rebondis", { ...STAND, hip: [0, 1.06], ...LEGS([0.02, 0.21]), F1: 45, F2: 45, ...BOTH({ ua: 15, fa: 80 }) }, "in")] };
MOVES.hurdle_hops = { n: "Sauts de haies", props: [{ k: "hurdle", x: 0.35, h: 0.3 }, { k: "hurdle", x: -0.5, h: 0.3 }],
  keys: [K(0.3, "Appuis brefs", { hip: [-0.1, 0.82], t: 20, ...LEGS([-0.05, 0.08]), F1: 10, F2: 10, ...BOTH({ ua: -30, fa: 30 }) }), K(0.3, "Genoux hauts par-dessus", { hip: [0.15, 1.25], t: 5, L1: { th: 75, sh: -25 }, L2: { th: 70, sh: -30 }, ...BOTH({ ua: 120, fa: 140 }) }, "out"), K(0.3, "", { hip: [0.5, 0.82], t: 20, ...LEGS([0.55, 0.08]), F1: 10, F2: 10, ...BOTH({ ua: -30, fa: 30 }) }, "in")] };
MOVES.drop_jump = { n: "Drop jump", props: [{ k: "box", x: -0.75, w: 0.5, h: 0.3 }],
  keys: [K(0.6, "Debout sur la box", { hip: [-0.5, 1.235], t: 2, ...LEGS([-0.5, 0.38]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.35, "Laisse-toi tomber", { hip: [-0.1, 1.08], t: 5, L1: { th: 25, sh: 10 }, L2: { th: 20, sh: 8 }, ...BOTH({ ua: 40, fa: 50 }) }),
    K(0.18, "Contact bref", { hip: [0.0, 0.76], t: 22, ...LEGS([0.05, 0.08]), F1: 5, F2: 5, ...BOTH({ ua: -40, fa: -30 }) }), K(0.3, "Rebondis le plus haut possible", { hip: [0.05, 1.25], t: 0, ...LEGS([0.05, 0.4]), F1: 55, F2: 55, ...BOTH({ ua: 165, fa: 170 }) }, "out"), K(0.4, "", { hip: [0.0, 0.8], t: 18, ...LEGS([0.05, 0.08]), ...BOTH({ ua: 40, fa: 40 }) }, "in")] };
MOVES.single_hop = { n: "Sauts unipodaux",
  keys: [K(0.35, "Sur une jambe", { hip: [-0.05, 0.8], t: 18, L1: [0.0, 0.08], L2: { th: 40, sh: -60 }, ...BOTH({ ua: -30, fa: 40 }) }), K(0.3, "Saute vers l'avant", { hip: [0.25, 1.1], t: 10, L1: { th: -10, sh: -30 }, L2: { th: 55, sh: -50 }, F1: 40, ...BOTH({ ua: 80, fa: 120 }) }, "out"),
    K(0.3, "Réception stable sur la même jambe", { hip: [0.5, 0.8], t: 18, L1: [0.55, 0.08], L2: { th: 40, sh: -60 }, ...BOTH({ ua: 30, fa: 60 }) }, "in"), K(0.5, "", { hip: [0.5, 0.88], t: 8, L1: [0.55, 0.08], L2: { th: 30, sh: -70 }, ...BOTH({ ua: 10, fa: 40 }) })] };
MOVES.mb_chest = { n: "Lancer de médecine-ball", props: [{ k: "ball", at: "hands" }],
  keys: [K(0.5, "Ballon contre la poitrine", { hip: [-0.05, 0.85], t: 10, L1: [0.25, 0.08], L2: [-0.25, 0.08], ...BOTH([0.2, 1.3]) }), K(0.35, "Pousse fort vers l'avant", { hip: [0.08, 0.9], t: 18, L1: [0.25, 0.08], L2: [-0.25, 0.15], F2: 35, ...BOTH([0.75, 1.35]) }, "out"), K(0.8, "", { hip: [-0.05, 0.85], t: 10, L1: [0.25, 0.08], L2: [-0.25, 0.08], ...BOTH([0.2, 1.3]) })] };
MOVES.mb_rotation = { n: "Lancer rotatif", props: [{ k: "ball", at: "hands" }],
  keys: [K(0.5, "Ballon à la hanche arrière", { hip: [-0.05, 0.86], t: 8, L1: [0.3, 0.08], L2: [-0.3, 0.08], ...BOTH([-0.35, 1.0]) }), K(0.3, "Pivote et lance", { hip: [0.05, 0.9], t: 6, L1: [0.3, 0.08], L2: [-0.3, 0.14], F2: 40, ...BOTH([0.7, 1.15]) }, "out"), K(0.8, "", { hip: [-0.05, 0.86], t: 8, L1: [0.3, 0.08], L2: [-0.3, 0.08], ...BOTH([-0.35, 1.0]) })] };
MOVES.mb_slam = { n: "Slam ball", props: [{ k: "ball", at: "hands" }],
  keys: [K(0.45, "Ballon au-dessus de la tête", { ...STAND, hip: [0, 0.96], ...LEGS([0.05, 0.12]), F1: 25, F2: 25, ...BOTH([0.0, 2.0]) }), K(0.3, "Frappe le sol", { hip: [-0.2, 0.7], t: 50, ...LEGS([0.05, 0.08]), ...BOTH([0.35, 0.2]) }, "in"), K(0.6, "Ramasse et remonte", { ...STAND, ...LEGS([0.05, 0.08]), ...BOTH([0.1, 1.3]) })] };

/* ---------- haltérophilie ---------- */
function mvOly(kind) {
  const hang = { hip: [-0.2, 0.89], t: 32, hd: 20, ...LEGS([0.03, 0.08]), ...BOTH([0.1, 0.66]) };
  const mid = { hip: [-0.12, 0.9], t: 18, hd: 10, ...LEGS([0.03, 0.08]), ...BOTH([0.07, 0.74]) };
  const ext = { hip: [0.03, 1.03], t: -8, hd: -5, ...LEGS([0.03, 0.18]), F1: 38, F2: 38, ...BOTH([0.05, 0.98]) };
  const pull = { hip: [0.02, 1.02], t: -6, hd: -3, ...LEGS([0.03, 0.17]), F1: 35, F2: 35, ...BOTH([0.06, 1.28]), eb1: 1, eb2: 1 };
  const props = kind === "db_clean" || kind === "db_snatch" ? [{ k: "db", at: "h1" }] : [{ k: "plate", at: "hands" }];
  const single = (k) => (kind === "db_clean" || kind === "db_snatch" ? { ...k, A2: { ua: 10, fa: 20 } } : k);
  const start = kind === "mid" ? mid : hang;
  if (kind === "pull" || kind === "mid") return { n: kind === "mid" ? "Tirage mi-cuisse" : "Tirage d'épaulé", trail: "hands", props,
    keys: [K(0.7, kind === "mid" ? "Barre à mi-cuisse" : "Barre au-dessus des genoux", start), K(0.35, "Triple extension", ext, "out"), K(0.3, "Haussement d'épaules", pull), K(0.9, "Reviens", start)] };
  if (kind === "snatch" || kind === "db_snatch") {
    const catchS = { hip: [-0.18, 0.66], t: 18, hd: 5, ...LEGS([0.06, 0.08]), ...BOTH([-0.02, 1.86]) };
    return { n: "Arraché en suspension", trail: "hands", props, keys: [K(0.7, "Suspension", single(start)), K(0.3, "Extension", single(ext), "out"), K(0.22, "Tire haut, coudes hauts", single({ ...pull, ...BOTH([0.04, 1.42]) })), K(0.3, "Passe sous la barre", single(catchS)), K(0.6, "Redresse-toi, bras tendus", single({ ...STAND, ...LEGS([0.06, 0.08]), ...BOTH([-0.02, 2.04]) })), K(1, "", single(start))] };
  }
  const rack = BOTH({ ua: 95, fa: -118, rel: true });
  const catchC = { hip: [-0.14, 0.72], t: 18, hd: 8, ...LEGS([0.06, 0.08]), ...rack };
  return { n: "Épaulé en suspension", trail: "hands", props, keys: [K(0.7, "Suspension", single(start)), K(0.3, "Extension complète", single(ext), "out"), K(0.22, "Tire et passe les coudes", single(pull)), K(0.3, "Réception en appui", single(catchC)), K(0.6, "Redresse-toi", single({ ...STAND, ...LEGS([0.06, 0.08]), ...rack })), K(1, "", single(start))] };
}
MOVES.hang_clean = mvOly("clean");
MOVES.hang_snatch = mvOly("snatch");
MOVES.clean_pull = mvOly("pull");
MOVES.mid_thigh = mvOly("mid");
MOVES.db_clean = mvOly("db_clean");
MOVES.db_snatch = mvOly("db_snatch");
MOVES.thruster = { n: "Thruster", props: DB2,
  keys: [K(0.5, "Haltères aux épaules", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH([0.14, 1.48]) }), K(1, "Squat", { hip: [-0.18, 0.45], t: 28, hd: 15, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 95, fa: -118, rel: true }) }),
    K(0.6, "Remonte et pousse", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH([0.02, 2.04]) }, "out"), K(0.8, "", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH([0.14, 1.48]) })] };

/* ---------- conditionnement ---------- */
MOVES.burpee = { n: "Burpee", props: [MAT()],
  keys: [K(0.35, "Debout", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.4, "Mains au sol", { hip: [-0.15, 0.48], t: 70, hd: 55, ...LEGS([0.03, 0.08]), ...BOTH([0.32, 0.03]) }),
    K(0.35, "Pieds en arrière", PLANK_HI, "out"), K(0.35, "Pieds sous le bassin", { hip: [-0.15, 0.48], t: 70, hd: 55, ...LEGS([0.03, 0.08]), ...BOTH([0.32, 0.03]) }),
    K(0.35, "Saute, bras en l'air", { hip: [0.0, 1.18], t: -2, ...LEGS([0.03, 0.32]), F1: 50, F2: 50, ...BOTH({ ua: 170, fa: 175 }) }, "out"), K(0.3, "", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5, fa: 10 }) }, "in")] };
MOVES.mountain = { n: "Mountain climbers", props: [MAT()],
  keys: [K(0.22, "Genou droit vers la poitrine", { ...PLANK_HI, L1: [-0.3, 0.2], F1: 40 }, "lin"), K(0.22, "Change de jambe", { ...PLANK_HI, L2: [-0.32, 0.2], F2: 40 }, "lin")] };
MOVES.jumping_jack = { n: "Jumping jacks", view: "front",
  keys: [K(0.3, "Pieds joints, bras le long du corps", { ...STAND, L1: [0.1, 0.08], L2: [-0.1, 0.08], ...BOTH({ ua: 8, fa: 10 }) }), K(0.3, "Écarte en sautant", { ...STAND, hip: [0, 0.92], L1: [0.42, 0.08], L2: [-0.42, 0.08], ...BOTH({ ua: 165, fa: 172 }) })] };
MOVES.jump_rope = { n: "Corde à sauter",
  keys: [K(0.2, "Petits sauts sur l'avant du pied", { ...STAND, hip: [0, 0.95], ...LEGS([0.02, 0.1]), F1: 20, F2: 20, ...BOTH({ ua: 15, fa: 60 }) }, "out"), K(0.2, "", { ...STAND, hip: [0, 1.03], ...LEGS([0.02, 0.18]), F1: 40, F2: 40, ...BOTH({ ua: 20, fa: 70 }) }, "in")] };
MOVES.bike = { n: "Vélo", props: [{ k: "wheel", x: 0.25, y: 0.38, r: 0.17 }, { k: "seat", x: -0.25, w: 0.3, h: 0.05, y: 0.9 }, { k: "bar", from: [0.55, 1.12], to: [0.25, 0.38] }, { k: "bar", from: [-0.1, 0.9], to: [0.25, 0.38] }],
  keys: [0, 1, 2, 3].map((q) => { const a = q * Math.PI / 2, b = a + Math.PI; return K(0.25, q === 0 ? "Pédale en rond, buste stable" : "", { hip: [-0.1, 0.98], t: 40, hd: 30, L1: [0.25 + 0.17 * Math.cos(a), 0.38 + 0.17 * Math.sin(a)], L2: [0.25 + 0.17 * Math.cos(b), 0.38 + 0.17 * Math.sin(b)], ...BOTH([0.55, 1.12]) }, "lin"); }) };
MOVES.rower = { n: "Rameur", props: [{ k: "rail", x: -0.9, w: 1.7, h: 0.04, y: 0.22 }, { k: "seat", x: -0.6, w: 0.3, h: 0.05, y: 0.26 }],
  keys: [K(0.5, "Attaque : genoux pliés, bras tendus", { hip: [-0.2, 0.36], t: 25, hd: 15, ...LEGS([0.42, 0.3]), F1: -20, F2: -20, kb1: 1, kb2: 1, ...BOTH([0.55, 0.8]) }),
    K(0.5, "Jambes, puis buste, puis bras", { hip: [-0.62, 0.36], t: -22, hd: -10, ...LEGS([0.42, 0.3]), F1: -20, F2: -20, ...BOTH([-0.25, 0.85]) }, "out"),
    K(0.9, "Retour : bras, buste, jambes", { hip: [-0.2, 0.36], t: 25, hd: 15, ...LEGS([0.42, 0.3]), F1: -20, F2: -20, ...BOTH([0.55, 0.8]) })] };

/* ---------- mobilité, prévention ---------- */
MOVES.hip_9090 = { n: "Mobilité 90/90", view: "front", props: [MAT()],
  keys: [K(0.8, "Assis, genoux à 90°", { hip: [0, 0.13], t: 0, hd: 0, L1: { th: 88, sh: -88 }, L2: { th: 86, sh: -96 }, ...BOTH([0.0, 0.03]), eb1: -1, eb2: -1 }),
    K(2, "Penche le buste au-dessus de la jambe avant", { hip: [0, 0.13], t: 28, hd: 30, L1: { th: 88, sh: -88 }, L2: { th: 86, sh: -96 }, A1: [0.45, 0.05], A2: [0.2, 0.03], eb1: -1, eb2: -1 }),
    K(2, "Respire, garde le dos long", { hip: [0, 0.13], t: 30, hd: 32, L1: { th: 88, sh: -88 }, L2: { th: 86, sh: -96 }, A1: [0.48, 0.05], A2: [0.22, 0.03], eb1: -1, eb2: -1 }), K(1, "", { hip: [0, 0.13], t: 0, hd: 0, L1: { th: 88, sh: -88 }, L2: { th: 86, sh: -96 }, ...BOTH([0.0, 0.03]), eb1: -1, eb2: -1 })] };
MOVES.ankle_wall = { n: "Genou au mur", props: [{ k: "wall", x: 0.38, w: 0.06, h: 1.4 }, MAT(-0.8, 1.2)],
  keys: [K(0.8, "Pied à une main du mur", { hip: [-0.25, 0.5], t: 4, L1: [0.22, 0.08], L2: [-0.55, 0.09], F2: 165, kb2: 1, ...BOTH([0.35, 1.05]) }), K(1.5, "Genou vers le mur, talon au sol", { hip: [-0.12, 0.47], t: 6, L1: [0.22, 0.08], L2: [-0.48, 0.09], F2: 165, ...BOTH([0.35, 1.05]) }), K(1, "", { hip: [-0.25, 0.5], t: 4, L1: [0.22, 0.08], L2: [-0.55, 0.09], F2: 165, ...BOTH([0.35, 1.05]) })] };
MOVES.hip_flexor = { n: "Étirement des fléchisseurs de hanche", props: [MAT()],
  keys: [K(0.8, "Un genou au sol", { hip: [-0.2, 0.52], t: 2, L1: [0.28, 0.08], L2: [-0.65, 0.09], F2: 165, kb2: 1, A1: { ua: 10, fa: 30 }, A2: { ua: 10, fa: 30 } }), K(1.5, "Avance le bassin, fessiers serrés", { hip: [-0.06, 0.48], t: -4, L1: [0.28, 0.08], L2: [-0.62, 0.09], F2: 165, A1: { ua: 10, fa: 30 }, A2: { ua: 175, fa: 178 } }), K(2.5, "Respire, tiens l'étirement", { hip: [-0.05, 0.47], t: -7, hd: -2, L1: [0.28, 0.08], L2: [-0.62, 0.09], F2: 165, A1: { ua: 10, fa: 30 }, A2: { ua: 178, fa: 182 } }), K(1, "", { hip: [-0.2, 0.52], t: 2, L1: [0.28, 0.08], L2: [-0.65, 0.09], F2: 165, A1: { ua: 10, fa: 30 }, A2: { ua: 10, fa: 30 } })] };
MOVES.worlds_greatest = { n: "World's greatest stretch", props: [MAT()],
  keys: [K(0.8, "Grande fente, mains au sol", { hip: [-0.25, 0.45], t: 60, hd: 50, L1: [0.35, 0.08], L2: [-0.95, 0.16], F2: 50, ...BOTH([0.28, 0.03]) }), K(1.2, "Coude vers la cheville", { hip: [-0.27, 0.42], t: 70, hd: 60, L1: [0.35, 0.08], L2: [-0.95, 0.16], F2: 50, A1: [0.22, 0.12], A2: [0.3, 0.03] }),
    K(1.4, "Ouvre le bras vers le plafond", { hip: [-0.25, 0.45], t: 55, hd: 20, L1: [0.35, 0.08], L2: [-0.95, 0.16], F2: 50, A1: { ua: 175, fa: 178 }, A2: [0.3, 0.03] }), K(1, "", { hip: [-0.25, 0.45], t: 60, hd: 50, L1: [0.35, 0.08], L2: [-0.95, 0.16], F2: 50, ...BOTH([0.28, 0.03]) })] };
MOVES.breathing = { n: "Respiration", props: [MAT()],
  keys: [K(4, "Inspire par le nez, 4 secondes : le ventre se gonfle", { hip: [0, 0.11], t: -92, hd: -92, L1: [0.45, 0.08], L2: [0.43, 0.08], A1: { rel: "hip", d: [-0.12, 0.13] }, A2: { rel: "sh", d: [0.15, 0.1] }, eb1: 1, eb2: 1, cb: -0.025 }, "lin"),
    K(6, "Expire lentement, 6 secondes", { hip: [0, 0.11], t: -92, hd: -92, L1: [0.45, 0.08], L2: [0.43, 0.08], A1: { rel: "hip", d: [-0.12, 0.09] }, A2: { rel: "sh", d: [0.15, 0.08] }, eb1: 1, eb2: 1, cb: 0 }, "lin")] };
MOVES.breathing_seated = { n: "Cohérence cardiaque", props: [MAT()],
  keys: [K(5, "Inspire 5 secondes", { hip: [0, 0.14], t: -3, hd: -3, L1: [0.42, 0.08], L2: [0.4, 0.08], kb1: 1, kb2: 1, ...BOTH({ rel: "k1", d: [0.0, 0.03] }), eb1: -1, eb2: -1 }, "lin"),
    K(5, "Expire 5 secondes", { hip: [0, 0.14], t: 2, hd: 4, L1: [0.42, 0.08], L2: [0.4, 0.08], kb1: 1, kb2: 1, ...BOTH({ rel: "k1", d: [0.0, 0.03] }), eb1: -1, eb2: -1 }, "lin")] };
MOVES.tibialis = { n: "Relevés du tibial", props: [{ k: "wall", x: -0.62, w: 0.06, h: 1.9 }],
  keys: [K(0.6, "Dos au mur, talons devant", { hip: [-0.46, 0.92], t: 12, hd: 5, ...LEGS([-0.05, 0.08]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.8, "Relève les pointes de pied", { hip: [-0.46, 0.92], t: 12, hd: 5, ...LEGS([-0.05, 0.08]), F1: -32, F2: -32, ...BOTH({ ua: 5, fa: 10 }) }), K(0.8, "Redescends", { hip: [-0.46, 0.92], t: 12, hd: 5, ...LEGS([-0.05, 0.08]), ...BOTH({ ua: 5, fa: 10 }) })] };
MOVES.balance = { n: "Équilibre unipodal",
  keys: [K(1.5, "Sur une jambe, genou souple", { ...STAND, hip: [0, 0.92], L1: [0.02, 0.08], L2: { th: 55, sh: -15 }, ...BOTH({ ua: 25, fa: 30 }) }), K(1.5, "Reste stable", { ...STAND, hip: [0.015, 0.92], t: 4, L1: [0.02, 0.08], L2: { th: 58, sh: -12 }, ...BOTH({ ua: 30, fa: 35 }) })] };
MOVES.ext_rot = { n: "Rotation externe d'épaule", view: "front", props: [{ k: "band", from: [-0.7, 1.15], to: "h1" }],
  keys: [K(0.6, "Coude collé au corps", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], A1: { ua: 4, fa: -70 }, A2: { ua: 8, fa: 10 } }), K(1, "Tourne l'avant-bras vers l'extérieur", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], A1: { ua: 6, fa: 80 }, A2: { ua: 8, fa: 10 } }), K(1.3, "Reviens lentement", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], A1: { ua: 4, fa: -70 }, A2: { ua: 8, fa: 10 } })] };
MOVES.ytw = { n: "Y-T-W", view: "front",
  keys: [K(0.6, "Bras le long du corps", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], ...BOTH({ ua: 10, fa: 10 }) }), K(1, "Y : bras en V", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], ...BOTH({ ua: 145, fa: 148 }) }), K(0.6, "", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], ...BOTH({ ua: 145, fa: 148 }) }),
    K(1, "T : bras à l'horizontale", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], ...BOTH({ ua: 90, fa: 90 }) }), K(0.6, "", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], ...BOTH({ ua: 90, fa: 90 }) }),
    K(1, "W : coudes pliés, serre les omoplates", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], ...BOTH({ ua: 55, fa: 150 }) }), K(0.6, "", { ...STAND, L1: [0.13, 0.08], L2: [-0.13, 0.08], ...BOTH({ ua: 55, fa: 150 }) })] };

/* ---------- étirements et yoga ---------- */
const DOG = (() => { const hip = [-0.05, 0.86], t = 128; return { hip, t, hd: 150, L1: [-0.47, 0.09], L2: [-0.49, 0.09], F1: 12, F2: 12, ...BOTH([0.58, 0.03]) }; })();
MOVES.down_dog = { n: "Chien tête en bas", props: [MAT()], keys: [K(2.5, "Pousse le sol, hanches hautes", DOG), K(2.5, "Talons vers le sol, respire", { ...DOG, hip: [-0.07, 0.88], F1: 2, F2: 2 })], note: "Genoux légèrement fléchis si les ischios tirent." };
MOVES.child = { n: "Posture de l'enfant", props: [MAT()],
  keys: [K(3, "Assis sur les talons, front au sol", { hip: [-0.28, 0.2], t: 102, hd: 125, cb: 0.05, L1: [-0.36, 0.08], L2: [-0.38, 0.08], F1: 175, F2: 175, kb1: 1, kb2: 1, ...BOTH([0.78, 0.04]) }), K(3, "Respire dans le dos", { hip: [-0.29, 0.21], t: 100, hd: 125, cb: 0.06, L1: [-0.36, 0.08], L2: [-0.38, 0.08], F1: 175, F2: 175, ...BOTH([0.78, 0.04]) })] };
MOVES.cobra = { n: "Cobra", props: [MAT()],
  keys: [K(0.8, "Allongé, mains sous les épaules", { hip: [0, 0.1], t: 92, hd: 92, L1: [-0.86, 0.08], L2: [-0.88, 0.08], F1: 175, F2: 175, ...BOTH([0.38, 0.03]), eb1: 1, eb2: 1 }), K(1.5, "Pousse et ouvre la poitrine", { hip: [0, 0.1], t: 40, hd: 25, cb: -0.06, L1: [-0.86, 0.08], L2: [-0.88, 0.08], F1: 175, F2: 175, ...BOTH([0.38, 0.03]), eb1: 1, eb2: 1 }),
    K(2.5, "Respire, épaules basses", { hip: [0, 0.1], t: 40, hd: 25, cb: -0.06, L1: [-0.86, 0.08], L2: [-0.88, 0.08], F1: 175, F2: 175, ...BOTH([0.38, 0.03]), eb1: 1, eb2: 1 }), K(1.2, "Redescends", { hip: [0, 0.1], t: 92, hd: 92, L1: [-0.86, 0.08], L2: [-0.88, 0.08], F1: 175, F2: 175, ...BOTH([0.38, 0.03]), eb1: 1, eb2: 1 })] };
MOVES.pigeon = { n: "Pigeon", props: [MAT()],
  keys: [K(0.8, "Tibia avant devant, jambe arrière allongée", { hip: [0, 0.2], t: 5, hd: 5, L1: { th: 80, sh: -70 }, L2: { th: -78, sh: -88 }, F1: 60, F2: 175, ...BOTH([0.35, 0.03]) }), K(2, "Penche-toi au-dessus de la jambe avant", { hip: [0, 0.18], t: 72, hd: 85, cb: 0.03, L1: { th: 80, sh: -70 }, L2: { th: -80, sh: -88 }, F1: 60, F2: 175, ...BOTH([0.7, 0.03]) }), K(3, "Respire, relâche la hanche", { hip: [0, 0.17], t: 76, hd: 88, cb: 0.03, L1: { th: 80, sh: -70 }, L2: { th: -80, sh: -88 }, F1: 60, F2: 175, ...BOTH([0.72, 0.03]) }), K(1, "", { hip: [0, 0.2], t: 5, hd: 5, L1: { th: 80, sh: -70 }, L2: { th: -78, sh: -88 }, F1: 60, F2: 175, ...BOTH([0.35, 0.03]) })] };
MOVES.seated_fold = { n: "Étirement des ischios assis", props: [MAT()],
  keys: [K(0.8, "Assis, jambes tendues", { hip: [0, 0.12], t: 0, hd: 0, L1: { th: 90, sh: 90 }, L2: { th: 89, sh: 89 }, F1: -75, F2: -75, ...BOTH([0.32, 0.14]) }), K(1.8, "Penche-toi dos long", { hip: [0, 0.12], t: 58, hd: 70, cb: 0.03, L1: { th: 90, sh: 90 }, L2: { th: 89, sh: 89 }, F1: -75, F2: -75, ...BOTH([0.72, 0.12]) }), K(3, "Respire, avance un peu à chaque expiration", { hip: [0, 0.12], t: 62, hd: 72, cb: 0.035, L1: { th: 90, sh: 90 }, L2: { th: 89, sh: 89 }, F1: -75, F2: -75, ...BOTH([0.78, 0.12]) }), K(1, "", { hip: [0, 0.12], t: 0, hd: 0, L1: { th: 90, sh: 90 }, L2: { th: 89, sh: 89 }, F1: -75, F2: -75, ...BOTH([0.32, 0.14]) })] };
MOVES.quad_stretch = { n: "Étirement des quadriceps debout",
  keys: [K(0.8, "Debout sur une jambe", { ...STAND, L2: [-0.02, 0.08], L1: { th: -5, sh: -160 }, F1: 120, A1: { rel: "a1", d: [0, 0] }, eb1: -1, A2: { ua: 80, fa: 85 } }), K(3, "Talon vers la fesse, genoux serrés", { ...STAND, t: 3, L2: [-0.02, 0.08], L1: { th: -12, sh: -168 }, F1: 120, A1: { rel: "a1", d: [0, 0] }, eb1: -1, A2: { ua: 85, fa: 88 } }), K(1, "", { ...STAND, L2: [-0.02, 0.08], L1: { th: -5, sh: -160 }, F1: 120, A1: { rel: "a1", d: [0, 0] }, eb1: -1, A2: { ua: 80, fa: 85 } })] };
MOVES.calf_wall = { n: "Étirement des mollets au mur", props: [{ k: "wall", x: 0.8, w: 0.06, h: 1.9 }],
  keys: [K(0.8, "Mains au mur, jambe arrière tendue", { hip: [-0.02, 0.88], t: 18, hd: 10, L1: [0.32, 0.08], L2: [-0.5, 0.08], ...BOTH([0.78, 1.42]) }), K(3, "Talon arrière au sol, avance le bassin", { hip: [0.08, 0.86], t: 20, hd: 12, L1: [0.32, 0.08], L2: [-0.5, 0.08], ...BOTH([0.78, 1.42]) }), K(1, "", { hip: [-0.02, 0.88], t: 18, hd: 10, L1: [0.32, 0.08], L2: [-0.5, 0.08], ...BOTH([0.78, 1.42]) })] };
MOVES.butterfly = { n: "Papillon", view: "front", props: [MAT()],
  keys: [K(2, "Plantes de pied jointes, dos droit", { hip: [0, 0.13], t: 0, hd: 0, L1: [0.07, 0.07], L2: [-0.07, 0.07], kb1: 1, kb2: 1, ...BOTH([0.06, 0.12]), eb1: 1, eb2: 1 }), K(2, "Laisse descendre les genoux", { hip: [0, 0.13], t: 3, hd: 3, L1: [0.06, 0.06], L2: [-0.06, 0.06], ...BOTH([0.05, 0.1]), eb1: 1, eb2: 1 })] };
MOVES.knees_chest = { n: "Genoux à la poitrine", props: [MAT()],
  keys: [K(1, "Allongé, ramène les genoux", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: -150, sh: 95 }, L2: { th: -148, sh: 97 }, ...BOTH({ rel: "k1", d: [0.05, 0] }), eb1: 1, eb2: 1 }), K(2.5, "Serre doucement, respire", { hip: [0, 0.12], t: -92, hd: -90, L1: { th: -160, sh: 100 }, L2: { th: -158, sh: 102 }, ...BOTH({ rel: "k1", d: [0.05, 0] }), eb1: 1, eb2: 1 }), K(1.5, "Berce doucement", { hip: [0, 0.12], t: -95, hd: -92, L1: { th: -150, sh: 95 }, L2: { th: -148, sh: 97 }, ...BOTH({ rel: "k1", d: [0.05, 0] }), eb1: 1, eb2: 1 })] };
MOVES.legs_wall = { n: "Jambes au mur", props: [MAT(), { k: "wall", x: 0.14, w: 0.06, h: 1.3 }],
  keys: [K(4, "Jambes contre le mur, respire", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: 178, sh: 178 }, L2: { th: 176, sh: 176 }, F1: 80, F2: 80, ...BOTH({ ua: -40, fa: -40 }) }), K(4, "Relâche les épaules", { hip: [0, 0.12], t: -92, hd: -92, L1: { th: 179, sh: 179 }, L2: { th: 177, sh: 177 }, F1: 80, F2: 80, ...BOTH({ ua: -38, fa: -38 }) })] };
MOVES.forward_fold = { n: "Flexion avant debout",
  keys: [K(0.8, "Debout", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 170, fa: 175 }) }), K(2, "Plie-toi, genoux souples", { hip: [-0.2, 0.86], t: 140, hd: 165, cb: 0.05, ...LEGS([0.03, 0.08]), ...BOTH([0.15, 0.05]) }), K(3, "Laisse pendre la tête, respire", { hip: [-0.21, 0.87], t: 145, hd: 170, cb: 0.06, ...LEGS([0.03, 0.08]), ...BOTH([0.12, 0.04]) }), K(1.5, "Déroule le dos", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5, fa: 10 }) })] };
MOVES.warrior2 = { n: "Guerrier II", view: "front",
  keys: [K(1, "Grand écart des pieds", { hip: [0, 0.88], t: 0, L1: [0.55, 0.08], L2: [-0.55, 0.08], ...BOTH({ ua: 10, fa: 10 }) }), K(1.5, "Plie le genou avant, bras à l'horizontale", { hip: [0.12, 0.66], t: 0, L1: [0.6, 0.08], L2: [-0.55, 0.08], kb1: 1, ...BOTH({ ua: 90, fa: 90 }) }), K(3, "Tiens, respire", { hip: [0.12, 0.65], t: 0, L1: [0.6, 0.08], L2: [-0.55, 0.08], ...BOTH({ ua: 90, fa: 90 }) }), K(1, "", { hip: [0, 0.88], t: 0, L1: [0.55, 0.08], L2: [-0.55, 0.08], ...BOTH({ ua: 10, fa: 10 }) })] };
MOVES.inchworm = { n: "Chenille (inchworm)", props: [MAT(-0.4, 2.2)],
  keys: [K(0.6, "Debout", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5, fa: 10 }) }), K(0.9, "Mains au sol", { hip: [-0.18, 0.88], t: 140, hd: 160, cb: 0.04, ...LEGS([0.03, 0.08]), ...BOTH([0.25, 0.03]) }),
    K(1.4, "Marche avec les mains jusqu'à la planche", (() => { const b = mvLine2([0.03, 0.12], [1.28, 0.62]); return { ...b, hd: b.t, ...LEGS([0.03, 0.12]), F1: 70, F2: 70, ...BOTH([1.3, 0.03]) }; })()), K(0.4, "", (() => { const b = mvLine2([0.03, 0.12], [1.28, 0.62]); return { ...b, hd: b.t, ...LEGS([0.03, 0.12]), F1: 70, F2: 70, ...BOTH([1.3, 0.03]) }; })()),
    K(1.4, "Reviens", { hip: [-0.18, 0.88], t: 140, hd: 160, cb: 0.04, ...LEGS([0.03, 0.08]), ...BOTH([0.25, 0.03]) }), K(0.8, "", { ...STAND, ...LEGS([0.03, 0.08]), ...BOTH({ ua: 5, fa: 10 }) })] };
MOVES.jump_lunge = { n: "Fentes sautées",
  keys: [K(0.4, "Fente basse", { hip: [0.0, 0.52], t: 5, L1: [0.42, 0.08], L2: [-0.45, 0.16], F2: 55, A1: { ua: -40, fa: 30 }, A2: { ua: 40, fa: 100 } }), K(0.3, "Saute et change de jambe", { hip: [0.0, 1.0], t: 3, L1: { th: 20, sh: -20 }, L2: { th: 0, sh: -30 }, F1: 30, F2: 30, A1: { ua: 10, fa: 60 }, A2: { ua: 10, fa: 60 } }, "out"),
    K(0.4, "Réception en fente", { hip: [0.0, 0.52], t: 5, L2: [0.42, 0.08], L1: [-0.45, 0.16], F1: 55, A2: { ua: -40, fa: 30 }, A1: { ua: 40, fa: 100 } }, "in"), K(0.3, "", { hip: [0.0, 1.0], t: 3, L2: { th: 20, sh: -20 }, L1: { th: 0, sh: -30 }, F1: 30, F2: 30, A1: { ua: 10, fa: 60 }, A2: { ua: 10, fa: 60 } }, "out")] };
MOVES.high_knees = { ...MOVES.a_skip, n: "Montées de genoux rapides", keys: MOVES.a_skip.keys.map((k) => ({ ...k, d: k.d * 0.6 })) };
/* rouleau de massage */
function mvRoll(zone) {
  if (zone === "mollets") {
    const p = (x) => ({ hip: [x, 0.3], t: -65, hd: -40, L1: [x + 0.82, 0.12], L2: [x + 0.84, 0.13], F1: -70, F2: -70, ...BOTH([x - 0.33, 0.03]), eb1: 1, eb2: 1 });
    return { n: "Rouleau : mollets", props: [MAT(), { k: "roller", at: [0.55, 0.075], r: 0.075 }], keys: [K(1.6, "Roule lentement du talon au genou", p(-0.25), "lin"), K(1.6, "", p(0.05), "lin")] };
  }
  if (zone === "quadriceps") {
    const p = (x) => { const b = mvLine2([x - 1.0, 0.1], [x + 0.25, 0.38]); return { ...b, hd: b.t, L1: [x - 1.0, 0.1], L2: [x - 1.02, 0.1], F1: 160, F2: 160, ...BOTH({ ua: 0, fa: 90 }) }; };
    return { n: "Rouleau : quadriceps", props: [MAT(), { k: "roller", at: [-0.45, 0.075], r: 0.075 }], keys: [K(1.6, "Appui sur les avant-bras, roule de la hanche au genou", p(0), "lin"), K(1.6, "", p(0.3), "lin")] };
  }
  const p = (x) => ({ hip: [x, 0.32], t: -110, hd: -100, L1: [x + 0.45, 0.08], L2: [x + 0.43, 0.08], ...BOTH({ rel: "head", d: [-0.06, 0.02] }), eb1: 1, eb2: 1 });
  return { n: "Rouleau : haut du dos", props: [MAT(), { k: "roller", at: [-0.45, 0.075], r: 0.075 }], keys: [K(1.8, "Mains derrière la tête, roule le haut du dos", p(0), "lin"), K(1.8, "", p(-0.12), "lin")] };
}
MOVES.roll_calves = mvRoll("mollets");
MOVES.roll_quads = mvRoll("quadriceps");
MOVES.roll_back = mvRoll("dos");
MOVES.march = { ...mvWalk(0, 0.4), n: "Marche sur place" };
MOVES.stand_breath = { n: "Debout, respire", keys: [K(4, "Inspire", { ...STAND, ...LEGS([0.05, 0.08]), ...BOTH({ ua: 160, fa: 165 }) }), K(4, "Expire, relâche", { ...STAND, ...LEGS([0.05, 0.08]), ...BOTH({ ua: 5, fa: 10 }) })] };

/* ---------- exercice -> mouvement ---------- */
const MOTION_FOR = {
  squat_barre: "squat_back", squat_avant: "squat_front", squat_goblet: "squat_goblet", squat_pdc: "squat_bw", squat_box: "squat_box", fente_arriere: "lunge_back", fente_marchee: "lunge_fwd",
  split_squat: "split_squat", step_up: "step_up", presse: "leg_press", chaise: "wall_sit", mollets: "calf_raise", mollets_unipodal: "calf_single", squat_unipodal_box: "sl_squat_box",
  sdt: "deadlift", sdt_kb: "deadlift_kb", sdt_roumain: "rdl", sdt_jambe: "rdl_single", hip_thrust: "hip_thrust", pont_fessier: "glute_bridge", nordic: "nordic", leg_curl_glisse: "slider_curl", kb_swing: "kb_swing",
  dc_barre: "bench_bar", dc_halteres: "bench_db", dc_incline: "bench_incline", pompes: "pushup", pompes_inclinees: "pushup_incline", pompes_pieds: "pushup_decline", dm: "ohp_bar", dm_halteres: "ohp_db",
  landmine_press: "landmine", tractions: "pullup", tractions_assist: "pullup_band", tirage_vertical: "pulldown", rowing_barre: "row_bent", rowing_haltere: "row_one", rowing_inverse: "row_inverted",
  tirage_elastique: "row_band", face_pull: "face_pull", dips: "dips", curl: "curl", extension_triceps: "triceps", elevations_laterales: "lateral_raise",
  planche: "plank", planche_laterale: "side_plank", dead_bug: "dead_bug", bird_dog: "bird_dog", pallof: "pallof", rollout: "rollout", portage_valise: "carry1", farmer_walk: "carry2", hollow: "hollow", releve_jambes: "hanging_raise",
  epaule_suspension: "hang_clean", arrache_suspension: "hang_snatch", tirage_epaule: "clean_pull", mi_cuisse: "mid_thigh", jete_pousse: "push_press", jerk: "push_jerk", epaule_haltere: "db_clean", arrache_haltere: "db_snatch", squat_saute_barre: "squat_jump_bar",
  cmj: "cmj", box_jump: "box_jump", sauts_haies: "hurdle_hops", bonds: "bounds", saut_longueur: "broad_jump", drop_jump: "drop_jump", pogo: "pogo", saut_lateral: "skater", med_ball_lancer: "mb_chest", med_ball_rotation: "mb_rotation", saut_unipodal: "single_hop",
  gammes: "a_skip", acc_10: "sprint", acc_20: "sprint", sprint_30: "sprint", sprint_lance: "sprint", sprint_resiste: "sprint_resist", montees: "hill", depart_3appuis: "start_3pt", wicket: "sprint",
  cod_505: "decel", decel: "decel", reactif: "shuffle", echelle: "high_knees", shuffle: "shuffle", intermittent_1515: "run", intermittent_3030: "run", navette: "decel", rsa: "sprint", velo_intervalles: "bike", rameur: "rower",
  marche_rapide: "walk", burpees: "burpee", corde: "jump_rope", jumping_jacks: "jumping_jack", circuit_kb: "kb_swing", footing_ef: "run", fractionne_court: "run", fractionne_long: "run", sortie_longue: "run", marche_course: "walk", lignes_droites: "run", tempo: "run",
  mob_hanche: "hip_9090", mob_cheville: "ankle_wall", mob_thoracique: "thoracic_rot", etirement_flechisseurs: "hip_flexor", worlds_greatest: "worlds_greatest", respiration: "breathing",
  copenhague: "copenhagen", tibial: "tibialis", equilibre: "balance", rotateurs: "ext_rot", y_t_w: "ytw", step_down: "step_down", spanish_squat: "spanish_squat",
  chien_tete_bas: "down_dog", posture_enfant: "child", cobra: "cobra", chat_vache: "cat_cow", pigeon: "pigeon", ischios_assis: "seated_fold", quadriceps_debout: "quad_stretch", mollets_mur: "calf_wall", papillon: "butterfly",
  genoux_poitrine: "knees_chest", jambes_mur: "legs_wall", flexion_avant: "forward_fold", guerrier_2: "warrior2", coherence: "breathing_seated", rouleau_mollets: "roll_calves", rouleau_quadriceps: "roll_quads", rouleau_dos: "roll_back",
  mountain_climbers: "mountain", squat_saute: "squat_jump", fentes_sautees: "jump_lunge", superman: "superman", crunch: "crunch", talons_fesses: "butt_kicks", montees_genoux: "high_knees", planche_epaules: "plank_taps",
  pompes_genoux: "pushup_knees", dips_chaise: "bench_dips", thruster: "thruster", chenille: "inchworm", fente_laterale: "lateral_lunge", pont_unipodal: "glute_bridge_single", marche_place: "march", fente_arriere_pdc: "lunge_back_bw", fente_avant_pdc: "lunge_fwd_bw", slam_ball: "mb_slam", good_morning: "good_morning",
};
const MOTION_BY_CAT = { Course: "run", Conditionnement: "run", Vitesse: "sprint", Pliométrie: "cmj", Agilité: "shuffle" };
const _motionCache = {};
/* motif animé d'un exercice : par son identifiant, par un motif direct, puis par sa catégorie */
function motionFor(id, ex) {
  const key = (ex && ex.anim) || MOTION_FOR[id] || (MOVES[id] ? id : null) || (ex && MOTION_BY_CAT[ex.c]) || null;
  if (!key || !MOVES[key]) return null;
  if (!_motionCache[key]) { try { _motionCache[key] = mvPrep({ ...MOVES[key], id: key }); } catch (e) { _motionCache[key] = null; } }
  return _motionCache[key];
}
function hasMotion(id, ex) { const key = (ex && ex.anim) || MOTION_FOR[id] || (MOVES[id] ? id : null) || (ex && MOTION_BY_CAT[ex.c]); return !!(key && MOVES[key]); }
