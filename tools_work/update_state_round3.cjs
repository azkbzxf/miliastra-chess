// tools_work/update_state_round3.cjs
// 记录第 3 轮：棋子改为真实图标（图片 + 符号双模式）
const fs = require("fs");

const P = "D:/输出目录/国际象棋/docs/项目状态记录.md";
let s = fs.readFileSync(P, "utf8");

// 更新版本与当前步骤
s = s.replace("当前步骤：**7 最终交付（已完成，待用户真机验证）**",
              "当前步骤：**7 最终交付（v1.1 已交付，待用户真机验证）**");

const anchor = "## 五之三、第 2 轮补充修复与验证";
const block = `## 五之四、第 3 轮：棋子改为真实图标（用户试玩反馈）

\`\`\`
触发：用户试玩后反馈「各个棋子不应该用字母表示，而是国际象棋的棋子图标」。
补充要求：保留 Unicode 符号方案作方案一，图片作方案二，并可在游戏中自由切换。

素材来源：https://github.com/franciscoBSalgueiro/en-croissant
  public/pieces/cburnett.css 里每套棋子是 12 个 base64 内联 SVG（6 种 × 白黑）
  提取到 tools_work/icons/out/*.svg，再用 URL 编码内联进 Demo（共 8.5KB）
  许可：cburnett 棋子源自 Wikimedia Commons，CC BY-SA 3.0
  已写 out/交付包/第三方素材许可.md 做署名与许可声明

实现要点
  Demo：12 个 SVG 内联进单文件，默认图片模式，第五个按钮可切到符号
  Lua：图片控件层 64 个 + 符号文本框层 64 个，两套并存按模式显隐
       新增 CONFIG：PREFAB_PIECE_IMAGE、PIECE_IMAGE_IDS(12 项)、PIECE_IMAGE_SOURCE、DEFAULT_PIECE_MODE
       图片编号不全时自动回落符号模式（piece_images_ready() 判定）
  Unicode 棋符：U+265A..U+265F 实心，白方白字深描边、黑方深字浅描边
       已实测沙箱可正确写入并读回（len=3 字节，读回 ♚）

本轮修的问题
  P-01 Lua create_image 工厂插入位置错，插进了 create_cursor_area 中间，把函数截断
       修复：重建函数边界，删除残留 end
  P-02 piece_images_ready / piece_image_source_enum 定义在 render_pieces 之后（前向引用）
       现象：图片模式启动报 "attempt to call a nil value (global 'piece_images_ready')"
       修复：把两个 helper 整体移到 render_pieces 之前
  P-03 面板加第五个按钮后按钮高从 8% 压到 7% → 手机 16:9 下按钮只有 39px，低于 44px 触摸下限
       修复：按钮恢复 8%，三行改为 0.24/0.15/0.06，记录区上移 0.34、高 0.14
       验证：4 种分辨率按钮高 56/45/45/60px
  P-04 交付包 Lua 未同步（旧版 ec21a10b），导致分辨率测试读到 280 而非 282 个控件
       修复：每次改完 lua/levelScript.lua 后必须 cp 到 out/交付包/
  P-05 一致性检查未覆盖按钮布局，两边可能再次不同步
       修复：consistency_check.cjs 加入「五个按钮 y 位置」与「按钮高度比例」比对
       （Lua 键名小写 btnnew / Demo 驼峰 btnNew，按顺序比较值）

棋子双模式验证（tools_work/test_piece_image_mode.cjs）
  A 12 个编号全填 + 图片模板索引非 0 → 创建图片层，控件 346，图片显示
  B 编号只填一半 → 图片层仍创建（346），显示回落符号模式
  C 全不填（默认交付状态）→ 不创建图片层，控件 282，纯符号模式
  ==== 三种配置全部正确 ====

第 3 轮最终验证（对象：out/交付包，6 个文件）
  OK    levelScript.lua  93417 字节
  OK    chess_demo.html  85038 字节
  OK    交付说明.md  16416 字节
  OK    白话说明.md  5906 字节
  OK    README.md  1783 字节
  OK    第三方素材许可.md  1668 字节
  PASS  Lua 语法编译
  PASS  Lua 规则层 perft + 特殊局面
  PASS  Lua 体外沙箱（17 项交互用例）
  PASS  Lua 分辨率矩阵 8 种设备形态（控件 282）
  PASS  Demo 真实 Edge 自检 17 项
  PASS  Demo 真实量测 4 种分辨率（按钮高 56/45/45/60px）
  PASS  Demo 与 Lua 一致性（57 项文案 + 配色/字号/数值 + 按钮布局）
  PASS  接口依据回查（0 个无依据）
  PASS  交付版无调试痕迹
  ==== 全部通过 / 共 10 项 ====

真实浏览器截图证据
  reports/pieces_v1.png        图片棋子首次渲染成功
  reports/final_pieces.png     最终画面（棋子图标 + 五枚按钮）
\`\`\`

`;

s = s.replace(anchor, block + anchor, 1);
fs.writeFileSync(P, s, "utf8");
console.log("状态记录已更新，size:", s.length);
