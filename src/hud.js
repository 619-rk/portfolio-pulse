// HUD + tooltip + info panel controls.

let visitorCityCache = null; // set from main.js; used to enable the composer

export function initHud({ visitorCount, places, city, colo }) {
  setCount(visitorCount);
  setPlaces(places);
  setLocation(city);
  setColo(colo);
}

/** Called from main.js once we know the visitor's canonical city (from /api/stars). */
export function setVisitorCity(city) {
  visitorCityCache = city ? city.trim().toLowerCase() : null;
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
let currentMsgController  = null;
let currentStar = null;   // the star the panel is currently showing

export function showInfo(star) {
  const panel = document.getElementById("info");
  const cityEl = document.getElementById("info-city");
  const subEl  = document.getElementById("info-sub");
  const bodyEl = document.getElementById("info-body");
  const linkEl = document.getElementById("info-link");
  const heroEl = document.getElementById("info-hero");
  const msgsEl = document.getElementById("info-messages");
  const composer = document.getElementById("info-composer");
  const composerHint = document.getElementById("info-composer-hint");
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

  // Composer visibility — only for the visitor's own city.
  const isMyCity = visitorCityCache
    && star.city
    && star.city.trim().toLowerCase() === visitorCityCache;
  if (composer) {
    composer.hidden = !isMyCity;
    if (composerHint) {
      composerHint.textContent = isMyCity ? "140 chars · one per 24h" : "";
    }
  }

  // Fact fetch
  if (currentFactController) currentFactController.abort();
  currentFactController = new AbortController();
  fetchFact(star.city, currentFactController.signal)
    .then((fact) => {
      if (currentStar !== star) return; // panel changed under us
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
    .catch((err) => {
      if (err.name === "AbortError") return;
      bodyEl.innerHTML = `<em>Couldn't load a fact right now.</em>`;
    });

  // Messages fetch
  if (currentMsgController) currentMsgController.abort();
  currentMsgController = new AbortController();
  fetchMessages(star.city, currentMsgController.signal)
    .then((messages) => {
      if (currentStar !== star) return;
      renderMessages(messages);
    })
    .catch((err) => {
      if (err.name === "AbortError") return;
      // Silent on messages — they're a bonus.
    });
}

function renderMessages(messages) {
  const msgsEl = document.getElementById("info-messages");
  if (!msgsEl) return;
  if (!messages || messages.length === 0) {
    msgsEl.innerHTML = `<div class="empty">be the first to say hello</div>`;
    return;
  }
  const html = messages
    .slice()
    .reverse()
    .map((m) => `
      <div class="msg">
        ${escapeHtml(m.text)}
        <span class="when">${relativeTime(m.ts)}</span>
      </div>
    `)
    .join("");
  msgsEl.innerHTML = html;
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

/* -------------------------- composer wiring -------------------------- */

const composerForm = document.getElementById("info-composer");
if (composerForm) {
  composerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textEl = document.getElementById("info-composer-text");
    const btn    = document.getElementById("info-composer-send");
    const hint   = document.getElementById("info-composer-hint");
    const text = (textEl.value || "").trim();
    if (!text) return;

    btn.disabled = true;
    const originalHint = hint.textContent;
    hint.textContent = "posting…";

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        hint.textContent = data.error || "error";
        setTimeout(() => (hint.textContent = originalHint), 2500);
        return;
      }
      textEl.value = "";
      renderMessages(data.messages || []);
      hint.textContent = data.created === false ? "already posted today" : "posted ✓";
      setTimeout(() => (hint.textContent = originalHint), 2500);
    } catch (err) {
      hint.textContent = "network error";
      setTimeout(() => (hint.textContent = originalHint), 2500);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ------------------------------ helpers ------------------------------ */

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
