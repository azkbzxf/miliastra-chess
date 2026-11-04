// tools_work/sync_sim_copy.cjs
// 把正式 lua/levelScript.lua 同步到模拟器副本 sim/levelScript.lua，
// 差异只允许是 CONFIG 的 4 个模板索引（与 lua/levelScript.lua 头部说明一致）。
// 用法：node tools_work/sync_sim_copy.cjs
//
// 【为什么要有这个脚本】改完正式文件必须同步副本，否则模拟器试玩跑的还是旧代码，
// 会得出「改了但没效果」的错误结论（本项目踩过同类问题）。
const fs = require("fs");

const ROOT = "D:/输出目录/国际象棋";
const SRC = ROOT + "/lua/levelScript.lua";
const DST = ROOT + "/sim/levelScript.lua";

let src = fs.readFileSync(SRC, "utf8");

// 模拟器实测模板索引（只对模拟器工程有效，不能填进真机）
const INDEX_EDITS = [
  ["  CONTAINER_NODE_INDEX = 0,      -- 容器节点索引：脚本挂载点，所有控件以它为父级",
   "  CONTAINER_NODE_INDEX = 1073742100,      -- 容器节点索引：脚本挂载点，所有控件以它为父级"],
  ["  PREFAB_TEXT_BOX      = 0,      -- 文本框模板索引：棋盘格 / 棋子 / 面板 / 按钮 全靠它",
   "  PREFAB_TEXT_BOX      = 1073742106,      -- 文本框模板索引：棋盘格 / 棋子 / 面板 / 按钮 全靠它"],
  ["  PREFAB_CURSOR_AREA   = 0,      -- 光标检测区域模板索引：64 个棋盘格的点击检测",
   "  PREFAB_CURSOR_AREA   = 1073742107,      -- 光标检测区域模板索引：64 个棋盘格的点击检测"],
  ["  PREFAB_IMAGE         = 0,      -- 图片控件模板索引：**必填**。棋子全部用图元绘制，缺此项棋盘上不会有棋子",
   "  PREFAB_IMAGE         = 1073742108,      -- 图片控件模板索引：**必填**。棋子全部用图元绘制，缺此项棋盘上不会有棋子"],
];

let applied = 0;
for (const [from, to] of INDEX_EDITS) {
  if (src.includes(from)) { src = src.replace(from, to); applied++; }
  else console.error("MISS 索引替换: " + from.slice(0, 50));
}
if (applied !== INDEX_EDITS.length) {
  console.error(`索引替换只成功 ${applied}/${INDEX_EDITS.length}，已中止，不写副本`);
  process.exit(2);
}

// 头部加醒目提示（模拟器副本不是交付件）
src = src.replace(
  "--  levelScript.lua · 黑白棋局（千星奇域 纯 2D 双人国际象棋）",
  "--  【模拟器副本，不是交付文件】由 tools_work/sync_sim_copy.cjs 从 lua/levelScript.lua 生成。\n" +
  "--  与正式文件的差异只允许是 CONFIG 的 4 个模板索引。\n" +
  "--\n" +
  "--  levelScript.lua · 黑白棋局（千星奇域 纯 2D 双人国际象棋）"
);

fs.writeFileSync(DST, src, "utf8");
console.log(`WROTE ${DST}（索引替换 ${applied}/${INDEX_EDITS.length}）`);
console.log(`正式文件 ${fs.statSync(SRC).size} 字节 / 副本 ${fs.statSync(DST).size} 字节`);

// 校验：副本与正式文件剥掉注释与索引行后应逐行相同
//
// 【这个函数以前有 bug】旧版逐条 includes 过滤「副本头部那 3 行插入内容」，
// 但插入的是 2 行正文 + 1 行裸 `--` 分隔行，而过滤表里只有 2 条正文 ——
// 裸 `--` 那行没被剥掉，导致副本整体错位一行、自己比自己永远 MISMATCH。
// 现在改成「剥掉全部注释行 + 空行」再比，语义等价但对插入多少行注释都免疫。
// 索引行仍然单独剥（它们是注释行的一部分，但值不同，必须按内容排除）。
const strip = (s) => s.split("\n")
  .map(l => l.replace(/\s*--.*$/, ""))          // 去掉行尾注释
  .filter(l => !/^\s*--/.test(l))               // 去掉整行注释（含裸 `--`）
  .filter(l => l.trim() !== "")                 // 去掉空行
  .filter(l => !/^\s*(CONTAINER_NODE_INDEX|PREFAB_TEXT_BOX|PREFAB_CURSOR_AREA|PREFAB_IMAGE)\s*=/.test(l))
  .join("\n");
const a = strip(fs.readFileSync(SRC, "utf8"));
const b = strip(fs.readFileSync(DST, "utf8"));
if (a === b) {
  console.log("一致性: OK（剥掉注释与索引行后逐行相同）");
} else {
  // 不一致时打印第一处差异，便于定位（不打全文，避免刷屏）
  const la = a.split("\n"), lb = b.split("\n");
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      console.error(`一致性: MISMATCH 首处差异在代码行 ${i + 1}`);
      console.error("  正式: " + JSON.stringify(la[i]));
      console.error("  副本: " + JSON.stringify(lb[i]));
      break;
    }
  }
  process.exit(2);
}
