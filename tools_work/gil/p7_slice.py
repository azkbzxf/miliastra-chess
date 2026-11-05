import io, sys

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
    """返回 [(fieldNo, kind, bodyStart, bodyEnd, payload)]"""
    out=[]; i=0
    while i<len(b):
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7
        i=j
        if wt==0:
            v,i=vi(b,i); out.append((fn,'v',j,i,v)); continue
        if wt==2:
            ln,k=vi(b,i); out.append((fn,'L',k,k+ln,ln)); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,'5',i-4,i,None)); continue
        if wt==1: i+=8; out.append((fn,'1',i-8,i,None)); continue
        break
    return out

# 1) 解析象棋存档 field9，抽出两个关键模板的完整子消息字节
xf = topfields(xb)
x9 = None
for f in xf:
    if f[0]==9 and f[1]=='L': x9 = xb[f[2]:f[3]]

w("="*74); w("象棋 field9 = %d 字节" % len(x9)); w("="*74)

subs=[]
i=0
while i < len(x9):
    st=i
    key,j=vi(x9,i)
    if key is None: break
    fn,wt=key>>3,key&7
    i=j
    if wt==0: v,i=vi(x9,i); subs.append((fn,st,i,None)); continue
    if wt==2:
        ln,k=vi(x9,i); subs.append((fn,st,k+ln,(k,k+ln,ln))); i=k+ln; continue
    break

# 只保留显式模板（field 502），并识别名称
def first_cn_name(raw):
    cur=bytearray(); best=''
    for by in raw:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=2:
                t = cur.decode('utf-8','ignore')
                if any('\u4e00'<=c<='\u9fff' for c in t) and 2<=len(t)<=12:
                    return t
            cur=bytearray()
    if len(cur)>=2:
        t = cur.decode('utf-8','ignore')
        if any('\u4e00'<=c<='\u9fff' for c in t) and 2<=len(t)<=12: return t
    return ''

w("\n各子消息:")
keep = {}
for idx,(fn,st,en,span) in enumerate(subs):
    if fn!=502 or not span: 
        w(f"  [{idx:>2}] field{fn} (非模板, {en-st}B)")
        continue
    s,e,ln = span
    nm = first_cn_name(x9[s:e])
    w(f"  [{idx:>2}] field{fn} len={ln:>4}  {nm}")
    if nm in ('图片','文本框','光标检测区域','容器节点','客户端控件容器'):
        keep.setdefault(nm, []).append((idx, st, en, x9[st:en]))

w("\n" + "="*74); w("保留的模板（原始字节，含 502 tag）"); w("="*74)
for nm, lst in keep.items():
    for idx, st, en, raw in lst:
        w(f"  {nm:<14} idx={idx:<3} bytes={len(raw):<5} head={raw[:6].hex(' ')}")

import pickle, os
os.makedirs("tools_work/gil/slices", exist_ok=True)
for nm, lst in keep.items():
    for i2,(idx, st, en, raw) in enumerate(lst):
        fn = f"tools_work/gil/slices/{nm}_{idx}.bin"
        open(fn,'wb').write(raw)

txt = OUT.getvalue()
open("tools_work/gil/slices_report.txt","w",encoding="utf-8").write(txt)
print("written slices")
