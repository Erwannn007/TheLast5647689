// Écran à l'échelle entière (~240 px de jeu sur le petit côté), planches de sprites, police 3x5.
export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d', { alpha: false });
export const view = { W: 240, H: 400, px: 1, css: 1, safe: { t: 0, r: 0, b: 0, l: 0 } };

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  const px = Math.max(1, Math.round(Math.min(W, H) * dpr / 240)); // pixels écran par pixel de jeu
  view.W = Math.ceil(W * dpr / px);
  view.H = Math.ceil(H * dpr / px);
  canvas.width = view.W;
  canvas.height = view.H;
  view.px = px;
  view.css = px / dpr;
  canvas.style.width = view.W * view.css + 'px';
  canvas.style.height = view.H * view.css + 'px';
  ctx.imageSmoothingEnabled = false;
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['t', 'r', 'b', 'l']) view.safe[k] = Math.ceil((parseFloat(cs.getPropertyValue('--sa' + k)) || 0) / view.css);
}

// ---------------------------------------------------------------- planches
const ATLAS = 1024;
const atlas = { pages: [], page: null, x: 0, y: 0, rowH: 0 };

export function toSprite(buf) {
  const { w, h, data } = buf;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!data[(y * w + x) * 4 + 3]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { page: null, sx: 0, sy: 0, w: 0, h: 0, ox: 0, oy: 0 };
  const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
  if (atlas.page && atlas.x + sw > ATLAS) { atlas.x = 0; atlas.y += atlas.rowH + 1; atlas.rowH = 0; }
  if (!atlas.page || atlas.y + sh > ATLAS) {
    const pg = document.createElement('canvas');
    pg.width = pg.height = ATLAS;
    pg.c = pg.getContext('2d');
    atlas.pages.push(pg);
    atlas.page = pg;
    atlas.x = atlas.y = atlas.rowH = 0;
  }
  const img = new ImageData(sw, sh);
  for (let y = 0; y < sh; y++) img.data.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * sw * 4);
  atlas.page.c.putImageData(img, atlas.x, atlas.y);
  const spr = { page: atlas.page, sx: atlas.x, sy: atlas.y, w: sw, h: sh, ox: (buf.ox || 0) - x0, oy: (buf.oy || 0) - y0 };
  atlas.x += sw + 1;
  atlas.rowH = Math.max(atlas.rowH, sh);
  return spr;
}

// Dessine un sprite, son ancre en (x, y).
export function draw(s, x, y) {
  if (s.page) ctx.drawImage(s.page, s.sx, s.sy, s.w, s.h, x - s.ox, y - s.oy, s.w, s.h);
}
// Une bande verticale [cx0, cx1) d'un sprite (en coordonnées écran), pour trier les grands sprites par colonne.
export function drawCols(s, x, y, cx0, cx1) {
  if (!s.page) return;
  const left = x - s.ox;
  const a = Math.max(cx0, left), b = Math.min(cx1, left + s.w);
  if (b <= a) return;
  ctx.drawImage(s.page, s.sx + a - left, s.sy, b - a, s.h, a, y - s.oy, b - a, s.h);
}

// ---------------------------------------------------------------- police 3x5
const SRC = {
  A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.',
  E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..', G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#',
  I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
  M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.', P: '##. #.# ##. #.. #..',
  Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#', S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.',
  U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# #.# .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#',
  Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###',
  0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '##. ..# .#. #.. ###', 3: '##. ..# .#. ..# ##.',
  4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.', 6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.',
  8: '### #.# ### #.# ###', 9: '### #.# ### ..# ##.',
  ':': '... .#. ... .#. ...', '.': '... ... ... ... .#.', '-': '... ... ### ... ...', '!': '.#. .#. .#. ... .#.',
  '/': '..# ..# .#. #.. #..', "'": '.#. .#. ... ... ...', '+': '... .#. ### .#. ...', ' ': '... ... ... ... ...',
  '^': '.#. #.# ... ... ...', '=': '... ### ... ### ...',
  '(': '.#. #.. #.. #.. .#.', ')': '.#. ..# ..# ..# .#.', '>': '#.. .#. ..# .#. #..', '<': '..# .#. #.. .#. ..#',
  '%': '#.. ..# .#. #.. ..#', '*': '... #.# .#. #.# ...', ',': '... ... ... .#. #..', '?': '##. ..# .#. ... .#.',
  '«': '... .#. #.. .#. ...', '»': '... .#. ..# .#. ...', '…': '... ... ... ... #.#',
};
const G = {};
for (const k in SRC) G[k] = SRC[k].replace(/ /g, '');
const ACC = { 'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'À': 'A', 'Â': 'A', 'Ç': 'C', 'Ô': 'O', 'Û': 'U', 'Ù': 'U', 'Î': 'I', 'Ï': 'I', '’': "'", '—': '-' };

export const textWidth = (s) => s.length * 4 - 1;

export function drawText(s, x, y, color = '#fff', shadow = 'rgba(0,0,0,0.6)', scale = 1) {
  s = String(s).toUpperCase();
  for (const pass of shadow ? [0, 1] : [1]) {
    ctx.fillStyle = pass ? color : shadow;
    const o = pass ? 0 : scale;
    for (let i = 0; i < s.length; i++) {
      const g = G[ACC[s[i]] || s[i]] || G[' '];
      for (let p = 0; p < 15; p++) {
        if (g[p] === '#') ctx.fillRect(x + (i * 4 + (p % 3)) * scale + o, y + ((p / 3) | 0) * scale + o, scale, scale);
      }
    }
  }
}

// Coupe un texte en lignes de n caractères au plus.
export function wrap(s, n) {
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if ((line + ' ' + word).trim().length > n) { if (line) out.push(line); line = word; }
      else line = (line + ' ' + word).trim();
    }
    out.push(line);
  }
  return out;
}

// Panneau en relief : biseau clair en haut à gauche, sombre en bas à droite, contour noir.
export function panel(x, y, w, h, base = [58, 50, 42]) {
  const c = (k) => `rgb(${base.map((v) => Math.max(0, Math.min(255, v * k | 0))).join(',')})`;
  ctx.fillStyle = '#0c0a08'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = c(1); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c(1.35); ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = c(0.62); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
}
// Case creusée (l'inverse).
export function well(x, y, w, h, base = [58, 50, 42]) {
  const c = (k) => `rgb(${base.map((v) => Math.max(0, Math.min(255, v * k | 0))).join(',')})`;
  ctx.fillStyle = c(0.55); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c(0.35); ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = c(1.2); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
}
