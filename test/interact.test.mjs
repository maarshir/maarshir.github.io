import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUILDINGS, frontTile, SPAWN } from '../js/town/map.mjs';
import { tileFeet } from '../js/town/physics.mjs';
import {
  NEAR_PX, nearbyBuilding, hintAnchor, hintText, dialogFor, typedCounts, typingDone, typingDuration,
} from '../js/town/interact.mjs';

const root = new URL('../', import.meta.url);
const profile = JSON.parse(await readFile(new URL('data/profile.json', root), 'utf8'));
const projects = JSON.parse(await readFile(new URL('data/projects.json', root), 'utf8'));
const byId = (id) => BUILDINGS.find((b) => b.id === id);

test('у двери каждого здания подсказка именно про него', () => {
  for (const b of BUILDINGS) {
    const f = frontTile(b);
    const spot = tileFeet(f.tx, f.ty);
    assert.equal(nearbyBuilding(spot.x, spot.y), b, b.name);
    // чуть в стороне тоже считается, но не дальше порога
    assert.equal(nearbyBuilding(spot.x + NEAR_PX - 1, spot.y), b, `${b.name} сбоку`);
    assert.notEqual(nearbyBuilding(spot.x + NEAR_PX + 1, spot.y), b, `${b.name} далеко`);
  }
});

test('на точке появления и посреди площади подсказки нет', () => {
  const s = tileFeet(SPAWN.tx, SPAWN.ty);
  assert.equal(nearbyBuilding(s.x, s.y), null);
  const p = tileFeet(22, 16);
  assert.equal(nearbyBuilding(p.x, p.y), null);
});

test('зоны подсказок у разных дверей не пересекаются', () => {
  const spots = BUILDINGS.map((b) => { const f = frontTile(b); return tileFeet(f.tx, f.ty); });
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      const d = Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y);
      assert.ok(d > 2 * NEAR_PX, `${BUILDINGS[i].name} и ${BUILDINGS[j].name}`);
    }
  }
});

test('из двух близких дверей выбирается ближняя', () => {
  const a = { id: 'a', name: 'A', kind: 'home', x: 0, y: 0, w: 1, h: 1, door: 0 };
  const b = { id: 'b', name: 'B', kind: 'home', x: 1, y: 0, w: 1, h: 1, door: 1 };
  const fa = tileFeet(0, 1);
  assert.equal(nearbyBuilding(fa.x + 7, fa.y, [a, b]), a);
  assert.equal(nearbyBuilding(fa.x + 9, fa.y, [a, b]), b);
});

test('подсказка стоит над дверью и говорит, что нажать', () => {
  const arena = byId('arena');
  const a = hintAnchor(arena);
  assert.equal(a.x, arena.door * 16 + 8);
  assert.equal(a.y, (arena.y + arena.h - 1) * 16);
  assert.match(hintText(arena), /^Арена: Enter/);
  assert.match(hintText(byId('board')), /читать/);
});

test('окно проекта собрано из data/projects.json', () => {
  for (const p of projects.filter((x) => x.building)) {
    const b = BUILDINGS.find((item) => item.name === p.building);
    const d = dialogFor(b, profile, projects);
    assert.equal(d.title, p.title);
    assert.equal(d.place, b.name);
    assert.deepEqual(d.paragraphs, [p.summary]);
    assert.deepEqual(d.points, p.points);
    assert.deepEqual(d.tags, p.stack);
    assert.equal(d.links[0].label, 'Код на Гитхабе');
    assert.equal(d.links[0].url, p.code);
    assert.equal(d.links.length, p.demo ? 2 : 1);
  }
});

test('здание без проекта: «пусто» и путь к проектам, а не «данные не загрузились»', () => {
  const garden = byId('garden');
  assert.ok(!projects.some((p) => p.building === garden.name), 'тест рассчитан на пустой Сад желаний');
  const d = dialogFor(garden, profile, projects);
  assert.ok(!d.missing);
  assert.match(d.paragraphs[0], /пусто/);
  assert.deepEqual(d.links, [{ label: 'К проектам', url: '#projects', external: false }]);
});

test('у проекта с закрытым кодом в окне нет ссылки на Гитхаб', () => {
  const closed = projects.map((p) => (p.id === 'gost-skills' ? { ...p, code: null } : p));
  const b = BUILDINGS.find((item) => item.name === 'Мастерская');
  assert.deepEqual(dialogFor(b, profile, closed).links, []);
});

test('кнопка «Попробовать» только если есть demo', () => {
  const withDemo = projects.map((p) => (p.id === 'token-counter' ? { ...p, demo: 'https://example.org/app' } : p));
  const d = dialogFor(byId('counting'), profile, withDemo);
  assert.deepEqual(d.links.map((l) => l.label), ['Код на Гитхабе', 'Попробовать']);
  assert.equal(d.links[1].url, 'https://example.org/app');
});

test('Дом, Почта и доска берут тексты из data/profile.json', () => {
  const home = dialogFor(byId('home'), profile, projects);
  assert.equal(home.title, profile.name);
  for (const t of [profile.direction, profile.lookingFor, profile.about[0]]) assert.ok(home.paragraphs.includes(t));
  assert.ok(home.links.some((l) => l.url === '#cv'), 'из Дома есть путь на главную');

  const post = dialogFor(byId('post'), profile, projects);
  assert.deepEqual(post.links.map((l) => l.url), profile.contacts.map((c) => c.url));
  for (const c of profile.contacts) assert.ok(post.points.some((line) => line.includes(c.value)));

  const board = dialogFor(byId('board'), profile, projects);
  assert.deepEqual(board.paragraphs, [profile.now]);
});

test('у каждого здания непустое окно с безопасными ссылками', () => {
  for (const b of BUILDINGS) {
    const d = dialogFor(b, profile, projects);
    assert.ok(d.title && d.place, b.name);
    assert.ok(d.paragraphs.length > 0 && d.paragraphs.every((t) => typeof t === 'string' && t.length > 0), b.name);
    assert.ok(!d.missing, b.name);
    for (const l of d.links) {
      assert.match(l.url, /^(https:\/\/|mailto:|#[a-z]+$)/, `${b.name}: ${l.url}`);
      assert.equal(l.external, l.url.startsWith('https://'), `${b.name}: ${l.url}`);
    }
  }
});

test('если данные не загрузились, окно ведёт на главную', () => {
  for (const b of BUILDINGS) {
    const d = dialogFor(b, null, null);
    if (b.kind === 'well') continue;
    assert.ok(d.missing, b.name);
    assert.deepEqual(d.links, [{ label: 'На главную', url: '#cv', external: false }]);
  }
});

test('печатная машинка: абзацы по очереди', () => {
  const paras = ['абв', 'где'];
  assert.deepEqual(typedCounts(paras, 0, { cps: 10 }), [0, 0]);
  assert.deepEqual(typedCounts(paras, 0.2, { cps: 10 }), [2, 0]);
  assert.deepEqual(typedCounts(paras, 0.4, { cps: 10 }), [3, 1]);
  assert.deepEqual(typedCounts(paras, 10, { cps: 10 }), [3, 3]);
  assert.equal(typingDone(paras, [3, 1]), false);
  assert.equal(typingDone(paras, [3, 3]), true);
  assert.deepEqual(typedCounts(paras, -1, { cps: 10 }), [0, 0]);
});

test('печатная машинка: при уменьшении движения весь текст сразу', () => {
  const paras = ['длинный абзац', 'второй'];
  assert.deepEqual(typedCounts(paras, 0, { reducedMotion: true }), [13, 6]);
});

test('пропуск печати: за typingDuration текст напечатан целиком', () => {
  const paras = ['раз два три', 'четыре'];
  const counts = typedCounts(paras, typingDuration(paras) + 0.001);
  assert.ok(typingDone(paras, counts));
});

test('на странице есть окно диалога и подсказка', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /id="town-dialog"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="town-dialog-title"/);
  assert.match(html, /id="town-dialog-title"/);
  assert.match(html, /class="town-hint"/);
  assert.match(html, /id="town-live" aria-live="polite"/);
});
