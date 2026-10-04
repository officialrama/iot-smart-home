import "@fontsource/carlito/latin-400.css";
import "@fontsource/carlito/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "./styles.css";

import { SimClock, fmt, hm } from "./core/clock";
import { DeviceStore } from "./core/devices";
import { Bus, Tasks } from "./core/events";
import { Home } from "./core/home";
import { createWorld } from "./scene/world";
import { createPanel } from "./ui/panel";
import { createPhone } from "./ui/phone";
import { createStageUi } from "./ui/stage";

// Mulai pukul 05.50 saat rumah masih dalam Mode Tidur, sebentar lagi rutinitas "Bangun" berjalan.
const clock = new SimClock(hm(5, 50));
const store = new DeviceStore(["cctv", "alarm", "katupAir"]);
const bus = new Bus(() => fmt(clock.minuteOfDay));
const tasks = new Tasks();

let home: Home | null = null;
const world = createWorld(document.getElementById("stage")!, {
  store,
  clock,
  env: () => home!.env,
  callActive: () => !!home?.call
});
home = new Home(store, clock, bus, tasks, world.actors, world.fx);

const stageUi = createStageUi(home, world);
const panel = createPanel(home, stageUi.setView);
const phone = createPhone(home, world);

let uiTimer = 0;
world.onFrame((dt) => {
  tasks.tick(dt);
  const [prev, now] = clock.advance(dt);
  home!.update(dt, prev, now);
  uiTimer -= dt;
  if (uiTimer <= 0) {
    uiTimer = 0.2;
    panel.refresh();
    stageUi.refresh();
    phone.refresh();
  }
});

bus.log("home/hub/status", "ONLINE");
document.getElementById("loading")!.classList.add("done");
