// Печатная машинка: общая для окон городка и ответов чата на главной.
// Модуль без DOM, проверяется тестами на Node.

// Скорость печати, символов в секунду.
export const TYPE_CPS = 45;

// Сколько символов каждого абзаца видно через elapsed секунд.
// Абзацы печатаются по очереди. При уменьшении движения всё видно сразу.
export function typedCounts(paragraphs, elapsed, { cps = TYPE_CPS, reducedMotion = false } = {}) {
  let budget = reducedMotion ? Infinity : Math.max(0, Math.floor(elapsed * cps));
  return paragraphs.map((text) => {
    const n = Math.min(text.length, budget);
    budget -= n;
    return n;
  });
}

export function typingDone(paragraphs, counts) {
  return paragraphs.every((text, i) => counts[i] >= text.length);
}

// Сколько секунд печатается текст целиком: чтобы «пропуск» сразу показывал всё.
export function typingDuration(paragraphs, cps = TYPE_CPS) {
  const total = paragraphs.reduce((sum, t) => sum + t.length, 0);
  return total / cps;
}
