from PIL import Image
im = Image.open(r"tools_work/win/shots/c1.png")
im.crop((0,0,700,40)).resize((2100,120), Image.LANCZOS).save(r"tools_work/win/shots/z_menubar.png")
print("ok")
