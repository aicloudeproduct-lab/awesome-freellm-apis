"""Build the film's characters from the MakeHuman hm08 base mesh (CC0).

For each character: macro targets (gender / age / Asian ethnicity / muscle /
weight / height) + individual face/body detail targets → morphed mesh,
skeleton joints, eyes fitted from the high-poly eye proxy, clothing / hair /
shoes / headscarf shells made from body regions, and a baked skin texture
(brows, lips, stubble, blush) via a UV position map.

Writes web-loadable assets to assets/chars/:
  shared.json + shared.bin   topology, UVs, skin weights, expression morphs
  <id>.json + <id>.bin       positions, joints, clothing offsets
  <id>_skin.jpg              baked skin colour
Run: python3 tools/mh/build_chars.py   (MH_DATA or third_party/makehuman/data)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from obj import MH, fit_proxy, load_mhclo, load_obj, load_target  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'chars')
os.makedirs(OUT, exist_ok=True)
S = 0.1  # decimetres → metres
CHARS = json.load(open(os.path.join(ROOT, 'src', 'config', 'characters.json')))

# ------------------------------------------------------------------ base mesh
V0, VT, FACES, FGROUP = load_obj(os.path.join(MH, '3dobjs', 'base.obj'))
NV0 = len(V0)
SKEL = json.load(open(os.path.join(MH, 'rigs', 'default.mhskel')))
WEI = json.load(open(os.path.join(MH, 'rigs', 'default_weights.mhw')))['weights']
BONES = list(SKEL['bones'].keys())
# order bones parents-first
order, seen = [], set()
def visit(b):
    if b in seen:
        return
    p = SKEL['bones'][b]['parent']
    if p:
        visit(p)
    seen.add(b); order.append(b)
for b in BONES:
    visit(b)
BONES = order
BI = {b: i for i, b in enumerate(BONES)}

# per original vertex bone weights (top 4)
vw = [dict() for _ in range(NV0)]
for b, lst in WEI.items():
    for v, w in lst:
        vw[v][b] = vw[v].get(b, 0) + w

LABEL = {}
for b in BONES:
    n = b.split('.')[0]
    if n.startswith('spine') or n.startswith('breast') or n.startswith('clavicle') or n.startswith('shoulder'):
        LABEL[b] = 'torso'
    elif n.startswith('neck'):
        LABEL[b] = 'neck'
    elif n.startswith('upperarm'):
        LABEL[b] = 'uarm'
    elif n.startswith('lowerarm'):
        LABEL[b] = 'farm'
    elif n.startswith('wrist') or n.startswith('metacarpal') or n.startswith('finger'):
        LABEL[b] = 'hand'
    elif n in ('root',) or n.startswith('pelvis'):
        LABEL[b] = 'pelvis'
    elif n.startswith('upperleg'):
        LABEL[b] = 'thigh'
    elif n.startswith('lowerleg'):
        LABEL[b] = 'shin'
    elif n.startswith('foot') or n.startswith('toe'):
        LABEL[b] = 'foot'
    else:
        LABEL[b] = 'head'
lab = {k: np.zeros(NV0) for k in set(LABEL.values())}
for v in range(NV0):
    for b, w in vw[v].items():
        lab[LABEL[b]][v] += w

# ------------------------------------------------------------------ triangulate + split UV seams
corner = {}
SPLIT_SRC, SPLIT_UV = [], []
def cidx(v, t):
    k = (v, t)
    if k not in corner:
        corner[k] = len(SPLIT_SRC)
        SPLIT_SRC.append(v)
        SPLIT_UV.append(VT[t] if t >= 0 else (0.0, 0.0))
    return corner[k]

KEEP = {'body': 'body', 'helper-upper-teeth': 'teeth', 'helper-lower-teeth': 'teeth', 'helper-tongue': 'tongue',
        'helper-l-eyelashes-1': 'lashes', 'helper-l-eyelashes-2': 'lashes', 'helper-r-eyelashes-1': 'lashes', 'helper-r-eyelashes-2': 'lashes',
        'helper-skirt': 'skirt'}
tris = {k: [] for k in set(KEEP.values())}
body_faces = []
for (vs, ts), g in zip(FACES, FGROUP):
    if g not in KEEP:
        continue
    ids = [cidx(v, t) for v, t in zip(vs, ts)]
    for i in range(1, len(ids) - 1):
        tris[KEEP[g]].append((ids[0], ids[i], ids[i + 1]))
    if g == 'body':
        body_faces.append(vs)


ORIG_TRIS = []
for (vs, ts), g in zip(FACES, FGROUP):
    if g in KEEP:
        for i in range(1, len(vs) - 1):
            ORIG_TRIS.append((vs[0], vs[i], vs[i + 1]))


def region_faces(pred):
    out = []
    for vs in body_faces:
        if all(pred(v) for v in vs):
            out.append(vs)
    return out


# landmarks in base space (dm)
def joint(name, P=V0):
    return P[SKEL['joints'][name]].mean(0)


EYE_L = joint('eye.L____head'); EYE_R = joint('eye.R____head')
HEAD_J = joint('head____head')
NECK_J = joint('neck01____head')
mo_i, mo_d = load_target('expression/units/asian/mouth-pursing')
mag = np.linalg.norm(mo_d, axis=1)
lipv = mo_i[mag > mag.max() * 0.35]
MOUTH = V0[lipv].mean(0)
print('landmarks dm: eyeL', EYE_L.round(2), 'mouth', MOUTH.round(2), 'head', HEAD_J.round(2))

# clothing / hair / shoe regions from body faces (character independent)
Y = V0[:, 1]
HAIRLINE = 0.66


def scalp(v):
    # generous: the hairline itself comes from hair_cov (alpha), so the shell
    # region must extend past it everywhere, or its edge shows as a notch
    if lab['head'][v] < 0.5:
        return False
    return hair_cov(V0[v], slack=0.35) > 0


NECK_BASE = NECK_J + np.array([0.0, -0.32, 0.12])


def neckcut(v):
    d = V0[v] - NECK_BASE
    return lab['head'][v] < 0.05 and np.linalg.norm(d * [1.0, 1.15, 1.0]) > 0.62


SH_L = joint('upperarm01.L____head')


def sleeve_short(v):
    # stop sleeves ~ a third down the upper arm
    if lab['uarm'][v] < 0.2:
        return True
    return abs(V0[v, 0]) < abs(SH_L[0]) + 0.95


def bpos(b):
    return sum(V0[a] * w for a, w in b.items())


_ei, _ed = load_target('ears/l-ear-scale-incr')
_fi, _fd = load_target('ears/r-ear-scale-incr')
EAR_V = set(_ei[np.linalg.norm(_ed, axis=1) > 0.002].tolist()) | set(_fi[np.linalg.norm(_fd, axis=1) > 0.002].tolist())
EAR_PTS = V0[list(EAR_V)]


# smooth ellipsoids around each ear (a point-distance field leaves scallops)
EAR_ELL = []
for _ix, _dx in ((_ei, _ed), (_fi, _fd)):
    _m = np.linalg.norm(_dx, axis=1)
    _sel = _m > np.percentile(_m, 75)  # the ear itself moves most under its scale target
    _c = V0[_ix[_sel]].mean(0)
    EAR_ELL.append((_c, np.array([0.3, 0.42, 0.3])))  # dm: a little larger than the pinna


def hair_cov(p, slack=0.0):
    rel_y = p[1] - EYE_L[1]
    # keep ears free: fade out within ~8 mm of any ear vertex
    ear_free = min(smoothstep1(1.0, 1.45, np.linalg.norm((p - c) / r)) for c, r in EAR_ELL)
    front = smoothstep1(EYE_L[2] - 1.45, EYE_L[2] - 0.4, p[2])
    ear = smoothstep1(abs(EYE_L[0]) + 0.25, abs(EYE_L[0]) + 0.45, abs(p[0])) * (1 - front) * smoothstep1(HEAD_J[2] - 0.5, HEAD_J[2] - 0.1, p[2])
    lo = HAIRLINE + 0.05 * (abs(p[0]) / 0.6) ** 2
    lo = lo * front + (1 - front) * (-0.4 * (1 - ear) + 0.12 * ear)
    lo = lo - slack
    return smoothstep1(lo - 0.04, lo + 0.1, rel_y) * (ear_free if slack == 0 else min(1.0, ear_free + 0.5))


def scarf_cov(p):
    """Headscarf coverage: head, neck and a short cape, with a smooth oval
    opening for the face (thresholded at 0.5 in the shader -> clean edge)."""
    rel_y = p[1] - EYE_L[1]
    fz = smoothstep1(EYE_L[2] - 1.25, EYE_L[2] - 0.75, p[2])
    r = np.hypot(p[0] / 0.74, (rel_y + 0.6) / 1.18)
    opening = fz * (1 - smoothstep1(0.94, 1.06, r))
    bottom = smoothstep1(NECK_J[1] - 2.75, NECK_J[1] - 2.5, p[1])  # long shawl over the chest
    return (1 - opening) * bottom


def smoothstep1(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


REG = {
    'top': region_faces(lambda v: neckcut(v) and Y[v] > 0.3 and lab['hand'][v] < 0.1 and lab['thigh'][v] < 0.35 and (lab['torso'][v] + lab['uarm'][v] + lab['farm'][v] + lab['pelvis'][v] + lab['neck'][v]) > 0.6),
    'tee': region_faces(lambda v: neckcut(v) and Y[v] > 0.3 and lab['farm'][v] < 0.02 and lab['hand'][v] < 0.02 and lab['thigh'][v] < 0.35 and (lab['torso'][v] + lab['uarm'][v] + lab['pelvis'][v] + lab['neck'][v]) > 0.6 and sleeve_short(v)),
    'pants': region_faces(lambda v: (lab['pelvis'][v] + lab['thigh'][v] + lab['shin'][v] + lab['torso'][v]) > 0.6 and lab['foot'][v] < 0.25 and Y[v] < 1.7 and Y[v] > -7.75 and lab['uarm'][v] + lab['farm'][v] + lab['hand'][v] < 0.05),
    'shoes': region_faces(lambda v: lab['foot'][v] + lab['shin'][v] * (Y[v] < -7.55) > 0.5),
    'hair': region_faces(scalp),
    'scarf': region_faces(lambda v: (lab['head'][v] > 0.3 or lab['neck'][v] > 0.1 or lab['torso'][v] > 0.3 or lab['uarm'][v] > 0.1) and lab['hand'][v] < 0.05 and lab['farm'][v] < 0.2 and Y[v] > NECK_J[1] - 3.0),
}
for k, v in REG.items():
    print(f'region {k}: {len(v)} faces')


def boundary_loops(faces):
    from collections import Counter, defaultdict
    ec = Counter()
    for vs in faces:
        for i in range(len(vs)):
            ec[tuple(sorted((vs[i], vs[(i + 1) % len(vs)])))] += 1
    adj = defaultdict(list)
    for (a, b), n in ec.items():
        if n == 1:
            adj[a].append(b); adj[b].append(a)
    seen, loops = set(), []
    for start in list(adj):
        if start in seen:
            continue
        loop, cur, prev = [start], start, None
        seen.add(start)
        while True:
            nxt = [x for x in adj[cur] if x != prev and x not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            seen.add(cur); loop.append(cur)
        if len(loop) >= 6:
            loops.append(loop)
    return loops


RING_LOOPS = {k: boundary_loops(REG[k]) for k in ('top', 'tee', 'pants')}
for k, ls in RING_LOOPS.items():
    print('loops', k, [len(l) for l in ls])


def interior(faces, rings=2):
    from collections import Counter
    ec = Counter()
    for vs in faces:
        for i in range(len(vs)):
            ec[tuple(sorted((vs[i], vs[(i + 1) % len(vs)])))] += 1
    edge_v = set()
    for (a, b), n in ec.items():
        if n == 1:
            edge_v.update((a, b))
    keep = set(map(tuple, faces))
    for _ in range(rings):
        nxt = set(edge_v)
        for vs in faces:
            if any(v in edge_v for v in vs):
                nxt.update(vs)
        edge_v = nxt
    return {tuple(vs) for vs in faces if not any(v in edge_v for v in vs)}


UNDER = {}
UNDER['b_feet'] = interior(REG['shoes'], 2)
UNDER['b_legs'] = interior(REG['pants'], 2) - UNDER['b_feet']
# where the top hem overlaps the waistband no body may show: hide the whole overlap
UNDER['b_legs'] |= set(map(tuple, REG['pants'])) & set(map(tuple, REG['top']))
UNDER['b_tee'] = interior(REG['tee'], 2) - UNDER['b_legs']
UNDER['b_sleeves'] = interior(REG['top'], 2) - UNDER['b_tee'] - UNDER['b_legs']
for k, v in UNDER.items():
    print(f'hidden-under {k}: {len(v)} faces')

# duplicate vertices for each region (offset later per character). Hair and
# scarf are subdivided twice: every split vertex is a blend of ≤4 sources.
SRCS = [[v, v, v, v] for v in SPLIT_SRC]
SRCW = [[1.0, 0.0, 0.0, 0.0] for _ in SPLIT_SRC]
SUBDIV = {'hair': 2, 'scarf': 2, 'shoes': 0}
SMOOTH_IT = {'hair': 3, 'scarf': 6, 'shoes': 60}
CLOTH_SMOOTH = {}  # (shell smoothing exposed the body at the seams; kept off)
REG_RANGE = {}
REG_SMOOTH = {}
REG_VID = {}
for k, faces in REG.items():
    start = len(SRCS)
    # vertices as blends: key → (sources dict)
    verts = {}
    def vid(blend):
        key = tuple(sorted((a, round(w, 4)) for a, w in blend.items()))
        if key not in verts:
            verts[key] = (len(SRCS), blend)
            items = sorted(blend.items(), key=lambda kv: -kv[1])[:4]
            tot = sum(w for _, w in items)
            SRCS.append([a for a, _ in items] + [items[0][0]] * (4 - len(items)))
            SRCW.append([w / tot for _, w in items] + [0.0] * (4 - len(items)))
            SPLIT_UV.append((0.0, 0.0))
        return verts[key][0]
    quads = [[{v: 1.0} for v in vs] for vs in faces]
    for _ in range(SUBDIV.get(k, 0)):
        nq = []
        for q in quads:
            n = len(q)
            mix = lambda bs: {a: sum(b.get(a, 0) for b in bs) / len(bs) for b in bs for a in b}
            c = mix(q)
            mids = [mix([q[i], q[(i + 1) % n]]) for i in range(n)]
            for i in range(n):
                nq.append([q[i], mids[i], c, mids[i - 1]])
        quads = nq
    if k == 'hair':
        quads = [q for q in quads if max(hair_cov(bpos(b)) for b in q) > 0.03]
    if k == 'scarf':
        quads = [q for q in quads if max(scarf_cov(bpos(b)) for b in q) > 0.02]
    for q in quads:
        ids = [vid(b) for b in q]
        for i in range(1, len(ids) - 1):
            tris.setdefault(k, []).append((ids[0], ids[i], ids[i + 1]))
    REG_RANGE[k] = (start, len(SRCS))
    REG_VID[k] = {next(iter(bl)): i for i, bl in verts.values() if len(bl) == 1}
    if k in SMOOTH_IT or k in CLOTH_SMOOTH:
        # neighbour lists for Laplacian smoothing
        nb = {}
        for a, b, c2 in tris[k]:
            for x, y in ((a, b), (b, c2), (c2, a)):
                nb.setdefault(x, set()).add(y); nb.setdefault(y, set()).add(x)
        REG_SMOOTH[k] = nb

# re-split body triangles by partition
part_of = {}
for k, fs in UNDER.items():
    for f in fs:
        part_of.setdefault(f, k)
body_tris = {'body': []}
for k in UNDER:
    body_tris[k] = []
for (vs, ts), g in zip(FACES, FGROUP):
    if g != 'body':
        continue
    key = part_of.get(tuple(vs), 'body')
    ids = [corner[(v, t)] for v, t in zip(vs, ts)]
    for i in range(1, len(ids) - 1):
        body_tris[key].append((ids[0], ids[i], ids[i + 1]))
tris.update(body_tris)

SRCS = np.array(SRCS, np.int64)
SRCW = np.array(SRCW, np.float64)
SRC = SRCS[:, 0]
NVS = len(SRCS)
def blend(arr):
    """Per-split-vertex value from original-vertex array (N0, ...)."""
    out = arr[SRCS[:, 0]] * SRCW[:, 0].reshape((-1,) + (1,) * (arr.ndim - 1))
    for j in range(1, 4):
        out = out + arr[SRCS[:, j]] * SRCW[:, j].reshape((-1,) + (1,) * (arr.ndim - 1))
    return out
# clothing UVs: planar-ish (x,y) for cloth weave tiling, metres
UV = np.array(SPLIT_UV, np.float32)
for k, (a, b) in REG_RANGE.items():
    p = blend(V0)[a:b] * S
    UV[a:b, 0] = p[:, 0] * 2.0 + p[:, 2] * 2.0
    UV[a:b, 1] = p[:, 1] * 2.0
print('split vertices', NVS)

# eyes proxy
EYE_SCALES, EYE_REFS = load_mhclo(os.path.join(MH, 'eyes', 'high-poly', 'high-poly.mhclo'))
EV, EVT, EF, _ = load_obj(os.path.join(MH, 'eyes', 'high-poly', 'high-poly.obj'))
eye_corner, eye_src, eye_uv, eye_tris = {}, [], [], []
for vs, ts in EF:
    ids = []
    for v, t in zip(vs, ts):
        k = (v, t)
        if k not in eye_corner:
            eye_corner[k] = len(eye_src); eye_src.append(v); eye_uv.append(EVT[t])
        ids.append(eye_corner[k])
    for i in range(1, len(ids) - 1):
        eye_tris.append((ids[0], ids[i], ids[i + 1]))
eye_src = np.array(eye_src)
# eye skinning: left/right by x of the fitted base proxy
# ------------------------------------------------------------------ skin weights (split)
skin_idx = np.zeros((NVS, 4), np.uint16)
skin_w = np.zeros((NVS, 4), np.float32)
for i in range(NVS):
    acc = {}
    for j in range(4):
        w = SRCW[i, j]
        if w <= 0:
            continue
        for b, bw in vw[SRCS[i, j]].items():
            acc[b] = acc.get(b, 0) + bw * w
    items = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
    tot = sum(w for _, w in items) or 1
    for j, (b, w) in enumerate(items):
        skin_idx[i, j] = BI[b]; skin_w[i, j] = w / tot

# ------------------------------------------------------------------ expression morphs (symmetric)
EXPR = {
    'blink': ['eye-left-closure', 'eye-right-closure'],
    'squint': ['eye-left-slit', 'eye-right-slit'],
    'wide': ['eye-left-opened-up', 'eye-right-opened-up'],
    'browDown': ['eyebrows-left-down', 'eyebrows-right-down'],
    'browInner': ['eyebrows-left-inner-up', 'eyebrows-right-inner-up'],
    'browUp': ['eyebrows-left-up', 'eyebrows-right-up'],
    'jaw': ['mouth-open'],
    'press': ['mouth-compression'],
    'smile': ['mouth-corner-puller'],
    'frown': ['mouth-depression'],
    'pucker': ['mouth-pursing'],
    'protrude': ['mouth-protusion'],
    'wideLips': ['mouth-retraction'],
    'upperUp': ['mouth-upward-retraction'],
    'lowerDown': ['mouth-depression-retraction'],
    'nose': ['nose-left-elevation', 'nose-right-elevation'],
}
EXPR_KEYS = list(EXPR)
morph = np.zeros((len(EXPR_KEYS), NV0, 3), np.float32)
for k, key in enumerate(EXPR_KEYS):
    for name in EXPR[key]:
        i, d = load_target('expression/units/asian/' + name)
        morph[k, i] += d * S
# regions (clothes/hair) don't follow face morphs except the scarf/hair slightly
reg_mask = np.ones(NVS, np.float32)
for k, (a, b) in REG_RANGE.items():
    reg_mask[a:b] = 0.0 if k not in ('hair', 'scarf') else 0.6

# ------------------------------------------------------------------ macro modifiers
def age_vals(a):
    if a < 0.5:
        baby = max(0.0, 1 - a * 5.333)
        young = max(0.0, (a - 0.1875) * 3.2)
        child = max(0.0, min(1.0, 5.333 * a) - young)
        return {'baby': baby, 'child': child, 'young': young, 'old': 0.0}
    old = max(0.0, a * 2 - 1)
    return {'baby': 0, 'child': 0, 'young': 1 - old, 'old': old}

def tri(x, lo, mid, hi):
    if x < 0.5:
        return {lo: max(0, 1 - x * 2), mid: 1 - max(0, 1 - x * 2), hi: 0}
    return {lo: 0, mid: 1 - (x * 2 - 1), hi: x * 2 - 1}

def years_to_age(y):
    if y < 11:
        return (y - 1) / 10 * 0.1875
    if y < 25:
        return 0.1875 + (y - 11) / 14 * 0.3125
    return 0.5 + (y - 25) / 65 * 0.5

def morph_char(c):
    P = V0.copy()
    g = c['gender']
    G = {'female': 1 - g, 'male': g}
    A = age_vals(years_to_age(c['years']))
    Mu = tri(c.get('muscle', 0.5), 'minmuscle', 'averagemuscle', 'maxmuscle')
    W = tri(c.get('weight', 0.5), 'minweight', 'averageweight', 'maxweight')
    Hh = c.get('height', 0.5)
    Hw = {'minheight': max(0, 1 - 2 * Hh), 'maxheight': max(0, 2 * Hh - 1)}
    race = c.get('race', {'asian': 0.85, 'caucasian': 0.15})
    def add(rel, w):
        if w < 1e-4:
            return
        i, d = load_target(rel)
        if len(i):
            P[i] += d * w
    for gn, gw in G.items():
        for an, aw in A.items():
            if gw * aw < 1e-4:
                continue
            for rn, rw in race.items():
                add(f'macrodetails/{rn}-{gn}-{an}', gw * aw * rw)
            for mn, mw in Mu.items():
                for wn, ww in W.items():
                    add(f'macrodetails/universal-{gn}-{an}-{mn}-{wn}', gw * aw * mw * ww)
                    for hn, hw in Hw.items():
                        add(f'macrodetails/height/{gn}-{an}-{mn}-{wn}-{hn}', gw * aw * mw * ww * hw)
    for rel, w in c.get('details', {}).items():
        add(rel, w)
    return P


def vnormals(P, tlist):
    n = np.zeros_like(P)
    t = np.array(tlist)
    a, b, cc = P[t[:, 0]], P[t[:, 1]], P[t[:, 2]]
    fn = np.cross(b - a, cc - a)
    for k in range(3):
        np.add.at(n, t[:, k], fn)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    return n


# ------------------------------------------------------------------ UV position map for baking
TEX = 2048
def raster_posmap():
    pm = np.zeros((TEX, TEX, 3), np.float32)
    mask = np.zeros((TEX, TEX), bool)
    lipm = np.zeros((TEX, TEX), np.float32)
    lipval = np.zeros(NV0, np.float32)
    lipval[mo_i] = np.clip(mag / mag.max(), 0, 1)
    for (vs, ts), g in zip(FACES, FGROUP):
        if g != 'body':
            continue
        for i in range(1, len(vs) - 1):
            tri_v = [vs[0], vs[i], vs[i + 1]]
            tri_t = [ts[0], ts[i], ts[i + 1]]
            uv = VT[tri_t] * [TEX, TEX]
            uv[:, 1] = TEX - uv[:, 1]
            x0, y0 = np.floor(uv.min(0)).astype(int)
            x1, y1 = np.ceil(uv.max(0)).astype(int)
            x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, TEX - 1), min(y1, TEX - 1)
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = uv
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
            l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
            l3 = 1 - l1 - l2
            inside = (l1 >= -0.01) & (l2 >= -0.01) & (l3 >= -0.01)
            if not inside.any():
                continue
            P3 = V0[tri_v]
            pos = l1[..., None] * P3[0] + l2[..., None] * P3[1] + l3[..., None] * P3[2]
            lv = l1 * lipval[tri_v[0]] + l2 * lipval[tri_v[1]] + l3 * lipval[tri_v[2]]
            yy, xx = (ys[inside] - 0.5).astype(int), (xs[inside] - 0.5).astype(int)
            pm[yy, xx] = pos[inside]
            lipm[yy, xx] = lv[inside]
            mask[yy, xx] = True
    return pm, mask, lipm


def dilate(img, mask, it=6):
    img = img.copy(); m = mask.copy()
    for _ in range(it):
        acc = np.zeros_like(img); cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(img, dy, 0), dx, 1); sm = np.roll(np.roll(m, dy, 0), dx, 1)
            acc[sm & ~m] += sh[sm & ~m]; cnt[sm & ~m] += 1
        new = (cnt > 0) & ~m
        img[new] = acc[new] / cnt[new][..., None] if img.ndim == 3 else acc[new] / cnt[new]
        m |= new
    return img


def vnoise3(p, scale, seed):
    """Cheap value-noise-ish field from sines (deterministic)."""
    r = np.random.default_rng(seed)
    out = np.zeros(p.shape[:-1], np.float32)
    for _ in range(4):
        k = r.normal(size=3) * scale; ph = r.uniform(0, 6.28)
        out += np.sin(p @ k + ph)
    return out / 4


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def bake_skin(c, pm, mask, lipm):
    base = np.frombuffer(bytes.fromhex(c['skin'][1:]), np.uint8).astype(np.float32) / 255
    p = pm  # dm, base space
    col = np.ones((TEX, TEX, 3), np.float32) * base
    n1 = vnoise3(p, 3.0, 1); n2 = vnoise3(p, 14.0, 2)
    col *= (1 + 0.035 * n1[..., None] + 0.015 * n2[..., None])
    rel = p - MOUTH
    front = smoothstep(EYE_L[2] - 1.4, EYE_L[2] - 0.4, p[..., 2])
    head = smoothstep(NECK_J[1] + 0.3, NECK_J[1] + 1.0, p[..., 1])
    # cheeks blush
    for ex in (EYE_L[0], EYE_R[0]):
        d = np.sqrt(((p[..., 0] - ex * 1.05) / 0.55) ** 2 + ((p[..., 1] - (EYE_L[1] - 0.75)) / 0.45) ** 2)
        col = col * (1 - c.get('blush', 0.12) * np.exp(-d * d)[..., None] * front[..., None]) + np.array([0.82, 0.45, 0.4]) * (c.get('blush', 0.12) * np.exp(-d * d) * front)[..., None]
    # lips
    lip = np.frombuffer(bytes.fromhex(c['lip'][1:]), np.uint8).astype(np.float32) / 255
    ex = (p[..., 0] - MOUTH[0]) / 0.27
    ey = (p[..., 1] - MOUTH[1]) / np.where(p[..., 1] > MOUTH[1], 0.085, 0.1)
    ell = 1 - smoothstep(0.75, 1.05, np.sqrt(ex * ex + ey * ey))
    lm = (np.clip(smoothstep(0.35, 0.7, lipm) * ell, 0, 1) * front)[..., None]
    col = col * (1 - lm) + lip * lm
    # eye area slightly darker / warmer (lids)
    for ex in (EYE_L[0], EYE_R[0]):
        d = np.sqrt(((p[..., 0] - ex) / 0.42) ** 2 + ((p[..., 1] - EYE_L[1]) / 0.22) ** 2)
        k = 0.12 * np.exp(-d * d) * front
        col *= (1 - k[..., None] * np.array([0.5, 0.7, 0.75]))
    # eyebrows: hair strokes in a band above each eye
    hair = np.frombuffer(bytes.fromhex(c['brow'][1:]), np.uint8).astype(np.float32) / 255
    for sgn, ex in ((1, EYE_L[0]), (-1, EYE_R[0])):
        u = (p[..., 0] - ex) * sgn  # outward positive
        arch = EYE_L[1] + 0.17 + c.get('browLift', 0) + 0.035 * np.cos(np.clip(u / 0.24, -1.5, 1.5)) - 0.03 * np.clip(u / 0.25, 0, 2) ** 2
        th = c.get('browThick', 1.0) * (0.05 - 0.022 * np.clip((u + 0.05) / 0.35, 0, 1))
        band = np.exp(-((p[..., 1] - arch) / th) ** 2) * smoothstep(-0.25, -0.17, u) * (1 - smoothstep(0.26, 0.36, u))
        strokes = 0.9 + 0.1 * vnoise3(p, 300.0, 7)
        k = np.clip(band * strokes * 1.25, 0, 0.9) * front * head
        col = col * (1 - k[..., None]) + hair * k[..., None]
    # stubble / beard shadow
    st = c.get('stubble', 0)
    if st > 0:
        sh = np.frombuffer(bytes.fromhex(c.get('stubbleColor', '#2f2622')[1:]), np.uint8).astype(np.float32) / 255
        jaw = smoothstep(MOUTH[1] + 0.25, MOUTH[1] - 0.25, p[..., 1]) * (1 - smoothstep(MOUTH[1] - 1.55, MOUTH[1] - 2.2, p[..., 1]))
        upper = np.exp(-((p[..., 1] - (MOUTH[1] + 0.22)) / 0.12) ** 2) * np.exp(-((p[..., 0]) / 0.42) ** 2)
        cheekcut = 1 - smoothstep(MOUTH[1] - 0.1, MOUTH[1] + 0.35, p[..., 1]) * smoothstep(0.55, 0.75, np.abs(p[..., 0]))
        area = np.clip(jaw * cheekcut + upper, 0, 1) * (1 - smoothstep(0.3, 0.55, lipm))
        grain = 0.82 + 0.18 * np.clip(vnoise3(p, 400.0, 9) * 2, -1, 1)
        k = st * area * grain * 0.42
        col = col * (1 - k[..., None]) + sh * k[..., None]
    col = dilate(np.clip(col, 0, 1), mask, 8)
    Image.fromarray((col * 255).astype(np.uint8)).save(os.path.join(OUT, f"{c['id']}_skin.jpg"), quality=92)


# ------------------------------------------------------------------ hair styles (thickness in dm)
def hair_offset(style, p_dm):
    rel = p_dm - HEAD_J
    top = np.clip((p_dm[:, 1] - EYE_L[1]) / 1.6, 0, 1)
    side = np.abs(p_dm[:, 0]) / 1.0
    back = np.clip(-(p_dm[:, 2] - HEAD_J[2]) / 1.0, 0, 1)
    if style == 'part':
        return 0.06 + 0.13 * top + 0.04 * np.clip((p_dm[:, 0] + 0.2) / 0.8, 0, 1) * top - 0.03 * side * (1 - top)
    if style == 'short':
        return 0.05 + 0.08 * top - 0.02 * side
    if style == 'curly':
        return 0.07 + 0.16 * top + 0.03 * np.sin(p_dm[:, 0] * 23) * np.sin(p_dm[:, 2] * 19) * top
    if style == 'kid':
        return 0.06 + 0.1 * top + 0.03 * back
    if style == 'scarf':
        drape = np.clip((NECK_J[1] + 0.9 - p_dm[:, 1]) / 1.2, 0, 1)
        return 0.16 + 0.06 * (1 - top) + 0.32 * drape + 0.04 * np.sin(p_dm[:, 0] * 9 + p_dm[:, 1] * 4) * drape
    return 0.08


def main():
    pm, mask, lipm = raster_posmap()
    print('pos map', mask.mean().round(3))
    # ---- shared
    tri_groups = {}
    idx_all = [np.array(tl, np.uint32).reshape(-1) for tl in tris.values()]
    off = 0
    for k, arr in zip(tris.keys(), idx_all):
        tri_groups[k] = [off, len(arr)]
        off += len(arr)
    index = np.concatenate(idx_all)
    morph_split = np.stack([blend(morph[k]) for k in range(len(EXPR_KEYS))]) * reg_mask[None, :, None]
    eye_idx = np.array(eye_tris, np.uint32).reshape(-1)
    alpha = np.ones(NVS, np.float32)
    a0, a1 = REG_RANGE['hair']
    bpv = blend(V0)[a0:a1]
    alpha[a0:a1] = [min(1.0, hair_cov(q) * 1.6) for q in bpv]
    a0, a1 = REG_RANGE['scarf']
    alpha[a0:a1] = [scarf_cov(q) for q in blend(V0)[a0:a1]]
    blobs = [('uv', UV.astype(np.float32)), ('index', index.astype(np.uint32)), ('skinIndex', skin_idx), ('skinWeight', skin_w),
             ('morph', morph_split.astype(np.float32)), ('eyeUV', np.array(eye_uv, np.float32)), ('eyeIndex', eye_idx), ('alpha', alpha)]
    meta = {'vertexCount': int(NVS), 'groups': tri_groups, 'regions': {k: list(map(int, v)) for k, v in REG_RANGE.items()},
            'bones': [{'name': b, 'parent': SKEL['bones'][b]['parent']} for b in BONES], 'expr': EXPR_KEYS,
            'eyeVertexCount': int(len(eye_src)), 'buffers': {}}
    with open(os.path.join(OUT, 'shared.bin'), 'wb') as f:
        pos = 0
        for name, arr in blobs:
            b = arr.tobytes()
            meta['buffers'][name] = {'offset': pos, 'length': len(b), 'dtype': str(arr.dtype), 'shape': list(arr.shape)}
            f.write(b); pos += len(b)
    json.dump(meta, open(os.path.join(OUT, 'shared.json'), 'w'))
    # ---- characters
    for c in CHARS:
        P = morph_char(c)
        Pm = P * S
        foot = Pm[[i for i in range(NV0) if lab['foot'][i] > 0.5], 1].min()
        Pm[:, 1] -= foot
        Pm[:, 1] += 0.012  # sole thickness
        pos = blend(Pm).astype(np.float32)
        for tg in ('teeth',):
            ids = np.unique(np.array(tris[tg]).reshape(-1))
            pos[ids, 2] -= 0.0025
            pos[ids, 1] += 0.0006
        n0 = vnormals(Pm, ORIG_TRIS)
        nrm_all = blend(n0).astype(np.float32)
        nrm_all /= np.linalg.norm(nrm_all, axis=1, keepdims=True) + 1e-9
        for k, (a, b) in REG_RANGE.items():
            if k in SMOOTH_IT:
                nb = REG_SMOOTH[k]
                for _ in range(SMOOTH_IT[k]):
                    newp = pos.copy()
                    for v, ns in nb.items():
                        if len(ns) >= 4:
                            newp[v] = pos[v] * 0.5 + pos[list(ns)].mean(0) * 0.5
                    pos = newp
            nrm = nrm_all[a:b]
            if k == 'hair':
                bp = blend(V0)[a:b]
                cov = np.array([hair_cov(q) for q in bp])
                th = np.maximum(hair_offset(c.get('hair', 'short'), blend(P)[a:b]) * S * (0.15 + 0.85 * cov), 0.0014)  # stays clear of the skin (no z-fighting in the fade)
            elif k == 'scarf':
                th = hair_offset('scarf', blend(P)[a:b]) * S
            else:
                th = np.full(b - a, c.get('thick', {}).get(k, {'top': 0.009, 'tee': 0.0078, 'pants': 0.0055, 'shoes': 0.011}.get(k, 0.006)))
            pos[a:b] = pos[a:b] + nrm * th[:, None]
            if k in CLOTH_SMOOTH:
                nb = REG_SMOOTH[k]
                vs = [v for v, ns in nb.items() if len(ns) >= 4]
                nl = [list(nb[v]) for v in vs]
                # reference surface = the body with its small detail (nipples, ribs) smoothed away
                body_all = pos.copy(); body_all[a:b] = blend(Pm)[a:b]
                for _ in range(CLOTH_SMOOTH[k]):
                    nbody = body_all.copy()
                    for v, ns in zip(vs, nl):
                        nbody[v] = body_all[v] * 0.5 + body_all[ns].mean(0) * 0.5
                    body_all = nbody
                body = body_all[a:b]
                for _ in range(CLOTH_SMOOTH[k]):
                    newp = pos.copy()
                    for v, ns in zip(vs, nl):
                        newp[v] = pos[v] * 0.5 + pos[ns].mean(0) * 0.5
                    pos = newp
                    # never sink into the body: keep ≥ 60 % of the offset along the normal
                    d = np.einsum('ij,ij->i', pos[a:b] - body, nrm)
                    lack = np.maximum(0.0, 0.6 * th - d)
                    pos[a:b] = pos[a:b] + nrm * lack[:, None]
            if k == 'shoes':
                pos[a:b, 1] = np.maximum(pos[a:b, 1], 0.004)
        joints = {}
        for b in BONES:
            jb = SKEL['bones'][b]
            h = Pm[SKEL['joints'][jb['head']]].mean(0); t = Pm[SKEL['joints'][jb['tail']]].mean(0)
            joints[b] = [h.round(5).tolist(), t.round(5).tolist()]
        eyes = fit_proxy(P, EYE_SCALES, EYE_REFS) * S
        eyes[:, 1] -= foot - 0.012
        eye_pos = eyes[eye_src].astype(np.float32)
        rings = []
        for k, ls in RING_LOOPS.items():
            for lp in ls:
                # straighten the stair-stepped garment edge: smooth the loop
                # (closed Laplacian, radius preserved) and snap the shell to it
                ids = [REG_VID[k][v] for v in lp]
                q = pos[ids].astype(np.float64)
                c0 = q.mean(0); r0 = np.linalg.norm(q - c0, axis=1).mean()
                for _ in range(40):
                    q = 0.5 * q + 0.25 * (np.roll(q, 1, 0) + np.roll(q, -1, 0))
                c1 = q.mean(0); q = c1 + (q - c1) * (r0 / (np.linalg.norm(q - c1, axis=1).mean() + 1e-9))
                pos[ids] = q
                step = max(1, len(q) // 48)
                pts = Pm[lp]
                cen = pts.mean(0)
                u, sv, vt = np.linalg.svd(pts - cen)
                nrm = vt[2]
                rad = float(np.linalg.norm((pts - cen) - np.outer((pts - cen) @ nrm, nrm), axis=1).mean())
                votes = {}
                for v in lp:
                    b = max(vw[v].items(), key=lambda kv: kv[1])[0]
                    votes[b] = votes.get(b, 0) + 1
                bone = max(votes.items(), key=lambda kv: kv[1])[0]
                rings.append({'region': k, 'center': cen.round(5).tolist(), 'normal': nrm.round(5).tolist(), 'radius': round(rad, 5), 'bone': bone, 'n': len(lp), 'pts': q[::step].round(5).tolist()})
        lm = {'eyeL': (joint('eye.L____head', Pm)).tolist(), 'eyeR': (joint('eye.R____head', Pm)).tolist(),
              'mouth': (Pm[lipv].mean(0)).tolist(), 'height': float(Pm[:, 1].max())}
        with open(os.path.join(OUT, f"{c['id']}.bin"), 'wb') as f:
            f.write(pos.tobytes()); f.write(nrm_all.tobytes()); f.write(eye_pos.tobytes())
        scale = np.linalg.norm(np.array(lm['eyeL']) - np.array(lm['eyeR'])) / (np.linalg.norm(EYE_L - EYE_R) * S)
        json.dump({'id': c['id'], 'joints': joints, 'rings': rings, 'landmarks': lm, 'faceScale': float(scale), 'spec': c}, open(os.path.join(OUT, f"{c['id']}.json"), 'w'))
        bake_skin(c, pm, mask, lipm)
        print(f"{c['id']}: height {lm['height']:.3f} m, face scale {scale:.2f}")
    import shutil
    shutil.copy(os.path.join(MH, 'eyes', 'materials', 'brown_eye.png'), os.path.join(OUT, 'eye_brown.png'))


if __name__ == '__main__':
    main()
