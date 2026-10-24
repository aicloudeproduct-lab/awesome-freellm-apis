"""Fine film grain tiles (seeded) used at low opacity to dither gradients."""
import os, sys
import numpy as np
from PIL import Image

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'grain')
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(20261023)
for k in range(6):
    n = rng.normal(0, 1, (960, 540))
    # slight blur so grain is ~1.5 px at 1080 wide (less codec stress)
    n = (n + np.roll(n, 1, 0) + np.roll(n, 1, 1)) / 3
    img = np.clip(128 + n * 52, 0, 255).astype(np.uint8)
    Image.fromarray(img, 'L').save(os.path.join(out, f'g{k}.png'), optimize=True)
print('grain ok')
