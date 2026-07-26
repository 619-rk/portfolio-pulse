// Constellation — entry point (M5).

import * as THREE from "three";
import { createScene, pointer } from "./scene.js";
import { createStarfield } from "./stars.js";
import { initHud, setCount, setLocation, setColo, showTooltip, hideTooltip } from "./hud.js";

const canvas = document.getElementById("scene");
const { scene, camera, renderer, onResize, onPointerMove, flyTo, tickCamera } = createScene(canvas);

initHud({ visitorCount: "—", city: "locating…", colo: "—" });

bootstrap();

async function bootstrap() {
  // 1) POST creates our star if new; response includes yourStarId so we can highlight it.
  let payload;
  try {
    const res = await fetch("/api/stars", { method: "POST", headers: { accept: "application/json" } });
    payload = await res.json();
  } catch (err) {
    console.warn("POST failed, falling back to GET.", err);
    try {
      payload = await (await fetch("/api/stars")).json();
    } catch (e2) {
      console.error("GET failed too.", e2);
      payload = { stars: [], you: {}, total: 0 };
    }
  }

  const stars = payload.stars || [];
  const yourId = payload.yourStarId ?? findMyStarId(stars, payload.you);

  // Create the field asynchronously (waits for the land mask to load).
  const field = await createStarfield(stars, yourId);
  scene.add(field.mesh);

  setCount(payload.total ?? stars.length);
  setLocation(
    payload.you?.city
      ? `${payload.you.city.toLowerCase()}, ${payload.you.country ?? ""}`.trim()
      : "unknown"
  );
  setColo(payload.you?.colo ?? "—");

  setupInteraction(field, stars);
  startLoop(field);
}

/* ----------------------- hover + click interaction ----------------------- */

function setupInteraction(field, stars) {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.03;

  let lastHoverIdx = -1;

  function pickIndex() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(field.fg.mesh);
    if (!hits.length) return -1;
    return hits[0].index;
  }

  window.addEventListener("pointermove", (e) => {
    const idx = pickIndex();
    if (idx === -1) {
      if (lastHoverIdx !== -1) hideTooltip();
      lastHoverIdx = -1;
      canvas.style.cursor = "crosshair";
      return;
    }
    canvas.style.cursor = "pointer";
    lastHoverIdx = idx;
    const star = stars[idx];
    if (star) showTooltip(star, e.clientX, e.clientY);
  });

  window.addEventListener("click", () => {
    const idx = pickIndex();
    if (idx === -1) return;
    const star = stars[idx];
    if (!star) return;
    // Compute the star's WORLD-space position (accounting for group rotation).
    const local = new THREE.Vector3().fromBufferAttribute(
      field.fg.geometry.getAttribute("position"),
      idx
    );
    const world = local.clone().applyMatrix4(field.mesh.matrixWorld);
    flyTo(world, 1500);
  });
}

/* ------------------------------- render loop ---------------------------- */

function startLoop(field) {
  const start = performance.now();
  function tick() {
    const t = (performance.now() - start) / 1000;
    field.update(t);
    // Rotation continues underneath, unless we're mid-fly (paused via tickCamera).
    scene.rotation.y = t * 0.02;
    scene.rotation.x = Math.sin(t * 0.05) * 0.05;
    scene.updateMatrixWorld();
    tickCamera();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);

/* --------------------------------- helpers ------------------------------- */

// Fallback for older cache-hit responses that didn't include yourStarId:
// match by city + country + freshest timestamp.
function findMyStarId(stars, you) {
  if (!you?.city) return null;
  const candidates = stars.filter(
    (s) => s.city && s.city.toLowerCase() === you.city.toLowerCase()
             && s.country === you.country
             && s.ts // real, not seed
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.ts - a.ts);
  return candidates[0].id;
}
