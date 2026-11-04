import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.argv[2];
const file = process.argv[3];
const out = process.argv[4];
const extraArgs = process.argv.slice(5);   // 透传额外参数，如 -TitleContains 黑白棋局
const port = 18000 + Math.floor(Math.random()*1000);

const srv = http.createServer((req,res)=>{
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p,(e,b)=>{ if(e){res.writeHead(404);res.end('no');} else {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(b);} });
});
await new Promise(r=>srv.listen(port,'127.0.0.1',r));
const url = (() => {
  const qi = file.indexOf('?');
  const fpath = qi >= 0 ? file.slice(0, qi) : file;
  const query = qi >= 0 ? file.slice(qi) : '';
  return `http://127.0.0.1:${port}/${encodeURIComponent(fpath)}${query}`;
})();
console.log('URL',url);
const ps = spawn('pwsh',['-NoProfile','-File','tools_work/shot.ps1','-Url',url,'-Out',out,'-WaitSec','6',...extraArgs],{stdio:'inherit'});
ps.on('exit',c=>{ srv.close(); process.exit(c); });
