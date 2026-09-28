// Окно «Спросите моё резюме» в браузере: кнопки, поле, печатная машинка.
// Поиск и сборка ответа в js/ask.mjs (без DOM, с тестами), здесь только показ.

import { createAsk } from './ask.mjs';
import { typedCounts, typingDone, typingDuration } from './typewriter.mjs';

const box = document.getElementById('ask');
const log = document.getElementById('ask-log');
const form = document.getElementById('ask-form');
const input = document.getElementById('ask-input');
const live = document.getElementById('ask-live');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

// Сколько сообщений держать в окне: старые уходят, чтобы окно не росло.
const KEEP = 6;
// Ответ чата печатается вдвое быстрее окон городка: его читают на бегу.
const CPS = 90;

const load = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const ready = Promise.all([load('data/profile.json'), load('data/projects.json')])
  .then(([profile, projects]) => (profile && projects ? createAsk(profile, projects) : null))
  .catch(() => null);

const FAILED = {
  found: false,
  paragraphs: ['Поиск не загрузился. Всё то же самое есть ниже на странице.'],
  links: [{ label: 'Проекты', url: '#projects' }],
  sources: [],
  matched: [],
};

let typing = null;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// В ссылку попадают только адреса, которые имеет смысл открывать из резюме.
function safe(url) {
  return /^(https:\/\/|mailto:|#[a-z0-9-]+$)/.test(url) ? url : null;
}

function push(node) {
  log.append(node);
  while (log.children.length > KEEP) log.firstElementChild.remove();
}

// Окно прокручивается к вопросу, а не к концу ответа: длинный ответ читается с начала.
function scrollTo(node) {
  log.scrollTop = Math.max(0, node.offsetTop - 8);
}

// Текст печатается в заранее занятом месте: видимая часть и невидимый остаток.
// Так окно не прыгает, а читалка экрана получает абзац целиком из скрытой копии.
function typedParagraph(text) {
  const p = el('p');
  const shown = el('span');
  const rest = el('span', 'ask-rest', text);
  shown.setAttribute('aria-hidden', 'true');
  rest.setAttribute('aria-hidden', 'true');
  p.append(shown, rest, el('span', 'sr-only', text));
  return { p, shown, rest, text, n: 0 };
}

function finishTyping() {
  if (!typing) return;
  typing.start = performance.now() / 1000 - typingDuration(typing.lines.map((l) => l.text), CPS) - 1;
  step();
}

function step() {
  if (!typing) return;
  const texts = typing.lines.map((l) => l.text);
  const counts = typedCounts(texts, performance.now() / 1000 - typing.start, { cps: CPS, reducedMotion: reduced.matches });
  typing.lines.forEach((line, i) => {
    if (line.n === counts[i]) return;
    line.n = counts[i];
    line.shown.textContent = line.text.slice(0, line.n);
    line.rest.textContent = line.text.slice(line.n);
  });
  if (typingDone(texts, counts)) {
    typing.after.hidden = false;
    typing = null;
    return;
  }
  requestAnimationFrame(step);
}

function showAnswer(result) {
  finishTyping();
  const msg = el('div', `ask-msg ask-bot${result.found ? '' : ' ask-miss'}`);
  const lines = result.paragraphs.map(typedParagraph);
  for (const line of lines) msg.append(line.p);

  // Откуда ответ и ссылки появляются после печати: сначала читается сам ответ.
  const after = el('div', 'ask-after');
  after.hidden = true;
  if (result.sources.length) {
    after.append(el('p', 'ask-src', `Нашлось в разделах: ${result.sources.join(', ')}. По словам: ${result.matched.join(', ')}.`));
  }
  const links = el('p', 'ask-links');
  for (const l of result.links) {
    const url = safe(l.url);
    if (!url) continue;
    const a = el('a', 'ask-link', l.label);
    a.href = url;
    if (url.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener'; }
    links.append(a);
  }
  if (links.childElementCount) after.append(links);
  msg.append(after);
  push(msg);

  live.textContent = result.paragraphs.join(' ');
  typing = { lines, after, start: performance.now() / 1000 };
  step();
}

async function ask(question) {
  const q = question.trim().slice(0, 200);
  if (!q) return;
  const bubble = el('p', 'ask-msg ask-user', q);
  push(bubble);
  scrollTo(bubble);
  const answer = await ready;
  const result = answer ? answer(q) : FAILED;
  if (result) showAnswer(result);
  scrollTo(bubble);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const q = input.value;
  input.value = '';
  ask(q);
});

for (const chip of box.querySelectorAll('.ask-chip')) {
  chip.addEventListener('click', () => ask(chip.dataset.q || chip.textContent));
}

// Клик по окну во время печати показывает ответ целиком.
log.addEventListener('click', (event) => {
  if (typing && !event.target.closest('a')) finishTyping();
});
