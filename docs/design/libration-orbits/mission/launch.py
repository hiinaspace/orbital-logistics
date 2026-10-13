"""Bounded independent airless staged launch to a real local parking state."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

m = 0.003
a = 4
n = 0.125
radius = 0.1
height = 1e-6
spin = 0.2
launch = 0.5
split = 1.5
parking = 2.5


def planet(t):
    c = np.cos(n * t)
    s = np.sin(n * t)
    return np.array(
        [
            a * (1 - m) * c,
            a * (1 - m) * s,
            0,
            -a * (1 - m) * n * s,
            a * (1 - m) * n * c,
            0,
        ]
    )


def support(t):
    q = planet(t)
    c = np.cos(spin * t)
    s = np.sin(spin * t)
    r = radius + height
    return q + np.array([r * c, r * s, 0, -r * spin * s, r * spin * c, 0])


def rhs(t, y):
    b = planet(t)
    c = np.cos(n * t)
    s = np.sin(n * t)
    p = np.array([-a * m * c, -a * m * s, 0])
    r = y[:3] - p
    q = y[:3] - b[:3]
    return np.r_[y[3:], -(1 - m) * r / np.linalg.norm(r) ** 3 - m * q / np.linalg.norm(q) ** 3]


def heading(keys, t):
    i = min(np.searchsorted([k[0] for k in keys], t, side="right") - 1, len(keys) - 2)
    i = max(0, i)
    lo, h0 = keys[i]
    hi, h1 = keys[i + 1]
    u = np.clip((t - lo) / (hi - lo), 0, 1)
    u = u * u * (3 - 2 * u)
    theta = h0 + (h1 - h0) * u
    return np.array([np.cos(theta), np.sin(theta), 0])


def integrate(y, start, end, acc, keys, dense=False):
    return solve_ivp(
        lambda t, y: rhs(t, y) + np.r_[np.zeros(3), acc * heading(keys, t)],
        [start, end],
        y,
        method="DOP853",
        rtol=2e-13,
        atol=2e-14,
        max_step=0.01,
        dense_output=dense,
    )


def trajectory(u, dense=False):
    lower = [
        (launch, spin * launch),
        (launch + 0.25, (spin * launch + u[0]) / 2),
        (launch + 0.5, u[0]),
        (launch + 0.75, (u[0] + u[1]) / 2),
        (split, u[1]),
    ]
    upper = [(split, u[1]), ((split + parking) / 2, (u[1] + u[2]) / 2), (parking, u[2])]
    lo = integrate(support(launch), launch, split, u[5], lower, dense)
    hi = integrate(lo.y[:, -1], split, parking, u[4], upper, dense)
    r = 0.15
    phi = u[3]
    target = planet(parking) + np.array(
        [
            r * np.cos(phi),
            r * np.sin(phi),
            0,
            -np.sqrt(m / r) * np.sin(phi),
            np.sqrt(m / r) * np.cos(phi),
            0,
        ]
    )
    return lo, hi, target, lower, upper


def objective(u):
    _, hi, target, _, _ = trajectory(u)
    e = hi.y[:, -1] - target
    return e[[0, 1, 3, 4]] * np.array([1, 1, 2, 2])


best = None
u = np.array([0.43589891, 1.6656045, 4.4937556, 1.49216218, 0.06183985, 0.32704147])
for iteration in range(12):
    error = objective(u)
    print("refine", iteration, max(abs(error)), flush=True)
    if max(abs(error)) < 1e-10:
        lo, hi, target, lower, upper = trajectory(u, True)
        clear = min(
            np.linalg.norm(s.sol(t)[:3] - planet(t)[:3]) - radius
            for s in [lo, hi]
            for t in np.linspace(s.t[0], s.t[-1], 401)
        )
        if clear >= height - 1e-10:
            best = (lo, hi, target, lower, upper)
        break
    h = 1e-5
    jac = np.column_stack(
        [
            (objective(u + np.eye(6)[i] * h) - objective(u - np.eye(6)[i] * h)) / (2 * h)
            for i in range(6)
        ]
    )
    delta = np.linalg.lstsq(jac, -error, rcond=1e-12)[0]
    u += delta
    if not 0.305 < u[5] < 0.45 or not 0.02 < u[4] < 0.3:
        raise RuntimeError("Launch force bounds")
if best is None:
    raise RuntimeError("No safe staged launch candidate")
lo, hi, target, lower, upper = best
out = {
    "launch": launch,
    "split": split,
    "parking": parking,
    "spin": spin,
    "lowerAcceleration": float(u[5]),
    "upperAcceleration": float(u[4]),
    "lowerKeys": lower,
    "upperKeys": upper,
    "splitState": lo.y[:, -1].tolist(),
    "parkingState": hi.y[:, -1].tolist(),
    "residual": (hi.y[:, -1] - target).tolist(),
}
coast = solve_ivp(
    rhs,
    [parking, 19],
    hi.y[:, -1],
    method="DOP853",
    rtol=2e-12,
    atol=2e-13,
    max_step=0.02,
    dense_output=True,
)
ts = np.linspace(parking, 19, 2001)
ys = coast.sol(ts).T
clear = min(np.linalg.norm(y[:3] - planet(t)[:3]) - radius for t, y in zip(ts, ys, strict=True))
print(
    "parking coast clearance",
    clear,
    "rmax",
    max(np.linalg.norm(y[:3] - planet(t)[:3]) for t, y in zip(ts, ys, strict=True)),
    flush=True,
)
if clear < 0.02:
    raise RuntimeError("Parking coast too low")
out["departure"] = 19
out["departureState"] = coast.y[:, -1].tolist()
out["parkingClearance"] = float(clear)
Path("docs/design/libration-orbits/mission/launch-solution.json").write_text(
    json.dumps(out, indent=2) + "\n"
)
