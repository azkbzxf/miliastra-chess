from PIL import Image
im = Image.open(r"tools_work/issue1/img1.png")
# red circle / green dot region: downscale factor known: preview was 2737 wide for 2885 => 1.054
# In the preview, red circles around x 640..960, y 600..740 (2000x1120-ish preview)
# Original: x*1.0528, y*1.0528 -> use generous window
crop = im.crop((600, 520, 1500, 900)).resize((1800, 760), Image.LANCZOS)
crop.save("tools_work/issue1/crop_hl.png")
# whole board top-left quadrant for piece skew
crop2 = im.crop((780, 150, 1300, 480)).resize((1560, 990), Image.LANCZOS)
crop2.save("tools_work/issue1/crop_pieces.png")
im2 = Image.open(r"tools_work/issue1/img2.png")
crop3 = im2.crop((630, 120, 960, 320)).resize((1320, 800), Image.LANCZOS)
crop3.save("tools_work/issue1/crop_q_r.png")
crop4 = im2.crop((110, 890, 300, 1090)).resize((760, 800), Image.LANCZOS)
crop4.save("tools_work/issue1/crop_pawn.png")
print("ok")
