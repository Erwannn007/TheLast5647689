// Le monde : une grande carte (256 x 256) générée d'une graine — centre-ville moderne à tours,
// banlieue pavillonnaire, zone industrielle, campagne (fermes, granges, champs, forêts, lacs).
// Chaque étage est une couche (tuiles, murs, pièces, objets) ; la sauvegarde ne garde que les
// différences avec la carte générée.
import { hash } from './raster.js';
import { T, isWater, isRoad } from './sprites/tiles.js';
import { rollLoot, makeStack } from './items.js';

export const MAP = 256;
export const FLOOR_H = 28; // hauteur d'un étage en pixels
// murs (un par case) : 0 rien
export const W = { NONE: 0, WALL: 1, WINDOW: 2, BROKEN: 3, DOOR: 4, OPEN: 5, DOORWAY: 6, FENCE: 7 };
export const wallLike = (k) => k >= 1 && k <= 6;

// taille d'inventaire par meuble conteneur
export const CONTAINERS = {
  fridge: 9, counter: 9, sink: 6, stove: 4, wardrobe: 18, dresser: 9, bookshelf: 9, bathsink: 6,
  shelf: 9, crate: 9, trash: 4, mailbox: 3, car: 9, tv: 3, desk: 6, filing: 9, vending: 9, locker: 9,
  gunrack: 9, rack: 12, medcab: 9, haybale: 3,
};
export const LABEL = {
  fridge: 'Frigo', counter: 'Placard', sink: 'Évier', stove: 'Cuisinière', wardrobe: 'Armoire', dresser: 'Commode',
  bookshelf: 'Bibliothèque', bathsink: 'Lavabo', shelf: 'Étagère', crate: 'Caisse', trash: 'Poubelle', mailbox: 'Boîte aux lettres',
  car: 'Coffre', tv: 'Meuble télé', bag: 'Sac au sol', campfire: 'Feu de camp', bed: 'Lit', sofa: 'Canapé', armchair: 'Fauteuil',
  toilet: 'Toilettes', pump: 'Pompe', tree: 'Arbre', berry: 'Ronces', bench: 'Banc', swing: 'Balançoire',
  desk: 'Bureau', filing: 'Classeur', vending: 'Distributeur', locker: 'Casier', gunrack: 'Râtelier', rack: 'Rayonnage',
  medcab: 'Armoire à pharmacie', haybale: 'Botte de foin', gaspump: 'Pompe à essence', carcass: 'Carcasse',
};
// objets qui bloquent le passage, demi-taille de la boîte de collision (en tuiles)
export const SOLID = {
  fridge: 0.42, counter: 0.46, sink: 0.46, stove: 0.44, wardrobe: 0.46, dresser: 0.42, bed: 0.46, sofa: 0.46,
  armchair: 0.4, table: 0.44, chair: 0.25, bookshelf: 0.46, tv: 0.42, toilet: 0.3, bathsink: 0.38, shelf: 0.46,
  crate: 0.38, trash: 0.32, mailbox: 0.12, bench: 0.42, lamp: 0.1, pump: 0.2, campfire: 0.3,
  tree: 0.16, rock: 0.32, stump: 0.18, swing: 0.1, sign: 0.08, hydrant: 0.12,
  desk: 0.46, ochair: 0.22, filing: 0.32, vending: 0.44, locker: 0.44, gunrack: 0.46, rack: 0.48, medcab: 0.44,
  haybale: 0.44, gaspump: 0.24, stairs: 0.46, stairs_down: 0.46, planter: 0.38, hvac: 0.42,
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

// Une couche : le sol (étage 0) ou un étage. Aux étages, une tuile 0 est du vide.
class Layer {
  constructor(n) {
    this.tile = new Uint8Array(n);
    this.wall = new Uint8Array(n);
    this.lock = new Uint8Array(n);
    this.wbld = new Int16Array(n).fill(-1); // bâtiment d'un mur
    this.room = new Int16Array(n).fill(-1); // bâtiment d'une case intérieure
    this.occ = new Int32Array(n).fill(-1); // objet posé sur la case
    this.water = new Uint8Array(n); // eau restante (évier, toilettes)
  }
}

export class World {
  constructor() {
    const n = MAP * MAP;
    this.L = [new Layer(n)];
    this.litter = new Uint8Array(n);
    this.objs = [];
    this.cars = []; // voitures libres : { type: 'car', v, x, y, ang, speed, fuel, inv }
    this.animals = []; // { type: 'deer' | 'rabbit', x, y, ang, hp, ... }
    this.blds = [];
    this.base = 0; // nombre d'objets issus de la génération
    this.removed = new Set();
    this.mods = {}; // "l,i,champ" -> valeur (murs, serrures, eau modifiés)
  }
  // compatibilité : l'étage 0
  get tile() { return this.L[0].tile; }
  get wall() { return this.L[0].wall; }
  get lock() { return this.L[0].lock; }
  get wbld() { return this.L[0].wbld; }
  get room() { return this.L[0].room; }
  get occ() { return this.L[0].occ; }
  get water() { return this.L[0].water; }
  layer(l) { while (this.L.length <= l) this.L.push(new Layer(MAP * MAP)); return this.L[l]; }
  lay(l) { return this.L[l] || null; }

  idx(x, y) { return y * MAP + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < MAP && y < MAP; }
  T(x, y, l = 0) { if (!this.inb(x, y)) return l ? 0 : T.FOREST; const L = this.L[l]; return L ? L.tile[y * MAP + x] : 0; }
  Wk(x, y, l = 0) { const L = this.L[l]; return L && this.inb(x, y) ? L.wall[y * MAP + x] : 0; }
  obj(x, y, l = 0) { const L = this.L[l]; if (!L || !this.inb(x, y)) return null; const o = L.occ[y * MAP + x]; return o >= 0 ? this.objs[o] : null; }
  roomAt(x, y, l = 0) { const L = this.L[l]; return L && this.inb(x, y) ? L.room[y * MAP + x] : -1; }
  // bâtiment où se trouve un point : dans une case de mur fin, on regarde de quel côté du mur il est
  inside(px, py, l = 0) {
    const x = Math.floor(px), y = Math.floor(py), L = this.L[l];
    const r = this.roomAt(x, y, l);
    if (r >= 0 || !L || !this.inb(x, y) || L.wbld[y * MAP + x] < 0) return r;
    const b = L.wbld[y * MAP + x], dx = px - x - 0.5, dy = py - y - 0.5;
    const n = Math.abs(dx) > Math.abs(dy) ? this.roomAt(x + Math.sign(dx), y, l) : this.roomAt(x, y + Math.sign(dy), l);
    return n === b ? b : l > 0 ? b : -1; // à l'étage, on est forcément dans le bâtiment
  }
  // voisins muraux (bits : 1 -x, 2 +x, 4 -y, 8 +y) ; les clôtures ne se relient qu'entre elles
  mask(x, y, l = 0) {
    const k = this.Wk(x, y, l), fence = k === W.FENCE;
    const ok = (a, b) => { const n = this.Wk(a, b, l); return fence ? n === W.FENCE : wallLike(n); };
    return (ok(x - 1, y) ? 1 : 0) | (ok(x + 1, y) ? 2 : 0) | (ok(x, y - 1) ? 4 : 0) | (ok(x, y + 1) ? 8 : 0);
  }

  addObj(o) {
    o.l = o.l || 0;
    o.id = this.objs.length;
    this.objs.push(o);
    o.cells = footprint(o);
    const L = this.layer(o.l);
    for (const [cx, cy] of o.cells) L.occ[this.idx(cx, cy)] = o.id;
    return o;
  }
  removeObj(o) {
    const L = this.L[o.l || 0];
    for (const [cx, cy] of o.cells) if (L.occ[this.idx(cx, cy)] === o.id) L.occ[this.idx(cx, cy)] = -1;
    this.objs[o.id] = null;
    if (o.id < this.base) this.removed.add(o.id);
  }
  canPlace(type, x, y, k, l = 0) {
    const L = this.L[l];
    if (!L) return false;
    for (const [cx, cy] of footprint({ type, x, y, k })) {
      if (!this.inb(cx, cy)) return false;
      const i = this.idx(cx, cy);
      if (L.occ[i] >= 0 || L.wall[i] || isWater(L.tile[i]) || (l && !L.tile[i])) return false;
    }
    return true;
  }
  // une case où l'on peut marcher (pour le placement et les sacs au sol)
  walkable(x, y, l = 0) {
    const L = this.L[l];
    if (!L || !this.inb(x, y)) return false;
    const i = this.idx(x, y);
    if (isWater(L.tile[i]) || (l && !L.tile[i])) return false;
    const w = L.wall[i];
    if (w && w !== W.OPEN && w !== W.DOORWAY) return false;
    const o = L.occ[i];
    return o < 0 || !SOLID[this.objs[o].type];
  }
  // changements suivis pour la sauvegarde
  setWall(x, y, l, k) { const i = this.idx(x, y); this.layer(l).wall[i] = k; this.mods[`${l},${i},wall`] = k; }
  setLock(x, y, l, k) { const i = this.idx(x, y); this.layer(l).lock[i] = k; this.mods[`${l},${i},lock`] = k; }
  setWater(x, y, l, k) { const i = this.idx(x, y); this.layer(l).water[i] = k; this.mods[`${l},${i},water`] = k; }

  // différences avec la carte générée
  diff() {
    const strip = ({ cells, ...o }) => o;
    return {
      removed: [...this.removed],
      dirty: this.objs.filter((o) => o && o.id < this.base && o.dirty).map(strip),
      added: this.objs.filter((o) => o && o.id >= this.base).map(strip),
      mods: this.mods, cars: this.cars, animals: this.animals, blds: this.blds.map((b) => b.home ? 1 : 0),
    };
  }
  applyDiff(d) {
    for (const id of d.removed) { const o = this.objs[id]; if (o) this.removeObj(o); }
    for (const o of d.dirty) { const cur = this.objs[o.id]; if (cur) Object.assign(cur, o, { cells: cur.cells }); }
    for (const o of d.added) { delete o.id; this.addObj(o); }
    for (const k in d.mods) {
      const [l, i, f] = k.split(',');
      this.layer(+l)[f][+i] = d.mods[k];
    }
    this.mods = d.mods;
    this.cars = d.cars;
    this.animals = d.animals || this.animals;
  }
}

// taille des grands objets (longueur le long de +u, largeur le long de +v, avant rotation)
export const SIZE = { bed: [2, 1], sofa: [2, 1], swing: [2, 1] };
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
  const G0 = w.L[0];
  const set = (x, y, t) => { if (w.inb(x, y)) G0.tile[w.idx(x, y)] = t; };
  const reserved = new Uint8Array(MAP * MAP); // routes, lots, eau : pas d'arbres
  const res = (x0, y0, x1, y1, v = 1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.inb(x, y)) reserved[w.idx(x, y)] = Math.max(reserved[w.idx(x, y)], v); };
  const ctx = { w, rnd, ri, pick, reserved, res, set };

  // 1. sol : herbe, herbe sèche, sous-bois (plus dense vers les bords)
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    const n = noise(x, y, seed, 11), edge = Math.min(x, y, MAP - 1 - x, MAP - 1 - y);
    let t = n > 0.62 ? T.DRY : T.GRASS;
    const f = noise(x, y, seed + 5, 13) * 0.7 + noise(x, y, seed + 6, 5) * 0.3 + Math.max(0, 12 - edge) * 0.06;
    if (f > 0.66) t = T.FOREST;
    G0.tile[w.idx(x, y)] = t;
  }
  // 2. lacs
  const lake = (cx, cy, rx, ry, s) => {
    for (let y = cy - ry - 3; y <= cy + ry + 3; y++) for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
      if (!w.inb(x, y)) continue;
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy + (noise(x, y, seed + s, 5) - 0.5) * 0.4;
      if (d < 1) { set(x, y, T.WATER); reserved[w.idx(x, y)] = 1; } else if (d < 1.3) { set(x, y, T.SAND); reserved[w.idx(x, y)] = 1; }
    }
  };
  lake(58, 48, 26, 17, 9);
  lake(232, 228, 14, 10, 4);
  lake(122, 92, 8, 5, 3);

  // 3. routes
  const road = (x0, y0, x1, y1, line, t = T.ASPHALT) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!w.inb(x, y)) continue;
      let k = t;
      if (line === 'x' && y === ((y0 + y1) >> 1)) k = T.ROAD_LX;
      if (line === 'y' && x === ((x0 + x1) >> 1)) k = T.ROAD_LY;
      if (t !== T.ASPHALT && isRoad(G0.tile[w.idx(x, y)])) continue; // un chemin ne coupe pas une route
      G0.tile[w.idx(x, y)] = k; reserved[w.idx(x, y)] = 1;
    }
  };
  const walk = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (w.inb(x, y) && !isRoad(w.T(x, y))) { G0.tile[w.idx(x, y)] = T.SIDEWALK; reserved[w.idx(x, y)] = 1; }
    }
  };
  ctx.road = road; ctx.walk = walk;
  // autoroutes
  road(0, 120, MAP - 1, 124, 'x');
  road(160, 0, 164, MAP - 1, 'y');
  // centre-ville : avenues et rues à deux voies, trottoirs de 2
  const AV = [54, 76, 98], ST = [186, 212, 238];
  for (const y of AV) road(165, y, 245, y + 4, 'x');
  for (const x of ST) road(x, 50, x + 4, 119, 'y');
  for (const y of [...AV, 120]) { walk(165, y - 2, 245, y - 1); walk(165, y + 5, 245, y + 6); }
  for (const x of [160, ...ST]) { walk(x - 2, 52, x - 1, 126); walk(x + 5, 52, x + 6, 126); }
  // banlieue : rues de 3, trottoirs de 1
  const SUB_Y = [136, 156, 176, 196], SUB_X = [60, 100, 140];
  for (const y of SUB_Y) { road(40, y, 158, y + 2); walk(40, y - 1, 158, y - 1); walk(40, y + 3, 158, y + 3); }
  for (const x of SUB_X) { road(x, 125, x + 2, 198); walk(x - 1, 125, x - 1, 198); walk(x + 3, 125, x + 3, 198); }
  // zone industrielle
  road(165, 160, 248, 163); road(200, 125, 203, 215); road(165, 200, 248, 203);
  // chemins de terre vers les fermes
  road(98, 20, 99, 119, null, T.PATH);
  road(20, 70, 97, 71, null, T.PATH);
  road(166, 20, 250, 21, null, T.PATH);
  road(60, 199, 61, 240, null, T.PATH);
  road(10, 240, 150, 241, null, T.PATH);
  road(26, 72, 27, 110, null, T.PATH);
  road(98, 0, 99, 20, null, T.PATH);

  // 4. bâtiments
  ctx.blocked = (x0, y0, x1, y1, m) => {
    for (let y = y0 - m; y <= y1 + m; y++) for (let x = x0 - m; x <= x1 + m; x++) {
      if (!w.inb(x, y) || x < 3 || y < 3 || x > MAP - 4 || y > MAP - 4) return true;
      if (reserved[w.idx(x, y)] || G0.wall[w.idx(x, y)] || G0.room[w.idx(x, y)] >= 0) return true;
    }
    return false;
  };
  downtown(ctx, AV, ST);
  suburb(ctx, SUB_Y, SUB_X);
  industrial(ctx);
  countryside(ctx);
  gasStation(ctx, 146, 106, 157, 117);

  // 5. lampadaires
  const lampAt = (x, y) => { if (w.inb(x, y) && !G0.wall[w.idx(x, y)] && G0.occ[w.idx(x, y)] < 0 && G0.tile[w.idx(x, y)] === T.SIDEWALK) w.addObj({ type: 'lamp', x, y, k: 0, v: 0 }); };
  for (let x = 166; x < 246; x += 7) for (const y of [...AV, 120]) { lampAt(x, y - 1); lampAt(x + 3, y + 5); }
  for (let y = 53; y < 120; y += 7) for (const x of ST) { lampAt(x - 1, y); lampAt(x + 5, y + 3); }
  for (let x = 42; x < 158; x += 9) for (const y of SUB_Y) lampAt(x, y - 1);
  for (let x = 4; x < MAP; x += 12) lampAt(x, 119), lampAt(x + 6, 125);

  // 6. voitures : garées en ville, abandonnées en file sur les autoroutes (l'évacuation)
  const taken = new Set();
  const carCells = (x, y, k) => {
    const out = [];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) {
      const [du, dv] = [[a, b], [-b, a], [-a, -b], [b, -a]][k & 3];
      out.push([x + du, y + dv]);
    }
    return out;
  };
  const tryCar = (x, y, k, dent) => {
    const cells = carCells(x, y, k);
    if (cells.some(([cx, cy]) => !w.inb(cx, cy) || !isRoad(w.T(cx, cy)) && w.T(cx, cy) !== T.GRAVEL && w.T(cx, cy) !== T.CONCRETE || taken.has(cx + cy * MAP) || G0.occ[w.idx(cx, cy)] >= 0 || G0.wall[w.idx(cx, cy)])) return false;
    for (const [cx, cy] of cells) taken.add(cx + cy * MAP);
    const cx = cells.reduce((a, c) => a + c[0], 0) / cells.length + 0.5, cy = cells.reduce((a, c) => a + c[1], 0) / cells.length + 0.5;
    const fuel = rnd() < 0.4 ? 0 : Math.round(5 + rnd() * 55);
    w.cars.push({ type: 'car', v: ri(0, 49), x: cx, y: cy, ang: [0, Math.PI / 2, Math.PI, -Math.PI / 2][k] + (dent || 0), speed: 0, fuel, inv: rollLoot('car', rnd, CONTAINERS.car) });
    return true;
  };
  // file d'évacuation vers l'ouest sur l'autoroute, voie sud
  for (let x = 6; x < 150; x += ri(5, 9)) if (rnd() < 0.55) tryCar(x + 3, 124, 2, (rnd() - 0.5) * 0.25);
  for (let y = 130; y < 250; y += ri(6, 10)) if (rnd() < 0.4) tryCar(164, y, 1, (rnd() - 0.5) * 0.2);
  for (let n = 0, t = 0; n < 45 && t < 600; t++) {
    const y = pick(AV) + pick([1, 3]), x = ri(166, 240);
    if (tryCar(x, y, rnd() < 0.5 ? 0 : 2)) n++;
  }
  for (let n = 0, t = 0; n < 25 && t < 400; t++) {
    const x = pick(ST) + pick([1, 3]), y = ri(52, 116);
    if (tryCar(x, y, rnd() < 0.5 ? 1 : 3)) n++;
  }
  for (let n = 0, t = 0; n < 25 && t < 400; t++) if (tryCar(ri(42, 150), pick(SUB_Y) + 1, rnd() < 0.5 ? 0 : 2)) n++;
  for (const p of w.parkings || []) for (let x = p[0]; x + 3 <= p[2]; x += 5) if (rnd() < 0.55) tryCar(x, p[1] + 1, 0);

  // 7. végétation
  for (let y = 1; y < MAP - 1; y++) for (let x = 1; x < MAP - 1; x++) {
    const i = w.idx(x, y);
    if (reserved[i] || G0.occ[i] >= 0 || G0.wall[i] || isWater(G0.tile[i])) continue;
    const t = G0.tile[i], forest = t === T.FOREST, r = hash(x, y, seed + 17);
    if (t === T.FIELD || t === T.GRAVEL || t === T.CONCRETE || t === T.COBBLE) continue;
    const dens = forest ? 0.3 : t === T.DRY ? 0.03 : 0.045;
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
    } else if (r < dens + 0.022) {
      w.addObj({ type: forest && hash(x, y, 9) < 0.45 ? 'berry' : 'bush', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0, regrow: 0 });
    } else if (r < dens + 0.03) {
      w.addObj({ type: 'rock', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0 });
    } else if (r < dens + 0.1) {
      w.addObj({ type: 'grass', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0 });
    }
  }
  // roseaux au bord de l'eau, feuilles mortes
  for (let y = 1; y < MAP - 1; y++) for (let x = 1; x < MAP - 1; x++) {
    const i = w.idx(x, y);
    if (isWater(G0.tile[i]) || G0.occ[i] >= 0 || G0.wall[i] || isRoad(G0.tile[i])) continue;
    const nearW = isWater(w.T(x - 1, y)) || isWater(w.T(x + 1, y)) || isWater(w.T(x, y - 1)) || isWater(w.T(x, y + 1));
    if (nearW && hash(x, y, 31) < 0.4) w.addObj({ type: 'reed', x, y, k: 0, v: (hash(x, y, 5) * 3) | 0 });
    if (!w.litter[i] && hash(x, y, 33) < 0.04) w.litter[i] = 1 + ((hash(x, y, 34) * 4) | 0);
  }
  for (let i = 0; i < MAP * MAP; i++) if (G0.room[i] >= 0 || G0.tile[i] === T.COBBLE) w.litter[i] = 0;

  // 8. animaux sauvages
  for (let n = 0, t = 0; t < 4000 && n < 130; t++) {
    const x = ri(4, MAP - 5), y = ri(4, MAP - 5), tt = w.T(x, y);
    if (reserved[w.idx(x, y)] || !w.walkable(x, y) || G0.room[w.idx(x, y)] >= 0) continue;
    const deer = n < 50;
    if (deer && tt !== T.FOREST && tt !== T.FIELD && tt !== T.DRY) continue;
    if (!deer && tt !== T.GRASS && tt !== T.DRY && tt !== T.FIELD) continue;
    w.animals.push({ type: deer ? 'deer' : 'rabbit', buck: deer && rnd() < 0.35, x: x + 0.5, y: y + 0.5, ang: rnd() * 6.28, hp: deer ? 3 : 1, state: 'graze', t: rnd() * 5 });
    n++;
  }

  // 9. point de départ : une maison de la banlieue, déverrouillée
  const homes = w.blds.filter((b) => b.kind === 'house' && b.street);
  let start = null, home = homes[0];
  for (const h of homes.sort((a, b) => Math.hypot(a.x0 - 120, a.y0 - 150) - Math.hypot(b.x0 - 120, b.y0 - 150))) {
    for (let y = h.y0 + 1; y < h.y1 && !start; y++) for (let x = h.x0 + 1; x < h.x1 && !start; x++) {
      if (G0.room[w.idx(x, y)] === h.id && w.walkable(x, y)) start = [x + 0.5, y + 0.5];
    }
    if (start) { home = h; break; }
  }
  home.home = true;
  for (let i = 0; i < MAP * MAP; i++) if (G0.wbld[i] === home.id && G0.lock[i]) G0.lock[i] = 0;
  w.start = start;
  w.base = w.objs.length;
  return w;
}

// ------------------------------------------------------------------ outils de construction

function addContainer(w, rnd, o, loot) {
  const size = CONTAINERS[o.type];
  if (size) o.inv = rollLoot(loot || o.type, rnd, size);
  return w.addObj(o);
}

const STYLE = (rnd) => ({ ext: Math.floor(rnd() * 5), int: Math.floor(rnd() * 3), roof: Math.floor(rnd() * 4) });

// Un bâtiment rectangulaire : murs extérieurs à chaque étage, intérieur marqué comme pièces.
// roof : 'gable' (toit à deux pans, 1 étage) ou 'flat' (toit-terrasse avec acrotère).
function makeBuilding(w, rnd, x0, y0, x1, y1, kind, style, floors = 1, roof = 'gable') {
  const id = w.blds.length;
  const b = { id, x0, y0, x1, y1, kind, style, floors, roof, seed: (rnd() * 1e6) | 0 };
  w.blds.push(b);
  for (let l = 0; l < floors; l++) {
    const L = w.layer(l);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = w.idx(x, y);
      if (l) L.tile[i] = T.PLANK;
      if (x === x0 || x === x1 || y === y0 || y === y1) { L.wall[i] = W.WALL; L.wbld[i] = id; }
      else L.room[i] = id;
    }
  }
  // climatiseurs sur les toits-terrasses
  if (roof === 'flat') {
    b.hvac = [];
    const n = Math.floor((x1 - x0) * (y1 - y0) / 40);
    for (let k = 0; k < n; k++) b.hvac.push([x0 + 2 + Math.floor(rnd() * Math.max(1, x1 - x0 - 3)), y0 + 2 + Math.floor(rnd() * Math.max(1, y1 - y0 - 3))]);
  }
  return b;
}
function floorTile(w, l, x0, y0, x1, y1, t) {
  const L = w.layer(l);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (L.room[w.idx(x, y)] >= 0 || L.wall[w.idx(x, y)] === W.DOORWAY) L.tile[w.idx(x, y)] = t;
}
// cloison (rangée ou colonne de murs) avec une ouverture
function partition(w, l, b, x0, y0, x1, y1, door, kind = W.DOORWAY) {
  const L = w.layer(l);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = w.idx(x, y); L.wall[i] = W.WALL; L.wbld[i] = b.id; L.room[i] = -1; }
  for (const [dx, dy] of door) { const i = w.idx(dx, dy); L.wall[i] = kind; if (kind === W.DOORWAY) L.room[i] = b.id; }
}

// fenêtres sur les murs droits extérieurs, jamais au contact d'une cloison
function windows(w, rnd, b, p, l = 0) {
  const L = w.layer(l);
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const i = w.idx(x, y);
    if (L.wall[i] !== W.WALL || L.wbld[i] !== b.id) continue;
    if (!(x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1)) continue;
    const m = w.mask(x, y, l);
    if (m !== 3 && m !== 12) continue;
    const inX = y === b.y0 || y === b.y1;
    const nb = inX ? [w.Wk(x - 1, y, l), w.Wk(x + 1, y, l)] : [w.Wk(x, y - 1, l), w.Wk(x, y + 1, l)];
    if (nb.some((k) => k !== W.WALL && k !== W.WINDOW)) continue;
    const corner = inX ? (x - 1 === b.x0 || x + 1 === b.x1) : (y - 1 === b.y0 || y + 1 === b.y1);
    if (corner) continue;
    if (rnd() < p) L.wall[i] = rnd() < 0.05 ? W.BROKEN : W.WINDOW;
  }
}
// porte sur un mur droit d'un côté ('N','S','E','W'), si possible près de x/y voulu
function doorOn(w, rnd, b, side, l = 0, near = null, double = false) {
  const L = w.layer(l);
  for (let t = 0; t < 30; t++) {
    let x, y;
    if (side === 'S' || side === 'N') { y = side === 'S' ? b.y1 : b.y0; x = near != null && t < 6 ? near + t - 3 : b.x0 + 1 + Math.floor(rnd() * (b.x1 - b.x0 - 1)); }
    else { x = side === 'E' ? b.x1 : b.x0; y = near != null && t < 6 ? near + t - 3 : b.y0 + 1 + Math.floor(rnd() * (b.y1 - b.y0 - 1)); }
    if (!w.inb(x, y) || L.wall[w.idx(x, y)] !== W.WALL) continue;
    const m = w.mask(x, y, l);
    if (m !== 3 && m !== 12) continue;
    const ix = side === 'E' ? x - 1 : side === 'W' ? x + 1 : x, iy = side === 'S' ? y - 1 : side === 'N' ? y + 1 : y;
    if (L.wall[w.idx(ix, iy)]) continue;
    L.wall[w.idx(x, y)] = W.DOOR;
    if (double) {
      const [ox, oy] = side === 'S' || side === 'N' ? [x + 1, y] : [x, y + 1];
      if (L.wall[w.idx(ox, oy)] === W.WALL && w.mask(ox, oy, l) === m && !L.wall[w.idx(side === 'E' ? ox - 1 : side === 'W' ? ox + 1 : ox, side === 'S' ? oy - 1 : side === 'N' ? oy + 1 : oy)]) L.wall[w.idx(ox, oy)] = W.DOOR;
    }
    return [x, y];
  }
  return null;
}

// Meubler une pièce : contre les murs, sans boucher les portes ni couper le bâtiment en deux.
const LISTS = {
  living: ['sofa', 'armchair', 'tv', 'bookshelf', 'dresser'],
  kitchen: ['fridge', 'stove', 'sink', 'counter', 'counter', 'table'],
  bedroom: ['bed', 'wardrobe', 'dresser', 'bookshelf'],
  bath: ['toilet', 'bathsink'],
  living_kitchen: ['fridge', 'stove', 'sink', 'counter', 'sofa', 'tv', 'table', 'bookshelf'],
  living_bed: ['bed', 'sofa', 'tv', 'wardrobe', 'bookshelf'],
  all: ['bed', 'fridge', 'stove', 'sink', 'counter', 'sofa', 'wardrobe', 'toilet'],
  studio: ['bed', 'fridge', 'sink', 'counter', 'sofa', 'wardrobe', 'bathsink', 'tv'],
  office: ['desk', 'desk', 'filing', 'desk', 'filing', 'bookshelf'],
  ward: ['bed', 'medcab', 'bed', 'armchair'],
};
function furnish(w, rnd, b, r, kind, doorCell, l = 0, list = null, loot = null) {
  const L = w.layer(l);
  list = list || LISTS[kind];
  if (kind === 'bedroom' && rnd() < 0.5) list = [...list, 'bathsink'];
  if (kind === 'living' && rnd() < 0.5) list = [...list, 'table'];
  const solidWall = (x, y) => { const k = w.Wk(x, y, l); return k === W.WALL || k === W.WINDOW || k === W.BROKEN; };
  const spots = [];
  for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) {
    if (solidWall(x, y - 1)) spots.push([x, y, 0]);
    if (solidWall(x - 1, y)) spots.push([x, y, 3]);
    if (solidWall(x, y + 1)) spots.push([x, y, 2]);
    if (solidWall(x + 1, y)) spots.push([x, y, 1]);
  }
  const nearDoor = (x, y) => {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const k = w.Wk(x + dx, y + dy, l);
      if (k === W.DOOR || k === W.DOORWAY || k === W.OPEN) return true;
      const o = w.obj(x + dx, y + dy, l);
      if (o && (o.type === 'stairs' || o.type === 'stairs_down')) return true;
    }
    return false;
  };
  // toutes les cases libres du bâtiment restent atteignables depuis la porte (parcours limité au bâtiment)
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const connected = () => {
    if (!doorCell) return true;
    const seen = new Uint8Array(bw * bh), q = [doorCell];
    const li = (x, y) => (y - b.y0) * bw + (x - b.x0);
    seen[li(doorCell[0], doorCell[1])] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < b.x0 || ny < b.y0 || nx > b.x1 || ny > b.y1) continue;
        const i = w.idx(nx, ny), j = li(nx, ny);
        if (seen[j]) continue;
        const inside = L.room[i] === b.id || (L.wall[i] === W.DOORWAY && L.wbld[i] === b.id);
        if (!inside) continue;
        const o = L.occ[i] >= 0 ? w.objs[L.occ[i]] : null;
        if (o && SOLID[o.type] && o.type !== 'stairs_down') continue;
        seen[j] = 1; q.push([nx, ny]);
      }
    }
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = w.idx(x, y);
      const o = L.occ[i] >= 0 ? w.objs[L.occ[i]] : null;
      if ((L.room[i] === b.id || L.wall[i] === W.DOORWAY) && (!o || !SOLID[o.type]) && !seen[li(x, y)]) return false;
    }
    return true;
  };
  for (const type of list) {
    for (let t = 0; t < 14; t++) {
      let x, y, k;
      if (type === 'table' || (type === 'desk' && kind === 'office' && t % 2)) {
        x = r[0] + 1 + Math.floor(rnd() * Math.max(1, r[2] - r[0] - 1)); y = r[1] + 1 + Math.floor(rnd() * Math.max(1, r[3] - r[1] - 1)); k = (rnd() * 4) | 0;
      } else {
        if (!spots.length) break;
        [x, y, k] = spots[Math.floor(rnd() * spots.length)];
      }
      if (!w.canPlace(type, x, y, k, l)) continue;
      const cells = footprint({ type, x, y, k });
      if (cells.some(([cx, cy]) => L.room[w.idx(cx, cy)] !== b.id || nearDoor(cx, cy))) continue;
      const o = addContainer(w, rnd, { type, x, y, k, l, v: Math.floor(rnd() * 4) }, loot && CONTAINERS[type] ? loot[type] : null);
      if (!connected()) { w.removeObj(o); w.objs.pop(); continue; }
      if (type === 'sink' || type === 'bathsink') L.water[w.idx(x, y)] = Math.floor(rnd() * 4);
      if (type === 'toilet') L.water[w.idx(x, y)] = 1 + Math.floor(rnd() * 3);
      if (type === 'table' || type === 'desk') {
        const seat = type === 'desk' ? 'ochair' : 'chair';
        for (const [dx, dy] of type === 'desk' ? [[0, 1]] : [[1, 0], [0, 1], [-1, 0]]) {
          const [sx, sy] = type === 'desk' ? [[0, 1], [-1, 0], [0, -1], [1, 0]][k].map((d, i2) => [x, y][i2] + d) : [x + dx, y + dy];
          if (rnd() < 0.7 && w.canPlace(seat, sx, sy, 0, l) && L.room[w.idx(sx, sy)] === b.id && !nearDoor(sx, sy)) {
            const c = w.addObj({ type: seat, x: sx, y: sy, l, k: type === 'desk' ? (k + 2) & 3 : dx > 0 ? 3 : dx < 0 ? 1 : 2, v: 0 });
            if (!connected()) { w.removeObj(c); w.objs.pop(); }
          }
        }
      }
      break;
    }
  }
}

// escalier d'un bâtiment à étages : montée et trémie alternent entre deux colonnes (sx, sx+1)
function stairwell(w, b, sx, sy) {
  b.stairs = [sx, sy];
  for (let l = 0; l < b.floors; l++) {
    if (l < b.floors - 1) w.addObj({ type: 'stairs', x: sx + (l & 1), y: sy, l, k: 0, v: 0, to: l + 1 });
    if (l > 0) w.addObj({ type: 'stairs_down', x: sx + ((l - 1) & 1), y: sy, l, k: 0, v: 0, to: l - 1 });
  }
}

// ------------------------------------------------------------------ maisons

function makeHouse(ctx, L) {
  const { w, rnd, ri } = ctx;
  const { x0, y0, x1, y1 } = L;
  const b = makeBuilding(w, rnd, x0, y0, x1, y1, L.kind || 'house', L.style || STYLE(rnd));
  b.street = L.street;
  const iw = x1 - x0 - 1, ih = y1 - y0 - 1;
  const rooms = [];
  let xs = -1;
  if (iw >= 6) {
    xs = x0 + 1 + ri(2, iw - 3);
    partition(w, 0, b, xs, y0 + 1, xs, y1 - 1, [[xs, ri(y0 + 1, y1 - 1)]]);
  }
  const halves = xs < 0 ? [[x0 + 1, x1 - 1]] : [[x0 + 1, xs - 1], [xs + 1, x1 - 1]];
  halves.sort((a, c) => (c[1] - c[0]) - (a[1] - a[0]));
  const [bx0, bx1] = halves[0];
  if (ih >= 5 && bx1 - bx0 >= 2) {
    const ys = y0 + 1 + ri(2, ih - 3);
    partition(w, 0, b, bx0, ys, bx1, ys, [[ri(bx0, bx1), ys]]);
    rooms.push([bx0, y0 + 1, bx1, ys - 1], [bx0, ys + 1, bx1, y1 - 1]);
  } else rooms.push([bx0, y0 + 1, bx1, y1 - 1]);
  if (halves[1]) rooms.push([halves[1][0], y0 + 1, halves[1][1], y1 - 1]);
  const front = doorOn(w, rnd, b, L.door);
  if (front && rnd() < 0.35) w.L[0].lock[w.idx(front[0], front[1])] = 1;
  const back = rnd() < 0.55 ? doorOn(w, rnd, b, L.door === 'S' ? 'N' : 'S') : null;
  if (back && rnd() < 0.3) w.L[0].lock[w.idx(back[0], back[1])] = 1;
  windows(w, rnd, b, 0.4);
  rooms.sort((a, c) => (c[2] - c[0] + 1) * (c[3] - c[1] + 1) - (a[2] - a[0] + 1) * (a[3] - a[1] + 1));
  const kinds = rooms.length === 1 ? ['all'] : rooms.length === 2 ? ['living_kitchen', 'bedroom'] : ['living', 'kitchen', 'bedroom'];
  if (rooms.length === 3) {
    const r = rooms[2];
    if ((r[2] - r[0] + 1) * (r[3] - r[1] + 1) <= 6) kinds[2] = 'bath', kinds[1] = 'kitchen', kinds[0] = 'living_bed';
  }
  const doorCell = front || back;
  rooms.forEach((r, i) => {
    const kind = kinds[i];
    floorTile(w, 0, r[0], r[1], r[2], r[3], kind === 'bath' ? T.TILES : kind.includes('kitchen') ? T.LINO : kind === 'bedroom' ? T.CARPET : T.PLANK);
    furnish(w, rnd, b, r, kind, doorCell, 0, null, L.loot);
  });
  if (front && L.street) {
    const dir = L.door === 'S' ? 1 : -1;
    for (let y = front[1] + dir; w.inb(front[0], y) && Math.abs(y - front[1]) < 5; y += dir) {
      const t = w.T(front[0], y);
      if (t === T.SIDEWALK || isRoad(t)) break;
      w.L[0].tile[w.idx(front[0], y)] = T.SIDEWALK;
    }
    const mx = front[0] + (rnd() < 0.5 ? -2 : 2), my = front[1] + dir * 2;
    if (w.inb(mx, my) && !w.wall[w.idx(mx, my)] && w.occ[w.idx(mx, my)] < 0) addContainer(w, rnd, { type: 'mailbox', x: mx, y: my, k: dir > 0 ? 0 : 2, v: ri(0, 2) });
    const tx = front[0] + (mx > front[0] ? -2 : 2), ty = front[1] + dir;
    if (w.inb(tx, ty) && rnd() < 0.6 && !w.wall[w.idx(tx, ty)] && w.occ[w.idx(tx, ty)] < 0) addContainer(w, rnd, { type: 'trash', x: tx, y: ty, k: 0, v: 0 });
  }
  const by = L.door === 'S' ? y0 - 2 : y1 + 2;
  if (rnd() < 0.45) {
    const cx = ri(x0, x1);
    if (w.inb(cx, by) && !w.wall[w.idx(cx, by)] && w.occ[w.idx(cx, by)] < 0 && !isRoad(w.T(cx, by))) addContainer(w, rnd, { type: 'crate', x: cx, y: by, k: 0, v: 0 });
  }
  if (L.street && rnd() < 0.5) {
    const fy = L.door === 'S' ? y0 - 3 : y1 + 3;
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (!w.inb(x, fy) || w.wall[w.idx(x, fy)] || w.occ[w.idx(x, fy)] >= 0 || w.T(x, fy) === T.SIDEWALK || isRoad(w.T(x, fy))) continue;
      if (Math.abs(x - (x0 + x1) / 2) < 1) continue;
      w.L[0].wall[w.idx(x, fy)] = W.FENCE;
    }
  }
  return b;
}

function suburb(ctx, SUB_Y, SUB_X) {
  const { w, ri, reserved, res, blocked } = ctx;
  const streets = [];
  for (const y of SUB_Y) { streets.push({ y: y - 1, side: -1, x0: 41, x1: 157 }, { y: y + 3, side: 1, x0: 41, x1: 157 }); }
  const lots = [];
  for (const st of streets) {
    let x = st.x0 + ri(0, 2);
    while (x < st.x1 - 6) {
      const bw = ri(6, 9), bh = ri(6, 8);
      const y0 = st.side < 0 ? st.y - 2 - bh : st.y + 3;
      const y1 = y0 + bh - 1, x1 = x + bw - 1;
      if (x1 <= st.x1 && !blocked(x, y0, x1, y1, 1)) {
        lots.push({ x0: x, y0, x1, y1, door: st.side < 0 ? 'S' : 'N', street: st.y });
        res(x - 1, y0 - 1, x1 + 1, y1 + 1, 2);
        x = x1 + 3 + ri(0, 2);
      } else x += 2;
    }
  }
  for (const L of lots) makeHouse(ctx, L);
  // petit parc avec pompe et étang, à l'ouest
  const px = 30, py = 160;
  for (let y = py - 6; y <= py + 6; y++) for (let x = px - 9; x <= px + 9; x++) {
    const d = ((x - px) / 5.5) ** 2 + ((y - py) / 3.5) ** 2;
    if (d < 1) { ctx.set(x, y, T.WATER); }
    reserved[w.idx(x, y)] = 1;
  }
  w.addObj({ type: 'pump', x: px + 7, y: py - 4, k: 0, v: 0 });
  w.addObj({ type: 'bench', x: px - 2, y: py - 5, k: 0, v: 0 });
  w.addObj({ type: 'swing', x: px + 6, y: py + 3, k: 1, v: 0 });
  w.addObj({ type: 'sign', x: 39, y: 156, k: 0, v: 0 });
}

// ------------------------------------------------------------------ centre-ville

function tower(ctx, x0, y0, x1, y1, kind, floors, ext) {
  const { w, rnd, ri } = ctx;
  const b = makeBuilding(w, rnd, x0, y0, x1, y1, kind, { ext, int: kind === 'office' ? 2 : ri(0, 2), roof: 0 }, floors, 'flat');
  const H = y1 - y0, Wd = x1 - x0;
  // entrée double côté rue (sud), escalier au fond à gauche
  const door = doorOn(w, rnd, b, 'S', 0, (x0 + x1) >> 1, true);
  const sx = x0 + 1, sy = y0 + 1;
  stairwell(w, b, sx, sy);
  for (let l = 0; l < floors; l++) {
    windows(w, rnd, b, l ? 0.85 : 0.6, l);
    const base = l === 0 ? (kind === 'office' ? T.TILES : T.LINO) : kind === 'office' ? T.OFFICE : kind === 'hospital' ? T.LINO : T.PLANK;
    floorTile(w, l, x0 + 1, y0 + 1, x1 - 1, y1 - 1, base);
    if (l === 0) {
      // hall : comptoir d'accueil, plantes, distributeur
      const r = [x0 + 1, y0 + 1, x1 - 1, y1 - 1];
      if (kind === 'police') furnish(w, rnd, b, r, 'hall', door, 0, ['locker', 'locker', 'gunrack', 'desk', 'desk', 'filing', 'vending', 'locker']);
      else if (kind === 'hospital') furnish(w, rnd, b, r, 'hall', door, 0, ['counter', 'medcab', 'medcab', 'vending', 'armchair', 'armchair', 'planter']);
      else furnish(w, rnd, b, r, 'hall', door, 0, ['counter', 'vending', 'planter', 'planter', 'armchair', 'sofa']);
      continue;
    }
    const landing = [sx + ((l - 1) & 1), sy + 1];
    if (kind === 'apartment' && H >= 9) {
      // couloir de 2 au milieu, appartements de part et d'autre
      const yc = y0 + (H >> 1) - 1;
      const doorsN = [], doorsS = [];
      for (let x = x0 + 3; x < x1 - 2; x += ri(5, 7)) {
        const xe = Math.min(x1 - 1, x + 5);
        doorsN.push([x + 2, yc - 1]); doorsS.push([x + 2, yc + 2]);
        if (xe < x1 - 2) { partition(w, l, b, xe, y0 + 1, xe, yc - 2, []); partition(w, l, b, xe, yc + 3, xe, y1 - 1, []); }
      }
      partition(w, l, b, x0 + 3, yc - 1, x1 - 1, yc - 1, doorsN, W.DOORWAY);
      partition(w, l, b, x0 + 3, yc + 2, x1 - 1, yc + 2, doorsS, W.DOORWAY);
      floorTile(w, l, x0 + 1, yc, x1 - 1, yc + 1, T.CARPET);
      // chaque appartement : un studio meublé
      const units = [];
      let xa = x0 + 3;
      for (let x = x0 + 1; x <= x1 - 1; x++) {
        const lw = w.L[l].wall[w.idx(x, y0 + 1)];
        if (lw === W.WALL || x === x1 - 1) { if (x - xa >= 2) units.push([xa, x === x1 - 1 ? x : x - 1]); xa = x + 1; }
      }
      for (const [ua, ub] of units) {
        furnish(w, rnd, b, [ua, y0 + 1, ub, yc - 2], 'studio', landing, l);
        furnish(w, rnd, b, [ua, yc + 3, ub, y1 - 1], 'studio', landing, l);
      }
    } else if (kind === 'hospital') {
      furnish(w, rnd, b, [x0 + 1, y0 + 1, x1 - 1, y1 - 1], 'ward', landing, l, ['bed', 'bed', 'bed', 'medcab', 'bed', 'medcab', 'armchair', 'bed', 'medcab']);
    } else {
      // plateau de bureaux ouvert, une salle de réunion
      if (Wd >= 12) {
        const xm = x1 - 5;
        partition(w, l, b, xm, y0 + 1, xm, y0 + 5, [[xm, y0 + 3]]);
        partition(w, l, b, xm + 1, y0 + 5, x1 - 1, y0 + 5, []);
        furnish(w, rnd, b, [xm + 1, y0 + 1, x1 - 1, y0 + 4], 'meeting', landing, l, ['table', 'bookshelf']);
      }
      const list = [];
      for (let k = 0; k < Math.floor(Wd * H / 9); k++) list.push(k % 4 === 3 ? 'filing' : 'desk');
      list.push('vending', 'planter', 'bookshelf');
      furnish(w, rnd, b, [x0 + 1, y0 + 1, x1 - 1, y1 - 1], 'office', landing, l, list, kind === 'police' ? { desk: 'locker' } : null);
    }
  }
  return b;
}

function shop(ctx, x0, y0, x1, y1, kind, door = 'S') {
  const { w, rnd } = ctx;
  const ext = kind === 'gunstore' ? 5 : kind === 'diner' ? 3 : kind === 'warehouse' ? 9 : 6;
  const b = makeBuilding(w, rnd, x0, y0, x1, y1, kind, { ext, int: 0, roof: 3 }, 1, 'flat');
  floorTile(w, 0, x0 + 1, y0 + 1, x1 - 1, y1 - 1, kind === 'warehouse' ? T.CONCRETE : kind === 'diner' ? T.LINO : T.TILES);
  const d = doorOn(w, rnd, b, door, 0, door === 'S' || door === 'N' ? (x0 + x1) >> 1 : (y0 + y1) >> 1, kind !== 'warehouse');
  if (d && rnd() < 0.5) w.L[0].lock[w.idx(d[0], d[1])] = 1;
  windows(w, rnd, b, kind === 'warehouse' ? 0.15 : 0.85);
  const r = [x0 + 1, y0 + 1, x1 - 1, y1 - 1];
  if (kind === 'supermarket' || kind === 'pharmacy' || kind === 'hardware' || kind === 'gunstore' || kind === 'warehouse') {
    // rayons en colonnes, allées de 2 entre eux
    const item = kind === 'warehouse' || kind === 'hardware' ? 'rack' : 'shelf';
    const loot = kind === 'pharmacy' ? 'medcab' : kind === 'gunstore' ? 'gunrack' : kind === 'hardware' ? 'rack' : null;
    for (let x = x0 + 2; x <= x1 - 2; x += 3) for (let y = y0 + 2; y <= y1 - 3; y++) {
      if (w.canPlace(item, x, y, 3) && Math.abs(x - (d ? d[0] : -9)) > 1) addContainer(w, rnd, { type: item, x, y, k: 3, v: Math.floor(rnd() * 8) }, loot);
    }
    if (kind === 'supermarket') for (let x = x0 + 1; x < x1; x += 2) if (w.canPlace('fridge', x, y0 + 1, 0)) addContainer(w, rnd, { type: 'fridge', x, y: y0 + 1, k: 0, v: 0 });
    if (kind === 'gunstore') for (let y = y0 + 1; y < y1; y += 2) if (w.canPlace('gunrack', x1 - 1, y, 1)) addContainer(w, rnd, { type: 'gunrack', x: x1 - 1, y, k: 1, v: 0 });
    furnish(w, rnd, b, r, 'shop', d, 0, ['counter', 'counter', kind === 'warehouse' ? 'crate' : 'vending']);
  } else if (kind === 'diner') {
    furnish(w, rnd, b, r, 'diner', d, 0, ['counter', 'counter', 'fridge', 'stove', 'sink', 'table', 'table', 'table', 'vending']);
  }
  return b;
}

function downtown(ctx, AV, ST) {
  const { w, rnd, ri, res, set } = ctx;
  w.parkings = [];
  // îlots entre les rues (bords intérieurs des trottoirs)
  const xs = [[167, 183], [193, 209], [219, 235]], ys = [[61, 73], [83, 95], [105, 117]];
  const plan = [
    ['office', 'police', 'apartment'],
    ['plaza', 'office', 'hospital'],
    ['shops', 'apartment', 'parking'],
  ];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const [x0, x1] = xs[i], [y0, y1] = ys[j], kind = plan[j][i];
    res(x0, y0, x1, y1, 2);
    if (kind === 'office') {
      tower(ctx, x0 + 1, y0 + 1, x0 + 9, y1 - 1, 'office', ri(4, 7), 7);
      tower(ctx, x0 + 11, y0 + 3, x1 - 1, y1 - 1, 'office', ri(3, 5), 6);
    } else if (kind === 'apartment') {
      tower(ctx, x0 + 1, y0 + 1, x1 - 1, y1 - 2, 'apartment', ri(3, 5), pick5(rnd));
    } else if (kind === 'police') {
      tower(ctx, x0 + 1, y0 + 2, x1 - 1, y1 - 1, 'police', 2, 6);
    } else if (kind === 'hospital') {
      tower(ctx, x0 + 1, y0 + 1, x1 - 1, y1 - 1, 'hospital', 3, 6);
    } else if (kind === 'shops') {
      shop(ctx, x0 + 1, y0 + 4, x0 + 9, y1 - 1, 'gunstore');
      shop(ctx, x0 + 11, y0 + 4, x1 - 1, y0 + 12, 'pharmacy');
      for (let x = x0 + 1; x <= x1 - 1; x++) set(x, y1, T.SIDEWALK);
    } else if (kind === 'plaza') {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, T.COBBLE);
      // bassin au milieu, arbres en bacs, bancs
      const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 3; x++) set(x, y, T.WATER);
      for (const [x, y] of [[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x0 + 2, y1 - 2], [x1 - 2, y1 - 2], [cx, y0 + 2], [cx, y1 - 2]]) w.addObj({ type: 'planter', x, y, k: 0, v: 0 });
      for (const [x, y, k] of [[cx - 5, cy, 3], [cx + 5, cy, 1], [cx, cy - 4, 0], [cx, cy + 4, 2]]) w.addObj({ type: 'bench', x, y, k, v: 0 });
      w.addObj({ type: 'pump', x: x0 + 4, y: cy, k: 0, v: 0 });
    } else if (kind === 'parking') {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, (y - y0) % 6 === 5 ? T.ASPHALT : T.PARK);
      for (let y = y0; y + 2 <= y1; y += 6) w.parkings.push([x0, y, x1]);
    }
  }
  // supermarché et petit restaurant au nord des avenues
  res(167, 30, 245, 51, 2);
  shop(ctx, 168, 34, 188, 48, 'supermarket');
  shop(ctx, 194, 40, 204, 48, 'diner');
  shop(ctx, 210, 38, 222, 48, 'hardware');
  for (let x = 166; x <= 246; x++) set(x, 49, T.SIDEWALK), set(x, 50, T.SIDEWALK);
}
const pick5 = (rnd) => [5, 6, 3, 1][Math.floor(rnd() * 4)];

// ------------------------------------------------------------------ zone industrielle

function industrial(ctx) {
  const { w, rnd, ri, res, set } = ctx;
  for (const [x0, y0, x1, y1] of [[168, 130, 194, 156], [208, 130, 244, 156], [168, 167, 194, 196], [208, 167, 244, 196], [168, 206, 194, 230], [208, 206, 244, 230]]) {
    res(x0, y0, x1, y1, 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, T.GRAVEL);
    const bx1 = x0 + ri(14, x1 - x0 - 4), by1 = y0 + ri(9, y1 - y0 - 3);
    shop(ctx, x0 + 1, y0 + 1, bx1, by1, 'warehouse', 'S');
    for (let k = 0; k < 5; k++) { const x = ri(x0 + 1, x1 - 1), y = ri(by1 + 2, y1); if (w.canPlace('crate', x, y, 0)) addContainer(w, rnd, { type: 'crate', x, y, k: 0, v: 0 }); }
    w.parkings.push([x0 + 1, y1 - 2, Math.min(x1, x0 + 20)]);
  }
}

// ------------------------------------------------------------------ campagne

function countryside(ctx) {
  const { w, rnd, ri, res, set, blocked } = ctx;
  // fermes le long des chemins : maison, grange, champs clôturés
  const farms = [[104, 30], [104, 64], [104, 96], [30, 76], [184, 26], [222, 26], [70, 214], [36, 246], [110, 244], [140, 244]];
  for (const [fx, fy] of farms) {
    const hx = fx, hy = fy;
    if (blocked(hx, hy, hx + 7, hy + 6, 1)) continue;
    res(hx - 1, hy - 1, hx + 8, hy + 7, 2);
    makeHouse(ctx, { x0: hx, y0: hy, x1: hx + 7, y1: hy + 6, door: hy > 200 ? 'N' : 'S', kind: 'farm', style: { ext: ri(0, 4), int: ri(0, 2), roof: ri(0, 3) } });
    // grange
    const gx = hx + 10, gy = hy;
    if (!blocked(gx, gy, gx + 9, gy + 7, 1)) {
      res(gx - 1, gy - 1, gx + 10, gy + 8, 2);
      const b = makeBuilding(w, rnd, gx, gy, gx + 9, gy + 7, 'barn', { ext: 8, int: 0, roof: 1 });
      floorTile(w, 0, gx + 1, gy + 1, gx + 8, gy + 6, T.DIRT);
      const d = doorOn(w, rnd, b, gy > 200 ? 'N' : 'S', 0, gx + 4, true);
      windows(w, rnd, b, 0.15);
      furnish(w, rnd, b, [gx + 1, gy + 1, gx + 8, gy + 6], 'barn', d, 0, ['haybale', 'haybale', 'haybale', 'crate', 'crate', 'haybale', 'rack']);
    }
    // champs
    for (let k = 0; k < 2; k++) {
      const cx0 = fx - 2 + (k ? 0 : -18), cy0 = fy + (fy > 200 ? -16 : 10), cx1 = cx0 + ri(12, 16), cy1 = cy0 + ri(8, 11);
      if (blocked(cx0, cy0, cx1, cy1, 0)) continue;
      res(cx0 - 1, cy0 - 1, cx1 + 1, cy1 + 1, 2);
      for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) set(x, y, T.FIELD);
      for (let x = cx0 - 1; x <= cx1 + 1; x++) for (const y of [cy0 - 1, cy1 + 1]) if (Math.abs(x - cx0 - 2) > 1 && !w.L[0].wall[w.idx(x, y)]) w.L[0].wall[w.idx(x, y)] = W.FENCE;
      for (let y = cy0; y <= cy1; y++) for (const x of [cx0 - 1, cx1 + 1]) if (!w.L[0].wall[w.idx(x, y)]) w.L[0].wall[w.idx(x, y)] = W.FENCE;
    }
  }
  // cabane de chasse dans les bois (une carabine dans l'armoire)
  for (const [cx, cy] of [[20, 100], [240, 70], [12, 190]]) {
    if (blocked(cx, cy, cx + 5, cy + 5, 0)) continue;
    res(cx - 1, cy - 1, cx + 6, cy + 6, 2);
    makeHouse(ctx, { x0: cx, y0: cy, x1: cx + 5, y1: cy + 5, door: 'S', kind: 'cabin', style: { ext: 8, int: 0, roof: 1 }, loot: { wardrobe: 'gunrack', dresser: 'crate' } });
  }
  // maisons isolées
  for (let tries = 0, n = 0; tries < 300 && n < 14; tries++) {
    const bw = ri(6, 8), bh = ri(6, 7), x = ri(8, MAP - 16), y0 = ri(8, MAP - 16);
    if (!blocked(x, y0, x + bw - 1, y0 + bh - 1, 3)) {
      res(x - 1, y0 - 1, x + bw, y0 + bh, 2);
      makeHouse(ctx, { x0: x, y0, x1: x + bw - 1, y1: y0 + bh - 1, door: 'S', kind: 'house' });
      n++;
    }
  }
}

function gasStation(ctx, x0, y0, x1, y1) {
  const { w, rnd, res, set } = ctx;
  res(x0, y0, x1, y1, 2);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, T.CONCRETE);
  const b = shop(ctx, x0 + 1, y0 + 1, x0 + 6, y0 + 6, 'diner', 'E');
  b.kind = 'gas';
  for (const [x, y] of [[x0 + 8, y0 + 3], [x0 + 8, y0 + 7], [x0 + 10, y0 + 3], [x0 + 10, y0 + 7]]) w.addObj({ type: 'gaspump', x, y, k: 3, v: (x + y) & 1, fuel: 400 + Math.floor(rnd() * 600) });
  for (let y = y0; y <= y1; y++) set(x1, y, T.SIDEWALK);
}

export { makeStack };
