// Nebula background — a soft, slowly-drifting purple/blue gradient far behind the globe.
// Implemented as a fullscreen fragment-shader plane rendered before the scene.
// Cheap, no external assets.

import * as THREE from "three";

export function createNebula() {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: /* glsl */ `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec2 uResolution;

      // Cheap 2D hash + smoothed value noise.
      float hash(vec2 p) {
        p = fract(p * vec2(233.34, 851.73));
        p += dot(p, p + 23.45);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        vec2 p = uv * 3.0;
        p.x *= uResolution.x / uResolution.y;

        float t = uTime * 0.02;
        // Two drifting layers of fbm for depth.
        float n1 = fbm(p + vec2(t, -t * 0.7));
        float n2 = fbm(p * 1.7 + vec2(-t * 0.5, t * 0.3) + 5.0);

        // Vignette so edges stay dark and the globe reads as the focus.
        float vign = smoothstep(1.15, 0.3, length(uv - 0.5));

        // Purple/indigo palette with a hint of magenta in the highlights.
        vec3 deep    = vec3(0.02, 0.02, 0.06);
        vec3 indigo  = vec3(0.06, 0.05, 0.18);
        vec3 magenta = vec3(0.20, 0.05, 0.28);
        vec3 col = mix(deep, indigo, n1);
        col = mix(col, magenta, smoothstep(0.55, 0.9, n2));

        col *= vign;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000; // render before everything

  function update(t) { mat.uniforms.uTime.value = t; }
  function onResize() {
    mat.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }

  return { mesh, update, onResize, material: mat };
}
