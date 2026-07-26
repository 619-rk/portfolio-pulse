// Pages Function: /api/messages
//
// GET  /api/messages?city=Warsaw   → { messages: [ { text, ts, country }, ... ] }
// POST /api/messages { text }      → creates a message at the visitor's own city
//                                     (uses request.cf, dedupes per IP per 24h)
//
// KV binding:
//   MESSAGES  — key = normalized city name, value = JSON array (capped at 20 per city).

const MAX_PER_CITY = 20;
const MAX_TEXT_LEN = 140;
const IP_TTL = 24 * 60 * 60;

/* ================================ GET ================================ */

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const city = (url.searchParams.get("city") || "").trim();
  if (!city) return json({ error: "city required" }, { status: 400 });

  const key = cityKey(city);
  const messages = await readMessages(env, key);
  return json({ city, messages });
}

/* ================================ POST =============================== */

export async function onRequestPost({ request, env }) {
  const cf = request.cf || {};
  const visitorCity = cf.city;
  const visitorCountry = cf.country;
  if (!visitorCity) return json({ error: "geo unavailable" }, { status: 400 });

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "invalid json" }, { status: 400 }); }

  const text = (body?.text || "").toString().trim();
  if (!text) return json({ error: "text required" }, { status: 400 });
  if (text.length > MAX_TEXT_LEN) {
    return json({ error: `text too long (max ${MAX_TEXT_LEN})` }, { status: 400 });
  }

  // Same 24h IP dedupe key as the /api/stars endpoint, but with a separate namespace-prefix
  // so posting a message doesn't block you from creating a star (they're independent quotas).
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const dedupeKey = "msg:" + await sha256(ip);
  const already = await env.MESSAGES.get(dedupeKey);
  if (already) {
    const key = cityKey(visitorCity);
    return json({
      messages: await readMessages(env, key),
      city: visitorCity,
      created: false,
    });
  }

  const msg = {
    text,
    ts: Math.floor(Date.now() / 1000),
    country: visitorCountry || null,
  };
  const key = cityKey(visitorCity);
  const existing = await readMessages(env, key);
  const next = [...existing, msg].slice(-MAX_PER_CITY);

  await Promise.all([
    env.MESSAGES.put(key, JSON.stringify(next)),
    env.MESSAGES.put(dedupeKey, "1", { expirationTtl: IP_TTL }),
  ]);

  return json({ messages: next, city: visitorCity, created: true });
}

/* =============================== helpers ============================= */

async function readMessages(env, key) {
  const raw = await env.MESSAGES.get(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Normalized key so "New York" and "new york" share a bucket.
function cityKey(city) {
  return "city:" + city.trim().toLowerCase().replace(/\s+/g, "-");
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
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}
