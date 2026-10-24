"""Soundtrack variant: replace the film's audio with an external recording.

The recording (any media file with an audio stream) plays from 0 s; when it
ends, the film's own music, foley and ambience (no TTS voices, music not
ducked) cross-fade in and carry the rest of the film. Loudness -16 LUFS,
true peak -1.5 dBTP.

Usage: python3 tools/replace_audio.py <media-with-audio> [build/audio/master_replaced.wav]
"""
import os
import subprocess
import sys

import numpy as np
import pyloudnorm as pyln
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(__file__))
import make_score as ms  # noqa: E402  (score/foley/ambience are deterministic)

SR, N, DUR = ms.SR, ms.N, ms.DUR
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ms.OUT, 'master_replaced.wav')

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                     capture_output=True, check=True).stdout
rec = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)[:N]
rec_dur = len(rec) / SR
meter = pyln.Meter(SR)
rec = rec * ms.db(-16.0 - meter.integrated_loudness(rec))
t_rec = np.arange(len(rec)) / SR
rec *= np.clip((rec_dur - t_rec) / 1.0, 0, 1)[:, None]  # 1 s fade-out at its end

# film M&E for the rest (same generators as the master, without ducking/hush)
me = ms.reverb(ms.score(), 2.4, 0.35) + ms.reverb(ms.foley(), 0.9, 0.12, 5) + ms.ambience()
tt = np.arange(N) / SR
x0 = max(0.0, rec_dur - 1.5)  # cross-fade start
tail = me[ms.t2i(x0):]
me_l = meter.integrated_loudness(tail) if len(tail) > SR else -70
me *= ms.db(-18.0 - me_l)  # a touch under the speech level
# gentle AGC over the tail: the score was written around dialogue (a hush, a loud
# final swell), so even it out towards -18 LUFS short-term (±8 dB, slow)
hop, win = ms.t2i(0.5), ms.t2i(3.0)
cent, gdb = [], []
for c in range(ms.t2i(x0), N, hop):
    seg = me[max(0, c - win // 2):c + win // 2]
    L = meter.integrated_loudness(seg) if len(seg) > SR else -70
    cent.append(c); gdb.append(float(np.clip(-18.0 - L, -8, 8)) if L > -60 else 0.0)
g = np.interp(np.arange(N), cent, gdb, left=gdb[0], right=gdb[-1])
g = ms.signal.sosfiltfilt(ms.sos('lowpass', 0.5, 1), g)
me *= ms.db(g)[:, None]
me *= (np.clip((tt - x0) / 2.0, 0, 1) * np.clip((DUR - tt) / 1.4, 0, 1))[:, None]

mix = me.copy()
mix[:len(rec)] += rec
for _ in range(2):
    mix *= ms.db(-16.0 - meter.integrated_loudness(mix))
    mix = ms.limit(mix, ms.db(-1.5))
l = meter.integrated_loudness(mix)
tp = 20 * np.log10(np.abs(ms.signal.resample_poly(mix, 4, 1, axis=0)).max())
os.makedirs(os.path.dirname(out), exist_ok=True)
wavfile.write(out, SR, mix.astype(np.float32))
print(f'recording {rec_dur:.2f}s + film M&E from {x0:.2f}s → {out}: {DUR:.1f}s, {l:.2f} LUFS, true peak {tp:.2f} dBTP')
