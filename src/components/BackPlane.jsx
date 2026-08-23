import { useRef } from "react";
import * as THREE from "three";
import { cutoutFragmentShader, cutoutVertexShader } from "../shaders/cutout";
import { useStableUniform } from "../hooks/useStableUniform";

export function BackPlane({ width, height, position, uniforms }) {
  const materialRef = useRef();
  useStableUniform(materialRef, "fluidMap", uniforms.fluidMap);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={cutoutVertexShader}
        fragmentShader={cutoutFragmentShader}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
