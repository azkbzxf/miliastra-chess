// tools_work/patch_drop_shape.cjs
// 用户改主意：不做第三档「圆盘+剪影」，只保留 ①纯棋符 ②圆盘+棋符。
// 本脚本从 lua/levelScript.lua 里摘掉剪影相关的全部代码（按行扫描，CRLF 安全）。
// 幂等性：跑第二遍会因找不到标记而报「已摘除」，不重复破坏。
const fs = require("fs");
const path = require("path");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let raw = fs.readFileSync(P, "utf8");
let lines = raw.split("\r\n");
const before = lines.length;

function findLine(sub, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].includes(sub)) return i;
  }
  return -1;
}

// 用「起止标记行」整块替换（含两端）
function replaceBlock(startSub, endSub, newLines) {
  const a = findLine(startSub);
  if (a < 0) { console.log("SKIP 未找到起点: " + startSub); return false; }
  const b = findLine(endSub, a);
  if (b < 0) { console.log("SKIP 未找到终点: " + endSub); return false; }
  lines.splice(a, b - a + 1, ...newLines);
  return true;
}

function removeLine(sub) {
  const a = findLine(sub);
  if (a < 0) { console.log("SKIP 未找到: " + sub); return false; }
  lines.splice(a, 1);
  return true;
}

// ---------- A) CONFIG：三档 → 两档 ----------
replaceBlock("-- ===== 棋子样式（三档，游戏内可切换）=====", "  PIECE_SHAPE_LAYERS = 6,", [
  "  -- ===== 棋子样式（两档，游戏内可切换）=====",
  "  -- 【为什么不用「上传自己的棋子图」】",
  "  -- 千星奇域的图片控件只支持 StaticReference（官方固定白名单）与 Prefab（元件图标），",
  "  -- 没有任何上传自定义图片的入口（已全量核查 1517 个白名单素材，无国际象棋棋子）。",
  "  -- 所以棋子改为「用基础图元拼」：白/黑圆盘 + 棋符，或纯棋符。",
  "  -- 两档只用下面这个官方预设图元，无需任何素材配置，开箱即用。",
  "  PIECE_ASSET = {",
  "    CIRCLE  = 100002,   -- 实心圆图（可染色、可拉伸）",
  "  },",
  "  PIECE_IMAGE_SOURCE = \"StaticReference\",   -- 图片来源枚举名（见 API 文档 L516-527）",
  "  -- 两档样式：\"glyph\" 纯棋符（1 控件/枚）｜\"disc\" 圆盘+棋符（3 控件/枚）",
  "  DEFAULT_PIECE_STYLE = \"disc\",",
  "  -- 样式循环顺序（按钮每点一次切到下一档）",
  "  PIECE_STYLE_CYCLE = { \"disc\", \"glyph\" },",
  "  -- 棋盘上同时最多 32 枚棋子（开局 32 枚，升变不增加总数），故棋子槽位池按 32 建",
  "  PIECE_MAX_SLOTS = 32,",
]);

// ---------- B) TEXT：删剪影按钮文案 ----------
removeLine("    BTN_STYLE_SHAPE = \"棋子：剪影\",");

// ---------- C) 删形状表 + shape_asset，保留 RULES 导出两行 ----------
replaceBlock("-- 剪影形状表（第三档「圆盘+剪影」用）", "RULES.PIECE_SHAPES = PIECE_SHAPES", [
  "RULES.PIECE_LETTER = PIECE_LETTER",
  "RULES.PIECE_GLYPH = PIECE_GLYPH",
]);

// ---------- D) 槽位池：去掉剪影层 ----------
replaceBlock("-- 建棋子槽位池（一次性建好", "local function build_board()", [
  "-- 建棋子槽位池（一次性建好，播放期只移动/改色/切显隐，零创建零销毁）。",
  "-- 每个槽位 = 圆盘外圈 + 圆盘内圈 + 棋符文本框。",
  "-- 两档样式共用这一套控件：切样式只改显隐，不新建也不销毁（release 21 硬约束）。",
  "local function create_piece_slots()",
  "  local L = UI.L",
  "  local box = L.cell",
  "  local D = box * 0.88",
  "  local ring = box * 0.048",
  "  local innerD = D - ring * 2",
  "  local glyphFont = math.floor(innerD * 0.80)",
  "  local hasImage = (CONFIG.PREFAB_IMAGE ~= 0)",
  "",
  "  for i = 1, CONFIG.PIECE_MAX_SLOTS do",
  "    local slot = { sq = nil }",
  "    if hasImage then",
  "      slot.discOuter = create_image({",
  "        name = \"p\" .. i .. \"_outer\", parent = UI.host,",
  "        x = 0, y = 0, w = D, h = D, asset = CONFIG.PIECE_ASSET.CIRCLE,",
  "      })",
  "      slot.discInner = create_image({",
  "        name = \"p\" .. i .. \"_inner\", parent = UI.host,",
  "        x = 0, y = 0, w = innerD, h = innerD, asset = CONFIG.PIECE_ASSET.CIRCLE,",
  "      })",
  "    end",
  "    slot.glyph = create_text({",
  "      name = \"p\" .. i .. \"_glyph\", parent = UI.host,",
  "      x = 0, y = 0, w = innerD, h = innerD,",
  "      text = \"\", fontSize = glyphFont,",
  "      hAlign = Enum.TextHorizontalAlignment.Middle,",
  "      vAlign = Enum.TextVerticalAlignment.Middle,",
  "      raycast = false,",
  "    })",
  "    UI.pieceSlots[i] = slot",
  "  end",
  "end",
  "local function build_board()",
]);

// ---------- E) paint_slot：去掉剪影分支 ----------
replaceBlock("-- 把一个槽位摆到某格并画成指定棋子", "-- 把一个槽位的所有层隐藏", [
  "-- 把一个槽位摆到某格并画成指定棋子",
  "local function paint_slot(slot, p, bx, by, style)",
  "  local L = UI.L",
  "  local box = L.cell",
  "  local D = box * 0.88",
  "  local ring = box * 0.048",
  "  local innerD = D - ring * 2",
  "  local isWhite = p > 0",
  "  local fill = isWhite and CONFIG.COLOR.WHITE_PIECE or CONFIG.COLOR.BLACK_PIECE",
  "  local outline = isWhite and CONFIG.COLOR.WHITE_OUTLINE or CONFIG.COLOR.BLACK_OUTLINE",
  "",
  "  if slot.discOuter then",
  "    slot.discOuter:SetAnchoredPosition(bx + (box - D) / 2, by + (box - D) / 2)",
  "  end",
  "  if slot.discInner then",
  "    slot.discInner:SetAnchoredPosition(bx + (box - innerD) / 2, by + (box - innerD) / 2)",
  "  end",
  "  if slot.glyph then",
  "    slot.glyph:SetAnchoredPosition(bx + (box - innerD) / 2, by + (box - innerD) / 2)",
  "    slot.glyph.text = PIECE_GLYPH[p] or PIECE_LETTER[p]",
  "  end",
  "",
  "  if style == \"glyph\" then",
  "    -- 纯棋符：只有文本框，白方白字深描边、黑方深字浅描边",
  "    if slot.discOuter then ui_set_active(slot.discOuter, false) end",
  "    if slot.discInner then ui_set_active(slot.discInner, false) end",
  "    if slot.glyph then",
  "      slot.glyph.fontColor = color_of(fill)",
  "      slot.glyph.enableOutline = true",
  "      slot.glyph.outlineColor = color_of(outline)",
  "      ui_set_active(slot.glyph, true)",
  "    end",
  "    return",
  "  end",
  "",
  "  -- 圆盘+棋符：外圈=描边色、内圈=棋子色，棋符画在圆盘上（字色=描边色，不加描边避免糊成一团）",
  "  image_apply(slot.discOuter, CONFIG.PIECE_ASSET.CIRCLE, outline, nil)",
  "  image_apply(slot.discInner, CONFIG.PIECE_ASSET.CIRCLE, fill, nil)",
  "  ui_set_active(slot.discOuter, true)",
  "  ui_set_active(slot.discInner, true)",
  "  if slot.glyph then",
  "    slot.glyph.fontColor = color_of(outline)",
  "    slot.glyph.enableOutline = false",
  "    ui_set_active(slot.glyph, true)",
  "  end",
  "end",
  "",
  "-- 把一个槽位的所有层隐藏",
]);

// ---------- F) hide_slot：去掉剪影循环 ----------
removeLine("  for k = 1, #slot.shapes do ui_set_active(slot.shapes[k], false) end");

// ---------- G) 样式辅助：去掉 shape 分支 ----------
replaceBlock("local function piece_style_label(style)", "local function paint_slot(slot, p, bx, by, style)", [
  "local function piece_style_label(style)",
  "  if style == \"disc\" then return CONFIG.TEXT.BTN_STYLE_DISC end",
  "  return CONFIG.TEXT.BTN_STYLE_GLYPH",
  "end",
  "",
  "-- 样式 → 中文名（提示条用）",
  "local function piece_style_name_cn(style)",
  "  if style == \"disc\" then return \"圆盘+棋符\" end",
  "  return \"纯棋符\"",
  "end",
  "",
  "-- 把一个槽位摆到某格并画成指定棋子",
  "local function paint_slot(slot, p, bx, by, style)",
]);

// ---------- H) 注释同步 ----------
const c1 = findLine("  pieceSlots = {},     -- 棋子槽位池（每槽 = 圆盘2 + 棋符1 + 剪影最多6；按 32 个同时在场建）");
if (c1 >= 0) lines[c1] = "  pieceSlots = {},     -- 棋子槽位池（每槽 = 圆盘2 + 棋符1；按 32 个同时在场建）";
const c2 = findLine("  pieceStyle = \"glyph\",  -- 棋子样式：\"disc\" 圆盘+棋符 / \"shape\" 圆盘+剪影 / \"glyph\" 纯棋符");
if (c2 >= 0) lines[c2] = "  pieceStyle = \"glyph\",  -- 棋子样式：\"disc\" 圆盘+棋符 / \"glyph\" 纯棋符";

const out = lines.join("\r\n");
fs.writeFileSync(P, out, "utf8");
console.log("行数 " + before + " → " + lines.length + "，字节 " + raw.length + " → " + out.length);
