import re, json, math, collections
p = r"C:\Users\24037\AppData\Local\Temp\dsh-spill-gzh1V6\session-4bc3a0a4301f\73529809b7d5-qxqy_studio_play.txt"
s = open(p, encoding="utf-8").read()
# pull every prim control: name + rotation + size + pos + active
pat = re.compile(r'"name":\s*"(p\d+_prim\d+)",(.*?)"children":\s*\[\s*\]', re.S)
def g(body, k):
    m = re.search(r'"%s":\s*([^,\n]+)' % k, body)
    return m.group(1).strip() if m else None
rows = []
for m in pat.finditer(s):
    name, body = m.group(1), m.group(2)
    rows.append((name, g(body,"active"), g(body,"localRotationZ"), g(body,"sizeDeltaX"), g(body,"sizeDeltaY")))
print("prim controls found:", len(rows))
act = [r for r in rows if r[1] == "true"]
print("active prims:", len(act))

# expected rotations from PIECE_ART
src = open(r"lua/levelScript.lua", encoding="utf-8").read()
start = src.index("local PIECE_ART = {")
end = src.index("\n}\n", start) + 3
block = src[start:end]
expected = collections.Counter()
for m in re.finditer(r"\[(\w+)\]\s*=\s*\{", block):
    i = block.index("{", m.start())
    depth = 0
    for j in range(i, len(block)):
        if block[j] == "{": depth += 1
        elif block[j] == "}":
            depth -= 1
            if depth == 0:
                sub = block[i:j+1]; break
    for r in re.findall(r"\{\s*(-?\d+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*(\d+)\s*\}", sub):
        expected[float(r[5])] += 1
print("distinct expected rotations:", len(expected))

got = collections.Counter()
for r in act:
    try: got[round(float(r[2]), 4)] += 1
    except: got[r[2]] += 1
print("\nrotation values present in runtime (deg):")
for k in sorted(got, key=lambda x: (isinstance(x,str), x)):
    print(f"  {k:>12} x{got[k]}")
spurious = [k for k in got if isinstance(k,(int,float)) and not any(abs(k-e) < 1e-3 for e in expected)]
print("\nSPURIOUS rotations (not in PIECE_ART):", spurious if spurious else "none")
