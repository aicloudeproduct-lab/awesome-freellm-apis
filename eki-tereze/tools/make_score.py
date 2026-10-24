"""Score, foley and final mix for «Екі терезе» (all synthesised, no samples).

Inputs : src/config/sound.json (sections, ambience, cues), build/voice.json + build/voice/*.wav
Outputs: build/audio/{music,foley,ambience,dialogue}.wav stems and build/audio/master.wav
         (48 kHz stereo, loudness-normalised, true-peak limited)
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
from scipy import signal
from scipy.io import wavfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CFG = json.load(open(os.path.join(ROOT, 'src', 'config', 'sound.json')))
VOICE = json.load(open(os.path.join(ROOT, 'build', 'voice.json')))
SR = 48000
DUR = CFG['duration']
N = int(DUR * SR)
R = np.random.default_rng(7)
OUT = os.path.join(ROOT, 'build', 'audio')
os.makedirs(OUT, exist_ok=True)


def db(x): return 10 ** (x / 20)
def t2i(t): return int(round(t * SR))
def noise(n, rng=R): return rng.standard_normal(n)
def sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return signal.sosfilt(sos('lowpass', f, o), x)
def hp(x, f, o=2): return signal.sosfilt(sos('highpass', f, o), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(sos('bandpass', [lo, hi], o), x)
def reson(x, f, q):
    b, a = signal.iirpeak(f, q, fs=SR); return signal.lfilter(b, a, x)
def env(n, a, d):
    t = np.arange(n) / SR; return np.clip(t / max(a, 1e-4), 0, 1) * np.exp(-t / d)
def norm(x): return x / (np.max(np.abs(x)) + 1e-9)
def pink(n, rng=R):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.arange(len(X)); f[0] = 1
    y = np.fft.irfft(X / np.sqrt(f), n); return y / (np.std(y) + 1e-9)


class Bus:
    def __init__(self):
        self.x = np.zeros((N + SR * 8, 2))
    def add(self, t, sig, g=1.0, pan=0.0):
        i = t2i(t)
        if i >= N: return
        if sig.ndim == 1:
            a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1)
        if i < 0: sig = sig[-i:]; i = 0
        n = min(len(sig), len(self.x) - i)
        self.x[i:i + n] += sig[:n] * g
    def out(self): return self.x[:N]


NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def hz(n): return 440 * 2 ** ((NOTE[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


# ------------------------------------------------------------------ instruments
_pcache = {}
def piano(f, vel=0.7, dur=3.5, bright=1.0):
    key = (round(f, 2), round(vel, 2), round(dur, 2), round(bright, 2))
    if key in _pcache: return _pcache[key]
    n = t2i(dur); t = np.arange(n) / SR
    y = np.zeros(n); B = 0.0004
    for k in range(1, 13):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 12000: break
        amp = (vel ** (0.6 + k * 0.08)) / k ** (1.1 / bright)
        dec = (2.8 + 1.5 * (220 / f)) / (1 + 0.35 * k)
        y += amp * np.sin(2 * np.pi * fk * t + R.uniform(0, 6)) * (np.exp(-t / dec) * 0.75 + 0.25 * np.exp(-t / (dec * 0.12)))
    ham = bp(noise(n), 1500, 6000) * env(n, 0.0005, 0.01) * 0.04 * vel
    y = (y + ham) * np.clip(t / 0.003, 0, 1) * np.clip((dur - t) / 0.4, 0, 1)
    _pcache[key] = y * 0.25
    return _pcache[key]


def strings(f, dur, vel=0.5, att=1.2, rel=1.5, dark=2600):
    n = t2i(dur + rel); t = np.arange(n) / SR
    y = np.zeros(n)
    for det in (-6, -2, 3, 7):
        ff = f * 2 ** (det / 1200) * (1 + 0.003 * np.sin(2 * np.pi * 5.2 * t + det))
        ph = 2 * np.pi * np.cumsum(ff) / SR
        y += signal.sawtooth(ph + R.uniform(0, 6)) * 0.25
    y = lp(y, dark, 2)
    e = np.clip(t / att, 0, 1) ** 1.5 * np.clip((dur + rel - t) / rel, 0, 1)
    return y * e * vel * 0.18


def drone(f, dur, vel=0.4):
    n = t2i(dur); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2 * t + 1) + 0.15 * signal.sawtooth(2 * np.pi * f * t)
    y = lp(y, 400) * np.clip(t / 2.0, 0, 1) * np.clip((dur - t) / 2.0, 0, 1)
    return y * vel * 0.2


def pulse(dur, bpm=66, vel=0.35):
    n = t2i(dur); y = np.zeros(n); per = 60 / bpm
    k = 0.0
    while k < dur:
        i = t2i(k); m = t2i(0.35)
        tt = np.arange(m) / SR
        th = np.sin(2 * np.pi * (55 + 30 * np.exp(-tt / 0.03)) * tt) * np.exp(-tt / 0.12)
        y[i:i + m] += th[:max(0, min(m, n - i))] * (1.0 if int(k / per) % 2 == 0 else 0.6)
        k += per
    return y * vel * 0.5


# ------------------------------------------------------------------ score
def score():
    mus = Bus()
    sec = {s['kind']: s for s in CFG['sections']}
    beat = 60 / 72
    def chordP(t, notes, vel=0.5, spread=0.03, dur=3.5, bright=1.0, pan=0.0):
        for i, n in enumerate(notes):
            mus.add(t + i * spread, piano(hz(n), vel * (0.9 if i else 1.0), dur, bright), 1.0, pan + (i - len(notes) / 2) * 0.06)
    def mel(t0, seq, vel=0.55, bright=1.0, pan=0.1):
        t = t0
        for n, d in seq:
            if n != 'r': mus.add(t, piano(hz(n), vel, max(2.2, d * 2.5), bright), 1.0, pan)
            t += d * beat
        return t
    # night: sparse low piano, uneasy pad
    s = sec['night']
    mus.add(0.2, drone(hz('D2'), 10.5, 0.5), 1.0)
    mus.add(0.5, strings(hz('A3'), 9.0, 0.25, 3.0, 1.0, 1400), 1.0, -0.2)
    for t, n in [(0.6, 'D3'), (2.8, 'F3'), (5.0, 'E3'), (7.2, 'A2')]: chordP(t, [n, 'A3' if n != 'A2' else 'E3'], 0.35, 0.08, 4.0, 0.7)
    mus.add(8.4, strings(hz('D4'), 1.8, 0.35, 1.2, 0.8, 3000), 1.0, 0.1)
    mus.add(8.6, strings(hz('A4'), 1.6, 0.3, 1.2, 0.8, 3200), 1.0, -0.1)
    # friendship (D major), 72 bpm
    s = sec['friendship']; t = 10.6
    prog = [['D3', 'A3', 'F#4'], ['B2', 'F#3', 'D4'], ['G2', 'D3', 'B3'], ['A2', 'E3', 'C#4']]
    theme = [('F#4', 1), ('A4', 1), ('D5', 1.5), ('C#5', 0.5), ('B4', 1), ('A4', 1), ('F#4', 1.5), ('E4', 0.5), ('D4', 1), ('F#4', 1), ('A4', 1), ('B4', 1), ('A4', 2), ('r', 2)]
    bar = 4 * beat
    k = 0
    while t < 25.0:
        ch = prog[k % 4]
        chordP(t, ch, 0.42, 0.11, bar * 1.3, 1.0)
        for j in range(4):
            mus.add(t + j * beat + beat * 0.5, piano(hz(ch[1 + j % 2].replace('3', '4') if j % 2 else ch[2]), 0.25, 2.0, 1.0), 1.0, 0.2)
        t += bar; k += 1
    mel(12.3, theme, 0.5, 1.05, 0.05)
    mel(19.2, theme[:8], 0.48, 1.05, 0.05)
    mus.add(16.5, strings(hz('D4'), 8.0, 0.25, 2.5, 2.0), 1.0, -0.3)
    mus.add(16.5, strings(hz('F#4'), 8.0, 0.2, 2.5, 2.0), 1.0, 0.3)
    # competition: continues, lift at the win
    t = 25.0; k = 0
    prog2 = [['G2', 'D3', 'B3'], ['D3', 'A3', 'F#4'], ['E3', 'B3', 'G4'], ['A2', 'E3', 'C#4']]
    while t < 43.0:
        ch = prog2[k % 4]; chordP(t, ch, 0.36, 0.1, bar * 1.3, 0.95)
        t += bar; k += 1
    for t0, n in [(25.2, 'B3'), (27.6, 'D4'), (30.0, 'G3'), (33.4, 'A3'), (36.8, 'B3'), (40.0, 'D4')]:
        mus.add(t0, strings(hz(n), 3.6, 0.22, 1.5, 1.5, 2400), 1.0, 0.2)
    mel(31.6, [('A4', 1), ('B4', 1), ('D5', 2), ('C#5', 1), ('A4', 2)], 0.42, 1.0)
    mel(39.8, theme[8:13], 0.4, 1.0)
    # envy: B minor, low drones, pulse, sparse piano, colder
    mus.add(43.0, drone(hz('B1'), 22.6, 0.55), 1.0)
    mus.add(43.0, strings(hz('F#3'), 22.0, 0.22, 4.0, 2.0, 1200), 1.0, -0.25)
    mus.add(49.0, pulse(16.4, 66, 0.4), 1.0)
    for t0, ns in [(43.2, ['B2', 'F#3', 'D4']), (47.6, ['G2', 'D3', 'B3']), (52.0, ['E2', 'B2', 'G3']), (56.4, ['F#2', 'C#3', 'A#3']), (60.8, ['B2', 'F#3', 'D4'])]:
        chordP(t0, ns, 0.3, 0.14, 5.0, 0.6)
    for t0, n in [(44.8, 'F#4'), (46.4, 'D4'), (50.2, 'E4'), (53.6, 'C#4'), (57.2, 'D4'), (59.0, 'B3'), (62.0, 'F#4'), (63.4, 'G4')]:
        mus.add(t0, piano(hz(n), 0.3, 3.0, 0.55), 1.0, -0.15)
    mus.add(60.8, strings(hz('B3'), 4.6, 0.35, 2.5, 1.0, 1600), 1.0, 0.2)
    # home: muted theme in minor, tender
    t = 65.6
    for t0, ns in [(65.6, ['B2', 'F#3', 'D4']), (69.0, ['G2', 'D3', 'B3']), (72.4, ['D3', 'A3', 'F#4']), (75.8, ['A2', 'E3', 'C#4']), (79.2, ['B2', 'F#3', 'D4'])]:
        chordP(t0, ns, 0.3, 0.12, 4.5, 0.75)
    mel(67.0, [('F#4', 1), ('A4', 1), ('B4', 1.5), ('A4', 0.5), ('F#4', 1), ('E4', 1), ('D4', 2)], 0.33, 0.8)
    mel(76.2, [('D4', 1), ('F#4', 1), ('E4', 2), ('C#4', 2)], 0.3, 0.75)
    mus.add(65.6, strings(hz('D3'), 17.4, 0.16, 3.0, 2.5, 1500), 1.0)
    # fade 83.6–86.6 (one held note), silence for the child's question
    mus.add(83.6, strings(hz('F#3'), 1.6, 0.18, 0.6, 1.4, 1400), 1.0)
    # realization: single notes, resolving
    for t0, n, v in [(92.8, 'D4', 0.28), (94.2, 'F#4', 0.26), (95.6, 'A4', 0.27), (97.0, 'G4', 0.3)]:
        mus.add(t0, piano(hz(n), v, 3.5, 0.8), 1.0, 0.0)
    chordP(97.2, ['G2', 'D3', 'B3'], 0.3, 0.12, 4.0, 0.85)
    mus.add(97.0, strings(hz('B3'), 4.0, 0.22, 2.0, 2.0, 2200), 1.0, -0.2)
    mus.add(97.0, strings(hz('D4'), 4.0, 0.2, 2.0, 2.0, 2200), 1.0, 0.2)
    chordP(99.4, ['D3', 'A3', 'F#4'], 0.32, 0.12, 4.0, 0.9)
    # forgive: quiet strings and tender piano with space
    mus.add(101.0, strings(hz('D3'), 12.5, 0.15, 3.0, 2.0, 1400), 1.0)
    for t0, ns in [(101.4, ['G2', 'D3', 'B3']), (105.4, ['E2', 'B2', 'G3']), (109.6, ['A2', 'E3', 'C#4'])]:
        chordP(t0, ns, 0.24, 0.16, 4.5, 0.75)
    mus.add(111.6, piano(hz('A4'), 0.22, 3.0, 0.8), 1.0)
    # hope: theme, fuller, resolves on D
    t = 114.2; k = 0
    while t < 122.0:
        ch = prog[k % 4]; chordP(t, ch, 0.36, 0.1, bar * 1.4, 1.05)
        t += bar; k += 1
    mel(115.0, theme[:12], 0.44, 1.1, 0.05)
    mus.add(114.2, strings(hz('D4'), 9.0, 0.24, 3.0, 2.5), 1.0, -0.3)
    mus.add(114.2, strings(hz('A4'), 9.0, 0.2, 3.0, 2.5), 1.0, 0.3)
    chordP(121.6, ['D3', 'A3', 'D4', 'F#4', 'A4'], 0.4, 0.06, 2.4, 1.0)
    return mus.out()


# ------------------------------------------------------------------ foley
class Sig(np.ndarray):
    """1-D signal whose + pads the shorter operand with zeros."""
    def __add__(self, o):
        if isinstance(o, np.ndarray) and o.ndim == 1 and len(o) != len(self):
            n = max(len(self), len(o)); a = np.zeros(n); b = np.zeros(n); a[:len(self)] = self; b[:len(o)] = o
            return (a + b).view(Sig)
        return np.ndarray.__add__(self, o)
    __radd__ = __add__


def sig(fn):
    def w(*a, **k): return np.asarray(fn(*a, **k)).view(Sig)
    return w


@sig
def click(f=3000, d=0.01, q=8):
    n = t2i(0.08); return norm(reson(noise(n) * env(n, 0.0002, d * 0.3), f, q)) * env(n, 0.0002, d)
@sig
def thud(f=80, d=0.12):
    n = t2i(0.5); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (f + 40 * np.exp(-t / 0.02)) * t) * np.exp(-t / d) + lp(noise(n), 400) * env(n, 0.001, 0.03) * 0.5
    return norm(y)
@sig
def rustle(d=0.4, lo=1200, hi=6000):
    n = t2i(d); x = bp(noise(n), lo, hi); g = np.abs(lp(noise(n), 30)); x *= g / (g.max() + 1e-9)
    return norm(x * np.hanning(n))
@sig
def whoosh(d=1.0, f0=300, f1=1800, peak=0.7):
    n = t2i(d); x = pink(n); out = np.zeros(n)
    for k in range(0, n, 1024):
        f = f0 + (f1 - f0) * k / n; seg = x[max(0, k - 2048):k + 1024]
        y = bp(seg, f * 0.6, min(f * 1.7, 20000), 1)[-min(1024, n - k):]; out[k:k + len(y)] = y
    u = np.arange(n) / n; e = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.6)
    return norm(out * e)
def steps(t0, t1, every, bus, g, kind='soft', pan=0):
    t = t0; k = 0
    while t < t1:
        if kind == 'hard': s = click(R.uniform(1800, 2600), 0.05, 6) * 0.6 + thud(R.uniform(90, 120), 0.04) * 0.5
        elif kind == 'kid': s = thud(R.uniform(120, 160), 0.03) * 0.6 + rustle(0.06, 2000, 7000) * 0.2
        else: s = thud(R.uniform(80, 100), 0.05) * 0.7 + rustle(0.08, 1500, 5000) * 0.25
        bus.add(t, s, g * db(R.uniform(-2, 1)), pan); t += every * R.uniform(0.93, 1.07); k += 1
@sig
def applause(d, people=20):
    n = t2i(d); y = np.zeros(n)
    for p in range(people):
        rate = R.uniform(3.5, 5.5); t = R.uniform(0, 0.3)
        while t < d - 0.05:
            i = t2i(t); c = click(R.uniform(900, 2400), 0.02, 3); m = min(len(c), n - i); y[i:i + m] += c[:m] * R.uniform(0.4, 1.0); t += 1 / rate * R.uniform(0.85, 1.15)
    e = np.clip(np.arange(n) / SR / 0.3, 0, 1) * np.clip((d - np.arange(n) / SR) / 0.8, 0, 1)
    return norm(hp(y, 300)) * e
@sig
def birds(d):
    n = t2i(d); y = np.zeros(n); t = R.uniform(0, 0.5)
    while t < d - 0.4:
        k = R.integers(2, 6); f0 = R.uniform(2800, 5200)
        for j in range(k):
            m = t2i(0.07); tt = np.arange(m) / SR
            ch = np.sin(2 * np.pi * (f0 + R.uniform(-600, 900) * tt / 0.07) * tt) * np.hanning(m)
            i = t2i(t + j * 0.09)
            if i + m < n: y[i:i + m] += ch * R.uniform(0.3, 1)
        t += R.uniform(0.8, 2.4)
    return y * 0.5
@sig
def pour(d):
    n = t2i(d); x = noise(n); out = np.zeros(n)
    for k in range(0, n, 2048):
        f = 700 + 900 * (k / n); seg = x[max(0, k - 2048):k + 2048]
        yy = reson(seg, f, 6)[-min(2048, n - k):]; out[k:k + len(yy)] = yy
    bub = np.zeros(n)
    for _ in range(int(d * 40)):
        i = R.integers(0, n - 2000); m = 1500; tt = np.arange(m) / SR; f = R.uniform(500, 1400)
        bub[i:i + m] += np.sin(2 * np.pi * f * (1 + 2 * tt) * tt) * np.exp(-tt / 0.01)
    e = np.clip(np.arange(n) / SR / 0.1, 0, 1) * np.clip((d - np.arange(n) / SR) / 0.2, 0, 1)
    return norm(hp(out * 0.4 + bub * 0.6, 300)) * e
def buzz(t0, t1, bus, g):
    t = t0
    while t < t1:
        n = t2i(0.42); tt = np.arange(n) / SR
        y = (signal.square(2 * np.pi * 170 * tt) * 0.5 + np.sin(2 * np.pi * 170 * tt)) * np.clip(tt / 0.01, 0, 1) * np.clip((0.42 - tt) / 0.02, 0, 1)
        bus.add(t, lp(y, 1500) + reson(noise(n) * 0.3, 2400, 8) * 0.2, g, 0.15); t += 0.85
@sig
def knock():
    n = t2i(0.35); exc = noise(n) * env(n, 0.0003, 0.004)
    y = reson(exc, 180, 7) + 0.6 * reson(exc, 420, 9) + 0.3 * reson(exc, 950, 12)
    return norm(y * env(n, 0.0005, 0.09))
@sig
def curtain(d):
    n = t2i(d); rings = np.zeros(n)
    t = 0.0
    while t < d - 0.1:
        i = t2i(t); c = click(R.uniform(2800, 4200), 0.03, 12); m = min(len(c), n - i); rings[i:i + m] += c[:m] * 0.5; t += R.uniform(0.04, 0.12)
    fab = bp(pink(n), 500, 5000) * np.hanning(n)
    return norm(rings + fab * 0.6)
@sig
def scribble(d):
    n = t2i(d); x = bp(noise(n), 2500, 9000)
    strokes = (0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * np.arange(n) / SR + 2 * np.sin(2 * np.pi * 0.7 * np.arange(n) / SR))) ** 2
    return norm(x * strokes) * np.clip(np.arange(n) / SR / 0.1, 0, 1)
@sig
def ding():
    n = t2i(1.6); t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * 1318 * t) * np.exp(-t / 0.35) + 0.5 * np.sin(2 * np.pi * 1976 * t) * np.exp(-t / 0.25))
def clock_ticks(t0, t1, bus, g):
    t = np.ceil(t0)
    while t < t1:
        bus.add(t, click(3600, 0.015, 14) * 0.6 + click(1800, 0.02, 10) * 0.3, g * (1 if int(t) % 2 else 0.8), 0.45); t += 1.0


def foley():
    fx = Bus()
    for c in CFG['cues']:
        k, t = c[0], c[1]; a = c[2] if len(c) > 2 else None
        if k == 'clock': clock_ticks(t, a, fx, db(-34))
        elif k == 'car_pass': fx.add(t, whoosh(3.0, 120, 600, 0.5) * 0.6, db(-34), 0.6)
        elif k == 'typing':
            tt = t
            while tt < a: fx.add(tt, click(R.uniform(2200, 3400), 0.02, 9), db(-32), 0.05); tt += R.uniform(0.09, 0.2)
        elif k == 'fabric': fx.add(t, rustle(a, 800, 5000), db(-30), -0.3)
        elif k == 'rise_whoosh': fx.add(t, whoosh(a, 300, 4000, 0.9), db(-24))
        elif k == 'thud_soft': fx.add(t, thud(110, 0.06) * 0.7 + rustle(0.1, 400, 2000) * 0.4, db(-26))
        elif k == 'crumble':
            for j in range(9): fx.add(t + j * 0.035 + R.uniform(0, 0.03), thud(R.uniform(140, 260), 0.03) * 0.6, db(-26))
        elif k == 'birds': fx.add(t, birds(a - t), db(-34), R.uniform(-0.5, 0.5))
        elif k == 'whoosh_soft': fx.add(t, whoosh(a, 250, 1500), db(-30))
        elif k == 'scribble': fx.add(t, scribble(a - t), db(-34), 0.1)
        elif k == 'tap': fx.add(t, click(2000, 0.03, 6), db(-28))
        elif k == 'clink':
            n = t2i(1.0); tt = np.arange(n) / SR
            y = np.sin(2 * np.pi * 2100 * tt) * np.exp(-tt / 0.18) + 0.6 * np.sin(2 * np.pi * 3330 * tt) * np.exp(-tt / 0.1) + thud(200, 0.02) * 0.4
            fx.add(t, norm(y), db(-28))
        elif k == 'paper': fx.add(t, rustle(a, 1500, 9000), db(-30))
        elif k == 'shimmer':
            n = t2i(a); tt = np.arange(n) / SR; y = np.zeros(n)
            for f in (1760, 2217, 2637, 3520): y += np.sin(2 * np.pi * f * tt * (1 + 0.02 * tt)) * np.clip(tt / a, 0, 1) * np.hanning(n)
            fx.add(t, norm(y) * 0.5 + whoosh(a, 400, 3000, 0.8) * 0.5, db(-30))
        elif k == 'steps_hard': steps(t, a, c[3], fx, db(-30), 'hard', -0.2)
        elif k == 'steps_soft': steps(t, a, c[3], fx, db(-28), 'soft', 0.2)
        elif k == 'steps_kid': steps(t, a, c[3], fx, db(-30), 'kid', 0.1)
        elif k == 'click': fx.add(t, click(2500, 0.02, 8), db(-26))
        elif k == 'applause_small': fx.add(t, applause(a, 8), db(-28))
        elif k == 'applause_big': fx.add(t, applause(a, 40), db(-22))
        elif k == 'cloth': fx.add(t, rustle(a, 600, 4000), db(-29))
        elif k == 'pat': fx.add(t, thud(140, 0.03) * 0.5 + rustle(0.06, 800, 3000) * 0.5, db(-28))
        elif k == 'camera_flash': fx.add(t, click(4000, 0.02, 4) * 0.7 + whoosh(0.3, 3000, 6000, 0.1) * 0.3, db(-30), R.uniform(-0.6, 0.6))
        elif k == 'glass_shimmer':
            n = t2i(a); tt = np.arange(n) / SR
            y = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.8) for f in (2637, 3136, 3951))
            fx.add(t, norm(y) * 0.6 + whoosh(a, 800, 6000, 0.6) * 0.4, db(-27))
        elif k == 'swipe': fx.add(t, whoosh(0.18, 2000, 6000, 0.4) * 0.6 + click(3000, 0.01, 6) * 0.3, db(-32))
        elif k == 'buzz': buzz(t, a, fx, db(-24))
        elif k == 'phone_flip': fx.add(t, thud(160, 0.03) * 0.7 + click(1800, 0.02, 6) * 0.4, db(-24))
        elif k == 'rain': fx.add(t, hp(pink(t2i(a - t)), 1500) * np.hanning(t2i(a - t)) * 0.4, db(-30))
        elif k == 'wind': fx.add(t, bp(pink(t2i(a - t)), 200, 1200) * np.hanning(t2i(a - t)) * 0.6, db(-28))
        elif k == 'tv_bed':
            d = a - t; n = t2i(d); tt = np.arange(n) / SR
            y = sum(np.sin(2 * np.pi * hz(nn) * tt) * 0.3 for nn in ('C4', 'E4', 'G4', 'C5')) * (0.6 + 0.4 * np.sin(2 * np.pi * 2 * tt) ** 2)
            fx.add(t, bp(y, 300, 3500) * np.clip(tt / 0.3, 0, 1) * np.clip((d - tt) / 0.5, 0, 1), db(-32), -0.6)
        elif k == 'exhale': fx.add(t, bp(noise(t2i(0.9)), 300, 2500) * np.hanning(t2i(0.9)) * 0.6, db(-30))
        elif k == 'door':
            fx.add(t, click(900, 0.08, 5) * 0.6 + thud(90, 0.1) * 0.4, db(-26), -0.4)
            n = t2i(0.8); tt = np.arange(n) / SR; cr = reson(noise(n) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * tt)), 700, 20) * np.hanning(n)
            fx.add(t + 0.1, norm(cr) * 0.3, db(-30), -0.4)
        elif k == 'chair':
            n = t2i(0.45); tt = np.arange(n) / SR; cr = reson(noise(n) * (0.5 + 0.5 * np.sin(2 * np.pi * 40 * tt)), 380, 10) * np.hanning(n)
            fx.add(t, norm(cr) * 0.5 + thud(90, 0.05) * 0.3, db(-28))
        elif k == 'pour': fx.add(t, pour(a), db(-24), 0.15)
        elif k == 'curtain': fx.add(t, curtain(a), db(-22), 0.2)
        elif k == 'roomtone_only': pass
        elif k == 'delete_taps':
            tt = t
            while tt < a: fx.add(tt, click(2600, 0.015, 9), db(-30)); tt += 0.06
        elif k == 'phone_down': fx.add(t, thud(170, 0.025) * 0.6 + click(1500, 0.02, 5) * 0.3, db(-24))
        elif k == 'knee': fx.add(t, thud(85, 0.07) * 0.7 + rustle(0.15, 500, 3000) * 0.3, db(-26))
        elif k == 'knock': fx.add(t, knock(), db(-14), -0.1)
        elif k == 'door_open':
            fx.add(t, click(1100, 0.06, 4) * 0.7, db(-24))
            n = t2i(1.0); tt = np.arange(n) / SR; cr = reson(noise(n) * (0.5 + 0.5 * np.sin(2 * np.pi * (18 + 10 * tt) * tt)), 520, 18) * np.hanning(n)
            fx.add(t + 0.1, norm(cr) * 0.4, db(-28))
        elif k == 'ding': fx.add(t, ding(), db(-26), 0.1)
        elif k == 'send': fx.add(t, whoosh(0.35, 1200, 5000, 0.3), db(-30))
    return fx.out()


def ambience():
    amb = Bus()
    for a in CFG['ambience']:
        t0, t1, k = a['t0'], a['t1'], a['kind']; d = t1 - t0 + 0.6; n = t2i(d)
        fade = np.clip(np.arange(n) / SR / 0.3, 0, 1) * np.clip((d - np.arange(n) / SR) / 0.3, 0, 1)
        base = pink(n)
        if k.startswith('room'):
            hum = lp(base, 180) * 0.6 + np.sin(2 * np.pi * 50 * np.arange(n) / SR) * 0.02
            lvl = {'room_night': -40, 'room_lamp': -40, 'room_day': -42, 'room_evening': -40}[k]
            sig = hum
        elif k == 'yard': sig = bp(base, 200, 2500) * 0.5; lvl = -38
        elif k == 'hall': sig = bp(base, 150, 1500) * 0.6 + bp(pink(n), 300, 900) * 0.4 * (0.6 + 0.4 * np.sin(np.arange(n) / SR * 0.7)); lvl = -36
        elif k.startswith('street'): sig = bp(base, 150, 3000) * 0.5 + lp(pink(n), 300) * 0.3; lvl = -38
        else: sig = lp(base, 300); lvl = -42
        st = np.stack([sig, np.roll(sig, 731)], 1) * fade[:, None]
        amb.add(t0 - 0.3, st, db(lvl))
    return amb.out()


def dialogue():
    dl = Bus()
    for vid, v in VOICE.items():
        sr, x = wavfile.read(os.path.join(ROOT, 'build', 'voice', vid + '.wav'))
        x = x.astype(np.float64)
        if v['who'] == 'narrator': x = x * 1.0
        g = {'narrator': db(-14), 'arman': db(-13), 'ayan': db(-13), 'son': db(-13), 'tv': db(-19)}[v['who']]
        pan = -0.55 if v['who'] == 'tv' else 0.0
        dl.add(v['at'], x, g, pan)
    return dl.out()


def reverb(x, decay=1.6, mix=0.18, seed=3):
    rng = np.random.default_rng(seed); n = t2i(decay * 1.5); t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-6.9 * t / decay); ir = lp(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = signal.fftconvolve(x[:, ch], ir)[:len(x)]
    return x + out * mix


def limit(x, ceil):
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(1).reshape(-1, 4).max(1)[:len(x)]
    need = np.minimum(1.0, ceil / np.maximum(up, 1e-9))
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * t2i(0.004) + 1, mode='nearest')
    g = signal.sosfiltfilt(sos('lowpass', 30, 1), g)
    g = np.minimum(g, minimum_filter1d(need, size=3))
    y = x * g[:, None]
    pk = np.abs(signal.resample_poly(y, 4, 1, axis=0)).max()
    return y * min(1.0, ceil / pk)


def main():
    music = reverb(score(), 2.4, 0.35)
    fx = reverb(foley(), 0.9, 0.12, 5)
    amb = ambience()
    dl = reverb(dialogue(), 0.5, 0.05, 9)
    # duck music under speech
    sp = np.abs(dl).max(1)
    envl = signal.sosfiltfilt(sos('lowpass', 3, 1), (sp > 0.004).astype(float))
    duck = 1 - (1 - db(CFG['musicDuckDb'])) * np.clip(envl * 1.3, 0, 1)
    music *= duck[:, None]
    # near-silence for the child's question: music out, ambience low
    tt = np.arange(N) / SR
    hush = 1 - np.clip((tt - 86.2) / 0.4, 0, 1) * np.clip((92.8 - tt) / 0.5, 0, 1) * 0.92
    music *= hush[:, None]; amb *= (0.6 + 0.4 * hush)[:, None]
    mix = music + fx + amb + dl
    fade = np.clip(tt / 0.6, 0, 1) * np.clip((DUR - tt) / 1.4, 0, 1)
    mix *= fade[:, None]
    for name, s in (('music', music), ('foley', fx), ('ambience', amb), ('dialogue', dl)):
        wavfile.write(os.path.join(OUT, name + '.wav'), SR, s.astype(np.float32))
    meter = pyln.Meter(SR)
    for _ in range(2):
        mix *= db(CFG['targetLufs'] - meter.integrated_loudness(mix))
        mix = limit(mix, db(CFG['truePeak']))
    l = meter.integrated_loudness(mix)
    tp = 20 * np.log10(np.abs(signal.resample_poly(mix, 4, 1, axis=0)).max())
    wavfile.write(os.path.join(OUT, 'master.wav'), SR, mix.astype(np.float32))
    print(f'master: {DUR:.1f}s, {l:.2f} LUFS, true peak {tp:.2f} dBTP')


if __name__ == '__main__':
    main()
