import numpy as np, wave
SR = 48000; DUR = 30.0; N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def env_ad(x, a, d):
    return np.where(x < 0, 0, np.where(x < a, x / a, np.exp(-(x - a) / d)))

def lowpass(x, fc):
    # one-pole, fc may be array
    fc = np.broadcast_to(fc, x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s; y[i] = s
    return y

# --- drone pad (A minor, slowly breathing) ---
fade_in = np.clip(t / 2.5, 0, 1); fade_out = np.clip((30 - t) / 1.6, 0, 1)
pad = np.zeros(N)
for f, a in [(55, .5), (110, .32), (164.8, .18), (220, .12), (261.6, .07), (329.6, .05)]:
    for det in (-.6, .6):
        pad += a * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6))
pad *= (0.75 + 0.25 * np.sin(2 * np.pi * t / 7.5)) * fade_in * fade_out * 0.13
L += pad; R += pad

# --- finale chord swell (F - C - Am feel) ---
sw = np.clip((t - 25) / 1.2, 0, 1) * fade_out
for f in (87.3, 174.6, 261.6, 349.2, 440, 523.3):
    v = np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t)
    L += .05 * sw * v; R += .05 * sw * np.sin(2 * np.pi * (f * 1.003) * t)

# --- risers (filtered noise swelling into each cut) ---
noise = rng.standard_normal(N)
for c in (5, 10, 15, 20, 25):
    seg = (t > c - 1.4) & (t < c + .05)
    k = np.clip((t - (c - 1.4)) / 1.4, 0, 1)
    fc = 300 + 7000 * k ** 2
    idx = np.where(seg)[0]
    y = lowpass(noise[idx], fc[idx]) * (k[idx] ** 2.2) * .55
    L[idx] += y * (0.7 + 0.3 * k[idx]); R[idx] += y * (1.0 - 0.3 * k[idx])

# --- impacts (sub boom + transient) ---
def boom(c, g=1.0):
    x = t - c; m = x >= 0
    f = 34 + 70 * np.exp(-x * 9)
    ph = 2 * np.pi * np.cumsum(np.where(m, f, 0)) / SR
    b = np.sin(ph) * env_ad(x, .004, .9) * g
    hit = lowpass(noise * env_ad(x, .001, .05), 2500) * 2.2 * g
    return b * .9 + hit
for c, g in [(1.55, .8), (5, 1), (10, .8), (15, 1), (20, .9), (25, 1.1)]:
    y = boom(c, g); L += y; R += y

# --- soft rhythmic ticks during capability scenes (100 bpm) ---
beat = 60 / 100
for k in range(int(5 / beat), int(25 / beat)):
    c = k * beat
    x = t - c
    m = (x >= 0) & (x < .12)
    tick = np.zeros(N); tick[m] = noise[m] * np.exp(-x[m] * 60)
    tick = tick - lowpass(tick, 4000)
    pan = .5 + .3 * np.sin(k)
    L += tick * .12 * (1 - pan); R += tick * .12 * pan
    if k % 2 == 0:  # pulse kick, quiet
        xk = np.clip(x, 0, None)
        kick = np.sin(2 * np.pi * (45 + 60 * np.exp(-xk * 30)) * xk) * env_ad(x, .002, .12) * .22
        L += kick; R += kick

# --- simple stereo reverb ---
def reverb(x, seed):
    n = int(SR * 2.2); r = np.random.default_rng(seed).standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2)
    r[:int(SR * .02)] = 0
    m = len(x) + n; F = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(r, F), F)[:len(x)]
L = L + .018 * reverb(L, 1); R = R + .018 * reverb(R, 2)

st = np.stack([L, R], 1)
st = np.tanh(st / np.max(np.abs(st)) * 1.6) * .89
st *= np.clip((30 - t) / 1.2, 0, 1)[:, None]
pcm = (st * 32767).astype('<i2')
with wave.open('/tmp/vid/audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
