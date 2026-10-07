"""Independent DOP853/Hohmann evidence for the fixed-time M2 rendezvous."""

from __future__ import annotations

import json
from math import expm1, sqrt
from pathlib import Path

import numpy as np

from m1_oracle import evaluate, solve

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    request = json.loads((ROOT / "docs/evidence/m2-oracle-input.json").read_text())
    rows = []
    for case in request["cases"]:
        bundle = case["bundle"]
        spec, ship = bundle["scenario"]["rendezvous"], bundle["scenario"]["ship"]
        target = json.loads(json.dumps(bundle))
        target["scenario"]["ship"]["state"] = spec["target"]["state"]
        target["program"]["burns"] = []
        tight, _, fuel = solve(bundle, True)
        regular, _, _ = solve(bundle, False)
        target_pieces, _, _ = solve(target, True)
        checks = []
        for row in case["steps"]:
            position, velocity, target_error, refinement = [], [], [], []
            for sample in row["samples"]:
                oracle = evaluate(tight, sample["t"])
                state = np.array(sample["y"])
                position.append(float(np.linalg.norm(state[:2] - oracle[:2])))
                velocity.append(float(np.linalg.norm(state[2:] - oracle[2:])))
                target_error.append(
                    float(
                        np.linalg.norm(
                            np.array(sample["target"]) - evaluate(target_pieces, sample["t"])
                        )
                    )
                )
                refinement.append(float(np.linalg.norm(evaluate(regular, sample["t"]) - oracle)))
            assert max(position) < spec["tolerance"]["position"] / 100
            assert max(velocity) < spec["tolerance"]["velocity"] / 100
            assert max(target_error) < 1e-6 and max(refinement) < 1e-8
            assert abs(row["terminal"]["propellant"] - fuel) < 1e-14
            assert row["terminal"]["status"] == "horizon" and len(row["ledger"]) == 2
            checks.append(
                {
                    "step": row["step"],
                    "maxPositionError": max(position),
                    "maxVelocityError": max(velocity),
                    "maxTargetStateError": max(target_error),
                    "maxOracleRefinement": max(refinement),
                }
            )
        arrival = evaluate(tight, spec["arrivalEpoch"])
        target_arrival = evaluate(target_pieces, spec["arrivalEpoch"])
        miss, relative_speed = (
            float(np.linalg.norm(arrival[:2] - target_arrival[:2])),
            float(np.linalg.norm(arrival[2:] - target_arrival[2:])),
        )
        assert miss < spec["tolerance"]["position"] / 100
        assert relative_speed < spec["tolerance"]["velocity"] / 100
        p = case["result"]["proposal"]
        analytic_departure = sqrt(7 / 6) - 1
        analytic_arrival = sqrt(1 / 1.4) - sqrt(2 / 1.4 - 1 / 1.2)
        assert abs(p["departure"]["transverse"] - analytic_departure) < 1e-7
        assert abs(p["arrival"]["transverse"] - analytic_arrival) < 1e-7
        analytic_fuel = (ship["dryMass"] + ship["cargoMass"] + ship["propellant"]) * -expm1(
            -(analytic_departure + analytic_arrival) / ship["exhaustVelocity"]
        )
        assert abs(p["propellantUsed"] - analytic_fuel) < 1e-7
        rows.append(
            {
                "seed": case["label"],
                "iterations": p["iterations"],
                "evaluations": p["evaluations"],
                "initialMiss": case["result"]["trials"][0]["error"],
                "oracleArrivalMiss": miss,
                "oracleArrivalRelativeSpeed": relative_speed,
                "totalDv": p["totalDv"],
                "addedDv": p["addedDv"],
                "propellantUsed": p["propellantUsed"],
                "checks": checks,
            }
        )
    report = {"environment": request["environment"], "cases": rows}
    (ROOT / "docs/evidence/m2-oracle-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
