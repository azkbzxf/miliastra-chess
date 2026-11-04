// tools_work/patch_lua_pieces4.cjs
// 加第五个按钮「棋子样式」+ 启动时按配置决定初始模式 + 点击处理。
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let lines = fs.readFileSync(P, "utf8").split("\n");

function findLine(pred, from) {
  for (let i = from || 0; i < lines.length; i++) if (pred(lines[i])) return i;
  return -1;
}

// ---------- 1) 文案：加两个按钮文字 ----------
const txtIdx = findLine(l => l.includes('BTN_LOCAL = "切换本地同屏",'));
if (txtIdx < 0) { console.error("BTN_LOCAL"); process.exit(3); }
lines.splice(txtIdx + 1, 0,
  '    BTN_STYLE_IMAGE = "棋子：图片",',
  '    BTN_STYLE_GLYPH = "棋子：符号",');
console.log("1) 文案已加");

// ---------- 2) 面板按钮：加第五个（在 btnLocal 之后）----------
let btnLocalEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('name = "btnlocal", parent = nil')) {
    for (let j = i; j < i + 15; j++) if (lines[j].trim() === "})") { btnLocalEnd = j; break; }
    break;
  }
}
if (btnLocalEnd < 0) { console.error("BTNLOCAL_END"); process.exit(3); }

// 面板重排：三行两列，按钮高 7%
// 先找 btnW/btnH 定义
let bwIdx = findLine(l => l.includes("local btnW, btnH ="));
if (bwIdx < 0) { console.error("BTNW"); process.exit(3); }
lines[bwIdx] = "  local btnW, btnH = w(0.44), h(0.07)";

// 改四个旧按钮的 y 位置（0.15 → 0.235；0.05 → 0.155）
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('name = "btnnew", parent = nil')) lines[i] = lines[i].replace("atY(0.15)", "atY(0.235)");
  if (lines[i].includes('name = "btnresign", parent = nil')) lines[i] = lines[i].replace("atY(0.15)", "atY(0.235)");
  if (lines[i].includes('name = "btndraw", parent = nil')) lines[i] = lines[i].replace("atY(0.05)", "atY(0.155)");
  if (lines[i].includes('name = "btnlocal", parent = nil')) lines[i] = lines[i].replace("atY(0.05)", "atY(0.155)");
}

lines.splice(btnLocalEnd + 1, 0,
  `  -- 第五个按钮：棋子样式切换（图片 / 符号）
  UI.panel.btnStyle = create_text({
    name = "btnstyle", parent = nil,
    x = atX(0.04), y = atY(0.075), w = btnW, h = btnH,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_STYLE_IMAGE,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })`);
console.log("2) 第五个按钮已加");

// 对应点击区（在 hitLocal 之后）
let hitLocalEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('name = "hitlocal",')) { hitLocalEnd = i; break; }
}
if (hitLocalEnd < 0) { console.error("HITLOCAL"); process.exit(3); }
lines.splice(hitLocalEnd + 1, 0,
  `  UI.panel.hitStyle  = create_cursor_area({ name = "hitstyle",  parent = nil, x = atX(0.04), y = atY(0.075), w = btnW, h = btnH })`);
// 同时修正旧四个点击区的 y
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('name = "hitnew",')) lines[i] = lines[i].replace("atY(0.15)", "atY(0.235)");
  if (lines[i].includes('name = "hitresign",')) lines[i] = lines[i].replace("atY(0.15)", "atY(0.235)");
  if (lines[i].includes('name = "hitdraw",')) lines[i] = lines[i].replace("atY(0.05)", "atY(0.155)");
  if (lines[i].includes('name = "hitlocal",')) lines[i] = lines[i].replace("atY(0.05)", "atY(0.155)");
}
console.log("3) 第五个点击区已加，旧按钮位置已调整");

// ---------- 3) 点击处理：在 hitLocal 的 register_click 之后 ----------
let regLocal = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("register_click(UI.panel.hitLocal,")) { regLocal = i; break; }
}
if (regLocal < 0) { console.error("REG_LOCAL"); process.exit(3); }
// 找到该 register_click 块结束（"  end)"）
let regLocalEnd = -1;
for (let i = regLocal + 1; i < regLocal + 20; i++) if (lines[i].trim() === "end)") { regLocalEnd = i; break; }
if (regLocalEnd < 0) { console.error("REG_LOCAL_END"); process.exit(3); }

lines.splice(regLocalEnd + 1, 0,
  `  -- 棋子样式切换：图片 ↔ 符号。图片不可用时不切换，只提示。
  register_click(UI.panel.hitStyle, function()
    if GAME.pieceMode == "image" then
      GAME.pieceMode = "glyph"
      UI.panel.btnStyle.text = CONFIG.TEXT.BTN_STYLE_GLYPH
      if UI.panel.hint then UI.panel.hint.text = "棋子：符号样式" end
    else
      if not piece_images_ready() then
        if UI.panel.hint then UI.panel.hint.text = "图片棋子还没配好，先用符号" end
        return true
      end
      GAME.pieceMode = "image"
      UI.panel.btnStyle.text = CONFIG.TEXT.BTN_STYLE_IMAGE
      if UI.panel.hint then UI.panel.hint.text = "棋子：图片样式" end
    end
    render_pieces()
    return true
  end)`);
console.log("4) 切换处理已加");

// ---------- 4) 启动时决定初始模式：在 new_game 之前 ----------
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "new_game()" && lines[i - 1] && lines[i - 1].includes("⑦")) { startIdx = i; break; }
}
if (startIdx < 0) {
  // 退化：找 OnStart 里第一次调用 new_game()
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "new_game()") { startIdx = i; break; }
  }
}
if (startIdx < 0) { console.error("NEWGAME_CALL"); process.exit(3); }
lines.splice(startIdx, 0,
  `  -- 按配置决定初始棋子样式：默认 image，但 12 个编号不全时自动用 glyph
  if CONFIG.DEFAULT_PIECE_MODE == "image" and piece_images_ready() then
    GAME.pieceMode = "image"
    if UI.panel.btnStyle then UI.panel.btnStyle.text = CONFIG.TEXT.BTN_STYLE_IMAGE end
  else
    GAME.pieceMode = "glyph"
    if UI.panel.btnStyle then UI.panel.btnStyle.text = CONFIG.TEXT.BTN_STYLE_GLYPH end
  end
`);
console.log("5) 初始模式已加 @ 行", startIdx + 1);

fs.writeFileSync(P, lines.join("\n"), "utf8");
console.log("OK");
