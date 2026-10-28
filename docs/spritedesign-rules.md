# Style pixel art isométrique « Brainless » — guide autonome

Ce fichier suffit à reproduire le style dans **n'importe quel nouveau projet** : règles, palettes,
recettes de sprites, animation, effets, interface, et le code complet du moteur (à copier tel quel).
Il vient du jeu *Brainless* (PWA, JS vanilla, aucune image externe).

> **Pour une IA ou un dev qui démarre un projet avec ce style** : lis ce fichier en entier avant de
> dessiner quoi que ce soit. Tout sprite doit pouvoir passer la checklist de la section 14. Si tu peux,
> copie aussi les planches de référence `BRAINLESS/docs/ref-*.png` à côté de ce fichier, et
> compare chaque nouveau sprite à elles.

---

## 1. Le style en une phrase

Du **pixel art isométrique 2:1 net et chaleureux** : chaque objet est un petit volume (capsules,
sphères, boîtes) éclairé d'en haut à gauche, ombré en **4 tons francs** tramés, au **grain de pixels
bruités**, cerné d'un **contour coloré sombre (sel-out)**, le tout **généré par code au lancement**
et affiché à l'échelle **entière** pour rester net. Couleurs saturées mais naturelles, tout bouge un
peu (vent, eau, respiration).

## 2. Les 12 règles d'or

1. **Aucune image dessinée à la main dans des fichiers.** On décrit un modèle (capsules, sphères,
   boîtes) ou on pose des pixels par code, et on « cuit » chaque sprite au chargement.
2. **Isométrique 2:1 strict.** Tuile = losange de **32×16 px**, une marche de hauteur = **8 px**.
   Caméra à 30° : `SIN_A = 0.5`, `COS_A = 0.866`.
3. **4 tons par matière, jamais plus** : `ramp(ombre, sombre, base, lumière)`. Pas de dégradé lisse,
   pas d'anti-aliasing, pas de transparence partielle dans un sprite (sauf ombres au sol et effets).
4. **Une seule lumière, en haut à gauche et un peu devant.** Les ombres tombent en bas à droite.
   Volumes ronds : `L = norm(-0.55, -0.7, 0.5)` (espace écran). Volumes droits : `L = norm(-0.25, 0.55, 0.8)`
   (espace monde u, v, z) → face gauche claire, face droite sombre, dessus le plus clair.
5. **Tramage Bayer 4×4** à la frontière entre deux tons (le moteur le fait : on ajoute
   `BAYER[(y&3)*4+(x&3)] * 0.22` à l'éclairage avant de choisir le ton).
6. **Contour sel-out** : le contour n'est jamais noir pur, c'est la couleur du pixel voisin × **0.28**
   (sprites 3D) ou × **0.3–0.45** (dessins pixel par pixel, bâtiments). Plus des **lignes internes**
   (× 0.5) là où une partie passe nettement devant une autre.
7. **Grain** : `hash(x, y, seed)` assombrit ~15 % des pixels et en éclaircit ~5–7 %. Jamais de motif
   régulier visible (sauf matières qui en ont un : planches, tuiles de toit, pavés, et alors on le casse
   avec le hash).
8. **Couleurs saturées mais pas fluo.** Verts naturels, bleus profonds, tons terre. Le néon est réservé
   à l'énergie, la magie, les lucioles, les yeux qui brillent.
9. **Rampes qui glissent en teinte** : l'ombre part vers le bleu/violet froid et désaturé, la lumière
   vers le jaune chaud et clair (voir les palettes : le vert feuille va de `#1d4728` à `#7dc257`).
10. **Tout bouge un peu** : végétation qui se balance (4 images), eau sur 4 images, respiration au repos.
    Lent et continu : un balancement complet ≈ 3 s.
11. **Lisible à taille réelle** : le jeu fait ~240 px de haut. Un détail de moins de 2 px ne se verra
    pas. Juger chaque sprite à ×1 **et** agrandi ×6.
12. **Silhouette d'abord** : un objet doit se reconnaître en ombre chinoise. Silhouettes dentelées pour
    le végétal (grappes, rameaux), nettes pour le construit.

## 3. Écran, résolution, projection

- La **plus petite dimension de l'écran ≈ 240 pixels de jeu**, agrandie d'un facteur **entier** en
  pixels physiques (net sur iPhone, PC, tablette). `imageSmoothingEnabled = false` partout.
- Monde → écran : `isoX = (x - y) * 16`, `isoY = (x + y) * 8`, la hauteur `z` (px) est soustraite à y.
- **Ordre de dessin** : rangée par rangée (diagonales `d = x + y`), et dans une rangée : tuiles, traces
  au sol, puis objets et personnages triés par profondeur.
- **Ancre** d'un objet : au sol, au centre de sa tuile (`ox`, `oy` du sprite). Un bâtiment 2×2 est
  ancré au coin commun de ses 4 tuiles.
- Un personnage caché derrière un décor est redessiné par-dessus à 28 % d'opacité (on le voit toujours).

```js
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  const px = Math.max(1, Math.round(Math.min(W, H) * dpr / 240)); // pixels écran par pixel de jeu
  VW = Math.ceil(W * dpr / px);
  VH = Math.ceil(H * dpr / px);
  canvas.width = VW;
  canvas.height = VH;
  cssPerPx = px / dpr;
  canvas.style.width = VW * cssPerPx + 'px';
  canvas.style.height = VH * cssPerPx + 'px';
  ctx.imageSmoothingEnabled = false;
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['t', 'r', 'b', 'l']) safe[k] = Math.ceil((parseFloat(cs.getPropertyValue('--sa' + k)) || 0) / cssPerPx);
}
```

## 4. Lumière, rampes, palettes

**Une rampe = 4 couleurs** (ombre → lumière). Pour en créer une nouvelle :
- partir de la **base** (ton 2) ; la **lumière** (ton 3) est plus claire **et plus chaude/jaune** ;
  le **sombre** (ton 1) plus sombre ; l'**ombre** (ton 0) très sombre et **plus froide/bleutée** ;
- garder la même luminosité d'ombre et la même saturation que les rampes voisines ci-dessous ;
- vérifier sur un sprite test à ×1 que les 4 tons se distinguent.

### Nature

| Matière | Rampe (ombre → lumière) |
|---|---|
| Écorce | `#2e1c10 #553620 #7a5233 #9a6d45` |
| Feuillage | `#1d4728 #2d6a33 #4a923d #7dc257` (forêt : `#183d24 #255a2d #3b7c37 #62a64c`) |
| Sapin | `#123327 #1c4c35 #2a6843 #448a52` (+ neige `#9cb0c6 #c9d6e4 #eaf1f8 #ffffff`, pomme de pin `#5a3a1e`) |
| Cerisier | `#86365a #c55c88 #ec8fb2 #ffc8dc` |
| Roche | `#34373f #5a5f6b #838894 #b1b6bf` (mousse `#2b4a23 #3f6b2e #5d8e3c #86b356`) |
| Buisson | `#1a4424 #28622f #3f8a3a #69b14f` |
| Herbe (sol) | `#4b8a35 #5c9e3f #73b84d #8fd162` |
| Prairie | `#5c9e3f #6fb34a #86c75a #a3d96f` |
| Herbes hautes | `#2f6b2c #468a37 #5fa843 #85c95a` |
| Sable | `#c9b06c #dfc98a #ecdca2 #f6ebbf` |
| Pierre (sol) | `#6f747f #878c96 #9ea3ac #b8bcc4` |
| Neige | `#c9d5e1 #e3eaf1 #f3f7fa #ffffff` |
| Terre (flancs) | `#4a2f1c #62402a #7a5233 #8e6440` |
| Eau / profonde | `#1f4f86 #2a66a6 #3f86c6 #8cc6ee` / `#163a6a #1d4b82 #2c64a3 #6fa9dc` |
| Chemin | `#7a5a3a #94704a #ab875a #c29e6e` |
| Terre retournée | `#4f3220 #664330 #7d5638 #946a44` |
| Pavés | `#5f5a52 #7f786c #9d9586 #bdb4a2` |
| Champignon | `#6e1414 #a8221f #d9412f #f2735a` (pied `#a69b86 #cfc6b2 #ece6d8 #ffffff`) |
| Bois calciné | `#120d0c #2a201c #45362e #62503f` |

### Construit

| Matière | Rampe |
|---|---|
| Plâtre | `#8f7f62 #c2b08a #e3d4ae #f6ecd0` |
| Colombages | `#2e1c10 #4a2e1a #6b4426 #8a5c36` |
| Bois (planches, meubles) | `#3d2614 #5e3d22 #86593a #a87a52` |
| Pierre de taille | `#3f434b #5e636e #808590 #a7acb5` |
| Brique | `#5a2418 #84392a #a8513a #c46e52` |
| Chaume | `#6e5420 #a3812f #cfa94a #ead37a` |
| Tuiles | `#5e1f17 #8f3423 #b84d32 #d9744c` |
| Ardoise | `#252b38 #3a4558 #526079 #7083a0` |
| Bardeaux | `#2e1a10 #4a2c1a #6b4226 #8c5a36` |
| Grange rouge | `#4a1410 #7a2318 #a3362a #c45a44` |
| Porte | `#24160c #3b2414 #5a3a20 #7a5233` |
| Intérieur (noir chaud) | `#0c0806 #17100b #221810 #2e2116` |
| Métal | `#23262e #3a3f4a #5a606e #8a91a0` (fer clair `#2a2e36 #5a606e #9aa2b2 #dfe5ee`) |
| Tissu rouge | `#5e0c1c #981c30 #c83444 #ec5a5e` |
| Crème | `#9c917a #cfc4a8 #ece2c8 #fffaea` |
| Or | `#6b4a10 #b0851e #e0b23a #ffe07a` |
| Os | `#55575e #8d9097 #c4c6cb #eceef0` (orbites `#14141a`) |
| Volets verts / bleus | `#1c3a26 #2a5636 #3c7448 #5a9462` / `#18284a #24406e #355a94 #5078b4` |
| Vitre | `#1b2438`, `#2b3a58`, reflet `#9fb6d8` ; fenêtre allumée la nuit `#ffd77a` / `#fff0b8` |

### Personnages et créature

| Matière | Rampe |
|---|---|
| Peau sombre indigo (créature) | `#090a20 #151848 #22276b #343b8e` |
| Rayures rouges | `#4e0c18 #9c1628 #d22838 #ff5a5e` |
| Chair / cerveau | `#5e2716 #9a4a2c #c97249 #e9a173` (plis = ton −1 en sinusoïdes) |
| Toile beige | `#6e5124 #a9853f #d4b062 #efd08a` |
| Yeux clairs | `#7c6a1c #c9b44a #eee298 #fffbe0` (pupille 1 px) |
| Armure | `#353b48 #626b7c #9aa3b4 #dfe5ee` |
| Sang | `#3e060c #6e0e18 #a01824 #d02c36` |

### Effets

| Effet | Couleurs |
|---|---|
| Charge d'énergie | jaune `#fff3b0/#ffe28a` → orange `#ffb347/#ff9a3c` → rouge `#ff5a5a/#ff2e63` |
| Feu | `#c8281e #ff5a2a #ff9a3c #ffd23f #fff3b0` (contour × 0.45) ; braises `#ffd23f #ffb347 #ff5a2a` |
| Fumée / vapeur | `#34343a #4a4a50 #62626a` / `#e8eef4 #c9d3dc #ffffff` |
| Onde de choc | pointillés `#fff6d8` |
| Éclair | `#8fd8ff` + blanc |
| Eau | ronds `#e8f6ff`, écume `#eaf7ff`, gerbes `#ffffff #d8eefb #8cc6ee` |
| Poussière | `#c9b58f #a8946e #e2d3b0` |
| Ombre au sol | `rgba(10,20,18, 70/255)`, ellipse pleine sans contour |

## 5. Le moteur, partie 1 : `raster.js` (volumes ronds → pixels)

Capsules (tronc, bras, rameaux) et sphères (feuillage, tête, rochers) sont projetées en iso, triées
par z-buffer, éclairées, tramées en 4 tons, puis détourées. C'est ce qui donne le rendu « 3D cuite en
pixel art ». **Copier ce fichier tel quel.**

```js
// Mini moteur "3D -> pixel art" : des capsules et des sphères sont projetées en
// isométrique, triées par z-buffer, ombrées en 4 tons tramés puis détourées.
// Ça permet d'animer un squelette et de cuire chaque frame en vrai sprite pixel.

export const SIN_A = 0.5, COS_A = 0.866; // caméra à 30° = projection 2:1
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);
const L = norm3(-0.55, -0.7, 0.5);

function norm3(x, y, z) { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }

export function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const ramp = (...cols) => cols.map(hex);

export function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(s | 0, 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// Rotation autour de l'axe vertical (torsion du buste).
export function rotZ(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

// Cinématique inverse à 2 os : le genou/coude plie dans la direction `bend`.
export function ik(root, end, l1, l2, bend) {
  let dx = end[0] - root[0], dy = end[1] - root[1], dz = end[2] - root[2];
  let d = Math.hypot(dx, dy, dz);
  const max = l1 + l2 - 0.01;
  if (d > max) { const k = max / d; dx *= k; dy *= k; dz *= k; d = max; }
  // bout collé à la racine : sans ça, le genou partirait à l'infini (division par ~0)
  const min = Math.abs(l1 - l2) + 0.05;
  if (d < min) {
    if (d < 1e-6) { dx = 0; dy = 0; dz = -1; d = 1; }
    const k = min / d; dx *= k; dy *= k; dz *= k; d = min;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d, uz = dz / d;
  // composante de bend perpendiculaire à l'axe
  const dot = bend[0] * ux + bend[1] * uy + bend[2] * uz;
  let px = bend[0] - dot * ux, py = bend[1] - dot * uy, pz = bend[2] - dot * uz;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl; py /= pl; pz /= pl;
  return [root[0] + ux * a + px * h, root[1] + uy * a + py * h, root[2] + uz * a + pz * h];
}

/**
 * parts: [{ a:[x,f,z], b?:[x,f,z], r1, r2?, ramp, tex?, group? }]
 *   x = droite du modèle, f = avant, z = haut (unités = pixels avant `scale`)
 * opts: { w, h, ox, oy, facing:[cx, ct], scale }
 *   facing = direction du regard dans le plan caméra (cx = droite écran, ct = vers la caméra)
 */
export function renderModel(parts, opts) {
  const { w, h, ox, oy, scale = 1 } = opts;
  const [fx, ft] = opts.facing || [0, 1];
  const rx = -ft, rt = fx;
  const data = new Uint8ClampedArray(w * h * 4);
  const zbuf = new Float32Array(w * h).fill(-1e9);
  const gbuf = new Int16Array(w * h).fill(-1);
  const fc = norm3(fx, ft * SIN_A, ft * COS_A);

  const project = (p) => {
    const mx = p[0] * scale, mf = p[1] * scale, mz = p[2] * scale;
    const cx = mx * rx + mf * fx;
    const ct = mx * rt + mf * ft;
    return [ox + cx, oy - mz * COS_A + ct * SIN_A, ct * COS_A + mz * SIN_A];
  };

  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    const A = project(part.a), B = part.b ? project(part.b) : A;
    const r1 = part.r1 * scale, r2 = (part.r2 ?? part.r1) * scale;
    const rm = Math.max(r1, r2);
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0]) - rm));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0]) + rm));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1]) - rm));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1]) + rm));
    const dx = B[0] - A[0], dy = B[1] - A[1], len2 = dx * dx + dy * dy;
    const group = part.group ?? pi;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let t = len2 > 0 ? ((px - A[0]) * dx + (py - A[1]) * dy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (A[0] + dx * t), ey = py - (A[1] + dy * t);
        const r = r1 + (r2 - r1) * t;
        const d2 = ex * ex + ey * ey;
        if (d2 > r * r) continue;
        const bulge = Math.sqrt(r * r - d2);
        const depth = A[2] + (B[2] - A[2]) * t + bulge;
        const idx = y * w + x;
        if (depth <= zbuf[idx]) continue;
        const nx = ex / r, ny = ey / r, nz = bulge / r;
        const s = nx * L[0] + ny * L[1] + nz * L[2] + BAYER[(y & 3) * 4 + (x & 3)] * 0.22;
        let shade = s < -0.15 ? 0 : s < 0.3 ? 1 : s < 0.68 ? 2 : 3;
        let col = null;
        if (part.tex) {
          const res = part.tex({ nx, ny, nz, x, y, ex, ey, t, r, shade, fc });
          if (res === null) continue;
          if (typeof res === 'number') shade = res; else col = res;
        }
        if (!col) col = part.ramp[shade < 0 ? 0 : shade > part.ramp.length - 1 ? part.ramp.length - 1 : shade];
        zbuf[idx] = depth;
        gbuf[idx] = group;
        const o = idx * 4;
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      }
    }
  }

  if (opts.outline !== false) outline(data, zbuf, gbuf, w, h);
  return { w, h, data, ox, oy };
}

// Détourage "sel-out" : contour extérieur sombre teinté + lignes internes
// là où une partie passe nettement devant une autre.
function outline(data, zbuf, gbuf, w, h) {
  const src = new Uint8ClampedArray(data);
  const dark = (o, k) => [src[o] * k, src[o + 1] * k, src[o + 2] * k];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      if (src[o + 3] === 0) {
        // pixel vide touchant le sprite -> contour
        let n = -1;
        if (x > 0 && src[o - 4 + 3]) n = o - 4;
        else if (x < w - 1 && src[o + 4 + 3]) n = o + 4;
        else if (y > 0 && src[o - w * 4 + 3]) n = o - w * 4;
        else if (y < h - 1 && src[o + w * 4 + 3]) n = o + w * 4;
        if (n >= 0) {
          const c = dark(n, 0.28);
          data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
        }
        continue;
      }
      // ligne interne : un voisin (haut/gauche/droite) est bien plus proche de la caméra
      const z = zbuf[i], g = gbuf[i];
      const check = (j) => gbuf[j] !== g && zbuf[j] > z + 2.5 && src[j * 4 + 3];
      if ((y > 0 && check(i - w)) || (x > 0 && check(i - 1)) || (x < w - 1 && check(i + 1))) {
        const c = dark(o, 0.5);
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
      }
    }
  }
}

// Petit utilitaire de dessin pixel par pixel (fleurs, herbes, tuiles…).
export function makeBuffer(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  return {
    w, h, data,
    set(x, y, c, a = 255) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= w || y >= h || !c) return;
      const o = (y * w + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = a;
    },
    get(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      return data[(y * w + x) * 4 + 3];
    },
  };
}

// Contour sombre autour d'un buffer dessiné à la main.
export function outlineBuffer(buf, k = 0.3) {
  const { w, h, data } = buf;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (src[o + 3]) continue;
      const ns = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of ns) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = (ny * w + nx) * 4;
        if (src[n + 3] === 255) {
          data[o] = src[n] * k; data[o + 1] = src[n + 1] * k; data[o + 2] = src[n + 2] * k; data[o + 3] = 255;
          break;
        }
      }
    }
  }
  return buf;
}
```

**Utilisation** : `renderModel(parts, { w, h, ox, oy, facing, scale })`.
- `part = { a:[x,f,z], b?:[x,f,z], r1, r2?, ramp, tex?, group? }` — `x` droite, `f` avant, `z` haut,
  en pixels avant `scale`. Sans `b` : une sphère. `r2` : capsule effilée.
- `tex(p)` reçoit `{nx, ny, nz, x, y, ex, ey, t, r, shade, fc}` (normale **en espace écran** :
  `ny < 0` = le dessus ; `t` = position le long de la capsule, 0 en `a`, 1 en `b`) et renvoie un **ton
  0–3**, une **couleur** `[r,g,b]`, ou **`null`** pour un trou (jupe plate, vêtement déchiré).
- `group` : pas de ligne interne entre les parties d'un même groupe (un feuillage d'un seul tenant).
- `facing = [cx, ct]` : direction du regard (personnages en 8 directions : angle `k * 45°`).
- **Cadres larges** (le rognage les rend gratuits) : un membre ne doit jamais toucher le bord.
- `ik(racine, bout, l1, l2, plier)` : genoux et coudes en cinématique inverse.
- Dessin pixel par pixel : `makeBuffer(w, h)` puis `outlineBuffer(buf, 0.3 à 0.45)`.

## 6. Le moteur, partie 2 : volumes droits (bâtiments, meubles, props)

Les capsules ne font pas de murs droits. Ici chaque pixel lance un **rayon iso** dans des boîtes,
cylindres, ellipsoïdes, capsules. Coordonnées monde `u` (= x), `v` (= y), `z` : **16 unités = 1 tuile,
8 = une marche**. Une boîte est rendue en voie rapide ; les autres volumes par pas de 0,25.
Les **matières** sont des fonctions `mat(q)` de `q = {u, v, z, n, face ('t' dessus, 'l' face +v à gauche,
'r' face +u à droite), shade, x, y, glow}` qui renvoient un ton ou une couleur : joints de pierre,
lames de planche, rangées de tuiles, colombages, fenêtres (`q.glow = 1` → rallumée la nuit).
`rotPrims(prims, k)` tourne un objet de k quarts de tour (4 orientations), `turnPrims(prims, angle)`
d'un angle quelconque (mettre une porte face caméra).

```js
import { ramp, hex, hash, makeBuffer, outlineBuffer } from './raster.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
// Lumière en haut à gauche de l'écran, un peu devant : dans le monde, c'est vers -u, +v et le haut.
const L = nrm(-0.25, 0.55, 0.8);
const GLOW = [255, 205, 110]; // couche des fenêtres et lueurs allumées la nuit

// u = axe x du monde (vers le bas à droite de l'écran), v = axe y (vers le bas à gauche), z = haut.
// 16 unités = 1 tuile, 8 unités de z = une marche. Écran : sx = u - v, sy = (u + v) / 2 - z.
const box = (u0, u1, v0, v1, z0, z1, rmp, mat) => ({ box: true, b: [u0, u1, v0, v1, z0, z1], ramp: rmp, mat });

function cylinder(cu, cv, r, z0, z1, rmp, mat, { inner = 0, bulge = 0, top = null } = {}) {
  const rAt = (z) => r + bulge * Math.sin(Math.PI * (z - z0) / (z1 - z0));
  const R = r + Math.max(0, bulge);
  return {
    b: [cu - R, cu + R, cv - R, cv + R, z0, z1], ramp: rmp, mat,
    inside(u, v, z) {
      if (z < z0 || z > (top ? Math.min(z1, top(u - cu, v - cv)) : z1)) return false;
      const d = Math.hypot(u - cu, v - cv);
      return d <= rAt(z) && d >= inner;
    },
    normal(u, v, z) {
      const zt = top ? Math.min(z1, top(u - cu, v - cv)) : z1;
      if (zt - z < 0.3) return [0, 0, 1];
      const du = u - cu, dv = v - cv, d = Math.hypot(du, dv) || 1;
      if (inner && d - inner < 0.35) return [-du / d, -dv / d, 0];
      return [du / d, dv / d, 0];
    },
  };
}

function ellipsoid(cu, cv, cz, a, b, c, rmp, mat, zmin = 0) {
  return {
    b: [cu - a, cu + a, cv - b, cv + b, Math.max(zmin, cz - c), cz + c], ramp: rmp, mat,
    inside(u, v, z) {
      if (z < zmin) return false;
      const x = (u - cu) / a, y = (v - cv) / b, w = (z - cz) / c;
      return x * x + y * y + w * w <= 1;
    },
    normal(u, v, z) { return nrm((u - cu) / (a * a), (v - cv) / (b * b), (z - cz) / (c * c)); },
  };
}

function capsule(A, B, r, rmp, mat) {
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
  const near = (u, v, z) => {
    let t = ((u - A[0]) * d[0] + (v - A[1]) * d[1] + (z - A[2]) * d[2]) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return [A[0] + d[0] * t, A[1] + d[1] * t, A[2] + d[2] * t];
  };
  return {
    b: [Math.min(A[0], B[0]) - r, Math.max(A[0], B[0]) + r, Math.min(A[1], B[1]) - r, Math.max(A[1], B[1]) + r, Math.min(A[2], B[2]) - r, Math.max(A[2], B[2]) + r],
    ramp: rmp, mat,
    inside(u, v, z) { const p = near(u, v, z); return (u - p[0]) ** 2 + (v - p[1]) ** 2 + (z - p[2]) ** 2 <= r * r; },
    normal(u, v, z) { const p = near(u, v, z); return nrm(u - p[0], v - p[1], z - p[2]); },
  };
}

const faceOf = (n) => (n[2] > 0.6 ? 't' : Math.abs(n[1]) >= Math.abs(n[0]) ? 'l' : 'r');
function classify(P, u, v, z) {
  for (const e of [0.2, 0.45, 0.9, 1.6]) {
    if (!P.inside(u, v, z + e)) return [0, 0, 1];
    if (!P.inside(u, v + e, z)) return [0, 1, 0];
    if (!P.inside(u + e, v, z)) return [1, 0, 0];
  }
  return [0, 0, 1];
}

// Tourne des volumes de k quarts de tour autour de l'axe vertical (le centre de la tuile, ou le coin
// commun d'un bâtiment). Les matières voient les coordonnées et les faces d'origine : seuls la forme
// et l'éclairage tournent.
const rotUV = (u, v, k) => (k === 0 ? [u, v] : k === 1 ? [-v, u] : k === 2 ? [-u, -v] : [v, -u]);
export function rotPrims(prims, k) {
  if (!k) return prims;
  const ik = (4 - k) & 3;
  return prims.map((P) => {
    const b = P.b, c1 = rotUV(b[0], b[2], k), c2 = rotUV(b[1], b[3], k);
    const R = { ...P, b: [Math.min(c1[0], c2[0]), Math.max(c1[0], c2[0]), Math.min(c1[1], c2[1]), Math.max(c1[1], c2[1]), b[4], b[5]] };
    if (!P.box) {
      R.inside = (u, v, z) => { const [a, w] = rotUV(u, v, ik); return P.inside(a, w, z); };
      R.normal = (u, v, z) => {
        const [a, w] = rotUV(u, v, ik), n = P.normal ? P.normal(a, w, z) : classify(P, a, w, z), [nu, nv] = rotUV(n[0], n[1], k);
        return [nu, nv, n[2]];
      };
    }
    if (P.mat) {
      R.mat = (q) => {
        const { u, v, n, face } = q, [a, w] = rotUV(u, v, ik), [nu, nv] = rotUV(n[0], n[1], ik);
        q.u = a; q.v = w; q.n = [nu, nv, n[2]]; q.face = faceOf(q.n);
        const res = P.mat(q);
        q.u = u; q.v = v; q.n = n; q.face = face;
        return res;
      };
    }
    return R;
  });
}

// Tourne des volumes d'un angle quelconque (les boîtes deviennent des volumes ordinaires).
// Sert à mettre la porte d'un abri rond face à la caméra.
function turnPrims(prims, ang) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const fw = (u, v) => [u * c - v * sn, u * sn + v * c], bw = (u, v) => [u * c + v * sn, -u * sn + v * c];
  return prims.map((P) => {
    const b = P.b, pts = [fw(b[0], b[2]), fw(b[1], b[2]), fw(b[0], b[3]), fw(b[1], b[3])];
    const ins = P.box ? (u, v, z) => u >= b[0] && u <= b[1] && v >= b[2] && v <= b[3] && z >= b[4] && z <= b[5] : P.inside;
    const Q = { ...P, box: false, inside: ins };
    const R = { ...P, box: false, b: [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1])), b[4], b[5]] };
    R.inside = (u, v, z) => { const [a, w] = bw(u, v); return ins(a, w, z); };
    R.normal = (u, v, z) => { const [a, w] = bw(u, v), n = P.normal ? P.normal(a, w, z) : classify(Q, a, w, z), [nu, nv] = fw(n[0], n[1]); return [nu, nv, n[2]]; };
    if (P.mat) {
      R.mat = (q) => {
        const { u, v, n, face } = q, [a, w] = bw(u, v), [nu, nv] = bw(n[0], n[1]);
        q.u = a; q.v = w; q.n = [nu, nv, n[2]]; q.face = faceOf(q.n);
        const res = P.mat(q);
        q.u = u; q.v = v; q.n = n; q.face = face;
        return res;
      };
    }
    return R;
  });
}
const FACE_CAM = -Math.PI / 4; // l'entrée (côté +v) tournée vers la caméra, en bas au milieu

/** Rend une liste de volumes en sprite pixel. Renvoie { img, glow } recadrés autour du dessin. */
function renderSolids(prims, W = 104, H = 150, OX = 52, OY = 116) {
  const n = W * H;
  const data = new Uint8ClampedArray(n * 4);
  const depth = new Float32Array(n).fill(-1e9);
  const pid = new Int16Array(n).fill(-1);
  const glow = new Uint8Array(n);
  const q = { u: 0, v: 0, z: 0, n: null, face: 't', shade: 0, x: 0, y: 0, glow: 0 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x + 0.5 - OX, sy = y + 0.5 - OY;
      let best = -1e9, bp = -1, bu = 0, bv = 0, bz = 0, bn = null;
      for (let i = 0; i < prims.length; i++) {
        const P = prims[i], b = P.b;
        const hu = 2 * b[1] - sx, hv = 2 * b[3] + sx, hz = 2 * (b[5] + sy);
        const hi = Math.min(hu, hv, hz);
        const lo = Math.max(2 * b[0] - sx, 2 * b[2] + sx, 2 * (b[4] + sy));
        if (hi < lo || hi <= best) continue;
        if (P.box) {
          best = hi; bp = i;
          bn = hi === hz ? [0, 0, 1] : hi === hv ? [0, 1, 0] : [1, 0, 0];
          bu = (hi + sx) / 2; bv = (hi - sx) / 2; bz = hi / 2 - sy;
          continue;
        }
        for (let s = hi; s >= lo && s > best; s -= 0.25) {
          const u = (s + sx) / 2, v = (s - sx) / 2, z = s / 2 - sy;
          if (P.inside(u, v, z)) {
            best = s; bp = i; bu = u; bv = v; bz = z;
            bn = P.normal ? P.normal(u, v, z) : classify(P, u, v, z);
            break;
          }
        }
      }
      if (bp < 0) continue;
      const P = prims[bp], idx = y * W + x;
      const lit = bn[0] * L[0] + bn[1] * L[1] + bn[2] * L[2] + BAYER[(y & 3) * 4 + (x & 3)] * 0.16;
      q.u = bu; q.v = bv; q.z = bz; q.n = bn; q.face = faceOf(bn); q.x = x; q.y = y; q.glow = 0;
      q.shade = lit < -0.45 ? 0 : lit < 0.25 ? 1 : lit < 0.7 ? 2 : 3;
      let res = P.mat ? P.mat(q) : q.shade;
      // grain : quelques pixels plus sombres ou plus clairs
      if (typeof res === 'number' && !P.smooth) {
        const r = hash(x, y, bp * 7 + 1);
        if (r < 0.08) res = Math.max(0, res - 1); else if (r > 0.965) res = Math.min(3, res + 1);
      }
      const col = typeof res === 'number' ? P.ramp[Math.max(0, Math.min(3, res))] : res;
      const o = idx * 4;
      data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      depth[idx] = best; pid[idx] = bp; glow[idx] = q.glow;
    }
  }
  // lignes internes : un voisin (haut/gauche/droite) passe nettement devant
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (pid[i] < 0) continue;
    const chk = (j) => pid[j] >= 0 && (pid[j] !== pid[i] ? depth[j] > depth[i] + 3 : depth[j] > depth[i] + 8);
    if ((y > 0 && chk(i - W)) || (x > 0 && chk(i - 1)) || (x < W - 1 && chk(i + 1))) {
      const o = i * 4;
      data[o] = src[o] * 0.55; data[o + 1] = src[o + 1] * 0.55; data[o + 2] = src[o + 2] * 0.55;
    }
  }
  return crop({ w: W, h: H, data }, glow, OX, OY);
}

// Recadre autour du dessin (+1 px pour le contour), détoure, sépare la couche lumineuse.
function crop(full, glow, OX, OY) {
  let x0 = full.w, y0 = full.h, x1 = -1, y1 = -1;
  for (let y = 0; y < full.h; y++) for (let x = 0; x < full.w; x++) {
    if (!full.data[(y * full.w + x) * 4 + 3]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(full.w - 1, x1 + 1); y1 = Math.min(full.h - 1, y1 + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const img = makeBuffer(w, h), lights = makeBuffer(w, h);
  let lit = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y + y0) * full.w + x + x0) * 4, d = (y * w + x) * 4;
    for (let k = 0; k < 4; k++) img.data[d + k] = full.data[s + k];
    if (glow[(y + y0) * full.w + x + x0]) { lights.set(x, y, GLOW, 255); lit = true; }
  }
  outlineBuffer(img, 0.3);
  const ox = OX - x0, oy = OY - y0;
  return { img: Object.assign(img, { ox, oy }), glow: lit ? Object.assign(lights, { ox, oy }) : null };
}
```

**Exemple** — un coffre (bois cerclé de fer, serrure dorée), tournable (à coller sous le moteur ci-dessus) :

```js
const WOOD = ramp('#3d2614', '#5e3d22', '#86593a', '#a87a52');
const METAL = ramp('#23262e', '#3a3f4a', '#5a606e', '#8a91a0');
const GOLDR = ramp('#6b4a10', '#b0851e', '#e0b23a', '#ffe07a');
function chest(k = 0) {
  return renderSolids(rotPrims([{ ...box(-5, 5, -3.6, 3.6, 0, 7.5, WOOD, (q) => {
    if (q.face === 't') return Math.abs(q.v) > 2.8 ? METAL[2] : 3;
    const a = q.face === 'l' ? q.u : q.v;
    if (Math.abs(Math.abs(a) - (q.face === 'l' ? 3.8 : 2.4)) < 0.5) return METAL[Math.min(3, q.shade + 1)]; // cerclages
    if (Math.abs(q.z - 5) < 0.4) return 0;                                                                // le couvercle
    if (q.face === 'l' && Math.abs(q.u) < 0.8 && q.z > 3.4 && q.z < 5.8) return GOLDR[Math.min(3, q.shade + 1)];
    return q.shade;
  }), smooth: true }], k), 48, 56, 24, 40); // cadre 48x56, ancre (24, 40)
}
```

`smooth: true` coupe le grain (surfaces lisses : métal, tissu, verre).

## 7. Les tuiles isométriques

- Losange 32×16 : la ligne `r` (0..15) va de `14 - 2r` à `17 + 2r` (symétrique en bas).
- Sous le dessus, les **flancs** descendent de `niveau × 8 + 7` px : **flanc gauche plus clair** (ton 2)
  que le droit (ton 1), une **strate** plus sombre tous les 8 px, grain `hash`.
- Herbe et neige : une **lèvre** de 2–3 px de la couleur du dessus coule sur le flanc.
- Dessus : ton 1 de base, ~13 % de ton 0, ~12 % de ton 2, quelques pixels de ton 3 (brins, cailloux).
- **Liserés** : bord haut clair (blanc ~25 %) ; bord bas sombre (noir ~20 %) quand le voisin est plus bas.
- Toute nouvelle matière de sol : un dessus 4 tons + une rampe de flanc + un grain `hash`.
- Eau : 4 images animées, ronds et écume `#eaf7ff` sur les berges.

```js
// rampes de dessus de quelques sols (voir la palette plus bas)
const TOPS = {
  [T.GRASS]: ramp('#4b8a35', '#5c9e3f', '#73b84d', '#8fd162'),
  [T.FOREST]: ramp('#2f6329', '#3c7533', '#4f9142', '#68a854'),
  [T.MEADOW]: ramp('#5c9e3f', '#6fb34a', '#86c75a', '#a3d96f'),
  [T.SAND]: ramp('#c9b06c', '#dfc98a', '#ecdca2', '#f6ebbf'),
  [T.STONE]: ramp('#6f747f', '#878c96', '#9ea3ac', '#b8bcc4'),
  [T.SNOW]: ramp('#c9d5e1', '#e3eaf1', '#f3f7fa', '#ffffff'),
  [T.PATH]: ramp('#7a5a3a', '#94704a', '#ab875a', '#c29e6e'),
  [T.DIRT]: ramp('#4f3220', '#664330', '#7d5638', '#946a44'),
  [T.COBBLE]: ramp('#5f5a52', '#7f786c', '#9d9586', '#bdb4a2'),
  [T.DEN]: ramp('#2a1d14', '#3a2a1c', '#4a3624', '#5c4630'), // terre battue
  [T.EARTH]: ramp('#4a2f1c', '#5e3d26', '#73502f', '#8a6440'),
  [T.EARTH_STONE]: ramp('#4a2f1c', '#5e3d26', '#73502f', '#8a6440'),
  [T.EARTH_IRON]: ramp('#4a2f1c', '#5e3d26', '#73502f', '#8a6440'),
  [T.BEDROCK]: ramp('#141218', '#1f1c25', '#2b2733', '#3a3545'),
  [T.PLANK]: ramp('#3d2614', '#5e3d22', '#86593a', '#a87a52'),
  [T.WALL_IN]: ramp('#24160c', '#3b2414', '#5a3a20', '#7a5233'),
  [T.WALL_HIDE]: ramp('#090a20', '#151848', '#22276b', '#343b8e'),
};
// Largeur de la ligne r du losange (0..15) : de 14-2r à 17+2r.
export function rowSpan(r) {
  const rr = r < 8 ? r : 15 - r;
  return [14 - 2 * rr, 17 + 2 * rr];
}
```

Le dessin d'un bloc (dessus + flancs), à adapter avec vos rampes :

```js
export function blockBuffer(type, level, v) {
  const sideH = level * 8 + 7;
  const b = makeBuffer(TILE_W, TILE_H + sideH);
  const top = TOPS[type];
  const grassy = type === T.GRASS || type === T.FOREST || type === T.MEADOW;
  const earthy = type === T.PATH || type === T.DIRT;
  const earthWall = type === T.EARTH || type === T.EARTH_STONE || type === T.EARTH_IRON;
  const sideRamp = type === T.SAND ? SANDSIDE : grassy || earthy || earthWall || type === T.DEN ? DIRT : type === T.BEDROCK ? top : STONESIDE;
  const seed = type * 31 + v * 7;

  // faces latérales
  for (let x = 0; x < TILE_W; x++) {
    const edge = x < 16 ? 8 + (x >> 1) : 8 + ((31 - x) >> 1);
    const left = x < 16;
    for (let d = 1; d <= sideH; d++) {
      const y = edge + d;
      const r = hash(x, y, seed + 3);
      let c;
      if (type === T.WALL_IN || type === T.WALL_HIDE) { c = innerWall(type, x, d, sideH, left, r); b.set(x, y, c); continue; }
      if (VEIN[type] && hash(x >> 1, y >> 1, seed + 9) < (type === T.EARTH_IRON ? 0.16 : 0.3)) { c = VEIN[type][left ? 2 : 1]; if (r > 0.9) c = VEIN[type][3]; b.set(x, y, c); continue; }
      if (earthWall && hash(x, y >> 2, seed + 12) < 0.04) { b.set(x, y, DIRT[0]); continue; } // racines
      if (grassy && (d <= 2 || (d === 3 && hash(x, 0, seed) < 0.5))) c = top[left ? 1 : 0];
      else if (type === T.SNOW && (d <= 3 || (d === 4 && hash(x, 0, seed) < 0.5))) c = top[left ? 2 : 0];
      else {
        let s = left ? 2 : 1;
        if (d % 8 === 0) s -= 1; // strates
        if (r < 0.12) s -= 1; else if (r > 0.94) s += 1;
        if (grassy && r > 0.985) c = STONESIDE[2];
        else c = sideRamp[Math.max(0, Math.min(3, s))];
      }
      b.set(x, y, c);
    }
  }
  // dessus
  for (let r = 0; r < 16; r++) {
    const [x0, x1] = rowSpan(r);
    for (let x = x0; x <= x1; x++) {
      const h = hash(x, r, seed);
      let s = 1;
      if (h < 0.13) s = 0; else if (h > 0.88) s = 2;
      if (grassy && h > 0.972) { s = 3; b.set(x, r + 1, top[0]); }
      if (type === T.STONE && h > 0.95) s = 0;
      if (type === T.SNOW && h > 0.97) s = 3;
      if (type === T.DIRT) {
        // terre retournée : mottes claires avec leur ombre dessous
        if (h > 0.9) { s = 3; b.set(x, r + 1, top[0]); } else if (h < 0.22) s = 0;
      }
      if (type === T.PATH && h > 0.975) { s = 3; b.set(x + 1, r, STONESIDE[2]); } // petits cailloux
      if (type === T.COBBLE) s = cobbleShade(x, r, seed);
      if (type === T.PLANK) { const u = (x - 16) / 2 + r; s = ((u + 64) % 4) < 0.8 ? 0 : h < 0.15 ? 1 : 2; } // lames de plancher
      if (type === T.DEN && h > 0.94) { s = 3; b.set(x, r + 1, top[0]); } // cailloux
      if (VEIN[type] && hash(x >> 1, r >> 1, seed + 7) < (type === T.EARTH_IRON ? 0.2 : 0.32)) { b.set(x, r, VEIN[type][h > 0.6 ? 3 : 2]); continue; }
      if (earthWall && h > 0.965) s = 3;
      if (type === T.WALL_IN || type === T.WALL_HIDE) s = h < 0.2 ? 0 : 1;
      b.set(x, r, top[s]);
    }
  }
  // fleurettes et cailloux sur certaines variantes
  if (type === T.MEADOW && v % 2 === 0) {
    const cols = ['#fff3a0', '#ffffff', '#ff9ec0'].map(hex);
    for (let i = 0; i < 4; i++) {
      const r = 3 + ((hash(i, v, 5) * 10) | 0), [x0, x1] = rowSpan(r);
      b.set(x0 + 2 + ((hash(i, v, 6) * (x1 - x0 - 4)) | 0), r, cols[i % 3]);
    }
  }
  return Object.assign(b, { ox: 16, oy: 0 });
}
```

## 8. Recettes de sprites (proportions et astuces qui font le style)

**Arbre feuillu** — canevas 60×78, ancre (30, 70), échelle 0.75 à 1.25. Tronc = capsule effilée
(r 3.4 → 2.4) + 2 racines en sphères ; houppier = **grappe de 5 à 7 sphères** (rayons 6–10) groupées,
celles du haut dans un 2e groupe (une ligne interne sépare les étages). Texture : ±1 ton au hash.

**Sapin** — tronc à racines, puis **5 étages** : chaque étage = un **cœur conique** (un ton plus
sombre) + une **couronne de 5 à 8 rameaux** en capsules qui partent du tronc et **retombent**, en
éventail **décalé** d'un étage à l'autre → silhouette dentelée. Bouts des rameaux +1 ton (`t > 0.72`),
dessous −1 (`ny > 0.5`), aiguilles au hash, quelques pommes de pin. Neige : sur le dessus des rameaux
(`ny < -0.2`). Pointe effilée au sommet.

**4 images de balancement** pour tout le végétal : décalage `sin(f/4 × 2π) × 0.06 × (z − 10)` → le haut
bouge plus que le bas.

```js
function treeParts(kind, f, seed) {
  const sway = Math.sin(f / SWAY_FRAMES * Math.PI * 2);
  const parts = [];
  const sw = (z) => sway * 0.06 * Math.max(0, z - 10); // le haut bouge plus que le bas
  if (kind === 'oak' || kind === 'cherry') {
    const leaves = kind === 'cherry' ? CHERRY : (seed & 1 ? LEAF : LEAF_FOREST);
    parts.push({ a: [0, 0, 0], b: [sw(16), 0, 17], r1: 3.4, r2: 2.4, ramp: BARK, group: 1,
      tex: (p) => ((p.x + 1) % 3 === 0 && p.shade > 0 ? p.shade - 1 : p.shade) });
    parts.push({ a: [-2.5, 1, 0.5], r1: 2, ramp: BARK, group: 1 });
    parts.push({ a: [2.5, -1, 0.5], r1: 2, ramp: BARK, group: 1 });
    const blobs = [[0, 0, 25, 10], [-7, 2, 21, 7], [7, 1, 21, 7.5], [-2, -6, 27, 8], [4, 5, 28, 7], [-4, 2, 32, 6.5], [3, -2, 33, 6]];
    blobs.forEach(([x, y, z, r], i) => {
      parts.push({ a: [x + sw(z), y, z], r1: r, ramp: leaves, group: 2 + (i > 3 ? 1 : 0), tex: leafTex(seed + i, sway * 0.06 * (z - 10)) });
    });
  } else if (kind === 'pine' || kind === 'snowpine') {
    // Sapin : un tronc à racines, puis des étages de branches. Chaque étage = un cœur conique
    // plus une couronne de rameaux qui partent du tronc et retombent : la silhouette est
    // dentelée comme un vrai sapin. Bouts des rameaux plus clairs, dessous dans l'ombre,
    // aiguilles en grain, quelques pommes de pin ; la neige se pose sur le dessus des rameaux.
    const snow = kind === 'snowpine', rnd = (k) => hash(k, seed, 41);
    const needles = (i, core) => (p) => {
      const r = hash(p.x, p.y, seed + i * 13);
      if (snow && p.ny < (core ? -0.55 : -0.2) && r < 0.88) return SNOWY[Math.min(3, p.shade + (p.ny < -0.6 ? 1 : 0))];
      if (!core && r > 0.988 && p.t > 0.35 && p.ny > -0.2) return CONE;
      let sh = p.shade;
      if (core) sh--; // le cœur, sous les rameaux : de la profondeur entre les étages
      else if (p.t > 0.72) sh++; // les bouts au soleil
      if (p.ny > 0.5) sh--; // le dessous
      if (r < 0.17) sh--; else if (r > 0.95) sh++;
      return Math.max(0, Math.min(3, sh));
    };
    parts.push({ a: [0, 0, 0], b: [sw(12), 0, 12], r1: 2.3, r2: 1.3, ramp: BARK, group: 1,
      tex: (p) => ((p.y % 3 === 0 || hash(p.x, p.y, 8) < 0.15) && p.shade > 0 ? p.shade - 1 : p.shade) });
    for (const [x, y] of [[-2.8, 1.3], [2.6, -1.2], [0.8, 2.8]]) parts.push({ a: [x, y, 0.3], b: [0, 0, 2.6], r1: 1.25, r2: 1, ramp: BARK, group: 1 });
    const tiers = [[9.5, 11, 8], [14.5, 9.3, 8], [19.5, 7.5, 7], [24.2, 5.7, 6], [28.5, 4, 5]];
    tiers.forEach(([z, R, n], i) => {
      const g = 2 + i;
      parts.push({ a: [sw(z - 1), 0, z - 1], b: [sw(z + 6), 0, z + 6], r1: R * 0.6, r2: 0.9, ramp: PINE, group: g, tex: needles(i, true) });
      for (let k = 0; k < n; k++) {
        const a = (k / n + rnd(i * 17 + k) * 0.1 + i * 0.29) * Math.PI * 2, rr = R * (0.82 + rnd(i * 17 + k + 7) * 0.26);
        const ez = z - 2 - rnd(i * 31 + k) * 1.4, sz = z + 1.2;
        parts.push({ a: [sw(sz) + Math.cos(a) * 1.2, Math.sin(a) * 1.2, sz], b: [sw(ez) + Math.cos(a) * rr, Math.sin(a) * rr, ez],
          r1: 2.5 - i * 0.22, r2: 1.05, ramp: PINE, group: g, tex: needles(i, false) });
      }
    });
    parts.push({ a: [sw(31), 0, 31], b: [sw(38), 0, 38], r1: 1.7, r2: 0.35, ramp: PINE, group: 8, tex: needles(6, true) });
  }
  return parts;
}
```

**Rochers** — 2 à 4 sphères qui se chevauchent (une grosse, deux petites), groupes différents (lignes
internes), mousse sur le dessus (`ny < -0.35`).

**Buissons** — 3 sphères, 2 images. Baies : 7 % des pixels lumineux remplacés par du rouge.

**Petits objets plats** (herbes, fleurs, roseaux, cailloux) — pixel par pixel, 2–3 images de
balancement (le bout des brins bouge en `k²`), contour × 0.4 :

```js
function grassFrames() {
  const cols = ramp('#2f6b2c', '#468a37', '#5fa843', '#85c95a');
  const blades = [[-5, 7, -1], [-3, 10, 0], [-1, 12, 1], [1, 9, 0], [3, 11, 1], [5, 8, 2], [0, 6, 2], [-6, 5, 1]];
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const b = makeBuffer(20, 18);
    const sway = [0, 1, -1][f];
    for (const [bx, len, c] of blades) {
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const x = 10 + bx + Math.round(sway * k * k * 2 + (bx > 0 ? k * 1.5 : -k * 1.5));
        b.set(x, 16 - i, cols[Math.min(3, c + (k > 0.7 ? 1 : 0))]);
      }
    }
    frames.push(Object.assign(outlineBuffer(b, 0.4), { ox: 10, oy: 15 }));
  }
  return frames;
}
```

**Ombre au sol** sous les arbres, rochers, personnages :

```js
export function shadowBuffer(rw, rh) {
  const w = rw * 2 + 2, h = rh * 2 + 2;
  const b = makeBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - w / 2) / rw, dy = (y + 0.5 - h / 2) / rh;
    if (dx * dx + dy * dy <= 1) b.set(x, y, [10, 20, 18], 70);
  }
  return Object.assign(b, { ox: w / 2, oy: h / 2 });
}
```

**Personnages** (même moteur que les arbres) — habitant ~27 px de haut (enfant ~19), canevas 64×62,
ancre (32, 50) ; créature massive ~40 px, canevas 88×88. Tête = sphère, visage = la partie avant
(`dot(normale, fc) > 0.3`), cheveux au-dessus ; vêtements en capsules plus larges ; mains et pieds en
sphères. **8 directions**, chaque animation cuite dans les 8. Robes : un cône dont l'ourlet suit le pas.
Le haut d'une autre couleur que le bas, sinon les bras s'y fondent.

**Quadrupèdes** — canevas 56×56, ancre (28, 44). Vus pile de face ou de dos, les tourner de ~25° sinon
ce n'est qu'un trait. Pattes écartées, oreilles assez grandes pour dépasser de la tête.

**Bâtiments** — 2×2 tuiles, volumes droits (section 6) : murs en boîte, toit à deux pans, pignons,
cheminée, fenêtres (`glow` la nuit), portes en `INTERIOR`. **3 états** : intact → abîmé (trous au
toit, fissures, crépi tombé, gravats) → ruine (murs en dents, plancher, poutres calcinées).

**Meubles, props** — volumes droits, cadre 48×56 ancre (24, 40), `rotPrims` pour 4 orientations.

## 9. Animation : l'esprit

- **Poses clés** + interpolation, ou sinus pour les cycles (marche, nage, balancement).
- **Grandes amplitudes, poids qui bascule, hanches qui tournent** ; jamais robotique. Respiration au
  repos (le buste monte/descend d'1 px).
- Chaque animation est **cuite au chargement** (toutes images × 8 directions) puis rangée dans une
  planche (atlas). En jeu on ne fait que copier des rectangles.
- **Balancement du végétal** : une horloge `swayT += dt × (1 + min(1.5, vent) × 1.2)` ; image =
  `floor(swayT × 1.3 (arbre) ou 1.8 (herbe) + phase par objet + petite vague) % 4`. **Ne jamais**
  calculer `floor(temps × vitesse × rafale)` : quand la rafale varie, ça clignote.
- Eau : 4 images en boucle (~3 img/s), décalées par tuile.

## 10. Effets visuels

- **Particules** : 1–2 px, couleurs tirées d'une liste de 3–4 teintes **de la matière** (feuilles, roche,
  bois, poussière, eau…), gravité, traînée.
- **Traînées** (vent, énergie) : quelques pixels alignés sur la vitesse projetée à l'écran.
- **Flammes** : petits buffers pixel (3 tailles × 4 images), ravivées par-dessus la teinte de nuit avec
  un halo orange en mode `lighter`.
- **Ondes de choc / arcs** : pointillés `#fff6d8` qui s'étendent et s'effacent.
- **Jour/nuit** : un rectangle plein écran en `multiply` (bleu nuit, orangé au crépuscule), puis on
  **rallume** fenêtres, lanternes, yeux, lucioles en `lighter`. Pas de brouillard voilant l'écran.
- **Secousse d'écran** dosée selon l'impact (pas ≈ 1.5, coup ≈ 2.5, gros coup 5–16 px).
- **Sol abîmé** : fissures pixel en 3 niveaux, cratère = la tuile descend d'une marche.

## 11. Interface

- **Police pixel maison 3×5**, en majuscules, **ombre décalée de 1 px**. Accents ramenés à la lettre
  de base. Largeur d'un texte : `n × 4 − 1`.
- Boutons ronds pixel (cercle plein, alpha ~200/255) avec la lettre au centre et le libellé dessous.
  Couleurs : rouge `[225,70,90]`, violet `[120,90,220]`, vert `[70,170,110]`, jaune `[230,170,50]`,
  rose `[200,90,120]`, bleu-vert `[60,165,190]`.
- Panneaux en relief (biseau clair en haut à gauche, sombre en bas à droite, contour noir 1 px) ;
  cases creusées (l'inverse). Les écrans propres au jeu reprennent sa palette (ex. peau indigo,
  rayures rouges, or) plutôt qu'un gris générique.
- Icônes 12×12 pixel par pixel, contour × 0.35, affichées ×1 ou ×2 (jamais en facteur non entier).
- Respecter les zones sûres (encoche iPhone).

```js
// Police pixel 3x5 maison (5 lignes de 3 pixels).
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
  '(': '.#. #.. #.. #.. .#.', ')': '.#. ..# ..# ..# .#.', '>': '#.. .#. ..# .#. #..',
  '%': '#.. ..# .#. #.. ..#', '*': '... #.# .#. #.# ...', ',': '... ... ... .#. #..',
};
const G = {};
for (const k in SRC) G[k] = SRC[k].replace(/ /g, '');
// accents -> lettre de base
const ACC = { 'É': 'E', 'È': 'E', 'Ê': 'E', 'À': 'A', 'Ç': 'C', 'Ô': 'O', 'Û': 'U', 'Î': 'I' };

export function textWidth(s) { return s.length * 4 - 1; }

export function drawText(ctx, s, x, y, color = '#fff', shadow = 'rgba(0,0,0,0.6)') {
  s = s.toUpperCase();
  for (const pass of shadow ? [0, 1] : [1]) {
    ctx.fillStyle = pass ? color : shadow;
    const o = pass ? 0 : 1;
    for (let i = 0; i < s.length; i++) {
      const g = G[ACC[s[i]] || s[i]] || G[' '];
      for (let p = 0; p < 15; p++) {
        if (g[p] === '#') ctx.fillRect(x + i * 4 + (p % 3) + o, y + ((p / 3) | 0) + o, 1, 1);
      }
    }
  }
}
```

## 12. Pipeline : cuire, ranger, dessiner

1. Au chargement : générer chaque sprite (buffer RGBA + ancre `ox`, `oy`).
2. **Rogner** au plus près du dessin et ranger dans des **planches de 2048×2048** (atlas), rangée par
   rangée, 1 px d'écart.
3. En jeu : `draw(sprite, x, y)` = un `drawImage` du rectangle de la planche, coin haut-gauche =
   ancre à l'écran − `ox/oy`. `imageSmoothingEnabled = false`.
4. Ce qui change en cours de partie (un personnage qui mute) : vider sa planche et la recuire.

```js
function toSprite(buf, A = atlasMain) {
  const { w, h, data } = buf;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!data[(y * w + x) * 4 + 3]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { page: null, sx: 0, sy: 0, w: 0, h: 0, width: 0, height: 0, ox: 0, oy: 0 };
  const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
  if (A.page && A.x + sw > ATLAS) { A.x = 0; A.y += A.rowH + 1; A.rowH = 0; } // rangée suivante
  if (!A.page || A.y + sh > ATLAS) {
    // planche suivante : on reprend une planche déjà créée (vidée) avant d'en créer une neuve
    let pg = A.pages[A.used];
    if (!pg) { pg = document.createElement('canvas'); pg.width = pg.height = ATLAS; pg.c = pg.getContext('2d'); A.pages.push(pg); }
    else pg.c.clearRect(0, 0, ATLAS, ATLAS);
    A.used++;
    A.page = pg;
    A.x = A.y = A.rowH = 0;
  }
  const page = A.page, packX = A.x, packY = A.y;
  const img = new ImageData(sw, sh);
  for (let y = 0; y < sh; y++) img.data.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * sw * 4);
  page.c.putImageData(img, packX, packY);
  const spr = { page, sx: packX, sy: packY, w: sw, h: sh, width: sw, height: sh, ox: buf.ox - x0, oy: buf.oy - y0 };
  A.x += sw + 1; // 1 px d'écart entre deux sprites
  A.rowH = Math.max(A.rowH, sh);
  return spr;
}
// Dessine un sprite de planche, son coin haut-gauche en (x, y).
function draw(s, x, y) {
  if (s.page) ctx.drawImage(s.page, s.sx, s.sy, s.w, s.h, x, y, s.w, s.h);
}
```

## 13. Méthode pour un nouveau sprite

1. **Technique** : volume rond (→ `renderModel`), volume droit (→ `renderSolids`) ou petit détail plat
   (→ `makeBuffer` + `outlineBuffer`).
2. **Rampe** : reprendre une rampe des tableaux, ou en créer une cohérente (section 4).
3. **Silhouette** d'abord (taille, proportions à côté d'un personnage de 27 px), puis les tons, puis le
   grain et les détails par `tex`/`mat`.
4. **Vérifier en image** : un petit script Node qui écrit un PNG agrandi ×6 (et ×1) du sprite, l'ouvrir,
   le comparer aux planches de référence. Corriger, recommencer.
5. Seulement ensuite : l'intégrer au jeu, et le regarder en jeu, à taille réelle, de jour et de nuit.

## 14. Checklist avant de valider un sprite

- [ ] 4 tons par matière, pas de dégradé, pas d'anti-aliasing
- [ ] lumière en haut à gauche, ombres en bas à droite, face gauche plus claire que la droite
- [ ] tramage Bayer aux frontières de tons
- [ ] contour sel-out coloré (pas noir), lignes internes entre parties qui se chevauchent
- [ ] grain `hash` présent, aucun motif régulier visible
- [ ] lisible à ×1 (pas de détail < 2 px qui compte)
- [ ] silhouette reconnaissable, dentelée pour le végétal, nette pour le construit
- [ ] couleurs dans la famille des palettes (saturées, pas fluo)
- [ ] ancre au sol au centre de la tuile, rien ne touche le bord du cadre
- [ ] il bouge un peu si c'est vivant (balancement, respiration), lentement
- [ ] il a l'air de sortir du même jeu que les planches de référence

## 15. À ne jamais faire

- Charger des PNG dessinés à la main ou des sprites trouvés en ligne.
- Mettre l'échelle à un facteur non entier, lisser l'image, faire tourner un sprite d'un angle libre
  à l'affichage (seulement des quarts de tour exacts).
- Contour noir pur, ombre portée floue, dégradé radial lisse, glow flou.
- Plus de 4 tons dans une matière ou des couleurs fluo hors effets d'énergie.
- Un voile plein écran (brouillard) qui noie le pixel art.
- Une animation pilotée par `temps × facteur variable` (ça clignote).
