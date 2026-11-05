import re, math
src = open(r"lua/levelScript.lua", encoding="utf-8").read()
m = re.search(r"local PIECE_ART = \{(.*?)\n\}\n", src, re.S)
body = m.group(1)
kinds = re.findall(r"-- (\w+):\s*(\d+) 图元[^\n]*\n\s*\[(\w+)\] = \{(.*?)\n  \},", body, re.S)
print("kinds found:", [k[2] for k in kinds])
def rot_bbox(cx, cy, w, h, deg):
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    # corners relative to center, half extents
    ex, ey = w/2, h/2
    xs, ys = [], []
    for sx in (-1, 1):
        for sy in (-1, 1):
            px, py = sx*ex, sy*ey
            # counter-clockwise rotation in a Y-up frame
            rx = px*c - py*s
            ry = px*s + py*c
            xs.append(cx+rx); ys.append(cy+ry)
    return min(xs), min(ys), max(xs), max(ys)

allmin = 1.0; allmax = 0.0
for label, n, key, shapes in kinds:
    rows = re.findall(r"\{\s*(\d+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*(\d+)\s*\}", shapes)
    x0=y0=1e9; x1=y1=-1e9
    roles = {}
    for row in rows:
        shape, cx, cy, w, h, deg, role = int(row[0]), float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5]), int(row[6])
        roles[role] = roles.get(role, 0) + 1
        a,b,cc,d = rot_bbox(cx,cy,w,h,deg)
        x0=min(x0,a); y0=min(y0,b); x1=max(x1,cc); y1=max(y1,d)
    print(f"{key:7s} n={len(rows):2d} roles={roles} bbox x[{x0:.4f},{x1:.4f}] y[{y0:.4f},{y1:.4f}] cx={((x0+x1)/2):.4f} cy={((y0+y1)/2):.4f} h={y1-y0:.4f}")
    allmin = min(allmin, y0); allmax = max(allmax, y1)
print(f"\nALL y range [{allmin:.4f}, {allmax:.4f}] center {(allmin+allmax)/2:.4f}")
# prim counts (no shadow): role0 -> 2 each, role1 -> 2, role2 -> 1
print("\nprim budget check (no shadow):")
for label, n, key, shapes in kinds:
    rows = re.findall(r"\{\s*(\d+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*(\d+)\s*\}", shapes)
    cnt = 0
    for row in rows:
        role = int(row[6])
        cnt += 1 if role == 2 else 2
    print(f"  {key:7s} {cnt}")
