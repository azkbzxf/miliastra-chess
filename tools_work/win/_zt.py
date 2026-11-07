from PIL import Image
im = Image.open(r"tools_work/win/shots/lg3.png")
im.crop((0,0,400,120)).resize((1200,360), Image.LANCZOS).save(r"tools_work/win/shots/z_tl.png")
im.crop((1500,0,1920,120)).resize((1260,360), Image.LANCZOS).save(r"tools_work/win/shots/z_tr2.png")
print("ok")
