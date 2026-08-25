import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useControls } from "leva";
import {
  particlesFragmentShader,
  particlesVertexShader,
} from "../shaders/particles";

// Same depth as SpinningBox, so the particle cloud reads as filling the
// space around it, visible through the plane stack's cutout holes.
const CLOUD_POSITION = [0, 0, -15];

export function Particles() {
  const pointsRef = useRef(null);

  const {
    count,
    spread,
    depthSpread,
    size,
    color,
    opacity,
    softness,
    rotationSpeed,
  } = useControls(
    "Particles",
    {
      count: { value: 1000, min: 0, max: 1000, step: 10 },
      spread: { value: 20, min: 1, max: 40, step: 0.5 },
      depthSpread: { value: 20, min: 1, max: 30, step: 0.5 },
      size: { value: 0.31, min: 0.05, max: 1, step: 0.01 },
      color: "#ebb6ea",
      opacity: { value: 1, min: 0, max: 1, step: 0.05 },
      softness: { value: 0.18, min: 0, max: 1, step: 0.01 },
      rotationSpeed: { value: 0.2, min: 0, max: 0.5, step: 0.01 },
    },
    { collapsed: true },
  );

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      array[i * 3] = (Math.random() - 0.5) * spread;
      array[i * 3 + 1] = (Math.random() - 0.5) * spread;
      array[i * 3 + 2] = (Math.random() - 0.5) * depthSpread;
    }
    return array;
  }, [count, spread, depthSpread]);

  const uniforms = useMemo(
    () => ({
      size: { value: size },
      color: { value: new THREE.Color(color) },
      opacity: { value: opacity },
      softness: { value: softness },
    }),
    [size, color, opacity, softness],
  );

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    // Slow orbit around the box's own center rather than the scene origin,
    // since rotation happens in local space before the group's position
    // offset is applied.
    pointsRef.current.rotation.y += delta * rotationSpeed;
  });

  return (
    <points ref={pointsRef} position={CLOUD_POSITION}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={particlesVertexShader}
        fragmentShader={particlesFragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
