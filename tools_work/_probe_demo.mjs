// tools_work/_probe_demo.mjs  (临时自检脚本，可删)
// 起一个本地服务：① 提供 proto/chess_demo.html ② 接收 Demo 的 ?probe=1 / ?selftest=1 POST 回报。
// 用真实 Edge 跑一遍，拿到真实几何 + 自检结果，验证 v3 浅色主题的布局没越界。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = 'D:/输出目录/国际象棋/proto';
const file = 'chess_demo.html';
const port = 19000 + Math.floor(Math.random() * 500);
let probe = null, selftest = null;

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (req.method === 'POST') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      try { if (u === '/probe') probe = JSON.parse(b); else if (u === '/report') selftest = JSON.parse(b); } catch (e) {}
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end('ok');
    });
    return;
  }
  if (u === '/stop') { res.writeHead(200); res.end('bye'); setTimeout(finish, 100); return; }
  const p = path.join(root, decodeURIComponent(u));
  fs.readFile(p, (e, b) => {
    if (e) { res.writeHead(404); res.end('no'); }
    else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b); }
  });
});

await new Promise(r => srv.listen(port, '127.0.0.1', r));
const url = `http://127.0.0.1:${port}/${file}?probe=1&selftest=1&reportPort=${port}`;
console.log('URL', url);

const ps = spawn('pwsh', ['-NoProfile', '-File', 'tools_work/shot.ps1',
  '-Url', url, '-Out', 'D:/输出目录/国际象棋/tools_work/tmp/v3_probe.png',
  '-WaitSec', '7', '-Width', '1600', '-Height', '900', '-TitleContains', '黑白棋局'],
  { stdio: 'inherit' });

setTimeout(finish, 45000);   // 硬超时
let done = false;
function finish() {
  if (done) return;
  done = true;
  try { ps.kill(); } catch (e) {}
  srv.close();

  console.log('\n========== SELFTEST ==========');
  if (!selftest) console.log('（未收到 selftest 回报）');
  else {
    console.log(selftest.ok ? 'SELFTEST PASS' : 'SELFTEST FAIL');
    for (const c of selftest.checks) if (!c.pass) console.log('  FAIL ' + c.name + ' ' + (c.detail || ''));
    console.log('  总项数=' + selftest.checks.length + ' 失败=' + selftest.checks.filter(c => !c.pass).length);
  }

  console.log('\n========== PROBE ==========');
  if (!probe) { console.log('（未收到 probe 回报）'); process.exit(0); }
  const { viewport, scaleNow, stageRect, boardSq0, boardSq63, panelBg } = probe;
  console.log('viewport', viewport, 'scale', scaleNow);
  console.log('stage   ', stageRect);
  console.log('sq0(a1)', boardSq0);
  console.log('sq63(h8)', boardSq63);
  console.log('panelBg ', panelBg);

  // 棋盘矩形（sq0 左下角到 sq63 右上角）
  const bx = boardSq0.x, by = boardSq0.bottom;
  const bw = boardSq63.right - boardSq0.x, bh = boardSq0.bottom - boardSq63.y;
  console.log(`棋盘: x ${bx} → ${bx + bw}, y ${by} → ${by + bh} (${bw}x${bh})`);

  let bad = 0;
  const chk = (name, cond, detail) => {
    if (!cond) { bad++; console.log('  FAIL ' + name + ' ' + (detail || '')); }
    else console.log('  PASS ' + name + ' ' + (detail || ''));
  };
  console.log('\n--- 越界检查（设计基准 1600x900 缩放到视口）---');
  const S = scaleNow;
  chk('舞台宽 = 1600*scale', Math.abs(stageRect.w - 1600 * S) <= 1, `w=${stageRect.w} vs ${1600 * S}`);
  chk('舞台高 = 900*scale', Math.abs(stageRect.h - 900 * S) <= 1, `h=${stageRect.h} vs ${900 * S}`);
  chk('舞台不越视口右', stageRect.right <= viewport.w + 1, `right=${stageRect.right} vp=${viewport.w}`);
  chk('舞台不越视口下', stageRect.bottom <= viewport.h + 1, `bottom=${stageRect.bottom} vp=${viewport.h}`);
  chk('面板不越舞台底', panelBg.bottom <= stageRect.bottom + 1, `panel.bottom=${panelBg.bottom} stage.bottom=${stageRect.bottom}`);
  chk('面板不越舞台右', panelBg.right <= stageRect.right + 1, `panel.right=${panelBg.right}`);
  // v3 新增外框：棋盘外扩 0.16 格，必须仍在舞台内
  const cell = bw / 8, framePad = cell * 0.16;
  chk('外框左不越舞台左', bx - framePad >= -1, `frameLeft=${(bx - framePad).toFixed(1)}`);
  chk('外框右不越舞台右', bx + bw + framePad <= stageRect.right + 1, `frameRight=${(bx + bw + framePad).toFixed(1)} stageRight=${stageRect.right}`);
  chk('外框顶不越舞台顶', by + bh + framePad <= stageRect.bottom + 1, `frameTop=${(by + bh + framePad).toFixed(1)} stageBottom=${stageRect.bottom}`);
  chk('外框底不越舞台底', by - framePad >= -1, `frameBottom=${(by - framePad).toFixed(1)}`);

  console.log('\n' + (bad === 0 ? 'PROBE_CHECK_PASS' : 'PROBE_CHECK_FAIL(' + bad + ')'));
  process.exit(bad ? 2 : 0);
}
