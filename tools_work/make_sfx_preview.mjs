// tools_work/make_sfx_preview.mjs
// 把 CONFIG.SFX 里用到的音效资产从平台资产 CDN 拉下来，做成本地试听页的素材。
//
// 【为什么单独一个脚本】这些音频是游戏资产（版权归米哈游），**绝不入库**：
//   .gitignore 里已排除 docs/audio-preview/ 与 docs/音效试听.html。
//   仓库里只保留 lua 侧的「音效 ID」数字 —— ID 是事实信息，音频文件不是。
//
// 用法：node tools_work/make_sfx_preview.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/输出目录/国际象棋";
const OUT = path.join(ROOT, "docs/audio-preview");
const TMP = path.join(ROOT, "tools_work/tmp/sfx");

// 与 lua/levelScript.lua 的 CONFIG.SFX 保持一致
const IDS = [50888, 50894, 50942, 50879, 40186, 50937, 50940, 50919, 50931, 50934];

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

let ok = 0, fail = 0;
for (const id of IDS) {
  const dst = path.join(OUT, `${id}.mp3`);
  if (fs.existsSync(dst) && fs.statSync(dst).size > 1000) { ok++; continue; }
  // 先看本地 tmp 有没有（之前下载过就不重复拉）
  const cached = path.join(TMP, `${id}.mp3`);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 1000) {
    fs.copyFileSync(cached, dst);
    ok++;
    continue;
  }
  try {
    const r = await fetch(`https://oss.070077.xyz/audio/${id}.mp3`);
    if (!r.ok) { console.log(`MISS ${id} HTTP ${r.status}`); fail++; continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) { console.log(`MISS ${id} 文件过小`); fail++; continue; }
    fs.writeFileSync(cached, buf);
    fs.writeFileSync(dst, buf);
    ok++;
    console.log(`OK   ${id}  ${buf.length} 字节`);
  } catch (e) {
    console.log(`FAIL ${id}  ${e.message}`);
    fail++;
  }
}
console.log(`\n完成：${ok} 个就绪 / ${fail} 个失败 → ${OUT}`);
console.log("提醒：docs/audio-preview/ 已在 .gitignore 中，不要提交。");
