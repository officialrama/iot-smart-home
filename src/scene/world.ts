import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ActorsApi, FxApi } from "../core/actors";
import type { SimClock } from "../core/clock";
import type { DeviceId, DeviceStore } from "../core/devices";
import type { Env } from "../core/home";
import { createActors } from "./actors";
import { buildDevices } from "./devices3d";
import { buildHouse } from "./house";

export interface World {
  actors: ActorsApi;
  fx: FxApi;
  onHover(cb: (id: DeviceId | null, x: number, y: number) => void): void;
  /** Dipanggil tiap frame sebelum scene digambar. */
  onFrame(cb: (dt: number) => void): void;
  /** Tampilkan kamera bel video di kanvas ini (dipakai HP virtual). */
  attachDoorCam(canvas: HTMLCanvasElement): void;
  focus(target: View): void;
}

export type View = "rumah" | "halaman" | "belakang" | "samping";

export interface WorldDeps {
  store: DeviceStore;
  clock: SimClock;
  env: () => Env;
  callActive: () => boolean;
}

export function createWorld(stage: HTMLElement, deps: WorldDeps): World {
  const { store, clock } = deps;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 250);
  camera.position.set(19, 21, 27);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(2, 0.5, 0.5);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.42;
  controls.minDistance = 7;
  controls.maxDistance = 60;
  controls.update();

  // Satuan fisik (three r155+)
  const HEMI_DAY = 2.8, SUN_DAY = 3.1;
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x5b6b4a, HEMI_DAY);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, SUN_DAY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  buildHouse(scene);
  const updateDevices = buildDevices(scene);
  const actors = createActors(scene, store);

  const skyDay = new THREE.Color(0xbcd7ea), skyDusk = new THREE.Color(0xe9a76b), skyNight = new THREE.Color(0x0b1222);
  const skyRain = new THREE.Color(0x7f8c99);
  const sky = new THREE.Color();
  scene.background = sky;
  let rainAmt = 0;

  // ---------- Gelembung teks ----------
  const bubbles: { el: HTMLElement; pos: THREE.Vector3; until: number }[] = [];
  const v3 = new THREE.Vector3();
  let realTime = 0;
  const fx: FxApi = {
    bubble(x, y, z, text, seconds = 2) {
      const el = document.createElement("div");
      el.className = "bubble";
      el.textContent = text;
      stage.appendChild(el);
      bubbles.push({ el, pos: new THREE.Vector3(x, y, z), until: realTime + seconds });
    }
  };

  // ---------- Klik & hover ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (ev: PointerEvent): DeviceId | null => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const hit of ray.intersectObjects(scene.children, true)) {
      const o = hit.object;
      if ((o as THREE.Points).isPoints || (o as THREE.LineSegments).isLineSegments || o.userData.ignorePick || !o.visible) continue;
      return (o.userData.device as DeviceId) ?? null;
    }
    return null;
  };
  let hoverCb: (id: DeviceId | null, x: number, y: number) => void = () => {};
  let downAt: [number, number] | null = null;
  const el = renderer.domElement;
  el.addEventListener("pointermove", (ev) => {
    if (ev.pointerType !== "mouse" || ev.buttons) return;
    const id = pick(ev);
    el.style.cursor = id ? "pointer" : "grab";
    const r = stage.getBoundingClientRect();
    hoverCb(id, ev.clientX - r.left, ev.clientY - r.top);
  });
  el.addEventListener("pointerleave", () => hoverCb(null, 0, 0));
  el.addEventListener("pointerdown", (ev) => { downAt = [ev.clientX, ev.clientY]; });
  el.addEventListener("pointerup", (ev) => {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]);
    downAt = null;
    if (moved > 6) return;
    const id = pick(ev);
    if (id) store.toggle(id, "app");
  });

  // ---------- Ukuran ----------
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- Kamera bel video ----------
  let doorRenderer: THREE.WebGLRenderer | null = null;
  const doorCam = new THREE.PerspectiveCamera(78, 16 / 10, 0.05, 60);
  doorCam.position.set(3.0, 1.45, 12.5);
  doorCam.lookAt(1.6, 1.15, 14.6);

  // ---------- Fokus kamera ----------
  const focusTargets = {
    rumah: { pos: new THREE.Vector3(19, 21, 27), target: new THREE.Vector3(2, 0.5, 0.5) },
    halaman: { pos: new THREE.Vector3(10, 9, 26), target: new THREE.Vector3(2, 0.5, 10) },
    belakang: { pos: new THREE.Vector3(3, 15, -21), target: new THREE.Vector3(-0.5, 0.5, -7.5) },
    samping: { pos: new THREE.Vector3(27, 12, 5), target: new THREE.Vector3(13.5, 1.5, -5.5) }
  } satisfies Record<View, unknown>;
  let flyTo: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

  // ---------- Loop ----------
  const frameCbs: ((dt: number) => void)[] = [];
  const timer = new THREE.Timer();
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const time = timer.getElapsed();
    realTime += dt;

    frameCbs.forEach((cb) => cb(dt));
    store.step(dt);
    actors.update(dt, 1 - clock.daylight());

    // Matahari mengikuti jam simulasi
    const env = deps.env();
    const day = clock.daylight();
    rainAmt += ((env.raining ? 1 : 0) - rainAmt) * Math.min(1, dt * 0.8);
    const h = clock.minuteOfDay / 60;
    const a = ((h - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(a) * 30, Math.max(4, Math.sin(a) * 30), 14);
    sun.intensity = SUN_DAY * day * (1 - 0.65 * rainAmt) + 0.25 * (1 - day);
    const dusk = Math.max(0, 1 - Math.abs(day - 0.45) / 0.45) * (h > 12 || h < 9 ? 1 : 0);
    sun.color.setRGB(1, 0.93 - 0.25 * dusk, 0.85 - 0.4 * dusk).lerp(new THREE.Color(0x9fb4ff), 1 - day);
    hemi.intensity = HEMI_DAY * (0.16 + 0.84 * day) * (1 - 0.25 * rainAmt);
    sky.copy(skyNight).lerp(skyDay, day).lerp(skyDusk, dusk * 0.55).lerp(skyRain, rainAmt * 0.55 * Math.max(0.3, day));

    updateDevices({ dt, time, night: 1 - day, reduceMotion, store, env, callActive: deps.callActive() });

    if (flyTo) {
      camera.position.lerp(flyTo.pos, Math.min(1, dt * 2.5));
      controls.target.lerp(flyTo.target, Math.min(1, dt * 2.5));
      if (camera.position.distanceTo(flyTo.pos) < 0.05) flyTo = null;
    }
    controls.update();
    renderer.render(scene, camera);

    // gelembung teks
    const w = stage.clientWidth, hgt = stage.clientHeight;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (realTime > b.until) { b.el.remove(); bubbles.splice(i, 1); continue; }
      v3.copy(b.pos).project(camera);
      b.el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * hgt}px) translate(-50%, -100%)`;
      b.el.hidden = v3.z > 1;
    }

    if (doorRenderer && deps.callActive()) doorRenderer.render(scene, doorCam);
  });

  return {
    actors,
    fx,
    onHover: (cb) => { hoverCb = cb; },
    onFrame: (cb) => { frameCbs.push(cb); },
    attachDoorCam(canvas) {
      doorRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      doorRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      doorRenderer.setSize(canvas.clientWidth || 260, canvas.clientHeight || 160, false);
    },
    focus(t) {
      flyTo = focusTargets[t];
    }
  };
}
