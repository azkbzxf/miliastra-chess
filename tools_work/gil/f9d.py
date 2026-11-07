import io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

def load(p):
    d=open(p,'rb').read(); fl=int.from_bytes(d[16:20],'big'); return d,d[20:20+fl]

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
        if wt==0: v,i=vi(b,i); out.append({'fn':fn,'wt':0,'pay':enc(v),'val':v}); continue
        if wt==2: ln,k=vi(b,i); out.append({'fn':fn,'wt':2,'pay':b[k:k+ln],'len':ln}); i=k+ln; continue
        if wt==5: out.append({'fn':fn,'wt':5,'pay':b[i:i+4]}); i+=4; continue
        if wt==1: out.append({'fn':fn,'wt':1,'pay':b[i:i+8]}); i+=8; continue
        break
    return out

def strings(b,minlen=3):
    cur=bytearray();out=[]
    for by in b:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=minlen: out.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    if len(cur)>=minlen: out.append(cur.decode('utf-8','ignore'))
    return out

NEW = r"C:\Users\24037\Desktop\chess-国际象棋.gil"
nb = load(NEW)[1]
nf = {f['fn']: f for f in topf(nb)}

w("="*78); w("新存档特有的大字段逐个看"); w("="*78)
for fn in (10, 37, 9, 7):
    f = nf.get(fn)
    if not f or f['wt']!=2: 
        w(f"\nfield {fn}: 无"); continue
    pay = f['pay']
    w(f"\n--- field {fn}  len={len(pay):,} ---")
    ss = strings(pay)
    cn = [s for s in ss if any('\u4e00'<=c<='\u9fff' for c in s)]
    w(f"  中文串({len(cn)}): {[s[:26] for s in cn][:16]}")
    ascii_s = [s for s in ss if s.isascii() and 3<=len(s)<=40]
    w(f"  ASCII串({len(ascii_s)}): {ascii_s[:16]}")
    # 是否含脚本id
    for sid in (1073741826,):
        n = sid; e=b''
        while True:
            c=n&0x7f;n>>=7
            if n: e+=bytes([c|0x80])
            else: e+=bytes([c]);break
        w(f"  含脚本id {sid}: {e in pay}")

w("\n" + "="*78); w("field 9 里 4 个模板的第一个子消息（含挂载关系？）"); w("="*78)
f9 = nf.get(9)
pay = f9['pay']
subs=[];i=0
while i<len(pay):
    key,j=vi(pay,i)
    if key is None: break
    fn,wt=key>>3,key&7; i=j
    if wt==0: v,i=vi(pay,i); subs.append((fn,None)); continue
    if wt==2: ln,k=vi(pay,i); subs.append((fn,pay[k:k+ln])); i=k+ln; continue
    break
w(f"field9 子消息 {len(subs)} 个")
# 前 6 个详看
for idx in range(min(6,len(subs))):
    fn,pay2 = subs[idx]
    w(f"\n  [{idx}] f{fn} len={len(pay2) if pay2 else 0}")
    if not pay2: continue
    ss = strings(pay2)
    cn = [s for s in ss if any('\u4e00'<=c<='\u9fff' for c in s)]
    w(f"     中文: {[s[:24] for s in cn][:8]}")
    # 子字段
    s2=[];j2=0
    while j2<len(pay2):
        key,k2=vi(pay2,j2)
        if key is None: break
        f2,w2=key>>3,key&7; j2=k2
        if w2==0: v,j2=vi(pay2,j2); s2.append((f2,'v',v)); continue
        if w2==2: ln,m=vi(pay2,j2); s2.append((f2,'L',ln)); j2=m+ln; continue
        break
    w(f"     子字段: {[(x[0], x[2] if x[1]=='v' else f'<{x[2]}B>') for x in s2][:14]}")

open("tools_work/gil/f9detail.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
