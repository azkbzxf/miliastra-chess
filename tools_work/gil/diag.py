import io, os

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

def load(p):
    d = open(p,'rb').read()
    fl = int.from_bytes(d[16:20],'big')
    return d, d[20:20+fl]

def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

def topf(b):
    """返回 [(fn, wt, start, end, payload)]"""
    out=[];i=0
    while i<len(b):
        st=i
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7
        i=j
        if wt==0:
            v,i=vi(b,i); out.append((fn,0,st,i,None)); continue
        if wt==2:
            ln,k=vi(b,i); out.append((fn,2,st,k+ln,b[k:k+ln])); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,5,st,i,b[st:i])); continue
        if wt==1: i+=8; out.append((fn,1,st,i,b[st:i])); continue
        break
    return out

def analyze(label, path, script_ids):
    w("\n" + "="*78)
    w(f"{label}")
    w(f"  {path}")
    w("="*78)
    if not os.path.exists(path):
        w("  文件不存在"); return
    d, body = load(path)
    w(f"  大小 {len(d):,}  body {len(body):,}")
    fl = topf(body)
    w(f"  顶层字段 {len(fl)} 个")

    # 字段边界表
    ranges = [(fn, st, en) for fn,wt,st,en,_ in fl]

    for sid in script_ids:
        # 找该 id 的 varint 编码
        n = sid; enc = b''
        while True:
            c = n & 0x7f; n >>= 7
            if n: enc += bytes([c|0x80])
            else: enc += bytes([c]); break
        w(f"\n  --- 脚本 id {sid} (varint {enc.hex(' ')}) ---")
        pos = 0; hits = []
        while True:
            pos = body.find(enc, pos)
            if pos < 0: break
            hits.append(pos); pos += 1
        w(f"  出现 {len(hits)} 次")
        for h in hits:
            owner = None
            for fn, st, en in ranges:
                if st <= h < en:
                    owner = fn; break
            w(f"    @{h:>7}  -> 顶层 field {owner}")

    # 列出 field 9 概况
    for fn,wt,st,en,pay in fl:
        if fn == 9 and pay is not None:
            w(f"\n  --- field 9 (UI 控件模板) len={len(pay):,} ---")
            subs=[];i=0
            while i<len(pay):
                key,j=vi(pay,i)
                if key is None: break
                f2,w2=key>>3,key&7
                i=j
                if w2==0: v,i=vi(pay,i); subs.append((f2,None)); continue
                if w2==2:
                    ln,k=vi(pay,i); subs.append((f2,pay[k:k+ln])); i=k+ln; continue
                break
            def cn(raw):
                if raw is None: return ''
                cur=bytearray(); best=''
                for by in raw:
                    if 0x20<=by<0x7f or by>=0x80: cur.append(by)
                    else:
                        if len(cur)>=2:
                            t=cur.decode('utf-8','ignore')
                            if any('\u4e00'<=c<='\u9fff' for c in t) and 2<=len(t)<=16: return t
                        cur=bytearray()
                return ''
            def ids(raw):
                if raw is None: return []
                res=[];j2=0
                while j2<len(raw):
                    if raw[j2]&0x80:
                        v,j3=vi(raw,j2)
                        if v and 1073740000<v<1073760000: res.append(v); j2=j3; continue
                    j2+=1
                return sorted(set(res))
            for idx,(f2,pay2) in enumerate(subs):
                nm = cn(pay2)
                if nm:
                    w(f"    [{idx:>2}] f{f2} len={len(pay2) if pay2 else 0:>5}  {nm:<14} ids={ids(pay2)}")
                elif pay2 and len(pay2)>100:
                    w(f"    [{idx:>2}] f{f2} len={len(pay2):>5}  (无名)         ids={ids(pay2)}")

analyze("A. 能正常进入 2D 界面的那个存档",
        os.path.expanduser(r"~\Downloads\lua中国象棋含AI存档分享.gil"),
        [1073741826, 1073741827])

analyze("B. 我生成的存档",
        r"out\交付包\chess-国际象棋.gil",
        [1073741826])

open("tools_work/gil/diag.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
