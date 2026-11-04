# 上架 GitHub · 逐步操作指南

> 目标：把 `D:\输出目录\国际象棋` 变成 GitHub 上的一个公开仓库。
> 本指南里的**所有文件数、体积、忽略规则都是实测的**（2026-11 核对，方法见附录 A），不是估算。
> 命令给了 **MSYS bash** 和 **PowerShell** 两版，按你平时用的终端挑一版照抄。

---

## 零、先读这一节：三个已修复 / 一个仍待处理的点

这一节记录我在上架前核对仓库时发现的问题，**状态逐条如实标注**。
其中「问题 1 的遗留项」是**上架前唯一还需要人来决定的事**。

在 `git init` 之前，请先看这两条。它们不影响能不能推上去，但影响**推上去之后是不是个能用的仓库**。

### 问题 1：`out/交付包/` 曾是旧版快照 —— ✅ **已修复**

**状态：已于 2026-11-04 重新生成，本节保留作记录。**

修复前的情况（存档）：

| 文件 | 修复前 | 现在 |
|---|---|---|
| `levelScript.lua` | 3445 行 / 136 KB，无 `PIECE_ART`、无 ANIM 第 5.5 区 | **已重新生成**，含 `PIECE_ART`（v1.9 拟合棋子表）+ ANIM 5.5 + SFX 5.6 |
| md5 | 与源文件不一致 | **`1498f5b72bbe0b8bbe83b86d6383f790`，与 `lua/levelScript.lua` 完全一致**（已复验；该值为代码冻结后的最终值，此前 `3468331c…` / `c6ef381d…` 均已作废） |
| 4 个模板索引 | —— | **全部为 `0`**（正确交付形态） |
| `chess_demo.html` | v2 | **⚠️ 仍是 v2**（交付包是快照，未随 `proto/` 的 v3 同步；见问题 3） |
| `piece_*.lua` ×12 | 旧的 `require` 数据模块 | 文件仍在，但当前脚本已无任何 `require()` |

**🔴 仍然遗留的一条**：`out/交付包/挂载指南.md` 第 4 件仍要求
「**建 12 个脚本映射**指向 12 个 `piece_*.lua`」，并称「主脚本用 `require` 去读它们」。
但当前 `lua/levelScript.lua` **已无任何 `require()` 调用**（v1.7 起棋子改为脚本内自带的
`PIECE_ART` 几何表），所以**这一步现在是多余动作**。

后果不是报错，而是更糟的**误导**：用户会白花约 5 分钟，而且如果跳过这一步，
看到「别人说要建 12 个映射」会以为自己少做了、跑不起来而去找错方向。

**待处理**：由项目负责人决定是删除该节还是标注为「v1.5 及更早版本才需要」。
本指南不擅自改交付文档。**在修掉之前，请不要把这份挂载指南当作最新步骤说明。**

### 问题 2：README 截图是旧版 —— ✅ **已修复**

原图是 v1.5 界面（**Unicode 棋符 + 深色主题**），与 README 正文描述的拟合图元 + 浅色主题矛盾。

已替换为 `proto/chess_demo.html` 的当前版本截图（1600×900，浅色主题，含「音效」按钮）。
旧图备份在 `docs/images/screenshot-pieces-v15-dark.png` 留作对照。
README 已如实注明这是 **Demo 截图**，并说明 Demo 与游戏内的棋子画法差异（见问题 3）。

### 问题 3：Demo 与 Lua 的棋子画法不同（**历史遗留，非本次引入**）

v1.3 按用户要求删掉了 Lua 侧的「圆盘档 / 纯棋符档」，棋子只保留图元拟合一种画法；
但 **`proto/chess_demo.html` 至今仍是 `disc`（圆盘+棋符）/ `glyph`（纯棋符）两档**，
**没有拟合图元渲染**（实测：`PIECE_ART` / `polygon(` / `clip-path` 均 0 次命中）。

- Demo 是**体验沟通件、不是交付件**，因此不影响游戏内表现。
- 但**不能拿 Demo 截图当作「游戏内棋子长什么样」的证据**。
- README 已如实说明该差异，未声称 Demo 等于游戏内画面。
- `consistency_check.cjs` 只比对配色/字号/文案/尺寸，**不比对棋子画法**，所以它通过也不代表视觉一致。

### （附）截图工具的一个静默失败：`tools_work/shot.ps1`

**症状**：脚本返回 `SHOT_SAVED|...|888x499|printwindow=True|cands=2` —— **看起来完全成功**，
但截到的是**另一个无关的 Edge 窗口**（实测截到用户的必应首页新标签页）。

**根因**：`Win32Shot.Find()` 的匹配条件是 `okPid || okTitle`，而候选顺序是
`$all = $candsTitle + $candsPid` —— **标题命中排在 PID 之前**。
机器上开 12 个 `msedge` 进程时，`--app` 新窗口没有唯一性，先枚举到的同标题窗口就赢了。

**唯一露馅的信号是尺寸**：请求 `1600x900`，实际产出 `888x499`。

**教训**：**任何截图脚本都必须断言「输出尺寸 == 请求尺寸」，否则就是假成功。**
本项目已把这条写进流程。

**更稳的替代方案（本次实际采用）** —— 绕开窗口匹配，确定性 100%：

```powershell
msedge.exe --headless=new --disable-gpu --hide-scrollbars `
  --force-device-scale-factor=1 --window-size=1600,900 `
  --screenshot="<输出.png>" "file:///D:/输出目录/国际象棋/proto/chess_demo.html"
```

优点：不依赖窗口枚举、尺寸可控、**没有浏览器边框**（README 用图更干净）。
若要 Demo 的另一档棋子样式，加 `?style=glyph`（Demo 支持 `?style=disc|glyph`）。

---

## 一、仓库命名与描述建议

| 项 | 建议值 |
|---|---|
| 仓库名 | `miliastra-chess` |
| 备选名 | `qxqy-chess` · `genshin-ugc-chess` · `chess-in-miliastra` |
| 描述（About） | `千星奇域（原神 UGC）纯 2D 国际象棋：客户端控件 + Lua，棋子用算法拟合的基础图元绘制，零贴图依赖` |
| 英文描述 | `A pure-2D chess game built with client UI controls + Lua for Genshin Impact's Miliastra Wonderland. Pieces are drawn from fitted primitive shapes — no textures required.` |
| 主页 | 留空（没有在线 Demo） |
| 可见性 | Public（想带许可证给他人用就必须 Public） |
| 初始化选项 | **不要**勾选「Add a README / .gitignore / license」——仓库里已经有了，勾了会产生冲突 |

**Topics**（建议 8~10 个）：

```
genshin-impact  miliastra  ugc  chess  lua  game-development
ui  procedural-generation  no-assets  chinese
```

> `miliastra` / `genshin-impact` 用来被人搜到；`procedural-generation` / `no-assets`
> 是这项目真正的技术卖点；`chinese` 表明文档语言。

---

## 二、会提交什么、什么被忽略（实测）

### 总览

| | 文件数 | 体积 |
|---|---|---|
| **会提交** | **286** | **5.54 MB** |
| 被 `.gitignore` 忽略 | 2202 | 58.06 MB |
| 工作区总计（含被忽略的） | 2596 | 92.51 MB |

> 为什么「提交 + 忽略」不等于「工作区总计」：`tools_work/toolbox/` 是个**嵌套的 git 仓库**
> （自带 `.git/`），git 把它整体忽略后就不再往里枚举，所以有 112 个文件既不出现
> 在「会提交」也不出现在「被忽略」清单里 —— 它们**不会**被提交，这点已经确认过。
>
> 判定用**真实 git**（`git ls-files -o --exclude-standard` / `--ignored`）跑出来的，
> 不是人工判断，方法见附录 A。

### 会提交的部分

| 目录 / 文件 | 文件数 | 体积 | 说明 |
|---|---|---|---|
| `lua/` | 3 | 311 KB | 交付脚本 + 沙箱变体 + 早期形状表 |
| `sim/` | 18 | 537 KB | 模拟器副本 + 12 份历史棋子数据 + 探针 |
| `out/交付包/` | 20 | 641 KB | 交付物（✅ 已重新生成，见第零节问题 1） |
| `out/棋子素材-en-croissant/` | 90 | 848 KB | cburnett 素材（CC BY-SA 3.0） |
| `out/棋子素材-en-croissant.zip` | 1 | 808 KB | 上面那个目录的压缩副本 ⚠️ 见下方「可瘦身项」 |
| `docs/` | 18 | 983 KB | 策划案 / 技术架构 / 状态记录 / **3 张截图** / 拟合报告 / 本指南 |
| `proto/` | 2 | 198 KB | 网页 Demo + 一个诊断页 |
| `tools_work/` | 124 | 1.21 MB | 验证、同步、拟合、截图脚本 |
| `records/playtest.md` | 1 | 45 KB | 试玩记录（按 runtime 标来源） |
| `workspace/chess/chess.save.json` | 1 | 87 KB | 模拟器存档，可直接加载回放界面结构 |
| `reports/`（3 份文本） | 3 | 7.4 KB | 只留 `delivered_sbx.json` / `perft_d3.log` / `sbx_run.json` |
| `README.md` `LICENSE` `NOTICE` `.gitignore` `.gitattributes` | 5 | 28 KB | —— |

**`docs/images/` 下现在有 3 张 1600×900 截图**（约 740 KB）：

| 文件 | 用途 |
|---|---|
| `screenshot-pieces.png` | README 主图（Demo `?style=glyph`，浅色主题） |
| `screenshot-pieces-glyph.png` | 与主图相同，保留作「Demo 另一档样式」对照 |
| `screenshot-pieces-v15-dark.png` | v1.5 旧图存档（深色主题 + Unicode 棋符） |

> 想再省 314 KB，可以删掉 `screenshot-pieces-glyph.png`（与主图字节完全相同）。
> 留着只是因为 Lead 建议保留 —— 它和主图是同一张图，没有独立信息量。

### 被忽略的部分

| 路径 | 文件数 | 体积 | 为什么忽略 |
|---|---|---|---|
| `tools_work/icons/` | 1701 | 29.38 MB | 千星静态引用图标缓存（1517 个 PNG） |
| `tools_work/toolbox/` | 1 | 0 B | 第三方工具箱（含 wasm/web 资产） |
| `tools_work/fit_out/` | 399 | 13.83 MB | 拟合中间产物（大图 + 过程文件） |
| `tools_work/tmp/` | 27 | 2.71 MB | node_modules / 临时文件 |
| `reports/*.png` `*.jpg` `reports/glyphtest/` | 56 | 11.78 MB | 过程截图，不是交付物 |
| `docs/audio-preview/` | 10 | 117 KB | **游戏音频，版权归米哈游，绝不入库** |
| `docs/音效试听.html` | 1 | 3.8 KB | 本地试听页，依赖上面的音频 |
| `*.bak` / `*.bak.*` / `_ls_backup.lua` | 3 | 226 KB | 备份文件 |
| `.dsh/` | 3 | 3.5 KB | AI 会话本地状态 |
| `__pycache__/` `*.pyc` | 1 | 27 KB | Python 缓存 |

**手动核对过、结论会提交**（`.gitignore` 没有误伤它们）：

```
✓ lua/levelScript.lua            ✓ sim/levelScript.lua
✓ out/交付包/levelScript.lua      ✓ proto/chess_demo.html
✓ workspace/chess/chess.save.json ✓ docs/images/screenshot-pieces.png
✓ docs/*.md                      ✓ tools_work/*.cjs *.mjs
```

### 可瘦身项（**建议但不强制，我没有删任何文件**）

| 项 | 现状 | 建议 | 省下 |
|---|---|---|---|
| `out/棋子素材-en-croissant.zip` | 808 KB | **删掉**。它是同目录 90 个文件的压缩副本（实测 zip 里 90 条目、含 75 个 PNG），内容完全重复，git 也不会自动去重 | **-808 KB** |
| `png/48` `png/64` `png/240` 三档 | 36 个 PNG / 185 KB | **可删**。48 与 64 太小无实用价值，240 是历史遗留；保留 128 / 256 / 512 + SVG 足够 | 约 -185 KB |
| `tools_work/gil_ascii.txt` | 98 KB | 调试用字符画，可删 | -98 KB |
| `tools_work/*.html`（17 个） | 322 KB | 一次性对照页（`cap_compare` / `grid_compare` / `shape_preview` 等），`cap_compare.html` 单个 106 KB | 可选 -322 KB |
| `sim/piece_*.lua` ×12 | 311 KB | 当前代码**已不 require** 它们，属史料。留着有考古价值，删了更干净 | 可选 -311 KB |

**关于棋子素材 PNG 的结论**：`out/棋子素材-en-croissant/png/` 下**实际有 6 档**
（48 / 64 / 128 / 240 / 256 / **512**），共 **72 个 PNG / 532 KB**（实测），
不是任务里记的「5 档 60 个」—— 少算了 `512` 那一档。
总体积 532 KB，**远低于 2 MB 的瘦身阈值**，**建议整体保留**：
它们是 CC BY-SA 素材原件，也是拟合算法的输入，删了别人没法复现。
真正该删的是那个 **808 KB 的 zip 冗余副本**。

> **瘦身账**：只做前 3 项（zip + 三档小图 + 字符画）→ 5.54 − 0.81 − 0.19 − 0.10 ≈ **4.40 MB**；
> 连两个「可选」项一起做 → 再减 0.32 + 0.31 ≈ **3.77 MB**。都不损失可复现性。

---

## 三、初始化仓库并提交

### 0）.gitattributes：**必须加** —— 仓库里有 33 个文件行尾不统一

这一节是**实测**结论（用真实 git 索引 dry-run 过，方法见附录 A），不是凭经验写的。

现状（286 个待提交文件里）：

| 行尾 | 文件数 | 说明 |
|---|---|---|
| 纯 LF | 128 | 大多数 `.lua` `.md` `.cjs` |
| **纯 CRLF** | **28** | `proto/chess_demo.html`、`docs/策划案.md`、`out/交付包/*.md` 等 |
| **混合**（LF/CRLF 都有） | **5** | `lua/levelScript.sandbox.lua`、`out/交付包/chess_demo.html` 等 |
| 二进制 | 105 | PNG / ZIP，不参与行尾转换 |

**关键点**：`lua/levelScript.lua`、`sim/levelScript.lua`、`out/交付包/levelScript.lua`
这三份**恰好都是纯 LF**，所以 `.gitattributes` **不会**改动它们（已逐个 blob 验过）。

那为什么还必须加？因为 `proto/chess_demo.html` 是 **CRLF**，
而 `consistency_check.cjs` 要拿它和 Lua 逐项比对。没有统一的 `eol=lf` 规则，
它在不同机器检出后字节会变，比对脚本可能误报。

`.gitattributes` 内容（**本仓库已经放好了，你不用再建**）：

```gitattributes
# 统一按 LF 存储与检出：本项目的三份 levelScript.lua 要求逐字一致
* text=auto eol=lf

# 二进制资源，不做行尾转换与 diff
*.png binary
*.jpg binary
*.zip binary
*.mp3 binary
```

**实测效果**：`git add` 会打 33 条
`warning: ... CRLF will be replaced by LF the next time Git touches it`。
这**不是错误**，是 `.gitattributes` 在正常工作 —— 入库的 blob 已经是 LF
（验过：`proto/chess_demo.html` 磁盘上 2777 个 CR，提交后 blob 里 **0** 个 CR）。
看到这 33 条 warning 照常继续就行。

> 想消掉这些 warning，可以在 `git add` **之前**把工作区文件转成 LF；但**没必要** ——
> warning 只出现一次，之后工作区会被规范化。

### 1）初始化 + 首次提交

**MSYS bash**（项目路径含中文，务必加引号）：

```bash
cd "/d/输出目录/国际象棋"

git init -b main          # 直接建 main 分支；老版本 git 不支持 -b 就用下面的 branch -M

git config core.quotepath false      # 中文路径不显示成 \344\270\255

git add -A
git status --short | head -20        # 目视确认：应有约 286 个 A
git status --short | wc -l           # 应输出 286 左右

git commit -m "初始提交：黑白棋局 · 千星奇域 2D 国际象棋

- 客户端控件 + Lua 单文件实现，零贴图依赖
- 棋子由 cburnett 剪影算法拟合为矩形/椭圆/三角图元（74 图元，IoU 0.9835~0.9980）
- 规则引擎 perft 深度 3 与 python-chess 一致
- 含离线网页 Demo、验证脚本、模拟器存档
- 代码 MIT；棋子素材 CC BY-SA 3.0（见 NOTICE）"
```

**PowerShell**（功能等价）：

```powershell
Set-Location 'D:\输出目录\国际象棋'

git init -b main
git config core.quotepath false

git add -A
(git status --short).Count          # 应为 286 左右
git status --short | Select-Object -First 20

git commit -m "初始提交：黑白棋局 · 千星奇域 2D 国际象棋" -m "- 客户端控件 + Lua 单文件实现，零贴图依赖`n- 棋子由 cburnett 剪影算法拟合为矩形/椭圆/三角图元（74 图元，IoU 0.9835~0.9980）`n- 规则引擎 perft 深度 3 与 python-chess 一致`n- 含离线网页 Demo、验证脚本、模拟器存档`n- 代码 MIT；棋子素材 CC BY-SA 3.0（见 NOTICE）"
```

> **提交前必看**：`git status --short` 的行数应该 **286**。
> 如果明显偏多（比如 2000+），说明 `.gitignore` 没生效，先停下检查；
> 如果明显偏少（比如只有 3 行），说明当前目录不是项目根。

### 1.5）🔴 强制门禁：`git init` 之前必须跑这两个静态检查

**这一条不是建议，是门禁。** 本项目在 v1.10 已经靠它救过一次场：

```bash
node tools_work/lua_check.cjs         # 必须 exit 0，且「局部函数无先用后定义」为 ✓
node tools_work/consistency_check.cjs # 必须 exit 0，末行 ALL CONSISTENT
```

**为什么这条门禁是硬的：**

`lua_check.cjs` 在 v1.10 抓到过一个**阻断级 regression** ——
`show_panel_buttons` 的定义位置晚于 `show_result`，于是
**认输 / 将死 / 超时 / 和棋这四条终局路径全部崩在 `attempt to call a nil value`，
结算面板根本弹不出来**。

这是**只有运行时才会暴露**的问题，但**静态检查提前发现了它**：
Lua 的 `local function` 在定义前不可见，`lua_check.cjs` 专门检查这一点。
如果跳过这一步直接提交，交到用户手里就是「下完一局弹不出结算」的死游戏。

> 教训：**能静态查出来的问题，不要留给模拟器 / 真机。** 每次提交前都跑，包括这次。

### 2）提交前的自查清单

```bash
# ① 确认大目录真的没被 add
git ls-files | grep -c "^tools_work/icons/"      # 必须是 0
git ls-files | grep -c "^docs/audio-preview/"    # 必须是 0
git ls-files | grep -c "^\.dsh/"                 # 必须是 0

# ② 确认交付物在
git ls-files | grep -E "^(lua|sim)/levelScript.lua$"
git ls-files | grep "workspace/chess/chess.save.json"
git ls-files | grep "proto/chess_demo.html"

# ③ 确认没有音频混进来
git ls-files | grep -Ei "\.(mp3|wav|ogg|m4a)$"   # 必须无输出

# ④ 确认没有密钥
git ls-files | grep -Ei "(token|secret|credential|\.env)"   # 必须无输出

# ⑤ 看最终体积
git count-objects -vH | grep size-pack
```

PowerShell 对应（把 `grep` 换成 `Select-String`）：

```powershell
(git ls-files | Select-String '^tools_work/icons/').Count        # 0
(git ls-files | Select-String -Pattern '\.(mp3|wav|ogg|m4a)$').Count   # 0
git count-objects -vH
```

---

## 四、两种推送方式

### 方式 A：你自己建仓再 push（推荐，最省事）

1. 浏览器打开 <https://github.com/new>
2. 填仓库名 `miliastra-chess`，**选 Public**
3. **不要**勾 "Add a README file" / "Add .gitignore" / "Choose a license"（仓库里已有）
4. 点 **Create repository**
5. 回到终端，复制 GitHub 页面给出的 `git remote add` 那两行执行：

**MSYS bash**
```bash
git remote add origin https://github.com/<你的用户名>/miliastra-chess.git
git push -u origin main
```

**PowerShell**
```powershell
git remote add origin https://github.com/<你的用户名>/miliastra-chess.git
git push -u origin main
```

6. 推送时会弹浏览器做一次授权（Git Credential Manager），或在终端粘贴 PAT。
   **千万不要**把 token 写进 URL 再提交到任何文件里。

> 也可以用自己的仓库名/组织，把上面 URL 换掉即可。

### 方式 B：配一个 PAT，由 AI 通过 GitHub MCP 建仓并推送

**前提**：需要你**主动**提供一个 PAT，本会话当前**没有配置**（`github_token_status` 显示未配置，
GitHub MCP server 处于 disconnected）。**在你给出 token 之前，AI 侧无法建仓。**

**PAT 怎么生成**（细粒度 token）：

1. 打开 <https://github.com/settings/personal-access-tokens/new>
2. Token name：`dsh-miliastra-chess`
3. Expiration：建议 **7 天**（用完即弃）
4. Repository access：选 **Only select repositories** → 先选 All repositories 或建仓后再加
5. Permissions → Repository permissions：
   - **Contents: Read and write**（推代码必需）
   - **Metadata: Read-only**（自动带上）
   - 若要 AI 代建仓库，还需 **Administration: Read and write**
6. Generate token，**只显示一次**，立刻复制

**拿到之后怎么给**：

- 直接调 `github_set_token`（会把 token 存进 DSH 凭据中心 `.credentials.yaml`，不进仓库）
- 或你自己 `git remote set-url` 后用 token 推送，不需要 AI 参与

**无论哪种方式，token 都不该出现在仓库里。** 提交前务必跑一次：

```bash
git ls-files | grep -Ei "(token|secret|credential|\.env|\.credentials)"   # 必须无输出
```

> `.credentials.yaml` 在 `C:\Users\<你>\.dsh\` 下，**不在项目目录内**，不会被提交。

---

## 五、推送之后的收尾

### 1）设置仓库信息

- **About** 里粘贴英文描述 + 主页留空
- **Topics** 粘贴第二节那 10 个
- **Releases**：建议打 `v1.9` tag（对应棋子拟合那版）

```bash
git tag -a v1.9 -m "v1.9：棋子改为 cburnett 算法拟合图元，六层渲染"
git push origin v1.9
```

### 2）确认 GitHub 认出了许可证

推送后仓库首页右上角应显示 **"MIT license"**。
由于 `LICENSE` 顶部是标准 MIT 全文、后面追加了中文第三方声明，
GitHub 通常仍能识别为 MIT —— 如果它显示 `Unknown` 或 `View license`，
把第三方声明**挪到 `NOTICE` 里**（`LICENSE` 只留纯 MIT 文本）就能被正确识别。
`NOTICE` 已经独立存在，所以这个调整只需删 `LICENSE` 后半段。

### 3）需要在 About 或首条 Issue 里说明的事

- **签名一条「真机未验证」**：README「已知限制」有完整清单，这是项目当前最大的未知项。
- `out/交付包/挂载指南.md` 里「建 12 个脚本映射」那一节已过期（第零节问题 1 的遗留项），
  在修掉之前建议在 Issue 里点名，避免使用者照着做出无用功。
- README 主图是 **Demo 截图**，不是游戏内画面（第零节问题 3），README 已如实注明。

---

## 附录 A：这份统计是怎么算出来的

不是人工估的。用真实 git 在**临时目录**里建了一个索引（**不污染项目，项目里没有 `.git`**）：

```bash
git --git-dir="$TMP/repo.git" --work-tree="D:/输出目录/国际象棋" init -b main
git -c core.quotepath=false --git-dir="$TMP/repo.git" --work-tree="D:/输出目录/国际象棋" \
    ls-files -o --exclude-standard              # → 会提交的 286 个
git -c core.quotepath=false --git-dir="$TMP/repo.git" --work-tree="D:/输出目录/国际象棋" \
    ls-files -o --ignored --exclude-standard    # → 被忽略的 2202 个
```

体积用文件系统实际字节求和。

**还完整 dry-run 了一遍真实的 `git add -A` + `commit`**（同样只写临时目录），
所以下面这些数字是**跑出来的**，不是推的：

| 指标 | 实测值 |
|---|---|
| 暂存文件数 | **286** |
| commit 后 `size-pack` | **2.71 MiB** |
| 打包对象数 | 301 |
| `tools_work/icons/` 被暂存 | 0 |
| `docs/audio-preview/` 被暂存 | 0 |
| 音频文件（mp3/wav/ogg/m4a） | 0 |
| 疑似密钥（token/secret/credential/.env） | 0 |

> 注意 `size-pack` **2.71 MiB** 明显小于文件总和 **5.54 MB** —— 因为 git 会压缩，
> 且 90 个 PNG 里有大量相近内容可共享。这是首推实际会传输的量。

**踩过的坑（写下来免得别人重复）**：

- 第一次统计得出「311 个会提交」，比正确答案多 30 个。原因是 **`git ls-files` 默认
  `core.quotepath=true`，中文路径被转义成 `"\344\270\255\346\226\207"`**，
  脚本按字符串匹配时对不上盘上路径，就误判成「没被忽略」。
  **加 `-c core.quotepath=false` 才对。**
- 同理，人工扫行尾时也只看了一部分文件就得出「全是 LF」的结论 ——
  实际有 33 个是 CRLF 或混合（见第三节 0）。**要测就全量测。**
- `git config user.name = azkbzxf`、`user.email` 已配置，所以可以按方式 A 直接提交。

## 附录 B：一页速查

```bash
# 完整流程（MSYS bash）
cd "/d/输出目录/国际象棋"
# 先建好 .gitattributes（见第三节 0），再：
git init -b main
git config core.quotepath false
git add -A
git status --short \| wc -l                    # 286
git commit -m "初始提交：黑白棋局 · 千星奇域 2D 国际象棋"
git remote add origin https://github.com/<你>/miliastra-chess.git
git push -u origin main
```

| 检查项 | 期望值 |
|---|---|
| `git status --short \| wc -l` | **286** |
| `git ls-files \| grep -c tools_work/icons/` | **0** |
| `git ls-files \| grep -c audio-preview` | **0** |
| 音频文件（mp3/wav/ogg） | **0** |
| `git count-objects -vH` 的 `size-pack` | **约 2.7 MiB**（dry-run 实测 2.71 MiB） |
| 仓库首页许可证徽标 | **MIT license** |

## 附录 C：模拟器测试的方法学（两条，都是踩出来的）

验证 UI 交互时，**「验它能不能点」和「验它是不是真的点不动」是两件相反的事，
必须用不同的调用方式** —— 混用会造成假阳性/假阴性。

| 你要验什么 | 用什么 | 为什么 |
|---|---|---|
| 控件**真的不可点**（如模态弹窗锁住下层面板） | `pointer` **真实坐标** | `click {name}` 会**绕过 `active` 检查** —— 控件明明是 `active:false`，事件照样投递进去，于是你会误判「锁没生效」 |
| 控件**能点**（普通交互回归） | `click {name}` | 按名字找控件，**不受布局像素漂移影响**，比算坐标稳 |

**具体到本项目的例子**：v1.10 给模态弹窗加了「防穿透」（弹窗打开时
`show_panel_buttons(false)` 把面板按钮锁掉）。如果用 `click {name}` 去验，
即使锁生效了也会「点到」，得出「锁没生效」的**假阴性**；
必须用 `pointer` 发真实坐标，才能确认事件确实投到了弹窗遮罩上而不是下层按钮。

> 这条不只适用于本项目：**任何有「禁用/遮罩/锁」概念的 UI，验「锁住了」都不能用
> 那个会绕过 active 检查的 API。** 验证手段本身必须能观察到被测行为，否则测的是假的。

