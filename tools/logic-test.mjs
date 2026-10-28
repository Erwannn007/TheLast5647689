// Tests de logique sans navigateur : node tools/logic-test.mjs
globalThis.localStorage = { s: {}, getItem(k) { return this.s[k] ?? null; }, setItem(k, v) { this.s[k] = v; }, removeItem(k) { delete this.s[k]; } };
const { G } = await import('../src/state.js');
const game = await import('../src/game.js');
const { matchRecipe, makeStack } = await import('../src/items.js');
const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
const idle = { x: 0, y: 0, mag: 0 };

game.newGame();
G.ui = null;
ok(G.world && G.p, 'nouvelle partie');
// marche : le joueur ne traverse pas les murs pendant 2000 pas aléatoires
let inWall = 0;
for (let i = 0; i < 2000; i++) {
  const a = (i / 50) * 2.3;
  game.update(0.05, { x: Math.cos(a), y: Math.sin(a), mag: 1 });
  const w = G.world, p = G.p, b = [];
  for (let cy = Math.floor(p.y) - 1; cy <= Math.floor(p.y) + 1; cy++) for (let cx = Math.floor(p.x) - 1; cx <= Math.floor(p.x) + 1; cx++) game.cellBoxes(cx, cy, b);
  if (b.some((q) => p.x + 0.16 > q[0] && p.x - 0.16 < q[2] && p.y + 0.16 > q[1] && p.y - 0.16 < q[3])) inWall++;
}
ok(inWall === 0, `aucune collision traversée (${inWall})`);
// survie : une journée sans manger
const h0 = G.p.hunger;
for (let i = 0; i < 600; i++) game.update(1, idle);
ok(G.p.hunger < h0 - 20 && G.p.thirst < 60, `faim ${G.p.hunger.toFixed(0)} soif ${G.p.thirst.toFixed(0)} après 10 h`);
// manger / boire
G.p.inv[5] = makeStack('pomme', 2); const hu = G.p.hunger; game.useItem(5);
ok(G.p.hunger > hu && G.p.inv[5].n === 1, 'manger une pomme');
G.p.inv[6] = makeStack('eau'); game.useItem(6);
ok(G.p.inv.some((s) => s && s.id === 'bouteille'), 'boire laisse une bouteille vide');
G.p.inv[7] = makeStack('haricots');
G.p.inv = G.p.inv.map((s) => (s && (s.id === 'couteau' || s.id === 'ouvre_boite') ? null : s));
game.useItem(7);
ok(G.p.inv[7] && G.p.inv[7].id === 'haricots', 'conserve impossible sans ouvre-boîte');
// recettes
let m = matchRecipe([makeStack('drap'), makeStack('couteau'), null, null]);
ok(m && m.out.id === 'chiffon' && m.out.n === 3, 'drap + couteau -> 3 chiffons');
m = matchRecipe([makeStack('buche'), makeStack('buche'), makeStack('branche'), makeStack('branche')]);
ok(m && m.out.id === 'kit_feu', '2 bûches + 2 branches -> feu de camp');
ok(!matchRecipe([makeStack('buche'), null, null, null]), 'pas de recette fantôme');
// feu : cuisson d'un poisson
const w = G.world;
const fire = w.addObj({ type: 'campfire', x: 2, y: 2, k: 0, v: 0, fire: { lit: true, burn: 5, slots: [makeStack('poisson', 2), makeStack('buche', 1), null], prog: 0 } });
game.refreshFires();
for (let i = 0; i < 40; i++) game.update(1, idle);
ok(fire.fire.slots[2] && fire.fire.slots[2].id === 'poisson_cuit' && fire.fire.slots[2].n === 2, 'deux poissons grillés');
ok(!fire.fire.slots[1], 'la bûche a été brûlée');
// sommeil
G.p.energy = 30; G.p.health = 80; G.p.sleeping = true;
const t0 = G.time;
for (let i = 0; i < 400 && G.p.sleeping; i++) game.update(0.5, idle);
ok(!G.p.sleeping && G.p.energy > 95 && G.time - t0 > 240, `dormir ${((G.time - t0) / 60).toFixed(1)} h`);
// interactions autour de chaque conteneur de la maison de départ
let opened = 0;
for (const o of w.objs) {
  if (!o || !o.inv || o.type === 'bag') continue;
  G.p.x = o.x + 0.5; G.p.y = o.y + 1.45;
  if (w.walkable(o.x, o.y + 1)) { const t = game.findTarget(); if (t && t.kind === 'obj' && t.obj === o) opened++; }
}
ok(opened > 20, `cibles de conteneurs trouvées : ${opened}`);
// sauvegarde / chargement
G.mode = 'play'; game.save();
const before = JSON.stringify(G.p.inv);
game.load();
ok(JSON.stringify(G.p.inv) === before && G.world.objs.filter(Boolean).length > 1000, 'sauvegarde rechargée');
// visée : buste tourné de 90° au plus, marche à reculons au-delà
G.ui = null; G.p.sleeping = false; G.p.act = null;
const at = (mx, my, ax, ay) => { for (let i = 0; i < 3; i++) game.update(0.02, { x: mx, y: my, mag: Math.hypot(mx, my), ax, ay, amag: Math.hypot(ax, ay) }); return { legs: G.p.legs, dir: G.p.dir, twist: G.p.twist, back: G.p.back }; };
let r = at(0, 1, 1, 0); // marche vers la caméra, vise à droite
ok(r.legs === 0 && r.twist === 2 && !r.back, `marcher en visant sur le côté : jambes ${r.legs} buste ${r.dir} torsion ${r.twist}`);
r = at(0, 1, 0, -1); // marche vers la caméra, vise derrière
ok(r.back && r.dir === 4 && r.legs === 4, `viser derrière en marchant : à reculons (jambes ${r.legs}, buste ${r.dir})`);
r = at(0, 0, 0, -1); // à l'arrêt, vise derrière : les pieds pivotent
ok(Math.abs(r.twist) <= 2 && r.dir === 4, `à l'arrêt, les pieds suivent (torsion ${r.twist})`);
r = at(0, 1, 0, 0);
ok(r.twist === 0 && r.legs === 0, 'sans visée, le buste revient dans l\'axe');
