"""Independent full-flight surface-ascent admission, including service and paid capture."""

import json
from pathlib import Path

import numpy as np

from propulsion_oracle import evaluate, replay

ROOT = Path(__file__).resolve().parents[2]


def main():
    request = json.loads((ROOT / "docs/evidence/surface-oracle-input.json").read_text())
    pieces, result = replay(request["bundle"], True)
    regular, regular_result = replay(request["bundle"], False)
    rows = []
    for step in request["steps"]:
        errors, fuel_errors, refinement = [], [], []
        for sample in step["samples"]:
            y, fuel, cargo, stocks, used = evaluate(pieces, sample["t"])
            errors.append(float(np.linalg.norm(np.array(sample["y"]) - y)))
            fuel_errors.append(abs(sample["propellant"] - fuel))
            refinement.append(float(np.linalg.norm(evaluate(regular, sample["t"])[0] - y)))
            assert abs(sample["fuelUsed"] - used) < 1e-10
            assert sample["logistics"]["cargoMass"] == cargo
            for port in sample["logistics"]["ports"]:
                assert (
                    np.max(
                        np.abs(np.array([port["cargo"], port["propellant"]]) - stocks[port["id"]])
                    )
                    < 1e-12
                )
        assert max(errors) < 1e-9 and max(fuel_errors) < 1e-10 and max(refinement) < 1e-10
        assert [[e["t"], e["kind"], e["id"]] for e in step["ledger"]] == result["trace"]
        assert step["terminal"]["status"] == result["status"] == "horizon"
        assert result["cargo"] == 0 and result["stocks"]["Lantern"][0] == 0.1
        captures = []
        for dock, oracle in zip(
            [e for e in step["ledger"] if e["kind"] == "dock"], result["captures"], strict=True
        ):
            assert max(dock["positionError"], oracle["position"]) + 1e-8 < 1e-7
            assert max(dock["deltaV"], oracle["velocity"]) + 1e-8 < 1e-7
            captures.append(
                {
                    "id": dock["id"],
                    "productionPosition": dock["positionError"],
                    "productionVelocity": dock["deltaV"],
                    "oraclePosition": oracle["position"],
                    "oracleVelocity": oracle["velocity"],
                }
            )
        assert step["clearanceLowerBound"] > max(errors) * 1000
        rows.append(
            {
                "step": step["step"],
                "stateError": max(errors),
                "fuelError": max(fuel_errors),
                "oracleRefinement": max(refinement),
                "nodes": step["nodes"],
                "certifiedIntervals": step["certifiedIntervals"],
                "clearanceLowerBound": step["clearanceLowerBound"],
                "captures": captures,
            }
        )
    report = {
        "checks": rows,
        "terminal": result,
        "oracleFuelRefinement": abs(regular_result["fuel"] - result["fuel"]),
        "note": (
            "Clearance bound comes from unchanged production interval certificates. "
            "DOP853 checks numerical agreement, not an interval proof."
        ),
    }
    (ROOT / "docs/evidence/surface-oracle-report.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
