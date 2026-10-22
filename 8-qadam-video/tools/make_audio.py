"""Видеоға арналған түпнұсқа аспаптық музыканы numpy арқылы синтездейді (сыртқы үлгі/сэмпл қолданылмайды).
96 BPM: бір такт = 2,5 с = бір қадам. Нәтиже: audio/music.wav (48 кГц, стерео, 16 бит)."""
import wave
from pathlib import Path
import numpy as np

SR, DUR = 48000, 32.0
N = int(SR * DUR)
rng = np.random.default_rng(8)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
BEAT = 60 / 96
STEP0, SL = 4.0, 2.5
B = [STEP0 + k * SL for k in range(8)]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start, pan=0.0, gain=1.0):
    i0 = int(start * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0] * gain
    L[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na); e[na:na + nd] = np.linspace(1, s, nd)
    if nr > 0:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def pad_note(m, dur, bright=0.5):
    n = int(dur * SR); tt = np.arange(n) / SR; out = np.zeros(n)
    for det in (-0.07, 0.0, 0.08):
        f = hz(m + det)
        for k in range(1, 9):
            amp = (1 / k ** (1.6 - 0.5 * bright))
            out += amp * np.sin(2 * np.pi * f * k * tt + rng.random() * 6.28)
    return out / 9


def pluck(m, dur=0.9, tone=0.5):
    n = int(dur * SR); tt = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * tt) + 0.35 * tone * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 9) + 0.12 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt * 14)
    return s * np.exp(-tt * 5.5) * np.minimum(1, tt / 0.004)


def bell(m, dur=2.4):
    n = int(dur * SR); tt = np.arange(n) / SR; f = hz(m)
    s = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * d) for r, a, d in [(1, 1, 2.2), (2.0, 0.45, 3.5), (2.76, 0.3, 5), (5.4, 0.12, 8)])
    return s * np.minimum(1, tt / 0.003)


def kick(gain=1.0):
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 46 + 70 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 7.5) * gain


def sub(m, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * hz(m) * tt) + 0.2 * np.sin(4 * np.pi * hz(m) * tt)) * env_adsr(n, 0.02, 0.3, 0.7, 0.25)


def band_noise(n, lo, hi):
    x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    X *= np.exp(-0.5 * ((np.log(np.maximum(f, 1)) - np.log(np.sqrt(lo * hi))) / (0.5 * np.log(hi / lo))) ** 2)
    y = np.fft.irfft(X, n); return y / (np.abs(y).max() + 1e-9)


def whoosh(dur=0.7, peak=0.75):
    n = int(dur * SR); tt = np.arange(n) / SR
    rise = np.clip(tt / (dur * peak), 0, 1) ** 2.2
    fall = np.clip(1 - (tt - dur * peak) / (dur * (1 - peak)), 0, 1) ** 1.5
    e = np.where(tt < dur * peak, rise, fall)
    lo, hi = band_noise(n, 300, 1600), band_noise(n, 1500, 7000)
    mixk = np.clip(tt / dur, 0, 1)
    return (lo * (1 - mixk) + hi * mixk * 0.7) * e


# --- гармония (D мажор) ---
CH = {
    'Dmaj9': [50, 57, 62, 64, 66, 69], 'Bm7': [47, 54, 59, 62, 66], 'Gmaj7': [43, 50, 55, 59, 62, 66],
    'D': [50, 57, 62, 66, 69], 'Asus': [45, 52, 57, 62, 64], 'A': [45, 52, 57, 61, 64], 'Dadd9': [38, 50, 57, 62, 64, 66, 69],
}
prog = [(0.0, 4.0, 'Dmaj9', 0.3)] + [(B[k], SL, c, 0.35 + 0.05 * k) for k, c in enumerate(['Bm7', 'Gmaj7', 'D', 'Asus', 'Bm7', 'Gmaj7', 'D', 'A'])]
prog += [(24.0, 2.5, 'Gmaj7', 0.8), (26.5, 2.5, 'Asus', 0.9), (29.0, 3.0, 'Dadd9', 0.7)]
for st, du, name, br in prog:
    for i, m in enumerate(CH[name]):
        a = 1.6 if st == 0 else 0.25
        sig = pad_note(m, du + 1.2, br) * env_adsr(int((du + 1.2) * SR), a, 0.5, 0.85, 1.4)
        add(sig, st, pan=(i / max(1, len(CH[name]) - 1) - 0.5) * 0.8, gain=0.075 if st >= 29 else (0.04 if st == 0 else 0.055))

# --- арпеджио (қадамдармен бірге күшейеді) ---
for st, du, name, br in prog:
    if st < 4.0 or st >= 29.0:
        continue
    notes = [m + 12 for m in CH[name][1:]]
    steps = int(round(du / (BEAT / 2)))
    for j in range(steps):
        when = st + j * BEAT / 2
        lvl = 0.08 + 0.05 * np.clip((when - 4) / 20, 0, 1)
        if when >= 24:
            lvl = 0.13
        m = notes[[0, 2, 1, 3, 2, 4, 1, 3][j % 8] % len(notes)]
        add(pluck(m, tone=br), when, pan=0.35 * np.sin(j * 1.3), gain=lvl * (1.0 if j % 2 == 0 else 0.7))

# --- бас және кик (екінші жартыдан бастап) ---
for st, du, name, br in prog:
    if st < 9.0 or st >= 29.0:
        continue
    add(sub(CH[name][0] - 12 if CH[name][0] > 44 else CH[name][0], du), st, gain=0.16)
for b in np.arange(14.0, 28.95, BEAT):
    beat_in_bar = int(round((b - 4.0) / BEAT)) % 4
    if b < 24 and beat_in_bar not in (0, 2):
        continue
    add(kick(), b, gain=0.32 if b < 24 else 0.38)

# --- ауысу дыбыстары, қадам белгілері ---
for k in range(1, 8):
    add(whoosh(0.7), B[k] - 0.52, pan=-0.3 + 0.6 * (k % 2), gain=0.05)
add(whoosh(1.0), 3.3, gain=0.06)
add(whoosh(1.0), 23.6, gain=0.07)
add(whoosh(1.2), 27.85, gain=0.06)
bells = [74, 78, 81, 76, 74, 79, 81, 85]
for k in range(8):
    add(bell(bells[k]), B[k] + 0.12, pan=0.2 * (-1) ** k, gain=0.05)
add(bell(81, 3.0), 1.9, gain=0.06); add(bell(86, 3.0), 2.45, gain=0.035)
add(bell(78, 3.0), 26.0, gain=0.05)
add(bell(74, 3.0), 29.45, gain=0.06); add(bell(81, 3.0), 30.9, gain=0.055)
# көтерілу (riser) біріктіру бөліміне
n = int(2.4 * SR); tt = np.arange(n) / SR
add(band_noise(n, 2000, 9000) * (tt / 2.4) ** 3 * 0.6, 26.5, gain=0.05)
# ашылудағы төмен гул
n = int(4.5 * SR); tt = np.arange(n) / SR
add(np.sin(2 * np.pi * hz(38) * tt) * env_adsr(n, 2.2, 0.5, 0.8, 1.5), 0.0, gain=0.06)

# --- реверб ---
def reverb(x, seconds=2.4, seed=1):
    r = np.random.default_rng(seed); n = int(seconds * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2)
    ir[: int(0.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
    m = len(x) + n; F = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[: len(x)]
    return y

wL, wR = reverb(L, seed=1), reverb(R, seed=2)
L = L * 0.78 + wL * 0.35; R = R * 0.78 + wR * 0.35

# --- мастер ---
fade_in = np.clip(t / 0.4, 0, 1); fade_out = np.clip((DUR - t) / 1.1, 0, 1)
L *= fade_in * fade_out; R *= fade_in * fade_out
st = np.stack([L, R], 1)
st = np.tanh(st * 1.3) / np.tanh(1.3)
st *= 0.89 / np.abs(st).max()
out = Path(__file__).resolve().parent.parent / 'audio' / 'music.wav'
out.parent.mkdir(exist_ok=True)
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(out, f'{DUR}s', 'peak', round(float(np.abs(st).max()), 3), 'rms', round(float(np.sqrt((st ** 2).mean())), 4))
