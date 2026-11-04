// tools_work/patch_build_demo.cjs
// 直接用 Node 重写 build_demo.cjs 的注入段（避开 shell/python 转义问题）
const fs = require("fs");
const path = require("path");

const P = "D:/输出目录/国际象棋/tools_work/build_demo.cjs";
let s = fs.readFileSync(P, "utf8");

const marker = "// 顺序：先 perft 用例（PERFT_CASES / START_FEN），再规则引擎";
const idx = s.indexOf(marker);
if (idx < 0) { console.error("MARKER_NOT_FOUND"); process.exit(3); }

// 找到该段结束（下一个空行后的 tpl.replace）
const endIdx = s.indexOf('tpl = tpl.replace("__CHESS_RULES__", injected);', idx);
if (endIdx < 0) { console.error("END_NOT_FOUND"); process.exit(3); }

const newBlock = `// 顺序：先棋子图数据，再 perft 用例，最后规则引擎
const pieceData = fs.readFileSync(path.join(ROOT, "tools_work/icons/out/piece_data.js"), "utf8");
const injected = "/* ---- 棋子图（cburnett，内联 SVG，CC-BY-SA 3.0） ---- */\\n" +
  pieceData + "\\n" +
  "/* ---- perft 用例（从 lua/levelScript.lua 抽取） ---- */\\n" +
  cases + "\\n" +
  "/* ---- 规则引擎 ---- */\\n" + rules;

`;

s = s.slice(0, idx) + newBlock + s.slice(endIdx);
fs.writeFileSync(P, s, "utf8");
console.log("patched build_demo.cjs");
