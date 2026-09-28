// Рисование городка на canvas. Всё рисуется кодом, без файлов картинок.
// Статичная часть (земля, здания, деревья) рисуется один раз в отдельный холст,
// а в каждом кадре на экран копируется видимый кусок и сверху персонаж.

import { TILE, MAP_W, MAP_H, BUILDINGS, doorTile } from './map.mjs';
import { TREE, TREE_PALETTE, EMBLEMS, EMBLEM_PALETTE, HERO, HERO_PALETTE } from './sprites.mjs';

// Палитра та же, что в css/site.css.
export const C = {
  ink: '#2b2139',
  grass: '#5a9b4c',
  grassDark: '#4c8a41',
  grassLight: '#6fae5c',
  road: '#d2ad73',
  roadDark: '#b8905a',
  plaza: '#cfc6b4',
  plazaDark: '#b3a992',
  water: '#4a86c5',
  waterLight: '#8fbbe6',
  wall: '#f4ecd8',
  wallDark: '#d9ccb0',
  roof: '#c8553d',
  roofDark: '#9c3f2d',
  wood: '#8a5a3b',
  woodDark: '#6b4430',
  gold: '#e8b04b',
  stone: '#9a93a6',
  stoneDark: '#6f6880',
  glass: '#6fa8dc',
  flowers: ['#e8b04b', '#f4ecd8', '#c8553d', '#b98ad6'],
};

// Псевдослучайное число от координат: трава выглядит живой, но одинаково при каждой загрузке.
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawSprite(ctx, rows, palette, x, y, scale = 1) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === '.') continue;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }
  });
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawGrass(ctx, tx, ty) {
  const x = tx * TILE;
  const y = ty * TILE;
  rect(ctx, C.grass, x, y, TILE, TILE);
  for (let k = 0; k < 3; k += 1) {
    if (hash2(tx, ty, k) < 0.55) {
      const px = x + Math.floor(hash2(tx, ty, k + 10) * 14);
      const py = y + Math.floor(hash2(tx, ty, k + 20) * 13);
      rect(ctx, C.grassDark, px, py + 1, 1, 2);
      rect(ctx, C.grassDark, px + 2, py, 1, 3);
      rect(ctx, C.grassLight, px + 1, py + 2, 1, 1);
    }
  }
}

function drawFlowers(ctx, tx, ty) {
  drawGrass(ctx, tx, ty);
  for (let k = 0; k < 4; k += 1) {
    const px = tx * TILE + 2 + Math.floor(hash2(tx, ty, k + 30) * 11);
    const py = ty * TILE + 2 + Math.floor(hash2(tx, ty, k + 40) * 11);
    const color = C.flowers[Math.floor(hash2(tx, ty, k + 50) * C.flowers.length)];
    rect(ctx, color, px, py, 2, 2);
    rect(ctx, C.grassDark, px, py + 2, 1, 1);
  }
}

function drawRoad(ctx, tx, ty) {
  const x = tx * TILE;
  const y = ty * TILE;
  rect(ctx, C.road, x, y, TILE, TILE);
  for (let k = 0; k < 4; k += 1) {
    if (hash2(tx, ty, k + 60) < 0.6) {
      rect(ctx, C.roadDark, x + Math.floor(hash2(tx, ty, k + 70) * 15), y + Math.floor(hash2(tx, ty, k + 80) * 15), 1, 1);
    }
  }
}

function drawPlaza(ctx, tx, ty) {
  const x = tx * TILE;
  const y = ty * TILE;
  rect(ctx, C.plaza, x, y, TILE, TILE);
  // плитка со сдвигом через ряд, как мостовая
  rect(ctx, C.plazaDark, x, y + 7, TILE, 1);
  rect(ctx, C.plazaDark, x, y + 15, TILE, 1);
  const off = ty % 2 ? 4 : 12;
  rect(ctx, C.plazaDark, x + off, y, 1, 7);
  rect(ctx, C.plazaDark, x + ((off + 8) % 16), y + 8, 1, 7);
}

function drawWater(ctx, tx, ty, isWater) {
  const x = tx * TILE;
  const y = ty * TILE;
  rect(ctx, C.water, x, y, TILE, TILE);
  // светлый край там, где вода граничит с берегом
  if (!isWater(tx, ty - 1)) rect(ctx, C.waterLight, x, y, TILE, 2);
  if (!isWater(tx - 1, ty)) rect(ctx, C.waterLight, x, y, 2, TILE);
  if (!isWater(tx + 1, ty)) rect(ctx, C.waterLight, x + TILE - 2, y, 2, TILE);
  if (!isWater(tx, ty + 1)) rect(ctx, C.waterLight, x, y + TILE - 2, TILE, 2);
  if (hash2(tx, ty, 90) < 0.5) rect(ctx, C.waterLight, x + 4 + Math.floor(hash2(tx, ty, 91) * 6), y + 6, 4, 1);
}

function drawFountain(ctx, x, y) {
  // 2×2 тайла: каменная чаша, вода и струя в центре
  rect(ctx, C.stoneDark, x + 1, y + 3, 30, 28);
  rect(ctx, C.stone, x + 2, y + 2, 28, 27);
  rect(ctx, C.water, x + 5, y + 5, 22, 21);
  rect(ctx, C.waterLight, x + 5, y + 5, 22, 2);
  rect(ctx, C.stone, x + 13, y + 11, 6, 12);
  rect(ctx, C.stoneDark, x + 13, y + 20, 6, 3);
  rect(ctx, C.waterLight, x + 15, y + 4, 2, 8);
  rect(ctx, C.waterLight, x + 11, y + 8, 2, 2);
  rect(ctx, C.waterLight, x + 19, y + 8, 2, 2);
}

// Обычный дом: стены, двускатная крыша уступами, окна, дверь и знак над ней.
function drawHouse(ctx, b, { wall = C.wall, wallDark = C.wallDark, roof = C.roof, roofDark = C.roofDark } = {}) {
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const roofH = Math.floor(h * 0.45);
  // тень на траве под домом
  ctx.fillStyle = 'rgba(43,33,57,0.25)';
  ctx.fillRect(x + 4, y + h - 2, w, 4);
  // стены
  rect(ctx, C.ink, x + 2, y + roofH - 2, w - 4, h - roofH + 2);
  rect(ctx, wall, x + 4, y + roofH, w - 8, h - roofH - 2);
  for (let yy = y + roofH + 5; yy < y + h - 4; yy += 6) rect(ctx, wallDark, x + 4, yy, w - 8, 1);
  // крыша уступами
  for (let row = 0; row < roofH; row += 2) {
    const inset = Math.max(0, Math.floor((roofH - row) / 3) - 2);
    rect(ctx, C.ink, x + inset, y + row, w - inset * 2, 2);
    if (row > 0) rect(ctx, row % 4 ? roof : roofDark, x + inset + 2, y + row, w - inset * 2 - 4, 2);
  }
  rect(ctx, roofDark, x, y + roofH - 2, w, 2);
  // окна по бокам от двери
  const door = doorTile(b);
  const doorX = door.tx * TILE;
  const winY = y + roofH + 6;
  for (let wx = x + 10; wx + 10 < x + w - 6; wx += 22) {
    if (wx + 10 > doorX - 2 && wx < doorX + TILE + 2) continue;
    rect(ctx, C.ink, wx - 1, winY - 1, 12, 11);
    rect(ctx, C.glass, wx, winY, 10, 9);
    rect(ctx, C.ink, wx + 4, winY, 1, 9);
    rect(ctx, C.ink, wx, winY + 4, 10, 1);
    rect(ctx, '#ffffff', wx + 1, winY + 1, 2, 1);
  }
  drawDoor(ctx, doorX, y + h);
  const emblem = EMBLEMS[b.id];
  if (emblem) drawPlate(ctx, emblem, doorX + 2, y + h - 29);
}

// Вывеска 12×12 со знаком здания: тёмная табличка в рамке видна и на светлой стене, и на камне.
function drawPlate(ctx, emblem, x, y) {
  rect(ctx, C.ink, x, y, 12, 12);
  rect(ctx, C.woodDark, x + 1, y + 1, 10, 10);
  drawSprite(ctx, emblem, EMBLEM_PALETTE, x + 2, y + 2);
}

function drawDoor(ctx, doorX, bottom) {
  rect(ctx, C.ink, doorX + 2, bottom - 15, 12, 15);
  rect(ctx, C.wood, doorX + 3, bottom - 14, 10, 14);
  rect(ctx, C.woodDark, doorX + 7, bottom - 14, 1, 14);
  rect(ctx, C.gold, doorX + 10, bottom - 7, 1, 2);
  rect(ctx, C.road, doorX + 1, bottom - 1, 14, 1);
}

// Арена: круглые каменные стены с арками и флажками вместо крыши.
function drawArena(ctx, b) {
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  ctx.fillStyle = 'rgba(43,33,57,0.25)';
  ctx.fillRect(x + 6, y + h - 2, w - 8, 4);
  rect(ctx, C.ink, x + 6, y + 8, w - 12, h - 8);
  rect(ctx, C.ink, x + 2, y + 16, w - 4, h - 16);
  rect(ctx, C.stone, x + 4, y + 18, w - 8, h - 20);
  rect(ctx, C.stone, x + 8, y + 10, w - 16, 10);
  rect(ctx, C.stoneDark, x + 8, y + 18, w - 16, 2);
  // полосатые ленты на верхнем ярусе, как на празднике
  for (let lx = x + 10; lx < x + w - 10; lx += 6) rect(ctx, lx % 12 < 6 ? C.roof : C.gold, lx, y + 14, 6, 3);
  // верхний ряд зубцов
  for (let zx = x + 10; zx < x + w - 12; zx += 8) rect(ctx, C.stoneDark, zx, y + 10, 4, 3);
  // арки в два ряда
  for (let row = 0; row < 2; row += 1) {
    const ay = y + 26 + row * 22;
    for (let ax = x + 10; ax + 10 < x + w - 6; ax += 16) {
      rect(ctx, C.ink, ax + 3, ay, 4, 1);
      rect(ctx, C.ink, ax + 1, ay + 1, 8, 2);
      rect(ctx, C.ink, ax, ay + 3, 10, 12);
      rect(ctx, C.wallDark, ax + 4, ay - 2, 2, 2);
      rect(ctx, C.stoneDark, ax - 2, ay + 15, 14, 1);
    }
  }
  // флажки с двух сторон
  for (const fx of [x + 12, x + w - 16]) {
    rect(ctx, C.ink, fx, y - 6, 1, 18);
    rect(ctx, C.roof, fx + 1, y - 6, 7, 5);
    rect(ctx, C.gold, fx + 1, y - 6, 7, 1);
  }
  const doorX = doorTile(b).tx * TILE;
  rect(ctx, C.stone, doorX - 4, y + h - 20, TILE + 8, 20);
  drawDoor(ctx, doorX, y + h);
  drawPlate(ctx, EMBLEMS.arena, doorX + 2, y + h - 32);
}

// Сад желаний: забор, клумбы и арка-калитка.
function drawGarden(ctx, b) {
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  for (let ty = b.y; ty < b.y + b.h; ty += 1) for (let tx = b.x; tx < b.x + b.w; tx += 1) drawGrass(ctx, tx, ty);
  // грядки цветов
  for (let row = 0; row < 3; row += 1) {
    const ry = y + 12 + row * 18;
    rect(ctx, C.woodDark, x + 10, ry, w - 20, 10);
    rect(ctx, '#7a5236', x + 11, ry + 1, w - 22, 8);
    for (let fx = x + 13; fx < x + w - 14; fx += 6) {
      const color = C.flowers[Math.floor(hash2(fx, ry, 5) * C.flowers.length)];
      rect(ctx, C.grassDark, fx + 1, ry + 3, 1, 4);
      rect(ctx, color, fx, ry + 1, 3, 3);
    }
  }
  // забор по краю
  const post = (px, py) => { rect(ctx, C.ink, px, py, 4, 8); rect(ctx, C.wall, px + 1, py + 1, 2, 6); };
  for (let px = x; px < x + w; px += 8) { post(px, y); post(px, y + h - 8); }
  for (let py = y; py < y + h; py += 8) { post(x, py); post(x + w - 4, py); }
  rect(ctx, C.wall, x, y + 3, w, 1);
  rect(ctx, C.wall, x, y + h - 5, w, 1);
  // калитка с аркой
  const doorX = doorTile(b).tx * TILE;
  rect(ctx, C.road, doorX, y + h - 8, TILE, 8);
  rect(ctx, C.ink, doorX - 1, y + h - 26, 3, 26);
  rect(ctx, C.ink, doorX + TILE - 2, y + h - 26, 3, 26);
  rect(ctx, C.ink, doorX - 1, y + h - 28, TILE + 2, 4);
  rect(ctx, C.grassDark, doorX, y + h - 27, TILE, 2);
  drawPlate(ctx, EMBLEMS.garden, doorX + 2, y + h - 42);
}

// Доска объявлений на площади.
function drawBoard(ctx, b) {
  const x = b.x * TILE;
  const y = b.y * TILE;
  rect(ctx, C.ink, x + 4, y + 8, 2, 8);
  rect(ctx, C.ink, x + 26, y + 8, 2, 8);
  rect(ctx, C.ink, x + 1, y - 6, 30, 16);
  rect(ctx, C.wood, x + 2, y - 5, 28, 14);
  rect(ctx, C.wall, x + 5, y - 3, 7, 8);
  rect(ctx, C.wall, x + 14, y - 2, 6, 6);
  rect(ctx, C.gold, x + 22, y - 3, 6, 7);
  rect(ctx, C.roof, x + 8, y - 3, 1, 1);
}

// Колодец: каменное кольцо и навес.
function drawWell(ctx, b) {
  const x = b.x * TILE;
  const y = b.y * TILE;
  rect(ctx, C.ink, x + 1, y + 4, 14, 12);
  rect(ctx, C.stone, x + 2, y + 5, 12, 10);
  rect(ctx, C.water, x + 4, y + 6, 8, 4);
  rect(ctx, C.stoneDark, x + 2, y + 12, 12, 1);
  rect(ctx, C.ink, x + 2, y - 6, 1, 11);
  rect(ctx, C.ink, x + 13, y - 6, 1, 11);
  rect(ctx, C.ink, x - 1, y - 9, 18, 4);
  rect(ctx, C.roof, x, y - 8, 16, 2);
}

const HOUSE_STYLE = {
  home: { roof: '#c8553d', roofDark: '#9c3f2d' },
  library: { wall: '#e8dcc0', roof: '#4a78b5', roofDark: '#355a8a' },
  counting: { wall: '#f4ecd8', roof: '#e8b04b', roofDark: '#b8862f' },
  workshop: { wall: '#d9ccb0', wallDark: '#bfae8c', roof: '#6b5b7a', roofDark: '#4d4060' },
  post: { roof: '#5a9b4c', roofDark: '#3f7338' },
};

function drawBuilding(ctx, b) {
  if (b.id === 'arena') return drawArena(ctx, b);
  if (b.id === 'garden') return drawGarden(ctx, b);
  if (b.id === 'board') return drawBoard(ctx, b);
  if (b.id === 'well') return drawWell(ctx, b);
  return drawHouse(ctx, b, HOUSE_STYLE[b.id] || {});
}

// Рисует всю неподвижную часть карты в переданный контекст размером MAP_W×MAP_H тайлов.
export function drawStatic(ctx, grid) {
  const isWater = (tx, ty) => grid[ty] && grid[ty][tx] === 'water';
  for (let ty = 0; ty < MAP_H; ty += 1) {
    for (let tx = 0; tx < MAP_W; tx += 1) {
      const t = grid[ty][tx];
      if (t === 'road') drawRoad(ctx, tx, ty);
      else if (t === 'plaza' || t === 'fountain') drawPlaza(ctx, tx, ty);
      else if (t === 'water') drawWater(ctx, tx, ty, isWater);
      else if (t === 'flowers') drawFlowers(ctx, tx, ty);
      else drawGrass(ctx, tx, ty);
    }
  }
  // фонтан один на 2×2: ищем его левый верхний тайл
  for (let ty = 0; ty < MAP_H; ty += 1) {
    for (let tx = 0; tx < MAP_W; tx += 1) {
      if (grid[ty][tx] === 'fountain' && grid[ty - 1][tx] !== 'fountain' && grid[ty][tx - 1] !== 'fountain') {
        drawFountain(ctx, tx * TILE, ty * TILE);
      }
    }
  }
  for (const b of BUILDINGS) drawBuilding(ctx, b);
  for (let ty = 0; ty < MAP_H; ty += 1) {
    for (let tx = 0; tx < MAP_W; tx += 1) {
      if (grid[ty][tx] === 'tree') drawSprite(ctx, TREE, TREE_PALETTE, tx * TILE, ty * TILE);
    }
  }
}

// Персонаж: тень и кадр спрайта. (x, y) это точка у ног в пикселях карты.
export function drawHero(ctx, x, y, dir, frame) {
  const sx = Math.round(x - 8);
  const sy = Math.round(y - 16);
  ctx.fillStyle = 'rgba(43,33,57,0.3)';
  ctx.fillRect(sx + 4, sy + 14, 8, 2);
  ctx.fillRect(sx + 3, sy + 15, 10, 1);
  drawSprite(ctx, HERO[dir][frame], HERO_PALETTE, sx, sy);
}

// Отметка цели после клика: мигающий уголок на тайле.
export function drawTarget(ctx, tx, ty, time) {
  if (Math.floor(time * 3) % 2) return;
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = C.gold;
  // четыре уголка, каждый смотрит внутрь тайла
  for (const [cx, cy, sx, sy] of [[1, 1, 1, 1], [14, 1, -1, 1], [1, 14, 1, -1], [14, 14, -1, -1]]) {
    ctx.fillRect(x + (sx > 0 ? cx : cx - 3), y + cy, 4, 1);
    ctx.fillRect(x + cx, y + (sy > 0 ? cy : cy - 3), 1, 4);
  }
}
