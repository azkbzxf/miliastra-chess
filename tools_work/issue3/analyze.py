from PIL import Image
import sys
im = Image.open('tools_work/issue3/issue3.png').convert('RGB')
W,H = im.size
px = im.load()
# target: green dot color 46,120,92
def near(c, t, tol=18):
    return all(abs(c[i]-t[i])<=tol for i in range(3))
pts=[]
for y in range(0,H,1):
    for x in range(0,W,1):
        if near(px[x,y],(46,120,92)):
            pts.append((x,y))
print('green px count', len(pts))
# cluster
clusters=[]
used=set()
import collections
pset=set(pts)
for p in pts:
    if p in used: continue
    dq=collections.deque([p]); used.add(p); comp=[]
    while dq:
        c=dq.popleft(); comp.append(c)
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                n=(c[0]+dx,c[1]+dy)
                if n in pset and n not in used:
                    used.add(n); dq.append(n)
    xs=[c[0] for c in comp]; ys=[c[1] for c in comp]
    clusters.append((len(comp), sum(xs)/len(xs), sum(ys)/len(ys), min(xs),max(xs),min(ys),max(ys)))
clusters=[c for c in clusters if c[0]>50]
print('clusters', len(clusters))
for c in sorted(clusters,key=lambda t:-t[0]):
    print('  n=%4d center=(%.1f, %.1f) bbox x[%d..%d] y[%d..%d] w=%d h=%d'%(c[0],c[1],c[2],c[3],c[4],c[5],c[6],c[4]-c[3]+1,c[6]-c[5]+1))
