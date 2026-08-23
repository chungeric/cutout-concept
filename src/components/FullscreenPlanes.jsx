import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { useFluidSimulation } from "../hooks/useFluidSimulation";
import { FrontPlane } from "./FrontPlane";
import { BackPlane } from "./BackPlane";
import { DotPlane } from "./DotPlane";

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
  const { color, threshold, count, spacing } = useControls({
    color: "#05020a",
    threshold: { value: 0.15, min: 0, max: 1, step: 0.01 },
    count: { value: 30, min: 1, max: 100, step: 1 },
    spacing: { value: 0.009, min: 0, max: 1, step: 0.0001 },
  });
  const {
    fluidTrailEnabled,
    debugFluidMap,
    splatRadius,
    splatForce,
    velocityDissipation,
    dyeDissipation,
    pressureIterations,
    viscosityIterations,
    fluidThreshold,
  } = useControls({
    Fluid: folder({
      fluidTrailEnabled: true,
      debugFluidMap: false,
      splatRadius: { value: 0.06, min: 0.01, max: 0.3, step: 0.01 },
      splatForce: { value: 1.0, min: 0, max: 20, step: 0.5 },
      velocityDissipation: { value: 0.995, min: 0.9, max: 1, step: 0.001 },
      dyeDissipation: { value: 0.93, min: 0.8, max: 1, step: 0.005 },
      pressureIterations: { value: 20, min: 0, max: 50, step: 1 },
      viscosityIterations: { value: 6, min: 0, max: 30, step: 1 },
      fluidThreshold: { value: 0.44, min: 0.01, max: 1, step: 0.01 },
    }),
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

  const fluidMapUniform = useFluidSimulation({
    width: planeWidth,
    height: planeHeight,
    depth: (count - 1) * spacing,
    groupRef,
    enabled: fluidTrailEnabled,
    splatRadius,
    splatForce,
    velocityDissipation,
    dyeDissipation,
    pressureIterations,
    viscosityIterations,
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
      fluidEnabled: { value: fluidTrailEnabled },
      debugFluidMap: { value: debugFluidMap },
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
      fluidTrailEnabled,
      debugFluidMap,
    ],
  );

  const dotUniforms = useMemo(
    () => ({
      map: { value: texture },
      faceAspect: { value: width / height },
      imageAspect: { value: imageAspect },
      threshold: { value: threshold },
      fluidMap: fluidMapUniform,
      fluidThreshold: { value: fluidThreshold },
      fluidEnabled: { value: fluidTrailEnabled },
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
      fluidMapUniform,
      fluidThreshold,
      fluidTrailEnabled,
      dotColor,
      dotBackgroundColor,
      dotSize,
      dotSpacing,
      noiseAmount,
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
    <group ref={groupRef}>
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

        return (
          <DotPlane
            key={i}
            width={planeWidth}
            height={planeHeight}
            position={position}
            uniforms={dotUniforms}
          />
        );
      })}
    </group>
  );
}
