const fs = require("fs");
const p = "workspace/chess/chess.save.json";
const s = JSON.parse(fs.readFileSync(p, "utf8"));
// 统计：确认 GIA 导出源（存档）里源码已内联、废弃脚本已清理
console.log("scripts in save: " + s.assets.scripts.length);
for (const r of s.assets.scripts) {
  console.log(`  ${r.path} | mounted=${r.mounted} | sourceLen=${(r.source||"").length}`);
}
console.log("serverLogic rules: " + (s.serverLogic?.rules?.length || 0));
