from PIL import Image
im = Image.open(r"tools_work/issue1/pc-selection.png")
# PC 1600x900: cell=87.75, boardLeft=449, boardBottom=99. rank1 y=99..186 -> png y = 900-186..900-99
# crop the white back rank (rank1) plus rank2 for detail
crop = im.crop((440, 650, 1180, 790)).resize((2220, 420), Image.LANCZOS)
crop.save("tools_work/issue1/zoom_white_rank.png")
# black back rank: rank8 -> png y = 900-(99+7*87.75)-87.75
crop2 = im.crop((440, 95, 1180, 235)).resize((2220, 420), Image.LANCZOS)
crop2.save("tools_work/issue1/zoom_black_rank.png")
print("ok")
