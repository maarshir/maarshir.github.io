// Пересобирает обычный режим в index.html из data/*.json.
// Запуск: npm run build. Тест test/build.test.mjs проверяет, что index.html не отстал от данных.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderCv, injectCv } from '../js/render.mjs';
import { AVATAR, AVATAR_PALETTE, spriteToSvg } from '../js/avatar.mjs';

const root = new URL('..', import.meta.url);

export async function buildIndex() {
  const profile = JSON.parse(await readFile(new URL('data/profile.json', root), 'utf8'));
  const projects = JSON.parse(await readFile(new URL('data/projects.json', root), 'utf8'));
  const html = await readFile(new URL('index.html', root), 'utf8');
  return injectCv(html, renderCv(profile, projects));
}

// Значок вкладки из того же спрайта, что и аватар.
export function buildFavicon() {
  const svg = spriteToSvg(AVATAR, AVATAR_PALETTE).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return `${svg}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = await buildIndex();
  await writeFile(new URL('index.html', root), next);
  await writeFile(new URL('favicon.svg', root), buildFavicon());
  console.log('index.html и favicon.svg собраны из data/ и js/avatar.mjs');
}
