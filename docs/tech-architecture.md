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

## 一之二、四份脚本副本与「更新脚本」纪律（**运维必读**）

同一个脚本在工作区里有 **4 份物理副本**，用途各不相同：

| 路径 | 行数 | 模板索引 | 谁改它 | 用途 |
|---|---|---|---|---|
| `lua/levelScript.lua` | 9858 | 全 `0` | **只手工改这一份** | 母本 |
| `out/交付包/levelScript.lua` | 9858 | 全 `0` | 由 `sync_delivery.cjs` 生成 | **交给用户的那份** |
| `sim/levelScript.lua` | 9861 | 真实编号 | 由 `sync_sim_copy.cjs` 生成 | 模拟器调试 |
| `workspace/chess/chess.save.json` 的 `source` 字段 | — | 真实编号 | 由 `tools_work/issue1/_inline.cjs` 内联 | **模拟器实际读取的** |

**校验过的恒等关系（2026-11-08）**：
- `lua/` 与 `out/交付包/` **逐字节相同**（6 个结构标记行号一致，结尾同为 9858 行）
- `sim/` 与它们**只差 3 行**（模板索引处的注释）**+ 4 个索引值**，结构一一对应
- 存档 `source` 与 `sim/` 同步

> **模拟器读的是 `chess.save.json` 里的内联源，不是 `sim/levelScript.lua`。**
> 只改 `sim/` 而不重新 `_inline`，模拟器跑的仍是旧代码 —— 且**日志看起来完全正常**。

### ⚠️ 用户侧更新脚本的陷阱（已写进交付文档）

交付版的第 **37~40 行** 是 4 个模板索引，值全为 `0`（等用户填）。
用户**整份覆盖**新版时，这 4 行会被冲回 `0` → 脚本停机并打印「界面零件还没配好」。

**这看起来像「新版本坏了」，实际是用户的编号被冲掉了。**
交付侧的正确指引见 `out/交付包/挂载指南.md` §「以后要更新脚本怎么办」与
`导入方案.md` §6.4：要么只贴改动（跳过 37~40 行），要么覆盖后立刻把编号填回。

**验证「新代码真的生效」不能只看「没报错」** ——
脚本没重新加载时日志和上一版一模一样，同样"没报错"。
判据必须是**新版本特征**：`界面=` / `档位=` 字段、`[自检]` 行。

### 手工改代码时必须做的四步

```bash
# 1) 改 lua/levelScript.lua（唯一母本）
# 2) 同步三份派生副本
node tools_work/issue1/sync_sim_copy.cjs      # → sim/
node tools_work/issue1/sync_delivery.cjs      # → out/交付包/
node tools_work/issue1/_inline.cjs            # → save.json 内联源
# 3) 校验内联结果
node tools_work/issue1/_verify_inline.cjs
# 4) 重算交付清单（md5/行数），否则 docs/v2-delivery-manifest.md 会过期
node tools_work/issue1/_gen_delivery_manifest.cjs
```

> **2026-11-08 的教训**：当时协作代理不可用，Lead 直接用文件工具改了
> `lua/` / `sim/` / `out/交付包/` / `save.json` **四处**（跳过脚本），
> 改完靠 grep 逐处核对行号一致才敢测。
> **这种做法只在「无法运行脚本」时才可接受，且必须补做上面第 3、4 步。**

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

### ⚠️ 字号缩放必须同时看宽高（4:3 画布截断 bug）

**症状**：手机 4:3（1280×960）下，面板按钮「切换本地同屏」被截成「切换本地」，
两个棋钟也挤在一起。

**根因**：`fontScale` 只按 `canvasH / 900` 算，但**面板宽度是按 `canvasW` 的比例算的**：

| 画布 | canvasH/900 | 面板宽 / 基准宽 | 结果 |
|---|---|---|---|
| pc-16-9 1600×900 | 1.000 | 1.000 | 正常 |
| mobile-16-9 1280×720 | 0.800 | 0.800 | 正常 |
| **mobile-4-3 1280×960** | **1.067**（放大） | **0.800**（缩小） | **相对溢出 1.33 倍 → 裁切** |

4:3 画布「更高但更窄」，字号跟着变高变大，容器却跟着变窄变小 —— 两头反向。

**修法**：`fontScale = min(canvasW / BASE_CANVAS_W, canvasH / BASE_CANVAS_H)`，
即取两个方向的**较小者**，保证文字永远不会比它所在的容器长得快。

**为什么选 `min` 而不是别的公式**：它让已实测过的四档画布数值**逐位不变**
（1600×900、2100×900、1280×720、1560×720 都是宽高同比或宽度更紧），
只有原本就出错的 4:3 从 1.067 修正为 0.800。换任何别的公式都会牵动已验证的档位。

Demo 侧是同一处同一个式子（`const fontScale = Math.min(canvasW / BASE_W, canvasH / BASE_H)`）。

> **这条 bug 靠人眼验会一直漏**：它在 1600×900 和 1280×720 上完全看不出来，
> 只有 4:3 这种「更高但更窄」的画布才暴露。所以已加 **CHECK-8** 门禁：
> 断言 `fontScale` 表达式里同时出现 `canvasW` 与 `canvasH` 且用了 `math.min`，
> 并把五档画布的 `fontScale` 新旧值打进输出（哪一档被修正一眼可见）。

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

## 四之五、v2.0 新增模块（初始界面 / 走时档 / 待机室 / 悔棋 / 复盘）

### 初始界面的纵向排布（v3.1 重排过一次，改文案前必读）

`CONFIG.START_LAYOUT`（比例，相对画布高，原点左下）：

| 段 | y..y+h | 内容 | 字号 / 板高（pc-16-9） |
|---|---|---|---|
| TITLE | 0.830..0.965 | 主标题「国际象棋」 | 64 / 121.5px（**2.1 规则的唯一例外**，实测通过） |
| TAGLINE | 0.770..0.822 | 标语「将杀即为终点」（静态） | 20 / 46.8px（手机 16 / 37.4px，按较小者反算） |
| SUBTITLE | 0.705..0.761 | **动态**状态行（你选了/对手选了/双方不同） | 22 / 50.4px |
| TC_HINT | 0.655..0.703 | 规则与 5 秒倒计时 | 18 / 43.2px |

- v3.1 的变化：标题改名 + 新增 TAGLINE；**底部版本号控件已删除**，只剩居中的「点一个入口开始」
  （`START_VERSION` 常量保留、不再渲染，仅为保持 consistency_check 的共同键口径）。
- 「你的选择」与「标语」是**两个控件**：把标语塞进 SUBTITLE 会让它一选档位就消失。
- 改这里的任何字号/板高，**两档画布都要算**（pc 900 高 / mobile 720 高 + 字号 ×0.8）：
  0.048 的标语条在 pc 上够、在手机上会被整行吞掉，就是这次踩到的实例。

### 屏幕状态机：`GAME.screen`

| 值 | 屏 | 进入函数 |
|---|---|---|
| `"start"` | 初始界面（默认） | `show_start_screen()` |
| `"lobby"` | 联机待机室 | `show_lobby()` |
| `"playing"` | 对局 | `entry_start_local` / `start_game_from_lobby` / `new_game` |
| `"review"` | 复盘研习（从菜单进） | `entry_start_review` → `enter_review(true)` |

### ⚠️ 覆盖层收敛：`hide_all_overlays()`（**两次 P0 换来的纪律**）

每个 `show_XXX_screen` / 进对局的入口，**必须先调 `hide_all_overlays()` 再显示自己**。
这个函数**无条件**收掉：待机室整层。
（v3.3 之前还要收「复盘动作条」，动作条已随分支试走移除，见下文。）

| 事故 | 现象 | 根因 |
|---|---|---|
| 块 3 | 进对局后画面被「待机室空白骨架」盖住，只有「返回主菜单」有字 | `entry_start_local` / `entry_start_review` / `back_to_main_menu` 都**没调 `hide_lobby()`** |
| 块 5 | 初始界面 / 待机室底部露出「退回主变」「从此开新局」，还压住提示文字 | 动作条显隐只在复盘路径里管，其它路径没人收 |

> **为什么不写成「各入口自己记得 hide_lobby」**：正是「各自记得」这件事导致了两次 P0。
> 现在只改 `hide_all_overlays()` 一处。**新增覆盖层必须加进它。**
> v3.3 起自检 `overlays_hidden_on_screen_switch` 改测**待机室**（原被测对象动作条已删除），
> 守的仍是同一条纪律：无条件收起，与当前界面状态无关。

### 悔棋（成对撤回）

| 项 | 值 / 位置 |
|---|---|
| 每方次数 | `CONFIG.UNDO_PER_SIDE = 3` |
| 成对步数 | `CONFIG.PAIRED_UNDO_PLIES = 2`（双方各退一步，所以**至少要走 2 步**才能悔） |
| 联机超时 | `CONFIG.UNDO_REQUEST_TIMEOUT_SEC = 15` |
| 次数扣减 | **只在真正执行撤回时**（`undo_consume`）。请求被拒 / 超时 / 掉线一律不扣 |
| 联机执行时机 | **必须由 `EV_UNDO_ACC` 驱动两端同时撤**。**发起方不能在点确认时就本地先撤** —— 否则对方拒绝时一端撤了一端没撤，局面分叉 |
| 响应方扣次数吗 | **不扣**（gdd §7.2：发起方 −1，对方不变） |

**十项状态回退**（少一项就会出现「撤回了但某个显示还是旧的」）：
①`GAME.st` ②`st.history` ③棋钟 ④`moveLog` ⑤失子 ⑥`GAME.history` ⑦`lastFrom`
⑧`lastSentMove` ⑨高亮 ⑩`elapsedSec`

> **②`st.history` 最阴险**：`RULES.parse_fen` 重建局面时会把 `st.history`（position_key 序列）**清空且不恢复**。
> 漏了它的后果是「悔棋之后这一局再也判不出三次重复」—— **不报错、不崩、日志干净、截图正常，功能静默消失**。

### 复盘：只看不点（v3.3，分支试走已整体移除）

**v3.3 删除了 v2.0 的分支试走。** 用户要求删掉「退回主变」按钮，而它是分支试走的**唯一出口**：
`review_goto` 翻页时并不清 `reviewBranch`，`view_board()` 又优先读分支局面 ——
只删按钮会留下死角（点棋子进试走 → 翻页 → 棋盘停在旧试走局面 → 无法退出）。
所以试走必须连带移除。

现在的三层被压成一层：

```
view_board() / view_state()：reviewState > GAME.st
on_square_clicked：GAME.review ~= nil → 直接 return（第二道闸）
set_board_input(false)：复盘态命中区不响应（第一道闸）
```

**两道闸冗余是故意的**：`set_board_input(false)` 让命中区不响应，但若将来有人把它改回 true，
`on_square_clicked` 里那道 `return` 会兜住 —— 否则「复盘点棋子真的走棋」是灾难级 bug。
自检 `review_is_readonly` 就守这条。

| 键 | 位置 | 何时可见 |
|---|---|---|
| 退出复盘 / 返回主菜单 | 面板第三行左/右 | 复盘态 |
| 悔棋 / 退出复盘 | 面板第三行**左半格互斥复用** | 对局中=悔棋，复盘态=退出复盘 |
| 看历史 | 面板第三行左半 | **仅结算面板路径**（对局中不再显示，让位给悔棋） |

> **已删除**（不留空实现，避免「看不见但还能点」与自检虚高）：
> `branch_ensure` / `branch_back` / `branch_move` / `refresh_branch_visuals` /
> `branch_hint_text` / `branch_find_move` / `build_review_actionbar` / `refresh_review_actionbar`、
> `UI.review.actionBar` 整层、`GAME.reviewBranch` 字段、
> `CONFIG.COLOR.BRANCH_*`、`CONFIG.TEXT.BTN_BRANCH_* / CONFIRM_BRANCH_* / BRANCH_*`、
> 确认框 `branchNew`、两个点击绑定。**净省 6 个控件。**

### `enter_review(allowEmpty, ...)` 与 `fromMenu`

`allowEmpty=true` = 「允许一步未走的局面进复盘」（用于入口 2 复盘研习、结算面板的复盘）。
**但它不能用来判断「是不是从菜单进来的」** —— 结算面板的复盘也传 true，复用会让
「从结算进复盘 → 退出」错误地跳回初始界面、丢掉结算面板。

**现在用独立字段 `GAME.review.fromMenu`**，只在 `entry_start_review` 里置 `true`；
`exit_review` 据此决定回菜单还是回结算面板/棋盘。

### 自检（`SelfTest`）

- **在 `OnStart` 末尾用 `pcall(SelfTest)` 调用**，只打一条汇总：`[自检] N/M 通过`，
  失败时最多列 12 条明细。
- **30 条断言，分三类**：规则（perft）/ 结构（控件数、文案装得下、非空）/ 行为（状态机、信号、零副作用）。
- ⚠️ **v2.0 之前的「自检全绿」是假的**：`SelfTest` 定义了但**全项目 0 处调用**。
  接入后立刻抓到 3 个缺陷（全是断言自身的错，见 `records/playtest-v2.md`）。

**自检必须零副作用（五条纪律，来自真实事故）**：
1. 不发网络包 → `GAME.inSelfTest` 拦 `net_send_event`
2. 不启动对局 → 拦 `start_game_from_lobby`
3. 不改玩家可见状态 → 临时改动必须完整备份并还原
4. 凡验「某函数会做什么」，验它的**返回值/内部标记**，不要真的执行它
5. **断言不得假设自己运行在哪个屏** —— 写「状态不许变成 X」，不写「状态必须等于 Y」

> 事故：自检里直接调 `net_send_event` → `playerCount=2` 时**一次启动冒出 4 条真实广播包**。
> 推演后果：一端时序稍慢，另一方还没进待机室就收到 `EV_START` → **对局在开始前就被「开局」了**。

### 双人同屏 = 零网络

```lua
function net_send_event(...)
  if GAME.inSelfTest then return false end
  if GAME.localMode then return false end   -- ← 同屏不发任何包
  if not NET.canSend then return false end
```

`GAME.localMode` **专指「双人同屏」**（同一台设备轮流操作双方），不是「含单人的本地模式」。
置 true 的四处：`entry_start_local` / `entry_start_review` / 待机室「直接开始」兜底 / 面板「切换本地同屏」。
置 false 一处：`entry_start_online`。

**为什么不发**：① 省带宽 ② **玩家单机时若恰在多人房间，会把「和棋/认输」广播出去干扰别人**
③ 违反「同屏 = 纯本地」语义。实测同屏全程 `outbound: []`。

### 同屏 vs 联机：文案必须分流

**同屏没有「对方」这个实体**（同一人操作双方）。凡含「对方/对手」的文案都要分支：

| 位置 | 同屏 | 联机 |
|---|---|---|
| 求和确认框 | `和棋？确认后本局判和` | `对方想和棋，同意吗` |
| 求和结算标题 | `双方同意和棋，本局和棋` | `对方同意和棋，本局和棋` |

机制：`CONFIRM_SPEC.localText` 字段 + `draw_result_text()` 函数。
**用表字段而不是 `if kind=="draw"`** —— 新增 kind 时一眼能看出哪些支持分流。

**只在联机路径出现的 7 条不需要分支**（待机室专属 `LOBBY_*`；`UNDO_REJECTED`/`UNDO_TIMEOUT`/
`UNDO_WAITING_PEER` 只在 `pendingUndo ~= nil` 时用，而同屏永不设 `pendingUndo`；`RESULT_OPP_LEFT` 只由联机弃局发）。

## 四之六、v3.2 新增/改写模块（悔棋语义反转 / 删同屏 / 结算记账 / 吃子图元 / 换色）

本节是 v3.2 的结构变更台账。**改这五块之前先读完本节**，每一条都对应一次真实的踩坑。

### 1. 悔棋：从「成对撤 2 步」改为「只撤自己刚走的 1 步」

| 项 | v2.0 | v3.2 |
|---|---|---|
| 撤回步数 | `PAIRED_UNDO_PLIES = 2` | `UNDO_PLIES = 1` |
| 允许时机 | **轮到我自己**时（`C-4` 要求 myTurn） | **轮到对方**时（语义反转，`C-4` 要求 not myTurn） |
| 发起方判定 | `undo_actor_side` 返回轮走方 | 返回**最后一步的走子方**（按轮次反推） |
| 棋钟 | 双方都退回快照值 | **只返还对方**，发起方照扣（`UNDO_REFUND_PEER_CLOCK`） |
| 撤完轮到谁 | 轮走方不变（n 与 n−2 同奇偶） | 轮到对方 —— 与被撤那手之前完全一致 |

**为什么必须反转 C-4**：悔棋的动机是「我这一步走错了」。而「我这一步」只有在对方还没应手时才收得回来；
一旦对方走完，再撤就等于把对方**已经走出并确认**的棋也退掉 —— 那是另一回事。
所以「轮到自己时不允许悔棋」不是限制，是这条规则的定义本身。

**棋钟为什么只返还对方**：撤回后立刻轮到对方走，若他的钟停在「被我拖延后的读数」，
对方凭空少一段时间，等于替我的反悔买单。源码注释写死了这条推导。

### 2. 删除同屏模式（三处必须同时删干净）

| 位置 | 删了什么 |
|---|---|
| `CONFIG.PANEL_LAYOUT` / `build_panel` | `btnLocal` 按钮 + `btnLocalEdge` 描边 + `hitLocal` 命中区 |
| `register_all_input` | `hitLocal` 的 `register_click`（**不要留空实现**，`hitLocal` 为 nil 会崩） |
| `build_start_screen` | 「单人·双人同屏」入口 `st.entryLocal` |
| `PROTO/chess_demo.html` | `btnSpecs` 里的 `btnLocal` + **锚点注释那一行**（见第八节风险表） |

**`GAME.localMode` 仍然保留** —— 它现在的语义是「本局有没有真人对手」（无对手 = 单人演练/复盘），
不再等同于「同屏模式」。求和标题、悔棋是否走网络、吃子标签用「你」还是颜色名，都还依赖它。
**不要因为「同屏没了」就删这个字段。**

`entry_start_local()` 函数体保留但**不可达**（不新增 local，也不删，因为自检与文档引用它）。

### 3. 结算记账：积分 + 上一局存档

```
show_result()                    ← 所有终局路径的唯一汇合点
  └─ if not GAME.settled then    ← 幂等闸（退出复盘会再弹一次结算）
       GAME.settled = true
       settle_match_record()
         ├─ 判定赢家（按 resultText 反查）
         ├─ 积分 += 2 半分（胜）/ 1 半分（和）  → GAME.scoreHalf
         └─ 深拷贝 GAME.history → GAME.lastArchived
```

- **积分存 `GAME.scoreHalf`（半分整数）**，显示时 `/2`：`0.5` 在二进制里精确，但反复乘除容易出错，
  存整数最稳。`score_text()` 负责渲染。
- **存档必须深拷贝**：若写成 `GAME.lastArchived = GAME.history`（引用），
  下一局 `new_game()` 一清空 history，存档就跟着空 —— 「刚打完一局，点复盘却是空的」，且不报错。
  自检 `result_archive_deepcopy` 就是守这条。
- **能力边界**：客户端 Lua 无 `io.*`、不能写全局自定义变量 → **积分只能本会话累计**；
  跨会话需服务端变量（见 `out/交付包/跨会话存档方案.md`）。

### 4. 结算协同：EV_RESULT + 换色

```
我点「再来一局」→ result_make_choice("again")
  ├─ 无对手（localMode 或 !peer_online）→ 立刻 result_apply
  └─ 有对手 → 发 EV_RESULT(a=1,b=身份,c=token)
       ├─ 对方已先选同项 → 立刻 result_apply
       └─ 否则进等待态，写 UI.result.wait
对方包到达 → net_on_signal EV_RESULT → 回声过滤(比 token) → result_on_peer_choice(choice)
  ├─ 我没选 → 只显示「对方想再来一局/想复盘」
  ├─ 同项   → result_apply
  └─ 不同项 → 提示「两人选的不一样，改一个再试」（不擅自执行任一边）
result_apply("again") → GAME.match.swap_sides() → new_game()
result_apply("review") → enter_review(true)      ← 复盘**不换色**（要跟打这局时视角一致）
```

**换色 `GAME.match.swap_sides()`**：只翻转本端 `GAME.mySide` 并同步 `set_flip` + `reposition`。
两端各自翻 = 整体对调，天然保持互补，不需要协商。自检 `result_side_swap` 验它是**自反对合**
（调两次回原状）且视角跟着翻。

**token 为什么必须掺身份位**：若只用「秒数+序号」，两人同一秒各点一次会算出**相同 token**，
于是双向都把对方包当自己的回声丢掉 → 双方永远在等。用户要的恰恰是「同时选择」，
这是主场景不是边界。所以 token 里掺 `mySide` 身份位（两端恒互斥），单这一位就排除撞车。

### 5. 吃子成就区（棋子图案两行）

```
PANEL_LAYOUT.CAP_AREA = { y=0.360, h=0.218 }   ← 原 MOVE_LOG 的整块位置
  ├─ 第 1 行标签「你吃掉的：」   + 16 个小棋子槽位（上排）
  └─ 第 2 行标签「你被吃的：」   + 16 个小棋子槽位（下排）
```

- **复用 `paint_slot`**：给它加了 `opts = { box, holeBg, centerX, centerY }`，
  这样同一套图元绘制逻辑既能画棋盘上的大棋子，也能画面板里的小图标 —— 不必写第二套。
  `holeBg` 传 `PANEL_INNER`：小图标不落在棋格上，镂空处没有棋格色可借。
- **行序由视角决定**：我执白 → 第 1 行 `capturedBlack`（黑子被吃）；执黑则相反。
  `GAME.localMode` 时按白方视角，标签换成颜色名（没有「你/对手」）。
- **控件预算**：2 方 × 16 槽 × 最多 34 图元 ≈ 1088 个图片控件，一次性建好的固定池，
  播放期零创建（与棋子槽位池同思路，符合 release 21 硬约束）。
- **`CAP_WHITE` / `CAP_BLACK` 两个布局键必须保留**（consistency_check 取键并集比对），
  但已不用于布局。删掉会让门禁报缺项。

### 6. 联机/无联机的入口与按钮门控（单一判据）

```
net_peer_online()                     ← 全局唯一判据（GAME.match.peer_fresh 的封装）
  ├─ show_panel_buttons: 有对手时隐藏「新开一局」「返回主菜单」（含各自描边层）
  ├─ refresh_start_hint: 有对手时隐藏「单人·复盘研习」入口（btn/edge/hit 三件套一起）
  └─ result_make_choice: 无对手时结算选择立刻执行，不等谁
```

**为什么新开一局/返回主菜单在联机时必须禁**：单方面新开会让两端局面直接分叉；
返回主菜单等于对局中离场，对方会突然失去对手。这比「点了没反应」严重得多。

**显隐必须三件套一起**（可见控件 + 描边 + 命中区）：漏描边 → 「按钮没了但上沿还在」；
漏命中区 → 「看不见但还能点」。v2.0 踩过完全同类的残影事故。

## 五、坐标系（**最易错的地方**）- 千星 UI 画布：**原点左下、Y 向上**。
- 控件 `pivot=(0,0)` 时 `SetAnchoredPosition(x,y)` 的 x/y 是**左下角**位置；
  pivot 是 (0.5,0.5) 时才是中心。**本项目 `create_*` 统一用 pivot=(0,0)**，
  所以任何「中心定位」都要减半个宽高。
- 模拟器 `qxqy_studio_play` 的 `pointer` x/y 与 Lua 布局坐标**同一套**（左下原点、Y 向上），
  不是屏幕像素。1600×900 下：`x = 449 + (sq%8)*87.75 + 43.9`，`y = 99 + (sq//8)*87.75 + 43.9`。

### 五之一、**不要靠截图量坐标，也不要复用另一个弹窗的坐标**（v2.0 血泪四条）

| 次数 | 错法 | 后果 |
|---|---|---|
| 1 | 从**截图**上量 y（截图原点左上、Y 向下） | 判「确认框取消按钮点不动」，实际是点在框外 112px。**代码一直是对的** |
| 2 | 同上，`522 = 900 − 378` | 待机室「直接开始」点了没反应 |
| 3 | 同上，`729.9 = 900 − 170.1` | 同上 |
| 4 | **复用「确认框」按钮的 y 去点「结算框」的按钮** | 误判「结算面板整块不可点 = 代码 bug」，多花一整轮 |

**正确做法（唯一）**：
```
qxqy_studio_play get {inspect:true}
  → 在 tree 里按控件 name 找到它（如 hitresultreview）
  → 读 box{left, bottom, width, height}
  → 中心 = (left + width/2, bottom + height/2)
```
**判据：点在 box 内仍无回调，才是真 bug。**

**为什么第 4 次特别隐蔽**：确认框与结算框都出现在屏幕中央，视觉上「按钮差不多在那儿」，
但**它们是两个不同的 overlay，按钮 y 不同**（确认框 `y=379` / 结算框 `y=338`）。
`x` 也可能不同（结算框两个键是 `659.2` / `940.8`，不是 50% 分栏）。

> 可用工具：`node tools_work/issue1/_coords.cjs [start|lobby|panel|reviewbar|board|all]`
> 直接从 `CONFIG` 布局表算出千星坐标，不经过截图。

### 五之二、pivot 与父级：两条容易一起踩的坑（v1.12）

**① 同一份 `LAYOUT.square_pos` 喂两类 pivot，调用点必须各自补/不补半格。**
`LAYOUT.square_pos` 返回的是棋格**左下角**：
- 文本框（pivot=0）：直接传，正好对上；
- 图片控件（pivot=0.5，棋子图元与落点圆点）：**必须 + cell/2 才是格中心**。

issue #1 第 1 条（绿点偏左下 ~30px）和 issue #3（残留绿点）都是这个结构长出来的。
新增任何高亮/图元控件时，先问一句「这个控件的 pivot 是多少」。

**② 落点高亮池必须「先清空、再绘制」。**
`UI.legalHL[1..28]` 是按索引复用的固定池。只把本次用到的前 n 个 `SetActive(true)`
而不关闭上一次的，就会让**上一次多出来的绿点留在盘上**（issue #3 的根因）。
现在统一走 `hide_legal_pool()`，`clear_highlights()` 与 `select_square()` 共用。

**③ 父级与坐标域（模拟器已证、真机未证）。**
API 文档 §13(3) L738 说「有父级时 `SetAnchoredPosition` 是相对父级中心的偏移」，
但本项目所有控件挂在容器节点下、坐标按画布左下写，**模拟器实测读回值与画布坐标一致**
（`sq_8` 写 449/186.75，读回 449/186.75）。详见 `docs/锚定配置表.md` §一末的实测表与
`docs/api-audit.md` E-02。**真机首测必验**：任取一控件读回 `GetAnchoredPosition()` 比对。

### 五之三、光标事件的两个前置条件（缺任一个，点击全废）

| 条件 | 文档依据 | 本项目落地位置 |
|---|---|---|
| 控件 `raycastTarget = true` | §18(1) L908 / §17(1) L886 | `create_cursor_area` / 按钮创建处 |
| **容器节点 `showCursor = true`** | **§24(1) L1031「CursorEvent 相关方法都需设置该参数为真后才可正常使用」** | `build_all_ui` 的 `enable_show_cursor()`（v1.12 新增），对 `script.object` 与 `GetClientUIRoots()[1]` 各设一次 |

> **`showCursor` 这条差点漏到真机**：体外沙箱没实现该字段，模拟器点击照常可用，
> 所以模拟器全绿完全证明不了真机可用。`docs/沙箱能力清单.md` §四.4 早写了「用 `~= nil` 探测」
> 的对策，但从未落地进代码 —— **写进知识库不等于写进代码**。

## 六、层级（命中失效的头号原因）

同级后出现的节点在上。棋盘命中区在 `build_board` 里建，但棋子图元、面板、弹窗都是
**之后**创建的，会盖住命中区 → 点击全部失效。

**规则**：`build_all_ui` 末尾必须把所有「需要接收点击的命中区」统一
`SetAsLastSibling()` 提到最顶层：
64 个棋盘命中区 + 4 个面板命中区 + 5 个复盘命中区（`hitToggle` / `hitStart` / `hitPrev` / `hitNext` / `hitEnd`）。

### ⚠️ 六之二、全屏命中区必须**最先**抬起（v2.0 实测的 P0）

结算面板有一个 `hitOverlay`：`create_cursor_area{x=0, y=0, w=canvasW, h=canvasH}` ——
**1600×900 全屏**，作用是「吃掉面板以外的点击」。

它的抬起顺序不能和普通按钮混在一起：

```lua
-- ✗ 错：全屏区最后抬起 → 它盖住两个按钮 → 整块面板不可点
{ hitAgain, hitReview, hitOverlay }

-- ✓ 对：全屏区最先抬起（压在最底），按钮后抬起盖住它
{ hitOverlay, hitAgain, hitReview }
```

**这个 bug 的可怕之处**：控件树里 `hitAgain` / `hitReview` / `hitOverlay` **三个都是 `active=true`**，
`get inspect:true` 看不出任何异常；点下去**没有回调、没有点击音效**，也不报错。
只有「按控件名查 box、确认点在框内、发现仍无回调」才能定位。

> **两处都必须改**：`show_result` 里的 `raise_modal_hits()`，以及 `build_all_ui` 末尾的 `raise_hit` 序列。
> 只改一处会在另一条路径上复发。

### ⚠️ 六之三、读音频日志要认 id，不能只听「有没有声音」

实测时我曾把 `50919`（**结算出现音**）当成「点击命中了」，于是误判「命中区没问题，是回调的 bug」，
白白多花一轮。**点击音是 `50888`。** 判断「有没有点中」必须看 `recent` 里有没有**新的 50888**。

## 七、联机信号契约（需用户在编辑器搭节点图）

```
客户端 → 服务端：ChessSync(Int a, Int b, Int c, Int d, String fen)
服务端 → 客户端：同名 ChessSync 原样广播给房间内所有人
```
事件类型（`a` 槽）—— **v3.2 起共 14 个（0~13）**：

| 值 | 含义 | 参数 |
|---|---|---|
| 0 `EV_MOVE` | 走子 | a=起点格 0-63, b=终点格 0-63, c=升变(0/1Q/2R/3B/4N) |
| 1 `EV_NEWGAME` | 新开一局 | a=发起方 |
| 2 `EV_RESIGN` | 认输 **/ 弃局** | a=认输方, **c=0 认输 / c=1 弃局** |
| 3 `EV_DRAW_REQ` | 求和 | a=请求方 |
| 4 `EV_DRAW_ACC` | 同意和棋 | a=同意方 |
| 5 `EV_JOIN` | 请求加入 | — |
| 6 `EV_ROLE` | 身份分配（服务端回发，**可选**） | a=0白/1黑 |
| 7 `EV_DRAW_NO` | 拒绝和棋 | a=拒绝方 |
| **8** | `EV_READY` 准备/取消 **（v3.0：初始界面「我选了某时间档」）** | a=1 我已选好, **b=档位号 1~4**, fen=**本端标识 `P<随机数>`** |
| **9** | `EV_START` 开局通知 **（v3.0：带颜色）** | **a=0 我执白 / 1 我执黑**, b=档位号, fen=**本端标识 `P<随机数>`** |
| **10** | `EV_UNDO_REQ` 悔棋请求 | a=发起方 |
| **11** | `EV_UNDO_ACC` 悔棋同意 | a=同意方 |
| **12** | `EV_UNDO_NO` 悔棋拒绝 | a=拒绝方 |
| **13** | `EV_RESULT` **（v3.2 结算协同）** | **a=1 再来一局 / 2 复盘**, b=我的身份(0白/1黑), **c=回声 token** |

> **`EV_RESIGN` 双语义**：`c=1` 由「返回主菜单 → 确定放弃」发出。
> 结算文案必须区分 —— 认输是「白方认输，黑方胜」，弃局是「对手已离开本局 / 本局结束，不计胜负」。
> **把弃局显示成对方认输，会让玩家误以为赢了一盘真棋。**

> **`EV_READY` / `EV_START` 的 `fen` 槽已被 token 占用**，不再是空字符串。
> 用户搭节点图时**不要给这两个事件的 fen 填固定值**，否则回声过滤失效。

服务端节点图只做「收到即广播」，不校验、不存数据、不排序。
没有节点图时自动降级为本地同屏。

### ⚠️ 七之二、方案 T：用「自识别 token」过滤回声（v2.0）

官方 API **不提供发送者身份**（已查《客户端控件API文档》全文：
`playerIndex` / `GetPlayerIndex` / `selfPlayer` 均不存在）。所以「收到包怎么知道是不是自己发的」
这个看似无解的问题，改成问「**这是不是我发的**」—— 只依赖本地标记，不需要任何身份 API。

```lua
-- 发
local tok = "T" .. tostring(GAME.__tokenSeq)   -- 纯序号（os.clock 在沙箱里会挂死，见下）
GAME.__myReadyToken = tok
net_send_event(CONFIG.EV_READY, 1, GAME.tcN, 0, tok)

-- 收
local isEcho = (GAME.__myReadyToken ~= nil and fen ~= nil and fen == GAME.__myReadyToken)
if isEcho then GAME.__myReadyToken = nil; return end   -- ★ 立刻清零
```

**「收到回声后立刻清零 token」是机制核心**：它把撞车窗口压缩到「一个网络往返」。
所以即使两端都用 `T1`，只要不是在同一往返内点准备，就仍能正确识别对方。

**已知失败模式（安全降级）**：两端在**同一网络往返内**先后点准备 → token 撞车 →
双方互相判为回声 → 都不置「对方已准备」→ 各自等 15 秒提示「没等到另一位玩家」。
**不误开局、不卡死**，点「直接开始」即可。

> **`os.clock()` 绝对不要用**：它在本项目沙箱里会让脚本**挂死**（不是抛错，`pcall` 抓不住），
> 表现为整个游戏起不来、模拟器 `start` 超时。v2.0 为此专门回退成纯序号。

### 七之三、v3.0 快速开局（**取代待机室**）与视角翻转

**用户需求（2026-11 真机反馈）**：① 双人进入后不应有待机室，双方选好时间就自动进对局；
② 界面要提示对方选了哪个时间；两人不同给 5 秒改选，都不改就随机采用一个；
③ 进对局后随机分黑白，黑方看到黑棋在下（视角翻转），棋子保持正立。

#### 1. 流程（运行时）

```
初始界面（screen="start"）
  点时间档卡 → online_on_pick(n)
      · apply_time_control(n)
      · 摇本端标识（online_roll_id）→ 广播 EV_READY(a=1, b=n, c=0, fen="P<随机数>")
      · 之后每 MATCH_HEARTBEAT_SEC(0.9s) 重发一次（心跳，兼作「我还在」）
  收到对端 EV_READY（fen 不在 myFens 里）
      · 记 peerTier / peerRand / peerFen / peerSeenAt
  OnUpdate 每帧 online_tick(dt)
      · 双方档位相同且对端新鲜(≤3s) → online_start(档位, "same")       ← 自动被拉进对局
      · 不同 → 记 conflictAt，界面显示「{s} 秒后随机采用一个」
      · 改选成相同 → 立即开局（不等满 5 秒）
      · conflictAt 满 MATCH_DIFF_WAIT_SEC(5s) → 随机采用一个后开局
  收到对端 EV_START（它先判定成功）→ online_start(b, "peer_start")，并取它的相反色
```

**没有待机室那一层了**：`build_lobby` / `show_lobby` / `refresh_lobby` 仍在文件里，
但已无任何运行时入口（保留是为了不破坏自检 12-l/12-p/12-q 按 `screen="lobby"` 的旧断言）。
`net_on_signal` 里 EV_READY / EV_START 按 `GAME.screen ~= "lobby"` 分流到新逻辑。

#### 2. 随机黑白为什么两端一定互补

规则：**本端随机数大的一方执白**。两端各算一次 `myRand > peerRand` / `peerRand > myRand`，
是反对称的，恰好一个成立。随机数相同（两端同帧点击的极端情况）时退化为同色，
由 `EV_START` 的 `a` 槽（对端宣告的颜色）二次纠正，见 `online_on_peer_start`。

**标识 = 随机数**（不是旧版的 `T<序号>`）：旧版两端序号都从 1 开始**必然撞车**，
本次改成 `P<随机数>`，且**每次点时间档都重摇一次**；旧标识留在 `GAME.online.myFens` 里
继续认作「自己」，避免旧回声被当成对手。熵来自 `os.time`（秒级）+ 本地累计 dt 的微秒部分
—— 两个玩家的点击时刻不同，数值就不同。

> **已知边界**：模拟器里两个客户端**可能**在同一帧被点击（帧节奏完全一样），
> 此时两端随机数会相同、标识撞车。所以模拟器验收用 `serverSend` 指定对端随机数，
> 让「随机数比较」这条判据可确定地被验证，而不是靠运气。

#### 3. 视角翻转（`GAME.match.sq`）

- 只做**格号映射**：`GAME.match.sq(sq) = flip and (63-sq) or sq`（自逆，显示与命中共用）。
- **格底 64 个控件一个都不用动**：`isDark=(rank+file)%2`，180° 旋转后 `(7-r)+(7-f) ≡ r+f (mod 2)`，
  棋盘看起来完全一样。
- 需要换的是：**棋子**（`render_pieces` 三处 `slot.x/y`）、**上一步痕迹 / 将军罩 / 选中罩 /
  落点圆点 / 走子动画端点**（全部 `LAYOUT.square_pos(L, GAME.match.sq(sq))`）、
  **坐标标注**（`GAME.match.set_flip` 把最左列改成 h→a、最下行改成 8→1）、
  **点击命中**（命中区建在物理格上，`on_square_clicked` 入口 `sq = GAME.match.sq(sq)` 换回逻辑格）。
- **棋子为什么不会被转倒**：位置换了，控件本身的旋转没变 —— 用户要的「棋子保持正立」就是这么来的。
- **翻转的生效时机**：`GAME.match.start` 里**先** `set_flip` **再** `new_game()`，
  这样 `new_game → render_all` 一次性按新视角落位；若中途翻转（同色修复），
  必须走 `GAME.match.reposition()`（先清 `slot.x/y` 再 `render_all`，
  否则全量渲染会沿用旧坐标 —— 表现是「棋盘方向变了、棋子没动」）。
- 同屏 / 复盘研习进入前一律 `set_flip(false)`，回到初始界面也 `false`。

#### 3.1 顺手修掉的旧缺陷：棋盘下方 a~h 一直不显示

- 现象：左侧 `1~8` 正常，下方 `a~h` 一个都看不见（v2.0 交付版就有，不是翻转引入的）。
- 根因：字母盒高 = `coordStrip` = 字号 22px，违反平台「板高 ≥ 2.1×字号 ⇒ 否则整行被吞」，
  行号盒高 = 格宽 87.75px 所以没事。
- 修法：字母盒高 = `max(coordStrip, 2.1×字号+1)`，**顶边不动、盒子向下长**（下方本来就有空白外壳）。
- 自检守：翻转时 `coordFiles[0].text == "h"`、`coordRanks[0].text == "8"`，复原后回 `a`。

#### 4. 自检（`match_quickstart`）

`SelfTest` 新增一条：对端识包（tier + rand）、自己的回声必须被丢弃、翻转格号自逆 +
坐标标注 `h`/`8`、自检期间 `online_tick` 不得真的开局。**不含**「真的开局」——
那会污染玩家界面，开局表现由模拟器试玩与真机验证。

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
| **吃子区消失/重叠** | v3.2 删了 `MOVE_LOG` 改用 `CAP_AREA`。**`PANEL_LAYOUT` 里 `CAP_WHITE`/`CAP_BLACK` 两个键必须保留**（consistency_check 取键并集比对），但已不用于布局 —— 删掉会让门禁报缺项 |
| **Demo 锚点注释会被正则当真** | `consistency_check.cjs:189` 的正则不剔注释。删按钮时必须连 `proto/chess_demo.html` 里「机器可读锚点注释」那一行一起删，否则报「Demo 有未登记的按钮」 |
| **`local function` 先用后定义** | v3.2 的 `result_apply` 调用 `enter_review`，而它定义在后面 → 被绑成全局 nil，运行时崩。已用 `local enter_review` 前置声明修掉；新增跨段调用一律先声明 |

## 九、模拟器试玩坐标速查（1600×900）

`qxqy_studio_play` 的 `pointer` x/y 是**画布坐标、原点左下、Y 向上**，与 Lua 布局同一套。
格宽 87.75、棋盘左下 (449, 99)：

```
格号 sq -> 像素: x = 449 + (sq % 8) * 87.75 + 43.9
                 y =  99 + (sq // 8) * 87.75 + 43.9
例：e2 = sq 12 -> (800, 230)；e4 = sq 28 -> (800, 406)
```

面板按钮中心（**v3.2：无「切换本地同屏」**）：新开(1337,322)、认输(1513,322)、求和(1337,233)。
第 2 行右半（1513,233）现在**为空槽**，点击无效。
第三行常驻键「看历史/退出复盘」(1424,171)。
复盘四键：开局(1340,296)、上一步(1516,296)、下一步(1340,232)、终局(1516,232)。
结算三键（**v3.2 加「退出」**，面板 44%×50%，三键各 24% 宽）：
  再来一局(约 640,~292)、复盘(约 800,~292)、退出(约 960,~292)。
  具体 y：面板高 0.50×900=450，面板底 y=(900−450)/2=225，按钮带 byy=0.31 → y≈225+139=364，中心 ≈364+29=**393**。
  三键 x：bx1/2/3 = 0.06/0.38/0.70，宽 0.24×704(=0.44×1600)=169，中心分别 ≈ 640/865/1090。
  > ⚠️ 上面是**按公式算**的预期值；真机/模拟器实测请以 `qxqy_studio_play_screenshot` 为准。
确认框「确定/同意」左键 (638,379)、「取消/拒绝」右键 (962,379)。

**手机 1280×720 速查**（格宽 70.2、棋盘左下 (280.8, 61.2)）：

```
格号 sq -> 像素: x = 280.8 + (sq % 8) * 70.2 + 35.1
                 y =  61.2 + (sq // 8) * 70.2 + 35.1
例：e2 = sq 12 -> (640, 184)；e4 = sq 28 -> (640, 325)
第三行常驻键 -> (1160, 137)；复盘四键 y = 236 / 171，x = 1075 / 1209
```

