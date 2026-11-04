// tools_work/sync_lua_panel.cjs
// 把 Lua 的面板按钮布局与 Demo 对齐：
//   按钮高恢复 8%（720 高下 44.9px，触摸目标下限）
//   三行两列：0.24 / 0.15 / 0.06
//   记录区上移 0.34，高 0.14
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let s = fs.readFileSync(P, "utf8");

const edits = [
  // 按钮高度
  ["  -- 四个按钮：8% 高，44% 宽\n  local btnW, btnH = w(0.44), h(0.07)",
   "  -- 五个按钮：8% 高，44% 宽。按钮高 8% 在 720 高下 = 44.9px，刚好达到触摸目标下限，不可再降。\n  local btnW, btnH = w(0.44), h(0.08)"],
  // 第 1 行
  ['    x = atX(0.04), y = atY(0.15), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_NEWGAME,',
   '    x = atX(0.04), y = atY(0.24), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_NEWGAME,'],
  ['    x = atX(0.52), y = atY(0.15), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_RESIGN,',
   '    x = atX(0.52), y = atY(0.24), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_RESIGN,'],
  // 第 2 行
  ['    x = atX(0.04), y = atY(0.05), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_DRAW,',
   '    x = atX(0.04), y = atY(0.15), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_DRAW,'],
  ['    x = atX(0.52), y = atY(0.05), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_LOCAL,',
   '    x = atX(0.52), y = atY(0.15), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_LOCAL,'],
  // 第 3 行（棋子样式）
  ['    x = atX(0.04), y = atY(0.075), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_STYLE_IMAGE,',
   '    x = atX(0.04), y = atY(0.06), w = btnW, h = btnH,\n    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_STYLE_IMAGE,'],
  // 点击区
  ['UI.panel.hitNew    = create_cursor_area({ name = "hitnew",    parent = nil, x = atX(0.04), y = atY(0.235), w = btnW, h = btnH })',
   'UI.panel.hitNew    = create_cursor_area({ name = "hitnew",    parent = nil, x = atX(0.04), y = atY(0.24), w = btnW, h = btnH })'],
  ['UI.panel.hitResign = create_cursor_area({ name = "hitresign", parent = nil, x = atX(0.52), y = atY(0.235), w = btnW, h = btnH })',
   'UI.panel.hitResign = create_cursor_area({ name = "hitresign", parent = nil, x = atX(0.52), y = atY(0.24), w = btnW, h = btnH })'],
  ['UI.panel.hitDraw   = create_cursor_area({ name = "hitdraw",   parent = nil, x = atX(0.04), y = atY(0.155), w = btnW, h = btnH })',
   'UI.panel.hitDraw   = create_cursor_area({ name = "hitdraw",   parent = nil, x = atX(0.04), y = atY(0.15), w = btnW, h = btnH })'],
  ['UI.panel.hitLocal  = create_cursor_area({ name = "hitlocal",  parent = nil, x = atX(0.52), y = atY(0.155), w = btnW, h = btnH })',
   'UI.panel.hitLocal  = create_cursor_area({ name = "hitlocal",  parent = nil, x = atX(0.52), y = atY(0.15), w = btnW, h = btnH })'],
  ['UI.panel.hitStyle  = create_cursor_area({ name = "hitstyle",  parent = nil, x = atX(0.04), y = atY(0.075), w = btnW, h = btnH })',
   'UI.panel.hitStyle  = create_cursor_area({ name = "hitstyle",  parent = nil, x = atX(0.04), y = atY(0.06), w = btnW, h = btnH })'],
  // 记录区
  ['    x = atX(0.04), y = atY(0.32), w = w(0.92), h = h(0.16),',
   '    x = atX(0.04), y = atY(0.34), w = w(0.92), h = h(0.14),'],
];

let applied = 0;
for (const [a, b] of edits) {
  if (s.includes(a)) { s = s.replace(a, b, 1); applied++; }
  else console.log("MISS: " + a.slice(0, 55).replace(/\n/g, "\\n"));
}
fs.writeFileSync(P, s, "utf8");
console.log(`\nLua 面板布局已同步 ${applied}/${edits.length} 处`);
