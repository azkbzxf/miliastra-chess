import io, sys, os, re

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

P = r"C:\Users\24037\Desktop\chess-国际象棋.gil"
d = open(P, 'rb').read()

w("="*78); w(f"{P}"); w(f"size = {len(d):,}"); w("="*78)

tot   = int.from_bytes(d[0:4], 'big')
ver   = int.from_bytes(d[4:8], 'big')
magic = int.from_bytes(d[8:12], 'big')
nfrag = int.from_bytes(d[12:16], 'big')
f0len = int.from_bytes(d[16:20], 'big')

w(f"total={tot:,}  (file-4={len(d)-4:,})  {'OK' if tot==len(d)-4 else 'MISMATCH'}")
w(f"ver={ver}  magic=0x{magic:x}  nfrag={nfrag}  frag0len={f0len:,}")
w(f"20+f0len = {20+f0len:,}  file = {len(d):,}  tail = {len(d)-(20+f0len)}")

body = d[20:20+f0len]
tail = d[20+f0len:]

def vi(b, i):
    r=0;s=0
    while i < len(b):
        c=b[i]; i+=1
        r |= (c & 0x7f) << s
        if not (c & 0x80): return r, i
        s += 7
        if s > 63: break
    return None, i

def enc(n):
    o=bytearray()
    while True:
        c=n&0x7f; n>>=7
        if n: o.append(c|0x80)
        else: o.append(c); break
    return bytes(o)

def topf(b):
    out=[];i=0
    while i < len(b):
        st=i
        key,j = vi(b,i)
        if key is None: break
        fn,wt = key>>3, key&7
        i=j
        if wt==0:
            v,i = vi(b,i); out.append({'fn':fn,'wt':0,'st':st,'en':i,'pay':enc(v),'val':v}); continue
        if wt==2:
            ln,k = vi(b,i); out.append({'fn':fn,'wt':2,'st':st,'en':k+ln,'pay':b[k:k+ln],'len':ln}); i=k+ln; continue
        if wt==5:
            out.append({'fn':fn,'wt':5,'st':st,'en':i+4,'pay':b[i:i+4]}); i+=4; continue
        if wt==1:
            out.append({'fn':fn,'wt':1,'st':st,'en':i+8,'pay':b[i:i+8]}); i+=8; continue
        break
    return out

fl = topf(body)
w(f"\n顶层字段 {len(fl)} 个，消耗 {fl[-1]['en'] if fl else 0:,}/{len(body):,}")

# field 50 = Lua 脚本
f50 = [f for f in fl if f['fn']==50]
w(f"\nfield 50 数量 = {len(f50)}")
if f50:
    pay = f50[0]['pay']
    w(f"  len = {len(pay):,}")
    # 解析 Script
    sub=[];i=0
    while i < len(pay):
        key,j = vi(pay,i)
        if key is None: break
        fn,wt = key>>3, key&7
        i=j
        if wt==0: v,i=vi(pay,i); sub.append((fn,'v',v)); continue
        if wt==2: ln,k=vi(pay,i); sub.append((fn,'L',pay[k:k+ln])); i=k+ln; continue
        break
    w(f"  外层字段: {[s[0] for s in sub]}")
    inner = sub[0][2] if sub and sub[0][1]=='L' else b''
    s2=[];i=0
    while i < len(inner):
        key,j = vi(inner,i)
        if key is None: break
        fn,wt = key>>3, key&7
        i=j
        if wt==0: v,i=vi(inner,i); s2.append((fn,'v',v)); continue
        if wt==2: ln,k=vi(inner,i); s2.append((fn,'L',inner[k:k+ln])); i=k+ln; continue
        break
    for fn,t,v in s2:
        if fn==1: w(f"  id   = {v}")
        elif fn==2: w(f"  name = {v.decode('utf-8','ignore')!r}")
        elif fn==3: w(f"  file = {v.decode('utf-8','ignore')!r}")
        elif fn==5:
            src = v.decode('utf-8','ignore')
            w(f"  source = {len(v):,} 字节 / {src.count(chr(10))+1} 行")
            w("\n  === 当前脚本里的 4 个索引 ===")
            for k in ('CONTAINER_NODE_INDEX','PREFAB_TEXT_BOX','PREFAB_CURSOR_AREA','PREFAB_IMAGE'):
                m = re.search(r'\b'+k+r'\s*=\s*(\d+)', src)
                w(f"    {k:<22} = {m.group(1) if m else 'NOT FOUND'}")
            w("\n  === 脚本是否含关键代码 ===")
            for k in ('PIECE_ART','local RULES = {}','function OnStart','function OnUpdate','ChessSync'):
                w(f"    {k:<20} {k in src}")

# field 9 的模板（导入后的真实索引）
w("\n" + "="*78); w("field 9 模板（应反映导入后的真实索引）"); w("="*78)
f9 = [f for f in fl if f['fn']==9]
if f9:
    pay = f9[0]['pay']
    w(f"  len = {len(pay):,}")
    subs=[];i=0
    while i < len(pay):
        key,j = vi(pay,i)
        if key is None: break
        fn,wt = key>>3, key&7
        i=j
        if wt==0: v,i=vi(pay,i); subs.append((fn,None)); continue
        if wt==2: ln,k=vi(pay,i); subs.append((fn,pay[k:k+ln])); i=k+ln; continue
        break
    def cn(raw):
        if not raw: return ''
        cur=bytearray()
        for by in raw:
            if 0x20<=by<0x7f or by>=0x80: cur.append(by)
            else:
                if len(cur)>=2:
                    t=cur.decode('utf-8','ignore')
                    if any('\u4e00'<=c<='\u9fff' for c in t) and 2<=len(t)<=18: return t
                cur=bytearray()
        return ''
    def ids(raw):
        if not raw: return []
        res=[];j2=0
        while j2<len(raw):
            if raw[j2]&0x80:
                v,j3=vi(raw,j2)
                if v and 1073740000<v<1073760000: res.append(v); j2=j3; continue
            j2+=1
        return sorted(set(res))
    for idx,(fn,pay2) in enumerate(subs):
        nm = cn(pay2)
        if nm and len(pay2 or b'')>90:
            w(f"    [{idx:>2}] {nm:<18} ids={ids(pay2)}")

open("tools_work/gil/exported.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
