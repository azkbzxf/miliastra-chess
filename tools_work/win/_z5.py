from PIL import Image
im = Image.open(r"tools_work/win/shots/s5.png")
im.crop((1595, 95, 1920, 175)).resize((1300, 320), Image.LANCZOS).save(r"tools_work/win/shots/z_i5.png")
print("ok")
