// Great-circle arcs between visited cities.
// When a star is clicked, we spawn 4 arcs from that star to its nearest
// visitor neighbors. Each arc animates in over ~600ms and lingers while
// the info panel is open.

import * as THREE from "three";

const RADIUS = 1.6;
const ARC_HEIGHT = 0.35;   // how far above the sphere the arc peaks
const ARC_POINTS = 60;

/**
 * @param {Array<{lat:number, lon:number}>} visited  real visitor stars only
 */
export function createArcLayer(visited) {
  const group = new THREE.Group();
  /** @type {Array<{line: THREE.Line, mat: THREE.LineBasicMaterial, born: number, life: number}>} */
  const arcs = [];

  /**
   * Spawn arcs from `originIdx` to the K nearest neighbor visitor cities.
   */
  function spawnFrom(originIdx, k = 4) {
    clear();
    if (originIdx < 0 || originIdx >= visited.length) return;
    const o = visited[originIdx];
    const withDist = visited
      .map((v, i) => ({ i, v, d: haversine(o, v) }))
      .filter(({ i }) => i !== originIdx)
      .sort((a, b) => a.d - b.d)
      .slice(0, k);

    const now = performance.now();
    for (const { v } of withDist) {
      const { line, mat } = buildArc(o, v);
      group.add(line);
      arcs.push({ line, mat, born: now, life: 8000 });
    }
  }

  function clear() {
    for (const a of arcs) {
      group.remove(a.line);
      a.line.geometry.dispose();
      a.mat.dispose();
    }
    arcs.length = 0;
  }

  function update(_t) {
    const now = performance.now();
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i];
      const age = now - a.born;
      if (age >= a.life) {
        group.remove(a.line);
        a.line.geometry.dispose();
        a.mat.dispose();
        arcs.splice(i, 1);
        continue;
      }
      // Fade in over first 600ms, hold, fade out last 800ms.
      const t = age / a.life;
      let alpha;
      if (t < 0.075) alpha = t / 0.075;           // fade in
      else if (t > 0.9) alpha = (1 - t) / 0.1;    // fade out
      else alpha = 1.0;
      a.mat.opacity = alpha * 0.9;

      // Reveal from origin outward.
      const reveal = Math.min(1, age / 600);
      const count = Math.floor(ARC_POINTS * reveal);
      a.line.geometry.setDrawRange(0, Math.max(2, count));
    }
  }

  return { mesh: group, spawnFrom, update, clear };
}

/* --------------------------- arc geometry --------------------------- */

function buildArc(a, b) {
  const p0 = latLonToVec3(a.lat, a.lon, RADIUS * 1.01);
  const p1 = latLonToVec3(b.lat, b.lon, RADIUS * 1.01);
  const points = [];
  // Bezier-ish arc lifted along the midpoint's radial direction.
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  const lift = ARC_HEIGHT * (0.7 + Math.min(1, mid.length() / RADIUS));
  const control = mid.clone().normalize().multiplyScalar(RADIUS + lift);

  for (let i = 0; i <= ARC_POINTS; i++) {
    const t = i / ARC_POINTS;
    const q0 = p0.clone().lerp(control, t);
    const q1 = control.clone().lerp(p1, t);
    points.push(q0.lerp(q1, t));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  geo.setDrawRange(0, 2); // start invisible; update() reveals it

  const mat = new THREE.LineBasicMaterial({
    color: 0x8fd9ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  return { line, mat };
}

/* ------------------------------ helpers ----------------------------- */

function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

// Great-circle distance (km) — used only for sorting, so units don't matter.
function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sa = Math.sin(dLat / 2) ** 2
           + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(sa));
}
