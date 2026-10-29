// 《紙信》時間軸：畫面（瀏覽器）與音效（Node）共用同一份，所以腳步聲、雷聲、翻頁聲不會對不上。
// 純函式、無 DOM、無 Math.random()：任何時間 t 都能直接算出該格畫面。

export const DURATION = 25;
export const FPS = 24;       // 輸出格率
export const FX_FPS = 12;    // 角色卡片／特效「停格」格率

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
export const easeInOut = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
export const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
export const easeIn = (u) => clamp(u) ** 2;
/** 彈起：阻尼彈簧，會過衝約 16%（紙立體書「啪」地彈起來又回彈） */
export const springOut = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(11 * u));
export const fxFrame = (t) => Math.floor(t * FX_FPS + 1e-6);
export const fxTime = (t) => fxFrame(t) / FX_FPS;
export function hash(n) { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---------- 版面 ----------
export const PAGE_W = 12, PAGE_D = 7.4, SURF_Y = 0.42, ROAD_Z = 1.25;

// ---------- 立體書摺疊關節 ----------
// 每個彈起物件：open 展開、close 摺回。fold 值 0＝攤平，1＝站直，>1＝過衝後仰。
export const POPUPS = {
  bdL: { open: 1.9, dur: 1.0, close: 22.5, x: -6, sfx: 'big' },
  hillFarL: { open: 2.15, dur: 0.9, close: 22.3, x: -6 },
  hillMidL: { open: 2.3, dur: 0.9, close: 22.2, x: -6 },
  hillNearL: { open: 2.45, dur: 0.9, close: 22.1, x: -6 },
  post: { open: 2.7, dur: 0.8, close: 22.0, x: -9.8, sfx: 'big' },
  mailbox: { open: 3.0, dur: 0.6, close: 21.8, x: -7.3, sfx: 'small' },
  treeAL: { open: 2.85, dur: 0.7, close: 21.9, x: -5.6, sfx: 'small' },
  treeBL: { open: 3.05, dur: 0.7, close: 21.8, x: -3.0, sfx: 'small' },
  bushL: { open: 3.2, dur: 0.6, close: 21.7, x: -8.4, sfx: 'small' },
  sun: { open: 3.35, dur: 0.9, close: 6.5, x: -3.9, sfx: 'big' },
  sunR: { open: 16.4, dur: 0.9, close: 21.6, x: 9.3, sfx: 'big' },
  puddle: { open: 8.6, dur: 0.5, close: 21.5, x: -6.9 },
  bdR: { open: 13.55, dur: 1.0, close: 22.6, x: 6, sfx: 'big' },
  hillFarR: { open: 13.8, dur: 0.9, close: 22.4, x: 6 },
  hillMidR: { open: 13.95, dur: 0.9, close: 22.3, x: 6 },
  hillNearR: { open: 14.1, dur: 0.9, close: 22.2, x: 6 },
  treeAR: { open: 14.45, dur: 0.7, close: 21.9, x: 2.6, sfx: 'small' },
  friend: { open: 14.75, dur: 0.8, close: 21.9, x: 7.9, sfx: 'big' },
  bushR: { open: 15.0, dur: 0.6, close: 21.7, x: 3.6, sfx: 'small' },
  treeBR: { open: 15.2, dur: 0.7, close: 21.8, x: 10.2, sfx: 'small' },
  hero: { open: 3.3, dur: 0.7, close: 22.0, x: -9.6, sfx: 'small' },
  bunny: { open: 15.5, dur: 0.7, close: 22.0, x: 5.9, sfx: 'small' },
  letterOpen: { open: 19.0, dur: 0.6, close: 21.6, x: 4.9, sfx: 'small' },
  heart: { open: 19.4, dur: 0.8, close: 21.4, x: 4.9, sfx: 'heart' },
};
for (let i = 0; i < 7; i++) POPUPS['rb' + i] = { open: 15.75 + i * 0.1, dur: 0.8, close: 21.2 + i * 0.05, x: 3 + i * 0.1, sfx: i === 0 ? 'rainbow' : null };

export function fold(id, t) {
  const p = POPUPS[id];
  let v = t >= p.open ? springOut((t - p.open) / p.dur) : 0;
  if (p.close != null && t >= p.close) v = Math.min(v, 1) * (1 - easeIn((t - p.close) / 0.7));
  return v;
}

// 立體書封面：0＝闔上，1＝翻開（在左頁）
export const COVER = { open0: 0.95, open1: 2.45, close0: 23.15, close1: 24.3 };
export function coverOpen(t) {
  if (t < COVER.close0) return easeInOut((t - COVER.open0) / (COVER.open1 - COVER.open0)) + 0.045 * Math.sin(clamp((t - COVER.open1 + 0.05) / 0.6) * Math.PI * 2) * (1 - clamp((t - COVER.open1) / 0.6));
  return 1 - easeInOut((t - COVER.close0) / (COVER.close1 - COVER.close0));
}

// ---------- 角色卡片表（contact＝腳掌落地那一格） ----------
export const CARD_INFO = {};
for (const pre of ['walk', 'hold', 'umb', 'run']) for (const k of 'ABCD') CARD_INFO[`hero_${pre}${k}`] = { contact: k === 'A' || k === 'C', gait: pre };

// ---------- 主角 ----------
const CYC = 'ABCD';
export const HERO_FACE = { R: 1, L: -1 };
export const LETTER_FLIGHT = { t0: 9.0, t1: 10.55, from: [-3.0, 1.15], to: [-6.95, 0] };
export const LETTER_PASS = { t0: 17.3, t1: 17.9 };
export const PICKUP_T = 11.25;

function heroX(t) {
  if (t < 3.9) return -9.6;
  if (t < 4.55) return lerp(-9.6, -8.4, smooth((t - 3.9) / 0.65));
  if (t < 6.0) return -8.4;
  if (t < 9.0) return -8.4 + 1.7 * (t - 6.0);
  if (t < 9.75) return -3.3;
  if (t < 10.72) return lerp(-3.3, -6.5, (t - 9.75) / 0.97);
  if (t < 12.8) return -6.5;
  if (t < 17.08) return -6.5 + 2.43 * (t - 12.8);
  return 3.9;
}

export function heroAt(t) {
  const f = fxFrame(t);
  const r = { x: heroX(t), y: 0, z: ROAD_Z, rotY: 0, sx: 1, sy: 1, card: 'hero_idle', fold: fold('hero', t), moving: false };
  const hop = (t0, h, d) => { const u = (t - t0) / d; return u > 0 && u < 1 ? h * Math.sin(u * Math.PI) : 0; };
  const cyc = (pre, per) => `hero_${pre}${CYC[Math.floor((f - 0) / per) % 4]}`;
  if (t < 3.9) { r.card = 'hero_idle'; r.y = hop(4.0 - 0.7, 0, 1); }
  else if (t < 4.55) { r.card = cyc('walk', 2); r.moving = true; }
  else if (t < 5.25) r.card = 'hero_take';
  else if (t < 6.0) r.card = 'hero_read';
  else if (t < 9.0) { r.card = cyc('hold', 2); r.moving = true; }
  else if (t < 9.5) { r.card = 'hero_surprise'; r.y = hop(9.0, 0.35, 0.3); }
  else if (t < 9.75) { r.card = 'hero_surprise'; r.rotY = Math.PI * easeInOut((t - 9.5) / 0.25); r.y = hop(9.5, 0.25, 0.25); }
  else if (t < 10.72) { r.card = cyc('run', 1); r.rotY = Math.PI; r.moving = true; }
  else if (t < 11.55) { r.card = t < 10.85 ? 'hero_idle' : 'hero_pick'; r.rotY = Math.PI; }
  else if (t < 12.0) { r.card = 'hero_hug'; r.rotY = Math.PI; }
  else if (t < 12.3) { r.card = 'hero_hug'; r.rotY = Math.PI * (1 - easeInOut((t - 12.0) / 0.3)); r.y = hop(12.0, 0.22, 0.3); }
  else if (t < 12.8) { r.card = 'hero_umbidle'; r.y = hop(12.3, 0.18, 0.25); }
  else if (t < 15.6) { r.card = cyc('umb', 2); r.moving = true; }
  else if (t < 17.1) { r.card = cyc('hold', 2); r.moving = true; r.y = hop(15.6, 0.15, 0.22); }
  else if (t < 17.9) r.card = 'hero_give';
  else if (t < 19.6) r.card = Math.floor(f / 5) % 2 ? 'hero_idle2' : 'hero_idle';
  else if (t < 22.0) { r.card = Math.floor(f / 3) % 2 ? 'hero_jump' : 'hero_happy'; r.y = Math.floor(f / 3) % 2 ? 0.22 : 0; }
  else r.card = 'hero_happy';
  const info = CARD_INFO[r.card];
  r.contact = !!(info && info.contact && r.moving);
  if (r.contact) r.sy = 0.955;
  r.gait = info ? info.gait : null;
  return r;
}

// ---------- 兔兔 ----------
export function bunnyAt(t) {
  const f = fxFrame(t);
  const r = { x: 5.9, y: 0, z: 1.1, rotY: Math.PI, card: 'bunny_idle', fold: fold('bunny', t) };
  if (t < 16.2) r.card = Math.floor(f / 3) % 2 ? 'bunny_idle2' : 'bunny_idle';
  else if (t < 17.0) r.card = Math.floor(f / 2) % 2 ? 'bunny_wave2' : 'bunny_wave1';
  else if (t < 17.45) { r.card = 'bunny_surprise'; const u = (t - 17.0) / 0.45; r.y = 0.35 * Math.sin(u * Math.PI); }
  else if (t < 17.9) r.card = Math.floor(f / 2) % 2 ? 'bunny_wave2' : 'bunny_wave1';
  else if (t < 19.0) r.card = 'bunny_hold';
  else if (t < 19.6) r.card = 'bunny_idle2';
  else if (t < 22.0) { const h = Math.floor(f / 3) % 2; r.card = h ? 'bunny_hop' : 'bunny_happy'; r.y = h ? 0.2 : 0; }
  else r.card = 'bunny_happy';
  return r;
}

// ---------- 信 ----------
export function letterAt(t) {
  const L = LETTER_FLIGHT, f = fxFrame(t);
  if (t >= L.t0 && t < PICKUP_T) {
    const u = clamp((t - L.t0) / (L.t1 - L.t0));
    const x = lerp(L.from[0], L.to[0], easeOut(u) * 0.6 + u * 0.4) + 0.5 * Math.sin(u * 9);
    const arc = Math.sin(Math.min(1, u * 1.05) * Math.PI);
    const y = lerp(L.from[1], 0.04, u) + 1.6 * arc * (1 - u * 0.4) + (u < 1 ? 0.15 * Math.sin(f * 2.1) : 0);
    const flying = u < 1;
    return { visible: true, x, y, z: ROAD_Z + (flying ? 0.35 * Math.sin(u * 7) : 0.25), card: flying ? ['letter_a', 'letter_flat', 'letter_b', 'letter_flat'][f % 4] : 'letter_flat', rotZ: flying ? f * 0.9 : 0.35, lying: !flying };
  }
  if (t >= LETTER_PASS.t0 && t < LETTER_PASS.t1) {
    const u = (t - LETTER_PASS.t0) / (LETTER_PASS.t1 - LETTER_PASS.t0);
    return { visible: true, x: lerp(4.8, 5.5, u), y: 1.0 + 0.55 * Math.sin(u * Math.PI) - 0.1 * u, z: 1.25, card: 'letter_flat', rotZ: 0.2 * Math.sin(u * 6), lying: false };
  }
  return { visible: false };
}
export const mailboxCard = (t) => (t < 4.35 ? 'mailbox_a' : t < 4.95 ? 'mailbox_b' : 'mailbox_a');

// ---------- 天氣 ----------
export const LIGHTNING = [{ t: 8.25, x: -1.6, big: false }, { t: 10.1, x: -6.2, big: true }];
const FLASH_PATTERN = [1, 0, 0.8, 0, 0.3];
export function lightningAt(t) {
  const f = fxFrame(t);
  let flash = 0, bolt = null;
  for (const L of LIGHTNING) {
    const f0 = Math.round(L.t * FX_FPS), k = f - f0;
    if (k >= 0 && k < FLASH_PATTERN.length) { flash = Math.max(flash, FLASH_PATTERN[k] * (L.big ? 1 : 0.65)); if (k <= 2) bolt = { x: L.x, big: L.big, seed: f0 + k * 3 }; }
  }
  return { flash, bolt };
}
export const storm = (t) => smooth((t - 6.3) / 1.3) * (1 - smooth((t - 14.8) / 1.5));
export const rainAmt = (t) => {
  const up = t < 8.0 ? lerp(0, 0.35, smooth((t - 6.9) / 0.8)) : lerp(0.35, 1, smooth((t - 8.0) / 0.8));
  return t < 6.9 ? 0 : up * (1 - smooth((t - 14.2) / 1.2));
};
export const warmth = (t) => smooth((t - 15.8) / 2.0) * (1 - smooth((t - 22.0) / 1.5));
export const windGust = (t) => smooth((t - 8.8) / 0.2) * (1 - smooth((t - 9.6) / 0.6));

// ---------- 星星火花 ----------
export const STAR_T0 = 19.5, STAR_N = 18;
export function starsAt(t) {
  const res = [];
  for (let i = 0; i < STAR_N; i++) {
    const t0 = STAR_T0 + i * 0.11, age = (t - t0) / 1.0;
    if (age < 0 || age > 1) continue;
    const a = hash(i + 3) * Math.PI * 2, rad = 0.6 + hash(i + 9) * 1.8 * easeOut(age);
    res.push({ x: 4.9 + Math.cos(a) * rad * 1.2, y: 2.3 + Math.sin(a) * rad * 0.8 + 0.4 * age, s: Math.sin(Math.min(1, age) * Math.PI) * (0.5 + hash(i + 21) * 0.5), rot: fxFrame(t) * 0.5 + i });
  }
  return res;
}

// ---------- 腳步落地偵測 ----------
// 逐個「停格格」檢查當格顯示的卡片：從非落地卡片變成落地卡片的那一格，就是腳掌踩下的時間。
export function findFootfalls() {
  const out = [];
  let prev = null;
  const total = Math.round(DURATION * FX_FPS);
  for (let f = 0; f < total; f++) {
    const t = f / FX_FPS;
    const h = heroAt(t);
    if (h.fold < 0.9) { prev = h.card; continue; }
    if (h.contact && h.card !== prev) out.push({ t, x: h.x, gait: h.gait, card: h.card, wet: rainAmt(t) > 0.3 });
    prev = h.card;
  }
  return out;
}

// ---------- 鏡頭 ----------
const CAM_KEYS = [
  // t, tx, ty, dist, elevDeg, follow(0..1), lead
  [0.0, 6.0, 0.7, 17.5, 40, 0, 0],
  [0.9, 6.0, 0.7, 16.0, 38, 0, 0],
  [1.9, -2.5, 1.2, 16.5, 33, 0, 0],
  [3.0, -7.4, 1.8, 13.0, 27, 0, 0],
  [4.2, -7.8, 2.2, 10.6, 22, 1, 1.3],
  [8.4, -3.5, 2.3, 10.2, 20, 1, 1.4],
  [9.2, -3.5, 2.1, 8.8, 18, 1, -0.3],
  [10.8, -6.8, 2.0, 8.8, 17, 1, -0.2],
  [12.2, -6.6, 2.2, 9.6, 20, 1, 1.4],
  [14.0, -1.0, 2.4, 11.8, 22, 1, 2.6],
  [15.6, 1.8, 2.8, 15.5, 25, 0, 0],
  [17.2, 4.7, 2.1, 10.8, 19, 0, 0],
  [19.0, 4.9, 2.2, 10.0, 17, 0, 0],
  [21.4, 4.9, 2.4, 8.4, 15, 0, 0],
  [22.2, 0.0, 1.0, 24.0, 52, 0, 0],
  [23.3, 6.0, 0.7, 16.5, 42, 0, 0],
  [25.0, 6.0, 0.7, 14.5, 39, 0, 0],
];
function rawCam(t) {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && t >= CAM_KEYS[i + 1][0]) i++;
  const a = CAM_KEYS[i], b = CAM_KEYS[i + 1];
  const u = easeInOut(clamp((t - a[0]) / (b[0] - a[0])));
  const L = (k) => lerp(a[k], b[k], u);
  const follow = L(5), lead = L(6);
  const hx = heroAt(t).x + lead;
  return { tx: lerp(L(1), hx, follow), ty: L(2), dist: L(3), elev: L(4) };
}
// 先把鏡頭中心用低通濾波預先算好（可隨機存取、結果固定）
const CAM_STEP = 1 / 240, camTab = [];
(() => {
  let c = rawCam(0);
  const tau = 0.28;
  for (let i = 0; i <= DURATION * 240 + 1; i++) {
    const r = rawCam(i * CAM_STEP), k = 1 - Math.exp(-CAM_STEP / tau);
    c = { tx: c.tx + (r.tx - c.tx) * k, ty: r.ty, dist: r.dist, elev: r.elev };
    camTab.push(c);
  }
})();
export function cameraAt(t) {
  const x = clamp(t, 0, DURATION) * 240, i = Math.floor(x), u = x - i;
  const a = camTab[i], b = camTab[Math.min(i + 1, camTab.length - 1)];
  return { tx: lerp(a.tx, b.tx, u), ty: a.ty, dist: a.dist, elev: a.elev };
}

// ---------- 音效事件（Node 端合成時使用） ----------
export function buildEvents() {
  const ev = [];
  const camX = (t) => cameraAt(t).tx;
  const pan = (x, t) => clamp((x - camX(t)) / 8, -1, 1);
  ev.push({ t: 0.95, kind: 'coverOpen' }, { t: COVER.close0, kind: 'coverClose' });
  for (const [id, p] of Object.entries(POPUPS)) {
    if (p.sfx) ev.push({ t: p.open, kind: 'pop_' + p.sfx, pan: pan(p.x, p.open) });
    if (p.close != null && p.sfx && p.sfx !== 'heart' && p.sfx !== 'rainbow') ev.push({ t: p.close, kind: 'fold', pan: pan(p.x, p.close) });
  }
  for (const s of findFootfalls()) ev.push({ t: s.t, kind: 'step', gait: s.gait, wet: s.wet, pan: pan(s.x, s.t) });
  ev.push({ t: 4.55, kind: 'flag' }, { t: 4.9, kind: 'grab' });
  ev.push({ t: 9.0, kind: 'gust' }, { t: LETTER_FLIGHT.t0, kind: 'flutter', dur: LETTER_FLIGHT.t1 - LETTER_FLIGHT.t0 });
  ev.push({ t: 9.0, kind: 'gasp' }, { t: 9.5, kind: 'flip' }, { t: 12.0, kind: 'flip' });
  ev.push({ t: LETTER_FLIGHT.t1, kind: 'land' }, { t: PICKUP_T, kind: 'grab' });
  ev.push({ t: 12.3, kind: 'umbrella' }, { t: 15.6, kind: 'umbrellaClose' });
  for (const L of LIGHTNING) ev.push({ t: L.t, kind: 'crack', big: L.big }, { t: L.t + (L.big ? 0.16 : 0.55), kind: 'thunder', big: L.big });
  ev.push({ t: 17.0, kind: 'boing' }, { t: LETTER_PASS.t0, kind: 'pass' });
  for (let i = 0; i < STAR_N; i++) ev.push({ t: STAR_T0 + i * 0.11, kind: 'sparkle', note: i });
  ev.push({ t: 21.9, kind: 'lastDing' });
  return ev.sort((a, b) => a.t - b.t);
}
