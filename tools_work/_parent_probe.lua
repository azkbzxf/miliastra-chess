function OnStart()
    print("typeof(script.object)=", tostring(typeof(script.object)))
    print("script.object=", tostring(script.object))
    local a = game.InstantiateClientUIControl(1, nil)
    print("parent=nil -> ", tostring(a))
    local b = game.InstantiateClientUIControl(1, script.object)
    print("parent=script.object -> ", tostring(b))
    if a then a:SetActive(true) end
    if b then b:SetActive(true) end
end
function OnUpdate(dt) end
