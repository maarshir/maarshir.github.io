// Пересобирает из data/*.json всё, что можно собрать без браузера:
// index.html (главная и теги превью в <head>), favicon.svg, resume.html и assets/og-card.html.
// Запуск: npm run build. PDF и картинку превью из них делает npm run assets (нужен Chromium).
// Тесты test/build.test.mjs и test/resume.test.mjs проверяют, что файлы не отстали от данных.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderCv, injectCv } from '../js/render.mjs';
import { renderHead, injectHead, renderResume, renderOgCard } from '../js/resume.mjs';
import { AVATAR, AVATAR_PALETTE, spriteToSvg } from '../js/avatar.mjs';

const root = new URL('..', import.meta.url);

export async function loadData() {
  const profile = JSON.parse(await readFile(new URL('data/profile.json', root), 'utf8'));
  const projects = JSON.parse(await readFile(new URL('data/projects.json', root), 'utf8'));
  return { profile, projects };
}

export async function buildIndex() {
  const { profile, projects } = await loadData();
  const html = await readFile(new URL('index.html', root), 'utf8');
  return injectCv(injectHead(html, renderHead(profile, projects)), renderCv(profile, projects));
}

export async function buildResume() {
  const { profile, projects } = await loadData();
  return renderResume(profile, projects);
}

export async function buildOgCard() {
  const { profile } = await loadData();
  return renderOgCard(profile);
}

// Значок вкладки из того же спрайта, что и аватар.
export function buildFavicon() {
  const svg = spriteToSvg(AVATAR, AVATAR_PALETTE).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return `${svg}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(new URL('assets/', root), { recursive: true });
  await writeFile(new URL('index.html', root), await buildIndex());
  await writeFile(new URL('favicon.svg', root), buildFavicon());
  await writeFile(new URL('resume.html', root), await buildResume());
  await writeFile(new URL('assets/og-card.html', root), await buildOgCard());
  console.log('Собраны index.html, favicon.svg, resume.html и assets/og-card.html.');
  console.log('Если менялись данные резюме или превью, дальше npm run assets (PDF и картинка).');
}
