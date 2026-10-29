// 程式直接合成《紙信》的配樂與音效：純 JS、不用任何付費 API、也不用音源檔。
// 音效事件（腳步、彈起、雷、翻頁…）全部來自 src/timeline.js —— 與畫面同一份時間軸。
// 腳步時間是 findFootfalls() 逐個 12fps 停格格檢查「哪一格換成腳掌落地的卡片」得到的。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as T from '../src/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 44100, TAIL = 1.0, N = Math.round((T.DURATION + TAIL) * SR);
const L = new Float32Array(N), R = new Float32Array(N);

let seed = 20250611;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TAU = Math.PI * 2;

/** Chamberlin 狀態變數濾波器：同一個濾波器可即時掃頻 */
function svf() {
  let low = 0, band = 0;
  return (x, fc, Q = 0.8) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 8)) / SR), q = 1 / Q;
    low += f * band; const high = x - low - q * band; band += f * high;
    return { lp: low, bp: band, hp: high };
  };
}
const gen = (dur, fn) => { const n = Math.round(dur * SR), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = fn(i / SR, i); return a; };
function mix(t0, a, gain = 1, pan = 0) {
  if (a.some(Number.isNaN) || Number.isNaN(gain) || Number.isNaN(pan)) { console.log("NaN in mix", t0, gain, pan, new Error().stack.split("\n")[2]); return; }
  const i0 = Math.round(t0 * SR), gl = Math.cos(((pan + 1) * Math.PI) / 4) * gain, gr = Math.sin(((pan + 1) * Math.PI) / 4) * gain;
  for (let i = 0; i < a.length; i++) { const k = i0 + i; if (k < 0 || k >= N) continue; L[k] += a[i] * gl; R[k] += a[i] * gr; }
}
const env = (t, a, d, curve = 3) => (t < a ? t / a : Math.exp(-(t - a) * curve / d));

// ---------- 樂器 ----------
function celesta(t, midi, dur = 1.4, vel = 0.5, pan = 0) {
  const f = mtof(midi);
  mix(t, gen(dur, (x) => {
    const e = Math.exp(-x * 3.2) * Math.min(1, x / 0.004), idx = 2.2 * Math.exp(-x * 7);
    return (Math.sin(TAU * f * x + idx * Math.sin(TAU * f * 3.5 * x)) + 0.25 * Math.sin(TAU * f * 4.01 * x) * Math.exp(-x * 9)) * e;
  }), vel, pan);
}
function marimba(t, midi, dur = 0.5, vel = 0.5, pan = 0) {
  const f = mtof(midi);
  mix(t, gen(dur, (x) => (Math.sin(TAU * f * x) + 0.5 * Math.sin(TAU * f * 3.99 * x) * Math.exp(-x * 25) + 0.2 * Math.sin(TAU * f * 9.2 * x) * Math.exp(-x * 60)) * Math.exp(-x * 9) * Math.min(1, x / 0.002)), vel, pan);
}
function pluck(t, midi, dur = 0.6, vel = 0.5, pan = 0) { // Karplus-Strong 撥弦（低音撥奏）
  const f = mtof(midi), n = Math.round(SR / f), buf = new Float32Array(n).map(() => noise());
  let p = 0, prev = 0;
  mix(t, gen(dur, (x) => { const cur = buf[p]; const nx = 0.5 * (cur + prev) * 0.996; buf[p] = nx; prev = cur; p = (p + 1) % n; return cur * Math.min(1, x / 0.002); }), vel, pan);
}
function bassNote(t, midi, dur = 0.5, vel = 0.45) {
  const f = mtof(midi), lp = svf();
  mix(t, gen(dur, (x) => { const s = (2 * ((f * x) % 1) - 1) * 0.5 + Math.sin(TAU * f * x); return lp(s, 500 + 800 * Math.exp(-x * 12)).lp * env(x, 0.005, dur * 0.7, 4); }), vel, -0.1);
}
function pad(t, midis, dur, vel = 0.25, bright = 900) {
  for (const m of midis) {
    const f = mtof(m), lp = svf();
    mix(t, gen(dur, (x) => {
      const a = Math.min(1, x / 0.9) * Math.min(1, (dur - x) / 0.9);
      let s = 0; for (const d of [-0.004, 0, 0.004]) s += 2 * (((f * (1 + d)) * x) % 1) - 1;
      return lp(s * 0.33, bright + 500 * Math.sin(x * 0.7), 0.7).lp * a;
    }), vel / midis.length * 1.6, rnd() * 0.6 - 0.3);
  }
}
function timpani(t, f0 = 62, vel = 0.7, dur = 0.9) {
  const lp = svf();
  mix(t, gen(dur, (x) => { const f = f0 * (1 + 0.8 * Math.exp(-x * 30)); return (Math.sin(TAU * f * x) * Math.exp(-x * 5) + lp(noise(), 300).lp * Math.exp(-x * 40) * 0.5) * Math.min(1, x / 0.003); }), vel, 0);
}

// ---------- 音效 ----------
const swish = (t, dur, f0, f1, vel = 0.25, pan = 0, q = 1.2) => { const s = svf(); mix(t, gen(dur, (x) => s(noise(), f0 + (f1 - f0) * (x / dur), q).bp * Math.sin(Math.PI * Math.min(1, x / dur)) ** 1.5 * 2.2), vel, pan); };
const click = (t, hz, dur, vel, pan = 0) => { const s = svf(); mix(t, gen(dur, (x) => s(noise(), hz, 1.5).bp * Math.exp(-x * 5 / dur) * 3), vel, pan); };
const thump = (t, f0, f1, dur, vel, pan = 0) => mix(t, gen(dur, (x) => Math.sin(TAU * (f1 + (f0 - f1) * Math.exp(-x * 30)) * x) * Math.exp(-x * 6 / dur * 2.5)), vel, pan);
const blip = (t, f0, f1, dur, vel, pan = 0, vib = 0) => mix(t, gen(dur, (x) => Math.sin(TAU * ((f0 + (f1 - f0) * (x / dur)) * x + vib * Math.sin(x * 60) * 0.02)) * Math.sin(Math.PI * Math.min(1, x / dur)) ** 0.5), vel, pan);

function sfx(e) {
  const pan = e.pan ?? 0;
  switch (e.kind) {
    case 'step': {
      const run = e.gait === 'run', vel = run ? 0.5 : 0.36;
      thump(e.t, run ? 150 : 120, 58, run ? 0.09 : 0.11, vel, pan);
      click(e.t, 1800, 0.035, vel * 0.9, pan);
      if (e.wet) click(e.t + 0.004, 3600, 0.07, vel * 0.5, pan);
      break;
    }
    case 'pop_small': swish(e.t, 0.13, 1800, 4200, 0.35, pan); blip(e.t + 0.02, 380, 900, 0.09, 0.22, pan); thump(e.t + 0.1, 130, 70, 0.1, 0.3, pan); click(e.t + 0.1, 2600, 0.04, 0.3, pan); break;
    case 'pop_big': swish(e.t, 0.28, 900, 3800, 0.4, pan); for (let i = 0; i < 6; i++) click(e.t + i * 0.035, 2200 + i * 300, 0.03, 0.22, pan); blip(e.t + 0.05, 220, 640, 0.22, 0.25, pan, 4); thump(e.t + 0.26, 110, 48, 0.2, 0.5, pan); click(e.t + 0.26, 3000, 0.05, 0.4, pan); break;
    case 'fold': swish(e.t, 0.18, 3600, 1100, 0.3, pan); thump(e.t + 0.17, 100, 55, 0.12, 0.3, pan); break;
    case 'pop_heart': [84, 88, 91, 96].forEach((m, i) => celesta(e.t + i * 0.07, m, 1.6, 0.5)); swish(e.t, 0.3, 2000, 7000, 0.2); break;
    case 'pop_rainbow': [72, 74, 76, 77, 79, 81, 83].forEach((m, i) => celesta(e.t + i * 0.1, m, 1.2, 0.45, -0.3 + i * 0.1)); break;
    case 'coverOpen': { // 吱呀
      const lp = svf(), dur = T.COVER.open1 - T.COVER.open0;
      mix(e.t, gen(dur, (x) => { const f = 90 + 40 * Math.sin(x * 9) + 70 * (x / dur); return lp(2 * ((f * x) % 1) - 1, 380 + 300 * Math.sin(x * 5), 3).bp * Math.sin(Math.PI * x / dur) * 0.9; }), 0.28, 0);
      swish(e.t, dur, 600, 2400, 0.25);
      thump(e.t + dur, 90, 45, 0.3, 0.6);
      break;
    }
    case 'coverClose': swish(e.t, 1.1, 1800, 500, 0.28); thump(e.t + 1.15, 80, 40, 0.5, 0.75); click(e.t + 1.15, 600, 0.12, 0.4); break;
    case 'flag': click(e.t, 3200, 0.05, 0.3); blip(e.t, 1500, 1100, 0.07, 0.15); break;
    case 'grab': swish(e.t, 0.1, 2800, 5200, 0.35, pan); break;
    case 'gust': swish(e.t - 0.1, 1.1, 300, 1900, 0.5, 0.3, 0.9); swish(e.t, 0.9, 700, 3200, 0.25, -0.2); break;
    case 'flutter': for (let t = e.t; t < e.t + e.dur; t += 1 / 12) click(t, 3000 + rnd() * 2500, 0.03, 0.12 * (1 - (t - e.t) / e.dur * 0.5), -0.3 + ((t - e.t) / e.dur) * -0.2); break;
    case 'gasp': blip(e.t, 260, 640, 0.16, 0.45, 0, 3); blip(e.t + 0.01, 390, 960, 0.16, 0.2, 0, 3); break;
    case 'flip': swish(e.t, 0.22, 800, 3600, 0.3); click(e.t + 0.1, 2400, 0.05, 0.4); click(e.t + 0.24, 2000, 0.05, 0.25); break;
    case 'land': swish(e.t, 0.12, 1200, 400, 0.3); thump(e.t, 200, 90, 0.1, 0.25); break;
    case 'umbrella': swish(e.t, 0.14, 500, 2600, 0.45); thump(e.t + 0.1, 120, 60, 0.14, 0.5); for (let i = 0; i < 5; i++) click(e.t + 0.02 + i * 0.022, 3800, 0.015, 0.25); break;
    case 'umbrellaClose': swish(e.t, 0.14, 2600, 700, 0.35); thump(e.t + 0.1, 150, 80, 0.08, 0.3); break;
    case 'crack': { const s = svf(); mix(e.t, gen(e.big ? 0.5 : 0.35, (x) => s(noise(), 3000, 0.7).hp * Math.exp(-x * (e.big ? 9 : 14)) * Math.min(1, x / 0.001)), e.big ? 0.8 : 0.5, 0.1); if (e.big) thump(e.t, 80, 35, 0.35, 0.7); break; }
    case 'thunder': {
      const dur = e.big ? 3.2 : 2.4, lp = svf(), lp2 = svf();
      mix(e.t, gen(dur, (x) => { const roll = 0.65 + 0.35 * Math.sin(x * 19 + Math.sin(x * 7) * 2); const c = 420 * Math.exp(-x * 0.9) + 90; return (lp(noise(), c, 0.7).lp * 1.8 + lp2(noise(), 70, 0.9).lp * 2) * roll * env(x, 0.12, dur * 0.55, 4); }), e.big ? 1.1 : 0.75, 0);
      break;
    }
    case 'boing': blip(e.t, 200, 600, 0.12, 0.4, 0.3, 2); blip(e.t + 0.12, 600, 240, 0.2, 0.4, 0.3, 6); break;
    case 'pass': swish(e.t, 0.4, 1200, 3000, 0.2, 0.1); click(e.t + 0.4, 2800, 0.04, 0.25, 0.2); break;
    case 'sparkle': { const sc = [84, 86, 88, 91, 93, 96]; celesta(e.t, sc[(e.note * 5) % 6], 1.1, 0.34, ((e.note * 37) % 100) / 50 - 1); break; }
    case 'lastDing': celesta(e.t, 96, 3, 0.4); celesta(e.t, 84, 3, 0.35); break;
  }
}

// ---------- 配樂 ----------
const BPM = 108, BEAT = 60 / BPM;
const seq = (t0, notes, fn) => { for (const [b, m, d = 0.5, v = 0.5] of notes) fn(t0 + b * BEAT, m, d * BEAT * 1.4, v); };

function music() {
  // 0–2.4 音樂盒開場，隨封面掀開往上
  [72, 76, 79, 84].forEach((m, i) => celesta(0.2 + i * 0.28, m, 2, 0.35));
  [79, 84, 88, 91, 96].forEach((m, i) => celesta(1.1 + i * 0.22, m, 1.8, 0.32 + i * 0.03, -0.3 + i * 0.15));
  pad(0.8, [48, 55, 64], 2.2, 0.2, 700);

  // A 主題（晴天，C 大調）2.4 起兩輪
  const A = [[0, 76], [0.5, 79], [1, 84, 1], [2, 83, 0.5], [2.5, 79], [3, 81, 1], [4, 77], [4.5, 81], [5, 86, 1], [6, 84, 0.5], [6.5, 81], [7, 79, 1],
    [8, 76], [8.5, 79], [9, 84, 1], [10, 86, 0.5], [10.5, 88], [11, 86, 1], [12, 84, 2]];
  seq(2.4, A, (t, m, d, v) => marimba(t, m, d, v * 0.9, 0.15));
  const bass = [[0, 48], [2, 55], [4, 53], [6, 60], [8, 48], [10, 55], [12, 55], [13, 43], [14, 48]];
  seq(2.4, bass, (t, m) => pluck(t, m - 12, 0.5, 0.55));
  for (let b = 0; b < 15; b++) { click(2.4 + b * BEAT + BEAT / 2, 6500, 0.03, 0.12, 0.35); }
  for (let b = 0; b < 15; b += 2) { marimba(2.4 + b * BEAT + BEAT * 0.5, [60, 64, 67][b % 3], 0.25, 0.16, -0.25); }
  pad(2.4, [60, 64, 67], 4.0, 0.14, 900);

  // 風暴（A 小調）6.4–14.6：低音鼓、顫音 pad、稀疏鈴聲
  const chords = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
  for (let i = 0; i < 4; i++) pad(6.3 + i * 2.1, chords[i].map((m) => m - 12), 2.4, 0.3, 500 + i * 80);
  for (let i = 0; i < 8; i++) { const t = 6.4 + i * BEAT * 2; timpani(t, 55 + (i % 4) * 4, 0.35 + Math.min(0.4, i * 0.05)); }
  [[0, 81], [1.5, 76], [3, 77], [4.5, 72], [6, 74], [7.5, 69], [8, 76], [9.5, 80]].forEach(([b, m]) => celesta(6.9 + b * BEAT * 1.0, m, 1.6, 0.26, 0.2));
  // 追信（9.75–10.7）：急促的撥奏
  for (let i = 0; i < 8; i++) { pluck(9.75 + i * BEAT / 2, [57, 60, 64, 60][i % 4] , 0.2, 0.5); marimba(9.75 + i * BEAT / 2, [69, 72, 76, 72][i % 4], 0.2, 0.3, -0.2); }
  // 撐傘趕路 12.8–14.6：節奏回穩
  for (let b = 0; b < 8; b++) { pluck(12.8 + b * BEAT, [45, 52, 53, 52][b % 4], 0.4, 0.5); if (b % 2) click(12.8 + b * BEAT, 5200, 0.03, 0.14, 0.3); }
  [[0, 72], [1, 74], [2, 76], [3, 79], [4, 77], [5, 76], [6, 74], [7, 72]].forEach(([b, m]) => marimba(12.8 + b * BEAT, m, 0.4, 0.34, 0.1));

  // 雨過天晴 14.6–19：C 大調 pad 與豎琴琶音
  const relief = [[48, 55, 64], [53, 60, 69], [55, 62, 71], [48, 55, 64]];
  for (let i = 0; i < 4; i++) pad(14.6 + i * 1.15, relief[i], 1.6, 0.26, 1500 + i * 400);
  const arp = [60, 64, 67, 72, 76, 72, 67, 64];
  for (let i = 0; i < 20; i++) { const base = [0, 5, 7, 0][Math.floor(i / 5) % 4]; celesta(15.3 + i * BEAT / 2, arp[i % 8] + base, 1.2, 0.2 + 0.08 * Math.sin(i), -0.4 + (i % 8) * 0.11); }
  for (let b = 0; b < 8; b++) pluck(16.0 + b * BEAT * 1.0, [48, 53, 55, 48, 48, 53, 55, 43][b], 0.5, 0.45);
  // 17.9 收信 → 19 打開：小停頓、期待
  celesta(18.55, 91, 1.2, 0.3); celesta(18.8, 96, 2, 0.36);

  // 終章主題 19.0 起（鈴 + 馬林巴 + 低音），19.4 愛心彈出
  seq(19.0, A.slice(0, 14), (t, m, d, v) => { celesta(t, m + 12, d * 1.2, v * 0.55, 0.1); marimba(t, m, d, v * 0.8, -0.1); });
  for (const [b, m] of [[0, 48], [2, 55], [4, 53], [6, 60], [8, 48], [10, 55]]) pluck(19.0 + b * BEAT, m - 12, 0.5, 0.55);
  pad(19.0, [60, 64, 67, 72], 3.2, 0.2, 1700);
  for (let b = 0; b < 12; b++) click(19.0 + b * BEAT + BEAT / 2, 6500, 0.03, 0.14, 0.3);

  // 結尾（22.0–25）：音樂盒搖籃曲，封面闔上落在 C 和弦
  [[0, 84], [0.7, 79], [1.4, 76], [2.1, 79], [2.8, 84], [3.5, 91]].forEach(([d, m]) => celesta(21.9 + d * 0.5, m, 1.6, 0.3, 0.1));
  pad(22.0, [48, 55, 60, 64], 2.6, 0.3, 1000);
  [72, 76, 79, 84].forEach((m, i) => celesta(24.35 + i * 0.05, m, 2.2, 0.33));
}

// 雨聲底：強度跟時間軸的 rainAmt 走
function rainBed() {
  const hp = svf(), lp = svf(), t0 = 6.6, dur = 9.2;
  mix(t0, gen(dur, (x, i) => {
    const t = t0 + x, a = T.rainAmt(t); if (a <= 0.001) return 0;
    const n = noise(), h = hp(n, 900, 0.6).hp, s = lp(h, 7500, 0.6).lp;
    return s * (0.16 * a) + (rnd() < 0.0009 * a ? noise() * 0.3 : 0);
  }), 1, 0);
}

// ---------- 組裝 ----------
music();
rainBed();
const events = T.buildEvents();
for (const e of events) sfx(e);

// 軟限幅 + 淡出，輸出 16-bit WAV
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.9 / Math.max(peak, 1e-6) * 1.0;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.15) * (1 - T.smooth((t - 24.3) / 0.7));
  const l = Math.tanh(L[i] * g * 1.1) * fade, r = Math.tanh(R[i] * g * 1.1) * fade;
  out.writeInt16LE(Math.round(l * 32000), 44 + i * 4); out.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
}
const dir = path.join(ROOT, 'assets/audio'); fs.mkdirSync(dir, { recursive: true });
const wav = path.join(dir, 'paper-letter.wav');
fs.writeFileSync(wav, out);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-t', String(T.DURATION), '-c:a', 'aac', '-b:a', '192k', path.join(dir, 'paper-letter.m4a')]);
fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify({ footfalls: T.findFootfalls(), events }, null, 1));
console.log('events:', events.length, 'footfalls:', T.findFootfalls().length, 'peak:', peak.toFixed(2));
