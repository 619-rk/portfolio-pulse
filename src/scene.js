// Three.js scene, camera, renderer, pointer tracking, and camera flight helper.

import * as THREE from "three";

export const pointer = new THREE.Vector2(0, 0);

export function createScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 3.2);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  // Camera state — pointer parallax + flight-to-target both write here.
  const state = {
    parallaxEnabled: true,
    flying: false,
    flyStart: 0,
    flyDuration: 0,
    flyFrom: new THREE.Vector3(),
    flyTo: new THREE.Vector3(),
  };

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function onPointerMove(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    if (state.parallaxEnabled && !state.flying) {
      camera.position.x = pointer.x * 0.4;
      camera.position.y = pointer.y * 0.3;
      camera.lookAt(0, 0, 0);
    }
  }

  /**
   * Smoothly move the camera toward `target`. `target` is a world-space point;
   * we push the camera along the ray outward from origin so the target sits
   * roughly centered in view.
   */
  function flyTo(target, durationMs = 1400) {
    state.flying = true;
    state.parallaxEnabled = false;
    state.flyStart = performance.now();
    state.flyDuration = durationMs;
    state.flyFrom.copy(camera.position);
    // Position camera at 1.9x the target's distance from origin along same ray.
    state.flyTo.copy(target).normalize().multiplyScalar(2.6);
  }

  function tickCamera() {
    if (!state.flying) return;
    const t = Math.min(1, (performance.now() - state.flyStart) / state.flyDuration);
    // Ease-in-out cubic
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(state.flyFrom, state.flyTo, e);
    camera.lookAt(0, 0, 0);
    if (t >= 1) {
      state.flying = false;
      // Re-enable parallax after a short pause so it doesn't yank.
      setTimeout(() => { state.parallaxEnabled = true; }, 800);
    }
  }

  return { scene, camera, renderer, onResize, onPointerMove, flyTo, tickCamera, state };
}
