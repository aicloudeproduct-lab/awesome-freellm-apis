"""Түпнұсқа электрондық аспаптық трек (numpy + scipy), сыртқы сэмпл қолданылмайды.
120 BPM, бір такт = 2 с; қадамдар такт басына түседі (3, 5, ... 17 с), финал 22 с.
Нәтиже: audio/music.wav (48 кГц, стерео, 16 бит PCM)."""
import wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR, DUR = 48000, 25.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(25)
L = np.zeros(N); R = np.zeros(N)
side = np.ones(N)  # sidechain envelope


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 100), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)


def add(sig, start, gain=1.0, pan=0.0, duck=False):
    i0 = int(round(start * SR))
    if i0 >= N or len(sig) == 0:
        return
    if i0 < 0:
        sig = sig[-i0:]; i0 = 0
    sig = sig[: N - i0] * gain
    if duck:
        sig = sig * side[i0:i0 + len(sig)]
    L[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def saw(f, t, phase=0.0): return 2 * ((f * t + phase) % 1.0) - 1


def env(n, a, d, s, r):
    e = np.full(n, float(s)); na = max(1, min(n, int(a * SR))); nd = min(n - na, int(d * SR)); nr = min(n, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[na:na + nd] = np.linspace(1, s, nd)
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


# ---------- аспаптар ----------
def kick(gain=1.0):
    t = tt(0.42); f = 48 + 110 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 180) * 0.25
    return (body + click) * gain


def clap():
    t = tt(0.3); n = rng.standard_normal(len(t)); e = np.zeros(len(t))
    for d in (0, 0.009, 0.019, 0.03):
        e += np.where(t >= d, np.exp(-(t - d) * (60 if d < 0.03 else 18)), 0)
    return bp(n, 900, 3200) * e * 0.6


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    return hp(rng.standard_normal(len(t)), 7000, 4) * np.exp(-t * (14 if open_ else 70)) * 0.5


def bass(m, d=0.22):
    t = tt(d); f = hz(m)
    s = saw(f, t) * 0.6 + np.sin(2 * np.pi * f / 2 * t) * 0.7
    cut = 300 + 1400 * np.exp(-t * 18)
    out = lp(s * env(len(t), 0.004, 0.08, 0.6, 0.06), 900)
    return out * (0.6 + 0.4 * (cut / cut.max()))


def pad(notes, d, cutoff=1600, a=0.35, r=0.9):
    t = tt(d); s = np.zeros(len(t))
    for m in notes:
        for det, ph in ((-0.09, 0.1), (0.0, 0.5), (0.1, 0.8)):
            s += saw(hz(m + det), t, ph)
    s = lp(s / (3 * len(notes)), cutoff, 2)
    return s * env(len(t), a, 0.4, 0.85, r)


def pluck(m, d=0.22, bright=2600):
    t = tt(d); f = hz(m)
    s = saw(f, t) * 0.5 + np.sign(np.sin(2 * np.pi * f * t)) * 0.25
    return lp(s, bright) * np.exp(-t * 16) * np.minimum(1, t / 0.002)


def bell(m, d=2.2, decay=2.0):
    t = tt(d); f = hz(m)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 1.4 * np.exp(-t * 4)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * decay) * np.minimum(1, t / 0.003)


def whoosh(d=0.45, lo=300, hi=6000):
    t = tt(d); n = rng.standard_normal(len(t)); out = np.zeros(len(t))
    bands = np.geomspace(lo, hi, 6)
    for i in range(5):
        c = (i + 0.5) / 5
        w = np.exp(-((t / d - c) / 0.22) ** 2)
        out += bp(n, bands[i], bands[i + 1]) * w
    return out * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5


def riser(d):
    t = tt(d); x = t / d
    noise = hp(rng.standard_normal(len(t)), 1500) * x ** 2.5 * 0.5
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1600 * x ** 2) / SR) * x ** 3 * 0.15
    return noise + sweep


def impact(gain=1.0, low=1.0):
    t = tt(1.6)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 12)) / SR) * np.exp(-t * 2.6) * low
    nz = lp(rng.standard_normal(len(t)), 2200) * np.exp(-t * 9) * 0.5
    return (sub + nz) * gain


def sparkle(m):
    return sum(bell(m + o, 1.4, 3.0) * g for o, g in ((0, 1), (12, 0.35), (19, 0.2)))


# ---------- гармония ----------
CH = {'Am': [57, 60, 64, 67], 'F': [53, 57, 60, 64], 'C': [48, 55, 60, 64], 'G': [55, 59, 62, 67],
      'Dm': [50, 57, 60, 65], 'E': [52, 56, 59, 64], 'Cmaj9': [48, 55, 59, 62, 64]}
ROOT = {'Am': 45, 'F': 41, 'C': 36, 'G': 43, 'Dm': 38, 'E': 40}
STEPS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E']
bars = [(3 + 2 * k, STEPS[k], k) for k in range(8)] + [(19, 'F', 8), (21, 'G', 9)]

# sidechain (кик тұрған жерде)
kick_times = [b + j * BEAT for b, _, k in bars for j in range(4) if not (k == 4 and j < 1) and not (k == 9) and b + j * BEAT < 21]
for kt in kick_times:
    i0 = int(kt * SR); n = int(0.3 * SR)
    seg = 1 - 0.55 * np.exp(-np.arange(n) / SR * 14)
    side[i0:i0 + n] = np.minimum(side[i0:i0 + n], seg[: max(0, min(n, N - i0))])

# ---------- ашылу 0–3 с ----------
add(sparkle(88), 0.02, 0.10)
add(whoosh(0.5, 400, 5000), 0.1, 0.10, -0.3)
for k in range(8):  # нүкте сегізге бөлінеді
    add(pluck([69, 72, 76, 79, 81, 84, 88, 91][k], 0.3, 4000), 0.58 + k * 0.026, 0.08, -0.7 + k * 0.2)
add(riser(0.42), 0.6, 0.18)
add(impact(0.55), 1.0); add(kick(0.9), 1.0)
add(pad(CH['Am'] + [71], 2.2, 1400, 0.02, 0.6), 1.0, 0.16)
for j in range(8):
    add(bass(ROOT['Am'], 0.2), 1.0 + 0.25 * j, 0.13 * (0.6 + 0.05 * j))
add(whoosh(0.4, 600, 7000), 1.33, 0.07, 0.3)          # тақырып маскасы
add(bell(76, 1.6, 2.5), 1.92, 0.05, 0.2)
add(riser(0.6), 2.4, 0.12)

# ---------- 8 қадам 3–19 с, біріктіру 19–22 с ----------
for b, name, k in bars:
    root, notes = ROOT[name], CH[name]
    breath = k == 4
    add(pad(notes, 2.15, 1200 + 180 * k if k < 8 else 2600, 0.05, 0.5), b, (0.26 if breath else 0.13 + 0.008 * k), duck=True)
    # бас — сегізінші ноталар
    if k != 9:
        for j in range(8):
            if breath and j < 2: continue
            add(bass(root, 0.2), b + j * 0.25, (0.11 + 0.007 * min(k, 7)) if not breath else 0.10, duck=True)
    # кик
    if not breath and k != 9:
        for j in range(4):
            add(kick(0.6 + 0.04 * k if k < 8 else 0.8), b + j * BEAT)
    elif breath:
        add(kick(0.5), b + 0.5); add(kick(0.55), b + 1.0); add(kick(0.6), b + 1.5)
    # хэттер
    if k >= 1 and k != 9:
        for j in range(4):
            add(hat(), b + j * BEAT + 0.25, 0.12 if k < 3 else 0.15, 0.25)
        if k >= 5:
            for j in range(8):
                add(hat(), b + j * 0.25 + 0.125, 0.05, -0.3)
            add(hat(True), b + 1.75, 0.08, 0.2)
    # клэп
    if k >= 2 and not breath and k != 9:
        add(clap(), b + 0.5, 0.20, -0.05); add(clap(), b + 1.5, 0.20, 0.05)
    # арпеджио
    if k >= 2:
        seq = [notes[i % len(notes)] + 12 for i in (0, 1, 2, 3, 2, 1, 2, 3)]
        for j in range(16 if k != 9 else 8):
            lvl = 0.035 + 0.006 * min(k, 7) if not breath else 0.05
            add(pluck(seq[j % 8], 0.2, 2200 + 200 * min(k, 7)), b + j * 0.125, lvl * (1 if j % 2 == 0 else 0.7), 0.4 * np.sin(j), duck=True)
    # қадам басындағы акцент және ауысу дыбысы
    if k < 8:
        add(bell(notes[-1] + 12, 1.2, 3.2), b + 0.06, 0.035, 0.3 * (-1) ** k)
        add(whoosh(0.42, 300 + 60 * k, 6000), b - 0.36, 0.06 + 0.004 * k, -0.4 + 0.1 * k)
    if k == 3:
        add(impact(0.18, 0.6), b)

# 19 с: біріктіру акценті; 21–22 с: үзіліс және көтерілу
add(whoosh(0.5, 200, 5000), 18.62, 0.09)
add(impact(0.4), 19.0)
add(riser(1.0), 21.0, 0.25)
for j in range(8):
    add(hat(), 21.0 + j * 0.125 * (1 - j * 0.05), 0.04 + 0.01 * j)

# ---------- финал 22–25 с ----------
add(impact(0.6), 22.0); add(kick(0.7), 22.0)
add(pad(CH['Cmaj9'] + [67, 72], 3.0, 2400, 0.03, 2.4), 22.0, 0.17)
add(lp(np.sin(2 * np.pi * hz(36) * tt(2.8)) * np.exp(-tt(2.8) * 1.3), 200), 22.0, 0.22)   # финал суб-басы
for i, (m, at) in enumerate(((76, 22.15), (79, 22.33), (84, 22.6))):
    add(bell(m, 2.6, 1.6), at, 0.06, -0.25 + 0.25 * i)

# ---------- реверб және мастер ----------
def reverb(x, sec, seed):
    r = np.random.default_rng(seed); n = int(sec * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.4); ir[: int(0.015 * SR)] = 0
    ir = lp(ir, 6000); ir /= np.sqrt((ir ** 2).sum())
    F = 1 << (len(x) + n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[: len(x)]

wl, wr = reverb(hp(L, 250), 2.2, 1), reverb(hp(R, 250), 2.2, 2)
L2 = L + wl * 0.22; R2 = R + wr * 0.22
t = np.arange(N) / SR
fade = np.clip((DUR - t) / 0.35, 0, 1) ** 1.5     # соңғы 0,35 с: құйрықты жұмсақ жабу
st = np.stack([L2, R2], 1) * fade[:, None]
st = np.tanh(st * 1.6) / np.tanh(1.6)
up = np.interp(np.arange(len(st) * 4) / 4, np.arange(len(st)), st[:, 0])
peak = max(np.abs(st).max(), np.abs(up).max())
st *= 0.89 / peak                                   # ≈ −1 dBFS
out = Path(__file__).resolve().parent.parent / 'audio' / 'music.wav'
out.parent.mkdir(exist_ok=True)
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(np.round(st * 32767).astype('<i2').tobytes())
print(out, 'peak', round(float(np.abs(st).max()), 3))
