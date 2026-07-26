// HUD helpers + tooltip control.

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

const tip = () => document.getElementById("tooltip");

export function showTooltip(star, clientX, clientY) {
  const el = tip();
  if (!el) return;
  const country = star.country ? `, ${star.country}` : "";
  const when = relativeTime(star.ts);
  el.textContent = `${star.city || "somewhere"}${country} · ${when}`;
  el.style.left = `${clientX}px`;
  el.style.top = `${clientY}px`;
  el.classList.remove("hidden");
}

export function hideTooltip() {
  const el = tip();
  if (el) el.classList.add("hidden");
}

function relativeTime(ts) {
  if (!ts) return "seed city";
  const nowS = Math.floor(Date.now() / 1000);
  const s = Math.max(0, nowS - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
