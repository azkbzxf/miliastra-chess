// tools_work/fix_copy_refs.cjs
// 修掉文案表重写后遗留的旧键引用（Lua 与 Demo 各一遍）
// 映射规则：旧键 → 新键（按策划案 9.3–9.6 的语义对应）
const fs = require("fs");

const ROOT = "D:/输出目录/国际象棋";

const MAP = [
  // 结算标题
  ["CONFIG.TEXT.RESULT_DRAW", "CONFIG.TEXT.RESULT_DRAW_AGREED"],
  ["TEXT.RESULT_DRAW", "TEXT.RESULT_DRAW_AGREED"],
  // 结算说明
  ["CONFIG.TEXT.SUB_CHECKMATE_BLACK", "CONFIG.TEXT.SUB_CHECKMATE"],
  ["CONFIG.TEXT.SUB_CHECKMATE_WHITE", "CONFIG.TEXT.SUB_CHECKMATE"],
  ["TEXT.SUB_CHECKMATE_BLACK", "TEXT.SUB_CHECKMATE"],
  ["TEXT.SUB_CHECKMATE_WHITE", "TEXT.SUB_CHECKMATE"],
  ["CONFIG.TEXT.SUB_RESIGN_BLACK", "CONFIG.TEXT.SUB_RESIGN_BLACK"],
  ["TEXT.SUB_RESIGN_BLACK", "TEXT.SUB_RESIGN_BLACK"],
  // 面板标题
  ["CONFIG.TEXT.TITLE", "CONFIG.TEXT.PANEL_TITLE"],
  ["TEXT.TITLE", "TEXT.PANEL_TITLE"],
  // 求和弹窗正文
  ["CONFIG.TEXT.DRAW_REQUEST", "CONFIG.TEXT.CONFIRM_DRAW"],
  ["TEXT.DRAW_REQUEST", "TEXT.CONFIRM_DRAW"],
  // 身份提示：策划案 9.2 用「你是白方/你是黑方」语义 → 用 TURN_WHITE/TURN_BLACK 不合适，
  // 改为直接写死（这两句在策划案 9.2 之外，属于联机态提示，保留字面量）
  ["CONFIG.TEXT.ROLE_WHITE", "\"你是白方\""],
  ["CONFIG.TEXT.ROLE_BLACK", "\"你是黑方\""],
  ["TEXT.ROLE_WHITE", "\"你是白方\""],
  ["TEXT.ROLE_BLACK", "\"你是黑方\""],
  // 提示条
  ["CONFIG.TEXT.DRAW_COOLDOWN", "CONFIG.TEXT.BTN_DRAW_USED"],
  ["TEXT.DRAW_COOLDOWN", "TEXT.BTN_DRAW_USED"],
  ["CONFIG.TEXT.LOCAL_SWITCHED", "\"已切换到同屏轮流\""],
  ["TEXT.LOCAL_SWITCHED", "\"已切换到同屏轮流\""],
  ["CONFIG.TEXT.DRAW_REJECTED", "\"对方拒绝和棋，继续对局\""],
  ["TEXT.DRAW_REJECTED", "\"对方拒绝和棋，继续对局\""],
];

function fix(file) {
  let s = fs.readFileSync(file, "utf8");
  let count = 0;
  for (const [from, to] of MAP) {
    if (from === to) continue;
    const before = s;
    s = s.split(from).join(to);
    if (s !== before) count++;
  }
  fs.writeFileSync(file, s, "utf8");
  console.log(`${file}: 替换 ${count} 个键`);
}

fix(`${ROOT}/lua/levelScript.lua`);
fix(`${ROOT}/tools_work/demo_template.html`);

// 检查还有没有残留
console.log("\n=== 残留检查 ===");
for (const file of [`${ROOT}/lua/levelScript.lua`, `${ROOT}/tools_work/demo_template.html`]) {
  const s = fs.readFileSync(file, "utf8");
  const leftovers = ["TITLE,", "ROLE_WHITE", "ROLE_BLACK", "DRAW_REQUEST", "DRAW_REJECTED",
    "DRAW_COOLDOWN", "LOCAL_SWITCHED", "WAIT_JOIN", "NET_LOST", "SUB_RESULT"];
  for (const k of leftovers) {
    // 只查作为 TEXT 键被引用的形式
    const pat = new RegExp("TEXT\\." + k.replace(",", ""));
    if (pat.test(s)) console.log(`  残留 ${k} in ${file}`);
  }
}
console.log("（无输出即无残留）");
