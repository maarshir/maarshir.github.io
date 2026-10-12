// Доступность главной с клавиатуры и для читалки экрана, по собранному index.html и стилям.
// Без браузера: страница статическая, правила проверяются по разметке и CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const hasAttr = (tag, name) => new RegExp(`\\s${name}(?:[\\s>=]|$)`).test(tag);
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Блок от «@media ... {» до парной скобки.
function mediaBlocks(css, query) {
  const blocks = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(`@media ${query} {`, from);
    if (start < 0) return blocks;
    let depth = 0;
    let i = css.indexOf('{', start);
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}' && --depth === 0) break;
    }
    blocks.push(css.slice(start, i + 1));
    from = i + 1;
  }
}

// Правила вида «селекторы { свойства }» без комментариев и без стилей печати.
function rules(css) {
  let clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of mediaBlocks(clean, 'print')) clean = clean.replace(block, '');
  return [...clean.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
    selectors: sel.split(',').map((s) => s.trim()).filter(Boolean),
    body,
  }));
}

const page = await read('index.html');
const css = { site: await read('css/site.css'), town: await read('css/town.css') };
const allRules = [...rules(css.site), ...rules(css.town)];
const selectors = new Set(allRules.flatMap((r) => r.selectors));

test('язык страницы указан', () => {
  assert.match(page, /<html lang="ru">/);
});

test('у каждой картинки есть alt (у декоративной пустой)', async () => {
  for (const file of ['index.html', 'resume.html']) {
    const html = await read(file);
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
      assert.ok(attr(tag, 'alt') !== undefined, `${file}: нет alt в ${tag}`);
    }
  }
});

test('рисунки в SVG либо скрыты от читалки, либо подписаны', () => {
  const svgs = [...page.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(svgs.length >= 3);
  for (const tag of svgs) {
    const hidden = attr(tag, 'aria-hidden') === 'true';
    const labelled = attr(tag, 'role') === 'img' && Boolean(attr(tag, 'aria-label'));
    assert.ok(hidden || labelled, `SVG без aria-hidden и без подписи: ${tag}`);
  }
});

test('у кнопок и ссылок есть имя', async () => {
  const main = await read('js/town/main.mjs');
  for (const [, tag, inner] of page.matchAll(/(<button\b[^>]*>)([\s\S]*?)<\/button>/g)) {
    if (hasAttr(tag, 'hidden') && attr(tag, 'class') === 'town-hint') {
      // Подсказка у двери пустая, пока скрыта: текст ей ставит городок перед показом.
      assert.match(main, /hintEl\.textContent = /);
      continue;
    }
    assert.ok(attr(tag, 'aria-label') || text(inner), `кнопка без имени: ${tag}`);
  }
  const links = [...page.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/g)];
  assert.ok(links.length >= 10);
  for (const [, tag, inner] of links) {
    assert.ok(attr(tag, 'aria-label') || text(inner), `ссылка без имени: ${tag}`);
  }
});

test('у полей ввода есть подпись, включая «Спросите моё резюме»', () => {
  const fields = [...page.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)].map((m) => m[0])
    .filter((tag) => !/type="(hidden|submit|button)"/.test(tag));
  assert.ok(fields.some((tag) => attr(tag, 'id') === 'ask-input'), 'нет поля вопроса');
  for (const tag of fields) {
    const id = attr(tag, 'id');
    const label = id && new RegExp(`<label\\b[^>]*for="${id}"[^>]*>([\\s\\S]*?)</label>`).exec(page);
    assert.ok(attr(tag, 'aria-label') || attr(tag, 'aria-labelledby') || (label && text(label[1])), `поле без подписи: ${tag}`);
  }
});

test('элементы с tabindex="0" без своей роли подписаны', () => {
  for (const [tag] of page.matchAll(/<(?!a\b|button\b|input\b)\w+\b[^>]*tabindex="0"[^>]*>/g)) {
    assert.ok(attr(tag, 'aria-label'), `фокусируемый элемент без подписи: ${tag}`);
  }
});

test('aria-labelledby ссылается на существующие id', () => {
  const ids = new Set([...page.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, ref] of page.matchAll(/aria-labelledby="([^"]+)"/g)) {
    for (const id of ref.split(/\s+/)) assert.ok(ids.has(id), `нет id ${id}`);
  }
});

test('заголовки идут по уровням без пропусков, h1 один', () => {
  const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
  const heads = [...main.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(([, lvl, inner]) => ({ lvl: Number(lvl), name: text(inner) }));
  assert.ok(heads.length >= 6);
  assert.equal(heads[0].lvl, 1, 'первый заголовок главной должен быть h1');
  assert.equal([...page.matchAll(/<h1\b/g)].length, 1, 'на странице больше одного h1');
  for (let i = 1; i < heads.length; i++) {
    assert.ok(heads[i].lvl <= heads[i - 1].lvl + 1, `после h${heads[i - 1].lvl} «${heads[i - 1].name}» сразу h${heads[i].lvl} «${heads[i].name}»`);
  }
  for (const h of heads) assert.ok(h.name, `пустой заголовок h${h.lvl}`);
});

test('рамка фокуса видна у всего, что получает фокус с клавиатуры', () => {
  const global = allRules.find((r) => r.selectors.includes(':focus-visible'));
  assert.ok(global, 'нет общего правила :focus-visible');
  assert.match(global.body, /outline:\s*var\(--px\) solid var\(--focus\)/);
  // Где рамку убирают при фокусе мышью, при фокусе с клавиатуры она должна вернуться.
  for (const rule of allRules) {
    if (!/outline:\s*(none|0)\b/.test(rule.body)) continue;
    for (const sel of rule.selectors) {
      const base = sel.replace(/:focus(-visible)?$/, '');
      const back = allRules.find((r) => r.selectors.includes(`${base}:focus-visible`) && /outline:\s*(?!none|0\b)/.test(r.body));
      assert.ok(back, `${sel} убирает рамку, а ${base}:focus-visible её не возвращает`);
    }
  }
});

test('у кнопок, ссылок и раскрывашек фокус с клавиатуры выглядит как наведение', () => {
  const hovers = [...selectors].filter((s) => s.endsWith(':hover'));
  assert.ok(hovers.length >= 5);
  for (const sel of hovers) {
    const base = sel.slice(0, -':hover'.length);
    assert.ok(selectors.has(`${base}:focus-visible`) || selectors.has(`${base}:focus-within`), `у ${sel} нет пары ${base}:focus-visible`);
  }
});

test('prefers-reduced-motion отключает анимации и плавную прокрутку', () => {
  assert.match(page, /<link rel="stylesheet" href="css\/site\.css">/);
  const [block] = mediaBlocks(css.site, '(prefers-reduced-motion: reduce)');
  assert.ok(block, 'в site.css нет блока prefers-reduced-motion');
  assert.match(block, /html \{ scroll-behavior: auto; \}/);
  assert.match(block, /\*, \*::before, \*::after \{[^}]*transition: none !important;[^}]*\}/);
  assert.match(block, /\*, \*::before, \*::after \{[^}]*animation: none !important;[^}]*\}/);
  // Без анимации в сцене виден один кадр рук, а не оба сразу.
  assert.match(css.site, /\.scene \.arms-1 \{ visibility: hidden; \}/);
});

test('печатная машинка и камера городка слушаются prefers-reduced-motion', async () => {
  const media = /const reduced = window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\);/;
  const chat = await read('js/chat.mjs');
  const town = await read('js/town/main.mjs');
  for (const [name, src] of [['js/chat.mjs', chat], ['js/town/main.mjs', town]]) {
    assert.match(src, media, name);
    for (const [call] of src.matchAll(/typedCounts\([^;]*\)/g)) {
      assert.match(call, /reducedMotion: reduced\.matches/, `${name}: ${call}`);
    }
  }
  assert.match(town, /follow\([^)]*reducedMotion: reduced\.matches/);
  const live = await read('js/live.mjs');
  assert.match(live, media);
});
