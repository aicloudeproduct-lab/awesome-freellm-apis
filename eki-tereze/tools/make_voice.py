"""Kazakh voices for «Екі терезе» with Piper + ISSAI KazakhTTS (CC-BY-4.0).

Reads src/config/lines.json, renders every line (parts joined by pauses),
shapes each character's voice (pitch, formants, tone), and writes
  build/voice/<id>.wav    48 kHz mono, trimmed
  build/voice.json        start, duration, part timings, 24 fps mouth envelope
                          (open = jaw opening 0..1, round = lip rounding 0..1)
The model is expected in voices/kk-issai-high.onnx (see README for download).
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CFG = json.load(open(os.path.join(ROOT, 'src', 'config', 'lines.json')))
MODEL = os.path.join(ROOT, 'voices', 'kk-issai-high.onnx')
OUT = os.path.join(ROOT, 'build', 'voice')
SR = 48000
FPS = 24
os.makedirs(OUT, exist_ok=True)


def piper(text, v, path):
    cmd = [sys.executable, '-m', 'piper', '-m', MODEL, '-s', str(v['speaker']), '--length-scale', str(v['length']),
           '--noise-scale', str(v.get('noise', 0.6)), '--noise-w-scale', '0.7', '-f', path]
    subprocess.run(cmd, input=text.encode('utf-8'), check=True, capture_output=True)


def read(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(1)
    return sr, x / 32768.0


def trim(x, thr=0.008, pad=0.03):
    env = np.convolve(np.abs(x), np.ones(240) / 240, 'same')
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(x), idx[-1] + int(pad * SR))
    return x[a:b]


def shape(x, v):
    """Pitch / formant via rubberband, then tone."""
    tmp_in = tempfile.mktemp(suffix='.wav')
    tmp_out = tempfile.mktemp(suffix='.wav')
    wavfile.write(tmp_in, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    semis = v.get('pitch', 0.0)
    af = []
    if abs(semis) > 0.01:
        formant = 'shifted' if v.get('formant') else 'preserved'
        af.append(f'rubberband=pitch={2 ** (semis / 12):.5f}:formant={formant}:pitchq=quality')
    if v.get('radio'):
        af.append('highpass=f=320,lowpass=f=3600,acompressor=threshold=-18dB:ratio=3')
    w = v.get('warmth', 0)
    if w > 0:
        af.append(f'bass=g={2.5 * w}:f=180,treble=g={-1.5 * w}:f=6500')
    af.append('highpass=f=70')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp_in, '-af', ','.join(af), '-ar', str(SR), tmp_out], check=True)
    _, y = read(tmp_out)
    os.remove(tmp_in)
    os.remove(tmp_out)
    return y


def mouth(x):
    """Per-frame jaw opening and lip rounding from the waveform."""
    hop = SR // FPS
    n = int(np.ceil(len(x) / hop))
    lo = signal.sosfilt(signal.butter(2, [200, 900], 'bandpass', fs=SR, output='sos'), x)
    hi = signal.sosfilt(signal.butter(2, [1200, 3500], 'bandpass', fs=SR, output='sos'), x)
    rms = np.zeros(n)
    rnd = np.zeros(n)
    for i in range(n):
        seg = x[i * hop:(i + 1) * hop]
        rms[i] = np.sqrt(np.mean(seg ** 2) + 1e-12)
        e_lo = np.mean(lo[i * hop:(i + 1) * hop] ** 2) + 1e-12
        e_hi = np.mean(hi[i * hop:(i + 1) * hop] ** 2) + 1e-12
        rnd[i] = e_lo / (e_lo + e_hi)
    ref = np.percentile(rms[rms > 1e-4], 92) if np.any(rms > 1e-4) else 1
    op = np.clip((rms / ref) ** 0.8, 0, 1)
    op[rms < 0.006] = 0
    # attack fast, release a bit slower (mouths close slower than they open)
    sm = np.zeros(n)
    cur = 0
    for i in range(n):
        k = 0.75 if op[i] > cur else 0.45
        cur += (op[i] - cur) * k
        sm[i] = cur
    rnd = np.clip((rnd - 0.45) * 2.2, 0, 1) * (sm > 0.08)
    return [round(float(a), 3) for a in sm], [round(float(r), 3) for r in rnd]


def main():
    meta = {}
    tl = []
    for line in CFG['lines']:
        v = CFG['voices'][line['who']]
        chunks = []
        parts = []
        t = 0.0
        for k, text in enumerate(line['parts']):
            tmp = tempfile.mktemp(suffix='.wav')
            piper(text, v, tmp)
            sr, x = read(tmp)
            os.remove(tmp)
            x = signal.resample_poly(x, SR, sr)
            x = trim(x)
            parts.append({'text': text, 't0': round(t, 3), 't1': round(t + len(x) / SR, 3)})
            chunks.append(x)
            t += len(x) / SR
            if k < len(line['parts']) - 1:
                gap = np.zeros(int(line.get('gap', 0.3) * SR))
                chunks.append(gap)
                t += len(gap) / SR
        x = np.concatenate(chunks)
        x = shape(x, v)
        # rubberband keeps duration; re-measure anyway
        x = x[: int(t * SR) + int(0.05 * SR)]
        x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
        wavfile.write(os.path.join(OUT, f"{line['id']}.wav"), SR, x.astype(np.float32))
        op, rnd = mouth(x)
        dur = len(x) / SR
        meta[line['id']] = {'who': line['who'], 'at': line['at'], 'dur': round(dur, 3), 'parts': parts, 'open': op, 'round': rnd}
        tl.append((line['at'], line['at'] + dur, line['id']))
        print(f"{line['id']:4s} {line['who']:8s} at {line['at']:6.2f}  dur {dur:5.2f}  → ends {line['at'] + dur:6.2f}")
    tl.sort()
    for a, b in zip(tl, tl[1:]):
        if b[0] < a[1] + 0.15:
            print(f'  OVERLAP: {a[2]} ends {a[1]:.2f} but {b[2]} starts {b[0]:.2f}')
    json.dump(meta, open(os.path.join(ROOT, 'build', 'voice.json'), 'w'), ensure_ascii=False)
    print('→ build/voice.json')


if __name__ == '__main__':
    main()
