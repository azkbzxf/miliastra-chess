from PIL import Image
import glob, os
for p in sorted(glob.glob(os.path.join(os.path.expanduser("~"), "AppData", "Local", "Temp", "**", "qxqy-play-*.png"), recursive=True))[:20]:
    print(p, Image.open(p).size)
