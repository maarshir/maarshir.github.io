// Движение персонажа со столкновениями. Без DOM.
//
// Положение персонажа это точка у его ног (x, y) в пикселях карты. Сталкивается
// не весь спрайт, а только небольшой прямоугольник у ног: так персонаж может
// встать вплотную к стене дома, а голова зайдёт на стену, как в старых играх.

import { TILE } from './map.mjs';

export const FEET = { w: 10, h: 6 };   // прямоугольник у ног
export const SPEED = 80;                // пикселей карты в секунду, 5 тайлов
const MAX_STEP = 4;                     // не больше 4 пикселей за шаг проверки, чтобы не проскочить стену

export function feetBox(x, y) {
  return { left: x - FEET.w / 2, top: y - FEET.h, right: x + FEET.w / 2, bottom: y };
}

// Пересекает ли прямоугольник ног хоть один непроходимый тайл.
export function hitsWall(x, y, solid) {
  const b = feetBox(x, y);
  // Правая и нижняя грани не включаются: стоять вплотную к стене можно.
  const tx0 = Math.floor(b.left / TILE);
  const tx1 = Math.floor((b.right - 0.001) / TILE);
  const ty0 = Math.floor(b.top / TILE);
  const ty1 = Math.floor((b.bottom - 0.001) / TILE);
  for (let ty = ty0; ty <= ty1; ty += 1) {
    for (let tx = tx0; tx <= tx1; tx += 1) if (solid(tx, ty)) return true;
  }
  return false;
}

// Сдвиг по одной оси до упора. Двигаемся мелкими шагами, а при касании стены
// находим последнее свободное положение делением пополам.
function moveAxis(pos, delta, axis, solid) {
  let { x, y } = pos;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / MAX_STEP));
  const part = delta / steps;
  for (let i = 0; i < steps; i += 1) {
    const nx = axis === 'x' ? x + part : x;
    const ny = axis === 'y' ? y + part : y;
    if (!hitsWall(nx, ny, solid)) { x = nx; y = ny; continue; }
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 10; k += 1) {
      const mid = (lo + hi) / 2;
      const mx = axis === 'x' ? x + part * mid : x;
      const my = axis === 'y' ? y + part * mid : y;
      if (hitsWall(mx, my, solid)) hi = mid; else lo = mid;
    }
    if (axis === 'x') x += part * lo; else y += part * lo;
    return { x, y, blocked: true };
  }
  return { x, y, blocked: false };
}

// Сдвиг на (dx, dy) со скольжением вдоль стен: сначала по x, потом по y.
// Если упёрлись по одной оси, по другой всё равно двигаемся.
export function move(pos, dx, dy, solid) {
  const a = moveAxis(pos, dx, 'x', solid);
  const b = moveAxis(a, dy, 'y', solid);
  return { x: b.x, y: b.y, blockedX: a.blocked, blockedY: b.blocked };
}

// Направление с клавиатуры в скорость. По диагонали не быстрее, чем по прямой.
export function velocity(dirX, dirY, speed = SPEED) {
  const len = Math.hypot(dirX, dirY);
  if (len === 0) return { vx: 0, vy: 0 };
  return { vx: (dirX / len) * speed, vy: (dirY / len) * speed };
}

// Куда смотрит персонаж. При движении по диагонали сохраняем прежнее направление,
// если оно одно из двух, иначе берём горизонтальное.
export function facing(prev, vx, vy) {
  if (vx === 0 && vy === 0) return prev;
  const horizontal = vx < 0 ? 'left' : 'right';
  const vertical = vy < 0 ? 'up' : 'down';
  if (vx === 0) return vertical;
  if (vy === 0) return horizontal;
  if (prev === horizontal || prev === vertical) return prev;
  return horizontal;
}

// Центр тайла в пикселях у ног: так персонаж встаёт по центру клетки.
export function tileFeet(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 3 };
}
