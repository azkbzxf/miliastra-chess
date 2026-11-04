-- annotations.lua · 接口标注文件（本项目唯一接口依据）
-- 生成时间：2026-10-31 11:20 (Asia/Shanghai)
-- 来源文档：C:\Users\24037\Downloads\MiliastraAgent\release\Lua客户端控件API文档.md
--   sha256 = 771a94faacfa32a8855bfb28a60484f8f0e09b3b0907971612a2441ac3d482ba
-- 编辑器指南：C:\Users\24037\Downloads\MiliastraAgent\release\客户端控件及脚本使用指南.md
--   sha256 = bf1a59eb5e35d0485deca8cdae6f810b0d839e4fa285c918a3040a0ba7e94117
--
-- 用途：编码与语法检查都以此为准。文档中途被替换时，本文件全部结论作废重核。
-- 说明：本文件只登记本项目**实际用到**的接口；每条都注明来源行号区间。

return {
  -- ============ 运行环境（文档 L49-67） ============
  env = {
    lua_version = "5.3",
    unavailable_stdlib = { "string.dump", "io.*", "coroutine.*",
      "os.* (仅 os.time/os.date/os.clock/os.difftime 可用)", "debug.* (仅 debug.traceback 可用)" },
    extra_math = { "math.isnan", "math.isinf" },
  },

  -- ============ 生命周期（文档 L71-84） ============
  lifecycle = { "OnInit", "OnStart", "OnEnable", "OnUpdate(dt)", "OnLevelUpdate(dt)", "OnDisable", "OnDestroy" },

  -- ============ 全局 ============
  globals = {
    script = "Script 实例（文档 L121）",
    Enum   = "枚举表（文档 L122）",
    typeof = "typeof(value) -> string（文档 L97）",
    print  = "print(...) 普通日志，不阻断（文档 L103）",
    printerr = "printerr(...) 错误日志，不抛错（文档 L104）",
    debug_traceback = "debug.traceback([msg[,level]]) -> string（文档 L105）",
    Color  = "Color(r,g,b,a?) / Color.FromRGB / Color.FromRGBA / Color.ToRGBA（文档 L130-138）",
  },

  -- ============ Script 方法与字段（文档 L148-164） ============
  script = {
    fields = { alive = "只读 boolean", scriptMappingId = "只读 integer", object = "只读 any 宿主对象",
               path = "只读 string", enabled = "读写 boolean" },
    methods = {
      EnableUpdate = "script:EnableUpdate(enabled: boolean)（文档 L89, L160）",
      RegisterServerSignalHandler = "script:RegisterServerSignalHandler(signalName, callback(signalName, signalParams))（文档 L161）",
      UnregisterServerSignalHandler = "script:UnregisterServerSignalHandler(signalName)（文档 L162）",
      GetParam = "script:GetParam(paramName) -> any（文档 L158）",
      Invoke = "script:Invoke(funcName, ...)（文档 L159）",
      RegisterCustomVariableChangedHandler = "（文档 L163）",
      UnregisterCustomVariableChangedHandler = "（文档 L164）",
    },
  },

  -- ============ game（文档 L166-215） ============
  game = {
    InstantiateClientUIControl = "game.InstantiateClientUIControl(controlPrefabIndex: integer, parent) -> ClientUIBaseControl（文档 L174）",
    DestroyClientUIControl     = "game.DestroyClientUIControl(control)（文档 L175）",
    GetClientUIControl         = "game.GetClientUIControl(controlId) -> control（文档 L176）",
    FindClientUIRoot           = "game.FindClientUIRoot(nodeName) -> control（文档 L177）",
    GetClientUIRoots           = "game.GetClientUIRoots() -> control[]（文档 L178）",
    GetUICanvasSize            = "game.GetUICanvasSize() -> x, y（文档 L179）",
    GetCursorUIPos             = "game.GetCursorUIPos() -> x, y（文档 L180）",
    GetDevice                  = "game.GetDevice() -> Enum.Device（文档 L188）",
    SetControllerFocus         = "game.SetControllerFocus(control)（文档 L189）",
    GetControllerFocus         = "game.GetControllerFocus()（文档 L190）",
    Tween                      = "game.Tween(object, tweenDataTable, duration) -> Tween（文档 L198）",
    TweenSequence              = "game.TweenSequence() -> TweenSequence（文档 L199）",
    ServerSignal               = "game.ServerSignal(signalName) -> ServerSignal（文档 L200）",
    GetGlobalCustomVariableValue = "（文档 L201）",
    PauseLevelTime             = "game.PauseLevelTime(pause)（文档 L207）",
    IsLevelTimePaused          = "game.IsLevelTimePaused()（文档 L208）",
    PlayAudio2D                = "game.PlayAudio2D(audioId) -> instanceId（文档 L209）",
    StopAudio                  = "（文档 L210）",
    IsAudioAlive               = "（文档 L211）",
    GetLanguageType            = "（文档 L212）",
    GetStageMode               = "（文档 L213）",
    IsTestPlay                 = "（文档 L214）",
    GetText                    = "game.GetText(textMapId) -> string（文档 L215）",
    PrintClientUITree          = "game.PrintClientUITree()（文档 L106）",
  },

  -- ============ ServerSignal（文档 L273-306） ============
  server_signal = {
    methods = { SendSignal = "ServerSignal:SendSignal()（文档 L288）",
      AddInt = "AddInt(intValue)（L289）", AddIntList = "L290", AddFloat = "L291", AddFloatList = "L292",
      AddString = "L293", AddStringList = "L294", AddVector3 = "L295", AddVector3List = "L296",
      AddBool = "L297", AddBoolList = "L298", AddGuid = "L299", AddGuidList = "L300",
      AddEntity = "L301", AddEntityList = "L302", AddPrefabId = "L303", AddPrefabIdList = "L304",
      AddConfigId = "L305", AddConfigIdList = "L306", AddParam = "AddParam(paramType, paramValue)（L287）" },
  },

  -- ============ ClientUIBaseControl（文档 L606-701） ============
  base_control = {
    fields_readonly = { alive = "L614", id = "L615", prefabIndex = "L616", active = "L617（默认 false）",
      activeInHierarchy = "L618", visible = "L619",
      anchoredPositionX = "L622 读写 Tweenable", anchoredPositionY = "L622",
      sizeDeltaX = "L623 读写 Tweenable", sizeDeltaY = "L623",
      anchorMinX = "L624", anchorMinY = "L624", anchorMaxX = "L625", anchorMaxY = "L625",
      pivotX = "L626", pivotY = "L626",
      localScaleX = "L627", localScaleY = "L627", localScaleZ = "L627",
      localRotationX = "L628", localRotationY = "L628", localRotationZ = "L628",
      canControllerFocus = "L629 读写" },
    fields_writable = { name = "L620 读写", parent = "L621 读写" },
    methods = {
      GetChildren = "GetChildren() -> control[]（L637）",
      GetChild = "GetChild(name) -> control（L638）",
      FindChild = "FindChild(path) -> control（L639）",
      SetActive = "SetActive(active)（L640）",
      SetVisible = "SetVisible(visible)（L641）",
      GetSiblingIndex = "L642", SetSiblingIndex = "SetSiblingIndex(index) -> boolean（L643）",
      SetAsFirstSibling = "L644", SetAsLastSibling = "L645",
      GetAnchoredPosition = "GetAnchoredPosition() -> x,y（L653）",
      SetAnchoredPosition = "SetAnchoredPosition(x,y)（L654）",
      GetSizeDelta = "GetSizeDelta() -> x,y（L655）", SetSizeDelta = "SetSizeDelta(x,y)（L656）",
      GetAnchorMin = "L657", SetAnchorMin = "SetAnchorMin(x,y)（L658）",
      GetAnchorMax = "L659", SetAnchorMax = "SetAnchorMax(x,y)（L660）",
      GetPivot = "L661", SetPivot = "SetPivot(x,y)（L662）",
      GetLocalScale = "L663", SetLocalScale = "SetLocalScale(x,y,z)（L664）",
      GetLocalRotation = "L665", SetLocalRotation = "SetLocalRotation(x,y,z)（L666）",
      GetScriptByPath = "L674", GetScript = "L675", GetScripts = "L676",
      AddKeyEventListener = "AddKeyEventListener(eventType, callback) -> boolean（L682）",
      RemoveKeyEventListener = "RemoveKeyEventListener(eventType, callback)（L683）",
      RemoveKeyEventListeners = "L684", RemoveAllKeyEventListeners = "L685",
      AddNavigationEventListener = "L691", RemoveNavigationEventListener = "L692",
      RemoveNavigationEventListeners = "L693", RemoveAllNavigationEventListeners = "L694",
      SetControllerNavigation = "L700", GetControllerNavigation = "L701",
    },
  },

  -- ============ ClientUITextBoxControl（文档 L743-760） ============
  -- 本项目把它当「色块 + 文字」两用：text="" 时 bgColor 即色块
  text_box = {
    fields = { text = "L751 读写", fontSize = "L752 读写 Tweenable", fontColor = "L753 读写 Tweenable",
      bgColor = "L754 读写 Tweenable", enableOutline = "L755", outlineColor = "L756",
      horizontalAlignment = "L757", verticalAlignment = "L758",
      adaptiveFontSize = "L759", minimumFontSize = "L760 Tweenable" },
  },

  -- ============ ClientUICursorEventAreaControl（文档 L805-823） ============
  cursor_area = {
    fields = { raycastTarget = "L813 读写" },
    methods = { AddCursorEventListener = "AddCursorEventListener(eventType, callback(data))（L819）",
      RemoveCursorEventListener = "L820", RemoveCursorEventListeners = "L821",
      RemoveAllCursorEventListeners = "L822", SimulateCursorClick = "L823" },
  },

  -- ============ ClientUIPresetButtonControl（文档 L783-803） ============
  preset_button = {
    fields = { interactable = "L790 读写", clickAudioId = "L791 读写", raycastTarget = "L792 读写" },
    methods = { AddCursorEventListener = "L799", RemoveCursorEventListener = "L800",
      RemoveCursorEventListeners = "L801", RemoveAllCursorEventListeners = "L802",
      SimulateCursorClick = "L803" },
  },

  -- ============ ClientUIContainerControl（文档 L915-926） ============
  container = {
    fields = { isolateNavigation = "L923 读写", disableKeyEventPassthrough = "L924 读写",
      disableCursorEventPassthrough = "L925 读写", showCursor = "L926 读写（CursorEvent 相关必须先设为真）" },
  },

  -- ============ ClientUIImageControl（文档 L703-741） ============
  -- 本项目**不依赖**图片控件（无素材编号）；仅作备选登记
  image = {
    fields = { imageSource = "L711 只读", imageId = "L712 只读", imageColor = "L713 读写 Tweenable",
      imageType = "L714 读写", enableMask = "L715", enableSoftEdge = "L716",
      softEdgeMode = "L717", softEdgeWidthX = "L718", softEdgeWidthY = "L719",
      horizontalSoftRange = "L720", verticalSoftRange = "L721", reverseMaskArea = "L722",
      fillType = "L723", fillHorizontalType = "L724", fillVerticalType = "L725",
      fillRadial90Type = "L726", fillRadialType = "L727", fillAmount = "L728 读写 Tweenable" },
    methods = { SetImage = "SetImage(imageSource, imageId)（L734）", SetSoftEdgeWidth = "L735",
      SetFillUnused = "L736", SetFillHorizontal = "L737", SetFillVertical = "L738",
      SetFillRadial90 = "L739", SetFillRadial180 = "L740", SetFillRadial360 = "L741" },
  },

  -- ============ 枚举（文档 L318-585, L938-1201） ============
  enums = {
    CursorEventType = { "CursorDown", "CursorUp", "CursorEnter", "CursorExit", "CursorDrag",
      "CursorBeginDrag", "CursorEndDrag", "CursorClick" }, -- L424-435
    -- 【兼容登记】体外沙箱把该枚举定义为 Click（见 tools/sandbox/qx-sandbox.js L47），
    -- 真机文档里叫 CursorClick（L435）。代码用
    --   Enum.CursorEventType.CursorClick or Enum.CursorEventType.Click
    -- 双路取值，两边都能跑。这两个名字都是合法取值，不是拼写错误。
    TextHorizontalAlignment = { "Left", "Middle", "Right" },   -- L493-499
    TextVerticalAlignment = { "Top", "Middle", "Bottom" },     -- L501-507
    Device = { "KeyboardAndMouse", "Mobile", "Controller", "MobileController" }, -- L364-371
    StageMode = { "Beyond", "Classic" },                        -- L373-378
    LanguageType = { "LanguageNone", "LanguageEng", "LanguageChs", "LanguageCht", ... }, -- L380-399
    EaseType = { "Linear", "InSine", ..., "InOutBounce" },      -- L320-354
    ControllerNavigationDir = { "Up", "Down", "Left", "Right" },-- L459-466
    ControllerNavigationMode = { "None", "NearestControl", "Specified" }, -- L485-491
    ControllerNavigationEventType = { "Confirm", "Cancel", "Focus", "LostFocus", ... }, -- L468-483
    ImageSource = { "StaticReference", "Item", "Equipment", "Skill", "UnitStatus", "Faction", ... }, -- L516-528
    ImageType = { "Basic", "Stretch" },                         -- L509-514
    KeyEventType = { "KeyboardCraftspersonKey1Down"..., "KeyboardNormalAttackKeyDown",
      "ControllerCraftspersonKey1Down"..., "ControllerMenuConfirmKeyDown" }, -- L1034-1201
    KeyboardKeyCode = { "CraftspersonKey1"..., "MoveForwardKey", "JumpKey", "NormalAttackKey", "None" }, -- L940-1002
    ControllerKeyCode = { "CraftspersonKey1"..., "MenuConfirmKey", "MenuBackKey", "None" }, -- L1004-1032
    ParamType = { "Entity", "Int", "Bool", "Float", "String", "Guid", "ConfigId", "PrefabId", ... }, -- L401-422
    CustomVariableEntityType = { "Level", "PlayerSelf", "AvatarSelf" }, -- L356-362
  },

  -- ============ 本项目 CONFIG 占位（待用户提供真实值） ============
  -- 集中放在一处，代码里只引用这里的常量名，不散写数字
  config_placeholders = {
    CONTAINER_NODE_INDEX = 0,   -- 待用户提供：容器节点索引
    SCRIPT_SHORT_NAME    = "levelScript", -- 待用户确认：实际挂载的脚本名称
    PREFAB_TEXT_BOX      = 0,   -- 待用户提供：文本框模板索引
    PREFAB_CURSOR_AREA   = 0,   -- 待用户提供：光标检测区域模板索引
    PREFAB_CONTAINER     = 0,   -- 待用户提供：容器模板索引（如需要子容器）
    PREFAB_PRESET_BUTTON = 0,   -- 待用户提供：预设按钮模板索引（如用四态按钮）
  },

  -- ============ 已核对但明确未文档化的能力（记为未确认，不得使用） ============
  not_documented = {
    "服务端节点图 / 服务端 Lua 接口：不在本包任何文档内",
    "游戏内计时器 / 延时 / 协程：文档未提供，禁止使用（coroutine.* 也不可用）",
    "模块 require 路径规则：文档未声明，故交付单文件版本",
    "玩家序号 / 玩家身份获取：客户端文档未提供",
    "字符串中文字体渲染：文档未声明字体支持范围",
    "Text 控件的自动换行：文档未声明，长文本需自己按字符数断行",
  },
}
