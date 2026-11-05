# 国际象棋 · GitHub issue #1 修复用例表（TDD）

> 交付物：`lua/levelScript.lua`（单文件 Lua 5.3，千星奇域客户端脚本）
> 关联 issue：**#1「走棋特效错位 / 棋子错位 / 面板重叠 / 棋影 / 性能」**（6 条）
> 编写：test-designer（只产出 `tests/` 下的文件，不改 `lua/`、`sim/`、`out/`、`proto/`、`docs/`）
> 观测运行时：`runtime=simulator`（千星 UI 模拟器 / qxqy_studio_play）。**模拟器绿灯不等于真机通过。**

## 本次交付的 4 个文件

| 文件 | 作用 | 怎么跑 |
|---|---|---|
| [issue-1-cases.md](issue-1-cases.md) | 本文件：用例表 + 坐标基准 + Red 证据 + Green 门禁 | 阅读 |
| [issue-1.cases.json](issue-1.cases.json) | 可直接喂 `qxqy_studio_play {action:"runCase"}` 的用例（1 个全流程 + 5 个细分） | `args:{case: …}`，见 §12.3 |
| [static_checks.cjs](static_checks.cjs) | CHECK-1~7 静态不变量，本轮 Red 证据主来源 | `node tests/static_checks.cjs` |
| [run-baseline.cjs](run-baseline.cjs) | 从 `git HEAD` 导出三份文件复跑静态检查，产出可重现的 Red 证据 | `node tests/run-baseline.cjs` |
| [red-evidence-baseline.txt](red-evidence-baseline.txt) | §9 的原始输出留档 | 阅读 |

---

## 0. 本轮统一约定

### 0.1 坐标基准（唯一来源 `LAYOUT.compute`，不得手抄设计稿）

模拟器 `pointer` 用**画布坐标**：原点左下、Y 向上（与 `LAYOUT.square_pos` 同一套）。
截图 PNG 是图像坐标（原点左上、Y 向下），换算 `pointer_y = canvasH - png_y`。

| 画布 | canvasId | cell | boardLeft | boardBottom | 面板左缘 | 面板底 | 面板宽 | 面板高 |
|---|---|---|---|---|---|---|---|---|
| PC 16:9 | `pc-16-9` | 87.75 | 449.0 | 99.0 | 1248.0 | 99.0 | 352.0 | 702.0 |
| 手机 16:9 | `mobile-16-9` | 70.20 | 359.2 | 79.2 | 998.4 | 79.2 | 281.6 | 561.6 |

格中心：`x = boardLeft + file*cell + cell/2`，`y = boardBottom + rank*cell + cell/2`（`a`=0…`h`=7，rank1=0…rank8=7）。

**PC（1600×900）常用格中心** — 与 issue 给定公式一致（`cell=87.8 → 87.75`，误差 <0.05px）：

| | a | b | c | d | e | f | g | h |
|---|---|---|---|---|---|---|---|---|
| **8** | 492.9,757.1 | 580.6,757.1 | 668.4,757.1 | 756.1,757.1 | 843.9,757.1 | 931.6,757.1 | 1019.4,757.1 | 1107.1,757.1 |
| **7** | 492.9,669.4 | 580.6,669.4 | 668.4,669.4 | 756.1,669.4 | 843.9,669.4 | 931.6,669.4 | 1019.4,669.4 | 1107.1,669.4 |
| **6** | 492.9,581.6 | 580.6,581.6 | 668.4,581.6 | 756.1,581.6 | 843.9,581.6 | 931.6,581.6 | 1019.4,581.6 | 1107.1,581.6 |
| **5** | 492.9,493.9 | 580.6,493.9 | 668.4,493.9 | 756.1,493.9 | 843.9,493.9 | 931.6,493.9 | 1019.4,493.9 | 1107.1,493.9 |
| **4** | 492.9,406.1 | 580.6,406.1 | 668.4,406.1 | 756.1,406.1 | **843.9,406.1** | 931.6,406.1 | 1019.4,406.1 | 1107.1,406.1 |
| **3** | 492.9,318.4 | 580.6,318.4 | 668.4,318.4 | 756.1,318.4 | 843.9,318.4 | 931.6,318.4 | 1019.4,318.4 | 1107.1,318.4 |
| **2** | 492.9,230.6 | 580.6,230.6 | 668.4,230.6 | 756.1,230.6 | **843.9,230.6** | 931.6,230.6 | 1019.4,230.6 | 1107.1,230.6 |
| **1** | 492.9,142.9 | 580.6,142.9 | 668.4,142.9 | 756.1,142.9 | 843.9,142.9 | 931.6,142.9 | 1019.4,142.9 | 1107.1,142.9 |

**手机（1280×720）关键格中心**：`e2=(675.1,184.5)`、`e4=(675.1,324.9)`、`d5=(604.9,395.1)`、`h8=(885.7,605.7)`。

**控件中心（本轮 H1/P1 要用）**

| 控件 | PC 中心 | 手机中心 |
|---|---|---|
| `btnnew`（新开一局） | 1339.5, 305.4 | 1071.6, 244.4 |
| `btnresign`（认输） | 1508.5, 305.4 | 1206.8, 244.4 |
| `btndraw`（求和） | 1339.5, 240.8 | 1071.6, 192.7 |
| `btnlocal`（切换同屏） | 1508.5, 240.8 | 1206.8, 192.7 |
| `btnreviewtoggle`（看历史） | 1424.0, 175.5 | 1139.2, 140.5 |
| `btnsfx`（音效开关） | 1424.0, 59.0 | 1139.2, 47.1 |
| `hitconfirmyes` | 638.1, 379.4 | 510.5, 303.6 |
| `hitconfirmno` | 961.9, 379.4 | 769.5, 303.6 |
| `hitagain`（再来一局） | 659.2, 338.4 | 527.4, 270.7 |
| `hitresultreview`（结算里的复盘） | 940.8, 338.4 | 752.6, 270.7 |
| 升变四选（后/车/象/马） | 553.6 / 708.5 / 863.4 / 1018.2, y=377.1 | 442.9 / 566.8 / 690.7 / 814.6, y=301.7 |

> **v1.11 重排后的按钮坐标**：面板按钮行改由 `CONFIG.PANEL_LAYOUT` 的
> `BTN_ROW1.y=0.255` / `BTN_ROW2.y=0.163` / `REVIEW_TOGGLE.y=0.070` 驱动，
> 且行高兜底 44px。上表是按当前代码实算的；**旧值（305.4→295.6 等）已失效**，
> 若面板再调，用附录脚本重算，不要手改数字。

### 0.2 每条用例的观测方式

| 记号 | 含义 | 工具 |
|---|---|---|
| `sim-ptr` | 模拟器真实像素点击 | `qxqy_studio_play {action:"pointer"}` |
| `sim-shot` | 运行画面截图 + 像素测量 | `qxqy_studio_play_screenshot` |
| `sim-tree` | 运行树结构化字段 | `qxqy_studio_play {action:"get", args:{inspect:true}}` |
| `sim-log` | 客户端 `print` 日志 | `qxqy_studio_play {action:"get"}` 的 `logs[]` |
| `static` | 源码不变量 | `node tests/static_checks.cjs` |

`sim-tree` 里本轮要用的字段（`Lu()` 节点结构已确认存在）：`name`、`active`、`visible`、`localRotationZ`、`sizeDeltaX/Y`、`imageColor`、`text`。

**容差约定**：像素类一律给绝对容差（px），角度类给度，比例类给 ±0.001。
坐标类断言一律用 `pointer` 真实坐标验证（`click {name}` 会绕过 `active` 检查，见项目记忆），
「控件能不能点」才用 `click {name}`。

---

## 1. 用例总表

| ID | 关联 issue | 用例名 | 画布 | 观测 |
|---|---|---|---|---|
| **H1** | #1-1 落点圆点错位 | 合法落点圆点居中 | PC + 手机 | sim-shot / sim-tree |
| **H2** | #1-1 可吃子红罩错位 | 可吃子红罩与格重合 | PC + 手机 | sim-shot / sim-tree |
| **R1** | #1-2 旋转残留 | 槽位复用后旋转复位（走子/吃子各一轮） | PC | sim-tree |
| **R2** | #1-2 旋转残留 | 走子+吃子链（11 步）后旋转与居中双复位 | PC | sim-tree / sim-shot |
| **S1** | #1-5 棋影 / 视觉居中 | 无棋影 + 棋子居中 | PC + 手机 | sim-shot / static |
| **P1** | #1-3 面板重叠 | 面板纵向区间不相交 | PC + 手机 | sim-shot / static |
| **F1** | 功能回归 | 规则与交互全链路不回退 | PC + 手机 | sim-ptr + sim-log |
| **PF1** | #1-6 性能 | 动画期只重绘脏槽位 | PC | sim-log / sim-tree |

覆盖顺序按风险排：**H1 → H2 → R1 → R2 → S1 → P1 → PF1 → F1**（F1 最长的回归放最后，前面红了下修了再跑）。

---

## 2. H1 · 合法落点圆点居中（#1-1）

**根因**：`UI.legalHL` 池是**图片控件**且 `pivot = 0.5`（位置 = 中心点），
但 `select_square` 里按 `tx + (L.cell - d)/2` 定位 —— 那是「左下角定位」公式。
正确做法：`SetAnchoredPosition(tx + L.cell/2, ty + L.cell/2)`。

| 项 | 内容 |
|---|---|
| 前置 | 全新会话，`start`（`pc-16-9`），等 `state=RUNNING`（日志「启动完成」），等 1.0s 让开局弹入跑完（`BOARD_INTRO=0.55s` + `INTRO_STAGGER`） |
| 操作 | `pointer click (843.9, 230.6)` = e2（白兵）。等 0.3s 让脉冲稳定，再截一张 |
| 期望 | e3、e4 各出现一个**墨绿圆点**（`LEGAL_HL = {46,120,92,255}`）。圆点直径 = `cell*0.30*k`，k∈[0.88,1.12] → 直径 23.2~29.5px；**圆点几何中心与该格中心偏差 ≤ 1.5px**（x 与 y 分别判） |
| 观测 | `sim-shot`：截图里取圆点连通域包围盒中心；`sim-tree`：`legalhl*` 节点的 `anchoredPositionX/Y + sizeDeltaX/2` 反推中心 |
| Red 现象 | 中心落在 `tx + cell/2 - d/2`、`ty + cell/2 - d/2`，即**偏左下 (cell-d)/2 ≈ 30.7px**，肉眼可见圆点贴格子左下角 |
| Green 判据 | 两个圆点的中心偏差都 ≤ 1.5px；且不再出现 ≈30px 的定向偏移 |
| 备注 | 这里刻意**不用** `tx + (cell-d)/2` —— 该数量级（~30px）远大于容差，和 1.5px 完全不会混淆 |

---

## 3. H2 · 可吃子红罩与格重合（#1-1）

**根因**：可吃子的红罩 `SetSizeDelta(L.cell, L.cell)` 尺寸是对的，但位置同样用
`tx, ty`（左下角）直接喂给 `pivot=0.5` 的图片控件 → 整格薄罩**偏左下 0.5 格**。

| 项 | 内容 |
|---|---|
| 前置 | 同 H1 启动；用 `DebugPlayUci` 快速把局面推到有可吃子的状态（见下） |
| 操作 | 依次 `pointer click`：`e2→e4`（843.9,230.6 → 843.9,406.1）、`d7→d5`（756.1,669.4 → 756.1,493.9）、然后 `pointer click (843.9,406.1)` 选中 e4 白兵。此时 e4 兵可吃 d5 黑兵 |
| 期望 | d5 出现整格**红薄罩**（`LEGAL_CAP = {190,64,52,170}`）。罩子矩形四边与 d5 格边**各自偏差 ≤ 1.5px**（左/右/上/下分别判） |
| 观测 | `sim-shot`：取红罩包围盒与格子理论边界（`d5`: x∈[712.3,800.0]，y∈[450.0,537.8]）比较；`sim-tree`：`legalhl*` 的 `anchoredPosition` 应为 `(tx + cell/2, ty + cell/2)`，宽高 = `cell` |
| Red 现象 | 罩子整体偏左下 0.5 格 ≈ 43.9px |
| Green 判据 | 四边偏差 ≤ 1.5px（即中心偏差 ≤1.5px 且 `sizeDelta == cell ±1.5px`） |

> **确定性提示**：`pairs(targets)` 的遍历顺序在 Lua 里不确定，所以 `legalHL[1..n]`
> 与目标格的对应关系不稳定。断言时**按位置匹配**（找离 d5 中心最近的 `legalhal` 节点），
> 不要假设索引。

---

## 4. R1 · 槽位复用后旋转复位（#1-2）

**根因**：`image_apply` 只在 `rot ~= nil and rot ~= 0` 时才写 `SetLocalRotation`。
槽位是**长期复用**的池子（`UI.pieceSlots` 32 个槽绑定棋子身份），
一旦某槽画过 `rot = 45°` 的形状，之后复用来画 `rot = 0` 的棋子时**不写旋转** → 残留 45°。

`PIECE_ART` 里 rot≠0 的项非常多（例如 PAWN 有 -11.299081 / 8.0 / 53.0 / 1.0，
KNIGHT 有 24 / 45.646694 / 16.869953 / -22 / …），所以只要走几步就必然触发。

| 项 | 内容 |
|---|---|
| 前置 | 全新会话 `start`（`pc-16-9`），等开局弹入跑完 1.0s |
| 操作 | 走 4 手：`e2→e4` `e7→e5` `g1→f3` `b8→c6`（每手之间等 0.45s > `MOVE_DUR+SETTLE_DUR=0.27s`）。再走一次**吃子**（`f3×e5`，选中 f3=(931.6,318.4) 后点 e5=(843.9,493.9)），等 0.5s |
| 期望 | 走完之后，运行树里**每一个可见棋子图元**（`p1_prim*`…`p32_prim*`）的 `localRotationZ` 必须等于它当前所画形状规定角度的**合法取值集合**内。简化可判据：任一可见图元的 `localRotationZ` 必须 ∈ `PIECE_ART` 全部 rot 值的集合（含 0），**不得出现**「该形状表里没有的角度」；更严格版按棋子种类逐槽比对 |
| 观测 | `sim-tree`：`get {inspect:true}` → 遍历 `name` 匹配 `^p\d+_prim\d+$` 且 `active==true` 的节点读 `localRotationZ` |
| Red 现象 | 吃子 / 走子后出现「该棋子种类绝不存在的角度」（例如 f3 马槽复用后残留的 45° 写到了兵身上） |
| Green 判据 | 全部可见图元 `localRotationZ` 都落在对应种类形状表的 rot 集合内，**且** 0° 形状的图元 `localRotationZ == 0`（不是上一次的旧值） |
| 静态对应 | `static` CHECK-4：`image_apply` 内必须有一处**无条件**（不被 if/for 包裹）的 `SetLocalRotation`/`localRotation` 写入。包在 `pcall(function() … end)` 里是允许的（那只保护调用），包在 `if rot ~= 0 then` 里不允许 |

> 这一条**主要靠 static 判定**：模拟器运行树里逐图元比对角度成本高，且角度在渲染管线里
> 可能被归一化（-180…180 / 0…360 两种表示）。所以 R1 的权威判据是 CHECK-4，
> 运行树比对作为「真出现了肉眼错位」时的定位手段。

---

## 4b. R2 · 走子+吃子链 11 步后旋转与居中双复位（#1-2 / #1-5）

R1 只走 4 手 + 1 次吃子，覆盖不到「槽位被回收后又复用」的完整路径。
R2 把一条**真实开局弃兵线**走完整，链上包含：马/象首次占用槽位、3 次吃子、
2 次槽位回收（被吃的子让出槽位、新走的子占用）。

| 项 | 内容 |
|---|---|
| 前置 | 全新会话 `start {canvasId:"pc-16-9"}`，等开局弹入跑完 1.0s（`BOARD_INTRO=0.55s` + `INTRO_STAGGER×32`） |
| 操作 | 依次走 11 手（意大利弃兵变例）：`e4` `e5` `Nf3` `Nc6` `Bc4` `Nf6` `Ng5` `d5` `exd5` `Nxd5` `Nxf7`。用 `DebugPlayUci` 或真实点击，**每手之间等 ≥0.45s**（> `MOVE_DUR+SETTLE_DUR=0.27s`，等动画落地再走下一手，否则脏槽位会叠在一起、测到的不是稳态） |
| 坐标（PC） | 走子的点击坐标见 §0.1 表格；关键格：`e4=(843.9,406.1)` `e5=(843.9,493.9)` `f3=(931.6,318.4)` `c6=(668.4,581.6)` `c4=(668.4,406.1)` `f6=(931.6,581.6)` `g5=(1019.4,493.9)` `d5=(756.1,493.9)` `f7=(931.6,669.4)` |
| 期望 · 旋转 | **每走完一手**，遍历运行树里所有 `active==true` 且 `name` 匹配 `^p\d+_prim\d+$` 的图片控件，其 `localRotationZ` 必须等于该控件**当前所画形状**在 `PIECE_ART` 里规定角度的允许集合（含 0）。重点盯：**吃子之后被复用的槽位**——新棋子那些 `rot=0` 的形状必须真的是 0，不能残留上一枚棋子的 45°/24° 之类 |
| 期望 · 居中 | 同一手走完后，任一棋子槽位的内容包围盒中心与所属格中心偏差 **≤ 2px**（x、y 分别判）。这条同时兜住「旋转修了但轴心偏了」和「投影删了但 `oy` 没重算」两种走样 |
| 观测 | `sim-tree`（`get {inspect:true}`，取 `localRotationZ` + `anchoredPositionX/Y` + `sizeDeltaX/Y` 反推 bbox）+ `sim-shot`（对 `e4`/`d5`/`f7` 三个刚吃过的格放大取 bbox） |
| Red 现象 | 修前：吃子后的槽位复用会带出旧角度，表现为「马/象的某些色块歪掉、整枚子看起来散架」；且只在前几手看不出来，走到第 6~8 手后明显 |
| Green 判据 | 11 手逐步检查，每一步的旋转集合与居中偏差都达标；**任何一手出现「形状表里不存在的角度」即 FAIL** |
| 静态对应 | CHECK-4（语义判据：无 rot 守卫 + 归一化 + 写归一化量）与 CHECK-0（无同名重复定义） |
| **自动对应** | `issue-1.cases.json` 的 **`slot-reuse-rot`** 用例：同一条 8 手链 + 逐步轮次/失子/末态记谱断言，可 `runCase` 自动跑。`localRotationZ` 与 bbox 仍留在本用例由 `get{inspect:true}` 人工核 |

> **为什么 R2 而不是加长 R1**：槽位复用的 bug 只在「被吃 → 回收 → 再分配」之后显现。
> R1 的 4 手只发生 1 次回收，R2 的 11 手里有 `exd5` / `Nxd5` / `Nxf7` 三次，
> 且中间穿插「新子占用刚空出来的槽位」，是这条 bug 最锋利的触发序列。

---

## 5. S1 · 无棋影 + 棋子视觉居中（#1-5）

两步判据，缺一不可。

### S1-a 无棋影（静态为主）

| 项 | 内容 |
|---|---|
| 前置 | 无需启动 |
| 操作 | `node tests/static_checks.cjs` |
| 期望 | `PASS CHECK-3`：`paint_slot` 函数体内不再出现 `PIECE_SHADOW` / `PIECE_SHADOW_W/H/DY` / `shadow` |
| 观测 | `static` |
| Red 现象 | `paint_slot` 内 9 处命中：`local shadow = take()` / `CONFIG.PIECE_SHADOW_W` / `image_apply(shadow, prim_asset(1), CONFIG.COLOR.PIECE_SHADOW, 0)` / `shadow:SetSizeDelta` / `shadow:SetAnchoredPosition` / `ui_set_active(shadow, true)` |
| Green 判据 | CHECK-3 PASS；`PIECE_SHADOW` 仅可作为 `CONFIG.COLOR` 历史字段保留（其余位置出现只提示、不判失败） |

### S1-b 无半透明椭圆（运行画面）

| 项 | 内容 |
|---|---|
| 前置 | `start`（`pc-16-9`），开局弹入跑完 |
| 操作 | 截图放大到 a1 车所在格（`a1` 中心 492.9,142.9，格范围 x∈[449.0,536.8]，y∈[99.0,186.8]） |
| 期望 | 棋子正下方**不存在**宽约 `cell*0.92*0.78 ≈ 63px`、高约 `cell*0.92*0.11 ≈ 8.9px` 的**半透明黑椭圆**（若存在，其像素相对该格底色应更暗且 alpha 混合） |
| 观测 | `sim-shot`：在棋子底部下方 8px 带内取样，与同格空白区（如 h1 格角）比 RGB，差值应 ≤ 3/255 |
| Red 现象 | 棋子脚下有一圈明显灰影（`a=40` 黑），黑子几乎看不出来、白子下方很明显 |
| Green 判据 | 取样差值 ≤ 3/255 |

### S1-c 棋子视觉居中

| 项 | 内容 |
|---|---|
| 前置 | 同上；为避免开关局动画干扰，等 ≥1.0s |
| 操作 | 截图，取 a1（车）、d1（后）、e1（王）、a8（黑车）、e8（黑王）五格 |
| 期望 | 每格内**棋子内容包围盒**（非透明像素的 bbox，排除格底色）中心与该格几何中心偏差 **≤ 2px**（x、y 分别判）。删除投影后，棋子方框 `side = cell*0.92` 与格同中心 —— 内容 bbox 允许因形状本身不对称而偏移，但轴心（`ox + side/2`）必须对齐格中心 |
| 观测 | `sim-shot` 像素测量；`sim-tree` 交叉验证：该格所有 `active` 图元的 `anchoredPosition` 均值应 ≈ `(tx + cell/2, ty + cell/2)`，偏差 ≤ 1.5px |
| Red 现象 | 有投影时 bbox 被向下拉 ~9px；去掉投影但没重算 `oy` 时 bbox 仍偏 |
| Green 判据 | 五格全部 ≤ 2px |

---

## 6. P1 · 面板纵向区间两两不相交（#1-3）

**根因**：`build_panel` 里「黑方失子」行占 `[0.46, 0.51]`，而「最近六步」记录区占
`[0.34, 0.48]`（文本）/`[0.338, 0.473]`（底色）→ **纵向重叠 0.013~0.020（面板比值）**。
12.5% 面板高在 PC 上是 ~8.8px、手机上是 ~7.0px，中文 20 号字压上去必糊。

### P1-a 静态区间（权威判据）

| 项 | 内容 |
|---|---|
| 前置 | 无需启动 |
| 操作 | `node tests/static_checks.cjs` |
| 期望 | `PASS CHECK-6`：`build_panel` 里抽出 ≥17 条纵向区间，两两不相交（>±0.001 即失败）。掉子行 / 记录区 / 4 个按钮 / 看历史 / 音效行**必须都求得出区间**（防假绿闸） |
| 观测 | `static` |
| Red 现象 | 2 处重叠：`capblack[0.460,0.510] × movelogbg[0.338,0.473]` 重叠 0.0130；`capblack[0.460,0.510] × movelog[0.340,0.480]` 重叠 0.0200 |
| Green 判据 | CHECK-6 PASS，且 17 行（含 `btnsfx`）全部参与判定 |

**白名单（允许重叠，按语义判定）**：
① 面板底板 `panelshadow/paneledge/panelbg/paneltopedge`（整块底，本来就覆盖全面板）；
② 细条 `h ≤ 0.02`（按钮上沿描边、两条分隔线 —— 压在所属色块内部，不占独立一行）；
③ 「底 + 文本」同排：一方是纯底色块（`text==""` 且有 `bg`）且两者中心互相落在对方区间内
（设计上让文字框比底色略高以免裁字，如 `panelturnbg[0.805,0.870]` + `panelturn[0.810,0.870]`）。

### P1-b 运行画面（PC 1600×900）

| 项 | 内容 |
|---|---|
| 前置 | `start`（`pc-16-9`）；先走 6 手让记录区填满（`MOVE_LOG_LINES = 6`），并制造一次吃子让「失子」行非空 |
| 操作 | 走 `e2→e4 d7→d5 e4×d5 d8×d5 g1→f3 b8→c6`（6 半手），等动画跑完 |
| 期望 | 截图里「黑方失子 …」文字行最下沿与「最近六步」记录区第一行文字最上沿**不相交**（垂直间隙 ≥ 0）；两者文字不出现像素重叠 |
| 观测 | `sim-shot`：量两段文字的 bbox，`bottom(失子行) > top(记录区)`（图像坐标下） |
| Red 现象 | 两行字互相压，笔画重叠 |
| Green 判据 | 两 bbox 在图像坐标下不相交（间隙 ≥ 0px；建议留 ≥2px 呼吸） |

### P1-c 运行画面（手机 1280×720）

| 项 | 内容 |
|---|---|
| 前置 | `start {canvasId:"mobile-16-9"}`（**独立会话，不与 PC 串联** —— 换画布 = 换生命周期），同样走 6 手 |
| 操作/期望/判据 | 同 P1-b。手机 `cell=70.2`、面板高 561.6，是**最小可用空间**，重叠最容易暴露 |
| 额外检查 | `btnsfx` 整条在面板底缘以下但仍在画布内：手机 `y=33.1`（>0 ✓）、`h=34.8`；按钮高度 `h(0.08)*561.6 = 44.9px` 达到触摸目标 44.9 下限，**不可再降** |

---

## 7. PF1 · 性能：动画期间只重绘脏槽位（#1-6）

**判据来源**：`ANIM.paintFramesFull` / `ANIM.paintFramesPartial` / `ANIM.paintSlotsTotal`，
对外接口 `GetRepaintStats()` / `ResetRepaintStats()` / `DumpRepaintStats(tag)`。

| 项 | 内容 |
|---|---|
| 前置 | `start`（`pc-16-9`），等开局弹入跑完（否则 intro 的 32 槽脏位会污染基线） |
| 操作 | ① `ResetRepaintStats()`；② 走一步 `e2→e4`；③ 等 0.6s（> `MOVE_DUR+SETTLE_DUR=0.27s`）；④ `DumpRepaintStats("pf1")`；⑤ `GetRepaintStats()` |
| 期望 | 日志出现 `REPAINT[pf1] slots=… full=… partial=… tasks=…`；`paintFramesPartial > 0`（动画期间确实走了局部路径）；`paintFramesFull` **只增 2**（动画前的全量 + 收尾全量），**不随动画帧数线性增长**；`paintSlotsTotal` 远小于 `full*32` |
| 观测 | `sim-log`（`render_pieces` 的 `ANIM.*` 计数由 `DumpRepaintStats` 打到 `print`）+ `sim-tree`（`GetRepaintStats` 若不能直接从日志读，则用 `lua` 断言查 `query.logContains`） |
| 参考基线（代码注释里的 A/B 实测） | 旧：`full=10 partial=0`（10 帧 × 32 槽 = 320 次 `paint_slot`）；新：`full=2 partial=8 slots=8`（2×32 + 8 = 72 次，降约 78%） |
| Red 现象 | `paintFramesPartial == 0`（走了全量路径）或 `paintFramesFull ≥ 动画帧数` |
| Green 判据 | `partial ≥ 1` 且 `full ≤ 3` 且 `slots < full*32*0.5` |
| 补充 | `GetRepaintStats()` 是 `lua` 断言可读的（模拟器支持 `{"kind":"lua","source":...}` 调 `query.logContains`）。**若 `kind:"lua"` 不可用，退化为 `log` 断言 `REPAINT[pf1]` 存在 + 人工读数字** |

---

## 8. F1 · 功能回归（保证 issue #1 修复不改玩法）

> 这一组是「修复前后都必须 PASS」。它不进 Red 证据，是**防回归网**。
> 每条都独立 `start`，不串联状态（模拟器换画布 / 重开都会重建生命周期）。

| ID | 功能 | 操作（PC 1600×900 真实坐标） | 期望（可观察量） |
|---|---|---|---|
| F1-01 | 普通走子 | `click` e2 → e4 | `panelturn.text` 由「轮到白方走子」变「轮到黑方走子」；`movelog.text` 含「白 e2→e4」；`e4` 有棋子、`e2` 无 |
| F1-02 | 吃子 | 续 F1-01：d7→d5、e4×d5 | `capwhite.text` 含「兵」；`movelog` 出现「白 e4→d5」 |
| F1-03 | 王车易位 | 快局：`e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 e1g1`（用 `DebugPlayUci` 走前 6 手，最后一步用真实点击 `e1→g1`）= `(843.9,142.9)→(1019.4,142.9)` | 王到 `g1`、车到 `f1`；`movelog` 含「白 e1→g1」；不崩 |
| F1-04 | 吃过路兵 | `e2e4 a7a6 e4e5 d7d5` 后 `e5×d6`（点 `(843.9,493.9)→(756.1,406.1)`） | d5 的黑兵消失；`capwhite` 增加；`movelog` 含「白 e5→d6」 |
| F1-05 | 升变 | `DebugPlayUci` 推到 `b7b8` 局面后点击升变格 | 弹出升变弹窗（`promo1..4` 可见，文案「后/车/象/马」）；点「后」后 b8 变后且轮到黑方 |
| F1-06 | 将死结算 | 傻瓜将死：`f2f3 e7e5 g2g4 d8h4` | 结算面板可见，`resulttitle.text` =「黑方将死白方，黑方胜」；棋盘输入锁定 |
| F1-07 | 认输确认 | 点 `hitresign`(1508.5, 305.4) → 弹确认 → 点 `hitconfirmyes`(638.1, 379.4) | 先出现「认输就直接判负，确定吗」；确认后 `resulttitle.text` =「白方认输，黑方胜」 |
| F1-08 | 复盘进出 | 走 2 手 → 点 `hitreviewtoggle`(1424.0, 175.5) → 出现「退出复盘」→ 点「下一步」→ 再点「退出复盘」 | 进入：`panelturn.text` 变「复盘 · 第 N/M 步」；`btnreviewtoggle.text` =「退出复盘」；退出后回到「轮到 X 走子」，棋盘可点 |
| F1-09 | 音效开关 | 点 `hitsfx`(1424.0, 59.0) | `btnsfx.text` 由「音效：开」变「音效：关」，再点变回「音效：开」 |
| F1-10 | 联机降级同屏 | 启动日志看 `启动完成：… 联机发送=false 接收=false 同屏=true` | 无信号环境自动降级为本地同屏，不阻断启动、不报 fault |
| F1-11 | 面板按钮不穿透 | 弹结算面板后点面板「求和」位置 (1339.5, 240.8) | 结算期间面板命中区关闭，点击不触发求和（`show_panel_buttons(false)` 生效） |

**F1 全组把「崩溃」也当失败**：任何 `GAME FAULT BEGIN` / `attempt to call a nil value` 出现在日志即整组 FAIL
（本项目历史上因 `local function` 先用后定义导致四条终局路径全崩，见 `tools_work/lua_check.cjs`）。

---

## 9. 修复前 Red 证据

### 9.1 运行记录

- **时间**：见 [red-evidence-baseline.txt](red-evidence-baseline.txt) 头部（每次运行都打当时时间）
- **命令**：`node tests/run-baseline.cjs`（内部等价于
  `git show HEAD:<f> > 临时目录/<f>` ×3，再
  `node tests/static_checks.cjs --root=<临时目录>`）
- **为什么要绕一层**：工作区里的 `lua/levelScript.lua` 正被并发修改（Lead 在修 issue #1），
  直接跑只会读到「当前状态」，没法当「修复前」的证据。`run-baseline.cjs` 从 `git HEAD`
  导出三份文件到临时目录再复跑，**Red 证据变成一条可重现的命令**，不随工作区漂移。
- **完整输出**：见 [red-evidence-baseline.txt](red-evidence-baseline.txt)
- **退出码**：`1`（4/8 通过，4 项失败：CHECK-3/4/5/6）

### 9.2 实际输出摘要（原文照录）

```text
     · lua/levelScript.lua：5006 行 / 216290 字节
     · sim/levelScript.lua：5009 行 / 216515 字节
     · out/交付包/levelScript.lua：5006 行 / 216290 字节

PASS CHECK-0 无同作用域 local function 重复定义（静默覆盖）: 112 个 local function 名字，按 AST 作用域分组后无重名
PASS CHECK-1 语法三份均可 Lua 5.3 解析: luaparse Lua 5.3｜lua/levelScript.lua ✓，sim/levelScript.lua ✓，out/交付包/levelScript.lua ✓
PASS CHECK-2 三份文件一致（剥注释/索引行后逐行相同）: 三份一致（各 3676 行有效代码；已剥注释与 4 个模板索引行）
FAIL CHECK-3 无棋影（paint_slot 内无阴影绘制）: paint_slot 内仍有 9 处阴影痕迹 → 第 3085 行: local shadow = take()；第 3086 行: if shadow ~= nil then；第 3087 行: local sw = sside * CONFIG.PIECE_SHADOW_W；第 3088 行: local sh = sside * CONFIG.PIECE_SHADOW_H；第 3089 行: image_apply(shadow, prim_asset(1), CONFIG.COLOR.PIECE_SHADOW, 0)；第 3090 行: shadow:SetSizeDelta(sw, sh)；第 3091 行: shadow:SetAnchoredPosition(ox + sside * 0.5,；第 3092 行: oy + sside * CONFIG.PIECE_SHADOW_DY)；第 3093 行: ui_set_active(shadow, true)
FAIL CHECK-4 图元旋转无条件写入（image_apply）: image_apply（第 1656 行）未满足语义判据：① 仍存在「用 rot 决定是否写入」的守卫：rot 与 0 比较「rot ~= 0」、rot 与 nil 比较「rot ~= nil」、if rot（真值守卫）「if rot」；② 缺少归一化 `local r = rot or 0`（rot 为 nil 时必须当 0 写）
FAIL CHECK-5 落点高亮按格中心（select_square）: 落点高亮仍用左下角补偿式「(L.cell - d) / 2」（legalHL 块第 4026 行起）→ pivot=0.5 的图片控件会整体偏左下
FAIL CHECK-6 面板纵向区间两两不相交（build_panel）: 2 处纵向重叠 → capblack[0.460,0.510] × movelogbg[0.338,0.473] 重叠 0.0130；capblack[0.460,0.510] × movelog[0.340,0.480] 重叠 0.0200｜参与判定 17 行: paneltitle[0.900,0.980] panelturnbg[0.805,0.870] panelturn[0.810,0.870] clockwhitebg[0.698,0.783] clockblackbg[0.598,0.683] clockwhite[0.700,0.790] clockblack[0.600,0.690] capwhite[0.520,0.570] capblack[0.460,0.510] movelogbg[0.338,0.473] movelog[0.340,0.480] btnnew[0.240,0.320] btnresign[0.240,0.320] btndraw[0.150,0.230] btnlocal[0.150,0.230] btnreviewtoggle[0.060,0.140] btnsfx[-0.082,-0.020]
PASS CHECK-7 图元预算自洽（PIECE_PRIM_BUDGET vs PIECE_ART）: 预算 64 ≥ 单枚最大 34（ROOK）｜PAWN=12(r0×6/r1×0/r2×0)，KNIGHT=28(r0×14/r1×0/r2×0)，BISHOP=20(r0×10/r1×0/r2×0)，ROOK=34(r0×17/r1×0/r2×0)，QUEEN=34(r0×17/r1×0/r2×0)，KING=20(r0×10/r1×0/r2×0)
```

### 9.3 Red 结论对照

| 检查 | 结果 | 对应 issue | 说明 |
|---|---|---|---|
| CHECK-0 无重复定义 | **PASS** | — | 基线没有同名 local function 重复。**修复过程中一度变红**（`image_apply` 在旧位置留了一份副本），见 §12.4 |
| CHECK-1 语法 | **PASS** | — | 三份都能被 luaparse 5.3 解析（基线本来就是绿的，用来兜住「改崩了」） |
| CHECK-2 三份一致 | **PASS** | — | 基线三份一致（3676 行有效代码）。修复期间只要有人忘了跑同步脚本就会变红 |
| CHECK-3 无棋影 | **FAIL** | #1-5 | `paint_slot` 内 9 处投影代码 |
| CHECK-4 旋转无条件写 | **FAIL** | #1-2 | `image_apply` 守卫命中 3 条（`rot ~= 0` / `rot ~= nil` / `if rot`），且缺 `rot or 0` 归一化 |
| CHECK-5 落点用格中心 | **FAIL** | #1-1 | legalHL 块第 4026 行起仍用左下角补偿式 `(L.cell - d) / 2` |
| CHECK-6 面板不重叠 | **FAIL** | #1-3 | `capblack` × `movelogbg` 重 0.0130、× `movelog` 重 0.0200 |
| CHECK-7 图元预算 | **PASS** | #1-6 附带 | 预算 64 ≥ 最大 34（ROOK）。**注意**：这是按「投影已删除」的算法（role0×2+role1×2+role2×1）算的；删除后实际需求还会再降 1 |

> **关于 CHECK-7 的口径**：用例规格给的算法是「投影已删除后：role0×2 + role1×2 + role2×1」。
> 基线代码里 `piece_prim_count` 仍以 `n = 1`（投影）起算，所以**实际**需求是
> `specCount + 1`，最大 35 ≤ 64，也仍在预算内。删掉投影后两者会收敛到同一个数。
> 该检查在基线上是 PASS —— 它是「防修复把预算改坏」的护栏，不是本轮的 Red 来源。

### 9.4 尚未取得的证据（需在步骤 6 用模拟器补齐）

以下 4 条**只能靠模拟器实跑**，静态检查覆盖不到，本文件不造假数据：

| 用例 | 缺什么 | 补法 |
|---|---|---|
| H1 圆点居中 | 圆点实际像素中心 | `start` → 点 e2 → 截图量 bbox |
| H2 红罩重合 | 红罩实际矩形边界 | 走到可吃子局面 → 选中 → 截图量四边 |
| S1-b/S1-c | 是否存在灰影、棋子 bbox 是否居中 | 开局截图放大到格级取样 |
| PF1 | `REPAINT[...]` 真实计数 | `ResetRepaintStats` → 走一步 → `DumpRepaintStats` |

**约束说明**：本轮被明确要求「不要跑试玩」，所以这 4 条停在「用例已制定 + 静态侧已红」，
界面侧证据留到步骤 6（`runtime=simulator`）补，**不得**用静态检查冒充像素级通过。

---

## 9b. v1.11 修复后 Green 证据（待填）

> 本节由 Lead / 模拟器执行者填写。**每条都要写 `runtime=`**（`simulator` / `真机`）。
> 静态项填 `runtime=static`。没有实测的格子留空，不要写「已通过」。

### 9b.1 静态检查（`node tests/static_checks.cjs`）

**本次实测**：`2026-11-05T11:55:02Z` · `node tests/static_checks.cjs` · **8/8 PASS，退出码 0**
完整输出见 [green-evidence-current.txt](green-evidence-current.txt)。
`lua/levelScript.lua` 5305 行 / 230675 字节；三份一致（有效代码 3844 行）。

| 检查 | 结果 | 执行者 | runtime | 命令 | 实际输出摘要 | 备注 |
|---|---|---|---|---|---|---|
| CHECK-0 无同作用域重复定义 | **PASS** | test-designer | static | `node tests/static_checks.cjs` | `120 个 local function 名字，按 AST 作用域分组后无重名` | 按「最近外层 function」分组；`image_apply` 旧副本已删 |
| CHECK-1 语法三份可解析 | **PASS** | test-designer | static | 同上 | `luaparse Lua 5.3｜lua ✓，sim ✓，out/交付包 ✓` | |
| CHECK-2 三份文件一致 | **PASS** | test-designer | static | 同上 | `三份一致（各 3844 行有效代码；已剥注释与 4 个模板索引行）` | 已跑 sync_sim_copy + sync_delivery |
| CHECK-3 无棋影 | **PASS** | test-designer | static | 同上 | `paint_slot 函数体已无阴影绘制｜其余位置仍有 PIECE_SHADOW 定义（第 192 行，属 COLOR/CONFIG 历史字段）` | 历史字段保留、函数体不引用即合规 |
| CHECK-4 旋转语义无条件写 | **PASS** | test-designer | static | 同上 | `① 无 rot/0/nil 守卫；② 归一化 r = rot or 0；③ 写入 SetLocalRotation(0, 0, r)` | 语义判据，不再看语法包裹 |
| CHECK-5 落点用格中心 | **PASS** | test-designer | static | 同上 | `① 两分支同一对实参「cx, cy」；② cx = tx + 半格、cy = ty + 半格；③ hlBase 记 cx/cy（2 处）` | 结构化判据 |
| CHECK-6 面板不重叠 | **PASS** | test-designer | static | 同上 | `[PANEL_LAYOUT] 9 项两两不相交（分隔线跳过 2 条）｜音效行 pc-16-9: h=54.8px 间隙61.8px ✓；mobile-16-9: h=44.0px(兜底) 间隙49.4px ✓` | 读 CONFIG.PANEL_LAYOUT 显式表 |
| CHECK-7 图元预算自洽 | **PASS** | test-designer | static | 同上 | `预算 64 ≥ 单枚最大 34（ROOK）｜PAWN=12 KNIGHT=28 BISHOP=20 ROOK=34 QUEEN=34 KING=20` | 投影删除后口径 |

**双向验证（本轮新增结论）**：

| 方向 | 命令 | 结果 | 说明 |
|---|---|---|---|
| 修复**后**代码 | `node tests/static_checks.cjs` | **8/8 PASS**（退出码 0） | 修复有效 |
| 修复**前**代码（`git HEAD`） | `node tests/run-baseline.cjs` | **4/8**（CHECK-3/4/5/6 FAIL，退出码 1） | **新判据仍能抓住旧 bug** —— CHECK-4/CHECK-5 从「语法/字面量判据」改成「语义/结构化判据」之后，对旧代码的检出能力没有退化；旧代码不会因为判据放宽而假绿 |

> 这条双向验证是防止「检查器被改松」的关键：只有 `HEAD 4/8 + 当前 8/8` 同时成立，
> 才能说这 8 项检查既抓得住旧缺陷、又没有误报新实现。

### 9b.2 模拟器界面用例

| 用例 ID | 执行者 | runtime | 命令 / 步骤 | 画布 | 实际观感 / 数值 | 结论 |
|---|---|---|---|---|---|---|
| H1 落点圆点居中 | | | `start` → 点 e2 → 截图量 bbox | pc-16-9 | | |
| H1（手机） | | | `start {canvasId:"mobile-16-9"}` → 点 e2 | mobile-16-9 | | |
| H2 可吃子红罩重合 | | | 走到 e4/d5 可吃子 → 选中 e4 → 截图量四边 | pc-16-9 | | |
| H2（手机） | | | 同上 | mobile-16-9 | | |
| R1 槽位复用旋转复位 | | | 4 手 + 1 吃子 → 读 `localRotationZ` | pc-16-9 | | |
| R2 11 步链旋转+居中 | | | `e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7`，每步查角度与 bbox | pc-16-9 | | |
| S1-a 无棋影（静态） | | | 见 9b.1 CHECK-3 | — | | |
| S1-b 无半透明椭圆 | | | 开局截图，a1 格底部取样与空白区比 RGB | pc-16-9 | | |
| S1-c 棋子视觉居中 | | | 截图量 a1/d1/e1/a8/e8 五格 bbox 中心 | pc-16-9 | | |
| P1-b 面板不重叠 PC | | | 走 6 手 + 一次吃子 → 截图量两段文字 bbox | pc-16-9 | | |
| P1-c 面板不重叠 手机 | | | 同上 | mobile-16-9 | | |
| PF1 脏槽位重绘计数 | | | `ResetRepaintStats()` → e2→e4 → `DumpRepaintStats("pf1")` | pc-16-9 | | |
| F1-01 普通走子 | | | 点 e2 → e4 | pc-16-9 | | |
| F1-02 吃子 | | | d7→d5、e4×d5 | pc-16-9 | | |
| F1-03 王车易位 | | | `e1→g1` | pc-16-9 | | |
| F1-04 吃过路兵 | | | `e5×d6` | pc-16-9 | | |
| F1-05 升变 | | | 推到 `b7b8` → 点升变格 → 选后 | pc-16-9 | | |
| F1-06 将死结算 | | | 傻瓜将死 4 手 | pc-16-9 | | |
| F1-07 认输确认 | | | `hitresign` → `hitconfirmyes` | pc-16-9 | | |
| F1-08 复盘进出 | | | `hitreviewtoggle` → 下一步 → 退出复盘 | pc-16-9 | | |
| F1-09 音效开关 | | | 点 `hitsfx` 两次 | pc-16-9 | | |
| F1-10 联机降级同屏 | | | 读启动日志 | pc-16-9 | | |
| F1-11 面板按钮不穿透 | | | 结算后点求和位置 | pc-16-9 | | |

### 9b.3 结论汇总（待填）

| 项 | 内容 |
|---|---|
| 静态门禁 | ☐ 8/8 PASS（`node tests/static_checks.cjs` 退出码 0） |
| 模拟器界面 | ☐ H1/H2/R1/R2/S1/P1/PF1 全绿 |
| 功能回归 | ☐ F1-01 ~ F1-11 全绿 |
| 日志洁净 | ☐ 无 `GAME FAULT BEGIN`、无 `attempt to call a nil value` |
| 记录归档 | ☐ 结果写入 `records/playtest.md` 并标 `runtime=simulator` |
| **真机状态** | ☐ **未验证**（模拟器全绿 ≠ 真机通过，须走步骤 7） |

---

## 10. Green 门禁（修复完成时的判据）

一次全过才算收：

1. `node tests/static_checks.cjs` → **8/8 PASS，退出码 0**（CHECK-0~7；CHECK-2 需先跑
   `node tools_work/sync_sim_copy.cjs` 与 `node tools_work/sync_delivery.cjs`）；
2. H1 / H2 / R1 / R2 / S1-b / S1-c / PF1 在 `pc-16-9` **与** `mobile-16-9` 分别达标（换画布必须独立 `start`）；
3. F1-01 ~ F1-11 全绿，日志无 `GAME FAULT`、无 `attempt to call a nil value`；
4. 模拟器全绿后记录 `records/playtest.md` 并标 `runtime=simulator`，**仍不能称「真机通过」**
   —— 真机（步骤 7）另有 4 个模板索引要填、设备像素密度不同、图片控件行为可能不一致。

---

## 11. 已知风险与假设（信息不足时取的默认）

| # | 假设 | 影响 | 若不成立怎么改 |
|---|---|---|---|
| A-1 | 模拟器 `pointer` 是画布坐标（原点左下、Y 向上） | 所有点击坐标 | 若实测 Y 反向，全部 `y` 换成 `canvasH - y`；用例 0.1 已给两种画布高度 |
| A-2 | 运行树里棋子图元名为 `p<N>_prim<K>`（`create_image` 的 `name` 参数） | R1 / S1-c 的 tree 断言 | 改成前缀匹配 `^p\d+_prim\d+$`；名字若变了就用「所有 image 控件且 imageId∈{100001,100002,100003}」筛 |
| A-3 | 模拟器支持 `lua` 断言（`query.logContains`） | PF1 读数 | 退化为 `log` 断言 `REPAINT[` 存在 + 人工核对数字 |
| A-4 | `GetRepaintStats()` 能在驱动脚本里直接调用 | PF1 精确判据 | 用 `DumpRepaintStats(tag)` 打日志替代（日志格式已在代码里固定：`REPAINT[%s] slots=%d full=%d partial=%d tasks=%d`） |
| A-5 | 图片控件渲染的图元（100001~100003）能被截图量出 bbox | H1/H2/S1-c | 模拟器只预览 100001–100006 六个图元，圆点/红罩用的正是 100002/100001，**在预览范围内**；若仍量不到，改用 `sim-tree` 的 `anchoredPosition`+`sizeDelta` 反推 |
| A-6 | 面板坐标在 build_panel 内是「面板内相对值」，`cardPad = L.cell*0.10 = 0.0125` | CHECK-6 归一化 | 该等价关系来自 `panelH = boardSide` 且 `cell = boardSide/8`，改比例就会变；若 `PANEL_WIDTH_RATIO`/`BOARD_SIDE_RATIO` 变动，需同步 `static_checks.cjs` 的 `BASE.cardPad` |
| A-7 | `pairs(targets)` 顺序不确定 | H1/H2 的索引假设 | 断言按**位置**匹配控件，不按 `legalHL[n]` 索引 |
| A-8 | 「6 条修复」中的第 4 条（删纯字体棋子 + README 截图）由其他人做 | 不在本轮用例范围 | 本文件只覆盖 #1-1/#1-2/#1-3/#1-5/#1-6 五条；第 4 条属文档/素材，无 Lua 判据 |
| A-9 | 基线复跑靠 `tests/run-baseline.cjs` 从 `git HEAD` 临时导出，跑完即删 | 仓库整洁 | 需要长期保留基线时加 `--keep`；也可以 `--rev=<sha>` 指向任意历史提交 |
| A-10 | 坐标数字按 `LAYOUT.compute` 实算，不是手抄 | 全部坐标 | 若 `BOARD_SIDE_RATIO`/`PANEL_WIDTH_RATIO`/`FRAME_PAD_RATIO` 被改，用本文 0.1 的公式重算（脚本见附录） |
| A-11 | JSON 用**扁平**事件写法 `{kind,t,type,x,y}`，不是规格里的 `{type,args:{…}}` | 整份 cases.json 能不能跑 | 已用插件真实的规范化函数 `er()` 实测：`{type:"pointer",args:{…}}` 会被拒，报 `unsupported event kind: (empty)`。扁平写法是当前插件版本唯一接受的形态（见 12.2） |

---

## 附录 · 坐标重算脚本

改动布局常量后，用这段重算全部坐标（`node -e` 直接跑）：

```js
const L = (cw, ch) => {
  const bs = ch * 0.78, cell = bs / 8, bb = (ch - bs) / 2;
  const pw = cw * 0.22, pl = cw - pw, ph = bs, pb = (ch - ph) / 2;
  let bl = (cw - bs) / 2;
  if ((cw + bs) / 2 > cw - pw) bl = (pl - bs) / 2;
  return { cw, ch, bs, cell, bb, bl, pw, pl, ph, pb };
};
const sq = (l, file, rank) => [l.bl + file * l.cell + l.cell / 2, l.bb + rank * l.cell + l.cell / 2];
const btn = (l, rx, ry, rw, rh) => [l.pl + l.pw * rx + l.pw * rw / 2, l.pb + l.ph * ry + l.ph * rh / 2];
// 用法示例（PC）：
const pc = L(1600, 900);
console.log('e2', sq(pc, 4, 1), 'e4', sq(pc, 4, 3), 'btnnew', btn(pc, 0.04, 0.24, 0.44, 0.08));
```

> 与 issue 给定公式的一致性：issue 用 `cell=87.8, boardLeft=449, boardBottom=99`，
> 本文件用 `87.75 / 449.0 / 99.0`（由 `0.78 × 900 / 8` 精确算出）。
> 两者差值 ≤ 0.25px，远小于 1.5px 容差，**可以互相替代**；
> e2=(844,231)、e4=(844,406) 与实算的 (843.9,230.6)/(843.9,406.1) 完全相容。

---

## 12. 用例 JSON 的两个格式陷阱（实测）

`tests/issue-1.cases.json` 不是照规格写出来的，是**用插件真实的规范化函数验过**的
（`dsh-plugin-beyond-simulator/dsh-plugin/dist/worker.js` 里 `er()` / `cs()` / `uo()` 三个函数，
抽出来单独跑）。以下两条是实测结论，写错任何一条都会让用例静默假绿或直接报错。

### 12.1 事件必须是扁平写法，不能是 `{type, args}`

规格里给的 `{"type":"pointer","args":{"type":"click","x":..,"y":..}}` **会被拒绝**：

```
SPEC-FORM (type/args) -> REJECTED: unsupported event kind: (empty)
```

`uo()` 取的是 `String(t.kind || t.do || "")` —— 它认的是 `kind`，不是 `type`。
正确形态（本文件实际使用）：

```json
{ "t": 0.10, "kind": "pointer", "type": "click", "x": 843.9, "y": 230.6 }
```

`type` 在这里是**指针动作**（`move`/`down`/`up`/`click`/`wheel`），和事件 kind 是两回事。

### 12.2 断言必须带 `at`，且 `at=0` 的断言会被同一时刻的点击污染

`td()` 的回放循环是：**先跑完所有 `t <= at` 的事件 → 再求值 `at` 上的断言**。
所以：

- **不写 `at`** → 默认 `at=0`，在整段回放最开头就求值；`log` 断言通常还查不到（日志还没出）。
- **写了 `at=0` 又放了 `t=0` 的点击** → 点击已经生效，`at=0` 的第 5、6 条断言查的是「点完之后」的状态。

因此本文件的约定是：

1. 每条断言都显式带 `at`（除了 `log` 类，它查的是整段累积日志，早查晚查都一样）；
2. **所有点击从 `t ≥ 0.1` 开始**，`at=0` 只留给「点击发生前」的初值断言；
3. 点击之间留 ≥ 0.4s（> `MOVE_DUR + SETTLE_DUR = 0.27s`，等动画落地再点下一手）。

### 12.3 `runCase` 的两种喂法

```js
// 喂顶层对象 = 一条贯穿全流程的完整用例（启动 → 走子 → 音效开关）
qxqy_studio_play { action: "runCase", args: { case: <issue-1.cases.json 整体>, canvasId: "pc-16-9" } }

// 喂 cases[i] = 拆开的单点用例
qxqy_studio_play { action: "runCase", args: { case: <issue-1.cases.json>.cases[1], canvasId: "pc-16-9" } }
```

`canvasId` 由 `runCase` 的 args 传入（`o1()` 里 `Re({...C, playerCount: …})` 会把它带进 `playStart`），
**不要**指望 case 对象里的 `canvasId` 字段被读取 —— 它只是给人看的标注。

已验证 5 个子用例 + 顶层用例全部能被 `er()` 规范化通过（事件/断言条数、`dt` 都正确解析）。

---

## 12.4 检查器自身的三次修正（v1.11 修复期间踩到的坑）

这三条都是**检查器误报**，不是代码 bug。记在这里，避免下一个人再把判据改回「语法/字面量」：

| # | 误报现象 | 原因 | 现在的判据 |
|---|---|---|---|
| 1 | CHECK-4 报「旋转写入被条件包裹」 | 判据是**语法**的（"SetLocalRotation 外包块不能有 if"），把**值缓存** `if st.rot ~= r then … end` 误判成语义跳过 | **语义**判据：无 `rot`/0/nil 守卫 + 有 `rot or 0` 归一化 + 写的是归一化量 |
| 2 | CHECK-5 报「找不到 L.cell / 2」 | 判据是**字面量**的（要求中心公式出现在 `SetAnchoredPosition` 那一行），而中心已提到循环外的 `local cx, cy = tx + L.cell * 0.5, …` | **结构化**判据：两分支同一对实参 + 中心变量有「+半格」定义式 + `hlBase` 记同一对 |
| 3 | CHECK-6 报「样本不足（0 条）」 | 解析器只认 `atY(0.52)` 这种内联写法；重构后改成 `CONFIG.PANEL_LAYOUT` 表 + 局部量（`by`/`cy`/`row1Y`），表达式求值全失败 | **优先读 `CONFIG.PANEL_LAYOUT` 显式区间表**（并由「build_panel 确实引用了 PL」交叉验证），读不到才回退到实参解析 |

### 12.4.1 CHECK-0 的由来：`image_apply` 一度被定义两次

修复过程中 `lua/levelScript.lua` 里曾同时存在两份 `local function image_apply`：

- 第 1750 行：旧的 `if rot ~= nil and rot ~= 0 then … end` 写法（**死代码**）
- 第 1814 行：新的「值缓存 + 无条件写」写法（**生效**）

Lua 里同一作用域内重复 `local function` 会**静默覆盖**：后一份生效、前一份成了死代码，不报错不警告。
后果是双向的：

1. 读代码的人会以为修的是第一份（条件写法），实际生效的是第二份；
2. **静态检查取错了定义** —— `findFunction` 原本取第一份，于是代码明明修好了、CHECK-4 却一直红。

因此新增 **CHECK-0**：用 luaparse 的 AST（`FunctionDeclaration` 节点自带 `loc` 与 `isLocal`）
按**作用域**分组，同一作用域内同名 `local function` ≥2 次即 FAIL。
必须是「同作用域」才算——`RULES.uci_of` 与 `move_text` 内部各有一个 `local function sqname`，
那是常规写法，不能误报（手搓块栈曾把它俩误报成重复，改用 AST 才干净）。

同时 `findFunction` 改为**取最后一份**定义（= Lua 实际生效的那份），
这样「代码已修好但留了旧副本」不会让语义检查一直红——由 CHECK-0 单独把副本问题报出来。

---

## 12.5 v1.11 面板重排带来的断言修正（会导致旧断言假 FAIL）

面板重排除了修 issue #1 第 3 条，还改了三处**可观察量**。旧断言不改就会假红：

| # | 变化 | 旧期望 | 新期望 | 依据 |
|---|---|---|---|---|
| 1 | 失子行空列表不再显示空串 | `capwhite`/`capblack` = `""` | **`"无"`** | `CONFIG.TEXT.CAP_NONE = "无"`；`cap_text()` 在 `#list == 0` 时返回它 |
| 2 | 走子记录空列表不再显示空串 | `movelog` = `""` | **`"还没有走子"`** | `CONFIG.TEXT.MOVELOG_EMPTY`；`render_move_log()` 在 `n == 0` 时用它 |
| 3 | 失子行带前缀 | 裸字母 `"P P"` | **`"失子 P P"`** | `CONFIG.CAP_PREFIX = "失子 "`（源码注释：旧版只列字母看不出是谁吃的） |
| 4 | 音效行增高导致中心下移 | `btnsfx` 中心 `y = 63.2` | **`y = 59.0`** | `sfxH = h(REVIEW_TOGGLE.h)=ph*0.078` 兜底 44px；`sfxY = py - sfxH - ph*0.018`。实测 box `left=1262.08 bottom=31.608 w=323.84 h=54.756` → 中心 `(1424.0, 59.0)` |
| 5 | **面板按钮行整体上移**（`PANEL_LAYOUT` 驱动 + 行高兜底 44px） | `btnnew` y=295.6 / `btndraw` y=232.4 / `btnreviewtoggle` y=169.2 | **305.4 / 240.8 / 175.5** | `BTN_ROW1.y=0.255`、`BTN_ROW2.y=0.163`、`REVIEW_TOGGLE.y=0.070`，`btn_h()` 兜底 44px |

> 第 5 条最容易漏：控件**名字没变**、`kind:"control"` 断言不受影响，
> 但凡是**用坐标去点面板按钮**的用例（F1-07/F1-08/F1-11 等）都必须换成新值，
> 否则点击会落在按钮上边缘之外 → 看似「功能坏了」实为「点歪了」。

### 12.5.1 还有一个**不是面板引起的**坑：走完一步后 `hint` 不会复位

`apply_move` / `try_move` 都**不碰** `UI.panel.hint`。走完一步后提示条仍停在
「已选中 · 点亮的格子都能走」，只有这三种情况才回到 `HINT_OPENING`：

- 点同一枚已选中的子（取消选中）→ `on_square_clicked` 的 `GAME.selected == sq` 分支；
- 选了不能选的子（选中失败）→ `select_square` 返回 false 分支；
- 新开一局 → `new_game()`。

所以 `move-e2-e4` 用例**不能**在走子后断言 `hint == HINT_OPENING`（那是假 FAIL）。
当前 JSON 里该用例只在 `at=0.45`（选中后、走子前）断言 `HINT_SELECTED`，走子后不再对 `hint` 设断言。

### 12.5.2 `movelog` 是 6 行窗口，长链要断言全文

`render_move_log()` 只显示**最近 `MOVE_LOG_LINES = 6` 行**：`from = max(1, n - 6 + 1)`。
`slot-reuse-rot` 走 8 手，所以 `movelog.text` 是**第 3~8 手**这 6 行，`\n` 连接：

```text
白 e4→d5
黑 g8→f6
白 b1→c3
黑 f6→d5
白 c3→d5
黑 d8→d5
```

### 12.5.3 `slot-reuse-rot` 的走子链与期望值怎么来的

不是猜的：用 **fengari 真 Lua 5.3** 跑 `lua/levelScript.lua` 的 `CONFIG + RULES` 区，
逐手 `RULES.find_move` + `RULES.make`，验证了 8 手全合法、终局未将死未将军，并导出
每手后的 `captured` / 失子列表 / 轮次：

| 手 | UCI | 记谱 | 被吃 | capWhite | capBlack | 下一手 |
|---|---|---|---|---|---|---|
| 1 | e2e4 | 白 e2→e4 | — | 无 | 无 | 黑 |
| 2 | d7d5 | 黑 d7→d5 | — | 无 | 无 | 白 |
| 3 | e4d5 | 白 e4→d5 | 黑兵 | 无 | 失子 P | 黑 |
| 4 | g8f6 | 黑 g8→f6 | — | 无 | 失子 P | 白 |
| 5 | b1c3 | 白 b1→c3 | — | 无 | 失子 P | 黑 |
| 6 | f6d5 | 黑 f6→d5 | 白兵 | 失子 P | 失子 P | 白 |
| 7 | c3d5 | 白 c3→d5 | 黑马 | 失子 P | 失子 P N | 黑 |
| 8 | d8d5 | 黑 d8→d5 | 白马 | 失子 P N | 失子 P N | 白 |

终局 FEN `rnb1kb1r/ppp1pppp/8/3q4/8/8/PPPP1PPP/R1BQKBNR w KQkq - 0 5`，
`game_status.over = false`（不会因为误判终局而锁住棋盘）。

**时间轴**（每手占 1.0s，手内两次点击间隔 0.5s，落子后 0.35s 断言）：

```text
点击 t: 0.1 0.6 | 1.1 1.6 | 2.1 2.6 | 3.1 3.6 | 4.1 4.6 | 5.1 5.6 | 6.1 6.6 | 7.1 7.6
断言 at: 0 | 0.95 | 1.95 | 2.95 | 3.95 | 4.95 | 5.95 | 6.95 | 7.95
```

> **为什么不把每手压到 0.5s**：那样「上一手第二击」与「下一手第一击」会撞在同一 `t`
> （实测生成出 `0.6,0.6`），同一时间戳的两个 `pointer` 事件在回放里顺序不可控。
> 必须 `MOVE_SLOT > CLICK_GAP`。
>
> 另外每手间隔 1.0s 也稳稳大于 `MOVE_DUR + SETTLE_DUR = 0.27s`，
> 保证每次点击都落在「上一手动画已结束」的稳态上——否则测到的不是终态。

事件坐标已做**往返校验**：把每个 `pointer` 的 `(x, y)` 反算回格名，
8 对恰好是 `e2→e4 / d7→d5 / e4→d5 / g8→f6 / b1→c3 / f6→d5 / c3→d5 / d8→d5`。
