"""Bounded return witnesses for the three cheapest proven lunar departures."""

from __future__ import annotations

import json
from math import cos, exp, sin, sqrt
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

from lunar_freight import bounded_shoot

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/lunar-freight"


def main():
    request = json.loads((OUT / "input.json").read_text())
    candidates = json.loads((OUT / "shooting-report.json").read_text())["solutions"][:3]
    bodies = request["target"]["scenario"]["bodies"]

    def body_state(body, epoch):
        rail = body["rail"]
        angle = rail["phase"] + rail["rate"] * epoch
        u, v = np.array(rail["u"]), np.array(rail["v"])
        return np.concatenate(
            (
                np.array(rail["center"]) + rail["radius"] * (u * cos(angle) + v * sin(angle)),
                rail["radius"] * rail["rate"] * (-u * sin(angle) + v * cos(angle)),
            )
        )

    def rhs(t, y):
        acceleration = np.zeros(3)
        for body in bodies:
            d = body_state(body, t)[:3] - y[:3]
            acceleration += body["mu"] * d / np.linalg.norm(d) ** 3
        return np.concatenate((y[3:], acceleration))

    def propagate(y, start, end, tight=False):
        class Safety:
            terminal = True
            direction = -1

            def __call__(self, t, state):
                return min(
                    np.linalg.norm(state[:3] - body_state(body, t)[:3]) - body["radius"] - 0.03
                    for body in bodies
                )

        result = solve_ivp(
            rhs,
            (start, end),
            y,
            method="DOP853",
            dense_output=True,
            events=Safety(),
            rtol=2.3e-14 if tight else 2e-11,
            atol=2e-15 if tight else 2e-13,
        )
        return result if result.success and result.t[-1] == end else None

    dro = propagate(request["target"]["scenario"]["ship"]["state"], 0, 12, True)
    assert dro is not None
    reports, trips = [], []
    for index, outbound in enumerate(candidates):
        carrier = propagate(outbound["bundle"]["scenario"]["ship"]["state"], 0, 12, True)
        assert carrier is not None
        found = []
        for wait in [0.5, 1, 1.5, 2]:
            departure = outbound["bundle"]["program"]["burns"][1]["t"] + wait
            before = dro.sol(departure)
            primary = body_state(bodies[0], departure)
            radial = before[:2] - primary[:2]
            radius = float(np.linalg.norm(radial))
            radial /= radius
            transfer_speed = sqrt(0.98 * (2 / radius - 1 / ((radius + 0.5) / 2)))
            for duration in [2, 2.5, 3, 4]:
                arrival = departure + duration
                other = carrier.sol(arrival)
                guess = primary[3:5] + np.array([-radial[1], radial[0]]) * transfer_speed
                row = {"outbound": index, "wait": wait, "duration": duration, "evaluations": 0}
                reports.append(row)
                guess, current = bounded_shoot(
                    before, departure, arrival, other, guess, propagate, request, row
                )
                if current is None or np.linalg.norm(current[1]) > 1e-8:
                    row["status"] = "no-convergence-or-clearance"
                    continue
                start = before.copy()
                start[3:5] = guess
                tight = propagate(start, departure, arrival, True)
                assert tight is not None
                last = tight.y[:, -1]
                departure_dv, arrival_dv = start[3:] - before[3:], other[3:] - last[3:]
                total = float(np.linalg.norm(departure_dv) + np.linalg.norm(arrival_dv))
                fuel = 1.85 * exp(-total / 3) - 1
                position_error = float(np.linalg.norm(last[:3] - other[:3]))
                row.update(
                    totalDv=total,
                    fuel=fuel,
                    positionError=float(np.linalg.norm(last[:3] - other[:3])),
                )
                if total > 1.6 or fuel < 0.05 or position_error > 1e-8:
                    row["status"] = "budget-or-tightening"
                    continue
                row["status"] = "feasible"
                found.append(
                    {
                        "summary": row.copy(),
                        "departure": departure,
                        "arrival": arrival,
                        "departureDv": departure_dv.tolist(),
                        "arrivalDv": arrival_dv.tolist(),
                    }
                )
        found.sort(key=lambda row: row["summary"]["totalDv"])
        if found:
            trips.append({"outbound": outbound, "return": found[0]})
    (OUT / "return-report.json").write_text(
        json.dumps({"seeds": reports, "trips": trips}, indent=2) + "\n"
    )
    print(
        json.dumps(
            {"completeTrips": len(trips), "returns": [t["return"] for t in trips]}, indent=2
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
