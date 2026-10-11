import json
import math
from pathlib import Path

import flight as f
import numpy as np
from scipy.optimize import brentq

here = Path(__file__).resolve().parent
w = json.loads((here / "witness.json").read_text())
f.PHASE = w["moonPhase"]
z = np.array(w["initial"])
t = 0.3
f.arcs = w["arcs"][:4]
for a in f.arcs:
    if t < a["start"]:
        z = f.integrate(z, t, a["start"], tight=True)
    z = f.integrate(z, a["start"], a["end"], a["angles"], tight=True)
    t = a["end"]
f.phases = w["phases"][:3]
f.phases[-1]["state"] = z.tolist()
period = 2 * math.pi * math.sqrt(0.35**3 / 0.03)
t2 = t + period
z = f.integrate(z, t, t2, tight=True)
t = t2
f.stage("Descent departure", t, z)
start = z.copy()
m = f.moon(t)
a = math.atan2(z[1] - m[1], z[0] - m[0])
FORCE = 4.8


def pad(at, phase):
    m = f.moon(at)
    b = phase + f.RATE * at
    p = (f.MR + 1e-5) * np.array([math.cos(b), math.sin(b)])
    return np.r_[m[:2] + p, m[2:] + f.RATE * np.array([-p[1], p[0]])]


def land(x, tight=False):
    duration = x[-2]
    phase = x[-1]
    keys = np.r_[x[:-2], phase + f.RATE * (t + duration)]
    y = f.integrate(start, t, t + duration, keys, tight=tight, force=FORCE)
    return y, np.r_[(y[:4] - pad(t + duration, phase)) * 100, min(0, f.LASTMIN - 1e-6) * 100]


seed = np.r_[np.linspace(a - math.pi / 2, a + 0.6, 5), 1.3, a + 0.3 - f.RATE * (t + 1.3)]
lo = np.r_[seed[:-2] - 1.0, 0.4, seed[-1] - 2.5]
hi = np.r_[seed[:-2] + 1.0, 2.5, seed[-1] + 2.5]

seed = np.array(
    [-1.05553873, -0.33931096, 0.20067382, 1.60886539, 2.19788684, 1.22921829, -2.62542493]
)
x = f.fit(lambda x: np.r_[land(x)[1], 1e-5 * np.diff(x[:-2])], seed, (lo, hi), n=200)
z, res = land(x, True)
print("clearance", f.LASTMIN, "residual", res, flush=True)
assert f.LASTMIN > 0
d = x[-2]
pad_phase = x[-1]
f.arc("lunar-descent", t, d, np.r_[x[:-2], pad_phase + f.RATE * (t + d)])
f.arcs[-1]["throttle"] = 0.2
t += d
landing = t
f.stage("Lunar landing", t, z)
t += 2
z = np.r_[pad(t, pad_phase), z[4]]
f.stage("Lunar liftoff", t, z)
liftoff = t
start = z.copy()
a = pad_phase + f.RATE * t


def up(x, tight=False):
    duration = x[-1]
    y = f.integrate(start, t, t + duration, x[:-1], tight=tight, force=FORCE)
    m = f.moon(t + duration)
    p = y[:2] - m[:2]
    v = y[2:4] - m[2:]
    r = np.linalg.norm(p)
    return y, np.r_[
        (r - 0.35) * 100,
        np.dot(p, v) / r * 100,
        (p[0] * v[1] - p[1] * v[0]) / r * 100 - math.sqrt(0.03 / 0.35) * 100,
        0,
        min(0, f.LASTMIN - 1e-6) * 100,
    ]


seed = np.r_[a + np.array([0, 0.1, 0.3, 1, 2.2, 3.2]), 1.35]
x = f.fit(
    lambda x: np.r_[up(x)[1], 1e-5 * np.diff(x[:-1])],
    seed,
    (
        np.r_[seed[:-1] - np.array([0.12, 0.8, 0.8, 0.8, 0.8, 0.8]), 0.5],
        np.r_[seed[:-1] + np.array([0.12, 0.8, 0.8, 0.8, 0.8, 0.8]), 2.5],
    ),
    n=200,
)
z, res = up(x, True)
assert f.LASTMIN > 0
f.arc("lunar-ascent", t, x[-1], x[:-1])
f.arcs[-1]["throttle"] = 0.2
t += x[-1]
f.stage("Return parking orbit", t, z)
t2 = t + period * 1.35
z = f.integrate(z, t, t2, tight=True)
t = t2
f.stage("Transearth departure", t, z)
start = z.copy()
transfer_time = math.pi * ((1.4 + 5 - 0.35) / 2) ** 1.5


# Destination phase is free, so the return need not chase an arbitrary depot.
def back(x, tight=False):
    d0, d1 = x[-3:-1]
    duration = x[-1]
    end = t + duration
    y = f.integrate(start, t, t + d0, x[:2], tight=tight)
    minimum = f.LASTMIN
    y = f.integrate(y, t + d0, end - d1, tight=tight)
    minimum = min(minimum, f.LASTMIN)
    y = f.integrate(y, end - d1, end, x[2:4], tight=tight)
    minimum = min(minimum, f.LASTMIN)
    r = np.linalg.norm(y[:2])
    v = y[2:4]
    return y, np.array(
        [
            r - 1.4,
            np.dot(y[:2], v) / r,
            (y[0] * v[1] - y[1] * v[0]) / r - 1 / math.sqrt(1.4),
            0,
            min(0, minimum - 1e-4),
        ]
    )


m = f.moon(t)
a = math.atan2(m[3], m[2]) + math.pi
seed = np.r_[a, a, a + math.pi, a + math.pi, 0.055, 0.08, transfer_time]
x = f.fit(
    lambda x: np.r_[back(x)[1] * 100, 1e-5 * np.diff(x[:2]), 1e-5 * np.diff(x[2:4])],
    seed,
    (
        np.r_[seed[:4] - 1.0, 0.01, 0.01, transfer_time * 0.65],
        np.r_[seed[:4] + 1.0, 1, 1, transfer_time * 1.6],
    ),
    n=250,
)
end = t + x[-1]
f.arc("transearth-injection", t, x[-3], x[:2])
f.arc("earth-orbit-insertion", end - x[-2], x[-2], x[2:4])
z, res = back(x, True)
t = end
f.stage("Home parking orbit", t, z)
t2 = t + 2 * math.pi * 1.4**1.5
z = f.integrate(z, t, t2, tight=True)
t = t2
f.stage("Deorbit", t, z)
a = math.atan2(z[3], z[2]) + math.pi
start = z.copy()


def peri(d):
    y = f.integrate(start, t, t + d, [a, a], tight=True)
    r = np.linalg.norm(y[:2])
    e = np.dot(y[2:4], y[2:4]) / 2 - 1 / r
    h = y[0] * y[3] - y[1] * y[2]
    ecc = math.sqrt(1 + 2 * e * h * h)
    return h * h / (1 + ecc), y


d = brentq(lambda d: peri(d)[0] - 1.055, 0.001, 0.1)
_, z = peri(d)
f.arc("deorbit", t, d, [a, a])
t += d
f.stage("Entry handoff", t, z)
w.update(
    padPhase=float(pad_phase),
    arcs=f.arcs,
    phases=f.phases,
    landing=float(landing),
    entryStart=float(t),
    entryState=z.tolist(),
    duration=math.ceil(t + 8),
)
(here / "witness.json").write_text(json.dumps(w, indent=2) + "\n")
