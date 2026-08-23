import * as THREE from "three";

// A lightweight, GPU-driven fluid sim (velocity + dye fields, ping-ponged
// render targets). Each frame: splat velocity/dye at the pointer, advect the
// velocity field by itself, then advect the dye by that velocity field. The
// resulting dye texture can be sampled by any material as `fluidMap`.

export const SIM_RESOLUTION = 128;

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

function createFBOPair() {
  const options = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  };

  return {
    read: new THREE.WebGLRenderTarget(SIM_RESOLUTION, SIM_RESOLUTION, options),
    write: new THREE.WebGLRenderTarget(SIM_RESOLUTION, SIM_RESOLUTION, options),
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

  const quad = new THREE.Mesh(geometry, splatMaterial);
  scene.add(quad);

  const velocity = createFBOPair();
  const dye = createFBOPair();

  return {
    scene,
    camera,
    quad,
    splatMaterial,
    advectionMaterial,
    velocity,
    dye,
    hasPointer: false,
    pointerUv: new THREE.Vector2(0.5, 0.5),
    lastPointerUv: new THREE.Vector2(0.5, 0.5),
    velocityImpulse: new THREE.Vector2(),
    splatColorScratch: new THREE.Vector3(),
    dispose() {
      geometry.dispose();
      splatMaterial.dispose();
      advectionMaterial.dispose();
      velocity.read.dispose();
      velocity.write.dispose();
      dye.read.dispose();
      dye.write.dispose();
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
