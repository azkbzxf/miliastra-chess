// tools_work/align_copy.cjs
// 按 docs/策划案.md 9.3–9.6 的逐字稿，统一 lua/levelScript.lua 与 Demo 的文案表。
// 原则：策划案是文案唯一依据；Lua 与 Demo 必须逐字一致。
const fs = require("fs");

const ROOT = "D:/输出目录/国际象棋";

// 策划案 9.3–9.6 逐字稿（人工从文档摘录，见下方每条注释的行号）
const SPEC = {
  // 9.3 提示条
  HINT_OPENING: "点一枚自己的棋子，再点亮起来的格子",
  HINT_SELECTED: "已选中 · 点亮的格子都能走",
  // 9.2 面板轮次区
  TURN_WHITE: "轮到白方走子",
  TURN_BLACK: "轮到黑方走子",
  WAIT_OPPONENT: "等待对方走子…",
  CHECK: "将军！请先解围",
  // 9.4 结算标题
  RESULT_WHITE_WIN: "白方将死黑方，白方胜",
  RESULT_BLACK_WIN: "黑方将死白方，黑方胜",
  RESULT_STALEMATE: "无子可动，本局和棋",
  RESULT_FIFTY: "五十步无进展，本局和棋",
  RESULT_THREEFOLD: "局面重复三次，本局和棋",
  RESULT_INSUFFICIENT: "子力不足，本局和棋",
  RESULT_TIMEOUT_WHITE: "白方超时，黑方胜",
  RESULT_TIMEOUT_BLACK: "黑方超时，白方胜",
  RESULT_RESIGN_WHITE: "白方认输，黑方胜",
  RESULT_RESIGN_BLACK: "黑方认输，白方胜",
  RESULT_DRAW_AGREED: "对方同意和棋，本局和棋",
  // 9.4 结算说明行
  SUB_CHECKMATE: "本局用时 {t}",
  SUB_STALEMATE: "双方都走不动了",
  SUB_FIFTY: "五十步没有吃子",
  SUB_THREEFOLD: "同一局面出现了三次",
  SUB_INSUFFICIENT: "剩下的子赢不了",
  SUB_TIMEOUT_WHITE: "白方时间用完了",
  SUB_TIMEOUT_BLACK: "黑方时间用完了",
  SUB_RESIGN_WHITE: "白方点了认输",
  SUB_RESIGN_BLACK: "黑方点了认输",
  SUB_DRAW_AGREED: "双方握手言和",
  // 9.4 按钮
  BTN_AGAIN: "再来一局",
  // 9.5 确认弹窗
  CONFIRM_RESIGN: "认输就直接判负，确定吗",
  CONFIRM_RESIGN_YES: "确定认输",
  CONFIRM_RESIGN_NO: "继续下棋",
  CONFIRM_NEWGAME: "重开会清空这一局",
  CONFIRM_YES: "确定",
  CONFIRM_NO: "取消",
  CONFIRM_SWITCH: "切换会断开这一局，确定吗",
  CONFIRM_DRAW: "对方想和棋，同意吗",
  CONFIRM_DRAW_YES: "同意和棋",
  CONFIRM_DRAW_NO: "拒绝求和",
  // 9.6 面板
  PANEL_TITLE: "黑白棋局",
  CAP_WHITE_PREFIX: "白方失子 ",
  CAP_BLACK_PREFIX: "黑方失子 ",
  CAP_NONE: "无",
  MOVELOG_TITLE: "最近六步",
  MOVELOG_EMPTY: "还没有走子",
  BTN_NEWGAME: "新开一局",
  BTN_RESIGN: "认输",
  BTN_DRAW: "求和",
  BTN_LOCAL: "切换本地同屏",
  BTN_ONLINE: "切换联机对战",
  BTN_DRAW_USED: "求和已用完",
  // 9.6 升变
  PROMO_PROMPT: "兵到底了，选一个子",
  PROMO_QUEEN: "后", PROMO_ROOK: "车", PROMO_BISHOP: "象", PROMO_KNIGHT: "马",
};

// ---------- 1) 改 Lua ----------
let lua = fs.readFileSync(`${ROOT}/lua/levelScript.lua`, "utf8");
const luaStart = lua.indexOf("  TEXT = {");
const luaEnd = lua.indexOf("\n  },", luaStart) + 4;
if (luaStart < 0 || luaEnd < 4) { console.error("LUA_TEXT_NOT_FOUND"); process.exit(3); }

const luaLines = ["  -- 全部玩家可见文案：逐字照 docs/策划案.md 9.2–9.6，改这里必须同步改 Demo",
                  "  TEXT = {"];
const groups = [
  ["提示与轮次", ["HINT_OPENING","HINT_SELECTED","TURN_WHITE","TURN_BLACK","WAIT_OPPONENT","CHECK"]],
  ["结算标题", ["RESULT_WHITE_WIN","RESULT_BLACK_WIN","RESULT_STALEMATE","RESULT_FIFTY",
               "RESULT_THREEFOLD","RESULT_INSUFFICIENT","RESULT_TIMEOUT_WHITE","RESULT_TIMEOUT_BLACK",
               "RESULT_RESIGN_WHITE","RESULT_RESIGN_BLACK","RESULT_DRAW_AGREED"]],
  ["结算说明行", ["SUB_CHECKMATE","SUB_STALEMATE","SUB_FIFTY","SUB_THREEFOLD","SUB_INSUFFICIENT",
                 "SUB_TIMEOUT_WHITE","SUB_TIMEOUT_BLACK","SUB_RESIGN_WHITE","SUB_RESIGN_BLACK","SUB_DRAW_AGREED"]],
  ["按钮", ["BTN_AGAIN","BTN_NEWGAME","BTN_RESIGN","BTN_DRAW","BTN_LOCAL","BTN_ONLINE","BTN_DRAW_USED"]],
  ["确认弹窗", ["CONFIRM_RESIGN","CONFIRM_RESIGN_YES","CONFIRM_RESIGN_NO","CONFIRM_NEWGAME",
               "CONFIRM_YES","CONFIRM_NO","CONFIRM_SWITCH","CONFIRM_DRAW","CONFIRM_DRAW_YES","CONFIRM_DRAW_NO"]],
  ["面板", ["PANEL_TITLE","CAP_WHITE_PREFIX","CAP_BLACK_PREFIX","CAP_NONE","MOVELOG_TITLE","MOVELOG_EMPTY"]],
  ["升变", ["PROMO_PROMPT","PROMO_QUEEN","PROMO_ROOK","PROMO_BISHOP","PROMO_KNIGHT"]],
];
for (const [title, keys] of groups) {
  luaLines.push("    -- " + title);
  for (const k of keys) luaLines.push(`    ${k} = "${SPEC[k]}",`);
}
luaLines.push("  },");
lua = lua.slice(0, luaStart) + luaLines.join("\n") + lua.slice(luaEnd);
fs.writeFileSync(`${ROOT}/lua/levelScript.lua`, lua, "utf8");
console.log("Lua TEXT 表已按策划案重写，共", Object.keys(SPEC).length, "项");

// ---------- 2) 改 Demo ----------
let tpl = fs.readFileSync(`${ROOT}/tools_work/demo_template.html`, "utf8");
const dStart = tpl.indexOf("  const TEXT = {");
const dEnd = tpl.indexOf("\n  };", dStart) + 5;
if (dStart < 0 || dEnd < 5) { console.error("DEMO_TEXT_NOT_FOUND"); process.exit(3); }

const dLines = ["  // 全部玩家可见文案：逐字照 docs/策划案.md 9.2–9.6，改这里必须同步改 Lua",
                "  const TEXT = {"];
for (const [title, keys] of groups) {
  dLines.push("    // " + title);
  for (const k of keys) dLines.push(`    ${k}: "${SPEC[k]}",`);
}
dLines.push("  };");
tpl = tpl.slice(0, dStart) + dLines.join("\n") + tpl.slice(dEnd);
fs.writeFileSync(`${ROOT}/tools_work/demo_template.html`, tpl, "utf8");
console.log("Demo TEXT 表已按策划案重写");

// ---------- 3) 打印差异提示（旧的键被删了，代码里可能还在引用） ----------
const removed = ["TITLE","SUBTITLE","ROLE_WHITE","ROLE_BLACK","DRAW_REQUEST","DRAW_REJECTED",
  "DRAW_COOLDOWN","LOCAL_SWITCHED","WAIT_JOIN","NET_LOST","SUB_RESULT","RESULT_DRAW"];
console.log("\n被移除的旧键（需检查引用）：", removed.join(", "));
