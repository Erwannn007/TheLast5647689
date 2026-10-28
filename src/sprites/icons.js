// Icônes d'objets 16x16 : de petits volumes cuits (mêmes moteurs que le décor), recentrés.
import { renderModel, makeBuffer, ramp, hash } from '../raster.js';
import { box, cylinder, ellipsoid, capsule, renderSolids } from '../solids.js';
import { STEEL, METAL, FABRIC, CREAM, WOOD, DARKWOOD, BARK, BERRY, ENAMEL, RUST, TIRE } from '../palette.js';

const APPLE = ramp('#4a1010', '#7e1c18', '#b0302a', '#d86048');
const LEAF = ramp('#1d4728', '#2d6a33', '#4a923d', '#7dc257');
const BREAD = ramp('#5e3416', '#8e5626', '#bb7f3e', '#ddb06a');
const FISH = ramp('#283848', '#4a6478', '#7c96a6', '#c0d0d8');
const COOKED = ramp('#3e2210', '#6a3c1c', '#9a602e', '#c88c4c');
const WATER = ramp('#2a4e78', '#4878a8', '#78a8d0', '#c4e0f2');
const MURKY = ramp('#2a3220', '#46502e', '#6a7040', '#98985c');
const EMPTY = ramp('#5a6a78', '#8a9cac', '#b8c8d4', '#e4eef4');
const ORANGE = ramp('#6a2a08', '#a84a12', '#d8742a', '#f4a456');
const YELLOW = ramp('#6b4a10', '#b0851e', '#e0b23a', '#ffe07a');
const COPPER = ramp('#5a2c14', '#8a4a24', '#b86e3a', '#e09a5e');
const PAPER = ramp('#7a7468', '#aaa496', '#d0cabb', '#ece6d6');
const STRING = ramp('#5e4c30', '#8a7448', '#b09a64', '#d4c088');

const plain = (q) => (q.face === 't' ? Math.min(3, q.shade + 1) : q.shade);
const sm = (P) => ({ ...P, smooth: true });
const band = (z0, z1, r, base) => (q) => (q.face !== 't' && q.z > z0 && q.z < z1 ? r[q.shade] : base ? base[q.face === 't' ? 3 : q.shade] : plain(q));

// recentre un buffer recadré dans une case 16x16
function fit(buf) {
  const out = makeBuffer(16, 16);
  const dx = Math.round((16 - buf.w) / 2), dy = Math.round((16 - buf.h) / 2);
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const o = (y * buf.w + x) * 4;
    if (buf.data[o + 3]) out.set(x + dx, y + dy, [buf.data[o], buf.data[o + 1], buf.data[o + 2]], buf.data[o + 3]);
  }
  return out;
}
function crop(b) {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.data[(y * b.w + x) * 4 + 3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = makeBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = ((y + y0) * b.w + x + x0) * 4;
    if (b.data[o + 3]) out.set(x, y, [b.data[o], b.data[o + 1], b.data[o + 2]], b.data[o + 3]);
  }
  return out;
}
const solid = (prims) => fit(renderSolids(prims, 28, 28, 14, 20).img);
const model = (parts) => fit(crop(renderModel(parts, { w: 28, h: 28, ox: 14, oy: 20 })));

const can = (label, top = STEEL) => solid([sm(cylinder(0, 0, 3.3, 0, 8, top, band(1.5, 6.5, label)))]);
const bottle = (liquid) => solid([
  sm(cylinder(0, 0, 2.6, 0, 7.5, liquid, (q) => (q.face !== 't' && q.z > 2.5 && q.z < 5 ? CREAM[q.shade] : plain(q)))),
  sm(cylinder(0, 0, 1.4, 7.5, 9.5, liquid)), sm(cylinder(0, 0, 1.3, 9.5, 11, FABRIC.blue)),
]);
const diag = (len) => [[-len / 2, 0, -len / 2.6], [len / 2, 0, len / 2.6]];

export const ICONS = {
  haricots: () => can(FABRIC.red),
  soupe: () => can(CREAM),
  chips: () => solid([sm(ellipsoid(0, 0, 5, 4.5, 1.6, 5.5, FABRIC.blue, (q) => (Math.abs(q.z - 5) < 1.4 ? YELLOW[q.shade] : q.shade), 0))]),
  chocolat: () => solid([sm(box(-1.8, 1.8, -5.5, 5.5, 0, 2.5, FABRIC.brown, (q) => (Math.abs(q.v) > 3.8 ? STEEL[q.shade] : plain(q))))]),
  pomme: () => model([
    { a: [0, 0, 4.5], r1: 4.5, ramp: APPLE, group: 1, tex: (p) => (p.nz > 0.8 && p.ny < -0.3 ? 3 : p.shade) },
    { a: [0, 0, 8.5], b: [0.6, 0, 10.5], r1: 0.6, ramp: WOOD, group: 2 },
    { a: [1.6, 0, 10], b: [3.5, 0, 10.6], r1: 1, ramp: LEAF, group: 3 },
  ]),
  pain: () => model([{ a: [-5, 0, 3], b: [5, 0, 3], r1: 3.2, ramp: BREAD, group: 1, tex: (p) => (p.ny < -0.4 && ((p.x + 1) % 4 === 0) ? 1 : p.shade) }]),
  cereales: () => solid([box(-3.5, 3.5, -1.5, 1.5, 0, 10.5, FABRIC.beige, (q) => (q.face === 'l' && Math.abs(q.z - 6) < 2.2 && Math.abs(q.u) < 2.4 ? FABRIC.red[q.shade] : plain(q)))]),
  biscuits: () => solid([sm(box(-1.8, 1.8, -5, 5, 0, 4.5, FABRIC.blue, (q) => (Math.abs(q.v) > 3.4 ? BREAD[q.shade] : plain(q))))]),
  poisson: () => model(fishParts(FISH)),
  poisson_cuit: () => model(fishParts(COOKED)),
  baies: () => model([[0, 0, 2], [-2.4, 1, 2], [2.4, 0.6, 2], [-1.2, -1.5, 4], [1.3, -1, 4.2], [0, 0.5, 5.8]].map(([x, y, z], i) => ({ a: [x, y, z], r1: 1.7, ramp: BERRY, group: i }))),
  eau: () => bottle(WATER),
  eau_sale: () => bottle(MURKY),
  bouteille: () => bottle(EMPTY),
  soda: () => solid([sm(cylinder(0, 0, 2.8, 0, 8, STEEL, band(1, 7, FABRIC.red)))]),
  bandage: () => solid([sm(cylinder(0, 0, 3.4, 0, 4.5, CREAM, (q) => (q.face === 't' && Math.hypot(q.u, q.v) < 1.2 ? 0 : plain(q)))), sm(box(1, 6, 2.6, 3.2, 0, 4, CREAM, plain))]),
  chiffon: () => solid([sm(ellipsoid(0, 0, 1, 5.5, 4.5, 2.2, FABRIC.white, (q) => (hash(q.x >> 1, q.y, 4) < 0.3 ? Math.max(0, q.shade - 1) : q.shade), 0))]),
  comprimes: () => solid([sm(cylinder(0, 0, 2.6, 0, 6.5, ORANGE)), sm(cylinder(0, 0, 2.9, 6.5, 8.5, ENAMEL))]),
  hache: () => model([
    { a: [-5, 0, -4], b: [4, 0, 5], r1: 0.9, ramp: WOOD, group: 1 },
    { a: [2, 0, 6], b: [5.5, 0, 3], r1: 1.9, r2: 1.2, ramp: STEEL, group: 2 },
  ]),
  couteau: () => model([
    { a: [-5, 0, -4], b: [-1.5, 0, -0.5], r1: 1.1, ramp: DARKWOOD, group: 1 },
    { a: [-1, 0, 0], b: [5, 0, 5.5], r1: 1.1, r2: 0.5, ramp: STEEL, group: 2 },
  ]),
  ouvre_boite: () => model([
    { a: [-4.5, 0, -4], b: [1, 0, 1.5], r1: 0.9, ramp: FABRIC.red, group: 1 },
    { a: [-3, 0, -5.5], b: [2.5, 0, 0], r1: 0.9, ramp: FABRIC.red, group: 2 },
    { a: [2, 0, 1.5], r1: 1.8, ramp: STEEL, group: 3 },
  ]),
  pied_de_biche: () => model([
    { a: [-5, 0, -5], b: [4, 0, 4], r1: 0.9, ramp: FABRIC.red, group: 1 },
    { a: [4, 0, 4], b: [5.5, 0, 6], r1: 0.9, ramp: FABRIC.red, group: 1 },
    { a: [5.5, 0, 6], b: [3.5, 0, 7], r1: 0.8, ramp: FABRIC.red, group: 1 },
    { a: [-5, 0, -5], b: [-6.5, 0, -4], r1: 0.8, ramp: STEEL, group: 2 },
  ]),
  lampe: () => model([
    { a: [-4.5, 0, -3.5], b: [2, 0, 2], r1: 1.7, ramp: METAL, group: 1 },
    { a: [2, 0, 2], b: [4, 0, 3.6], r1: 2.6, r2: 2.8, ramp: YELLOW, group: 2, tex: (p) => (p.t > 0.8 ? 3 : p.shade) },
  ]),
  piles: () => solid([
    sm(cylinder(-2, 0, 1.7, 0, 6, COPPER, (q) => (q.z > 4.4 && q.face !== 't' ? TIRE[q.shade] : plain(q)))),
    sm(cylinder(2, 1, 1.7, 0, 6, COPPER, (q) => (q.z > 4.4 && q.face !== 't' ? TIRE[q.shade] : plain(q)))),
  ]),
  allumettes: () => solid([box(-2.5, 2.5, -4, 4, 0, 2.5, FABRIC.red, (q) => (q.face === 't' && Math.abs(q.v) < 2.5 && Math.abs(q.u) < 1.6 ? YELLOW[2] : plain(q))), box(-2.6, 2.6, 2.5, 4.1, 0, 2.6, CREAM, plain)]),
  briquet: () => solid([sm(box(-2, 2, -1, 1, 0, 7, FABRIC.blue, plain)), sm(box(-2, 2, -1, 1, 7, 9, STEEL, plain))]),
  canne: () => model([
    { a: [-6, 0, -6], b: [6, 0, 7], r1: 0.5, ramp: WOOD, group: 1 },
    { a: [-3.5, 1.2, -3], r1: 1.8, ramp: METAL, group: 2 },
    { a: [6, 0, 7], b: [6.5, 0, -1], r1: 0.25, ramp: CREAM, group: 3 },
  ]),
  radio: () => solid([
    box(-5, 5, -2, 2, 0, 7, DARKWOOD, (q) => {
      if (q.face === 'l' && q.u < 1 && q.z > 1.5 && q.z < 5.5) return ((q.u + q.z * 0 + 64) % 1.5) < 0.6 ? 0 : 1;
      if (q.face === 'l' && q.u > 2 && q.u < 4 && Math.abs(q.z - 3.5) < 1) return CREAM[2];
      return plain(q);
    }),
    capsule([3, 0, 7], [6, 0, 12], 0.3, STEEL),
  ]),
  buche: () => model([{ a: [-5, 0, 2], b: [5, 0, 2], r1: 2.8, ramp: BARK, group: 1, tex: (p) => {
    if (p.t > 0.97 && p.nz > 0.2) { const d = Math.hypot(p.ex, p.ey); return CREAM[(d | 0) % 2 ? 1 : 2]; }
    return (p.x % 3 === 0 && p.shade > 0) ? p.shade - 1 : p.shade;
  } }]),
  branche: () => model([
    { a: [-6, 0, -4], b: [5, 0, 4], r1: 0.8, ramp: BARK, group: 1 },
    { a: [0, 0, 0.3], b: [2, 0, 5], r1: 0.6, ramp: BARK, group: 1 },
    { a: [2.5, 0, 2], b: [4, 0, -1], r1: 0.5, ramp: BARK, group: 1 },
  ]),
  drap: () => solid([sm(box(-5, 5, -4, 4, 0, 3, FABRIC.blue, (q) => (q.face === 't' && Math.abs(q.v) < 0.5 ? 1 : q.face !== 't' && ((q.z + 64) % 1.5) < 0.5 ? 1 : plain(q))))]),
  journal: () => solid([sm(box(-4.5, 4.5, -5, 5, 0, 1.5, PAPER, (q) => (q.face === 't' && Math.abs(q.u) < 3.5 && ((q.v + 64) % 1.6) < 0.6 ? 1 : plain(q))))]),
  livre: () => solid([box(-3.5, 3.5, -5, 5, 0, 2.5, FABRIC.green, (q) => (q.face !== 't' && q.z > 0.5 && q.z < 2 && (q.face === 'r' ? true : q.u > -3) ? PAPER[q.shade + 1 > 3 ? 3 : q.shade + 1] : plain(q)))]),
  note: () => solid([sm(box(-4, 4, -5, 5, 0, 0.8, PAPER, (q) => (q.face === 't' && Math.abs(q.u) < 3 && ((q.v + 64) % 2) < 0.6 && q.v < 3 ? 0 : plain(q))))]),
  photo: () => solid([sm(box(-4, 4, -5, 5, 0, 0.8, ENAMEL, (q) => {
    if (q.face === 't' && Math.abs(q.u) < 3 && q.v > -4 && q.v < 3) return q.v < -0.5 ? WATER[2] : q.u > 0.5 && q.v < 1.5 ? APPLE[2] : LEAF[1];
    return plain(q);
  }))]),
  ficelle: () => solid([cylinder(0, 0, 3, 0, 1, WOOD), sm(cylinder(0, 0, 2.6, 1, 5, STRING, (q) => (q.face !== 't' && ((q.z * 2) | 0) % 2 ? 1 : plain(q)))), cylinder(0, 0, 3, 5, 6, WOOD)]),
  kit_feu: () => model([
    { a: [-5, -1, 2], b: [5, -1, 2], r1: 2, ramp: BARK, group: 1 },
    { a: [-5, 2, 2], b: [5, 2, 2], r1: 2, ramp: BARK, group: 2 },
    { a: [-4, 0.5, 5.3], b: [4, 0.5, 5.3], r1: 1.8, ramp: BARK, group: 3 },
  ]),
  conserve_vide: () => solid([sm(cylinder(0, 0, 3.3, 0, 8, RUST, (q) => (q.face === 't' ? (Math.hypot(q.u, q.v) < 2.6 ? 0 : 2) : q.shade)))]),
};

function fishParts(R) {
  return [
    { a: [-3.5, 0, 3], b: [3.5, 0, 3], r1: 2.6, r2: 1.6, ramp: R, group: 1, tex: (p) => (p.t < 0.12 && p.ny < 0 && p.nx < -0.2 && p.ny > -0.5 ? 0 : p.ny > 0.4 ? Math.min(3, p.shade + 1) : p.shade) },
    { a: [4, 0, 3], b: [6.5, 0, 5], r1: 1.2, r2: 0.6, ramp: R, group: 2 },
    { a: [4, 0, 3], b: [6.5, 0, 1], r1: 1.2, r2: 0.6, ramp: R, group: 2 },
  ];
}

export function iconBuffer(id) {
  const f = ICONS[id];
  const b = f ? f() : makeBuffer(16, 16);
  return Object.assign(b, { ox: 0, oy: 0 });
}
