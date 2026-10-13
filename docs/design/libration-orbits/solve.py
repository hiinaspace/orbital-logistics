"""Bounded offline spatial shooting; no production propagation or hand-drawn rails."""

import json
from pathlib import Path

import numpy as np
from dynamics import propagate
from scipy.optimize import root

BASE = Path(__file__).parent
seed = json.loads((BASE / "catalog-seeds.json").read_text())
row = np.array(seed["data"][0], dtype=float)
mu = float(seed["system"]["mass_ratio"])


u = row[[0, 4, 7]].copy()
u[2] /= 2
z0 = row[2]
steps = []
for m in np.linspace(mu, 0.003, 20):

    def objective(v, m=m):
        if not 0.5 < v[2] < 4:
            return np.ones(3) * 100
        return propagate([v[0], 0, z0, 0, v[1], 0], v[2], m).y[[1, 3, 5], -1]

    result = root(objective, u, tol=2e-10)
    residual = np.max(np.abs(objective(result.x)))
    if residual > 1e-9 or not result.x[0] > 1 - m:
        raise RuntimeError((m, result.message, residual, result.x))
    u = result.x
    steps.append({"mu": float(m), "residual": float(residual), "solveCalls": result.nfev})
y0 = [u[0], 0, z0, 0, u[1], 0]
period = 2 * u[2]
sol = propagate(y0, 7.5, 0.003, True)
ts = np.linspace(0, 7.5, 3001)
ys = sol.sol(ts)
print(
    "halo",
    y0,
    "period",
    period,
    "closure",
    np.max(abs(propagate(y0, period, 0.003).y[:, -1] - y0)),
    flush=True,
)
print(
    "ranges",
    np.min(ys[:3], axis=1),
    np.max(ys[:3], axis=1),
    "planet clearance",
    np.min(np.linalg.norm(ys[:3] - np.array([0.997, 0, 0])[:, None], axis=0)),
    flush=True,
)
(BASE / "orbit-solution.json").write_text(
    json.dumps(
        {
            "schemaVersion": 1,
            "mu": 0.003,
            "separation": 4,
            "rate": 0.125,
            "duration": 60,
            "rotatingState": y0,
            "period": float(period),
            "closure": (propagate(y0, period, 0.003).y[:, -1] - y0).tolist(),
            "continuation": steps,
        },
        indent=2,
    )
    + "\n"
)
