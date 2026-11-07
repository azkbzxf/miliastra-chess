// tools_work/v3_sync_user_copy.cjs
// 从正式稿 lua/levelScript.lua 生成**给真机用的同名单文件** chess.lua：
// 只把 CONFIG 的 4 个模板索引填成用户项目里的真实值（其余逐字节相同）。
//
// 四个索引来自用户真机脚本（2026-11 回传）：
//   容器节点 1073741853 / 文本框 1073741852 / 光标检测区域 1073741850 / 图片 1073741851
//
// 用法：node tools_work/v3_sync_user_copy.cjs
// 产物：D:/输出目录/国际象棋/chess.lua（用户直接替换到 external_lua_file/chess.lua）
const fs = require("fs");

const ROOT = "D:/输出目录/国际象棋";
const SRC = ROOT + "/lua/levelScript.lua";
const DST = ROOT + "/chess.lua";

// 用户真机项目里的真实模板索引
const REAL = {
  CONTAINER_NODE_INDEX: 1073741853,
  PREFAB_TEXT_BOX: 1073741852,
  PREFAB_CURSOR_AREA: 1073741850,
  PREFAB_IMAGE: 1073741851,
};

let src = fs.readFileSync(SRC, "utf8");
let applied = 0;
for (const key of Object.keys(REAL)) {
  const from = new RegExp("(" + key + "\\s*=\\s*)0(\\s*,)");
  if (!from.test(src)) {
    console.error("MISS 索引占位: " + key + " = 0 未找到");
    continue;
  }
  src = src.replace(from, "$1" + REAL[key] + "$2");
  applied++;
}
if (applied !== 4) {
  console.error(`索引替换只成功 ${applied}/4，已中止，不写产物`);
  process.exit(2);
}

// 自检：交付文件不得残留 0 索引，也不得混入模拟器索引
for (const key of Object.keys(REAL)) {
  const line = src.split("\n").find(l => l.trim().startsWith(key + " "));
  if (!line || !line.includes(String(REAL[key]))) {
    console.error("自检失败：找不到期望的索引行 " + key);
    process.exit(3);
  }
}
if (/10737421\d\d/.test(src)) {
  console.error("自检失败：产物里混入了模拟器索引 10737421xx");
  process.exit(4);
}

fs.writeFileSync(DST, src, "utf8");
console.log(`WROTE ${DST}（${src.length} 字符，索引 ${applied}/4）`);
console.log(`行数 ${src.split("\n").length}`);
