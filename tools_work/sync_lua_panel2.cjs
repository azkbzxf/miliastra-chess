// tools_work/sync_lua_panel2.cjs
// 逐行替换（CRLF 安全）：把 Lua 面板按钮布局与 Demo 对齐
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let lines = fs.readFileSync(P, "utf8").split("\n");

const edits = [
  ["  -- 四个按钮：8% 高，44% 宽", "  -- 五个按钮：8% 高，44% 宽。按钮高 8% 在 720 高下 = 44.9px，刚好达到触摸目标下限，不可再降。"],
  ["  local btnW, btnH = w(0.44), h(0.07)", "  local btnW, btnH = w(0.44), h(0.08)"],
];
for (const [a, b] of edits) {
  let hit = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === a.trim()) { lines[i] = b; hit = true; break; }
  }
  if (!hit) console.log("MISS: " + a);
}

// 按按钮名定位其 x/y 行（每个按钮块内第一行含 x = atX(...), y = atY(...)）
const btnPos = {
  "btnnew":    { x: 0.04, y: 0.24 },
  "btnresign": { x: 0.52, y: 0.24 },
  "btndraw":   { x: 0.04, y: 0.15 },
  "btnlocal":  { x: 0.52, y: 0.15 },
  "btnstyle":  { x: 0.04, y: 0.06 },
};
for (const [name, pos] of Object.entries(btnPos)) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('name = "' + name + '", parent = nil')) { idx = i; break; }
  }
  if (idx < 0) { console.log("BTN_NOT_FOUND " + name); continue; }
  // 向下找含 atX 的行
  for (let j = idx; j < idx + 6; j++) {
    if (lines[j].includes("x = atX(")) {
      lines[j] = lines[j].replace(/x = atX\([^)]*\), y = atY\([^)]*\)/,
        `x = atX(${pos.x}), y = atY(${pos.y})`);
      break;
    }
  }
}

// 点击区：按 hit 名定位
const hitPos = {
  "hitnew": { x: 0.04, y: 0.24 },
  "hitresign": { x: 0.52, y: 0.24 },
  "hitdraw": { x: 0.04, y: 0.15 },
  "hitlocal": { x: 0.52, y: 0.15 },
  "hitstyle": { x: 0.04, y: 0.06 },
};
for (const [name, pos] of Object.entries(hitPos)) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('name = "' + name + '"') && lines[i].includes("create_cursor_area")) {
      lines[i] = lines[i].replace(/x = atX\([^)]*\), y = atY\([^)]*\)/,
        `x = atX(${pos.x}), y = atY(${pos.y})`);
      break;
    }
  }
}

// 记录区：找 movelog 的 atX/atY 行
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('name = "movelog", parent = nil')) {
    for (let j = i; j < i + 6; j++) {
      if (lines[j].includes("x = atX(")) {
        lines[j] = lines[j].replace(/y = atY\([^)]*\)/, "y = atY(0.34)")
                             .replace(/h = h\([^)]*\)/, "h = h(0.14)");
        break;
      }
    }
    break;
  }
}

fs.writeFileSync(P, lines.join("\n"), "utf8");
console.log("done");
