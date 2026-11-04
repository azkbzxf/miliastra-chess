import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('D:/输出目录/国际象棋/tools_work/perft/ref.json', 'utf8'));
console.log(Object.keys(r));
console.log(JSON.stringify(r.cases.map(c => ({ name: c.name, fen: c.fen, perft: c.perft })), null, 1));
const extra = Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'cases'));
console.log('EXTRA', JSON.stringify(extra, null, 1).slice(0, 4000));
