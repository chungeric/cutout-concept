import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { useCursorTrail } from "../hooks/useCursorTrail";
import { FrontPlane } from "./FrontPlane";
import { BackPlane } from "./BackPlane";
import { CheckerPlane } from "./CheckerPlane";
import { ColorPlane } from "./ColorPlane";

// How far the plane stack tilts toward the cursor when orbit is off, and how
// quickly it eases toward that target each frame.
const MAX_TILT = 0.12;
const TILT_EASE = 0.05;

// Extra margin on top of the derived minimum overscan, to absorb the
// small-angle approximation below and the one-frame lag between the tilt
// easing toward MAX_TILT and the geometry being sized for it.
const TILT_SAFETY_BUFFER = 1.15;

export function FullscreenPlanes({ orbitEnabled }) {
  const groupRef = useRef(null);
  const { width, height, distance } = useThree((state) => state.viewport);

  // A tilted plane's worst-case corner (the one both axes push away from the
  // camera at once, e.g. bottom-left corner when tilting toward top-right)
  // recedes by roughly sin(tilt) * (half-width + half-height), which shrinks
  // its projected size by a factor of (1 - that / distance). Oversize by the
  // inverse of that so the plane still reaches every screen edge at max
  // tilt, instead of assuming a single edge tilting on one axis (too
  // optimistic - real corners recede further under combined X+Y tilt, and
  // the required margin scales with aspect ratio and camera distance too).
  const tiltRecession =
    (Math.sin(MAX_TILT) * (width + height)) / (2 * distance);
  const planeOverscan = TILT_SAFETY_BUFFER / (1 - Math.min(tiltRecession, 0.9));
  const planeWidth = width * planeOverscan;
  const planeHeight = height * planeOverscan;
  const { planesVisible, color, threshold, count, spacing } = useControls({
    Planes: folder(
      {
        planesVisible: true,
        color: "#07030d",
        threshold: { value: 0.15, min: 0, max: 1, step: 0.01 },
        count: { value: 44, min: 1, max: 100, step: 1 },
        spacing: { value: 0.01, min: 0, max: 1, step: 0.0001 },
      },
      { collapsed: true },
    ),
  });
  const {
    trailEnabled,
    debugTrailMap,
    trailRadius,
    trailDecay,
    fluidThreshold,
  } = useControls({
    Trail: folder(
      {
        trailEnabled: true,
        debugTrailMap: false,
        trailRadius: { value: 0.1, min: 0.01, max: 0.3, step: 0.01 },
        trailDecay: { value: 0.92, min: 0.8, max: 1, step: 0.01 },
        fluidThreshold: { value: 0.74, min: 0.01, max: 1, step: 0.01 },
      },
      { collapsed: true },
    ),
  });
  const { debugReveal, noiseScale, octaves, revealProgress } = useControls({
    Reveal: folder(
      {
        debugReveal: false,
        noiseScale: { value: 6, min: 1, max: 20, step: 1 },
        octaves: { value: 4, min: 1, max: 8, step: 1 },
        revealProgress: { value: 0, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: true },
    ),
  });
  const {
    middlePattern,
    middleColor,
    checkerColor,
    checkerBackgroundColor,
    checkerScale,
  } = useControls({
    "Middle Pattern": folder(
      {
        middlePattern: {
          value: "Checkerboard",
          options: ["Color", "Checkerboard"],
        },
        Color: folder({ middleColor: "#7bc3e2" }, { collapsed: true }),
        Checkerboard: folder(
          {
            checkerColor: "#e9ff00",
            checkerBackgroundColor: "#00db37",
            checkerScale: { value: 3, min: 2, max: 10, step: 1 },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  });
  const texture = useTexture("/eric_chung.png", (loadedTexture) => {
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.needsUpdate = true;
  });
  const imageAspect = texture.image.width / texture.image.height;

  const fluidMapUniform = useCursorTrail({
    width: planeWidth,
    height: planeHeight,
    depth: (count - 1) * spacing,
    groupRef,
    enabled: trailEnabled,
    radius: trailRadius,
    decay: trailDecay,
  });

  const frontUniforms = useMemo(
    () => ({
      map: { value: texture },
      color: { value: new THREE.Color(color) },
      faceAspect: { value: width / height },
      imageAspect: { value: imageAspect },
      threshold: { value: threshold },
      fluidMap: fluidMapUniform,
      fluidThreshold: { value: fluidThreshold },
      fluidEnabled: { value: trailEnabled },
      debugTrailMap: { value: debugTrailMap },
      noiseScale: { value: noiseScale },
      octaves: { value: octaves },
      revealProgress: { value: revealProgress },
      debugReveal: { value: debugReveal },
    }),
    [
      texture,
      color,
      width,
      height,
      imageAspect,
      threshold,
      fluidMapUniform,
      fluidThreshold,
      trailEnabled,
      debugTrailMap,
      noiseScale,
      octaves,
      revealProgress,
      debugReveal,
    ],
  );

  const checkerUniforms = useMemo(
    () => ({
      map: { value: texture },
      faceAspect: { value: width / height },
      imageAspect: { value: imageAspect },
      threshold: { value: threshold },
      fluidMap: fluidMapUniform,
      fluidThreshold: { value: fluidThreshold },
      fluidEnabled: { value: trailEnabled },
      checkerColor: { value: new THREE.Color(checkerColor) },
      backgroundColor: { value: new THREE.Color(checkerBackgroundColor) },
      checkerScale: { value: checkerScale },
      noiseScale: { value: noiseScale },
      octaves: { value: octaves },
      revealProgress: { value: revealProgress },
    }),
    [
      texture,
      width,
      height,
      imageAspect,
      threshold,
      fluidMapUniform,
      fluidThreshold,
      trailEnabled,
      checkerColor,
      checkerBackgroundColor,
      checkerScale,
      noiseScale,
      octaves,
      revealProgress,
    ],
  );

  const middleColorUniforms = useMemo(
    () => ({
      map: { value: texture },
      color: { value: new THREE.Color(middleColor) },
      faceAspect: { value: width / height },
      imageAspect: { value: imageAspect },
      threshold: { value: threshold },
      fluidMap: fluidMapUniform,
      fluidThreshold: { value: fluidThreshold },
      fluidEnabled: { value: trailEnabled },
      noiseScale: { value: noiseScale },
      octaves: { value: octaves },
      revealProgress: { value: revealProgress },
    }),
    [
      texture,
      middleColor,
      width,
      height,
      imageAspect,
      threshold,
      fluidMapUniform,
      fluidThreshold,
      trailEnabled,
      noiseScale,
      octaves,
      revealProgress,
    ],
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    // When orbit is off, gently tilt the whole stack toward the cursor for a
    // subtle parallax feel. When orbit is on, the user is driving the camera
    // directly, so ease the tilt back to neutral instead of fighting it.
    const targetRotationY = orbitEnabled ? 0 : state.pointer.x * MAX_TILT;
    const targetRotationX = orbitEnabled ? 0 : -state.pointer.y * MAX_TILT;

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotationY,
      TILT_EASE,
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotationX,
      TILT_EASE,
    );
  });

  return (
    <group ref={groupRef} visible={planesVisible}>
      {Array.from({ length: count }, (_, i) => {
        const position = [0, 0, -i * spacing];

        if (i === 0) {
          return (
            <FrontPlane
              key={i}
              width={planeWidth}
              height={planeHeight}
              position={position}
              uniforms={frontUniforms}
            />
          );
        }

        if (i === count - 1) {
          return (
            <BackPlane
              key={i}
              width={planeWidth}
              height={planeHeight}
              position={position}
              uniforms={frontUniforms}
            />
          );
        }

        if (middlePattern === "Checkerboard") {
          return (
            <CheckerPlane
              key={i}
              width={planeWidth}
              height={planeHeight}
              position={position}
              uniforms={checkerUniforms}
            />
          );
        }

        return (
          <ColorPlane
            key={i}
            width={planeWidth}
            height={planeHeight}
            position={position}
            uniforms={middleColorUniforms}
          />
        );
      })}
    </group>
  );
}
