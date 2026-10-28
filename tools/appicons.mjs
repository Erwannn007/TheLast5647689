// Génère les icônes d'écran d'accueil : le survivant, de dos, face au soleil couchant.
// node tools/appicons.mjs -> icons/icon-180.png, icon-192.png, icon-512.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { encodePNG } from './sheet.mjs';
import { bakePlayer } from '../src/sprites/player.js';
import { hex } from '../src/raster.js';

const N = 32;
const img = new Uint8ClampedArray(N * N * 4);
const set = (x, y, c) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const o = (y * N + x) * 4; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255; };
const sky = ['#1e1a30', '#2e2640', '#4a3450', '#6e4456', '#a05a52', '#d07c56', '#eaa262'].map(hex);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const t = y / 24 * (sky.length - 1) + BAYER[(y & 3) * 4 + (x & 3)] * 0.9;
  set(x, y, sky[Math.max(0, Math.min(sky.length - 1, Math.floor(t)))]);
}
// soleil bas et sol sombre avec quelques herbes
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - 22, y - 23) < 4.5) set(x, y, hex('#f6d48a'));
const ground = ['#1a1a1e', '#24222a', '#2e2a30'].map(hex);
for (let x = 0; x < N; x++) {
  const h = 24 + Math.round(Math.sin(x * 0.4) * 0.8);
  for (let y = h; y < N; y++) set(x, y, ground[Math.min(2, y - h)]);
  if ((x * 7) % 5 === 0) set(x, h - 1, ground[1]);
}
// le survivant de dos
const spr = bakePlayer(false).idle[4][0];
for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
  const o = (y * spr.w + x) * 4;
  if (spr.data[o + 3]) set(x - spr.ox + 11, y - spr.oy + 29, [spr.data[o], spr.data[o + 1], spr.data[o + 2]]);
}
mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const size of [180, 192, 512]) {
  const k = size / N;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = (Math.floor(y / k) * N + Math.floor(x / k)) * 4, d = (y * size + x) * 4;
    out[d] = img[s]; out[d + 1] = img[s + 1]; out[d + 2] = img[s + 2]; out[d + 3] = 255;
  }
  writeFileSync(new URL(`../icons/icon-${size}.png`, import.meta.url), encodePNG(size, size, out));
}
console.log('icônes écrites');
