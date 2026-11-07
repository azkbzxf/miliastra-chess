"""
比较 field 16/22/45 —— 这两组是「只有能跑的存档才有」的字段
"""
import io
OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

def load(p):
    d=open(p,'rb').read(); fl=int.from_bytes(d[16:20],'big'); return d[20:20+fl]
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
        if wt==0: v,i=vi(b,i); out.append((fn,None)); continue
        if wt==2: ln,k=vi(b,i); out.append((fn,b[k:k+ln])); i=k+ln; continue
        break
    return out

def dump(b, out, d=0, maxd=4, maxitems=40):
    i=0; cnt=0
    while i<len(b) and cnt < maxitems:
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0:
            v,i=vi(b,i); out.append('  '*d+f'f{fn}={v}'); cnt+=1
        elif wt==2:
            ln,k=vi(b,i); sub=b[k:k+ln]
            try:
                s=sub.decode('utf-8'); pr=all(c.isprintable() or c in chr(10)+chr(13)+chr(9) for c in s)
            except: pr=False
            if pr and ln<70:
                out.append('  '*d+f'f{fn}={s!r}'); cnt+=1
            else:
                out.append('  '*d+f'f{fn}<{ln}B>'); cnt+=1
                if d<maxd and ln>6:
                    dump(sub, out, d+1, maxd, maxitems)
            i=k+ln
        elif wt==5: i+=4
        elif wt==1: i+=8
        else: break
    return out

for lbl, p in (("旧(能跑)", r"C:\Users\24037\Downloads\lua中国象棋含AI存档分享.gil"),
               ("新(我的)", r"C:\Users\24037\Desktop\chess-国际象棋.gil")):
    f = {x[0]: x[1] for x in topf(load(p))}
    w("\n" + "="*78); w(f"{lbl}"); w("="*78)
    for fn in (16, 22, 45):
        pay = f.get(fn)
        if pay is None:
            w(f"\n--- field {fn}: 不存在 ---"); continue
        w(f"\n--- field {fn}  len={len(pay)} ---")
        if len(pay)==0:
            w("  (空)"); continue
        lines = []
        dump(pay, lines, 0, 3)
        for L in lines[:30]:
            w(L)

open("tools_work/gil/f1622.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
