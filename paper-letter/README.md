# 紙信 — 25 秒紙片立體書短片

一本攤開的紙片立體書：小郵差帶著一封信，遇到風雨、閃電，追回被吹走的信，最後在彩虹下交給兔兔。

## 管線
| 步驟 | 檔案 |
| --- | --- |
| 手寫 SVG（角色姿勢、道具）＋設定圖 | `tools/build-svg.mjs` → `assets/svg/`、`art/model-sheet.svg` |
| SVG → 白紙邊 → 輪廓 → 擠出厚紙片 | `src/papercraft.js` |
| 故事時間軸（畫面與音效共用，含腳步落地偵測） | `src/timeline.js` |
| 立體書、摺疊關節、雨（InstancedMesh）、閃電、彩虹 | `src/scene.js` |
| 景深／暈影／顆粒 GLSL | `src/dof.js` |
| 合成配樂與音效（純 JS，無外部 API） | `tools/synth-audio.mjs` → `assets/audio/` |
| HyperFrames 合成頁（`hf-seek` 逐格驅動） | `index.html` |

## 重新產生
```bash
npm install
node tools/build-svg.mjs        # SVG 與 src/svg-bundle.js
node tools/synth-audio.mjs      # 音訊（腳步時間來自 timeline 的落地偵測）
node tools/shot.mjs out 4 9.4   # 開發用：指定秒數截圖
npx hyperframes render -o renders/paper-letter.mp4 -f 24 -q standard -w 3 --no-browser-gpu
```
軟體 WebGL（SwiftShader）下 600 格約 17 分鐘。於無頭環境請用獨立行程群組啟動，避免父行程結束時渲染被取消：
`bash -c 'set -m; HYPERFRAMES_RENDER_DETACHED=1 npx hyperframes render ... < /dev/null > render.log 2>&1 &'`

## 說明
- 輸出 24fps：角色卡片與特效以 12fps 停格，24 能整除 12，節奏均勻。
- 設定圖由 Claude Code 自己寫（此環境沒有 Codex CLI）。
