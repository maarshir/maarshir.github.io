// Здания и окна диалогов: какое здание рядом и что написать в окне.
// Модуль без DOM: всё проверяется тестами на Node, а main.mjs только показывает.

import { TILE, BUILDINGS, frontTile } from './map.mjs';
import { tileFeet } from './physics.mjs';

// Насколько близко к месту перед дверью надо стоять, чтобы появилась подсказка.
// Чуть меньше тайла: у соседних дверей зоны не пересекаются, а попасть легко.
export const NEAR_PX = 12;

// Печатная машинка общая с чатом на главной, поэтому живёт в js/typewriter.mjs.
export { TYPE_CPS, typedCounts, typingDone, typingDuration } from '../typewriter.mjs';

// Здание, у двери которого стоит гость, или null. Если рядом две двери, ближняя.
export function nearbyBuilding(x, y, buildings = BUILDINGS) {
  let best = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    const f = frontTile(b);
    const spot = tileFeet(f.tx, f.ty);
    const dist = Math.hypot(x - spot.x, y - spot.y);
    if (dist <= NEAR_PX && dist < bestDist) {
      best = b;
      bestDist = dist;
    }
  }
  return best;
}

// Точка над дверью в пикселях карты: сюда ставится подсказка.
export function hintAnchor(b) {
  return { x: b.door * TILE + TILE / 2, y: (b.y + b.h - 1) * TILE };
}

// Текст подсказки у двери.
export function hintText(b) {
  const verb = b.kind === 'board' ? 'читать' : b.kind === 'well' ? 'заглянуть' : 'войти';
  return `${b.name}: Enter, чтобы ${verb}`;
}

// Содержимое окна для здания. Возвращает простой объект:
// title, place (подпись над заголовком), paragraphs (печатаются по очереди),
// points (список), tags (стек), links [{ label, url, external }].
// Данные те же, что у главной страницы: data/profile.json и data/projects.json.
export function dialogFor(b, profile, projects) {
  if (b.kind === 'project') {
    if (!projects) return missing(b);
    const p = projects.find((item) => item.building === b.name);
    if (!p) return empty(b);
    const links = p.code ? [{ label: 'Код на Гитхабе', url: p.code, external: true }] : [];
    if (p.demo) links.push({ label: 'Попробовать', url: p.demo, external: true });
    return {
      title: p.title,
      place: b.name,
      paragraphs: [p.summary],
      points: [...p.points],
      tags: [...p.stack],
      links,
    };
  }
  if (!profile) return missing(b);
  if (b.kind === 'home') {
    return {
      title: profile.name,
      place: b.name,
      // Коротко: полный рассказ есть на главной, окно не должно закрывать весь экран.
      paragraphs: [profile.role + '.', profile.direction, profile.about[0], profile.lookingFor],
      points: [],
      tags: [],
      links: [{ label: 'На главную', url: '#cv', external: false }],
    };
  }
  if (b.kind === 'contacts') {
    return {
      title: 'Написать Ивану',
      place: b.name,
      paragraphs: ['Быстрее всего ответ придёт в Телеграме. Почта и Гитхаб тоже здесь.'],
      points: profile.contacts.map((c) => `${c.label}: ${c.value}`),
      tags: [],
      links: profile.contacts.map((c) => ({
        label: c.label,
        url: c.url,
        external: c.url.startsWith('https://'),
      })),
    };
  }
  if (b.kind === 'board') {
    return {
      title: 'Сейчас работаю над',
      place: b.name,
      paragraphs: [profile.now],
      points: [],
      tags: [],
      links: [{ label: 'Все проекты', url: '#projects', external: false }],
    };
  }
  if (b.kind === 'well') {
    return {
      title: 'Колодец',
      place: 'У площади',
      paragraphs: ['Старый каменный колодец. На дне что-то поблёскивает, но монетки у тебя пока нет.'],
      points: [],
      tags: [],
      links: [],
    };
  }
  return missing(b);
}

// Здание, за которым сейчас нет проекта: данные загрузились, просто здесь пусто.
function empty(b) {
  return {
    title: b.name,
    place: b.name,
    paragraphs: ['Здесь пока пусто. Все проекты есть на главной странице.'],
    points: [],
    tags: [],
    links: [{ label: 'К проектам', url: '#projects', external: false }],
  };
}

function missing(b) {
  return {
    missing: true,
    title: b.name,
    place: b.name,
    paragraphs: ['Данные не загрузились. Всё то же самое есть на главной странице.'],
    points: [],
    tags: [],
    links: [{ label: 'На главную', url: '#cv', external: false }],
  };
}
