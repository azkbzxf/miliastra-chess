from PIL import Image
im = Image.open(r"tools_work/win/shots/s4.png")
im.crop((1600, 95, 1920, 200)).resize((1280, 420), Image.LANCZOS).save(r"tools_work/win/shots/z_idx.png")
print("ok")
