// Пиксельный аватар Ивана 16×16, нарисован для этого сайта.
// Каждая строка это ряд пикселей, каждая буква это цвет из палитры, точка это прозрачный пиксель.
// Тот же спрайт позже возьмёт городок, поэтому он лежит отдельно от вёрстки.

export const AVATAR_PALETTE = {
  h: '#3b2a20', // волосы
  s: '#f1c9a5', // кожа
  k: '#2b2139', // глаза
  m: '#b5534a', // улыбка
  c: '#4a78b5', // футболка
  w: '#f4ecd8', // ворот
};

export const AVATAR = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hhsssssshh...',
  '...hssssssssh...',
  '...ssksssskss...',
  '...ssssssssss...',
  '...sssmmmmsss...',
  '....ssssssss....',
  '......ssss......',
  '...cccccccccc...',
  '..cccccwwccccc..',
  '..cccccccccccc..',
  '.cccccccccccccc.',
  '.cccccccccccccc.',
];

// Превращает спрайт в SVG. Соседние пиксели одного цвета в ряду склеиваются
// в один прямоугольник: так разметка в несколько раз короче.
export function spriteToSvg(rows, palette, { title = '', className = '' } = {}) {
  const height = rows.length;
  const width = rows[0].length;
  const rects = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < width) {
      const ch = row[x];
      let end = x + 1;
      while (end < width && row[end] === ch) end += 1;
      if (ch !== '.') {
        const fill = palette[ch];
        if (!fill) throw new Error(`Нет цвета для «${ch}» в ряду ${y}`);
        rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`);
      }
      x = end;
    }
  });
  const cls = className ? ` class="${className}"` : '';
  const label = title ? ` role="img" aria-label="${title}"` : ' aria-hidden="true"';
  return `<svg${cls} viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"${label}>${rects.join('')}</svg>`;
}
