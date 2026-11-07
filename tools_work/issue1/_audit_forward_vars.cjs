// 审计「函数体引用的模块级 local，是否在函数定义之前就已声明」。
//
// 为什么需要这个脚本：`tools_work/lua_check.cjs` 的「先用后定义」只扫**函数名**
// 的前向引用，**不扫函数体内引用的变量**。v2.0 块 1 就因此漏掉一个致命 bug：
//   `show_start_screen`（UI 区）函数体里写 `GAME.screen = "start"`，
//   而 `local GAME = {` 在其之后 → GAME 被编译期绑成 global → 运行时 nil → OnStart 崩。
//   错误原文：OnStart: sim/levelScript.lua:3348: attempt to index a nil value (global 'GAME')
// 这个脚本用 luaparse 的 AST 精确取函数体范围与其中的标识符引用，补那道门禁的盲区。
//
// 只读，不写任何文件。
// 用法：node tools_work/issue1/_audit_forward_vars.cjs [文件路径]
const fs = require("fs");
const path = require("path");

let luaparse;
try {
  luaparse = require(path.join(__dirname, "../tmp/jscheck/node_modules/luaparse"));
} catch (e) {
  console.error("缺少 luaparse：cd tools_work/tmp/jscheck && npm i luaparse");
  process.exit(2);
}

const FILE = process.argv[2] || "lua/levelScript.lua";
const src = fs.readFileSync(FILE, "utf8");
const ast = luaparse.parse(src, { luaVersion: "5.3", locations: true, comments: false });

// ---- 1 模块级 chunk 里 `local` 声明的位置（行号）----
// 只认顶层（chunk.body）的 LocalStatement，索引是「变量名 → 声明行」。
const decl = {};
// 同时记录 LocalFunction 声明（`local function foo` 也是模块级 local）
function recordDecl(stmt) {
  if (stmt.type === "LocalStatement") {
    for (const v of stmt.variables) {
      if (v.type === "Identifier" && !(v.name in decl)) decl[v.name] = v.loc.start.line;
    }
  } else if (stmt.type === "LocalFunctionDeclaration" && stmt.identifier) {
    if (!(stmt.identifier.name in decl)) decl[stmt.identifier.name] = stmt.loc.start.line;
  }
}
for (const stmt of ast.body) recordDecl(stmt);

// ---- 2 遍历 AST，找每个顶层函数定义 + 其函数体内引用到的标识符名字 ----
// 关键：只收集「函数体内实际读写的名字」，不含属性名（MemberExpression.identifier 是字段）
const results = [];

function collectRefs(node, out) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) collectRefs(n, out); return; }
  switch (node.type) {
    case "Identifier":
      out.add(node.name);
      return;
    case "MemberExpression":
      // obj.field —— 只算 obj，不算 field（field 不是变量引用）
      collectRefs(node.base, out);
      // index 是表达式时算引用
      if (node.indexer === "[" ) collectRefs(node.index, out);
      return;
    case "TableKey":
      // { key = value } 里 key 是字符串字面量，不算引用
      collectRefs(node.value, out);
      return;
    case "TableKeyString":
      // { key = value } —— key 是 Identifier 但是字段名，不算变量引用
      collectRefs(node.value, out);
      return;
    case "MemberExpressionIndex":
      collectRefs(node.base, out);
      collectRefs(node.index, out);
      return;
    case "LabelStatement":
    case "BreakStatement":
    case "GotoStatement":
      return;
    default:
      break;
  }
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "type" || k === "range") continue;
    collectRefs(node[k], out);
  }
}

// 递归找函数定义：顶层 `local function f` / `function f` / `f = function`
function walk(stmts) {
  for (const stmt of stmts) {
    if (stmt.type === "LocalFunctionDeclaration" && stmt.identifier) {
      addFn(stmt.identifier.name, stmt);
    } else if (stmt.type === "FunctionDeclaration" && stmt.identifier) {
      addFn(stmt.identifier.name, stmt);
    } else if (stmt.type === "AssignmentStatement") {
      for (let i = 0; i < stmt.variables.length; i++) {
        const v = stmt.variables[i];
        const val = stmt.init ? stmt.init[i] : null;
        if (v.type === "Identifier" && val && val.type === "FunctionDeclaration") {
          addFn(v.name, val, stmt.loc.start.line);
        }
      }
    }
  }
}

function addFn(name, fnNode, declLineOverride) {
  const refs = new Set();
  // 参数名不算「模块级 local 引用」，先进来再剔除
  const params = new Set();
  if (fnNode.parameters) {
    for (const p of fnNode.parameters) if (p.type === "Identifier") params.add(p.name);
  }
  collectRefs(fnNode.body, refs);
  for (const p of params) refs.delete(p);
  results.push({
    name,
    declLine: declLineOverride || fnNode.loc.start.line,
    refs,
  });
}

walk(ast.body);

// ---- 3 审计 ----
const targetsArg = process.argv.slice(3);
const focus = targetsArg.length ? new Set(targetsArg) : null;

let bad = 0, checked = 0;
for (const r of results) {
  if (focus && !focus.has(r.name)) continue;
  checked++;
  const probs = [];
  for (const ref of r.refs) {
    if (ref === r.name) continue;
    const d = decl[ref];
    if (d === undefined) continue;          // 不是模块级 local（函数名/全局/平台 API），跳过
    if (d > r.declLine) probs.push(ref + "@" + d);
  }
  if (probs.length) {
    bad++;
    console.log("✗ " + r.name.padEnd(28) + " def@" + String(r.declLine).padStart(5) +
                "   前向引用: " + probs.sort().join(", "));
  } else if (focus) {
    console.log("✓ " + r.name.padEnd(28) + " def@" + String(r.declLine).padStart(5) +
                "  refs: " + [...r.refs].filter((x) => decl[x] !== undefined).sort().join(","));
  }
}
console.log("\n审计 " + checked + " 个顶层函数，前向变量引用隐患 " + bad + " 个");
process.exit(bad === 0 ? 0 : 4);
