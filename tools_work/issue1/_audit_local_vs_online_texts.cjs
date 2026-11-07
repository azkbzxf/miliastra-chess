// 生成「同屏 vs 联机」文案对照表 —— 哪些分支了、哪些漏了
const fs = require("fs");
const src = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = src.split("\n");

// 提取 CONFIG.TEXT 全量
const txtStart = lines.findIndex((l) => /^\s*TEXT\s*=\s*\{/.test(l));
let depth = 0, started = false, txtEnd = txtStart;
for (let i = txtStart; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") depth--;
  }
  if (started && depth === 0) { txtEnd = i; break; }
}
const texts = [];
let pendingKey = null;
for (let i = txtStart; i <= txtEnd; i++) {
  const stripped = lines[i].replace(/\s*--.*$/, "");
  const m1 = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)",?\s*$/.exec(stripped);
  if (m1) { texts.push([m1[1], m1[2]]); pendingKey = null; continue; }
  const m2 = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*$/.exec(stripped);
  if (m2) { pendingKey = m2[1]; continue; }
  const m3 = /^\s*"((?:[^"\\]|\\.)*)",?\s*$/.exec(stripped);
  if (m3 && pendingKey) { texts.push([pendingKey, m3[1]]); pendingKey = null; }
}
const textMap = {};
for (const [k, v] of texts) textMap[k] = v;

// 关键词：暗示「对方 / 对手 / 你」的文案
const PEER_HINTS = ["对方", "对手"];

console.log("=== 一、含「对方/对手」字样的文案（同屏模式下可能不恰当）===\n");
const suspect = [];
for (const [k, v] of texts) {
  if (PEER_HINTS.some((h) => v.includes(h))) suspect.push([k, v]);
}
for (const [k, v] of suspect) {
  console.log("  " + k.padEnd(28) + ' = "' + v + '"');
}
console.log("\n  共 " + suspect.length + " 条");

// 二、检查这些文案的使用点是否按 localMode 分支
console.log("\n=== 二、使用点是否有 localMode 分支 ===\n");
for (const [k] of suspect) {
  const sites = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("--")) continue;
    if (new RegExp("CONFIG\\.TEXT\\.(WITH_)?" + k + "\\b").test(lines[i])) sites.push(i + 1);
  }
  if (sites.length === 0) {
    console.log("  " + k.padEnd(28) + " (仅定义)");
    continue;
  }
  // 检查使用点前 12 行内有没有 localMode 分支
  const guarded = sites.some((ln) => {
    for (let i = Math.max(0, ln - 14); i < ln; i++) {
      if (/localMode/.test(lines[i])) return true;
    }
    return false;
  });
  console.log("  " + k.padEnd(28) + " 用于行 " + sites.join(",") +
    "   → " + (guarded ? "✅ 附近有 localMode 分支" : "❌ **无分支**"));
}

// 三、所有 localMode 三元分支的文案对照
console.log("\n=== 三、代码里已有的 localMode 文案分支 ===\n");
for (let i = 0; i < lines.length; i++) {
  if (/localMode/.test(lines[i]) && /TEXT\./.test(lines[i])) {
    console.log("  行 " + (i + 1) + ": " + lines[i].trim());
  }
}

// 四、按功能分类的文案清单
console.log("\n=== 四、按功能分组的文案（供 Lead 核对）===\n");
const groups = {
  "求和相关": ["DRAW_REQ", "DRAW_ACC", "DRAW_NO", "RESULT_DRAW", "SUB_DRAW", "DRAW_", "HINT_DRAW"],
  "认输相关": ["RESIGN", "RESULT_RESIGN", "SUB_RESIGN", "HINT_RESIGN"],
  "悔棋相关": ["UNDO_"],
  "待机室相关": ["LOBBY_", "READY_"],
  "对手离开": ["OPP_LEFT", "RESULT_OPP", "SUB_OPP"],
};
const done = new Set();
for (const [gname, prefixes] of Object.entries(groups)) {
  const hits = texts.filter(([k]) => prefixes.some((p) => k.startsWith(p) || k.includes(p)));
  if (hits.length === 0) continue;
  console.log("【" + gname + "】");
  for (const [k, v] of hits) {
    if (done.has(k)) continue;
    done.add(k);
    console.log("  " + k.padEnd(30) + ' = "' + v + '"');
  }
  console.log("");
}
