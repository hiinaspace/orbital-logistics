"""Independent inertial DOP853 witnesses of online lunar ground service."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from steering_law import direction_at

ROOT = Path(__file__).resolve().parents[2]
data = json.loads((ROOT / "docs/evidence/lunar-service-input.json").read_text())


def body_state(b, t):
    r = b["rail"]
    if r["kind"] == "fixed":
        return np.r_[r["position"], [0.0, 0.0, 0.0]]
    a = r["phase"] + r["rate"] * t
    u, v = np.array(r["u"]), np.array(r["v"])
    return np.r_[
        np.array(r["center"]) + r["radius"] * (u * math.cos(a) + v * math.sin(a)),
        r["radius"] * r["rate"] * (-u * math.sin(a) + v * math.cos(a)),
    ]


def gravity(bodies, t, y):
    out = np.zeros(3)
    for b in bodies:
        delta = body_state(b, t)[:3] - y[:3]
        out += b["mu"] * delta / np.linalg.norm(delta) ** 3
    return out


def pad_state(p, bodies, t):
    r = p["rail"]
    owner = next(b for b in bodies if b["id"] == r["bodyId"])
    a = r["phase"] + r["rate"] * t
    radius = owner["radius"] + r["centerHeight"]
    c, s = math.cos(r["latitude"]), math.sin(r["latitude"])
    return body_state(owner, t) + np.array(
        [
            radius * c * math.cos(a),
            radius * c * math.sin(a),
            radius * s,
            -radius * c * r["rate"] * math.sin(a),
            radius * c * r["rate"] * math.cos(a),
            0.0,
        ]
    )


reports = []
for data in data["cases"]:
    b = data["grids"][0]["bundle"]
    s, program = b["scenario"], b["program"]
    bodies = s["bodies"]
    pad = next(p for p in s["logistics"]["ports"] if p["rail"]["kind"] == "surface")
    depot = next(p for p in s["logistics"]["ports"] if p["rail"]["kind"] == "ballistic")
    station = solve_ivp(
        lambda t, y: np.r_[y[3:], gravity(bodies, t, y)],
        (0, s["epoch"] + s["duration"]),
        data["originalDepotState"],
        method="DOP853",
        rtol=2e-13,
        atol=2e-14,
        max_step=1 / 4096,
        dense_output=True,
    )
    assert station.success
    ship = s["ship"]
    fuel = ship["propellant"]
    cargo = ship["cargoMass"]
    stock = {
        p["id"]: {"cargo": p["cargo"], "fuel": p["propellant"]} for p in s["logistics"]["ports"]
    }
    captures = []
    flights = []
    coasts = []
    coast_clearance = math.inf
    y = np.array(ship["state"])
    arcs = program["thrustArcs"]
    operations = program["operations"]
    used = 0.0
    service = pad["serviceDuration"]
    # Execute actual finite stocks and burn mass laws; no production target states seed the oracle.
    load = next(o for o in operations if o["id"] == "load")
    fuel += load["propellant"]
    stock[pad["id"]]["fuel"] -= load["propellant"]
    cargo += load["cargo"]
    stock[pad["id"]]["cargo"] -= load["cargo"]
    for index, arc in enumerate(arcs):
        if index == 0:
            y = pad_state(pad, bodies, arc["start"])
        elif index == 1:
            y = station.sol(arc["start"])
        else:
            # Continue the previous powered state through free flight. No depot
            # re-seeding, surface attachment or capture at an internal arc end.
            coast = solve_ivp(
                lambda t, state: np.r_[state[3:6], gravity(bodies, t, state), 0.0],
                (arcs[index - 1]["end"], arc["start"]),
                np.r_[y, fuel],
                method="DOP853",
                rtol=2e-13,
                atol=2e-14,
                max_step=1 / 32768,
                dense_output=True,
            )
            assert coast.success
            # Independent clearance witness for the newly introduced free flight.
            for body in bodies:
                clearance = float(
                    np.min(
                        np.linalg.norm(
                            coast.y[:3].T - np.array([body_state(body, t)[:3] for t in coast.t]),
                            axis=1,
                        )
                        - body["radius"]
                    )
                )
                assert clearance > 0
                if body["id"] == "moon":
                    coast_clearance = min(coast_clearance, clearance)
            coasts.append(coast)
            y = coast.y[:6, -1]
        initial = np.r_[y, fuel]
        pieces = []
        current = initial.copy()
        times = [arc["start"] + k["offset"] for k in arc["steering"]["keys"]]
        for lo, hi in zip(times, times[1:], strict=False):

            def rhs(t, state):
                mass = ship["dryMass"] + cargo + state[6]
                force = min(
                    ship["engine"]["maxThrust"] * arc["throttle"],
                    ship["engine"]["maxAcceleration"] * mass,
                )
                return np.r_[
                    state[3:6],
                    gravity(bodies, t, state) + direction_at(arc, t) * force / mass,
                    -force / ship["exhaustVelocity"],
                ]

            sol = solve_ivp(
                rhs,
                (lo, hi),
                current,
                method="DOP853",
                rtol=2e-13,
                atol=2e-14,
                max_step=1 / 32768,
                dense_output=True,
            )
            assert sol.success
            pieces.append(sol)
            current = sol.y[:, -1]

        def at(t):
            return next(p for p in pieces if p.t[0] - 1e-15 <= t <= p.t[-1] + 1e-15).sol(t)

        burn = fuel - current[6]
        used += burn
        fuel = current[6]
        y = current[:6]
        minimum = min(
            float(
                np.min(
                    np.linalg.norm(
                        piece.y[:3].T - np.array([body_state(bodies[1], t)[:3] for t in piece.t]),
                        axis=1,
                    )
                    - bodies[1]["radius"]
                )
            )
            for piece in pieces
        )
        assert minimum > 0 and fuel > 0
        # Only actual station arrival and final touchdown perform captures.
        if index == 0 or index == len(arcs) - 1:
            expected = station.sol(arc["end"]) if index == 0 else pad_state(pad, bodies, arc["end"])
            pos = float(np.linalg.norm(current[:3] - expected[:3]))
            dv = float(np.linalg.norm(current[3:6] - expected[3:]))
            capture = (ship["dryMass"] + cargo + fuel) * (
                -math.expm1(-dv / ship["exhaustVelocity"])
            )
            used += capture
            fuel -= capture
            assert (
                pos < s["logistics"]["capture"]["position"]
                and dv < s["logistics"]["capture"]["velocity"]
            )
            captures.append(
                {
                    "id": arc["id"],
                    "positionError": pos,
                    "deltaV": dv,
                    "propellantAfter": float(fuel),
                    "minimumMoonClearance": minimum,
                }
            )
        flights.append((arc, at, pieces))
        if index == 0:
            unload = next(o for o in operations if o["id"] == "unload")
            cargo += unload["cargo"]
            stock[depot["id"]]["cargo"] -= unload["cargo"]
            topup = next(o for o in operations if o["id"] == "top-up")
            fuel += topup["propellant"]
            stock[depot["id"]]["fuel"] -= topup["propellant"]
    errors = []
    # Dense output closures above would share pieces; bind each accepted piece list explicitly.
    for grid in data["grids"]:
        position = velocity = fuel_error = target_error = 0.0
        for gflight, (_, _, pieces) in zip(grid["flights"], flights, strict=True):
            for sample in gflight["samples"]:
                t = sample["t"]
                truth = next(p for p in pieces if p.t[0] - 1e-15 <= t <= p.t[-1] + 1e-15).sol(t)
                position = max(
                    position, float(np.linalg.norm(np.array(sample["y"][:3]) - truth[:3]))
                )
                velocity = max(
                    velocity, float(np.linalg.norm(np.array(sample["y"][3:]) - truth[3:6]))
                )
                fuel_error = max(fuel_error, abs(sample["propellant"] - truth[6]))
        for gcoast, truth_coast in zip(grid.get("coasts", []), coasts, strict=True):
            for sample in gcoast["samples"]:
                truth = truth_coast.sol(sample["t"])
                position = max(
                    position, float(np.linalg.norm(np.array(sample["y"][:3]) - truth[:3]))
                )
                velocity = max(
                    velocity, float(np.linalg.norm(np.array(sample["y"][3:]) - truth[3:6]))
                )
                fuel_error = max(fuel_error, abs(sample["propellant"] - truth[6]))
        for sample in grid["targetSamples"]:
            target_error = max(
                target_error,
                float(np.linalg.norm(np.array(sample["y"]) - station.sol(sample["t"]))),
            )
        errors.append(
            {
                "step": grid["step"],
                "position": position,
                "velocity": velocity,
                "fuel": float(fuel_error),
                "targetSixState": target_error,
            }
        )
        assert position < 1e-7 and velocity < 1e-6 and fuel_error < 1e-7 and target_error < 1e-6
    assert fuel > s["logistics"]["objective"]["minPropellant"]
    assert (
        abs(
            cargo
            + sum(p["cargo"] for p in stock.values())
            - sum(p["cargo"] for p in s["logistics"]["ports"])
        )
        < 1e-12
    )
    assert (
        abs(
            fuel
            + used
            + sum(p["fuel"] for p in stock.values())
            - ship["propellant"]
            - sum(p["propellant"] for p in s["logistics"]["ports"])
        )
        < 1e-10
    )
    report = {
        "method": (
            "inertial DOP853; full binary gravity; "
            "independently propagated target and surface provider"
        ),
        "errors": errors,
        "captures": captures,
        "returnFuel": float(fuel),
        "minimumCoastMoonClearance": coast_clearance if coasts else None,
        "cargo": cargo,
        "stock": stock,
        "display": data["view"],
    }
    report["id"] = data["id"]
    reports.append(report)
rollout = json.loads((ROOT / "docs/evidence/lunar-service-rollout.json").read_text())
world = solve_ivp(
    lambda t, y: np.r_[y[3:], gravity(bodies, t, y)],
    (0, 64),
    data["originalDepotState"],
    method="DOP853",
    rtol=2e-13,
    atol=2e-14,
    max_step=1 / 1024,
    dense_output=True,
)
assert world.success
position = velocity = 0.0
for row in rollout["rollout"]:
    truth = world.sol(row["t"])
    position = max(position, float(np.linalg.norm(np.array(row["depotState"][:3]) - truth[:3])))
    velocity = max(velocity, float(np.linalg.norm(np.array(row["depotState"][3:]) - truth[3:])))
clearance = float(
    np.min(
        np.linalg.norm(
            world.y[:3].T - np.array([body_state(bodies[1], t)[:3] for t in world.t]), axis=1
        )
        - bodies[1]["radius"]
    )
)
assert position < 1e-7 and velocity < 1e-6 and clearance > 0.0001
report = {
    "missions": reports,
    "depotCalendar": {
        "end": 64,
        "position": position,
        "velocity": velocity,
        "minimumMoonClearance": clearance,
    },
}
(ROOT / "docs/evidence/lunar-service-oracle.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
