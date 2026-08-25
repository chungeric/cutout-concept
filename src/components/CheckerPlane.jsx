import { useRef } from "react";
import * as THREE from "three";
import {
  checkerboardFragmentShader,
  checkerboardVertexShader,
} from "../shaders/checkerboard";
import { useStableUniform } from "../hooks/useStableUniform";

export function CheckerPlane({ width, height, position, uniforms }) {
  const materialRef = useRef();
  useStableUniform(materialRef, "fluidMap", uniforms.fluidMap);
  useStableUniform(materialRef, "revealProgress", uniforms.revealProgress);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={checkerboardVertexShader}
        fragmentShader={checkerboardFragmentShader}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
