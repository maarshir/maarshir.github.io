// Живость главной в браузере: время суток в сцене, появление карточек и персонаж у края.
// Логика в js/scene.mjs и js/walker.mjs (без DOM, с тестами), здесь только связь со страницей.
// При уменьшении движения работает только смена времени суток: она ничего не двигает.

import { phaseAt, minutesToNextPhase } from './scene.mjs';
import { walkerTop, initialState, update, frame } from './walker.mjs';
import { HERO, HERO_PALETTE } from './town/sprites.mjs';
import { spriteToSvg } from './avatar.mjs';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

// Время суток по часам гостя. Следующая проверка ровно к смене, а не по таймеру каждую минуту.
function setPhase() {
  const scene = document.querySelector('.scene');
  if (!scene) return;
  const now = new Date();
  scene.dataset.phase = phaseAt(now.getHours());
  const wait = minutesToNextPhase(now.getHours(), now.getMinutes());
  setTimeout(setPhase, (wait * 60 - now.getSeconds() + 1) * 1000);
}

// Карточки проявляются, когда до них доходит прокрутка. Уже видимые при загрузке показываются сразу.
function reveal() {
  if (reduced.matches || !('IntersectionObserver' in window)) return;
  const cards = [...document.querySelectorAll('.cards .card')];
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        seen.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.documentElement.classList.add('reveal');
  cards.forEach((card) => seen.observe(card));
}

// Персонаж вдоль правого края. Кадры заранее собраны в SVG, при прокрутке меняется только видимость.
function walker() {
  if (reduced.matches) return;
  const box = document.createElement('div');
  box.className = 'walker';
  box.setAttribute('aria-hidden', 'true');
  const frames = {};
  for (const dir of ['down', 'up']) {
    frames[dir] = HERO[dir].map((rows) => {
      box.insertAdjacentHTML('beforeend', spriteToSvg(rows, HERO_PALETTE));
      const svg = box.lastElementChild;
      svg.style.visibility = 'hidden';
      return svg;
    });
  }
  document.body.append(box);

  let state = initialState(window.scrollY);
  let shown = null;
  let pending = false;

  function draw() {
    pending = false;
    const now = performance.now();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    box.style.transform = `translateY(${walkerTop(window.scrollY, max, window.innerHeight)}px)`;
    const next = frames[state.dir][frame(state, now)];
    if (next !== shown) {
      if (shown) shown.style.visibility = 'hidden';
      next.style.visibility = 'visible';
      shown = next;
    }
    // Пока идёт, через паузу надо вернуть позу «стоит».
    if (frame(state, now) !== 0) setTimeout(schedule, 200);
  }
  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(draw);
    }
  }
  window.addEventListener('scroll', () => {
    state = update(state, window.scrollY, performance.now());
    schedule();
  }, { passive: true });
  window.addEventListener('resize', schedule);
  reduced.addEventListener?.('change', () => { if (reduced.matches) box.remove(); });
  draw();
}

// В городке персонаж у края скрыт стилями (.town-first .walker), он там не нужен.
setPhase();
reveal();
walker();
