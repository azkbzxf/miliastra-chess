// tools_work/v3_sync_save.cjs
// 把 sim/levelScript.lua 内联进模拟器存档 workspace/chess/chess.save.json。
//
// 【为什么必须内联】试玩优先使用 scripts[].source（内联字符串），只有 source 为空才读 path。
// 只改磁盘上的 sim/levelScript.lua 而不内联，试玩跑的还是旧代码 —— 会得出「改了没效果」的假结论。
//
// 与 tools_work/issue1/_inline.cjs 的区别：那个脚本顺手删掉了 12 个已废弃的 piece_*.lua，
// 这里**只更新 levelScript 的 source**，不动其它条目（可重复执行、幂等）。
const fs = require("fs");

const ROOT = "D:/输出目录/国际象棋";
const SAVE = ROOT + "/workspace/chess/chess.save.json";
const SIM = ROOT + "/sim/levelScript.lua";

const save = JSON.parse(fs.readFileSync(SAVE, "utf8"));
const src = fs.readFileSync(SIM, "utf8");

let hit = 0;
for (const r of save.assets.scripts) {
  if (/levelScript\.lua$/.test(r.path)) {
    r.source = src;
    hit++;
  }
}
if (hit !== 1) {
  console.error(`levelScript 条目匹配 ${hit} 个（应为 1），已中止，未写存档`);
  process.exit(2);
}

fs.writeFileSync(SAVE, JSON.stringify(save, null, 2), "utf8");
console.log(`WROTE ${SAVE}`);
console.log(`内联 levelScript source: ${src.length} 字符；scripts 条目数=${save.assets.scripts.length}`);
