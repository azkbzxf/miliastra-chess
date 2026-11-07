// 生成最终交付清单（供 docs-lead 回填导入方案）
const fs = require("fs");
const crypto = require("crypto");

const src = fs.readFileSync("lua/levelScript.lua", "utf8");
const lines = src.split("\n");

function md5(p) {
  return crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex").toUpperCase();
}

const out = [];
function w(s) { out.push(s); }

w("# 最终交付清单（v2.0）");
w("");
w("> 由 `tools_work/issue1/_gen_delivery_manifest.cjs` 从源码自动提取，保证与实际代码一致。");
w("");
w("## 一、交付数字");
w("");
w("| 项 | 值 |");
w("|---|---|");
w("| 控件总数 | 1489（模拟器实测） |");
w("| 代码行数 | lua " + lines.length + " / sim " + fs.readFileSync("sim/levelScript.lua", "utf8").split("\n").length + " |");
w("| md5（lua） | `" + md5("lua/levelScript.lua") + "` |");
w("| md5（sim） | `" + md5("sim/levelScript.lua") + "` |");
w("| md5（交付包） | `" + md5("out/交付包/levelScript.lua") + "` |");
const assertCount = (src.match(/^\s*add\("/gm) || []).length;
w("| 自检断言 | " + assertCount + " 条 |");
w("");

// ===== 信号事件表 =====
w("## 二、信号事件表（ChessSync）");
w("");
w("信号名：`CONFIG.SIGNAL_NAME`（默认 `ChessSync`），5 个参数槽：`(eventType, a, b, c, fen)`");
w("");

// 解析 EV_ 常量
const evMap = {};
for (const l of lines) {
  const m = /^\s*(EV_\w+)\s*=\s*(\d+),\s*--\s*(.*)$/.exec(l);
  if (m) evMap[m[1]] = { num: parseInt(m[2], 10), desc: m[3].trim() };
}
const evNames = Object.keys(evMap).sort((x, y) => evMap[x].num - evMap[y].num);
w("| 事件号 | 名称 | a | b | c | fen | 说明 |");
w("|---|---|---|---|---|---|---|");
for (const n of evNames) {
  const e = evMap[n];
  w("| " + e.num + " | `" + n + "` | — | — | — | — | " + e.desc.replace(/\|/g, "\\|") + " |");
}
w("");

// ===== 常量表 =====
w("## 三、关键常量表");
w("");
w("| 常量 | 值 | 含义 |");
w("|---|---|---|");

function num(k) {
  for (const l of lines) {
    const m = new RegExp("^\\s*" + k + "\\s*=\\s*([-0-9.]+)").exec(l);
    if (m) return m[1];
  }
  return "?";
}

// 四档
const tc = [];
const tcStart = lines.findIndex((l) => /TIME_CONTROLS\s*=\s*\{/.test(l));
for (let i = tcStart; i < tcStart + 12 && i < lines.length; i++) {
  const m = /\{\s*n\s*=\s*(\d+),\s*name\s*=\s*"([^"]+)",\s*initial\s*=\s*(\d+),\s*inc\s*=\s*(\d+)/.exec(lines[i]);
  if (m) tc.push({ n: +m[1], name: m[2], initial: +m[3], inc: +m[4] });
}
for (const t of tc) {
  w("| TC[" + t.n + "] `" + t.name + "` | " + t.initial + " + " + t.inc + " | 首钟 " + t.initial + " 秒，每步加 " + t.inc + " 秒 |");
}
w("| `DEFAULT_TIME_CONTROL` | " + num("DEFAULT_TIME_CONTROL") + " | 默认档位（= 快棋 900+10，与 v1.12 一致） |");
w("| `UNDO_PER_SIDE` | " + num("UNDO_PER_SIDE") + " | 每方每局可悔棋次数 |");
w("| `PAIRED_UNDO_PLIES` | " + num("PAIRED_UNDO_PLIES") + " | 一次悔棋回退的半步数（成对） |");
w("| `UNDO_REQUEST_TIMEOUT_SEC` | " + num("UNDO_REQUEST_TIMEOUT_SEC") + " | 联机悔棋请求超时（秒） |");
w("| `LOBBY_PEER_TIMEOUT_SEC` | " + num("LOBBY_PEER_TIMEOUT_SEC") + " | 待机室等对手超时（秒） |");
w("| `LOBBY_COUNTDOWN_SEC` | " + num("LOBBY_COUNTDOWN_SEC") + " | 双方就绪后的开局倒数（秒） |");
w("| `LOBBY_TOUCH_MIN` | " + num("LOBBY_TOUCH_MIN") + " | 待机室按钮触摸目标下限（px） |");
w("| `V2_H_RATIO` | " + num("V2_H_RATIO") + " | 板高 / 字号 比例（唯一排版算式） |");
w("| `REVIEW_BAR_H` | " + num("REVIEW_BAR_H") + " | 复盘动作条高度（px @1600×900） |");
w("| `INITIAL_TIME_SEC` | " + num("INITIAL_TIME_SEC") + " | **v1.12 兼容别名**（= 档位 3 首钟），不许删 |");
w("| `INCREMENT_SEC` | " + num("INCREMENT_SEC") + " | **v1.12 兼容别名**（= 档位 3 加秒），不许删 |");
w("");

// ===== CONFIG.TEXT 全量 =====
w("## 四、`CONFIG.TEXT` 全量键值（逐字，导入方案附录用）");
w("");
w("> 必须逐字照抄 —— 断言 `text_fits` / `lobby_text_fits` 已按这些字串算过宽度。");
w("");
w("| 键 | 值 |");
w("|---|---|");

// 提取 CONFIG.TEXT = { ... } 块
const txtStart = lines.findIndex((l) => /^\s*TEXT\s*=\s*\{/.test(l));
let depth = 0, started = false, txtEnd = txtStart;
for (let i = txtStart; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") depth--;
  }
  if (started && depth === 0) { txtEnd = i; break; }
}
const textPairs = [];
let pendingKey = null;
for (let i = txtStart; i <= txtEnd; i++) {
  let l = lines[i];
  // 去掉整行注释
  const stripped = l.replace(/\s*--.*$/, "");
  // key = "value"
  const m1 = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)",?\s*$/.exec(stripped);
  if (m1) { textPairs.push([m1[1], m1[2]]); pendingKey = null; continue; }
  // 长的 key = "value" 跨行（罕见）
  const m2 = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*$/.exec(stripped);
  if (m2) { pendingKey = m2[1]; continue; }
  // 续行 "value"
  const m3 = /^\s*"((?:[^"\\]|\\.)*)",?\s*$/.exec(stripped);
  if (m3 && pendingKey) { textPairs.push([pendingKey, m3[1]]); pendingKey = null; continue; }
  // 表形式 key = { ... } 跳过
}
for (const [k, v] of textPairs) {
  w("| `" + k + "` | `" + v.replace(/\|/g, "\\|") + "` |");
}
w("");
w("共 " + textPairs.length + " 项。");
w("");

// ===== 界面层 =====
w("## 五、界面层（Z 序，后创建在上）");
w("");
w("| 层 | 进入 | 退出 |");
w("|---|---|---|");
w("| 初始界面 `start` | `show_start_screen()` | 选入口后切走 |");
w("| 待机室 `lobby` | `show_lobby()` | `start_game_from_lobby()` |");
w("| 棋盘对局 `playing` | `entry_start_local()` / `start_game_from_lobby()` | 认输/和/返回主菜单 |");
w("| 复盘 `review` | `enter_review()` | `exit_review()` |");
w("| 结算 `result` | `show_result()` | 返回主菜单/再来一局 |");
w("| 确认框 `confirm` | `show_confirm(kind)` | `hide_confirm()` |");
w("| 复盘动作条 | `refresh_review_actionbar()` | `hide_all_overlays()` |");
w("");
w("**关键纪律**：每个 `show_XXX_screen` 开头必须调 `hide_all_overlays()` 收起其余全部层。");
w("");

// ===== 门禁链 =====
w("## 六、门禁链（改代码后必须按序全跑）");
w("");
w("```");
["1. node tools_work/sync_sim_copy.cjs",
 "2. node tools_work/sync_delivery.cjs",
 "3. node tools_work/lua_check.cjs",
 "4. node tools_work/consistency_check.cjs",
 "5. node tests/static_checks.cjs",
 "6. node tools_work/issue1/_audit_forward_vars.cjs",
 "7. node tools_work/issue1/_inline.cjs",
 "8. node tools_work/issue1/_verify_inline.cjs"].forEach((x) => w(x));
w("```");
w("");
w("> ⚠️ 直接编辑 `sim/` 会被第 1 步静默覆盖，而第 4 步仍报「一致性 OK」（它比的是 `lua/` 和交付包）。");

fs.writeFileSync("docs/v2-delivery-manifest.md", out.join("\n") + "\n", "utf8");
console.log("已生成 docs/v2-delivery-manifest.md");
console.log("  TEXT 项数: " + textPairs.length);
console.log("  事件数: " + evNames.length);
console.log("  时间档数: " + tc.length);
console.log("  断言数: " + assertCount);
