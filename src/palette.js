// Toutes les rampes de 4 tons (ombre -> lumière) du jeu.
// Base : les palettes du guide (docs/spritedesign-rules.md), décalées vers une fin d'été / début
// d'automne un peu passée : verts jaunis, feuilles rousses, peintures délavées.
import { ramp, hex } from './raster.js';

// --- sols ---
export const GROUND = {
  grass: ramp('#4a6b34', '#5c7f3c', '#73954a', '#8fad5c'),
  dry: ramp('#6b6234', '#827840', '#9a8f4e', '#b5a965'),
  forest: ramp('#33472a', '#405630', '#52693a', '#6a8247'),
  dirt: ramp('#4f3220', '#664330', '#7d5638', '#946a44'),
  path: ramp('#6e5236', '#876546', '#9e7b55', '#b5926a'),
  asphalt: ramp('#26282e', '#33363d', '#41454d', '#545962'),
  sidewalk: ramp('#5f5e5a', '#77756e', '#8e8b82', '#a8a497'),
  plank: ramp('#4a3020', '#694630', '#855c3e', '#a0764f'),
  lino: ramp('#6e6a5e', '#9a9484', '#b8b2a0', '#d4cdb8'),
  tiles: ramp('#4e5a5e', '#6e7c80', '#909ea0', '#b4c0c0'),
  carpet: ramp('#3e2a30', '#5a3a40', '#73504f', '#8c6862'),
  sand: ramp('#a8925c', '#bfa86c', '#d1bc80', '#e2d09a'),
  water: ramp('#1b3e52', '#255268', '#356c80', '#78a8b6'),
  field: ramp('#3e2a1a', '#563a24', '#6e4c30', '#86603e'), // terre labourée
  roof: ramp('#2a2a2c', '#38383a', '#484746', '#5c5a56'), // toit-terrasse gravillonné
  cobble: ramp('#5a554e', '#787166', '#958c7e', '#b4aa98'),
  gravel: ramp('#58544e', '#706a60', '#888276', '#a29a8c'),
  office: ramp('#2c323e', '#3a4252', '#4a5466', '#5e6a7e'), // moquette de bureau
  concrete: ramp('#4a4a48', '#5e5e5a', '#72716c', '#888680'),
  deep: ramp('#142f42', '#1b3d54', '#28526a', '#5c8ea2'),
};
export const ROAD_PAINT = ramp('#6e6338', '#988848', '#b9a658', '#cfbd70'); // jaune passé
export const ROAD_WHITE = ramp('#6e706e', '#8f918c', '#a9aaa4', '#c2c2ba');

// --- nature ---
export const BARK = ramp('#2e1c10', '#553620', '#7a5233', '#9a6d45');
export const BIRCH = ramp('#55565a', '#9a9a94', '#c8c6bc', '#e6e2d4');
export const LEAVES = {
  green: ramp('#24402a', '#355a32', '#4f7a3c', '#739a50'),
  olive: ramp('#36401c', '#4f5c24', '#6e7a30', '#949c44'),
  yellow: ramp('#5a4214', '#8a6a1c', '#bb9330', '#e0bc58'),
  orange: ramp('#552410', '#873e16', '#b9602a', '#dd9048'),
  red: ramp('#461418', '#722226', '#9e362e', '#c45a44'),
};
export const PINE = ramp('#123327', '#1c4c35', '#2a6843', '#448a52');
export const CONE = hex('#5a3a1e');
export const BUSH = ramp('#1f3d22', '#2e5a2e', '#45783a', '#679a4c');
export const ROCK = ramp('#34373f', '#5a5f6b', '#838894', '#b1b6bf');
export const MOSS = ramp('#2b4a23', '#3f6b2e', '#5d8e3c', '#86b356');
export const TALLGRASS = ramp('#3f5a2a', '#587436', '#738e42', '#94a858');
export const REED = ramp('#3a4a24', '#566a30', '#78883c', '#a0a456');
export const BERRY = ramp('#2a0c1e', '#4e1430', '#7a2042', '#a8405e');

// --- construit ---
export const SIDING = [
  ramp('#2c3a4e', '#48607a', '#6a86a0', '#93abc0'), // bleu délavé
  ramp('#6e6450', '#9c8f72', '#c4b796', '#e3d8ba'), // crème
  ramp('#36422f', '#56664c', '#76896a', '#9cae8e'), // sauge
  ramp('#55595f', '#83898f', '#aeb3b6', '#d4d6d4'), // blanc sale
  ramp('#4a2420', '#74382e', '#985044', '#b87262'), // rouge poussiéreux
  ramp('#5a2418', '#84392a', '#a8513a', '#c46e52'), // 5 brique
  ramp('#4c4c4a', '#6c6b66', '#8c8a83', '#aeaba2'), // 6 béton
  ramp('#1c2432', '#2a3850', '#3c506c', '#6884a6'), // 7 mur-rideau vitré
  ramp('#4a1410', '#7a2318', '#a3362a', '#c45a44'), // 8 planches de grange
  ramp('#363a40', '#50555d', '#6e747e', '#90979f'), // 9 tôle ondulée
];
export const CROPS = ramp('#4e4a22', '#6e6a30', '#8e863e', '#ada252'); // tiges sèches
export const DEER = ramp('#36200e', '#5e3c1e', '#86582e', '#a87a48');
export const RABBIT = ramp('#3a3430', '#5e554c', '#837868', '#a89a86');
export const ANTLER = ramp('#5a4a36', '#86745a', '#ad9a7c', '#d2c2a2');
export const STRAW = ramp('#6e5420', '#a3812f', '#cfa94a', '#ead37a');
export const CARDBOARD = ramp('#5a4026', '#7e5c38', '#9e7a4c', '#bc9a66');
export const WALLPAPER = [
  ramp('#5e4c3c', '#86705a', '#a88f74', '#c4ad8e'),
  ramp('#4a5442', '#6a765c', '#8a9678', '#aab494'),
  ramp('#5a4650', '#7e6672', '#9c8490', '#b8a2aa'),
];
export const ROOF = [
  ramp('#26232a', '#38333a', '#4e474c', '#686064'), // bardeaux gris
  ramp('#2e1a10', '#4a2c1a', '#6b4226', '#8c5a36'), // bardeaux bruns
  ramp('#4a1a14', '#6e2a1e', '#8f3e2a', '#b0583e'), // tuiles éteintes
  ramp('#252b38', '#3a4558', '#526079', '#7083a0'), // ardoise
];
export const TRIM = ramp('#6a6a64', '#a4a49a', '#cfcfc4', '#ecebe0');
export const WOOD = ramp('#3d2614', '#5e3d22', '#86593a', '#a87a52');
export const DARKWOOD = ramp('#24160c', '#3b2414', '#5a3a20', '#7a5233');
export const PAINTWOOD = ramp('#5a5a54', '#8a8a80', '#b2b2a6', '#d6d6ca');
export const DOOR = ramp('#24160c', '#3b2414', '#5a3a20', '#7a5233');
export const INTERIOR = ramp('#0c0806', '#17100b', '#221810', '#2e2116');
export const METAL = ramp('#23262e', '#3a3f4a', '#5a606e', '#8a91a0');
export const STEEL = ramp('#2a2e36', '#5a606e', '#9aa2b2', '#dfe5ee');
export const RUST = ramp('#3a1c10', '#5e2e18', '#86482a', '#a8683e');
export const ENAMEL = ramp('#6e706c', '#a6a8a2', '#d0d0c8', '#efeee6'); // électroménager
export const CREAM = ramp('#9c917a', '#cfc4a8', '#ece2c8', '#fffaea');
export const GLASS = [hex('#1b2438'), hex('#2b3a58'), hex('#3c5072'), hex('#9fb6d8')];
export const BRICK = ramp('#5a2418', '#84392a', '#a8513a', '#c46e52');
export const CONCRETE = ramp('#4a4a48', '#6a6964', '#8a8880', '#aaa79c');
export const FABRIC = {
  red: ramp('#4a1018', '#78202a', '#9c3a3c', '#bc5e56'),
  green: ramp('#1e3424', '#2e4e36', '#46684a', '#668a62'),
  blue: ramp('#1c2840', '#2c3e60', '#44587e', '#64789c'),
  brown: ramp('#3a2418', '#5a3a26', '#7a5434', '#9a7048'),
  beige: ramp('#6e5124', '#a9853f', '#d4b062', '#efd08a'),
  white: ramp('#7a7c80', '#a8aaac', '#cfd0cc', '#eeeee6'),
};
export const CARPAINT = [
  ramp('#3a1414', '#5e2020', '#843030', '#a84a44'),
  ramp('#1e2a3a', '#2e4058', '#465a78', '#64789a'),
  ramp('#4a4a30', '#6e6a44', '#908a58', '#b0a874'),
  ramp('#3c4044', '#5c6266', '#80868a', '#a6aaac'),
  ramp('#2a3a2e', '#3e5444', '#567060', '#78907e'),
];
export const TIRE = ramp('#121214', '#1c1c20', '#2a2a30', '#3c3c44');

// --- personnage ---
export const SKIN = ramp('#5e3422', '#93573c', '#c08060', '#dca582');
export const HAIR = ramp('#1e1410', '#33221a', '#4a3226', '#634633');
export const JACKET = ramp('#26301e', '#3a4628', '#556236', '#728048'); // parka kaki
export const JEANS = ramp('#1a2232', '#283650', '#3a4c6e', '#56688a');
export const BOOTS = ramp('#1e140e', '#2e2016', '#44301e', '#5c4228');
export const BEANIE = ramp('#4a1a18', '#6e2a24', '#913e32', '#b05a46');
export const PACK = ramp('#2a2018', '#43342a', '#5e4a3a', '#7a644e');

// --- effets ---
export const FIRE = ['#c8281e', '#ff5a2a', '#ff9a3c', '#ffd23f', '#fff3b0'].map(hex);
export const SMOKE = ['#34343a', '#4a4a50', '#62626a'].map(hex);
export const SHADOW = [10, 20, 18];
export const BLOOD = ramp('#3e060c', '#6e0e18', '#a01824', '#d02c36');
