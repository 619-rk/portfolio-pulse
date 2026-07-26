// Constellation — entry point.
// Milestone 3: fetch /api/stars for seed data + visitor geo from Cloudflare.

import { createScene } from "./scene.js";
import { createStarfield } from "./stars.js";
import { initHud, setCount, setLocation, setColo } from "./hud.js";

const canvas = document.getElementById("scene");
const { scene, camera, renderer, onResize, onPointerMove } = createScene(canvas);

initHud({ visitorCount: "—", city: "locating…", colo: "—" });

// Kick off the API fetch immediately; the scene renders as soon as we have data.
bootstrap();

async function bootstrap() {
  let payload;
  try {
    const res = await fetch("/api/stars", { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    console.error("Failed to load /api/stars — falling back to local seed.", err);
    payload = { stars: fallbackSeed(80), you: {}, total: 80 };
  }

  const stars = createStarfield(payload.stars);
  scene.add(stars.mesh);

  setCount(payload.total ?? payload.stars.length);
  setLocation(
    payload.you?.city
      ? `${payload.you.city.toLowerCase()}, ${payload.you.country ?? ""}`.trim()
      : "unknown"
  );
  setColo(payload.you?.colo ?? "—");

  startLoop(stars);
}

function startLoop(stars) {
  const start = performance.now();
  function tick() {
    const t = (performance.now() - start) / 1000;
    stars.update(t);
    scene.rotation.y = t * 0.02;
    scene.rotation.x = Math.sin(t * 0.05) * 0.05;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);

// Only used if the API is unreachable (e.g. `python3 -m http.server` local preview).
function fallbackSeed(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const lat = 90 - (phi * 180) / Math.PI;
    const lon = ((theta * 180) / Math.PI) % 360 - 180;
    out.push({ id: `f-${i}`, lat, lon });
  }
  return out;
}
