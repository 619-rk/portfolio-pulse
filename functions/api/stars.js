// Pages Function: /api/stars
//
// GET  → return all stars (edge-cached for 60s via the Cache API) plus fresh visitor geo.
// POST → add the visitor's own star (once per 24h per IP).
//
// KV bindings:
//   STARS       — key "all" holds a JSON array of every visitor star.
//   VISITED_IP  — key = sha256(ip), value = "1", TTL 24h. Dedupe.

const STARS_KEY = "all";
const MAX_STARS = 5000;
const IP_TTL_SECONDS = 24 * 60 * 60;
const EDGE_CACHE_SECONDS = 60;

const SEED_CITIES = [
  { id: "seed-1",  city: "Bengaluru",    country: "IN", lat: 12.97, lon: 77.59, ts: 0, seed: true },
  { id: "seed-2",  city: "Tokyo",        country: "JP", lat: 35.68, lon: 139.69, ts: 0, seed: true },
  { id: "seed-3",  city: "Reykjavik",    country: "IS", lat: 64.14, lon: -21.94, ts: 0, seed: true },
  { id: "seed-4",  city: "Cape Town",    country: "ZA", lat: -33.92, lon: 18.42, ts: 0, seed: true },
  { id: "seed-5",  city: "Sao Paulo",    country: "BR", lat: -23.55, lon: -46.63, ts: 0, seed: true },
  { id: "seed-6",  city: "San Francisco",country: "US", lat: 37.77, lon: -122.42, ts: 0, seed: true },
  { id: "seed-7",  city: "London",       country: "GB", lat: 51.51, lon: -0.13, ts: 0, seed: true },
  { id: "seed-8",  city: "Sydney",       country: "AU", lat: -33.87, lon: 151.21, ts: 0, seed: true },
  { id: "seed-9",  city: "Dubai",        country: "AE", lat: 25.20, lon: 55.27, ts: 0, seed: true },
  { id: "seed-10", city: "Berlin",       country: "DE", lat: 52.52, lon: 13.40, ts: 0, seed: true },
  { id: "seed-11", city: "Singapore",    country: "SG", lat: 1.35,  lon: 103.82, ts: 0, seed: true },
  { id: "seed-12", city: "Buenos Aires", country: "AR", lat: -34.60, lon: -58.38, ts: 0, seed: true },
  { id: "seed-13", city: "Toronto",      country: "CA", lat: 43.65, lon: -79.38, ts: 0, seed: true },
  { id: "seed-14", city: "Cairo",        country: "EG", lat: 30.04, lon: 31.24, ts: 0, seed: true },
  { id: "seed-15", city: "Moscow",       country: "RU", lat: 55.75, lon: 37.62, ts: 0, seed: true },
];

/* ================================ GET ================================ */

export async function onRequestGet({ request, env, waitUntil }) {
  const you = readVisitorGeo(request);

  // Cache only the stars body (not the visitor-specific "you"), so every visitor
  // still sees their own edge datacenter/city while sharing the star list.
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = "/__stars-cache";
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = caches.default;

  let cached = await cache.match(cacheKey);
  let cacheStatus = "MISS";
  let body;

  if (cached) {
    body = await cached.json();
    cacheStatus = "HIT";
  } else {
    const stored = await readStars(env);
    const stars = [...SEED_CITIES, ...stored];
    body = {
      stars,
      total: stars.length,
      real: stored.length,
      seeds: SEED_CITIES.length,
    };
    const cacheResp = new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, s-maxage=${EDGE_CACHE_SECONDS}`,
      },
    });
    waitUntil(cache.put(cacheKey, cacheResp));
  }

  return json({ ...body, you }, {
    headers: {
      // The client shouldn't cache (visitor-specific fields inside), but the edge already did.
      "cache-control": "no-store",
      // Custom header so DevTools can show cache behavior for the traffic-control lesson.
      "x-edge-cache": cacheStatus,
    },
  });
}

/* ================================ POST =============================== */

export async function onRequestPost({ request, env, waitUntil }) {
  const you = readVisitorGeo(request);
  if (!you.city || you.lat == null || you.lon == null) {
    return json({ error: "geo unavailable" }, { status: 400 });
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await sha256(ip);
  const already = await env.VISITED_IP.get(ipHash);

  const existing = await readStars(env);

  if (already) {
    const stars = [...SEED_CITIES, ...existing];
    return json({
      stars, you,
      total: stars.length,
      real: existing.length,
      created: false,
    });
  }

  const star = {
    id: crypto.randomUUID(),
    city: you.city,
    country: you.country,
    lat: you.lat,
    lon: you.lon,
    ts: Math.floor(Date.now() / 1000),
  };

  const next = [...existing, star].slice(-MAX_STARS);

  await Promise.all([
    env.STARS.put(STARS_KEY, JSON.stringify(next)),
    env.VISITED_IP.put(ipHash, "1", { expirationTtl: IP_TTL_SECONDS }),
  ]);

  // Invalidate the GET edge cache so other visitors see the new star quickly.
  waitUntil(invalidateStarsCache(request));

  const stars = [...SEED_CITIES, ...next];
  return json({
    stars, you,
    total: stars.length,
    real: next.length,
    created: true,
    yourStarId: star.id,
  });
}

/* =============================== helpers ============================= */

async function invalidateStarsCache(request) {
  try {
    const url = new URL(request.url);
    url.pathname = "/__stars-cache";
    await caches.default.delete(new Request(url.toString(), { method: "GET" }));
  } catch (_) { /* best-effort */ }
}

async function readStars(env) {
  const raw = await env.STARS.get(STARS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readVisitorGeo(request) {
  const cf = request.cf || {};
  return {
    city: cf.city || null,
    country: cf.country || null,
    lat: cf.latitude ? Number(cf.latitude) : null,
    lon: cf.longitude ? Number(cf.longitude) : null,
    colo: cf.colo || null,
    timezone: cf.timezone || null,
  };
}

async function sha256(input) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}
