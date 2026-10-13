"""Bounded two finite-burn parking-to-halo solve in physical inertial coordinates."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

BASE = Path(__file__).parent
m = 0.003
a = 4
n = 0.125
acc = 0.04
arrival = 14
p = json.loads((BASE / "orbit-solution.json").read_text())
x, y, z, vx, vy, vz = p["rotatingState"]
yr = np.array([a * x, a * y, a * z, a * n * (vx - y), a * n * (vy + x), a * n * vz])
c = np.cos(n * arrival)
s = np.sin(n * arrival)


def rot(y, theta):
    c = np.cos(theta)
    s = np.sin(theta)
    return np.array(
        [
            c * y[0] - s * y[1],
            s * y[0] + c * y[1],
            y[2],
            c * y[3] - s * y[4],
            s * y[3] + c * y[4],
            y[5],
        ]
    )


target = rot(yr, n * arrival)


def sources(t):
    c = np.cos(n * t)
    s = np.sin(n * t)
    return np.array([-a * m * c, -a * m * s, 0]), np.array([a * (1 - m) * c, a * (1 - m) * s, 0])


def initial(phase):
    r = 0.19
    speed = np.sqrt(m / r)
    return np.array(
        [
            a * (1 - m) + r * np.cos(phase),
            r * np.sin(phase),
            0,
            -speed * np.sin(phase),
            a * (1 - m) * n + speed * np.cos(phase),
            0,
        ]
    )


def direction(theta, phi):
    return np.array([np.cos(theta) * np.cos(phi), np.sin(theta) * np.cos(phi), np.sin(phi)])


def propagate(u, dense=False):
    phase, d0, theta0, phi0, d1, theta1, phi1 = u
    y = initial(phase)
    pieces = []
    for start, end, force in [
        (0, 1, np.zeros(3)),
        (1, 1 + d0, acc * direction(theta0, phi0)),
        (1 + d0, arrival - d1, np.zeros(3)),
        (arrival - d1, arrival, acc * direction(theta1, phi1)),
    ]:

        def rhs(t, y, force=force):
            b0, b1 = sources(t)
            r = y[:3] - b0
            q = y[:3] - b1
            return np.r_[
                y[3:],
                -(1 - m) * r / np.linalg.norm(r) ** 3 - m * q / np.linalg.norm(q) ** 3 + force,
            ]

        sol = solve_ivp(
            rhs,
            [start, end],
            y,
            method="DOP853",
            rtol=3e-9,
            atol=3e-10,
            max_step=0.15,
            dense_output=dense,
        )
        y = sol.y[:, -1]
        pieces.append(sol)
    return y, pieces


def objective(u):
    y, _ = propagate(u)
    return np.r_[(y[:3] - target[:3]), 4 * (y[3:] - target[3:])]


bounds = ([-np.pi, 0.1, -6, -1.5, 0.1, -6, -1.5], [np.pi, 5, 6, 1.5, 5, 6, 1.5])
best = None
for phase in [0, -1.5, 1.5, 3]:
    u = [phase, 2, 1.5, 0.7, 2, -1.5, -0.7]
    result = least_squares(
        objective, u, bounds=bounds, max_nfev=180, xtol=2e-11, ftol=2e-11, gtol=2e-11
    )
    error = np.max(np.abs(objective(result.x)))
    print(
        "candidate",
        phase,
        "error",
        error,
        "calls",
        result.nfev,
        "u",
        result.x,
        flush=True,
    )
    if error < 1e-7:
        _, pieces = propagate(result.x, True)
        clearance = min(
            np.linalg.norm(sol.sol(t)[:3] - sources(t)[1])
            for sol in pieces
            for t in np.linspace(sol.t[0], sol.t[-1], 301)
        )
        print("clearance", clearance, flush=True)
        if clearance > 0.105:
            best = result
            break
if best is None:
    raise RuntimeError("No bounded safe insertion candidate")
u = best.x
(BASE / "insertion-solution.json").write_text(
    json.dumps(
        {
            "initialState": initial(u[0]).tolist(),
            "arrival": arrival,
            "targetState": target.tolist(),
            "acceleration": acc,
            "burns": [
                {
                    "start": 1,
                    "end": float(1 + u[1]),
                    "direction": direction(u[2], u[3]).tolist(),
                },
                {
                    "start": float(arrival - u[4]),
                    "end": arrival,
                    "direction": direction(u[5], u[6]).tolist(),
                },
            ],
            "residual": objective(u).tolist(),
            "solveCalls": best.nfev,
        },
        indent=2,
    )
    + "\n"
)
