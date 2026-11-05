from __future__ import annotations

from typing import Any, Dict


SIGNAL_ID = "signal_chess_sync"

# 与千星「服务器信号管理器」中的定义一一对应：
#   ChessSync 定义 5 个参数，顺序不可换 —— 客户端 Lua 侧
#   RegisterServerSignalHandler 回调拿到的 params 数组按下标读：
#     params[1]=eventType  params[2]=a  params[3]=b  params[4]=c  params[5]=fen
# 注意客户端 Lua 数组是 1 基，服务端这里是声明顺序。
SIGNAL_PAYLOAD: Dict[str, Any] = {
    "signal_id": SIGNAL_ID,
    "signal_name": "ChessSync",
    "parameters": [
        {
            "name": "eventType",
            "parameter_type": "整数",
            "description": "事件类型：0=走子 1=新局 2=认输 3=求和 4=同意和棋 6=身份分配 7=拒绝和棋",
        },
        {
            "name": "a",
            "parameter_type": "整数",
            "description": "走子=起点格号(0-63)；认输/求和=发起方(0白1黑)；身份分配=0白方1黑方",
        },
        {
            "name": "b",
            "parameter_type": "整数",
            "description": "走子=终点格号(0-63)；其余事件填 0",
        },
        {
            "name": "c",
            "parameter_type": "整数",
            "description": "走子=升变(0无 1后 2车 3象 4马)；其余事件填 0",
        },
        {
            "name": "fen",
            "parameter_type": "字符串",
            "description": "保留字段，目前恒为空串；用于将来发送完整局面做校验",
        },
    ],
    "description": (
        "黑白棋局联机同步信号。客户端脚本 lua/levelScript.lua 用 "
        "game.ServerSignal(\"ChessSync\") 发出，服务端节点图监听后转发，"
        "最终由客户端 RegisterServerSignalHandler 收到。"
    ),
}
