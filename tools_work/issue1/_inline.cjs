const fs = require("fs");
const p = "workspace/chess/chess.save.json";
const s = JSON.parse(fs.readFileSync(p, "utf8"));
const src = fs.readFileSync("sim/levelScript.lua", "utf8");
const list = s.assets.scripts;
// 删掉 12 个已废弃的 piece_*.lua（v1.11 起主脚本 require 次数为 0）
const before = list.length;
const kept = list.filter(r => !/piece_[A-Z]{2}\.lua$/.test(r.path));
// 主脚本内联源码（原来是路径挂载、source 为空）
for (const r of kept) {
  if (/levelScript\.lua$/.test(r.path)) r.source = src;
}
s.assets.scripts = kept;
fs.writeFileSync(p, JSON.stringify(s, null, 2), "utf8");
console.log("scripts: " + before + " -> " + kept.length);
console.log("inlined levelScript: " + src.length + " chars");
console.log("kept: " + kept.map(r => r.path).join(", "));
