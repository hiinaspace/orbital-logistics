"""Independent steered transfer: seven-state DOP853, resources and event sides."""

import json
from pathlib import Path

import numpy as np
from steering_law import direction_at

from propulsion_oracle import evaluate, replay

ROOT = Path(__file__).resolve().parents[2]
request = json.loads((ROOT / "docs/evidence/steering-oracle-input.json").read_text())
bundle = request["bundle"]
tight, final = replay(bundle, True)
ordinary, _ = replay(bundle, False)
assert (
    final["status"] == "horizon" and final["stocks"]["Incline"][0] == 0.05 and final["cargo"] == 0
)
rows = []
for step in request["steps"]:
    capture = next(e for e in step["ledger"] if e["id"] == "capture")
    # A coarse trajectory pays its own residual correction; independent replay
    # pays its much smaller numerical residual. Bound their fuel disagreement
    # by that explicit payment, rather than treating capture as free.
    mass = bundle["scenario"]["ship"]["dryMass"] + 0.05 + capture["propellantBefore"]
    paid = mass * -np.expm1(-capture["deltaV"] / bundle["scenario"]["ship"]["exhaustVelocity"])
    assert abs(capture["fuelUsed"] - paid) < 1e-12
    fuel_allowance = capture["fuelUsed"] + 1e-11
    position = velocity = fuel = usage = heading = refinement = 0.0
    for sample in step["samples"]:
        y, f, cargo, stocks, used = evaluate(tight, sample["t"])
        dy = np.array(sample["y"]) - y
        position = max(position, float(np.linalg.norm(dy[:3])))
        velocity = max(velocity, float(np.linalg.norm(dy[3:])))
        fuel = max(fuel, abs(sample["propellant"] - f))
        usage = max(usage, abs(sample["fuelUsed"] - used))
        refinement = max(refinement, float(np.linalg.norm(evaluate(ordinary, sample["t"])[0] - y)))
        assert abs(sample["logistics"]["cargoMass"] - cargo) < 1e-12
        if "thrust" in sample:
            arc = next(
                a for a in bundle["program"]["thrustArcs"] if a["id"] == sample["thrust"]["id"]
            )
            direction = direction_at(arc, sample["t"])
            heading = max(
                heading, float(np.linalg.norm(np.array(sample["thrust"]["direction"]) - direction))
            )
            assert (
                sample["thrust"]["force"] <= 0.25 + 1e-12
                and sample["thrust"]["acceleration"] <= 0.14 + 1e-12
            )
    assert (
        max(position, velocity) < 1e-8
        and max(fuel, usage) < fuel_allowance
        and heading < 1e-12
        and refinement < 1e-9
    ), (step["step"], position, velocity, fuel, usage, heading, refinement)
    assert step["terminal"]["status"] == "horizon"
    assert [[e["t"], e["kind"], e["id"]] for e in step["ledger"]] == [e[:3] for e in final["trace"]]
    capture = next(e for e in step["ledger"] if e["id"] == "capture")
    assert capture["positionError"] + 1e-8 < 1e-7 and capture["deltaV"] + 1e-8 < 1e-7
    # Dense oracle is event-right. Free-flight solution at capture is retained as
    # the preceding segment endpoint, checked independently before the snap.
    before = next(s for s in reversed(tight) if s[1] == 15 and s[0] < 15)[2](15)
    target = next(s for s in tight if s[0] == 15)[2](15)
    assert np.linalg.norm(before[:3] - target[:3]) + 1e-8 < 1e-7
    assert np.linalg.norm(before[3:6] - target[3:6]) + 1e-8 < 1e-7
    boundary = next(b for b in step["boundaries"] if b["t"] == 15)
    assert np.linalg.norm(np.array(boundary["before"]["y"]) - before[:6]) < 1e-8
    assert abs(step["terminal"]["propellant"] - final["fuel"]) < fuel_allowance
    rows.append(
        dict(
            step=step["step"],
            position=position,
            velocity=velocity,
            fuel=fuel,
            usage=usage,
            heading=heading,
            refinement=refinement,
            capturePosition=capture["positionError"],
            captureSpeed=capture["deltaV"],
            nodes=step["nodes"],
            certifiedIntervals=step["certifiedIntervals"],
            capEpochs=step["caps"],
        )
    )
ratios = [rows[i]["position"] / rows[i + 1]["position"] for i in range(3)]
assert min(ratios) > 10
report = dict(
    coarseRefinementRatios=ratios,
    checks=rows,
    final=final,
    independentPreCapturePosition=float(np.linalg.norm(before[:3] - target[:3])),
    independentPreCaptureSpeed=float(np.linalg.norm(before[3:6] - target[3:6])),
)
(ROOT / "docs/evidence/steering-oracle-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
