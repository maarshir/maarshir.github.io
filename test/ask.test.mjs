import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stem, tokenize, buildDocs, Index, answer, createAsk, PRESETS, MAX_HITS } from '../js/ask.mjs';

const root = new URL('../', import.meta.url);
const readJson = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const profile = await readJson('data/profile.json');
const projects = await readJson('data/projects.json');
const ask = createAsk(profile, projects);
const ids = (q) => {
  const docs = buildDocs(profile, projects);
  const a = ask(q);
  return a.sources.map((title) => docs.find((d) => d.title === title).id);
};

test('стемминг сводит формы слова к одной основе', () => {
  assert.equal(stem('проекты'), stem('проектов'));
  assert.equal(stem('проекта'), stem('проект'));
  assert.equal(stem('модели'), stem('моделям'));
  assert.equal(stem('телеграме'), stem('телеграм'));
  assert.equal(stem('promptdiff'), 'promptdiff');
  assert.ok(stem('ии').length >= 2, 'короткие слова не обрезаются до пустоты');
});

test('служебные слова и знаки не участвуют в поиске', () => {
  assert.deepEqual(tokenize('Что? Где? Как?'), []);
  assert.deepEqual(tokenize('Ёлка'), tokenize('елка'));
});

test('на каждую готовую кнопку есть осмысленный ответ', () => {
  for (const p of PRESETS) {
    const a = ask(p.label);
    assert.ok(a && a.found, `нет ответа на «${p.label}»`);
    const got = ids(p.label);
    for (const id of p.expect) assert.ok(got.includes(id), `«${p.label}»: ждали ${id}, нашлось ${got.join(', ')}`);
    assert.ok(a.paragraphs.every((t) => t.trim().length > 0));
    assert.ok(a.links.length > 0, `«${p.label}»: нет ни одной ссылки`);
  }
});

test('обычные вопросы находят нужный раздел первым', () => {
  const cases = {
    'Где учился?': 'education',
    'как тебя зовут': 'about',
    'ищешь стажировку?': 'looking',
    'чем занят сейчас': 'now',
    'опыт работы': 'work',
    'знаешь Python?': 'stack',
    'есть телеграм?': 'contacts',
    'почта': 'contacts',
    'что такое promptdiff': 'promptdiff',
    'какой стек у doc-answers': 'doc-answers',
    'BM25': 'doc-answers',
    'проверка курсовой по ГОСТу': 'gost-skills',
    'личный ассистент': 'assistant',
    'сколько стоит запрос к модели': 'token-counter',
  };
  for (const [q, id] of Object.entries(cases)) assert.equal(ids(q)[0], id, q);
});

test('проект, названный по имени, отвечает один и подробно', () => {
  const a = ask('расскажи про doc-answers');
  const p = projects.find((x) => x.id === 'doc-answers');
  assert.deepEqual(a.sources, [p.title]);
  assert.ok(a.paragraphs.some((t) => t.includes(p.summary)));
  assert.ok(a.links.some((l) => l.url === p.code));
  assert.ok(a.links.some((l) => l.url === '#project-doc-answers'));
});

test('вопрос про проекты с ИИ: только проекты, основные раньше личных', () => {
  const got = ids('Покажи проекты с ИИ');
  const group = (id) => projects.find((p) => p.id === id).group;
  assert.ok(got.every((id) => projects.some((p) => p.id === id)), got.join(', '));
  assert.ok(got.includes('promptdiff') && got.includes('doc-answers'), got.join(', '));
  const firstPersonal = got.findIndex((id) => group(id) === 'personal');
  if (firstPersonal !== -1) assert.ok(got.slice(firstPersonal).every((id) => group(id) === 'personal'));
});

test('если ответа нет, так и сказано и предложен Телеграм', () => {
  for (const q of ['погода в Париже', 'какой уровень английского']) {
    const a = ask(q);
    assert.equal(a.found, false, q);
    assert.match(a.paragraphs[0], /ничего не нашлось/);
    assert.deepEqual(a.links.map((l) => l.url), ['https://t.me/kaioann']);
  }
  assert.equal(ask('   '), null);
  assert.equal(ask('?!'), null);
});

test('ответ собирается только из данных, а не из заготовок', () => {
  const fake = structuredClone(profile);
  fake.education = [{ place: 'Выдуманный вуз', what: 'Проверочная строка 12345.' }];
  fake.contacts = fake.contacts.map((c) => (c.kind === 'telegram' ? { ...c, value: '@fake', url: 'https://t.me/fake' } : c));
  const other = createAsk(fake, projects);
  assert.ok(other('Где учился?').paragraphs.join(' ').includes('Проверочная строка 12345'));
  assert.ok(!other('Где учился?').paragraphs.join(' ').includes('МИРЭА'));
  assert.ok(other('Как связаться?').paragraphs.join(' ').includes('@fake'));
  assert.equal(other('погода').links[0].url, 'https://t.me/fake');
});

test('ответ не длиннее MAX_HITS разделов и ссылки не повторяются', () => {
  const index = new Index(buildDocs(profile, projects));
  for (const q of ['боты', 'модели', 'Python JavaScript Телеграм почта учёба']) {
    const a = answer(index, q);
    assert.ok(a.sources.length <= MAX_HITS, q);
    const urls = a.links.map((l) => l.url);
    assert.equal(new Set(urls).size, urls.length, q);
  }
});

test('все ссылки ответов безопасные и якоря есть на странице', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const pageIds = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const doc of buildDocs(profile, projects)) {
    for (const l of doc.links) {
      assert.match(l.url, /^(https:\/\/|mailto:|#)/, l.url);
      if (l.url.startsWith('#')) assert.ok(pageIds.has(l.url.slice(1)), `нет id ${l.url}`);
    }
  }
});

test('окно чата на странице: кнопки из PRESETS, поле, честная подпись', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /<script type="module" src="js\/chat\.mjs"><\/script>/);
  for (const p of PRESETS) assert.ok(html.includes(`data-q="${p.label}"`), p.label);
  assert.match(html, /id="ask-input"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /не нейросеть, а поиск по тексту этой страницы/);
  assert.match(html, /github\.com\/maarshir\/doc-answers/);
});

test('у проекта с закрытым кодом в ответе нет ссылки «Код»', () => {
  const a = ask('расскажи про ассистента');
  assert.deepEqual(a.sources, ['Ассистент']);
  assert.ok(a.links.some((l) => l.url === '#project-assistant'));
  assert.ok(!a.links.some((l) => l.label === 'Код'));
});
