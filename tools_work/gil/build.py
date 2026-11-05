"""
构建 chess.gil：写入 levelScript.lua

阶段 A：不改模板，只注入脚本 —— 验证容器/长度处理
"""
import io, os, re, sys, hashlib

def vi(b, i):
    r=0;s=0
    while i < len(b):
        c=b[i]; i+=1
        r |= (c & 0x7f) << s
        if not (c & 0x80): return r, i
        s += 7
        if s > 63: break
    return None, i

def enc(n):
    o = bytearray()
    while True:
        c = n & 0x7f; n >>= 7
        if n: o.append(c | 0x80)
        else: o.append(c); break
    return bytes(o)

def fld_l(fn, payload):
    return enc((fn << 3) | 2) + enc(len(payload)) + payload

def parse_top(b):
    """返回 [(fn, wt, tagBytes, payloadBytes, rawBytes)]"""
    out = []; i = 0
    while i < len(b):
        st = i
        key, j = vi(b, i)
        if key is None: break
        fn, wt = key >> 3, key & 7
        i = j
        if wt == 0:
            v, i = vi(b, i)
            out.append({'fn': fn, 'wt': 0, 'raw': b[st:i], 'pay': enc(v), 'val': v})
            continue
        if wt == 2:
            ln, k = vi(b, i)
            out.append({'fn': fn, 'wt': 2, 'raw': b[st:k+ln], 'pay': b[k:k+ln], 'len': ln})
            i = k + ln; continue
        if wt == 5:
            out.append({'fn': fn, 'wt': 5, 'raw': b[st:i+4], 'pay': b[i:i+4]})
            i += 4; continue
        if wt == 1:
            out.append({'fn': fn, 'wt': 1, 'raw': b[st:i+8], 'pay': b[i:i+8]})
            i += 8; continue
        raise ValueError(f"unknown wire type {wt} at {st}")
    return out

def rebuild_top(fields):
    """按字段重建（长度自动重算）"""
    out = bytearray()
    for f in fields:
        if f['wt'] == 0:
            out += enc((f['fn'] << 3) | 0) + enc(f['val'])
        elif f['wt'] == 2:
            out += fld_l(f['fn'], f['pay'])
        elif f['wt'] == 5:
            out += enc((f['fn'] << 3) | 5) + f['pay']
        elif f['wt'] == 1:
            out += enc((f['fn'] << 3) | 1) + f['pay']
    return bytes(out)

def load(p):
    d = open(p, 'rb').read()
    return dict(
        total=int.from_bytes(d[0:4],'big'),
        ver=int.from_bytes(d[4:8],'big'),
        magic=int.from_bytes(d[8:12],'big'),
        nfrag=int.from_bytes(d[12:16],'big'),
        f0len=int.from_bytes(d[16:20],'big'),
        body=d[20:20+int.from_bytes(d[16:20],'big')],
        tail=d[20+int.from_bytes(d[16:20],'big'):],
        raw=d)

def save(path, g, body):
    tail = g['tail']
    out = (len(body) + 16 + len(tail) - 4 + 0).to_bytes(4,'big')
    # total = 文件总长 - 4 = (20 + len(body) + len(tail)) - 4
    total = 20 + len(body) + len(tail) - 4
    out = total.to_bytes(4,'big') + g['ver'].to_bytes(4,'big') \
        + g['magic'].to_bytes(4,'big') + g['nfrag'].to_bytes(4,'big') \
        + len(body).to_bytes(4,'big') + body + tail
    open(path, 'wb').write(out)
    return out

# ============ 主流程 ============
SRC_GIL = r"C:\Users\24037\Desktop\chess.gil"
OUT_GIL = r"out\交付包\chess-国际象棋.gil"
LUA     = r"lua\levelScript.lua"

g = load(SRC_GIL)
print(f"载入: {len(g['raw']):,} 字节  body={len(g['body']):,}  tail={len(g['tail'])}")

fields = parse_top(g['body'])
print(f"顶层字段 {len(fields)} 个")

# 1) 原样重建校验
plain = rebuild_top(fields)
print(f"原样重建 == 原 body ? {plain == g['body']}")

# 2) 读取脚本
lua = open(LUA, 'r', encoding='utf-8').read()
print(f"脚本: {len(lua):,} 字符 / {len(lua.encode('utf-8')):,} 字节")

# 3) 索引映射
IDX = {
    'CONTAINER_NODE_INDEX': 1073741906,
    'PREFAB_IMAGE':         1073741867,
    'PREFAB_TEXT_BOX':      1073741868,
    'PREFAB_CURSOR_AREA':   1073741869,
}
for k, v in IDX.items():
    # 匹配 "KEY = <数字>," 形式
    pat = re.compile(r'(\b' + k + r'\s*=\s*)\d+')
    n = len(pat.findall(lua))
    lua2 = pat.sub(lambda m: m.group(1) + str(v), lua)
    print(f"  {k:<22} -> {v}   替换 {n} 处")
    lua = lua2

# 4) 校验替换结果
for k, v in IDX.items():
    got = re.search(r'\b' + k + r'\s*=\s*(\d+)', lua)
    assert got and got.group(1) == str(v), f"{k} 替换失败"
print("  索引替换校验 OK")

# 5) 构造 Script 消息
script_id = 1073741826
name = 'chessChessProject'
src_bytes = lua.encode('utf-8')
script_msg = (
    enc((1 << 3) | 0) + enc(script_id) +
    fld_l(2, name.encode('utf-8')) +
    fld_l(3, (name + '.lua').encode('utf-8')) +
    fld_l(5, src_bytes)
)
# 外层再包一层 field 1（象棋存档里 Script 外层有个 field1 包装）
inner = fld_l(1, script_msg)

print(f"\nScript 消息: {len(inner):,} 字节  (源码 {len(src_bytes):,})")

# 6) 找 field 50 并替换
done = False
for f in fields:
    if f['fn'] == 50:
        print(f"  原 field50 len={f['len']} 内容={f['pay'].hex(' ')}")
        f['pay'] = inner
        f['len'] = len(inner)
        done = True
        break
assert done, "没找到 field 50"

newbody = rebuild_top(fields)
print(f"新 body = {len(newbody):,} 字节 (原 {len(g['body']):,}, 差 {len(newbody)-len(g['body']):+,})")

out = save(OUT_GIL, g, newbody)
print(f"已写出 {OUT_GIL}  ({len(out):,} 字节)")
print(f"SHA256 = {hashlib.sha256(out).hexdigest().upper()}")

# 7) 回读校验
h = load(OUT_GIL)
f2 = parse_top(h['body'])
ok50 = [x for x in f2 if x['fn'] == 50][0]
print(f"\n--- 回读校验 ---")
print(f"  新 field50 len={ok50['len']:,}")
print(f"  含 'function OnStart': {b'function OnStart' in ok50['pay']}")
print(f"  含 'PIECE_ART':        {b'PIECE_ART' in ok50['pay']}")
print(f"  含 '1073741906':       {b'1073741906' in ok50['pay']}")
print(f"  顶层字段数 = {len(f2)} (原 {len(fields)})")
# 除 field50 外其余字段是否未变
base = parse_top(g['body'])
same = all(a['raw'] == b['raw'] for a, b in zip(base, f2) if a['fn'] != 50)
print(f"  其余字段未变动: {same}")
