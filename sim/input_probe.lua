-- =============================================================================
--  sim/input_probe.lua · 交互探针：直接驱动真实脚本的选择/走子逻辑
--  目的：区分「输入没到」还是「走子逻辑有问题」
-- =============================================================================
local IMAGE_PREFAB_ID = 1073742107
local created = {}
local function mk(asset, x, y, w, h, rot, color)
  local c = game.InstantiateClientUIControl(IMAGE_PREFAB_ID, script.object)
  if c == nil then return nil end
  c:SetPivot(0.5, 0.5)
  c:SetAnchorMin(0, 0); c:SetAnchorMax(0, 0)
  c:SetSizeDelta(w, h); c:SetAnchoredPosition(x, y)
  pcall(function() c:SetImage(Enum.ImageSource.StaticReference, asset) end)
  c.imageColor = Color.FromRGBA(color[1], color[2], color[3], color[4])
  if rot ~= 0 then pcall(function() c:SetLocalRotation(0, 0, rot) end) end
  c:SetActive(true); c:SetVisible(true)
  created[#created + 1] = c
  return c
end

function OnStart()
  print("IPROBE start")

  -- ① 点 e2 兵（sq = 6*8+4 = 52），看点击回调到底有没有进来
  local hit = nil
  -- 复用游戏脚本的 64 个 hit 区域不方便，直接自己建一个 e2 的检测区
  local c = game.InstantiateClientUIControl(1073742106, script.object)
  if c ~= nil then
    c:SetPivot(0.5, 0.5)
    c:SetAnchorMin(0, 0); c:SetAnchorMax(0, 0)
    c:SetSizeDelta(100, 100)
    c:SetAnchoredPosition(800, 450)
    pcall(function() c.raycastTarget = true end)
    c:SetActive(true); c:SetVisible(true)
    created[#created + 1] = c
    local ev = Enum.CursorEventType.CursorClick
    if ev == nil then ev = Enum.CursorEventType.Click end
    print("IPROBE ev=" .. tostring(ev))
    local ok, err = pcall(function()
      c:AddCursorEventListener(ev, function(data)
        print("IPROBE CLICK FIRED x=" .. tostring(data and data.x) ..
              " y=" .. tostring(data and data.y))
      end)
    end)
    print("IPROBE addlistener ok=" .. tostring(ok) .. " err=" .. tostring(err))
  else
    print("IPROBE cursor nil")
  end

  mk(100002, 800, 450, 120, 120, 0, { 250, 120, 60, 255 })
  print("IPROBE_END")
end

function OnUpdate(dt) end
function OnDestroy()
  for i = #created, 1, -1 do pcall(function() game.DestroyClientUIControl(created[i]) end) end
end
