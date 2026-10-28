// Murs fins reliés (style maison de lotissement), fenêtres, portes, clôtures et toits.
// Volumes droits (solids.js) : 16 unités = 1 tuile, ancre au centre de la tuile.
import { hash } from '../raster.js';
import { box, renderSolids } from '../solids.js';
import { SIDING, WALLPAPER, ROOF, TRIM, DOOR, GLASS, CONCRETE, PAINTWOOD, WOOD, BRICK, METAL } from '../palette.js';

export const WALL_H = 28, WALL_CUT = 5;
// bits de voisinage : 1 = -x, 2 = +x, 4 = -y, 8 = +y
export const N_W = 1, N_E = 2, N_N = 4, N_S = 8;

// Échange u et v d'une boîte (mur orienté le long de y au lieu de x).
const swapBox = (P) => ({ ...P, b: [P.b[2], P.b[3], P.b[0], P.b[1], P.b[4], P.b[5]] });

// Matière d'un mur : bardage horizontal dehors, papier peint dedans, plinthe, dessus sombre.
// Matières extérieures : 0-4 bardage peint, 5 brique, 6 béton, 7 mur-rideau vitré, 8 grange, 9 tôle.
// upper : étage (pas de soubassement) ; les vitres posent q.glow = 1 (rallumées la nuit s'il y a du courant).
function extMat(e, q, along, upper) {
  const ext = SIDING[e], sh = q.shade;
  const c3 = (s) => ext[Math.max(0, Math.min(3, s))];
  if (!upper && q.z < 2.5 && e !== 7) return CONCRETE[Math.max(0, sh - 1)]; // soubassement
  switch (e) {
    case 5: { // brique : rangs de 2, joints décalés
      const row = Math.floor((q.z + 64) / 2);
      if (((q.z + 64) % 2) < 0.45 || ((along + 64 + (row & 1) * 2.2) % 4.4) < 0.45) return CONCRETE[Math.min(3, sh + 1)];
      return c3(sh - (hash(Math.floor(along / 4.4 + (row & 1) * 0.5), row, 5) < 0.25 ? 1 : 0));
    }
    case 6: // béton : panneaux et joints creux
      if (((along + 64) % 8) < 0.5 || ((q.z + 64) % 14) < 0.5) return c3(sh - 1);
      return c3(sh - (hash(q.x, q.y, 6) < 0.12 ? 1 : 0));
    case 7: { // mur-rideau : montants tous les 4, allège sombre, vitrage qui reflète
      if (((along + 64) % 4) < 0.6 || q.z < 2.2 || q.z > WALL_H - 2) return METAL[Math.min(3, sh + 1)];
      q.glow = 1;
      const refl = ((along + q.z * 0.7 + 64) % 9);
      return refl < 1.2 ? GLASS[3] : c3(sh);
    }
    case 8: // grange : planches verticales
      return c3(sh - (((along + 64) % 2.6) < 0.5 ? 1 : 0) - (hash(Math.floor(along / 2.6), 0, 8) < 0.2 ? 1 : 0));
    case 9: // tôle ondulée
      return c3(sh + (((along + 64) % 1.6) < 0.8 ? 0 : -1));
    default: {
      if (q.z > WALL_H - 1.2) return TRIM[sh];
      const board = ((q.z + 64) % 4) < 0.9;
      return c3(sh - (board ? 1 : 0));
    }
  }
}

function wallMat(style, intU, intV, cutTop, upper) {
  const inn = WALLPAPER[style.int];
  return (q) => {
    if (q.face === 't') return cutTop ? CONCRETE[1] : TRIM[q.shade > 1 ? 1 : 0];
    const inside = q.face === 'l' ? intV : intU;
    const along = q.face === 'l' ? q.u : q.v;
    if (inside) {
      if (q.z < 2) return DOOR[Math.min(3, q.shade + 1)]; // plinthe
      const stripe = ((Math.floor((along + 64) / 3) & 1) === 0);
      const s = q.shade + (stripe && hash(q.x, q.y >> 1, 3) < 0.6 ? -1 : 0);
      return inn[Math.max(0, Math.min(3, s))];
    }
    return extMat(style.ext, q, along, upper);
  };
}

// kind : wall | window | broken | door | open | doorway
export function wallSprite(mask, kind, style, intU, intV, cut, upper = 0) {
  const H = cut ? WALL_CUT : WALL_H;
  const mat = wallMat(style, intU, intV, cut, upper);
  const t = 2;
  let prims = [];
  const straightX = (mask & 3) === 3 && !(mask & 12), straightY = (mask & 12) === 12 && !(mask & 3);
  const special = kind !== 'wall' && (straightX || straightY);
  if (!special) {
    prims.push(box(-t, t, -t, t, 0, H, null, mat));
    if (mask & N_W) prims.push(box(-8, -t, -t, t, 0, H, null, mat));
    if (mask & N_E) prims.push(box(t, 8, -t, t, 0, H, null, mat));
    if (mask & N_N) prims.push(box(-t, t, -8, -t, 0, H, null, mat));
    if (mask & N_S) prims.push(box(-t, t, t, 8, 0, H, null, mat));
  } else {
    // construit le long de x puis tourne si besoin
    const trim = (q) => TRIM[Math.min(3, q.shade + 1)];
    if (kind === 'window' || kind === 'broken') {
      prims.push(box(-8, 8, -t, t, 0, 10, null, mat));
      if (!cut) {
        prims.push(box(-8, 8, -t, t, 20, H, null, mat));
        prims.push(box(-8, -5, -t, t, 10, 20, null, mat), box(5, 8, -t, t, 10, 20, null, mat));
        prims.push(box(-5, 5, -t - 0.5, t + 0.5, 9.2, 10, null, trim)); // appui
        if (kind === 'window') {
          prims.push({ ...box(-5, 5, -0.6, 0.6, 10, 20, null, (q) => {
            const a = q.face === 'l' ? q.u : q.v;
            if (Math.abs(a) < 0.5 || Math.abs(q.z - 15) < 0.4) return TRIM[2]; // croisillons
            const refl = (a + (q.z - 10) * 0.6) % 7;
            q.glow = 1;
            return refl > 0 && refl < 1.4 ? GLASS[3] : GLASS[q.z > 15 ? 1 : 0];
          }), smooth: true });
        } else {
          // éclats de vitre restés dans le cadre
          const shard = (u0, u1, z0, z1) => ({ ...box(u0, u1, -0.5, 0.5, z0, z1, null, (q) => (q.z > (z0 + z1) / 2 ? GLASS[3] : GLASS[1])), smooth: true });
          prims.push(shard(-5, -3, 10, 13), shard(-3, -2, 10, 11.5), shard(2, 5, 10, 12), shard(-1, 2, 18.5, 20), shard(3, 5, 17, 20));
        }
      }
    } else {
      // portes : chambranle + linteau
      const top = 21;
      prims.push(box(-8, -5, -t, t, 0, Math.min(H, WALL_H), null, mat), box(5, 8, -t, t, 0, Math.min(H, WALL_H), null, mat));
      if (!cut) {
        prims.push(box(-5, 5, -t, t, top, H, null, mat));
        prims.push(box(-5.6, -5, -t - 0.4, t + 0.4, 0, top + 0.6, null, trim), box(5, 5.6, -t - 0.4, t + 0.4, 0, top + 0.6, null, trim));
        prims.push(box(-5.6, 5.6, -t - 0.4, t + 0.4, top, top + 0.8, null, trim));
      }
      const leafMat = (q) => {
        if (q.face === 't') return 2;
        const a = q.face === 'l' ? q.u : q.v;
        if (Math.abs(a - 3) < 0.7 && Math.abs(q.z - 10) < 0.7) return CONCRETE[3]; // poignée
        const panel = (Math.abs(q.z - 6) < 3.4 || Math.abs(q.z - 15.5) < 3.4) && Math.abs(a) < 3.2;
        const edge = panel && (Math.abs(Math.abs(q.z - 6) - 3.4) < 0.6 || Math.abs(Math.abs(q.z - 15.5) - 3.4) < 0.6 || Math.abs(Math.abs(a) - 3.2) < 0.6);
        return Math.max(0, q.shade - (edge ? 1 : 0));
      };
      if (kind === 'door') prims.push(box(-5, 5, -0.8, 0.8, 0, cut ? H : top, DOOR, leafMat));
      if (kind === 'open') prims.push(box(-5, -3.8, -10, -0.8, 0, cut ? H : top, DOOR, leafMat));
    }
    if (straightY) prims = prims.map(swapBox);
  }
  // les matières sans rampe renvoient des couleurs ; la rampe sert pour le grain
  prims = prims.map((P) => (P.ramp ? P : { ...P, ramp: SIDING[style.ext] }));
  return renderSolids(prims, 40, 66, 20, 46);
}

// Clôture en piquets blancs, reliée à ses voisines.
export function fenceSprite(mask) {
  const mat = (q) => (q.face === 't' ? 3 : q.shade);
  const prims = [box(-1, 1, -1, 1, 0, 12, PAINTWOOD, mat)];
  const arm = (dir) => {
    const ps = [];
    for (const z of [3, 8.5]) ps.push(box(1, 8, -0.4, 0.4, z, z + 1.4, PAINTWOOD, mat));
    for (const c of [3.5, 6.5]) ps.push(box(c - 0.8, c + 0.8, -0.7, 0.7, 0, 10.5, PAINTWOOD, mat));
    return ps.map((P) => {
      const [u0, u1, v0, v1, z0, z1] = P.b;
      if (dir === N_E) return P;
      if (dir === N_W) return { ...P, b: [-u1, -u0, v0, v1, z0, z1] };
      if (dir === N_S) return { ...P, b: [v0, v1, u0, u1, z0, z1] };
      return { ...P, b: [v0, v1, -u1, -u0, z0, z1] };
    });
  };
  for (const d of [N_W, N_E, N_N, N_S]) if (mask & d) prims.push(...arm(d));
  return renderSolids(prims, 40, 40, 20, 26);
}

// Toit à deux pans, faîtage le long du grand côté, pignon côté caméra, cheminée.
// w, h : taille du bâtiment en tuiles. L'origine (0,0) est le coin haut de la tuile (x0, y0).
export function roofSprite(w, h, style, seed) {
  const alongU = w >= h;
  const L = (alongU ? w : h) * 16, S = (alongU ? h : w) * 16;
  const e = 3; // débord
  const zb = WALL_H, k = 0.62;
  const s0 = 6 - e, s1 = S - 6 + e, l0 = 6 - e, l1 = L - 6 + e;
  const hw = (s1 - s0) / 2, cs = (s0 + s1) / 2, ridge = zb + k * hw;
  const gable = l1 - e + 0.5;
  const roofR = ROOF[style.roof], ext = SIDING[style.ext];
  // rayon dans le repère (l = long, s = court) ; sx est inversé si le faîtage suit v
  const rayL = (sx, sy) => {
    let best = null;
    const tryHit = (s, n, ok) => {
      const l = (s + sx) / 2, c = (s - sx) / 2, z = s / 2 - sy;
      if (ok(l, c, z) && (!best || s > best.s)) best = { s, n };
    };
    // pan côté +s
    tryHit(2 * (zb + k * (hw + cs) + sy + k * sx / 2) / (1 + k), [0, k, 1], (l, c) => l >= l0 && l <= l1 && c >= cs && c <= s1);
    // pan côté -s
    tryHit(2 * (zb + k * (hw - cs) + sy - k * sx / 2) / (1 - k), [0, -k, 1], (l, c) => l >= l0 && l <= l1 && c <= cs && c >= s0);
    // pignon côté caméra
    tryHit(2 * gable - sx, [1, 0, 0], (l, c, z) => c >= s0 + e && c <= s1 - e && z >= zb && z <= zb + k * (hw - Math.abs(c - cs)) - 0.4);
    return best;
  };
  const norm = (n) => { const l = Math.hypot(n[0], n[1], n[2]); return [n[0] / l, n[1] / l, n[2] / l]; };
  const roof = {
    b: alongU ? [l0, l1, s0, s1, zb, ridge] : [s0, s1, l0, l1, zb, ridge],
    ramp: roofR,
    ray(sx, sy) {
      const hit = alongU ? rayL(sx, sy) : rayL(-sx, sy);
      if (!hit) return null;
      const n = norm(hit.n);
      return { s: hit.s, n: alongU ? n : [n[1], n[0], n[2]] };
    },
    mat(q) {
      const l = alongU ? q.u : q.v, c = alongU ? q.v : q.u;
      if (Math.abs(q.n[2]) < 0.3) {
        // pignon : bardage vertical + petite fenêtre de grenier
        if (Math.abs(c - cs) < 3 && Math.abs(q.z - (zb + 8)) < 3) return Math.abs(c - cs) < 0.5 || Math.abs(q.z - zb - 8) < 0.4 ? TRIM[2] : GLASS[1];
        const plank = ((c + 64) % 3) < 0.7;
        return ext[Math.max(0, Math.min(3, q.shade - (plank ? 1 : 0)))];
      }
      const d = Math.abs(c - cs);
      if (d < 1.3) return roofR[Math.min(3, q.shade + 1)]; // faîtière
      if (d > hw - 1.1 || l < l0 + 0.9 || l > l1 - 0.9) return roofR[0]; // rive
      const row = Math.floor((hw - d) / 3);
      const inRow = ((hw - d) % 3);
      if (inRow < 0.7) return roofR[Math.max(0, q.shade - 1)];
      const joint = ((l + row * 2.3 + 64) % 5) < 0.6;
      let s = q.shade - (joint ? 1 : 0);
      if (hash(Math.floor(l / 2), row, seed) < 0.06) s = Math.max(0, s - 1); // bardeau usé
      return roofR[Math.max(0, Math.min(3, s))];
    },
  };
  const prims = [roof];
  // cheminée en brique sur le pan arrière
  const cl = L * 0.3, cc = cs - hw * 0.35;
  const cu = alongU ? cl : cc, cv = alongU ? cc : cl;
  prims.push(box(cu - 3, cu + 3, cv - 3, cv + 3, zb, ridge + 4, BRICK, (q) => {
    if (q.face === 't') return q.z > ridge + 3.5 && Math.abs(q.u - cu) < 1.8 && Math.abs(q.v - cv) < 1.8 ? [20, 14, 12] : 2;
    return ((q.z + 64) % 2.5) < 0.6 ? 0 : q.shade;
  }));
  const W = (w + h) * 16 + 12, Hh = (w + h) * 8 + Math.ceil(ridge) + 16;
  const OX = h * 16 + 6, OY = Math.ceil(ridge) + 10;
  return renderSolids(prims, W, Hh, OX, OY);
}
