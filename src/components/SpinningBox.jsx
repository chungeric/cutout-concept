import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { folder, useControls } from "leva";

export function SpinningBox() {
  const meshRef = useRef(null);

  const { size, color } = useControls({
    "Spinning Box": folder(
      {
        size: { value: 2, min: 0.1, max: 10, step: 0.1 },
        color: "#ffff00",
      },
      { collapsed: true },
    ),
  });

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.4;
    meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -15]}>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
