"""Independent replay of the frozen maintained relay and its visiting ship."""

import json
from pathlib import Path
from typing import Any

import numpy as np
from target_oracle import integrate_target, target_at

from propulsion_oracle import evaluate, replay

ROOT = Path(__file__).resolve().parents[2]
request = json.loads((ROOT / "docs/evidence/stationkeeping-oracle-input.json").read_text())
bundle = request["bundle"]
s = bundle["scenario"]
rail = s["logistics"]["ports"][1]["rail"]
station = integrate_target(s, rail)
regular = integrate_target(s, rail, False)
visitor, final = replay(bundle, True)
ordinary, _ = replay(bundle, False)
assert final["status"] == "horizon" and final["cargo"] == 0.05
before = next(p for p in reversed(visitor) if p[1] == 34 and p[0] < 34)[2](34)
target = target_at(station, 34)
assert (
    np.linalg.norm(before[:3] - target[:3]) + 1e-8 < 1e-7
    and np.linalg.norm(before[3:6] - target[3:6]) + 1e-8 < 1e-7
)
search = json.loads((ROOT / "docs/design/stationkeeping/search-report.json").read_text())
for alternative in ["nominalArrival", "baselineArrival"]:
    assert np.linalg.norm(target[:3] - np.array(search[alternative])[:3]) > 1e-5
rows = []
for step in request["steps"]:
    max_pos = max_vel = max_fuel = station_pos = station_vel = station_fuel = refinement = 0.0
    capture = next(e for e in step["ledger"] if e["id"] == "capture")
    for sample in step["samples"]:
        t = sample["t"]
        truth, fuel, cargo, _, used = evaluate(visitor, t)
        delta = np.array(sample["y"]) - truth
        max_pos = max(max_pos, float(np.linalg.norm(delta[:3])))
        max_vel = max(max_vel, float(np.linalg.norm(delta[3:])))
        max_fuel = max(max_fuel, abs(sample["propellant"] - fuel), abs(sample["fuelUsed"] - used))
        assert sample["logistics"]["cargoMass"] == cargo
        refinement = max(refinement, float(np.linalg.norm(evaluate(ordinary, t)[0] - truth)))
    for sample in step["station"]:
        t = sample["t"]
        truth = target_at(station, t)
        delta = np.array(sample["y"]) - truth[:6]
        station_pos = max(station_pos, float(np.linalg.norm(delta[:3])))
        station_vel = max(station_vel, float(np.linalg.norm(delta[3:])))
        station_fuel = max(
            station_fuel,
            abs(sample["propellant"] - truth[6]),
            abs(sample["fuelUsed"] - (0.6 - truth[6])),
        )
        refinement = max(refinement, float(np.linalg.norm(target_at(regular, t) - truth)))
    assert (
        max(max_pos, max_vel, station_pos, station_vel) < 1e-7
        and station_fuel < 1e-11
        and max_fuel < capture["fuelUsed"] + 1e-11
        and refinement < 1e-9
    )
    assert capture["positionError"] + 1e-8 < 1e-7 and capture["deltaV"] + 1e-8 < 1e-7
    mass = s["ship"]["dryMass"] + 0.05 + capture["propellantBefore"]
    paid = mass * -np.expm1(-capture["deltaV"] / s["ship"]["exhaustVelocity"])
    assert abs(paid - capture["fuelUsed"]) < 1e-12
    assert [[e["t"], e["kind"], e["id"]] for e in step["ledger"]] == [e[:3] for e in final["trace"]]
    expected = sorted(
        [(a["start"], "thrust-start", a["id"]) for a in rail["program"]["thrustArcs"]]
        + [(a["end"], "thrust-end", a["id"]) for a in rail["program"]["thrustArcs"]]
    )
    assert [(e["t"], e["kind"], e["id"]) for e in step["stationLedger"]] == expected
    rows.append(
        dict(
            step=step["step"],
            visitorPosition=max_pos,
            visitorVelocity=max_vel,
            visitorFuel=max_fuel,
            stationPosition=station_pos,
            stationVelocity=station_vel,
            stationFuel=station_fuel,
            oracleRefinement=refinement,
            capturePosition=capture["positionError"],
            captureSpeed=capture["deltaV"],
            paidCapture=capture["fuelUsed"],
            stationNodes=step["stationNodes"],
            visitorNodes=step["visitorNodes"],
            certifiedStationIntervals=step["certifiedIntervals"],
        )
    )
report: dict[str, Any] = dict(
    checks=rows,
    independentPreCapturePosition=float(np.linalg.norm(before[:3] - target[:3])),
    independentPreCaptureSpeed=float(np.linalg.norm(before[3:6] - target[3:6])),
    stationFinal=target_at(station, 64).tolist(),
    visitorFinal=final,
    firstPositionRefinement=rows[0]["visitorPosition"] / rows[1]["visitorPosition"],
)
assert report["firstPositionRefinement"] > 8
(ROOT / "docs/evidence/stationkeeping-oracle-report.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(json.dumps(report, indent=2))
