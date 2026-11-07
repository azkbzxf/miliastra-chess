import io, os, re

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

def load(p):
    d = open(p,'rb').read()
    fl = int.from_bytes(d[16:20],'big')
    return d, d[20:20+fl], d[20+fl:]

def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

def enc(n):
    o=bytearray()
    while True:
        c=n&0x7f;n>>=7
        if n: o.append(c|0x80)
        else: o.append(c);break
    return bytes(o)

def topf(b):
    out=[];i=0
    while i<len(b):
        st=i
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0: v,i=vi(b,i); out.append({'fn':fn,'wt':0,'pay':enc(v),'val':v,'st':st}); continue
        if wt==2: ln,k=vi(b,i); out.append({'fn':fn,'wt':2,'pay':b[k:k+ln],'len':ln,'st':st}); i=k+ln; continue
        if wt==5: out.append({'fn':fn,'wt':5,'pay':b[i:i+4],'st':st}); i+=4; continue
        if wt==1: out.append({'fn':fn,'wt':1,'pay':b[i:i+8],'st':st}); i+=8; continue
        break
    return out

def strings(b, minlen=2):
    cur=bytearray(); out=[]
    for by in b:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=minlen: out.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    if len(cur)>=minlen: out.append(cur.decode('utf-8','ignore'))
    return out

NEW = r"C:\Users\24037\Desktop\chess-国际象棋.gil"
OLD = r"C:\Users\24037\Downloads\lua中国象棋含AI存档分享.gil"

nd, nb, nt = load(NEW)
od, ob, ot = load(OLD)
nf = {f['fn']: f for f in topf(nb)}
of = {f['fn']: f for f in topf(ob)}

w("="*78); w("字段大小对比（新 = 用户刚导出 / 旧 = 能跑的象棋）"); w("="*78)
w(f"{'字段':>5} {'新(导出)':>12} {'旧(能跑)':>12}  说明")
for fn in sorted(set(nf)|set(of)):
    a = nf.get(fn); b = of.get(fn)
    sa = (a['len'] if a and a['wt']==2 else (len(a['pay']) if a else 0)) or 0
    sb = (b['len'] if b and b['wt']==2 else (len(b['pay']) if b else 0)) or 0
    mark = ''
    if fn in (5,6,27,50,9): mark = ' <<<'
    if abs(sa-sb) > 0 or mark:
        w(f"{fn:>5} {sa:>12,} {sb:>12,}{mark}")

w("\n" + "="*78); w("field 27（脚本运行时注册表）"); w("="*78)
for lbl, d, fmap in (("新", nd, nf), ("旧", od, of)):
    f = fmap.get(27)
    if not f:
        w(f"  {lbl}: 不存在"); continue
    pay = f['pay']
    w(f"  {lbl}: len={len(pay)}  hex={pay.hex(' ')}")
    if pay:
        w(f"      strings={strings(pay)}")
        s=[];i=0
        while i<len(pay):
            key,j=vi(pay,i)
            if key is None: break
            fn,wt=key>>3,key&7; i=j
            if wt==0: v,i=vi(pay,i); s.append((fn,'v',v)); continue
            if wt==2: ln,k=vi(pay,i); s.append((fn,'L',pay[k:k+ln])); i=k+ln; continue
            break
        w(f"      子字段: {[(x[0], x[2] if x[1]=='v' else f'<{len(x[2])}B>') for x in s]}")

w("\n" + "="*78); w("field 50 外层结构（新 vs 旧）"); w("="*78)
for lbl, fmap in (("新", nf), ("旧", of)):
    f = fmap.get(50)
    if not f: w(f"  {lbl}: 无"); continue
    pay = f['pay']
    s=[];i=0
    while i<len(pay):
        key,j=vi(pay,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0: v,i=vi(pay,i); s.append((fn,'v',v)); continue
        if wt==2: ln,k=vi(pay,i); s.append((fn,'L',ln,k,pay[k:k+ln])); i=k+ln; continue
        break
    w(f"  {lbl}: 外层字段 {[x[0] for x in s]}")
    for x in s:
        if x[1]=='L':
            inner = x[4]
            s2=[];i2=0
            while i2<len(inner):
                key,j=vi(inner,i2)
                if key is None: break
                fn,wt=key>>3,key&7; i2=j
                if wt==0: v,i2=vi(inner,i2); s2.append((fn,'v',v)); continue
                if wt==2: ln,k=vi(inner,i2); s2.append((fn,'L',ln)); i2=k+ln; continue
                break
            w(f"     field{x[0]} len={x[2]:,}  内含: {[(y[0], y[2] if y[1]=='v' else f'<{y[2]}B>') for y in s2]}")
        else:
            w(f"     field{x[0]} varint={x[2]}")

w("\n" + "="*78); w("field 6（界面布局）里的可读串"); w("="*78)
for lbl, fmap in (("新", nf), ("旧", of)):
    f = fmap.get(6)
    if not f: continue
    ss = strings(f['pay'])
    cn = [s for s in ss if any('\u4e00'<=c<='\u9fff' for c in s)]
    w(f"  {lbl} field6 {f['len']:,}B: {[s[:22] for s in cn][:20]}")

w("\n" + "="*78); w("field 5（实体/界面控件组挂载）里的可读串"); w("="*78)
for lbl, fmap in (("新", nf), ("旧", of)):
    f = fmap.get(5)
    if not f: continue
    ss = strings(f['pay'])
    cn = [s for s in ss if any('\u4e00'<=c<='\u9fff' for c in s)]
    w(f"  {lbl} field5 {f['len']:,}B: {[s[:22] for s in cn][:20]}")

open("tools_work/gil/deep.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
