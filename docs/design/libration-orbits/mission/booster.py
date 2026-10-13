"""Bounded same-pad booster return; immutable launch checkpoint seed."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

BASE = Path(__file__).parent
launch = json.loads((BASE / "launch-solution.json").read_text())
a = 4
m = 0.003
n = 0.125
spin = launch["spin"]
end = 6.0
acc = launch["lowerAcceleration"]
start = launch["split"]
initial = launch["splitState"]


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
    c = np.cos(spin * t)
    s = np.sin(spin * t)
    r = 0.100001
    return planet(t) + np.array([r * c, r * s, 0, -r * spin * s, r * spin * c, 0])


def rhs(t, y):
    b = planet(t)
    c = np.cos(n * t)
    s = np.sin(n * t)
    p = np.array([-a * m * c, -a * m * s, 0])
    r = y[:3] - p
    q = y[:3] - b[:3]
    return np.r_[y[3:], -(1 - m) * r / np.linalg.norm(r) ** 3 - m * q / np.linalg.norm(q) ** 3]


def simulate(u, dense=False):
    d0, theta0, d1, theta1 = u
    y = initial
    pieces = []
    for lo, hi, force in [
        (start, start + d0, acc * np.array([np.cos(theta0), np.sin(theta0), 0])),
        (start + d0, end - d1, np.zeros(3)),
        (end - d1, end, acc * np.array([np.cos(theta1), np.sin(theta1), 0])),
    ]:
        sol = solve_ivp(
            lambda t, y, force=force: rhs(t, y) + np.r_[np.zeros(3), force],
            [lo, hi],
            y,
            method="DOP853",
            rtol=2e-11,
            atol=2e-12,
            max_step=0.02,
            dense_output=dense,
        )
        y = sol.y[:, -1]
        pieces.append(sol)
    return y, pieces


target = support(end)


def objective(u):
    y, _ = simulate(u)
    return (y - target)[[0, 1, 3, 4]] * np.array([1, 1, 2, 2])


best = None
for guess in [[0.3, 2.4, 1, 1.2], [0.5, 2.8, 1.2, 1.2], [0.2, 1.8, 1.5, 1.5]]:
    sol = least_squares(
        objective,
        guess,
        bounds=([0.05, -3, 0.2, -3], [1.2, 6, 2.5, 6]),
        max_nfev=120,
        diff_step=1e-5,
        ftol=1e-11,
        xtol=1e-11,
        gtol=1e-11,
    )
    error = max(abs(objective(sol.x)))
    print("booster", error, sol.x, flush=True)
    if error < 1e-7:
        _, pieces = simulate(sol.x, True)
        clear = min(
            np.linalg.norm(p.sol(t)[:3] - planet(t)[:3]) - 0.1
            for p in pieces
            for t in np.linspace(p.t[0], p.t[-1], 201)
        )
        print("clearance", clear, flush=True)
        if clear >= 9e-7:
            best = sol.x
            break
if best is None:
    raise RuntimeError("No safe booster return")
# Refine the frozen four controls with a stable numerical Jacobian.
u = best
for i in range(8):
    e = objective(u)
    if max(abs(e)) < 1e-10:
        break
    h = 1e-5
    J = np.column_stack(
        [
            (objective(u + np.eye(4)[k] * h) - objective(u - np.eye(4)[k] * h)) / (2 * h)
            for k in range(4)
        ]
    )
    u += np.linalg.solve(J, -e)
d0, theta0, d1, theta1 = u
out = {
    "land": end,
    "acceleration": acc,
    "residual": objective(u).tolist(),
    "burns": [
        {
            "start": start,
            "end": float(start + d0),
            "direction": [float(np.cos(theta0)), float(np.sin(theta0)), 0],
        },
        {
            "start": float(end - d1),
            "end": end,
            "direction": [float(np.cos(theta1)), float(np.sin(theta1)), 0],
        },
    ],
}
(BASE / "booster-solution.json").write_text(json.dumps(out, indent=2) + "\n")
