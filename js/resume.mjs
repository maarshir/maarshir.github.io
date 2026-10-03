// Резюме на одну страницу A4, картинка для превью ссылок и теги превью в <head>.
// Превью и теги собираются из тех же data/profile.json и data/projects.json, что и главная.
// Резюме берёт оттуда имя и контакты, а свои тексты из data/resume.json.
// Модуль без DOM и без браузера: HTML отсюда в PDF и PNG переводит scripts/render-assets.mjs.

import { AVATAR, AVATAR_PALETTE, spriteToSvg } from './avatar.mjs';
import { escapeHtml, safeUrl, validateData, RESUME_PDF } from './render.mjs';

export const SITE_URL = 'https://maarshir.github.io/';
export { RESUME_PDF };
export const OG_IMAGE = 'assets/og.png';
export const OG_W = 1200;
export const OG_H = 630;

// Из profile.json в резюме идут только имя и контакты, остальное берётся из data/resume.json.
// Поле now («Сейчас: …») быстро устаревает, в PDF его нет.
const RESUME_FIELDS = ['name', 'contacts'];

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

// Резюме на одну страницу A4 в стиле сайта: пиксельный шрифт только в имени и заголовках,
// текст обычным шрифтом Golos Text, чтобы его читали и люди, и системы отбора резюме.
// Тексты резюме лежат в data/resume.json, контакты и проверка данных общие с сайтом.
// Фото, шрифт Golos Text (лицензия OFL в assets/OFL-GolosText.txt) и QR-код на сайт
// лежат в assets/, пиксельный шрифт в fonts/.
export const RESUME_PHOTO = 'assets/photo.jpg';
export const RESUME_FONT = 'assets/golos-text.woff2';
const GOLOS_FACE = `
@font-face { font-family: 'Golos Text'; font-style: normal; font-weight: 400 900; font-display: block; src: url('${RESUME_FONT}') format('woff2'); }`;

const RESUME_CSS = `
@page { size: A4; margin: 0; }
:root { --ink: #2b2139; --muted: #5e5470; --paper: #fffdf8; --panel: #f4ecd8; --green: #3f7338; --gold: #e8b04b; --px: 0.55mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 210mm; height: 297mm; }
body { font-family: 'Golos Text', 'PT Sans', Arial, sans-serif; font-size: 8.5pt; line-height: 1.4; color: var(--ink); background: var(--paper); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: inherit; text-decoration: none; }
.nw { white-space: nowrap; }
.page { width: 210mm; height: 297mm; display: grid; grid-template-columns: 1fr 66mm; overflow: hidden; }
.main { padding: 11mm 9mm 9mm 12mm; display: flex; flex-direction: column; }
h1 { font-family: 'Tiny5', monospace; font-weight: 400; font-size: 33pt; line-height: 0.95; letter-spacing: 0.3pt; }
.title { margin-top: 3mm; font-size: 13pt; font-weight: 650; color: var(--green); }
.summary { margin-top: 3mm; font-size: 9pt; line-height: 1.45; max-width: 128mm; }
.seek { margin-top: 2.2mm; font-size: 9pt; font-weight: 550; }
.facts { display: flex; gap: 3.2mm; margin-top: 4.2mm; margin-left: var(--px); }
.fact { flex: 1; display: flex; align-items: center; gap: 2.2mm; padding: 1.8mm 2.6mm; background: #fff;
  box-shadow: 0 calc(-1 * var(--px)) 0 0 var(--ink), 0 var(--px) 0 0 var(--ink), calc(-1 * var(--px)) 0 0 0 var(--ink), var(--px) 0 0 0 var(--ink), calc(2.2 * var(--px)) calc(2.2 * var(--px)) 0 0 var(--gold); }
.fact b { font-family: 'Tiny5', monospace; font-weight: 400; font-size: 17pt; line-height: 1; }
.fact span { font-size: 7.6pt; line-height: 1.25; color: var(--muted); }
h2 { font-family: 'Tiny5', monospace; font-weight: 400; font-size: 13pt; line-height: 1; margin: 5.2mm 0 2.2mm; display: flex; align-items: baseline; justify-content: space-between; }
h2 small { font-family: 'Golos Text', sans-serif; font-size: 7.6pt; color: var(--muted); font-weight: 450; }
.proj { margin-bottom: 2.1mm; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 3mm; }
.proj .head { font-size: 9.4pt; font-weight: 650; color: var(--green); }
.tag { font-size: 7.4pt; color: var(--muted); white-space: nowrap; }
.proj p { margin-top: 0.6mm; }
.job { margin-bottom: 2.8mm; }
.job .head { font-size: 9.4pt; font-weight: 650; }
.job .head span { font-weight: 450; color: var(--muted); }
ul.sq { list-style: none; margin-top: 0.8mm; }
ul.sq li { position: relative; padding-left: 3.4mm; margin-bottom: 0.7mm; }
ul.sq li::before, .how li::before { content: ''; position: absolute; left: 0.3mm; top: 1.55mm; width: 1.2mm; height: 1.2mm; background: var(--gold); }
.how { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2mm 5mm; }
.how li { list-style: none; position: relative; padding-left: 3.4mm; }
.how li::before { background: var(--green); }
.side { background: var(--panel); padding: 11mm 8mm 9mm 8mm; display: flex; flex-direction: column; }
.photo { position: relative; width: 46mm; height: 53mm; margin-bottom: 5.5mm; }
.photo::before, .photo img { position: absolute; inset: 0;
  clip-path: polygon(1.6mm 0, calc(100% - 1.6mm) 0, calc(100% - 1.6mm) 0.8mm, calc(100% - 0.8mm) 0.8mm, calc(100% - 0.8mm) 1.6mm, 100% 1.6mm, 100% calc(100% - 1.6mm), calc(100% - 0.8mm) calc(100% - 1.6mm), calc(100% - 0.8mm) calc(100% - 0.8mm), calc(100% - 1.6mm) calc(100% - 0.8mm), calc(100% - 1.6mm) 100%, 1.6mm 100%, 1.6mm calc(100% - 0.8mm), 0.8mm calc(100% - 0.8mm), 0.8mm calc(100% - 1.6mm), 0 calc(100% - 1.6mm), 0 1.6mm, 0.8mm 1.6mm, 0.8mm 0.8mm, 1.6mm 0.8mm); }
.photo::before { content: ''; background: var(--ink); transform: translate(1.6mm, 1.6mm); }
.photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; display: block; }
.side h2 { font-size: 11.5pt; margin: 4.4mm 0 1.9mm; }
.side h2:first-of-type { margin-top: 0; }
.contacts { display: grid; grid-template-columns: auto 1fr; gap: 0.9mm 2.5mm; font-size: 8.3pt; }
.contacts dt { color: var(--muted); }
.contacts dd { font-weight: 550; }
.stack div { margin-bottom: 1.1mm; line-height: 1.35; font-size: 8pt; }
.stack b { font-weight: 650; }
.stack span { color: var(--muted); }
.edu { margin-bottom: 1.8mm; }
.edu .head { font-weight: 650; display: flex; justify-content: space-between; gap: 2mm; }
.edu .head span { font-weight: 450; color: var(--muted); white-space: nowrap; }
.edu p { color: var(--muted); font-size: 8pt; line-height: 1.35; }
.qr { margin-top: auto; display: flex; gap: 3mm; align-items: center; padding-top: 3mm; }
.qr svg { width: 21mm; height: 21mm; flex: none; background: #fff; padding: 1.4mm; box-shadow: calc(1.6 * var(--px)) calc(1.6 * var(--px)) 0 0 var(--gold); }
.qr p { font-size: 7.6pt; line-height: 1.35; color: var(--muted); }
.qr p b { color: var(--ink); font-weight: 650; display: block; font-size: 8.2pt; }
@media screen { html, body { width: auto; height: auto; } body { background: #e8e1cf; padding: 8mm 0; } .page { margin: 0 auto; box-shadow: 0 1px 8px rgba(0,0,0,.25); } }
`;

function linkTo(url, text) {
  return `<a href="${escapeHtml(safeUrl(url))}">${escapeHtml(text)}</a>`;
}

// Слова через дефис (token-counter, ИИ-агенты) не рвутся на конце строки.
function text(value) {
  return escapeHtml(value).replace(/[^\s<>]+-[^\s<>]+/g, (w) => `<span class="nw">${w}</span>`);
}

// Тексты резюме из data/resume.json: всё обязательное на месте, без длинных тире.
export function validateResume(r) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  const list = (v) => Array.isArray(v) && v.length > 0;
  if (!r || typeof r !== 'object') return ['resume: нет данных резюме (data/resume.json)'];
  for (const k of ['title', 'summary', 'seek', 'city']) need(str(r[k]), `resume.${k}: нужна непустая строка`);
  for (const k of ['facts', 'projects', 'work', 'how', 'stack', 'education']) need(list(r[k]), `resume.${k}: нужен непустой список`);
  for (const p of r.projects || []) need(str(p.title) && str(p.url) && str(p.text), `resume.projects: у проекта нужны title, url и text`);
  for (const w of r.work || []) need(str(w.place) && str(w.period) && list(w.points), `resume.work: у места нужны place, period и points`);
  need(!JSON.stringify(r).includes('\u2014'), 'resume: длинное тире в тексте');
  return errors;
}

// assets: { photo: путь к фото, qr: SVG QR-кода на сайт }. Без них резюме собирается без фото и QR.
export function renderResume(profile, projects, resume, assets = {}) {
  check(profile, projects);
  const errors = validateResume(resume);
  if (errors.length) throw new Error(`Ошибки в резюме:\n${errors.join('\n')}`);
  const data = Object.fromEntries(RESUME_FIELDS.map((k) => [k, profile[k]]));
  const r = resume;

  const facts = r.facts.map((f) => `<div class="fact"><b>${escapeHtml(f.value)}</b><span>${text(f.label)}</span></div>`).join('\n');
  const proj = r.projects.map((p) => `<div class="proj"><div class="row"><a class="head" href="${escapeHtml(safeUrl(p.url))}">${escapeHtml(p.title)}</a><span class="tag">${escapeHtml(p.tag || '')}</span></div><p>${text(p.text)}</p></div>`).join('\n');
  const work = r.work.map((w) => `<div class="job"><div class="row"><div class="head">${escapeHtml(w.place)}${w.role ? ` <span>${escapeHtml(w.role)}</span>` : ''}</div><span class="tag">${escapeHtml(w.period)}</span></div><ul class="sq">${w.points.map((pt) => `<li>${text(pt)}</li>`).join('')}</ul></div>`).join('\n');
  const how = r.how.map((h) => `<li>${text(h)}</li>`).join('');
  const contacts = [
    `<dt>Город</dt><dd>${escapeHtml(r.city)}</dd>`,
    ...data.contacts.map((c) => `<dt>${escapeHtml(c.label)}</dt><dd>${linkTo(c.url, c.value)}</dd>`),
    `<dt>Сайт</dt><dd>${linkTo(SITE_URL, shortUrl(SITE_URL))}</dd>`,
  ].join('\n');
  const stack = r.stack.map((g) => `<div><b>${escapeHtml(g.group)}:</b> <span>${text(g.items.join(', '))}</span></div>`).join('\n');
  const rowsOf = (items) => items.map((e) => `<div class="edu"><div class="head">${escapeHtml(e.place)}${e.period ? ` <span>${escapeHtml(e.period)}</span>` : ''}</div><p>${text(e.what)}</p></div>`).join('\n');
  const photo = assets.photo ? `<div class="photo"><img src="${escapeHtml(assets.photo)}" alt="${escapeHtml(data.name)}"></div>` : '';
  const qr = assets.qr ? `<div class="qr"><a href="${SITE_URL}">${assets.qr}</a><p><b>${escapeHtml(r.qr?.title || 'Сайт-резюме')}</b>${escapeHtml(shortUrl(SITE_URL))}<br>${escapeHtml(r.qr?.text || '')}</p></div>` : '';

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.name)}, резюме</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="fonts/tiny5.css">
<style>${GOLOS_FACE}${RESUME_CSS}</style>
</head>
<body>
<div class="page">
<main class="main">
<h1>${escapeHtml(data.name)}</h1>
<div class="title">${text(r.title)}</div>
<p class="summary">${text(r.summary)}</p>
<p class="seek">${text(r.seek)}</p>
<div class="facts">
${facts}
</div>
<h2>Проекты <small>${linkTo(data.contacts.find((c) => c.kind === 'github')?.url || SITE_URL, shortUrl(data.contacts.find((c) => c.kind === 'github')?.url || SITE_URL))}</small></h2>
${proj}
<h2>Опыт работы</h2>
${work}
<h2>Как работаю</h2>
<ul class="how">${how}</ul>
</main>
<aside class="side">
${photo}
<h2>Контакты</h2>
<dl class="contacts">
${contacts}
</dl>
<h2>Стек</h2>
<div class="stack">
${stack}
</div>
<h2>Образование</h2>
${rowsOf(r.education)}
${r.courses?.length ? `<h2>Курсы</h2>\n${rowsOf(r.courses)}` : ''}
${qr}
</aside>
</div>
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
