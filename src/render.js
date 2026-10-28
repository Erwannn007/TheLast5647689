// Dessin du monde : sol, objets triés par profondeur, coupe des murs, toits, lumière, pluie, feuilles.
import { ctx, view, draw, drawCols } from './gfx.js';
import * as B from './bank.js';
import { G, hour, holding, held } from './state.js';
import { W, MAP } from './world.js';
import { T, isWater, isFloor } from './sprites/tiles.js';
import { BIG } from './sprites/props.js';
import { hash } from './raster.js';
import { facingVec, litFires } from './game.js';

const WALLKIND = { [W.WALL]: 'wall', [W.WINDOW]: 'window', [W.BROKEN]: 'broken', [W.DOOR]: 'door', [W.OPEN]: 'open', [W.DOORWAY]: 'doorway' };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
let ox = 0, oy = 0;
export const isoX = (x, y) => (x - y) * 16 + ox;
export const isoY = (x, y) => (x + y) * 8 + oy;

// ---------------------------------------------------------------- particules
const drops = [], splashes = [], leaves = [];

export function renderWorld(dt, focus, showPlayer) {
  const w = G.world, p = G.p;
  const { W: VW, H: VH } = view;
  ox = Math.round(VW / 2 - (focus[0] - focus[1]) * 16);
  oy = Math.round(VH / 2 - (focus[0] + focus[1]) * 8 + 12);
  ctx.fillStyle = '#1a2216';
  ctx.fillRect(0, 0, VW, VH);

  const pb = showPlayer ? w.inside(p.x, p.y) : -1;
  const pcx = Math.floor(p ? p.x : 0), pcy = Math.floor(p ? p.y : 0);
  const dmin = Math.floor((-24 - oy) / 8) - 1, dmaxG = Math.ceil((VH - oy) / 8) + 1, dmaxO = Math.ceil((VH + 110 - oy) / 8);
  const xr = (d, m) => [Math.floor(((-m - ox) / 16 + d) / 2), Math.ceil(((VW + m - ox) / 16 + d) / 2)];
  const sway4 = (ph, k) => Math.floor(G.swayT * k + ph) & 3;

  // --- sol
  const wf = Math.floor(G.clock * 3);
  for (let d = dmin; d <= dmaxG; d++) {
    const [xa, xb] = xr(d, 20);
    for (let x = xa; x <= xb; x++) {
      const y = d - x, X = isoX(x, y), Y = isoY(x, y);
      if (!w.inb(x, y)) { draw(B.S.tiles[T.FOREST][(hash(x, y, 1) * 4) | 0], X, Y); continue; }
      const i = w.idx(x, y), t = w.tile[i];
      if (isWater(t)) {
        draw(B.S.water[(wf + ((x * 3 + y * 5) & 3)) & 3][(x + y) & 1], X, Y);
        if (!isWater(w.T(x - 1, y))) draw(B.S.banks[0], X, Y);
        if (!isWater(w.T(x, y - 1))) draw(B.S.banks[1], X, Y);
        if (!isWater(w.T(x + 1, y))) draw(B.S.banks[2], X, Y);
        if (!isWater(w.T(x, y + 1))) draw(B.S.banks[3], X, Y);
        continue;
      }
      draw(B.S.tiles[t][(hash(x, y, 1) * 4) | 0], X, Y);
      if (w.litter[i] && !isFloor(t)) draw(B.S.litter[w.litter[i] - 1], X, Y);
      const o = w.occ[i] >= 0 ? w.objs[w.occ[i]] : null;
      if (o && o.type === 'tree' && o.x === x && o.y === y) draw(B.S.shadows.tree, X + 2, Y + 9);
    }
  }
  if (showPlayer && !p.sleeping) draw(B.S.shadows.player, Math.round(isoX(p.x, p.y)), Math.round(isoY(p.x, p.y)));

  // --- objets
  const list = [];
  const P = showPlayer ? p.x + p.y : -1e9;
  for (let d = dmin; d <= dmaxO; d++) {
    const [xa, xb] = xr(d, 40);
    for (let x = xa; x <= xb; x++) {
      const y = d - x;
      if (!w.inb(x, y)) {
        // forêt au-delà du bord de la carte
        if (hash(x, y, 77) < 0.42) list.push({ d: d + 1, kind: 'edge', x, y });
        continue;
      }
      const i = w.idx(x, y);
      const k = w.wall[i];
      if (k) {
        const bi = w.wbld[i], b = bi >= 0 ? w.blds[bi] : null;
        const border = b && (x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1);
        if (b && !border && bi !== pb) { /* cloison sous le toit */ }
        else {
          let dd = d + 1;
          if (showPlayer && Math.abs(x + 0.5 - p.x) < 1.6 && Math.abs(y + 0.5 - p.y) < 1.6) {
            // devant ou derrière un mur fin : on compare sur l'axe du mur
            const m = w.mask(x, y), cx = x + 0.5, cy = y + 0.5;
            const front = (m & 3) && !(m & 12) ? p.y > cy : (m & 12) && !(m & 3) ? p.x > cx : p.x + p.y > cx + cy;
            dd = front ? Math.min(dd, P - 0.01) : Math.max(dd, P + 0.01);
          }
          const cut = b && bi === pb && (x === b.x1 || y === b.y1 || (!border && x + y > pcx + pcy));
          list.push({ d: dd, kind: 'wall', x, y, k, b, cut });
        }
      }
      const oi = w.occ[i];
      if (oi >= 0) {
        const o = w.objs[oi];
        if (o.x !== x || o.y !== y) continue;
        const r = w.room[i];
        if (r >= 0 && r !== pb) continue; // intérieur caché sous le toit
        if (BIG[o.type]) list.push(...strips(o, () => bigSprite(o), o.cells, d));
        else list.push({ d: d + 1, kind: 'obj', o, x, y });
      }
    }
  }
  // toits (sauf celui de la maison où l'on se trouve), découpés en colonnes
  for (const b of w.blds) {
    if (b.id === pb) continue;
    const X = isoX(b.x0, b.y0), Y = isoY(b.x0, b.y0);
    if (X > VW + 200 || X < -400 || Y < -120 || Y > VH + 260) continue;
    list.push(...roofStrips(b));
  }
  if (showPlayer && !p.sleeping) list.push({ d: P, kind: 'player' });
  list.sort((a, b) => a.d - b.d);

  for (const it of list) {
    if (it.kind === 'wall') drawWall(it);
    else if (it.kind === 'obj') drawObj(it.o, it.x, it.y);
    else if (it.kind === 'strip') drawCols(it.spr, it.X, it.Y, it.c0, it.c1);
    else if (it.kind === 'player') drawPlayer(1);
    else if (it.kind === 'edge') {
      const X = isoX(it.x + 0.5, it.y + 0.5), Y = isoY(it.x + 0.5, it.y + 0.5);
      const s = (hash(it.x, it.y, 5) * 1000) | 0;
      draw(B.tree(hash(it.x, it.y, 6) < 0.6 ? 'pine' : 'oak', 'olive', s, sway4(s % 7 * 0.37, 1.3)), X, Y);
    }
  }
  // fantôme du joueur : visible même derrière un décor
  if (showPlayer && !p.sleeping) { ctx.globalAlpha = 0.28; drawPlayer(0); ctx.globalAlpha = 1; }
  if (showPlayer && p.act && p.act.kind === 'fish') drawBobber(p.act.at);

  updateParticles(dt);
  drawParticles();
  lighting(showPlayer);
  drawFlames(true);
}

function bigSprite(o) {
  return B.prop(o.type, o.k, o.v % 4);
}
// bandes de 16 px : chacune prend la profondeur de la case la plus avancée de sa colonne
function strips(o, sprf, cells, d) {
  const spr = sprf(), X = isoX(o.x + 0.5, o.y + 0.5), Y = isoY(o.x + 0.5, o.y + 0.5);
  const depthOf = (c) => {
    let best = -1e9;
    for (const [i, j] of cells) if (i - j === c || i - j === c + 1) best = Math.max(best, i + j + 1);
    return best;
  };
  const ks = cells.map(([i, j]) => i - j);
  const kmin = Math.min(...ks) - 1, kmax = Math.max(...ks);
  const left = X - spr.ox, right = left + spr.w;
  const out = [];
  for (let k = Math.floor((left - ox) / 16); k * 16 + ox < right; k++) {
    const kk = Math.max(kmin, Math.min(kmax, k));
    let dd = depthOf(kk);
    if (dd < -1e8) dd = d + 1;
    out.push({ d: dd + 0.3, kind: 'strip', spr, X, Y, c0: k * 16 + ox, c1: (k + 1) * 16 + ox });
  }
  return out;
}
function roofStrips(b) {
  const spr = B.roof(b), X = isoX(b.x0, b.y0), Y = isoY(b.x0, b.y0);
  const cmin = b.x0 - b.y1, cmax = b.x1 - b.y0;
  const depthOf = (c) => { c = Math.max(cmin, Math.min(cmax, c)); return 2 * Math.min(b.x1, b.y1 + c) - c + 1; };
  const left = X - spr.ox, right = left + spr.w;
  const out = [];
  for (let k = Math.floor((left - ox) / 16); k * 16 + ox < right; k++) {
    out.push({ d: Math.max(depthOf(k), depthOf(k + 1)) + 0.6, kind: 'strip', spr, X, Y, c0: k * 16 + ox, c1: (k + 1) * 16 + ox });
  }
  return out;
}

function drawWall(it) {
  const { x, y, k, b, cut } = it;
  const X = isoX(x + 0.5, y + 0.5), Y = isoY(x + 0.5, y + 0.5);
  const w = G.world, m = w.mask(x, y);
  if (k === W.FENCE) { draw(B.fence(m), X, Y); return; }
  const style = b ? b.style : { ext: 0, int: 0 };
  const intU = b && x < b.x1 ? 1 : 0, intV = b && y < b.y1 ? 1 : 0;
  draw(B.wall(m, WALLKIND[k], style, intU, intV, cut ? 1 : 0), X, Y);
}

function drawObj(o, x, y) {
  const X = isoX(x + 0.5, y + 0.5), Y = isoY(x + 0.5, y + 0.5);
  const ph = ((o.seed || x * 7 + y * 13) % 7) * 0.37;
  switch (o.type) {
    case 'tree': draw(B.tree(o.kind, o.pal || 'green', o.seed, Math.floor(G.swayT * 1.3 + ph) & 3), X, Y); break;
    case 'bush': draw(B.bush(o.v, false, Math.floor(G.swayT * 1.1 + ph) & 1), X, Y); break;
    case 'berry': draw(B.bush(o.v + 3, (o.regrow || 0) <= G.time, Math.floor(G.swayT * 1.1 + ph) & 1), X, Y); break;
    case 'rock': draw(B.rock(o.v), X, Y); break;
    case 'grass': draw(B.grass(o.v, Math.floor(G.swayT * 1.8 + ph) % 3), X, Y); break;
    case 'reed': draw(B.reed(o.v, Math.floor(G.swayT * 1.5 + ph) % 3), X, Y); break;
    default: draw(B.prop(o.type, o.k, o.v % 4), X, Y);
  }
  if (o.type === 'campfire' && o.fire.lit) draw(B.S.flames[Math.floor(G.clock * 8 + x) & 3], X, Y + 1);
}

function drawPlayer(full) {
  const p = G.p, S = B.S.player;
  let spr;
  if (p.act && p.act.anim === 'act') spr = S.act[p.dir][Math.floor(p.act.t * 5) & 3];
  else if (p.moving) spr = S.walk[p.dir][Math.floor(p.anim * 8) & 7];
  else spr = S.idle[p.dir][Math.floor(G.clock * 1.4) & 3];
  draw(spr, Math.round(isoX(p.x, p.y)), Math.round(isoY(p.x, p.y)) + (p.sitting ? 3 : 0));
}

function drawBobber(at) {
  const X = Math.round(isoX(at[0], at[1])), Y = Math.round(isoY(at[0], at[1]));
  const bob = Math.floor(G.clock * 2) & 1;
  const r = 2 + (Math.floor(G.clock * 3) % 4);
  ctx.fillStyle = 'rgba(220,240,250,0.45)';
  ctx.fillRect(X - r, Y + 1, 1, 1); ctx.fillRect(X + r, Y + 1, 1, 1); ctx.fillRect(X - 1, Y + 1 - (r >> 1), 1, 1); ctx.fillRect(X, Y + 1 + (r >> 1), 1, 1);
  ctx.fillStyle = '#e8e4d8'; ctx.fillRect(X, Y - 1 + bob, 1, 1);
  ctx.fillStyle = '#c8281e'; ctx.fillRect(X, Y - 2 + bob, 1, 1);
}

// ---------------------------------------------------------------- pluie et feuilles
function updateParticles(dt) {
  const { W: VW, H: VH } = view, rain = G.weather.rain;
  const want = Math.floor(rain * 220);
  while (drops.length < want) drops.push({ x: Math.random() * (VW + 40), y: Math.random() * VH - VH, v: 220 + Math.random() * 80, end: Math.random() * VH });
  if (drops.length > want) drops.length = want;
  for (const d of drops) {
    d.y += d.v * dt; d.x -= d.v * dt * 0.18;
    if (d.y > d.end) {
      if (splashes.length < 80) splashes.push({ x: d.x, y: d.y, t: 0.18 });
      d.y = -10 - Math.random() * 40; d.x = Math.random() * (VW + 40); d.end = Math.random() * VH;
    }
  }
  for (const s of splashes) s.t -= dt;
  for (let i = splashes.length - 1; i >= 0; i--) if (splashes[i].t <= 0) splashes.splice(i, 1);
  // feuilles qui tombent des feuillus visibles (coordonnées monde-écran, sans la caméra)
  if (Math.random() < dt * 1.2 && leaves.length < 30) {
    const w = G.world;
    for (let tries = 0; tries < 6; tries++) {
      const sx = Math.random() * VW, sy = Math.random() * VH;
      const wx = Math.floor(((sx - ox) / 16 + (sy - oy) / 8) / 2), wy = Math.floor(((sy - oy) / 8 - (sx - ox) / 16) / 2);
      const o = w.obj(wx, wy);
      if (o && o.type === 'tree' && (o.kind === 'oak' || o.kind === 'birch')) {
        const cols = { orange: '#c0622a', red: '#9e362e', yellow: '#c49a2e', green: '#577a3c', olive: '#6e7a30' };
        leaves.push({ x: isoX(wx + 0.5, wy + 0.5) - ox + (Math.random() - 0.5) * 20, y: isoY(wx + 0.5, wy + 0.5) - oy - 30 - Math.random() * 14, ground: isoY(wx + 0.5, wy + 0.5) - oy + Math.random() * 10, c: cols[o.pal] || cols.orange, ph: Math.random() * 6, t: 0 });
        break;
      }
    }
  }
  for (const l of leaves) {
    l.t += dt;
    if (l.y < l.ground) { l.y += dt * 9; l.x += Math.sin(l.t * 2.2 + l.ph) * dt * 14 - dt * 3; }
    else l.rest = (l.rest || 0) + dt;
  }
  for (let i = leaves.length - 1; i >= 0; i--) if (leaves[i].rest > 6) leaves.splice(i, 1);
}
function drawParticles() {
  for (const l of leaves) {
    ctx.fillStyle = l.c;
    const x = Math.round(l.x + ox), y = Math.round(l.y + oy);
    ctx.fillRect(x, y, 1, 1);
    if (!l.rest && (Math.floor(l.t * 4) & 1)) ctx.fillRect(x + 1, y, 1, 1);
    else if (l.rest) ctx.fillRect(x + 1, y, 1, 1);
  }
  if (!drops.length) return;
  const inside = G.p && G.mode === 'play' && G.world.inside(G.p.x, G.p.y) >= 0;
  ctx.fillStyle = inside ? 'rgba(160,180,205,0.25)' : 'rgba(170,190,215,0.5)';
  for (const d of drops) {
    const x = Math.round(d.x), y = Math.round(d.y);
    ctx.fillRect(x, y, 1, 1); ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x - 1, y + 2, 1, 1); ctx.fillRect(x - 1, y + 3, 1, 1);
  }
  ctx.fillStyle = 'rgba(200,215,230,0.5)';
  for (const s of splashes) {
    const x = Math.round(s.x), y = Math.round(s.y);
    if (s.t > 0.09) ctx.fillRect(x, y, 1, 1);
    else { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); }
  }
}

// ---------------------------------------------------------------- lumière
const lc = document.createElement('canvas');
const lx = lc.getContext('2d');
let limg = null;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// couleur ambiante selon l'heure : journée douce et un peu dorée, nuit bleue
const KEYS = [
  [0, [46, 54, 104]], [4.5, [46, 54, 104]], [6, [170, 140, 160]], [7.5, [255, 232, 214]], [10, [255, 248, 236]],
  [16, [255, 244, 228]], [18, [255, 206, 160]], [19.5, [190, 130, 140]], [21, [64, 70, 128]], [24, [46, 54, 104]],
];
export function ambient() {
  const h = hour();
  let c = KEYS[0][1];
  for (let i = 0; i < KEYS.length - 1; i++) if (h >= KEYS[i][0] && h < KEYS[i + 1][0]) c = mix(KEYS[i][1], KEYS[i + 1][1], (h - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]));
  const r = G.weather.rain;
  return mix(c, [c[0] * 0.7, c[1] * 0.74, c[2] * 0.8], r);
}

function lighting(showPlayer) {
  const { W: VW, H: VH } = view;
  const amb = ambient();
  const dark = 1 - (amb[0] + amb[1] + amb[2]) / (3 * 255);
  const sources = [];
  if (showPlayer && dark > 0.25) {
    const p = G.p, h = held();
    if (h && h.id === 'lampe' && h.d > 0) {
      const [fx, fy] = facingVec(p.dir);
      const sx = (fx - fy) * 16, sy = (fx + fy) * 8, l = Math.hypot(sx, sy);
      sources.push({ x: isoX(p.x, p.y), y: isoY(p.x, p.y) - 8, dx: sx / l, dy: sy / l, r: 96, cone: 0.82, col: [255, 244, 214], k: 1 });
    }
    sources.push({ x: isoX(p.x, p.y), y: isoY(p.x, p.y) - 10, r: 26, col: [150, 160, 200], k: 0.45 });
  }
  for (const o of litFires()) {
    const fl = 0.9 + Math.sin(G.clock * 9 + o.x) * 0.05 + Math.sin(G.clock * 23) * 0.04;
    sources.push({ x: isoX(o.x + 0.5, o.y + 0.5), y: isoY(o.x + 0.5, o.y + 0.5) - 4, r: 74 * fl, col: [255, 178, 104], k: 1 });
  }
  ctx.globalCompositeOperation = 'multiply';
  if (!sources.length) {
    ctx.fillStyle = `rgb(${amb.map((v) => v | 0).join(',')})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalCompositeOperation = 'source-over';
    return;
  }
  const lw = Math.ceil(VW / 2), lh = Math.ceil(VH / 2);
  if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; limg = lx.createImageData(lw, lh); }
  const data = limg.data;
  for (let by = 0; by < lh; by++) {
    for (let bx = 0; bx < lw; bx++) {
      const px = bx * 2 + 1, py = by * 2 + 1;
      let r = amb[0], g = amb[1], b = amb[2];
      const dith = BAYER[(by & 3) * 4 + (bx & 3)];
      for (const s of sources) {
        const dx = px - s.x, dy = (py - s.y) * 1.6, d = Math.hypot(dx, dy);
        if (d > s.r) continue;
        let I = (1 - d / s.r) * s.k;
        if (s.cone) {
          const ey = py - s.y, c = (dx * s.dx + ey * s.dy) / (Math.hypot(dx, ey) || 1);
          if (d > 10) I *= c > s.cone ? 1 : c > s.cone - 0.12 ? (c - s.cone + 0.12) / 0.12 : 0;
        }
        // 4 paliers tramés : bandes nettes de pixel art plutôt qu'un dégradé
        const q = Math.max(0, Math.min(4, Math.floor(I * 4 + dith * 0.9 + 0.5))) / 4;
        if (!q) continue;
        r += (s.col[0] - r) * q; g += (s.col[1] - g) * q; b += (s.col[2] - b) * q;
      }
      const o = (by * lw + bx) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  lx.putImageData(limg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lc, 0, 0, lw, lh, 0, 0, lw * 2, lh * 2);
  ctx.globalCompositeOperation = 'source-over';
}

// flammes ravivées par-dessus la nuit, avec un halo en paliers
function drawFlames() {
  const fires = litFires();
  if (!fires.length) return;
  const dark = ambient();
  const night = 1 - (dark[0] + dark[1] + dark[2]) / 765;
  for (const o of fires) {
    const X = isoX(o.x + 0.5, o.y + 0.5), Y = isoY(o.x + 0.5, o.y + 0.5);
    if (night > 0.2) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [r, a] of [[14, 0.06], [9, 0.08], [5, 0.1]]) {
        ctx.fillStyle = `rgba(255,140,60,${a * night})`;
        for (let yy = -r; yy <= r; yy++) { const hw = Math.floor(Math.sqrt(r * r - yy * yy) * 1.5); ctx.fillRect(X - hw, Y - 6 + (yy >> 1), hw * 2, 1); }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    draw(B.S.flames[Math.floor(G.clock * 8 + o.x) & 3], X, Y + 1);
  }
}

export function screenOf(x, y) { return [isoX(x, y), isoY(x, y)]; }
export { MAP };
