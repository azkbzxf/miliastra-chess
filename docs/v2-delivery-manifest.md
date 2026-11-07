# 最终交付清单（v2.0）

> 由 `tools_work/issue1/_gen_delivery_manifest.cjs` 从源码自动提取。
>
> ## ⚠️ 校验值必须重新生成（2026-11-08 手工修缺陷后）
>
> 2026-11-08 由 Lead 手工修了 5 个真实缺陷（结算面板全屏命中区层级、结算复盘 `allowEmpty`、
> 退出复盘 `fromMenu`、`new_game` 悔棋按钮收敛、`screen` 落定后二次刷新），
> **直接改了 4 个文件**，因此下表的 md5 已过期。**行数已按实际核对更新，md5 必须重算**：
>
> ```
> node tools_work/issue1/_gen_delivery_manifest.cjs
> ```
>
> 在重算之前：**不要**用下表 md5 去校验交付包，否则会误判「包损坏」。
> 判断交付包是否最新，用**行数 + 自检日志**（`[自检] 30/30 通过`）这两个判据更可靠。

## 一、交付数字

| 项 | 值 |
|---|---|
| 控件总数 | 1489（模拟器实测，日志 `控件 1489 个`） |
| 代码行数 | lua **9858** / sim **9861** / 交付包 **9858**（sim 多 3 行为模板索引注释，设计允许） |
| md5（lua） | ⚠️ 已过期，需重算（原 `79CDF12D03D94AC1605BD0BD879A55D1` 是 11-08 手改前的值） |
| md5（sim） | ⚠️ 已过期，需重算 |
| md5（交付包） | ⚠️ 已过期，需重算（**与 lua 恒等**） |
| 自检断言 | 30 条（日志 `[自检] 30/30 通过`） |
| `CONFIG.TEXT` 键数 | 138 |


## 二、信号事件表（ChessSync）

信号名：`CONFIG.SIGNAL_NAME`（默认 `ChessSync`），5 个参数槽：`(eventType, a, b, c, fen)`

| 事件号 | 名称 | a | b | c | fen | 说明 |
|---|---|---|---|---|---|---|
| 0 | `EV_MOVE` | — | — | — | — | 走子：a=起点格  b=终点格  c=升变(0/1Q/2R/3B/4N)  fen="" |
| 1 | `EV_NEWGAME` | — | — | — | — | 新开一局：a=发起方(0/1) |
| 2 | `EV_RESIGN` | — | — | — | — | 认输/弃局：a=认输方(0/1)  b=0  c=0认输/1弃局 |
| 3 | `EV_DRAW_REQ` | — | — | — | — | 求和：a=请求方(0/1) |
| 4 | `EV_DRAW_ACC` | — | — | — | — | 同意和棋：a=同意方(0/1) |
| 5 | `EV_JOIN` | — | — | — | — | 请求加入：全 0 |
| 6 | `EV_ROLE` | — | — | — | — | 身份分配（服务端回发）：a=0 白方 / 1 黑方 |
| 7 | `EV_DRAW_NO` | — | — | — | — | 拒绝和棋：a=拒绝方(0/1) |
| 8 | `EV_READY` | — | — | — | — | 准备/取消准备：a=0取消/1准备  b=档位号(1~4)  c=0  **fen=自识别 token（不是空串！）** |
| 9 | `EV_START` | — | — | — | — | 开局：b=档位号  a=0  c=0  **fen=自识别 token（不是空串！）** |
| 10 | `EV_UNDO_REQ` | — | — | — | — | 悔棋请求：a=发起方(0/1) |
| 11 | `EV_UNDO_ACC` | — | — | — | — | 悔棋同意：a=同意方(0/1) |
| 12 | `EV_UNDO_NO` | — | — | — | — | 悔棋拒绝：a=拒绝方(0/1) |

> **⚠️ 为什么 8 / 9 的 `fen` 不是空串**：服务端节点图是「收到即广播给**所有人**」，
> 包括发送者自己。而官方客户端 API **不提供发送者身份**（`playerIndex` 等均不存在），
> 所以只能让发送方在 `fen` 里带一个**只有本端知道的 token**，收到时比对——
> 等于自己的就丢弃（那是回声），不等于就是对方发的。
>
> **搭节点图时原样透传 `fen` 即可，不要给它填固定值**，否则回声过滤失效
> （表现为「自己点准备，自己这边以为对方也准备好了」）。
> 详见 `导入方案.md` 7.7 / B.4，与 `docs/v2-signal-protocol.md` §4。

## 三、关键常量表

| 常量 | 值 | 含义 |
|---|---|---|
| TC[1] `超快棋` | 60 + 0 | 首钟 60 秒，每步加 0 秒 |
| TC[2] `闪电战` | 180 + 2 | 首钟 180 秒，每步加 2 秒 |
| TC[3] `快棋` | 900 + 10 | 首钟 900 秒，每步加 10 秒 |
| TC[4] `慢棋` | 5400 + 30 | 首钟 5400 秒，每步加 30 秒 |
| `DEFAULT_TIME_CONTROL` | 3 | 默认档位（= 快棋 900+10，与 v1.12 一致） |
| `UNDO_PER_SIDE` | 3 | 每方每局可悔棋次数 |
| `PAIRED_UNDO_PLIES` | 2 | 一次悔棋回退的半步数（成对） |
| `UNDO_REQUEST_TIMEOUT_SEC` | 15 | 联机悔棋请求超时（秒） |
| `LOBBY_PEER_TIMEOUT_SEC` | 15 | 待机室等对手超时（秒） |
| `LOBBY_COUNTDOWN_SEC` | 3 | 双方就绪后的开局倒数（秒） |
| `LOBBY_TOUCH_MIN` | 44 | 待机室按钮触摸目标下限（px） |
| `V2_H_RATIO` | 2.1 | 板高 / 字号 比例（唯一排版算式） |
| `REVIEW_BAR_H` | 44 | 复盘动作条高度（px @1600×900） |
| `INITIAL_TIME_SEC` | 900 | **v1.12 兼容别名**（= 档位 3 首钟），不许删 |
| `INCREMENT_SEC` | 10 | **v1.12 兼容别名**（= 档位 3 加秒），不许删 |

## 四、`CONFIG.TEXT` 全量键值（逐字，导入方案附录用）

> 必须逐字照抄 —— 断言 `text_fits` / `lobby_text_fits` 已按这些字串算过宽度。

| 键 | 值 |
|---|---|
| `HINT_OPENING` | `点一枚自己的棋子，再点亮起来的格子` |
| `HINT_SELECTED` | `已选中 · 点亮的格子都能走` |
| `TURN_WHITE` | `轮到白方走子` |
| `TURN_BLACK` | `轮到黑方走子` |
| `TURN_OVER` | `棋局结束` |
| `WAIT_OPPONENT` | `等待对方走子…` |
| `CHECK` | `将军！请先解围` |
| `RESULT_WHITE_WIN` | `白方将死黑方，白方胜` |
| `RESULT_BLACK_WIN` | `黑方将死白方，黑方胜` |
| `RESULT_STALEMATE` | `无子可动，本局和棋` |
| `RESULT_FIFTY` | `五十步无进展，本局和棋` |
| `RESULT_THREEFOLD` | `局面重复三次，本局和棋` |
| `RESULT_INSUFFICIENT` | `子力不足，本局和棋` |
| `RESULT_TIMEOUT_WHITE` | `白方超时，黑方胜` |
| `RESULT_TIMEOUT_BLACK` | `黑方超时，白方胜` |
| `RESULT_RESIGN_WHITE` | `白方认输，黑方胜` |
| `RESULT_RESIGN_BLACK` | `黑方认输，白方胜` |
| `RESULT_DRAW_AGREED` | `对方同意和棋，本局和棋` |
| `RESULT_DRAW_LOCAL` | `双方同意和棋，本局和棋` |
| `RESULT_OPP_LEFT` | `对手已离开本局` |
| `SUB_OPP_LEFT` | `本局结束，不计胜负` |
| `SUB_CHECKMATE` | `本局用时 {t}` |
| `SUB_STALEMATE` | `双方都走不动了` |
| `SUB_FIFTY` | `五十步没有吃子` |
| `SUB_THREEFOLD` | `同一局面出现了三次` |
| `SUB_INSUFFICIENT` | `剩下的子赢不了` |
| `SUB_TIMEOUT_WHITE` | `白方时间用完了` |
| `SUB_TIMEOUT_BLACK` | `黑方时间用完了` |
| `SUB_RESIGN_WHITE` | `白方点了认输` |
| `SUB_RESIGN_BLACK` | `黑方点了认输` |
| `SUB_DRAW_AGREED` | `双方握手言和` |
| `BTN_AGAIN` | `再来一局` |
| `BTN_NEWGAME` | `新开一局` |
| `BTN_RESIGN` | `认输` |
| `BTN_DRAW` | `求和` |
| `BTN_LOCAL` | `切换本地同屏` |
| `BTN_ONLINE` | `切换联机对战` |
| `BTN_DRAW_USED` | `求和已用完` |
| `CONFIRM_RESIGN` | `认输就直接判负，确定吗` |
| `CONFIRM_RESIGN_YES` | `确定认输` |
| `CONFIRM_RESIGN_NO` | `继续下棋` |
| `CONFIRM_NEWGAME` | `重开会清空这一局` |
| `CONFIRM_YES` | `确定` |
| `CONFIRM_NO` | `取消` |
| `CONFIRM_SWITCH` | `切换会断开这一局，确定吗` |
| `CONFIRM_DRAW` | `对方想和棋，同意吗` |
| `CONFIRM_DRAW_LOCAL` | `和棋？确认后本局判和` |
| `CONFIRM_DRAW_YES` | `同意和棋` |
| `CONFIRM_DRAW_NO` | `拒绝求和` |
| `PANEL_TITLE` | `黑白棋局` |
| `CAP_WHITE_PREFIX` | `白方失子 ` |
| `CAP_BLACK_PREFIX` | `黑方失子 ` |
| `CAP_NONE` | `无` |
| `MOVELOG_TITLE` | `最近六步` |
| `MOVELOG_EMPTY` | `还没有走子` |
| `PROMO_PROMPT` | `兵到底了，选一个子` |
| `PROMO_QUEEN` | `后` |
| `PROMO_ROOK` | `车` |
| `PROMO_BISHOP` | `象` |
| `PROMO_KNIGHT` | `马` |
| `BTN_REVIEW` | `复盘` |
| `BTN_REVIEW_HISTORY` | `看历史` |
| `BTN_REVIEW_EXIT` | `退出复盘` |
| `BTN_REVIEW_START` | `开局` |
| `BTN_REVIEW_PREV` | `上一步` |
| `BTN_REVIEW_NEXT` | `下一步` |
| `BTN_REVIEW_END` | `终局` |
| `REVIEW_AT_START` | `复盘 · 开局` |
| `REVIEW_STEP` | `复盘 · 第 {n}/{m} 步` |
| `REVIEW_EMPTY` | `这局还没走子，没得复盘` |
| `REVIEW_START_HINT` | `开局 · 还没走子` |
| `SFX_ON` | `音效：开` |
| `SFX_OFF` | `音效：关` |
| `START_TITLE` | `黑白棋局` |
| `START_SUBTITLE` | `选一个时间档，然后开始` |
| `ENTRY_LOCAL` | `单人·双人同屏` |
| `ENTRY_REVIEW` | `单人·复盘研习` |
| `ENTRY_ONLINE` | `联机·待机室` |
| `TC_CLOCK` | `首钟 {c}` |
| `TC_INC_ZERO` | `无加秒` |
| `TC_INC` | `每步 +{i} 秒` |
| `TC_EST` | `预计 {e}` |
| `TC_FIRST_PICKER` | `联机时以先选者为准` |
| `START_VERSION` | `v2.0` |
| `START_FOOTER` | `点一个入口开始` |
| `BTN_MENU` | `返回主菜单` |
| `CONFIRM_MENU` | `回主菜单会放弃这一局，确定吗` |
| `CONFIRM_MENU_YES` | `确定放弃` |
| `LOBBY_TITLE` | `联机·待机室` |
| `LOBBY_ME` | `你` |
| `LOBBY_OPP` | `对手` |
| `LOBBY_SLOT_EMPTY` | `等待对手加入…` |
| `LOBBY_READY_ON` | `已准备` |
| `LOBBY_READY_OFF` | `未准备` |
| `LOBBY_BTN_READY` | `准备` |
| `LOBBY_BTN_CANCEL` | `取消准备` |
| `LOBBY_BTN_SOLO` | `直接开始` |
| `LOBBY_HINT` | `双方都点准备后开始` |
| `LOBBY_HINT_WAIT` | `只有你一个人，可以直接开始` |
| `LOBBY_COUNTDOWN_HINT` | `准备开局` |
| `LOBBY_CANCELED` | `已取消准备，等待重新准备` |
| `LOBBY_NOBODY` | `没等到另一位玩家，也可以直接开始` |
| `LOBBY_TC_FMT` | `时间档 {name} {clock}　{owner}` |
| `LOBBY_TC_NONE` | `还没人选` |
| `LOBBY_TC_MINE` | `由你选定` |
| `LOBBY_TC_PEER` | `由对手选定` |
| `LOBBY_TC_LOCKED` | `时间档已锁定，由对方选定` |
| `LOBBY_SIDE_WHITE` | `（执白）` |
| `LOBBY_SIDE_BLACK` | `（执黑）` |
| `LOBBY_SIDE_UNKNOWN` | `（身份待定）` |
| `UNDO_BTN` | `悔棋（剩 {n}）` |
| `CONFIRM_UNDO` | `悔棋：双方各退一步` |
| `CONFIRM_UNDO_YES` | `确认悔棋` |
| `CONFIRM_UNDO_NO` | `取消` |
| `CONFIRM_UNDO_PEER` | `对方请求悔棋，同意吗` |
| `CONFIRM_UNDO_ACC` | `同意悔棋` |
| `CONFIRM_UNDO_REJ` | `拒绝悔棋` |
| `UNDO_DONE` | `已悔棋：双方各退一步` |
| `UNDO_WAIT` | `已发出悔棋请求，等待对方同意` |
| `UNDO_PENDING` | `已有一个悔棋请求在等待回应` |
| `UNDO_REJECTED` | `对方拒绝了悔棋` |
| `UNDO_TIMEOUT` | `对方没有回应，悔棋已取消` |
| `UNDO_WAITING_PEER` | `等待对方同意悔棋…` |
| `UNDO_NO_OVER` | `棋局已结束，不能悔棋` |
| `UNDO_NO_EARLY` | `开局还没走子，不能悔棋` |
| `UNDO_NEED_TWO` | `至少走两步才能悔棋（悔棋是双方各退一步）` |
| `UNDO_NO_TURN` | `等轮到你时再悔棋` |
| `UNDO_NO_LEFT` | `悔棋次数用完了` |
| `UNDO_NO_PROMO` | `现在不能这样做` |
| `REVIEW_AT_START_BRANCH` | `复盘 · 开局（可试走）` |
| `BTN_BRANCH_BACK` | `退回主变` |
| `BTN_BRANCH_NEW` | `从此开新局` |
| `CONFIRM_BRANCH_NEW` | `开新局会清空之前的历史，确定吗` |
| `CONFIRM_BRANCH_NEW_YES` | `确定开新局` |
| `BRANCH_ENTERED` | `分支试走中 · 点青色的格子落子，主变不受影响` |
| `BRANCH_MOVED` | `已走出分支 · 可「退回主变」恢复` |
| `BRANCH_BACK` | `已退回主变` |
| `BRANCH_NO_BRANCH` | `当前不在分支里` |
| `BRANCH_BAD_FEN` | `这个局面开不了新局` |
| `ERR_CONFIG` | `界面零件还没配好：请检查 CONFIG 里的 4 个模板索引（容器节点/文本框/光标检测区/图片）` |

共 140 项。

## 五、界面层（Z 序，后创建在上）

| 层 | 进入 | 退出 |
|---|---|---|
| 初始界面 `start` | `show_start_screen()` | 选入口后切走 |
| 待机室 `lobby` | `show_lobby()` | `start_game_from_lobby()` |
| 棋盘对局 `playing` | `entry_start_local()` / `start_game_from_lobby()` | 认输/和/返回主菜单 |
| 复盘 `review` | `enter_review()` | `exit_review()` |
| 结算 `result` | `show_result()` | 返回主菜单/再来一局 |
| 确认框 `confirm` | `show_confirm(kind)` | `hide_confirm()` |
| 复盘动作条 | `refresh_review_actionbar()` | `hide_all_overlays()` |

**关键纪律**：每个 `show_XXX_screen` 开头必须调 `hide_all_overlays()` 收起其余全部层。

## 六、门禁链（改代码后必须按序全跑）

```
1. node tools_work/sync_sim_copy.cjs
2. node tools_work/sync_delivery.cjs
3. node tools_work/lua_check.cjs
4. node tools_work/consistency_check.cjs
5. node tests/static_checks.cjs
6. node tools_work/issue1/_audit_forward_vars.cjs
7. node tools_work/issue1/_inline.cjs
8. node tools_work/issue1/_verify_inline.cjs
```

> ⚠️ 直接编辑 `sim/` 会被第 1 步静默覆盖，而第 4 步仍报「一致性 OK」（它比的是 `lua/` 和交付包）。
