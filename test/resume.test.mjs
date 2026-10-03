import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { buildResume, buildOgCard, loadData, loadResume } from '../scripts/build.mjs';
import { sourceHashes, STAMP } from '../scripts/render-assets.mjs';
import { renderResume, validateResume, renderHead, pageDescription, shortUrl, SITE_URL, OG_IMAGE, OG_W, OG_H, RESUME_PDF } from '../js/resume.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');
const readBytes = (p) => readFile(new URL(p, root));

test('resume.html и assets/og-card.html собраны из текущих данных (иначе npm run build)', async () => {
  assert.equal(await read('resume.html'), await buildResume());
  assert.equal(await read('assets/og-card.html'), await buildOgCard());
});

test('resume.pdf и og.png сделаны из текущих HTML (иначе npm run assets)', async () => {
  const stamp = JSON.parse(await read(STAMP));
  const now = await sourceHashes();
  assert.equal(stamp.pdf, now.pdf, 'resume.pdf отстал от resume.html');
  assert.equal(stamp.og, now.og, 'assets/og.png отстал от assets/og-card.html');
});

test('resume.pdf: настоящий PDF на одну страницу', async () => {
  const pdf = await readBytes(RESUME_PDF);
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || [];
  assert.equal(pages.length, 1, 'резюме должно помещаться на одну страницу A4');
  assert.ok(pdf.length < 300_000, `PDF слишком тяжёлый: ${pdf.length} байт`);
});

test('og.png: PNG 1200×630, как ждут мессенджеры', async () => {
  const png = await readBytes(OG_IMAGE);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), OG_W);
  assert.equal(png.readUInt32BE(20), OG_H);
  assert.ok(png.length < 300_000, 'картинка превью должна быть лёгкой');
});

test('в резюме все контакты, основные проекты со ссылкой на код и адрес сайта', async () => {
  const { profile, projects } = await loadData();
  const { resume } = await loadResume();
  const html = await read('resume.html');
  for (const c of profile.contacts) assert.ok(html.includes(`href="${c.url}"`), `нет контакта ${c.label}`);
  for (const p of projects.filter((x) => x.group === 'main')) {
    assert.ok(html.includes(p.title), `нет проекта ${p.title}`);
    assert.ok(html.includes(`href="${p.code}"`), `нет ссылки на код ${p.title}`);
  }
  for (const p of resume.projects) assert.ok(html.includes(`href="${p.url}"`), `нет ссылки ${p.title}`);
  assert.ok(html.includes(`href="${SITE_URL}"`));
  for (const e of [...profile.education, ...profile.work]) assert.ok(html.includes(e.place));
});

test('в резюме фото, шрифт и QR-код на сайт, всё локальное', async () => {
  const html = await read('resume.html');
  assert.match(html, /<img src="assets\/photo\.jpg"/);
  assert.match(html, /url\('assets\/golos-text\.woff2'\)/);
  assert.match(html, /<div class="qr"><a href="https:\/\/maarshir\.github\.io\/"><svg /);
  for (const f of ['assets/photo.jpg', 'assets/golos-text.woff2', 'assets/OFL-GolosText.txt', 'fonts/tiny5.css']) await access(new URL(f, root));
});

test('проверка ловит неполные тексты резюме и длинные тире', async () => {
  const { resume } = await loadResume();
  assert.deepEqual(validateResume(resume), []);
  assert.match(validateResume({ ...resume, title: '' }).join('\n'), /resume\.title/);
  assert.match(validateResume({ ...resume, projects: [] }).join('\n'), /resume\.projects/);
  assert.match(validateResume({ ...resume, seek: 'Ищу \u2014 работу' }).join('\n'), /длинное тире/);
});

test('в резюме только разрешённые поля: ничего лишнего из profile.json не утекает', async () => {
  const { profile, projects } = await loadData();
  const { resume, assets } = await loadResume();
  const extra = { ...profile, phone: '+7 900 000-00-00', birthday: '01.01.2000' };
  const html = renderResume(extra, projects, resume, assets);
  assert.ok(!html.includes('900 000'), 'телефон попал в резюме');
  assert.ok(!html.includes('01.01.2000'), 'дата рождения попала в резюме');
  assert.ok(!html.includes(profile.now), 'строка «Сейчас» быстро устаревает и в PDF не нужна');
});

test('резюме не собирается из неполных данных', async () => {
  const { profile, projects } = await loadData();
  const { resume, assets } = await loadResume();
  assert.throws(() => renderResume({ ...profile, name: '' }, projects, resume, assets), /profile\.name/);
  assert.throws(() => renderResume(profile, projects, undefined, assets), /data\/resume\.json/);
});

test('без длинных тире и внешних подключений в резюме и превью', async () => {
  for (const file of ['resume.html', 'assets/og-card.html']) {
    const html = await read(file);
    assert.ok(!html.includes('—'), `длинное тире в ${file}`);
    assert.ok(!/<(link|script|img)[^>]+(href|src)="https?:/.test(html), `внешнее подключение в ${file}`);
  }
});

test('теги превью: заголовок, описание и абсолютный адрес картинки', async () => {
  const html = await read('index.html');
  const meta = (prop) => html.match(new RegExp(`<meta property="${prop}" content="([^"]*)">`))?.[1];
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  assert.equal(meta('og:title'), title);
  assert.equal(meta('og:url'), SITE_URL);
  assert.equal(meta('og:image'), `${SITE_URL}${OG_IMAGE}`);
  await access(new URL(OG_IMAGE, root));
  const description = html.match(/<meta name="description" content="([^"]*)">/)[1];
  assert.equal(meta('og:description'), description);
  assert.ok(description.length <= 300, 'описание длиннее, чем покажут превью');
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
});

test('описание называет основные проекты', async () => {
  const { profile, projects } = await loadData();
  const d = pageDescription(profile, projects);
  for (const p of projects.filter((x) => x.group === 'main')) assert.ok(d.includes(p.title));
  assert.ok(!projects.filter((x) => x.group === 'personal').some((p) => d.includes(p.title)));
});

test('теги превью экранируют кавычки из данных', async () => {
  const { profile, projects } = await loadData();
  const head = renderHead({ ...profile, name: 'Иван "Тест" <b>' }, projects);
  assert.ok(!head.includes('"Тест"') && !head.includes('<b>'));
});

test('кнопка «Резюме PDF» на первом экране ведёт на файл', async () => {
  const html = await read('index.html');
  const hero = html.slice(html.indexOf('<header class="hero"'), html.indexOf('</header>'));
  assert.match(hero, new RegExp(`<a class="btn" href="${RESUME_PDF}"[^>]*>Резюме PDF</a>`));
  await access(new URL(RESUME_PDF, root));
});

test('shortUrl убирает схему и косую черту в конце', () => {
  assert.equal(shortUrl('https://maarshir.github.io/'), 'maarshir.github.io');
  assert.equal(shortUrl('https://github.com/maarshir/promptdiff-'), 'github.com/maarshir/promptdiff-');
  assert.equal(shortUrl('mailto:ivan_ius@mail.ru'), 'ivan_ius@mail.ru');
});
