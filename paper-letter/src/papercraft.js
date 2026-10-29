// SVG / canvas → 加白色紙邊 → 描輪廓 → 擠出成有厚度的 Three.js 紙片
import * as THREE from 'three';

const PAPER_EDGE = new THREE.Color('#f6f1e4');
const edgeMat = new THREE.MeshStandardMaterial({ color: PAPER_EDGE, roughness: 0.95, metalness: 0 });

export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = (e) => rej(new Error('image load failed'));
    im.src = src;
  });
}
export const svgToImage = (svg) => loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));

/** 在圖案外圍加一圈白紙邊（把剪影以圓形取樣疊畫膨脹），回傳新 canvas。 */
function addPaperBorder(img, w, h, scale, borderPx) {
  const pad = Math.ceil(borderPx) + 3;
  const W = Math.ceil(w * scale) + pad * 2, H = Math.ceil(h * scale) + pad * 2;
  const sil = document.createElement('canvas');
  sil.width = W; sil.height = H;
  const sctx = sil.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, pad, pad, w * scale, h * scale);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#fbf8ef';
  sctx.fillRect(0, 0, W, H);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  for (const r of [borderPx, borderPx * 0.66, borderPx * 0.33]) {
    const steps = 28;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  ctx.drawImage(sil, 0, 0);
  ctx.drawImage(img, pad, pad, w * scale, h * scale);
  // 透明像素 RGB 設為紙色，避免 mipmap 邊緣出現黑邊
  const id = ctx.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 8) { d[i] = 251; d[i + 1] = 248; d[i + 2] = 239; }
  ctx.putImageData(id, 0, 0);
  return { canvas: cv, W, H, pad };
}

/** Marching squares：回傳所有閉合輪廓（像素座標，含亞像素內插）。 */
function traceContours(canvas) {
  const W = canvas.width, H = canvas.height;
  const a = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const val = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : a[(y * W + x) * 4 + 3] / 255);
  const T = 0.5;
  const pts = new Map(); // key -> [x,y]
  const segs = [];
  const eH = (x, y) => { // 水平邊 (x,y)-(x+1,y)
    const k = (y * (W + 2) + x) * 2;
    if (!pts.has(k)) { const v0 = val(x, y), v1 = val(x + 1, y); pts.set(k, [x + (T - v0) / (v1 - v0), y]); }
    return k;
  };
  const eV = (x, y) => { // 垂直邊 (x,y)-(x,y+1)
    const k = (y * (W + 2) + x) * 2 + 1;
    if (!pts.has(k)) { const v0 = val(x, y), v1 = val(x, y + 1); pts.set(k, [x, y + (T - v0) / (v1 - v0)]); }
    return k;
  };
  for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
    const v = [val(x, y) >= T, val(x + 1, y) >= T, val(x + 1, y + 1) >= T, val(x, y + 1) >= T];
    const c = (v[0] ? 1 : 0) | (v[1] ? 2 : 0) | (v[2] ? 4 : 0) | (v[3] ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const top = () => eH(x, y), bot = () => eH(x, y + 1), left = () => eV(x, y), right = () => eV(x + 1, y);
    const add = (p, q) => segs.push([p(), q()]);
    switch (c) {
      case 1: case 14: add(left, top); break;
      case 2: case 13: add(top, right); break;
      case 3: case 12: add(left, right); break;
      case 4: case 11: add(right, bot); break;
      case 5: add(left, top); add(right, bot); break;
      case 6: case 9: add(top, bot); break;
      case 7: case 8: add(left, bot); break;
      case 10: add(top, right); add(left, bot); break;
    }
  }
  const adj = new Map();
  for (const [p, q] of segs) {
    if (!adj.has(p)) adj.set(p, []);
    if (!adj.has(q)) adj.set(q, []);
    adj.get(p).push(q); adj.get(q).push(p);
  }
  const used = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (used.has(start)) continue;
    const loop = [];
    let prev = null, cur = start;
    for (let guard = 0; guard < 1e6; guard++) {
      used.add(cur); loop.push(pts.get(cur));
      const nb = adj.get(cur);
      const next = nb[0] === prev ? nb[1] : nb[0];
      if (next === undefined || next === start) break;
      prev = cur; cur = next;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function inside(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function simplify(p, eps) { // Douglas-Peucker（閉合：以最遠點拆成兩段）
  const dp = (pts) => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    let md = 0, mi = 0;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { const l = dp(pts.slice(0, mi + 1)), r = dp(pts.slice(mi)); return l.slice(0, -1).concat(r); }
    return [a, b];
  };
  let fi = 0, fd = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > fd) { fd = d; fi = i; } }
  const A = dp(p.slice(0, fi + 1)), B = dp(p.slice(fi).concat([p[0]]));
  return A.slice(0, -1).concat(B.slice(0, -1));
}

/**
 * 做一張紙片。
 * src: {svg,w,h,ax,ay} 或 {canvas, ax, ay}；單位長度＝ unitPx 像素；
 * 回傳 {mesh(Group, 原點在腳底中央), width, height}
 */
export async function makeCard(src, { unitPx = 150, wpu = 0.01, border = 0.045, depth = 0.05, material = {} } = {}) {
  let img, w, h;
  if (src.canvas) { img = src.canvas; w = img.width; h = img.height; } else { img = await svgToImage(src.svg); w = src.w; h = src.h; }
  const scale = src.canvas ? 1 : wpu * unitPx; // svg 單位 → 像素（wpu = 每個 svg 單位對應的世界長度）
  const bpx = border * unitPx;
  const B = addPaperBorder(img, w, h, scale, bpx);
  const loops = traceContours(B.canvas).map((l) => simplify(l, 0.9));
  // 以「被幾層輪廓包住」判斷外環／孔洞（偶數層＝外環，奇數層＝孔洞），不依賴走線方向
  const sorted = loops.map((l) => ({ l, a: Math.abs(area(l)) })).filter((o) => o.a >= 40).sort((p, q) => q.a - p.a);
  for (const o of sorted) o.depth = sorted.filter((p) => p !== o && p.a > o.a && inside(o.l[0], p.l)).length;
  const flip = (l) => l.map((p) => new THREE.Vector2(p[0], B.H - p[1]));
  const ccw = (pts) => (THREE.ShapeUtils.isClockWise(pts) ? pts.slice().reverse() : pts);
  const shapes = [];
  for (const o of sorted) {
    if (o.depth % 2) continue;
    const sh = new THREE.Shape(ccw(flip(o.l)));
    for (const hl of sorted) if (hl.depth === o.depth + 1 && hl.a > 120 && inside(hl.l[0], o.l)) sh.holes.push(new THREE.Path(ccw(flip(hl.l)).reverse()));
    shapes.push(sh);
  }
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: depth * unitPx, bevelEnabled: false, curveSegments: 1 });
  // 蓋面 UV 重新對應到貼圖；背面（法線 -z）因鏡像自然得到「翻面」的鏡像圖
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) if (Math.abs(nor.getZ(i)) > 0.5) uv.setXY(i, pos.getX(i) / B.W, pos.getY(i) / B.H);
  const ax = (src.ax ?? w / 2) * scale + B.pad, ay = B.H - ((src.ay ?? h) * scale + B.pad);
  geo.translate(-ax, -ay, -depth * unitPx / 2);
  geo.scale(1 / unitPx, 1 / unitPx, 1 / unitPx);
  const tex = new THREE.CanvasTexture(B.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const capMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.9, metalness: 0, side: THREE.FrontSide, ...material });
  const mesh = new THREE.Mesh(geo, [capMat, edgeMat]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return { mesh: g, geo, mat: capMat, width: B.W / unitPx, height: B.H / unitPx, canvas: B.canvas };
}

/** 純色多邊形紙片（閃電、彩虹帶）：外層白紙邊 + 內層色紙。 */
export function makePolyPaper(points, color, { border = 0.05, depth = 0.04, z = 0 } = {}) {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.ExtrudeGeometry(offsetShape(shape, border), { depth, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#fbf8ef', roughness: 0.95 }));
  const col = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: depth * 0.8, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  col.position.z = depth * 0.2 + 0.002;
  for (const m of [white, col]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(white, col);
  g.position.z = z - depth / 2;
  return g;
}
function offsetShape(shape, d) {
  const p = shape.getPoints();
  const out = [];
  const n = p.length;
  // 以頂點平均法向外推
  const cw = THREE.ShapeUtils.isClockWise(p);
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n];
    const n1 = new THREE.Vector2(b.y - a.y, a.x - b.x).normalize(), n2 = new THREE.Vector2(c.y - b.y, b.x - c.x).normalize();
    const m = n1.add(n2).normalize().multiplyScalar(cw ? -d : d);
    out.push(b.clone().add(m));
  }
  return new THREE.Shape(out);
}
