// Текстуры рисуются на холсте при загрузке: дерево, стена, бумага. Картинок с диска нет.
import * as THREE from 'three';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Детерминированный шум, чтобы текстуры не менялись от загрузки к загрузке
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export function wood(base = '#6b4326', dark = '#4a2c17', seed = 3, repeat = [1, 1]) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  // Волокна: длинные волнистые полосы вдоль доски
  for (let i = 0; i < 140; i++) {
    const y = r() * 512, amp = 2 + r() * 6, f = 0.004 + r() * 0.01;
    g.strokeStyle = r() > .5 ? dark : '#8a5a36';
    g.globalAlpha = 0.08 + r() * 0.18;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    for (let x = 0; x <= 512; x += 8) g.lineTo(x, y + Math.sin(x * f + i) * amp);
    g.stroke();
  }
  // Пара сучков
  for (let k = 0; k < 2; k++) {
    const x = r() * 512, y = r() * 512;
    for (let j = 9; j > 0; j--) {
      g.globalAlpha = 0.07; g.strokeStyle = dark; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, j * 5, j * 2, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  g.globalAlpha = 1;
  return tex(c, repeat);
}

export function plaster(base = '#4b4233', seed = 7, repeat = [3, 2]) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const d = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (r() - .5) * 14;
    d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
  }
  g.putImageData(d, 0, 0);
  return tex(c, repeat);
}

export function cork() {
  const [c, g] = canvas(256, 256);
  const r = rng(11);
  g.fillStyle = '#a77a4a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() > .5 ? '#7d5530' : '#c49564';
    g.globalAlpha = .5;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  g.globalAlpha = 1;
  return tex(c);
}

// Лист бумаги с текстом. lines: [{text, size, bold, color, gap}]
export function paper(w, h, lines, { bg = '#f6efdc', pad = 40, font = 'Golos Text', lined = false, hand = false } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const r = rng(w + h);
  for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,90,40,.05)'; g.fillRect(r() * w, r() * h, 2, 2); }
  if (lined) {
    g.strokeStyle = 'rgba(70,110,170,.25)'; g.lineWidth = 2;
    for (let y = pad + 40; y < h; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }
  let y = pad;
  for (const l of lines) {
    const size = l.size || 28;
    y += (l.gap ?? 10) + size;
    g.fillStyle = l.color || '#2b2139';
    g.font = `${l.bold ? 700 : 400} ${size}px ${l.font || font}`;
    g.textAlign = l.align || 'left';
    const x = l.align === 'center' ? w / 2 : pad;
    if (hand) { g.save(); g.translate(x, y); g.rotate(-0.015); g.fillText(l.text, 0, 0); g.restore(); }
    else y += (wrap(g, l.text, x, y, w - pad * 2, size * 1.3).length - 1) * size * 1.3;
  }
  return tex(c);
}

export function wrap(g, text, x, y, max, lh) {
  let line = '', out = [];
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (g.measureText(t).width > max && line) { g.fillText(line, x, y); out.push(line); y += lh; line = word; }
    else line = t;
  }
  g.fillText(line, x, y); out.push(line);
  return out;
}

// Мягкое пятно для пара и пылинок
export function soft() {
  const [c, g] = canvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(.4, 'rgba(255,255,255,.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
