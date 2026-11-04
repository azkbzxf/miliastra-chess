// tools_work/finalize_state.cjs
// 把项目状态记录更新为「已交付」，并写入最终验收汇总
const fs = require("fs");

const P = "D:/输出目录/国际象棋/docs/项目状态记录.md";
let s = fs.readFileSync(P, "utf8");

// 1) 当前步骤改为已交付
s = s.replace("当前步骤：2 编策划案（进行中）", "当前步骤：**7 最终交付（已完成，待用户真机验证）**");

// 2) 门禁表整体替换
const gateStart = s.indexOf("## 五、门禁与产物");
const gateEnd = s.indexOf("## 五之一、已修复的 bug");
if (gateStart < 0 || gateEnd < 0) { console.error("GATE_NOT_FOUND"); process.exit(3); }

const newGate = `## 五、门禁与产物（最终）

| 步骤 | 产物路径 | 状态 |
|---|---|---|
| 1 项目立项 | docs/立项卡.md + 本文件第三节 | **已达标** |
| 2 编策划案 | docs/策划案.md（52KB / 769 行 / 自检 20-20） | **已达标** |
| 3 Demo 初审 | proto/chess_demo.html（自检 17/17 + 真实 Edge 截屏） | **已达标** |
| 4 编写 Lua | lua/levelScript.lua（沙箱 17/17，perft 全过） | **已达标** |
| 5 Bug 修复 | 修 7 个 bug（见下） | **已达标** |
| 6 版本迭代 | — | 本版为 v1.0，无迭代 |
| 7 最终交付 | out/交付包/（4 个文件） | **已交付，待用户真机验证** |

## 五之零、最终验收汇总

\`\`\`
规则正确性    ✔ perft 交叉验证：6 标准局面 × 深度1-3 全部与 python-chess 一致
              （initial d3=8902 / kiwipete d3=97862 / pos3 d3=2812 /
                pos4 d3=9467 / pos5 d3=62379 / pos6 d3=89890）
              特殊局面：易位/吃过路兵/升变/将死/逼和/五十步 判定全部正确
Lua 可运行    ✔ 体外沙箱 verdict=pass  errors=0  unsupported=0  neverActivated=0
              控件 created=280 destroyed=280 alive=0
              交互：点 e2→e4 生效 / 非法落点被拒 / 新开一局生效 / fuzz 3000ms 无错
Lua 语法      ✔ Lua 5.3 编译器 SYNTAX_OK（fengari 0.1）
              ✔ 静态检查：块结构配对、括号平衡、无前向引用、无 local x = x
接口依据      ✔ 39 个接口标识逐项回查 API 文档，0 个找不到依据
Demo 可玩     ✔ 真实 Edge 浏览器截屏验证（reports/demo_v4.png、interact_test.png）
              ✔ 页面内自检 17/17 SELFTEST_PASSED
              ✔ 真实点击走子：e2→e4 生效，痕迹/记录/轮次/棋钟全部正确
Demo 一致性   ✔ 与 Lua 逐项核对：55 项文案逐字相同
              ✔ 17 项配色 / 10 项字号 / 6 项数值 全部一致
真机运行      ✗ 待验证（需用户按交付说明第四节挂载后进关卡试）
\`\`\`

## 五之零点五、最终产物清单

\`\`\`
out/交付包/
  README.md            交付包清单（2KB）
  levelScript.lua      正式客户端脚本（86KB / 2400+ 行，CONFIG 待用户填 3 个值）
  chess_demo.html      网页版 Demo（68KB，纯离线单文件）
  交付说明.md           技术部分（14KB）：接口依据/验收/联机协议/已知限制
  白话说明.md           给用户的白话说明（5KB）：怎么玩/做什么/注意什么/没做什么

项目内部（不进交付包）：
  docs/策划案.md           52KB / 769 行 / 自检 20-20
  docs/立项卡.md           立项卡
  docs/annotations.lua     接口标注（39 个接口全部登记）
  docs/锚定配置表.md        280 个元素的锚点/中心点/尺寸/偏移/配色/字号
  docs/沙箱能力清单.md      体外沙箱实测能力边界（可用/不可用逐项）
  docs/Lua实现设计.md       11 区结构规划
  docs/项目状态记录.md      本文件
  tools_work/perft/        规则引擎原型 + python-chess 标准答案 + perft 跑分器
  tools_work/chess_rules.js JS 规则引擎（与 Lua 逐函数对照）
  tools_work/play_test.cjs 沙箱交互测试（17 项断言）
  tools_work/rules_test.cjs 正式 Lua 规则层验证
  tools_work/consistency_check.cjs Demo-Lua 一致性核对
  tools_work/verify_demo.mjs 真实 Edge 打开 Demo + 取回自检结果
  reports/                 全部验证截图与日志
\`\`\`

`;

s = s.slice(0, gateStart) + newGate + s.slice(gateEnd);

// 3) 追加最终 bug 清单（在已有 bug 表后）
const bugAnchor = "## 五之二、沙箱验收结果";
if (s.includes(bugAnchor)) {
  const extra = `## 五之一补、交付阶段新增修复的 3 个 bug

\`\`\`
D-03 Demo 结算面板只隐藏遮罩，面板底与按钮仍显示 → 开局一块深色矩形盖住棋盘
     修复：buildResult 末尾 showParts(UI.result.parts, false)
     自检加 no_dialog_on_boot（放在全部检查最前，反映 boot 真实状态）

D-04 Demo 单人打开被锁死成黑方 → 白方回合点任何白子都被拒，棋盘完全点不动
     根因：initNet 用 localStorage 的 seat 标记分配身份，上一个窗口的残留标记
           让本窗口拿到 mySide=2，于是只允许操作黑方
     修复：加 peerAlive 判定——只有「另一个实例 30 秒内活跃」才限制只操作自己一方；
           否则允许操作双方（等价同屏）。心跳每 5 秒更新 peerAlive。
     验证：interact_test.png 显示 e2→e4 真实走子生效

D-05 Demo ?auto= 序列不执行
     根因：const params 在使用之后才声明，触发暂时性死区（TDZ），被 catch 吞掉
     修复：把 params 声明移到 auto 段之前
\`\`\`

`;
  s = s.replace(bugAnchor, extra + bugAnchor, 1);
}

// 4) 阻塞项更新
s = s.replace(
  "B1 服务端节点图接口文档缺失 → 联机同步的服务端一半无法写代码；已降级为「客户端信号 + 用户搭节点图」。",
  "B1 服务端节点图接口文档缺失 → 已降级为「客户端信号 + 用户搭节点图」，搭不出来自动同屏。**仍为已知限制 L-1。**"
);

// 5) 上一次给用户看的是什么
const lastStart = s.indexOf("## 七、上一次给用户看的是什么");
if (lastStart >= 0) {
  const lastEnd = s.indexOf("## 八、未解决疑点");
  if (lastEnd > lastStart) {
    s = s.slice(0, lastStart) +
`## 七、上一次给用户看的是什么

\`\`\`
v1.0 交付包（2026-10-31 12:35）
  用户尚未试玩；交付内容为：网页 Demo + 正式 Lua + 交付说明 + 白话说明
  用户下一步：双击 chess_demo.html 玩一局 → 反馈手感 → 填 3 个编号装进关卡
\`\`\`

` + s.slice(lastEnd);
  }
}

fs.writeFileSync(P, s, "utf8");
console.log("WROTE 项目状态记录.md, size:", s.length);
