"""Independent SciPy DOP853 check of production M0 propagation and impulse/fuel semantics."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray
from scipy.integrate import solve_ivp

Vector = NDArray[np.float64]
ROOT = Path(__file__).resolve().parents[2]


def body_state(body: dict[str, Any], t: float) -> Vector:
    rail = body["rail"]
    if rail["kind"] == "fixed":
        return np.array([*rail["position"], 0.0, 0.0], dtype=np.float64)
    theta, radius, rate = rail["phase"] + rail["rate"] * t, rail["radius"], rail["rate"]
    return np.array(
        [
            rail["center"][0] + radius * np.cos(theta),
            rail["center"][1] + radius * np.sin(theta),
            -radius * rate * np.sin(theta),
            radius * rate * np.cos(theta),
        ]
    )


def solve(bundle: dict[str, Any], times: Vector, tight: bool) -> tuple[Vector, float]:
    scenario, program = bundle["scenario"], bundle["program"]
    bodies, ship = scenario["bodies"], scenario["ship"]

    def derivative(t: float, y: Vector) -> Vector:
        acceleration = np.zeros(2)
        for body in bodies:
            displacement = body_state(body, t)[:2] - y[:2]
            radius = np.linalg.norm(displacement)
            if radius <= body["radius"]:
                raise ValueError("oracle surface crossing")
            acceleration += body["mu"] * displacement / radius**3
        return np.concatenate([y[2:], acceleration])

    y = np.array(ship["state"], dtype=np.float64)
    fuel = float(ship["propellant"])
    start = float(scenario["epoch"])
    samples = np.zeros((len(times), 4))
    burns = [*program["burns"], {"t": scenario["epoch"] + scenario["duration"]}]
    for burn in burns:
        end = float(burn["t"])
        result = solve_ivp(
            derivative,
            (start, end),
            y,
            method="DOP853",
            rtol=3e-14 if tight else 1e-12,
            atol=1e-15 if tight else 1e-14,
            max_step=0.01 if tight else 0.05,
            dense_output=True,
        )
        assert result.success, result.message
        # Later segment overwrites a coincident epoch with its post-burn state.
        mask = (times >= start) & (times <= end)
        samples[mask] = result.sol(times[mask]).T
        y = result.y[:, -1].copy()
        if "referenceBodyId" in burn:
            reference = next(b for b in bodies if b["id"] == burn["referenceBodyId"])
            radial = y[:2] - body_state(reference, end)[:2]
            radial /= np.linalg.norm(radial)
            transverse = np.array([-radial[1], radial[0]])
            dv = burn["radial"] * radial + burn["transverse"] * transverse
            used = (ship["dryMass"] + ship["cargoMass"] + fuel) * (
                -np.expm1(-np.linalg.norm(dv) / ship["exhaustVelocity"])
            )
            assert used <= fuel
            fuel -= used
            y[2:] += dv
        start = end
    return samples, fuel


def main() -> None:
    request = json.loads((ROOT / "docs/evidence/m0-oracle-input.json").read_text())
    times = np.array(request["times"], dtype=np.float64)
    report: dict[str, Any] = {"method": "DOP853", "branches": []}
    for branch in request["branches"]:
        regular, _ = solve(branch["bundle"], times, False)
        tight, fuel = solve(branch["bundle"], times, True)
        refinement = float(np.linalg.norm(regular - tight, axis=1).max())
        assert refinement < 1e-9
        rows = []
        for step in branch["steps"]:
            samples = np.array(step["samples"])
            position_error = float(np.linalg.norm(samples[:, :2] - tight[:, :2], axis=1).max())
            state_error = float(np.linalg.norm(samples - tight, axis=1).max())
            rows.append(
                {
                    "step": step["step"],
                    "maxPositionError": position_error,
                    "maxStateError": state_error,
                }
            )
            if step["step"] == 1 / 512:
                assert position_error < 1e-7 and state_error < 1e-7, rows
            ledger = step["ledger"]
            if ledger:
                assert abs(ledger[-1]["propellantAfter"] - fuel) < 1e-14
        report["branches"].append(
            {
                "name": branch["name"],
                "oracleRefinement": refinement,
                "propellantAfter": fuel,
                "steps": rows,
            }
        )
    (ROOT / "docs/evidence/m0-oracle-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
