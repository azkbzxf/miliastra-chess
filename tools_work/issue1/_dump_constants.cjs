// 核对关键常量真实值，确保文档数字与代码一致
const fs = require("fs");
const lines = fs.readFileSync("lua/levelScript.lua", "utf8").split("\n");

const keys = [
  "UNDO_PER_SIDE", "PAIRED_UNDO_PLIES", "V2_H_RATIO", "LOBBY_COUNTDOWN_SEC",
  "LOBBY_PEER_TIMEOUT_SEC", "UNDO_REQUEST_TIMEOUT_SEC", "LOBBY_TOUCH_MIN",
  "INITIAL_TIME_SEC", "INCREMENT_SEC", "REVIEW_BAR_H",
];
console.log("=== 顶层常量 ===");
for (const k of keys) {
  for (let i = 0; i < lines.length; i++) {
    const m = new RegExp("^\\s*" + k + "\\s*=\\s*([-0-9.]+)").exec(lines[i]);
    if (m) { console.log("  " + k.padEnd(24) + "= " + m[1] + "   (行 " + (i + 1) + ")"); break; }
  }
}

console.log("\n=== CONFIG.FONT 内常量 ===");
for (const k of ["START_TITLE", "START_SUB", "LOBBY_TITLE", "LOBBY_BODY", "LOBBY_SMALL", "LOBBY_COUNTDOWN", "UNDO_BTN", "BUTTON"]) {
  for (let i = 0; i < lines.length; i++) {
    const m = new RegExp("^\\s*" + k + "\\s*=\\s*([-0-9.]+)").exec(lines[i]);
    if (m) { console.log("  " + k.padEnd(24) + "= " + m[1] + "   (行 " + (i + 1) + ")"); break; }
  }
}

console.log("\n=== 四档时间控制 ===");
const i = lines.findIndex((l) => /TIME_CONTROLS\s*=\s*\{/.test(l));
for (let n = i; n < i + 14; n++) console.log("  " + (n + 1) + ": " + lines[n].trim());

console.log("\n=== 悔棋按钮文案 ===");
for (let n = 0; n < lines.length; n++) {
  if (/UNDO_BTN\s*=/.test(lines[n])) { console.log("  " + (n + 1) + ": " + lines[n].trim()); break; }
}

console.log("\n=== 断言总数 ===");
const cnt = (fs.readFileSync("lua/levelScript.lua", "utf8").match(/^\s*add\("/gm) || []).length;
console.log("  add( 调用: " + cnt);

console.log("\n=== 控件数（从已有记录）===");
console.log("  1489（Lead 实测日志确认）");
