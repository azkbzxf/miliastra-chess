from PIL import Image
im = Image.open(r"tools_work/win/shots/ed.png")
# 顶部整条
im.crop((0, 0, 1920, 50)).resize((1920, 50), Image.LANCZOS).save(r"tools_work/win/shots/z_top.png")
# 右上角
im.crop((1600, 0, 1920, 50)).resize((1280, 200), Image.LANCZOS).save(r"tools_work/win/shots/z_tr.png")
# 左侧竖排图标
im.crop((0, 40, 60, 400)).resize((240, 1440), Image.LANCZOS).save(r"tools_work/win/shots/z_left.png")
print("ok")
