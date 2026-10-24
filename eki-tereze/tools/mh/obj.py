"""Minimal OBJ / target / mhclo readers for the MakeHuman hm08 base mesh."""
import gzip, os
import numpy as np

MH = os.environ.get('MH_DATA') or os.path.join(os.path.dirname(__file__), '..', '..', 'third_party', 'makehuman', 'data')


def load_obj(path):
    V, VT, faces, groups = [], [], [], []
    g = 'default'
    with open(path) as f:
        for line in f:
            if line.startswith('v '):
                V.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('vt '):
                VT.append([float(x) for x in line.split()[1:3]])
            elif line.startswith('g '):
                g = line.split()[1]
            elif line.startswith('f '):
                vs, ts = [], []
                for tok in line.split()[1:]:
                    p = tok.split('/')
                    vs.append(int(p[0]) - 1)
                    ts.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
                faces.append((vs, ts))
                groups.append(g)
    return np.array(V, np.float64), np.array(VT, np.float64), faces, groups


_tcache = {}
def load_target(rel):
    if rel in _tcache:
        return _tcache[rel]
    path = os.path.join(MH, 'targets', rel + '.target')
    idx, d = [], []
    with open(path) as f:
        for line in f:
            if not line.strip() or line[0] == '#':
                continue
            p = line.split()
            idx.append(int(p[0])); d.append([float(p[1]), float(p[2]), float(p[3])])
    r = (np.array(idx, np.int64), np.array(d, np.float64))
    _tcache[rel] = r
    return r


def load_mhclo(path):
    scales, refs = {}, []
    with open(path) as f:
        mode = None
        for line in f:
            t = line.split()
            if not t or t[0].startswith('#'):
                continue
            if t[0] in ('x_scale', 'y_scale', 'z_scale'):
                scales[t[0][0]] = (int(t[1]), int(t[2]), float(t[3]))
            elif t[0] == 'verts':
                mode = 'v'
            elif mode == 'v':
                if len(t) == 9:
                    refs.append(([int(t[0]), int(t[1]), int(t[2])], [float(t[3]), float(t[4]), float(t[5])], [float(t[6]), float(t[7]), float(t[8])]))
                elif len(t) == 1:
                    refs.append(([int(t[0])] * 3, [1, 0, 0], [0, 0, 0]))
    return scales, refs


def fit_proxy(base_pos, scales, refs):
    s = []
    for ax, k in (('x', 0), ('y', 1), ('z', 2)):
        a, b, dist = scales[ax]
        s.append(abs(base_pos[a, k] - base_pos[b, k]) / dist)
    s = np.array(s)
    out = np.zeros((len(refs), 3))
    for i, (vi, w, d) in enumerate(refs):
        out[i] = w[0] * base_pos[vi[0]] + w[1] * base_pos[vi[1]] + w[2] * base_pos[vi[2]] + np.array(d) * s
    return out
