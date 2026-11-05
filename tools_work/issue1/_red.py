import json, re
p = r"C:\Users\24037\AppData\Local\Temp\dsh-spill-gzh1V6\session-4bc3a0a4301f\e91f6d26f79e-qxqy_studio_play.txt"
s = open(p, encoding="utf-8").read()
# the spill is truncated JSON; find first '{' and try to parse the tree portion
i = s.find('"tree"')
print("tree at", i, "len", len(s))
# Extract objects with name legalhl that are active
for m in re.finditer(r'\{\s*"id":\s*(\d+),\s*"prefabId":\s*\d+,\s*"authoringId":\s*null,\s*"name":\s*"(legalhl\d+|selhl|p1_prim1|p2_prim1|selringtop)",(.*?)"children":\s*\[\s*\]', s, re.S):
    name = m.group(2); body = m.group(3)
    def g(k):
        mm = re.search(r'"%s":\s*([^,\n]+)' % k, body)
        return mm.group(1).strip() if mm else None
    print(name, "active=", g("active"), "pos=(", g("anchoredPositionX"), ",", g("anchoredPositionY"), ") size=(", g("sizeDeltaX"), ",", g("sizeDeltaY"), ") color=", g("imageColor"), "rot=", g("localRotationZ"))
