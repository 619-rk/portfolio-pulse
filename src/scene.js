// Three.js scene + interactive drag-to-rotate controls with inertia.

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
  const DEFAULT_Z = 3.36;
  const MIN_Z = 2.2;
  const MAX_Z = 6.0;
  camera.position.set(0, 0, DEFAULT_Z);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const world = new THREE.Group();
  scene.add(world);

  const state = {
    rotX: 0, rotY: 0,
    velX: 0, velY: 0.0015,
    dragging: false,
    lastX: 0, lastY: 0,
    lastMoveTime: 0,
    lastInteractionTime: 0,
    // Rotate-to-target animation state
    rotating: false,
    rotStart: 0,
    rotDuration: 0,
    fromRotX: 0, fromRotY: 0,
    toRotX: 0,   toRotY: 0,
  };

  const DAMPING = 0.94;
  const DRIFT_SPEED = 0.0008;
  const IDLE_MS = 2500;

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function onPointerDown(e) {
    state.dragging = true;
    state.rotating = false;      // dragging cancels any auto-center tween
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
  }

  function onPointerMove(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);

    if (!state.dragging) return;

    const now = performance.now();
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    const rY = dx * 0.005;
    const rX = dy * 0.005;
    state.rotY += rY;
    state.rotX += rX;
    state.rotX = Math.max(-Math.PI / 2 + 0.2, Math.min(Math.PI / 2 - 0.2, state.rotX));

    const dt = Math.max(1, now - state.lastMoveTime);
    state.velY = rY * (16 / dt);
    state.velX = rX * (16 / dt);
    state.lastMoveTime = now;
    state.lastInteractionTime = now;
  }

  // Wheel zoom (mouse wheel + trackpad pinch on macOS).
  // ctrlKey during a wheel event = pinch gesture; use a larger step there.
  function onWheel(e) {
    e.preventDefault();
    const step = e.ctrlKey ? 0.02 : 0.0015; // pinch feels bigger than one detent
    const factor = 1 + e.deltaY * step;
    camera.position.z = Math.max(MIN_Z, Math.min(MAX_Z, camera.position.z * factor));
    state.lastInteractionTime = performance.now();
  }

  function tickWorld() {
    const now = performance.now();

    if (state.rotating) {
      const t = Math.min(1, (now - state.rotStart) / state.rotDuration);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      state.rotX = state.fromRotX + (state.toRotX - state.fromRotX) * e;
      state.rotY = state.fromRotY + (state.toRotY - state.fromRotY) * e;
      if (t >= 1) state.rotating = false;
    } else if (!state.dragging) {
      state.rotY += state.velY;
      state.rotX += state.velX;
      state.velY *= DAMPING;
      state.velX *= DAMPING;
      if (Math.abs(state.velY) < DRIFT_SPEED && now - state.lastInteractionTime > IDLE_MS) {
        state.velY = DRIFT_SPEED;
      }
      state.rotX = Math.max(-Math.PI / 2 + 0.2, Math.min(Math.PI / 2 - 0.2, state.rotX));
    }

    world.rotation.y = state.rotY;
    world.rotation.x = state.rotX;
    world.updateMatrixWorld();
  }

  /**
   * Rotate the globe so the given lat/lon faces the camera. Animated over `durationMs`.
   * Interrupts drift and inertia; a subsequent drag will cancel the animation.
   */
  function rotateTo(lat, lon, durationMs = 1200) {
    // Target rotations for a globe with rotation order Y then X:
    //   after rotY the world's longitude at the front is (-lon + 90° - offset)
    // We choose rotations so the target vector ends up at (0, 0, 1) (front).
    // Derivation: a point at (lat, lon) mapped by latLonToVec3 is at bearing
    // theta = (lon + 180)°, so we want rotY to bring theta to 90° (front, +z),
    // i.e. rotY = π/2 - theta.
    const theta = (lon + 180) * (Math.PI / 180);
    const targetRotY = Math.PI / 2 - theta;
    const targetRotX = lat * (Math.PI / 180);

    // Choose the shortest angular path around the Y axis.
    let dy = targetRotY - state.rotY;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;

    state.fromRotX = state.rotX;
    state.fromRotY = state.rotY;
    state.toRotX = Math.max(-Math.PI / 2 + 0.2, Math.min(Math.PI / 2 - 0.2, targetRotX));
    state.toRotY = state.rotY + dy;
    state.rotStart = performance.now();
    state.rotDuration = durationMs;
    state.rotating = true;
    // Kill drift/inertia so it doesn't fight us during the tween.
    state.velX = 0;
    state.velY = 0;
    state.lastInteractionTime = performance.now();
  }

  function render() {
    renderer.render(scene, camera);
  }

  return {
    scene, camera, renderer, world, render,
    onResize, onPointerMove, onPointerDown, onPointerUp, onWheel,
    tickWorld, rotateTo,
  };
}
