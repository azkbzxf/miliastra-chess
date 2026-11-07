// 审计：net_on_signal 里还有没有「读了但没定义」的变量
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = s.split("\n");

const start = lines.findIndex((l) => l.indexOf("local function net_on_signal") >= 0);
let end = start;
for (let i = start + 1; i < lines.length; i++) {
  if (/^end\s*$/.test(lines[i])) { end = i; break; }
}
console.log("net_on_signal: 行 " + (start + 1) + " ~ " + (end + 1));

// 该函数内定义过的 local
const defined = new Set(["signalName", "params", "eventType", "a", "b", "c", "fen"]);
for (let i = start; i <= end; i++) {
  const m = /^\s*local\s+([A-Za-z_]\w*)/.exec(lines[i]);
  if (m) defined.add(m[1]);
  const m2 = /^\s*local\s+([A-Za-z_]\w*)\s*,/.exec(lines[i]);
  if (m2) defined.add(m2[1]);
}
console.log("\n函数内定义的局部变量: " + [...defined].join(", "));

// 可疑：小写裸标识符被读取，但既不是 local 也不是已知全局
const known = new Set([
  "GAME", "CONFIG", "UI", "NET", "RULES", "LAYOUT", "ANIM", "SFX", "INPUT",
  "log_info", "log_err", "log_once", "pcall", "type", "tostring", "tonumber",
  "string", "table", "math", "ipairs", "pairs", "select", "print", "printerr",
  "os", "next", "error", "assert", "setmetatable", "rawget", "rawset",
  "unpack", "require", "game", "script", "Enum", "Color", "utf8",
  "net_send_event", "apply_move", "new_game", "show_result", "show_confirm",
  "hide_confirm", "apply_time_control", "refresh_lobby", "refresh_undo_button",
  "undo_apply_pair", "undo_consume", "start_game_from_lobby", "emit_fault",
  "sq", "mv", "list", "candidates", "promoPieces", "wantPromo", "last",
  "drawReqSent", "self", "n", "G", "i", "k", "v", "p", "t", "x", "y",
]);

console.log("\n=== 可疑：读取了但未在函数内定义、也不在已知全局列表里的标识符 ===");
const suspects = new Set();
for (let i = start; i <= end; i++) {
  let line = lines[i];
  // 去掉注释与字符串
  line = line.replace(/--.*$/, "");
  if (/^\s*local\s/.test(line)) continue;
  for (const m of line.matchAll(/\b([a-z_][a-z0-9_]{1,20})\b/g)) {
    const id = m[1];
    if (known.has(id) || defined.has(id)) continue;
    // 跳过方法调用后的属性名、字段名
    const idx = m.index;
    const before = line.slice(Math.max(0, idx - 2), idx);
    if (before === "." || before === ":") continue;
    const after = line.slice(idx + id.length, idx + id.length + 2);
    if (after.trimStart().startsWith("=") && !after.includes("==")) {
      // 这是赋值，作为局部候选，跳过
      continue;
    }
    suspects.add(id);
  }
}
if (suspects.size === 0) console.log("  （无）");
else [...suspects].sort().forEach((x) => console.log("  " + x));
