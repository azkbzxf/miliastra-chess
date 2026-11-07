# 国际象棋 · GitHub issue #3 用例（TDD）

> 关联 issue：**#3「选中棋子后，落点绿点散落在棋子走不到的地方」**
> 观测运行时：`runtime=simulator`（千星 UI 模拟器 / `qxqy_studio_play`）。
> **模拟器绿灯不等于真机通过。**
> 修复版本：v1.12 · 2026-11-05

---

## 1. 症状与根因

### 1.1 用户看到的

选中一匹马，本该只在它 8 个「日」字落点上出现绿点，但盘面上**同时出现了一些它根本走不到的绿点**
（issue #3 截图里 d4 白马周围那圈散落的绿点）。点那些绿点没有反应。

### 1.2 根因（`select_square` 未先清空落点池）

落点高亮是**按索引复用的固定池**（`UI.legalHL[1..28]`，28 个图片控件，播放期零创建）。

修复前的写法是：

```lua
for to, _ in pairs(targets) do
  idx = idx + 1
  ...
  ui_set_active(c, true)      -- 只把「本次用到的前 idx 个」打开
end
UI.legalHLUsed = idx          -- 只是把计数器改成本次的数量
```

**问题在于它从不关闭上一次打开的那些**。池子是复用的：

| 步骤 | 动作 | 池状态 |
|---|---|---|
| ① | 选中一个有 8 个落点的子 | `legalhl1..8` = **全部 `active=true`** |
| ② | 改选一个有 2 个落点的子 | 只重写 `legalhl1..2`；**`legalhl3..8` 原样留着，仍然 `active=true`** |

于是「本次的 2 个绿点」+「上次剩的 6 个绿点」同时显示。
那 6 个残留绿点指向的格子这枚棋子走不到 —— 点下去 `try_move` 会校验 `legalTargets` 并拒绝，
手感就从「这里不能走」变成「点了没反应」。

而 `clear_highlights()`（取消选中 / 走子 / 新开局 / 退出复盘时调）**是对的**，它会把 28 个全关掉。
所以这个 bug 只在**「直接从一个子改选另一个子」**这条路径上出现 —— 平移/走子后都不会触发，
这也解释了为什么它躲过了前面几轮验证。

### 1.3 修法

把「清空落点池」抽成 `hide_legal_pool()`，`clear_highlights()` 与 `select_square()` **共用同一段逻辑**：

```lua
local function hide_legal_pool()
  for i = 1, 28 do
    if UI.legalHL[i] then ui_set_active(UI.legalHL[i], false) end
  end
  UI.legalHLUsed = 0
  ANIM.hlBase = {}
end
```

`select_square()` 在写完 `GAME.selected / legalTargets / legalMoves` 之后、绘制新落点之前调用它。

> **为什么抽函数而不是在 `select_square` 里抄一遍循环**：两处必须永远一致，
> 抄一遍迟早漂移成两个版本 —— 这个 bug 本身就是「同一件事做了两遍、漏了一处」的产物。

---

## 2. 用例（可直接喂 runCase）

坐标基准见 [issue-1-cases.md](issue-1-cases.md) §0.1（`cell=87.75 / boardLeft=449 / boardBottom=99`，
格中心 = `boardLeft + file*cell + cell/2`）。
**每条点击一律从 `t>=0.1` 起**，否则会被 `at=0` 的断言污染。

### I3-01 · 落点池不残留（核心回归）

**前置**：本地同屏模式（`btnlocal` 中心 `1508.5, 240.8` → 确认框「确定」`638.1, 379.4`）。

| 项 | 内容 |
|---|---|
| 意图 | 先选中落点多的子，再改选落点少的子，**多余的绿点必须消失** |
| 操作 | ① 切同屏；② e2→e4；③ f2→f4；④ g1f3（马）；⑤ h2→h4；⑥ **选 h5 后** |
| 判据 | `legalhl1/2` = `true`；**`legalhl3` / `legalhl5` / `legalhl8` = `false`** |
| Red 现象 | `legalhl3` 仍为 `true`（残留上一次的绿点） |
| Green 判据 | 上述 6 条断言全部通过 |

**实跑记录**

```
用例名 issue3-GREEN-regression            → passed
  legalhl1 = true   legalhl2 = true
  legalhl3 = false  legalhl5 = false  legalhl8 = false
```

**Red 证据（把 `hide_legal_pool()` 临时注释掉后同一用例）**

```
用例名 issue3-RED-proof                   → FAILED at 5.4
  legalhl3: expected false, actual true   ← bug 复现
```

> 这条用例的价值在于**它能真的变红**。修复前我尝试过几组用例，都因为初始局面里
> 没有任何棋子有 3 个以上落点而无法区分（马只有 2 个目标，改了也看不出来）。
> 最终这组先走 5 手把白后送到 h5（落点 ≥8 个），再改选 a2 兵（2 个目标），
> 才让「残留」有可观测的空间。

### I3-02 · 空池不误伤

| 项 | 内容 |
|---|---|
| 意图 | 清空落在空池上时不能崩（`UI.legalHL[i]` 在 `PREFAB_IMAGE==0` 时是 `nil`） |
| 判据 | 启动日志无 `mountError`；`ui_set_active(nil, ...)` 直接 return |
| 实跑 | ✅ 启动完成，无错误 |

### I3-03 · 功能回归（修复不改变正常行为）

| 项 | 内容 |
|---|---|
| 判据 | 选中后 `hint` = 「已选中 · 点亮的格子都能走」；走子后 `panelturn` 正确切换 |
| 实跑 | ✅ `issue3-GREEN-regression` 内已含 hint 断言并通过 |

### I3-04 · 总门禁用例（本轮最终验收）

```
用例名 issue3-FINAL-verify   →  passed（8/8 断言）
  log     contains "启动完成"                          ✓
  log     contains "showCursor"                        ✓   ← 新 P0 修复生效
  hint    = "已选中 · 点亮的格子都能走"                  ✓
  legalhl1 = true    legalhl2 = true                    ✓
  legalhl3 = false   legalhl5 = false   legalhl8 = false ✓  ← issue #3 修复
```

**手机画布（`mobile-16-9` 1280×720）本轮未跑通完整用例。**
启动与布局正常（`格宽 70.2`、`showCursor` 两条日志都出现），
但 `runCase` 的 `canvasId` 参数不像 `device` 动作那样真正切换画布
（在 `canvasId` 里指定的坐标仍按 1600×900 解释），
用 PC 坐标去点手机画布会落到别的格上。
**结论：手机画布需用 `device` 动作切换后再逐条手点验证，本轮未做。**

> 说明：`hide_legal_pool()` 与画布尺寸无关（纯状态清空 + 28 个 `SetActive(false)`），
> 所以手机档的「残留绿点」不可能因为画布不同而复发；但**布局与点选**仍需真机/手机画布各验一次。

---

## 3. 本轮同批修的另一个缺陷（不在 issue #3 范围，但同属「点击」链路）

### 容器节点 `showCursor` 从未设置（API 文档 §24(1) L1031）

**文档原文**：

> `showCursor`：是否显示常驻光标；**`CursorEvent` 相关方法都需设置该参数为真后才可正常使用**

本项目全部交互都走 `AddCursorEventListener`（64 个棋盘格 + 面板按钮 + 弹窗按钮）。
容器这一项没开，真机上这些监听**完全不触发**，表现是「画面好好的，但点哪都没反应」，
而且**不会报错**。

**为什么一直没发现**：体外沙箱没有实现该字段（`docs/沙箱能力清单.md` 第二节早就记过），
模拟器里点击照常可用 —— **模拟器全绿证明不了真机可用**。
`docs/沙箱能力清单.md` §四.4 甚至已经写下了对策「用 `~= nil` 探测」，只是从未落地进代码。

**修法**：`build_all_ui` 里新增 `enable_show_cursor()`，对 `script.object` 与
`game.GetClientUIRoots()[1]` 各设一次，全部 pcall + 读回日志（区分「写失败」与「字段不存在」）。

**模拟器实跑**：

```
[Chess] 容器 showCursor=true 已生效（script.object）
[Chess] 容器 showCursor=true 已生效（GetClientUIRoots[1]）
```

> ⚠️ 模拟器认这个字段 ≠ 真机认。**真机首测必查**：进游戏后点棋盘，看是否有反应。

---

## 4. 未验证项

| 项 | 原因 |
|---|---|
| 真机 `showCursor` 是否真能让点击生效 | 只有真机能验；模拟器这一项过了不代表真机过 |
| 真机 `SetAnchoredPosition` 是否按画布左下解释 | 见 `docs/锚定配置表.md` §一末的实测表；模拟器已证，真机未证 |
| 真机 `SetLocalRotation` 角度单位 | 文档未给单位与轴心（`docs/api-audit.md` U-02） |
| 真机 `OnUpdate(dt)` 的 dt 单位 | 文档未写（`docs/api-audit.md` U-03），项目按秒用 |
