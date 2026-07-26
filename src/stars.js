// Star field: two layers.
//   1) Background: ~10k dim red "unvisited" stars, ONLY on land (via earth-water mask).
//   2) Foreground: bright white "visited" stars for real visitors. Yours pulses cyan for 10s.
//
// The foreground buffer's index space matches the `visited` array 1:1 so raycasting hits
// can look up star metadata via `.index`.

import * as THREE from "three";

const SPHERE_RADIUS = 1.6;
const BACKGROUND_TARGET = 10000;
// three-globe ships a black/white land/water mask via unpkg. If the fetch fails we
// silently degrade to a full-sphere background.
const LAND_MASK_URL = "https://unpkg.com/three-globe@2.45.2/example/img/earth-water.png";

/**
 * @param {Array<{lat:number, lon:number, id?:string}>} visited
 * @param {string|null} yourStarId  id of the visitor's own star (or null)
 */
export async function createStarfield(visited, yourStarId = null) {
  const group = new THREE.Group();
  const bg = await makeBackground(BACKGROUND_TARGET);
  const fg = makeForeground(visited, yourStarId);
  group.add(bg.mesh);
  group.add(fg.mesh);

  function update(t) {
    bg.material.uniforms.uTime.value = t;
    fg.material.uniforms.uTime.value = t;
  }

  return { mesh: group, update, fg, bg, visited };
}

/* ---------- background: ~10k dim red "unvisited" stars on LAND ---------- */

async function makeBackground(target) {
  const points = await landPoints(target).catch(() => fullSpherePoints(target));

  const n = points.length;
  const positions = new Float32Array(n * 3);
  const phases = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const { lat, lon } = points[i];
    const [x, y, z] = latLonToVec3(lat, lon, SPHERE_RADIUS);
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
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
        vFlicker = 0.85 + f * 0.15;
        gl_PointSize = 5.5 * uPixelRatio * (1.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vFlicker;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d);
        // Brighter, hotter red-orange.
        vec3 col = vec3(1.0, 0.42, 0.28);
        gl_FragColor = vec4(col, alpha * vFlicker);
      }
    `,
  });

  return { mesh: new THREE.Points(geometry, material), material, geometry };
}

/* ----- foreground: bright visited stars, with a cyan halo for "yours" ----- */

function makeForeground(visited, yourStarId) {
  const n = Math.max(visited.length, 1);
  const positions = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const phases = new Float32Array(n);
  const speeds = new Float32Array(n);
  const isMine = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const v = visited[i] || { lat: 0, lon: 0 };
    const [x, y, z] = latLonToVec3(v.lat, v.lon, SPHERE_RADIUS * 1.005);
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    sizes[i] = 14 + Math.random() * 10;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.6 + Math.random() * 1.4;
    isMine[i] = v.id && v.id === yourStarId ? 1.0 : 0.0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aIsMine", new THREE.BufferAttribute(isMine, 1));

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
      attribute float aIsMine;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      varying float vMine;
      varying float vHalo;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float t = sin(uTime * aSpeed + aPhase) * 0.5 + 0.5;
        vTwinkle = 0.55 + t * 0.45;
        vMine = aIsMine;
        // "Your star" halo pulses for ~10 seconds then fades.
        vHalo = aIsMine * max(0.0, 1.0 - uTime / 10.0)
              * (0.6 + sin(uTime * 3.5) * 0.4);
        float boost = 1.0 + vHalo * 1.5;
        gl_PointSize = aSize * uPixelRatio * (1.0 / -mv.z) * vTwinkle * boost;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;
      varying float vMine;
      varying float vHalo;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(0.5, 0.2, d) * 0.4;
        vec3 warm = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.96, 0.85), vTwinkle);
        vec3 cyan = vec3(0.45, 0.95, 1.0);
        vec3 col  = mix(warm, cyan, vHalo);
        float a = (core + halo + vHalo * 0.7) * vTwinkle;
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  return { mesh: new THREE.Points(geometry, material), material, geometry };
}

/* ------------------------- land mask sampling ------------------------- */

async function landPoints(target) {
  const img = await loadImage(LAND_MASK_URL);
  const canvas = document.createElement("canvas");
  const W = img.width, H = img.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  let data;
  try {
    data = ctx.getImageData(0, 0, W, H).data;
  } catch (e) {
    // Canvas got tainted — CORS issue with the source. Fall back.
    console.warn("land mask tainted, falling back to full sphere", e);
    throw e;
  }

  // three-globe's earth-water: LAND is BLACK (near 0), WATER is WHITE (near 255).
  // Sample uniformly on the sphere; keep points where the pixel is dark.
  const points = [];
  let tries = 0;
  const maxTries = target * 12;
  while (points.length < target && tries < maxTries) {
    tries++;
    const u = Math.random();
    const v = Math.random();
    const lat = Math.asin(2 * v - 1) * 180 / Math.PI;
    const lon = u * 360 - 180;
    const px = Math.floor(((lon + 180) / 360) * W);
    const py = Math.floor((1 - (lat + 90) / 180) * H);
    const idx = (py * W + px) * 4;
    if (data[idx] < 128) points.push({ lat, lon });
  }
  console.log(`✓ land mask: ${points.length} land points in ${tries} tries (${W}x${H})`);
  return points;
}

function fullSpherePoints(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const lat = 90 - (phi * 180) / Math.PI;
    const lon = ((theta * 180) / Math.PI) % 360 - 180;
    out.push({ lat, lon });
  }
  return out;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
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
