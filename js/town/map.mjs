// Карта городка: сетка тайлов и здания. Модуль без DOM, его проверяют тесты на Node.
//
// Карта не нарисована руками символ за символом, а собрана из прямоугольников:
// дороги, площадь, пруд, деревья. Так её легко менять, а тест сам проверяет,
// что к каждой двери можно дойти от точки появления.

export const TILE = 16;           // размер тайла в пикселях карты
export const MAP_W = 40;
export const MAP_H = 28;

// Виды тайлов. solid: сквозь тайл нельзя пройти.
export const TILES = {
  grass: { solid: false },
  flowers: { solid: false },
  road: { solid: false },
  plaza: { solid: false },
  tree: { solid: true },
  water: { solid: true },
  fountain: { solid: true },
  building: { solid: true },
};

// Здания и объекты. x, y, w, h в тайлах; дверь всегда в нижнем ряду здания,
// а тайл под дверью (front) это место, где стоит гость, когда входит.
// kind: project значит здание проекта из data/projects.json (по полю building).
export const BUILDINGS = [
  { id: 'home', name: 'Дом Ивана', kind: 'home', x: 3, y: 3, w: 6, h: 4, door: 6 },
  { id: 'arena', name: 'Арена', kind: 'project', x: 16, y: 2, w: 8, h: 5, door: 20 },
  { id: 'library', name: 'Библиотека', kind: 'project', x: 30, y: 3, w: 6, h: 4, door: 33 },
  { id: 'counting', name: 'Счётная контора', kind: 'project', x: 3, y: 12, w: 5, h: 4, door: 5 },
  { id: 'workshop', name: 'Мастерская', kind: 'project', x: 31, y: 12, w: 6, h: 4, door: 33 },
  { id: 'post', name: 'Почта', kind: 'contacts', x: 4, y: 20, w: 5, h: 4, door: 6 },
  { id: 'garden', name: 'Сад желаний', kind: 'project', x: 29, y: 20, w: 8, h: 5, door: 32 },
  { id: 'board', name: 'Доска объявлений', kind: 'board', x: 17, y: 11, w: 2, h: 1, door: 17 },
  { id: 'well', name: 'Колодец', kind: 'well', x: 13, y: 22, w: 1, h: 1, door: 13 },
];

// Где гость появляется: на дорожке перед Домом Ивана.
export const SPAWN = { tx: 6, ty: 8 };

// Прямоугольники поверх травы, по порядку: что позже, то сверху.
const LAYOUT = [
  // дороги
  ['road', 2, 9, 36, 1],     // верхняя улица
  ['road', 2, 18, 36, 1],    // средняя улица
  ['road', 2, 25, 36, 1],    // нижняя улица
  ['road', 10, 10, 1, 15],   // левый проезд между улицами
  ['road', 29, 10, 1, 8],    // правый проезд к средней улице
  ['road', 27, 19, 1, 6],    // правый проезд к нижней улице (вдоль сада)
  ['road', 6, 7, 1, 2],      // от Дома к улице
  ['road', 20, 7, 1, 2],     // от Арены
  ['road', 33, 7, 1, 2],     // от Библиотеки
  ['road', 19, 10, 2, 2],    // с улицы на площадь
  ['road', 5, 16, 1, 2],     // от Счётной конторы
  ['road', 33, 16, 1, 2],    // от Мастерской
  ['road', 6, 24, 1, 1],     // от Почты
  ['road', 11, 14, 4, 1],    // с левого проезда на площадь
  ['road', 25, 14, 4, 1],    // с площади к правому проезду
  ['road', 11, 23, 3, 1],    // к колодцу
  // площадь с фонтаном
  ['plaza', 15, 12, 10, 6],
  ['fountain', 19, 14, 2, 2],
  // пруд
  ['water', 16, 20, 9, 4],
  // клумбы
  ['flowers', 12, 3, 2, 2],
  ['flowers', 25, 4, 2, 1],
  ['flowers', 14, 20, 1, 2],
  ['flowers', 2, 15, 1, 2],
];

// Деревья: рамка по краю карты и несколько отдельных.
const TREES = [
  [11, 2], [13, 6], [26, 2], [27, 6], [37, 8], [2, 11], [8, 11], [12, 16],
  [26, 16], [37, 16], [2, 22], [10, 26], [25, 21], [26, 23], [14, 26], [22, 26], [30, 26],
];

export function buildGrid() {
  const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill('grass'));
  const fill = (tile, x, y, w, h) => {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) grid[j][i] = tile;
  };
  for (const [tile, x, y, w, h] of LAYOUT) fill(tile, x, y, w, h);
  // рамка из деревьев, чтобы край карты выглядел как лес, а не как обрыв
  fill('tree', 0, 0, MAP_W, 1);
  fill('tree', 0, MAP_H - 1, MAP_W, 1);
  fill('tree', 0, 0, 1, MAP_H);
  fill('tree', MAP_W - 1, 0, 1, MAP_H);
  for (const [x, y] of TREES) grid[y][x] = 'tree';
  for (const b of BUILDINGS) fill('building', b.x, b.y, b.w, b.h);
  return grid;
}

export function doorTile(b) {
  return { tx: b.door, ty: b.y + b.h - 1 };
}

// Тайл перед дверью: сюда ведёт клик по зданию.
export function frontTile(b) {
  return { tx: b.door, ty: b.y + b.h };
}

// Здание, которому принадлежит тайл, или null.
export function buildingAt(tx, ty) {
  return BUILDINGS.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) || null;
}

// Функция «можно ли стоять на тайле» для столкновений и поиска пути.
// Всё за краем карты считается стеной.
export function makeSolid(grid) {
  return (tx, ty) => {
    if (tx < 0 || ty < 0 || ty >= grid.length || tx >= grid[0].length) return true;
    return TILES[grid[ty][tx]].solid;
  };
}
