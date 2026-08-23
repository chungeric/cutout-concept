import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createTrail, runTrailStep } from "../shaders/trail";

// Below this much on-plane UV movement per frame, treat the pointer as
// stationary and stop adding paint, so a resting cursor doesn't keep
// replenishing a permanent blob faster than decay can fade it.
const STATIONARY_EPSILON = 1e-5;

/**
 * Paints a soft, fading trail wherever the pointer moves across the plane
 * stack, and exposes it as a shared texture uniform (`{ value: THREE.Texture
 * | null }`) that any material can sample as `fluidMap`.
 */
export function useCursorTrail({
  width,
  height,
  depth,
  groupRef,
  enabled,
  radius,
  decay,
}) {
  const gl = useThree((state) => state.gl);

  // Shared, stable uniform container so every plane's material can point at
  // the same (frame-to-frame swapped) trail texture.
  const trailMapUniform = useMemo(() => ({ value: null }), []);

  // The trail's Three.js objects live entirely inside a ref and are only
  // ever touched inside useEffect/useFrame (never read during render).
  const trailRef = useRef(null);

  // Reused every frame to project the pointer onto the plane stack's surface
  // instead of treating screen-space NDC as if it were plane UV. The stack
  // spans from local z = 0 (front) to z = -depth (back); since OrbitControls
  // can orbit the camera to either side, we test both boundary planes and use
  // whichever one the ray actually hits first (closest to the camera). The
  // group holding the planes can also be tilted (see the cursor-tilt effect
  // in FullscreenPlanes), so these planes are rebuilt from the group's live
  // world transform every frame rather than assumed to sit flat at z = 0.
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const nearSurface = useMemo(() => new THREE.Plane(), []);
  const farSurface = useMemo(() => new THREE.Plane(), []);
  const surfaceHit = useMemo(() => new THREE.Vector3(), []);
  const surfaceNormal = useMemo(() => new THREE.Vector3(), []);
  const surfacePoint = useMemo(() => new THREE.Vector3(), []);
  const localHit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    trailRef.current = createTrail();
    return () => {
      trailRef.current?.dispose();
      trailRef.current = null;
    };
  }, []);

  // Ignore the pointer's default (0, 0) position until the user actually
  // moves the mouse, so we don't start with a permanent hole at the center.
  useEffect(() => {
    function handlePointerMove() {
      if (trailRef.current) {
        trailRef.current.hasPointer = true;
      }
    }
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  useFrame((state) => {
    const trail = trailRef.current;
    if (!trail) return;

    const aspect = width / height;
    const group = groupRef.current;
    let isMoving = false;

    if (trail.hasPointer && enabled && group) {
      group.updateWorldMatrix(true, false);

      surfaceNormal.set(0, 0, 1).transformDirection(group.matrixWorld);
      surfacePoint.set(0, 0, 0).applyMatrix4(group.matrixWorld);
      nearSurface.setFromNormalAndCoplanarPoint(surfaceNormal, surfacePoint);

      surfacePoint.set(0, 0, -depth).applyMatrix4(group.matrixWorld);
      farSurface.setFromNormalAndCoplanarPoint(surfaceNormal, surfacePoint);

      raycaster.setFromCamera(state.pointer, state.camera);
      const nearT = raycaster.ray.distanceToPlane(nearSurface);
      const farT = raycaster.ray.distanceToPlane(farSurface);

      let closestT = nearT;
      if (farT !== null && (closestT === null || farT < closestT)) {
        closestT = farT;
      }

      if (closestT !== null) {
        raycaster.ray.at(closestT, surfaceHit);
        group.worldToLocal(localHit.copy(surfaceHit));
        trail.pointerUv.set(
          localHit.x / width + 0.5,
          localHit.y / height + 0.5,
        );

        isMoving =
          trail.pointerUv.distanceTo(trail.lastPointerUv) > STATIONARY_EPSILON;
      }
    }

    // Always run the fade so an existing trail dies away even while the
    // pointer is off-plane, disabled, or stationary; only paint a fresh
    // stroke (intensity 1) when the pointer actually moved this frame.
    runTrailStep(
      gl,
      trail,
      trail.lastPointerUv,
      trail.pointerUv,
      radius,
      aspect,
      decay,
      isMoving ? 1 : 0,
    );
    trail.lastPointerUv.copy(trail.pointerUv);

    trailMapUniform.value = trail.read.texture;
  });

  return trailMapUniform;
}
