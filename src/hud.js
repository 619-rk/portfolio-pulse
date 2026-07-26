// HUD — the top-left overlay panel.
// Milestone 2 shows placeholders; M3 fills these from the API.

export function initHud({ visitorCount, city, colo }) {
  setCount(visitorCount);
  setLocation(city);
  setColo(colo);
}

export function setCount(n) {
  const el = document.getElementById("visitor-count");
  if (el) el.textContent = String(n);
}

export function setLocation(city) {
  const el = document.getElementById("visitor-loc");
  if (el) el.textContent = city ?? "—";
}

export function setColo(colo) {
  const el = document.getElementById("edge-colo");
  if (el) el.textContent = colo ?? "—";
}

// Reserved for M5 — click a star, HUD flashes a tag.
export function flash(msg) {
  console.log("[hud]", msg);
}
