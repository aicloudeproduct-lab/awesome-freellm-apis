"""Дайын MP4-ті тексереді: метадеректер, қара/бос кадрлар, кадр аралық секірістер, бақылау кадрлары.
Қолдану: python3 tools/verify.py out/8-qadam.mp4"""
import json, subprocess, sys
from pathlib import Path
import numpy as np

mp4 = Path(sys.argv[1] if len(sys.argv) > 1 else 'out/8-qadam.mp4')
root = mp4.resolve().parent.parent
info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(mp4)]))
v = next(s for s in info['streams'] if s['codec_type'] == 'video')
a = [s for s in info['streams'] if s['codec_type'] == 'audio']
nb = subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', str(mp4)]).decode().strip()
print('=== метадеректер ===')
print(f"өлшем: {v['width']}x{v['height']}  кодек: {v['codec_name']} ({v.get('profile')}, level {v.get('level')})  pix_fmt: {v['pix_fmt']}")
print(f"кадр жиілігі: {v['r_frame_rate']} (avg {v['avg_frame_rate']})  кадр саны: {nb}")
print(f"ұзақтығы: {float(info['format']['duration']):.3f} с  бит жиілігі: {int(info['format']['bit_rate']) / 1e6:.1f} Мбит/с  файл: {int(info['format']['size']) / 1e6:.1f} МБ")
print('аудио:', f"{a[0]['codec_name']} {a[0]['sample_rate']} Гц {a[0]['channels']} арна" if a else 'ЖОҚ')

# барлық кадрды кішірейтіп оқу (декодтау тексерісі де осы)
w, h = 135, 240
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(mp4), '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
mean = fr.mean((1, 2)); diff = np.abs(np.diff(fr, axis=0)).mean((1, 2))
print('\n=== кадр талдауы ===')
print(f'декодталған кадр: {len(fr)}')
print(f'орташа жарықтық: мин {mean.min():.1f} (кадр {mean.argmin()}), макс {mean.max():.1f}')
dark = np.where(mean < 6)[0]
print('қара кадрлар (<6/255):', list(dark) if len(dark) else 'жоқ')
print(f'кадр аралық айырма: медиана {np.median(diff):.2f}, макс {diff.max():.2f}')
thr = max(6 * np.median(diff), 4.0)
spikes = [(int(i), round(float(d), 2)) for i, d in enumerate(diff) if d > thr]
print(f'секіріс/жыпылық күдігі (> {thr:.1f}):', spikes if spikes else 'жоқ')
flick = [int(i) for i in range(1, len(diff)) if diff[i - 1] > 3 and diff[i] > 3 and abs(mean[i + 1] - mean[i - 1]) < 0.5 and abs(mean[i] - mean[i - 1]) > 2]
print('жарықтықтың жыпылықтауы (A→B→A):', flick if flick else 'жоқ')
print('қатып қалған ұзақ бөліктер:', end=' ')
still = diff < 0.02; runs, s0 = [], None
for i, x in enumerate(still):
    if x and s0 is None: s0 = i
    if not x and s0 is not None:
        if i - s0 > 15: runs.append((s0, i))
        s0 = None
if s0 is not None and len(still) - s0 > 15: runs.append((s0, len(still)))
print(runs if runs else 'жоқ')

# бақылау кадрлары
out = root / 'tests' / 'mp4'; out.mkdir(parents=True, exist_ok=True)
times = [0.0, 0.5, 1.0, 1.8, 2.6, 3.6, 4.0, 4.3, 5.0, 6.3, 6.5, 7.7, 9.0, 10.2, 12.0, 14.6, 17.0, 19.6, 22.0, 23.0, 24.0, 24.5, 26.0, 28.0, 29.2, 30.0, 31.97]
for tt in times:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(tt), '-i', str(mp4), '-frames:v', '1', str(out / f'v_{tt:05.2f}.png')], check=True)
print('\nбақылау кадрлары:', out)
