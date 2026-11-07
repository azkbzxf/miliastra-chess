// 全面审计：断言里是否有「假设某个特定屏」的判据
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = s.split("\n");

// SelfTest 范围
const start = lines.findIndex((l) => l.indexOf("function SelfTest()") >= 0);
let end = start;
let depth = 0, begun = false;
for (let i = start; i < lines.length; i++) {
  if (/\bfunction\b/.test(lines[i])) begun = true;
  for (const ch of lines[i]) {
    if (ch === "(" || ch === "{") depth++;
    else if (ch === ")" || ch === "}") depth--;
  }
  if (begun && i > start && /^end\s*$/.test(lines[i])) { end = i; break; }
}
console.log("SelfTest 范围: 行 " + (start + 1) + " ~ " + (end + 1));

console.log("\n=== 检查：是否直接比较 GAME.screen == 某值作为「期望状态」 ===");
let hits = 0;
for (let i = start; i <= end; i++) {
  const l = lines[i];
  // 找形如 `local xxx = (GAME.screen == "yyy")` 这种「期望等于」的判据
  if (/=\s*\(?\s*GAME\.screen\s*==/.test(l) && !/bak/.test(l)) {
    console.log("  行 " + (i + 1) + ": " + l.trim());
    hits++;
  }
}
if (hits === 0) console.log("  （无）");

console.log("\n=== 检查：是否直接比较 GAME.screen ~= 某值（这是安全的写法）===");
for (let i = start; i <= end; i++) {
  const l = lines[i];
  if (/=\s*\(?\s*GAME\.screen\s*~=/.test(l)) {
    console.log("  行 " + (i + 1) + ": " + l.trim());
  }
}

console.log("\n=== 检查：断言里是否还残留 net_send_event 直发真事件 ===");
for (let i = start; i <= end; i++) {
  if (/net_send_event\(CONFIG\.EV_/.test(lines[i])) {
    console.log("  行 " + (i + 1) + ": " + lines[i].trim());
  }
}
console.log("  （有也不一定错：现在被 inSelfTest 闸拦住，但仍应确认有对应校验）");
