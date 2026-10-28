// Son entièrement synthétisé (Web Audio) : vent, pluie, oiseaux, grillons, feu, piano lointain, bruitages.
let A = null, master, sfxBus, amb, verb, noiseBuf;
let wind, rainG, rainF, windG, eng, engG, engF;
let muted = false;
const env = { rain: 0, night: false, inside: false, fire: 0, outside: true };

export function initAudio() {
  if (A) { if (A.state === 'suspended') A.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  A = new AC();
  master = A.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(A.destination);
  sfxBus = A.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  amb = A.createGain(); amb.gain.value = 1; amb.connect(master);
  // réverbération : bruit qui décroît
  verb = A.createConvolver();
  const len = A.sampleRate * 3, ir = A.createBuffer(2, len, A.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ir;
  const vg = A.createGain(); vg.gain.value = 0.55; verb.connect(vg); vg.connect(master);
  noiseBuf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; nd[i] = i & 1 ? w : last * 3.5; }
  // vent : bruit grave filtré qui respire
  wind = loopNoise(); const wf = A.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
  windG = A.createGain(); windG.gain.value = 0.05; wind.connect(wf); wf.connect(windG); windG.connect(amb);
  // pluie : bruit clair
  const rn = loopNoise(); rainF = A.createBiquadFilter(); rainF.type = 'bandpass'; rainF.frequency.value = 2400; rainF.Q.value = 0.4;
  rainG = A.createGain(); rainG.gain.value = 0; rn.connect(rainF); rainF.connect(rainG); rainG.connect(amb);
  // moteur : dents de scie graves filtrées, le régime suit la vitesse
  eng = A.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 38;
  engF = A.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 240;
  engG = A.createGain(); engG.gain.value = 0;
  eng.connect(engF); engF.connect(engG); engG.connect(sfxBus); eng.start();
  tick();
}
export function setEngine(rpm, on) {
  if (!A) return;
  const t = A.currentTime;
  engG.gain.setTargetAtTime(on ? 0.05 + rpm * 0.05 : 0, t, 0.15);
  eng.frequency.setTargetAtTime(36 + rpm * 70, t, 0.2);
  engF.frequency.setTargetAtTime(220 + rpm * 500, t, 0.2);
}
function loopNoise() { const s = A.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; }

export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, A.currentTime, 0.1); }
export function setEnv(e) { Object.assign(env, e); }

// ---------------------------------------------------------------- briques
function tone(f, dur, { type = 'sine', vol = 0.2, to = null, at = 0, dest = sfxBus, attack = 0.005 } = {}) {
  const t = A.currentTime + at;
  const o = A.createOscillator(), g = A.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { type = 'lowpass', f = 1000, q = 0.7, vol = 0.2, at = 0, to = null, dest = sfxBus, attack = 0.004 } = {}) {
  const t = A.currentTime + at;
  const s = A.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = A.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
const rr = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- bruitages
const FX = {
  // Pas : un appui grave (le talon) + une texture qui dépend du sol, pied gauche et droit
  // légèrement différents, plus fort et plus sec en courant.
  step(o = {}) {
    const t = o.t, run = o.run ? 1.6 : 1, side = o.foot ? 1.06 : 0.94, v = 0.85 + Math.random() * 0.3;
    const wood = t === 7, soft = t === 10 || t === 20, tile = t === 8 || t === 9 || t === 21;
    const hard = t === 5 || t === 6 || t === 13 || t === 14 || t === 15 || t === 18;
    const grass = t === 0 || t === 1 || t === 2 || t === 11, earth = t === 3 || t === 4 || t === 16 || t === 19;
    if (wood) {
      tone(rr(95, 115) * side, 0.09, { vol: 0.14 * run * v, to: 70 });
      noise(0.05, { type: 'bandpass', f: rr(600, 900), q: 2, vol: 0.05 * v });
      if (Math.random() < 0.12) tone(rr(300, 420), 0.25, { type: 'triangle', vol: 0.012, to: rr(260, 380), at: 0.02 }); // parquet qui grince
    } else if (soft) {
      noise(0.08, { f: 500, vol: 0.06 * run * v });
    } else if (tile) {
      tone(rr(160, 190) * side, 0.04, { vol: 0.08 * v });
      noise(0.04, { type: 'highpass', f: 3000, vol: 0.05 * run * v });
    } else if (hard) {
      tone(rr(70, 90) * side, 0.06, { vol: 0.08 * run * v });
      noise(0.045, { type: 'bandpass', f: rr(2200, 3200), q: 1.4, vol: 0.07 * run * v });
      noise(0.03, { type: 'highpass', f: 5000, vol: 0.02 * v, at: 0.03 }); // le gravier sous la semelle
    } else if (earth) {
      tone(rr(60, 80) * side, 0.08, { vol: 0.07 * run * v });
      for (let i = 0; i < 3; i++) noise(0.025, { type: 'bandpass', f: rr(900, 2200), q: 2, vol: 0.05 * run * v, at: i * 0.02 + rr(0, 0.01) }); // crissement
    } else if (grass) {
      tone(rr(55, 70) * side, 0.07, { vol: 0.05 * run * v });
      noise(0.13, { type: 'bandpass', f: rr(1800, 2800), q: 0.8, vol: 0.045 * run * v, attack: 0.02 }); // froissement de l'herbe
    } else noise(0.08, { f: 700, vol: 0.07 * v });
    if (o.leaves) noise(0.18, { type: 'highpass', f: rr(3000, 4500), vol: 0.035 * run * v, attack: 0.01, at: 0.01 }); // feuilles mortes
  },
  open() { tone(rr(160, 200), 0.3, { type: 'sawtooth', vol: 0.03, to: 110 }); noise(0.12, { f: 700, vol: 0.08 }); },
  fridge() { noise(0.08, { type: 'highpass', f: 2500, vol: 0.06 }); tone(55, 0.6, { vol: 0.05 }); },
  trunk() { noise(0.15, { f: 500, vol: 0.12 }); tone(80, 0.2, { vol: 0.1 }); },
  door() { tone(140, 0.12, { vol: 0.12, to: 90 }); noise(0.1, { f: 600, vol: 0.1 }); },
  locked() { tone(900, 0.05, { type: 'square', vol: 0.04 }); tone(700, 0.05, { type: 'square', vol: 0.04, at: 0.08 }); },
  glass() { noise(0.4, { type: 'highpass', f: 3000, vol: 0.25 }); for (let i = 0; i < 6; i++) tone(rr(2500, 5000), 0.25, { vol: 0.04, at: i * 0.04 + rr(0, 0.05) }); },
  break() { noise(0.25, { f: 400, vol: 0.25 }); tone(70, 0.3, { vol: 0.15 }); },
  chop() { tone(rr(85, 105), 0.18, { vol: 0.25, to: 50 }); noise(0.08, { type: 'bandpass', f: 1200, vol: 0.15 }); },
  fall() { noise(1.4, { f: 300, vol: 0.3, to: 80 }); tone(50, 1.2, { vol: 0.2, to: 30 }); noise(0.8, { type: 'highpass', f: 2000, vol: 0.08, at: 0.3 }); },
  eat() { for (let i = 0; i < 4; i++) noise(0.06, { type: 'bandpass', f: rr(1500, 3000), vol: 0.08, at: i * 0.18 }); },
  drink() { for (let i = 0; i < 3; i++) tone(rr(250, 380), 0.12, { vol: 0.08, to: rr(450, 600), at: i * 0.32 }); },
  pill() { tone(1200, 0.04, { vol: 0.04 }); this.drink(); },
  pickup() { tone(rr(700, 900), 0.05, { vol: 0.05, type: 'triangle' }); },
  ui() { tone(1100, 0.03, { vol: 0.025, type: 'triangle' }); },
  craft() { noise(0.15, { f: 1500, vol: 0.08 }); tone(520, 0.12, { vol: 0.05, type: 'triangle', at: 0.1 }); },
  ignite() { noise(0.5, { f: 400, vol: 0.2, to: 2500 }); },
  splash() { noise(0.35, { type: 'bandpass', f: 1400, vol: 0.2, to: 500 }); },
  cast() { noise(0.25, { type: 'highpass', f: 2500, vol: 0.06, to: 5000 }); noise(0.2, { type: 'bandpass', f: 900, vol: 0.06, at: 0.5 }); },
  hurt() { tone(220, 0.25, { type: 'triangle', vol: 0.12, to: 140 }); },
  page() { noise(0.2, { type: 'highpass', f: 3500, vol: 0.06 }); },
  cloth() { noise(0.3, { type: 'bandpass', f: 2000, vol: 0.06, to: 1200 }); },
  wood() { tone(150, 0.12, { vol: 0.12 }); tone(120, 0.12, { vol: 0.1, at: 0.12 }); },
  leaves() { noise(0.35, { type: 'highpass', f: 2200, vol: 0.07 }); },
  radio() {
    noise(2.4, { type: 'bandpass', f: 1800, q: 0.6, vol: 0.08 });
    for (let i = 0; i < 5; i++) tone(rr(200, 330), 0.25, { type: 'square', vol: 0.006, at: 0.6 + i * 0.28 });
  },
  shot_pistol() { noise(0.25, { f: 1800, vol: 0.5, to: 300, attack: 0.001 }); tone(140, 0.18, { vol: 0.35, to: 50 }); noise(1.2, { f: 500, vol: 0.12, at: 0.05, to: 120, dest: verb }); },
  shot_shotgun() { noise(0.4, { f: 1200, vol: 0.7, to: 200, attack: 0.001 }); tone(90, 0.3, { vol: 0.45, to: 40 }); noise(1.8, { f: 400, vol: 0.18, at: 0.05, to: 90, dest: verb }); tone(500, 0.06, { type: 'square', vol: 0.03, at: 0.45 }); noise(0.08, { type: 'bandpass', f: 1500, vol: 0.08, at: 0.5 }); },
  shot_rifle() { noise(0.3, { f: 3000, vol: 0.6, to: 400, attack: 0.001 }); tone(110, 0.25, { vol: 0.4, to: 45 }); noise(2.2, { f: 600, vol: 0.14, at: 0.04, to: 100, dest: verb }); },
  dry() { tone(1800, 0.02, { type: 'square', vol: 0.05 }); },
  reload() { noise(0.05, { type: 'bandpass', f: 2500, q: 3, vol: 0.12 }); tone(900, 0.04, { type: 'square', vol: 0.04, at: 0.08 }); },
  thud() { tone(70, 0.4, { vol: 0.25, to: 40 }); noise(0.3, { f: 300, vol: 0.15 }); },
  stairs() { for (let i = 0; i < 4; i++) tone(rr(100, 125), 0.08, { vol: 0.1, at: i * 0.12 }); },
  powerdown() { tone(120, 2.5, { type: 'sawtooth', vol: 0.05, to: 30 }); noise(0.15, { type: 'highpass', f: 2000, vol: 0.2 }); },
  starter() { for (let i = 0; i < 5; i++) noise(0.09, { type: 'bandpass', f: 600, q: 2, vol: 0.12, at: i * 0.11 }); tone(45, 0.8, { type: 'sawtooth', vol: 0.06, at: 0.55, to: 60 }); },
  crash() { noise(0.5, { f: 900, vol: 0.35, to: 200 }); tone(60, 0.4, { vol: 0.2 }); for (let i = 0; i < 4; i++) tone(rr(1500, 3500), 0.2, { vol: 0.03, at: 0.05 + i * 0.05 }); },
  pour() { noise(0.7, { type: 'bandpass', f: 700, q: 3, vol: 0.06 }); },
  death() { tone(110, 3, { vol: 0.15, to: 55 }); tone(165, 3, { vol: 0.08, to: 82 }); },
};
export function sfx(name, arg) { if (A && !muted && FX[name]) FX[name](arg); }

// ---------------------------------------------------------------- ambiance et musique
let nextBird = 3, nextCricket = 1, nextCrackle = 0, nextPhrase = 25, phrase = null;
// La mineur, Fa, Do, Sol : vi-IV-I-V, lentement
const CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
function piano(m, at, vol = 0.06) {
  const f = midi(m);
  tone(f, 3.2, { type: 'triangle', vol, at, dest: verb, attack: 0.008 });
  tone(f * 2, 1.4, { vol: vol * 0.25, at, dest: verb });
  tone(f, 2.2, { vol: vol * 0.5, at, dest: sfxBus });
}

let last = 0;
function tick() {
  if (!A) return;
  const now = A.currentTime, dt = Math.min(0.5, now - last);
  last = now;
  // vent qui respire, plus fort sous la pluie, étouffé dedans
  const gust = 0.035 + Math.sin(now * 0.13) * 0.012 + Math.sin(now * 0.31) * 0.008 + env.rain * 0.03;
  windG.gain.setTargetAtTime(env.inside ? gust * 0.35 : gust, now, 0.5);
  rainG.gain.setTargetAtTime(env.rain * (env.inside ? 0.05 : 0.11), now, 0.8);
  rainF.frequency.setTargetAtTime(env.inside ? 900 : 2400, now, 0.5);
  if (!muted) {
    nextBird -= dt;
    if (nextBird <= 0) {
      nextBird = rr(5, 16);
      if (!env.night && env.rain < 0.3) {
        const base = rr(2400, 4200), n = 2 + (Math.random() * 4 | 0), v = env.inside ? 0.006 : 0.018;
        for (let i = 0; i < n; i++) tone(base * rr(0.9, 1.15), 0.09, { vol: v, to: base * rr(1.1, 1.4), at: i * rr(0.1, 0.16), dest: verb });
      }
    }
    nextCricket -= dt;
    if (nextCricket <= 0) {
      nextCricket = rr(0.7, 1.6);
      if (env.night && env.rain < 0.3) for (let i = 0; i < 3; i++) tone(4600 + rr(-80, 80), 0.035, { vol: env.inside ? 0.002 : 0.007, at: i * 0.06 });
    }
    nextCrackle -= dt;
    if (env.fire > 0 && nextCrackle <= 0) {
      nextCrackle = rr(0.05, 0.4);
      noise(0.03, { type: 'highpass', f: rr(2000, 5000), vol: 0.05 * env.fire });
    }
    // piano : une phrase de temps en temps, puis un long silence
    nextPhrase -= dt;
    if (!phrase && nextPhrase <= 0) phrase = { bar: 0, t: 0, len: 4 + (Math.random() * 2 | 0) * 4 };
    if (phrase) {
      phrase.t -= dt;
      if (phrase.t <= 0) {
        const ch = CHORDS[phrase.bar % 4];
        piano(ch[0] - 12, 0, 0.05);
        const order = [1, 2, 3, 2].map((k) => ch[k] + (Math.random() < 0.25 ? 12 : 0));
        order.forEach((m, i) => { if (Math.random() < 0.85) piano(m, 0.7 + i * 0.75, 0.035); });
        phrase.t = 3.6;
        phrase.bar++;
        if (phrase.bar >= phrase.len) { phrase = null; nextPhrase = rr(70, 160); }
      }
    }
  }
  setTimeout(tick, 100);
}
