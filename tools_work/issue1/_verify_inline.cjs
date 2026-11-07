// 校验 workspace 存档里内联的 levelScript 源码是不是「当前 sim 版」。
// 只读，不写任何文件。用法：node tools_work/issue1/_verify_inline.cjs
const fs = require("fs");
const p = "workspace/chess/chess.save.json";
const s = JSON.parse(fs.readFileSync(p, "utf8"));
const rec = s.assets.scripts.find((x) => /levelScript\.lua$/.test(x.path));
if (!rec) {
  console.log("FAIL 存档里找不到 levelScript 脚本记录");
  process.exit(2);
}
const src = rec.source || "";
const sim = fs.readFileSync("sim/levelScript.lua", "utf8");
console.log("path            : " + rec.path);
console.log("source chars    : " + src.length);
console.log("sim chars       : " + sim.length);
console.log("identical to sim: " + (src === sim));
const marks = [
  ["TIME_CONTROLS 表", /TIME_CONTROLS\s*=\s*\{/],
  ["START_LAYOUT 表", /START_LAYOUT\s*=\s*\{/],
  ["screen=start 初值", /screen\s*=\s*"start"/],
  ["build_start_screen", /function build_start_screen\(\)/],
  ["v2backmain 按钮", /name\s*=\s*"v2backmain"/],
  ["ERR_CONFIG 键", /ERR_CONFIG\s*=\s*"/],
  ["time_control_alias 断言", /time_control_alias/],
];
for (const [label, re] of marks) console.log((re.test(src) ? "有  " : "无  ") + label);
console.log("--- 模板索引（必须为模拟器真实值）---");
for (const line of src.split("\n")) {
  if (/^\s*(CONTAINER_NODE_INDEX|PREFAB_TEXT_BOX|PREFAB_CURSOR_AREA|PREFAB_IMAGE)\s*=/.test(line)) {
    console.log("  " + line.trim());
  }
}
const okIdx =
  src.includes("CONTAINER_NODE_INDEX = 1073742100") &&
  src.includes("PREFAB_TEXT_BOX      = 1073742106") &&
  src.includes("PREFAB_CURSOR_AREA   = 1073742107") &&
  src.includes("PREFAB_IMAGE         = 1073742108");
console.log("索引为模拟器真实值: " + okIdx);
console.log("总判定: " + (src === sim && okIdx ? "OK" : "MISMATCH"));
process.exit(src === sim && okIdx ? 0 : 3);
