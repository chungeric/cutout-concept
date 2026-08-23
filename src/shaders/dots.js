import { cutoutVertexShader } from "./cutout";

export const dotsVertexShader = cutoutVertexShader;

// Used by every plane other than the front/last one: keeps the same cutout
// masks (black-pixel texture + fluid trail), but fills the surviving area
// with a dot grid drawn in screen space (based on gl_FragCoord) instead of a
// solid color.
export const dotsFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float faceAspect;
  uniform float imageAspect;
  uniform float threshold;
  uniform sampler2D fluidMap;
  uniform float fluidThreshold;
  uniform bool fluidEnabled;
  uniform vec3 dotColor;
  uniform vec3 backgroundColor;
  uniform float dotSize;
  uniform float dotSpacing;
  uniform float noiseAmount;

  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
  }

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

    vec2 cell = mod(gl_FragCoord.xy, dotSpacing);
    vec2 center = vec2(dotSpacing * 0.5);
    float dist = length(cell - center);

    // Hash per-pixel (not per-cell) so the dot edges pick up a noisy,
    // slightly blurry dither instead of the whole dot growing or shrinking.
    float noise = (random(gl_FragCoord.xy) - 0.5) * 2.0;
    float radius = max(dotSize * 0.5 + noise * noiseAmount * dotSpacing * 0.5, 0.0);

    vec3 outColor = dist < radius ? dotColor : backgroundColor;
    gl_FragColor = vec4(outColor, 1.0);

    #include <colorspace_fragment>
  }
`;
