"""Continue the close-Selene symmetric ballistic branch; research only."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import root

N = np.sqrt(1.03 / 125)


def rhs(t, q):
    x, y, vx, vy = q
    p = np.array([x, y])
    d = np.array([5 - x, -y])
    a = -p / np.linalg.norm(p) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3
    return [vx, vy, a[0] + N * N * x + 2 * N * vy, a[1] + N * N * y - 2 * N * vx]


def impact(t, q):
    return min(np.linalg.norm(q[:2]) - 1.02, np.linalg.norm(np.asarray(q[:2]) - [5, 0]) - 0.23)


setattr(impact, "terminal", True)
rows = []
for grid in [np.linspace(1.7, 1.1, 13), np.linspace(1.7, 2.5, 17)]:
    last = np.array([0.7379305620145205, 47.651256371848746])
    for x in grid:
        calls = 0

        def residual(z):
            global calls
            calls += 1
            if calls > 40 or z[1] < 10 or z[1] > 90 or abs(z[0]) > 2:
                raise ValueError("budget")
            q = solve_ivp(
                rhs,
                (0, z[1]),
                [x, 0, 0, z[0]],
                method="DOP853",
                rtol=2e-11,
                atol=2e-13,
                max_step=0.15,
                events=impact,
            )
            if q.t[-1] != z[1]:
                raise ValueError("impact")
            return q.y[[1, 2], -1]

        try:
            z = root(residual, last, tol=1e-10, options={"maxfev": 38})
            if np.linalg.norm(residual(z.x)) > 1e-8:
                break
            last = z.x
            initial = np.array([x, 0, 0, z.x[0]])
            period = 2 * z.x[1]
            q = solve_ivp(
                rhs,
                (0, period),
                initial,
                method="DOP853",
                rtol=2.3e-13,
                atol=2e-15,
                max_step=0.05,
                dense_output=True,
                events=impact,
            )
            ts = np.linspace(0, period, 8193)
            ys = q.sol(ts).T
            rs = np.linalg.norm(ys[:, :2], axis=1)
            ms = np.linalg.norm(ys[:, :2] - [5, 0], axis=1)
            row = dict(
                x=float(x),
                initial=initial.tolist(),
                period=float(period),
                closure=float(np.linalg.norm(q.y[:, -1] - initial)),
                asterMin=float(rs.min()),
                asterMax=float(rs.max()),
                seleneMin=float(ms.min()),
                seleneEpoch=float(ts[np.argmin(ms)]),
            )
            rows.append(row)
            print(json.dumps(row), flush=True)
        except ValueError:
            break
Path(__file__).with_name("continuation.json").write_text(json.dumps(rows, indent=2) + "\n")
