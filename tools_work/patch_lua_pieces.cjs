// tools_work/patch_lua_pieces.cjs
// 给 Lua 加「图片棋子」模式：12 个图片编号配置 + 图片控件层 + 切换 + 符号兜底。
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let s = fs.readFileSync(P, "utf8");

// ---------- 1) CONFIG 加图片编号与模式开关 ----------
const cfgAnchor = "  PREFAB_CURSOR_AREA   = 0,      -- 光标检测区域模板索引：64 个棋盘格的点击检测";
const cfgNew = `  PREFAB_CURSOR_AREA   = 0,      -- 光标检测区域模板索引：64 个棋盘格的点击检测
  PREFAB_PIECE_IMAGE   = 0,      -- 图片模板索引：棋子图标用（图片模式必需；缺省 0 = 只用符号样式）

  -- ===== 棋子图标（图片模式）=====
  -- 12 个图片编号：6 种棋子 × 白/黑。填了才会启用图片模式；任何一项为 0 则自动回落符号样式。
  -- 键：P=兵 N=马 B=象 R=车 Q=后 K=王；W=白 B=黑
  -- 图片来源固定用 Enum.ImageSource.StaticReference（静态引用，API 文档 L520）
  PIECE_IMAGE_IDS = {
    PW = 0, NW = 0, BW = 0, RW = 0, QW = 0, KW = 0,
    PB = 0, NB = 0, BB = 0, RB = 0, QB = 0, KB = 0,
  },
  PIECE_IMAGE_SOURCE = "StaticReference",   -- 图片来源枚举名（见 API 文档 L516-527）
  DEFAULT_PIECE_MODE = "image",              -- 开局默认：image（图片）/ glyph（符号）；图片编号不全时自动用 glyph`;
if (!s.includes(cfgAnchor)) { console.error("CFG_ANCHOR"); process.exit(3); }
s = s.replace(cfgAnchor, cfgNew, 1);

// ---------- 2) 棋子符号表（Unicode 实心棋符） ----------
const letterAnchor = `local PIECE_LETTER = {`;
const glyphBlock = `-- Unicode 实心棋符（U+265A..U+265F）：白方白字深描边、黑方深字浅描边。
-- 只在「符号样式」下使用；图片模式用图片控件。
local PIECE_GLYPH = {
  [-PAWN] = "\\u{265F}", [-KNIGHT] = "\\u{265E}", [-BISHOP] = "\\u{265D}",
  [-ROOK] = "\\u{265C}", [-QUEEN] = "\\u{265B}", [-KING] = "\\u{265A}",
  [PAWN] = "\\u{265F}", [KNIGHT] = "\\u{265E}", [BISHOP] = "\\u{265D}",
  [ROOK] = "\\u{265C}", [QUEEN] = "\\u{265B}", [KING] = "\\u{265A}",
}
-- 图片编号表的键名（棋子 + 颜色）
local PIECE_IMAGE_KEY = {
  [-PAWN] = "PB", [-KNIGHT] = "NB", [-BISHOP] = "BB", [-ROOK] = "RB", [-QUEEN] = "QB", [-KING] = "KB",
  [PAWN] = "PW", [KNIGHT] = "NW", [BISHOP] = "BW", [ROOK] = "RW", [QUEEN] = "QW", [KING] = "KW",
}

local PIECE_LETTER = {`;
if (!s.includes(letterAnchor)) { console.error("LETTER_ANCHOR"); process.exit(3); }
s = s.replace(letterAnchor, glyphBlock, 1);

// 暴露给 RULES 外部使用
s = s.replace("RULES.PIECE_LETTER = PIECE_LETTER",
              "RULES.PIECE_LETTER = PIECE_LETTER\nRULES.PIECE_GLYPH = PIECE_GLYPH\nRULES.PIECE_IMAGE_KEY = PIECE_IMAGE_KEY", 1);

fs.writeFileSync(P, s, "utf8");
console.log("OK: CONFIG 加图片编号 + 符号表");
