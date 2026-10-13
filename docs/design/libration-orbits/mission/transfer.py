"""Actual parking endpoint to halo, no phasing snap or initial-state retarget."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

BASE = Path(__file__).parent
launch = json.loads((BASE / "launch-solution.json").read_text())
halo = json.loads((BASE.parent / "orbit-solution.json").read_text())
m = 0.003
a = 4
n = 0.125
acc = launch["upperAcceleration"]
arrival = 33
start = 19
initial = launch["departureState"]
x, y, z, vx, vy, vz = halo["rotatingState"]
rot = np.array([a * x, a * y, a * z, a * n * (vx - y), a * n * (vy + x), a * n * vz])
c = np.cos(n * arrival)
s = np.sin(n * arrival)
target = np.array(
    [
        c * rot[0] - s * rot[1],
        s * rot[0] + c * rot[1],
        rot[2],
        c * rot[3] - s * rot[4],
        s * rot[3] + c * rot[4],
        rot[5],
    ]
)


def direction(theta, phi):
    return np.array([np.cos(theta) * np.cos(phi), np.sin(theta) * np.cos(phi), np.sin(phi)])


def rhs(t, y):
    c = np.cos(n * t)
    s = np.sin(n * t)
    p = np.array([-a * m * c, -a * m * s, 0])
    b = np.array([a * (1 - m) * c, a * (1 - m) * s, 0])
    r = y[:3] - p
    q = y[:3] - b
    return np.r_[y[3:], -(1 - m) * r / np.linalg.norm(r) ** 3 - m * q / np.linalg.norm(q) ** 3]


def propagate(u, dense=False):
    d0, theta0, phi0, d1, theta1, phi1 = u
    y = initial
    pieces = []
    for lo, hi, force in [
        (start, start + 1, np.zeros(3)),
        (start + 1, start + 1 + d0, acc * direction(theta0, phi0)),
        (start + 1 + d0, arrival - d1, np.zeros(3)),
        (arrival - d1, arrival, acc * direction(theta1, phi1)),
    ]:
        sol = solve_ivp(
            lambda t, y, force=force: rhs(t, y) + np.r_[np.zeros(3), force],
            [lo, hi],
            y,
            method="DOP853",
            rtol=3e-10,
            atol=3e-11,
            max_step=0.1,
            dense_output=dense,
        )
        y = sol.y[:, -1]
        pieces.append(sol)
    return y, pieces


def objective(u):
    y, _ = propagate(u)
    return np.r_[y[:3] - target[:3], 4 * (y[3:] - target[3:])]


# Select a real later parking passage aligned with the proved finite departure.
park = solve_ivp(
    rhs,
    [launch["parking"], 32],
    launch["parkingState"],
    method="DOP853",
    rtol=2e-13,
    atol=2e-14,
    max_step=0.02,
    dense_output=True,
)
times = np.linspace(19, 32, 1301)


def angle(t):
    q = park.sol(t)[:3] - np.array([a * (1 - m) * np.cos(n * t), a * (1 - m) * np.sin(n * t), 0])
    c = np.cos(n * t)
    s = np.sin(n * t)
    return np.arctan2(-s * q[0] + c * q[1], c * q[0] + s * q[1])


start = float(min(times, key=lambda t: abs(np.angle(np.exp(1j * (angle(t) + 0.28906915))))))
arrival = start + 14
initial = park.sol(start)
c = np.cos(n * arrival)
s = np.sin(n * arrival)
target = np.array(
    [
        c * rot[0] - s * rot[1],
        s * rot[0] + c * rot[1],
        rot[2],
        c * rot[3] - s * rot[4],
        s * rot[3] + c * rot[4],
        rot[5],
    ]
)
print(
    "actual departure window",
    start,
    "angle",
    angle(start),
    "arrival",
    arrival,
    flush=True,
)
best = None
base = n * start
for guess in [
    [1.8, 0.967 + base, 0.74, 0.7, 3.434 + base, 0.9],
    [2, 0.8 + base, 0.8, 1, 3.5 + base, 0.8],
    [2.5, 1.1 + base, 0.7, 1.1, 3.3 + base, 0.7],
]:
    sol = least_squares(
        objective,
        guess,
        bounds=([0.05, -12, -1.5, 0.05, -12, -1.5], [5, 12, 1.5, 5, 12, 1.5]),
        max_nfev=120,
        diff_step=1e-5,
        ftol=1e-12,
        xtol=1e-12,
        gtol=1e-12,
    )
    error = max(abs(objective(sol.x)))
    print("transfer", error, sol.x, flush=True)
    if error < 1e-7:
        y, pieces = propagate(sol.x, True)
        clear = min(
            np.linalg.norm(
                p.sol(t)[:3]
                - np.array([a * (1 - m) * np.cos(n * t), a * (1 - m) * np.sin(n * t), 0])
            )
            - 0.1
            for p in pieces
            for t in np.linspace(p.t[0], p.t[-1], 401)
        )
        print("transfer clearance", clear, flush=True)
        if clear > 0.02:
            best = sol.x
            break
if best is None:
    raise RuntimeError("No safe transfer candidate")
u = best
for i in range(8):
    e = objective(u)
    if max(abs(e)) < 1e-10:
        break
    h = 1e-5
    J = np.column_stack(
        [
            (objective(u + np.eye(6)[k] * h) - objective(u - np.eye(6)[k] * h)) / (2 * h)
            for k in range(6)
        ]
    )
    u += np.linalg.solve(J, -e)
d0, theta0, phi0, d1, theta1, phi1 = u
(BASE / "transfer-solution.json").write_text(
    json.dumps(
        {
            "departure": start,
            "arrival": arrival,
            "acceleration": acc,
            "target": target.tolist(),
            "residual": objective(u).tolist(),
            "burns": [
                {
                    "start": start + 1,
                    "end": float(start + 1 + d0),
                    "direction": direction(theta0, phi0).tolist(),
                },
                {
                    "start": float(arrival - d1),
                    "end": arrival,
                    "direction": direction(theta1, phi1).tolist(),
                },
            ],
        },
        indent=2,
    )
    + "\n"
)
