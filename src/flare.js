// "Flare" — a small bright mesh that lives at the surface of the sphere.
// Positioned at the clicked star's lat/lon. Fades in fast, holds, fades out.
// This mesh is also the light source for the god-rays post-processing effect.

import * as THREE from "three";

const RADIUS = 1.6;

export function createFlare() {
  // Small octahedron reads as a sharp point-of-light from any camera angle
  // and has a clean silhouette for god-rays to trace.
  const geo = new THREE.OctahedronGeometry(0.03, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.renderOrder = 10;

  let born = 0;
  const LIFE = 1600;

  function spawnAt(lat, lon) {
    const [x, y, z] = latLonToVec3(lat, lon, RADIUS * 1.012);
    mesh.position.set(x, y, z);
    mesh.visible = true;
    born = performance.now();
    mat.opacity = 0;
  }

  function update() {
    if (!mesh.visible) return;
    const age = (performance.now() - born) / LIFE;
    if (age >= 1) { mesh.visible = false; mat.opacity = 0; return; }
    // Snap in over first 12%, hold, ease out.
    if (age < 0.12) mat.opacity = age / 0.12;
    else if (age > 0.55) mat.opacity = 1 - (age - 0.55) / 0.45;
    else mat.opacity = 1;
  }

  function isActive() { return mesh.visible; }
  function clear() { mesh.visible = false; mat.opacity = 0; }

  return { mesh, spawnAt, update, isActive, clear };
}

function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}
