# v2.0 关键决策记录

> **这份文档的用途**：给以后维护的人看 —— 包括三个月后忘了细节的我们自己。
> 每条都写「为什么这么定」和「如果反例会怎样」。
>
> 生成时间：2026-11-05 · 对应 `lua/levelScript.lua` md5 `77DB0A0986FF2292C9631D9B1E458E14`（9642 行）
> 自检断言 28 条 · 控件 1489 个 · 四档时间控制 · 五个界面层

---

## 目录

1. [时间控制四档](#1-时间控制四档)
2. [悔棋 = 成对](#2-悔棋--成对)
3. [复盘 = 逐手回放 + 分支试走](#3-复盘--逐手回放--分支试走)
4. [联机 = 待机室 + 双方准备 + 3 秒倒数](#4-联机--待机室--双方准备--3-秒倒数)
5. [硬约束 U-1：客户端读不到玩家身份](#5-硬约束-u-1客户端读不到玩家身份)
6. [2.1 倍板高规则](#6-21-倍板高规则)
7. [方案 T：token 自识别](#7-方案-ttoken-自识别)
8. [自检零副作用纪律](#8-自检零副作用纪律)
9. [「A 不应改变 B」断言纪律](#9-a-不应改变-b-断言纪律)
10. [三级证据强度](#10-三级证据强度)
11. [附：所有踩过的坑（编号索引）](#11-附所有踩过的坑编号索引)

---

## 1. 时间控制四档

```lua
TIME_CONTROLS = {
  { n = 1, name = "超快棋", initial = 60,   inc = 0,  est = "1–3 分钟"   },
  { n = 2, name = "闪电战", initial = 180,  inc = 2,  est = "5–12 分钟"  },
  { n = 3, name = "快棋",   initial = 900,  inc = 10, est = "15–40 分钟" },
  { n = 4, name = "慢棋",   initial = 5400, inc = 30, est = "60–120 分钟" },
}
DEFAULT_TIME_CONTROL = 3
```

### 为什么是这四个数字

- **60 / 180 / 900 / 5400 秒**是国际象棋线上平台的通行档位（chess.com / lichess 标准分类）。
  用户要求「4 档时间控制」，这组数字是行业默认，玩家有直觉预期。
- **加秒 0 / 2 / 10 / 30** 与首钟同比例递增（Fischer increment）。
  超快棋不加秒是刻意的 —— 60 秒底钟再加秒会变成「靠加秒拖时间」的怪局。
- **默认 3（快棋 900+10）**：它**恰好等于 v1.12 的硬编码值**（`INITIAL_TIME_SEC=900` /
  `INCREMENT_SEC=10`）。这样 v1.12 的所有路径零回归 —— 门禁 `consistency_check.cjs`
  至今仍硬比这两个常量与 Demo 的一致性。

> **如果反例会怎样**：把默认改成非 3，则 `INITIAL_TIME_SEC`/`INCREMENT_SEC` 这两个
> 遗留别名会与实际默认档不一致，门禁 GATE2 立刻红。
> 这两个常量虽然「实际不用」，但**不许删** —— 它们是 v1.12 兼容性的锚点。

### 联机时「先选者生效」

待机室里档位号随 `EV_READY` 的 `b` 参数下发。规则：

```
本地未锁定（tcLocked == false）→ 采用对方档位，并置 tcLocked = true, tcOwner = 2
本地已锁定                     → 忽略对方档位（先选者优先）
```

> **为什么不做「后选覆盖先选」**：两人同时点不同档位时，后到者覆盖会让**双方看到不同结果**
> （各自认为自己是后者），对局开始时档位不一致 → 棋钟从一开始就错。
> 「先选者生效 + 锁定」保证两端最终收敛到同一个值。

---

## 2. 悔棋 = 成对

```lua
UNDO_PER_SIDE             = 3   -- 每方每局可悔 3 次
PAIRED_UNDO_PLIES         = 2   -- 一次悔棋回退 2 个半步（双方各一步）
UNDO_REQUEST_TIMEOUT_SEC  = 15  -- 联机请求超时，超时视同拒绝
```

### 为什么是「成对」而不是「单步」

国际象棋的悔棋语义是「**撤销我上一步，让你重新走**」。
如果只回退 1 个半步（ply），会出现「轮次错乱」：
你撤销了自己的走子，但轮次指示器还停在你走完之后 —— 玩家会困惑「现在该谁走」。

回退 2 个半步后，局面回到「我走之前」的状态，轮次自然回到我，
玩家重新走一步即可。这是所有国际象棋软件的通行做法。

### 为什么每方 3 次

- 3 次足够纠正真实误操作（手滑、看错）
- 超过 3 次说明玩家在「试探性走子」，属于滥用
- 计数**按方独立**（白 3 次、黑 3 次），不是共享池 —— 否则一方滥用会惩罚另一方

### 为什么请求要超时

联机悔棋需要对方同意（`EV_UNDO_REQ` → `EV_UNDO_ACC` / `EV_UNDO_NO`）。
没有超时，对方掉线会让请求方**永久冻结**在等待态（棋钟还停着，无法继续）。

`UNDO_REQUEST_TIMEOUT_SEC = 15` 秒。超时后：解冻、**不扣次数**、提示「对方没有回应」。
15 秒的依据是 `LOBBY_PEER_TIMEOUT_SEC` 同源：服务端信号最低 100ms 延迟，
握手 2 包最坏 200ms，15 秒是 75 倍余量 —— 既不会误判掉线，也不会让人干等。

> **如果反例会怎样**：没有超时，一旦对方在弹窗出现后掉线，
> 请求方永远卡在 `GAME.pendingUndo` 非 nil 状态，棋盘不可操作、棋钟冻住，
> 玩家只能强退。这是**比少一个功能严重得多**的死锁。

### 10 状态回滚

`undo_apply_pair()` 必须回滚的不只是棋盘：

```
① 局面 st         ② history 深度    ③ 走子记录 log
④ 失子 captured   ⑤ 白方棋钟        ⑥ 黑方棋钟
⑦ 当前轮次 turn   ⑧ 上一步高亮      ⑨ 将军警告
⑩ 悔棋次数（外置，由 undo_consume 单独管）
```

> **为什么棋钟也要回滚**：如果只回滚棋盘不回滚棋钟，玩家「走一步 → 悔棋」
> 会白烧掉思考时间。而回滚棋钟让悔棋变成「时间旅行」，符合玩家对「悔棋」的直觉。

---

## 3. 复盘 = 逐手回放 + 分支试走

### 三层结构

```
主变（真实对局记录）  GAME.history[]  ← 不可变
  ↓ 进入复盘
复盘游标             GAME.review.idx  ← 可前后移动
  ↓ 在某个局面按「从此开新局」或点青色格子
分支（临时探索）      GAME.reviewBranch { st, history, ... }  ← 完全隔离
```

### 为什么分支必须隔离

分支试走是「我想知道如果当时走这里会怎样」。它**绝不能**污染主变，否则：
- 玩家退出复盘后发现真实对局被改写了
- 走子记录、棋钟、失子全都乱了

隔离的实现：`branch_ensure()` 深拷贝一份局面表到 `GAME.reviewBranch`，
之后所有 `branch_move` 只改这一份，**`GAME.st` / `GAME.history` 一次都不碰**。

断言 `review_branch_isolated` 用**双向证据**守这条：
- 正向：分支里走了 N 步后，分支局面确实变了（证明分支在工作）
- 反向：主变的 FEN、history 长度、棋钟全部一字未变（证明没污染）

> **纪律**：「A 不应改变 B」的断言必须同时断言「A 确实做了事」。
> 否则 A 完全没生效时，断言会全绿。详见 §9。

### 为什么动作条放在棋盘下方

复盘动作条（「退回主变」「从此开新局」）原本想放进右侧面板。
实测**放不下**：

```
第三行剩余宽度 = 323.8px
退出复盘 96 + 悔棋 146.4 + 返回主菜单 120 + 8×2 间隙 = 370.4px  > 323.8px
```

而且 `PANEL_LAYOUT` 的**键集不许变**（门禁 `consistency_check.cjs` 拿它和 Demo 的
`const PL` 逐键对比）。所以最终放在棋盘正下方：

```
board bottom y = 99.0    动作条 barY = 23.5, barH = 52 → 顶部 75.5 < 91（不压棋盘）✓
btnBack 中心 (621.0, 49.5)    btnNew 中心 (979.0, 49.5)
```

**代价**：对局中「看历史」入口没了（那个位置被「悔棋」占用）。
Lead 已裁决接受 —— 对局中永远是「悔棋」，看历史只在复盘里。

---

## 4. 联机 = 待机室 + 双方准备 + 3 秒倒数

### 五层界面栈（Z 序）

```
后创建的在上层：
  初始界面 start  →  待机室 lobby  →  棋盘 playing
    ↑ 每次切换必须先「收起其余全部层」
  + 复盘层 / 结算层 / 确认框 / 复盘动作条
```

### 为什么需要 `hide_all_overlays()`

**两次同型 P0 事故**：

1. **块 3 幽灵层**：`entry_start_local` / `entry_start_review` 各自漏调 `hide_lobby()`，
   进入对局后被待机室的空白骨架盖住（棋盘/棋子全看不见）
2. **块 5 动作条泄漏**：动作条没有任何「进入非复盘界面」的路径去收起它，
   于是初始界面和待机室底部都露出「退回主变」「从此开新局」，还压住底部提示文字

根因同一个：**某个 `show_XXX` 忘了收起某层**。所以收敛成一个函数：

```lua
local function hide_all_overlays()
  -- ① 待机室整层  ② 复盘动作条 6 个 part（**无条件**，不看 GAME.review）
end
```

**五个生产调用点**（另有 1 处位于 `SelfTest` 内，用于验证它真的会关）：

| 调用点 | 场景 |
|---|---|
| `show_start_screen` | 回初始界面 |
| `show_lobby` | 进待机室 |
| `start_game_from_lobby` | 待机室开局 |
| `entry_start_local` | 单人·双人同屏开局 |
| `entry_start_review` | 单人·复盘研习开局 |

> **为什么动作条要「无条件」关**：早期版本按 `GAME.review ~= nil` 判断，
> 但**抓不到「screen 已切走、review 还没清」的中间态** —— 而那正是 bug 发生的时刻。
> 现在断言 `overlays_hidden_on_screen_switch` 会先把 6 个 part **故意全部点亮**，
> 再调 `hide_all_overlays()`，验证它真的会关。

### 倒数 3 秒

`LOBBY_COUNTDOWN_SEC = 3`（**H-6 硬契约，不许改**）。
双方 `myReady and peerReady` → 启动倒数 → 倒数结束 → **立即本地进 playing** → 通知对端。

见 §7 关于「为什么是立即开局而不是等 EV_START」。

---

## 5. 硬约束 U-1：客户端读不到玩家身份

### 事实

已查官方《客户端控件API文档》（`client/mhtakr07vej4_客户端控件API文档.md`）全文：

```
playerIndex / GetPlayerIndex / selfPlayer / myIndex / GetLocalPlayer  → 全部不存在
script:RegisterServerSignalHandler(signalName, callback(signalName, signalParams[]))
  → 回调只给「信号名 + 参数数组」，没有任何发送者身份
```

**结论：客户端 Lua 无法知道「我是谁 / 房间里有谁 / 对方叫什么」。**

### 三个直接后果

| 后果 | 表现 | 处理 |
|---|---|---|
| 读不到昵称 | 对手行不能显示玩家名 | 用固定文案 `你` / `对手` |
| 读不到玩家列表 | 无法知道房间里有没有第二个人 | 用信号握手 `EV_READY` 推断「有人在」 |
| 读不到自己身份 | 无法区分「我发的包」和「对方发的包」 | **方案 T**（见 §7） |

### 为什么不做「服务端分配身份」

理论上服务端节点图可以给每个玩家发 `EV_ROLE`（`a=0` 白 / `a=1` 黑）。
但这是**可选配置** —— 用户可能不搭节点图（客户端脚本要能独立跑通）。

所以代码里 `EV_ROLE` 只做「如果收到就用，收不到就走默认」：
```lua
elseif eventType == CONFIG.EV_ROLE then
  GAME.mySide = (a == 0) and 1 or 2
```

> **已知影响**：未配 `EV_ROLE` 时两端 `mySide` 都是默认值 1（都以为自己执白）。
> 联机时表现为「双方都能操作双方棋子，谁轮到谁走」。
> **不影响可玩性**（同屏轮流本来就允许），但联机语义上不严格。
> 这是**已知限制**，写入导入方案的「可选强化」章节。

---

## 6. 2.1 倍板高规则

### 规则本体

「文本框可用高不够 → 整行文字被吞掉」在本项目**踩了 6 次以上**。

根因始终同一个：**手写字号字面量，没和板高绑在一起**。
所以把「字号 ↔ 板高」换算收成一对**互逆函数**：

```lua
fit_h(fontSize)    = ceil(fontSize * CONFIG.V2_H_RATIO) + 1   -- 给这个字号需要多高的板
font_for_h(hPx)    = max(CONFIG.FONT.MIN_FONT,
                         floor(hPx / CONFIG.V2_H_RATIO))      -- 这么高的板最多用多大字号
CONFIG.V2_H_RATIO  = 2.1
```

### ⚠️ 最容易踩的陷阱：`font_for_h` 会少一档

因为 `fit_h` 里有 `+1` 的缓冲，`font_for_h(h)` 算出的字号 **可能仍然放不下**：

```
h = 50
font_for_h(50) = floor(50 / 2.1) = 23
fit_h(23)      = ceil(23 * 2.1) + 1 = ceil(48.3) + 1 = 49 + 1 = 50  → 50 ≤ 50 ✓
h = 49
font_for_h(49) = floor(49 / 2.1) = 23
fit_h(23)      = 50  → 50 > 49 ✗ 放不下！
```

**所以只调 `font_for_h` 是不够的，必须交叉验证 `fit_h(font_for_h(h)) <= h`。**

这条已经写进 `text_fits` 断言，用 `utf8.codes` 逐字符累加宽度（全角算 1em，半角算 0.5em）。

### 唯一的例外：`START.TITLE = 64`

```
板高实测 103.5px，fit_h(64) = 136，比值 103.5 / 64 = 1.617 < 2.1
```

**为什么允许例外**：这个字号是**实测调出来的** —— 在 103.5px 的板上用 64 号字，
视觉上刚好（标题够大但不溢出）。如果按 2.1 规则应该用 `font_for_h(103.5) = 49`，
但实测 49 号在主菜单上**显得太小，压不住 4 张档位卡**。

Lead 裁决：**「trust measurement」** —— 实测优先于公式。

> **纪律**：例外必须**显式记录**并写明理由。不允许「悄悄绕过规则」，
> 否则下一个人会以为是 bug 而去「修正」它。
> 这条已在 `CONFIG.FONT.START_TITLE` 上方的注释里写明。

### 相关陷阱：宽度也会溢出

`悔棋（剩 3）` 这个文案：5 个全角 + 2 个半角字符。
- 字号 24 → 宽度 146.4px ≤ 可用 147.8px，**余量只有 1.4px**
- 字号 25 → 换行

所以 `text_fits` 断言必须**同时检查高度和宽度**，不能只查高度。

---

## 7. 方案 T：token 自识别

### 问题

服务端 `SendSignal()` **广播给房间内所有人，包括发送者自己**。
所以「收到 `EV_READY(a=1)` 就认为对方准备好了」会被自己的回声污染。

**实测证据**（playerCount=2）：
```
玩家2 点准备 → 发 EV_READY(a=1)
玩家2 收到自己的回声 → peerReady = true
玩家2: myReady=true + peerReady=true → 假的「双方就绪」
→ 3 秒后自动开局，而玩家1 从头到尾没点过任何按钮
```

### 为什么不能用「发送者身份」

见 §5 —— API 不提供。所以所有依赖「谁发的」的方案都不可行。

### 关键洞察

> **不需要知道「谁发的」，只需要知道「这是不是我发的」。**

发送时生成一个**只在本端存在**的 token，塞进 `fen` 参数（该参数此前完全未使用）；
收到时先比对 token，相同就是自己的回声。

```lua
-- 发
local tok = make_self_token()
GAME.__myReadyToken = tok
net_send_event(CONFIG.EV_READY, G.myReady and 1 or 0, GAME.tcN, 0, tok)

-- 收
local isEcho = (GAME.__myReadyToken ~= nil and fen ~= nil
                and fen == GAME.__myReadyToken)
if isEcho then
  GAME.__myReadyToken = nil    -- ← 立刻清零，这是机制的核心
  return
end
-- 到这里才是真正的对方
G.peerReady = (a == 1)
```

### 为什么 token 清零是机制的核心

`make_self_token()` 用的是**本地自增序号**（`"T1"`, `"T2"`, ...），
两端第一个 token **必然都是 `"T1"`** —— 会撞车。

但**每端发完包后收到自己的回声就立刻清零**，所以「两端同时持有相同 token」的
窗口只有**一个网络往返**（~100ms）。真实操作的时间差通常几秒，远大于此窗口。

实测验证（Lead，时间差 26 秒）：
```
t=18.9  P2 发 T1 → 收到回声 → tok 清零 → peerReady 保持 false ✓
        同一包到 P1 → P1 的 tok 是 nil → isEcho=false → peerReady=true ✓
t=44.7  P1 发 T1 → 收到回声 → tok 清零 → peerReady 保持 true ✓
        同一包到 P2 → P2 的 tok 已是 nil → peerReady=true ✓
        → 两端都「双方就绪」✓
```

### 已知失败模式（**安全降级，不误开局**）

若两端在**同一个网络往返内**先后点准备，token 撞车且都还没被清：

```
P1: tok="T1", 发 fen="T1"
P2: tok="T1", 发 fen="T1"      ← 都还在
→ 双方收到对方的包时 isEcho 都为 true → 互相忽略
→ peerReady 都保持 false → 不会「双方就绪」
→ 各自 15 秒后提示「没等到另一位玩家，也可以直接开始」
→ 玩家点「直接开始」即可开局
```

**影响**：联机的「双方准备」在此窄场景下失效，但不误开局、不卡死。
**彻底修复需要跨端唯一标识，而客户端 API 不提供玩家身份（§5）。**

Lead 裁决：**接受此限制，不改**。理由：
① 收益场景极窄（同毫秒操作）；
② 增强方案依赖可选的 `EV_ROLE`，对没配节点图的用户零收益；
③ 已在「为修窄场景 bug 而搞坏主流程」上吃过一次亏（引入 `os.clock` 导致游戏起不来）。

> ⚠️ **禁止使用 `os.clock()`**。它虽在官方允许列表，但实测在本沙箱里
> **会让启动挂死**（`play worker timed out after 8000ms`），而且 `pcall` 抓不住「挂住」。
> 这是本项目「文档说允许 ≠ 沙箱实现一定有」的典型案例。
> 其他同类：`raycastTarget`、`imageType`、`ServerSignal.AddInt`。

### `EV_START` 的语义变更

```lua
-- 倒数结束（不再等待任何网络包）
G.countdown = -1
start_game_from_lobby(true)   -- 本地先无条件进 playing
return
```

**早期方案（已废弃）**把 `EV_START` 当成**开局的前置条件**：
「倒数跑完 → 等对端 EV_START → 超时 1.5 秒自己开局」。

**问题**：对端掉线/没搭节点图时，本端卡在「等待超时」中间态（实测日志出现过
`等待对端 EV_START 超时（1.5 秒），本地直接开局`）。

**现在**：`EV_START` 退化为**纯通知**。代价是两端开局时刻可能差一个往返（~100ms），
但这完全可以接受 —— 对局第一手要等玩家思考，100ms 差值无人能感知；
而「卡住不动」是明显的坏体验。

> `LOBBY_START_GRACE_SEC`（原 1.5 秒）已随该逻辑**彻底删除**
> （常量、断言、文档、校验脚本一起清）。
> **死常量比没常量更误导** —— 后来读代码的人会以为还有等待逻辑。

---

## 8. 自检零副作用纪律

### 背景：一次真实事故

`SelfTest()` 在**每次 `OnStart` 都跑**。早期版本里有几条断言会「真的执行动作」：

```lua
-- ❌ 错误写法（曾经存在）
net_send_event(CONFIG.EV_READY, 1, 3, 0, "")   -- 真机上真的广播给所有玩家
start_game_from_lobby(false)                   -- 真的走一遍开局逻辑
```

**实测后果**（Lead，playerCount=2）：一次启动就冒出 **4 条自检产生的包**
（`EV_READY`×2 + `EV_START`×2，两端各两条）。

**后果推演**：只要有一端时序稍慢，另一方会在还没进待机室时就收到 `EV_START`
→ **游戏在对局开始前就被「开局」了**。

### 五条子纪律

```
① 自检不发网络包       → GAME.inSelfTest 拦截 net_send_event（返回 false）
② 自检不启动对局       → GAME.inSelfTest 拦截 start_game_from_lobby
③ 自检不改玩家可见状态  → 所有临时改动必须完整备份并还原
④ 验证「某函数会做什么」时，验它的返回值/内部标记，而不是真的执行它
⑤ 断言不得假设自己运行在哪个屏
```

### 纪律 ⑤ 的由来（同型错误第 3 次）

```
① lb.hitSolo 字段路径错（实际是 lb.btnSolo.hit）
② undo_ready 在 screen=start 时要求悔棋按钮有文案
③ stillLobby = (GAME.screen == "lobby")  ← 自检其实跑在 screen="start"
```

**共同点：断言把「某个特定上下文」当成了普遍前提。**

> **判据要写「状态不许变成 X」，而不是「状态必须等于 Y」。**

### 实现要点

```lua
GAME.inSelfTest = true
local okCall, res = pcall(function()
  local r = SelfTest()
  GAME.inSelfTest = false
  return r
end)
GAME.inSelfTest = false    -- 兜底复位
```

**双层复位**：如果 `SelfTest()` 抛错而没复位，**整局游戏的联机发送会永久失效** ——
这比自检失败严重得多。

### 🔴 最惨痛的教训：断言写了不跑 = 没写

块 1~5 期间，`SelfTest()` **从来没有被调用过**。24 条断言只是「存在于源码里」，
一次都没执行。结果：

- 块 4 的动作条泄漏（BUG-1）没被拦住
- 块 5 的 `EV_START` 双发（BUG-3）没被拦住
- 3 条断言本身是错的（假红），从没被发现

Lead 的原话：**「断言代码存在，但从未执行」** —— grep 到 ≠ 运行时执行。

> **纪律**：任何「断言全绿」的结论，都必须建立在「它真的跑过」之上。
> 一旦接入自检，第一次真跑就抓出 3 个真缺陷（`undo_ready` / `branch_not_in_paint_loop` /
> `lobby_solo`）—— **这直接证明了接入自检这个动作的价值。**

### 另一个真实教训：`fen` 从未被提取

```lua
local a = params[2] or 0
local b = params[3] or 0
local c = params[4] or 0
-- ❌ 没有 params[5]！
...
local isEcho = (... and fen == GAME.__myReadyToken)   -- fen 是全局 nil
→ isEcho 恒 false → 回声从来没被过滤过
```

**Lua 对「读未定义的全局」不报错，静默给 nil。**
而 `lua_check` 的「可疑全局赋值」只查**赋值**，查不到**读取**未定义全局。

**三轮都没发现**：人读代码（变量名存在、比较也写了，看着完全合理）→ 没发现；
`lua_check` → 不在检查范围；`_audit_forward_vars`（查 local 前向引用）→ 不在范围。
**只有真正跑一遍断言才抓到。**

---

## 9. 「A 不应改变 B」断言纪律

### 规则

> **凡「A 不应改变 B」的断言，必须同时断言「A 确实做了事」，
> 否则 A 完全没生效时断言会全绿。**

### 为什么

假设要断言「悔棋不会改变对局胜负」。写成：
```lua
undo_apply_pair()
assert(GAME.result == nil)     -- 悔棋后仍然没有胜负 ✓
```
如果 `undo_apply_pair()` **整个函数没跑**（比如条件不满足提前 return），
`GAME.result` 当然还是 nil → **断言通过，但什么都没验到**。

正确写法：
```lua
local fensBefore = RULES.to_fen(GAME.st)
undo_apply_pair()
assert(RULES.to_fen(GAME.st) ~= fensBefore)   -- A 确实做了事
assert(GAME.result == nil)                     -- A 没改变 B
```

### 本项目中的实例

| 断言 | 「A 确实做了事」的证据 | 「没改变 B」的证据 |
|---|---|---|
| `review_branch_isolated` | 分支局面 FEN 变了 | 主变 FEN / history / 棋钟不变 |
| `ready_token_filters_echo` | `peerSeen` 变 true | `peerReady` 不被回声置位 |
| `overlays_hidden_on_screen_switch` | 先把 6 个 part 全点亮 | 调后全部变暗 |
| `undo_restores_position_history` | history 长度减少 | 棋钟 / 轮次正确恢复 |

### 连带纪律：nil-guard 必须先查

> **断言静默失效比断言失败更危险。**

任何断言若依赖外部函数/表，必须先查 nil：
```lua
if branch_ensure == nil then
  probs[#probs + 1] = "branch_ensure 不存在"     -- 明确失败
  -- 而不是：if branch_ensure ~= nil then ... end   -- 静默跳过
end
```

---

## 10. 三级证据强度

```
真机（真实编辑器 + 试玩）  >  模拟器（qxqy_studio_play）  >  源码静态检查
```

### 各级能证明什么 / 不能证明什么

| 级别 | 能证明 | **不能**证明 |
|---|---|---|
| **源码 + 静态门禁** | 语法正确、分区顺序、常量一致、无前向引用 | 运行时行为、平台 API 是否可用 |
| **模拟器** | 单机全流程、双端联机（`playerCount=2`）、自检全绿 | 真机控件容量、真机信号延迟、真机 API 语义 |
| **真机** | 一切 | —— |

### 关键教训

**「模拟器全绿 ≠ 可用」的活例证**：

自检在真机上会广播假信号这件事，**只有 `playerCount=2` 能发现**。
单机时这些包只回环给自己，看起来完全正常（`outbound: []` 是因为被自检闸拦住了）。

**「文档说允许 ≠ 沙箱实现一定有」**：
`os.clock` 在官方允许列表里，但实测**启动挂死**。
同类：`raycastTarget`、`imageType`、`ServerSignal.AddInt`。

### 只能真机验的清单

1. `SetAsLastSibling` 真机语义（Z 序是否如预期）
2. 控件 1489 个是否触发真机容量限制
3. `showCursor` 覆盖范围（四角 a1/h8/a8/h1）
4. 棋子与格子对齐（d1 白后、a1 白车）
5. 双端信号延迟 + 回声不重复触发
6. `EV_READY` 双端握手（模拟器已验证，真机再确认）
7. 悔棋请求-同意全流程
8. **方案 T 的 token 撞车窗口**（真机延迟与模拟器不同）

---

## 11. 附：所有踩过的坑（编号索引）

### P0 级（导致功能不可用）

| 编号 | 现象 | 根因 | 修法 |
|---|---|---|---|
| P0-1 | 整屏文字全丢，只有「返回主菜单」有字 | `lb.title` / `lb.btnSolo` 从未赋值；两套 struct 约定混用（`mkLine` 返回控件 → `.text`；`mkPlayerRow` 返回 `{edgeBox,bg,text}` → `.text.text`） | 统一赋值 + 加 `lobby_texts_nonempty` 断言 |
| P0-2 | 进入对局后被待机室空白骨架盖住 | `entry_start_local` / `entry_start_review` 漏调 `hide_lobby()` | `hide_all_overlays()` 收敛 |
| P0-3 | 初始界面/待机室底部露出「退回主变」「从此开新局」，压住提示文字 | 动作条没有任何路径去收起它 | `hide_all_overlays()` 无条件关动作条 |
| P0-4 | 悔棋后按钮变回「看历史」 | `b.v2UndoShown` 自建缓存与 `VIS_STATE` 脱同步；`hide_confirm` 未回叫 `refresh_undo_button()` | 删缓存（`VIS_STATE` 已去重）+ 补回叫 |
| P0-5 | **只有一方点准备就开局了** | `G.peerReady = (a == 1)` 被自己的回声置位；`fen` 从未从 `params[5]` 提取 → `isEcho` 恒 false | 方案 T（token）+ 提取 `params[5]` |
| P0-6 | **模拟器启动连续超时，游戏起不来** | `os.clock()` 在沙箱里挂死，`pcall` 抓不住「挂住」 | 改纯序号 token |
| P0-7 | `attempt to index a nil value (global 'GAME')` | `GAME` 定义在 `show_start_screen` 之后，而函数体在编译期把 `GAME` 解析成 global | 把 `GAME` 整体上移到 UI 区之前 |

### P1 级（错误但可绕）

| 编号 | 现象 | 根因 | 修法 |
|---|---|---|---|
| P1-1 | 3 处待机室文字溢出 | 手写字号 | FOOTER/HINT 20→18、TITLE 40→35 |
| P1-2 | `EV_START` 双发（2 条包） | `start_game_from_lobby` 无条件广播，两个调用方都广播 | 加 `broadcast` 参数 |
| P1-3 | 悔棋请求方永久冻结 | 无超时 | `UNDO_REQUEST_TIMEOUT_SEC = 15` |
| P1-4 | 悔棋响应方误扣次数 | `undoPeer` 确认分支错调 `undo_consume()` | 响应方不消费 |

### 断言自身的错误（制造假噪音）

| 编号 | 断言 | 错误 | 修法 |
|---|---|---|---|
| A-1 | `lobby_solo` | 查 `lb.hitSolo`，实际是 `lb.btnSolo.hit` | 改字段路径 + 加严成三查 |
| A-2 | `undo_ready` | 在 `screen=="start"` 时要求悔棋按钮有文案 | 先切 `screen="playing"` 再查，跑完还原 |
| A-3 | `branch_not_in_paint_loop` | 阈值 100 但测的是一次性全量重绘（~2500 次） | 分三段计量 + 阈值 ≤5000/段 |
| A-4 | `ev_start_sent_once` | 判据 `screen == "lobby"`，实际跑在 `start` | 改成 `screen ~= "playing"` |

### 从未被执行的断言（最严重）

`SelfTest()` 在块 1~5 期间**从未被调用**。24 条断言全部形同虚设。
接入后第一次真跑，立刻抓出 **3 个真缺陷**（含 P0-5 的前身）和 **3 条断言自身错误**。

---

## 附录：当前交付物清单

| 文件 | 说明 |
|---|---|
| `lua/levelScript.lua` | 唯一手写源（9607 行，md5 `DEE1B47B...`） |
| `sim/levelScript.lua` | 模拟器副本（由 `sync_sim_copy.cjs` 生成，**禁止手改**） |
| `out/交付包/levelScript.lua` | 交付副本（与 `lua/` 逐字节相同） |
| `docs/v2-signal-protocol.md` | 信号协议（给 docs-lead 粘贴进导入方案 §7.7） |
| `docs/v2-decisions.md` | **本文件** |
| `docs/tech-architecture.md` | 技术架构（模块职责、数据流、挂载点） |
| `tests/v2-cases.md` | TDD 用例（不可改） |
| `docs/gdd-v2.md` | 策划案（不可改） |

### 门禁链（必须按序全跑）

```
1. 编辑 lua/levelScript.lua
2. node tools_work/sync_sim_copy.cjs      → 同步 sim/
3. node tools_work/sync_delivery.cjs      → 同步 out/交付包/
4. node tools_work/lua_check.cjs          → 语法 + 分区顺序 + 前向引用
5. node tools_work/consistency_check.cjs  → 常量与 Demo 一致
6. node tests/static_checks.cjs           → CHECK-0..8
7. node tools_work/issue1/_audit_forward_vars.cjs   → 前向变量
8. node tools_work/issue1/_inline.cjs     → 写入模拟器存档
```

> ⚠️ **编辑 `sim/` 直接改会被静默覆盖**，而且 `consistency_check` 还会报「一致性 OK」
> —— 因为它比的是 `lua/` 和 `out/交付包/`。
