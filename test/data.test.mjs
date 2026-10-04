import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateData, BUILDINGS } from '../js/render.mjs';

const load = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));

test('данные сайта проходят проверку', async () => {
  const errors = validateData(await load('profile.json'), await load('projects.json'));
  assert.deepEqual(errors, []);
});

// Код открыт только у этих репозиториев. Ссылка на закрытый вела бы гостя на 404,
// поэтому у проекта с закрытым кодом code: null и на карточке нет кнопки «Код».
const OPEN_REPOS = ['promptdiff-', 'doc-answers', 'token-counter', 'gost-skills', 'content-factory'];

test('ссылки «Код» ведут только в открытые репозитории', async () => {
  for (const p of await load('projects.json')) {
    if (p.code === null) continue;
    const repo = p.code.replace('https://github.com/maarshir/', '');
    assert.ok(OPEN_REPOS.includes(repo), `${p.id}: ${p.code} не в списке открытых`);
  }
});

test('проекты и порядок как на странице профиля, закрытый ассистент без кода и без здания', async () => {
  const projects = await load('projects.json');
  const by = (g) => projects.filter((p) => p.group === g).map((p) => p.id);
  assert.deepEqual(by('main'), ['promptdiff', 'doc-answers', 'gost-skills']);
  assert.deepEqual(by('personal'), ['assistant', 'token-counter', 'content-factory']);
  const assistant = projects.find((p) => p.id === 'assistant');
  assert.equal(assistant.code, null);
  assert.equal(assistant.building, null);
});

test('здания городка заняты не больше чем одним проектом, у основных проектов здание есть', async () => {
  const projects = await load('projects.json');
  const used = projects.map((p) => p.building).filter((b) => b !== null);
  assert.equal(new Set(used).size, used.length);
  for (const b of used) assert.ok(BUILDINGS.includes(b), b);
  for (const p of projects.filter((x) => x.group === 'main')) assert.ok(p.building, p.id);
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
  broken[0].building = broken[1].building;
  broken[4].stack = [];
  const errors = validateData({ ...profile, name: ' ' }, broken);
  const text = errors.join('\n');
  assert.match(text, /profile\.name/);
  assert.match(text, /id повторяется/);
  assert.match(text, /building должен быть/);
  assert.match(text, /репозиторий maarshir/);
  assert.match(text, /уже занято/);
  assert.match(text, /список stack/);
});

test('ссылка «Попробовать» только https', async () => {
  const profile = await load('profile.json');
  const projects = await load('projects.json');
  projects[0].demo = 'javascript:alert(1)';
  assert.match(validateData(profile, projects).join('\n'), /demo/);
});

test('строки карточек одной фразой', async () => {
  const projects = await load('projects.json');
  for (const p of projects) {
    assert.match(p.line, /^[А-ЯЁA-Z].*\.$/, `${p.id}: строка с заглавной буквы и с точкой в конце`);
    assert.ok(!p.line.slice(0, -1).includes('. '), `${p.id}: строка должна быть одной фразой`);
  }
});
