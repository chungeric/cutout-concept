import { perlinNoiseGLSL } from "./perlinNoise";

export const cutoutVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Used by the front and back planes: cuts out the black part of the source
// texture, and also cuts out wherever the fluid trail has flowed.
export const cutoutFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  uniform float faceAspect;
  uniform float imageAspect;
  uniform float threshold;
  uniform sampler2D fluidMap;
  uniform float fluidThreshold;
  uniform bool fluidEnabled;
  uniform bool debugTrailMap;
  uniform float noiseScale;
  uniform float progress;
  uniform bool debugNoiseMap;

  varying vec2 vUv;

  ${perlinNoiseGLSL}

  void main() {
    // Debug: show the raw fluid dye density directly, skipping the image
    // cutout and fluid-trail cutout entirely.
    if (debugTrailMap) {
      float fluidDensity = texture2D(fluidMap, vUv).r;
      gl_FragColor = vec4(vec3(fluidDensity), 1.0);
      #include <colorspace_fragment>
      return;
    }

    // Aspect-correct so the noise stays square instead of stretching to the
    // plane's own width/height ratio.
    vec2 noiseUv = vUv * vec2(faceAspect, 1.0) * noiseScale;

    // Debug: show the procedural noise directly, skipping normal rendering
    // entirely. Thresholded to a hard black/white cutoff (a contour line at
    // progress) instead of the raw smooth/blurry gradient.
    if (debugNoiseMap) {
      float noiseValue = fbm(noiseUv) * 0.5 + 0.5;
      float mask = step(progress, noiseValue);
      gl_FragColor = vec4(vec3(mask), 1.0);
      #include <colorspace_fragment>
      return;
    }

    // Fit the texture like CSS "background-size: contain", scaled to the
    // plane's full height. Horizontally it's centered, cropped if the image
    // is relatively wider than the plane, or letterboxed with the plane color
    // if the image is relatively narrower.
    float scale = imageAspect / faceAspect;
    vec2 uv = vec2((vUv.x - 0.5) / scale + 0.5, vUv.y);
    bool insideImage = uv.x >= 0.0 && uv.x <= 1.0;

    if (insideImage) {
      vec4 texColor = texture2D(map, uv);
      float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

      // Cut out the black part of the texture, revealing what's behind the plane.
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

    // Cut out using the same thresholded noise pattern shown in the debug
    // view, as a growing/shrinking organic mask driven by progress: at
    // progress 0 virtually nothing is cut, and as it rises toward 1 more of
    // the noise pattern falls below it and gets cut away.
    float noiseValue = fbm(noiseUv) * 0.5 + 0.5;
    if (noiseValue < progress) {
      discard;
    }

    gl_FragColor = vec4(color, 1.0);

    // #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
