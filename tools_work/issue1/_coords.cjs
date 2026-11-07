// 千星坐标速查：把 CONFIG 里的布局表算成「千星坐标（原点左下、Y 向上）」，
// 直接输出可点控件的中心点，供 qxqy_studio_play 的 pointer 使用。
//
// 【为什么需要它】模拟器 pointer 用的是千星坐标（左下原点、Y 向上），
// 但从截图量出来的是「从上往下」的屏幕坐标。两者 y 互为 H−y，
// 一旦搞混就会点在按钮上方/下方 100+px 的空白处，现象是「点了完全没反应」，
// 极容易被误判成「命中区坏了 / 层级被压住 / 事件没绑上」。
// v2.0 块 1→2 期间就因此误判过一次（点了 (963,522)，而正确值是 (962,379)）。
//
// 这个脚本直接读 lua/levelScript.lua 的真实布局表与算式，**不会过期**。
//
// 用法：
//   node tools_work/issue1/_coords.cjs            # 全部
//   node tools_work/issue1/_coords.cjs confirm    # 只看确认框
//   node tools_work/issue1/_coords.cjs lobby      # 只看待机室
//   node tools_work/issue1/_coords.cjs start      # 只看初始界面
//   node tools_work/issue1/_coords.cjs board      # 只看棋盘格（e2/e4 等）
const fs = require("fs");

const CANVAS_W = parseFloat(process.env.CW || "1600");
const CANVAS_H = parseFloat(process.env.CH || "900");
const src = fs.readFileSync("lua/levelScript.lua", "utf8");
const which = (process.argv[2] || "all").toLowerCase();

// 解析一个 Lua 布局表：NAME = { y = 0.055, h = 0.045 },
function parseLayout(tableName) {
  const start = src.indexOf(tableName + " = {");
  if (start < 0) return null;
  const out = {};
  // 按花括号配平切出整张表
  const open = src.indexOf("{", start);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = src.slice(open, end + 1);
  for (const m of block.matchAll(/(\w+)\s*=\s*\{\s*y\s*=\s*([\d.]+)\s*,\s*h\s*=\s*([\d.]+)\s*\}/g)) {
    out[m[1]] = { y: parseFloat(m[2]), h: parseFloat(m[3]) };
  }
  // 标量项（如 TC_CARDS_X = 0.10）
  for (const m of block.matchAll(/(\w+)\s*=\s*([\d.]+)\s*,/g)) {
    if (!(m[1] in out)) out[m[1]] = parseFloat(m[2]);
  }
  return out;
}

function num(key, fallback) {
  const m = new RegExp("\\b" + key + "\\s*=\\s*([\\d.]+)").exec(src);
  return m ? parseFloat(m[1]) : fallback;
}

function show(label, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2;
  console.log(
    "  " + label.padEnd(26) +
    "center=(" + cx.toFixed(1) + ", " + cy.toFixed(1) + ")" +
    "   x[" + x.toFixed(1) + "," + (x + w).toFixed(1) + "]" +
    " y[" + y.toFixed(1) + "," + (y + h).toFixed(1) + "]"
  );
}

console.log("画布 " + CANVAS_W + "x" + CANVAS_H + "   （千星坐标：原点左下、Y 向上）");
console.log("如需其它分辨率：CW=1280 CH=720 node tools_work/issue1/_coords.cjs");
console.log("");

// ---------- 棋盘 ----------
if (which === "all" || which === "board") {
  const boardRatio = num("BOARD_SIDE_RATIO", 0.78);
  const panelRatio = num("PANEL_WIDTH_RATIO", 0.22);
  const boardSide = CANVAS_H * boardRatio;
  const cell = boardSide / 8;
  const boardBottom = (CANVAS_H - boardSide) / 2;
  const panelW = CANVAS_W * panelRatio;
  let boardLeft = (CANVAS_W - boardSide) / 2;
  if ((CANVAS_W + boardSide) / 2 > CANVAS_W - panelW) boardLeft = (CANVAS_W - panelW - boardSide) / 2;
  console.log("=== 棋盘（格宽 " + cell.toFixed(2) + "，棋盘左下 (" + boardLeft.toFixed(1) + "," + boardBottom.toFixed(1) + ")）===");
  const sqPos = (sq) => [boardLeft + (sq % 8) * cell + cell / 2, boardBottom + Math.floor(sq / 8) * cell + cell / 2];
  const named = [["e2", 12], ["e4", 28], ["d2", 11], ["d4", 27], ["g1", 6], ["f3", 21], ["a1", 0], ["h8", 63]];
  for (const [nm, sq] of named) {
    const [x, y] = sqPos(sq);
    console.log("  " + nm + " (sq" + sq + ")".padEnd(8) + " center=(" + x.toFixed(1) + ", " + y.toFixed(1) + ")");
  }
  console.log("");
}

// ---------- 初始界面 ----------
if (which === "all" || which === "start") {
  const SL = parseLayout("START_LAYOUT");
  if (SL) {
    console.log("=== 初始界面 START_LAYOUT ===");
    const W = CANVAS_W, H = CANVAS_H;
    const band = (n, xR = 0, wR = 1) => [W * xR, H * SL[n].y, W * wR, H * SL[n].h];
    // 3 个入口
    let r = band("ENTRY_R1", 0.16, 0.68);
    show("入口·双人同屏", r[0], r[1], r[2], r[3]);
    r = band("ENTRY_R2", 0.16, 0.33);
    show("入口·复盘研习", r[0], r[1], r[2], r[3]);
    r = band("ENTRY_R2", 0.51, 0.33);
    show("入口·联机待机室", r[0], r[1], r[2], r[3]);
    // 4 张档位卡
    const x = W * SL.TC_CARDS_X, w = W * SL.TC_CARDS_W;
    const n = 4, gap = w * 0.018, cardW = (w - gap * (n - 1)) / n;
    const y = H * SL.TC_CARDS.y, h = H * SL.TC_CARDS.h;
    for (let i = 1; i <= n; i++) {
      show("档位卡" + i, x + (i - 1) * (cardW + gap), y, cardW, h);
    }
    console.log("");
  }
}

// ---------- 待机室 ----------
if (which === "all" || which === "lobby") {
  const LL = parseLayout("LOBBY_LAYOUT");
  if (LL) {
    console.log("=== 待机室 LOBBY_LAYOUT ===");
    const W = CANVAS_W, H = CANVAS_H;
    const band = (n, xR, wR) => [W * xR, H * LL[n].y, W * (wR - xR), H * LL[n].h];
    // 与 build_lobby 完全一致的 xR/wR（改那边必须同步这里）
    let r = band("READY_BTN", 0.30, 0.70);
    show("准备 / 取消准备", r[0], r[1], r[2], r[3]);
    r = band("SOLO_BTN", 0.30, 0.70);
    show("直接开始", r[0], r[1], r[2], r[3]);
    r = band("FOOTER", 0.66, 0.96);
    show("返回主菜单", r[0], r[1], r[2], r[3]);
    console.log("  --- 以下为纯展示（不可点）---");
    r = band("TITLE", 0.04, 0.66);
    show("标题 联机·待机室", r[0], r[1], r[2], r[3]);
    r = band("TITLE", 0.66, 0.96);
    show("身份标注", r[0], r[1], r[2], r[3]);
    r = band("PLAYER1", 0.14, 0.86);
    show("你 行", r[0], r[1], r[2], r[3]);
    r = band("PLAYER2", 0.14, 0.86);
    show("对手 行", r[0], r[1], r[2], r[3]);
    r = band("ROOM_TC", 0.04, 0.96);
    show("时间档行", r[0], r[1], r[2], r[3]);
    r = band("HINT", 0.04, 0.96);
    show("提示条", r[0], r[1], r[2], r[3]);
    r = band("COUNTDOWN", 0.04, 0.96);
    show("倒数数字", r[0], r[1], r[2], r[3]);
    r = band("FOOTER", 0.04, 0.66);
    show("底部提示", r[0], r[1], r[2], r[3]);
    console.log("");
  } else {
    console.log("=== 待机室 LOBBY_LAYOUT 尚未定义 ===");
    console.log("");
  }
}

// ---------- 确认框 ----------
if (which === "all" || which === "confirm") {
  console.log("=== 确认框（含「返回主菜单」确认框）===");
  const W = CANVAS_W, H = CANVAS_H;
  const w = W * 0.46, h = H * 0.28;
  const x = (W - w) * 0.5, y = (H - h) * 0.5;
  const by = y + h * 0.10, bh = h * 0.24, bw = w * 0.44;
  show("确定 / 同意（左）", x + w * 0.06, by, bw, bh);
  show("取消 / 拒绝（右）", x + w * 0.50, by, bw, bh);
  console.log("");
}

// ---------- 结算面板 ----------
if (which === "all" || which === "result") {
  console.log("=== 结算面板 ===");
  const W = CANVAS_W, H = CANVAS_H;
  const w = W * 0.40, h = H * 0.40;
  const x = (W - w) * 0.5, y = (H - h) * 0.5;
  show("再来一局", x + w * 0.08, y + h * 0.12, w * 0.40, h * 0.14);
  show("复盘", x + w * 0.52, y + h * 0.12, w * 0.40, h * 0.14);
  console.log("");
}

// ---------- 复盘动作条（v2.0 块 4，棋盘正下方单行两键）----------
if (which === "all" || which === "reviewbar") {
  const W = CANVAS_W, H = CANVAS_H;
  const boardSide = H * num("BOARD_SIDE_RATIO", 0.78);
  const boardBottom = (H - boardSide) / 2;
  const panelW = W * num("PANEL_WIDTH_RATIO", 0.22);
  // 与 build_review_actionbar 同式：boardLeft 优先居中，右侧被面板挤压时左移
  let boardLeft = (W - boardSide) / 2;
  if ((W + boardSide) / 2 > W - panelW) boardLeft = (W - panelW - boardSide) / 2;
  // 键高 = max(CONFIG.REVIEW_BAR_H, fit_h(FONT.BUTTON))
  const fBtn = num("BUTTON", 28);           // CONFIG.FONT.BUTTON
  const fitH = (f) => Math.ceil(f * num("V2_H_RATIO", 2.1)) + 1;
  const barH = Math.max(num("REVIEW_BAR_H", 44), fitH(fBtn));
  const barY = (boardBottom - barH) / 2;
  const gap = boardSide * 0.02;
  const btnW = (boardSide - gap) / 2;
  console.log("=== 复盘动作条（棋盘正下方，仅复盘中显示）===");
  console.log("  棋盘底边 y=" + boardBottom.toFixed(1) + "  键高=" + barH + "  顶边=" + (barY + barH).toFixed(1));
  show("退回主变", boardLeft, barY, btnW, barH);
  show("从此开新局", boardLeft + btnW + gap, barY, btnW, barH);
  console.log("  （校验：顶边 " + (barY + barH).toFixed(1) + " <= 棋盘底-8 = " + (boardBottom - 8).toFixed(1) + " → " +
              ((barY + barH) <= boardBottom - 8 ? "OK" : "FAIL") + "）");
  console.log("");
}

// ---------- 面板 ----------
if (which === "all" || which === "panel") {
  const PL = parseLayout("PANEL_LAYOUT");
  if (PL) {
    console.log("=== 侧面板（右侧，宽 " + (CANVAS_W * num("PANEL_WIDTH_RATIO", 0.22)).toFixed(1) + "）===");
    const W = CANVAS_W, H = CANVAS_H;
    const panelW = W * num("PANEL_WIDTH_RATIO", 0.22);
    const panelLeft = W - panelW;
    const boardSide = H * num("BOARD_SIDE_RATIO", 0.78);
    const panelBottom = (H - boardSide) / 2;
    const atX = (r) => panelLeft + panelW * r;
    const pw = (r) => panelW * r;
    const atY = (n) => panelBottom + boardSide * PL[n].y;
    const hh = (n) => boardSide * PL[n].h;
    show("新开一局", atX(0.04), atY("BTN_ROW1"), pw(0.44), hh("BTN_ROW1"));
    show("认输", atX(0.52), atY("BTN_ROW1"), pw(0.44), hh("BTN_ROW1"));
    show("求和", atX(0.04), atY("BTN_ROW2"), pw(0.44), hh("BTN_ROW2"));
    show("切换本地同屏", atX(0.52), atY("BTN_ROW2"), pw(0.44), hh("BTN_ROW2"));
    // v2.0 块 3：第三行左半 0.42（悔棋 / 退出复盘 互斥共用），右半 0.46（返回主菜单）
    show("悔棋 / 退出复盘（左半）", atX(0.04), atY("REVIEW_TOGGLE"), pw(0.42), hh("REVIEW_TOGGLE"));
    show("返回主菜单（右半）", atX(0.52), atY("REVIEW_TOGGLE"), pw(0.46), hh("REVIEW_TOGGLE"));
    show("音效开关（面板下方）", atX(0.04), panelBottom - hh("REVIEW_TOGGLE") - boardSide * 0.018,
         pw(0.92), Math.max(44, hh("REVIEW_TOGGLE")));
    console.log("");
  }
}

console.log("提示：y 若从截图量得（上往下），千星 y = " + CANVAS_H + " − 截图y");
