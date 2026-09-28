import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateData, BUILDINGS } from '../js/render.mjs';

const load = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));

test('данные сайта проходят проверку', async () => {
  const errors = validateData(await load('profile.json'), await load('projects.json'));
  assert.deepEqual(errors, []);
});

test('у каждого здания городка есть проект', async () => {
  const projects = await load('projects.json');
  assert.deepEqual(projects.map((p) => p.building).sort(), [...BUILDINGS].sort());
});

test('в текстах нет длинных тире и слов из рекламных буклетов', async () => {
  const raw = (await readFile(new URL('../data/profile.json', import.meta.url), 'utf8'))
    + (await readFile(new URL('../data/projects.json', import.meta.url), 'utf8'));
  assert.ok(!raw.includes('—'), 'длинное тире в данных');
  for (const word of ['революцион', 'инновацион', 'мощн']) {
    assert.ok(!raw.toLowerCase().includes(word), `слово «${word}...» в данных`);
  }
});

test('проверка ловит типичные ошибки в данных', async () => {
  const profile = await load('profile.json');
  const projects = await load('projects.json');
  const broken = structuredClone(projects);
  broken[1].id = broken[0].id;
  broken[2].building = 'Замок';
  broken[3].code = 'https://example.com/x';
  broken[4].stack = [];
  const errors = validateData({ ...profile, name: ' ' }, broken);
  const text = errors.join('\n');
  assert.match(text, /profile\.name/);
  assert.match(text, /id повторяется/);
  assert.match(text, /building должен быть/);
  assert.match(text, /репозиторий maarshir/);
  assert.match(text, /список stack/);
});

test('ссылка «Попробовать» только https', async () => {
  const profile = await load('profile.json');
  const projects = await load('projects.json');
  projects[0].demo = 'javascript:alert(1)';
  assert.match(validateData(profile, projects).join('\n'), /demo/);
});

test('на главной сначала инструменты для других, строки карточек одной фразой', async () => {
  const projects = await load('projects.json');
  const main = projects.filter((p) => p.group === 'main').map((p) => p.id);
  assert.deepEqual(main, ['promptdiff', 'doc-answers']);
  for (const p of projects) {
    assert.match(p.line, /^[А-ЯЁA-Z].*\.$/, `${p.id}: строка с заглавной буквы и с точкой в конце`);
    assert.ok(!p.line.slice(0, -1).includes('. '), `${p.id}: строка должна быть одной фразой`);
  }
});
