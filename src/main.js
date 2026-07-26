// Constellation — entry point.
// Milestone 2: pure client-side visual — 500 random stars, twinkle, mouse parallax.

import { createScene } from "./scene.js";
import { createStarfield } from "./stars.js";
import { initHud } from "./hud.js";

const canvas = document.getElementById("scene");
const { scene, camera, renderer, onResize, onPointerMove } = createScene(canvas);

// Placeholder star data until Milestone 3 wires the API.
const seed = generateSeedStars(500);
const stars = createStarfield(seed);
scene.add(stars.mesh);

initHud({
  visitorCount: seed.length,
  city: "—",
  colo: "—",
});

// Render loop
const clock = new THREE_Clock();
function tick() {
  const t = clock.getElapsedTime();
  stars.update(t);
  // slow autonomous drift so it feels alive even without input
  scene.rotation.y = t * 0.02;
  scene.rotation.x = Math.sin(t * 0.05) * 0.05;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);

/* ------------------------------------------------------------------ */

// Tiny replacement for THREE.Clock so we don't need to import the whole namespace here.
function THREE_Clock() {
  const start = performance.now();
  this.getElapsedTime = () => (performance.now() - start) / 1000;
}

// Deterministic-ish seed of stars scattered on a sphere.
function generateSeedStars(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    // Fibonacci sphere for even distribution
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    // Convert to lat/lon-ish for later API compatibility
    const lat = 90 - (phi * 180) / Math.PI;
    const lon = ((theta * 180) / Math.PI) % 360 - 180;
    out.push({
      id: `seed-${i}`,
      lat,
      lon,
      city: null,
      country: null,
      ts: 0,
    });
  }
  return out;
}
