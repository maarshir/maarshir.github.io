// Снимок первого экрана для README: docs/screen.png.
// Поднимает сайт на локальном сервере, нажимает «Что умеешь?» в окне чата и снимает экран.
// Запуск: npm install, затем node scripts/screenshot.mjs (Chromium как для npm run assets).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(root + path.slice(1));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/`;

const { chromium } = await import('playwright-core');
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 660 }, reducedMotion: 'reduce' });
  // Днём сцена светлее, поэтому время в браузере закреплено на час дня
  await page.clock.install({ time: new Date('2026-10-02T13:00:00') });
  await page.goto(url, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Что умеешь?' }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: root + 'docs/screen.png', animations: 'disabled' });
} finally {
  await browser.close();
  server.close();
}
