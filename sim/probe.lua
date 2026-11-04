-- =============================================================================
--  sim/probe.lua · 千星模拟器能力探针（不属于交付物，只为确定 API 可用性）
-- =============================================================================
local function tp(v) return tostring(type(v)) end
local function dump(name, tbl)
  if tbl == nil then print("PROBE " .. name .. " nil") return end
  local keys = {}
  for k, v in pairs(tbl) do keys[#keys + 1] = tostring(k) .. ":" .. tp(v) end
  table.sort(keys)
  print("PROBE " .. name .. " [" .. table.concat(keys, ",") .. "]")
end

function OnInit() print("PROBE OnInit") end

function OnStart()
  print("PROBE OnStart version=" .. tostring(_VERSION))
  dump("game", game)
  dump("script", script)
  print("PROBE script.object type=" .. tp(script.object) .. " name=" .. tostring(script.object and script.object.name))
  dump("Enum", Enum)
  if Enum ~= nil then
    dump("Enum.TextHorizontalAlignment", Enum.TextHorizontalAlignment)
    dump("Enum.TextVerticalAlignment", Enum.TextVerticalAlignment)
    dump("Enum.CursorEventType", Enum.CursorEventType)
    dump("Enum.ImageSource", Enum.ImageSource)
    dump("Enum.ImageType", Enum.ImageType)
  end
  dump("Color", Color)

  local ok, w, h = pcall(function() return game.GetUICanvasSize() end)
  print("PROBE canvas ok=" .. tostring(ok) .. " w=" .. tostring(w) .. " h=" .. tostring(h))

  -- 候选模板索引：n1 容器 1073742100 / n2 模板内文本框 1073742101 /
  --                n12 独立文本框模板 1073742110 / n13 独立光标模板 1073742106
  local cands = { 1073742100, 1073742101, 1073742110, 1073742106 }
  for _, idx in ipairs(cands) do
    local okc, res = pcall(function() return game.InstantiateClientUIControl(idx, script.object) end)
    print("PROBE inst idx=" .. idx .. " ok=" .. tostring(okc) .. " res=" .. tp(res) ..
      " kind=" .. tostring(res and res.kind) .. " name=" .. tostring(res and res.name))
    if okc and res ~= nil then
      pcall(function() res:SetPivot(0, 0) end)
      pcall(function() res:SetAnchorMin(0, 0) end)
      pcall(function() res:SetAnchorMax(0, 0) end)
      pcall(function() res:SetSizeDelta(260, 90) end)
      pcall(function() res:SetAnchoredPosition(120, 120 + (#cands) * 0) end)
      pcall(function() res.text = "idx=" .. idx end)
      pcall(function() res.fontSize = 34 end)
      if Color ~= nil then pcall(function() res.bgColor = Color.FromRGBA(160, 30, 30, 255) end) end
      pcall(function() res:SetActive(true) end)
      pcall(function() res:SetVisible(true) end)
      print("PROBE inst idx=" .. idx .. " after-set text=" .. tostring(res.text) ..
        " fontSize=" .. tostring(res.fontSize))
    end
  end

  -- 光标检测区域探针：能否收到点击
  local ok4, cur = pcall(function() return game.InstantiateClientUIControl(1073742106, script.object) end)
  print("PROBE cursor ok=" .. tostring(ok4) .. " res=" .. tp(cur))
  if ok4 and cur ~= nil then
    pcall(function() cur:SetPivot(0, 0) end)
    pcall(function() cur:SetAnchorMin(0, 0) end)
    pcall(function() cur:SetAnchorMax(0, 0) end)
    pcall(function() cur:SetSizeDelta(200, 200) end)
    pcall(function() cur:SetAnchoredPosition(600, 300) end)
    pcall(function() cur:SetActive(true) end)
    pcall(function() cur:SetVisible(true) end)
    local evName = nil
    if Enum ~= nil and Enum.CursorEventType ~= nil then
      evName = Enum.CursorEventType.CursorClick or Enum.CursorEventType.Click
    end
    print("PROBE cursor event=" .. tostring(evName))
    if evName ~= nil then
      local okr, err = pcall(function()
        cur:AddCursorEventListener(evName, function(data)
          print("PROBE CLICK x=" .. tostring(data and data.x) .. " y=" .. tostring(data and data.y))
        end)
      end)
      print("PROBE cursor addlistener ok=" .. tostring(okr) .. " err=" .. tostring(err))
    end
    pcall(function() cur.raycastTarget = true end)
  end
  print("PROBE_END")
end

function OnUpdate(dt) end
function OnDestroy() print("PROBE OnDestroy") end
