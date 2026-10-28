// État partagé de la partie et petites opérations d'inventaire.
import { ITEMS, makeStack } from './items.js';

export const HOTBAR = 9, INV_SIZE = 36; // 0..8 barre rapide, 9..35 sac

export const G = {
  mode: 'title', // title | play | dead
  world: null,
  seed: 0,
  time: 8 * 60, // minutes depuis le début (jour 1, 8 h)
  p: null,
  weather: { rain: 0, target: 0, next: 300 },
  radio: 0,
  ui: null, // écran ouvert : { kind: 'inv' | 'box' | 'fire' | 'text', ... }
  msgs: [],
  target: null,
  cam: { x: 0, y: 0 },
  swayT: 0,
  clock: 0,
  muted: false,
};

export function newPlayer(x, y) {
  const inv = new Array(INV_SIZE).fill(null);
  inv[0] = makeStack('eau');
  inv[1] = makeStack('chocolat', 2);
  inv[2] = { id: 'note', n: 1, d: -1 };
  return {
    x, y, dir: 0, legs: 0, twist: 0, legsA: 0, back: false, aiming: false, driving: -1, moving: false, anim: 0, act: null,
    health: 100, hunger: 78, thirst: 70, energy: 85, moral: 60,
    bleeding: false, sick: 0, sleeping: false, sitting: false,
    inv, sel: 0, craft: [null, null, null, null], cursor: null,
  };
}

export const hour = () => (G.time / 60) % 24;
export const day = () => Math.floor(G.time / 1440) + 1;

export function say(text, t = 3.5) {
  G.msgs.push({ text, t, max: t });
  if (G.msgs.length > 3) G.msgs.shift();
}

export const maxStack = (s) => ITEMS[s.id].stack;
export const sameKind = (a, b) => a && b && a.id === b.id && a.d === undefined && b.d === undefined;

// Range une pile dans slots[from..to) : complète les piles existantes puis les cases vides.
// Renvoie ce qui reste (ou null).
export function addTo(slots, stack, from = 0, to = slots.length) {
  if (!stack) return null;
  let s = { ...stack };
  for (let i = from; i < to && s.n > 0; i++) {
    const t = slots[i];
    if (sameKind(t, s) && t.n < maxStack(t)) {
      const k = Math.min(s.n, maxStack(t) - t.n);
      t.n += k; s.n -= k;
    }
  }
  for (let i = from; i < to && s.n > 0; i++) {
    if (!slots[i]) {
      const k = Math.min(s.n, maxStack(s));
      slots[i] = { ...s, n: k }; s.n -= k;
    }
  }
  return s.n > 0 ? s : null;
}

export function count(slots, id) {
  let n = 0;
  for (const s of slots) if (s && s.id === id) n += s.n;
  return n;
}
export const has = (id) => count(G.p.inv, id) > 0;

// Retire n objets id de l'inventaire du joueur.
export function take(id, n = 1) {
  const inv = G.p.inv;
  for (let i = 0; i < inv.length && n > 0; i++) {
    if (inv[i] && inv[i].id === id) {
      const k = Math.min(n, inv[i].n);
      inv[i].n -= k; n -= k;
      if (!inv[i].n) inv[i] = null;
    }
  }
}

export const held = () => G.p.inv[G.p.sel];
export const holding = (id) => held()?.id === id;
