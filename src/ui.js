// Interface : HUD, joystick, barre rapide, boutons d'action, inventaire façon Minecraft, textes, menus.
import { ctx, view, canvas, draw, drawText, textWidth, wrap, panel, well } from './gfx.js';
import * as B from './bank.js';
import { G, HOTBAR, addTo, sameKind, maxStack, hour, day, say } from './state.js';
import { ITEMS, matchRecipe, COOK_TIME } from './items.js';
import { LABEL } from './world.js';
import { useItem, drop, save, newGame, wipe, refreshFires, driving, fire } from './game.js';
import { MAP, W as WK } from './world.js';
import { T } from './sprites/tiles.js';
import { sfx, setMuted, initAudio } from './audio.js';
import { screenOf } from './render.js';

export const input = { x: 0, y: 0, mag: 0, ax: 0, ay: 0, amag: 0, gas: false, brake: false, sprint: false, wheel: 0, wheelHeld: false }; // gauche : marche, droite : visée
const BASE = [62, 52, 44]; // panneaux : brun chaud
const SLOT = 20;
let buttons = []; // zones cliquables du HUD, recalculées à chaque image
let wheelPos = null; // volant affiché quand on conduit
let slots = []; // cases de l'inventaire ouvert
let stick = null, aimStick = null, wheelGrab = null;
let pointer = null; // doigt qui manipule l'inventaire
let tip = null; // infobulle ouverte : { key }
let menuConfirm = 0;
let selShow = 0;

// ---------------------------------------------------------------- petits glyphes 5x5
const GLYPH = {
  health: '.#.#. ##### ##### .###. ..#..',
  hunger: '...#. ..##. .###. ###.. .#...',
  thirst: '..#.. .###. .###. ##### .###.',
  energy: '..##. .##.. ####. ..##. .##..',
  moral: '.###. #.#.# ##### #.### .###.',
  sun: '#.#.# .###. ##### .###. #.#.#',
  moon: '.##.. ##... ##... ##... .##..',
  rain: '.###. ##### ..... #.#.# .#.#.',
};
function glyph(name, x, y, col) {
  const g = GLYPH[name].replace(/ /g, '');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < 25; i++) if (g[i] === '#') ctx.fillRect(x + (i % 5) + 1, y + ((i / 5) | 0) + 1, 1, 1);
  ctx.fillStyle = col;
  for (let i = 0; i < 25; i++) if (g[i] === '#') ctx.fillRect(x + (i % 5), y + ((i / 5) | 0), 1, 1);
}
function circle(cx, cy, r, col) {
  ctx.fillStyle = col;
  for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const STAT_COL = { health: [220, 80, 86], hunger: [222, 150, 70], thirst: [90, 160, 220], energy: [226, 196, 80], moral: [160, 130, 220] };

// ---------------------------------------------------------------- volant
// Pixel par pixel : jante épaisse éclairée en haut à gauche, trois branches, moyeu, repère rouge à midi.
function drawWheel(cx, cy, R, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), rin = R - 6;
  const cols = { ring: ['#1c1a1c', '#2c2a2e', '#3e3b40', '#56525a'], spoke: '#38363c', hub: '#4a464e', mark: '#c84a3a' };
  const pix = new Map();
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x + 0.5, y + 0.5);
    if (d > R) continue;
    // coordonnées dans le repère du volant tourné
    const u = (x + 0.5) * c + (y + 0.5) * s, v = -(x + 0.5) * s + (y + 0.5) * c;
    let col = null;
    if (d >= rin) {
      const lit = -(x * 0.6 + y * 0.8) / R; // lumière en haut à gauche
      let k = lit > 0.45 ? 3 : lit > 0 ? 2 : lit > -0.5 ? 1 : 0;
      if (Math.abs(Math.atan2(v, u) + Math.PI / 2) < 0.16) col = cols.mark; // repère à midi
      else if ((Math.floor((Math.atan2(v, u) + 7) * 9) & 1) && d > rin + 1 && d < R - 1) k = Math.max(0, k - 1); // grip
      col = col || cols.ring[k];
    } else if (d < 7) col = d < 5.5 ? cols.hub : cols.ring[1];
    else {
      // branches : vers le bas et vers les côtés (à 3 h et 9 h, un peu basses)
      for (const a of [Math.PI / 2, 0.2, Math.PI - 0.2]) {
        const ax = Math.cos(a), ay = Math.sin(a);
        const along = u * ax + v * ay, across = -u * ay + v * ax;
        if (along > 0 && Math.abs(across) < (a === Math.PI / 2 ? 2.4 : 2)) { col = cols.spoke; break; }
      }
    }
    if (col) { if (!pix.has(col)) pix.set(col, []); pix.get(col).push(x, y); }
  }
  ctx.globalAlpha = 0.88;
  circle(cx + 1, cy + 2, R, 'rgba(0,0,0,0.35)');
  for (const [col, list] of pix) {
    ctx.fillStyle = col;
    for (let i = 0; i < list.length; i += 2) ctx.fillRect(cx + list[i], cy + list[i + 1], 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- dessin d'une pile
function drawStack(s, x, y) {
  if (!s) return;
  draw(B.icon(s.id), x, y);
  if (s.n > 1) { const t = String(s.n); drawText(t, x + 17 - textWidth(t), y + 11, '#fff', 'rgba(0,0,0,0.85)'); }
  const def = ITEMS[s.id];
  if (def.charge && s.d !== undefined) {
    const k = Math.max(0, Math.min(1, s.d / def.charge));
    ctx.fillStyle = '#111'; ctx.fillRect(x + 1, y + 15, 14, 2);
    ctx.fillStyle = k > 0.5 ? '#6c6' : k > 0.2 ? '#dc6' : '#d55'; ctx.fillRect(x + 1, y + 15, Math.round(14 * k), 1);
  }
}

// ---------------------------------------------------------------- HUD
function layoutHUD() {
  const { W: VW, H: VH, safe } = view;
  const hy = VH - safe.b - 24;
  const hx = Math.floor((VW - HOTBAR * 22 + 2) / 2);
  buttons = [];
  wheelPos = null;
  for (let i = 0; i < HOTBAR; i++) buttons.push({ kind: 'hot', i, x: hx + i * 22, y: hy, w: 20, h: 20 });
  const acts = G.target ? G.target.acts : [];
  const ax = VW - safe.r - 24, ay = hy - 30;
  if (driving()) {
    if (G.settings.drive === 'wheel') wheelPos = { cx: safe.l + 46, cy: hy - 76, r: 32 };
    // pédales à droite (on les garde enfoncées), sortir au-dessus
    buttons.push({ kind: 'gas', hold: true, label: 'GAZ', cx: ax, cy: ay - 4, r: 19, col: [70, 170, 110] });
    buttons.push({ kind: 'brake', hold: true, label: 'FREIN', cx: ax - 46, cy: ay + 4, r: 16, col: [225, 70, 90] });
    if (acts[0]) buttons.push({ kind: 'act', a: acts[0], cx: ax, cy: ay - 58, r: 11, col: [60, 165, 190] });
  } else {
    if (acts[0]) buttons.push({ kind: 'act', a: acts[0], cx: ax, cy: ay, r: 17, col: [70, 170, 110] });
    if (acts[1]) buttons.push({ kind: 'act', a: acts[1], cx: ax, cy: ay - 46, r: 12, col: [60, 165, 190] });
    const h = G.p.inv[G.p.sel];
    if (h && ITEMS[h.id].gun) buttons.push({ kind: 'fire', label: 'TIRER', cx: ax - 36, cy: ay - 44, r: 14, col: [225, 70, 90] });
    else if (acts[2]) buttons.push({ kind: 'act', a: acts[2], cx: ax - 34, cy: ay - 40, r: 11, col: [60, 165, 190] });
    const use = h && ITEMS[h.id].use;
    if (use) buttons.push({ kind: 'use', label: use.verb, cx: VW - safe.r - (acts[0] ? 66 : 24), cy: hy - 24, r: 13, col: [230, 170, 50] });
    buttons.push({ kind: 'sprint', hold: true, label: 'COURIR', cx: VW - safe.r - (use ? 104 : acts[0] ? 66 : 62), cy: hy - (use || !acts[0] ? 24 : 24), r: 13, col: [120, 90, 220] });
  }
  buttons.push({ kind: 'bag', label: 'SAC', cx: safe.l + 20, cy: hy - 24, r: 13, col: [200, 90, 120] });
  buttons.push({ kind: 'menu', x: VW - safe.r - 15, y: safe.t + 3, w: 12, h: 12 });
  buttons.push({ kind: 'map', x: VW - safe.r - 15, y: safe.t + 18, w: 12, h: 12 });
  for (const b of buttons) if (b.r) { b.x = b.cx - b.r - 3; b.y = b.cy - b.r - 3; b.w = b.h = b.r * 2 + 6; b.h += 8; }
}

export function drawHUD() {
  const p = G.p, { W: VW, safe } = view;
  layoutHUD();
  // jauges
  const sx = safe.l + 5;
  let sy = safe.t + 5;
  for (const k of ['health', 'hunger', 'thirst', 'energy', 'moral']) {
    const v = p[k], c = STAT_COL[k];
    const low = v < 20 && (Math.floor(G.clock * 3) & 1);
    glyph(k, sx, sy, rgba(low ? [255, 255, 255] : c, 1));
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sx + 8, sy + 1, 34, 4);
    ctx.fillStyle = rgba(c.map((x) => x * 0.55 | 0), 1); ctx.fillRect(sx + 9, sy + 2, 32, 2);
    ctx.fillStyle = rgba(c, 1); ctx.fillRect(sx + 9, sy + 2, Math.round(32 * v / 100), 2);
    sy += 8;
  }
  const st = [];
  if (p.bleeding) st.push(['SAIGNE', '#e05a5a']);
  if (p.sick) st.push(['MALADE', '#9fc068']);
  if (p.sitting) st.push(['ASSIS', '#c8c0b0']);
  for (const [t, c] of st) { if (t !== 'SAIGNE' || Math.floor(G.clock * 2) & 1) drawText(t, sx, sy + 1, c); sy += 7; }
  // jour et heure
  const h = hour(), mm = Math.floor((G.time % 60)), hh = Math.floor(h);
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const right = VW - safe.r - 20;
  drawText(`JOUR ${day()}`, right - textWidth(`JOUR ${day()}`), safe.t + 5, '#efe6d2');
  drawText(clock, right - textWidth(clock), safe.t + 12, '#c9bfa8');
  glyph(G.weather.rain > 0.25 ? 'rain' : h > 6 && h < 20 ? 'sun' : 'moon', right - textWidth(clock) - 8, safe.t + 12, G.weather.rain > 0.25 ? '#9fb6d8' : h > 6 && h < 20 ? '#f0d070' : '#c8d0f0');
  // au volant : jauge d'essence et vitesse
  const car = driving();
  if (car) {
    const y = safe.t + 22, x = right - 40;
    drawText('ESSENCE', x - 1, y, '#d8ccb4');
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 1, y + 7, 42, 4);
    ctx.fillStyle = car.fuel > 15 ? '#e0b040' : '#d05040'; ctx.fillRect(x, y + 8, Math.round(40 * car.fuel / 100), 2);
    const kmh = `${Math.round(Math.abs(car.speed) * 7)} KM/H`;
    drawText(kmh, x + 41 - textWidth(kmh), y + 14, '#efe6d2');
  }
  // bouton menu
  const mb = buttons.find((b) => b.kind === 'menu');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(mb.x, mb.y, 12, 12);
  ctx.fillStyle = '#e8e0d0'; for (let i = 0; i < 3; i++) ctx.fillRect(mb.x + 3, mb.y + 3 + i * 3, 6, 1);
  // bouton carte : une petite carte pliée
  const cb = buttons.find((b) => b.kind === 'map');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(cb.x, cb.y, 12, 12);
  ctx.fillStyle = '#d8ccb0'; ctx.fillRect(cb.x + 2, cb.y + 3, 8, 6);
  ctx.fillStyle = '#7a9a5c'; ctx.fillRect(cb.x + 3, cb.y + 4, 2, 4); ctx.fillStyle = '#5a7aa0'; ctx.fillRect(cb.x + 6, cb.y + 5, 3, 2);
  ctx.fillStyle = '#c8402c'; ctx.fillRect(cb.x + 5, cb.y + 4, 1, 1);

  // barre rapide
  for (const b of buttons) {
    if (b.kind !== 'hot') continue;
    const sel = b.i === p.sel;
    ctx.fillStyle = sel ? '#efe2c0' : 'rgba(10,8,6,0.7)';
    ctx.fillRect(b.x - 1, b.y - 1, 22, 22);
    ctx.fillStyle = sel ? 'rgba(70,58,46,0.9)' : 'rgba(46,40,34,0.75)';
    ctx.fillRect(b.x, b.y, 20, 20);
    drawStack(p.inv[b.i], b.x + 2, b.y + 2);
  }
  // nom de l'objet tenu, un instant
  selShow -= 1 / 60;
  const hs = p.inv[p.sel];
  if (hs && selShow > 0) { const t = ITEMS[hs.id].name; drawText(t, (VW - textWidth(t)) >> 1, buttons[0].y - 9, '#f2ead8'); }

  // boutons ronds : lettre au centre, libellé dessous
  for (const b of buttons) {
    if (!b.r) continue;
    const label = b.kind === 'act' ? b.a.label : b.label;
    circle(b.cx, b.cy, b.r + 1, 'rgba(0,0,0,0.5)');
    circle(b.cx, b.cy, b.r, rgba(b.col, 0.8));
    circle(b.cx - 1, b.cy - 1, b.r - 3, rgba(b.col.map((c) => Math.min(255, c + 30)), 0.55));
    if (b.kind === 'bag') { draw(B.icon('drap'), b.cx - 8, b.cy - 8); }
    else if (b.kind === 'use') { const s = p.inv[p.sel]; if (s) draw(B.icon(s.id), b.cx - 8, b.cy - 8); }
    else if (b.hold) { if (input[b.kind]) circle(b.cx, b.cy, b.r - 2, 'rgba(255,255,255,0.25)'); drawText(label[0], b.cx - 3, b.cy - 5, '#fff', 'rgba(0,0,0,0.6)', 2); }
    else drawText(label[0], b.cx - 1 - (b.r > 14 ? 2 : 1), b.cy - (b.r > 14 ? 5 : 2), '#fff', 'rgba(0,0,0,0.6)', b.r > 14 ? 2 : 1);
    drawText(label, b.cx - (textWidth(label) >> 1), b.cy + b.r + 3, '#fff');
    if (b.a && b.a.sub) drawText(b.a.sub, b.cx - (textWidth(b.a.sub) >> 1), b.cy + b.r + 10, '#d8d0c0');
  }
  // repère au-dessus de la cible
  if (G.target && !G.ui && G.target.kind !== 'drive') {
    const t = G.target;
    const [X, Y0] = screenOf(t.x + 0.5, t.y + 0.5), Y = Y0 - (G.p.l || 0) * 28;
    const lift = t.kind === 'water' ? 6 : t.kind === 'wall' ? 34 : 26;
    const bob = Math.floor(G.clock * 3) & 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(X - 2, Y - lift + bob + 1, 5, 1); ctx.fillRect(X - 1, Y - lift + bob + 2, 3, 1); ctx.fillRect(X, Y - lift + bob + 3, 1, 1);
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(X - 2, Y - lift + bob, 5, 1); ctx.fillRect(X - 1, Y - lift + bob + 1, 3, 1); ctx.fillRect(X, Y - lift + bob + 2, 1, 1);
  }
  if (wheelPos) drawWheel(wheelPos.cx, wheelPos.cy, wheelPos.r, (input.wheel || 0) * 2.6);
  // joysticks : marche (clair) et visée (ambré)
  if (stick) {
    circle(stick.x0, stick.y0, 22, 'rgba(255,255,255,0.08)');
    circle(stick.x0, stick.y0, 21, 'rgba(0,0,0,0.12)');
    circle(Math.round(stick.x0 + input.x * 18), Math.round(stick.y0 + input.y * 18), 8, 'rgba(255,248,230,0.35)');
  }
  if (aimStick) {
    circle(aimStick.x0, aimStick.y0, 22, 'rgba(255,200,120,0.08)');
    circle(aimStick.x0, aimStick.y0, 21, 'rgba(0,0,0,0.12)');
    circle(Math.round(aimStick.x0 + input.ax * 18), Math.round(aimStick.y0 + input.ay * 18), 7, 'rgba(255,200,120,0.4)');
  }
  // action en cours : petite barre de progression
  if (p.act && p.act.dur > 0.9) {
    const [X, Y0] = screenOf(p.x, p.y), Y = Y0 - (p.l || 0) * 28;
    const k = Math.min(1, p.act.t / p.act.dur);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(X - 11, Y - 46, 22, 4);
    ctx.fillStyle = '#efe2c0'; ctx.fillRect(X - 10, Y - 45, Math.round(20 * k), 2);
  }
  drawMessages();
}

function drawMessages() {
  const { W: VW } = view;
  let y = buttons[0].y - 20;
  for (let i = G.msgs.length - 1; i >= 0; i--) {
    const m = G.msgs[i];
    const a = Math.min(1, m.t / 0.6);
    for (const line of wrap(m.text, 52).reverse()) {
      ctx.globalAlpha = a;
      drawText(line, (VW - textWidth(line)) >> 1, y, '#f4ecdc', 'rgba(0,0,0,0.8)');
      y -= 7;
    }
    y -= 2;
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- inventaire
function slotGet(s) {
  const p = G.p, ui = G.ui;
  if (s.area === 'inv') return p.inv[s.i];
  if (s.area === 'craft') return p.craft[s.i];
  if (s.area === 'box') return ui.obj.inv[s.i];
  if (s.area === 'fire') return ui.obj.fire.slots[s.i];
  if (s.area === 'result') { const m = matchRecipe(p.craft); return m ? m.out : null; }
  return null;
}
function slotSet(s, v) {
  const p = G.p, ui = G.ui;
  if (s.area === 'inv') p.inv[s.i] = v;
  else if (s.area === 'craft') p.craft[s.i] = v;
  else if (s.area === 'box') ui.obj.inv[s.i] = v;
  else if (s.area === 'fire') ui.obj.fire.slots[s.i] = v;
}
const accepts = (s, st) => {
  if (s.area === 'result') return false;
  if (s.area === 'fire') return s.i === 1 ? !!ITEMS[st.id].fuel : s.i === 0;
  return true;
};

function layoutInv() {
  const { W: VW, H: VH } = view, ui = G.ui, p = G.p;
  slots = [];
  const pw = 9 * SLOT + 10;
  const x0 = Math.floor((VW - pw) / 2);
  let topH = 48;
  let boxRows = 0;
  if (ui.kind === 'box') { boxRows = Math.ceil(ui.obj.inv.length / 9); topH = boxRows * SLOT + 4; }
  const ph = 12 + topH + 10 + 3 * SLOT + 5 + SLOT + 36;
  const y0 = Math.max(view.safe.t + 22, Math.floor((VH - ph) / 2) - 20);
  const L = { x0, y0, pw, ph, top: y0 + 13 };
  if (ui.kind === 'inv') {
    L.portrait = { x: x0 + 6, y: L.top + 2, w: 34, h: 42 };
    const cx = x0 + 70, cy = L.top + 4;
    for (let i = 0; i < 4; i++) slots.push({ area: 'craft', i, x: cx + (i & 1) * SLOT, y: cy + (i >> 1) * SLOT });
    slots.push({ area: 'result', x: cx + 2 * SLOT + 26, y: cy + SLOT / 2 });
    L.arrow = { x: cx + 2 * SLOT + 6, y: cy + SLOT / 2 + 7 };
  } else if (ui.kind === 'box') {
    const n = ui.obj.inv.length, w = Math.min(9, n) * SLOT;
    for (let i = 0; i < n; i++) slots.push({ area: 'box', i, x: x0 + 5 + Math.floor((9 * SLOT - w) / 2) + (i % 9) * SLOT, y: L.top + 2 + Math.floor(i / 9) * SLOT });
  } else if (ui.kind === 'fire') {
    const cx = x0 + 40;
    slots.push({ area: 'fire', i: 0, x: cx, y: L.top + 2 });
    slots.push({ area: 'fire', i: 1, x: cx, y: L.top + 26 });
    slots.push({ area: 'fire', i: 2, x: cx + 60, y: L.top + 14 });
    L.flame = { x: cx + 2, y: L.top + 22 };
    L.arrow = { x: cx + 28, y: L.top + 21 };
    L.light = { x: x0 + pw - 52, y: L.top + 28, w: 46, h: 13 };
  }
  const my = L.top + topH + 10;
  L.mainY = my;
  for (let i = 0; i < 27; i++) slots.push({ area: 'inv', i: HOTBAR + i, x: x0 + 5 + (i % 9) * SLOT, y: my + Math.floor(i / 9) * SLOT });
  const hy = my + 3 * SLOT + 5;
  for (let i = 0; i < HOTBAR; i++) slots.push({ area: 'inv', i, x: x0 + 5 + i * SLOT, y: hy });
  L.infoY = hy + SLOT + 4;
  L.close = { x: x0 + pw - 13, y: y0 + 2, w: 11, h: 10 };
  return L;
}

function drawInv() {
  const ui = G.ui, p = G.p;
  const L = layoutInv();
  ctx.fillStyle = 'rgba(8,6,10,0.55)';
  ctx.fillRect(0, 0, view.W, view.H);
  panel(L.x0, L.y0, L.pw, L.ph, BASE);
  const title = ui.kind === 'inv' ? 'INVENTAIRE' : ui.kind === 'fire' ? 'FEU DE CAMP' : (LABEL[ui.obj.type] || 'CONTENU').toUpperCase();
  drawText(title, L.x0 + 6, L.y0 + 4, '#f0e4c8');
  // fermer
  ctx.fillStyle = '#8a3c3c'; ctx.fillRect(L.close.x, L.close.y, L.close.w, L.close.h);
  drawText('X', L.close.x + 4, L.close.y + 3, '#fff');
  if (L.portrait) {
    const q = L.portrait;
    well(q.x, q.y, q.w, q.h, [40, 44, 52]);
    draw(B.S.player.idle[0][2][Math.floor(G.clock * 1.4) & 3], q.x + 17, q.y + 40);
    drawText('2X2', L.x0 + 70 + 2 * SLOT + 6, L.top + 4 + 2 * SLOT + 2, 'rgba(240,228,200,0.45)', null);
  }
  if (L.arrow) {
    const a = L.arrow;
    let k = 1;
    if (ui.kind === 'fire') k = ui.obj.fire.prog / COOK_TIME;
    ctx.fillStyle = '#2a221c'; ctx.fillRect(a.x, a.y, 14, 3); ctx.fillRect(a.x + 14, a.y - 2, 2, 7); ctx.fillRect(a.x + 16, a.y - 1, 2, 5); ctx.fillRect(a.x + 18, a.y, 1, 3);
    if (ui.kind === 'fire') { ctx.fillStyle = '#f0e4c8'; ctx.fillRect(a.x, a.y + 1, Math.round(14 * k), 1); }
  }
  if (ui.kind === 'fire') {
    const f = ui.obj.fire;
    if (f.lit) draw(B.S.flames[Math.floor(G.clock * 8) & 3], L.flame.x + 8, L.flame.y + 2);
    else drawText('...', L.flame.x + 3, L.flame.y - 2, '#8a7a68', null);
    drawText(f.lit ? 'ALLUMÉ' : 'ÉTEINT', L.x0 + 128, L.top + 4, f.lit ? '#f0b050' : '#a09888');
    if (f.lit) drawText(`${Math.ceil(f.burn)} MIN`, L.x0 + 128, L.top + 12, '#c8b8a0');
    drawText('CUIRE', L.x0 + 8, L.top + 8, '#c8b8a0');
    drawText('BOIS', L.x0 + 8, L.top + 32, '#c8b8a0');
    if (!f.lit) { const b = L.light; ctx.fillStyle = '#a8602c'; ctx.fillRect(b.x, b.y, b.w, b.h); drawText('ALLUMER', b.x + 4, b.y + 4, '#fff'); }
  }
  drawText('SAC', L.x0 + 6, L.mainY - 7, 'rgba(240,228,200,0.6)', null);
  for (const s of slots) {
    well(s.x, s.y, SLOT - 1, SLOT - 1, BASE);
    if (s.area === 'inv' && s.i === p.sel) { ctx.fillStyle = 'rgba(240,226,190,0.25)'; ctx.fillRect(s.x + 1, s.y + 1, SLOT - 3, SLOT - 3); }
    if (s.area === 'fire' && s.i === 1 && !slotGet(s)) draw(B.icon('buche'), s.x + 1, s.y + 1), ctx.fillStyle = 'rgba(40,30,24,0.7)', ctx.fillRect(s.x + 1, s.y + 1, 17, 17);
    drawStack(slotGet(s), s.x + 1, s.y + 1);
  }
  drawText('GLISSER : DÉPLACER', L.x0 + 6, L.infoY + 2, '#a89c88', null);
  drawText('TOUCHER : DÉTAILS', L.x0 + 6, L.infoY + 9, '#8a806e', null);
  ui.L = L;
  // infobulle de l'objet touché
  if (tip) {
    const ts = slots.find((q) => key(q) === tip.key);
    if (!ts || !slotGet(ts)) tip = null;
    else drawTip(ts, L);
  }
  // pile glissée, au-dessus du doigt
  const c = p.cursor;
  if (c && pointer) drawStack(c, Math.round(pointer.x - 8), Math.round(pointer.y - 24));
  ui.L = L;
}

function slotAt(x, y) { return slots.find((s) => x >= s.x && x < s.x + SLOT - 1 && y >= s.y && y < s.y + SLOT - 1); }
const key = (s) => `${s.area}${s.i}`;

// --- glisser-déposer
function startDrag(s, P) {
  const here = slotGet(s);
  if (!here || s.area === 'result') return false;
  G.p.cursor = { ...here, from: s };
  slotSet(s, null);
  tip = null;
  pointer = P;
  sfx('pickup');
  return true;
}
const stripFrom = (c) => { const { from, ...s } = c; return s; };
// rend une pile à sa case d'origine (ou au sac, ou au sol)
function giveBack(from, st) {
  if (from && !slotGet(from) && accepts(from, st)) { slotSet(from, st); return; }
  const r = addTo(G.p.inv, st);
  if (r) drop(r);
}
function endDrag(t) {
  const p = G.p, c = p.cursor;
  if (!c) return;
  p.cursor = null;
  pointer = null;
  const st = stripFrom(c), from = c.from;
  if (!t || key(t) === key(from) || !accepts(t, st)) { giveBack(from, st); return; }
  const here = slotGet(t);
  if (!here) slotSet(t, st);
  else if (sameKind(here, st)) {
    const k = Math.min(st.n, maxStack(here) - here.n);
    here.n += k; st.n -= k;
    if (st.n) giveBack(from, st);
  } else if (accepts(from, here)) { slotSet(t, st); slotSet(from, here); } // échange
  else { giveBack(from, st); return; }
  sfx('pickup');
}

// --- fabrication : toucher le résultat range l'objet fabriqué dans le sac
function craft() {
  const p = G.p, m = matchRecipe(p.craft);
  if (!m) return;
  for (let i = 0; i < 4; i++) {
    const c = p.craft[i];
    if (!c || (m.recipe.tools || []).includes(c.id)) continue;
    c.n--; if (!c.n) p.craft[i] = null;
  }
  const r = addTo(p.inv, m.out);
  if (r) drop(r);
  say(`+${m.out.n} ${ITEMS[m.out.id].name}`);
  sfx('craft');
}

// --- infobulle : nom, description, effets, et actions
function tipLines(st) {
  const d = ITEMS[st.id], u = d.use || {}, fx = [];
  if (u.hunger) fx.push(`FAIM ${u.hunger > 0 ? '+' : ''}${u.hunger}`);
  if (u.thirst) fx.push(`SOIF ${u.thirst > 0 ? '+' : ''}${u.thirst}`);
  if (u.moral) fx.push(`MORAL +${u.moral}`);
  if (u.health) fx.push(`SANTÉ +${u.health}`);
  if (u.sick) fx.push('RISQUÉ');
  if (d.charge && st.d !== undefined) fx.push(st.id === 'allumettes' ? `${st.d} RESTANTES` : `CHARGE ${Math.round(100 * st.d / d.charge)}%`);
  if (d.fuel) fx.push(`BRÛLE ${d.fuel} MIN`);
  if (d.cook) fx.push('À CUIRE');
  if (st.read) fx.push('DÉJÀ LU');
  return { name: d.name + (st.n > 1 ? ` X${st.n}` : ''), desc: wrap(d.desc, 32), fx: wrap(fx.join('  '), 32) };
}
function tipButtons(s, st) {
  const d = ITEMS[st.id], ui = G.ui, out = [];
  if (d.use && s.area === 'inv' && !driving()) out.push(['use', d.use.verb]);
  if (st.n > 1 && (s.area === 'inv' || s.area === 'box')) out.push(['split', 'DIVISER']);
  out.push(['store', s.area === 'inv' ? (ui.kind === 'box' ? 'DÉPOSER' : ui.kind === 'fire' ? 'AU FEU' : 'RANGER') : 'PRENDRE']);
  out.push(['drop', 'JETER']);
  return out;
}
function tipLayout(s, L) {
  const st = slotGet(s), T = tipLines(st), btns = tipButtons(s, st);
  const w = 136;
  const rows = [];
  let row = [], rw = 0;
  for (const [act, label] of btns) {
    const bw = textWidth(label) + 8;
    if (rw + bw > w - 8 && row.length) { rows.push(row); row = []; rw = 0; }
    row.push({ act, label, w: bw }); rw += bw + 3;
  }
  if (row.length) rows.push(row);
  const h = 10 + T.desc.length * 7 + (T.fx[0] ? T.fx.length * 7 + 2 : 0) + rows.length * 14 + 4;
  let x = Math.max(2, Math.min(view.W - w - 2, s.x + SLOT / 2 - w / 2));
  let y = s.y > L.y0 + L.ph / 2 ? s.y - h - 2 : s.y + SLOT + 1;
  y = Math.max(2, Math.min(view.H - h - 2, y));
  const B = [];
  let by = y + h - rows.length * 14 - 2;
  for (const r of rows) {
    let bx = x + 4;
    for (const b of r) { B.push({ ...b, x: bx, y: by, h: 11 }); bx += b.w + 3; }
    by += 14;
  }
  return { x, y, w, h, T, B };
}
function drawTip(s, L) {
  const t = tipLayout(s, L);
  tip.box = t;
  panel(t.x, t.y, t.w, t.h, [86, 74, 60]);
  drawText(t.T.name, t.x + 4, t.y + 3, '#fff4dc');
  let y = t.y + 10;
  for (const l of t.T.desc) { drawText(l, t.x + 4, y, '#d8ccb4', null); y += 7; }
  if (t.T.fx[0]) { y += 2; for (const l of t.T.fx) { drawText(l, t.x + 4, y, '#a8d08c', null); y += 7; } }
  for (const b of t.B) {
    ctx.fillStyle = b.act === 'use' ? '#4a8a5a' : b.act === 'drop' ? '#8a4a3c' : '#5a5a6a';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    drawText(b.label, b.x + 4, b.y + 3, '#fff');
  }
}
function tipAction(act) {
  const ts = slots.find((q) => key(q) === tip.key), p = G.p, ui = G.ui;
  const st = ts && slotGet(ts);
  if (!st) { tip = null; return; }
  if (act === 'use') {
    const prev = G.ui;
    useItem(ts.i);
    if (G.ui && G.ui.kind === 'text' && G.ui !== prev) G.ui.prev = prev;
    else if (!G.ui) G.ui = prev;
  } else if (act === 'split') {
    const half = Math.floor(st.n / 2), arr = ts.area === 'inv' ? p.inv : ui.obj.inv;
    const i = arr.findIndex((q) => !q);
    if (i < 0) { say('Pas de case libre.'); return; }
    st.n -= half; arr[i] = { ...st, n: half };
    sfx('pickup');
  } else if (act === 'store') {
    slotSet(ts, null);
    let rest = st;
    if (ts.area === 'inv') {
      if (ui.kind === 'box') rest = addTo(ui.obj.inv, st);
      else if (ui.kind === 'fire') {
        const i = ITEMS[st.id].fuel ? 1 : ITEMS[st.id].cook ? 0 : -1;
        if (i >= 0) rest = addTo(ui.obj.fire.slots, st, i, i + 1);
      } else rest = ts.i < HOTBAR ? addTo(p.inv, st, HOTBAR, p.inv.length) : addTo(p.inv, st, 0, HOTBAR);
    } else rest = addTo(p.inv, st);
    if (rest) slotSet(ts, rest);
    tip = null;
    sfx('pickup');
  } else if (act === 'drop') {
    slotSet(ts, null);
    drop(st);
    say(`${ITEMS[st.id].name} : posé au sol.`);
    tip = null;
    sfx('cloth');
  }
}

export function closeUI() {
  const p = G.p, ui = G.ui;
  if (!ui) return;
  tip = null;
  if (ui.kind === 'text') { G.ui = ui.prev || null; return; }
  if (p.cursor) { const r = addTo(p.inv, stripFrom(p.cursor)); if (r) drop(r); p.cursor = null; }
  for (let i = 0; i < 4; i++) if (p.craft[i]) { const r = addTo(p.inv, p.craft[i]); if (r) drop(r); p.craft[i] = null; }
  if (ui.kind === 'box' && ui.obj.type === 'bag' && ui.obj.inv.every((s) => !s)) G.world.removeObj(ui.obj);
  G.ui = null;
  sfx('ui');
  save();
}

// ---------------------------------------------------------------- textes, menu, écrans
function drawText2(text, title) {
  const { W: VW, H: VH } = view;
  const lines = wrap(text, 44);
  const pw = Math.min(VW - 16, 190), ph = 26 + lines.length * 8 + 14;
  const x = (VW - pw) >> 1, y = Math.max(20, (VH - ph) >> 1);
  ctx.fillStyle = 'rgba(8,6,10,0.55)'; ctx.fillRect(0, 0, VW, VH);
  panel(x, y, pw, ph, [74, 66, 54]);
  ctx.fillStyle = '#e4dcc4'; ctx.fillRect(x + 4, y + 14, pw - 8, ph - 32);
  drawText(title.toUpperCase(), x + 6, y + 5, '#f6ecd4');
  lines.forEach((l, i) => drawText(l, x + 9, y + 19 + i * 8, '#3a2e24', null));
  drawText('TOUCHER POUR FERMER', (VW - textWidth('TOUCHER POUR FERMER')) >> 1, y + ph - 12, '#d8ccb4');
}

function menuButtons() {
  const { W: VW, H: VH } = view;
  const items = [['REPRENDRE', 'resume'], [G.muted ? 'SON : NON' : 'SON : OUI', 'sound'],
    [G.settings.drive === 'wheel' ? 'CONDUITE : VOLANT' : 'CONDUITE : JOYSTICK', 'drive'], [menuConfirm ? 'VRAIMENT ? TOUT EFFACER' : 'NOUVELLE PARTIE', 'new']];
  return items.map(([label, act], i) => ({ label, act, x: (VW - 120) >> 1, y: (VH >> 1) - 30 + i * 22, w: 120, h: 16 }));
}
function drawMenu() {
  const { W: VW, H: VH } = view;
  ctx.fillStyle = 'rgba(8,6,10,0.6)'; ctx.fillRect(0, 0, VW, VH);
  panel((VW - 136) >> 1, (VH >> 1) - 48, 136, 108, BASE);
  drawText('PAUSE', (VW - textWidth('PAUSE')) >> 1, (VH >> 1) - 43, '#f0e4c8');
  for (const b of menuButtons()) {
    ctx.fillStyle = b.act === 'new' ? (menuConfirm ? '#a8402c' : '#5a4a3c') : '#4a6a52';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    drawText(b.label, b.x + ((b.w - textWidth(b.label)) >> 1), b.y + 6, '#fff');
  }
}

// ---------------------------------------------------------------- carte
// une image de la carte entière (1 pixel par case), refaite à chaque nouvelle partie
let mapCanvas = null, mapSeed = null;
const MAPCOL = {
  [T.GRASS]: [92, 120, 62], [T.DRY]: [126, 118, 68], [T.FOREST]: [52, 74, 44], [T.DIRT]: [102, 72, 50], [T.PATH]: [140, 108, 76],
  [T.ASPHALT]: [56, 58, 64], [T.ROAD_LX]: [56, 58, 64], [T.ROAD_LY]: [56, 58, 64], [T.PARK]: [64, 66, 70], [T.SIDEWALK]: [124, 120, 112],
  [T.SAND]: [190, 170, 116], [T.WATER]: [52, 94, 120], [T.FIELD]: [120, 86, 56], [T.COBBLE]: [150, 140, 122], [T.GRAVEL]: [124, 118, 106],
  [T.CONCRETE]: [118, 116, 108],
};
function buildMap() {
  const w = G.world;
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = mapCanvas.height = MAP;
  const c = mapCanvas.getContext('2d'), img = c.createImageData(MAP, MAP);
  for (let i = 0; i < MAP * MAP; i++) {
    let col = MAPCOL[w.tile[i]] || [170, 150, 120];
    if (w.room[i] >= 0) col = [196, 176, 140];
    const k = w.wall[i];
    if (k === WK.FENCE) col = [200, 196, 180]; else if (k) col = [40, 34, 30];
    img.data.set([...col, 255], i * 4);
  }
  // les tours en plus sombre, d'autant plus qu'elles sont hautes
  for (const b of w.blds) if (b.floors > 1) for (let y = b.y0 + 1; y < b.y1; y++) for (let x = b.x0 + 1; x < b.x1; x++) img.data.set([150 - b.floors * 10, 140 - b.floors * 10, 130 - b.floors * 8, 255], (y * MAP + x) * 4);
  c.putImageData(img, 0, 0);
  mapSeed = G.seed;
}
function drawMap() {
  const { W: VW, H: VH, safe } = view, ui = G.ui, p = G.p;
  if (!mapCanvas || mapSeed !== G.seed) buildMap();
  ctx.fillStyle = '#16120e'; ctx.fillRect(0, 0, VW, VH);
  // 1 pixel par case, centrée sur le joueur, qu'on fait glisser au doigt
  const cx = Math.round(VW / 2 - p.x + ui.dx), cy = Math.round(VH / 2 - p.y + ui.dy);
  ctx.drawImage(mapCanvas, cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, VW, safe.t + 14);
  drawText('CARTE', 6, safe.t + 5, '#f0e4c8');
  drawText('GLISSER : DÉPLACER   TOUCHER : FERMER', 6, VH - safe.b - 10, '#b8ac98');
  // le joueur clignote ; ses voitures en rouge sombre
  for (const c of G.world.cars) { ctx.fillStyle = '#8a3030'; ctx.fillRect(cx + Math.floor(c.x), cy + Math.floor(c.y), 1, 1); }
  if (Math.floor(G.clock * 3) & 1) { ctx.fillStyle = '#ff4030'; ctx.fillRect(cx + Math.floor(p.x) - 1, cy + Math.floor(p.y) - 1, 3, 3); }
  ctx.fillStyle = '#fff'; ctx.fillRect(cx + Math.floor(p.x), cy + Math.floor(p.y), 1, 1);
}

export function drawOverlay() {
  const ui = G.ui, { W: VW, H: VH } = view;
  if (G.mode === 'play' && G.p.sleeping) {
    ctx.fillStyle = 'rgba(4,4,10,0.82)'; ctx.fillRect(0, 0, VW, VH);
    const z = 'Z'.repeat(1 + (Math.floor(G.clock * 1.5) % 3));
    drawText(z, (VW - textWidth(z) * 2) >> 1, (VH >> 1) - 20, '#c8d0f0', null, 2);
    const h = hour(), t = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(G.time % 60)).padStart(2, '0')}`;
    drawText(t, (VW - textWidth(t)) >> 1, (VH >> 1) + 2, '#8890b0');
    drawText('TOUCHER POUR SE RÉVEILLER', (VW - textWidth('TOUCHER POUR SE RÉVEILLER')) >> 1, (VH >> 1) + 30, '#59607a');
    return;
  }
  if (!ui) return;
  if (ui.kind === 'inv' || ui.kind === 'box' || ui.kind === 'fire') drawInv();
  else if (ui.kind === 'text') {
    if (ui.prev) { G.ui = ui.prev; drawInv(); G.ui = ui; }
    drawText2(ui.text, ui.title);
  }
  else if (ui.kind === 'menu') drawMenu();
  else if (ui.kind === 'map') drawMap();
}

export function drawTitle(hasSaved) {
  const { W: VW, H: VH } = view;
  ctx.fillStyle = 'rgba(10,8,14,0.35)'; ctx.fillRect(0, 0, VW, VH);
  const t = 'THE LAST';
  drawText(t, (VW - textWidth(t) * 4) >> 1, Math.floor(VH * 0.28), '#f2e8d2', 'rgba(0,0,0,0.6)', 4);
  const s = 'ILS SONT TOUS PARTIS.';
  drawText(s, (VW - textWidth(s)) >> 1, Math.floor(VH * 0.28) + 28, '#c8bca4');
  const a = 0.5 + Math.sin(G.clock * 2) * 0.35;
  ctx.globalAlpha = a;
  const c = hasSaved ? 'TOUCHER POUR CONTINUER' : 'TOUCHER POUR COMMENCER';
  drawText(c, (VW - textWidth(c)) >> 1, Math.floor(VH * 0.7), '#fff');
  ctx.globalAlpha = 1;
  const h = 'POUR UNE MEILLEURE EXPÉRIENCE : CASQUE';
  drawText(h, (VW - textWidth(h)) >> 1, VH - view.safe.b - 14, '#8a8070', null);
}
export function drawDeath() {
  const { W: VW, H: VH } = view;
  ctx.fillStyle = 'rgba(6,4,6,0.78)'; ctx.fillRect(0, 0, VW, VH);
  const t = 'C\'EST FINI.';
  drawText(t, (VW - textWidth(t) * 2) >> 1, (VH >> 1) - 30, '#e8d8c0', null, 2);
  const d = `VOUS AVEZ TENU ${day()} JOUR${day() > 1 ? 'S' : ''}.`;
  drawText(d, (VW - textWidth(d)) >> 1, (VH >> 1) - 6, '#b8a890');
  const c = 'TOUCHER POUR RECOMMENCER';
  ctx.globalAlpha = 0.5 + Math.sin(G.clock * 2) * 0.35;
  drawText(c, (VW - textWidth(c)) >> 1, (VH >> 1) + 30, '#fff');
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- entrées tactiles
const pts = new Map();
const toGame = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / view.css, (e.clientY - r.top) / view.css]; };
const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
export let onStart = null;
export function setOnStart(f) { onStart = f; }

function down(e) {
  e.preventDefault();
  initAudio();
  const [x, y] = toGame(e);
  const P = { id: e.pointerId, x, y, x0: x, y0: y, t: performance.now() };
  pts.set(e.pointerId, P);
  if (G.mode === 'title' || G.mode === 'dead') return;
  if (G.p.sleeping) return;
  const ui = G.ui;
  if (ui && (ui.kind === 'inv' || ui.kind === 'box' || ui.kind === 'fire')) {
    P.slot = slotAt(x, y);
    return;
  }
  if (ui) return;
  layoutHUD();
  const b = buttons.find((q) => inside(q, x, y));
  if (b) { P.btn = b; if (b.hold) input[b.kind] = true; return; }
  // au volant : on attrape le volant (moitié gauche), le reste de l'écran ne fait rien
  if (wheelPos) {
    if (x < view.W / 2 && !wheelGrab && Math.hypot(x - wheelPos.cx, y - wheelPos.cy) < wheelPos.r * 1.9) {
      wheelGrab = { id: e.pointerId, a0: Math.atan2(y - wheelPos.cy, x - wheelPos.cx), w0: input.wheel || 0 };
      input.wheelHeld = true;
    }
    return;
  }
  // moitié gauche de l'écran : marcher ; moitié droite : tourner le buste
  if (x < view.W / 2) { if (!stick) { stick = { id: e.pointerId, x0: x, y0: y }; input.x = input.y = input.mag = 0; } }
  else if (!aimStick) { aimStick = { id: e.pointerId, x0: x, y0: y }; input.ax = input.ay = input.amag = 0; }
}
function moveP(e) {
  const P = pts.get(e.pointerId);
  if (!P) return;
  const [x, y] = toGame(e);
  P.x = x; P.y = y;
  if (G.ui && G.ui.kind === 'map') { G.ui.dx += x - (P.lx ?? P.x0); G.ui.dy += y - (P.ly ?? P.y0); P.lx = x; P.ly = y; return; }
  // volant : il suit l'angle du doigt autour de son centre
  if (wheelGrab && wheelGrab.id === e.pointerId && wheelPos) {
    let d = Math.atan2(y - wheelPos.cy, x - wheelPos.cx) - wheelGrab.a0;
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    input.wheel = Math.max(-1, Math.min(1, wheelGrab.w0 + d / 2.6));
    // on recale l'origine pour pouvoir tourner de plus d'un demi-tour en plusieurs gestes
    if (Math.abs(d) > 1.2) { wheelGrab.a0 += d; wheelGrab.w0 = input.wheel; }
    return;
  }
  // dans l'inventaire : au-delà de 4 px, le toucher devient un glisser
  if (P.slot && !P.drag && Math.hypot(x - P.x0, y - P.y0) > 4) P.drag = startDrag(P.slot, P) || 'none';
  for (const [st, k] of [[stick, ''], [aimStick, 'a']]) {
    if (!st || st.id !== e.pointerId) continue;
    let dx = x - st.x0, dy = y - st.y0;
    const l = Math.hypot(dx, dy), max = 18;
    if (l > max) { st.x0 += (dx / l) * (l - max); st.y0 += (dy / l) * (l - max); dx = x - st.x0; dy = y - st.y0; }
    input[k ? 'amag' : 'mag'] = Math.min(1, Math.hypot(dx, dy) / max);
    input[k ? 'ax' : 'x'] = dx / max; input[k ? 'ay' : 'y'] = dy / max;
  }
}
function up(e) {
  initAudio(); // iOS : le son ne se débloque qu'à la fin d'un toucher
  const P = pts.get(e.pointerId);
  pts.delete(e.pointerId);
  if (!P) return;
  if (P.btn && P.btn.hold) { input[P.btn.kind] = false; return; }
  if (wheelGrab && wheelGrab.id === e.pointerId) { wheelGrab = null; input.wheelHeld = false; return; }
  if (stick && stick.id === e.pointerId) { stick = null; input.x = input.y = input.mag = 0; return; }
  if (aimStick && aimStick.id === e.pointerId) {
    const h = G.p.inv[G.p.sel];
    if (h && ITEMS[h.id].gun && input.amag > 0.8) fire();
    aimStick = null; input.ax = input.ay = input.amag = 0; return;
  }
  if (P.drag === true) { endDrag(slotAt(P.x, P.y)); return; }
  if (P.drag === 'none') return; // glissé depuis une case vide : rien
  const { x, y } = P;
  if (G.mode === 'title') { onStart && onStart(); return; }
  if (G.mode === 'dead') { if (performance.now() - G.deadAt > 1500) { wipe(); newGame(); } return; }
  if (G.p.sleeping) { G.p.sleeping = false; say('Vous vous levez.'); return; }
  const ui = G.ui;
  if (ui) {
    if (ui.kind === 'text') { closeUI(); return; }
    if (ui.kind === 'map') { if (Math.hypot(P.x - P.x0, P.y - P.y0) < 6) { G.ui = null; sfx('ui'); } return; }
    if (ui.kind === 'menu') {
      const b = menuButtons().find((q) => inside(q, x, y));
      if (!b) { if (!inside({ x: (view.W - 136) >> 1, y: (view.H >> 1) - 48, w: 136, h: 108 }, x, y)) { G.ui = null; menuConfirm = 0; } return; }
      if (b.act === 'drive') { G.settings.drive = G.settings.drive === 'wheel' ? 'stick' : 'wheel'; try { localStorage.setItem('thelast-settings', JSON.stringify(G.settings)); } catch (er) { /* rien */ } }
      if (b.act === 'resume') { G.ui = null; menuConfirm = 0; }
      if (b.act === 'sound') { G.muted = !G.muted; setMuted(G.muted); try { localStorage.setItem('thelast-muted', G.muted ? '1' : ''); } catch (er) { /* rien */ } }
      if (b.act === 'new') { if (menuConfirm) { menuConfirm = 0; wipe(); newGame(); } else menuConfirm = 1; }
      sfx('ui');
      return;
    }
    const L = ui.L;
    if (!L) return;
    if (tip && tip.box) {
      const b = tip.box.B.find((q) => inside(q, x, y));
      if (b) { tipAction(b.act); return; }
      if (inside(tip.box, x, y)) return;
    }
    if (inside(L.close, x, y)) { closeUI(); return; }
    if (L.light && ui.kind === 'fire' && !ui.obj.fire.lit && inside(L.light, x, y)) { lightFromUI(ui.obj); return; }
    const s = slotAt(x, y);
    if (s) {
      if (s.area === 'result') { tip = null; craft(); return; }
      const k = key(s);
      tip = slotGet(s) && (!tip || tip.key !== k) ? { key: k } : null;
      if (tip) sfx('ui');
      return;
    }
    if (tip) { tip = null; return; }
    if (!inside({ x: L.x0, y: L.y0, w: L.pw, h: L.ph }, x, y)) closeUI();
    return;
  }
  const b = P.btn;
  if (!b || !inside(b, x, y)) return;
  if (b.kind === 'hot') { if (G.p.sel !== b.i) { G.p.sel = b.i; selShow = 1.6; sfx('ui'); } }
  else if (b.kind === 'act') { sfx('ui'); b.a.fn(); }
  else if (b.kind === 'use') useItem(G.p.sel);
  else if (b.kind === 'fire') fire();
  else if (b.kind === 'map') { G.ui = { kind: 'map', dx: 0, dy: 0 }; sfx('page'); }
  else if (b.kind === 'bag') { G.ui = { kind: 'inv' }; sfx('open'); }
  else if (b.kind === 'menu') { G.ui = { kind: 'menu' }; sfx('ui'); }
}

function lightFromUI(o) {
  const tool = G.p.inv.find((s) => s && (s.id === 'briquet' || s.id === 'allumettes') && s.d > 0);
  if (!tool) { say('Il faut des allumettes ou un briquet.'); return; }
  const f = o.fire;
  if (!f.burn && !(f.slots[1] && ITEMS[f.slots[1].id].fuel)) { say('Mettez du bois d\'abord.'); return; }
  tool.d--;
  if (tool.d <= 0) G.p.inv[G.p.inv.indexOf(tool)] = null;
  f.lit = true;
  refreshFires();
  sfx('ignite');
}

export function bindInput() {
  canvas.addEventListener('pointerdown', down, { passive: false });
  window.addEventListener('pointermove', moveP, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  // clavier pour tester sur ordinateur
  const keys = {};
  const upd = () => {
    const x = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.q || keys.a ? 1 : 0);
    const y = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.z || keys.w ? 1 : 0);
    const ax = (keys.l ? 1 : 0) - (keys.j ? 1 : 0), ay = (keys.k ? 1 : 0) - (keys.i ? 1 : 0);
    if (!aimStick) { const m = Math.hypot(ax, ay); input.ax = m ? ax / m : 0; input.ay = m ? ay / m : 0; input.amag = m ? 1 : 0; }
    input.sprint = !!keys.Shift; input.gas = !!keys[' ']; input.brake = !!(keys.x || keys.Control);
    if (!wheelGrab) { input.wheel = x; input.wheelHeld = !!x; } // au clavier : gauche/droite braquent
    if (stick) return;
    const l = Math.hypot(x, y);
    input.x = l ? x / l : 0; input.y = l ? y / l : 0; input.mag = l ? 1 : 0;
  };
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true; upd();
    if (G.mode !== 'play') return;
    if (e.key === 'e' && !G.ui && G.target) G.target.acts[0].fn();
    if (e.key === 'Tab') { e.preventDefault(); if (G.ui) closeUI(); else G.ui = { kind: 'inv' }; }
    if (e.key === 'Escape' && G.ui) closeUI();
    if (e.key === 'f' && !G.ui) useItem(G.p.sel);
    if (e.key >= '1' && e.key <= '9') G.p.sel = +e.key - 1;
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; upd(); });
}
