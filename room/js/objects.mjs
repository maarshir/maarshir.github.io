// Комната: модели с Poly Haven (свободная лицензия) и несколько предметов, собранных в коде.
// Единицы в метрах, верх столешницы на высоте 0,76.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { paper, soft, canvas, rng } from './textures.mjs';

export const TOP = 0.76;

// Двоичный файл по адресу; в предпросмотре без .glb и .hdr тот же файл лежит рядом как base64 в .json
export async function fetchBin(url, manager) {
  manager?.itemStart(url);
  try {
    if (window.ROOM_B64) {
      const { b64 } = await fetch(url + '.json').then(r => r.json());
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    }
    return await fetch(url).then(r => r.arrayBuffer());
  } finally { manager?.itemEnd(url); }
}

const shadow = (m) => { m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = shadow(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); return m; }
const rbox = (w, h, d, r, mat, x, y, z) => mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat, x, y, z);

export async function buildRoom(scene, manager, { projects }) {
  const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const texLoader = new THREE.TextureLoader(manager);
  const load = (id) => fetchBin(`models/${id}.glb`, manager).then(buf => gltf.parseAsync(buf, '')).then(g => shadow(g.scene));

  // PBR-материал из трёх карт: цвет, рельеф, затенение/шероховатость/металл
  function pbr(name, repeat = [1, 1], extra = {}) {
    const t = (s, srgb) => {
      const x = texLoader.load(`tex/${name}_${s}.webp`);
      x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(...repeat); x.anisotropy = 8;
      if (srgb) x.colorSpace = THREE.SRGBColorSpace;
      return x;
    };
    const arm = t('arm');
    return new THREE.MeshStandardMaterial({ map: t('diff', true), normalMap: t('nor'), aoMap: arm, roughnessMap: arm, metalnessMap: arm, metalness: 1, ...extra });
  }

  const M = {
    desk: pbr('desk', [1.6, 0.8], { envMapIntensity: 0.45 }),
    deskEdge: pbr('darkwood', [2, 0.2]),
    floor: pbr('floor', [3, 3]),
    wall: pbr('wall', [2.5, 1.5], { color: '#c9b79a' }),
    velvet: pbr('velvet', [2, 3], { color: '#4e1f19', side: THREE.DoubleSide }),
    capCloth: pbr('velvet', [1, 1], { color: '#1a1a1c' }),
    plastic: new THREE.MeshStandardMaterial({ color: '#d4cbb6', roughness: 0.48 }),
    plastic2: new THREE.MeshStandardMaterial({ color: '#bdb39c', roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2826', roughness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c39a45', metalness: 1, roughness: 0.32 }),
    frame: pbr('darkwood', [1, 1]),
  };

  const out = { pick: {}, anim: {}, focus: {} };

  // Пол, стены, плинтус
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), M.wall);
  wall.position.set(0, 1.6, -0.6); wall.receiveShadow = true; scene.add(wall);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.2), M.wall);
  side.rotation.y = Math.PI / 2; side.position.set(-1.75, 1.6, 0.9); side.receiveShadow = true; scene.add(side);
  scene.add(mesh(new THREE.BoxGeometry(6, 0.1, 0.02), M.frame, 0, 0.05, -0.59));

  // Стол: толстая столешница с тёмной кромкой и ящиками справа
  const desk = new THREE.Group();
  desk.add(rbox(1.62, 0.04, 0.8, 0.008, M.desk, 0, TOP - 0.02, -0.18));
  desk.add(rbox(1.64, 0.025, 0.82, 0.006, M.deskEdge, 0, TOP - 0.05, -0.18));
  for (const [x, z] of [[-0.76, 0.17], [-0.76, -0.53]]) desk.add(rbox(0.05, TOP - 0.06, 0.05, 0.01, M.deskEdge, x, (TOP - 0.06) / 2, z));
  desk.add(rbox(0.45, TOP - 0.06, 0.74, 0.01, M.deskEdge, 0.58, (TOP - 0.06) / 2, -0.18));
  for (let i = 0; i < 3; i++) {
    const y = 0.16 + i * 0.2;
    desk.add(rbox(0.41, 0.18, 0.02, 0.006, M.desk, 0.58, y, 0.195));
    desk.add(rbox(0.1, 0.014, 0.02, 0.006, M.brass, 0.58, y + 0.03, 0.212));
  }
  scene.add(desk);

  // Компьютер: системный блок, монитор-кинескоп, клавиатура, мышь
  const pc = new THREE.Group();
  pc.add(rbox(0.46, 0.1, 0.4, 0.01, M.plastic, 0, TOP + 0.05, -0.24));
  pc.add(rbox(0.16, 0.012, 0.01, 0.003, M.dark, 0.11, TOP + 0.06, -0.04));
  pc.add(rbox(0.03, 0.022, 0.012, 0.004, M.plastic2, 0.2, TOP + 0.035, -0.04));
  const led = mesh(new THREE.BoxGeometry(0.01, 0.005, 0.004), new THREE.MeshStandardMaterial({ color: '#1a3a1a', emissive: '#40ff70', emissiveIntensity: 0 }), -0.19, TOP + 0.07, -0.038);
  pc.add(led); out.led = led;
  pc.add(rbox(0.035, 0.03, 0.012, 0.005, new THREE.MeshStandardMaterial({ color: '#8a2a20', roughness: 0.4 }), -0.15, TOP + 0.04, -0.04));
  for (let i = 0; i < 7; i++) pc.add(mesh(new THREE.BoxGeometry(0.11, 0.003, 0.003), M.dark, -0.02, TOP + 0.025 + i * 0.008, -0.039));

  const tv = await load('television_02');
  tv.position.set(0, TOP + 0.1, -0.19);
  pc.add(tv);
  // экран: выгнутая плоскость поверх стекла модели
  const sg = new THREE.PlaneGeometry(0.336, 0.252, 32, 24);
  const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.168, y = p.getY(i) / 0.126;
    p.setZ(i, 0.018 * (1 - x * x * 0.75) * (1 - y * y * 0.75));
  }
  sg.computeVertexNormals();
  out.screenGeo = sg;
  out.screenAt = (screenMesh) => { screenMesh.position.set(0, 0.2575, 0.111); tv.add(screenMesh); };

  // клавиатура: корпус с наклоном и клавиши с закруглёнными краями
  const kb = new THREE.Group();
  kb.add(rbox(0.46, 0.026, 0.165, 0.008, M.plastic, 0, 0, 0));
  const keyGeo = new RoundedBoxGeometry(0.0205, 0.012, 0.0205, 3, 0.0035);
  const keys = new THREE.InstancedMesh(keyGeo, new THREE.MeshStandardMaterial({ color: '#d9d1bd', roughness: 0.45 }), 90);
  keys.castShadow = true; keys.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let k = 0;
  const rr = rng(8);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 17; c++) {
    if (r === 4 && c > 4 && c < 11) { if (c !== 5) continue; s.set(6.6, 1, 1); mtx.compose(new THREE.Vector3(-0.2 + 7.5 * 0.0245, 0.018, -0.055 + r * 0.025), q, s); }
    else { s.set(1, 1, 1); mtx.compose(new THREE.Vector3(-0.196 + c * 0.0245, 0.018 + (rr() - 0.5) * 0.0006, -0.055 + r * 0.025), q, s); }
    keys.setMatrixAt(k++, mtx);
  }
  keys.count = k;
  kb.add(keys);
  kb.position.set(0.0, TOP + 0.014, 0.1); kb.rotation.set(0.05, 0.06, 0);
  pc.add(kb);
  const mouse = new THREE.Group();
  const mg = new THREE.SphereGeometry(0.035, 24, 16); mg.scale(0.85, 0.42, 1.4);
  mouse.add(mesh(mg, M.plastic, 0, 0.012, 0));
  mouse.position.set(0.32, TOP, 0.12); mouse.rotation.y = -0.15;
  pc.add(mouse);
  pc.rotation.y = 0.12;
  scene.add(pc);
  out.pick.computer = pc;
  out.tv = tv;

  // Лампа на струбцине у задней кромки, плафон над клавиатурой
  const lamp = await load('desk_lamp_arm_01');
  // струбцина у задней кромки, рычаг тянется к центру стола
  lamp.position.set(-0.37, TOP, -0.31);
  lamp.rotation.y = -2.5;
  lamp.traverse(o => {
    if (!o.isMesh) return;
    if (o.material.name.includes('light')) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffd49a'); o.material.emissiveIntensity = 0; out.bulbMat = o.material; o.castShadow = false; }
    else { o.material.color.multiplyScalar(0.55); }
  });
  scene.add(lamp);
  lamp.updateMatrixWorld(true);
  const bulbPos = new THREE.Vector3(-0.0045, 0.69, -0.17).applyMatrix4(lamp.matrixWorld);
  const target = new THREE.Vector3(-0.05, TOP, 0.06);
  const spot = new THREE.SpotLight('#ffc27a', 0, 3, 0.95, 0.75, 1.5);
  spot.position.copy(bulbPos).add(new THREE.Vector3(0, -0.02, 0));
  spot.target.position.copy(target);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.01; spot.shadow.radius = 4;
  spot.shadow.camera.near = 0.05; spot.shadow.camera.far = 3;
  const glow = new THREE.PointLight('#ffb560', 0, 1.4, 1.6);
  glow.position.copy(bulbPos).add(new THREE.Vector3(0, 0.03, 0));
  scene.add(spot, spot.target, glow);
  out.lamp = { spot, glow, bulbMat: out.bulbMat };
  out.pick.lamp = lamp;
  out.beam = { from: bulbPos.clone(), to: target.clone() };

  // Учёба: диплом в рамке, книги, квадратная шапочка
  const edu = new THREE.Group();
  const frame = await load('standing_picture_frame_02');
  const diplomaTex = paper(600, 840, [
    { text: 'ДИПЛОМ', size: 60, bold: true, align: 'center', color: '#6b4a10', gap: 110 },
    { text: 'бакалавра', size: 38, align: 'center', color: '#6b4a10', gap: 14 },
    { text: 'Капустин Иван Сергеевич', size: 30, align: 'center', gap: 70 },
    { text: 'РТУ МИРЭА, 2022–2026', size: 30, align: 'center', gap: 60 },
    { text: '09.03.02 Информационные системы и технологии', size: 26, align: 'center', gap: 26 },
    { text: 'Профиль: фулстек-разработка', size: 26, align: 'center', gap: 20 },
    { text: 'Выпускная работа: мобильное приложение для задач и напоминаний', size: 25, align: 'center', gap: 40 },
  ], { bg: '#f1e6c8', pad: 96 });
  diplomaTex.flipY = false;
  frame.traverse(o => {
    if (!o.isMesh) return;
    if (o.material.name.includes('artwork')) o.material = new THREE.MeshStandardMaterial({ map: diplomaTex, roughness: 0.85 });
    else if (o.material.name.includes('glass')) { o.material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transparent: true, opacity: 0.12, envMapIntensity: 2 }); o.castShadow = false; }
  });
  frame.scale.setScalar(1.25);
  frame.position.set(-0.6, TOP, -0.12); frame.rotation.y = -1.25;
  edu.add(frame);
  out.frame = frame;

  const books = await load('book_encyclopedia_set_01');
  const keep = new Set(['01', '02', '03', '04', '05', '06', '07']);
  books.traverse(o => { if (o.name.startsWith('book_encyclopedia_set_01_book') && !keep.has(o.name.slice(-2))) o.visible = false; });
  books.position.set(-0.74, TOP, -0.5); books.rotation.y = 0.18;
  edu.add(books);

  const cap = new THREE.Group();
  cap.add(mesh(new THREE.CylinderGeometry(0.088, 0.094, 0.07, 40, 1, true), M.capCloth, 0, 0.035, 0));
  cap.add(mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.004, 40), M.capCloth, 0, 0.07, 0));
  const board = rbox(0.25, 0.008, 0.25, 0.002, M.capCloth, 0, 0.074, 0); board.rotation.y = 0.3; cap.add(board);
  cap.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 16), M.brass, 0, 0.081, 0));
  const tassel = new THREE.Group(); tassel.position.set(0, 0.081, 0); tassel.rotation.y = 0.9;
  const cord = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.155, 6), new THREE.MeshStandardMaterial({ color: '#d8a83c', roughness: 0.6 }), 0.078, 0, 0);
  cord.rotation.z = Math.PI / 2; tassel.add(cord);
  const hang = new THREE.Group(); hang.position.x = 0.155; tassel.add(hang);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const st = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.075, 4), new THREE.MeshStandardMaterial({ color: '#d8a83c', roughness: 0.7 }), Math.cos(a) * 0.005, -0.045, Math.sin(a) * 0.005);
    hang.add(st);
  }
  hang.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 10), M.brass, 0, -0.006, 0));
  tassel.add(hang);
  cap.add(tassel);
  cap.position.set(-0.4, TOP, -0.32); cap.rotation.set(0.0, 0.5, 0.0);
  edu.add(cap);
  scene.add(edu);
  out.pick.diploma = edu;
  out.anim.tassel = hang;

  // Настенный телефон и записка с контактами
  const phoneG = new THREE.Group();
  const phone = await load('vintage_telephone_wall_clock');
  phone.position.set(0.62, 1.05, -0.6);
  phoneG.add(phone);
  out.phone = phone;
  const contactNote = sticky('#f7e27e', [
    { t: 'Иван Капустин', s: 46 },
    { t: 'тг @kaioann', s: 50 },
    { t: 'ivan_ius@mail.ru', s: 44 },
    { t: 'гитхаб: maarshir', s: 44 },
  ], 0.11, 3);
  contactNote.position.set(0.88, 1.3, -0.597); contactNote.rotation.z = -0.07;
  phoneG.add(contactNote);
  const sconce = new THREE.PointLight('#ffb36b', 0.35, 1.3, 1.6);
  sconce.position.set(0.72, 1.55, -0.25); phoneG.add(sconce);
  scene.add(phoneG);
  out.pick.phone = phoneG;

  // Чайная пара, карандаши, растение, кассетник, бумаги, очки
  const tea = await load('tea_set_01');
  const cup = new THREE.Group();
  for (const n of ['tea_set_01_cup_small_01', 'tea_set_01_saucer_circular_04']) {
    const o = tea.getObjectByName(n); const c = o.clone(); c.position.set(0, 0, 0); cup.add(c);
  }
  cup.getObjectByName('tea_set_01_cup_small_01').position.set(0, 0.012, 0.0);
  cup.getObjectByName('tea_set_01_saucer_circular_04').position.set(-0.0, 0, -0.0);
  // у модели точка отсчёта смещена, выровняем по рамке
  cup.children.forEach(o => { o.geometry.computeBoundingBox(); const c = o.geometry.boundingBox.getCenter(new THREE.Vector3()); o.position.x -= c.x; o.position.z -= c.z; });
  cup.position.set(0.34, TOP, -0.02); cup.rotation.y = 0.5;
  scene.add(cup);
  out.steamFrom = new THREE.Vector3(0.34, TOP + 0.085, -0.02);
  // в чашке чай
  const teaSurface = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24), new THREE.MeshStandardMaterial({ color: '#4a2410', roughness: 0.08 }));
  teaSurface.rotation.x = -Math.PI / 2; teaSurface.position.set(0.34, TOP + 0.067, -0.02); scene.add(teaSurface);

  const st = await load('stationery_supplies');
  const pencilCup = st.getObjectByName('stationery_supplies_pencilcup');
  const holder = new THREE.Group();
  const pc0 = pencilCup.clone(); pc0.position.set(0, 0, 0); pc0.rotation.set(0, 0, 0); holder.add(pc0);
  holder.updateMatrixWorld(true);
  let ci = 0;
  for (const n of ['stationery_supplies_pencil_new_a', 'stationery_supplies_pen_blue', 'stationery_supplies_pencil_used', 'stationery_supplies_pen_fancy']) {
    const o = st.getObjectByName(n).clone();
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, len = bb.max.x - bb.min.x;
    const g = new THREE.Group(); g.add(o);
    o.position.x = -(bb.min.x + bb.max.x) / 2;
    g.rotation.z = Math.PI / 2 + (ci - 1.5) * 0.12; g.rotation.y = ci * 1.3;
    g.position.set((ci % 2 - 0.5) * 0.02, len / 2 + 0.01, (ci > 1 ? 0.01 : -0.01));
    holder.add(g); ci++;
  }
  holder.position.set(0.27, TOP, -0.44);
  scene.add(holder);
  const pen = st.getObjectByName('stationery_supplies_pen_red').clone();
  pen.position.set(-0.24, TOP + 0.012, 0.16); pen.rotation.set(0, -0.6, 0); scene.add(pen);

  const plant = await load('potted_plant_04');
  plant.position.set(0.66, TOP, -0.42); plant.rotation.y = 1.2; scene.add(plant);

  const tape = await load('cassette_player');
  tape.position.set(0.6, TOP, -0.12); tape.rotation.y = -0.55; scene.add(tape);
  out.pick.tape = tape;

  const notes = await load('office_notepads');
  const stack = notes.getObjectByName('office_notepads_a4_stack').clone();
  stack.position.set(-0.32, TOP + 0.001, 0.14); stack.rotation.y = 0.22;
  stack.geometry.computeBoundingBox(); const sc = stack.geometry.boundingBox.getCenter(new THREE.Vector3());
  const stackG = new THREE.Group(); stack.position.set(-sc.x, 0, -sc.z); stackG.add(stack);
  stackG.position.set(-0.33, TOP + 0.001, 0.12); stackG.rotation.y = 0.25; scene.add(stackG);
  const pad = notes.getObjectByName('office_notepads_yellow_pad').clone();
  pad.geometry.computeBoundingBox(); const pcn = pad.geometry.boundingBox.getCenter(new THREE.Vector3());
  const padG = new THREE.Group(); pad.position.set(-pcn.x, 0, -pcn.z); padG.add(pad);
  padG.position.set(0.48, TOP + 0.001, 0.16); padG.rotation.y = -0.4; padG.scale.setScalar(0.8); scene.add(padG);

  const glasses = await load('round_spectacles');
  glasses.position.set(-0.3, TOP + 0.012, 0.1); glasses.rotation.y = 0.9; scene.add(glasses);

  // Стикеры: на мониторе и на стене, вразнобой, с загнутыми краями
  const r = rng(31);
  const wallNotes = [
    ['#f7e27e', [{ t: 'Питон', s: 64 }, { t: 'FastAPI', s: 48 }], -0.42, 1.52, 0.11],
    ['#f6b7a8', [{ t: 'n8n', s: 70 }, { t: 'конвейеры', s: 40 }], -0.25, 1.42, -0.09],
    ['#a9dbe8', [{ t: 'RAG', s: 70 }, { t: 'BM25', s: 46 }], -0.08, 1.58, 0.06],
    ['#bfe39f', [{ t: 'боты', s: 64 }, { t: 'в Телеграме', s: 38 }], 0.13, 1.47, -0.12],
    ['#f7e27e', [{ t: 'Docker', s: 56 }, { t: 'Linux', s: 46 }], 0.3, 1.6, 0.08],
    ['#f6b7a8', [{ t: 'не забыть:', s: 40 }, { t: 'стажировка!', s: 42 }], 0.36, 1.36, -0.05],
  ];
  out.anim.stickies = [];
  wallNotes.forEach(([c, lines, x, y, rot], i) => {
    const n = sticky(c, lines, 0.082 + r() * 0.01, i + 40);
    n.position.set(x, y, -0.597); n.rotation.z = rot;
    n.userData.phase = r() * 6; n.userData.rot = rot;
    scene.add(n); out.anim.stickies.push(n);
  });
  const monNotes = [
    ['#f7e27e', [{ t: 'Ctrl+S', s: 52 }, { t: 'всегда', s: 40 }], -0.19, 0.432, 0.22],
    ['#a9dbe8', [{ t: 'коммит', s: 46 }, { t: 'до ночи', s: 40 }], 0.2, 0.36, -0.16],
  ];
  monNotes.forEach(([c, lines, x, y, rot], i) => {
    const n = sticky(c, lines, 0.066, i + 90);
    n.position.set(x, y, 0.124); n.rotation.z = rot;
    n.userData.phase = r() * 6; n.userData.rot = rot;
    tv.add(n); out.anim.stickies.push(n);
  });

  // Окно слева на задней стене, шторы колышутся
  const win = new THREE.Group();
  const [scv, sgx] = canvas(1024, 768);
  const skyTex = new THREE.CanvasTexture(scv); skyTex.colorSpace = THREE.SRGBColorSpace;
  win.add(new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.9), new THREE.MeshBasicMaterial({ map: skyTex })));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.9), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.08, envMapIntensity: 1.5 }));
  glass.position.z = 0.012; win.add(glass);
  const fw = 0.045;
  for (const [w, h, x, y] of [[0.95, fw, 0, 0.47], [0.95, fw, 0, -0.47], [fw, 0.98, -0.45, 0], [fw, 0.98, 0.45, 0], [0.024, 0.9, 0, 0], [0.86, 0.024, 0, 0.12]]) win.add(rbox(w, h, 0.05, 0.006, M.frame, x, y, 0.02));
  win.add(rbox(1.08, 0.03, 0.16, 0.008, M.frame, 0, -0.5, 0.06));
  win.position.set(-1.0, 1.62, -0.595);
  scene.add(win);
  out.sky = { canvas: scv, g: sgx, tex: skyTex };

  const curtains = [];
  for (const x of [-1.56, -0.42]) {
    const geo = new THREE.PlaneGeometry(0.36, 1.5, 14, 30);
    const c = new THREE.Mesh(geo, M.velvet); c.castShadow = true; c.receiveShadow = true;
    c.position.set(x, 1.45, -0.53);
    c.userData.base = Float32Array.from(geo.attributes.position.array);
    curtains.push(c); scene.add(c);
  }
  scene.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.5, 12), M.brass, -0.99, 2.22, -0.53).rotateZ(Math.PI / 2));
  out.anim.curtains = curtains;

  // Пылинки в луче лампы
  const N = 260, pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  const rd = rng(21);
  for (let i = 0; i < N; i++) { pos[i * 3] = -0.45 + rd() * 0.6; pos[i * 3 + 1] = TOP + rd() * 0.6; pos[i * 3 + 2] = -0.35 + rd() * 0.5; seeds[i] = rd() * 100; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.0035, map: soft(), transparent: true, opacity: 0, depthWrite: false, color: '#ffe0b0', blending: THREE.AdditiveBlending }));
  dust.userData.seeds = seeds; dust.userData.base = Float32Array.from(pos);
  scene.add(dust); out.anim.dust = dust;

  const steamTex = soft();
  out.anim.steam = [];
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: '#fff3e0', transparent: true, opacity: 0, depthWrite: false }));
    sp.userData.t = i / 10; out.anim.steam.push(sp); scene.add(sp);
  }

  return out;
}

// Стикер: бумажный квадрат с загнутым нижним углом и надписью от руки
function sticky(color, lines, size, seed) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  const r = rng(seed);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(90,60,20,${r() * 0.05})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
  const grad = g.createLinearGradient(0, 0, 0, 40); grad.addColorStop(0, 'rgba(0,0,0,.08)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 40);
  g.fillStyle = '#2b2f4a'; g.textAlign = 'center';
  const total = lines.reduce((a, l) => a + l.s * 1.05, 0);
  let y = 128 - total / 2 + 10;
  lines.forEach((l, i) => {
    y += l.s * (i ? 1.05 : 0.85);
    g.save(); g.translate(128 + (r() - 0.5) * 10, y); g.rotate((r() - 0.5) * 0.08);
    g.font = `${l.s}px Caveat, cursive`; g.fillText(l.t, 0, 0); g.restore();
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(size, size, 10, 10);
  const p = geo.attributes.position;
  const rr = rng(seed + 1);
  const curl = 0.004 + rr() * 0.008, side = rr() > 0.5 ? 1 : -1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / size + 0.5, y = p.getY(i) / size + 0.5;   // 0..1
    const corner = Math.max(0, (side > 0 ? x : 1 - x) - 0.45) * Math.max(0, 0.55 - y);
    p.setZ(i, 0.0015 + (1 - y) * (1 - y) * curl + corner * corner * 0.35);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true;
  // точка подвеса у верхнего края, чтобы стикер качался как приклеенный
  m.position.y = -size / 2;
  const pivot = new THREE.Group(); pivot.add(m);
  return pivot;
}

// Небо в окне по часам гостя
export function paintSky(sky, hour) {
  const { canvas: c, g, tex } = sky;
  const W = c.width, H = c.height;
  const phase = hour >= 22 || hour < 5 ? 'night' : hour < 10 ? 'morning' : hour < 18 ? 'day' : 'evening';
  const pal = { night: ['#050916', '#16244d'], morning: ['#7fa7d8', '#f3c9a0'], day: ['#5d97d6', '#cfe3f3'], evening: ['#1b1f4a', '#d0704a'] }[phase];
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal[0]); grad.addColorStop(1, pal[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const r = rng(77);
  if (phase === 'night' || phase === 'evening') {
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,240,${0.2 + r() * 0.7})`; const s = r() > 0.92 ? 2.5 : 1.4; g.beginPath(); g.arc(r() * W, r() * H * 0.6, s, 0, 7); g.fill(); }
    const mg = g.createRadialGradient(W * 0.72, H * 0.22, 10, W * 0.72, H * 0.22, 120);
    mg.addColorStop(0, 'rgba(255,250,220,.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = mg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f5f0d8'; g.beginPath(); g.arc(W * 0.72, H * 0.22, 36, 0, 7); g.fill();
    g.fillStyle = 'rgba(5,9,22,.92)'; g.beginPath(); g.arc(W * 0.72 + 16, H * 0.22 - 9, 33, 0, 7); g.fill();
  }
  // дальние и ближние дома с огнями
  for (const [shade, minH, maxH, lightP] of [[phase === 'day' ? '#7d8796' : '#0e1426', 120, 300, 0.25], [phase === 'day' ? '#56606f' : '#080b14', 180, 420, 0.4]]) {
    const rb = rng(minH);
    let x = -20;
    while (x < W) {
      const w = 70 + rb() * 120, h = minH + rb() * (maxH - minH);
      g.fillStyle = shade; g.fillRect(x, H - h, w, h);
      if (phase !== 'day') for (let wy = H - h + 16; wy < H - 8; wy += 26) for (let wx = x + 10; wx < x + w - 12; wx += 20) {
        if (rb() < lightP) { g.fillStyle = rb() > 0.3 ? '#f2c46b' : '#9fc4ff'; g.globalAlpha = 0.6 + rb() * 0.4; g.fillRect(wx, wy, 9, 12); g.globalAlpha = 1; }
      }
      x += w + 4;
    }
  }
  tex.needsUpdate = true;
  return phase;
}
