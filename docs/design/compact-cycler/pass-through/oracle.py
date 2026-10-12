"""Independent uninterrupted three-cycle DOP853 witness in rotating equations."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

HERE = Path(__file__).parent
N = np.sqrt(1.03 / 125)
c = json.loads((HERE / "native.json").read_text())["candidate"]


def rhs(t, q):
    x, y, vx, vy = q
    p = np.array([x, y])
    d = np.array([5 - x, -y])
    a = -p / np.linalg.norm(p) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3
    return [vx, vy, a[0] + N * N * x + 2 * N * vy, a[1] + N * N * y - 2 * N * vx]


ts = np.linspace(0, 3 * c["period"], 385)
q = solve_ivp(
    rhs,
    (0, ts[-1]),
    c["initial"],
    method="DOP853",
    rtol=2.3e-14,
    atol=2e-16,
    max_step=0.04,
    t_eval=ts,
)
assert q.success
rows = []
for t, (x, y, vx, vy) in zip(q.t, q.y.T):
    C, S = np.cos(N * t), np.sin(N * t)
    Vx, Vy = vx - N * y, vy + N * x
    rows.append(
        [
            float(t),
            float(C * x - S * y),
            float(S * x + C * y),
            0,
            float(C * Vx - S * Vy),
            float(S * Vx + C * Vy),
            0,
        ]
    )
(HERE / "oracle.json").write_text(
    json.dumps(dict(candidate=c, rows=rows, work=q.nfev), indent=2) + "\n"
)
