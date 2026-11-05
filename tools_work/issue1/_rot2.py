import re, collections
p = r"C:\Users\24037\AppData\Local\Temp\dsh-spill-gzh1V6\session-4bc3a0a4301f\a3906dfd73c6-qxqy_studio_play.txt"
s = open(p, encoding="utf-8").read()
pat = re.compile(r'"name":\s*"(p\d+_prim\d+)",(.*?)"children":\s*\[\s*\]', re.S)
def g(body, k):
    m = re.search(r'"%s":\s*([^,\n]+)' % k, body)
    return m.group(1).strip() if m else None
rows = []
for m in pat.finditer(s):
    b = m.group(2)
    rows.append((m.group(1), g(b,"active"), g(b,"localRotationZ"), g(b,"sizeDeltaX"), g(b,"anchoredPositionX"), g(b,"anchoredPositionY")))
act = [r for r in rows if r[1]=="true"]
print("prims:", len(rows), "active:", len(act))

src = open(r"lua/levelScript.lua", encoding="utf-8").read()
start = src.index("local PIECE_ART = {"); end = src.index("\n}\n", start)+3
block = src[start:end]
expected = set()
for m in re.finditer(r"\[(\w+)\]\s*=\s*\{", block):
    i = block.index("{", m.start()); depth=0
    for j in range(i, len(block)):
        if block[j]=="{": depth+=1
        elif block[j]=="}":
            depth-=1
            if depth==0: sub=block[i:j+1]; break
    for r in re.findall(r"\{\s*(-?\d+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*(\d+)\s*\}", sub):
        expected.add(round(float(r[5]),3))

spurious = []
for name, a, rot, sx, px, py in act:
    try: rv = round(float(rot),3)
    except: continue
    if not any(abs(rv-e) < 0.01 for e in expected):
        spurious.append((name, rot))
print("SPURIOUS rotations:", spurious if spurious else "none")

# text panel state
for key in ("movelog","capwhite","capblack","panelturn"):
    m = re.search(r'"name":\s*"%s",(.*?)"children"' % key, s, re.S)
    if m:
        t = re.search(r'"text":\s*("(?:[^"\\]|\\.)*")', m.group(1))
        print(f"{key:10s} = {t.group(1) if t else None}")
