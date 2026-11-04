// tools_work/probe_layout.mjs
// 在指定窗口尺寸下打开交付包 Demo，读回真实的 viewport/stage/board/panel 几何值。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "D:/输出目录/国际象棋";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 18087;
const W = Number(process.argv[2] || 1280);
const H = Number(process.argv[3] || 720);

let resolveR;
const done = new Promise(r => { resolveR = r; });

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "POST") {
    let b = ""; req.on("data", c => b += c);
    req.on("end", () => {
      try { res.writeHead(200); res.end("ok"); resolveR(JSON.parse(b)); }
      catch (e) { resolveR({ error: e.message }); }
    });
    return;
  }
  const u = req.url.split("?")[0];
  const f = path.join(ROOT, "out/交付包", u === "/" ? "chess_demo.html" : u.replace(/^\//, ""));
  if (fs.existsSync(f)) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(fs.readFileSync(f)); }
  else { res.writeHead(404); res.end("nf"); }
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const profileDir = path.join(process.env.TEMP || "/tmp", "edge_probe_" + W + "_" + Date.now());
const url = `http://127.0.0.1:${PORT}/chess_demo.html?probe=1&reportPort=${PORT}`;
const proc = spawn(EDGE, [
  `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check",
  "--disable-features=Translate,msEdgeSidebarV2,msImplicitSignin",
  "--force-device-scale-factor=1", `--window-size=${W},${H}`, "--window-position=0,0", `--app=${url}`,
], { stdio: "ignore" });

const t = setTimeout(() => resolveR({ error: "timeout" }), 15000);
const r = await done;
clearTimeout(t);
try { proc.kill(); } catch {}
server.close();

console.log(JSON.stringify(r, null, 2));
