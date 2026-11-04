// tools_work/update_state_demo.cjs
// 把 Demo 验证结论写进项目状态记录（避免 shell 引号冲突）
const fs = require("fs");
const path = require("path");

const P = "D:/输出目录/国际象棋/docs/项目状态记录.md";
let s = fs.readFileSync(P, "utf8");

const anchor = "## 七、上一次给用户看的是什么";
if (!s.includes(anchor)) { console.error("ANCHOR_NOT_FOUND"); process.exit(3); }

const block = `## 六之二、Demo 验证结论（proto/chess_demo.html v3）

\`\`\`
自检：SELFTEST_PASSED（17/17 项）
  board_64_squares_a1_dark   initial_placement
  perft_d1_d2                click_e2_e4_moves_pawn
  click_e2_e5_rejected       en_passant_available
  castling_available         promotion_4_options
  checkmate_detected         stalemate_detected
  clock_increment            newgame_resets_clock
  net_receive_updates_board  no_debug_by_default
  no_dialog_on_boot          hit_areas_64
  pieces_64

真实浏览器验证：Edge 打开 → 截屏 reports/demo_v3.png（精确 1600x900）
  画面干净：无调试痕迹、无弹窗遮挡、棋盘水平居中、面板靠右、四枚按钮
  棋盘配色：像素采样 + 公式核对，a1=深 b1=浅 h1=浅 a8=浅 h8=深 —— 符合国际标准

修过的 2 个 Demo bug：
  D-01 升变/求和弹窗创建后未隐藏 → 开局盖住棋盘
       修复：buildPromo/buildDrawDlg 末尾调用 showParts(parts, false)
       自检加 no_dialog_on_boot（放在全部检查最前，反映 boot 真实状态）
  D-02 结算面板只隐藏了遮罩，面板底与按钮仍显示 → 开局一块深色矩形盖住棋盘
       修复：buildResult 末尾 showParts(UI.result.parts, false)

未验证项：
  V-01 双窗口真实联机同步：本工具链无法自动化验证（不同 Edge profile 不共享 localStorage）；
       同步逻辑已由 net_receive_updates_board 自检覆盖，真实双窗口需用户手动验证
  V-02 手机三比例下的实际渲染：未逐行截屏（公式已核算，见 docs/锚定配置表.md 第六节）
\`\`\`

`;

s = s.replace(anchor, block + anchor, 1);
fs.writeFileSync(P, s, "utf8");
console.log("WROTE state record, new size:", s.length);
