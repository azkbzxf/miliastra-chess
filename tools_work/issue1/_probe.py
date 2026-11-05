from PIL import Image
im = Image.open(r"tools_work/issue1/img1.png")
print("img1", im.size, im.mode)
# crop the region with red circles (roughly x 700..1500, y 780..1000 in 2737x1532?)
im2 = Image.open(r"tools_work/issue1/img2.png")
print("img2", im2.size, im2.mode)
