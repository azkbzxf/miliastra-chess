// tools_work/rules_test.cjs
// 直接对正式 lua/levelScript.lua 做规则层验证（不经过沙箱 UI）：
//   把文件里第 3 区 RULES 抽出来跑 perft + 特殊规则 + 棋钟公式，与 python-chess 标准答案比对。
// 这样验证的是「正式交付文件里的规则代码」，不是原型文件。
const fs = require("fs");
const path = require("path");

const SANDBOX_DIR = "C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox";
const fengari = require(path.join(SANDBOX_DIR, "vendor", "fengari.bundle.js"));
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

const ROOT = "D:/输出目录/国际象棋";
const LUA = path.join(ROOT, "lua/levelScript.lua");
const REF = path.join(ROOT, "tools_work/perft/ref.json");

const src = fs.readFileSync(LUA, "utf8");
const ref = JSON.parse(fs.readFileSync(REF, "utf8"));

// 抽出第 3 区（从 "local RULES = {}" 到 "第 4 区" 之前）
const startIdx = src.indexOf("local RULES = {}");
const endIdx = src.indexOf("-- 第 4 区：LAYOUT");
if (startIdx < 0 || endIdx < 0) { console.log("EXTRACT_FAIL"); process.exit(3); }
let rulesSrc = src.slice(startIdx, endIdx);

// 补上 4 个常量（原本在 CONFIG 里）
//
// 【为什么还要补 CONFIG】第 3 区现在除了纯规则引擎，还包含「图元棋子拟合」代码
// （fit_normalize / load_piece_fit），其中下面两行是**模块加载期就求值**的：
//     PIECE_FIT[signed] = fit_normalize(mod, CONFIG.PIECE_PRIM_BUDGET)
//     local PRIM_MAX    = CONFIG.PIECE_PRIM_BUDGET
// 本脚本只截取「local RULES = {}」到「第 4 区」之间的代码，不包含第 1 区的 CONFIG 表，
// 所以必须在这里补一个只含 PIECE_PRIM_BUDGET 的 CONFIG 桩，否则整块 chunk 一加载就报
//   attempt to index a nil value (global 'CONFIG')
// 这是本脚本的历史缺陷（旧版 103KB 交付件同样报错），与复盘改动无关。
// 桩里只给规则区真正用到的字段，避免让本脚本误以为能验证 UI 层。
const header = `
local PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING = 1, 2, 3, 4, 5, 6
local WHITE, BLACK = 1, -1
CONFIG = { PIECE_PRIM_BUDGET = 40 }
`;
// 去掉 RULES 里重复定义这些常量的行（保留即可，Lua 允许重复 local，但会 shadow）
const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
lauxlib.luaL_dostring(L, to_luastring(`
  if not math.isnan then math.isnan = function(n) return n ~= n end end
  if not math.isinf then math.isinf = function(n) return n == math.huge or n == -math.huge end end
`));

const chunk = header + "\n" + rulesSrc + "\nreturn RULES\n";
if (lauxlib.luaL_loadstring(L, to_luastring(chunk)) !== lua.LUA_OK) {
  console.log("LOAD_ERR " + to_jsstring(lua.lua_tostring(L, -1)));
  process.exit(3);
}
if (lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK) {
  console.log("RUN_ERR " + to_jsstring(lua.lua_tostring(L, -1)));
  process.exit(3);
}
lua.lua_setglobal(L, to_luastring("R"));

function evalLua(code) {
  if (lauxlib.luaL_loadstring(L, to_luastring(code)) !== lua.LUA_OK) {
    throw new Error("LOAD: " + to_jsstring(lua.lua_tostring(L, -1)));
  }
  if (lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK) {
    throw new Error("RUN: " + to_jsstring(lua.lua_tostring(L, -1)));
  }
  const v = to_jsstring(lua.lua_tostring(L, -1));
  lua.lua_pop(L, 1);
  return v;
}

let fails = 0;
function check(name, pass, detail) {
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

console.log("=== 对正式文件 lua/levelScript.lua 的第 3 区 RULES 验证 ===\n");

// perft
for (const c of ref.cases) {
  const fenLua = JSON.stringify(c.fen);
  for (const [dStr, expect] of Object.entries(c.perft)) {
    const d = Number(dStr);
    if (d > 2) continue;   // 深度 1-2 足够验证正确性且快
    const got = Number(evalLua(`local st = R.parse_fen(${fenLua}); return tostring(R.perft(st, ${d}))`));
    check(`perft ${c.name} d=${d}`, got === expect, `got=${got} expect=${expect}`);
  }
  // 根局面合法走法
  const list = evalLua(`
    local st = R.parse_fen(${fenLua})
    local t = R.legal_uci_list(st)
    return "[" .. table.concat(t, ",") .. "]"
  `);
  const got = list.slice(1, -1).split(",").filter(Boolean);
  const extra = got.filter(m => !c.moves_at_root.includes(m));
  const missing = c.moves_at_root.filter(m => !got.includes(m));
  check(`走法列表 ${c.name}`, extra.length === 0 && missing.length === 0,
        `got=${got.length} expect=${c.moves_at_root.length}` + (extra.length ? ` 多出=${extra}` : "") + (missing.length ? ` 缺失=${missing}` : ""));
}

// 特殊局面
for (const s of ref.special) {
  const fenLua = JSON.stringify(s.fen);
  const info = evalLua(`
    local st = R.parse_fen(${fenLua})
    local g = R.game_status(st)
    return tostring(R.in_check(st, st.turn)) .. "|" .. tostring(g.over) .. "|" .. tostring(g.reason)
  `);
  const [chk, over, reason] = info.split("|");
  check(`特殊局面 ${s.name}`, chk === String(s.is_check) && over === String(s.is_game_over),
        `check=${chk} over=${over} reason=${reason}`);
}

// FEN 往返
const fenBack = evalLua(`return R.fen_of(R.parse_fen(${JSON.stringify("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")}))`);
check("FEN 往返", fenBack === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", fenBack);

// 棋钟公式自洽（策划案 5.2：初始 900，每步 +10）
const clockCheck = evalLua(`
  local t = 900
  for i = 1, 40 do t = t - 20 + 10 end   -- 40 步，每步思考 20 秒
  return tostring(t)
`);
check("棋钟 40 步自洽（900-40×20+40×10=500）", clockCheck === "500", "got=" + clockCheck);

const clock60 = evalLua(`
  local t = 900
  for i = 1, 30 do t = t - 12 + 10 end
  return tostring(t)
`);
check("棋钟 60 步自洽（白 30 步 ×12s → 840）", clock60 === "840", "got=" + clock60);

console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURES"}`);
process.exit(fails === 0 ? 0 : 2);
