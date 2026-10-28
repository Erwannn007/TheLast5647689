// Volumes droits (bâtiments, meubles, props) : un rayon iso par pixel dans des boîtes,
// cylindres, ellipsoïdes, capsules. Repris du guide docs/spritedesign-rules.md (section 6).
import { ramp, hex, hash, makeBuffer, outlineBuffer } from './raster.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
// Lumière en haut à gauche de l'écran, un peu devant : dans le monde, c'est vers -u, +v et le haut.
const L = nrm(-0.25, 0.55, 0.8);
const GLOW = [255, 205, 110]; // couche des fenêtres et lueurs allumées la nuit

// u = axe x du monde (vers le bas à droite de l'écran), v = axe y (vers le bas à gauche), z = haut.
// 16 unités = 1 tuile, 8 unités de z = une marche. Écran : sx = u - v, sy = (u + v) / 2 - z.
export const box = (u0, u1, v0, v1, z0, z1, rmp, mat) => ({ box: true, b: [u0, u1, v0, v1, z0, z1], ramp: rmp, mat });

export function cylinder(cu, cv, r, z0, z1, rmp, mat, { inner = 0, bulge = 0, top = null } = {}) {
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

export function ellipsoid(cu, cv, cz, a, b, c, rmp, mat, zmin = 0) {
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

export function capsule(A, B, r, rmp, mat) {
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
export function turnPrims(prims, ang) {
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
export const FACE_CAM = -Math.PI / 4; // l'entrée (côté +v) tournée vers la caméra, en bas au milieu

/** Rend une liste de volumes en sprite pixel. Renvoie { img, glow } recadrés autour du dessin. */
export function renderSolids(prims, W = 104, H = 150, OX = 52, OY = 116) {
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
        if (P.ray) {
          // volume analytique (toit) : le prim donne lui-même le point touché
          const hit = P.ray(sx, sy);
          if (hit && hit.s > best && hit.s <= hi + 0.01) { best = hit.s; bp = i; bu = (hit.s + sx) / 2; bv = (hit.s - sx) / 2; bz = hit.s / 2 - sy; bn = hit.n; }
          continue;
        }
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
