#!/usr/bin/env node
// tests/run-baseline.cjs
// ---------------------------------------------------------------------------
// 复跑「修复前 Red 证据」：把 git HEAD 的三份 levelScript.lua 导出到临时目录，
// 再用 static_checks.cjs 的 --root 指向它跑同一套断言。
//
// 用法：
//   node tests/run-baseline.cjs                 # 对比 HEAD，输出到 stdout
//   node tests/run-baseline.cjs --rev=<sha>     # 换一个提交
//   node tests/run-baseline.cjs --keep          # 保留导出的基线目录（不删临时目录）
//
// 为什么要有它：
//   修复过程中工作区里的 lua/levelScript.lua 会被改动，直接跑 static_checks.cjs
//   得到的只会是「当前状态」，没法当「修复前」的证据。用 HEAD 导出 → 复跑，
//   Red 证据就变成一条命令可重现的结论，而不是一张截图。
//
// 只读 + 临时目录：不会覆盖工作区里的任何文件，默认跑完就删。
// ---------------------------------------------------------------------------

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const TOOL_ROOT = path.resolve(__dirname, "..");
const revArg = process.argv.find((a) => a.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : "HEAD";
const KEEP = process.argv.includes("--keep");

const FILES = [
  ["lua/levelScript.lua", "lua/levelScript.lua"],
  ["sim/levelScript.lua", "sim/levelScript.lua"],
  ["out/交付包/levelScript.lua", "out/交付包/levelScript.lua"],
];

function gitShow(rel) {
  return execFileSync("git", ["show", `${REV}:${rel}`], {
    cwd: TOOL_ROOT,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chess-baseline-"));
  try {
    console.log(`导出 ${REV} 的 levelScript.lua → ${tmp}`);
    for (const [rel] of FILES) {
      const dst = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      let buf;
      try {
        buf = gitShow(rel);
      } catch (e) {
        console.error(`  ✗ 取不到 ${REV}:${rel}（${String(e.message).split("\n")[0]}）`);
        process.exitCode = 2;
        continue;
      }
      fs.writeFileSync(dst, buf);
      console.log(`  ✓ ${rel}  ${buf.length} 字节`);
    }
    console.log("");

    // 调 static_checks.cjs 跑基线（子进程 stdout 直接透传）
    const child = execFileSync(process.execPath, [
      path.join(TOOL_ROOT, "tests", "static_checks.cjs"),
      `--root=${tmp}`,
    ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
    process.stdout.write(child);
    // 全绿说明「没有可复现的 Red」——不是失败，但要点明
    console.log("\n（基线全绿：该提交上已经没有待修的 issue #1 问题，Red 证据需换更早的提交）");
  } catch (e) {
    // static_checks 有 FAIL 时退出码 1，stdout 已经在上面透传过了
    if (typeof e.stdout === "string" && e.stdout.length) process.stdout.write(e.stdout);
    process.exitCode = e.status === 1 ? 1 : (e.status || 1);
  } finally {
    if (!KEEP) {
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`\n临时基线目录已删除（加 --keep 可保留：${tmp}）`);
    } else {
      console.log(`\n临时基线目录已保留：${tmp}`);
      console.log(`复跑：node tests/static_checks.cjs --root=${tmp}`);
    }
  }
}

main();
