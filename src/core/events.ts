/** Notifikasi yang muncul di HP virtual. */
export interface Notice {
  id: number;
  time: string;
  title: string;
  body: string;
  kind: "info" | "warn" | "alert" | "ok";
  /** Penerima, mis. "Seluruh keluarga". */
  to?: string;
  actions?: { label: string; run: () => void }[];
  /** Tombol aksi disembunyikan setelah kondisi ini benar (mis. panggilan sudah dijawab). */
  expired?: () => boolean;
}

type NoticeListener = (n: Notice) => void;
type LogListener = (topic: string, payload: string, on: boolean) => void;

export class Bus {
  private noticeL: NoticeListener[] = [];
  private logL: LogListener[] = [];
  private nextId = 1;
  constructor(private now: () => string) {}

  notify(n: Omit<Notice, "id" | "time">): Notice {
    const full: Notice = { ...n, id: this.nextId++, time: this.now() };
    this.noticeL.forEach((l) => l(full));
    this.log("home/notify/hp", n.title, n.kind !== "info");
    return full;
  }
  onNotice(l: NoticeListener) { this.noticeL.push(l); }

  log(topic: string, payload: string, on = true) { this.logL.forEach((l) => l(topic, payload, on)); }
  onLog(l: LogListener) { this.logL.push(l); }
}

/** Penjadwal sederhana untuk rangkaian langkah (async/await) yang dicek tiap frame. */
export class Tasks {
  private waiters: { pred: () => boolean; resolve: () => void }[] = [];
  private realTime = 0;

  until(pred: () => boolean): Promise<void> {
    if (pred()) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push({ pred, resolve }));
  }

  /** Tunggu sejumlah detik nyata (untuk jeda antar-animasi). */
  sleep(sec: number): Promise<void> {
    const end = this.realTime + sec;
    return this.until(() => this.realTime >= end);
  }

  tick(dt: number): void {
    this.realTime += dt;
    const ready = this.waiters.filter((w) => w.pred());
    if (!ready.length) return;
    this.waiters = this.waiters.filter((w) => !ready.includes(w));
    ready.forEach((w) => w.resolve());
  }
}
