"""Independent six-state DOP853 witness: oriented sources and paid spatial impulses."""

from __future__ import annotations

import argparse
import json
from math import cos, expm1, sin
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

ROOT = Path(__file__).resolve().parents[2]


def replay(bundle, tight):
    scenario, program = bundle["scenario"], bundle["program"]
    ship = scenario["ship"]
    fuel = ship["propellant"]
    t = scenario["epoch"]
    y = np.array(ship["state"], dtype=float)
    pieces, right, burns = [], {}, []

    def body_state(body, epoch):
        rail = body["rail"]
        if rail["kind"] == "fixed":
            return np.array(rail["position"])
        a = rail["phase"] + rail["rate"] * epoch
        return np.array(rail["center"]) + rail["radius"] * (
            np.array(rail["u"]) * cos(a) + np.array(rail["v"]) * sin(a)
        )

    def rhs(epoch, state):
        acceleration = np.zeros(3)
        for body in scenario["bodies"]:
            d = body_state(body, epoch) - state[:3]
            radius = np.linalg.norm(d)
            assert radius > body["radius"]
            acceleration += body["mu"] * d / radius**3
        return np.concatenate((state[3:], acceleration))

    for burn in [*program["burns"], {"t": t + scenario["duration"], "end": True}]:
        epoch = burn["t"]
        if epoch > t:
            solution = solve_ivp(
                rhs,
                (t, epoch),
                y,
                method="DOP853",
                dense_output=True,
                rtol=2.3e-14 if tight else 2e-12,
                atol=2e-15 if tight else 2e-14,
            )
            assert solution.success
            pieces.append((t, epoch, solution.sol, fuel))
            y = solution.sol(epoch)
        t = epoch
        if burn.get("end"):
            right[t] = (y.copy(), fuel)
            break
        before = y.copy()
        if burn["basis"] == "inertial-cartesian-v2":
            dv = np.array(burn["deltaVelocity"])
        else:
            body = next(b for b in scenario["bodies"] if b["id"] == burn["referenceBodyId"])
            radial = y[:3] - body_state(body, t)
            radial /= np.linalg.norm(radial)
            transverse = np.cross(burn["orientationAxis"], radial)
            transverse /= np.linalg.norm(transverse)
            normal = np.cross(radial, transverse)
            dv = burn["radial"] * radial + burn["transverse"] * transverse + burn["normal"] * normal
        magnitude = float(np.linalg.norm(dv))
        used = (ship["dryMass"] + ship["cargoMass"] + fuel) * -expm1(
            -magnitude / ship["exhaustVelocity"]
        )
        assert used <= fuel
        fuel -= used
        y = y.copy()
        y[3:] += dv
        right[t] = (y.copy(), fuel)
        burns.append((t, before, y.copy(), used))

    def evaluate(epoch):
        if epoch in right:
            return right[epoch]
        if epoch == scenario["epoch"]:
            return np.array(ship["state"]), ship["propellant"]
        return next((dense(epoch), f) for a, b, dense, f in pieces if a <= epoch < b)

    return evaluate, burns


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--milestone", choices=["spatial", "lunar-rendezvous"], default="spatial")
    milestone = parser.parse_args().milestone
    request = json.loads((ROOT / f"docs/evidence/{milestone}-oracle-input.json").read_text())
    rows = []
    for case in request["cases"]:
        oracle, burns = replay(case["bundle"], True)
        loose, _ = replay(case["bundle"], False)
        checks = []
        for step in case["steps"]:
            p, v, tightening, fuel_error, left_error = 0.0, 0.0, 0.0, 0.0, 0.0
            for sample in step["samples"]:
                expected, fuel = oracle(sample["t"])
                delta = np.array(sample["y"]) - expected
                p, v = (
                    max(p, float(np.linalg.norm(delta[:3]))),
                    max(v, float(np.linalg.norm(delta[3:]))),
                )
                tightening = max(
                    tightening, float(np.linalg.norm(loose(sample["t"])[0] - expected))
                )
                fuel_error = max(fuel_error, abs(sample["propellant"] - fuel))
            for boundary, entry, (_, before, after, used) in zip(
                step["boundaries"], step["ledger"], burns, strict=True
            ):
                left_error = max(
                    left_error, float(np.linalg.norm(np.array(boundary["before"]["y"]) - before))
                )
                assert np.linalg.norm(np.array(boundary["after"]["y"]) - after) < 1e-7
                assert abs(entry["fuelUsed"] - used) < 1e-11
            assert p < 1e-7 and v < 1e-7 and tightening < 1e-9 and fuel_error < 1e-11
            checks.append(
                {
                    "step": step["step"],
                    "position": p,
                    "velocity": v,
                    "oracleTightening": tightening,
                    "fuel": fuel_error,
                    "eventLeftState": left_error,
                }
            )
        assert checks[-1]["position"] < 1e-8 and checks[-1]["velocity"] < 1e-8
        rows.append({"case": case["label"], "checks": checks})
    (ROOT / f"docs/evidence/{milestone}-oracle-report.json").write_text(
        json.dumps(rows, indent=2) + "\n"
    )
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
