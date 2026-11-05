import io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

d = open(r"C:\Users\24037\Desktop\chess.gil",'rb').read()
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
    if fn==9 and span:
        f9s,f9e = span
        f9 = body[f9s:f9e]

subs=[];i=0
while i<len(f9):
    st=i
    key,j=vi(f9,i)
    if key is None: break
    fn,wt=key>>3,key&7; i=j
    if wt==0: v,i=vi(f9,i); subs.append((fn,None,st,i)); continue
    if wt==2: ln,k=vi(f9,i); subs.append((fn,(k,k+ln,ln),st,k+ln)); i=k+ln; continue
    break

w("="*74); w("确认 4 个模板的完整属性（是否带 imageId / 字体等）"); w("="*74)
TARGET = {42:'容器节点', 43:'光标检测区域', 44:'文本框', 45:'图片'}
for idx in TARGET:
    fn,span,st,en = subs[idx]
    s,e,ln = span
    raw = f9[s:e]
    w(f"\n--- [{idx}] {TARGET[idx]}  len={ln} ---")
    # 打印前 120 字节 hex
    w(f"  hex[0:120]: {' '.join(f'{b:02x}' for b in raw[:120])}")
    # 提取所有可读串
    cur=bytearray(); ss=[]
    for by in raw:
        if 0x20<=by<0x7f or by>=0x80: cur.append(by)
        else:
            if len(cur)>=2: ss.append(cur.decode('utf-8','ignore'))
            cur=bytearray()
    if len(cur)>=2: ss.append(cur.decode('utf-8','ignore'))
    w(f"  可读串: {[t[:24] for t in ss][:14]}")

# 关键：这些模板是否引用了 assetId（图元 100001 等）
w("\n" + "="*74); w("模板里是否含图元 assetId (100001/100002/100003)"); w("="*74)
for aid in (100001,100002,100003,106011):
    enc = b''
    n = aid
    while True:
        c = n & 0x7f; n >>= 7
        if n: enc += bytes([c|0x80])
        else: enc += bytes([c]); break
    w(f"  assetId {aid}  varint={enc.hex(' ')}  在 field9 中出现: {f9.count(enc)} 次")

# 检查 field 50 (Lua) 当前状态
w("\n" + "="*74); w("field 50 (Lua 脚本) 当前状态"); w("="*74)
for fn,wt,span,ln in fl:
    if fn==50:
        if span:
            s,e = span
            raw = body[s:e]
            w(f"  len={ln}  内容={raw.hex(' ')}")
        else:
            w(f"  varint {ln}")

open("tools_work/gil/confirm.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
