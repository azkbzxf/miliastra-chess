from PIL import Image
im = Image.open('tools_work/issue3/issue3.png').convert('RGB')
W,H = im.size
px = im.load()
from collections import Counter
c = Counter()
# sample board interior, print most common colors
for y in range(300, 1000, 3):
    for x in range(330, 1320, 3):
        c[px[x,y]] += 1
for col, n in c.most_common(20):
    print(col, n)
