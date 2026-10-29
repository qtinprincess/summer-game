// 景深＋後製：Claude Code 手寫的 GLSL。
// 場景先畫進有深度貼圖的 RenderTarget，再由這支全螢幕 shader：
//   1) 用深度算每個像素的彌散圈（CoC），以黃金角螺旋取樣做散景模糊
//   2) 取樣時用「該取樣點自己的 CoC」加權，清晰的前景不會暈到背景
//   3) 疊閃電白閃、暈影、紙張顆粒（每秒 12 格才換，跟停格同步）、淡入淡出，最後 linear → sRGB
import * as THREE from 'three';

const vert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2  uRes;
uniform vec2  uNearFar;
uniform float uFocus;      // 對焦距離（世界單位）
uniform float uAperture;   // 光圈：越大背景越糊
uniform float uMaxCoC;     // 最大模糊半徑（像素）
uniform float uFlash;      // 閃電白閃
uniform float uFade;       // 0 = 全黑, 1 = 正常
uniform float uGrainSeed;  // 以 12fps 步進
uniform float uWarm;       // 雨後暖色

const int TAPS = 40;
const float GOLDEN = 2.39996323;

float linearZ(float d){
  float z = d * 2.0 - 1.0;
  return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - z * (uNearFar.y - uNearFar.x));
}
float cocAt(vec2 uv){
  float z = linearZ(texture2D(tDepth, uv).x);
  return clamp(uAperture * abs(1.0 / uFocus - 1.0 / z) * uFocus * 40.0, 0.0, uMaxCoC);
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main(){
  vec2 px = 1.0 / uRes;
  float coc = cocAt(vUv);
  vec3 col = texture2D(tColor, vUv).rgb;
  if (coc > 0.6) {
    vec3 acc = col; float wsum = 1.0;
    float rot = hash12(gl_FragCoord.xy) * 6.2831;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / float(TAPS)) * coc;
      float a = fi * GOLDEN + rot;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r * px;
      float cs = cocAt(uv);
      float w = smoothstep(r - 1.0, r + 1.0, cs);
      vec3 s = texture2D(tColor, uv).rgb;
      // 亮部加權，散景光斑會更像相機
      w *= 1.0 + dot(s, vec3(0.33)) * 0.6;
      acc += s * w; wsum += w;
    }
    col = acc / wsum;
  }
  col += vec3(1.0, 0.97, 0.88) * uFlash * 0.14;
  col *= mix(vec3(1.0), vec3(1.06, 1.0, 0.92), uWarm);
  col = aces(col * 1.08);
  col = toSRGB(col);
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.85;
  float g = hash12(gl_FragCoord.xy + uGrainSeed * 91.7) - 0.5;
  col += g * 0.035;
  col *= uFade;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createPost(renderer, W, H, camera) {
  const rt = new THREE.WebGLRenderTarget(W, H, {
    type: THREE.HalfFloatType, samples: 4, depthBuffer: true,
    depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType),
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(W, H) },
      uNearFar: { value: new THREE.Vector2(camera.near, camera.far) }, uFocus: { value: 12 }, uAperture: { value: 1 }, uMaxCoC: { value: 14 },
      uFlash: { value: 0 }, uFade: { value: 1 }, uGrainSeed: { value: 0 }, uWarm: { value: 0 },
    },
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt, mat,
    render(sceneMain, camMain) {
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(sceneMain, camMain);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
  };
}
