"""Бірнеше кадрды бір парақ (contact sheet) етіп жинайды.
Қолдану: python3 tools/contact.py out.png img1.png img2.png ... [--cols 3 --w 360]"""
import sys
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
cols, w, ratio = 3, 360, 0.75
if '--cols' in args:
    i = args.index('--cols'); cols = int(args[i + 1]); del args[i:i + 2]
if '--w' in args:
    i = args.index('--w'); w = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
h = int(w * ratio)
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols + 1) * 8, rows * (h + 30) + 8), (30, 30, 30))
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Medium.otf', 18)
d = ImageDraw.Draw(sheet)
for n, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = 8 + (n % cols) * (w + 8), 8 + (n // cols) * (h + 30)
    sheet.paste(im, (x, y + 22))
    d.text((x, y), f.split('/')[-1], fill=(220, 220, 220), font=font)
sheet.save(out)
print(out, sheet.size)
