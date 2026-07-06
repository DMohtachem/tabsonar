// Shared SVG icon set — 1.5px stroke, round caps, 24-grid. Sized via CSS (width/height on .ico).
// Usage: icon("close") -> "<svg ...>...</svg>". Colors inherit currentColor.
const P = {
  search: `<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`,
  mic: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  arrow: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  lock: `<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>`,
  pin: `<path d="M9 4h6M10 4l-1 7-3 2v2h12v-2l-3-2-1-7M12 17v3"/>`,
  speaker: `<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8a5 5 0 010 8M19 5a9 9 0 010 14"/>`,
  speakerMute: `<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6"/>`,
  stack: `<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>`,
  snowflake: `<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9M12 6l-3 2 3 2 3-2-3-2M12 18l-3-2 3-2 3 2-3 2"/>`,
  moon: `<path d="M20 14.5a8 8 0 11-9.3-11 6.5 6.5 0 009.3 11z"/>`,
  chevronLeft: `<path d="M15 6l-6 6 6 6"/>`,
  undo: `<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>`,
  radar: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-4"/><circle cx="18" cy="8" r="1.3" fill="currentColor" stroke="none"/>`,
  check: `<path d="M4 12l5 5L20 6"/>`,
};
export function icon(name, cls = "ico") {
  const body = P[name] || "";
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
export const ICONS = P;
