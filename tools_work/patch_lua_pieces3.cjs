// tools_work/patch_lua_pieces3.cjs
// 补齐：piece_images_ready / piece_image_source_enum 辅助函数、UI.pieceImages 创建、
//       create_image 工厂、GAME.pieceMode 状态、切换按钮、开关文案。
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let lines = fs.readFileSync(P, "utf8").split("\n");

function findLine(pred, from) {
  for (let i = from || 0; i < lines.length; i++) if (pred(lines[i])) return i;
  return -1;
}
function insertBefore(idx, text) {
  lines.splice(idx, 0, ...text.split("\n"));
}
function insertAfter(idx, text) {
  lines.splice(idx + 1, 0, ...text.split("\n"));
}

// ---------- 1) 辅助函数：插在 move_text 之前 ----------
const mtIdx = findLine(l => l.trim() === "local function move_text(mv, side)");
if (mtIdx < 0) { console.error("MOVE_TEXT_NOT_FOUND"); process.exit(3); }
insertBefore(mtIdx, `-- 图片棋子是否可用：12 个编号必须全部非 0，且图片模板索引非 0
local function piece_images_ready()
  if CONFIG.PREFAB_PIECE_IMAGE == 0 then return false end
  local ids = CONFIG.PIECE_IMAGE_IDS
  if ids == nil then return false end
  local keys = { "PW", "NW", "BW", "RW", "QW", "KW", "PB", "NB", "BB", "RB", "QB", "KB" }
  for _, k in ipairs(keys) do
    if (ids[k] or 0) <= 0 then return false end
  end
  return true
end

-- 图片来源枚举（按配置名取；取不到就用 StaticReference，API 文档 L520）
local function piece_image_source_enum()
  local name = CONFIG.PIECE_IMAGE_SOURCE or "StaticReference"
  local ok, v = pcall(function() return Enum.ImageSource[name] end)
  if ok and v ~= nil then return v end
  return Enum.ImageSource.StaticReference
end
`);
console.log("1) 辅助函数已插入 @ 行", mtIdx + 1);

// ---------- 2) create_image 工厂：插在 create_cursor_area 之后 ----------
const ccaIdx = findLine(l => l.trim() === "local function create_cursor_area(opts)");
if (ccaIdx < 0) { console.error("CURSOR_AREA_NOT_FOUND"); process.exit(3); }
// 找到该函数结束
let ccaEnd = -1;
for (let i = ccaIdx + 1; i < lines.length; i++) if (lines[i].trim() === "end") { ccaEnd = i; break; }
if (ccaEnd < 0) { console.error("CCA_END"); process.exit(3); }

insertAfter(ccaEnd, `
-- 创建一个图片控件（棋子图标层用）。创建顺序与文本框一致。
local function create_image(opts)
  if CONFIG.PREFAB_PIECE_IMAGE == 0 then return nil end
  local ctrl = game.InstantiateClientUIControl(CONFIG.PREFAB_PIECE_IMAGE, opts.parent)
  if ctrl == nil then return nil end
  ctrl:SetPivot(0, 0)
  ctrl:SetAnchorMin(0, 0)
  ctrl:SetAnchorMax(0, 0)
  ctrl:SetSizeDelta(opts.w, opts.h)
  ctrl:SetAnchoredPosition(opts.x, opts.y)
  if opts.name then ctrl.name = opts.name end
  if CONFIG.ENABLE_RAYCAST_FIELD then
    pcall(function() ctrl.raycastTarget = false end)
  end
  ctrl:SetActive(false)
  FACTORY.cleanup[#FACTORY.cleanup + 1] = ctrl
  FACTORY.created = FACTORY.created + 1
  return ctrl
end
`);
console.log("2) create_image 工厂已插入");

// ---------- 3) UI 表加 pieceImages ----------
const uiIdx = findLine(l => l.indexOf("pieces = {},") >= 0 && l.indexOf("UI") < 0);
let uiTableIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("local UI = {") ) { uiTableIdx = i; break; }
}
if (uiTableIdx < 0) { console.error("UI_TABLE"); process.exit(3); }
for (let i = uiTableIdx; i < uiTableIdx + 40; i++) {
  if (lines[i].includes("pieces = {},")) {
    lines.splice(i + 1, 0, "  pieceImages = {},     -- 图片棋子层（图片模式用）");
    console.log("3) UI.pieceImages 已加入");
    break;
  }
}

// ---------- 4) build_board 里创建图片层（紧跟棋子文本框之后） ----------
let pieceLoopEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('name = "piece_" .. tostring(sq),')) {
    // 该 create_text 块结束是 "    })"
    for (let j = i; j < i + 20; j++) {
      if (lines[j].trim() === "})") { pieceLoopEnd = j; break; }
    }
    break;
  }
}
if (pieceLoopEnd < 0) { console.error("PIECE_LOOP_END"); process.exit(3); }
insertAfter(pieceLoopEnd, `    -- 图片棋子层（与文本框同位置；图片模式时显示它、隐藏文本框）
    UI.pieceImages[sq] = create_image({
      name = "pimg_" .. tostring(sq),
      parent = nil, x = x, y = y, w = L.cell, h = L.cell,
    })`);
console.log("4) 图片层创建已插入");

// ---------- 5) GAME 状态加 pieceMode ----------
const pmIdx = findLine(l => l.includes("confirmKind = nil,"));
if (pmIdx < 0) { console.error("CONFIRMKIND"); process.exit(3); }
insertBefore(pmIdx, `  pieceMode = "glyph",    -- 棋子显示模式："image" 图片 / "glyph" 符号（启动时按配置决定）`);
console.log("5) GAME.pieceMode 已加入");

fs.writeFileSync(P, lines.join("\n"), "utf8");
console.log("OK");
