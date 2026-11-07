from PIL import Image
im = Image.open('tools_work/issue3/issue3.png').convert('RGB')
W,H = im.size
px = im.load()
SQ_D=(205,170,132); SQ_L=(247,237,221)
LM_D=(209,169,103); LM_L=(232,207,154)   # LAST_MOVE alpha110 over each
def close(c,t,tol=6): return all(abs(c[i]-t[i])<=tol for i in range(3))
sqcols=[SQ_D,SQ_L,LM_D,LM_L]
xs=[];ys=[]
for y in range(H):
    for x in range(W):
        c=px[x,y]
        if any(close(c,t) for t in sqcols):
            xs.append(x); ys.append(y)
print('board bbox x[%d..%d] y[%d..%d]  w=%d h=%d'%(min(xs),max(xs),min(ys),max(ys),max(xs)-min(xs)+1,max(ys)-min(ys)+1))
x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
cell=(x1-x0+1)/8.0
print('cell approx', cell, (y1-y0+1)/8.0)
# sample center color of each square
print('square map (col a-h left to right, rank 8 top down):')
for r in range(8):
    row=[]
    for f in range(8):
        cx=int(x0+(f+0.5)*cell); cy=int(y0+(r+0.5)*cell)
        c=px[cx,cy]
        tag=''
        if close(c,SQ_L,4): tag='L'
        elif close(c,SQ_D,4): tag='D'
        elif close(c,LM_L,4): tag='l*'
        elif close(c,LM_D,4): tag='d*'
        elif close(c,(46,120,92),25): tag='GREEN'
        else: tag='?'+str(c)
        row.append(tag)
    print('  rank', 8-r, row)
