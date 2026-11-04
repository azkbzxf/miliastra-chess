// tools_work/api_evidence.cjs
// 接口依据回查：从交付包的 Lua 里提取全部编辑器接口标识，逐项在当前 API 文档中查找依据。
// release 04 §5.1 硬要求：找不到依据的数量必须是零。
const fs = require("fs");
const path = require("path");

const ROOT = "D:/输出目录/国际象棋";
const LUA = path.join(ROOT, "out/交付包/levelScript.lua");
const DOC = "C:/Users/24037/Downloads/MiliastraAgent/release/Lua客户端控件API文档.md";

const src = fs.readFileSync(LUA, "utf8");
const doc = fs.readFileSync(DOC, "utf8");

const ids = new Set();
for (const m of src.matchAll(/game\.([A-Za-z_]\w*)\s*\(/g)) ids.add(["game", m[1]]);
for (const m of src.matchAll(/script:([A-Za-z_]\w*)/g)) ids.add(["script", m[1]]);
for (const m of src.matchAll(/[a-zA-Z_]\w*:([A-Za-z_]\w*)\s*\(/g)) {
  if (m[1][0].isUpperCase ? m[1][0].toUpperCase() === m[1][0] : m[1][0] === m[1][0].toUpperCase()) {
    if (/[A-Z]/.test(m[1][0])) ids.add(["control", m[1]]);
  }
}
const enums = new Set();
for (const m of src.matchAll(/Enum\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g)) enums.add([m[1], m[2]]);
const colors = new Set([...src.matchAll(/Color\.([A-Za-z_]\w*)/g)].map(m => m[1]));
const fields = new Set([...src.matchAll(/ctrl\.([A-Za-z_]\w*)/g)].map(m => m[1]));

const missing = [];
const checked = [];

for (const [kind, name] of [...ids].sort()) {
  const prefix = kind === "game" ? "game." : kind === "script" ? "script:" : "";
  const full = prefix + name;
  const found = doc.includes(full) || (kind === "control" && doc.includes(name));
  checked.push({ full, found });
  if (!found) missing.push(full);
}
for (const [a, b] of [...enums].sort()) {
  const full = `Enum.${a}.${b}`;
  const found = doc.includes(b);
  checked.push({ full, found });
  if (!found) missing.push(full);
}
for (const c of [...colors].sort()) {
  const full = `Color.${c}`;
  const found = doc.includes(c);
  checked.push({ full, found });
  if (!found) missing.push(full);
}
for (const f of [...fields].sort()) {
  const found = doc.includes(f);
  checked.push({ full: "." + f, found });
  if (!found) missing.push("." + f);
}

console.log(`=== 接口依据回查 ===`);
console.log(`文档：${path.basename(DOC)}`);
console.log(`标识总数：${checked.length}`);
console.log(`找不到依据：${missing.length}`);
if (missing.length) {
  console.log("\n无依据的标识：");
  for (const m of missing) console.log("  ★ " + m);
}
console.log(missing.length === 0 ? "\nALL EVIDENCED（全部有文档依据）" : "\nHAS_MISSING");
process.exit(missing.length === 0 ? 0 : 2);
