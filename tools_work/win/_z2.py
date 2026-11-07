from PIL import Image
im = Image.open(r"tools_work/win/shots/s3.png")
# 右下角 添加脚本 按钮区
im.crop((1580, 1000, 1920, 1080)).resize((1020, 240), Image.LANCZOS).save(r"tools_work/win/shots/z_addbtn.png")
# 模板列表
im.crop((0, 190, 320, 380)).resize((640, 380), Image.LANCZOS).save(r"tools_work/win/shots/z_list.png")
print("ok")
