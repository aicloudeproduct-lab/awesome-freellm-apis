"""Audio QA: per-stem loudness, limiter load, and a spectrogram with event markers."""
import json, os, sys
import numpy as np
import pyloudnorm as pyln
from scipy.io import wavfile
from scipy import signal
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'audio', 'master.wav')
sr, x = wavfile.read(src)
x = x.astype(np.float64)
if x.dtype.kind == 'i' or np.max(np.abs(x)) > 2:
    x /= 32768.0
meter = pyln.Meter(sr)
print(f'{os.path.basename(src)}: {len(x)/sr:.2f}s, {meter.integrated_loudness(x):.2f} LUFS, sample peak {20*np.log10(np.max(np.abs(x))):.2f} dBFS')
stems = os.path.join(ROOT, 'build', 'audio', 'stems')
if os.path.isdir(stems) and len(sys.argv) <= 1:
    for f in sorted(os.listdir(stems)):
        _, s = wavfile.read(os.path.join(stems, f))
        rms = np.sqrt(np.mean(s.astype(np.float64) ** 2) + 1e-20)
        print(f'  stem {f:12s} rms {20*np.log10(rms):7.1f} dB  peak {20*np.log10(np.max(np.abs(s))+1e-12):6.1f} dB')
# loudness over time (short-term, 1 s windows)
win = sr
st = []
for i in range(0, len(x) - win, sr // 2):
    seg = x[i:i + win]
    st.append(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9))
print('rms per 0.5 s:', ' '.join(f'{v:.0f}' for v in st))
# silence check
print('silent (< -60 dB) windows:', sum(1 for v in st if v < -60))
# spectrogram picture
mono = x.mean(1)
f, t, S = signal.spectrogram(mono, sr, nperseg=2048, noverlap=1536)
S = 10 * np.log10(S + 1e-12)
keep = f < 8000
S = S[keep][::-1]
S = np.clip((S - (S.max() - 80)) / 80, 0, 1)
img = Image.fromarray((S * 255).astype(np.uint8)).resize((2000, 400))
img = img.convert('RGB')
d = ImageDraw.Draw(img)
ev = json.load(open(os.path.join(ROOT, 'build', 'events.json')))
X = lambda tt: int(tt / (len(x) / sr) * 2000)
for s in ev['steps']:
    d.line([(X(s['t']), 0), (X(s['t']), 30)], fill=(255, 80, 80), width=2)
for p in ev['prayers']:
    for k, c in (('kneel', (80, 200, 255)), ('release', (255, 220, 0)), ('bounce', (0, 255, 120))):
        d.line([(X(p[k]), 0), (X(p[k]), 60)], fill=c, width=2)
for s in range(21):
    d.text((X(s) + 2, 385), str(s), fill=(255, 255, 255))
out = os.path.join(ROOT, 'build', 'audio', 'spectrogram.png')
img.save(out)
print('spectrogram ->', out)
