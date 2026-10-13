// Контраст текста в светлой и тёмной теме и порядок переходов по Tab.
// Цвета берутся из переменных :root в css/site.css, пары текст/фон перечислены ниже.
// Порог WCAG 2.1 AA: обычный текст 4.5:1, крупный (от 24px или от 18.66px жирным) и рамка фокуса 3:1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const site = (await read('css/site.css')).replace(/\/\*[\s\S]*?\*\//g, '');
const town = (await read('css/town.css')).replace(/\/\*[\s\S]*?\*\//g, '');

const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v.toLowerCase()]));
const light = vars(site.match(/:root\s*\{([^}]*)\}/)[1]);
const darkBlock = site.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
const dark = { ...light, ...vars(darkBlock[1]) };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Значение: имя переменной или цвет как есть.
const color = (theme, v) => (v.startsWith('#') ? v : theme[v]);

// [что, текст, фон, порог]
const pairs = [
  ['основной текст на странице', 'ink', 'paper', 4.5],
  ['основной текст в карточке', 'ink', 'panel', 4.5],
  ['подписи на странице', 'muted', 'paper', 4.5],
  ['подписи в карточке', 'muted', 'panel', 4.5],
  ['ссылка при наведении на странице', 'roof', 'paper', 4.5],
  ['ссылка при наведении в карточке', 'roof', 'panel', 4.5],
  ['кнопки и «К проектам» на золотом', '#2b2139', 'gold', 4.5],
  ['подпись места в окне городка', 'roof', 'panel', 4.5],
  ['должность в шапке (крупный текст)', 'roof', 'paper', 3],
];

for (const [name, theme] of [['светлая', light], ['тёмная', dark]]) {
  test(`контраст текста: ${name} тема`, () => {
    for (const [what, fg, bg, min] of pairs) {
      const ratio = contrast(color(theme, fg), color(theme, bg));
      assert.ok(ratio >= min, `${what}: ${ratio.toFixed(2)} < ${min}`);
    }
  });

  test(`рамка фокуса видна: ${name} тема`, () => {
    for (const bg of ['paper', 'panel']) {
      const ratio = contrast(theme.focus, theme[bg]);
      assert.ok(ratio >= 3, `рамка на ${bg}: ${ratio.toFixed(2)} < 3`);
    }
  });
}

test('главная кнопка: светлый текст в светлой теме, тёмный в тёмной', () => {
  assert.ok(contrast('#fffaf0', light.roof) >= 4.5);
  assert.match(site, /\.btn-main\s*\{[^}]*color:\s*#fffaf0/);
  assert.match(darkBlock.input.slice(darkBlock.index + darkBlock[0].length), /\.btn-main[^{]*\{\s*color:\s*#2b2139/);
  assert.ok(contrast('#2b2139', dark.roof) >= 4.5);
});

test('заголовки разделов (крупный текст) читаются на своей плашке', () => {
  assert.ok(contrast('#fffaf0', light['grass-dark']) >= 3);
  assert.ok(contrast('#2b2139', dark['grass-dark']) >= 3);
});

test('рамка фокуса в городке видна на зелёном фоне', () => {
  const focus = town.match(/\.town\s*\{\s*--focus:\s*(#[0-9a-f]{6})/i)?.[1];
  const ground = town.match(/\.town-first \.town\s*\{[^}]*background:\s*(#[0-9a-f]{6})/i)?.[1];
  assert.ok(focus && ground, 'в town.css нет --focus для .town или цвета фона');
  assert.ok(contrast(focus, ground) >= 3);
});

test('нет tabindex больше 0: порядок Tab совпадает с порядком на странице', async () => {
  const files = ['index.html', 'resume.html'];
  for (const dir of ['js', 'js/town']) {
    for (const f of await readdir(new URL(dir, root))) if (f.endsWith('.mjs')) files.push(`${dir}/${f}`);
  }
  for (const file of files) {
    const src = await read(file);
    for (const [m, n] of src.matchAll(/tabindex\s*=\s*["']?(-?\d+)/gi)) {
      assert.ok(Number(n) <= 0, `${file}: ${m}`);
    }
    for (const [m, n] of src.matchAll(/tabIndex\s*=\s*(-?\d+)/g)) {
      assert.ok(Number(n) <= 0, `${file}: ${m}`);
    }
  }
});

test('первая ссылка на странице ведёт к содержимому', async () => {
  const page = await read('index.html');
  const body = page.slice(page.indexOf('<body'));
  const first = body.match(/<(a|button|input|textarea|select|summary|canvas)\b[^>]*>/)[0];
  assert.match(first, /class="skip"/, `первым стоит ${first}`);
  const target = first.match(/href="#([^"]+)"/)[1];
  assert.match(page, new RegExp(`id="${target}"`));
});
