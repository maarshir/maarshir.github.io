// «Спросите моё резюме»: поиск ответа по data/profile.json и data/projects.json прямо в браузере.
// Без сервера, ключей и модели. Тот же принцип, что в doc-answers: вопрос и тексты
// разбиваются на основы слов, разделы ранжируются по BM25, ответ собирается только
// из найденных разделов. Модуль без DOM, проверяется тестами на Node.

// Служебные слова, которые ничего не говорят о теме вопроса.
const STOP_WORDS = new Set(`
и в во не что на я с со как а то все так но да ты к у же вы за бы по только мне
было вот от меня еще нет о об из даже ну ли если уже или ни быть был до вас вам ведь там
потом себя ничего может они тут где есть для мы тебя их чем была сам без тоже себе под
будет тогда кто этот того этого какой какая какие каких каком какую почему зачем можно
при много про эти нас такое такой такая сколько твой твоя твои твоих тебе свои свой это покажи расскажи скажи
подскажи ваш ваши вашем your the a an and or of to in on for is are what how
`.split(/\s+/).filter(Boolean));

// Грубый стемминг: срезать одно окончание (длинные первыми) и оставить не больше
// MAX_STEM букв. Это не полноценный стеммер Snowball, как в doc-answers, но браузеру
// не нужна библиотека, а для резюме из двух файлов этого хватает. Обрезка по длине
// сводит «телеграм» и «телеграме», «стажировка» и «стажировку» к одной основе там,
// где таблица окончаний ошибается. Где не хватает, помогают подсказки разделов.
const ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ешь', 'ете', 'ишь', 'ите',
  'ать', 'ять', 'ить', 'ыть', 'ый', 'ий', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю',
  'ым', 'им', 'ом', 'ем', 'ах', 'ях', 'ам', 'ям', 'ов', 'ев', 'ей', 'ию', 'ия', 'ть', 'ет', 'ит',
  'ут', 'ют', 'ат', 'ят', 'ил', 'ыл', 'ал', 'ял',
  'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й',
];
const MIN_STEM = 3;
const MAX_STEM = 6;

export function stem(word) {
  if (!/[а-я]/.test(word)) return word; // латиница и числа как есть: promptdiff, bm25, 2026
  let w = word;
  for (const r of ['ся', 'сь']) {
    if (w.endsWith(r) && w.length - r.length >= MIN_STEM) { w = w.slice(0, -r.length); break; }
  }
  for (const e of ENDINGS) {
    if (w.endsWith(e) && w.length - e.length >= MIN_STEM) { w = w.slice(0, -e.length); break; }
  }
  return w.slice(0, MAX_STEM);
}

// Текст в список пар { word, stem } без служебных слов.
export function words(text) {
  const found = String(text).toLowerCase().replace(/ё/g, 'е').match(/[0-9a-zа-я]+/g) || [];
  return found.filter((w) => !STOP_WORDS.has(w)).map((w) => ({ word: w, stem: stem(w) }));
}

export const tokenize = (text) => words(text).map((w) => w.stem);

// Синонимы для слов, которых в резюме нет дословно: «ИИ» там не написано,
// а про модели и промпты написано. Ключ и значения проходят тот же стемминг.
const SYNONYM_WORDS = {
  ии: ['модели', 'промпт', 'llm', 'rag'],
  ai: ['модели', 'промпт', 'llm', 'rag'],
  нейросеть: ['модели', 'llm'],
  нейросети: ['модели', 'llm'],
  gpt: ['модели', 'llm'],
  llm: ['модели'],
  стоит: ['стоимость', 'цена'],
  цена: ['стоимость'],
  стоимость: ['цена'],
};
const SYNONYMS = new Map(
  Object.entries(SYNONYM_WORDS).map(([k, vs]) => [stem(k), vs.map(stem)]),
);

// Подсказки разделов: как о разделе обычно спрашивают. Это не факты о владельце,
// а слова вопроса, поэтому в ответ они не попадают.
const HINTS = {
  about: 'кто зовут имя себе о себе чем занимаешься',
  looking: 'стажировка стажировку стажировки работу ищешь ищет вакансия вакансию открыт предложение предложения нанять оффер',
  now: 'сейчас занят занимаешься делаешь работаешь над планы текущее',
  education: 'учился учишься учусь учеба учебе образование вуз университет институт магистратура магистратуре диплом выпускная вкр',
  work: 'работа работал опыт фриланс фрилансе заказчики заказы коммерческий',
  stack: 'умеешь умею умеет стек технологии технология навыки языки язык инструменты знаешь пишешь фреймворки',
  contacts: 'связаться связь контакты контакт написать напишу телеграм телеграме почта почту email mail гитхаб github',
  project: 'проект проекты проекта проектов',
  personal: 'личные личный себя',
};

const GENERIC = new Set(tokenize(`${HINTS.project} ${HINTS.personal}`));

// Разделы резюме для поиска. У каждого:
// text   по чему искать (данные раздела и подсказки),
// short  одна-две фразы, когда найдено несколько разделов,
// full   подробнее, когда раздел один,
// links  куда перейти.
export function buildDocs(profile, projects) {
  const docs = [];
  const add = (doc) => docs.push({ ...doc, full: doc.full || doc.short });
  const telegram = profile.contacts.find((c) => c.kind === 'telegram');
  const entries = (list) => list.map((e) => `${e.place}: ${e.what}`);

  add({
    id: 'about', kind: 'section', title: 'Обо мне',
    text: [profile.name, profile.role, profile.direction, ...profile.about, HINTS.about].join('\n'),
    short: [`${profile.name}. ${profile.role}.`, profile.direction],
    full: [`${profile.name}. ${profile.role}.`, profile.direction, ...profile.about],
    links: [{ label: 'Обо мне', url: '#about' }],
  });
  add({
    id: 'looking', kind: 'section', title: 'Что ищу',
    text: [profile.lookingFor, HINTS.looking].join('\n'),
    short: [profile.lookingFor],
    links: telegram ? [{ label: 'Написать в Телеграм', url: telegram.url }] : [],
  });
  add({
    id: 'now', kind: 'section', title: 'Сейчас',
    text: [profile.now, HINTS.now].join('\n'),
    short: [`Сейчас: ${profile.now}`],
    links: [{ label: 'Сейчас', url: '#now' }],
  });
  add({
    id: 'education', kind: 'section', title: 'Образование',
    text: [...entries(profile.education), HINTS.education].join('\n'),
    short: entries(profile.education),
    links: [{ label: 'Образование', url: '#education' }],
  });
  add({
    id: 'work', kind: 'section', title: 'Работа',
    text: [...entries(profile.work), HINTS.work].join('\n'),
    short: entries(profile.work),
    links: [{ label: 'Работа', url: '#work' }],
  });
  add({
    id: 'stack', kind: 'section', title: 'Стек',
    text: [...profile.stack.map((g) => `${g.group} ${g.items.join(' ')}`), HINTS.stack].join('\n'),
    short: profile.stack.map((g) => `${g.group}: ${g.items.join(', ')}.`),
    links: [{ label: 'Стек', url: '#stack' }],
  });
  add({
    id: 'contacts', kind: 'section', title: 'Контакты',
    text: [...profile.contacts.map((c) => `${c.label} ${c.value}`), HINTS.contacts].join('\n'),
    short: profile.contacts.map((c) => `${c.label}: ${c.value}`),
    links: profile.contacts.map((c) => ({ label: c.label, url: c.url })),
  });
  for (const p of projects) {
    add({
      id: p.id, kind: 'project', title: p.title, group: p.group,
      // По каким словам понятно, что проект назван по имени: из id и названия,
      // без общих слов вроде «личный».
      names: tokenize(`${p.id} ${p.title}`).filter((t) => !GENERIC.has(t)),
      text: [p.id, p.title, p.line, p.summary, ...p.points, ...p.stack, HINTS.project,
        p.group === 'personal' ? HINTS.personal : ''].join('\n'),
      short: [`${p.title}: ${p.line}`],
      full: [`${p.title}: ${p.summary}`, ...p.points.map((pt) => `▸ ${pt}`), `Стек: ${p.stack.join(', ')}.`],
      links: [
        { label: `${p.title} на странице`, url: `#project-${p.id}` },
        { label: 'Код', url: p.code },
        ...(p.demo ? [{ label: 'Попробовать', url: p.demo }] : []),
      ],
    });
  }
  return docs;
}

// Сколько разделов показывать и насколько они могут отставать от лучшего.
export const MAX_HITS = 4;
export const MAX_PROJECT_HITS = 5;
export const RELATIVE = 0.5;

export class Index {
  constructor(docs, { k1 = 1.2, b = 0.75 } = {}) {
    this.docs = docs;
    this.k1 = k1;
    this.b = b;
    this.tf = docs.map((d) => {
      const m = new Map();
      for (const t of tokenize(d.text)) m.set(t, (m.get(t) || 0) + 1);
      return m;
    });
    this.len = this.tf.map((m) => [...m.values()].reduce((a, n) => a + n, 0));
    this.avg = this.len.reduce((a, n) => a + n, 0) / (docs.length || 1) || 1;
    const df = new Map();
    for (const m of this.tf) for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
    const n = docs.length;
    // idf как в Lucene и doc-answers: всегда положительный.
    this.idf = new Map([...df].map(([t, c]) => [t, Math.log(1 + (n - c + 0.5) / (c + 0.5))]));
  }

  // Основы слов вопроса с синонимами. У каждой запоминаем, из какого слова она,
  // чтобы показать гостю «нашлось по словам ...» его же словами.
  terms(question) {
    const out = new Map();
    for (const { word, stem: s } of words(question)) {
      if (!out.has(s)) out.set(s, word);
      for (const syn of SYNONYMS.get(s) || []) if (!out.has(syn)) out.set(syn, word);
    }
    return out;
  }

  search(question) {
    const terms = this.terms(question);
    const hits = [];
    this.docs.forEach((doc, i) => {
      let score = 0;
      const matched = new Set();
      for (const [t, word] of terms) {
        const tf = this.tf[i].get(t);
        if (!tf) continue;
        matched.add(word);
        const norm = tf + this.k1 * (1 - this.b + (this.b * this.len[i]) / this.avg);
        score += (this.idf.get(t) * tf * (this.k1 + 1)) / norm;
      }
      if (score > 0) hits.push({ doc, score, matched: [...matched] });
    });
    // При равном счёте порядок как в данных: ответ не зависит от случая.
    return hits.sort((a, b) => b.score - a.score);
  }
}

// Ответ на вопрос. Возвращает null для пустого вопроса, иначе
// { found, paragraphs, links, sources, matched }. Все тексты только из данных.
export function answer(index, question, { telegramUrl = null } = {}) {
  if (!words(question).length) return null;
  let hits = index.search(question);
  const asked = new Set(tokenize(question));
  // Если проект назван по имени, отвечает только он: «стек doc-answers» это про проект,
  // а не про общий раздел «Стек» и не про другие проекты, где упомянут doc-answers.
  const named = hits.filter((h) => h.doc.kind === 'project' && h.doc.names.some((n) => asked.has(n)));
  // Если спросили про проекты и проекты нашлись, отвечают только карточки проектов:
  // «проекты с ИИ» не должны уводить в раздел «Обо мне», где тоже есть эти слова.
  // Основные проекты идут раньше личных, внутри группы по счёту.
  const askedProjects = asked.has(stem('проекты'));
  const projectHits = hits
    .filter((h) => h.doc.kind === 'project')
    .sort((a, b) => (a.doc.group === 'main' ? 0 : 1) - (b.doc.group === 'main' ? 0 : 1) || b.score - a.score);
  if (named.length) hits = named;
  else if (askedProjects && projectHits.length) hits = projectHits;
  if (!hits.length) {
    return {
      found: false,
      paragraphs: ['В резюме про это ничего не нашлось. Лучше спросить напрямую в Телеграме.'],
      links: telegramUrl ? [{ label: 'Написать в Телеграм', url: telegramUrl }] : [],
      sources: [],
      matched: [],
    };
  }
  const limit = askedProjects && projectHits.length ? MAX_PROJECT_HITS : MAX_HITS;
  const best = Math.max(...hits.map((h) => h.score));
  const top = hits.filter((h) => h.score >= best * RELATIVE).slice(0, limit);
  const paragraphs = top.length === 1 ? [...top[0].doc.full] : top.flatMap((h) => h.doc.short);
  const links = [];
  const seen = new Set();
  for (const h of top) {
    for (const l of h.doc.links) {
      if (seen.has(l.url)) continue;
      seen.add(l.url);
      links.push(l);
    }
  }
  const matched = [...new Set(top.flatMap((h) => h.matched))];
  return { found: true, paragraphs, links, sources: top.map((h) => h.doc.title), matched };
}

// Готовые вопросы на кнопках. Тест проверяет, что на каждый есть осмысленный ответ.
export const PRESETS = [
  { label: 'Что умеешь?', expect: ['stack'] },
  { label: 'Покажи проекты с ИИ', expect: ['promptdiff', 'doc-answers'] },
  { label: 'Где учился?', expect: ['education'] },
  { label: 'Как связаться?', expect: ['contacts'] },
];

export function createAsk(profile, projects) {
  const index = new Index(buildDocs(profile, projects));
  const telegram = profile.contacts.find((c) => c.kind === 'telegram');
  return (question) => answer(index, question, { telegramUrl: telegram ? telegram.url : null });
}
