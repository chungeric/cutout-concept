import { cutoutVertexShader } from "./cutout";
import { perlinNoiseGLSL } from "./perlinNoise";

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
  uniform float noiseScale;
  uniform float progress;

  varying vec2 vUv;

  ${perlinNoiseGLSL}

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

    // Cut out using a thresholded noise pattern as a growing/shrinking
    // organic mask driven by progress: at progress 0 virtually nothing is
    // cut, and as it rises toward 1 more of the noise pattern falls below it
    // and gets cut away. Aspect-correct so the noise stays square instead of
    // stretching to the plane's own width/height ratio.
    vec2 noiseUv = vUv * vec2(faceAspect, 1.0) * noiseScale;
    float noiseValue = fbm(noiseUv) * 0.5 + 0.5;
    if (noiseValue < progress) {
      discard;
    }

    vec2 cell = floor(gl_FragCoord.xy / checkerScale);
    float parity = mod(cell.x + cell.y, 2.0);

    vec3 outColor = parity < 0.5 ? checkerColor : backgroundColor;
    gl_FragColor = vec4(outColor, 1.0);

    #include <colorspace_fragment>
  }
`;
