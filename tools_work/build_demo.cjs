// tools_work/build_demo.cjs
// 把 chess_rules.js + perft 用例 + demo_template.html 拼成最终单文件 Demo。
// 产物：proto/chess_demo.html（纯内联、离线可用、无任何外部依赖）
const fs = require("fs");
const path = require("path");

const ROOT = "D:/输出目录/国际象棋";
const rulesPath = path.join(ROOT, "tools_work/chess_rules.js");
const casesPath = path.join(ROOT, "tools_work/demo_perft_cases.js");
const tplPath = path.join(ROOT, "tools_work/demo_template.html");
const outPath = path.join(ROOT, "proto/chess_demo.html");

let rules = fs.readFileSync(rulesPath, "utf8");
let cases = fs.readFileSync(casesPath, "utf8");
let tpl = fs.readFileSync(tplPath, "utf8");

// 规则文件是 CommonJS 模块；浏览器内联时把 module.exports 判断去掉即可（代码里已用 typeof 保护）
// perft 用例文件末尾有 module.exports 吗？没有 —— 它只是 const 声明，浏览器可直接用。

if (!tpl.includes("__CHESS_RULES__")) {
  console.error("模板缺少 __CHESS_RULES__ 占位");
  process.exit(3);
}

// 顺序：先 perft 用例，再规则引擎
// 【不再内联 cburnett 棋子 SVG】千星奇域图片控件不能上传自定义图片，
// 真机只能用「基础图元（100002 实心圆）染色 + Unicode 棋符」拼出棋子，
// Demo 必须忠实反映真机效果，故棋子两档都用纯代码画（纯棋符 / 圆盘+棋符）。
const injected = "/* ---- perft 用例（从 lua/levelScript.lua 抽取） ---- */\n" +
  cases + "\n" +
  "/* ---- 规则引擎 ---- */\n" + rules;

tpl = tpl.replace("__CHESS_RULES__", injected);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, tpl, "utf8");

const size = fs.statSync(outPath).size;
console.log(`WROTE ${outPath}  ${size} 字节`);
console.log("规则行数:", rules.split("\n").length, "| 用例行数:", cases.split("\n").length);
