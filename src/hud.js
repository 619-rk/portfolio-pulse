// HUD + tooltip + star-info panel + global "leave a message" modal.

let visitorCityCache = null;

export function initHud({ visitorCount, places, city, colo }) {
  setCount(visitorCount);
  setPlaces(places);
  setLocation(city);
  setColo(colo);
}

/** Called from main.js once we know the visitor's canonical city. */
export function setVisitorCity(city) {
  visitorCityCache = city || null;
  const cityLabel = document.getElementById("composer-city");
  if (cityLabel) cityLabel.textContent = city ? city.toLowerCase() : "your city";
  // Do NOT disable the button — button always works; server enforces geo.
  const btn = document.getElementById("hud-compose");
  if (btn) btn.disabled = false;
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

/* ------------------ info panel (Wikipedia + messages) ---------------- */

let currentFactController = null;
let currentMsgController  = null;
let currentStar = null;

export function showInfo(star) {
  const panel = document.getElementById("info");
  const cityEl = document.getElementById("info-city");
  const subEl  = document.getElementById("info-sub");
  const bodyEl = document.getElementById("info-body");
  const linkEl = document.getElementById("info-link");
  const heroEl = document.getElementById("info-hero");
  const msgsEl = document.getElementById("info-messages");
  if (!panel) return;

  currentStar = star;

  cityEl.textContent = star.city || "Somewhere";
  const parts = [];
  if (star.country) parts.push(countryName(star.country));
  parts.push(star.ts ? relativeTime(star.ts) : "seed city");
  parts.push(`${star.lat.toFixed(2)}°, ${star.lon.toFixed(2)}°`);
  subEl.textContent = parts.join(" · ");

  bodyEl.innerHTML = `<div class="loading">reading up…</div>`;
  linkEl.hidden = true;
  msgsEl.innerHTML = "";
  if (heroEl) {
    heroEl.style.backgroundImage = "";
    heroEl.classList.add("empty");
  }

  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");

  if (currentFactController) currentFactController.abort();
  currentFactController = new AbortController();
  fetchFact(star.city, currentFactController.signal)
    .then((fact) => {
      if (currentStar !== star) return;
      if (!fact) {
        bodyEl.innerHTML = `<em>No entry found for this place.</em>`;
        return;
      }
      bodyEl.textContent = fact.extract;
      if (fact.url) {
        linkEl.href = fact.url;
        linkEl.hidden = false;
      }
      if (fact.image && heroEl) {
        heroEl.style.backgroundImage = `url("${fact.image}")`;
        heroEl.classList.remove("empty");
      }
    })
    .catch((err) => { if (err.name !== "AbortError") bodyEl.innerHTML = `<em>Couldn't load a fact right now.</em>`; });

  if (currentMsgController) currentMsgController.abort();
  currentMsgController = new AbortController();
  fetchMessages(star.city, currentMsgController.signal)
    .then((messages) => {
      if (currentStar !== star) return;
      renderMessages(messages);
    })
    .catch(() => {/* silent */});
}

function renderMessages(messages) {
  const msgsEl = document.getElementById("info-messages");
  if (!msgsEl) return;
  if (!messages || messages.length === 0) {
    msgsEl.innerHTML = `<div class="empty">no messages from here yet</div>`;
    return;
  }
  msgsEl.innerHTML = messages.slice().reverse().map((m) => `
    <div class="msg">
      ${escapeHtml(m.text)}
      <span class="when">${relativeTime(m.ts)}</span>
    </div>
  `).join("");
}

export function hideInfo() {
  const panel = document.getElementById("info");
  if (!panel) return;
  panel.classList.add("hidden");
  panel.setAttribute("aria-hidden", "true");
  if (currentFactController) currentFactController.abort();
  if (currentMsgController)  currentMsgController.abort();
  currentStar = null;
}

document.getElementById("info-close")?.addEventListener("click", hideInfo);

/* -------------------- global composer modal wiring ------------------- */

const modal      = document.getElementById("composer-modal");
const modalText  = document.getElementById("composer-text");
const modalSend  = document.getElementById("composer-send");
const modalHint  = document.getElementById("composer-hint");
const modalClose = document.getElementById("composer-close");
const openBtn    = document.getElementById("hud-compose");

function openComposer() {
  if (!modal) return;
  // If we don't know the visitor's city yet (bootstrap still fetching), keep the
  // button enabled anyway — the server will still identify them by IP on POST.
  const cityLabel = document.getElementById("composer-city");
  if (cityLabel && !cityLabel.textContent.trim()) {
    cityLabel.textContent = visitorCityCache ? visitorCityCache.toLowerCase() : "your city";
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => modalText?.focus(), 50);
}
function closeComposer() {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

openBtn?.addEventListener("click", (e) => {
  console.log("[composer] button clicked", { modal, visitorCityCache });
  e.stopPropagation();
  openComposer();
});
modalClose?.addEventListener("click", closeComposer);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeComposer(); });
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeComposer(); hideInfo(); }
});

modalSend?.addEventListener("click", async () => {
  const text = (modalText.value || "").trim();
  if (!text) return;
  modalSend.disabled = true;
  const original = modalHint.textContent;
  modalHint.textContent = "posting…";
  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      modalHint.textContent = data.error || "error";
      return;
    }
    modalText.value = "";
    modalHint.textContent = data.created === false ? "already posted today" : "posted ✓";
    // If the info panel happens to be showing this same city, refresh its messages.
    if (currentStar && currentStar.city && currentStar.city.toLowerCase() === (data.city || "").toLowerCase()) {
      renderMessages(data.messages || []);
    }
    setTimeout(closeComposer, 900);
  } catch {
    modalHint.textContent = "network error";
  } finally {
    modalSend.disabled = false;
    setTimeout(() => { modalHint.textContent = original; }, 3000);
  }
});

/* ------------------------------ fetchers ----------------------------- */

async function fetchFact(city, signal) {
  if (!city) return null;
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

async function fetchMessages(city, signal) {
  if (!city) return [];
  const res = await fetch(`/api/messages?city=${encodeURIComponent(city)}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

/* ------------------------------- helpers ---------------------------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

const COUNTRIES = {
  IN: "India", US: "United States", GB: "United Kingdom", DE: "Germany",
  FR: "France", JP: "Japan", CN: "China", BR: "Brazil", AU: "Australia",
  CA: "Canada", ZA: "South Africa", RU: "Russia", SG: "Singapore", AE: "UAE",
  EG: "Egypt", KE: "Kenya", IS: "Iceland", PL: "Poland", AR: "Argentina",
};
function countryName(code) { return COUNTRIES[code] || code; }
