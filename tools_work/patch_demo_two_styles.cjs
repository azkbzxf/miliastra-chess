// tools_work/patch_demo_two_styles.cjs
// 用户改主意：不做第三档「圆盘+剪影」。
// Demo 也同步改成两档：① 纯棋符  ② 圆盘+棋符（与 Lua 真机能力一致）。
// 原先的 cburnett 内联 SVG「图片档」不再使用（平台不能上传自定义图片，Demo 必须忠实反映真机）。
// 按行扫描替换，CRLF 安全。
const fs = require("fs");

const P = "D:/输出目录/国际象棋/tools_work/demo_template.html";
let raw = fs.readFileSync(P, "utf8");
let lines = raw.split("\r\n");
const before = lines.length;

function idx(sub, from = 0) {
  for (let i = from; i < lines.length; i++) if (lines[i].includes(sub)) return i;
  return -1;
}
function delRange(a, b) { lines.splice(a, b - a + 1); }
function del(sub) {
  const a = idx(sub);
  if (a < 0) { console.log("SKIP 未找到: " + sub); return; }
  lines.splice(a, 1);
}
function repBlock(startSub, endSub, newLines) {
  const a = idx(startSub);
  if (a < 0) { console.log("SKIP 未找到起点: " + startSub); return; }
  const b = idx(endSub, a);
  if (b < 0) { console.log("SKIP 未找到终点: " + endSub); return; }
  lines.splice(a, b - a + 1, ...newLines);
}
function repLine(sub, newLine) {
  const a = idx(sub);
  if (a < 0) { console.log("SKIP 未找到: " + sub); return; }
  lines[a] = newLine;
}

// ---------- 1) CSS：加圆盘层样式 ----------
const coordCss = idx("  .coord { z-index: 7;");
lines.splice(coordCss, 0, "  .piece-disc { z-index: 6; pointer-events: none; border-radius: 50%; }");

// ---------- 2) TEXT：图片 → 圆盘 ----------
repBlock('    BTN_STYLE_GLYPH: "棋子：符号",', '    BTN_STYLE_IMAGE: "棋子：图片",', [
  '    BTN_STYLE_DISC: "棋子：圆盘",',
  '    BTN_STYLE_GLYPH: "棋子：符号",',
]);

// ---------- 3) 删 PIECE_IMAGE_IDS / imageModeUsable / pieceImageKey ----------
{
  const a = idx("  // 图片模式的图片编号");
  const b = idx("  function pieceGlyph(p) {", a);
  if (a >= 0 && b >= 0) delRange(a, b - 1);
  else console.log("SKIP PIECE_IMAGE_IDS 块");
}
{
  const a = idx("  function pieceImageKey(p) {");
  if (a >= 0) delRange(a, a + 3);   // 函数体 4 行（含结尾 }）
  else console.log("SKIP pieceImageKey");
}

// ---------- 4) UI 表：pieces → pieceSlots ----------
repLine("    squares: [], hitAreas: [], pieces: [], legalHL: [], selHL: null,",
        "    squares: [], hitAreas: [], pieceSlots: [], slotShown: 0, legalHL: [], selHL: null,");

// ---------- 5) buildBoard：64 棋子元素 → 32 槽位 ----------
repBlock("    // 棋子", "    // 落点高亮池（28）", [
  "    // 棋子槽位（32 个：棋盘上同时最多 32 枚棋子在场）",
  "    // 每槽 = 圆盘外圈 + 圆盘内圈 + 棋符文本框；两档样式共用，切档只改显隐，不重建。",
  "    for (let i = 0; i < 32; i++) {",
  "      const slot = { sq: -1 };",
  "      slot.outer = mkEl(boardEl, \"piece-disc el\", { x: 0, y: 0, w: L.cell, h: L.cell, anchorId: \"pdisco_\" + i });",
  "      slot.inner = mkEl(boardEl, \"piece-disc el\", { x: 0, y: 0, w: L.cell, h: L.cell, anchorId: \"pdski_\" + i });",
  "      slot.glyph = mkEl(boardEl, \"piece\", { x: 0, y: 0, w: L.cell, h: L.cell, fontSize: pieceFont, anchorId: \"piece_\" + i });",
  "      for (const el of [slot.outer, slot.inner, slot.glyph]) el.classList.add(\"hidden\");",
  "      UI.pieceSlots[i] = slot;",
  "    }",
  "    // 落点高亮池（28）",
]);

// ---------- 6) G 表：pieceMode → pieceStyle ----------
repLine("    pieceMode: 1,         // 0=Unicode 棋符  1=图片（默认图片：cburnett 内联 SVG）",
        "    pieceStyle: \"disc\",   // \"disc\" 圆盘+棋符 / \"glyph\" 纯棋符（与 Lua 真机两档一致）");

// ---------- 7) renderPieces 整体重写 ----------
repBlock("  function renderPieces() {", "  function renderCaptured() {", [
  "  function pieceStyleLabel(style) {",
  "    return style === \"disc\" ? TEXT.BTN_STYLE_DISC : TEXT.BTN_STYLE_GLYPH;",
  "  }",
  "  function pieceStyleNameCn(style) {",
  "    return style === \"disc\" ? \"圆盘+棋符\" : \"纯棋符\";",
  "  }",
  "",
  "  // 把一个槽位画成某枚棋子并摆到指定格（几何与 tools_work/three_boards2.html 一致）",
  "  function paintSlot(slot, p, bx, by, style) {",
  "    const box = L.cell;",
  "    const D = box * 0.88, ring = box * 0.048, innerD = D - ring * 2;",
  "    const isWhite = p > 0;",
  "    const fill = isWhite ? COLOR.WHITE_PIECE : COLOR.BLACK_PIECE;",
  "    const outline = isWhite ? COLOR.WHITE_OUTLINE : COLOR.BLACK_OUTLINE;",
  "    const ox = bx + (box - D) / 2, oy = by + (box - D) / 2;",
  "    const ix = bx + (box - innerD) / 2, iy = by + (box - innerD) / 2;",
  "",
  "    if (style === \"glyph\") {",
  "      // 纯棋符：只有文本框，白方白字深描边、黑方深字浅描边",
  "      slot.outer.classList.add(\"hidden\");",
  "      slot.inner.classList.add(\"hidden\");",
  "      slot.glyph.style.left = bx + \"px\";",
  "      slot.glyph.style.bottom = by + \"px\";",
  "      slot.glyph.style.width = box + \"px\";",
  "      slot.glyph.style.height = box + \"px\";",
  "      slot.glyph.style.fontSize = Math.floor(box * 0.80) + \"px\";",
  "      slot.glyph.style.lineHeight = box + \"px\";",
  "      slot.glyph.style.color = fill;",
  "      slot.glyph.style.textShadow = \"0 0 2px \" + outline + \", 2px 2px 0 \" + outline +",
  "        \", -2px -2px 0 \" + outline + \", 2px -2px 0 \" + outline + \", -2px 2px 0 \" + outline;",
  "      slot.glyph.textContent = pieceGlyph(p);",
  "      slot.glyph.classList.remove(\"hidden\");",
  "      return;",
  "    }",
  "",
  "    // 圆盘+棋符：外圈=描边色、内圈=棋子色，棋符画在圆盘上（字色=描边色，不加描边避免糊成一团）",
  "    for (const [el, d, off, col] of [[slot.outer, D, [ox, oy], outline], [slot.inner, innerD, [ix, iy], fill]]) {",
  "      el.style.left = off[0] + \"px\";",
  "      el.style.bottom = off[1] + \"px\";",
  "      el.style.width = d + \"px\";",
  "      el.style.height = d + \"px\";",
  "      el.style.background = col;",
  "      el.classList.remove(\"hidden\");",
  "    }",
  "    slot.glyph.style.left = ix + \"px\";",
  "    slot.glyph.style.bottom = iy + \"px\";",
  "    slot.glyph.style.width = innerD + \"px\";",
  "    slot.glyph.style.height = innerD + \"px\";",
  "    slot.glyph.style.fontSize = Math.floor(innerD * 0.80) + \"px\";",
  "    slot.glyph.style.lineHeight = innerD + \"px\";",
  "    slot.glyph.style.color = outline;",
  "    slot.glyph.style.textShadow = \"none\";",
  "    slot.glyph.textContent = pieceGlyph(p);",
  "    slot.glyph.classList.remove(\"hidden\");",
  "  }",
  "",
  "  function renderPieces() {",
  "    const style = (G.pieceStyle === \"disc\") ? \"disc\" : \"glyph\";",
  "    let used = 0;",
  "    for (let sq = 0; sq < 64; sq++) {",
  "      const p = G.st.board[sq];",
  "      if (p === 0) continue;",
  "      if (used >= UI.pieceSlots.length) break;",
  "      const slot = UI.pieceSlots[used];",
  "      used++;",
  "      slot.sq = sq;",
  "      const pos = sqPos(sq);",
  "      paintSlot(slot, p, pos.x, pos.y, style);",
  "    }",
  "    // 多余槽位一律隐藏（播放期零创建零销毁）",
  "    for (let i = used; i < UI.pieceSlots.length; i++) {",
  "      const slot = UI.pieceSlots[i];",
  "      slot.sq = -1;",
  "      slot.outer.classList.add(\"hidden\");",
  "      slot.inner.classList.add(\"hidden\");",
  "      slot.glyph.classList.add(\"hidden\");",
  "    }",
  "    UI.slotShown = used;",
  "  }",
  "",
  "  function renderCaptured() {",
]);

// ---------- 8) togglePieceStyle 重写 ----------
repBlock("  function togglePieceStyle() {", "  function toggleLocalMode() {", [
  "  function togglePieceStyle() {",
  "    G.pieceStyle = (G.pieceStyle === \"disc\") ? \"glyph\" : \"disc\";",
  "    UI.panel.btnStyle.textContent = pieceStyleLabel(G.pieceStyle);",
  "    UI.hint.textContent = \"棋子样式：\" + pieceStyleNameCn(G.pieceStyle);",
  "    renderPieces();",
  "  }",
  "",
  "  function toggleLocalMode() {",
]);

// ---------- 9) 按钮文案 ----------
repLine('      ["btnStyle", "hitStyle", atX(0.04), atY(0.06), TEXT.BTN_STYLE_IMAGE, "btnstyle"],',
        '      ["btnStyle", "hitStyle", atX(0.04), atY(0.06), TEXT.BTN_STYLE_DISC, "btnstyle"],');

// ---------- 10) 自检：pieces_64 → piece_slots_32 + 两档渲染 ----------
repBlock("      // 17 棋子 64 个都有文本能力", "      // 复位到干净开局", [
  "      // 17 棋子槽位 32 个（棋盘同时最多 32 枚棋子在场）",
  "      const slotN = UI.pieceSlots.filter(Boolean).length;",
  "      add(\"piece_slots_32\", slotN === 32, \"n=\" + slotN);",
  "",
  "      // 18 两档样式都能把全部棋子画出来（切档只改显隐，控件不重建）",
  "      let styleOk = true, styleDetail = \"\";",
  "      const wantShown = G.st.board.filter((v) => v !== 0).length;",
  "      for (const st of [\"disc\", \"glyph\"]) {",
  "        G.pieceStyle = st;",
  "        renderPieces();",
  "        const shown = UI.pieceSlots.filter((s) => !s.glyph.classList.contains(\"hidden\")).length;",
  "        if (shown !== wantShown) { styleOk = false; styleDetail += st + \" \" + shown + \"/\" + wantShown + \"; \"; }",
  "      }",
  "      add(\"piece_style_two_tiers\", styleOk, styleDetail);",
  "      G.pieceStyle = \"disc\";",
  "      renderPieces();",
  "",
  "      // 复位到干净开局",
]);

// ---------- 11) 文件头注释同步 ----------
repLine("  版本：v1", "  版本：v2（棋子两档：纯棋符 / 圆盘+棋符）");

const out = lines.join("\r\n");
fs.writeFileSync(P, out, "utf8");
console.log("行数 " + before + " → " + lines.length + "，字节 " + raw.length + " → " + out.length);
