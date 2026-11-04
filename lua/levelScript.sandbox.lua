-- =============================================================================
--  levelScript.sandbox.lua · 【沙箱测试副本，不是交付文件】
--  由 tools_work/make_sandbox_copy.mjs 从 lua/levelScript.lua 生成；
--  只把 CONFIG 三个占位 0 换成沙箱可用值，其余逐字相同。不要交付这一份。
--
--  levelScript.lua · 黑白棋局（千星奇域 纯 2D 双人国际象棋）
-- =============================================================================
--  生成时间：2026-10-31 (Asia/Shanghai)
--  接口依据：C:\Users\24037\Downloads\MiliastraAgent\release\Lua客户端控件API文档.md
--            sha256 = 771a94faacfa32a8855bfb28a60484f8f0e09b3b0907971612a2441ac3d482ba
--  编辑器指南：客户端控件及脚本使用指南.md
--            sha256 = bf1a59eb5e35d0485deca8cdae6f810b0d839e4fa285c918a3040a0ba7e94117
--  设计依据：docs/策划案.md（v1，2026-10-31）
--  规则依据：tools_work/perft/engine_proto.lua（perft 深度 3 与 python-chess 标准答案全部一致）
--
--  运行环境：Lua 5.3。不可用：io.* / coroutine.* / string.dump /
--            os.*（仅 os.time/os.date/os.clock/os.difftime）/ debug.*（仅 debug.traceback）
--  单文件模式（用户身份：萌新）。分区顺序与初始化顺序一致：
--    第 1 区  CONFIG      编辑器侧常量（用户需填 3 个值）
--    第 2 区  LOG         日志与故障块
--    第 3 区  RULES       走法规则引擎（已验证）
--    第 4 区  LAYOUT      唯一坐标换算入口
--    第 5 区  FACTORY     控件工厂（固定创建顺序）
--    第 6 区  UI          界面构建
--    第 7 区  GAME        业务状态与流程
--    第 8 区  INPUT       输入（原生命中，不读坐标）
--    第 9 区  NET         联机（能力探测 + 降级）
--    第 10 区 LIFECYCLE   生命周期与清理
--    第 11 区 SELFTEST    自检入口（不参与玩法）
-- =============================================================================

-- =============================================================================
-- 第 1 区：CONFIG
-- =============================================================================
local CONFIG = {
  -- ===== 必须由用户在编辑器里填的真实值 =====
  -- 三项为 0 时脚本会立即报「界面零件还没配好」并停止，不做无意义重试。
  CONTAINER_NODE_INDEX = 1,      -- [沙箱副本] 占位非零值
  PREFAB_TEXT_BOX      = 1,      -- [沙箱副本] 占位非零值
  PREFAB_CURSOR_AREA   = 2,      -- [沙箱副本] 占位非零值
  PREFAB_IMAGE         = 3,      -- [沙箱副本] 占位非零值

  -- ===== 棋子样式（两档，游戏内可切换）=====
  -- 【为什么不用「上传自己的棋子图」】
  -- 千星奇域的图片控件只支持 StaticReference（官方固定白名单）与 Prefab（元件图标），
  -- 没有任何上传自定义图片的入口（已全量核查 1517 个白名单素材，无国际象棋棋子）。
  -- 所以棋子改为「用基础图元拼」：白/黑圆盘 + 棋符，或纯棋符。
  -- 两档只用下面这个官方预设图元，无需任何素材配置，开箱即用。
  PIECE_ASSET = {
    CIRCLE  = 100002,   -- 实心圆图（可染色、可拉伸）
  },
  PIECE_IMAGE_SOURCE = "StaticReference",   -- 图片来源枚举名（见 API 文档 L516-527）
  -- 两档样式："glyph" 纯棋符（1 控件/枚）｜"disc" 圆盘+棋符（3 控件/枚）
  DEFAULT_PIECE_STYLE = "disc",
  -- 样式循环顺序（按钮每点一次切到下一档）
  PIECE_STYLE_CYCLE = { "disc", "glyph" },
  -- 棋盘上同时最多 32 枚棋子（开局 32 枚，升变不增加总数），故棋子槽位池按 32 建
  PIECE_MAX_SLOTS = 32,
  -- 可选（缺省 0 表示不使用）
  PREFAB_CONTAINER     = 0,      -- 容器节点模板索引（需要分组管理时用；本项目不用）

  -- ===== 沙箱/真机能力差异开关 =====
  -- 【为什么需要这个开关】
  -- `raycastTarget` 是 API 文档 L813（光标检测区域）/ L792（预设按钮）声明的字段，
  -- 真机上必须设它才能接收光标事件。但体外沙箱**未实现该字段的读写**，读取会被记为
  -- unsupported-api 并导致沙箱判定 fail。
  -- 因此：正式交付文件保持 true（真机生效）；沙箱验收副本由
  -- tools_work/make_sandbox_copy.mjs 改成 false（跳过该字段，沙箱才能 pass）。
  -- 交付说明里必须如实写明这条差异，不能把「沙箱 pass」说成「真机已通过」。
  ENABLE_RAYCAST_FIELD = false,  -- [沙箱副本] 沙箱未实现该字段

  SCRIPT_SHORT_NAME    = "levelScript",  -- 挂载脚本短名，用于启动身份核对

  -- ===== 联机信号（与用户搭的节点图必须同名同参数顺序）=====
  SIGNAL_NAME = "ChessSync",
  -- eventType 取值
  EV_MOVE     = 0,   -- 走子：a=起点格  b=终点格  c=升变(0/1Q/2R/3B/4N)  fen=""
  EV_NEWGAME  = 1,   -- 新开一局：a=发起方(0/1)
  EV_RESIGN   = 2,   -- 认输：a=认输方(0/1)
  EV_DRAW_REQ = 3,   -- 求和：a=请求方(0/1)
  EV_DRAW_ACC = 4,   -- 同意和棋：a=同意方(0/1)
  EV_JOIN     = 5,   -- 请求加入：全 0
  EV_ROLE     = 6,   -- 身份分配（服务端回发）：a=0 白方 / 1 黑方
  EV_DRAW_NO  = 7,   -- 拒绝和棋：a=拒绝方(0/1)

  -- ===== 布局（唯一来源，其他位置不得出现这些数字）=====
  -- 与 docs/策划案.md 10.1 逐项一致
  BOARD_SIDE_RATIO  = 0.78,   -- 棋盘边长 = 画布高 * 0.78
  PANEL_WIDTH_RATIO = 0.22,   -- 侧面板宽 = 画布宽 * 0.22

  -- ===== 数值 =====
  INITIAL_TIME_SEC  = 900,    -- 每方初始 15:00
  INCREMENT_SEC     = 10,     -- 每步加秒
  CLOCK_REFRESH_SEC = 0.25,   -- 棋钟文本刷新间隔
  DRAW_COOLDOWN_SEC = 30,     -- 同一方两次求和最小间隔
  MOVE_LOG_LINES    = 6,      -- 面板显示的最近步数
  CLOCK_LOW_SEC     = 60,     -- 低于此值棋钟变红

  -- ===== 启动重试预算 =====
  STARTUP_RETRY_BUDGET = 60,  -- 画布尺寸/容器未就绪时最多重试帧数

  -- ===== 配色（RGB 0-255，与 docs/策划案.md 10.6 逐项一致）=====
  COLOR = {
    BG            = { 18, 22, 30, 255 },     -- 画布底色
    SQ_LIGHT      = { 238, 228, 208, 255 },  -- 浅格
    SQ_DARK       = { 106, 130, 150, 255 },  -- 深格
    SEL_HL        = { 250, 198, 74, 255 },   -- 选中高亮
    LEGAL_HL      = { 108, 186, 130, 255 },  -- 合法落点高亮
    LAST_MOVE     = { 176, 196, 226, 255 },  -- 上一步痕迹
    CHECK_WARN    = { 214, 70, 66, 255 },    -- 将军警示
    HINT_START    = { 176, 208, 168, 255 },  -- 建议起点（开局 e2）
    PANEL_BG      = { 26, 32, 44, 255 },     -- 面板底色
    PANEL_SECTION = { 34, 42, 56, 255 },     -- 面板分区底色
    TEXT_MAIN     = { 238, 240, 244, 255 },  -- 主文字
    TEXT_SUB      = { 150, 158, 170, 255 },  -- 次要文字
    BTN_BG        = { 58, 74, 104, 255 },    -- 按钮底色
    BTN_TEXT      = { 244, 246, 250, 255 },  -- 按钮文字
    BTN_DIS_BG    = { 40, 46, 58, 255 },     -- 按钮禁用底
    BTN_DIS_TEXT  = { 110, 116, 128, 255 },  -- 按钮禁用字
    CLOCK_LOW     = { 214, 74, 74, 255 },    -- 棋钟告急
    WHITE_PIECE   = { 250, 250, 246, 255 },  -- 白方棋子字
    WHITE_OUTLINE = { 38, 34, 28, 255 },     -- 白方棋子描边
    BLACK_PIECE   = { 26, 24, 22, 255 },     -- 黑方棋子字
    BLACK_OUTLINE = { 238, 234, 226, 255 },  -- 黑方棋子描边
    OVERLAY       = { 10, 12, 18, 230 },     -- 弹窗遮罩
  },

  -- ===== 字号（1600x900 基准下的整数，与 docs/策划案.md 10.7 一致）=====
  -- 缩放规则：实际字号 = 基准字号 × (canvasH / 900)，向下取整；下限 16。
  FONT = {
    COORD        = 22,
    PIECE        = 52,
    PANEL_TITLE  = 32,
    PANEL_BODY   = 20,   -- 轮次 / 被吃子 / 走子记录
    CLOCK        = 36,
    BUTTON       = 24,
    HINT         = 24,
    RESULT_TITLE = 44,
    RESULT_SUB   = 24,
    PROMO_OPTION = 24,
    MIN_FONT     = 16,   -- 缩放后下限
  },
  BASE_CANVAS_H = 900,   -- 字号缩放基准（10.7）

  -- ===== 全部玩家可见文案（与策划案第 9 节逐字一致）=====
  -- 全部玩家可见文案：逐字照 docs/策划案.md 9.2–9.6，改这里必须同步改 Demo
  TEXT = {
    -- 提示与轮次
    HINT_OPENING = "点一枚自己的棋子，再点亮起来的格子",
    HINT_SELECTED = "已选中 · 点亮的格子都能走",
    TURN_WHITE = "轮到白方走子",
    TURN_BLACK = "轮到黑方走子",
    WAIT_OPPONENT = "等待对方走子…",
    CHECK = "将军！请先解围",
    -- 结算标题
    RESULT_WHITE_WIN = "白方将死黑方，白方胜",
    RESULT_BLACK_WIN = "黑方将死白方，黑方胜",
    RESULT_STALEMATE = "无子可动，本局和棋",
    RESULT_FIFTY = "五十步无进展，本局和棋",
    RESULT_THREEFOLD = "局面重复三次，本局和棋",
    RESULT_INSUFFICIENT = "子力不足，本局和棋",
    RESULT_TIMEOUT_WHITE = "白方超时，黑方胜",
    RESULT_TIMEOUT_BLACK = "黑方超时，白方胜",
    RESULT_RESIGN_WHITE = "白方认输，黑方胜",
    RESULT_RESIGN_BLACK = "黑方认输，白方胜",
    RESULT_DRAW_AGREED = "对方同意和棋，本局和棋",
    -- 结算说明行
    SUB_CHECKMATE = "本局用时 {t}",
    SUB_STALEMATE = "双方都走不动了",
    SUB_FIFTY = "五十步没有吃子",
    SUB_THREEFOLD = "同一局面出现了三次",
    SUB_INSUFFICIENT = "剩下的子赢不了",
    SUB_TIMEOUT_WHITE = "白方时间用完了",
    SUB_TIMEOUT_BLACK = "黑方时间用完了",
    SUB_RESIGN_WHITE = "白方点了认输",
    SUB_RESIGN_BLACK = "黑方点了认输",
    SUB_DRAW_AGREED = "双方握手言和",
    -- 按钮
    BTN_AGAIN = "再来一局",
    BTN_NEWGAME = "新开一局",
    BTN_RESIGN = "认输",
    BTN_DRAW = "求和",
    BTN_LOCAL = "切换本地同屏",
    BTN_STYLE_DISC  = "棋子：圆盘",
    BTN_STYLE_GLYPH = "棋子：符号",
    BTN_ONLINE = "切换联机对战",
    BTN_DRAW_USED = "求和已用完",
    -- 确认弹窗
    CONFIRM_RESIGN = "认输就直接判负，确定吗",
    CONFIRM_RESIGN_YES = "确定认输",
    CONFIRM_RESIGN_NO = "继续下棋",
    CONFIRM_NEWGAME = "重开会清空这一局",
    CONFIRM_YES = "确定",
    CONFIRM_NO = "取消",
    CONFIRM_SWITCH = "切换会断开这一局，确定吗",
    CONFIRM_DRAW = "对方想和棋，同意吗",
    CONFIRM_DRAW_YES = "同意和棋",
    CONFIRM_DRAW_NO = "拒绝求和",
    -- 面板
    PANEL_TITLE = "黑白棋局",
    CAP_WHITE_PREFIX = "白方失子 ",
    CAP_BLACK_PREFIX = "黑方失子 ",
    CAP_NONE = "无",
    MOVELOG_TITLE = "最近六步",
    MOVELOG_EMPTY = "还没有走子",
    -- 升变
    PROMO_PROMPT = "兵到底了，选一个子",
    PROMO_QUEEN = "后",
    PROMO_ROOK = "车",
    PROMO_BISHOP = "象",
    PROMO_KNIGHT = "马",
  },
}

-- 起始局面
local START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

-- =============================================================================
-- 第 2 区：LOG（日志与故障块）
-- =============================================================================
local LOG = { faultEmitted = false, printed = {} }

local function log_info(fmt, ...)
  local ok, msg = pcall(string.format, fmt, ...)
  if not ok then msg = tostring(fmt) end
  print("[Chess] " .. msg)
end

local function log_once(key, fmt, ...)
  if LOG.printed[key] then return end
  LOG.printed[key] = true
  log_info(fmt, ...)
end

local function log_err(fmt, ...)
  local ok, msg = pcall(string.format, fmt, ...)
  if not ok then msg = tostring(fmt) end
  printerr("[Chess] " .. msg)
end

-- 致命故障只输出一个连续块（release 10 §6）
local function emit_fault(code, phase, message, object, evidence)
  if LOG.faultEmitted then return end
  LOG.faultEmitted = true
  local tb = "不可用"
  local ok, t = pcall(function() return debug.traceback("", 2) end)
  if ok and type(t) == "string" then tb = t end
  local lines = {
    "GAME FAULT BEGIN " .. tostring(code),
    "  phase: " .. tostring(phase),
    "  message: " .. tostring(message),
    "  object: " .. tostring(object),
    "  evidence: " .. tostring(evidence),
    "  traceback: " .. tb,
    "  cleanup[1]: (无)",
    "GAME FAULT END " .. tostring(code),
  }
  printerr(table.concat(lines, "\n"))
end

-- =============================================================================
-- 前向声明：跨区调用的函数
--   Lua 的 local function 必须先声明后使用。第 7 区（业务）会在运行期调用第 9 区（联机）
--   的函数，因此这里先声明为 local 变量，在第 9 区用赋值（而不是 local function）定义。
--   【教训】曾因 net_send_move 在第 7 区被调用时尚未定义，运行期报
--   "attempt to call a nil value (global 'net_send_move')"，沙箱判 fail。
-- =============================================================================
local net_send_event   -- 定义于第 9 区
local net_send_move    -- 定义于第 9 区

-- =============================================================================
-- 第 3 区：RULES（走法规则引擎）
--   来源：tools_work/perft/engine_proto.lua，perft 深度 3 与 python-chess 全部一致。
--   本区不做任何编辑器接口调用，纯逻辑，可在沙箱/真机/本地 Lua 任意环境跑。
-- =============================================================================
local RULES = {}

RULES.PAWN, RULES.KNIGHT, RULES.BISHOP, RULES.ROOK, RULES.QUEEN, RULES.KING = 1, 2, 3, 4, 5, 6
RULES.WHITE, RULES.BLACK = 1, -1

local PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING = 1, 2, 3, 4, 5, 6
local WHITE, BLACK = 1, -1

-- 方向表：显式 (dr, df) 二元组。
-- 【重要】不能用单整数 delta + 取模拆分：负列差会拆错，马步会丢子（实测 d1=18 vs 20）。
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

local function shift(sq, dr, df)
  local r, f = sq // 8, sq % 8
  local nr, nf = r + dr, f + df
  if nr < 0 or nr > 7 or nf < 0 or nf > 7 then return nil end
  return nr * 8 + nf
end

local CHAR_TO_PIECE = {
  p = -PAWN, n = -KNIGHT, b = -BISHOP, r = -ROOK, q = -QUEEN, k = -KING,
  P = PAWN, N = KNIGHT, B = BISHOP, R = ROOK, Q = QUEEN, K = KING,
}
local PIECE_TO_CHAR = {
  [-PAWN] = "p", [-KNIGHT] = "n", [-BISHOP] = "b", [-ROOK] = "r", [-QUEEN] = "q", [-KING] = "k",
  [PAWN] = "P", [KNIGHT] = "N", [BISHOP] = "B", [ROOK] = "R", [QUEEN] = "Q", [KING] = "K",
}
-- 界面用的棋子字母（白黑同字母，靠颜色区分）
-- Unicode 实心棋符（U+265A..U+265F）：白方白字深描边、黑方深字浅描边。
-- 只在「符号样式」下使用；图片模式用图片控件。
local PIECE_GLYPH = {
  [-PAWN] = "\u{265F}", [-KNIGHT] = "\u{265E}", [-BISHOP] = "\u{265D}",
  [-ROOK] = "\u{265C}", [-QUEEN] = "\u{265B}", [-KING] = "\u{265A}",
  [PAWN] = "\u{265F}", [KNIGHT] = "\u{265E}", [BISHOP] = "\u{265D}",
  [ROOK] = "\u{265C}", [QUEEN] = "\u{265B}", [KING] = "\u{265A}",
}

local PIECE_LETTER = {
  [-PAWN] = "P", [-KNIGHT] = "N", [-BISHOP] = "B", [-ROOK] = "R", [-QUEEN] = "Q", [-KING] = "K",
  [PAWN] = "P", [KNIGHT] = "N", [BISHOP] = "B", [ROOK] = "R", [QUEEN] = "Q", [KING] = "K",
}
RULES.PIECE_LETTER = PIECE_LETTER
RULES.PIECE_GLYPH = PIECE_GLYPH

function RULES.parse_fen(fen)
  local st = {
    board = {}, turn = WHITE,
    castling = { K = false, Q = false, k = false, q = false },
    ep = nil, halfmove = 0, fullmove = 1, history = {},
  }
  for i = 0, 63 do st.board[i] = 0 end

  local parts = {}
  for token in string.gmatch(fen, "[^ ]+") do parts[#parts + 1] = token end
  if #parts < 4 then error("FEN 字段不足: " .. tostring(fen)) end

  local r, f = 7, 0
  for ch in string.gmatch(parts[1], ".") do
    if ch == "/" then r = r - 1; f = 0
    elseif ch >= "1" and ch <= "8" then f = f + tonumber(ch)
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
      elseif ch == "q" then st.castling.q = true end
    end
  end
  if parts[4] and parts[4] ~= "-" then
    local fc = string.sub(parts[4], 1, 1)
    local rn = tonumber(string.sub(parts[4], 2, 2))
    if fc and rn then st.ep = sq_of(rn - 1, string.byte(fc) - string.byte("a")) end
  end
  if parts[5] then st.halfmove = tonumber(parts[5]) or 0 end
  if parts[6] then st.fullmove = tonumber(parts[6]) or 1 end
  return st
end

function RULES.fen_of(st)
  local rows = {}
  for r = 7, 0, -1 do
    local line, empty = "", 0
    for f = 0, 7 do
      local p = st.board[sq_of(r, f)]
      if p == 0 then empty = empty + 1
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
  if st.ep then epStr = string.char(string.byte("a") + (st.ep % 8)) .. tostring((st.ep // 8) + 1) end
  return table.concat(rows, "/") .. " " .. (st.turn == WHITE and "w" or "b") ..
         " " .. cs .. " " .. epStr .. " " .. tostring(st.halfmove) .. " " .. tostring(st.fullmove)
end

function RULES.position_key(st)
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

local function push(moves, from, to, promo, is_ep, is_castle)
  moves[#moves + 1] = { from = from, to = to, promo = promo, ep = is_ep or false, castle = is_castle or false }
end

function RULES.gen_pseudo(st)
  local moves = {}
  local board = st.board
  local isWhite = (st.turn == WHITE)

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
              else push(moves, from, to, nil) end
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

function RULES.is_attacked(st, sq, by_side)
  local board = st.board
  local isWhite = (by_side == WHITE)

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

  for _, d in ipairs(KNIGHT_DIRS) do
    local from = shift(sq, -d[1], -d[2])
    if from then
      local p = board[from]
      if p ~= 0 and ((p > 0) == isWhite) and ((p > 0) and p or -p) == KNIGHT then return true end
    end
  end

  for _, d in ipairs(KING_DIRS) do
    local from = shift(sq, -d[1], -d[2])
    if from then
      local p = board[from]
      if p ~= 0 and ((p > 0) == isWhite) and ((p > 0) and p or -p) == KING then return true end
    end
  end

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

function RULES.find_king(st, side)
  local kingPiece = (side == WHITE) and KING or -KING
  for i = 0, 63 do
    if st.board[i] == kingPiece then return i end
  end
  return nil
end

function RULES.in_check(st, side)
  local ksq = RULES.find_king(st, side)
  if not ksq then return false end
  return RULES.is_attacked(st, ksq, -side)
end

function RULES.make(st, mv)
  local board = st.board
  local side = st.turn
  local moving = board[mv.from]

  local undo = {
    mv = mv,
    captured = board[mv.to],
    capturedSq = mv.to,
    epBefore = st.ep,
    castling = { K = st.castling.K, Q = st.castling.Q, k = st.castling.k, q = st.castling.q },
    halfmove = st.halfmove, fullmove = st.fullmove, turn = st.turn,
    castleRookFrom = nil, castleRookTo = nil,
  }

  if mv.ep then
    local capSq = shift(mv.to, side == WHITE and -1 or 1, 0)
    undo.captured = board[capSq]
    undo.capturedSq = capSq
    board[capSq] = 0
  end

  board[mv.to] = mv.promo and (side == WHITE and mv.promo or -mv.promo) or moving
  board[mv.from] = 0

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

  st.ep = nil
  if ap == PAWN and math.abs(mv.to - mv.from) == 16 then st.ep = (mv.from + mv.to) // 2 end

  if ap == PAWN or undo.captured ~= 0 then st.halfmove = 0 else st.halfmove = st.halfmove + 1 end
  if side == BLACK then st.fullmove = st.fullmove + 1 end
  st.turn = -side
  st.history[#st.history + 1] = RULES.position_key(st)
  return undo
end

function RULES.unmake(st, undo)
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

-- 合法性：必须检查易位路径（起点不被将军 + 经过格不被攻击）。
-- 【重要】perft 曾因跳过这条多算 4 步（2043 vs 2039），不可简化。
function RULES.is_legal(st, mv)
  local side = st.turn

  if mv.castle then
    if RULES.in_check(st, side) then return false end
    local homeRank = (side == WHITE) and 0 or 7
    local kingSq = sq_of(homeRank, 4)
    local midSq = (mv.to > kingSq) and sq_of(homeRank, 5) or sq_of(homeRank, 3)
    local board = st.board
    local savedKing = board[kingSq]
    board[kingSq] = 0
    board[midSq] = savedKing
    local attacked = RULES.is_attacked(st, midSq, -side)
    board[midSq] = 0
    board[kingSq] = savedKing
    if attacked then return false end
  end

  local undo = RULES.make(st, mv)
  local ok = not RULES.in_check(st, side)
  RULES.unmake(st, undo)
  return ok
end

function RULES.legal_moves(st)
  local out = {}
  for _, mv in ipairs(RULES.gen_pseudo(st)) do
    if RULES.is_legal(st, mv) then out[#out + 1] = mv end
  end
  return out
end

function RULES.is_checkmate(st)
  if not RULES.in_check(st, st.turn) then return false end
  return #RULES.legal_moves(st) == 0
end

function RULES.is_stalemate(st)
  if RULES.in_check(st, st.turn) then return false end
  return #RULES.legal_moves(st) == 0
end

function RULES.is_insufficient_material(st)
  local minors = {}
  local majors = 0
  for i = 0, 63 do
    local p = st.board[i]
    if p ~= 0 then
      local ap = (p > 0) and p or -p
      if ap ~= KING then
        if ap == PAWN or ap == ROOK or ap == QUEEN then majors = majors + 1
        else minors[#minors + 1] = { sq = i, ap = ap } end
      end
    end
  end
  if majors > 0 then return false end
  if #minors == 0 then return true end
  if #minors == 1 then return true end
  if #minors == 2 then
    local a, b = minors[1], minors[2]
    if a.ap == BISHOP and b.ap == BISHOP then
      local sa = (rank_of(a.sq) + file_of(a.sq)) % 2
      local sb = (rank_of(b.sq) + file_of(b.sq)) % 2
      return sa == sb
    end
    return false
  end
  return false
end

function RULES.is_threefold(st)
  local key = RULES.position_key(st)
  local count = 1
  for _, k in ipairs(st.history) do
    if k == key then count = count + 1 end
  end
  return count >= 3
end

function RULES.is_fifty_move(st)
  return st.halfmove >= 100
end

function RULES.game_status(st)
  if RULES.is_checkmate(st) then
    return { over = true, result = (st.turn == WHITE) and "0-1" or "1-0", reason = "checkmate" }
  end
  if RULES.is_stalemate(st) then
    return { over = true, result = "1/2-1/2", reason = "stalemate" }
  end
  if RULES.is_insufficient_material(st) then
    return { over = true, result = "1/2-1/2", reason = "insufficient" }
  end
  if RULES.is_threefold(st) then
    return { over = true, result = "1/2-1/2", reason = "threefold" }
  end
  if RULES.is_fifty_move(st) then
    return { over = true, result = "1/2-1/2", reason = "fifty" }
  end
  return { over = false, result = nil, reason = nil }
end

function RULES.perft(st, depth)
  if depth == 0 then return 1 end
  local n = 0
  for _, mv in ipairs(RULES.gen_pseudo(st)) do
    if RULES.is_legal(st, mv) then
      local undo = RULES.make(st, mv)
      n = n + RULES.perft(st, depth - 1)
      RULES.unmake(st, undo)
    end
  end
  return n
end

function RULES.uci_of(mv)
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

function RULES.find_move(st, uci)
  for _, mv in ipairs(RULES.legal_moves(st)) do
    if RULES.uci_of(mv) == uci then return mv end
  end
  return nil
end

function RULES.legal_uci_list(st)
  local out = {}
  for _, mv in ipairs(RULES.legal_moves(st)) do out[#out + 1] = RULES.uci_of(mv) end
  table.sort(out)
  return out
end

-- =============================================================================
-- 第 4 区：LAYOUT（唯一坐标换算入口）
--   除本区外，任何位置不得出现 1600 / 900 / 0.78 / 0.22 这类基准数字。
-- =============================================================================
local LAYOUT = {}

function LAYOUT.compute(canvasW, canvasH)
  local boardSide = canvasH * CONFIG.BOARD_SIDE_RATIO
  local cell = boardSide / 8
  local boardBottom = (canvasH - boardSide) / 2      -- 垂直居中
  local panelW = canvasW * CONFIG.PANEL_WIDTH_RATIO
  local panelLeft = canvasW - panelW                 -- 靠右
  local panelH = boardSide                           -- 与棋盘同高
  local panelBottom = (canvasH - panelH) / 2

  -- 水平居中；窄屏（手机 4:3）下若棋盘右缘会压到面板左缘，改为在「面板左侧区域」内居中。
  -- 判定： (canvasW + boardSide)/2 > canvasW - panelW
  local boardLeft = (canvasW - boardSide) / 2
  if (canvasW + boardSide) / 2 > canvasW - panelW then
    boardLeft = (panelLeft - boardSide) / 2
  end

  -- 字号缩放：基准 900 高，向下取整，下限 16（10.7）
  local fontScale = canvasH / CONFIG.BASE_CANVAS_H
  local function font(base)
    local v = math.floor(base * fontScale)
    if v < CONFIG.FONT.MIN_FONT then v = CONFIG.FONT.MIN_FONT end
    return v
  end

  return {
    canvasW = canvasW, canvasH = canvasH,
    boardSide = boardSide, cell = cell,
    boardLeft = boardLeft, boardBottom = boardBottom,
    panelW = panelW, panelLeft = panelLeft,
    panelBottom = panelBottom, panelH = panelH,
    font = font, fontScale = fontScale,
  }
end

-- 格号 → 画布坐标（左下角原点）
function LAYOUT.square_pos(L, sq)
  local file = sq % 8
  local rank = sq // 8
  return L.boardLeft + file * L.cell, L.boardBottom + rank * L.cell
end

-- =============================================================================
-- 第 5 区：FACTORY（控件工厂，固定创建顺序）
--   顺序固定：创建 → 中心点 → 最小锚点 → 最大锚点 → 尺寸 → 位置 → 颜色/文本 → 启用 → 登记
--   【重要】第 4 步不能与第 5 步调换：先写位置再改锚点，位置会按旧锚点解释。
-- =============================================================================
local FACTORY = { cleanup = {}, created = 0 }

local function color_of(rgba)
  local a = rgba[4]
  if a == nil then return Color.FromRGB(rgba[1], rgba[2], rgba[3]) end
  return Color.FromRGBA(rgba[1], rgba[2], rgba[3], a)
end

-- 创建一个文本框（本项目所有可视元素都是文本框）
-- opts: {name, parent, x, y, w, h, bg, text, fontColor, fontSize, outline, outlineColor,
--        hAlign, vAlign, raycast}
local function create_text(opts)
  local ctrl = game.InstantiateClientUIControl(CONFIG.PREFAB_TEXT_BOX, opts.parent)
  if ctrl == nil then return nil end

  -- 顺序固定：中心点 → 锚点 → 尺寸 → 位置
  ctrl:SetPivot(0, 0)
  ctrl:SetAnchorMin(0, 0)
  ctrl:SetAnchorMax(0, 0)
  ctrl:SetSizeDelta(opts.w, opts.h)
  ctrl:SetAnchoredPosition(opts.x, opts.y)

  if opts.name then ctrl.name = opts.name end
  ctrl.text = opts.text or ""
  if opts.bg then ctrl.bgColor = color_of(opts.bg) end
  if opts.fontColor then ctrl.fontColor = color_of(opts.fontColor) end
  if opts.fontSize then ctrl.fontSize = opts.fontSize end
  if opts.outline then
    ctrl.enableOutline = true
    if opts.outlineColor then ctrl.outlineColor = color_of(opts.outlineColor) end
  end
  if opts.hAlign then ctrl.horizontalAlignment = opts.hAlign end
  if opts.vAlign then ctrl.verticalAlignment = opts.vAlign end

  -- 先关闭命中、保持不可见，最后由调用方显式启用
  -- raycastTarget 受 CONFIG.ENABLE_RAYCAST_FIELD 控制（见第 1 区说明：沙箱未实现该字段）
  if CONFIG.ENABLE_RAYCAST_FIELD then
    ctrl.raycastTarget = opts.raycast and true or false
  end
  ctrl:SetActive(false)

  FACTORY.cleanup[#FACTORY.cleanup + 1] = ctrl
  FACTORY.created = FACTORY.created + 1
  return ctrl
end

-- 创建一个光标检测区域（棋盘格点击用）
local function create_cursor_area(opts)
  local ctrl = game.InstantiateClientUIControl(CONFIG.PREFAB_CURSOR_AREA, opts.parent)
  if ctrl == nil then return nil end
  ctrl:SetPivot(0, 0)
  ctrl:SetAnchorMin(0, 0)
  ctrl:SetAnchorMax(0, 0)
  ctrl:SetSizeDelta(opts.w, opts.h)
  ctrl:SetAnchoredPosition(opts.x, opts.y)
  if opts.name then ctrl.name = opts.name end
  -- 同 create_text：受 CONFIG.ENABLE_RAYCAST_FIELD 控制
  if CONFIG.ENABLE_RAYCAST_FIELD then
    ctrl.raycastTarget = true
  end
  ctrl:SetActive(false)

  FACTORY.cleanup[#FACTORY.cleanup + 1] = ctrl
  FACTORY.created = FACTORY.created + 1
  return ctrl
end

-- 图片来源枚举（按配置名取；沙箱没有 StaticReference，取不到就返回 nil，调用方跳过 SetImage）
local function piece_image_source_enum()
  local name = CONFIG.PIECE_IMAGE_SOURCE or "StaticReference"
  local ok, v = pcall(function() return Enum.ImageSource[name] end)
  if ok and v ~= nil then return v end
  ok, v = pcall(function() return Enum.ImageSource.Prefab end)
  if ok and v ~= nil then return v end
  return nil
end

-- 图片拉伸类型枚举（真机是 Stretch/Basic，沙箱两者都没有，取不到就返回 nil → 不设该属性）
local function image_type_stretch()
  local ok, v = pcall(function() return Enum.ImageType.Stretch end)
  if ok and v ~= nil then return v end
  ok, v = pcall(function() return Enum.ImageType.Basic end)
  if ok and v ~= nil then return v end
  return nil
end

-- 给图片控件设置「图元 + 颜色 + 旋转」。真机与沙箱能力不同，全部 pcall 包裹。
local function image_apply(ctrl, asset, color, rot)
  if ctrl == nil then return end
  if asset and asset > 0 then
    local src = piece_image_source_enum()
    if src ~= nil then
      pcall(function() ctrl:SetImage(src, asset) end)
    end
  end
  local it = image_type_stretch()
  if it ~= nil then pcall(function() ctrl.imageType = it end) end
  if color ~= nil then pcall(function() ctrl.imageColor = color_of(color) end) end
  if rot ~= nil and rot ~= 0 then pcall(function() ctrl:SetLocalRotation(0, 0, rot) end) end
end

-- 创建一个图片控件（圆盘用）。创建顺序与文本框一致。
-- opts: {name, parent, x, y, w, h, asset, color, rot}
local function create_image(opts)
  if CONFIG.PREFAB_IMAGE == 0 then return nil end
  local ctrl = game.InstantiateClientUIControl(CONFIG.PREFAB_IMAGE, opts.parent)
  if ctrl == nil then return nil end
  ctrl:SetPivot(0, 0)
  ctrl:SetAnchorMin(0, 0)
  ctrl:SetAnchorMax(0, 0)
  ctrl:SetSizeDelta(opts.w, opts.h)
  ctrl:SetAnchoredPosition(opts.x, opts.y)
  if opts.name then ctrl.name = opts.name end
  image_apply(ctrl, opts.asset, opts.color, opts.rot)
  -- 先关闭命中、保持不可见，最后由调用方显式启用
  if CONFIG.ENABLE_RAYCAST_FIELD then
    pcall(function() ctrl.raycastTarget = false end)
  end
  ctrl:SetActive(false)

  FACTORY.cleanup[#FACTORY.cleanup + 1] = ctrl
  FACTORY.created = FACTORY.created + 1
  return ctrl
end


-- =============================================================================
-- 第 6 区：UI（界面构建）
-- =============================================================================
local UI = {
  L = nil,
  squares = {},        -- squares[sq] = 棋盘格底控件
  pieces = {},         -- pieces[sq] = 棋子文本框控件
  pieceSlots = {},     -- 棋子槽位池（每槽 = 圆盘2 + 棋符1；按 32 个同时在场建）
  slotShown = 0,       -- 上一帧用到的槽位数（用于把多余槽位隐藏，避免无谓 setter）
  hitAreas = {},       -- hitAreas[sq] = 光标检测区
  legalHL = {},        -- 落点高亮池
  legalHLUsed = 0,
  selHL = nil,         -- 选中高亮
  lastMoveHL = {},     -- 上一步痕迹（2 个）
  checkHL = nil,       -- 将军警示
  coords = {},
  panel = {},
  result = {},
  promo = {},
  confirm = {},
  built = false,
}

-- 建棋子槽位池（一次性建好，播放期只移动/改色/切显隐，零创建零销毁）。
-- 每个槽位 = 圆盘外圈 + 圆盘内圈 + 棋符文本框。
-- 两档样式共用这一套控件：切样式只改显隐，不新建也不销毁（release 21 硬约束）。
local function create_piece_slots()
  local L = UI.L
  local box = L.cell
  local D = box * 0.88
  local ring = box * 0.048
  local innerD = D - ring * 2
  local glyphFont = math.floor(innerD * 0.80)
  local hasImage = (CONFIG.PREFAB_IMAGE ~= 0)

  for i = 1, CONFIG.PIECE_MAX_SLOTS do
    local slot = { sq = nil }
    if hasImage then
      slot.discOuter = create_image({
        name = "p" .. i .. "_outer", parent = UI.host,
        x = 0, y = 0, w = D, h = D, asset = CONFIG.PIECE_ASSET.CIRCLE,
      })
      slot.discInner = create_image({
        name = "p" .. i .. "_inner", parent = UI.host,
        x = 0, y = 0, w = innerD, h = innerD, asset = CONFIG.PIECE_ASSET.CIRCLE,
      })
    end
    slot.glyph = create_text({
      name = "p" .. i .. "_glyph", parent = UI.host,
      x = 0, y = 0, w = innerD, h = innerD,
      text = "", fontSize = glyphFont,
      hAlign = Enum.TextHorizontalAlignment.Middle,
      vAlign = Enum.TextVerticalAlignment.Middle,
      raycast = false,
    })
    UI.pieceSlots[i] = slot
  end
end
local function build_board()
  local L = UI.L
  -- 棋盘格底 64
  for sq = 0, 63 do
    local x, y = LAYOUT.square_pos(L, sq)
    local isDark = ((sq // 8) + (sq % 8)) % 2 == 0
    UI.squares[sq] = create_text({
      name = "sq_" .. tostring(sq),
      parent = UI.host, x = x, y = y, w = L.cell, h = L.cell,
      bg = isDark and CONFIG.COLOR.SQ_DARK or CONFIG.COLOR.SQ_LIGHT,
      text = "",
      raycast = false,
    })
  end

  -- 坐标标注：列 a-h（棋盘下方）、行 1-8（棋盘左侧）
  local coordFont = L.font(CONFIG.FONT.COORD)
  local coordStrip = coordFont * 1.0   -- 坐标条宽度（按字号）
  for f = 0, 7 do
    local letter = string.char(string.byte("a") + f)
    UI.coords[#UI.coords + 1] = create_text({
      name = "coordF" .. tostring(f),
      parent = UI.host,
      x = L.boardLeft + f * L.cell,
      y = L.boardBottom - coordStrip,
      w = L.cell, h = coordStrip,
      text = letter,
      fontColor = CONFIG.COLOR.TEXT_SUB, fontSize = coordFont,
      hAlign = Enum.TextHorizontalAlignment.Middle,
      vAlign = Enum.TextVerticalAlignment.Middle,
    })
  end
  for r = 0, 7 do
    UI.coords[#UI.coords + 1] = create_text({
      name = "coordR" .. tostring(r),
      parent = UI.host,
      x = L.boardLeft - coordStrip,
      y = L.boardBottom + r * L.cell,
      w = coordStrip, h = L.cell,
      text = tostring(r + 1),
      fontColor = CONFIG.COLOR.TEXT_SUB, fontSize = coordFont,
      hAlign = Enum.TextHorizontalAlignment.Middle,
      vAlign = Enum.TextVerticalAlignment.Middle,
    })
  end

  -- 上一步痕迹（2 个，覆盖在格底之上、棋子之下）
  for i = 1, 2 do
    UI.lastMoveHL[i] = create_text({
      name = "lastmove" .. tostring(i), parent = UI.host,
      x = 0, y = 0, w = L.cell, h = L.cell,
      bg = CONFIG.COLOR.LAST_MOVE, text = "",
    })
  end

  -- 将军警示（1 个）
  UI.checkHL = create_text({
    name = "checkwarn", parent = UI.host,
    x = 0, y = 0, w = L.cell, h = L.cell,
    bg = CONFIG.COLOR.CHECK_WARN, text = "",
  })

  -- 棋子槽位池（32 个同时在场；播放期零创建）
  create_piece_slots()

  -- 落点高亮池：后最多 27 个落点，留 1 个余量
  for i = 1, 28 do
    UI.legalHL[i] = create_text({
      name = "legalhl" .. tostring(i), parent = UI.host,
      x = 0, y = 0, w = L.cell, h = L.cell,
      bg = CONFIG.COLOR.LEGAL_HL, text = "",
      raycast = false,
    })
  end

  -- 选中高亮（1 个）
  UI.selHL = create_text({
    name = "selhl", parent = UI.host,
    x = 0, y = 0, w = L.cell, h = L.cell,
    bg = CONFIG.COLOR.SEL_HL, text = "",
    raycast = false,
  })

  -- 点击检测区 64（盖在格子之上，接收点击；不读坐标，闭包捕获格号）
  for sq = 0, 63 do
    local x, y = LAYOUT.square_pos(L, sq)
    UI.hitAreas[sq] = create_cursor_area({
      name = "hit_" .. tostring(sq),
      parent = UI.host, x = x, y = y, w = L.cell, h = L.cell,
    })
  end
end

local function build_panel()
  local L = UI.L
  local px, py, pw, ph = L.panelLeft, L.panelBottom, L.panelW, L.panelH
  -- 面板内相对位置：x 从左 0..1，y 从下 0..1（与策划案 10.3 表一致）
  local function atX(r) return px + pw * r end
  local function atY(r) return py + ph * r end
  local function w(r) return pw * r end
  local function h(r) return ph * r end

  -- 面板底
  UI.panel.bg = create_text({
    name = "panelbg", parent = UI.host, x = px, y = py, w = pw, h = ph,
    bg = CONFIG.COLOR.PANEL_BG, text = "",
  })
  -- 标题 (4%, 90%) 92% × 8%
  UI.panel.title = create_text({
    name = "paneltitle", parent = UI.host,
    x = atX(0.04), y = atY(0.90), w = w(0.92), h = h(0.08),
    text = CONFIG.TEXT.PANEL_TITLE, fontColor = CONFIG.COLOR.TEXT_MAIN,
    fontSize = L.font(CONFIG.FONT.PANEL_TITLE),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Middle,
  })
  -- 轮次指示 (4%, 81%) 92% × 6%
  UI.panel.turn = create_text({
    name = "panelturn", parent = UI.host,
    x = atX(0.04), y = atY(0.81), w = w(0.92), h = h(0.06),
    text = CONFIG.TEXT.TURN_WHITE, fontColor = CONFIG.COLOR.TEXT_MAIN,
    fontSize = L.font(CONFIG.FONT.PANEL_BODY),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Middle,
  })
  -- 白方棋钟 (4%, 70%) 92% × 9%
  UI.panel.clockWhite = create_text({
    name = "clockwhite", parent = UI.host,
    x = atX(0.04), y = atY(0.70), w = w(0.92), h = h(0.09),
    text = "白方 15:00", fontColor = CONFIG.COLOR.TEXT_MAIN,
    fontSize = L.font(CONFIG.FONT.CLOCK),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Middle,
  })
  -- 黑方棋钟 (4%, 60%) 92% × 9%
  UI.panel.clockBlack = create_text({
    name = "clockblack", parent = UI.host,
    x = atX(0.04), y = atY(0.60), w = w(0.92), h = h(0.09),
    text = "黑方 15:00", fontColor = CONFIG.COLOR.TEXT_MAIN,
    fontSize = L.font(CONFIG.FONT.CLOCK),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Middle,
  })
  -- 被吃子（白）(4%, 52%) 92% × 5%
  UI.panel.capturedWhite = create_text({
    name = "capwhite", parent = UI.host,
    x = atX(0.04), y = atY(0.52), w = w(0.92), h = h(0.05),
    text = "", fontColor = CONFIG.COLOR.TEXT_SUB,
    fontSize = L.font(CONFIG.FONT.PANEL_BODY),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Middle,
  })
  -- 被吃子（黑）(4%, 46%) 92% × 5%
  UI.panel.capturedBlack = create_text({
    name = "capblack", parent = UI.host,
    x = atX(0.04), y = atY(0.46), w = w(0.92), h = h(0.05),
    text = "", fontColor = CONFIG.COLOR.TEXT_SUB,
    fontSize = L.font(CONFIG.FONT.PANEL_BODY),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Middle,
  })
  -- 走子记录区 (4%, 26%) 92% × 18%
  UI.panel.moveLog = create_text({
    name = "movelog", parent = UI.host,
    x = atX(0.04), y = atY(0.34), w = w(0.92), h = h(0.14),
    text = "", fontColor = CONFIG.COLOR.TEXT_SUB,
    fontSize = L.font(CONFIG.FONT.PANEL_BODY),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Top,
  })
  -- 五个按钮：8% 高，44% 宽。按钮高 8% 在 720 高下 = 44.9px，刚好达到触摸目标下限，不可再降。
  local btnW, btnH = w(0.44), h(0.08)
  UI.panel.btnNew = create_text({
    name = "btnnew", parent = UI.host,
    x = atX(0.04), y = atY(0.24), w = btnW, h = btnH,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_NEWGAME,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })
  UI.panel.btnResign = create_text({
    name = "btnresign", parent = UI.host,
    x = atX(0.52), y = atY(0.24), w = btnW, h = btnH,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_RESIGN,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })
  UI.panel.btnDraw = create_text({
    name = "btndraw", parent = UI.host,
    x = atX(0.04), y = atY(0.15), w = btnW, h = btnH,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_DRAW,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })
  UI.panel.btnLocal = create_text({
    name = "btnlocal", parent = UI.host,
    x = atX(0.52), y = atY(0.15), w = btnW, h = btnH,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_LOCAL,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })
  -- 第五个按钮：棋子样式切换（圆盘+棋符 ⇄ 纯棋符 循环）
  UI.panel.btnStyle = create_text({
    name = "btnstyle", parent = UI.host,
    x = atX(0.04), y = atY(0.06), w = btnW, h = btnH,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_STYLE_DISC,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })

  -- 按钮点击检测区（盖在按钮上；文本框不能收光标事件，见策划案 10.2）
  UI.panel.hitNew    = create_cursor_area({ name = "hitnew",    parent = UI.host, x = atX(0.04), y = atY(0.24), w = btnW, h = btnH })
  UI.panel.hitResign = create_cursor_area({ name = "hitresign", parent = UI.host, x = atX(0.52), y = atY(0.24), w = btnW, h = btnH })
  UI.panel.hitDraw   = create_cursor_area({ name = "hitdraw",   parent = UI.host, x = atX(0.04), y = atY(0.15), w = btnW, h = btnH })
  UI.panel.hitLocal  = create_cursor_area({ name = "hitlocal",  parent = UI.host, x = atX(0.52), y = atY(0.15), w = btnW, h = btnH })
  UI.panel.hitStyle  = create_cursor_area({ name = "hitstyle",  parent = UI.host, x = atX(0.04), y = atY(0.06), w = btnW, h = btnH })

  -- 提示条（棋盘上方，与棋盘同宽）
  local hintH = L.font(CONFIG.FONT.HINT) * 1.4
  UI.panel.hint = create_text({
    name = "hint", parent = UI.host,
    x = L.boardLeft, y = L.boardBottom + L.boardSide + hintH * 0.3,
    w = L.boardSide, h = hintH,
    text = CONFIG.TEXT.HINT_OPENING,
    fontColor = CONFIG.COLOR.TEXT_SUB, fontSize = L.font(CONFIG.FONT.HINT),
    hAlign = Enum.TextHorizontalAlignment.Middle,
    vAlign = Enum.TextVerticalAlignment.Middle,
  })
end

local function build_result_panel()
  local L = UI.L
  -- 全屏遮罩（可吞掉底层点击；遮罩本身也盖一个检测区）
  UI.result.overlay = create_text({
    name = "resultoverlay", parent = UI.host,
    x = 0, y = 0, w = L.canvasW, h = L.canvasH,
    bg = CONFIG.COLOR.OVERLAY, text = "",
  })
  UI.result.hitOverlay = create_cursor_area({
    name = "hitoverlay", parent = UI.host, x = 0, y = 0, w = L.canvasW, h = L.canvasH,
  })
  -- 面板底：居中 40% × 40%
  local w, h = L.canvasW * 0.40, L.canvasH * 0.40
  local x, y = (L.canvasW - w) * 0.5, (L.canvasH - h) * 0.5
  UI.result.bg = create_text({
    name = "resultbg", parent = UI.host, x = x, y = y, w = w, h = h,
    bg = CONFIG.COLOR.PANEL_BG, text = "",
  })
  UI.result.title = create_text({
    name = "resulttitle", parent = UI.host,
    x = x + w * 0.05, y = y + h * 0.62, w = w * 0.90, h = h * 0.18,
    text = "", fontColor = CONFIG.COLOR.TEXT_MAIN, fontSize = L.font(CONFIG.FONT.RESULT_TITLE),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
  })
  UI.result.sub = create_text({
    name = "resultsub", parent = UI.host,
    x = x + w * 0.05, y = y + h * 0.40, w = w * 0.90, h = h * 0.14,
    text = "", fontColor = CONFIG.COLOR.TEXT_SUB, fontSize = L.font(CONFIG.FONT.RESULT_SUB),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
  })
  UI.result.btnAgain = create_text({
    name = "btnagain", parent = UI.host,
    x = x + w * 0.30, y = y + h * 0.12, w = w * 0.40, h = h * 0.14,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.BTN_AGAIN,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })
  UI.result.hitAgain = create_cursor_area({
    name = "hitagain", parent = UI.host,
    x = x + w * 0.30, y = y + h * 0.12, w = w * 0.40, h = h * 0.14,
  })
end

local function build_promo_dialog()
  local L = UI.L
  local w, h = L.canvasW * 0.44, L.canvasH * 0.30
  local x, y = (L.canvasW - w) * 0.5, (L.canvasH - h) * 0.5
  UI.promo.bg = create_text({
    name = "promobg", parent = UI.host, x = x, y = y, w = w, h = h,
    bg = CONFIG.COLOR.PANEL_BG, text = "",
  })
  UI.promo.prompt = create_text({
    name = "prompt", parent = UI.host,
    x = x + w * 0.05, y = y + h * 0.66, w = w * 0.90, h = h * 0.16,
    text = CONFIG.TEXT.PROMO_PROMPT, fontColor = CONFIG.COLOR.TEXT_MAIN,
    fontSize = L.font(36),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
  })
  local labels = { CONFIG.TEXT.PROMO_QUEEN, CONFIG.TEXT.PROMO_ROOK,
                   CONFIG.TEXT.PROMO_BISHOP, CONFIG.TEXT.PROMO_KNIGHT }
  local cols = { 0.04, 0.26, 0.48, 0.70 }
  UI.promo.buttons = {}
  UI.promo.hits = {}
  for i = 1, 4 do
    local bx = x + w * cols[i]
    local by = y + h * 0.10
    local bw, bh = w * 0.22, h * 0.26
    UI.promo.buttons[i] = create_text({
      name = "promo" .. tostring(i), parent = UI.host,
      x = bx, y = by, w = bw, h = bh,
      bg = CONFIG.COLOR.BTN_BG, text = labels[i],
      fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.PROMO_OPTION),
      hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
      raycast = true,
    })
    UI.promo.hits[i] = create_cursor_area({
      name = "hitpromo" .. tostring(i), parent = UI.host,
      x = bx, y = by, w = bw, h = bh,
    })
  end
end

-- 通用确认弹窗（对应 docs/策划案.md 9.5 的 C-01 ~ C-04）
--   C-01 认输就直接判负，确定吗      按钮：确定认输 / 继续下棋
--   C-02 重开会清空这一局            按钮：确定 / 取消
--   C-03 切换会断开这一局，确定吗     按钮：确定 / 取消
--   C-04 对方想和棋，同意吗          按钮：同意和棋 / 拒绝求和
local function build_confirm_dialog()
  local L = UI.L
  local w, h = L.canvasW * 0.46, L.canvasH * 0.28
  local x, y = (L.canvasW - w) * 0.5, (L.canvasH - h) * 0.5
  UI.confirm = UI.confirm or {}
  UI.confirm.bg = create_text({
    name = "confirmbg", parent = UI.host, x = x, y = y, w = w, h = h,
    bg = CONFIG.COLOR.PANEL_BG, text = "",
  })
  UI.confirm.text = create_text({
    name = "confirmtext", parent = UI.host,
    x = x + w * 0.05, y = y + h * 0.46, w = w * 0.90, h = h * 0.30,
    text = CONFIG.TEXT.CONFIRM_RESIGN, fontColor = CONFIG.COLOR.TEXT_MAIN,
    fontSize = L.font(26),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
  })
  local by, bh = y + h * 0.10, h * 0.24
  local bw = w * 0.44
  UI.confirm.btnYes = create_text({
    name = "confirmyes", parent = UI.host,
    x = x + w * 0.06, y = by, w = bw, h = bh,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.CONFIRM_RESIGN_YES,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })
  UI.confirm.btnNo = create_text({
    name = "confirmno", parent = UI.host,
    x = x + w * 0.50, y = by, w = bw, h = bh,
    bg = CONFIG.COLOR.BTN_BG, text = CONFIG.TEXT.CONFIRM_RESIGN_NO,
    fontColor = CONFIG.COLOR.BTN_TEXT, fontSize = L.font(CONFIG.FONT.BUTTON),
    hAlign = Enum.TextHorizontalAlignment.Middle, vAlign = Enum.TextVerticalAlignment.Middle,
    raycast = true,
  })
  UI.confirm.hitYes = create_cursor_area({
    name = "hitconfirmyes", parent = UI.host, x = x + w * 0.06, y = by, w = bw, h = bh,
  })
  UI.confirm.hitNo = create_cursor_area({
    name = "hitconfirmno", parent = UI.host, x = x + w * 0.50, y = by, w = bw, h = bh,
  })
  UI.confirm.parts = { UI.confirm.bg, UI.confirm.text, UI.confirm.btnYes, UI.confirm.btnNo,
                       UI.confirm.hitYes, UI.confirm.hitNo }
end

local function ui_set_active(ctrl, active)
  if ctrl == nil then return end
  if active then
    ctrl:SetActive(true)
    ctrl:SetVisible(true)
  else
    ctrl:SetVisible(false)
    ctrl:SetActive(false)
  end
end

-- =============================================================================
-- 第 7 区：GAME（业务状态与流程）
-- =============================================================================
local GAME = {
  state = "NEW",        -- NEW / STARTING / RUNNING / FAILED / DESTROYED
  st = nil,             -- 棋局状态
  selected = nil,       -- 选中的格号
  legalTargets = {},    -- 当前选中子的合法落点 { sq = true }
  legalMoves = {},      -- 当前选中子的合法走法列表
  pendingPromo = nil,   -- 待升变的走法
  over = false,
  resultText = nil, resultSub = nil,
  clockWhite = 900, clockBlack = 900,
  clockAccum = 0,
  turnCount = 0,
  moveLog = {},         -- { "白 e2→e4", ... }
  capturedWhite = {},   -- 白方被吃掉的子（字母）
  capturedBlack = {},
  lastFrom = nil, lastTo = nil,
  mySide = 1,           -- 联机模式：1=白 2=黑；本地同屏时无意义
  localMode = false,    -- 是否同屏模式
  drawCooldown = { [1] = 0, [2] = 0 },
  elapsedSec = 0,       -- 本局已用时（结算说明行用）
  pieceStyle = "glyph",  -- 棋子样式："disc" 圆盘+棋符 / "glyph" 纯棋符
  confirmKind = nil,   -- 当前确认弹窗类型（resign/newgame/switch/draw）
  startupRetry = 0,
  lastCanvasW = nil, lastCanvasH = nil,
  clockTextTimer = 0,
  uiReady = false,
}

local function format_clock(sec)
  if sec < 0 then sec = 0 end
  local total = math.floor(sec)
  local m = total // 60
  local s = total % 60
  return string.format("%02d:%02d", m, s)
end

local function update_clock_text(force)
  if not GAME.uiReady then return end
  GAME.clockTextTimer = GAME.clockTextTimer + 0 -- 由调用方管理
  if UI.panel.clockWhite then
    local tw = "你是白方"
    UI.panel.clockWhite.text = "白 " .. format_clock(GAME.clockWhite)
    UI.panel.clockWhite.fontColor = (GAME.clockWhite <= CONFIG.CLOCK_LOW_SEC)
      and color_of(CONFIG.COLOR.CLOCK_LOW) or color_of(CONFIG.COLOR.TEXT_MAIN)
  end
  if UI.panel.clockBlack then
    UI.panel.clockBlack.text = "黑 " .. format_clock(GAME.clockBlack)
    UI.panel.clockBlack.fontColor = (GAME.clockBlack <= CONFIG.CLOCK_LOW_SEC)
      and color_of(CONFIG.COLOR.CLOCK_LOW) or color_of(CONFIG.COLOR.TEXT_MAIN)
  end
end

local function update_turn_text()
  if not GAME.uiReady or UI.panel.turn == nil then return end
  if GAME.over then return end
  if GAME.st.turn == WHITE then
    UI.panel.turn.text = CONFIG.TEXT.TURN_WHITE
  else
    UI.panel.turn.text = CONFIG.TEXT.TURN_BLACK
  end
end

local function clear_highlights()
  for i = 1, 28 do
    if UI.legalHL[i] then ui_set_active(UI.legalHL[i], false) end
  end
  UI.legalHLUsed = 0
  if UI.selHL then ui_set_active(UI.selHL, false) end
  GAME.selected = nil
  GAME.legalTargets = {}
  GAME.legalMoves = {}
end

local function show_last_move()
  if not GAME.uiReady then return end
  if GAME.lastFrom and GAME.lastTo then
    local L = UI.L
    local x1, y1 = LAYOUT.square_pos(L, GAME.lastFrom)
    local x2, y2 = LAYOUT.square_pos(L, GAME.lastTo)
    UI.lastMoveHL[1]:SetAnchoredPosition(x1, y1)
    UI.lastMoveHL[2]:SetAnchoredPosition(x2, y2)
    ui_set_active(UI.lastMoveHL[1], true)
    ui_set_active(UI.lastMoveHL[2], true)
  else
    ui_set_active(UI.lastMoveHL[1], false)
    ui_set_active(UI.lastMoveHL[2], false)
  end
end

local function show_check_warning()
  if not GAME.uiReady then return end
  local ksq = nil
  if GAME.st then ksq = RULES.find_king(GAME.st, GAME.st.turn) end
  if ksq and RULES.in_check(GAME.st, GAME.st.turn) then
    local L = UI.L
    local x, y = LAYOUT.square_pos(L, ksq)
    UI.checkHL:SetAnchoredPosition(x, y)
    ui_set_active(UI.checkHL, true)
  else
    ui_set_active(UI.checkHL, false)
  end
end

-- 样式是否可用：纯棋符档永远可用；圆盘档需要图片控件模板索引已填（且槽位已建）
local function piece_style_available(style)
  if style == "glyph" then return true end
  if CONFIG.PREFAB_IMAGE == 0 then return false end
  local slot = UI.pieceSlots and UI.pieceSlots[1]
  if slot == nil then return false end
  return slot.discOuter ~= nil and slot.discInner ~= nil
end

-- 样式 → 按钮文案
local function piece_style_label(style)
  if style == "disc" then return CONFIG.TEXT.BTN_STYLE_DISC end
  return CONFIG.TEXT.BTN_STYLE_GLYPH
end

-- 样式 → 中文名（提示条用）
local function piece_style_name_cn(style)
  if style == "disc" then return "圆盘+棋符" end
  return "纯棋符"
end

-- 把一个槽位摆到某格并画成指定棋子
local function paint_slot(slot, p, bx, by, style)
  local L = UI.L
  local box = L.cell
  local D = box * 0.88
  local ring = box * 0.048
  local innerD = D - ring * 2
  local isWhite = p > 0
  local fill = isWhite and CONFIG.COLOR.WHITE_PIECE or CONFIG.COLOR.BLACK_PIECE
  local outline = isWhite and CONFIG.COLOR.WHITE_OUTLINE or CONFIG.COLOR.BLACK_OUTLINE

  if slot.discOuter then
    slot.discOuter:SetAnchoredPosition(bx + (box - D) / 2, by + (box - D) / 2)
  end
  if slot.discInner then
    slot.discInner:SetAnchoredPosition(bx + (box - innerD) / 2, by + (box - innerD) / 2)
  end
  if slot.glyph then
    slot.glyph:SetAnchoredPosition(bx + (box - innerD) / 2, by + (box - innerD) / 2)
    slot.glyph.text = PIECE_GLYPH[p] or PIECE_LETTER[p]
  end

  if style == "glyph" then
    -- 纯棋符：只有文本框，白方白字深描边、黑方深字浅描边
    if slot.discOuter then ui_set_active(slot.discOuter, false) end
    if slot.discInner then ui_set_active(slot.discInner, false) end
    if slot.glyph then
      slot.glyph.fontColor = color_of(fill)
      slot.glyph.enableOutline = true
      slot.glyph.outlineColor = color_of(outline)
      ui_set_active(slot.glyph, true)
    end
    return
  end

  -- 圆盘+棋符：外圈=描边色、内圈=棋子色，棋符画在圆盘上（字色=描边色，不加描边避免糊成一团）
  image_apply(slot.discOuter, CONFIG.PIECE_ASSET.CIRCLE, outline, nil)
  image_apply(slot.discInner, CONFIG.PIECE_ASSET.CIRCLE, fill, nil)
  ui_set_active(slot.discOuter, true)
  ui_set_active(slot.discInner, true)
  if slot.glyph then
    slot.glyph.fontColor = color_of(outline)
    slot.glyph.enableOutline = false
    ui_set_active(slot.glyph, true)
  end
end

-- 把一个槽位的所有层隐藏
local function hide_slot(slot)
  if slot == nil then return end
  if slot.discOuter then ui_set_active(slot.discOuter, false) end
  if slot.discInner then ui_set_active(slot.discInner, false) end
  if slot.glyph then ui_set_active(slot.glyph, false) end
end

-- 棋子渲染：按当前样式把 64 格里的棋子分配给 32 个槽位。播放期零创建零销毁。
local function render_pieces()
  if not GAME.uiReady then return end
  if UI.pieceSlots == nil or UI.pieceSlots[1] == nil then return end
  local style = GAME.pieceStyle
  if not piece_style_available(style) then style = "glyph" end

  local used = 0
  for sq = 0, 63 do
    local p = GAME.st.board[sq]
    if p ~= 0 then
      used = used + 1
      local slot = UI.pieceSlots[used]
      if slot == nil then break end
      slot.sq = sq
      local bx, by = LAYOUT.square_pos(UI.L, sq)
      paint_slot(slot, p, bx, by, style)
    end
  end
  -- 把超出实际棋子数的槽位隐藏（只隐藏上一帧显示过的，避免无谓 setter）
  local prev = UI.slotShown or 0
  local maxHide = used > prev and used or prev
  for i = used + 1, maxHide do
    hide_slot(UI.pieceSlots[i])
    UI.pieceSlots[i].sq = nil
  end
  UI.slotShown = used
end

local function render_captured()
  if not GAME.uiReady then return end
  if UI.panel.capturedWhite then
    UI.panel.capturedWhite.text = table.concat(GAME.capturedWhite, " ")
  end
  if UI.panel.capturedBlack then
    UI.panel.capturedBlack.text = table.concat(GAME.capturedBlack, " ")
  end
end

local function render_move_log()
  if not GAME.uiReady then return end
  if UI.panel.moveLog then
    local lines = {}
    local n = #GAME.moveLog
    local from = math.max(1, n - CONFIG.MOVE_LOG_LINES + 1)
    for i = from, n do lines[#lines + 1] = GAME.moveLog[i] end
    UI.panel.moveLog.text = table.concat(lines, "\n")
  end
end

local function render_all()
  render_pieces()
  render_captured()
  render_move_log()
  update_clock_text()
  update_turn_text()
  show_last_move()
  show_check_warning()
end

-- 走子记录文本：白 e2→e4

local function move_text(mv, side)
  local function sqname(sq)
    return string.char(string.byte("a") + (sq % 8)) .. tostring((sq // 8) + 1)
  end
  local prefix = (side == WHITE) and "白 " or "黑 "
  local s = prefix .. sqname(mv.from) .. "→" .. sqname(mv.to)
  if mv.promo then
    local chars = { [QUEEN] = "=Q", [ROOK] = "=R", [BISHOP] = "=B", [KNIGHT] = "=N" }
    s = s .. chars[mv.promo]
  end
  return s
end

-- 应用一步棋（含吃子记录、走子记录、棋钟加秒、终局判定）
local function apply_move(mv)
  local side = GAME.st.turn
  local captured = GAME.st.board[mv.to]
  if mv.ep then
    local capSq = shift(mv.to, side == WHITE and -1 or 1, 0)
    captured = GAME.st.board[capSq]
  end

  RULES.make(GAME.st, mv)

  -- 吃子记录
  if captured ~= 0 then
    local letter = PIECE_LETTER[captured]
    if captured > 0 then
      GAME.capturedWhite[#GAME.capturedWhite + 1] = letter
    else
      GAME.capturedBlack[#GAME.capturedBlack + 1] = letter
    end
  end

  -- 走子记录
  GAME.moveLog[#GAME.moveLog + 1] = move_text(mv, side)
  GAME.lastFrom = mv.from
  GAME.lastTo = mv.to
  GAME.turnCount = GAME.turnCount + 1

  -- 棋钟加秒（走子方 +INCREMENT）
  if side == WHITE then
    GAME.clockWhite = GAME.clockWhite + CONFIG.INCREMENT_SEC
  else
    GAME.clockBlack = GAME.clockBlack + CONFIG.INCREMENT_SEC
  end

  -- 终局判定
  local status = RULES.game_status(GAME.st)
  if status.over then
    GAME.over = true
    if status.result == "1-0" then
      GAME.resultText = CONFIG.TEXT.RESULT_WHITE_WIN
      GAME.resultSub = (status.reason == "checkmate") and CONFIG.TEXT.SUB_CHECKMATE
        or CONFIG.TEXT.SUB_RESIGN_BLACK
    elseif status.result == "0-1" then
      GAME.resultText = CONFIG.TEXT.RESULT_BLACK_WIN
      GAME.resultSub = (status.reason == "checkmate") and CONFIG.TEXT.SUB_CHECKMATE
        or CONFIG.TEXT.SUB_RESIGN_WHITE
    else
      GAME.resultText = CONFIG.TEXT.RESULT_DRAW_AGREED_AGREED
      if status.reason == "stalemate" then GAME.resultSub = CONFIG.TEXT.SUB_STALEMATE
      elseif status.reason == "fifty" then GAME.resultSub = CONFIG.TEXT.SUB_FIFTY
      elseif status.reason == "threefold" then GAME.resultSub = CONFIG.TEXT.SUB_THREEFOLD
      elseif status.reason == "insufficient" then GAME.resultSub = CONFIG.TEXT.SUB_INSUFFICIENT
      else GAME.resultSub = CONFIG.TEXT.SUB_DRAW_AGREED end
    end
    show_result()
  end

  clear_highlights()
  render_all()
end

function show_result()
  if not GAME.uiReady then return end
  UI.result.title.text = GAME.resultText or ""
  -- 结算说明行里的 {t} 用实际对局用时填充（docs/策划案.md 9.4）
  local sub = GAME.resultSub or ""
  if string.find(sub, "{t}", 1, true) then
    local elapsed = math.floor(GAME.elapsedSec or 0)
    local mm = elapsed // 60
    local ss = elapsed % 60
    sub = string.gsub(sub, "{t}", string.format("%02d:%02d", mm, ss))
  end
  UI.result.sub.text = sub
  ui_set_active(UI.result.overlay, true)
  ui_set_active(UI.result.bg, true)
  ui_set_active(UI.result.title, true)
  ui_set_active(UI.result.sub, true)
  ui_set_active(UI.result.btnAgain, true)
  ui_set_active(UI.result.hitAgain, true)
  ui_set_active(UI.result.hitOverlay, true)
  -- 终局后锁棋盘输入
  for sq = 0, 63 do
    if UI.hitAreas[sq] then ui_set_active(UI.hitAreas[sq], false) end
  end
end

local function hide_result()
  ui_set_active(UI.result.overlay, false)
  ui_set_active(UI.result.bg, false)
  ui_set_active(UI.result.title, false)
  ui_set_active(UI.result.sub, false)
  ui_set_active(UI.result.btnAgain, false)
  ui_set_active(UI.result.hitAgain, false)
  ui_set_active(UI.result.hitOverlay, false)
end

local function hide_promo()
  ui_set_active(UI.promo.bg, false)
  ui_set_active(UI.promo.prompt, false)
  for i = 1, 4 do
    ui_set_active(UI.promo.buttons[i], false)
    ui_set_active(UI.promo.hits[i], false)
  end
end

local function show_promo()
  ui_set_active(UI.promo.bg, true)
  ui_set_active(UI.promo.prompt, true)
  for i = 1, 4 do
    ui_set_active(UI.promo.buttons[i], true)
    ui_set_active(UI.promo.hits[i], true)
  end
end

local function hide_confirm()
  ui_set_active(UI.confirm.bg, false)
  ui_set_active(UI.confirm.text, false)
  ui_set_active(UI.confirm.btnYes, false)
  ui_set_active(UI.confirm.btnNo, false)
  ui_set_active(UI.confirm.hitYes, false)
  ui_set_active(UI.confirm.hitNo, false)
  GAME.confirmKind = nil
  -- 恢复棋盘输入（终局与升变时除外）
  if not GAME.over and GAME.pendingPromo == nil then
    for sq = 0, 63 do
      if UI.hitAreas[sq] then ui_set_active(UI.hitAreas[sq], true) end
    end
  end
end

-- 弹窗类型与文案映射（docs/策划案.md 9.5 C-01~C-04）
local CONFIRM_SPEC = {
  resign = { text = "CONFIRM_RESIGN",  yes = "CONFIRM_RESIGN_YES", no = "CONFIRM_RESIGN_NO" },
  newgame = { text = "CONFIRM_NEWGAME", yes = "CONFIRM_YES", no = "CONFIRM_NO" },
  switch = { text = "CONFIRM_SWITCH",  yes = "CONFIRM_YES", no = "CONFIRM_NO" },
  draw = { text = "CONFIRM_DRAW",      yes = "CONFIRM_DRAW_YES", no = "CONFIRM_DRAW_NO" },
}

local function show_confirm(kind)
  local spec = CONFIRM_SPEC[kind] or CONFIRM_SPEC.newgame
  UI.confirm.text.text = CONFIG.TEXT[spec.text]
  UI.confirm.btnYes.text = CONFIG.TEXT[spec.yes]
  UI.confirm.btnNo.text = CONFIG.TEXT[spec.no]
  GAME.confirmKind = kind
  ui_set_active(UI.confirm.bg, true)
  ui_set_active(UI.confirm.text, true)
  ui_set_active(UI.confirm.btnYes, true)
  ui_set_active(UI.confirm.btnNo, true)
  ui_set_active(UI.confirm.hitYes, true)
  ui_set_active(UI.confirm.hitNo, true)
  -- 弹窗期间锁棋盘输入
  for sq = 0, 63 do
    if UI.hitAreas[sq] then ui_set_active(UI.hitAreas[sq], false) end
  end
end

-- 新开一局
local function new_game()
  GAME.st = RULES.parse_fen(START_FEN)
  GAME.over = false
  GAME.resultText = nil
  GAME.resultSub = nil
  GAME.clockWhite = CONFIG.INITIAL_TIME_SEC
  GAME.clockBlack = CONFIG.INITIAL_TIME_SEC
  GAME.moveLog = {}
  GAME.capturedWhite = {}
  GAME.capturedBlack = {}
  GAME.lastFrom = nil
  GAME.lastTo = nil
  GAME.turnCount = 0
  GAME.elapsedSec = 0
  GAME.pendingPromo = nil
  GAME.drawCooldown[1] = 0
  GAME.drawCooldown[2] = 0
  clear_highlights()
  hide_result()
  hide_promo()
  hide_confirm()
  if GAME.uiReady then
    for sq = 0, 63 do
      if UI.hitAreas[sq] then ui_set_active(UI.hitAreas[sq], true) end
    end
    if UI.panel.hint then UI.panel.hint.text = CONFIG.TEXT.HINT_OPENING end
  end
  render_all()
end

-- 选中一枚子
local function select_square(sq)
  local st = GAME.st
  local p = st.board[sq]
  if p == 0 then return false end
  -- 只能选自己一方的子
  if (p > 0) ~= (st.turn == WHITE) then return false end
  -- 联机模式下只能操作自己那一方
  if not GAME.localMode then
    local myTurn = (GAME.mySide == 1 and st.turn == WHITE) or (GAME.mySide == 2 and st.turn == BLACK)
    if not myTurn then return false end
  end

  local moves = RULES.legal_moves(st)
  local targets = {}
  local mine = {}
  for _, mv in ipairs(moves) do
    if mv.from == sq then
      mine[#mine + 1] = mv
      targets[mv.to] = true
    end
  end
  if #mine == 0 then return false end

  GAME.selected = sq
  GAME.legalTargets = targets
  GAME.legalMoves = mine

  -- 显示选中高亮
  local L = UI.L
  local x, y = LAYOUT.square_pos(L, sq)
  UI.selHL:SetAnchoredPosition(x, y)
  ui_set_active(UI.selHL, true)

  -- 显示落点高亮
  local idx = 0
  for to, _ in pairs(targets) do
    idx = idx + 1
    if idx > 28 then break end
    local tx, ty = LAYOUT.square_pos(L, to)
    UI.legalHL[idx]:SetAnchoredPosition(tx, ty)
    ui_set_active(UI.legalHL[idx], true)
  end
  GAME.legalHLUsed = idx
  if UI.panel.hint then UI.panel.hint.text = CONFIG.TEXT.HINT_SELECTED end
  return true
end

-- 尝试走子
local function try_move(toSq)
  if GAME.selected == nil then return false end
  if not GAME.legalTargets[toSq] then return false end

  -- 找出所有落到该格的走法（升变会有 4 条）
  local candidates = {}
  for _, mv in ipairs(GAME.legalMoves) do
    if mv.to == toSq then candidates[#candidates + 1] = mv end
  end
  if #candidates == 0 then return false end

  if #candidates > 1 and candidates[1].promo ~= nil then
    -- 需要玩家选升变
    GAME.pendingPromo = candidates
    show_promo()
    for sq = 0, 63 do
      if UI.hitAreas[sq] then ui_set_active(UI.hitAreas[sq], false) end
    end
    return true
  end

  apply_move(candidates[1])
  net_send_move(candidates[1])
  return true
end

-- 处理棋盘点击
local function on_square_clicked(sq)
  if GAME.state ~= "RUNNING" or GAME.over or GAME.pendingPromo then return end

  -- 已选中且点的是合法落点 → 走子
  if GAME.selected ~= nil and GAME.legalTargets[sq] then
    try_move(sq)
    return
  end

  -- 点同一枚已选中的子 → 取消
  if GAME.selected == sq then
    clear_highlights()
    if UI.panel.hint then UI.panel.hint.text = CONFIG.TEXT.HINT_OPENING end
    return
  end

  -- 尝试选中
  local ok = select_square(sq)
  if not ok then
    clear_highlights()
    if UI.panel.hint then UI.panel.hint.text = CONFIG.TEXT.HINT_OPENING end
  end
end

-- =============================================================================
-- 第 8 区：INPUT（输入）
--   原生命中方案：每格一个光标检测区，回调闭包捕获格号，不读坐标。
-- =============================================================================
local INPUT = { registered = {} }

-- 点击事件枚举：沙箱叫 Click，真机文档叫 CursorClick。两边兼容。
local function resolve_click_event()
  local ok, ev = pcall(function() return Enum.CursorEventType.CursorClick end)
  if ok and ev ~= nil then return ev end
  ok, ev = pcall(function() return Enum.CursorEventType.Click end)
  if ok and ev ~= nil then return ev end
  return nil
end

local CLICK_EVENT = nil

local function register_click(ctrl, fn)
  if ctrl == nil or CLICK_EVENT == nil then return false end
  local ok = pcall(function()
    ctrl:AddCursorEventListener(CLICK_EVENT, function(data)
      local handled = fn()
      return handled ~= false
    end)
  end)
  if ok then
    INPUT.registered[#INPUT.registered + 1] = ctrl
    return true
  end
  return false
end

local function register_all_input()
  -- 64 个棋盘格
  for sq = 0, 63 do
    register_click(UI.hitAreas[sq], function() on_square_clicked(sq); return true end)
  end
  -- 侧面板按钮
  -- 新开一局：按 C-02 先确认「重开会清空这一局」
  register_click(UI.panel.hitNew, function()
    if GAME.over then new_game(); return true end
    show_confirm("newgame")
    return true
  end)
  -- 认输：按 C-01 先确认「认输就直接判负，确定吗」
  register_click(UI.panel.hitResign, function()
    if GAME.over then return true end
    show_confirm("resign")
    return true
  end)
  -- 求和：本地同屏直接按 C-04 询问对方；联机发 EV_DRAW_REQ
  register_click(UI.panel.hitDraw, function()
    if GAME.over then return true end
    local sideIdx = (GAME.st.turn == WHITE) and 1 or 2
    if GAME.drawCooldown[sideIdx] > 0 then
      if UI.panel.hint then UI.panel.hint.text = CONFIG.TEXT.BTN_DRAW_USED end
      return true
    end
    GAME.drawCooldown[sideIdx] = CONFIG.DRAW_COOLDOWN_SEC
    if GAME.localMode then
      show_confirm("draw")
    else
      net_send_event(CONFIG.EV_DRAW_REQ, sideIdx - 1, 0, 0, "")
    end
    return true
  end)
  -- 切换同屏/联机：按 C-03 先确认「切换会断开这一局，确定吗」
  register_click(UI.panel.hitLocal, function()
    show_confirm("switch")
    return true
  end)
  -- 棋子样式切换：按 CONFIG.PIECE_STYLE_CYCLE 循环，不可用的样式自动跳过。
  register_click(UI.panel.hitStyle, function()
    local cycle = CONFIG.PIECE_STYLE_CYCLE
    local cur = GAME.pieceStyle
    local startIdx = 1
    for i = 1, #cycle do
      if cycle[i] == cur then startIdx = i; break end
    end
    local nextStyle = cur
    for step = 1, #cycle do
      local idx = ((startIdx - 1 + step) % #cycle) + 1
      if piece_style_available(cycle[idx]) then nextStyle = cycle[idx]; break end
    end
    GAME.pieceStyle = nextStyle
    if UI.panel.btnStyle then UI.panel.btnStyle.text = piece_style_label(nextStyle) end
    if UI.panel.hint then UI.panel.hint.text = "棋子样式：" .. piece_style_name_cn(nextStyle) end
    render_pieces()
    return true
  end)
  -- 结算面板「再来一局」
  register_click(UI.result.hitAgain, function() new_game(); return true end)
  -- 升变四选一
  for i = 1, 4 do
    register_click(UI.promo.hits[i], function()
      if not GAME.pendingPromo then return true end
      local promoPieces = { QUEEN, ROOK, BISHOP, KNIGHT }
      local want = promoPieces[i]
      local chosen = nil
      for _, mv in ipairs(GAME.pendingPromo) do
        if mv.promo == want then chosen = mv; break end
      end
      GAME.pendingPromo = nil
      hide_promo()
      if chosen then
        for sq = 0, 63 do
          if UI.hitAreas[sq] then ui_set_active(UI.hitAreas[sq], true) end
        end
        apply_move(chosen)
        net_send_move(chosen)
      end
      return true
    end)
  end
  -- 确认弹窗：确定
  register_click(UI.confirm.hitYes, function()
    local kind = GAME.confirmKind
    hide_confirm()
    if kind == "resign" then
      if GAME.over then return true end
      GAME.over = true
      if GAME.st.turn == WHITE then
        GAME.resultText = CONFIG.TEXT.RESULT_RESIGN_WHITE
        GAME.resultSub = CONFIG.TEXT.SUB_RESIGN_WHITE
        net_send_event(CONFIG.EV_RESIGN, 0, 0, 0, "")
      else
        GAME.resultText = CONFIG.TEXT.RESULT_RESIGN_BLACK
        GAME.resultSub = CONFIG.TEXT.SUB_RESIGN_BLACK
        net_send_event(CONFIG.EV_RESIGN, 1, 0, 0, "")
      end
      show_result()
    elseif kind == "newgame" then
      new_game()
    elseif kind == "switch" then
      GAME.localMode = not GAME.localMode
      if UI.panel.hint then
        UI.panel.hint.text = GAME.localMode and "已切换到同屏轮流" or CONFIG.TEXT.TURN_WHITE
      end
    elseif kind == "draw" then
      GAME.over = true
      GAME.resultText = CONFIG.TEXT.RESULT_DRAW_AGREED
      GAME.resultSub = CONFIG.TEXT.SUB_DRAW_AGREED
      show_result()
      net_send_event(CONFIG.EV_DRAW_ACC, 0, 0, 0, "")
    end
    return true
  end)
  -- 确认弹窗：取消
  register_click(UI.confirm.hitNo, function()
    local kind = GAME.confirmKind
    hide_confirm()
    if kind == "draw" then
      if UI.panel.hint then UI.panel.hint.text = "对方拒绝和棋，继续对局" end
      net_send_event(CONFIG.EV_DRAW_NO, 0, 0, 0, "")
    end
    return true
  end)
end

-- =============================================================================
-- 第 9 区：NET（联机，能力探测 + 降级）
--   客户端发出 ChessSync；服务端节点图「收到即广播」由用户在编辑器里搭。
--   沙箱里 ServerSignal 没有 AddInt 方法，所以这里必须能力探测，不能直接调用。
-- =============================================================================
local NET = { canSend = false, canReceive = false, probed = false, lastSeq = -1 }

local function net_probe()
  NET.probed = true
  -- 探测发送能力
  local ok = pcall(function()
    local sig = game.ServerSignal(CONFIG.SIGNAL_NAME)
    if sig ~= nil and sig.AddInt ~= nil and sig.AddString ~= nil and sig.SendSignal ~= nil then
      NET.canSend = true
    end
  end)
  -- 探测接收能力
  pcall(function()
    if script ~= nil and script.RegisterServerSignalHandler ~= nil then
      NET.canReceive = true
    end
  end)
  log_info("联机能力探测：发送=%s 接收=%s", tostring(NET.canSend), tostring(NET.canReceive))
end

function net_send_event(eventType, a, b, c, fen)
  if not NET.canSend then return false end
  local ok = pcall(function()
    local sig = game.ServerSignal(CONFIG.SIGNAL_NAME)
    sig:AddInt(eventType)
    sig:AddInt(a or 0)
    sig:AddInt(b or 0)
    sig:AddInt(c or 0)
    sig:AddString(fen or "")
    sig:SendSignal()
  end)
  if not ok then
    NET.canSend = false
    log_err("信号发送失败，联机降级为同屏")
  end
  return ok
end

function net_send_move(mv)
  if not NET.canSend then return end
  local promoCode = 0
  if mv.promo == QUEEN then promoCode = 1
  elseif mv.promo == ROOK then promoCode = 2
  elseif mv.promo == BISHOP then promoCode = 3
  elseif mv.promo == KNIGHT then promoCode = 4 end
  net_send_event(CONFIG.EV_MOVE, mv.from, mv.to, promoCode, "")
end

-- 收到信号：处理走子/新局/认输/求和/身份
local function net_on_signal(signalName, params)
  if GAME.state ~= "RUNNING" then return end
  if type(params) ~= "table" then return end
  local eventType = params[1]
  local a = params[2] or 0
  local b = params[3] or 0
  local c = params[4] or 0
  if type(eventType) ~= "number" then return end

  if eventType == CONFIG.EV_MOVE then
    -- 对方走了一步：本地重算并校验
    local promoPieces = { [0] = nil, [1] = QUEEN, [2] = ROOK, [3] = BISHOP, [4] = KNIGHT }
    local wantPromo = promoPieces[c]
    local candidates = {}
    for _, mv in ipairs(RULES.legal_moves(GAME.st)) do
      if mv.from == a and mv.to == b then
        if (wantPromo == nil and mv.promo == nil) or (wantPromo ~= nil and mv.promo == wantPromo) then
          candidates[#candidates + 1] = mv
        end
      end
    end
    if #candidates > 0 then
      apply_move(candidates[1])
    else
      log_err("收到无法验证的走子信号：%d→%d", a, b)
    end

  elseif eventType == CONFIG.EV_NEWGAME then
    new_game()

  elseif eventType == CONFIG.EV_RESIGN then
    GAME.over = true
    if a == 0 then
      GAME.resultText = CONFIG.TEXT.RESULT_BLACK_WIN
      GAME.resultSub = CONFIG.TEXT.SUB_RESIGN_WHITE
    else
      GAME.resultText = CONFIG.TEXT.RESULT_WHITE_WIN
      GAME.resultSub = CONFIG.TEXT.SUB_RESIGN_BLACK
    end
    show_result()

  elseif eventType == CONFIG.EV_DRAW_REQ then
    show_confirm()

  elseif eventType == CONFIG.EV_DRAW_ACC then
    GAME.over = true
    GAME.resultText = CONFIG.TEXT.RESULT_DRAW_AGREED_AGREED
    GAME.resultSub = CONFIG.TEXT.SUB_DRAW_AGREED
    show_result()

  elseif eventType == CONFIG.EV_DRAW_NO then
    if UI.panel.hint then UI.panel.hint.text = "对方拒绝和棋，继续对局" end

  elseif eventType == CONFIG.EV_ROLE then
    GAME.mySide = (a == 0) and 1 or 2
    if UI.panel.hint then
      UI.panel.hint.text = (GAME.mySide == 1) and "你是白方" or "你是黑方"
    end
  end
end

local function net_register_receive()
  if not NET.canReceive then return false end
  local ok = pcall(function()
    script:RegisterServerSignalHandler(CONFIG.SIGNAL_NAME, function(signalName, params)
      net_on_signal(signalName, params)
    end)
  end)
  if ok then
    log_info("已注册联机信号接收：%s", CONFIG.SIGNAL_NAME)
    return true
  end
  return false
end

-- =============================================================================
-- 第 10 区：LIFECYCLE（生命周期与清理）
-- =============================================================================

-- 校验配置：三项模板索引必须非 0
local function validate_config()
  local missing = {}
  if CONFIG.CONTAINER_NODE_INDEX == 0 then missing[#missing + 1] = "CONTAINER_NODE_INDEX" end
  if CONFIG.PREFAB_TEXT_BOX == 0 then missing[#missing + 1] = "PREFAB_TEXT_BOX" end
  if CONFIG.PREFAB_CURSOR_AREA == 0 then missing[#missing + 1] = "PREFAB_CURSOR_AREA" end
  if #missing > 0 then
    return false, table.concat(missing, ", ")
  end
  return true, nil
end

-- 检查画布尺寸是否有效（有限正数）
local function read_canvas()
  local ok, w, h = pcall(function() return game.GetUICanvasSize() end)
  if not ok then return nil, nil, "GetUICanvasSize 调用失败" end
  if type(w) ~= "number" or type(h) ~= "number" then return nil, nil, "返回值不是数字" end
  if w ~= w or h ~= h then return nil, nil, "返回 NaN" end
  if w <= 0 or h <= 0 then return nil, nil, "返回非正数" end
  if math.isinf(w) or math.isinf(h) then return nil, nil, "返回无穷" end
  return w, h, nil
end

-- 获取挂载容器
local function read_container()
  -- 【为什么用 script.object】
  -- 官方编辑器指南与 API 文档示例都用 script.object 作为挂载容器：
  -- 脚本挂在「容器节点」上，script.object 就是那个容器节点。
  -- game.GetClientUIControl(controlId) 的参数是**运行时 ID**（文档 L176），
  -- 不是用户填的**模板索引**，两者不是一回事，不能拿来取容器。
  -- 因此：优先 script.object；它为 nil 时再用 GetClientUIControl 兜底（兼容旧写法）。
  local ok, host = pcall(function() return script.object end)
  if ok and host ~= nil then
    return host
  end
  local ok2, ctrl = pcall(function()
    return game.GetClientUIControl(CONFIG.CONTAINER_NODE_INDEX)
  end)
  if ok2 and ctrl ~= nil then
    return ctrl
  end
  return nil, "取不到挂载容器（script.object 与 GetClientUIControl 都返回空）"
end

local function build_all_ui()
  if UI.built then return true end
  local w, h, err = read_canvas()
  if not w then
    log_info("画布尚未就绪：%s", tostring(err))
    return false
  end
  -- 先取挂载容器：所有自建控件都挂在它下面
  -- 取不到时不阻断启动，改用 nil 父级（挂到默认容器根），只记一条日志。
  -- 理由：真机上 script.object 一般可用；异常环境下退化为默认根，
  --       仍能创建控件并显示，比直接放弃启动好得多。
  local host, hostErr = read_container()
  if host == nil then
    log_once("no_host", "挂载容器未取到（%s），控件将挂到默认根", tostring(hostErr))
  end
  UI.host = host   -- 可能为 nil，create_* 会原样传给 InstantiateClientUIControl

  UI.L = LAYOUT.compute(w, h)
  GAME.lastCanvasW, GAME.lastCanvasH = w, h

  build_board()
  build_panel()
  build_result_panel()
  build_promo_dialog()
  build_confirm_dialog()
  UI.built = true
  GAME.uiReady = true

  -- 统一启用所有已创建控件（创建时全部 SetActive(false)）
  for i = 1, #FACTORY.cleanup do
    local ctrl = FACTORY.cleanup[i]
    if ctrl ~= nil then
      ctrl:SetActive(true)
      ctrl:SetVisible(true)
    end
  end
  -- 结算/升变/求和弹窗初始隐藏
  hide_result()
  hide_promo()
  hide_confirm()

  log_info("界面构建完成：控件 %d 个，画布 %dx%d，格宽 %.1f",
    FACTORY.created, w, h, UI.L.cell)
  return true
end

local function cleanup_all()
  -- 反向释放：注销监听 → 销毁控件
  for i = #INPUT.registered, 1, -1 do
    local ctrl = INPUT.registered[i]
    if ctrl ~= nil then
      pcall(function()
        if CLICK_EVENT ~= nil then ctrl:RemoveCursorEventListeners(CLICK_EVENT) end
      end)
    end
  end
  INPUT.registered = {}

  for i = #FACTORY.cleanup, 1, -1 do
    local ctrl = FACTORY.cleanup[i]
    if ctrl ~= nil then
      pcall(function() game.DestroyClientUIControl(ctrl) end)
    end
  end
  FACTORY.cleanup = {}
  UI.built = false
  GAME.uiReady = false
end

-- ===== 生命周期回调 =====
function OnInit()
  GAME.state = "NEW"
  log_info("脚本初始化")
end

function OnStart()
  GAME.state = "STARTING"
  GAME.startupRetry = 0

  -- ① 先验证配置（配置错误立即报错，不重试）
  local cfgOk, missing = validate_config()
  if not cfgOk then
    log_err(CONFIG.TEXT.ERR_CONFIG)
    emit_fault("CFG_MISSING", "STARTING", "配置缺失: " .. tostring(missing), nil, "CONFIG 第 1 区")
    GAME.state = "FAILED"
    return
  end

  -- ② 探测联机能力（无论成功与否都不阻断启动）
  net_probe()

  -- ③ 尝试构建界面（画布未就绪时由 OnUpdate 有限重试）
  if not build_all_ui() then
    log_info("界面尚未就绪，将在逐帧里有限重试（预算 %d 帧）", CONFIG.STARTUP_RETRY_BUDGET)
    script:EnableUpdate(true)
    return
  end

  -- ④ 解析点击事件枚举
  CLICK_EVENT = resolve_click_event()
  if CLICK_EVENT == nil then
    log_err("取不到光标点击事件枚举，界面不可交互")
    emit_fault("EVENT_ENUM_MISSING", "STARTING", "Enum.CursorEventType 无可用值", nil, "API 文档 L424-435")
    GAME.state = "FAILED"
    return
  end

  -- ⑤ 注册输入
  register_all_input()

  -- ⑥ 注册联机接收
  net_register_receive()

  -- ⑦ 开局
  -- 按配置决定初始棋子样式；圆盘档需要图片控件模板索引，没填就自动回落「纯棋符」
  GAME.pieceStyle = CONFIG.DEFAULT_PIECE_STYLE
  if not piece_style_available(GAME.pieceStyle) then GAME.pieceStyle = "glyph" end
  if UI.panel.btnStyle then UI.panel.btnStyle.text = piece_style_label(GAME.pieceStyle) end

  new_game()
  GAME.state = "RUNNING"
  script:EnableUpdate(true)

  log_info("启动完成：状态=%s 控件=%d 联机发送=%s 接收=%s 同屏=%s",
    GAME.state, FACTORY.created, tostring(NET.canSend), tostring(NET.canReceive), tostring(GAME.localMode))

  -- 启动汇总（一次）
  log_info("容器索引=%d 脚本短名=%s 画布=%dx%d",
    CONFIG.CONTAINER_NODE_INDEX, CONFIG.SCRIPT_SHORT_NAME,
    GAME.lastCanvasW or -1, GAME.lastCanvasH or -1)
end

function OnEnable()
  log_info("脚本启用")
end

function OnUpdate(dt)
  -- ① STARTING 阶段：只推进就绪重试，不推进玩法
  if GAME.state == "STARTING" then
    GAME.startupRetry = GAME.startupRetry + 1
    if GAME.startupRetry > CONFIG.STARTUP_RETRY_BUDGET then
      emit_fault("STARTUP_TIMEOUT", "STARTING",
        "画布或容器在 " .. tostring(CONFIG.STARTUP_RETRY_BUDGET) .. " 帧内仍未就绪",
        nil, "OnUpdate 重试计数")
      GAME.state = "FAILED"
      return
    end
    if build_all_ui() then
      CLICK_EVENT = resolve_click_event()
      if CLICK_EVENT == nil then
        emit_fault("EVENT_ENUM_MISSING", "STARTING", "Enum.CursorEventType 无可用值", nil, "API 文档 L424-435")
        GAME.state = "FAILED"
        return
      end
      register_all_input()
      net_register_receive()
      new_game()
      GAME.state = "RUNNING"
    end
    return
  end

  if GAME.state ~= "RUNNING" then return end

  -- ② 时间增量校验（异常值跳过本帧）
  if type(dt) ~= "number" or dt ~= dt or dt <= 0 or math.isinf(dt) then return end

  -- ③ 本局用时累加（结算说明行「本局用时 MM:SS」用）
  if not GAME.over then
    GAME.elapsedSec = (GAME.elapsedSec or 0) + dt
  end

  -- ④ 棋钟：只有轮到的一方在扣时；终局后不扣
  if not GAME.over then
    if GAME.st.turn == WHITE then
      GAME.clockWhite = GAME.clockWhite - dt
      if GAME.clockWhite <= 0 then
        GAME.clockWhite = 0
        GAME.over = true
        GAME.resultText = CONFIG.TEXT.RESULT_TIMEOUT_WHITE
        GAME.resultSub = CONFIG.TEXT.SUB_TIMEOUT_WHITE
        show_result()
      end
    else
      GAME.clockBlack = GAME.clockBlack - dt
      if GAME.clockBlack <= 0 then
        GAME.clockBlack = 0
        GAME.over = true
        GAME.resultText = CONFIG.TEXT.RESULT_TIMEOUT_BLACK
        GAME.resultSub = CONFIG.TEXT.SUB_TIMEOUT_BLACK
        show_result()
      end
    end
  end

  -- ④ 求和冷却倒计时
  for i = 1, 2 do
    if GAME.drawCooldown[i] > 0 then
      GAME.drawCooldown[i] = math.max(0, GAME.drawCooldown[i] - dt)
    end
  end

  -- ⑤ 棋钟文本按 CLOCK_REFRESH_SEC 刷新（不逐帧写文本）
  GAME.clockTextTimer = GAME.clockTextTimer + dt
  if GAME.clockTextTimer >= CONFIG.CLOCK_REFRESH_SEC then
    GAME.clockTextTimer = 0
    update_clock_text()
  end
end

function OnLevelUpdate(dt)
  -- 棋钟不受关卡时停影响，故本函数不做任何事（刻意保留为空）
end

function OnDisable()
  log_info("脚本停用")
end

function OnDestroy()
  if GAME.state == "DESTROYED" then return end
  GAME.state = "DESTROYED"
  pcall(function() script:EnableUpdate(false) end)
  cleanup_all()
  log_info("脚本销毁：已释放 %d 个控件", FACTORY.created)
end

-- =============================================================================
-- 第 11 区：SELFTEST（自检入口，不参与玩法）
--   供沙箱与真机诊断调用；不改变玩法状态。
-- =============================================================================

-- perft 自检：跑标准局面，与硬编码答案比对
local PERFT_CASES = {
  { name = "initial", fen = START_FEN, d1 = 20, d2 = 400, d3 = 8902 },
  { name = "kiwipete",
    fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    d1 = 48, d2 = 2039, d3 = 97862 },
  { name = "pos3", fen = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    d1 = 14, d2 = 191, d3 = 2812 },
  { name = "pos4", fen = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    d1 = 6, d2 = 264, d3 = 9467 },
  { name = "pos5", fen = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    d1 = 44, d2 = 1486, d3 = 62379 },
  { name = "pos6", fen = "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    d1 = 46, d2 = 2079, d3 = 89890 },
}

function SelfTestPerft(maxDepth)
  maxDepth = maxDepth or 3
  local failures = {}
  local checked = 0
  for _, c in ipairs(PERFT_CASES) do
    local st = RULES.parse_fen(c.fen)
    for d = 1, maxDepth do
      local expect = c["d" .. tostring(d)]
      if expect then
        local got = RULES.perft(st, d)
        checked = checked + 1
        if got ~= expect then
          failures[#failures + 1] = string.format("%s d=%d got=%d expect=%d", c.name, d, got, expect)
        end
      end
    end
  end
  return #failures == 0, checked, failures
end

-- 汇总自检：返回给沙箱/诊断的结构化结果
function SelfTest()
  local out = { ok = true, checks = {} }
  local function add(name, pass, detail)
    out.checks[#out.checks + 1] = { name = name, pass = pass, detail = detail or "" }
    if not pass then out.ok = false end
  end

  -- 1 规则 perft
  local okPerft, checked, failures = SelfTestPerft(2)
  add("perft_d1_d2", okPerft, okPerft and ("checked=" .. tostring(checked)) or table.concat(failures, "; "))

  -- 2 状态
  add("state_running", GAME.state == "RUNNING", "state=" .. tostring(GAME.state))

  -- 3 控件数量
  add("controls_created", FACTORY.created > 0, "created=" .. tostring(FACTORY.created))

  -- 4 界面已建
  add("ui_built", UI.built == true, "built=" .. tostring(UI.built))

  -- 5 联机能力（沙箱里 canSend 应为 false，这是正常的）
  add("net_probe_done", NET.probed == true,
    "canSend=" .. tostring(NET.canSend) .. " canReceive=" .. tostring(NET.canReceive))

  return out
end

-- 供外部调用：读取当前局面的 FEN
function GetCurrentFen()
  if GAME.st == nil then return "" end
  return RULES.fen_of(GAME.st)
end

-- 供外部调用：按 UCI 走一步（诊断/测试用）
function DebugPlayUci(uci)
  if GAME.st == nil or GAME.over then return false end
  local mv = RULES.find_move(GAME.st, uci)
  if mv == nil then return false end
  apply_move(mv)
  return true
end
