// Three.js scene + drag-to-rotate + pmndrs/postprocessing pipeline (god rays + bloom).

import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  GodRaysEffect,
  BloomEffect,
  BlendFunction,
  KernelSize,
} from "postprocessing";

export const pointer = new THREE.Vector2(0, 0);

export function createScene(canvas, flareMesh) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 100
  );
  const DEFAULT_Z = 3.36;
  const MIN_Z = 2.2;
  const MAX_Z = 6.0;
  camera.position.set(0, 0, DEFAULT_Z);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const world = new THREE.Group();
  scene.add(world);

  /* ----------------------- postprocessing pipeline ----------------------- */

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // God rays radiating from the click-flare mesh.
  const godRays = new GodRaysEffect(camera, flareMesh, {
    blendFunction: BlendFunction.SCREEN,
    kernelSize: KernelSize.SMALL,
    density: 0.96,
    decay: 0.93,
    weight: 0.5,
    exposure: 0.55,
    samples: 60,
    clampMax: 1.0,
    height: 480,
  });

  // Subtle global bloom so bright pixels breathe.
  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.65,
    kernelSize: KernelSize.MEDIUM,
    luminanceThreshold: 0.35,
    luminanceSmoothing: 0.15,
  });

  composer.addPass(new EffectPass(camera, godRays, bloom));

  /* --------------------------- input handling --------------------------- */

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
    state.velX = 0; state.velY = 0;
    state.lastX = e.clientX; state.lastY = e.clientY;
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
    state.lastX = e.clientX; state.lastY = e.clientY;

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

  function onWheel(e) {
    e.preventDefault();
    const step = e.ctrlKey ? 0.02 : 0.0015;
    const factor = 1 + e.deltaY * step;
    camera.position.z = Math.max(MIN_Z, Math.min(MAX_Z, camera.position.z * factor));
    state.lastInteractionTime = performance.now();
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
    onResize, onPointerMove, onPointerDown, onPointerUp, onWheel,
    tickWorld,
  };
}
