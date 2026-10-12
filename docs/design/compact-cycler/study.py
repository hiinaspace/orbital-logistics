"""Disposable physical coast search; remove after choosing the carrier branch."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq, root

N = np.sqrt(1.03 / 125)
R = brentq(lambda x: N * N * x - 1 / x**2 - 0.03 / (x - 5) ** 2, 5.3, 7)


def planet(t):
    a = N * t
    return np.array([5 * np.cos(a), 5 * np.sin(a)])


def gravity(t, p):
    d = planet(t) - p
    r = np.linalg.norm(p)
    m = np.linalg.norm(d)
    return -p / r**3 + 0.03 * d / m**3


results = []
for duration in [40.0, 48.0, 56.0, 64.0, 72.0]:
    t0, t1 = 5.0, duration - 5
    a0 = N * t0 + 0.08
    a1 = N * t1 - 0.08
    p0 = 5.6 * np.array([np.cos(a0), np.sin(a0)])
    p1 = 5.6 * np.array([np.cos(a1), np.sin(a1)])
    calls = 0

    def shoot(v, full=False):
        global calls
        calls += 1
        sol = solve_ivp(
            lambda t, y: np.r_[y[2:], gravity(t, y[:2])],
            (t0, t1),
            np.r_[p0, v],
            method="DOP853",
            rtol=2e-10,
            atol=2e-12,
            max_step=0.4,
            dense_output=True,
        )
        return sol if full else sol.y[:2, -1] - p1

    radial = p0 / np.linalg.norm(p0)
    tangent = np.array([-radial[1], radial[0]])
    for vr, vt in [(-0.2, 0.3), (-0.1, 0.3), (-0.3, 0.15), (-0.1, 0.45)]:
        calls = 0
        solved = root(shoot, vr * radial + vt * tangent, tol=1e-9, options={"maxfev": 40})
        if not solved.success or np.linalg.norm(shoot(solved.x)) > 1e-7:
            continue
        s = shoot(solved.x, True)
        ts = np.linspace(t0, t1, 1025)
        ys = s.sol(ts).T
        primary = np.linalg.norm(ys[:, :2], axis=1)
        moon = np.array([np.linalg.norm(y[:2] - planet(t)) for y, t in zip(ys, ts)])
        row = dict(
            duration=duration,
            calls=calls,
            start=s.y[:, 0].tolist(),
            end=s.y[:, -1].tolist(),
            peri=float(primary.min()),
            periTime=float(ts[primary.argmin()]),
            moon=float(moon.min()),
            apo=float(primary.max()),
        )
        print(row, flush=True)
        if primary.min() > 1.3 and moon.min() > 0.3:
            results.append(row)
Path("docs/design/compact-cycler/coast-candidates.json").write_text(
    json.dumps(dict(rate=N, beacon=R, candidates=results), indent=2) + "\n"
)
