"""Дайын MP4-ті тексеру: өлшем, кадр саны, ұзақтық, аудио; қара/бос кадрлар; көрініс шекараларындағы секірістер мен жыпылықтау.
Қолдану: python3 tools/qc_video.py out/bagym_3d_final.mp4"""
import json, subprocess, sys
import numpy as np

mp4 = sys.argv[1]
info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4]))
v = next(s for s in info['streams'] if s['codec_type'] == 'video'); a = [s for s in info['streams'] if s['codec_type'] == 'audio']
nb = subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', mp4]).decode().strip()
print(f"өлшем {v['width']}x{v['height']} | {v['codec_name']} {v.get('profile')} | {v['pix_fmt']} | {v['r_frame_rate']} fps | кадр {nb} | ұзақтық {float(info['format']['duration']):.3f} с | {int(info['format']['size'])/1e6:.1f} МБ")
print('аудио:', f"{a[0]['codec_name']} {a[0]['sample_rate']} Гц {a[0]['channels']} арна, {float(a[0]['duration']):.3f} с" if a else 'ЖОҚ')
w, h = 256, 192
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
mean = fr.mean((1, 2)); diff = np.abs(np.diff(fr, axis=0)).mean((1, 2))
print(f'декодталған кадр {len(fr)} | жарықтық мин {mean.min():.1f} (кадр {mean.argmin()}) макс {mean.max():.1f}')
print('қара кадрлар (<3):', [int(i) for i in np.where(mean < 3)[0]] or 'жоқ')
med = np.median(diff); thr = max(6 * med, 3.0)
print(f'кадр аралық айырма: медиана {med:.2f}, макс {diff.max():.2f} (кадр {diff.argmax()}→{diff.argmax()+1})')
print('секіріс күдігі:', [(int(i), round(float(d), 2)) for i, d in enumerate(diff) if d > thr] or 'жоқ')
fl = [int(i) for i in range(1, len(diff)) if diff[i-1] > 1.5 and diff[i] > 1.5 and abs(mean[i+1] - mean[i-1]) < 0.3 and abs(mean[i] - mean[i-1]) > 1.2]
print('жыпылықтау (A→B→A):', fl or 'жоқ')
# шот шекаралары (out/events.json): әр монтаждық кесіндегі айырма — кесу/ауысу күтілетін жерлер
import os
ev = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'out', 'events.json')
cuts = [round(s['t'] * 30) for s in json.load(open(ev))['shots']][1:] if os.path.exists(ev) else []
fps = 30 * len(fr) / 2700
for c in cuts:
    i = int(round(c * fps / 30)); seg = diff[max(0, i - 4):i + 4]
    print(f'  шекара {c / 30:5.2f} с: айырма макс {seg.max():.2f}, жарықтық {mean[i-1]:.1f}→{mean[i]:.1f}')
exp = set(int(round(c * fps / 30)) - 1 for c in cuts)
unexp = [(int(i), round(float(d), 2)) for i, d in enumerate(diff) if d > thr and not any(abs(i - e) <= 1 for e in exp)]
print('шот шекарасынан тыс секірістер:', unexp or 'жоқ')
