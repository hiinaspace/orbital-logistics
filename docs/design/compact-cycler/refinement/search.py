"""Bounded carrier coast branch search; candidate filtering only, not admission."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq, root

N = np.sqrt(1.03 / 125)
R = brentq(lambda x: N * N * x - 1 / x**2 - 0.03 / (x - 5) ** 2, 5.3, 7)


def rot(y, a):
    c, s = np.cos(a), np.sin(a)
    return np.array(
        [
            c * y[0] - s * y[1],
            s * y[0] + c * y[1],
            c * y[2] - s * y[3],
            s * y[2] + c * y[3],
        ]
    )


def moon(t):
    return 5 * np.array([np.cos(N * t), np.sin(N * t)])


def rhs(t, y):
    d = moon(t) - y[:2]
    return np.r_[y[2:], -y[:2] / np.linalg.norm(y[:2]) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3]


def impact(t, y):
    return min(np.linalg.norm(y[:2]) - 1.05, np.linalg.norm(y[:2] - moon(t)) - 0.25)


setattr(impact, "terminal", True)
rows = []
for D in [40.0, 52.0, 64.0, 76.0]:
    target = rot([R, 0, 0, N * R], N * D)
    seen = []
    for vr, vt in [
        (-0.1, 0.2),
        (-0.3, 0.2),
        (-0.5, 0.2),
        (-0.1, 0.35),
        (-0.3, 0.35),
        (-0.5, 0.35),
        (-0.1, 0.45),
        (-0.3, 0.45),
    ]:
        calls = 0

        def shot(v):
            global calls
            calls += 1
            if calls > 45:
                raise ValueError("call budget")
            q = solve_ivp(
                rhs,
                (0, D),
                [R, 0, *v],
                method="DOP853",
                rtol=2e-9,
                atol=2e-11,
                max_step=0.5,
                events=impact,
                dense_output=True,
            )
            return q

        def residual(v):
            q = shot(v)
            return q.y[:2, -1] - target[:2]

        try:
            z = root(residual, [vr, vt], tol=1e-8, options={"maxfev": 40})
            q = shot(z.x)
            if (
                q.t[-1] != D
                or np.linalg.norm(q.y[:2, -1] - target[:2]) > 1e-6
                or any(np.linalg.norm(z.x - v) < 0.001 for v in seen)
            ):
                continue
            seen.append(z.x)
            ts = np.linspace(0, D, 1025)
            ys = q.sol(ts).T
            peri = np.linalg.norm(ys[:, :2], axis=1).min()
            mclear = min(np.linalg.norm(y[:2] - moon(t)) for t, y in zip(ts, ys))
            cost = np.linalg.norm(z.x - [0, N * R]) + np.linalg.norm(q.y[2:, -1] - target[2:])
            row = dict(
                duration=D,
                initial=[R, 0, *z.x],
                final=q.y[:, -1].tolist(),
                peri=float(peri),
                moon=float(mclear),
                dv=float(cost),
                periTime=float(ts[np.argmin(np.linalg.norm(ys[:, :2], axis=1))]),
            )
            rows.append(row)
            print(row, flush=True)
        except ValueError:
            pass
Path("docs/design/compact-cycler/refinement/coasts.json").write_text(
    json.dumps(rows, indent=2) + "\n"
)
