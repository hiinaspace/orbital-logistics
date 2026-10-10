"""Authored primary-only surface acceleration contracts; offline DOP853."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares, root

HERE = Path(__file__).resolve().parent
SPIN = 0.1
CAP = 3.0
RADIUS = 2.0


def angle(keys, u):
    k = min(len(keys) - 2, int(max(0, u) * (len(keys) - 1)))
    f = np.clip(u * (len(keys) - 1) - k, 0, 1)
    f = f * f * (3 - 2 * f)
    return keys[k] + f * (keys[k + 1] - keys[k])


def powered(y, duration, keys, tight=False):
    low = np.linalg.norm(y[:2])
    for i in range(len(keys) - 1):
        lo, hi = duration * i / (len(keys) - 1), duration * (i + 1) / (len(keys) - 1)

        def rhs(t, s):
            a = angle(keys, t / duration)
            return np.r_[
                s[2:],
                -s[:2] / np.linalg.norm(s[:2]) ** 3 + CAP * np.array([math.cos(a), math.sin(a)]),
            ]

        sol = solve_ivp(
            rhs,
            (lo, hi),
            y,
            method="DOP853",
            rtol=2e-12 if tight else 2e-8,
            atol=2e-13 if tight else 2e-10,
            max_step=(hi - lo) / 4,
        )
        y = sol.y[:, -1]
        low = min(low, float(np.min(np.linalg.norm(sol.y[:2], axis=0))))
    return y, low


def coast(y, duration, tight=False):
    if duration < 1e-14:
        return y.copy(), float(np.linalg.norm(y[:2]))
    sol = solve_ivp(
        lambda t, s: np.r_[s[2:], -s[:2] / np.linalg.norm(s[:2]) ** 3],
        (0, duration),
        y,
        method="DOP853",
        rtol=2e-12 if tight else 2e-8,
        atol=2e-13 if tight else 2e-10,
        max_step=0.03,
    )
    return sol.y[:, -1], float(np.min(np.linalg.norm(sol.y[:2], axis=0)))


initial = np.array([1.000001, 0, 0, SPIN * 1.000001])


def ascent(x, tight=False):
    first_keys = np.r_[0.0, x[:2]]
    second_keys = x[2:5]
    y, low = powered(initial, x[5], first_keys, tight)
    y, lo = coast(y, x[6], tight)
    low = min(low, lo)
    y, lo = powered(y, x[7], second_keys, tight)
    r = np.linalg.norm(y[:2])
    errors = np.array(
        [r - RADIUS, np.dot(y[:2], y[2:]) / r, (y[0] * y[3] - y[1] * y[2]) / r - RADIUS**-0.5]
    )
    return errors, y, min(low, lo)


def residual(x):
    e, _, low = ascent(x)
    return np.r_[e * 1000, 1000 * min(0, low - 1), 0.001 * np.diff(x[:5]), 0.05 * (x[5] + x[7])]


fit = least_squares(
    residual,
    [0.15, 0.35, 2.0, 2.5, 2.8, 0.5, 1.2, 0.3],
    bounds=([-0.5] * 5 + [0.15, 0.1, 0.1], [4] * 5 + [0.9, 4, 0.7]),
    max_nfev=180,
    ftol=1e-11,
    xtol=1e-11,
    gtol=1e-11,
)
selected = [2, 5, 7]


def exact(v):
    x = fit.x.copy()
    x[selected] = v
    return ascent(x, True)[0]


fine = root(exact, fit.x[selected], tol=1e-10, options={"maxfev": 200})
fit.x[selected] = fine.x
e, up, low = ascent(fit.x, True)
print("ascent", fit.x, "state", up, "error", e, "min", low, flush=True)
assert max(abs(e)) < 1e-8 and low >= 1 and max(fit.x[5], fit.x[7]) > 0
first = [0.0, *fit.x[:2].tolist()]
second = fit.x[2:5].tolist()
burn1, coast_time, burn2 = map(float, fit.x[5:])
duration = burn1 + coast_time + burn2
# Mirror the entire upward primary-only solution, then reverse time.
# The reverse initial pad velocity is -spin. The forward descent therefore
# ends at the desired +spin pad velocity; its entry is a prograde circle.
entry = up.copy()
entry[1] *= -1
entry[2] *= -1
total_burn = 2 * (burn1 + burn2)
initial_mass = 7.05
print(
    "combined burn",
    total_burn,
    "fuel floor after local legs",
    initial_mass * math.exp(-CAP * total_burn / 3) - 1.05,
    flush=True,
)
witness = {
    "spin": SPIN,
    "acceleration": CAP,
    "radius": RADIUS,
    "height": 1e-6,
    "ascent": {
        "arcs": [
            {"start": 0.0, "duration": burn1, "keys": first},
            {"start": burn1 + coast_time, "duration": burn2, "keys": second},
        ],
        "duration": duration,
        "initial": initial.tolist(),
        "terminal": up.tolist(),
        "errors": e.tolist(),
    },
    "descent": {
        "arcs": [
            {"start": 0.0, "duration": burn2, "keys": [-v for v in second[::-1]]},
            {"start": burn2 + coast_time, "duration": burn1, "keys": [-v for v in first[::-1]]},
        ],
        "duration": duration,
        "initial": entry.tolist(),
        "terminal": [1.000001, 0, 0, SPIN * 1.000001],
    },
    "localOnlyRemainingFuel": initial_mass * math.exp(-CAP * total_burn / 3) - 1.05,
}
(HERE / "witness.json").write_text(json.dumps(witness, indent=2) + "\n")
