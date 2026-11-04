import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { spawn } from "node:child_process";
const PORT=18222;
const srv=http.createServer((req,res)=>{
  const u=req.url.split("?")[0];
  const f=path.join("D:/输出目录/国际象棋/proto", u==="/"?"chess_demo.html":u.replace(/^\//,""));
  if(fs.existsSync(f)){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(fs.readFileSync(f));}else{res.writeHead(404);res.end("nf");}
});
await new Promise(r=>srv.listen(PORT,"127.0.0.1",r));
const url=`http://127.0.0.1:${PORT}/chess_demo.html?style=glyph`;
const ps=spawn("pwsh",["-NoProfile","-File","tools_work/shot.ps1","-Url",url,"-Out","reports/two_tier_glyph2.png","-WaitSec","6","-TitleContains","黑白棋局"],{stdio:"inherit"});
ps.on("exit",c=>{srv.close();process.exit(c);});
