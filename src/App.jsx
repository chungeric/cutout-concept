import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { useControls } from "leva";
import "./App.css";
import { SpinningBox } from "./components/SpinningBox";
import { FullscreenPlanes } from "./components/FullscreenPlanes";

function App() {
  const { background, orbitEnabled } = useControls({
    background: "#7bc3e2",
    orbitEnabled: false,
  });

  return (
    <Canvas camera={{ fov: 30 }}>
      <color attach="background" args={[background]} />
      <Environment preset="studio" />
      <SpinningBox />
      <FullscreenPlanes orbitEnabled={orbitEnabled} />
      <OrbitControls enabled={orbitEnabled} />
    </Canvas>
  );
}

export default App;
