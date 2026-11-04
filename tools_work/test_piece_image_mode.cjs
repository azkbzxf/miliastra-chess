// tools_work/test_piece_image_mode.cjs
// 验证「图片模式」三种配置下的行为：
//   A 编号全填     → 图片层创建 64 个，总数 346
//   B 编号只填一半 → 图片层仍创建（模板索引非 0），总数 346，但显示回落符号
//   C 全不填       → 不创建图片层，总数 282
const fs = require("fs");
const path = require("path");

const SANDBOX_DIR = "C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox";
const QxSandbox = require(path.join(SANDBOX_DIR, "qx-sandbox.js"));
const fengari = require(path.join(SANDBOX_DIR, "vendor", "fengari.bundle.js"));

const ROOT = "D:/输出目录/国际象棋";
const SRC = path.join(ROOT, "lua/levelScript.lua");
const base = fs.readFileSync(SRC, "utf8");

// 注意：levelScript.lua 是 CRLF 换行，多行字符串匹配会失败，这里统一用正则。
const IDS_RE = /    PW = \d+, NW = \d+, BW = \d+, RW = \d+, QW = \d+, KW = \d+,\r?\n    PB = \d+, NB = \d+, BB = \d+, RB = \d+, QB = \d+, KB = \d+,/;
if (!IDS_RE.test(base)) {
  console.error("IDS_RE_NOT_FOUND - 配置文本格式变了，请检查 CONFIG.PIECE_IMAGE_IDS");
  process.exit(3);
}
const IDS_ZERO = base.match(IDS_RE)[0];
const IDS_FULL = "    PW = 101, NW = 102, BW = 103, RW = 104, QW = 105, KW = 106,\r\n    PB = 111, NB = 112, BB = 113, RB = 114, QB = 115, KB = 116,";
const IDS_HALF = "    PW = 101, NW = 102, BW = 103, RW = 0, QW = 0, KW = 0,\r\n    PB = 0, NB = 0, BB = 0, RB = 0, QB = 0, KB = 0,";

function build(pieceImageIndex, idsText) {
  return base
    .replace("  CONTAINER_NODE_INDEX = 0,", "  CONTAINER_NODE_INDEX = 1,")
    .replace("  PREFAB_TEXT_BOX      = 0,", "  PREFAB_TEXT_BOX      = 1,")
    .replace("  PREFAB_CURSOR_AREA   = 0,", "  PREFAB_CURSOR_AREA   = 2,")
    .replace("  ENABLE_RAYCAST_FIELD = true,", "  ENABLE_RAYCAST_FIELD = false,")
    .replace("  PREFAB_PIECE_IMAGE   = 0,", "  PREFAB_PIECE_IMAGE   = " + pieceImageIndex + ",")
    .split(IDS_ZERO).join(idsText);
}

function runCase(name, src, expectCreated) {
  const sb = QxSandbox.createSandbox({ fengari, canvas: { width: 1600, height: 900 }, device: "Keyboard" });
  sb.installApi();
  if (!sb.load(src, "levelScript.lua")) {
    console.log("FAIL  " + name + ": 编译失败");
    return false;
  }
  sb.start();
  sb.runMs(800);
  const rep = sb.report({});
  const ok = rep.verdict === "pass" && rep.errors.length === 0 &&
             rep.unsupported.length === 0 && rep.controls.neverActivated === 0;
  const countOk = rep.controls.created === expectCreated;
  console.log((ok && countOk ? "PASS  " : "FAIL  ") + name);
  console.log("      verdict=" + rep.verdict + " errors=" + rep.errors.length +
              " unsupported=" + rep.unsupported.length +
              " neverActivated=" + rep.controls.neverActivated +
              " 控件=" + rep.controls.created + "（期望 " + expectCreated + "）" +
              (countOk ? "" : "  <- 不符"));
  if (rep.errors.length) {
    console.log("      errors: " + rep.errors.slice(0, 3).map(function (e) { return e.message.slice(0, 200); }).join(" | "));
  }
  sb.destroy();
  return ok && countOk;
}

let fails = 0;

if (!runCase("A 图片编号全填 -> 创建图片层并显示图片", build(3, IDS_FULL), 346)) fails++;
if (!runCase("B 图片编号只填一半 -> 图片层创建、显示回落符号", build(3, IDS_HALF), 346)) fails++;
if (!runCase("C 全不填（默认交付状态）-> 纯符号模式", build(0, IDS_ZERO), 282)) fails++;

console.log("\n" + (fails === 0 ? "ALL PASS（三种配置全部正确）" : fails + " FAILURES"));
process.exit(fails === 0 ? 0 : 2);
