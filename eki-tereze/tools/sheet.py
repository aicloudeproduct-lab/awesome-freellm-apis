"""Contact sheet from a list of images: python3 tools/sheet.py out.jpg cols img1 img2 ..."""
import sys
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
tw, th = 270, 480
rows = (len(files) + cols - 1) // cols
sh = Image.new('RGB', (cols * tw, rows * (th + 22)), (14, 14, 16))
d = ImageDraw.Draw(sh)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th))
    x, y = (i % cols) * tw, (i // cols) * (th + 22)
    sh.paste(im, (x, y)); d.text((x + 4, y + th + 4), f.split('/')[-1].replace('.jpg', ''), fill=(220, 220, 220))
sh.save(out, quality=88)
