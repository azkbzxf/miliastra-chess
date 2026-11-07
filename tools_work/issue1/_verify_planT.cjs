// 用 Lua 真实语义模拟 token 逻辑（不依赖游戏运行时）
// 目的：在跑门禁之前，先证明方案 T 的三条判据在逻辑上成立
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");

console.log("=== 方案 T 逻辑静态核查 ===\n");

// 1. make_self_token 的实现
const i = s.indexOf("make_self_token = function()");
const body = s.slice(i, s.indexOf("\nend", i) + 4);
console.log("【make_self_token】");
console.log(body.split("\n").map((l) => "  " + l).join("\n"));

// 2. EV_READY 接收端是否先判 token
console.log("\n【EV_READY 接收端的 token 判定顺序】");
const j = s.indexOf("eventType == CONFIG.EV_READY");
const blk = s.slice(j, j + 2600);
const lines = blk.split("\n");
let order = [];
for (const l of lines) {
  if (/local isEcho/.test(l)) order.push("1. 计算 isEcho（比对 token）");
  if (/if isEcho then/.test(l)) order.push("2. isEcho 为真则 return");
  if (/G\.peerReady = \(a == 1\)/.test(l)) order.push("3. 置 peerReady（只在非回声时）");
  if (/G\.peerSeen = true/.test(l)) order.push("4. 置 peerSeen");
}
order.forEach((o) => console.log("  " + o));
const echoFirst = order[0] && order[0].startsWith("1.");
const readyAfter = order.indexOf("3. 置 peerReady（只在非回声时）") > order.indexOf("2. isEcho 为真则 return");
console.log("  → 先判 token 再置 peerReady: " + (echoFirst && readyAfter ? "OK" : "顺序有问题"));

// 3. EV_START 也做 token 过滤
console.log("\n【EV_START 的 token 过滤】");
const k = s.indexOf("eventType == CONFIG.EV_START");
const bs = s.slice(k, k + 600);
const hasStartTok = bs.indexOf("__myStartToken") >= 0;
console.log("  " + (hasStartTok ? "OK 有 __myStartToken 比对" : "MISSING"));

// 4. 发送端是否真的带 token
console.log("\n【发送端带 token】");
const sendReady = /net_send_event\(CONFIG\.EV_READY[^)]*tok\)/.test(s);
const sendStart = /net_send_event\(CONFIG\.EV_START[^)]*tok\)/.test(s);
console.log("  EV_READY 带 tok: " + (sendReady ? "OK" : "MISSING"));
console.log("  EV_START 带 tok: " + (sendStart ? "OK" : "MISSING"));

// 5. 倒数结束是否立即开局（不再等 EV_START）
console.log("\n【倒数结束的处理】");
const cd = s.indexOf("if G.countdown <= 0 then");
const cdBlk = s.slice(cd, cd + 1200);
const startsImmediately = /start_game_from_lobby\(true\)/.test(cdBlk);
const waitsForStart = /G\.awaitStart = true/.test(cdBlk);
console.log("  立即 start_game_from_lobby(true): " + (startsImmediately ? "OK" : "MISSING"));
console.log("  仍设置 awaitStart=true（应该已删除）: " + (waitsForStart ? "STILL THERE" : "OK 已删除"));

// 6. awaitStart 分支是否已删
console.log("\n【awaitStart 等待分支】");
console.log("  " + (/elseif G\.awaitStart then/.test(s) ? "STILL THERE（应删）" : "OK 已删除"));
