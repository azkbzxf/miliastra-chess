// tools_work/measure_demo.mjs
// 在指定分辨率下打开交付包的 Demo，用页面内 __measure() 取真实布局，验证：
//   1) 所有元素都在画布内（leftPct >= 0, leftPct+wPct <= 100）
//   2) 棋盘与面板不重叠
//   3) 关键元素尺寸可读
// 这是 release 09 §三 的「真实量测」要求，不读期望值、只读 getBoundingClientRect。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "D:/输出目录/国际象棋";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const cases = [
  { name: "电脑16:9", w: 1600, h: 900 },
  { name: "手机16:9", w: 1280, h: 720 },
  { name: "手机19.5:9", w: 1560, h: 720 },
  { name: "手机4:3", w: 1280, h: 960 },
];

const PORT = 18089;

// 静态服务 + 接收量测结果
let result = null;
let resolveResult;
const done = new Promise(r => { resolveResult = r; });

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "POST") {
    let b = "";
    req.on("data", c => b += c);
    req.on("end", () => {
      try { result = JSON.parse(b); } catch (e) { result = { error: e.message }; }
      res.writeHead(200); res.end("ok");
      resolveResult(result);
    });
    return;
  }
  const u = req.url.split("?")[0];
  const f = path.join(ROOT, "out/交付包", u === "/" ? "chess_demo.html" : u.replace(/^\//, ""));
  if (fs.existsSync(f)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(f));
  } else { res.writeHead(404); res.end("nf"); }
});

await new Promise(r => server.listen(PORT, "127.0.0.1", r));
console.log("SERVER_READY");

const allResults = [];

for (const c of cases) {
  result = null;
  let resolveThis;
  const thisDone = new Promise(r => { resolveThis = r; });
  const origResolve = resolveResult;
  resolveResult = (v) => { resolveThis(v); origResolve(v); };

  const profileDir = path.join(process.env.TEMP || "/tmp", "edge_measure_" + c.w + "x" + c.h + "_" + Date.now());
  const url = `http://127.0.0.1:${PORT}/chess_demo.html?measure=1&reportPort=${PORT}`;
  const proc = spawn(EDGE, [
    `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check",
    "--disable-features=Translate,msEdgeSidebarV2,msImplicitSignin",
    "--force-device-scale-factor=1",
    `--window-size=${c.w},${c.h}`, "--window-position=0,0", `--app=${url}`,
  ], { stdio: "ignore" });

  const timer = setTimeout(() => resolveThis(null), 15000);
  await thisDone;
  clearTimeout(timer);
  try { proc.kill(); } catch {}

  if (!result || result.error) {
    allResults.push({ ...c, ok: false, note: "未取到量测结果: " + (result ? result.error : "timeout") });
    continue;
  }

  const items = result.items || result;
  // 校验
  const visible = items.filter(it => !it.hidden);
  const outOfBounds = visible.filter(it => it.leftPct < -0.5 || it.leftPct + it.wPct > 100.5);
  const board = items.find(it => it.id === "sq_0");
  const panel = items.find(it => it.id === "panelbg");
  const btnNew = items.find(it => it.id === "btnnew");
  const overlap = (board && panel)
    ? (board.leftPct + board.wPct) > panel.leftPct + 0.5
    : null;
  const btnHeightPx = btnNew ? Math.round(btnNew.hPct / 100 * c.h) : null;

  const ok = outOfBounds.length === 0 && overlap === false &&
             visible.length > 200 && (btnHeightPx === null || btnHeightPx >= 40);

  allResults.push({
    ...c, ok, itemCount: items.length,
    outOfBounds: outOfBounds.slice(0, 5).map(it => it.id),
    boardLeftPct: board ? board.leftPct : null,
    panelLeftPct: panel ? panel.leftPct : null,
    overlap, btnHeightPx,
    scale: result.scale,
    contentW: result.contentW, contentH: result.contentH,
  });
}

server.close();

console.log("\n=== 真实量测结果（交付包 Demo） ===\n");
for (const r of allResults) {
  if (r.note) { console.log(`${r.name}: FAIL ${r.note}`); continue; }
  console.log(
    `${r.name.padEnd(12)} 窗口${r.w}x${r.h}  内容${r.contentW}x${r.contentH} scale=${(r.scale||0).toFixed(3)}  ` +
    `元素=${r.itemCount}  棋盘left=${r.boardLeftPct}%  面板left=${r.panelLeftPct}%  ` +
    `重叠=${r.overlap}  按钮高=${r.btnHeightPx}px  越界=${r.outOfBounds.length ? r.outOfBounds.join(",") : "无"}  ` +
    (r.ok ? "PASS" : "FAIL")
  );
}

const fails = allResults.filter(r => !r.ok).length;
console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURES"}`);
process.exit(fails === 0 ? 0 : 2);
