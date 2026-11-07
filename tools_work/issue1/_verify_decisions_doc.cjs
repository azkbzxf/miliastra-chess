// 校验 v2-decisions.md 里的事实性陈述与代码是否一致
const fs = require("fs");
const lua = fs.readFileSync("lua/levelScript.lua", "utf8");
const doc = fs.readFileSync("docs/v2-decisions.md", "utf8");

const checks = [];
function chk(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || "" });
}

// 1. 四档时间控制
chk("四档 60+0", /initial = 60,?\s+inc = 0/.test(lua));
chk("四档 180+2", /initial = 180,?\s+inc = 2/.test(lua));
chk("四档 900+10", /initial = 900,?\s+inc = 10/.test(lua));
chk("四档 5400+30", /initial = 5400,?\s+inc = 30/.test(lua));
chk("默认档位 3", /DEFAULT_TIME_CONTROL = 3/.test(lua));
chk("INITIAL_TIME_SEC=900", /INITIAL_TIME_SEC\s*=\s*900/.test(lua));
chk("INCREMENT_SEC=10", /INCREMENT_SEC\s*=\s*10/.test(lua));

// 2. 悔棋
chk("UNDO_PER_SIDE=3", /UNDO_PER_SIDE\s*=\s*3/.test(lua));
chk("PAIRED_UNDO_PLIES=2", /PAIRED_UNDO_PLIES\s*=\s*2/.test(lua));
chk("UNDO_REQUEST_TIMEOUT_SEC=15", /UNDO_REQUEST_TIMEOUT_SEC\s*=\s*15/.test(lua));

// 3. 复盘
chk("branch_ensure 存在", /branch_ensure/.test(lua));
chk("branch_move 存在", /branch_move/.test(lua));
chk("branch_back 存在", /branch_back/.test(lua));
chk("退回主变文案", /BTN_BRANCH_BACK/.test(lua));
chk("从此开新局文案", /BTN_BRANCH_NEW/.test(lua));

// 4. 联机
chk("LOBBY_COUNTDOWN_SEC=3", /LOBBY_COUNTDOWN_SEC\s*=\s*3/.test(lua));
chk("LOBBY_PEER_TIMEOUT_SEC=15", /LOBBY_PEER_TIMEOUT_SEC\s*=\s*15/.test(lua));
chk("hide_all_overlays 定义", /local function hide_all_overlays/.test(lua));
// 只数可执行调用点（排除注释行和定义行）
const overlaySites = lua.split("\n").filter((l) => {
  const t = l.trim();
  return t.indexOf("hide_all_overlays()") >= 0
    && !t.startsWith("--")
    && t !== "local function hide_all_overlays()";
}).length;
chk("hide_all_overlays 调用 6 处（5 生产 + 1 自检）", overlaySites === 6, "实际 " + overlaySites);

// 5. U-1
chk("EV_ROLE 存在", /EV_ROLE/.test(lua));
chk("mySide 默认 1", /mySide\s*=\s*1,/.test(lua));

// 6. 2.1 规则
chk("V2_H_RATIO=2.1", /V2_H_RATIO\s*=\s*2\.1/.test(lua));
chk("fit_h 存在", /fit_h/.test(lua));
chk("font_for_h 存在", /font_for_h/.test(lua));
chk("START_TITLE=64", /START_TITLE\s*=\s*64/.test(lua));

// 7. 方案 T
chk("make_self_token 存在", /make_self_token/.test(lua));
chk("__myReadyToken 存在", /__myReadyToken/.test(lua));
chk("__myStartToken 存在", /__myStartToken/.test(lua));
chk("params[5] 已提取", /local fen = params\[5\]/.test(lua));
const osClock = lua.split("\n").filter((l) => /os\.clock/.test(l) && !l.trim().startsWith("--"));
chk("os.clock 无代码引用", osClock.length === 0, "实际 " + osClock.length + " 处");
const grace = lua.split("\n").filter((l) => /LOBBY_START_GRACE_SEC/.test(l) && !l.trim().startsWith("--"));
chk("LOBBY_START_GRACE_SEC 无代码引用", grace.length === 0, "实际 " + grace.length + " 处");

// 8. 自检零副作用
chk("inSelfTest 存在", /inSelfTest/.test(lua));
chk("net_send_event 有闸", /if GAME\.inSelfTest then return false end/.test(lua));
chk("pcall(SelfTest) 包装", /local okCall, res = pcall\(function\(\)/.test(lua));

// 9. 断言数
const cnt = (lua.match(/^\s*add\("/gm) || []).length;
chk("断言 28 条", cnt === 28, "实际 " + cnt);

// 10. 文档中的 md5 与实际一致
const crypto = require("crypto");
const md5 = crypto.createHash("md5").update(fs.readFileSync("lua/levelScript.lua")).digest("hex").toUpperCase();
chk("文档 md5 与实际一致", doc.indexOf(md5) >= 0, "实际 md5=" + md5);

// 11. 文档里的行数
const lines = lua.split("\n").length;
chk("文档行数与实际接近", Math.abs(parseInt((doc.match(/（(\d+) 行/) || [])[1] || "0", 10) - lines) <= 3,
  "实际 " + lines + " 行");

// 输出
let pass = 0;
for (const c of checks) {
  console.log((c.ok ? "  OK   " : "  FAIL ") + c.name + (c.detail ? "  [" + c.detail + "]" : ""));
  if (c.ok) pass++;
}
console.log("\n" + pass + "/" + checks.length + " 项一致");
process.exit(pass === checks.length ? 0 : 1);
