"""Bounded symmetric periodic-orbit search in the existing prescribed field.

Research candidates only: sampled clearance is not native safety admission.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import root

N = np.sqrt(1.03 / 125)
parser = argparse.ArgumentParser()
parser.add_argument("--family", choices=["search", "outer", "resonant"], default="search")
family = parser.parse_args().family
OUT = Path(__file__).with_name(family + ".json")
xs = [5.4, 5.7, 6.0, 6.5] if family == "outer" else [1.4, 1.7, 2.0, -1.4, -1.7, -2.0]
halves = {
    "search": [18.0, 27.0, 36.0],
    "outer": [12.0, 24.0, 40.0],
    "resonant": [65.0, 75.0, 103.0],
}[family]
factors = {
    "search": [0.85, 1.0],
    "outer": [-0.25, -0.5, -0.75],
    "resonant": [0.94, 0.98],
}[family]


def rhs(t, q):
    x, y, vx, vy = q
    p = np.array([x, y])
    d = np.array([5 - x, -y])
    a = -p / np.linalg.norm(p) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3
    return [vx, vy, a[0] + N * N * x + 2 * N * vy, a[1] + N * N * y - 2 * N * vx]


def impact(t, q):
    return min(np.linalg.norm(q[:2]) - 1.05, np.linalg.norm(np.asarray(q[:2]) - [5, 0]) - 0.25)


setattr(impact, "terminal", True)
rows = []
trials = 0
for x in xs:
    for ht in halves:
        for factor in factors:
            trials += 1
            calls = 0
            sign = np.sign(x)
            v = (
                factor
                if family == "outer"
                else sign * (np.sqrt(2 / abs(x) - 2 / (abs(x) + 6)) * factor - N * abs(x))
            )

            def residual(z):
                global calls
                calls += 1
                vy, end = z
                if (
                    calls > 50
                    or end < 8
                    or end > (135 if family == "resonant" else 65)
                    or abs(vy) > 2
                ):
                    raise ValueError("bounded trial")
                q = solve_ivp(
                    rhs,
                    (0, end),
                    [x, 0, 0, vy],
                    method="DOP853",
                    rtol=2e-9,
                    atol=2e-11,
                    max_step=0.25,
                    events=impact,
                )
                if q.t[-1] < end:
                    raise ValueError("impact")
                return q.y[[1, 2], -1]

            try:
                z = root(residual, [v, ht], tol=1e-9, options={"maxfev": 48})
                if np.linalg.norm(residual(z.x)) > 1e-7:
                    continue
                vy, half = z.x
                initial = np.array([x, 0, 0, vy])
                q = solve_ivp(
                    rhs,
                    (0, 2 * half),
                    initial,
                    method="DOP853",
                    rtol=2.3e-13,
                    atol=2e-15,
                    max_step=0.06,
                    dense_output=True,
                    events=impact,
                )
                if q.t[-1] < 2 * half:
                    continue
                ts = np.linspace(0, 2 * half, 4097)
                ys = q.sol(ts).T
                r = np.linalg.norm(ys[:, :2], axis=1)
                moon = np.linalg.norm(ys[:, :2] - [5, 0], axis=1)
                closure = float(np.linalg.norm(q.y[:, -1] - initial))
                if closure > 1e-6 or any(
                    abs(row["x"] - x) < 1e-5 and abs(row["vy"] - vy) < 1e-5 for row in rows
                ):
                    continue
                row = dict(
                    x=x,
                    vy=float(vy),
                    period=float(2 * half),
                    closure=closure,
                    asterMin=float(r.min()),
                    asterMax=float(r.max()),
                    seleneMin=float(moon.min()),
                    seleneEpoch=float(ts[np.argmin(moon)]),
                    initial=initial.tolist(),
                )
                rows.append(row)
                print(json.dumps(row), flush=True)
            except ValueError:
                pass
OUT.write_text(json.dumps(dict(trials=trials, candidates=rows), indent=2) + "\n")
