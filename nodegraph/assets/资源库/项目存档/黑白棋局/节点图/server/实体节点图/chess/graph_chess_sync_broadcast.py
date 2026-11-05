"""
graph_id: server_chess_sync_relay
graph_name: 黑白棋局_联机同步中继
graph_type: server
description: |
  黑白棋局的双人联机中继节点图。整张图只有一条链路，没有任何分支判断：

      监听信号(ChessSync)  →  转发 5 个参数

  ┌──────────────────────────────────────────────────────────────────┐
  │ 重要：这张图在本工具链里只能完成「前半段」，必须补一个节点         │
  └──────────────────────────────────────────────────────────────────┘

  客户端 Lua（lua/levelScript.lua）用 game.ServerSignal("ChessSync") 发出信号，
  服务端要把它送到**客户端的 Lua**，必须用官方节点【发送客户端脚本信号】。

  但 Ayaya_Miliastra_Editor 的 server 节点库（plugins/nodes/server/__init__.pyi，
  438 个节点定义）里**没有**这个节点，只有：
      · 监听信号   （客户端 → 服务端，正是我们要的上游）
      · 发送信号   （服务端 → **服务端节点图**，客户端脚本收不到）

  两者名字极像，但【发送信号】的接收方是服务端节点图，
  客户端脚本的 RegisterServerSignalHandler **收不到**它。
  选错的表现：对方永远没反应，而且日志里没有任何报错。

  所以本文件做的事：
      1. 用 Ayaya 能表达的部分，把上游【监听信号(ChessSync)】接好；
      2. 在转发处留一个明确的 TODO 标记，指向需要手补的官方节点；
      3. 参数原样透传，不做任何变换。

  补法（在千星沙箱编辑器里，约 30 秒）：
      把本图导出后，打开该节点图，在「转发_ChessSync」这个复合节点内部
      把末尾的占位换成官方节点【发送客户端脚本信号】，连线：
          信号名  = ChessSync
          目标    = 全部玩家
          eventType / a / b / c / fen  ← 依次接 5 个透传参数

  前置条件（不先做，信号名选不出来、引脚也长不出来）：
  千星沙箱 →「服务器信号管理器」→ 添加信号 ChessSync，
  参数按顺序：整数、整数、整数、整数、字符串。
  顺序不能换 —— 客户端 Lua 按下标读 params。
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = next(
    p
    for p in Path(__file__).resolve().parents
    if (p / "assets" / "资源库").is_dir() or ((p / "engine").is_dir() and (p / "app").is_dir())
)
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(1, str(PROJECT_ROOT / "assets"))

from app.runtime.engine.graph_prelude_server import *  # noqa: F401,F403
from engine.nodes.composite_spec import composite_class, flow_entry

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from engine.graph.composite.pin_api import 流程入, 流程出, 数据入, 数据出


_信号名: str = "ChessSync"


@composite_class
class 转发_ChessSync:
    """把 ChessSync 的 5 个参数原样转发给客户端脚本。

    做成复合节点而不是直接写在事件方法里，原因有两个：
      1. 事件方法里的线性链路在导出时会排成一条直链，可读性好；
      2. 「发送客户端脚本信号」是手补节点，单独包在复合里，
         补的时候只动这一处，不会碰到事件节点和信号监听。

    本复合节点不做任何判断、不改任何参数值 —— 纯粹的管道。
    """

    def __init__(self, game, owner_entity):
        self.game = game
        self.owner_entity = owner_entity

    @flow_entry()
    def 转发(
        self,
        eventType: "整数",
        a: "整数",
        b: "整数",
        c: "整数",
        fen: "字符串",
    ):
        流程入("流程入")
        数据入("eventType", pin_type="整数")
        数据入("a", pin_type="整数")
        数据入("b", pin_type="整数")
        数据入("c", pin_type="整数")
        数据入("fen", pin_type="字符串")

        # ------------------------------------------------------------------
        # TODO【必须手补】：把下面这段换成官方节点【发送客户端脚本信号】
        #
        # Ayaya 节点库没有该节点（见文件头说明），因此这里只能用
        # 【发送信号】占位 —— 它能把链路跑通、让 validate 通过，
        # 但**它发给的是服务端节点图，不是客户端 Lua**。
        # 也就是说：导出后必须进编辑器把这一处替换成【发送客户端脚本信号】，
        # 否则客户端的 RegisterServerSignalHandler 永远收不到。
        #
        # 替换时连线：
        #   信号名    = ChessSync
        #   目标      = 全部玩家
        #   eventType / a / b / c / fen ← 依次接本复合节点的 5 个数据入引脚
        #
        # 保留这段占位的另一个原因：它让 validate-graphs 能通过，
        # 从而在正式补节点前就能验证「上游监听是否接对」。
        # ------------------------------------------------------------------
        发送信号(
            self.game,
            信号名=_信号名,
            eventType=eventType,
            a=a,
            b=b,
            c=c,
            fen=fen,
        )

        流程出("流程出")


class 黑白棋局_联机同步中继:
    """监听 ChessSync，交给转发复合节点。

    为什么不做「回声过滤」：
    服务端会把信号广播给房间内所有人，包括发送者自己。
    回声由客户端脚本自己吃掉 —— lua/levelScript.lua 里：
      · 走子  用 GAME.lastSentMove 匹配 from/to/promo 三项
      · 求和  用 GAME.drawReqSent 标记
      · 和棋  用 GAME.over 挡住重复结算
    在服务端做过滤需要「信号来源玩家序号」，而信号协议里没有这一项，
    为此多加一个参数不值当。
    """

    def __init__(self, game: "GameRuntime", owner_entity: "实体"):
        self.game = game
        self.owner_entity = owner_entity

        from app.runtime.engine.node_graph_validator import validate_node_graph

        validate_node_graph(self.__class__)

    def on_ChessSync(
        self,
        事件源实体: "实体",
        事件源GUID: "GUID",
        信号来源实体: "实体",
        eventType: "整数",
        a: "整数",
        b: "整数",
        c: "整数",
        fen: "字符串",
    ) -> None:
        self.转发_ChessSync.转发(
            eventType=eventType,
            a=a,
            b=b,
            c=c,
            fen=fen,
        )

    def register_handlers(self):
        self.game.register_event_handler(_信号名, self.on_ChessSync, owner=self.owner_entity)


if __name__ == "__main__":
    from app.runtime.engine.node_graph_validator import validate_file_cli

    raise SystemExit(validate_file_cli(__file__))
