import io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

USER = r"C:\Users\24037\Desktop\chess.gil"
XIANG = r"C:\Users\24037\Downloads\lua中国象棋含AI存档分享.gil"

def load(p):
    d = open(p,'rb').read()
    n = int.from_bytes(d[12:16],'big')
    off = 20
    ln = int.from_bytes(d[16:20],'big')
    return d, d[off:off+ln]

ud, ub = load(USER)
xd, xb = load(XIANG)

w("="*74); w("UI 控件模板类型名 是否存在于两个存档"); w("="*74)
KEYS = ['图片','文本框','光标检测区域','容器节点','模板引用控件','网格视窗','预设按钮',
        '按键提示','文本视窗','控件组','界面控件','UIControlGroup','UIControlTemplate',
        'ClientUIRootHierarchyRoot','ContainerNode','TextBox','CursorArea','Image']
w(f"{'关键词':<26}{'chess.gil(空)':>16}{'象棋.gil':>12}")
for k in KEYS:
    a = ub.count(k.encode())
    b = xb.count(k.encode())
    mark = '  <== 差异' if (b>0 and a==0) else ''
    w(f"  {k:<24}{a:>14}{b:>12}{mark}")

w("\n" + "="*74); w("chess.gil 顶层字段 vs 象棋.gil 顶层字段"); w("="*74)
def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

def top(b):
    out=[]; i=0
    while i<len(b):
        st=i
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7
        i=j
        if wt==0: v,i=vi(b,i); out.append((fn,wt,i-st,v)); continue
        if wt==2:
            ln,k=vi(b,i); out.append((fn,wt,k+ln-st,ln)); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,wt,4,None)); continue
        if wt==1: i+=8; out.append((fn,wt,8,None)); continue
        break
    return out

ut, xt = top(ub), top(xb)
uf = {f[0]: f[2] for f in ut}
xf = {f[0]: f[2] for f in xt}
allf = sorted(set(uf)|set(xf))
w(f"  {'字段':>5} {'chess.gil':>12} {'象棋.gil':>12}   说明")
for f in allf:
    a = uf.get(f, 0); b = xf.get(f, 0)
    note = ''
    if a==0: note = '空存档无'
    elif b==0: note = '仅空存档有'
    elif abs(a-b) > 500: note = f'差 {b-a:+,}'
    w(f"  {f:>5} {a:>12,} {b:>12,}   {note}")

txt = OUT.getvalue()
open("tools_work/gil/compare.txt","w",encoding="utf-8").write(txt)
print("written")
