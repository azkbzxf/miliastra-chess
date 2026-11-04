-- tools_work/perft/engine_proto.lua  (v2)
-- 国际象棋走法引擎原型：用 perft 与 python-chess 交叉验证。
-- v2 修正：方向表改为显式 (dr, df) 对（v1 用单整数 delta + 取模拆分，负列差会拆错，导致马步丢子）；
--          make_move 改为 make/unmake（v1 每步深拷贝整盘，perft 深 4 太慢）。
--
-- 棋盘：64 格数组，格 0 = a1，格 7 = h1，格 56 = a8，格 63 = h8
--   行 rank = 格号 // 8（0 = 第 1 横排），列 file = 格号 % 8（0 = a 列）
-- 棋子：正数 = 白，负数 = 黑；绝对值 1=兵 2=马 3=象 4=车 5=后 6=王

local M = {}

local PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING = 1, 2, 3, 4, 5, 6
local WHITE, BLACK = 1, -1

-- ============================================================
-- 方向表：(dr, df) 显式二元组。这是 v1 的 bug 来源，必须这样写。
-- ============================================================
local KNIGHT_DIRS = {
  { 2, 1 }, { 2, -1 }, { 1, 2 }, { 1, -2 },
  { -1, 2 }, { -1, -2 }, { -2, 1 }, { -2, -1 },
}
local KING_DIRS = {
  { 1, 0 }, { 1, 1 }, { 0, 1 }, { -1, 1 },
  { -1, 0 }, { -1, -1 }, { 0, -1 }, { 1, -1 },
}
local BISHOP_DIRS = { { 1, 1 }, { 1, -1 }, { -1, -1 }, { -1, 1 } }
local ROOK_DIRS   = { { 1, 0 }, { 0, 1 }, { -1, 0 }, { 0, -1 } }
local QUEEN_DIRS  = {
  { 1, 0 }, { 1, 1 }, { 0, 1 }, { -1, 1 },
  { -1, 0 }, { -1, -1 }, { 0, -1 }, { 1, -1 },
}

local function sq_of(r, f) return r * 8 + f end
local function rank_of(sq) return sq // 8 end
local function file_of(sq) return sq % 8 end
local function inside(r, f) return r >= 0 and r <= 7 and f >= 0 and f <= 7 end

-- 从 sq 沿 (dr,df) 走一步，越界返回 nil
local function shift(sq, dr, df)
  local r, f = sq // 8, sq % 8
  local nr, nf = r + dr, f + df
  if nr < 0 or nr > 7 or nf < 0 or nf > 7 then return nil end
  return nr * 8 + nf
end

-- ============================================================
-- FEN
-- ============================================================
local CHAR_TO_PIECE = {
  p = -PAWN, n = -KNIGHT, b = -BISHOP, r = -ROOK, q = -QUEEN, k = -KING,
  P = PAWN, N = KNIGHT, B = BISHOP, R = ROOK, Q = QUEEN, K = KING,
}
local PIECE_TO_CHAR = {
  [-PAWN] = "p", [-KNIGHT] = "n", [-BISHOP] = "b", [-ROOK] = "r", [-QUEEN] = "q", [-KING] = "k",
  [PAWN] = "P", [KNIGHT] = "N", [BISHOP] = "B", [ROOK] = "R", [QUEEN] = "Q", [KING] = "K",
}

function M.parse_fen(fen)
  local st = {
    board = {},
    turn = WHITE,
    castling = { K = false, Q = false, k = false, q = false },
    ep = nil,
    halfmove = 0,
    fullmove = 1,
    history = {},     -- 每次走子后的局面指纹（三次重复判定）
  }
  for i = 0, 63 do st.board[i] = 0 end

  local parts = {}
  for token in string.gmatch(fen, "[^ ]+") do parts[#parts + 1] = token end
  if #parts < 4 then error("FEN 字段不足: " .. tostring(fen)) end

  local r, f = 7, 0
  for ch in string.gmatch(parts[1], ".") do
    if ch == "/" then
      r = r - 1; f = 0
    elseif ch >= "1" and ch <= "8" then
      f = f + tonumber(ch)
    else
      local piece = CHAR_TO_PIECE[ch]
      if not piece then error("FEN 非法棋子: " .. tostring(ch)) end
      st.board[sq_of(r, f)] = piece
      f = f + 1
    end
  end

  st.turn = (parts[2] == "w") and WHITE or BLACK

  if parts[3] and parts[3] ~= "-" then
    for ch in string.gmatch(parts[3], ".") do
      if ch == "K" then st.castling.K = true
      elseif ch == "Q" then st.castling.Q = true
      elseif ch == "k" then st.castling.k = true
      elseif ch == "q" then st.castling.q = true
      end
    end
  end

  if parts[4] and parts[4] ~= "-" then
    local fileChar = string.sub(parts[4], 1, 1)
    local rankNum = tonumber(string.sub(parts[4], 2, 2))
    if fileChar and rankNum then
      st.ep = sq_of(rankNum - 1, string.byte(fileChar) - string.byte("a"))
    end
  end

  if parts[5] then st.halfmove = tonumber(parts[5]) or 0 end
  if parts[6] then st.fullmove = tonumber(parts[6]) or 1 end
  return st
end

function M.fen_of(st)
  local rows = {}
  for r = 7, 0, -1 do
    local line, empty = "", 0
    for f = 0, 7 do
      local p = st.board[sq_of(r, f)]
      if p == 0 then
        empty = empty + 1
      else
        if empty > 0 then line = line .. tostring(empty); empty = 0 end
        line = line .. PIECE_TO_CHAR[p]
      end
    end
    if empty > 0 then line = line .. tostring(empty) end
    rows[#rows + 1] = line
  end
  local cs = ""
  if st.castling.K then cs = cs .. "K" end
  if st.castling.Q then cs = cs .. "Q" end
  if st.castling.k then cs = cs .. "k" end
  if st.castling.q then cs = cs .. "q" end
  if cs == "" then cs = "-" end
  local epStr = "-"
  if st.ep then
    epStr = string.char(string.byte("a") + (st.ep % 8)) .. tostring((st.ep // 8) + 1)
  end
  return table.concat(rows, "/") .. " " .. (st.turn == WHITE and "w" or "b") ..
         " " .. cs .. " " .. epStr .. " " .. tostring(st.halfmove) .. " " .. tostring(st.fullmove)
end

-- 局面指纹：只含影响「能否重复」的信息（子力摆位 + 走子方 + 易位权 + 吃过路兵）
function M.position_key(st)
  local parts = {}
  for i = 0, 63 do parts[#parts + 1] = tostring(st.board[i]) end
  local cs = ""
  if st.castling.K then cs = cs .. "K" end
  if st.castling.Q then cs = cs .. "Q" end
  if st.castling.k then cs = cs .. "k" end
  if st.castling.q then cs = cs .. "q" end
  return table.concat(parts, ",") .. "|" .. tostring(st.turn) .. "|" .. cs ..
         "|" .. (st.ep and tostring(st.ep) or "-")
end

-- ============================================================
-- 走法生成（伪合法）
-- ============================================================
local function push(moves, from, to, promo, is_ep, is_castle)
  moves[#moves + 1] = { from = from, to = to, promo = promo, ep = is_ep or false, castle = is_castle or false }
end

function M.gen_pseudo(st)
  local moves = {}
  local board = st.board
  local side = st.turn
  local isWhite = (side == WHITE)

  for from = 0, 63 do
    local p = board[from]
    if p ~= 0 and ((p > 0) == isWhite) then
      local ap = (p > 0) and p or -p
      local r, f = rank_of(from), file_of(from)

      if ap == PAWN then
        local fwd = isWhite and 1 or -1
        local startRank = isWhite and 1 or 6
        local promoRank = isWhite and 7 or 0
        local one = shift(from, fwd, 0)
        if one and board[one] == 0 then
          if rank_of(one) == promoRank then
            push(moves, from, one, QUEEN); push(moves, from, one, ROOK)
            push(moves, from, one, BISHOP); push(moves, from, one, KNIGHT)
          else
            push(moves, from, one, nil)
            if r == startRank then
              local two = shift(one, fwd, 0)
              if two and board[two] == 0 then push(moves, from, two, nil) end
            end
          end
        end
        for _, df in ipairs({ -1, 1 }) do
          local to = shift(from, fwd, df)
          if to then
            local target = board[to]
            if target ~= 0 and (target > 0) ~= isWhite then
              if rank_of(to) == promoRank then
                push(moves, from, to, QUEEN); push(moves, from, to, ROOK)
                push(moves, from, to, BISHOP); push(moves, from, to, KNIGHT)
              else
                push(moves, from, to, nil)
              end
            elseif st.ep and to == st.ep then
              push(moves, from, to, nil, true)
            end
          end
        end

      elseif ap == KNIGHT then
        for _, d in ipairs(KNIGHT_DIRS) do
          local to = shift(from, d[1], d[2])
          if to then
            local target = board[to]
            if target == 0 or (target > 0) ~= isWhite then push(moves, from, to, nil) end
          end
        end

      elseif ap == KING then
        for _, d in ipairs(KING_DIRS) do
          local to = shift(from, d[1], d[2])
          if to then
            local target = board[to]
            if target == 0 or (target > 0) ~= isWhite then push(moves, from, to, nil) end
          end
        end
        local homeRank = isWhite and 0 or 7
        if r == homeRank and f == 4 then
          local rookPiece = isWhite and ROOK or -ROOK
          local kOK = isWhite and st.castling.K or (not isWhite) and st.castling.k
          local qOK = isWhite and st.castling.Q or (not isWhite) and st.castling.q
          local rookK = sq_of(homeRank, 7)
          local rookQ = sq_of(homeRank, 0)
          if kOK and board[rookK] == rookPiece
             and board[sq_of(homeRank, 5)] == 0 and board[sq_of(homeRank, 6)] == 0 then
            push(moves, from, sq_of(homeRank, 6), nil, false, true)
          end
          if qOK and board[rookQ] == rookPiece
             and board[sq_of(homeRank, 3)] == 0 and board[sq_of(homeRank, 2)] == 0
             and board[sq_of(homeRank, 1)] == 0 then
            push(moves, from, sq_of(homeRank, 2), nil, false, true)
          end
        end

      else
        local dirs
        if ap == BISHOP then dirs = BISHOP_DIRS
        elseif ap == ROOK then dirs = ROOK_DIRS
        else dirs = QUEEN_DIRS end
        for _, d in ipairs(dirs) do
          local cur = from
          while true do
            local to = shift(cur, d[1], d[2])
            if not to then break end
            local target = board[to]
            if target == 0 then
              push(moves, from, to, nil)
              cur = to
            else
              if (target > 0) ~= isWhite then push(moves, from, to, nil) end
              break
            end
          end
        end
      end
    end
  end
  return moves
end

-- ============================================================
-- 攻击检测
-- ============================================================
function M.is_attacked(st, sq, by_side)
  local board = st.board
  local isWhite = (by_side == WHITE)

  -- 兵：白兵在 sq 下方（rank-1）斜上攻击；黑兵在 sq 上方（rank+1）斜下攻击
  local pr = (sq // 8) + (isWhite and -1 or 1)
  if pr >= 0 and pr <= 7 then
    for _, df in ipairs({ -1, 1 }) do
      local pf = (sq % 8) + df
      if pf >= 0 and pf <= 7 then
        local p = board[sq_of(pr, pf)]
        if p ~= 0 and ((p > 0) == isWhite) and ((p > 0) and p or -p) == PAWN then return true end
      end
    end
  end

  -- 马：从 sq 反向找
  for _, d in ipairs(KNIGHT_DIRS) do
    local from = shift(sq, -d[1], -d[2])
    if from then
      local p = board[from]
      if p ~= 0 and ((p > 0) == isWhite) and ((p > 0) and p or -p) == KNIGHT then return true end
    end
  end

  -- 王：相邻
  for _, d in ipairs(KING_DIRS) do
    local from = shift(sq, -d[1], -d[2])
    if from then
      local p = board[from]
      if p ~= 0 and ((p > 0) == isWhite) and ((p > 0) and p or -p) == KING then return true end
    end
  end

  -- 车 / 后（直线）
  for _, d in ipairs(ROOK_DIRS) do
    local cur = sq
    while true do
      local to = shift(cur, d[1], d[2])
      if not to then break end
      local p = board[to]
      if p ~= 0 then
        if (p > 0) == isWhite then
          local ap = (p > 0) and p or -p
          if ap == ROOK or ap == QUEEN then return true end
        end
        break
      end
      cur = to
    end
  end

  -- 象 / 后（斜线）
  for _, d in ipairs(BISHOP_DIRS) do
    local cur = sq
    while true do
      local to = shift(cur, d[1], d[2])
      if not to then break end
      local p = board[to]
      if p ~= 0 then
        if (p > 0) == isWhite then
          local ap = (p > 0) and p or -p
          if ap == BISHOP or ap == QUEEN then return true end
        end
        break
      end
      cur = to
    end
  end

  return false
end

function M.find_king(st, side)
  local kingPiece = (side == WHITE) and KING or -KING
  for i = 0, 63 do
    if st.board[i] == kingPiece then return i end
  end
  return nil
end

function M.in_check(st, side)
  local ksq = M.find_king(st, side)
  if not ksq then return false end
  return M.is_attacked(st, ksq, -side)
end

-- ============================================================
-- make / unmake（mutates st，返回 undo 记录）
-- ============================================================
function M.make(st, mv)
  local board = st.board
  local side = st.turn
  local moving = board[mv.from]

  local undo = {
    mv = mv,
    captured = board[mv.to],
    capturedSq = mv.to,
    epBefore = st.ep,
    castling = { K = st.castling.K, Q = st.castling.Q, k = st.castling.k, q = st.castling.q },
    halfmove = st.halfmove,
    fullmove = st.fullmove,
    turn = st.turn,
    castleRookFrom = nil,
    castleRookTo = nil,
  }

  -- 吃过路兵：被吃的兵在 to 的「身后」
  if mv.ep then
    local capSq = shift(mv.to, side == WHITE and -1 or 1, 0)
    undo.captured = board[capSq]
    undo.capturedSq = capSq
    board[capSq] = 0
  end

  board[mv.to] = mv.promo and (side == WHITE and mv.promo or -mv.promo) or moving
  board[mv.from] = 0

  -- 易位：车跟着动
  if mv.castle then
    local homeRank = (side == WHITE) and 0 or 7
    if mv.to == sq_of(homeRank, 6) then
      undo.castleRookFrom = sq_of(homeRank, 7)
      undo.castleRookTo = sq_of(homeRank, 5)
    else
      undo.castleRookFrom = sq_of(homeRank, 0)
      undo.castleRookTo = sq_of(homeRank, 3)
    end
    board[undo.castleRookTo] = board[undo.castleRookFrom]
    board[undo.castleRookFrom] = 0
  end

  -- 易位权
  local ap = (moving > 0) and moving or -moving
  if ap == KING then
    if side == WHITE then st.castling.K, st.castling.Q = false, false
    else st.castling.k, st.castling.q = false, false end
  elseif ap == ROOK then
    if mv.from == sq_of(0, 0) then st.castling.Q = false
    elseif mv.from == sq_of(0, 7) then st.castling.K = false
    elseif mv.from == sq_of(7, 0) then st.castling.q = false
    elseif mv.from == sq_of(7, 7) then st.castling.k = false end
  end
  if mv.to == sq_of(0, 0) then st.castling.Q = false
  elseif mv.to == sq_of(0, 7) then st.castling.K = false
  elseif mv.to == sq_of(7, 0) then st.castling.q = false
  elseif mv.to == sq_of(7, 7) then st.castling.k = false end

  -- 吃过路兵目标
  st.ep = nil
  if ap == PAWN and math.abs(mv.to - mv.from) == 16 then
    st.ep = (mv.from + mv.to) // 2
  end

  -- 五十步
  if ap == PAWN or undo.captured ~= 0 then st.halfmove = 0 else st.halfmove = st.halfmove + 1 end
  if side == BLACK then st.fullmove = st.fullmove + 1 end
  st.turn = -side
  st.history[#st.history + 1] = M.position_key(st)
  return undo
end

function M.unmake(st, undo)
  local mv = undo.mv
  local side = undo.turn
  local board = st.board

  st.history[#st.history] = nil
  st.turn = side
  st.ep = undo.epBefore
  st.castling.K, st.castling.Q = undo.castling.K, undo.castling.Q
  st.castling.k, st.castling.q = undo.castling.k, undo.castling.q
  st.halfmove = undo.halfmove
  st.fullmove = undo.fullmove

  if undo.castleRookFrom then
    board[undo.castleRookFrom] = board[undo.castleRookTo]
    board[undo.castleRookTo] = 0
  end

  board[mv.from] = mv.promo and (side == WHITE and PAWN or -PAWN) or board[mv.to]
  board[mv.to] = 0
  board[undo.capturedSq] = undo.captured
end

-- ============================================================
-- 合法性
-- ============================================================
function M.is_legal(st, mv)
  local side = st.turn

  if mv.castle then
    -- 起点不能正在被将军
    if M.in_check(st, side) then return false end
    -- 经过的格不能被攻击
    local homeRank = (side == WHITE) and 0 or 7
    local kingSq = sq_of(homeRank, 4)
    local midSq = (mv.to > kingSq) and sq_of(homeRank, 5) or sq_of(homeRank, 3)
    local board = st.board
    local savedKing = board[kingSq]
    board[kingSq] = 0
    board[midSq] = savedKing
    local attacked = M.is_attacked(st, midSq, -side)
    board[midSq] = 0
    board[kingSq] = savedKing
    if attacked then return false end
  end

  local undo = M.make(st, mv)
  local ok = not M.in_check(st, side)
  M.unmake(st, undo)
  return ok
end

function M.legal_moves(st)
  local out = {}
  for _, mv in ipairs(M.gen_pseudo(st)) do
    if M.is_legal(st, mv) then out[#out + 1] = mv end
  end
  return out
end

-- ============================================================
-- 终局
-- ============================================================
function M.is_checkmate(st)
  if not M.in_check(st, st.turn) then return false end
  return #M.legal_moves(st) == 0
end

function M.is_stalemate(st)
  if M.in_check(st, st.turn) then return false end
  return #M.legal_moves(st) == 0
end

function M.is_insufficient_material(st)
  local minors = {}
  local pawnsOrMajors = 0
  for i = 0, 63 do
    local p = st.board[i]
    if p ~= 0 then
      local ap = (p > 0) and p or -p
      if ap ~= KING then
        if ap == PAWN or ap == ROOK or ap == QUEEN then
          pawnsOrMajors = pawnsOrMajors + 1
        else
          minors[#minors + 1] = { sq = i, ap = ap }
        end
      end
    end
  end
  if pawnsOrMajors > 0 then return false end
  if #minors == 0 then return true end          -- 王 vs 王
  if #minors == 1 then return true end          -- 王+单马/单象 vs 王
  if #minors == 2 then
    local a, b = minors[1], minors[2]
    if a.ap == BISHOP and b.ap == BISHOP then
      local sa = (rank_of(a.sq) + file_of(a.sq)) % 2
      local sb = (rank_of(b.sq) + file_of(b.sq)) % 2
      return sa == sb                            -- 同色格象 vs 同色格象
    end
    return false
  end
  return false
end

function M.is_threefold(st)
  local key = M.position_key(st)
  local count = 1                            -- 当前局面自身算一次
  for _, k in ipairs(st.history) do
    if k == key then count = count + 1 end
  end
  return count >= 3
end

function M.is_fifty_move(st)
  return st.halfmove >= 100
end

function M.game_status(st)
  if M.is_checkmate(st) then
    return { over = true, result = (st.turn == WHITE) and "0-1" or "1-0", reason = "checkmate" }
  end
  if M.is_stalemate(st) then
    return { over = true, result = "1/2-1/2", reason = "stalemate" }
  end
  if M.is_insufficient_material(st) then
    return { over = true, result = "1/2-1/2", reason = "insufficient" }
  end
  if M.is_threefold(st) then
    return { over = true, result = "1/2-1/2", reason = "threefold" }
  end
  if M.is_fifty_move(st) then
    return { over = true, result = "1/2-1/2", reason = "fifty" }
  end
  return { over = false, result = nil, reason = nil }
end

-- ============================================================
-- perft
-- ============================================================
function M.perft(st, depth)
  if depth == 0 then return 1 end
  local n = 0
  -- 必须用完整 is_legal：易位要检查「起点/经过格是否被攻击」，
  -- 用 is_legal_fast 会漏掉这条，kiwipete d=2 会多算 4 步（实测 2043 vs 2039）。
  for _, mv in ipairs(M.gen_pseudo(st)) do
    if M.is_legal(st, mv) then
      local undo = M.make(st, mv)
      n = n + M.perft(st, depth - 1)
      M.unmake(st, undo)
    end
  end
  return n
end

-- 快速合法性（仅供玩法内高频调用；易位路径检查由调用方先保证）
-- 注意：**不要**在 perft / 走法校验里用它，否则会漏掉易位路径攻击检查。
function M.is_legal_fast(st, mv)
  local side = st.turn
  local undo = M.make(st, mv)
  local ok = not M.in_check(st, side)
  M.unmake(st, undo)
  return ok
end

-- ============================================================
-- UCI
-- ============================================================
function M.uci_of(mv)
  local function sqname(sq)
    return string.char(string.byte("a") + (sq % 8)) .. tostring((sq // 8) + 1)
  end
  local s = sqname(mv.from) .. sqname(mv.to)
  if mv.promo then
    local chars = { [QUEEN] = "q", [ROOK] = "r", [BISHOP] = "b", [KNIGHT] = "n" }
    s = s .. chars[mv.promo]
  end
  return s
end

function M.legal_uci_list(st)
  local out = {}
  for _, mv in ipairs(M.legal_moves(st)) do out[#out + 1] = M.uci_of(mv) end
  table.sort(out)
  return out
end

-- 按 UCI 字符串找走法
function M.find_move(st, uci)
  for _, mv in ipairs(M.legal_moves(st)) do
    if M.uci_of(mv) == uci then return mv end
  end
  return nil
end

-- 走法中文名（给界面用）
function M.piece_char(p)
  local ap = (p > 0) and p or -p
  if ap == KING then return "K" elseif ap == QUEEN then return "Q"
  elseif ap == ROOK then return "R" elseif ap == BISHOP then return "B"
  elseif ap == KNIGHT then return "N" elseif ap == PAWN then return "P" end
  return "?"
end

M.constants = { PAWN = PAWN, KNIGHT = KNIGHT, BISHOP = BISHOP, ROOK = ROOK, QUEEN = QUEEN, KING = KING,
                WHITE = WHITE, BLACK = BLACK }

return M
