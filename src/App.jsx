import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "./App.css";
import { Environment, OrbitControls, useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  uniform float faceAspect;
  uniform float imageAspect;
  uniform float threshold;

  varying vec2 vUv;

  void main() {
    // Fit the texture like CSS "background-size: contain", scaled to the
    // plane's full height. Horizontally it's centered, cropped if the image
    // is relatively wider than the plane, or letterboxed with the plane color
    // if the image is relatively narrower.
    float scale = imageAspect / faceAspect;
    vec2 uv = vec2((vUv.x - 0.5) / scale + 0.5, vUv.y);
    bool insideImage = uv.x >= 0.0 && uv.x <= 1.0;

    if (insideImage) {
      vec4 texColor = texture2D(map, uv);
      float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

      // Cut out the black part of the texture, revealing what's behind the plane.
      if (luminance <= threshold) {
        discard;
      }
    }

    gl_FragColor = vec4(color, 1.0);

    // #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Planes other than the frontmost one keep the same black-pixel cutout mask,
// but fill the surviving (non-cutout) area with a dot grid drawn in screen
// space (based on gl_FragCoord) instead of a solid color.
const dotsVertexShader = vertexShader;

const dotsFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float faceAspect;
  uniform float imageAspect;
  uniform float threshold;
  uniform vec3 dotColor;
  uniform vec3 backgroundColor;
  uniform float dotSize;
  uniform float dotSpacing;
  uniform float noiseAmount;

  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    // Same "contain"-fit cutout mask as the front plane.
    float scale = imageAspect / faceAspect;
    vec2 uv = vec2((vUv.x - 0.5) / scale + 0.5, vUv.y);
    bool insideImage = uv.x >= 0.0 && uv.x <= 1.0;

    if (insideImage) {
      vec4 texColor = texture2D(map, uv);
      float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

      if (luminance <= threshold) {
        discard;
      }
    }

    vec2 cell = mod(gl_FragCoord.xy, dotSpacing);
    vec2 center = vec2(dotSpacing * 0.5);
    float dist = length(cell - center);

    // Hash per-pixel (not per-cell) so the dot edges pick up a noisy,
    // slightly blurry dither instead of the whole dot growing or shrinking.
    float noise = (random(gl_FragCoord.xy) - 0.5) * 2.0;
    float radius = max(dotSize * 0.5 + noise * noiseAmount * dotSpacing * 0.5, 0.0);

    vec3 outColor = dist < radius ? dotColor : backgroundColor;
    gl_FragColor = vec4(outColor, 1.0);

    #include <colorspace_fragment>
  }
`;

function FullscreenPlane() {
  const { width, height } = useThree((state) => state.viewport);
  const { color, threshold, count, spacing } = useControls({
    color: "#05020a",
    threshold: { value: 0.15, min: 0, max: 1, step: 0.01 },
    count: { value: 30, min: 1, max: 100, step: 1 },
    spacing: { value: 0.009, min: 0, max: 1, step: 0.0001 },
  });
  const { dotColor, dotBackgroundColor, dotSize, dotSpacing, noiseAmount } =
    useControls({
      Dots: folder({
        dotColor: "#7bc3e2",
        dotBackgroundColor: "#05020a",
        dotSize: { value: 4, min: 1, max: 100, step: 1 },
        dotSpacing: { value: 5, min: 5, max: 200, step: 1 },
        noiseAmount: { value: 0.06, min: 0, max: 1, step: 0.01 },
      }),
    });
  const texture = useTexture("/eric_chung.png", (loadedTexture) => {
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.needsUpdate = true;
  });
  const imageAspect = texture.image.width / texture.image.height;

  const frontUniforms = useMemo(
    () => ({
      map: { value: texture },
      color: { value: new THREE.Color(color) },
      faceAspect: { value: width / height },
      imageAspect: { value: imageAspect },
      threshold: { value: threshold },
    }),
    [texture, color, width, height, imageAspect, threshold],
  );

  const dotUniforms = useMemo(
    () => ({
      map: { value: texture },
      faceAspect: { value: width / height },
      imageAspect: { value: imageAspect },
      threshold: { value: threshold },
      dotColor: { value: new THREE.Color(dotColor) },
      backgroundColor: { value: new THREE.Color(dotBackgroundColor) },
      dotSize: { value: dotSize },
      dotSpacing: { value: dotSpacing },
      noiseAmount: { value: noiseAmount },
    }),
    [
      texture,
      width,
      height,
      imageAspect,
      threshold,
      dotColor,
      dotBackgroundColor,
      dotSize,
      dotSpacing,
      noiseAmount,
    ],
  );

  return (
    <>
      {Array.from({ length: count }, (_, i) =>
        i === 0 ? (
          <mesh key={i} position={[0, 0, 0]}>
            <planeGeometry args={[width, height]} />
            <shaderMaterial
              uniforms={frontUniforms}
              vertexShader={vertexShader}
              fragmentShader={fragmentShader}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : (
          <mesh key={i} position={[0, 0, -i * spacing]}>
            <planeGeometry args={[width, height]} />
            <shaderMaterial
              uniforms={dotUniforms}
              vertexShader={dotsVertexShader}
              fragmentShader={dotsFragmentShader}
              side={THREE.DoubleSide}
            />
          </mesh>
        ),
      )}
    </>
  );
}

function SpinningBox() {
  const meshRef = useRef(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.4;
    meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -15]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  );
}

function App() {
  const { background } = useControls({
    background: "#7bc3e2",
  });

  return (
    <Canvas camera={{ fov: 30 }}>
      <color attach="background" args={[background]} />
      <Environment preset="studio" />
      <SpinningBox />
      <FullscreenPlane />
      <OrbitControls />
    </Canvas>
  );
}

export default App;
