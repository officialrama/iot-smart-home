export const MIN_PER_DAY = 24 * 60;

/** Format menit-dalam-hari ke "06.00" seperti di slide. */
export function fmt(min: number): string {
  const m = ((Math.floor(min) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`;
}

export const hm = (h: number, m = 0) => h * 60 + m;

/**
 * Jam simulasi. `speed` = menit simulasi per detik nyata.
 * Total menit terus bertambah (tidak di-reset tiap hari) agar durasi mudah dihitung.
 */
export class SimClock {
  total: number;
  speed = 1;
  playing = true;

  constructor(startMinute: number) {
    this.total = startMinute;
  }

  get minuteOfDay(): number {
    return ((this.total % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  }

  get day(): number {
    return Math.floor(this.total / MIN_PER_DAY) + 1;
  }

  /** Majukan jam; kembalikan [sebelum, sesudah] dalam menit total. */
  advance(dtSec: number): [number, number] {
    const prev = this.total;
    if (this.playing) this.total += dtSec * this.speed;
    return [prev, this.total];
  }

  /** Lompat ke jam tertentu (hari yang sama atau hari berikutnya bila sudah lewat). */
  jumpTo(minuteOfDay: number): void {
    const dayStart = this.total - this.minuteOfDay;
    let t = dayStart + minuteOfDay;
    if (t < this.total - 1) t += MIN_PER_DAY;
    this.total = t;
  }

  /** Apakah jam `at` (menit dalam hari) terlewati antara prev dan now. */
  static crossed(prev: number, now: number, at: number): boolean {
    if (now <= prev) return false;
    const k = Math.ceil((prev - at) / MIN_PER_DAY);
    const next = at + k * MIN_PER_DAY; // kemunculan `at` pertama yang >= prev
    return next > prev && next <= now;
  }

  /** 0 = malam, 1 = siang penuh. Matahari terbit ~05.45, terbenam ~18.00. */
  daylight(): number {
    const h = this.minuteOfDay / 60;
    const ramp = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    return Math.min(ramp(h, 5.3, 6.6), 1 - ramp(h, 17.5, 18.6));
  }

  inWindow(fromMin: number, toMin: number): boolean {
    const m = this.minuteOfDay;
    return fromMin <= toMin ? m >= fromMin && m < toMin : m >= fromMin || m < toMin;
  }
}
