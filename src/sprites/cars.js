// Voitures abandonnées : une coque extrudée depuis un profil latéral (capot, pare-brise incliné,
// toit, lunette, coffre), passages de roues creusés, vraies roues à axe horizontal, puis les détails
// par la matière : vitres et montants, phares, feux, calandre, pare-chocs, portières, poussière, rouille.
// À l'échelle du personnage (~32 unités = 1,80 m) : une berline fait 4 cases sur 2.
import { hash, ramp } from '../raster.js';
import { box, rotPrims, renderSolids } from '../solids.js';
import { CARPAINT, GLASS, METAL, STEEL, TIRE, CREAM, RUST, INTERIOR } from '../palette.js';

export const PAINTS = [
  ...CARPAINT,
  ramp('#6a6c6a', '#a2a49e', '#cacbc4', '#e8e8e0'), // blanc cassé
  ramp('#141418', '#22232a', '#34363e', '#4c4f58'), // noir
  ramp('#5a4a34', '#84704e', '#a89270', '#c8b494'), // beige
  ramp('#2a3a4a', '#40586e', '#5c7890', '#7e9ab0'), // bleu ciel passé
  ramp('#5a3a10', '#86601c', '#ae8430', '#cca850'), // moutarde
];
const TAIL = ramp('#3a0808', '#6e1414', '#a82424', '#e05a4a');
const LAMP = [CREAM[1], CREAM[2], CREAM[3], [255, 255, 240]];
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

// Les cinq carrosseries (u : de l'arrière à l'avant, nez vers +u ; z : hauteur)
export const BODIES = [
  { name: 'berline', L: 29, hw: 11.5, belt: 13.6, axles: [-18.5, 18.5], wr: 5,
    prof: [[-29, 9.5], [-28.6, 12.6], [-20, 13.6], [-12.5, 22], [5, 23], [14, 14.6], [27.6, 12.6], [29, 9.6]],
    win: [-11.6, 12.4], pillars: [0.5], seams: [-12.6, 0.5, 13.4] },
  { name: 'break', L: 29, hw: 11.5, belt: 13.6, axles: [-18.5, 18.5], wr: 5,
    prof: [[-29, 9.5], [-28.7, 21.6], [-27, 22.6], [5, 23], [14, 14.6], [27.6, 12.6], [29, 9.6]],
    win: [-26, 12.4], pillars: [0.5, -13.5], seams: [-13.5, 0.5, 13.4] },
  { name: 'compacte', L: 25, hw: 11, belt: 13.4, axles: [-16, 16], wr: 4.8,
    prof: [[-25, 9.5], [-24.6, 20.8], [-22.6, 22], [3, 22.6], [11, 14.2], [23.6, 12.6], [25, 9.6]],
    win: [-21, 9.8], pillars: [-6.5], seams: [-7, 10.5] },
  { name: 'pickup', L: 29, hw: 11.8, belt: 14.6, axles: [-18, 19], wr: 5.4, bed: [-28, -3.6, 10.4],
    prof: [[-29, 15.6], [-3.2, 15.6], [-3, 24], [7, 24], [14, 15.6], [27.6, 13.8], [29, 10.4]],
    win: [-2.2, 12.6], pillars: [], seams: [-1.8, 13.6] },
  { name: 'fourgon', L: 29, hw: 12, belt: 15.6, axles: [-18, 19.5], wr: 5.2,
    prof: [[-29, 9.8], [-28.8, 27.4], [-27.6, 28.2], [12, 28.2], [18, 18.4], [27.6, 15.2], [29, 10]],
    win: [6.5, 17], pillars: [], seams: [6, 18, -9, -22] },
];

// Coque : un profil latéral extrudé sur la largeur, flancs qui rentrent au-dessus de la ceinture,
// coins arrondis en plan, passages de roues et benne éventuellement creusés.
function hull(B, cu, cv) {
  const P = B.prof, u0 = cu - B.L, u1 = cu + B.L, z0 = 2.6;
  const top = (u) => {
    const x = u - cu;
    for (let i = 0; i < P.length - 1; i++) if (x <= P[i + 1][0]) {
      const t = (x - P[i][0]) / (P[i + 1][0] - P[i][0] || 1);
      return [P[i][1] + (P[i + 1][1] - P[i][1]) * t, (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0] || 1)];
    }
    return [P[P.length - 1][1], 0];
  };
  const bedOK = (u) => !B.bed || u - cu > B.bed[1] + 0.4;
  const half = (u, z) => {
    const d = Math.min(u - u0, u1 - u);
    let hw = B.hw - (d < 3 ? (3 - d) * (3 - d) * 0.22 : 0);
    if (z > B.belt && bedOK(u)) hw -= (z - B.belt) * 0.32;
    return hw;
  };
  const inArch = (u, v, z) => {
    for (const a of B.axles) {
      const du = u - cu - a, dz = z - B.wr;
      if (du * du + dz * dz < (B.wr + 0.9) ** 2 && Math.abs(v - cv) > B.hw - 4.4) return true;
    }
    return false;
  };
  const inBed = (u, v, z) => B.bed && u - cu > B.bed[0] && u - cu < B.bed[1] && Math.abs(v - cv) < B.hw - 1 && z > B.bed[2];
  return {
    b: [u0, u1, cv - B.hw, cv + B.hw, z0, Math.max(...P.map((p) => p[1]))],
    top, half,
    inside(u, v, z) {
      if (u < u0 || u > u1 || z < z0) return false;
      if (z > top(u)[0]) return false;
      if (Math.abs(v - cv) > half(u, z)) return false;
      return !inArch(u, v, z) && !inBed(u, v, z);
    },
    normal(u, v, z) {
      const [t, slope] = top(u);
      const hw = half(u, z), d = Math.min(u - u0, u1 - u);
      const terms = [
        [z - t, () => nrm(-slope, 0, 1)],
        [Math.abs(v - cv) - hw, () => nrm(d < 3 ? (u - cu > 0 ? 1 : -1) * (3 - d) * 0.44 : 0, Math.sign(v - cv) || 1, z > B.belt && bedOK(u) ? 0.32 : 0)],
        [u - u1, () => [1, 0, 0]], [u0 - u, () => [-1, 0, 0]], [z0 - z, () => [0, 0, -1]],
      ];
      if (B.bed && u - cu > B.bed[0] - 1 && u - cu < B.bed[1] + 1 && Math.abs(v - cv) < B.hw) {
        terms.push([B.bed[2] - z + 0.3, () => [0, 0, 1]]); // fond de benne
      }
      let best = terms[0];
      for (const tm of terms) if (tm[0] > best[0]) best = tm;
      return best[1]();
    },
  };
}

// Roue : cylindre d'axe horizontal (le long de v), pneu et enjoliveur ; un pneu crevé s'écrase.
function wheel(wu, vc, r, halfw, flat) {
  const rz = flat ? r * 0.72 : r, wz = flat ? rz : r;
  return {
    b: [wu - r, wu + r, vc - halfw, vc + halfw, 0, wz + rz], ramp: TIRE, smooth: true,
    inside(u, v, z) { const a = (u - wu) / r, c = (z - wz) / rz; return a * a + c * c <= 1 && Math.abs(v - vc) <= halfw; },
    normal(u, v, z) {
      if (Math.abs(v - vc) > halfw - 0.35) return [0, Math.sign(v - vc), 0];
      return nrm((u - wu) / r, 0, (z - wz) / rz);
    },
    mat(q) {
      if (Math.abs(q.n[1]) > 0.7) {
        const d = Math.hypot((q.u - wu) / r, (q.z - wz) / rz);
        if (d < 0.5) return d < 0.15 ? METAL[1] : STEEL[Math.min(3, q.shade + 1)]; // jante
        return d < 0.62 ? TIRE[0] : TIRE[Math.min(3, q.shade)];
      }
      return TIRE[q.shade];
    },
  };
}

export function carPrims(v) {
  const B = BODIES[v % BODIES.length];
  const paint = PAINTS[Math.floor(v / BODIES.length) % PAINTS.length];
  const seed = v * 131 + 7;
  const dusty = 0.03 + hash(v, 1, 3) * 0.07, rusty = hash(v, 2, 3) < 0.35;
  const flat = hash(v, 3, 3) < 0.3 ? (hash(v, 4, 3) * 4) | 0 : -1;
  const broken = hash(v, 5, 3) < 0.25;
  const cu = 24, cv = 8; // centre de la voiture : 4 cases le long de +u, 2 le long de +v
  const H = hull(B, cu, cv);
  const glassAt = (q) => {
    const x = q.u - cu, [t, slope] = H.top(q.u), side = Math.abs(q.n[1]) > 0.6;
    if (q.z <= B.belt + 0.6 || q.z > t - 0.7) return false;
    if (side) {
      if (x < B.win[0] || x > B.win[1]) return false;
      for (const p of B.pillars) if (Math.abs(x - p) < 0.8) return false;
      return true;
    }
    return Math.abs(slope) > 0.45 && Math.abs(q.v - cv) < H.half(q.u, q.z) - 1.1;
  };
  H.ramp = paint;
  H.mat = (q) => {
    const x = q.u - cu, w = Math.abs(q.v - cv), n = q.n;
    const h = hash(q.x, q.y, seed);
    // vitres : reflet en biais, éclats si cassées
    if (glassAt(q)) {
      if (broken && x > 0 && ((q.x * 3 + q.y * 5) % 7 === 0 || h < 0.2)) return h < 0.1 ? GLASS[3] : INTERIOR[1]; // fêlures
      const refl = ((x + q.z * 0.9 + 64) % 10);
      return refl < 1.3 ? GLASS[3] : refl < 2.2 ? GLASS[2] : GLASS[q.z > B.belt + 4 ? 1 : 0];
    }
    if (n[0] > 0.7) {
      // face avant : phares, calandre, pare-chocs
      if (q.z < 6.2) return h < 0.08 ? METAL[0] : METAL[q.shade > 1 ? 2 : 1];
      if (q.z > 8 && q.z < 10.4 && w > B.hw - 4.6 && w < B.hw - 1.2) return LAMP[Math.min(3, q.shade + 1)];
      if (q.z > 6.6 && q.z < 9.8 && w < B.hw - 5.2) return ((q.z * 2) | 0) % 2 ? METAL[0] : METAL[1];
    }
    if (n[0] < -0.7) {
      // arrière : feux rouges, plaque, pare-chocs
      if (q.z < 6.2) return METAL[q.shade > 1 ? 2 : 1];
      if (q.z > 8.4 && q.z < 11 && w > B.hw - 4 && w < B.hw - 0.8) return TAIL[Math.min(3, q.shade + 1)];
      if (q.z > 6.8 && q.z < 8.6 && w < 2.6) return CREAM[2];
    }
    let s = q.shade;
    if (Math.abs(n[1]) > 0.6) {
      // flancs : bas de caisse, baguette, portières, poignées
      if (q.z < 4.6) return paint[Math.max(0, s - 1)];
      if (Math.abs(q.z - (B.belt - 4)) < 0.35) return STEEL[Math.min(3, s)];
      for (const sm of B.seams) {
        if (Math.abs(x - sm) < 0.4 && q.z > 4.6 && q.z < H.top(q.u)[0] - 0.6) return paint[0];
        if (x > sm - 3.2 && x < sm - 1.6 && Math.abs(q.z - (B.belt - 1.6)) < 0.5 && sm > B.win[0]) return STEEL[2];
      }
      if (x > B.win[1] - 0.6 && x < B.win[1] + 1.4 && Math.abs(q.z - B.belt - 1) < 1) return METAL[1]; // rétroviseur
    }
    // poussière et rouille, plus marquées en bas
    if (rusty && q.z < 8 && hash(q.x >> 1, q.y >> 1, seed + 2) < 0.18) return RUST[Math.min(3, s)];
    if (h < dusty * (q.z < 7 ? 2.5 : 1)) s--;
    else if (h > 0.97) s++;
    return paint[Math.max(0, Math.min(3, s))];
  };
  H.smooth = true;
  const prims = [H];
  B.axles.forEach((a, i) => {
    for (const side of [-1, 1]) prims.push(wheel(cu + a, cv + side * (B.hw - 2.3), B.wr, 1.8, flat === i * 2 + (side > 0 ? 1 : 0)));
  });
  // rétroviseurs
  for (const side of [-1, 1]) prims.push({ ...box(cu + B.win[1] - 0.4, cu + B.win[1] + 1.2, cv + side * (B.hw + 0.2) - 0.9, cv + side * (B.hw + 0.2) + 0.9, B.belt + 0.2, B.belt + 2, paint), smooth: true });
  return prims;
}

export function carSprite(v, k) {
  return renderSolids(rotPrims(carPrims(v), k), 176, 128, 88, 78);
}
