import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { buildRoom, paintSky, TOP } from './objects.mjs';
import { createScreen } from './screen.mjs';
import * as sound from './audio.mjs';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// Точки обзора: откуда смотрит камера, куда и какую ширину сцены нужно уместить
// Камера стоит слева спереди и смотрит на стол под углом; остальные точки считаются по предметам после загрузки
const VIEWS = {
  home: { pos: [-0.86, 1.42, 1.36], look: [0.02, 0.95, -0.25], span: 2.0, portrait: 0.95 },
};
const LABELS = { computer: 'Проекты', diploma: 'Учёба', phone: 'Контакты', lamp: 'Свет', tape: 'Музыка' };
const BASE_FOV = 36;

const canvasEl = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d0906');
scene.fog = new THREE.Fog('#0d0906', 3.5, 8);
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.02, 20);

await Promise.all([document.fonts.load('40px Tiny5'), document.fonts.load('30px "Golos Text"'), document.fonts.load('40px Caveat'), document.fonts.load('40px Caveat', 'Привет')]).catch(() => {});
const projects = await fetch('../data/projects.json').then(r => r.json()).catch(() => []);

// Загрузка моделей и текстур: процент на кнопке входа
const manager = new THREE.LoadingManager();
manager.onProgress = (_, done, total) => { const b = $('enter-btn'); if (b.disabled) b.textContent = `Загрузка ${Math.round(done / total * 100)}%`; };
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader(manager).load('hdri/fireplace.hdr', (hdr) => {
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.32;
  hdr.dispose();
});
const room = await buildRoom(scene, manager, { projects });
const screen = createScreen(projects);
const screenMesh = new THREE.Mesh(room.screenGeo, screen.material);
room.screenAt(screenMesh);
scene.updateMatrixWorld(true);

// Точка обзора перед предметом: отступ по нормали и немного сверху
function viewFrom(obj, offset, normal, lift = 0, lookShift = [0, 0, 0], span = 0.5) {
  const c = new THREE.Vector3(); obj.getWorldPosition(c);
  c.add(new THREE.Vector3(...lookShift));
  const n = normal.clone().normalize();
  const pos = c.clone().addScaledVector(n, offset); pos.y += lift;
  return { pos: pos.toArray(), look: c.toArray(), span };
}
const screenNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(screenMesh.getWorldQuaternion(new THREE.Quaternion()));
VIEWS.computer = viewFrom(screenMesh, 0.44, screenNormal, 0.0, [0, 0, 0], 0.36);
const frameNormal = new THREE.Vector3(1, 0, 0).applyQuaternion(room.frame.getWorldQuaternion(new THREE.Quaternion()));
VIEWS.diploma = viewFrom(room.frame, 0.5, frameNormal, 0.12, [0.06, 0.15, 0.05], 0.55);
VIEWS.phone = viewFrom(room.phone, 0.95, new THREE.Vector3(-0.15, 0, 1), 0.05, [0.12, 0.22, 0], 0.62);

// Свет: небо, окно, свечение экрана
const hemi = new THREE.HemisphereLight('#4a5878', '#2a1a0e', 0.45);
scene.add(hemi);
const moon = new THREE.DirectionalLight('#8fa6d8', 0.6);
moon.position.set(-0.8, 2.2, -0.2); moon.target.position.set(-0.3, TOP, 0.2);
scene.add(moon, moon.target);
const fill = new THREE.PointLight('#ffb070', 0.35, 1.8, 1.5);
fill.position.set(0.3, 1.4, 0.5);
scene.add(fill);
const screenLight = new THREE.PointLight('#9fd0ff', 0, 1.1, 2);
screenMesh.getWorldPosition(screenLight.position).addScaledVector(screenNormal, 0.3);
scene.add(screenLight);

let phase = paintSky(room.sky, new Date().getHours());
if (params.get('hour')) phase = paintSky(room.sky, +params.get('hour'));
if (phase === 'day' || phase === 'morning') { hemi.intensity = 0.7; moon.color.set('#fff1d6'); moon.intensity = 1.1; }

// Постобработка: обводка, свечение, виньетка с зерном
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// мягкие тени в углах и под предметами; на телефоне выключены ради плавности
const touch = matchMedia('(hover: none)').matches;
const ao = new GTAOPass(scene, camera, 1, 1);
ao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 });
ao.blendIntensity = 0.85;
if (!touch && !params.has('noao')) composer.addPass(ao);
const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
Object.assign(outline, { edgeStrength: 2.4, edgeGlow: 0.0, edgeThickness: 1.2, pulsePeriod: 0 });
outline.visibleEdgeColor.set('#ffd79a'); outline.hiddenEdgeColor.set('#2a1d0c');
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.5, 0.93);
composer.addPass(bloom);
composer.addPass(outline);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      c.rgb *= mix(1.0, smoothstep(0.9, 0.2, length(d * vec2(1.15, 1.0))), 0.65);
      float n = fract(sin(dot(vUv * (1.0 + fract(uTime)), vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.03;
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// Камера: размер кадра подгоняется под экран, на узком телефоне камера отходит назад
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: BASE_FOV };
function frame(name) {
  const v = VIEWS[name];
  const look = new THREE.Vector3(...v.look);
  let pos = new THREE.Vector3(...v.pos);
  const dir = pos.clone().sub(look);
  let dist = dir.length(); dir.normalize();
  const aspect = camera.aspect;
  const span = aspect < 0.8 && v.portrait ? v.portrait : v.span;
  const need = THREE.MathUtils.radToDeg(2 * Math.atan(span / 2 / dist / aspect));
  let fov = BASE_FOV;
  if (need > BASE_FOV) {
    fov = Math.min(need, 52);
    if (need > 52) { dist = span / 2 / (Math.tan(THREE.MathUtils.degToRad(26)) * aspect); pos = look.clone().addScaledVector(dir, dist); }
  }
  return { pos, look, fov };
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  const f = frame(state.view);
  if (!tween) { cam.pos.copy(f.pos); cam.look.copy(f.look); cam.fov = f.fov; }
}

const state = { view: 'home', entered: false, pcOn: false, calling: false, lampOn: true, hovered: null, explored: false };
let tween = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function go(name) {
  if (tween || name === state.view) return;
  if (state.calling && name !== 'phone') return;
  const from = { pos: cam.pos.clone(), look: cam.look.clone(), fov: cam.fov };
  const to = frame(name);
  state.view = name;
  setHover(null);
  $('contacts').hidden = true;
  $('back').hidden = name === 'home';
  $('hint').hidden = true;
  document.body.classList.toggle('zoomed', name !== 'home');
  const dur = reduce ? 0 : name === 'home' ? 1.3 : 1.7;
  tween = { from, to, t: 0, dur, done: () => arrive(name) };
  if (dur === 0) { cam.pos.copy(to.pos); cam.look.copy(to.look); cam.fov = to.fov; tween = null; arrive(name); }
}

function arrive(name) {
  state.explored = state.explored || name !== 'home';
  const sr = $('sr');
  if (name === 'computer') {
    sr.textContent = 'Компьютер. Проекты: ' + projects.filter(p => p.group === 'main').map(p => `${p.title}: ${p.line}`).join(' ');
    if (!state.pcOn) bootComputer();
  }
  if (name === 'diploma') {
    sound.paperRustle();
    sr.textContent = 'Диплом бакалавра РТУ МИРЭА, 2022–2026, 09.03.02 Информационные системы и технологии, профиль фулстек-разработка. Сейчас магистратура РТУ МИРЭА и Школа 21.';
  }
  if (name === 'phone') {
    sr.textContent = 'Телефон. Контакты: Телеграм @kaioann, почта ivan_ius@mail.ru, Гитхаб maarshir.';
    call();
  }
  if (name === 'home') { sr.textContent = 'Стол: компьютер, диплом, телефон.'; $('back').hidden = true; }
}

// Включение компьютера: щелчок, вспышка кинескопа, строки загрузки, рабочий стол
let power = { v: 0, target: 0 };
function bootComputer() {
  state.pcOn = true;
  sound.crtOn();
  room.led.material.emissiveIntensity = 3;
  power.target = 1;
  screen.state.bootLines = 0;
  screen.setMode('boot');
  const step = reduce ? 0 : 330;
  let i = 0;
  const next = () => {
    i++;
    screen.state.bootLines = i;
    screen.draw();
    if (i < 10) setTimeout(next, step + (i === 7 ? 500 : 0));
    else setTimeout(() => screen.setMode('desktop'), reduce ? 0 : 700);
  };
  setTimeout(next, reduce ? 0 : 1200);
}

// Звонок: дисковый набор, гудки, сброс; телефон на стене чуть вздрагивает от звонка, потом появляются контакты
let ringT = 0;
function call() {
  if (state.calling) return;
  state.calling = true;
  ringT = performance.now();
  const dur = sound.phoneCall(() => { state.calling = false; $('contacts').hidden = false; });
  if (!dur) { state.calling = false; $('contacts').hidden = false; }
}

// Наведение и нажатие
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2(), ptrSmooth = new THREE.Vector2();
const pickList = Object.entries(room.pick);
function hitTest(x, y) {
  ptr.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(pickList.map(([, g]) => g), true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o) { const e = pickList.find(([, g]) => g === o); if (e) return e[0]; o = o.parent; }
  return null;
}
function setHover(key) {
  state.hovered = key;
  outline.selectedObjects = key ? [room.pick[key]] : [];
  outline.pulsePeriod = 0;
  document.body.classList.toggle('pointer', !!key);
  const tip = $('tip');
  tip.hidden = !key;
  if (key) tip.textContent = LABELS[key];
}
canvasEl.addEventListener('pointermove', (e) => {
  ptrSmooth.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (!state.entered || tween || state.view !== 'home' || e.pointerType === 'touch') return;
  const k = hitTest(e.clientX, e.clientY);
  if (k !== state.hovered) setHover(k);
  $('tip').style.left = e.clientX + 'px'; $('tip').style.top = e.clientY + 'px';
});
// На телефоне стол шире экрана: проведите пальцем, чтобы осмотреться
let pan = 0, panTarget = 0, drag = null;
canvasEl.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') drag = { x: e.clientX, start: panTarget, moved: false }; });
canvasEl.addEventListener('pointermove', (e) => {
  if (!drag || state.view !== 'home') return;
  const dx = (e.clientX - drag.x) / innerWidth;
  if (Math.abs(dx) > 0.02) drag.moved = true;
  panTarget = THREE.MathUtils.clamp(drag.start - dx * 1.2, -0.5, 0.5);
});
addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); });
canvasEl.addEventListener('click', (e) => {
  if (drag?.moved) return;
  if (!state.entered || tween) return;
  if (state.view !== 'home') {
    // на экране компьютера нажатие по окну проекта открывает Гитхаб
    if (state.view === 'computer' && screen.state.mode === 'desktop') openProjectAt(e.clientX, e.clientY);
    return;
  }
  const k = hitTest(e.clientX, e.clientY);
  if (k === 'lamp') { toggleLamp(); return; }
  if (k === 'tape') { const on = sound.toggleMusic(); $('sr').textContent = on ? 'Музыка играет' : 'Музыка на паузе'; return; }
  if (k) go(k);
});

function openProjectAt(x, y) {
  ptr.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const h = ray.intersectObject(screenMesh)[0];
  if (!h) return;
  const px = h.uv.x * screen.W, py = (1 - h.uv.y) * screen.H;
  const main = projects.filter(p => p.group === 'main').slice(0, 3);
  main.forEach((p, i) => {
    const bx = 210 + i * 335;
    if (px > bx && px < bx + 310 && py > 130 && py < 650) open(p.code, '_blank', 'noopener');
  });
}

function toggleLamp() {
  state.lampOn = !state.lampOn;
  sound.switchClick();
}

addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.view !== 'home') go('home'); });
$('back').addEventListener('click', () => go('home'));
$('spots').addEventListener('click', (e) => { const s = e.target.dataset.spot; if (s && state.entered) { if (state.view !== 'home') go('home'); setTimeout(() => go(s), state.view === 'home' ? 0 : 1400); } });
$('mute').addEventListener('click', () => {
  const m = !sound.isMuted(); sound.setMuted(m);
  $('mute').textContent = m ? 'Звук: выкл' : 'Звук: вкл';
  $('mute').setAttribute('aria-pressed', String(m));
});

// Вход: свет лампы зажигается с подмигиванием, звук стартует от нажатия
let lampLevel = 0, enterT = 0;
function enter(withSound) {
  if (state.entered) return;
  state.entered = true;
  if (withSound) sound.initAudio();
  enterT = performance.now();
  $('enter').classList.add('gone');
  document.body.classList.add('inside');
  setTimeout(() => {
    if (!state.explored) {
      $('hint').hidden = false;
      $('hint').textContent = matchMedia('(hover: none)').matches ? 'Нажмите на компьютер. Проведите пальцем, чтобы осмотреться' : 'Наведите на предметы на столе';
      outline.selectedObjects = [room.pick.computer]; outline.pulsePeriod = 2.2;
    }
  }, reduce ? 0 : 2600);
}
$('enter-btn').addEventListener('click', () => enter(true));

// Покадровая жизнь сцены
const clock = new THREE.Clock();
let flick = 1, flickUntil = 0, nextFlick = 4;
function lampFactor(t) {
  if (!state.entered) return 0;
  const since = (performance.now() - enterT) / 1000;
  // зажигание: два коротких подмигивания и ровный свет
  let on = since < 0.25 ? 0 : since < 0.35 ? 0.6 : since < 0.5 ? 0.05 : since < 0.6 ? 0.8 : since < 0.75 ? 0.2 : Math.min(1, (since - 0.75) * 2 + 0.5);
  if (reduce) on = 1;
  if (!reduce && t > nextFlick) { flickUntil = t + 0.12 + Math.random() * 0.25; nextFlick = t + 5 + Math.random() * 9; }
  flick = !reduce && t < flickUntil ? 0.55 + Math.random() * 0.45 : 1;
  return on * flick * (0.985 + Math.sin(t * 13) * 0.008 + Math.sin(t * 31) * 0.006);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // свет
  const target = state.lampOn ? lampFactor(t) : 0;
  lampLevel += (target - lampLevel) * Math.min(1, dt * (state.lampOn ? 30 : 8));
  room.lamp.spot.intensity = 3.2 * lampLevel;
  room.lamp.glow.intensity = 0.9 * lampLevel;
  room.lamp.bulbMat.emissiveIntensity = 5 * lampLevel;
  room.anim.dust.material.opacity = 0.55 * lampLevel;

  power.v = reduce ? power.target : power.v + (power.target - power.v) * Math.min(1, dt * 1.6);
  screen.material.uniforms.uPower.value = power.v > 0.995 ? 1 : power.v;
  screen.material.uniforms.uTime.value = t;
  screenLight.intensity = power.v * 0.35;

  // ветер: шторы, стикеры, кисточка шапочки
  const gust = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1);
  for (const c of room.anim.curtains) {
    const p = c.geometry.attributes.position, b = c.userData.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1];
      const down = (0.75 - y) / 1.5;
      p.setZ(i, Math.sin(x * 18 + t * 1.3) * 0.012 + down * down * gust * (0.03 + Math.sin(t * 1.7 + x * 6) * 0.015));
    }
    p.needsUpdate = true; c.geometry.computeVertexNormals();
  }
  for (const s of room.anim.stickies) { const w = 0.6 + 0.4 * Math.sin(t * 2.1 + s.userData.phase); s.rotation.x = -0.015 - gust * 0.07 * w; s.rotation.z = s.userData.rot + Math.sin(t * 1.3 + s.userData.phase) * 0.01 * gust; }
  room.anim.tassel.rotation.x = Math.sin(t * 1.9) * 0.15 * (0.4 + gust);

  // пылинки
  const d = room.anim.dust, dp = d.geometry.attributes.position, db = d.userData.base, ds = d.userData.seeds;
  for (let i = 0; i < dp.count; i++) {
    const s = ds[i];
    dp.setXYZ(i, db[i * 3] + Math.sin(t * 0.13 + s) * 0.04, TOP + ((db[i * 3 + 1] - TOP + t * 0.006 * (1 + (s % 1))) % 0.55), db[i * 3 + 2] + Math.cos(t * 0.11 + s) * 0.04);
  }
  dp.needsUpdate = true;

  // пар
  for (const s of room.anim.steam) {
    s.userData.t = (s.userData.t + dt * 0.18) % 1;
    const k = s.userData.t;
    s.position.copy(room.steamFrom).add(new THREE.Vector3(Math.sin(k * 6 + t) * 0.012 + gust * k * 0.03, k * 0.2, Math.cos(k * 5) * 0.008));
    s.scale.setScalar(0.03 + k * 0.07);
    s.material.opacity = Math.sin(k * Math.PI) * 0.12;
  }

  // диск телефона во время набора
  if (state.calling) {
    const e = (performance.now() - ringT) / 1000;
    room.phone.rotation.z = Math.sin(e * 55) * 0.006 * (Math.sin(e * 2.2) > 0.3 ? 1 : 0);
  } else room.phone.rotation.z = 0;

  // камера: переезд, лёгкое дыхание и сдвиг за курсором
  if (tween) {
    tween.t += dt / tween.dur;
    const k = ease(Math.min(1, tween.t));
    cam.pos.lerpVectors(tween.from.pos, tween.to.pos, k);
    cam.pos.y += Math.sin(k * Math.PI) * 0.05;
    cam.look.lerpVectors(tween.from.look, tween.to.look, k);
    cam.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * k;
    if (tween.t >= 1) { const done = tween.done; tween = null; done(); }
  }
  pan += ((state.view === 'home' && camera.aspect < 0.8 ? panTarget : 0) - pan) * Math.min(1, dt * 6);
  camera.position.copy(cam.pos);
  camera.position.x += pan;
  if (!reduce && state.view === 'home') {
    camera.position.x += Math.sin(t * 0.3) * 0.01 + ptrSmooth.x * 0.04;
    camera.position.y += Math.sin(t * 0.4) * 0.006 + ptrSmooth.y * 0.025;
  }
  camera.fov = cam.fov; camera.updateProjectionMatrix();
  camera.lookAt(cam.look.x + pan, cam.look.y, cam.look.z);

  grade.uniforms.uTime.value = t;
  composer.render();
  requestAnimationFrame(tick);
}

addEventListener('resize', resize);
resize();
tick();

const btn = $('enter-btn');
btn.disabled = false; btn.textContent = 'Войти';
if (params.has('skip')) {
  enter(false);
  if (VIEWS[params.get('view')]) setTimeout(() => go(params.get('view')), 300);
}
window.__room = { go, state, enter };
