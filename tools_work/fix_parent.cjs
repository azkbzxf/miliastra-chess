// tools_work/fix_parent.cjs
// 修正父级获取方式：
//   官方指南与示例均用 script.object 作为挂载容器（脚本就挂在容器节点上）。
//   game.GetClientUIControl(id) 收的是「运行时 ID」，不是模板索引 —— 用它取容器是错的。
//   改为：优先 script.object；取不到时再用 GetClientUIControl 兜底（兼容旧写法）。
const fs = require("fs");

const P = "D:/输出目录/国际象棋/lua/levelScript.lua";
let s = fs.readFileSync(P, "utf8");

// 1) 替换 read_container 实现
const oldFn = s.slice(s.indexOf("local function read_container()"));
const endIdx = oldFn.indexOf("\nend") + 4;
const oldBlock = oldFn.slice(0, endIdx);

const newBlock = `local function read_container()
  -- 【为什么用 script.object】
  -- 官方编辑器指南与 API 文档示例都用 script.object 作为挂载容器：
  -- 脚本挂在「容器节点」上，script.object 就是那个容器节点。
  -- game.GetClientUIControl(controlId) 的参数是**运行时 ID**（文档 L176），
  -- 不是用户填的**模板索引**，两者不是一回事，不能拿来取容器。
  -- 因此：优先 script.object；它为 nil 时再用 GetClientUIControl 兜底（兼容旧写法）。
  local ok, host = pcall(function() return script.object end)
  if ok and host ~= nil then
    return host
  end
  local ok2, ctrl = pcall(function()
    return game.GetClientUIControl(CONFIG.CONTAINER_NODE_INDEX)
  end)
  if ok2 and ctrl ~= nil then
    return ctrl
  end
  return nil, "取不到挂载容器（script.object 与 GetClientUIControl 都返回空）"
end`;

s = s.replace(oldBlock, newBlock, 1);

// 2) build_all_ui 里先取容器，再作为父级传下去
const oldBuild = "  UI.L = LAYOUT.compute(w, h)";
const newBuild = `  -- 先取挂载容器：所有自建控件都挂在它下面
  local host, hostErr = read_container()
  if host == nil then
    log_info("挂载容器尚未就绪：%s", tostring(hostErr))
    return false
  end
  UI.host = host

  UI.L = LAYOUT.compute(w, h)`;
if (!s.includes(oldBuild)) { console.error("BUILD_ANCHOR"); process.exit(3); }
s = s.replace(oldBuild, newBuild, 1);

// 3) 所有 create_* 调用的 parent = nil 改成 parent = UI.host
const countBefore = (s.match(/parent = nil/g) || []).length;
s = s.replace(/parent = nil/g, "parent = UI.host");
const countAfter = (s.match(/parent = UI\.host/g) || []).length;

// 4) UI 表加 host 字段
s = s.replace("local UI = {\n  L = nil,", "local UI = {\n  L = nil,\n  host = nil,   -- 挂载容器（script.object）", 1);

fs.writeFileSync(P, s, "utf8");
console.log(`替换 parent = nil → parent = UI.host：${countBefore} 处`);
console.log("read_container 已改为优先 script.object");
