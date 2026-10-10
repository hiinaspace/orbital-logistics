"""Compare lower airless orbits and moderate acceleration; offline seed authoring."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares, root

HERE = Path(__file__).resolve().parent
INITIAL = np.array([1.000001, 0, 0, 0.1000001])
REPORT = []


def flight(x, cap, tight=False):
    keys = [0.0, *x[:4]]
    duration = x[4]
    y = INITIAL.copy()
    minimum, maximum = 1.000001, 1.000001
    for i in range(4):
        lo, hi = duration * i / 4, duration * (i + 1) / 4

        def rhs(t, s):
            u = np.clip((t - lo) / (hi - lo), 0, 1)
            u = u * u * (3 - 2 * u)
            angle = keys[i] + u * (keys[i + 1] - keys[i])
            return np.r_[
                s[2:],
                -s[:2] / np.linalg.norm(s[:2]) ** 3
                + cap * np.array([math.cos(angle), math.sin(angle)]),
            ]

        sol = solve_ivp(
            rhs,
            (lo, hi),
            y,
            method="DOP853",
            rtol=2e-12 if tight else 2e-8,
            atol=2e-13 if tight else 2e-10,
            max_step=(hi - lo) / 8,
        )
        y = sol.y[:, -1]
        radii = np.linalg.norm(sol.y[:2], axis=0)
        minimum = min(minimum, float(min(radii)))
        maximum = max(maximum, float(max(radii)))
    return y, minimum, maximum


for radius, cap in [(1.25, 1.5), (1.4, 1.5), (1.25, 1.2), (1.4, 1.2)]:

    def endpoint(x, tight=False):
        y, low, high = flight(x, cap, tight)
        r = np.linalg.norm(y[:2])
        return (
            np.array(
                [
                    r - radius,
                    np.dot(y[:2], y[2:]) / r,
                    (y[0] * y[3] - y[1] * y[2]) / r - radius**-0.5,
                ]
            ),
            y,
            low,
            high,
        )

    def residual(x):
        e, _, low, high = endpoint(x)
        return np.r_[
            1000 * e,
            1000 * min(0, low - 1),
            1000 * max(0, high - radius - 0.03),
            0.003 * np.diff([0, *x[:4]]),
            0.02 * cap * x[4],
        ]

    fit = least_squares(
        residual,
        [0.3, 0.8, 1.6, 2.6, 1.7 if cap == 1.5 else 2.5],
        bounds=([-0.4] * 4 + [0.8], [4.5] * 4 + [4]),
        max_nfev=220,
        ftol=1e-11,
        xtol=1e-11,
        gtol=1e-11,
    )
    selected = [1, 3, 4]

    def exact(v):
        x = fit.x.copy()
        x[selected] = v
        return endpoint(x, True)[0]

    fine = root(exact, fit.x[selected], tol=1e-10)
    fit.x[selected] = fine.x
    e, y, low, high = endpoint(fit.x, True)
    keys = [0.0, *fit.x[:4].tolist()]
    t = float(fit.x[4])
    result = dict(
        radius=radius,
        acceleration=cap,
        duration=t,
        keys=keys,
        terminal=y.tolist(),
        errors=e.tolist(),
        minimumRadius=low,
        maximumRadius=high,
        deltaV=cap * t,
        remainingFuel6=7.05 * math.exp(-2 * cap * t / 3) - 1.05,
        remainingFuel12=13.05 * math.exp(-2 * cap * t / 3) - 1.05,
    )
    REPORT.append(result)
    print(json.dumps(result), flush=True)
(HERE / "variants.json").write_text(json.dumps(REPORT, indent=2) + "\n")
