import re, math
src = open(r"lua/levelScript.lua", encoding="utf-8").read()
start = src.index("local PIECE_ART = {")
end = src.index("\n}\n", start) + 3
block = src[start:end]
print("block lines:", block.count("\n"))
# find each kind block:  [PAWN] = { ... },
for m in re.finditer(r"\[(\w+)\]\s*=\s*\{", block):
    key = m.group(1)
    # brace match
    i = block.index("{", m.start())
    depth = 0
    for j in range(i, len(block)):
        if block[j] == "{": depth += 1
        elif block[j] == "}":
            depth -= 1
            if depth == 0:
                sub = block[i:j+1]
                break
    rows = re.findall(r"\{\s*(-?\d+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*(\d+)\s*\}", sub)
    def rot_bbox(cx, cy, w, h, deg):
        r = math.radians(deg); c, s = math.cos(r), math.sin(r)
        ex, ey = w/2, h/2
        xs, ys = [], []
        for sx in (-1, 1):
            for sy in (-1, 1):
                px, py = sx*ex, sy*ey
                rx = px*c - py*s; ry = px*s + py*c
                xs.append(cx+rx); ys.append(cy+ry)
        return min(xs), min(ys), max(xs), max(ys)
    x0=y0=1e9; x1=y1=-1e9; roles={}; cnt=0
    for row in rows:
        shape,cx,cy,w,h,deg,role = int(row[0]),float(row[1]),float(row[2]),float(row[3]),float(row[4]),float(row[5]),int(row[6])
        roles[role]=roles.get(role,0)+1
        cnt += 1 if role==2 else 2
        a,b,cc,d = rot_bbox(cx,cy,w,h,deg)
        x0=min(x0,a); y0=min(y0,b); x1=max(x1,cc); y1=max(y1,d)
    print(f"{key:7s} n={len(rows):2d} prim={cnt:2d} roles={roles} bboxX[{x0:.3f},{x1:.3f}] bboxY[{y0:.3f},{y1:.3f}] center=({(x0+x1)/2:.3f},{(y0+y1)/2:.3f}) h={y1-y0:.3f}")
