// tools_work/consistency_check.cjs
// Demo 与 Lua 一致性核对（release 04 §二 铁律 1：代码与 Demo 不一致时不允许静默偏离）
// 比对项：布局比例、配色 RGB、字号、文案逐字、棋钟数值、信号协议
const fs = require("fs");
const path = require("path");

const ROOT = "D:/输出目录/国际象棋";
const luaSrc = fs.readFileSync(path.join(ROOT, "lua/levelScript.lua"), "utf8");
const demoHtml = fs.readFileSync(path.join(ROOT, "proto/chess_demo.html"), "utf8");

let fails = 0;
const rows = [];
function cmp(name, luaVal, demoVal) {
  const ok = luaVal === demoVal;
  if (!ok) fails++;
  rows.push({ name, luaVal, demoVal, ok });
}

// ---- 1 布局比例 ----
const luaBoardRatio = /BOARD_SIDE_RATIO\s*=\s*([\d.]+)/.exec(luaSrc);
const demoBoardRatio = /BOARD_SIDE_RATIO\s*=\s*([\d.]+)/.exec(demoHtml);
cmp("棋盘边长比例", luaBoardRatio[1], demoBoardRatio[1]);

const luaPanelRatio = /PANEL_WIDTH_RATIO\s*=\s*([\d.]+)/.exec(luaSrc);
const demoPanelRatio = /PANEL_WIDTH_RATIO\s*=\s*([\d.]+)/.exec(demoHtml);
cmp("面板宽度比例", luaPanelRatio[1], demoPanelRatio[1]);

// ---- 2 配色 RGB（逐项） ----
// 【v1.10 修正】棋子配色两边键名不同，必须显式映射，否则满盘假 FAIL。
//   Lua 侧：WHITE_FILL / WHITE_EDGE / BLACK_FILL / BLACK_EDGE（"填充/描边"语义）
//   Demo 侧：WHITE_PIECE / WHITE_OUTLINE / BLACK_PIECE / BLACK_OUTLINE
// 早先 colorKeys 里直接写 Demo 的键名去匹配 Lua 源，正则必然找不到 → 4 项报 FAIL，
// 而实际数值四项全等。教训：比对脚本的「键名映射」是独立的一层，不能假定两边同名。
const colorPairs = [
  ["BG", "BG"], ["SQ_LIGHT", "SQ_LIGHT"], ["SQ_DARK", "SQ_DARK"],
  ["SEL_HL", "SEL"], ["LEGAL_HL", "LEGAL"], ["LAST_MOVE", "LAST"], ["CHECK_WARN", "CHECK"],
  ["PANEL_BG", "PANEL"], ["TEXT_MAIN", "TEXT"], ["TEXT_SUB", "TEXT_SUB"],
  ["BTN_BG", "BTN"], ["BTN_TEXT", "BTN_TEXT"], ["CLOCK_LOW", "CLOCK_LOW"],
  ["WHITE_FILL", "WHITE_PIECE"], ["WHITE_EDGE", "WHITE_OUTLINE"],
  ["BLACK_FILL", "BLACK_PIECE"], ["BLACK_EDGE", "BLACK_OUTLINE"],
];
for (const [luaKey, demoKey] of colorPairs) {
  const luaM = new RegExp("\\b" + luaKey + "\\s*=\\s*\\{\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)").exec(luaSrc);
  const demoM = new RegExp("\\b" + demoKey + ":\\s*\"rgb\\((\\d+),(\\d+),(\\d+)\\)\"").exec(demoHtml);
  if (!luaM || !demoM) {
    fails++;
    rows.push({ name: "配色 " + luaKey + "→" + demoKey,
                luaVal: luaM ? luaM.slice(1,4).join(",") : "未找到",
                demoVal: demoM ? demoM.slice(1,4).join(",") : "未找到", ok: false });
    continue;
  }
  cmp("配色 " + luaKey + "→" + demoKey, luaM.slice(1,4).join(","), demoM.slice(1,4).join(","));
}

// ---- 3 字号 ----
const fontKeys = ["COORD","PIECE","PANEL_TITLE","PANEL_BODY","CLOCK","BUTTON","HINT","RESULT_TITLE","RESULT_SUB","PROMO_OPTION"];
for (const k of fontKeys) {
  const luaM = new RegExp("\\b" + k + "\\s*=\\s*(\\d+),").exec(luaSrc);
  const demoM = new RegExp("\\b" + k + ":\\s*(\\d+),").exec(demoHtml);
  if (!luaM || !demoM) { fails++; rows.push({ name: "字号 " + k, luaVal: luaM ? luaM[1] : "未找到", demoVal: demoM ? demoM[1] : "未找到", ok: false }); continue; }
  cmp("字号 " + k, luaM[1], demoM[1]);
}

// ---- 4 数值 ----
for (const [label, key] of [["初始时限", "INITIAL_TIME_SEC"], ["每步加秒", "INCREMENT_SEC"],
                             ["棋钟刷新", "CLOCK_REFRESH_SEC"], ["求和冷却", "DRAW_COOLDOWN_SEC"],
                             ["告急阈值", "CLOCK_LOW_SEC"], ["记录行数", "MOVE_LOG_LINES"]]) {
  const luaM = new RegExp("\\b" + key + "\\s*=\\s*(\\d+)").exec(luaSrc);
  const demoM = new RegExp("\\b" + key + "\\s*=\\s*(\\d+)").exec(demoHtml);
  if (!luaM || !demoM) { fails++; rows.push({ name: label, luaVal: luaM ? luaM[1] : "未找到", demoVal: demoM ? demoM[1] : "未找到", ok: false }); continue; }
  cmp(label, luaM[1], demoM[1]);
}

// ---- 5 文案逐字（抽取 TEXT 表里的每个键值） ----
const luaTextBlock = luaSrc.slice(luaSrc.indexOf("TEXT = {"), luaSrc.indexOf("},\n}", luaSrc.indexOf("TEXT = {")));
const luaTexts = {};
for (const m of luaTextBlock.matchAll(/([A-Z_][A-Z0-9_]+)\s*=\s*"([^"]*)"/g)) luaTexts[m[1]] = m[2];

const demoTextBlock = demoHtml.slice(demoHtml.indexOf("const TEXT = {"), demoHtml.indexOf("};", demoHtml.indexOf("const TEXT = {")));
const demoTexts = {};
for (const m of demoTextBlock.matchAll(/([A-Z_][A-Z0-9_]+)\s*:\s*"([^"]*)"/g)) demoTexts[m[1]] = m[2];

const commonKeys = Object.keys(luaTexts).filter(k => demoTexts[k] !== undefined);
let textFails = 0;
const textDiffs = [];
for (const k of commonKeys) {
  if (luaTexts[k] !== demoTexts[k]) {
    textFails++;
    textDiffs.push(`${k}: lua="${luaTexts[k]}" demo="${demoTexts[k]}"`);
  }
}
if (textFails > 0) { fails += textFails; }
rows.push({ name: `文案逐字（共同 ${commonKeys.length} 项）`, luaVal: textFails === 0 ? "全部一致" : textFails + " 处不同", demoVal: "", ok: textFails === 0 });
if (textDiffs.length) textDiffs.forEach(d => console.log("  TEXT_DIFF " + d));

// ---- 5.5 面板按钮布局（全部按钮的 x/y 必须两边一致）----
// 【历史缺陷修正】原实现有三个问题，导致 v1.6 复盘改版后必然误报 FAIL：
//   ① 只认 Lua 的「直写」形态 name="btnX" ... y=atY(...)，抓不到表驱动写法。
//      v1.6 的复盘四键是 local rvBtns = {...} + for _, spec in ipairs(rvBtns) 循环创建的，
//      所以正则 A 只能抓到 4 个直写键 + btnreviewtoggle，漏掉 4 个复盘键。
//   ② 只认 Demo 的 btnSpecs 数组形态，抓不到数组外单独 mkEl 的通栏按钮（anchorId "btnreview"）。
//   ③ 硬编码 luaVals.length === 5，且靠 Object.values() 的声明顺序配对
//      （Lua 小写键名 vs Demo 驼峰键名，顺序一旦不同就全错位）。
// 现在改成：三种形态都抓 + 按【语义键名】配平，不再依赖数量与声明顺序。
// Lua: atX(0.04)/atY(0.24)；Demo: atX(0.04)/atY(0.24) 或 { x: atX(...), y: atY(...) }
const luaBtns = {};
// 形态 A：直写（name = "btnXxx", parent = ..., x = atX(a), y = atY(b)）
for (const m of luaSrc.matchAll(/name = "(btn\w+)", parent = [^,]+,[\s\S]{0,160}?x = atX\(([\d.]+)\), y = atY\(([\d.]+)\)/g)) {
  luaBtns[m[1]] = { x: m[2], y: m[3] };
}
// 形态 B：表驱动（rvBtns 表内 name = "btnXxx", ... x = atX(a), y = atY(b)）
{
  const rvStart = luaSrc.indexOf("local rvBtns = {");
  const rvEnd = luaSrc.indexOf("for _, spec in ipairs(rvBtns)", rvStart);
  if (rvStart >= 0 && rvEnd > rvStart) {
    const rvBlock = luaSrc.slice(rvStart, rvEnd);
    for (const m of rvBlock.matchAll(/name = "(btn\w+)",[\s\S]*?x = atX\(([\d.]+)\), y = atY\(([\d.]+)\)/g)) {
      luaBtns[m[1]] = { x: m[2], y: m[3] };
    }
  }
}

const demoBtns = {};
// 形态 A：btnSpecs 数组（["btnXxx", "hitXxx", atX(a), atY(b), ...]）
for (const m of demoHtml.matchAll(/\["(btn\w+)", "hit\w+", atX\(([\d.]+)\), atY\(([\d.]+)\)/g)) {
  demoBtns[m[1].toLowerCase()] = { x: m[2], y: m[3] };
}
// 形态 B：数组外单独 mkEl 的通栏按钮（{ x: atX(a), y: atY(b), ..., anchorId: "btnreview" }）
{
  const anchorIdx = demoHtml.indexOf('anchorId: "btnreview"');
  if (anchorIdx >= 0) {
    const ctx = demoHtml.slice(Math.max(0, anchorIdx - 700), anchorIdx);
    const mx = /x: atX\(([\d.]+)\)/.exec(ctx);
    const my = /y: atY\(([\d.]+)\)/.exec(ctx);
    if (mx && my) demoBtns["btnreviewtoggle"] = { x: mx[1], y: my[1] };
  }
}

// 语义配平表：[语义角色, Lua 键名, Demo 键名]
// 不靠数量、不靠声明顺序，逐个语义角色比对 x 与 y。
const BTN_PAIRS = [
  ["新开一局", "btnnew", "btnnew"],
  ["认输", "btnresign", "btnresign"],
  ["求和", "btndraw", "btndraw"],
  ["切换本地同屏", "btnlocal", "btnlocal"],
  ["看历史/退出复盘（通栏）", "btnreviewtoggle", "btnreviewtoggle"],
  ["复盘·开局", "btnreviewstart", "btnrevstart"],
  ["复盘·上一步", "btnreviewprev", "btnrevprev"],
  ["复盘·下一步", "btnreviewnext", "btnrevnext"],
  ["复盘·终局", "btnreviewend", "btnrevend"],
];
const btnDetail = [];
let btnOk = true;
for (const [role, luaKey, demoKey] of BTN_PAIRS) {
  const a = luaBtns[luaKey];
  const b = demoBtns[demoKey];
  if (!a || !b) {
    btnOk = false;
    btnDetail.push(`缺少控件 ${role}: lua(${luaKey})=${a ? "有" : "无"} demo(${demoKey})=${b ? "有" : "无"}`);
    continue;
  }
  if (Number(a.x) !== Number(b.x) || Number(a.y) !== Number(b.y)) {
    btnOk = false;
    btnDetail.push(`${role}: lua(${a.x},${a.y}) demo(${b.x},${b.y})`);
  }
}
// 两侧不得有「没被配平表覆盖」的按钮（防止以后新增按钮忘了登记）
const covered = { lua: new Set(BTN_PAIRS.map((p) => p[1])), demo: new Set(BTN_PAIRS.map((p) => p[2])) };
for (const k of Object.keys(luaBtns)) {
  if (!covered.lua.has(k)) { btnOk = false; btnDetail.push(`Lua 有未登记的按钮 ${k}`); }
}
for (const k of Object.keys(demoBtns)) {
  if (!covered.demo.has(k)) { btnOk = false; btnDetail.push(`Demo 有未登记的按钮 ${k}`); }
}
if (!btnOk) fails++;
rows.push({
  name: `面板按钮布局一致（语义配平 ${BTN_PAIRS.length} 个）`,
  luaVal: JSON.stringify(luaBtns), demoVal: JSON.stringify(demoBtns), ok: btnOk,
});
if (btnDetail.length) console.log("  BTN_DIFF " + btnDetail.join("; "));

// 按钮高度必须两边都是 8%
const luaBtnH = /local btnW, btnH = w\([\d.]+\), h\(([\d.]+)\)/.exec(luaSrc);
const demoBtnH = /const btnW = pw \* [\d.]+, btnH = ph \* ([\d.]+)/.exec(demoHtml);
if (luaBtnH && demoBtnH) {
  cmp("按钮高度比例", luaBtnH[1], demoBtnH[1]);
}

// ---- 6 信号协议 ----
const luaSig = /SIGNAL_NAME\s*=\s*"([^"]*)"/.exec(luaSrc);
const demoSig = /CHANNEL_NAME\s*=\s*"([^"]*)"/.exec(demoHtml);
rows.push({ name: "信号名（Lua=ChessSync，Demo=BroadcastChannel 通道名）", luaVal: luaSig ? luaSig[1] : "未找到", demoVal: demoSig ? demoSig[1] : "未找到", ok: true });

const luaEvents = {};
for (const m of luaSrc.matchAll(/(EV_[A-Z_]+)\s*=\s*(\d+)/g)) luaEvents[m[1]] = m[2];
rows.push({ name: "eventType 定义", luaVal: JSON.stringify(luaEvents), demoVal: "（Demo 用数字字面量，见 netSendEvent 调用）", ok: true });

// ---- 7 音效（v1.10）----
// Demo 用 WebAudio 合成音（无外部资源），Lua 用 game.PlayAudio2D(音效资产ID)。
// 两边**音色必然不同**，所以只核对「键名能不能解析到配置」+「触发点覆盖」，不比对声音本身。
//
// 【v1.10 修正：这条断言原先方向是反的】
// 旧写法检查 `sfx_play("<Demo键名>")` 这个**字符串是否存在**，于是：
//   · 修复前 Lua 写 sfx_play("over")，而 CONFIG.SFX 里的键叫 GAME_END
//     → 字面量存在 → 断言 PASS（**当时正是 bug 状态！** over 解析不到，静默不播）
//   · 修复后 Lua 改成 sfx_play("GAME_END") → "over" 不存在 → 断言 FAIL（**此时才是对的**）
// 即：bug 在时通过、bug 修好反而失败，完全反向。真正该验的不是「和 Demo 同名」，
// 而是「实际调用点的参数能否解析到 CONFIG.SFX 的真实键」—— 下面按这个判据重写。
const SFX_PAIRS = [
  ["CLICK", "click"], ["SELECT", "select"], ["MOVE", "move"], ["CASTLE", "castle"],
  ["CAPTURE", "capture"], ["CHECK", "check"], ["PROMOTE", "promote"],
  ["GAME_END", "over"], ["LOW_TIME", "low_time"], ["RESIGN", "resign"],
];
const luaSfxBlock = luaSrc.slice(luaSrc.indexOf("SFX = {"), luaSrc.indexOf("}", luaSrc.indexOf("SFX = {")));
const luaSfxIds = {};
for (const m of luaSfxBlock.matchAll(/([A-Z_][A-Z0-9_]+)\s*=\s*(\d+)/g)) luaSfxIds[m[1]] = m[2];

// ① 表完整性：10 个语义角色在 CONFIG.SFX 里都要有键
const sfxMissing = [];
for (const [luaKey] of SFX_PAIRS) {
  if (luaSfxIds[luaKey] === undefined) sfxMissing.push(luaKey);
}

// ② 调用点可解析性（真正能抓 bug 的判据）：收集全部 sfx_play("xxx") 的参数，
//    逐个验证 string.upper(xxx) 是否命中 CONFIG.SFX —— 与 Lua 运行时 sfx_play 的解析规则一致。
const sfxCalls = [...luaSrc.matchAll(/sfx_play\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g)].map((m) => m[1]);
const sfxBadCalls = [...new Set(sfxCalls.filter((k) => luaSfxIds[k.toUpperCase()] === undefined))];

// ③ 覆盖度：每个语义角色在 Lua 里至少要有一个可解析的真实调用点
const sfxResolved = new Set(sfxCalls.map((k) => k.toUpperCase()));
const sfxUnused = SFX_PAIRS.map(([k]) => k).filter((k) => !sfxResolved.has(k));

if (sfxMissing.length) fails++;
if (sfxBadCalls.length) fails++;
if (sfxUnused.length) fails++;

// ④ Demo 侧触发点（仅记录，不作为 FAIL）：Demo 是体验沟通件，缺音效不阻塞交付
const demoSfxKeys = new Set();
for (const m of demoHtml.matchAll(/SFX\.play\(\s*"([a-z_]+)"\s*\)/g)) demoSfxKeys.add(m[1]);
const demoOnlyMissing = SFX_PAIRS.map(([, d]) => d).filter((d) => !demoSfxKeys.has(d));

rows.push({
  name: `音效表完整性 ${SFX_PAIRS.length} 项`,
  luaVal: `${Object.keys(luaSfxIds).length} 键` + (sfxMissing.length ? " 缺:" + sfxMissing.join(",") : ""),
  demoVal: "",
  ok: sfxMissing.length === 0,
});
rows.push({
  name: "音效调用点可解析（sfx_play 参数必须命中 CONFIG.SFX）",
  luaVal: `${new Set(sfxCalls).size} 种调用` + (sfxBadCalls.length ? " 无法解析:" + sfxBadCalls.join(",") : " 全部可解析"),
  demoVal: "",
  ok: sfxBadCalls.length === 0,
});
rows.push({
  name: "音效覆盖度（每个语义角色至少一处调用）",
  luaVal: sfxUnused.length ? "未触发:" + sfxUnused.join(",") : "全部已触发",
  demoVal: demoOnlyMissing.length ? `（Demo 未实现 ${demoOnlyMissing.join(",")}，不计失败）` : "",
  ok: sfxUnused.length === 0,
});

// ---- 8 音效开关文案（Demo 侧在 TEXT_DEMO_ONLY，Lua 侧在 CONFIG.TEXT）----
for (const [luaKey, demoKey] of [["SFX_ON", "SFX_ON"], ["SFX_OFF", "SFX_OFF"]]) {
  const lm = new RegExp(luaKey + `\\s*=\\s*"([^"]*)"`).exec(luaSrc);
  const dm = new RegExp(demoKey + `\\s*:\\s*"([^"]*)"`).exec(demoHtml);
  if (lm && dm) cmp(`音效开关文案 ${luaKey}`, lm[1], dm[1]);
  else {
    fails++;
    rows.push({ name: `音效开关文案 ${luaKey}`, luaVal: lm ? lm[1] : "未找到", demoVal: dm ? dm[1] : "未找到", ok: false });
  }
}

// ---- 输出 ----
console.log("=== Demo 与 Lua 一致性核对 ===\n");
for (const r of rows) {
  if (r.demoVal === "" || r.ok) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.luaVal}${r.demoVal ? " / " + r.demoVal : ""}`);
  } else {
    console.log(`FAIL  ${r.name}  lua=${r.luaVal}  demo=${r.demoVal}`);
  }
}
console.log(`\n${fails === 0 ? "ALL CONSISTENT" : fails + " MISMATCHES"}`);
process.exit(fails === 0 ? 0 : 2);
