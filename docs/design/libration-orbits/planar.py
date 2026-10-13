"""Internal Lyapunov shooting regression in the new accelerating binary."""

import json
from pathlib import Path

import numpy as np
from dynamics import propagate, rhs
from scipy.optimize import brentq, root

m = 0.003
xL = brentq(lambda x: rhs(0, [x, 0, 0, 0, 0, 0], m)[3], 1 - m + 1e-6, 2)
h = 1e-5
y = np.array([xL, 0, 0, 0, 0, 0])
A = np.column_stack(
    [
        (np.array(rhs(0, y + np.eye(6)[i] * h, m)) - np.array(rhs(0, y - np.eye(6)[i] * h, m)))
        / (2 * h)
        for i in range(6)
    ]
)
w = max(np.linalg.eigvals(A).imag)
x = xL + 0.008
v = -(w * w + A[3, 0]) * 0.008 / 2


def objective(u):
    return propagate([x, 0, 0, 0, u[0], 0], u[1], m).y[[1, 3], -1]


sol = root(objective, [v, np.pi / w], tol=1e-11)
y0 = [x, 0, 0, 0, sol.x[0], 0]
closure = np.max(np.abs(propagate(y0, 2 * sol.x[1], m).y[:, -1] - y0))
if closure > 1e-9:
    raise RuntimeError((sol.message, closure))
d = {
    "initialRotatingState": y0,
    "period": float(2 * sol.x[1]),
    "closure": float(closure),
    "calls": sol.nfev,
}
Path("docs/design/libration-orbits/planar-solution.json").write_text(json.dumps(d, indent=2) + "\n")
print(d)
