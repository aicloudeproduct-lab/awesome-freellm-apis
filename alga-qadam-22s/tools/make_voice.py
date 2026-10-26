#!/usr/bin/env python3
"""Қазақша дикторлық мәтін: Piper + ISSAI KazakhTTS (M1 «Iseke», CC-BY-4.0) — тегін, офлайн, сутаңбасыз.
Әр сөйлем жеке синтезделеді (кідірістерді өзіміз басқарамыз). Негізгі сөздің басталу уақыты
сөйлемнің сол сөзге дейінгі бөлігін бөлек синтездеу арқылы бағаланады (экрандағы ерекшелеу соған сәйкестенеді).
Нәтиже: audio/voice_*.wav (22.05 кГц моно) және audio/voice.json (ұзақтықтар, кілт сөз уақыты)."""
import json, os, wave
import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEAKER = 1          # ISSAI_KazakhTTS_M1_Iseke: төмен, байсалды ер дауыс
LS = 1.12            # сөйлеу қарқыны: сәл баяу, байсалды (1.0 — әдепкі)
LINES = [
    # id, мәтін, кілт сөзге дейінгі бөлік (экрандағы ерекшелеу осы сәтте)
    ('l1', 'Кейде өмір сен қалаған есікті ашпайды.', 'Кейде өмір сен'),
    ('l2', 'Бірақ бұл — жолың бітті деген сөз емес.', 'Бірақ бұл — жолың'),
    ('l3', 'Мүмкін, алдыңда сен ойлағаннан да кең мүмкіндік тұрған шығар.', 'Мүмкін, алдыңда сен ойлағаннан да'),
    ('l4a', 'Өзіңе сен.', None),
    ('l4b', 'Бір қадам жаса.', 'Бір'),
    ('l4c', 'Жол жүре келе ашылады.', None),
]

voice = PiperVoice.load(os.path.join(ROOT, 'voice_model', 'kk-issai-high.onnx'))
cfg = SynthesisConfig(speaker_id=SPEAKER, length_scale=LS, noise_scale=0.6, noise_w_scale=0.7)


def synth(text):
    chunks = list(voice.synthesize(text, syn_config=cfg))
    x = np.concatenate([c.audio_float_array for c in chunks])
    return x, chunks[0].sample_rate


def trim(x, sr, thr_db=-42):
    """Басы мен соңындағы тыныштықты кесу (кейін уақытты өзіміз қоямыз)."""
    e = np.convolve(x ** 2, np.ones(int(0.01 * sr)) / int(0.01 * sr), 'same')
    on = np.where(10 * np.log10(e + 1e-12) > thr_db)[0]
    a, b = max(0, on[0] - int(0.02 * sr)), min(len(x), on[-1] + int(0.06 * sr))
    return x[a:b]


info = {}
for lid, text, pre in LINES:
    best = None
    for k in range(3):  # шуыл кездейсоқ: 3 нұсқадан ұзақтығы ортаңғысын аламыз (тұрақтырақ ырғақ)
        x, sr = synth(text); x = trim(x, sr)
        best = (best or []) + [x]
    best.sort(key=len); x = best[1]
    path = os.path.join(ROOT, 'audio', f'voice_{lid}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    d = {'text': text, 'dur': round(len(x) / sr, 3)}
    if pre:
        ps = [len(trim(synth(pre)[0], sr)) / sr for _ in range(3)]
        d['key'] = round(float(np.median(ps)), 3)
    info[lid] = d
    print(lid, d)
json.dump(info, open(os.path.join(ROOT, 'audio', 'voice.json'), 'w'), ensure_ascii=False, indent=1)

# ---- уақыт кестесі: әр реплика өз көрінісінің ішінде (0–5, 5–10, 10–16, 16–22 с), сөйлемдер арасында табиғи кідіріс
START = {'l1': 1.0, 'l2': 5.9, 'l3': 10.55}
t = 16.2
for lid, gap in (('l4a', 0.5), ('l4b', 0.45), ('l4c', 0.0)):
    START[lid] = round(t, 3); t += info[lid]['dur'] + gap
timing = {lid: {**info[lid], 'start': START[lid], 'end': round(START[lid] + info[lid]['dur'], 3),
                **({'keyAt': round(START[lid] + info[lid]['key'], 3)} if 'key' in info[lid] else {})} for lid in info}
json.dump(timing, open(os.path.join(ROOT, 'audio', 'timing.json'), 'w'), ensure_ascii=False, indent=1)
for lid, v in timing.items():
    print(f"{lid}: {v['start']:6.2f}–{v['end']:6.2f} с" + (f"  кілт {v['keyAt']:.2f}" if 'keyAt' in v else ''))
print(f"соңғы сөзден кейін кідіріс: {22 - timing['l4c']['end']:.2f} с")
