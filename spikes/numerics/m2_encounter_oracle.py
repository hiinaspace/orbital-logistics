"""Independent integration and geometry checks for manual M2 encounter actions."""

import json
from pathlib import Path

import numpy as np
from scipy.optimize import brentq

from m1_oracle import evaluate, solve

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    request = json.loads((ROOT / "docs/evidence/m2-encounter-oracle-input.json").read_text())
    rows = []
    for case in request["cases"]:
        bundle = case["bundle"]
        spec = bundle["scenario"]["rendezvous"]
        p = case["result"]["proposal"]
        arrival = p["arrival"]
        target = json.loads(json.dumps(bundle))
        target["scenario"]["ship"]["state"] = spec["target"]["state"]
        target["program"]["burns"] = []
        pieces, _, fuel = solve(bundle, True)
        target_pieces, _, _ = solve(target, True)
        errors = []
        for step in case["steps"]:
            position, velocity = [], []
            for sample in step["samples"]:
                for state, oracle in [
                    (sample["y"], evaluate(pieces, sample["t"])),
                    (sample["target"], evaluate(target_pieces, sample["t"])),
                ]:
                    difference = np.array(state) - oracle
                    position.append(float(np.linalg.norm(difference[:2])))
                    velocity.append(float(np.linalg.norm(difference[2:])))
            assert max(position) < spec["tolerance"]["position"] / 100
            assert max(velocity) < spec["tolerance"]["velocity"] / 100
            assert abs(step["terminal"]["propellant"] - fuel) < 1e-14
            errors.append(
                {"step": step["step"], "position": max(position), "velocity": max(velocity)}
            )
        ship = evaluate(pieces, arrival["t"])
        other = evaluate(target_pieces, arrival["assist"]["targetEpoch"])
        miss = float(np.linalg.norm(ship[:2] - other[:2]))
        speed = float(np.linalg.norm(ship[2:] - other[2:]))
        assert (
            miss < spec["tolerance"]["position"] / 100
            and speed < spec["tolerance"]["velocity"] / 100
        )
        seed, _, _ = solve(case["seed"], True)
        root_error = None
        if case["label"] == "phase-offset-match":
            root = brentq(lambda t: np.linalg.norm(evaluate(seed, t)[:2]) - 1.4, 3, 3.5, xtol=1e-13)
            root_error = abs(root - arrival["t"])
            assert root_error < 1e-8
            simultaneous = float(
                np.linalg.norm(ship[:2] - evaluate(target_pieces, arrival["t"])[:2])
            )
            assert simultaneous > spec["tolerance"]["position"]
        rows.append(
            {
                "case": case["label"],
                "miss": miss,
                "relativeSpeed": speed,
                "rootError": root_error,
                "errors": errors,
            }
        )
    (ROOT / "docs/evidence/m2-encounter-oracle-report.json").write_text(
        json.dumps(rows, indent=2) + "\n"
    )
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
