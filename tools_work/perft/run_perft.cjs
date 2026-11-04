// tools_work/perft/run_perft.cjs
// 用 fengari（Lua 5.3）跑 engine_proto.lua 的 perft，与 python-chess 生成的 ref.json 逐项比对。
// 用法：node tools_work/perft/run_perft.cjs [maxDepth]
// 退出码：0 全过 / 2 有失败
const fs = require("fs");
const path = require("path");

const SANDBOX = "C:/Users/24037/Downloads/MiliastraAgent/release/tools/sandbox";
const fengari = require(path.join(SANDBOX, "vendor", "fengari.bundle.js"));
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

const ROOT = "D:/输出目录/国际象棋";
const enginePath = path.join(ROOT, "tools_work/perft/engine_proto.lua");
const refPath = path.join(ROOT, "tools_work/perft/ref.json");
const maxDepthArg = Number(process.argv[2] || 0);

const ref = JSON.parse(fs.readFileSync(refPath, "utf8"));
const engineSrc = fs.readFileSync(enginePath, "utf8");

const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);

// 补 math.isnan / math.isinf（真机文档里有，标准 Lua 没有）
lauxlib.luaL_dostring(L, to_luastring(`
  if not math.isnan then math.isnan = function(n) return n ~= n end end
  if not math.isinf then math.isinf = function(n) return n == math.huge or n == -math.huge end end
`));

// 加载引擎
if (lauxlib.luaL_loadstring(L, to_luastring(engineSrc)) !== lua.LUA_OK) {
  console.log("LOAD_ERR " + to_jsstring(lua.lua_tostring(L, -1)));
  process.exit(3);
}
if (lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK) {
  console.log("RUN_ERR " + to_jsstring(lua.lua_tostring(L, -1)));
  process.exit(3);
}
lua.lua_setglobal(L, to_luastring("E"));

/** 执行一段 Lua，返回字符串结果；失败抛错 */
function luaEval(code) {
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
const t0 = Date.now();

for (const c of ref.cases) {
  const fenLua = JSON.stringify(c.fen);
  // perft 比对
  for (const [dStr, expect] of Object.entries(c.perft)) {
    const d = Number(dStr);
    if (maxDepthArg && d > maxDepthArg) continue;
    const t1 = Date.now();
    const got = Number(luaEval(`local st = E.parse_fen(${fenLua}); return tostring(E.perft(st, ${d}))`));
    const ms = Date.now() - t1;
    if (got !== expect) {
      fails++;
      console.log(`FAIL perft ${c.name} d=${d} got=${got} expect=${expect} (${ms}ms)`);
    } else {
      console.log(`PASS perft ${c.name} d=${d} = ${got} (${ms}ms)`);
    }
  }
  // 根局面走法列表比对
  const gotList = luaEval(`
    local st = E.parse_fen(${fenLua})
    local t = E.legal_uci_list(st)
    local q = '"'
    return "[" .. q .. table.concat(t, q .. "," .. q) .. q .. "]"
  `);
  const got = JSON.parse(gotList);
  const exp = c.moves_at_root;
  const extra = got.filter(m => !exp.includes(m));
  const missing = exp.filter(m => !got.includes(m));
  if (extra.length || missing.length) {
    fails++;
    console.log(`FAIL moves ${c.name}: got=${got.length} expect=${exp.length}`);
    if (extra.length) console.log("   多出: " + extra.slice(0, 12).join(","));
    if (missing.length) console.log("   缺失: " + missing.slice(0, 12).join(","));
  } else {
    console.log(`PASS moves ${c.name} = ${exp.length} 步`);
  }
  // FEN 往返
  const fenBack = luaEval(`return E.fen_of(E.parse_fen(${fenLua}))`);
  const sameFen = fenBack === c.fen || fenBack.replace(/\s+/g, " ") === c.fen.replace(/\s+/g, " ");
  if (!sameFen) {
    fails++;
    console.log(`FAIL fen ${c.name}\n   got=${fenBack}\n   exp=${c.fen}`);
  } else {
    console.log(`PASS fen ${c.name} 往返一致`);
  }
}

// 特殊局面
for (const s of ref.special) {
  const fenLua = JSON.stringify(s.fen);
  const info = luaEval(`
    local st = E.parse_fen(${fenLua})
    local g = E.game_status(st)
    return tostring(E.in_check(st, st.turn)) .. "|" .. tostring(g.over) .. "|" .. tostring(g.reason)
             .. "|" .. tostring(#E.legal_moves(st))
  `);
  const [chk, over, reason, n] = info.split("|");
  const problems = [];
  if (chk !== String(s.is_check)) problems.push(`is_check got=${chk} exp=${s.is_check}`);
  if (over !== String(s.is_game_over)) problems.push(`is_game_over got=${over} exp=${s.is_game_over}`);
  if (s.is_checkmate && reason !== "checkmate") problems.push(`reason got=${reason} exp=checkmate`);
  if (s.is_stalemate && reason !== "stalemate") problems.push(`reason got=${reason} exp=stalemate`);
  if (problems.length) {
    fails++;
    console.log(`FAIL special ${s.name}: ${problems.join("; ")}`);
  } else {
    console.log(`PASS special ${s.name} check=${chk} over=${over} reason=${reason || "-"} moves=${n}`);
  }
}

console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURES"}  用时 ${Date.now() - t0}ms`);
process.exit(fails === 0 ? 0 : 2);
