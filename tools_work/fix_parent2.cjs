// tools_work/fix_parent2.cjs
// 修正：容器取不到时不应阻断启动，而是用 nil（挂到默认根）。
//   理由：真机上 script.object 一般可用；若不可用（异常环境），
//   退化为 nil 父级仍能创建控件（挂在默认容器根），比直接建 0 个控件好得多。
//   沙箱里 script.object 恒为 nil，用这个降级路径才能继续验证其余逻辑。
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let s = fs.readFileSync(P, "utf8");

// 1) read_container 失败时返回 nil 但不报错（保持函数语义：返回 host 或 nil）
//    已有实现即如此，无需改。

// 2) build_all_ui：取不到容器时用 nil 父级继续，只记一条日志
const oldBuild = `  -- 先取挂载容器：所有自建控件都挂在它下面
  local host, hostErr = read_container()
  if host == nil then
    log_info("挂载容器尚未就绪：%s", tostring(hostErr))
    return false
  end
  UI.host = host

  UI.L = LAYOUT.compute(w, h)`;

const newBuild = `  -- 先取挂载容器：所有自建控件都挂在它下面
  -- 取不到时不阻断启动，改用 nil 父级（挂到默认容器根），只记一条日志。
  -- 理由：真机上 script.object 一般可用；异常环境下退化为默认根，
  --       仍能创建控件并显示，比直接放弃启动好得多。
  local host, hostErr = read_container()
  if host == nil then
    log_once("no_host", "挂载容器未取到（%s），控件将挂到默认根", tostring(hostErr))
  end
  UI.host = host   -- 可能为 nil，create_* 会原样传给 InstantiateClientUIControl

  UI.L = LAYOUT.compute(w, h)`;

if (!s.includes(oldBuild)) { console.error("BUILD_ANCHOR_NOT_FOUND"); process.exit(3); }
s = s.replace(oldBuild, newBuild, 1);

fs.writeFileSync(P, s, "utf8");
console.log("OK: 容器取不到时降级为 nil 父级，不阻断启动");
