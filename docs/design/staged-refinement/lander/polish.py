"""Constrained endpoint polish for the selected prograde timing branch."""

import json
import math
from pathlib import Path

import numpy as np
import search
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
prior = json.loads((HERE / "phase-candidates.json").read_text())


def evaluate(x, tight=False, trace=False):
    lift, dock = x[:2]
    p = x[2:]
    ascent, brake = search.family(p, lift, dock, 1)
    result = search.run(lift, dock, p[5], p[6], ascent, brake, tight=tight, trace=trace)
    return result, ascent, brake


def residual(x):
    try:
        result, ascent, brake = evaluate(x)
        turns = result["totalTurnRadians"]
        # Endpoint is prioritized; physical/aesthetic constraints remain in
        # every pass and never disappear for a terminal-only final fit.
        return np.r_[
            1e5 * np.array(result["residual"]),
            100 * max(0.0, result["radialOvershoot"] - 0.03),
            100 * max(0.0, 0.005 - result["coastAngularMomentumMin"]),
            100 * max(0.0, 0.000005 - result["clearance"]),
            10 * np.maximum(0.0, np.array(turns) - 2 * math.pi / 3),
            10 * np.maximum(0.0, np.abs(np.diff(ascent)) - math.pi / 3),
            10 * np.maximum(0.0, np.abs(np.diff(brake)) - math.pi / 3),
            50 * max(0.0, -result["finalFuel"]),
            0.001 * (result["propulsiveFuel"] + result["captureFuel"]),
        ]
    except (ValueError, RuntimeError):
        return np.ones(15) * 100


lo = np.array([search.LIFT, 44.0, 0, 0, -8, -math.pi / 3, -math.pi / 3, 0.25, 0.08])
hi = np.array([42.664405, 46.65, 1.8, 2.2, 8, math.pi / 3, math.pi / 3, 0.9, 0.6])
results = (
    json.loads((HERE / "polished-candidates.json").read_text())
    if (HERE / "polished-candidates.json").exists()
    else []
)
if __name__ == "__main__":
    results = []
    for j in [5, 4, 3]:
        candidate = prior[j]
        x0 = np.r_[candidate["lift"], candidate["dock"], candidate["parameters"]]
        x0 = np.clip(x0, lo + 1e-7, hi - 1e-7)
        fit = least_squares(
            residual,
            x0,
            bounds=(lo, hi),
            max_nfev=80,
            diff_step=2e-5,
            ftol=2e-8,
            xtol=2e-8,
            gtol=2e-8,
        )
        out, ascent, brake = evaluate(fit.x, tight=True, trace=True)
        out.update(
            {
                "lift": fit.x[0],
                "dock": fit.x[1],
                "parameters": fit.x[2:].tolist(),
                "ascentHeadings": ascent.tolist(),
                "brakeHeadings": brake.tolist(),
                "nfev": fit.nfev,
                "cost": fit.cost,
                "fromSeed": j,
            }
        )
        results.append(out)
        print(
            "polish",
            j,
            fit.nfev,
            "res",
            out["positionError"],
            out["velocityError"],
            "over",
            out["radialOvershoot"],
            "h",
            out["coastAngularMomentumMin"],
            "turn",
            out["totalTurnRadians"],
            "fuel",
            out["finalFuel"],
            flush=True,
        )
        (HERE / "polished-candidates.json").write_text(
            json.dumps([search.compact(r) for r in results], indent=2) + "\n"
        )
