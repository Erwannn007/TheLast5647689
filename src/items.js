// Objets : définitions, butin par meuble, recettes (grille 2x2 sans forme), cuisson au feu.
// Une pile = { id, n, d? } ; d = charge (lampe, radio, briquet) ou numéro de texte (lettre, photo).

export const ITEMS = {
  // --- nourriture ---
  haricots: { name: 'Conserve de haricots', desc: 'Il faut de quoi l\'ouvrir.', stack: 8, use: { verb: 'MANGER', hunger: 32, thirst: -4, needs: ['ouvre_boite', 'couteau'], leaves: 'conserve_vide' } },
  soupe: { name: 'Soupe en boîte', desc: 'Légumes. Il faut de quoi l\'ouvrir.', stack: 8, use: { verb: 'MANGER', hunger: 24, thirst: 8, needs: ['ouvre_boite', 'couteau'], leaves: 'conserve_vide' } },
  chips: { name: 'Chips', desc: 'Un peu molles.', stack: 8, use: { verb: 'MANGER', hunger: 12, thirst: -6, moral: 3 } },
  chocolat: { name: 'Barre chocolatée', desc: 'Un petit réconfort.', stack: 8, use: { verb: 'MANGER', hunger: 9, moral: 12 } },
  pomme: { name: 'Pomme', desc: 'Ridée, mais bonne.', stack: 12, use: { verb: 'MANGER', hunger: 10, thirst: 4 } },
  pain: { name: 'Pain rassis', desc: 'Dur comme du bois.', stack: 4, use: { verb: 'MANGER', hunger: 20, thirst: -5 } },
  cereales: { name: 'Céréales', desc: 'Sans lait.', stack: 4, use: { verb: 'MANGER', hunger: 16, thirst: -3, moral: 2 } },
  biscuits: { name: 'Biscuits', desc: 'Un paquet entamé.', stack: 8, use: { verb: 'MANGER', hunger: 12, moral: 4 } },
  poisson: { name: 'Poisson cru', desc: 'À cuire au feu.', stack: 6, use: { verb: 'MANGER', hunger: 12, sick: 0.6 }, cook: 'poisson_cuit' },
  poisson_cuit: { name: 'Poisson grillé', desc: 'Chaud. Ça sent bon.', stack: 6, use: { verb: 'MANGER', hunger: 34, moral: 8 } },
  baies: { name: 'Mûres', desc: 'Cueillies sur les ronces.', stack: 24, use: { verb: 'MANGER', hunger: 4, thirst: 2, moral: 1 } },
  // --- boissons ---
  eau: { name: 'Bouteille d\'eau', desc: 'Claire et propre.', stack: 1, use: { verb: 'BOIRE', thirst: 45, leaves: 'bouteille' } },
  eau_sale: { name: 'Eau croupie', desc: 'À faire bouillir au feu.', stack: 1, use: { verb: 'BOIRE', thirst: 40, sick: 0.5, leaves: 'bouteille' }, cook: 'eau' },
  bouteille: { name: 'Bouteille vide', desc: 'Se remplit à une pompe ou à l\'étang.', stack: 4 },
  soda: { name: 'Soda', desc: 'Éventé, tiède. Parfait.', stack: 8, use: { verb: 'BOIRE', thirst: 25, moral: 6, hunger: 2 } },
  // --- soins ---
  bandage: { name: 'Bandage', desc: 'Arrête un saignement.', stack: 8, use: { verb: 'SOIGNER', health: 8, stopBleed: true } },
  chiffon: { name: 'Chiffon', desc: 'Peut servir de pansement.', stack: 12, use: { verb: 'SOIGNER', stopBleed: 0.6 }, fuel: 5 },
  comprimes: { name: 'Comprimés', desc: 'Contre la fièvre et la douleur.', stack: 10, use: { verb: 'AVALER', health: 6, cure: true, moral: 2 } },
  // --- outils ---
  hache: { name: 'Hache', desc: 'Pour abattre les arbres.', stack: 1, tool: true },
  couteau: { name: 'Couteau', desc: 'Ouvre les boîtes, coupe le tissu.', stack: 1, tool: true },
  ouvre_boite: { name: 'Ouvre-boîte', desc: 'Indispensable.', stack: 1, tool: true },
  pied_de_biche: { name: 'Pied-de-biche', desc: 'Force les portes fermées.', stack: 1, tool: true },
  lampe: { name: 'Lampe torche', desc: 'Éclaire la nuit quand on la tient.', stack: 1, tool: true, charge: 100 },
  piles: { name: 'Piles', desc: 'Pour la lampe ou la radio.', stack: 8 },
  allumettes: { name: 'Allumettes', desc: 'Allume un feu.', stack: 1, charge: 10 },
  briquet: { name: 'Briquet', desc: 'Allume un feu.', stack: 1, charge: 30 },
  canne: { name: 'Canne à pêche', desc: 'Tenez-la face à l\'eau.', stack: 1, tool: true },
  radio: { name: 'Radio', desc: 'Peut-être que quelqu\'un parle encore.', stack: 1, charge: 100, use: { verb: 'ÉCOUTER' } },
  // --- matériaux ---
  buche: { name: 'Bûche', desc: 'Brûle longtemps.', stack: 16, fuel: 90 },
  branche: { name: 'Branche', desc: 'Petit bois.', stack: 24, fuel: 25 },
  drap: { name: 'Drap', desc: 'Se découpe en chiffons.', stack: 4, fuel: 15 },
  journal: { name: 'Vieux journal', desc: 'Daté du dernier jour.', stack: 8, fuel: 8, use: { verb: 'LIRE', text: 'journal' } },
  livre: { name: 'Livre', desc: 'Un roman corné.', stack: 1, fuel: 20, use: { verb: 'LIRE', time: 40, moral: 22 } },
  note: { name: 'Lettre', desc: 'Quelqu\'un l\'a laissée là.', stack: 1, use: { verb: 'LIRE', text: 'note' } },
  photo: { name: 'Photo', desc: 'Des gens que vous ne connaîtrez jamais.', stack: 1, use: { verb: 'REGARDER', text: 'photo' } },
  ficelle: { name: 'Ficelle', desc: 'Solide.', stack: 8 },
  kit_feu: { name: 'Feu de camp', desc: 'À poser dehors.', stack: 4, use: { verb: 'POSER', place: 'campfire' } },
  conserve_vide: { name: 'Boîte vide', desc: 'Rien à en tirer.', stack: 8 },
};
for (const k in ITEMS) ITEMS[k].id = k;

export const isFood = (id) => ITEMS[id]?.use?.hunger > 0;

export function makeStack(id, n = 1, rnd = Math.random) {
  const def = ITEMS[id];
  const s = { id, n: Math.min(n, def.stack) };
  if (def.charge) s.d = Math.round(def.charge * (0.3 + rnd() * 0.7));
  if (id === 'note') s.d = (rnd() * NOTES.length) | 0;
  if (id === 'photo') s.d = (rnd() * PHOTOS.length) | 0;
  if (id === 'journal') s.d = (rnd() * JOURNALS.length) | 0;
  return s;
}

// Butin : [id, poids, quantité max]
export const LOOT = {
  fridge: { rolls: [1, 4], table: [['soda', 5, 3], ['pomme', 4, 4], ['eau', 4, 1], ['chocolat', 2, 2], ['pain', 2, 1]] },
  counter: { rolls: [0, 3], table: [['haricots', 6, 2], ['soupe', 5, 2], ['chips', 4, 1], ['cereales', 4, 1], ['biscuits', 4, 1], ['ouvre_boite', 2, 1], ['couteau', 2, 1], ['allumettes', 3, 1], ['bouteille', 3, 1], ['eau', 2, 1]] },
  sink: { rolls: [0, 2], table: [['chiffon', 5, 2], ['bouteille', 3, 1], ['comprimes', 1, 2], ['allumettes', 1, 1]] },
  stove: { rolls: [0, 1], table: [['allumettes', 3, 1], ['conserve_vide', 2, 1], ['haricots', 2, 1]] },
  wardrobe: { rolls: [1, 3], table: [['drap', 6, 2], ['chiffon', 3, 2], ['lampe', 2, 1], ['piles', 2, 2], ['photo', 2, 1], ['ficelle', 2, 1], ['radio', 1, 1]] },
  dresser: { rolls: [0, 3], table: [['note', 3, 1], ['photo', 4, 1], ['piles', 3, 2], ['briquet', 2, 1], ['comprimes', 2, 2], ['chocolat', 2, 1], ['livre', 2, 1], ['ficelle', 1, 1]] },
  bookshelf: { rolls: [1, 3], table: [['livre', 6, 1], ['journal', 3, 2], ['note', 2, 1], ['photo', 1, 1]] },
  bathsink: { rolls: [0, 3], table: [['bandage', 4, 2], ['comprimes', 4, 2], ['chiffon', 3, 2]] },
  tv: { rolls: [0, 1], table: [['piles', 1, 2], ['journal', 1, 1]] },
  shelf: { rolls: [1, 5], table: [['haricots', 6, 3], ['soupe', 5, 3], ['chips', 5, 2], ['soda', 5, 3], ['eau', 5, 2], ['biscuits', 4, 2], ['cereales', 3, 2], ['chocolat', 4, 3], ['piles', 2, 2], ['allumettes', 2, 1], ['bandage', 1, 2]] },
  crate: { rolls: [1, 3], table: [['buche', 4, 3], ['ficelle', 3, 2], ['hache', 2, 1], ['pied_de_biche', 2, 1], ['canne', 2, 1], ['piles', 2, 2], ['bouteille', 2, 1]] },
  trash: { rolls: [0, 2], table: [['journal', 4, 2], ['bouteille', 3, 1], ['conserve_vide', 4, 1], ['chiffon', 2, 1], ['chips', 1, 1]] },
  mailbox: { rolls: [0, 2], table: [['note', 4, 1], ['journal', 4, 1], ['photo', 2, 1]] },
  car: { rolls: [0, 4], table: [['eau', 4, 1], ['lampe', 2, 1], ['pied_de_biche', 2, 1], ['briquet', 2, 1], ['chips', 3, 1], ['soda', 3, 1], ['drap', 2, 1], ['note', 2, 1], ['radio', 1, 1], ['bandage', 2, 1]] },
};

export function rollLoot(kind, rnd, size) {
  const L = LOOT[kind];
  const slots = new Array(size).fill(null);
  if (!L) return slots;
  const total = L.table.reduce((a, t) => a + t[1], 0);
  const n = L.rolls[0] + Math.floor(rnd() * (L.rolls[1] - L.rolls[0] + 1));
  for (let i = 0; i < n; i++) {
    let r = rnd() * total, pick = L.table[0];
    for (const t of L.table) { r -= t[1]; if (r <= 0) { pick = t; break; } }
    const s = makeStack(pick[0], 1 + Math.floor(rnd() * pick[2]), rnd);
    let at = Math.floor(rnd() * size);
    for (let k = 0; k < size && slots[at]; k++) at = (at + 1) % size;
    if (!slots[at]) slots[at] = s;
  }
  return slots;
}

// Recettes de la grille 2x2 : ingrédients sans forme, outils gardés.
export const RECIPES = [
  { in: { drap: 1 }, tools: ['couteau'], out: ['chiffon', 3] },
  { in: { chiffon: 2 }, out: ['bandage', 1] },
  { in: { buche: 2, branche: 2 }, out: ['kit_feu', 1] },
  { in: { buche: 1 }, tools: ['hache'], out: ['branche', 4] },
  { in: { branche: 1, ficelle: 1 }, out: ['canne', 1] },
  { in: { lampe: 1, piles: 1 }, out: ['lampe', 1], recharge: true },
  { in: { radio: 1, piles: 1 }, out: ['radio', 1], recharge: true },
];

// grid : 4 cases (pile ou null). Renvoie la recette et la pile produite, ou null.
export function matchRecipe(grid) {
  const have = {};
  for (const s of grid) if (s) have[s.id] = (have[s.id] || 0) + 1;
  for (const r of RECIPES) {
    const need = { ...r.in };
    for (const t of r.tools || []) need[t] = (need[t] || 0) + 1;
    const keys = Object.keys(have);
    if (keys.length !== Object.keys(need).length) continue;
    if (keys.every((k) => need[k] && have[k] === need[k])) {
      const out = makeStack(r.out[0], r.out[1]);
      if (r.recharge) out.d = 100;
      return { recipe: r, out };
    }
  }
  return null;
}

export const COOK_TIME = 12; // minutes de jeu au feu

// --- textes : lettres, photos, journaux, radio ---
export const NOTES = [
  'Maman, on part avec les bus de la mairie. Ils disent que c\'est pour trois jours. J\'ai laissé la clé sous le pot. — Léa',
  'Pour Thomas : le chat est chez les voisins. Si tu reviens avant nous, donne-lui à manger. Il aime le thon.',
  'Liste : piles, eau, pain, médicaments de papa. Ne pas oublier les photos de l\'album bleu.',
  'Je reste. Je n\'ai pas envie de partir pour aller nulle part. Le jardin a besoin de moi.',
  'Les bus ne sont pas revenus. On attendra demain matin au carrefour.',
  'Cher voisin, merci pour les tomates de l\'été. Je vous rends le panier. On se revoit à la rentrée.',
  'Si quelqu\'un lit ça : la pompe du parc donne encore de l\'eau propre.',
  'J\'ai rêvé que la ville était pleine de bruit. Je me suis réveillé et j\'ai pleuré de soulagement en entendant la pluie.',
  'Anniversaire de Jules samedi. Ballons, bougies, le gâteau au chocolat de mamie. 7 ans déjà.',
  'On a éteint la lumière du porche pour la dernière fois. C\'est bête, j\'ai hésité longtemps.',
  'Rendez-vous au lac, au bout de la route du nord. Si tu trouves cette lettre, c\'est que tu es venu.',
  'Il n\'y a plus de bruit d\'avions. Le ciel n\'a jamais été aussi propre.',
];
export const PHOTOS = [
  'Une famille sourit devant un lac. Un enfant tient un poisson minuscule.',
  'Un vieux chien endormi sous un sapin de Noël.',
  'Deux amoureux sur un banc. Au dos : « Été 89, le dernier avant tout ».',
  'Une classe d\'école, trente visages flous. Une croix au stylo au-dessus d\'une tête.',
  'Une maison en construction. Au dos : « Notre maison ! »',
  'Un homme rit, la bouche pleine de gâteau. Il a de la crème sur le nez.',
];
export const JOURNALS = [
  '« DÉPART ORGANISÉ : LES HABITANTS INVITÉS À SE PRÉSENTER AUX POINTS DE RASSEMBLEMENT »',
  '« LA FÊTE DU VILLAGE REPORTÉE À UNE DATE ULTÉRIEURE »',
  '« MÉTÉO : BEAU TEMPS DURABLE SUR LA RÉGION. QUELQUES AVERSES EN FIN DE SEMAINE »',
  '« LE MAIRE : IL N\'Y A AUCUNE RAISON DE S\'INQUIÉTER »',
  '« PETITES ANNONCES : VENDS VÉLO ROUGE, BON ÉTAT. DONNE CHATONS. »',
];
export const BROADCASTS = [
  '... grésillements ...',
  '« ...ici la station du lac. Nous sommes quelques-uns. Nous allumons un feu chaque soir... »',
  '« ...diffusion automatique. Restez chez vous. Restez chez vous. Restez chez... »',
  '... une musique lointaine, un piano, puis plus rien ...',
  '« ...si vous m\'entendez, je m\'appelle Marc. Je suis seul aussi. Ça fait du bien de le dire... »',
  '... grésillements. Une voix, peut-être. Le vent ...',
  '« ...bulletin météo : nuages, puis éclaircies. Il fera doux ce soir... »',
  '« ...Marc encore. J\'ai planté des tomates. C\'est idiot, non ? Bonne nuit, qui que vous soyez... »',
];
