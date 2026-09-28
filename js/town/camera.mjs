// Камера и масштаб. Без DOM.

// Во сколько раз увеличить пиксели карты. Целое число, чтобы пиксель-арт
// оставался чётким: при масштабе 2,5 одни пиксели были бы шире других.
// Цель: на экране видно примерно 20 на 12 тайлов, но пиксель не меньше 2.
export function pixelScale(viewW, viewH, tile = 16) {
  const s = Math.floor(Math.min(viewW / (tile * 20), viewH / (tile * 12)));
  return Math.max(2, s);
}

// Где должен стоять левый верхний угол камеры, чтобы цель была в центре,
// но за край карты камера не заезжала. Если карта меньше экрана, она по центру.
export function cameraTarget(focusX, focusY, viewW, viewH, mapW, mapH) {
  const clampAxis = (focus, view, map) => {
    if (map <= view) return (map - view) / 2;
    return Math.min(Math.max(focus - view / 2, 0), map - view);
  };
  return { x: clampAxis(focusX, viewW, mapW), y: clampAxis(focusY, viewH, mapH) };
}

// Мягкое следование: за время dt камера проходит одну и ту же долю пути
// при любой частоте кадров. При уменьшении движения камера не плывёт, а стоит на месте цели.
export function follow(cam, target, dt, { reducedMotion = false, rate = 8 } = {}) {
  if (reducedMotion) return { x: target.x, y: target.y };
  const k = 1 - Math.exp(-rate * dt);
  const x = cam.x + (target.x - cam.x) * k;
  const y = cam.y + (target.y - cam.y) * k;
  // Когда осталось меньше десятой пикселя, встаём ровно, чтобы не дрожало.
  return {
    x: Math.abs(target.x - x) < 0.1 ? target.x : x,
    y: Math.abs(target.y - y) < 0.1 ? target.y : y,
  };
}
