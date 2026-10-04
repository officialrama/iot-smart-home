import { fmt } from "../core/clock";
import type { Notice } from "../core/events";
import type { Home } from "../core/home";
import type { World } from "../scene/world";
import { UI_ICONS } from "./icons";

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode) => root.querySelector(sel) as T;

/** HP virtual milik pemilik rumah: notifikasi, tombol cepat, dan video call dari bel gerbang. */
export function createPhone(home: Home, world: World): { refresh(): void } {
  const { store, env, clock } = home;
  const el = document.getElementById("phone")!;
  el.innerHTML = `
    <div class="ph-head" id="ph-head" title="Seret untuk memindahkan HP">
      <span class="ph-grip" aria-hidden="true"></span>
      <span class="ph-ic">${UI_ICONS.phone}</span>
      <span class="ph-title">HP Anda</span>
      <span class="ph-badge" id="ph-badge" hidden>0</span>
      <span class="ph-clock" id="ph-clock">--.--</span>
      <button class="ph-hbtn" id="ph-min" aria-expanded="true" aria-label="Kecilkan HP">${UI_ICONS.minus}</button>
      <button class="ph-hbtn" id="ph-hide" aria-label="Sembunyikan HP">${UI_ICONS.close}</button>
    </div>
    <div class="ph-body" id="ph-body">
      <div class="ph-loc"><span>Lokasi HP</span><b id="ph-km">Di rumah</b></div>
      <div class="ph-quick">
        <button data-q="gate"><span>Gerbang</span><b></b></button>
        <button data-q="door"><span>Pintu</span><b></b></button>
        <button data-q="alarm"><span>Alarm</span><b></b></button>
      </div>
      <div class="ph-tank"><span>Tandon</span><i><b id="ph-tank-bar"></b></i><span id="ph-tank">72%</span></div>
      <div class="ph-list" id="ph-list"><p class="ph-empty">Belum ada notifikasi.</p></div>
    </div>
    <div class="ph-call" id="ph-call" hidden>
      <p class="ph-call-h">Video call masuk</p>
      <p class="ph-call-from" id="ph-call-from">Bel video · Gerbang</p>
      <canvas id="ph-cam" width="520" height="320"></canvas>
      <div class="ph-call-a">
        <button class="btn danger" id="ph-reject">Tolak</button>
        <button class="btn primary" id="ph-accept">Buka gerbang</button>
      </div>
    </div>`;

  const stage = el.parentElement!;
  const body = $("#ph-body", el);
  const head = $("#ph-head", el);
  const minBtn = $<HTMLButtonElement>("#ph-min", el);
  const badge = $("#ph-badge", el);
  const showBtn = document.getElementById("ph-show")!;
  const showBadge = document.getElementById("ph-show-badge")!;
  let unread = 0;

  const setBadges = () => {
    for (const b of [badge, showBadge]) { b.textContent = String(unread); b.hidden = unread === 0; }
  };
  const setOpen = (open: boolean) => {
    el.classList.toggle("collapsed", !open);
    minBtn.setAttribute("aria-expanded", String(open));
    minBtn.setAttribute("aria-label", open ? "Kecilkan HP" : "Buka HP");
    minBtn.innerHTML = open ? UI_ICONS.minus : UI_ICONS.expand;
    body.hidden = !open;
    if (open) { unread = 0; setBadges(); }
    // HP yang sudah digeser tidak lagi menempel atas-bawah, jadi beri tinggi tetap saat dibuka
    if (open && el.classList.contains("free") && !el.style.height) el.style.height = `${Math.min(stage.clientHeight - 24, 600)}px`;
    clamp();
  };
  const setVisible = (v: boolean) => {
    el.hidden = !v;
    showBtn.setAttribute("aria-pressed", String(v));
    if (v && !el.classList.contains("collapsed")) { unread = 0; setBadges(); }
    if (v) clamp();
  };
  minBtn.addEventListener("click", () => setOpen(el.classList.contains("collapsed")));
  $("#ph-hide", el).addEventListener("click", () => setVisible(false));
  showBtn.addEventListener("click", () => setVisible(el.hidden));

  // ---------- Geser HP dengan menyeret bagian atasnya ----------
  let moved = false;
  /** Jaga HP tetap di dalam panggung (dipanggil setelah digeser, diubah ukurannya, atau dikecilkan). */
  function clamp() {
    if (!el.classList.contains("free")) return;
    const maxX = Math.max(0, stage.clientWidth - el.offsetWidth);
    const maxY = Math.max(0, stage.clientHeight - el.offsetHeight);
    el.style.left = `${Math.min(maxX, Math.max(0, el.offsetLeft))}px`;
    el.style.top = `${Math.min(maxY, Math.max(0, el.offsetTop))}px`;
  }
  head.addEventListener("pointerdown", (ev) => {
    if ((ev.target as HTMLElement).closest("button") || ev.button !== 0) return;
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    if (!el.classList.contains("free")) {
      // Lepas dari posisi bawaan (menempel kanan) dan kunci tingginya saat ini
      el.style.height = el.classList.contains("collapsed") ? "" : `${r.height}px`;
      el.classList.add("free");
      el.style.left = `${r.left - sr.left}px`;
      el.style.top = `${r.top - sr.top}px`;
    }
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const sx = ev.clientX, sy = ev.clientY;
    moved = false;
    head.setPointerCapture(ev.pointerId);
    el.classList.add("dragging");
    const onMove = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 4) return;
      moved = true;
      el.style.left = `${e.clientX - sr.left - dx}px`;
      el.style.top = `${e.clientY - sr.top - dy}px`;
      clamp();
    };
    const onUp = () => {
      head.removeEventListener("pointermove", onMove);
      head.removeEventListener("pointerup", onUp);
      head.removeEventListener("pointercancel", onUp);
      el.classList.remove("dragging");
      // Ketuk tanpa menggeser = kecilkan / buka
      if (!moved) setOpen(el.classList.contains("collapsed"));
    };
    head.addEventListener("pointermove", onMove);
    head.addEventListener("pointerup", onUp);
    head.addEventListener("pointercancel", onUp);
  });
  head.addEventListener("dblclick", (e) => e.preventDefault());
  new ResizeObserver(() => clamp()).observe(stage);

  if (window.matchMedia("(max-width: 860px)").matches) setOpen(false);

  el.querySelectorAll<HTMLButtonElement>("[data-q]").forEach((b) => b.addEventListener("click", () => {
    const q = b.dataset.q!;
    if (q === "gate") home.gateFromPhone();
    else if (q === "door") store.toggle("door", "hp");
    else if (q === "alarm") store.toggle("alarm", "hp");
  }));

  const list = $("#ph-list", el);
  let expiring: { acts: HTMLElement; expired: () => boolean }[] = [];
  home.bus.onNotice((n: Notice) => {
    $(".ph-empty", list)?.remove();
    const item = document.createElement("article");
    item.className = `ph-n ${n.kind}`;
    item.innerHTML = `<div class="ph-n-h"><b></b><time></time></div><p></p>${n.to ? `<small></small>` : ""}<div class="ph-n-a"></div>`;
    $("b", item).textContent = n.title;
    $("time", item).textContent = n.time;
    $("p", item).textContent = n.body;
    if (n.to) $("small", item).textContent = `Dikirim ke: ${n.to}`;
    const acts = $(".ph-n-a", item);
    for (const a of n.actions ?? []) {
      const b = document.createElement("button");
      b.className = "btn small";
      b.textContent = a.label;
      b.addEventListener("click", () => { a.run(); acts.innerHTML = `<span class="ph-done">Selesai: ${a.label}</span>`; });
      acts.appendChild(b);
    }
    if (n.expired) expiring.push({ acts, expired: n.expired });
    list.prepend(item);
    while (list.children.length > 12) list.lastElementChild!.remove();
    if (el.classList.contains("collapsed") || el.hidden) { unread++; setBadges(); }
    el.classList.remove("ping");
    void el.offsetWidth;
    el.classList.add("ping");
  });

  // Video call
  const call = $("#ph-call", el);
  const cam = $<HTMLCanvasElement>("#ph-cam", el);
  let camAttached = false;
  $("#ph-accept", el).addEventListener("click", () => home.jawabTamu(true));
  $("#ph-reject", el).addEventListener("click", () => home.jawabTamu(false));

  return {
    refresh() {
      $("#ph-clock", el).textContent = fmt(clock.minuteOfDay);
      $("#ph-km", el).textContent = env.phoneKm < 0.05 ? "Di rumah" : `${env.phoneKm.toFixed(1).replace(".", ",")} km dari rumah`;
      const st = (id: "gate" | "door" | "alarm") => {
        const s = store.state[id];
        if (id === "alarm") return s.on ? "Aktif" : "Nonaktif";
        if (store.isMoving(id)) return s.on ? "Membuka…" : "Menutup…";
        return s.on ? "Terbuka" : id === "door" ? "Terkunci" : "Tertutup";
      };
      el.querySelectorAll<HTMLButtonElement>("[data-q]").forEach((b) => {
        const id = b.dataset.q as "gate" | "door" | "alarm";
        $("b", b).textContent = st(id);
        b.classList.toggle("on", store.state[id].on);
      });
      $("#ph-tank", el).textContent = `${Math.round(env.tank)}%`;
      $("#ph-tank-bar", el).style.width = `${env.tank}%`;

      expiring = expiring.filter((x) => {
        if (!x.expired()) return true;
        if (x.acts.querySelector("button")) x.acts.innerHTML = `<span class="ph-done">Sudah dijawab</span>`;
        return false;
      });

      const active = !!home.call;
      call.hidden = !active;
      if (active) {
        // Panggilan masuk selalu dimunculkan, walau HP sedang disembunyikan
        if (el.hidden) setVisible(true);
        if (el.classList.contains("collapsed")) setOpen(true);
        $("#ph-call-from", el).textContent = home.call!.from;
        if (!camAttached) { world.attachDoorCam(cam); camAttached = true; }
      }
    }
  };
}
