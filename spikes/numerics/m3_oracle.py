"""Independent DOP853/discrete-resource replay of bounded kinematic-port logistics."""

from __future__ import annotations

import argparse
import json
from math import cos, expm1, sin
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

ROOT = Path(__file__).resolve().parents[2]


def lift_state(value):
    return np.array(
        value if len(value) == 6 else [value[0], value[1], 0, value[2], value[3], 0], dtype=float
    )


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
        lift_state(ship["state"]),
        ship["propellant"],
        ship["cargoMass"],
        None,
        None,
    )
    t, pieces, used_total, trace = s["epoch"], [], 0.0, []
    failed = False
    completed_at = None
    captures = []

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

    target_solutions = {}

    def body_state(body, epoch):
        rail = body["rail"]
        if rail["kind"] == "fixed":
            return np.array(
                rail["position"] if len(rail["position"]) == 3 else [*rail["position"], 0]
            )
        theta = rail["phase"] + rail["rate"] * epoch
        u, v = np.array(rail.get("u", [1, 0, 0])), np.array(rail.get("v", [0, 1, 0]))
        center = np.array(rail["center"] if len(rail["center"]) == 3 else [*rail["center"], 0])
        return center + rail["radius"] * (u * cos(theta) + v * sin(theta))

    def port_state(port_id, epoch):
        rail = ports[port_id]["rail"]
        if rail["kind"] == "ballistic":
            assert rail["epoch"] <= epoch <= rail["validUntil"]
            if port_id not in target_solutions:
                solution = solve_ivp(
                    rhs,
                    (rail["epoch"], rail["validUntil"]),
                    rail["state"],
                    method="DOP853",
                    dense_output=True,
                    rtol=2.3e-14 if tight else 2e-13,
                    atol=2e-15 if tight else 2e-15,
                )
                assert solution.success
                target_solutions[port_id] = solution.sol
            return target_solutions[port_id](epoch)
        theta = rail["phase"] + rail["rate"] * epoch
        u = np.array(rail.get("u", [1, 0, 0]))
        v = np.array(rail.get("v", [0, 1, 0]))
        center = np.array(rail["center"] if len(rail["center"]) == 3 else [*rail["center"], 0])
        return np.concatenate(
            (
                center + rail["radius"] * (u * cos(theta) + v * sin(theta)),
                rail["radius"] * rail["rate"] * (-u * sin(theta) + v * cos(theta)),
            )
        )

    def rhs(epoch, state):
        acceleration = np.zeros(3)
        for body in s["bodies"]:
            displacement = state[:3] - body_state(body, epoch)
            radius = np.linalg.norm(displacement)
            assert radius > body["radius"]
            acceleration -= body["mu"] * displacement / radius**3
        return np.concatenate((state[3:], acceleration))

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
                    rtol=2.3e-14 if tight else 2e-13,
                    atol=2e-15 if tight else 2e-15,
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
            reference = next(body for body in s["bodies"] if body["id"] == op["referenceBodyId"])
            displacement = y[:3] - body_state(reference, epoch)
            radial = displacement / np.linalg.norm(displacement)
            if op["basis"] == "inertial-cartesian-v2":
                dv = np.array(op["deltaVelocity"])
            else:
                transverse = np.cross(op.get("orientationAxis", [0, 0, 1]), radial)
                transverse /= np.linalg.norm(transverse)
                normal = np.cross(radial, transverse)
                dv = (
                    radial * op["radial"]
                    + transverse * op["transverse"]
                    + normal * op.get("normal", 0)
                )
            impulse(float(np.linalg.norm(dv)))
            y = y.copy()
            y[3:] += dv
        else:
            port = ports[op["portId"]]
            if service is not None:
                failed = True
            elif kind == "dock":
                other = port_state(op["portId"], epoch)
                delta = other - y
                failed = (
                    docked is not None
                    or np.linalg.norm(delta[:3]) > spec["capture"]["position"]
                    or np.linalg.norm(delta[3:]) > spec["capture"]["velocity"]
                )
                captures.append(
                    {
                        "t": epoch,
                        "position": float(np.linalg.norm(delta[:3])),
                        "velocity": float(np.linalg.norm(delta[3:])),
                    }
                )
                if not failed:
                    impulse(float(np.linalg.norm(delta[3:])))
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
        "captures": captures,
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
    parser.add_argument(
        "--milestone",
        choices=["m3", "m4", "model-set", "spatial-logistics", "lunar-freight"],
        default="m3",
    )
    milestone = parser.parse_args().milestone
    request = json.loads((ROOT / f"docs/evidence/{milestone}-oracle-input.json").read_text())
    rows = []
    for case in request["cases"]:
        pieces, result = replay(case["bundle"], True)
        regular, _ = replay(case["bundle"], False)
        checks = []
        for step in case["steps"]:
            lunar = milestone == "lunar-freight"
            budget = (
                (1e-6 if step["step"] >= 1 / 1024 else 1e-7 if step["step"] >= 1 / 2048 else 1e-8)
                if lunar
                else 1e-9
            )
            fuel_budget = budget if lunar else 1e-11
            position, velocity, refinement, fuel_errors = [], [], [], []
            capture_position_error = capture_velocity_error = 0.0
            for sample in step["samples"]:
                oracle, fuel, cargo, stocks = evaluate(pieces, sample["t"])
                delta = lift_state(sample["y"]) - oracle
                position.append(float(np.linalg.norm(delta[:3])))
                velocity.append(float(np.linalg.norm(delta[3:])))
                refinement.append(float(np.linalg.norm(evaluate(regular, sample["t"])[0] - oracle)))
                fuel_errors.append(abs(sample["propellant"] - fuel))
                assert fuel_errors[-1] < fuel_budget
                assert sample["logistics"]["cargoMass"] == cargo
                assert all(
                    [p["cargo"], p["propellant"]] == stocks[p["id"]]
                    for p in sample["logistics"]["ports"]
                )
            if milestone in ["spatial-logistics", "lunar-freight"]:
                docks = [entry for entry in step["ledger"] if entry["kind"] == "dock"]
                for dock, capture in zip(docks, result["captures"], strict=True):
                    capture_position_error = max(
                        capture_position_error, abs(dock["positionError"] - capture["position"])
                    )
                    capture_velocity_error = max(
                        capture_velocity_error, abs(dock["deltaV"] - capture["velocity"])
                    )
                    assert abs(dock["positionError"] - capture["position"]) < budget
                    assert abs(dock["deltaV"] - capture["velocity"]) < budget
                    assert (
                        capture["position"] + (2 * budget if lunar else 2e-8)
                        < case["bundle"]["scenario"]["logistics"]["capture"]["position"]
                    )
                    assert (
                        capture["velocity"] + (2 * budget if lunar else 2e-8)
                        < case["bundle"]["scenario"]["logistics"]["capture"]["velocity"]
                    )
            assert max(position) < budget and max(velocity) < budget and max(refinement) < 1e-9, (
                case["label"],
                step["step"],
                max(position),
                max(velocity),
                max(refinement),
                budget,
            )
            assert (
                step["terminal"]["t"] == result["t"]
                and step["terminal"]["status"] == result["status"]
            )
            assert [[e["t"], e["kind"], e["id"]] for e in step["ledger"]] == result["trace"]
            assert abs(step["result"]["propellantUsed"] - result["fuelUsed"]) < fuel_budget
            assert step["result"]["complete"] == result["complete"]
            assert step["result"].get("completedAt") == result["completedAt"]
            checks.append(
                {
                    "step": step["step"],
                    "position": max(position),
                    "velocity": max(velocity),
                    "oracleRefinement": max(refinement),
                    **(
                        {
                            "stateBudget": budget,
                            "fuelError": max(fuel_errors),
                            "capturePositionError": capture_position_error,
                            "captureVelocityError": capture_velocity_error,
                            "capturePositionMargin": case["bundle"]["scenario"]["logistics"][
                                "capture"
                            ]["position"]
                            - max(c["position"] for c in result["captures"])
                            - 2 * budget,
                            "captureVelocityMargin": case["bundle"]["scenario"]["logistics"][
                                "capture"
                            ]["velocity"]
                            - max(c["velocity"] for c in result["captures"])
                            - 2 * budget,
                        }
                        if lunar
                        else {}
                    ),
                }
            )
        rows.append({"case": case["label"], "terminal": result, "checks": checks})
    (ROOT / f"docs/evidence/{milestone}-oracle-report.json").write_text(
        json.dumps(rows, indent=2) + "\n"
    )
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
