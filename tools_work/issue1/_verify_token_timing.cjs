// 验证 token 清零时序 —— 这才是「为什么能用」的真正原因
const fs = require("fs");
const lines = fs.readFileSync("lua/levelScript.lua", "utf8").split("\n");

console.log("=== 关键代码事实 ===\n");
const i = lines.findIndex((l) => l.indexOf("register_click(UI.lobby.btnReady.hit") >= 0);
console.log("【发送端】行 " + (i + 1) + "~" + (i + 21));
for (let n = i + 15; n < i + 19; n++) console.log("  " + (n + 1) + ": " + lines[n]);
console.log("  -> __myReadyToken = tok  **置位后不清零**（等回声来才清）");

const j = lines.findIndex((l) => l.indexOf("local isEcho") >= 0);
console.log("\n【接收端】行 " + (j + 1) + "~" + (j + 8));
for (let n = j; n < j + 8; n++) console.log("  " + (n + 1) + ": " + lines[n]);
console.log("  -> 收到自己的回声才清零 __myReadyToken");

console.log("\n\n=== 实测时序逐帧推演（Lead 日志）===\n");

const events = [
  { t: 4.4, who: "P1", what: "进待机室", p1: { myReady: false, peerReady: false, tok: null } },
  { t: 14.2, who: "P2", what: "进待机室", p2: { myReady: false, peerReady: false, tok: null } },
];

console.log("初始：P1{tok=nil, peerReady=false}  P2{tok=nil, peerReady=false}\n");

console.log("t=18.9  P2 点准备");
console.log("  P2 本地: myReady=true, tok=\"T1\"");
console.log("  P2 广播 EV_READY(a=1, fen=\"T1\")");
console.log("");
console.log("  ── 包到达 P2 自己（回声）──");
console.log("    isEcho: tok(P2)=\"T1\" ~= nil ✓, fen=\"T1\" ~= nil ✓, \"T1\"==\"T1\" ✓ → **true**");
console.log("    → 清 tok=nil, return。peerReady 保持 **false** ✓");
console.log("    P2 现状: {myReady=true, peerReady=false, tok=nil}");
console.log("");
console.log("  ── 同一包到达 P1 ──");
console.log("    isEcho: tok(P1)=**nil** → `tok ~= nil` 为 false → **isEcho=false**");
console.log("    → 继续执行 → peerReady = (a==1) = **true** ✓");
console.log("    P1 现状: {myReady=false, peerReady=true, tok=nil}");
console.log("    ★ 这是正确的：P1 从未发过包(tok=nil)，所以不可能把自己的包当成回声");
console.log("");
console.log("t=44.7  P1 点准备");
console.log("  P1 本地: myReady=true, tok=\"T1\"（make_self_token 序号从 1 重来）");
console.log("  P1 广播 EV_READY(a=1, fen=\"T1\")");
console.log("");
console.log("  ── 包到达 P1 自己（回声）──");
console.log("    isEcho: tok(P1)=\"T1\", fen=\"T1\" → **true**");
console.log("    → 清 tok=nil, return。peerReady 保持 **true**（t=18.9 就置了）");
console.log("    P1 现状: {myReady=true, peerReady=true, tok=nil} → **双方就绪** ✓");
console.log("");
console.log("  ── 同一包到达 P2 ──");
console.log("    isEcho: tok(P2)=**nil**（t=18.9 回声时清掉了）→ **false**");
console.log("    → peerReady = true");
console.log("    P2 现状: {myReady=true, peerReady=true, tok=nil} → **双方就绪** ✓");
console.log("");
console.log("t=47.7 两端各自倒数结束 → 各自 start_game_from_lobby(true/false) → 进 playing");

console.log("\n\n=== 结论 ===");
console.log("  ★ 不是巧合。真正起作用的机制是：**每端发完包、收到自己的回声后立刻清零 token。**");
console.log("  ★ 所以「同时持有相同 token」的窗口极短（一次网络往返内）。");
console.log("  ★ P1 在 t=18.9 收到 P2 的包时 tok=nil，必然判为「对方」—— 这是正确的。");
console.log("");
console.log("=== 但有一个真实风险（必须报告）===");
console.log("  如果两点几乎**同时**点准备（同一个 tick / 极小间隔）：");
console.log("    P1: tok=T1, 发 fen=T1");
console.log("    P2: tok=T1, 发 fen=T1      ← 两端 token 相同且都还没被清");
console.log("    → 双方收到对方的包时 isEcho 都为 true → 互相忽略");
console.log("    → peerReady 都保持 false → 不开局");
console.log("    → 退化为「各自等到 15 秒超时」→ 安全降级，**不会误开局** ✓");
console.log("  这就是方案 T 设计的「失败模式安全」。");
