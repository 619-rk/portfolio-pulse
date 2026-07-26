// Three.js scene, camera, renderer, and pointer tracking.
// Exposes a `pointer` vector [-1..1] that stars.js reads for parallax + picking.

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

  // Faint radial gradient background via a large back-facing sphere is overkill
  // for M2 — the flat dark color already reads as deep space with the stars on top.

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function onPointerMove(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);

    // Camera parallax — camera drifts opposite to the cursor for depth.
    camera.position.x = pointer.x * 0.4;
    camera.position.y = pointer.y * 0.3;
    camera.lookAt(0, 0, 0);
  }

  return { scene, camera, renderer, onResize, onPointerMove };
}
