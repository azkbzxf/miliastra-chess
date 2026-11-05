import io

OUT = io.StringIO()
def w(*a): print(*a, file=OUT)

P = r"C:\Users\24037\Desktop\chess.gil"
d = open(P,'rb').read()

w("="*74); w("文件头 48 字节逐字节"); w("="*74)
for i in range(0, 48, 8):
    chunk = d[i:i+8]
    w(f"  {i:>3}: {' '.join(f'{b:02x}' for b in chunk):<26} (BE {int.from_bytes(chunk,'big')})")

w("\n" + "="*74); w("解析头部尝试：varint 风格？"); w("="*74)
def vi(b,i):
    r=0;s=0
    while i<len(b):
        c=b[i];i+=1;r|=(c&0x7f)<<s
        if not(c&0x80): return r,i
        s+=7
        if s>63: break
    return None,i

i=0
names=['total','ver','magic','nfrag','frag0len']
for n in names:
    if i>=len(d): break
    a,j = vi(d,i)
    print(f"  {n:<10} varint={a}  bytes={d[i:j].hex(' ')}  next={j}", file=OUT)
    i=j
w(f"\n  试读后 offset={i}")
w(f"  若 header=20 则 frag0 从 20 开始, 其 4 字节 = {d[16:20].hex(' ')} (BE={int.from_bytes(d[16:20],'big')})")

# 关键：检验 total 是否 = 文件长度-4
w("\n" + "="*74); w("原始 4 字节读法"); w("="*74)
w(f"  d[0:4]  BE = {int.from_bytes(d[0:4],'big'):,}   file-4 = {len(d)-4:,}")
w(f"  d[0:4]  原样 = {d[0:4].hex(' ')}")
w(f"  d[4:8]  BE = {int.from_bytes(d[4:8],'big')}")
w(f"  d[8:12] BE = 0x{int.from_bytes(d[8:12],'big'):x}")
w(f"  d[12:16] BE = {int.from_bytes(d[12:16],'big')}")
w(f"  d[16:20] BE = {int.from_bytes(d[16:20],'big')}")

# 我的 rebuilt 里 d[3] 变成 1f，说明我写 total 时算错了 —— 检查
body = d[20:]
w(f"\n  body = d[20:] 长度 = {len(body):,}")
w(f"  若 frag0len 应为 {int.from_bytes(d[16:20],'big')}，则 20+{int.from_bytes(d[16:20],'big')} = {20+int.from_bytes(d[16:20],'big')} vs file {len(d)}")
w(f"  差 = {len(d) - (20+int.from_bytes(d[16:20],'big'))}")

open("tools_work/gil/header.txt","w",encoding="utf-8").write(OUT.getvalue())
print("written")
