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

  varying vec2 vUv;

  void main() {
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

    gl_FragColor = vec4(color, 1.0);

    // #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
