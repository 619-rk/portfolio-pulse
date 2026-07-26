// Pages Function: GET /api/stars
//
// Milestone 3 — no KV yet. Returns a hardcoded seed list of famous cities so the
// starfield stops being random and starts being "places on Earth." Also echoes
// Cloudflare's geo data for the visitor from `request.cf` — this is free and
// requires no external API.
//
// Docs: https://developers.cloudflare.com/pages/functions/

const SEED_CITIES = [
  { id: "seed-1",  city: "Bengaluru",    country: "IN", lat: 12.97, lon: 77.59 },
  { id: "seed-2",  city: "Tokyo",        country: "JP", lat: 35.68, lon: 139.69 },
  { id: "seed-3",  city: "Reykjavik",    country: "IS", lat: 64.14, lon: -21.94 },
  { id: "seed-4",  city: "Cape Town",    country: "ZA", lat: -33.92, lon: 18.42 },
  { id: "seed-5",  city: "Sao Paulo",    country: "BR", lat: -23.55, lon: -46.63 },
  { id: "seed-6",  city: "San Francisco",country: "US", lat: 37.77, lon: -122.42 },
  { id: "seed-7",  city: "London",       country: "GB", lat: 51.51, lon: -0.13 },
  { id: "seed-8",  city: "Sydney",       country: "AU", lat: -33.87, lon: 151.21 },
  { id: "seed-9",  city: "Dubai",        country: "AE", lat: 25.20, lon: 55.27 },
  { id: "seed-10", city: "Berlin",       country: "DE", lat: 52.52, lon: 13.40 },
  { id: "seed-11", city: "Singapore",    country: "SG", lat: 1.35,  lon: 103.82 },
  { id: "seed-12", city: "Buenos Aires", country: "AR", lat: -34.60, lon: -58.38 },
  { id: "seed-13", city: "Toronto",      country: "CA", lat: 43.65, lon: -79.38 },
  { id: "seed-14", city: "Cairo",        country: "EG", lat: 30.04, lon: 31.24 },
  { id: "seed-15", city: "Moscow",       country: "RU", lat: 55.75, lon: 37.62 },
  { id: "seed-16", city: "Delhi",        country: "IN", lat: 28.61, lon: 77.21 },
  { id: "seed-17", city: "Mumbai",       country: "IN", lat: 19.08, lon: 72.88 },
  { id: "seed-18", city: "New York",     country: "US", lat: 40.71, lon: -74.01 },
  { id: "seed-19", city: "Paris",        country: "FR", lat: 48.86, lon: 2.35 },
  { id: "seed-20", city: "Nairobi",      country: "KE", lat: -1.29, lon: 36.82 },
];

/**
 * @typedef {Object} Env
 * (KV bindings arrive in M4)
 */

export async function onRequestGet({ request }) {
  const cf = request.cf || {};

  // `you` — the visitor's own geo, from Cloudflare's edge.
  const you = {
    city: cf.city || null,
    country: cf.country || null,
    lat: cf.latitude ? Number(cf.latitude) : null,
    lon: cf.longitude ? Number(cf.longitude) : null,
    colo: cf.colo || null,          // 3-letter edge datacenter code (e.g. "BLR")
    timezone: cf.timezone || null,
  };

  return json({
    stars: SEED_CITIES,
    you,
    total: SEED_CITIES.length,
  });
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Short cache so the API is snappy but doesn't stale during dev.
      "cache-control": "public, max-age=30",
      ...(init.headers || {}),
    },
  });
}
