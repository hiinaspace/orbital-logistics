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
LASTMIN = 1.0


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


def integrate(z, t, end, keys=None, acc=ACC, area=0.015, tight=False, force=None):
    global LASTMIN
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
            gravity(at, y)
            + drag(y, area) / (1 + y[4])
            + (min(ACC, force / (1 + y[4])) if force is not None else acc) * direction,
            -(min(force, ACC * (1 + y[4])) if force is not None else acc * (1 + y[4])) / VE
            if keys is not None
            else 0,
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
    LASTMIN = min(
        float(np.min(np.linalg.norm(sol.y[:2], axis=0) - 1)),
        min(float(np.linalg.norm(sol.y[:2, i] - moon(at)[:2]) - 0.2) for i, at in enumerate(sol.t)),
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
        lambda x: res(x)[:5],
        sol.x,
        bounds=bounds,
        max_nfev=150,
        diff_step=1e-6,
        ftol=1e-11,
        xtol=1e-11,
        gtol=1e-10,
    )
    TIGHT = False
    print("fit", sol.cost, sol.x, flush=True)
    if np.max(np.abs(res(sol.x)[:4])) > 1e-4:
        raise RuntimeError("Unsolved boundary")
    return sol.x
