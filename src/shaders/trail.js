import * as THREE from "three";

// A cheap cursor trail: one texture that fades a little every frame and gets
// a soft stroke painted along the segment the pointer swept out since last
// frame. No velocity field, no pressure solve, no advection - just paint and
// decay. That sidesteps the vortex/pooling behavior a real fluid sim
// introduces, for a fraction of the render passes (1 pass/frame here vs.
// dozens for splat + viscosity + pressure + advection).

export const TRAIL_RESOLUTION = 128;

const trailVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const trailFragmentShader = /* glsl */ `
  uniform sampler2D source;
  uniform vec2 pointA;
  uniform vec2 pointB;
  uniform float radius;
  uniform float aspect;
  uniform float decay;
  uniform float intensity;

  varying vec2 vUv;

  void main() {
    float base = texture2D(source, vUv).r * decay;

    // Distance from this texel to the segment the pointer swept out this
    // frame (not just its endpoint), so fast movement paints a continuous
    // stroke instead of separated dots.
    vec2 uv = vUv * vec2(aspect, 1.0);
    vec2 a = pointA * vec2(aspect, 1.0);
    vec2 b = pointB * vec2(aspect, 1.0);
    vec2 ab = b - a;
    float t = clamp(dot(uv - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float dist = length(uv - (a + ab * t));
    float influence = 1.0 - smoothstep(0.0, radius, dist);

    gl_FragColor = vec4(base + influence * intensity, 0.0, 0.0, 1.0);
  }
`;

const FBO_OPTIONS = {
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  wrapS: THREE.ClampToEdgeWrapping,
  wrapT: THREE.ClampToEdgeWrapping,
  depthBuffer: false,
  stencilBuffer: false,
};

function createFBO() {
  return new THREE.WebGLRenderTarget(
    TRAIL_RESOLUTION,
    TRAIL_RESOLUTION,
    FBO_OPTIONS,
  );
}

export function createTrail() {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);

  const material = new THREE.ShaderMaterial({
    vertexShader: trailVertexShader,
    fragmentShader: trailFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      source: { value: null },
      pointA: { value: new THREE.Vector2(0.5, 0.5) },
      pointB: { value: new THREE.Vector2(0.5, 0.5) },
      radius: { value: 0.05 },
      aspect: { value: 1 },
      decay: { value: 0.93 },
      intensity: { value: 0 },
    },
  });

  const quad = new THREE.Mesh(geometry, material);
  scene.add(quad);

  return {
    scene,
    camera,
    material,
    read: createFBO(),
    write: createFBO(),
    hasPointer: false,
    pointerUv: new THREE.Vector2(0.5, 0.5),
    lastPointerUv: new THREE.Vector2(0.5, 0.5),
    swap() {
      const temp = this.read;
      this.read = this.write;
      this.write = temp;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      this.read.dispose();
      this.write.dispose();
    },
  };
}

export function runTrailStep(
  gl,
  trail,
  pointA,
  pointB,
  radius,
  aspect,
  decay,
  intensity,
) {
  trail.material.uniforms.source.value = trail.read.texture;
  trail.material.uniforms.pointA.value.copy(pointA);
  trail.material.uniforms.pointB.value.copy(pointB);
  trail.material.uniforms.radius.value = radius;
  trail.material.uniforms.aspect.value = aspect;
  trail.material.uniforms.decay.value = decay;
  trail.material.uniforms.intensity.value = intensity;

  gl.setRenderTarget(trail.write);
  gl.render(trail.scene, trail.camera);
  gl.setRenderTarget(null);
  trail.swap();
}
