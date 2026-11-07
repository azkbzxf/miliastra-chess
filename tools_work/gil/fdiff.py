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
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0: v,i=vi(b,i); out.append((fn,0,enc(v),v)); continue
        if wt==2: ln,k=vi(b,i); out.append((fn,2,b[k:k+ln],None)); i=k+ln; continue
        if wt==5: out.append((fn,5,b[i:i+4],None)); i+=4; continue
        if wt==1: out.append((fn,1,b[i:i+8],None)); i+=8; continue
        break
    return out

def strings(b,minlen=2):
    cur=bytearray();out=[]
    for by in b:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=minlen: out.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    if len(cur)>=minlen: out.append(cur.decode('utf-8','ignore'))
    return out

NEW = r"C:\Users\24037\Desktop\chess-国际象棋.gil"
OLD = r"C:\Users\24037\Downloads\lua中国象棋含AI存档分享.gil"

nf = {f[0]:f for f in topf(load(NEW)[1])}
of = {f[0]:f for f in topf(load(OLD)[1])}

w("="*80); w("逐个字段：找出「象棋能进2D而我不能」的真正差异"); w("="*80)

for fn in sorted(set(nf)|set(of)):
    a = nf.get(fn); b = of.get(fn)
    pay_a = a[2] if a else b''
    pay_b = b[2] if b else b''
    if fn in (9,10,50,7,15,5,6,27): 
        continue  # 已看过
    if len(pay_a)==0 and len(pay_b)==0: continue
    sa = strings(pay_a); sb = strings(pay_b)
    cna = [s for s in sa if any('\u4e00'<=c<='\u9fff' for c in s)]
    cnb = [s for s in sb if any('\u4e00'<=c<='\u9fff' for c in s)]
    if not cna and not cnb: continue
    w(f"\n--- field {fn}: 新 {len(pay_a):,}B / 旧 {len(pay_b):,}B ---")
    w(f"  新: {[s[:24] for s in cna][:12]}")
    w(f"  旧: {[s[:24] for s in cnb][:12]}")

w("\n" + "="*80); w("重点：field 4（实体模板）与 field 16/22/45 —— 只有旧存档有"); w("="*80)
for fn in (4,16,22,45,35,46,18):
    for lbl, fmap in (("新", nf), ("旧", of)):
        f = fmap.get(fn)
        if not f: 
            w(f"  field {fn} {lbl}: 无"); continue
        pay = f[2]
        ss = strings(pay)
        cn = [s for s in ss if any('\u4e00'<=c<='\u9fff' for c in s)]
        w(f"  field {fn} {lbl}: {len(pay):,}B  中文={[s[:20] for s in cn][:10]}")

w("\n" + "="*80); w("最终确认：4 个模板索引在两份存档中的归属"); w("="*80)
def f9_ids(fmap, want_names):
    f = fmap.get(9)
    if not f: return {}
    pay = f[2]
    subs=[];i=0
    while i<len(pay):
        key,j=vi(pay,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0: v,i=vi(pay,i); subs.append((fn,None)); continue
        if wt==2: ln,k=vi(pay,i); subs.append((fn,pay[k:k+ln])); i=k+ln; continue
        break
    out={}
    for fn,pay2 in subs:
        if not pay2: continue
        ss = strings(pay2)
        nm = ''
        for t in ss:
            if any('\u4e00'<=c<='\u9fff' for c in t) and 2<=len(t)<=20:
                nm=t; break
        if nm in want_names:
            ids=[];j2=0
            while j2<len(pay2):
                if pay2[j2]&0x80:
                    v,j3=vi(pay2,j2)
                    if v and 1073740000<v<1073760000: ids.append(v); j2=j3; continue
                j2+=1
            out.setdefault(nm, []).append(sorted(set(ids)))
    return out

WANT = {'容器节点','图片','文本框','棋盘格/面板/按钮要用','光标检测区域'}
w("  新存档：" + str(f9_ids(nf, WANT)))
w("  旧存档：" + str(f9_ids(of, WANT)))

open("tools_work/gil/final_diff.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
