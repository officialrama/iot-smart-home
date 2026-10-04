export type DeviceId =
  | "ac" | "lampTamu" | "tv" | "tirai" | "door"
  | "lampLorong" | "waterHeater"
  | "lampKamar" | "fan"
  | "garage" | "lampCarport"
  | "lampTeras" | "gate" | "gateKecil" | "cctv" | "sprinkler" | "gardenLight"
  | "pompaAir" | "katupAir" | "atapJemuran" | "alarm" | "sirene";

export type IconName =
  | "ac" | "lamp" | "tv" | "fan" | "door" | "gate" | "garage" | "cctv" | "water" | "post"
  | "curtain" | "heater" | "pump" | "valve" | "roof" | "shield" | "siren" | "moon";

export type Room = "ruang-tamu" | "lorong" | "kamar-mandi" | "kamar" | "garasi" | "teras" | "halaman" | "utilitas";

export interface DeviceDef {
  id: DeviceId;
  name: string;
  room: Room;
  icon: IconName;
  onLabel: string;
  offLabel: string;
  /** Daya saat menyala (watt). */
  watt: number;
  /** Daya motor selama bergerak (watt). */
  motorWatt?: number;
  /** Kecepatan transisi animasi (per detik). */
  speed?: number;
  cool?: boolean;
  alert?: boolean;
}

export const DEVICES: DeviceDef[] = [
  { id: "ac", name: "AC", room: "ruang-tamu", icon: "ac", onLabel: "Menyala 24°C", offLabel: "Mati", watt: 900, cool: true },
  { id: "lampTamu", name: "Lampu ruang tamu", room: "ruang-tamu", icon: "lamp", onLabel: "Menyala", offLabel: "Mati", watt: 12 },
  { id: "tv", name: "Smart TV", room: "ruang-tamu", icon: "tv", onLabel: "Menyala", offLabel: "Standby", watt: 110 },
  { id: "tirai", name: "Tirai", room: "ruang-tamu", icon: "curtain", onLabel: "Terbuka", offLabel: "Tertutup", watt: 0, motorWatt: 40, speed: 0.35 },
  { id: "door", name: "Pintu depan", room: "teras", icon: "door", onLabel: "Terbuka", offLabel: "Terkunci", watt: 5, speed: 0.9 },
  { id: "lampLorong", name: "Lampu malam lorong", room: "lorong", icon: "moon", onLabel: "Menyala redup", offLabel: "Mati", watt: 3 },
  { id: "waterHeater", name: "Water heater", room: "kamar-mandi", icon: "heater", onLabel: "Memanaskan", offLabel: "Mati", watt: 1200, alert: true },
  { id: "lampKamar", name: "Lampu kamar", room: "kamar", icon: "lamp", onLabel: "Menyala", offLabel: "Mati", watt: 12 },
  { id: "fan", name: "Kipas angin", room: "kamar", icon: "fan", onLabel: "Berputar", offLabel: "Mati", watt: 45, cool: true },
  { id: "garage", name: "Pintu garasi", room: "garasi", icon: "garage", onLabel: "Terbuka", offLabel: "Tertutup", watt: 0, motorWatt: 400, speed: 0.45 },
  { id: "lampCarport", name: "Lampu carport", room: "garasi", icon: "lamp", onLabel: "Menyala", offLabel: "Mati", watt: 15 },
  { id: "lampTeras", name: "Lampu teras", room: "teras", icon: "lamp", onLabel: "Menyala", offLabel: "Mati", watt: 15 },
  { id: "gate", name: "Gerbang besar", room: "halaman", icon: "gate", onLabel: "Terbuka", offLabel: "Tertutup", watt: 0, motorWatt: 300, speed: 0.38 },
  { id: "gateKecil", name: "Gerbang kecil", room: "halaman", icon: "gate", onLabel: "Terbuka", offLabel: "Tertutup", watt: 0, motorWatt: 60, speed: 0.8 },
  { id: "cctv", name: "CCTV", room: "halaman", icon: "cctv", onLabel: "Merekam", offLabel: "Mati", watt: 6 },
  { id: "sprinkler", name: "Pompa taman", room: "halaman", icon: "water", onLabel: "Menyiram", offLabel: "Mati", watt: 250, cool: true },
  { id: "gardenLight", name: "Lampu taman", room: "halaman", icon: "post", onLabel: "Menyala", offLabel: "Mati", watt: 20 },
  { id: "pompaAir", name: "Pompa tandon", room: "utilitas", icon: "pump", onLabel: "Mengisi", offLabel: "Mati", watt: 250, cool: true },
  { id: "katupAir", name: "Katup air utama", room: "utilitas", icon: "valve", onLabel: "Terbuka", offLabel: "Tertutup", watt: 0, cool: true, speed: 1.2 },
  { id: "atapJemuran", name: "Atap jemuran", room: "utilitas", icon: "roof", onLabel: "Tertutup", offLabel: "Terbuka", watt: 0, motorWatt: 60, speed: 0.6 },
  { id: "alarm", name: "Alarm", room: "utilitas", icon: "shield", onLabel: "Aktif", offLabel: "Nonaktif", watt: 4 },
  { id: "sirene", name: "Sirene", room: "teras", icon: "siren", onLabel: "Berbunyi", offLabel: "Diam", watt: 30, alert: true }
];

export const DEVICE_BY_ID = Object.fromEntries(DEVICES.map((d) => [d.id, d])) as Record<DeviceId, DeviceDef>;

export interface DeviceState {
  on: boolean;
  /** Progres animasi 0..1 menuju status on/off. */
  t: number;
  /** Kecerahan / tingkat (0..1), dipakai lampu yang bisa diredupkan. */
  level: number;
}

/** Siapa yang memberi perintah. Dipakai aturan otomasi (mis. pintu dibuka paksa). */
export type Source = "app" | "hp" | "otomasi" | "jadwal" | "sidik-jari" | "pin-anak" | "paksa" | "suara";

type Listener = (id: DeviceId, on: boolean, source: Source) => void;

export class DeviceStore {
  readonly state = {} as Record<DeviceId, DeviceState>;
  private listeners: Listener[] = [];

  constructor(initiallyOn: DeviceId[]) {
    for (const d of DEVICES) {
      const on = initiallyOn.includes(d.id);
      this.state[d.id] = { on, t: on ? 1 : 0, level: 1 };
    }
  }

  set(id: DeviceId, on: boolean, source: Source = "app", level?: number): void {
    const s = this.state[id];
    const levelChanged = level !== undefined && level !== s.level;
    if (level !== undefined) s.level = level;
    if (s.on === on && !levelChanged) return;
    s.on = on;
    this.listeners.forEach((l) => l(id, on, source));
  }

  toggle(id: DeviceId, source: Source = "app"): void {
    this.set(id, !this.state[id].on, source, this.state[id].on ? undefined : 1);
  }

  subscribe(l: Listener): void {
    this.listeners.push(l);
  }

  isMoving(id: DeviceId): boolean {
    const s = this.state[id];
    return Math.abs(s.t - (s.on ? 1 : 0)) > 0.001;
  }

  /** Sudah sampai penuh di posisi terbuka/menyala. */
  isFully(id: DeviceId, on = true): boolean {
    const s = this.state[id];
    return s.on === on && !this.isMoving(id);
  }

  step(dt: number): void {
    for (const d of DEVICES) {
      const s = this.state[d.id];
      const target = s.on ? 1 : 0;
      const sp = d.speed ?? 2.5;
      if (s.t < target) s.t = Math.min(target, s.t + dt * sp);
      else if (s.t > target) s.t = Math.max(target, s.t - dt * sp);
    }
  }

  activeCount(): number {
    return DEVICES.filter((d) => this.state[d.id].on).length;
  }

  powerWatt(extra = 0): number {
    let p = 35; // router + hub
    for (const d of DEVICES) {
      const s = this.state[d.id];
      if (s.on) p += d.watt * (d.icon === "lamp" || d.icon === "moon" ? s.level : 1);
      if (d.motorWatt && this.isMoving(d.id)) p += d.motorWatt;
    }
    return Math.round(p + extra);
  }
}
