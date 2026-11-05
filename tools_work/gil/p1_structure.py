import os, io, sys, json

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

GIL = r"C:\Users\24037\Desktop\chess.gil"
with open(GIL,'rb') as f: gd = f.read()

w("="*74); w(f"文件: {GIL}"); w(f"大小: {len(gd):,} 字节"); w("="*74)

total = int.from_bytes(gd[0:4],'big')
ver   = int.from_bytes(gd[4:8],'big')
magic = int.from_bytes(gd[8:12],'big')
nfrag = int.from_bytes(gd[12:16],'big')
w(f"total_len 声明 = {total:,}   (文件-4 = {len(gd)-4:,})   {'OK' if total==len(gd)-4 else 'MISMATCH'}")
w(f"version        = {ver}")
w(f"magic          = 0x{magic:x}")
w(f"nfrag          = {nfrag}")

# 分片
frags=[]
off=16
for i in range(nfrag):
    if off+4 > len(gd):
        w(f"  frag{i}: 越界"); break
    ln = int.from_bytes(gd[off:off+4],'big')
    off += 4
    if off+ln > len(gd):
        w(f"  frag{i}: 声明 {ln} 但只剩 {len(gd)-off}"); 
        ln = len(gd)-off
    frags.append((i, ln, gd[off:off+ln]))
    w(f"  frag{i}: len={ln:>9,}  body@{off}")
    off += ln
w(f"consumed={off}  remain={len(gd)-off}")

# 主体分片
body = None
for i,ln,fr in frags:
    if ln > 0: body = fr

def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

w("\n" + "="*74); w("顶层 protobuf 字段"); w("="*74)
i=0; fields=[]
while i < len(body):
    st=i
    key,j = vi(body,i)
    if key is None: break
    fn,wt = key>>3, key&7
    i=j
    if wt==0:
        v,i = vi(body,i); fields.append((fn,wt,st,i-st,v,None)); continue
    if wt==2:
        ln,k = vi(body,i)
        if ln is None or k+ln>len(body): 
            fields.append((fn,wt,st,0,None,"TRUNC")); break
        fields.append((fn,wt,st,k+ln-st,ln,(k,ln)))
        i = k+ln; continue
    if wt==5: i+=4; fields.append((fn,wt,st,4,None,None)); continue
    if wt==1: i+=8; fields.append((fn,wt,st,8,None,None)); continue
    w(f"  !! 未知 wire type {wt} @{st}"); break

w(f"字段数 = {len(fields)}, 覆盖 {i}/{len(body)} 字节")
for fn,wt,st,sz,val,info in fields:
    desc = ""
    if wt==0: desc = f"varint {val}"
    elif wt==2:
        k,ln = info
        payload = body[k:k+ln]
        try:
            s = payload.decode('utf-8')
            if all(c.isprintable() or c in '\r\n\t' for c in s) and ln < 300:
                desc = f"len {ln} str={s[:60]!r}"
            else:
                desc = f"len {ln:,} (bytes)"
        except Exception:
            desc = f"len {ln:,} (bytes)"
    w(f"  field {fn:>3} wt={wt} @{st:>7} size={sz:>8,}  {desc}")

txt = OUT.getvalue()
open("tools_work/gil/analysis_user.txt","w",encoding="utf-8").write(txt)
print("written")
