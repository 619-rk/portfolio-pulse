// Constellation — entry point.
// Milestone 4: fetch stored stars, then POST our own so a new star appears.

import { createScene } from "./scene.js";
import { createStarfield } from "./stars.js";
import { initHud, setCount, setLocation, setColo } from "./hud.js";

const canvas = document.getElementById("scene");
const { scene, camera, renderer, onResize, onPointerMove } = createScene(canvas);

initHud({ visitorCount: "—", city: "locating…", colo: "—" });

bootstrap();

async function bootstrap() {
  // 1) POST first — creates our star if we haven't been here in 24h,
  //    and returns the full list including the new addition.
  let payload;
  try {
    const res = await fetch("/api/stars", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    console.warn("POST /api/stars failed, falling back to GET.", err);
    try {
      const res = await fetch("/api/stars");
      payload = await res.json();
    } catch (err2) {
      console.error("GET /api/stars also failed — using local seed.", err2);
      payload = { stars: fallbackSeed(80), you: {}, total: 80 };
    }
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

  if (payload.created) {
    console.log("✦ new star created at", payload.you?.city, payload.yourStarId);
  }

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
