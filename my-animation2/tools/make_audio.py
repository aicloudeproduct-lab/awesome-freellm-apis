"""Түпнұсқа процедуралық саундтрек (numpy + scipy) → public/audio/soundtrack.wav.
Ағаш дыбыстарының уақыты src/ipad/schedule.json-нан алынады (B-ның tau сағаты нақты уақытқа кері түрлендіріледі),
сондықтан дыбыс анимациямен кадр дәлдігінде синхрондалады."""
import json, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SCH = json.loads((ROOT / 'src/ipad/schedule.json').read_text())
E = SCH['events']
SR, DUR = 48000, 27.0
N = int(SR * DUR)
rng = np.random.default_rng(27)
L = np.zeros(N); R = np.zeros(N)
T = np.arange(N) / SR

def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 200), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def add(sig, start, gain=1.0, pan=0.0):
    i0 = int(round(start * SR))
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    sig = np.array(sig[: N - i0], dtype=float) * gain
    nf = min(len(sig), 200); sig[-nf:] *= np.linspace(1, 0, nf)
    na = min(len(sig), 48); sig[:na] *= np.linspace(0, 1, na)
    L[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 - pan)); R[i0:i0 + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))

def env_at(keys):
    return np.interp(T, [k[0] for k in keys], [k[1] for k in keys])

# ---------- B-ның tau сағаты (constants.ts → tauOf көшірмесі) ----------
def tau_of(t):
    s = SCH['speed']; k = s['S'] - 1; du = s['upEnd'] - s['upStart']; dd = s['downEnd'] - s['downStart']
    r = lambda u: u ** 3 - u ** 4 / 2
    if t <= s['upStart']: return t
    if t <= s['upEnd']: return t + k * du * r((t - s['upStart']) / du)
    if t <= s['downStart']: return t + k * (du * 0.5 + (t - s['upEnd']))
    if t <= s['downEnd']: u = (t - s['downStart']) / dd; return t + k * (du * 0.5 + (s['downStart'] - s['upEnd']) + dd * (u - r(u)))
    return t + k * (du * 0.5 + (s['downStart'] - s['upEnd']) + dd * 0.5)
grid = np.linspace(0, DUR, 27001); taus = np.array([tau_of(x) for x in grid])
def real_of(tau): return float(np.interp(tau, taus, grid))

# ---------- музыка: эмбиент пэд (Dm → D мажорға шешіледі) ----------
def pad(notes, d, cut=1400, a=1.2, r=1.6):
    t = tt(d); s = np.zeros(len(t))
    for m in notes:
        for det in (-0.06, 0.0, 0.07):
            f = hz(m + det)
            s += sum(np.sin(2 * np.pi * f * h * t + rng.random() * 6) / h ** 1.7 for h in range(1, 7))
    s = lp(s / (3 * len(notes)), cut)
    e = np.minimum(1, t / a) * np.minimum(1, (d - t) / r)
    return s * np.clip(e, 0, 1) ** 1.5

def bell(m, d=3.0, decay=1.4, bright=1.0):
    t = tt(d); f = hz(m)
    mod = np.sin(2 * np.pi * f * 2.0 * t) * 0.9 * bright * np.exp(-t * 3)
    return (np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)) * np.exp(-t * decay)

CH = {
    'Dm9': [50, 57, 60, 64, 65], 'Bbmaj7': [46, 53, 57, 62, 65], 'Gm9': [43, 50, 57, 58, 62],
    'Bbmaj9': [46, 53, 57, 60, 62], 'F': [41, 53, 57, 60, 65], 'Asus': [45, 52, 57, 62, 64], 'Dmaj9': [38, 50, 57, 61, 64, 66],
}
for st, d, ch, g in [(0.0, 6.6, 'Dm9', 0.05), (6.0, 6.6, 'Bbmaj7', 0.055), (12.0, 4.6, 'Gm9', 0.06), (16.0, 2.6, 'Bbmaj9', 0.065),
                     (18.2, 2.4, 'F', 0.065), (20.2, 2.4, 'Gm9', 0.06), (22.3, 2.2, 'Asus', 0.065), (24.0, 3.0, 'Dmaj9', 0.085)]:
    for i, m in enumerate(CH[ch]):
        add(pad([m], d + 0.4, 1300 if st < 16 else 1800), st, g, pan=(i / 4 - 0.5) * 0.7)
# төменгі бас дыбысы — финалға қарай біртіндеп
add(lp(np.sin(2 * np.pi * hz(38) * tt(27)) * 0.5, 120), 0, 0.0)
sub = np.sin(2 * np.pi * hz(38) * T) * env_at([(0, 0), (3, 0.02), (16, 0.035), (24, 0.06), (26.4, 0.05), (27, 0)])
L += sub; R += sub
# нәзік әуен (қоңырау): жазулар, жылы жарық, есік, финал сөздері
for at, m, g, p in [(0.85, 74, 0.05, -0.4), (1.3, 76, 0.045, 0.4), (3.0, 69, 0.03, 0.0), (16.1, 69, 0.04, 0.2), (16.7, 74, 0.04, 0.3),
                    (17.8, 72, 0.035, -0.2), (20.1, 69, 0.03, 0.2), (24.0, 74, 0.06, -0.2), (24.45, 78, 0.05, 0.1),
                    (24.95, 81, 0.055, 0.25), (25.45, 78, 0.045, -0.1), (25.9, 74, 0.05, 0.0)]:
    add(bell(m, 3.2, 1.2), at, g, p)

# ---------- жел ----------
wind = lp(hp(rng.standard_normal(N), 120), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * T / 7.3)) * (0.7 + 0.3 * np.sin(2 * np.pi * T / 3.1 + 1))
wenv = env_at([(0, 0.0), (1.2, 0.05), (11.5, 0.05), (13.5, 0.09), (16, 0.06), (20, 0.05), (24, 0.04), (27, 0.0)])
L += wind * wenv; R += np.roll(wind, 900) * wenv

# ---------- жаңбыр ----------
rain_env = env_at([(E['rainStart'], 0), (13.8, 0.45), (E['rainFull'], 1), (16.4, 0.85), (19.9, 0.7), (22.5, 0.7), (E['rainFadeStart'], 0.55), (E['rainEnd'], 0), (27, 0)])
for ch in (0, 1):
    n = rng.standard_normal(N)
    hiss = bp(n, 900, 9000) * 0.06 + lp(n, 500) * 0.05
    drops = np.zeros(N); idx = rng.integers(0, N, 2600); drops[idx] = rng.uniform(0.2, 1, len(idx)) * rng.choice([-1, 1], len(idx))
    drops = bp(drops, 1500, 6000) * 0.35
    sig = (hiss + drops) * rain_env
    if ch == 0: L += sig
    else: R += sig

# ---------- ағаш дыбыстары (құрылыс кестесінен) ----------
def knock(pitch=1.0, heavy=1.0):
    t = tt(0.5)
    body = sum(a * np.sin(2 * np.pi * f * pitch * t) * np.exp(-t * d) for f, a, d in [(140, 1.0, 14), (260, 0.6, 20), (430, 0.35, 28), (760, 0.15, 40)])
    click = bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 180) * 0.5
    return (body * heavy + click) * 0.8
def scrape(d=0.22):
    t = tt(d); return bp(rng.standard_normal(len(t)), 600, 3200) * np.sin(np.pi * t / d) ** 2 * 0.5

for p in SCH['pieces']:
    tp, tl = real_of(p['pick']), real_of(p['place'])
    pan = 0.45
    add(scrape(0.18), tp, 0.10, pan)
    heavy = 1.2 if p['kind'] in ('sill', 'roofL', 'roofR') else 1.0
    add(knock(0.9 + 0.2 * rng.random(), heavy), tl, 0.32, pan)
    if p['kind'] in ('roofL', 'roofR'): add(knock(1.15, 0.8), real_of(p['seat']), 0.18, pan)

# ---------- қадамдар ----------
def step():
    t = tt(0.12); return lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 45) * 0.6
walk = SCH['bWalk']
for (t0, x0), (t1, x1) in zip(walk, walk[1:]):
    if x0 != x1:
        for k in range(int((t1 - t0) / 0.24) + 1):
            add(step(), real_of(t0 + 0.12 + k * 0.24), 0.07, 0.4)
for s_ in (17.12, 17.36, 17.58, 18.75, 19.1):
    add(step(), s_, 0.09, 0.15)

# ---------- A: қарындаш, қағаз ----------
def scratch(d):
    t = tt(d); return bp(rng.standard_normal(len(t)), 2500, 7000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 6 * t))) * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.05)
for a, b in [(0.5, 3.4), (5.7, 8.8), (10.6, 13.3), (15.6, 19.8), (22.5, 24.0)]:
    add(scratch(b - a), a, 0.012, -0.5)
def crumple(d=0.32):
    t = tt(d); n = np.zeros(len(t)); idx = rng.integers(0, len(t), 160); n[idx] = rng.uniform(-1, 1, len(idx))
    return hp(n, 1200) * 1.6 + bp(rng.standard_normal(len(t)), 800, 4000) * 0.2 * np.sin(np.pi * t / d)
add(crumple(), E['crumple1'] - 0.05, 0.07, -0.5); add(crumple(), 14.4, 0.07, -0.5)
add(knock(2.4, 0.3), E['land1'], 0.05, -0.6); add(knock(2.4, 0.3), E['land2'], 0.05, -0.6)

# ---------- есік ----------
def creak(d=0.6):
    t = tt(d); f0 = 330 + 140 * np.sin(np.pi * t / d)
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(f0) / SR)) * 0.3
    return bp(tone, 400, 2400) * np.sin(np.pi * t / d) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t))
add(knock(3.0, 0.25), E['doorOpen'] - 0.04, 0.06, -0.1)
add(creak(0.62), E['doorOpen'], 0.035, -0.1)
add(creak(0.8), E['doorAjar'], 0.02, -0.1)

# ---------- ауысулар: жұмсақ ысқырықтар ----------
def whoosh(d):
    t = tt(d); n = rng.standard_normal(len(t)); out = np.zeros(len(t)); bands = np.geomspace(250, 4000, 5)
    for i in range(4):
        c = (i + 0.5) / 4; out += bp(n, bands[i], bands[i + 1]) * np.exp(-((t / d - c) / 0.3) ** 2)
    return out * np.sin(np.pi * t / d) ** 2
for at, d, g in [(11.6, 1.4, 0.05), (16.3, 1.2, 0.04), (19.8, 1.1, 0.04), (23.5, 1.3, 0.045)]:
    add(whoosh(d), at, g)

# ---------- реверб, мастер ----------
def reverb(x, sec, seed):
    r = np.random.default_rng(seed); n = int(sec * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 2.6); ir[: int(0.02 * SR)] = 0
    ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
    F = 1 << (len(x) + n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[: len(x)]
L2 = L + reverb(L, 2.8, 1) * 0.3; R2 = R + reverb(R, 2.8, 2) * 0.3
fade = np.clip((DUR - T) / 0.55, 0, 1) ** 1.3 * np.clip(T / 0.6, 0, 1)
st = np.stack([L2, R2], 1) * fade[:, None]
st = np.tanh(st * 1.4) / np.tanh(1.4)
st *= 0.85 / np.abs(st).max()
out = ROOT / 'public/audio/soundtrack.wav'
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(np.round(st * 32767).astype('<i2').tobytes())
print(out, 'peak', round(float(np.abs(st).max()), 3), 'wood hits at', [round(real_of(p['place']), 2) for p in SCH['pieces']])
