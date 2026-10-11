"""Bounded offline Eagle ascent search against the frozen staged mission.

Run with: uv run --with numpy --with scipy search.py --search
Only writes files in this directory. All times and states are global inertial.
"""

import argparse
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
AUTHOR = HERE.parents[1] / "staged-apollo" / "author.py"
SPEC = importlib.util.spec_from_file_location("staged_author", AUTHOR)
assert SPEC and SPEC.loader
model = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(model)

BASE = json.loads((AUTHOR.parent / "ascent-witness.json").read_text())
FIXTURE = json.loads((HERE / "baseline-mission.json").read_text())
FUEL0 = float(BASE["start"][4])
DRY = 0.15
THRUST = 0.72
VE = 8.0
RADIUS = 0.2
LIFT = FIXTURE["liftoff"]
NORMAL = math.atan2(
    model.pad(LIFT)[1] - model.moon(LIFT)[1], model.pad(LIFT)[0] - model.moon(LIFT)[0]
)


def smooth_direction(headings, u):
    v = np.clip(u, 0.0, 1.0) * (len(headings) - 1)
    i = min(len(headings) - 2, int(v))
    f = v - i
    f = f * f * (3 - 2 * f)
    a = headings[i] + f * (headings[i + 1] - headings[i])
    return np.array([math.cos(a), math.sin(a)])


def segment(y, t0, t1, headings=None, tight=False, trace=False, force=THRUST):
    if t1 <= t0:
        raise ValueError("empty segment")

    def rhs(t, q):
        accel = model.gravity(t, q, soft=not tight)
        if headings is None:
            return np.r_[q[2:4], accel, 0.0]
        actual = min(force, 3.0 * (DRY + q[4]))
        d = smooth_direction(headings, (t - t0) / (t1 - t0))
        return np.r_[q[2:4], accel + actual / (DRY + q[4]) * d, -actual / VE]

    sol = solve_ivp(
        rhs,
        (t0, t1),
        y,
        method="DOP853",
        rtol=2e-12 if tight else 3e-8,
        atol=2e-13 if tight else 3e-10,
        max_step=min(0.04, (t1 - t0) / 24) if trace else min(0.15, (t1 - t0) / 12),
        dense_output=trace,
    )
    if not sol.success:
        raise RuntimeError(sol.message)
    return sol


def run(
    t_lift,
    dock,
    duration1,
    duration2,
    ascent,
    brake,
    tight=False,
    trace=False,
    force1=THRUST,
    force2=THRUST,
):
    y = np.r_[model.pad(t_lift), FUEL0]
    t1, t2 = t_lift + duration1, dock - duration2
    if t1 >= t2:
        raise ValueError("overlapping arcs")
    parts = [segment(y, t_lift, t1, ascent, tight, trace, force1)]
    parts.append(segment(parts[-1].y[:, -1], t1, t2, tight=tight, trace=trace))
    parts.append(segment(parts[-1].y[:, -1], t2, dock, brake, tight, trace, force2))
    arrival = parts[-1].y[:, -1]
    target = model.ORBIT.sol(dock)
    samples = []
    coast_h = []
    for phase, part in enumerate(parts):
        times = (
            np.linspace(part.t[0], part.t[-1], max(2, math.ceil((part.t[-1] - part.t[0]) / 0.0125)))
            if trace
            else part.t
        )
        states = part.sol(times) if trace else part.y
        for t, q in zip(times, states.T):
            moon = model.moon(t)
            orb = model.ORBIT.sol(t)
            rr = float(np.linalg.norm(q[:2] - moon[:2]))
            rt = float(np.linalg.norm(orb[:2] - moon[:2]))
            relative = q[:2] - moon[:2]
            relative_v = q[2:4] - moon[2:4]
            h = float(relative[0] * relative_v[1] - relative[1] * relative_v[0])
            if phase == 1:
                coast_h.append(h)
            samples.append((float(t), rr, rt, rr - rt, float(q[4]), h))
    clearance = min(row[1] - RADIUS for row in samples)
    overshoot = max(row[3] for row in samples)
    fuel = FUEL0 - arrival[4]
    match_dv = float(np.linalg.norm(arrival[2:4] - target[2:4]))
    paid_fuel = (DRY + arrival[4]) * (-math.expm1(-match_dv / VE))
    turns = [float(np.sum(np.abs(np.diff(h)))) for h in (ascent, brake)]
    return {
        "arrival": arrival.tolist(),
        "target": target.tolist(),
        "residual": (arrival[:4] - target).tolist(),
        "positionError": float(np.linalg.norm(arrival[:2] - target[:2])),
        "velocityError": match_dv,
        "clearance": clearance,
        "radialOvershoot": overshoot,
        "propulsiveFuel": fuel,
        "captureFuel": paid_fuel,
        "finalFuel": float(arrival[4] - paid_fuel),
        "coastAngularMomentumMin": min(coast_h),
        "coastAngularMomentumMax": max(coast_h),
        "propulsiveDeltaV": VE * math.log((DRY + FUEL0) / (DRY + arrival[4])),
        "totalTurnRadians": turns,
        "maxAcceleration": max(
            min(force2 / (DRY + arrival[4]), 3.0), min(force1 / (DRY + FUEL0), 3.0)
        ),
        "samples": samples if trace else None,
    }


def baseline():
    arcs = BASE["arcs"]
    a = [math.atan2(k["direction"][1], k["direction"][0]) for k in arcs[0]["steering"]["keys"]]
    b = [math.atan2(k["direction"][1], k["direction"][0]) for k in arcs[1]["steering"]["keys"]]
    a = np.unwrap(a)
    b = np.unwrap(b)
    result = run(
        LIFT,
        BASE["lunarDock"],
        arcs[0]["end"] - LIFT,
        arcs[1]["end"] - arcs[1]["start"],
        a,
        b,
        tight=True,
        trace=True,
    )
    return result


def family(x, lift, dock, sign):
    # Two keys after the physically radial launch direction, three for braking.
    # Heading offsets are continuous and bounded to prevent full revolutions.
    normal = model.D["ports"][1]["rail"]["phase"] + model.N * lift
    ascent = np.r_[normal, normal + sign * x[0], normal + sign * x[1]]
    brake = np.r_[x[2], x[2] + x[3], x[2] + x[4]]
    return ascent, brake


def optimize(lift, dock, sign, seed, max_nfev=60):
    # x: two ascent offsets, braking initial heading/two offsets, durations.
    # Four endpoint equations, seven controls. Soft barriers keep search local.
    lo = np.array([0.0, 0.0, -8.0, -1.3, -1.3, 0.25, 0.18])
    hi = np.array([1.8, 2.6, 8.0, 1.3, 1.3, 1.6, 1.3])

    def residual(x):
        ascent, brake = family(x, lift, dock, sign)
        try:
            result = run(lift, dock, x[5], x[6], ascent, brake)
            state = np.array(result["residual"])
            return np.r_[
                100 * state,
                10 * max(0, 0.00003 - result["clearance"]),
                10 * max(0, result["radialOvershoot"] - 0.03),
                10 * max(0, 0.005 - result["coastAngularMomentumMin"]),
                5 * max(0, -result["finalFuel"]),
                0.005 * np.array([x[0], x[1] - x[0], x[3], x[4]]),
                0.01 * (result["propulsiveFuel"] + result["captureFuel"]),
            ]
        except (ValueError, RuntimeError):
            return np.ones(13) * 100

    fit = least_squares(
        residual,
        np.clip(seed, lo + 1e-5, hi - 1e-5),
        bounds=(lo, hi),
        max_nfev=max_nfev,
        diff_step=3e-4,
        ftol=1e-7,
        xtol=1e-7,
        gtol=1e-7,
    )
    ascent, brake = family(fit.x, lift, dock, sign)
    result = run(lift, dock, fit.x[5], fit.x[6], ascent, brake, tight=True, trace=True)
    result.update(
        {
            "lift": lift,
            "dock": dock,
            "family": "two-key ascent/three-key brake",
            "sign": sign,
            "parameters": fit.x.tolist(),
            "ascentHeadings": ascent.tolist(),
            "brakeHeadings": brake.tolist(),
            "nfev": fit.nfev,
            "cost": fit.cost,
        }
    )
    return result


def compact(result):
    return {k: v for k, v in result.items() if k != "samples"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--search", action="store_true")
    args = parser.parse_args()
    base = baseline()
    (HERE / "baseline.json").write_text(json.dumps(base, indent=2) + "\n")
    print("baseline", json.dumps(compact(base)), flush=True)
    if not args.search:
        return
    results = []
    for lift, dock, sign in [
        (LIFT, 44.5, 1),
        (LIFT, 45.5, 1),
        (LIFT, 46.5, 1),
        (LIFT, 44.5, -1),
        (LIFT, 45.5, -1),
        (LIFT, 46.5, -1),
    ]:
        for brake0 in [0.0, math.pi]:
            seed = np.array([0.5, 1.2, brake0, 0.0, 0.0, 0.8, 0.5])
            try:
                candidate = optimize(lift, dock, sign, seed)
            except Exception as exc:
                print("failed", lift, dock, sign, brake0, repr(exc), flush=True)
                continue
            results.append(candidate)
            print(
                "candidate",
                lift,
                dock,
                sign,
                brake0,
                candidate["cost"],
                candidate["positionError"],
                candidate["velocityError"],
                candidate["radialOvershoot"],
                candidate["finalFuel"],
                flush=True,
            )
            (HERE / "candidates.json").write_text(
                json.dumps([compact(r) for r in results], indent=2) + "\n"
            )


if __name__ == "__main__":
    main()
