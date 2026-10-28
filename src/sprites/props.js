// Meubles et objets du décor : volumes droits, modèle "face avant = +v", 4 orientations (rotPrims).
// Un meuble de 2 cases s'étend vers +u (case voisine en x) avant rotation.
import { hash } from '../raster.js';
import { box, cylinder, ellipsoid, capsule, rotPrims, renderSolids } from '../solids.js';
import {
  WOOD, DARKWOOD, ENAMEL, METAL, STEEL, GLASS, CREAM, FABRIC, TIRE, PAINTWOOD,
  ROCK, BARK, RUST, CONCRETE, TRIM, BRICK, STRAW, CARDBOARD, BUSH, INTERIOR,
} from '../palette.js';

const clamp3 = (s) => (s < 0 ? 0 : s > 3 ? 3 : s);
const front = (q) => q.face === 'l';
const plain = (q) => (q.face === 't' ? Math.min(3, q.shade + 1) : q.shade);
const sm = (P) => ({ ...P, smooth: true });
// planches : lignes sombres le long d'un axe
const planks = (step = 3, axis = 'z') => (q) => {
  if (q.face === 't') return ((q.u + 64) % step) < 0.7 ? 2 : 3;
  const a = axis === 'z' ? q.z : q.face === 'l' ? q.u : q.v;
  return ((a + 64) % step) < 0.7 ? Math.max(0, q.shade - 1) : q.shade;
};

const BOOKS = [FABRIC.red, FABRIC.green, FABRIC.blue, FABRIC.brown, FABRIC.beige];
const PRODUCTS = [FABRIC.red, FABRIC.beige, FABRIC.blue, CREAM, FABRIC.green, RUST];

const MODELS = {
  fridge: () => [
    sm(box(-6, 6, -6, 6, 0, 30, ENAMEL, (q) => {
      if (q.face === 't') return 3;
      if (front(q)) {
        if (Math.abs(q.z - 20) < 0.5) return 0;
        if (Math.abs(q.u - 4) < 0.6 && ((q.z > 8 && q.z < 17) || (q.z > 22 && q.z < 28))) return STEEL[q.shade];
      }
      return q.z < 1.2 ? 0 : q.shade;
    })),
  ],
  counter: (v) => counterPrims(v, false),
  sink: (v) => counterPrims(v, true),
  stove: () => [
    sm(box(-7, 7, -6, 6, 0, 15, ENAMEL, (q) => {
      if (q.face === 't') {
        for (const [cu, cv] of [[-3.5, -2.5], [3.5, -2.5], [-3.5, 2.5], [3.5, 2.5]]) {
          const d = Math.hypot(q.u - cu, q.v - cv);
          if (d < 2.4) return d < 1.2 ? METAL[1] : METAL[0];
        }
        return 3;
      }
      if (front(q) && Math.abs(q.u) < 5 && q.z > 3 && q.z < 10) return Math.abs(q.u) > 4.3 || q.z > 9.3 || q.z < 3.7 ? METAL[1] : GLASS[q.z > 7 ? 1 : 0];
      if (front(q) && q.z > 11.5 && q.z < 13 && ((q.u + 64) % 3) < 1.2) return METAL[0];
      return q.shade;
    })),
    sm(box(-7, 7, -6, -4.6, 15, 19, ENAMEL)),
  ],
  wardrobe: () => [
    box(-8, 8, -5, 5, 0, 31, WOOD, (q) => {
      if (q.face === 't') return 2;
      if (front(q)) {
        if (Math.abs(q.u) < 0.5 || q.z < 1.5) return 0;
        if (Math.abs(Math.abs(q.u) - 1.6) < 0.6 && Math.abs(q.z - 16) < 1.5) return STEEL[2];
        if (Math.abs(Math.abs(q.u) - 4) < 3 && (Math.abs(q.z - 23) < 5 || Math.abs(q.z - 9) < 5) && (Math.abs(Math.abs(q.u) - 4) > 2.4 || Math.abs(q.z - 23) > 4.4 && Math.abs(q.z - 9) > 4.4)) return Math.max(0, q.shade - 1);
      }
      return planks(4)(q);
    }),
    box(-8.6, 8.6, -5.6, 5.6, 31, 33, DARKWOOD, plain),
  ],
  dresser: (v) => [
    box(-7, 7, -5, 5, 0, 13, WOOD, (q) => {
      if (q.face === 't') return 3;
      if (front(q)) {
        if (((q.z + 64) % 4.2) < 0.6 || q.z < 1) return 0;
        if (Math.abs(q.u) < 1 && ((q.z % 4.2) > 1.8 && (q.z % 4.2) < 2.8)) return STEEL[2];
      }
      return q.shade;
    }),
    ...(v % 2 === 0 ? [
      cylinder(-3, 0, 1, 13, 19, METAL),
      sm(cylinder(-3, 0, 3.4, 19, 23.5, FABRIC.beige, (q) => (q.face === 't' ? 3 : q.shade), { bulge: -0.6 })),
    ] : [
      box(1, 5, -2, 1, 13, 18, DARKWOOD, (q) => (front(q) && Math.abs(q.u - 3) < 1.3 && Math.abs(q.z - 15.5) < 1.6 ? CREAM[2] : plain(q))), // cadre photo
    ]),
  ],
  bed: (v) => {
    const cover = [FABRIC.red, FABRIC.green, FABRIC.blue, FABRIC.brown][v % 4];
    return [
      box(-8, -6, -7.5, 7.5, 0, 17, DARKWOOD, planks(3, 'h')),
      box(-6, 23, -7, 7, 0, 5.5, WOOD, plain),
      sm(box(-6, 22.5, -6.6, 6.6, 5.5, 9, FABRIC.white, plain)),
      sm(box(-5.5, 0, -5, 5, 9, 11.5, FABRIC.white, plain)),
      sm(box(1.5, 22.8, -7, 7, 5.5, 10, cover, (q) => {
        if (q.face === 't' && ((q.u + q.v * 0.3 + 64) % 6) < 0.8) return 1;
        return q.face === 't' ? 2 : q.shade;
      })),
      box(22, 23.5, -7.5, 7.5, 0, 9, DARKWOOD, plain),
    ];
  },
  sofa: (v) => {
    const f = [FABRIC.green, FABRIC.red, FABRIC.brown, FABRIC.blue][v % 4];
    const cush = (q) => {
      if (q.face === 't' && Math.abs(((q.u + 64) % 10.6) - 0) < 0.6) return 1;
      return q.face === 't' ? 2 : q.shade;
    };
    return [
      sm(box(-7, 23, -7, -2.5, 0, 16, f, plain)),
      sm(box(-7, 23, -2.5, 6, 0, 7.5, f, cush)),
      sm(box(-8, -5, -7, 6.5, 0, 11, f, plain)),
      sm(box(21, 24, -7, 6.5, 0, 11, f, plain)),
    ];
  },
  armchair: (v) => {
    const f = [FABRIC.red, FABRIC.green, FABRIC.brown][v % 3];
    return [
      sm(box(-6, 6, -6, -2, 0, 16, f, plain)),
      sm(box(-6, 6, -2, 6, 0, 7.5, f, plain)),
      sm(box(-7, -4.5, -6, 6, 0, 11, f, plain)),
      sm(box(4.5, 7, -6, 6, 0, 11, f, plain)),
    ];
  },
  table: () => {
    const p = [box(-7.5, 7.5, -6.5, 6.5, 11, 13, WOOD, planks(3, 'h'))];
    for (const [u, v] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) p.push(box(u - 0.8, u + 0.8, v - 0.8, v + 0.8, 0, 11, DARKWOOD));
    return p;
  },
  chair: () => [
    box(-4, 4, -4, 4, 7, 8.5, WOOD, plain),
    box(-4, 4, -4, -3, 8.5, 18, WOOD, (q) => (front(q) && Math.abs(q.z - 14) < 2.5 && Math.abs(q.u) < 2.5 ? 1 : plain(q))),
    ...[[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]].map(([u, v]) => box(u - 0.6, u + 0.6, v - 0.6, v + 0.6, 0, 7, DARKWOOD)),
  ],
  bookshelf: (v) => [
    box(-8, 8, -4, 4, 0, 30, DARKWOOD, (q) => {
      if (!front(q) || Math.abs(q.u) > 7 || q.z < 1.5 || q.z > 28.5) return plain(q);
      const zz = (q.z - 1.5) % 7;
      if (zz < 1) return 2; // tablette
      const slot = Math.floor((q.u + 8) / 1.5), shelf = Math.floor((q.z - 1.5) / 7);
      const h = hash(slot, shelf, v * 7 + 3);
      if (h < 0.12 || zz > 6.4 - h * 1.5) return INT0;
      const r = BOOKS[(h * 997 | 0) % BOOKS.length];
      return r[Math.max(0, q.shade - (((q.u + 8) % 1.5) < 0.4 ? 1 : 0))];
    }),
  ],
  tv: () => [
    box(-7, 7, -5, 5, 0, 8, DARKWOOD, (q) => (front(q) && q.z > 2 && q.z < 6.5 && Math.abs(q.u) < 6 ? (Math.abs(q.u) < 0.5 ? 0 : 1) : plain(q))),
    sm(box(-6, 6, -5, 4, 8, 19, METAL, (q) => {
      if (front(q) && Math.abs(q.u + 1) < 4 && q.z > 10 && q.z < 17.5) {
        const d = (q.u + 1 - (q.z - 10) * 0.5);
        return d > -1 && d < 0.5 ? GLASS[3] : GLASS[q.z > 14 ? 1 : 0];
      }
      if (front(q) && q.u > 3.8 && q.u < 5.2 && ((q.z + 64) % 2.5) < 1) return STEEL[2];
      return q.shade;
    })),
    capsule([0, -2, 19], [-3, -1, 25], 0.3, STEEL), capsule([0, -2, 19], [3, -2, 26], 0.3, STEEL),
  ],
  toilet: () => [
    sm(box(-4, 4, -6, -2.5, 6, 15, ENAMEL, plain)),
    sm(cylinder(0, 1.5, 2.2, 0, 5, ENAMEL)),
    sm(ellipsoid(0, 1.5, 6, 4, 4.6, 2.6, ENAMEL, (q) => (q.face === 't' && Math.hypot(q.u, q.v - 1.5) < 2.4 ? GLASS[2] : q.face === 't' ? 3 : q.shade), 4)),
  ],
  bathsink: () => [
    sm(box(-6, 6, -5, 5, 0, 12, CREAM, (q) => (front(q) && (Math.abs(q.u) < 0.4 || q.z < 1) ? 1 : plain(q)))),
    sm(box(-6.5, 6.5, -5.5, 5.5, 12, 13.5, ENAMEL, (q) => (q.face === 't' && Math.abs(q.u) < 4 && Math.abs(q.v) < 3 ? (Math.abs(q.u) > 3.2 || Math.abs(q.v) > 2.2 ? 1 : 0) : plain(q)))),
    sm(box(-0.6, 0.6, -5, -3, 13.5, 17, STEEL)), sm(box(-0.6, 0.6, -4, -1.5, 16, 17, STEEL)),
  ],
  shelf: (v) => {
    const p = [];
    for (const [u, w] of [[-7.5, -4.5], [6.5, -4.5], [-7.5, 3.5], [6.5, 3.5]]) p.push(box(u, u + 1, w, w + 1, 0, 26, METAL));
    for (const z of [1, 9, 17, 25]) {
      p.push(sm(box(-7.5, 7.5, -4.5, 4.5, z, z + 1, STEEL, plain)));
      if (z === 25) break;
      for (let i = 0; i < 4; i++) {
        const h = hash(i, z, v + 11);
        if (h < 0.22) continue;
        const r = PRODUCTS[(h * 113 | 0) % PRODUCTS.length], tall = 3 + h * 3.5, u0 = -7 + i * 3.6;
        if (h > 0.6) p.push(cylinder(u0 + 1.6, 1, 1.4, z + 1, z + 1 + tall, r, (q) => (q.face !== 't' && Math.abs(q.z - z - 1 - tall / 2) < 0.8 ? CREAM[2] : plain(q))));
        else p.push(box(u0, u0 + 3.1, -2, 3.5, z + 1, z + 1 + tall, r, (q) => (front(q) && Math.abs(q.z - z - 1 - tall * 0.55) < 0.7 ? CREAM[2] : plain(q))));
      }
    }
    return p;
  },
  crate: () => [
    box(-6, 6, -6, 6, 0, 11, WOOD, (q) => {
      if (q.face === 't') return ((q.u + 64) % 3) < 0.7 ? 1 : 3;
      const a = front(q) ? q.u : q.v;
      if (Math.abs(Math.abs(a) - 5.2) < 0.8 || q.z > 10 || q.z < 1) return Math.min(3, q.shade + 1);
      if (Math.abs(a - (q.z - 5.5)) < 0.7) return Math.min(3, q.shade + 1); // traverse en diagonale
      return ((q.z + 64) % 3.6) < 0.7 ? Math.max(0, q.shade - 1) : q.shade;
    }),
  ],
  trash: () => [
    box(-5, 5, -5, 5, 1.5, 14, FABRIC.green, (q) => (q.face !== 't' && ((q.z + 64) % 4) < 0.6 ? Math.max(0, q.shade - 1) : q.shade)),
    box(-5.6, 5.6, -5.6, 5.6, 14, 15.5, FABRIC.green, plain),
    capsule([-5, -5.6, 1.5], [5, -5.6, 1.5], 1.5, TIRE),
  ],
  mailbox: (v) => [
    box(-0.8, 0.8, -0.8, 0.8, 0, 12, WOOD),
    sm(box(-2.5, 2.5, -5, 5, 12, 16, [METAL, FABRIC.blue, FABRIC.red][v % 3], plain)),
    sm(capsule([0, -5, 16], [0, 5, 16], 2.5, [METAL, FABRIC.blue, FABRIC.red][v % 3])),
    box(2.5, 3, 1, 2, 14, 21, RUST, plain), box(2.5, 3, 2, 4.5, 19, 21, RUST, plain),
  ],
  bench: () => [
    ...[[-6, -3], [6, -3], [-6, 3], [6, 3]].map(([u, v]) => box(u - 0.6, u + 0.6, v - 0.6, v + 0.6, 0, 7, METAL)),
    box(-7.5, 7.5, -3.5, 3.5, 7, 8.2, WOOD, (q) => (q.face === 't' && ((q.v + 64) % 2.4) < 0.6 ? 1 : plain(q))),
    box(-7.5, 7.5, -4.5, -3.5, 9, 15, WOOD, (q) => (((q.z + 64) % 2.5) < 0.6 ? 0 : plain(q))),
  ],
  lamp: () => [
    cylinder(0, 0, 1.8, 0, 2, CONCRETE),
    cylinder(0, 0, 0.9, 2, 40, METAL),
    box(-0.6, 0.6, -0.6, 7, 39, 40.5, METAL),
    sm(box(-1.8, 1.8, 5, 10, 37.5, 40, METAL, (q) => (q.face !== 't' && q.z < 38.2 ? GLASS[2] : plain(q)))),
  ],
  pump: () => [
    box(-4, 4, -4, 4, 0, 2, CONCRETE, plain),
    sm(cylinder(0, 0, 1.6, 2, 14, FABRIC.green)),
    sm(box(-1, 1, 0, 4, 9, 10.5, FABRIC.green, plain)),
    capsule([0, -1, 14], [0, -8, 18], 0.6, METAL),
  ],
  campfire: () => {
    const p = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.push(ellipsoid(Math.cos(a) * 5.5, Math.sin(a) * 5.5, 1, 1.8, 1.8, 1.6, ROCK, null, 0));
    }
    p.push(capsule([-4, -1.5, 1.5], [3.5, 1.5, 4], 1.2, BARK), capsule([3, -3.5, 1.5], [-2, 3, 4.5], 1.2, BARK), capsule([-3, 3, 1.4], [2, -1, 4.2], 1.1, BARK));
    p.push(cylinder(0, 0, 3.5, 0, 0.4, BARK, () => 0));
    return p;
  },
  bag: () => [sm(ellipsoid(0, 0, 3, 4.5, 3.5, 3.6, FABRIC.beige, (q) => (hash(q.x, q.y, 2) < 0.1 ? 1 : q.shade), 0)), sm(capsule([0, 0, 6], [0, 0, 7.5], 1, FABRIC.brown))],
  stump: () => [
    cylinder(0, 0, 3.6, 0, 5, BARK, (q) => {
      if (q.face === 't') { const d = Math.hypot(q.u, q.v); return CREAM[(d * 1.4 | 0) % 2 ? 1 : 2]; }
      return ((q.u * 3 | 0) % 2) && q.shade > 0 ? q.shade - 1 : q.shade;
    }),
  ],
  swing: () => {
    const p = [];
    for (const u of [-7, 21]) {
      p.push(capsule([u, -6, 0], [u, 0, 24], 0.8, RUST), capsule([u, 6, 0], [u, 0, 24], 0.8, RUST));
    }
    p.push(capsule([-7, 0, 24], [21, 0, 24], 0.9, RUST));
    for (const u of [3, 12]) {
      p.push(capsule([u - 2, 0, 24], [u - 2, 0, 7], 0.25, METAL), capsule([u + 2, 0, 24], [u + 2, 0, 7], 0.25, METAL));
      p.push(box(u - 2.5, u + 2.5, -1.2, 1.2, 6, 7, WOOD, plain));
    }
    return p;
  },
  sign: () => [
    box(-0.6, 0.6, -0.6, 0.6, 0, 20, METAL),
    sm(box(-4, 4, 0.6, 1.2, 20, 26, TRIM, (q) => (Math.abs(q.u) < 3.4 && q.z > 20.6 && q.z < 25.4 ? FABRIC.green[2] : plain(q)))),
  ],
  hydrant: () => [sm(cylinder(0, 0, 2, 0, 8, FABRIC.red)), sm(ellipsoid(0, 0, 8, 2, 2, 1.8, FABRIC.red, null, 8)), sm(capsule([0, -3, 5], [0, 3, 5], 0.9, FABRIC.red))],
};
const INT0 = [24, 16, 12];
const GREY = ENAMEL, OFFICE = [[44, 48, 56], [70, 76, 88], [98, 106, 120], [130, 138, 152]];
const LOCKER = [[30, 44, 40], [46, 68, 60], [66, 94, 84], [92, 124, 112]];

Object.assign(MODELS, {
  // bureau avec écran, clavier et caisson
  desk: (v) => [
    box(-8, 8, -5.5, 5.5, 11, 12.4, v % 2 ? WOOD : OFFICE, plain),
    box(3, 7.6, -5, 5, 0, 11, v % 2 ? WOOD : OFFICE, (q) => (front(q) && ((q.z + 64) % 3.7) < 0.5 ? 0 : q.shade)),
    box(-7.6, -6.6, -5, 5, 0, 11, METAL), box(-7.6, -6.6, -5, -4, 0, 11, METAL),
    sm(box(-4.5, 1.5, -1.5, -0.7, 12.4, 19.5, METAL, (q) => (front(q) && Math.abs(q.u + 1.5) < 2.5 && q.z > 13.2 && q.z < 18.8 ? GLASS[q.z > 17 ? 1 : 0] : q.shade))),
    sm(box(-2, -1, -2.2, -1.5, 12.4, 13.5, METAL)),
    sm(box(-4.5, 1.5, 1, 3.5, 12.4, 13, ENAMEL, plain)),
  ],
  ochair: () => [
    sm(box(-3.6, 3.6, -3.6, 3.6, 7, 8.6, FABRIC.blue, plain)),
    sm(box(-3.4, 3.4, -4.2, -3.2, 8.6, 17, FABRIC.blue, plain)),
    cylinder(0, 0, 0.6, 2, 7, METAL),
    capsule([-3.5, 0, 1], [3.5, 0, 1], 0.6, METAL), capsule([0, -3.5, 1], [0, 3.5, 1], 0.6, METAL),
  ],
  filing: () => [
    sm(box(-4.5, 4.5, -5, 5, 0, 22, GREY, (q) => {
      if (!front(q)) return plain(q);
      const zz = (q.z + 64) % 5.4;
      if (zz < 0.5) return 0;
      if (Math.abs(q.u) < 1.5 && Math.abs(zz - 3.6) < 0.6) return METAL[2];
      return q.shade;
    })),
  ],
  vending: (v) => [
    sm(box(-7, 7, -6, 6, 0, 30, v % 2 ? FABRIC.red : FABRIC.blue, (q) => {
      if (front(q) && q.u < 3 && q.u > -6 && q.z > 8 && q.z < 27) {
        // vitrine : rangées de produits colorés
        const row = Math.floor((q.z - 8) / 4.6), col = Math.floor((q.u + 6) / 2.2);
        if (((q.z - 8) % 4.6) < 0.8) return METAL[1];
        return [FABRIC.red, CREAM, FABRIC.green, FABRIC.beige, FABRIC.blue][(row * 3 + col) % 5][q.z % 4.6 > 2.8 ? 3 : 2];
      }
      if (front(q) && q.u > 3.8 && q.u < 5.8 && q.z > 16 && q.z < 22) return METAL[0];
      return plain(q);
    })),
  ],
  locker: () => [
    sm(box(-7, 7, -5, 5, 0, 30, LOCKER, (q) => {
      if (!front(q)) return plain(q);
      if (Math.abs(q.u) < 0.4 || q.z < 1) return 0;
      if (q.z > 24 && q.z < 27 && ((q.z * 3) | 0) % 2) return 0; // aérations
      if (Math.abs(Math.abs(q.u) - 1.5) < 0.5 && Math.abs(q.z - 15) < 1.5) return STEEL[2];
      return q.shade;
    })),
  ],
  gunrack: () => {
    const p = [box(-8, 8, -6, -4.6, 2, 26, DARKWOOD, plain), box(-8, 8, -6, 0, 2, 3.5, DARKWOOD, plain)];
    for (const u of [-5, -1.5, 2, 5.5]) {
      p.push(capsule([u, -3.8, 4], [u, -4.2, 15], 1, WOOD)); // crosse
      p.push(capsule([u, -4.2, 15], [u, -4.4, 25], 0.55, METAL)); // canon
    }
    return p;
  },
  rack: (v) => {
    const p = [];
    for (const [u, w] of [[-8, -5.5], [7, -5.5], [-8, 4.5], [7, 4.5]]) p.push(box(u, u + 1, w, w + 1, 0, 34, FABRIC.blue));
    for (const z of [0.5, 11, 22, 33]) {
      p.push(box(-8, 8, -5.5, 5.5, z, z + 1, FABRIC.red, plain));
      if (z > 30) break;
      for (let i = 0; i < 3; i++) {
        const h = hash(i, z, v + 5);
        if (h < 0.25) continue;
        const u0 = -7.5 + i * 5;
        p.push(box(u0, u0 + 4.6, -4.5, 4.5, z + 1, z + 1 + 5 + h * 4, CARDBOARD, (q) => (q.face === 't' && Math.abs(q.v) < 0.4 ? 1 : front(q) && Math.abs(q.z - z - 4) < 0.6 ? 1 : plain(q))));
      }
    }
    return p;
  },
  haybale: () => [capsule([-6, 0, 5], [6, 0, 5], 5, STRAW, ), box(-7, 7, -1, 1, 0, 0.5, STRAW)].map((P, i) => (i ? P : { ...P, mat: (q) => (Math.abs(((q.u + 64) % 4) - 2) < 0.4 ? 1 : hash(q.x, q.y, 3) < 0.2 ? Math.max(0, q.shade - 1) : q.shade) })),
  gaspump: (v) => [
    box(-4, 4, -5, 5, 0, 1.5, CONCRETE, plain),
    sm(box(-3, 3, -3.5, 3.5, 1.5, 22, v % 2 ? FABRIC.red : CREAM, (q) => {
      if (front(q) && Math.abs(q.u) < 2 && q.z > 15 && q.z < 19.5) return GLASS[q.z > 17.5 ? 1 : 0];
      if (front(q) && Math.abs(q.u) < 2.4 && q.z > 9 && q.z < 13) return METAL[1];
      return plain(q);
    })),
    capsule([3, 2, 12], [5, 4, 4], 0.45, TIRE),
  ],
  // escalier : 7 marches qui montent vers l'arrière (-v), le palier arrive à l'étage
  stairs: () => {
    const p = [];
    for (let i = 0; i < 7; i++) p.push(box(-6, 6, -8, 8 - i * 2.28, 0, (i + 1) * 4, WOOD, (q) => (q.face === 't' ? 3 : front(q) && q.z % 4 > 3.2 ? 1 : q.shade)));
    p.push(capsule([6.5, 8, 6], [6.5, -8, 30], 0.5, METAL), box(6, 7, -8, -7, 0, 30, METAL), box(6, 7, 7, 8, 0, 6, METAL));
    return p;
  },
  // trémie de l'escalier à l'étage : un trou sombre bordé d'une rambarde
  stairs_down: () => [
    box(-6, 6, -8, 8, 0, 0.6, INTERIOR, () => INTERIOR[0]),
    capsule([-6.5, -7.5, 9], [-6.5, 7.5, 9], 0.5, METAL), capsule([6.5, -7.5, 9], [6.5, 7.5, 9], 0.5, METAL),
    capsule([-6.5, -7.5, 9], [6.5, -7.5, 9], 0.5, METAL),
    box(-7, -6, -8, -7, 0, 9, METAL), box(6, 7, -8, -7, 0, 9, METAL), box(-7, -6, 7, 8, 0, 9, METAL), box(6, 7, 7, 8, 0, 9, METAL),
  ],
  hvac: () => [
    sm(box(-6.5, 6.5, -5.5, 5.5, 0, 9, GREY, (q) => {
      if (q.face === 't') { const d = Math.hypot(q.u, q.v); return d < 4 ? (((d * 2) | 0) % 2 ? METAL[1] : METAL[2]) : 3; }
      return ((q.u + q.v + 64) % 1.5) < 0.5 ? Math.max(0, q.shade - 1) : q.shade;
    })),
  ],
  planter: () => [
    box(-6, 6, -6, 6, 0, 5, CONCRETE, plain),
    ellipsoid(0, 0, 8, 5.5, 5.5, 4.5, BUSH, (q) => (hash(q.x, q.y, 2) < 0.2 ? Math.max(0, q.shade - 1) : q.shade), 5),
  ],
  medcab: () => [
    sm(box(-7, 7, -5, 5, 0, 28, ENAMEL, (q) => {
      if (front(q) && Math.abs(q.z - 21) < 3 && Math.abs(q.u) < 1) return FABRIC.red[2];
      if (front(q) && Math.abs(q.z - 21) < 1 && Math.abs(q.u) < 3) return FABRIC.red[2];
      if (front(q) && (Math.abs(q.u) < 0.4 || Math.abs(q.z - 14) < 0.4)) return 1;
      return plain(q);
    })),
  ],
});

function counterPrims(v, sink) {
  const p = [
    box(-8, 8, -6, 6, 0, 13, WOOD, (q) => {
      if (front(q)) {
        if (q.z < 1.2) return 0;
        if (Math.abs(q.u) < 0.4 || Math.abs(q.z - 9.5) < 0.4) return 0;
        if (Math.abs(Math.abs(q.u) - 1.6) < 0.6 && Math.abs(q.z - 7.5) < 0.6) return STEEL[2];
      }
      return q.shade;
    }),
    sm(box(-8, 8, -6.5, 6.8, 13, 14.5, CREAM, (q) => {
      if (sink && q.face === 't' && Math.abs(q.u) < 5 && Math.abs(q.v) < 3.8) return Math.abs(q.u) > 4.2 || Math.abs(q.v) > 3 ? STEEL[1] : STEEL[0];
      return plain(q);
    })),
  ];
  if (sink) p.push(sm(box(-0.6, 0.6, -6, -4.5, 14.5, 19, STEEL)), sm(box(-0.6, 0.6, -5.5, -2.5, 18, 19, STEEL)));
  else if (v % 3 === 0) p.push(sm(cylinder(-3, -2, 2, 14.5, 18, METAL, (q) => (q.face === 't' ? 1 : q.shade)))); // casserole
  else if (v % 3 === 1) p.push(box(1, 5, -4.5, -1, 14.5, 21, FABRIC.beige, plain)); // boîte de céréales
  return p;
}

export const PROP_NAMES = Object.keys(MODELS);
export const BIG = { bed: 1, sofa: 1, swing: 1 }; // 2 cases le long de +u avant rotation

export function propSprite(name, k = 0, v = 0) {
  const prims = rotPrims(MODELS[name](v), k);
  return BIG[name] ? renderSolids(prims, 96, 84, 48, 60) : renderSolids(prims, 52, 74, 26, 58);
}
