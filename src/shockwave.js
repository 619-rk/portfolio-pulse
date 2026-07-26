// Electric pulses that ride the surface of the sphere.
//
// On click, we spawn N thin lines emanating from the click point along
// great-circle paths in evenly-spaced bearings. Each line has a shader that
// draws a bright "head" traveling from origin outward with a fading tail —
// like lightning crawling along Earth's surface.

import * as THREE from "three";

const RADIUS = 1.6;
const SURFACE_R = RADIUS * 1.008;   // slight lift to avoid z-fighting
const NUM_ARCS = 10;
const ARC_ANGLE = Math.PI * 0.7;     // how far each pulse travels (~126°)
const SEGMENTS = 80;
const LIFE_MS = 1400;

export function createShockwaveLayer() {
  const group = new THREE.Group();
  /** @type {Array<{line: THREE.Line, mat: THREE.ShaderMaterial, born: number}>} */
  const pulses = [];

  function spawnAt(lat, lon) {
    const origin = latLonToVec3(lat, lon).normalize();
    const [t1, t2] = tangentBasis(origin);

    // Slight random offset per burst so consecutive clicks don't overlap identically.
    const bearingJitter = Math.random() * Math.PI * 2;

    for (let i = 0; i < NUM_ARCS; i++) {
      const bearing = bearingJitter + (i / NUM_ARCS) * Math.PI * 2;
      const tangent = t1.clone().multiplyScalar(Math.cos(bearing))
                       .add(t2.clone().multiplyScalar(Math.sin(bearing)))
                       .normalize();

      const positions = new Float32Array((SEGMENTS + 1) * 3);
      const ts = new Float32Array(SEGMENTS + 1);
      for (let s = 0; s <= SEGMENTS; s++) {
        const t = s / SEGMENTS;
        const a = t * ARC_ANGLE;
        // Great-circle: rotate `origin` toward `tangent` by angle a.
        const cos = Math.cos(a), sin = Math.sin(a);
        const px = origin.x * cos + tangent.x * sin;
        const py = origin.y * cos + tangent.y * sin;
        const pz = origin.z * cos + tangent.z * sin;
        positions[s * 3]     = px * SURFACE_R;
        positions[s * 3 + 1] = py * SURFACE_R;
        positions[s * 3 + 2] = pz * SURFACE_R;
        ts[s] = t;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("aT",       new THREE.BufferAttribute(ts, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uWave: { value: 0.0 },   // head position along the arc
          uTail: { value: 0.15 },  // trailing glow length
          uFade: { value: 1.0 },
        },
        vertexShader: /* glsl */ `
          attribute float aT;
          varying float vT;
          void main() {
            vT = aT;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vT;
          uniform float uWave;
          uniform float uTail;
          uniform float uFade;
          void main() {
            float d = uWave - vT;         // 0 at head, uTail at tail end
            if (d < 0.0 || d > uTail) discard;
            float k = 1.0 - (d / uTail);  // 1 at head, 0 at tail
            float alpha = k * k;          // sharper head
            // Electric cyan → white core at the leading edge.
            vec3 col = mix(vec3(0.42, 0.82, 1.0), vec3(1.0, 1.0, 1.0), k);
            gl_FragColor = vec4(col, alpha * uFade);
          }
        `,
      });

      const line = new THREE.Line(geo, mat);
      line.renderOrder = 5;
      group.add(line);
      pulses.push({ line, mat, born: performance.now() });
    }
  }

  function update(_t) {
    const now = performance.now();
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      const age = (now - p.born) / LIFE_MS;
      // Life ends 15% after the head passes the end so the tail fades away.
      if (age >= 1.15) {
        group.remove(p.line);
        p.line.geometry.dispose();
        p.mat.dispose();
        pulses.splice(i, 1);
        continue;
      }
      // Head travels from 0 → 1 over the life; a small overshoot lets the tail exit smoothly.
      p.mat.uniforms.uWave.value = Math.min(1.0 + p.mat.uniforms.uTail.value, age * 1.1);
      p.mat.uniforms.uFade.value = age < 1.0 ? 1.0 : Math.max(0, 1 - (age - 1.0) / 0.15);
    }
  }

  function clear() {
    for (const p of pulses) {
      group.remove(p.line);
      p.line.geometry.dispose();
      p.mat.dispose();
    }
    pulses.length = 0;
  }

  return { mesh: group, spawnAt, update, clear };
}

/* ------------------------------ helpers ----------------------------- */

function latLonToVec3(lat, lon) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

// Two orthonormal tangent vectors at a point n on the unit sphere.
function tangentBasis(n) {
  const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(up, n).normalize();
  const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
  return [t1, t2];
}
