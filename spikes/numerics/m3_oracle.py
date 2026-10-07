"""Independent DOP853/discrete-resource replay of bounded kinematic-port logistics."""

from __future__ import annotations

import argparse
import json
from math import cos, expm1, hypot, sin
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

ROOT = Path(__file__).resolve().parents[2]


def replay(bundle, tight):
    s, program = bundle["scenario"], bundle["program"]
    spec, ship = s["logistics"], s["ship"]
    ports = {p["id"]: p for p in spec["ports"]}
    stocks = {p["id"]: [p["cargo"], p["propellant"]] for p in spec["ports"]}
    events = [(b["t"], 2, "burn", b) for b in program["burns"]]
    order = {"undock": 1, "dock": 3, "transfer": 4}
    for op in program["operations"]:
        events.append((op["t"], order[op["kind"]], op["kind"], op))
        if op["kind"] == "transfer":
            events.append((op["t"] + ports[op["portId"]]["serviceDuration"], 0, "complete", op))
    events.append((s["epoch"] + s["duration"], 5, "end", {}))
    events.sort(key=lambda e: (e[0], e[1]))
    y, fuel, cargo, docked, service = (
        np.array(ship["state"]),
        ship["propellant"],
        ship["cargoMass"],
        None,
        None,
    )
    t, pieces, used_total, trace = s["epoch"], [], 0.0, []
    failed = False
    completed_at = None

    def completion(epoch):
        nonlocal completed_at
        goal = spec["objective"]
        delivered = stocks[goal["destinationId"]][0] - ports[goal["destinationId"]]["cargo"]
        valid = (
            delivered >= goal["quota"] * (1 - 1e-12)
            and docked == goal["returnPortId"]
            and cargo <= 1e-12
            and fuel >= goal["minPropellant"]
            and service is None
            and (completed_at if completed_at is not None else epoch)
            <= goal.get("deadline", float("inf"))
        )
        completed_at = (completed_at if completed_at is not None else epoch) if valid else None

    def port_state(port_id, epoch):
        rail = ports[port_id]["rail"]
        theta = rail["phase"] + rail["rate"] * epoch
        x, yy = rail["radius"] * cos(theta), rail["radius"] * sin(theta)
        return np.array(
            [rail["center"][0] + x, rail["center"][1] + yy, -rail["rate"] * yy, rail["rate"] * x]
        )

    def rhs(_t, state):
        dx, dy = state[:2] - np.array(s["bodies"][0]["rail"]["position"])
        scale = -s["bodies"][0]["mu"] / hypot(dx, dy) ** 3
        return [state[2], state[3], dx * scale, dy * scale]

    def impulse(dv):
        nonlocal fuel, used_total
        used = (ship["dryMass"] + cargo + fuel) * -expm1(-dv / ship["exhaustVelocity"])
        assert used <= fuel
        fuel -= used
        used_total += used

    for epoch, _, kind, op in events:
        if epoch > t:
            if docked is not None:

                def dense(time, port=docked):
                    return port_state(port, time)
            else:
                solution = solve_ivp(
                    rhs,
                    (t, epoch),
                    y,
                    method="DOP853",
                    rtol=2.3e-14 if tight else 2e-12,
                    atol=2e-15 if tight else 2e-14,
                    dense_output=True,
                )
                assert solution.success
                dense = solution.sol
            pieces.append((t, epoch, dense, fuel, cargo, json.loads(json.dumps(stocks))))
            y = dense(epoch)
            t = epoch
        if kind == "end":
            break
        if kind == "complete":
            assert service == op["id"]
            cargo += op["cargo"]
            fuel += op["propellant"]
            stocks[op["portId"]][0] -= op["cargo"]
            stocks[op["portId"]][1] -= op["propellant"]
            service = None
            trace.append([epoch, "transfer", op["id"]])
            completion(epoch)
            continue
        if kind == "burn":
            assert docked is None
            displacement = y[:2] - np.array(s["bodies"][0]["rail"]["position"])
            radial = displacement / np.linalg.norm(displacement)
            dv = radial * op["radial"] + np.array([-radial[1], radial[0]]) * op["transverse"]
            impulse(float(np.linalg.norm(dv)))
            y = y.copy()
            y[2:] += dv
        else:
            port = ports[op["portId"]]
            if service is not None:
                failed = True
            elif kind == "dock":
                other = port_state(op["portId"], epoch)
                delta = other - y
                failed = (
                    docked is not None
                    or np.linalg.norm(delta[:2]) > spec["capture"]["position"]
                    or np.linalg.norm(delta[2:]) > spec["capture"]["velocity"]
                )
                if not failed:
                    impulse(float(np.linalg.norm(delta[2:])))
                    y, docked = other, op["portId"]
            elif docked != op["portId"]:
                failed = True
            elif kind == "undock":
                docked = None
            elif kind == "transfer":
                pc, pf = stocks[op["portId"]]
                failed = not (
                    0 <= cargo + op["cargo"] <= spec["cargoCapacity"]
                    and 0 <= pc - op["cargo"] <= port["cargoCapacity"]
                    and fuel + op["propellant"] <= ship["tankCapacity"]
                    and pf - op["propellant"] >= 0
                )
                if not failed:
                    service = op["id"]
        trace.append(
            [
                epoch,
                "operation-rejected"
                if failed
                else "transfer-start"
                if kind == "transfer"
                else kind,
                op["id"],
            ]
        )
        completion(epoch)
        if failed:
            break
    pieces.append(
        (t, t, lambda _time, state=y.copy(): state, fuel, cargo, json.loads(json.dumps(stocks)))
    )
    return pieces, {
        "t": t,
        "status": "operation-rejected" if failed else "horizon",
        "fuel": fuel,
        "fuelUsed": used_total,
        "cargo": cargo,
        "stocks": stocks,
        "trace": trace,
        "complete": not failed and completed_at is not None,
        "completedAt": completed_at if not failed else None,
    }


def evaluate(pieces, t):
    return next(
        (dense(t), fuel, cargo, stocks)
        for start, _end, dense, fuel, cargo, stocks in reversed(pieces)
        if start <= t
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--milestone", choices=["m3", "m4"], default="m3")
    milestone = parser.parse_args().milestone
    request = json.loads((ROOT / f"docs/evidence/{milestone}-oracle-input.json").read_text())
    rows = []
    for case in request["cases"]:
        pieces, result = replay(case["bundle"], True)
        regular, _ = replay(case["bundle"], False)
        checks = []
        for step in case["steps"]:
            position, velocity, refinement = [], [], []
            for sample in step["samples"]:
                oracle, fuel, cargo, stocks = evaluate(pieces, sample["t"])
                delta = np.array(sample["y"]) - oracle
                position.append(float(np.linalg.norm(delta[:2])))
                velocity.append(float(np.linalg.norm(delta[2:])))
                refinement.append(float(np.linalg.norm(evaluate(regular, sample["t"])[0] - oracle)))
                assert abs(sample["propellant"] - fuel) < 1e-11
                assert sample["logistics"]["cargoMass"] == cargo
                assert all(
                    [p["cargo"], p["propellant"]] == stocks[p["id"]]
                    for p in sample["logistics"]["ports"]
                )
            assert max(position) < 1e-9 and max(velocity) < 1e-9 and max(refinement) < 1e-9
            assert (
                step["terminal"]["t"] == result["t"]
                and step["terminal"]["status"] == result["status"]
            )
            assert [[e["t"], e["kind"], e["id"]] for e in step["ledger"]] == result["trace"]
            assert abs(step["result"]["propellantUsed"] - result["fuelUsed"]) < 1e-11
            assert step["result"]["complete"] == result["complete"]
            assert step["result"].get("completedAt") == result["completedAt"]
            checks.append(
                {
                    "step": step["step"],
                    "position": max(position),
                    "velocity": max(velocity),
                    "oracleRefinement": max(refinement),
                }
            )
        rows.append({"case": case["label"], "terminal": result, "checks": checks})
    (ROOT / f"docs/evidence/{milestone}-oracle-report.json").write_text(
        json.dumps(rows, indent=2) + "\n"
    )
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
