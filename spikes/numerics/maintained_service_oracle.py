"""Independent replay of an online control stream and early/late admitted visits."""

import json
from pathlib import Path

import numpy as np
from target_oracle import integrate_target, target_at

from propulsion_oracle import evaluate, replay

ROOT = Path(__file__).resolve().parents[2]
request = json.loads((ROOT / "docs/evidence/maintained-service-input.json").read_text())
s = request["definition"]["world"]["scenario"]
rail = {"kind": "powered", **request["stream"]}
station = integrate_target(s, rail)
regular = integrate_target(s, rail, False)
stream_error = np.zeros(4)
for sample in request["stationSamples"]:
    truth = target_at(station, sample["t"])
    delta = np.array(sample["y"]) - truth[:6]
    stream_error = np.maximum(
        stream_error,
        [
            np.linalg.norm(delta[:3]),
            np.linalg.norm(delta[3:]),
            abs(sample["propellant"] - truth[6]),
            np.linalg.norm(target_at(regular, sample["t"]) - truth),
        ],
    )
assert max(stream_error[:2]) < 1e-7 and stream_error[2] < 1e-11
assert stream_error[3] < 1e-8
pairs = []
for pair in request["replay"]:
    visitor, final = replay(pair["bundle"], True)
    ordinary, _ = replay(pair["bundle"], False)
    assert final["status"] == "horizon" and len(final["captures"]) == 2
    assert final["fuel"] > 0.05 and final["cargo"] == 0.05
    assert all(max(c["position"], c["velocity"]) + 1e-8 < 1e-7 for c in final["captures"])
    target_rail = pair["bundle"]["scenario"]["logistics"]["ports"][1]["rail"]
    target = integrate_target(s, target_rail)
    # The independently integrated full stream and each leased anchor agree.
    lease_error = max(
        float(np.linalg.norm(target_at(target, t) - target_at(station, t)))
        for t in np.arange(target_rail["epoch"], target_rail["validUntil"] + 0.01, 0.5)
    )
    assert lease_error < 1e-7
    rows = []
    for check in pair["checks"]:
        errors = np.zeros(7)
        captures = [e for e in check["ledger"] if e["kind"] == "dock"]
        capture_allowance = sum(e["fuelUsed"] for e in captures)
        for sample in check["samples"]:
            t = sample["t"]
            y, fuel, cargo, _, used = evaluate(visitor, t)
            delta = np.array(sample["y"]) - y
            errors[:4] = np.maximum(
                errors[:4],
                [
                    np.linalg.norm(delta[:3]),
                    np.linalg.norm(delta[3:]),
                    max(abs(sample["propellant"] - fuel), abs(sample["fuelUsed"] - used)),
                    np.linalg.norm(evaluate(ordinary, t)[0] - y),
                ],
            )
            assert sample["logistics"]["cargoMass"] == cargo
        for sample in check["station"]:
            truth = target_at(target, sample["t"])
            delta = np.array(sample["y"]) - truth[:6]
            errors[4:] = np.maximum(
                errors[4:],
                [
                    np.linalg.norm(delta[:3]),
                    np.linalg.norm(delta[3:]),
                    abs(sample["propellant"] - truth[6]),
                ],
            )
        assert max(errors[0], errors[1], errors[4], errors[5]) < 1e-7
        assert errors[2] < capture_allowance + 1e-10 and errors[6] < 1e-11
        assert errors[3] < 1e-9
        assert [[e["t"], e["kind"], e["id"]] for e in check["ledger"]] == final["trace"]
        for capture in captures:
            assert max(capture["positionError"], capture["deltaV"]) + 1e-8 < 1e-7
            mass = (
                pair["bundle"]["scenario"]["ship"]["dryMass"] + 0.05 + capture["propellantBefore"]
            )
            paid = mass * -np.expm1(-capture["deltaV"] / 3)
            assert abs(paid - capture["fuelUsed"]) < 1e-12
        rows.append(
            dict(
                step=check["step"],
                visitorPosition=errors[0],
                visitorVelocity=errors[1],
                visitorFuel=errors[2],
                oracleRefinement=errors[3],
                stationPosition=errors[4],
                stationVelocity=errors[5],
                stationFuel=errors[6],
                paidCaptures=capture_allowance,
            )
        )
    pairs.append(
        dict(
            departure=pair["departure"],
            checks=rows,
            independentCaptures=final["captures"],
            leaseStreamError=lease_error,
            finalFuel=final["fuel"],
        )
    )
report = dict(
    stationStreamPosition=stream_error[0],
    stationStreamVelocity=stream_error[1],
    stationStreamFuel=stream_error[2],
    streamOracleRefinement=stream_error[3],
    pairs=pairs,
)
(ROOT / "docs/evidence/maintained-service-oracle.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(json.dumps(report, indent=2))
