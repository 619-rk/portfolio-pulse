// Shockwave ring — a bright expanding halo on the sphere surface centered on a clicked star.
// Uses a disc-shaped mesh with a shader that draws a soft radial ring, growing outward.

import * as THREE from "three";

const RADIUS = 1.6;

export function createShockwaveLayer() {
  const group = new THREE.Group();
  /** @type {Array<{mesh: THREE.Mesh, mat: THREE.ShaderMaterial, born: number, life: number}>} */
  const waves = [];

  function spawnAt(lat, lon) {
    const [x, y, z] = latLonToVec3(lat, lon, RADIUS * 1.008);
    const center = new THREE.Vector3(x, y, z);

    // A large disc; the shader carves out the visible ring so most of the disc is transparent.
    const geo = new THREE.PlaneGeometry(2.6, 2.6, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uAge:  { value: 0 },      // 0..1, animated
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uAge;
        void main() {
          float r = length(vUv - 0.5) * 2.0;   // 0 at center, ~1.41 at corner
          // Ring position expands from 0 to ~1.0 over the age.
          float ringR = uAge * 1.0;
          // Ring width thins as it expands.
          float width = 0.08 * (1.0 - uAge * 0.5);
          // Distance from the ring line.
          float d = abs(r - ringR);
          float intensity = smoothstep(width, 0.0, d);
          // Fade the whole wave out over time.
          float fade = 1.0 - smoothstep(0.6, 1.0, uAge);
          // Warm-white ring.
          vec3 col = vec3(1.0, 0.92, 0.75);
          gl_FragColor = vec4(col, intensity * fade * 0.9);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);
    // Orient the disc so its normal points outward from the globe center.
    mesh.lookAt(center.clone().multiplyScalar(2));
    mesh.renderOrder = 5;

    group.add(mesh);
    waves.push({ mesh, mat, born: performance.now(), life: 1800 });
  }

  function update(_t) {
    const now = performance.now();
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      const age = (now - w.born) / w.life;
      if (age >= 1) {
        group.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mat.dispose();
        waves.splice(i, 1);
        continue;
      }
      w.mat.uniforms.uAge.value = age;
    }
  }

  function clear() {
    for (const w of waves) {
      group.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mat.dispose();
    }
    waves.length = 0;
  }

  return { mesh: group, spawnAt, update, clear };
}

function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}
