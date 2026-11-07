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
        if wt==0: v,i=vi(b,i); out.append({'fn':fn,'wt':0,'pay':enc(v),'val':v}); continue
        if wt==2: ln,k=vi(b,i); out.append({'fn':fn,'wt':2,'pay':b[k:k+ln],'len':ln}); i=k+ln; continue
        if wt==5: out.append({'fn':fn,'wt':5,'pay':b[i:i+4]}); i+=4; continue
        if wt==1: out.append({'fn':fn,'wt':1,'pay':b[i:i+8]}); i+=8; continue
        break
    return out

NEW = r"C:\Users\24037\Desktop\chess-国际象棋.gil"
nb = load(NEW)[1]
nf = {f['fn']: f for f in topf(nb)}

w("="*78); w("field 10（节点图）完整结构"); w("="*78)
pay = nf[10]['pay']
w(f"len = {len(pay):,}")

# 逐层解析
def dump(b, depth=0, path="", maxdepth=4):
    i=0; idx=0
    while i < len(b):
        key,j = vi(b,i)
        if key is None: break
        fn,wt = key>>3, key&7
        i=j
        if wt==0:
            v,i = vi(b,i)
            if depth<=maxdepth:
                w("  "*depth + f"f{fn}= {v}")
            idx+=1
        elif wt==2:
            ln,k = vi(b,i)
            sub = b[k:k+ln]
            # 是否可打印
            try:
                s = sub.decode('utf-8')
                printable = all(ch.isprintable() or ch in '\r\n\t' for ch in s)
            except Exception:
                printable = False
            if printable and ln < 120:
                w("  "*depth + f"f{fn} = {s!r}")
            else:
                hx = sub[:20].hex(' ')
                w("  "*depth + f"f{fn} <{ln}B> {hx}...")
                if depth < maxdepth and ln > 8:
                    dump(sub, depth+1, path+f".{fn}", maxdepth)
            i = k+ln
            idx+=1
        elif wt==5: i+=4; idx+=1
        elif wt==1: i+=8; idx+=1
        else: break
    return

dump(pay, 0, "10", 3)

w("\n" + "="*78); w("关键检查：节点图是否挂载？"); w("="*78)
# 找 field 10 里是否含"关卡实体"GUID 或挂载标记
import re
ss_cur=bytearray(); ss=[]
for by in pay:
    if 0x20<=by<0x7f or by>=0x80: ss_cur.append(by)
    else:
        if len(ss_cur)>=2: ss.append(ss_cur.decode('utf-8','ignore'))
        ss_cur=bytearray()
if len(ss_cur)>=2: ss.append(ss_cur.decode('utf-8','ignore'))
w(f"  field10 全部字符串: {ss}")

open("tools_work/gil/f10.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
