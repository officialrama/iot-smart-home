# Rumah Pintar 3D

Simulasi IoT smart home dalam 3D, dibuat dengan **Vite + TypeScript + Three.js**.
Isi simulasinya mengikuti materi presentasi:

- **Satu hari bersama sistem**: jam simulasi berjalan sendiri. Pukul 06.00 Bangun, 07.30 Mode Pergi,
  12.00 Ada tamu, 17.30 Pulang, dan 22.00 Mode Tidur berjalan otomatis. Klik salah satu jam di timeline untuk melompat ke sana.
- **Skenario pulang ke rumah**: HP masuk radius 500 m (atau tombol "Pulang") lalu gerbang terbuka,
  mobil masuk, gerbang menutup sendiri, lampu carport/teras/ruang tamu menyala, AC mendingin,
  alarm nonaktif, dan pintu dibuka dengan sidik jari.
- **18 aturan Saat/Maka** di tab Otomasi (gerbang & teras, di dalam rumah, keamanan). Setiap aturan
  bisa dimatikan dan punya tombol uji yang menjalankan kejadiannya di 3D, lengkap dengan notifikasi di HP virtual.
- **HP virtual**: notifikasi, tombol cepat gerbang/pintu/alarm, level tandon, dan video call dari bel gerbang
  (gambar diambil dari kamera bel di scene 3D).
- 21 perangkat bisa dinyalakan dari panel atau dengan mengklik objeknya di rumah. Semua perintah tercatat di Log MQTT.

## Menjalankan di komputer

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run dev       # mode pengembangan, buka http://localhost:5173
npm run build     # hasil build ada di folder dist/
npm run preview   # mencoba hasil build, buka http://localhost:4173
```

## Struktur kode

```
src/
  main.ts              titik masuk, merangkai semua modul
  core/clock.ts        jam simulasi (menit per detik bisa 1×, 5×, 20×)
  core/devices.ts      daftar 21 perangkat dan penyimpanan statusnya
  core/home.ts         otak rumah: jadwal harian, skenario pulang, 18 aturan Saat/Maka, sensor
  core/events.ts       notifikasi HP, log MQTT, penjadwal langkah
  core/actors.ts       kontrak mobil & orang yang bergerak
  scene/world.ts       renderer, kamera, matahari mengikuti jam, hujan, kamera bel video
  scene/house.ts       denah: ruang tamu, lorong, dapur, kamar mandi, kamar, garasi, teras, halaman
  scene/devices3d.ts   model 3D dan animasi tiap perangkat & sensor
  scene/actors.ts      mobil dan orang (penghuni, kurir, anak, penyusup)
  ui/panel.ts          tab Kendali, Otomasi, Log MQTT
  ui/stage.ts          timeline harian, alur pulang, cuaca, sudut kamera
  ui/phone.ts          HP virtual
  styles.css           tampilan bergaya slide (mode terang & gelap)
```

Menambah aturan baru: tambahkan entri di `defineRules()` dan logikanya di `update()` pada
`src/core/home.ts`. Menambah perangkat: entri di `DEVICES` (`src/core/devices.ts`) lalu fungsi
`buildXxx` di `src/scene/devices3d.ts`.

## Deploy ke cloud

Hasil build (`dist/`) adalah file statis, jadi bisa diunggah ke hosting statis mana pun.

| Layanan | Cara |
| --- | --- |
| **Vercel** | Import repo, framework terdeteksi otomatis sebagai Vite. |
| **Netlify** | Import repo (pakai `netlify.toml`), atau seret folder `dist/` ke app.netlify.com/drop. |
| **Firebase Hosting** | `npm run build`, lalu `firebase init hosting` (public dir: `dist`) dan `firebase deploy`. |
| **GitHub Pages / S3 / Cloudflare Pages** | Unggah isi folder `dist/`. Path relatif sudah diatur (`base: "./"`). |
| **Docker (Cloud Run, Railway, Render, VPS)** | `docker build -t rumah-pintar-3d .` lalu `docker run -p 8080:8080 rumah-pintar-3d`. |

Contoh Google Cloud Run:

```bash
gcloud run deploy rumah-pintar-3d --source . --region asia-southeast2 --allow-unauthenticated
```
