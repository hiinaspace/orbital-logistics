"""Offline finite-flight authorship. Forward DOP853, no runtime solver."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares, root

HERE = Path(__file__).resolve().parent
OLD = json.loads((HERE.parent / "surface-ascent/ascent-study.json").read_text())[0]
SPIN = 0.003
DEPARTURE = 0.3
PAYLOAD = 0.65  # dry .25 + freight .1 + independent fuel .3
BOOSTER_DRY = 0.3
INITIAL_MASS = 2.5
SPLIT_OFFSET = OLD["arcs"][4][1]


def mass(t, m0, force, cap, ve):
    transition = max(0.0, (m0 - force / cap) * ve / force)
    return (
        m0 - force / ve * t
        if t <= transition
        else min(m0, force / cap) * math.exp(-cap / ve * (t - transition))
    )


def smooth(keys, u):
    k = min(len(keys) - 2, int(max(0, u) * (len(keys) - 1)))
    f = np.clip(u * (len(keys) - 1) - k, 0, 1)
    f = f * f * (3 - 2 * f)
    return keys[k] + f * (keys[k + 1] - keys[k])


def powered(y, start, duration, keys, m0, force, cap=3, ve=3, tight=False):
    def rhs(t, s):
        a = smooth(keys, (t - start) / duration)
        r = np.linalg.norm(s[:2])
        thrust = min(force / mass(t - start, m0, force, cap, ve), cap)
        return np.r_[s[2:], -s[:2] / r**3 + thrust * np.array([math.cos(a), math.sin(a)])]

    # Segment at every steering key so independent integration resolves key law.
    minimum = float(np.linalg.norm(y[:2]))
    for i in range(len(keys) - 1):
        a = start + duration * i / (len(keys) - 1)
        b = start + duration * (i + 1) / (len(keys) - 1)
        sol = solve_ivp(
            rhs,
            (a, b),
            y,
            method="DOP853",
            rtol=2e-12 if tight else 2e-8,
            atol=2e-13 if tight else 2e-10,
            max_step=(b - a) / 3,
        )
        y = sol.y[:, -1]
        minimum = min(minimum, float(np.min(np.linalg.norm(sol.y[:2], axis=0))))
    return y, minimum, mass(duration, m0, force, cap, ve)


def coast(y, duration, tight=False):
    if duration < 1e-14:
        return y, float(np.linalg.norm(y[:2]))
    sol = solve_ivp(
        lambda t, s: np.r_[s[2:], -s[:2] / np.linalg.norm(s[:2]) ** 3],
        (0, duration),
        y,
        method="DOP853",
        rtol=2e-12 if tight else 2e-8,
        atol=2e-13 if tight else 2e-10,
        max_step=0.05,
    )
    return sol.y[:, -1], float(np.min(np.linalg.norm(sol.y[:2], axis=0)))


angle = SPIN * DEPARTURE
y0 = np.array(
    [
        1.000001 * math.cos(angle),
        1.000001 * math.sin(angle),
        -0.003000003 * math.sin(angle),
        0.003000003 * math.cos(angle),
    ]
)
# Smooth booster pitch law, with strictly radial lift-off at its first key.
LOWER_KEYS = [angle, 0.12, 0.22, 0.32, 0.5, 0.75]
y, _, _ = powered(y0, DEPARTURE, SPLIT_OFFSET, LOWER_KEYS, INITIAL_MASS, 5, tight=True)
SPLIT = DEPARTURE + SPLIT_OFFSET
SPLIT_STATE = y.copy()
SPLIT_MASS = mass(SPLIT_OFFSET, INITIAL_MASS, 5, 3, 3)
print(
    "split",
    SPLIT,
    y,
    "mass",
    SPLIT_MASS,
    "booster fuel",
    SPLIT_MASS - PAYLOAD - BOOSTER_DRY,
    flush=True,
)


def ascent(x, tight=False):
    y, low, m = powered(SPLIT_STATE, SPLIT, x[-2], x[:-2], PAYLOAD, 1.8, tight=tight)
    y, lo = coast(y, x[-1], tight)
    low = min(low, lo)
    r = np.linalg.norm(y[:2])
    e = np.array(
        [r - 1.25, np.dot(y[:2], y[2:]) / r, (y[0] * y[3] - y[1] * y[2]) / r - 1 / math.sqrt(1.25)]
    )
    return e, y, low, m


fit = least_squares(
    lambda x: np.r_[ascent(x)[0] * 1000, 1000 * min(0, ascent(x)[2] - 1), 0.0001 * np.diff(x[:-2])],
    np.r_[np.linspace(1.6, 3.0, 5), 0.25, 0.65],
    bounds=([-1] * 5 + [0.05, 0], [4] * 5 + [0.45, 2]),
    max_nfev=130,
    ftol=1e-11,
    xtol=1e-11,
    gtol=1e-11,
)
selected = [0, -3, -2]


def exact(v):
    x = fit.x.copy()
    x[selected] = v
    return ascent(x, True)[0]


fine = root(exact, fit.x[selected], tol=1e-10)
fit.x[selected] = fine.x
e, y, low, m = ascent(fit.x, True)
upper = {
    "keys": fit.x[:-2].tolist(),
    "burn": float(fit.x[-2]),
    "coast": float(fit.x[-1]),
    "arrival": float(SPLIT + sum(fit.x[-2:])),
    "state": y.tolist(),
    "fuel": float(m - 0.35),
    "errors": e.tolist(),
    "minimum": low,
}
print("upper", upper, flush=True)
assert max(abs(e)) < 1e-8 and m > 0.35 and low >= 1

# Solve recovery backward from supported pad and match all four separation-state components.
# Time reversal uses negated velocities, unchanged gravity and thrust; reverse mass grows.
BOOSTER_MASS = SPLIT_MASS - PAYLOAD


def reverse(x, tight=False):
    keys = x[:-3]
    burn, coast_time, fuel = x[-3:]
    duration = burn + coast_time
    phase = SPIN * (SPLIT + duration)
    y = np.array(
        [
            1.000001 * math.cos(phase),
            1.000001 * math.sin(phase),
            SPIN * 1.000001 * math.sin(phase),
            -SPIN * 1.000001 * math.cos(phase),
        ]
    )
    final = BOOSTER_DRY + fuel
    force = 3.0
    cap = 3.0
    ve = 3.0
    transition = max(0, ve / cap * math.log(force / cap / final))

    def reverse_mass(t):
        return (
            final * math.exp(cap / ve * t)
            if t <= transition
            else force / cap + force / ve * (t - transition)
        )

    low = 1.000001
    for i in range(len(keys) - 1):
        a = burn * i / (len(keys) - 1)
        b = burn * (i + 1) / (len(keys) - 1)

        def rhs(t, s):
            h = smooth(keys, t / burn) + phase
            r = np.linalg.norm(s[:2])
            return np.r_[
                s[2:],
                -s[:2] / r**3
                + min(force / reverse_mass(t), cap) * np.array([math.cos(h), math.sin(h)]),
            ]

        sol = solve_ivp(
            rhs,
            (a, b),
            y,
            method="DOP853",
            rtol=2e-12 if tight else 2e-8,
            atol=2e-13 if tight else 2e-10,
            max_step=(b - a) / 3,
        )
        y = sol.y[:, -1]
        low = min(low, float(np.min(np.linalg.norm(sol.y[:2], axis=0))))
    y, lo = coast(y, coast_time, tight)
    low = min(low, lo)
    return y, low, reverse_mass(burn), phase


target = SPLIT_STATE.copy()
target[2:] *= -1


def res(x):
    y, low, m, _ = reverse(x)
    return np.r_[
        1000 * (y - target),
        1000 * (m - BOOSTER_MASS),
        1000 * min(0, low - 1),
        0.0001 * np.diff(x[:-3]),
    ]


for duration in [0.7, 1.0, 1.3]:
    seed = np.r_[np.linspace(0, -2.0, 7), duration, 0.2, 0.12]
    fit = least_squares(
        res,
        seed,
        bounds=([-4] * 7 + [0.1, 0, 0.02], [4] * 7 + [2.0, 3.0, BOOSTER_MASS - BOOSTER_DRY]),
        max_nfev=220,
        ftol=1e-11,
        xtol=1e-11,
        gtol=1e-11,
    )
    print("recovery fit", fit.cost, fit.nfev, fit.x, flush=True)
    selected = [1, 2, 4, 5, -3]

    def exact_recovery(v):
        x = fit.x.copy()
        x[selected] = v
        y, _, m, _ = reverse(x, True)
        return np.r_[y - target, m - BOOSTER_MASS]

    refined = root(exact_recovery, fit.x[selected], tol=1e-10)
    fit.x[selected] = refined.x
    y, low, m, phase = reverse(fit.x, True)
    if max(abs(y - target)) < 1e-8 and abs(m - BOOSTER_MASS) < 1e-8 and low >= 1:
        break
else:
    raise RuntimeError("No recovery witness")
result = {
    "split": SPLIT,
    "splitState": SPLIT_STATE.tolist(),
    "splitMass": float(SPLIT_MASS),
    "lowerKeys": LOWER_KEYS,
    "lowerBurn": SPLIT_OFFSET,
    "upper": upper,
    "recovery": {
        "reverseKeys": fit.x[:-3].tolist(),
        "burn": float(fit.x[-3]),
        "coast": float(fit.x[-2]),
        "finalFuel": float(fit.x[-1]),
        "phase": phase,
        "landing": float(SPLIT + sum(fit.x[-3:-1])),
        "errors": (y - target).tolist(),
        "massError": float(m - BOOSTER_MASS),
        "minimum": low,
    },
}
(HERE / "witness.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result), flush=True)
