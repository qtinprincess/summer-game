// 《紙信》場景：一本攤在桌上的立體書。所有東西都是紙：SVG 卡片、擠出厚度、摺疊關節。
import * as THREE from 'three';
import SVGS from './svg-bundle.js';
import { makeCard, makePolyPaper } from './papercraft.js';
import { createPost } from './dof.js';
import * as T from './timeline.js';

const { PAGE_W, PAGE_D, SURF_Y, ROAD_Z } = T;
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 每個 SVG 單位對應的世界長度
const WPU = (name) => {
  if (name.startsWith('hero_')) return 0.0064;
  if (name.startsWith('bunny_')) return 0.0056;
  return ({
    house_post: 0.0108, house_friend: 0.0106, mailbox_a: 0.0085, mailbox_b: 0.0085, tree_a: 0.0108, tree_b: 0.0108, bush: 0.0088,
    cloud_w1: 0.0115, cloud_w2: 0.0115, cloud_d1: 0.0125, cloud_d2: 0.0125, sun_a: 0.0098, sun_b: 0.0098, puddle: 0.011,
    letter_flat: 0.0072, letter_a: 0.0072, letter_b: 0.0072, letter_open: 0.0112, heart: 0.0105, star: 0.0085,
    hills_far: 0.01, hills_mid: 0.01, hills_near: 0.01,
  })[name] ?? 0.01;
};

// ---------- 程序紋理 ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function woodTexture() {
  return canvasTex(2048, 1024, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#b98a5c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const y = r() * h, a = 0.05 + r() * 0.12;
      g.strokeStyle = r() > 0.5 ? `rgba(90,52,28,${a})` : `rgba(235,190,140,${a})`;
      g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 6 + (r() - 0.5) * 2);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(80,45,25,.18)'; g.fillRect((i + 1) * w / 7 - 2, 0, 4, h); }
  });
}
function pageTexture(side) {
  const W = 2400, H = 1480;
  return canvasTex(W, H, (g) => {
    const r = rng(side === 'L' ? 11 : 23);
    const X = (x) => (side === 'L' ? (x + PAGE_W) : x) / PAGE_W * W, Z = (z) => (z + PAGE_D / 2) / PAGE_D * H;
    g.fillStyle = '#f7efd9'; g.fillRect(0, 0, W, H);
    // 草地（留一圈紙邊）
    const m = 0.28 * W / PAGE_W, left = side === 'L' ? m : 0, right = side === 'L' ? W : W - m;
    g.fillStyle = '#9fd68a'; g.beginPath(); g.roundRect(left, m, right - left, H - m * 2, 40); g.fill();
    g.fillStyle = '#8bca77';
    for (let i = 0; i < 90; i++) { const x = left + r() * (right - left), y = m + r() * (H - 2 * m); g.beginPath(); g.ellipse(x, y, 40 + r() * 90, 14 + r() * 26, 0, 0, 7); g.fill(); }
    // 道路
    const rz = Z(ROAD_Z), rw = 1.5 * H / PAGE_D;
    g.fillStyle = '#e9cf9c'; g.fillRect(side === 'L' ? left : 0, rz - rw / 2, (side === 'L' ? W - left : right), rw);
    g.strokeStyle = '#c9a96c'; g.lineWidth = 6; g.setLineDash([34, 26]);
    for (const k of [-0.5, 0.5]) { g.beginPath(); g.moveTo(0, rz + k * rw * 0.82); g.lineTo(W, rz + k * rw * 0.82); g.stroke(); }
    g.setLineDash([]);
    for (let i = 0; i < 160; i++) { g.fillStyle = r() > 0.5 ? '#d9bb82' : '#f3dfb4'; g.beginPath(); g.ellipse(r() * W, rz + (r() - 0.5) * rw * 0.9, 8 + r() * 14, 5 + r() * 8, 0, 0, 7); g.fill(); }
    // 池塘（右頁）
    if (side === 'R') {
      const px = X(9.3), pz = Z(-1.9);
      g.fillStyle = '#8fc4f0'; g.strokeStyle = '#2d2438'; g.lineWidth = 8; g.beginPath(); g.ellipse(px, pz + 330, 230, 100, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(px - 40, pz + 322, 60, 3.6, 4.6); g.stroke();
    }
    // 草叢與花
    for (let i = 0; i < 380; i++) {
      const x = left + r() * (right - left), y = m * 0.8 + r() * (H - m * 1.6);
      if (Math.abs(y - rz) < rw * 0.62) continue;
      if (r() > 0.45) { g.strokeStyle = '#5eaa57'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 3, y - 20); g.moveTo(x, y); g.lineTo(x, y - 26); g.moveTo(x + 10, y); g.lineTo(x + 4, y - 18); g.stroke(); }
      else { g.fillStyle = ['#ff7aa2', '#ffd24a', '#fff', '#9ad0ff'][Math.floor(r() * 4)]; g.strokeStyle = '#2d2438'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#ffe36b'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    }
    // 書脊陰影
    const sp = g.createLinearGradient(side === 'L' ? W : 0, 0, side === 'L' ? W - 150 : 150, 0);
    sp.addColorStop(0, 'rgba(70,45,20,.38)'); sp.addColorStop(1, 'rgba(70,45,20,0)');
    g.fillStyle = sp; g.fillRect(0, 0, W, H);
    // 紙張纖維
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,95,60,${0.03 + r() * 0.05})`; g.fillRect(r() * W, r() * H, 2 + r() * 8, 1.5); }
  });
}
function coverTexture() {
  return canvasTex(1200, 760, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#2f7f86'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.04})`; g.fillRect(r() * w, r() * h, 30 + r() * 80, 1.5); }
    g.strokeStyle = '#f5e7b8'; g.lineWidth = 5; g.setLineDash([22, 14]); g.strokeRect(34, 34, w - 68, h - 68); g.setLineDash([]);
    g.strokeStyle = 'rgba(245,231,184,.7)'; g.lineWidth = 3; g.strokeRect(54, 54, w - 108, h - 108);
    for (const [x, y] of [[84, 84], [w - 84, 84], [84, h - 84], [w - 84, h - 84]]) { g.fillStyle = '#f5e7b8'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
    g.fillStyle = '#f5e7b8'; g.font = '700 38px sans-serif'; g.textAlign = 'center'; g.fillText('P A P E R   L E T T E R', w / 2, h - 96);
  });
}
function pageSideTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#f4ecd6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(150,125,85,${y % 6 ? 0.18 : 0.3})`; g.fillRect(0, y, w, 1); }
  });
}
function titleCanvas() {
  const c = document.createElement('canvas'); c.width = 760; c.height = 420;
  const g = c.getContext('2d');
  g.font = "700 330px 'Noto Sans TC','PingFang TC','Microsoft JhengHei','WenQuanYi Zen Hei',sans-serif";
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.fillStyle = '#e5483f'; g.strokeStyle = '#e5483f'; g.lineWidth = 9;
  g.strokeText('紙信', 380, 215); g.fillText('紙信', 380, 215);
  g.fillStyle = '#ff7b6e'; g.globalCompositeOperation = 'source-atop';
  g.fillRect(0, 0, 760, 130);
  return c;
}

// ---------- 主建構 ----------
export async function buildStage({ canvas, width = 1920, height = 1080 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x6b4a2e, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#7a5636', 26, 70);
  const camera = new THREE.PerspectiveCamera(32, width / height, 1, 90);
  const post = createPost(renderer, width, height, camera);

  // 燈光
  const hemi = new THREE.HemisphereLight('#fff6e6', '#c9a77d', 1.5);
  const sunL = new THREE.DirectionalLight('#fff1d6', 2.6);
  sunL.castShadow = true;
  sunL.shadow.mapSize.set(2048, 2048);
  Object.assign(sunL.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9, near: 1, far: 45 });
  sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.02; sunL.shadow.radius = 4;
  const flashL = new THREE.DirectionalLight('#cfe3ff', 0);
  flashL.position.set(-3, 9, 6);
  scene.add(hemi, sunL, sunL.target, flashL);

  // 桌面
  const woodT = woodTexture(); woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; woodT.repeat.set(2, 1);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(420, 260), new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.85 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);

  // ---- 書本 ----
  const book = new THREE.Group(); scene.add(book);
  const coverMat = new THREE.MeshStandardMaterial({ color: '#2a6f76', roughness: 0.8 });
  const sideTex = pageSideTexture();
  const pageSideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 1 });
  const pageTopMat = new THREE.MeshStandardMaterial({ color: '#f4ecd6', roughness: 1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.5, 0.12, PAGE_D + 0.5), coverMat);
  base.position.set(PAGE_W / 2 - 0.25, 0.06, 0); base.receiveShadow = true; base.castShadow = true; book.add(base);
  const blockR = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W, SURF_Y - 0.12, PAGE_D), [pageSideMat, pageSideMat, pageTopMat, pageTopMat, pageSideMat, pageSideMat]);
  blockR.position.set(PAGE_W / 2, (SURF_Y + 0.12) / 2, 0); blockR.receiveShadow = true; book.add(blockR);
  const leftStack = new THREE.Group(); book.add(leftStack);
  const baseL = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.25, 0.12, PAGE_D + 0.5), coverMat);
  baseL.position.set(-(PAGE_W + 0.25) / 2, 0.06, 0); baseL.receiveShadow = true; leftStack.add(baseL);
  const blockL = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W, SURF_Y - 0.1 - 0.12, PAGE_D), [pageSideMat, pageSideMat, pageTopMat, pageTopMat, pageSideMat, pageSideMat]);
  blockL.position.set(-PAGE_W / 2, (SURF_Y - 0.1 + 0.12) / 2, 0); blockL.receiveShadow = true; leftStack.add(blockL);
  const pgR = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_D), new THREE.MeshStandardMaterial({ map: pageTexture('R'), roughness: 1 }));
  pgR.rotation.x = -Math.PI / 2; pgR.position.set(PAGE_W / 2, SURF_Y + 0.001, 0); pgR.receiveShadow = true; book.add(pgR);
  // 封面（繞書脊翻開，內面是左頁）
  const cover = new THREE.Group(); cover.position.set(0, SURF_Y, 0); book.add(cover);
  const coverTopTex = coverTexture();
  const coverBox = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.25, 0.1, PAGE_D + 0.25), [
    coverMat, coverMat,
    new THREE.MeshStandardMaterial({ map: coverTopTex, roughness: 0.85 }),
    coverMat,
    coverMat, coverMat]);
  coverBox.position.set((PAGE_W + 0.25) / 2 - 0.1, 0.05, 0); coverBox.castShadow = true; coverBox.receiveShadow = true;
  cover.add(coverBox);
  // 封面內頁（＝左頁）：翻開後朝上。翻轉 180° 後貼圖方向要補轉 180°
  const leftTex = pageTexture('L'); leftTex.center.set(0.5, 0.5); leftTex.rotation = Math.PI;
  const pgL = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_D), new THREE.MeshStandardMaterial({ map: leftTex, roughness: 1 }));
  pgL.rotation.x = Math.PI / 2; pgL.position.set(PAGE_W / 2, -0.002, 0); pgL.receiveShadow = true;
  cover.add(pgL);
  const titleCard = await makeCard({ canvas: titleCanvas(), ax: 380, ay: 215 }, { unitPx: 150, depth: 0.07, border: 0.05 });
  titleCard.mesh.rotation.x = -Math.PI / 2; titleCard.mesh.position.set(PAGE_W / 2 - 0.1, 0.105, 0.1);
  cover.add(titleCard.mesh);
  titleCard.mesh.rotation.z = 0;

  // ---- 卡片庫 ----
  const cardCache = new Map();
  async function getCard(name, opts = {}) {
    const s = SVGS[name];
    const c = await makeCard(s, { unitPx: opts.unitPx ?? 130, wpu: opts.wpu ?? WPU(name), depth: opts.depth ?? 0.05, border: opts.border ?? 0.04 });
    cardCache.set(name, c);
    return c;
  }

  // 彈起物件：root(固定在頁面上) → hinge(摺疊關節) → 內容
  const popItems = [];
  function addPop(id, { x, z, dir = -1, lift = 0, parent = scene, yBase = SURF_Y, jitter = 0.002 * popItems.length }) {
    const root = new THREE.Group(); root.position.set(x, yBase + jitter, z); parent.add(root);
    const hinge = new THREE.Group(); root.add(hinge);
    const it = { id, root, hinge, dir, lift, update: null };
    popItems.push(it);
    return it;
  }

  // 背景天空面板（GLSL 漸層天空）
  const skyUniforms = { uStorm: { value: 0 }, uWarm: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uStorm, uWarm, uFlash, uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
      void main(){
        vec3 dayT = lin(vec3(0.42,0.72,0.98)), dayB = lin(vec3(0.84,0.94,1.0));
        vec3 stT  = lin(vec3(0.20,0.24,0.38)), stB  = lin(vec3(0.46,0.52,0.66));
        vec3 wmT  = lin(vec3(0.52,0.76,1.0)), wmB  = lin(vec3(1.0,0.90,0.78));
        vec3 T = mix(mix(dayT, wmT, uWarm), stT, uStorm), B = mix(mix(dayB, wmB, uWarm), stB, uStorm);
        vec3 c = mix(B, T, smoothstep(0.0, 1.0, vUv.y));
        // 紙張印刷的圓點網點
        vec2 g = vUv * vec2(60.0, 36.0); vec2 f = fract(g) - 0.5;
        float dots = smoothstep(0.30, 0.22, length(f)) * (1.0 - vUv.y) * 0.10;
        c += dots * (1.0 - uStorm * 0.6);
        c += vec3(1.0, 0.97, 0.88) * uFlash * 0.7;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  function addBackdrop(id, x) {
    const it = addPop(id, { x, z: -PAGE_D / 2 + 0.02, dir: +1, jitter: 0.05 });
    const w = PAGE_W - 0.1, hgt = 7.2;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.06), [
      new THREE.MeshStandardMaterial({ color: '#f3ecda' }), new THREE.MeshStandardMaterial({ color: '#f3ecda' }),
      new THREE.MeshStandardMaterial({ color: '#f3ecda' }), new THREE.MeshStandardMaterial({ color: '#f3ecda' }), skyMat, new THREE.MeshStandardMaterial({ color: '#e8dfc8' })]);
    panel.position.set(0, hgt / 2, 0); panel.castShadow = false; panel.receiveShadow = false; it.hinge.add(panel);
    return it;
  }
  const bdL = addBackdrop('bdL', -PAGE_W / 2), bdR = addBackdrop('bdR', PAGE_W / 2);

  async function addCardPop(id, name, { x, z, dir = -1, y = 0, scale = 1, rotY = 0, wpu, extra } = {}) {
    const it = addPop(id, { x, z, dir });
    const c = await getCard(name, { wpu });
    c.mesh.position.y = y; c.mesh.scale.setScalar(scale); c.mesh.rotation.y = rotY;
    it.hinge.add(c.mesh); it.card = c;
    return it;
  }
  // 丘陵三層（遠中近）
  const hillsDef = [['hills_far', -3.35, 'hillFar'], ['hills_mid', -2.85, 'hillMid'], ['hills_near', -2.35, 'hillNear']];
  for (const side of ['L', 'R']) for (const [nm, z, key] of hillsDef) await addCardPop(key + side, nm, { x: side === 'L' ? -PAGE_W / 2 : PAGE_W / 2, z, dir: -1 });

  // 左頁佈景
  await addCardPop('post', 'house_post', { x: -9.8, z: -0.9 });
  const mailbox = {
    a: await getCard('mailbox_a'), b: await getCard('mailbox_b'),
  };
  const mbItem = addPop('mailbox', { x: -7.3, z: 0.35, dir: -1 });
  mbItem.hinge.add(mailbox.a.mesh, mailbox.b.mesh);
  await addCardPop('treeAL', 'tree_a', { x: -5.7, z: -1.7 });
  await addCardPop('treeBL', 'tree_b', { x: -3.0, z: -2.0 });
  await addCardPop('bushL', 'bush', { x: -8.4, z: -0.15 });
  // 太陽（掛在細竿上）
  const sunStick = (id, x) => {
    const it = addPop(id, { x, z: -2.7, dir: -1 });
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.1, 0.04), new THREE.MeshStandardMaterial({ color: '#8b6a45' }));
    stick.position.y = 1.55; stick.castShadow = true; it.hinge.add(stick);
    return it;
  };
  const sunLItem = sunStick('sun', -3.9), sunRItem = sunStick('sunR', 9.3);
  const sunCards = { a: await getCard('sun_a'), b: await getCard('sun_b') };
  const sunCardsR = { a: await getCard('sun_a'), b: await getCard('sun_b') };
  for (const [it, cs] of [[sunLItem, sunCards], [sunRItem, sunCardsR]]) { for (const c of Object.values(cs)) { c.mesh.position.y = 3.3; it.hinge.add(c.mesh); } }
  // 右頁佈景
  await addCardPop('treeAR', 'tree_a', { x: 2.6, z: -1.9 });
  await addCardPop('friend', 'house_friend', { x: 8.0, z: -0.9 });
  await addCardPop('bushR', 'bush', { x: 3.7, z: -0.2 });
  await addCardPop('treeBR', 'tree_b', { x: 10.4, z: -1.9 });
  // 水窪（平貼在地面）
  const puddle = await addCardPop('puddle', 'puddle', { x: -6.9, z: 1.65, dir: -1 });
  puddle.flat = true;

  // 彩虹：7 條紙帶，各自一個摺疊關節
  const RB = ['#ff5b5b', '#ff9a3d', '#ffd93d', '#6bd36b', '#44c8e8', '#4d7cff', '#a66bde'];
  const rbCenter = 3.3;
  for (let i = 0; i < 7; i++) {
    const it = addPop('rb' + i, { x: rbCenter, z: -2.5 - i * 0.012, dir: +1, jitter: 0.01 + i * 0.002 });
    const Ro = 5.0 - i * 0.27, Ri = Ro - 0.3, pts = [];
    for (let k = 0; k <= 28; k++) { const a = (k / 28) * Math.PI; pts.push([Math.cos(a) * Ro, Math.sin(a) * Ro]); }
    for (let k = 28; k >= 0; k--) { const a = (k / 28) * Math.PI; pts.push([Math.cos(a) * Ri, Math.sin(a) * Ri]); }
    const band = makePolyPaper(pts, RB[i], { border: 0.045, depth: 0.04 });
    it.hinge.add(band);
  }

  // 雲
  const cloudCards = {};
  for (const nm of ['cloud_w1', 'cloud_w2', 'cloud_d1', 'cloud_d2']) cloudCards[nm] = nm;
  const whiteClouds = [], darkClouds = [];
  const mkCloud = async (nm, x, y, z) => { const c = await getCard(nm); c.mesh.position.set(x, y, z); scene.add(c.mesh); return { c, x, y, z }; };
  for (const [nm, x, y] of [['cloud_w1', -9.6, 4.2], ['cloud_w2', -6.4, 4.6], ['cloud_w1', -1.2, 4.3], ['cloud_w2', -10.8, 3.7]]) whiteClouds.push(await mkCloud(nm, x, y, -2.1));
  for (const [nm, x, y] of [['cloud_d1', -10.0, 4.1], ['cloud_d2', -6.6, 4.5], ['cloud_d1', -3.4, 4.1], ['cloud_d2', 0.2, 4.5], ['cloud_d1', -8.2, 3.6], ['cloud_d2', -1.6, 3.5]]) darkClouds.push(await mkCloud(nm, x, y, -1.7));
  const warmClouds = [];
  for (const [nm, x, y] of [['cloud_w1', 0.6, 4.4], ['cloud_w2', 5.6, 4.7], ['cloud_w1', 11.0, 4.2]]) warmClouds.push(await mkCloud(nm, x, y, -2.1));

  // ---- 角色 ----
  const makeActor = async (prefix, names, wpuF) => {
    const root = new THREE.Group(), fold = new THREE.Group(); scene.add(root); root.add(fold);
    const cards = {};
    for (const nm of names) { const c = await getCard(nm); c.mesh.visible = false; fold.add(c.mesh); cards[nm] = c; }
    return { root, fold, cards, cur: null };
  };
  const heroNames = Object.keys(SVGS).filter((n) => n.startsWith('hero_'));
  const bunnyNames = Object.keys(SVGS).filter((n) => n.startsWith('bunny_'));
  const hero = await makeActor('hero', heroNames);
  const bunny = await makeActor('bunny', bunnyNames);
  function showCard(actor, name) {
    if (actor.cur === name) return;
    if (actor.cur) actor.cards[actor.cur].mesh.visible = false;
    actor.cards[name].mesh.visible = true; actor.cur = name;
  }
  // 信
  const letterCards = {};
  for (const nm of ['letter_flat', 'letter_a', 'letter_b']) { const c = await getCard(nm); c.mesh.visible = false; scene.add(c.mesh); letterCards[nm] = c; }
  const letterOpen = await addCardPop('letterOpen', 'letter_open', { x: 4.9, z: 1.5, wpu: 0.0075 });
  const heartItem = await addCardPop('heart', 'heart', { x: 4.9, z: 1.4, y: 0, wpu: 0.0085 });
  heartItem.root.position.y = SURF_Y + 1.5;
  // 星星
  const starCard = await getCard('star');
  const stars = [];
  for (let i = 0; i < T.STAR_N; i++) { const g = new THREE.Group(); const m = starCard.mesh.clone(true); g.add(m); g.visible = false; scene.add(g); stars.push(g); }

  // 閃電
  const boltCache = new Map();
  function boltMesh(seed, big) {
    const key = seed + (big ? 'b' : 's');
    if (boltCache.has(key)) return boltCache.get(key);
    const r = rng(seed * 17 + 3), pts = [], top = 4.9, bot = SURF_Y + 0.6 + (big ? 0 : 1.4), w = big ? 0.5 : 0.34;
    const left = [], right = [];
    let x = 0; const N = 7;
    for (let i = 0; i <= N; i++) {
      const y = top - (top - bot) * (i / N); const tw = w * (1 - i / N * 0.8) + 0.06;
      x += (r() - 0.5) * 1.5;
      left.push([x - tw, y]); right.push([x + tw, y - 0.25]);
    }
    const poly = left.concat(right.reverse());
    const m = makePolyPaper(poly, '#ffe45c', { border: 0.07, depth: 0.05 });
    m.userData.noShadow = true; m.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    m.visible = false; scene.add(m); boltCache.set(key, m); return m;
  }
  const boltSeeds = [[8.25, 1], [10.1, 2]];
  const bolts = [];
  for (const L of T.LIGHTNING) for (let s = 0; s < 3; s++) bolts.push({ L, s, mesh: boltMesh(Math.round(L.t * 12) + s * 3, L.big) });

  // ---- 雨：InstancedMesh ----
  const RAIN_N = 1300;
  const rainMat = new THREE.MeshBasicMaterial({ color: '#e9f5ff', transparent: true, opacity: 0.62 });
  const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.4, 0.004), rainMat, RAIN_N);
  rain.frustumCulled = false; scene.add(rain);
  const SPL_N = 90;
  const splMat = new THREE.MeshBasicMaterial({ color: '#f4fbff', side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
  const splash = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 6), splMat, SPL_N);
  splash.frustumCulled = false; scene.add(splash);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const wrap = (v, m) => ((v % m) + m) % m;
  function updateRain(t, camX) {
    const amt = T.rainAmt(t), f = T.fxFrame(t), cnt = Math.floor(RAIN_N * amt);
    const slant = 0.2;
    E.set(0, 0, -Math.atan(slant)); Q.setFromEuler(E);
    for (let i = 0; i < RAIN_N; i++) {
      if (i >= cnt) { rain.setMatrixAt(i, ZERO); continue; }
      const sp = 9 + T.hash(i + 5) * 5, y = 7.8 - wrap(f * sp / T.FX_FPS + T.hash(i + 3) * 9, 7.4);
      const x = camX - 15 + wrap(T.hash(i) * 30 - camX, 30) + (7.8 - y) * -slant;
      const z = -3.0 + T.hash(i + 7) * 7.6;
      P.set(x, y, z); S.set(1, 0.8 + T.hash(i + 9) * 0.5, 1);
      M.compose(P, Q, S); rain.setMatrixAt(i, M);
    }
    rain.instanceMatrix.needsUpdate = true;
    // 水花
    E.set(-Math.PI / 2, 0, 0); const q2 = new THREE.Quaternion().setFromEuler(E);
    const sc = Math.floor(SPL_N * amt);
    for (let i = 0; i < SPL_N; i++) {
      const life = (f + i * 3) % 6, gen = Math.floor((f + i * 3) / 6);
      if (i >= sc || life > 3) { splash.setMatrixAt(i, ZERO); continue; }
      const x = camX + (T.hash(i * 3 + gen * 131) - 0.5) * 13, z = -2.4 + T.hash(i * 5 + gen * 57) * 5.9;
      const s = 0.05 + life * 0.05;
      P.set(x, SURF_Y + 0.025, z); S.set(s, s, s); M.compose(P, q2, S); splash.setMatrixAt(i, M);
    }
    splash.instanceMatrix.needsUpdate = true;
  }

  // ---------- 每格更新 ----------
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  function applyFold(it, v) {
    const k = 1 - v; // v=1 站直；0 攤平
    it.hinge.rotation.x = it.dir * (Math.PI / 2) * k;
    it.root.visible = v > 0.001;
    if (it.dir > 0) it.root.position.y = SURF_Y + 0.07 + 0.12 * Math.max(0, k);
  }

  function update(t) {
    const fx = T.fxTime(t);
    const f = T.fxFrame(t);
    // 封面
    const co = T.coverOpen(t);
    cover.rotation.z = co * Math.PI;
    const grow = T.smooth((co - 0.25) / 0.75);
    leftStack.scale.y = Math.max(0.0001, grow); leftStack.visible = grow > 0.002;
    // 彈起物件
    for (const it of popItems) {
      let tt = t;
      if (it.id.startsWith('rb')) tt = fx; // 彩虹也是 12fps 停格
      applyFold(it, T.fold(it.id, tt));
      if (it.flat) { it.hinge.rotation.x = -Math.PI / 2; it.root.scale.setScalar(T.fold(it.id, t) > 0.01 ? Math.min(1, T.fold(it.id, t)) : 0.0001); it.root.position.y = SURF_Y + 0.012; }
    }
    // 郵筒
    const mbc = T.mailboxCard(t);
    mailbox.a.mesh.visible = mbc === 'mailbox_a'; mailbox.b.mesh.visible = mbc === 'mailbox_b';
    // 太陽（停格換圖）
    for (const cs of [sunCards, sunCardsR]) { const alt = f % 2; cs.a.mesh.visible = !alt; cs.b.mesh.visible = !!alt; }
    // 雲（12fps 停格漂移與抖動）
    const st = T.storm(t);
    const gust = T.windGust(t);
    const jit = (i, a) => (T.hash(f * 7 + i * 13) - 0.5) * a;
    whiteClouds.forEach((c, i) => {
      const leave = T.smooth((t - 6.2 - i * 0.12) / 1.2);
      c.c.mesh.position.set(c.x + fx * 0.06 + jit(i, 0.05), c.y + 5.5 * leave + jit(i + 4, 0.05), c.z);
      c.c.mesh.rotation.z = jit(i + 9, 0.05);
      c.c.mesh.visible = leave < 0.999 && T.fold('post', t) > 0.01;
      const appear = T.springOut((t - (3.5 + i * 0.12)) / 0.6);
      c.c.mesh.scale.setScalar(Math.max(0.0001, appear));
    });
    const flashNow = T.lightningAt(t);
    darkClouds.forEach((c, i) => {
      const enter = T.easeOut((t - 6.2 - i * 0.14) / 1.2), exit = T.easeIn((t - 14.6 - i * 0.12) / 1.3);
      const yy = c.y + 5.0 * (1 - enter) + 5.5 * exit;
      const pulse = flashNow.flash > 0.3 ? 1.06 : 1;
      c.c.mesh.position.set(c.x + fx * 0.1 + jit(i, 0.06) - gust * 0.2, yy + jit(i + 3, 0.05), c.z);
      c.c.mesh.rotation.z = jit(i + 5, 0.06);
      c.c.mesh.scale.setScalar(pulse);
      c.c.mesh.visible = enter > 0.001 && exit < 0.999;
    });
    warmClouds.forEach((c, i) => {
      const a = T.springOut((t - (16.6 + i * 0.25)) / 0.7) * (1 - T.easeIn((t - 21.7) / 0.5));
      c.c.mesh.position.set(c.x + (fx - 16) * 0.05 + jit(i + 20, 0.04), c.y + jit(i + 24, 0.04), c.z);
      c.c.mesh.scale.setScalar(Math.max(0.0001, a)); c.c.mesh.visible = a > 0.01;
    });
    // 英雄
    const h = T.heroAt(t);
    showCard(hero, h.card);
    hero.root.position.set(h.x, SURF_Y + h.y + 0.0, h.z); hero.root.rotation.y = h.rotY; hero.root.scale.set(1, h.sy, 1);
    hero.fold.rotation.x = -(Math.PI / 2) * (1 - h.fold);
    hero.root.visible = h.fold > 0.0005;
    hero.root.rotation.z = h.moving ? (h.contact ? 0.035 : -0.02) * (h.rotY > 1 ? -1 : 1) : 0;
    // 兔兔
    const b = T.bunnyAt(t);
    showCard(bunny, b.card);
    bunny.root.position.set(b.x, SURF_Y + b.y, b.z); bunny.root.rotation.y = b.rotY;
    bunny.fold.rotation.x = -(Math.PI / 2) * (1 - b.fold);
    bunny.root.visible = b.fold > 0.0005;
    // 信
    const L = T.letterAt(t);
    for (const c of Object.values(letterCards)) c.mesh.visible = false;
    if (L.visible) {
      const c = letterCards[L.card]; c.mesh.visible = true;
      c.mesh.position.set(L.x, SURF_Y + L.y + (L.lying ? 0.03 : 0.4), L.z);
      if (L.lying) c.mesh.rotation.set(-Math.PI / 2, 0, L.rotZ);
      else c.mesh.rotation.set(Math.sin(f * 1.3) * 0.6, f * 0.7, L.rotZ);
    }
    // 星星
    updateStars(t);
    // 閃電
    for (const bo of bolts) {
      const lt = flashNow.bolt; const on = lt && lt.seed === Math.round(bo.L.t * 12) + bo.s * 3 && Math.abs(lt.x - bo.L.x) < 0.01;
      bo.mesh.visible = !!on;
      if (on) bo.mesh.position.set(bo.L.x, 0, -2.4);
    }
    // 雨
    const cam = T.cameraAt(t);
    updateRain(t, cam.tx);
    // 天空與燈光
    const warm = T.warmth(t);
    skyUniforms.uStorm.value = st; skyUniforms.uWarm.value = warm; skyUniforms.uFlash.value = flashNow.flash * 0.45;
    hemi.intensity = THREE.MathUtils.lerp(1.5, 0.95, st) + flashNow.flash * 0.6;
    hemi.color.set('#fff6e6').lerp(new THREE.Color('#9fb2d9'), st).lerp(new THREE.Color('#ffe6c4'), warm * 0.6);
    sunL.intensity = THREE.MathUtils.lerp(2.6, 0.9, st) + warm * 0.3;
    sunL.color.set('#fff1d6').lerp(new THREE.Color('#b8c8ea'), st).lerp(new THREE.Color('#ffd9a0'), warm * 0.5);
    flashL.intensity = flashNow.flash * 2.2;
    // 鏡頭
    const el = (cam.elev * Math.PI) / 180;
    camTgt.set(cam.tx, cam.ty, 0.3);
    camPos.set(cam.tx, cam.ty + Math.sin(el) * cam.dist, 0.3 + Math.cos(el) * cam.dist);
    camera.position.copy(camPos); camera.lookAt(camTgt); camera.updateMatrixWorld();
    sunL.position.set(cam.tx - 5, 14, 9); sunL.target.position.set(cam.tx, 0, 0); sunL.target.updateMatrixWorld();
    // 後製
    const U = post.mat.uniforms;
    U.uFocus.value = cam.dist * 0.98;
    U.uAperture.value = 0.9 + (t > 19 && t < 22 ? 0.5 : 0);
    U.uFlash.value = flashNow.flash;
    U.uWarm.value = warm;
    U.uGrainSeed.value = f % 7;
    U.uFade.value = Math.min(T.smooth(t / 0.5), 1 - T.smooth((t - 24.5) / 0.5));
  }
  function updateStars(t) {
    for (let i = 0; i < T.STAR_N; i++) {
      const t0 = T.STAR_T0 + i * 0.11, age = (t - t0) / 1.0;
      if (age < 0 || age > 1 || t > 21.4) { stars[i].visible = false; continue; }
      const a = T.hash(i + 3) * Math.PI * 2, rad = 0.6 + T.hash(i + 9) * 1.8 * T.easeOut(age);
      const s = Math.sin(Math.min(1, age) * Math.PI) * (0.5 + T.hash(i + 21) * 0.5);
      stars[i].visible = true;
      stars[i].position.set(4.9 + Math.cos(a) * rad * 1.2, SURF_Y + 2.1 + Math.sin(a) * rad * 0.7 + 0.4 * age, 1.9);
      stars[i].scale.setScalar(Math.max(0.01, s * 0.9));
      stars[i].rotation.z = T.fxFrame(t) * 0.5 + i;
    }
  }

  function render(t) {
    update(t);
    post.render(scene, camera);
  }
  return { renderer, scene, camera, update, render, post, T };
}
