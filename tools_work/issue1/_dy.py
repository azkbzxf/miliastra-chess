import re, math
src = open(r"lua/levelScript.lua", encoding="utf-8").read()
start = src.index("local PIECE_ART = {"); end = src.index("\n}\n", start)+3
block = src[start:end]
ymin, ymax = 1e9, -1e9
n = 0
for m in re.finditer(r"\[(\w+)\]\s*=\s*\{", block):
    i = block.index("{", m.start()); depth=0
    for j in range(i, len(block)):
        if block[j]=="{": depth+=1
        elif block[j]=="}":
            depth-=1
            if depth==0: sub=block[i:j+1]; break
    for r in re.findall(r"\{\s*(-?\d+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*(\d+)\s*\}", sub):
        kind, nx, ny, nw, nh, rot, role = int(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[5]), int(r[6])
        if role != 0: continue
        rad = rot*math.pi/180.0
        c, s = math.cos(rad), math.sin(rad)
        for px in (-nw/2, nw/2):
            for py_ in (-nh/2, nh/2):
                rx = px*c - py_*s
                ry = px*s + py_*c
                Y = ny + ry
                ymin = min(ymin, Y); ymax = max(ymax, Y)
        n += 1
print("role0 shapes:", n)
print(f"yMin={ymin:.7f} yMax={ymax:.7f} center={(ymin+ymax)/2:.7f}")
print(f"dy = 0.5 - center = {0.5-(ymin+ymax)/2:.10f}")
