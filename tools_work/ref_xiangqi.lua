-- ============================================================================
-- 中国象棋 xiangqi.lua（千星奇域 / 千星沙箱 · Lua 5.3 客户端 UI 脚本）
-- 5 级难度 · 主菜单 · 圆角按钮 · 跳字提醒 · 棋盘翻转 · 悔棋/重开
-- 迭代加深 + Alpha-Beta + 静态搜索 + 将军扩展 + 循环判和 + 杀型识别
-- ★ 节点预算硬限制 + AI 搜索内重复判和
-- ============================================================================

-- ============================================================================
-- §0 编辑器搭设参数
-- ============================================================================
CONTROL_PREFAB_TILE = 1073741850
CONTROL_PREFAB_HUD  = 1073741853
ASSET_SQUARE = 100001
ASSET_CIRCLE = 100002
ASSET_ROUNDED_RECT = 106011
CONTROL_PREFAB_TOUCH_AREA = 1073741855

-- ============================================================================
-- §1 常量与配置
-- ============================================================================
CELL_FILES = 9
CELL_RANKS = 10

MOVE_DUR    = 0.24
AI_MOVE_DUR = 0.55
CAPTURE_DUR = 0.24
AI_DELAY    = 0.30

AI_DEPTH_MAX  = 3
NODE_LIMIT    = 1500
QUIESCE_MAX   = 3
QUIESCE_PLY_MAX = 48
REP_WINDOW    = 16

DIFFICULTY_CFG = {
    [1] = { name = "入门", depth = 1, nodes = 400,  qmax = 0 },
    [2] = { name = "简单", depth = 2, nodes = 800,  qmax = 1 },
    [3] = { name = "普通", depth = 3, nodes = 1500, qmax = 2 },
    [4] = { name = "困难", depth = 3, nodes = 3000, qmax = 3 },
    [5] = { name = "大师", depth = 4, nodes = 6000, qmax = 4 },
}

COLOR_PAGE_BG    = { r = 42,  g = 38,  b = 34  }
COLOR_BOARD_BG   = { r = 194, g = 160, b = 110 }
COLOR_LINE       = { r = 90,  g = 62,  b = 40  }
COLOR_RIVER      = { r = 90,  g = 62,  b = 40  }
COLOR_PIECE_BG   = { r = 242, g = 224, b = 190 }
COLOR_PIECE_BORDER = { r = 60, g = 40, b = 25 }
COLOR_PIECE_SEL  = { r = 130, g = 210, b = 110 }
COLOR_RED_TEXT   = { r = 178, g = 34,  b = 34  }
COLOR_BLACK_TEXT = { r = 30,  g = 30,  b = 36  }
COLOR_TITLE      = { r = 250, g = 240, b = 220 }
COLOR_STATUS_BG  = { r = 110, g = 85,  b = 60  }
COLOR_STATUS_TEXT= { r = 255, g = 245, b = 225 }
COLOR_HINT       = { r = 210, g = 200, b = 175 }
COLOR_HINT_DOT   = { r = 90,  g = 150, b = 80  }
COLOR_HINT_FRAME = { r = 200, g = 60,  b = 60  }
COLOR_CHECK      = { r = 255, g = 80,  b = 80  }
COLOR_MATE       = { r = 255, g = 215, b = 90  }

COLOR_MENU_BG      = { r = 42,  g = 38,  b = 34  }
COLOR_MENU_BTN     = { r = 90,  g = 70,  b = 50  }
COLOR_MENU_BTN_SEL = { r = 190, g = 66,  b = 42  }
COLOR_MENU_START   = { r = 60,  g = 120, b = 60  }
COLOR_MENU_TXT     = { r = 245, g = 235, b = 215 }
COLOR_UNDO_BTN     = { r = 80,  g = 100, b = 140 }
COLOR_RESTART_BTN  = { r = 140, g = 80,  b = 60  }

MATERIAL = { [1] = 100000, [2] = 200, [3] = 200, [4] = 450, [5] = 1000, [6] = 450, [7] = 100 }
PIECE_CHAR = {
    [0] = { [1] = "帅", [2] = "仕", [3] = "相", [4] = "马", [5] = "车", [6] = "炮", [7] = "兵" },
    [1] = { [1] = "将", [2] = "士", [3] = "象", [4] = "马", [5] = "车", [6] = "炮", [7] = "卒" },
}

PSQT_HORSE = {
    { 90, 90, 90, 96, 90, 96, 90, 90, 90 },
    { 90, 96, 103, 97, 94, 97, 103, 96, 90 },
    { 92, 98, 99, 103, 99, 103, 99, 98, 92 },
    { 93, 108, 100, 107, 100, 107, 100, 108, 93 },
    { 90, 100, 99, 103, 104, 103, 99, 100, 90 },
    { 90, 98, 101, 102, 103, 102, 101, 98, 90 },
    { 92, 94, 98, 95, 98, 95, 98, 94, 92 },
    { 93, 92, 94, 95, 92, 95, 94, 92, 93 },
    { 85, 90, 92, 93, 78, 93, 92, 90, 85 },
    { 88, 85, 90, 88, 90, 88, 90, 85, 88 },
}
PSQT_ROOK = {
    { 206, 208, 207, 213, 214, 213, 207, 208, 206 },
    { 206, 212, 209, 216, 233, 216, 209, 212, 206 },
    { 206, 208, 207, 214, 216, 214, 207, 208, 206 },
    { 206, 209, 212, 216, 221, 216, 212, 209, 206 },
    { 208, 211, 214, 219, 222, 219, 214, 211, 208 },
    { 208, 210, 211, 215, 219, 215, 211, 210, 208 },
    { 208, 209, 209, 213, 216, 213, 209, 209, 208 },
    { 208, 207, 207, 210, 214, 210, 207, 207, 208 },
    { 208, 206, 206, 208, 212, 208, 206, 206, 208 },
    { 206, 206, 206, 206, 210, 206, 206, 206, 206 },
}
PSQT_CANNON = {
    { 100, 100, 96, 91, 90, 91, 96, 100, 100 },
    { 98, 98, 96, 92, 89, 92, 96, 98, 98 },
    { 97, 97, 96, 91, 92, 91, 96, 97, 97 },
    { 96, 99, 99, 98, 100, 98, 99, 99, 96 },
    { 96, 96, 96, 96, 100, 96, 96, 96, 96 },
    { 95, 96, 99, 96, 100, 96, 99, 96, 95 },
    { 96, 96, 96, 96, 96, 96, 96, 96, 96 },
    { 97, 96, 100, 99, 101, 99, 100, 96, 97 },
    { 96, 96, 96, 96, 96, 96, 96, 96, 96 },
    { 96, 96, 99, 96, 96, 96, 99, 96, 96 },
}
PSQT_PAWN = {
    { 9, 9, 9, 11, 13, 11, 9, 9, 9 },
    { 19, 24, 34, 42, 44, 42, 34, 24, 19 },
    { 19, 24, 32, 37, 37, 37, 32, 24, 19 },
    { 19, 23, 27, 29, 30, 29, 27, 23, 19 },
    { 14, 18, 20, 27, 29, 27, 20, 18, 14 },
    { 7, 0, 13, 0, 16, 0, 13, 0, 7 },
    { 7, 0, 7, 0, 15, 0, 7, 0, 7 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
}
PSQT = { [4] = PSQT_HORSE, [5] = PSQT_ROOK, [6] = PSQT_CANNON, [7] = PSQT_PAWN }

DIRS_ORTHO    = { {1,0}, {-1,0}, {0,1}, {0,-1} }
DIRS_HORSE    = { {1,2},{1,-2},{-1,2},{-1,-2},{2,1},{2,-1},{-2,1},{-2,-1} }
DIRS_ELEPHANT = { {2,2},{2,-2},{-2,2},{-2,-2} }
DIRS_ADVISOR  = { {1,1},{1,-1},{-1,1},{-1,-1} }

INIT_LAYOUT = {
    { 0, 9, 5 }, { 1, 9, 4 }, { 2, 9, 3 }, { 3, 9, 2 }, { 4, 9, 1 },
    { 5, 9, 2 }, { 6, 9, 3 }, { 7, 9, 4 }, { 8, 9, 5 },
    { 1, 7, 6 }, { 7, 7, 6 },
    { 0, 6, 7 }, { 2, 6, 7 }, { 4, 6, 7 }, { 6, 6, 7 }, { 8, 6, 7 },
    { 0, 0, 5 }, { 1, 0, 4 }, { 2, 0, 3 }, { 3, 0, 2 }, { 4, 0, 1 },
    { 5, 0, 2 }, { 6, 0, 3 }, { 7, 0, 4 }, { 8, 0, 5 },
    { 1, 2, 6 }, { 7, 2, 6 },
    { 0, 3, 7 }, { 2, 3, 7 }, { 4, 3, 7 }, { 6, 3, 7 }, { 8, 3, 7 },
}

-- ============================================================================
-- §2 运行时状态
-- ============================================================================
layout = { w = 0, h = 0, cell = 0 }
grid = {}
pieces = {}
selected = nil
turn = 0
busy = false
gameOver = false
aiPending = false
aiDelay = 0
tapClock = 0
lastTapAt = -10
tapCtrl = nil
activeAnims = {}
killedAnims = setmetatable({}, { __mode = "k" })
statusCtrl = nil
titleCtrl = nil
hintCtrl = nil
keyHandlers = {}
hintDots = {}
toastList = {}

menuVisible = false
menuControls = {}
menuButtons = {}
menuSideBtns = {}
menuDiffBtns = {}
playerSide = 0
aiSide = 1
difficulty = 3
boardFlipped = false

nodeCount = 0
searchAborted = false
killers = {}
history = {}
hash = 0
gameHistory = {}
positionCounts = {}   -- ★ hash → 出现次数（用于搜索内判和）
moveStack = {}        -- ★ 走法栈（用于悔棋）

-- ★ 游戏内按钮（悔棋 / 重开）
gameButtons = {}
gameBtnCtrls = {}

-- ============================================================================
-- §3 工具函数
-- ============================================================================
function Log(msg) print("[象棋] " .. tostring(msg)) end
function SetImageColor(ctrl, r, g, b)
    if ctrl == nil or not ctrl.alive then return end
    ctrl.imageColor = Color.FromRGBA(r, g, b, 255)
end
function CreateSafe(prefabIndex, parent)
    if prefabIndex == nil or parent == nil or not parent.alive then return nil end
    local ok, ctrl = pcall(function() return game.InstantiateClientUIControl(prefabIndex, parent) end)
    if not ok or ctrl == nil or not ctrl.alive then return nil end
    return ctrl
end

function PlayTweensParallel(tweens, onAllDone)
    local n = #tweens
    if n == 0 then
        if onAllDone ~= nil then onAllDone() end
        return
    end
    local pending = n
    local finished = false
    local normalFinished = 0
    local function onComplete(tw)
        for j = #activeAnims, 1, -1 do
            if activeAnims[j] == tw then
                table.remove(activeAnims, j)
                break
            end
        end
        pending = pending - 1
        if not killedAnims[tw] then
            normalFinished = normalFinished + 1
        end
        if pending <= 0 and not finished then
            finished = true
            if normalFinished == n and onAllDone ~= nil then
                onAllDone()
            end
        end
    end
    for i = 1, n do
        local tw = tweens[i]
        table.insert(activeAnims, tw)
        tw:SetOnComplete(function() onComplete(tw) end)
    end
    for i = 1, n do tweens[i]:Play() end
end

function KillAllAnims()
    for j = #activeAnims, 1, -1 do
        local tw = activeAnims[j]
        killedAnims[tw] = true
        pcall(function() tw:Kill(false) end)
    end
    activeAnims = {}
end

function RaiseTapCtrl()
    if tapCtrl ~= nil and tapCtrl.alive then
        pcall(function() tapCtrl:SetAsLastSibling() end)
    end
end

function ShowToast(text, fontSize, color, duration)
    ClearToasts()
    local parent = script.object
    if parent == nil or not parent.alive then return end
    local txt = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if txt == nil then return end
    txt:SetActive(true); txt:SetVisible(true)
    txt:SetSizeDelta(layout.w * 0.95, fontSize * 1.8)
    txt:SetAnchoredPosition(0, 0)
    txt.adaptiveFontSize = false
    txt.fontSize = fontSize
    txt.fontColor = Color.FromRGBA(color.r, color.g, color.b, 255)
    txt.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
    txt.verticalAlignment = Enum.TextVerticalAlignment.Middle
    txt.bgColor = Color.FromRGBA(0, 0, 0, 0)
    txt.text = text
    if txt.raycastTarget ~= nil then txt.raycastTarget = false end
    pcall(function() txt:SetLocalScale(0.2, 0.2, 1) end)
    table.insert(toastList, { ctrl = txt, t = 0, dur = duration or 1.4, maxScale = 1.0 })
    RaiseTapCtrl()
end

function UpdateToasts(dt)
    for i = #toastList, 1, -1 do
        local t = toastList[i]
        t.t = t.t + dt
        local ctrl = t.ctrl
        if ctrl == nil or not ctrl.alive then
            table.remove(toastList, i)
        else
            local s
            local maxS = t.maxScale or 1.0
            if t.t < 0.18 then
                s = 0.2 + (maxS * 1.15 - 0.2) * (t.t / 0.18)
            elseif t.t < 0.30 then
                s = maxS * 1.15 - (maxS * 0.15) * ((t.t - 0.18) / 0.12)
            elseif t.t > t.dur - 0.30 then
                local k = (t.t - (t.dur - 0.30)) / 0.30
                if k < 0 then k = 0 end
                if k > 1 then k = 1 end
                s = maxS * (1.0 - k)
                if s < 0.01 then s = 0.01 end
            else
                s = maxS
            end
            pcall(function() ctrl:SetLocalScale(s, s, 1) end)
            if t.t >= t.dur then
                pcall(function() game.DestroyClientUIControl(ctrl) end)
                table.remove(toastList, i)
            end
        end
    end
end

function ClearToasts()
    for _, t in ipairs(toastList) do
        if t.ctrl ~= nil and t.ctrl.alive then
            pcall(function() game.DestroyClientUIControl(t.ctrl) end)
        end
    end
    toastList = {}
end

-- ============================================================================
-- §4 布局与坐标
-- ============================================================================
function LayoutCanvas()
    local w, h = game.GetUICanvasSize()
    layout.w, layout.h = w, h
    local cell = math.floor(math.min(w * 0.94 / 8, h * 0.72 / 9))
    if cell < 14 then cell = 14 end
    layout.cell = cell
    Log(string.format("画布=%dx%d cell=%d", math.floor(w), math.floor(h), cell))
end
function BoardX(f)
    if boardFlipped then return (4 - f) * layout.cell end
    return (f - 4) * layout.cell
end
function BoardY(r)
    if boardFlipped then return (r - 4.5) * layout.cell end
    return (4.5 - r) * layout.cell
end
function InBoard(f, r) return f >= 0 and f <= 8 and r >= 0 and r <= 9 end
function InPalace(s, f, r)
    if f < 3 or f > 5 then return false end
    if s == 0 then return r >= 7 and r <= 9 end
    return r >= 0 and r <= 2
end

-- ============================================================================
-- §5 棋盘美工
-- ============================================================================
function CreateRect(cx, cy, w, h, rot, color, assetId)
    local parent = script.object
    if parent == nil or not parent.alive then return end
    local l = CreateSafe(CONTROL_PREFAB_TILE, parent)
    if l == nil then return end
    l:SetActive(true); l:SetVisible(true)
    l:SetSizeDelta(w, h); l:SetAnchoredPosition(cx, cy)
    l:SetImage(Enum.ImageSource.StaticReference, assetId or ASSET_SQUARE)
    l.imageType = Enum.ImageType.Stretch
    SetImageColor(l, color.r, color.g, color.b)
    if rot ~= 0 and rot ~= nil then
        pcall(function() l:SetLocalRotation(0, 0, rot) end)
    end
    return l
end

function CreateRoundRect(cx, cy, w, h, color)
    return CreateRect(cx, cy, w, h, 0, color, ASSET_ROUNDED_RECT)
end

function CreateCircleShapes(parent, cx, cy, diameter, cr, cg, cb, nSlices)
    local shapes = {}
    if parent == nil or not parent.alive then return shapes end
    if ASSET_CIRCLE ~= nil and ASSET_CIRCLE > 0 then
        local ctrl = CreateSafe(CONTROL_PREFAB_TILE, parent)
        if ctrl ~= nil then
            ctrl:SetActive(true); ctrl:SetVisible(true)
            ctrl:SetSizeDelta(diameter, diameter)
            ctrl:SetAnchoredPosition(cx, cy)
            ctrl:SetImage(Enum.ImageSource.StaticReference, ASSET_CIRCLE)
            ctrl.imageType = Enum.ImageType.Stretch
            SetImageColor(ctrl, cr, cg, cb)
            if ctrl.raycastTarget ~= nil then ctrl.raycastTarget = false end
            shapes[1] = ctrl
            return shapes
        end
    end
    local n = nSlices or 9
    local R = diameter * 0.5
    local h = diameter / n
    for i = 1, n do
        local yc = -R + (i - 0.5) * h
        local inside = R * R - yc * yc
        if inside < 0 then inside = 0 end
        local w = math.sqrt(inside) * 2
        if w < 1 then w = 1 end
        local ctrl = CreateSafe(CONTROL_PREFAB_TILE, parent)
        if ctrl ~= nil then
            ctrl:SetActive(true); ctrl:SetVisible(true)
            ctrl:SetSizeDelta(w, h + 1)
            ctrl:SetAnchoredPosition(cx, cy + yc)
            ctrl:SetImage(Enum.ImageSource.StaticReference, ASSET_SQUARE)
            ctrl.imageType = Enum.ImageType.Stretch
            SetImageColor(ctrl, cr, cg, cb)
            if ctrl.raycastTarget ~= nil then ctrl.raycastTarget = false end
            shapes[#shapes + 1] = ctrl
        end
    end
    return shapes
end

-- ★ 创建游戏内按钮（悔棋 / 重开），只调一次
function CreateGameButtons()
    local parent = script.object
    if parent == nil or not parent.alive then return end
    local c = layout.cell
    local w = c * 2.1
    local h = c * 0.85    
    local y1 = c * 2.0    -- 悔棋 y
    local y2 = c * 0.3    -- 重开 y

    -- 悔棋    
    local bg1 = CreateRoundRect(c * 5.5, y1, w, h, COLOR_UNDO_BTN)
    if bg1 ~= nil then
        if bg1.raycastTarget ~= nil then bg1.raycastTarget = false end
        gameBtnCtrls[#gameBtnCtrls + 1] = bg1
    end
    local txt1 = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if txt1 ~= nil then
        txt1:SetActive(true); txt1:SetVisible(true)        
        txt1:SetSizeDelta(w, h); txt1:SetAnchoredPosition(c * 5.5, y1)
        txt1.adaptiveFontSize = false
        txt1.fontSize = math.floor(h * 0.5)
        txt1.fontColor = Color.FromRGBA(COLOR_MENU_TXT.r, COLOR_MENU_TXT.g, COLOR_MENU_TXT.b, 255)
        txt1.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
        txt1.verticalAlignment = Enum.TextVerticalAlignment.Middle
        txt1.bgColor = Color.FromRGBA(0, 0, 0, 0)
        txt1.text = "悔 棋"
        if txt1.raycastTarget ~= nil then txt1.raycastTarget = false end
        gameBtnCtrls[#gameBtnCtrls + 1] = txt1
    end
    gameButtons[#gameButtons + 1] = {
        cx = c * 5.5, cy = y1, w = w, h = h, onClick = UndoHumanMove,
    }

    -- 重开
    local bg2 = CreateRoundRect(c * 5.5, y2, w, h, COLOR_RESTART_BTN)
    if bg2 ~= nil then
        if bg2.raycastTarget ~= nil then bg2.raycastTarget = false end
        gameBtnCtrls[#gameBtnCtrls + 1] = bg2
    end
    local txt2 = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if txt2 ~= nil then
        txt2:SetActive(true); txt2:SetVisible(true)
        txt2:SetSizeDelta(w, h); txt2:SetAnchoredPosition(c * 5.5, y2)
        txt2.adaptiveFontSize = false
        txt2.fontSize = math.floor(h * 0.5)
        txt2.fontColor = Color.FromRGBA(COLOR_MENU_TXT.r, COLOR_MENU_TXT.g, COLOR_MENU_TXT.b, 255)
        txt2.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
        txt2.verticalAlignment = Enum.TextVerticalAlignment.Middle
        txt2.bgColor = Color.FromRGBA(0, 0, 0, 0)
        txt2.text = "重 开"
        if txt2.raycastTarget ~= nil then txt2.raycastTarget = false end
        gameBtnCtrls[#gameBtnCtrls + 1] = txt2
    end
    gameButtons[#gameButtons + 1] = {
        cx = c * 5.5, cy = y2, w = w, h = h, onClick = RestartGame,
    }
end

function CreateBoardGraphics()
    local parent = script.object
    if parent == nil or not parent.alive then return end
    local c = layout.cell
    local t = math.max(2, math.floor(c * 0.07))
    CreateRect(0, 0, layout.w * 2 + 200, layout.h * 2 + 200, 0, COLOR_PAGE_BG)
    CreateRect(0, 0, c * 8 + c * 0.9, c * 9 + c * 0.9, 0, COLOR_BOARD_BG)
    for r = 0, 9 do CreateRect(0, BoardY(r), c * 8, t, 0, COLOR_LINE) end
    for f = 0, 8 do
        if f == 0 or f == 8 then
            CreateRect(BoardX(f), 0, t, c * 9, 0, COLOR_LINE)
        else
            CreateRect(BoardX(f), c * 2.5, t, c * 4, 0, COLOR_LINE)
            CreateRect(BoardX(f), -c * 2.5, t, c * 4, 0, COLOR_LINE)
        end
    end
    local dlen = c * 2 * 1.4142
    CreateRect(0, c * 3.5, dlen, t, 45, COLOR_LINE)
    CreateRect(0, c * 3.5, dlen, t, -45, COLOR_LINE)
    CreateRect(0, -c * 3.5, dlen, t, -45, COLOR_LINE)
    CreateRect(0, -c * 3.5, dlen, t, 45, COLOR_LINE)
    local river = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if river ~= nil then
        river:SetActive(true); river:SetVisible(true)
        river:SetSizeDelta(c * 3, c * 0.8); river:SetAnchoredPosition(-c * 2, c * 0.2)
        river.adaptiveFontSize = false; river.fontSize = math.floor(c * 0.5)
        river.fontColor = Color.FromRGBA(COLOR_RIVER.r, COLOR_RIVER.g, COLOR_RIVER.b, 255)
        river.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
        river.verticalAlignment = Enum.TextVerticalAlignment.Middle
        river.bgColor = Color.FromRGBA(0, 0, 0, 0); river.text = "楚河"
    end
    local river2 = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if river2 ~= nil then
        river2:SetActive(true); river2:SetVisible(true)
        river2:SetSizeDelta(c * 3, c * 0.8); river2:SetAnchoredPosition(c * 2, c * 0.2)
        river2.adaptiveFontSize = false; river2.fontSize = math.floor(c * 0.5)
        river2.fontColor = Color.FromRGBA(COLOR_RIVER.r, COLOR_RIVER.g, COLOR_RIVER.b, 255)
        river2.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
        river2.verticalAlignment = Enum.TextVerticalAlignment.Middle
        river2.bgColor = Color.FromRGBA(0, 0, 0, 0); river2.text = "汉界"
    end
    local title = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if title ~= nil then
        title:SetActive(true); title:SetVisible(true)
        title:SetSizeDelta(c * 8, c * 1.0); title:SetAnchoredPosition(0, c * 5.3)
        title.adaptiveFontSize = false; title.fontSize = math.floor(c * 0.75)
        title.fontColor = Color.FromRGBA(COLOR_TITLE.r, COLOR_TITLE.g, COLOR_TITLE.b, 255)
        title.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
        title.verticalAlignment = Enum.TextVerticalAlignment.Middle
        title.bgColor = Color.FromRGBA(0, 0, 0, 0); title.text = "中国象棋"
        titleCtrl = title
    end
    local sbg = CreateSafe(CONTROL_PREFAB_TILE, parent)
    if sbg ~= nil then
        sbg:SetActive(true); sbg:SetVisible(true)
        sbg:SetSizeDelta(c * 8, c * 0.95); sbg:SetAnchoredPosition(0, -c * 5.3)
        sbg:SetImage(Enum.ImageSource.StaticReference, ASSET_SQUARE)
        sbg.imageType = Enum.ImageType.Stretch
        SetImageColor(sbg, COLOR_STATUS_BG.r, COLOR_STATUS_BG.g, COLOR_STATUS_BG.b)
    end
    local st = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if st ~= nil then
        st:SetActive(true); st:SetVisible(true)
        st:SetSizeDelta(c * 8, c * 0.95); st:SetAnchoredPosition(0, -c * 5.3)
        st.adaptiveFontSize = false; st.fontSize = math.floor(c * 0.42)
        st.fontColor = Color.FromRGBA(COLOR_STATUS_TEXT.r, COLOR_STATUS_TEXT.g, COLOR_STATUS_TEXT.b, 255)
        st.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
        st.verticalAlignment = Enum.TextVerticalAlignment.Middle
        st.bgColor = Color.FromRGBA(0, 0, 0, 0); st.text = "对局开始"
        statusCtrl = st
    end
    local hint = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if hint ~= nil then
        hint:SetActive(true); hint:SetVisible(true)
        hint:SetSizeDelta(c * 8, c * 0.7); hint:SetAnchoredPosition(0, -c * 6.2)
        hint.adaptiveFontSize = false; hint.fontSize = math.floor(c * 0.3)
        hint.fontColor = Color.FromRGBA(COLOR_HINT.r, COLOR_HINT.g, COLOR_HINT.b, 255)
        hint.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
        hint.verticalAlignment = Enum.TextVerticalAlignment.Middle
        hint.bgColor = Color.FromRGBA(0, 0, 0, 0)
        hint.text = "点击/触摸选子走子    P 返回菜单"
        hintCtrl = hint
    end

    -- ★ 顶部按钮
    CreateGameButtons()
end

-- ============================================================================
-- §6 棋子管理
-- ============================================================================
function CreatePieceCtrl(p)
    local parent = script.object
    if parent == nil or not parent.alive then return end
    local c = layout.cell
    local x, y = BoardX(p.f), BoardY(p.r)
    local D = c * 0.82
    local border = c * 0.06
    local innerD = D - border * 2
    local outerShapes = CreateCircleShapes(parent, x, y, D,
        COLOR_PIECE_BORDER.r, COLOR_PIECE_BORDER.g, COLOR_PIECE_BORDER.b)
    local innerShapes = CreateCircleShapes(parent, x, y, innerD,
        COLOR_PIECE_BG.r, COLOR_PIECE_BG.g, COLOR_PIECE_BG.b)
    local allShapes = {}
    for _, s in ipairs(outerShapes) do allShapes[#allShapes + 1] = s end
    for _, s in ipairs(innerShapes) do allShapes[#allShapes + 1] = s end
    if #allShapes == 0 then return end
    local txt = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if txt == nil then
        for _, s in ipairs(allShapes) do
            if s.alive then pcall(function() game.DestroyClientUIControl(s) end) end
        end
        return
    end
    txt:SetActive(true); txt:SetVisible(true)
    txt:SetSizeDelta(innerD, innerD); txt:SetAnchoredPosition(x, y)
    txt.adaptiveFontSize = true
    txt.fontSize = math.floor(c * 0.52)
    txt.minimumFontSize = 10
    txt.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
    txt.verticalAlignment = Enum.TextVerticalAlignment.Middle
    txt.bgColor = Color.FromRGBA(0, 0, 0, 0)
    txt.text = PIECE_CHAR[p.s][p.t]
    if p.s == 0 then
        txt.fontColor = Color.FromRGBA(COLOR_RED_TEXT.r, COLOR_RED_TEXT.g, COLOR_RED_TEXT.b, 255)
    else
        txt.fontColor = Color.FromRGBA(COLOR_BLACK_TEXT.r, COLOR_BLACK_TEXT.g, COLOR_BLACK_TEXT.b, 255)
    end
    if txt.raycastTarget ~= nil then txt.raycastTarget = false end
    p.ctrl = { outerShapes = outerShapes, innerShapes = innerShapes, shapes = allShapes, txt = txt }
    table.insert(pieces, p)
end

function DestroyPieceCtrl(p)
    if p == nil or p.ctrl == nil then return end
    if p.ctrl.shapes ~= nil then
        for _, s in ipairs(p.ctrl.shapes) do
            if s ~= nil and s.alive then pcall(function() game.DestroyClientUIControl(s) end) end
        end
    end
    if p.ctrl.txt ~= nil and p.ctrl.txt.alive then
        pcall(function() game.DestroyClientUIControl(p.ctrl.txt) end)
    end
    p.ctrl = nil
end

function HighlightPiece(p, on)
    if p == nil or p.ctrl == nil then return end
    local cr, cg, cb
    if on then
        cr, cg, cb = COLOR_PIECE_SEL.r, COLOR_PIECE_SEL.g, COLOR_PIECE_SEL.b
    else
        cr, cg, cb = COLOR_PIECE_BG.r, COLOR_PIECE_BG.g, COLOR_PIECE_BG.b
    end
    local target = p.ctrl.innerShapes or p.ctrl.shapes or {}
    for _, s in ipairs(target) do SetImageColor(s, cr, cg, cb) end
end

-- ★ 重建棋盘控件（悔棋用）
function RebuildBoard()
    for _, p in ipairs(pieces) do DestroyPieceCtrl(p) end
    pieces = {}
    for f = 0, 8 do
        for r = 0, 9 do
            local p = grid[f][r]
            if p ~= nil then CreatePieceCtrl(p) end
        end
    end
    RaiseTapCtrl()
end

-- ============================================================================
-- §6.5 落点提示
-- ============================================================================
function ClearHintDots()
    for _, d in ipairs(hintDots) do
        if d ~= nil and d.alive then pcall(function() game.DestroyClientUIControl(d) end) end
    end
    hintDots = {}
end
function ShowHintDots(p)
    ClearHintDots()
    if p == nil then return end
    local parent = script.object
    if parent == nil or not parent.alive then return end
    local c = layout.cell
    local moves = GenMoves(grid, playerSide)
    for _, mv in ipairs(moves) do
        if mv.piece == p then
            local cx, cy = BoardX(mv.nf), BoardY(mv.nr)
            local target = grid[mv.nf][mv.nr]
            if target == nil then
                local dots = CreateCircleShapes(parent, cx, cy, c * 0.30,
                    COLOR_HINT_DOT.r, COLOR_HINT_DOT.g, COLOR_HINT_DOT.b, 5)
                for _, d in ipairs(dots) do hintDots[#hintDots + 1] = d end
            else
                local B = c * 0.92
                local T = math.max(2, math.floor(c * 0.07))
                local parts = {
                    { 0,  B * 0.5, B, T },
                    { 0, -B * 0.5, B, T },
                    { -B * 0.5, 0, T, B },
                    {  B * 0.5, 0, T, B },
                }
                for _, pp in ipairs(parts) do
                    local d = CreateSafe(CONTROL_PREFAB_TILE, parent)
                    if d ~= nil then
                        d:SetActive(true); d:SetVisible(true)
                        d:SetSizeDelta(pp[3], pp[4])
                        d:SetAnchoredPosition(cx + pp[1], cy + pp[2])
                        d:SetImage(Enum.ImageSource.StaticReference, ASSET_SQUARE)
                        d.imageType = Enum.ImageType.Stretch
                        SetImageColor(d, COLOR_HINT_FRAME.r, COLOR_HINT_FRAME.g, COLOR_HINT_FRAME.b)
                        if d.raycastTarget ~= nil then d.raycastTarget = false end
                        hintDots[#hintDots + 1] = d
                    end
                end
            end
        end
    end
    RaiseTapCtrl()
end

-- ============================================================================
-- §6.6 主菜单
-- ============================================================================
function CreateMenuText(cx, cy, w, h, text, fontSize, color)
    local parent = script.object
    local ctrl = CreateSafe(CONTROL_PREFAB_HUD, parent)
    if ctrl == nil then return nil end
    ctrl:SetActive(true); ctrl:SetVisible(true)
    ctrl:SetSizeDelta(w, h); ctrl:SetAnchoredPosition(cx, cy)
    ctrl.adaptiveFontSize = false
    ctrl.fontSize = fontSize
    ctrl.fontColor = Color.FromRGBA(color.r, color.g, color.b, 255)
    ctrl.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
    ctrl.verticalAlignment = Enum.TextVerticalAlignment.Middle
    ctrl.bgColor = Color.FromRGBA(0, 0, 0, 0)
    ctrl.text = text
    if ctrl.raycastTarget ~= nil then ctrl.raycastTarget = false end
    table.insert(menuControls, ctrl)
    return ctrl
end

function CreateMenuButton(cx, cy, w, h, text, onClick, color)
    local col = color or COLOR_MENU_BTN
    local bg = CreateRoundRect(cx, cy, w, h, col)
    if bg ~= nil then
        if bg.raycastTarget ~= nil then bg.raycastTarget = false end
        table.insert(menuControls, bg)
    end
    local fontSize = math.floor(h * 0.44)
    local txt = CreateMenuText(cx, cy, w, h, text, fontSize, COLOR_MENU_TXT)
    local btn = { cx = cx, cy = cy, w = w, h = h, onClick = onClick, bg = bg, txt = txt, baseColor = col }
    table.insert(menuButtons, btn)
    return btn
end
function SetBtnSelected(btn, sel)
    if btn == nil or btn.bg == nil or not btn.bg.alive then return end
    if sel then
        SetImageColor(btn.bg, COLOR_MENU_BTN_SEL.r, COLOR_MENU_BTN_SEL.g, COLOR_MENU_BTN_SEL.b)
    else
        local bc = btn.baseColor or COLOR_MENU_BTN
        SetImageColor(btn.bg, bc.r, bc.g, bc.b)
    end
end
function RefreshMenuSelection()
    for s = 0, 1 do
        if menuSideBtns[s] ~= nil then SetBtnSelected(menuSideBtns[s], playerSide == s) end
    end
    for i = 1, 5 do
        if menuDiffBtns[i] ~= nil then SetBtnSelected(menuDiffBtns[i], difficulty == i) end
    end
end
function DestroyMenu()
    for _, ctrl in ipairs(menuControls) do
        if ctrl ~= nil and ctrl.alive then
            pcall(function() game.DestroyClientUIControl(ctrl) end)
        end
    end
    menuControls = {}
    menuButtons = {}
    menuSideBtns = {}
    menuDiffBtns = {}
    menuVisible = false
end

function ShowMenu()
    DestroyMenu()
    ClearToasts()
    menuVisible = true
    local parent = script.object
    if parent == nil or not parent.alive then return end
    local c = layout.cell
    local W, H = layout.w, layout.h
    local overlay = CreateRect(0, 0, W * 2 + 200, H * 2 + 200, 0, COLOR_MENU_BG)
    if overlay ~= nil then
        if overlay.raycastTarget ~= nil then overlay.raycastTarget = false end
        table.insert(menuControls, overlay)
    end
    CreateMenuText(0, c * 4.0, c * 8, c * 1.5, "中国象棋",
        math.floor(c * 1.15), COLOR_TITLE)
    CreateMenuText(0, c * 2.1, c * 8, c * 0.8, "选择先手",
        math.floor(c * 0.55), COLOR_HINT)
    local sW, sH = c * 2.3, c * 1.0
    menuSideBtns = {}
    menuSideBtns[0] = CreateMenuButton(-c * 1.25, c * 1.1, sW, sH, "红方先手",
        function() playerSide = 0; RefreshMenuSelection() end)
    menuSideBtns[1] = CreateMenuButton( c * 1.25, c * 1.1, sW, sH, "黑方后手",
        function() playerSide = 1; RefreshMenuSelection() end)
    CreateMenuText(0, -c * 0.3, c * 8, c * 0.8, "AI 强度",
        math.floor(c * 0.55), COLOR_HINT)
    local dW, dH = c * 1.30, c * 1.0
    local step   = c * 1.65
    local names  = { "入门", "简单", "普通", "困难", "大师" }
    menuDiffBtns = {}
    for i = 1, 5 do
        local cx = (i - 3) * step
        local idx = i
        menuDiffBtns[i] = CreateMenuButton(cx, -c * 1.4, dW, dH, names[i],
            function() difficulty = idx; RefreshMenuSelection() end)
    end
    CreateMenuButton(0, -c * 3.4, c * 5, c * 1.2, "开 始 对 局",
        function() StartFromMenu() end, COLOR_MENU_START)
    RefreshMenuSelection()
    RaiseTapCtrl()
end
function ApplyDifficulty()
    local cfg = DIFFICULTY_CFG[difficulty] or DIFFICULTY_CFG[3]
    AI_DEPTH_MAX  = cfg.depth
    NODE_LIMIT    = cfg.nodes
    QUIESCE_MAX   = cfg.qmax
    Log(string.format("难度=%s depth=%d nodes=%d qmax=%d",
        cfg.name, cfg.depth, cfg.nodes, cfg.qmax))
end
function StartFromMenu()
    ApplyDifficulty()
    DestroyMenu()
    NewGame(playerSide)
end

-- ★ 重开：直接开新局
function RestartGame()
    if menuVisible then return end
    Log("重开")
    NewGame(playerSide)
end

-- ★ 悔棋：撤销玩家上一步及其之后所有着法
function UndoHumanMove()
    if menuVisible then return end
    if #moveStack == 0 then return end

    -- 找到最近的玩家着法
    local idx = nil
    for i = #moveStack, 1, -1 do
        if moveStack[i].moverSide == playerSide then
            idx = i
            break
        end
    end
    if idx == nil then
        Log("悔棋：无玩家着法可撤")
        return
    end

    -- ★ 硬停止动画和 AI 思考
    KillAllAnims()
    aiPending = false
    busy = false
    ClearHintDots()
    ClearToasts()
    selected = nil

    -- ★ 从尾部向 idx 撤销
    for i = #moveStack, idx, -1 do
        local e = moveStack[i]
        if e.hashAfter ~= nil then
            local cnt = (positionCounts[e.hashAfter] or 0) - 1
            if cnt < 0 then cnt = 0 end
            positionCounts[e.hashAfter] = cnt
        end
        UndoMove(grid, e.mv, e.cap)
        if #gameHistory > 0 then table.remove(gameHistory) end
        table.remove(moveStack)
    end

    -- ★ 重建棋盘控件
    RebuildBoard()

    -- ★ 状态复位
    turn = playerSide
    gameOver = false
    RefreshStatus(InCheck(grid, playerSide))
    RaiseTapCtrl()
    Log(string.format("悔棋完成，剩余 %d 步", #moveStack))
end

-- ============================================================================
-- §7 走法生成与规则
-- ============================================================================
function GenPieceMoves(grid, p)
    local f, r, s, t = p.f, p.r, p.s, p.t
    local moves = {}
    local function add(nf, nr)
        if not InBoard(nf, nr) then return end
        local q = grid[nf][nr]
        if q == nil or q.s ~= s then
            moves[#moves + 1] = { nf = nf, nr = nr }
        end
    end
    if t == 5 then
        for _, d in ipairs(DIRS_ORTHO) do
            local nf, nr = f + d[1], r + d[2]
            while InBoard(nf, nr) do
                local q = grid[nf][nr]
                if q == nil then
                    moves[#moves + 1] = { nf = nf, nr = nr }
                else
                    if q.s ~= s then moves[#moves + 1] = { nf = nf, nr = nr } end
                    break
                end
                nf = nf + d[1]; nr = nr + d[2]
            end
        end
    elseif t == 4 then
        for _, d in ipairs(DIRS_HORSE) do
            local nf, nr = f + d[1], r + d[2]
            if InBoard(nf, nr) then
                local lf, lr
                if math.abs(d[1]) == 2 then lf, lr = f + d[1] / 2, r
                else lf, lr = f, r + d[2] / 2 end
                if grid[lf][lr] == nil then add(nf, nr) end
            end
        end
    elseif t == 6 then
        for _, d in ipairs(DIRS_ORTHO) do
            local nf, nr = f + d[1], r + d[2]
            local jumped = false
            while InBoard(nf, nr) do
                local q = grid[nf][nr]
                if not jumped then
                    if q == nil then moves[#moves + 1] = { nf = nf, nr = nr }
                    else jumped = true end
                else
                    if q ~= nil then
                        if q.s ~= s then moves[#moves + 1] = { nf = nf, nr = nr } end
                        break
                    end
                end
                nf = nf + d[1]; nr = nr + d[2]
            end
        end
    elseif t == 3 then
        for _, d in ipairs(DIRS_ELEPHANT) do
            local nf, nr = f + d[1], r + d[2]
            if InBoard(nf, nr) then
                if (s == 0 and nr >= 5) or (s == 1 and nr <= 4) then
                    if grid[f + d[1] / 2][r + d[2] / 2] == nil then add(nf, nr) end
                end
            end
        end
    elseif t == 2 then
        for _, d in ipairs(DIRS_ADVISOR) do
            local nf, nr = f + d[1], r + d[2]
            if InPalace(s, nf, nr) then add(nf, nr) end
        end
    elseif t == 1 then
        for _, d in ipairs(DIRS_ORTHO) do
            local nf, nr = f + d[1], r + d[2]
            if InPalace(s, nf, nr) then add(nf, nr) end
        end
    elseif t == 7 then
        local step = (s == 0) and -1 or 1
        add(f, r + step)
        if (s == 0 and r <= 4) or (s == 1 and r >= 5) then
            add(f + 1, r); add(f - 1, r)
        end
    end
    return moves
end

function FindKing(grid, s)
    local r0, r1 = 0, 2
    if s == 0 then r0, r1 = 7, 9 end
    for f = 3, 5 do
        for r = r0, r1 do
            local p = grid[f][r]
            if p ~= nil and p.t == 1 and p.s == s then return f, r end
        end
    end
    return -1, -1
end

function LineClear(grid, f1, r1, f2, r2)
    if f1 == f2 then
        local lo, hi = math.min(r1, r2), math.max(r1, r2)
        for rr = lo + 1, hi - 1 do
            if grid[f1][rr] ~= nil then return false end
        end
        return true
    elseif r1 == r2 then
        local lo, hi = math.min(f1, f2), math.max(f1, f2)
        for ff = lo + 1, hi - 1 do
            if grid[ff][r1] ~= nil then return false end
        end
        return true
    end
    return false
end
function CountScreen(grid, f1, r1, f2, r2)
    local n = 0
    if f1 == f2 then
        local lo, hi = math.min(r1, r2), math.max(r1, r2)
        for rr = lo + 1, hi - 1 do
            if grid[f1][rr] ~= nil then n = n + 1 end
        end
        return n
    elseif r1 == r2 then
        local lo, hi = math.min(f1, f2), math.max(f1, f2)
        for ff = lo + 1, hi - 1 do
            if grid[ff][r1] ~= nil then n = n + 1 end
        end
        return n
    end
    return -1
end
function AttacksCell(grid, p, tf, tr)
    local f, r, s, t = p.f, p.r, p.s, p.t
    if t == 5 then
        return (f == tf or r == tr) and LineClear(grid, f, r, tf, tr)
    elseif t == 6 then
        return (f == tf or r == tr) and CountScreen(grid, f, r, tf, tr) == 1
    elseif t == 4 then
        local df, dr = tf - f, tr - r
        if math.abs(df) == 2 and math.abs(dr) == 1 then
            return grid[f + df / 2][r] == nil
        elseif math.abs(df) == 1 and math.abs(dr) == 2 then
            return grid[f][r + dr / 2] == nil
        end
        return false
    elseif t == 3 then
        local df, dr = tf - f, tr - r
        if math.abs(df) == 2 and math.abs(dr) == 2 then
            if (s == 0 and tr >= 5) or (s == 1 and tr <= 4) then
                return grid[f + df / 2][r + dr / 2] == nil
            end
        end
        return false
    elseif t == 2 then
        local df, dr = tf - f, tr - r
        return math.abs(df) == 1 and math.abs(dr) == 1 and InPalace(s, tf, tr)
    elseif t == 1 then
        local df, dr = tf - f, tr - r
        if math.abs(df) + math.abs(dr) == 1 and InPalace(s, tf, tr) then
            return true
        end
        if f == tf and r ~= tr and LineClear(grid, f, r, tf, tr) then
            local q = grid[tf][tr]
            if q ~= nil and q.t == 1 and q.s ~= s then return true end
        end
        return false
    elseif t == 7 then
        local df, dr = tf - f, tr - r
        if s == 0 then
            if dr == -1 and df == 0 then return true end
            if r <= 4 and dr == 0 and math.abs(df) == 1 then return true end
        else
            if dr == 1 and df == 0 then return true end
            if r >= 5 and dr == 0 and math.abs(df) == 1 then return true end
        end
        return false
    end
    return false
end
function InCheck(grid, s)
    local kf, kr = FindKing(grid, s)
    if kf < 0 then return true end
    for _, d in ipairs(DIRS_ORTHO) do
        local f, r = kf + d[1], kr + d[2]
        local screen = 0
        while InBoard(f, r) do
            local p = grid[f][r]
            if p ~= nil then
                if screen == 0 then
                    if p.s ~= s then
                        if p.t == 5 then return true end
                        if p.t == 1 and d[1] == 0 then return true end
                    end
                    screen = 1
                else
                    if p.s ~= s and p.t == 6 then return true end
                    break
                end
            end
            f = f + d[1]; r = r + d[2]
        end
    end
    for _, d in ipairs(DIRS_HORSE) do
        local nf, nr = kf + d[1], kr + d[2]
        if InBoard(nf, nr) then
            local p = grid[nf][nr]
            if p ~= nil and p.s ~= s and p.t == 4 then
                local lf, lr
                if math.abs(d[1]) == 2 then lf, lr = nf - d[1] / 2, nr
                else lf, lr = nf, nr - d[2] / 2 end
                if grid[lf][lr] == nil then return true end
            end
        end
    end
    if s == 0 then
        if kr > 0 then
            local p = grid[kf][kr - 1]
            if p ~= nil and p.s ~= s and p.t == 7 then return true end
        end
        if kr >= 5 then
            for _, df in ipairs({-1, 1}) do
                local nf = kf + df
                if InBoard(nf, kr) then
                    local p = grid[nf][kr]
                    if p ~= nil and p.s ~= s and p.t == 7 then return true end
                end
            end
        end
    else
        if kr < 9 then
            local p = grid[kf][kr + 1]
            if p ~= nil and p.s ~= s and p.t == 7 then return true end
        end
        if kr <= 4 then
            for _, df in ipairs({-1, 1}) do
                local nf = kf + df
                if InBoard(nf, kr) then
                    local p = grid[nf][kr]
                    if p ~= nil and p.s ~= s and p.t == 7 then return true end
                end
            end
        end
    end
    return false
end

ZOBRIST_PIECE = {}
ZOBRIST_TURN = 0

function InitZobrist()
    local seed = 0x9E3779B97F4A7C15
    local function next64()
        seed = seed ~ (seed << 13)
        seed = seed ~ (seed >> 7)
        seed = seed ~ (seed << 17)
        return seed & 0xFFFFFFFFFFFFFFFF
    end
    ZOBRIST_PIECE = {}
    for i = 0, 9 * 10 * 7 * 2 - 1 do
        ZOBRIST_PIECE[i] = next64()
    end
    ZOBRIST_TURN = next64()
    Log("Zobrist 哈希初始化完成")
end

function PieceZKey(p)
    return (p.f * 10 + p.r) * 14 + (p.t - 1) * 2 + p.s
end

function ApplyMove(grid, mv)
    local cap = grid[mv.nf][mv.nr]
    grid[mv.piece.f][mv.piece.r] = nil
    hash = hash ~ ZOBRIST_PIECE[PieceZKey(mv.piece)]
    mv.piece.f, mv.piece.r = mv.nf, mv.nr
    hash = hash ~ ZOBRIST_PIECE[PieceZKey(mv.piece)]
    grid[mv.nf][mv.nr] = mv.piece
    if cap ~= nil then
        hash = hash ~ ZOBRIST_PIECE[(mv.nf * 10 + mv.nr) * 14 + (cap.t - 1) * 2 + cap.s]
    end
    return cap
end
function UndoMove(grid, mv, cap)
    hash = hash ~ ZOBRIST_PIECE[(mv.nf * 10 + mv.nr) * 14 + (mv.piece.t - 1) * 2 + mv.piece.s]
    grid[mv.nf][mv.nr] = cap
    mv.piece.f, mv.piece.r = mv.oldF, mv.oldR
    hash = hash ~ ZOBRIST_PIECE[PieceZKey(mv.piece)]
    grid[mv.oldF][mv.oldR] = mv.piece
    if cap ~= nil then
        hash = hash ~ ZOBRIST_PIECE[(mv.nf * 10 + mv.nr) * 14 + (cap.t - 1) * 2 + cap.s]
    end
end
function GenMoves(grid, s)
    local out = {}
    for f = 0, 8 do
        for r = 0, 9 do
            local p = grid[f][r]
            if p ~= nil and p.s == s then
                for _, m in ipairs(GenPieceMoves(grid, p)) do
                    local mv = { piece = p, oldF = p.f, oldR = p.r, nf = m.nf, nr = m.nr }
                    local cap = ApplyMove(grid, mv)
                    local ok = not InCheck(grid, s)
                    UndoMove(grid, mv, cap)
                    if ok then mv.cap = cap; out[#out + 1] = mv end
                end
            end
        end
    end
    return out
end
function GenCaptures(grid, s)
    local out = {}
    for f = 0, 8 do
        for r = 0, 9 do
            local p = grid[f][r]
            if p ~= nil and p.s == s then
                for _, m in ipairs(GenPieceMoves(grid, p)) do
                    if grid[m.nf][m.nr] ~= nil then
                        local mv = { piece = p, oldF = p.f, oldR = p.r, nf = m.nf, nr = m.nr }
                        local cap = ApplyMove(grid, mv)
                        local ok = not InCheck(grid, s)
                        UndoMove(grid, mv, cap)
                        if ok then mv.cap = cap; out[#out + 1] = mv end
                    end
                end
            end
        end
    end
    return out
end

-- ============================================================================
-- §8 局面评估与 AI 搜索（节点预算 + 搜索内重复判和）
-- ============================================================================
function EvalRed()
    local score = 0
    for f = 0, 8 do
        for r = 0, 9 do
            local p = grid[f][r]
            if p ~= nil then
                local v = MATERIAL[p.t]
                local tb = PSQT[p.t]
                if p.s == 0 then
                    score = score + v
                    if tb ~= nil then score = score + tb[r + 1][f + 1] end
                else
                    score = score - v
                    if tb ~= nil then score = score - tb[10 - r][f + 1] end
                end
            end
        end
    end
    return score
end
function EvalFor(side)
    local e = EvalRed()
    if side == 0 then return e else return -e end
end
function HistoryGet(from, to)
    local row = history[from]
    if row == nil then return 0 end
    return row[to] or 0
end
function HistoryAdd(from, to, depth)
    local row = history[from]
    if row == nil then row = {}; history[from] = row end
    local v = (row[to] or 0) + depth * depth
    if v > 100000 then
        for _, rr in pairs(history) do
            for k, vv in pairs(rr) do rr[k] = math.floor(vv / 2) end
        end
        v = depth * depth
    end
    row[to] = v
end
function StoreKiller(mv, ply)
    local k = killers[ply]
    if k == nil then k = {}; killers[ply] = k end
    for _, km in ipairs(k) do
        if km.oldF == mv.oldF and km.oldR == mv.oldR and km.nf == mv.nf and km.nr == mv.nr then return end
    end
    table.insert(k, 1, { oldF = mv.oldF, oldR = mv.oldR, nf = mv.nf, nr = mv.nr })
    if #k > 2 then k[3] = nil end
end
function IsKiller(mv, ply)
    local k = killers[ply]
    if k == nil then return false end
    for _, km in ipairs(k) do
        if km.oldF == mv.oldF and km.oldR == mv.oldR and km.nf == mv.nf and km.nr == mv.nr then return true end
    end
    return false
end
function OrderMoves(moves, ply)
    local p = ply or 0
    for _, mv in ipairs(moves) do
        local sc
        if mv.cap ~= nil then
            sc = 1000000 + MATERIAL[mv.cap.t] - math.floor(MATERIAL[mv.piece.t] / 8)
        elseif IsKiller(mv, p) then
            sc = 900000
        else
            sc = HistoryGet(mv.oldF * 10 + mv.oldR, mv.nf * 10 + mv.nr)
        end
        mv._s = sc
    end
    table.sort(moves, function(a, b) return (a._s or 0) > (b._s or 0) end)
end

-- ★ 静态搜索：节点预算硬限制 + 重复判和（入口检查）
function Quiesce(side, alpha, beta, qdepth, ply)
    if searchAborted then return EvalFor(side) end
    nodeCount = nodeCount + 1
    if nodeCount >= NODE_LIMIT then
        searchAborted = true
        return EvalFor(side)
    end
    if ply >= QUIESCE_PLY_MAX then return EvalFor(side) end

    -- ★ 重复局面判和
    if (positionCounts[hash] or 0) >= 3 then
        return 0
    end

    local inCheck = InCheck(grid, side)
    if inCheck then
        local moves = GenMoves(grid, side)
        if #moves == 0 then return -1000000 + ply end
        OrderMoves(moves, ply)
        local best = -math.huge
        for _, mv in ipairs(moves) do
            local cap = ApplyMove(grid, mv)
            positionCounts[hash] = (positionCounts[hash] or 0) + 1
            local sc = -Quiesce(1 - side, -beta, -alpha, qdepth - 1, ply + 1)
            positionCounts[hash] = (positionCounts[hash] or 1) - 1
            UndoMove(grid, mv, cap)
            if searchAborted then
                if best > -math.huge then return best end
                return EvalFor(side)
            end
            if sc > best then best = sc end
            if sc > alpha then alpha = sc end
            if alpha >= beta then break end
        end
        return best
    end

    local standPat = EvalFor(side)
    if standPat >= beta then return standPat end
    if standPat > alpha then alpha = standPat end
    if qdepth <= 0 then return standPat end

    local caps = GenCaptures(grid, side)
    OrderMoves(caps, ply)
    for _, mv in ipairs(caps) do
        local cap = ApplyMove(grid, mv)
        positionCounts[hash] = (positionCounts[hash] or 0) + 1
        local nextSide = 1 - side
        local ext = InCheck(grid, nextSide) and 1 or 0
        local sc = -Quiesce(nextSide, -beta, -alpha, qdepth - 1 + ext, ply + 1)
        positionCounts[hash] = (positionCounts[hash] or 1) - 1
        UndoMove(grid, mv, cap)
        if searchAborted then return alpha end
        if sc >= beta then return sc end
        if sc > alpha then alpha = sc end
    end
    return alpha
end

-- ★ 主搜索：节点预算硬限制 + 重复判和
function Search(side, depth, alpha, beta, ply)
    if searchAborted then return EvalFor(side) end
    nodeCount = nodeCount + 1
    if nodeCount >= NODE_LIMIT then
        searchAborted = true
        return EvalFor(side)
    end

    -- ★ 重复局面判和（进入这个节点时 hash 已是新局面，计数已在上一层调用方 +1）
    if (positionCounts[hash] or 0) >= 3 then
        return 0
    end

    if depth <= 0 then
        return Quiesce(side, alpha, beta, QUIESCE_MAX, ply)
    end

    local moves = GenMoves(grid, side)
    if #moves == 0 then
        if InCheck(grid, side) then return -1000000 + ply end
        return -100000
    end

    local ext = 0
    if ply < 12 and InCheck(grid, side) then ext = 1 end
    OrderMoves(moves, ply)

    local best = -math.huge
    for _, mv in ipairs(moves) do
        local cap = ApplyMove(grid, mv)
        positionCounts[hash] = (positionCounts[hash] or 0) + 1
        local sc = -Search(1 - side, depth - 1 + ext, -beta, -alpha, ply + 1)
        positionCounts[hash] = (positionCounts[hash] or 1) - 1
        UndoMove(grid, mv, cap)
        if searchAborted then
            if best > -math.huge then return best end
            return EvalFor(side)
        end
        if sc > best then best = sc end
        if sc > alpha then alpha = sc end
        if alpha >= beta then
            if mv.cap == nil then
                StoreKiller(mv, ply)
                HistoryAdd(mv.oldF * 10 + mv.oldR, mv.nf * 10 + mv.nr, depth)
            end
            break
        end
    end
    return best
end

function OrderMovesRoot(moves, best)
    for _, mv in ipairs(moves) do
        local sc
        if best ~= nil and mv.oldF == best.oldF and mv.oldR == best.oldR
           and mv.nf == best.nf and mv.nr == best.nr then
            sc = 2000000
        elseif mv.cap ~= nil then
            sc = 1000000 + MATERIAL[mv.cap.t] - math.floor(MATERIAL[mv.piece.t] / 8)
        elseif IsKiller(mv, 1) then
            sc = 900000
        else
            sc = HistoryGet(mv.oldF * 10 + mv.oldR, mv.nf * 10 + mv.nr)
        end
        mv._s = sc
    end
    table.sort(moves, function(a, b) return (a._s or 0) > (b._s or 0) end)
end

function AiChooseMove()
    nodeCount = 0
    searchAborted = false
    killers = {}
    history = {}

    local rootMoves = GenMoves(grid, aiSide)
    if #rootMoves == 0 then return nil end

    local bestMove = rootMoves[1]
    local bestScore = -math.huge

    for d = 1, AI_DEPTH_MAX do
        for _, mv in ipairs(rootMoves) do mv._sc = nil end
        local alpha = -math.huge
        local iterBest = nil
        local iterBestScore = -math.huge
        local complete = true

        OrderMovesRoot(rootMoves, bestMove)

        for _, mv in ipairs(rootMoves) do
            searchAborted = false

            local cap = ApplyMove(grid, mv)
            positionCounts[hash] = (positionCounts[hash] or 0) + 1
            local sc = -Search(playerSide, d - 1, -math.huge, -alpha, 1)
            positionCounts[hash] = (positionCounts[hash] or 1) - 1
            UndoMove(grid, mv, cap)

            if searchAborted then
                complete = false
                if nodeCount >= NODE_LIMIT then break end
            else
                mv._sc = sc
                if sc > iterBestScore then
                    iterBestScore = sc
                    iterBest = mv
                end
                if sc > alpha then alpha = sc end
            end
        end

        if iterBest ~= nil then
            bestMove = iterBest
            bestScore = iterBestScore
        end

        if not complete then break end
        if nodeCount >= NODE_LIMIT then break end
        if bestScore > 500000 or bestScore < -500000 then break end
    end

    Log(string.format("AI depth=%d nodes=%d/%d", AI_DEPTH_MAX, nodeCount, NODE_LIMIT))
    return bestMove
end

-- ============================================================================
-- §8.5 杀型识别
-- ============================================================================
function DetectMateType(loserSide, mv)
    if mv == nil then return nil end
    local winnerSide = 1 - loserSide
    local kf, kr = FindKing(grid, loserSide)
    if kf < 0 then return nil end
    local p = mv.piece
    if p == nil then return nil end

    local function escapeBlocked(df, dr)
        local nf, nr = kf + df, kr + dr
        if not InPalace(loserSide, nf, nr) then return true end
        local occ = grid[nf][nr]
        if occ ~= nil then
            if occ.s == loserSide then return true end
            return false
        end
        for f = 0, 8 do
            for r = 0, 9 do
                local a = grid[f][r]
                if a ~= nil and a.s == winnerSide and AttacksCell(grid, a, nf, nr) then
                    return true
                end
            end
        end
        return false
    end

    local function countAttackers(t)
        local n = 0
        for f = 0, 8 do
            for r = 0, 9 do
                local q = grid[f][r]
                if q ~= nil and q.s == winnerSide and q.t == t and AttacksCell(grid, q, kf, kr) then
                    n = n + 1
                end
            end
        end
        return n
    end

    if countAttackers(5) >= 2 then return "双车错" end

    local function cannonLine()
        for _, d in ipairs(DIRS_ORTHO) do
            local nf, nr = kf + d[1], kr + d[2]
            local first = nil
            while InBoard(nf, nr) do
                local q = grid[nf][nr]
                if q ~= nil then
                    if first == nil then
                        first = q
                    else
                        if first.s == winnerSide and first.t == 6
                           and q.s == winnerSide and q.t == 6 then
                            return true
                        end
                        break
                    end
                end
                nf = nf + d[1]; nr = nr + d[2]
            end
        end
        return false
    end
    if cannonLine() then return "重炮" end

    if countAttackers(6) >= 1 then
        local knightCovers = false
        for f = 0, 8 do
            for r = 0, 9 do
                local q = grid[f][r]
                if q ~= nil and q.s == winnerSide and q.t == 4 then
                    for _, d in ipairs(DIRS_ORTHO) do
                        local ef, er = kf + d[1], kr + d[2]
                        if InPalace(loserSide, ef, er) then
                            local occ = grid[ef][er]
                            if occ == nil or occ.s == loserSide then
                                if AttacksCell(grid, q, ef, er) then
                                    knightCovers = true
                                    break
                                end
                            end
                        end
                    end
                end
                if knightCovers then break end
            end
            if knightCovers then break end
        end
        if knightCovers then return "马后炮" end
    end

    if countAttackers(6) >= 1 or p.t == 6 then
        local vHas, hHas = false, false
        for f = 0, 8 do
            for r = 0, 9 do
                local q = grid[f][r]
                if q ~= nil and q.s == winnerSide and q.t == 6 then
                    local sc = CountScreen(grid, q.f, q.r, kf, kr)
                    if sc >= 0 and sc <= 1 then
                        if q.f == kf then vHas = true end
                        if q.r == kr then hHas = true end
                    end
                end
            end
        end
        if vHas and hHas then return "天地炮" end
    end

    if p.t == 6 and (p.f == kf or p.r == kr) then
        local s = CountScreen(grid, p.f, p.r, kf, kr)
        if s == 1 then
            local mid = nil
            if p.f == kf then
                local lo, hi = math.min(p.r, kr), math.max(p.r, kr)
                for rr = lo + 1, hi - 1 do
                    if grid[p.f][rr] ~= nil then
                        mid = grid[p.f][rr]
                        break
                    end
                end
            else
                local lo, hi = math.min(p.f, kf), math.max(p.f, kf)
                for ff = lo + 1, hi - 1 do
                    if grid[ff][p.r] ~= nil then
                        mid = grid[ff][p.r]
                        break
                    end
                end
            end
            if mid ~= nil and mid.s == loserSide and mid.t == 2 then
                return "闷宫"
            end
        end
    end

    if (p.t == 5 or p.t == 6) and p.f == kf then
        if escapeBlocked(-1, 0) and escapeBlocked(1, 0) then
            local aux = false
            for f = 0, 8 do
                for r = 0, 9 do
                    local q = grid[f][r]
                    if q ~= nil and q.s == winnerSide and q ~= p and (q.t == 5 or q.t == 6) then
                        if q.r == kr then
                            local sc = CountScreen(grid, q.f, q.r, kf, kr)
                            if sc >= 0 and sc <= 1 then aux = true end
                        elseif AttacksCell(grid, q, kf - 1, kr) or AttacksCell(grid, q, kf + 1, kr) then
                            aux = true
                        end
                    end
                    if aux then break end
                end
                if aux then break end
            end
            if aux then return "铁门栓" end
        end
    end

    if p.t == 4 then
        local nf, nr = p.f, p.r
        if loserSide == 1 then
            if (nf == 2 and nr == 1) or (nf == 6 and nr == 1) then return "卧槽马" end
            if (nf == 2 and nr == 0) or (nf == 6 and nr == 0) then return "挂角马" end
        else
            if (nf == 2 and nr == 8) or (nf == 6 and nr == 8) then return "卧槽马" end
            if (nf == 2 and nr == 9) or (nf == 6 and nr == 9) then return "挂角马" end
        end
    end
    return nil
end

-- ============================================================================
-- §9 对局流程
-- ============================================================================
function RefreshStatus(check)
    if statusCtrl == nil or not statusCtrl.alive then return end
    local txt
    if turn == playerSide then
        local name = (playerSide == 0) and "红方（你）" or "黑方（你）"
        txt = "轮到" .. name
    else
        local name = (aiSide == 0) and "红方" or "黑方"
        txt = "轮到" .. name .. "（AI）思考中…"
    end
    if check then txt = "将军！" .. txt end
    statusCtrl.text = txt
end

function CheckRepetitionDraw()
    local n = #gameHistory
    if n < 6 then return false end
    local key = gameHistory[n].key
    local count = 0
    local firstIdx = nil
    local lo = math.max(1, n - REP_WINDOW)
    for i = n, lo, -1 do
        if gameHistory[i].key == key then
            count = count + 1
            if firstIdx == nil then firstIdx = i end
            if count >= 3 then break end
        end
    end
    if count < 3 then return false end
    local allCheck = true
    for i = firstIdx, n - 1 do
        if not gameHistory[i].check then
            allCheck = false
            break
        end
    end
    gameOver = true
    busy = false
    aiPending = false
    if statusCtrl ~= nil and statusCtrl.alive then
        if allCheck then statusCtrl.text = "长将判和！"
        else statusCtrl.text = "循环局面，判和！" end
    end
    ShowToast(allCheck and "长 将 判 和！" or "循 环 判 和！",
        math.floor(layout.cell * 1.4), COLOR_MATE, 2.2)
    Log(allCheck and "长将判和（重复局面）" or "循环局面判和")
    return true
end

function GameOver(winner, lastMove)
    gameOver = true
    busy = false
    aiPending = false
    local mateName = nil
    if lastMove ~= nil then
        mateName = DetectMateType(1 - winner, lastMove)
    end
    local text
    if winner == playerSide then text = "你赢了！"
    else text = "AI 胜！" end
    if mateName ~= nil then text = text .. "（" .. mateName .. "）" end
    if statusCtrl ~= nil and statusCtrl.alive then statusCtrl.text = text end
    if mateName ~= nil then
        ShowToast("绝 杀！" .. mateName, math.floor(layout.cell * 1.5), COLOR_MATE, 2.6)
    else
        ShowToast("绝 杀！", math.floor(layout.cell * 1.6), COLOR_MATE, 2.6)
    end
    Log(string.format("对局结束，胜方=%s%s", (winner == 0) and "红" or "黑",
        mateName ~= nil and ("，杀型=" .. mateName) or ""))
end

function FinishMove(mv)
    local mover = mv.piece.s

    -- ★ 先记录 moveStack 和 gameHistory（无论将死与否）
    table.insert(moveStack, {
        mv = mv,
        cap = mv.cap,
        moverSide = mover,
        hashAfter = hash,
    })

    local nextMoves = GenMoves(grid, 1 - mover)
    local check = InCheck(grid, 1 - mover)
    table.insert(gameHistory, { key = hash, check = check })
    positionCounts[hash] = (positionCounts[hash] or 0) + 1

    if #nextMoves == 0 then
        GameOver(mover, mv)
        return
    end
    if CheckRepetitionDraw() then return end

    turn = 1 - mover
    selected = nil
    busy = false
    RefreshStatus(check)
    if check then
        ShowToast("将 军！", math.floor(layout.cell * 1.6), COLOR_CHECK, 1.0)
    end
    if turn == aiSide then aiPending = true; aiDelay = AI_DELAY end
end

function AnimateMove(mv)
    busy = true
    local isAIMove = (mv.piece.s == aiSide)
    local dur = isAIMove and AI_MOVE_DUR or MOVE_DUR

    local tweens = {}
    local nx, ny = BoardX(mv.nf), BoardY(mv.nr)

    if mv.piece.ctrl ~= nil then
        for _, s in ipairs(mv.piece.ctrl.shapes or {}) do
            if s ~= nil and s.alive then
                local tw = game.Tween(s, { anchoredPositionX = nx, anchoredPositionY = ny }, dur)
                tw:SetEase(Enum.EaseType.OutQuad)
                tweens[#tweens + 1] = tw
            end
        end
        if mv.piece.ctrl.txt ~= nil and mv.piece.ctrl.txt.alive then
            local tw = game.Tween(mv.piece.ctrl.txt, { anchoredPositionX = nx, anchoredPositionY = ny }, dur)
            tw:SetEase(Enum.EaseType.OutQuad)
            tweens[#tweens + 1] = tw
        end
    end
    if mv.cap ~= nil and mv.cap.ctrl ~= nil then
        local ccx, ccy = BoardX(mv.cap.f), BoardY(mv.cap.r)
        for _, s in ipairs(mv.cap.ctrl.shapes or {}) do
            if s ~= nil and s.alive then
                local tw = game.Tween(s, {
                    anchoredPositionX = ccx, anchoredPositionY = ccy,
                    localScaleX = 0, localScaleY = 0,
                }, CAPTURE_DUR)
                tw:SetEase(Enum.EaseType.OutQuad)
                tweens[#tweens + 1] = tw
            end
        end
        if mv.cap.ctrl.txt ~= nil and mv.cap.ctrl.txt.alive then
            local tw = game.Tween(mv.cap.ctrl.txt, {
                anchoredPositionX = ccx, anchoredPositionY = ccy,
                localScaleX = 0, localScaleY = 0,
            }, CAPTURE_DUR)
            tw:SetEase(Enum.EaseType.OutQuad)
            tweens[#tweens + 1] = tw
        end
    end
    PlayTweensParallel(tweens, function()
        if mv.cap ~= nil then DestroyPieceCtrl(mv.cap) end
        FinishMove(mv)
    end)
end

function HandleTap(f, r)
    if busy or gameOver or turn ~= playerSide then return end
    local p = grid[f][r]
    if p ~= nil and p.s == playerSide then
        if selected ~= nil and selected ~= p then HighlightPiece(selected, false) end
        selected = p
        HighlightPiece(p, true)
        ShowHintDots(p)
        return
    end
    if selected ~= nil then
        local moves = GenMoves(grid, playerSide)
        for _, mv in ipairs(moves) do
            if mv.piece == selected and mv.nf == f and mv.nr == r then
                HighlightPiece(selected, false)
                ClearHintDots()
                ApplyMove(grid, mv)
                AnimateMove(mv)
                return
            end
        end
        HighlightPiece(selected, false)
        ClearHintDots()
        selected = nil
    end
end

function NewGame(ps)
    playerSide = ps or 0
    aiSide = 1 - playerSide
    boardFlipped = (playerSide == 1)
    KillAllAnims()
    ClearHintDots()
    ClearToasts()
    for _, p in ipairs(pieces) do DestroyPieceCtrl(p) end
    pieces = {}
    grid = {}
    for f = 0, 8 do grid[f] = {} end

    hash = 0
    for _, spec in ipairs(INIT_LAYOUT) do
        local f, r, t = spec[1], spec[2], spec[3]
        local s = (r >= 6) and 0 or 1
        local piece = { t = t, s = s, f = f, r = r, ctrl = nil }
        grid[f][r] = piece
        hash = hash ~ ZOBRIST_PIECE[PieceZKey(piece)]
    end
    for f = 0, 8 do
        for r = 0, 9 do
            local p = grid[f][r]
            if p ~= nil then CreatePieceCtrl(p) end
        end
    end
    selected = nil
    turn = 0
    busy = false
    gameOver = false
    aiPending = false
    aiDelay = 0
    gameHistory = {}
    moveStack = {}
    positionCounts = {}
    positionCounts[hash] = 1   -- ★ 初始局面算 1 次
    killers = {}
    history = {}
    searchAborted = false
    RefreshStatus(false)
    RaiseTapCtrl()
    Log(string.format("新局开始：玩家执%s，难度=%s，棋盘翻转=%s",
        (playerSide == 0) and "红" or "黑",
        (DIFFICULTY_CFG[difficulty] or DIFFICULTY_CFG[3]).name,
        tostring(boardFlipped)))
    if turn == aiSide then
        aiPending = true
        aiDelay = AI_DELAY
    end
end

-- ============================================================================
-- §10 输入
-- ============================================================================
function TapToCell(event)
    local x, y = event:GetUIPos()
    local lx = x - layout.w / 2
    local ly = y - layout.h / 2
    local f, r
    if boardFlipped then
        f = math.floor((4 * layout.cell - lx) / layout.cell + 0.5)
        r = math.floor((4.5 * layout.cell + ly) / layout.cell + 0.5)
    else
        f = math.floor((lx + 4 * layout.cell) / layout.cell + 0.5)
        r = math.floor((4.5 * layout.cell - ly) / layout.cell + 0.5)
    end
    if f < 0 or f > 8 or r < 0 or r > 9 then return nil end
    return f, r
end

function OnTap(event)
    if tapClock - lastTapAt < 0.08 then return end
    lastTapAt = tapClock
    local x, y = event:GetUIPos()
    local lx = x - layout.w / 2
    local ly = y - layout.h / 2

    if menuVisible then
        for _, b in ipairs(menuButtons) do
            if lx >= b.cx - b.w / 2 and lx <= b.cx + b.w / 2
               and ly >= b.cy - b.h / 2 and ly <= b.cy + b.h / 2 then
                if b.onClick ~= nil then b.onClick() end
                return
            end
        end
        return
    end

    -- ★ 游戏内按钮（悔棋 / 重开）
    for _, b in ipairs(gameButtons) do
        if lx >= b.cx - b.w / 2 and lx <= b.cx + b.w / 2
           and ly >= b.cy - b.h / 2 and ly <= b.cy + b.h / 2 then
            if b.onClick ~= nil then b.onClick() end
            return
        end
    end

    local f, r = TapToCell(event)
    if f == nil then return end
    HandleTap(f, r)
end

function BindTapInput()
    local parent = script.object
    if parent == nil or not parent.alive then return end
    if parent.showCursor ~= nil then parent.showCursor = true end
    local function bind(target)
        if target == nil then return end
        pcall(function()
            target:AddCursorEventListener(Enum.CursorEventType.CursorDown, OnTap)
        end)
    end
    if CONTROL_PREFAB_TOUCH_AREA ~= nil and CONTROL_PREFAB_TOUCH_AREA > 0 then
        local area = CreateSafe(CONTROL_PREFAB_TOUCH_AREA, parent)
        if area ~= nil then
            area:SetActive(true); area:SetVisible(true)
            area:SetSizeDelta(layout.w, layout.h)
            area:SetAnchoredPosition(0, 0)
            if area.raycastTarget ~= nil then area.raycastTarget = true end
            area:SetAsLastSibling()
            bind(area)
            tapCtrl = area
            Log("点击输入：检测区域控件")
        end
    end
    bind(parent)
end

function BindKeyInput()
    if next(keyHandlers) ~= nil then return end
    local parent = script.object
    if parent == nil or not parent.alive then return end
    keyHandlers[Enum.KeyEventType.KeyboardCraftspersonKey18Down] = function()
        if menuVisible then return true end
        ClearHintDots()
        ClearToasts()
        KillAllAnims()
        selected = nil
        busy = false
        gameOver = true
        aiPending = false
        ShowMenu()
        return true
    end
    parent:AddKeyEventListener(Enum.KeyEventType.KeyboardCraftspersonKey18Down,
        keyHandlers[Enum.KeyEventType.KeyboardCraftspersonKey18Down])
    Log("按键已绑定：P 返回菜单")
end

-- ============================================================================
-- §11 生命周期
-- ============================================================================
function OnStart()
    script:EnableUpdate(true)
    InitZobrist()
    LayoutCanvas()
    CreateBoardGraphics()
    BindTapInput()
    BindKeyInput()
    ShowMenu()
    Log("中国象棋（AI）启动完成，等待玩家选择")
end

function OnUpdate(dt)
    tapClock = tapClock + dt
    UpdateToasts(dt)
    if menuVisible then return end
    if aiPending then
        aiDelay = aiDelay - dt
        if aiDelay <= 0 then
            aiPending = false
            busy = true
            local mv = AiChooseMove()
            if mv == nil then
                GameOver(playerSide)
            else
                ApplyMove(grid, mv)
                AnimateMove(mv)
            end
        end
    end
end

function OnDestroy()
    for k, h in pairs(keyHandlers) do
        if script.object ~= nil and script.object.alive then
            pcall(function() script.object:RemoveKeyEventListener(k, h) end)
        end
    end
    keyHandlers = {}
    if tapCtrl ~= nil and tapCtrl.alive then
        pcall(function()
            tapCtrl:RemoveCursorEventListener(Enum.CursorEventType.CursorDown, OnTap)
        end)
    end
    tapCtrl = nil
    ClearHintDots()
    ClearToasts()
    DestroyMenu()
    KillAllAnims()
end