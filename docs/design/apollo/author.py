"""Offline finite, full-field Apollo-style flight authoring. No runtime search."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
R = 5.0
MU = 0.03
MR = 0.2
RATE = math.sqrt((1 + MU) / R**3)
PHASE = 0.0
A = json.loads(Path("fixtures/model-sets/aster-entry.json").read_text())["atmosphere"]
VE = 8.0
ACC = 3.0
arcs = []
phases = []
TIGHT = False


def moon(t):
    a = PHASE + RATE * t
    return np.array(
        [R * math.cos(a), R * math.sin(a), -R * RATE * math.sin(a), R * RATE * math.cos(a)]
    )


def gravity(t, z):
    q = moon(t)[:2] - z[:2]
    return -z[:2] / max(np.linalg.norm(z[:2]), 1.0) ** 3 + MU * q / max(np.linalg.norm(q), MR) ** 3


def drag(z, area=0.015):
    p, v = z[:2], z[2:4]
    r = np.linalg.norm(p)
    alt = r - 1
    rel = v - 0.03 * np.array([-p[1], p[0]])
    u = np.clip((A["topHeight"] - alt) / (A["topHeight"] - A["fadeHeight"]), 0, 1)
    rho = A["density"] * math.exp(-max(0, alt) / A["scaleHeight"]) * u * u * (3 - 2 * u)
    return -0.5 * rho * area * np.linalg.norm(rel) * rel


def integrate(z, t, end, keys=None, acc=ACC, area=0.015, tight=False):
    tight = tight or TIGHT
    if end <= t:
        return z.copy()

    def rhs(at, y):
        direction = np.zeros(2)
        if keys is not None:
            u = np.clip((at - t) / (end - t), 0, 1) * (len(keys) - 1)
            i = min(len(keys) - 2, int(u))
            f = u - i
            f = f * f * (3 - 2 * f)
            a = keys[i] + f * (keys[i + 1] - keys[i])
            direction = np.array([math.cos(a), math.sin(a)])
        return np.r_[
            y[2:4],
            gravity(at, y) + drag(y, area) / (1 + y[4]) + acc * direction,
            -acc * (1 + y[4]) / VE if keys is not None else 0,
        ]

    sol = solve_ivp(
        rhs,
        (t, end),
        z,
        method="DOP853",
        rtol=2e-12 if tight else 2e-8,
        atol=2e-13 if tight else 2e-10,
        max_step=0.2 if keys is None else (end - t) / 12,
    )
    return sol.y[:, -1]


def arc(name, t, d, keys, acc=ACC):
    arcs.append(
        dict(
            id=name,
            start=float(t),
            end=float(t + d),
            angles=list(map(float, keys)),
            acceleration=acc,
        )
    )


def stage(name, t, z):
    phases.append(dict(name=name, t=float(t), state=z.tolist()))
    print(name, t, z, flush=True)


def fit(res, seed, bounds, n=150):
    global TIGHT

    def done(x):
        if np.max(np.abs(res(x)[:4])) < 1e-5:
            raise StopIteration

    sol = least_squares(
        res,
        seed,
        bounds=bounds,
        max_nfev=n,
        diff_step=1e-4,
        ftol=1e-7,
        xtol=1e-9,
        gtol=1e-6,
        verbose=2,
        callback=done,
    )
    TIGHT = True
    sol = least_squares(
        lambda x: res(x)[:4],
        sol.x,
        bounds=bounds,
        max_nfev=20,
        diff_step=1e-4,
        ftol=1e-10,
        xtol=1e-10,
        gtol=1e-8,
    )
    TIGHT = False
    print("fit", sol.cost, sol.x, flush=True)
    if np.max(np.abs(res(sol.x)[:4])) > 1e-4:
        raise RuntimeError("Unsolved boundary")
    return sol.x


launch = 0.3
z = np.array(
    [
        1.00001 * math.cos(0.03 * launch),
        1.00001 * math.sin(0.03 * launch),
        -0.03 * 1.00001 * math.sin(0.03 * launch),
        0.03 * 1.00001 * math.cos(0.03 * launch),
        6.0,
    ]
)
initial = z.copy()
lower_keys = [0.009, 0.12, 0.25, 0.4, 0.65, 0.85]
lower_duration = 0.48
split = launch + lower_duration
lower = integrate(initial, launch, split, lower_keys, tight=True)


def ascent(x, tight=False):
    lower = integrate(initial, launch, split, lower_keys, tight=tight)
    end = split + x[-2]
    a = integrate(lower, split, end, x[:-2], tight=tight)
    a = integrate(a, end, end + x[-1], tight=tight)
    r = np.linalg.norm(a[:2])
    return a, np.array(
        [r - 1.4, np.dot(a[:2], a[2:4]) / r, (a[0] * a[3] - a[1] * a[2]) / r - 1 / math.sqrt(1.4)]
    )


x = fit(
    lambda x: np.r_[ascent(x)[1] * 100, 0, 1e-5 * np.diff(x[:-2])],
    np.r_[np.linspace(2.2, 2.9, 5), 0.3, 0.5],
    ([-1] * 5 + [0.03, 0], [5] * 5 + [0.65, 3]),
)
z, e = ascent(x, True)
t = split + sum(x[-2:])
arc("boost", launch, lower_duration, lower_keys)
arc("insertion", split, x[-2], x[:-2])
stage("Parking orbit", t, z)
ascent_end = t
# An entire physical parking revolution; no orbital rail attachment.
t2 = t + 2 * math.pi * 1.4**1.5
z = integrate(z, t, t2, tight=True)
t = t2
stage("Translunar departure", t, z)
start = z.copy()
transfer_time = math.pi * ((1.4 + R - 0.35) / 2) ** 1.5
angle = math.atan2(z[1], z[0])
PHASE = angle + math.pi - RATE * (t + transfer_time)
# Repeat ascent/coast under frozen moon phase (perturbation changes initial orbit).
z, e = ascent(x, True)
phases[0]["state"] = z.tolist()
z = integrate(z, ascent_end, t, tight=True)
phases[1]["state"] = z.tolist()
start = z.copy()


def lunar_target(at):
    m = moon(at)
    a = PHASE + RATE * at
    p = -0.35 * np.array([math.cos(a), math.sin(a)])
    v = math.sqrt(MU / 0.35) * np.array([math.sin(a), -math.cos(a)])
    return np.r_[m[:2] + p, m[2:] + v]


def transfer(x, tight=False):
    d0, d1 = x[-2:]
    end = t + transfer_time
    s = integrate(start, t, t + d0, x[:2], tight=tight)
    s = integrate(s, t + d0, end - d1, tight=tight)
    s = integrate(s, end - d1, end, x[2:4], tight=tight)
    return s


seed = np.r_[
    angle + math.pi / 2, angle + math.pi / 2, angle - math.pi / 2, angle - math.pi / 2, 0.09, 0.16
]
xfer = fit(
    lambda x: np.r_[
        (transfer(x)[:4] - lunar_target(t + transfer_time)) * 100,
        1e-4 * np.diff(x[:2]),
        1e-4 * np.diff(x[2:4]),
    ],
    seed,
    ([-20] * 4 + [0.005, 0.005], [20] * 4 + [0.6, 0.8]),
    n=200,
)
end = t + transfer_time
arc("translunar-injection", t, xfer[-2], xfer[:2])
arc("lunar-orbit-insertion", end - xfer[-1], xfer[-1], xfer[2:4])
z = transfer(xfer, True)
t = end
stage("Lunar orbit", t, z)
out = dict(
    moonPhase=PHASE, initial=initial.tolist(), arcs=arcs, phases=phases, ascentEnd=ascent_end
)
(HERE / "witness.json").write_text(json.dumps(out, indent=2) + "\n")
