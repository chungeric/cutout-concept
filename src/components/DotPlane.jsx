import { useRef } from "react";
import * as THREE from "three";
import { dotsFragmentShader, dotsVertexShader } from "../shaders/dots";
import { useStableUniform } from "../hooks/useStableUniform";

export function DotPlane({ width, height, position, uniforms }) {
  const materialRef = useRef();
  useStableUniform(materialRef, "fluidMap", uniforms.fluidMap);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={dotsVertexShader}
        fragmentShader={dotsFragmentShader}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
