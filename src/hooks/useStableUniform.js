import { useLayoutEffect } from "react";

// react-three-fiber copies each `{ value }` uniform container the first time
// it's attached to a ShaderMaterial, rather than keeping the original
// reference. That breaks uniforms that are mutated directly every frame
// (outside React's render cycle, e.g. the fluid sim's dye texture), since
// those mutations land on the original object while the material keeps
// sampling its stale copy. This re-attaches the original container by
// reference so those per-frame mutations reach the GPU immediately.
export function useStableUniform(materialRef, key, uniform) {
  useLayoutEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms[key] = uniform;
    }
  }, [materialRef, key, uniform]);
}
