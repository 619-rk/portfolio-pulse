// Star field: two layers.
//   1) A dim red background of 10k "unvisited" stars evenly distributed on a sphere.
//   2) A bright white "visited" layer for real visitors — larger, twinkling, gently pulsing.

import * as THREE from "three";

const SPHERE_RADIUS = 1.6;
const BACKGROUND_COUNT = 10000;

/**
 * @param {Array<{lat:number, lon:number}>} visited  real visitor stars
 */
export function createStarfield(visited) {
  const group = new THREE.Group();
  const bg = makeBackground(BACKGROUND_COUNT);
  const fg = makeForeground(visited);
  group.add(bg.mesh);
  group.add(fg.mesh);

  function update(t) {
    bg.material.uniforms.uTime.value = t;
    fg.material.uniforms.uTime.value = t;
  }

  return { mesh: group, update };
}

/* ------------------ background: 10k dim red stars ------------------ */

function makeBackground(n) {
  const positions = new Float32Array(n * 3);
  const phases = new Float32Array(n);

  // Fibonacci sphere for even, non-clustered distribution.
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    positions[i * 3]     = x * SPHERE_RADIUS;
    positions[i * 3 + 1] = y * SPHERE_RADIUS;
    positions[i * 3 + 2] = z * SPHERE_RADIUS;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vFlicker;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float f = sin(uTime * 0.7 + aPhase) * 0.5 + 0.5;
        vFlicker = 0.35 + f * 0.4;
        gl_PointSize = 2.2 * uPixelRatio * (1.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vFlicker;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d);
        // Ember red, faint.
        vec3 col = vec3(0.85, 0.18, 0.15);
        gl_FragColor = vec4(col, alpha * vFlicker * 0.55);
      }
    `,
  });

  return { mesh: new THREE.Points(geometry, material), material, geometry };
}

/* -------------- foreground: bright white visited stars -------------- */

function makeForeground(visited) {
  const n = Math.max(visited.length, 1);
  const positions = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const phases = new Float32Array(n);
  const speeds = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const v = visited[i] || { lat: 0, lon: 0 };
    const [x, y, z] = latLonToVec3(v.lat, v.lon, SPHERE_RADIUS * 1.005);
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    sizes[i] = 14 + Math.random() * 10;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.6 + Math.random() * 1.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute float aSpeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float t = sin(uTime * aSpeed + aPhase) * 0.5 + 0.5;
        vTwinkle = 0.55 + t * 0.45;
        gl_PointSize = aSize * uPixelRatio * (1.0 / -mv.z) * vTwinkle;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(0.5, 0.2, d) * 0.35;
        // Warm white core with a hint of gold at peak twinkle.
        vec3 col = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.96, 0.85), vTwinkle);
        gl_FragColor = vec4(col, (core + halo) * vTwinkle);
      }
    `,
  });

  return { mesh: new THREE.Points(geometry, material), material, geometry };
}

/* ------------------------------ helpers ------------------------------ */

function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}
