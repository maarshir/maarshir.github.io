// Резюме на одну страницу A4, картинка для превью ссылок и теги превью в <head>.
// Всё собирается из тех же data/profile.json и data/projects.json, что и главная,
// поэтому резюме, сайт и превью в мессенджере не расходятся.
// Модуль без DOM и без браузера: HTML отсюда в PDF и PNG переводит scripts/render-assets.mjs.

import { AVATAR, AVATAR_PALETTE, spriteToSvg } from './avatar.mjs';
import { escapeHtml, safeUrl, validateData, RESUME_PDF } from './render.mjs';

export const SITE_URL = 'https://maarshir.github.io/';
export { RESUME_PDF };
export const OG_IMAGE = 'assets/og.png';
export const OG_W = 1200;
export const OG_H = 630;

// В резюме не попадает ничего, кроме того, что уже открыто на сайте.
// Поле now («Сейчас: …») быстро устаревает, в PDF его нет.
const RESUME_FIELDS = ['name', 'role', 'direction', 'lookingFor', 'about', 'contacts', 'education', 'work', 'stack'];

// Адрес без https:// и косой черты в конце: так он читается на бумаге.
export function shortUrl(url) {
  return String(url).replace(/^https:\/\//, '').replace(/^mailto:/, '').replace(/\/$/, '');
}

function check(profile, projects) {
  const errors = validateData(profile, projects);
  if (errors.length) throw new Error(`Ошибки в данных:\n${errors.join('\n')}`);
}

export function pageTitle(profile) {
  return `${profile.name}, разработчик`;
}

// Описание для поисковиков и превью: имя, роль, направление и названия основных проектов.
export function pageDescription(profile, projects) {
  const main = projects.filter((p) => p.group === 'main').map((p) => p.title);
  return `${profile.name}. ${profile.role}. ${profile.direction} Проекты ${main.join(', ')}, резюме PDF и контакты.`;
}

// Теги <head>: заголовок, описание и превью для Телеграма, ВКонтакте, Слака и других.
// Адрес картинки абсолютный: мессенджеры относительные адреса не понимают.
export function renderHead(profile, projects) {
  check(profile, projects);
  const title = escapeHtml(pageTitle(profile));
  const description = escapeHtml(pageDescription(profile, projects));
  const image = `${SITE_URL}${OG_IMAGE}`;
  const alt = escapeHtml(`${profile.name}. ${profile.role}`);
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${SITE_URL}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="ru_RU">',
    `<meta property="og:site_name" content="${escapeHtml(profile.name)}">`,
    `<meta property="og:url" content="${SITE_URL}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:type" content="image/png">',
    `<meta property="og:image:width" content="${OG_W}">`,
    `<meta property="og:image:height" content="${OG_H}">`,
    `<meta property="og:image:alt" content="${alt}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
}

// Стили резюме: обычный шрифт, тёмный текст, поля 10 и 12 мм. Пиксельный стиль сайта
// на бумаге и в системах отбора резюме только мешает.
const RESUME_CSS = `
@page { size: A4; margin: 10mm 12mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #1d1a26; font: 9.4pt/1.3 'PT Sans', 'DejaVu Sans', 'Segoe UI', Arial, sans-serif; }
main { max-width: 182mm; margin: 0 auto; }
a { color: inherit; text-decoration: none; }
header { display: flex; gap: 5mm; align-items: center; border-bottom: 1.5pt solid #1d1a26; padding-bottom: 2.5mm; }
header svg { width: 15mm; height: 15mm; flex: none; }
h1 { font-size: 19pt; line-height: 1.1; margin: 0; }
.role { font-size: 11pt; margin: 1mm 0 0; font-weight: bold; color: #4a3f5c; }
.contacts { list-style: none; padding: 0; margin: 2.5mm 0 0; display: flex; flex-wrap: wrap; gap: 1mm 5mm; }
.contacts span { color: #5e5470; }
.lead { margin: 2.5mm 0 0; }
h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.06em; color: #b0412c; margin: 3mm 0 1mm; }
p { margin: 0 0 1.2mm; }
.item { margin: 0 0 1.6mm; break-inside: avoid; }
.item h3 { font-size: 10pt; margin: 0; display: flex; justify-content: space-between; gap: 4mm; }
.item h3 a { font-weight: normal; color: #4a3f5c; font-size: 8.6pt; }
.item ul { margin: 0.8mm 0 0; padding-left: 4.5mm; }
.item li { margin: 0; }
.stack-line { color: #4a3f5c; font-size: 8.6pt; margin: 0.8mm 0 0; }
.rows { list-style: none; padding: 0; margin: 0; }
.rows li { margin: 0 0 0.8mm; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6mm; }
@media screen { body { background: #eee; padding: 10mm 0; } main { background: #fff; padding: 10mm 12mm; box-shadow: 0 1px 6px rgba(0,0,0,.2); } }
`;

function linkTo(url, text) {
  return `<a href="${escapeHtml(safeUrl(url))}">${escapeHtml(text)}</a>`;
}

function renderResumeProject(p, detailed) {
  const code = p.code ? linkTo(p.code, shortUrl(p.code)) : '';
  const head = `<h3><span>${escapeHtml(p.title)}</span>${code}</h3>`;
  if (!detailed) return `<div class="item">${head}<p>${escapeHtml(p.line)}</p></div>`;
  const points = p.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('');
  return `<div class="item">${head}<p>${escapeHtml(p.line)}</p><ul>${points}</ul><p class="stack-line">${escapeHtml(p.stack.join(', '))}</p></div>`;
}

const rows = (items) => `<ul class="rows">${items.map((e) => `<li><strong>${escapeHtml(e.place)}.</strong> ${escapeHtml(e.what)}</li>`).join('')}</ul>`;

export function renderResume(profile, projects) {
  check(profile, projects);
  const data = Object.fromEntries(RESUME_FIELDS.map((k) => [k, profile[k]]));
  const avatar = spriteToSvg(AVATAR, AVATAR_PALETTE);
  const contacts = [
    ...data.contacts.map((c) => `<li><span>${escapeHtml(c.label)}:</span> ${linkTo(c.url, c.kind === 'github' ? shortUrl(c.url) : c.value)}</li>`),
    `<li><span>Сайт:</span> ${linkTo(SITE_URL, shortUrl(SITE_URL))}</li>`,
  ].join('');
  const main = projects.filter((p) => p.group === 'main').map((p) => renderResumeProject(p, true)).join('\n');
  const personal = projects.filter((p) => p.group === 'personal').map((p) => renderResumeProject(p, false)).join('\n');
  const stack = data.stack.map((g) => `<li><strong>${escapeHtml(g.group)}:</strong> ${escapeHtml(g.items.join(', '))}</li>`).join('');
  const about = data.about.map((a) => `<p>${escapeHtml(a)}</p>`).join('\n');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.name)}, резюме</title>
<meta name="robots" content="noindex">
<style>${RESUME_CSS}</style>
</head>
<body>
<main>
<header>
${avatar}
<div>
<h1>${escapeHtml(data.name)}</h1>
<p class="role">${escapeHtml(data.role)}</p>
<ul class="contacts">${contacts}</ul>
</div>
</header>
<p class="lead">${escapeHtml(data.direction)} ${escapeHtml(data.lookingFor)}</p>
<h2>О себе</h2>
${about}
<h2>Проекты</h2>
${main}
${personal ? `<h2>Личные проекты</h2>\n<div class="two">\n${personal}\n</div>` : ''}
<div class="two">
<section><h2>Опыт</h2>${rows(data.work)}</section>
<section><h2>Образование</h2>${rows(data.education)}</section>
</div>
<h2>Стек</h2>
<ul class="rows">${stack}</ul>
</main>
</body>
</html>
`;
}

// Картинка превью 1200×630: аватар, имя, роль и адрес сайта в пиксельном стиле сайта.
// Шрифт берётся из fonts/tiny5.css, путь относительный от папки assets/.
export function renderOgCard(profile) {
  const avatar = spriteToSvg(AVATAR, AVATAR_PALETTE);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Превью ссылки</title>
<link rel="stylesheet" href="../fonts/tiny5.css">
<style>
html, body { margin: 0; }
body { width: ${OG_W}px; height: ${OG_H}px; background: #f4ecd8; color: #2b2139; font-family: 'Tiny5', monospace; position: relative; overflow: hidden; }
.frame { position: absolute; inset: 36px; background: #fffaf0; border: 8px solid #2b2139; box-shadow: 12px 12px 0 #2b2139; display: flex; align-items: center; gap: 56px; padding: 0 64px; }
svg { width: 256px; height: 256px; flex: none; image-rendering: pixelated; }
h1 { font-size: 76px; line-height: 1; margin: 0 0 20px; }
.role { font-size: 34px; line-height: 1.25; margin: 0 0 28px; color: #5e5470; }
.url { font-size: 30px; margin: 0; color: #c8553d; }
.grass { position: absolute; left: 0; right: 0; bottom: 0; height: 18px; background: #5a9b4c; }
</style>
</head>
<body>
<div class="frame">
${avatar}
<div>
<h1>${escapeHtml(profile.name)}</h1>
<p class="role">${escapeHtml(profile.role)}</p>
<p class="url">${escapeHtml(shortUrl(SITE_URL))}</p>
</div>
</div>
<div class="grass"></div>
</body>
</html>
`;
}

// Вставка тегов <head> между метками в index.html.
export const HEAD_START = '<!-- head:start (собирается из data/ командой npm run build, руками не править) -->';
export const HEAD_END = '<!-- head:end -->';

export function injectHead(html, head) {
  const a = html.indexOf(HEAD_START);
  const b = html.indexOf(HEAD_END);
  if (a === -1 || b === -1 || b < a) throw new Error('В index.html нет меток head:start и head:end');
  return `${html.slice(0, a + HEAD_START.length)}\n${head}\n${html.slice(b)}`;
}
