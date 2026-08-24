import { cutoutVertexShader } from "./cutout";

export const checkerboardVertexShader = cutoutVertexShader;

// Used by every plane other than the front/last one: keeps the same cutout
// masks (black-pixel texture + fluid trail), but fills the surviving area
// with a plain checkerboard drawn in screen space (gl_FragCoord) instead of
// a solid color.
export const checkerboardFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float faceAspect;
  uniform float imageAspect;
  uniform float threshold;
  uniform sampler2D fluidMap;
  uniform float fluidThreshold;
  uniform bool fluidEnabled;
  uniform vec3 checkerColor;
  uniform vec3 backgroundColor;
  uniform float checkerScale;

  varying vec2 vUv;

  void main() {
    // Same "contain"-fit cutout mask as the front plane.
    float scale = imageAspect / faceAspect;
    vec2 uv = vec2((vUv.x - 0.5) / scale + 0.5, vUv.y);
    bool insideImage = uv.x >= 0.0 && uv.x <= 1.0;

    if (insideImage) {
      vec4 texColor = texture2D(map, uv);
      float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

      if (luminance <= threshold) {
        discard;
      }
    }

    // Cut out wherever the fluid trail has flowed, unless the trail is disabled.
    if (fluidEnabled) {
      float fluidDensity = texture2D(fluidMap, vUv).r;
      if (fluidDensity > fluidThreshold) {
        discard;
      }
    }

    vec2 cell = floor(gl_FragCoord.xy / checkerScale);
    float parity = mod(cell.x + cell.y, 2.0);

    vec3 outColor = parity < 0.5 ? checkerColor : backgroundColor;
    gl_FragColor = vec4(outColor, 1.0);

    #include <colorspace_fragment>
  }
`;
