import { fmt } from "../core/clock";
import { DEVICES, type DeviceId, type Room } from "../core/devices";
import { GROUP_INFO, PULANG_STEPS, type Home, type Mode, type RuleGroup } from "../core/home";
import type { View } from "../scene/world";
import { DEVICE_ICONS, RULE_ICONS } from "./icons";

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export const MODE_LABEL: Record<Mode, string> = { normal: "Di rumah", pergi: "Pergi", tidur: "Tidur", liburan: "Liburan" };

const ROOM_GROUPS: { title: string; rooms: Room[] }[] = [
  { title: "Ruang tamu", rooms: ["ruang-tamu"] },
  { title: "Lorong, kamar mandi & kamar", rooms: ["lorong", "kamar-mandi", "kamar"] },
  { title: "Garasi & teras", rooms: ["garasi", "teras"] },
  { title: "Halaman", rooms: ["halaman"] },
  { title: "Utilitas & keamanan", rooms: ["utilitas"] }
];

/** Sudut kamera yang paling pas untuk menonton tiap uji aturan. */
const RULE_VIEW: Record<string, View> = {
  gerbangHp: "halaman", tamuGerbang: "halaman", tutupSendiri: "halaman", gerbangKecil: "halaman", lupaMenutup: "halaman",
  lampuTeras: "rumah", siramTaman: "halaman", lampuMalam: "belakang", acHemat: "rumah", airHangat: "belakang",
  pompaPintar: "samping", modeNonton: "rumah", jemuran: "samping", adaYangMasuk: "halaman", gas: "belakang",
  bocorAir: "belakang", anakPulang: "halaman", liburan: "rumah", listrikBoros: "rumah"
};

export function createPanel(home: Home, setView: (v: View) => void): { refresh(): void } {
  const { store, env } = home;

  // ---------- Tab ----------
  const tabs = ["kendali", "otomasi", "log"];
  for (const t of tabs) {
    $(`#tab-${t}`).addEventListener("click", () => {
      for (const o of tabs) {
        $(`#tab-${o}`).setAttribute("aria-selected", String(o === t));
        $(`#pane-${o}`).hidden = o !== t;
      }
    });
  }

  // ---------- Kendali ----------
  const kendali = $("#pane-kendali");
  kendali.innerHTML = `
    <div class="sec">
      <p class="eyebrow">Sensor</p>
      <div class="sensors">
        <div class="sensor"><div class="k">Suhu ruang tamu</div><div class="v"><span id="s-temp">27,0</span><small>°C</small></div></div>
        <div class="sensor"><div class="k">Daya listrik</div><div class="v"><span id="s-power">0</span><small>W</small></div></div>
        <div class="sensor"><div class="k">Tandon air</div><div class="v"><span id="s-tank">72</span><small>%</small></div><div class="bar"><i id="s-tank-bar"></i></div></div>
        <div class="sensor"><div class="k">Air water heater</div><div class="v"><span id="s-heater">28</span><small>°C</small></div></div>
      </div>
    </div>
    <div class="sec">
      <p class="eyebrow">Mode satu sentuhan</p>
      <div class="modes">
        <button class="mode" data-mode="pulang">Pulang</button>
        <button class="mode" data-mode="pergi">Mode Pergi</button>
        <button class="mode" data-mode="tidur">Mode Tidur</button>
        <button class="mode" data-mode="nonton">Mode Nonton</button>
        <button class="mode" data-mode="liburan" aria-pressed="false">Mode Liburan</button>
        <button class="mode" data-mode="mati">Matikan semua</button>
      </div>
    </div>
    <div class="sec"><p class="eyebrow">Perangkat</p><div id="dev-groups"></div></div>`;

  kendali.querySelectorAll<HTMLButtonElement>(".mode").forEach((b) => b.addEventListener("click", () => {
    switch (b.dataset.mode) {
      case "pulang": home.pulang("tombol"); break;
      case "pergi": home.pergi(true); break;
      case "tidur": home.tidur(); break;
      case "nonton": home.nonton(); break;
      case "liburan": home.liburan(env.mode !== "liburan"); break;
      case "mati": home.allOff(); break;
    }
  }));

  const groupsEl = $("#dev-groups");
  const buttons = {} as Record<DeviceId, HTMLButtonElement>;
  for (const g of ROOM_GROUPS) {
    const list = DEVICES.filter((d) => g.rooms.includes(d.room));
    const wrap = document.createElement("div");
    wrap.className = "dev-group";
    wrap.innerHTML = `<p class="sub">${g.title}</p><div class="devices"></div>`;
    const grid = $(".devices", wrap);
    for (const d of list) {
      const b = document.createElement("button");
      b.className = "dev" + (d.cool ? " cool" : "") + (d.alert ? " hot" : "");
      b.id = "dev-" + d.id;
      b.innerHTML = `<span class="ic">${DEVICE_ICONS[d.icon]}</span><span class="n">${esc(d.name)}</span><span class="s"></span>`;
      b.addEventListener("click", () => store.toggle(d.id, "app"));
      grid.appendChild(b);
      buttons[d.id] = b;
    }
    groupsEl.appendChild(wrap);
  }

  // ---------- Otomasi ----------
  const otomasi = $("#pane-otomasi");
  otomasi.innerHTML = `
    <div class="flowcard">
      <p class="eyebrow">Contoh penerapan</p>
      <h2>Skenario pulang ke rumah</h2>
      <ol class="mini-flow">
        ${PULANG_STEPS.map((s, i) => `<li data-step="${i}"><span class="no">${i === 0 ? "Pemicu" : String(i).padStart(2, "0")}</span><b>${esc(s.title)}</b><span>${esc(s.desc)}</span></li>`).join("")}
      </ol>
      <div class="flow-actions">
        <button class="btn primary" id="run-geo">Simulasikan perjalanan pulang</button>
        <button class="btn" id="run-pulang">Tekan tombol "Pulang"</button>
      </div>
    </div>
    <div class="sec day">
      <p class="eyebrow">Satu hari bersama sistem</p>
      <h2>Rumah yang menyesuaikan diri dengan ritme Anda</h2>
      <ol class="day-list">
        ${home.daily.map((d, i) => `<li><button class="day-btn" data-i="${i}"><span class="t">${fmt(d.at)}</span><b>${esc(d.title)}</b><span class="d">${esc(d.desc)}</span></button></li>`).join("")}
      </ol>
    </div>
    ${(Object.keys(GROUP_INFO) as RuleGroup[]).map((g) => `
      <div class="sec">
        <p class="eyebrow">${esc(GROUP_INFO[g].eyebrow)}</p>
        <h2>${esc(GROUP_INFO[g].title)}</h2>
        <div class="rules" id="rules-${g}"></div>
      </div>`).join("")}`;

  $("#run-geo").addEventListener("click", () => { setView("halaman"); home.perjalananPulang(); });
  $("#run-pulang").addEventListener("click", () => { setView("halaman"); home.pulang("tombol"); });
  otomasi.querySelectorAll<HTMLButtonElement>(".day-btn").forEach((b) => b.addEventListener("click", () => {
    const item = home.daily[Number(b.dataset.i)];
    home.clock.jumpTo(item.at);
    item.run();
  }));

  const ruleEls: Record<string, HTMLElement> = {};
  for (const r of home.rules) {
    const card = document.createElement("article");
    card.className = "rule";
    card.id = "rule-" + r.id;
    card.innerHTML = `
      <div class="rule-h">
        <span class="ri">${RULE_ICONS[r.icon]}</span>
        <h3>${esc(r.title)}</h3>
        <label class="switch" title="Aktifkan aturan"><input type="checkbox" id="en-${r.id}" checked><span></span></label>
      </div>
      <p><b>Saat</b> ${esc(r.saat)}</p>
      <p><b>Maka</b> ${esc(r.maka)}</p>
      ${r.id === "listrikBoros" ? `<label class="limit">Batas <input type="number" id="power-limit" min="500" max="10000" step="100" value="${env.powerLimit}"> W</label>` : ""}
      <div class="rule-f"></div>`;
    const foot = $(".rule-f", card);
    for (const t of r.tests) {
      const b = document.createElement("button");
      b.className = "btn small";
      b.textContent = t.label;
      b.addEventListener("click", () => { setView(RULE_VIEW[r.id] ?? "rumah"); t.run(); });
      foot.appendChild(b);
    }
    const last = document.createElement("span");
    last.className = "last";
    foot.appendChild(last);
    $<HTMLInputElement>(`#en-${r.id}`, card).addEventListener("change", (e) => {
      home.enabled[r.id] = (e.target as HTMLInputElement).checked;
      card.classList.toggle("off", !home.enabled[r.id]);
    });
    $(`#rules-${r.group}`, otomasi).appendChild(card);
    ruleEls[r.id] = card;
  }
  $<HTMLInputElement>("#power-limit").addEventListener("change", (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    if (v >= 500) env.powerLimit = v;
  });

  home.onFire = (id) => {
    const el = ruleEls[id];
    if (!el) return;
    el.classList.remove("fired");
    void el.offsetWidth; // ulang animasi
    el.classList.add("fired");
  };

  // ---------- Log MQTT ----------
  const logEl = $("#log");
  home.bus.onLog((topic, payload, on) => {
    const row = document.createElement("div");
    row.innerHTML = `<span class="t"></span><span class="tp"></span><span class="p${on ? "" : " off"}"></span>`;
    (row.children[0] as HTMLElement).textContent = fmt(home.clock.minuteOfDay);
    (row.children[1] as HTMLElement).textContent = topic;
    (row.children[2] as HTMLElement).textContent = payload;
    logEl.prepend(row);
    while (logEl.children.length > 120) logEl.lastElementChild!.remove();
  });

  // ---------- Refresh ----------
  const set = (sel: string, text: string) => { const el = $(sel); if (el.textContent !== text) el.textContent = text; };
  const liburanBtn = $(`.mode[data-mode="liburan"]`, kendali);
  return {
    refresh() {
      for (const d of DEVICES) {
        const s = store.state[d.id];
        const b = buttons[d.id];
        b.setAttribute("aria-pressed", String(s.on));
        const label = s.on ? (d.icon === "lamp" && s.level < 0.9 ? "Redup" : d.onLabel) : d.offLabel;
        const sEl = $(".s", b);
        if (sEl.textContent !== label) sEl.textContent = label;
      }
      set("#s-temp", env.tempLiving.toFixed(1).replace(".", ","));
      set("#s-power", env.power.toLocaleString("id-ID"));
      set("#s-tank", String(Math.round(env.tank)));
      set("#s-heater", String(Math.round(env.heaterTemp)));
      $("#s-tank-bar").style.width = `${env.tank}%`;
      $("#s-power").parentElement!.classList.toggle("warn", env.power > env.powerLimit);
      liburanBtn.setAttribute("aria-pressed", String(env.mode === "liburan"));
      for (const r of home.rules) {
        const t = home.lastFired[r.id];
        const el = $(".last", ruleEls[r.id]);
        const txt = t ? `Terakhir berjalan ${t}` : "";
        if (el.textContent !== txt) el.textContent = txt;
      }
      otomasi.querySelectorAll<HTMLElement>(".mini-flow li").forEach((li) => {
        const i = Number(li.dataset.step);
        li.classList.toggle("active", home.pulangStep === i);
        li.classList.toggle("done", home.pulangStep > i);
      });
    }
  };
}
