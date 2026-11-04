// tools_work/sync_delivery.cjs
// 把 lua/levelScript.lua 同步到 out/交付包/levelScript.lua（交付件与开发件必须同一份代码）。
//
// 【为什么必须走脚本】交付包里那份是用户拿去挂真机的文件，忘了同步 = 用户拿到旧版。
// 本项目已经踩过一次（P-04：交付包 Lua 未同步，分辨率测试读到 280 而非 282 个控件）。
// 用法：node tools_work/sync_delivery.cjs
const fs = require("fs");

const ROOT = "D:/输出目录/国际象棋";
const SRC = ROOT + "/lua/levelScript.lua";
const DST = ROOT + "/out/交付包/levelScript.lua";

const src = fs.readFileSync(SRC, "utf8");

// 交付版必须是「模板索引全 0」的形态（由用户按真机填），这里做硬校验，防止误把模拟器索引带进去。
const mustBeZero = [
  "CONTAINER_NODE_INDEX = 0,",
  "PREFAB_TEXT_BOX      = 0,",
  "PREFAB_CURSOR_AREA   = 0,",
  "PREFAB_IMAGE         = 0,",
];
for (const line of mustBeZero) {
  if (!src.includes(line)) {
    console.error("ABORT 源文件不是「索引全 0」的交付形态，缺少行: " + line);
    console.error("       若源文件里是模拟器索引，请先确认改的是 lua/levelScript.lua 而不是 sim/ 副本。");
    process.exit(2);
  }
}
// 反过来：源文件里不许出现模拟器索引数字
if (/10737421\d\d/.test(src)) {
  console.error("ABORT 源文件含模拟器模板索引 10737421xx，拒绝写进交付包");
  process.exit(2);
}

fs.writeFileSync(DST, src, "utf8");

const a = fs.statSync(SRC).size, b = fs.statSync(DST).size;
console.log(`WROTE ${DST}`);
console.log(`源 ${a} 字节 / 交付 ${b} 字节`);
if (a !== b) { console.error("字节数不一致，写入可能不完整"); process.exit(2); }
if (fs.readFileSync(DST, "utf8") === src) console.log("一致性: OK（逐字节相同）");
else { console.error("一致性: MISMATCH"); process.exit(2); }
