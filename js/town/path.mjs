// Поиск пути по клику: A* по сетке тайлов, ходы в четыре стороны. Без DOM.

// Простая двоичная куча: на карте 40×28 можно было бы и перебором,
// но куча не даёт поиску замедлиться, если карта вырастет.
class Heap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Путь от тайла start до тайла goal списком тайлов, включая оба конца.
// null, если дойти нельзя. solid(tx, ty) отвечает, занят ли тайл.
export function findPath(start, goal, solid) {
  if (solid(goal.tx, goal.ty)) return null;
  const key = (tx, ty) => `${tx},${ty}`;
  const h = (tx, ty) => Math.abs(tx - goal.tx) + Math.abs(ty - goal.ty);
  const open = new Heap();
  const cameFrom = new Map();
  const cost = new Map([[key(start.tx, start.ty), 0]]);
  open.push({ tx: start.tx, ty: start.ty, f: h(start.tx, start.ty) });
  while (open.size > 0) {
    const cur = open.pop();
    const ck = key(cur.tx, cur.ty);
    if (cur.tx === goal.tx && cur.ty === goal.ty) {
      const path = [{ tx: cur.tx, ty: cur.ty }];
      let k = ck;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k);
        path.push(prev);
        k = key(prev.tx, prev.ty);
      }
      return path.reverse();
    }
    const g = cost.get(ck);
    if (cur.f > g + h(cur.tx, cur.ty)) continue; // устаревшая запись в куче
    for (const [dx, dy] of DIRS) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      if (solid(nx, ny)) continue;
      const nk = key(nx, ny);
      const ng = g + 1;
      if (!cost.has(nk) || ng < cost.get(nk)) {
        cost.set(nk, ng);
        cameFrom.set(nk, { tx: cur.tx, ty: cur.ty });
        open.push({ tx: nx, ty: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}

// Если кликнули в дерево или в пруд, идём к ближайшему свободному тайлу:
// обход в ширину от места клика, при равенстве ближе к гостю.
export function nearestFree(target, from, solid, maxRadius = 6) {
  if (!solid(target.tx, target.ty)) return target;
  let best = null;
  for (let r = 1; r <= maxRadius && !best; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = target.tx + dx;
        const ty = target.ty + dy;
        if (solid(tx, ty)) continue;
        const d = Math.hypot(dx, dy) * 100 + Math.hypot(tx - from.tx, ty - from.ty);
        if (!best || d < best.d) best = { tx, ty, d };
      }
    }
  }
  return best ? { tx: best.tx, ty: best.ty } : null;
}
