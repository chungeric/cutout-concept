import * as THREE from "three";

// A lightweight, GPU-driven fluid sim (velocity + dye fields, ping-ponged
// render targets). Each frame: splat velocity/dye at the pointer, project the
// velocity field to be divergence-free, self-advect it, then advect the dye
// by that velocity field. The resulting dye texture can be sampled by any
// material as `fluidMap`.

export const SIM_RESOLUTION = 128;
const TEXEL_SIZE = 1 / SIM_RESOLUTION;

// Jacobi iteration count for the pressure solve. Higher converges closer to
// the true divergence-free field at the cost of more render passes per frame.
const PRESSURE_ITERATIONS = 20;

const simVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const splatFragmentShader = /* glsl */ `
  uniform sampler2D source;
  uniform vec2 point;
  uniform vec3 splatColor;
  uniform float radius;
  uniform float aspect;

  varying vec2 vUv;

  void main() {
    vec2 diff = (vUv - point) * vec2(aspect, 1.0);
    float influence = 1.0 - smoothstep(0.0, radius, length(diff));
    vec3 base = texture2D(source, vUv).rgb;
    gl_FragColor = vec4(base + influence * splatColor, 1.0);
  }
`;

const advectionFragmentShader = /* glsl */ `
  uniform sampler2D velocity;
  uniform sampler2D source;
  uniform float dt;
  uniform float dissipation;

  varying vec2 vUv;

  void main() {
    vec2 vel = texture2D(velocity, vUv).xy;
    vec2 coord = vUv - dt * vel;
    gl_FragColor = dissipation * texture2D(source, coord);
  }
`;

// Computes the divergence of the velocity field: how much more flows out of
// each texel than flows in. A splat injects velocity from nowhere (positive
// divergence), and without correcting for that the fluid has no reason to
// spread out - it just keeps circulating in place instead of dissipating.
const divergenceFragmentShader = /* glsl */ `
  uniform sampler2D velocity;
  uniform vec2 texelSize;

  varying vec2 vUv;

  void main() {
    float L = texture2D(velocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(velocity, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture2D(velocity, vUv - vec2(0.0, texelSize.y)).y;
    float T = texture2D(velocity, vUv + vec2(0.0, texelSize.y)).y;
    float divergence = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
  }
`;

// One Jacobi relaxation step solving the pressure Poisson equation for the
// field whose gradient cancels out the velocity field's divergence.
const pressureFragmentShader = /* glsl */ `
  uniform sampler2D pressure;
  uniform sampler2D divergence;
  uniform vec2 texelSize;

  varying vec2 vUv;

  void main() {
    float L = texture2D(pressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(pressure, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture2D(pressure, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture2D(pressure, vUv + vec2(0.0, texelSize.y)).x;
    float div = texture2D(divergence, vUv).x;
    gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
  }
`;

// Subtracts the solved pressure's gradient from the velocity field, leaving
// it (approximately) divergence-free.
const gradientSubtractFragmentShader = /* glsl */ `
  uniform sampler2D pressure;
  uniform sampler2D velocity;
  uniform vec2 texelSize;

  varying vec2 vUv;

  void main() {
    float L = texture2D(pressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(pressure, vUv + vec2(texelSize.x, 0.0)).x;
    float B = texture2D(pressure, vUv - vec2(0.0, texelSize.y)).x;
    float T = texture2D(pressure, vUv + vec2(0.0, texelSize.y)).x;
    vec2 vel = texture2D(velocity, vUv).xy;
    vel -= vec2(R - L, T - B) * 0.5;
    gl_FragColor = vec4(vel, 0.0, 1.0);
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
    SIM_RESOLUTION,
    SIM_RESOLUTION,
    FBO_OPTIONS,
  );
}

function createFBOPair() {
  return {
    read: createFBO(),
    write: createFBO(),
    swap() {
      const temp = this.read;
      this.read = this.write;
      this.write = temp;
    },
  };
}

export function createFluidSim() {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);

  const texelSize = new THREE.Vector2(TEXEL_SIZE, TEXEL_SIZE);

  const splatMaterial = new THREE.ShaderMaterial({
    vertexShader: simVertexShader,
    fragmentShader: splatFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      source: { value: null },
      point: { value: new THREE.Vector2() },
      splatColor: { value: new THREE.Vector3() },
      radius: { value: 0.05 },
      aspect: { value: 1 },
    },
  });

  const advectionMaterial = new THREE.ShaderMaterial({
    vertexShader: simVertexShader,
    fragmentShader: advectionFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      velocity: { value: null },
      source: { value: null },
      dt: { value: 0 },
      dissipation: { value: 0.98 },
    },
  });

  const divergenceMaterial = new THREE.ShaderMaterial({
    vertexShader: simVertexShader,
    fragmentShader: divergenceFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      velocity: { value: null },
      texelSize: { value: texelSize },
    },
  });

  const pressureMaterial = new THREE.ShaderMaterial({
    vertexShader: simVertexShader,
    fragmentShader: pressureFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      pressure: { value: null },
      divergence: { value: null },
      texelSize: { value: texelSize },
    },
  });

  const gradientSubtractMaterial = new THREE.ShaderMaterial({
    vertexShader: simVertexShader,
    fragmentShader: gradientSubtractFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      pressure: { value: null },
      velocity: { value: null },
      texelSize: { value: texelSize },
    },
  });

  const quad = new THREE.Mesh(geometry, splatMaterial);
  scene.add(quad);

  const velocity = createFBOPair();
  const dye = createFBOPair();
  const divergence = createFBO();
  const pressure = createFBOPair();

  return {
    scene,
    camera,
    quad,
    splatMaterial,
    advectionMaterial,
    divergenceMaterial,
    pressureMaterial,
    gradientSubtractMaterial,
    velocity,
    dye,
    divergence,
    pressure,
    hasPointer: false,
    pointerUv: new THREE.Vector2(0.5, 0.5),
    lastPointerUv: new THREE.Vector2(0.5, 0.5),
    velocityImpulse: new THREE.Vector2(),
    splatColorScratch: new THREE.Vector3(),
    dispose() {
      geometry.dispose();
      splatMaterial.dispose();
      advectionMaterial.dispose();
      divergenceMaterial.dispose();
      pressureMaterial.dispose();
      gradientSubtractMaterial.dispose();
      velocity.read.dispose();
      velocity.write.dispose();
      dye.read.dispose();
      dye.write.dispose();
      divergence.dispose();
      pressure.read.dispose();
      pressure.write.dispose();
    },
  };
}

export function runSplat(gl, fluid, target, point, color, radius, aspect) {
  fluid.quad.material = fluid.splatMaterial;
  fluid.splatMaterial.uniforms.source.value = target.read.texture;
  fluid.splatMaterial.uniforms.point.value.copy(point);
  fluid.splatMaterial.uniforms.splatColor.value.copy(color);
  fluid.splatMaterial.uniforms.radius.value = radius;
  fluid.splatMaterial.uniforms.aspect.value = aspect;

  gl.setRenderTarget(target.write);
  gl.render(fluid.scene, fluid.camera);
  gl.setRenderTarget(null);
  target.swap();
}

export function runAdvection(
  gl,
  fluid,
  target,
  velocityTexture,
  dt,
  dissipation,
) {
  fluid.quad.material = fluid.advectionMaterial;
  fluid.advectionMaterial.uniforms.velocity.value = velocityTexture;
  fluid.advectionMaterial.uniforms.source.value = target.read.texture;
  fluid.advectionMaterial.uniforms.dt.value = dt;
  fluid.advectionMaterial.uniforms.dissipation.value = dissipation;

  gl.setRenderTarget(target.write);
  gl.render(fluid.scene, fluid.camera);
  gl.setRenderTarget(null);
  target.swap();
}

export function runDivergence(gl, fluid) {
  fluid.quad.material = fluid.divergenceMaterial;
  fluid.divergenceMaterial.uniforms.velocity.value = fluid.velocity.read.texture;

  gl.setRenderTarget(fluid.divergence);
  gl.render(fluid.scene, fluid.camera);
  gl.setRenderTarget(null);
}

export function runPressure(gl, fluid, iterations = PRESSURE_ITERATIONS) {
  fluid.quad.material = fluid.pressureMaterial;
  fluid.pressureMaterial.uniforms.divergence.value = fluid.divergence.texture;

  for (let i = 0; i < iterations; i++) {
    fluid.pressureMaterial.uniforms.pressure.value = fluid.pressure.read.texture;

    gl.setRenderTarget(fluid.pressure.write);
    gl.render(fluid.scene, fluid.camera);
    gl.setRenderTarget(null);
    fluid.pressure.swap();
  }
}

export function runGradientSubtract(gl, fluid) {
  fluid.quad.material = fluid.gradientSubtractMaterial;
  fluid.gradientSubtractMaterial.uniforms.pressure.value =
    fluid.pressure.read.texture;
  fluid.gradientSubtractMaterial.uniforms.velocity.value =
    fluid.velocity.read.texture;

  gl.setRenderTarget(fluid.velocity.write);
  gl.render(fluid.scene, fluid.camera);
  gl.setRenderTarget(null);
  fluid.velocity.swap();
}
