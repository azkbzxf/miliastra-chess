// 诊断三条自检失败项
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = s.split("\n");

function show(fn, pat, ctx) {
  const i = lines.findIndex((l) => l.includes(pat));
  if (i < 0) { console.log("  (未找到 " + pat + ")"); return; }
  const from = Math.max(0, i - (ctx || 0));
  const to = Math.min(lines.length, i + (ctx || 0) + 1);
  for (let n = from; n < to; n++) console.log("  " + (n + 1) + ": " + lines[n]);
}

console.log("=== 1. mkBtn 的字段名（btnSolo / hitSolo 是否存在）===");
show("", "local function mkBtn", 26);

console.log("\n=== 2. mkBtn 调用点 ===");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('mkBtn("')) console.log("  " + (i + 1) + ": " + lines[i].trim());
}

console.log("\n=== 3. 断言里查的字段 ===");
for (let i = 0; i < lines.length; i++) {
  if (/lb\.btnSolo|lb\.hitSolo/.test(lines[i])) console.log("  " + (i + 1) + ": " + lines[i].trim());
}
