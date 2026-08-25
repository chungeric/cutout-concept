import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { folder, useControls } from "leva";

// Standard easing curves, applied to normalized progress (0-1) through the
// current transition before lerping between its start value and target.
const EASING_FUNCTIONS = {
  Linear: (t) => t,
  "Ease In (quad)": (t) => t * t,
  "Ease Out (quad)": (t) => t * (2 - t),
  "Ease In Out (quad)": (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  "Ease In (cubic)": (t) => t * t * t,
  "Ease Out (cubic)": (t) => 1 - (1 - t) ** 3,
  "Ease In Out (cubic)": (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
};

// Drives revealProgressUniform.value every frame, either from pointer-down
// state (tracked via the Canvas's own onPointerDown/onPointerUp props in
// App.jsx) tweened over `revealDuration` seconds with the chosen `easing`
// curve, or directly from the Leva slider when pointer control is switched
// off. Also mirrors automatic changes back into the Leva panel so the slider
// visibly animates. Isolated into its own component (rather than living in
// FullscreenPlanes) so the per-frame `set` call's re-render doesn't also
// re-render the whole plane stack.
export function RevealProgress({ revealProgressUniform, pointerDownRef }) {
  // Tracks the in-flight tween: the value/time it started from, and which
  // target (0 or 1) it's currently heading toward.
  const transitionRef = useRef({ startValue: 0, startTime: 0, target: 0 });

  const [
    { pointerControlEnabled, revealDuration, easing, revealProgress },
    setReveal,
  ] = useControls(() => ({
    Reveal: folder(
      {
        pointerControlEnabled: true,
        revealDuration: { value: 1.7, min: 0.1, max: 5, step: 0.1 },
        easing: {
          value: "Ease Out (quad)",
          options: Object.keys(EASING_FUNCTIONS),
        },
        revealProgress: { value: 0, min: 0, max: 1, step: 0.01 },
      },
      { collapsed: true },
    ),
  }));

  useFrame((state) => {
    const transition = transitionRef.current;

    if (!pointerControlEnabled) {
      // Manual mode: the slider is the source of truth, just forward it to
      // the shaders, and keep the tween's start point in sync so re-enabling
      // pointer control eases from wherever the slider was left.
      revealProgressUniform.value = revealProgress;
      transition.startValue = revealProgress;
      transition.target = revealProgress;
      transition.startTime = state.clock.elapsedTime;
      return;
    }

    const target = pointerDownRef.current ? 1 : 0;
    if (target !== transition.target) {
      transition.startValue = revealProgressUniform.value;
      transition.startTime = state.clock.elapsedTime;
      transition.target = target;
    }

    const t = THREE.MathUtils.clamp(
      (state.clock.elapsedTime - transition.startTime) / revealDuration,
      0,
      1,
    );
    const ease = EASING_FUNCTIONS[easing] ?? EASING_FUNCTIONS.Linear;
    const next = THREE.MathUtils.lerp(transition.startValue, target, ease(t));

    if (next !== revealProgressUniform.value) {
      revealProgressUniform.value = next;
      setReveal({ revealProgress: next });
    }
  });

  return null;
}
