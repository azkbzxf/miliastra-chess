// tools_work/final_verify.cjs
// 交付前一次性完整验证：只针对 out/交付包 里的真实交付文件。
// 检查项：文件完整性 → Lua 语法 → Lua 规则 → Lua 沙箱 → Lua 分辨率矩阵 → Demo 自检 → Demo 量测 → 一致性
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = "D:/输出目录/国际象棋";
const PKG = path.join(ROOT, "out/交付包");
const results = [];
function step(name, cmd, opts) {
  const t0 = Date.now();
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: "pipe", timeout: 180000, ...(opts||{}) });
    results.push({ name, ok: true, ms: Date.now() - t0, out });
    console.log(`PASS  ${name}  (${Date.now() - t0}ms)`);
    return out;
  } catch (e) {
    const out = (e.stdout || "") + (e.stderr || "");
    results.push({ name, ok: false, ms: Date.now() - t0, out });
    console.log(`FAIL  ${name}  (${Date.now() - t0}ms)`);
    console.log("  " + out.split("\n").slice(-8).join("\n  "));
    return out;
  }
}

console.log("=== 交付前完整验证（对象：out/交付包） ===\n");

// 0 文件完整性
const required = ["levelScript.lua", "chess_demo.html", "交付说明.md", "白话说明.md", "README.md", "挂载指南.md", "棋子图片编号说明.md"];
let allExist = true;
for (const f of required) {
  const p = path.join(PKG, f);
  const exists = fs.existsSync(p);
  if (!exists) allExist = false;
  const size = exists ? fs.statSync(p).size : 0;
  console.log(`${exists ? "OK  " : "MISS"}  ${f}  ${size} 字节`);
}
results.push({ name: "交付包文件完整", ok: allExist });
if (!allExist) { console.log("\n交付包文件缺失，终止"); process.exit(2); }

// 1 Lua 语法
step("Lua 语法编译",
  `node --input-type=module -e "import{createRequire}from'node:module';import fs from'node:fs';const require=createRequire('file:///C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox/');const f=require('C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox/vendor/fengari.bundle.js');const{lua,lauxlib,to_luastring,to_jsstring}=f;const L=lauxlib.luaL_newstate();const st=lauxlib.luaL_loadstring(L,to_luastring(fs.readFileSync('out/交付包/levelScript.lua','utf8')));console.log(st===lua.LUA_OK?'SYNTAX_OK':'SYNTAX_ERR');process.exit(st===lua.LUA_OK?0:2)"`);

// 2 Lua 规则层（改写脚本内路径为交付包）
const rulesScript = fs.readFileSync(path.join(ROOT, "tools_work/rules_test.cjs"), "utf8")
  .replace('const LUA = path.join(ROOT, "lua/levelScript.lua");',
           'const LUA = path.join(ROOT, "out/交付包/levelScript.lua");');
fs.writeFileSync(path.join(ROOT, "tools_work/_fv_rules.cjs"), rulesScript, "utf8");
step("Lua 规则层 perft + 特殊局面", "node tools_work/_fv_rules.cjs");

// 3 Lua 沙箱
step("Lua 体外沙箱（17 项交互用例）", "node tools_work/play_test.cjs");

// 4 Lua 分辨率矩阵
step("Lua 分辨率矩阵 8 种设备形态", "node tools_work/resolution_test.cjs");

// 5 Demo 自检（指向交付包）
const vd = fs.readFileSync(path.join(ROOT, "tools_work/verify_demo.mjs"), "utf8")
  .replace('const PROTO_DIR = path.join(ROOT, "proto");',
           'const PROTO_DIR = path.join(ROOT, "out/交付包");');
fs.writeFileSync(path.join(ROOT, "tools_work/_fv_verify_demo.mjs"), vd, "utf8");
step("Demo 真实 Edge 自检 18 项", "node tools_work/_fv_verify_demo.mjs");

// 6 Demo 量测
step("Demo 真实量测 4 种分辨率", "node tools_work/measure_demo.mjs");

// 7 一致性
const cc = fs.readFileSync(path.join(ROOT, "tools_work/consistency_check.cjs"), "utf8")
  .replace('const luaSrc = fs.readFileSync(path.join(ROOT, "lua/levelScript.lua"), "utf8");',
           'const luaSrc = fs.readFileSync(path.join(ROOT, "out/交付包/levelScript.lua"), "utf8");')
  .replace('const demoHtml = fs.readFileSync(path.join(ROOT, "proto/chess_demo.html"), "utf8");',
           'const demoHtml = fs.readFileSync(path.join(ROOT, "out/交付包/chess_demo.html"), "utf8");');
fs.writeFileSync(path.join(ROOT, "tools_work/_fv_consistency.cjs"), cc, "utf8");
step("Demo 与 Lua 一致性（文案/配色/字号/数值）", "node tools_work/_fv_consistency.cjs");

// 8 接口依据
step("接口依据回查（全部标识 vs API 文档）", `node tools_work/api_evidence.cjs`);

// 9 交付版无调试痕迹
const html = fs.readFileSync(path.join(PKG, "chess_demo.html"), "utf8");
const dbgOnDefault = html.includes('layer.classList.add("on")') &&
                     /function installDebug\(\)\s*\{\s*const params[\s\S]*?if \(!params\.has\("debug"\)\) return;/m.test(html);
const noPlaceholder = !/占位|待替换|调试用|TODO|FIXME/.test(html);
const hasErrCapture = html.includes("诊断：全局错误捕获");
results.push({ name: "交付版无调试痕迹", ok: dbgOnDefault && noPlaceholder && !hasErrCapture });
console.log(`${dbgOnDefault && noPlaceholder && !hasErrCapture ? "PASS" : "FAIL"}  交付版无调试痕迹  ` +
            `(调试层受 ?debug 控制=${dbgOnDefault}, 无占位字样=${noPlaceholder}, 无诊断代码=${!hasErrCapture})`);

// 汇总
const fails = results.filter(r => !r.ok).length;
console.log(`\n=== ${fails === 0 ? "全部通过" : fails + " 项失败"} / 共 ${results.length} 项 ===`);
if (fails > 0) {
  console.log("\n失败项：");
  results.filter(r => !r.ok).forEach(r => console.log("  - " + r.name));
}

// 清理临时脚本
for (const f of ["_fv_rules.cjs", "_fv_verify_demo.mjs", "_fv_consistency.cjs"]) {
  try { fs.unlinkSync(path.join(ROOT, "tools_work", f)); } catch (e) {}
}

process.exit(fails === 0 ? 0 : 2);
