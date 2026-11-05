#!/usr/bin/env node
// tests/static_checks.cjs
// ---------------------------------------------------------------------------
// 国际象棋（千星奇域 2D+Lua）· GitHub issue #1 的静态不变量检查
//
// 用法：
//   node tests/static_checks.cjs              # 打印 PASS/FAIL 明细 + 汇总
//   node tests/static_checks.cjs --verbose    # 额外打印每个检查抽到的原始片段
//   node tests/static_checks.cjs --root=DIR   # 换一个根目录（同结构），用于复跑历史基线
//
// 约定：
//   · 每项打印 `PASS CHECK-n 名称: 详情` / `FAIL CHECK-n 名称: 详情`；
//   · 末尾打印汇总；有任一 FAIL 时进程退出码 1（可直接当门禁用）；
//   · 只读 lua/ sim/ out/，绝不写任何文件；
//   · 零 npm 依赖：luaparse 复用项目里已有的 tools_work/tmp/jscheck 那份，
//     取不到时 CHECK-1 自动降级为纯文本块配平检查并在输出里标注「降级」。
//
// --root 是做什么的：
//   本轮的「修复前 Red 证据」需要在**旧代码**上跑一次，而工作区里的
//   lua/levelScript.lua 正在被别人同时修改。用
//     node tests/static_checks.cjs --root=<另存的一份旧树>
//   就能复跑同一套断言，基线可复现、不会随工作区漂移。
//   注意 --root 只改「读哪里」，luaparse 仍然从本仓库的 tools_work 取。
//
// 为什么用静态检查做 Red 证据：
//   issue #1 的 5 条里有 4 条（特效错位 / 旋转残留 / 面板重叠 / 棋影）都能写成
//   一个精确的源码不变量 —— 代码一改回旧写法立刻变红，不必等模拟器，信号最快。
//
// 关于「读真实代码」：
//   本项目注释比代码还多，纯正则搜关键字会大量误伤（注释里到处是「投影」「旋转」）。
//   所以这里自带一个够用的 Lua 词法扫描器：抹注释/字符串后按 token + 块栈分析，
//   能精确定位「某个函数的函数体」「某条语句是否被 if/for 包裹」。
// ---------------------------------------------------------------------------

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--root="));
  if (arg) return path.resolve(arg.slice("--root=".length));
  return path.resolve(__dirname, "..");
})();
const VERBOSE = process.argv.includes("--verbose");

// luaparse 永远从**本仓库**取（--root 只换被测数据，不换工具）
const TOOL_ROOT = path.resolve(__dirname, "..");

const FILES = {
  lua: "lua/levelScript.lua",
  sim: "sim/levelScript.lua",
  out: "out/交付包/levelScript.lua",
};

// ===========================================================================
// 0. Lua 词法扫描器（抹注释 / 抹字符串 / token 化 / 块栈）
// ===========================================================================

// 判断 i 处是否是长括号起始（[[ / [=[ / [==[ …），返回 { eq, len } 或 null
function longBracketAt(src, i) {
  if (src[i] !== "[") return null;
  let j = i + 1;
  let eq = 0;
  while (src[j] === "=") { eq += 1; j += 1; }
  if (src[j] !== "[") return null;
  return { eq, len: j - i + 1 };
}

// stripComments=true 时挖掉注释；stripStrings=true 时连字符串一起挖。
// 挖空一律写空格，**保留长度与换行**，因此输出与原文字符下标一一对应。
function blankLua(src, { comments = true, strings = true } = {}) {
  const out = src.split("");
  const n = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) {
      if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
    }
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (comments && c === "-" && src[i + 1] === "-") {
      const lb = longBracketAt(src, i + 2);
      if (lb) {
        const close = "]" + "=".repeat(lb.eq) + "]";
        const end = src.indexOf(close, i + 2 + lb.len);
        const stop = end < 0 ? n : end + close.length;
        blank(i, stop);
        i = stop;
        continue;
      }
      const nl = src.indexOf("\n", i);
      const stop = nl < 0 ? n : nl;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === "[" ) {
      const lb = longBracketAt(src, i);
      if (lb) {
        const close = "]" + "=".repeat(lb.eq) + "]";
        const end = src.indexOf(close, i + lb.len);
        const stop = end < 0 ? n : end + close.length;
        if (strings) blank(i, stop);
        // 但注释关闭的判断要先做：长注释已在上面的分支处理，这里只可能是长字符串
        i = stop;
        continue;
      }
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) { j += 1; break; }
        j += 1;
      }
      if (strings) blank(i, j);
      i = j;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

const KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then",
  "true", "until", "while",
]);

// token 化（输入必须是 blankLua(...,{strings:true}) 之后的串）
function tokenize(code) {
  const toks = [];
  const n = code.length;
  let i = 0;
  let line = 1;
  while (i < n) {
    const c = code[i];
    if (c === "\n") { line += 1; i += 1; continue; }
    if (c === " " || c === "\t" || c === "\r") { i += 1; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(code[j])) j += 1;
      const w = code.slice(i, j);
      toks.push({ t: KEYWORDS.has(w) ? "kw" : "name", v: w, i, line });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] || ""))) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxX.]/.test(code[j])) j += 1;
      toks.push({ t: "num", v: code.slice(i, j), i, line });
      i = j;
      continue;
    }
    toks.push({ t: "op", v: c, i, line });
    i += 1;
  }
  return toks;
}

// 为每个 token 记录：所在块栈深度、是否处在 if/for/while/repeat/do 内
function annotateBlocks(toks) {
  const depthAt = new Array(toks.length).fill(0);
  const inCondAt = new Array(toks.length).fill(false);
  const stack = [];   // 元素：{ kind, awaitingDo }
  const inCond = () => stack.some((b) => b.kind !== "function");

  for (let k = 0; k < toks.length; k += 1) {
    depthAt[k] = stack.length;
    inCondAt[k] = inCond();
    const tok = toks[k];
    if (tok.t !== "kw") continue;
    const w = tok.v;
    if (w === "function") { stack.push({ kind: "function", awaitingDo: false }); continue; }
    if (w === "for" || w === "while") { stack.push({ kind: w, awaitingDo: true }); continue; }
    if (w === "do") {
      const top = stack[stack.length - 1];
      if (top && top.awaitingDo) { top.awaitingDo = false; }
      else stack.push({ kind: "do", awaitingDo: false });
      continue;
    }
    if (w === "if") { stack.push({ kind: "if", awaitingDo: false }); continue; }
    if (w === "repeat") { stack.push({ kind: "repeat", awaitingDo: false }); continue; }
    if (w === "elseif" || w === "else" || w === "then" || w === "in") continue;
    if (w === "end" || w === "until") { stack.pop(); continue; }
  }
  return { depthAt, inCondAt };
}

let _cache = null;
function analyze(src) {
  if (_cache && _cache.src === src) return _cache;
  const code = blankLua(src, { comments: true, strings: true });
  const toks = tokenize(code);
  const { depthAt, inCondAt } = annotateBlocks(toks);
  _cache = { src, code, toks, depthAt, inCondAt };
  return _cache;
}

// 取某个顶层/局部函数的**全部**定义（同名可有多处，见 findFunctionAll 的说明）
function findFunctionAll(toks, name) {
  const out = [];
  for (let k = 0; k < toks.length; k += 1) {
    const tok = toks[k];
    if (!(tok.t === "kw" && tok.v === "function")) continue;
    // function NAME(  或  function A.B.C(  或  local function NAME(
    let j = k + 1;
    let seen = "";
    while (j < toks.length && (toks[j].t === "name" || (toks[j].t === "op" && toks[j].v === "."))) {
      if (toks[j].t === "name") seen = toks[j].v;
      j += 1;
    }
    if (seen !== name) continue;
    if (!(toks[j] && toks[j].t === "op" && toks[j].v === "(")) continue;
    // 跳过参数列表
    let paren = 0;
    let p = j;
    for (; p < toks.length; p += 1) {
      if (toks[p].t === "op" && toks[p].v === "(") paren += 1;
      else if (toks[p].t === "op" && toks[p].v === ")") { paren -= 1; if (paren === 0) break; }
    }
    const bodyStartTok = p + 1;
    let d = 1;             // 已进入 function 块
    const stack = [{ kind: "function", awaitingDo: false }];
    for (let q = bodyStartTok; q < toks.length; q += 1) {
      const t = toks[q];
      if (t.t !== "kw") continue;
      const w = t.v;
      if (w === "function") { stack.push({ kind: "function", awaitingDo: false }); d += 1; continue; }
      if (w === "for" || w === "while") { stack.push({ kind: w, awaitingDo: true }); d += 1; continue; }
      if (w === "do") {
        const top = stack[stack.length - 1];
        if (top && top.awaitingDo) top.awaitingDo = false;
        else { stack.push({ kind: "do", awaitingDo: false }); d += 1; }
        continue;
      }
      if (w === "if") { stack.push({ kind: "if", awaitingDo: false }); d += 1; continue; }
      if (w === "repeat") { stack.push({ kind: "repeat", awaitingDo: false }); d += 1; continue; }
      if (w === "elseif" || w === "else" || w === "then" || w === "in") continue;
      if (w === "end" || w === "until") {
        stack.pop();
        d -= 1;
        if (d === 0) {
          out.push({
            name,
            headerTok: k,
            bodyStartTok,
            endTok: q,
            bodyStart: toks[bodyStartTok] ? toks[bodyStartTok].i : 0,
            bodyEnd: t.i,
            // 「函数体第一行」= 参数列表右括号所在行（bodyStartTok-1 就是那个 ')'）
            firstLine: toks[bodyStartTok - 1] ? toks[bodyStartTok - 1].line : toks[k].line,
            headerLine: toks[k].line,
          });
          break;
        }
        continue;
      }
    }
  }
  return out;
}

// 取某个函数**生效的**那一份定义。
//
// 【为什么不能只取第一份】v1.11 修复时一度在文件里留下了两份 `local function image_apply`
// —— 旧的条件写法在前、新的缓存写法在后。Lua 里后一份覆盖前一份（同一个 local 作用域内
// 重复 local 声明会遮蔽前者），所以**真正生效的是最后一份**。
// 若检查器取第一份，就会出现「代码已经修好、检查却一直红」的误报（本轮实际踩到）。
// 因此这里统一取最后一份，并由 CHECK-0 单独把「同名重复定义」报出来。
function findFunction(toks, name) {
  const all = findFunctionAll(toks, name);
  return all.length ? all[all.length - 1] : null;
}

function bodyText(src, fn) {
  if (!fn) return null;
  return src.slice(fn.bodyStart, fn.bodyEnd);
}

function readText(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error("文件不存在: " + rel);
  return fs.readFileSync(abs, "utf8");
}

function countLines(s) {
  const parts = s.split("\n");
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts.length;
}

// ===========================================================================
// 结果收集
// ===========================================================================
const results = [];
function record(id, name, ok, detail) {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}: ${detail}`);
}
function info(msg) { console.log(`     · ${msg}`); }
function vinfo(msg) { if (VERBOSE) console.log(`     [v] ${msg}`); }

// ===========================================================================
// CHECK-1 语法：三份文件都能被 luaparse 以 Lua 5.3 解析
// ===========================================================================
function loadLuaparse() {
  try {
    return require(path.join(TOOL_ROOT, "tools_work", "tmp", "jscheck", "node_modules", "luaparse"));
  } catch (e) {
    return null;
  }
}

function checkSyntax(FILE_TEXT, luaparse) {
  const bad = [];
  const notes = [];
  for (const [, rel] of Object.entries(FILES)) {
    const src = FILE_TEXT[rel];
    if (luaparse) {
      try {
        luaparse.parse(src, { luaVersion: "5.3", locations: true, scope: false, comments: false });
        notes.push(`${rel} ✓`);
      } catch (e) {
        bad.push(`${rel} ✗ ${e.message}（第 ${e.line || "?"} 行）`);
      }
    } else {
      // 降级：块配平
      const a = analyze(src);
      const last = a.toks.length ? a.depthAt[a.toks.length - 1] : 0;
      if (last === 0) notes.push(`${rel} ✓（降级：token 块配平归零）`);
      else bad.push(`${rel} ✗ 块未配平（残留深度 ${last}）`);
    }
  }
  const mode = luaparse ? "luaparse Lua 5.3" : "降级：token 块配平（luaparse 不可用）";
  if (bad.length) return { ok: false, detail: `${mode}｜` + bad.join("；") };
  return { ok: true, detail: `${mode}｜${notes.join("，")}` };
}

// ===========================================================================
// CHECK-2 三份文件一致：剥注释 + 去掉 4 个模板索引行后逐行相同
//   剥离规则与 tools_work/sync_sim_copy.cjs 的一致性校验逐条同义，
//   避免「生成器认一致、测试认不一致」这种自相矛盾。
// ===========================================================================
const INDEX_LINE_RE = /^\s*(CONTAINER_NODE_INDEX|PREFAB_TEXT_BOX|PREFAB_CURSOR_AREA|PREFAB_IMAGE)\s*=/;

function stripForCompare(s) {
  return s
    .split("\n")
    .map((l) => l.replace(/\s*--.*$/, ""))
    .filter((l) => !/^\s*--/.test(l))
    .filter((l) => l.trim() !== "")
    .filter((l) => !INDEX_LINE_RE.test(l))
    .join("\n");
}

function checkTripleConsistent(FILE_TEXT) {
  const a = stripForCompare(FILE_TEXT[FILES.lua]).split("\n");
  const b = stripForCompare(FILE_TEXT[FILES.sim]).split("\n");
  const c = stripForCompare(FILE_TEXT[FILES.out]).split("\n");
  const problems = [];
  const pair = (x, y, nx, ny) => {
    if (x.length !== y.length) problems.push(`${nx} ${x.length} 行 vs ${ny} ${y.length} 行`);
    const lim = Math.max(x.length, y.length);
    for (let i = 0; i < lim; i += 1) {
      if (x[i] !== y[i]) {
        problems.push(
          `首处差异 代码行 ${i + 1}：${nx}=${JSON.stringify((x[i] || "").slice(0, 60))} ｜ ${ny}=${JSON.stringify((y[i] || "").slice(0, 60))}`
        );
        return;
      }
    }
  };
  pair(a, b, "lua", "sim");
  pair(a, c, "lua", "out");
  if (problems.length) {
    return {
      ok: false,
      detail: problems.join("；") +
        "｜修法：改完 lua/levelScript.lua 后先跑 `node tools_work/sync_sim_copy.cjs`（→ sim/）" +
        "与 `node tools_work/sync_delivery.cjs`（→ out/交付包/），两份副本都是脚本生成的，不要手改",
    };
  }
  return { ok: true, detail: `三份一致（各 ${a.length} 行有效代码；已剥注释与 4 个模板索引行）` };
}

// ===========================================================================
// CHECK-0 同名函数不得在同一作用域内重复定义
//   Lua 里同一作用域内重复 `local function NAME` 会**静默覆盖**：后一份生效，
//   前一份成了死代码，不报错、不警告。本项目 v1.11 修复时实际发生过
//   （image_apply 在旧位置留了一份条件写法的副本，新写法在下面），
//   死代码不仅误导阅读，还会让静态检查取错定义 —— 必须先于语义检查报出来。
//
//   【必须是「同作用域」才算重名】不同函数内部各自 `local function sqname`
//   是常规写法（RULES.uci_of 与 move_text 各有一份），互不影响，不能误报。
//   所以按「最近的外层函数」分组：同一外层函数内重名才算重复。
//
//   【作用域判定优先用 AST】手搓块栈在这里很脆（for/while 自带 do、if/then/end
//   的配对、repeat/until 的闭合方向都不同），实测会把模块级误标成「外层函数内」。
//   所以有 luaparse 就按 AST 走（FunctionDeclaration 节点自带 loc 与 isLocal），
//   没有才退回 token 扫描（结论仍正确，只是位置标注可能粗）。
// ===========================================================================
function checkDuplicateFunctionsByAst(src, luaparse) {
  const ast = luaparse.parse(src, { luaVersion: "5.3", locations: true, scope: false, comments: false });
  // groups: key = 作用域 id + 名字；同一作用域内同名 ≥2 次即重复
  const groups = new Map();
  let scopeSeq = 0;

  function visit(node, scopeId) {
    if (!node || typeof node !== "object") return;

    // 这个节点本身若是 local function，先记进**当前**作用域（不是它自己的新作用域）
    if (node.type === "FunctionDeclaration" && node.isLocal === true
        && node.identifier && node.identifier.name) {
      const name = node.identifier.name;
      const line = node.loc ? node.loc.start.line : 0;
      const key = scopeId + "\u0000" + name;
      if (!groups.has(key)) groups.set(key, { name, scopeId, defs: [] });
      groups.get(key).defs.push(line);
    }

    // 函数体内部是一个新的作用域
    const innerScope = node.type === "FunctionDeclaration" ? ++scopeSeq : scopeId;

    for (const k of Object.keys(node)) {
      if (k === "loc") continue;
      const v = node[k];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (!item || typeof item !== "object") continue;
          // 参数列表里的标识符不是声明，直接跳过
          visit(item, innerScope);
        }
      } else if (v && typeof v === "object") {
        visit(v, innerScope);
      }
    }
  }
  visit(ast, 0);

  const dups = [...groups.values()].filter((g) => g.defs.length > 1);
  if (dups.length) {
    return {
      ok: false,
      detail: "同一作用域内同名 local function 重复定义（后一份静默覆盖前一份，前一份是死代码）：" +
        dups.map((g) => `${g.name} @ 第 ${g.defs.join("、")} 行` + (g.scopeId === 0 ? "（模块级）" : "（同一外层函数内）")).join("；"),
    };
  }
  return { ok: true, detail: `${groups.size} 个 local function 名字，按 AST 作用域分组后无重名` };
}

function checkDuplicateFunctions(src, luaparse) {
  if (luaparse) {
    try {
      return checkDuplicateFunctionsByAst(src, luaparse);
    } catch (e) {
      // AST 解析失败时退回 token 扫描（语法错由 CHECK-1 报，这里不重复报）
    }
  }
  const A = analyze(src);
  // 为每个 token 记下「最近的外层 function 头 token 下标」，模块级为 -1
  const ownerAt = new Array(A.toks.length).fill(-1);
  const fstack = [];
  for (let k = 0; k < A.toks.length; k += 1) {
    const t = A.toks[k];
    ownerAt[k] = fstack.length ? fstack[fstack.length - 1] : -1;
    if (t.t !== "kw") continue;
    const w = t.v;
    if (w === "function") {
      // 先按「上一个 token 是 local」判定它是不是 local function，再压栈
      fstack.push(k);
      continue;
    }
    if (w === "for" || w === "while") { fstack.push(-2); continue; }   // 非函数块用 -2 占位
    if (w === "do" || w === "if" || w === "repeat") { fstack.push(-2); continue; }
    if (w === "end" || w === "until") { fstack.pop(); continue; }
    if (w === "elseif" || w === "then" || w === "else" || w === "in") continue;
  }

  const groups = new Map();   // `${ownerToken}\u0000${name}` → [定义…]
  for (let k = 0; k < A.toks.length; k += 1) {
    const t = A.toks[k];
    if (!(t.t === "kw" && t.v === "function")) continue;
    const isLocal = A.toks[k - 1] && A.toks[k - 1].t === "kw" && A.toks[k - 1].v === "local";
    if (!isLocal) continue;
    const nameTok = A.toks[k + 1];
    if (!nameTok || nameTok.t !== "name") continue;
    if (!(A.toks[k + 2] && A.toks[k + 2].t === "op" && A.toks[k + 2].v === "(")) continue;
    // 这个 function 的外层作用域：它自己压栈之前栈顶
    let owner = -1;
    // 重算该 token 的 owner：用「压栈前的栈顶」—— 直接数它前面未闭合的 function 头
    let depth = 0;
    for (let q = 0; q < k; q += 1) {
      const u = A.toks[q];
      if (u.t !== "kw") continue;
      if (u.v === "function" || u.v === "for" || u.v === "while" || u.v === "do" || u.v === "if" || u.v === "repeat") depth += 1;
      else if (u.v === "end" || u.v === "until") depth -= 1;
    }
    void depth;
    // owner 用「外层 function 头」精确算：向前找第一个未闭合的 function
    const stack = [];
    for (let q = 0; q < k; q += 1) {
      const u = A.toks[q];
      if (u.t !== "kw") continue;
      if (u.v === "function") stack.push(q);
      else if (u.v === "for" || u.v === "while") stack.push(-2);
      else if (u.v === "do" || u.v === "if" || u.v === "repeat") stack.push(-2);
      else if (u.v === "end" || u.v === "until") stack.pop();
    }
    owner = stack.length ? stack[stack.length - 1] : -1;

    const key = owner + "\u0000" + nameTok.v;
    if (!groups.has(key)) groups.set(key, []);
    // owner 是「外层 function 的 token 下标」；-1 表示模块级。
    // 但 for/while/do/if 块用 -2 占位，所以 owner 为 -2 也代表「模块级（非函数作用域）」。
    groups.get(key).push({ name: nameTok.v, line: t.line, owner });
  }

  const dupEntries = [...groups.values()].filter((list) => list.length > 1);
  if (dupEntries.length) {
    return {
      ok: false,
      detail: "同一作用域内同名 local function 重复定义（后一份静默覆盖前一份，前一份是死代码）：" +
        dupEntries
          .map((list) => {
            const owner = list[0].owner;
            const where = owner === -1 || owner === -2 ? "模块级" : `外层函数@第 ${A.toks[owner] ? A.toks[owner].line : "?"} 行内`;
            return `${list[0].name} @ 第 ${list.map((x) => x.line).join("、")} 行（${where}）`;
          })
          .join("；"),
    };
  }
  const total = [...groups.values()].reduce((n, l) => n + l.length, 0);
  return { ok: true, detail: `${total} 个 local function 定义，按作用域分组后无重名` };
}

// ===========================================================================
// CHECK-3 无棋影：paint_slot 函数体内不得再出现 PIECE_SHADOW 或阴影绘制
//   允许 PIECE_SHADOW 作为 CONFIG.COLOR 的历史字段存在，函数体内不许有。
// ===========================================================================
function checkNoPieceShadow(src) {
  const A = analyze(src);
  const fn = findFunction(A.toks, "paint_slot");
  if (!fn) return { ok: false, detail: "找不到 paint_slot 函数体（被重命名或删除了？）" };
  const body = bodyText(src, fn);

  const lines = body.split("\n");
  const hits = [];
  let cur = fn.firstLine;
  for (let i = 0; i < lines.length; i += 1) {
    // 里层字符串/注释同样要抹掉，否则注释里写「投影」也算命中
    const code = blankLua(lines[i], { comments: true, strings: true });
    if (!code.trim()) { continue; }
    if (/\bPIECE_SHADOW(_[A-Z]+)?\b/.test(code) || /\bshadow\b/i.test(code)) {
      hits.push(`第 ${cur + i} 行: ${code.trim().slice(0, 72)}`);
    }
  }
  if (hits.length) {
    return { ok: false, detail: `paint_slot 内仍有 ${hits.length} 处阴影痕迹 → ${hits.join("；")}` };
  }

  // 附带信息（不算失败）：文件里其余位置的 PIECE_SHADOW
  const whole = blankLua(src, { comments: true, strings: false });
  const leftovers = [];
  whole.split("\n").forEach((l, idx) => { if (/PIECE_SHADOW/.test(l)) leftovers.push(`第 ${idx + 1} 行`); });
  const extra = leftovers.length
    ? `｜提示：其余位置仍有 PIECE_SHADOW 定义（${leftovers.slice(0, 4).join("、")}${leftovers.length > 4 ? "…" : ""}，属 COLOR/CONFIG 历史字段，函数体内不得引用）`
    : "";
  return { ok: true, detail: "paint_slot 函数体已无阴影绘制" + extra };
}

// ===========================================================================
// CHECK-4 图元旋转必须「语义上无条件」写入：image_apply
//
//   【本检查的演进，别再退回旧判据】
//   第一版判据是「SetLocalRotation 外包块里不能有 if/for」—— 那是**语法**判据，
//   会把「值缓存」误判成「语义跳过」。v1.11 的实现是：
//       local r = rot or 0
//       if st.rot ~= r then            ← 这个 if 只是「与上次写入的值相同就跳过平台调用」
//         st.rot = r
//         pcall(function() ctrl:SetLocalRotation(0, 0, r) end)
//       end
//   这里的 if 不改变语义：不管 r 是 0 还是 45，只要与缓存不同就会写。
//   真正要防的 bug 是旧写法 `if rot ~= nil and rot ~= 0 then … end` ——
//   rot==0 时**永远不写**，控件保留上一位使用者的角度（issue #1 第 2 条）。
//
//   所以判据改成三条**语义**规则，全部满足才 PASS：
//     ① 不得出现「用 rot 与 0/nil 比较来决定要不要写」的守卫；
//     ② 必须存在「归一化到 0」：`rot or 0`（赋给某个局部量）；
//     ③ 必须存在 `SetLocalRotation(0, 0, <归一化后的量>)` —— 用归一化量，不是裸 rot。
// ===========================================================================
const ROT_GUARD_PATTERNS = [
  // rot ~= 0 / rot ~= nil / rot == 0 / rot > 0 / rot and ... —— 任何「rot 参与判定」的形态
  { re: /\brot\s*[~=<>]=?\s*0\b/, label: "rot 与 0 比较" },
  { re: /\brot\s*~\=\s*nil\b/, label: "rot 与 nil 比较" },
  { re: /\brot\s+and\b/, label: "rot and …（真值判定）" },
  { re: /\bif\s+rot\b/, label: "if rot（真值守卫）" },
  { re: /\bnot\s+rot\b/, label: "not rot" },
];

function checkRotationAlwaysWritten(src) {
  const A = analyze(src);
  const allDefs = findFunctionAll(A.toks, "image_apply");
  if (!allDefs.length) return { ok: false, detail: "找不到 image_apply 函数体" };
  const fn = allDefs[allDefs.length - 1];   // 生效的是最后一份
  const body = bodyText(src, fn);
  const code = blankLua(body, { comments: true, strings: true });

  const missing = [];
  const found = [];

  // ---- ① 不得有「rot 参与判定」的守卫 ----
  const guardHits = [];
  for (const g of ROT_GUARD_PATTERNS) {
    const m = g.re.exec(code);
    if (m) guardHits.push(`${g.label}「${m[0].trim()}」`);
  }
  if (guardHits.length) {
    missing.push(`① 仍存在「用 rot 决定是否写入」的守卫：${guardHits.join("、")}`);
  } else {
    found.push("① 无 rot/0/nil 守卫");
  }

  // ---- ② 必须归一化到 0：local r = rot or 0 ----
  const normM = /\b(?:local\s+)?([A-Za-z_]\w*)\s*=\s*rot\s+or\s+0\b/.exec(code);
  let normVar = null;
  if (!normM) {
    missing.push("② 缺少归一化 `local r = rot or 0`（rot 为 nil 时必须当 0 写）");
  } else {
    normVar = normM[1];
    found.push(`② 归一化 ${normVar} = rot or 0`);
  }

  // ---- ③ SetLocalRotation(0, 0, 归一化量) ----
  const rotWrites = [];
  const rotRe = /\bSetLocalRotation\s*\(\s*0\s*,\s*0\s*,\s*([A-Za-z_]\w*)\s*\)/g;
  let rm;
  while ((rm = rotRe.exec(code)) !== null) rotWrites.push(rm[1]);
  if (!rotWrites.length) {
    // 退一步看有没有 setter 写成 localRotationZ = 某值
    const alt = /\blocalRotationZ\s*=\s*([A-Za-z_]\w*|\d+)/.exec(code);
    if (alt) {
      rotWrites.push(alt[1]);
      found.push(`③ 用字段写 localRotationZ = ${alt[1]}`);
    } else {
      missing.push("③ 缺少 `SetLocalRotation(0, 0, <归一化量>)` —— 旋转根本没被写");
    }
  }
  if (rotWrites.length) {
    const usesNorm = normVar ? rotWrites.includes(normVar) : true;
    if (!usesNorm) {
      missing.push(`③ 写入用的是 ${rotWrites.map((v) => `「${v}」`).join("/")}，不是归一化量「${normVar}」→ rot==nil 时会写非法值`);
    } else {
      found.push(`③ 写入 SetLocalRotation(0, 0, ${normVar})`);
    }
  }

  if (missing.length) {
    return {
      ok: false,
      detail: `image_apply（第 ${fn.headerLine} 行）未满足语义判据：${missing.join("；")}` +
        (allDefs.length > 1 ? `｜注意：文件里有 ${allDefs.length} 份 image_apply 定义（第 ${allDefs.map((d) => d.headerLine).join("、")} 行），本检查针对最后一份＝生效的那份` : ""),
    };
  }

  const dupNote = allDefs.length > 1
    ? `｜提示：有 ${allDefs.length} 份 image_apply 定义（第 ${allDefs.map((d) => d.headerLine).join("、")} 行），后一份覆盖前一份`
    : "";
  return { ok: true, detail: `image_apply 语义已无条件写：${found.join("；")}${dupNote}` };
}

// ===========================================================================
// CHECK-5 落点高亮用格中心：select_square 里 legalHL 的定位必须是「同一对中心变量」
//
//   【本检查的演进，别再退回旧判据】
//   第一版要求块里出现**字面量** `L.cell / 2` 或 `L.cell * 0.5` —— 那是**字面量**判据。
//   v1.11 把中心点提到循环外的 `local cx, cy = tx + L.cell * 0.5, ty + L.cell * 0.5`，
//   两个分支都写 `SetAnchoredPosition(cx, cy)`，语义完全正确，却因为「字面量不在
//   SetAnchoredPosition 那一行」而误报。
//
//   所以判据改成三条**结构化**规则，全部满足才 PASS：
//     ① 两个分支（isCap / 非 isCap）的 SetAnchoredPosition 实参是**同一对**变量，
//        且不得再出现 `tx + (L.cell - d) / 2` 这类左下角补偿式；
//     ② 这对中心变量有定义式 `X = tx + L.cell * 0.5`（或 `/ 2`），Y 同理基于 `ty`；
//     ③ ANIM.hlBase[idx] 记录的 x/y 用的是同一对中心变量（不是 tx/ty、也不是补偿值）。
// ===========================================================================
// 「向左下角补偿」的老公式：形如 (L.cell - d) / 2 或 tx + (…)，都是把中心当左下角用的痕迹
const LOWERLEFT_PATTERNS = [
  { re: /\(\s*L\.cell\s*-\s*[A-Za-z_]\w*\s*\)\s*\/\s*2/, label: "(L.cell - d) / 2" },
  { re: /L\.cell\s*-\s*d\s*\)\s*\/\s*2/, label: "L.cell - d) / 2" },
  { re: /\(\s*L\.cell\s*-\s*[A-Za-z_]\w*\s*\)\s*\*\s*0\.5/, label: "(L.cell - d) * 0.5" },
];

function checkLegalHLUsesCellCenter(src) {
  const A = analyze(src);
  const fn = findFunction(A.toks, "select_square");
  if (!fn) return { ok: false, detail: "找不到 select_square 函数体" };

  // legalHL 代码块：从 UI.legalHL[ 的首次出现，到 UI.legalHLUsed 赋值
  let startTok = -1;
  let endTok = -1;
  for (let k = fn.bodyStartTok; k < fn.endTok; k += 1) {
    const t = A.toks[k];
    if (t.t !== "name") continue;
    if (startTok < 0 && t.v === "legalHL" && A.toks[k + 1] && A.toks[k + 1].v === "[") startTok = k;
    if (t.v === "legalHLUsed") { endTok = k; break; }
  }
  if (startTok < 0 || endTok < 0 || endTok <= startTok) {
    return { ok: false, detail: "select_square 内定位不到 legalHL 代码块（UI.legalHL[...] … UI.legalHLUsed）" };
  }
  const from = A.toks[startTok - 1] ? A.toks[startTok - 1].i : A.toks[startTok].i;
  const to = A.toks[endTok].i;
  const block = src.slice(from, to);
  const blockFirstLine = A.toks[startTok].line;
  const code = blankLua(block, { comments: true, strings: true });

  // ---- ⓪ 先排掉左下角补偿式（出现即 FAIL，这是本 issue 的原始 bug 形态）----
  for (const p of LOWERLEFT_PATTERNS) {
    const m = p.re.exec(code);
    if (m) {
      return {
        ok: false,
        detail: `落点高亮仍用左下角补偿式「${m[0].trim()}」（legalHL 块第 ${blockFirstLine} 行起）→ pivot=0.5 的图片控件会整体偏左下`,
      };
    }
  }

  // ---- ① 收集 SetAnchoredPosition 的实参对 ----
  // 快照时写成 c:SetAnchoredPosition(cx, cy)；分开取实参，允许中间有空格
  const posPairs = [];
  const posRe = /:\s*SetAnchoredPosition\s*\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g;
  let pm;
  while ((pm = posRe.exec(code)) !== null) {
    posPairs.push({ x: pm[1].trim(), y: pm[2].trim(), line: blockFirstLine });
  }
  // 也考虑「不带冒号」的写法（若有人把它抽成局部函数）
  if (!posPairs.length) {
    const posRe2 = /\bSetAnchoredPosition\s*\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g;
    while ((pm = posRe2.exec(code)) !== null) posPairs.push({ x: pm[1].trim(), y: pm[2].trim(), line: blockFirstLine });
  }
  if (!posPairs.length) {
    return { ok: false, detail: `legalHL 块里找不到 SetAnchoredPosition（第 ${blockFirstLine} 行起）` };
  }

  const distinct = new Set(posPairs.map((p) => `${p.x},${p.y}`));
  if (distinct.size !== 1) {
    return {
      ok: false,
      detail: `两个分支的 SetAnchoredPosition 用的不是同一对实参：${[...distinct].map((d) => `「${d}」`).join(" / ")}` +
        ` → 可吃子与空格圆点必须都按格中心定位`,
    };
  }
  const pair = posPairs[0];
  const varName = (s) => /^[A-Za-z_]\w*$/.test(s) ? s : null;
  const cxVar = varName(pair.x);
  const cyVar = varName(pair.y);
  if (!cxVar || !cyVar) {
    return {
      ok: false,
      detail: `SetAnchoredPosition 的实参不是简单变量对（抽到 x=「${pair.x}」 y=「${pair.y}」）→ 无法确认用的是格中心，请先提到局部变量`,
    };
  }

  // ---- ② 中心变量的定义式：X = tx + L.cell * 0.5（或 / 2）----
  //
  // 【必须支持多重赋值】实际写法是 `local cx, cy = tx + L.cell * 0.5, ty + L.cell * 0.5`
  // —— 一个 local 同时定义两个名字。只按「NAME = …」找会漏（踩过）。
  // 所以先把代码里所有 `local a, b, … = e1, e2, …` 展开成 name→expr 映射再查。
  const halfPat = String.raw`L\.cell\s*(?:\*\s*0?\.5|/\s*2)|0?\.5\s*\*\s*L\.cell|L\.cell\s*\/\s*2`;

  const assignMap = new Map();   // 变量名 → 定义表达式（后定义覆盖前定义）
  // 【必须扫整个函数体，不能只扫 legalHL 块】
  //   legalHL 块从 `UI.legalHL[idx]` 起，而中心点是在它**之前**的
  //   `local cx, cy = tx + L.cell * 0.5, …` 定义的（在循环体内、取控件之前）。
  //   只扫块内会看不到这两行 → 误报「未找到定义」（踩过）。
  const scopeCode = blankLua(bodyText(src, fn), { comments: true, strings: true });
  for (const rawLine of scopeCode.split("\n")) {
    const lineTxt = rawLine.trim();
    const declM = /^(?:local\s+)?(.+?)\s*=\s*(.+)$/.exec(lineTxt);
    if (!declM) continue;
    const lhs = splitTopLevel(declM[1]);
    const rhs = splitTopLevel(declM[2]);
    if (!lhs.length || lhs.length !== rhs.length) continue;
    for (let i = 0; i < lhs.length; i += 1) {
      if (/^[A-Za-z_]\w*$/.test(lhs[i])) assignMap.set(lhs[i], rhs[i].trim());
    }
  }

  const halfOn = (expr, baseVar) => {
    if (!expr) return null;
    // expr 形如 `BASE + 半格表达式`
    const m = new RegExp(
      String.raw`^\s*([A-Za-z_]\w*)\s*\+\s*(?:${halfPat})\s*$`
    ).exec(expr);
    if (!m) return null;
    return baseVar ? { base: m[1], ok: m[1] === baseVar } : { base: m[1], ok: true };
  };
  const exprX = assignMap.get(cxVar);
  const exprY = assignMap.get(cyVar);
  // X 必须基于 tx、Y 必须基于 ty（同一格的左下角坐标对）
  const hx = halfOn(exprX);
  const hy = halfOn(exprY);
  if (!hx || !hy) {
    return {
      ok: false,
      detail: `中心变量「${cxVar}, ${cyVar}」缺少「+ 半格」定义式（${cxVar}: ${exprX ? `「${exprX}」不合式` : "未找到定义"} / ` +
        `${cyVar}: ${exprY ? `「${exprY}」不合式` : "未找到定义"}）` +
        ` → 期望形如 \`local ${cxVar}, ${cyVar} = tx + L.cell * 0.5, ty + L.cell * 0.5\``,
    };
  }
  if (hx.base !== "tx" || hy.base !== "ty") {
    return {
      ok: false,
      detail: `中心变量的基点是「${hx.base}, ${hy.base}」而不是格左下角「tx, ty」→ 中心点算错了格子`,
    };
  }

  // ---- ③ ANIM.hlBase[idx] 必须记同一对中心变量 ----
  const hlBaseHits = [];
  const baseRe = /hlBase\s*\[[^\]]*\]\s*=\s*\{([^}]*)\}/g;
  let bm;
  while ((bm = baseRe.exec(code)) !== null) {
    const body2 = bm[1];
    const gx = /\bx\s*=\s*([A-Za-z_]\w*)/.exec(body2);
    const gy = /\by\s*=\s*([A-Za-z_]\w*)/.exec(body2);
    hlBaseHits.push({ x: gx ? gx[1] : null, y: gy ? gy[1] : null, raw: body2.trim().replace(/\s+/g, " ") });
  }
  if (hlBaseHits.length) {
    const bad = hlBaseHits.filter((h) => h.x !== cxVar || h.y !== cyVar);
    if (bad.length) {
      return {
        ok: false,
        detail: `ANIM.hlBase 记录的基准位置与中心变量「${cxVar}, ${cyVar}」不一致 → ` +
          bad.map((h) => `{${h.raw}}（x=${h.x}, y=${h.y}）`).join("；") +
          `｜脉动动画会从错误基准出发，等于中心点修好又被推回去`,
      };
    }
  }

  const baseNote = hlBaseHits.length
    ? `；③ hlBase 记 ${cxVar}/${cyVar}（${hlBaseHits.length} 处）`
    : "；③ 未见 hlBase 记录（跳过）";
  return {
    ok: true,
    detail: `落点高亮按格中心定位：① 两分支同一对实参「${cxVar}, ${cyVar}」` +
      `；② ${cxVar} = ${hx.base} + 半格、${cyVar} = ${hy.base} + 半格${baseNote}`,
  };
}

// ===========================================================================
// CHECK-6 面板不重叠：从 build_panel 抽出 atY(...)/h(...) 小数配对成区间，
//   任意两条「文本 / 底色块」纵向区间不得相交（> ±0.001）。
//
//   坐标归一化：面板内相对值取 px=0, py=0, pw=1, ph=1，
//   于是 atX(r)/atY(r)/w(r)/h(r) 都退化成恒等，cardPad = L.cell*0.10 = 0.0125
//   （L.cell = 面板高/8 —— 因为 panelH = boardSide 且 cell = boardSide/8）。
//
//   白名单（按语义判定，不是写死控件名对）：
//     ① 面板底板本身 panelshadow/paneledge/panelbg/paneltopedge —— 它们就是整块底；
//     ② 细条 h ≤ 0.02：按钮上沿描边、两条分隔线 —— 压在所属色块内部，不占一行；
//     ③ 「底 + 文本」同排：一方是纯底色块（text=="" 且有 bg），且两者中心互相落在
//        对方区间内 —— 设计上刻意让文字框比底色略高以免裁字，属预期行为。
//   其余任何纵向相交都算重叠。
// ===========================================================================
const PANEL_CHROME = new Set(["panelshadow", "paneledge", "panelbg", "paneltopedge"]);
const OVL_EPS = 0.001;

// 「必须能被静态求出纵向区间」的控件名模式。
//   没有这道闸，CHECK-6 可能因为「解析不出来 → 全跳过 → 0 条 → 无重叠」而假绿。
//   这些名字都是 issue #1 第 3 条点名要对齐的可见行（掉子 / 记录 / 按钮 / 音效），
//   一条都求不出来就必须红，逼人去修解析或修布局，而不是静默放过。
const MUST_RESOLVE = [
  { re: /^paneltitle$/, label: "标题" },
  { re: /^panelturn$/, label: "轮次" },
  { re: /^clockwhite$/, label: "白方棋钟" },
  { re: /^clockblack$/, label: "黑方棋钟" },
  { re: /^capwhite$/, label: "白方失子行" },
  { re: /^capblack$/, label: "黑方失子行" },
  { re: /^movelog$/, label: "走子记录区" },
  { re: /^btnnew$/, label: "新开一局按钮" },
  { re: /^btnresign$/, label: "认输按钮" },
  { re: /^btndraw$/, label: "求和按钮" },
  { re: /^btnlocal$/, label: "切换同屏按钮" },
  { re: /^btnreviewtoggle$/, label: "看历史按钮" },
  { re: /^btnsfx$/, label: "音效行" },
];

function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts.map((s) => s.trim());
}

function parsePanelEntries(bodySrc) {
  // 归一化坐标系（面板内相对值）
  const BASE = { px: 0, py: 0, pw: 1, ph: 1, cardPad: 0.0125 };
  const symbols = new Map();
  const cache = new Map();

  const evalExpr = (expr, extra) => {
    if (expr === null || expr === undefined) return null;
    const key = String(expr).trim() + "|" + (extra ? Object.entries(extra).join(",") : "");
    if (cache.has(key)) return cache.get(key);
    cache.set(key, null);

    // 归一化坐标下的替换规则：
    //   · atX(r) / atY(r) / w(r) / h(r) 都是恒等 → 换成裸函数 id(r) = r；
    //   · L.cell = 面板高 / 8 = 0.125（panelH = boardSide，cell = boardSide / 8）；
    //   · L.font(...) / CONFIG.* / Enum.* / Color.* 与坐标无关 → 整体记 0。
    let s = String(expr);
    const killCall = (re) => {
      for (let guard = 0; guard < 8; guard += 1) {
        const m = re.exec(s);
        if (!m) return;
        // 配平括号，整段丢掉
        let depth = 0;
        let end = m.index + m[0].length - 1;
        for (let i = end - 1; i < s.length; i += 1) {
          if (s[i] === "(") depth += 1;
          else if (s[i] === ")") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
        }
        s = s.slice(0, m.index) + "0" + s.slice(end);
      }
    };
    killCall(/\bL\s*\.\s*font\s*\(/g);
    s = s
      .replace(/\bL\s*\.\s*cell\b/g, "0.125")
      .replace(/\batX\s*\(/g, "__id__(")
      .replace(/\batY\s*\(/g, "__id__(")
      .replace(/\bw\s*\(/g, "__id__(")
      .replace(/\bh\s*\(/g, "__id__(");

    const toks = s.match(/__id__|[A-Za-z_][A-Za-z0-9_]*(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)*|[0-9]*\.?[0-9]+|[-+*/()]/g);
    if (!toks) return null;
    const out = [];
    let unknown = false;
    for (const tk of toks) {
      if (tk === "__id__") { out.push("__id"); continue; }
      if (/^[0-9]/.test(tk)) { out.push(tk); continue; }
      if (/^[-+*/()]$/.test(tk)) { out.push(tk); continue; }
      if (extra && Object.prototype.hasOwnProperty.call(extra, tk)) { out.push(String(extra[tk])); continue; }
      if (symbols.has(tk)) {
        const v = symbols.get(tk);
        if (v === null || v === undefined) { unknown = true; break; }
        out.push(String(v));
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(BASE, tk)) { out.push(String(BASE[tk])); continue; }
      unknown = true;
      break;
    }
    if (unknown) return null;
    const js = out.join(" ").replace(/__id/g, "id");
    try {
      // eslint-disable-next-line no-new-func
      const v = new Function("id", `return (${js});`)((x) => x);
      const ok = Number.isFinite(v) ? v : null;
      cache.set(key, ok);
      return ok;
    } catch (e) {
      return null;
    }
  };

  // 1) 逐行登记 local 别名（支持 local a, b = e1, e2）
  //    【关键】求不出值的别名**不登记**，否则会把 BASE 里的归一化符号（px/py/pw/ph）
  //    覆盖成 null —— build_panel 第一行就是 `local px, py, pw, ph = L.panelLeft, …`，
  //    一覆盖就整段坐标全成 null（踩过，CHECK-6 一度抽出 0 条）。
  const codeBody = blankLua(bodySrc, { comments: true, strings: true });
  const rawLines = bodySrc.split("\n");
  const codeLines = codeBody.split("\n");
  for (let i = 0; i < rawLines.length; i += 1) {
    const line = codeLines[i].trim();
    const m = /^local\s+(.+?)\s*=\s*(.+)$/.exec(line);
    if (!m) continue;
    if (/^local\s+function\b/.test(line)) continue;
    const names = splitTopLevel(m[1]);
    const exprs = splitTopLevel(m[2]);
    if (!names.length || names.length !== exprs.length) {
      // 表构造（local rvBtns = { ... }）之类：登记为空缺，后面用到就自然跳过
      continue;
    }
    for (let k = 0; k < names.length; k += 1) {
      if (!/^[A-Za-z_]\w*$/.test(names[k])) continue;
      const v = evalExpr(exprs[k]);
      if (v === null || v === undefined) symbols.delete(names[k]);
      else symbols.set(names[k], v);
    }
  }

  // 2) 抓 create_text({...}) 块
  const entries = [];
  const re = /create_text\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(bodySrc)) !== null) {
    const open = bodySrc.indexOf("{", m.index);
    let depth = 0;
    let end = -1;
    for (let i = open; i < bodySrc.length; i += 1) {
      const c = bodySrc[i];
      if (c === "{") depth += 1;
      else if (c === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    const blockRaw = bodySrc.slice(open, end + 1);
    const blockNoComment = blankLua(blockRaw, { comments: true, strings: false });
    const blockNoString = blankLua(blockRaw, { comments: true, strings: true });

    const grab = (key) => {
      const mm = new RegExp(`(?:^|[,{\\s])${key}\\s*=\\s*([^,}]+)`).exec(blockNoString);
      return mm ? mm[1].trim() : null;
    };
    const nameM = /\bname\s*=\s*"([^"]*)"/.exec(blockNoComment);
    const textM = /\btext\s*=\s*"([^"]*)"/.exec(blockNoComment);
    const hasEmptyText = /\btext\s*=\s*(""|'')/.test(blockNoComment);
    const hasBg = /(?:^|[,{\s])bg\s*=/.test(blockNoString);
    const lineNo = bodySrc.slice(0, m.index).split("\n").length;

    entries.push({
      name: nameM ? nameM[1] : "(无名@" + lineNo + ")",
      line: lineNo,
      x: evalExpr(grab("x")),
      y: evalExpr(grab("y")),
      w: evalExpr(grab("w")),
      h: evalExpr(grab("h")),
      raw: { x: grab("x"), y: grab("y"), w: grab("w"), h: grab("h") },
      isPureBg: hasEmptyText && hasBg,
      hasText: !!(textM && textM[1].length),
    });
  }
  return { entries, symbols };
}

// 解析 CONFIG.PANEL_LAYOUT 这类「显式区间表」：
//   PANEL_LAYOUT = { TITLE = { y = 0.900, h = 0.085 }, … }
// 项目修 issue #1 第 3 条时把散落的 atY(0.52)/atY(0.46) 收拢成了这张表 —— 这是更该被检查的形态，
// 所以 CHECK-6 优先读它，读不到才回退到「从 create_text 实参里解析表达式」。
function parseLayoutTable(src, tableName) {
  const code = blankLua(src, { comments: true, strings: false });
  const marker = new RegExp(`\\b${tableName}\\s*=\\s*\\{`);
  const m = marker.exec(code);
  if (!m) return null;
  const open = code.indexOf("{", m.index);
  let depth = 0;
  let end = -1;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const body = code.slice(open + 1, end);

  const out = {};
  // 逐个顶层条目：NAME = { y = …, h = …, … }
  const entryRe = /([A-Z_][A-Z0-9_]*)\s*=\s*\{([^{}]*)\}/g;
  let em;
  while ((em = entryRe.exec(body)) !== null) {
    const fields = {};
    const fRe = /([a-zA-Z_]\w*)\s*=\s*(-?[0-9]*\.?[0-9]+)/g;
    let fm;
    while ((fm = fRe.exec(em[2])) !== null) fields[fm[1]] = Number(fm[2]);
    out[em[1]] = fields;
  }
  return Object.keys(out).length ? out : null;
}

// 从「显式区间表」直接生成区间（含底/文本配对与细条识别）
function bandsFromLayoutTable(layout) {
  const bands = [];
  for (const [name, f] of Object.entries(layout)) {
    if (typeof f.y !== "number" || typeof f.h !== "number") continue;
    // 表的键名语义：*_BG / *_EDGE / *_DIV 是底色块或细条
    const isDivider = /DIV|EDGE|SEP/.test(name) || f.h <= 0.02;
    const isBg = /_BG$|^PANEL/.test(name);
    const x0 = typeof f.x === "number" ? f.x : (isBg ? 0.05 : 0.04);
    const w = typeof f.w === "number" ? f.w : (isBg ? 0.90 : 0.92);
    bands.push({
      name,
      x0, x1: x0 + w,
      y0: f.y, y1: f.y + f.h,
      isPureBg: isBg,
      isDivider,
    });
  }
  return bands;
}

// 面板外的音效行：按两种画布分别核 ① 不压面板最底行 ② 不越出画布下缘 ③ 高度 ≥ 44px
const TOUCH_MIN = 44;
function checkSfxRowOutsidePanel(src, layout, panelBands) {
  // 取 sfxH 的高度来源：优先 PANEL_LAYOUT.REVIEW_TOGGLE.h，其次 build_panel 里的字面量
  const row3 = layout.REVIEW_TOGGLE;
  if (!row3 || typeof row3.h !== "number") {
    return { ok: false, detail: "PANEL_LAYOUT 里找不到 REVIEW_TOGGLE.h（音效行高度源）" };
  }
  // 偏移量：sfxY = py - sfxH - ph * OFFSET
  const offM = /local\s+sfxY\s*=\s*py\s*-\s*sfxH\s*-\s*ph\s*\*\s*([0-9.]+)/.exec(blankLua(src, { comments: true, strings: true }));
  if (!offM) return { ok: false, detail: "找不到 sfxY 的定位式（py - sfxH - ph * OFFSET）" };
  const OFFSET = Number(offM[1]);

  const canvases = [
    { id: "pc-16-9", w: 1600, h: 900 },
    { id: "mobile-16-9", w: 1280, h: 720 },
  ];
  const notes = [];
  for (const c of canvases) {
    const bs = c.h * 0.78;
    const cell = bs / 8;
    const ph = bs;                       // panelH = boardSide
    const py = (c.h - ph) / 2;           // panelBottom
    let sfxH = ph * row3.h;
    const clamped = sfxH < TOUCH_MIN;
    if (clamped) sfxH = TOUCH_MIN;
    const sfxY = py - sfxH - ph * OFFSET;
    const sfxTop = sfxY + sfxH;

    // ① 与面板最底一行（REVIEW_TOGGLE）的间隙：都在画布坐标系（原点左下）
    const row3Bottom = py + ph * row3.y;
    const gap = row3Bottom - sfxTop;             // >0 表示音效行在它下面且不压
    // ② 不越出画布下缘
    const belowCanvas = sfxY;
    // ③ 触摸目标
    const okTouch = sfxH >= TOUCH_MIN - 1e-6;

    const problemsHere = [];
    if (gap <= -OVL_EPS) problemsHere.push(`压到面板最底行（间隙 ${gap.toFixed(1)}px）`);
    if (belowCanvas < -OVL_EPS) problemsHere.push(`越出画布下缘（y=${belowCanvas.toFixed(1)}）`);
    if (!okTouch) problemsHere.push(`高度 ${sfxH.toFixed(1)}px < 触摸下限 ${TOUCH_MIN}px`);
    notes.push(
      `${c.id}: h=${sfxH.toFixed(1)}px${clamped ? "(44px兜底)" : ""} y=${sfxY.toFixed(1)} 间隙${gap.toFixed(1)}px` +
      (problemsHere.length ? ` ✗ ${problemsHere.join("、")}` : " ✓")
    );
    if (problemsHere.length) {
      return { ok: false, detail: notes.join("；") };
    }
    // 顺便提醒：这个高度是硬编码兜底，真机不同画布高度会改变实际值
    void cell;
  }
  return { ok: true, detail: `音效行 ${notes.join("；")}` };
}

function checkPanelNoOverlap(src) {
  const A = analyze(src);
  const fn = findFunction(A.toks, "build_panel");
  if (!fn) return { ok: false, detail: "找不到 build_panel 函数体" };
  const body = bodyText(src, fn);

  // ===== 路径 A（优先）：CONFIG.PANEL_LAYOUT 显式区间表 =====
  // 修复把散落的 atY(0.52)/atY(0.46) 收拢成一张声明式表。这张表就是「布局契约」本身，
  // 直接查它比反解 create_text 实参更准，也不受局部变量重名影响。
  // 但只有**表真的被 build_panel 用到**时才算数 —— 否则等于「表改了、界面没跟着改」，
  // 那比没表更危险，所以下面还要交叉核对 build_panel 里出现过 PL./PANEL_LAYOUT。
  const layoutA = parseLayoutTable(src, "PANEL_LAYOUT");
  const bodyUsesLayout = /\bPL\b|PANEL_LAYOUT/.test(blankLua(body, { comments: true, strings: true }));

  if (layoutA && bodyUsesLayout) {
    const allBands = bandsFromLayoutTable(layoutA);
    vinfo("PANEL_LAYOUT 表项: " + Object.keys(layoutA).join(" / "));
    if (allBands.length < 6) {
      return { ok: false, detail: `PANEL_LAYOUT 只解析出 ${allBands.length} 项，样本不足` };
    }
    const skippedB = [];
    const bandsB = [];
    for (const b of allBands) {
      if (b.isDivider) { skippedB.push(`${b.name}(分隔线/细条 h=${(b.y1 - b.y0).toFixed(4)})`); continue; }
      bandsB.push(b);
    }
    const overlapsB = [];
    for (let i = 0; i < bandsB.length; i += 1) {
      for (let j = i + 1; j < bandsB.length; j += 1) {
        const a = bandsB[i];
        const b = bandsB[j];
        const xOver = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        if (xOver <= OVL_EPS) continue;
        const yOver = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (yOver <= OVL_EPS) continue;
        const bg = a.isPureBg && !b.isPureBg ? a : (b.isPureBg && !a.isPureBg ? b : null);
        const fg = bg === a ? b : a;
        if (bg && fg) {
          const fgC = (fg.y0 + fg.y1) / 2;
          const bgC = (bg.y0 + bg.y1) / 2;
          const inside = (v, lo, hi) => v >= lo - OVL_EPS && v <= hi + OVL_EPS;
          if (inside(fgC, bg.y0, bg.y1) && inside(bgC, fg.y0, fg.y1)) continue;
        }
        overlapsB.push(
          `${a.name}[${a.y0.toFixed(3)},${a.y1.toFixed(3)}] × ${b.name}[${b.y0.toFixed(3)},${b.y1.toFixed(3)}] 重叠 ${yOver.toFixed(4)}`
        );
      }
    }
    const rosterB = bandsB.map((b) => `${b.name}[${b.y0.toFixed(3)},${b.y1.toFixed(3)}]`).join(" ");

    // ===== 面板外的那一行：音效开关 =====
    // btnsfx 刻意放在面板正下方（面板内排不出 44px 触摸目标），所以它不在 PANEL_LAYOUT 里，
    // 但它仍必须：① 不压到面板最底一行；② 不跑出画布下边缘；③ 高度 ≥ 44px 触摸下限。
    // 高度公式含 44px 兜底（`if sfxH < 44 then sfxH = 44 end`），所以必须按两种画布分别算。
    const sfxNote = checkSfxRowOutsidePanel(src, layoutA, bandsB);
    if (!sfxNote.ok) {
      return { ok: false, detail: `[PANEL_LAYOUT] 面板行本身不相交，但音效行有问题 → ${sfxNote.detail}｜面板 ${rosterB}` };
    }

    if (overlapsB.length) {
      return {
        ok: false,
        detail: `[PANEL_LAYOUT] ${overlapsB.length} 处纵向重叠 → ${overlapsB.join("；")}｜参与判定 ${bandsB.length} 项: ${rosterB}`,
      };
    }
    return {
      ok: true,
      detail: `[PANEL_LAYOUT] ${bandsB.length} 项两两不相交（分隔线跳过 ${skippedB.length} 条）｜${sfxNote.detail}｜${rosterB}`,
    };
  }

  // ===== 路径 B（回退）：从 build_panel 的 create_text 实参反解表达式 =====
  vinfo(layoutA ? "PANEL_LAYOUT 存在但 build_panel 未引用 → 回退到实参解析" : "无 PANEL_LAYOUT 表 → 回退到实参解析");
  const parsed = parsePanelEntries(body);
  const all = parsed.entries;
  vinfo("build_panel 内 create_text 数量: " + all.length);
  if (all.length < 12) {
    return { ok: false, detail: `只抽出 ${all.length} 个 create_text（预期 ≥12）→ 解析规则失配，请人工确认` };
  }

  const skipped = [];
  const bands = [];
  const resolved = new Set();
  for (const e of all) {
    if (PANEL_CHROME.has(e.name)) { skipped.push(`${e.name}(面板底板)`); continue; }
    if (e.x === null || e.y === null || e.w === null || e.h === null) {
      skipped.push(`${e.name}(坐标不可静态求值 y=${e.raw.y})`);
      continue;
    }
    if (e.h <= 0.02) {
      // 细条不参与两两判定，但它确实求出了区间 —— 记入 resolved，避免误报「求不出」。
      resolved.add(e.name);
      skipped.push(`${e.name}(细条 h=${e.h.toFixed(4)})`);
      continue;
    }
    resolved.add(e.name);
    bands.push({
      name: e.name, line: e.line,
      x0: e.x, x1: e.x + e.w, y0: e.y, y1: e.y + e.h,
      isPureBg: e.isPureBg, hasText: e.hasText,
    });
  }
  vinfo("参与判定 " + bands.length + " 条，跳过 " + skipped.length + " 条: " + skipped.join(" / "));

  if (bands.length < 10) {
    return { ok: false, detail: `可参与判定的面板行只有 ${bands.length} 条（跳过 ${skipped.length} 条），样本不足` };
  }

  // 【防假绿】issue #1 第 3 条点名的可见行必须都求出了区间，否则等于没检查。
  const unresolved = MUST_RESOLVE.filter((m) => !all.some((e) => m.re.test(e.name)));
  if (unresolved.length) {
    return {
      ok: false,
      detail: `以下必须参与判定的面板行在 build_panel 里找不到（控件被改名/删除了？）：` +
        unresolved.map((m) => `${m.label}(${m.re.source})`).join("、"),
    };
  }
  const notMeasured = MUST_RESOLVE.filter((m) => !resolved.has((all.find((e) => m.re.test(e.name)) || {}).name));
  if (notMeasured.length) {
    return {
      ok: false,
      detail: `以下面板行的纵向区间无法静态求出，等于没被检查：` +
        notMeasured.map((m) => m.label).join("、") + `｜跳过明细：${skipped.join(" / ")}`,
    };
  }

  const overlaps = [];
  for (let i = 0; i < bands.length; i += 1) {
    for (let j = i + 1; j < bands.length; j += 1) {
      const a = bands[i];
      const b = bands[j];
      const xOver = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      if (xOver <= OVL_EPS) continue;                       // 横向不相交（左右并排按钮）
      const yOver = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (yOver <= OVL_EPS) continue;

      // 白名单③：底 + 文本 同排
      const bg = a.isPureBg && !b.isPureBg ? a : (b.isPureBg && !a.isPureBg ? b : null);
      const fg = bg === a ? b : a;
      if (bg && fg) {
        const fgC = (fg.y0 + fg.y1) / 2;
        const bgC = (bg.y0 + bg.y1) / 2;
        const inside = (v, lo, hi) => v >= lo - OVL_EPS && v <= hi + OVL_EPS;
        if (inside(fgC, bg.y0, bg.y1) && inside(bgC, fg.y0, fg.y1)) continue;
      }
      overlaps.push(
        `${a.name}[${a.y0.toFixed(3)},${a.y1.toFixed(3)}] × ${b.name}[${b.y0.toFixed(3)},${b.y1.toFixed(3)}] 重叠 ${yOver.toFixed(4)}`
      );
    }
  }

  const roster = bands.map((b) => `${b.name}[${b.y0.toFixed(3)},${b.y1.toFixed(3)}]`).join(" ");
  if (overlaps.length) {
    return {
      ok: false,
      detail: `${overlaps.length} 处纵向重叠 → ${overlaps.join("；")}｜参与判定 ${bands.length} 行: ${roster}`,
    };
  }
  return {
    ok: true,
    detail: `${bands.length} 行两两不相交（白名单跳过 ${skipped.length} 条）｜${roster}`,
  };
}

// ===========================================================================
// CHECK-7 图元预算自洽：
//   CONFIG.PIECE_PRIM_BUDGET ≥ 按 PIECE_ART 算出的单枚最大控件数
//   投影删除后的算法：role0 × 2 + role1 × 2 + role2 × 1
// ===========================================================================
const PIECE_KINDS = ["PAWN", "KNIGHT", "BISHOP", "ROOK", "QUEEN", "KING"];

function parsePieceArt(src) {
  const startIdx = src.indexOf("local PIECE_ART");
  if (startIdx < 0) return null;
  // 表尾：行首单个 `}`（`\n}\n`）
  const tail = /\n\}\n/.exec(src.slice(startIdx));
  const tableText = tail ? src.slice(startIdx, startIdx + tail.index + 3) : src.slice(startIdx);

  const rowRe = /^\s*\{\s*([0-4])\s*,\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*(-?[0-9.]+)\s*,\s*([0-2])\s*\}/;
  const out = [];
  for (let k = 0; k < PIECE_KINDS.length; k += 1) {
    const name = PIECE_KINDS[k];
    const marker = `[${name}] = {`;
    const from = tableText.indexOf(marker);
    if (from < 0) continue;
    const nextMarker = k + 1 < PIECE_KINDS.length ? tableText.indexOf(`[${PIECE_KINDS[k + 1]}] = {`) : -1;
    const chunk = tableText.slice(from + marker.length, nextMarker > 0 ? nextMarker : tableText.length);
    const counts = [0, 0, 0];
    let rows = 0;
    for (const line of chunk.split("\n")) {
      const m = rowRe.exec(line);
      if (m) { counts[Number(m[7])] += 1; rows += 1; }
    }
    out.push({
      kind: name, rows,
      role0: counts[0], role1: counts[1], role2: counts[2],
      specCount: counts[0] * 2 + counts[1] * 2 + counts[2],
    });
  }
  return out;
}

function checkPrimBudget(src) {
  const arts = parsePieceArt(src);
  if (!arts || !arts.length) return { ok: false, detail: "解析不到 PIECE_ART 表（结构被改写了？）" };

  const budgetM = /\bPIECE_PRIM_BUDGET\s*=\s*(\d+)/.exec(src);
  if (!budgetM) return { ok: false, detail: "CONFIG 里找不到 PIECE_PRIM_BUDGET" };
  const budget = Number(budgetM[1]);

  let worst = arts[0];
  for (const a of arts) if (a.specCount > worst.specCount) worst = a;

  const roster = arts
    .map((a) => `${a.kind}=${a.specCount}(r0×${a.role0}/r1×${a.role1}/r2×${a.role2})`)
    .join("，");

  if (worst.specCount > budget) {
    return {
      ok: false,
      detail: `预算 ${budget} < 单枚最大 ${worst.specCount}（${worst.kind}）→ 槽位池会截断图元、棋子缺块｜${roster}`,
    };
  }
  return { ok: true, detail: `预算 ${budget} ≥ 单枚最大 ${worst.specCount}（${worst.kind}）｜${roster}` };
}

// ===========================================================================
// 主流程
// ===========================================================================
function main() {
  console.log("=== 国际象棋 · issue #1 静态不变量检查（tests/static_checks.cjs）===");
  console.log(`工作目录: ${ROOT}`);
  console.log(`时间: ${new Date().toISOString()}`);
  console.log(`node: ${process.version}`);
  if (VERBOSE) console.log("模式: --verbose");
  console.log("");

  const FILE_TEXT = {};
  let missing = null;
  for (const [, rel] of Object.entries(FILES)) {
    const key = rel;
    try {
      FILE_TEXT[key] = readText(rel);
      info(`${rel}：${countLines(FILE_TEXT[key])} 行 / ${Buffer.byteLength(FILE_TEXT[key], "utf8")} 字节`);
    } catch (e) {
      missing = missing || e.message;
    }
  }
  console.log("");
  if (missing) {
    console.log(`FAIL 前置 CHECK-0 三份 levelScript.lua 必须齐备: ${missing}`);
    console.log("");
    console.log("结果: 前置失败 → 退出码 1");
    process.exit(1);
  }

  const luaparse = loadLuaparse();
  if (!luaparse) info("luaparse 未找到 → CHECK-1 降级为 token 块配平检查");

  const src = FILE_TEXT[FILES.lua];   // 语义检查一律以正式件 lua/levelScript.lua 为对象

  // CHECK-0 先跑：同名 local function 重复定义会让后续检查「取错定义」，
  // 必须先把这层地基问题报出来，否则后面全是误导性的红/绿。
  const r0 = checkDuplicateFunctions(src, luaparse);
  record("CHECK-0", "无同作用域 local function 重复定义（静默覆盖）", r0.ok, r0.detail);

  const r1 = checkSyntax(FILE_TEXT, luaparse);
  record("CHECK-1", "语法三份均可 Lua 5.3 解析", r1.ok, r1.detail);

  const r2 = checkTripleConsistent(FILE_TEXT);
  record("CHECK-2", "三份文件一致（剥注释/索引行后逐行相同）", r2.ok, r2.detail);

  const r3 = checkNoPieceShadow(src);
  record("CHECK-3", "无棋影（paint_slot 内无阴影绘制）", r3.ok, r3.detail);

  const r4 = checkRotationAlwaysWritten(src);
  record("CHECK-4", "图元旋转无条件写入（image_apply）", r4.ok, r4.detail);

  const r5 = checkLegalHLUsesCellCenter(src);
  record("CHECK-5", "落点高亮按格中心（select_square）", r5.ok, r5.detail);

  const r6 = checkPanelNoOverlap(src);
  record("CHECK-6", "面板纵向区间两两不相交（build_panel）", r6.ok, r6.detail);

  const r7 = checkPrimBudget(src);
  record("CHECK-7", "图元预算自洽（PIECE_PRIM_BUDGET vs PIECE_ART）", r7.ok, r7.detail);

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log("=== 汇总 ===");
  for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"} ${r.id} ${r.name}`);
  console.log("");
  if (failed.length) {
    console.log(`结果: ${results.length - failed.length}/${results.length} 通过，${failed.length} 项失败 → 退出码 1`);
    console.log(`失败项: ${failed.map((r) => r.id).join(", ")}`);
    process.exit(1);
  }
  console.log(`结果: ${results.length}/${results.length} 全部通过 → 退出码 0`);
  process.exit(0);
}

main();
