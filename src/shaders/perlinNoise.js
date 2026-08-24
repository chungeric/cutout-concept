// Classic 2D Perlin noise (Stefan Gustavson / Ashima Arts implementation),
// written for GLSL ES 1.00 so it runs the same as the rest of this project's
// shaders. Returns values in roughly [-1, 1]. Meant to be spliced into a
// fragment shader source via a template literal, so it can be shared between
// cutout.js and checkerboard.js without duplicating the function.
export const perlinNoiseGLSL = /* glsl */ `
  vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

  vec2 fade(vec2 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  float perlinNoise(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod(Pi, 289.0);
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;

    vec4 i = permute(permute(ix) + iy);

    vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 1/41
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;

    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);

    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
    g00 *= norm.x;
    g01 *= norm.y;
    g10 *= norm.z;
    g11 *= norm.w;

    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));

    vec2 fadeXY = fade(Pf.xy);
    vec2 nX = mix(vec2(n00, n01), vec2(n10, n11), fadeXY.x);
    float nXY = mix(nX.x, nX.y, fadeXY.y);
    return 2.3 * nXY;
  }

  // Fractal Brownian motion: sums several octaves of perlinNoise at
  // doubling frequency and halving amplitude, giving a more organic,
  // detailed pattern than a single octave alone.
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * perlinNoise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
`;
