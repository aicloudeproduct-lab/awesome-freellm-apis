"""public/grain/g0..g7.png — фильм дәні үшін детерминирленген шу тайлдары (512×512)."""
from pathlib import Path
import numpy as np
from PIL import Image
out = Path(__file__).resolve().parent.parent / 'public' / 'grain'
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(2027)
for i in range(8):
    n = rng.normal(128, 42, (512, 512)).clip(0, 255).astype(np.uint8)
    Image.fromarray(n, 'L').save(out / f'g{i}.png', optimize=True)
print('ok', sorted(p.name for p in out.iterdir()))
