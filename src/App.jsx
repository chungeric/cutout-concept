import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { folder, useControls } from "leva";
import "./App.css";
import { SpinningBox } from "./components/SpinningBox";
import { Particles } from "./components/Particles";
import { FullscreenPlanes } from "./components/FullscreenPlanes";

function App() {
  const { background, orbitEnabled } = useControls({
    Scene: folder(
      {
        background: "#7bc3e2",
        orbitEnabled: false,
      },
      { collapsed: true },
    ),
  });

  return (
    <Canvas camera={{ fov: 30 }}>
      <color attach="background" args={[background]} />
      <Environment preset="studio" />
      <SpinningBox />
      <Particles />
      <FullscreenPlanes orbitEnabled={orbitEnabled} />
      <OrbitControls enabled={orbitEnabled} />
    </Canvas>
  );
}

export default App;
