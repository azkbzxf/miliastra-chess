
/* ============================================================================
   规则引擎（内联，与 tools_work/chess_rules.js 相同；由 tools_work/build_demo.cjs 注入）
   ============================================================================ */
/* ---- perft 用例（从 lua/levelScript.lua 抽取） ---- */
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

/* ---- 规则引擎 ---- */
// tools_work/chess_rules.js
// 国际象棋走法引擎（JS 版）—— 与 lua/levelScript.lua 第 3 区 RULES **逐函数对照移植**。
// 来源：Lua 规则层（perft 深度 3 与 python-chess 标准答案全部一致）。
// 移植纪律：函数名、算法结构、边界处理与 Lua 保持一致；改一处必须两处同步。
//
// 棋盘：64 格数组，格 0 = a1，格 7 = h1，格 56 = a8，格 63 = h8
//   rank = sq >> 3（0 = 第 1 横排），file = sq & 7（0 = a 列）
// 棋子：正数 = 白，负数 = 黑；1=兵 2=马 3=象 4=车 5=后 6=王
"use strict";

const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const WHITE = 1, BLACK = -1;

// 方向表：(dr, df) 显式二元组。【教训】不能用单整数 delta + 取模拆分（负列差会拆错，马步丢子）
const KNIGHT_DIRS = [[2,1],[2,-1],[1,2],[1,-2],[-1,2],[-1,-2],[-2,1],[-2,-1]];
const KING_DIRS   = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const BISHOP_DIRS = [[1,1],[1,-1],[-1,-1],[-1,1]];
const ROOK_DIRS   = [[1,0],[0,1],[-1,0],[0,-1]];
const QUEEN_DIRS  = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

const rankOf = (sq) => sq >> 3;
const fileOf = (sq) => sq & 7;

// 从 sq 沿 (dr,df) 走一步，越界返回 -1
function shift(sq, dr, df) {
  const r = (sq >> 3) + dr, f = (sq & 7) + df;
  if (r < 0 || r > 7 || f < 0 || f > 7) return -1;
  return r * 8 + f;
}

const CHAR_TO_PIECE = {
  p: -PAWN, n: -KNIGHT, b: -BISHOP, r: -ROOK, q: -QUEEN, k: -KING,
  P: PAWN, N: KNIGHT, B: BISHOP, R: ROOK, Q: QUEEN, K: KING,
};
const PIECE_TO_CHAR = {
  [-PAWN]:"p", [-KNIGHT]:"n", [-BISHOP]:"b", [-ROOK]:"r", [-QUEEN]:"q", [-KING]:"k",
  [PAWN]:"P", [KNIGHT]:"N", [BISHOP]:"B", [ROOK]:"R", [QUEEN]:"Q", [KING]:"K",
};
const PIECE_LETTER = {
  [-PAWN]:"P", [-KNIGHT]:"N", [-BISHOP]:"B", [-ROOK]:"R", [-QUEEN]:"Q", [-KING]:"K",
  [PAWN]:"P", [KNIGHT]:"N", [BISHOP]:"B", [ROOK]:"R", [QUEEN]:"Q", [KING]:"K",
};

// ---------------- FEN ----------------
function parseFen(fen) {
  const st = {
    board: new Int8Array(64),
    turn: WHITE,
    castling: { K:false, Q:false, k:false, q:false },
    ep: -1,
    halfmove: 0,
    fullmove: 1,
    history: [],
  };
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error("FEN 字段不足: " + fen);

  let r = 7, f = 0;
  for (const ch of parts[0]) {
    if (ch === "/") { r--; f = 0; }
    else if (ch >= "1" && ch <= "8") { f += Number(ch); }
    else {
      const piece = CHAR_TO_PIECE[ch];
      if (!piece) throw new Error("FEN 非法棋子: " + ch);
      st.board[r * 8 + f] = piece;
      f++;
    }
  }
  st.turn = parts[1] === "w" ? WHITE : BLACK;
  if (parts[2] && parts[2] !== "-") {
    for (const ch of parts[2]) {
      if (ch === "K") st.castling.K = true;
      else if (ch === "Q") st.castling.Q = true;
      else if (ch === "k") st.castling.k = true;
      else if (ch === "q") st.castling.q = true;
    }
  }
  if (parts[3] && parts[3] !== "-") {
    const fc = parts[3][0], rn = Number(parts[3][1]);
    if (fc && rn) st.ep = (rn - 1) * 8 + (fc.charCodeAt(0) - 97);
  }
  if (parts[4]) st.halfmove = Number(parts[4]) || 0;
  if (parts[5]) st.fullmove = Number(parts[5]) || 1;
  return st;
}

function fenOf(st) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let line = "", empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = st.board[r * 8 + f];
      if (p === 0) empty++;
      else { if (empty > 0) { line += empty; empty = 0; } line += PIECE_TO_CHAR[p]; }
    }
    if (empty > 0) line += empty;
    rows.push(line);
  }
  let cs = "";
  if (st.castling.K) cs += "K";
  if (st.castling.Q) cs += "Q";
  if (st.castling.k) cs += "k";
  if (st.castling.q) cs += "q";
  if (cs === "") cs = "-";
  let epStr = "-";
  if (st.ep >= 0) epStr = String.fromCharCode(97 + (st.ep & 7)) + ((st.ep >> 3) + 1);
  return rows.join("/") + " " + (st.turn === WHITE ? "w" : "b") + " " + cs + " " + epStr +
         " " + st.halfmove + " " + st.fullmove;
}

function positionKey(st) {
  const parts = [];
  for (let i = 0; i < 64; i++) parts.push(st.board[i]);
  let cs = "";
  if (st.castling.K) cs += "K";
  if (st.castling.Q) cs += "Q";
  if (st.castling.k) cs += "k";
  if (st.castling.q) cs += "q";
  return parts.join(",") + "|" + st.turn + "|" + cs + "|" + (st.ep >= 0 ? st.ep : "-");
}

// ---------------- 走法生成（伪合法） ----------------
function push(moves, from, to, promo, isEp, isCastle) {
  moves.push({ from, to, promo: promo || null, ep: !!isEp, castle: !!isCastle });
}

function genPseudo(st) {
  const moves = [];
  const board = st.board;
  const isWhite = st.turn === WHITE;

  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (p === 0 || (p > 0) !== isWhite) continue;
    const ap = p > 0 ? p : -p;
    const r = rankOf(from), f = fileOf(from);

    if (ap === PAWN) {
      const fwd = isWhite ? 1 : -1;
      const startRank = isWhite ? 1 : 6;
      const promoRank = isWhite ? 7 : 0;
      const one = shift(from, fwd, 0);
      if (one >= 0 && board[one] === 0) {
        if (rankOf(one) === promoRank) {
          push(moves, from, one, QUEEN); push(moves, from, one, ROOK);
          push(moves, from, one, BISHOP); push(moves, from, one, KNIGHT);
        } else {
          push(moves, from, one, null);
          if (r === startRank) {
            const two = shift(one, fwd, 0);
            if (two >= 0 && board[two] === 0) push(moves, from, two, null);
          }
        }
      }
      for (const df of [-1, 1]) {
        const to = shift(from, fwd, df);
        if (to < 0) continue;
        const target = board[to];
        if (target !== 0 && (target > 0) !== isWhite) {
          if (rankOf(to) === promoRank) {
            push(moves, from, to, QUEEN); push(moves, from, to, ROOK);
            push(moves, from, to, BISHOP); push(moves, from, to, KNIGHT);
          } else push(moves, from, to, null);
        } else if (st.ep >= 0 && to === st.ep) {
          push(moves, from, to, null, true);
        }
      }

    } else if (ap === KNIGHT) {
      for (const [dr, df] of KNIGHT_DIRS) {
        const to = shift(from, dr, df);
        if (to < 0) continue;
        const target = board[to];
        if (target === 0 || (target > 0) !== isWhite) push(moves, from, to, null);
      }

    } else if (ap === KING) {
      for (const [dr, df] of KING_DIRS) {
        const to = shift(from, dr, df);
        if (to < 0) continue;
        const target = board[to];
        if (target === 0 || (target > 0) !== isWhite) push(moves, from, to, null);
      }
      const homeRank = isWhite ? 0 : 7;
      if (r === homeRank && f === 4) {
        const rookPiece = isWhite ? ROOK : -ROOK;
        const kOK = isWhite ? st.castling.K : st.castling.k;
        const qOK = isWhite ? st.castling.Q : st.castling.q;
        const rookK = homeRank * 8 + 7;
        const rookQ = homeRank * 8 + 0;
        if (kOK && board[rookK] === rookPiece &&
            board[homeRank*8+5] === 0 && board[homeRank*8+6] === 0) {
          push(moves, from, homeRank*8+6, null, false, true);
        }
        if (qOK && board[rookQ] === rookPiece &&
            board[homeRank*8+3] === 0 && board[homeRank*8+2] === 0 && board[homeRank*8+1] === 0) {
          push(moves, from, homeRank*8+2, null, false, true);
        }
      }

    } else {
      const dirs = ap === BISHOP ? BISHOP_DIRS : (ap === ROOK ? ROOK_DIRS : QUEEN_DIRS);
      for (const [dr, df] of dirs) {
        let cur = from;
        while (true) {
          const to = shift(cur, dr, df);
          if (to < 0) break;
          const target = board[to];
          if (target === 0) { push(moves, from, to, null); cur = to; }
          else { if ((target > 0) !== isWhite) push(moves, from, to, null); break; }
        }
      }
    }
  }
  return moves;
}

// ---------------- 攻击检测 ----------------
function isAttacked(st, sq, bySide) {
  const board = st.board;
  const isWhite = bySide === WHITE;

  // 兵
  const pr = (sq >> 3) + (isWhite ? -1 : 1);
  if (pr >= 0 && pr <= 7) {
    for (const df of [-1, 1]) {
      const pf = (sq & 7) + df;
      if (pf >= 0 && pf <= 7) {
        const p = board[pr * 8 + pf];
        if (p !== 0 && (p > 0) === isWhite && (p > 0 ? p : -p) === PAWN) return true;
      }
    }
  }
  // 马
  for (const [dr, df] of KNIGHT_DIRS) {
    const from = shift(sq, -dr, -df);
    if (from < 0) continue;
    const p = board[from];
    if (p !== 0 && (p > 0) === isWhite && (p > 0 ? p : -p) === KNIGHT) return true;
  }
  // 王
  for (const [dr, df] of KING_DIRS) {
    const from = shift(sq, -dr, -df);
    if (from < 0) continue;
    const p = board[from];
    if (p !== 0 && (p > 0) === isWhite && (p > 0 ? p : -p) === KING) return true;
  }
  // 车/后（直线）
  for (const [dr, df] of ROOK_DIRS) {
    let cur = sq;
    while (true) {
      const to = shift(cur, dr, df);
      if (to < 0) break;
      const p = board[to];
      if (p !== 0) {
        if ((p > 0) === isWhite) { const ap = p > 0 ? p : -p; if (ap === ROOK || ap === QUEEN) return true; }
        break;
      }
      cur = to;
    }
  }
  // 象/后（斜线）
  for (const [dr, df] of BISHOP_DIRS) {
    let cur = sq;
    while (true) {
      const to = shift(cur, dr, df);
      if (to < 0) break;
      const p = board[to];
      if (p !== 0) {
        if ((p > 0) === isWhite) { const ap = p > 0 ? p : -p; if (ap === BISHOP || ap === QUEEN) return true; }
        break;
      }
      cur = to;
    }
  }
  return false;
}

function findKing(st, side) {
  const kingPiece = side === WHITE ? KING : -KING;
  for (let i = 0; i < 64; i++) if (st.board[i] === kingPiece) return i;
  return -1;
}

function inCheck(st, side) {
  const ksq = findKing(st, side);
  if (ksq < 0) return false;
  return isAttacked(st, ksq, -side);
}

// ---------------- make / unmake ----------------
function make(st, mv) {
  const board = st.board;
  const side = st.turn;
  const moving = board[mv.from];
  const undo = {
    mv,
    captured: board[mv.to],
    capturedSq: mv.to,
    epBefore: st.ep,
    castling: { K: st.castling.K, Q: st.castling.Q, k: st.castling.k, q: st.castling.q },
    halfmove: st.halfmove,
    fullmove: st.fullmove,
    turn: st.turn,
    castleRookFrom: -1,
    castleRookTo: -1,
  };

  if (mv.ep) {
    const capSq = shift(mv.to, side === WHITE ? -1 : 1, 0);
    undo.captured = board[capSq];
    undo.capturedSq = capSq;
    board[capSq] = 0;
  }

  board[mv.to] = mv.promo ? (side === WHITE ? mv.promo : -mv.promo) : moving;
  board[mv.from] = 0;

  if (mv.castle) {
    const homeRank = side === WHITE ? 0 : 7;
    if (mv.to === homeRank * 8 + 6) {
      undo.castleRookFrom = homeRank * 8 + 7;
      undo.castleRookTo = homeRank * 8 + 5;
    } else {
      undo.castleRookFrom = homeRank * 8 + 0;
      undo.castleRookTo = homeRank * 8 + 3;
    }
    board[undo.castleRookTo] = board[undo.castleRookFrom];
    board[undo.castleRookFrom] = 0;
  }

  const ap = moving > 0 ? moving : -moving;
  if (ap === KING) {
    if (side === WHITE) { st.castling.K = false; st.castling.Q = false; }
    else { st.castling.k = false; st.castling.q = false; }
  } else if (ap === ROOK) {
    if (mv.from === 0) st.castling.Q = false;
    else if (mv.from === 7) st.castling.K = false;
    else if (mv.from === 56) st.castling.q = false;
    else if (mv.from === 63) st.castling.k = false;
  }
  if (mv.to === 0) st.castling.Q = false;
  else if (mv.to === 7) st.castling.K = false;
  else if (mv.to === 56) st.castling.q = false;
  else if (mv.to === 63) st.castling.k = false;

  st.ep = -1;
  if (ap === PAWN && Math.abs(mv.to - mv.from) === 16) st.ep = (mv.from + mv.to) >> 1;

  if (ap === PAWN || undo.captured !== 0) st.halfmove = 0; else st.halfmove++;
  if (side === BLACK) st.fullmove++;
  st.turn = -side;
  st.history.push(positionKey(st));
  return undo;
}

function unmake(st, undo) {
  const mv = undo.mv;
  const side = undo.turn;
  const board = st.board;

  st.history.pop();
  st.turn = side;
  st.ep = undo.epBefore;
  st.castling.K = undo.castling.K; st.castling.Q = undo.castling.Q;
  st.castling.k = undo.castling.k; st.castling.q = undo.castling.q;
  st.halfmove = undo.halfmove;
  st.fullmove = undo.fullmove;

  if (undo.castleRookFrom >= 0) {
    board[undo.castleRookFrom] = board[undo.castleRookTo];
    board[undo.castleRookTo] = 0;
  }
  board[mv.from] = mv.promo ? (side === WHITE ? PAWN : -PAWN) : board[mv.to];
  board[mv.to] = 0;
  board[undo.capturedSq] = undo.captured;
}

// 合法性：必须检查易位路径。【教训】perft 曾因跳过这条多算 4 步（2043 vs 2039）
function isLegal(st, mv) {
  const side = st.turn;
  if (mv.castle) {
    if (inCheck(st, side)) return false;
    const homeRank = side === WHITE ? 0 : 7;
    const kingSq = homeRank * 8 + 4;
    const midSq = mv.to > kingSq ? homeRank * 8 + 5 : homeRank * 8 + 3;
    const board = st.board;
    const savedKing = board[kingSq];
    board[kingSq] = 0;
    board[midSq] = savedKing;
    const attacked = isAttacked(st, midSq, -side);
    board[midSq] = 0;
    board[kingSq] = savedKing;
    if (attacked) return false;
  }
  const undo = make(st, mv);
  const ok = !inCheck(st, side);
  unmake(st, undo);
  return ok;
}

function legalMoves(st) {
  const out = [];
  for (const mv of genPseudo(st)) if (isLegal(st, mv)) out.push(mv);
  return out;
}

function isCheckmate(st) {
  if (!inCheck(st, st.turn)) return false;
  return legalMoves(st).length === 0;
}
function isStalemate(st) {
  if (inCheck(st, st.turn)) return false;
  return legalMoves(st).length === 0;
}

function isInsufficientMaterial(st) {
  const minors = [];
  let majors = 0;
  for (let i = 0; i < 64; i++) {
    const p = st.board[i];
    if (p === 0) continue;
    const ap = p > 0 ? p : -p;
    if (ap === KING) continue;
    if (ap === PAWN || ap === ROOK || ap === QUEEN) majors++;
    else minors.push({ sq: i, ap });
  }
  if (majors > 0) return false;
  if (minors.length === 0) return true;
  if (minors.length === 1) return true;
  if (minors.length === 2) {
    const a = minors[0], b = minors[1];
    if (a.ap === BISHOP && b.ap === BISHOP) {
      const sa = (rankOf(a.sq) + fileOf(a.sq)) % 2;
      const sb = (rankOf(b.sq) + fileOf(b.sq)) % 2;
      return sa === sb;
    }
    return false;
  }
  return false;
}

function isThreefold(st) {
  const key = positionKey(st);
  let count = 1;
  for (const k of st.history) if (k === key) count++;
  return count >= 3;
}
function isFiftyMove(st) { return st.halfmove >= 100; }

function gameStatus(st) {
  if (isCheckmate(st)) return { over:true, result: st.turn === WHITE ? "0-1" : "1-0", reason:"checkmate" };
  if (isStalemate(st)) return { over:true, result:"1/2-1/2", reason:"stalemate" };
  if (isInsufficientMaterial(st)) return { over:true, result:"1/2-1/2", reason:"insufficient" };
  if (isThreefold(st)) return { over:true, result:"1/2-1/2", reason:"threefold" };
  if (isFiftyMove(st)) return { over:true, result:"1/2-1/2", reason:"fifty" };
  return { over:false, result:null, reason:null };
}

function perft(st, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const mv of genPseudo(st)) {
    if (isLegal(st, mv)) {
      const undo = make(st, mv);
      n += perft(st, depth - 1);
      unmake(st, undo);
    }
  }
  return n;
}

function sqName(sq) {
  return String.fromCharCode(97 + (sq & 7)) + ((sq >> 3) + 1);
}
function uciOf(mv) {
  let s = sqName(mv.from) + sqName(mv.to);
  if (mv.promo) s += { [QUEEN]:"q", [ROOK]:"r", [BISHOP]:"b", [KNIGHT]:"n" }[mv.promo];
  return s;
}
function findMove(st, uci) {
  for (const mv of legalMoves(st)) if (uciOf(mv) === uci) return mv;
  return null;
}
function legalUciList(st) {
  return legalMoves(st).map(uciOf).sort();
}

// 导出（浏览器与 Node 通用）
const CHESS_RULES = {
  PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, BLACK,
  PIECE_LETTER,
  parseFen, fenOf, positionKey, genPseudo, isAttacked, findKing, inCheck,
  make, unmake, isLegal, legalMoves, isCheckmate, isStalemate,
  isInsufficientMaterial, isThreefold, isFiftyMove, gameStatus, perft,
  sqName, uciOf, findMove, legalUciList,
};
if (typeof module === "object" && module.exports) module.exports = CHESS_RULES;
if (typeof window !== "undefined") window.CHESS_RULES = CHESS_RULES;

