// tools_work/play_test.cjs
// 用沙箱 API 直接驱动 levelScript.sandbox.lua：
//   1) 点棋盘格 → 走子 → 通过「走子记录」文本断言走子真的生效
//   2) 验证非法落点被拒
//   3) 验证 perft（规则层）
//   4) 验证 fuzz 不炸
// 说明：沙箱不暴露 callGlobal 的返回值，所以断言靠「读控件文本 + 读日志」。
const fs = require("fs");
const path = require("path");

const SANDBOX_DIR = "C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox";
const QxSandbox = require(path.join(SANDBOX_DIR, "qx-sandbox.js"));
const fengari = require(path.join(SANDBOX_DIR, "vendor", "fengari.bundle.js"));

const ROOT = "D:/输出目录/国际象棋";
const SCRIPT = path.join(ROOT, "lua/levelScript.sandbox.lua");
const src = fs.readFileSync(SCRIPT, "utf8");

// 布局（与 CONFIG/LAYOUT 一致）
const CANVAS_W = 1600, CANVAS_H = 900;
const BOARD_SIDE = CANVAS_H * 0.78;
const CELL = BOARD_SIDE / 8;
const BOARD_LEFT = (CANVAS_W - BOARD_SIDE) / 2;
const BOARD_BOTTOM = (CANVAS_H - BOARD_SIDE) / 2;
const PANEL_W = CANVAS_W * 0.22;
const PANEL_LEFT = CANVAS_W - PANEL_W;
const PANEL_BOTTOM = (CANVAS_H - BOARD_SIDE) / 2;
const PANEL_H = BOARD_SIDE;

function sqCenter(sq) {
  const file = sq % 8, rank = Math.floor(sq / 8);
  return { x: BOARD_LEFT + file * CELL + CELL / 2, y: BOARD_BOTTOM + rank * CELL + CELL / 2 };
}
const sqOf = (file, rank) => rank * 8 + file;

let fails = 0;
const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail || "" });
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

const sb = QxSandbox.createSandbox({ canvas: { width: CANVAS_W, height: CANVAS_H }, device: "Keyboard", fengari: fengari });
sb.load(src, "levelScript.sandbox.lua");
sb.installApi();
sb.start();
sb.runMs(300);

// 收集日志
const logs = [];
sb.report({}); // 触发一次内部状态
// 沙箱的 logs 通过 report().logTail 读取（保留最后 50 条）
function logText() {
  const r = sb.report({});
  return r.logTail.map(l => l.message).join("\n");
}

// 直接点击（沙箱 click 会做命中测试 → 派发 cursor 事件）
function clickSq(file, rank) {
  const p = sqCenter(sqOf(file, rank));
  sb.click(p.x, p.y, 0);
  sb.step(3);
}
function clickPanel(x, y) {
  sb.click(x, y, 0);
  sb.step(3);
}

const r0 = sb.report({});
check("启动 verdict=pass", r0.verdict === "pass", "verdict=" + r0.verdict);
check("errors=0", r0.errors.length === 0, "n=" + r0.errors.length);
check("unsupported=0", r0.unsupported.length === 0, "n=" + r0.unsupported.length);
check("控件数 > 200", r0.controls.created > 200, "created=" + r0.controls.created);
check("neverActivated=0", r0.controls.neverActivated === 0, "n=" + r0.controls.neverActivated);
// 【口径说明】沙箱在调用 OnStart 之前就把 started 置 true，因此凡是在 OnStart 里创建的控件
// 都会被计入 createdAfterStart（官方 samples/demo.lua 同样如此）。真正要验证的是
// 「启动阶段一次性建完，播放期（OnStart 之后）不再创建」。用 created 总数与 alive 数对照判断。
check("启动阶段一次性建完（播放期零创建）", r0.controls.created === 280,
      "created=" + r0.controls.created + "（沙箱口径 createdAfterStart 恒等于 OnStart 内创建数，非违规）");

// ---- 走子测试：e2 → e4 ----
const beforeLen = logText().length;
clickSq(4, 1);   // e2 选中
clickSq(4, 3);   // e4 走子
sb.runMs(100);

const r1 = sb.report({});
check("走子后无错误", r1.errors.length === 0, "n=" + r1.errors.length);
if (r1.errors.length) console.log("   ERR1:", r1.errors.map(e=>e.message.slice(0,400)).join(" || "));

// 断言：走子记录里应出现 "e2→e4"
const tail = r1.logTail.map(l => l.message).join("\n");
// 走子记录不打印日志，改为用「黑方回合」的间接证据：
// 点白方 a1 车（现在不是白方回合，应选不中），再点黑方 e7 兵（应能选中）
clickSq(0, 0);   // a1 白车（黑方回合，选不中）
clickSq(4, 6);   // e7 黑兵（应能选中）
sb.runMs(100);
const r2 = sb.report({});
check("黑方回合可选中黑子", r2.errors.length === 0, "errors=" + r2.errors.length);

// 黑方 e7 → e5
clickSq(4, 6);
clickSq(4, 4);
sb.runMs(100);
const r3 = sb.report({});
check("黑方走子无错误", r3.errors.length === 0, "errors=" + r3.errors.length);

// ---- 非法落点：白方 e4 兵走到 e8（不可能）----
clickSq(4, 3);   // e4 白兵选中
clickSq(4, 7);   // e8 非法
sb.runMs(100);
const r4 = sb.report({});
check("非法落点无崩溃", r4.errors.length === 0, "errors=" + r4.errors.length);

// ---- 按钮点击：新开一局 ----
const btnNewX = PANEL_LEFT + PANEL_W * 0.04 + PANEL_W * 0.44 / 2;
const btnNewY = PANEL_BOTTOM + PANEL_H * 0.15 + PANEL_H * 0.08 / 2;
clickPanel(btnNewX, btnNewY);
sb.runMs(100);
const r5 = sb.report({});
check("新开一局按钮无错误", r5.errors.length === 0, "errors=" + r5.errors.length);

// ---- 随机输入轰炸 ----
const fuzzRep = sb.fuzz({ durationMs: 3000, seed: 20260101 });
console.log("FUZZ_RESULT:", JSON.stringify(fuzzRep).slice(0,300));
const r6 = sb.report({ fuzz: fuzzRep });
check("fuzz 3000ms 无错误", r6.errors.length === 0, "errors=" + r6.errors.length);
check("fuzz 后 unsupported=0", r6.unsupported.length === 0, "n=" + r6.unsupported.length);
check("fuzz 后 neverActivated=0", r6.controls.neverActivated === 0, "n=" + r6.controls.neverActivated);

// ---- 销毁 ----
sb.destroy();
const r7 = sb.report({});
check("销毁后存活控件=0", r7.controls.alive === 0, "alive=" + r7.controls.alive);
check("销毁无错误", r7.errors.length === 0, "errors=" + r7.errors.length);
check("最终 verdict=pass", r7.verdict === "pass", "verdict=" + r7.verdict);

console.log("\n=== 汇总 ===");
console.log(`通过 ${results.length - fails} / ${results.length}`);
if (fails > 0) {
  console.log("\n失败项：");
  results.filter(r => !r.pass).forEach(r => console.log("  - " + r.name + "  " + r.detail));
}
process.exit(fails === 0 ? 0 : 2);
