// Все звуки синтезируются в браузере: шум комнаты, включение кинескопа, диск, телефон.
// Музыка подключается файлом audio/music.mp3, если он есть.
let ctx, master, music, muted = false;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  roomTone();
  startMusic();
}

export function setMuted(m) {
  muted = m;
  if (!ctx) return;
  master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.08);
}
export const isMuted = () => muted;

function noiseBuffer(sec, brown = false) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}

// Тихий фон комнаты: бурый шум и гул лампы на 50 Гц
function roomTone() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(4, true); src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const g = ctx.createGain(); g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
  src.connect(lp).connect(g).connect(master); src.start();

  const hum = ctx.createOscillator(); hum.frequency.value = 100;
  const hg = ctx.createGain(); hg.gain.value = 0.004;
  hum.connect(hg).connect(master); hum.start();
}

// Если файла с музыкой нет, играет тихий синтезированный фон: тёплые аккорды и треск пластинки
let pad = null;
function startPad() {
  if (pad) return;
  const out = ctx.createGain(); out.gain.value = 0;
  out.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 4);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  const delay = ctx.createDelay(); delay.delayTime.value = 0.32;
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  lp.connect(out); lp.connect(delay); delay.connect(fb).connect(delay); delay.connect(out);
  out.connect(master);
  const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let bar = 0, stopped = false;
  const playBar = () => {
    if (stopped) return;
    const t = ctx.currentTime + 0.05, ch = chords[bar % 4];
    ch.forEach((m, i) => {
      for (const [type, mul, g] of [['sine', 1, 0.16], ['triangle', 2, 0.03]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m) * mul; o.detune.value = (Math.random() - 0.5) * 8;
        const e = ctx.createGain();
        const start = t + i * 0.06;
        e.gain.setValueAtTime(0, start); e.gain.linearRampToValueAtTime(g, start + 0.04); e.gain.exponentialRampToValueAtTime(0.0008, start + 3.6);
        o.connect(e).connect(lp); o.start(start); o.stop(start + 3.8);
      }
    });
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = hz(ch[0] - 12);
    const be = ctx.createGain(); be.gain.setValueAtTime(0, t); be.gain.linearRampToValueAtTime(0.18, t + 0.05); be.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    b.connect(be).connect(lp); b.start(t); b.stop(t + 2.5);
    bar++;
    pad.timer = setTimeout(playBar, 3600);
  };
  const crackle = ctx.createBufferSource();
  const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() < 0.0009 ? (Math.random() - 0.5) * 0.9 : (Math.random() - 0.5) * 0.012;
  crackle.buffer = buf; crackle.loop = true;
  const cg = ctx.createGain(); cg.gain.value = 0.25;
  crackle.connect(cg).connect(out); crackle.start();
  pad = { out, stop() { stopped = true; clearTimeout(pad.timer); out.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => crackle.stop(), 2000); } };
  playBar();
}
let musicOn = false;
export function toggleMusic() {
  if (!ctx) return false;
  musicOn = !musicOn;
  click(ctx.currentTime, 0.35, 900, 0.04);
  if (music) { musicOn ? music.play() : music.pause(); return musicOn; }
  if (musicOn) startPad(); else if (pad) { pad.stop(); pad = null; }
  return musicOn;
}

async function startMusic() {
  try {
    const res = await fetch('audio/music.mp3', { method: 'HEAD' });
    if (!res.ok) { musicOn = true; startPad(); return; }
    music = new Audio('audio/music.mp3');
    music.loop = true; music.volume = 0;
    const node = ctx.createMediaElementSource(music);
    node.connect(master);
    await music.play(); musicOn = true;
    const t0 = performance.now();
    const fade = () => { const k = Math.min(1, (performance.now() - t0) / 4000); music.volume = 0.35 * k; if (k < 1) requestAnimationFrame(fade); };
    fade();
  } catch { musicOn = true; startPad(); }
}

export function duckMusic(on) {
  if (!music) return;
  music.volume = on ? 0.12 : 0.35;
}

function env(gain, t, a, d, peak) {
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function click(t, peak = 0.25, freq = 2500, dur = 0.03) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(dur + 0.02);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 2;
  const g = ctx.createGain(); env(g, t, 0.001, dur, peak);
  s.connect(bp).connect(g).connect(master); s.start(t);
}

function tone(t, freq, dur, peak = 0.08, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.02);
  g.gain.setValueAtTime(peak, t + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}

// Щелчок выключателя и гудение кинескопа с высоким писком
export function crtOn() {
  if (!ctx) return;
  const t = ctx.currentTime;
  click(t, 0.5, 900, 0.06);
  const thump = ctx.createOscillator(); thump.frequency.setValueAtTime(90, t); thump.frequency.exponentialRampToValueAtTime(40, t + 0.4);
  const tg = ctx.createGain(); env(tg, t, 0.005, 0.5, 0.35);
  thump.connect(tg).connect(master); thump.start(t); thump.stop(t + 0.6);
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(1.2);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  const sg = ctx.createGain(); env(sg, t + 0.05, 0.05, 1.0, 0.06);
  s.connect(hp).connect(sg).connect(master); s.start(t + 0.05);
  const whine = ctx.createOscillator(); whine.frequency.value = 7800;
  const wg = ctx.createGain(); wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(0.006, t + 0.6); wg.gain.linearRampToValueAtTime(0.002, t + 4);
  whine.connect(wg).connect(master); whine.start(t); whine.stop(t + 6);
  // жёсткий диск: короткие сухие щелчки в случайном ритме
  for (let i = 0; i < 26; i++) click(t + 0.9 + Math.random() * 3.2, 0.05 + Math.random() * 0.06, 1800 + Math.random() * 1500, 0.015);
}

// Дисковый набор номера, гудки, сброс. Возвращает длительность в секундах.
export function phoneCall(onHangup) {
  if (!ctx) { onHangup?.(); return 0; }
  const t0 = ctx.currentTime + 0.3;
  let t = t0;
  click(t, 0.3, 700, 0.05); t += 0.6;                       // сняли трубку
  tone(t0 + 0.1, 425, 0.5, 0.05);                            // гудок линии
  for (const d of [9, 2, 6, 3]) {                            // четыре цифры, дальше не нужно
    t += 0.35;                                               // завод диска
    click(t, 0.12, 1200, 0.25);
    for (let i = 0; i < d; i++) { t += 0.1; click(t, 0.22, 2200, 0.02); }
    t += 0.25;
  }
  t += 0.5;
  for (let i = 0; i < 2; i++) { tone(t, 425, 1.0, 0.07); t += 3.0; } // длинные гудки
  click(t, 0.4, 500, 0.08);                                  // трубку положили
  for (let i = 0; i < 3; i++) tone(t + 0.3 + i * 0.7, 425, 0.35, 0.05); // короткие гудки
  const dur = t - ctx.currentTime + 0.3;
  if (onHangup) setTimeout(onHangup, dur * 1000);
  return dur;
}

export function paperRustle() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.5);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 0.7;
  const g = ctx.createGain(); env(g, t, 0.05, 0.4, 0.06);
  s.connect(bp).connect(g).connect(master); s.start(t);
}

export function switchClick() { if (ctx) { click(ctx.currentTime, 0.4, 1600, 0.03); click(ctx.currentTime + 0.05, 0.2, 900, 0.03); } }
