"""Original-anchor independent replay of a funded online coupled control stream."""

import json
from pathlib import Path

import numpy as np
from flexible_service_oracle import at, replay

ROOT = Path(__file__).resolve().parents[2]
request = json.loads((ROOT / "docs/design/flexible-service/online-oracle-input.json").read_text())
pieces, captures, ownership = replay(request)
ordinary, _, _ = replay(request, False)
errors = dict(
    stationPosition=0.0,
    stationVelocity=0.0,
    stationFuel=0.0,
    baseAnchor=0.0,
    visitorPosition=0.0,
    visitorVelocity=0.0,
    visitorFuel=0.0,
    refinement=0.0,
)
for sample in request["station"]:
    truth = at(pieces, sample["t"])
    delta = np.array(sample["y"]) - truth[:6]
    errors["stationPosition"] = max(errors["stationPosition"], np.linalg.norm(delta[:3]))
    errors["stationVelocity"] = max(errors["stationVelocity"], np.linalg.norm(delta[3:]))
    errors["stationFuel"] = max(errors["stationFuel"], abs(sample["propellant"] - truth[6]))
    errors["refinement"] = max(
        errors["refinement"], np.linalg.norm(truth - at(ordinary, sample["t"]))
    )
for plan in request["plans"]:
    truth = at(pieces, plan["base"]["t"])
    errors["baseAnchor"] = max(
        errors["baseAnchor"],
        np.linalg.norm(np.array(plan["base"]["y"]) - truth[:6]),
        np.linalg.norm(np.array(plan["base"]["origin"]) - truth[7:13]),
    )
for visit in request["replay"]:
    for sample in visit["samples"]:
        # The visitor episode ends immediately before the independently funded
        # origin refuel; the runtime boundary owns that later tank jump.
        truth = (
            next(sol(sample["t"]) for lo, hi, sol in reversed(pieces) if lo < sample["t"] <= hi)
            if sample["t"] == visit["plan"]["end"]
            else at(pieces, sample["t"])
        )
        delta = np.array(sample["y"]) - truth[13:19]
        errors["visitorPosition"] = max(errors["visitorPosition"], np.linalg.norm(delta[:3]))
        errors["visitorVelocity"] = max(errors["visitorVelocity"], np.linalg.norm(delta[3:]))
        errors["visitorFuel"] = max(errors["visitorFuel"], abs(sample["propellant"] - truth[19]))
        assert sample.get("thrust") is None or sample["activity"]["kind"] == "flying"
assert max(errors.values()) < 1e-7, errors
assert max(errors["stationFuel"], errors["visitorFuel"]) < 1e-9, errors
report = dict(
    end=request["end"],
    plans=len(request["plans"]),
    errors=errors,
    captures=captures,
    ownership=ownership,
    replayedDepartures=[v["plan"]["schedule"]["departure"] for v in request["replay"]],
)
(ROOT / "docs/design/flexible-service/online-oracle.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(json.dumps(report, indent=2))
