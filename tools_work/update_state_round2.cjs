// tools_work/update_state_round2.cjs
// 记录第 2 轮（继续推进）新增的修复与验证
const fs = require("fs");

const P = "D:/输出目录/国际象棋/docs/项目状态记录.md";
let s = fs.readFileSync(P, "utf8");

const anchor = "## 五之二、沙箱验收结果";
if (!s.includes(anchor)) { console.error("ANCHOR_NOT_FOUND"); process.exit(3); }

const block = `## 五之三、第 2 轮补充修复与验证（交付前复验发现）

\`\`\`
背景：第 1 轮交付后，按「不凭叙述、只认实际」的要求对 out/交付包 里的真实文件重新验证，
      发现 3 个此前未暴露的问题（前 2 个影响可用性，第 3 个影响量测可信度）。

D-06 Demo 手机 16:9 下面板右侧被切到屏幕外（真实渲染问题）
     现象：截图显示面板完全看不到；几何探针实测 panelBg.right=1364 > 视口 1280（越界 84px）
     根因：#viewport 用 display:flex 居中，而 #stage 的**布局尺寸仍是 1600×900**；
           transform:scale() 不改变布局尺寸，flex 按 1600 排版后舞台偏移不随缩放变化，
           导致右侧内容超出视口。**只靠量测百分比看不出问题**（百分比是对的，绝对坐标是错的）。
     修复：#stage 改为 position:absolute + left/top:50% + transform:translate(-50%,-50%) scale(s)；
           fitStage 同步保留 translate。
     验证：几何探针 panelBg.right 从 1364 → 1237（视口 1264），面板完整在屏内；
           reports/final_m_16_9.png 截图确认棋盘+面板+按钮全部可见。

D-07 Demo 整页白屏、自检不返回（params 暂时性死区，第二次犯同类错）
     现象：加 ?probe= 后页面完全不动，SELFTEST 不返回，Edge --dump-dom 里 title 未变
     根因：probe 代码块使用了 params，但 const params 的声明被排在其后 → TDZ 错误；
           该错误发生在 boot() 顶层，整页中断。
           这是**第二次**犯同类错（第一次是 ?auto= 段），说明靠「记得把声明提前」不可靠。
     修复：把 const params 声明统一提到 boot() 最前，并在注释里写明两次踩坑原因。
     验证：加临时全局错误捕获，实测报错原文为
           "Uncaught ReferenceError: Cannot access 'params' before initialization @ ...:1755:5"，
           修复后 SELFTEST_PASSED。诊断代码已从交付版移除。

D-08 量测口径错误导致「越界」误报
     现象：真实量测报告 lastmove_1/2、checkwarn、legalhl_* 越界，面板 left 显示 98.7%
     根因：__measure 用「缩放后的 stage rect 宽高」做分母，而 stage 被 scale 过；
           应除以「设计基准 1600×900 × 当前缩放值」。另：初始隐藏元素尺寸为 0，不应参与越界判定。
     修复：分母改为 BASE_W×scaleNow / BASE_H×scaleNow；输出加 hidden 标记，校验跳过隐藏元素。
     验证：4 种分辨率下棋盘 left=28.06%、面板 left=78%（与策划案公式 449/1600、1248/1600 一致），
           越界=无，全部 PASS。

新增的验证能力（已固化为可复跑脚本）
  tools_work/resolution_test.cjs   8 种设备形态 × 交付包 Lua：verdict/errors/unsupported/几何/按钮高
  tools_work/measure_demo.mjs      4 种分辨率 × 交付包 Demo：页面内 __measure 真实 getBoundingClientRect
  tools_work/probe_layout.mjs      几何探针：上报 viewport/stage/棋盘/面板 的真实像素坐标
  tools_work/api_evidence.cjs      104 个接口标识逐项回查 API 文档（0 个无依据）
  tools_work/final_verify.cjs      交付前一键完整验证（10 项）

第 2 轮最终验证结果（对象：out/交付包 里的真实文件）
  OK    交付包文件完整（5 个）
  PASS  Lua 语法编译
  PASS  Lua 规则层 perft + 特殊局面
  PASS  Lua 体外沙箱（17 项交互用例）
  PASS  Lua 分辨率矩阵 8 种设备形态（手机三列全部在画布内、不重叠、按钮高 ≥44.9px）
  PASS  Demo 真实 Edge 自检 17 项
  PASS  Demo 真实量测 4 种分辨率（棋盘 28.06% / 面板 78%，无越界无重叠）
  PASS  Demo 与 Lua 一致性（55 项文案逐字 + 配色/字号/数值）
  PASS  接口依据回查（104 个标识，0 个无依据）
  PASS  交付版无调试痕迹（调试层受 ?debug 控制、无占位字样、无诊断代码）
  ==== 全部通过 / 共 10 项 ====
\`\`\`

`;

s = s.replace(anchor, block + anchor, 1);

// 更新浏览器工具说明（新增多分辨率截图与几何探针）
s = s.replace("工具脚本：tools_work/shot.ps1（启动 Edge + 截屏），tools_work/selfcheck.mjs（读页面自检结果）",
              "工具脚本：tools_work/shot.ps1（启动 Edge + 截屏）、measure_demo.mjs（多分辨率真实量测）、\n          probe_layout.mjs（几何探针）、verify_demo.mjs（页面自检回传）、final_verify.cjs（一键全验）");

fs.writeFileSync(P, s, "utf8");
console.log("WROTE 项目状态记录.md, size:", s.length);
