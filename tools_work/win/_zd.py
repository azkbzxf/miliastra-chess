from PIL import Image
im = Image.open(r"tools_work/win/shots/pv2.png")
im.crop((690, 420, 1220, 640)).resize((1590, 660), Image.LANCZOS).save(r"tools_work/win/shots/z_dlg.png")
print("ok")
