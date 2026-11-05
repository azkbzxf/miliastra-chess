import io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

P = r"C:\Users\24037\Desktop\chess.gil"
d = open(P,'rb').read()
f0len = int.from_bytes(d[16:20],'big')
body = d[20:20+f0len]

def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

def topf(b):
    out=[];i=0
    while i<len(b):
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0: v,i=vi(b,i); out.append((fn,0,None,v)); continue
        if wt==2: ln,k=vi(b,i); out.append((fn,2,(k,k+ln),ln)); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,5,None,None)); continue
        if wt==1: i+=8; out.append((fn,1,None,None)); continue
        break
    return out

fl = topf(body)
f9 = None
for fn,wt,span,ln in fl:
    if fn==9 and span: f9 = body[span[0]:span[1]]

w("="*74); w(f"field 9 = {len(f9):,} 字节（之前 3,421）"); w("="*74)

# 解析子消息
subs=[]; i=0
while i < len(f9):
    st=i
    key,j=vi(f9,i)
    if key is None: break
    fn,wt=key>>3,key&7; i=j
    if wt==0: v,i=vi(f9,i); subs.append((fn,None,st,i)); continue
    if wt==2:
        ln,k=vi(f9,i); subs.append((fn,(k,k+ln,ln),st,k+ln)); i=k+ln; continue
    break

def names(raw):
    cur=bytearray(); out=[]
    for by in raw:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=2: out.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    if len(cur)>=2: out.append(cur.decode('utf-8','ignore'))
    return out

def cn(raw):
    for t in names(raw):
        if any('\u4e00'<=c<='\u9fff' for c in t) and 2<=len(t)<=14: return t
    return ''

def ids(raw):
    res=[];i=0
    while i<len(raw):
        if raw[i]&0x80:
            v,j=vi(raw,i)
            if v and 1073740000<v<1073760000: res.append(v); i=j; continue
        i+=1
    return sorted(set(res))

w(f"\n子消息数 = {len(subs)}")
for idx,(fn,span,st,en) in enumerate(subs):
    if span:
        s,e,ln = span
        raw = f9[s:e]
        w(f"  [{idx:>2}] field{fn} len={ln:>5}  {cn(raw):<16} ids={ids(raw)}")
    else:
        w(f"  [{idx:>2}] field{fn} (varint)")

# 专门找 4 个目标模板
w("\n" + "="*74); w("目标模板索引"); w("="*74)
for idx,(fn,span,st,en) in enumerate(subs):
    if not span: continue
    s,e,ln = span
    raw = f9[s:e]
    nm = cn(raw)
    if nm in ('图片','文本框','光标检测区域','容器节点','客户端控件容器'):
        got = ids(raw)
        w(f"  {nm:<14} idx={idx:<3} ids={got}")
    # 无名但可能是容器节点
    elif nm=='' and 100 < ln < 700:
        allid = ids(raw)
        if allid:
            w(f"  (无名) idx={idx:<3} len={ln} ids={allid}")

open("tools_work/gil/f9new.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
