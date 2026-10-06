"""Independent edit-domain and refined-event acceptance for the M1 manual editor."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray
from scipy.integrate import solve_ivp

from m0_oracle import body_state

Vector = NDArray[np.float64]
ROOT = Path(__file__).resolve().parents[2]


def solve(bundle: dict[str, Any], tight: bool) -> tuple[list[Any], list[dict[str, Any]], float]:
    s, p = bundle["scenario"], bundle["program"]
    bodies, ship = s["bodies"], s["ship"]

    def derivative(t: float, y: Vector) -> Vector:
        acceleration = np.zeros(2)
        for body in bodies:
            displacement = body_state(body, t)[:2] - y[:2]
            radius = np.linalg.norm(displacement)
            if radius < 1e-10:
                raise ValueError("singular oracle stage")
            acceleration += body["mu"] * displacement / radius**3
        return np.concatenate([y[2:], acceleration])

    def surface(body: dict[str, Any]) -> Any:
        def crossing(t: float, y: Vector) -> float:
            return float(np.linalg.norm(y[:2] - body_state(body, t)[:2]) - body["radius"])

        setattr(crossing, "terminal", True)
        setattr(crossing, "direction", -1)
        return crossing

    def apsis(body: dict[str, Any]) -> Any:
        def crossing(t: float, y: Vector) -> float:
            state = body_state(body, t)
            return float(np.dot(y[:2] - state[:2], y[2:] - state[2:]))

        return crossing

    events = [*[surface(b) for b in bodies], *[apsis(b) for b in bodies]]
    y = np.array(ship["state"], dtype=np.float64)
    fuel, start = float(ship["propellant"]), float(s["epoch"])
    pieces, roots = [], []
    for burn in [*p["burns"], {"t": s["epoch"] + s["duration"]}]:
        end = float(burn["t"])
        if end > start:
            result = solve_ivp(
                derivative,
                (start, end),
                y,
                method="DOP853",
                rtol=3e-14 if tight else 1e-12,
                atol=1e-15 if tight else 1e-14,
                max_step=0.01 if tight else 0.03,
                dense_output=True,
                events=events,
            )
            assert result.success, result.message
            pieces.append(result)
            for index, body in enumerate(bodies):
                for t in result.t_events[len(bodies) + index]:
                    state = result.sol(t)
                    ref = body_state(body, float(t))
                    # Classify with the radial acceleration derivative, not screen samples.
                    d = state[:2] - ref[:2]
                    dv = state[2:] - ref[2:]
                    rail = body["rail"]
                    source_acceleration = (
                        np.zeros(2)
                        if rail["kind"] == "fixed"
                        else -(ref[:2] - rail["center"]) * rail["rate"] ** 2
                    )
                    slope = np.dot(dv, dv) + np.dot(
                        d, derivative(float(t), state)[2:] - source_acceleration
                    )
                    roots.append(
                        {
                            "bodyId": body["id"],
                            "kind": "periapsis" if slope > 0 else "apoapsis",
                            "t": float(t),
                            "distance": float(np.linalg.norm(d)),
                            "relativeSpeed": float(np.linalg.norm(dv)),
                        }
                    )
            if result.status == 1:
                return pieces, roots, fuel
            y = result.y[:, -1].copy()
        if "referenceBodyId" in burn:
            body = next(b for b in bodies if b["id"] == burn["referenceBodyId"])
            radial = y[:2] - body_state(body, end)[:2]
            radial /= np.linalg.norm(radial)
            dv = burn["radial"] * radial + burn["transverse"] * np.array([-radial[1], radial[0]])
            used = (ship["dryMass"] + ship["cargoMass"] + fuel) * (
                -np.expm1(-np.linalg.norm(dv) / ship["exhaustVelocity"])
            )
            assert used <= fuel
            y[2:] += dv
            fuel -= used
        start = end
    return pieces, roots, fuel


def evaluate(pieces: list[Any], t: float) -> Vector:
    for piece in reversed(pieces):
        if piece.t[0] - 1e-12 <= t <= piece.t[-1] + 1e-12:
            return piece.sol(t)
    raise ValueError(f"Oracle epoch unavailable: {t}")


def main() -> None:
    request = json.loads((ROOT / "docs/evidence/m1-oracle-input.json").read_text())
    rows = []
    for case in request["cases"]:
        bundle = case["bundle"]
        pieces, roots, fuel = solve(bundle, True)
        regular, _, _ = solve(bundle, False)
        checks = []
        for step in case["steps"]:
            positions, states, refinements = [], [], []
            for sample in step["samples"]:
                expected = evaluate(pieces, sample["t"])
                y = np.array(sample["y"])
                positions.append(float(np.linalg.norm(y[:2] - expected[:2])))
                states.append(float(np.linalg.norm(y - expected)))
                refinements.append(float(np.linalg.norm(evaluate(regular, sample["t"]) - expected)))
            event_errors = []
            for diagnostics in step["diagnostics"].values():
                for event in diagnostics["apsides"]:
                    candidates = [
                        root
                        for root in roots
                        if root["kind"] == event["kind"] and root["bodyId"] == event["bodyId"]
                    ]
                    assert candidates, event
                    other = min(candidates, key=lambda r: abs(r["t"] - event["t"]))
                    event_errors.append(
                        {
                            "epoch": abs(other["t"] - event["t"]),
                            "distance": abs(other["distance"] - event["distance"]),
                            "relativeSpeed": abs(other["relativeSpeed"] - event["relativeSpeed"]),
                        }
                    )
            max_event_time = max((e["epoch"] for e in event_errors), default=0)
            max_event_speed = max((e["relativeSpeed"] for e in event_errors), default=0)
            assert max(positions) < 1e-5, (bundle["program"], step["step"], max(positions))
            assert max(refinements) < 1e-8, max(refinements)
            assert max_event_time < 1e-5 and max_event_speed < 1e-5, event_errors
            assert abs(step["terminal"]["propellant"] - fuel) < 1e-14
            checks.append(
                {
                    "step": step["step"],
                    "maxPositionError": max(positions),
                    "maxStateError": max(states),
                    "maxOracleRefinement": max(refinements),
                    "maxEventTimeError": max_event_time,
                    "maxEventSpeedError": max_event_speed,
                    "eventsChecked": len(event_errors),
                }
            )
        rows.append(
            {
                "scenarioId": bundle["scenario"]["id"],
                "burn": bundle["program"]["burns"][0],
                "status": case["steps"][0]["terminal"]["status"],
                "oracleSurfaceTermination": pieces[-1].status == 1,
                "checks": checks,
            }
        )
    report = {
        "environment": request["environment"],
        "acceptance": request["acceptance"],
        "cases": rows,
        "maxPositionError": max(c["maxPositionError"] for r in rows for c in r["checks"]),
        "maxEventTimeError": max(c["maxEventTimeError"] for r in rows for c in r["checks"]),
        "maxEventSpeedError": max(c["maxEventSpeedError"] for r in rows for c in r["checks"]),
    }
    (ROOT / "docs/evidence/m1-oracle-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "cases"}, indent=2))


if __name__ == "__main__":
    main()
