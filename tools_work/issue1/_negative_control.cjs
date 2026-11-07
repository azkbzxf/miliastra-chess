// 负向对照：证明 _audit_forward_vars.cjs 真能抓到「函数体前向引用模块级 local」。
//
// 上一版做法（把 GAME 整表挪到文件末尾）会让文件**语法错误**，
// 审计脚本因解析失败而变红 —— 那也是红，但证明不了它检出的是「前向引用」。
// 现在改成**语法合法**的最小造例：一个函数先引用 `local X`，X 在之后才声明。
// 这样只有「前向变量引用」这一条能让它红。
//
// 用法：node tools_work/issue1/_negative_control.cjs
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const TMP = "tools_work/tmp/_negctl_min.lua";

// 语法合法、但 show_early 的函数体里用了声明在之后的 LOCAL_X
const fixture = [
  "-- 负向对照造例（语法合法，只有前向变量引用）",
  "local CONFIG = { a = 1 }",
  "",
  "local function show_early()",
  "  LOCAL_X.flag = true",          // ← 前向引用：LOCAL_X 在下面才声明
  "  return CONFIG.a",
  "end",
  "",
  "local LOCAL_X = { flag = false }",
  "",
  "local function use_late()",
  "  show_early()",
  "  return LOCAL_X.flag",
  "end",
  "",
].join("\n");

fs.writeFileSync(TMP, fixture, "utf8");

let out = "", code = 0;
try {
  out = execFileSync(
    process.execPath,
    [path.join(__dirname, "_audit_forward_vars.cjs"), TMP],
    { encoding: "utf8" }
  );
} catch (e) {
  out = (e.stdout || "") + (e.stderr || "");
  code = typeof e.status === "number" ? e.status : 1;
}
fs.unlinkSync(TMP);

const caughtByName = /✗\s+show_early[\s\S]*前向引用[\s\S]*LOCAL_X/.test(out);
const syntaxError = /SyntaxError|Unexpected|luaparse\.js/.test(out) && !caughtByName;

console.log("=== 负向对照造例 ===");
console.log("（语法合法的最小例子：show_early 里用 LOCAL_X，LOCAL_X 在之后才声明）\n");
console.log(out.trim());
console.log("");
console.log("按名字精确抓到 show_early → LOCAL_X : " + (caughtByName ? "是 ✓" : "否 ✗"));
console.log("变红是否因为语法错误（无效对照）  : " + (syntaxError ? "是 ✗" : "否 ✓"));
console.log("退出码                            : " + code);

const pass = caughtByName && !syntaxError && code !== 0;
console.log("\n负向对照结论: " + (pass
  ? "通过 —— 审计脚本确实能检出「函数体前向引用变量」这一类 bug"
  : "不通过 —— 审计脚本不可信"));
process.exit(pass ? 0 : 5);
