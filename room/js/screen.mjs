// Экран компьютера: холст с содержимым и шейдер старого кинескопа поверх.
// Состояния: off (тёмное стекло), boot (строки загрузки), desktop (рабочий стол с окнами).
import * as THREE from 'three';
import { canvas, wrap } from './textures.mjs';

const W = 1280, H = 960;

const BOOT = [
  'КАПУСТИН-ПК  БИОС версия 2.6',
  '',
  'Процессор: 486DX2, 66 МГц',
  'Проверка памяти: 640К ...... норма',
  'Дисковод A: 1,44 МБ',
  'Жёсткий диск C: 540 МБ',
  '',
  'Загрузка с диска C:',
  'Поиск проектов ...... найдено',
  'Запуск рабочего стола',
];

export function createScreen(projects) {
  const [c, g] = canvas(W, H);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uPower: { value: 0 },  // 0 выключен, 1 полностью включён
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float uPower; uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        vec2 uv = 0.5 + c * (1.0 + 0.10 * r2);          // выпуклость кинескопа
        vec3 glass = vec3(0.018, 0.024, 0.022) + vec3(0.02) * (0.5 - c.y);
        vec3 col = glass;
        if (uPower > 0.0) {
          float sx = smoothstep(0.0, 0.22, uPower);
          float sy = mix(0.004, 1.0, smoothstep(0.22, 0.55, uPower));
          float inside = step(abs(c.x), sx * 0.5) * step(abs(c.y), sy * 0.5);
          vec3 img = texture2D(map, clamp(uv, 0.0, 1.0)).rgb;
          float content = smoothstep(0.5, 0.75, uPower);
          vec3 flash = vec3(0.85, 0.95, 1.0);
          vec3 lit = mix(flash, img * 0.72, content);
          lit *= 0.9 + 0.1 * sin(uv.y * 960.0 * 3.14159);      // строки развёртки
          lit *= 0.985 + 0.015 * sin(uTime * 55.0);               // лёгкое мерцание
          float boost = 1.0 + 2.5 * (1.0 - smoothstep(0.15, 0.6, uPower));
          col = mix(glass, lit * boost, inside);
        }
        float edge = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        col *= edge;
        col *= smoothstep(0.78, 0.32, length(c * vec2(1.0, 1.2)));          // затемнение к краям
        col += vec3(1.0, 0.82, 0.55) * 0.05 * smoothstep(0.3, 0.0, length(c - vec2(0.27, 0.3))); // блик лампы
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const state = { mode: 'off', bootLines: 0, cursor: true };

  function clear(color) { g.fillStyle = color; g.fillRect(0, 0, W, H); }

  function drawBoot() {
    clear('#06080a');
    g.font = '40px Tiny5';
    g.fillStyle = '#c9d7c8';
    BOOT.slice(0, state.bootLines).forEach((l, i) => g.fillText(l, 70, 110 + i * 62));
    if (state.cursor) g.fillRect(70, 110 + state.bootLines * 62 - 34, 24, 40);
    map.needsUpdate = true;
  }

  function window_(x, y, w, h, title) {
    g.fillStyle = '#1b1f2a'; g.fillRect(x + 8, y + 8, w, h);          // тень
    g.fillStyle = '#e9e2cf'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#1b1f2a'; g.lineWidth = 4; g.strokeRect(x, y, w, h);
    g.fillStyle = '#23336e'; g.fillRect(x + 4, y + 4, w - 8, 46);
    g.fillStyle = '#f4ecd8'; g.font = '30px Tiny5'; g.fillText(title, x + 18, y + 38);
    g.fillStyle = '#e9e2cf'; g.fillRect(x + w - 44, y + 12, 30, 30);
    g.fillStyle = '#1b1f2a'; g.font = '26px Tiny5'; g.fillText('x', x + w - 36, y + 36);
  }

  function icon(x, y, label, color) {
    g.fillStyle = color; g.fillRect(x + 22, y, 56, 46);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 22, y + 40, 56, 6);
    g.fillStyle = '#f4ecd8'; g.font = '24px Tiny5'; g.textAlign = 'center';
    g.fillText(label, x + 50, y + 80); g.textAlign = 'left';
  }

  function drawDesktop() {
    clear('#1f6f6b');
    // мелкий узор обоев
    g.fillStyle = 'rgba(255,255,255,.04)';
    for (let y = 0; y < H; y += 16) for (let x = (y / 16) % 2 * 8; x < W; x += 16) g.fillRect(x, y, 4, 4);
    icon(30, 40, 'Проекты', '#e8b04b');
    icon(30, 170, 'Резюме', '#f4ecd8');
    icon(30, 300, 'Терминал', '#2b2139');
    icon(30, 430, 'Корзина', '#8a8f99');

    const main = projects.filter(p => p.group === 'main').slice(0, 3);
    window_(180, 50, 1040, 640, 'Проекты');
    main.forEach((p, i) => {
      const x = 210 + i * 335, y = 130, w = 310, h = 520;
      g.fillStyle = '#fffaf0'; g.fillRect(x, y, w, h);
      g.fillStyle = ['#b0452e', '#4f86c6', '#4c8a41'][i]; g.fillRect(x, y, w, 14);
      g.strokeStyle = '#1b1f2a'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
      g.fillStyle = '#1b1f2a'; g.font = '34px Tiny5'; g.fillText(p.title, x + 18, y + 64);
      g.fillStyle = '#3a3346'; g.font = '30px "Golos Text"';
      const n = wrap(g, p.line, x + 18, y + 116, w - 36, 40).length;
      g.font = '24px Tiny5'; g.fillStyle = '#5e5470';
      const room = Math.max(0, Math.floor((y + h - 92 - (y + 136 + n * 40)) / 36) + 1);
      p.stack.slice(0, Math.min(3, room)).forEach((s, j) => g.fillText(s, x + 18, y + 136 + n * 40 + j * 36));
      g.fillStyle = '#e8b04b'; g.fillRect(x + 18, y + h - 70, 150, 48);
      g.strokeRect(x + 18, y + h - 70, 150, 48);
      g.fillStyle = '#1b1f2a'; g.font = '26px Tiny5'; g.fillText('Гитхаб', x + 40, y + h - 37);
    });

    // панель задач
    g.fillStyle = '#c9c2b0'; g.fillRect(0, H - 70, W, 70);
    g.fillStyle = '#f4ecd8'; g.fillRect(0, H - 70, W, 4);
    g.fillStyle = '#b0452e'; g.fillRect(12, H - 58, 120, 46);
    g.fillStyle = '#f4ecd8'; g.font = '28px Tiny5'; g.fillText('Пуск', 34, H - 25);
    g.fillStyle = '#e9e2cf'; g.fillRect(150, H - 58, 220, 46);
    g.fillStyle = '#1b1f2a'; g.fillText('Проекты', 170, H - 25);
    const now = new Date();
    g.fillText(now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), W - 110, H - 25);
    map.needsUpdate = true;
  }

  drawBoot();

  return {
    material,
    state,
    draw() { state.mode === 'boot' ? drawBoot() : state.mode === 'desktop' ? drawDesktop() : null; },
    setMode(m) { state.mode = m; this.draw(); },
    W, H,
  };
}
