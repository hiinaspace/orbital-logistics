"""Bounded phase-free station-maintenance authoring and visiting tug shooting."""

from __future__ import annotations

import json
from math import cos, sin, sqrt
from pathlib import Path
from typing import Any

import numpy as np
from scipy.integrate import solve_ivp
from scipy.linalg import qr
from scipy.optimize import least_squares
from steering_search import direction, heading

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/stationkeeping/search-report.json"
DURATION, MU, NODE, TILT = 64.0, 0.004, 0.5, np.deg2rad(35.0)
U = np.array([cos(NODE), sin(NODE), 0])
V = np.array([-sin(NODE) * cos(TILT), cos(NODE) * cos(TILT), sin(TILT)])
V0 = np.array([-sin(NODE), cos(NODE), 0])
RATE = 3**-1.5
PHASE = np.pi - RATE * 34
STATION: dict[str, Any] = dict(
    dryMass=4.0,
    cargoMass=0.0,
    propellant=0.6,
    tankCapacity=0.6,
    exhaustVelocity=3.0,
    engine=dict(maxThrust=0.06, maxAcceleration=0.012),
)
VISITOR: dict[str, Any] = dict(
    dryMass=1.0,
    cargoMass=0.05,
    propellant=0.9,
    tankCapacity=1.0,
    exhaustVelocity=3.0,
    engine=dict(maxThrust=0.25, maxAcceleration=0.14),
)
BODIES = [
    dict(id="Orison", mu=1.0, radius=1.0, rail=dict(kind="fixed", position=[0, 0, 0])),
    dict(
        id="Mote",
        mu=MU,
        radius=0.12,
        rail=dict(
            kind="circular",
            center=[0, 0, 0],
            u=[1, 0, 0],
            v=[0, 1, 0],
            radius=6.0,
            rate=sqrt((1 + MU) / 6**3),
            phase=0.4,
        ),
    ),
]


def nominal(t):
    a = PHASE + RATE * t
    return np.r_[3 * (U * cos(a) + V * sin(a)), 3 * RATE * (-U * sin(a) + V * cos(a))]


def reference(y):
    a = np.arctan2(np.dot(y[:3], V), np.dot(y[:3], U))
    return np.r_[3 * (U * cos(a) + V * sin(a)), 3 * RATE * (-U * sin(a) + V * cos(a))]


def errors(y):
    d = y[:6] - reference(y)
    return [float(np.linalg.norm(d[:3])), float(np.linalg.norm(d[3:]))]


def gravity(t, p):
    a = 0.4 + sqrt((1 + MU) / 6**3) * t
    q = 6 * np.array([cos(a), sin(a), 0]) - p
    return -p / np.linalg.norm(p) ** 3 + MU * q / np.linalg.norm(q) ** 3


def propagate(state, start, end, arcs, ship, dense=False):
    y = np.array(state, dtype=float)
    pieces = []
    knots = sorted(
        set(
            [start, end]
            + [
                x
                for a in arcs
                for x in [a["start"], a["end"]]
                + [a["start"] + k["offset"] for k in a.get("steering", {}).get("keys", [])]
                if start < x < end
            ]
        )
    )
    for lo, hi in zip(knots, knots[1:]):
        arc = next((a for a in arcs if a["start"] <= lo < a["end"]), None)

        def rhs(t, y):
            mass = ship["dryMass"] + ship["cargoMass"] + y[6]
            force = (
                0.0
                if arc is None
                else min(
                    ship["engine"]["maxThrust"] * arc["throttle"],
                    ship["engine"]["maxAcceleration"] * mass,
                )
            )
            d = np.zeros(3) if arc is None else np.array(arc["direction"])
            if arc is not None and "steering" in arc:
                d = direction(
                    np.array([k["direction"] for k in arc["steering"]["keys"]]),
                    (t - arc["start"]) / (arc["end"] - arc["start"]),
                )
            return np.r_[
                y[3:6], gravity(t, y[:3]) + force / mass * d, -force / ship["exhaustVelocity"]
            ]

        r = solve_ivp(
            rhs, (lo, hi), y, method="DOP853", rtol=2.3e-14, atol=2e-15, dense_output=True
        )
        if not r.success or r.y[6, -1] < 0 or np.min(np.linalg.norm(r.y[:3], axis=0)) < 1.2:
            raise ValueError("unsafe/depleted candidate")
        y = r.y[:, -1]
        pieces.append(r)
    return y, pieces if dense else []


def correction_arcs(x, t, index):
    arcs = []
    for i, (start, end) in enumerate([(t, t + 1.9), (t + 2.1, t + 4)]):
        f = np.array(x[i * 3 : i * 3 + 3])
        n = float(np.linalg.norm(f))
        arcs.append(
            dict(
                id=f"maintain-{index}-{i}",
                start=start,
                end=end,
                direction=(f / n).tolist() if n else [1.0, 0.0, 0.0],
                throttle=n / STATION["engine"]["maxThrust"],
            )
        )
    return arcs


def compile_station(initial, max_evaluations=64, fuel=None):
    y = np.r_[initial, STATION["propellant"] if fuel is None else fuel]
    arcs = []
    checks = []
    pieces = []
    last = 0.0
    for index, t in enumerate([4.0, 12.0, 20.0, 28.0, 36.0, 44.0, 52.0, 60.0]):
        y, coast = propagate(y, last, t, [], STATION, True)
        pieces += coast
        before = errors(y)
        if before[0] <= 0.001 and before[1] <= 0.0003:
            checks.append(dict(t=t, outcome="skip", before=before, evaluations=0))
            last = t
            continue
        count = 0

        def residual(x):
            nonlocal count
            count += 1
            if count > max_evaluations:
                raise ValueError("station solve evaluation budget exhausted")
            target, _ = propagate(y, t, t + 4, correction_arcs(x, t, index), STATION)
            return target[:6] - reference(target)

        bound = STATION["engine"]["maxThrust"] / sqrt(3)
        fit = least_squares(
            residual,
            np.zeros(6),
            bounds=(-bound, bound),
            max_nfev=9,
            xtol=1e-12,
            ftol=1e-12,
            gtol=1e-12,
        )
        accepted = correction_arcs(fit.x, t, index)
        final, flight = propagate(y, t, t + 4, accepted, STATION, True)
        after = errors(final)
        if max(after) > 1e-8 or final[6] < 0.3:
            raise ValueError("maintenance correction admission failed")
        checks.append(dict(t=t, outcome="correct", before=before, after=after, evaluations=count))
        arcs += accepted
        pieces += flight
        y = final
        last = t + 4
    y, coast = propagate(y, last, DURATION, [], STATION, True)
    pieces += coast
    probes = np.array([r.sol(t) for r in pieces for t in np.linspace(r.t[0], r.t[-1], 65)])
    envelope = np.max(np.array([errors(p) for p in probes]), axis=0)
    if envelope[0] > 0.02 or envelope[1] > 0.005:
        raise ValueError(f"maintenance envelope exceeded: {envelope.tolist()}")
    return dict(arcs=arcs, checks=checks, final=y.tolist(), maxErrors=envelope.tolist()), pieces


def at(pieces, t):
    return next(r.sol(t) for r in pieces if r.t[0] <= t <= r.t[-1])


def visitor_arcs(x):
    d1, d2 = x[-2:]
    arcs = []
    for i, (start, end, keys) in enumerate(
        [(20.0, 20.0 + d1, x[:6].reshape(3, 2)), (34.0 - d2, 34.0, x[6:12].reshape(3, 2))]
    ):
        vectors = [heading(k).tolist() for k in keys]
        arcs.append(
            dict(
                id=f"visitor-{i}",
                start=start,
                end=end,
                direction=vectors[0],
                throttle=1.0,
                steering=dict(
                    kind="spherical-smoothstep-v1",
                    keys=[
                        dict(offset=(end - start) * j / 2, direction=v)
                        for j, v in enumerate(vectors)
                    ],
                ),
            )
        )
    return arcs


def main():
    report: dict[str, Any] = dict(
        policy=dict(
            checks=[4, 12, 20, 28, 36, 44, 52, 60],
            correctionDuration=4,
            deadbandPosition=0.001,
            deadbandVelocity=0.0003,
            envelopePosition=0.02,
            envelopeVelocity=0.005,
            maxEvaluations=64,
            reserve=0.3,
        ),
        bodies=BODIES,
        station=STATION,
        visitor=VISITOR,
        nominal=dict(
            kind="circular",
            center=[0, 0, 0],
            u=U.tolist(),
            v=V.tolist(),
            radius=3,
            rate=RATE,
            phase=PHASE,
        ),
    )
    try:
        initial = nominal(0)
        station, pieces = compile_station(initial)
        report["maintenance"] = station
        report["initialStation"] = initial.tolist()
        alternate = initial.copy()
        alternate[0] += 0.0001
        perturbed, _ = compile_station(alternate)
        report["perturbedMaintenance"] = perturbed
        failures = {}
        for label, options in [
            ("evaluationBudget", dict(max_evaluations=1)),
            ("fuelReserve", dict(fuel=0.001)),
        ]:
            try:
                compile_station(initial, **options)
            except ValueError as error:
                failures[label] = str(error)
            else:
                raise ValueError("Expected bounded authoring rejection")
        report["authoringFailures"] = failures
        baseline, _ = propagate(np.r_[initial, 0.6], 0, DURATION, [], STATION, True)
        report["baselineFinal"] = baseline.tolist()
        source_phase = -20 * 2**-1.5
        source = np.r_[
            2 * (U * cos(source_phase) + V0 * sin(source_phase)),
            2**-0.5 * (-U * sin(source_phase) + V0 * cos(source_phase)),
        ]
        source_at, _ = propagate(np.r_[source, 0.9], 0, 20, [], VISITOR)
        goal = at(pieces, 34)[:6]
        seed = np.array(
            json.loads((ROOT / "docs/design/smooth-steering/search-report.json").read_text())[
                "parameters"
            ]
        )
        calls = 0

        def residual(x):
            nonlocal calls
            calls += 1
            if calls > 256:
                raise ValueError("visitor solve budget exhausted")
            final, _ = propagate(source_at, 20, 34, visitor_arcs(x), VISITOR)
            return final[:6] - goal

        base = residual(seed)
        jac = np.column_stack(
            [(residual(seed + np.eye(14)[i] * 1e-5) - base) / 1e-5 for i in range(14)]
        )
        _, _, piv = qr(jac, pivoting=True)
        chosen = piv[:6]

        def expand(x):
            full = seed.copy()
            full[chosen] = x
            return full

        lower = np.array([-10, -1.55] * 6 + [0.2, 0.2])
        upper = np.array([10, 1.55] * 6 + [4.5, 4.5])
        fit = least_squares(
            lambda x: residual(expand(x)),
            seed[chosen],
            bounds=(lower[chosen], upper[chosen]),
            max_nfev=24,
            xtol=2e-14,
            ftol=2e-14,
            gtol=2e-14,
        )
        fit.x = expand(fit.x)
        report["visitorSolvedIndices"] = chosen.tolist()
        final, flight = propagate(source_at, 20, 34, visitor_arcs(fit.x), VISITOR, True)
        if np.linalg.norm(final[:6] - goal) > 1e-9:
            raise ValueError(f"visitor arrival failed: {np.linalg.norm(final[:6] - goal)}")
        # A visitor departs before the next maintenance check, carrying its freight.
        released = at(pieces, 36).copy()
        released[6] = final[6]
        terminal, _ = propagate(released, 36, DURATION, [], VISITOR)
        report.update(
            sourceState=source.tolist(),
            visitorArcs=visitor_arcs(fit.x),
            visitorEvaluations=calls,
            visitorArrival=final.tolist(),
            targetArrival=goal.tolist(),
            visitorFinal=terminal.tolist(),
            nominalArrival=nominal(34).tolist(),
            baselineArrival=propagate(np.r_[initial, 0.6], 0, 34, [], STATION)[0].tolist(),
            status="accepted",
        )
    except ValueError as e:
        report.update(status="failed", failure=str(e))
        OUT.write_text(json.dumps(report, indent=2) + "\n")
        raise
    OUT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {k: report[k] for k in ["status", "maintenance", "visitorEvaluations"]}, indent=2
        )
    )


if __name__ == "__main__":
    main()
