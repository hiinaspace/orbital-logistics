"""Bounded offline two-arc shooting; independent augmented-state DOP853."""

from __future__ import annotations

import json
from math import atan2, cos, sin
from pathlib import Path
from typing import Any

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/bounded-propulsion"


def body_position(body, t):
    rail = body["rail"]
    if rail["kind"] == "fixed":
        return np.array(rail["position"])
    angle = rail["phase"] + rail["rate"] * t
    return np.array(rail["center"]) + rail["radius"] * (
        np.array(rail["u"]) * cos(angle) + np.array(rail["v"]) * sin(angle)
    )


def gravity(bodies, t, y):
    result = np.zeros(3)
    for body in bodies:
        delta = body_position(body, t) - y[:3]
        result += body["mu"] * delta / np.linalg.norm(delta) ** 3
    return result


def main():
    request = json.loads((OUT / "input.json").read_text())
    bounds = request["bounds"]
    # Both residual scales are explicit in the fictional normalized unit system.
    position_scale, velocity_scale = 1.0, 1.0
    reports, solutions = [], []
    for case in request["cases"]:
        bundle = case["bundle"]
        scenario = bundle["scenario"]
        bodies = scenario["bodies"]
        target = next(p for p in scenario["logistics"]["ports"] if p["id"] == case["targetId"])
        departure, arrival = case["departure"], case["arrival"]
        horizon = arrival - departure
        dry = scenario["ship"]["dryMass"] + case["before"]["logistics"]["cargoMass"]
        fuel = case["before"]["propellant"]
        ve = scenario["ship"]["exhaustVelocity"]
        initial = np.array([*case["before"]["y"], fuel])
        rail = target["rail"]
        if rail["kind"] == "ballistic":
            coast = solve_ivp(
                lambda t, y: np.concatenate((y[3:], gravity(bodies, t, y))),
                (rail["epoch"], rail["validUntil"]),
                rail["state"],
                method="DOP853",
                rtol=2.3e-14,
                atol=2e-15,
                dense_output=True,
            )
            assert coast.success
            goal = coast.sol(arrival)
        else:
            angle = rail["phase"] + rail["rate"] * arrival
            goal = np.concatenate(
                (
                    body_position({"rail": rail}, arrival),
                    rail["radius"]
                    * rail["rate"]
                    * (-np.array(rail["u"]) * sin(angle) + np.array(rail["v"]) * cos(angle)),
                )
            )
        seed = case["seed"]
        previous = None
        previous_thrust = None
        for thrust in bounds["thrusts"]:
            row: dict[str, Any] = {
                "case": case["name"],
                "thrust": thrust,
                "evaluations": 0,
                "status": "unresolved",
            }
            reports.append(row)

            def propagate(parameters, tight=False):
                a1, a2, d1, d2 = parameters
                if d1 + d2 >= horizon or thrust * (d1 + d2) / ve >= fuel:
                    return None
                state = initial.copy()
                pieces = []

                class Safety:
                    terminal = True
                    direction = -1

                    def __call__(self, t, y):
                        return min(
                            float(np.linalg.norm(y[:3] - body_position(body, t)))
                            - body["radius"]
                            - bounds["minClearance"]
                            for body in bodies
                        )

                for start, end, heading, force in [
                    (departure, departure + d1, a1, thrust),
                    (departure + d1, arrival - d2, 0, 0),
                    (arrival - d2, arrival, a2, thrust),
                ]:
                    direction = np.array([cos(heading), sin(heading), 0])

                    def rhs(t, y):
                        return np.concatenate(
                            (
                                y[3:6],
                                gravity(bodies, t, y) + force / (dry + y[6]) * direction,
                                [-force / ve],
                            )
                        )

                    result = solve_ivp(
                        rhs,
                        (start, end),
                        state,
                        method="DOP853",
                        rtol=2e-13 if tight else 2e-10,
                        atol=2e-15 if tight else 2e-12,
                        events=Safety(),
                        dense_output=True,
                    )
                    if not result.success or result.status != 0:
                        return None
                    state = result.y[:, -1]
                    pieces.append(result)
                return state, pieces

            def residual(parameters):
                row["evaluations"] += 1
                if row["evaluations"] > bounds["maxEvaluations"]:
                    raise RuntimeError("evaluation budget")
                result = propagate(parameters)
                return (
                    np.full(4, 10.0)
                    if result is None
                    else (result[0][:6] - goal)[[0, 1, 3, 4]]
                    / np.array([position_scale, position_scale, velocity_scale, velocity_scale])
                )

            if previous is None:
                m = dry + fuel
                durations = []
                for dv in seed:
                    used = m * (-np.expm1(-np.linalg.norm(dv) / ve))
                    durations.append(used * ve / thrust)
                    m -= used
                guess = np.array([atan2(dv[1], dv[0]) for dv in seed] + durations)
            else:
                guess = previous.copy()
                guess[2:] *= previous_thrust / thrust
            guess[2:] = np.clip(guess[2:], 1e-5, horizon * bounds["durationFraction"] * 0.99)
            try:
                fit = least_squares(
                    residual,
                    guess,
                    bounds=(
                        [-20, -20, 1e-6, 1e-6],
                        [
                            20,
                            20,
                            horizon * bounds["durationFraction"],
                            horizon * bounds["durationFraction"],
                        ],
                    ),
                    xtol=1e-11,
                    ftol=1e-11,
                    gtol=1e-11,
                    diff_step=1e-4,
                    max_nfev=40,
                )
                result = propagate(fit.x, True)
                error = float(np.linalg.norm(result[0][:6] - goal)) if result is not None else 100.0
                row["error"] = error
                if (
                    result is not None
                    and error < bounds["terminalTolerance"]
                    and result[0][6] > 0.05
                ):
                    row["status"] = "feasible"
                    row["fuel"] = float(result[0][6])
                    row["parameters"] = fit.x.tolist()
                    previous, previous_thrust = fit.x, thrust
                    solutions.append(
                        {
                            "case": case,
                            "thrust": thrust,
                            "parameters": fit.x.tolist(),
                            "terminal": result[0].tolist(),
                        }
                    )
                else:
                    row["status"] = "terminal-or-fuel"
            except (RuntimeError, ValueError) as error:
                row["status"] = str(error)
            print(row, flush=True)
    (OUT / "search-report.json").write_text(
        json.dumps({"bounds": bounds, "seeds": reports, "solutions": solutions}, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
