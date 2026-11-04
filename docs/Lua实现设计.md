# Lua 实现设计（主控预研稿）

> 用途：写 `lua/levelScript.lua` 之前的结构规划。规则层已由 `tools_work/perft/engine_proto.lua` 验证，
> 本文件只规划**编辑器接口层、界面层、输入层、联机层**怎么接。

## 一、单文件分区（萌新模式）

```
lua/levelScript.lua
  ┌ 第 0 区  文件头注释：文档依据、哈希、生成时间、分区说明
  ├ 第 1 区  CONFIG：全部编辑器侧常量集中一处（容器索引、模板索引、信号名、配色、字号）
  ├ 第 2 区  LOG：日志与故障块（print/printerr、单次输出、GAME FAULT BEGIN/END）
  ├ 第 3 区  规则引擎：从 engine_proto.lua 原样搬入（FEN/走法/合法性/终局/perft）
  ├ 第 4 区  布局换算：唯一换算入口（boardSide/cell/boardLeft/boardBottom/panel*）
  ├ 第 5 区  控件工厂：创建→设锚点→设尺寸→设位置→设颜色→启用→登记的固定顺序
  ├ 第 6 区  界面构建：棋盘 64 格 + 高亮池 + 棋子池 + 侧面板 + 结算面板
  ├ 第 7 区  状态与业务：选中/走子/升变/终局/棋钟/被吃子/走子记录
  ├ 第 8 区  输入：64 个光标检测区的点击回调 + 按钮回调 + 能力探测
  ├ 第 9 区  联机：ServerSignal 发送（能力探测包裹）+ RegisterServerSignalHandler 接收
  ├ 第 10 区 生命周期：NEW→STARTING→RUNNING→FAILED→DESTROYED + 清理栈
  └ 第 11 区 自检入口：供沙箱/真机调用的诊断函数（不参与玩法）
```

## 二、编辑器接口层的关键决策

### 2.1 零图片：全部用文本框

| 用途 | 控件 | 关键字段 |
|---|---|---|
| 棋盘格底（64） | 文本框 | `bgColor` = 浅/深格色，`text=""` |
| 棋子（64 池） | 文本框 | `text` = 字母，`fontColor` + `outlineColor` + `enableOutline=true` |
| 高亮层（池） | 文本框 | `bgColor` = 半透明色，`text=""`，`raycastTarget=false`（不抢点击） |
| 面板/按钮 | 文本框 | `bgColor` + `text` |
| 点击检测（64） | 光标检测区域 | `raycastTarget=true` + `AddCursorEventListener(Click)` |

**控件总数估算**（最终实测值，两档样式）：
- 棋盘格底 64
- 棋子槽位 32（每槽 = 圆盘外圈 1 + 圆盘内圈 1 + 棋符文本框 1，共 3 控件；`PREFAB_IMAGE == 0` 时每槽只建棋符文本框 1 个）
- 落点高亮池 28（后最多 27 个落点）
- 选中高亮 1 + 上一步痕迹 2 + 将军警示 1
- 坐标标注 16
- 点击检测区 64
- 侧面板：底 1 + 标题 1 + 轮次 1 + 棋钟 2 + 被吃子 2 + 走子记录 1 + 按钮 5 + 按钮点击区 5
- 结算：遮罩 1 + 底 1 + 标题 1 + 副文 1 + 按钮 1
- 弹窗（升变/求和）：各 1 底 + 若干按钮

**实测控件总数**：
- 沙箱（`PREFAB_IMAGE` 替换为 3，即建图片控件）：**314**（218 基础 + 32 × 3）
- 交付版（`PREFAB_IMAGE = 0`，只建棋符）：**250**（218 基础 + 32 × 1）

全部在 `OnStart` 一次性创建，播放期零创建零销毁（满足沙箱 `createdAfterStart == 0`）。

**风险**：单帧创建 250–314 个控件可能触发性能问题。对策：
- 分帧预热（每帧建 60 个），建完再统一显示（`--create-batch` 同类思路）
- 沙箱报告里 `createdAfterStart` 会不为 0 —— 这属于「启动期分帧」，要在报告里说明，或用 `OnStart` 里同步建完（沙箱对同步建完不报错，只是慢）

**决策**：先在 `OnStart` 里同步建完（沙箱能过、真机启动稍慢但可接受），若真机卡顿再改分帧。

### 2.2 坐标换算集中一处

```lua
-- 唯一换算入口。代码其他位置不许出现 1600/900/0.78 这类数字。
local function compute_layout(canvasW, canvasH)
  local boardSide = canvasH * CONFIG.BOARD_SIDE_RATIO      -- 0.78
  local cell = boardSide / 8
  local boardLeft = canvasW * 0.5 - boardSide * 0.5 - canvasW * 0.06
  local boardBottom = canvasH * 0.5 - boardSide * 0.5
  local panelW = canvasW * 0.22
  local panelLeft = boardLeft + boardSide + canvasW * 0.02
  return { boardSide=..., cell=..., boardLeft=..., boardBottom=..., panelW=..., panelLeft=..., canvasW=..., canvasH=... }
end
```

### 2.3 输入：不读坐标，用 64 个独立检测区

每个棋盘格上方盖一个光标检测区域，监听 `Click`，回调里直接知道 `sq`（闭包捕获）。

```lua
for sq = 0, 63 do
  local area = create_cursor_area(...)
  area:AddCursorEventListener(CLICK_EVENT, function(data)
    on_square_clicked(sq)   -- sq 来自闭包，不依赖 data.x/data.y
    return true
  end)
end
```

**为什么这样**：release 10 §5.2 说「输入位置、布局位置、画布尺寸来自不同坐标域，不能直接比较」。用原生命中（§5.3 优先级 1）就绕开了整个问题。

### 2.4 联机：能力探测 + 降级

```lua
local function can_send_signal()
  local sig = game.ServerSignal(CONFIG.SIGNAL_NAME)
  return sig ~= nil and sig.AddInt ~= nil and sig.SendSignal ~= nil
end

local function send_event(eventType, a, b, c, fen)
  if not can_send_signal() then return false end   -- 沙箱里没有 AddInt，直接跳过
  local sig = game.ServerSignal(CONFIG.SIGNAL_NAME)
  sig:AddInt(eventType)
  sig:AddInt(a or 0)
  sig:AddInt(b or 0)
  sig:AddInt(c or 0)
  sig:AddString(fen or "")
  sig:SendSignal()
  return true
end
```

**关键**：`can_send_signal()` 必须在 `pcall` 里探测，因为 `game.ServerSignal` 本身可能失败。

### 2.5 点击事件枚举：两边兼容

```lua
-- 沙箱叫 Click，真机文档叫 CursorClick（L435）。取到哪个用哪个。
local CLICK_EVENT = Enum.CursorEventType.CursorClick or Enum.CursorEventType.Click
```

**风险**：若两个都取不到会报错。加保护：
```lua
local ok, ev = pcall(function() return Enum.CursorEventType.CursorClick end)
if not ok or ev == nil then ev = Enum.CursorEventType.Click end
CLICK_EVENT = ev
```

### 2.6 启动就绪分三类（release 10 §3）

```
配置错误（模板索引 = 0 / 画布尺寸无效）→ 立即报错，输出一个 GAME FAULT 块，状态 FAILED
尚未就绪（容器节点还没出现 / 画布尺寸取不到）→ 记原因，在 OnUpdate 里有限重试（预算 60 次）
确定不匹配（脚本名与预期不符）→ 立即 FAILED，不重试
```

### 2.7 棋钟：用 OnUpdate，不用 OnLevelUpdate

`OnUpdate(dt)` 不受关卡时停影响（文档 L81），棋钟不该被时停停住。逐帧累加 `dt`，每 0.25 秒刷新一次文本。

### 2.8 清理栈

```
创建控件成功 → 立即 push 到 cleanup 栈
创建监听成功 → 立即 push
OnDestroy → 反向执行：注销监听 → 销毁自建控件
```

## 三、沙箱验收目标

```
node tools/sandbox/run_headless.mjs lua/levelScript.lua --ms 3000 --json
期望：
  verdict = pass
  errors = []                       （0 个）
  unsupported = []                  （0 个）
  controls.neverActivated = 0
  runtime_verified = pending        （如实标注）
```

**注意**：沙箱里 `ServerSignal.AddInt` 不存在，所以联机路径**无法在沙箱验证**。这一点必须写进交付说明，不能把「沙箱 pass」说成「联机可用」。

## 四、待用户填的 CONFIG（集中在第 1 区）

```lua
local CONFIG = {
  -- ==== 必须由用户在编辑器里填的真实值（缺失时按第 12 节安全停用）====
  CONTAINER_NODE_INDEX = 0,   -- 容器节点索引
  SCRIPT_SHORT_NAME    = "levelScript",
  PREFAB_TEXT_BOX      = 0,   -- 文本框模板索引
  PREFAB_CURSOR_AREA   = 0,   -- 光标检测区域模板索引
  PREFAB_CONTAINER     = 0,   -- 容器模板索引（可选）

  -- ==== 不需要用户改 ====
  SIGNAL_NAME = "ChessSync",
  BOARD_SIDE_RATIO = 0.78,
  PANEL_WIDTH_RATIO = 0.22,
  INITIAL_TIME_SEC = 900,
  INCREMENT_SEC = 10,
  CLOCK_REFRESH_SEC = 0.25,
  ...
}
```

**校验**：`OnStart` 第一件事检查 `CONTAINER_NODE_INDEX`、`PREFAB_TEXT_BOX`、`PREFAB_CURSOR_AREA` 是否都非 0。是 0 就报「界面零件还没配好」并 FAILED，不做无意义重试。

## 五、与 Demo 的一致性约束

| 项 | Demo 值 | Lua 值 | 一致性检查方式 |
|---|---|---|---|
| 棋盘边长比例 | 0.78 | 0.78 | 同一常量 |
| 面板宽度比例 | 0.22 | 0.22 | 同一常量 |
| 全部配色 | 策划案 10.6 | 同左 | 逐项比对 |
| 全部字号 | 策划案 10.7 | 同左 | 逐项比对 |
| 全部文案 | 策划案第 9 节 | 同左 | 逐字比对 |
| 棋钟数值 | 900s + 10s | 同左 | 同一常量 |
| 走子规则 | engine_proto 移植 | engine_proto 原样 | perft 同答案 |

**Demo 冻结后**，Lua 的布局、规则、数值、文案全部以 Demo 为准。
