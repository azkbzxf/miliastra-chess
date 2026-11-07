// 统计自检断言数并列出名称
const fs = require("fs");
const s = fs.readFileSync("lua/levelScript.lua", "utf8");
const names = [];
for (const m of s.matchAll(/add\("([a-z0-9_]+)",/g)) names.push(m[1]);
const uniq = [...new Set(names)];
console.log("自检断言数: " + uniq.length);
uniq.forEach((n, i) => console.log("  " + (i + 1) + ". " + n));
