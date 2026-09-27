// Сборка обычного режима («всё за 30 секунд») из data/profile.json и data/projects.json.
// Вызывается скриптом scripts/build.mjs при сборке, а не в браузере: так страница
// видна сразу, без JavaScript, и её читают поисковики и превью ссылок.

import { AVATAR, AVATAR_PALETTE, spriteToSvg } from './avatar.mjs';

export const BUILDINGS = ['Арена', 'Библиотека', 'Счётная контора', 'Мастерская', 'Сад желаний'];

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// Разрешаем только ссылки, которые имеет смысл ставить в резюме.
export function safeUrl(url) {
  const value = String(url);
  if (/^(https:\/\/|mailto:)/.test(value)) return value;
  throw new Error(`Недопустимая ссылка: ${value}`);
}

// Проверка данных. Возвращает список ошибок, пустой список значит всё в порядке.
export function validateData(profile, projects) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const text = (v) => typeof v === 'string' && v.trim().length > 0;

  for (const key of ['name', 'role', 'direction', 'lookingFor', 'now']) {
    need(text(profile[key]), `profile.${key}: нужна непустая строка`);
  }
  need(Array.isArray(profile.about) && profile.about.every(text), 'profile.about: нужен список абзацев');
  need(Array.isArray(profile.contacts) && profile.contacts.length > 0, 'profile.contacts: нужен хотя бы один контакт');
  for (const [i, c] of (profile.contacts || []).entries()) {
    need(text(c.label) && text(c.value) && text(c.url), `profile.contacts[${i}]: нужны label, value и url`);
  }
  for (const key of ['education', 'work']) {
    need(Array.isArray(profile[key]), `profile.${key}: нужен список`);
    for (const [i, e] of (profile[key] || []).entries()) {
      need(text(e.place) && text(e.what), `profile.${key}[${i}]: нужны place и what`);
    }
  }
  need(Array.isArray(profile.stack) && profile.stack.length > 0, 'profile.stack: нужен список групп');

  need(Array.isArray(projects) && projects.length > 0, 'projects: нужен непустой список');
  const ids = new Set();
  const buildings = new Set();
  for (const [i, p] of (projects || []).entries()) {
    const where = `projects[${i}]${p && p.id ? ` (${p.id})` : ''}`;
    need(text(p.id) && /^[a-z0-9-]+$/.test(p.id), `${where}: id из строчных латинских букв, цифр и дефиса`);
    need(!ids.has(p.id), `${where}: id повторяется`);
    ids.add(p.id);
    need(text(p.title), `${where}: нужен title`);
    need(text(p.summary), `${where}: нужен summary`);
    need(BUILDINGS.includes(p.building), `${where}: building должен быть одним из: ${BUILDINGS.join(', ')}`);
    need(!buildings.has(p.building), `${where}: здание ${p.building} уже занято`);
    buildings.add(p.building);
    need(Array.isArray(p.points) && p.points.length > 0 && p.points.every(text), `${where}: нужен список points`);
    need(Array.isArray(p.stack) && p.stack.length > 0 && p.stack.every(text), `${where}: нужен список stack`);
    need(text(p.code) && p.code.startsWith('https://github.com/maarshir/'), `${where}: code должен вести в репозиторий maarshir`);
    need(p.demo === null || (text(p.demo) && p.demo.startsWith('https://')), `${where}: demo это null или https-ссылка`);
  }
  return errors;
}

// Внешние ссылки открываются в новой вкладке, почта как обычно.
function link(url, label, cls = '') {
  const href = escapeHtml(safeUrl(url));
  const external = url.startsWith('https://') ? ' target="_blank" rel="noopener"' : '';
  const c = cls ? ` class="${cls}"` : '';
  return `<a${c} href="${href}"${external}>${label}</a>`;
}

function renderProject(p) {
  const points = p.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('');
  const stack = p.stack.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const demo = p.demo ? link(p.demo, 'Попробовать', 'btn') : '';
  return [
    `<article class="card" id="project-${escapeHtml(p.id)}">`,
    `<p class="card-place">${escapeHtml(p.building)}</p>`,
    `<h3>${escapeHtml(p.title)}</h3>`,
    `<p>${escapeHtml(p.summary)}</p>`,
    `<ul class="points">${points}</ul>`,
    `<ul class="tags" aria-label="Технологии">${stack}</ul>`,
    `<p class="card-links">${link(p.code, 'Код на Гитхабе', 'btn')}${demo}</p>`,
    '</article>',
  ].join('\n');
}

function renderTimeline(items) {
  return items
    .map((e) => `<li><strong>${escapeHtml(e.place)}</strong><span>${escapeHtml(e.what)}</span></li>`)
    .join('\n');
}

export function renderCv(profile, projects) {
  const errors = validateData(profile, projects);
  if (errors.length) throw new Error(`Ошибки в данных:\n${errors.join('\n')}`);

  const avatar = spriteToSvg(AVATAR, AVATAR_PALETTE, { className: 'avatar' });
  const about = profile.about.map((a) => `<p>${escapeHtml(a)}</p>`).join('\n');
  const contacts = profile.contacts
    .map((c) => `<li><span class="contact-label">${escapeHtml(c.label)}</span>${link(c.url, escapeHtml(c.value))}</li>`)
    .join('\n');
  const heroLinks = profile.contacts.map((c) => link(c.url, escapeHtml(c.label), 'btn')).join('\n');
  const stack = profile.stack
    .map((g) => `<div class="stack-group"><h3>${escapeHtml(g.group)}</h3><ul class="tags">${g.items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>`)
    .join('\n');

  return `<header class="hero">
${avatar}
<div class="hero-text">
<h1>${escapeHtml(profile.name)}</h1>
<p class="role">${escapeHtml(profile.role)}</p>
<p>${escapeHtml(profile.direction)}</p>
<p class="looking">${escapeHtml(profile.lookingFor)}</p>
<p class="hero-links">${heroLinks}</p>
</div>
</header>

<section class="panel" id="about" aria-labelledby="about-title">
<h2 id="about-title">Обо мне</h2>
${about}
</section>

<section id="projects" aria-labelledby="projects-title">
<h2 id="projects-title" class="section-title">Проекты</h2>
<div class="cards">
${projects.map(renderProject).join('\n')}
</div>
</section>

<section class="panel board" id="now" aria-labelledby="now-title">
<h2 id="now-title">Сейчас работаю над</h2>
<p>${escapeHtml(profile.now)}</p>
</section>

<div class="two-cols">
<section class="panel" id="education" aria-labelledby="education-title">
<h2 id="education-title">Образование</h2>
<ul class="timeline">
${renderTimeline(profile.education)}
</ul>
</section>
<section class="panel" id="work" aria-labelledby="work-title">
<h2 id="work-title">Работа</h2>
<ul class="timeline">
${renderTimeline(profile.work)}
</ul>
</section>
</div>

<section class="panel" id="stack" aria-labelledby="stack-title">
<h2 id="stack-title">Стек</h2>
<div class="stack">
${stack}
</div>
</section>

<section class="panel mail" id="contacts" aria-labelledby="contacts-title">
<h2 id="contacts-title">Контакты</h2>
<ul class="contacts">
${contacts}
</ul>
</section>`;
}

// Вставляет собранный блок между метками в index.html.
export const START = '<!-- cv:start (собирается из data/ командой npm run build, руками не править) -->';
export const END = '<!-- cv:end -->';

export function injectCv(html, cv) {
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a === -1 || b === -1 || b < a) throw new Error('В index.html нет меток cv:start и cv:end');
  return `${html.slice(0, a + START.length)}\n${cv}\n${html.slice(b)}`;
}
