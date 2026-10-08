"""Independent DOP853 checks for later-window powered traffic episodes."""

import json
from pathlib import Path

import numpy as np

from propulsion_oracle import evaluate, replay

ROOT = Path(__file__).resolve().parents[2]
request = json.loads((ROOT / "docs/evidence/surface-traffic-oracle-input.json").read_text())
rows = []
for case in request["cases"]:
    checks = []
    for step, budget in zip(case["steps"], [1e-6, 1e-7, 1e-8], strict=True):
        bundle = json.loads(json.dumps(case["bundle"]))
        bundle["scenario"]["duration"] = step["terminal"]["t"] - bundle["scenario"]["epoch"]
        pieces, result = replay(bundle, True)
        regular, _ = replay(bundle, False)
        position, velocity, fuel, usage, refinement = [], [], [], [], []
        for sample in step["samples"]:
            state, propellant, cargo, _, used = evaluate(pieces, sample["t"])
            delta = np.array(sample["y"]) - state
            position.append(float(np.linalg.norm(delta[:3])))
            velocity.append(float(np.linalg.norm(delta[3:])))
            fuel.append(abs(sample["propellant"] - propellant))
            usage.append(abs(sample["fuelUsed"] - used))
            refinement.append(float(np.linalg.norm(evaluate(regular, sample["t"])[0] - state)))
            assert sample["logistics"]["cargoMass"] == cargo
        assert max(position) < budget and max(velocity) < budget, (
            case["label"],
            step["step"],
            max(position),
            max(velocity),
            step["samples"][int(np.argmax(position))]["t"],
            step["samples"][int(np.argmax(velocity))]["t"],
        )
        assert max(fuel) < 1e-8 and max(usage) < 1e-8 and max(refinement) < 1e-9
        dock = next(e for e in step["ledger"] if e["id"] == case["arrivalOperationId"])
        capture = result["captures"][-1]
        assert abs(dock["positionError"] - capture["position"]) < budget
        assert abs(dock["deltaV"] - capture["velocity"]) < budget
        if budget == 1e-8:
            assert max(dock["positionError"], capture["position"]) + budget < 1e-7
            assert max(dock["deltaV"], capture["velocity"]) + budget < 1e-7
        assert step["clearanceLowerBound"] > max(position) * 1000
        assert step["certifiedIntervals"] > 0 and result["status"] == "horizon"
        assert [[e["t"], e["kind"], e["id"]] for e in step["ledger"]] == result["trace"]
        if dock["kind"] == "land":
            boundary = next(b for b in step["boundaries"] if b["t"] == dock["t"])
            assert np.linalg.norm(np.array(boundary["before"]["y"]) - capture["before"]) < budget
            assert abs(boundary["before"]["propellant"] - capture["fuelBefore"]) < 1e-8
            assert abs(boundary["after"]["propellant"] - capture["fuelAfter"]) < 1e-8
        checks.append(
            dict(
                step=step["step"],
                budget=budget,
                position=max(position),
                velocity=max(velocity),
                fuel=max(fuel),
                usage=max(usage),
                oracleRefinement=max(refinement),
                capture=capture,
                clearance=True,
            )
        )
    rows.append(dict(case=case["label"], departure=case["departure"], checks=checks))
(ROOT / "docs/evidence/surface-traffic-oracle-report.json").write_text(
    json.dumps(rows, indent=2) + "\n"
)
print(f"{len(rows)} later-window flights x 3 steps pass independent state/fuel/capture checks")

# A separate scalar ledger replay checks finite buffers and actual boundary flows.
definition = json.loads((ROOT / "fixtures/traffic/selene-service.json").read_text())
soak = json.loads((ROOT / "docs/evidence/surface-traffic-soak.json").read_text())
stocks = {d["id"]: [d["cargo"], d["propellant"]] for d in definition["stations"]}
totals = [0.0, 0.0, 0.0, 0.0]  # cargo in/out, fuel in/out
previous = 0.0
max_stock_error = 0.0
max_flow_error = 0.0
points = [(e["t"], 0, e) for e in soak["services"]]
points += [(r["t"], 1, r) for r in soak["rows"]]
for epoch, kind, row in sorted(points, key=lambda p: (p[0], p[1])):
    for depot in definition["stations"]:
        for index, (rate, cap) in enumerate(
            [
                (depot["cargoRate"], depot["cargoCapacity"]),
                (depot["propellantRate"], depot["tankCapacity"]),
            ]
        ):
            before = stocks[depot["id"]][index]
            after = max(0, min(cap, before + rate * (epoch - previous)))
            totals[2 * index + (1 if after < before else 0)] += abs(after - before)
            stocks[depot["id"]][index] = after
    previous = epoch
    if kind == 0:
        stock = stocks[row["portId"]]
        max_stock_error = max(
            max_stock_error,
            abs(stock[0] - row["portCargoBefore"]),
            abs(stock[1] - row["portPropellantBefore"]),
        )
        stock[0] -= row["cargoAfter"] - row["cargoBefore"]
        stock[1] -= row["propellantAfter"] - row["propellantBefore"]
    else:
        for stock in row["resources"]["stocks"]:
            max_stock_error = max(
                max_stock_error,
                abs(stock["cargo"] - stocks[stock["id"]][0]),
                abs(stock["propellant"] - stocks[stock["id"]][1]),
            )
        expected = [
            row["resources"][key]
            for key in ["cargoImported", "cargoExported", "fuelImported", "fuelExported"]
        ]
        max_flow_error = max(max_flow_error, *[abs(a - b) for a, b in zip(expected, totals)])
assert max_stock_error < 1e-10 and max_flow_error < 1e-10
resource_report = dict(
    serviceCompletions=len(soak["services"]),
    maxStockError=max_stock_error,
    maxFlowError=max_flow_error,
)
(ROOT / "docs/evidence/surface-traffic-resource-report.json").write_text(
    json.dumps(resource_report, indent=2) + "\n"
)
print(resource_report)
