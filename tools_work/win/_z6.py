from PIL import Image
im = Image.open(r"tools_work/win/shots/full_now.png")
# 左侧上下两个列表都看
im.crop((0, 180, 330, 380)).resize((660, 400), Image.LANCZOS).save(r"tools_work/win/shots/z_top.png")
im.crop((0, 600, 330, 800)).resize((660, 400), Image.LANCZOS).save(r"tools_work/win/shots/z_bot.png")
print(im.size)
