"""Coherent insertion into unchanged downstream lunar orbit, with later handoff."""

import json
import math
from pathlib import Path

import numpy as np
from arrival_search import NONFUEL, A, B, moon
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
base = B["cutoffs"][-2]
origin = np.r_[[base["y"][i] for i in [0, 1, 3, 4]], base["propellant"]]
old = np.array([B["cutoffs"][-1]["y"][i] for i in [0, 1, 3, 4]])


def rhs(t, y):
    p = y[:2]
    q = moon(t) - p
    return np.r_[y[2:4], -p / np.linalg.norm(p) ** 3 + 0.03 * q / np.linalg.norm(q) ** 3, 0]


def reference_coasts():
    pre = solve_ivp(
        rhs,
        (base["t"], 29.0),
        origin,
        method="DOP853",
        rtol=3e-13,
        atol=3e-14,
        max_step=0.002,
        dense_output=True,
    )
    post = solve_ivp(
        rhs,
        (A["end"], 30.5),
        np.r_[old, B["cutoffs"][-1]["propellant"]],
        method="DOP853",
        rtol=3e-13,
        atol=3e-14,
        max_step=0.002,
        dense_output=True,
    )
    return pre, post


def run(x, end, pre, tight=False):
    start = x[4]
    first = x[0]
    last = first + x[1]
    angles = [first, first + x[1] * x[2], last]
    force = 24 * x[3]
    z = pre.sol(start)
    initial = z.copy()
    cuts = np.linspace(start, end, 3)
    trace = []
    for i in range(2):
        left, right = cuts[i : i + 2]

        def dyn(t, y, left=left, right=right, i=i):
            u = np.clip((t - left) / (right - left), 0, 1)
            angle = angles[i] + u * u * (3 - 2 * u) * (angles[i + 1] - angles[i])
            m = NONFUEL + y[4]
            actual = min(force, 3 * m)
            q = rhs(t, y)
            q[2:4] += actual / m * np.array([math.cos(angle), math.sin(angle)])
            q[4] = -actual / 8
            return q

        sol = solve_ivp(
            dyn,
            (left, right),
            z,
            method="DOP853",
            rtol=3e-13 if tight else 2e-9,
            atol=3e-14 if tight else 2e-11,
            max_step=0.001 if tight else 0.012,
        )
        trace.extend(zip(sol.t, sol.y.T))
        z = sol.y[:, -1]
    y = np.array([q for _, q in trace])
    metrics = {
        "minInertialSpeed": float(np.min(np.linalg.norm(y[:, 2:4], axis=1))),
        "minLunarRadius": float(min(np.linalg.norm(q[:2] - moon(t)) for t, q in trace)),
        "deltaV": float(8 * math.log((NONFUEL + initial[4]) / (NONFUEL + z[4]))),
        "fuelUsed": float(initial[4] - z[4]),
        "peakAcceleration": float(min(3, force / (NONFUEL + z[4]))),
        "totalTurn": abs(x[1]),
        "peakHeadingRate": float(3 * max(abs(np.diff(angles))) / (end - start)),
    }
    return z, metrics, [(float(t), q.tolist()) for t, q in trace], angles


def main():
    pre, post = reference_coasts()
    results = []
    for end, seedfirst in [(30.1, 2.0), (30.2, 1.8), (30.35, 1.6)]:
        target = post.sol(end)[:4]
        seed = np.array([seedfirst, -1.1, 0.5, 0.13, 29.65])
        lo = np.array([-0.5, -math.pi / 2, 0.1, 0.02, 29.2])
        hi = np.array([3.7, math.pi / 2, 0.9, 0.65, 29.816])

        def residual(x, tight=False, regularize=True, end=end, target=target):
            z, m, _, _ = run(x, end, pre, tight)
            r = list(1000 * (z[:4] - target))
            if regularize:
                r.extend(
                    [
                        0.005 * m["deltaV"],
                        0.005 * x[1],
                        0.3 * max(0, 0.1 - m["minInertialSpeed"]),
                    ]
                )
            return np.array(r)

        sol = least_squares(
            residual,
            seed,
            bounds=(lo, hi),
            max_nfev=90,
            diff_step=1e-5,
            xtol=1e-10,
            ftol=1e-10,
            gtol=1e-9,
        )
        sol = least_squares(
            lambda x: residual(x, True, False),
            sol.x,
            bounds=(lo, hi),
            max_nfev=60,
            diff_step=1e-6,
            xtol=1e-12,
            ftol=1e-12,
            gtol=1e-10,
        )
        z, m, trace, angles = run(sol.x, end, pre, True)
        candidate = {
            "start": float(sol.x[4]),
            "end": end,
            "parameters": sol.x.tolist(),
            "target": target.tolist(),
            "residual": (z[:4] - target).tolist(),
            "metrics": m,
            "arrival": z.tolist(),
            "arc": {
                "id": A["id"],
                "start": float(sol.x[4]),
                "end": end,
                "direction": [math.cos(angles[0]), math.sin(angles[0]), 0],
                "throttle": float(sol.x[3]),
                "steering": {
                    "kind": "spherical-smoothstep-v1",
                    "keys": [
                        {
                            "offset": float((end - sol.x[4]) * i / 2),
                            "direction": [math.cos(a), math.sin(a), 0],
                        }
                        for i, a in enumerate(angles)
                    ],
                },
            },
            "trace": trace,
        }
        results.append(candidate)
        (HERE / "arrival-coherent-candidates.json").write_text(json.dumps(results, indent=2) + "\n")
        print(
            json.dumps({k: v for k, v in candidate.items() if k not in ("trace", "arc")}),
            flush=True,
        )


if __name__ == "__main__":
    main()
