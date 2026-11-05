import os, io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

GIL = r"C:\Users\24037\Desktop\chess.gil"
gd = open(GIL,'rb').read()
body = gd[20:20+15973]

def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

# 顶层字段表（带 body 偏移）
i=0; fields=[]
while i < len(body):
    st=i
    key,j = vi(body,i)
    if key is None: break
    fn,wt = key>>3, key&7
    i=j
    if wt==0:
        v,i = vi(body,i); fields.append((fn,st,i,i-st,v,None)); continue
    if wt==2:
        ln,k = vi(body,i)
        fields.append((fn,st,k+ln,k+ln-st,(k,ln),None))
        i=k+ln; continue
    if wt==5: i+=4; fields.append((fn,st,i,i-st,None,None)); continue
    if wt==1: i+=8; fields.append((fn,st,i,i-st,None,None)); continue
    break

w("="*74); w("每个顶层字段里的可读字符串（判断职责）"); w("="*74)
for fn,st,en,sz,val,info in fields:
    if sz < 4: continue
    payload = body[st:en]
    # 提取可打印串
    cur=bytearray(); frags=[]
    for b in payload:
        if 0x20 <= b < 0x7f or b >= 0x80:
            cur.append(b)
        else:
            if len(cur)>=3: frags.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    if len(cur)>=3: frags.append(cur.decode('utf-8','ignore'))
    # 只留有意义的中文/标识符
    good = [f for f in frags if (any('\u4e00'<=c<='\u9fff' for c in f) or
            any(k in f for k in ('UIControl','Container','root','Hierarchy','.lua','Image','Text')))]
    if good:
        w(f"\n  field {fn} (size {sz:,}):")
        for g in good[:12]:
            w(f"      {g[:70]!r}")

# 找所有 .lua 名
w("\n" + "="*74); w("Lua 脚本槽位"); w("="*74)
idx = 0
while True:
    idx = body.find(b'.lua', idx)
    if idx < 0: break
    st = idx+4
    while st > 0 and 0x20 <= body[st-1] < 0x7f and (idx+4-st) < 70:
        st -= 1
    w(f"  @{st}: {body[st:idx+4].decode('utf-8','ignore')!r}")
    idx += 4

# 找所有 107374xxxx 索引
w("\n" + "="*74); w("所有控件/模板索引"); w("="*74)
found=[]
i=0
while i < len(body):
    if body[i] & 0x80:
        v,j = vi(body,i)
        if v and 1073740000 < v < 1073760000:
            found.append((i,v)); i=j; continue
    i+=1
w(f"共 {len(found)} 处")
uniq = {}
for off,v in found:
    uniq.setdefault(v, []).append(off)
for v in sorted(uniq):
    w(f"  {v}  x{len(uniq[v]):<3} @ {uniq[v][:6]}")

txt = OUT.getvalue()
open("tools_work/gil/roles.txt","w",encoding="utf-8").write(txt)
print("written")
