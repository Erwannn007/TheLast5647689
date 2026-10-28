// Animaux sauvages : cerf et lapin (renderModel, 8 directions), et leurs carcasses.
// Quadrupèdes vus de 3/4 grâce à l'isométrie ; pattes en cinématique inverse, allure diagonale.
import { renderModel, ik, hash } from '../raster.js';
import { DEER, RABBIT, ANTLER, CREAM, BLOOD } from '../palette.js';

export const DIRS = 8, DEER_WALK = 8, RABBIT_HOP = 4;
const clamp3 = (s) => (s < 0 ? 0 : s > 3 ? 3 : s);
// vus pile de face ou de dos, on les tourne de 25° (sinon ce n'est qu'un trait)
const facingOf = (d) => { const a = d * Math.PI * 2 / DIRS + (d % 4 === 0 ? 0.44 : 0); return [Math.sin(a), Math.cos(a)]; };

// pose : { phase 0..1, gait 0 (arrêt) | 1 (marche) | 2 (fuite), graze 0..1, buck (bois) }
// Anatomie : poitrail profond, taille fine, croupe ronde ; long cou incliné, tête fine, grandes
// oreilles ; pattes fines (épaule et cuisse musclées, canons très fins, jarret arrière qui plie
// vers l'arrière) ; miroir blanc sous la queue, gorge claire, ventre crème, dos plus foncé.
function deerParts(pose) {
  const P = [];
  const ph = pose.phase * Math.PI * 2, g = pose.gait;
  const stride = g === 2 ? 4.6 : g === 1 ? 2.4 : 0, lift = g === 2 ? 3.6 : 1.8;
  const bob = g === 2 ? Math.abs(Math.sin(ph)) * 1.6 : g ? Math.abs(Math.sin(ph)) * 0.35 : 0;
  const bodyZ = 15.5 + bob;
  const pelt = (p) => {
    let s = p.shade;
    if (p.ny > 0.5) return CREAM[clamp3(s)]; // ventre clair
    if (p.ny < -0.65) s--; // ligne du dos plus foncée
    if (hash(p.x, p.y, 7) < 0.1) s--;
    return clamp3(s);
  };
  // tronc : poitrail (devant, plus haut), taille, croupe
  P.push({ a: [0, 4.2, bodyZ + 0.6], r1: 4.1, ramp: DEER, group: 1, tex: pelt });
  P.push({ a: [0, 4.2, bodyZ + 0.6], b: [0, -3.8, bodyZ + 0.3], r1: 3.6, r2: 3.4, ramp: DEER, group: 1, tex: pelt });
  P.push({ a: [0, -4.6, bodyZ + 0.6], r1: 3.8, ramp: DEER, group: 1, tex: (p) => (p.nx * p.fc[0] + p.nz * p.fc[2] < -0.55 && p.ny < 0.3 ? CREAM[3] : pelt(p)) }); // croupe et miroir blanc
  // pattes : diagonales en phase (avant gauche + arrière droite) ; avant : genou vers l'arrière,
  // arrière : jarret vers l'arrière lui aussi (le grasset est caché dans la cuisse)
  for (const [x, f, off, hind] of [[-1.6, 4.6, 0, 0], [1.6, 4.6, 0.5, 0], [-1.7, -4.8, 0.5, 1], [1.7, -4.8, 0, 1]]) {
    const p = ph + off * Math.PI * 2;
    const top = [x, f, bodyZ - 1.5];
    const hoof = [x * 0.95, f + Math.sin(p) * stride, Math.max(0, Math.cos(p)) * lift];
    const joint = ik(top, hoof, hind ? 7.4 : 6.9, hind ? 7.4 : 7.05, [0, -1, hind ? 0.4 : -0.1]);
    const grp = 2 + (x > 0 ? 1 : 0) + hind * 2;
    P.push({ a: [x, f + (hind ? -0.4 : 0.4), bodyZ - 0.5], b: top, r1: hind ? 2.4 : 2, r2: 1.4, ramp: DEER, group: grp, tex: pelt }); // épaule, cuisse
    P.push({ a: top, b: joint, r1: hind ? 1.3 : 1.1, r2: 0.7, ramp: DEER, group: grp, tex: pelt });
    P.push({ a: joint, b: hoof, r1: 0.55, r2: 0.45, ramp: DEER, group: grp });
    P.push({ a: [hoof[0], hoof[1] + 0.3, hoof[2] + 0.2], r1: 0.55, ramp: BLOOD.map((c) => c.map((v) => v * 0.35)), group: grp }); // sabot sombre
  }
  // cou : part haut du poitrail, gorge claire ; tête basse quand il broute
  const gz = pose.graze;
  const neckBase = [0, 6.2, bodyZ + 2.2];
  const neckTop = [0, 8.6 + gz * 3.2, bodyZ + 8.8 - gz * 15.5];
  P.push({ a: neckBase, b: neckTop, r1: 2.1, r2: 1.35, ramp: DEER, group: 8, tex: (p) => (p.ny > 0.2 && p.nz > 0 ? CREAM[clamp3(p.shade)] : pelt(p)) });
  const head = [0, neckTop[1] + 0.9, neckTop[2] + 0.4 - gz * 1.2];
  const snout = [0, head[1] + 3, head[2] - 1.6 - gz * 0.6];
  P.push({ a: head, b: snout, r1: 1.55, r2: 0.85, ramp: DEER, group: 9, tex: (p) => {
    if (p.t > 0.88) return [26, 18, 14]; // truffe
    const f = p.nx * p.fc[0] + p.ny * p.fc[1] + p.nz * p.fc[2];
    if (p.t < 0.32 && p.ny < 0.05 && p.ny > -0.4 && Math.abs(p.nx * p.fc[2] - p.nz * p.fc[0]) > 0.55 && f < 0.6) return [20, 14, 12]; // œil
    return clamp3(p.shade);
  } });
  // grandes oreilles en cornet, écartées
  for (const s of [-1, 1]) P.push({ a: [s * 0.9, head[1] - 0.9, head[2] + 1], b: [s * 3, head[1] - 1.8, head[2] + 2.6], r1: 0.5, r2: 1.05, ramp: DEER, group: 10, tex: (p) => (p.t > 0.5 && p.nz > 0.3 ? CREAM[1] : p.shade) });
  if (pose.buck) {
    for (const s of [-1, 1]) {
      const base = [s * 0.7, head[1] - 0.4, head[2] + 1.4];
      const mid = [s * 2.2, head[1] - 0.9, head[2] + 4.6], tip = [s * 2.4, head[1] + 1.2, head[2] + 7.4];
      P.push({ a: base, b: mid, r1: 0.42, r2: 0.36, ramp: ANTLER, group: 11 });
      P.push({ a: mid, b: tip, r1: 0.34, r2: 0.25, ramp: ANTLER, group: 11 });
      P.push({ a: [s * 1.6, head[1] - 0.8, head[2] + 3.4], b: [s * 1.8, head[1] + 1.2, head[2] + 4.4], r1: 0.28, ramp: ANTLER, group: 11 }); // andouiller
      P.push({ a: mid, b: [s * 3.6, head[1] - 1.4, head[2] + 6.2], r1: 0.26, ramp: ANTLER, group: 11 });
    }
  }
  P.push({ a: [0, -8, bodyZ + 1.6], b: [0, -8.6, bodyZ + 0.2], r1: 0.85, r2: 0.6, ramp: DEER, group: 12, tex: (p) => (p.nz < 0 ? CREAM[3] : p.shade) }); // queue
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
