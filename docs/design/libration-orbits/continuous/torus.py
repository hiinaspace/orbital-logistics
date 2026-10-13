"""Small two-frequency survey reference; fitted residual, not a physical rail."""

import json
import sys
from pathlib import Path

import numpy as np
from scipy.linalg import eig
from scipy.optimize import brentq, least_squares

mu = 0.003
xL = brentq(
    lambda x: x - (1 - mu) * (x + mu) / abs(x + mu) ** 3 - mu * (x - 1 + mu) / abs(x - 1 + mu) ** 3,
    1 - mu + 1e-8,
    2,
)
B = 1 + (1 - mu) * 2 / (xL + mu) ** 3 + mu * 2 / (xL - 1 + mu) ** 3
D = 1 - (1 - mu) / (xL + mu) ** 3 - mu / (xL - 1 + mu) ** 3
M = np.array([[0, 0, 1, 0], [0, 0, 0, 1], [B, 0, 0, 2], [0, D, -2, 0]])
w1 = max(np.linalg.eigvals(M).imag)
w2 = np.sqrt(1 - D)
terms = []
for axis in range(3):
    for k in range(4):
        for ell in range(-3, 4):
            if k == 0 and ell < 0:
                continue
            if (axis == 2) != (abs(ell) % 2 == 1):
                continue
            if axis == 1 and k == ell == 0:
                continue
            terms.append((axis, k, ell))
dx = float(sys.argv[1]) if len(sys.argv) > 1 else 0.007
dz = float(sys.argv[2]) if len(sys.argv) > 2 else 0.025
fixed = {(0, 1, 0): dx, (2, 0, 1): dz}
free = [term for term in terms if term not in fixed]
ph = np.linspace(0, 2 * np.pi, 16, endpoint=False)
q, r = np.meshgrid(ph, ph)
q = q.ravel()
r = r.ravel()


def coeffs(u):
    return {**fixed, **dict(zip(free, u[:-2], strict=True))}


def evaluate(u):
    w1, w2 = u[-2:]
    pos = np.zeros((3, len(q)))
    vel = pos.copy()
    acc = pos.copy()
    pos[0] = xL
    for (axis, k, ell), c in coeffs(u).items():
        phase = k * q + ell * r
        freq = k * w1 + ell * w2
        v = np.sin(phase) if axis == 1 else np.cos(phase)
        d = np.cos(phase) if axis == 1 else -np.sin(phase)
        pos[axis] += c * v
        vel[axis] += c * freq * d
        acc[axis] -= c * freq**2 * v
    x, y, z = pos
    a = ((x + mu) ** 2 + y * y + z * z) ** 1.5
    b = ((x - 1 + mu) ** 2 + y * y + z * z) ** 1.5
    force = np.array(
        [
            2 * vel[1] + x - (1 - mu) * (x + mu) / a - mu * (x - 1 + mu) / b,
            -2 * vel[0] + y - (1 - mu) * y / a - mu * y / b,
            -(1 - mu) * z / a - mu * z / b,
        ]
    )
    return (acc - force).ravel()


u = np.array([-dx * (w1 * w1 + B) / (2 * w1) if t == (1, 1, 0) else 0 for t in free] + [w1, w2])
sol = least_squares(
    evaluate,
    u,
    bounds=([-0.08] * len(free) + [1.2, 1.2], [0.08] * len(free) + [2.5, 2.5]),
    max_nfev=200,
    gtol=1e-13,
    ftol=1e-13,
    xtol=1e-13,
)
res = evaluate(sol.x)
print(
    "calls",
    sol.nfev,
    "frequencies",
    sol.x[-2:],
    "max residual",
    max(abs(res)),
    flush=True,
)
d = {
    "schemaVersion": 1,
    "mu": mu,
    "separation": 4,
    "rate": 0.125,
    "xL": xL,
    "frequencies": sol.x[-2:].tolist(),
    "terms": [
        {"axis": a, "k": k, "l": ell, "coefficient": float(c)}
        for (a, k, ell), c in coeffs(sol.x).items()
    ],
    "maxCollocationResidual": float(max(abs(res))),
    "solveCalls": sol.nfev,
}
Path("docs/design/libration-orbits/continuous/reference.json").write_text(
    json.dumps(d, indent=2) + "\n"
)
# Linear mode projections only guide a paid controller; they do not alter states.

A = np.zeros((6, 6))
A[:3, 3:] = np.eye(3)
A[3, 0] = B
A[4, 1] = D
A[5, 2] = D - 1
A[3, 4] = 2
A[4, 3] = -2
values, left, right = eig(A, left=True, right=True)
for name, i in [
    ("unstable", np.argmax(values.real)),
    ("stable", np.argmin(values.real)),
]:
    v = right[:, i].real
    ell = left[:, i].real
    ell /= np.dot(ell, v)
    d[name + "Left"] = ell.tolist()
    d[name + "Right"] = v.tolist()
d["growth"] = float(max(values.real))
Path("docs/design/libration-orbits/continuous/reference.json").write_text(
    json.dumps(d, indent=2) + "\n"
)
