// Règles du jeu : déplacement, collisions, interactions, actions longues, survie, météo, feux, sauvegarde.
import { G, newPlayer, say, addTo, has, held, holding, hour } from './state.js';
import { World, generate, W, SOLID, LABEL, CONTAINERS } from './world.js';
import { ITEMS, makeStack, COOK_TIME, NOTES, PHOTOS, JOURNALS, BROADCASTS } from './items.js';
import { isWater } from './sprites/tiles.js';
import { DIRS, angleFromWorld, dirOfAngle } from './sprites/player.js';
import { sfx } from './audio.js';

const SAVE_KEY = 'thelast-save-v2'; // v2 : routes élargies, voitures 4x2
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
  G.weather = { rain: 0, target: 0, next: 240 };
  G.radio = 0;
  G.ui = { kind: 'text', title: 'Jour 1', text: START_NOTE + '\n\nLa ville est à vous. Trouvez à manger, à boire, et un endroit où dormir.' };
  G.mode = 'play';
  refreshFires();
  save();
}

export function save() {
  if (G.mode !== 'play' || !G.world) return;
  try {
    const { cursor, act, ...p } = G.p;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: G.seed, time: G.time, weather: G.weather, radio: G.radio, p, world: G.world.toJSON() }));
  } catch (e) { /* stockage plein ou bloqué : on joue sans sauvegarde */ }
}
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function load() {
  try {
    const j = JSON.parse(localStorage.getItem(SAVE_KEY));
    G.seed = j.seed; G.time = j.time; G.weather = j.weather; G.radio = j.radio || 0;
    G.world = World.fromJSON(j.world);
    G.p = { ...newPlayer(0, 0), ...j.p, act: null, cursor: null, sleeping: false, sitting: false };
    G.mode = 'play';
    G.ui = null;
    refreshFires();
    return true;
  } catch (e) { return false; }
}
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* rien */ } }

// ---------------------------------------------------------------- collisions
// boîtes de collision d'une case, en coordonnées monde
export function cellBoxes(x, y, out) {
  const w = G.world;
  if (!w.inb(x, y)) { out.push([x, y, x + 1, y + 1]); return; }
  const i = w.idx(x, y);
  if (isWater(w.tile[i])) { out.push([x, y, x + 1, y + 1]); return; }
  const k = w.wall[i];
  if (k) {
    const m = w.mask(x, y), cx = x + 0.5, cy = y + 0.5;
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
  const o = w.occ[i] >= 0 ? w.objs[w.occ[i]] : null;
  if (o && SOLID[o.type]) {
    const s = SOLID[o.type];
    out.push([x + 0.5 - s, y + 0.5 - s, x + 0.5 + s, y + 0.5 + s]);
  }
}

const boxes = [];
function hit(x, y, r) {
  boxes.length = 0;
  for (let cy = Math.floor(y - r) - 1; cy <= Math.floor(y + r) + 1; cy++) for (let cx = Math.floor(x - r) - 1; cx <= Math.floor(x + r) + 1; cx++) cellBoxes(cx, cy, boxes);
  for (const b of boxes) if (x + r > b[0] && x - r < b[2] && y + r > b[1] && y - r < b[3]) return b;
  return null;
}
function move(p, vx, vy, dt) {
  let nx = p.x + vx * dt;
  let b = hit(nx, p.y, R);
  if (b) nx = vx > 0 ? b[0] - R - 1e-4 : vx < 0 ? b[2] + R + 1e-4 : p.x;
  if (hit(nx, p.y, R)) nx = p.x;
  p.x = nx;
  let ny = p.y + vy * dt;
  b = hit(p.x, ny, R);
  if (b) ny = vy > 0 ? b[1] - R - 1e-4 : vy < 0 ? b[3] + R + 1e-4 : p.y;
  if (hit(p.x, ny, R)) ny = p.y;
  p.y = ny;
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
    cellBoxes(cx, cy, bx);
    for (const b of bx) if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) return false;
  }
  return true;
}

export const facingVec = (d) => {
  const a = d * Math.PI * 2 / DIRS, cx = Math.sin(a), ct = Math.cos(a);
  const dx = (cx + ct) / 2, dy = (ct - cx) / 2, l = Math.hypot(dx, dy);
  return [dx / l, dy / l];
};

export const inBuilding = (x, y) => G.world.inside(x, y);

// ---------------------------------------------------------------- objets reçus / jetés
export function give(stack, quiet) {
  const rest = addTo(G.p.inv, stack);
  if (!quiet) say(`+${stack.n - (rest ? rest.n : 0)} ${ITEMS[stack.id].name}`);
  if (rest) { drop(rest); say('Sac plein : posé au sol.'); }
}
export function drop(stack) {
  const w = G.world, px = Math.floor(G.p.x), py = Math.floor(G.p.y);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const o = w.obj(px + dx, py + dy);
    if (o && o.type === 'bag' && !addTo(o.inv, stack)) return o;
  }
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const x = px + dx, y = py + dy;
    if (!w.inb(x, y) || w.occ[w.idx(x, y)] >= 0 || isWater(w.T(x, y)) || (w.wall[w.idx(x, y)] && w.wall[w.idx(x, y)] !== W.DOORWAY && w.wall[w.idx(x, y)] !== W.OPEN)) continue;
    const o = w.addObj({ type: 'bag', x, y, k: 0, v: 0, inv: new Array(9).fill(null) });
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
  if (t.kind === 'water') {
    const a = waterActions('eau', true, () => true);
    if (holding('canne')) a.unshift({ label: 'PÊCHER', fn: () => fish(t) });
    return a;
  }
  if (t.kind === 'wall') {
    const i = w.idx(t.x, t.y), k = w.wall[i];
    if (k === W.DOOR) {
      if (w.lock[i]) {
        if (holding('pied_de_biche') || holding('hache')) return [{ label: 'FORCER', fn: () => busy('force', 2.2, () => { w.lock[i] = 0; w.wall[i] = W.OPEN; sfx('break'); say('La serrure a cédé.'); }, { anim: 'act' }) }];
        return [{ label: 'VERROUILLÉE', fn: () => { sfx('locked'); say('Fermée à clé. Un pied-de-biche ou une fenêtre ?'); } }];
      }
      return [{ label: 'OUVRIR', fn: () => { w.wall[i] = W.OPEN; sfx('door'); } }];
    }
    if (k === W.OPEN) {
      // pas de porte refermée sur le joueur
      return [{ label: 'FERMER', fn: () => {
        const cx = t.x + 0.5, cy = t.y + 0.5;
        if (Math.abs(p.x - cx) < 0.5 + R && Math.abs(p.y - cy) < 0.5 + R) { say('Vous êtes dans le passage.'); return; }
        w.wall[i] = W.DOOR; sfx('door');
      } }];
    }
    if (k === W.WINDOW) return [{ label: 'BRISER', fn: () => busy('smash', 0.7, () => { w.wall[i] = W.BROKEN; sfx('glass'); hurt(cutChance(0.5), 'avec le verre'); }, { anim: 'act' }) }];
    if (k === W.BROKEN) return [{ label: 'ENJAMBER', fn: () => climb(t) }];
    return [];
  }
  const o = t.obj, type = o.type, a = [];
  const label = (LABEL[type] || '').toUpperCase();
  if (type === 'tree') {
    if (holding('hache')) a.push({ label: 'ABATTRE', fn: () => busy('chop', 3.2, () => fell(o), { anim: 'act', sound: 'chop' }) });
    if (!o.picked && o.kind !== 'pine') a.push({ label: 'BRANCHES', fn: () => busy('gather', 1.2, () => { o.picked = 1; give(makeStack('branche', 1 + (Math.random() * 2 | 0))); }, { anim: 'act' }) });
    if (!a.length) return [];
    return a;
  }
  if (type === 'berry') {
    if ((o.regrow || 0) <= G.time) a.push({ label: 'CUEILLIR', fn: () => busy('gather', 1.4, () => { o.regrow = G.time + 2 * 1440; give(makeStack('baies', 3 + (Math.random() * 4 | 0))); sfx('leaves'); }, { anim: 'act' }) });
    return a;
  }
  if (type === 'bush') {
    if (!o.picked) a.push({ label: 'BRANCHES', fn: () => busy('gather', 1.2, () => { o.picked = 1; give(makeStack('branche', 1)); sfx('leaves'); }, { anim: 'act' }) });
    return a;
  }
  if (type === 'pump') return waterActions('eau', false, () => true);
  if (type === 'toilet') {
    const i = w.idx(o.x, o.y);
    return waterActions('eau', true, () => { if (w.water[i] <= 0) { say('Le réservoir est vide.'); return false; } w.water[i]--; return true; });
  }
  if (type === 'campfire') {
    const f = o.fire;
    if (!f.lit) a.push({ label: 'ALLUMER', fn: () => lightFire(o) });
    a.push({ label: 'FEU', fn: () => openUI({ kind: 'fire', obj: o }) });
    return a;
  }
  if (type === 'bed') a.push({ label: 'DORMIR', fn: () => sleep() });
  if (type === 'sofa' || type === 'armchair' || type === 'bench') a.push({ label: 'S\'ASSEOIR', fn: () => { p.sitting = true; say('Vous vous asseyez un moment.'); } });
  if (type === 'sink' || type === 'bathsink') {
    const i = w.idx(o.x, o.y);
    a.push(...waterActions('eau', false, () => { if (w.water[i] <= 0) { say('Plus une goutte. Les tuyaux sont vides.'); return false; } w.water[i]--; return true; }).slice(0, 1));
  }
  if (CONTAINERS[type] || type === 'bag') a.push({ label: type === 'bag' ? 'FOUILLER' : 'OUVRIR', sub: label, fn: () => openUI({ kind: 'box', obj: o }) });
  return a;
}

export function openUI(ui) {
  G.ui = ui;
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
  const m = w.mask(t.x, t.y), alongX = (m & 3) === 3;
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
  for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) {
    if (!w.inb(x, y)) continue;
    const i = w.idx(x, y);
    const k = w.wall[i];
    if (k >= W.WINDOW && k <= W.OPEN) consider({ kind: 'wall', x, y }, x + 0.5, y + 0.5, 1.1, [[x, y]]);
    const o = w.occ[i] >= 0 ? w.objs[w.occ[i]] : null;
    if (o) {
      const solid = SOLID[o.type] || 0;
      // le point le plus proche de la boîte de l'objet
      const tx = Math.max(x + 0.5 - solid, Math.min(x + 0.5 + solid, p.x)), ty = Math.max(y + 0.5 - solid, Math.min(y + 0.5 + solid, p.y));
      consider({ kind: 'obj', obj: o, x, y }, tx, ty, 0.95, o.cells);
    }
    if (isWater(w.tile[i])) {
      const tx = Math.max(x, Math.min(x + 1, p.x)), ty = Math.max(y, Math.min(y + 1, p.y));
      consider({ kind: 'water', x, y }, tx, ty, 0.7, [[x, y]]);
    }
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
  if (w.roomAt(x, y) >= 0 || w.inside(p.x, p.y) >= 0) { say('Pas de feu à l\'intérieur.'); return; }
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

  // déplacement
  p.moving = false;
  p.back = false;
  const blocked = G.ui && G.ui.kind !== 'text' ? true : false;
  // visée (joystick droit) : angle dans le plan caméra, 0 = vers la caméra
  const aiming = !p.sleeping && !blocked && input.amag > 0.3;
  const aimA = aiming ? Math.atan2(input.ax, input.ay * 2) : null;
  if (p.legsA === undefined) p.legsA = p.dir * Math.PI / 4;
  if (!p.sleeping && !blocked && input.mag > 0.15) {
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
    move(p, wx * speed, wy * speed, dt);
    p.moving = true;
    p.anim += dt * speed * 2.3;
    if (Math.floor(p.anim * 2) !== Math.floor((p.anim - dt * speed * 2.3) * 2)) sfx('step', w.T(Math.floor(p.x), Math.floor(p.y)));
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
  G.swayT += dt * (1 + Math.min(1.5, wt.rain * 1.5) * 1.2);

  if (!p.act && !p.sleeping && !blocked) G.target = findTarget();
  else if (!p.act) G.target = null;

  for (const m of G.msgs) m.t -= dt;
  G.msgs = G.msgs.filter((m) => m.t > 0);

  if (p.health <= 0) { G.mode = 'dead'; G.deadAt = performance.now(); G.ui = null; p.sleeping = false; wipe(); sfx('death'); return; }
  saveT += dt;
  if (saveT > 20) { saveT = 0; save(); }
}
function wake(msg) { G.p.sleeping = false; say(msg); save(); }
