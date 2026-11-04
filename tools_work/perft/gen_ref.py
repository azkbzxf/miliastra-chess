# -*- coding: utf-8 -*-
"""用 python-chess 生成国际象棋走法引擎的标准答案（perft + 逐局面走法列表）。
用途：作为 Lua 走法引擎的唯一比对基准。输出 JSON。
"""
import json, sys
import chess

OUT = sys.argv[1] if len(sys.argv) > 1 else "tools_work/perft/ref.json"

def sq_name(sq): return chess.square_name(sq)

def moves_of(board):
    """返回该局面全部合法走法的规范字符串列表"""
    out = []
    for mv in board.legal_moves:
        s = sq_name(mv.from_square)
        t = sq_name(mv.to_square)
        promo = ""
        if mv.promotion:
            promo = {chess.QUEEN:"q", chess.ROOK:"r", chess.BISHOP:"b", chess.KNIGHT:"n"}[mv.promotion]
        # 用 uci 表达（含易位/吃过路兵/升变信息），最无歧义
        out.append(mv.uci())
    return sorted(out)

def perft(board, depth):
    if depth == 0: return 1
    n = 0
    for mv in board.legal_moves:
        board.push(mv)
        n += perft(board, depth - 1)
        board.pop()
    return n

# 标准 perft 局面（国际象棋界公认的基准数据）
CASES = [
  # (名称, FEN, 各深度的期望值)
  ("initial", chess.STARTING_FEN, {1:20, 2:400, 3:8902, 4:197281}),
  ("kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
   {1:48, 2:2039, 3:97862}),
  ("pos3", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", {1:14, 2:191, 3:2812, 4:43238}),
  ("pos4", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
   {1:6, 2:264, 3:9467}),
  ("pos5", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", {1:44, 2:1486, 3:62379}),
  ("pos6", "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
   {1:46, 2:2079, 3:89890}),
]

result = {"cases": []}
for name, fen, depths in CASES:
    b = chess.Board(fen)
    case = {"name": name, "fen": fen, "depths": depths,
            "perft": {}, "moves_at_root": moves_of(b)}
    for d in depths:
        case["perft"][str(d)] = perft(b, d)
    # 校验与公认值一致
    for d, expect in depths.items():
        got = case["perft"][str(d)]
        if got != expect:
            raise SystemExit("perft 不一致 %s depth=%d got=%d expect=%d" % (name, d, got, expect))
    result["cases"].append(case)

# 附加：特殊规则局面（易位/吃过路兵/升变/将死/逼和）
special = [
  ("castling_ready", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"),
  ("ep_ready", "8/8/8/3pP3/8/8/8/4K3 w - d6 0 1"),
  ("promo_ready", "8/P7/8/8/8/8/7k/4K3 w - - 0 1"),
  ("checkmate", "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"),
  ("stalemate", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"),
  ("fifty", "8/8/8/8/8/4k3/4p3/4K3 w - - 99 100"),
]
sp = []
for name, fen in special:
    b = chess.Board(fen)
    sp.append({"name": name, "fen": fen, "moves": moves_of(b),
               "is_check": b.is_check(), "is_checkmate": b.is_checkmate(),
               "is_stalemate": b.is_stalemate(), "is_game_over": b.is_game_over(),
               "status": b.status() if hasattr(b,'status') else None,
               "fen_after_none": b.fen()})
result["special"] = sp

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
print("OK wrote", OUT)
for c in result["cases"]:
    print(c["name"], "perft", c["perft"], "root_moves", len(c["moves_at_root"]))
