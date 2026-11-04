// tools_work/lua_check.cjs
// 纯 JS 的 Lua 5.3 静态检查（本机没有 Lua 解释器，用 luaparse 顶）。
//
// 检查内容：
//   1. 语法：能完整解析 = 语法没问题（报错给出行列与附近源码）
//   2. 分区顺序：第 1..11 区标题齐全、顺序不乱
//   3. 局部函数「先声明后使用」：Lua 的 local function 在定义前不可见，
//      这是本项目最容易犯的错（曾经 D-11 就是视图函数未定义即调用，启动直接崩）
//   4. 未定义全局读写：白名单外的全局名字只警告不报错（平台 API 不在本地可验）
//   5. 新增痕迹：CONFIG.SFX / 浅色主题 / 脏槽位机制是否真的落地
//
// 用法：node tools_work/lua_check.cjs [文件路径...]
const fs = require("fs");
const path = require("path");

let luaparse;
try {
  luaparse = require(path.join(__dirname, "tmp/jscheck/node_modules/luaparse"));
} catch (e) {
  console.error("缺少 luaparse：cd tools_work/tmp/jscheck && npm i luaparse");
  process.exit(2);
}

const DEFAULTS = ["lua/levelScript.lua", "sim/levelScript.lua", "out/交付包/levelScript.lua"];

// 平台全局（客户端脚本运行时提供）：出现这些名字不算未定义
const PLATFORM = new Set([
  "game", "script", "Enum", "Color", "print", "printerr", "typeof", "pcall", "xpcall",
  "error", "assert", "type", "tostring", "tonumber", "pairs", "ipairs", "select", "next",
  "setmetatable", "getmetatable", "rawget", "rawset", "rawequal", "rawlen", "unpack",
  "require", "_G", "_VERSION", "string", "table", "math", "os", "utf8",
  "OnInit", "OnStart", "OnEnable", "OnDisable", "OnUpdate", "OnLevelUpdate", "OnDestroy",
]);

function checkSyntax(file, src) {
  try {
    const ast = luaparse.parse(src, {
      luaVersion: "5.3",
      locations: true,
      scope: false,
      comments: false,
    });
    return { ok: true, ast };
  } catch (e) {
    const line = e.line || 0, col = e.column || 0;
    const lines = src.split(/\r?\n/);
    const ctx = [];
    for (let i = Math.max(1, line - 2); i <= Math.min(lines.length, line + 1); i++) {
      ctx.push(`${i === line ? ">>" : "  "} ${i}| ${lines[i - 1]}`);
    }
    return { ok: false, msg: `${e.message} (第 ${line} 行, 第 ${col} 列)`, ctx: ctx.join("\n") };
  }
}

// 走 AST，按源码顺序收集「局部函数定义点」与「调用点」，检查先用后定义
function checkLocalOrder(src) {
  // 简易但够用：正则扫 `local function NAME`，以及 `NAME(` 调用处。
  // 精确到作用域要靠完整语义分析，这里只抓「模块级 local function」（行首无缩进或有缩进都算，
  // 但要求该名字在本文件里被 local 定义过至少一次），是经验上最有效的筛查。
  const lines = src.split(/\r?\n/);
  const defLine = new Map();   // name -> 定义行号（取第一次）
  const localNames = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*local\s+function\s+([A-Za-z_]\w*)/);
    if (m) {
      if (!defLine.has(m[1])) defLine.set(m[1], i + 1);
      localNames.add(m[1]);
    }
    // local x, y = ... 形式（含 local a = ...）
    const m2 = lines[i].match(/^\s*local\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(=|$)/);
    if (m2 && !/^\s*local\s+function/.test(lines[i])) {
      for (const n of m2[1].split(",")) localNames.add(n.trim());
    }
  }
  const problems = [];
  for (const [name, def] of defLine) {
    const re = new RegExp(`(^|[^\\w.:])${name}\\s*\\(`, "g");
    for (let i = 0; i < lines.length; i++) {
      if (i + 1 === def) continue;                 // 定义行本身
      if (i + 1 > def) continue;                   // 定义之后的调用一律合法
      const l = lines[i];
      if (/^\s*--/.test(l)) continue;              // 注释行
      // 去掉行内注释再判（避免注释里提到函数名误报）
      const code = l.replace(/--\[\[[\s\S]*?\]\]/g, "").replace(/--.*$/, "");
      re.lastIndex = 0;
      // 排除「名字前面有 local / function」这种本来就是在定义的情形
      if (new RegExp(`local\\s+function\\s+${name}\\b`).test(code)) continue;
      if (re.test(code)) {
        problems.push(`${name} 在第 ${i + 1} 行被调用，但定义在第 ${def} 行（local 先声明后使用）`);
      }
    }
  }
  return problems;
}

function checkSections(src) {
  const want = [
    "第 1 区：CONFIG", "第 2 区：LOG", "第 3 区：RULES", "第 4 区：LAYOUT",
    "第 5 区：FACTORY", "第 6 区：UI", "第 7 区：GAME", "第 8 区：INPUT",
    "第 9 区：NET", "第 10 区：LIFECYCLE", "第 11 区：SELFTEST",
  ];
  const out = [];
  let last = -1;
  for (const w of want) {
    const idx = src.indexOf(w);
    if (idx < 0) { out.push(`缺少分区标题：${w}`); continue; }
    if (idx < last) out.push(`分区顺序错乱：${w}`);
    last = idx;
  }
  return out;
}

function checkGlobals(src) {
  // 抓「未加 local 就赋值」的模块级全局：行首 `NAME = ` / `function NAME(`
  const lines = src.split(/\r?\n/);
  const bad = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s/.test(l)) continue;                       // 缩进的是块内
    if (/^\s*--/.test(l)) continue;
    const code = l.replace(/--.*$/, "");
    const m = code.match(/^([A-Za-z_]\w*)\s*=/);
    if (m && !PLATFORM.has(m[1])) bad.push(`第 ${i + 1} 行：全局赋值 ${m[1]}`);
    const m2 = code.match(/^function\s+([A-Za-z_]\w*)\s*\(/);
    if (m2 && !PLATFORM.has(m2[1])) bad.push(`第 ${i + 1} 行：全局函数 ${m2[1]}`);
  }
  return bad;
}

function checkFeature(src, label) {
  const hit = (re) => re.test(src);
  // 「浅色主题是否真的落地」不能靠搜「浅色」二字（老注释里也有），
  // 要直接读 CONFIG.COLOR 的 BG_TOP 数值：深色主题是低明度，浅色主题应是高明度。
  const bgTop = src.match(/BG_TOP\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  let themeVerdict = "未找到 BG_TOP";
  if (bgTop) {
    const lum = 0.2126 * +bgTop[1] + 0.7152 * +bgTop[2] + 0.0722 * +bgTop[3];
    themeVerdict = `BG_TOP={${bgTop[1]},${bgTop[2]},${bgTop[3]}} 感知亮度 ${lum.toFixed(0)} → ${
      lum > 150 ? "浅色主题 ✓" : "深色主题 ✗（未改）"}`;
  }
  const rows = [
    ["CONFIG.SFX 音效表", /SFX\s*=\s*\{/],
    ["sfx_play 调用", /sfx_play\s*\(/],
    ["PlayAudio2D 能力探测", /PlayAudio2D/],
    // 【v1.10 修正】原正则写的是 .painted / slot.dirty / needsPaint，而实际实现用的是
    // anim_mark_dirty / ANIM.dirty / anim_take_dirty / render_pieces(onlySlots)，
    // 三选一都匹配不上 → 明明实现了却报「无」。改为覆盖真实标识符。
    ["脏槽位重绘", /anim_mark_dirty|anim_take_dirty|ANIM\.dirty|needsRepaint|onlySlots|render_pieces\s*\(\s*\w+\s*,/i],
    ["主题明度", null],
  ];
  return rows.map(([k, re]) => (re ? `${hit(re) ? "有" : "无"}  ${k}` : `—  ${k}：${themeVerdict}`));
}

// ---------- 主流程 ----------
const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS;
let fatal = 0;

for (const rel of targets) {
  const file = path.isAbsolute(rel) ? rel : path.join("D:/输出目录/国际象棋", rel);
  console.log(`\n===== ${rel} =====`);
  if (!fs.existsSync(file)) { console.log("文件不存在，跳过"); continue; }
  const src = fs.readFileSync(file, "utf8");
  console.log(`行数 ${src.split(/\r?\n/).length}，字节 ${Buffer.byteLength(src, "utf8")}`);

  const syn = checkSyntax(file, src);
  if (!syn.ok) {
    console.log(`✗ 语法错误：${syn.msg}`);
    console.log(syn.ctx);
    fatal++;
    continue;
  }
  console.log("✓ 语法（Lua 5.3 解析通过）");

  const sec = checkSections(src);
  console.log(sec.length ? "✗ 分区问题：\n  " + sec.join("\n  ") : "✓ 十一个分区齐全且顺序正确");
  if (sec.length) fatal++;

  const ord = checkLocalOrder(src);
  console.log(ord.length
    ? "✗ 先用后定义：\n  " + ord.slice(0, 20).join("\n  ")
    : "✓ 局部函数无「先用后定义」");
  if (ord.length) fatal++;

  const g = checkGlobals(src);
  console.log(g.length
    ? "⚠ 可疑全局赋值（人工确认）：\n  " + g.slice(0, 20).join("\n  ")
    : "✓ 无多余全局赋值");

  console.log("— 关键特性 —\n  " + checkFeature(src).join("\n  "));
}

console.log(`\n${fatal === 0 ? "全部通过" : `${fatal} 项致命问题`}`);
process.exit(fatal === 0 ? 0 : 1);
