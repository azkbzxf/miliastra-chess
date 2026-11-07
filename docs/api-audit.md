# 客户端 API 审计报告 · lua/levelScript.lua

> ## 📌 执行状态（Lead 复核后追加，2026-11-05）
>
> | 编号 | 判定 | 处置 | 实际做法 |
> |---|---|---|---|
> | **E-01** 容器 `showCursor` | P0 错误 | ✅ **已修** | `build_all_ui` 新增 `enable_show_cursor()`，对 `script.object` 与 `game.GetClientUIRoots()[1]` 各设一次；pcall + 读回日志。模拟器实跑两条日志均「已生效」 |
> | **E-03** 注释行号失效 | P1 错误 | ✅ **已修** | 4 组行号逐条替换为 §小节 + 正确行号 |
> | **E-02** `SetAnchoredPosition` 坐标域 | 文档字面「错误」 | ⏸ **不采信为代码缺陷，保持现状** | 见下方「复核意见」 |
> | U-01 ~ U-05 | 文档未覆盖 | 记录，不当作缺陷 | 已写入真机首测必验清单 |
> | 其余 20 条 | 正确 | 无 | — |
>
> ### 复核意见（E-02）
>
> 本报告对 E-02 的文档引用（§13(3) L738）**逐字核对无误**，推理也自洽。
> 但它的三条路线里，路线①建议 `UI.host = nil`（让全部控件无父级）——**这条不能采纳**，理由：
>
> **模拟器运行树实测与「有父级 → 父级中心偏移」的解释直接矛盾**：
>
> | 控件 | 脚本写入（画布坐标） | `get{inspect:true}` 读回 `anchoredPositionX/Y` |
> |---|---|---|
> | `sq_8`（a2，pivot=0） | x=449, y=186.75 | **449, 186.75** |
> | `hit_8` | x=449, y=186.75 | **449, 186.75** |
>
> 若真按「相对父级中心偏移」解释，`x=449` 会让控件跑到容器中心右侧 449px，
> 而容器是 1600×900 —— 整块界面会被推出画布、画面应是空白。
> **但实际渲染完全正常**。即：模拟器在「父级是容器节点」时按画布左下解释，
> 与文档 L738 的字面不符。
>
> 因此本轮**不改坐标体系**（改错方向会让整盘界面飞出去），改为：
> ① 把这条实测证据补进 `docs/锚定配置表.md` §一末（含「仍未验证：真机」）；
> ② 把「真机读回任一控件 `GetAnchoredPosition()` 与基准值比对」列为**真机首测必查项**。
> 真机若确实按父级中心解释，再走折算路线 —— 那时改动面是本报告路线②的 20 处。
>
> > 这条的分歧点值得记住：**文档字面 ≠ 运行时事实时，先跑一次能证伪的实测，再动全局代码。**
>
> ---

> 审计对象：`lua/levelScript.lua`（审计开始时 5200 行；审计期间 Lead 为 issue #3 追加 `hide_legal_pool` 后为 5228 行，本报告行号以 **5228 行版本**为准）
> 唯一权威依据（均已完整读取）：
> 1. `D:\输出目录\千星井字棋资料\客户端控件API文档.md`（1310 行）
> 2. `D:\输出目录\千星井字棋资料\test.lua`（333 行，官方风格样例）
>
> **行号漂移提醒**：Lead 正在同一文件上并行修 issue #2/#3，`L3000` 之后的代码会持续下移。为此每条结论都同时给出**可 grep 的原文片段**，行号漂移时以片段为准重新定位。
>
> 三份副本已核对：`lua/` 与 `out/交付包/` 逐字节相同；`lua/` 与 `sim/` 仅差 CONFIG 4 个模板索引 + 2 行副本头注释（符合预期），故只审 `lua/` 一份。
>
> 补充说明（不作为判据）：`get_client_document("客户端控件API文档")` 取到的官方线上版本与本地 `千星井字棋资料/客户端控件API文档.md` 内容一致，本报告所有引用可在两份中互相印证。**项目用到的 API 全部落在该文档覆盖范围内，没有任何一条需要靠外部知识判断。**

---

## 一、总表

| 编号 | API | 文档依据（行号/小节标题） | 项目用法（文件:行号） | 判定 | 影响 | 修法 |
|---|---|---|---|---|---|---|
| A-01 | 工厂顺序 `SetPivot→SetAnchorMin/Max→SetSizeDelta→SetAnchoredPosition` | API文档 §13(3) L735-751 | `:1511-1515`、`:1546-1550`、`:1722-1726` | 正确 | 无。先定 pivot 与锚点再落位，位置语义才确定 | 保持 |
| A-02 | `SetAnchoredPosition` 与「有无父级」的语义 | API文档 §13(3) **L738**：「无父层级时，以画布左下为原点设置位置；存在父层级时，设置与父层级中心的相对偏移」 | 20 处调用，清单见 E-02 | **错误**（前提不成立） | **全局布局位移**。文档只定义两个分支（无父级=画布左下、有父级=父级中心），**没有任何一句把 pivot 写进这个换算**。项目把「pivot=0 ⇒ 左下角坐标」当语义（`docs/锚定配置表.md:29-32`、`docs/tech-architecture.md:616-617`），而这套等价只在「无父级」时成立；项目把 `UI.host = script.object`（`:4748`）当父级，所有子控件都是**有父级**，于是 `x=449,y=99` 变成「相对容器中心右移 449、上移 99」，整块 1600×900 界面被推出画布 | 见 E-02 三条路线 |
| A-03 | `create_text` 的 pivot=0 | API文档 L708（pivot=「中心」）、L738 | `:1511` `ctrl:SetPivot(0, 0)` | **文档未覆盖** | pivot 与 anchoredPosition 的耦合关系文档未定义 | 见 U-01 |
| A-04 | `create_cursor_area` 的 pivot=0 | 同上 | `:1546` | **文档未覆盖** | 同上；命中区是点击链路核心，错位会「点了没反应」或「点到隔壁格」 | 见 U-01，须先于 A-05 处理 |
| A-05 | `create_image` pivot=0.5 + `legalHL` 落点池定位 | 同上 | `:1722`；`:2174-2180`（pivot=0.5）；`:4237` `local cx, cy = tx + L.cell * 0.5, ty + L.cell * 0.5`；`:4243`、`:4250` | **文档未覆盖** | 「pivot=0.5 ⇒ 传格中心」与文档原文**不冲突也不互证**，只在项目自定 pivot 语义下成立 | 见 U-01；若采纳 A-02 路线②，`:4237` 补半格须一并重算 |
| A-06 | `show_last_move` / `show_check_warning` 定位（文本框 pivot=0） | API文档 L737-738 | `:3122`、`:3123`、`:3146` | **正确**（项目 pivot 语义下） | 两类控件各自正确：文本框 pivot=0 传左下角，与 `LAYOUT.square_pos` 一致 | 无。**但「同一份坐标喂两类 pivot、靠调用点各自补/不补半格」这个结构本身在制造缺陷**（issue #1 第 1 条、issue #3 都是它） |
| A-07 | `imageType = Enum.ImageType.Stretch` | API文档 §11(16) L548-553 | `:1569`、`:1571`（`image_type_stretch()`）、`:1690` | 正确 | 枚举名 `Basic`/`Stretch` 与文档逐字一致 | 无 |
| A-08 | `SetImage(src, id)` + `Enum.ImageSource.StaticReference` | API文档 §14(2) L824、§11(17) L556-567 | `:53`（`PIECE_IMAGE_SOURCE="StaticReference"`）、`:1678` | 正确 | 方法名、参数顺序、枚举名全对。用的是控件方法，**不存在 `game.SetImage` 这种错误写法** | 无 |
| A-09 | `imageColor` 字段名 | API文档 §14(1) L802 | `:1697`、`:4244`、`:4251` | 正确 | 图片控件 `imageColor` / 文本框 `bgColor`·`fontColor`，项目区分正确 | 无 |
| A-10 | `AddCursorEventListener(Enum.CursorEventType.CursorClick, fn)` | API文档 §11(7) L465、§18(2) L915、§19 L922-939 | `:4324-4330`（枚举解析）、`:4350`（注册） | 正确 | `CursorClick` 存在（L465）；回参为 `CursorEventData`，项目回调**不读任何字段**、只做闭包捕获，不构成违约 | 无（`:4327` 的 `Click` 回退是文档外名字，有 pcall 保护且 `CursorClick` 优先，无害） |
| A-11 | `AddCursorEventListener` 回调返回值 | API文档 §18(2) L915（未声明返回值） | `:4350-4353` 回调 `return handled ~= false` | **文档未覆盖** | 文档未说光标事件回调返回值有语义；返回 `true` 至多被忽略 | 见 U-04 |
| A-12 | `SetLocalRotation(x,y,z)` | API文档 §13(3) L750、字段 L710 | `:1707` `ctrl:SetLocalRotation(0, 0, r)`（r 为**角度**） | **文档未覆盖** | 文档只说「设置旋转 / 旋转」，**未给单位（度/弧度）、正方向、轴心**。项目按「度、逆时针为正」用，若真机是弧度则全体棋子图元旋转严重错误 | 见 U-02 |
| A-13 | `SetAsLastSibling()` | API文档 §13(2) L728 | `:2225`、`:4834` | 正确 | 文档「移到同级末位」+「数值越大通常越靠后、显示越靠上」，与「把命中区提到最顶层」意图一致 | 无 |
| A-14 | `SetActive` / `SetVisible` / `active` / `visible` | API文档 §13(1) L699-701、§13(2) L723-724 | `:2790-2805`（`ui_set_active`）、`:1535`、`:1557`、`:1733`、`:4796-4797` | 正确 | 两者同写不冲突（L724 明说 `SetVisible` 不改激活状态）；`active`/`visible` 是**只读**字段，项目只在 `:3067`、`:3073`、`:3097` 读 —— 符合「字段只读、方法才写」 | 无 |
| A-15 | `game.GetUICanvasSize()` | API文档 §6(1) L192 | `:4703` | 正确 | 返回 `x, y: number`，项目按两返回值接 | 无 |
| A-16 | `game.ServerSignal` / `AddInt` / `AddString` / `SendSignal` | API文档 §9(2) L309-320、L215 | `:4532`、`:4549-4555` | 正确 | 方法名逐一核对一致（`AddBool` 见 L319，项目未用） | 无 |
| A-17 | `script:RegisterServerSignalHandler` | API文档 §5(2) L173 | `:4539`（能力探测）、`:4669`（注册） | 正确 | 回调签名 `(signalName, signalParams)` 与项目 `:4669-4671` 的 `function(signalName, params)` 一字不差 | 无 |
| A-18 | `script.object` | API文档 §5(1) L161「脚本所挂载的宿主对象」 | `:4720` | 正确（读取方式）；**用法有隐患** | 可能为 nil（项目已兜底）；一旦非空即被当作父级，直接触发 A-02 | 保留读取；按 A-02 决定它是否继续当 `parent` |
| A-19 | `game.GetClientUIControl(controlId)` | API文档 §6(1) L189 | `:4717`（注释）、`:4725`（调用）；注释称「参数是运行时ID（文档 L176）」 | 正确（API 本身）；**注释行号失效** | L189 原文确实是「按客户端控件运行时 ID 获取控件」，项目理解正确；但 `:4717` 引的「L176」在当前文档是 `UnregisterCustomVariableChangedHandler` | 见 E-03。另：`CONTAINER_NODE_INDEX` 是模板索引不是运行时 ID，`:4725` 那支兜底原则上取不到（死路），注释应说明 |
| A-20 | `game.InstantiateClientUIControl(prefab, parent)` | API文档 §6(1) L187 | `:1507`、`:1544`、`:1719`、`:4748` | 正确 | 参数 `(integer, ClientUIBaseControl)`，4 处调用均符合；返回值均判 nil | 无（`parent` 传 nil 与 `test.lua:154` 的 `script.object` 用法等价，不违约） |
| A-21 | `game.DestroyClientUIControl(control)` | API文档 §6(1) L188 | `:4881` | 正确 | — | 无 |
| A-22 | `game.PlayAudio2D` / `StopAudio` / `IsAudioAlive` | API文档 §6(4) L225-227 | `:2002`、`:1958-1962` | 正确 | 签名与返回值类型全对；项目对 `instId` 做 `type()=="number"` 判断、对 alive 做 boolean 判断，比文档更严 | 无 |
| A-23 | `Color.FromRGB` / `Color.FromRGBA` | API文档 §4(2) L146-147 | `:1499-1500`、`:1909` | 正确 | 0–255 分量，`a` 可省 | 无 |
| A-24 | `Enum.TextHorizontalAlignment` / `Enum.TextVerticalAlignment` | API文档 §11(14) L534-536、§11(15) L543-545 | 27 处（`:2136`、`:2137`、`:2292`、`:2403` 等） | 正确 | 只用 `Middle` 与 `Top`，均在枚举内 | 无 |
| A-25 | 文本框字段 `text`/`bgColor`/`fontColor`/`fontSize`/`enableOutline`/`outlineColor`/`horizontalAlignment`/`verticalAlignment` | API文档 §15(1) L842-851 | `:1518-1527` + 全文 30+ 处 | 正确 | 字段名逐个对上；`outline`/`outlineColor` 选项目前**无任何调用点传入**（死选项），不构成错误 | 无（可删死选项） |
| A-26 | 生命周期 7 个回调 | API文档 §1 L80-86 | `:4890`、`:4895`、`:4947`、`:4951`、`:5080`、`:5084`、`:5088` | 正确 | 7 个函数名逐字一致，`OnUpdate(dt)`/`OnLevelUpdate(dt)` 接 1 参；`OnDestroy` 里先 `EnableUpdate(false)` 再 `cleanup_all()`（`:5091-5092`），顺序合理 | 无 |
| A-27 | `OnUpdate(dt)` 的 dt 单位 | **文档未覆盖** | `:5033`、`:5049`（棋钟扣 dt）、`:5027`（`elapsedSec + dt`）、`:5074`（与 0.25 比较）、`:4980`（`math.isinf(dt)`） | **文档未覆盖** | 文档 L84 只写 `dt: number`，**未写单位**。项目全部按秒。若真机给毫秒则棋钟快 1000 倍、动画瞬间结束 | 见 U-03 |
| A-28 | `script:EnableUpdate(enabled)` | API文档 §2 L93、§5(2) L172 | `:4914`、`:4936`、`:5091` | 正确 | 语义与文档「`false` 关闭，`true` 重新启用」一致 | 无 |
| A-29 | Lua 环境限制 vs 实际用法 | API文档 §3 L54-70 | 全文：`print`/`printerr`/`debug.traceback`(`:445`)/`math.isnan`·`math.isinf`(`:4708`、`:4980`)/`string.*`/`table.*`/`setmetatable`(`:1632`、`:1642`)/无 `io.*`·`coroutine.*`·`os.*` | 正确 | 未触碰任何禁用库；`debug.traceback` 在白名单内（L64 只禁「除 traceback 外的 debug.*」） | 无 |
| A-30 | `ClientUIContainerControl.showCursor` **未设置** | API文档 §24(1) **L1031**「`CursorEvent`相关方法都需设置该参数为真后才可正常使用」 | 项目**从未写 `showCursor`**（全库 grep 0 处写入；`:4714-4721` 只拿容器当挂点） | **错误** | **全盘点击失效**。文档原文是前置条件（「都需…后才可正常使用」）。棋盘 64 格 + 全部面板/弹窗按钮都靠 `AddCursorEventListener`，容器不置 `showCursor=true` 时整条光标事件链可能完全不工作 —— **比任何坐标问题都更严重**。注：项目 `docs/沙箱能力清单.md:42`、`:68` 曾记下这条对策，但**从未落地进代码** | 见 E-01 |
| A-31 | 代码注释里的 API 文档行号引用 | — | `:53`「API 文档 L516-527」、`:77`「L813 / L792」、`:4717`「文档 L176」、`:4922`/`:4965`「L424-435」 | **错误** | 引用的行号与当前权威文档**全部不符**。后果是维护者按注释查文档会查到无关内容 —— **A-30 就是这么漏掉的** | 见 E-03 |

**错误：3 条**（A-02 布局坐标域、A-30 `showCursor`、A-31 注释行号失效）。
**文档未覆盖：4 组**（A-03/A-04/A-05 → U-01；A-11 → U-04；A-12 → U-02；A-27 → U-03；另加 U-05）。

---

## 二、错误明细

### E-01（A-30）容器节点未设置 `showCursor`，光标事件链缺前置条件

**文档原文**（API文档 §24(1) L1031，逐字）：

> | `showCursor` | `boolean` | 读写 | 是否显示常驻光标；`CursorEvent`相关方法都需设置该参数为真后才可正常使用 |

同节 L1028-1030 给出容器节点的另三个字段（`isolateNavigation` / `disableKeyEventPassthrough` / `disableCursorEventPassthrough`），**其中只有 `showCursor` 被附加了「必须先为真」的条件** —— 说明它是 CursorEvent 的开关，不是可选项。

**项目代码**：全文件无任何 `showCursor` 写入点（grep 命中 0 处）。容器挂载在 `read_container`：

```lua
-- L4713-4731
local function read_container()
  -- 【为什么用 script.object】…
  local ok, host = pcall(function() return script.object end)   -- L4720
  if ok and host ~= nil then
    return host
  end
```

随后 `L4748: UI.host = host`，所有 `create_cursor_area` 都把命中区建在 `UI.host` 下（`:1544`）。

**为什么错**：文档用「都需…后才可正常使用」描述 `showCursor` 与 CursorEvent 全部方法的关系，是**前置条件**。项目依赖 CursorEvent 的路径覆盖全部交互：

| 交互 | 行号 |
|---|---|
| 棋盘 64 格 | `:2215-2218` |
| 面板 4 按钮 | `:2483-2486` |
| 复盘 5 键 | `:2525-2528`、`:2548-2551` |
| 音效键 | `:2577-2580` |
| 结算 2 键 | `:2651-2654`、`:2663-2666` |
| 升变 4 键 | `:2701-2704` |
| 确认 2 键 | `:2770-2775` |

缺这一步，`AddCursorEventListener` 整条链可能不生效。**这是「文档里已经写了、代码却没做」的典型**，而它之所以被漏掉，正是 E-03 的注释行号失效让维护者查不到 L1031。

**改法（可执行）** —— 在 `:4744` `local host, hostErr = read_container()` 之后、`:4748` `UI.host = host` 之前插入：

```lua
  -- API文档 L1031：CursorEvent 相关方法都需 showCursor 为真后才可正常使用。
  -- 未实现该字段的环境（体外沙箱）会抛错，pcall 吞掉即可，不阻断启动。
  if host ~= nil then
    pcall(function() host.showCursor = true end)
    local sok, sv = pcall(function() return host.showCursor end)
    log_once("showcursor", "容器 showCursor 读回=%s（读取成功=%s）", tostring(sv), tostring(sok))
  end
```

`log_once` 已存在于 `:428`，直接可用。那句读回日志是给真机首测用的：一眼看出「字段到底写进去了没有」。

---

### E-02（A-02）`SetAnchoredPosition` 在「有父级」时是父级中心偏移，项目按画布左下使用

**文档原文**（API文档 §13(3) L737-738，逐字）：

> | `GetAnchoredPosition()` | `x`, `y` | 无父层级时，以画布左下为原点获取位置；存在父层级时，获取与父层级中心的相对偏移。 |
> | `SetAnchoredPosition(x, y)` | — | 无父层级时，以画布左下为原点设置位置；存在父层级时，设置与父层级中心的相对偏移。 |

同节对 pivot 的说明只有一句（L708）：

> | `pivotX`, `pivotY` | `number` | 读写 | 中心、`Tweenable` |

L745-746：「`GetPivot()` 获取中心 / `SetPivot(x, y)` 设置中心」。

**关键事实**：文档给 `SetAnchoredPosition` 定义了**恰好两个分支**，**没有任何一句把 pivot 写进这个换算**。所以「pivot=0 等价于左下角坐标」这条语义，在**无父级**时是因为 pivot=0 恰好与「画布左下为原点」重合才成立；在**有父级**时它与文档直接冲突。

**项目代码**：

- 挂载点被显式设为父级：
  ```
  L4744:   local host, hostErr = read_container()
  L4748:   UI.host = host   -- 可能为 nil，create_* 会原样传给 InstantiateClientUIControl
  ```
  `:1507`、`:1544`、`:1719` 均以 `opts.parent`（= `UI.host`）作 `parent` 实参。

- 全部坐标按「画布左下为原点」的绝对像素生成：
  ```
  L1487:   return L.boardLeft + file * L.cell, L.boardBottom + rank * L.cell
  L1430:   local boardSide = canvasH * CONFIG.BOARD_SIDE_RATIO
  L2079:   local bx, by = L.boardLeft, L.boardBottom
  L2600:   x = 0, y = 0, w = L.canvasW, h = L.canvasH,     -- 全屏遮罩
  ```

- 项目把这条假设写进了 `docs/锚定配置表.md:29-32`：
  > 中心点 (0,0) 位置从元素左下角起算；位置语义 画布左下角为原点 … **无父级时；本项目全部元素直接挂容器节点，无父级**

  「直接挂容器节点」与「无父级」两句自相矛盾 —— 容器节点本身就是父级控件（API文档 §24）。

**为什么错**：`test.lua` 同样用 `script.object` 当宿主（`test.lua:154`），但它的布局从不依赖绝对画布坐标 —— 要么「锚点拉伸 + `SetSizeDelta(0,0)`」（`test.lua:165-169`、`:247-250`），要么「锚定中心 + `SetAnchoredPosition(0,0)`」（`test.lua:177-179`）。本项目走绝对坐标路线，在父级坐标域里 `x=449, y=99` 会变成「相对容器中心右移 449、上移 99」，1600×900 的整块界面直接被推出可视区。

**改法（三条路线，选一条，全项目统一）**

#### 路线①（推荐，改动最小）—— 让「无父级」成立，坐标公式一行不改

```lua
-- :4748 改为
UI.host = nil            -- 顶层挂载：SetAnchoredPosition 走「画布左下为原点」分支（API文档 L738）
```

`create_*` 里 `parent = nil` 合法（API文档 L187 未禁止 parent 为空；`test.lua:154-155` 也做了 `if not host then` 兜底）。此时 E-01 的 `showCursor` 改为挂到根容器：

```lua
  -- E-01 改写：showCursor 是容器节点字段，需拿到容器本体
  local roots = nil
  pcall(function() roots = game.GetClientUIRoots() end)      -- API文档 L191
  if roots ~= nil and roots[1] ~= nil then
    pcall(function() roots[1].showCursor = true end)
  end
```

> 代价：路线① 会失去容器的 `disableCursorEventPassthrough` / `isolateNavigation` 屏蔽能力。本项目全屏自绘、没有「点穿到 3D 场景」的需求时无影响；若在意，走路线②。

#### 路线②—— 保留父级，在工厂里做一次坐标折算

```lua
-- build_all_ui 内，UI.host = host 之后
UI.hostCenter = { x = 0, y = 0 }
if host ~= nil then
  local hx, hy = 0, 0
  pcall(function() hx, hy = host:GetSizeDelta() end)         -- API文档 L739
  local ax, ay = 0, 0
  pcall(function() ax, ay = host:GetAnchorMin() end)         -- API文档 L741
  local px, py = 0.5, 0.5
  pcall(function() px, py = host:GetPivot() end)             -- API文档 L745
  UI.hostCenter.x = ax * w + hx * (0.5 - px)
  UI.hostCenter.y = ay * h + hy * (0.5 - py)
end
```

再把**全部 20 处** `SetAnchoredPosition` 改为传 `x - UI.hostCenter.x, y - UI.hostCenter.y`。清单（当前行号；行号会漂移，请按片段 grep）：

| # | 行号 | 片段 | 所属 |
|---|---|---|---|
| 1 | 1515 | `ctrl:SetAnchoredPosition(opts.x, opts.y)` | `create_text` |
| 2 | 1550 | `ctrl:SetAnchoredPosition(opts.x, opts.y)` | `create_cursor_area` |
| 3 | 1726 | `ctrl:SetAnchoredPosition(opts.x, opts.y)` | `create_image` |
| 4 | 3069 | `UI.selHL:SetAnchoredPosition(` | `anim_update_hilites` |
| 5 | 3075 | `UI.selRingTop:SetAnchoredPosition(` | 同上 |
| 6 | 3079 | `UI.selRingBot:SetAnchoredPosition(` | 同上 |
| 7 | 3099 | `c:SetAnchoredPosition(b.x, b.y)` | 同上（落点脉动） |
| 8 | 3122 | `UI.lastMoveHL[1]:SetAnchoredPosition(x1, y1)` | `show_last_move` |
| 9 | 3123 | `UI.lastMoveHL[2]:SetAnchoredPosition(x2, y2)` | `show_last_move` |
| 10 | 3146 | `UI.checkHL:SetAnchoredPosition(x, y)` | `show_check_warning` |
| 11 | 4206 | `UI.selHL:SetAnchoredPosition(x, y)` | `select_square` |
| 12 | 4211 | `UI.selRingTop:SetAnchoredPosition(` | `select_square` |
| 13 | 4214 | `UI.selRingBot:SetAnchoredPosition(x, y)` | `select_square` |
| 14 | 4243 | `c:SetAnchoredPosition(cx, cy)` | `select_square`（可吃子） |
| 15 | 4250 | `c:SetAnchoredPosition(cx, cy)` | `select_square`（空格点） |
| 16-20 | 3277 / 3286 / 3303 / 3312 / 3328 | `c:SetAnchoredPosition(ox + s[2] * sside, oy + s[3] * sside)` | `paint_slot` 五个绘制层 |

#### 路线③—— 若真机实测证明「容器节点当父级时仍按画布左下」

则无需改代码，但必须把证据补进 `docs/锚定配置表.md:30`（实测环境、画布尺寸、控件 `GetAnchoredPosition()` 读回值），并把 `docs/tech-architecture.md:616-617` 那段改成「实测要点」。**在拿到该实测证据之前，本审计按文档字面判定为错误。**

**验证方式**：改完任一路线后跑 `qxqy_studio_play action=start` + `action=get{inspect:true}`，读第一个棋盘格控件的 `anchoredPositionX/Y`，与 `LAYOUT.square_pos(L, 0)` 的期望值比对，两者一致即路线成立。

---

### E-03（A-31）代码注释里的 API 文档行号全部失效

| 位置 | 现注释 | 该行号在权威文档里的**真实内容** | 应改成 |
|---|---|---|---|
| `:53` | 「图片来源枚举名（见 API 文档 L516-527）」 | L516-527 = `Enum.ControllerNavigationEventType` / `Enum.ControllerNavigationMode` | `§11(17) L556-567（Enum.ImageSource）` |
| `:77` | 「`raycastTarget` 是 API 文档 L813（光标检测区域）/ L792（预设按钮）声明的字段」 | L813 = `fillHorizontalType`；L792 = `## 14.ClientUIImageControl` 标题 | `§18(1) L908（光标检测区域）/ §17(1) L886（预设按钮）` |
| `:4717` | 「`game.GetClientUIControl(controlId)` 的参数是**运行时 ID**（文档 L176）」 | L176 = `script:UnregisterCustomVariableChangedHandler` | `§6(1) L189` |
| `:4922`、`:4965` | 「API 文档 L424-435」 | L424-435 = `Enum.LanguageType` 尾部 / `Enum.ParamType` 头部 | `§11(7) L454-465（Enum.CursorEventType）` |

**影响**：不是运行时缺陷，但它是 **E-01 的直接成因** —— 维护者按失效行号查文档会查到无关内容，自然查不到 L1031 那句 `showCursor` 前置条件。

**改法**：按上表逐条替换（4 行注释、5 处文本）。顺带把 `:80` 那句「`raycastTarget` … 真机上必须设它才能接收光标事件」补上「且容器节点须 `showCursor=true`（L1031）」，并把 `:4717` 那段对 `CONTAINER_NODE_INDEX` 的辨析补一句「它是模板索引，`GetClientUIControl` 要的是运行时 ID，这支兜底原则上取不到」。

---

## 三、文档未覆盖

以下接口/语义在 `千星井字棋资料/客户端控件API文档.md` 中找不到依据。已按要求核查过具体章节与关键词，逐条注明查了哪里。

### U-01（A-03/A-04/A-05）`pivot` 与 `SetAnchoredPosition` 的耦合关系

- **查过的章节**：§13(1) 字段表 L692-711；§13(3) 布局与变换 L731-751；§13 全节；全库关键词 `SetPivot` / `GetPivot` / `pivotX` / `pivotY` / `AnchoredPosition` / `中心`；官方样例 `test.lua` 全文。
- **文档里有的**：`pivotX/pivotY` 说明为「中心」（L708）；`SetAnchoredPosition` 只有「无父级=画布左下 / 有父级=父级中心」两分支（L737-738）。
- **文档里没有的**：pivot 如何影响 `anchoredPosition`；pivot=0 是否等价于「控件左下角对齐到 anchoredPosition」；pivot=0.5 是否等价于「控件中心对齐到 anchoredPosition」。
- **项目依赖**：`:1511`（pivot=0 传左下角）、`:1722`（pivot=0.5 传中心）、`:4237` 的 `cx = tx + L.cell*0.5` 补半格、`:3069-3070` 的 `-(side - L.cell)/2` 补偿。
- **能佐证的旁证（非文档依据）**：
  - `records/playtest.md:52-54`：F-1「`create_image` 建控时 pivot=(0,0) 但图元按中心算位置 → 整体右上偏移」。
  - `docs/项目状态记录.md:817-818`、`records/playtest.md:637`：issue #1 第 1 条「图片控件 pivot=0.5 按中心定位，喂左下角坐标会偏左下」。
  - 这些是项目自身的**模拟器实测**结论，可采信为运行时事实，**但不能替代 E-02 对「有父级」的处理 —— 两者是正交问题**。
- **结论**：判「文档未覆盖」，不计错误。若该实测结论成立，则 A-05/A-06 在**无父级前提**下是对的；一旦按 E-02 路线② 保留父级，补半格换算必须重新推一遍。

### U-02（A-12）`SetLocalRotation` 的参数单位与正方向

- **查过的章节**：§13(1) L710（`localRotationX/Y/Z`：「旋转、`Tweenable`」）；§13(3) L749-750（`GetLocalRotation()` / `SetLocalRotation(x, y, z)`：「设置旋转」）；§11 全部枚举（无 `RotationUnit` 之类）；`test.lua` 全文（未使用旋转）。
- **文档里有的**：方法存在、字段存在。
- **文档里没有的**：单位（度 or 弧度）、正方向（顺/逆时针）、绕哪个点旋转（可推断是 pivot，但文档没写）。
- **项目依赖**：`:1707` `SetLocalRotation(0, 0, r)`，`r` 取自 `PIECE_ART` 表的「度，逆时针为正」（`:717` 注释、`:1660` 说明）。`:1702-1706` 那段「必须无条件写旋转，否则槽位复用会残留上一枚棋子的角度」的推理与文档无冲突。
- **结论**：判「文档未覆盖」。建议真机首测先做探针：建一个 100×100 图片控件，`SetLocalRotation(0,0,90)` 后截图 —— 转了 90° 说明是度，只转 1.57° 说明是弧度。

### U-03（A-27）`OnUpdate(dt)` 的时间单位

- **查过的章节**：§1 脚本生命周期 L74-87；§2 逐帧控制 L89-93；§7/§8 Tween 相关（`AppendInterval(interval: number)` 的「秒数」见 L278，但那是 Tween 参数，不是 dt）。
- **文档里有的**：`OnUpdate(dt)` 的 `dt: number`，以及「不受关卡时停影响」（L84）。
- **文档里没有的**：`dt` 的单位。
- **项目依赖**：`:5027` `GAME.elapsedSec = GAME.elapsedSec + dt`；`:5033`/`:5049` 棋钟扣 `dt`；`:5074` 与 `CONFIG.CLOCK_REFRESH_SEC = 0.25`（秒）比较；`:4980` `math.isinf(dt)` 校验。全部按**秒**。
- **结论**：判「文档未覆盖」。自洽性来自「与 `CONFIG.ANIM` 的秒值一致」，但缺文档背书，属**真机首测必验项**（打印一帧 `dt` 即可）。

### U-04（A-11）`AddCursorEventListener` 回调的返回值语义

- **查过的章节**：§17(2) L889-897（预设按钮）；§18(2) L911-919（光标检测区域）；§19 CursorEventData L922-939；§13(5) 键鼠/手柄按键事件 L764-771。
- **文档里有的**：**键事件** `AddKeyEventListener(eventType, callback)` 的回调「返回 `boolean`」（L768），并说明「标记为已处理」的语义。
- **文档里没有的**：**光标事件** `AddCursorEventListener` 的回调返回值语义（L893/L915 只写「回调接收 `CursorEventData`」）。
- **项目依赖**：`:4350-4353`
  ```lua
  ctrl:AddCursorEventListener(CLICK_EVENT, function(data)
    local handled = fn()
    return handled ~= false
  end)
  ```
- **结论**：判「文档未覆盖」。项目把**键事件**那套「返回 true = 已处理」的做法搬到了光标事件上，属于**跨节类推**。风险很低（最多被忽略），若要与文档严格一致，建议改成不返回值。

### U-05 `showCursor` 的生效范围是否覆盖「容器节点的子控件」

- **查过的章节**：§24(1) L1024-1031（容器节点字段表）；§18 光标检测区域；`容器节点控件` 官方文档（经 `get_client_document` 取到，其「功能设置」只写「显示常驻光标：使光标常驻显示」，未提子控件继承关系）。
- **文档里有的**：`showCursor` 说明「`CursorEvent`相关方法都需设置该参数为真后才可正常使用」（L1031）。
- **文档里没有的**：是「每个声明了 CursorEvent 的控件都要设」还是「设容器节点一处即可覆盖其子树」。
- **对项目的影响**：`levelScript.lua` 的命中区全是容器节点的**子控件**（`parent = UI.host`），这条直接决定 E-01 的修法要不要「逐个控件设」。目前按文档字面（`showCursor` 只出现在 §24 容器节点字段表）采用「设容器节点」这一解读。
- **结论**：判「文档未覆盖」，但与 E-01 的修法方向一致，不影响执行。

---

## 四、已核对无问题清单

### 任务书 12 个审查点

| # | 审查点 | 结论 | 依据 |
|---|---|---|---|
| 1 | `game.InstantiateClientUIControl(prefab, parent)` 参数类型与返回值 | **正确** | §6(1) L187 签名 `(controlPrefabIndex: integer, parent: ClientUIBaseControl) -> ClientUIBaseControl`；4 处调用（`:1507`/`:1544`/`:1719`/`:4748`）都是「整数模板索引 + 控件或 nil」，返回后一律判 nil。与 `test.lua:95`、`:162` 同构 |
| 2 | `game.GetClientUIControl` / `script.object` 身份语义 | **正确** | `script.object` = 「脚本所挂载的宿主对象」（L161），`:4720` 读取方式对；`GetClientUIControl(controlId)` = 「按运行时 ID 获取」（L189），`:4717-4718` 对「运行时 ID ≠ 模板索引」的辨析也对。**仅注释行号失效（E-03）** |
| 3 | 工厂四步顺序 + pivot/位置语义 | 顺序**正确**；pivot 语义**见 E-02、U-01** | 顺序 `SetPivot→SetAnchorMin/Max→SetSizeDelta→SetAnchoredPosition`（`:1511-1515` 等）：先定 pivot 与锚点再落位。与 `test.lua:51-55` 的 `setFixedLayout` 顺序（先 AnchorMin/Max 再 SetPivot）表述不同，但两者都保证「落位前 pivot/锚点已定」，无实质差异 |
| 4 | 图片字段 `SetImage`/`imageType`/`imageColor`/`Enum.ImageType`/`ImageSource` | **正确** | `SetImage(imageSource, imageId)`（L824）—— `:1678` `ctrl:SetImage(src, asset)` 顺序一致；`imageType`（L803）枚举 `Basic`/`Stretch`（L548-553）—— `:1569`/`:1571` 取 `Stretch`、`Basic` 当回退，均在文档内；`imageColor`（L802）；`Enum.ImageSource.StaticReference`（L560）。**项目没有 `game.SetImage` 这种写法，用的就是控件方法，正确** |
| 5 | 文本框 9 个字段 | **正确** | `text`(L842)/`fontSize`(L843)/`fontColor`(L844)/`bgColor`(L845)/`enableOutline`(L846)/`outlineColor`(L847)/`horizontalAlignment`(L848)/`verticalAlignment`(L849)，字段名逐字对上。`raycastTarget` 不属于文本框（见 #6） |
| 6 | 光标检测区域 `raycastTarget`/`AddCursorEventListener`/枚举名/回调签名 | **正确**（另有 E-01 前置条件缺失） | `raycastTarget`（L908）：`:1555` 写 true、`:1533` 主动置 false；`AddCursorEventListener`（L915）：`:4350`；枚举 `CursorClick`（L465）：`:4325` 优先取它；回调形参 `CursorEventData`（L893/L915），项目回调**不读字段**。`docs/沙箱能力清单.md:39` 记录的「沙箱回调只有 `data.x/data.y`，不要调 `GetUIPos`」也印证了「不读坐标」这条设计 |
| 7 | `SetLocalRotation`/`SetAsLastSibling`/`SetActive`/`active`/`visible` 区别 | **正确**（`SetLocalRotation` 单位见 U-02） | `SetLocalRotation(x,y,z)` L750 存在；`SetAsLastSibling()` L728 存在且语义「移到同级末位」；`SetActive`（L723，改激活状态、停脚本）/`SetVisible`（L724，只改可见性）/`active`（L699，**只读**）/`visible`（L701，**只读**）。`:2790-2805` 两者并用、`:3067`/`:3073`/`:3097` 只读不写，**完全符合「字段只读、方法才写」** |
| 8 | `GetUICanvasSize`/`ServerSignal`/`AddInt`/`AddString`/`AddBool`/`SendSignal`/`RegisterServerSignalHandler` | **正确** | 逐项：`GetUICanvasSize` L192；`ServerSignal(name)` L215；`AddInt` L311；`AddString` L315；`AddBool` L319；`SendSignal` L310；`RegisterServerSignalHandler(name, cb(name, params))` L173 —— `:4669` 的 `function(signalName, params)` 形参顺序与文档一字不差 |
| 9 | `game.PlayAudio2D` / `StopAudio` / `IsAudioAlive` | **正确** | L225/L226/L227，返回值 `integer`/—/`boolean`；`:2002` 接返回值判 `type(instId)=="number"`、`:1959` 接 boolean，类型处理比文档更严 |
| 10 | `Color.FromRGB` / `Color.FromRGBA` / 两个对齐枚举 | **正确** | L146/L147（0–255、`a` 可省）；`Enum.TextHorizontalAlignment.Left/Middle/Right` L534-536；`Enum.TextVerticalAlignment.Top/Middle/Bottom` L543-545。项目只用 `Middle`/`Top`，均在枚举内 |
| 11 | 生命周期函数名与签名 | **正确** | 7 个全中（A-26）；`OnUpdate(dt)`/`OnLevelUpdate(dt)` 单参数；`OnDestroy` 里 `script:EnableUpdate(false)` 再 `cleanup_all()`（`:5091-5092`），顺序合理 |
| 12 | Lua 环境限制与实际用法 | **正确** | §3 L54-70 禁用 `string.dump`/`io.*`/`coroutine.*`/大部分 `os.*`/大部分 `debug.*`。全文件 grep：无 `require`/`dofile`/`loadstring`/`io.`/`coroutine.`/`os.` 任何调用；`debug.traceback`（`:445`）在白名单内；`setmetatable`+`__mode="k"`（`:1632`/`:1642`）是标准库、不在禁用清单；`math.isnan`/`math.isinf` 是文档额外补充的方法（L68-70），项目 `:4708`/`:4980` 正是用在做有限数校验的推荐场景 |

### 额外核对项（实际用到、任务书未列）

| # | 检查项 | 结论 | 依据 |
|---|---|---|---|
| 13 | `game.DestroyClientUIControl` 用于 `OnDestroy` 反向清理 | **正确** | L188；`:4881` 包 pcall 逐个销毁，`FACTORY.cleanup` 反序遍历 `:4878` |
| 14 | `script:EnableUpdate` 三处使用 | **正确** | L93/L172；`:4914`（界面未就绪开逐帧）、`:4936`（就绪后保持）、`:5091`（销毁时关）—— 与「`false` 关闭，`true` 重新启用」一致 |
| 15 | `AddCursorEventListener` 成对注销 | **正确** | `RemoveCursorEventListeners(eventType)` L895/L917 存在；`:4872` 在 cleanup 里按 `CLICK_EVENT` 注销，用「移除该事件全部监听」而非依赖回调引用同一性，规避了 L894「回调必须与注册时引用相同」的坑 |
| 16 | `pivotX/pivotY` 等可写字段是否被误用 | **正确** | 文档给了 `anchoredPositionX/Y`、`sizeDeltaX/Y`、`anchorMinX…`、`pivotX/Y`、`localScaleX…`、`localRotationX…`（L704-710）一整套**读写**字段，项目**一个都没用**，全部走 `Set*` 方法 —— 更稳，且避开了「字段与 Setter 是否等价」的未定义问题 |
| 17 | `active` 只读 vs 是否存在 `ctrl.active = ...` | **正确** | 全文无 `active =` 赋值（只有 `SetActive`）；`:3067`/`:3073`/`:3097` 仅读取 |
| 18 | 全屏遮罩尺寸取 `canvasW/canvasH` | **正确** | `:2594`、`:2598`、`:2726` 用 `LAYOUT.compute` 的画布尺寸，与 `game.GetUICanvasSize()`（`:4703`）同源 |
| 19 | `Enum.ImageSource` 回退取 `Prefab` | **正确** | `Prefab` 在 L567 枚举内；`:1571` 作为 `StaticReference` 取不到时的回退，两者都是合法枚举值 |
| 20 | 沙箱/真机差异开关 `ENABLE_RAYCAST_FIELD` | **正确（写法安全）** | `:1532-1535`/`:1554-1556`/`:1730-1732` 全部 `pcall` 包裹 —— 文档未规定「未实现字段的读写行为」，用 pcall 规避而不是条件分支丢弃字段，方向正确 |

---

## 五、修复优先级（给 Lead）

| 优先级 | 编号 | 一句话 | 改动量 |
|---|---|---|---|
| **P0** | E-01（A-30） | 容器节点必须 `showCursor = true`（API文档 L1031），否则 CursorEvent 整条链可能不工作 | 插入 6~8 行（`:4744` 后） |
| **P0** | E-02（A-02） | `SetAnchoredPosition` 有父级时是父级中心偏移（L738），项目按画布左下用，整块界面会偏移 | 路线① 改 1 行；路线② 改 1 处 + 20 处调用点 |
| P1 | E-03（A-31） | 注释里 4 组 API 文档行号全部失效，正是 E-01 被漏掉的原因 | 纯注释，5 处 |
| P2 | U-02 / U-03 | `SetLocalRotation` 单位、`OnUpdate` 的 dt 单位，文档未覆盖 | 各加一次实测探针 + 注释 |
| P2 | U-04 | 光标事件回调返回值语义文档未写（键事件才有） | 可选，去返回值 1 行 |
| — | U-01 / U-05 | pivot 与 anchoredPosition 的耦合关系、`showCursor` 生效范围，文档未覆盖 | 建议把实测结论补进 `docs/锚定配置表.md` 与 `docs/tech-architecture.md` |

> **验证提醒**：E-01 与 E-02 必须在同一轮修完后**重新跑一次模拟器试玩**（`qxqy_studio_play start` → 点一格棋子 → 点一个落点 → `get{inspect:true}` 读 `anchoredPositionX/Y`），否则无法区分「坐标修对了但点击没通」和「点击通了但坐标还是错」。
>
> **模拟器通过 ≠ 真机通过**：`docs/项目状态记录.md:834-838` 自述「真机未跑：1367 个控件是否超容量、音色如何、三档画布布局全部未验」。本报告的所有结论同样只到「文档一致性」这一层，`on-device` 仍需实机确认。
