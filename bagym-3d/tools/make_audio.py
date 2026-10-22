#!/usr/bin/env python3
"""«Жігіттің өзімен тартыссаң да, бағымен тартыспа» — түпнұсқа дыбыс (толығымен процедуралық синтез).

Құрамы: эмбиент-партитура (пад + сирек "малет" ноталары), тас кеңістіктің ауасы, тастағы қадамдар
(уақыттары сахнадан алынған: out/events.json, tools/events.mjs), блок көтеру/қою, өлшеуіш, ұсақ тастар,
ауысулардағы ұстамды whoosh. Дикторға орын: 1–4 кГц аймағы музыкада әлсіретілген, жалпы деңгей төмен.
Нәтиже: out/audio.wav (48 кГц, 32-бит PCM стерео, дәл 90.000 с).
--voice source/voice_orig.wav: түпнұсқа дыбыс + фоли → out/audio_voice.wav (партитурасыз).
"""
import json, os, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 90.0
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(20261022)
t_all = np.arange(N) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x, axis=0)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x, axis=0)


def env_points(points):
    """[(t, v), ...] → барлық үлгі бойынша сызықтық огибающий."""
    ts, vs = zip(*points)
    return np.interp(t_all, ts, vs)


def note_hz(n):
    names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    name, octv = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octv + 1) - 69) / 12)


def place(buf, sig, t0, pan=0.0, gain=1.0):
    """Моно сигналды стерео буферге t0 уақытына қою (тұрақты қуатты панорама)."""
    i0 = int(round(t0 * SR))
    if i0 >= len(buf) or i0 + len(sig) <= 0:
        return
    s0 = max(0, -i0)
    sig = sig[s0:]
    i0 = max(0, i0)
    n = min(len(sig), len(buf) - i0)
    a = (pan + 1) * np.pi / 4
    buf[i0:i0 + n, 0] += sig[:n] * np.cos(a) * gain
    buf[i0:i0 + n, 1] += sig[:n] * np.sin(a) * gain


def reverb_ir(length=3.8, damp=2600.0, seed=7):
    r = np.random.default_rng(seed)
    n = int(SR * length)
    tt = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-tt / (length / 6.2))[:, None]
    ir = lp(ir, damp)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]   # алдын ала кешігу
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def apply_reverb(x, ir, wet):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + y * wet


# ---------------------------------------------------------------- партитура
# Аккордтар (басталу уақыты, ноталар). D дориан/эол → соңында D мажорлық жарыққа шығу.
CHORDS = [
    (0.0, ['D2', 'A2', 'D3', 'F3', 'E4']),          # ашылу: Dm(add9)
    (8.0, ['D2', 'A2', 'F3', 'A3', 'E4']),          # еңбек
    (12.25, ['Bb1', 'F2', 'D3', 'F3', 'C4']),
    (16.5, ['F2', 'C3', 'F3', 'A3', 'G4']),
    (20.75, ['C2', 'G2', 'E3', 'G3', 'D4']),
    (25.0, ['Bb1', 'F2', 'D3', 'A3', 'C5']),        # басқаның артықшылықтары: кеңею
    (29.5, ['F2', 'C3', 'A3', 'C4', 'G4']),
    (34.0, ['G1', 'D2', 'Bb2', 'F3', 'A4']),
    (38.5, ['C2', 'G2', 'E3', 'Bb3', 'D4']),
    (43.0, ['D2', 'A2', 'F3', 'E4']),               # қабылдау: жұқа
    (50.0, ['Bb1', 'F2', 'D3', 'E4']),
    (54.0, ['D2', 'A2', 'D3', 'E4']),
    (58.0, ['D2', 'A2', 'Eb3', 'F3']),              # қызғаныштың ауырлығы: b2 кернеу, төменірек
    (66.0, ['Bb1', 'D2', 'A2', 'Eb3']),
    (71.0, ['G1', 'D2', 'Bb2', 'Eb3']),
    (75.0, ['F2', 'C3', 'A3', 'C4', 'G4']),         # ізгі тілек: жылы мажор
    (79.0, ['Bb1', 'F2', 'D3', 'A3', 'F4']),
    (82.5, ['C2', 'G2', 'E3', 'G3', 'D4']),
    (85.5, ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4']),  # еркіндік: D мажор (add9)
]
# секция бойынша жарықтық (lowpass кесу жиілігі) және деңгей
BRIGHT = env_points([(0, 700), (7, 1100), (8, 900), (25, 1300), (40, 1700), (43, 900), (57, 1000), (58, 650), (74, 520), (75, 1100), (84, 1800), (90, 1200)])
LEVEL = env_points([(0, 0.0), (2.2, 0.55), (8, 0.65), (25, 0.75), (40, 0.9), (43, 0.6), (57, 0.6), (58, 0.7), (74, 0.75), (75, 0.75), (85, 0.95), (88.2, 0.7), (89.85, 0.0), (90, 0.0)])


def pad_voice(freq, n, ph_seed):
    r = np.random.default_rng(ph_seed)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for h in range(1, 7):
        amp = 1.0 / h ** 1.6
        for det in (-0.0016, 0.0, 0.0019):
            f = freq * h * (1 + det)
            if f > 9000:
                continue
            lfo = 1 + 0.0007 * np.sin(2 * np.pi * (0.07 + 0.03 * r.random()) * tt + r.random() * 6.28)
            out += amp * np.sin(2 * np.pi * f * np.cumsum(lfo) / SR + r.random() * 6.28)
    return out / 3


def build_pad():
    pad = np.zeros((N, 2))
    xf = 1.6  # аккордтар арасындағы айқасу (с)
    for k, (t0, notes) in enumerate(CHORDS):
        t1 = CHORDS[k + 1][0] if k + 1 < len(CHORDS) else DUR
        a, b = max(0.0, t0 - xf / 2), min(DUR, t1 + xf / 2)
        i0, i1 = int(a * SR), int(b * SR)
        n = i1 - i0
        seg = np.zeros((n, 2))
        for j, nm in enumerate(notes):
            f = note_hz(nm)
            v = pad_voice(f, n, 100 * k + j)
            pan = (j / max(1, len(notes) - 1) - 0.5) * 0.7
            g = 0.9 if f < 120 else (0.55 if f > 300 else 0.7)
            seg[:, 0] += v * g * np.cos((pan + 1) * np.pi / 4)
            seg[:, 1] += v * g * np.sin((pan + 1) * np.pi / 4)
        fade = np.ones(n)
        fl = int(xf * SR)
        if k > 0:
            fade[:fl] = np.sin(np.linspace(0, np.pi / 2, fl)) ** 2
        if k + 1 < len(CHORDS):
            fade[-fl:] = np.cos(np.linspace(0, np.pi / 2, fl)) ** 2
        pad[i0:i1] += seg * fade[:, None]
    # уақытқа тәуелді жарықтық: үш жолақты қоспа (күңгірт/орта/ашық) BRIGHT бойынша
    dark, mid, bright = lp(pad, 500), lp(pad, 1100), lp(pad, 2200)
    w = np.clip((BRIGHT - 500) / 600, 0, 1)[:, None]
    w2 = np.clip((BRIGHT - 1100) / 1100, 0, 1)[:, None]
    pad = dark * (1 - w) + mid * w * (1 - w2) + bright * w2
    pad = hp(pad, 38)
    return pad * LEVEL[:, None]


def mallet(freq, dur=4.5, bright=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * tt) * np.exp(-tt / 1.6)
    s += 0.35 * bright * np.sin(2 * np.pi * freq * 2.76 * tt) * np.exp(-tt / 0.45)
    s += 0.12 * bright * np.sin(2 * np.pi * freq * 5.40 * tt) * np.exp(-tt / 0.18)
    att = int(0.006 * SR)
    s[:att] *= np.linspace(0, 1, att)
    return s


# сирек, мағыналы ноталар: мақал көрінгенде, қабылдау, ізгі тілек, финал
MALLET = [
    (5.0, 'A4', 0.20), (5.45, 'D5', 0.16), (6.4, 'E5', 0.12),
    (10.5, 'A3', 0.10), (16.9, 'D4', 0.10), (22.7, 'A3', 0.10),          # блок қойылғанда — жұмсақ төмен нота
    (30.0, 'F4', 0.10), (35.0, 'A4', 0.10), (39.3, 'C5', 0.09),
    (51.2, 'E4', 0.12), (53.6, 'D4', 0.12), (56.0, 'A3', 0.12),          # қабылдау
    (76.4, 'C5', 0.12), (78.0, 'A4', 0.12), (80.2, 'F4', 0.12),          # ізгі тілек
    (84.6, 'A4', 0.16), (85.05, 'D5', 0.14), (86.4, 'F#5', 0.11), (88.0, 'E5', 0.08),
]


def build_mallets():
    buf = np.zeros((N, 2))
    for t0, nm, g in MALLET:
        f = note_hz(nm)
        place(buf, mallet(f, bright=0.8 if f > 600 else 1.0), t0, pan=rng.uniform(-0.25, 0.25), gain=g)
    return lp(buf, 5200)


# ---------------------------------------------------------------- тас кеңістік, фоли
def room_tone():
    w = rng.standard_normal((N, 2))
    low = lp(w, 180) * 0.9
    air = bp(w, 300, 1400) * 0.10
    sway = 0.75 + 0.25 * np.sin(2 * np.pi * 0.045 * t_all + 1.0)[:, None]
    lvl = env_points([(0, 0.0), (1.5, 1.0), (58, 1.0), (66, 1.35), (75, 1.0), (88.5, 0.8), (90, 0.0)])[:, None]
    return (low + air) * sway * lvl * 0.07


def footstep(dist, heavy=1.0):
    n = int(0.22 * SR)
    tt = np.arange(n) / SR
    click = rng.standard_normal(n) * np.exp(-tt / 0.010)
    click = bp(click, 900, 5200) * 0.55
    body = rng.standard_normal(n) * np.exp(-tt / 0.035)
    body = bp(body, 120, 700) * 1.1
    thump = np.sin(2 * np.pi * (85 + 25 * heavy) * tt) * np.exp(-tt / 0.03) * 0.5 * heavy
    grit = bp(rng.standard_normal(n), 2500, 8000) * np.exp(-tt / 0.06) * 0.12 * (rng.random() < 0.5)
    s = click + body + thump + grit
    s = lp(s, 9000 - min(6000, dist * 650))   # алыс қадам күңгірттеу
    return s


def stone_set():
    """Блок орнына қойылғанда: ауыр тас соққысы + сырғу."""
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    thud = np.sin(2 * np.pi * 62 * tt * (1 - 0.15 * tt)) * np.exp(-tt / 0.09)
    knock = bp(rng.standard_normal(n), 180, 1600) * np.exp(-tt / 0.045) * 0.9
    scrape = bp(rng.standard_normal(n), 1500, 6000) * np.clip((tt - 0.02) / 0.03, 0, 1) * np.exp(-tt / 0.16) * 0.12
    return thud + knock + scrape


def stone_lift():
    n = int(0.55 * SR)
    tt = np.arange(n) / SR
    e = np.sin(np.pi * np.clip(tt / 0.5, 0, 1)) ** 2
    return bp(rng.standard_normal(n), 400, 3500) * e * 0.25 + np.sin(2 * np.pi * 70 * tt) * np.exp(-tt / 0.05) * 0.3


def metal_tick():
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) * a for f, d, a in [(2310, 0.12, 0.5), (3870, 0.07, 0.3), (5620, 0.04, 0.2)])
    s[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return s


def pebbles(dur=0.9):
    n = int(dur * SR)
    out = np.zeros(n)
    for k in range(9):
        i = int(rng.uniform(0, 0.75) * SR)
        m = int(0.05 * SR)
        tt = np.arange(m) / SR
        f = rng.uniform(1800, 4200)
        c = (np.sin(2 * np.pi * f * tt) * 0.6 + rng.standard_normal(m) * 0.5) * np.exp(-tt / 0.012) * rng.uniform(0.3, 1.0) * (1 - k / 12)
        out[i:i + m] += c[: n - i]
    return bp(out, 900, 8000)


def whoosh(dur, peak_at=0.6, lo=250, hi=2600):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    w = rng.standard_normal(n)
    # жиілік бойынша қозғалатын сүзгі: екі жолақты айқасу
    a, b = bp(w, lo, lo * 3), bp(w, hi / 3, hi)
    p = tt / dur
    mix = np.clip(p / peak_at, 0, 1)
    e = np.where(p < peak_at, (p / peak_at) ** 2, ((1 - p) / (1 - peak_at)) ** 1.5)
    return (a * (1 - mix) + b * mix) * e


def build_foley(events):
    buf = np.zeros((N, 2))
    for s in events['steps']:
        heavy = 1.0
        if s['who'] == 'H' and 66 <= s['t'] < 75:
            heavy = 1.35   # қызғаныштың ауыр қадамы
        g = (0.20 if s['vis'] else 0.08) / (1 + 0.12 * s['dist'])
        pan = float(np.clip(s['x'] / 6, -0.5, 0.5))
        place(buf, footstep(s['dist'], heavy), s['t'], pan=pan, gain=g * heavy)
    # құрылыс циклдары (timeline.js CYC: көтеру +0.9 с, қою +4.3 с)
    cyc = {'O1': (5.6, -0.35, 1.0), 'O2': (12.6, -0.35, 1.0), 'H1': (7.3, 0.35, 0.8), 'H2': (18.4, 0.35, 1.0)}
    for k, (T, pan, g) in cyc.items():
        place(buf, stone_lift(), T + 0.75, pan=pan, gain=0.22 * g)
        place(buf, stone_set(), T + 4.3, pan=pan, gain=0.28 * g)
    for i, tt in enumerate([17.75, 18.05, 18.4]):   # өлшеуіш
        place(buf, metal_tick(), tt, pan=-0.3, gain=0.05 - 0.01 * i)
    place(buf, pebbles(), 62.45, pan=0.2, gain=0.22)                # сүріну
    place(buf, pebbles(0.6), 69.8, pan=0.25, gain=0.10)
    return buf


def build_whooshes():
    buf = np.zeros((N, 2))
    for t_cut, dur, g, pan in [(8.0, 1.3, 0.10, 0.0), (25.0, 1.1, 0.08, -0.2), (43.0, 1.5, 0.09, 0.15),
                               (57.6, 1.0, 0.12, 0.4), (74.55, 1.0, 0.13, -0.4)]:
        place(buf, whoosh(dur), t_cut - dur * 0.6, pan=pan, gain=g * 1.5)
    return buf


def main():
    ev_path = os.path.join(ROOT, 'out', 'events.json')
    if not os.path.exists(ev_path):
        sys.exit('out/events.json жоқ — алдымен: node tools/events.mjs')
    events = json.load(open(ev_path))
    ir_big, ir_small = reverb_ir(4.2, 2400, 7), reverb_ir(1.6, 5000, 9)

    music = build_pad() * 0.20 + build_mallets()
    # дикторға орын: 1–4 кГц аймағын ~4 дБ әлсірету (параллель жолақ алу)
    music = music - bp(music, 1000, 4000) * 0.37
    music = apply_reverb(music, ir_big, 0.42)

    fx = build_foley(events) + build_whooshes()
    fx = apply_reverb(fx, ir_small, 0.22)
    fx = apply_reverb(fx, ir_big, 0.12)

    mix = music + fx + room_tone()
    if VOICE:
        # түпнұсқа видеоның дыбысы (диктор + оның фондық музыкасы) негізгі жол болады; менің партитурам
        # екі музыка қақтығыспауы үшін алынып тасталады, тек фоли/whoosh/ауа ақырын қосылады
        sr_v, v = wavfile.read(VOICE)
        assert sr_v == SR, f'{VOICE}: {sr_v} Гц (48000 керек)'
        v = v.astype(np.float64) / (2 ** 31 if v.dtype == np.int32 else 2 ** 15)
        if v.ndim == 1:
            v = np.stack([v, v], 1)
        voice = np.zeros((N, 2)); voice[: min(N, len(v))] = v[:N]
        bed = fx + room_tone()
        # фоли шыңы дауыс шыңынан ~11 дБ төмен: естіледі, бірақ сөзді баспайды
        bed *= np.abs(voice).max() * 10 ** (-11 / 20) / np.abs(bed).max()
        mix = voice + bed
    # табиғи аяқталу: соңғы 0.6 с толық тынышталу, басы 0.15 с fade-in (басылу болмауы үшін)
    fo = env_points([(0, 0.0), (0.15, 1.0), (89.2, 1.0), (89.9, 0.0), (90, 0.0)])
    if VOICE:  # дауыс бірден басталады және соңына дейін сақталады: қысқа fade-in, соңғы 0.4 с ғана сөнеді
        fo = env_points([(0, 0.0), (0.01, 1.0), (89.55, 1.0), (89.95, 0.0), (90, 0.0)])
    mix *= fo[:, None]
    peak = np.abs(mix).max()
    mix *= 10 ** (-3 / 20) / peak   # шың −3 dBFS (кейін ebur128 бойынша нормалау)
    out = os.path.join(ROOT, 'out', 'audio_voice.wav' if VOICE else 'audio.wav')
    pcm = np.clip(mix * (2 ** 31 - 1), -(2 ** 31), 2 ** 31 - 1).astype(np.int32)
    wavfile.write(out, SR, pcm)
    print(f'{out}: {len(mix) / SR:.3f} с, шың {20 * np.log10(np.abs(mix).max()):.1f} dBFS')


VOICE = None
if __name__ == '__main__':
    if '--voice' in sys.argv:
        VOICE = sys.argv[sys.argv.index('--voice') + 1]
    main()
