"""Independent DOP853 and closed-form circular plane-change viewer witnesses."""

import json
from math import cos, sin
from pathlib import Path

import numpy as np
from spatial_oracle import replay

ROOT = Path(__file__).resolve().parents[2]
request = json.loads((ROOT / "docs/evidence/spatial-viewer-oracle-input.json").read_text())
rows = []
for case in request["cases"]:
    bundle = case["bundle"]
    evaluate, burns = replay(bundle, True)
    ordinary, _ = replay(bundle, False)
    # An independent analytic circular solution on each side of both node burns.
    initial = np.array(bundle["scenario"]["ship"]["state"])
    radius = np.linalg.norm(initial[:3])
    rate = radius**-1.5
    anchors = [(0.0, initial)]
    for burn in bundle["program"]["burns"]:
        epoch, previous = anchors[-1]
        theta = rate * (burn["t"] - epoch)
        y = np.concatenate(
            (
                previous[:3] * cos(theta) + previous[3:] / rate * sin(theta),
                -previous[:3] * rate * sin(theta) + previous[3:] * cos(theta),
            )
        )
        y[3:] += np.array(burn["deltaVelocity"])
        anchors.append((burn["t"], y))

    def analytic(t):
        epoch, y = next((a, y) for a, y in reversed(anchors) if a <= t)
        theta = rate * (t - epoch)
        return np.concatenate(
            (
                y[:3] * cos(theta) + y[3:] / rate * sin(theta),
                -y[:3] * rate * sin(theta) + y[3:] * cos(theta),
            )
        )

    checks = []
    for step in case["steps"]:
        state_error, fuel_error, analytic_error, refinement = [], [], [], []
        for sample in step["samples"]:
            y, fuel = evaluate(sample["t"])
            state_error.append(float(np.linalg.norm(np.array(sample["y"]) - y)))
            fuel_error.append(abs(sample["propellant"] - fuel))
            analytic_error.append(float(np.linalg.norm(analytic(sample["t"]) - y)))
            refinement.append(float(np.linalg.norm(ordinary(sample["t"])[0] - y)))
        assert max(state_error) < 1e-9 and max(fuel_error) < 1e-12
        assert max(analytic_error) < 1e-10 and max(refinement) < 1e-10
        assert step["terminal"]["status"] == "horizon"
        assert step["terminal"]["propellant"] > 0.3 and step["certifiedIntervals"] > 0
        assert len(step["ledger"]) == len(burns) == 2
        for boundary, entry, (t, before, after, paid) in zip(
            step["boundaries"], step["ledger"], burns, strict=True
        ):
            assert boundary["t"] == entry["t"] == t
            assert abs(entry["fuelUsed"] - paid) < 1e-12
            assert np.linalg.norm(np.array(boundary["before"]["y"]) - before) < 1e-9
            assert np.linalg.norm(np.array(boundary["after"]["y"]) - after) < 1e-9
            assert (
                abs(boundary["before"]["propellant"] - boundary["after"]["propellant"] - paid)
                < 1e-12
            )
        checks.append(
            dict(
                step=step["step"],
                stateError=max(state_error),
                fuelError=max(fuel_error),
                analyticError=max(analytic_error),
                refinement=max(refinement),
                nodes=step["nodes"],
                certifiedIntervals=step["certifiedIntervals"],
            )
        )
    normals = [np.cross(y[:3], y[3:]) for _, y in anchors]
    normals = [v / np.linalg.norm(v) for v in normals]
    angles = [
        float(np.arccos(np.clip(np.dot(normals[i], normals[i + 1]), -1, 1)) * 180 / np.pi)
        for i in range(2)
    ]
    assert min(angles) > 40
    assert np.linalg.norm(normals[0] - normals[-1]) < 1e-10
    rows.append(
        dict(
            vessel=case["label"],
            checks=checks,
            planeChangeDegrees=angles,
            fuelRemaining=evaluate(24)[1],
            departureNormal=normals[0].tolist(),
            intermediateNormal=normals[1].tolist(),
            finalNormal=normals[2].tolist(),
        )
    )
(ROOT / "docs/evidence/spatial-viewer-oracle-report.json").write_text(
    json.dumps(rows, indent=2) + "\n"
)
print(json.dumps(rows, indent=2))
