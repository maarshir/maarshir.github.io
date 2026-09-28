// Городок в браузере: холст, цикл кадров, клавиатура, клик и окна зданий.
// Вся логика (карта, столкновения, путь, камера, выбор режима, что рядом и что
// написать в окне) в модулях рядом, здесь только связка с DOM.

import { TILE, MAP_W, MAP_H, SPAWN, buildGrid, makeSolid, buildingAt, frontTile } from './map.mjs';
import { move, velocity, facing, tileFeet, SPEED } from './physics.mjs';
import { findPath, nearestFree } from './path.mjs';
import { pixelScale, cameraTarget, follow } from './camera.mjs';
import { chooseMode } from './mode.mjs';
import { walkFrame } from './sprites.mjs';
import { drawStatic, drawHero, drawTarget } from './draw.mjs';
import {
  nearbyBuilding, hintAnchor, hintText, dialogFor, typedCounts, typingDone, typingDuration,
} from './interact.mjs';

const root = document.documentElement;
const section = document.getElementById('town');
const canvas = document.getElementById('town-canvas');
const ctx = canvas.getContext('2d');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const hintEl = section.querySelector('.town-hint');
const liveEl = document.getElementById('town-live');
const dialogEl = document.getElementById('town-dialog');
const dlgPlace = document.getElementById('town-dialog-place');
const dlgTitle = document.getElementById('town-dialog-title');
const dlgBody = dialogEl.querySelector('.dlg-body');
const dlgLinks = dialogEl.querySelector('.dlg-links');
const dlgClose = dialogEl.querySelector('.dlg-close');

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
let near = null;        // здание, у двери которого стоим
let pendingOpen = null; // здание, к которому идём по клику, чтобы открыть его окно
let dialog = null;      // открытое окно: { data, openedAt, lines }

// Те же данные, что у обычного режима. Пока грузятся, окна ждут; если не загрузились,
// окно предложит обычный режим.
const content = { profile: null, projects: null };
const loaded = Promise.all(['data/profile.json', 'data/projects.json'].map((url) =>
  fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
  .then(([profile, projects]) => { content.profile = profile; content.projects = projects; });

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
  let [dx, dy] = dialog ? [0, 0] : keyDirection();
  if (dx || dy) {
    path = [];
    target = null;
    pendingOpen = null;
  } else if (dialog) {
    // пока открыто окно, персонаж стоит
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

  setNear(hero.moving && path.length > 0 ? null : nearbyBuilding(hero.x, hero.y));
  if (pendingOpen && path.length === 0) {
    if (near === pendingOpen) openDialog(near);
    pendingOpen = null;
  }
  if (dialog) typeDialog();
}

// Подсказка у двери и объявление для читалки экрана.
function setNear(b) {
  if (b === near) return;
  near = b;
  hintEl.hidden = !b || Boolean(dialog);
  if (b) {
    hintEl.textContent = hintText(b);
    liveEl.textContent = `Рядом ${b.name}. Нажмите Enter, чтобы открыть.`;
  } else {
    liveEl.textContent = '';
  }
}

function placeHint() {
  if (!near || hintEl.hidden) return;
  const a = hintAnchor(near);
  const left = (a.x - Math.round(cam.x)) * view.scale;
  const top = (a.y - Math.round(cam.y)) * view.scale;
  hintEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px) translate(-50%, -100%)`;
}

// Окно здания. Текст собирается через textContent, разметки из данных здесь нет.
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openDialog(b) {
  if (dialog) return;
  const data = dialogFor(b, content.profile, content.projects);
  keys.clear();
  path = [];
  target = null;
  dlgPlace.textContent = data.place;
  dlgTitle.textContent = data.title;
  dlgBody.replaceChildren();
  dlgLinks.replaceChildren();
  const lines = data.paragraphs.map((text) => {
    // Читалка экрана сразу получает весь текст, глазами он печатается.
    const p = el('p', 'dlg-text');
    p.append(el('span', 'sr-only', text));
    const shown = el('span', 'dlg-typed');
    const rest = el('span', 'dlg-rest', text);
    const visual = el('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.append(shown, rest);
    p.append(visual);
    dlgBody.append(p);
    return { text, shown, rest, n: 0 };
  });
  const after = el('div', 'dlg-after');
  if (data.points.length) {
    const ul = el('ul', 'points');
    for (const item of data.points) ul.append(el('li', '', item));
    after.append(ul);
  }
  if (data.tags.length) {
    const ul = el('ul', 'tags');
    ul.setAttribute('aria-label', 'Технологии');
    for (const item of data.tags) ul.append(el('li', '', item));
    after.append(ul);
  }
  if (after.childElementCount) dlgBody.append(after);
  for (const link of data.links) {
    const a = el('a', 'btn', link.label);
    a.href = link.url;
    if (link.external) { a.target = '_blank'; a.rel = 'noopener'; }
    dlgLinks.append(a);
  }
  dialog = { data, openedAt: clock, lines, done: false };
  dialogEl.classList.remove('typed');
  dialogEl.hidden = false;
  hintEl.hidden = true;
  liveEl.textContent = '';
  typeDialog();
  dialogEl.focus({ preventScroll: true });
}

function typeDialog() {
  if (!dialog || dialog.done) return;
  const texts = dialog.lines.map((l) => l.text);
  const counts = typedCounts(texts, clock - dialog.openedAt, { reducedMotion: reduced.matches });
  dialog.lines.forEach((line, i) => {
    if (line.n === counts[i]) return;
    line.n = counts[i];
    line.shown.textContent = line.text.slice(0, line.n);
    line.rest.textContent = line.text.slice(line.n);
  });
  if (typingDone(texts, counts)) {
    dialog.done = true;
    dialogEl.classList.add('typed');
  }
}

// Первое нажатие во время печати показывает весь текст, а не закрывает окно.
function skipTyping() {
  if (!dialog || dialog.done) return false;
  dialog.openedAt = clock - typingDuration(dialog.lines.map((l) => l.text)) - 1;
  typeDialog();
  return true;
}

function closeDialog({ refocus = true } = {}) {
  if (!dialog) return;
  dialog = null;
  dialogEl.hidden = true;
  hintEl.hidden = !near;
  if (refocus && running) canvas.focus({ preventScroll: true });
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
  placeHint();
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
  closeDialog({ refocus: false });
}

// Клик или касание: идём к этому месту. Клик по зданию ведёт к его двери.
canvas.addEventListener('pointerdown', (e) => {
  if (dialog) { closeDialog(); return; }
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
  // Клик по зданию: дойти до двери и открыть окно. Если уже у двери, открыть сразу.
  pendingOpen = b;
  if (b && path.length === 0 && nearbyBuilding(hero.x, hero.y) === b) {
    pendingOpen = null;
    openDialog(b);
  }
});

hintEl.addEventListener('click', () => { if (near) openDialog(near); });
dlgClose.addEventListener('click', () => closeDialog());

// Окно модальное: Esc закрывает, Tab ходит по кнопкам окна и не уходит на карту.
dialogEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeDialog();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a, button')) {
    e.preventDefault();
    if (!skipTyping()) closeDialog();
    return;
  }
  if (e.key === 'Tab') {
    const items = [...dialogEl.querySelectorAll('a[href], button')];
    if (!items.length) return;
    const first = items[0];
    const lastItem = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogEl)) {
      e.preventDefault();
      lastItem.focus();
    } else if (!e.shiftKey && document.activeElement === lastItem) {
      e.preventDefault();
      first.focus();
    }
  }
});
// Клик по окну во время печати тоже показывает текст целиком.
dialogEl.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('a, button')) skipTyping();
});

window.addEventListener('keydown', (e) => {
  if (!running || dialog || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const onControl = e.target instanceof HTMLElement && e.target.closest('a, button, input, textarea');
  if ((e.key === 'Enter' || e.key === ' ') && near && !onControl) {
    e.preventDefault();
    openDialog(near);
    return;
  }
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
loaded.then(() => {
  // Если окно открыли раньше, чем пришли данные, перерисуем его с данными.
  if (dialog && dialog.data.missing && near) {
    const b = near;
    closeDialog({ refocus: false });
    openDialog(b);
  }
});
