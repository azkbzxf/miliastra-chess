// tools_work/_demo_run_check.cjs  (临时自检脚本，可删)
// 目的：在 Node 里用最小 DOM shim 真跑一遍 proto/chess_demo.html 的内联 JS，
// 抓「语法过了但运行期炸」的问题（未定义变量 / TDZ / 方法不存在 / 配色键缺失）。
// 只验证逻辑与样式写入，不验证真实渲染像素。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const htmlPath = path.join(__dirname, "..", "proto", "chess_demo.html");
const html = fs.readFileSync(htmlPath, "utf8");

// ---------- 最小 DOM ----------
const allElements = [];
function mkClassList(el) {
  const set = new Set();
  return {
    _set: set,
    add(c) { set.add(c); el._classDirty = true; },
    remove(c) { set.delete(c); el._classDirty = true; },
    contains(c) { return set.has(c); },
    toggle(c, on) {
      if (on === undefined) { if (set.has(c)) set.delete(c); else set.add(c); }
      else if (on) set.add(c); else set.delete(c);
      el._classDirty = true;
    },
  };
}
function mkEl(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    attrs: {},
    textContent: "",
    _listeners: {},
    _classDirty: false,
  };
  el.className = "";
  el.classList = mkClassList(el);
  el.appendChild = (c) => { el.children.push(c); c.childNodes.push(c); c.parentNode = el; return c; };
  el.addEventListener = (ev, fn) => { (el._listeners[ev] = el._listeners[ev] || []).push(fn); };
  el.removeEventListener = (ev, fn) => {
    const a = el._listeners[ev] || [];
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  };
  el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
  el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null);
  // 【shim 补齐 2026-11-05】__selfTest 的 no_glyph_piece_text（18b）断言会遍历
  // slot.el.childNodes 检查有没有残留文字节点（棋符画法已删除的守卫）。
  // 缺这一项会抛 TypeError: slot.el.childNodes is not iterable → 整份自检 FAIL。
  // 只补 shim，不动断言逻辑：childNodes 与 children 保持同一份，语义等价于「只有元素子节点」。
  el.childNodes = el.children;
  el.removeChild = (c) => {
    const i = el.children.indexOf(c);
    if (i >= 0) el.children.splice(i, 1);
    return c;
  };
  el.querySelectorAll = () => [];
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900 });
  el.click = () => { for (const fn of (el._listeners.click || [])) fn({ stopPropagation() {}, preventDefault() {} }); };
  Object.defineProperty(el, "innerHTML", { get() { return ""; }, set() {} });
  allElements.push(el);
  return el;
}

const byId = {
  board: mkEl("div"),
  overlayLayer: mkEl("div"),
  debugLayer: mkEl("div"),
  stage: mkEl("div"),
  viewport: mkEl("div"),
};
byId.stage.style = {};
byId.debugLayer.classList.add = byId.debugLayer.classList.add.bind(byId.debugLayer);

const documentShim = {
  readyState: "complete",
  title: "",
  documentElement: { clientWidth: 1600, clientHeight: 900 },
  getElementById: (id) => byId[id] || (byId[id] = mkEl("div")),
  createElement: (tag) => mkEl(tag),
  addEventListener: () => {},
  querySelectorAll: () => [],
  body: mkEl("body"),
};

// ---------- window / 全局 ----------
const rafQueue = [];
const storage = new Map();
const windowShim = {
  innerWidth: 1600,
  innerHeight: 900,
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  cancelAnimationFrame: () => {},
  setTimeout: (fn) => { /* 不跑定时器：只验证同步启动路径 */ return 0; },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  location: { search: "" },
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => { storage.set(k, String(v)); },
    removeItem: (k) => { storage.delete(k); },
  },
  performance: { now: () => Date.now() },
  // 刻意不提供 AudioContext：验证 SFX 在无 WebAudio 环境下优雅降级
  URLSearchParams: URLSearchParams,
  console: console,
  Math: Math,
  JSON: JSON,
  Object: Object,
  String: String,
  Number: Number,
  Array: Array,
  Map: Map,
  Set: Set,
  Date: Date,
  isNaN: isNaN,
  parseInt: parseInt,
  parseFloat: parseFloat,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  Error: Error,
};
windowShim.window = windowShim;

const sandbox = {
  window: windowShim,
  document: documentShim,
  location: windowShim.location,
  localStorage: windowShim.localStorage,
  performance: windowShim.performance,
  requestAnimationFrame: windowShim.requestAnimationFrame,
  cancelAnimationFrame: windowShim.cancelAnimationFrame,
  setTimeout: windowShim.setTimeout,
  clearTimeout: windowShim.clearTimeout,
  setInterval: windowShim.setInterval,
  clearInterval: windowShim.clearInterval,
  URLSearchParams: URLSearchParams,
  console: console,
  Math: Math, JSON: JSON, Object: Object, String: String, Number: Number,
  Array: Array, Map: Map, Set: Set, Date: Date, Error: Error,
  isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
  encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

// ---------- 抽出两个 script 块并顺序执行 ----------
const blocks = [];
const re = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) blocks.push(m[1]);

let failures = 0;
function fail(msg) { failures++; console.log("RUN_FAIL " + msg); }

for (let i = 0; i < blocks.length; i++) {
  const line = html.slice(0, html.indexOf(blocks[i])).split("\n").length;
  try {
    new vm.Script(blocks[i], { filename: "block#" + (i + 1) + "@line" + line }).runInContext(ctx);
    console.log(`RUN_OK   block#${i + 1} @line ${line}`);
  } catch (e) {
    fail(`block#${i + 1} @line ${line}: ${e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e}`);
  }
}

// ---------- 行为断言（通过 window.__selfTest）----------
let selfTest = null;
try {
  if (typeof sandbox.window.__selfTest === "function") selfTest = sandbox.window.__selfTest();
  else fail("__selfTest 未安装");
} catch (e) {
  fail("__selfTest 抛异常: " + (e && e.stack ? e.stack.split("\n").slice(0, 5).join(" | ") : e));
}

if (selfTest) {
  for (const c of selfTest.checks) {
    if (!c.pass) fail(`自检项 ${c.name} 失败 ${c.detail || ""}`);
  }
  console.log(`\n__selfTest: ${selfTest.ok ? "PASS" : "FAIL"}  (${selfTest.checks.length} 项, ${selfTest.checks.filter(c => !c.pass).length} 项失败)`);
}

// ---------- 走子动画 / SFX 冒烟 ----------
console.log("\n--- 冒烟：模拟点击 e2→e4，检查补间与 SFX 状态 ---");
try {
  // 通过 DOM 命中区点击，走真实 handler 路径
  const hit12 = allElements.find(el => el.attrs["data-anchor-id"] === "hit_12");
  const hit28 = allElements.find(el => el.attrs["data-anchor-id"] === "hit_28");
  if (!hit12 || !hit28) fail("找不到 hit_12 / hit_28 命中区");
  else {
    hit12.click(); hit28.click();
    const sfxBtn = allElements.find(el => el.attrs["data-anchor-id"] === "sfxtoggle");
    if (!sfxBtn) fail("找不到音效开关按钮 sfxtoggle");
    else console.log(`去抖: 音效按钮文案 = "${sfxBtn.textContent}"`);
    // 检查棋子槽是否被写了 transform（补间起动证据）
    const transformed = allElements.filter(el => el.style && typeof el.style.transform === "string" && el.style.transform.indexOf("translate(") === 0);
    if (transformed.length === 0) fail("走子后没有任何元素带出起点位移动画（补间未启动）");
    else console.log(`去抖: ${transformed.length} 个元素带起点位移 transform（同一帧内起步 OK）`);
  }
} catch (e) {
  fail("冒烟异常: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e));
}

console.log("\n" + (failures === 0 ? "DEMO_RUN_CHECK_PASS" : "DEMO_RUN_CHECK_FAIL (" + failures + ")"));
process.exit(failures === 0 ? 0 : 2);
