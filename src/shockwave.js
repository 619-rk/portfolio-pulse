// A single whisper-ring that expands slowly across the sphere surface from a
// clicked point and fades away. Minimal, elegant.
//
// Implementation: build a thin geodesic band as a strip of triangles around
// the click point. Its "radius" (angular distance from origin) is animated
// via a shader uniform; each vertex knows its own angular distance and only
// renders in the narrow band near the wave front.

import * as THREE from "three";

const RADIUS = 1.6;
const SURFACE_R = RADIUS * 1.008;
const RING_MAX_ANGLE = Math.PI * 0.95;   // how far the wave travels (~171°)
const RING_SEGMENTS = 128;               // circumferential resolution
const LIFE_MS = 2600;

export function createShockwaveLayer() {
  const group = new THREE.Group();
  /** @type {Array<{mesh: THREE.Mesh, mat: THREE.ShaderMaterial, born: number}>} */
  const rings = [];

  function spawnAt(lat, lon) {
    const origin = latLonToVec3(lat, lon).normalize();
    const [t1, t2] = tangentBasis(origin);

    // Pre-compute unit-sphere positions for two rings at angular distance 0 and 1.
    // The shader interpolates between them by the current wave radius each frame.
    const posInner = new Float32Array((RING_SEGMENTS + 1) * 3);
    const posOuter = new Float32Array((RING_SEGMENTS + 1) * 3);
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const bearing = (i / RING_SEGMENTS) * Math.PI * 2;
      const tangent = t1.clone().multiplyScalar(Math.cos(bearing))
                       .add(t2.clone().multiplyScalar(Math.sin(bearing)))
                       .normalize();
      // Angle 0: same as origin.
      posInner[i * 3]     = origin.x;
      posInner[i * 3 + 1] = origin.y;
      posInner[i * 3 + 2] = origin.z;
      // Angle 1 rad along the great-circle from origin toward tangent.
      const c = Math.cos(1.0), s = Math.sin(1.0);
      posOuter[i * 3]     = origin.x * c + tangent.x * s;
      posOuter[i * 3 + 1] = origin.y * c + tangent.y * s;
      posOuter[i * 3 + 2] = origin.z * c + tangent.z * s;
    }
    // A ring is one loop of vertices; the shader positions each vertex on the
    // fly using slerp between the origin and its tangent-direction vector.
    // Easiest way to slerp inside GLSL: pass origin (constant) + tangent per vertex + current angle.

    const tangents = new Float32Array((RING_SEGMENTS + 1) * 3);
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const bearing = (i / RING_SEGMENTS) * Math.PI * 2;
      const tx = t1.x * Math.cos(bearing) + t2.x * Math.sin(bearing);
      const ty = t1.y * Math.cos(bearing) + t2.y * Math.sin(bearing);
      const tz = t1.z * Math.cos(bearing) + t2.z * Math.sin(bearing);
      tangents[i * 3]     = tx;
      tangents[i * 3 + 1] = ty;
      tangents[i * 3 + 2] = tz;
    }

    const geo = new THREE.BufferGeometry();
    // Positions are placeholders — the shader recomputes each frame from origin+tangent+uAngle.
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((RING_SEGMENTS + 1) * 3), 3));
    geo.setAttribute("aTangent", new THREE.BufferAttribute(tangents, 3));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOrigin: { value: origin.clone() },
        uRadius: { value: SURFACE_R },
        uAngle:  { value: 0.0 },   // current angular distance of the ring
        uAlpha:  { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aTangent;
        uniform vec3  uOrigin;
        uniform float uRadius;
        uniform float uAngle;
        void main() {
          float c = cos(uAngle);
          float s = sin(uAngle);
          vec3 p = uOrigin * c + aTangent * s;   // slerp: unit-length by construction
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p * uRadius, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        void main() {
          // Warm-white, faint. The whole line is one intensity — the ring is
          // already thin (a single line), so we just fade with time.
          gl_FragColor = vec4(1.0, 0.95, 0.85, uAlpha * 0.6);
        }
      `,
    });

    const line = new THREE.LineLoop(geo, mat);
    line.renderOrder = 5;
    group.add(line);
    rings.push({ mesh: line, mat, born: performance.now() });
  }

  function update(_t) {
    const now = performance.now();
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      const age = (now - r.born) / LIFE_MS;
      if (age >= 1) {
        group.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
        rings.splice(i, 1);
        continue;
      }
      // Ease-out: fast start, slow finish.
      const eased = 1 - Math.pow(1 - age, 2);
      r.mat.uniforms.uAngle.value = eased * RING_MAX_ANGLE;
      // Fade: hold for the first 40%, then fade to zero.
      r.mat.uniforms.uAlpha.value = age < 0.4 ? 1.0 : 1.0 - (age - 0.4) / 0.6;
    }
  }

  function clear() {
    for (const r of rings) {
      group.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mat.dispose();
    }
    rings.length = 0;
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

function tangentBasis(n) {
  const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(up, n).normalize();
  const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
  return [t1, t2];
}
