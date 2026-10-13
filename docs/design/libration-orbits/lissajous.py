"""Finite center-motion boundary-value witness; no exact recurrence assumption."""

import json
from pathlib import Path

import numpy as np
from dynamics import rhs
from scipy.integrate import solve_bvp
from scipy.optimize import brentq

BASE = Path(__file__).parent
mu = 0.003
xL = brentq(lambda x: rhs(0, [x, 0, 0, 0, 0, 0], mu)[3], 1 - mu + 1e-6, 2)
s0 = np.array([xL, 0, 0, 0, 0, 0])
h = 1e-5
A = np.column_stack(
    [
        (np.array(rhs(0, s0 + np.eye(6)[i] * h, mu)) - np.array(rhs(0, s0 - np.eye(6)[i] * h, mu)))
        / (2 * h)
        for i in range(6)
    ]
)
values, vectors = np.linalg.eig(A.T)
left = vectors[:, np.argmax(values.real)].real
left /= np.linalg.norm(left)
B = A[3, 0]
values = np.linalg.eigvals(A)
w = max(e.imag for e in values)
vy = -0.07
z = 0.04
amp = vy * 2 / (B + w * w)
t = np.linspace(0, 7.5, 401)
vfreq = np.sqrt(-A[5, 2])
guess = np.array(
    [
        xL + amp * np.cos(w * t),
        -amp * (w * w + B) / (2 * w) * np.sin(w * t),
        z * np.cos(vfreq * t),
        -amp * w * np.sin(w * t),
        vy * np.cos(w * t),
        -z * vfreq * np.sin(vfreq * t),
    ]
)


def fun(t, y):
    return np.array(rhs(t, y, mu))


def bc(a, b):
    return np.array([a[1], a[3], a[5], a[2] - z, a[4] - vy, np.dot(left, b - s0)])


sol = solve_bvp(fun, bc, t, guess, tol=2e-10, max_nodes=12000)
if not sol.success:
    raise RuntimeError(sol.message)
y0 = sol.sol(0)
ys = sol.sol(np.linspace(0, 7.5, 3001))
print(
    "lissajous",
    y0,
    "residual",
    sol.rms_residuals.max(),
    "ranges",
    np.min(ys[:3], axis=1),
    np.max(ys[:3], axis=1),
    flush=True,
)
(BASE / "lissajous-solution.json").write_text(
    json.dumps(
        {
            "schemaVersion": 1,
            "mu": mu,
            "separation": 4,
            "rate": 0.125,
            "duration": 60,
            "rotatingState": y0.tolist(),
            "boundaryResidual": bc(y0, sol.sol(7.5)).tolist(),
            "meshNodes": len(sol.x),
            "maxResidual": float(sol.rms_residuals.max()),
            "period": float(2 * np.pi / w),
            "verticalPeriod": float(2 * np.pi / vfreq),
        },
        indent=2,
    )
    + "\n"
)
