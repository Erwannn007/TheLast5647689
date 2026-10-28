// Animaux sauvages : cerf et lapin (renderModel, 8 directions), et leurs carcasses.
// Quadrupèdes vus de 3/4 grâce à l'isométrie ; pattes en cinématique inverse, allure diagonale.
import { renderModel, ik, hash } from '../raster.js';
import { DEER, RABBIT, ANTLER, CREAM, BLOOD } from '../palette.js';

export const DIRS = 8, DEER_WALK = 8, RABBIT_HOP = 4;
const clamp3 = (s) => (s < 0 ? 0 : s > 3 ? 3 : s);
// vus pile de face ou de dos, on les tourne de 25° (sinon ce n'est qu'un trait)
const facingOf = (d) => { const a = d * Math.PI * 2 / DIRS + (d % 4 === 0 ? 0.44 : 0); return [Math.sin(a), Math.cos(a)]; };

// pose : { phase 0..1, gait 0 (arrêt) | 1 (marche) | 2 (fuite), graze 0..1, buck (bois) }
function deerParts(pose) {
  const P = [];
  const ph = pose.phase * Math.PI * 2, g = pose.gait;
  const stride = g === 2 ? 5 : g === 1 ? 2.6 : 0, lift = g === 2 ? 3.2 : 1.6;
  const bob = g === 2 ? Math.abs(Math.sin(ph)) * 1.4 : g ? Math.abs(Math.sin(ph)) * 0.4 : 0;
  const pelt = (p) => {
    let s = p.shade;
    if (p.ny > 0.45) return CREAM[clamp3(s)]; // ventre clair
    if (hash(p.x, p.y, 7) < 0.12) s--;
    return clamp3(s);
  };
  const bodyZ = 15 + bob;
  P.push({ a: [0, -6.5, bodyZ + 0.5], b: [0, 6, bodyZ + 1], r1: 4, r2: 4.3, ramp: DEER, group: 1, tex: pelt });
  // pattes : diagonales en phase (avant gauche + arrière droite)
  for (const [x, f, off] of [[-1.8, 5, 0], [1.8, 5, 0.5], [-1.8, -5.5, 0.5], [1.8, -5.5, 0]]) {
    const p = ph + off * Math.PI * 2;
    const hip = [x, f, bodyZ - 1];
    const hoof = [x * 1.1, f + Math.sin(p) * stride, Math.max(0, Math.cos(p)) * lift];
    const knee = ik(hip, hoof, 7.6, 7.6, [0, f > 0 ? -1 : 1, 0]);
    P.push({ a: hip, b: knee, r1: 1.5, r2: 0.9, ramp: DEER, group: 2 + (x > 0 ? 1 : 0), tex: pelt });
    P.push({ a: knee, b: hoof, r1: 0.75, r2: 0.6, ramp: DEER, group: 2 + (x > 0 ? 1 : 0) });
  }
  // cou et tête : tête basse quand il broute
  const gz = pose.graze;
  const neckTop = [0, 9.5 + gz * 2.5, bodyZ + 9 - gz * 15];
  P.push({ a: [0, 5.5, bodyZ + 1.5], b: neckTop, r1: 2.4, r2: 1.7, ramp: DEER, group: 4, tex: pelt });
  const head = [0, neckTop[1] + 1.2, neckTop[2] + 0.8 - gz * 1.5];
  const snout = [0, head[1] + 3.2, head[2] - 1.4];
  P.push({ a: head, b: snout, r1: 1.9, r2: 1.1, ramp: DEER, group: 5, tex: (p) => (p.t > 0.85 ? 0 : clamp3(p.shade)) });
  for (const s of [-1, 1]) P.push({ a: [s * 1.2, head[1] - 0.6, head[2] + 1.2], b: [s * 2.6, head[1] - 1.2, head[2] + 2.8], r1: 0.85, r2: 0.6, ramp: DEER, group: 6 }); // oreilles
  if (pose.buck) {
    for (const s of [-1, 1]) {
      const base = [s * 0.9, head[1] - 0.3, head[2] + 1.6], top = [s * 2.6, head[1] - 0.6, head[2] + 7];
      P.push({ a: base, b: top, r1: 0.45, ramp: ANTLER, group: 7 });
      P.push({ a: [s * 1.7, head[1] - 0.4, head[2] + 4], b: [s * 2.2, head[1] + 1.4, head[2] + 6.2], r1: 0.35, ramp: ANTLER, group: 7 });
    }
  }
  P.push({ a: [0, -7, bodyZ + 2.2], r1: 1.2, ramp: CREAM, group: 8 }); // queue blanche
  return P;
}

function rabbitParts(pose) {
  const ph = pose.phase * Math.PI * 2, hop = pose.gait ? Math.max(0, Math.sin(ph)) : 0;
  const z = hop * 3, stretch = hop * 1.2;
  const fur = (p) => (p.ny > 0.45 ? CREAM[clamp3(p.shade)] : clamp3(p.shade - (hash(p.x, p.y, 5) < 0.12 ? 1 : 0)));
  return [
    { a: [0, -1.6 - stretch * 0.3, 2.8 + z], r1: 2.8, ramp: RABBIT, group: 1, tex: fur }, // arrière-train
    { a: [0, 1 + stretch, 3 + z], r1: 2.2, ramp: RABBIT, group: 1, tex: fur },
    { a: [0, 3.2 + stretch, 4.6 + z - pose.graze * 2], r1: 1.7, ramp: RABBIT, group: 2, tex: fur }, // tête
    { a: [-0.7, 2.6 + stretch, 5.8 + z - pose.graze * 2], b: [-1, 1.4 + stretch, 9.5 + z - pose.graze * 2], r1: 0.6, ramp: RABBIT, group: 3 },
    { a: [0.7, 2.6 + stretch, 5.8 + z - pose.graze * 2], b: [1, 1.4 + stretch, 9.5 + z - pose.graze * 2], r1: 0.6, ramp: RABBIT, group: 3 },
    { a: [0, -4.2, 3.4 + z], r1: 0.9, ramp: CREAM, group: 4 },
  ];
}

// carcasse : le corps couché sur le flanc, pattes raides, une tache de sang
function carcassParts(kind) {
  const R = kind === 'deer' ? DEER : RABBIT, k = kind === 'deer' ? 1 : 0.32;
  const P = [
    { a: [-1, -6.5 * k, 3.6 * k], b: [-1, 6 * k, 3.8 * k], r1: 4 * k, ramp: R, group: 1, tex: (p) => (p.nx > 0.5 ? CREAM[clamp3(p.shade)] : p.shade) },
    { a: [-1, 6 * k, 3.8 * k], b: [-1.5, 12 * k, 2.4 * k], r1: 1.8 * k, ramp: R, group: 2 },
  ];
  for (const f of [4.5, -5]) for (const x of [0.5, 2.5]) P.push({ a: [x * k, f * k, 3 * k], b: [(x + 9) * k, (f + 1) * k, 1.2 * k], r1: 0.7 * k, ramp: R, group: 3 });
  return P;
}

const render = (parts, d, big) => renderModel(parts, big ? { w: 72, h: 64, ox: 36, oy: 52, facing: facingOf(d) } : { w: 32, h: 28, ox: 16, oy: 22, facing: facingOf(d) });

// { deer: { walk[d][f], run[d][f], idle[d][f] }, stag: idem, rabbit: { hop[d][f], idle[d][f] } }
export function bakeAnimals() {
  const out = { deer: {}, stag: {}, rabbit: {} };
  for (const [key, buck] of [['deer', false], ['stag', true]]) {
    const A = out[key];
    A.walk = []; A.run = []; A.idle = [];
    for (let d = 0; d < DIRS; d++) {
      A.walk.push(Array.from({ length: DEER_WALK }, (_, f) => render(deerParts({ phase: f / DEER_WALK, gait: 1, graze: 0, buck }), d, true)));
      A.run.push(Array.from({ length: DEER_WALK }, (_, f) => render(deerParts({ phase: f / DEER_WALK, gait: 2, graze: 0, buck }), d, true)));
      A.idle.push([0, 1].map((f) => render(deerParts({ phase: 0, gait: 0, graze: f ? 1 : 0.15, buck }), d, true)));
    }
  }
  const R = out.rabbit;
  R.hop = []; R.idle = [];
  for (let d = 0; d < DIRS; d++) {
    R.hop.push(Array.from({ length: RABBIT_HOP }, (_, f) => render(rabbitParts({ phase: f / RABBIT_HOP, gait: 1, graze: 0 }), d, false)));
    R.idle.push([0, 1].map((f) => render(rabbitParts({ phase: 0, gait: 0, graze: f }), d, false)));
  }
  return out;
}
export function carcassSprite(kind) {
  const m = renderModel(carcassParts(kind), { w: 64, h: 40, ox: 32, oy: 26, facing: [0.6, 0.8] });
  // flaque de sang dessous (aplat sombre, sans contour)
  const b = { ...m, data: new Uint8ClampedArray(m.data) };
  const r = kind === 'deer' ? 9 : 4;
  for (let y = -3; y <= 3; y++) for (let x = -r; x <= r; x++) {
    if ((x * x) / (r * r) + (y * y) / 9 > 1 || hash(x, y, 2) < 0.15) continue;
    const o = ((26 + y + 1) * b.w + 32 + x) * 4;
    if (o < 0 || o >= b.data.length || b.data[o + 3]) continue;
    b.data[o] = BLOOD[1][0]; b.data[o + 1] = BLOOD[1][1]; b.data[o + 2] = BLOOD[1][2]; b.data[o + 3] = 255;
  }
  return b;
}
