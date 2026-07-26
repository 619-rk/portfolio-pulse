// HUD + tooltip + info panel controls.

export function initHud({ visitorCount, places, city, colo }) {
  setCount(visitorCount);
  setPlaces(places);
  setLocation(city);
  setColo(colo);
}

export function setCount(n) {
  const el = document.getElementById("visitor-count");
  if (el) el.textContent = String(n);
}

export function setPlaces(n) {
  const el = document.getElementById("places-count");
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

/* ------------------------------ tooltip ------------------------------ */

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

/* ----------------------------- info panel ---------------------------- */

let currentFactController = null;

export function showInfo(star) {
  const panel = document.getElementById("info");
  const cityEl = document.getElementById("info-city");
  const subEl  = document.getElementById("info-sub");
  const bodyEl = document.getElementById("info-body");
  const linkEl = document.getElementById("info-link");
  const heroEl = document.getElementById("info-hero");
  if (!panel) return;

  cityEl.textContent = star.city || "Somewhere";
  const parts = [];
  if (star.country) parts.push(countryName(star.country));
  parts.push(star.ts ? relativeTime(star.ts) : "seed city");
  parts.push(`${star.lat.toFixed(2)}°, ${star.lon.toFixed(2)}°`);
  subEl.textContent = parts.join(" · ");

  bodyEl.innerHTML = `<div class="loading">reading up…</div>`;
  linkEl.hidden = true;
  heroEl.style.backgroundImage = "";
  heroEl.classList.add("empty");

  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");

  if (currentFactController) currentFactController.abort();
  currentFactController = new AbortController();
  fetchFact(star.city, currentFactController.signal)
    .then((fact) => {
      if (!fact) {
        bodyEl.innerHTML = `<em>No entry found for this place — try another star.</em>`;
        return;
      }
      bodyEl.textContent = fact.extract;
      if (fact.url) {
        linkEl.href = fact.url;
        linkEl.hidden = false;
      }
      if (fact.image) {
        heroEl.style.backgroundImage = `url("${fact.image}")`;
        heroEl.classList.remove("empty");
      }
    })
    .catch((err) => {
      if (err.name === "AbortError") return;
      bodyEl.innerHTML = `<em>Couldn't load a fact right now.</em>`;
    });
}

export function hideInfo() {
  const panel = document.getElementById("info");
  if (!panel) return;
  panel.classList.add("hidden");
  panel.setAttribute("aria-hidden", "true");
  if (currentFactController) currentFactController.abort();
}

document.getElementById("info-close")?.addEventListener("click", hideInfo);

/* ------------------------------ helpers ------------------------------ */

async function fetchFact(city, signal) {
  if (!city) return null;
  // Wikipedia's REST summary API — free, no key, has CORS.
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city)}`;
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.extract) return null;
  return {
    extract: data.extract,
    url: data.content_urls?.desktop?.page,
    image: data.originalimage?.source || data.thumbnail?.source || null,
  };
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

// Minimal country-code → name map (only the ones we care about; falls back to code).
const COUNTRIES = {
  IN: "India", US: "United States", GB: "United Kingdom", DE: "Germany",
  FR: "France", JP: "Japan", CN: "China", BR: "Brazil", AU: "Australia",
  CA: "Canada", ZA: "South Africa", RU: "Russia", SG: "Singapore", AE: "UAE",
  EG: "Egypt", KE: "Kenya", IS: "Iceland", PL: "Poland", AR: "Argentina",
};
function countryName(code) {
  return COUNTRIES[code] || code;
}
