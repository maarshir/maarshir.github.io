import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { buildIndex, buildFavicon } from '../scripts/build.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('index.html собран из текущих данных (иначе запустить npm run build)', async () => {
  assert.equal(await read('index.html'), await buildIndex());
});

test('favicon.svg собран из текущего аватара', async () => {
  assert.equal(await read('favicon.svg'), buildFavicon());
});

test('все локальные ссылки и файлы из index.html существуют', async () => {
  const html = await read('index.html');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((r) => !/^(https:|mailto:|#)/.test(r));
  assert.ok(local.length >= 3);
  for (const ref of local) {
    await assert.doesNotReject(access(new URL(ref, root)), `нет файла ${ref}`);
  }
});

test('якоря на странице ведут на существующие id', async () => {
  const html = await read('index.html');
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(ids.has('cv'), 'прямая ссылка /#cv должна работать');
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(anchor), `нет id ${anchor}`);
});

test('внешние ссылки только https и только на ожидаемые адреса', async () => {
  const html = await read('index.html');
  for (const [, url] of html.matchAll(/href="(http[^"]*)"/g)) {
    assert.match(url, /^https:\/\/(github\.com\/maarshir|t\.me\/kaioann)/, url);
  }
});

test('шрифт встроен в css, внешних подключений нет', async () => {
  const css = await read('fonts/tiny5.css');
  assert.match(css, /font-family:'Tiny5'/);
  assert.ok(!/url\((?!data:)/.test(css), 'в шрифте ссылка на внешний файл');
  const html = await read('index.html');
  assert.ok(!/<(link|script)[^>]+(href|src)="https?:/.test(html), 'подключение с внешнего сервера');
  await access(new URL('fonts/OFL-Tiny5.txt', root));
});
