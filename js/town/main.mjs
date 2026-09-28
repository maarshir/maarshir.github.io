// Городок в браузере: холст, цикл кадров, клавиатура и клик.
// Вся логика (карта, столкновения, путь, камера, выбор режима) в модулях рядом,
// здесь только связка с DOM.

import { TILE, MAP_W, MAP_H, SPAWN, buildGrid, makeSolid, buildingAt, frontTile } from './map.mjs';
import { move, velocity, facing, tileFeet, SPEED } from './physics.mjs';
import { findPath, nearestFree } from './path.mjs';
import { pixelScale, cameraTarget, follow } from './camera.mjs';
import { chooseMode } from './mode.mjs';
import { walkFrame } from './sprites.mjs';
import { drawStatic, drawHero, drawTarget } from './draw.mjs';

const root = document.documentElement;
const section = document.getElementById('town');
const canvas = document.getElementById('town-canvas');
const ctx = canvas.getContext('2d');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

const grid = buildGrid();
const solid = makeSolid(grid);

// Неподвижная часть карты рисуется один раз.
const ground = document.createElement('canvas');
ground.width = MAP_W * TILE;
ground.height = MAP_H * TILE;
drawStatic(ground.getContext('2d'), grid);

const hero = { ...tileFeet(SPAWN.tx, SPAWN.ty), dir: 'down', moving: false, walkTime: 0 };
const view = { w: 0, h: 0, scale: 2 };
let cam = { x: 0, y: 0 };
let path = [];          // оставшиеся тайлы пути после клика
let target = null;      // куда идём, для отметки на карте
let running = false;
let last = 0;
let clock = 0;
const keys = new Set();

const KEY_DIRS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

function resize() {
  const w = section.clientWidth;
  const h = section.clientHeight;
  view.scale = pixelScale(w, h, TILE);
  view.w = Math.ceil(w / view.scale);
  view.h = Math.ceil(h / view.scale);
  canvas.width = view.w;
  canvas.height = view.h;
  canvas.style.width = `${view.w * view.scale}px`;
  canvas.style.height = `${view.h * view.scale}px`;
  ctx.imageSmoothingEnabled = false;
  cam = cameraTarget(hero.x, hero.y - 8, view.w, view.h, ground.width, ground.height);
}

function keyDirection() {
  let dx = 0;
  let dy = 0;
  for (const code of keys) {
    const d = KEY_DIRS[code];
    if (d) { dx += d[0]; dy += d[1]; }
  }
  return [Math.sign(dx), Math.sign(dy)];
}

function heroTile() {
  return { tx: Math.floor(hero.x / TILE), ty: Math.floor((hero.y - 1) / TILE) };
}

function update(dt) {
  let [dx, dy] = keyDirection();
  if (dx || dy) {
    path = [];
    target = null;
  } else if (path.length > 0) {
    // идём к центру следующего тайла пути
    const next = tileFeet(path[0].tx, path[0].ty);
    const ex = next.x - hero.x;
    const ey = next.y - hero.y;
    const dist = Math.hypot(ex, ey);
    if (dist <= SPEED * dt) {
      hero.x = next.x;
      hero.y = next.y;
      path.shift();
      if (path.length === 0) target = null;
      dx = Math.sign(ex);
      dy = Math.sign(ey);
    } else {
      dx = ex / dist;
      dy = ey / dist;
    }
  }
  const { vx, vy } = velocity(dx, dy);
  hero.dir = facing(hero.dir, vx, vy);
  const before = { x: hero.x, y: hero.y };
  if (vx || vy) Object.assign(hero, move(hero, vx * dt, vy * dt, solid));
  hero.moving = Math.hypot(hero.x - before.x, hero.y - before.y) > 0.01;
  hero.walkTime = hero.moving ? hero.walkTime + dt : 0;

  const goal = cameraTarget(hero.x, hero.y - 8, view.w, view.h, ground.width, ground.height);
  cam = follow(cam, goal, dt, { reducedMotion: reduced.matches });
}

function render() {
  const cx = Math.round(cam.x);
  const cy = Math.round(cam.y);
  ctx.fillStyle = '#2f5a2c';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(-cx, -cy);
  ctx.drawImage(ground, 0, 0);
  if (target) drawTarget(ctx, target.tx, target.ty, clock);
  drawHero(ctx, hero.x, hero.y, hero.dir, walkFrame(hero.moving, hero.walkTime));
  ctx.restore();
}

function frame(now) {
  if (!running) return;
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  clock += dt;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true;
  resize();
  last = performance.now();
  requestAnimationFrame(frame);
}

function stop() {
  running = false;
  keys.clear();
}

// Клик или касание: идём к этому месту. Клик по зданию ведёт к его двери.
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const wx = (e.clientX - r.left) / view.scale + Math.round(cam.x);
  const wy = (e.clientY - r.top) / view.scale + Math.round(cam.y);
  const tapped = { tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE) };
  const b = buildingAt(tapped.tx, tapped.ty);
  const from = heroTile();
  const goal = b ? frontTile(b) : nearestFree(tapped, from, solid);
  if (!goal) return;
  const found = findPath(from, goal, solid);
  if (!found) return;
  path = found.slice(1);
  target = path.length ? goal : null;
});

window.addEventListener('keydown', (e) => {
  if (!running || e.altKey || e.ctrlKey || e.metaKey) return;
  if (!KEY_DIRS[e.code]) return;
  // Стрелки не должны прокручивать страницу, пока гуляем. Но если фокус
  // на кнопке или ссылке, клавиатура работает как обычно.
  if (e.target instanceof HTMLElement && e.target.closest('a, button, input, textarea')) return;
  e.preventDefault();
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => { if (running) resize(); });

function applyMode() {
  const mode = chooseMode(window.location.hash, window.innerWidth);
  root.classList.toggle('town-first', mode === 'town');
  if (mode === 'town') start(); else stop();
}

window.addEventListener('hashchange', applyMode);
root.classList.add('town-ready');
applyMode();
