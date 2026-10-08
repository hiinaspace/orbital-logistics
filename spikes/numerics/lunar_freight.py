"""Bounded planar binary shooting; emits paid programs, not runtime dispatch."""

from __future__ import annotations

import json
from math import cos, exp, sin, sqrt
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/lunar-freight"


def bounded_shoot(before, departure, arrival, other, guess, propagate, request, row):
    def evaluate(velocity):
        if row["evaluations"] >= request["maxEvaluations"]:
            return None
        row["evaluations"] += 1
        if np.linalg.norm(velocity - before[3:5]) > request["departureDv"]:
            return None
        y = before.copy()
        y[3:5] = velocity
        solution = propagate(y, departure, arrival)
        return None if solution is None else (solution, solution.y[:2, -1] - other[:2])

    current = evaluate(guess)
    for _ in range(12):
        if current is None or np.linalg.norm(current[1]) < 1e-9:
            break
        columns = []
        for axis in range(2):
            offset = np.zeros(2)
            offset[axis] = 1e-4
            plus, minus = evaluate(guess + offset), evaluate(guess - offset)
            if plus is None or minus is None:
                break
            columns.append((plus[1] - minus[1]) / 2e-4)
        if len(columns) != 2:
            break
        try:
            correction = np.linalg.solve(np.column_stack(columns), -current[1])
        except np.linalg.LinAlgError:
            break
        correction *= min(1, 0.4 / np.linalg.norm(correction))
        accepted = False
        for line in range(8):
            candidate = guess + correction * 2**-line
            trial = evaluate(candidate)
            if trial is not None and np.linalg.norm(trial[1]) < np.linalg.norm(current[1]):
                guess, current, accepted = candidate, trial, True
                break
        if not accepted:
            break
    return guess, current


def main():
    request = json.loads((OUT / "input.json").read_text())
    target = request["target"]
    scenario = target["scenario"]
    bodies = scenario["bodies"]
    departure = request["departureEpoch"]

    def body_position(body, epoch):
        rail = body["rail"]
        if rail["kind"] == "fixed":
            return np.array(rail["position"])
        angle = rail["phase"] + rail["rate"] * epoch
        return np.array(rail["center"]) + rail["radius"] * (
            np.array(rail["u"]) * cos(angle) + np.array(rail["v"]) * sin(angle)
        )

    def rhs(epoch, y):
        acceleration = np.zeros(3)
        for body in bodies:
            d = body_position(body, epoch) - y[:3]
            acceleration += body["mu"] * d / np.linalg.norm(d) ** 3
        return np.concatenate((y[3:], acceleration))

    def propagate(y, start, end, tight=False, margin=True):
        class Safety:
            terminal = True
            direction = -1

            def __call__(self, epoch, state):
                return min(
                    float(np.linalg.norm(state[:3] - body_position(body, epoch)))
                    - body["radius"]
                    - (request["minClearance"] if margin else 0)
                    for body in bodies
                )

        solution = solve_ivp(
            rhs,
            (start, end),
            y,
            method="DOP853",
            dense_output=True,
            events=Safety(),
            rtol=2.3e-14 if tight else 2e-11,
            atol=2e-15 if tight else 2e-13,
        )
        return solution if solution.success and solution.t[-1] == end else None

    target_solution = propagate(scenario["ship"]["state"], 0, 12, True)
    assert target_solution is not None
    rows, solutions = [], []
    for phase in request["phases"]:
        radius, speed = 0.5, sqrt(0.98 / 0.5)
        initial = np.array(
            [
                -0.02 + radius * cos(phase),
                radius * sin(phase),
                0,
                -speed * sin(phase),
                speed * cos(phase) - 0.02,
                0,
            ]
        )
        carrier = propagate(initial, 0, departure, True)
        for duration in request["durations"]:
            row = {
                "phase": phase,
                "departure": departure,
                "duration": duration,
                "status": "unresolved",
                "evaluations": 0,
            }
            rows.append(row)
            if carrier is None:
                row["status"] = "departure-clearance"
                continue
            before = carrier.y[:, -1]
            arrival = departure + duration
            other = target_solution.sol(arrival)
            radial = before[:2] - body_position(bodies[0], departure)[:2]
            radial /= np.linalg.norm(radial)
            transfer_speed = sqrt(0.98 * (2 / radius - 1 / ((radius + 1.18) / 2)))
            guess = before[3:5] + np.array([-radial[1], radial[0]]) * (transfer_speed - speed)

            guess, current = bounded_shoot(
                before, departure, arrival, other, guess, propagate, request, row
            )
            if current is None:
                row["status"] = "seed-clearance-or-budget"
                continue
            row["positionError"] = float(np.linalg.norm(current[1]))
            if row["positionError"] > 1e-8:
                row["status"] = "no-convergence"
                continue
            start = before.copy()
            start[3:5] = guess
            tight = propagate(start, departure, arrival, True)
            assert tight is not None
            coast_end = tight.y[:, -1]
            dv_departure = start[3:] - before[3:]
            dv_arrival = other[3:] - coast_end[3:]
            total = float(np.linalg.norm(dv_departure) + np.linalg.norm(dv_arrival))
            fuel = 2.06 * exp(-total / 3) - 1.16
            row.update(
                totalDv=total,
                remainingFuel=fuel,
                positionError=float(np.linalg.norm(coast_end[:3] - other[:3])),
                tightening=float(np.linalg.norm(coast_end - current[0].y[:, -1])),
            )
            if total > request["totalDv"] or fuel < request["minFuel"]:
                row["status"] = "fuel-budget"
                continue
            matched = coast_end.copy()
            matched[3:] += dv_arrival
            dwell = propagate(matched, arrival, arrival + 0.75, True)
            if dwell is None:
                row["status"] = "post-arrival-clearance"
                continue
            row["postArrivalSeparation"] = float(
                np.linalg.norm(dwell.y[:3, -1] - target_solution.sol(arrival + 0.75)[:3])
            )
            if row["positionError"] > 1e-8 or row["postArrivalSeparation"] > 1e-7:
                row["status"] = "tightening-unresolved"
                continue
            row["status"] = "feasible"
            bundle = json.loads(json.dumps(target))
            bundle["scenario"]["id"] = "selene-visitor-v2"
            bundle["scenario"]["ship"].update(
                id="Visitor",
                state=initial.tolist(),
                dryMass=1,
                cargoMass=0.16,
                propellant=0.9,
                tankCapacity=1,
                exhaustVelocity=3,
            )
            bundle["program"] = {
                "schemaVersion": 2,
                "id": "lunar-rendezvous-v2",
                "burns": [
                    {
                        "id": "departure",
                        "t": departure,
                        "referenceBodyId": "primary",
                        "basis": "inertial-cartesian-v2",
                        "deltaVelocity": dv_departure.tolist(),
                    },
                    {
                        "id": "match-velocity",
                        "t": arrival,
                        "referenceBodyId": "moon",
                        "basis": "inertial-cartesian-v2",
                        "deltaVelocity": dv_arrival.tolist(),
                    },
                ],
            }
            solutions.append({"summary": row.copy(), "bundle": bundle})
    solutions.sort(key=lambda solution: solution["summary"]["totalDv"])
    report = {
        "bounds": {k: v for k, v in request.items() if k != "target"},
        "seeds": rows,
        "feasible": len(solutions),
        "solutions": solutions,
    }
    (OUT / "shooting-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"feasible": len(solutions), "seeds": rows}, indent=2), flush=True)


if __name__ == "__main__":
    main()
