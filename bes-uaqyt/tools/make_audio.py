"""Procedural sound design for "Bes uaqyt" (no samples, no voice).

Every sound is synthesised from noise/oscillators with envelopes, filters and a
synthetic canyon reverb, and placed on the events exported from the motion
code (build/events.json), so audio and picture share one timeline.

Outputs
  build/audio/stems/*.wav   individual layers (for checking)
  build/audio/master.wav    float32 master, loudness-normalised
  public/audio/mix.wav      16-bit copy used by the Remotion preview
"""
import json
import os
import sys

import numpy as np
import pyloudnorm as pyln
from scipy import signal
from scipy.io import wavfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CFG = json.load(open(os.path.join(ROOT, 'src', 'config', 'audio.json')))
EV = json.load(open(os.path.join(ROOT, 'build', 'events.json')))
SR = CFG['sampleRate']
DUR = EV['duration']
N = int(DUR * SR)
RNG = np.random.default_rng(CFG['seed'])
LV = CFG['levels']


def db(x):
    return 10 ** (x / 20)


def t2i(t):
    return int(round(t * SR))


def noise(n, rng=RNG):
    return rng.standard_normal(n)


def pink(n, rng=RNG):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.arange(len(X))
    f[0] = 1
    X = X / np.sqrt(f)
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-9)


def brown(n, rng=RNG):
    y = np.cumsum(rng.standard_normal(n))
    y = signal.sosfilt(signal.butter(1, 15, 'hp', fs=SR, output='sos'), y)
    return y / (np.std(y) + 1e-9)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'highpass', fs=SR, output='sos'), x)


def reson(x, f, q):
    b, a = signal.iirpeak(f, q, fs=SR)
    return signal.lfilter(b, a, x)


def env_exp(n, decay, attack=0.002):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1) if attack > 0 else 1
    return a * np.exp(-t / decay)


def env_hann(n):
    return np.hanning(n) if n > 2 else np.ones(n)


def pan_gains(p):
    p = float(np.clip(p, -1, 1))
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


class Bus:
    def __init__(self, name):
        self.name = name
        self.L = np.zeros(N + SR * 6)
        self.R = np.zeros(N + SR * 6)

    def add(self, t, x, gain=1.0, pan=0.0, width=0.0):
        """Mono x at time t; width decorrelates by a few ms between channels."""
        i = t2i(t)
        if i < 0:
            x = x[-i:]
            i = 0
        n = min(len(x), len(self.L) - i)
        if n <= 0:
            return
        gl, gr = pan_gains(pan)
        self.L[i:i + n] += x[:n] * gain * gl
        if width > 0:
            d = int(width * SR)
            j = i + d
            m = min(n, len(self.R) - j)
            self.R[j:j + m] += x[:m] * gain * gr
        else:
            self.R[i:i + n] += x[:n] * gain * gr

    def add_stereo(self, t, l, r, gain=1.0):
        i = t2i(t)
        n = min(len(l), len(self.L) - i)
        self.L[i:i + n] += l[:n] * gain
        self.R[i:i + n] += r[:n] * gain

    def stereo(self):
        return np.stack([self.L[:N], self.R[:N]], 1)


# ------------------------------------------------------------- curves
def curve(arr, step=0.1):
    t = np.arange(N) / SR
    return np.interp(t, np.arange(len(arr)) * step, arr)


LOAD = curve(EV['load'])
PAN = curve(EV['pan'])
TT = np.arange(N) / SR


def load_at(t):
    return float(np.interp(t, np.arange(len(EV['load'])) * 0.1, EV['load']))


def pan_at(t):
    return float(np.interp(t, np.arange(len(EV['pan'])) * 0.1, EV['pan']))


# ------------------------------------------------------------- notes
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'Bb': 10, 'B': 11}


def hz(name):
    pitch, octv = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[pitch] + 12 * (octv + 1) - 69) / 12)


# ------------------------------------------------------------- layers
def ambience():
    wind = Bus('wind')
    # broadband wind, two decorrelated streams, slow gusts
    for ch, seed in ((0, 11), (1, 12)):
        r = np.random.default_rng(seed)
        x = pink(N, r)
        lfo = 0.55 + 0.45 * np.sin(2 * np.pi * (0.06 + 0.01 * ch) * TT + seed) * np.sin(2 * np.pi * 0.023 * TT + 1.3 * ch)
        lo = bp(x, 160, 1400) * (0.6 + 0.4 * lfo)
        hi = bp(x, 1400, 4200) * 0.18 * lfo ** 2
        sig = lo + hi
        # quieter, softer air at the very end
        sig *= 1 - 0.45 * np.clip((TT - 16.5) / 3.0, 0, 1)
        if ch == 0:
            wind.L[:N] += sig * db(LV['wind'])
        else:
            wind.R[:N] += sig * db(LV['wind'])
    # faint whistling resonance that drifts in pitch
    r = np.random.default_rng(13)
    w = noise(N, r)
    out = np.zeros(N)
    blk = SR // 10
    for k in range(0, N, blk):
        f = 700 + 260 * np.sin(2 * np.pi * 0.05 * k / SR) + 90 * np.sin(2 * np.pi * 0.13 * k / SR)
        seg = w[max(0, k - 2048):k + blk]
        y = reson(seg, f, 30)[-(min(blk, N - k)):]
        out[k:k + len(y)] = y
    out *= (0.5 + 0.5 * np.sin(2 * np.pi * 0.04 * TT)) ** 2
    wind.add(0, out * db(LV['whistle']), pan=-0.3, width=0.011)

    room = Bus('room')
    x = lp(brown(N, np.random.default_rng(14)), 140)
    room.add(0, x * db(LV['roomTone']), width=0.017)
    return wind, room


def pad():
    bus = Bus('pad')
    chords = CFG['chords']
    xfade = 1.8
    for ci, ch in enumerate(chords):
        t0 = ch['t']
        t1 = chords[ci + 1]['t'] if ci + 1 < len(chords) else DUR + 1
        start = max(0.0, t0 - xfade * 0.5)
        end = min(DUR + 0.5, t1 + xfade * 0.5)
        n = t2i(end - start)
        tt = np.arange(n) / SR
        env = np.clip(tt / xfade, 0, 1) * np.clip((end - start - tt) / xfade, 0, 1)
        env = env ** 1.3
        l = np.zeros(n)
        r = np.zeros(n)
        for k, name in enumerate(ch['notes']):
            f = hz(name)
            amp = 0.5 if f < 110 else (0.32 if f < 300 else 0.2)
            for side, det in ((0, -3.5), (1, 3.5)):
                ff = f * 2 ** (det / 1200)
                ph = RNG.uniform(0, 2 * np.pi)
                v = np.zeros(n)
                for h in range(1, 6):
                    v += np.sin(2 * np.pi * ff * h * tt + ph * h) / h ** 1.7
                v *= 1 + 0.05 * np.sin(2 * np.pi * (0.11 + 0.03 * k) * tt + k)
                if side == 0:
                    l += v * amp
                else:
                    r += v * amp
        bus.add_stereo(start, l * env, r * env)
    # brightness opens up as the burden lightens
    L, R = bus.L[:N], bus.R[:N]
    dark, bright = lp(L, 700), lp(L, 2600)
    light = 1 - LOAD
    bus.L[:N] = dark * (1 - light) + bright * light
    dark, bright = lp(R, 700), lp(R, 2600)
    bus.R[:N] = dark * (1 - light) + bright * light
    # swell in the ending, almost silent at the very start
    shape = 0.55 + 0.25 * light + 0.35 * np.clip((TT - 16.6) / 1.6, 0, 1)
    shape *= np.clip(TT / 2.5, 0.25, 1)
    bus.L[:N] *= shape * db(LV['pad'])
    bus.R[:N] *= shape * db(LV['pad'])
    return bus


def chime(f, dur=4.0, rng=RNG):
    n = t2i(dur)
    tt = np.arange(n) / SR
    partials = [(1, 1.0, 1.6), (2.01, 0.35, 0.9), (2.76, 0.18, 0.6), (5.4, 0.06, 0.25)]
    y = np.zeros(n)
    for ratio, a, d in partials:
        y += a * np.sin(2 * np.pi * f * ratio * tt + rng.uniform(0, 6)) * np.exp(-tt / d)
    return y * np.clip(tt / 0.006, 0, 1)


# ------------------------------------------------------------- foley
def wood_knock(f1, rng, decay=0.09):
    n = t2i(0.35)
    exc = noise(n, rng) * env_exp(n, 0.004, 0.0005)
    y = reson(exc, f1, 9) * 1.0 + reson(exc, f1 * 2.28, 12) * 0.55 + reson(exc, f1 * 4.07, 16) * 0.3
    y = y * env_exp(n, decay, 0.0008)
    return y / (np.max(np.abs(y)) + 1e-9)


def thump(f, rng, decay=0.07):
    n = t2i(0.3)
    tt = np.arange(n) / SR
    sweep = f * (1 + 0.6 * np.exp(-tt / 0.015))
    s = np.sin(2 * np.pi * np.cumsum(sweep) / SR) * env_exp(n, decay, 0.002)
    s += lp(noise(n, rng), 300) * env_exp(n, 0.03, 0.001) * 0.4
    return s / (np.max(np.abs(s)) + 1e-9)


def creak(rng, dur=0.22, f=650, rate=(60, 160)):
    """Stick-slip friction: a click train whose rate glides, through resonances."""
    n = t2i(dur)
    x = np.zeros(n)
    t = 0.0
    while t < dur:
        u = t / dur
        rr = rate[0] + (rate[1] - rate[0]) * np.sin(np.pi * u)
        i = int(t * SR)
        if i < n:
            x[i] += rng.uniform(0.6, 1.0)
        t += 1.0 / rr * rng.uniform(0.85, 1.15)
    y = reson(x, f, 14) + 0.6 * reson(x, f * 1.9, 18) + 0.3 * reson(x, f * 3.1, 20)
    y *= env_hann(n)
    return y / (np.max(np.abs(y)) + 1e-9)


def rustle(rng, dur=0.25, lo=1500, hi=6500, grain=True):
    n = t2i(dur)
    x = bp(noise(n, rng), lo, hi)
    if grain:
        g = np.abs(lp(noise(n, rng), 40))
        x *= g / (np.max(g) + 1e-9)
    x *= env_hann(n) ** 0.8
    return x / (np.max(np.abs(x)) + 1e-9)


def clack(rng, f=None):
    n = t2i(0.06)
    f = f or rng.uniform(1700, 3200)
    exc = noise(n, rng) * env_exp(n, 0.0015, 0.0002)
    y = reson(exc, f, 20) + 0.5 * reson(exc, f * 1.63, 25)
    y *= env_exp(n, 0.018)
    return y / (np.max(np.abs(y)) + 1e-9)


def gravel(rng, dur=0.16):
    n = t2i(dur)
    x = np.zeros(n)
    for _ in range(int(rng.integers(14, 24))):
        i = int(rng.uniform(0, 0.75) * n)
        g = clack(rng, rng.uniform(2200, 5200)) * rng.uniform(0.2, 1)
        m = min(len(g), n - i)
        x[i:i + m] += g[:m]
    x += hp(noise(n, rng), 1800) * env_exp(n, 0.04) * 0.4
    x *= env_exp(n, 0.07, 0.002)
    return x / (np.max(np.abs(x)) + 1e-9)


def whoosh(rng, dur=0.8, f0=350, f1=1300, peak=0.55):
    n = t2i(dur)
    x = pink(n, rng)
    out = np.zeros(n)
    blk = 512
    for k in range(0, n, blk):
        u = k / n
        f = f0 + (f1 - f0) * u
        seg = x[max(0, k - 1024):k + blk]
        y = bp(seg, f * 0.6, f * 1.6, 1)[-min(blk, n - k):]
        out[k:k + len(y)] = y
    u = np.arange(n) / n
    e = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.5)
    out *= e
    return out / (np.max(np.abs(out)) + 1e-9)


def foley():
    steps = Bus('steps')
    creaks = Bus('creaks')
    fabric = Bus('fabric')
    stones = Bus('stones')
    far = Bus('far')
    fx = Bus('fx')
    chimes = Bus('chimes')
    rng = np.random.default_rng(CFG['seed'] + 100)

    for k, s in enumerate(EV['steps']):
        t, load, p = s['t'], s['load'], s['pan']
        if t < 0:
            continue
        g = (0.55 if s['closing'] else 1.0) * db(rng.uniform(-2.5, 1.5))
        heavy = 0.35 + 0.65 * load
        if s['onRock']:
            steps.add(t, gravel(rng) * db(LV['stepRock']) * g * (0.7 + 0.3 * heavy), pan=p)
            steps.add(t, thump(rng.uniform(70, 85), rng, 0.05) * db(LV['stepThump'] - 8) * g, pan=p)
        else:
            f1 = rng.uniform(170, 235) * (1 + 0.12 * (1 - load))
            steps.add(t, wood_knock(f1, rng, decay=rng.uniform(0.07, 0.11)) * db(LV['stepWood']) * g * (0.6 + 0.4 * heavy), pan=p)
            steps.add(t + 0.004, thump(rng.uniform(62, 80), rng, 0.05 + 0.05 * load) * db(LV['stepThump']) * g * heavy ** 1.5, pan=p)
            if rng.uniform() < 0.35 + 0.5 * load:
                creaks.add(t + rng.uniform(0.02, 0.09), creak(rng, rng.uniform(0.16, 0.3), rng.uniform(520, 880)) * db(LV['creak']) * heavy, pan=p + rng.uniform(-0.2, 0.2))
        # toe-off scuff
        if s['lift'] > 0:
            steps.add(s['lift'] + 0.03, rustle(rng, 0.05, 2500, 8000, False) * db(LV['fabric'] - 6) * g, pan=p)
        # pack fabric and stone rattle follow the impact slightly late (weight lag)
        fabric.add(t + 0.05, rustle(rng, rng.uniform(0.16, 0.26)) * db(LV['fabric']) * (0.4 + 0.6 * load), pan=p - 0.1)
        stones_left = round(load * 5)
        for c in range(stones_left):
            stones.add(t + 0.06 + rng.uniform(0, 0.07), clack(rng) * db(LV['rattle']) * rng.uniform(0.4, 1.0), pan=p + rng.uniform(-0.1, 0.1))

    for i, pr in enumerate(EV['prayers']):
        p = pr['pan']
        load = load_at(pr['t0'] + 0.05)
        # going down: fabric, knees on planks, rope reply
        fabric.add(pr['t0'] + 0.05, rustle(rng, 0.45, 900, 5000) * db(LV['fabric'] + 2), pan=p)
        steps.add(pr['kneel'] - 0.02, thump(rng.uniform(80, 95), rng, 0.06) * db(LV['knee']) * (0.6 + 0.4 * load), pan=p)
        steps.add(pr['kneel'], wood_knock(rng.uniform(150, 190), rng, 0.08) * db(LV['knee'] - 4), pan=p)
        creaks.add(pr['kneel'] + 0.05, creak(rng, 0.42, rng.uniform(380, 520), (40, 110)) * db(LV['ropeCreak'] + 2), pan=p + 0.25, width=0.006)
        fabric.add(pr['kneel'] + 0.05, rustle(rng, 0.35, 900, 5000) * db(LV['fabric'] + 1), pan=p)
        # palms and forehead touch the wood: very soft
        steps.add(pr['sajda'] - 0.03, wood_knock(rng.uniform(260, 320), rng, 0.04) * db(LV['knee'] - 10), pan=p + 0.05)
        # stone works loose, grinds, is free
        stones.add(pr['release'], rustle(rng, 0.16, 300, 1800) * db(LV['stoneGrind']), pan=p)
        for c in range(4):
            stones.add(pr['release'] + 0.02 + c * 0.03, clack(rng, rng.uniform(1100, 1800)) * db(LV['rattle'] + 3) * (1 - c * 0.18), pan=p)
        # bounce on the plank edge: stone on wood
        b = pr['bounce']
        stones.add(b, wood_knock(rng.uniform(300, 380), rng, 0.06) * db(LV['stoneBounce']), pan=p)
        stones.add(b, clack(rng, rng.uniform(1300, 1900)) * db(LV['stoneBounce'] - 6), pan=p)
        creaks.add(b + 0.08, creak(rng, 0.5, rng.uniform(340, 460), (35, 90)) * db(LV['ropeCreak']), pan=p - 0.2, width=0.007)
        # falling away: faint descending air, then a far, soft landing deep below
        fall = whoosh(rng, 1.1, 1500, 300, 0.25)
        stones.add(b + 0.05, fall * db(LV['stoneFall']), pan=p)
        land = lp(thump(rng.uniform(55, 70), rng, 0.12), 400) + 0.4 * lp(gravel(rng, 0.3), 1200)
        far.add(b + 1.45 + 0.1 * i, land * db(LV['stoneFar']) * (1 - 0.08 * i), pan=p * 0.5)
        # a single soft tone marks each burden released, rising each time
        f = hz(CFG['chimeNotes'][i])
        c = chime(f, 4.5, rng)
        chimes.add(pr['release'] + 0.25, c * db(LV['chime']), pan=-0.15 + 0.08 * i, width=0.009)
        # rising again
        fabric.add(pr['rise'] + 0.05, rustle(rng, 0.5, 900, 5000) * db(LV['fabric'] + 1), pan=p)
        creaks.add(pr['kneel2'], creak(rng, 0.3, rng.uniform(420, 600), (50, 130)) * db(LV['ropeCreak']) * (0.5 + 0.5 * load), pan=p + 0.2)

    # bridge sways on its own now and then
    for t in np.arange(1.3, 15.5, 2.7):
        tt = t + rng.uniform(-0.4, 0.4)
        creaks.add(tt, creak(rng, rng.uniform(0.5, 0.8), rng.uniform(280, 360), (25, 70)) * db(LV['ropeCreak'] - 4), pan=rng.uniform(-0.6, 0.6), width=0.008)

    # finale: strap, slide off, set down, stand
    F = EV['finale']
    p = pan_at(F['slip'])
    fabric.add(F['reach'] - 0.1, rustle(rng, 0.3, 1200, 6000) * db(LV['fabric'] + 1), pan=p)
    fabric.add(F['slip'] - 0.25, rustle(rng, 0.55, 600, 5000) * db(LV['fabric'] + 4), pan=p)
    fx.add(F['lower'] - 0.01, lp(thump(rng.uniform(85, 100), rng, 0.05), 900) * db(LV['packDown']), pan=p + 0.1)
    fx.add(F['lower'], gravel(rng, 0.12) * db(LV['packDown'] - 9), pan=p + 0.1)
    fabric.add(F['lower'] + 0.02, rustle(rng, 0.4, 700, 4000) * db(LV['fabric']), pan=p + 0.1)
    fabric.add(F['rise'] - 0.4, rustle(rng, 0.5, 900, 4500) * db(LV['fabric'] - 3), pan=p)

    # titles and closing lines: barely-there air
    for ti in EV['titles']:
        fx.add(ti['t'] - 0.25, whoosh(rng, 0.9, 300, 1100) * db(LV['whoosh']), pan=0, width=0.012)
    for k, fl in enumerate(EV['finalLines']):
        fx.add(fl['t'] - 0.2, whoosh(rng, 1.0, 250, 900) * db(LV['whoosh'] - 1 + (2 if k == 1 else 0)), pan=0, width=0.014)
    return [steps, creaks, fabric, stones, far, fx, chimes]


# ------------------------------------------------------------- reverb
def canyon_ir(decay, predelay, rng):
    n = t2i(decay * 1.6)
    tt = np.arange(n) / SR
    irs = []
    for ch in range(2):
        x = noise(n, rng) * np.exp(-6.9 * tt / decay)
        x = lp(x, 5200) * 0.7 + lp(x, 1600) * 0.3
        # sparse early reflections off the rock walls
        for d, a in ((0.041, 0.5), (0.067, 0.35), (0.113, 0.28), (0.19, 0.2), (0.31, 0.12)):
            i = t2i(d + 0.004 * ch)
            if i < n:
                x[i] += a * (1 if (ch + int(d * 1000)) % 2 else -1)
        pre = np.zeros(t2i(predelay))
        irs.append(np.concatenate([pre, x]))
    norm = np.sqrt(np.sum(irs[0] ** 2))
    return [ir / norm for ir in irs]


def main():
    os.makedirs(os.path.join(ROOT, 'build', 'audio', 'stems'), exist_ok=True)
    wind, room = ambience()
    music = pad()
    fol = foley()
    buses = [wind, room, music] + fol

    dry = np.zeros((N, 2))
    send = np.zeros((N, 2))
    light = (1 - LOAD)[:, None]
    rv = CFG['reverb']
    send_amt = rv['sendHeavy'] + (rv['sendLight'] - rv['sendHeavy']) * light
    for b in buses:
        st = b.stereo()
        wavfile.write(os.path.join(ROOT, 'build', 'audio', 'stems', f'{b.name}.wav'), SR, st.astype(np.float32))
        dry += st
        k = {'wind': 0.25, 'room': 0.0, 'pad': 0.55, 'far': 1.4, 'chimes': 0.9, 'fx': 0.6}.get(b.name, 1.0)
        send += st * send_amt * k

    irL, irR = canyon_ir(rv['decay'], rv['predelay'], np.random.default_rng(77))
    wet = np.stack([signal.fftconvolve(send[:, 0], irL)[:N], signal.fftconvolve(send[:, 1], irR)[:N]], 1)
    mix = dry + wet * 0.9
    mix = hp(mix.T, 28).T

    fi, fo = CFG['fadeIn'], CFG['fadeOut']
    fade = np.clip(TT / fi, 0, 1) * np.clip((DUR - TT) / fo, 0, 1)
    mix *= (fade ** 1.5)[:, None]

    # loudness to target, then a gentle true-peak limiter
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(mix)
    mix *= db(CFG['targetLufs'] - lufs)
    mix = limit(mix, db(CFG['truePeakCeiling']))
    lufs2 = meter.integrated_loudness(mix)
    mix *= db(CFG['targetLufs'] - lufs2)
    mix = limit(mix, db(CFG['truePeakCeiling']))
    lufs3 = meter.integrated_loudness(mix)
    tp = true_peak(mix)
    wavfile.write(os.path.join(ROOT, 'build', 'audio', 'master.wav'), SR, mix.astype(np.float32))
    pcm = np.clip(mix * 32767, -32768, 32767).astype(np.int16)
    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    wavfile.write(os.path.join(ROOT, 'public', 'audio', 'mix.wav'), SR, pcm)
    print(f'audio: {DUR:.1f}s stereo {SR} Hz, integrated {lufs3:.2f} LUFS, true peak {20 * np.log10(tp):.2f} dBTP')


def true_peak(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return float(np.max(np.abs(up)))


def limit(x, ceiling):
    """Look-ahead peak limiter on the 4x-oversampled envelope (no clipping)."""
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(1)
    env = up.reshape(-1, 4).max(1)[:len(x)]
    if len(env) < len(x):
        env = np.pad(env, (0, len(x) - len(env)))
    need = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    look = int(0.004 * SR)
    # min over look-ahead window, then smooth release
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * look + 1, mode='nearest')
    rel = np.exp(-1 / (0.08 * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * rel
        out[i] = cur
    out = signal.sosfiltfilt(signal.butter(1, 200, 'lp', fs=SR, output='sos'), out)
    y = x * out[:, None]
    # safety: tiny residual overs from smoothing
    peak = true_peak(y)
    if peak > ceiling:
        y *= ceiling / peak
    return y


if __name__ == '__main__':
    main()
