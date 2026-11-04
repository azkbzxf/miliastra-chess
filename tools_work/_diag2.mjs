import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = "D:/输出目录/国际象棋";
const PORT = 18111;
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET") {
    const u = req.url.split("?")[0];
    const f = path.join(ROOT, "proto", u === "/" ? "chess_demo.html" : u.replace(/^\//, ""));
    if (fs.existsSync(f)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(f));
    } else { res.writeHead(404); res.end("nf"); }
    return;
  }
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => { console.log("REPORT:", b.slice(0, 900)); res.writeHead(200); res.end("ok"); });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log("LISTEN " + PORT);

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const url = `http://127.0.0.1:${PORT}/_diag_demo.html?selftest=1&reportPort=${PORT}`;
const p = spawn(EDGE, [
  `--user-data-dir=${process.env.TEMP}/edge_diag`,
  "--no-first-run", "--no-default-browser-check",
  "--force-device-scale-factor=1", "--window-size=1600,900", "--window-position=0,0",
  `--app=${url}`,
], { stdio: "ignore" });
p.on("error", (e) => console.log("SPAWN_ERR " + e.message));

setTimeout(() => { try { p.kill(); } catch {} server.close(); process.exit(0); }, 25000);
