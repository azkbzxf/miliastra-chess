// tools_work/patch_lua_render2.cjs
// 按行号定位，避免缩进/空白差异导致匹配失败
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let lines = fs.readFileSync(P, "utf8").split("\n");

// ---------- 1) 找被吃子记录块（local letter = PIECE_LETTER[captured]）----------
let capIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("local letter = PIECE_LETTER[captured]")) { capIdx = i; break; }
}
if (capIdx < 0) { console.error("CAP_NOT_FOUND"); process.exit(3); }
// 该块共 6 行（1537..1542），前一行是 "if captured ~= 0 then"
const capBlock = [
  "    -- 被吃子记录用棋符（面板一行放 15 个小图标不现实，符号更紧凑）",
  "    local glyph = PIECE_GLYPH[captured] or PIECE_LETTER[captured]",
  "    if captured > 0 then",
  "      GAME.capturedWhite[#GAME.capturedWhite + 1] = glyph",
  "    else",
  "      GAME.capturedBlack[#GAME.capturedBlack + 1] = glyph",
  "    end",
];
lines.splice(capIdx, 6, ...capBlock);
console.log("替换被吃子记录块 @ 行", capIdx + 1);

// ---------- 2) 找 render_pieces 函数并整体替换 ----------
let rStart = -1, rEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("local function render_pieces()")) { rStart = i; break; }
}
if (rStart < 0) { console.error("RENDER_NOT_FOUND"); process.exit(3); }
// 从 rStart 往下找到第一个单独 "end"（缩进 0）
for (let i = rStart + 1; i < lines.length; i++) {
  if (lines[i] === "end") { rEnd = i; break; }
}
if (rEnd < 0) { console.error("RENDER_END_NOT_FOUND"); process.exit(3); }
console.log("render_pieces 范围: 行", rStart + 1, "到", rEnd + 1);

const newRender = `local function render_pieces()
  if not GAME.uiReady then return end
  -- 图片模式不可用（12 个编号没填全 / 图片模板索引为 0）时自动回落符号模式
  local useImage = (GAME.pieceMode == "image") and piece_images_ready()

  for sq = 0, 63 do
    local p = GAME.st.board[sq]
    local txt = UI.pieces[sq]          -- 符号层（文本框）
    local img = UI.pieceImages[sq]     -- 图片层（图片控件，可能为 nil）

    if p == 0 then
      if txt then txt.text = ""; ui_set_active(txt, false) end
      if img then ui_set_active(img, false) end
    elseif useImage and img ~= nil then
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
end`;
lines.splice(rStart, rEnd - rStart + 1, ...newRender.split("\n"));
console.log("已替换 render_pieces");

fs.writeFileSync(P, lines.join("\n"), "utf8");
console.log("OK");
