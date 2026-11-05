import io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

def load(p):
    d = open(p,'rb').read()
    ln = int.from_bytes(d[16:20],'big')
    return d, d[20:20+ln]

ud, ub = load(r"C:\Users\24037\Desktop\chess.gil")
xd, xb = load(r"C:\Users\24037\Downloads\lua中国象棋含AI存档分享.gil")

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
        c=n&0x7f; n>>=7
        if n: o.append(c|0x80)
        else: o.append(c); break
    return bytes(o)

def topfields(b):
    out=[]; i=0
    while i<len(b):
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7
        i=j
        if wt==0: v,i=vi(b,i); out.append((fn,'v',j,i,v)); continue
        if wt==2:
            ln,k=vi(b,i); out.append((fn,'L',k,k+ln,ln)); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,'5',i-4,i,None)); continue
        if wt==1: i+=8; out.append((fn,'1',i-8,i,None)); continue
        break
    return out

def getseg(b, fl, fn):
    for f in fl:
        if f[0]==fn and f[1]=='L': return b[f[2]:f[3]]
    return None

xf = topfields(xb)
x9 = getseg(xb, xf, 9)

# 解析 field9 的子消息列表
subs=[]
i=0
while i < len(x9):
    key,j=vi(x9,i)
    if key is None: break
    fn,wt=key>>3,key&7
    i=j
    if wt==0: v,i=vi(x9,i); subs.append((fn,None,None)); continue
    if wt==2:
        ln,k=vi(x9,i); subs.append((fn,(k,k+ln),ln)); i=k+ln; continue
    break

w("="*74); w("field 9 全部 30 个子消息"); w("="*74)
for idx,(fn,span,ln) in enumerate(subs):
    if fn==502 and span:
        s,e = span
        raw = x9[s:e]
        # 找第一个可读名称
        cur=bytearray(); names=[]
        for by in raw:
            if 0x20<=by<0x7f or by>=0x80: cur.append(by)
            else:
                if len(cur)>=2: names.append(cur.decode('utf-8','ignore'))
                cur=bytearray()
        if len(cur)>=2: names.append(cur.decode('utf-8','ignore'))
        # 第一个像中文名的
        nm = ''
        for t in names:
            if any('\u4e00'<=c<='\u9fff' for c in t) and len(t)>=2:
                nm = t; break
        w(f"  [{idx:>2}] field{fn} len={ln:>4}  名称={nm!r}")
    else:
        w(f"  [{idx:>2}] field{fn} len={ln}")

# ---- 找子消息[19]（客户端控件容器）的模板索引 ----
w("\n" + "="*74); w("每个模板的 索引ID"); w("="*74)
def scan_ids(raw):
    res=[]
    i=0
    while i<len(raw):
        if raw[i] & 0x80:
            v,j=vi(raw,i)
            if v and 1073740000 < v < 1073760000:
                res.append(v); i=j; continue
        i+=1
    return res

for idx,(fn,span,ln) in enumerate(subs):
    if fn!=502 or not span: continue
    s,e = span
    ids = scan_ids(x9[s:e])
    raw = x9[s:e]
    nm=''
    cur=bytearray(); names=[]
    for by in raw:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=2: names.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    for t in names:
        if any('\u4e00'<=c<='\u9fff' for c in t) and len(t)>=2: nm=t; break
    w(f"  [{idx:>2}] {nm[:20]:<22} ids={sorted(set(ids))}")

txt = OUT.getvalue()
open("tools_work/gil/tmpl_ids.txt","w",encoding="utf-8").write(txt)
print("written")

