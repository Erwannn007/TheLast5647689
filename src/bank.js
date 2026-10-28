// Banque de sprites : cuits au chargement ou à la première demande, rangés dans les planches.
import { toSprite } from './gfx.js';
import { tileBuffer, bankBuffer, leafLitter, WATER_FRAMES, T } from './sprites/tiles.js';
import { treeFrames, bushFrames, rockSprite, grassFrames, reedFrames, shadowBuffer, SWAY_FRAMES } from './sprites/nature.js';
import { wallSprite, fenceSprite, roofSprite } from './sprites/build.js';
import { propSprite } from './sprites/props.js';
import { carSprite } from './sprites/cars.js';
import { bakePlayer } from './sprites/player.js';
import { iconBuffer, ICONS } from './sprites/icons.js';
import { makeBuffer } from './raster.js';
import { FIRE } from './palette.js';

export const TILE_VARIANTS = 4;
const cache = new Map();
const memo = (key, f) => { let s = cache.get(key); if (!s) { s = f(); cache.set(key, s); } return s; };

export const S = { tiles: [], water: [], banks: [], litter: [], player: null, icons: {}, shadows: {}, flames: [] };

// Cuisson de base (sols, personnage, icônes, flammes) ; le reste se cuit à la demande.
export function bakeBase() {
  for (const t of Object.values(T)) {
    if (t === T.WATER) continue;
    S.tiles[t] = Array.from({ length: TILE_VARIANTS }, (_, v) => toSprite(tileBuffer(t, v)));
  }
  for (let f = 0; f < WATER_FRAMES; f++) S.water.push(Array.from({ length: 2 }, (_, v) => toSprite(tileBuffer(T.WATER, v, f))));
  for (let s = 0; s < 4; s++) S.banks.push(toSprite(bankBuffer(s)));
  for (let v = 0; v < 4; v++) S.litter.push(toSprite(leafLitter(v)));
  const p = bakePlayer();
  // [jambes][torsion][image]
  const bake3 = (A) => A.map((d) => d.map((t) => t.map(toSprite)));
  S.player = { walk: bake3(p.walk), idle: bake3(p.idle), act: bake3(p.act) };
  for (const id of Object.keys(ICONS)) S.icons[id] = toSprite(iconBuffer(id));
  S.shadows.small = toSprite(shadowBuffer(6, 3));
  S.shadows.tree = toSprite(shadowBuffer(11, 5));
  S.shadows.player = toSprite(shadowBuffer(5, 2));
  for (let f = 0; f < 4; f++) S.flames.push(toSprite(flameBuffer(f)));
}

export const tree = (kind, pal, seed, f) => memo(`t${kind}${pal}${seed % 6}`, () => treeFrames(kind, seed % 6, pal).map(toSprite))[f % SWAY_FRAMES];
export const bush = (v, berries, f) => memo(`b${v}${berries}`, () => bushFrames(v, berries).map(toSprite))[f & 1];
export const rock = (v) => memo(`r${v}`, () => toSprite(rockSprite(v)));
export const grass = (v, f) => memo(`g${v}`, () => grassFrames(v).map(toSprite))[f % 3];
export const reed = (v, f) => memo(`d${v}`, () => reedFrames(v).map(toSprite))[f % 3];
export const prop = (name, k, v) => memo(`p${name}${k}${v}`, () => toSprite(propSprite(name, k, v).img));
export const wall = (mask, kind, style, intU, intV, cut) =>
  memo(`w${mask}${kind}${style.ext}${style.int}${intU}${intV}${cut}`, () => toSprite(wallSprite(mask, kind, style, intU, intV, cut).img));
export const car = (v, k) => memo(`c${v}_${k}`, () => toSprite(carSprite(v, k).img));
export const fence = (mask) => memo(`f${mask}`, () => toSprite(fenceSprite(mask).img));
export const roof = (b) => memo(`roof${b.id}`, () => toSprite(roofSprite(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, b.style, b.seed).img));
export const icon = (id) => S.icons[id];

// Flamme pixel (3-4 tons du feu), 4 images.
function flameBuffer(f) {
  const b = makeBuffer(14, 18);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 14; x++) {
    const t = y / 17, dx = (x + 0.5 - 7) / 6;
    let w = Math.pow(t, 0.8) * 0.95;
    if (t > 0.85) w *= 1 - (t - 0.85) * 3;
    const wob = (Math.sin(y * 0.8 + f * 1.6) * 0.16 + Math.sin(y * 0.35 - f * 2.1) * 0.08) * (1 - t);
    const d = Math.abs(dx - wob);
    if (d > w) continue;
    const hot = (1 - d / w) * (0.35 + t * 0.75);
    b.set(x, y, FIRE[hot > 0.75 ? 4 : hot > 0.5 ? 3 : hot > 0.3 ? 2 : hot > 0.15 ? 1 : 0]);
  }
  return Object.assign(b, { ox: 7, oy: 16 });
}
