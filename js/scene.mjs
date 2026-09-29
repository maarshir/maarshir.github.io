// Пиксельная сцена первого экрана: Иван за компьютером у окна.
// Время суток берётся по часам гостя. Модуль без DOM: сцена собирается в SVG при сборке,
// в браузере js/live.mjs только ставит атрибут data-phase, а цвета и видимость решает CSS.

import { AVATAR_PALETTE } from './avatar.mjs';

export const SCENE_W = 80;
export const SCENE_H = 30;

// Утро с 5 до 10, день до 18, вечер до 22, остальное ночь. Часы гостя, 0–23.
export const PHASES = ['morning', 'day', 'evening', 'night'];

export function phaseAt(hour) {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

// Сколько ждать до следующей смены времени суток, в минутах: чтобы не проверять часы каждую секунду.
export function minutesToNextPhase(hour, minute) {
  const bounds = [5, 10, 18, 22];
  const now = hour * 60 + minute;
  const next = bounds.map((b) => b * 60).find((b) => b > now) ?? 24 * 60 + bounds[0] * 60;
  return next - now;
}

// Без JavaScript сцена днём.
export const DEFAULT_PHASE = 'day';

const PALETTE = {
  ...AVATAR_PALETTE,
  p: '#3d3553', // брюки
  b: '#2b2139', // ботинки и контуры
  o: '#6b4430', // тёмное дерево
  n: '#8a5a3b', // дерево
  g: '#5a9b4c', // листья
  d: '#3f7338', // тёмные листья
  r: '#c8553d', // горшок и кружка
  y: '#e8b04b', // лампа
  e: '#5e5470', // корпус монитора
  x: '#2b2139', // клавиатура
};

// Персонаж сидит боком, лицом к монитору. Руки отдельно, у них два кадра.
const PERSON = [
  '...hhhhhh.........',
  '..hhhhhhhh........',
  '.hhhhhhhhhh.......',
  '.hhhhhhhsss.......',
  '.hhhhhhssks.......',
  '.hhhhhhsssss......',
  '..hhhhsssss.......',
  '...hhssssm........',
  '.....ssss.........',
  '...cccccccc.......',
  '..cccccccccc......',
  '..cccccccccc......',
  '..cccccccccc......',
  '..cccccccccc......',
  '..cccccccccc......',
  '..pppppppppppp....',
  '..pppppppppppp....',
  '...........pp.....',
  '...........pp.....',
  '...........pp.....',
  '...........pp.....',
  '..........bbbbb...',
];

// Руки на клавиатуре: кадр 0 пальцы внизу, кадр 1 чуть приподняты. Чередуются, как будто печатает.
export const ARMS = [
  [
    '..........cc......',
    '...........ccc....',
    '............ccss..',
  ],
  [
    '..........cc......',
    '...........cccss..',
    '..................',
  ],
];

const CHAIR = [
  'oo..........',
  'oo..........',
  'oo..........',
  'oo..........',
  'oo..........',
  'oo..........',
  'oo..........',
  'oo..........',
  'oonnnnnnnnnn',
  '.....oo.....',
  '.....oo.....',
  '.....oo.....',
  '..oooooooo..',
];

const PLANT = [
  '..g..d.',
  '.gg.dd.',
  '.ggdddg',
  'gggddgg',
  '.gdgggd',
  '..gdg..',
  '.rrrrr.',
  '.rrrrr.',
  '..rrr..',
];

const LAMP = [
  '.yyyy..',
  'yyyyyy.',
  '...o...',
  '....o..',
  '....o..',
  '....o..',
  '....o..',
  '...ooo.',
];

const MUG = [
  'rrr.',
  'rrrr',
  'rrr.',
];

// Проверка спрайтов: все ряды одной длины и все буквы есть в палитре. Вызывается в тестах.
export function checkSprite(rows, palette = PALETTE) {
  const width = rows[0].length;
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`ряд ${y}: длина ${row.length}, а нужно ${width}`);
    for (const ch of row) if (ch !== '.' && !palette[ch]) throw new Error(`нет цвета для «${ch}»`);
  });
  return { width, height: rows.length };
}

export const SPRITES = { PERSON, CHAIR, PLANT, LAMP, MUG, ...Object.fromEntries(ARMS.map((a, i) => [`ARMS${i}`, a])) };

// Спрайт в прямоугольники со сдвигом. Соседние пиксели одного цвета склеиваются, как в avatar.mjs.
function spriteRects(rows, ox, oy, palette = PALETTE) {
  const out = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      if (ch !== '.') out.push(rect(ox + x, oy + y, end - x, 1, palette[ch]));
      x = end;
    }
  });
  return out.join('');
}

function rect(x, y, w, h, fill, cls = '') {
  const c = cls ? ` class="${cls}"` : '';
  const f = fill ? ` fill="${fill}"` : '';
  return `<rect${c} x="${x}" y="${y}" width="${w}" height="${h}"${f}/>`;
}

const group = (cls, inner) => `<g class="${cls}">${inner}</g>`;

// Слои снизу вверх. Порядок важен: тень ночи ложится на комнату, но не на небо,
// экран, свет лампы и её плафон, поэтому они идут после неё и светятся в темноте.
export function renderScene(phase = DEFAULT_PHASE) {
  if (!PHASES.includes(phase)) throw new Error(`Неизвестное время суток: ${phase}`);
  const room = [
    rect(0, 0, SCENE_W, 25, '#e9dcc0'),            // стена
    rect(0, 22, SCENE_W, 3, '#d8c7a6'),            // полоса у пола
    rect(0, 25, SCENE_W, 5, '#8a5a3b'),            // пол
    rect(0, 25, SCENE_W, 1, '#6b4430'),
    rect(4, 3, 20, 16, '#8a5a3b'),                 // рама окна
    rect(3, 18, 22, 2, '#6b4430'),                 // подоконник
    spriteRects(PLANT, 26, 16),
    rect(38, 16, 41, 2, '#8a5a3b'),                // стол
    rect(38, 17, 41, 1, '#6b4430'),
    rect(40, 18, 2, 7, '#6b4430'),
    rect(75, 18, 2, 7, '#6b4430'),
    spriteRects(CHAIR, 31, 12),
    spriteRects(PERSON, 31, 3),
    group('arms arms-0', spriteRects(ARMS[0], 31, 13)),
    group('arms arms-1', spriteRects(ARMS[1], 31, 13)),
    rect(45, 15, 7, 1, PALETTE.x),                 // клавиатура
    rect(50, 2, 18, 11, PALETTE.e),                // монитор
    rect(57, 13, 4, 2, PALETTE.e),
    rect(55, 15, 8, 1, PALETTE.e),
    spriteRects(MUG, 68, 12),
    group('steam', rect(69, 9, 1, 1, '#fffaf0') + rect(70, 10, 1, 1, '#fffaf0')),
    spriteRects(LAMP, 72, 8),
  ].join('');

  const sky = [
    rect(5, 4, 18, 14, null, 'sky'),
    group('sun', rect(17, 6, 4, 4, '#f7d56b') + rect(16, 7, 6, 2, '#f7d56b')),
    group('cloud', rect(16, 15, 5, 1, '#fffaf0') + rect(17, 14, 2, 1, '#fffaf0')),
    group('moon', rect(8, 6, 3, 4, '#f4ecd8') + rect(7, 7, 1, 2, '#f4ecd8') + rect(10, 6, 2, 1, null, 'sky') + rect(10, 9, 2, 1, null, 'sky')),
    group('stars', rect(16, 6, 1, 1, '#fffaf0') + rect(20, 12, 1, 1, '#fffaf0') + rect(13, 15, 1, 1, '#fffaf0') + rect(6, 11, 1, 1, '#fffaf0')),
    rect(13, 4, 2, 14, '#8a5a3b'),                 // переплёт
    rect(5, 10, 18, 1, '#8a5a3b'),
    rect(13, 4, 2, 14, '#0d1330', 'shade'),        // переплёт тоже темнеет ночью
    rect(5, 10, 18, 1, '#0d1330', 'shade'),
  ].join('');

  const glow = [
    rect(51, 3, 16, 9, '#2b2139', 'screen'),
    group('code', [
      rect(53, 4, 6, 1, '#7fbf6a', 'line line-1'),
      rect(55, 6, 8, 1, '#e8b04b', 'line line-2'),
      rect(55, 8, 5, 1, '#8fbbe6', 'line line-3'),
      rect(53, 10, 7, 1, '#7fbf6a', 'line line-4'),
    ].join('')),
    rect(61, 10, 1, 1, '#fffaf0', 'cursor'),
    group('lamp-light', rect(71, 10, 8, 2, '#f7d56b') + rect(69, 12, 10, 2, '#f7d56b') + rect(67, 14, 12, 2, '#f7d56b')),
    group('bulb', rect(73, 9, 4, 1, '#fff3c4')),
  ].join('');

  return `<svg class="scene" data-phase="${phase}" viewBox="0 0 ${SCENE_W} ${SCENE_H}" shape-rendering="crispEdges" aria-hidden="true">`
    + `${room}${rect(0, 0, SCENE_W, SCENE_H, '#0d1330', 'shade')}${sky}${glow}</svg>`;
}
