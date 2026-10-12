"""Disposable coast endpoint/low-thrust staging search."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq, root

n = np.sqrt(1.03 / 125)
beacon = brentq(lambda x: n * n * x - 1 / x**2 - 0.03 / (x - 5) ** 2, 5.3, 7)


def rot(y, a):
    c, s = np.cos(a), np.sin(a)
    return np.array(
        [c * y[0] - s * y[1], s * y[0] + c * y[1], c * y[2] - s * y[3], s * y[2] + c * y[3]]
    )


def g(t, p):
    d = 5 * np.array([np.cos(n * t), np.sin(n * t)]) - p
    return -p / np.linalg.norm(p) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3


results = []
for r in [5.8, 6.0, 6.2, 6.4]:
    for offset in [0.04, 0.0, -0.04]:
        a0 = n * 5 + offset
        a1 = n * 59 - offset
        p0 = r * np.array([np.cos(a0), np.sin(a0)])
        p1 = r * np.array([np.cos(a1), np.sin(a1)])
        calls = 0

        def shoot(v, full=False):
            global calls
            calls += 1
            s = solve_ivp(
                lambda t, y: np.r_[y[2:], g(t, y[:2])],
                (5, 59),
                np.r_[p0, v],
                method="DOP853",
                rtol=2e-10,
                atol=2e-12,
                max_step=0.5,
                dense_output=True,
            )
            return s if full else s.y[:2, -1] - p1

        seed = rot([0, 0, 0.234, 0.293], a0)[2:]
        z = root(shoot, seed, tol=1e-9, options={"maxfev": 40})
        if not z.success or np.linalg.norm(shoot(z.x)) > 1e-7:
            continue
        s = shoot(z.x, True)
        ts = np.linspace(5, 59, 1025)
        ys = s.sol(ts).T
        peri = float(np.linalg.norm(ys[:, :2], axis=1).min())
        moon = float(
            min(
                np.linalg.norm(y[:2] - 5 * np.array([np.cos(n * t), np.sin(n * t)]))
                for y, t in zip(ys, ts)
            )
        )
        if peri < 1.3 or moon < 0.3:
            continue
        for h in [5.0, 6.0, 7.0, 8.0]:
            shift = h - 4
            begin = 1
            end = h + 1
            y0 = rot([beacon, 0, 0, n * beacon], n * begin)
            y1 = rot(s.y[:, 0], n * shift)
            dt = end - begin
            c = np.zeros((6, 2))
            c[0] = y0[:2]
            c[1] = dt * y0[2:]
            c[2] = dt * dt * g(begin, y0[:2]) / 2
            c[3:] = np.linalg.solve(
                [[1, 1, 1], [3, 4, 5], [6, 12, 20]],
                [
                    y1[:2] - c[:3].sum(0),
                    dt * y1[2:] - c[1] - 2 * c[2],
                    dt * dt * g(end, y1[:2]) - 2 * c[2],
                ],
            )
            ns = []
            clear = []
            for t in np.linspace(begin, end, 257):
                u = (t - begin) / dt
                p = sum(c[i] * u**i for i in range(6))
                a = sum(i * (i - 1) * c[i] * u ** (i - 2) for i in range(2, 6)) / dt**2
                ns.append(np.linalg.norm(a - g(t, p)))
                clear.append(np.linalg.norm(p - 5 * np.array([np.cos(n * t), np.sin(n * t)])))
            row = dict(
                radius=r,
                offset=offset,
                h=h,
                peri=peri,
                moon=moon,
                peak=float(max(ns)),
                dv=float(np.trapezoid(ns, np.linspace(begin, end, 257))),
                burnMoonClearance=float(min(clear)),
                start=s.y[:, 0].tolist(),
                end=s.y[:, -1].tolist(),
            )
            print({k: v for k, v in row.items() if k not in ["start", "end"]}, flush=True)
            if row["peak"] < 0.145 and row["burnMoonClearance"] > 0.3 and peri < 3.8:
                results.append(row)
Path("docs/design/compact-cycler/refined-candidates.json").write_text(
    json.dumps(results, indent=2) + "\n"
)
