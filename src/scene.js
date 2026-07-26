// Three.js scene + interactive drag-to-rotate controls with inertia.
//
// The world lives inside a "world" group that we rotate directly. This is
// simpler than OrbitControls and gives us full control over damping and
// idle auto-drift so the globe never sits perfectly still.

import * as THREE from "three";

export const pointer = new THREE.Vector2(0, 0); // NDC pointer for raycasting

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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  // The world group — everything that should rotate lives here.
  const world = new THREE.Group();
  scene.add(world);

  // Rotation state
  const state = {
    rotX: 0,
    rotY: 0,
    velX: 0,
    velY: 0.0015,          // slow autonomous drift
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    lastInteractionTime: 0,
    // Fly-to camera state (kept but rarely used; click now opens the info panel)
    flying: false,
    flyStart: 0,
    flyDuration: 0,
    flyFrom: new THREE.Vector3(),
    flyTo: new THREE.Vector3(),
  };

  const DAMPING = 0.94;         // per-frame velocity multiplier after release
  const DRIFT_SPEED = 0.0008;   // idle drift speed
  const IDLE_MS = 2500;         // ms after last interaction before drift resumes

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  /* --------------------------- input handling --------------------------- */

  function onPointerDown(e) {
    state.dragging = true;
    state.velX = 0;
    state.velY = 0;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastMoveTime = performance.now();
    canvas.classList.add("grabbing");
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onPointerUp(e) {
    if (!state.dragging) return;
    state.dragging = false;
    canvas.classList.remove("grabbing");
    canvas.releasePointerCapture?.(e.pointerId);
    // Velocity was set on the last move; keep it, damping handles decay.
  }

  function onPointerMove(e) {
    // Always update NDC for raycasting
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);

    if (!state.dragging) return;

    const now = performance.now();
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    // Rotation delta
    const rY = dx * 0.005;
    const rX = dy * 0.005;

    state.rotY += rY;
    state.rotX += rX;

    // Clamp X so we don't roll over the poles
    state.rotX = Math.max(-Math.PI / 2 + 0.2, Math.min(Math.PI / 2 - 0.2, state.rotX));

    // Compute velocity for inertial fling based on recent movement.
    const dt = Math.max(1, now - state.lastMoveTime);
    state.velY = rY * (16 / dt);
    state.velX = rX * (16 / dt);
    state.lastMoveTime = now;
    state.lastInteractionTime = now;
  }

  function tickWorld() {
    const now = performance.now();
    if (!state.dragging) {
      // Apply inertia
      state.rotY += state.velY;
      state.rotX += state.velX;
      state.velY *= DAMPING;
      state.velX *= DAMPING;
      // Tiny floor so drift never truly stops.
      if (Math.abs(state.velY) < DRIFT_SPEED && now - state.lastInteractionTime > IDLE_MS) {
        state.velY = DRIFT_SPEED;
      }
      state.rotX = Math.max(-Math.PI / 2 + 0.2, Math.min(Math.PI / 2 - 0.2, state.rotX));
    }
    world.rotation.y = state.rotY;
    world.rotation.x = state.rotX;
    tickFly();
    world.updateMatrixWorld();
  }

  /* ----------------------------- fly-to camera ---------------------------- */

  function flyTo(target, durationMs = 1400) {
    state.flying = true;
    state.flyStart = performance.now();
    state.flyDuration = durationMs;
    state.flyFrom.copy(camera.position);
    state.flyTo.copy(target).normalize().multiplyScalar(2.6);
  }

  function tickFly() {
    if (!state.flying) return;
    const t = Math.min(1, (performance.now() - state.flyStart) / state.flyDuration);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(state.flyFrom, state.flyTo, e);
    camera.lookAt(0, 0, 0);
    if (t >= 1) state.flying = false;
  }

  return {
    scene, camera, renderer, world,
    onResize, onPointerMove, onPointerDown, onPointerUp,
    tickWorld, flyTo,
  };
}
