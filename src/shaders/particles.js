// Renders each point sprite as a soft-edged circle instead of a plain square,
// with the fade band width controlled at render time via a uniform (rather
// than baking a gradient into a texture), so it can be tuned live.

export const particlesVertexShader = /* glsl */ `
  uniform float size;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Basic perspective size attenuation: points shrink with distance from
    // the camera, matching how THREE.PointsMaterial's sizeAttenuation looks.
    gl_PointSize = size * (400.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const particlesFragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  uniform float softness;

  void main() {
    // gl_PointCoord spans the point sprite's square from (0,0) to (1,1);
    // recenter and scale so 0 = center, 1 = the inscribed circle's edge.
    float dist = length(gl_PointCoord - 0.5) * 2.0;

    // The fade band sits just inside the circle's edge; softness widens it
    // from an almost-hard cutoff up to a fade that starts at the center.
    float fadeStart = clamp(1.0 - max(softness, 0.001), 0.0, 1.0);
    float alpha = 1.0 - smoothstep(fadeStart, 1.0, dist);
    if (alpha <= 0.0) discard;

    gl_FragColor = vec4(color, alpha * opacity);
  }
`;
