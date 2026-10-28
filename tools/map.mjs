// Carte vue de dessus d'un monde généré (contrôle) : node tools/map.mjs [graine]
import { generate, MAP } from '../src/world.js';
import { sheet } from './sheet.mjs';
const w = generate(+(process.argv[2] || 12345));
const C = [[92,127,60],[130,120,64],[64,86,48],[102,67,48],[135,101,70],[51,54,61],[119,117,110],[133,92,62],[154,148,132],[110,124,128],[90,58,64],[191,168,108],[37,82,104],[60,60,40],[60,60,40],[51,54,61]];
const data = new Uint8ClampedArray(MAP * MAP * 4);
for (let i = 0; i < MAP * MAP; i++) {
  let c = C[w.tile[i]];
  if (w.wall[i]) c = w.wall[i] === 7 ? [230,230,220] : w.wall[i] === 2 ? [140,180,230] : w.wall[i] >= 4 ? [200,60,40] : [20,20,20];
  else if (w.occ[i] >= 0) { const t = w.objs[w.occ[i]].type; c = t === 'tree' ? [30,50,25] : t === 'grass' || t === 'reed' ? c : [230,170,40]; }
  data.set([...c, 255], i * 4);
}
const [sx, sy] = w.start; data.set([255, 0, 255, 255], ((sy | 0) * MAP + (sx | 0)) * 4);
sheet('map', [{ w: MAP, h: MAP, data }], { scale: 6, pad: 0, cols: 1 });
