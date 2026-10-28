// Démarrage : écran, cuisson des sprites, écran titre, boucle de jeu.
import { ctx, view, resize, drawText, textWidth } from './gfx.js';
import { bakeBase } from './bank.js';
import { G, newPlayer, hour } from './state.js';
import { generate } from './world.js';
import { update, newGame, hasSave, load, save, inBuilding, litFires } from './game.js';
import { renderWorld } from './render.js';
import { drawHUD, drawOverlay, drawTitle, drawDeath, bindInput, input, setOnStart } from './ui.js';
import { setEnv, setMuted } from './audio.js';

resize();
window.addEventListener('resize', resize);
ctx.fillStyle = '#0e0c10';
ctx.fillRect(0, 0, view.W, view.H);
drawText('...', (view.W - textWidth('...')) >> 1, view.H >> 1, '#8a8070', null);

let saved = false;
window.__G = G; // pour déboguer depuis la console
setTimeout(() => {
  bakeBase();
  try { G.muted = localStorage.getItem('thelast-muted') === '1'; } catch (e) { /* rien */ }
  setMuted(G.muted);
  saved = hasSave() && load();
  if (saved) G.mode = 'title';
  else {
    G.seed = (Math.random() * 1e9) | 0;
    G.world = generate(G.seed);
    G.p = newPlayer(G.world.start[0], G.world.start[1]);
  }
  bindInput();
  setOnStart(() => {
    if (saved) { G.mode = 'play'; G.ui = null; }
    else newGame(true);
  });
  requestAnimationFrame(loop);
}, 30);

let last = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0);
  last = t;
  G.clock += dt;
  if (G.mode === 'title') {
    // la caméra dérive lentement au-dessus de la ville déserte
    const a = G.clock * 0.03;
    G.time = saved ? G.time : 17.6 * 60;
    renderWorld(dt, [48 + Math.sin(a) * 12, 48 + Math.cos(a * 0.8) * 12], false);
    drawTitle(saved);
  } else if (G.mode === 'play') {
    if (!G.ui || G.ui.kind !== 'menu') update(dt, input);
    // caméra : en avant de la voiture, petite secousse aux chocs
    const L = G.lead || [0, 0];
    G.shake = Math.max(0, (G.shake || 0) - dt * 12);
    const sh = G.shake ? (Math.random() - 0.5) * G.shake / 16 : 0;
    renderWorld(dt, [G.p.x + L[0] + sh, G.p.y + L[1] - sh], true);
    if (G.mode === 'play' && !G.p.sleeping) drawHUD();
    drawOverlay();
  } else if (G.mode === 'dead') {
    renderWorld(dt, [G.p.x, G.p.y], false);
    drawDeath();
  }
  // ambiance sonore
  const h = hour(), p = G.p;
  let fire = 0;
  if (p && G.mode === 'play') for (const o of litFires()) fire = Math.max(fire, 1 - Math.hypot(o.x + 0.5 - p.x, o.y + 0.5 - p.y) / 6);
  setEnv({ rain: G.weather.rain, night: h < 5.5 || h > 20.5, inside: G.mode === 'play' && inBuilding(p.x, p.y) >= 0, fire: Math.max(0, fire) });
  requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
