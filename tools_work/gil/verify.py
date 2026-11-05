import io, os, hashlib

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

def load(p):
    d=open(p,'rb').read()
    fl=int.from_bytes(d[16:20],'big')
    return d, d[20:20+fl], d[20+fl:]

def topf(b):
    out=[];i=0
    while i<len(b):
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0: v,i=vi(b,i); out.append((fn,0,None,b'')); continue
        if wt==2: ln,k=vi(b,i); out.append((fn,2,b[k:k+ln],ln)); i=k+ln; continue
        if wt==5: i+=4; out.append((fn,5,b[i-4:i],None)); continue
        if wt==1: i+=8; out.append((fn,1,b[i-8:i],None)); continue
        break
    return out

NEW = r"out\交付包\chess-国际象棋.gil"
ORG = r"C:\Users\24037\Desktop\chess.gil"

nd, nb, ntail = load(NEW)
od, ob, otail = load(ORG)

w("="*74); w("生成文件结构校验"); w("="*74)
w(f"  文件大小   : {len(nd):,}")
w(f"  total 声明 : {int.from_bytes(nd[0:4],'big'):,}  (file-4 = {len(nd)-4:,})  "
  f"{'OK' if int.from_bytes(nd[0:4],'big')==len(nd)-4 else 'MISMATCH'}")
w(f"  ver/magic/nfrag : {int.from_bytes(nd[4:8],'big')} / 0x{int.from_bytes(nd[8:12],'big'):x} / {int.from_bytes(nd[12:16],'big')}")
w(f"  frag0len   : {int.from_bytes(nd[16:20],'big'):,}  == body {len(nb):,} ? {int.from_bytes(nd[16:20],'big')==len(nb)}")
w(f"  tail       : {ntail.hex(' ')}  (原 {otail.hex(' ')})  相同={ntail==otail}")
w(f"  body 完整消耗: 见下方字段对比")
w("\n" + "="*74); w("逐字段对比（除 50 外应完全一致）"); w("="*74)
of = topf(ob)
nf = topf(nb)
w(f"  原字段 {len(of)}  新字段 {len(nf)}")
diff = 0
for a,b in zip(of,nf):
    fa,wa,paya,lna = a
    fbb,wb,payb,lnb = b
    if fa != fbb:
        w(f"  !! 字段号不匹配 {fa} vs {fbb}"); diff+=1; continue
    if fa == 50:
        w(f"  field 50 : {lna} -> {lnb}  (预期变大)")
    elif paya != payb:
        w(f"  !! field {fa} 内容变化 ({len(paya)} -> {len(payb)})"); diff+=1
w(f"  除 field50 外的差异数 = {diff}  {'OK' if diff==0 else 'FAIL'}")

w("\n" + "="*74); w("field 50 内容验证"); w("="*74)
f50 = [x for x in nf if x[0]==50][0][2]
w(f"  长度 = {len(f50):,} 字节")
# 解析 Script{1:id,2:name,3:file,5:source}
def parse_msg(b):
    out=[];i=0
    while i<len(b):
        key,j=vi(b,i)
        if key is None: break
        fn,wt=key>>3,key&7; i=j
        if wt==0: v,i=vi(b,i); out.append((fn,v)); continue
        if wt==2: ln,k=vi(b,i); out.append((fn,b[k:k+ln])); i=k+ln; continue
        break
    return out

outer = parse_msg(f50)
w(f"  外层字段: {[f[0] for f in outer]}")
inner_raw = outer[0][1]
inner = parse_msg(inner_raw)
w(f"  Script 字段: {[(f[0], (f[1] if isinstance(f[1],int) else f'<{len(f[1])}B>')) for f in inner]}")
for fn,v in inner:
    if fn==1: w(f"    id   = {v}")
    elif fn==2: w(f"    name = {v.decode()!r}")
    elif fn==3: w(f"    file = {v.decode()!r}")
    elif fn==5:
        src = v.decode('utf-8')
        w(f"    source = {len(v):,} 字节 / {src.count(chr(10))+1} 行")
        # 验证 4 个索引
        import re
        for k in ('CONTAINER_NODE_INDEX','PREFAB_IMAGE','PREFAB_TEXT_BOX','PREFAB_CURSOR_AREA'):
            m = re.search(r'\b'+k+r'\s*=\s*(\d+)', src)
            w(f"      {k:<22} = {m.group(1) if m else 'NOT FOUND'}")
        # 验证关键代码存在
        for k in ('PIECE_ART','local RULES = {}','function OnStart','function OnUpdate'):
            w(f"      含 {k!r}: {k in src}")
        # 保存用于 diff
        open("tools_work/gil/extracted_from_gil.lua","w",encoding="utf-8",newline="").write(src)

w("\n" + "="*74); w("SHA256"); w("="*74)
w(f"  {hashlib.sha256(nd).hexdigest().upper()}")

open("tools_work/gil/verify.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")

