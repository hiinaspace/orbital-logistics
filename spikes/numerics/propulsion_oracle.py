"""Independent DOP853/discrete-resource replay of finite-thrust/discrete-resource logistics."""

from __future__ import annotations

import json
from math import cos, expm1, sin
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from steering_law import direction_at
from target_oracle import integrate_target, target_at

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
    events = [(b["t"], 3, "burn", b) for b in program["burns"]]
    for arc in program["thrustArcs"]:
        events.extend([(arc["start"], 6, "thrust-start", arc), (arc["end"], 0, "thrust-end", arc)])
        events.extend(
            (arc["start"] + k["offset"], 3, "steering-knot", arc)
            for k in arc.get("steering", {}).get("keys", [])[1:-1]
        )
    order = {"launch": 2, "undock": 2, "dock": 4, "land": 4, "transfer": 5}
    for op in program["operations"]:
        events.append((op["t"], order[op["kind"]], op["kind"], op))
        if op["kind"] == "transfer":
            events.append((op["t"] + ports[op["portId"]]["serviceDuration"], 1, "complete", op))
    events.append((s["epoch"] + s["duration"], 7, "end", {}))
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
    active = None

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
        if rail["kind"] == "powered":
            if port_id not in target_solutions:
                target_solutions[port_id] = integrate_target(s, rail, tight)
            return target_at(target_solutions[port_id], epoch)[:6]
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
        if len(state) == 6:
            return np.concatenate((state[3:], acceleration))
        force = (
            0.0
            if active is None
            else min(
                ship["engine"]["maxThrust"] * active["throttle"],
                ship["engine"].get("maxAcceleration", float("inf"))
                * (ship["dryMass"] + cargo + state[6]),
            )
        )
        if active is not None:
            acceleration += (
                force / (ship["dryMass"] + cargo + state[6]) * direction_at(active, epoch)
            )
        return np.concatenate((state[3:6], acceleration, [-force / ship["exhaustVelocity"]]))

    def impulse(dv):
        nonlocal fuel, used_total
        used = (ship["dryMass"] + cargo + fuel) * -expm1(-dv / ship["exhaustVelocity"])
        assert used <= fuel
        fuel -= used
        used_total += used

    for epoch, _, kind, op in events:
        if epoch > t:
            if docked is not None:

                def dense(time, port=docked, amount=fuel):
                    return np.concatenate((port_state(port, time), [amount]))
            else:
                solution = solve_ivp(
                    rhs,
                    (t, epoch),
                    np.concatenate((y, [fuel])),
                    method="DOP853",
                    rtol=2.3e-14 if tight else 2e-13,
                    atol=2e-15 if tight else 2e-15,
                    dense_output=True,
                )
                assert solution.success
                dense = solution.sol
            pieces.append(
                (t, epoch, dense, fuel, cargo, json.loads(json.dumps(stocks)), used_total)
            )
            state = dense(epoch)
            used_total += fuel - state[6]
            y, fuel = state[:6], float(state[6])
            t = epoch
        if kind == "end":
            break
        if kind == "steering-knot":
            continue
        if kind in ("thrust-start", "thrust-end"):
            assert docked is None
            active = op if kind == "thrust-start" else None
            trace.append([epoch, kind, op["id"]])
            continue
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
            elif kind in ("dock", "land"):
                other = port_state(op["portId"], epoch)
                delta = other - y
                position_tolerance = spec["capture"]["position"]
                if kind == "land":
                    rail = port["rail"]
                    assert rail["kind"] == "surface" and active is None
                    body = next(b for b in s["bodies"] if b["id"] == rail["bodyId"])
                    clearance = np.linalg.norm(other[:3] - body_state(body, epoch)) - body["radius"]
                    assert clearance > 0
                    position_tolerance = min(position_tolerance, clearance / 4)
                failed = (
                    docked is not None
                    or np.linalg.norm(delta[:3]) > position_tolerance
                    or np.linalg.norm(delta[3:]) > spec["capture"]["velocity"]
                )
                captures.append(
                    {
                        "t": epoch,
                        "position": float(np.linalg.norm(delta[:3])),
                        "velocity": float(np.linalg.norm(delta[3:])),
                    }
                )
                if kind == "dock" and port["rail"]["kind"] == "surface":
                    assert epoch == s["epoch"] and np.linalg.norm(delta) < 1e-14
                if not failed:
                    if kind == "land":
                        captures[-1]["before"] = y.tolist()
                        captures[-1]["fuelBefore"] = fuel
                    impulse(float(np.linalg.norm(delta[3:])))
                    if kind == "land":
                        captures[-1]["fuelAfter"] = fuel
                    y, docked = other, op["portId"]
            elif docked != op["portId"]:
                failed = True
            elif kind == "launch":
                rail = port["rail"]
                arc = next(a for a in program["thrustArcs"] if a["id"] == op["thrustArcId"])
                assert rail["kind"] == "surface" and arc["start"] == epoch
                radius = np.linalg.norm(y[:3] - np.array(rail["center"]))
                normal = (y[:3] - np.array(rail["center"])) / radius
                mass = ship["dryMass"] + cargo + fuel
                force = min(
                    ship["engine"]["maxThrust"] * arc["throttle"],
                    ship["engine"].get("maxAcceleration", float("inf")) * mass,
                )
                primary = next(b for b in s["bodies"] if b["id"] == rail["bodyId"])
                radial = (
                    force / mass * np.dot(direction_at(arc, epoch), normal)
                    - primary["mu"] / radius**2
                    + rail["rate"] ** 2 * radius
                )
                assert (
                    fuel > 0
                    and force > 0
                    and radial > 1e-12 * max(1, primary["mu"] / radius**2, force / mass)
                )
                docked = None
            elif kind == "undock":
                assert port["rail"]["kind"] != "surface"
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
        (
            t,
            t,
            lambda _time, state=np.concatenate((y, [fuel])): state,
            fuel,
            cargo,
            json.loads(json.dumps(stocks)),
            used_total,
        )
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
        (dense(t)[:6], float(dense(t)[6]), cargo, stocks, used + fuel - float(dense(t)[6]))
        for start, _end, dense, fuel, cargo, stocks, used in reversed(pieces)
        if start <= t
    )


def calibration(case, tight):
    s = case["bundle"]["scenario"]
    ship = s["ship"]
    arc = case["bundle"]["program"]["thrustArcs"][0]
    state = np.array([*ship["state"], ship["propellant"]])
    pieces = []
    terminal = s["duration"]
    for begin, end, powered in [
        (0, arc["start"], False),
        (arc["start"], arc["end"], True),
        (arc["end"], s["duration"], False),
    ]:

        def rhs(t, y):
            acceleration = np.zeros(3)
            for body in s["bodies"]:
                delta = np.array(body["rail"]["position"]) - y[:3]
                acceleration += body["mu"] * delta / np.linalg.norm(delta) ** 3
            mass = ship["dryMass"] + ship["cargoMass"] + y[6]
            force = (
                min(
                    ship["engine"]["maxThrust"] * arc["throttle"],
                    ship["engine"].get("maxAcceleration", float("inf")) * mass,
                )
                if powered
                else 0
            )
            acceleration += force / mass * np.array(arc["direction"])
            return np.concatenate((y[3:6], acceleration, [-force / ship["exhaustVelocity"]]))

        class Empty:
            terminal = True
            direction = -1

            def __call__(self, _t, y):
                return y[6]

        empty = Empty()
        solution = solve_ivp(
            rhs,
            (begin, end),
            state,
            method="DOP853",
            rtol=2.3e-14 if tight else 2e-13,
            atol=2e-15,
            dense_output=True,
            events=empty,
        )
        assert solution.success
        pieces.append((begin, solution.t[-1], solution.sol))
        state = solution.y[:, -1]
        if solution.status == 1:
            terminal = float(solution.t[-1])
            break
    return pieces, terminal


def check_calibrations(request):
    result = []
    for case in request["calibrations"]:
        pieces, terminal = calibration(case, True)
        regular, _ = calibration(case, False)
        checks = []
        for step in case["steps"]:
            errors, fuel_errors, refinement = [], [], []
            for sample in step["samples"]:
                state = next(
                    sol(sample["t"]) for begin, _, sol in reversed(pieces) if begin <= sample["t"]
                )
                coarse = next(
                    sol(sample["t"]) for begin, _, sol in reversed(regular) if begin <= sample["t"]
                )
                errors.append(float(np.linalg.norm(np.array(sample["y"]) - state[:6])))
                fuel_errors.append(abs(sample["propellant"] - state[6]))
                refinement.append(float(np.linalg.norm(coarse - state)))
            assert max(errors) < 1e-9 and max(fuel_errors) < 1e-10 and max(refinement) < 1e-10
            assert abs(step["terminal"]["t"] - terminal) < 1e-12
            assert step["terminal"]["status"] == (
                "fuel-depleted" if case["label"] == "depletion" else "horizon"
            )
            checks.append(
                {
                    "step": step["step"],
                    "stateError": max(errors),
                    "fuelError": max(fuel_errors),
                    "oracleRefinement": max(refinement),
                }
            )
        result.append({"case": case["label"], "terminalEpoch": terminal, "checks": checks})
    return result


def main():
    request = json.loads((ROOT / "docs/evidence/propulsion-oracle-input.json").read_text())
    rows = []
    for case in request["cases"]:
        pieces, result = replay(case["bundle"], True)
        regular, regular_result = replay(case["bundle"], False)
        checks = []
        for index, step in enumerate(case["steps"]):
            budget = [1e-6, 1e-7, 1e-8][index]
            position, velocity, fuel_errors, usage_errors, refinement = [], [], [], [], []
            for sample in step["samples"]:
                oracle, fuel, cargo, stocks, used = evaluate(pieces, sample["t"])
                delta = np.array(sample["y"]) - oracle
                position.append(float(np.linalg.norm(delta[:3])))
                velocity.append(float(np.linalg.norm(delta[3:])))
                fuel_errors.append(abs(sample["propellant"] - fuel))
                usage_errors.append(abs(sample["fuelUsed"] - used))
                refinement.append(float(np.linalg.norm(evaluate(regular, sample["t"])[0] - oracle)))
                assert sample["logistics"]["cargoMass"] == cargo
                for port in sample["logistics"]["ports"]:
                    assert abs(port["cargo"] - stocks[port["id"]][0]) < 1e-14
                    assert abs(port["propellant"] - stocks[port["id"]][1]) < 1e-8
            assert max(position) < budget and max(velocity) < budget, (
                case["label"],
                index,
                max(position),
                max(velocity),
            )
            assert max(fuel_errors) < 1e-8 and max(usage_errors) < 1e-8
            assert max(refinement) < 1e-9
            assert [[e["t"], e["kind"], e["id"]] for e in step["ledger"]] == result["trace"]
            assert step["terminal"]["status"] == result["status"] == "horizon"
            assert step["result"]["complete"] and result["complete"]
            assert abs(step["result"]["propellantUsed"] - result["fuelUsed"]) < 1e-8
            captures = []
            for dock, capture in zip(
                [e for e in step["ledger"] if e["kind"] == "dock"], result["captures"], strict=True
            ):
                assert abs(dock["positionError"] - capture["position"]) < budget
                assert abs(dock["deltaV"] - capture["velocity"]) < budget
                # Strong admission gate, applied to finest program replay. The coarse
                # runs establish convergence, not independent authoring solutions.
                if index == 2:
                    assert max(dock["positionError"], capture["position"]) + budget < 1e-7
                    assert max(dock["deltaV"], capture["velocity"]) + budget < 1e-7
                captures.append(
                    {
                        "t": dock["t"],
                        "productionPosition": dock["positionError"],
                        "productionVelocity": dock["deltaV"],
                        "oraclePosition": capture["position"],
                        "oracleVelocity": capture["velocity"],
                    }
                )
            checks.append(
                {
                    "step": step["step"],
                    "stateBudget": budget,
                    "position": max(position),
                    "velocity": max(velocity),
                    "fuelError": max(fuel_errors),
                    "usageError": max(usage_errors),
                    "oracleRefinement": max(refinement),
                    "captures": captures,
                    "clearanceCertified": step["clearanceCertified"],
                }
            )
        rows.append(
            {
                "case": case["label"],
                "set": case["set"],
                "terminal": result,
                "checks": checks,
                "oracleFuelRefinement": abs(regular_result["fuel"] - result["fuel"]),
            }
        )
    report = {"trips": rows, "calibrations": check_calibrations(request)}
    (ROOT / "docs/evidence/propulsion-oracle-report.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
