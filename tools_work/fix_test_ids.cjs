// tools_work/fix_test_ids.cjs
// 修正 test_piece_image_mode.cjs 的 IDS 匹配逻辑（CRLF 安全）
const fs = require("fs");

const P = "D:/输出目录/国际象棋/tools_work/test_piece_image_mode.cjs";
let s = fs.readFileSync(P, "utf8");

const oldStart = s.indexOf("const IDS_ZERO");
const oldEnd = s.indexOf("function build(");
if (oldStart < 0 || oldEnd < 0) { console.error("ANCHOR"); process.exit(3); }

const newBlock = `// 注意：levelScript.lua 是 CRLF 换行，多行字符串匹配会失败，这里统一用正则。
const IDS_RE = /    PW = \\d+, NW = \\d+, BW = \\d+, RW = \\d+, QW = \\d+, KW = \\d+,\\r?\\n    PB = \\d+, NB = \\d+, BB = \\d+, RB = \\d+, QB = \\d+, KB = \\d+,/;
if (!IDS_RE.test(base)) {
  console.error("IDS_RE_NOT_FOUND - 配置文本格式变了，请检查 CONFIG.PIECE_IMAGE_IDS");
  process.exit(3);
}
const IDS_ZERO = base.match(IDS_RE)[0];
const IDS_FULL = "    PW = 101, NW = 102, BW = 103, RW = 104, QW = 105, KW = 106,\\r\\n    PB = 111, NB = 112, BB = 113, RB = 114, QB = 115, KB = 116,";
const IDS_HALF = "    PW = 101, NW = 102, BW = 103, RW = 0, QW = 0, KW = 0,\\r\\n    PB = 0, NB = 0, BB = 0, RB = 0, QB = 0, KB = 0,";

`;
s = s.slice(0, oldStart) + newBlock + s.slice(oldEnd);

// build 里替换 IDS 用 split/join
s = s.replace(".replace(IDS_ZERO, idsText);", ".split(IDS_ZERO).join(idsText);");

fs.writeFileSync(P, s, "utf8");
console.log("patched test_piece_image_mode.cjs");
