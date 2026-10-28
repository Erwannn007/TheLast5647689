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
ok(opened > 100, `cibles de conteneurs trouvées : ${opened}`);
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

// se placer contre une voiture, du côté où elle devient la cible
function besideCar(c) {
  const B = game.carBox(c);
  for (const [a, b] of [[0, B.hw + 0.35], [0, -(B.hw + 0.35)], [B.hl * 0.5, B.hw + 0.35], [-B.hl * 0.5, -(B.hw + 0.35)], [B.hl + 0.4, 0], [-(B.hl + 0.4), 0]]) {
    G.p.x = c.x + a * B.ux - b * B.uy; G.p.y = c.y + a * B.uy + b * B.ux; G.p.l = 0;
    const t = game.findTarget();
    if (t && t.kind === 'car' && t.car === c) return t;
  }
  return null;
}
// conduite
{
  game.newGame(); G.ui = null;
  const w = G.world;
  // une voiture qui a de la place devant elle
  const free = (q) => [1, 2, 3, 4].every((d) => !game.carBlocked(q, q.x + Math.cos(q.ang) * d, q.y + Math.sin(q.ang) * d, q.ang));
  const c = w.cars.find((q) => free(q) && besideCar(q)) || w.cars[0];
  c.fuel = 50;
  const t = besideCar(c);
  ok(t && t.kind === 'car' && t.acts.some((a) => a.label === 'CONDUIRE'), 'une voiture se conduit');
  t.acts.find((a) => a.label === 'CONDUIRE').fn();
  ok(game.driving() === c, 'au volant');
  // avancer : le joystick pointe le nez de la voiture (écran : +x monde = droite-bas)
  const x0 = c.x, y0 = c.y, f0 = c.fuel;
  const fwd = { x: Math.cos(c.ang) - Math.sin(c.ang), y: (Math.cos(c.ang) + Math.sin(c.ang)) / 2 };
  const l = Math.hypot(fwd.x, fwd.y);
  for (let i = 0; i < 60; i++) game.update(1 / 60, { x: fwd.x / l, y: fwd.y / l, mag: 1, gas: true });
  ok(Math.hypot(c.x - x0, c.y - y0) > 1 && c.fuel < f0, `la voiture avance (${Math.hypot(c.x - x0, c.y - y0).toFixed(1)} cases)`);
  ok(G.p.x === c.x && G.p.y === c.y, 'le joueur suit la voiture');
  // frein puis marche arrière
  for (let i = 0; i < 120; i++) game.update(1 / 60, { x: 0, y: 0, mag: 0, brake: true });
  ok(c.speed < 0, `marche arrière (${c.speed.toFixed(1)})`);
  // panne sèche
  c.fuel = 0;
  for (let i = 0; i < 240; i++) game.update(1 / 60, { x: fwd.x / l, y: fwd.y / l, mag: 1, gas: true });
  ok(Math.abs(c.speed) < 0.1, 'sans essence, elle ne roule plus');
  // on ne traverse pas les murs : on fonce droit vers une maison
  c.fuel = 100;
  let crossed = false;
  for (let i = 0; i < 600; i++) {
    game.update(1 / 60, { x: 0, y: -1, mag: 1, gas: true });
    const bx = [];
    for (let cy = Math.floor(c.y) - 2; cy <= Math.floor(c.y) + 2; cy++) for (let cx = Math.floor(c.x) - 2; cx <= Math.floor(c.x) + 2; cx++) game.cellBoxes(cx, cy, bx);
    const A = game.carBox(c);
    if (bx.some((b) => { const px = (b[0] + b[2]) / 2 - c.x, py = (b[1] + b[3]) / 2 - c.y; return Math.abs(px * A.ux + py * A.uy) < A.hl - 0.3 && Math.abs(-px * A.uy + py * A.ux) < A.hw - 0.3; })) crossed = true;
  }
  ok(!crossed, 'la voiture ne traverse rien');
  for (let i = 0; i < 240; i++) game.update(1 / 60, { x: 0, y: 0, mag: 0, brake: c.speed > 0.2, gas: c.speed < -0.2 });
  const out = G.target.acts[0];
  ok(out.label === 'SORTIR', 'bouton sortir');
  out.fn();
  ok(!game.driving() && !game.carHit(G.p.x, G.p.y, 0.17), 'sortie à côté de la voiture');
  // sauvegarde avec les voitures
  G.mode = 'play'; game.save(); const n = G.world.cars.length; game.load();
  ok(G.world.cars.length === n, 'voitures sauvegardées');
}

// virage : en roulant, le volant tourné fait tourner la voiture
{
  game.newGame(); G.ui = null;
  const free = (q) => [1, 2, 3, 4].every((d) => !game.carBlocked(q, q.x + Math.cos(q.ang) * d, q.y + Math.sin(q.ang) * d, q.ang));
  const c = G.world.cars.find((q) => free(q) && besideCar(q)) || G.world.cars[0];
  c.fuel = 100;
  besideCar(c).acts.find((a) => a.label === 'CONDUIRE').fn();
  const a0 = c.ang;
  G.settings.drive = 'wheel';
  for (let i = 0; i < 40; i++) game.update(1 / 60, { x: 0, y: 0, mag: 0, gas: true });
  // volant tourné à fond vers la gauche
  for (let i = 0; i < 30; i++) game.update(1 / 60, { x: 0, y: 0, mag: 0, gas: true, wheel: -1, wheelHeld: true });
  ok(c.ang - a0 < -0.15 || Math.abs(c.speed) < 0.5, `volant à gauche : la voiture tourne à gauche (${(c.ang - a0).toFixed(2)} rad)`);
  // au joystick : le nez va vers le pouce
  G.settings.drive = 'stick';
  const target = c.ang + Math.PI / 2, tx = Math.cos(target), ty = Math.sin(target);
  for (let i = 0; i < 90; i++) game.update(1 / 60, { x: tx - ty, y: (tx + ty) / 2, mag: 1, gas: true });
  ok(Math.abs(Math.atan2(Math.sin(c.ang - target), Math.cos(c.ang - target))) < 1.2 || Math.abs(c.speed) < 0.5, 'joystick : le nez suit le pouce');
}
// sprint
{
  game.newGame(); G.ui = null;
  const run = (sprint) => { const x0 = G.p.x, y0 = G.p.y; for (let i = 0; i < 20; i++) game.update(1 / 60, { x: 1, y: 0.5, mag: 1, sprint }); return Math.hypot(G.p.x - x0, G.p.y - y0); };
  // un endroit dégagé sur 6 cases vers +x
  let sx = 0, sy = 0;
  for (let y = 20; y < 230 && !sx; y += 3) for (let x = 20; x < 230; x += 3) {
    if ([0, 1, 2, 3, 4, 5].every((d) => G.world.walkable(x + d, y) && G.world.walkable(x + d, y - 1) && G.world.walkable(x + d, y + 1) && !game.carHit(x + d + 0.5, y + 0.5, 1))) { sx = x + 0.5; sy = y + 0.5; break; }
  }
  G.p.x = sx; G.p.y = sy;
  const walk = run(false); G.p.x = sx; G.p.y = sy;
  const e0 = G.p.energy, sprint = run(true);
  ok(sprint > walk * 1.5 && G.p.energy < e0, `courir va plus vite (${walk.toFixed(2)} -> ${sprint.toFixed(2)}) et fatigue`);
  G.p.energy = 5; G.p.x = sx; G.p.y = sy;
  ok(run(true) < walk * 1.3, 'épuisé, on ne court plus');
}

// étages : monter l'escalier d'une tour, marcher là-haut, redescendre
{
  game.newGame(); G.ui = null;
  const w = G.world, b = w.blds.find((q) => q.floors >= 3);
  const st = w.objs.find((o) => o && o.type === 'stairs' && o.l === 0 && o.x >= b.x0 && o.x <= b.x1 && o.y >= b.y0 && o.y <= b.y1);
  const { dirFromWorld } = await import('../src/sprites/player.js');
  G.p.x = st.x + 0.5; G.p.y = st.y + 1.45; G.p.l = 0; G.p.dir = dirFromWorld(0, -1); // face aux marches
  let t = game.findTarget();
  ok(t && t.obj === st && t.acts[0].label === 'MONTER', 'escalier : MONTER');
  t.acts[0].fn();
  for (let i = 0; i < 60; i++) game.update(1 / 60, idle);
  ok(G.p.l === 1 && w.inside(G.p.x, G.p.y, 1) === b.id, 'arrivé au premier étage');
  // promenade à l'étage : on ne traverse rien et on ne tombe pas dans le vide
  let bad = 0;
  for (let i = 0; i < 600; i++) {
    const a = (i / 40) * 2.1;
    game.update(1 / 30, { x: Math.cos(a), y: Math.sin(a), mag: 1 });
    if (!w.lay(1).tile[w.idx(Math.floor(G.p.x), Math.floor(G.p.y))]) bad++;
  }
  ok(bad === 0, `pas de chute dans le vide (${bad})`);
  const down = w.objs.find((o) => o && o.type === 'stairs_down' && o.l === 1 && o.x >= b.x0 && o.x <= b.x1 && o.y >= b.y0 && o.y <= b.y1);
  G.p.x = down.x + 0.5; G.p.y = down.y + 1.45; G.p.dir = dirFromWorld(0, -1);
  t = game.findTarget();
  ok(t && t.obj === down, 'trémie : DESCENDRE');
  t.acts[0].fn();
  for (let i = 0; i < 60; i++) game.update(1 / 60, idle);
  ok(G.p.l === 0, 'redescendu');
}
// armes : tirer, recharger, chasser
{
  game.newGame(); G.ui = null;
  const w = G.world;
  G.p.inv[4] = { id: 'carabine', n: 1, d: 2 }; G.p.inv[5] = { id: 'balles_308', n: 10 }; G.p.sel = 4;
  // un cerf, et à 6 cases de lui une ligne de tir dégagée (on essaie plusieurs cerfs et angles)
  let ok2 = false, deer = null;
  for (const cand of w.animals.filter((a) => a.type === 'deer')) for (const ang of [0, 1, 2, 3, 4, 5]) {
    if (ok2) break;
    deer = cand; deer.state = 'graze'; deer.t = 99;
    G.p.x = deer.x - Math.cos(ang) * 6; G.p.y = deer.y - Math.sin(ang) * 6; G.p.l = 0;
    const aim = [Math.cos(ang), Math.sin(ang)];
    let clearLine = true;
    for (let d = 0.5; d < 5.5; d += 0.2) { const bx = []; game.cellBoxes(Math.floor(G.p.x + aim[0] * d), Math.floor(G.p.y + aim[1] * d), bx, 0); if (bx.some((q) => G.p.x + aim[0] * d > q[0] && G.p.x + aim[0] * d < q[2] && G.p.y + aim[1] * d > q[1] && G.p.y + aim[1] * d < q[3]) || game.carHit(G.p.x + aim[0] * d, G.p.y + aim[1] * d, 0.05) || w.animals.some((q) => q !== deer && Math.hypot(q.x - G.p.x - aim[0] * d, q.y - G.p.y - aim[1] * d) < 0.7)) clearLine = false; }
    if (!clearLine || !w.walkable(Math.floor(G.p.x), Math.floor(G.p.y))) continue;
    G.p.aimW = aim; G.clock += 5;
    const hp = deer.hp;
    game.fire();
    ok2 = deer.hp < hp || !w.animals.includes(deer);
    if (ok2) break;
  }
  ok(ok2, 'une balle touche le cerf');
  ok(G.p.inv[4].d === 1, 'une balle de moins dans le chargeur');
  game.useItem(4);
  for (let i = 0; i < 200; i++) game.update(1 / 60, idle);
  ok(G.p.inv[4].d === 5 && G.p.inv[5].n === 6, `rechargé : ${G.p.inv[4].d}/5, reste ${G.p.inv[5] && G.p.inv[5].n}`);
}
// sauvegarde par différences : une porte ouverte, un objet pris, rechargés à l'identique
{
  game.newGame(); G.ui = null;
  const w = G.world;
  const fridge = w.objs.find((o) => o && o.type === 'fridge');
  fridge.inv[0] = { id: 'pomme', n: 3 }; fridge.dirty = 1;
  const door = (() => { for (let i = 0; i < w.wall.length; i++) if (w.wall[i] === 4) return i; })();
  w.setWall(door % 256, Math.floor(door / 256), 0, 5);
  const tree = w.objs.find((o) => o && o.type === 'tree');
  w.removeObj(tree);
  G.mode = 'play'; game.save();
  const size = localStorage.getItem('thelast-save-v4').length;
  game.load();
  const w2 = G.world;
  ok(w2.objs[fridge.id].inv[0] && w2.objs[fridge.id].inv[0].id === 'pomme', 'contenu du frigo gardé');
  ok(w2.wall[door] === 5, 'porte restée ouverte');
  ok(!w2.objs[tree.id], 'arbre abattu toujours absent');
  ok(size < 400000, `sauvegarde légère : ${(size / 1024) | 0} Ko`);
}
// empilement : deux journaux et deux bouteilles d'eau s'empilent
{
  const { addTo, sameKind } = await import('../src/state.js');
  const a = makeStack('journal'), b = makeStack('journal');
  ok(sameKind(a, b), 'deux journaux s\'empilent');
  const slots = [makeStack('eau'), null];
  addTo(slots, makeStack('eau'));
  ok(slots[0].n === 2 && !slots[1], 'les bouteilles d\'eau s\'empilent');
  ok(!sameKind({ id: 'lampe', n: 1, d: 40 }, { id: 'lampe', n: 1, d: 90 }), 'deux lampes de charges différentes restent séparées');
}
// enjamber : on traverse la fenêtre pendant l'animation
{
  game.newGame(); G.ui = null;
  const w = G.world;
  let done = false;
  for (let i = 0; i < w.wall.length && !done; i++) {
    if (w.wall[i] !== 2) continue;
    const x = i % 256, y = Math.floor(i / 256);
    if (w.mask(x, y) !== 3 || !w.walkable(x, y + 1) || !w.walkable(x, y - 1)) continue;
    w.setWall(x, y, 0, 3);
    G.p.x = x + 0.5; G.p.y = y + 1.4; G.p.l = 0;
    const { dirFromWorld } = await import('../src/sprites/player.js');
    G.p.dir = dirFromWorld(0, -1);
    const t = game.findTarget();
    if (!t || t.kind !== 'wall') continue;
    t.acts[0].fn();
    const y0 = G.p.y;
    for (let k = 0; k < 30; k++) game.update(1 / 60, { x: 0, y: 0, mag: 0 });
    const mid = G.p.y;
    for (let k = 0; k < 60; k++) game.update(1 / 60, { x: 1, y: 0, mag: 1 }); // le joystick ne coupe pas le geste
    ok(mid < y0 && G.p.y < y + 0.5, `enjamber : passage progressif (${y0.toFixed(2)} -> ${mid.toFixed(2)} -> ${G.p.y.toFixed(2)})`);
    done = true;
  }
  ok(done, 'une fenêtre à enjamber trouvée');
}
