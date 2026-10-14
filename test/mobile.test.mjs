// Телефон и вес главной: нет прокрутки вбок на ширине 360px, картинки не сдвигают раскладку,
// скрипты не задерживают отрисовку, а index.html со своими CSS и JS не разрастается незаметно.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');
const html = await read('index.html');

// Общий вес index.html, CSS и JS главной на 14.10.2026 был 167 172 байта, порог на 20% выше.
// Если страница выросла по делу, поднять порог осознанно.
const WEIGHT_LIMIT = 200_606;
const PHONE = 360;

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}(?:\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+))?`, 'i'));
const value = (tag, name) => attr(tag, name)?.[1]?.replace(/^["']|["']$/g, '');

const stylesheets = [...html.matchAll(/<link\b[^>]*>/gi)].map(([t]) => t)
  .filter((t) => value(t, 'rel') === 'stylesheet').map((t) => value(t, 'href'));
const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

// Убирает комментарии и блоки @media, оставляя правила, которые действуют на любой ширине.
function outsideMedia(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at === -1) { out += css.slice(i); break; }
    out += css.slice(i, at);
    let j = css.indexOf('{', at);
    let depth = 1;
    while (depth && ++j < css.length) depth += css[j] === '{' ? 1 : css[j] === '}' ? -1 : 0;
    i = j + 1;
  }
  return out;
}

const toPx = (n, unit) => Number(n) * (unit === 'px' ? 1 : 16);

test('в CSS вне медиазапросов нет ширины больше экрана телефона', async () => {
  for (const href of stylesheets) {
    const css = outsideMedia(await read(href));
    for (const [, prop, n, unit] of css.matchAll(/(?<![\w-])(width|min-width)\s*:\s*([\d.]+)(px|rem|em)\s*[;}!]/g)) {
      assert.ok(toPx(n, unit) <= PHONE, `${href}: ${prop}: ${n}${unit} шире ${PHONE}px`);
    }
  }
});

test('длинные ссылки и строки кода переносятся', async () => {
  const css = outsideMedia(await read('css/site.css'));
  const body = css.match(/(?:^|})\s*body\s*\{([^}]*)\}/);
  assert.ok(body && /overflow-wrap:\s*(break-word|anywhere)/.test(body[1]), 'у body нет overflow-wrap');
  const rule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .find(([, sel, decl]) => /overflow-wrap:\s*anywhere/.test(decl) && sel.split(',').map((s) => s.trim()).includes('a'));
  assert.ok(rule, 'у ссылок нет overflow-wrap: anywhere');
  assert.ok(rule[1].split(',').map((s) => s.trim()).includes('code'), 'у code нет overflow-wrap: anywhere');
});

test('у картинок есть размеры, ниже первого экрана они грузятся лениво', () => {
  const firstScreenEnd = html.indexOf('</header>', html.indexOf('class="hero"'));
  assert.ok(firstScreenEnd > 0, 'не найден конец первого экрана');
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    assert.ok(attr(tag, 'width') && attr(tag, 'height'), `нет width или height: ${tag}`);
    if (m.index > firstScreenEnd) assert.equal(value(tag, 'loading'), 'lazy', `нет loading="lazy": ${tag}`);
  }
});

test('скрипты не задерживают отрисовку', () => {
  assert.ok(scriptTags.length > 0);
  for (const [, attrs, body] of scriptTags) {
    const tag = `<script${attrs}>`;
    if (attr(tag, 'src')) {
      assert.ok(value(tag, 'type') === 'module' || attr(tag, 'defer'), `нет defer или type="module": ${tag}`);
    } else {
      // Встроенный скрипт без src выполняется сразу, поэтому только короткий.
      assert.ok(Buffer.byteLength(body) < 600, `встроенный скрипт длиннее 600 байт: ${body.slice(0, 60)}`);
    }
  }
});

// Модули, которые загрузит страница: точки входа из index.html и всё, что они импортируют.
async function moduleGraph(entries) {
  const seen = new Set();
  const queue = entries.map((p) => new URL(p, root).href);
  while (queue.length) {
    const href = queue.shift();
    if (seen.has(href)) continue;
    seen.add(href);
    const code = await readFile(new URL(href), 'utf8');
    for (const [, spec] of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      queue.push(new URL(spec, href).href);
    }
  }
  return [...seen].map((h) => new URL(h));
}

test('вес index.html, CSS и JS главной не больше порога', async () => {
  const entries = scriptTags.map(([, attrs]) => value(`<script${attrs}>`, 'src')).filter(Boolean);
  const modules = await moduleGraph(entries);
  assert.ok(modules.length > entries.length, 'импорты модулей не найдены');
  const files = [new URL('index.html', root), ...stylesheets.map((h) => new URL(h, root)), ...modules];
  let total = 0;
  for (const f of files) total += (await stat(f)).size;
  assert.ok(total <= WEIGHT_LIMIT, `страница весит ${total} байт, порог ${WEIGHT_LIMIT}`);
});
