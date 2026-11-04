#!/usr/bin/env node
// tools_work/make_sandbox_copy.mjs
// 把正式 lua/levelScript.lua 复制一份沙箱测试副本，只把 CONFIG 的 3 个占位 0 换成沙箱能用的非零值。
// 正式文件保持 0（由用户填真实索引），副本仅用于自动化验收，不进交付包。
// 用法：node tools_work/make_sandbox_copy.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "lua/levelScript.lua");
const DST = path.join(ROOT, "lua/levelScript.sandbox.lua");

let src = fs.readFileSync(SRC, "utf8");

// 只替换 CONFIG 里的占位（精确匹配带注释的行）
const replacements = [
  ["  CONTAINER_NODE_INDEX = 0,      -- 容器节点索引：脚本挂载点，所有控件以它为父级",
   "  CONTAINER_NODE_INDEX = 1,      -- [沙箱副本] 占位非零值"],
  ["  PREFAB_TEXT_BOX      = 0,      -- 文本框模板索引：棋盘格 / 棋子 / 面板 / 按钮 全靠它",
   "  PREFAB_TEXT_BOX      = 1,      -- [沙箱副本] 占位非零值"],
  ["  PREFAB_CURSOR_AREA   = 0,      -- 光标检测区域模板索引：64 个棋盘格的点击检测",
   "  PREFAB_CURSOR_AREA   = 2,      -- [沙箱副本] 占位非零值"],
  // 图片控件模板索引：非零时才会建「圆盘+棋符」档的图片控件（沙箱任意非零值都能建控件）。
  ["  PREFAB_IMAGE         = 0,      -- 图片控件模板索引：仅「圆盘+棋符」档需要；缺省 0 = 自动只用「纯棋符」档",
   "  PREFAB_IMAGE         = 3,      -- [沙箱副本] 占位非零值"],
  // 沙箱未实现 raycastTarget 字段读写，读取会被记为 unsupported-api → 沙箱 fail。
  // 正式文件为 true（真机必须设），副本改成 false 才能让沙箱跑过。
  ["  ENABLE_RAYCAST_FIELD = true,",
   "  ENABLE_RAYCAST_FIELD = false,  -- [沙箱副本] 沙箱未实现该字段"],
];

let applied = 0;
for (const [from, to] of replacements) {
  if (src.includes(from)) {
    src = src.replace(from, to);
    applied++;
  } else {
    console.error("MISS: " + from.slice(0, 50));
  }
}

// 在文件头加醒目提示
src = src.replace(
  "--  levelScript.lua · 黑白棋局（千星奇域 纯 2D 双人国际象棋）",
  "--  levelScript.sandbox.lua · 【沙箱测试副本，不是交付文件】\n" +
  "--  由 tools_work/make_sandbox_copy.mjs 从 lua/levelScript.lua 生成；\n" +
  "--  只把 CONFIG 三个占位 0 换成沙箱可用值，其余逐字相同。不要交付这一份。\n" +
  "--\n" +
  "--  levelScript.lua · 黑白棋局（千星奇域 纯 2D 双人国际象棋）"
);

fs.writeFileSync(DST, src, "utf8");
console.log(`WROTE ${DST}  (替换 ${applied}/3 处)`);
