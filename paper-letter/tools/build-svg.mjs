// 手寫 SVG 產生器：所有紙片角色／道具的 SVG 都由這裡的模板寫出。
// 角色用「雙骨 IK + 描邊肢體」寫姿勢，因此每個動畫卡片的腳／手落點都是明確數字，
// 腳步聲才能從這些卡片逐格對位（見 src/timeline.js 的 contact 標記）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/svg');
fs.mkdirSync(OUT, { recursive: true });

const INK = '#2d2438';
const n = (v) => +v.toFixed(1);
const out = {}; // name -> {svg, w, h, ax, ay}

function put(name, w, h, ax, ay, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linejoin="round" stroke-linecap="round">\n${body}\n</svg>\n`;
  out[name] = { svg, w, h, ax, ay };
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
}

// ---------- 小工具 ----------
function ik(hx, hy, fx, fy, l1, l2, dir) {
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; fx = hx + dx; fy = hy + dy; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = hx + (dx * a) / d, my = hy + (dy * a) / d;
  return [[hx, hy], [mx + (-dy / d) * h * dir, my + (dx / d) * h * dir], [fx, fy]];
}
const poly = (pts) => 'M' + pts.map((p) => `${n(p[0])} ${n(p[1])}`).join(' L');
function limb(pts, color, w, ow = 5) {
  const d = poly(pts);
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + ow * 2}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
}
const ell = (cx, cy, rx, ry, fill, rot = 0, sw = 4.5) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" transform="rotate(${rot} ${n(cx)} ${n(cy)})"/>`;

// ---------- 主角「小郵」 ----------
const H = { jacket: '#3f78c8', jacketD: '#2f5fa8', pants: '#34457a', pantsD: '#28365f', skin: '#ffdcb8', skinD: '#f2b98c', cap: '#e54b43', capD: '#b8302b', shoe: '#8a4b2a', bag: '#c98b4a', bagD: '#9b6431' };
const HIP = [100, 214];
const GROUND = 300;

function letterProp(cx, cy, rot, s = 1) {
  return `<g transform="translate(${n(cx)} ${n(cy)}) rotate(${rot}) scale(${s})"><rect x="-26" y="-18" width="52" height="36" rx="3" fill="#fffaf0" stroke="${INK}" stroke-width="4"/><path d="M-26 -16 L0 4 L26 -16" fill="none" stroke="${INK}" stroke-width="3.5"/><path d="M0 12 c-9 -7 -9 -13 -4 -13 c2 0 4 1 4 3 c0 -2 2 -3 4 -3 c5 0 5 6 -4 13z" transform="scale(.8) translate(0 4)" fill="#e0405a"/></g>`;
}

function hero(o) {
  const {
    bob = 0, lean = 0, nearFoot = [112, GROUND], farFoot = [88, GROUND], nearHand = [128, 214], farHand = [78, 214],
    eyes = 'normal', mouth = 'smile', letter = null, umbrella = false, headTilt = 0, squash = 0, sky = false,
  } = o;
  const hip = [HIP[0], HIP[1] + bob];
  const sh = [102, 176 + bob]; // 肩
  const legFar = ik(hip[0] - 8, hip[1], farFoot[0], farFoot[1], 42, 42, -1);
  const legNear = ik(hip[0] + 8, hip[1], nearFoot[0], nearFoot[1], 42, 42, -1);
  const armFar = ik(sh[0] - 8, sh[1], farHand[0], farHand[1] + bob, 34, 34, 1);
  const armNear = ik(sh[0] + 6, sh[1], nearHand[0], nearHand[1] + bob, 34, 34, 1);
  const shoe = (f, c) => ell(f[0] + 10, f[1] - 6, 21, 12, c, 0);
  let s = '';
  // 遠側手腳（較暗）
  s += limb(armFar, H.jacketD, 17);
  s += ell(farHand[0], farHand[1] + bob, 10, 10, '#f7f1e6', 0, 4);
  s += limb(legFar, H.pantsD, 22);
  s += shoe(farFoot, '#6a3a20');
  // 身體群組（可前傾）
  s += `<g transform="rotate(${lean} 100 ${GROUND - 80 + bob})">`;
  // 郵差包
  s += `<path d="M56 ${192 + bob} q-4 -6 4 -8 l28 0 l4 38 l-32 0z" fill="${H.bagD}" stroke="${INK}" stroke-width="4.5"/>`;
  // 軀幹
  const tb = bob;
  s += `<path d="M70 ${168 + tb} Q70 ${158 + tb} 82 ${158 + tb} L120 ${158 + tb} Q134 ${158 + tb} 134 ${172 + tb} L135 ${212 + tb} Q135 ${226 + tb} 120 ${226 + tb} L80 ${226 + tb} Q66 ${226 + tb} 67 ${212 + tb} Z" fill="${H.jacket}" stroke="${INK}" stroke-width="5"/>`;
  s += `<rect x="67" y="${208 + tb}" width="68" height="11" fill="#6b4a2f" stroke="${INK}" stroke-width="3.5"/><rect x="95" y="${207 + tb}" width="14" height="13" rx="2" fill="#f3c94d" stroke="${INK}" stroke-width="3"/>`;
  s += `<path d="M76 ${160 + tb} L128 ${224 + tb}" stroke="#7b5230" stroke-width="9" fill="none"/><path d="M76 ${160 + tb} L128 ${224 + tb}" stroke="${INK}" stroke-width="2" fill="none" opacity=".35"/>`;
  s += `<path d="M84 ${160 + tb} L100 ${176 + tb} L116 ${160 + tb} Z" fill="#fffaf0" stroke="${INK}" stroke-width="3.5"/>`;
  s += '</g>';
  // 近側腿
  s += limb(legNear, H.pants, 22);
  s += shoe(nearFoot, H.shoe);
  // 頭
  const hx = 100, hy = 116 + bob * 1.2;
  s += `<g transform="rotate(${headTilt + lean * 0.6} ${hx} ${hy + 40})">`;
  s += ell(hx - 40, hy - 6, 18, 14, '#6b4429', -20, 4.5); // 後腦頭髮
  s += ell(hx + 4, hy, 52, 49, H.skin, 0, 5);
  s += ell(hx - 44, hy + 14, 9, 11, H.skinD, 0, 4); // 耳
  // 帽子
  s += `<path d="M${hx - 50} ${hy - 12} C${hx - 54} ${hy - 62} ${hx + 56} ${hy - 66} ${hx + 56} ${hy - 12} Q${hx + 4} ${hy - 22} ${hx - 50} ${hy - 12}Z" fill="${H.cap}" stroke="${INK}" stroke-width="5"/>`;
  s += `<path d="M${hx + 22} ${hy - 20} Q${hx + 78} ${hy - 30} ${hx + 84} ${hy - 12} Q${hx + 50} ${hy - 6} ${hx + 18} ${hy - 12}Z" fill="${H.capD}" stroke="${INK}" stroke-width="5"/>`;
  s += `<circle cx="${hx + 14}" cy="${hy - 40}" r="14" fill="#fffaf0" stroke="${INK}" stroke-width="4"/><path d="M${hx + 5} ${hy - 44} h18 v10 h-18z M${hx + 5} ${hy - 44} l9 6 l9 -6" fill="none" stroke="${INK}" stroke-width="3"/>`;
  // 眼
  const eye = (cx, cy, big) => {
    if (eyes === 'happy') return `<path d="M${cx - 9} ${cy + 3} Q${cx} ${cy - 11} ${cx + 9} ${cy + 3}" fill="none" stroke="${INK}" stroke-width="5"/>`;
    if (eyes === 'wide') return `<ellipse cx="${cx}" cy="${cy}" rx="${big ? 13 : 11}" ry="${big ? 17 : 15}" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${cx + 2}" cy="${cy}" r="5.5" fill="${INK}"/>`;
    const ry = eyes === 'down' ? 9 : 13;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${big ? 8.5 : 7.5}" ry="${ry}" fill="${INK}"/><ellipse cx="${cx + 2}" cy="${cy - 4}" rx="2.8" ry="3.6" fill="#fff"/>`;
  };
  s += eye(hx + 6, hy + 4, true) + eye(hx + 34, hy + 4, false);
  s += `<ellipse cx="${hx - 10}" cy="${hy + 24}" rx="9" ry="6" fill="#ff8f8f" opacity=".55"/>`;
  s += `<circle cx="${hx + 56}" cy="${hy + 14}" r="9.5" fill="#ffb59a" stroke="${INK}" stroke-width="4.5"/>`;
  const mx = hx + 24, my = hy + 32;
  const mouths = {
    smile: `<path d="M${mx - 8} ${my} Q${mx + 4} ${my + 11} ${mx + 18} ${my - 1}" fill="none" stroke="${INK}" stroke-width="4.5"/>`,
    grin: `<path d="M${mx - 10} ${my - 2} Q${mx + 6} ${my + 20} ${mx + 22} ${my - 3} Z" fill="#7a2c3b" stroke="${INK}" stroke-width="4.5"/><path d="M${mx - 4} ${my + 4} Q${mx + 6} ${my + 8} ${mx + 16} ${my + 3}" fill="none" stroke="#fff" stroke-width="3.5"/>`,
    open: `<ellipse cx="${mx + 6}" cy="${my + 6}" rx="8" ry="11" fill="#7a2c3b" stroke="${INK}" stroke-width="4.5"/>`,
    worry: `<path d="M${mx - 6} ${my + 8} Q${mx + 6} ${my - 3} ${mx + 18} ${my + 8}" fill="none" stroke="${INK}" stroke-width="4.5"/>`,
    flat: `<path d="M${mx - 6} ${my + 3} L${mx + 18} ${my + 3}" fill="none" stroke="${INK}" stroke-width="4.5"/>`,
  };
  s += mouths[mouth];
  if (eyes === 'wide' || mouth === 'worry') s += `<path d="M${hx - 6} ${hy - 18} L${hx + 14} ${hy - 12} M${hx + 26} ${hy - 12} L${hx + 46} ${hy - 20}" stroke="${INK}" stroke-width="4" fill="none"/>`;
  s += '</g>';
  // 近側手
  if (letter) s += letterProp(letter[0], letter[1] + bob, letter[2] ?? 0, letter[3] ?? 1);
  s += limb(armNear, H.jacket, 17);
  s += ell(nearHand[0], nearHand[1] + bob, 10.5, 10.5, '#f7f1e6', 0, 4);
  if (umbrella) {
    const hxp = nearHand[0], top = 54;
    s += `<path d="M${hxp} ${nearHand[1] + bob} L${hxp} ${top}" stroke="${INK}" stroke-width="9" fill="none"/><path d="M${hxp} ${nearHand[1] + bob} L${hxp} ${top}" stroke="#8b6a45" stroke-width="4" fill="none"/>`;
    const cx = hxp - 24;
    s += `<path d="M${cx - 96} ${top + 6} Q${cx - 80} -12 ${cx} -12 Q${cx + 80} -12 ${cx + 96} ${top + 6} Q${cx + 72} ${top - 8} ${cx + 48} ${top + 6} Q${cx + 24} ${top - 8} ${cx} ${top + 6} Q${cx - 24} ${top - 8} ${cx - 48} ${top + 6} Q${cx - 72} ${top - 8} ${cx - 96} ${top + 6}Z" fill="#f4d34a" stroke="${INK}" stroke-width="5"/>`;
    s += `<path d="M${cx} -12 Q${cx - 20} 20 ${cx - 24} ${top - 8} M${cx} -12 Q${cx + 20} 20 ${cx + 24} ${top - 8}" fill="none" stroke="${INK}" stroke-width="3.5"/>`;
    s += `<circle cx="${cx}" cy="-14" r="5" fill="${INK}"/>`;
  }
  const W = 260, Hh = 320;
  return { w: W, h: Hh, body: s };
}

const heroPose = (name, o, extra = {}) => {
  const r = hero(o);
  put(name, r.w, r.h, 100, GROUND, r.body);
};

// 站姿
heroPose('hero_idle', { nearFoot: [114, GROUND], farFoot: [88, GROUND], nearHand: [126, 216], farHand: [76, 214] });
heroPose('hero_idle2', { bob: 3, nearFoot: [114, GROUND], farFoot: [88, GROUND], nearHand: [126, 220], farHand: [76, 218], mouth: 'grin' });
// 走路：A/C 為落地（contact），B/D 為過渡
const walk = (suffix, o = {}) => {
  heroPose(`hero_${suffix}A`, { bob: 5, nearFoot: [134, GROUND], farFoot: [64, GROUND - 4], nearHand: [84, 214], farHand: [124, 212], lean: 2, ...o });
  heroPose(`hero_${suffix}B`, { bob: -3, nearFoot: [102, GROUND], farFoot: [112, GROUND - 26], nearHand: [102, 220], farHand: [100, 218], ...o });
  heroPose(`hero_${suffix}C`, { bob: 5, nearFoot: [64, GROUND - 4], farFoot: [134, GROUND], nearHand: [128, 212], farHand: [78, 214], lean: 2, ...o });
  heroPose(`hero_${suffix}D`, { bob: -3, nearFoot: [112, GROUND - 26], farFoot: [102, GROUND], nearHand: [100, 218], farHand: [102, 220], ...o });
};
walk('walk');
// 拿信走路：手固定在胸前
for (const k of ['A', 'B', 'C', 'D']) {
  const bob = k === 'A' || k === 'C' ? 5 : -3;
  const feet = {
    A: [[134, GROUND], [64, GROUND - 4]], B: [[102, GROUND], [112, GROUND - 26]],
    C: [[64, GROUND - 4], [134, GROUND]], D: [[112, GROUND - 26], [102, GROUND]],
  }[k];
  heroPose(`hero_hold${k}`, { bob, nearFoot: feet[0], farFoot: feet[1], nearHand: [132, 196], farHand: [112, 200], letter: [128, 186, -6, 0.8] });
}
// 跑步：前傾、大步
const run = [
  ['A', 6, [146, GROUND - 2], [50, GROUND - 40], [70, 200], [140, 196]],
  ['B', -6, [108, GROUND - 38], [96, GROUND], [100, 206], [100, 206]],
  ['C', 6, [50, GROUND - 40], [146, GROUND - 2], [138, 198], [70, 202]],
  ['D', -6, [96, GROUND], [108, GROUND - 38], [100, 206], [100, 206]],
];
for (const [k, bob, nf, ff, nh, fh] of run) heroPose(`hero_run${k}`, { bob, lean: 14, nearFoot: nf, farFoot: ff, nearHand: nh, farHand: fh, mouth: 'open', eyes: 'wide' });
// 撐傘走路
for (const [k, bob, nf, ff] of [['A', 4, [132, GROUND], [66, GROUND - 4]], ['B', -2, [102, GROUND], [112, GROUND - 24]], ['C', 4, [66, GROUND - 4], [132, GROUND]], ['D', -2, [112, GROUND - 24], [102, GROUND]]])
  heroPose(`hero_umb${k}`, { bob, nearFoot: nf, farFoot: ff, nearHand: [168, 190], farHand: [116, 196], letter: [118, 190, -6, 0.75], umbrella: true });
heroPose('hero_umbidle', { nearFoot: [112, GROUND], farFoot: [88, GROUND], nearHand: [168, 190], farHand: [116, 196], letter: [118, 190, -6, 0.75], umbrella: true, mouth: 'smile' });
// 劇情姿勢
heroPose('hero_take', { bob: 2, nearFoot: [112, GROUND], farFoot: [88, GROUND], nearHand: [150, 168], farHand: [126, 176], letter: [142, 160, -10, 0.9], mouth: 'grin', eyes: 'happy' });
heroPose('hero_read', { nearFoot: [112, GROUND], farFoot: [88, GROUND], nearHand: [138, 178], farHand: [112, 184], letter: [126, 168, -4, 1], mouth: 'smile' });
heroPose('hero_surprise', { bob: -8, nearFoot: [120, GROUND - 14], farFoot: [80, GROUND - 14], nearHand: [150, 140], farHand: [56, 140], eyes: 'wide', mouth: 'open', headTilt: -4 });
heroPose('hero_pick', { bob: 18, lean: 26, nearFoot: [120, GROUND], farFoot: [76, GROUND], nearHand: [160, 262], farHand: [140, 270], eyes: 'down', mouth: 'flat' });
heroPose('hero_hug', { nearFoot: [112, GROUND], farFoot: [88, GROUND], nearHand: [130, 196], farHand: [108, 200], letter: [120, 190, -6, 0.85], mouth: 'worry', eyes: 'wide' });
heroPose('hero_give', { bob: 2, lean: 6, nearFoot: [120, GROUND], farFoot: [84, GROUND], nearHand: [176, 188], farHand: [140, 190], letter: [172, 178, 4, 0.9], mouth: 'grin', eyes: 'happy' });
heroPose('hero_happy', { bob: -2, nearFoot: [118, GROUND], farFoot: [84, GROUND], nearHand: [150, 124], farHand: [56, 124], mouth: 'grin', eyes: 'happy' });
heroPose('hero_jump', { bob: -16, nearFoot: [124, GROUND - 32], farFoot: [78, GROUND - 22], nearHand: [152, 128], farHand: [54, 130], mouth: 'grin', eyes: 'happy' });

// ---------- 兔兔 ----------
function bunny(o) {
  const { earL = -8, earR = 10, arm = 'down', eyes = 'normal', foot = 0, mouth = 'smile', bob = 0, letter = false } = o;
  const B = '#fff0f5', Bd = '#f4cfe0', pink = '#ff9db8', sc = '#f4b83e';
  let s = '';
  const ear = (cx, rot, back) => `<g transform="rotate(${rot} ${cx} 92)"><path d="M${cx - 17} 92 C${cx - 22} 20 ${cx - 6} -4 ${cx} -4 C${cx + 10} -4 ${cx + 22} 20 ${cx + 17} 92Z" fill="${back ? Bd : B}" stroke="${INK}" stroke-width="5"/><path d="M${cx - 8} 84 C${cx - 11} 36 ${cx - 2} 14 ${cx} 14 C${cx + 4} 14 ${cx + 11} 36 ${cx + 8} 84Z" fill="${pink}" opacity=".85"/></g>`;
  s += ear(82, earL, true);
  s += ell(66, 250 + bob, 18, 14, Bd); // 尾巴
  s += ell(100, 232 - foot, 18, 11, Bd, 0, 4) ;
  s += `<path d="M62 ${176 + bob} Q60 ${248 + bob} 100 ${252 + bob} Q142 ${248 + bob} 140 ${176 + bob}Z" fill="${B}" stroke="${INK}" stroke-width="5"/>`;
  s += `<path d="M76 ${186 + bob} Q100 ${216 + bob} 128 ${186 + bob}" fill="${sc}" stroke="${INK}" stroke-width="4.5" opacity="0"/>`;
  s += ell(96, 266 - foot, 22, 12, B, 0, 4.5) + ell(130, 266 - foot * 0.5, 22, 12, B, 0, 4.5);
  s += `<path d="M74 176 Q100 196 128 176 L130 192 Q100 214 72 192Z" fill="${sc}" stroke="${INK}" stroke-width="4.5"/>`; // 圍巾
  const armPos = { down: [[132, 214], [78, 218]], wave: [[148, 130], [78, 218]], wave2: [[158, 148], [78, 218]], up: [[150, 124], [56, 124]], hold: [[138, 206], [114, 210]] }[arm];
  const al = ik(122, 196 + bob, armPos[0][0], armPos[0][1], 24, 24, 1);
  const ar = ik(80, 196 + bob, armPos[1][0], armPos[1][1], 24, 24, 1);
  s += limb(ar, Bd, 14, 4.5) + limb(al, B, 14, 4.5);
  s += ell(armPos[0][0], armPos[0][1], 9, 9, B, 0, 4) ;
  if (letter) s += letterProp(126, 200, -6, 0.7);
  // 頭
  s += ell(104, 132 + bob, 54, 46, B, 0, 5);
  s += ear(112, earR, false);
  s += ell(104, 132 + bob, 53, 45, 'none', 0, 0);
  const eye = (cx) => eyes === 'happy' ? `<path d="M${cx - 8} ${134 + bob} Q${cx} ${122 + bob} ${cx + 8} ${134 + bob}" fill="none" stroke="${INK}" stroke-width="5"/>`
    : eyes === 'wide' ? `<ellipse cx="${cx}" cy="${128 + bob}" rx="11" ry="14" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${cx + 2}" cy="${129 + bob}" r="5" fill="${INK}"/>`
      : `<ellipse cx="${cx}" cy="${128 + bob}" rx="7" ry="11" fill="${INK}"/><ellipse cx="${cx + 2}" cy="${123 + bob}" rx="2.6" ry="3.4" fill="#fff"/>`;
  s += eye(96) + eye(128);
  s += `<ellipse cx="82" cy="${148 + bob}" rx="9" ry="6" fill="#ff8fa8" opacity=".6"/><ellipse cx="140" cy="${148 + bob}" rx="8" ry="5.5" fill="#ff8fa8" opacity=".6"/>`;
  s += `<path d="M107 ${142 + bob} l10 0 l-5 7z" fill="${pink}" stroke="${INK}" stroke-width="3.5"/>`;
  s += mouth === 'open' ? `<ellipse cx="112" cy="${158 + bob}" rx="7" ry="8" fill="#7a2c3b" stroke="${INK}" stroke-width="4"/>`
    : `<path d="M112 ${149 + bob} q-1 10 -11 10 M112 ${149 + bob} q1 10 11 10" fill="none" stroke="${INK}" stroke-width="4"/>`;
  // 頭上小花
  s += `<g transform="translate(70 ${96 + bob})"><circle r="9" cx="0" cy="-10" fill="#ff7aa2" stroke="${INK}" stroke-width="3"/><circle r="9" cx="10" cy="0" fill="#ff7aa2" stroke="${INK}" stroke-width="3"/><circle r="9" cx="-10" cy="0" fill="#ff7aa2" stroke="${INK}" stroke-width="3"/><circle r="9" cx="0" cy="10" fill="#ff7aa2" stroke="${INK}" stroke-width="3"/><circle r="6" fill="#ffe36b" stroke="${INK}" stroke-width="3"/></g>`;
  return s;
}
const bp = (name, o) => put(name, 220, 290, 108, 278, bunny(o));
bp('bunny_idle', {});
bp('bunny_idle2', { bob: 3, earL: -12, earR: 14 });
bp('bunny_wave1', { arm: 'wave', earL: -10, earR: 12 });
bp('bunny_wave2', { arm: 'wave2', earL: -6, earR: 6, bob: 2 });
bp('bunny_surprise', { arm: 'up', earL: 0, earR: 0, eyes: 'wide', mouth: 'open', foot: 10, bob: -6 });
bp('bunny_hop', { arm: 'up', earL: -22, earR: 24, eyes: 'happy', mouth: 'open', foot: 26, bob: -22 });
bp('bunny_hold', { arm: 'hold', letter: true, eyes: 'happy' });
bp('bunny_happy', { arm: 'up', eyes: 'happy', mouth: 'open', earL: -16, earR: 18, foot: 6, bob: -4 });

// ---------- 信 ----------
put('letter_flat', 120, 90, 60, 45, letterProp(60, 45, 0, 1.9));
put('letter_a', 120, 90, 60, 45, `<path d="M14 18 L100 6 L108 70 L10 76Z" fill="#fffaf0" stroke="${INK}" stroke-width="4"/><path d="M14 18 L60 46 L100 6" fill="none" stroke="${INK}" stroke-width="3.5"/>`);
put('letter_b', 120, 90, 60, 45, `<path d="M20 10 L98 22 L92 78 L26 64Z" fill="#fffaf0" stroke="${INK}" stroke-width="4"/><path d="M20 10 L60 40 L98 22" fill="none" stroke="${INK}" stroke-width="3.5"/><circle cx="60" cy="42" r="8" fill="#e0405a"/>`);
put('letter_open', 150, 180, 75, 170, `<rect x="12" y="8" width="126" height="162" rx="5" fill="#fffaf0" stroke="${INK}" stroke-width="5"/><path d="M30 34 h60 M30 52 h90 M30 70 h76" stroke="#b8a98f" stroke-width="5"/><path d="M30 148 h40" stroke="#b8a98f" stroke-width="5"/>`);
put('heart', 150, 140, 75, 134, `<path d="M75 128 C10 84 8 28 42 22 C60 19 72 30 75 42 C78 30 90 19 108 22 C142 28 140 84 75 128Z" fill="#ff5b7f" stroke="${INK}" stroke-width="6"/><path d="M38 40 q8 -8 18 -4" fill="none" stroke="#fff" stroke-width="7"/>`);
put('star', 80, 80, 40, 40, `<path d="M40 4 L49 31 L76 40 L49 49 L40 76 L31 49 L4 40 L31 31Z" fill="#ffe45c" stroke="${INK}" stroke-width="4.5"/>`);

// ---------- 道具 ----------
const flowerRow = (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M0 0 v-18" stroke="#3e8e3e" stroke-width="4"/><circle cy="-22" r="8" fill="${c}" stroke="${INK}" stroke-width="3.5"/><circle cy="-22" r="3" fill="#ffe36b"/></g>`;
put('house_post', 320, 300, 160, 286, `
<rect x="40" y="130" width="240" height="156" rx="6" fill="#fff1d6" stroke="${INK}" stroke-width="6"/>
<path d="M18 140 L160 24 L302 140Z" fill="#e5483f" stroke="${INK}" stroke-width="6"/>
<path d="M60 128 L160 46 M110 128 L160 86 M200 128 L160 86 M260 128 L160 46" stroke="${INK}" stroke-width="0"/>
<rect x="222" y="36" width="34" height="62" fill="#c25a3c" stroke="${INK}" stroke-width="5"/>
<rect x="132" y="190" width="56" height="96" rx="26" fill="#3f78c8" stroke="${INK}" stroke-width="5.5"/><circle cx="176" cy="240" r="5" fill="#f3c94d"/>
<rect x="58" y="164" width="52" height="52" rx="10" fill="#bfe6ff" stroke="${INK}" stroke-width="5"/><path d="M84 164 v52 M58 190 h52" stroke="${INK}" stroke-width="4"/>
<rect x="210" y="164" width="52" height="52" rx="10" fill="#bfe6ff" stroke="${INK}" stroke-width="5"/><path d="M236 164 v52 M210 190 h52" stroke="${INK}" stroke-width="4"/>
<circle cx="160" cy="104" r="22" fill="#fffaf0" stroke="${INK}" stroke-width="5"/><path d="M146 98 h28 v14 h-28z M146 98 l14 9 l14 -9" fill="none" stroke="${INK}" stroke-width="3.5"/>
${flowerRow(70, 286, '#ff7aa2')}${flowerRow(98, 286, '#ffd24a')}${flowerRow(232, 286, '#ff7aa2')}${flowerRow(258, 286, '#9ad0ff')}`);
put('house_friend', 330, 300, 165, 286, `
<path d="M36 150 Q36 130 56 130 L274 130 Q294 130 294 150 L290 286 L40 286Z" fill="#ffd9e6" stroke="${INK}" stroke-width="6"/>
<path d="M10 140 Q165 -30 320 140 Q165 110 10 140Z" fill="#f4b83e" stroke="${INK}" stroke-width="6"/>
<path d="M70 120 Q165 34 260 120" fill="none" stroke="${INK}" stroke-width="3.5" opacity=".5"/>
<rect x="238" y="30" width="32" height="56" fill="#c25a3c" stroke="${INK}" stroke-width="5"/>
<path d="M254 18 q-14 -14 2 -26 q14 -10 6 -22" fill="none" stroke="#d6d6e6" stroke-width="8"/>
<path d="M133 286 V214 a32 32 0 0 1 64 0 V286Z" fill="#8b5fbf" stroke="${INK}" stroke-width="5.5"/><circle cx="184" cy="248" r="5" fill="#f3c94d"/>
<circle cx="80" cy="198" r="26" fill="#bfe6ff" stroke="${INK}" stroke-width="5"/><path d="M80 172 v52 M54 198 h52" stroke="${INK}" stroke-width="4"/>
<circle cx="250" cy="198" r="26" fill="#bfe6ff" stroke="${INK}" stroke-width="5"/><path d="M250 172 v52 M224 198 h52" stroke="${INK}" stroke-width="4"/>
${flowerRow(66, 286, '#fff')}${flowerRow(98, 286, '#ff7aa2')}${flowerRow(236, 286, '#ffd24a')}${flowerRow(266, 286, '#fff')}`);
const mailbox = (flagUp, letter) => `
<rect x="52" y="90" width="16" height="106" fill="#8b6a45" stroke="${INK}" stroke-width="5"/>
<rect x="18" y="40" width="84" height="58" rx="28" fill="#3f78c8" stroke="${INK}" stroke-width="5.5"/>
<rect x="18" y="68" width="84" height="30" fill="#3f78c8" stroke="${INK}" stroke-width="5.5"/>
<rect x="24" y="60" width="40" height="8" rx="3" fill="${INK}" opacity=".55"/>
<g transform="${flagUp ? 'rotate(-90 96 58)' : 'rotate(0 96 58)'}"><rect x="94" y="52" width="6" height="40" fill="#e5483f" stroke="${INK}" stroke-width="3"/><rect x="94" y="80" width="26" height="14" fill="#e5483f" stroke="${INK}" stroke-width="3.5"/></g>
${letter ? letterProp(40, 38, -14, 0.6) : ''}`;
put('mailbox_a', 130, 200, 60, 196, mailbox(false, false));
put('mailbox_b', 130, 200, 60, 196, mailbox(true, true));
put('tree_a', 220, 330, 110, 320, `<rect x="96" y="190" width="28" height="130" rx="6" fill="#8b6a45" stroke="${INK}" stroke-width="5.5"/><circle cx="110" cy="116" r="92" fill="#4fb35a" stroke="${INK}" stroke-width="6"/><circle cx="62" cy="150" r="52" fill="#4fb35a" stroke="${INK}" stroke-width="6"/><circle cx="160" cy="150" r="52" fill="#4fb35a" stroke="${INK}" stroke-width="6"/><circle cx="110" cy="120" r="84" fill="#5cc468"/><path d="M60 80 q14 -26 40 -26" stroke="#8be09a" stroke-width="9" fill="none"/><circle cx="84" cy="130" r="10" fill="#e5483f" stroke="${INK}" stroke-width="3.5"/><circle cx="140" cy="104" r="10" fill="#e5483f" stroke="${INK}" stroke-width="3.5"/><circle cx="118" cy="158" r="10" fill="#e5483f" stroke="${INK}" stroke-width="3.5"/>`);
put('tree_b', 190, 360, 95, 350, `<rect x="82" y="270" width="26" height="80" rx="6" fill="#8b6a45" stroke="${INK}" stroke-width="5.5"/><path d="M95 8 L170 130 L132 130 L178 214 L130 214 L186 290 L4 290 L60 214 L12 214 L58 130 L20 130Z" fill="#3e9e6a" stroke="${INK}" stroke-width="6"/><path d="M95 40 L52 130 M95 130 L40 214" stroke="#7fd69b" stroke-width="7" fill="none"/>`);
put('bush', 170, 100, 85, 94, `<circle cx="50" cy="56" r="40" fill="#4fb35a" stroke="${INK}" stroke-width="5.5"/><circle cx="118" cy="58" r="36" fill="#4fb35a" stroke="${INK}" stroke-width="5.5"/><circle cx="84" cy="44" r="42" fill="#5cc468" stroke="${INK}" stroke-width="5.5"/><circle cx="70" cy="40" r="8" fill="#ffd24a" stroke="${INK}" stroke-width="3"/><circle cx="104" cy="62" r="8" fill="#ff7aa2" stroke="${INK}" stroke-width="3"/>`);
const cloudPath = (w) => `M30 ${w ? 96 : 96} Q6 96 6 74 Q6 54 30 52 Q32 22 64 22 Q82 0 108 14 Q124 -2 148 14 Q180 8 186 40 Q214 42 214 70 Q214 96 188 96Z`;
put('cloud_w1', 220, 110, 110, 55, `<path d="${cloudPath(1)}" fill="#fff" stroke="${INK}" stroke-width="5.5"/><path d="M40 44 q12 -12 28 -8" stroke="#dbeaff" stroke-width="7" fill="none"/>`);
put('cloud_w2', 220, 110, 110, 55, `<g transform="translate(220 0) scale(-1 1)"><path d="${cloudPath(1)}" fill="#fff" stroke="${INK}" stroke-width="5.5"/></g><path d="M170 44 q-12 -12 -28 -8" stroke="#dbeaff" stroke-width="7" fill="none"/>`);
const dark = (flip) => `<g ${flip ? 'transform="translate(220 0) scale(-1 1)"' : ''}><path d="${cloudPath(1)}" fill="#6d7596" stroke="${INK}" stroke-width="5.5"/><path d="M30 80 q30 10 60 0 M120 80 q30 10 60 0" stroke="#59607f" stroke-width="7" fill="none"/></g>
<path d="M78 46 l24 10 M146 46 l-24 10" stroke="${INK}" stroke-width="5.5" fill="none"/><ellipse cx="90" cy="64" rx="6" ry="8" fill="${INK}"/><ellipse cx="134" cy="64" rx="6" ry="8" fill="${INK}"/><ellipse cx="92" cy="61" rx="2" ry="3" fill="#fff"/><ellipse cx="136" cy="61" rx="2" ry="3" fill="#fff"/><path d="M98 84 Q112 74 126 84" fill="none" stroke="${INK}" stroke-width="5"/>`;
put('cloud_d1', 220, 110, 110, 55, dark(false));
put('cloud_d2', 220, 110, 110, 55, dark(true));
const sunBody = (rot) => {
  let r = '';
  for (let i = 0; i < 10; i++) { const a = (i * 36 + rot) * Math.PI / 180, b = 0.2; const p = (ang, rad) => `${n(100 + Math.cos(ang) * rad)} ${n(100 + Math.sin(ang) * rad)}`; r += `<path d="M${p(a - b, 58)} L${p(a, 92)} L${p(a + b, 58)}Z" fill="#ffb52e" stroke="${INK}" stroke-width="4.5"/>`; }
  return r + `<circle cx="100" cy="100" r="54" fill="#ffd84a" stroke="${INK}" stroke-width="6"/><ellipse cx="82" cy="94" rx="6" ry="9" fill="${INK}"/><ellipse cx="118" cy="94" rx="6" ry="9" fill="${INK}"/><ellipse cx="84" cy="91" rx="2" ry="3" fill="#fff"/><ellipse cx="120" cy="91" rx="2" ry="3" fill="#fff"/><path d="M80 116 Q100 134 120 116" fill="none" stroke="${INK}" stroke-width="5"/><ellipse cx="68" cy="112" rx="8" ry="5" fill="#ff8f6f" opacity=".6"/><ellipse cx="132" cy="112" rx="8" ry="5" fill="#ff8f6f" opacity=".6"/>`;
};
put('sun_a', 200, 200, 100, 100, sunBody(0));
put('sun_b', 200, 200, 100, 100, sunBody(18));
put('puddle', 200, 80, 100, 40, `<ellipse cx="100" cy="40" rx="92" ry="30" fill="#8fc4f0" stroke="${INK}" stroke-width="5"/><path d="M52 34 q20 -10 40 -4" stroke="#fff" stroke-width="6" fill="none"/>`);
// 背景丘陵（三層）
const hill = (c, c2, pts, w = 1200, h = 360) => `<path d="M0 ${h} L0 ${pts[0]} ${pts.slice(1).map((y, i) => `Q${(i + 0.5) * w / (pts.length - 1)} ${y - 70} ${(i + 1) * w / (pts.length - 1)} ${y}`).join(' ')} L${w} ${h}Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`;
put('hills_far', 1200, 360, 600, 356, hill('#9fd8a8', '', [210, 150, 200, 130, 190]));
put('hills_mid', 1200, 320, 600, 316, hill('#6cc07a', '', [160, 220, 140, 210, 150]) + `<path d="M150 200 q20 -20 40 0 M700 190 q20 -20 40 0 M1010 210 q20 -20 40 0" stroke="#4fa35d" stroke-width="5" fill="none"/>`);
put('hills_near', 1200, 260, 600, 256, hill('#4fb35a', '', [120, 160, 100, 170, 110]));

// ---------- 設定圖（model sheet） ----------
fs.mkdirSync(path.join(ROOT, 'art'), { recursive: true });
const sheetNames = ['hero_idle', 'hero_walkA', 'hero_walkB', 'hero_walkC', 'hero_walkD', 'hero_runA', 'hero_runB', 'hero_read', 'hero_surprise', 'hero_pick', 'hero_umbA', 'hero_happy', 'bunny_idle', 'bunny_wave1', 'bunny_hop', 'bunny_hold', 'letter_flat', 'house_post', 'house_friend', 'mailbox_b', 'tree_a', 'cloud_d1', 'sun_a', 'heart'];
let sheet = '', i = 0;
for (const nm of sheetNames) {
  const o = out[nm], sc = 150 / Math.max(o.w, o.h) * (nm.startsWith('house') ? 1.2 : 1);
  const col = i % 6, row = Math.floor(i / 6);
  sheet += `<g transform="translate(${20 + col * 180} ${20 + row * 180}) scale(${n(sc)})">${o.svg.replace(/<\/?svg[^>]*>/g, '')}</g><text x="${20 + col * 180}" y="${row * 180 + 190}" font-size="11" fill="#555" font-family="monospace">${nm}</text>`;
  i++;
}
fs.writeFileSync(path.join(ROOT, 'art/model-sheet.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="760" viewBox="0 0 1120 760"><rect width="1120" height="760" fill="#fbf6ea"/>${sheet}</svg>`);

// ---------- 打包成 JS 模組（頁面直接內嵌，不用 fetch） ----------
fs.writeFileSync(path.join(ROOT, 'src/svg-bundle.js'), '// 由 tools/build-svg.mjs 產生，勿手改\nexport default ' + JSON.stringify(out) + ';\n');
console.log('svg written:', Object.keys(out).length);
