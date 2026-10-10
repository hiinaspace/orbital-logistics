"""Offline atmospheric launch and finite mission authorship with DOP853."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares, root

HERE = Path(__file__).resolve().parent
BASE = json.loads(Path("fixtures/model-sets/aster-entry.json").read_text())
A = BASE["atmosphere"]
G = BASE["guidance"]
RECOVERY = BASE["recovery"]
SPIN = np.array(A["spin"])
DEPARTURE = 0.3
PAYLOAD = 0.7
SPLIT_DURATION = 0.6
LOWER_KEYS = [0.009, 0.12, 0.25, 0.4, 0.65, 0.85]
RADIUS = 1.35


def smooth(keys, u):
    k = min(len(keys) - 2, int(max(0, u) * (len(keys) - 1)))
    f = np.clip(u * (len(keys) - 1) - k, 0, 1)
    f = f * f * (3 - 2 * f)
    return keys[k] + f * (keys[k + 1] - keys[k])


def aero(z, area, ld):
    p, v = z[:3], z[3:6]
    r = np.linalg.norm(p)
    alt = r - 1
    normal = p / r
    relative = v - np.cross(SPIN, p)
    speed = np.linalg.norm(relative)
    density = A["density"] * np.exp(-max(0, alt) / A["scaleHeight"])
    f = np.clip((A["topHeight"] - alt) / (A["topHeight"] - A["fadeHeight"]), 0, 1)
    density *= f * f * (3 - 2 * f)
    q = 0.5 * density * speed**2
    drag = -0.5 * density * area * speed * relative
    flow = relative / speed if speed > 1e-12 else np.zeros(3)
    crossflow = normal - flow * np.dot(normal, flow)
    h = np.clip(alt / 0.04, 0, 1)
    lift = (
        q
        * area
        * ld
        * h
        * h
        * (3 - 2 * h)
        * crossflow
        / np.sqrt(np.dot(crossflow, crossflow) + 1e-8)
    )
    return drag, lift, q, relative, normal, alt


def rhs(z, nonfuel, force, direction, area=0.015, ld=0):
    drag, lift, *_ = aero(z, area, ld)
    return np.r_[
        z[3:6],
        -z[:3] / np.linalg.norm(z[:3]) ** 3 + (drag + lift + force * direction) / (nonfuel + z[6]),
        -force / 3,
    ]


def powered(z, start, duration, keys, nonfuel, maximum, cap=3, area=0.015, tight=False):
    y = z.copy()
    low = np.linalg.norm(y[:3])
    for i in range(len(keys) - 1):
        lo, hi = (
            start + duration * i / (len(keys) - 1),
            start + duration * (i + 1) / (len(keys) - 1),
        )

        def rate(t, s):
            angle = smooth(keys, (t - start) / duration)
            force = min(maximum, cap * (nonfuel + s[6]))
            return rhs(s, nonfuel, force, np.array([math.cos(angle), math.sin(angle), 0]), area)

        sol = solve_ivp(
            rate,
            (lo, hi),
            y,
            method="DOP853",
            rtol=2e-12 if tight else 2e-8,
            atol=2e-13 if tight else 2e-10,
            max_step=(hi - lo) / 3,
        )
        y = sol.y[:, -1]
        low = min(low, float(np.min(np.linalg.norm(sol.y[:3], axis=0))))
    return y, low


def coast(z, start, duration, nonfuel, area=0.015, tight=False):
    if duration < 1e-14:
        return z.copy(), float(np.linalg.norm(z[:3]))
    sol = solve_ivp(
        lambda t, s: rhs(s, nonfuel, 0, np.zeros(3), area),
        (start, start + duration),
        z,
        method="DOP853",
        rtol=2e-12 if tight else 2e-8,
        atol=2e-13 if tight else 2e-10,
        max_step=0.02,
    )
    return sol.y[:, -1], float(np.min(np.linalg.norm(sol.y[:3], axis=0)))


def entry(z, start, nonfuel, maximum, cap=3, duration=8):
    def rate(t, s):
        drag, lift, _, relative, normal, alt = aero(s, 2, 0.25)
        gravity = -s[:3] / np.linalg.norm(s[:3]) ** 3
        u = np.clip((G["startHeight"] - alt) / (G["startHeight"] - G["fullHeight"]), 0, 1)
        engagement = u * u * (3 - 2 * u)
        target = -np.sqrt(
            G["descentSpeed"] ** 2 + 2 * G["descentGain"] * max(0, alt - RECOVERY["height"])
        )
        force = (
            (nonfuel + s[6])
            * engagement
            * (
                -gravity
                - (drag + lift) / (nonfuel + s[6])
                + G["velocityGain"] * (target * normal - relative)
            )
        )
        length = np.linalg.norm(force)
        maximum_now = min(maximum, cap * (nonfuel + s[6]))
        if length > maximum_now:
            force *= maximum_now / length
        return np.r_[
            s[3:6], gravity + (drag + lift + force) / (nonfuel + s[6]), -np.linalg.norm(force) / 3
        ]

    def contact(t, s):
        return np.linalg.norm(s[:3]) - 1 - RECOVERY["height"]

    setattr(contact, "terminal", True)
    setattr(contact, "direction", -1)
    sol = solve_ivp(
        rate,
        (start, start + duration),
        z,
        method="DOP853",
        rtol=2e-12,
        atol=2e-13,
        max_step=0.002,
        events=contact,
    )
    y = sol.y[:, -1]
    speed = np.linalg.norm(aero(y, 2, 0.25)[3])
    return {
        "t": float(sol.t[-1]),
        "state": y.tolist(),
        "speed": float(speed),
        "contact": bool(len(sol.t_events[0])),
    }


phase = 0.03 * DEPARTURE
initial = np.array(
    [
        (1 + 1e-5) * math.cos(phase),
        (1 + 1e-5) * math.sin(phase),
        0,
        -0.03 * (1 + 1e-5) * math.sin(phase),
        0.03 * (1 + 1e-5) * math.cos(phase),
        0,
        1.55,
    ]
)
split, minimum = powered(initial, DEPARTURE, SPLIT_DURATION, LOWER_KEYS, 1.0, 5, tight=True)
SPLIT = DEPARTURE + SPLIT_DURATION
print("split", split, "radius", np.linalg.norm(split[:3]), "min", minimum, flush=True)
assert split[6] > 0 and np.linalg.norm(split[:3]) > 1.2
upper_initial = split.copy()
upper_initial[6] = 0.35
boostback_keys = [math.atan2(split[4], split[3]) + math.pi] * 2
boostback_duration = 0.23
boostback, _ = powered(split, SPLIT, boostback_duration, boostback_keys, 0.3, 5, tight=True)
booster_recovery = entry(boostback, SPLIT + boostback_duration, 0.3, 5)
print("booster", booster_recovery, flush=True)
assert (
    booster_recovery["contact"]
    and booster_recovery["speed"] < 0.06
    and booster_recovery["state"][6] > 0
)


def ascent(x, tight=False):
    z, low = powered(upper_initial, SPLIT, x[-2], x[:-2], 0.35, 1.8, tight=tight)
    z, lo = coast(z, SPLIT + x[-2], x[-1], 0.35, tight=tight)
    radius = np.linalg.norm(z[:3])
    e = np.array(
        [
            radius - RADIUS,
            np.dot(z[:3], z[3:6]) / radius,
            (z[0] * z[4] - z[1] * z[3]) / radius - 1 / math.sqrt(RADIUS),
        ]
    )
    return e, z, min(low, lo)


def residual(x):
    e, z, low = ascent(x)
    return np.r_[e * 1000, 1000 * min(0, low - 1.2), 0.0001 * np.diff(x[:-2])]


fit = least_squares(
    residual,
    np.r_[np.linspace(2.2, 2.9, 5), 0.35, 0.5],
    bounds=([-1] * 5 + [0.05, 0], [4] * 5 + [0.65, 3]),
    max_nfev=150,
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
e, upper, low = ascent(fit.x, True)
arrival = SPLIT + sum(fit.x[-2:])
print("upper", fit.x, "state", upper, "errors", e, "arrival", arrival, flush=True)
assert max(abs(e)) < 1e-8 and upper[6] > 0.04 and low > 1.2
phase = math.atan2(upper[1], upper[0]) - arrival / RADIUS**1.5
departure = arrival + 2.5
angle = phase + departure / RADIUS**1.5
undock = np.r_[
    RADIUS * math.cos(angle),
    RADIUS * math.sin(angle),
    0,
    -math.sin(angle) / math.sqrt(RADIUS),
    math.cos(angle) / math.sqrt(RADIUS),
    0,
    upper[6],
]
deorbit_keys = [angle - math.pi / 2] * 2


def peri(duration):
    z, _ = powered(undock, departure, duration, deorbit_keys, 0.25, 1.8, tight=True)
    radius = np.linalg.norm(z[:3])
    energy = np.dot(z[3:6], z[3:6]) / 2 - 1 / radius
    angular = np.linalg.norm(np.cross(z[:3], z[3:6]))
    eccentricity = math.sqrt(1 + 2 * energy * angular**2)
    return angular**2 / (1 + eccentricity), z


burn = root(lambda x: peri(float(x[0]))[0] - 1.055, [0.035], tol=1e-10).x[0]
perigee, deorbit = peri(burn)
return_recovery = entry(deorbit, departure + burn, 0.25, 1.8)
print(
    "return",
    burn,
    "peri",
    perigee,
    "entry initial",
    deorbit,
    "recovery",
    return_recovery,
    flush=True,
)
assert (
    return_recovery["contact"]
    and return_recovery["speed"] < 0.06
    and return_recovery["state"][6] > 0
)
witness = {
    "lower": {
        "start": DEPARTURE,
        "duration": SPLIT_DURATION,
        "keys": LOWER_KEYS,
        "state": split.tolist(),
    },
    "upper": {
        "keys": fit.x[:-2].tolist(),
        "burn": float(fit.x[-2]),
        "coast": float(fit.x[-1]),
        "arrival": float(arrival),
        "state": upper.tolist(),
        "errors": e.tolist(),
    },
    "station": {"radius": RADIUS, "rate": RADIUS**-1.5, "phase": float(phase)},
    "departure": float(departure),
    "deorbit": {
        "start": float(departure),
        "duration": float(burn),
        "keys": deorbit_keys,
        "state": deorbit.tolist(),
    },
    "boostback": {
        "start": SPLIT,
        "duration": boostback_duration,
        "keys": boostback_keys,
        "state": boostback.tolist(),
    },
    "boosterRecovery": booster_recovery,
    "returnRecovery": return_recovery,
}
(HERE / "witness.json").write_text(json.dumps(witness, indent=2) + "\n")
