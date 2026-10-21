// Комната целиком из простых фигур: стол, компьютер, лампа, диплом, телефон и мелочи.
// Единицы в метрах, верх столешницы на высоте 0,76.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { wood, plaster, cork, paper, soft, canvas, rng } from './textures.mjs';

const TOP = 0.76;

function shadow(m) { m.castShadow = true; m.receiveShadow = true; return m; }

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  m.position.set(x, y, z); return m;
}
function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  const m = shadow(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat));
  m.position.set(x, y, z); return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));
  m.position.set(x, y, z); return m;
}
function between(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 12), mat));
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return m;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

export function buildRoom(scene, { projects }) {
  const M = {
    desk: std('#ffffff', { map: wood('#7a4b2a', '#4a2c17', 3, [2, 1]), roughness: 0.55 }),
    floor: std('#ffffff', { map: wood('#3d2618', '#22150c', 5, [6, 6]), roughness: 0.7 }),
    wall: std('#ffffff', { map: plaster('#40382b'), roughness: 0.95 }),
    beige: std('#d6c9a8', { roughness: 0.5 }),
    beige2: std('#bfb291', { roughness: 0.55 }),
    darkPlastic: std('#29282a', { roughness: 0.45 }),
    lamp: std('#2c3a31', { metalness: 0.45, roughness: 0.4 }),
    brass: std('#b8862b', { metalness: 0.8, roughness: 0.3 }),
    red: std('#7d1f19', { roughness: 0.28 }),
    cream: std('#efe6cf', { roughness: 0.4 }),
    black: std('#141414', { roughness: 0.7 }),
    frame: std('#5b3a22', { roughness: 0.6 }),
  };

  const out = { pick: {}, anim: {} };

  // Пол и стены
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), M.wall);
  wall.position.set(0, 2, -0.6); wall.receiveShadow = true; scene.add(wall);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), M.wall);
  side.rotation.y = -Math.PI / 2; side.position.set(1.7, 2, 1.4); side.receiveShadow = true; scene.add(side);
  const plinth = box(8, 0.08, 0.02, M.frame, 0, 0.04, -0.59); scene.add(plinth);

  // Стол
  const desk = new THREE.Group();
  desk.add(box(1.7, 0.05, 0.86, M.desk, 0, TOP - 0.025, -0.16));
  for (const [x, z] of [[-0.8, 0.22], [0.8, 0.22], [-0.8, -0.54], [0.8, -0.54]]) desk.add(box(0.05, TOP - 0.05, 0.05, M.desk, x, (TOP - 0.05) / 2, z));
  desk.add(box(0.42, 0.22, 0.72, M.desk, 0.56, TOP - 0.16, -0.17));
  desk.add(box(0.36, 0.08, 0.01, M.frame, 0.56, TOP - 0.12, 0.195));
  desk.add(box(0.08, 0.012, 0.012, M.brass, 0.56, TOP - 0.12, 0.205));
  scene.add(desk);

  // Компьютер
  const pc = new THREE.Group();
  pc.add(rbox(0.5, 0.12, 0.42, 0.012, M.beige, 0, TOP + 0.06, -0.21));
  pc.add(box(0.15, 0.012, 0.004, M.darkPlastic, 0.11, TOP + 0.065, 0.001));
  pc.add(box(0.03, 0.02, 0.006, M.beige2, 0.2, TOP + 0.04, 0.0));
  const led = box(0.012, 0.006, 0.004, new THREE.MeshStandardMaterial({ color: '#1a3a1a', emissive: '#30ff60', emissiveIntensity: 0 }), -0.19, TOP + 0.075, 0.001);
  pc.add(led);
  const power = box(0.03, 0.03, 0.01, M.red, -0.15, TOP + 0.045, 0.0); pc.add(power);
  for (let i = 0; i < 6; i++) pc.add(box(0.06, 0.004, 0.003, M.beige2, -0.03 + i * 0.0, TOP + 0.03 + i * 0.008, 0.0));
  pc.add(box(0.2, 0.02, 0.16, M.beige2, 0, TOP + 0.13, -0.22));
  // корпус монитора: передняя часть и сужающийся «горб» сзади
  pc.add(rbox(0.44, 0.37, 0.3, 0.02, M.beige, 0, TOP + 0.33, -0.2));
  pc.add(rbox(0.34, 0.29, 0.16, 0.03, M.beige2, 0, TOP + 0.33, -0.39));
  pc.add(box(0.37, 0.28, 0.006, std('#47423a'), 0, TOP + 0.335, -0.048));
  for (let i = 0; i < 5; i++) pc.add(box(0.012, 0.004, 0.003, M.darkPlastic, 0.16 + i * 0.0, TOP + 0.175, -0.049));
  pc.add(cyl(0.008, 0.008, 0.006, M.darkPlastic, 0.18, TOP + 0.17, -0.048).rotateX(Math.PI / 2));

  // экран: плоскость, выгнутая к зрителю
  const sg = new THREE.PlaneGeometry(0.34, 0.255, 32, 24);
  const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.17, y = p.getY(i) / 0.1275;
    p.setZ(i, 0.018 * (1 - x * x * 0.6) * (1 - y * y * 0.6));
  }
  sg.computeVertexNormals();
  out.screenGeo = sg;
  out.led = led;

  // клавиатура и мышь
  const kb = new THREE.Group();
  kb.add(rbox(0.46, 0.028, 0.16, 0.006, M.beige, 0, 0, 0));
  const keyGeo = new RoundedBoxGeometry(0.021, 0.014, 0.021, 2, 0.003);
  const keys = new THREE.InstancedMesh(keyGeo, std('#cfc3a3', { roughness: 0.5 }), 17 * 5);
  keys.castShadow = true; keys.receiveShadow = true;
  const mtx = new THREE.Matrix4(); let k = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 17; c++) {
    const wide = r === 4 && c > 4 && c < 11;
    mtx.makeScale(wide && c === 5 ? 6.2 : 1, 1, 1);
    if (wide && c !== 5) mtx.makeScale(0.0001, 0.0001, 0.0001);
    mtx.setPosition(-0.2 + c * 0.025 + (wide && c === 5 ? 0.0625 : 0), 0.019, -0.055 + r * 0.025);
    keys.setMatrixAt(k++, mtx);
  }
  kb.add(keys);
  kb.position.set(0, TOP + 0.014, 0.13); kb.rotation.x = 0.04;
  pc.add(kb);
  const mouse = rbox(0.06, 0.03, 0.1, 0.015, M.beige, 0.32, TOP + 0.015, 0.14);
  pc.add(mouse);
  scene.add(pc);
  out.pick.computer = pc;

  // Лампа
  const lamp = new THREE.Group();
  const P0 = new THREE.Vector3(0.64, TOP + 0.03, -0.36);
  const P1 = new THREE.Vector3(0.58, TOP + 0.44, -0.34);
  const P2 = new THREE.Vector3(0.33, TOP + 0.56, -0.13);
  const T = new THREE.Vector3(0.05, TOP, 0.06);
  lamp.add(cyl(0.085, 0.095, 0.03, M.lamp, P0.x, TOP + 0.015, P0.z, 32));
  lamp.add(between(P0, P1, 0.011, M.brass));
  lamp.add(between(P1, P2, 0.011, M.brass));
  const j1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), M.lamp); j1.position.copy(P1); lamp.add(j1);
  const dir = new THREE.Vector3().subVectors(T, P2).normalize();
  const shade = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.17, 32, 1, true), std('#2c3a31', { metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide })));
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  shade.position.copy(P2).addScaledVector(dir, 0.04);
  lamp.add(shade);
  const cap = cyl(0.03, 0.03, 0.04, M.lamp, 0, 0, 0); cap.quaternion.copy(shade.quaternion); cap.position.copy(P2).addScaledVector(dir, -0.045); lamp.add(cap);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf86', emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 16), bulbMat);
  bulb.position.copy(P2).addScaledVector(dir, 0.07); lamp.add(bulb);
  const spot = new THREE.SpotLight('#ffc77a', 0, 3, 0.85, 0.65, 1.6);
  spot.position.copy(bulb.position); spot.target.position.copy(T);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.015;
  spot.shadow.camera.near = 0.05; spot.shadow.camera.far = 3;
  lamp.add(spot, spot.target);
  const glow = new THREE.PointLight('#ffb866', 0, 1.6, 1.8);
  glow.position.copy(bulb.position).addScaledVector(dir, -0.03); lamp.add(glow);
  scene.add(lamp);
  out.lamp = { spot, glow, bulbMat, beam: { from: bulb.position.clone(), to: T.clone() } };
  out.pick.lamp = lamp;

  // Кружка с паром
  const mug = new THREE.Group();
  mug.add(cyl(0.04, 0.036, 0.1, std('#b0452e', { roughness: 0.3 }), 0, 0.05, 0, 32));
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24), std('#2a1609', { roughness: 0.15 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.088; mug.add(coffee);
  const handle = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 10, 20, Math.PI * 1.2), std('#b0452e', { roughness: 0.3 })));
  handle.rotation.z = -Math.PI * 0.6; handle.position.set(0.042, 0.05, 0); mug.add(handle);
  mug.position.set(0.28, TOP, -0.03); mug.rotation.y = 0.6;
  scene.add(mug);
  out.steamFrom = new THREE.Vector3(0.28, TOP + 0.1, -0.03);

  // Стакан с карандашами и дискеты
  scene.add(cyl(0.035, 0.032, 0.1, std('#4a5a6a', { metalness: 0.5, roughness: 0.4 }), -0.34, TOP + 0.05, -0.36));
  const r = rng(4);
  for (let i = 0; i < 6; i++) {
    const pen = cyl(0.004, 0.004, 0.16, std(['#e8b04b', '#b0452e', '#2b5d8a', '#3f7338', '#1a1a1a', '#e8b04b'][i]), -0.34 + (r() - .5) * 0.04, TOP + 0.12, -0.36 + (r() - .5) * 0.04, 6);
    pen.rotation.set((r() - .5) * 0.4, 0, (r() - .5) * 0.4); scene.add(pen);
  }
  for (let i = 0; i < 3; i++) {
    const d = box(0.09, 0.003, 0.094, std(['#23336e', '#1a1a1a', '#7d1f19'][i], { roughness: 0.35 }), -0.31 + i * 0.01, TOP + 0.002 + i * 0.0032, 0.2 - i * 0.008);
    d.rotation.y = 0.3 - i * 0.25; scene.add(d);
  }

  // Учёба: раскрытый диплом, стопка книг и шапочка
  const edu = new THREE.Group();
  const coverMat = std('#4a1616', { roughness: 0.5 });
  const leftPage = paper(512, 700, [
    { text: 'ДИПЛОМ', size: 64, bold: true, align: 'center', color: '#7a5a14', gap: 150 },
    { text: 'бакалавра', size: 40, align: 'center', color: '#7a5a14', gap: 20 },
    { text: 'Капустин', size: 38, align: 'center', gap: 120 },
    { text: 'Иван Сергеевич', size: 38, align: 'center', gap: 10 },
  ], { bg: '#efe3c3' });
  const rightPage = paper(512, 700, [
    { text: 'РТУ МИРЭА', size: 46, bold: true, gap: 20 },
    { text: '2022–2026', size: 30, color: '#6a5a3a', gap: 12 },
    { text: '09.03.02 Информационные системы и технологии', size: 30, gap: 40 },
    { text: 'Профиль: фулстек-разработка', size: 30, gap: 24 },
    { text: 'Выпускная работа: мобильное приложение для задач и напоминаний', size: 30, gap: 24 },
    { text: 'Сейчас: магистратура РТУ МИРЭА и Школа 21', size: 30, gap: 40, color: '#7d1f19' },
  ], { bg: '#efe3c3', pad: 44 });
  const pageGeo = new THREE.PlaneGeometry(0.19, 0.26);
  [[-1, leftPage], [1, rightPage]].forEach(([s, map]) => {
    const half = new THREE.Group();
    half.add(box(0.205, 0.006, 0.275, coverMat, 0, 0, 0));
    const pg = new THREE.Mesh(pageGeo, std('#ffffff', { map, roughness: 0.85 }));
    pg.rotation.x = -Math.PI / 2; pg.position.y = 0.0042; pg.receiveShadow = true; half.add(pg);
    half.position.set(s * 0.104, 0.008, 0); half.rotation.z = -s * 0.07;
    edu.add(half);
  });
  edu.position.set(-0.56, TOP, 0.06); edu.rotation.y = 0.22;
  out.diplomaPages = edu;

  const books = new THREE.Group();
  books.add(box(0.27, 0.05, 0.2, std('#23336e'), 0, 0.025, 0));
  books.add(box(0.25, 0.045, 0.19, std('#3f5a34'), 0.01, 0.0725, 0.005).rotateY(0.08));
  books.add(box(0.255, 0.04, 0.012, std('#efe6cf', { roughness: 0.9 }), 0, 0.025, 0.1));
  const hat = new THREE.Group();
  hat.add(cyl(0.085, 0.09, 0.065, M.black, 0, 0.0325, 0, 32));
  const board = box(0.26, 0.008, 0.26, M.black, 0, 0.068, 0); board.rotation.y = Math.PI / 4; hat.add(board);
  hat.add(cyl(0.012, 0.012, 0.008, std('#b8862b', { metalness: 0.6 }), 0, 0.076, 0));
  const tassel = new THREE.Group();
  tassel.position.set(0, 0.076, 0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.16, 6), std('#d4a33a'));
  string.rotation.z = Math.PI / 2; string.position.x = 0.08; tassel.add(string);
  const hang = new THREE.Group(); hang.position.x = 0.16; tassel.add(hang);
  const fringe = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.07, 10), std('#d4a33a', { roughness: 0.8 })));
  fringe.position.y = -0.04; hang.add(fringe);
  hat.add(tassel);
  hat.position.set(0, 0.095, 0); hat.rotation.set(0.05, 0.4, -0.04);
  books.add(hat);
  books.position.set(-0.6, TOP, -0.3); books.rotation.y = 0.35;
  const eduAll = new THREE.Group(); eduAll.add(edu, books); scene.add(eduAll);
  out.pick.diploma = eduAll;
  out.anim.tassel = hang;

  // Телефон и записка с контактами
  const phone = new THREE.Group();
  phone.add(rbox(0.2, 0.06, 0.22, 0.02, M.red, 0, 0.03, 0));
  const top = rbox(0.17, 0.05, 0.15, 0.02, M.red, 0, 0.07, 0.02); top.rotation.x = -0.28; phone.add(top);
  const dial = new THREE.Group();
  dial.add(cyl(0.062, 0.062, 0.008, M.cream, 0, 0, 0, 40));
  const wheel = cyl(0.058, 0.058, 0.005, std('#e8e2d2', { metalness: 0.2, roughness: 0.25, transparent: true, opacity: 0.55 }), 0, 0.007, 0, 40);
  dial.add(wheel);
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI * 0.25 + i * (Math.PI * 1.45 / 9);
    dial.add(cyl(0.008, 0.008, 0.012, std('#7d1f19'), Math.cos(a) * 0.043, 0.004, Math.sin(a) * 0.043, 12));
  }
  dial.add(cyl(0.018, 0.018, 0.012, M.cream, 0, 0.006, 0, 24));
  dial.add(box(0.006, 0.006, 0.03, M.brass, 0.05, 0.012, 0.03));
  dial.position.set(0, 0.098, 0.045); dial.rotation.x = -0.28;
  phone.add(dial);
  out.anim.dial = wheel;
  // трубка на рычагах
  const handset = new THREE.Group();
  handset.add(between(new THREE.Vector3(-0.09, 0, 0), new THREE.Vector3(0.09, 0, 0), 0.016, M.red));
  handset.add(rbox(0.06, 0.045, 0.07, 0.02, M.red, -0.1, -0.015, 0));
  handset.add(rbox(0.06, 0.045, 0.07, 0.02, M.red, 0.1, -0.015, 0));
  handset.position.set(0, 0.125, -0.06);
  phone.add(handset);
  phone.add(box(0.02, 0.03, 0.03, M.red, -0.065, 0.1, -0.06));
  phone.add(box(0.02, 0.03, 0.03, M.red, 0.065, 0.1, -0.06));
  // витой шнур
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const base = new THREE.Vector3(-0.1 - t * 0.08, 0.03 - Math.sin(t * Math.PI) * 0.02 - t * 0.02, -0.06 + t * 0.12);
    const a = t * Math.PI * 2 * 18;
    pts.push(base.add(new THREE.Vector3(0, Math.cos(a) * 0.008, Math.sin(a) * 0.008)));
  }
  const cord = shadow(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0025, 6), M.red));
  cord.position.y = 0; phone.add(cord);
  phone.position.set(0.6, TOP, 0.08); phone.rotation.y = -0.45;
  out.handset = handset;

  const noteTex = paper(520, 380, [
    { text: 'Иван Капустин', size: 40, bold: true, gap: 4 },
    { text: 'Телеграм: @kaioann', size: 34, gap: 22, bold: true },
    { text: 'Почта: ivan_ius@mail.ru', size: 34, gap: 14, bold: true },
    { text: 'Гитхаб: maarshir', size: 34, gap: 14, bold: true },
  ], { bg: '#f7e48a', pad: 36, lined: false });
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.11), std('#ffffff', { map: noteTex, roughness: 0.9 }));
  note.rotation.x = -Math.PI / 2; note.rotation.z = 0.25; note.position.set(0.4, TOP + 0.001, 0.23); note.receiveShadow = true;
  const phoneAll = new THREE.Group(); phoneAll.add(phone, note); scene.add(phoneAll);
  out.pick.phone = phoneAll;

  // Окно на задней стене
  const win = new THREE.Group();
  const [sc, sg2] = canvas(512, 512);
  const skyTex = new THREE.CanvasTexture(sc); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.74), new THREE.MeshBasicMaterial({ map: skyTex }));
  win.add(sky);
  const fw = 0.05;
  win.add(box(0.96, fw, 0.06, M.frame, 0, 0.395, 0.01), box(0.96, fw, 0.06, M.frame, 0, -0.395, 0.01));
  win.add(box(fw, 0.84, 0.06, M.frame, -0.455, 0, 0.01), box(fw, 0.84, 0.06, M.frame, 0.455, 0, 0.01));
  win.add(box(0.025, 0.74, 0.04, M.frame, 0, 0, 0.01), box(0.86, 0.025, 0.04, M.frame, 0, 0.06, 0.01));
  win.add(box(1.06, 0.03, 0.14, M.frame, 0, -0.43, 0.05));
  win.position.set(-0.78, 1.62, -0.595);
  scene.add(win);
  out.sky = { canvas: sc, g: sg2, tex: skyTex };

  // Шторы колышутся от сквозняка
  const curtains = [];
  for (const x of [-1.33, -0.2]) {
    const geo = new THREE.PlaneGeometry(0.34, 1.15, 10, 24);
    const mat = std('#6e3324', { roughness: 0.9, side: THREE.DoubleSide });
    const c = new THREE.Mesh(geo, mat); c.castShadow = true; c.receiveShadow = true;
    c.position.set(x, 1.55, -0.54);
    c.userData.base = Float32Array.from(geo.attributes.position.array);
    curtains.push(c); scene.add(c);
  }
  scene.add(box(1.5, 0.018, 0.018, M.brass, -0.77, 2.13, -0.54));
  out.anim.curtains = curtains;

  // Пробковая доска со стикерами
  const boardG = new THREE.Group();
  boardG.add(box(0.62, 0.44, 0.015, std('#ffffff', { map: cork(), roughness: 0.95 }), 0, 0, 0));
  boardG.add(box(0.66, 0.025, 0.03, M.frame, 0, 0.23, 0.005), box(0.66, 0.025, 0.03, M.frame, 0, -0.23, 0.005));
  boardG.add(box(0.025, 0.48, 0.03, M.frame, -0.32, 0, 0.005), box(0.025, 0.48, 0.03, M.frame, 0.32, 0, 0.005));
  const stickies = [];
  const words = [['Питон', '#f7e48a'], ['n8n', '#9fd3e8'], ['Боты', '#f5b7a6'], ['RAG', '#b9e09a'], ['FastAPI', '#f7e48a'], ['Docker', '#f5b7a6']];
  words.forEach(([w, bg], i) => {
    const t = paper(200, 200, [{ text: w, size: 44, align: 'center', gap: 70, font: 'Tiny5' }], { bg, pad: 10 });
    const pin = new THREE.Group();
    pin.position.set(-0.22 + (i % 3) * 0.2, 0.14 - Math.floor(i / 3) * 0.2, 0.012);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), std('#ffffff', { map: t, roughness: 0.9, side: THREE.DoubleSide }));
    s.position.y = -0.05; s.castShadow = true; s.receiveShadow = true; pin.add(s);
    pin.add(cyl(0.007, 0.007, 0.01, std(['#b0452e', '#2b5d8a', '#3f7338'][i % 3]), 0, 0, 0.005, 10).rotateX(Math.PI / 2));
    pin.rotation.z = (rng(i + 9)() - 0.5) * 0.16;
    pin.userData.phase = i * 1.7;
    stickies.push(pin); boardG.add(pin);
  });
  boardG.position.set(0.5, 1.48, -0.585);
  scene.add(boardG);
  out.anim.stickies = stickies;

  // Пылинки в луче лампы
  const N = 220, pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  const rr = rng(21);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = -0.1 + rr() * 0.6; pos[i * 3 + 1] = TOP + rr() * 0.55; pos[i * 3 + 2] = -0.3 + rr() * 0.5; seeds[i] = rr() * 100;
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.004, map: soft(), transparent: true, opacity: 0, depthWrite: false, color: '#ffe2b0', blending: THREE.AdditiveBlending }));
  dust.userData.seeds = seeds; dust.userData.base = Float32Array.from(pos);
  scene.add(dust);
  out.anim.dust = dust;

  // Пар от кружки
  const steamTex = soft();
  const steam = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: '#fff3e0', transparent: true, opacity: 0, depthWrite: false }));
    s.userData.t = i / 9; steam.push(s); scene.add(s);
  }
  out.anim.steam = steam;

  return out;
}

// Небо в окне по часам гостя: ночь, утро, день, вечер
export function paintSky(sky, hour) {
  const { canvas: c, g, tex } = sky;
  const W = c.width, H = c.height;
  const phase = hour >= 22 || hour < 5 ? 'night' : hour < 10 ? 'morning' : hour < 18 ? 'day' : 'evening';
  const grad = g.createLinearGradient(0, 0, 0, H);
  const pal = {
    night: ['#060b1d', '#13204a'], morning: ['#7fa7d8', '#f3c9a0'],
    day: ['#5d97d6', '#bfdcf2'], evening: ['#1b1f4a', '#d0704a'],
  }[phase];
  grad.addColorStop(0, pal[0]); grad.addColorStop(1, pal[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const r = rng(77);
  if (phase === 'night' || phase === 'evening') {
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.7})`; const s = r() > .9 ? 3 : 2; g.fillRect(r() * W, r() * H * 0.7, s, s); }
    g.fillStyle = '#f5f0d8'; g.beginPath(); g.arc(W * 0.7, H * 0.25, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal[0]; g.beginPath(); g.arc(W * 0.7 + 14, H * 0.25 - 8, 30, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (const [x, y, s] of [[120, 120, 1], [360, 200, 1.3]]) { for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 28 * s, y + (k % 2) * -10, 26 * s, 0, Math.PI * 2); g.fill(); } }
  }
  // силуэты домов с окнами
  g.fillStyle = phase === 'day' ? '#4f5a6b' : '#0b0d16';
  const rb = rng(5);
  let x = 0;
  while (x < W) {
    const w = 60 + rb() * 80, h = 90 + rb() * 170;
    g.fillRect(x, H - h, w, h);
    for (let wy = H - h + 14; wy < H - 10; wy += 22) for (let wx = x + 10; wx < x + w - 10; wx += 18) {
      if (rb() > (phase === 'day' ? 1 : 0.62)) { g.fillStyle = '#f2c46b'; g.fillRect(wx, wy, 8, 10); g.fillStyle = '#0b0d16'; }
    }
    x += w + 6;
  }
  tex.needsUpdate = true;
  return phase;
}
