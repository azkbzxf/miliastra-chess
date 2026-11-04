// tools_work/verify_demo.mjs
// 用真实 Edge 打开 Demo，执行页面内自检探针，把结果取回来。
// 做法：Edge 以 --app 模式打开带 ?selftest=1 的 URL，页面自检完成后把结果写进
//       document.title 和 localStorage；本脚本用 --remote-debugging-port 读 CDP 拿结果。
//
// 更简单可靠的做法：让页面把自检结果 POST 到本地 HTTP 服务，本脚本起服务并接收。
// 这里用后者（不依赖 CDP，最稳）。
//
// 用法：node tools_work/verify_demo.mjs <demo.html路径> [waitMs]
// 退出码：0 = ok:true / 2 = 自检失败 / 3 = 用法或文件错误
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const demoArg = process.argv[2] || path.join(ROOT, "proto/chess_demo.html");
const waitMs = Number(process.argv[3] || 20000);

if (!fs.existsSync(demoArg)) {
  console.error("DEMO_NOT_FOUND " + demoArg);
  process.exit(3);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
if (!fs.existsSync(EDGE)) {
  console.error("EDGE_NOT_FOUND " + EDGE);
  process.exit(3);
}

const PORT = 18099;
let result = null;
let resolveResult;
const done = new Promise((res) => { resolveResult = res; });

// 同时托管 proto 目录（避免 file:// 的 CORS 限制）并接收 POST 回来的自检结果
const PROTO_DIR = path.join(ROOT, "proto");
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET") {
    const u = req.url.split("?")[0];
    if (u === "/report") { res.writeHead(200); res.end("ok"); return; }
    const f = path.join(PROTO_DIR, u === "/" ? "chess_demo.html" : u.replace(/^\//, ""));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(f));
    } else {
      res.writeHead(404); res.end("not found");
    }
    return;
  }
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    try {
      result = JSON.parse(body);
    } catch (e) {
      result = { ok: false, error: "bad json: " + body.slice(0, 400) };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"received":true}');
    resolveResult(result);
  });
});

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log("REPORT_SERVER_LISTENING " + PORT);

// 用 file:// 打开，页面会 POST 到 127.0.0.1:PORT
const fileUrl = "http://127.0.0.1:" + PORT + "/chess_demo.html?selftest=1&reportPort=" + PORT;
const profileDir = path.join(process.env.TEMP || "/tmp", "edge_selftest_profile");

const args = [
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-features=Translate,msEdgeSidebarV2",
  "--force-device-scale-factor=1",
  "--window-size=1600,900",
  "--window-position=0,0",
  `--app=${fileUrl}`,
];
const proc = spawn(EDGE, args, { detached: false, stdio: "ignore" });

const timer = setTimeout(() => {
  if (!result) resolveResult({ ok: false, error: "TIMEOUT: 页面没有在 " + waitMs + "ms 内回报自检结果" });
}, waitMs);

try { await done; } catch (e) { /* ignore */ }
clearTimeout(timer);

try { proc.kill(); } catch {}
server.close();

if (!result) {
  console.error("NO_RESULT");
  process.exit(2);
}

console.log(JSON.stringify(result, null, 1));

const ok = result.ok === true;
if (!ok) {
  console.error("\nSELFTEST_FAILED");
  process.exit(2);
}
console.log("\nSELFTEST_PASSED");
process.exit(0);
