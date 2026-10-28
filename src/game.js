// Règles du jeu : déplacement, collisions, interactions, actions longues, survie, météo, feux, sauvegarde.
import { G, newPlayer, say, addTo, has, held, holding, hour, count, take } from './state.js';
import { generate, W, SOLID, LABEL, CONTAINERS } from './world.js';
import { ITEMS, makeStack, COOK_TIME, NOTES, PHOTOS, JOURNALS, BROADCASTS } from './items.js';
import { isWater } from './sprites/tiles.js';
import { DIRS, angleFromWorld, dirOfAngle, WALK_CYCLE, RUN_CYCLE } from './sprites/player.js';
import { sfx, setEngine } from './audio.js';
import { carSize } from './sprites/cars.js';
import { isRoad } from './sprites/tiles.js';

const SAVE_KEY = 'thelast-save-v4'; // v4 : grande carte, étages ; on ne sauve que les différences
const R = 0.17; // demi-taille du joueur (tuiles)
const TWIST_MAX = Math.PI / 2; // le buste tourne au plus d'un quart de tour par rapport aux jambes
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const clamp = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
export const START_NOTE = 'Les bus sont partis il y a trois jours. Personne n\'est revenu. Moi, je suis resté. Je ne sais pas encore pourquoi.';

// ---------------------------------------------------------------- partie
export function newGame(keep) {
  if (!keep) { G.seed = (Math.random() * 1e9) | 0; G.world = generate(G.seed); }
  G.p = newPlayer(G.world.start[0], G.world.start[1]);
  G.time = 8 * 60;
  // le courant tient encore deux à cinq jours, puis la ville s'éteint
  G.powerOff = (2 + Math.random() * 3) * 1440 + 19 * 60;
  G.weather = { rain: 0, target: 0, next: 240 };
  G.radio = 0;
  G.ui = { kind: 'text', title: 'Jour 1', text: START_NOTE + '\n\nLa ville est à vous. Trouvez à manger, à boire, et un endroit où dormir.' };
  G.mode = 'play';
  G.wasPowered = true;
  refreshFires();
  save();
}

export function save() {
  if (G.mode !== 'play' || !G.world) return;
  try {
    const { cursor, act, ...p } = G.p;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: G.seed, time: G.time, weather: G.weather, radio: G.radio, powerOff: G.powerOff, p, world: G.world.diff() }));
  } catch (e) { /* stockage plein ou bloqué : on joue sans sauvegarde */ }
}
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function load() {
  try {
    const j = JSON.parse(localStorage.getItem(SAVE_KEY));
    G.seed = j.seed; G.time = j.time; G.weather = j.weather; G.radio = j.radio || 0; G.powerOff = j.powerOff || 0;
    G.world = generate(j.seed);
    G.world.applyDiff(j.world);
    G.p = { ...newPlayer(0, 0), ...j.p, act: null, cursor: null, sleeping: false, sitting: false };
    G.mode = 'play';
    G.ui = null;
    G.wasPowered = powered();
    refreshFires();
    return true;
  } catch (e) { return false; }
}
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* rien */ } }

// ---------------------------------------------------------------- collisions
// boîtes de collision d'une case, en coordonnées monde
export function cellBoxes(x, y, out, l = 0) {
  const w = G.world, L = w.lay(l);
  if (!w.inb(x, y) || !L) { out.push([x, y, x + 1, y + 1]); return; }
  const i = w.idx(x, y);
  if (isWater(L.tile[i])) { out.push([x, y, x + 1, y + 1]); return; }
  const k = L.wall[i];
  if (l && !L.tile[i] && !k) { out.push([x, y, x + 1, y + 1]); return; } // le vide, à l'étage
  if (k) {
    const m = w.mask(x, y, l), cx = x + 0.5, cy = y + 0.5;
    const t = k === W.FENCE ? 0.07 : 0.13;
    const straightX = (m & 3) === 3 && !(m & 12), straightY = (m & 12) === 12 && !(m & 3);
    if ((k === W.OPEN || k === W.DOORWAY) && (straightX || straightY)) {
      const a = 3.5 / 16;
      if (straightX) out.push([x, cy - t, x + a, cy + t], [x + 1 - a, cy - t, x + 1, cy + t]);
      else out.push([cx - t, y, cx + t, y + a], [cx - t, y + 1 - a, cx + t, y + 1]);
    } else {
      out.push([cx - t, cy - t, cx + t, cy + t]);
      if (m & 1) out.push([x, cy - t, cx, cy + t]);
      if (m & 2) out.push([cx, cy - t, x + 1, cy + t]);
      if (m & 4) out.push([cx - t, y, cx + t, cy]);
      if (m & 8) out.push([cx - t, cy, cx + t, y + 1]);
    }
  }
  const o = L.occ[i] >= 0 ? w.objs[L.occ[i]] : null;
  if (o && SOLID[o.type]) {
    const s = SOLID[o.type];
    out.push([x + 0.5 - s, y + 0.5 - s, x + 0.5 + s, y + 0.5 + s]);
  }
}

const boxes = [];
function hit(x, y, r, l = G.p ? G.p.l || 0 : 0) {
  boxes.length = 0;
  for (let cy = Math.floor(y - r) - 1; cy <= Math.floor(y + r) + 1; cy++) for (let cx = Math.floor(x - r) - 1; cx <= Math.floor(x + r) + 1; cx++) cellBoxes(cx, cy, boxes, l);
  for (const b of boxes) if (x + r > b[0] && x - r < b[2] && y + r > b[1] && y - r < b[3]) return b;
  return null;
}
function move(p, vx, vy, dt) {
  let nx = p.x + vx * dt;
  let b = hit(nx, p.y, R);
  if (b) nx = vx > 0 ? b[0] - R - 1e-4 : vx < 0 ? b[2] + R + 1e-4 : p.x;
  if (hit(nx, p.y, R) || (!p.l && carHit(nx, p.y, R))) nx = p.x;
  p.x = nx;
  let ny = p.y + vy * dt;
  b = hit(p.x, ny, R);
  if (b) ny = vy > 0 ? b[1] - R - 1e-4 : vy < 0 ? b[3] + R + 1e-4 : p.y;
  if (hit(p.x, ny, R) || (!p.l && carHit(p.x, ny, R))) ny = p.y;
  p.y = ny;
}

// ---------------------------------------------------------------- voitures (rectangles orientés)
export const carBox = (c, x = c.x, y = c.y, ang = c.ang) => {
  const [hl, hw] = carSize(c.v);
  return { x, y, ux: Math.cos(ang), uy: Math.sin(ang), hl, hw };
};
// deux rectangles orientés se chevauchent-ils ? (axes séparateurs)
function overlap(A, B) {
  for (const [ax, ay] of [[A.ux, A.uy], [-A.uy, A.ux], [B.ux, B.uy], [-B.uy, B.ux]]) {
    const ra = A.hl * Math.abs(A.ux * ax + A.uy * ay) + A.hw * Math.abs(-A.uy * ax + A.ux * ay);
    const rb = B.hl * Math.abs(B.ux * ax + B.uy * ay) + B.hw * Math.abs(-B.uy * ax + B.ux * ay);
    if (Math.abs((A.x - B.x) * ax + (A.y - B.y) * ay) > ra + rb) return false;
  }
  return true;
}
const aabb = (b) => ({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, ux: 1, uy: 0, hl: (b[2] - b[0]) / 2, hw: (b[3] - b[1]) / 2 });
export function carHit(x, y, r, except) {
  const me = { x, y, ux: 1, uy: 0, hl: r, hw: r };
  for (const c of G.world.cars) if (c !== except && Math.abs(c.x - x) < 3 && Math.abs(c.y - y) < 3 && overlap(carBox(c), me)) return c;
  return null;
}
// une voiture à cette place toucherait-elle un mur, un arbre, l'eau, une autre voiture ?
export function carBlocked(c, x, y, ang) {
  const A = carBox(c, x, y, ang), bx = [];
  for (let cy = Math.floor(y - 2.3); cy <= Math.floor(y + 2.3); cy++) for (let cx = Math.floor(x - 2.3); cx <= Math.floor(x + 2.3); cx++) cellBoxes(cx, cy, bx, 0);
  for (const b of bx) if (overlap(A, aabb(b))) return true;
  for (const o of G.world.cars) if (o !== c && Math.abs(o.x - x) < 5 && Math.abs(o.y - y) < 5 && overlap(A, carBox(o))) return true;
  return false;
}
// point du rectangle le plus proche (pour viser une voiture)
function nearestOnCar(c, px, py) {
  const B = carBox(c), dx = px - c.x, dy = py - c.y;
  const a = Math.max(-B.hl, Math.min(B.hl, dx * B.ux + dy * B.uy)), b = Math.max(-B.hw, Math.min(B.hw, -dx * B.uy + dy * B.ux));
  return [c.x + a * B.ux - b * B.uy, c.y + a * B.uy + b * B.ux];
}
export const driving = () => (G.p.driving >= 0 ? G.world.cars[G.p.driving] : null);

function enterCar(c) {
  const p = G.p;
  p.driving = G.world.cars.indexOf(c);
  p.sitting = false; p.act = null;
  sfx('door');
  if (c.fuel > 0) { sfx('starter'); say('Le moteur tousse, puis démarre.'); }
  else say('Le réservoir est vide. Il faut un jerrican.');
}
function exitCar() {
  const p = G.p, c = driving();
  if (Math.abs(c.speed) > 0.6) { say('Arrêtez-vous d\'abord.'); return; }
  const B = carBox(c);
  // côté conducteur, puis passager, puis derrière, puis devant
  for (const [a, b] of [[0.3, -(B.hw + 0.32)], [0.3, B.hw + 0.32], [-(B.hl + 0.35), 0], [B.hl + 0.35, 0]]) {
    const x = c.x + a * B.ux - b * B.uy, y = c.y + a * B.uy + b * B.ux;
    if (!hit(x, y, R, 0) && !carHit(x, y, R)) {
      p.x = x; p.y = y; p.driving = -1; c.speed = 0; c.steer = 0; G.lead = [0, 0];
      p.legsA = Math.atan2(B.ux - B.uy, B.ux + B.uy);
      setEngine(0, false);
      sfx('door');
      return;
    }
  }
  say('Impossible d\'ouvrir la portière ici.');
}

// Conduite : GAZ et FREIN (frein à l'arrêt = marche arrière), un volant à l'écran pour braquer
// (tourné vers la droite = la voiture tourne à droite, vu du conducteur). Modèle « bicyclette » : la voiture tourne autour de ses roues arrière, d'autant
// moins vite que le braquage est limité à haute vitesse ; elle roule en roue libre sans pédale.
const WHEELBASE = 2.3, STEER_MAX = 0.6, VMAX = 8, VREV = 3;
let emptyWarned = 0;
function drive(c, dt, input) {
  const p = G.p, w = G.world;
  const free = !(G.ui && G.ui.kind !== 'text');
  // braquage voulu : le nez vers le joystick (en marche arrière on contre-braque pour garder ce sens)
  // deux façons de braquer (réglage du menu) :
  // - joystick : le nez de la voiture va vers la direction du pouce, comme pour marcher ;
  // - volant : -1 (tout à gauche) .. 1 (tout à droite), il revient seul au centre quand on le lâche.
  if (!input.wheelHeld) input.wheel = (input.wheel || 0) * Math.max(0, 1 - dt * 5);
  const lim = STEER_MAX / (1 + Math.abs(c.speed) * 0.07);
  let want = 0;
  if (free && G.settings.drive === 'wheel') want = Math.max(-1, Math.min(1, input.wheel || 0)) * lim;
  else if (free && input.mag > 0.2) {
    const wx = input.x / 32 + input.y / 16, wy = input.y / 16 - input.x / 32;
    const d = angDiff(Math.atan2(wy, wx), c.ang);
    want = Math.max(-lim, Math.min(lim, d * 1.4)) * (c.speed < -0.1 ? -1 : 1);
  }
  c.steer = c.steer || 0;
  c.steer += Math.max(-3 * dt, Math.min(3 * dt, want - c.steer));
  // pédales
  const t = w.T(Math.floor(c.x), Math.floor(c.y));
  const rough = !isRoad(t) && t !== 6 && t !== 4;
  const vmax = rough ? 4 : VMAX;
  const gas = free && input.gas, brake = free && input.brake, fuel = c.fuel > 0;
  let a = -Math.sign(c.speed) * (rough ? 3.5 : 1.4); // roue libre
  if (gas) {
    if (c.speed < -0.3) a = 10;
    else if (fuel) a = 4.2 * Math.max(0.15, 1 - c.speed / vmax);
  } else if (brake) {
    if (c.speed > 0.3) a = -10;
    else if (fuel) a = -3 * Math.max(0.15, 1 + c.speed / VREV);
  }
  if ((gas || brake) && !fuel && G.clock - emptyWarned > 4) { emptyWarned = G.clock; say('Plus d\'essence.'); }
  const before = c.speed;
  c.speed += a * dt;
  if (!gas && !brake && Math.sign(c.speed) !== Math.sign(before)) c.speed = 0; // la roue libre s'arrête net à zéro
  if (c.speed > vmax) c.speed = Math.max(vmax, c.speed - 6 * dt);
  // déplacement : tourner autour de l'essieu arrière
  const om = (c.speed / WHEELBASE) * Math.tan(c.steer);
  const na = c.ang + om * dt;
  const dx = Math.cos(na) * c.speed * dt, dy = Math.sin(na) * c.speed * dt;
  if (!carBlocked(c, c.x + dx, c.y + dy, na)) { c.x += dx; c.y += dy; c.ang = na; }
  else if (!carBlocked(c, c.x + dx, c.y, c.ang)) { c.x += dx; c.speed *= 0.9; } // on glisse le long de l'obstacle
  else if (!carBlocked(c, c.x, c.y + dy, c.ang)) { c.y += dy; c.speed *= 0.9; }
  else {
    if (Math.abs(c.speed) > 3.5) { sfx('crash'); say('Boum.'); G.shake = Math.min(6, Math.abs(c.speed) * 0.5); }
    c.speed = -c.speed * 0.2;
  }
  // phase des roues : suit la vitesse, plafonnée à 9 images/s (au-delà l'œil croirait qu'elles s'arrêtent)
  c.wphase = (c.wphase || 0) + Math.sign(c.speed) * Math.min(Math.abs(c.speed) / 0.13, 9) * dt;
  c.fuel = Math.max(0, c.fuel - Math.abs(c.speed) * dt * 0.25);
  p.x = c.x; p.y = c.y;
  // la caméra regarde devant la voiture
  const lead = Math.max(-1.5, Math.min(4, c.speed * 0.35));
  G.lead = G.lead || [0, 0];
  G.lead[0] += (Math.cos(c.ang) * lead - G.lead[0]) * Math.min(1, dt * 2.5);
  G.lead[1] += (Math.sin(c.ang) * lead - G.lead[1]) * Math.min(1, dt * 2.5);
  setEngine(Math.min(1, Math.abs(c.speed) / VMAX), fuel);
}

// rien de solide entre le joueur et le point (hors case visée)
function clear(x0, y0, x1, y1, skip) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.07);
  const bx = [];
  for (let s = 1; s < n; s++) {
    const x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n;
    const cx = Math.floor(x), cy = Math.floor(y);
    if (skip.some(([a, b]) => a === cx && b === cy)) continue;
    bx.length = 0;
    cellBoxes(cx, cy, bx, G.p.l || 0);
    for (const b of bx) if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) return false;
  }
  return true;
}

export const facingVec = (d) => {
  const a = d * Math.PI * 2 / DIRS, cx = Math.sin(a), ct = Math.cos(a);
  const dx = (cx + ct) / 2, dy = (ct - cx) / 2, l = Math.hypot(dx, dy);
  return [dx / l, dy / l];
};

export const inBuilding = (x, y) => G.world.inside(x, y, G.p ? G.p.l || 0 : 0);

// ---------------------------------------------------------------- objets reçus / jetés
export function give(stack, quiet) {
  const rest = addTo(G.p.inv, stack);
  if (!quiet) say(`+${stack.n - (rest ? rest.n : 0)} ${ITEMS[stack.id].name}`);
  if (rest) { drop(rest); say('Sac plein : posé au sol.'); }
}
export function drop(stack) {
  const w = G.world, px = Math.floor(G.p.x), py = Math.floor(G.p.y), l = G.p.l || 0;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const o = w.obj(px + dx, py + dy, l);
    if (o && o.type === 'bag' && !addTo(o.inv, stack)) return o;
  }
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const x = px + dx, y = py + dy;
    if (!w.walkable(x, y, l) || w.obj(x, y, l)) continue;
    const o = w.addObj({ type: 'bag', x, y, l, k: 0, v: 0, inv: new Array(9).fill(null) });
    addTo(o.inv, stack);
    return o;
  }
  return null;
}

// ---------------------------------------------------------------- interactions
const cutChance = (base) => (holding('hache') || holding('pied_de_biche') ? 0.08 : base);
function hurt(chance, what) {
  if (Math.random() < chance) {
    G.p.bleeding = true; G.p.health = clamp(G.p.health - 6);
    say(`Vous vous êtes coupé ${what}. Vous saignez.`, 4);
    sfx('hurt');
  }
}
function busy(kind, dur, done, opts = {}) {
  G.p.act = { kind, t: 0, dur, done, ...opts };
  G.p.sitting = false;
}

function waterActions(source, dirty, use) {
  const a = [];
  if (holding('bouteille')) a.push({ label: 'REMPLIR', fn: () => {
    if (!use()) return;
    const s = held();
    s.n--; if (!s.n) G.p.inv[G.p.sel] = null;
    give(makeStack(dirty ? 'eau_sale' : 'eau'));
    sfx('drink');
  } });
  a.push({ label: 'BOIRE', fn: () => {
    if (!use()) return;
    G.p.thirst = clamp(G.p.thirst + (dirty ? 30 : 40));
    sfx('drink');
    say(dirty ? 'L\'eau a un goût de vase.' : 'L\'eau est fraîche.');
    if (dirty && Math.random() < 0.45) sicken();
  } });
  return a;
}
function sicken() { G.p.sick = Math.max(G.p.sick, 360); say('Vous ne vous sentez pas bien...', 4); }

function actionsFor(t) {
  const w = G.world, p = G.p;
  if (t.kind === 'car') {
    const c = t.car, a = [{ label: 'CONDUIRE', fn: () => enterCar(c) }];
    if (holding('jerrican')) a.unshift({ label: 'PLEIN', fn: () => busy('fuel', 2.5, () => {
      const j = held(), k = Math.min(j.d || 0, 100 - c.fuel);
      if (k <= 0) { say(j.d ? 'Le réservoir est déjà plein.' : 'Le jerrican est vide.'); return; }
      j.d -= k; c.fuel += k;
      say(`Réservoir : ${Math.round(c.fuel)} %.`);
    }, { anim: 'idle', sound: 'pour' }) });
    a.push({ label: 'COFFRE', fn: () => openUI({ kind: 'box', obj: c }) });
    return a;
  }
  if (t.kind === 'water') {
    const a = waterActions('eau', true, () => true);
    if (holding('canne')) a.unshift({ label: 'PÊCHER', fn: () => fish(t) });
    return a;
  }
  if (t.kind === 'wall') {
    const l = t.l || 0, L = w.lay(l), i = w.idx(t.x, t.y), k = L.wall[i];
    const setW = (v) => w.setWall(t.x, t.y, l, v);
    if (k === W.DOOR) {
      if (L.lock[i]) {
        if (holding('pied_de_biche') || holding('hache')) return [{ label: 'FORCER', fn: () => busy('force', 2.2, () => { w.setLock(t.x, t.y, l, 0); setW(W.OPEN); sfx('break'); say('La serrure a cédé.'); }, { anim: 'act' }) }];
        return [{ label: 'VERROUILLÉE', fn: () => { sfx('locked'); say('Fermée à clé. Un pied-de-biche ou une fenêtre ?'); } }];
      }
      return [{ label: 'OUVRIR', fn: () => { setW(W.OPEN); sfx('door'); } }];
    }
    if (k === W.OPEN) {
      // pas de porte refermée sur le joueur
      return [{ label: 'FERMER', fn: () => {
        const cx = t.x + 0.5, cy = t.y + 0.5;
        if (Math.abs(p.x - cx) < 0.5 + R && Math.abs(p.y - cy) < 0.5 + R) { say('Vous êtes dans le passage.'); return; }
        setW(W.DOOR); sfx('door');
      } }];
    }
    if (k === W.WINDOW) return [{ label: 'BRISER', fn: () => busy('smash', 0.7, () => { setW(W.BROKEN); sfx('glass'); hurt(cutChance(0.5), 'avec le verre'); }, { anim: 'act' }) }];
    if (k === W.BROKEN) return [{ label: 'ENJAMBER', fn: () => climb(t) }];
    return [];
  }
  const o = t.obj, type = o.type, a = [];
  const label = (LABEL[type] || '').toUpperCase();
  if (type === 'tree') {
    if (holding('hache')) a.push({ label: 'ABATTRE', fn: () => busy('chop', 3.2, () => fell(o), { anim: 'act', sound: 'chop' }) });
    if (!o.picked && o.kind !== 'pine') a.push({ label: 'BRANCHES', fn: () => busy('gather', 1.2, () => { o.picked = 1; o.dirty = 1; give(makeStack('branche', 1 + (Math.random() * 2 | 0))); }, { anim: 'act' }) });
    if (!a.length) return [];
    return a;
  }
  if (type === 'berry') {
    if ((o.regrow || 0) <= G.time) a.push({ label: 'CUEILLIR', fn: () => busy('gather', 1.4, () => { o.regrow = G.time + 2 * 1440; o.dirty = 1; give(makeStack('baies', 3 + (Math.random() * 4 | 0))); sfx('leaves'); }, { anim: 'act' }) });
    return a;
  }
  if (type === 'bush') {
    if (!o.picked) a.push({ label: 'BRANCHES', fn: () => busy('gather', 1.2, () => { o.picked = 1; o.dirty = 1; give(makeStack('branche', 1)); sfx('leaves'); }, { anim: 'act' }) });
    return a;
  }
  if (type === 'pump') return waterActions('eau', false, () => true);
  if (type === 'toilet') {
    const i = w.idx(o.x, o.y);
    return waterActions('eau', true, () => { const L = w.lay(o.l || 0); if (L.water[i] <= 0) { say('Le réservoir est vide.'); return false; } w.setWater(o.x, o.y, o.l || 0, L.water[i] - 1); return true; });
  }
  if (type === 'campfire') {
    const f = o.fire;
    if (!f.lit) a.push({ label: 'ALLUMER', fn: () => lightFire(o) });
    a.push({ label: 'FEU', fn: () => openUI({ kind: 'fire', obj: o }) });
    return a;
  }
  if (type === 'stairs') return [{ label: 'MONTER', fn: () => climbStairs(o, 1) }];
  if (type === 'stairs_down') return [{ label: 'DESCENDRE', fn: () => climbStairs(o, -1) }];
  if (type === 'carcass') {
    if (has('couteau') || has('hache')) return [{ label: 'DÉPECER', fn: () => busy('butcher', 3, () => butcher(o), { anim: 'act', sound: 'cloth' }) }];
    return [{ label: 'DÉPECER', fn: () => say('Il faut un couteau ou une hache.') }];
  }
  if (type === 'gaspump') {
    if (holding('jerrican')) return [{ label: 'REMPLIR', fn: () => busy('fuel', 2.5, () => {
      const j = held(), k = Math.min(100 - (j.d || 0), o.fuel || 0);
      if (!(o.fuel > 0)) { say('La cuve est vide.'); return; }
      j.d = (j.d || 0) + k; o.fuel -= k; o.dirty = 1;
      say(`Jerrican : ${Math.round(j.d)} %. Ça sent l'essence.`);
    }, { anim: 'idle', sound: 'pour' }) }];
    return [{ label: 'POMPE', fn: () => say('Avec un jerrican en main, on peut se servir.') }];
  }
  if (type === 'bed') a.push({ label: 'DORMIR', fn: () => sleep() });
  if (type === 'sofa' || type === 'armchair' || type === 'bench') a.push({ label: 'S\'ASSEOIR', fn: () => { p.sitting = true; say('Vous vous asseyez un moment.'); } });
  if (type === 'sink' || type === 'bathsink') {
    const i = w.idx(o.x, o.y);
    a.push(...waterActions('eau', false, () => { const L = w.lay(o.l || 0); if (L.water[i] <= 0) { say('Plus une goutte. Les tuyaux sont vides.'); return false; } w.setWater(o.x, o.y, o.l || 0, L.water[i] - 1); return true; }).slice(0, 1));
  }
  if (CONTAINERS[type] || type === 'bag') a.push({ label: type === 'bag' ? 'FOUILLER' : 'OUVRIR', sub: label, fn: () => openUI({ kind: 'box', obj: o }) });
  return a;
}

export function openUI(ui) {
  G.ui = ui;
  if (ui.obj) ui.obj.dirty = 1; // son contenu sera sauvegardé
  G.p.sitting = false;
  if (ui.kind === 'box' || ui.kind === 'fire') sfx(ui.obj.type === 'fridge' ? 'fridge' : ui.obj.type === 'car' ? 'trunk' : 'open');
}

function fish(t) {
  busy('fish', 4 + Math.random() * 6, () => {
    if (Math.random() < 0.55) { give(makeStack('poisson')); sfx('splash'); say('Ça mord ! Un poisson.'); }
    else say('Rien ne mord.');
  }, { anim: 'idle', at: [t.x + 0.5, t.y + 0.5] });
  sfx('cast');
}
function fell(o) {
  o.hits = (o.hits || 0) + 1;
  o.dirty = 1;
  if (o.hits < 3) { say(['Encore quelques coups.', 'Le tronc craque.'][o.hits - 1]); return; }
  const w = G.world;
  w.removeObj(o);
  w.addObj({ type: 'stump', x: o.x, y: o.y, k: 0, v: 0 });
  sfx('fall');
  give(makeStack('buche', o.kind === 'dead' ? 1 : 2 + (Math.random() * 2 | 0)), true);
  give(makeStack('branche', 2 + (Math.random() * 2 | 0)), true);
  say('L\'arbre tombe. Bûches et branches.');
}
function climb(t) {
  const w = G.world, p = G.p;
  const m = w.mask(t.x, t.y, t.l || 0), alongX = (m & 3) === 3;
  const cx = t.x + 0.5, cy = t.y + 0.5;
  let nx = cx, ny = cy;
  if (alongX) ny = p.y < cy ? cy + 0.62 : cy - 0.62;
  else nx = p.x < cx ? cx + 0.62 : cx - 0.62;
  if (hit(nx, ny, R)) { say('Quelque chose bloque de l\'autre côté.'); return; }
  busy('climb', 1, () => { p.x = nx; p.y = ny; hurt(0.12, 'en passant'); sfx('step'); }, { anim: 'act' });
}
function lightFire(o) {
  const f = o.fire;
  const tool = G.p.inv.find((s) => s && (s.id === 'briquet' || s.id === 'allumettes') && s.d > 0);
  if (!tool) { say('Il faut des allumettes ou un briquet.'); return; }
  if (!f.burn && !(f.slots[1] && ITEMS[f.slots[1].id].fuel)) { say('Mettez du bois dans le feu d\'abord.'); openUI({ kind: 'fire', obj: o }); return; }
  tool.d--;
  if (tool.d <= 0) { say(`${ITEMS[tool.id].name} : vide.`); G.p.inv[G.p.inv.indexOf(tool)] = null; }
  f.lit = true;
  sfx('ignite');
  say('Le feu prend. Ça réchauffe.');
}
function climbStairs(o, dir) {
  const p = G.p;
  busy('stairs', 0.6, () => {
    p.l = o.to;
    p.x = o.x + 0.5; p.y = o.y + 1.5;
    sfx('stairs');
    if (dir > 0 && p.l === 1) say('Vous montez. Le parquet craque.');
  }, { anim: 'idle' });
}
function butcher(o) {
  const deer = o.kind === 'deer';
  G.world.removeObj(o);
  give(makeStack('viande', deer ? 4 + (Math.random() * 2 | 0) : 1));
  say(deer ? 'Un travail ingrat. De quoi manger plusieurs jours.' : 'Un peu de viande.');
}
function sleep() {
  const p = G.p;
  if (p.energy > 80) { say('Vous n\'avez pas sommeil.'); return; }
  p.sleeping = true;
  p.act = null;
  say('Vous fermez les yeux...', 2);
}

// choix de la cible la plus proche, devant le joueur de préférence
export function findTarget() {
  const w = G.world, p = G.p;
  const [fx, fy] = facingVec(p.dir);
  const px = Math.floor(p.x), py = Math.floor(p.y);
  let best = null, bestS = 1e9;
  const consider = (t, tx, ty, reach, skip) => {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > reach) return;
    const s = d - 0.45 * ((dx * fx + dy * fy) / (d || 1));
    if (s >= bestS) return;
    if (!clear(p.x, p.y, tx, ty, skip)) return;
    const acts = actionsFor(t);
    if (!acts.length) return;
    t.acts = acts; best = t; bestS = s;
  };
  const l = p.l || 0, L = w.lay(l);
  for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) {
    if (!w.inb(x, y)) continue;
    const i = w.idx(x, y);
    const k = L.wall[i];
    if (k >= W.WINDOW && k <= W.OPEN) consider({ kind: 'wall', x, y, l }, x + 0.5, y + 0.5, 1.1, [[x, y]]);
    const o = L.occ[i] >= 0 ? w.objs[L.occ[i]] : null;
    if (o) {
      const solid = SOLID[o.type] || 0;
      // le point le plus proche de la boîte de l'objet
      const tx = Math.max(x + 0.5 - solid, Math.min(x + 0.5 + solid, p.x)), ty = Math.max(y + 0.5 - solid, Math.min(y + 0.5 + solid, p.y));
      consider({ kind: 'obj', obj: o, x, y }, tx, ty, 0.95, o.cells);
    }
    if (!l && isWater(w.tile[i])) {
      const tx = Math.max(x, Math.min(x + 1, p.x)), ty = Math.max(y, Math.min(y + 1, p.y));
      consider({ kind: 'water', x, y }, tx, ty, 0.7, [[x, y]]);
    }
  }
  for (const c of l ? [] : w.cars) {
    if (Math.abs(c.x - p.x) > 3.5 || Math.abs(c.y - p.y) > 3.5) continue;
    const [tx, ty] = nearestOnCar(c, p.x, p.y);
    consider({ kind: 'car', car: c, x: Math.floor(tx), y: Math.floor(ty) }, tx, ty, 0.95, []);
  }
  return best;
}

// ---------------------------------------------------------------- objets utilisés
export function useItem(slot) {
  const p = G.p, s = p.inv[slot];
  if (!s) return;
  const def = ITEMS[s.id], u = def.use;
  if (!u) return;
  const consume = () => {
    s.n--;
    if (!s.n) p.inv[slot] = null;
    if (u.leaves) give(makeStack(u.leaves), true);
  };
  if (def.gun) { reload(s); return; }
  if (u.needs && !u.needs.some(has)) { say('Il faut un ouvre-boîte ou un couteau.'); return; }
  if (u.text) { readText(s); return; }
  if (s.id === 'radio') { listen(s); return; }
  if (s.id === 'livre') {
    busy('read', 6, () => {
      p.moral = clamp(p.moral + (s.read ? 3 : u.moral));
      say(s.read ? 'Vous relisez quelques pages.' : 'Une belle histoire. Vous êtes ailleurs, un moment.');
      s.read = 1;
    }, { anim: 'idle', scale: 7 });
    sfx('page');
    return;
  }
  if (u.place) { placeFire(slot); return; }
  if (u.verb === 'SOIGNER') {
    if (!p.bleeding && !u.health) { say('Vous ne saignez pas.'); return; }
    consume();
    if (p.bleeding && (u.stopBleed === true || Math.random() < u.stopBleed)) { p.bleeding = false; say('Le saignement s\'arrête.'); }
    else if (p.bleeding) say('Ça saigne encore...');
    p.health = clamp(p.health + (u.health || 0));
    sfx('cloth');
    return;
  }
  consume();
  p.hunger = clamp(p.hunger + (u.hunger || 0));
  p.thirst = clamp(p.thirst + (u.thirst || 0));
  p.moral = clamp(p.moral + (u.moral || 0));
  p.health = clamp(p.health + (u.health || 0));
  if (u.cure) p.sick = Math.max(0, p.sick - 300);
  if (u.sick && Math.random() < u.sick) sicken();
  sfx(u.verb === 'BOIRE' ? 'drink' : u.verb === 'AVALER' ? 'pill' : 'eat');
}

function readText(s) {
  let text;
  if (s.id === 'note') text = s.d < 0 ? START_NOTE : NOTES[s.d % NOTES.length];
  else if (s.id === 'photo') text = PHOTOS[s.d % PHOTOS.length];
  else text = JOURNALS[(s.d || 0) % JOURNALS.length];
  if (!s.read) { G.p.moral = clamp(G.p.moral + (s.id === 'photo' ? 3 : 2)); s.read = 1; }
  G.ui = { kind: 'text', title: ITEMS[s.id].name, text };
  sfx('page');
}
function listen(s) {
  if (!(s.d > 0)) { say('Les piles sont mortes.'); return; }
  s.d = Math.max(0, s.d - 12);
  const text = BROADCASTS[G.radio % BROADCASTS.length];
  G.radio++;
  G.p.moral = clamp(G.p.moral + 6);
  sfx('radio');
  G.ui = { kind: 'text', title: 'Radio', text };
}
function placeFire(slot) {
  const p = G.p, w = G.world;
  const [fx, fy] = facingVec(p.dir);
  const x = Math.floor(p.x + fx * 0.9), y = Math.floor(p.y + fy * 0.9);
  if (p.l || w.roomAt(x, y) >= 0 || w.inside(p.x, p.y) >= 0) { say('Pas de feu à l\'intérieur.'); return; }
  if (!w.canPlace('campfire', x, y, 0) || Math.abs(x + 0.5 - p.x) < 0.5 + R && Math.abs(y + 0.5 - p.y) < 0.5 + R) { say('Pas assez de place ici.'); return; }
  const s = p.inv[slot];
  s.n--; if (!s.n) p.inv[slot] = null;
  w.addObj({ type: 'campfire', x, y, k: 0, v: 0, fire: { lit: false, burn: 0, slots: [null, makeStack('branche', 2), null], prog: 0 } });
  refreshFires();
  sfx('wood');
  say('Feu de camp installé. Il faut l\'allumer.');
}

// ---------------------------------------------------------------- feux
let fires = [];
export function refreshFires() { fires = G.world.objs.filter((o) => o && o.type === 'campfire'); }
export const litFires = () => fires.filter((o) => o.fire.lit);
function updateFires(dm) {
  for (const o of fires) {
    const f = o.fire;
    if (!f.lit) continue;
    f.burn -= dm;
    if (f.burn <= 0) {
      const fuel = f.slots[1];
      if (fuel && ITEMS[fuel.id].fuel) {
        f.burn += ITEMS[fuel.id].fuel;
        fuel.n--; if (!fuel.n) f.slots[1] = null;
      } else { f.lit = false; f.burn = 0; f.prog = 0; continue; }
    }
    const inp = f.slots[0], out = f.slots[2];
    const res = inp && ITEMS[inp.id].cook;
    if (res && (!out || (out.id === res && out.n < ITEMS[res].stack))) {
      f.prog += dm;
      if (f.prog >= COOK_TIME) {
        f.prog = 0;
        inp.n--; if (!inp.n) f.slots[0] = null;
        if (out) out.n++; else f.slots[2] = makeStack(res);
      }
    } else f.prog = 0;
  }
}

// ---------------------------------------------------------------- armes à feu
// direction de tir : la visée du joystick droit, sinon là où regarde le buste
const aimVec = () => G.p.aimW || facingVec(G.p.dir);
export function fire() {
  const p = G.p, s = held(), g = s && ITEMS[s.id].gun;
  if (!g || driving() || p.act || p.sleeping) return;
  if (G.clock - (p.lastShot || 0) < g.delay) return;
  p.lastShot = G.clock;
  if (!(s.d > 0)) { sfx('dry'); say('Clic. Chargeur vide : RECHARGER.'); return; }
  s.d--;
  const [ax, ay] = aimVec(), base = Math.atan2(ay, ax);
  const ox = p.x + ax * 0.35, oy = p.y + ay * 0.35;
  for (let k = 0; k < g.pellets; k++) ray(ox, oy, base + (Math.random() - 0.5) * 2 * g.spread, g.range * (0.85 + Math.random() * 0.15), g.dmg);
  G.flash = { t: 0.07, x: ox + ax * 0.3, y: oy + ay * 0.3, l: p.l || 0 };
  G.shake = Math.max(G.shake || 0, s.id === 'pistolet' ? 1.5 : 3);
  sfx(g.sound);
  scare(p.x, p.y, 32);
}
function ray(x0, y0, ang, range, dmg) {
  const w = G.world, l = G.p.l || 0, dx = Math.cos(ang), dy = Math.sin(ang), bx = [];
  let x = x0, y = y0, hitWhat = null;
  for (let d = 0; d < range; d += 0.1) {
    x = x0 + dx * d; y = y0 + dy * d;
    if (!l) {
      const a = w.animals.find((q) => Math.hypot(q.x - x, q.y - y) < (q.type === 'deer' ? 0.6 : 0.32));
      if (a) { hurtAnimal(a, dmg); hitWhat = 'flesh'; break; }
      if (d > 0.4 && carHit(x, y, 0.02)) { hitWhat = 'metal'; break; }
    }
    const cx = Math.floor(x), cy = Math.floor(y);
    bx.length = 0;
    cellBoxes(cx, cy, bx, l);
    if (bx.some((b) => x > b[0] && x < b[2] && y > b[1] && y < b[3])) {
      if (w.Wk(cx, cy, l) === W.WINDOW) { w.setWall(cx, cy, l, W.BROKEN); sfx('glass'); }
      hitWhat = 'wall';
      break;
    }
  }
  G.fx.push({ kind: 'tracer', x0, y0, x1: x, y1: y, l, t: 0.07 });
  if (hitWhat) G.fx.push({ kind: hitWhat === 'flesh' ? 'blood' : 'spark', x, y, l, t: 0.25 });
}
function reload(s) {
  const g = ITEMS[s.id].gun, need = g.cap - (s.d || 0), have = count(G.p.inv, g.ammo);
  if (need <= 0) { say('Le chargeur est plein.'); return; }
  if (!have) { say(`Plus de ${ITEMS[g.ammo].name.toLowerCase()}.`); return; }
  sfx('reload');
  busy('reload', g.reload, () => { const k = Math.min(need, count(G.p.inv, g.ammo)); take(g.ammo, k); s.d = (s.d || 0) + k; sfx('reload'); say(`${s.d}/${g.cap}`); }, { anim: 'idle' });
}

// ---------------------------------------------------------------- animaux
// broutent, se promènent, fuient le joueur (plus loin s'il court ou conduit) et les coups de feu
function scare(x, y, r) {
  for (const a of G.world.animals) if (Math.hypot(a.x - x, a.y - y) < r) { a.state = 'flee'; a.t = 4 + Math.random() * 3; a.from = [x, y]; }
}
function hurtAnimal(a, dmg) {
  a.hp -= dmg;
  a.state = 'flee'; a.t = 6; a.from = [G.p.x, G.p.y];
  if (a.hp > 0) { say('Touché. Il s\'enfuit en boitant.'); a.wounded = 1; return; }
  const w = G.world, x = Math.floor(a.x), y = Math.floor(a.y);
  w.animals.splice(w.animals.indexOf(a), 1);
  const o = w.addObj({ type: 'carcass', kind: a.type, x, y, k: 0, v: 0 });
  if (w.occ[w.idx(x, y)] !== o.id) { w.removeObj(o); drop(makeStack('viande', a.type === 'deer' ? 4 : 1)); }
  say(a.type === 'deer' ? 'Le cerf s\'effondre.' : 'Le lapin ne bouge plus.');
  sfx('thud');
}
function updateAnimals(dt) {
  const p = G.p, w = G.world, car = driving();
  for (const a of w.animals) {
    const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy);
    if (d > 48) continue; // figés au loin
    const fearR = (a.type === 'deer' ? 7 : 3.5) * (p.running ? 1.6 : 1) * (car && Math.abs(car.speed) > 1 ? 2 : 1) * (p.l ? 0 : 1);
    if (d < fearR && a.state !== 'flee') { a.state = 'flee'; a.t = 3 + Math.random() * 3; a.from = [p.x, p.y]; }
    a.t -= dt;
    let sp = 0;
    if (a.state === 'graze') { if (a.t <= 0) { a.state = 'walk'; a.ang = Math.random() * Math.PI * 2; a.t = 2 + Math.random() * 4; } }
    else if (a.state === 'walk') { sp = a.type === 'deer' ? 0.8 : 1.1; if (a.t <= 0) { a.state = 'graze'; a.t = 3 + Math.random() * 8; } }
    else {
      const f = a.from || [p.x, p.y];
      a.ang = Math.atan2(a.y - f[1], a.x - f[0]) + Math.sin(G.clock * 2 + a.x) * 0.4;
      sp = (a.type === 'deer' ? 5.4 : 4.4) * (a.wounded ? 0.6 : 1);
      if (a.t <= 0 && d > fearR) { a.state = 'graze'; a.t = 2 + Math.random() * 4; }
    }
    a.moving = sp > 0;
    if (!sp) continue;
    const nx = a.x + Math.cos(a.ang) * sp * dt, ny = a.y + Math.sin(a.ang) * sp * dt;
    const r = a.type === 'deer' ? 0.32 : 0.15;
    if (hit(nx, ny, r, 0) || carHit(nx, ny, r) || w.inside(nx, ny, 0) >= 0) { a.ang += Math.PI / 2 + Math.random(); continue; }
    a.x = nx; a.y = ny;
    a.anim = (a.anim || 0) + dt * sp * (a.type === 'deer' ? 0.6 : 1.4);
  }
}

// ---------------------------------------------------------------- électricité
export const powered = () => G.time < (G.powerOff || 0);

// ---------------------------------------------------------------- boucle
let saveT = 0, sayT = 0;
export function update(dt, input) {
  const p = G.p, w = G.world;
  // échelle de temps : sommeil et lecture accélèrent l'horloge
  let scale = 1;
  if (p.sleeping) scale = 60;
  else if (p.act && p.act.scale) scale = p.act.scale;
  const dm = dt * scale;
  G.time += dm;

  // au volant : la voiture remplace la marche
  const car = driving();
  if (car) {
    drive(car, dt, input);
    p.moving = false; p.aiming = false;
    G.target = { kind: 'drive', x: Math.floor(car.x), y: Math.floor(car.y), acts: [{ label: 'SORTIR', fn: exitCar }] };
  }
  // déplacement
  p.moving = false;
  p.back = false;
  p.running = false;
  const blocked = G.ui && G.ui.kind !== 'text' ? true : false;
  // visée (joystick droit) : angle dans le plan caméra, 0 = vers la caméra
  const aiming = !car && !p.sleeping && !blocked && input.amag > 0.3;
  const aimA = aiming ? Math.atan2(input.ax, input.ay * 2) : null;
  if (p.legsA === undefined) p.legsA = p.dir * Math.PI / 4;
  if (!car && !p.sleeping && !blocked && input.mag > 0.15) {
    if (p.act && !p.act.locked) { p.act = null; }
    p.sitting = false;
    // joystick en écran -> monde (iso 2:1)
    const sx = input.x, sy = input.y;
    let wx = sx / 32 + sy / 16, wy = sy / 16 - sx / 32;
    const l = Math.hypot(wx, wy) || 1;
    wx /= l; wy /= l;
    let speed = 2.1 * Math.min(1, 0.35 + input.mag * 0.75);
    if (p.energy < 10) speed *= 0.6;
    if (p.health < 25) speed *= 0.75;
    const moveA = angleFromWorld(wx, wy);
    p.legsA = moveA;
    // viser loin derrière soi : on se retourne et on marche à reculons, moins vite
    if (aiming && Math.abs(angDiff(aimA, moveA)) > TWIST_MAX + 0.18) { p.legsA = moveA + Math.PI; p.back = true; speed *= 0.55; }
    // sprint : pas en visant, pas à reculons, pas à bout de forces
    p.running = !!input.sprint && !aiming && !p.back && input.mag > 0.5;
    if (p.running && p.energy < 12) {
      p.running = false;
      if (G.clock - (p.puffT || 0) > 6) { p.puffT = G.clock; say('Vous êtes à bout de souffle.'); }
    }
    if (p.running) {
      speed *= 1.8;
      p.energy = clamp(p.energy - 0.3 * dt);
      p.thirst = clamp(p.thirst - 0.05 * dt);
    }
    move(p, wx * speed, wy * speed, dt);
    p.moving = true;
    // un cycle d'animation = deux pas = WALK_CYCLE (ou RUN_CYCLE) cases : les pieds ne glissent pas
    const k = 1 / (p.running ? RUN_CYCLE : WALK_CYCLE);
    p.anim += dt * speed * k;
    if (Math.floor(p.anim * 2) !== Math.floor((p.anim - dt * speed * k) * 2)) {
      const cx = Math.floor(p.x), cy = Math.floor(p.y);
      sfx('step', { t: w.T(cx, cy, p.l || 0), leaves: !p.l && w.litter[w.idx(cx, cy)] > 0, run: p.running, foot: (p.foot = !p.foot) });
    }
  } else {
    p.anim += dt;
    // à l'arrêt, les pieds pivotent quand le buste arrive en butée
    if (aiming) {
      const d = angDiff(aimA, p.legsA);
      if (Math.abs(d) > TWIST_MAX) p.legsA = aimA - Math.sign(d) * TWIST_MAX;
    }
  }
  // buste : suit la visée, au plus à 90° des jambes
  const torsoA = aiming ? p.legsA + Math.max(-TWIST_MAX, Math.min(TWIST_MAX, angDiff(aimA, p.legsA))) : p.legsA;
  p.legs = dirOfAngle(p.legsA);
  p.dir = dirOfAngle(torsoA);
  let off = (((p.dir - p.legs) % 8) + 8) % 8;
  if (off > 4) off -= 8;
  p.twist = Math.max(-2, Math.min(2, off));
  p.aiming = aiming;
  if (aiming) {
    const wx = input.ax / 32 + input.ay / 16, wy = input.ay / 16 - input.ax / 32, l2 = Math.hypot(wx, wy) || 1;
    // la visée suit le buste (limité à 90° des jambes)
    const [fx, fy] = facingVec(p.dir), aw = [wx / l2, wy / l2];
    p.aimW = aw[0] * fx + aw[1] * fy > 0.3 ? aw : [fx, fy];
  } else p.aimW = null;

  // action en cours
  if (p.act) {
    const a = p.act;
    a.t += dt;
    if (a.sound && Math.floor(a.t / 0.8) !== Math.floor((a.t - dt) / 0.8)) sfx(a.sound);
    if (a.t >= a.dur) { p.act = null; a.done(); }
  }

  // sommeil
  if (p.sleeping) {
    p.energy = clamp(p.energy + 0.22 * dm);
    if (p.energy >= 99.5) wake('Vous vous réveillez reposé.');
    else if (p.hunger <= 2 || p.thirst <= 2) wake('La faim vous réveille.');
    else if (p.health < 15) wake('Vous vous réveillez en sueur.');
  }

  // survie (par minute de jeu)
  const inside = inBuilding(p.x, p.y) >= 0;
  const h = hour(), night = h < 6 || h > 20.5;
  const sleepK = p.sleeping ? 0.45 : 1;
  p.hunger = clamp(p.hunger - 0.042 * dm * sleepK);
  p.thirst = clamp(p.thirst - 0.065 * dm * sleepK);
  if (!p.sleeping) p.energy = clamp(p.energy - (p.sitting ? -0.06 : p.act ? 0.09 : 0.055) * dm * (p.moral < 20 ? 1.3 : 1));
  let dMoral = -0.006;
  if (night && !inside) dMoral -= 0.018;
  if (G.weather.rain > 0.2 && !inside) dMoral -= 0.012;
  if (inside) dMoral += 0.004;
  if (p.sitting) dMoral += 0.02;
  if (p.sick) dMoral -= 0.02;
  for (const o of fires) if (o.fire.lit && Math.hypot(o.x + 0.5 - p.x, o.y + 0.5 - p.y) < 3) { dMoral += 0.06; break; }
  if (!p.sleeping) p.moral = clamp(p.moral + dMoral * dm);
  let dH = 0;
  if (p.hunger <= 0) dH -= 0.07;
  if (p.thirst <= 0) dH -= 0.12;
  if (p.bleeding) dH -= 0.22;
  if (p.sick) dH -= 0.025;
  if (p.energy <= 0) dH -= 0.04;
  if (p.moral <= 0) dH -= 0.02;
  if (dH === 0 && p.hunger > 35 && p.thirst > 35) dH = p.sleeping ? 0.08 : 0.03;
  p.health = clamp(p.health + dH * dm);
  if (p.sick) p.sick = Math.max(0, p.sick - dm);

  // petites alertes
  sayT -= dt;
  if (sayT <= 0 && !p.sleeping) {
    sayT = 40;
    if (p.thirst < 15) say('Vous avez très soif.');
    else if (p.hunger < 15) say('Votre ventre gargouille.');
    else if (p.energy < 12) say('Vous tombez de fatigue.');
    else if (p.moral < 15) say(['Le silence est assourdissant.', 'Vous pensez à ceux qui sont partis.', 'Vous parlez tout seul, pour entendre une voix.'][(Math.random() * 3) | 0], 4);
  }

  // météo
  const wt = G.weather;
  wt.next -= dm;
  if (wt.next <= 0) {
    wt.target = Math.random() < 0.35 ? 0.4 + Math.random() * 0.6 : 0;
    wt.next = 120 + Math.random() * 420;
  }
  wt.rain += Math.sign(wt.target - wt.rain) * Math.min(Math.abs(wt.target - wt.rain), 0.006 * dm);

  // la lampe tenue s'use la nuit (environ deux nuits pour une charge pleine)
  const lamp = held();
  if (lamp && lamp.id === 'lampe' && lamp.d > 0 && night) {
    lamp.d = Math.max(0, lamp.d - 0.06 * dm);
    if (!lamp.d) say('La lampe s\'éteint. Il faut des piles.');
  }

  updateFires(dm);
  updateAnimals(dt);
  for (const f of G.fx) f.t -= dt;
  G.fx = G.fx.filter((f) => f.t > 0);
  if (G.flash) { G.flash.t -= dt; if (G.flash.t <= 0) G.flash = null; }
  // la nuit où le courant saute
  const pw = powered();
  if (G.wasPowered && !pw) { say('Un claquement sourd. Les lumières de la ville s\'éteignent, pour de bon.', 6); sfx('powerdown'); }
  G.wasPowered = pw;
  G.swayT += dt * (1 + Math.min(1.5, wt.rain * 1.5) * 1.2);

  if (car) { /* la cible est la sortie */ }
  else if (!p.act && !p.sleeping && !blocked) G.target = findTarget();
  else if (!p.act) G.target = null;

  for (const m of G.msgs) m.t -= dt;
  G.msgs = G.msgs.filter((m) => m.t > 0);

  if (p.health <= 0) { G.mode = 'dead'; G.deadAt = performance.now(); G.ui = null; p.sleeping = false; wipe(); sfx('death'); return; }
  saveT += dt;
  if (saveT > 20) { saveT = 0; save(); }
}
function wake(msg) { G.p.sleeping = false; say(msg); save(); }
