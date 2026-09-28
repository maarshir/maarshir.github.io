import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeUrl, renderCv, injectCv, START, END, CARD_TAGS, LINE_MAX } from '../js/render.mjs';
import { AVATAR, AVATAR_PALETTE, spriteToSvg } from '../js/avatar.mjs';

const profile = {
  name: 'Тест <b>', role: 'Роль', direction: 'Куда', lookingFor: 'Ищу', now: 'Сейчас',
  about: ['Абзац & ещё'],
  contacts: [
    { kind: 'telegram', label: 'Телеграм', value: '@t', url: 'https://t.me/t' },
    { kind: 'email', label: 'Почта', value: 'a@b.c', url: 'mailto:a@b.c' },
    { kind: 'github', label: 'Гитхаб', value: 'g', url: 'https://github.com/g' },
  ],
  education: [{ place: 'Вуз', what: 'Учусь' }],
  work: [{ place: 'Фриланс', what: 'Делаю' }],
  stack: [{ group: 'Питон', items: ['Python'] }],
};
const project = {
  id: 'demo', title: '"Кавычки"', group: 'main', line: 'Строка <i>', building: 'Арена', summary: '<script>alert(1)</script>',
  points: ['Пункт'], stack: ['JS'], code: 'https://github.com/maarshir/demo', demo: null,
};

test('escapeHtml экранирует всё опасное', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('safeUrl пропускает только https и mailto', () => {
  assert.equal(safeUrl('https://t.me/kaioann'), 'https://t.me/kaioann');
  assert.equal(safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
  for (const bad of ['http://x', 'javascript:alert(1)', '//evil', 'data:text/html,1']) {
    assert.throws(() => safeUrl(bad));
  }
});

test('renderCv экранирует данные и собирает все разделы', () => {
  const html = renderCv(profile, [project]);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Тест &lt;b&gt;'));
  assert.ok(html.includes('&quot;Кавычки&quot;'));
  assert.ok(html.includes('Строка &lt;i&gt;'));
  for (const id of ['top', 'about', 'projects', 'now', 'education', 'work', 'stack', 'contacts', 'project-demo']) {
    assert.ok(html.includes(`id="${id}"`), `нет раздела ${id}`);
  }
  assert.ok(!html.includes('Попробовать'), 'без demo кнопки быть не должно');
  const withDemo = renderCv(profile, [{ ...project, demo: 'https://example.com' }]);
  assert.ok(withDemo.includes('Попробовать'));
});

test('первый экран: имя, фраза и кнопки Проекты, Телеграм, Гитхаб', () => {
  const html = renderCv(profile, [project]);
  const hero = html.slice(0, html.indexOf('</header>'));
  assert.match(hero, /<h1>Тест &lt;b&gt;<\/h1>/);
  assert.match(hero, /href="#projects"[^>]*>Проекты</);
  assert.match(hero, /href="https:\/\/t\.me\/t"[^>]*>Написать в Телеграм</);
  assert.match(hero, /href="https:\/\/github\.com\/g"[^>]*>Гитхаб</);
});

test('проекты в двух разделах, основные раньше личных, личных нет без проектов', () => {
  const mine = { ...project, id: 'mine', group: 'personal', building: 'Мастерская' };
  const html = renderCv(profile, [mine, project]);
  const main = html.indexOf('id="projects"');
  const personal = html.indexOf('id="personal"');
  assert.ok(main > 0 && personal > main, 'сначала Проекты, потом Личные проекты');
  assert.ok(html.indexOf('id="project-demo"') < personal);
  assert.ok(html.indexOf('id="project-mine"') > personal);
  assert.ok(!renderCv(profile, [project]).includes('id="personal"'));
});

test('на карточке не больше трёх меток, подробности свёрнуты', () => {
  const html = renderCv(profile, [{ ...project, stack: ['A', 'B', 'C', 'D', 'E'] }]);
  const card = html.slice(html.indexOf('id="project-demo"'), html.indexOf('</article>'));
  const tags = card.slice(card.indexOf('class="tags"'), card.indexOf('</ul>'));
  assert.equal((tags.match(/<li>/g) || []).length, CARD_TAGS);
  assert.match(card, /<details class="more"><summary>Подробнее<\/summary>/);
});

test('проверка данных: group, line и контакты для кнопок', () => {
  const bad = (p, pr = profile) => { assert.throws(() => renderCv(pr, [p]), /Ошибки в данных/); };
  bad({ ...project, group: 'other' });
  bad({ ...project, line: '' });
  bad({ ...project, line: 'x'.repeat(LINE_MAX + 1) });
  bad({ ...project, group: 'personal' });
  bad(project, { ...profile, contacts: profile.contacts.filter((c) => c.kind !== 'telegram') });
});

test('renderCv отказывается собирать страницу из битых данных', () => {
  assert.throws(() => renderCv(profile, [{ ...project, code: 'https://evil' }]), /Ошибки в данных/);
});

test('внешние ссылки открываются в новой вкладке без доступа к opener', () => {
  const html = renderCv(profile, [project]);
  const external = html.match(/<a [^>]*href="https:[^>]*>/g);
  assert.ok(external.length > 0);
  for (const a of external) assert.ok(a.includes('rel="noopener"'), a);
});

test('injectCv заменяет только содержимое между метками и не копит повторы', () => {
  const page = `до\n${START}\nстарое\n${END}\nпосле`;
  const once = injectCv(page, 'новое');
  assert.equal(once, `до\n${START}\nновое\n${END}\nпосле`);
  assert.equal(injectCv(once, 'новое'), once);
  assert.throws(() => injectCv('без меток', 'x'), /меток/);
});

test('аватар: все ряды одной длины, у каждой буквы есть цвет', () => {
  for (const row of AVATAR) assert.equal(row.length, AVATAR[0].length);
  const used = new Set(AVATAR.join('').replace(/\./g, ''));
  for (const ch of used) assert.ok(AVATAR_PALETTE[ch], `нет цвета для ${ch}`);
});

test('spriteToSvg склеивает соседние пиксели и ругается на неизвестный цвет', () => {
  const svg = spriteToSvg(['aab.', '....'], { a: '#111', b: '#222' });
  assert.match(svg, /<rect x="0" y="0" width="2" height="1" fill="#111"\/>/);
  assert.match(svg, /<rect x="2" y="0" width="1" height="1" fill="#222"\/>/);
  assert.equal((svg.match(/<rect/g) || []).length, 2);
  assert.throws(() => spriteToSvg(['z'], {}), /Нет цвета/);
});
