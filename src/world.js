// Le monde : grille de tuiles, murs fins, bâtiments, objets. Généré d'une graine.
import { hash } from './raster.js';
import { T, isWater, isRoad } from './sprites/tiles.js';
import { rollLoot } from './items.js';

export const MAP = 96;
// murs (un par case) : 0 rien
export const W = { NONE: 0, WALL: 1, WINDOW: 2, BROKEN: 3, DOOR: 4, OPEN: 5, DOORWAY: 6, FENCE: 7 };
export const wallLike = (k) => k >= 1 && k <= 6;

// taille d'inventaire et type de butin par meuble conteneur
export const CONTAINERS = {
  fridge: 9, counter: 9, sink: 6, stove: 4, wardrobe: 18, dresser: 9, bookshelf: 9, bathsink: 6,
  shelf: 9, crate: 9, trash: 4, mailbox: 3, car: 9, tv: 3,
};
export const LABEL = {
  fridge: 'Frigo', counter: 'Placard', sink: 'Évier', stove: 'Cuisinière', wardrobe: 'Armoire', dresser: 'Commode',
  bookshelf: 'Bibliothèque', bathsink: 'Lavabo', shelf: 'Étagère', crate: 'Caisse', trash: 'Poubelle', mailbox: 'Boîte aux lettres',
  car: 'Coffre', tv: 'Meuble télé', bag: 'Sac au sol', campfire: 'Feu de camp', bed: 'Lit', sofa: 'Canapé', armchair: 'Fauteuil',
  toilet: 'Toilettes', pump: 'Pompe', tree: 'Arbre', berry: 'Ronces', bench: 'Banc', swing: 'Balançoire',
};
// objets qui bloquent le passage, demi-taille de la boîte de collision (en tuiles)
export const SOLID = {
  fridge: 0.42, counter: 0.46, sink: 0.46, stove: 0.44, wardrobe: 0.46, dresser: 0.42, bed: 0.46, sofa: 0.46,
  armchair: 0.4, table: 0.44, chair: 0.25, bookshelf: 0.46, tv: 0.42, toilet: 0.3, bathsink: 0.38, shelf: 0.46,
  crate: 0.38, trash: 0.32, mailbox: 0.12, car: 0.5, bench: 0.42, lamp: 0.1, pump: 0.2, campfire: 0.3,
  tree: 0.16, rock: 0.32, stump: 0.18, swing: 0.1, sign: 0.08, hydrant: 0.12,
};

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(x, y, s, scale) {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export class World {
  constructor() {
    const n = MAP * MAP;
    this.tile = new Uint8Array(n);
    this.wall = new Uint8Array(n);
    this.lock = new Uint8Array(n);
    this.wbld = new Int16Array(n).fill(-1); // bâtiment d'un mur
    this.room = new Int16Array(n).fill(-1); // bâtiment d'une case intérieure
    this.occ = new Int32Array(n).fill(-1); // objet posé sur la case
    this.litter = new Uint8Array(n);
    this.water = new Uint8Array(n); // eau restante (évier, toilettes)
    this.objs = [];
    this.blds = [];
    this.free = [];
  }
  idx(x, y) { return y * MAP + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < MAP && y < MAP; }
  T(x, y) { return this.inb(x, y) ? this.tile[y * MAP + x] : T.FOREST; }
  Wk(x, y) { return this.inb(x, y) ? this.wall[y * MAP + x] : 0; }
  obj(x, y) { if (!this.inb(x, y)) return null; const o = this.occ[y * MAP + x]; return o >= 0 ? this.objs[o] : null; }
  roomAt(x, y) { return this.inb(x, y) ? this.room[y * MAP + x] : -1; }
  // bâtiment où se trouve un point : dans une case de mur fin, on regarde de quel côté du mur il est
  inside(px, py) {
    const x = Math.floor(px), y = Math.floor(py);
    const r = this.roomAt(x, y);
    if (r >= 0 || !this.inb(x, y) || this.wbld[y * MAP + x] < 0) return r;
    const b = this.wbld[y * MAP + x], dx = px - x - 0.5, dy = py - y - 0.5;
    const n = Math.abs(dx) > Math.abs(dy) ? this.roomAt(x + Math.sign(dx), y) : this.roomAt(x, y + Math.sign(dy));
    return n === b ? b : -1;
  }

  // voisins muraux (bits : 1 -x, 2 +x, 4 -y, 8 +y) ; les clôtures ne se relient qu'entre elles
  mask(x, y) {
    const k = this.Wk(x, y), fence = k === W.FENCE;
    const ok = (a, b) => { const n = this.Wk(a, b); return fence ? n === W.FENCE : wallLike(n); };
    return (ok(x - 1, y) ? 1 : 0) | (ok(x + 1, y) ? 2 : 0) | (ok(x, y - 1) ? 4 : 0) | (ok(x, y + 1) ? 8 : 0);
  }

  addObj(o) {
    o.id = this.free.length ? this.free.pop() : this.objs.length;
    this.objs[o.id] = o;
    o.cells = footprint(o);
    for (const [cx, cy] of o.cells) this.occ[this.idx(cx, cy)] = o.id;
    return o;
  }
  removeObj(o) {
    for (const [cx, cy] of o.cells) if (this.occ[this.idx(cx, cy)] === o.id) this.occ[this.idx(cx, cy)] = -1;
    this.objs[o.id] = null;
    this.free.push(o.id);
  }
  canPlace(type, x, y, k) {
    for (const [cx, cy] of footprint({ type, x, y, k })) {
      if (!this.inb(cx, cy) || this.occ[this.idx(cx, cy)] >= 0 || this.wall[this.idx(cx, cy)] || isWater(this.tile[this.idx(cx, cy)])) return false;
    }
    return true;
  }
  // une case où l'on peut marcher (pour le placement et les sacs au sol)
  walkable(x, y) {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    if (isWater(this.tile[i])) return false;
    const w = this.wall[i];
    if (w && w !== W.OPEN && w !== W.DOORWAY) return false;
    const o = this.occ[i];
    return o < 0 || !SOLID[this.objs[o].type];
  }

  toJSON() {
    const b64 = (a) => { let s = ''; const u = new Uint8Array(a.buffer); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
    return {
      tile: b64(this.tile), wall: b64(this.wall), lock: b64(this.lock), wbld: b64(this.wbld), room: b64(this.room),
      litter: b64(this.litter), water: b64(this.water), blds: this.blds,
      objs: this.objs.filter(Boolean).map(({ cells, ...o }) => o),
    };
  }
  static fromJSON(j) {
    const w = new World();
    const un = (s, Arr) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Arr(u.buffer); };
    w.tile = un(j.tile, Uint8Array); w.wall = un(j.wall, Uint8Array); w.lock = un(j.lock, Uint8Array);
    w.wbld = un(j.wbld, Int16Array); w.room = un(j.room, Int16Array); w.litter = un(j.litter, Uint8Array); w.water = un(j.water, Uint8Array);
    w.blds = j.blds;
    for (const o of j.objs) { delete o.id; w.addObj(o); }
    return w;
  }
}

// taille des grands objets (longueur le long de +u, largeur le long de +v, avant rotation)
export const SIZE = { bed: [2, 1], sofa: [2, 1], swing: [2, 1], car: [4, 2] };
// cases occupées, tournées comme le sprite (rotPrims) : k=1 envoie +u vers +v
export function footprint(o) {
  const sz = SIZE[o.type];
  if (!sz) return [[o.x, o.y]];
  const out = [];
  for (let a = 0; a < sz[0]; a++) for (let b = 0; b < sz[1]; b++) {
    const [du, dv] = [[a, b], [-b, a], [-a, -b], [b, -a]][o.k & 3];
    out.push([o.x + du, o.y + dv]);
  }
  return out;
}

// ------------------------------------------------------------------ génération

export function generate(seed) {
  const rnd = mulberry(seed);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const w = new World();
  const set = (x, y, t) => { if (w.inb(x, y)) w.tile[w.idx(x, y)] = t; };
  const reserved = new Uint8Array(MAP * MAP); // routes, lots, eau : pas d'arbres

  // 1. sol : herbe, herbe sèche, sous-bois
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    const n = noise(x, y, seed, 9), edge = Math.min(x, y, MAP - 1 - x, MAP - 1 - y);
    let t = n > 0.62 ? T.DRY : T.GRASS;
    const f = noise(x, y, seed + 5, 7) + Math.max(0, 9 - edge) * 0.09;
    if (f > 0.72) t = T.FOREST;
    w.tile[w.idx(x, y)] = t;
  }

  // 2. le lac au nord
  for (let y = 0; y < 16; y++) for (let x = 30; x < 88; x++) {
    const dx = (x - 58) / 24, dy = (y - 4) / 9.5, d = dx * dx + dy * dy + (noise(x, y, seed + 9, 4) - 0.5) * 0.35;
    if (d < 1) { set(x, y, T.WATER); reserved[w.idx(x, y)] = 1; }
    else if (d < 1.35) { set(x, y, T.SAND); reserved[w.idx(x, y)] = 1; }
  }

  // 3. routes
  const road = (x0, y0, x1, y1, line) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!w.inb(x, y)) continue;
      let t = T.ASPHALT;
      if (line === 'x' && y === ((y0 + y1) >> 1)) t = T.ROAD_LX;
      if (line === 'y' && x === ((x0 + x1) >> 1)) t = T.ROAD_LY;
      w.tile[w.idx(x, y)] = t; reserved[w.idx(x, y)] = 1;
    }
  };
  const walk = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (w.inb(x, y) && !isRoad(w.T(x, y))) { w.tile[w.idx(x, y)] = T.SIDEWALK; reserved[w.idx(x, y)] = 1; }
    }
  };
  // grand-route est-ouest, rue nord-sud jusqu'au lac, deux rues de lotissement
  // grand-route est-ouest et rue nord-sud à deux voies (5 cases), rues de lotissement (3 cases)
  road(0, 46, MAP - 1, 50, 'x');
  road(45, 17, 49, 84, 'y');
  road(18, 29, 76, 31);
  road(18, 67, 76, 69);
  walk(14, 45, 82, 45); walk(14, 51, 82, 51);
  walk(44, 18, 44, 84); walk(50, 18, 50, 84);
  walk(18, 28, 76, 28); walk(18, 32, 76, 32);
  walk(18, 66, 76, 66); walk(18, 70, 76, 70);
  // chemin de terre vers la plage
  for (let y = 12; y < 17; y++) for (let x = 45; x <= 49; x++) { set(x, y, y < 14 ? T.SAND : T.PATH); reserved[w.idx(x, y)] = 1; }

  // 4. parc et étang (sud-ouest)
  const px = 27, py = 80;
  for (let y = py - 9; y <= py + 9; y++) for (let x = px - 13; x <= px + 13; x++) {
    if (!w.inb(x, y)) continue;
    const dx = (x - px) / 7.5, dy = (y - py) / 4.8, d = dx * dx + dy * dy + (noise(x, y, seed + 3, 3) - 0.5) * 0.3;
    if (d < 1) set(x, y, T.WATER);
    if (d < 3.2) reserved[w.idx(x, y)] = 1;
  }
  for (let x = 13; x <= 43; x++) { if (!isWater(w.T(x, 73))) set(x, 73, T.PATH); reserved[w.idx(x, 73)] = 1; }

  // 5. bâtiments
  const blocked = (x0, y0, x1, y1, m) => {
    for (let y = y0 - m; y <= y1 + m; y++) for (let x = x0 - m; x <= x1 + m; x++) {
      if (!w.inb(x, y) || x < 3 || y < 3 || x > MAP - 4 || y > MAP - 4) return true;
      if (reserved[w.idx(x, y)] || w.wall[w.idx(x, y)] || w.room[w.idx(x, y)] >= 0) return true;
    }
    return false;
  };
  // magasin au carrefour
  makeStore(w, rnd, 52, 35, 63, 43);
  // maisons le long des rues : face à la rue (porte côté rue)
  const lots = [];
  const streets = [
    { y: 28, side: -1, x0: 19, x1: 75 }, { y: 32, side: 1, x0: 19, x1: 75 },
    { y: 45, side: -1, x0: 14, x1: 43 }, { y: 51, side: 1, x0: 14, x1: 43 },
    { y: 45, side: -1, x0: 65, x1: 82 }, { y: 51, side: 1, x0: 51, x1: 82 },
    { y: 66, side: -1, x0: 19, x1: 75 }, { y: 70, side: 1, x0: 51, x1: 75 },
  ];
  for (const st of streets) {
    let x = st.x0 + ri(0, 2);
    while (x < st.x1 - 6) {
      const bw = ri(6, 9), bh = ri(6, 8);
      const gap = ri(2, 3);
      const y0 = st.side < 0 ? st.y - 2 - bh : st.y + 3;
      const y1 = y0 + bh - 1, x1 = x + bw - 1;
      if (x1 <= st.x1 && !blocked(x, y0, x1, y1, 1)) {
        lots.push({ x0: x, y0, x1, y1, door: st.side < 0 ? 'S' : 'N', street: st.y });
        for (let yy = y0 - 1; yy <= y1 + 1; yy++) for (let xx = x - 1; xx <= x1 + 1; xx++) if (w.inb(xx, yy)) reserved[w.idx(xx, yy)] = 2;
        x = x1 + 1 + gap + ri(0, 2);
      } else x += 2;
    }
  }
  // quelques maisons isolées dans la campagne
  for (let tries = 0; tries < 60 && lots.length < 30; tries++) {
    const bw = ri(6, 8), bh = ri(6, 7), x = ri(6, MAP - 14), y0 = ri(20, MAP - 14);
    if (!blocked(x, y0, x + bw - 1, y0 + bh - 1, 3)) {
      lots.push({ x0: x, y0, x1: x + bw - 1, y1: y0 + bh - 1, door: 'S', street: -1 });
      for (let yy = y0 - 1; yy <= y0 + bh; yy++) for (let xx = x - 1; xx <= x + bw; xx++) reserved[w.idx(xx, yy)] = 2;
    }
  }
  for (const L of lots) makeHouse(w, rnd, L);

  // 6. objets de rue : lampadaires, voitures, bouches d'incendie
  for (let x = 16; x < 82; x += 7) {
    for (const y of [45, 51]) if (!w.wall[w.idx(x, y)] && w.occ[w.idx(x, y)] < 0 && rnd() < 0.8) w.addObj({ type: 'lamp', x, y, k: y === 45 ? 0 : 2, v: 0 });
  }
  for (let y = 20; y < 84; y += 8) for (const x of [44, 50]) if (w.occ[w.idx(x, y)] < 0 && !w.wall[w.idx(x, y)]) w.addObj({ type: 'lamp', x, y, k: 0, v: 0 });
  // voitures garées sur les voies, dans le sens de la circulation : [x0, x1, y, k] ou [y0, y1, x, k]
  const lanes = [
    { xs: [2, 90], y: 47, k: 2 }, { xs: [2, 90], y: 49, k: 0 },
    { xs: [20, 72], y: 31, k: 2 }, { xs: [20, 72], y: 29, k: 0 },
    { xs: [20, 72], y: 69, k: 2 }, { xs: [20, 72], y: 67, k: 0 },
    { ys: [18, 82], x: 49, k: 1 }, { ys: [18, 82], x: 45, k: 3 },
  ];
  const allRoad = (o) => footprint(o).every(([cx, cy]) => w.inb(cx, cy) && isRoad(w.T(cx, cy)));
  for (let i = 0, n = 0; i < 200 && n < 15; i++) {
    const L = pick(lanes);
    const o = L.xs ? { type: 'car', x: ri(L.xs[0], L.xs[1]), y: L.y, k: L.k } : { type: 'car', x: L.x, y: ri(L.ys[0], L.ys[1]), k: L.k };
    // pas au milieu du carrefour
    if (footprint(o).some(([cx, cy]) => cx >= 44 && cx <= 50 && cy >= 45 && cy <= 51)) continue;
    if (!allRoad(o) || !w.canPlace('car', o.x, o.y, o.k)) continue;
    o.v = ri(0, 49);
    addContainer(w, rnd, o);
    n++;
  }
  for (let i = 0; i < 6; i++) {
    const x = ri(16, 80), y = rnd() < 0.5 ? 45 : 51;
    if (w.canPlace('hydrant', x, y, 0)) w.addObj({ type: 'hydrant', x, y, k: 0, v: 0 });
  }

  // 7. parc : pompe, bancs, balançoire
  w.addObj({ type: 'pump', x: px + 9, y: py - 4, k: 0, v: 0 });
  w.addObj({ type: 'bench', x: px - 2, y: py - 6, k: 0, v: 0 });
  w.addObj({ type: 'bench', x: px + 4, y: py - 6, k: 0, v: 0 });
  w.addObj({ type: 'swing', x: px + 10, y: py + 2, k: 1, v: 0 });
  w.addObj({ type: 'sign', x: 43, y: 72, k: 0, v: 0 });

  // 8. végétation
  for (let y = 1; y < MAP - 1; y++) for (let x = 1; x < MAP - 1; x++) {
    const i = w.idx(x, y);
    if (reserved[i] || w.occ[i] >= 0 || w.wall[i] || isWater(w.tile[i])) continue;
    const t = w.tile[i], forest = t === T.FOREST, r = hash(x, y, seed + 17);
    const dens = forest ? 0.3 : t === T.DRY ? 0.035 : 0.05;
    if (r < dens) {
      const k = hash(x, y, seed + 18);
      let o;
      if (forest) o = k < 0.42 ? { type: 'tree', kind: 'pine' } : k < 0.52 ? { type: 'tree', kind: 'dead' } : k < 0.62 ? { type: 'tree', kind: 'birch', pal: 'yellow' } : { type: 'tree', kind: 'oak', pal: pick(['orange', 'red', 'yellow', 'green', 'olive']) };
      else o = k < 0.1 ? { type: 'tree', kind: 'dead' } : k < 0.25 ? { type: 'tree', kind: 'birch', pal: 'yellow' } : { type: 'tree', kind: 'oak', pal: pick(['orange', 'red', 'yellow', 'green', 'orange']) };
      Object.assign(o, { x, y, k: 0, v: (hash(x, y, 3) * 4) | 0, seed: (hash(x, y, 4) * 1000) | 0 });
      w.addObj(o);
      if (o.kind === 'oak' || o.kind === 'birch') {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (w.inb(x + dx, y + dy) && hash(x + dx, y + dy, 6) < 0.7) w.litter[w.idx(x + dx, y + dy)] = 1 + ((hash(x + dx, y + dy, 7) * 4) | 0);
      }
    } else if (r < dens + 0.025) {
      w.addObj({ type: forest && hash(x, y, 9) < 0.45 ? 'berry' : 'bush', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0, regrow: 0 });
    } else if (r < dens + 0.035) {
      w.addObj({ type: 'rock', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0 });
    } else if (r < dens + 0.12) {
      w.addObj({ type: 'grass', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0 });
    }
  }
  // roseaux et herbes au bord de l'eau, feuilles mortes un peu partout
  for (let y = 1; y < MAP - 1; y++) for (let x = 1; x < MAP - 1; x++) {
    const i = w.idx(x, y);
    if (isWater(w.tile[i]) || w.occ[i] >= 0 || w.wall[i] || isRoad(w.tile[i])) continue;
    const nearW = isWater(w.T(x - 1, y)) || isWater(w.T(x + 1, y)) || isWater(w.T(x, y - 1)) || isWater(w.T(x, y + 1));
    if (nearW && hash(x, y, 31) < 0.4) w.addObj({ type: 'reed', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0 });
    if (!w.litter[i] && w.tile[i] !== T.PLANK && hash(x, y, 33) < 0.05) w.litter[i] = 1 + ((hash(x, y, 34) * 4) | 0);
  }
  // pas de feuilles dans les maisons
  for (let i = 0; i < MAP * MAP; i++) if (w.room[i] >= 0) w.litter[i] = 0;

  // 9. point de départ : le salon d'une maison du lotissement, porte ouverte
  const homes = w.blds.filter((b) => b.kind === 'house').sort((a, b) => (b.street === 51) - (a.street === 51));
  let start = null, home = homes[0];
  for (const h of homes) {
    for (let y = h.y0 + 1; y < h.y1 && !start; y++) for (let x = h.x0 + 1; x < h.x1 && !start; x++) {
      if (w.room[w.idx(x, y)] === h.id && w.walkable(x, y)) start = [x + 0.5, y + 0.5];
    }
    if (start) { home = h; break; }
  }
  home.home = true;
  for (let i = 0; i < MAP * MAP; i++) if (w.wbld[i] === home.id && w.lock[i]) w.lock[i] = 0;
  w.start = start;
  return w;
}

function addContainer(w, rnd, o) {
  const size = CONTAINERS[o.type];
  if (size) o.inv = rollLoot(o.type, rnd, size);
  return w.addObj(o);
}

function makeBuilding(w, rnd, x0, y0, x1, y1, kind, style) {
  const id = w.blds.length;
  const b = { id, x0, y0, x1, y1, kind, style, seed: (rnd() * 1e6) | 0 };
  w.blds.push(b);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = w.idx(x, y);
    if (x === x0 || x === x1 || y === y0 || y === y1) { w.wall[i] = W.WALL; w.wbld[i] = id; }
    else w.room[i] = id;
  }
  return b;
}

function floor(w, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.room[w.idx(x, y)] >= 0) w.tile[w.idx(x, y)] = t;
}

// fenêtres sur les murs droits extérieurs, jamais au contact d'une cloison
function windows(w, rnd, b, p) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const i = w.idx(x, y);
    if (w.wall[i] !== W.WALL) continue;
    const m = w.mask(x, y);
    if (m !== 3 && m !== 12) continue;
    const inX = y === b.y0 || y === b.y1;
    const nb = inX ? [w.Wk(x - 1, y), w.Wk(x + 1, y)] : [w.Wk(x, y - 1), w.Wk(x, y + 1)];
    if (nb.some((k) => k !== W.WALL && k !== W.WINDOW)) continue;
    const corner = inX ? (x - 1 === b.x0 || x + 1 === b.x1) : (y - 1 === b.y0 || y + 1 === b.y1);
    if (corner) continue;
    if (rnd() < p) w.wall[i] = rnd() < 0.06 ? W.BROKEN : W.WINDOW;
  }
}

const STYLE = (rnd) => ({ ext: Math.floor(rnd() * 5), int: Math.floor(rnd() * 3), roof: Math.floor(rnd() * 4) });

function makeHouse(w, rnd, L) {
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const { x0, y0, x1, y1 } = L;
  const b = makeBuilding(w, rnd, x0, y0, x1, y1, 'house', STYLE(rnd));
  b.street = L.street;
  const iw = x1 - x0 - 1, ih = y1 - y0 - 1;
  // cloison verticale, puis une cloison horizontale dans la plus grande moitié
  const rooms = [];
  let xs = -1;
  if (iw >= 6) {
    xs = x0 + 1 + ri(2, iw - 3);
    for (let y = y0 + 1; y < y1; y++) { const i = w.idx(xs, y); w.wall[i] = W.WALL; w.wbld[i] = b.id; w.room[i] = -1; }
    const dy = ri(y0 + 1, y1 - 1);
    w.wall[w.idx(xs, dy)] = W.DOORWAY; w.room[w.idx(xs, dy)] = b.id;
  }
  const halves = xs < 0 ? [[x0 + 1, xs < 0 ? x1 - 1 : xs - 1]] : [[x0 + 1, xs - 1], [xs + 1, x1 - 1]];
  halves.sort((a, c) => (c[1] - c[0]) - (a[1] - a[0]));
  const [bx0, bx1] = halves[0];
  if (ih >= 5 && bx1 - bx0 >= 2) {
    const ys = y0 + 1 + ri(2, ih - 3);
    for (let x = bx0; x <= bx1; x++) { const i = w.idx(x, ys); w.wall[i] = W.WALL; w.wbld[i] = b.id; w.room[i] = -1; }
    const dx = ri(bx0, bx1);
    w.wall[w.idx(dx, ys)] = W.DOORWAY; w.room[w.idx(dx, ys)] = b.id;
    rooms.push([bx0, y0 + 1, bx1, ys - 1], [bx0, ys + 1, bx1, y1 - 1]);
  } else rooms.push([bx0, y0 + 1, bx1, y1 - 1]);
  if (halves[1]) rooms.push([halves[1][0], y0 + 1, halves[1][1], y1 - 1]);
  // portes : devant (côté rue) et parfois derrière
  const doorOn = (side) => {
    const y = side === 'S' ? y1 : y0;
    for (let t = 0; t < 20; t++) {
      const x = ri(x0 + 1, x1 - 1);
      if (w.wall[w.idx(x, y)] === W.WALL && w.mask(x, y) === 3) {
        const inner = w.idx(x, side === 'S' ? y - 1 : y + 1);
        if (w.wall[inner]) continue;
        w.wall[w.idx(x, y)] = W.DOOR;
        w.room[w.idx(x, y)] = -1;
        return [x, y];
      }
    }
    return null;
  };
  const front = doorOn(L.door);
  if (front && rnd() < 0.35) w.lock[w.idx(front[0], front[1])] = 1;
  const back = rnd() < 0.55 ? doorOn(L.door === 'S' ? 'N' : 'S') : null;
  if (back && rnd() < 0.3) w.lock[w.idx(back[0], back[1])] = 1;
  windows(w, rnd, b, 0.4);
  // pièces : la plus grande = salon, puis cuisine, chambre, salle de bain
  rooms.sort((a, c) => (c[2] - c[0] + 1) * (c[3] - c[1] + 1) - (a[2] - a[0] + 1) * (a[3] - a[1] + 1));
  const kinds = rooms.length === 1 ? ['all'] : rooms.length === 2 ? ['living_kitchen', 'bedroom'] : ['living', 'kitchen', 'bedroom'];
  if (rooms.length === 3) {
    // la plus petite des trois devient la salle de bain si elle est vraiment petite
    const r = rooms[2];
    if ((r[2] - r[0] + 1) * (r[3] - r[1] + 1) <= 6) kinds[2] = 'bath', kinds[1] = 'kitchen', kinds[0] = 'living_bed';
  }
  const doorCell = front || back;
  rooms.forEach((r, i) => {
    const kind = kinds[i];
    floor(w, r[0], r[1], r[2], r[3], kind === 'bath' ? T.TILES : kind.includes('kitchen') ? T.LINO : kind === 'bedroom' ? T.CARPET : T.PLANK);
    furnish(w, rnd, b, r, kind, doorCell);
  });
  // perron et allée jusqu'au trottoir
  if (front) {
    const dir = L.door === 'S' ? 1 : -1;
    for (let y = front[1] + dir; w.inb(front[0], y) && Math.abs(y - front[1]) < 5; y += dir) {
      const t = w.T(front[0], y);
      if (t === T.SIDEWALK || isRoad(t)) break;
      w.tile[w.idx(front[0], y)] = T.SIDEWALK;
    }
    const mx = front[0] + (rnd() < 0.5 ? -2 : 2), my = front[1] + dir * 2;
    if (w.inb(mx, my) && !w.wall[w.idx(mx, my)] && w.occ[w.idx(mx, my)] < 0) addContainer(w, rnd, { type: 'mailbox', x: mx, y: my, k: dir > 0 ? 0 : 2, v: ri(0, 2) });
    const tx = front[0] + (mx > front[0] ? -2 : 2), ty = front[1] + dir;
    if (w.inb(tx, ty) && rnd() < 0.6 && !w.wall[w.idx(tx, ty)] && w.occ[w.idx(tx, ty)] < 0) addContainer(w, rnd, { type: 'trash', x: tx, y: ty, k: 0, v: 0 });
  }
  // jardin de derrière : parfois une caisse, parfois une clôture
  const by = L.door === 'S' ? y0 - 2 : y1 + 2;
  if (rnd() < 0.45) {
    const cx = ri(x0, x1);
    if (w.inb(cx, by) && !w.wall[w.idx(cx, by)] && w.occ[w.idx(cx, by)] < 0 && !isRoad(w.T(cx, by))) addContainer(w, rnd, { type: 'crate', x: cx, y: by, k: 0, v: 0 });
  }
  if (rnd() < 0.5) {
    const fy = L.door === 'S' ? y0 - 3 : y1 + 3;
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (!w.inb(x, fy) || w.wall[w.idx(x, fy)] || w.occ[w.idx(x, fy)] >= 0 || w.T(x, fy) === T.SIDEWALK || isRoad(w.T(x, fy))) continue;
      if (Math.abs(x - (x0 + x1) / 2) < 1) continue; // portillon
      w.wall[w.idx(x, fy)] = W.FENCE;
    }
  }
  return b;
}

// Meubler une pièce : contre les murs, sans boucher les portes ni couper la maison en deux.
function furnish(w, rnd, b, r, kind, doorCell) {
  const LISTS = {
    living: ['sofa', 'armchair', 'tv', 'bookshelf', 'dresser'],
    kitchen: ['fridge', 'stove', 'sink', 'counter', 'counter', 'table'],
    bedroom: ['bed', 'wardrobe', 'dresser', 'bookshelf'],
    bath: ['toilet', 'bathsink'],
    living_kitchen: ['fridge', 'stove', 'sink', 'counter', 'sofa', 'tv', 'table', 'bookshelf'],
    living_bed: ['bed', 'sofa', 'tv', 'wardrobe', 'bookshelf'],
    all: ['bed', 'fridge', 'stove', 'sink', 'counter', 'sofa', 'wardrobe', 'toilet'],
  };
  let list = LISTS[kind];
  if (kind === 'bedroom' && rnd() < 0.5) list = [...list, 'bathsink'];
  if (kind === 'living' && rnd() < 0.5) list = [...list, 'table'];
  // cases contre un mur, avec l'orientation qui tourne le dos au mur
  const spots = [];
  for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) {
    const ks = [];
    if (w.wall[w.idx(x, y - 1)] === W.WALL || w.wall[w.idx(x, y - 1)] === W.WINDOW) ks.push(0);
    if (w.wall[w.idx(x - 1, y)] === W.WALL || w.wall[w.idx(x - 1, y)] === W.WINDOW) ks.push(3);
    if (w.wall[w.idx(x, y + 1)] === W.WALL || w.wall[w.idx(x, y + 1)] === W.WINDOW) ks.push(2);
    if (w.wall[w.idx(x + 1, y)] === W.WALL || w.wall[w.idx(x + 1, y)] === W.WINDOW) ks.push(1);
    for (const k of ks) spots.push([x, y, k]);
  }
  const nearDoor = (x, y) => {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const k = w.Wk(x + dx, y + dy);
      if (k === W.DOOR || k === W.DOORWAY || k === W.OPEN) return true;
    }
    return false;
  };
  const connected = () => {
    // toutes les cases libres de la maison restent atteignables depuis la porte
    if (!doorCell) return true;
    const seen = new Uint8Array(MAP * MAP), q = [doorCell];
    seen[w.idx(doorCell[0], doorCell[1])] = 1;
    let n = 0;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, i = w.idx(nx, ny);
        if (seen[i]) continue;
        const inside = w.room[i] === b.id || (w.wall[i] === W.DOORWAY && w.wbld[i] === b.id);
        if (!inside || w.occ[i] >= 0) continue;
        seen[i] = 1; n++; q.push([nx, ny]);
      }
    }
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = w.idx(x, y);
      if ((w.room[i] === b.id || w.wall[i] === W.DOORWAY) && w.occ[i] < 0 && !seen[i]) return false;
    }
    return true;
  };
  for (const type of list) {
    for (let t = 0; t < 14; t++) {
      let x, y, k;
      if (type === 'table') {
        x = r[0] + 1 + Math.floor(rnd() * Math.max(1, r[2] - r[0] - 1)); y = r[1] + 1 + Math.floor(rnd() * Math.max(1, r[3] - r[1] - 1)); k = 0;
      } else {
        if (!spots.length) break;
        [x, y, k] = spots[Math.floor(rnd() * spots.length)];
      }
      if (!w.canPlace(type, x, y, k)) continue;
      const cells = footprint({ type, x, y, k });
      if (cells.some(([cx, cy]) => w.room[w.idx(cx, cy)] !== b.id || nearDoor(cx, cy))) continue;
      const o = addContainer(w, rnd, { type, x, y, k, v: Math.floor(rnd() * 4) });
      if (!connected()) { w.removeObj(o); continue; }
      if (type === 'sink' || type === 'bathsink') w.water[w.idx(x, y)] = Math.floor(rnd() * 4);
      if (type === 'toilet') w.water[w.idx(x, y)] = 1 + Math.floor(rnd() * 3);
      if (type === 'table') {
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0]]) {
          if (rnd() < 0.6 && w.canPlace('chair', x + dx, y + dy, 0) && w.room[w.idx(x + dx, y + dy)] === b.id && !nearDoor(x + dx, y + dy)) {
            const c = w.addObj({ type: 'chair', x: x + dx, y: y + dy, k: dx > 0 ? 3 : dx < 0 ? 1 : 2, v: 0 });
            if (!connected()) w.removeObj(c);
          }
        }
      }
      break;
    }
  }
}

function makeStore(w, rnd, x0, y0, x1, y1) {
  const b = makeBuilding(w, rnd, x0, y0, x1, y1, 'store', { ext: 4, int: 0, roof: 3 });
  floor(w, x0 + 1, y0 + 1, x1 - 1, y1 - 1, T.LINO);
  const dx = (x0 + x1) >> 1;
  w.wall[w.idx(dx, y1)] = W.DOOR;
  w.lock[w.idx(dx, y1)] = 1;
  windows(w, rnd, b, 0.9);
  // rayons en colonnes, allées entre
  for (let x = x0 + 2; x <= x1 - 2; x += 3) {
    for (let y = y0 + 2; y <= y1 - 3; y++) if (w.canPlace('shelf', x, y, 3)) addContainer(w, rnd, { type: 'shelf', x, y, k: 3, v: Math.floor(rnd() * 8) });
  }
  addContainer(w, rnd, { type: 'counter', x: x0 + 1, y: y1 - 2, k: 3, v: 2 });
  addContainer(w, rnd, { type: 'fridge', x: x1 - 1, y: y0 + 1, k: 0, v: 0 });
  addContainer(w, rnd, { type: 'fridge', x: x1 - 1, y: y0 + 2, k: 1, v: 0 });
  for (let x = x0 + 1; x < x1; x += 4) if (w.canPlace('trash', x, y1 + 1, 0)) addContainer(w, rnd, { type: 'trash', x, y: y1 + 1, k: 0, v: 0 });
  // devant le magasin, le trottoir
  for (let x = x0 - 1; x <= x1 + 1; x++) if (!isRoad(w.T(x, y1 + 1))) w.tile[w.idx(x, y1 + 1)] = T.SIDEWALK;
  return b;
}
