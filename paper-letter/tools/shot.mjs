// 開發用：不經 HyperFrames，直接用 Chromium (SwiftShader) 在指定秒數截圖，快速看畫面。
// 用法：node tools/shot.mjs OUT_DIR t1 t2 ...
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html`);
const t0 = Date.now();
await page.waitForFunction(() => window.__paperLetter && (window.__paperLetter.stage || window.__paperLetterError), null, { timeout: 180000 });
const err = await page.evaluate(() => window.__paperLetterError);
if (err) { console.log(err); process.exit(1); }
console.log('built in', Date.now() - t0, 'ms');
for (const t of times) {
  const s = Date.now();
  await page.evaluate((t) => window.__paperLetter.stage.render(Number(t)), t);
  await page.locator('#stage').screenshot({ path: path.join(outDir, `t${String(t).padStart(5, '0')}.png`) });
  console.log('t=', t, 'ok', Date.now() - s, 'ms');
}
await browser.close(); server.close();
