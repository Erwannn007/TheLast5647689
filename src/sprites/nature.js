// Végétal et rochers : volumes ronds (renderModel), 4 images de balancement.
import { renderModel, makeBuffer, outlineBuffer, hash, hex } from '../raster.js';
import { BARK, BIRCH, LEAVES, PINE, CONE, BUSH, ROCK, MOSS, TALLGRASS, REED, BERRY, SHADOW } from '../palette.js';

export const SWAY_FRAMES = 4;
const clamp3 = (s) => (s < 0 ? 0 : s > 3 ? 3 : s);

// Feuillage : ±1 ton au hash, dessous dans l'ombre, bord dentelé (trous au hash sur la tranche).
const leafTex = (seed, holes = 0.35) => (p) => {
  if (p.nz < 0.28 && hash(p.x, p.y, seed + 5) < holes) return null;
  const r = hash(p.x, p.y, seed);
  let s = p.shade;
  if (r < 0.16) s--; else if (r > 0.93) s++;
  if (p.ny > 0.62) s--;
  return clamp3(s);
};

// kind : oak | birch | pine | dead ; pal : nom de rampe de feuillage (oak, birch)
function treeParts(kind, f, seed, pal) {
  const sway = Math.sin(f / SWAY_FRAMES * Math.PI * 2);
  const sw = (z) => sway * 0.06 * Math.max(0, z - 10); // le haut bouge plus que le bas
  const parts = [];
  const rnd = (k) => hash(k, seed, 41);
  if (kind === 'oak' || kind === 'birch') {
    const birch = kind === 'birch';
    const main = LEAVES[pal], alt = LEAVES[pal === 'green' ? 'olive' : pal === 'yellow' ? 'olive' : 'yellow'];
    const trunk = birch ? BIRCH : BARK;
    parts.push({ a: [0, 0, 0], b: [sw(18), 0, birch ? 22 : 17], r1: birch ? 2.4 : 3.4, r2: birch ? 1.6 : 2.4, ramp: trunk, group: 1,
      tex: birch
        ? (p) => (hash(p.x >> 1, p.y, seed) < 0.22 ? 0 : p.shade)
        : (p) => ((p.x + 1) % 3 === 0 && p.shade > 0 ? p.shade - 1 : p.shade) });
    if (!birch) {
      parts.push({ a: [-2.5, 1, 0.5], r1: 2, ramp: BARK, group: 1 });
      parts.push({ a: [2.5, -1, 0.5], r1: 2, ramp: BARK, group: 1 });
    }
    const blobs = birch
      ? [[0, 0, 26, 7], [-5, 2, 22, 5.5], [5, 1, 23, 5.5], [-1, -3, 31, 6], [2, 3, 33, 5]]
      : [[0, 0, 25, 10], [-7, 2, 21, 7], [7, 1, 21, 7.5], [-2, -6, 27, 8], [4, 5, 28, 7], [-4, 2, 32, 6.5], [3, -2, 33, 6]];
    blobs.forEach(([x, y, z, r], i) => {
      const jx = (rnd(i) - 0.5) * 2, jz = (rnd(i + 9) - 0.5) * 2;
      const rm = i === 2 || i === 5 ? alt : main;
      parts.push({ a: [x + jx + sw(z), y, z + jz], r1: r, ramp: rm, group: 2 + (i > 3 ? 1 : 0), tex: leafTex(seed + i) });
    });
  } else if (kind === 'pine') {
    const needles = (i, core) => (p) => {
      const r = hash(p.x, p.y, seed + i * 13);
      if (!core && r > 0.988 && p.t > 0.35 && p.ny > -0.2) return CONE;
      let sh = p.shade;
      if (core) sh--;
      else if (p.t > 0.72) sh++;
      if (p.ny > 0.5) sh--;
      if (r < 0.17) sh--; else if (r > 0.95) sh++;
      return clamp3(sh);
    };
    parts.push({ a: [0, 0, 0], b: [sw(12), 0, 12], r1: 2.3, r2: 1.3, ramp: BARK, group: 1,
      tex: (p) => ((p.y % 3 === 0 || hash(p.x, p.y, 8) < 0.15) && p.shade > 0 ? p.shade - 1 : p.shade) });
    for (const [x, y] of [[-2.8, 1.3], [2.6, -1.2], [0.8, 2.8]]) parts.push({ a: [x, y, 0.3], b: [0, 0, 2.6], r1: 1.25, r2: 1, ramp: BARK, group: 1 });
    const tiers = [[9.5, 11, 8], [14.5, 9.3, 8], [19.5, 7.5, 7], [24.2, 5.7, 6], [28.5, 4, 5]];
    tiers.forEach(([z, R, n], i) => {
      const g = 2 + i;
      parts.push({ a: [sw(z - 1), 0, z - 1], b: [sw(z + 6), 0, z + 6], r1: R * 0.6, r2: 0.9, ramp: PINE, group: g, tex: needles(i, true) });
      for (let k = 0; k < n; k++) {
        const a = (k / n + rnd(i * 17 + k) * 0.1 + i * 0.29) * Math.PI * 2, rr = R * (0.82 + rnd(i * 17 + k + 7) * 0.26);
        const ez = z - 2 - rnd(i * 31 + k) * 1.4, sz = z + 1.2;
        parts.push({ a: [sw(sz) + Math.cos(a) * 1.2, Math.sin(a) * 1.2, sz], b: [sw(ez) + Math.cos(a) * rr, Math.sin(a) * rr, ez],
          r1: 2.5 - i * 0.22, r2: 1.05, ramp: PINE, group: g, tex: needles(i, false) });
      }
    });
    parts.push({ a: [sw(31), 0, 31], b: [sw(38), 0, 38], r1: 1.7, r2: 0.35, ramp: PINE, group: 8, tex: needles(6, true) });
  } else if (kind === 'dead') {
    // arbre mort : tronc tordu et branches nues qui se divisent
    const bark = (p) => ((p.y + p.x) % 4 === 0 && p.shade > 0 ? p.shade - 1 : p.shade);
    parts.push({ a: [0, 0, 0], b: [sw(16) + 1, 0, 16], r1: 3, r2: 1.8, ramp: BARK, group: 1, tex: bark });
    parts.push({ a: [-2.4, 1, 0.4], r1: 1.8, ramp: BARK, group: 1 });
    const branch = (A, ang, len, r, depth, k) => {
      const B = [A[0] + Math.cos(ang) * len * 0.8, A[1] + Math.sin(ang * 1.7) * len * 0.4, A[2] + len * (0.55 + rnd(k) * 0.3)];
      B[0] += sw(B[2]);
      parts.push({ a: A, b: B, r1: r, r2: r * 0.65, ramp: BARK, group: 1, tex: bark });
      if (depth > 0) {
        branch(B, ang - 0.5 - rnd(k + 1) * 0.3, len * 0.7, r * 0.65, depth - 1, k * 3 + 1);
        branch(B, ang + 0.45 + rnd(k + 2) * 0.3, len * 0.65, r * 0.65, depth - 1, k * 3 + 2);
      }
    };
    branch([sw(16) + 1, 0, 15], -0.6, 9, 1.6, 2, 1);
    branch([sw(13) + 0.6, 0, 12], Math.PI + 0.5, 8, 1.4, 1, 2);
    branch([sw(16) + 1, 0, 16], Math.PI * 0.5 + 0.2, 7, 1.2, 1, 3);
  }
  return parts;
}

export function treeFrames(kind, seed, pal = 'green') {
  const scale = 0.9 + hash(seed, 2, 3) * 0.25;
  const frames = [];
  for (let f = 0; f < SWAY_FRAMES; f++) {
    frames.push(renderModel(treeParts(kind, f, seed, pal), { w: 64, h: 84, ox: 32, oy: 76, scale }));
  }
  return frames;
}

export function bushFrames(seed, berries = false) {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const s = f ? 0.4 : 0;
    const tex = (i) => (p) => {
      if (berries && p.shade >= 2 && hash(p.x, p.y, seed + 3) < 0.09) return BERRY[hash(p.x, p.y, 4) < 0.5 ? 2 : 3];
      return leafTex(seed + i, 0.3)(p);
    };
    const parts = [
      { a: [-3 + s, 1, 4], r1: 5, ramp: BUSH, group: 1, tex: tex(0) },
      { a: [3 + s, -1, 4.5], r1: 5.5, ramp: BUSH, group: 1, tex: tex(1) },
      { a: [0 + s * 1.5, 0, 8], r1: 5, ramp: BUSH, group: 2, tex: tex(2) },
    ];
    frames.push(renderModel(parts, { w: 32, h: 30, ox: 16, oy: 24 }));
  }
  return frames;
}

export function rockSprite(seed) {
  const r = (k) => hash(k, seed, 7);
  const tex = (i) => (p) => {
    if (p.ny < -0.35 && hash(p.x, p.y, seed + i) < 0.75) return MOSS[clamp3(p.shade)];
    const h = hash(p.x, p.y, seed + i + 20);
    return clamp3(p.shade + (h < 0.14 ? -1 : h > 0.94 ? 1 : 0));
  };
  const parts = [
    { a: [0, 0, 2.5], r1: 5 + r(1) * 1.5, ramp: ROCK, group: 1, tex: tex(1) },
    { a: [4.5, 2, 1.5], r1: 3 + r(2), ramp: ROCK, group: 2, tex: tex(2) },
    { a: [-4, 2.5, 1], r1: 2.2 + r(3), ramp: ROCK, group: 3, tex: tex(3) },
  ];
  return renderModel(parts, { w: 32, h: 24, ox: 16, oy: 18 });
}

// Herbes hautes (pixel par pixel), 3 images : le bout des brins bouge en k².
export function grassFrames(seed, cols = TALLGRASS) {
  const blades = [];
  const n = 7 + ((hash(seed, 1, 1) * 4) | 0);
  for (let i = 0; i < n; i++) blades.push([((hash(i, seed, 2) * 13) | 0) - 6, 5 + ((hash(i, seed, 3) * 7) | 0), (hash(i, seed, 4) * 3) | 0]);
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const b = makeBuffer(20, 18);
    const sway = [0, 1, -1][f];
    for (const [bx, len, c] of blades) {
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const x = 10 + bx + Math.round(sway * k * k * 2 + (bx > 0 ? k * 1.5 : -k * 1.5));
        b.set(x, 16 - i, cols[Math.min(3, c + (k > 0.7 ? 1 : 0))]);
      }
    }
    frames.push(Object.assign(outlineBuffer(b, 0.4), { ox: 10, oy: 15 }));
  }
  return frames;
}

// Roseaux de berge : tiges hautes et massettes brunes.
export function reedFrames(seed) {
  const frames = [];
  const stems = [];
  for (let i = 0; i < 6; i++) stems.push([((hash(i, seed, 2) * 11) | 0) - 5, 9 + ((hash(i, seed, 3) * 8) | 0), hash(i, seed, 5) < 0.5]);
  const head = [hex('#3a2416'), hex('#5a3a22')];
  for (let f = 0; f < 3; f++) {
    const b = makeBuffer(20, 26);
    const sway = [0, 1, -1][f];
    for (const [bx, len, cat] of stems) {
      let x = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        x = 10 + bx + Math.round(sway * k * k * 2);
        b.set(x, 24 - i, REED[Math.min(3, 1 + (k > 0.6 ? 1 : 0) + (bx < 0 ? 1 : 0))]);
      }
      if (cat) for (let i = 0; i < 3; i++) b.set(x, 24 - len + 1 + i, head[i === 0 ? 1 : 0]);
    }
    frames.push(Object.assign(outlineBuffer(b, 0.4), { ox: 10, oy: 23 }));
  }
  return frames;
}

// Ombre au sol : ellipse pleine sans contour.
export function shadowBuffer(rw, rh) {
  const w = rw * 2 + 2, h = rh * 2 + 2;
  const b = makeBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - w / 2) / rw, dy = (y + 0.5 - h / 2) / rh;
    if (dx * dx + dy * dy <= 1) b.set(x, y, SHADOW, 70);
  }
  return Object.assign(b, { ox: w / 2, oy: h / 2 });
}
