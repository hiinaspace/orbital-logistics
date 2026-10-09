"""Original-anchor two-lane DOP853 replay with one independent shared hub ledger."""

import json
from pathlib import Path

import numpy as np
from flexible_service_oracle import at, replay

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / "docs/design/multiship-service"
request = json.loads((DIRECTORY / "oracle-input.json").read_text())
reports, refuels, states = [], [], []
for lane in request["lanes"]:
    pieces, captures, ownership = replay(lane)
    ordinary, _, _ = replay(lane, False)
    errors = dict(
        station=0.0, stationFuel=0.0, visitor=0.0, visitorFuel=0.0, base=0.0, refinement=0.0
    )
    for sample in lane["station"]:
        truth = at(pieces, sample["t"])
        errors["station"] = max(errors["station"], float(np.linalg.norm(sample["y"] - truth[:6])))
        errors["stationFuel"] = max(errors["stationFuel"], abs(sample["propellant"] - truth[6]))
        errors["refinement"] = max(
            errors["refinement"], float(np.linalg.norm(truth - at(ordinary, sample["t"])))
        )
    for plan in lane["plans"]:
        truth = at(pieces, plan["base"]["t"])
        errors["base"] = max(
            errors["base"],
            float(np.linalg.norm(plan["base"]["y"] - truth[:6])),
            float(np.linalg.norm(plan["base"]["origin"] - truth[7:13])),
        )
        if plan["end"] <= request["through"]:
            before = next(
                sol(plan["end"]) for lo, hi, sol in reversed(pieces) if lo < plan["end"] <= hi
            )
            refuels.append((plan["end"], plan["visitorId"], 0.9 - before[19]))
    for visit in lane["replay"]:
        for sample in visit["samples"]:
            truth = (
                next(sol(sample["t"]) for lo, hi, sol in reversed(pieces) if lo < sample["t"] <= hi)
                if sample["t"] == visit["plan"]["end"]
                else at(pieces, sample["t"])
            )
            errors["visitor"] = max(
                errors["visitor"], float(np.linalg.norm(sample["y"] - truth[13:19]))
            )
            errors["visitorFuel"] = max(
                errors["visitorFuel"], abs(sample["propellant"] - truth[19])
            )
    assert max(errors.values()) < 1e-7, errors
    assert max(errors["stationFuel"], errors["visitorFuel"]) < 1e-9, errors
    assert len(captures) == 2 * len(lane["plans"])
    assert all(o["delivered"] > 0 for o in ownership)
    states.append(at(pieces, request["through"]))
    reports.append(
        dict(
            ship=lane["definition"]["vessels"][0]["id"],
            end=lane["end"],
            plans=len(lane["plans"]),
            errors=errors,
            captures=captures,
            ownership=ownership,
        )
    )

# The physical lanes are independent test particles in the same prescribed field.
# Their old single-lane ledger checks are not the network's resource authority.
# Reconstruct one clipped import/debit chain here from independently replayed fuel.
depot = request["definition"]["lanes"][0]["stations"][0]
stock, imported, anchor = depot["propellant"], 0.0, 0.0
allocations, anchors = [], {0: (stock, imported)}
for epoch, ship, amount in sorted(refuels):
    available = min(depot["tankCapacity"], stock + depot["propellantRate"] * (epoch - anchor))
    imported += available - stock
    assert 0 <= amount <= available
    stock, anchor = available - amount, epoch
    allocations.append(dict(t=epoch, ship=ship, amount=amount, stock=stock, imported=imported))
    anchors[epoch] = (stock, imported)
resource_error = 0.0
for supplied in request["resources"]:
    expected_stock, expected_imports = anchors[supplied["t"]]
    actual_stock = next(s["propellant"] for s in supplied["stocks"] if s["id"] == depot["id"])
    resource_error = max(
        resource_error,
        abs(expected_stock - actual_stock),
        abs(expected_imports - supplied["fuelImported"]),
    )
    assert all(s["propellant"] == 0 for s in supplied["stocks"] if s["id"] != depot["id"])
available = min(
    depot["tankCapacity"], stock + depot["propellantRate"] * (request["through"] - anchor)
)
imported += available - stock
actual = request["snapshot"]["resources"]
resource_error = max(
    resource_error,
    abs(available - actual["stocks"][0]["propellant"]),
    abs(imported - actual["fuelImported"]),
)
assert resource_error < 1e-9, resource_error
initial = depot["propellant"] + sum(
    lane["definition"]["relay"]["ship"]["propellant"]
    + lane["definition"]["world"]["scenario"]["ship"]["propellant"]
    for lane in request["lanes"]
)
balance = available + sum(s[6] + s[19] + s[20] + s[21] for s in states) - initial - imported
assert abs(balance) < 1e-9, balance
assert len(allocations) == request["snapshot"]["stats"]["completed"]
report = dict(
    through=request["through"],
    lanes=reports,
    allocations=allocations,
    sharedResourceError=resource_error,
    independentFuelBalanceError=balance,
)
(DIRECTORY / "oracle.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
