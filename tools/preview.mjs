// node tools/preview.mjs nature|tiles|... : écrit une planche agrandie dans tools/out/
import { sheet } from './sheet.mjs';

const groups = {
  async nature() {
    const n = await import('../src/sprites/nature.js');
    const s = [];
    for (const pal of ['green', 'yellow', 'orange', 'red']) s.push(n.treeFrames('oak', 3, pal)[0]);
    s.push(n.treeFrames('birch', 5, 'yellow')[0], n.treeFrames('pine', 1)[0], n.treeFrames('dead', 2)[0], n.treeFrames('oak', 3, 'orange')[1]);
    s.push(n.bushFrames(1)[0], n.bushFrames(2, true)[0], n.rockSprite(1), n.rockSprite(4), n.grassFrames(1)[0], n.reedFrames(2)[0]);
    sheet('nature', s, { scale: 4 });
  },
  async build() {
    const b = await import('../src/sprites/build.js');
    const st = { ext: 0, int: 0, roof: 0 };
    const s = [];
    for (const m of [3, 12, 10, 6, 9, 5, 15, 11]) s.push(b.wallSprite(m, 'wall', st, 0, 0, false).img);
    for (const k of ['window', 'broken', 'door', 'open', 'doorway']) { s.push(b.wallSprite(3, k, st, 0, 0, false).img, b.wallSprite(12, k, { ...st, ext: 1 }, 0, 1, false).img); }
    s.push(b.wallSprite(3, 'wall', st, 0, 0, true).img, b.wallSprite(10, 'door', st, 0, 0, true).img);
    for (const m of [3, 12, 6, 15]) s.push(b.fenceSprite(m).img);
    s.push(b.roofSprite(7, 5, { ext: 1, roof: 0 }, 1).img, b.roofSprite(5, 8, { ext: 2, roof: 2 }, 2).img, b.roofSprite(9, 7, { ext: 0, roof: 3 }, 2).img);
    sheet('build', s, { scale: 3, cols: 10 });
  },
  async props() {
    const p = await import('../src/sprites/props.js');
    const s = [];
    for (const n of p.PROP_NAMES) s.push(p.propSprite(n, 0, 1).img);
    for (const n of ['counter', 'wardrobe', 'bed', 'car']) s.push(p.propSprite(n, 3, 0).img);
    sheet('props', s, { scale: 3, cols: 11 });
  },
  async player() {
    const p = await import('../src/sprites/player.js');
    const b = p.bakePlayer();
    const s = [];
    for (let d = 0; d < 8; d++) s.push(b.idle[d][2][0]);
    for (let o = 0; o < 5; o++) s.push(b.idle[1][o][0]); // jambes vers 1, buste 1-2 .. 1+2
    for (let d = 7; d <= 11; d++) s.push(b.idle[d % 8][2][0]);
    for (let f = 0; f < 8; f++) s.push(b.walk[1][2][f]);
    for (let f = 0; f < 8; f++) s.push(b.walk[4][0][f]);
    for (let f = 0; f < 4; f++) s.push(b.act[1][2][f]);
    for (let f = 0; f < 8; f++) s.push(b.run[2][f]);
    for (let f = 0; f < 8; f++) s.push(b.run[0][f]);
    sheet('player', s, { scale: 5, cols: 8 });
  },
  async cars() {
    const c = await import('../src/sprites/cars.js');
    const t = Date.now();
    const s = [];
    for (let v = 0; v < 5; v++) for (const i of [1, 6, 9, 14]) s.push(c.carSprite(v + 5 * (v + 1), i).img);
    for (let f = 0; f < 3; f++) s.push(c.carSprite(0, 4, f).img);
    console.log('ms par voiture', (Date.now() - t) / 23);
    sheet('cars', s, { scale: 3, cols: 4 });
  },
  async tiles() {
    const t = await import('../src/sprites/tiles.js');
    const s = [];
    for (const k of Object.values(t.T)) s.push(t.tileBuffer(k, 0), t.tileBuffer(k, 1));
    s.push(t.bankBuffer(0), t.bankBuffer(1), t.bankBuffer(2), t.bankBuffer(3), t.leafLitter(1));
    sheet('tiles', s, { scale: 5, cols: 8, bg: [30, 30, 30] });
  },
};

for (const g of process.argv.slice(2)) await groups[g]();
