// 静态核验三条修复
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = s.split("\n");

console.log("=== 1. lobby_solo 字段路径 ===");
console.log("  mkBtn 内 `btn.hit = part(create_cursor_area` : " +
  (s.indexOf("btn.hit = part(create_cursor_area") >= 0 ? "OK" : "MISSING"));
console.log("  `lb[key] = btn`                             : " +
  (s.indexOf("lb[key] = btn") >= 0 ? "OK" : "MISSING"));
console.log("  断言改用 lb.btnSolo.hit                     : " +
  (s.indexOf("lb.btnSolo.hit") >= 0 ? "OK" : "MISSING"));
console.log("  旧的 lb.hitSolo 已不存在                    : " +
  (s.indexOf("lb.hitSolo") < 0 ? "OK" : "STILL THERE"));

console.log("\n=== 2. undo_ready 检查时机 ===");
const u = lines.findIndex((l) => l.indexOf('"undo_ready"') >= 0);
let foundPlaying = false, foundRestore = false;
for (let n = u - 40; n < u; n++) {
  if (n < 0) continue;
  if (lines[n].indexOf('GAME.screen = "playing"') >= 0) foundPlaying = true;
  if (lines[n].indexOf("GAME.screen = bakScreen") >= 0) foundRestore = true;
}
console.log("  先切 screen=playing : " + (foundPlaying ? "OK" : "MISSING"));
console.log("  跑完还原 bakScreen  : " + (foundRestore ? "OK" : "MISSING"));

console.log("\n=== 3. branch 三段计量 ===");
for (const k of ["wEnsure", "wMove", "wBack", "SEG_MAX", "TOTAL_MAX", "__lastPaintBreakdown"]) {
  console.log("  " + k.padEnd(24) + ": " + (s.indexOf(k) >= 0 ? "OK" : "MISSING"));
}

console.log("\n=== 4. 自检日志前缀 ===");
const marks = [];
for (let i = 0; i < lines.length; i++) if (lines[i].indexOf("[自检]") >= 0) marks.push(i + 1);
console.log("  [自检] 出现行: " + marks.join(", "));
console.log("  数量: " + marks.length + "（应 >= 4：崩溃/结构异常/通过/失败汇总）");
