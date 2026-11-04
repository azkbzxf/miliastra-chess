-- =============================================================================
--  sim/pieces_probe.lua · 棋子图元拟合试验台 v2（不属于交付物）
--  用千星三种基础图元（100001 矩形 / 100002 圆 / 100003 三角）拟合
--  en-croissant(cburnett) 风格棋子，在模拟器里真实渲染后目视校准。
--  坐标系：局部 0..1，左下原点、Y 向上。
--  v2 修正：马、象的轮廓（v1 的马像纸飞机、象太尖）
-- =============================================================================

local IMAGE_PREFAB_ID = 1073742107
local RECT, CIRCLE, TRI = 100001, 100002, 100003

-- {kind, cx, cy, w, h, rot}
local SHAPES = {
  -- 兵：宽底座 + 梯形身（矩形+三角）+ 颈环 + 球头
  pawn = {
    { "rect",   0.50, 0.100, 0.54, 0.140, 0 },
    { "rect",   0.50, 0.230, 0.42, 0.120, 0 },
    { "tri",    0.50, 0.410, 0.40, 0.330, 0 },
    { "rect",   0.50, 0.575, 0.155, 0.085, 0 },
    { "circle", 0.50, 0.735, 0.235, 0.235, 0 },
  },
  -- 车：宽底座 + 颈 + 身 + 颈环 + 冠带 + 三个垛口
  rook = {
    { "rect", 0.50, 0.105, 0.60, 0.17, 0 },
    { "rect", 0.50, 0.245, 0.44, 0.13, 0 },
    { "rect", 0.50, 0.430, 0.36, 0.25, 0 },
    { "rect", 0.50, 0.600, 0.44, 0.090, 0 },
    { "rect", 0.50, 0.700, 0.56, 0.110, 0 },
    { "rect", 0.285, 0.830, 0.120, 0.150, 0 },
    { "rect", 0.500, 0.830, 0.120, 0.150, 0 },
    { "rect", 0.715, 0.830, 0.120, 0.150, 0 },
  },
  -- 马：cburnett 马头剪影 = 底座 + 粗颈 + 斜脸 + 口鼻 + 耳
  knight = {
    { "rect",   0.50,  0.100, 0.60, 0.150, 0 },
    { "rect",   0.50,  0.225, 0.46, 0.110, 0 },
    { "rect",   0.560, 0.450, 0.30, 0.44, 8 },
    { "rect",   0.400, 0.670, 0.36, 0.24, 40 },
    { "tri",    0.230, 0.625, 0.26, 0.19, 90 },
    { "circle", 0.545, 0.810, 0.22, 0.22, 0 },
    { "tri",    0.640, 0.885, 0.12, 0.15, -10 },
  },
  -- 象：对照 BB.png 实拍 —— 宽底座 + 扁身 + 颈环 + **圆球主教帽（主体是圆，不是三角）** + 顶球
  bishop = {
    { "rect",   0.50, 0.075, 0.60, 0.110, 0 },
    { "circle", 0.50, 0.205, 0.46, 0.190, 0 },
    { "rect",   0.50, 0.300, 0.30, 0.070, 0 },
    { "circle", 0.50, 0.480, 0.26, 0.240, 0 },
    -- 主教帽：大圆球（实拍里就是圆，占上部 40% 高度）
    { "circle", 0.50, 0.680, 0.52, 0.440, 0 },
    -- 顶球
    { "circle", 0.50, 0.930, 0.135, 0.135, 0 },
  },
  -- 后：对照 QB.png 实拍 —— 五尖冠（每尖 = 细三角 + 顶端圆球），下接数层裙环
  queen = {
    { "rect",   0.50, 0.070, 0.62, 0.110, 0 },
    { "circle", 0.50, 0.200, 0.50, 0.190, 0 },
    { "rect",   0.50, 0.300, 0.36, 0.070, 0 },
    { "circle", 0.50, 0.410, 0.34, 0.190, 0 },
    -- 冠体底
    { "rect",   0.50, 0.500, 0.44, 0.090, 0 },
    -- 五根冠尖（细长三角，向外张开）
    { "tri",    0.190, 0.650, 0.110, 0.260, -26 },
    { "tri",    0.345, 0.700, 0.110, 0.300, -13 },
    { "tri",    0.500, 0.720, 0.110, 0.320, 0 },
    { "tri",    0.655, 0.700, 0.110, 0.300, 13 },
    { "tri",    0.810, 0.650, 0.110, 0.260, 26 },
    -- 五个顶端圆球
    { "circle", 0.135, 0.795, 0.150, 0.150, 0 },
    { "circle", 0.315, 0.855, 0.150, 0.150, 0 },
    { "circle", 0.500, 0.885, 0.155, 0.155, 0 },
    { "circle", 0.685, 0.855, 0.150, 0.150, 0 },
    { "circle", 0.865, 0.795, 0.150, 0.150, 0 },
  },
  -- 王：宽底座 + 梯形身 + 颈环 + 冠带 + 冠身 + 十字
  king = {
    { "rect", 0.50, 0.105, 0.62, 0.170, 0 },
    { "tri",  0.50, 0.320, 0.48, 0.400, 0 },
    { "rect", 0.50, 0.575, 0.260, 0.095, 0 },
    { "rect", 0.50, 0.680, 0.480, 0.120, 0 },
    { "circle", 0.50, 0.770, 0.230, 0.230, 0 },
    { "rect", 0.50, 0.885, 0.085, 0.190, 0 },
    { "rect", 0.50, 0.928, 0.215, 0.075, 0 },
  },
}

local ORDER = { "pawn", "rook", "knight", "bishop", "queen", "king" }

local COLOR = {
  white   = { 252, 252, 250, 255 },
  black   = { 26,  24,  22,  255 },
  outline = { 16,  14,  12,  255 },
  board_light = { 238, 228, 208, 255 },
  board_dark  = { 106, 130, 150, 255 },
  bg = { 18, 22, 30, 255 },
}

local created = {}
local function col(c) return Color.FromRGBA(c[1], c[2], c[3], c[4]) end

local function mk(kind, x, y, w, h, rot, color)
  local c = game.InstantiateClientUIControl(IMAGE_PREFAB_ID, script.object)
  if c == nil then return nil end
  c:SetPivot(0.5, 0.5)
  c:SetAnchorMin(0, 0)
  c:SetAnchorMax(0, 0)
  c:SetSizeDelta(w, h)
  c:SetAnchoredPosition(x, y)
  local asset = (kind == "rect") and RECT or ((kind == "circle") and CIRCLE or TRI)
  pcall(function() c:SetImage(Enum.ImageSource.StaticReference, asset) end)
  local it = Enum.ImageType and Enum.ImageType.Stretch
  if it ~= nil then pcall(function() c.imageType = it end) end
  c.imageColor = col(color)
  if rot ~= 0 then c:SetLocalRotation(0, 0, rot) end
  c:SetActive(true)
  c:SetVisible(true)
  created[#created + 1] = c
  return c
end

local function draw_piece(name, ox, oy, side, pieceColor, outlineW)
  local shapes = SHAPES[name]
  if shapes == nil then return end
  if outlineW and outlineW > 0 then
    for _, s in ipairs(shapes) do
      mk(s[1], ox + s[2] * side, oy + s[3] * side,
         s[4] * side * outlineW, s[5] * side * outlineW, s[6], COLOR.outline)
    end
  end
  for _, s in ipairs(shapes) do
    mk(s[1], ox + s[2] * side, oy + s[3] * side,
       s[4] * side, s[5] * side, s[6], pieceColor)
  end
end

function OnStart()
  print("PIECES v2 start, prefab=" .. tostring(IMAGE_PREFAB_ID))
  mk("rect", 800, 450, 1600, 900, 0, COLOR.bg)
  local cell = 200
  local y0 = 250
  for i = 0, 5 do
    mk("rect", 200 + i * cell, y0, cell - 8, cell * 2.1, 0,
       (i % 2 == 0) and COLOR.board_light or COLOR.board_dark)
  end
  for i, name in ipairs(ORDER) do
    local cx = 200 + (i - 1) * cell
    draw_piece(name, cx - 90, 330, 180, COLOR.white, 1.16)
    draw_piece(name, cx - 90, 120, 180, COLOR.black, 1.16)
  end
  print("PIECES v2 controls=" .. tostring(#created))
end

function OnDestroy()
  for i = #created, 1, -1 do
    pcall(function() game.DestroyClientUIControl(created[i]) end)
  end
  created = {}
end
