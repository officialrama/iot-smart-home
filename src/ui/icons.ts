import type { IconName } from "../core/devices";
import type { RuleIcon } from "../core/home";

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const DEVICE_ICONS: Record<IconName, string> = {
  ac: svg('<rect x="3" y="5" width="18" height="7" rx="2"/><path d="M7 15c0 2-1 3-1 4M12 15v5M17 15c0 2 1 3 1 4"/>'),
  lamp: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  tv: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>'),
  fan: svg('<circle cx="12" cy="12" r="1.5"/><path d="M12 10.5C12 6 14 3 16 4s0 5-4 6.5M13.5 12c4.5 0 7.5 2 6.5 4s-5 0-6.5-4M10.5 12.5C8 16 5 18 4 16s2-4 6.5-3.5"/>'),
  door: svg('<path d="M5 21h14M7 21V4h10v17"/><circle cx="14" cy="12.5" r=".8" fill="currentColor"/>'),
  gate: svg('<path d="M3 20V8M21 20V8M3 10h18M3 18h18M7 10v8M11 10v8M15 10v8M19 10v8"/>'),
  garage: svg('<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8M7 16h10"/>'),
  cctv: svg('<path d="M4 7l13 4-2 5L3 11z"/><path d="M15 15l3 1M18 13v7M18 20h3"/>'),
  water: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  post: svg('<path d="M12 9v12M9 21h6M8 4h8l-1 5H9z"/>'),
  curtain: svg('<path d="M3 4h18M5 4v16c2-2 3-6 3-16M19 4v16c-2-2-3-6-3-16"/>'),
  heater: svg('<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M10 15c0-2 2-2 2-4M13 15c0-2 2-2 2-4"/>'),
  pump: svg('<rect x="3" y="11" width="10" height="8" rx="1.5"/><circle cx="8" cy="15" r="2"/><path d="M13 14h4V5h4"/>'),
  valve: svg('<circle cx="12" cy="8" r="4"/><path d="M12 4v8M8 8h8M12 12v4M3 16h18v4H3z"/>'),
  roof: svg('<path d="M2 10l10-5 10 5"/><path d="M5 10v9M19 10v9M5 14h14"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  siren: svg('<path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 18h14v3H5zM12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>')
};

export const RULE_ICONS: Record<RuleIcon, string> = {
  key: svg('<circle cx="8" cy="7" r="3"/><path d="M9.5 9.5L16 20M13 15l2-1M14.5 17.5l2-1"/>'),
  chat: svg('<path d="M4 18l1.5-3.5A8 8 0 1 1 9 19z"/><path d="M8 13l2.5-2.5 2 2L16 9"/>'),
  lock: svg('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/>'),
  warn: svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cloud: svg('<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  play: svg('<path d="M7 4l13 8-13 8z"/>'),
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  chart: svg('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M7 15l3-3 3 2 4-5M3 9h18"/>'),
  wrench: svg('<path d="M15 4a4 4 0 0 0-4.5 5.5L4 16l2 2 2 2 6.5-6.5A4 4 0 0 0 20 9l-3 1-2-2 1-3z"/>'),
  people: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M15 15c3 0 6 1 6 4"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>')
};

export const UI_ICONS = {
  play: svg('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  pause: svg('<path d="M7 4v16M17 4v16" stroke-width="3"/>'),
  phone: svg('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  expand: svg('<path d="M6 15l6-6 6 6"/>'),
  arrow: svg('<path d="M4 12h15M14 6l6 6-6 6"/>')
};
