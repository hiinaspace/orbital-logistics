"""Bounded smooth lunar-insertion search. Writes candidates; no production edits."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
B = json.loads((HERE / "arrival-baseline.json").read_text())
D = B["fixture"]
A = D["programs"]["orbiterOutbound"][-1]
RATE = D["world"]["bodies"][1]["rail"]["rate"]
END = A["end"]
NONFUEL = (
    D["hardware"]["orbiter"]["dryMass"]
    + D["hardware"]["lander"]["dryMass"]
    + D["hardware"]["lander"]["propellant"]
)
TARGET = np.array([B["cutoffs"][-1]["y"][i] for i in [0, 1, 3, 4]])


def moon(t):
    a = D["world"]["bodies"][1]["rail"]["phase"] + RATE * t
    return 5 * np.array([math.cos(a), math.sin(a)])


def run(x, start, tight=False):
    row = next(r for r in B["cutoffs"] if r["t"] == start)
    initial = np.r_[[row["y"][i] for i in [0, 1, 3, 4]], row["propellant"]]
    angles = x[:4]
    force = 24 * x[4]
    cuts = np.linspace(start, END, 4)
    z = initial
    tt = []
    zz = []
    for i in range(3):
        left, right = cuts[i : i + 2]

        def rhs(t, y, left=left, right=right, i=i):
            u = np.clip((t - left) / (right - left), 0, 1)
            f = u * u * (3 - 2 * u)
            a = angles[i] + f * (angles[i + 1] - angles[i])
            m = NONFUEL + y[4]
            p = y[:2]
            q = moon(t) - p
            g = (
                -p / max(np.linalg.norm(p), 1e-8) ** 3
                + 0.03 * q / max(np.linalg.norm(q), 1e-8) ** 3
            )
            actual = min(force, 3 * m)
            return np.r_[
                y[2:4],
                g + actual / m * np.array([math.cos(a), math.sin(a)]),
                -actual / 8,
            ]

        sol = solve_ivp(
            rhs,
            (left, right),
            z,
            method="DOP853",
            rtol=3e-13 if tight else 2e-9,
            atol=3e-14 if tight else 2e-11,
            max_step=0.001 if tight else 0.01,
        )
        tt.extend(sol.t)
        zz.extend(sol.y.T)
        z = sol.y[:, -1]
    y = np.array(zz)
    r = np.array([np.linalg.norm(q[:2] - moon(t)) for t, q in zip(tt, y)])
    return (
        z,
        {
            "minInertialSpeed": float(np.min(np.linalg.norm(y[:, 2:4], axis=1))),
            "minLunarRadius": float(min(r)),
            "deltaV": float(8 * math.log((NONFUEL + initial[4]) / (NONFUEL + z[4]))),
            "fuelUsed": float(initial[4] - z[4]),
            "peakAcceleration": float(min(3, force / (NONFUEL + z[4]))),
            "totalTurn": float(sum(abs(np.diff(angles)))),
        },
        list(zip(tt, [q.tolist() for q in y])),
    )


def main():
    results = []
    for start in [29.7, 29.6, 29.5]:
        seed = np.r_[
            np.linspace(2.7400007, -0.29129, 4),
            min(0.7, 5.005 * 0.32246 / (24 * (END - start))),
        ]

        def residual(x, regularize=True, tight=False, start=start):
            z, m, _ = run(x, start, tight)
            r = list(1000 * (z[:4] - TARGET))
            if regularize:
                r += list(0.01 * np.diff(x[:4])) + [
                    0.001 * m["deltaV"],
                    0.1 * max(0, 0.10 - m["minInertialSpeed"]),
                ]
            return np.array(r)

        lo = np.r_[[-1.5] * 4, 0.01]
        hi = np.r_[[4.5] * 4, 0.95]
        sol = least_squares(
            residual,
            seed,
            bounds=(lo, hi),
            max_nfev=70,
            diff_step=1e-5,
            ftol=1e-10,
            xtol=1e-10,
            gtol=1e-9,
        )
        sol = least_squares(
            lambda x: residual(x, False, True),
            sol.x,
            bounds=(lo, hi),
            max_nfev=40,
            diff_step=1e-6,
            ftol=1e-12,
            xtol=1e-12,
            gtol=1e-10,
        )
        z, metrics, trace = run(sol.x, start, True)
        candidate = {
            "start": start,
            "end": END,
            "parameters": sol.x.tolist(),
            "residual": (z[:4] - TARGET).tolist(),
            "metrics": metrics,
            "arrival": z.tolist(),
            "arc": {
                "id": A["id"],
                "start": start,
                "end": END,
                "direction": [math.cos(sol.x[0]), math.sin(sol.x[0]), 0],
                "throttle": float(sol.x[4]),
                "steering": {
                    "kind": "spherical-smoothstep-v1",
                    "keys": [
                        {
                            "offset": float((END - start) * i / 3),
                            "direction": [math.cos(a), math.sin(a), 0],
                        }
                        for i, a in enumerate(sol.x[:4])
                    ],
                },
            },
            "trace": trace,
        }
        results.append(candidate)
        (HERE / "arrival-candidates.json").write_text(json.dumps(results, indent=2) + "\n")
        print(
            json.dumps({k: v for k, v in candidate.items() if k not in ("trace", "arc")}),
            flush=True,
        )


if __name__ == "__main__":
    main()
