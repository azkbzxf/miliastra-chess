// tools_work/build_demo_rules.cjs
// 从 lua/levelScript.lua 的第 3 区 RULES 生成 JS 版走法引擎（供 Demo 内联使用）。
// 目的：Demo 的规则与正式 Lua 用同一份逻辑来源，避免两套实现分叉。
//
// 做法：把 Lua 规则层「手工翻译」成 JS 不现实（容易出错），改为
//   ——在 Demo 里用内联的 Lua 解释器？不可行（体积 577KB，且是额外依赖）。
//   ——改用「规则层由 JS 重写，但与 Lua 用同一套 perft 标准答案交叉验证」。
// 本脚本负责：从 Lua 里抽取 perft 用例的 FEN 与期望值，生成 JS 常量文件，
// 让 Demo 自检时用同一批标准答案比对 JS 实现。
const fs = require("fs");
const path = require("path");

const ROOT = "D:/输出目录/国际象棋";
const lua = fs.readFileSync(path.join(ROOT, "lua/levelScript.lua"), "utf8");

// 抽取 PERFT_CASES
const m = lua.match(/local PERFT_CASES = \{([\s\S]*?)\n\}/);
if (!m) { console.error("PERFT_CASES_NOT_FOUND"); process.exit(3); }

const cases = [];
const re = /\{ name = "([^"]+)",\s*fen = (?:START_FEN|"([^"]+)"),\s*d1 = (\d+),\s*d2 = (\d+),\s*d3 = (\d+) \}/g;
let mm;
while ((mm = re.exec(m[1])) !== null) {
  cases.push({
    name: mm[1],
    fen: mm[2] || "START_FEN",
    d1: Number(mm[3]), d2: Number(mm[4]), d3: Number(mm[5]),
  });
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
cases.forEach(c => { if (c.fen === "START_FEN") c.fen = START; });

console.log("抽到 " + cases.length + " 个 perft 用例");
cases.forEach(c => console.log("  " + c.name + " d1=" + c.d1 + " d2=" + c.d2 + " d3=" + c.d3));

const out = "// 由 tools_work/build_demo_rules.cjs 从 lua/levelScript.lua 抽取，勿手改\n" +
  "const PERFT_CASES = " + JSON.stringify(cases, null, 2) + ";\n" +
  "const START_FEN = " + JSON.stringify(START) + ";\n";
fs.writeFileSync(path.join(ROOT, "tools_work/demo_perft_cases.js"), out, "utf8");
console.log("\n写出 tools_work/demo_perft_cases.js");
