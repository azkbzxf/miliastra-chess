// 诊断 2：branch_not_in_paint_loop 的 2524 次控件写来自哪一段
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = s.split("\n");

console.log("=== reset 与 branch_* 的内部调用 ===");
for (let i = 0; i < lines.length; i++) {
  if (/^branch_(ensure|move|back) = function|^local function branch_(ensure|move|back)|^review_render = function|^refresh_review_actionbar = function|^refresh_branch_visuals = function|^local function clear_highlights/.test(lines[i])) {
    console.log("  " + (i + 1) + ": " + lines[i].trim());
  }
}

console.log("\n=== branch_back 内部调了什么 ===");
let i = lines.findIndex((l) => /^(local function )?branch_back\b/.test(l));
if (i >= 0) {
  for (let n = i; n < i + 30; n++) {
    if (/^\s*(clear_highlights|refresh_branch_visuals|review_render|review_load|ui_set_active)/.test(lines[n])) {
      console.log("  " + (n + 1) + ": " + lines[n].trim());
    }
  }
}

console.log("\n=== review_render 内部调了什么（会被 branch_* 触发）===");
i = lines.findIndex((l) => /^review_render = function/.test(l));
if (i >= 0) {
  for (let n = i; n < i + 30; n++) {
    if (/^\s*(render_|update_|show_|refresh_)/.test(lines[n])) {
      console.log("  " + (n + 1) + ": " + lines[n].trim());
    }
  }
}

console.log("\n=== render_pieces 里有多少次控件写（关键）===");
const rp = lines.findIndex((l) => /^local function render_pieces/.test(l));
if (rp >= 0) {
  let writes = 0, uiSet = 0;
  for (let n = rp; n < rp + 120; n++) {
    if (/SetAnchoredPosition|SetSizeDelta/.test(lines[n])) writes++;
    if (/ui_set_active/.test(lines[n])) uiSet++;
    if (/^end/.test(lines[n])) break;
  }
  console.log("  SetAnchoredPosition/SetSizeDelta 调用点: " + writes);
  console.log("  ui_set_active 调用点: " + uiSet);
  console.log("  → 每次 render_pieces ≈ " + (writes + uiSet) + " 次写 × 32 槽位量级 = 数百~数千");
}
