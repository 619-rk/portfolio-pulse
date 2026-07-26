// Constellation — entry point.
// M5+: drag-to-rotate, nebula bg, click star → info panel + arcs to neighbors.

import * as THREE from "three";
import { createScene, pointer } from "./scene.js";
import { createStarfield } from "./stars.js";
import { createNebula } from "./nebula.js";
import { createArcLayer } from "./arcs.js";
import {
  initHud, setCount, setPlaces, setLocation, setColo,
  showTooltip, hideTooltip, showInfo, hideInfo,
} from "./hud.js";

const canvas = document.getElementById("scene");
const {
  scene, camera, renderer, world,
  onResize, onPointerMove, onPointerDown, onPointerUp,
  tickWorld,
} = createScene(canvas);

initHud({ visitorCount: "—", places: "—", city: "locating…", colo: "—" });

// Nebula lives directly in the scene (doesn't rotate with the globe).
const nebula = createNebula();
scene.add(nebula.mesh);

bootstrap();

async function bootstrap() {
  let payload;
  try {
    const res = await fetch("/api/stars", { method: "POST" });
    payload = await res.json();
  } catch {
    try { payload = await (await fetch("/api/stars")).json(); }
    catch { payload = { stars: [], you: {}, total: 0 }; }
  }

  const stars = payload.stars || [];
  const yourId = payload.yourStarId ?? findMyStarId(stars, payload.you);

  const field = await createStarfield(stars, yourId);
  world.add(field.mesh);

  // Arcs only make sense between REAL visited cities (not the seed defaults).
  const realStars = stars.filter((s) => s.ts);
  const arcs = createArcLayer(realStars);
  world.add(arcs.mesh);

  const uniquePlaces = new Set(
    realStars.map((s) => `${(s.city || "").toLowerCase()}|${s.country || ""}`)
  ).size;
  setCount(payload.real ?? realStars.length);
  setPlaces(uniquePlaces);
  setLocation(
    payload.you?.city
      ? `${payload.you.city.toLowerCase()}, ${payload.you.country ?? ""}`.trim()
      : "unknown"
  );
  setColo(payload.you?.colo ?? "—");

  setupInteraction(field, stars, arcs, realStars);
  startLoop(field, arcs);
}

function setupInteraction(field, stars, arcs, realStars) {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.04;

  let downX = 0, downY = 0, downTime = 0;

  function pickIndex() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(field.fg.mesh);
    return hits.length ? hits[0].index : -1;
  }

  window.addEventListener("pointerdown", (e) => {
    downX = e.clientX; downY = e.clientY; downTime = performance.now();
    onPointerDown(e);
  });

  window.addEventListener("pointermove", (e) => {
    onPointerMove(e);
    if (e.buttons) return;
    const idx = pickIndex();
    if (idx === -1) {
      hideTooltip();
      canvas.classList.remove("pointing");
      return;
    }
    canvas.classList.add("pointing");
    const star = stars[idx];
    if (star) showTooltip(star, e.clientX, e.clientY);
  });

  window.addEventListener("pointerup", (e) => {
    onPointerUp(e);
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const dt = performance.now() - downTime;
    const moved = Math.hypot(dx, dy);
    if (moved < 6 && dt < 400) {
      const idx = pickIndex();
      if (idx !== -1) {
        const star = stars[idx];
        if (star) {
          hideTooltip();
          showInfo(star);
          // Fire arcs — only if this star is a real (non-seed) visit and
          // there are neighbors to connect to.
          if (star.ts && realStars.length > 1) {
            const realIdx = realStars.findIndex((s) => s.id === star.id);
            if (realIdx !== -1) arcs.spawnFrom(realIdx, 4);
          } else {
            arcs.clear();
          }
          return;
        }
      }
      hideInfo();
      arcs.clear();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { hideInfo(); arcs.clear(); }
  });
}

function startLoop(field, arcs) {
  const start = performance.now();
  function tick() {
    const t = (performance.now() - start) / 1000;
    nebula.update(t);
    field.update(t);
    arcs.update(t);
    tickWorld();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

window.addEventListener("resize", () => { onResize(); nebula.onResize(); });

function findMyStarId(stars, you) {
  if (!you?.city) return null;
  const candidates = stars.filter(
    (s) => s.city?.toLowerCase() === you.city.toLowerCase()
             && s.country === you.country
             && s.ts
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.ts - a.ts);
  return candidates[0].id;
}
