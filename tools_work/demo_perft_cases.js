// 由 tools_work/build_demo_rules.cjs 从 lua/levelScript.lua 抽取，勿手改
const PERFT_CASES = [
  {
    "name": "initial",
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "d1": 20,
    "d2": 400,
    "d3": 8902
  },
  {
    "name": "kiwipete",
    "fen": "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    "d1": 48,
    "d2": 2039,
    "d3": 97862
  },
  {
    "name": "pos3",
    "fen": "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    "d1": 14,
    "d2": 191,
    "d3": 2812
  },
  {
    "name": "pos4",
    "fen": "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    "d1": 6,
    "d2": 264,
    "d3": 9467
  },
  {
    "name": "pos5",
    "fen": "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    "d1": 44,
    "d2": 1486,
    "d3": 62379
  },
  {
    "name": "pos6",
    "fen": "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    "d1": 46,
    "d2": 2079,
    "d3": 89890
  }
];
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
