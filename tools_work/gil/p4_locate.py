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

def topfields(b):
    out=[]; i=0
    while i<len(b):
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7
        i=j
        if wt==0: v,i=vi(b,i); out.append((fn,i-st if False else 0,(j,i),None)); continue
        if wt==2:
            ln,k=vi(b,i); out.append((fn,None,(k,k+ln),ln)); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,None,(i-4,i),None)); continue
        if wt==1: i+=8; out.append((fn,None,(i-8,i),None)); continue
        break
    return out

def grab(b, fields, want):
    for fn,_,(s,e),ln in fields:
        if fn==want: return b[s:e]
    return b''

uf = topfields(ub)
xf = topfields(xb)

# 关键：在象棋存档里定位 testXiangQiProject.lua 在哪个 field
w("="*74); w("定位 Lua 脚本所在的顶层字段"); w("="*74)
for fn,_,(s,e),ln in xf:
    seg = xb[s:e]
    if b'.lua' in seg:
        cnt = seg.count(b'.lua')
        w(f"  field {fn} (size {ln:,}) 含 {cnt} 个 '.lua'")
        # 找具体名字
        idx=0
        while True:
            idx = seg.find(b'.lua', idx)
            if idx<0: break
            st2=idx+4
            while st2>0 and 0x20<=seg[st2-1]<0x7f and (idx+4-st2)<70: st2-=1
            w(f"      {seg[st2:idx+4].decode('utf-8','ignore')!r}")
            idx+=4

w("\n" + "="*74); w("定位 UI 控件模板所在的顶层字段"); w("="*74)
for fn,_,(s,e),ln in xf:
    seg = xb[s:e]
    hits = []
    for k in ('容器节点','文本框','光标检测区域','图片'):
        c = seg.count(k.encode())
        if c: hits.append(f"{k}x{c}")
    if hits:
        w(f"  field {fn} (size {ln:,}): {', '.join(hits)}")

# 对比 field 50（象棋 97770 vs 空 2）里到底是什么
w("\n" + "="*74); w("field 50 内容对比（象棋 97,770B / 空存档 2B）"); w("="*74)
x50 = grab(xb, xf, 50)
w(f"  象棋 field50 前 200 字节 hex:")
w("   " + ' '.join(f'{b:02x}' for b in x50[:100]))
try:
    w(f"  作为文本: {x50[:200].decode('utf-8','ignore')[:150]!r}")
except Exception as e:
    w(f"  decode err {e}")
# 里面是否含 .lua / 控件
for k in (b'.lua', b'function ', b'OnStart', '容器节点'.encode(), '文本框'.encode()):
    w(f"    含 {k!r}: {k in x50}")

# field 15 / 45 / 46 也对比
for fno in (15,45,46,9,5):
    a = grab(ub, uf, fno); b_ = grab(xb, xf, fno)
    w(f"\n  --- field {fno}: 空 {len(a):,}B  象棋 {len(b_):,}B ---")
    for nm, seg in (('空', a), ('象棋', b_)):
        cur=bytearray(); ss=[]
        for by in seg:
            if 0x20<=by<0x7f or by>=0x80: cur.append(by)
            else:
                if len(cur)>=3: ss.append(cur.decode('utf-8','ignore'))
                cur=bytearray()
        if len(cur)>=3: ss.append(cur.decode('utf-8','ignore'))
        nice=[s for s in ss if any('\u4e00'<=c<='\u9fff' for c in s) or 'lua' in s.lower()]
        w(f"      {nm}: {[s[:30] for s in nice[:10]]}")

txt = OUT.getvalue()
open("tools_work/gil/fields.txt","w",encoding="utf-8").write(txt)
print("written")
