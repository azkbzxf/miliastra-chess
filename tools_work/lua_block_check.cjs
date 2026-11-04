// tools_work/lua_block_check.cjs
// 无依赖的 Lua 块结构静态检查：剥离注释与字符串后，配对 function/if/for/while/do/repeat/end。
// 用途：在没有 Lua 解释器可调用的环境里，至少证明「块结构没被补丁打歪」。
// 用法：node tools_work/lua_block_check.cjs <lua 文件路径>
const fs = require("fs");

const file = process.argv[2];
if (!file) { console.error("用法: node lua_block_check.cjs <file.lua>"); process.exit(2); }
const src = fs.readFileSync(file, "utf8");

// ---------- 1. 剥离注释与字符串字面量（保留换行以便报行号）----------
function stripLua(code) {
  let out = "";
  let i = 0;
  const n = code.length;
  let line = 1;
  const lineOf = () => line;

  const pushBlank = (s) => {
    for (const ch of s) { if (ch === "\n") { out += "\n"; line++; } else out += " "; }
  };

  while (i < n) {
    const c = code[i];
    // 长括号 [[ ... ]] / [=[ ... ]=]
    if (c === "[" ) {
      const m = /^\[(=*)\[/.exec(code.slice(i));
      if (m) {
        const close = "]" + m[1] + "]";
        const endIdx = code.indexOf(close, i + m[0].length);
        const stop = endIdx === -1 ? n : endIdx + close.length;
        pushBlank(code.slice(i, stop));
        i = stop;
        continue;
      }
    }
    // 注释
    if (c === "-" && code[i + 1] === "-") {
      const m = /^--\[(=*)\[/.exec(code.slice(i));
      if (m) {
        const close = "]" + m[1] + "]";
        const endIdx = code.indexOf(close, i + m[0].length);
        const stop = endIdx === -1 ? n : endIdx + close.length;
        pushBlank(code.slice(i, stop));
        i = stop;
        continue;
      }
      // 行注释
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      pushBlank(code.slice(i, j));
      i = j;
      continue;
    }
    // 字符串
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") { j += 2; continue; }
        if (code[j] === c) { j++; break; }
        if (code[j] === "\n") break;
        j++;
      }
      pushBlank(code.slice(i, j));
      i = j;
      continue;
    }
    if (c === "\n") line++;
    out += c;
    i++;
  }
  return { code: out };
}

const stripped = stripLua(src).code;

// ---------- 2. 逐词扫描块结构 ----------
// 只关心顶层关键字；用词边界匹配
const tokens = [];
{
  const re = /\b(function|if|then|elseif|else|end|for|while|do|repeat|until|return)\b/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const before = stripped.slice(0, m.index);
    const line = before.split("\n").length;
    tokens.push({ kw: m[1], line, idx: m.index });
  }
}

// 计算每行是否处于语句起始（用于区分 `x = function() end` 与 `end` 收尾）
// 简化策略：function/if/for/while/repeat 开块；then/do 不额外开（已被其头关键字覆盖）；
// end/until 关块。注意 `elseif` 是 if 的中继，不改变深度。
let depth = 0;
const errors = [];
const stack = [];

function top() { return stack.length ? stack[stack.length - 1] : null; }

for (const t of tokens) {
  switch (t.kw) {
    case "function":
      stack.push({ kw: "function", line: t.line }); depth++;
      break;
    case "if":
      stack.push({ kw: "if", line: t.line }); depth++;
      break;
    case "for":
    case "while":
      stack.push({ kw: t.kw, line: t.line }); depth++;
      break;
    case "repeat":
      stack.push({ kw: "repeat", line: t.line }); depth++;
      break;
    case "do":
      // `for ... do` / `while ... do` 的 do 已经被 for/while 计入，不再开块。
      // 裸 `do ... end` 才开块。判据：前一个非空 token 是否是 for/while。
      break;
    case "end":
      if (stack.length === 0) { errors.push(`第 ${t.line} 行出现多余的 end`); }
      else { stack.pop(); depth--; }
      break;
    case "until":
      if (stack.length === 0 || top().kw !== "repeat") {
        errors.push(`第 ${t.line} 行的 until 没有对应的 repeat（栈顶=${top() ? top().kw : "空"}`);
      } else { stack.pop(); depth--; }
      break;
    default:
      break;
  }
}

if (stack.length > 0) {
  errors.push(`结尾还有 ${stack.length} 个未闭合的块：` +
    stack.slice(-6).map(s => `${s.kw}@${s.line}`).join(", "));
}

// ---------- 3. 附加检查：local function 先声明后使用（仅顶层简单检查）----------
// 列出所有顶层 `local function NAME` 的行号，以及所有对 NAME 的调用行号，
// 报告「调用行早于声明行」的项（这类在 Lua 里会变成 nil 调用）。
const declaredAt = new Map();
for (const m of stripped.matchAll(/\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
  const line = stripped.slice(0, m.index).split("\n").length;
  if (!declaredAt.has(m[1])) declaredAt.set(m[1], line);
}
// 前向声明的写法：`local NAME`（不带 function），也当作已声明
for (const m of stripped.matchAll(/\blocal\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|$|,)/gm)) {
  const line = stripped.slice(0, m.index).split("\n").length;
  if (!declaredAt.has(m[1])) declaredAt.set(m[1], line);
}
const forwardUse = [];
for (const [name, declLine] of declaredAt) {
  const callRe = new RegExp("\\b" + name + "\\s*\\(", "g");
  for (const m of stripped.matchAll(callRe)) {
    const line = stripped.slice(0, m.index).split("\n").length;
    // 声明行自身不算
    if (line === declLine) continue;
    if (line < declLine) {
      forwardUse.push(`${name}: 第 ${line} 行调用，但声明在第 ${declLine} 行`);
    }
  }
}

// ---------- 输出 ----------
console.log("=== Lua 块结构静态检查 ===");
console.log("文件: " + file);
console.log("行数: " + src.split("\n").length);
console.log("块结构: " + (errors.length === 0 ? "OK（全部配对）" : errors.length + " 处问题"));
for (const e of errors) console.log("  BLOCK_ERR " + e);
console.log("前向引用: " + (forwardUse.length === 0 ? "OK（无先调用后声明）" : forwardUse.length + " 处"));
for (const f of forwardUse.slice(0, 40)) console.log("  FWD_USE " + f);
if (forwardUse.length > 40) console.log("  ... 还有 " + (forwardUse.length - 40) + " 条");

const bad = errors.length + forwardUse.length;
process.exit(bad === 0 ? 0 : 2);
