// tools_work/patch_lua_render.cjs
// Lua：加图片棋子层 + 双模式渲染 + 切换按钮 + 被吃子用图标
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let s = fs.readFileSync(P, "utf8");

// ---------- 1) 工具函数：图片编号是否齐全 ----------
const helperAnchor = `-- 走子记录文本：白 e2→e4`;
const helper = `-- 图片棋子是否可用：12 个编号必须全部非 0，且图片模板索引非 0
local function piece_images_ready()
  if CONFIG.PREFAB_PIECE_IMAGE == 0 then return false end
  local ids = CONFIG.PIECE_IMAGE_IDS
  if ids == nil then return false end
  local keys = { "PW","NW","BW","RW","QW","KW","PB","NB","BB","RB","QB","KB" }
  for _, k in ipairs(keys) do
    if (ids[k] or 0) <= 0 then return false end
  end
  return true
end

-- 图片来源枚举（按配置名取；取不到就用 StaticReference）
local function piece_image_source_enum()
  local name = CONFIG.PIECE_IMAGE_SOURCE or "StaticReference"
  local ok, v = pcall(function() return Enum.ImageSource[name] end)
  if ok and v ~= nil then return v end
  return Enum.ImageSource.StaticReference
end

-- 走子记录文本：白 e2→e4`;
if (!s.includes(helperAnchor)) { console.error("HELPER_ANCHOR"); process.exit(3); }
s = s.replace(helperAnchor, helper, 1);

// ---------- 2) 被吃子记录改用棋符（面板窄空间，图标放不下） ----------
const capOld = `    local letter = PIECE_LETTER[captured]
    if captured > 0 then
      GAME.capturedWhite[#GAME.capturedWhite + 1] = letter
    else
      GAME.capturedBlack[#GAME.capturedBlack + 1] = letter
    end`;
const capNew = `    -- 被吃子记录用棋符（面板一行放 15 个小图标不现实，符号更紧凑）
    local glyph = PIECE_GLYPH[captured] or PIECE_LETTER[captured]
    if captured > 0 then
      GAME.capturedWhite[#GAME.capturedWhite + 1] = glyph
    else
      GAME.capturedBlack[#GAME.capturedBlack + 1] = glyph
    end`;
if (!s.includes(capOld)) { console.error("CAP_ANCHOR"); process.exit(3); }
s = s.replace(capOld, capNew, 1);

// ---------- 3) render_pieces 改为双模式 ----------
const renderOld = `local function render_pieces()
  if not GAME.uiReady then return end
  for sq = 0, 63 do
    local p = GAME.st.board[sq]
    local ctrl = UI.pieces[sq]
    if ctrl then
      if p == 0 then
        ctrl.text = ""
      else
        ctrl.text = PIECE_LETTER[p]
        if p > 0 then
          ctrl.fontColor = color_of(CONFIG.COLOR.WHITE_PIECE)
          ctrl.enableOutline = true
          ctrl.outlineColor = color_of(CONFIG.COLOR.WHITE_OUTLINE)
        else
          ctrl.fontColor = color_of(CONFIG.COLOR.BLACK_PIECE)
          ctrl.enableOutline = true
          ctrl.outlineColor = color_of(CONFIG.COLOR.BLACK_OUTLINE)
        end
      end
    end
  end
end`;
const renderNew = `local function render_pieces()
  if not GAME.uiReady then return end
  -- 图片模式不可用（编号没填）时自动回落符号模式
  local useImage = (GAME.pieceMode == "image") and piece_images_ready()

  for sq = 0, 63 do
    local p = GAME.st.board[sq]
    local txt = UI.pieces[sq]          -- 符号层（文本框）
    local img = UI.pieceImages[sq]     -- 图片层（图片控件，可能为 nil）

    if p == 0 then
      if txt then txt.text = ""; ui_set_active(txt, false) end
      if img then ui_set_active(img, false) end
    else
      if useImage and img ~= nil then
        -- 图片模式：显示图片，隐藏符号
        if txt then txt.text = ""; ui_set_active(txt, false) end
        local key = PIECE_IMAGE_KEY[p]
        local id = CONFIG.PIECE_IMAGE_IDS[key] or 0
        if id > 0 then
          img:SetImage(piece_image_source_enum(), id)
          img.imageType = Enum.ImageType.Basic
          ui_set_active(img, true)
        end
      else
        -- 符号模式：显示棋符，隐藏图片
        if img then ui_set_active(img, false) end
        if txt then
          txt.text = PIECE_GLYPH[p] or PIECE_LETTER[p]
          if p > 0 then
            txt.fontColor = color_of(CONFIG.COLOR.WHITE_PIECE)
            txt.enableOutline = true
            txt.outlineColor = color_of(CONFIG.COLOR.WHITE_OUTLINE)
          else
            txt.fontColor = color_of(CONFIG.COLOR.BLACK_PIECE)
            txt.enableOutline = true
            txt.outlineColor = color_of(CONFIG.COLOR.BLACK_OUTLINE)
          end
          ui_set_active(txt, true)
        end
      end
    end
  end
end`;
if (!s.includes(renderOld)) { console.error("RENDER_ANCHOR"); process.exit(3); }
s = s.replace(renderOld, renderNew, 1);

fs.writeFileSync(P, s, "utf8");
console.log("OK: 渲染改双模式");
