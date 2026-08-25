import { useMemo } from "react";
import * as THREE from "three";
import {
  EffectComposer,
  Bloom,
  Pixelation,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { folder, useControls } from "leva";

export function PostProcessing() {
  const { bloomEnabled, intensity, luminanceThreshold, luminanceSmoothing, mipmapBlur } =
    useControls({
      Bloom: folder(
        {
          bloomEnabled: true,
          intensity: { value: 1, min: 0, max: 5, step: 0.05 },
          luminanceThreshold: { value: 0.25, min: 0, max: 1, step: 0.01 },
          luminanceSmoothing: { value: 0.9, min: 0, max: 1, step: 0.01 },
          mipmapBlur: true,
        },
        { collapsed: true },
      ),
    });

  const { pixelationEnabled, granularity } = useControls({
    Pixelation: folder(
      {
        pixelationEnabled: true,
        granularity: { value: 3, min: 1, max: 30, step: 1 },
      },
      { collapsed: true },
    ),
  });

  const { chromaticAberrationEnabled, offset } = useControls({
    "Chromatic Aberration": folder(
      {
        chromaticAberrationEnabled: true,
        offset: { value: 0.0005, min: 0, max: 0.01, step: 0.0001 },
      },
      { collapsed: true },
    ),
  });
  const chromaticOffset = useMemo(
    () => new THREE.Vector2(offset, offset),
    [offset],
  );

  if (!bloomEnabled && !pixelationEnabled && !chromaticAberrationEnabled) {
    return null;
  }

  return (
    <EffectComposer>
      {bloomEnabled && (
        <Bloom
          intensity={intensity}
          luminanceThreshold={luminanceThreshold}
          luminanceSmoothing={luminanceSmoothing}
          mipmapBlur={mipmapBlur}
        />
      )}
      {pixelationEnabled && <Pixelation granularity={granularity} />}
      {chromaticAberrationEnabled && (
        <ChromaticAberration offset={chromaticOffset} />
      )}
    </EffectComposer>
  );
}
