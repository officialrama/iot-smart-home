import * as THREE from "three";
import type { DeviceId } from "../core/devices";

export const M = (color: THREE.ColorRepresentation, opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });

export const mat = {
  grass: M(0x7fa65a),
  wall: M(0xf1ede6),
  wood: M(0xb98a5e),
  carpet: M(0xb7c3cf),
  concrete: M(0xa9adb1),
  stone: M(0xc9c1b3),
  metal: M(0x2d3339, { metalness: 0.6, roughness: 0.4 }),
  white: M(0xf7f7f5),
  dark: M(0x22262b),
  sofa: M(0x4f6d8a),
  red: M(0xb3322d, { metalness: 0.3, roughness: 0.45 }),
  glass: M(0x9fc4dd, { metalness: 0.2, roughness: 0.1 }),
  trunk: M(0x6b4a2f),
  leaf: M(0x4f7d3a),
  bed: M(0xe9e3d6),
  pillow: M(0xffffff),
  tile: M(0xd9d4cb),
  bathTile: M(0xbcd3dc),
  asphalt: M(0x3a3f45),
  sidewalk: M(0xb8b2a7),
  counter: M(0xe8e4dc),
  steel: M(0xb9c0c7, { metalness: 0.5, roughness: 0.35 })
};

export function box(
  parent: THREE.Object3D, w: number, h: number, d: number,
  m: THREE.Material, x: number, y: number, z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cyl(
  parent: THREE.Object3D, rt: number, rb: number, h: number,
  m: THREE.Material, x: number, y: number, z: number, seg = 20
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Tandai semua mesh di bawah obj agar klik di 3D mengarah ke perangkat ini. */
export function tagDevice(obj: THREE.Object3D, id: DeviceId): void {
  obj.traverse((o) => { o.userData.device = id; });
}

export const ease = (x: number) => x * x * (3 - 2 * x);
