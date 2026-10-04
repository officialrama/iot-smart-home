import { MIN_PER_DAY, fmt } from "../core/clock";
import { DEVICE_BY_ID, type DeviceId } from "../core/devices";
import { PULANG_STEPS, type Home } from "../core/home";
import type { View, World } from "../scene/world";
import { UI_ICONS } from "./icons";
import { MODE_LABEL } from "./panel";

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export function createStageUi(home: Home, world: World): { refresh(): void; setView(v: View): void } {
  const { clock, store, env } = home;
  const stage = $("#stage");

  // ---------- Timeline harian (slide "Satu hari bersama sistem") ----------
  const tl = $("#timeline");
  tl.innerHTML = `
    <div class="clock">
      <div class="clock-time"><span id="clk">--.--</span><small id="clk-day">Hari 1</small></div>
      <div class="clock-ctrls">
        <button class="icon-btn" id="clk-play" aria-label="Jeda">${UI_ICONS.pause}</button>
        <div class="seg small" role="group" aria-label="Kecepatan waktu">
          <button data-speed="1" aria-pressed="true" title="1 menit simulasi per detik">1×</button>
          <button data-speed="5" aria-pressed="false" title="5 menit simulasi per detik">5×</button>
          <button data-speed="20" aria-pressed="false" title="20 menit simulasi per detik">20×</button>
        </div>
      </div>
    </div>
    <ol class="tl-items">
      ${home.daily.map((d, i) => `
        <li><button class="tl-item" data-i="${i}" title="${d.desc}">
          <i class="tl-bar"><b></b></i>
          <span class="tl-t">${fmt(d.at)}</span>
          <span class="tl-n">${d.title}</span>
        </button></li>`).join("")}
    </ol>`;
  const playBtn = $<HTMLButtonElement>("#clk-play");
  playBtn.addEventListener("click", () => {
    clock.playing = !clock.playing;
    playBtn.innerHTML = clock.playing ? UI_ICONS.pause : UI_ICONS.play;
    playBtn.setAttribute("aria-label", clock.playing ? "Jeda" : "Jalankan");
  });
  tl.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach((b) => b.addEventListener("click", () => {
    clock.speed = Number(b.dataset.speed);
    tl.querySelectorAll("[data-speed]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  }));
  const items = [...tl.querySelectorAll<HTMLButtonElement>(".tl-item")];
  items.forEach((b) => b.addEventListener("click", () => {
    const item = home.daily[Number(b.dataset.i)];
    clock.jumpTo(item.at);
    item.run();
  }));

  // ---------- Alur pulang (slide "Skenario pulang ke rumah") ----------
  const flow = $("#flow");
  flow.innerHTML = PULANG_STEPS.map((s, i) => `
    ${i ? `<span class="fl-arrow">${UI_ICONS.arrow}</span>` : ""}
    <div class="fl-step${i === 0 ? " trigger" : ""}" data-step="${i}">
      <span class="fl-no">${i === 0 ? "Pemicu" : String(i).padStart(2, "0")}</span>
      <b>${s.title}</b>
    </div>`).join("");
  const flowSteps = [...flow.querySelectorAll<HTMLElement>(".fl-step")];

  // ---------- Cuaca & kamera ----------
  const wxSun = $("#wx-sun"), wxRain = $("#wx-rain");
  wxSun.addEventListener("click", () => home.setRain(false));
  wxRain.addEventListener("click", () => home.setRain(true));
  const setView = (v: View) => {
    world.focus(v);
    stage.querySelectorAll<HTMLElement>("[data-view]").forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.view === v)));
  };
  stage.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view as View)));

  // ---------- Tooltip ----------
  const tip = $("#tip");
  world.onHover((id: DeviceId | null, x, y) => {
    if (!id) { tip.hidden = true; return; }
    const d = home.store.state[id];
    const def = DEVICE_BY_ID[id];
    tip.textContent = `${def.name} · ${d.on ? def.onLabel : def.offLabel}`;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
    tip.hidden = false;
  });

  const modeChip = $("#mode-chip");
  return {
    setView,
    refresh() {
      $("#clk").textContent = fmt(clock.minuteOfDay);
      $("#clk-day").textContent = `Hari ${clock.day}`;
      const m = clock.minuteOfDay;
      items.forEach((b, i) => {
        const at = home.daily[i].at;
        const next = home.daily[i + 1]?.at ?? MIN_PER_DAY;
        const prog = Math.min(1, Math.max(0, (m - at) / (next - at)));
        $("b", $(".tl-bar", b)).style.width = `${prog * 100}%`;
        b.classList.toggle("now", m >= at && m < next);
      });
      modeChip.textContent = `Mode: ${MODE_LABEL[env.mode]}`;
      wxSun.setAttribute("aria-pressed", String(!env.raining));
      wxRain.setAttribute("aria-pressed", String(env.raining));
      stage.classList.toggle("alarm", store.state.sirene.on);
      flow.hidden = home.pulangStep < 0;
      flowSteps.forEach((el, i) => {
        el.classList.toggle("active", home.pulangStep === i);
        el.classList.toggle("done", home.pulangStep > i);
      });
    }
  };
}
