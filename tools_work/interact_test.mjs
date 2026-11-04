// tools_work/interact_test.mjs
// 在真实 Edge 里做「点击走子 + 截屏」验证：用 --play 序列驱动点击，再截图。
// 做法：页面支持 ?auto=<JSON> 参数，boot 后自动执行点击序列（只用于验证，不影响交付版本）。
// 这里用 URL 参数传一个简单序列：点击 e2 → 点击 e4 → 截图。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "D:/输出目录/国际象棋";
const PORT = 18093;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

// 序列：点 e2(格号12) → 点 e4(格号28)
// 屏幕坐标由页面自己算（页面内用 sqPos）
const autoSeq = JSON.stringify([12, 28]);

const server = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  const f = path.join(ROOT, "proto", u === "/" ? "chess_demo.html" : u.replace(/^\//, ""));
  if (fs.existsSync(f)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(f));
  } else { res.writeHead(404); res.end("nf"); }
});
server.listen(PORT, "127.0.0.1");
console.log("LISTEN", PORT);

const url = `http://127.0.0.1:${PORT}/chess_demo.html?auto=${encodeURIComponent(autoSeq)}`;
const profileDir = path.join(process.env.TEMP || "/tmp", "edge_interact_profile");
const proc = spawn(EDGE, [
  `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check",
  "--force-device-scale-factor=1", "--window-size=1600,900", "--window-position=0,0",
  `--app=${url}`,
], { stdio: "ignore" });

// 等页面加载 + 自动点击完成
await new Promise(r => setTimeout(r, 8000));

// 截屏
const { execFile } = await import("node:child_process");
await new Promise((resolve) => {
  execFile("pwsh", ["-NoProfile", "-File", path.join(ROOT, "tools_work/shot.ps1"),
    "-Url", url, "-Out", path.join(ROOT, "reports/interact_test.png"), "-WaitSec", "1"],
    { timeout: 60000 }, (err, stdout) => {
      console.log(stdout || err);
      resolve();
    });
});

try { proc.kill(); } catch {}
server.close();
console.log("DONE");
