// 核对 docs/v2-signal-protocol.md 与 lua/levelScript.lua 是否一致
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");

function findNum(name) {
  const re = new RegExp("\\b" + name + "\\s*=\\s*(\\d+(?:\\.\\d+)?)");
  const m = re.exec(s);
  return m ? Number(m[1]) : null;
}
function findStr(name) {
  const re = new RegExp("\\b" + name + '\\s*=\\s*"([^"]*)"');
  const m = re.exec(s);
  return m ? m[1] : null;
}

const evWant = {
  EV_MOVE: 0, EV_NEWGAME: 1, EV_RESIGN: 2, EV_DRAW_REQ: 3,
  EV_DRAW_ACC: 4, EV_JOIN: 5, EV_ROLE: 6, EV_DRAW_NO: 7,
  EV_READY: 8, EV_START: 9, EV_UNDO_REQ: 10, EV_UNDO_ACC: 11, EV_UNDO_NO: 12,
};

let bad = 0;
console.log("=== 事件号核对 ===");
for (const [k, v] of Object.entries(evWant)) {
  const got = findNum(k);
  const ok = got === v;
  if (!ok) bad++;
  console.log("  " + k.padEnd(14) + " 代码=" + String(got).padStart(2) + "  文档=" + String(v).padStart(2) + "  " + (ok ? "OK" : "MISMATCH"));
}

console.log("\n=== 文案核对（文档第五节 / 2.3 节引用）===");
const txt = {
  RESULT_OPP_LEFT: "对手已离开本局",
  SUB_OPP_LEFT: "本局结束，不计胜负",
  RESULT_RESIGN_WHITE: "白方认输，黑方胜",
  RESULT_RESIGN_BLACK: "黑方认输，白方胜",
  SUB_RESIGN_WHITE: "白方点了认输",
  SUB_RESIGN_BLACK: "黑方点了认输",
};
for (const [k, v] of Object.entries(txt)) {
  const got = findStr(k);
  const ok = got === v;
  if (!ok) bad++;
  console.log("  " + k.padEnd(20) + ' = "' + got + '"  ' + (ok ? "OK" : "MISMATCH(期望 " + v + ")"));
}

console.log("\n=== 常量核对 ===");
const nums = {
  UNDO_REQUEST_TIMEOUT_SEC: 15,
  // 【v2.0 方案 T】LOBBY_START_GRACE_SEC 已随「倒数结束立即本地开局」删除。
  // 校验它「不存在」—— 若有人误加回来，这条会立刻退化（got 变数字，NOT_FOUND 检查会拦）。
  LOBBY_PEER_TIMEOUT_SEC: 15,
  LOBBY_COUNTDOWN_SEC: 3,
  UNDO_PER_SIDE: 3,
  PAIRED_UNDO_PLIES: 2,
};
for (const [k, want] of Object.entries(nums)) {
  const got = findNum(k);
  const ok = want === null ? typeof got === "number" && got > 0 : got === want;
  if (!ok) bad++;
  console.log("  " + k.padEnd(26) + " = " + got + "  " + (ok ? "OK" : "MISMATCH"));
}

console.log("\n总判定: " + (bad === 0 ? "全部一致 OK" : bad + " 处不一致"));
process.exit(bad === 0 ? 0 : 1);
