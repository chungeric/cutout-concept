import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { folder, useControls } from "leva";
import "./App.css";
import { SpinningBox } from "./components/SpinningBox";
import { Particles } from "./components/Particles";
import { FullscreenPlanes } from "./components/FullscreenPlanes";
import { PostProcessing } from "./components/PostProcessing";

function App() {
  const { background, orbitEnabled, quality } = useControls({
    Scene: folder(
      {
        background: "#330e4b",
        orbitEnabled: false,
        quality: { value: 0.5, min: 0.25, max: 2, step: 0.05 },
      },
      { collapsed: true },
    ),
  });

  return (
    <Canvas camera={{ fov: 30 }} dpr={quality}>
      <color attach="background" args={[background]} />
      <Environment preset="studio" />
      <SpinningBox />
      <Particles />
      <FullscreenPlanes orbitEnabled={orbitEnabled} />
      <OrbitControls enabled={orbitEnabled} />
      <PostProcessing />
    </Canvas>
  );
}

export default App;
