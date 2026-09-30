// Переводит resume.html в resume.pdf и assets/og-card.html в assets/og.png через Chromium.
// Запуск после npm run build: npm install (один раз), затем npm run assets.
// Chromium берётся из Playwright (npx playwright-core install chromium) или по пути из CHROMIUM_PATH.
//
// PDF и PNG нельзя пересобрать байт в байт (в PDF дата, у разных версий Chromium разные шрифты),
// поэтому рядом пишется assets/stamp.json: хэши исходных HTML, из которых они сделаны.
// Тест сравнивает хэши с текущими resume.html и og-card.html и падает, если картинку или PDF забыли обновить.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OG_W, OG_H } from '../js/resume.mjs';

const root = new URL('..', import.meta.url);
export const STAMP = 'assets/stamp.json';
export const SOURCES = { pdf: 'resume.html', og: 'assets/og-card.html' };

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export async function sourceHashes() {
  const out = {};
  for (const [key, path] of Object.entries(SOURCES)) out[key] = sha256(await readFile(new URL(path, root), 'utf8'));
  return out;
}

async function launch() {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    throw new Error('Нет playwright-core: сначала npm install');
  }
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  return chromium.launch(executablePath ? { executablePath } : {});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(new URL(SOURCES.pdf, root).href);
    await page.pdf({ path: fileURLToPath(new URL('resume.pdf', root)), format: 'A4', preferCSSPageSize: true, printBackground: true });

    await page.setViewportSize({ width: OG_W, height: OG_H });
    await page.goto(new URL(SOURCES.og, root).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL('assets/og.png', root)) });

    const stamp = { note: 'Хэши исходных HTML, из которых собраны resume.pdf и assets/og.png. Пишет npm run assets.', ...await sourceHashes() };
    await writeFile(new URL(STAMP, root), `${JSON.stringify(stamp, null, 2)}\n`);
    console.log(`Готово: resume.pdf, assets/og.png ${OG_W}×${OG_H}, ${STAMP}`);
  } finally {
    await browser.close();
  }
}
