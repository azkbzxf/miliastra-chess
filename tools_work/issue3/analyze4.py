from PIL import Image
im = Image.open('tools_work/issue3/issue3.png').convert('RGB')
W,H=im.size; px=im.load()
X0,Y0,CELL = 311.0,102.0,127.375
def sq_center(fil, rk):  # fil 0..7 left->right = a..h ; rk 0..7 top->bottom = 8..1
    return X0+(fil+0.5)*CELL, Y0+(rk+0.5)*CELL
def sample(fil,rk):
    cx,cy=sq_center(fil,rk)
    pts=[]
    for dx,dy in [(-0.40,-0.40),(0.40,-0.40),(-0.40,0.40),(0.40,0.40)]:
        pts.append(px[int(cx+dx*CELL), int(cy+dy*CELL)])
    return pts
names='abcdefgh'
refs={'D':(205,170,132),'L':(247,237,221),'LM_D':(209,169,103),'LM_L':(232,207,154),
      'SEL_D':(202,145,70),'SEL_L':(219,173,106),'GREEN':(46,120,92)}
print('corner samples per square (top-left,top-right,bottom-left,bottom-right):')
for rk in range(8):
    rank=8-rk
    for fil in range(8):
        pts=sample(fil,rk)
        def tag(c):
            best=min(refs.items(), key=lambda kv: sum((c[i]-kv[1][i])**2 for i in range(3)))
            d=sum((c[i]-best[1][i])**2 for i in range(3))
            if d<=300: return best[0]
            return None
        tags=[tag(p) for p in pts]
        if any(t and t.startswith(('LM','SEL')) for t in tags) or (tags[0] and tags[0]=='GREEN'):
            print('  %s%d'%(names[fil],rank), tags, pts)
