"""Verify a rendered MP4: stream specs, audio loudness / silence, black frames,
abrupt colour jumps, and a contact sheet (one frame every 0.5 s).

Usage: python3 tools/verify.py output/final.mp4
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'output', 'final.mp4')
out_dir = os.path.join(ROOT, 'build', 'verify')
os.makedirs(out_dir, exist_ok=True)
ok = True


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def fail(msg):
    global ok
    ok = False
    print('  FAIL', msg)


# ---- streams
probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', src]).stdout)
v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
a = [s for s in probe['streams'] if s['codec_type'] == 'audio']
num, den = map(int, v['r_frame_rate'].split('/'))
fps = num / den
dur = float(probe['format']['duration'])
print(f"video: {v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {fps:.3f} fps {v['pix_fmt']} frames={v.get('nb_frames')} dur={dur:.3f}s")
if (v['codec_name'], v['width'], v['height'], v['pix_fmt']) != ('h264', 1080, 1920, 'yuv420p'):
    fail('video spec')
if abs(fps - 60) > 0.01:
    fail('fps')
if not a:
    fail('no audio stream')
else:
    s = a[0]
    print(f"audio: {s['codec_name']} {s['sample_rate']} Hz ch={s['channels']} layout={s.get('channel_layout')} bitrate={s.get('bit_rate')}")
    if (s['codec_name'], s['sample_rate'], s['channels']) != ('aac', '48000', 2):
        fail('audio spec')

# faststart: moov before mdat
with open(src, 'rb') as fh:
    head = fh.read(1 << 20)
moov, mdat = head.find(b'moov'), head.find(b'mdat')
print(f'faststart: moov@{moov} mdat@{mdat}')
if moov < 0 or (mdat >= 0 and moov > mdat):
    fail('moov atom not at front')

# ---- audio: extract and measure
wav = os.path.join(out_dir, 'extracted.wav')
run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-ac', '2', '-ar', '48000', wav])
r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
m_i = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)
m_tp = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r.stderr)
lufs = float(m_i[-1]) if m_i else float('nan')
tp = float(m_tp[-1]) if m_tp else float('nan')
print(f'audio loudness: {lufs:.1f} LUFS integrated, true peak {tp:.1f} dBTP')
if not (-17.5 <= lufs <= -14.5):
    fail('loudness off target')
if tp > -1.0:
    fail('true peak above -1 dBTP')
r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'silencedetect=noise=-55dB:d=0.5', '-f', 'null', '-'])
sil = re.findall(r'silence_start: ([\d.]+)', r.stderr)
print(f'silent stretches (< -55 dB for 0.5 s): {len(sil)} {sil[:5]}')
if sil:
    fail('silence in audio')

# ---- frames: decode small greyscale/colour thumbs for every frame
W, H = 54, 96
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
n = len(frames)
luma = frames.mean((1, 2, 3))
print(f'decoded frames: {n}  luma min {luma.min():.1f} max {luma.max():.1f}')
black = np.where(luma < 6)[0]
print(f'near-black frames (mean < 6/255): {len(black)}' + (f' at {black[:8]}…' if len(black) else ''))
if len([b for b in black if b < n - 20]) > 0:
    fail('black frames inside the film')
diff = np.abs(np.diff(frames.mean((1, 2)), axis=0)).max(1)
jumps = np.where(diff > 6)[0]
print(f'max frame-to-frame mean colour change: {diff.max():.2f} (/255) at frame {diff.argmax()}; jumps > 6: {len(jumps)}')
if len(jumps):
    fail(f'colour jumps at {jumps[:10]}')

# ---- contact sheet every 0.5 s
times = np.arange(0, min(dur, 20.0) - 0.05, 0.5)
thumbs = []
for t in times:
    p = os.path.join(out_dir, f'f_{t:05.2f}.png')
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', src, '-frames:v', '1', '-vf', 'scale=216:384', p])
    thumbs.append((t, Image.open(p).convert('RGB')))
cols = 10
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 216, rows * 404), (12, 12, 14))
d = ImageDraw.Draw(sheet)
for i, (t, im) in enumerate(thumbs):
    x, y = (i % cols) * 216, (i // cols) * 404
    sheet.paste(im, (x, y))
    d.text((x + 6, y + 386), f'{t:.1f}s', fill=(230, 230, 230))
sheet_path = os.path.join(out_dir, 'contact_sheet.jpg')
sheet.save(sheet_path, quality=88)
print('contact sheet ->', sheet_path)
print('RESULT:', 'PASS' if ok else 'CHECK FAILURES ABOVE')
sys.exit(0 if ok else 1)
