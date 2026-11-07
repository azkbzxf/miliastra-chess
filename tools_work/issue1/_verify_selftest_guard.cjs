// 核验自检零副作用闸
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = s.split("\n");

console.log("=== 1. net_send_event 有 inSelfTest 闸 ===");
let i = lines.findIndex((l) => l.indexOf("function net_send_event(") >= 0);
let found = false;
for (let n = i; n < i + 20; n++) {
  if (lines[n].indexOf("GAME.inSelfTest") >= 0) { found = true; console.log("  " + (n + 1) + ": " + lines[n].trim()); }
}
console.log("  闸存在: " + (found ? "OK" : "MISSING"));

console.log("\n=== 2. start_game_from_lobby 有 inSelfTest 闸 ===");
i = lines.findIndex((l) => l.indexOf("function start_game_from_lobby(") >= 0);
found = false;
for (let n = i; n < i + 20; n++) {
  if (lines[n].indexOf("GAME.inSelfTest") >= 0) { found = true; console.log("  " + (n + 1) + ": " + lines[n].trim()); }
}
console.log("  闸存在: " + (found ? "OK" : "MISSING"));

console.log("\n=== 3. inSelfTest 的置位/复位 ===");
for (let n = 0; n < lines.length; n++) {
  if (/GAME\.inSelfTest\s*=/.test(lines[n])) console.log("  " + (n + 1) + ": " + lines[n].trim());
}

console.log("\n=== 4. 闸的默认值 ===");
for (let n = 0; n < lines.length; n++) {
  if (lines[n].indexOf("inSelfTest = false,") >= 0) console.log("  " + (n + 1) + ": " + lines[n].trim());
}
