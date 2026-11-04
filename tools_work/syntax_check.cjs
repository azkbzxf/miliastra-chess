// tools_work/syntax_check.cjs
// Lua 5.3 语法编译检查（fengari）：对指定文件逐个 luaL_loadstring。
// 用法：node tools_work/syntax_check.cjs <file1.lua> <file2.lua> ...
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const req = createRequire("file:///C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox/");
const f = req("C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox/vendor/fengari.bundle.js");
const { lua, lauxlib, to_luastring } = f;

const files = process.argv.slice(2);
if (!files.length) {
  console.error("用法: node tools_work/syntax_check.cjs <file.lua> ...");
  process.exit(2);
}
let bad = 0;
for (const rel of files) {
  const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  const src = fs.readFileSync(abs, "utf8");
  const L = lauxlib.luaL_newstate();
  const st = lauxlib.luaL_loadstring(L, to_luastring(src));
  if (st === lua.LUA_OK) {
    console.log(`SYNTAX_OK   ${rel}  (${src.length} 字符)`);
  } else {
    const msg = lua.lua_tojsstring(L, -1);
    console.log(`SYNTAX_ERR  ${rel}\n  ${msg}`);
    bad++;
  }
}
process.exit(bad === 0 ? 0 : 2);
