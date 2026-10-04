import type { ActorsApi, FxApi, Vec2 } from "./actors";
import { SimClock, fmt, hm } from "./clock";
import { DEVICE_BY_ID, type DeviceId, type DeviceStore, type Source } from "./devices";
import { Bus, Tasks } from "./events";

export type Mode = "normal" | "pergi" | "tidur" | "liburan";

/** Pembacaan sensor dan status lingkungan rumah. */
export interface Env {
  mode: Mode;
  raining: boolean;
  gasLeak: boolean;
  waterLeak: boolean;
  windowOpen: boolean;
  /** Isi tandon (%) */
  tank: number;
  /** Jarak HP pemilik ke rumah (km) */
  phoneKm: number;
  tempLiving: number;
  heaterTemp: number;
  power: number;
  powerLimit: number;
  /** Ada gerakan di lorong (sensor PIR). */
  motionLorong: boolean;
  occupiedLiving: boolean;
}

export type RuleGroup = "gerbang" | "rumah" | "keamanan";
export type RuleIcon =
  | "key" | "chat" | "lock" | "warn" | "bulb" | "clock" | "cloud" | "gear" | "play" | "home"
  | "chart" | "wrench" | "people" | "bolt";

export interface RuleDef {
  id: string;
  group: RuleGroup;
  icon: RuleIcon;
  title: string;
  saat: string;
  maka: string;
  tests: { label: string; run: () => void }[];
}

export interface DailyItem { at: number; title: string; desc: string; run: () => void }

export const GROUP_INFO: Record<RuleGroup, { eyebrow: string; title: string }> = {
  gerbang: { eyebrow: "Contoh penerapan · Gerbang & teras", title: "Dari gerbang sampai taman" },
  rumah: { eyebrow: "Contoh penerapan · Di dalam rumah", title: "Tugas rumah yang berjalan sendiri" },
  keamanan: { eyebrow: "Contoh penerapan · Keamanan", title: "Rumah yang memberi tahu Anda" }
};

export const PULANG_STEPS = [
  { title: "HP masuk radius 500 m", desc: "atau tombol \"Pulang\" ditekan di aplikasi" },
  { title: "Gerbang terbuka", desc: "Menutup lagi setelah mobil masuk." },
  { title: "Lampu menyala", desc: "Carport, teras, dan ruang tamu." },
  { title: "AC mendingin", desc: "Ruang keluarga sudah sejuk saat Anda masuk." },
  { title: "Alarm nonaktif", desc: "Pintu dibuka dengan PIN atau sidik jari." }
];

// Titik-titik penting di denah (lihat scene/house.ts)
const P = {
  sofa: { x: -1, z: -1.55 },
  depanSofa: { x: -1, z: -2.6 },
  bukaanLorong: { x: 1.4, z: -5.6 },
  lorongTimur: { x: 1.4, z: -6.8 },
  pintuKamar: { x: 3.7, z: -6.8 },
  kamar: { x: 5.2, z: -5.2 },
  pintuKamarMandi: { x: -0.1, z: -6.8 },
  kamarMandi: { x: -0.1, z: -8.6 },
  terasDepanPintu: { x: -2.4, z: 7.0 },
  dalamPintu: { x: -2.4, z: 4.2 },
  ruangTamu: { x: -4, z: 1.5 },
  celahPagar: { x: -2.4, z: 13.1 },
  trotoarBarat: { x: -16, z: 13.1 },
  trotoarTimur: { x: 18, z: 13.1 },
  depanBel: { x: 2.3, z: 13.0 },
  dalamGerbang: { x: 5.0, z: 10.5 },
  halamanTeras: { x: -1.2, z: 7.6 },
  sampingMobil: { x: 4.0, z: 2.8 },
  depanGarasi: { x: 4.0, z: 7.2 }
} satisfies Record<string, Vec2>;

export class Home {
  readonly env: Env = {
    mode: "tidur", raining: false, gasLeak: false, waterLeak: false, windowOpen: false,
    tank: 72, phoneKm: 0, tempLiving: 27, heaterTemp: 28, power: 0, powerLimit: 2500,
    motionLorong: false, occupiedLiving: false
  };
  readonly enabled: Record<string, boolean> = {};
  readonly lastFired: Record<string, string> = {};
  readonly rules: RuleDef[];
  readonly daily: DailyItem[];

  /** -1 = tidak berjalan; 0 = pemicu; 1..4 = langkah; 5 = selesai */
  pulangStep = -1;
  /** Panggilan video dari bel gerbang yang sedang masuk ke HP. */
  call: { from: string } | null = null;
  /** Rule yang baru saja berjalan (untuk sorotan di UI). */
  onFire: (id: string) => void = () => {};

  private running = new Set<string>();
  private gateOpenSince: number | null = null;
  private gateForgotNotified = false;
  private gateCmdFromHp = false;
  private emptySince: number | null = null;
  private lastMotion = -1e9;
  private heaterOffAt: number | null = null;
  private heaterReadyNotified = false;
  private sprinklerOffAt: number | null = null;
  private overPower = false;
  private nextVacationSwap = 0;

  constructor(
    readonly store: DeviceStore,
    readonly clock: SimClock,
    readonly bus: Bus,
    readonly tasks: Tasks,
    readonly actors: ActorsApi,
    readonly fx: FxApi
  ) {
    this.rules = this.defineRules();
    this.rules.forEach((r) => (this.enabled[r.id] = true));
    this.daily = [
      { at: hm(6), title: "Bangun", desc: "Tirai terbuka perlahan, lampu menyala hangat.", run: () => this.bangun() },
      { at: hm(7, 30), title: "Mode Pergi", desc: "Satu sentuhan: lampu dan AC mati, pintu terkunci.", run: () => this.pergi(true) },
      { at: hm(12), title: "Ada tamu", desc: "Notifikasi dan video dari bel pintu langsung ke ponsel.", run: () => this.tamu() },
      { at: hm(17, 30), title: "Pulang", desc: "AC sudah sejuk dan lampu teras menyala saat Anda tiba.", run: () => this.perjalananPulang() },
      { at: hm(22), title: "Mode Tidur", desc: "Lampu meredup, alarm aktif, semua perangkat beristirahat.", run: () => this.tidur() }
    ];

    store.subscribe((id, on, source) => this.onDevice(id, on, source));
  }

  // =====================================================================
  // Aturan Saat / Maka (sesuai slide)
  // =====================================================================
  private defineRules(): RuleDef[] {
    const s = this.store;
    return [
      // ---------- Gerbang & teras ----------
      {
        id: "gerbangHp", group: "gerbang", icon: "key", title: "Gerbang dari HP",
        saat: "Anda menekan tombol di aplikasi, dari mana saja.",
        maka: "gerbang membuka atau menutup, statusnya tampil di HP.",
        tests: [{ label: "Tekan di HP", run: () => this.gateFromPhone() }]
      },
      {
        id: "tamuGerbang", group: "gerbang", icon: "chat", title: "Tamu di gerbang",
        saat: "tamu atau kurir menekan bel video.",
        maka: "video call masuk ke HP, gerbang bisa dibuka dari jauh.",
        tests: [{ label: "Datangkan kurir", run: () => this.tamu() }]
      },
      {
        id: "tutupSendiri", group: "gerbang", icon: "lock", title: "Menutup sendiri",
        saat: "mobil sudah masuk dan terdeteksi sensor.",
        maka: "gerbang menutup otomatis dengan aman.",
        tests: [{ label: "Mobil pulang", run: () => this.pulang("tombol") }]
      },
      {
        id: "lupaMenutup", group: "gerbang", icon: "warn", title: "Lupa menutup",
        saat: "gerbang terbuka lebih dari 10 menit.",
        maka: "notifikasi ke HP, tutup dengan satu sentuhan.",
        tests: [{ label: "Biarkan terbuka", run: () => { s.set("gate", true, "app"); this.gateOpenSince = this.clock.total - 9.5; } }]
      },
      {
        id: "lampuTeras", group: "gerbang", icon: "bulb", title: "Lampu teras",
        saat: "matahari terbenam.",
        maka: "lampu teras dan taman menyala, mati pukul 23.00.",
        tests: [{ label: "Lompat ke 17.58", run: () => this.clock.jumpTo(hm(17, 58)) }]
      },
      {
        id: "siramTaman", group: "gerbang", icon: "clock", title: "Siram taman",
        saat: "jadwal pagi dan sore, kecuali hari hujan.",
        maka: "pompa taman menyala selama 10 menit.",
        tests: [{ label: "Jalankan jadwal", run: () => this.siramTaman() }]
      },
      // ---------- Di dalam rumah ----------
      {
        id: "lampuMalam", group: "rumah", icon: "bulb", title: "Lampu malam",
        saat: "ada gerakan di lorong, pukul 22.00–05.00.",
        maka: "lampu menyala redup, mati sendiri 3 menit kemudian.",
        tests: [{ label: "Jalan lewat lorong", run: () => this.jalanLorong() }]
      },
      {
        id: "acHemat", group: "rumah", icon: "cloud", title: "AC hemat",
        saat: "ruangan kosong 15 menit atau jendela dibuka.",
        maka: "AC mati otomatis dan Anda dapat notifikasi.",
        tests: [
          { label: "Buka jendela", run: () => this.bukaJendela() },
          { label: "Tinggalkan ruangan", run: () => this.tinggalkanRuangTamu() }
        ]
      },
      {
        id: "airHangat", group: "rumah", icon: "clock", title: "Air hangat siap",
        saat: "setiap hari pukul 05.30.",
        maka: "water heater menyala, mati sendiri setelah 1 jam.",
        tests: [{ label: "Nyalakan sekarang", run: () => this.airHangat() }]
      },
      {
        id: "pompaPintar", group: "rumah", icon: "gear", title: "Pompa air pintar",
        saat: "tandon air penuh atau hampir kosong.",
        maka: "pompa mati atau menyala sendiri, level tampil di HP.",
        tests: [{ label: "Pakai banyak air", run: () => { this.env.tank = 17; } }]
      },
      {
        id: "modeNonton", group: "rumah", icon: "play", title: "Mode nonton",
        saat: "Anda bilang \"Hey Google, mode nonton\".",
        maka: "lampu meredup, tirai menutup, TV menyala.",
        tests: [{ label: "Ucapkan perintah", run: () => this.nonton() }]
      },
      {
        id: "jemuran", group: "rumah", icon: "home", title: "Jemuran aman",
        saat: "sensor hujan mendeteksi gerimis.",
        maka: "atap jemuran menutup dan Anda dapat notifikasi.",
        tests: [{ label: "Turunkan hujan", run: () => this.setRain(true) }]
      },
      // ---------- Keamanan ----------
      {
        id: "adaYangMasuk", group: "keamanan", icon: "warn", title: "Ada yang masuk",
        saat: "pintu terbuka ketika Mode Pergi aktif.",
        maka: "sirene berbunyi, CCTV merekam, notifikasi ke HP.",
        tests: [{ label: "Simulasikan penyusup", run: () => this.penyusup() }]
      },
      {
        id: "gas", group: "keamanan", icon: "chart", title: "Kebocoran gas",
        saat: "detektor gas mencium kebocoran di dapur.",
        maka: "alarm berbunyi dan seluruh keluarga dapat notifikasi.",
        tests: [{ label: "Bocorkan gas", run: () => { this.env.gasLeak = true; } }]
      },
      {
        id: "bocorAir", group: "keamanan", icon: "wrench", title: "Kebocoran air",
        saat: "sensor air mendeteksi genangan di lantai.",
        maka: "katup air utama menutup otomatis.",
        tests: [{ label: "Bocorkan pipa", run: () => { this.env.waterLeak = true; } }]
      },
      {
        id: "anakPulang", group: "keamanan", icon: "people", title: "Anak pulang",
        saat: "pintu dibuka dengan PIN milik anak.",
        maka: "orang tua langsung dapat notifikasi di HP.",
        tests: [{ label: "Anak pulang sekolah", run: () => this.anakPulang() }]
      },
      {
        id: "liburan", group: "keamanan", icon: "bulb", title: "Saat liburan",
        saat: "Mode Liburan diaktifkan.",
        maka: "lampu menyala-mati bergantian agar rumah tampak berpenghuni.",
        tests: [{ label: "Aktifkan & lompat ke 18.30", run: () => { this.liburan(true); this.clock.jumpTo(hm(18, 30)); } }]
      },
      {
        id: "listrikBoros", group: "keamanan", icon: "bolt", title: "Listrik boros",
        saat: "pemakaian listrik melewati batas yang Anda atur.",
        maka: "notifikasi ke HP agar bisa segera dicek.",
        tests: [{
          label: "Nyalakan banyak alat", run: () => {
            (["ac", "waterHeater", "tv", "pompaAir", "sprinkler", "lampTamu", "lampKamar"] as DeviceId[])
              .forEach((id) => s.set(id, true, "app"));
          }
        }]
      }
    ];
  }

  private fired(id: string): boolean {
    if (!this.enabled[id]) return false;
    this.lastFired[id] = fmt(this.clock.minuteOfDay);
    this.onFire(id);
    return true;
  }

  private on(ids: DeviceId[], source: Source = "otomasi", level?: number) {
    ids.forEach((id) => this.store.set(id, true, source, level));
  }
  private off(ids: DeviceId[], source: Source = "otomasi") {
    ids.forEach((id) => this.store.set(id, false, source));
  }

  // =====================================================================
  // Reaksi atas perubahan perangkat
  // =====================================================================
  private onDevice(id: DeviceId, on: boolean, source: Source) {
    const d = DEVICE_BY_ID[id];
    this.bus.log(`home/${d.room}/${id}/set`, on ? "ON" : "OFF", on);

    if (id === "gate") {
      this.gateOpenSince = on ? this.clock.total : null;
      this.gateForgotNotified = false;
      this.gateCmdFromHp = source === "hp";
    }
    if (id === "ac" && on) this.emptySince = null;

    // Ada yang masuk: pintu dibuka paksa saat Mode Pergi
    if (id === "door" && on && source === "paksa" && this.env.mode === "pergi" && this.store.state.alarm.on) {
      if (this.fired("adaYangMasuk")) {
        this.on(["sirene", "cctv"]);
        this.bus.notify({
          title: "Pintu depan terbuka!", kind: "alert", to: "Pemilik rumah",
          body: "Pintu terbuka saat Mode Pergi aktif. Sirene berbunyi dan CCTV merekam.",
          actions: [{ label: "Matikan sirene", run: () => this.off(["sirene"], "hp") }]
        });
      }
    }
  }

  // =====================================================================
  // Loop per frame
  // =====================================================================
  update(dt: number, prev: number, now: number) {
    const simDt = now - prev; // menit simulasi
    const s = this.store.state;
    const e = this.env;
    const c = this.clock;

    // ---------- Jadwal harian ----------
    for (const item of this.daily) if (SimClock.crossed(prev, now, item.at)) item.run();
    if (SimClock.crossed(prev, now, hm(5, 30))) this.airHangat(true);
    if (SimClock.crossed(prev, now, hm(6)) || SimClock.crossed(prev, now, hm(17))) this.siramTaman(true);
    if (SimClock.crossed(prev, now, hm(18)) && this.fired("lampuTeras")) {
      this.on(["lampTeras", "gardenLight"], "jadwal");
      this.bus.notify({ title: "Matahari terbenam", body: "Lampu teras dan taman menyala.", kind: "info" });
    }
    if (SimClock.crossed(prev, now, hm(23)) && this.enabled.lampuTeras) this.off(["lampTeras", "gardenLight"], "jadwal");

    // ---------- Gerbang ----------
    const car = this.actors.car;
    if (car.state === "arriving" && car.z < 9.4 && s.gate.on && this.fired("tutupSendiri")) {
      this.off(["gate"]);
      this.bus.notify({ title: "Gerbang menutup otomatis", body: "Mobil sudah masuk dan terdeteksi sensor.", kind: "ok" });
    }
    if (car.state === "leaving" && car.z > 6.5 && !s.gate.on && car.z < 13) this.on(["gate"]);
    const carOut = (car.state === "leaving" && car.z > 14.8) || car.state === "away";
    if (carOut && s.gate.on && this.running.has("pergiMobil") && this.fired("tutupSendiri")) {
      this.running.delete("pergiMobil");
      this.off(["gate"]);
    }
    if (this.gateCmdFromHp && !this.store.isMoving("gate") && this.fired("gerbangHp")) {
      this.gateCmdFromHp = false;
      this.bus.notify({ title: s.gate.on ? "Gerbang terbuka" : "Gerbang tertutup", body: "Perintah dari HP selesai dijalankan.", kind: "ok" });
    }
    if (s.gate.on && this.gateOpenSince !== null && !this.gateForgotNotified && now - this.gateOpenSince >= 10
      && car.state !== "arriving" && car.state !== "leaving") {
      this.gateForgotNotified = true;
      if (this.fired("lupaMenutup")) {
        this.bus.notify({
          title: "Gerbang masih terbuka", kind: "warn",
          body: "Gerbang sudah terbuka lebih dari 10 menit.",
          actions: [{ label: "Tutup gerbang", run: () => this.store.set("gate", false, "hp") }]
        });
      }
    }

    // ---------- Siram taman ----------
    if (this.sprinklerOffAt !== null && (now >= this.sprinklerOffAt || e.raining)) {
      this.sprinklerOffAt = null;
      this.off(["sprinkler"], "jadwal");
    }

    // ---------- Sensor gerak lorong & lampu malam ----------
    const inLorong = (v: Vec2) => v.x > -8 && v.x < 3 && v.z > -7.6 && v.z < -6;
    e.motionLorong = (["penghuni", "anak", "tamu", "penyusup"] as const)
      .some((id) => { const p = this.actors.person(id); return p.visible && inLorong(p.pos); });
    if (e.motionLorong) {
      if (c.inWindow(hm(22), hm(5)) && !s.lampLorong.on && this.fired("lampuMalam")) this.on(["lampLorong"], "otomasi", 0.35);
      this.lastMotion = now;
    }
    if (s.lampLorong.on && !e.motionLorong && now - this.lastMotion >= 3 && this.enabled.lampuMalam) this.off(["lampLorong"]);

    // ---------- Okupansi ruang tamu & AC hemat ----------
    const inLiving = (v: Vec2) => v.x > -8 && v.x < 3 && v.z > -6 && v.z < 6;
    e.occupiedLiving = (["penghuni", "anak"] as const).some((id) => { const p = this.actors.person(id); return p.visible && inLiving(p.pos); });
    if (e.occupiedLiving || this.running.has("pulang")) this.emptySince = null;
    else if (this.emptySince === null) this.emptySince = now;
    if (s.ac.on && this.enabled.acHemat) {
      if (e.windowOpen) {
        this.fired("acHemat");
        this.off(["ac"]);
        this.bus.notify({
          title: "AC dimatikan", kind: "info", body: "Jendela ruang tamu dibuka, AC dimatikan agar hemat listrik.",
          actions: [{ label: "Tutup jendela", run: () => { e.windowOpen = false; } }]
        });
      } else if (this.emptySince !== null && now - this.emptySince >= 15) {
        this.fired("acHemat");
        this.off(["ac"]);
        this.bus.notify({ title: "AC dimatikan", kind: "info", body: "Ruang tamu kosong selama 15 menit." });
      }
    }

    // ---------- Suhu ruangan ----------
    const h = c.minuteOfDay / 60;
    const outdoor = 26 + 6 * Math.max(0, Math.sin((Math.PI * (h - 7)) / 12)) - (e.raining ? 2 : 0);
    const target = s.ac.on ? 24 : outdoor;
    e.tempLiving += (target - e.tempLiving) * Math.min(1, simDt * 0.12 + dt * 0.05);

    // ---------- Water heater ----------
    e.heaterTemp += ((s.waterHeater.on ? 50 : 28) - e.heaterTemp) * Math.min(1, simDt * 0.05);
    if (s.waterHeater.on && e.heaterTemp > 44 && !this.heaterReadyNotified) {
      this.heaterReadyNotified = true;
      this.bus.notify({ title: "Air hangat siap", body: `Suhu air ${Math.round(e.heaterTemp)}°C.`, kind: "ok" });
    }
    if (this.heaterOffAt !== null && now >= this.heaterOffAt) {
      this.heaterOffAt = null;
      this.off(["waterHeater"], "jadwal");
    }

    // ---------- Tandon & pompa pintar ----------
    const leaking = e.waterLeak && s.katupAir.on;
    const drain = 0.04 + (s.waterHeater.on ? 0.15 : 0) + (s.sprinkler.on ? 0.9 : 0) + (leaking ? 2.2 : 0);
    const fill = s.pompaAir.on ? 3 : 0;
    e.tank = Math.min(100, Math.max(0, e.tank + (fill - drain) * simDt));
    if (this.enabled.pompaPintar) {
      if (e.tank < 20 && !s.pompaAir.on) {
        this.fired("pompaPintar");
        this.on(["pompaAir"]);
        this.bus.notify({ title: "Tandon hampir kosong", body: `Level ${Math.round(e.tank)}%. Pompa menyala sendiri.`, kind: "warn" });
      } else if (e.tank >= 95 && s.pompaAir.on) {
        this.fired("pompaPintar");
        this.off(["pompaAir"]);
        this.bus.notify({ title: "Tandon penuh", body: "Level 95%. Pompa mati sendiri.", kind: "ok" });
      }
    }

    // ---------- Gas ----------
    if (e.gasLeak && !this.running.has("gas")) {
      this.running.add("gas");
      if (this.fired("gas")) {
        this.on(["sirene"]);
        this.bus.notify({
          title: "Kebocoran gas di dapur!", kind: "alert", to: "Seluruh keluarga",
          body: "Detektor gas mencium kebocoran. Buka jendela dan jangan nyalakan api.",
          actions: [{ label: "Tandai aman", run: () => { e.gasLeak = false; this.off(["sirene"], "hp"); this.running.delete("gas"); } }]
        });
      }
    }

    // ---------- Kebocoran air ----------
    if (e.waterLeak && !this.running.has("bocorAir")) {
      this.running.add("bocorAir");
      this.tasks.sleep(2.5).then(() => {
        if (!e.waterLeak || !this.fired("bocorAir")) return;
        this.off(["katupAir"]);
        this.bus.notify({
          title: "Genangan air di kamar mandi", kind: "warn",
          body: "Sensor air mendeteksi genangan. Katup air utama ditutup otomatis.",
          actions: [{ label: "Sudah diperbaiki", run: () => { e.waterLeak = false; this.on(["katupAir"], "hp"); this.running.delete("bocorAir"); } }]
        });
      });
    }

    // ---------- Liburan ----------
    if (e.mode === "liburan" && this.enabled.liburan) {
      const evening = c.inWindow(hm(17, 45), hm(23, 30));
      if (evening && now >= this.nextVacationSwap) {
        this.nextVacationSwap = now + 6 + Math.random() * 14;
        const lamps: DeviceId[] = ["lampTamu", "lampKamar", "lampTeras", "lampCarport"];
        const id = lamps[Math.floor(Math.random() * lamps.length)];
        this.store.set(id, !s[id].on, "otomasi", 1);
        this.fired("liburan");
      }
      if (SimClock.crossed(prev, now, hm(23, 30))) this.off(["lampTamu", "lampKamar", "lampTeras", "lampCarport"]);
    }

    // ---------- Daya listrik ----------
    const compressor = s.ac.on && e.tempLiving > 24.6 ? 350 : 0;
    e.power = this.store.powerWatt(compressor);
    if (e.power > e.powerLimit && !this.overPower) {
      this.overPower = true;
      if (this.fired("listrikBoros")) {
        this.bus.notify({
          title: "Pemakaian listrik tinggi", kind: "warn",
          body: `${e.power.toLocaleString("id-ID")} W, melewati batas ${e.powerLimit.toLocaleString("id-ID")} W.`,
          actions: [{ label: "Matikan water heater", run: () => this.off(["waterHeater"], "hp") }]
        });
      }
    } else if (e.power < e.powerLimit * 0.95) this.overPower = false;
  }

  // =====================================================================
  // Rutinitas (slide "Satu hari bersama sistem")
  // =====================================================================
  bangun() {
    this.bus.log("home/scene/set", "BANGUN");
    this.env.mode = "normal";
    this.off(["alarm", "lampLorong"], "jadwal");
    this.on(["tirai"], "jadwal");
    this.on(["lampKamar", "lampTamu"], "jadwal", 0.6);
    const p = this.actors.person("penghuni");
    if (!p.visible) {
      p.place(P.kamar);
      p.walk([P.pintuKamar, P.lorongTimur, P.bukaanLorong, P.depanSofa, P.sofa]).then(() => p.sit(Math.PI));
    }
  }

  async pergi(withCar: boolean) {
    this.bus.log("home/scene/set", "PERGI");
    this.env.mode = "pergi";
    this.off(["lampTamu", "lampKamar", "lampLorong", "lampTeras", "lampCarport", "ac", "tv", "fan", "door", "waterHeater"]);
    this.on(["alarm", "cctv"]);
    this.bus.notify({ title: "Mode Pergi aktif", body: "Lampu dan AC mati, pintu terkunci, alarm aktif.", kind: "ok" });
    const car = this.actors.car;
    if (!withCar || car.state !== "parked") return;
    this.actors.person("penghuni").hide();
    this.running.add("pergiMobil");
    this.on(["garage"]);
    car.leave();
    await this.tasks.until(() => car.z > 7.6 || car.state === "away");
    this.off(["garage"]);
  }

  async perjalananPulang() {
    if (this.running.has("perjalanan")) return;
    this.running.add("perjalanan");
    this.env.phoneKm = 3;
    this.bus.log("home/hp/lokasi", "3.0 km");
    let triggered = false;
    await this.tasks.until(() => {
      this.env.phoneKm = Math.max(0, this.env.phoneKm - 0.012);
      if (!triggered && this.env.phoneKm <= 0.5) {
        triggered = true;
        this.bus.log("home/hp/lokasi", "0.5 km");
        this.pulang("geofence");
      }
      return this.env.phoneKm <= 0.02;
    });
    this.env.phoneKm = 0;
    this.running.delete("perjalanan");
  }

  async pulang(trigger: "geofence" | "tombol") {
    if (this.running.has("pulang")) return;
    this.running.add("pulang");
    const s = this.store;
    const car = this.actors.car;
    this.bus.log("home/scene/set", "PULANG");
    this.pulangStep = 0;
    this.bus.notify({
      title: "Selamat datang!", kind: "ok",
      body: trigger === "geofence" ? "HP masuk radius 500 m. Rumah bersiap menyambut." : "Tombol Pulang ditekan. Rumah bersiap menyambut."
    });
    await this.tasks.sleep(1.4);

    // 01 Gerbang terbuka (menutup sendiri lewat aturan "Menutup sendiri")
    this.pulangStep = 1;
    if (car.state === "parked") { this.off(["garage"]); car.teleportAway(); }
    this.actors.person("penghuni").hide();
    this.on(["gate"]);
    car.arrive();
    await this.tasks.sleep(1.8);

    // 02 Lampu menyala
    this.pulangStep = 2;
    for (const id of ["lampCarport", "lampTeras", "lampTamu"] as DeviceId[]) {
      s.set(id, true, "otomasi", 1);
      await this.tasks.sleep(0.5);
    }
    await this.tasks.sleep(1);

    // 03 AC mendingin
    this.pulangStep = 3;
    this.on(["ac"]);
    await this.tasks.until(() => car.state === "arriving" && car.z < 15.5);
    this.on(["garage"]);
    await this.tasks.until(() => car.state === "parked");

    // 04 Alarm nonaktif, pintu dibuka dengan sidik jari
    this.pulangStep = 4;
    this.env.mode = "normal";
    this.off(["alarm"]);
    const p = this.actors.person("penghuni");
    p.place(P.sampingMobil);
    await p.walk([P.depanGarasi]);
    this.off(["garage"]);
    await p.walk([P.halamanTeras, P.terasDepanPintu]);
    this.fx.bubble(-1.75, 1.4, 6.2, "Sidik jari cocok ✓", 2);
    s.set("door", true, "sidik-jari");
    await this.tasks.until(() => s.state.door.t > 0.8);
    await p.walk([P.dalamPintu]);
    this.off(["door"]);
    await p.walk([P.depanSofa, P.sofa]);
    p.sit(Math.PI);
    this.pulangStep = 5;
    await this.tasks.sleep(4);
    this.pulangStep = -1;
    this.running.delete("pulang");
  }

  tidur() {
    this.bus.log("home/scene/set", "TIDUR");
    this.env.mode = "tidur";
    this.off(["lampTamu", "tv", "ac", "tirai", "door", "gate", "garage", "lampCarport"], "jadwal");
    this.on(["lampKamar"], "jadwal", 0.2);
    this.on(["alarm", "cctv"], "jadwal");
    this.bus.notify({ title: "Mode Tidur", body: "Lampu meredup, alarm aktif, semua perangkat beristirahat.", kind: "ok" });
    const p = this.actors.person("penghuni");
    if (p.visible) p.walk([P.depanSofa, P.bukaanLorong, P.lorongTimur, P.pintuKamar, P.kamar]).then(() => p.hide());
    this.tasks.sleep(12).then(() => { if (this.env.mode === "tidur") this.off(["lampKamar"], "jadwal"); });
  }

  allOff() {
    this.bus.log("home/scene/set", "MATIKAN_SEMUA");
    this.off(["ac", "lampTamu", "tv", "lampLorong", "waterHeater", "lampKamar", "fan", "lampCarport", "lampTeras", "sprinkler", "gardenLight", "sirene"], "app");
  }

  // =====================================================================
  // Skenario per aturan
  // =====================================================================
  gateFromPhone() {
    this.store.toggle("gate", "hp");
  }

  async tamu() {
    if (this.running.has("tamu")) return;
    this.running.add("tamu");
    const g = this.actors.person("tamu");
    g.place(P.trotoarBarat);
    await g.walk([P.depanBel]);
    this.fx.bubble(3.0, 1.9, 12.4, "Ding-dong!", 1.6);
    this.bus.log("home/halaman/bel/press", "1");
    if (!this.fired("tamuGerbang")) { await this.tamuPergi(false); return; }
    this.call = { from: "Bel video · Gerbang" };
    this.bus.notify({
      title: "Tamu di gerbang", kind: "warn", body: "Kurir menekan bel video. Angkat untuk melihat.",
      expired: () => !this.call,
      actions: [
        { label: "Buka gerbang", run: () => this.jawabTamu(true) },
        { label: "Tolak", run: () => this.jawabTamu(false) }
      ]
    });
  }

  async jawabTamu(open: boolean) {
    if (!this.call || !this.running.has("tamu")) { this.call = null; return; }
    this.call = null;
    const g = this.actors.person("tamu");
    if (!open) {
      this.fx.bubble(g.pos.x, 2.1, g.pos.z, "Baik, nanti saya kembali.", 2);
      await this.tamuPergi(false);
      return;
    }
    this.store.set("gate", true, "hp");
    await this.tasks.until(() => this.store.state.gate.t > 0.7);
    await g.walk([{ x: 5.0, z: 12.9 }, P.dalamGerbang, P.halamanTeras]);
    this.fx.bubble(g.pos.x, 2.1, g.pos.z, "Paket saya taruh di teras ya.", 2.4);
    this.bus.notify({ title: "Paket diterima", body: "Kurir menaruh paket di teras.", kind: "ok" });
    await this.tasks.sleep(2.6);
    await this.tamuPergi(true);
  }

  private async tamuPergi(viaGate: boolean) {
    const g = this.actors.person("tamu");
    if (viaGate) await g.walk([P.dalamGerbang, { x: 5.0, z: 13.1 }, P.trotoarTimur]);
    else await g.walk([P.trotoarBarat]);
    g.hide();
    this.running.delete("tamu");
  }

  siramTaman(scheduled = false) {
    if (!this.fired("siramTaman")) return;
    if (this.env.raining) {
      this.bus.notify({ title: "Penyiraman dilewati", body: "Sedang hujan, taman tidak perlu disiram.", kind: "info" });
      return;
    }
    this.on(["sprinkler"], scheduled ? "jadwal" : "app");
    this.sprinklerOffAt = this.clock.total + 10;
  }

  airHangat(scheduled = false) {
    if (!this.fired("airHangat")) return;
    this.heaterReadyNotified = false;
    this.on(["waterHeater"], scheduled ? "jadwal" : "app");
    this.heaterOffAt = this.clock.total + 60;
  }

  async jalanLorong() {
    if (this.running.has("lorong")) return;
    this.running.add("lorong");
    if (!this.clock.inWindow(hm(22), hm(5))) {
      this.clock.jumpTo(hm(23));
      this.bus.notify({ title: "Jam dipindah ke 23.00", body: "Lampu malam hanya aktif pukul 22.00–05.00.", kind: "info" });
    }
    const p = this.actors.person("penghuni");
    p.place(P.kamar);
    await p.walk([P.pintuKamar, P.lorongTimur, P.pintuKamarMandi, P.kamarMandi]);
    await this.tasks.sleep(1.5);
    await p.walk([P.pintuKamarMandi, P.lorongTimur, P.pintuKamar, P.kamar]);
    p.hide();
    this.running.delete("lorong");
  }

  bukaJendela() {
    if (!this.store.state.ac.on) this.on(["ac"], "app");
    this.tasks.sleep(2).then(() => { this.env.windowOpen = true; this.bus.log("home/ruang-tamu/jendela/state", "OPEN"); });
  }

  async tinggalkanRuangTamu() {
    if (!this.store.state.ac.on) this.on(["ac"], "app");
    const p = this.actors.person("penghuni");
    if (!p.visible) { p.place(P.sofa, { sit: true, face: Math.PI }); await this.tasks.sleep(1.5); }
    await p.walk([P.depanSofa, P.bukaanLorong, P.lorongTimur, P.pintuKamar, P.kamar]);
    p.hide();
    this.bus.notify({ title: "Ruang tamu kosong", body: "AC akan mati jika tetap kosong 15 menit.", kind: "info" });
  }

  nonton() {
    this.fx.bubble(-0.1, 1.5, -5.6, "Hey Google, mode nonton", 2.2);
    this.bus.log("home/ruang-tamu/speaker/voice", "mode nonton");
    this.tasks.sleep(1.4).then(() => {
      if (!this.fired("modeNonton")) return;
      this.on(["lampTamu"], "suara", 0.25);
      this.off(["tirai"], "suara");
      this.on(["tv"], "suara");
      const p = this.actors.person("penghuni");
      if (!p.visible) p.place(P.sofa, { sit: true, face: Math.PI });
    });
  }

  setRain(v: boolean) {
    if (this.env.raining === v) return;
    this.env.raining = v;
    this.bus.log("home/halaman/sensor-hujan/state", v ? "HUJAN" : "CERAH", v);
    if (!this.enabled.jemuran) return;
    this.tasks.sleep(v ? 1.2 : 2).then(() => {
      if (this.env.raining !== v || !this.fired("jemuran")) return;
      if (v) {
        this.on(["atapJemuran"]);
        this.bus.notify({ title: "Gerimis terdeteksi", body: "Atap jemuran ditutup otomatis.", kind: "info" });
      } else {
        this.off(["atapJemuran"]);
        this.bus.notify({ title: "Hujan reda", body: "Atap jemuran dibuka kembali.", kind: "info" });
      }
    });
  }

  async penyusup() {
    if (this.running.has("penyusup")) return;
    this.running.add("penyusup");
    if (this.env.mode !== "pergi") await this.pergi(false);
    const x = this.actors.person("penyusup");
    x.place(P.trotoarBarat);
    await x.walk([P.celahPagar, P.terasDepanPintu], 1.8);
    await this.tasks.sleep(0.6);
    this.store.set("door", true, "paksa");
    await this.tasks.sleep(1.6);
    this.fx.bubble(x.pos.x, 2.1, x.pos.z, "!!!", 1.4);
    await x.walk([P.celahPagar, P.trotoarBarat], 4.2);
    x.hide();
    this.off(["door"], "app");
    this.running.delete("penyusup");
  }

  async anakPulang() {
    if (this.running.has("anak")) return;
    this.running.add("anak");
    const a = this.actors.person("anak");
    a.place(P.trotoarTimur);
    await a.walk([P.celahPagar, P.terasDepanPintu]);
    this.fx.bubble(-1.75, 1.4, 6.2, "PIN • • • •", 1.6);
    await this.tasks.sleep(1.6);
    if (this.store.state.alarm.on) this.off(["alarm"], "pin-anak");
    this.store.set("door", true, "pin-anak");
    if (this.fired("anakPulang")) {
      this.bus.notify({ title: "Anak sudah pulang", to: "Orang tua", kind: "ok", body: `Pintu depan dibuka dengan PIN milik Anak pukul ${fmt(this.clock.minuteOfDay)}.` });
    }
    await this.tasks.until(() => this.store.state.door.t > 0.8);
    await a.walk([P.dalamPintu, P.ruangTamu]);
    this.off(["door"], "app");
    await this.tasks.sleep(4);
    a.hide();
    this.running.delete("anak");
  }

  liburan(on: boolean) {
    if (on) {
      this.env.mode = "liburan";
      this.off(["lampTamu", "lampKamar", "lampTeras", "lampCarport", "ac", "tv", "fan", "door", "gate", "garage"]);
      this.on(["alarm", "cctv"]);
      this.actors.person("penghuni").hide();
      this.nextVacationSwap = 0;
      this.bus.notify({ title: "Mode Liburan aktif", body: "Mulai senja, lampu akan menyala-mati bergantian.", kind: "ok" });
    } else {
      this.env.mode = "normal";
      this.off(["alarm"]);
      this.bus.notify({ title: "Mode Liburan selesai", body: "Selamat datang kembali.", kind: "info" });
    }
  }
}
