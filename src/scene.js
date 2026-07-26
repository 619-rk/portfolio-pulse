// Three.js scene + interactive drag-to-rotate controls with inertia + post-processing bloom.

import * as THREE from "three";
import { EffectComposer } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/OutputPass.js";

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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  // Post-processing: subtle bloom so bright stars glow softly.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    /* strength */ 0.9,
    /* radius   */ 0.6,
    /* threshold*/ 0.35
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const world = new THREE.Group();
  scene.add(world);

  const state = {
    rotX: 0, rotY: 0,
    velX: 0, velY: 0.0015,
    dragging: false,
    lastX: 0, lastY: 0,
    lastMoveTime: 0,
    lastInteractionTime: 0,
  };

  const DAMPING = 0.94;
  const DRIFT_SPEED = 0.0008;
  const IDLE_MS = 2500;

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setSize(window.innerWidth, window.innerHeight);
  }

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

  function tickWorld() {
    const now = performance.now();
    if (!state.dragging) {
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

  function render() {
    composer.render();
  }

  return {
    scene, camera, renderer, world, composer, render,
    onResize, onPointerMove, onPointerDown, onPointerUp,
    tickWorld,
  };
}
