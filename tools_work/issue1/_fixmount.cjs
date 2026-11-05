const fs = require("fs");
const p = "workspace/chess/chess.save.json";
const s = JSON.parse(fs.readFileSync(p, "utf8"));
const r = s.assets.scripts[0];
r.controlId = "n1";
r.controlAsset = "server-control-template";
r.controlName = "容器节点";
r.assetType = "server-control-template";
r.assetLabel = "服务器控件模板";
r.mounted = true;
r.guid = r.guid || 1073742109;
r.id = String(r.guid);
// 同时确保容器节点的 scriptMappingIds 里登记了它
const walk = (node) => {
  if (!node) return;
  if (node.id === "n1") node.scriptMappingIds = [Number(r.guid)];
  (node.children || []).forEach(walk);
};
walk(s.assets.server.root);
fs.writeFileSync(p, JSON.stringify(s, null, 2), "utf8");
console.log("mounted=" + r.mounted + " controlId=" + r.controlId + " guid=" + r.guid);
