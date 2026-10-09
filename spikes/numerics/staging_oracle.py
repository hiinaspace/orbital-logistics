"""DOP853 branches from its own integrated assembly, independently of production child seeds."""

import copy
import json
from pathlib import Path

import numpy as np

from propulsion_oracle import evaluate, replay

ROOT = Path(__file__).resolve().parents[2]


def mission(request, tight):
    d = request["definition"]
    split, end = d["separation"]["t"], d["world"]["duration"]
    bundles = [copy.deepcopy(s["bundle"]) for s in request["steps"][0]["segments"]]
    # Verify derived immutable manifest, then integrate parent independently.
    assert bundles[0]["scenario"]["ship"]["dryMass"] == (
        d["booster"]["dryMass"] + d["payload"]["dryMass"] + d["payload"]["propellant"]
    )
    bundles[0]["scenario"]["duration"] = split
    parent, parent_result = replay(bundles[0], tight)
    state, fuel, cargo, stocks, _used = evaluate(parent, split)
    pieces, results = [parent], [parent_result]
    for index, component in enumerate(["booster", "payload"], 1):
        bundle = bundles[index]
        bundle["scenario"]["duration"] = end - split
        ship = bundle["scenario"]["ship"]
        assert ship["dryMass"] == d[component]["dryMass"]
        ship["state"] = state.tolist()
        ship["propellant"] = fuel if component == "booster" else d["payload"]["propellant"]
        ship["cargoMass"] = 0 if component == "booster" else cargo
        for p in bundle["scenario"]["logistics"]["ports"]:
            p["cargo"], p["propellant"] = stocks[p["id"]]
        child, result = replay(bundle, tight)
        pieces.append(child)
        results.append(result)
    return pieces, results, state


def main():
    request = json.loads((ROOT / "docs/evidence/staging-oracle-input.json").read_text())
    tight, results, split_state = mission(request, True)
    regular, regular_results, _ = mission(request, False)
    assert all(r["status"] == "horizon" for r in results)
    assert results[2]["cargo"] == 0 and results[2]["stocks"]["Lantern"][0] == 0.1
    assert results[1]["fuel"] > 0.1 and results[2]["fuel"] > 0.1
    rows = []
    for row in request["steps"]:
        errors, fuel_errors, refinements, captures = [], [], [], []
        for index, segment in enumerate(row["segments"]):
            for sample in segment["samples"]:
                y, fuel, cargo, stocks, used = evaluate(tight[index], sample["t"])
                errors.append(float(np.linalg.norm(np.array(sample["y"]) - y)))
                fuel_errors.append(abs(sample["propellant"] - fuel))
                refinements.append(
                    float(np.linalg.norm(evaluate(regular[index], sample["t"])[0] - y))
                )
                assert abs(sample["fuelUsed"] - used) < 1e-9
                assert abs(sample["logistics"]["cargoMass"] - cargo) < 1e-12
                for stock in sample["logistics"]["ports"]:
                    assert (
                        max(
                            abs(
                                np.array([stock["cargo"], stock["propellant"]])
                                - stocks[stock["id"]]
                            )
                        )
                        < 1e-12
                    )
            assert [[e["t"], e["kind"], e["id"]] for e in segment["ledger"]] == results[index][
                "trace"
            ]
            for prod, oracle in zip(
                [e for e in segment["ledger"] if e["kind"] in ("dock", "land")],
                results[index]["captures"],
                strict=True,
            ):
                captures.append(
                    {
                        "id": prod["id"],
                        "productionPosition": prod["positionError"],
                        "oraclePosition": oracle["position"],
                        "productionVelocity": prod["deltaV"],
                        "oracleVelocity": oracle["velocity"],
                    }
                )
                assert max(prod["positionError"], oracle["position"]) < 1e-7
                assert max(prod["deltaV"], oracle["velocity"]) < 1e-7
            assert segment["clearanceLowerBound"] > max(errors) * 100
        d = request["definition"]
        for a in row["accounts"]:
            assert (
                abs(
                    a["remainingFuel"]
                    + a["consumedFuel"]
                    - d["booster"]["propellant"]
                    - d["payload"]["propellant"]
                )
                < 1e-11
            )
            assert abs(a["freight"] - 0.3) < 1e-11
        assert max(errors) < 1e-9 and max(fuel_errors) < 1e-10 and max(refinements) < 1e-10
        assert np.linalg.norm(np.array(row["separation"]["state"]) - split_state) < 1e-9
        rows.append(
            {
                "step": row["step"],
                "maxStateError": max(errors),
                "maxFuelError": max(fuel_errors),
                "oracleRefinement": max(refinements),
                "nodes": [s["nodes"] for s in row["segments"]],
                "captures": captures,
            }
        )
    report = {
        "checks": rows,
        "fuelRemaining": {"booster": results[1]["fuel"], "courier": results[2]["fuel"]},
        "deliveredFreight": results[2]["stocks"]["Lantern"][0],
        "splitState": split_state.tolist(),
        "oracleFuelRefinement": max(
            abs(a["fuel"] - b["fuel"]) for a, b in zip(results, regular_results, strict=True)
        ),
        "note": (
            "Oracle independently integrates assembly and derives child seeds; "
            "production interval certificates remain the safety proof."
        ),
    }
    (ROOT / "docs/evidence/staging-oracle-report.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
