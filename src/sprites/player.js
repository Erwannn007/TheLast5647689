// Le survivant : capsules et sphères (renderModel), proportions d'adulte (~32 px, tête ~1/7).
// Parka kaki, jean, chaussures de marche, sac à dos à bretelles, cheveux courts.
// Le bas du corps suit la marche ; le buste peut tourner de ±90° (visée) : on cuit chaque
// direction des jambes avec 5 torsions du buste (-90°, -45°, 0, +45°, +90°).
import { renderModel, ik, rotZ, add, hash } from '../raster.js';
import { SKIN, HAIR, JACKET, JEANS, BOOTS, PACK, WOOD, STEEL } from '../palette.js';

export const DIRS = 8;
export const WALK_FRAMES = 8, RUN_FRAMES = 12, IDLE_FRAMES = 4, ACT_FRAMES = 4;
// longueur d'un cycle (deux pas) en cases : sert à caler la cadence sur la vitesse, sans glisser
export const WALK_CYCLE = 0.92, RUN_CYCLE = 1.7;
export const TWISTS = [-2, -1, 0, 1, 2]; // en huitièmes de tour
const clamp3 = (s) => (s < 0 ? 0 : s > 3 ? 3 : s);

// pose : { phase (marche 0..1), walk (0/1), breathe (-1..1), act (-1 ou 0..1), twist (rad), tool }
function bodyParts(pose) {
  const P = [];
  const w = pose.walk, ph = pose.phase * Math.PI * 2, run = pose.run ? 1 : 0;
  // course : deux phases de vol par cycle, le corps est au plus haut juste après l'impulsion
  const bob = !w ? pose.breathe * 0.3 : run ? Math.cos(4 * Math.PI * (pose.phase - 0.24)) * 0.8 : (Math.abs(Math.cos(ph)) - 0.5) * 0.7;
  const sway = w ? Math.sin(ph) * (run ? 0.2 : 0.35) : 0; // le bassin bascule d'une jambe sur l'autre
  const hipZ = 15.8 + bob;
  // --- jambes (repère des jambes)
  for (const side of [-1, 1]) {
    const s = w ? Math.sin(ph) * side : 0;
    const lift = w ? Math.max(0, Math.cos(ph) * side) * 1.7 : 0;
    const hip = [side * 1.75 + sway * 0.4, 0, hipZ];
    let foot = [side * 1.7, s * 3.6, 1.35 + lift];
    if (run) {
      // appui (38 % du cycle) : le pied posé devant recule sous le corps ; puis le talon remonte
      // derrière vers la fesse, le genou passe devant, haut, et le pied se repose loin devant
      const f = (pose.phase + (side > 0 ? 0.5 : 0)) % 1;
      if (f < 0.38) { const t = f / 0.38; foot = [side * 1.5, 4.2 - 8.2 * t, 1.35]; }
      else {
        const t = (f - 0.38) / 0.62, sm = t * t * (3 - 2 * t);
        foot = [side * 1.5, -4 + 8.2 * sm - 3.2 * Math.sin(Math.PI * t) * (1 - t), 1.35 + 7 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - 0.35 * t)];
      }
    }
    const knee = ik(hip, foot, 7.4, 7.3, [0, 1, run ? 0.35 : 0.1]);
    const denim = (p) => {
      let sh = p.shade;
      if (p.t > 0.92 && p.t < 1 && hash(p.x, p.y, 3) < 0.5) sh--; // pli au genou
      return clamp3(sh);
    };
    P.push({ a: hip, b: knee, r1: 1.6, r2: 1.32, ramp: JEANS, group: 10 + side, tex: denim });
    P.push({ a: knee, b: foot, r1: 1.28, r2: 1.08, ramp: JEANS, group: 10 + side, tex: denim });
    // chaussure : talon puis bout, semelle sombre
    P.push({ a: [foot[0], foot[1] - 0.5, foot[2] - 0.3], b: [foot[0], foot[1] + 1.9, foot[2] - 0.55], r1: 1.12, r2: 0.95, ramp: BOOTS, group: 20 + side,
      tex: (p) => (p.ny > 0.45 ? 0 : p.shade) });
  }
  P.push({ a: [-1.3 + sway * 0.4, 0, hipZ + 0.6], b: [1.3 + sway * 0.4, 0, hipZ + 0.6], r1: 2.1, ramp: JEANS, group: 12 });

  // --- buste (tourne autour de la colonne : torsion de visée + contre-balancier de la marche)
  // les épaules tournent à l'opposé du bassin (plus fort en courant)
  const twist = pose.twist + (!w ? 0 : run ? -Math.cos(ph) * 0.24 : -Math.sin(ph) * 0.12);
  // en courant le buste penche vers l'avant (d'autant plus qu'on monte)
  const lean = run * 0.21;
  const tw = (p) => add(rotZ([p[0], p[1] + lean * (p[2] - 16), 0], twist), [sway * 0.25, 0, p[2]]);
  const chestZ = 23.4 + bob + pose.breathe * 0.25;
  const parka = (p) => {
    let s = p.shade;
    const front = p.nx * p.fc[0] + p.ny * p.fc[1] + p.nz * p.fc[2];
    if (p.t < 0.14) s--; // bas de la parka, ourlet
    if (front > 0.75 && Math.abs(p.ex) < 0.55) s--; // fermeture éclair
    if (hash(p.x, p.y, 11) < 0.1) s--;
    return clamp3(s);
  };
  P.push({ a: tw([0, 0.1, hipZ + 0.3]), b: tw([0, 0.25, chestZ - 0.6]), r1: 2.75, r2: 3.15, ramp: JACKET, group: 1, tex: parka });
  P.push({ a: tw([-2.9, 0.1, chestZ + 0.6]), b: tw([2.9, 0.1, chestZ + 0.6]), r1: 1.95, ramp: JACKET, group: 1, tex: parka });
  // col de la parka
  P.push({ a: tw([-1.2, 0.1, chestZ + 2]), b: tw([1.2, 0.1, chestZ + 2]), r1: 1.05, ramp: JACKET, group: 1 });
  // sac à dos et bretelles
  P.push({ a: tw([0, -3.1, chestZ - 0.2]), b: tw([0, -3.2, hipZ + 3.3]), r1: 2.15, r2: 2.3, ramp: PACK, group: 2,
    tex: (p) => (Math.abs(p.ey) < 0.45 || p.t > 0.9 ? Math.max(0, p.shade - 1) : p.shade) });
  for (const side of [-1, 1]) P.push({ a: tw([side * 1.7, 0.9, chestZ + 1.3]), b: tw([side * 1.9, 1.9, chestZ - 4]), r1: 0.42, ramp: PACK, group: 3 });

  // --- bras
  for (const side of [-1, 1]) {
    const sh = tw([side * 3.75, 0.1, chestZ + 0.5]);
    let hand;
    if (pose.act >= 0 && side === 1) {
      // geste : on lève le bras puis on frappe vers l'avant
      const a = pose.act < 0.5 ? pose.act * 2 : 1 - (pose.act - 0.5) * 2;
      const up = Math.sin(a * Math.PI * 0.5);
      hand = tw([side * 2.6, 3.2 + up * 1.2, chestZ - 7.5 + up * 12]);
    } else {
      if (run) {
        // bras pliés à angle droit, à l'opposé de la jambe du même côté ; la main monte en avançant
        const f = (pose.phase + (side > 0 ? 0.5 : 0)) % 1;
        const sw = -Math.cos(f * Math.PI * 2) * 3.4;
        hand = tw([side * 3.2, sw + 0.8, chestZ - 6.4 + Math.max(0, sw) * 0.8 - Math.max(0, -sw) * 0.3]);
      } else {
        const swing = w ? -Math.sin(ph) * side * 2.6 : 0;
        hand = tw([side * 4.3, swing + 0.3, chestZ - 9.3 + (w ? Math.abs(swing) * 0.25 : 0)]);
      }
    }
    const elbow = ik(sh, hand, 5.5, 5.1, rotZ([side * 0.25, -1, 0], twist));
    const sleeve = (p) => (p.t > 0.86 ? Math.max(0, p.shade - 1) : p.shade); // poignet resserré
    P.push({ a: sh, b: elbow, r1: 1.28, r2: 1.12, ramp: JACKET, group: 30 + side });
    P.push({ a: elbow, b: hand, r1: 1.1, r2: 0.95, ramp: JACKET, group: 30 + side, tex: sleeve });
    P.push({ a: hand, r1: 0.88, ramp: SKIN, group: 30 + side });
    if (pose.act >= 0 && side === 1 && pose.tool) {
      const tip = add(hand, tw([0, 3.8 + (pose.act < 0.5 ? 0 : 2.5), 4 - (pose.act < 0.5 ? 0 : 7)]));
      P.push({ a: hand, b: tip, r1: 0.5, ramp: WOOD, group: 40 });
      P.push({ a: tip, b: add(tip, [0, -0.3, 0.5]), r1: 1.05, ramp: STEEL, group: 41 });
    }
  }
  // --- cou et tête : visage devant, cheveux courts dessus et derrière, oreilles
  P.push({ a: tw([0, 0.25, chestZ + 2.4]), b: tw([0, 0.35, chestZ + 3.6]), r1: 0.95, ramp: SKIN, group: 4 });
  const head = tw([0, 0.4, chestZ + 5.75]);
  P.push({ a: head, r1: 2.4, ramp: SKIN, group: 5, tex: (p) => {
    const f = p.nx * p.fc[0] + p.ny * p.fc[1] + p.nz * p.fc[2];
    const side = p.nx * p.fc[2] - p.nz * p.fc[0]; // gauche/droite du visage
    if (p.ny < -0.42 || f < -0.2 || (f < 0.3 && p.ny < -0.05)) return HAIR[clamp3(p.shade + (hash(p.x, p.y, 9) < 0.25 ? -1 : 0))];
    if (f > 0.5 && p.ny > -0.18 && p.ny < 0.12 && Math.abs(side) > 0.22 && Math.abs(side) < 0.62) return HAIR[0]; // yeux
    if (f > 0.55 && p.ny > 0.42) return clamp3(p.shade - 1); // ombre du menton
    return p.shade;
  } });
  return P;
}

const facingOf = (d) => { const a = d * Math.PI * 2 / DIRS; return [Math.sin(a), Math.cos(a)]; };
const render = (pose, d) => renderModel(bodyParts(pose), { w: 64, h: 72, ox: 32, oy: 60, facing: facingOf(d) });
// torsion o (huitièmes de tour) : le buste regarde la direction d + o
const twistOf = (o) => o * Math.PI / 4;

// Renvoie { walk, idle, act } indexés [jambes 0..7][torsion 0..4][image], et run [direction][image]
export function bakePlayer(tool = true) {
  const out = { walk: [], idle: [], act: [], run: [] };
  for (let d = 0; d < DIRS; d++) {
    out.run.push(Array.from({ length: RUN_FRAMES }, (_, f) => render({ phase: f / RUN_FRAMES, walk: 1, run: 1, breathe: 0, act: -1, twist: 0 }, d)));
    out.walk.push(TWISTS.map((o) => Array.from({ length: WALK_FRAMES }, (_, f) => render({ phase: f / WALK_FRAMES, walk: 1, breathe: 0, act: -1, twist: twistOf(o) }, d))));
    out.idle.push(TWISTS.map((o) => Array.from({ length: IDLE_FRAMES }, (_, f) => render({ phase: 0, walk: 0, breathe: Math.sin(f / IDLE_FRAMES * Math.PI * 2), act: -1, twist: twistOf(o) }, d))));
    out.act.push(TWISTS.map((o) => Array.from({ length: ACT_FRAMES }, (_, f) => render({ phase: 0, walk: 0, breathe: 0, act: f / ACT_FRAMES, tool, twist: twistOf(o) }, d))));
  }
  return out;
}

// Angle dans le plan caméra (0 = vers la caméra) depuis un déplacement monde, et direction 0..7.
export const angleFromWorld = (dx, dy) => Math.atan2(dx - dy, dx + dy);
export const dirOfAngle = (a) => ((Math.round(a / (Math.PI * 2 / DIRS)) % DIRS) + DIRS) % DIRS;
export const dirFromWorld = (dx, dy) => dirOfAngle(angleFromWorld(dx, dy));
