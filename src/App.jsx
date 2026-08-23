import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "./App.css";
import { Environment, OrbitControls, useTexture } from "@react-three/drei";
import { useControls } from "leva";

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

function FullscreenPlane() {
  const { width, height } = useThree((state) => state.viewport);
  const { color, fadeColor, threshold, count, spacing } = useControls({
    color: "#05020a",
    fadeColor: "#0e1424",
    threshold: { value: 0.15, min: 0, max: 1, step: 0.01 },
    count: { value: 50, min: 1, max: 100, step: 1 },
    spacing: { value: 0.009, min: 0, max: 1, step: 0.0001 },
  });
  const texture = useTexture("/eric_chung.png", (loadedTexture) => {
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.needsUpdate = true;
  });
  const imageAspect = texture.image.width / texture.image.height;

  const planeUniforms = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Fade each successive plane's color toward `fadeColor`, so the last
        // plane blends in completely instead of relying on alpha (which
        // compounds toward opaque as more overlapping transparent layers stack).
        const t = count > 1 ? i / (count - 1) : 0;
        const fadedColor = new THREE.Color(color).lerp(
          new THREE.Color(fadeColor),
          t,
        );

        return {
          map: { value: texture },
          color: { value: fadedColor },
          faceAspect: { value: width / height },
          imageAspect: { value: imageAspect },
          threshold: { value: threshold },
        };
      }),
    [count, texture, color, fadeColor, width, height, imageAspect, threshold],
  );

  return (
    <>
      {planeUniforms.map((uniforms, i) => (
        <mesh key={i} position={[0, 0, -i * spacing]}>
          <planeGeometry args={[width, height]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
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
