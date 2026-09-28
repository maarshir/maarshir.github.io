import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  TILE, MAP_W, MAP_H, TILES, BUILDINGS, SPAWN, buildGrid, makeSolid, frontTile, doorTile, buildingAt,
} from '../js/town/map.mjs';
import { move, hitsWall, velocity, facing, tileFeet, SPEED } from '../js/town/physics.mjs';
import { findPath, nearestFree } from '../js/town/path.mjs';
import { pixelScale, cameraTarget, follow } from '../js/town/camera.mjs';
import { chooseMode, TOWN_MIN_WIDTH } from '../js/town/mode.mjs';
import { HERO, HERO_PALETTE, TREE, TREE_PALETTE, EMBLEMS, EMBLEM_PALETTE, mirror, walkFrame } from '../js/town/sprites.mjs';
import { BUILDINGS as PROJECT_BUILDINGS } from '../js/render.mjs';

const root = new URL('../', import.meta.url);
const grid = buildGrid();
const solid = makeSolid(grid);

// Маленькая карта для тестов столкновений: # стена, . пол.
function tinySolid(rows) {
  return (tx, ty) => ty < 0 || ty >= rows.length || tx < 0 || tx >= rows[0].length || rows[ty][tx] === '#';
}

test('карта нужного размера и из известных тайлов', () => {
  assert.equal(grid.length, MAP_H);
  for (const row of grid) {
    assert.equal(row.length, MAP_W);
    for (const t of row) assert.ok(t in TILES, `неизвестный тайл ${t}`);
  }
});

test('край карты непроходим, за краем тоже стена', () => {
  for (let x = 0; x < MAP_W; x += 1) { assert.ok(solid(x, 0)); assert.ok(solid(x, MAP_H - 1)); }
  for (let y = 0; y < MAP_H; y += 1) { assert.ok(solid(0, y)); assert.ok(solid(MAP_W - 1, y)); }
  assert.ok(solid(-1, 5) && solid(5, -1) && solid(MAP_W, 5) && solid(5, MAP_H));
});

test('у каждого здания проекта из данных есть дом на карте', () => {
  const onMap = BUILDINGS.filter((b) => b.kind === 'project').map((b) => b.name).sort();
  assert.deepEqual(onMap, [...PROJECT_BUILDINGS].sort());
  for (const name of ['Дом Ивана', 'Почта', 'Доска объявлений']) {
    assert.ok(BUILDINGS.some((b) => b.name === name), name);
  }
});

test('здания не налезают друг на друга и дверь в нижнем ряду', () => {
  const seen = new Map();
  for (const b of BUILDINGS) {
    assert.ok(b.door >= b.x && b.door < b.x + b.w, `${b.id}: дверь вне здания`);
    assert.equal(buildingAt(doorTile(b).tx, doorTile(b).ty), b);
    for (let y = b.y; y < b.y + b.h; y += 1) {
      for (let x = b.x; x < b.x + b.w; x += 1) {
        const k = `${x},${y}`;
        assert.ok(!seen.has(k), `${b.id} налезает на ${seen.get(k)}`);
        seen.set(k, b.id);
        assert.ok(solid(x, y));
      }
    }
  }
});

test('от точки появления можно дойти до двери каждого здания', () => {
  assert.ok(!solid(SPAWN.tx, SPAWN.ty), 'точка появления на свободном тайле');
  for (const b of BUILDINGS) {
    const front = frontTile(b);
    assert.ok(!solid(front.tx, front.ty), `${b.id}: перед дверью занято`);
    assert.ok(findPath(SPAWN, front, solid), `${b.id}: не дойти`);
  }
});

test('персонаж, поставленный на центр тайла, помещается в него', () => {
  for (let ty = 0; ty < MAP_H; ty += 1) {
    for (let tx = 0; tx < MAP_W; tx += 1) {
      if (solid(tx, ty)) continue;
      const p = tileFeet(tx, ty);
      assert.ok(!hitsWall(p.x, p.y, solid), `тайл ${tx},${ty}`);
    }
  }
});

test('столкновение: упирается в стену вплотную и не проходит', () => {
  const s = tinySolid(['#####', '#...#', '#...#', '#####']);
  const start = tileFeet(2, 1);
  const r = move(start, 100, 0, s);
  assert.ok(r.blockedX);
  // правая грань ног ровно у стены (x = 4 * 16), с точностью до десятых
  assert.ok(Math.abs(r.x + 5 - 4 * TILE) < 0.1, `x=${r.x}`);
  assert.ok(!hitsWall(r.x, r.y, s));
});

test('столкновение: вдоль стены скользит по свободной оси', () => {
  const s = tinySolid(['#####', '#...#', '#...#', '#...#', '#####']);
  const start = tileFeet(2, 2);
  const r = move(start, 100, -8, s);
  assert.ok(r.blockedX);
  assert.ok(!r.blockedY);
  assert.equal(r.y, start.y - 8);
});

test('столкновение: большой шаг не проскакивает тонкую стену', () => {
  const s = tinySolid(['#######', '#..#..#', '#######']);
  const start = tileFeet(1, 1);
  const r = move(start, 200, 0, s);
  assert.ok(r.x < 3 * TILE, `проскочил: x=${r.x}`);
});

test('по диагонали не быстрее, чем по прямой', () => {
  const { vx, vy } = velocity(1, 1);
  assert.ok(Math.abs(Math.hypot(vx, vy) - SPEED) < 1e-9);
  assert.deepEqual(velocity(0, 0), { vx: 0, vy: 0 });
});

test('направление взгляда', () => {
  assert.equal(facing('down', 0, -5), 'up');
  assert.equal(facing('down', 5, 0), 'right');
  assert.equal(facing('up', 5, -5), 'up');        // по диагонали держим прежнее
  assert.equal(facing('down', -5, -5), 'left');
  assert.equal(facing('left', 0, 0), 'left');     // стоит: не поворачивается
});

test('путь: кратчайший и в обход стены', () => {
  const s = tinySolid([
    '#######',
    '#.....#',
    '#.###.#',
    '#.....#',
    '#######',
  ]);
  const path = findPath({ tx: 1, ty: 1 }, { tx: 5, ty: 3 }, s);
  assert.equal(path.length, 7);
  assert.deepEqual(path[0], { tx: 1, ty: 1 });
  assert.deepEqual(path.at(-1), { tx: 5, ty: 3 });
  for (const p of path) assert.ok(!s(p.tx, p.ty));
  for (let i = 1; i < path.length; i += 1) {
    assert.equal(Math.abs(path[i].tx - path[i - 1].tx) + Math.abs(path[i].ty - path[i - 1].ty), 1);
  }
});

test('путь: null, если цель закрыта или в стене', () => {
  const s = tinySolid(['#####', '#.#.#', '#####']);
  assert.equal(findPath({ tx: 1, ty: 1 }, { tx: 3, ty: 1 }, s), null);
  assert.equal(findPath({ tx: 1, ty: 1 }, { tx: 2, ty: 1 }, s), null);
  assert.deepEqual(findPath({ tx: 1, ty: 1 }, { tx: 1, ty: 1 }, s), [{ tx: 1, ty: 1 }]);
});

test('клик в пруд ведёт на ближайший берег', () => {
  const pond = { tx: 20, ty: 22 };
  assert.ok(solid(pond.tx, pond.ty));
  const free = nearestFree(pond, SPAWN, solid);
  assert.ok(!solid(free.tx, free.ty));
  assert.ok(Math.max(Math.abs(free.tx - pond.tx), Math.abs(free.ty - pond.ty)) <= 3);
  assert.deepEqual(nearestFree({ tx: 6, ty: 8 }, SPAWN, solid), { tx: 6, ty: 8 });
});

test('масштаб целый и не меньше 2', () => {
  assert.equal(pixelScale(1280, 720), 3);
  assert.equal(pixelScale(1920, 1080), 5);
  assert.equal(pixelScale(390, 800), 2);
  for (const [w, h] of [[300, 300], [2560, 1440], [1000, 500]]) {
    const s = pixelScale(w, h);
    assert.ok(Number.isInteger(s) && s >= 2);
  }
});

test('камера держит цель в центре и не заезжает за край', () => {
  const mapW = MAP_W * TILE;
  const mapH = MAP_H * TILE;
  assert.deepEqual(cameraTarget(320, 224, 200, 100, mapW, mapH), { x: 220, y: 174 });
  assert.deepEqual(cameraTarget(0, 0, 200, 100, mapW, mapH), { x: 0, y: 0 });
  assert.deepEqual(cameraTarget(mapW, mapH, 200, 100, mapW, mapH), { x: mapW - 200, y: mapH - 100 });
  // карта уже экрана: по центру
  assert.equal(cameraTarget(10, 10, mapW + 100, 100, mapW, mapH).x, -50);
});

test('камера догоняет мягко и одинаково при любой частоте кадров', () => {
  const target = { x: 100, y: 0 };
  let a = { x: 0, y: 0 };
  for (let i = 0; i < 30; i += 1) a = follow(a, target, 1 / 60);
  let b = { x: 0, y: 0 };
  for (let i = 0; i < 15; i += 1) b = follow(b, target, 1 / 30);
  // за полсекунды почти догнала, но не прыгнула
  assert.ok(a.x > 90 && a.x < 100, `x=${a.x}`);
  assert.ok(Math.abs(a.x - b.x) < 1e-6);
  assert.deepEqual(follow({ x: 0, y: 0 }, target, 1 / 60, { reducedMotion: true }), target);
});

test('выбор режима', () => {
  assert.equal(chooseMode('', 1280), 'town');
  assert.equal(chooseMode('', 390), 'cv');
  assert.equal(chooseMode('#cv', 1280), 'cv');
  assert.equal(chooseMode('#projects', 1280), 'cv');
  assert.equal(chooseMode('#town', 390), 'town');
  assert.equal(chooseMode('', TOWN_MIN_WIDTH), 'town');
  assert.equal(chooseMode('', TOWN_MIN_WIDTH - 1), 'cv');
});

test('встроенный скрипт в index.html решает так же, как chooseMode', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const hash of ['', '#cv', '#town', '#projects', '#contacts']) {
    for (const width of [390, TOWN_MIN_WIDTH - 1, TOWN_MIN_WIDTH, 1280]) {
      const el = { className: '' };
      vm.runInNewContext(code, { location: { hash }, window: { innerWidth: width }, document: { documentElement: el } });
      const town = el.className.split(' ').includes('town-first');
      assert.equal(town ? 'town' : 'cv', chooseMode(hash, width), `${hash} ${width}`);
    }
  }
});

test('на странице есть городок, кнопка в обычный режим и обратно', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const profile = JSON.parse(await readFile(new URL('data/profile.json', root), 'utf8'));
  assert.match(html, /<section id="town"/);
  assert.match(html, /<canvas id="town-canvas"[^>]*aria-label="[^"]+"/);
  assert.match(html, /href="#cv"[^>]*>Нет времени гулять\? Всё обо мне за 30 секунд</);
  assert.match(html, /href="#town"/);
  assert.match(html, /<script type="module" src="js\/town\/main.mjs">/);
  // плашка в городке не отстала от данных
  assert.ok(html.includes(`<strong>${profile.name}</strong><span>${profile.role}</span>`));
});

test('спрайты правильного размера и все цвета есть в палитрах', () => {
  const check = (rows, palette, size, name) => {
    assert.equal(rows.length, size, name);
    for (const r of rows) {
      assert.equal(r.length, size, `${name}: ${r}`);
      for (const ch of r) assert.ok(ch === '.' || ch in palette, `${name}: нет цвета ${ch}`);
    }
  };
  for (const dir of ['down', 'up', 'left', 'right']) {
    assert.equal(HERO[dir].length, 3);
    HERO[dir].forEach((f, i) => check(f, HERO_PALETTE, 16, `${dir}${i}`));
  }
  assert.deepEqual(HERO.right[1], mirror(HERO.left[1]));
  check(TREE, TREE_PALETTE, 16, 'дерево');
  for (const [id, e] of Object.entries(EMBLEMS)) {
    check(e, EMBLEM_PALETTE, 8, id);
    assert.ok(BUILDINGS.some((b) => b.id === id), `знак ${id} без здания`);
  }
});

test('кадры ходьбы', () => {
  assert.equal(walkFrame(false, 1.23), 0);
  const seen = new Set();
  for (let t = 0; t < 1; t += 0.05) seen.add(walkFrame(true, t));
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});
