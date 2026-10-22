"""QC кадрларынан парақ жинау: python3 tools/sheet.py out/qc/sheet.png out/qc/f_*.png [--cols 2] [--w 1000]"""
import sys
from PIL import Image, ImageDraw, ImageFont
a = sys.argv[1:]
cols = int(a[a.index('--cols') + 1]) if '--cols' in a else 2
w = int(a[a.index('--w') + 1]) if '--w' in a else 960
a = [x for i, x in enumerate(a) if x not in ('--cols', '--w') and (i == 0 or a[i - 1] not in ('--cols', '--w'))]
out, files = a[0], a[1:]
h = int(w * 0.75)
rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * (w + 8) + 8, rows * (h + 34) + 8), (36, 36, 36))
f = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Medium.otf', 22)
d = ImageDraw.Draw(S)
for i, fn in enumerate(files):
    x, y = 8 + (i % cols) * (w + 8), 8 + (i // cols) * (h + 34)
    S.paste(Image.open(fn).convert('RGB').resize((w, h), Image.LANCZOS), (x, y + 30))
    fr = int(fn.split('_')[-1].split('.')[0]); d.text((x, y + 2), f'{fn.split("/")[-1]}  ({fr/30:.2f} s)', fill=(230, 230, 230), font=f)
S.save(out); print(out, S.size)
