import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

here = Path(__file__).resolve().parent
w = json.loads((here / "witness.json").read_text())
phase = w["moonPhase"]
rate = math.sqrt(1.03 / 125)
aero = json.loads(Path("fixtures/model-sets/aster-entry.json").read_text())["atmosphere"]


def moon(t):
    a = phase + rate * t
    return np.array([5 * math.cos(a), 5 * math.sin(a)])


def coast(y, t, end, keys=None):
    def ratefun(at, z):
        p, v = z[:2], z[2:4]
        q = moon(at) - p
        r = np.linalg.norm(p)
        mr = np.linalg.norm(q)
        gravity = -p / max(r, 1) ** 3 + 0.03 * q / max(mr, 0.2) ** 3
        force = np.zeros(2)
        if keys is not None:
            u = np.clip((at - t) / (end - t), 0, 1) * (len(keys) - 1)
            i = min(len(keys) - 2, int(u))
            f = u - i
            f = f * f * (3 - 2 * f)
            angle = keys[i] + f * (keys[i + 1] - keys[i])
            force = 3 * np.array([math.cos(angle), math.sin(angle)])
        alt = r - 1
        u = np.clip((aero["topHeight"] - alt) / (aero["topHeight"] - aero["fadeHeight"]), 0, 1)
        rho = aero["density"] * math.exp(-max(0, alt) / aero["scaleHeight"]) * u * u * (3 - 2 * u)
        rel = v - 0.03 * np.array([-p[1], p[0]])
        drag = -0.5 * rho * 0.015 * np.linalg.norm(rel) * rel / (1 + z[4])
        return np.r_[v, gravity + force + drag, -3 * (1 + z[4]) / 8 if keys is not None else 0]

    sol = solve_ivp(
        ratefun,
        (t, end),
        y,
        method="DOP853",
        rtol=2e-12,
        atol=2e-13,
        max_step=0.04 if keys is None else (end - t) / 32,
    )
    minima = min(
        float(np.min(np.linalg.norm(sol.y[:2], axis=0) - 1)),
        float(min(np.linalg.norm(sol.y[:2, i] - moon(at)) - 0.2 for i, at in enumerate(sol.t))),
    )
    return sol.y[:, -1], minima


y = np.array(w["initial"])
t = 0.3
for a in w["arcs"]:
    if a["id"] == "lunar-descent":
        break
    before = y.copy()
    before_t = t
    if a["start"] > t:
        y, _ = coast(y, t, a["start"])
    t = a["start"]
    keys = np.array(a["angles"])
    target, _ = coast(y, t, a["end"], keys)
    # Only sparse control families with excessive direction gaps need reauthoring.
    if max(abs(np.diff(keys))) > 2 * math.pi / 3:
        old = keys.copy()
        keys = np.interp(np.linspace(0, 1, 2 * len(old) - 1), np.linspace(0, 1, len(old)), old)
        initial = keys.copy()
        variable_start = len(keys) == 3

        def res(x):
            k = x[:-1] if variable_start else x
            start = float(x[-1]) if variable_start else t
            seed, _ = coast(before, before_t, start) if start > before_t else (before, 0)
            final, minimum = coast(seed, start, a["end"], k)
            return np.r_[
                (final[:4] - target[:4]) * 1000, min(0, minimum - 5e-6) * 1000, 1e-5 * (k - initial)
            ]

        delta = min(0.45, (2 * math.pi / 3 - max(abs(np.diff(keys)))) / 2 - 0.01)
        seed = np.r_[keys, t] if variable_start else keys
        lo = np.r_[keys - delta, max(before_t, t - 0.04)] if variable_start else keys - delta
        hi = np.r_[keys + delta, t + 0.04] if variable_start else keys + delta
        sol = least_squares(
            res,
            seed,
            bounds=(lo, hi),
            diff_step=1e-4,
            max_nfev=120,
            ftol=1e-8,
            xtol=1e-10,
            gtol=1e-7,
        )
        keys = sol.x[:-1] if variable_start else sol.x
        print("refined", a["id"], sol.cost, "residual", res(sol.x)[:5], flush=True)
        if max(abs(res(sol.x)[:4])) > 1e-4:
            raise RuntimeError("Refinement failed")
        if variable_start:
            t = float(sol.x[-1])
            a["start"] = t
            y, _ = coast(before, before_t, t)
        a["angles"] = keys.tolist()
    y, minimum = coast(y, t, a["end"], keys)
    print(a["id"], "minimum", minimum, "fuel", y[4], flush=True)
    if minimum < 0:
        raise RuntimeError("Flight below surface")
    t = a["end"]
(here / "witness.json").write_text(json.dumps(w, indent=2) + "\n")
