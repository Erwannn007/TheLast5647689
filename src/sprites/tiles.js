// Tuiles de sol isométriques (losange 32x16, monde plat) : un dessus en 4 tons + grain hash.
import { makeBuffer, hash, hex } from '../raster.js';
import { GROUND, ROAD_PAINT, ROAD_WHITE, CROPS } from '../palette.js';

export const T = {
  GRASS: 0, DRY: 1, FOREST: 2, DIRT: 3, PATH: 4, ASPHALT: 5, SIDEWALK: 6, PLANK: 7, LINO: 8,
  TILES: 9, CARPET: 10, SAND: 11, WATER: 12, ROAD_LX: 13, ROAD_LY: 14, PARK: 15,
  FIELD: 16, ROOF: 17, COBBLE: 18, GRAVEL: 19, OFFICE: 20, CONCRETE: 21,
};
export const TILE_W = 32, TILE_H = 16;
export const WATER_FRAMES = 4;

const RAMP = {
  [T.GRASS]: GROUND.grass, [T.DRY]: GROUND.dry, [T.FOREST]: GROUND.forest, [T.DIRT]: GROUND.dirt,
  [T.PATH]: GROUND.path, [T.ASPHALT]: GROUND.asphalt, [T.SIDEWALK]: GROUND.sidewalk, [T.PLANK]: GROUND.plank,
  [T.LINO]: GROUND.lino, [T.TILES]: GROUND.tiles, [T.CARPET]: GROUND.carpet, [T.SAND]: GROUND.sand,
  [T.WATER]: GROUND.water, [T.ROAD_LX]: GROUND.asphalt, [T.ROAD_LY]: GROUND.asphalt, [T.PARK]: GROUND.asphalt,
  [T.FIELD]: GROUND.field, [T.ROOF]: GROUND.roof, [T.COBBLE]: GROUND.cobble, [T.GRAVEL]: GROUND.gravel,
  [T.OFFICE]: GROUND.office, [T.CONCRETE]: GROUND.concrete,
};
export const isWater = (t) => t === T.WATER;
export const isRoad = (t) => t === T.ASPHALT || t === T.ROAD_LX || t === T.ROAD_LY || t === T.PARK;
export const isFloor = (t) => t === T.PLANK || t === T.LINO || t === T.TILES || t === T.CARPET || t === T.OFFICE || t === T.CONCRETE;
export const isSoft = (t) => t === T.GRASS || t === T.DRY || t === T.FOREST || t === T.DIRT || t === T.PATH || t === T.SAND || t === T.FIELD;

// Largeur de la ligne r du losange (0..15) : de 14-2r à 17+2r.
export function rowSpan(r) {
  const rr = r < 8 ? r : 15 - r;
  return [14 - 2 * rr, 17 + 2 * rr];
}

// Parcourt le losange ; f reçoit (x, y, u, v) avec u, v en unités monde (-8..8) depuis le centre.
function eachPixel(f) {
  for (let r = 0; r < 16; r++) {
    const [x0, x1] = rowSpan(r);
    for (let x = x0; x <= x1; x++) {
      const sx = x + 0.5 - 16, sy = r + 0.5 - 8;
      f(x, r, sy + sx / 2, sy - sx / 2);
    }
  }
}

export function tileBuffer(type, v, frame = 0) {
  const b = makeBuffer(TILE_W, TILE_H);
  const top = RAMP[type];
  const seed = type * 31 + v * 7;
  const grassy = type === T.GRASS || type === T.DRY || type === T.FOREST;
  eachPixel((x, r, u, w) => {
    const h = hash(x, r, seed);
    let s = 1;
    if (h < 0.13) s = 0; else if (h > 0.88) s = 2;
    if (grassy) {
      if (h > 0.972) { s = 3; b.set(x, r + 1, top[0]); }
      // touffes : de petites taches plus sombres, cassées par le hash
      if (hash(x >> 2, r >> 1, seed + 5) < 0.18 && h < 0.5) s = 0;
      if (type === T.GRASS && hash(x, r, seed + 9) > 0.975) { b.set(x, r, GROUND.dry[2]); return; }
    }
    if (type === T.DIRT) { if (h > 0.9) { s = 3; b.set(x, r + 1, top[0]); } else if (h < 0.22) s = 0; }
    if (type === T.PATH && h > 0.975) { s = 3; b.set(x + 1, r, GROUND.sidewalk[2]); }
    if (type === T.SAND && h > 0.95) s = 3;
    if (type === T.ASPHALT || type === T.ROAD_LX || type === T.ROAD_LY || type === T.PARK) {
      s = h < 0.1 ? 0 : h > 0.93 ? 2 : 1;
      if (hash(x >> 1, r >> 1, seed + 3) < 0.06) s = 2; // gravillons
      // fissures : un trait sombre en zigzag sur certaines variantes
      if (v % 4 === 1 && Math.abs(u * 0.6 + Math.sin(w * 0.9) * 1.5 - 1) < 0.45) s = 0;
    }
    if (type === T.ROAD_LX && Math.abs(w) < 0.9 && ((u + 8) % 8) < 4.5) { b.set(x, r, ROAD_PAINT[h < 0.2 ? 1 : 2]); return; }
    if (type === T.ROAD_LY && Math.abs(u) < 0.9 && ((w + 8) % 8) < 4.5) { b.set(x, r, ROAD_PAINT[h < 0.2 ? 1 : 2]); return; }
    if (type === T.PARK && Math.abs(u + 7) < 0.8) { b.set(x, r, ROAD_WHITE[h < 0.25 ? 1 : 2]); return; }
    if (type === T.SIDEWALK) {
      // dalles de béton 8x8 avec joints
      const ju = ((u + 8) % 8 + 8) % 8, jw = ((w + 8) % 8 + 8) % 8;
      s = ju < 0.7 || jw < 0.7 ? 0 : h < 0.1 ? 1 : h > 0.9 ? 3 : 2;
    }
    if (type === T.PLANK) {
      // lames de plancher le long de u
      const lane = Math.floor((w + 8) / 4);
      const off = (lane * 5) % 8;
      const along = ((u + 8 + off) % 16 + 16) % 16;
      s = ((w + 8) % 4) < 0.8 || along < 0.6 ? 0 : h < 0.15 ? 1 : h > 0.93 ? 3 : 2;
    }
    if (type === T.LINO) {
      const c = (Math.floor((u + 8) / 4) + Math.floor((w + 8) / 4)) & 1;
      s = c ? 2 : 1;
      if (h < 0.08) s--; else if (h > 0.95) s++;
    }
    if (type === T.TILES) {
      const ju = ((u + 8) % 4 + 4) % 4, jw = ((w + 8) % 4 + 4) % 4;
      s = ju < 0.6 || jw < 0.6 ? 1 : h < 0.06 ? 1 : 2;
      if (h > 0.97) s = 3;
    }
    if (type === T.CARPET) s = h < 0.25 ? 0 : h > 0.9 ? 2 : 1;
    if (type === T.OFFICE) { const q = ((Math.floor((u + 8) / 8) + Math.floor((w + 8) / 8)) & 1); s = (h < 0.2 ? 0 : 1) + q; }
    if (type === T.CONCRETE) { const ju = ((u + 8) % 16 + 16) % 16; s = ju < 0.6 ? 0 : h < 0.1 ? 1 : h > 0.92 ? 3 : 2; }
    if (type === T.ROOF) { s = h < 0.18 ? 0 : h > 0.9 ? 2 : 1; if (hash(x >> 1, r, seed + 4) > 0.97) s = 3; }
    if (type === T.GRAVEL) { s = h < 0.22 ? 0 : h > 0.8 ? 2 : 1; if (h > 0.96) s = 3; }
    if (type === T.COBBLE) {
      // pavés : rangées décalées de 4x4, joints sombres
      const row = Math.floor((w + 8) / 4), ju = ((u + 8 + (row & 1) * 2) % 4 + 4) % 4, jw = ((w + 8) % 4 + 4) % 4;
      s = ju < 0.7 || jw < 0.7 ? 0 : h < 0.15 ? 1 : h > 0.85 ? 3 : 2;
    }
    if (type === T.FIELD) {
      // sillons le long de u, chaumes secs sur les crêtes
      const f = ((w + 8) % 4 + 4) % 4;
      s = f < 1.3 ? 0 : f < 2.2 ? 1 : 2;
      if (h > 0.93) s = 3;
      if (f > 2.4 && f < 3.4 && hash(x, r >> 1, seed + 2) < 0.22) { b.set(x, r, CROPS[h > 0.5 ? 2 : 1]); if (r > 0) b.set(x, r - 1, CROPS[3]); return; }
    }
    if (type === T.WATER) {
      s = 1;
      const ph = frame / WATER_FRAMES * Math.PI * 2;
      const wave = Math.sin(u * 0.7 + w * 0.25 + ph + v) + Math.sin(w * 0.9 - ph);
      if (wave > 1.45) s = 2;
      if (wave > 1.85 && h > 0.5) s = 3;
      if (h < 0.06) s = 0;
    }
    b.set(x, r, top[Math.max(0, Math.min(3, s))]);
  });
  // liseré haut clair, très léger, pour lire la grille sur le béton et le plancher
  return Object.assign(b, { ox: 16, oy: 0 });
}

// Berges : bord de terre sur les arêtes hautes d'une tuile d'eau voisine de la terre, écume en bas.
// side : 0 = arête haut-gauche (voisin x-1), 1 = haut-droite (y-1), 2 = bas-droite (x+1), 3 = bas-gauche (y+1)
export function bankBuffer(side) {
  const b = makeBuffer(TILE_W, TILE_H);
  const earth = GROUND.dirt, foam = hex('#c8dade'), foam2 = hex('#8fb4be');
  eachPixel((x, r, u, w) => {
    const d = side === 0 ? u + 8 : side === 1 ? w + 8 : side === 2 ? 8 - u : 8 - w;
    const h = hash(x, r, 77 + side);
    if (side < 2) {
      if (d < 1.6 + h * 0.8) b.set(x, r, earth[d < 0.8 ? 2 : 1]);
      else if (d < 2.6 && h > 0.5) b.set(x, r, earth[0]);
    } else if (d < 1.2 && h > 0.35) b.set(x, r, h > 0.8 ? foam : foam2);
  });
  return Object.assign(b, { ox: 16, oy: 0 });
}

// Feuilles mortes au sol (décal plat), quelques taches rousses.
export function leafLitter(v) {
  const b = makeBuffer(TILE_W, TILE_H);
  const cols = ['#b9602a', '#9e362e', '#bb9330', '#873e16', '#dd9048'].map(hex);
  const n = 7 + ((hash(v, 3, 9) * 6) | 0);
  for (let i = 0; i < n; i++) {
    const r = 2 + ((hash(i, v, 1) * 12) | 0), [x0, x1] = rowSpan(r);
    const x = x0 + 1 + ((hash(i, v, 2) * (x1 - x0 - 2)) | 0);
    const c = cols[(hash(i, v, 3) * cols.length) | 0];
    b.set(x, r, c);
    if (hash(i, v, 4) > 0.4) b.set(x + 1, r, c);
  }
  return Object.assign(b, { ox: 16, oy: 0 });
}
