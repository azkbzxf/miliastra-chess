from PIL import Image
im = Image.open(r"tools_work/win/shots/full_now.png")
# 右上脚本面板
im.crop((1600, 300, 1920, 400)).resize((1280, 400), Image.LANCZOS).save(r"tools_work/win/shots/z_btn.png")
print("ok")
