#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
棋子剪影算法拟合 v3 —— 椭圆的并集（全局统一尺度 + 连通性修复）

三版演进，每一版都是被实测问题逼出来的
=====================================

v1（轴对齐椭圆贪心）
  兵/车/象 IoU 0.974~0.977 且肉眼很像。但：
    · 马 0.9165 —— 口鼻糊成一团，鬃毛缺口消失
    · 后 0.9267 —— 五根细冠尖被吃掉
    · 王 0.9736 —— 十字被压成一小段
  根因：**轴对齐椭圆画不出细长且倾斜的突出物**。冠尖、十字、鼻梁都超出它的能力。

v2（加"残差图像矩"趟，生成带旋转的细长椭圆）
  马 0.9165 → **0.9599**，口鼻和鬃毛缺口肉眼可见地出来了。
  但暴露三个新问题：
    (a) **后 0.9117 / 王 0.9591 反而退步** —— 上的三颗珠子悬空、王的十字横杠漂浮
        且竖杆整根丢失（连通分量检查：后有 4 个孤立岛 811px，王有 2 个，孤立 128px）
    (b) 车出现 `w=0.38 h=0.0085` 的**亚像素薄片**（81px 下厚 0.69px）—— 实机会消失或成毛刺
    (c) **我按每枚棋子自己的 bbox 裁切再拉伸，把相对大小抹平了** ——
        兵被放大到和王国一样高。原图里 6 枚是共用同一个 256×256 画框的，
        兵本来就比王矮一大截，这个比例必须保住。

v3（就是本文件）针对 (a)(b)(c) 各加一道工序
  (c) **全局 bbox**：6 枚一起算一个并集外接框，统一用它裁切+缩放 → 相对大小回来
  (b) **最小尺寸下限** MIN_DIM：短轴小于它的图元在 81px 下必然退化，直接拒绝
  (a) **连通性修复趟**：拟合完成后求并集的连通分量，把每个脱离主体的岛
      用一根"桥"接到主体最近的像素上。桥的走向正好就是原图里那根被漏掉的细杆
      （王的十字竖臂、后的珠柄），所以既修连通性又补内容。

坐标约定（与 sim/levelScript.lua 的 PIECE_ART 完全一致）
-------------------------------------------------------
  cx, cy  椭圆中心，0..1，左下原点、Y 向上
  w, h    椭圆宽高，0..1（相对棋子方框边长）
  rot     旋转角，度，**逆时针为正**
  shape   0=矩形 1=椭圆 2=三角
  role    0=外形

用法
----
    python tools_work/fit_pieces.py
"""

import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "out", "棋子素材-en-croissant", "png", "256")
DOCS = os.path.join(ROOT, "docs")

# 拟合分辨率。原图 256，但游戏里棋子方框只有 ~81px；
# 在 256 上拟合会把图元浪费在 81px 下看不见的细节上。128 兼顾保真与实用。
RES = 128

# 每枚棋子上限。32 枚常驻，每个图元 2 个 UI 控件（描边层+填充层）：
#   20 个/枚 → 32×20×2 = 1280 控件，与 v1.6 持平，可接受。
MAX_SHAPES = 20

# 最小短轴。81px 棋子方框下，0.02 → 1.6px，是能稳定渲染的底线。
# 比它更细的图元实机会糊成一团或直接消失（v2 的 0.0085 就是这个问题）。
MIN_DIM = 0.020

# 连通性桥接的最小宽度（同样按 81px 反算，0.022 → 1.8px）
BRIDGE_W = 0.026

PIECES = [
    ("PAWN", "PW"),
    ("KNIGHT", "NW"),
    ("BISHOP", "BW"),
    ("ROOK", "RW"),
    ("QUEEN", "QW"),
    ("KING", "KW"),
]


# ----------------------------------------------------------------------------
# 剪影提取
# ----------------------------------------------------------------------------
def flood_outside(m):
    """从四边泛洪出"外部空气"，返回 outside 掩膜。纯 numpy。"""
    outside = np.zeros_like(m, dtype=bool)
    frontier = np.zeros_like(m, dtype=bool)
    frontier[0, :] = ~m[0, :]
    frontier[-1, :] = ~m[-1, :]
    frontier[:, 0] = ~m[:, 0]
    frontier[:, -1] = ~m[:, -1]
    while frontier.any():
        outside |= frontier
        grown = np.zeros_like(m, dtype=bool)
        grown[1:, :] |= frontier[:-1, :]
        grown[:-1, :] |= frontier[1:, :]
        grown[:, 1:] |= frontier[:, :-1]
        grown[:, :-1] |= frontier[:, 1:]
        frontier = grown & ~m & ~outside
    return outside


def global_bbox():
    """
    6 枚共用同一个裁切框 —— 这是保住"兵比王矮"这个相对比例的关键。

    原图 12 张都是画在同一个 256×256 画框里的（同一套缩放与基线），
    所以正确做法是：把所有 6 枚的非透明区域并起来取外接框，6 枚都用它。
    按每枚自己的 bbox 裁切会把兵放大到和王一样高（v2 犯的错）。
    """
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    for _, code in PIECES:
        img = Image.open(os.path.join(SRC, code + ".png")).convert("RGBA")
        bb = img.getbbox()
        if bb is None:
            continue
        x0 = min(x0, bb[0])
        y0 = min(y0, bb[1])
        x1 = max(x1, bb[2])
        y1 = max(y1, bb[3])
    # 取正方形并略留边，避免贴边
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    side = max(x1 - x0, y1 - y0) * 1.06
    half = side / 2.0
    return (int(round(cx - half)), int(round(cy - half)),
            int(round(cx + half)), int(round(cy + half)))


def load_mask(code, gbox):
    """读 PNG → 实心剪影布尔数组（RES×RES，[0]=顶部行），用全局框裁切。"""
    img = Image.open(os.path.join(SRC, code + ".png")).convert("RGBA")
    img = img.crop(gbox)
    img = img.resize((RES, RES), Image.LANCZOS)
    alpha = np.asarray(img, dtype=np.uint8)[:, :, 3]
    m = alpha > 128
    outside = flood_outside(m)
    return m | (~outside & ~m)


# ----------------------------------------------------------------------------
# 栅格化（必须与游戏端语义一致，否则 IoU 没有意义）
# ----------------------------------------------------------------------------
YY, XX = np.mgrid[0:RES, 0:RES]
PX = (XX + 0.5) / RES
PY = (YY + 0.5) / RES


def raster_ellipse(cx, cy, w, h, rot=0.0):
    """游戏坐标（Y 向上、左下原点）→ 像素掩膜（Y 向下、左上原点）。"""
    gx = PX - cx
    gy = (1.0 - PY) - cy
    if rot:
        a = -np.deg2rad(rot)       # 像素系 Y 向下，旋转方向相反
        ca, sa = np.cos(a), np.sin(a)
        rx = gx * ca - gy * sa
        ry = gx * sa + gy * ca
    else:
        rx, ry = gx, gy
    dx = rx / max(w * 0.5, 1e-9)
    dy = ry / max(h * 0.5, 1e-9)
    return (dx * dx + dy * dy) <= 1.0


def raster_rect(cx, cy, w, h):
    """轴对齐矩形（游戏坐标 cx/cy 为中心）。"""
    gx = np.abs(PX - cx)
    gy = np.abs((1.0 - PY) - cy)
    return (gx <= w * 0.5) & (gy <= h * 0.5)


def union_of(shapes):
    cov = np.zeros((RES, RES), dtype=bool)
    for s in shapes:
        if s[0] == 0:
            cov |= raster_rect(s[1], s[2], s[3], s[4])
        else:
            cov |= raster_ellipse(s[1], s[2], s[3], s[4], s[5])
    return cov


def iou_of(shapes, mask):
    cov = union_of(shapes)
    inter = np.count_nonzero(cov & mask)
    union = np.count_nonzero(cov | mask)
    return (inter / union if union else 0.0), cov


# ----------------------------------------------------------------------------
# 连通分量
# ----------------------------------------------------------------------------
def label_components(mask):
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys, xs):
        if labels[sy, sx] != 0:
            continue
        n += 1
        stack = [(sy, sx)]
        labels[sy, sx] = n
        while stack:
            y, x = stack.pop()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and labels[ny, nx] == 0:
                    labels[ny, nx] = n
                    stack.append((ny, nx))
    return labels, n


def moment_ellipse(region):
    """对一个连通区域求图像矩 → (cx, cy, w, h, rot)，游戏坐标系。"""
    ys, xs = np.nonzero(region)
    if len(xs) < 4:
        return None
    gx = (xs + 0.5) / RES
    gy = 1.0 - (ys + 0.5) / RES
    cx, cy = gx.mean(), gy.mean()
    dx = gx - cx
    dy = gy - cy
    mxx = float((dx * dx).mean())
    myy = float((dy * dy).mean())
    mxy = float((dx * dy).mean())
    tr = mxx + myy
    det = mxx * myy - mxy * mxy
    disc = max(0.0, tr * tr / 4.0 - det)
    l1 = tr / 2.0 + np.sqrt(disc)
    l2 = max(1e-9, tr / 2.0 - np.sqrt(disc))
    if abs(mxy) < 1e-12:
        theta = 0.0 if mxx >= myy else np.pi / 2.0
    else:
        theta = np.arctan2(l1 - mxx, mxy)
    a = 2.0 * np.sqrt(max(l1, 1e-9)) * 1.15
    b = 2.0 * np.sqrt(l2) * 1.30
    rot = float(np.rad2deg(theta))
    if a >= b:
        w, h, r = 2 * a / 2.0, 2 * b / 2.0, rot
    else:
        w, h, r = 2 * b / 2.0, 2 * a / 2.0, rot + 90.0
    while r > 90.0:
        r -= 180.0
    while r <= -90.0:
        r += 180.0
    return (float(cx), float(cy), float(max(w, MIN_DIM)), float(max(h, MIN_DIM)), float(r))


# ----------------------------------------------------------------------------
# 拟合
# ----------------------------------------------------------------------------
def fit(mask):
    total = np.count_nonzero(mask)
    covered = np.zeros_like(mask)
    shapes = []

    n_grid = 24
    cx_list = (np.arange(n_grid) + 0.5) / n_grid
    size_list = np.array([0.10, 0.14, 0.18, 0.23, 0.29, 0.36, 0.44, 0.54])
    aspects = np.array([0.45, 0.7, 1.0, 1.45, 2.2])

    # 主体阶段用 60% 预算，剩下的留给细件与桥接。
    # v2 用 65% 导致 main_budget=13，6 枚里 4 枚把预算全花在主体上、细件趟 0 产出。
    main_budget = max(4, int(MAX_SHAPES * 0.60))

    # ---- 第一趟：椭圆 + 矩形，贪心覆盖主体块面 ----
    # 【为什么要加矩形候选】纯椭圆画不出**方正的直边**：车的三个垛口如果只用椭圆，
    # 会变成两个圆耳朵（实测截图），象的帽尖、王的十字竖臂也会被磨圆。
    # 每轮同时评估「椭圆候选」和「矩形候选」，取增益大的那个 ——
    # 曲线处椭圆赢，直边处矩形赢，两者自然分配。
    for _ in range(main_budget):
        remaining = mask & ~covered
        if np.count_nonzero(remaining) < total * 0.004:
            break
        best, best_score = None, 0.0
        for cx in cx_list:
            for cy in cx_list:
                for s in size_list:
                    for a in aspects:
                        w, h = s, s * a
                        if min(w, h) < MIN_DIM:
                            continue
                        ix, iy = int(cx * RES), int((1.0 - cy) * RES)
                        if not (0 <= ix < RES and 0 <= iy < RES):
                            continue
                        r = max(1, int(max(w, h) * RES * 0.5))
                        y0, y1 = max(0, iy - r), min(RES, iy + r + 1)
                        x0, x1 = max(0, ix - r), min(RES, ix + r + 1)
                        if not remaining[y0:y1, x0:x1].any():
                            continue
                        for kind, raster in ((1, raster_ellipse), (0, raster_rect)):
                            m = raster(cx, cy, w, h) if kind == 0 else raster(cx, cy, w, h)
                            gain = np.count_nonzero(m & remaining)
                            if gain == 0:
                                continue
                            loss = np.count_nonzero(m & ~mask)
                            score = gain - 2.0 * loss
                            # 同样得分时优先椭圆：曲线更柔和，直边只在矩形明显更优时才用
                            if kind == 0:
                                score -= 1.0
                            if score > best_score:
                                best_score, best = score, (kind, cx, cy, w, h, 0.0)
        if best is None:
            break
        shapes.append(best)
        covered |= union_of([best])

    # ---- 第二趟：残差连通块 → 图像矩椭圆（救细长倾斜件）----
    # 验收从 `gain - 2*loss > 0` 放宽到 `gain - 1.4*loss > 0`，
    # 因为细件本身很细，稍有余量就会被 2.0 的惩罚系数否掉（v2 的 0 产出来源）。
    detail_budget = MAX_SHAPES - len(shapes)
    for _ in range(detail_budget):
        remaining = mask & ~covered
        if np.count_nonzero(remaining) < total * 0.002:
            break
        labels, n = label_components(remaining)
        if n == 0:
            break
        comps = []
        for lb in range(1, n + 1):
            reg = (labels == lb)
            area = int(np.count_nonzero(reg))
            if area >= max(5, total * 0.0015):
                comps.append((area, reg))
        comps.sort(reverse=True, key=lambda t: t[0])
        if not comps:
            break

        picked = None
        for area, reg in comps:
            ell = moment_ellipse(reg)
            if ell is None:
                continue
            cx, cy, w, h, rot = ell
            m = raster_ellipse(cx, cy, w, h, rot)
            gain = np.count_nonzero(m & remaining)
            loss = np.count_nonzero(m & ~mask)
            if gain - 1.4 * loss > 0:
                picked = (1, cx, cy, w, h, rot)
                break
        if picked is None:
            break
        shapes.append(picked)
        covered |= union_of([picked])

    # ---- 第三趟：连通性修复（桥接悬空岛）----
    # v2 的致命缺陷：后的上三颗珠、王的十字横杠浮在半空，实机上就是"断开的棋子"。
    # 做法：求并集的连通分量 → 取最大者为身体 → 每个脱离的岛，
    #       从它的质心朝身体最近的像素画一根细椭圆当桥。
    # 这根桥的走向恰好就是原图里被漏掉的细杆（王的十字竖臂、后的珠柄），
    # 所以既修连通性又补回了内容。
    for _ in range(6):
        cov = union_of(shapes)
        labels, n = label_components(cov)
        if n <= 1:
            break
        # 最大分量 = 身体
        sizes = [(int(np.count_nonzero(labels == lb)), lb) for lb in range(1, n + 1)]
        sizes.sort(reverse=True)
        body_lb = sizes[0][1]
        body_pts = np.argwhere(labels == body_lb)

        bridged = False
        for area, lb in sizes[1:]:
            if area < 4:
                continue
            isle_pts = np.argwhere(labels == lb)
            ic = isle_pts.mean(axis=0)                # (y, x)
            # 身体上离岛质心最近的点
            d2 = ((body_pts[:, 0] - ic[0]) ** 2 + (body_pts[:, 1] - ic[1]) ** 2)
            bp = body_pts[int(np.argmin(d2))]
            # 两端各伸进对方一点，保证真的接上
            y_a, x_a = ic
            y_b, x_b = bp
            # 转游戏坐标
            gx_a, gy_a = (x_a + 0.5) / RES, 1.0 - (y_a + 0.5) / RES
            gx_b, gy_b = (x_b + 0.5) / RES, 1.0 - (y_b + 0.5) / RES
            cxb, cyb = (gx_a + gx_b) / 2.0, (gy_a + gy_b) / 2.0
            dx, dy = gx_b - gx_a, gy_b - gy_a
            L = float(np.hypot(dx, dy))
            # 加长一点，两端都咬进实体
            L2 = max(L + 0.05, BRIDGE_W * 1.5)
            rotb = float(np.rad2deg(np.arctan2(dy, dx)))
            shapes.append((1, cxb, cyb, L2, BRIDGE_W, rotb))
            bridged = True
            break
        if not bridged:
            break

    # ---- 第四趟：坐标下降微调（位置/尺寸/旋转）----
    best_iou, _ = iou_of(shapes, mask)
    for _ in range(4):
        improved = False
        for i in range(len(shapes)):
            shp, cx, cy, w, h, rot = shapes[i]
            trials = []
            for d in (1.0 / 64, 1.0 / 128):
                trials += [
                    (cx + d, cy, w, h, rot), (cx - d, cy, w, h, rot),
                    (cx, cy + d, w, h, rot), (cx, cy - d, w, h, rot),
                    (cx, cy, w + d, h, rot), (cx, cy, w - d, h, rot),
                    (cx, cy, w, h + d, rot), (cx, cy, w, h - d, rot),
                ]
            for dr in (3.0, -3.0):
                trials.append((cx, cy, w, h, rot + dr))
            for t in trials:
                ncx, ncy, nw, nh, nr = t
                if nw < MIN_DIM or nh < MIN_DIM:
                    continue
                if not (0.0 < ncx < 1.0 and 0.0 < ncy < 1.0):
                    continue
                cand = list(shapes)
                cand[i] = (shp, ncx, ncy, nw, nh, nr)
                v, _ = iou_of(cand, mask)
                if v > best_iou + 1e-7:
                    best_iou = v
                    shapes = cand
                    improved = True
                    cx, cy, w, h, rot = ncx, ncy, nw, nh, nr
        if not improved:
            break

    shapes.sort(key=lambda s: s[3] * s[4], reverse=True)
    return shapes


# ----------------------------------------------------------------------------
# 主流程
# ----------------------------------------------------------------------------
def main():
    gbox = global_bbox()
    print("global bbox:", gbox)
    sys.stdout.flush()

    results = {}
    for name, code in PIECES:
        mask = load_mask(code, gbox)
        shapes = fit(mask)
        iou, cov = iou_of(shapes, mask)
        inter = np.count_nonzero(cov & mask)
        recall = inter / max(1, np.count_nonzero(mask))
        precision = inter / max(1, np.count_nonzero(cov))
        labels, ncomp = label_components(cov)
        results[name] = {"shapes": shapes, "iou": iou, "recall": recall,
                         "precision": precision, "count": len(shapes),
                         "components": int(ncomp)}
        mins = min(min(s[3], s[4]) for s in shapes) if shapes else 0
        print("%-7s shapes=%2d  IoU=%.4f  recall=%.4f  precision=%.4f  comps=%d  min_dim=%.4f"
              % (name, len(shapes), iou, recall, precision, ncomp, mins))
        sys.stdout.flush()

    lua_path = os.path.join(DOCS, "pieces-fit-generated.lua")
    with open(lua_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("-- 自动生成，勿手改。重新生成：python tools_work/fit_pieces.py\n")
        f.write("-- 六枚棋子的剪影拟合（椭圆的并集；role 全为 0 外形）。\n")
        f.write("-- 白黑共用同一套形状：渲染时白子画白填充+深描边，黑子画深填充+浅描边。\n")
        f.write("-- 六枚共用同一个全局裁切框，因此**相对大小是保住的**（兵本来就比王矮）。\n")
        f.write("-- 坐标：cx/cy 椭圆中心，0..1，左下原点、Y 向上；w/h 相对棋子方框；rot 度，逆时针为正。\n\n")
        for name, _ in PIECES:
            r = results[name]
            f.write("  -- %s：%d 图元，IoU %.4f，连通分量 %d\n"
                    % (name, r["count"], r["iou"], r["components"]))
            f.write("  [%s] = {\n" % name)
            for shp, cx, cy, w, h, rot in r["shapes"]:
                f.write("    { %d, %.4f, %.4f, %.4f, %.4f, %.2f, 0 },\n"
                        % (shp, cx, cy, w, h, rot))
            f.write("  },\n")
    print("wrote", lua_path)

    json_path = os.path.join(DOCS, "pieces-fit-generated.json")
    with open(json_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"global_bbox": list(gbox),
                   "pieces": {k: {"shapes": v["shapes"], "iou": v["iou"],
                                  "recall": v["recall"], "precision": v["precision"],
                                  "components": v["components"]}
                              for k, v in results.items()}},
                  f, ensure_ascii=False, indent=2)
    print("wrote", json_path)

    CELL = 160
    sheet = Image.new("RGB", (CELL * len(PIECES), CELL * 3), (24, 24, 28))
    for i, (name, code) in enumerate(PIECES):
        mask = load_mask(code, gbox)
        _, cov = iou_of(results[name]["shapes"], mask)

        def to_img(arr, fg):
            a = (arr * 255).astype(np.uint8)
            out = np.zeros((RES, RES, 3), dtype=np.uint8)
            for ch in range(3):
                out[:, :, ch] = (np.full((RES, RES), fg[ch], np.float32) *
                                 (a.astype(np.float32) / 255.0)).astype(np.uint8)
            return Image.fromarray(out, "RGB").resize((CELL, CELL), Image.NEAREST)

        diff = np.zeros((RES, RES, 3), dtype=np.uint8)
        diff[mask & cov] = (60, 180, 90)
        diff[~mask & cov] = (220, 70, 60)
        diff[mask & ~cov] = (70, 120, 220)

        sheet.paste(to_img(mask, (235, 235, 235)), (i * CELL, 0))
        sheet.paste(to_img(cov, (120, 220, 140)), (i * CELL, CELL))
        sheet.paste(Image.fromarray(diff, "RGB").resize((CELL, CELL), Image.NEAREST),
                    (i * CELL, CELL * 2))

    prev = os.path.join(DOCS, "pieces-fit-preview.png")
    sheet.save(prev)
    print("wrote", prev)

    print("\n=== summary ===")
    total_shapes = sum(v["count"] for v in results.values())
    for name, _ in PIECES:
        v = results[name]
        print("%-7s %2d shapes  IoU %.4f  comps %d"
              % (name, v["count"], v["iou"], v["components"]))
    print("total %d shapes, mean IoU %.4f"
          % (total_shapes,
             sum(v["iou"] for v in results.values()) / len(results)))


if __name__ == "__main__":
    main()
