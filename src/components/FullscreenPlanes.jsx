import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { useFluidSimulation } from "../hooks/useFluidSimulation";
import { FrontPlane } from "./FrontPlane";
import { BackPlane } from "./BackPlane";
import { DotPlane } from "./DotPlane";

export function FullscreenPlanes() {
  const { width, height } = useThree((state) => state.viewport);
  const { color, threshold, count, spacing } = useControls({
    color: "#05020a",
    threshold: { value: 0.15, min: 0, max: 1, step: 0.01 },
    count: { value: 30, min: 1, max: 100, step: 1 },
    spacing: { value: 0.009, min: 0, max: 1, step: 0.0001 },
  });
  const {
    fluidTrailEnabled,
    splatRadius,
    splatForce,
    velocityDissipation,
    dyeDissipation,
    fluidThreshold,
  } = useControls({
    Fluid: folder({
      fluidTrailEnabled: true,
      splatRadius: { value: 0.05, min: 0.01, max: 0.3, step: 0.01 },
      splatForce: { value: 6, min: 0, max: 20, step: 0.5 },
      velocityDissipation: { value: 0.995, min: 0.9, max: 1, step: 0.001 },
      dyeDissipation: { value: 0.96, min: 0.8, max: 1, step: 0.005 },
      fluidThreshold: { value: 0.15, min: 0.01, max: 1, step: 0.01 },
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
    width,
    height,
    depth: (count - 1) * spacing,
    enabled: fluidTrailEnabled,
    splatRadius,
    splatForce,
    velocityDissipation,
    dyeDissipation,
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

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const position = [0, 0, -i * spacing];

        if (i === 0) {
          return (
            <FrontPlane
              key={i}
              width={width}
              height={height}
              position={position}
              uniforms={frontUniforms}
            />
          );
        }

        if (i === count - 1) {
          return (
            <BackPlane
              key={i}
              width={width}
              height={height}
              position={position}
              uniforms={frontUniforms}
            />
          );
        }

        return (
          <DotPlane
            key={i}
            width={width}
            height={height}
            position={position}
            uniforms={dotUniforms}
          />
        );
      })}
    </>
  );
}
