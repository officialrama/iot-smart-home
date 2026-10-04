import * as THREE from "three";
import type { ActorsApi, CarApi, CarState, PersonApi, PersonId, Vec2 } from "../core/actors";
import type { DeviceStore } from "../core/devices";
import { M, box, cyl, mat } from "./helpers";

const ROAD_Z = 15.6;
const CAR_X = 5.5;
const PARK_Z = 2.6;
const HOLD_GATE = 14.0;   // berhenti di depan gerbang bila belum terbuka
const HOLD_GARAGE = 8.3;  // berhenti di depan garasi bila belum terbuka

/** Mobil: datang dari jalan, masuk lewat gerbang ke garasi, atau sebaliknya. */
class Car implements CarApi {
  state: CarState = "parked";
  readonly group = new THREE.Group();
  private heading = 0; // 0 = moncong menghadap -z (masuk garasi), -PI/2 = menghadap +x
  private wheels: THREE.Mesh[] = [];
  private brake: THREE.MeshStandardMaterial;
  private head: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, private store: DeviceStore) {
    scene.add(this.group);
    const body = new THREE.Group();
    body.position.y = 0.1;
    this.group.add(body);
    box(body, 1.9, 0.55, 3.8, mat.red, 0, 0.55, 0);
    box(body, 1.7, 0.5, 2, mat.red, 0, 1.05, 0.2);
    box(body, 1.72, 0.38, 0.05, mat.glass, 0, 1.05, -0.82);
    box(body, 1.72, 0.34, 0.05, mat.glass, 0, 1.05, 1.22);
    this.head = new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0x000000 });
    this.brake = new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0x000000 });
    for (const x of [-0.65, 0.65]) {
      box(body, 0.35, 0.14, 0.04, this.head, x, 0.62, -1.91);
      box(body, 0.35, 0.12, 0.04, this.brake, x, 0.65, 1.91);
    }
    for (const [x, z] of [[-0.95, 1.2], [0.95, 1.2], [-0.95, -1.2], [0.95, -1.2]]) {
      const w = cyl(body, 0.34, 0.34, 0.25, mat.dark, x, 0.24, z);
      w.rotation.z = Math.PI / 2;
      this.wheels.push(w);
    }
    this.group.position.set(CAR_X, 0, PARK_Z);
  }

  get z() { return this.group.position.z; }

  arrive() {
    if (this.state === "arriving") return;
    if (this.state === "parked") this.teleportAway();
    this.state = "arriving";
    this.group.visible = true;
  }

  leave() {
    if (this.state !== "parked") return;
    this.state = "leaving";
  }

  teleportAway() {
    this.state = "away";
    this.group.position.set(-40, 0, ROAD_Z);
    this.heading = -Math.PI / 2;
    this.group.visible = false;
  }

  update(dt: number, night: number) {
    const p = this.group.position;
    let moving = 0; // kecepatan bertanda untuk putaran roda
    const speed = 4.2;

    if (this.state === "arriving") {
      if (p.z > ROAD_Z - 0.01 && p.x < CAR_X - 0.01) {
        // melaju di jalan menuju depan rumah
        p.x = Math.min(CAR_X, p.x + speed * dt);
        this.turnTo(-Math.PI / 2, dt);
        moving = speed;
        if (p.x >= CAR_X - 0.01) p.x = CAR_X;
      } else {
        this.turnTo(0, dt * 1.5);
        let limit = PARK_Z;
        // Tahan hanya jika mobil belum melewati titik tunggu tersebut.
        if (p.z >= HOLD_GATE - 0.01 && this.store.state.gate.t < 0.97) limit = Math.max(limit, HOLD_GATE);
        if (p.z >= HOLD_GARAGE - 0.01 && this.store.state.garage.t < 0.97) limit = Math.max(limit, HOLD_GARAGE);
        const v = p.z > 6 ? speed * 0.7 : speed * 0.4;
        const nz = Math.max(limit, p.z - v * dt);
        moving = (p.z - nz) / Math.max(dt, 1e-4);
        p.z = nz;
        if (p.z <= PARK_Z + 0.001) this.state = "parked";
      }
    } else if (this.state === "leaving") {
      if (p.z < ROAD_Z - 0.01) {
        // mundur keluar garasi
        let limit = ROAD_Z;
        if (p.z < 6.5 && this.store.state.garage.t < 0.97) limit = Math.min(limit, p.z);
        if (p.z < HOLD_GATE - 3.2 && this.store.state.gate.t < 0.97) limit = Math.min(limit, HOLD_GATE - 3.2);
        const nz = Math.min(limit, p.z + speed * 0.45 * dt);
        moving = -(nz - p.z) / Math.max(dt, 1e-4);
        p.z = nz;
      } else {
        this.turnTo(-Math.PI / 2, dt * 1.2); // belok, lalu melaju ke arah +x
        p.x += speed * dt;
        moving = speed;
        if (p.x > 40) this.teleportAway();
      }
    }
    this.group.rotation.y = this.heading;
    this.wheels.forEach((w) => (w.rotation.x += (moving * dt) / 0.34));
    const lit = this.state === "arriving" || this.state === "leaving";
    this.head.emissive.setScalar(lit ? 0.6 + 0.6 * night : 0);
    this.brake.emissive.setRGB(lit && Math.abs(moving) < 0.2 ? 1 : lit ? 0.35 : 0, 0, 0);
  }

  private turnTo(target: number, dt: number) {
    let d = target - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * 3);
  }
}

/** Orang sederhana: badan, kepala, kaki yang mengayun saat berjalan. */
class Person implements PersonApi {
  readonly group = new THREE.Group();
  walking = false;
  private legs: THREE.Group[] = [];
  private path: Vec2[] = [];
  private speed = 1.6;
  private done: (() => void) | null = null;
  private phase = 0;
  private sitting = false;

  constructor(scene: THREE.Scene, shirt: number, scale: number, extra?: (g: THREE.Group) => void) {
    scene.add(this.group);
    const inner = new THREE.Group();
    inner.scale.setScalar(scale);
    this.group.add(inner);
    const pants = M(0x2e3a4a);
    for (const x of [-0.12, 0.12]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.85, 0);
      box(leg, 0.15, 0.8, 0.18, pants, 0, -0.4, 0);
      inner.add(leg);
      this.legs.push(leg);
    }
    const shirtMat = M(shirt);
    cyl(inner, 0.22, 0.26, 0.75, shirtMat, 0, 1.22, 0, 14);
    const skin = M(0xd9a679);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
    head.position.y = 1.78;
    head.castShadow = true;
    inner.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2a1d14));
    hair.position.y = 1.8;
    inner.add(hair);
    extra?.(inner);
    this.group.visible = false;
  }

  get visible() { return this.group.visible; }
  get pos(): Vec2 { return { x: this.group.position.x, z: this.group.position.z }; }

  place(p: Vec2, opts: { sit?: boolean; face?: number } = {}) {
    this.group.visible = true;
    this.group.position.set(p.x, 0.1, p.z);
    this.walking = false;
    this.path = [];
    if (opts.face !== undefined) this.group.rotation.y = opts.face;
    if (opts.sit) this.sit(opts.face ?? this.group.rotation.y); else this.stand();
  }

  walk(path: Vec2[], speed = 1.6): Promise<void> {
    if (!this.group.visible) this.place(path[0]);
    this.stand();
    this.done?.();
    this.path = [...path];
    this.speed = speed;
    this.walking = true;
    return new Promise((resolve) => (this.done = resolve));
  }

  sit(face: number) {
    this.sitting = true;
    this.group.rotation.y = face;
    this.group.position.y = 0.1;
    this.legs.forEach((l) => (l.rotation.x = -Math.PI / 2.2));
    (this.group.children[0] as THREE.Group).position.y = -0.38;
  }

  private stand() {
    if (!this.sitting) return;
    this.sitting = false;
    this.legs.forEach((l) => (l.rotation.x = 0));
    (this.group.children[0] as THREE.Group).position.y = 0;
  }

  hide() {
    this.group.visible = false;
    this.walking = false;
    this.path = [];
    const d = this.done;
    this.done = null;
    d?.();
  }

  update(dt: number) {
    if (!this.walking) {
      if (!this.sitting) this.legs.forEach((l) => (l.rotation.x *= 0.8));
      return;
    }
    const target = this.path[0];
    const p = this.group.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (dist <= step) {
      p.x = target.x; p.z = target.z;
      this.path.shift();
      if (!this.path.length) {
        this.walking = false;
        const d = this.done;
        this.done = null;
        d?.();
        return;
      }
    } else {
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      const want = Math.atan2(dx, dz);
      let d = want - this.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.group.rotation.y += d * Math.min(1, dt * 10);
    }
    this.phase += dt * this.speed * 5;
    this.legs[0].rotation.x = Math.sin(this.phase) * 0.5;
    this.legs[1].rotation.x = -Math.sin(this.phase) * 0.5;
  }
}

export function createActors(scene: THREE.Scene, store: DeviceStore): ActorsApi & { update(dt: number, night: number): void } {
  const car = new Car(scene, store);
  const people: Record<PersonId, Person> = {
    penghuni: new Person(scene, 0xe08a3c, 1),
    tamu: new Person(scene, 0x2f8f5b, 1, (g) => box(g, 0.45, 0.35, 0.35, M(0xb88a55), 0, 1.15, 0.33)),
    anak: new Person(scene, 0xf3c623, 0.72, (g) => box(g, 0.36, 0.42, 0.18, M(0x3e7cb1), 0, 1.25, -0.3)),
    penyusup: new Person(scene, 0x1b1d22, 1)
  };
  return {
    car,
    person: (id) => people[id],
    update(dt, night) {
      car.update(dt, night);
      Object.values(people).forEach((p) => p.update(dt));
    }
  };
}
