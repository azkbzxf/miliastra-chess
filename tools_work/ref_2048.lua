-- ============================================================
-- 2048 简化版（中文注释）
-- 操作：方向键 / WASD / 鼠标拖拽 / 滑动；P 重开
-- 玩法：相同数字合并翻倍，满格无法移动则游戏结束
-- 说明：格子之间无间隙；字号随格子和数字位数自动调整
-- ============================================================

-- ---------- 一、常量配置 ----------
local N = 4                    -- 4x4 网格
local GAP = 0                  -- 格子间距（已去掉）
local BORDER = 22              -- 棋盘内边距
local SIDE_RATIO = 0.62        -- 棋盘占屏幕短边比例
local SWIPE_MIN_RATIO = 0.06   -- 滑动判定阈值（占屏幕短边比例）

local MOVE_TIME       = 0.08   -- 移动动画时长
local FAST_MOVE_TIME  = 0.04   -- 有排队输入时加速
local POP_TIME        = 0.18   -- 新块弹出时长
local PULSE_UP_TIME   = 0.09   -- 合并脉冲放大时长
local PULSE_DOWN_TIME = 0.11   -- 合并脉冲缩回时长

-- 数字块颜色（底色 / 字色）
local STYLE = {
    [2]     = { {238,228,218}, {119,110,101} },
    [4]     = { {237,224,200}, {119,110,101} },
    [8]     = { {242,177,121}, {249,246,242} },
    [16]    = { {245,149,99 }, {249,246,242} },
    [32]    = { {246,124,95 }, {249,246,242} },
    [64]    = { {246,94, 59 }, {249,246,242} },
    [128]   = { {237,207,114}, {249,246,242} },
    [256]   = { {237,204,97 }, {249,246,242} },
    [512]   = { {237,200,80 }, {249,246,242} },
    [1024]  = { {237,197,63 }, {249,246,242} },
    [2048]  = { {237,194,46 }, {249,246,242} },
    [4096]  = { {230,90, 60 }, {249,246,242} },
    [8192]  = { {210,70, 110}, {249,246,242} },
    [16384] = { {150,70, 170}, {249,246,242} },
    [32768] = { {80, 80, 180}, {249,246,242} },
    [65536] = { {40, 90, 180}, {249,246,242} },
}
local STYLE_DEFAULT = { {60,58,50}, {249,246,242} }

-- 界面颜色
local COLOR_BG      = {36,38,46}      -- 屏幕背景
local COLOR_BOARD   = {187,173,160}   -- 棋盘底板 / 分数框
local COLOR_EMPTY   = {205,193,180}   -- 空格
local COLOR_TITLE   = {240,240,235}   -- 标题
local COLOR_HINT    = {160,160,160}   -- 提示
local COLOR_SCORE_T = {60,55,50}      -- 分数文字

-- 模板 / 资源 ID（编辑器里填的）
local PREFAB_TILE  = 1073741850   -- 图片控件模板
local PREFAB_HUD   = 1073741853   -- 文字控件模板
local PREFAB_TOUCH = 1073741855   -- 触摸检测区域模板
local ASSET_ROUND  = 106011       -- 圆角白图
local ASSET_SQUARE = 100001       -- 直角白图


-- ---------- 二、运行时状态 ----------
local W, H = 0, 0               -- 画布尺寸
local CELL = 0                  -- 格子边长
local GRID_W, GRID_H = 0, 0     -- 棋盘内部宽高

local grid = {}                 -- grid[r][c] = 块 或 nil
local blocks = {}               -- 所有块（方便统一遍历）

local hudCtrl = nil             -- 分数文字控件
local score, best = 0, 0
local phase = "play"            -- "play" | "over"
local busy = false              -- 动画进行中
local inputQueue = {}           -- 输入队列
local moveCooldown = 0          -- 输入冷却（秒）

local swipeCtrl = nil           -- 滑动检测区域
local swipeTouchId = nil        -- 当前跟踪的触点
local swipeStartX, swipeStartY = 0, 0

local aliveTweens = {}          -- 活动 Tween，重开/销毁时统一终止


-- ---------- 三、工具函数 ----------
local function setImgColor(ctrl, rgb)
    if ctrl and ctrl.alive then
        ctrl.imageColor = Color.FromRGBA(rgb[1], rgb[2], rgb[3], 255)
    end
end

local function setTxtColor(ctrl, rgb)
    if ctrl and ctrl.alive then
        ctrl.fontColor = Color.FromRGBA(rgb[1], rgb[2], rgb[3], 255)
    end
end

local function styleOf(v)
    return STYLE[v] or STYLE_DEFAULT
end

-- 安全创建控件
local function make(prefab, parent)
    if not parent or not parent.alive then return nil end
    local ok, ctrl = pcall(game.InstantiateClientUIControl, prefab, parent)
    if not ok or not ctrl or not ctrl.alive then return nil end
    return ctrl
end

-- 安全销毁控件
local function kill(ctrl)
    if ctrl and ctrl.alive then
        pcall(game.DestroyClientUIControl, ctrl)
    end
end

-- 根据格子大小和数字位数，算一个合适的字号
-- N=4、CELL≈160 时，一位数字号约 40，和之前保持一致
local function fontForValue(value)
    local digits = #tostring(value)
    local base = CELL * 0.34                      -- 基础字号：格子的四分之一
    if digits >= 3 then base = base * 0.85 end    -- 3 位数（128）略缩
    if digits >= 4 then base = base * 0.80 end    -- 4 位数（1024）再缩
    if digits >= 5 then base = base * 0.75 end    -- 5 位数（16384）再缩
    local size = math.floor(base)
    if size < 8 then size = 8 end                 -- 最小 8 号
    return size
end

-- 格子中心坐标（r=1 是最上面一行）
-- 用 CELL + GAP 作为真实步长，保证任意 N 都居中
local function cellPos(r, c)
    local step = CELL + GAP
    local x = (c - (N + 1) * 0.5) * step
    local y = ((N + 1) * 0.5 - r) * step
    return x, y
end

-- 方向 dir 下，第 i 条线第 j 个位置 → 网格 (行, 列)
-- dir: 1=左 3=右 2=上 4=下
local function lineCell(dir, i, j)
    if dir == 1 then return i, j
    elseif dir == 3 then return i, N + 1 - j
    elseif dir == 2 then return j, i
    else return N + 1 - j, i
    end
end

-- 播放一个 Tween 并登记；完成后自动移出，再调用 done
local function trackTween(t, done)
    aliveTweens[#aliveTweens + 1] = t
    t:SetOnComplete(function()
        for i = #aliveTweens, 1, -1 do
            if aliveTweens[i] == t then
                table.remove(aliveTweens, i)
                break
            end
        end
        if done then done() end
    end)
    t:Play()
end

-- 一组控件同时播放相同 Tween，全部完成后调用 done
local function tweenGroup(ctrls, props, dur, ease, done)
    local total = 0
    for _, c in ipairs(ctrls) do
        if c and c.alive then total = total + 1 end
    end
    if total == 0 then
        if done then done() end
        return
    end
    local remain = total
    local function oneDone()
        remain = remain - 1
        if remain <= 0 and done then done() end
    end
    for _, c in ipairs(ctrls) do
        if c and c.alive then
            local t = game.Tween(c, props, dur)
            if ease then t:SetEase(ease) end
            trackTween(t, oneDone)
        else
            oneDone()
        end
    end
end

-- 终止所有活动 Tween
local function killAllTweens()
    for i = #aliveTweens, 1, -1 do
        pcall(function() aliveTweens[i]:Kill(false) end)
    end
    aliveTweens = {}
end


-- ---------- 四、布局 ----------
local function layoutCanvas()
    W, H = game.GetUICanvasSize()
    local side = math.floor(math.min(W, H) * SIDE_RATIO)
    local inner = side - BORDER * 2
    CELL = math.floor((inner - GAP * (N - 1)) / N)
    if CELL < 8 then CELL = 8 end
    GRID_W = N * CELL + GAP * (N - 1)
    GRID_H = GRID_W
end


-- ---------- 五、静态界面 ----------
local function createBackground()
    local parent = script.object
    if not parent or not parent.alive then return end
    local bg = make(PREFAB_TILE, parent)
    if not bg then return end
    bg:SetActive(true); bg:SetVisible(true)
    bg:SetSizeDelta(W, H)
    bg:SetAnchoredPosition(0, 0)
    bg:SetImage(Enum.ImageSource.StaticReference, ASSET_SQUARE)
    bg.imageType = Enum.ImageType.Stretch
    setImgColor(bg, COLOR_BG)
    bg:SetAsFirstSibling()
end

local function createBoardBase()
    local parent = script.object
    if not parent or not parent.alive then return end
    local base = make(PREFAB_TILE, parent)
    if not base then return end
    base:SetActive(true); base:SetVisible(true)
    base:SetSizeDelta(GRID_W + BORDER * 2, GRID_H + BORDER * 2)
    base:SetAnchoredPosition(0, 0)
    base:SetImage(Enum.ImageSource.StaticReference, ASSET_SQUARE)
    base.imageType = Enum.ImageType.Stretch
    setImgColor(base, COLOR_BOARD)
end

local function createEmptyCells()
    local parent = script.object
    if not parent or not parent.alive then return false end
    for r = 1, N do
        for c = 1, N do
            local x, y = cellPos(r, c)
            local img = make(PREFAB_TILE, parent)
            if not img then return false end
            img:SetActive(true); img:SetVisible(true)
            img:SetSizeDelta(CELL, CELL)
            img:SetAnchoredPosition(x, y)
            img:SetImage(Enum.ImageSource.StaticReference, ASSET_ROUND)
            img.imageType = Enum.ImageType.Stretch
            setImgColor(img, COLOR_EMPTY)
        end
    end
    return true
end

local function createTitle()
    local parent = script.object
    if not parent or not parent.alive then return end
    local c = make(PREFAB_HUD, parent)
    if not c then return end
    c:SetActive(true); c:SetVisible(true)
    c:SetSizeDelta(GRID_W * 0.45, 90)
    c:SetAnchoredPosition(-GRID_W * 0.22, GRID_H / 2 + BORDER + 66)
    c.adaptiveFontSize = false
    c.fontSize = 56
    c.horizontalAlignment = Enum.TextHorizontalAlignment.Left
    c.verticalAlignment = Enum.TextVerticalAlignment.Middle
    c.bgColor = Color.FromRGBA(0, 0, 0, 0)
    c.text = "2048"
    setTxtColor(c, COLOR_TITLE)
end

local function createScoreBox()
    local parent = script.object
    if not parent or not parent.alive then return end
    local bg = make(PREFAB_TILE, parent)
    if bg then
        bg:SetActive(true); bg:SetVisible(true)
        bg:SetSizeDelta(GRID_W * 0.42, 90)
        bg:SetAnchoredPosition(GRID_W * 0.22, GRID_H / 2 + BORDER + 66)
        bg:SetImage(Enum.ImageSource.StaticReference, ASSET_ROUND)
        bg.imageType = Enum.ImageType.Stretch
        setImgColor(bg, COLOR_BOARD)
    end
    local c = make(PREFAB_HUD, parent)
    if not c then return end
    c:SetActive(true); c:SetVisible(true)
    c:SetSizeDelta(GRID_W * 0.42, 90)
    c:SetAnchoredPosition(GRID_W * 0.22, GRID_H / 2 + BORDER + 66)
    c.adaptiveFontSize = false
    c.fontSize = 26
    c.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
    c.verticalAlignment = Enum.TextVerticalAlignment.Middle
    c.bgColor = Color.FromRGBA(0, 0, 0, 0)
    c.text = "分数 0\n最高 0"
    setTxtColor(c, COLOR_SCORE_T)
    hudCtrl = c
end

local function createHint()
    local parent = script.object
    if not parent or not parent.alive then return end
    local c = make(PREFAB_HUD, parent)
    if not c then return end
    c:SetActive(true); c:SetVisible(true)
    c:SetSizeDelta(GRID_W * 0.9, 40)
    c:SetAnchoredPosition(0, -GRID_H / 2 - BORDER - 46)
    c.adaptiveFontSize = false
    c.fontSize = 20
    c.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
    c.verticalAlignment = Enum.TextVerticalAlignment.Middle
    c.bgColor = Color.FromRGBA(0, 0, 0, 0)
    local dev = game.GetDevice()
    if dev == Enum.Device.Mobile or dev == Enum.Device.MobileController then
        c.text = "滑动棋盘任意方向    P 重开"
    else
        c.text = "方向键 / WASD / 鼠标拖拽    P 重开"
    end
    setTxtColor(c, COLOR_HINT)
end


-- ---------- 六、HUD 刷新 ----------
local function refreshHUD()
    if not hudCtrl or not hudCtrl.alive then return end
    if phase == "over" then
        hudCtrl.text = "游戏结束 " .. score .. "\n最高 " .. best
    else
        hudCtrl.text = "分数 " .. score .. "\n最高 " .. best
    end
end


-- ---------- 七、方块 ----------
local function createBlock(r, c, value)
    local parent = script.object
    if not parent or not parent.alive then return nil end

    local x, y = cellPos(r, c)
    local img = make(PREFAB_TILE, parent)
    if not img then return nil end
    img:SetActive(true); img:SetVisible(true)
    img:SetSizeDelta(CELL, CELL)
    img:SetAnchoredPosition(x, y)
    img:SetImage(Enum.ImageSource.StaticReference, ASSET_ROUND)
    img.imageType = Enum.ImageType.Stretch

    local txt = make(PREFAB_HUD, parent)
    if not txt then
        kill(img)
        return nil
    end
    txt:SetActive(true); txt:SetVisible(true)
    txt:SetSizeDelta(CELL, CELL)
    txt:SetAnchoredPosition(x, y)
    txt.adaptiveFontSize = false
    txt.fontSize = fontForValue(value)
    txt.horizontalAlignment = Enum.TextHorizontalAlignment.Middle
    txt.verticalAlignment = Enum.TextVerticalAlignment.Middle
    txt.bgColor = Color.FromRGBA(0, 0, 0, 0)

    local st = styleOf(value)
    setImgColor(img, st[1])
    setTxtColor(txt, st[2])
    txt.text = tostring(value)

    local b = { value = value, r = r, c = c, img = img, txt = txt }
    grid[r][c] = b
    blocks[#blocks + 1] = b
    return b
end

local function destroyBlock(b)
    if not b then return end
    kill(b.img)
    kill(b.txt)
    for i = #blocks, 1, -1 do
        if blocks[i] == b then
            table.remove(blocks, i)
            break
        end
    end
end

-- 新块弹出：0 → 1，带弹性
local function popBlock(b)
    if not b then return end
    if b.img and b.img.alive then b.img:SetLocalScale(0, 0, 1) end
    if b.txt and b.txt.alive then b.txt:SetLocalScale(0, 0, 1) end
    tweenGroup({ b.img, b.txt },
        { localScaleX = 1, localScaleY = 1 },
        POP_TIME, Enum.EaseType.OutBack, nil)
end

-- 合并脉冲：1 → 1.15 → 1
local function pulseBlock(b)
    if not b then return end
    local ctrls = { b.img, b.txt }
    tweenGroup(ctrls,
        { localScaleX = 1.15, localScaleY = 1.15 },
        PULSE_UP_TIME, Enum.EaseType.OutQuad, function()
            tweenGroup(ctrls,
                { localScaleX = 1, localScaleY = 1 },
                PULSE_DOWN_TIME, Enum.EaseType.OutBack, nil)
        end)
end


-- ---------- 八、游戏逻辑 ----------
local function resetGrid()
    grid = {}
    for r = 1, N do grid[r] = {} end
end

local function spawnBlock()
    local empty = {}
    for r = 1, N do
        for c = 1, N do
            if grid[r][c] == nil then
                empty[#empty + 1] = { r, c }
            end
        end
    end
    if #empty == 0 then return end
    local p = empty[math.random(#empty)]
    local value = (math.random() < 0.9) and 2 or 4
    local b = createBlock(p[1], p[2], value)
    if b then popBlock(b) end
    -- 保持滑动检测层在最上面
    if swipeCtrl and swipeCtrl.alive then
        swipeCtrl:SetAsLastSibling()
    end
end

local function canMove()
    for r = 1, N do
        for c = 1, N do
            local b = grid[r][c]
            if b == nil then return true end
            if r < N and grid[r+1][c] and grid[r+1][c].value == b.value then
                return true
            end
            if c < N and grid[r][c+1] and grid[r][c+1].value == b.value then
                return true
            end
        end
    end
    return false
end

-- 前向声明
local finalizeMove

-- 移动动画：每个块从旧位置滑到新位置
local function playMoveAnim(moves, merges, destroys)
    local dur = (#inputQueue > 0) and FAST_MOVE_TIME or MOVE_TIME
    local pending = 0
    for _ = 1, #moves do pending = pending + 2 end  -- img + txt
    if pending == 0 then
        finalizeMove(merges, destroys)
        return
    end
    local function oneDone()
        pending = pending - 1
        if pending <= 0 then finalizeMove(merges, destroys) end
    end
    for _, m in ipairs(moves) do
        local x, y = cellPos(m.r, m.c)
        for _, ctrl in ipairs({ m.block.img, m.block.txt }) do
            if ctrl and ctrl.alive then
                local t = game.Tween(ctrl,
                    { anchoredPositionX = x, anchoredPositionY = y }, dur)
                t:SetEase(Enum.EaseType.OutQuad)
                trackTween(t, oneDone)
            else
                oneDone()
            end
        end
    end
end

-- 移动动画结束后的收尾
finalizeMove = function(merges, destroys)
    -- 对齐所有块（保险）
    for _, b in ipairs(blocks) do
        local x, y = cellPos(b.r, b.c)
        if b.img and b.img.alive then b.img:SetAnchoredPosition(x, y) end
        if b.txt and b.txt.alive then b.txt:SetAnchoredPosition(x, y) end
    end
    -- 销毁被合并掉的块
    for _, d in ipairs(destroys) do destroyBlock(d) end
    -- 更新合并后的块外观 + 脉冲
    for _, b in ipairs(merges) do
        local st = styleOf(b.value)
        setImgColor(b.img, st[1])
        setTxtColor(b.txt, st[2])
        if b.txt and b.txt.alive then
            b.txt.text = tostring(b.value)
            b.txt.fontSize = fontForValue(b.value)   -- 数字变大时重算字号
        end
        pulseBlock(b)
    end
    -- 生成新块
    spawnBlock()
    if score > best then best = score end
    refreshHUD()
    if not canMove() then
        phase = "over"
        refreshHUD()
    end
    busy = false
    moveCooldown = (#inputQueue > 0) and 0.02 or 0.06
end

-- 尝试一次移动
local function handleMove(dir)
    if phase ~= "play" or busy or moveCooldown > 0 then return end

    local moves, merges, destroys = {}, {}, {}
    local moved = false

    for i = 1, N do
        -- 沿这条线取出所有块（按移动方向排好序）
        local line = {}
        for j = 1, N do
            local r, c = lineCell(dir, i, j)
            local b = grid[r][c]
            if b then line[#line + 1] = b end
        end
        -- 清空这条线
        for j = 1, N do
            local r, c = lineCell(dir, i, j)
            grid[r][c] = nil
        end

        -- 相邻相同则合并
        local result = {}
        local k = 1
        while k <= #line do
            local cur = line[k]
            local nxt = line[k + 1]
            if nxt and cur.value == nxt.value then
                result[#result + 1] = {
                    block = cur, value = cur.value * 2, eaten = nxt
                }
                destroys[#destroys + 1] = nxt
                k = k + 2
            else
                result[#result + 1] = { block = cur, value = cur.value }
                k = k + 1
            end
        end

        -- 放回格子
        for idx, item in ipairs(result) do
            local r, c = lineCell(dir, i, idx)
            local b = item.block

            -- 被吃掉的块也要先滑到合并位置（做动画），之后再销毁
            if item.eaten then
                local eb = item.eaten
                eb.r, eb.c = r, c
                moves[#moves + 1] = { block = eb, r = r, c = c }
                moved = true
            end
            -- 主块移动
            if b.r ~= r or b.c ~= c then
                moves[#moves + 1] = { block = b, r = r, c = c }
                moved = true
            end
            b.r, b.c = r, c
            grid[r][c] = b

            if item.eaten then
                b.value = item.value
                merges[#merges + 1] = b
                score = score + item.value
                moved = true
            end
        end
    end

    if not moved then return end
    busy = true
    playMoveAnim(moves, merges, destroys)
end

local function restart()
    killAllTweens()
    local copy = {}
    for i = 1, #blocks do copy[i] = blocks[i] end
    for _, b in ipairs(copy) do destroyBlock(b) end

    resetGrid()
    score = 0
    phase = "play"
    busy = false
    moveCooldown = 0
    inputQueue = {}
    swipeTouchId = nil

    spawnBlock()
    spawnBlock()
    refreshHUD()
end


-- ---------- 九、输入 ----------
local function enqueueMove(dir)
    if phase ~= "play" then return end
    local n = #inputQueue
    if n > 0 and inputQueue[n] == dir then return end
    inputQueue[#inputQueue + 1] = dir
end

-- 滑动按下
local function onSwipeDown(event)
    if phase ~= "play" or swipeTouchId ~= nil then return end
    local x, y = event:GetUIPos()
    swipeTouchId = event.touchId
    swipeStartX, swipeStartY = x, y
end

-- 滑动抬起（或离开、结束拖动）
local function onSwipeUp(event)
    if swipeTouchId == nil then return end
    if swipeTouchId ~= event.touchId then return end
    local x, y = event:GetUIPos()
    swipeTouchId = nil

    local dx = x - swipeStartX
    local dy = y - swipeStartY
    local thr = math.max(24, math.min(W, H) * SWIPE_MIN_RATIO)
    if math.abs(dx) < thr and math.abs(dy) < thr then return end

    local dir
    if math.abs(dx) > math.abs(dy) then
        dir = (dx > 0) and 3 or 1
    else
        dir = (dy > 0) and 2 or 4
    end
    enqueueMove(dir)
end

local function bindSwipeInput()
    local parent = script.object
    if not parent or not parent.alive then return end
    if parent.showCursor ~= nil then parent.showCursor = true end

    if not PREFAB_TOUCH or PREFAB_TOUCH <= 0 then
        return
    end
    local area = make(PREFAB_TOUCH, parent)
    if not area then
        return
    end
    area:SetActive(true); area:SetVisible(true)
    area:SetSizeDelta(W, H)
    area:SetAnchoredPosition(0, 0)
    if area.raycastTarget ~= nil then area.raycastTarget = true end
    area:SetAsLastSibling()

    local ok = pcall(function()
        area:AddCursorEventListener(Enum.CursorEventType.CursorDown,     onSwipeDown)
        area:AddCursorEventListener(Enum.CursorEventType.CursorUp,       onSwipeUp)
        area:AddCursorEventListener(Enum.CursorEventType.CursorEndDrag,  onSwipeUp)
        area:AddCursorEventListener(Enum.CursorEventType.CursorExit,     onSwipeUp)
    end)
    if not ok then
        return
    end
    swipeCtrl = area
end

local keyHandlers = {}

local function bindInput()
    if next(keyHandlers) ~= nil then return end
    local parent = script.object
    if not parent or not parent.alive then return end

    local function bind(key, dir)
        keyHandlers[key] = function()
            enqueueMove(dir)
            return true
        end
        parent:AddKeyEventListener(key, keyHandlers[key])
    end

    bind(Enum.KeyEventType.KeyboardMoveLeftKeyDown,       1)
    bind(Enum.KeyEventType.KeyboardMoveRightKeyDown,      3)
    bind(Enum.KeyEventType.KeyboardMoveForwardKeyDown,    2)
    bind(Enum.KeyEventType.KeyboardMoveBackwardKeyDown,   4)
    bind(Enum.KeyEventType.KeyboardCraftspersonKey36Down, 2)  -- ↑
    bind(Enum.KeyEventType.KeyboardCraftspersonKey37Down, 4)  -- ↓
    bind(Enum.KeyEventType.KeyboardCraftspersonKey38Down, 1)  -- ←
    bind(Enum.KeyEventType.KeyboardCraftspersonKey39Down, 3)  -- →

    keyHandlers[Enum.KeyEventType.KeyboardCraftspersonKey18Down] = function()
        restart()
        return true
    end
    parent:AddKeyEventListener(Enum.KeyEventType.KeyboardCraftspersonKey18Down,
        keyHandlers[Enum.KeyEventType.KeyboardCraftspersonKey18Down])
end


-- ---------- 十、生命周期 ----------
function OnStart()
    script:EnableUpdate(true)
    layoutCanvas()
    createBackground()
    createBoardBase()
    if not createEmptyCells() then
        return
    end
    createTitle()
    createScoreBox()
    createHint()
    bindInput()
    bindSwipeInput()

    resetGrid()
    spawnBlock()
    spawnBlock()
    phase = "play"
    refreshHUD()
end

function OnUpdate(dt)
    if moveCooldown > 0 then
        moveCooldown = moveCooldown - dt
        if moveCooldown < 0 then moveCooldown = 0 end
    end
    if not busy and moveCooldown <= 0 and #inputQueue > 0 then
        local dir = table.remove(inputQueue, 1)
        handleMove(dir)
    end
end

function OnDestroy()
    for k, h in pairs(keyHandlers) do
        if script.object and script.object.alive then
            pcall(function() script.object:RemoveKeyEventListener(k, h) end)
        end
    end
    keyHandlers = {}

    if swipeCtrl and swipeCtrl.alive then
        pcall(function()
            swipeCtrl:RemoveCursorEventListener(Enum.CursorEventType.CursorDown,    onSwipeDown)
            swipeCtrl:RemoveCursorEventListener(Enum.CursorEventType.CursorUp,      onSwipeUp)
            swipeCtrl:RemoveCursorEventListener(Enum.CursorEventType.CursorEndDrag, onSwipeUp)
            swipeCtrl:RemoveCursorEventListener(Enum.CursorEventType.CursorExit,    onSwipeUp)
        end)
    end
    swipeCtrl = nil
    killAllTweens()
end