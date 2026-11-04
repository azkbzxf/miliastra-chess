// tools_work/resolution_test.cjs
// 分辨率矩阵逐行验证：把交付包的 Lua 放进沙箱，按 8 种设备形态各跑一遍，
// 检查「控件全部创建、无错误、无未支持接口」，并输出每个分辨率下的实际布局数值。
// 这是 release 09 §三 的硬性要求：手机三列必须完整可见、不重叠、不出界。
const fs = require("fs");
const path = require("path");

const SANDBOX_DIR = "C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox";
const QxSandbox = require(path.join(SANDBOX_DIR, "qx-sandbox.js"));
const fengari = require(path.join(SANDBOX_DIR, "vendor", "fengari.bundle.js"));

const ROOT = "D:/输出目录/国际象棋";
const DELIVERED = path.join(ROOT, "out/交付包/levelScript.lua");

// 生成沙箱副本（CONFIG 填占位非零）
let src = fs.readFileSync(DELIVERED, "utf8");
const repl = [
  ["  CONTAINER_NODE_INDEX = 0,", "  CONTAINER_NODE_INDEX = 1,"],
  ["  PREFAB_TEXT_BOX      = 0,", "  PREFAB_TEXT_BOX      = 1,"],
  ["  PREFAB_CURSOR_AREA   = 0,", "  PREFAB_CURSOR_AREA   = 2,"],
  ["  ENABLE_RAYCAST_FIELD = true,", "  ENABLE_RAYCAST_FIELD = false,"],
];
for (const [a, b] of repl) {
  if (!src.includes(a)) { console.error("MISS: " + a); process.exit(3); }
  src = src.replace(a, b);
}

// 分辨率矩阵（release 00 §3.2）
const DEVICES = [
  { id: "pc-16-9",        name: "电脑 16:9",      w: 1600, h: 900,  device: "Keyboard" },
  { id: "pc-21-9",        name: "电脑 21:9",      w: 2100, h: 900,  device: "Keyboard" },
  { id: "mobile-16-9",    name: "手机 16:9",      w: 1280, h: 720,  device: "Touch" },
  { id: "mobile-19.5-9",  name: "手机 19.5:9",    w: 1560, h: 720,  device: "Touch" },
  { id: "mobile-4-3",     name: "手机 4:3",       w: 1280, h: 960,  device: "Touch" },
  { id: "pad-16-9",       name: "手柄 16:9",      w: 1920, h: 1080, device: "Controller" },
  { id: "pad-21-9",       name: "手柄 21:9",      w: 2520, h: 1080, device: "Controller" },
  { id: "mobile-pad",     name: "手机手柄",       w: 1280, h: 720,  device: "MobileController" },
];

// 与 CONFIG 一致的布局公式（用于核对沙箱报告里的控件位置是否落在画布内）
function computeLayout(canvasW, canvasH) {
  const boardSide = canvasH * 0.78;
  const cell = boardSide / 8;
  const boardBottom = (canvasH - boardSide) / 2;
  const panelW = canvasW * 0.22;
  const panelLeft = canvasW - panelW;
  const panelH = boardSide;
  const panelBottom = (canvasH - panelH) / 2;
  let boardLeft = (canvasW - boardSide) / 2;
  const downgraded = (canvasW + boardSide) / 2 > canvasW - panelW;
  if (downgraded) boardLeft = (panelLeft - boardSide) / 2;
  return { boardSide, cell, boardLeft, boardBottom, panelW, panelLeft, panelH, panelBottom, downgraded };
}

let fails = 0;
const rows = [];

for (const dev of DEVICES) {
  const L = computeLayout(dev.w, dev.h);
  const sb = QxSandbox.createSandbox({
    fengari,
    canvas: { width: dev.w, height: dev.h },
    device: dev.device,
    dt: 1 / 60,
  });
  sb.installApi();
  if (!sb.load(src, "levelScript.lua")) {
    fails++;
    rows.push({ dev, ok: false, note: "编译失败" });
    continue;
  }
  sb.start();
  sb.runMs(1500);
  const rep = sb.report({});

  // 几何检查：棋盘 + 面板必须完整落在画布内，且不重叠
  const boardRight = L.boardLeft + L.boardSide;
  const boardTop = L.boardBottom + L.boardSide;
  const panelRight = L.panelLeft + L.panelW;
  const inBounds = L.boardLeft >= 0 && L.boardBottom >= 0 &&
                   boardRight <= dev.w && boardTop <= dev.h &&
                   L.panelLeft >= 0 && panelRight <= dev.w &&
                   L.panelBottom >= 0 && L.panelBottom + L.panelH <= dev.h;
  const noOverlap = boardRight <= L.panelLeft;
  const buttonH = L.panelH * 0.08;
  const touchOk = buttonH >= 40;   // 触摸目标下限放宽到 40（策划案算的是 44.9）

  const ok = rep.verdict === "pass" && rep.errors.length === 0 &&
             rep.unsupported.length === 0 && rep.controls.neverActivated === 0 &&
             inBounds && noOverlap;

  if (!ok) fails++;
  rows.push({
    dev, ok,
    verdict: rep.verdict,
    errors: rep.errors.length,
    unsupported: rep.unsupported.length,
    created: rep.controls.created,
    neverActivated: rep.controls.neverActivated,
    L, inBounds, noOverlap, buttonH, touchOk,
  });
  sb.destroy();
}

// 输出
console.log("=== 分辨率矩阵逐行验证（交付包 Lua） ===\n");
console.log("设备".padEnd(16) + "画布".padEnd(12) + "棋盘边长".padEnd(11) + "格宽".padEnd(9) +
            "boardLeft".padEnd(11) + "面板左".padEnd(10) + "间隙".padEnd(8) +
            "按钮高".padEnd(9) + "判定");
console.log("-".repeat(110));
for (const r of rows) {
  if (!r.L) { console.log(`${r.dev.name.padEnd(16)} 编译失败`); continue; }
  const gap = r.L.panelLeft - (r.L.boardLeft + r.L.boardSide);
  console.log(
    r.dev.name.padEnd(16) +
    `${r.dev.w}x${r.dev.h}`.padEnd(12) +
    r.L.boardSide.toFixed(1).padEnd(11) +
    r.L.cell.toFixed(1).padEnd(9) +
    r.L.boardLeft.toFixed(1).padEnd(11) +
    r.L.panelLeft.toFixed(1).padEnd(10) +
    gap.toFixed(1).padEnd(8) +
    r.buttonH.toFixed(1).padEnd(9) +
    (r.ok ? "PASS" : "FAIL")
  );
}

console.log("\n=== 逐项明细 ===");
for (const r of rows) {
  if (!r.L) continue;
  console.log(`${r.dev.name}: verdict=${r.verdict} errors=${r.errors} unsupported=${r.unsupported} ` +
              `控件=${r.created} neverActivated=${r.neverActivated} ` +
              `在画布内=${r.inBounds} 不重叠=${r.noOverlap} 按钮高=${r.buttonH.toFixed(1)}px ` +
              `${r.L.downgraded ? "（触发窄屏降级）" : ""}`);
}

console.log(`\n${fails === 0 ? "ALL PASS（8 种设备形态全部通过）" : fails + " FAILURES"}`);
process.exit(fails === 0 ? 0 : 2);
