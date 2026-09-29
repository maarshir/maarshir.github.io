import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  phaseAt, minutesToNextPhase, renderScene, checkSprite, SPRITES, PHASES, DEFAULT_PHASE, SCENE_W, SCENE_H,
} from '../js/scene.mjs';
import { progress, walkerTop, initialState, update, frame, TOP, BOTTOM, IDLE_MS, STEP_PX } from '../js/walker.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('время суток по часу гостя, границы включительно слева', () => {
  const expect = {
    0: 'night', 4: 'night', 5: 'morning', 9: 'morning', 10: 'day', 17: 'day',
    18: 'evening', 21: 'evening', 22: 'night', 23: 'night',
  };
  for (const [h, phase] of Object.entries(expect)) assert.equal(phaseAt(Number(h)), phase, `час ${h}`);
  assert.equal(phaseAt(24), 'night');
  assert.equal(phaseAt(-1), 'night');
  assert.equal(phaseAt(9.99), 'morning');
});

test('каждый час суток даёт одно из известных времён, и все четыре встречаются', () => {
  const seen = new Set(Array.from({ length: 24 }, (_, h) => phaseAt(h)));
  assert.deepEqual([...seen].sort(), [...PHASES].sort());
});

test('до следующей смены времени суток считается верно, в том числе через полночь', () => {
  assert.equal(minutesToNextPhase(4, 59), 1);
  assert.equal(minutesToNextPhase(5, 0), 5 * 60);
  assert.equal(minutesToNextPhase(17, 30), 30);
  assert.equal(minutesToNextPhase(22, 0), 7 * 60);
  assert.equal(minutesToNextPhase(23, 59), 5 * 60 + 1);
  // Через столько минут время суток действительно другое.
  for (let h = 0; h < 24; h += 1) {
    const m = minutesToNextPhase(h, 17);
    const t = (h * 60 + 17 + m) % (24 * 60);
    assert.notEqual(phaseAt(Math.floor(t / 60)), phaseAt(h), `с ${h}:17 через ${m} минут`);
    assert.equal(phaseAt(Math.floor((t - 1 + 24 * 60) % (24 * 60) / 60)), phaseAt(h), `за минуту до смены с ${h}:17`);
  }
});

test('спрайты сцены ровные и все цвета есть в палитре', () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    assert.doesNotThrow(() => checkSprite(rows), name);
  }
  assert.equal(checkSprite(SPRITES.ARMS0).width, checkSprite(SPRITES.ARMS1).width);
  assert.throws(() => checkSprite(['ab', 'a']));
  assert.throws(() => checkSprite(['?']));
});

test('сцена: без JavaScript день, декоративная, все пиксели внутри рамки', () => {
  const svg = renderScene();
  assert.equal(DEFAULT_PHASE, 'day');
  assert.match(svg, /^<svg class="scene" data-phase="day"/);
  assert.match(svg, /aria-hidden="true"/);
  for (const [, x, y, w, h] of svg.matchAll(/<rect[^>]* x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
    assert.ok(+x >= 0 && +y >= 0 && +x + +w <= SCENE_W && +y + +h <= SCENE_H, `пиксель вне сцены: ${x},${y}`);
  }
  for (const phase of PHASES) assert.match(renderScene(phase), new RegExp(`data-phase="${phase}"`));
  assert.throws(() => renderScene('полдень'));
});

test('сцена: тень ночи накрывает комнату, но не небо, экран и свет лампы', () => {
  const svg = renderScene();
  const shade = svg.indexOf('class="shade"');
  assert.ok(shade > 0);
  for (const cls of ['sky', 'moon', 'stars', 'screen', 'code', 'lamp-light', 'bulb']) {
    const at = svg.indexOf(`class="${cls}`);
    assert.ok(at > shade, `${cls} должен идти после тени, иначе ночью погаснет`);
  }
  for (const cls of ['arms-0', 'arms-1', 'steam']) {
    const at = svg.indexOf(cls);
    assert.ok(at > 0 && at < shade, `${cls} это часть комнаты и темнеет ночью`);
  }
});

test('стили: у каждого времени суток свой цвет неба, движение отключается при уменьшении', async () => {
  const css = await read('css/site.css');
  for (const phase of PHASES.filter((p) => p !== DEFAULT_PHASE)) {
    assert.match(css, new RegExp(`\\.scene\\[data-phase="${phase}"\\] \\.sky \\{ fill:`), phase);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.walker \{ display: none !important; \}/);
  assert.ok(css.includes('*, *::before, *::after { transition: none !important; animation: none !important; }'), 'общее правило уменьшения движения');
  assert.match(css, /\.town-first \.walker \{ display: none !important; \}/);
  // Появление карточек включает только скрипт: без класса reveal карточки видны.
  assert.match(css, /\.reveal \.cards \.card:not\(\.in\) \{ opacity: 0;/);
  assert.ok(!/(^|\n)\.cards \.card[^{]*\{[^}]*opacity: 0;/.test(css), 'карточки не должны быть скрыты без JavaScript');
});

test('главная: сцена на первом экране, скрипт живости подключён', async () => {
  const html = await read('index.html');
  const hero = html.slice(html.indexOf('<header class="hero"'), html.indexOf('</header>'));
  assert.ok(hero.includes('<svg class="scene" data-phase="day"'));
  assert.ok(html.indexOf('class="scene"') < html.indexOf('id="projects"'));
  assert.match(html, /<script type="module" src="js\/live\.mjs"><\/script>/);
});

test('персонаж у края: позиция от доли прокрутки, внутри полосы', () => {
  assert.equal(progress(0, 1000), 0);
  assert.equal(progress(500, 1000), 0.5);
  assert.equal(progress(2000, 1000), 1);
  assert.equal(progress(-50, 1000), 0);
  assert.equal(progress(100, 0), 0, 'короткая страница без прокрутки');
  const h = 900;
  assert.equal(walkerTop(0, 1000, h), Math.round(h * TOP));
  const bottom = walkerTop(1000, 1000, h, 48);
  assert.equal(bottom + 48, Math.round(h * BOTTOM));
  let prev = -1;
  for (let y = 0; y <= 1000; y += 100) {
    const top = walkerTop(y, 1000, h);
    assert.ok(top >= prev, 'идёт только вниз, пока прокрутка идёт вниз');
    prev = top;
  }
  assert.ok(walkerTop(0, 1000, 40) >= 0, 'крошечное окно');
});

test('персонаж у края: смотрит туда, куда прокручивают, шаги от пройденного пути', () => {
  let s = initialState(0);
  assert.equal(frame(s, 0), 0, 'в начале стоит');
  s = update(s, 10, 1000);
  assert.equal(s.dir, 'down');
  assert.equal(frame(s, 1000), 1);
  s = update(s, 10 + STEP_PX, 1010);
  assert.equal(frame(s, 1010), 0);
  s = update(s, 10 + STEP_PX * 2, 1020);
  assert.equal(frame(s, 1020), 2);
  assert.equal(frame(s, 1020 + IDLE_MS + 1), 0, 'остановился и встал');
  const same = update(s, s.y, 5000);
  assert.equal(same, s, 'без сдвига ничего не меняется');
  s = update(s, 0, 2000);
  assert.equal(s.dir, 'up');
  assert.equal(s.walked, 10 + STEP_PX * 2 + 10 + STEP_PX * 2);
});
