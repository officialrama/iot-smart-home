import * as THREE from "three";
import { M, box, cyl, mat } from "./helpers";

const H = 2.8; // tinggi dinding
const T = 0.2; // tebal dinding

/*
 * Denah (sumbu x ke kanan, z ke depan/jalan):
 *   z -10..-7.6  Dapur (x -8..-2) · Kamar mandi (x -2..3)
 *   z -7.6..-6   Lorong (x -8..3)
 *   z -6..6      Ruang tamu (x -8..3)
 *   x 3..8       Kamar tidur (z -10..-1) · Garasi/carport (z -1..6)
 *   z 6..7.4     Teras · z 7.4..12 Halaman · z 12 pagar + gerbang · z 13..18 jalan
 *   x 9..14      Halaman samping: jemuran, tandon, pompa
 */
export function buildHouse(scene: THREE.Scene): void {
  const wallX = (x1: number, x2: number, z: number, h = H, y0 = 0) =>
    box(scene, x2 - x1, h, T, mat.wall, (x1 + x2) / 2, y0 + h / 2, z);
  const wallZ = (z1: number, z2: number, x: number, h = H, y0 = 0) =>
    box(scene, T, h, z2 - z1, mat.wall, x, y0 + h / 2, (z1 + z2) / 2);
  const lintelX = (x1: number, x2: number, z: number) => wallX(x1, x2, z, 0.6, 2.2);
  const lintelZ = (z1: number, z2: number, x: number) => wallZ(z1, z2, x, 0.6, 2.2);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Jalan & trotoar ----------
  box(scene, 120, 0.02, 4.4, mat.asphalt, 0, 0.01, 15.6);
  box(scene, 120, 0.06, 1.0, mat.sidewalk, 0, 0.03, 12.95);
  const dash = M(0xe9e2c8);
  for (let x = -56; x <= 56; x += 4) box(scene, 1.8, 0.025, 0.14, dash, x, 0.02, 15.6);

  // ---------- Lantai ----------
  box(scene, 11, 0.1, 12, mat.wood, -2.5, 0.05, 0);          // ruang tamu
  box(scene, 11, 0.1, 1.6, mat.tile, -2.5, 0.05, -6.8);      // lorong
  box(scene, 6, 0.1, 2.4, mat.tile, -5, 0.05, -8.8);         // dapur
  box(scene, 5, 0.1, 2.4, mat.bathTile, 0.5, 0.05, -8.8);    // kamar mandi
  box(scene, 5, 0.1, 9, mat.carpet, 5.5, 0.05, -5.5);        // kamar
  box(scene, 5, 0.1, 7, mat.concrete, 5.5, 0.05, 2.5);       // garasi
  box(scene, 11.2, 0.12, 1.4, mat.stone, -2.5, 0.06, 6.7);   // teras
  box(scene, 4.6, 0.04, 6, mat.concrete, 5.5, 0.02, 9);      // jalan mobil
  box(scene, 1.2, 0.04, 4.6, mat.stone, -2.4, 0.02, 9.7);    // jalan setapak

  // ---------- Dinding ----------
  wallX(-8, 8, -10); wallZ(-10, 6, -8); wallZ(-10, 6, 8);
  // depan
  wallX(-8, -3, 6); wallX(-1.8, 3, 6); lintelX(-3, -1.8, 6);
  wallX(3, 8, 6, 0.3, 2.5);
  // ruang tamu | lorong (bukaan x 0.6..2.2)
  wallX(-8, 0.6, -6); wallX(2.2, 3, -6); lintelX(0.6, 2.2, -6);
  // lorong | dapur & kamar mandi (pintu dapur x -5.2..-4.2, kamar mandi x -0.6..0.4)
  wallX(-8, -5.2, -7.6); wallX(-4.2, -0.6, -7.6); wallX(0.4, 3, -7.6);
  lintelX(-5.2, -4.2, -7.6); lintelX(-0.6, 0.4, -7.6);
  wallZ(-10, -7.6, -2);
  // x=3: pintu kamar di ujung lorong (z -7.4..-6.2)
  wallZ(-10, -7.4, 3); wallZ(-6.2, 6, 3); lintelZ(-7.4, -6.2, 3);
  // kamar | garasi
  wallX(3, 8, -1);

  // ---------- Jendela (kaca di atas dinding) ----------
  box(scene, 1.6, 1.0, 0.22, mat.glass, -5, 1.7, -10);     // dapur
  box(scene, 0.22, 1.1, 2, mat.glass, 8, 1.6, -5);         // kamar
  box(scene, 1.0, 0.6, 0.22, mat.glass, 1.2, 2.0, -10);    // kamar mandi

  // ---------- Pagar depan ----------
  const fenceSeg = (x1: number, x2: number) => box(scene, x2 - x1, 0.7, 0.25, mat.stone, (x1 + x2) / 2, 0.35, 12);
  fenceSeg(-9, -3); fenceSeg(-1.8, 3.1); fenceSeg(7.9, 14);
  box(scene, 0.25, 0.7, 22, mat.stone, -9, 0.35, 1);
  box(scene, 0.25, 0.7, 22, mat.stone, 14, 0.35, 1);
  box(scene, 23, 0.7, 0.25, mat.stone, 2.5, 0.35, -10.9);
  for (const x of [3.0, 8.0, -3.1, -1.7]) box(scene, 0.4, 1.7, 0.4, mat.stone, x, 0.85, 12);
  box(scene, 0.4, 0.5, 0.3, mat.dark, 2.4, 0.25, 11.3); // motor gerbang

  // ---------- Ruang tamu ----------
  box(scene, 3, 0.45, 1, mat.sofa, -1, 0.33, -1.4);
  box(scene, 3, 0.6, 0.25, mat.sofa, -1, 0.8, -0.95);
  box(scene, 0.25, 0.6, 1, mat.sofa, -2.5, 0.5, -1.4);
  box(scene, 0.25, 0.6, 1, mat.sofa, 0.5, 0.5, -1.4);
  box(scene, 1.4, 0.08, 0.7, mat.wood, -1, 0.45, -3.2);
  for (const [x, z] of [[-1.6, -3.45], [-0.4, -3.45], [-1.6, -2.95], [-0.4, -2.95]]) box(scene, 0.06, 0.4, 0.06, mat.metal, x, 0.25, z);
  box(scene, 2.6, 0.45, 0.45, mat.wood, -1, 0.32, -5.6);
  // karpet & meja makan kecil
  box(scene, 4, 0.02, 3, M(0xc9a27a), -1, 0.11, -2.6);
  box(scene, 1.4, 0.06, 1.0, mat.wood, -5.5, 0.78, 2.6);
  for (const [x, z] of [[-6.1, 2.2], [-4.9, 2.2], [-6.1, 3.0], [-4.9, 3.0]]) box(scene, 0.06, 0.72, 0.06, mat.wood, x, 0.43, z);

  // ---------- Dapur ----------
  box(scene, 4.4, 0.9, 0.6, mat.counter, -5.7, 0.5, -9.6);
  box(scene, 0.7, 0.04, 0.5, mat.dark, -5.5, 0.97, -9.6); // kompor
  for (const x of [-5.7, -5.3]) cyl(scene, 0.1, 0.1, 0.02, mat.metal, x, 1.0, -9.6);
  box(scene, 0.8, 1.9, 0.7, mat.steel, -2.6, 1.0, -9.55);  // kulkas
  cyl(scene, 0.18, 0.18, 0.55, M(0x3d8b4f), -6.9, 0.37, -9.55); // tabung gas

  // ---------- Kamar mandi ----------
  box(scene, 0.45, 0.4, 0.6, mat.white, -1.4, 0.3, -9.55); // kloset
  box(scene, 0.45, 0.5, 0.2, mat.white, -1.4, 0.65, -9.85);
  box(scene, 1.4, 0.05, 1.3, M(0x9fbac6), 2.2, 0.12, -9.2); // area shower
  cyl(scene, 0.02, 0.02, 1.0, mat.steel, 2.85, 1.6, -9.85);
  cyl(scene, 0.12, 0.12, 0.04, mat.steel, 2.7, 2.1, -9.8);

  // ---------- Kamar ----------
  box(scene, 2.2, 0.45, 3.2, mat.wood, 5.6, 0.3, -8.3);
  box(scene, 2.1, 0.22, 3.0, mat.bed, 5.6, 0.62, -8.2);
  box(scene, 1.6, 0.14, 0.5, mat.pillow, 5.6, 0.8, -9.4);
  box(scene, 2.2, 0.9, 0.12, mat.wood, 5.6, 0.55, -9.88);
  box(scene, 0.6, 0.55, 0.5, mat.wood, 3.7, 0.33, -9.5);
  box(scene, 1.6, 2.0, 0.6, mat.wood, 6.9, 1.05, -1.5); // lemari

  // ---------- Taman ----------
  const tree = (x: number, z: number, s: number) => {
    cyl(scene, 0.15 * s, 0.2 * s, 1.4 * s, mat.trunk, x, 0.7 * s, z);
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), mat.leaf);
    f.position.set(x, 2.0 * s, z);
    f.castShadow = true;
    scene.add(f);
  };
  tree(-7.4, 9.0, 1.1); tree(-12, -4, 1.3); tree(12.8, 9, 0.9); tree(-12, 8, 1.0);
  box(scene, 3.2, 0.25, 1.4, mat.trunk, -5.5, 0.12, 10.4);
  const flowerMats = [M(0xe4572e), M(0xf3c623), M(0xe86fa3)];
  for (let i = 0; i < 14; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), flowerMats[i % 3]);
    fl.position.set(-6.9 + (i % 7) * 0.45, 0.35, 10.1 + Math.floor(i / 7) * 0.55);
    scene.add(fl);
  }
}
