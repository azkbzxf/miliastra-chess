import io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

P = r"C:\Users\24037\Desktop\chess.gil"
d = open(P,'rb').read()

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

total = int.from_bytes(d[0:4],'big')
ver   = int.from_bytes(d[4:8],'big')
magic = int.from_bytes(d[8:12],'big')
nfrag = int.from_bytes(d[12:16],'big')
f0len = int.from_bytes(d[16:20],'big')

w("="*74); w("头部字段"); w("="*74)
w(f"  total = {total:,}")
w(f"  ver   = {ver}")
w(f"  magic = 0x{magic:x}")
w(f"  nfrag = {nfrag}")
w(f"  frag0len = {f0len:,}")
w(f"  file  = {len(d):,}")
w(f"  file-4 = {len(d)-4:,}   total==file-4 ? {total==len(d)-4}")
w(f"  16+f0len = {16+f0len:,}   +4 = {16+f0len+4:,}")
w(f"  20+f0len = {20+f0len:,}")

body = d[20:20+f0len]
w(f"\n  body = d[20:20+{f0len}] = {len(body):,} 字节")
w(f"  尾部剩余 = d[{20+f0len}:] = {len(d)-(20+f0len)} 字节")
tail = d[20+f0len:]
if tail:
    w(f"  尾部字节 = {tail.hex(' ')}  (BE={int.from_bytes(tail,'big')})")

w("\n" + "="*74); w("顶层字段（修正覆盖率计算）"); w("="*74)
i=0; fl=[]
while i < len(body):
    st=i
    key,j = vi(body,i)
    if key is None: break
    fn,wt = key>>3, key&7
    i=j
    if wt==0:
        v,i = vi(body,i); fl.append((fn,0,st,i,v,None)); continue
    if wt==2:
        ln,k = vi(body,i)
        if k+ln > len(body):
            w(f"  !! field {fn} 越界: k={k} ln={ln} bodylen={len(body)}"); break
        fl.append((fn,2,st,k+ln,ln,b'/')); i=k+ln; continue
    if wt==5: fl.append((fn,5,st,i+4,None,None)); i+=4; continue
    if wt==1: fl.append((fn,1,st,i+8,None,None)); i+=8; continue
    w(f"  !! 未知 wt={wt} @{st}"); break

consumed = fl[-1][3] if fl else 0
w(f"  字段数={len(fl)}  消耗={consumed:,}/{len(body):,}  {'OK' if consumed==len(body) else 'MISMATCH 差'+str(len(body)-consumed)}")
for fn,wt,st,en,val,_ in fl:
    sz = en-st
    if wt==2 and sz > 400:
        w(f"  field {fn:>3} wt=2 @{st:>7} size={sz:>8,}")
    elif wt==0:
        w(f"  field {fn:>3} wt=0 @{st:>7} varint={val}")

w("\n" + "="*74); w("往返校验（正确方式：原样重拼）"); w("="*74)
rebuilt = body
newtotal = 16 + len(rebuilt) + len(tail)
out = newtotal.to_bytes(4,'big') + ver.to_bytes(4,'big') + magic.to_bytes(4,'big') \
      + nfrag.to_bytes(4,'big') + len(rebuilt).to_bytes(4,'big') + rebuilt + tail
w(f"  rebuilt size = {len(out):,}  vs original {len(d):,}")
w(f"  逐字节相同: {out == d}")
if out != d:
    n = min(len(out), len(d))
    for k in range(n):
        if out[k] != d[k]:
            w(f"  首差 @{k}: rebuilt={out[k]:02x} orig={d[k]:02x}")
            break

open("tools_work/gil/header2.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
