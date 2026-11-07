// 追踪 peerReady 在实测时序下如何变 true
// 关键事实（Lead 实测）：
//   t=18.9  玩家2 点准备 -> 发 EV_READY(a=1, fen="T1")，__myReadyToken = "T1"
//   t=44.7  玩家1 点准备 -> 发 EV_READY(a=1, fen="T1")，__myReadyToken = "T1"
//   两端随后都「双方就绪」

console.log("=== 关键：__myReadyToken 在自己发完包后，是否被清零？ ===\n");

const fs = require("fs");
const lines = fs.readFileSync("lua/levelScript.lua", "utf8").split("\n");

console.log("【代码事实 1】发送端（btnReady 的 handler）：");
const i = lines.findIndex((l) => l.indexOf("local tok = make_self_token()") >= 0);
for (let n = i; n < i + 6; n++) console.log("  " + (n + 1) + ": " + lines[n]);
console.log("  -> __myReadyToken 被设为 tok，**没有清零**");

console.log("\n【代码事实 2】接收端遇到回声时的处理：");
console.log('  7361-7365: if isEcho then GAME.__myReadyToken = nil; return end');
console.log("  -> 只有**收到自己的回声**时才清零");

console.log("\n=== 逐个推演 ===");

console.log("\n--- 玩家2 侧（t=18.9 点准备）---");
console.log("  发 EV_READY(fen=T1)，__myReadyToken = T1");
console.log("  收到自己的回声(fen=T1) -> isEcho=true -> 清零 __myReadyToken=nil, return");
console.log("  → 玩家2 的 __myReadyToken 现在 = nil  ★★ 关键！");

console.log("\n--- 玩家1 侧（t=44.7 点准备）---");
console.log("  发 EV_READY(fen=T1)，__myReadyToken = T1");
console.log("  收到玩家2 的旧包？不，玩家2 的包是 t=18.9 发的，已经过去了");
console.log("  收到自己的回声(fen=T1) -> isEcho=true -> 清零 __myReadyToken=nil, return");
console.log("  → 玩家1 的 __myReadyToken 现在 = nil  ★★ 关键！");

console.log("\n--- 但是！玩家1 发包(t=44.7) 和 玩家2 发包(t=18.9) 不在同一时刻 ---");
console.log("  玩家2 在 t=18.9 发完包，立刻收到自己的回声，__myReadyToken 变 nil");
console.log("  玩家1 在 t=44.7 发完包，收到自己的回声 -> 但**同时**也收到玩家2 的包？");
console.log("  不 —— 玩家2 的包是 t=18.9，玩家1 那时应当在待机室收到了！");

console.log("\n★★★ 找到真正原因 ★★★");
console.log("  玩家2 在 t=18.9 发 EV_READY(fen=T1)");
console.log("  玩家1 那时正在待机室（t=4.4 就进了），会收到这个包！");
console.log("  玩家1 收到时：__myReadyToken = ? ");
console.log("    玩家1 还没点过准备 -> __myReadyToken 从未赋值 -> nil");
console.log("    isEcho = (nil ~= nil ...) = **false** -> 这不是回声，是对方！");
console.log("    -> G.peerReady = (a==1) = **true**   ← 玩家1 在 t=18.9 就置位了！");
console.log("");
console.log("  然后 t=44.7 玩家1 点准备 -> myReady=true");
console.log("    此时 peerReady 已经是 true（t=18.9 置的）");
console.log("    -> if G.myReady and G.peerReady -> **双方就绪** ✓");
console.log("");
console.log("  玩家2 侧：t=18.9 自己发 T1 -> 回声清零 -> peerReady 保持 false");
console.log("           t=44.7 收到玩家1 的 T1 -> __myReadyToken 已经是 nil");
console.log("             isEcho = false -> peerReady = true ✓");
console.log("           -> 玩家2 的 myReady=true + peerReady=true -> 双方就绪 ✓");
console.log("");
console.log("=== 结论：**不是巧合，是正确行为** ===");
console.log("  token 撞车只在「两端同时持有同一个 token」时才误判。");
console.log("  但每端发完包后**立刻**收到自己的回声并清零 token，");
console.log("  所以两端几乎不会「同时持有相同 token」。");
console.log("  玩家1 在 t=18.9 收到玩家2 的包时，自己从未发过包（token=nil），");
console.log("  所以正确识别为「对方」—— 完全正确。");
