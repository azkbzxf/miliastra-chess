const fs = require("fs");
const lines = fs.readFileSync("lua/levelScript.lua", "utf8").split("\n");
const i = lines.findIndex((l) => l.indexOf('"undo_ready"') >= 0);
console.log("=== undo_ready 断言（周边 34 行）===");
for (let n = i - 30; n < i + 6; n++) {
  if (n >= 0 && n < lines.length) console.log("  " + (n + 1) + ": " + lines[n]);
}
