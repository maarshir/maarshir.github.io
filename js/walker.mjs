// Персонаж у правого края: где он стоит, куда смотрит и какой кадр шага показать.
// Без DOM, чтобы проверять тестами. С браузером работает js/live.mjs.

// Персонаж проходит полосу от TOP до BOTTOM высоты окна, пока страница прокручивается от начала до конца.
export const TOP = 0.12;
export const BOTTOM = 0.82;
// Один шаг на столько пикселей прокрутки: шаги совпадают с движением, а не с часами.
export const STEP_PX = 28;
// Если прокрутка стоит дольше, персонаж встаёт в позу «стоит».
export const IDLE_MS = 180;

export function progress(scrollY, maxScroll) {
  if (!(maxScroll > 0)) return 0;
  return Math.min(1, Math.max(0, scrollY / maxScroll));
}

// Верх персонажа в пикселях окна.
export function walkerTop(scrollY, maxScroll, viewportH, size = 48) {
  const span = Math.max(0, viewportH * (BOTTOM - TOP) - size);
  return Math.round(viewportH * TOP + span * progress(scrollY, maxScroll));
}

export function initialState(scrollY = 0) {
  return { y: scrollY, dir: 'down', walked: 0, lastMove: -Infinity };
}

// Новое состояние после прокрутки. Направление меняется, только когда прокрутка действительно сдвинулась.
export function update(state, scrollY, now) {
  const delta = scrollY - state.y;
  if (delta === 0) return state;
  return {
    y: scrollY,
    dir: delta > 0 ? 'down' : 'up',
    walked: state.walked + Math.abs(delta),
    lastMove: now,
  };
}

// Кадр: 0 стоит, 1 и 2 шаги. Порядок шагов тот же, что в городке: 1, 0, 2, 0.
export function frame(state, now) {
  if (now - state.lastMove > IDLE_MS) return 0;
  return [1, 0, 2, 0][Math.floor(state.walked / STEP_PX) % 4];
}
