from PIL import Image
import numpy as np

im = Image.open(r"tools_work/issue1/pc-initial.png").convert("RGB")
a = np.asarray(im).astype(int)
H, W, _ = a.shape
print("canvas", W, H)

# layout: cell = 900*0.78/8, boardLeft centred
boardSide = H * 0.78
cell = boardSide / 8
panelW = W * 0.22
panelLeft = W - panelW
boardLeft = (W - boardSide) / 2
if (W + boardSide) / 2 > panelLeft:
    boardLeft = (panelLeft - boardSide) / 2
boardBottom = (H - boardSide) / 2
print(f"cell={cell:.2f} boardLeft={boardLeft:.2f} boardBottom={boardBottom:.2f}")

def sq_png_box(sq):
    f = sq % 8; r = sq // 8
    x0 = boardLeft + f * cell
    y0 = boardBottom + r * cell          # math y (bottom-up)
    # convert to PNG coords (top-down)
    top = H - (y0 + cell)
    return x0, top, cell

# square colors
SQ_LIGHT = (247, 237, 221)
SQ_DARK = (205, 170, 132)

def analyse(sq, label):
    x0, top, c = sq_png_box(sq)
    xi, yi = int(round(x0)) + 3, int(round(top)) + 3
    w = int(round(c)) - 6
    sub = a[yi:yi+w, xi:xi+w]
    r, g, b = sub[:,:,0], sub[:,:,1], sub[:,:,2]
    # piece = pixels far from both square colours (dark piece or white piece w/ dark outline)
    def far(c1, c2):
        return (np.abs(r-c1[0]) + np.abs(g-c1[1]) + np.abs(b-c1[2]) > 90).all(axis=0) if sub.ndim==3 else None
    d_light = np.abs(r-SQ_LIGHT[0]) + np.abs(g-SQ_LIGHT[1]) + np.abs(b-SQ_LIGHT[2])
    d_dark  = np.abs(r-SQ_DARK[0])  + np.abs(g-SQ_DARK[1])  + np.abs(b-SQ_DARK[2])
    mask = (d_light > 90) & (d_dark > 90)
    if mask.sum() < 30:
        print(f"{label} sq{sq}: no piece")
        return
    ys, xs = np.nonzero(mask)
    bx0, bx1 = xs.min(), xs.max()
    by0, by1 = ys.min(), ys.max()
    ccx = (bx0 + bx1) / 2 + xi
    ccy = (by0 + by1) / 2 + yi
    # expected cell centre in png coords
    ex = x0 + c/2
    ey = top + c/2
    print(f"{label:8s} sq{sq:2d} bbox_w={bx1-bx0+1:5.1f} bbox_h={by1-by0+1:5.1f} "
          f"dx={ccx-ex:+6.2f} dy={ccy-ey:+6.2f}  (px)")

# rank1 (white back rank) sq 0..7 ; rank2 pawns sq 8..15
for sq in range(8):
    analyse(sq, "white")
for sq in range(8, 16):
    analyse(sq, "wpawn")
for sq in range(48, 56):
    analyse(sq, "bpawn")
for sq in range(56, 64):
    analyse(sq, "black")
