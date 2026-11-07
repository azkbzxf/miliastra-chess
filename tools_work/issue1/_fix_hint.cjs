// 一次性脚本：把分散在 5 处的分支提示文案收敛到 branch_hint_text()
const fs = require("fs");
const P = "lua/levelScript.lua";
let s = fs.readFileSync(P, "utf8");
const orig = s;

// ① review_render 里的分支提示
s = s.replace(
  "      UI.panel.hint.text = CONFIG.TEXT.BRANCH_ENTERED\r\n    elseif snap ~= nil",
  "      UI.panel.hint.text = branch_hint_text()\r\n    elseif snap ~= nil"
);
s = s.replace(
  "      UI.panel.hint.text = CONFIG.TEXT.BRANCH_ENTERED\n    elseif snap ~= nil",
  "      UI.panel.hint.text = branch_hint_text()\n    elseif snap ~= nil"
);

// ② on_square_clicked / select_square 里的三元写法：
//    UI.panel.hint.text = (GAME.reviewBranch ~= nil)
//      and CONFIG.TEXT.BRANCH_ENTERED or CONFIG.TEXT.REVIEW_START_HINT
const reTri = /UI\.panel\.hint\.text = \(GAME\.reviewBranch ~= nil\)\s*\r?\n\s*and CONFIG\.TEXT\.BRANCH_ENTERED or CONFIG\.TEXT\.REVIEW_START_HINT/g;
let n = 0;
s = s.replace(reTri, () => { n++; return "UI.panel.hint.text = branch_hint_text()"; });

// ③ branch_back 里的提示保持不变（BRANCH_BACK）
fs.writeFileSync(P, s, "utf8");

console.log("文件变化:", s !== orig);
console.log("三元表达式替换处数:", n);
const restEntered = (s.match(/CONFIG\.TEXT\.BRANCH_ENTERED/g) || []).length;
const restMoved = (s.match(/CONFIG\.TEXT\.BRANCH_MOVED/g) || []).length;
console.log("剩余 CONFIG.TEXT.BRANCH_ENTERED 引用:", restEntered, "(应 >0：branch_hint_text 内部那一处)");
console.log("CONFIG.TEXT.BRANCH_MOVED 引用:", restMoved);
const calls = (s.match(/branch_hint_text\(\)/g) || []).length;
console.log("branch_hint_text() 调用点:", calls);
