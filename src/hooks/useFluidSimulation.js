import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createFluidSim,
  runAdvection,
  runSplat,
} from "../shaders/fluidSimulation";

/**
 * Runs a lightweight GPU fluid simulation (velocity + dye fields) driven by
 * the pointer, and exposes the resulting dye density as a shared texture
 * uniform (`{ value: THREE.Texture | null }`) that any material can sample
 * as `fluidMap`.
 */
export function useFluidSimulation({
  width,
  height,
  depth,
  enabled,
  splatRadius,
  splatForce,
  velocityDissipation,
  dyeDissipation,
}) {
  const gl = useThree((state) => state.gl);

  // Shared, stable uniform container so every plane's material can point at
  // the same (frame-to-frame swapped) fluid dye texture.
  const fluidMapUniform = useMemo(() => ({ value: null }), []);

  // The fluid sim's Three.js objects live entirely inside a ref and are only
  // ever touched inside useEffect/useFrame (never read during render).
  const fluidRef = useRef(null);

  // Reused every frame to project the pointer onto the plane stack's surface
  // instead of treating screen-space NDC as if it were plane UV. The stack
  // spans from z = 0 (front) to z = -depth (back); since OrbitControls can
  // orbit the camera to either side, we test both boundary planes and use
  // whichever one the ray actually hits first (closest to the camera).
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const nearSurface = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    [],
  );
  const farSurface = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    [],
  );
  const surfaceHit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    fluidRef.current = createFluidSim();
    return () => {
      fluidRef.current?.dispose();
      fluidRef.current = null;
    };
  }, []);

  // Ignore the pointer's default (0, 0) position until the user actually
  // moves the mouse, so we don't start with a permanent hole at the center.
  useEffect(() => {
    function handlePointerMove() {
      if (fluidRef.current) {
        fluidRef.current.hasPointer = true;
      }
    }
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  useFrame((state, delta) => {
    const fluid = fluidRef.current;
    if (!fluid) return;

    const dt = Math.min(delta, 1 / 30);
    const aspect = width / height;

    if (fluid.hasPointer && enabled) {
      farSurface.constant = depth;

      raycaster.setFromCamera(state.pointer, state.camera);
      const nearT = raycaster.ray.distanceToPlane(nearSurface);
      const farT = raycaster.ray.distanceToPlane(farSurface);

      let closestT = nearT;
      if (farT !== null && (closestT === null || farT < closestT)) {
        closestT = farT;
      }

      if (closestT !== null) {
        raycaster.ray.at(closestT, surfaceHit);
        fluid.pointerUv.set(
          surfaceHit.x / width + 0.5,
          surfaceHit.y / height + 0.5,
        );
        fluid.velocityImpulse
          .copy(fluid.pointerUv)
          .sub(fluid.lastPointerUv)
          .multiplyScalar(1 / Math.max(dt, 1e-4));
        fluid.lastPointerUv.copy(fluid.pointerUv);

        runSplat(
          gl,
          fluid,
          fluid.velocity,
          fluid.pointerUv,
          fluid.splatColorScratch.set(
            fluid.velocityImpulse.x * splatForce,
            fluid.velocityImpulse.y * splatForce,
            0,
          ),
          splatRadius,
          aspect,
        );

        runSplat(
          gl,
          fluid,
          fluid.dye,
          fluid.pointerUv,
          fluid.splatColorScratch.set(1, 1, 1),
          splatRadius,
          aspect,
        );
      }
    }

    // Self-advect the velocity field, then advect the dye by that velocity.
    runAdvection(
      gl,
      fluid,
      fluid.velocity,
      fluid.velocity.read.texture,
      dt,
      velocityDissipation,
    );
    runAdvection(
      gl,
      fluid,
      fluid.dye,
      fluid.velocity.read.texture,
      dt,
      dyeDissipation,
    );

    fluidMapUniform.value = fluid.dye.read.texture;
  });

  return fluidMapUniform;
}
