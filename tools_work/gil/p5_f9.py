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
        if wt==0:
            v,i=vi(b,i); out.append((fn,'v',j,i,v)); continue
        if wt==2:
            ln,k=vi(b,i); out.append((fn,'L',k,k+ln,ln)); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,'5',i-4,i,None)); continue
        if wt==1: i+=8; out.append((fn,'1',i-8,i,None)); continue
        break
    return out

xf = topfields(xb)
def seg_of(b, fl, fn):
    for f in fl:
        if f[0]==fn and f[1]=='L': return b[f[2]:f[3]]
    return b''

x9 = seg_of(xb, xf, 9)

w("="*74); w("象棋 field 9（UI 控件模板）结构"); w("="*74)
w(f"总长 {len(x9):,} 字节")
# 解析 field9 的子消息
i=0; subs=[]
while i < len(x9):
    key,j=vi(x9,i)
    if key is None: break
    fn,wt=key>>3,key&7
    i=j
    if wt==0: v,i=vi(x9,i); subs.append((fn,'v',v)); continue
    if wt==2:
        ln,k=vi(x9,i); subs.append((fn,'L',(k,k+ln,ln))); i=k+ln; continue
    if wt in (5,1): i += 4 if wt==5 else 8; subs.append((fn,str(wt),None)); continue
    break
w(f"子消息数 = {len(subs)}")
from collections import Counter
c = Counter(s[0] for s in subs)
w(f"字段分布: {dict(c)}")

# 打印前若干子消息里的可读内容
w("\n--- 子消息内容（带名称的）---")
for idx,(fn,typ,payload) in enumerate(subs):
    if typ!='L': continue
    s,e,ln = payload
    raw = x9[s:e]
    cur=bytearray(); ss=[]
    for by in raw:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=2: ss.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    if len(cur)>=2: ss.append(cur.decode('utf-8','ignore'))
    nice=[t for t in ss if any('\u4e00'<=ch<='\u9fff' for ch in t) or t.isidentifier()]
    if nice and any(k in ' '.join(nice) for k in ('图片','文本框','光标','容器','root','默认')):
        w(f"  [{idx}] field {fn} len={ln}: {[t[:26] for t in nice[:10]]}")

# 找含"容器节点""文本框""光标检测区域""图片"的那几段，逐个 dump
w("\n" + "="*74); w("四个关键 UI 模板的完整字节"); w("="*74)
for kw in ('容器节点','文本框','光标检测区域','图片'):
    kb = kw.encode()
    pos = x9.find(kb)
    while pos >= 0:
        # 向前找所属子消息
        for idx,(fn,typ,payload) in enumerate(subs):
            if typ!='L': continue
            s,e,ln = payload
            if s <= pos < e:
                w(f"\n--- {kw} 在子消息[{idx}] field={fn} len={ln} (模板内偏移 {pos-s}) ---")
                hx = ' '.join(f'{b:02x}' for b in x9[s:min(e,s+70)])
                w(f"   hex: {hx}")
                w(f"   文本: {x9[s:e][:200].decode('utf-8','ignore').replace(chr(0),'.')[:140]!r}")
                break
        pos = x9.find(kb, pos+1)

txt = OUT.getvalue()
open("tools_work/gil/f9.txt","w",encoding="utf-8").write(txt)
print("written")
