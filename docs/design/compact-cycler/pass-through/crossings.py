"""Bounded axis-crossing shooting; exclude impacts and root discontinuities."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

N = np.sqrt(1.03 / 125)


def rhs(t, q):
    x, y, vx, vy = q
    p = np.array([x, y])
    d = np.array([5 - x, -y])
    a = -p / np.linalg.norm(p) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3
    return [vx, vy, a[0] + N * N * x + 2 * N * vy, a[1] + N * N * y - 2 * N * vx]


def impact(t, q):
    return min(np.linalg.norm(q[:2]) - 1.05, np.linalg.norm(np.asarray(q[:2]) - [5, 0]) - 0.25)


def axis(t, q):
    return q[1]


setattr(impact, "terminal", True)
rows = []
calls = 0
for x in [5.4, 5.7, 6.0, 6.5]:

    def shot(v):
        global calls
        calls += 1
        if calls > 450:
            raise ValueError("global work budget")
        q = solve_ivp(
            rhs,
            (0, 80),
            [x, 0, 0, v],
            method="DOP853",
            rtol=1e-10,
            atol=1e-12,
            max_step=0.12,
            events=[axis, impact],
        )
        return [(t, y) for t, y in zip(q.t_events[0], q.y_events[0]) if t > 1e-5]

    grid = np.linspace(-0.75, -0.16, 41)
    samples = [shot(v) for v in grid]
    for index in range(3):
        for a, b, left, right in zip(grid[:-1], grid[1:], samples[:-1], samples[1:]):
            if (
                len(left) <= index
                or len(right) <= index
                or left[index][1][2] * right[index][1][2] >= 0
            ):
                continue

            def residual(v):
                crossings = shot(v)
                if len(crossings) <= index:
                    raise ValueError("crossing disappeared")
                return crossings[index][1][2]

            try:
                v = brentq(residual, a, b, xtol=1e-13, maxiter=30)
                crosses = shot(v)
                half = crosses[index][0]
                if half > 75 or abs(residual(v)) > 1e-8:
                    continue
                initial = np.array([x, 0, 0, v])
                q = solve_ivp(
                    rhs,
                    (0, 2 * half),
                    initial,
                    method="DOP853",
                    rtol=2.3e-13,
                    atol=2e-15,
                    max_step=0.05,
                    dense_output=True,
                    events=impact,
                )
                if q.t[-1] < 2 * half:
                    continue
                ts = np.linspace(0, 2 * half, 8193)
                ys = q.sol(ts).T
                rs = np.linalg.norm(ys[:, :2], axis=1)
                ms = np.linalg.norm(ys[:, :2] - [5, 0], axis=1)
                closure = float(np.linalg.norm(q.y[:, -1] - initial))
                if closure > 1e-6:
                    continue
                row = dict(
                    initial=initial.tolist(),
                    period=float(2 * half),
                    closure=closure,
                    asterMin=float(rs.min()),
                    asterMax=float(rs.max()),
                    seleneMin=float(ms.min()),
                    seleneEpoch=float(ts[np.argmin(ms)]),
                )
                rows.append(row)
                print(json.dumps(row), flush=True)
            except (ValueError, RuntimeError):
                pass
Path(__file__).with_name("crossings.json").write_text(
    json.dumps(dict(calls=calls, candidates=rows), indent=2) + "\n"
)
