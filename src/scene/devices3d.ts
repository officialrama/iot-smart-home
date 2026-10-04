import * as THREE from "three";
import type { DeviceId, DeviceStore } from "../core/devices";
import type { Env } from "../core/home";
import { M, box, cyl, ease, mat, tagDevice } from "./helpers";

export interface FrameCtx {
  dt: number;
  time: number;
  /** 0 = siang, 1 = malam */
  night: number;
  reduceMotion: boolean;
  store: DeviceStore;
  env: Env;
  callActive: boolean;
}

type Updater = (ctx: FrameCtx) => void;

// Intensitas lampu memakai satuan fisik three.js (candela).
const LAMP_CD = 9;
const lampBoost = (night: number) => 0.55 + 0.65 * night;

/** Bangun semua perangkat & sensor di scene, kembalikan fungsi update per frame. */
export function buildDevices(scene: THREE.Scene): Updater {
  const updaters: Updater[] = [
    buildAc(scene),
    buildTv(scene),
    buildFloorLamp(scene, "lampTamu", -7.2, 0, -4.8, 1.7),
    buildFloorLamp(scene, "lampKamar", 3.7, 0.55, -9.5, 0.9),
    buildCurtainsAndWindow(scene),
    buildFan(scene),
    buildDoorAndAlarm(scene),
    buildGarage(scene),
    buildGate(scene),
    buildCctv(scene),
    buildSprinkler(scene),
    buildGardenLight(scene),
    buildPorchLights(scene),
    buildSiren(scene),
    buildLorong(scene),
    buildBathroom(scene),
    buildKitchenGas(scene),
    buildTank(scene),
    buildJemuran(scene),
    buildDoorbell(scene),
    buildRain(scene)
  ];
  return (ctx) => updaters.forEach((u) => u(ctx));
}

let softTex: THREE.Texture | null = null;
/** Tekstur titik bulat lembut untuk partikel gas. */
function softDot(): THREE.Texture {
  if (softTex) return softTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}

function glowBulb(parent: THREE.Object3D, r: number, x: number, y: number, z: number) {
  const m = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0x000000 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  b.position.set(x, y, z);
  parent.add(b);
  return m;
}

// ---------- AC ----------
function buildAc(scene: THREE.Scene): Updater {
  const group = new THREE.Group();
  group.position.set(-5.4, 2.25, -5.72);
  scene.add(group);
  box(group, 1.7, 0.5, 0.34, mat.white, 0, 0, 0);
  const flap = new THREE.Group();
  flap.position.set(0, -0.2, 0.17);
  group.add(flap);
  box(flap, 1.5, 0.04, 0.16, M(0xdedede), 0, 0, 0.08);
  const ledMat = M(0x333333, { emissive: 0x000000 });
  box(group, 0.06, 0.06, 0.02, ledMat, 0.7, 0.12, 0.175);
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 64;
  const c2 = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  screen.position.set(0.45, 0.1, 0.172);
  group.add(screen);
  const draw = (on: boolean) => {
    c2.clearRect(0, 0, 128, 64);
    if (on) {
      c2.fillStyle = "#7fd3ff"; c2.font = "bold 44px monospace"; c2.textAlign = "center"; c2.textBaseline = "middle";
      c2.fillText("24°", 64, 34);
    }
    tex.needsUpdate = true;
  };
  draw(false);
  tagDevice(group, "ac");

  const N = 160;
  const pos = new Float32Array(N * 3);
  const vel = Array.from({ length: N }, () => new THREE.Vector3());
  const life = new Float32Array(N);
  const reset = (i: number) => {
    pos[i * 3] = -5.4 + (Math.random() - 0.5) * 1.4; pos[i * 3 + 1] = 2.02; pos[i * 3 + 2] = -5.45;
    vel[i].set((Math.random() - 0.5) * 0.3, -0.35 - Math.random() * 0.3, 1.2 + Math.random() * 0.8);
    life[i] = 0;
  };
  for (let i = 0; i < N; i++) { reset(i); life[i] = Math.random() * 2.4; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x8fd8ff, size: 0.09, transparent: true, opacity: 0, depthWrite: false });
  scene.add(new THREE.Points(geo, pMat));

  let lastOn = false;
  return ({ store, dt, time, reduceMotion }) => {
    const s = store.state.ac;
    flap.rotation.x = ease(s.t) * 0.95 + (reduceMotion ? 0 : Math.sin(time * 1.4) * 0.12 * s.t);
    ledMat.emissive.setHex(s.on ? 0x2ad1ff : 0x000000);
    if (s.on !== lastOn) { lastOn = s.on; draw(s.on); }
    pMat.opacity = s.t * 0.75;
    if (s.t <= 0.01) return;
    for (let i = 0; i < N; i++) {
      life[i] += dt;
      pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
      if (life[i] > 2.4 || pos[i * 3 + 1] < 0.3) reset(i);
    }
    geo.attributes.position.needsUpdate = true;
  };
}

// ---------- Smart TV + speaker ----------
function buildTv(scene: THREE.Scene): Updater {
  const group = new THREE.Group();
  group.position.set(-1, 1.45, -5.82);
  scene.add(group);
  box(group, 2.3, 1.3, 0.08, mat.dark, 0, 0, 0);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, emissive: 0x000000, roughness: 0.3 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.16), screenMat);
  screen.position.z = 0.045;
  group.add(screen);
  const light = new THREE.PointLight(0x6aa8ff, 0, 6, 2);
  light.position.set(0, 0, 0.8);
  group.add(light);
  tagDevice(group, "tv");
  // speaker pintar di atas kabinet
  cyl(scene, 0.09, 0.1, 0.16, M(0xd9d6d0), 0.1, 0.63, -5.6);

  return ({ store, time }) => {
    const t = store.state.tv.t;
    if (t > 0) {
      const h = (time * 0.07) % 1;
      screenMat.emissive.setHSL(h, 0.6, 0.45 * t);
      light.color.setHSL(h, 0.6, 0.6);
    } else screenMat.emissive.setRGB(0, 0, 0);
    light.intensity = t * 6;
  };
}

// ---------- Lampu berdiri (bisa diredupkan) ----------
function buildFloorLamp(scene: THREE.Scene, id: DeviceId, x: number, y: number, z: number, h: number): Updater {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  scene.add(g);
  cyl(g, 0.25, 0.3, 0.06, mat.metal, 0, 0.13, 0);
  cyl(g, 0.03, 0.03, h, mat.metal, 0, h / 2 + 0.1, 0);
  const shadeMat = M(0xf3e6cc, { side: THREE.DoubleSide, emissive: 0x000000 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 0.4, 24, 1, true), shadeMat);
  shade.position.y = h + 0.1;
  shade.castShadow = true;
  g.add(shade);
  const bulbMat = glowBulb(g, 0.11, 0, h, 0);
  const light = new THREE.PointLight(0xffc77a, 0, 10, 2);
  light.position.y = h;
  g.add(light);
  tagDevice(g, id);

  return ({ store, night }) => {
    const s = store.state[id];
    const v = s.t * s.level;
    light.intensity = v * LAMP_CD * lampBoost(night);
    bulbMat.emissive.setRGB(v, 0.8 * v, 0.45 * v);
    shadeMat.emissive.setRGB(0.5 * v, 0.38 * v, 0.2 * v);
  };
}

// ---------- Tirai (ruang tamu & kamar) dan jendela ruang tamu ----------
function buildCurtainsAndWindow(scene: THREE.Scene): Updater {
  const curtainMat = M(0xc7865a, { side: THREE.DoubleSide });
  const panels: THREE.Mesh[] = [];
  // Tirai menggantung di sisi dalam jendela. Pivot di tepi luar agar bisa "dikumpulkan".
  const addPair = (x: number, zc: number, width: number, inward: number) => {
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(0.04, 1.6, width / 2);
      geo.translate(0, 0, (-side * width) / 4); // tepi luar di z=0
      const m = new THREE.Mesh(geo, curtainMat);
      m.position.set(x + inward * 0.18, 1.55, zc + (side * width) / 2);
      m.castShadow = true;
      scene.add(m);
      tagDevice(m, "tirai");
      panels.push(m);
    }
    box(scene, 0.04, 0.04, width + 0.3, mat.metal, x + inward * 0.18, 2.38, zc);
  };
  addPair(-8, 2, 2.2, 1);
  addPair(8, -5, 2.2, -1);

  // Jendela geser ruang tamu (sensor jendela untuk aturan AC hemat)
  const fixedPane = box(scene, 0.12, 1.1, 1.0, mat.glass, -8.04, 1.6, 1.5);
  const slidePane = box(scene, 0.12, 1.1, 1.0, mat.glass, -7.96, 1.6, 2.5);
  fixedPane.castShadow = slidePane.castShadow = false;
  const sensorMat = M(0x000000, { emissive: 0x21c26b });
  box(scene, 0.05, 0.1, 0.06, sensorMat, -7.88, 2.2, 3.05);
  let open = 0;

  return ({ store, env, dt }) => {
    const t = ease(store.state.tirai.t);
    const k = 1 - 0.85 * t; // terbuka = terkumpul di tepi
    for (const p of panels) p.scale.z = k;
    open += ((env.windowOpen ? 1 : 0) - open) * Math.min(1, dt * 3);
    slidePane.position.z = 2.5 - open * 0.95;
    sensorMat.emissive.setHex(env.windowOpen ? 0xff7a1a : 0x21c26b);
  };
}

// ---------- Kipas angin ----------
function buildFan(scene: THREE.Scene): Updater {
  const group = new THREE.Group();
  group.position.set(7.2, 0, -4.2);
  group.rotation.y = -Math.PI * 0.6;
  scene.add(group);
  cyl(group, 0.3, 0.35, 0.06, mat.white, 0, 0.13, 0);
  cyl(group, 0.035, 0.035, 1.2, mat.white, 0, 0.7, 0);
  const head = new THREE.Group();
  head.position.set(0, 1.35, 0);
  group.add(head);
  cyl(head, 0.12, 0.12, 0.25, mat.white, 0, 0, -0.08).rotation.x = Math.PI / 2;
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 8, 40), mat.white);
  cage.position.z = 0.1;
  head.add(cage);
  const rotor = new THREE.Group();
  rotor.position.z = 0.08;
  head.add(rotor);
  const bladeMat = M(0x8fc3e0);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.015), bladeMat);
    blade.position.y = 0.21;
    blade.rotation.y = 0.35;
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI * 2) / 3;
    arm.add(blade);
    rotor.add(arm);
  }
  tagDevice(group, "fan");
  let speed = 0;
  return ({ store, dt, time, reduceMotion }) => {
    const s = store.state.fan;
    speed += ((s.on ? 14 : 0) - speed) * Math.min(1, dt * 1.2);
    rotor.rotation.z -= speed * dt;
    if (!reduceMotion) head.rotation.y = Math.sin(time * 0.6) * 0.5 * s.t;
  };
}

// ---------- Pintu depan, smart lock & keypad alarm ----------
function buildDoorAndAlarm(scene: THREE.Scene): Updater {
  const pivot = new THREE.Group();
  pivot.position.set(-3, 0.1, 6);
  scene.add(pivot);
  box(pivot, 1.2, 2.1, 0.08, M(0x6d4426), 0.6, 1.05, 0);
  box(pivot, 0.05, 0.05, 0.16, mat.metal, 1.05, 1.05, 0);
  const lockMat = M(0x000000, { emissive: 0xd13b3b });
  box(pivot, 0.08, 0.12, 0.03, lockMat, 1.05, 1.25, 0.06);
  tagDevice(pivot, "door");

  // Keypad PIN + sidik jari di samping kanan pintu
  const pad = new THREE.Group();
  pad.position.set(-1.55, 1.3, 6.13);
  scene.add(pad);
  box(pad, 0.2, 0.3, 0.04, mat.dark, 0, 0, 0);
  const padLed = M(0x000000, { emissive: 0x21c26b });
  box(pad, 0.12, 0.04, 0.02, padLed, 0, 0.1, 0.025);
  box(pad, 0.08, 0.08, 0.02, M(0x6a7a88), 0, -0.06, 0.025);
  tagDevice(pad, "alarm");

  return ({ store, time }) => {
    const s = store.state.door;
    pivot.rotation.y = ease(s.t) * 1.5;
    lockMat.emissive.setHex(s.on ? 0x21c26b : 0xd13b3b);
    const armed = store.state.alarm.on;
    padLed.emissive.setHex(armed ? (Math.sin(time * 2) > 0 ? 0xff3b3b : 0x5a0f0f) : 0x21c26b);
  };
}

// ---------- Pintu garasi gulung ----------
function buildGarage(scene: THREE.Scene): Updater {
  const canvas = document.createElement("canvas");
  canvas.width = 16; canvas.height = 256;
  const c = canvas.getContext("2d")!;
  for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#c7ccd2" : "#b5bbc2"; c.fillRect(0, i * 16, 16, 16); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const door = box(scene, 4.7, 2.4, 0.08, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.3 }), 5.5, 1.3, 6.08);
  box(scene, 4.8, 0.3, 0.35, mat.metal, 5.5, 2.5, 6.2);
  tagDevice(door, "garage");
  return ({ store }) => {
    const gs = Math.max(0.04, 1 - ease(store.state.garage.t) * 0.96);
    door.scale.y = gs;
    door.position.y = 2.5 - (2.4 * gs) / 2;
  };
}

// ---------- Gerbang geser ----------
function buildGate(scene: THREE.Scene): Updater {
  const group = new THREE.Group();
  group.position.set(5.5, 0, 11.7);
  scene.add(group);
  box(group, 4.7, 0.08, 0.06, mat.metal, 0, 1.45, 0);
  box(group, 4.7, 0.08, 0.06, mat.metal, 0, 0.15, 0);
  for (let x = -2.3; x <= 2.31; x += 0.29) box(group, 0.05, 1.3, 0.05, mat.metal, x, 0.8, 0);
  for (const x of [-1.6, 1.6]) cyl(group, 0.08, 0.08, 0.06, mat.dark, x, 0.08, 0).rotation.x = Math.PI / 2;
  tagDevice(group, "gate");
  const beaconMat = M(0x5a3b0e, { emissive: 0x000000 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), beaconMat);
  beacon.position.set(8.0, 1.85, 12);
  scene.add(beacon);
  return ({ store, time }) => {
    group.position.x = 5.5 - ease(store.state.gate.t) * 4.6;
    beaconMat.emissive.setHex(store.isMoving("gate") && Math.sin(time * 12) > 0 ? 0xffa21a : 0x000000);
  };
}

// ---------- CCTV ----------
function buildCctv(scene: THREE.Scene): Updater {
  const yaw = new THREE.Group();
  yaw.position.set(8.15, 2.55, 6.15);
  scene.add(yaw);
  box(yaw, 0.08, 0.3, 0.08, mat.white, 0, 0.12, 0);
  const tilt = new THREE.Group();
  tilt.rotation.x = 0.45;
  yaw.add(tilt);
  box(tilt, 0.22, 0.2, 0.5, mat.white, 0, 0, 0.15);
  box(tilt, 0.16, 0.14, 0.02, mat.dark, 0, 0, 0.41);
  const ledMat = M(0x000000, { emissive: 0xff2a2a });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), ledMat);
  led.position.set(0.07, 0.07, 0.42);
  tilt.add(led);
  tagDevice(yaw, "cctv");
  const coneH = 7;
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, coneH, 28, 1, true), coneMat);
  cone.rotation.x = -Math.PI / 2;
  cone.position.z = coneH / 2 + 0.4;
  cone.userData.ignorePick = true;
  tilt.add(cone);
  return ({ store, time, reduceMotion }) => {
    const s = store.state.cctv;
    if (!reduceMotion) yaw.rotation.y = -0.55 + Math.sin(time * 0.5) * 0.55 * s.t;
    ledMat.emissive.setHex(s.on && Math.sin(time * 4) > 0 ? 0xff2a2a : 0x000000);
    coneMat.opacity = 0.11 * s.t;
    cone.visible = s.t > 0.01;
  };
}

// ---------- Pompa taman (penyiram) ----------
function buildSprinkler(scene: THREE.Scene): Updater {
  const group = new THREE.Group();
  group.position.set(-5.2, 0, 8.3);
  scene.add(group);
  cyl(group, 0.12, 0.16, 0.2, mat.dark, 0, 0.1, 0);
  const head = cyl(group, 0.05, 0.05, 0.18, M(0x2d6fb0), 0, 0.28, 0);
  tagDevice(group, "sprinkler");
  const N = 260;
  const pos = new Float32Array(N * 3);
  const vel = Array.from({ length: N }, () => new THREE.Vector3());
  const reset = (i: number) => {
    pos[i * 3] = -5.2; pos[i * 3 + 1] = 0.38; pos[i * 3 + 2] = 8.3;
    const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 1.3;
    vel[i].set(Math.cos(a) * sp, 3 + Math.random() * 1.2, Math.sin(a) * sp);
  };
  for (let i = 0; i < N; i++) { reset(i); pos[i * 3 + 1] = -1; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x6fc2ff, size: 0.08, transparent: true, opacity: 0, depthWrite: false });
  scene.add(new THREE.Points(geo, pMat));
  return ({ store, dt }) => {
    const s = store.state.sprinkler;
    pMat.opacity = s.t * 0.85;
    head.rotation.y += dt * 6 * s.t;
    if (s.t <= 0.01) return;
    for (let i = 0; i < N; i++) {
      vel[i].y -= 6.5 * dt;
      pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
      if (pos[i * 3 + 1] < 0.02) { if (s.on && Math.random() < 0.5) reset(i); else pos[i * 3 + 1] = -5; }
    }
    geo.attributes.position.needsUpdate = true;
  };
}

// ---------- Lampu taman ----------
function buildGardenLight(scene: THREE.Scene): Updater {
  const g = new THREE.Group();
  g.position.set(-3.8, 0, 11.2);
  scene.add(g);
  cyl(g, 0.06, 0.08, 2.2, mat.metal, 0, 1.1, 0);
  const bulbMat = glowBulb(g, 0.2, 0, 2.35, 0);
  const light = new THREE.PointLight(0xffd08a, 0, 12, 2);
  light.position.y = 2.3;
  g.add(light);
  tagDevice(g, "gardenLight");
  return ({ store, night }) => {
    const v = store.state.gardenLight.t;
    light.intensity = v * LAMP_CD * 1.4 * lampBoost(night);
    bulbMat.emissive.setRGB(v, 0.82 * v, 0.5 * v);
  };
}

// ---------- Lampu teras & carport ----------
function buildPorchLights(scene: THREE.Scene): Updater {
  const make = (id: DeviceId, x: number, z: number, lightPos: [number, number, number]) => {
    const g = new THREE.Group();
    g.position.set(x, 2.15, z);
    scene.add(g);
    box(g, 0.22, 0.3, 0.12, mat.metal, 0, 0, 0);
    const m = new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0x000000 });
    box(g, 0.16, 0.22, 0.04, m, 0, 0, 0.07);
    tagDevice(g, id);
    const l = new THREE.PointLight(0xffcf8a, 0, 9, 2);
    l.position.set(...lightPos);
    scene.add(l);
    return { m, l };
  };
  const teras = [make("lampTeras", -3.5, 6.16, [-2.4, 2.2, 7.2]), make("lampTeras", -1.3, 6.16, [-2.4, 2.2, 7.2])];
  teras[1].l.intensity = 0; teras[1].l.visible = false;
  const carport = make("lampCarport", 5.5, 6.42, [5.5, 2.2, 7.4]);
  carport.m.color.set(0xffffff);
  return ({ store, night }) => {
    const t = store.state.lampTeras.t * store.state.lampTeras.level;
    teras.forEach((p) => p.m.emissive.setRGB(t, 0.85 * t, 0.55 * t));
    teras[0].l.intensity = t * LAMP_CD * 1.3 * lampBoost(night);
    const c = store.state.lampCarport.t * store.state.lampCarport.level;
    carport.m.emissive.setRGB(c, 0.95 * c, 0.85 * c);
    carport.l.intensity = c * LAMP_CD * 1.3 * lampBoost(night);
  };
}

// ---------- Sirene ----------
function buildSiren(scene: THREE.Scene): Updater {
  const g = new THREE.Group();
  g.position.set(0.9, 2.45, 6.18);
  scene.add(g);
  box(g, 0.34, 0.24, 0.14, mat.white, 0, 0, 0);
  const lens = new THREE.MeshStandardMaterial({ color: 0xc23030, emissive: 0x000000, transparent: true, opacity: 0.9 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dome.position.set(0, 0.12, 0.02);
  g.add(dome);
  tagDevice(g, "sirene");
  const light = new THREE.PointLight(0xff2020, 0, 14, 2);
  light.position.set(0.9, 2.6, 6.9);
  scene.add(light);
  return ({ store, time }) => {
    const on = store.state.sirene.on;
    const flash = on && Math.sin(time * 14) > 0 ? 1 : 0;
    lens.emissive.setRGB(flash, 0.05 * flash, 0.05 * flash);
    light.intensity = flash * 30;
  };
}

// ---------- Lorong: lampu malam + sensor gerak ----------
function buildLorong(scene: THREE.Scene): Updater {
  const g = new THREE.Group();
  g.position.set(-3, 0.45, -7.47);
  scene.add(g);
  box(g, 0.3, 0.14, 0.06, mat.white, 0, 0, 0);
  const m = new THREE.MeshStandardMaterial({ color: 0xffe4b0, emissive: 0x000000 });
  box(g, 0.24, 0.06, 0.03, m, 0, -0.02, 0.04);
  tagDevice(g, "lampLorong");
  const light = new THREE.PointLight(0xffc070, 0, 7, 2);
  light.position.set(-3, 0.6, -6.9);
  scene.add(light);
  const pir = new THREE.Group();
  pir.position.set(2.85, 2.3, -6.8);
  scene.add(pir);
  const pirMat = M(0xf2f2f2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), pirMat);
  pir.add(dome);
  const pirLed = M(0x000000, { emissive: 0x000000 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), pirLed);
  led.position.set(-0.08, -0.02, 0);
  pir.add(led);
  return ({ store, env, night }) => {
    const s = store.state.lampLorong;
    const v = s.t * Math.max(0.35, s.level);
    m.emissive.setRGB(v, 0.75 * v, 0.4 * v);
    light.intensity = v * 5 * (0.6 + 0.6 * night);
    pirLed.emissive.setHex(env.motionLorong ? 0xff3030 : 0x000000);
  };
}

// ---------- Kamar mandi: water heater + sensor genangan ----------
function buildBathroom(scene: THREE.Scene): Updater {
  const g = new THREE.Group();
  g.position.set(0.6, 2.05, -9.62);
  scene.add(g);
  const tank = cyl(g, 0.28, 0.28, 1.0, mat.white, 0, 0, 0, 24);
  tank.rotation.z = Math.PI / 2;
  const ring = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.02, 8, 30), ring);
  band.rotation.y = Math.PI / 2;
  g.add(band);
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 64;
  const c2 = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: tex }));
  disp.position.set(0.25, -0.05, 0.285);
  g.add(disp);
  tagDevice(g, "waterHeater");
  let shown = -1;

  // genangan + sensor
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x4aa3d8, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.2 });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 32), puddleMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(0.9, 0.105, -8.7);
  puddle.scale.setScalar(0.001);
  puddle.userData.ignorePick = true;
  scene.add(puddle);
  cyl(scene, 0.09, 0.1, 0.05, mat.white, 0.2, 0.125, -8.3);
  const senseMat = M(0x000000, { emissive: 0x2a8fff });
  const sl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), senseMat);
  sl.position.set(0.2, 0.16, -8.3);
  scene.add(sl);
  let size = 0;

  return ({ store, env, dt, time }) => {
    const on = store.state.waterHeater.on;
    const glow = on ? 0.55 + 0.25 * Math.sin(time * 3) : 0;
    ring.emissive.setRGB(glow, 0.3 * glow, 0);
    const temp = Math.round(env.heaterTemp);
    if (temp !== shown) {
      shown = temp;
      c2.fillStyle = "#101418"; c2.fillRect(0, 0, 128, 64);
      c2.fillStyle = on ? "#ffb347" : "#6c7a86"; c2.font = "bold 40px monospace"; c2.textAlign = "center"; c2.textBaseline = "middle";
      c2.fillText(`${temp}°`, 64, 34);
      tex.needsUpdate = true;
    }
    const target = env.waterLeak ? (store.state.katupAir.on ? 1.1 : 0.75) : 0;
    size += (target - size) * Math.min(1, dt * (env.waterLeak ? 0.5 : 0.8));
    puddle.scale.setScalar(Math.max(0.001, size));
    puddle.visible = size > 0.01;
    senseMat.emissive.setHex(env.waterLeak && size > 0.2 ? (Math.sin(time * 8) > 0 ? 0xff3030 : 0x330000) : 0x2a8fff);
  };
}

// ---------- Dapur: detektor & kebocoran gas ----------
function buildKitchenGas(scene: THREE.Scene): Updater {
  const det = new THREE.Group();
  det.position.set(-6.6, 2.2, -9.86);
  scene.add(det);
  cyl(det, 0.12, 0.12, 0.05, mat.white, 0, 0, 0).rotation.x = Math.PI / 2;
  const ledMat = M(0x000000, { emissive: 0x21c26b });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), ledMat);
  led.position.set(0, 0, 0.03);
  det.add(led);

  const N = 220;
  const pos = new Float32Array(N * 3);
  const vel = Array.from({ length: N }, () => new THREE.Vector3());
  const reset = (i: number) => {
    pos[i * 3] = -6.9 + (Math.random() - 0.5) * 0.2; pos[i * 3 + 1] = 0.7; pos[i * 3 + 2] = -9.5;
    vel[i].set((Math.random() - 0.2) * 0.9, 0.25 + Math.random() * 0.4, Math.random() * 0.8);
  };
  for (let i = 0; i < N; i++) { reset(i); pos[i * 3 + 1] = -5; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xb5e04a, size: 0.7, map: softDot(), transparent: true, opacity: 0, depthWrite: false });
  const pts = new THREE.Points(geo, pMat);
  scene.add(pts);
  let amt = 0;
  return ({ env, dt, time }) => {
    amt += ((env.gasLeak ? 1 : 0) - amt) * Math.min(1, dt * 0.8);
    pMat.opacity = amt * 0.6;
    ledMat.emissive.setHex(env.gasLeak ? (Math.sin(time * 10) > 0 ? 0xff2a2a : 0x2a0000) : 0x21c26b);
    if (amt < 0.01) return;
    for (let i = 0; i < N; i++) {
      pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
      vel[i].multiplyScalar(0.995);
      const out = pos[i * 3 + 1] > 2.6 || pos[i * 3] > -2.3 || pos[i * 3 + 2] > -7.8;
      if (out || (pos[i * 3 + 1] < 0 && env.gasLeak) || Math.random() < 0.004) { if (env.gasLeak) reset(i); else pos[i * 3 + 1] = -5; }
    }
    geo.attributes.position.needsUpdate = true;
  };
}

// ---------- Tandon, pompa & katup air utama ----------
function buildTank(scene: THREE.Scene): Updater {
  const g = new THREE.Group();
  g.position.set(11.8, 0, -8.2);
  scene.add(g);
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) box(g, 0.12, 3.0, 0.12, mat.metal, x, 1.5, z);
  box(g, 2.2, 0.15, 2.2, mat.metal, 0, 3.05, 0);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 1.6, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe9eef2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  shell.position.y = 3.93;
  g.add(shell);
  cyl(g, 1.02, 1.02, 0.08, mat.white, 0, 4.76, 0, 32);
  const water = cyl(g, 0.95, 0.95, 1, M(0x3b8fd1, { transparent: true, opacity: 0.85 }), 0, 3.13, 0, 32);
  water.castShadow = false;
  tagDevice(g, "pompaAir");

  // Pompa di bawah tandon
  const pump = new THREE.Group();
  pump.position.set(10.2, 0, -8.2);
  scene.add(pump);
  box(pump, 0.6, 0.45, 0.45, M(0x2f7d4f), 0, 0.25, 0);
  const pumpLed = M(0x000000, { emissive: 0x000000 });
  box(pump, 0.08, 0.08, 0.02, pumpLed, 0.2, 0.38, 0.235);
  const fanMesh = cyl(pump, 0.14, 0.14, 0.04, mat.dark, -0.32, 0.25, 0);
  fanMesh.rotation.z = Math.PI / 2;
  cyl(scene, 0.05, 0.05, 3.4, mat.steel, 10.55, 1.9, -8.2);
  tagDevice(pump, "pompaAir");

  // Pipa ke rumah + katup utama (roda putar)
  const pipe = cyl(scene, 0.06, 0.06, 3.0, mat.steel, 9.5, 0.35, -8.2);
  pipe.rotation.z = Math.PI / 2;
  const valve = new THREE.Group();
  valve.position.set(9.2, 0.62, -8.2);
  scene.add(valve);
  cyl(valve, 0.04, 0.04, 0.3, mat.steel, 0, -0.15, 0);
  const wheelMat = M(0xc23a2b, { metalness: 0.4, roughness: 0.4 });
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20), wheelMat);
  wheel.rotation.x = Math.PI / 2;
  valve.add(wheel);
  const flagMat = M(0x000000, { emissive: 0x21c26b });
  box(valve, 0.1, 0.1, 0.03, flagMat, 0, 0.18, 0);
  tagDevice(valve, "katupAir");

  return ({ store, env, dt }) => {
    const lvl = Math.max(0.02, env.tank / 100);
    water.scale.y = lvl * 1.5;
    water.position.y = 3.13 + (lvl * 1.5) / 2;
    const p = store.state.pompaAir;
    pumpLed.emissive.setHex(p.on ? 0x21c26b : 0x000000);
    fanMesh.rotation.x += dt * 20 * p.t;
    wheel.rotation.z = (1 - store.state.katupAir.t) * Math.PI * 1.5;
    flagMat.emissive.setHex(store.state.katupAir.on ? 0x21c26b : 0xff2a2a);
  };
}

// ---------- Jemuran dengan atap otomatis + sensor hujan ----------
function buildJemuran(scene: THREE.Scene): Updater {
  const g = new THREE.Group();
  g.position.set(11.5, 0, -3);
  scene.add(g);
  for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) box(g, 0.08, 2.4, 0.08, mat.metal, x, 1.2, z);
  const lines: THREE.Group[] = [];
  const clothColors = [0xe4572e, 0x3e7cb1, 0xf3c623, 0xffffff, 0x6aa84f, 0xe86fa3];
  [-0.6, 0, 0.6].forEach((z, li) => {
    cyl(g, 0.01, 0.01, 2.6, M(0xdddddd), 0, 1.85, z).rotation.z = Math.PI / 2;
    const row = new THREE.Group();
    row.position.set(0, 1.85, z);
    g.add(row);
    for (let i = 0; i < 3; i++) {
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.02), M(clothColors[(li * 3 + i) % clothColors.length], { side: THREE.DoubleSide }));
      cloth.geometry.translate(0, -0.3, 0);
      cloth.position.x = -0.8 + i * 0.8;
      cloth.castShadow = true;
      row.add(cloth);
    }
    lines.push(row);
  });
  // atap: menutup dari kiri ke kanan
  const roofGeo = new THREE.BoxGeometry(2.9, 0.04, 2.3);
  roofGeo.translate(1.45, 0, 0);
  const roof = new THREE.Mesh(roofGeo, M(0x8fb3c9, { transparent: true, opacity: 0.85, metalness: 0.1 }));
  roof.position.set(-1.45, 2.42, 0);
  roof.castShadow = true;
  g.add(roof);
  box(g, 0.25, 0.25, 2.3, mat.metal, -1.4, 2.42, 0); // rumah gulungan atap
  tagDevice(g, "atapJemuran");
  const sensorMat = M(0x000000, { emissive: 0x2a8fff });
  box(g, 0.16, 0.06, 0.16, M(0x223344), 1.3, 2.43, 1);
  box(g, 0.06, 0.02, 0.06, sensorMat, 1.3, 2.47, 1);

  return ({ store, env, time, reduceMotion }) => {
    roof.scale.x = Math.max(0.03, ease(store.state.atapJemuran.t));
    sensorMat.emissive.setHex(env.raining ? 0xff9a1a : 0x2a8fff);
    if (!reduceMotion) lines.forEach((row, i) => row.children.forEach((c, j) => { c.rotation.x = Math.sin(time * 1.6 + i + j) * 0.12; }));
  };
}

// ---------- Bel video di pilar gerbang ----------
function buildDoorbell(scene: THREE.Scene): Updater {
  const g = new THREE.Group();
  g.position.set(3.0, 1.3, 12.22);
  scene.add(g);
  box(g, 0.14, 0.26, 0.04, mat.dark, 0, 0, 0);
  const ringMat = M(0x000000, { emissive: 0x2a8fff });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 16), ringMat);
  ring.position.set(0, -0.06, 0.025);
  g.add(ring);
  box(g, 0.05, 0.05, 0.01, mat.glass, 0, 0.07, 0.025);
  return ({ callActive, time }) => {
    ringMat.emissive.setHex(callActive ? (Math.sin(time * 6) > 0 ? 0x5fd0ff : 0x0a2a44) : 0x2a8fff);
  };
}

// ---------- Hujan ----------
function buildRain(scene: THREE.Scene): Updater {
  const N = 1400;
  const pos = new Float32Array(N * 6);
  const X0 = -18, X1 = 20, Z0 = -16, Z1 = 22, TOP = 16;
  for (let i = 0; i < N; i++) {
    const x = X0 + Math.random() * (X1 - X0), z = Z0 + Math.random() * (Z1 - Z0), y = Math.random() * TOP;
    pos.set([x, y, z, x + 0.04, y - 0.45, z], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lMat = new THREE.LineBasicMaterial({ color: 0xa9c6dd, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(geo, lMat);
  lines.frustumCulled = false;
  lines.userData.ignorePick = true;
  scene.add(lines);
  let amt = 0;
  return ({ env, dt }) => {
    amt += ((env.raining ? 1 : 0) - amt) * Math.min(1, dt * 0.9);
    lMat.opacity = amt * 0.55;
    lines.visible = amt > 0.01;
    if (!lines.visible) return;
    const fall = 16 * dt;
    for (let i = 0; i < N; i++) {
      const o = i * 6;
      pos[o + 1] -= fall; pos[o + 4] -= fall;
      if (pos[o + 4] < 0) { pos[o + 1] += TOP; pos[o + 4] += TOP; }
    }
    geo.attributes.position.needsUpdate = true;
  };
}
