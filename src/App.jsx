import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { button, folder, levaStore, useControls } from "leva";
import "./App.css";
import { SpinningBox } from "./components/SpinningBox";
import { Particles } from "./components/Particles";
import { FullscreenPlanes } from "./components/FullscreenPlanes";
import { PostProcessing } from "./components/PostProcessing";

function App() {
  const pointerDownRef = useRef(false);
  const { background, orbitEnabled, quality } = useControls({
    Scene: folder(
      {
        background: "#330e4b",
        orbitEnabled: false,
        quality: { value: 1, min: 0.25, max: 2, step: 0.05 },
      },
      { collapsed: true },
    ),
  });

  useControls({
    "Copy Values": {
      ...button(() => {
        const data = levaStore.getData();
        const values = Object.fromEntries(
          Object.entries(data)
            .filter(([, input]) => input.type !== "BUTTON")
            .map(([path, input]) => [path, input.value]),
        );
        navigator.clipboard.writeText(JSON.stringify(values, null, 2));
      }),
      // Root-level controls/folders default to order 0 and are otherwise
      // sorted by hook-registration order, so this pushes the button below
      // every folder regardless of where the other components mount.
      order: 100,
    },
  });

  return (
    <Canvas
      camera={{ fov: 30 }}
      dpr={quality}
      onPointerDown={() => {
        pointerDownRef.current = true;
      }}
      onPointerUp={() => {
        pointerDownRef.current = false;
      }}
    >
      <color attach="background" args={[background]} />
      <Environment preset="studio" />
      <SpinningBox />
      <Particles />
      <FullscreenPlanes
        orbitEnabled={orbitEnabled}
        pointerDownRef={pointerDownRef}
      />
      <OrbitControls enabled={orbitEnabled} />
      <PostProcessing />
    </Canvas>
  );
}

export default App;
