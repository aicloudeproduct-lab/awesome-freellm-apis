#!/usr/bin/env python3
"""«Алға қадам жаса» — дыбыс: қазақша диктор (Piper + ISSAI KazakhTTS M1, CC-BY-4.0), түпнұсқа ambient музыка
мен нәзік пианино (процедуралық синтез), сахнамен синхронды эффектілер. Бәрі офлайн, авторлық құқығы бар материалсыз.

Музыка дауыс кезінде автоматты түрде бәсеңдейді (ducking): сөйлеу кезінде дикторан ~21 дБ төмен (талап: 18–24 дБ).
Нәтиже: out/audio.wav (48 кГц, 32-бит PCM стерео, дәл 22.000 с) және аралас деңгейлер туралы есеп.
"""
import json, os, wave
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

SR = 48000
DUR = 22.0
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(20261026)
T = np.arange(N) / SR


def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], btype='band', fs=SR, output='sos'), x, axis=0)
def lp(x, f, o=2): return sosfilt(butter(o, f, btype='low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, btype='high', fs=SR, output='sos'), x, axis=0)
def env(points): ts, vs = zip(*points); return np.interp(T, ts, vs)
def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def place(buf, sig, t0, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= len(buf): return
    s0 = max(0, -i0); sig = sig[s0:]; i0 = max(0, i0); n = min(len(sig), len(buf) - i0)
    a = (pan + 1) * np.pi / 4
    buf[i0:i0 + n, 0] += sig[:n] * np.cos(a) * gain
    buf[i0:i0 + n, 1] += sig[:n] * np.sin(a) * gain


def reverb_ir(length, damp, seed, pre=0.012):
    r = np.random.default_rng(seed); n = int(SR * length); tt = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-tt / (length / 6.5))[:, None]
    ir = lp(ir, damp); k = int(pre * SR); ir[:k] *= np.linspace(0, 1, k)[:, None]
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def reverb(x, ir, wet):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + y * wet


def hz(n):
    names = {'C': 0, 'C#': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
    return 440.0 * 2 ** ((names[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


# ---------------------------------------------------------------- диктор
def load_voice():
    timing = json.load(open(os.path.join(ROOT, 'audio', 'timing.json')))
    v = np.zeros(N)
    for lid, d in timing.items():
        with wave.open(os.path.join(ROOT, 'audio', f'voice_{lid}.wav')) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
            sr = w.getframerate()
        x = resample_poly(x, 320, 147) if sr == 22050 else x          # 22.05 → 48 кГц
        i0 = int(round(d['start'] * SR)); v[i0:i0 + len(x)] += x[: N - i0]
    v = hp(v, 75)
    # анықтық: 2.5–5 кГц сәл көтеріңкі, 250 Гц «күңгірттік» сәл төмен
    v = v + 0.22 * bp(v, 2500, 5000) - 0.12 * bp(v, 180, 350)
    # жұмсақ компрессия (RMS огибающий бойынша, 3:1, баяу)
    e = np.sqrt(lp(v ** 2, 12) .clip(1e-10))
    thr = np.percentile(e[e > 1e-3], 60)
    g = np.where(e > thr, (e / thr) ** (1 / 3 - 1), 1.0)
    g = lp(g, 20)
    v = v * g
    active = lp((np.abs(v) > 0.02).astype(float), 8) > 0.05            # сөйлеу бар сәттер
    return v, active, timing


# ---------------------------------------------------------------- музыка: пад + пианино
CHORDS = [  # (басталу, ноталар): Am(add9) → Fmaj7 → C(add9) → G/B → F → C(add9) — сабырлы, үмітті
    (0.0, ['A2', 'E3', 'A3', 'B3', 'C4']),
    (5.0, ['F2', 'C3', 'A3', 'E4']),
    (9.5, ['C3', 'G3', 'D4', 'E4']),
    (13.0, ['B2', 'G3', 'D4']),
    (16.0, ['F2', 'C3', 'A3', 'C4', 'G4']),
    (19.0, ['C3', 'G3', 'C4', 'D4', 'E4']),
]


def pad():
    out = np.zeros((N, 2)); xf = 1.4
    for k, (t0, notes) in enumerate(CHORDS):
        t1 = CHORDS[k + 1][0] if k + 1 < len(CHORDS) else DUR
        a, b = max(0, t0 - xf / 2), min(DUR, t1 + xf / 2); i0, i1 = int(a * SR), int(b * SR); n = i1 - i0
        tt = np.arange(n) / SR; seg = np.zeros((n, 2))
        for j, nm in enumerate(notes):
            f = hz(nm); r = np.random.default_rng(10 * k + j); v = np.zeros(n)
            for h in range(1, 6):
                for det in (-0.0015, 0.0018):
                    if f * h > 8000: continue
                    v += np.sin(2 * np.pi * f * h * (1 + det) * tt + r.random() * 6.28) / h ** 1.8
            pan = (j / max(1, len(notes) - 1) - 0.5) * 0.6
            seg[:, 0] += v * np.cos((pan + 1) * np.pi / 4); seg[:, 1] += v * np.sin((pan + 1) * np.pi / 4)
        fade = np.ones(n); fl = int(xf * SR)
        if k > 0: fade[:fl] = np.sin(np.linspace(0, np.pi / 2, fl)) ** 2
        if k + 1 < len(CHORDS): fade[-fl:] = np.cos(np.linspace(0, np.pi / 2, fl)) ** 2
        out[i0:i1] += seg * fade[:, None]
    # жарықтық: бөлмеде күңгірт, сыртқа шыққанда ашығырақ
    dark, bright = lp(out, 600), lp(out, 1800)
    w = env([(0, 0), (9.0, 0), (11.5, 1), (22, 1)])[:, None]
    return hp(dark * (1 - w) + bright * w, 45)


def piano_note(f, dur=4.0, vel=1.0):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    B = 0.0004  # ішектің инармониялығы
    for h in range(1, 9):
        fh = f * h * np.sqrt(1 + B * h * h)
        if fh > 12000: break
        s += np.sin(2 * np.pi * fh * tt) * np.exp(-tt * (0.9 + 0.55 * h)) / h ** 1.15
    ham = bp(rng.standard_normal(n), 800, 4000) * np.exp(-tt / 0.006) * 0.04       # балғашықтың нәзік соққысы
    a = int(0.004 * SR); s[:a] *= np.linspace(0, 1, a)
    return (s + ham) * vel


PIANO = [  # (уақыт, ноталар, күш): сөйлем арасындағы кідірістерде, жұмсақ
    (0.25, ['A3', 'E4'], 0.55), (3.85, ['C5'], 0.4), (4.35, ['B4'], 0.35),
    (9.42, ['E5'], 0.32), (9.62, ['G4', 'C5'], 0.4),
    (15.15, ['D5'], 0.35), (15.6, ['C5'], 0.33),
    (20.85, ['C4', 'G4', 'E5'], 0.5), (21.15, ['C5'], 0.28),
]


def piano():
    out = np.zeros((N, 2))
    for t0, notes, vel in PIANO:
        for j, nm in enumerate(notes):
            place(out, piano_note(hz(nm), 4.5, vel), t0 + j * 0.035, pan=(j - (len(notes) - 1) / 2) * 0.25, gain=0.35)
    return lp(out, 7000)


# ---------------------------------------------------------------- эффектілер
def footstep(dist, outdoor, soft=1.0):
    n = int(0.25 * SR); tt = np.arange(n) / SR
    s = bp(rng.standard_normal(n) * np.exp(-tt / 0.012), 700, 4500) * 0.45            # табанның тасқа тиюі
    s += bp(rng.standard_normal(n) * np.exp(-tt / 0.04), 110, 600) * 0.9               # дене салмағы
    s += np.sin(2 * np.pi * 95 * tt) * np.exp(-tt / 0.03) * 0.35
    if outdoor: s += bp(rng.standard_normal(n), 2500, 9000) * np.exp(-tt / 0.07) * 0.10   # ұсақ тас, құм
    return lp(s, 9000 - min(5500, dist * 400)) * soft


def door_push(strength):
    n = int(1.2 * SR); tt = np.arange(n) / SR
    thud = np.sin(2 * np.pi * 58 * tt * (1 - 0.1 * tt)) * np.exp(-tt / 0.12)
    knock = bp(rng.standard_normal(n), 120, 1200) * np.exp(-tt / 0.05) * 0.8
    # құлып/топса сылдыры: бірнеше ұсақ металл соғысы
    rattle = np.zeros(n)
    for k in range(6):
        i = int((0.015 + k * 0.032 + rng.random() * 0.01) * SR); m = int(0.04 * SR); t2 = np.arange(m) / SR
        f = rng.uniform(1600, 3200)
        rattle[i:i + m] += np.sin(2 * np.pi * f * t2) * np.exp(-t2 / 0.01) * (1 - k / 7) * 0.35
    creak = np.sin(2 * np.pi * (140 + 30 * np.sin(2 * np.pi * 3 * tt)) * tt) * np.exp(-((tt - 0.12) / 0.08) ** 2) * 0.12
    return (thud + knock + rattle + creak) * strength


def dust_trickle(dur=1.4):
    n = int(dur * SR); tt = np.arange(n) / SR
    e = np.exp(-tt / 0.5) * (1 - np.exp(-tt / 0.03))
    grains = (rng.random(n) < 0.004) * rng.standard_normal(n)
    return bp(grains + 0.05 * rng.standard_normal(n), 2500, 9000) * e


def shimmer(dur):
    """Жарықтың ашылуы: ауа тәрізді, баяу көтерілетін жоғары реңк (қатты емес)."""
    n = int(dur * SR); tt = np.arange(n) / SR; p = tt / dur
    e = np.sin(np.pi * np.clip(p, 0, 1)) ** 2
    air = bp(rng.standard_normal(n), 3000, 9000) * 0.25
    tone = sum(np.sin(2 * np.pi * f * tt) * a for f, a in [(1318.5, 0.05), (1975.5, 0.035), (2637, 0.02)])
    return (air + tone) * e


def whoosh(dur, peak=0.55, lo=200, hi=2400):
    n = int(dur * SR); tt = np.arange(n) / SR; p = tt / dur; w = rng.standard_normal(n)
    a, b = bp(w, lo, lo * 3), bp(w, hi / 3, hi); mix = np.clip(p / peak, 0, 1)
    e = np.where(p < peak, (p / peak) ** 2, ((1 - p) / (1 - peak)) ** 1.6)
    return (a * (1 - mix) + b * mix) * e


def ambience():
    w = rng.standard_normal((N, 2))
    room = lp(w, 160) * 0.5 + bp(w, 200, 900) * 0.05                                     # тас бөлменің ауасы
    wind = bp(w, 250, 2200) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * T + 1.3))[:, None] * 0.35 + lp(w, 120) * 0.4
    k = env([(0, 0), (9.3, 0), (10.5, 1), (22, 1)])[:, None]
    lvl = env([(0, 0), (0.6, 1), (21.2, 1), (22, 0)])[:, None]
    return (room * (1 - k) + wind * k) * lvl * 0.05


def main():
    voice, active, timing = load_voice()
    ev = json.load(open(os.path.join(ROOT, 'out', 'events.json')))
    ir_room, ir_big, ir_small = reverb_ir(2.6, 3200, 3), reverb_ir(4.0, 2600, 5), reverb_ir(0.6, 6000, 7)

    # --- музыка және оның бәсеңдеуі
    music = pad() * 0.11 + piano()
    music = reverb(music, ir_big, 0.45)
    duck = lp(np.where(active, 1.0, 0.0), 3)                                             # жұмсақ шабуыл/босату
    mus_gain = 10 ** ((-9.0 * duck) / 20)                                                 # сөйлеу кезінде −9 дБ
    shape = env([(0, 0.0), (0.4, 1.0), (16.0, 1.0), (20.7, 1.15), (21.3, 1.15), (22.0, 0.0)])   # соңында табиғи сөну
    music = music * (mus_gain * shape)[:, None]
    # калибрлеу: сөйлеу кезінде музыка дикторан дәл ~21 дБ төмен болсын (талап 18–24 дБ)
    TARGET_GAP = 21.0
    music *= 10 ** ((db(voice[active]) - TARGET_GAP - db(music[active].mean(1))) / 20)

    # --- эффектілер
    fx = np.zeros((N, 2))
    for s in ev['steps']:
        outdoor = s['x'] > 2.6
        soft = 0.45 if 5.2 < s['t'] < 8.3 else (0.8 if s['t'] > 15 else 1.0)            # есік алдындағы табан жылжуы ақырын
        place(fx, footstep(s['dist'], outdoor, soft), s['t'], pan=float(np.clip((s['x'] - 0.5) / 12, -0.4, 0.4)), gain=0.16 / (1 + 0.05 * s['dist']))
    for t0, st in [(5.62, 0.8), (6.42, 1.0)]:                                            # есікті итеру
        place(fx, door_push(st), t0 - 0.01, pan=0.0, gain=0.32)
        place(fx, dust_trickle(), t0 + 0.08, pan=0.1, gain=0.05 * st)
    place(fx, shimmer(2.2), 7.4, pan=0.35, gain=0.25)                                     # жарық басқа бағытты ашады
    place(fx, whoosh(1.1, 0.7, 300, 3200), 8.95, pan=0.2, gain=0.09)                      # жарық арқылы ауысу (match cut)
    place(fx, whoosh(3.6, 0.6, 150, 1600), 12.0, pan=-0.1, gain=0.10)                     # кран жоғары: кеңістік ашылады
    place(fx, whoosh(3.0, 0.45, 120, 1400), 16.2, pan=0.1, gain=0.07)                     # көкжиекке қарай сырғу
    inside = np.zeros((N, 2)); inside[: int(9.5 * SR)] = fx[: int(9.5 * SR)]
    outside = fx - inside
    fx = reverb(inside, ir_room, 0.35) + reverb(outside, ir_small, 0.12)

    vox = np.stack([voice, voice], 1)
    vox = reverb(vox, ir_small, 0.06)                                                     # табиғи кеңістік (құрғақ емес, жаңғырықсыз)

    mix = vox + music + fx + ambience()
    mix *= env([(0, 0.0), (0.02, 1.0), (21.9, 1.0), (22.0, 0.0)])[:, None]

    # --- есеп: сөйлеу кезіндегі музыка деңгейі дикторға қатысты
    a = active
    rel = db(music[a].mean(1)) - db(voice[a])
    print(f'сөйлеу кезінде музыка дикторан {(-rel):.1f} дБ төмен; кідірістерде музыка {db(music[~a & (T > 0.5) & (T < 21.5)].mean(1)):.1f} dBFS')
    peak = np.abs(mix).max(); mix *= 10 ** (-1.5 / 20) / peak
    out = os.path.join(ROOT, 'out', 'audio.wav')
    wavfile.write(out, SR, (np.clip(mix, -1, 1) * (2 ** 31 - 1)).astype(np.int32))
    print(f'{out}: {len(mix) / SR:.3f} с')


if __name__ == '__main__':
    main()
