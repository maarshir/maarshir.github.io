// Спрайты городка строками букв, как аватар в js/avatar.mjs. Без DOM.
// Всё нарисовано для этого сайта. Точка это прозрачный пиксель.

import { AVATAR_PALETTE } from '../avatar.mjs';

// Персонаж в тех же цветах, что и аватар, плюс брюки и ботинки.
export const HERO_PALETTE = { ...AVATAR_PALETTE, p: '#3d3553', b: '#2b2139' };

const DOWN_TOP = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hssssssh....',
  '....skssssks....',
  '....ssssssss....',
  '.....ssmmss.....',
  '....cccwwccc....',
  '...cccccccccc...',
  '...sccccccccs...',
  '....cccccccc....',
  '....pppppppp....',
];
const UP_TOP = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....shhhhhhs....',
  '.....ssssss.....',
  '....cccccccc....',
  '...cccccccccc...',
  '...sccccccccs...',
  '....cccccccc....',
  '....pppppppp....',
];
const LEFT_TOP = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....sssshhhh....',
  '....ksssshhh....',
  '....ssssssh.....',
  '.....msssss.....',
  '.....cccccc.....',
  '....ccccccc.....',
  '....cccsccc.....',
  '.....cccccc.....',
  '.....pppppp.....',
];

// Ноги: стоит, шаг одной ногой, шаг другой.
const FRONT_LEGS = [
  ['....ppp..ppp....', '....ppp..ppp....', '....bbb..bbb....'],
  ['....ppp..ppp....', '....ppp..bbb....', '....bbb.........'],
  ['....ppp..ppp....', '....bbb..ppp....', '.........bbb....'],
];
const SIDE_LEGS = [
  ['.....pp..pp.....', '.....pp..pp.....', '....bbb.bbb.....'],
  ['....pp....pp....', '...pp......pp...', '..bbb.....bbb...'],
  ['.....pp..pp.....', '.....pppppp.....', '.....bbbbbb.....'],
];

export function mirror(rows) {
  return rows.map((r) => [...r].reverse().join(''));
}

const frames = (top, legs) => legs.map((l) => [...top, ...l]);

// HERO[направление][кадр]: кадр 0 стоит, 1 и 2 шаги.
export const HERO = {
  down: frames(DOWN_TOP, FRONT_LEGS),
  up: frames(UP_TOP, FRONT_LEGS),
  left: frames(LEFT_TOP, SIDE_LEGS),
  right: frames(LEFT_TOP, SIDE_LEGS).map(mirror),
};

// Какой кадр показать: пока идёт, шаги чередуются 1, 0, 2, 0.
export function walkFrame(moving, time, stepTime = 0.14) {
  if (!moving) return 0;
  return [1, 0, 2, 0][Math.floor(time / stepTime) % 4];
}

// Дерево занимает тайл 16×16.
export const TREE_PALETTE = { d: '#2f5a2c', g: '#3f7338', l: '#5a9b4c', t: '#6b4430', o: '#2b2139' };
export const TREE = [
  '.....oooooo.....',
  '...oogglllgoo...',
  '..ogglllllllgo..',
  '.oggllllllllggo.',
  '.ogglllllllgggo.',
  'ogggllllllggggdo',
  'oggggllllgggggdo',
  'ogggggggggggggdo',
  '.ogggggggggggddo',
  '.oddggggggggddo.',
  '..oddddgggdddo..',
  '...ooddddddoo...',
  '.....ootto......',
  '......otto......',
  '.....otttto.....',
  '................',
];

// Знаки над дверями 8×8: по ним здание узнаётся без надписи.
export const EMBLEM_PALETTE = {
  k: '#2b2139', y: '#e8b04b', r: '#c8553d', w: '#fffaf0', b: '#4a78b5', g: '#5a9b4c', n: '#8a5a3b',
};
export const EMBLEMS = {
  // Дом: сердечко, потому что свой дом
  home: [
    '........',
    '.rr..rr.',
    'rrrrrrrr',
    'rrrrrrrr',
    '.rrrrrr.',
    '..rrrr..',
    '...rr...',
    '........',
  ],
  // Арена: кубок
  arena: [
    'yyyyyyyy',
    'yyyyyyyy',
    '.yyyyyy.',
    '..yyyy..',
    '...yy...',
    '...yy...',
    '..yyyy..',
    '.yyyyyy.',
  ],
  // Библиотека: раскрытая книга
  library: [
    '........',
    'www..www',
    'wkww.wkw',
    'wwww.www',
    'wkww.wkw',
    'wwwwwwww',
    'bbbbbbbb',
    '........',
  ],
  // Счётная контора: монета
  counting: [
    '..yyyy..',
    '.yykkyy.',
    'yyykyyyy',
    'yyyykyyy',
    'yyyyykyy',
    'yyykkyyy',
    '.yyyyyy.',
    '..yyyy..',
  ],
  // Мастерская: гаечный ключ
  workshop: [
    '.ww..ww.',
    '.ww..ww.',
    '.wwwwww.',
    '..wwww..',
    '...ww...',
    '...ww...',
    '...ww...',
    '...ww...',
  ],
  // Почта: конверт
  post: [
    '........',
    'wwwwwwww',
    'wkwwwwkw',
    'wwkwwkww',
    'wwwkkwww',
    'wwwwwwww',
    'wwwwwwww',
    '........',
  ],
  // Сад желаний: цветок
  garden: [
    '..r..r..',
    '.rrrrrr.',
    '..ryyr..',
    '.rryyrr.',
    '..rrrr..',
    '...gg...',
    '.gggg...',
    '...gg...',
  ],
};
