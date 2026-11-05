# 技术架构 · 黑白棋局（千星奇域 2D+Lua 国际象棋）

> 交付后维护用的操作性说明。任何结构性改动（新增分区、控件池、模板索引、信号）都要同步本文件。

## 一、文件职责

| 文件 | 职责 | 谁改 |
|---|---|---|
| `lua/levelScript.lua` | **正式交付脚本**（单文件）。CONFIG 里 3 个模板索引保持 `0`，由用户按真机填写 | 开发 |
| `sim/levelScript.lua` | **模拟器副本**。= 交付文件 + 4 个真实模板索引，用于 qxqy 模拟器试玩 | 开发 |
| `sim/piece_PW.lua` … `sim/piece_KB.lua` | **12 份拟合棋子数据模块**（PW/PB/BW/BB/NW/NB/RW/RB/QW/QB/KW/KB）。每份 = 原拟合导出文件去掉尾部自绘逻辑、改为 `return {IMAGE_W, IMAGE_H, BACKGROUND_COUNT, PALETTE, ELEMENTS}`；`PALETTE`/`ELEMENTS` 数字与源文件逐行相同 | 素材 |
| `tools_work/fit_out/pixelfit3.py` | 早期手排形状生成器（**已停用**，棋子现走拟合数据） | — |
| `tools_work/icons/solid/` | 拟合源图（freeicon「Solid」包，可商用免署名，256×256 RGBA） | 素材 |
| `lua/chess_pieces.lua` | 早期手绘形状表（**已停用**，保留作对照） | — |
| `proto/chess_demo.html` | HTML 效果展示（体验沟通用，不是交付件） | 开发 |
| `sim/probe.lua` / `pieces_probe.lua` / `game_probe.lua` / `input_probe.lua` | 能力/渲染/输入探针，**不属于交付物** | 开发 |
| `out/交付包/` | 交付物与说明文档 | 开发 |
| `records/playtest.md` | 试玩证据（按 runtime 标来源） | 开发 |

**同步规则**：改 `lua/levelScript.lua` 后必须同步 `sim/levelScript.lua`，
两者差异**只允许**是 CONFIG 的 4 个模板索引 + 头部说明注释。用 `export_delivery.py`
自动核对（它剥掉注释后比代码行，避免行号错位产生假差异），别手工对。

**脚本映射（v1.7 起不需要）**：v1.7 把棋子改成**脚本内自带的几何表**（`PIECE_ART`），
不再 `require` 外部数据文件，因此 12 个 `piece_*.lua` 映射不必再注册。
文件仍留在 `sim/` 里作对照史料（改回 v1.5 那套 400 图元方案时可用）。

**v1.9 棋子美术管线（改棋子必须走这条线，别直接手写形状）**

```
out/棋子素材-en-croissant/png/256/*.png    cburnett 原图（12 枚，CC BY-SA 3.0）
        ↓  算法拟合（docs/pieces-fit-report.md 记录方法与指标）
docs/pieces-fit-generated.lua               拟合产物（6 枚，74 图元）
        ↓  机械拷贝
sim/levelScript.lua 的 PIECE_ART 表          ★运行时唯一权威★
   + lua/levelScript.lua（同一份，仅模板索引与注释头不同）
        ↓  paint_slot() 分层渲染
棋盘上的棋子
```

- **数据源是 Lua 的 `PIECE_ART`，不是 CSS。** `docs/pieces.css` 已废弃为纯预览件，
  不再参与管线；改形状只改 `PIECE_ART`（或重新拟合后整段替换）。
- **白黑共用同一份形状**（`PIECE_ART[kind]`，扁平结构，无 `.w`/`.b` 两层）。
  cburnett 的白子是细黑描边、黑子是实心填充，但提取后的**实心剪影相同**；
  双方区别只在渲染颜色：白=白填充+深描边，黑=深填充+浅描边。
  **不要**再引入 `PIECE_ART.w` / `PIECE_ART.b` 或 `BLACK_OVERRIDE` —— v1.8 之前那套已删除。
- **整幅 256×256 映射到棋子方框，不做逐枚裁剪**，所以兵明显比王矮（实测 兵/王 = 0.909）。
  改成按每枚自身 bbox 裁切会把兵放大到与王同高 —— 这是 v1.8 踩过的坑。
- **图形类型**：`shape` 0=矩形 1=椭圆 2=三角。矩形用于直边（车的塔身/垛口/底座台阶），
  三角用于尖角（后的冠尖、车的凹槽），其余是椭圆。纯椭圆画不出方头垛口 —— 会变圆耳朵。
- **`piece_prim_max_of_all()` 必须单层遍历 `PIECE_ART`**。改成两层 side 遍历会让它返回 1，
  `PRIM_MAX = 1`，每枚棋子只画一个投影椭圆 → 全盘空白。这是 v1.9 修掉的真实 bug。
  太慢，改成直接在 Lua 里调、再回写文档。
- 白黑共用同一份形状（`PIECE_ART[kind]` 扁平表），区别只在渲染颜色，**不需要两套表**。
  cburnett 的黑子与白子外轮廓基本相同，差别只在细节线的粗细/有无和个别局部尺寸，
  所以不复制两份表（否则必然出现改了白方忘了黑方的 bug）。
- 三角形朝向：千星图元 100003 默认**尖朝上**，与 CSS `polygon(50% 0%, …)` 的视觉上边一致，
  所以 `rot_lua = -rot_css` 就够，不需要额外的 180° 补偿。
- **role 三层**：0 外形 / 1 镂空 / 2 细节线。细节线是 cburnett 的灵魂（鬃脊、眼窝、冠带弧、
  车的砖缝、象的十字），用**对比色**画 —— 白子画深线、黑子画浅线，靠画法区分双方，
  这样落在任何棋盘底色上都有清晰边缘。

**五层渲染（`paint_slot`，顺序固定，与数据表顺序无关）**

> **v1.11 变更（issue #1 第 5 条）**：删除底部投影层。投影只能整体压在底座下方，
> 与「视觉居中」直接冲突；浅木格上的半透明椭圆还会被看成脏斑。轮廓改由描边层表达。
> 控制数因此 1399 → 1367（32 槽 × 1 枚减 1 个控件）。

| # | 层 | 用什么形状 | 什么颜色 |
|---|---|---|---|
| ① | 外形描边 | 全部 role0 形状**各自向外长 pad** | 描边色 |
| ② | 外形填充 | 全部 role0 形状原尺寸 | 体色 |
| ③ | 镂空描边 | role1 形状各自向外长 pad | 描边色 |
| ④ | 镂空填充 | role1 形状原尺寸 | **该格棋格色**（视觉上等于挖穿）|
| ⑤ | 细节线 | role2 形状原尺寸 | 对比色 |

- **层序是硬约束：必须「所有描边 → 所有填充」两遍，不能逐形状交替。**
  交替画会让后一个形状的描边压在前一个形状的填充上，棋子内部每条形状交界都出现一道描边色，
  整枚棋子变成「一堆描好的积木」，冠尖/鬃毛上还会戳出黑边
  （v1.11 第一版实测：白王头顶长出黑色三角、黑车身上出现白色描边缝）。
- **描边用「逐形外扩 pad」而不是「整组等比放大」**。整组放大时离中心越远的形状外移越多，
  同一枚棋子远离中心那侧描边粗、靠近中心那侧细，一圈边粗细不均，看起来"发胖"。
  逐形外扩对单个形状精确，对并集只在凹角处略厚一点，1px 量级看不出来。
- `PIECE_OUTLINE_PAD` 取 **0.020**（1600×900 画布、81px 棋子方框 ≈ 1.6px）。
  v1.9 曾用 0.012，但去掉投影后描边成为唯一的外形载体，需要略厚一点才立得住。
- **细长形状要再夹一道上限**：`PIECE_PAD_THIN_RATIO = 0.22`，
  实际 pad = `min(PIECE_OUTLINE_PAD × sside, min(w,h) × sside × 0.22)`。
  不夹的话，0.05 宽的鬃毛会吃到自身宽度 80% 的外扩，细节糊成色斑。
- **role2 细节线必须很细**（归一化尺度 ≤ 0.06）。它是**实心图形**不是描边，
  用 0.30×0.50 的椭圆画鬃毛会变成盖住半个头的色斑（实测踩过）。
- 镂空靠「用棋格底色再画一遍同一形状」实现 —— 平台图元没有挖洞能力。

**棋子视觉居中（`piece_center_dy`，issue #1 第 5 条）**

- 六种棋子的形状并集竖向中心并不都在 0.5（实测 0.463~0.510），
  直接用方框中心会让棋子整体偏上/偏下。
- 做法：把所有 role0 形状的**旋转后 AABB** 累积成一个全局并集，
  取 `PIECE_CENTER_DY = 0.5 - (yMin+yMax)/2`。
  实测 `yMin=0.0671048`、`yMax=0.9167111`、中心 `0.4919080`
  → **`PIECE_CENTER_DY = +0.0080920453`**（74 个 role0 形状，逆时针旋转）
  在 `paint_slot` 里对这枚棋子整体平移 `PIECE_CENTER_DY × sside`。
- Demo（`proto/chess_demo.html`）用**同一式子同一符号约定**算出同一个数，
  只是 CSS 的 top 向下为正，所以落地时取相反数 `-0.0080920453`。
  两边必须同式：否则拿 Demo 截图和模拟器截图对比时，会分不清「差 0.2px 是没对齐」还是「算法本来就不同」。
- **必须是「一个全局偏移」，不能逐枚各自居中**：逐枚居中会把兵拉成和王一样高
  （实测兵/王高度比 0.909），棋子就分不出大小了。全局偏移只统一基线，不改相对高矮。
- 实测结果：32 枚棋子的内容包围盒中心与格中心偏差 **≤ 2.9px**（81px 棋子方框）。

## 二、`levelScript.lua` 的 11 个分区
| 分区 | 职责 |
|---|---|
| 1 CONFIG | 全部可调常量：4 个模板索引、图元编号、配色（v1.10 浅色主题）、字号、联机信号名与 eventType、`FRAME_PAD_RATIO` |
| 2 LOG | `log_info` / `log_err` / `emit_fault`，故障用 `GAME FAULT BEGIN/END` 包裹 |
| 3 RULES | 走法引擎（纯逻辑）。`legal_moves` / `make` / `unmake` / `perft` / `find_move`；区末为**棋子几何表 `PIECE_ART`**（v1.9：算法拟合的矩形/椭圆/三角并集，白黑共用一份，74 图元）与 `piece_art_of` / `piece_prim_count` / `piece_prim_max_of_all`。v1.5 的 400 图元加载器（`PIECE_DATA_TAG` / `fit_normalize` / `load_piece_fit`）与更早的 `PIECE_SHAPES` 均已停用保留 |
| 4 LAYOUT | **唯一坐标换算入口**。`compute(w,h)` 出格宽/棋盘左下/面板矩形/`framePad`；`square_pos(L,sq)` 给格号→像素。其他分区不得出现基准数字 |
| 5 FACTORY | 控件工厂。固定顺序：创建→pivot→锚点→尺寸→位置→样式→`SetActive(false)`→登记。`create_text` / `create_cursor_area` / `create_image` / `image_apply` / `prim_asset` |
| 5.5 ANIM | **动画调度（v1.7）**。`EASE` 缓动函数组、`ANIM` 任务表、`anim_add(dur,fn,onDone,slot)` / `anim_kill` / `anim_update` / `anim_clear`、`color_alpha`。所有动画都是 `{t, dur, fn, slot}` 任务，由 `OnUpdate` 单点推进。**v1.10 起带脏槽位机制**：任务的第 4 参 `slot` 让 `anim_update` 知道「谁动了」，OnUpdate 据此只重绘那几个槽位 |
| 5.6 SFX | **音效（v1.10）**。`CONFIG.SFX`（10 个键→音效 ID）、`SFX` 运行时状态（`enabled` / 环形缓冲 `ids` / `available` / `overFired` / `lowTimeFired`）、`sfx_play` / `sfx_stop_all` / `sfx_toggle` / `sfx_remember`、`with_click`（按钮统一点击音包装）。放在 ANIM 之后、UI 之前，因为 UI 建「音效开关按钮」时要读 `SFX.enabled` |
| 6 UI | 界面构建。背景渐变带（**24 条插值，不是 3 条**）+ 棋盘外框 + 64 格 + 坐标 + 上步痕迹 + 将军警示 + 落点池（**图片控件**）+ 选中薄罩与上下亮框 + 棋子槽位池 + 面板（描边框/卡片/状态条/棋钟卡/分隔线/主次按钮/**音效开关**）+ 四个弹窗 |
| 7 GAME | 业务状态与流程：`new_game` / `board_intro` / `select_square` / `try_move` / `apply_move` / `render_all` / `render_pieces` / `paint_slot` / `anim_move_piece` / `anim_capture_piece` / `reset_piece_slots` / `anim_update_hilites`；本区另含**复盘视图层**（`review_snap` / `view_board` / `view_state` / `view_clocks` / `view_captured` / `review_turn_text`）与**复盘状态机**（`enter_review` / `exit_review` / `review_goto` / `review_render` / `review_load`） |
| 8 INPUT | 原生命中：每格一个光标区，闭包捕获格号，**不读坐标** |
| 9 NET | 联机：能力探测 + `ChessSync` 信号收发 + 降级为同屏 |
| 10 LIFECYCLE | `OnInit/OnStart/OnEnable/OnUpdate/OnDestroy`，启动重试与清理 |
| 11 SELFTEST | 自检入口（perft 标准局面等），不参与玩法 |

## 三、关键控件与容器

全部运行时控件都由 Lua 用 `game.InstantiateClientUIControl(prefabIndex, parent)` 实例化，
父级统一是 `script.object`（脚本挂在容器节点上，它就是容器）。

| 模板（真机需读自己的索引） | 用途 | 数量 |
|---|---|---|
| 容器节点 | 脚本挂载点 / 所有控件的父级 | 1 |
| 文本框模板 | 棋盘格、坐标、高亮、面板、按钮、三个弹窗 | 主体 |
| 光标检测区域模板 | 64 个棋盘格命中 + 4 个面板按钮命中 + 弹窗按钮命中 | 69+ |
| 图片模板 | 拟合棋子图元池（32 槽 × 34） | 1088 |

**每槽棋子 = 单枚最大图元数（当前 34，来自 ROOK/QUEEN）个图片控件**。
32 槽 → 1088 个图片控件，加文本框与光标区，模拟器实测总计 **1367 个控件**
（PC 1600×900 与手机 1280×720 均为 1367）。

> 控件数演进：1508（v1.6~v1.9，含棋子投影）→ 1399（v1.10 棋子改为 35 控件/枚）
> → **1367**（v1.11 去掉投影层，34 控件/枚）。
> 每枚棋子的控件数由 `PIECE_ART` 里图元最多的那枚决定，不是手填的常数。

### 棋子池设计（零创建零销毁）
`create_piece_slots` 一次性建好 32 槽，每槽 `{prims[1..PRIM_MAX]}`。
`paint_slot` 只改尺寸/位置/颜色/显隐，**播放期不新建不销毁**。
棋子**只有「拟合图元拼」这一种画法**，没有备选样式，因此没有样式切换按钮。

**槽位容量由数据决定，不是硬编码**：`PRIM_MAX` 初值为 `CONFIG.PIECE_PRIM_BUDGET`，
`build_all_ui` 里先 `load_piece_fit()` 再用 `piece_prim_max()` 校正，然后才 `build_board()`
（`create_piece_slots` 在 `build_board` 内）。顺序错了会导致槽位容量与实际图元数不符。

### 棋子图元数据格式（拟合数据）
```
PIECE_FIT[有符号棋子ID] = { {kind, nx, ny, nw, nh, rotDeg, {r,g,b,a}}, ... }
  kind  0=矩形 1=椭圆 2=三角
  nx,ny ∈[0,1]  **图元中心**，左下原点、Y 向上（槽位图元 pivot=0.5）
  nw,nh ∈[0,1]  占棋子方框的比例
  颜色  直接取拟合结果的 PALETTE 项（自带描边色，不再叠加描边层）
```

`paint_slot(slot, p, bx, by, sq)` 按数据原索引顺序绘制，靠顺序保住层叠关系。
`sq` 参数现仅作签名保留（拟合数据自带颜色，不需要再用棋格色挖洞）。

### 拟合数据的三处关键换算（改动前务必读）
1. **坐标**：原数据 `cx,cy` 是 512×512 像素坐标，且 **`cy` 为负**（导出器 y 从图片顶部往下量）。
   归一化式：`nx = cx / IMG_W`、`ny = (cy + IMG_H) / IMG_H`。
2. **剔除底纸**：源图是「双色棋子压在白底上」，`ELEMENTS` 里混了还原白底纸的大块。
   判据：只用**暗色元素**（`luma <= 90`）算棋子包围盒；暗色块中心落框内即保留，
   浅色块要求**整个外接框在框内且 alpha >= 180**。这样白子的白色填充留得住、底纸被筛掉。
   （阈值 150 会把底纸过渡灰也当暗色，实测会在棋子下方留下灰色椭圆。）
3. **丢弃越界块**：填充模式会输出伸到画布外的图元，其 `cy` 会让归一化 y 变负值，
   一旦参与包围盒就把整枚棋子压扁（实测 PB 曾出现 `y0 = -0.24`）。
   因此先按「旋转后外接框完全落在 0..1」筛一遍，再算包围盒。

### 为什么不用 `PIECE_SHAPES` 手排了
旧方案是自研「像素扫描带」（24 行 × 48 列，每枚 17–27 矩形），IoU 0.94、逐像素无损，
但需要自己维护形状表。改用拟合数据后，形状直接来自用户提供的 12 份导出，
改动只需调 `PIECE_PRIM_BUDGET` 一个数字。旧表保留在源码里作对照，运行期不再读取。

## 四、数据流

```
点击 → 光标检测区回调（闭包带 sq 号）
     → on_square_clicked(sq)
        ├ 已选中且 sq 是合法落点 → try_move(sq) → apply_move → render_all + net_send_move
        ├ 点的是同一枚 → 取消选择
        └ 否则 select_square(sq) → 算 legal_moves → 亮选中/落点高亮
```

```
OnUpdate(dt)
  ├ 【复盘中直接 return】不累计用时、不扣棋钟、不触发超时判负
  ├ 棋钟走秒（每 CLOCK_REFRESH_SEC 刷文本）
  └ 只在必要时 setter —— 不做全量重绘
```

## 四之二、复盘（v1.6，逐手回放）

### 两个入口
| 入口 | 控件 | 出现条件 | 行为 |
|---|---|---|---|
| 结算面板「复盘」 | `UI.result.btnReview` / `hitReview` | 对局结束后结算弹窗上 | 进复盘，停在最后一步 |
| 面板第三行常驻键 | `UI.review.btnToggle` / `hitToggle`（(4%,6%) 92%×8%） | 始终可见 | 对局中显示「看历史」→进复盘停最后一步；复盘中显示「退出复盘」→退出 |

### 复盘面板按钮（与正常四键同位同尺寸，靠显隐切换）
| 位置 | 正常模式 | 复盘模式 |
|---|---|---|
| (4%, 24%) | 新开一局 | 开局 |
| (52%, 24%) | 认输 | 上一步 |
| (4%, 15%) | 求和 | 下一步 |
| (52%, 15%) | 切换本地同屏 | 终局 |
| (4%, 6%) 92% 宽 | 看历史 | 退出复盘 |

### 快照结构（`GAME.history`）
```
history[1]  = 开局快照（text=""，from/to=nil，capW/capB=0，clockW/clockB=INITIAL_TIME_SEC）
history[i+1]= 第 i 步（apply_move 在加秒后、终局判定前 push）
  { fen, text, from, to, capW, capB, clockW, clockB }
```
- `fen` 走完后的局面；`text` 该步文案（= `GAME.moveLog` 末项）；`capW/capB` 双方失子数；
  `clockW/clockB` 加秒后的双方剩余秒数。
- **只存最小信息**：局面表在翻页时 `RULES.parse_fen` 一次并缓存到 `GAME.reviewState`，不在逐帧 parse。
- `new_game` 重置为只有开局快照。

### 视图层（复盘中所有渲染都走这里，绝不改 `GAME.st`）
| 函数 | 复盘时返回 | 正常时返回 |
|---|---|---|
| `review_snap()` | `history[idx+1]` | `nil` |
| `view_board()` | `reviewState.board` | `GAME.st.board` |
| `view_state()` | `reviewState` | `GAME.st` |
| `view_clocks()` | `snap.clockW/clockB` | `GAME.clockW/Black` |
| `view_captured(list, upto)` | 前 `upto` 项 | 全列表 |
| `review_turn_text()` | 「复盘 · 开局」/「复盘 · 第 N/M 步」 | `nil` |

`render_pieces` / `render_captured` / `render_move_log` / `show_last_move` /
`show_check_warning` / `update_clock_text` / `update_turn_text` 全部改成读视图层。

### 复盘的四个硬约束
1. **棋盘只看不点**：`set_board_input(false)` 关掉 64 个命中区，`on_square_clicked` 开头再挡一道。
2. **棋钟不走**：`OnUpdate` 在 `GAME.review ~= nil` 时直接 return。
3. **退出后原样继续**：`exit_review` 清 `review`/`reviewState`，`GAME.over` 为真则重弹结算面板，否则恢复棋盘输入 + `render_all`。
4. **空态拒绝**：`#GAME.history <= 1` 时提示条写 `REVIEW_EMPTY` 并返回，不进入复盘。

### ⚠️ 词法作用域坑（本轮实测踩到）
`review_snap` / `view_board` / `view_state` / `view_clocks` / `view_captured` /
`review_turn_text` **必须定义在 `format_clock` / `set_clock_labels` / `update_clock_text` /
`show_last_move` 之前**。Lua 的 `local function` 是词法向前作用域，放到渲染函数之后就变成
nil 调用，`OnStart` 直接崩：`attempt to call a nil value (global 'view_clocks')`，界面建完就没下文。
`review_render` 因为被 `enter_review` 调用、自身又调用渲染函数，用「先 `local review_render` 前向声明、
段末再赋值」的方式定义。

### ⚠️ 结算面板新按钮必须加进 `hide_result`
`hide_result()` 里漏掉 `btnReview` / `hitReview` 的显隐 → 开局时「复盘」按钮直接画在棋盘 e3 格上
（模拟器截图实测）。**凡是往结算面板加控件，都要同步 `show_result` 与 `hide_result` 两处。**

### ⚠️ 轮次行的终局文案
`update_turn_text` 原先写 `if GAME.over then return end`，导致「结算后进复盘→退出」时轮次行
停在「复盘 · 第 N/M 步」不还原（模拟器实测到残影）。改成终局时写 `CONFIG.TEXT.TURN_OVER`（「棋局结束」）。

## 二之二、v1.10 浅色主题（配色迁移的坑，改配色前必读）

配色权威来源是 `proto/chess_demo.html` 的 `COLOR` 表（第 866-892 行）+ `ALPHA` 表（860-865 行）。
Lua 的 `CONFIG.COLOR` 与它**逐项同值**，Demo 写 `rgb` 三元组 + `ALPHA`，Lua 直接展开成 `{r,g,b,a}`。

### 浅色主题的五个连带项（只改数值会出事）
1. **文字全部必须变深色**。`TEXT_MAIN` 由 236,240,248（近白）改成 38,36,33（近黑）。
   漏掉任何一处 = 白底白字，肉眼直接看不见。
2. **主按钮要单独的字色**。`BTN_PRIMARY` 是深琥珀 188,116,20，字必须用浅色
   `BTN_PRIMARY_TEXT` 250,246,240。沿用普通按钮的 `BTN_TEXT`(44,40,36) 会让深字压在琥珀上糊成一团。
3. **投影不能再用纯黑**。棋盘外框投影 `BOARD_SHADOW` 120,88,58 a=60、面板 `PANEL_SHADOW`
   120,100,78 a=40，都是暖褐色。纯黑在浅米底上会画出一圈脏灰。棋子投影 `PIECE_SHADOW`
   也从 a=64 压到 a=40。
4. **背景色带必须加密到 24 条**。v1.7 的 3 条（各 300px）在深靛蓝上看不出分界；换成浅米后
   **显两条硬横线**（模拟器截图实测）。现按 Demo 的 0%/46%/100% 三个停靠点线性插值出 24 条，
   每条取中心采样、高度 +1 重叠 1px 盖掉取整细缝。实测相邻带最大通道差 = 1，肉眼连续。
5. **坐标与提示条要让开棋盘暖木外框**。`framePad` 从 `build_board` 的局部变量提升到
   `LAYOUT.compute` 的 `L.framePad`（配 `CONFIG.FRAME_PAD_RATIO = 0.16`），三处共用：
   棋盘外框本身、坐标外推 `L.framePad + 2`、提示条 y 起点 `+ L.framePad`。
   **不让开就会压在木框上**：木框 150,112,82 配坐标字 150,144,136 对比度仅 ~1.2:1，
   等于坐标消失（Demo 第 1306 行踩过同一处）。坐标字色同时由 `TEXT_DIM` 改 `TEXT_SUB`。
6. **面板必须描边**。卡片 252,250,247 与外壳 242,239,234 只差 ~10 点亮度，不描边分不出
   面板边界。平台文本框没有 `border` 字段，用「一块比卡片大 2×edgeT 的 `PANEL_EDGE` 色块
   + 卡片压在它上面」拼出四边框。**描边框必须在卡片之前创建**（同级后出现的在上）。

### 已知残留风险（需要真机或用户判断）
- 轮次行 `TEXT_ACCENT`(188,116,20) 压在 `PANEL_SECTION`(238,234,227) 上对比度 **3.10:1**，
  20px 正文字号低于 WCAG AA 的 4.5。Demo 用同一组颜色（这是 Demo 的既有设计），
  本次迁移照 Demo 走不擅自改；若真机上觉得看不清，把 `TEXT_ACCENT` 压深到 ~140,86,14 即可。
- 其它文字组均已核验：面板标题 14.86、按钮字 10.72、失子/记录 4.89、坐标 4.80、
  提示条 5.29、弹窗文字 14.86、棋钟（活动大字）3.10（36px 大字，AA 门槛 3.0 达标）。

### `consistency_check.cjs` 的 4 个已知误报（**已由 Lead 修掉**）
`WHITE_PIECE` / `WHITE_OUTLINE` / `BLACK_PIECE` / `BLACK_OUTLINE` 在 Lua 侧叫
`WHITE_FILL` / `WHITE_EDGE` / `BLACK_FILL` / `BLACK_EDGE`，而脚本的 `demoColorMap` 只映射了
Lua 键名、没映射这 4 个，于是报「lua=未找到」。**数值本身四个全部一致**（已逐项核对：
253,252,250 / 44,40,36 / 36,33,30 / 246,243,238）。

> **v1.10 末已修**：脚本改成显式配对表后 4 项全部 PASS，现在 `consistency_check.cjs`
> 整体 **exit 0 / 无 FAIL**。同时新增了三条音效断言（表完整性 / 调用点可解析 / 语义覆盖度），
> 其中「调用点可解析」正是能抓出 `sfx_play("over")` 那条事故的检查。

### 面板竖向排布只有一个事实来源：`CONFIG.PANEL_LAYOUT`（v1.11）

**为什么要有这张表（issue #1 第 3 条的真实成因）**：v1.10 的面板坐标散落在
`build_panel` 里几十处 `atY(0.79)` / `py + ph * 0.46` 之类的手算表达式，
改一处不影响别处，于是「失子行」与「走子记录区」在 1600×900 下重叠了 0.013~0.020 个面板高度
（1280×720 下更明显），屏幕上就是失子的字母压进走子记录的文字里。

| 槽名 | y（下边缘比例） | h | 内容 |
|---|---|---|---|
| `REVIEW_TOGGLE` | 0.070 | 0.078 | 行 3：看历史 / 退出复盘（常驻） |
| `BTN_ROW2` | 0.163 | 0.078 | 行 2：求和 / 切换本地同屏 |
| `BTN_ROW1` | 0.255 | 0.078 | 行 1：新开一局 / 认输 |
| `DIV_BTN` | 0.348 | 0.005 | 分隔线（按钮区 ↔ 走子记录） |
| `MOVE_LOG` | 0.360 | 0.218 | 走子记录（6 行） |
| `DIV_LOG` | 0.588 | 0.005 | 分隔线（走子记录 ↔ 失子） |
| `CAP_BLACK` | 0.600 | 0.050 | 黑方失子（**屏幕下方那行**） |
| `CAP_WHITE` | 0.660 | 0.050 | 白方失子（**屏幕上方那行**） |
| `CLOCKS` | 0.730 | 0.088 | 两个棋钟**并排一行**（各半宽） |
| `TURN` | 0.828 | 0.062 | 轮到谁走子 |
| `TITLE` | 0.900 | 0.085 | 标题「黑白棋局」 |

- **y 是「下边缘」，不是「中心」**，因为面板坐标系是千星原生（原点左下、Y 向上）。
  CSS 里对应的是 `bottom: y*100%`，不是 `top`。
- **`CAP_BLACK` 在 `CAP_WHITE` 下方**（0.600 < 0.660）。这个先后容易记反，
  以表为准 —— 表里数值小的在屏幕下方。
- **棋钟 v1.11 从「上下两行」改成「并排一行」**：这正是解决重叠的关键一步，
  两个棋钟各占半宽后，中间腾出了 0.070 的高度给失子两行。
  代价是字号从 36 降到 28（`CONFIG.FONT.CLOCK`），否则「白 15:00」放不进半宽。
- 按钮行高在 720 高画布上会小于 44px，所以 `btn_h()` 有 `max(44, h(...))` 兜底 ——
  触摸设备上小于 44px 的键点不中。
- 音效开关**不在表内**：它的 y 是「面板底 − 自身高 − 间距」现算的，
  因为它挂在面板外框下方，不属于面板内部的分段。
- 这条不变量由 `tests/static_checks.cjs` 的 **CHECK-6** 与
  `tools_work/consistency_check.cjs` 的「面板按钮布局一致」双重守护：
  前者校验 Lua 表内两两不相交，后者校验 Lua 与 Demo 的 11 项逐项相等。

### 弹窗必须自带描边 + 投影（浅色主题特有）
Demo 的 `.dlg-bg` 是 `background: var(--c-panel); border: 1px solid var(--c-panel-edge);
box-shadow: 0 18px 48px rgba(110,88,62,0.20)`。而：
- `PANEL_BG` = 252,250,247
- `OVERLAY` = 250,248,244 @ a=170

两者**几乎同色**。也就是说浅色主题下，弹窗与遮罩**是靠 border + box-shadow 区分的，
不是靠底色差**。早期 Lua 侧只铺了 `PANEL_BG` 一层，结果整个遮罩区糊成一整片白，
结算面板的边界完全看不出来（模拟器截图实测）。
→ **两个模态弹窗都必须齐套 `overlay + edgeBox + shadow`**：
- `build_result_panel`：补建 `UI.result.edgeBox`（`PANEL_EDGE`，外扩 1 层）
  与 `UI.result.shadow`（`PANEL_SHADOW`，向下偏移 = Demo 的 `0 18px`）
- `build_confirm_dialog`：原先**连 overlay 都没有**（白卡片直接压在棋盘上，观感像排版错位），
  补齐 `UI.confirm.overlay` / `.shadow`（下偏 `cell*0.10`）/ `.edgeBox`，
  并把三件一并放进 `UI.confirm.parts`。
→ 控件数演进：1394（仅结算描边投影）→ 1396 → **1399**（确认弹窗 +3）。
  构建顺序必须 `overlay → shadow → edgeBox → bg → text → 按钮 → 命中区`（后建在上）。

### ⚠️ 模态弹窗会被「下层命中区」穿透（v1.10 实测到的丢状态级 bug）
`raise_hit` 在 `build_all_ui` 末尾把面板/棋盘命中区统一 `SetAsLastSibling()`，
而弹窗是之后才建的 —— **视觉上被遮罩盖住，点击却仍被下层命中区接走**。
实测复现：认输确认框开着时点面板「新开一局」，会再弹一个框，且 `GAME.confirmKind`
被从 `"resign"` 覆盖成 `"newgame"` → **用户以为在确认认输，实际把对局重置了**。

修法用**双层防线**（互为兜底，缺一不可）：
1. **护栏（纵深层）**：`show_confirm` 开头 `if GAME.confirmKind ~= nil then return end`。
   放在任何 UI 写入之前 —— 被拒绝时界面完全不动，不会出现「文案已换、kind 没换」的半状态。
   这是防丢状态的最后一道保险（即使 UI 锁失效、或联机信号在弹窗期间触发了别的 confirm）。
2. **锁命中区（横深层）**：`show_confirm` / `show_result` 末尾调 `show_panel_buttons(false)`
   + `ui_set_active(UI.panel.hitSfx, false)` + `ui_set_active(UI.review.hitToggle, false)`；
   `hide_confirm` / `hide_result` 按 `if not GAME.over and GAME.confirmKind == nil and GAME.review == nil`
   恢复。**这一层才真正挡住点击本身**，副作用（点击音）也一并消失。

**实测确认了是哪一层在挡**（注释掉护栏做反向验证）：注释护栏后真实坐标点击仍无反应，
`audio.recent` 不增长 → **是锁命中区在挡**；护栏守的是 `confirmKind` 不被覆盖。

> **坑：`show_panel_buttons` 必须先于所有调用者定义。** 它被 `show_result`(3608)、
> `hide_result`、`show_confirm`、`hide_confirm`、`new_game` 调用。第一次上移只移到了
> `hide_result` 之前，漏了更早的 `show_result` → `show_result` 里的引用被词法绑定成
> **global** → 运行时 `attempt to call a nil value (global 'show_panel_buttons')`
> → **结算面板完全弹不出来，四条终局路径全崩**（认输/将死/超时/和棋）。
> `lua_check.cjs` 的「局部函数无先用后定义」抓到了它。**这条检查已列为 git init 前强制门禁。**

## 四之三、v1.10 走子提速（脏槽位局部重绘）

用户反馈「动画不跟手、响应慢」。

### 根因
`OnUpdate` 在动画期间每帧调 `render_pieces()` **全量重绘**：
重建 `bySq`（64 格 + 32 槽）→ 遍历 32 槽 → 每槽 `paint_slot`。
而 `paint_slot` 对一枚棋子要做 **6 遍形状遍历**（投影/外形描边/外形填充/镂空描边/镂空填充/细节线），
每个图元 3~4 次控件写（`image_apply` + `SetSizeDelta` + `SetAnchoredPosition` + `ui_set_active`）。
32 枚 × 数十图元 ≈ **每帧数千次控件写** —— 这才是掉帧的真因，不是动画曲线不好看。

### 修法（三个文件都在这一处）
1. `anim_add(dur, fn, onDone, slot)` 新增第 4 参 `slot`：任务声明「我每帧会改这个槽位」。
2. `anim_update` 推进任务时调 `anim_mark_dirty(task.slot, seen)` 登记脏槽位（`seen` 每帧新建，
   用 slot 表本身做 key 做 O(1) 去重）。
3. `anim_take_dirty()` 取本帧脏列表并清空，返回 `(list, count)` ——
   **必须显式给 count**：Lua 的 `#t` 对带洞的表不可靠。
4. `render_pieces(onlySlots, onlyCount)` 新增快速路径：非 nil 时跳过 bySq 重建与整盘遍历，
   只 paint 传入的槽位。
5. OnUpdate：动画中只重绘脏槽位并置 `GAME.needsRepaint = true`；`ANIM.count == 0` 时按该标记
   补一帧**全量**重绘收尾，把可能的半格/旧位置刷干净。

### 为什么不会漏绘
- 槽位**归属**（`slot.sq` / `slot.key`）只在三处改：全量 `render_pieces`、`apply_move`、
  `reset_piece_slots`。这三处之后都会走全量渲染。
- 动画任务只改 `x / y / scale / lift / fading`，**不改归属** → 动画期间归属稳定，
  只重绘这些槽位足够。
- 动画结束必有一次全量收尾（`needsRepaint`），覆盖任何边界情况。

## 四之三之二、v1.11 控件写缓存（issue #1 第 6 条）

v1.10 把「重绘多少个槽位」降下来了，但**每个槽位内部**仍然每次全写一遍：
`paint_slot` 对每个图元都调 `image_apply` + `SetSizeDelta` + `SetAnchoredPosition`。
其中 `image_apply` 写的图元 / 颜色 / 旋转在**动画期间根本不变**（动画只改尺寸与位置），
所以那一部分纯属重复写。v1.11 加两层「值相同就不写」：

| 缓存 | 位置 | 记什么 | 省掉什么 |
|---|---|---|---|
| `IMG_STATE` | 脚本侧弱键表 | 每个图片控件当前的 `asset` / `color` / `rot` / `typeSet` | `SetImage` / `imageColor` / `SetLocalRotation` / `imageType` |
| `VIS_STATE` | 脚本侧弱键表 | 每个控件当前的 `active` 布尔 | 重复的 `SetActive` + `SetVisible` 成对写 |
| 文本写缓存 | `CLOCK_CACHE` 与各自局部变量 | 棋钟 / 轮次 / 失子 / 走子记录上一次写的**最终字符串** | 文本没变时的 `text` / `fontColor` / `bgColor` 写 |

- **缓存必须放脚本侧弱键表，不能挂在控件上。** 平台控件对象可能是带严格元表的 userdata，
  `ctrl.__imgAsset = x` 会抛 "no such field"（v1.11 初稿差点这么写）。
  弱键（`__mode="k"`）保证控件销毁后条目自动回收，不泄漏。
- **`image_apply` 的旋转是「无条件写」而不是「rot≠0 才写」**（见下面 issue #1 第 2 条）。
  缓存比较的是「上次写的值 vs 这次要写的值」，不是「这次的值是不是 0」。
- 首次调用一定真写（缓存初值 nil），所以不存在「缓存说隐藏、实际可见」的错配。

### 计量口（可复测，不是只写在文档里的数字）
`GetRepaintStats()` 返回 7 个数，其中两个是 v1.11 新增：
- `ctrlWrites`：真正打到平台的属性写次数；
- `ctrlWritesSkipped`：因为「值没变」被跳过的次数。

复测方法：`ResetRepaintStats()` → 走一步 → 等动画跑完 → `GetRepaintStats()`。
`DumpRepaintStats(tag)` 会直接往日志打一条 `REPAINT[tag] slots=… writes=… skipped=…`。
开关是 `CONFIG.TRACK_CONTROL_WRITES`（默认 true）。

### A/B 实测（runtime=simulator，pc-16-9，e2→e4 一步，计量来自 `GetRepaintStats`）
| 版本 | 全量帧 | 局部帧 | paint_slot 总次数 |
|---|---|---|---|
| 旧（动画期全量重绘） | **10** | 0 | 10 × 32 = **320** |
| 新（只重绘脏槽位） | 2 | **8** | 2×32 + 8 = **72** |

→ 动画期控件写次数约降 **78%**；稳态每帧从 32 槽降到 **1 槽**（走子只动一枚）。
（2 个全量帧 = `apply_move` 里的 `render_all` + 动画结束收尾帧，是刻意保留的。）

### 时长对齐 Demo v3（proto/chess_demo.html ANIM 表第 895-900 行）
| 项 | v1.7 | v1.10 | Demo |
|---|---|---|---|
| `MOVE_DUR` | 0.24 | **0.17** | 0.17 |
| `SETTLE_DUR` | 0.14 | **0.10** | 0.10 |
| `SETTLE_PEAK` | 0.10 | **0.07** | 0.07 |

**只改数值不改曲线形状**（避免行为回归）。但有个必须处理的坑：

> **`SETTLE_NORM = 1.726429`** —— Lua 的回弹是 `1 + sin(v·π)·(1-v)·PEAK`，
> 而 `sin(v·π)·(1-v)` 在 [0,1] 上的**真实峰值只有 0.579230**（v≈0.3542）。
> 直接乘 `SETTLE_PEAK=0.07` 只能弹到 **4.05%**，不是 Demo 的 7%（等于「既变快又变平」，
> 两个变量一起动，没法判断好坏）。所以乘以 `1/0.579230` 把峰值归一到正好等于 `SETTLE_PEAK`。
> Demo 的 `settleShape = (outBack(t)-t)/0.630227` 是同一个做法。

### 为什么不改 `anim_update_hilites`
它是另一处每帧开销（选中格 1 + 落点 ≤28 = **≤29 个小控件**），但：
1. **量级差两个数量级**：高亮每帧写 ≤29 次，棋子每帧写 320 次（32 槽 × 约 10 图元 × 3~4 次）。
2. **只在有选中/落点时跑**：没选中时 `ANIM.hlBase` 为空，循环几乎空转。
3. **改它必须动「高亮脉冲相位」，风险高收益极低** —— 收益 <10%，却会碰到
   `ANIM.hlBase` 的相位错开逻辑（0.09s/个），容易做出「落点圆点同步跳」这类回归。
结论：**瓶颈在棋子重绘，不在高亮**，只改前者。

## 四之四、v1.10 音效（第 5.6 区 SFX）

### 为什么必须用 `game.PlayAudio2D`
本工程所有按钮都是「文本框 + 光标检测区」自绘的，**不是** `ClientUIPresetButtonControl`，
而 `clickAudioId` 字段只存在于 PresetButton（API 文档第 17 节）。所以没有现成的点击音，
一切音效都得自己播。

官方 API（`get_client_document` →「客户端控件API文档」第 6 节 (4)）：
```
game.PlayAudio2D(audioId: integer) -> integer   播放 2D 音效，返回实例 ID
game.StopAudio(audioInstanceId: integer)
game.IsAudioAlive(audioInstanceId: integer)
```

### 10 个音效 ID（已在模拟器实测播放成功）
| 键 | ID | 官方中文名 | 时长 |
|---|---|---|---|
| `CLICK` | 50888 | 按钮点击_轻_通用_03 | 0.495s |
| `SELECT` | 50894 | 按钮点击_轻_通用_09 | 0.215s |
| `MOVE` | 50942 | 切换_轻_选择_01 | 0.404s |
| `CASTLE` | 50879 | 按钮点击_重_通用_08 | 0.216s |
| `CAPTURE` | 40186 | 战斗_受击_命中_冷兵器受击_钝器_01 | 0.507s |
| `CHECK` | 50937 | 提示性UI_中_锁定 | 0.521s |
| `PROMOTE` | 50940 | 切换_轻_提升_01 | 0.120s |
| `GAME_END` | 50919 | 提示性UI_重_结束_01 | **6.003s** |
| `LOW_TIME` | 50931 | 提示性UI_轻_失败 | 0.285s |
| `RESIGN` | 50934 | 提示性UI_中_错误_02 | 0.422s |

权威副本两处，改一处必须两处同步：`docs/音效试听.html` 的 `SFX` 表、
`tools_work/make_sfx_preview.mjs` 的 `IDS` 数组。

### 触发点表（与 `proto/chess_demo.html` 的 `SFX.play(...)` 一一对应）
| 音效 | 函数 | 位置 | 说明 |
|---|---|---|---|
| `SELECT` | `select_square` | 结尾 `return true` 前 | 选中一枚自己的棋子 |
| `CASTLE` | `apply_move` | 音效段 | **易位只播这个，不播 MOVE** |
| `CAPTURE` | `apply_move` | 音效段 | 吃子优先于走子（同一手只响一声）|
| `MOVE` | `apply_move` | 音效段 | 普通走子 |
| `CHECK` | `apply_move` | 音效段 | 走完后对方被将军（`RULES.in_check`）|
| `GAME_END` | `show_result` | 函数开头 | **唯一入口**，`SFX.overFired` 防重复 |
| `RESIGN` | 确认弹窗 `hitYes` 的 resign 分支 | `show_result()` 之前 | 认输确认那一刻 |
| `PROMOTE` | 升变四选一 `hitYes` | `apply_move` 之前 | 升变确认 |
| `LOW_TIME` | `OnUpdate` 棋钟段 | 扣时后、判负前 | 首次跌破 `SFX_LOW_TIME_SEC`(30s)，双方各一次 |
| `CLICK` | `with_click` 包装 | `register_click` 外层 | 全部 UI 按钮自动带上 |

### 三个必须记住的坑
1. **`GAME_END` 只能有一个播放入口**。终局路径有 9 条（将死/逼和/五十步/三次重复/
   子力不足/认输/超时/和棋同意/联机收到对方认输）。逐条加音效必然漏。
   全部收拢到 `show_result` 开头 + `SFX.overFired` 标记。
   `new_game` 里必须把它复位，否则**新局的终局音永远不响**。
2. **`GAME_END` 长达 6.003s**。新开一局必须 `sfx_stop_all()`，否则上一局的结束音
   会压在新局开场上面。同理关音效开关时也要 stop，否则「关了还能听见拖尾」。
3. **`with_click` 不能用在棋盘格上**。棋盘格走子/选中已有专用音效，再叠个 click
   就是「两声」。Demo 的棋盘格也不播 click。音效开关按钮自己也不用 `with_click`
   ——它内部 `sfx_toggle` 会播一声确认音，外面再播一声会像「没关掉」。

### ⚠️ 第四个坑（真出过事故）：`sfx_play` 的参数是 **CONFIG.SFX 的键名**，不是 Demo 的函数名

`sfx_play` 的语义映射不是「照抄 Demo 的 `SFX.play("xxx")` 字面量」，而是
「查 `CONFIG.SFX` 里同名的键」。两边**有一处名字不同**：

| Demo 的调用 | Lua 的键 | 是否同名 |
|---|---|---|
| `SFX.play("click")` | `CLICK` | 大小写差异，`string.upper` 能兜住 |
| `SFX.play("select")` | `SELECT` | 同上 |
| …（其余 7 个同此） | … | 同上 |
| **`SFX.play("over")`** | **`GAME_END`** | **❌ 不同名，兜不住** |

事故经过：v1.10 曾用一个脚本把 10 个调用点机械地从 `sfx_play("GAME_END")` 批量改成
`sfx_play("over")`（为了贴合 Demo 字面量，好让脚本用同一条正则核对两边）。
结果 **终局音整整一版都是哑的**：`CONFIG.SFX["over"]` → nil → `string.upper("over")`
= `"OVER"` → 仍是 nil。而当时的代码是 `if id == nil or id == 0 then return nil end`，
**静默返回，不播、不报错、不写日志**。回归只测了 select/move，没测终局，所以漏了。

现在的两道防线：
1. **调用点用 `GAME_END`**（不是 `"over"`），`show_result` 里有注释说明原因。
2. **`id == nil` 与 `id == 0` 分开处理**。`0` = 明确关闭（合法，静默）；
   `nil` = 键名不存在（**是 bug**），用 `SFX.badKeyLogged` 去重后 `log_err` 一次：
   ```
   [Chess] 音效键名不存在：over（CONFIG.SFX 里没有这个键，该音效不会播放）
   ```
   **这条日志已在模拟器实测验证过**（故意把 sim 副本改回 `"over"` → 日志如期出现、
   `audio.recent` 里没有 50919；改回后 50919 正常出现且无日志）。

> 教训：**「配置为 0」和「键名写错」是两件事，绝不能合并成一个 `nil` 分支**。
> 合并的那一刻，所有拼写错误都会变成永久静默。

### 环形缓冲与降级
- 实例 ID 记 `CONFIG.SFX_HISTORY = 8` 条（环形覆盖）。同时最多响的是
  「结束音 + 少量交互音」，8 条足够；记太多无意义（早播完了），记太少停不干净。
- `sfx_play` 用 **pcall** 包住 `PlayAudio2D`：模拟器默认静音，且该 API 在某些环境
  可能不存在。失败只 `log_err` **一次**（`SFX.failLogged`），并置 `SFX.available = false`
  让后续调用直接短路 —— 否则每帧刷屏会把真日志淹掉。
- `sfx_stop_all` 里先 `IsAudioAlive` 再 `StopAudio`：对已播完的实例调 Stop 在部分实现
  里会抛错。整个 pcall 包住，并且函数本体的调用点也允许静默失败。

### 模拟器实测记录（runtime=simulator，pc-16-9）
| 操作 | 观测到的 `audio.active` | 判定 |
|---|---|---|
| 启动 | `[]` | 不动则无声 ✓ |
| 点 e2（选中） | `audioId:50894` SELECT | ✓ |
| 点 e4（走子） | `audioId:50942` MOVE | ✓ |
| 点「认输」（面板按钮） | `audioId:50888` CLICK | ✓ |
| 点「确定认输」 | `50888` CLICK + `50934` RESIGN + **`50919` GAME_END(6.003s)** 同时活跃 | ✓ |
| 点音效开关（开→关） | `active: []` 且按钮文案变「音效：关」 | ✓ 关闭确实静音 |
| 关音效时点棋盘 | `recent` 不变 | ✓ 静音生效 |
| 点音效开关（关→开） | `audioId:50894` SELECT | ✓ 确认音 |

**模拟器听不到 / 需真机验证的**：模拟器只记录 audioId 与时长，不保证出声。
`CASTLE` / `CAPTURE` / `CHECK` / `PROMOTE` / `LOW_TIME` 五个触发点本次**没有走到对应局面**
（要走易位/吃子/将军/升变/超时才触发），必须真机实际下一局验证。

## 五、坐标系（**最易错的地方**）- 千星 UI 画布：**原点左下、Y 向上**。
- 控件 `pivot=(0,0)` 时 `SetAnchoredPosition(x,y)` 的 x/y 是**左下角**位置；
  pivot 是 (0.5,0.5) 时才是中心。**本项目 `create_*` 统一用 pivot=(0,0)**，
  所以任何「中心定位」都要减半个宽高。
- 模拟器 `qxqy_studio_play` 的 `pointer` x/y 与 Lua 布局坐标**同一套**（左下原点、Y 向上），
  不是屏幕像素。1600×900 下：`x = 449 + (sq%8)*87.75 + 43.9`，`y = 99 + (sq//8)*87.75 + 43.9`。

## 六、层级（命中失效的头号原因）

同级后出现的节点在上。棋盘命中区在 `build_board` 里建，但棋子图元、面板、弹窗都是
**之后**创建的，会盖住命中区 → 点击全部失效。

**规则**：`build_all_ui` 末尾必须把所有「需要接收点击的命中区」统一
`SetAsLastSibling()` 提到最顶层：
64 个棋盘命中区 + 4 个面板命中区 + 5 个复盘命中区（`hitToggle` / `hitStart` / `hitPrev` / `hitNext` / `hitEnd`）。
弹窗自己的命中区由 `show_*` / `hide_*` 管理显隐，不参与这次提升。

## 七、联机信号契约（需用户在编辑器搭节点图）

```
客户端 → 服务端：ChessSync(Int a, Int b, Int c, Int d, String fen)
服务端 → 客户端：同名 ChessSync 原样广播给房间内所有人
```
eventType（参数 a）：

| 值 | 含义 | 参数 |
|---|---|---|
| 0 EV_MOVE | 走子 | b=起点格, c=终点格, d=升变(0/1Q/2R/3B/4N) |
| 1 EV_NEWGAME | 新开一局 | b=发起方 |
| 2 EV_RESIGN | 认输 | b=认输方 |
| 3 EV_DRAW_REQ | 求和 | b=请求方 |
| 4 EV_DRAW_ACC | 同意和棋 | b=同意方 |
| 5 EV_JOIN | 请求加入 | — |
| 6 EV_ROLE | 身份分配（服务端回发） | b=0白/1黑 |
| 7 EV_DRAW_NO | 拒绝和棋 | b=拒绝方 |

服务端节点图只做「收到即广播」，不校验、不存数据、不排序。
没有节点图时自动降级为本地同屏。

### 回声处理（**必读**，模拟器实测踩过）

官方节点图是「收到即广播给房间内所有人」，**包括发送者自己**。所以任何请求-应答类
信号都要能区分「这是对方发的」和「这是我自己的回声」：

| 信号 | 回声处理 |
|---|---|
| EV_MOVE | `net_send_move` 记 `GAME.lastSentMove={from,to,promo}`；收到时三项精确匹配则丢弃 |
| EV_DRAW_REQ | 发送前置 `GAME.drawReqSent = true`；收到时若该标记为真则只清标记、不弹框 |
| EV_DRAW_ACC | 用 `GAME.over` 挡住重复结算（同意方本地已结算过） |
| EV_RESIGN / EV_NEWGAME | 幂等，重复执行结果相同 |

> **不处理 EV_MOVE 回声的后果**（v1.4 实测踩到 D-05）：本地已走完，起点格已空，
> 再按「对方走子」重算必然找不到合法走法 → 日志报「收到无法验证的走子信号」。
> 棋盘不会走两次（校验会失败），但日志被污染，且双人时多一次无谓失败。

新增信号时先问：**这条广播回到我自己身上会怎样**。不要在「收到就处理」的分支里省这一步。

### 模拟器工程结构（复跑用）

```
服务端「客户端控件容器」
└── 容器节点 1073742100  ← Lua 脚本挂在这里（脚本映射 1073742109, sim/levelScript.lua）
客户端控件模板（5 个）
├── 1073742106 棋盘文本框模板   → PREFAB_TEXT_BOX
├── 1073742107 棋盘光标模板     → PREFAB_CURSOR_AREA
├── 1073742108 棋子图片模板     → PREFAB_IMAGE
├── 1073742105 文本框模板       （占位，Lua 不用）
└── 1073742100 Lua实例化面板    （占位，Lua 不用）

拟合棋子数据脚本映射（**只注册映射、不挂载**，供 require 使用）
├── 1073742110 sim/piece_PW.lua   ├── 1073742111 sim/piece_PB.lua
├── 1073742112 sim/piece_BW.lua   ├── 1073742113 sim/piece_BB.lua
├── 1073742114 sim/piece_NW.lua   ├── 1073742115 sim/piece_NB.lua
├── 1073742116 sim/piece_RW.lua   ├── 1073742117 sim/piece_RB.lua
├── 1073742118 sim/piece_QW.lua   ├── 1073742119 sim/piece_QB.lua
└── 1073742120 sim/piece_KW.lua   └── 1073742121 sim/piece_KB.lua
```

> **挂载点必须是服务端容器下的「容器节点」**。挂到客户端控件模板上时脚本不会运行
> （模板没被实例化就没有生命周期），试玩只会看到模板自带示例控件。

> **`require` 只能加载已建立脚本映射的文件**。12 份 `piece_*.lua` 少建一个映射，
> 对应棋子就画不出来（`load_piece_fit` 会 `log_err` 出具体路径）。
> 实测 `require("sim/piece_PW")` 与 `require("default_import_file/sim/piece_PW")` 都可用；
> 裸名 `require("piece_PW")` 不可用。

## 八、已知平台差异与风险

| 项 | 状态 |
|---|---|
| `raycastTarget` | **必须设**。未实现该字段的环境会抛 `no such field`，所以赋值包 `pcall`；沙箱不支持、模拟器与真机支持 |
| `Enum.CursorEventType` | 真机叫 `CursorClick`，沙箱叫 `Click`，代码用 `CursorClick or Click` 兼容 |
| `imageType` | 模拟器不可赋值，包 `pcall`；真机为 Stretch/Basic |
| `SetImage(src, asset)` | 图元用 `StaticReference` + `100001/100002/100003` |
| 图片素材 | 千星不支持上传自定义图，棋子只能用图元拼（无备选样式） |
| 拟合数据底纸 | 填充模式把「白底纸」也拟进 `ELEMENTS`，必须按暗色元素定范围后剔除，否则每枚带白方块（见第三节三条换算） |
| 拟合越界块 | 拟合器会把「超出画布被裁掉的部分」当成免费得分，输出越界图元；游戏里图元不被父级裁切，必须先丢弃 |
| 沙箱 vs 真机 | 沙箱无命中测试，**交互缺陷一律测不出**。模拟器/真机才算交互证据 |
| 文本框容量 | 可用高 ≈ 控件高 − 0.9×字号；行高 ≈ 1.2×字号。字号 44 至少要 72px 高，否则**整行不显示**（模拟器实测 D-02） |
| 服务端广播回声 | 节点图「收到即广播」会把发送者算进去，请求-应答类信号必须自带回声过滤（见第七节） |

## 九、模拟器试玩坐标速查（1600×900）

`qxqy_studio_play` 的 `pointer` x/y 是**画布坐标、原点左下、Y 向上**，与 Lua 布局同一套。
格宽 87.75、棋盘左下 (449, 99)：

```
格号 sq -> 像素: x = 449 + (sq % 8) * 87.75 + 43.9
                 y =  99 + (sq // 8) * 87.75 + 43.9
例：e2 = sq 12 -> (800, 230)；e4 = sq 28 -> (800, 406)
```

面板按钮中心：新开(1337,322)、认输(1513,322)、求和(1337,233)、同屏(1513,233)。
第三行常驻键「看历史/退出复盘」(1424,171)。
复盘四键：开局(1340,296)、上一步(1516,296)、下一步(1340,232)、终局(1516,232)。
结算「再来一局」(800,361)、「复盘」(942,361)（v1.6 起结算面板两键，y=361 而非 341）。
确认框「确定/同意」左键 (638,379)、「取消/拒绝」右键 (962,379)。

**手机 1280×720 速查**（格宽 70.2、棋盘左下 (280.8, 61.2)）：

```
格号 sq -> 像素: x = 280.8 + (sq % 8) * 70.2 + 35.1
                 y =  61.2 + (sq // 8) * 70.2 + 35.1
例：e2 = sq 12 -> (640, 184)；e4 = sq 28 -> (640, 325)
第三行常驻键 -> (1160, 137)；复盘四键 y = 236 / 171，x = 1075 / 1209
```

