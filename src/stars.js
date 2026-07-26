// Star field: renders visitor stars as a THREE.Points cloud with a custom shader
// that gives each star its own twinkle rhythm.

import * as THREE from "three";

const SPHERE_RADIUS = 1.6;

/**
 * @param {Array<{lat:number, lon:number}>} seed
 */
export function createStarfield(seed) {
  const n = seed.length;
  const positions = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const phases = new Float32Array(n); // per-star twinkle offset
  const speeds = new Float32Array(n); // per-star twinkle speed

  for (let i = 0; i < n; i++) {
    const { lat, lon } = seed[i];
    const [x, y, z] = latLonToVec3(lat, lon, SPHERE_RADIUS);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    sizes[i] = 6 + Math.random() * 10;
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
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Twinkle: 0.4..1.0 sine wave, unique per star.
        float t = sin(uTime * aSpeed + aPhase) * 0.5 + 0.5;
        vTwinkle = 0.4 + t * 0.6;

        // Point size shrinks with distance (perspective).
        gl_PointSize = aSize * uPixelRatio * (1.0 / -mvPosition.z) * vTwinkle;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;

      void main() {
        // Round soft disc.
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d);
        // Warm-white core, slight cyan bleed.
        vec3 col = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.95, 0.85), vTwinkle);
        gl_FragColor = vec4(col, alpha * vTwinkle);
      }
    `,
  });

  const mesh = new THREE.Points(geometry, material);

  function update(t) {
    material.uniforms.uTime.value = t;
  }

  return { mesh, update, geometry, material };
}

function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}
