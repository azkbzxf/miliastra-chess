-- =============================================================================
--  sim/game_probe.lua · 用真实游戏脚本的图元棋子，画满 32 枚棋盘
--  目的：确认 PIECE_SHAPES + 描边层在真实棋格尺寸下的可读性
-- =============================================================================
local IMAGE_PREFAB_ID = 1073742107
local RECT, CIRCLE, TRI = 100001, 100002, 100003

local PIECE_SHAPES = {
  pawn = {
    { "rect",   0.50, 0.100, 0.54, 0.140, 0 },
    { "rect",   0.50, 0.230, 0.42, 0.120, 0 },
    { "tri",    0.50, 0.410, 0.40, 0.330, 0 },
    { "rect",   0.50, 0.575, 0.155, 0.085, 0 },
    { "circle", 0.50, 0.735, 0.235, 0.235, 0 },
  },
  rook = {
    { "rect", 0.50, 0.100, 0.60, 0.150, 0 },
    { "rect", 0.50, 0.225, 0.44, 0.110, 0 },
    { "rect", 0.50, 0.400, 0.36, 0.240, 0 },
    { "rect", 0.50, 0.560, 0.44, 0.085, 0 },
    { "rect", 0.50, 0.655, 0.56, 0.110, 0 },
    { "rect", 0.285, 0.805, 0.120, 0.190, 0 },
    { "rect", 0.500, 0.805, 0.120, 0.190, 0 },
    { "rect", 0.715, 0.805, 0.120, 0.190, 0 },
  },
  knight = {
    { "rect",   0.50,  0.100, 0.60, 0.150, 0 },
    { "rect",   0.50,  0.225, 0.46, 0.110, 0 },
    { "rect",   0.560, 0.450, 0.30, 0.440, 8 },
    { "rect",   0.400, 0.670, 0.36, 0.240, 40 },
    { "tri",    0.230, 0.625, 0.26, 0.190, 90 },
    { "circle", 0.545, 0.810, 0.22, 0.220, 0 },
    { "tri",    0.640, 0.885, 0.12, 0.150, -10 },
  },
  bishop = {
    { "rect",   0.50, 0.075, 0.60, 0.110, 0 },
    { "circle", 0.50, 0.205, 0.46, 0.190, 0 },
    { "rect",   0.50, 0.300, 0.30, 0.070, 0 },
    { "circle", 0.50, 0.480, 0.26, 0.240, 0 },
    { "circle", 0.50, 0.680, 0.52, 0.440, 0 },
    { "circle", 0.50, 0.930, 0.135, 0.135, 0 },
  },
  queen = {
    { "rect",   0.50, 0.070, 0.62, 0.110, 0 },
    { "circle", 0.50, 0.200, 0.50, 0.190, 0 },
    { "rect",   0.50, 0.300, 0.36, 0.070, 0 },
    { "circle", 0.50, 0.410, 0.34, 0.190, 0 },
    { "rect",   0.50, 0.500, 0.44, 0.090, 0 },
    { "tri",    0.190, 0.650, 0.110, 0.260, -26 },
    { "tri",    0.345, 0.700, 0.110, 0.300, -13 },
    { "tri",    0.500, 0.720, 0.110, 0.320, 0 },
    { "tri",    0.655, 0.700, 0.110, 0.300, 13 },
    { "tri",    0.810, 0.650, 0.110, 0.260, 26 },
    { "circle", 0.135, 0.795, 0.150, 0.150, 0 },
    { "circle", 0.315, 0.855, 0.150, 0.150, 0 },
    { "circle", 0.500, 0.885, 0.155, 0.155, 0 },
    { "circle", 0.685, 0.855, 0.150, 0.150, 0 },
    { "circle", 0.865, 0.795, 0.150, 0.150, 0 },
  },
  king = {
    { "rect",   0.50, 0.100, 0.62, 0.150, 0 },
    { "rect",   0.50, 0.225, 0.48, 0.110, 0 },
    { "tri",    0.50, 0.400, 0.46, 0.330, 0 },
    { "rect",   0.50, 0.560, 0.44, 0.085, 0 },
    { "rect",   0.50, 0.650, 0.46, 0.100, 0 },
    { "circle", 0.50, 0.760, 0.30, 0.230, 0 },
    { "rect",   0.50, 0.865, 0.070, 0.150, 0 },
    { "rect",   0.50, 0.900, 0.190, 0.065, 0 },
  },
}

local C = {
  white = { 252, 252, 250, 255 },
  black = { 26, 24, 22, 255 },
  outlineW = { 38, 34, 28, 255 },
  outlineB = { 238, 234, 226, 255 },
  sqLight = { 238, 228, 208, 255 },
  sqDark = { 106, 130, 150, 255 },
  bg = { 18, 22, 30, 255 },
}
local GROW = 1.155
local created = {}
local function col(c) return Color.FromRGBA(c[1], c[2], c[3], c[4]) end

local function mk(asset, x, y, w, h, rot, color)
  local c = game.InstantiateClientUIControl(IMAGE_PREFAB_ID, script.object)
  if c == nil then return nil end
  c:SetPivot(0.5, 0.5)
  c:SetAnchorMin(0, 0)
  c:SetAnchorMax(0, 0)
  c:SetSizeDelta(w, h)
  c:SetAnchoredPosition(x, y)
  pcall(function() c:SetImage(Enum.ImageSource.StaticReference, asset) end)
  local it = Enum.ImageType and Enum.ImageType.Stretch
  if it ~= nil then pcall(function() c.imageType = it end) end
  c.imageColor = col(color)
  if rot ~= 0 then pcall(function() c:SetLocalRotation(0, 0, rot) end) end
  c:SetActive(true)
  c:SetVisible(true)
  created[#created + 1] = c
  return c
end

local function asset(kind)
  if kind == "rect" then return RECT end
  if kind == "tri" then return TRI end
  return CIRCLE
end

local function draw(name, ox, oy, side, isWhite)
  local shapes = PIECE_SHAPES[name]
  local fill = isWhite and C.white or C.black
  local outl = isWhite and C.outlineW or C.outlineB
  local half = side / 2
  for _, s in ipairs(shapes) do
    local dx = s[2] * side - half
    local dy = s[3] * side - half
    mk(asset(s[1]), ox + half + dx * GROW, oy + half + dy * GROW,
       s[4] * side * GROW, s[5] * side * GROW, s[6], outl)
  end
  for _, s in ipairs(shapes) do
    mk(asset(s[1]), ox + s[2] * side, oy + s[3] * side,
       s[4] * side, s[5] * side, s[6], fill)
  end
end

-- 真实棋局：格宽按游戏脚本算（画布高 900 * 0.78 / 8 = 87.75）
function OnStart()
  mk(RECT, 800, 450, 1600, 900, 0, C.bg)
  local side = 900 * 0.78
  local cell = side / 8
  local bLeft = (1600 - side) / 2
  local bBottom = (900 - side) / 2
  for sq = 0, 63 do
    local f, r = sq % 8, sq // 8
    local dark = ((r + f) % 2 == 0)
    mk(RECT, bLeft + f * cell + cell / 2, bBottom + r * cell + cell / 2,
       cell, cell, 0, dark and C.sqDark or C.sqLight)
  end
  -- 开局 32 枚：1-2 黑，7-8 白
  local backRank = { "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook" }
  for f = 0, 7 do
    draw(backRank[f + 1], bLeft + f * cell, bBottom + 0 * cell, cell, false)
    draw("pawn",             bLeft + f * cell, bBottom + 1 * cell, cell, false)
    draw(backRank[f + 1], bLeft + f * cell, bBottom + 7 * cell, cell, true)
    draw("pawn",             bLeft + f * cell, bBottom + 6 * cell, cell, true)
  end
  print("GAMEPROBE done, controls=" .. tostring(#created))
end

function OnDestroy()
  for i = #created, 1, -1 do pcall(function() game.DestroyClientUIControl(created[i]) end) end
  created = {}
end
