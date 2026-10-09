"""Independent coupled DOP853 replay; no JavaScript trajectory providers."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from target_oracle import body_position

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/design/flexible-service/finite-witness.json"


def replay(request, tight=True):
    definition = request["definition"]
    plans = request.get("plans", [request.get("plan")])
    plan = plans[0]
    assert plan["base"]["t"] == 0, "Oracle starts at original anchors"
    ship, station = definition["world"]["scenario"]["ship"], definition["relay"]["ship"]
    bodies = definition["world"]["scenario"]["bodies"]
    controls = request.get("controls", plan["controls"])
    station_arcs = [a for control in controls for a in control["arcs"]]
    ship_arcs = [
        a
        for p in plans
        for leg in (p["outbound"], p["inbound"])
        for a in leg["program"]["thrustArcs"]
    ]
    end = max(c["t"] + 8 for c in controls)
    events = {}
    for p in plans:
        schedule = p["schedule"]
        for kind, epoch in schedule.items():
            events.setdefault(epoch, []).append((kind, p))
        events.setdefault(schedule["relayArrival"] + 0.5, []).append(("transfer", p))
        if "plans" in request:
            events.setdefault(p["end"], []).append(("refuel", p))
    knots = sorted(
        {
            0,
            end,
            *events.keys(),
            *(t for a in [*station_arcs, *ship_arcs] for t in (a["start"], a["end"])),
        }
    )
    y = np.r_[
        station["state"],
        station["propellant"],
        definition["origin"]["state"],
        ship["state"],
        plan["fuel"],
        0,
        0,
    ]
    pieces, captures, ownership = [], [], []
    mode = "home"
    stock_anchor, stock, imported = (
        0,
        next(
            p["propellant"] for p in definition["stations"] if p["id"] == definition["origin"]["id"]
        ),
        0,
    )
    depot = next(p for p in definition["stations"] if p["id"] == definition["origin"]["id"])

    def gravity(t, position):
        acceleration = np.zeros(3)
        for body in bodies:
            delta = body_position(body, t) - position
            radius = np.linalg.norm(delta)
            assert radius > body["radius"] + 0.2
            acceleration += body["mu"] * delta / radius**3
        return acceleration

    def engine(hardware, arc, mass):
        force = (
            0
            if arc is None
            else min(
                hardware["engine"]["maxThrust"] * arc["throttle"],
                hardware["engine"]["maxAcceleration"] * mass,
            )
        )
        return force, np.zeros(3) if arc is None else np.array(arc["direction"]) * force / mass

    for lo, hi in zip(knots, knots[1:]):
        for kind, p in events.get(lo, []):
            if kind == "departure":
                assert mode == "home" and abs(y[19] - p["fuel"]) < 1e-9
                mode = "flying"
                y[13:19] = y[7:13]
            elif kind in ("relayArrival", "homeArrival"):
                target = y[:6] if kind == "relayArrival" else y[7:13]
                distance, speed = (
                    np.linalg.norm(y[13:16] - target[:3]),
                    np.linalg.norm(y[16:19] - target[3:]),
                )
                assert max(distance, speed) + 1e-8 < 1e-7, (lo, distance, speed)
                fee = (ship["dryMass"] + ship["cargoMass"] + y[19]) * -np.expm1(
                    -speed / ship["exhaustVelocity"]
                )
                y[19] -= fee
                y[21] += fee
                y[13:19] = target
                captures.append(dict(t=lo, position=distance, velocity=speed, fee=fee))
                mode = "attached" if kind == "relayArrival" else "home"
            elif kind == "transfer":
                assert mode == "attached"
                mass_before = (
                    station["dryMass"] + y[6] + ship["dryMass"] + ship["cargoMass"] + y[19]
                )
                q = p["delivery"]
                assert abs(y[6] + q - station["tankCapacity"]) < 1e-9 and q <= y[19]
                y[6] += q
                y[19] -= q
                mass_after = station["dryMass"] + y[6] + ship["dryMass"] + ship["cargoMass"] + y[19]
                assert abs(mass_before - mass_after) < 1e-14
                ownership.append(
                    dict(t=lo, delivered=q, massBefore=mass_before, massAfter=mass_after)
                )
            elif kind == "release":
                assert mode == "attached"
                mode = "flying"
            elif kind == "refuel":
                assert mode == "home"
                q = ship["propellant"] - y[19]
                available = min(
                    depot["tankCapacity"], stock + depot["propellantRate"] * (lo - stock_anchor)
                )
                imported += available - stock
                assert q <= available
                stock, stock_anchor = available - q, lo
                y[19] += q
        station_arc = next((a for a in station_arcs if a["start"] <= lo < a["end"]), None)
        ship_arc = next((a for a in ship_arcs if a["start"] <= lo < a["end"]), None)

        def rhs(t, state):
            mass = (
                station["dryMass"]
                + state[6]
                + (ship["dryMass"] + ship["cargoMass"] + state[19] if mode == "attached" else 0)
            )
            force, acceleration = engine(station, station_arc, mass)
            station_derivative = np.r_[
                state[3:6],
                gravity(t, state[:3]) + acceleration,
                -force / station["exhaustVelocity"],
            ]
            origin_derivative = np.r_[state[10:13], gravity(t, state[7:10])]
            if mode == "attached":
                visitor_derivative = np.r_[station_derivative[:6], 0]
            elif mode == "home":
                visitor_derivative = np.r_[origin_derivative, 0]
            else:
                visitor_force, visitor_acceleration = engine(
                    ship, ship_arc, ship["dryMass"] + ship["cargoMass"] + state[19]
                )
                visitor_derivative = np.r_[
                    state[16:19],
                    gravity(t, state[13:16]) + visitor_acceleration,
                    -visitor_force / ship["exhaustVelocity"],
                ]
            return np.r_[
                station_derivative,
                origin_derivative,
                visitor_derivative,
                -station_derivative[6],
                -visitor_derivative[6],
            ]

        solution = solve_ivp(
            rhs,
            (lo, hi),
            y,
            method="DOP853",
            dense_output=True,
            rtol=2.3e-14 if tight else 2e-12,
            atol=2e-15 if tight else 2e-14,
        )
        assert solution.success
        pieces.append((lo, hi, solution.sol))
        y = solution.y[:, -1]
        assert y[6] >= 0.1 and y[19] >= 0.05
    if "plans" in request:
        available = min(
            depot["tankCapacity"], stock + depot["propellantRate"] * (end - stock_anchor)
        )
        imported += available - stock
        balance = (
            available
            + y[6]
            + y[19]
            + y[20]
            + y[21]
            - (depot["propellant"] + station["propellant"] + ship["propellant"] + imported)
        )
        assert abs(balance) < 1e-9, balance
    return pieces, captures, ownership


def at(pieces, t):
    return next(sol(t) for lo, hi, sol in reversed(pieces) if lo <= t <= hi)


def main():
    request = json.loads(SOURCE.read_text())
    pieces, captures, ownership = replay(request)
    ordinary, _, _ = replay(request, False)
    errors = dict(
        visitorPosition=0.0,
        visitorVelocity=0.0,
        visitorFuel=0.0,
        stationPosition=0.0,
        stationVelocity=0.0,
        stationFuel=0.0,
        refinement=0.0,
    )
    for sample in request["samples"]:
        truth = at(pieces, sample["t"])
        delta = np.array(sample["y"]) - truth[13:19]
        errors["visitorPosition"] = max(errors["visitorPosition"], np.linalg.norm(delta[:3]))
        errors["visitorVelocity"] = max(errors["visitorVelocity"], np.linalg.norm(delta[3:]))
        errors["visitorFuel"] = max(errors["visitorFuel"], abs(sample["propellant"] - truth[19]))
        errors["refinement"] = max(
            errors["refinement"], np.linalg.norm(truth - at(ordinary, sample["t"]))
        )
    for sample in request["station"]:
        truth = at(pieces, sample["t"])
        # Drawing streams include both boundary sides; compare post-event rows.
        if (
            sample["t"] == request["plan"]["schedule"]["relayArrival"] + 0.5
            and sample["propellant"] < 0.6 - 1e-10
        ):
            continue
        delta = np.array(sample["y"]) - truth[:6]
        errors["stationPosition"] = max(errors["stationPosition"], np.linalg.norm(delta[:3]))
        errors["stationVelocity"] = max(errors["stationVelocity"], np.linalg.norm(delta[3:]))
        errors["stationFuel"] = max(errors["stationFuel"], abs(sample["propellant"] - truth[6]))
    assert max(errors.values()) < 1e-7, errors
    assert max(errors["visitorFuel"], errors["stationFuel"]) < 1e-10
    report = dict(errors=errors, captures=captures, ownership=ownership)
    (ROOT / "docs/design/flexible-service/finite-oracle.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
