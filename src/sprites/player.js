// Le survivant : capsules et sphères (renderModel), 8 directions, cuit au chargement.
// Parka kaki, jean, bonnet rouille, petit sac à dos. ~27 px de haut.
import { renderModel, ik, rotZ, add } from '../raster.js';
import { SKIN, HAIR, JACKET, JEANS, BOOTS, BEANIE, PACK, WOOD, STEEL } from '../palette.js';

export const DIRS = 8;
export const WALK_FRAMES = 8, IDLE_FRAMES = 4, ACT_FRAMES = 4;
const clamp3 = (s) => (s < 0 ? 0 : s > 3 ? 3 : s);

// pose : { phase (marche 0..1), walk (0/1), breathe, act (-1 ou 0..1) }
function bodyParts(pose) {
  const P = [];
  const w = pose.walk, ph = pose.phase * Math.PI * 2;
  const bob = w ? Math.abs(Math.sin(ph)) * 0.9 - 0.4 : pose.breathe * 0.5;
  const twist = w ? Math.sin(ph) * 0.18 : 0;
  const hipZ = 11.5 + (w ? bob * 0.6 : 0);
  // jambes
  for (const side of [-1, 1]) {
    const s = w ? Math.sin(ph) * side : 0;
    const lift = w ? Math.max(0, Math.cos(ph) * side) * 2.2 : 0;
    const hip = [side * 2, 0, hipZ];
    const foot = [side * 2.1, s * 4.2, 1.6 + lift];
    const knee = ik(hip, foot, 5.8, 5.8, [0, 1, 0]);
    P.push({ a: hip, b: knee, r1: 2.1, r2: 1.9, ramp: JEANS, group: 10 + side });
    P.push({ a: knee, b: foot, r1: 1.9, r2: 1.6, ramp: JEANS, group: 10 + side });
    P.push({ a: [foot[0], foot[1] + 0.4, foot[2] - 0.2], b: [foot[0], foot[1] + 2, foot[2] - 0.4], r1: 1.7, r2: 1.5, ramp: BOOTS, group: 20 + side });
  }
  // buste (torsion des épaules opposée aux hanches)
  const chestZ = 19.5 + bob;
  const tw = (p) => add(rotZ([p[0], p[1], 0], -twist), [0, 0, p[2]]);
  const coat = (p) => {
    // fermeture et poches : lignes sombres sur l'avant
    let s = p.shade;
    if (Math.abs(p.ex) < 0.6 && p.nz > 0.3 && Math.abs(p.fc[0]) < 0.4 && p.fc[2] > 0.4) s--;
    return clamp3(s);
  };
  P.push({ a: [0, 0, hipZ - 0.5], b: [0, 0, chestZ - 2], r1: 3.9, r2: 4.2, ramp: JACKET, group: 1, tex: coat });
  P.push({ a: tw([-3.4, 0, chestZ]), b: tw([3.4, 0, chestZ]), r1: 2.7, ramp: JACKET, group: 1 });
  // sac à dos
  P.push({ a: tw([0, -3.6, chestZ - 1.5]), b: tw([0, -3.6, hipZ + 2.5]), r1: 3, r2: 2.8, ramp: PACK, group: 2,
    tex: (p) => (Math.abs(p.ey) < 0.5 ? Math.max(0, p.shade - 1) : p.shade) });
  // bras
  for (const side of [-1, 1]) {
    const sh = tw([side * 4.4, 0, chestZ]);
    let hand;
    if (pose.act >= 0 && side === 1) {
      // geste : le bras droit monte puis frappe vers l'avant
      const a = pose.act < 0.5 ? pose.act * 2 : 1 - (pose.act - 0.5) * 2;
      const up = Math.sin(a * Math.PI * 0.5);
      hand = [side * 3.6, 3 + up * 1.5 - (1 - up) * -2, chestZ - 6 + up * 12];
    } else {
      const sw = w ? -Math.sin(ph) * side * 3.6 : 0;
      hand = [side * 5.2, sw, chestZ - 9 + (w ? Math.abs(sw) * 0.2 : pose.breathe * 0.4)];
    }
    hand = tw(hand);
    const elbow = ik(sh, hand, 4.8, 4.6, [side * 0.3, -1, 0]);
    P.push({ a: sh, b: elbow, r1: 1.75, r2: 1.6, ramp: JACKET, group: 30 + side });
    P.push({ a: elbow, b: hand, r1: 1.6, r2: 1.45, ramp: JACKET, group: 30 + side });
    P.push({ a: hand, r1: 1.35, ramp: SKIN, group: 30 + side });
    if (pose.act >= 0 && side === 1 && pose.tool) {
      // outil tenu : un manche et une tête d'acier
      const tip = add(hand, [0, 4 + (pose.act < 0.5 ? 0 : 3), 4 - (pose.act < 0.5 ? 0 : 7)]);
      P.push({ a: hand, b: tip, r1: 0.7, ramp: WOOD, group: 40 });
      P.push({ a: tip, b: add(tip, [0, -0.5, 0.6]), r1: 1.3, ramp: STEEL, group: 41 });
    }
  }
  // tête : visage à l'avant, cheveux derrière, bonnet dessus
  const head = [0, 0.4, chestZ + 5.3];
  P.push({ a: [0, 0.2, chestZ + 2.2], r1: 1.6, ramp: SKIN, group: 3 });
  P.push({ a: head, r1: 3.7, ramp: SKIN, group: 4, tex: (p) => {
    const f = p.nx * p.fc[0] + p.ny * p.fc[1] + p.nz * p.fc[2];
    if (p.ny < -0.5) return BEANIE[clamp3(p.shade + ((p.x & 1) && p.ny > -0.62 ? -1 : 0))];
    if (f < -0.15 || (f < 0.25 && p.ny < 0.15)) return HAIR[p.shade];
    // yeux : deux pixels sombres sous le bonnet, de part et d'autre de l'axe du visage
    if (f > 0.55 && p.ny > -0.2 && p.ny < 0.05) {
      const side = p.nx * p.fc[2] - p.nz * p.fc[0];
      if (Math.abs(side) > 0.18 && Math.abs(side) < 0.55) return HAIR[0];
    }
    return p.shade;
  } });
  // revers du bonnet : un bourrelet
  P.push({ a: [-3.2, 0.4, chestZ + 7], b: [3.2, 0.4, chestZ + 7], r1: 1, ramp: BEANIE, group: 4 });
  return P;
}

const facingOf = (d) => { const a = d * Math.PI * 2 / DIRS; return [Math.sin(a), Math.cos(a)]; };
const render = (pose, d) => renderModel(bodyParts(pose), { w: 64, h: 62, ox: 32, oy: 50, facing: facingOf(d) });

// Renvoie { walk[d][f], idle[d][f], act[d][f] }
export function bakePlayer(tool = true) {
  const out = { walk: [], idle: [], act: [] };
  for (let d = 0; d < DIRS; d++) {
    out.walk.push(Array.from({ length: WALK_FRAMES }, (_, f) => render({ phase: f / WALK_FRAMES, walk: 1, breathe: 0, act: -1 }, d)));
    out.idle.push(Array.from({ length: IDLE_FRAMES }, (_, f) => render({ phase: 0, walk: 0, breathe: Math.sin(f / IDLE_FRAMES * Math.PI * 2), act: -1 }, d)));
    out.act.push(Array.from({ length: ACT_FRAMES }, (_, f) => render({ phase: 0, walk: 0, breathe: 0, act: f / ACT_FRAMES, tool }, d)));
  }
  return out;
}

// Direction de dessin (0..7) depuis un déplacement monde (dx, dy).
export function dirFromWorld(dx, dy) {
  const cx = dx - dy, ct = dx + dy; // droite écran, vers la caméra
  const a = Math.atan2(cx, ct);
  return ((Math.round(a / (Math.PI * 2 / DIRS)) % DIRS) + DIRS) % DIRS;
}
